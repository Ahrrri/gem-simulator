// 젬 가공 시뮬레이터 - 확률 기반 단순 전략

import { 
  createProcessingGem,
  executeGemProcessing,
  sampleAutoOptionSet,
  rerollProcessingOptions,
  calculateExactProbabilities
} from './gemProcessing.js';

// API 호출 카운터
let apiCallCount = 0;

export const getApiCallCount = () => apiCallCount;
export const resetApiCallCount = () => {
  apiCallCount = 0;
};

// 목표 정의 (실제 확률 표에 있는 목표들)
export const GOALS = {
  '5/5': '의지력 5, 코어포인트 5',
  '5/4': '의지력 5, 코어포인트 4',
  '4/5': '의지력 4, 코어포인트 5',
  '5/3': '의지력 5, 코어포인트 3',
  '4/4': '의지력 4, 코어포인트 4',
  '3/5': '의지력 3, 코어포인트 5',
  'sum8+': '의지력+코어포인트 8 이상',
  'sum9+': '의지력+코어포인트 9 이상',
  'relic+': '유물 (16포인트) 이상',
  'ancient+': '고대 (19포인트) 이상'
};

// 목표 달성 여부 확인
const checkGoalAchieved = (gem, goalKey) => {
  if (!gem) return false;
  
  const willpower = gem.willpower || 1;
  const corePoint = gem.corePoint || 1;
  const effect1Level = gem.effect1?.level || 1;
  const effect2Level = gem.effect2?.level || 1;
  const totalPoints = willpower + corePoint + effect1Level + effect2Level;
  
  switch (goalKey) {
    case '5/5':
      return willpower >= 5 && corePoint >= 5;
    case '5/4':
      return willpower >= 5 && corePoint >= 4;
    case '4/5':
      return willpower >= 4 && corePoint >= 5;
    case '5/3':
      return willpower >= 5 && corePoint >= 3;
    case '4/4':
      return willpower >= 4 && corePoint >= 4;
    case '3/5':
      return willpower >= 3 && corePoint >= 5;
    case 'sum8+':
      return (willpower + corePoint) >= 8;
    case 'sum9+':
      return (willpower + corePoint) >= 9;
    case 'relic+':
      return totalPoints >= 16;
    case 'ancient+':
      return totalPoints >= 19;
    default:
      return false;
  }
};

// 확률 계산 (기존 calculateExactProbabilities 사용)
const calculateProbability = async (gem, goalKey) => {
  try {
    apiCallCount++; // API 호출 카운트 증가
    const probResult = calculateExactProbabilities(gem);
    return (probResult?.current?.[goalKey] || 0) * 100; // 0~1을 0~100으로 변환
  } catch (error) {
    console.error('확률 계산 실패:', error);
    return 0;
  }
};

// 리롤 비용 계산 (리롤은 무료)
const getRerollCost = (gemGrade) => {
  return 0;
};

// 단순 확률 기반 전략
export const probabilityStrategy = {
  name: '확률 기반 전략',
  description: '리롤 확률이 현재보다 높으면 리롤',
  
  async shouldReroll(currentGem, newOptions, goalKey, currentCost, budget) {
    // 예산 초과 시 중단
    if (budget && currentCost >= budget) {
      return { reroll: false, reason: '예산 초과' };
    }
    
    // 목표 달성 시 중단
    if (checkGoalAchieved(currentGem, goalKey)) {
      return { reroll: false, reason: '목표 달성' };
    }
    
    // 현재 상태와 리롤 후 확률 비교  
    const currentProb = await calculateProbability(currentGem, goalKey);
    
    // 리롤 후 상태 시뮬레이션
    const rerolledGem = rerollProcessingOptions(currentGem);
    const newProb = rerolledGem ? await calculateProbability(rerolledGem, goalKey) : 0;
    
    // 리롤 확률이 더 높으면 리롤
    if (newProb > currentProb) {
      return { 
        reroll: true, 
        reason: `확률 개선: ${currentProb.toFixed(1)}% → ${newProb.toFixed(1)}%` 
      };
    }
    
    return { 
      reroll: false, 
      reason: `확률 개선 없음 (${currentProb.toFixed(1)}% → ${newProb.toFixed(1)}%)` 
    };
  }
};


// 단일 목표 시뮬레이션
export const runSimulation = async (gem, goalKey, options = {}) => {
  const {
    maxAttempts = 1000,
    budget = null,
    simulationRuns = 100
  } = options;
  
  // API 호출 카운터 초기화
  resetApiCallCount();
  const startApiCount = apiCallCount;
  
  const results = [];
  
  for (let run = 0; run < simulationRuns; run++) {
    let currentGem = JSON.parse(JSON.stringify(gem));
    let totalCost = 0;
    let attempts = 0;
    let goalAchieved = false;
    
    while (attempts < maxAttempts && (!budget || totalCost < budget) && currentGem.remainingAttempts > 0) {
      attempts++;
      
      // 현재 젬에 옵션이 없으면 생성
      if (!currentGem.autoOptionSet || currentGem.autoOptionSet.length === 0) {
        currentGem.autoOptionSet = sampleAutoOptionSet(currentGem);
      }
      
      // 전략에 따른 리롤 결정
      const decision = await probabilityStrategy.shouldReroll(
        currentGem, 
        null, // newOptions는 사용하지 않음
        goalKey, 
        totalCost, 
        budget
      );
      
      if (decision.reroll && currentGem.currentRerollAttempts > 0) {
        // 리롤 실행
        const rerolledGem = rerollProcessingOptions(currentGem);
        if (rerolledGem) {
          currentGem = rerolledGem;
          const rerollCost = getRerollCost(currentGem.grade || 7);
          totalCost += rerollCost;
          continue;
        }
      }
      
      // 가공 실행 (랜덤하게 옵션 선택)
      if (currentGem.autoOptionSet && currentGem.autoOptionSet.length > 0) {
        const randomIndex = Math.floor(Math.random() * currentGem.autoOptionSet.length);
        const selectedAction = currentGem.autoOptionSet[randomIndex].action;
        
        const processingCost = 900 * (1 + (currentGem.costModifier || 0) / 100);
        totalCost += processingCost;
        
        currentGem = executeGemProcessing(currentGem, selectedAction);
        
        // 목표 달성 확인
        if (checkGoalAchieved(currentGem, goalKey)) {
          goalAchieved = true;
          break;
        }
      } else {
        break; // 옵션이 없으면 중단
      }
    }
    
    results.push({
      run: run + 1,
      attempts,
      totalCost,
      goalAchieved
    });
  }
  
  // 통계 계산
  const successRuns = results.filter(r => r.goalAchieved);
  return {
    goalKey,
    goalName: GOALS[goalKey],
    successRate: (successRuns.length / simulationRuns) * 100,
    avgCost: results.reduce((sum, r) => sum + r.totalCost, 0) / results.length,
    avgAttempts: results.reduce((sum, r) => sum + r.attempts, 0) / results.length,
    avgSuccessCost: successRuns.length > 0 
      ? successRuns.reduce((sum, r) => sum + r.totalCost, 0) / successRuns.length
      : 0,
    minCost: Math.min(...results.map(r => r.totalCost)),
    maxCost: Math.max(...results.map(r => r.totalCost)),
    apiCalls: apiCallCount - startApiCount // API 호출 수 추가
  };
};

// 모든 목표에 대한 시뮬레이션
export const runAllGoalsSimulation = async (gem, options = {}) => {
  // 전체 시뮬레이션 시작 시 API 카운터 초기화
  resetApiCallCount();
  
  const results = [];
  
  for (const goalKey of Object.keys(GOALS)) {
    // 각 목표마다 같은 조건의 새 젬으로 시뮬레이션
    const newGem = createProcessingGem(gem.mainType, gem.subType, gem.grade);
    // 개별 시뮬레이션에서는 카운터를 초기화하지 않음
    const individualStartCount = apiCallCount;
    
    const result = await runSimulation(newGem, goalKey, options);
    result.apiCalls = apiCallCount - individualStartCount; // 개별 목표의 API 호출 수
    
    results.push(result);
  }
  
  // 전체 API 호출 수도 함께 반환
  return {
    results,
    totalApiCalls: apiCallCount
  };
};