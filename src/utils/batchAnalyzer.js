/**
 * 배치 시뮬레이션 분석 및 보고서 생성 시스템
 * 대량 데이터 분석과 통계적 인사이트 제공
 */

// 순환 참조 방지를 위한 동적 import
let runStrategicSimulation = null;
let ADVANCED_STRATEGIES = null;
let createProcessingGem = null;
let simulateProcessing = null;

async function loadDependencies() {
  if (!runStrategicSimulation) {
    const strategicModule = await import('./strategicEngine.js');
    runStrategicSimulation = strategicModule.runStrategicSimulation;
    ADVANCED_STRATEGIES = strategicModule.ADVANCED_STRATEGIES;
  }
  
  if (!createProcessingGem) {
    const processingModule = await import('./gemProcessing.js');
    createProcessingGem = processingModule.createProcessingGem;
    simulateProcessing = processingModule.simulateProcessing;
  }
}

/**
 * 배치 분석 설정
 */
const BATCH_CONFIG = {
  DEFAULT_BATCH_SIZE: 1000,
  PROGRESS_UPDATE_INTERVAL: 50,
  STATISTICAL_CONFIDENCE: 0.95,
  OUTLIER_THRESHOLD: 2.5, // 표준편차 배수
};

/**
 * 배치 시뮬레이션 실행기
 */
export class BatchSimulationRunner {
  constructor() {
    this.isRunning = false;
    this.currentProgress = 0;
    this.totalRuns = 0;
    this.completedRuns = 0;
    this.results = [];
    this.progressCallbacks = [];
  }

  /**
   * 진행 상황 콜백 등록
   */
  onProgress(callback) {
    this.progressCallbacks.push(callback);
  }

  /**
   * 진행 상황 업데이트
   */
  updateProgress(completed, total, message = '') {
    this.completedRuns = completed;
    this.totalRuns = total;
    this.currentProgress = total > 0 ? (completed / total) * 100 : 0;

    this.progressCallbacks.forEach(callback => {
      try {
        callback({
          completed,
          total,
          percentage: this.currentProgress,
          message,
          isRunning: this.isRunning
        });
      } catch (error) {
        console.error('Progress callback error:', error);
      }
    });
  }

  /**
   * 다중 전략 배치 시뮬레이션 실행
   */
  async runMultiStrategyBatch(config) {
    if (this.isRunning) {
      throw new Error('시뮬레이션이 이미 실행 중입니다.');
    }

    await loadDependencies();

    this.isRunning = true;
    this.results = [];

    try {
      const {
        strategies = Object.keys(ADVANCED_STRATEGIES),
        runsPerStrategy = 100,
        gemConfigs = [{ mainType: 'DEALER', subType: 'CRIT', grade: 'RARE' }],
        includeBaseline = true
      } = config;

      const totalStrategies = strategies.length + (includeBaseline ? 1 : 0);
      const totalGemConfigs = gemConfigs.length;
      const totalRuns = totalStrategies * totalGemConfigs * runsPerStrategy;

      this.updateProgress(0, totalRuns, '시뮬레이션 준비 중...');

      let completed = 0;

      // 각 젬 설정에 대해
      for (const gemConfig of gemConfigs) {
        const gemResults = {
          gemConfig,
          strategies: {}
        };

        // 베이스라인 (랜덤 선택) 전략 추가
        if (includeBaseline) {
          const baselineResults = [];
          
          for (let run = 0; run < runsPerStrategy; run++) {
            const initialGem = createProcessingGem(gemConfig.mainType, gemConfig.subType, gemConfig.grade);
            
            // 기본 랜덤 전략 시뮬레이션
            const result = await this.runBaselineSimulation(initialGem);
            baselineResults.push(result);
            
            completed++;
            if (completed % BATCH_CONFIG.PROGRESS_UPDATE_INTERVAL === 0) {
              this.updateProgress(completed, totalRuns, `베이스라인 전략 실행 중... (${run + 1}/${runsPerStrategy})`);
            }
          }

          gemResults.strategies.BASELINE = {
            name: '베이스라인 (랜덤 선택)',
            results: baselineResults,
            statistics: this.calculateBatchStatistics(baselineResults)
          };
        }

        // 각 고급 전략에 대해
        for (const strategyKey of strategies) {
          if (!ADVANCED_STRATEGIES[strategyKey]) continue;

          const strategy = ADVANCED_STRATEGIES[strategyKey];
          const strategyResults = [];

          this.updateProgress(completed, totalRuns, `${strategy.name} 실행 중...`);

          for (let run = 0; run < runsPerStrategy; run++) {
            const initialGem = createProcessingGem(gemConfig.mainType, gemConfig.subType, gemConfig.grade);
            
            try {
              const result = await runStrategicSimulation(initialGem, strategy);
              strategyResults.push(result);
            } catch (error) {
              console.warn(`전략 ${strategy.name} 실행 중 오류:`, error);
              // 오류 발생 시 베이스라인으로 fallback
              const fallbackResult = await this.runBaselineSimulation(initialGem);
              fallbackResult.hadError = true;
              strategyResults.push(fallbackResult);
            }

            completed++;
            if (completed % BATCH_CONFIG.PROGRESS_UPDATE_INTERVAL === 0) {
              this.updateProgress(completed, totalRuns, `${strategy.name} 실행 중... (${run + 1}/${runsPerStrategy})`);
            }
          }

          gemResults.strategies[strategyKey] = {
            name: strategy.name,
            results: strategyResults,
            statistics: this.calculateBatchStatistics(strategyResults)
          };
        }

        this.results.push(gemResults);
      }

      this.updateProgress(totalRuns, totalRuns, '분석 완료!');
      return this.results;

    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 베이스라인 시뮬레이션 (랜덤 선택)
   */
  async runBaselineSimulation(initialGem) {
    // 기존의 랜덤 선택 기반 시뮬레이션과 동일하게 구현
    if (!simulateProcessing) {
      const module = await import('./gemProcessing.js');
      simulateProcessing = module.simulateProcessing;
    }
    return simulateProcessing(initialGem, true);
  }

  /**
   * 배치 통계 계산
   */
  calculateBatchStatistics(results) {
    if (results.length === 0) return null;

    const stats = {
      totalRuns: results.length,
      
      // 기본 통계
      points: this.calculateDescriptiveStats(results, r => r.finalGem?.totalPoints || 0),
      rerollsUsed: this.calculateDescriptiveStats(results, r => r.totalRerollsUsed || 0),
      processingSteps: this.calculateDescriptiveStats(results, r => r.totalProcessingSteps || 0),
      
      // 성취도 통계
      achievements: {
        ancient: results.filter(r => (r.finalGem?.totalPoints || 0) >= 19).length,
        relic: results.filter(r => (r.finalGem?.totalPoints || 0) >= 16 && (r.finalGem?.totalPoints || 0) < 19).length,
        legendary: results.filter(r => (r.finalGem?.totalPoints || 0) < 16).length,
      },
      
      // 효율성 지표
      efficiency: {
        avgPointsPerStep: 0,
        avgPointsPerReroll: 0,
        rerollEfficiency: 0
      },
      
      // 이상치 분석
      outliers: this.detectOutliers(results, r => r.finalGem?.totalPoints || 0),
      
      // 분포 분석
      distribution: this.calculateDistribution(results, r => r.finalGem?.totalPoints || 0),
      
      // 오류 비율
      errorRate: results.filter(r => r.hadError).length / results.length
    };

    // 효율성 지표 계산
    const totalPoints = stats.points.sum;
    const totalSteps = stats.processingSteps.sum;
    const totalRerolls = stats.rerollsUsed.sum;
    
    if (totalSteps > 0) {
      stats.efficiency.avgPointsPerStep = totalPoints / totalSteps;
    }
    
    if (totalRerolls > 0) {
      stats.efficiency.avgPointsPerReroll = totalPoints / totalRerolls;
      stats.efficiency.rerollEfficiency = (totalPoints / totalRerolls) / (totalPoints / totalSteps);
    }

    // 성취율 계산
    stats.achievements.ancientRate = (stats.achievements.ancient / results.length) * 100;
    stats.achievements.relicRate = (stats.achievements.relic / results.length) * 100;
    stats.achievements.legendaryRate = (stats.achievements.legendary / results.length) * 100;

    return stats;
  }

  /**
   * 기술 통계 계산
   */
  calculateDescriptiveStats(data, accessor) {
    const values = data.map(accessor).filter(v => typeof v === 'number' && !isNaN(v));
    if (values.length === 0) return { count: 0 };

    values.sort((a, b) => a - b);
    
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    const q1Index = Math.floor(values.length * 0.25);
    const q2Index = Math.floor(values.length * 0.5);
    const q3Index = Math.floor(values.length * 0.75);

    return {
      count: values.length,
      sum,
      mean,
      median: values[q2Index],
      min: values[0],
      max: values[values.length - 1],
      stdDev,
      variance,
      q1: values[q1Index],
      q3: values[q3Index],
      iqr: values[q3Index] - values[q1Index],
      
      // 신뢰구간 (95%)
      confidenceInterval: {
        lower: mean - 1.96 * (stdDev / Math.sqrt(values.length)),
        upper: mean + 1.96 * (stdDev / Math.sqrt(values.length))
      }
    };
  }

  /**
   * 이상치 탐지
   */
  detectOutliers(data, accessor) {
    const values = data.map(accessor);
    const stats = this.calculateDescriptiveStats(data, accessor);
    
    const outliers = {
      mild: [],
      extreme: []
    };

    values.forEach((value, index) => {
      const zScore = Math.abs(value - stats.mean) / stats.stdDev;
      
      if (zScore > 3) {
        outliers.extreme.push({ index, value, zScore });
      } else if (zScore > BATCH_CONFIG.OUTLIER_THRESHOLD) {
        outliers.mild.push({ index, value, zScore });
      }
    });

    return outliers;
  }

  /**
   * 분포 계산
   */
  calculateDistribution(data, accessor) {
    const values = data.map(accessor);
    const distribution = {};
    
    values.forEach(value => {
      distribution[value] = (distribution[value] || 0) + 1;
    });

    const sortedKeys = Object.keys(distribution).map(Number).sort((a, b) => a - b);
    const totalCount = values.length;

    return {
      frequencies: distribution,
      relativeFrequencies: Object.fromEntries(
        Object.entries(distribution).map(([key, count]) => [key, count / totalCount])
      ),
      cumulativeFrequencies: sortedKeys.reduce((acc, key) => {
        const prevCumulative = acc.length > 0 ? acc[acc.length - 1].cumulative : 0;
        acc.push({
          value: key,
          frequency: distribution[key],
          cumulative: prevCumulative + distribution[key] / totalCount
        });
        return acc;
      }, [])
    };
  }
}

/**
 * 보고서 생성기
 */
export class BatchReportGenerator {
  /**
   * 종합 분석 보고서 생성
   */
  static generateComprehensiveReport(batchResults, options = {}) {
    const {
      includeDetailedStats = true,
      includeOutlierAnalysis = true,
      includeRecommendations = true,
      format = 'structured' // 'structured' | 'markdown' | 'json'
    } = options;

    const report = {
      metadata: {
        generatedAt: new Date().toISOString(),
        totalConfigurations: batchResults.length,
        format
      },
      summary: this.generateExecutiveSummary(batchResults),
      configurations: batchResults.map(config => 
        this.generateConfigurationAnalysis(config, { includeDetailedStats, includeOutlierAnalysis })
      ),
      comparison: this.generateStrategyComparison(batchResults),
      insights: this.generateInsights(batchResults),
      recommendations: includeRecommendations ? this.generateRecommendations(batchResults) : null
    };

    switch (format) {
      case 'markdown':
        return this.formatAsMarkdown(report);
      case 'json':
        return JSON.stringify(report, null, 2);
      default:
        return report;
    }
  }

  /**
   * 경영진 요약 생성
   */
  static generateExecutiveSummary(batchResults) {
    const allStrategies = new Set();
    let totalRuns = 0;
    let bestStrategy = null;
    let bestPerformance = 0;

    batchResults.forEach(config => {
      Object.keys(config.strategies).forEach(strategy => allStrategies.add(strategy));
      Object.entries(config.strategies).forEach(([strategyKey, data]) => {
        totalRuns += data.results.length;
        const avgPoints = data.statistics?.points?.mean || 0;
        
        if (avgPoints > bestPerformance) {
          bestPerformance = avgPoints;
          bestStrategy = {
            name: data.name,
            key: strategyKey,
            avgPoints: avgPoints,
            ancientRate: data.statistics?.achievements?.ancientRate || 0
          };
        }
      });
    });

    return {
      totalStrategies: allStrategies.size,
      totalSimulations: totalRuns,
      configurations: batchResults.length,
      bestStrategy,
      keyFindings: this.extractKeyFindings(batchResults)
    };
  }

  /**
   * 주요 발견사항 추출
   */
  static extractKeyFindings(batchResults) {
    const findings = [];

    // 전략별 성능 차이 분석
    const strategyPerformance = this.analyzeStrategyPerformance(batchResults);
    if (strategyPerformance.significantDifference) {
      findings.push({
        type: 'performance_gap',
        message: `전략 간 성능 차이가 유의미함: 최고 ${strategyPerformance.best.avgPoints.toFixed(2)}점 vs 최저 ${strategyPerformance.worst.avgPoints.toFixed(2)}점`,
        importance: 'high'
      });
    }

    // Ancient 달성률 분석
    const ancientRates = this.analyzeAncientRates(batchResults);
    if (ancientRates.maxRate > 20) {
      findings.push({
        type: 'achievement_rate',
        message: `${ancientRates.bestStrategy}에서 Ancient 달성률 ${ancientRates.maxRate.toFixed(1)}% 기록`,
        importance: 'high'
      });
    }

    // 리롤 효율성 분석
    const rerollEfficiency = this.analyzeRerollEfficiency(batchResults);
    if (rerollEfficiency.hasInefficientStrategies) {
      findings.push({
        type: 'efficiency',
        message: `일부 전략에서 리롤 사용 비효율 발견`,
        importance: 'medium'
      });
    }

    return findings;
  }

  /**
   * 전략 성능 분석
   */
  static analyzeStrategyPerformance(batchResults) {
    const allPerformances = [];
    
    batchResults.forEach(config => {
      Object.entries(config.strategies).forEach(([key, data]) => {
        allPerformances.push({
          key,
          name: data.name,
          avgPoints: data.statistics?.points?.mean || 0,
          ancientRate: data.statistics?.achievements?.ancientRate || 0
        });
      });
    });

    allPerformances.sort((a, b) => b.avgPoints - a.avgPoints);
    
    const best = allPerformances[0];
    const worst = allPerformances[allPerformances.length - 1];
    const performanceGap = best.avgPoints - worst.avgPoints;

    return {
      best,
      worst,
      performanceGap,
      significantDifference: performanceGap > 1.0 // 1점 이상 차이면 유의미하다고 판단
    };
  }

  /**
   * Ancient 달성률 분석
   */
  static analyzeAncientRates(batchResults) {
    let maxRate = 0;
    let bestStrategy = '';

    batchResults.forEach(config => {
      Object.entries(config.strategies).forEach(([key, data]) => {
        const rate = data.statistics?.achievements?.ancientRate || 0;
        if (rate > maxRate) {
          maxRate = rate;
          bestStrategy = data.name;
        }
      });
    });

    return { maxRate, bestStrategy };
  }

  /**
   * 리롤 효율성 분석
   */
  static analyzeRerollEfficiency(batchResults) {
    const efficiencyData = [];

    batchResults.forEach(config => {
      Object.entries(config.strategies).forEach(([key, data]) => {
        const efficiency = data.statistics?.efficiency?.rerollEfficiency || 0;
        efficiencyData.push({ key, efficiency });
      });
    });

    const avgEfficiency = efficiencyData.reduce((sum, d) => sum + d.efficiency, 0) / efficiencyData.length;
    const hasInefficientStrategies = efficiencyData.some(d => d.efficiency < avgEfficiency * 0.8);

    return { hasInefficientStrategies, avgEfficiency };
  }

  /**
   * 설정별 분석 생성
   */
  static generateConfigurationAnalysis(config, options) {
    const { includeDetailedStats, includeOutlierAnalysis } = options;
    
    const analysis = {
      gemConfig: config.gemConfig,
      strategySummary: Object.fromEntries(
        Object.entries(config.strategies).map(([key, data]) => [
          key,
          {
            name: data.name,
            avgPoints: data.statistics?.points?.mean || 0,
            ancientRate: data.statistics?.achievements?.ancientRate || 0,
            errorRate: data.statistics?.errorRate || 0
          }
        ])
      )
    };

    if (includeDetailedStats) {
      analysis.detailedStats = config.strategies;
    }

    if (includeOutlierAnalysis) {
      analysis.outlierAnalysis = Object.fromEntries(
        Object.entries(config.strategies).map(([key, data]) => [
          key,
          {
            mildOutliers: data.statistics?.outliers?.mild?.length || 0,
            extremeOutliers: data.statistics?.outliers?.extreme?.length || 0
          }
        ])
      );
    }

    return analysis;
  }

  /**
   * 전략 비교 생성
   */
  static generateStrategyComparison(batchResults) {
    const strategyAggregates = {};

    batchResults.forEach(config => {
      Object.entries(config.strategies).forEach(([key, data]) => {
        if (!strategyAggregates[key]) {
          strategyAggregates[key] = {
            name: data.name,
            configurations: 0,
            totalRuns: 0,
            avgPoints: [],
            ancientRates: [],
            rerollUsage: []
          };
        }

        const agg = strategyAggregates[key];
        agg.configurations++;
        agg.totalRuns += data.results.length;
        agg.avgPoints.push(data.statistics?.points?.mean || 0);
        agg.ancientRates.push(data.statistics?.achievements?.ancientRate || 0);
        agg.rerollUsage.push(data.statistics?.rerollsUsed?.mean || 0);
      });
    });

    // 각 전략의 종합 성능 계산
    const comparison = Object.fromEntries(
      Object.entries(strategyAggregates).map(([key, data]) => [
        key,
        {
          name: data.name,
          overallAvgPoints: data.avgPoints.reduce((a, b) => a + b, 0) / data.avgPoints.length,
          overallAncientRate: data.ancientRates.reduce((a, b) => a + b, 0) / data.ancientRates.length,
          consistencyScore: this.calculateConsistencyScore(data.avgPoints),
          configurations: data.configurations,
          totalRuns: data.totalRuns
        }
      ])
    );

    return comparison;
  }

  /**
   * 일관성 점수 계산 (변동계수의 역수)
   */
  static calculateConsistencyScore(values) {
    if (values.length <= 1) return 1;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / mean; // 변동계수
    
    return Math.max(0, 1 - cv); // 변동계수가 낮을수록 일관성 높음
  }

  /**
   * 인사이트 생성
   */
  static generateInsights(batchResults) {
    const insights = [];

    // 성능 인사이트
    const performanceInsight = this.generatePerformanceInsight(batchResults);
    if (performanceInsight) insights.push(performanceInsight);

    // 효율성 인사이트
    const efficiencyInsight = this.generateEfficiencyInsight(batchResults);
    if (efficiencyInsight) insights.push(efficiencyInsight);

    // 안정성 인사이트
    const stabilityInsight = this.generateStabilityInsight(batchResults);
    if (stabilityInsight) insights.push(stabilityInsight);

    return insights;
  }

  static generatePerformanceInsight(batchResults) {
    const comparison = this.generateStrategyComparison(batchResults);
    const sortedStrategies = Object.entries(comparison)
      .sort(([,a], [,b]) => b.overallAvgPoints - a.overallAvgPoints);

    if (sortedStrategies.length < 2) return null;

    const best = sortedStrategies[0][1];
    const second = sortedStrategies[1][1];
    const improvement = ((best.overallAvgPoints - second.overallAvgPoints) / second.overallAvgPoints * 100);

    return {
      type: 'performance',
      title: '성능 분석',
      message: `${best.name}이 평균 ${best.overallAvgPoints.toFixed(2)}점으로 최고 성능을 보임 (2위 대비 ${improvement.toFixed(1)}% 향상)`,
      data: { best: best.name, improvement }
    };
  }

  static generateEfficiencyInsight(batchResults) {
    // 리롤 대비 성과 분석
    const efficiencyData = [];
    
    batchResults.forEach(config => {
      Object.entries(config.strategies).forEach(([key, data]) => {
        const avgRerolls = data.statistics?.rerollsUsed?.mean || 0;
        const avgPoints = data.statistics?.points?.mean || 0;
        
        if (avgRerolls > 0) {
          efficiencyData.push({
            name: data.name,
            efficiency: avgPoints / avgRerolls,
            avgRerolls,
            avgPoints
          });
        }
      });
    });

    if (efficiencyData.length === 0) return null;

    efficiencyData.sort((a, b) => b.efficiency - a.efficiency);
    const mostEfficient = efficiencyData[0];

    return {
      type: 'efficiency',
      title: '효율성 분석',
      message: `${mostEfficient.name}이 리롤당 ${mostEfficient.efficiency.toFixed(2)}점으로 가장 효율적`,
      data: { strategy: mostEfficient.name, efficiency: mostEfficient.efficiency }
    };
  }

  static generateStabilityInsight(batchResults) {
    const comparison = this.generateStrategyComparison(batchResults);
    const sortedByConsistency = Object.entries(comparison)
      .sort(([,a], [,b]) => b.consistencyScore - a.consistencyScore);

    if (sortedByConsistency.length === 0) return null;

    const mostStable = sortedByConsistency[0][1];

    return {
      type: 'stability',
      title: '안정성 분석',
      message: `${mostStable.name}이 일관성 점수 ${(mostStable.consistencyScore * 100).toFixed(1)}%로 가장 안정적`,
      data: { strategy: mostStable.name, consistencyScore: mostStable.consistencyScore }
    };
  }

  /**
   * 권장사항 생성
   */
  static generateRecommendations(batchResults) {
    const recommendations = [];
    const comparison = this.generateStrategyComparison(batchResults);

    // 종합 최고 전략 추천
    const bestOverall = Object.entries(comparison)
      .sort(([,a], [,b]) => b.overallAvgPoints - a.overallAvgPoints)[0];
    
    recommendations.push({
      type: 'primary',
      title: '주요 권장사항',
      message: `전반적으로 ${bestOverall[1].name} 전략을 사용하는 것을 권장합니다.`,
      reason: `평균 ${bestOverall[1].overallAvgPoints.toFixed(2)}점의 최고 성능을 보였습니다.`
    });

    // 상황별 전략 추천
    const ancientFocused = Object.entries(comparison)
      .sort(([,a], [,b]) => b.overallAncientRate - a.overallAncientRate)[0];
    
    if (ancientFocused[0] !== bestOverall[0]) {
      recommendations.push({
        type: 'situational',
        title: 'Ancient 등급 목표시',
        message: `Ancient 등급을 목표로 한다면 ${ancientFocused[1].name} 전략이 유리합니다.`,
        reason: `Ancient 달성률 ${ancientFocused[1].overallAncientRate.toFixed(1)}%로 최고 성능을 보였습니다.`
      });
    }

    // 안정성 중시 추천
    const mostStable = Object.entries(comparison)
      .sort(([,a], [,b]) => b.consistencyScore - a.consistencyScore)[0];
    
    if (mostStable[0] !== bestOverall[0] && mostStable[1].consistencyScore > 0.8) {
      recommendations.push({
        type: 'conservative',
        title: '안정적인 성과 추구시',
        message: `일관된 결과를 원한다면 ${mostStable[1].name} 전략을 고려해보세요.`,
        reason: `일관성 점수 ${(mostStable[1].consistencyScore * 100).toFixed(1)}%로 변동이 적습니다.`
      });
    }

    return recommendations;
  }

  /**
   * 마크다운 형식으로 변환
   */
  static formatAsMarkdown(report) {
    let markdown = `# 젬 가공 전략 분석 보고서\n\n`;
    markdown += `생성일시: ${new Date(report.metadata.generatedAt).toLocaleString('ko-KR')}\n\n`;

    // 경영진 요약
    markdown += `## 경영진 요약\n\n`;
    markdown += `- 총 전략 수: ${report.summary.totalStrategies}개\n`;
    markdown += `- 총 시뮬레이션: ${report.summary.totalSimulations.toLocaleString()}회\n`;
    markdown += `- 최고 전략: ${report.summary.bestStrategy?.name} (평균 ${report.summary.bestStrategy?.avgPoints}점)\n\n`;

    // 주요 발견사항
    if (report.summary.keyFindings.length > 0) {
      markdown += `### 주요 발견사항\n\n`;
      report.summary.keyFindings.forEach(finding => {
        markdown += `- **${finding.type}**: ${finding.message}\n`;
      });
      markdown += `\n`;
    }

    // 전략 비교
    markdown += `## 전략 비교\n\n`;
    markdown += `| 전략 | 평균 점수 | Ancient 달성률 | 일관성 점수 |\n`;
    markdown += `|------|-----------|----------------|-------------|\n`;
    Object.entries(report.comparison)
      .sort(([,a], [,b]) => b.overallAvgPoints - a.overallAvgPoints)
      .forEach(([key, data]) => {
        markdown += `| ${data.name} | ${data.overallAvgPoints.toFixed(2)} | ${data.overallAncientRate.toFixed(1)}% | ${(data.consistencyScore * 100).toFixed(1)}% |\n`;
      });

    markdown += `\n`;

    // 인사이트
    if (report.insights.length > 0) {
      markdown += `## 분석 인사이트\n\n`;
      report.insights.forEach(insight => {
        markdown += `### ${insight.title}\n${insight.message}\n\n`;
      });
    }

    // 권장사항
    if (report.recommendations) {
      markdown += `## 권장사항\n\n`;
      report.recommendations.forEach(rec => {
        markdown += `### ${rec.title}\n${rec.message}\n*${rec.reason}*\n\n`;
      });
    }

    return markdown;
  }
}

export default {
  BatchSimulationRunner,
  BatchReportGenerator,
  BATCH_CONFIG
};