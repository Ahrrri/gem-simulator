/**
 * 젬 가공 전략적 의사결정 엔진
 * 확률 테이블을 기반으로 한 고급 전략 시스템
 */

import { getGemProbabilities } from './apiClient.js';
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

/**
 * 가중 기댓값 계산
 */
function calculateWeightedExpectedValue(probabilities) {
  return Object.entries(EVALUATION_METRICS.TARGET_WEIGHTS).reduce((sum, [target, weight]) => {
    const prob = probabilities[target] || 0;
    return sum + (prob * weight);
  }, 0);
}

/**
 * 옵션들의 기댓값 계산
 */
async function calculateOptionsExpectedValue(gem, options) {
  const values = await Promise.all(
    options.map(async (option) => {
      const nextGem = applyGemAction({ ...gem }, option.action);
      nextGem.remainingAttempts = Math.max(0, nextGem.remainingAttempts - 1);
      
      const probabilities = await getGemProbabilities(nextGem);
      if (!probabilities) return 0;
      
      return calculateWeightedExpectedValue(probabilities);
    })
  );
  
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * 리롤 후 예상 기댓값 추정
 */
async function estimateRerollExpectedValue(gem, sampleSize = 5) {
  try {
    await loadGemProcessingFunctions();
    const samples = [];
    
    for (let i = 0; i < sampleSize; i++) {
      const sampleOptions = sampleAutoOptionSet(gem);
      const sampleExpectedValue = await calculateOptionsExpectedValue(gem, sampleOptions);
      samples.push(sampleExpectedValue);
    }
    
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
  
  const scarcityMultiplier = Math.max(1, 10 - remainingAttempts);
  const baseCost = 0.1;
  
  return baseCost * scarcityMultiplier;
}

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
  }
};

/**
 * 전략적 시뮬레이션 실행
 */
export async function runStrategicSimulation(initialGem, strategy) {
  let gem = { ...initialGem };
  const decisions = [];
  let totalSteps = 0;
  let totalRerollsUsed = 0;
  
  await loadGemProcessingFunctions();
  
  while (gem.remainingAttempts > 0) {
    totalSteps++;
    
    // 현재 옵션 생성
    const currentOptions = sampleAutoOptionSet(gem);
    
    // 리롤 결정
    const shouldReroll = await strategy.shouldReroll(gem, currentOptions);
    let finalOptions = currentOptions;
    let rerollDecision = false;
    
    if (shouldReroll && gem.currentRerollAttempts > 0) {
      finalOptions = rerollProcessingOptions(gem);
      rerollDecision = true;
      totalRerollsUsed++;
      gem.currentRerollAttempts--;
    }
    
    // 최적 옵션 선택
    const selectedIndex = await strategy.selectBestOption(gem, finalOptions);
    const selectedOption = finalOptions[selectedIndex];
    
    // 의사결정 기록
    decisions.push({
      attempt: totalSteps,
      gemState: { ...gem },
      availableOptions: [...finalOptions],
      selectedAction: selectedOption.description,
      rerollDecision: rerollDecision
    });
    
    // 젬 상태 업데이트
    gem = applyGemAction(gem, selectedOption.action);
    gem.remainingAttempts = Math.max(0, gem.remainingAttempts - 1);
  }
  
  return {
    finalGem: gem,
    totalProcessingSteps: totalSteps,
    totalRerollsUsed: totalRerollsUsed,
    decisions: decisions
  };
}

/**
 * 전략 비교
 */
export async function compareStrategies(initialGem, strategies, runsPerStrategy = 10) {
  const results = {};
  
  for (const [strategyKey, strategy] of Object.entries(strategies)) {
    const strategyResults = [];
    
    for (let i = 0; i < runsPerStrategy; i++) {
      const result = await runStrategicSimulation({ ...initialGem }, strategy);
      strategyResults.push(result);
    }
    
    // 통계 계산
    const statistics = calculateStrategyStatistics(strategyResults);
    
    results[strategyKey] = {
      strategy: strategy,
      results: strategyResults,
      statistics: statistics
    };
  }
  
  return results;
}

/**
 * 전략 통계 계산
 */
function calculateStrategyStatistics(results) {
  const totalRuns = results.length;
  const totalPoints = results.reduce((sum, r) => sum + r.finalGem.totalPoints, 0);
  const totalRerolls = results.reduce((sum, r) => sum + r.totalRerollsUsed, 0);
  const totalSteps = results.reduce((sum, r) => sum + r.totalProcessingSteps, 0);
  
  const ancientCount = results.filter(r => r.finalGem.totalPoints >= 19).length;
  const relicCount = results.filter(r => r.finalGem.totalPoints >= 16 && r.finalGem.totalPoints < 19).length;
  
  return {
    averageFinalPoints: totalPoints / totalRuns,
    averageRerollsUsed: totalRerolls / totalRuns,
    averageSteps: totalSteps / totalRuns,
    ancientRate: (ancientCount / totalRuns) * 100,
    relicRate: (relicCount / totalRuns) * 100
  };
}