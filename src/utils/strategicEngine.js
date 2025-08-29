/**
 * 젬 가공 전략적 의사결정 엔진
 * 확률 테이블을 기반으로 한 고급 전략 시스템
 */

import { getGemProbabilities, getBatchGemProbabilities } from './apiClient.js';
import { applyGemAction } from './gemConstants.js';

// gemProcessing.js의 함수들을 필요 시점에 동적으로 import하여 순환 참조 방지
let sampleAutoOptionSet = null;
let rerollProcessingOptions = null;

async function loadGemProcessingFunctions() {
  if (!sampleAutoOptionSet) {
    const module = await import('./gemProcessing.js');
    sampleAutoOptionSet = module.sampleAutoOptionSet;
    rerollProcessingOptions = module.rerollProcessingOptions;
  }
}

/**
 * 전략적 옵션 평가 메트릭스
 */
const EVALUATION_METRICS = {
  // 목표별 가중치
  TARGET_WEIGHTS: {
    'ancient+': 10,    // 최고 우선순위
    'relic+': 7,
    'sum9+': 5,
    'sum8+': 3,
    '5/5': 8,
    '5/4': 6,
    '4/5': 6,
    '5/3': 4,
    '4/4': 4,
    '3/5': 4
  },
  
  // 위험도 평가 (확률이 낮아질 수록 위험)
  RISK_THRESHOLD: 0.1,
  
  // 기댓값 계산 시 사용할 할인율 (미래 보상의 현재가치)
  DISCOUNT_FACTOR: 0.95
};

// 공통 selectBestOption 함수
async function selectBestOptionByExpectedValue(gem, options) {
  const optionValues = await Promise.all(
    options.map(async (option, index) => {
      const nextGem = applyGemAction({ ...gem }, option.action);
      nextGem.remainingAttempts = Math.max(0, nextGem.remainingAttempts - 1);
      
      const probabilities = await getGemProbabilities(nextGem);
      if (!probabilities) return { index, value: 0 };
      
      const expectedValue = calculateWeightedExpectedValue(probabilities);
      return { index, value: expectedValue, option };
    })
  );
  
  // 가장 높은 기댓값을 가진 옵션 선택
  const bestOption = optionValues.reduce((best, current) => 
    current.value > best.value ? current : best
  );
  
  return bestOption.index;
}

/**
 * 고급 의사결정 전략들
 */
export const ADVANCED_STRATEGIES = {
  /**
   * 확률 기댓값 기반 전략
   * 각 옵션의 기댓값을 계산하여 최적 선택
   */
  EXPECTED_VALUE: {
    name: '기댓값 최적화 전략',
    description: '각 옵션의 확률적 기댓값을 계산하여 최적의 선택을 함',
    
    async shouldReroll(gem, options) {
      try {
        // 현재 옵션들의 기댓값 계산
        const currentExpectedValue = await calculateOptionsExpectedValue(gem, options);
        
        // 리롤 후 예상 기댓값 계산 (몇 번의 샘플링을 통한 추정)
        const rerollExpectedValue = await estimateRerollExpectedValue(gem);
        
        // 리롤 비용 고려 (리롤 기회 소모의 기회비용)
        const rerollCost = calculateRerollOpportunityCost(gem);
        
        return (rerollExpectedValue - rerollCost) > currentExpectedValue;
      } catch (error) {
        console.warn('기댓값 계산 실패, 보수적 선택:', error);
        return false;
      }
    },
    
    selectBestOption: selectBestOptionByExpectedValue
  },

  /**
   * 적응형 임계값 전략
   * 남은 가공 횟수와 현재 상태에 따라 임계값을 동적 조정
   */
  ADAPTIVE_THRESHOLD: {
    name: '적응형 임계값 전략',
    description: '남은 횟수와 현재 상황에 따라 동적으로 임계값을 조정',
    
    async shouldReroll(gem, options) {
      const currentExpectedValue = await calculateOptionsExpectedValue(gem, options);
      
      // 남은 횟수에 따른 동적 임계값 계산
      const adaptiveThreshold = calculateAdaptiveThreshold(gem);
      
      return currentExpectedValue < adaptiveThreshold;
    },
    
    selectBestOption: selectBestOptionByExpectedValue
  },

  /**
   * 위험 회피 전략
   * 안정적인 성장을 추구하며 리스크를 최소화
   */
  RISK_AVERSE: {
    name: '위험 회피 전략',
    description: '안정적인 성장을 추구하며 큰 위험을 회피',
    
    async shouldReroll(gem, options) {
      // 현재 옵션들의 위험도 평가
      const riskLevel = await calculateOptionsRisk(gem, options);
      
      // 높은 위험도면 리롤 시도
      return riskLevel > 0.6;
    },
    
    async selectBestOption(gem, options) {
      // 위험-수익 비율을 고려한 옵션 선택
      const riskAdjustedValues = await Promise.all(
        options.map(async (option, index) => {
          const nextGem = applyGemAction({ ...gem }, option.action);
          nextGem.remainingAttempts = Math.max(0, nextGem.remainingAttempts - 1);
          
          const probabilities = await getGemProbabilities(nextGem);
          if (!probabilities) return { index, value: 0 };
          
          const expectedValue = calculateWeightedExpectedValue(probabilities);
          const risk = calculateSingleOptionRisk(probabilities);
          
          // 위험 조정 수익 = 기댓값 / (1 + 위험도)
          const riskAdjustedValue = expectedValue / (1 + risk);
          
          return { index, value: riskAdjustedValue, option };
        })
      );
      
      const bestOption = riskAdjustedValues.reduce((best, current) => 
        current.value > best.value ? current : best
      );
      
      return bestOption.index;
    }
  },

  /**
   * 공격적 성장 전략
   * 높은 보상을 위해 리스크를 감수
   */
  AGGRESSIVE_GROWTH: {
    name: '공격적 성장 전략',
    description: '높은 보상 달성을 위해 적극적으로 리스크를 감수',
    
    async shouldReroll(gem, options) {
      // Ancient+ 확률이 현재보다 크게 개선될 가능성이 있다면 리롤
      const currentAncientProb = await getCurrentAncientProbability(gem, options);
      const potentialImprovement = await estimatePotentialImprovement(gem);
      
      return potentialImprovement > currentAncientProb * 1.3; // 30% 이상 개선 가능성
    },
    
    async selectBestOption(gem, options) {
      // Ancient+ 확률에 가장 큰 기여를 하는 옵션 선택
      const ancientContributions = await Promise.all(
        options.map(async (option, index) => {
          const nextGem = applyGemAction({ ...gem }, option.action);
          nextGem.remainingAttempts = Math.max(0, nextGem.remainingAttempts - 1);
          
          const probabilities = await getGemProbabilities(nextGem);
          const ancientProb = probabilities?.prob_ancient || 0;
          
          return { index, value: ancientProb, option };
        })
      );
      
      const bestOption = ancientContributions.reduce((best, current) => 
        current.value > best.value ? current : best
      );
      
      return bestOption.index;
    }
  }
};

/**
 * 옵션들의 가중 기댓값 계산
 */
async function calculateOptionsExpectedValue(gem, options) {
  try {
    let totalExpectedValue = 0;
    
    for (const option of options) {
      const nextGem = applyGemAction({ ...gem }, option.action);
      nextGem.remainingAttempts = Math.max(0, nextGem.remainingAttempts - 1);
      
      const probabilities = await getGemProbabilities(nextGem);
      if (probabilities) {
        const expectedValue = calculateWeightedExpectedValue(probabilities);
        totalExpectedValue += expectedValue * 0.25; // 25% 선택 확률
      }
    }
    
    return totalExpectedValue;
  } catch (error) {
    console.error('옵션 기댓값 계산 실패:', error);
    return 0;
  }
}

/**
 * 단일 확률 세트의 가중 기댓값 계산
 */
function calculateWeightedExpectedValue(probabilities) {
  let expectedValue = 0;
  
  for (const [target, probability] of Object.entries(probabilities)) {
    if (target.startsWith('prob_')) {
      const targetName = target.replace('prob_', '');
      const weight = EVALUATION_METRICS.TARGET_WEIGHTS[targetName] || 1;
      expectedValue += (probability || 0) * weight;
    }
  }
  
  return expectedValue;
}

/**
 * 리롤 후 기댓값 추정 (몬테카를로 샘플링)
 */
async function estimateRerollExpectedValue(gem, sampleSize = 5) {
  try {
    await loadGemProcessingFunctions();
    const samples = [];
    
    // 여러 번의 가상 리롤을 시뮬레이션
    for (let i = 0; i < sampleSize; i++) {
      const sampleOptions = sampleAutoOptionSet(gem); // 새로운 옵션 생성
      const sampleExpectedValue = await calculateOptionsExpectedValue(gem, sampleOptions);
      samples.push(sampleExpectedValue);
    }
    
    // 평균값 반환
    return samples.reduce((sum, val) => sum + val, 0) / samples.length;
  } catch (error) {
    console.error('리롤 기댓값 추정 실패:', error);
    return 0;
  }
}

/**
 * 리롤 기회비용 계산
 */
function calculateRerollOpportunityCost(gem) {
  const remainingAttempts = gem.remainingAttempts || 0;
  const remainingRerolls = gem.currentRerollAttempts || 0;
  
  if (remainingRerolls === 0 || remainingAttempts === 0) return 0;
  
  // 남은 기회가 적을수록 리롤 비용이 높아짐
  const scarcityMultiplier = Math.max(1, 10 - remainingAttempts);
  const baseCost = 0.1; // 기본 기회비용
  
  return baseCost * scarcityMultiplier;
}

/**
 * 적응형 임계값 계산
 */
function calculateAdaptiveThreshold(gem) {
  const remainingAttempts = gem.remainingAttempts || 0;
  const totalPoints = gem.totalPoints || 0;
  const currentRerolls = gem.currentRerollAttempts || 0;
  
  // 기본 임계값
  let threshold = 2.0;
  
  // 남은 횟수가 적을수록 임계값 낮춤 (더 보수적)
  threshold *= Math.max(0.5, remainingAttempts / 10);
  
  // 현재 포인트가 높을수록 임계값 높임 (더 까다로워짐)
  threshold *= Math.min(2.0, 1 + (totalPoints - 4) / 10);
  
  // 리롤 기회가 많을수록 임계값 높임 (더 적극적)
  threshold *= Math.min(1.5, 1 + currentRerolls / 5);
  
  return threshold;
}

/**
 * 옵션들의 위험도 계산
 */
async function calculateOptionsRisk(gem, options) {
  try {
    let totalRisk = 0;
    
    for (const option of options) {
      const nextGem = applyGemAction({ ...gem }, option.action);
      nextGem.remainingAttempts = Math.max(0, nextGem.remainingAttempts - 1);
      
      const probabilities = await getGemProbabilities(nextGem);
      if (probabilities) {
        const risk = calculateSingleOptionRisk(probabilities);
        totalRisk += risk * 0.25; // 25% 선택 확률
      }
    }
    
    return totalRisk;
  } catch (error) {
    console.error('위험도 계산 실패:', error);
    return 0.5; // 중간 위험도로 기본값
  }
}

/**
 * 단일 옵션의 위험도 계산
 */
function calculateSingleOptionRisk(probabilities) {
  // 높은 가치 목표들의 확률이 낮을수록 위험도 증가
  const highValueTargets = ['prob_ancient', 'prob_relic', 'prob_5_5'];
  let riskScore = 0;
  
  for (const target of highValueTargets) {
    const probability = probabilities[target] || 0;
    const weight = EVALUATION_METRICS.TARGET_WEIGHTS[target.replace('prob_', '')] || 1;
    
    // 낮은 확률일수록 높은 위험 (역수 관계)
    riskScore += weight * (1 - Math.min(1, probability * 10));
  }
  
  return Math.min(1, riskScore / 25); // 0-1 범위로 정규화
}

/**
 * 현재 Ancient+ 확률 계산
 */
async function getCurrentAncientProbability(gem, options) {
  try {
    let totalAncientProb = 0;
    
    for (const option of options) {
      const nextGem = applyGemAction({ ...gem }, option.action);
      nextGem.remainingAttempts = Math.max(0, nextGem.remainingAttempts - 1);
      
      const probabilities = await getGemProbabilities(nextGem);
      if (probabilities) {
        totalAncientProb += (probabilities.prob_ancient || 0) * 0.25;
      }
    }
    
    return totalAncientProb;
  } catch (error) {
    return 0;
  }
}

/**
 * 잠재적 개선 가능성 추정
 */
async function estimatePotentialImprovement(gem) {
  try {
    // 현재 젬 상태에서 바로 확률 조회
    const currentProbs = await getGemProbabilities(gem);
    if (!currentProbs) return 0;
    
    // 리롤을 통해 얻을 수 있는 최대 Ancient+ 확률 추정
    const potentialProbs = await getGemProbabilities({
      ...gem,
      willpower: Math.min(5, gem.willpower + 1), // 약간의 개선 가정
      corePoint: Math.min(5, gem.corePoint + 1)
    });
    
    if (!potentialProbs) return currentProbs.prob_ancient || 0;
    
    return potentialProbs.prob_ancient || 0;
  } catch (error) {
    return 0;
  }
}

/**
 * 전략적 시뮬레이션 실행
 * @param {Object} initialGem - 초기 젬 상태
 * @param {Object} strategy - 사용할 전략
 * @param {Object} options - 시뮬레이션 옵션
 * @returns {Object} 시뮬레이션 결과
 */
export async function runStrategicSimulation(initialGem, strategy, options = {}) {
  await loadGemProcessingFunctions();
  
  let gem = { ...initialGem };
  const history = [{ ...gem }];
  const decisions = []; // 의사결정 기록
  let totalRerollsUsed = 0;
  let isFirstProcessing = true;

  while (gem.remainingAttempts > 0) {
    try {
      // 현재 옵션 가져오기
      let currentOptions;
      if (isFirstProcessing && gem.currentOptions) {
        currentOptions = gem.currentOptions;
        isFirstProcessing = false;
      } else {
        currentOptions = sampleAutoOptionSet(gem);
      }

      if (currentOptions.length === 0) break;

      // 리롤 의사결정
      let rerollDecision = false;
      let rerollReason = '';
      
      if (gem.currentRerollAttempts > 0 && strategy.shouldReroll) {
        rerollDecision = await strategy.shouldReroll(gem, currentOptions);
        
        if (rerollDecision) {
          const rerollResult = rerollProcessingOptions(gem);
          if (rerollResult) {
            gem = rerollResult;
            currentOptions = gem.currentOptions;
            totalRerollsUsed++;
            rerollReason = `전략적 리롤 실행 (기댓값 개선 목적)`;
          }
        }
      }

      // 옵션 선택
      let selectedIndex = 0;
      let selectionReason = '기본 선택';
      
      if (strategy.selectBestOption) {
        selectedIndex = await strategy.selectBestOption(gem, currentOptions);
        selectionReason = '전략적 최적 선택';
      } else {
        // 기본: 랜덤 선택
        selectedIndex = Math.floor(Math.random() * currentOptions.length);
        selectionReason = '랜덤 선택';
      }

      const selectedAction = currentOptions[selectedIndex].action;

      // 의사결정 기록
      decisions.push({
        attempt: history.length,
        gemState: { ...gem },
        availableOptions: [...currentOptions],
        rerollDecision: rerollDecision,
        rerollReason: rerollReason,
        selectedIndex: selectedIndex,
        selectedAction: selectedAction,
        selectionReason: selectionReason
      });

      // 가공 실행
      gem = {
        ...applyGemAction(gem, selectedAction),
        remainingAttempts: Math.max(0, gem.remainingAttempts - 1),
        processingCount: (gem.processingCount || 0) + 1
      };

      history.push({ ...gem });

    } catch (error) {
      console.error('전략적 시뮬레이션 오류:', error);
      // 오류 발생시 랜덤 선택으로 fallback
      if (sampleAutoOptionSet) {
        const fallbackOptions = sampleAutoOptionSet(gem);
        if (fallbackOptions.length > 0) {
          const randomIndex = Math.floor(Math.random() * fallbackOptions.length);
          const selectedAction = fallbackOptions[randomIndex].action;
          
          gem = {
            ...applyGemAction(gem, selectedAction),
            remainingAttempts: Math.max(0, gem.remainingAttempts - 1),
            processingCount: (gem.processingCount || 0) + 1
          };
          
          history.push({ ...gem });
        } else {
          break;
        }
      } else {
        break;
      }
    }
  }

  return {
    finalGem: gem,
    history: history,
    decisions: decisions,
    totalProcessingSteps: history.length - 1,
    totalRerollsUsed: totalRerollsUsed,
    strategy: strategy.name || '알 수 없는 전략'
  };
}

/**
 * 전략 성과 비교
 * @param {Object} initialGem - 초기 젬 상태
 * @param {Array} strategies - 비교할 전략들
 * @param {number} runsPerStrategy - 전략당 실행 횟수
 * @returns {Object} 비교 결과
 */
export async function compareStrategies(initialGem, strategies, runsPerStrategy = 100) {
  const results = {};
  
  for (const [strategyName, strategy] of Object.entries(strategies)) {
    console.log(`전략 테스트 중: ${strategy.name}`);
    const strategyResults = [];
    
    for (let i = 0; i < runsPerStrategy; i++) {
      const result = await runStrategicSimulation(initialGem, strategy);
      strategyResults.push(result);
    }
    
    // 통계 계산
    const stats = calculateStrategyStatistics(strategyResults);
    results[strategyName] = {
      strategy: strategy,
      results: strategyResults,
      statistics: stats
    };
  }
  
  return results;
}

/**
 * 전략 통계 계산
 */
function calculateStrategyStatistics(results) {
  const stats = {
    totalRuns: results.length,
    averageFinalPoints: 0,
    averageRerollsUsed: 0,
    averageSteps: 0,
    ancientRate: 0,
    relicRate: 0,
    bestResult: null,
    worstResult: null
  };
  
  let totalPoints = 0;
  let totalRerolls = 0;
  let totalSteps = 0;
  let ancientCount = 0;
  let relicCount = 0;
  
  results.forEach(result => {
    const finalPoints = result.finalGem.totalPoints || 0;
    totalPoints += finalPoints;
    totalRerolls += result.totalRerollsUsed || 0;
    totalSteps += result.totalProcessingSteps || 0;
    
    if (finalPoints >= 19) ancientCount++;
    else if (finalPoints >= 16) relicCount++;
    
    if (!stats.bestResult || finalPoints > (stats.bestResult.finalGem.totalPoints || 0)) {
      stats.bestResult = result;
    }
    if (!stats.worstResult || finalPoints < (stats.worstResult.finalGem.totalPoints || 0)) {
      stats.worstResult = result;
    }
  });
  
  stats.averageFinalPoints = totalPoints / results.length;
  stats.averageRerollsUsed = totalRerolls / results.length;
  stats.averageSteps = totalSteps / results.length;
  stats.ancientRate = (ancientCount / results.length) * 100;
  stats.relicRate = (relicCount / results.length) * 100;
  
  return stats;
}

export default {
  ADVANCED_STRATEGIES,
  runStrategicSimulation,
  compareStrategies
};