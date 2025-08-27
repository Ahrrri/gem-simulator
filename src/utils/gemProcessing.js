// 젬 가공 관련 확률 테이블 및 로직

// 젬 가공 가능성 확률 테이블 (HTML에서 추출)
const PROCESSING_POSSIBILITIES = {
  // 의지력 효율 관련
  'willpower_+1': { probability: 0.1165, condition: 'willpower < 5' },
  'willpower_+2': { probability: 0.0440, condition: 'willpower < 4' },
  'willpower_+3': { probability: 0.0175, condition: 'willpower < 3' },
  'willpower_+4': { probability: 0.0045, condition: 'willpower < 2' },
  'willpower_-1': { probability: 0.0300, condition: 'willpower > 1' },
  
  // 질서/혼돈 포인트 관련
  'corePoint_+1': { probability: 0.1165, condition: 'corePoint < 5' },
  'corePoint_+2': { probability: 0.0440, condition: 'corePoint < 4' },
  'corePoint_+3': { probability: 0.0175, condition: 'corePoint < 3' },
  'corePoint_+4': { probability: 0.0045, condition: 'corePoint < 2' },
  'corePoint_-1': { probability: 0.0300, condition: 'corePoint > 1' },
  
  // 첫번째 효과 관련
  'effect1_+1': { probability: 0.1165, condition: 'effect1 < 5' },
  'effect1_+2': { probability: 0.0440, condition: 'effect1 < 4' },
  'effect1_+3': { probability: 0.0175, condition: 'effect1 < 3' },
  'effect1_+4': { probability: 0.0045, condition: 'effect1 < 2' },
  'effect1_-1': { probability: 0.0300, condition: 'effect1 > 1' },
  
  // 두번째 효과 관련
  'effect2_+1': { probability: 0.1165, condition: 'effect2 < 5' },
  'effect2_+2': { probability: 0.0440, condition: 'effect2 < 4' },
  'effect2_+3': { probability: 0.0175, condition: 'effect2 < 3' },
  'effect2_+4': { probability: 0.0045, condition: 'effect2 < 2' },
  'effect2_-1': { probability: 0.0300, condition: 'effect2 > 1' },
  
  // 효과 변경
  'effect1_change': { probability: 0.0325, condition: 'always' },
  'effect2_change': { probability: 0.0325, condition: 'always' },
  
  // 가공 비용 관련
  'cost_+100': { probability: 0.0175, condition: 'costIncrease < 100 && remainingAttempts > 1' },
  'cost_-100': { probability: 0.0175, condition: 'costIncrease > -100 && remainingAttempts > 1' },
  
  // 기타
  'maintain': { probability: 0.0175, condition: 'always' },
  'reroll_+1': { probability: 0.0250, condition: 'remainingAttempts > 1' },
  'reroll_+2': { probability: 0.0075, condition: 'remainingAttempts > 1' }
};

// 랜덤 선택 헬퍼 함수
function weightedRandom(weights) {
  const random = Math.random();
  let sum = 0;
  
  for (const [key, weight] of Object.entries(weights)) {
    sum += weight;
    if (random < sum) {
      return key;
    }
  }
  
  return Object.keys(weights)[0];
}

// 조건 확인 함수
function checkCondition(condition, gem) {
  if (condition === 'always') return true;
  
  // 각 조건을 개별적으로 처리
  switch (condition) {
    // 의지력 관련
    case 'willpower < 5': return gem.willpower < 5;
    case 'willpower < 4': return gem.willpower < 4;
    case 'willpower < 3': return gem.willpower < 3;
    case 'willpower < 2': return gem.willpower < 2;
    case 'willpower > 1': return gem.willpower > 1;
    
    // 코어포인트 관련
    case 'corePoint < 5': return gem.corePoint < 5;
    case 'corePoint < 4': return gem.corePoint < 4;
    case 'corePoint < 3': return gem.corePoint < 3;
    case 'corePoint < 2': return gem.corePoint < 2;
    case 'corePoint > 1': return gem.corePoint > 1;
    
    // 효과1 관련
    case 'effect1 < 5': return gem.effect1?.level < 5;
    case 'effect1 < 4': return gem.effect1?.level < 4;
    case 'effect1 < 3': return gem.effect1?.level < 3;
    case 'effect1 < 2': return gem.effect1?.level < 2;
    case 'effect1 > 1': return gem.effect1?.level > 1;
    
    // 효과2 관련
    case 'effect2 < 5': return gem.effect2?.level < 5;
    case 'effect2 < 4': return gem.effect2?.level < 4;
    case 'effect2 < 3': return gem.effect2?.level < 3;
    case 'effect2 < 2': return gem.effect2?.level < 2;
    case 'effect2 > 1': return gem.effect2?.level > 1;
    
    // 복합 조건들
    case 'costIncrease < 100 && remainingAttempts > 1': 
      return (gem.costIncrease || 0) < 100 && (gem.remainingAttempts || 0) > 1;
    case 'costIncrease > -100 && remainingAttempts > 1': 
      return (gem.costIncrease || 0) > -100 && (gem.remainingAttempts || 0) > 1;
    case 'remainingAttempts > 1': 
      return (gem.remainingAttempts || 0) > 1;
    
    default:
      console.warn('Unknown condition:', condition);
      return false;
  }
}

// Fisher-Yates 셔플 알고리즘 (완전한 랜덤 셔플)
function fisherYatesShuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// 가능한 가공 옵션 생성
function generateProcessingOptions(gem) {
  const availableOptions = [];
  
  // 모든 가능한 옵션을 배열로 수집
  for (const [action, config] of Object.entries(PROCESSING_POSSIBILITIES)) {
    if (checkCondition(config.condition, gem)) {
      availableOptions.push({
        action: action,
        probability: config.probability
      });
    }
  }
  
  return availableOptions;
}

// 가공 실행
function executeProcessing(gem, selectedOption) {
  // 안전성 검사
  if (!gem) {
    return gem;
  }
  
  const newGem = { 
    ...gem,
    effect1: gem.effect1 ? { ...gem.effect1 } : { name: '공격력', level: 1 },
    effect2: gem.effect2 ? { ...gem.effect2 } : { name: '추가 피해', level: 1 }
  };
  
  // effect1, effect2가 올바르게 설정되었는지 확인
  if (!newGem.effect1 || !newGem.effect2) {
    return gem; // 안전하게 원본 반환
  }
  
  const [property, operation] = selectedOption.split('_');
  
  switch (property) {
    case 'willpower':
      if (operation.startsWith('+')) {
        const increase = parseInt(operation.substring(1));
        newGem.willpower = Math.min(5, newGem.willpower + increase);
      } else if (operation.startsWith('-')) {
        const decrease = parseInt(operation.substring(1));
        newGem.willpower = Math.max(1, newGem.willpower - decrease);
      }
      break;
      
    case 'corePoint':
      if (operation.startsWith('+')) {
        const increase = parseInt(operation.substring(1));
        newGem.corePoint = Math.min(5, newGem.corePoint + increase);
      } else if (operation.startsWith('-')) {
        const decrease = parseInt(operation.substring(1));
        newGem.corePoint = Math.max(1, newGem.corePoint - decrease);
      }
      break;
      
    case 'effect1':
    case 'effect2':
      if (operation === 'change') {
        // 효과 변경 로직
        const GEM_EFFECTS = {
          ORDER: {
            STABLE: ['공격력', '추가 피해', '아군 피해 강화', '낙인력'],
            SOLID: ['공격력', '보스 피해', '아군 피해 강화', '아군 공격 강화'],
            IMMUTABLE: ['추가 피해', '보스 피해', '낙인력', '아군 공격 강화']
          },
          CHAOS: {
            EROSION: ['공격력', '추가 피해', '아군 피해 강화', '낙인력'],
            DISTORTION: ['공격력', '보스 피해', '아군 피해 강화', '아군 공격 강화'],
            COLLAPSE: ['추가 피해', '보스 피해', '낙인력', '아군 공격 강화']
          }
        };
        const effectPool = GEM_EFFECTS[newGem.mainType][newGem.subType];
        const currentEffect = newGem[property]?.name;
        const otherProperty = property === 'effect1' ? 'effect2' : 'effect1';
        const otherEffect = newGem[otherProperty]?.name;
        
        // 현재 효과와 다른 효과를 제외한 새로운 효과 선택
        const availableEffects = effectPool.filter(effect => 
          effect !== currentEffect && effect !== otherEffect
        );
        
        if (availableEffects.length > 0 && newGem[property]) {
          const randomEffect = availableEffects[Math.floor(Math.random() * availableEffects.length)];
          newGem[property].name = randomEffect;
        }
      } else if (operation.startsWith('+')) {
        const increase = parseInt(operation.substring(1));
        if (newGem[property]) {
          newGem[property].level = Math.min(5, (newGem[property].level || 1) + increase);
        }
      } else if (operation.startsWith('-')) {
        const decrease = parseInt(operation.substring(1));
        if (newGem[property]) {
          newGem[property].level = Math.max(1, (newGem[property].level || 1) - decrease);
        }
      }
      break;
      
    case 'cost':
      if (operation === '+100') {
        newGem.costIncrease = Math.min(100, (newGem.costIncrease || 0) + 100);
      } else if (operation === '-100') {
        newGem.costIncrease = Math.max(-100, (newGem.costIncrease || 0) - 100);
      }
      break;
      
    case 'reroll':
      if (operation.startsWith('+')) {
        const increase = parseInt(operation.substring(1));
        newGem.currentRerollAttempts = (newGem.currentRerollAttempts || 0) + increase;
        newGem.maxRerollAttempts = Math.max(newGem.maxRerollAttempts, newGem.currentRerollAttempts);
      }
      break;
      
    case 'maintain':
      // 상태 유지 - 변경사항 없음
      break;
  }
  
  // 가공 횟수 감소 및 진행 횟수 증가
  newGem.remainingAttempts = Math.max(0, (newGem.remainingAttempts || 10) - 1);
  newGem.processingCount = (newGem.processingCount || 0) + 1;
  
  // 총 포인트 재계산
  newGem.totalPoints = (newGem.willpower || 0) + (newGem.corePoint || 0) + 
                      (newGem.effect1?.level || 0) + (newGem.effect2?.level || 0);
  
  // 가공 후 새로운 옵션 생성 (남은 가공 횟수가 있을 때만)
  if (newGem.remainingAttempts > 0) {
    newGem.currentOptions = processGem(newGem);
  } else {
    newGem.currentOptions = [];
  }
  
  return newGem;
}

// 모든 옵션 상태 확인 (디버깅용)
export function getAllOptionsStatus(gem) {
  const allOptions = [];
  
  for (const [action, config] of Object.entries(PROCESSING_POSSIBILITIES)) {
    const isAvailable = checkCondition(config.condition, gem);
    allOptions.push({
      action,
      description: getOptionDescription(action),
      probability: config.probability,
      condition: config.condition,
      isAvailable,
      gemState: {
        willpower: gem.willpower,
        corePoint: gem.corePoint,
        effect1: gem.effect1?.level,
        effect2: gem.effect2?.level,
        costIncrease: gem.costIncrease || 0,
        remainingAttempts: gem.remainingAttempts || 0
      }
    });
  }
  
  return allOptions;
}

// 젬 가공 메인 함수
export function processGem(gem) {
  // 가공 가능한 옵션들 생성
  const availableOptions = generateProcessingOptions(gem);
  
  // 가중치 기반으로 4개 옵션 선택
  const selectedOptions = [];
  const numOptions = Math.min(4, availableOptions.length);
  
  // 복제본 생성 (원본 배열 보존)
  let remainingOptions = [...availableOptions];
  
  for (let i = 0; i < numOptions; i++) {
    // 가중치 기반 랜덤 선택 (누적 분포 방식)
    const totalWeight = remainingOptions.reduce((sum, opt) => sum + opt.probability, 0);
    const random = Math.random() * totalWeight;
    
    let cumulativeWeight = 0;
    let selectedIndex = remainingOptions.length - 1; // 기본값을 마지막으로 설정 (안전장치)
    
    for (let j = 0; j < remainingOptions.length; j++) {
      cumulativeWeight += remainingOptions[j].probability;
      if (random < cumulativeWeight) {
        selectedIndex = j;
        break;
      }
    }
    
    const selectedOption = remainingOptions[selectedIndex];
    selectedOptions.push({
      action: selectedOption.action,
      description: getOptionDescription(selectedOption.action),
      probability: selectedOption.probability // 원래 확률 (표시용)
    });
    
    // 선택된 옵션을 목록에서 제거 (중복 방지)
    remainingOptions.splice(selectedIndex, 1);
  }
  
  return selectedOptions;
}

// 가공 옵션 실행
export function executeGemProcessing(gem, selectedAction) {
  return executeProcessing(gem, selectedAction);
}

// 다른 항목 보기 (옵션 재생성)
export function rerollProcessingOptions(gem) {
  if (gem.currentRerollAttempts <= 0 || gem.processingCount === 0) {
    return null; // 재생성 불가
  }
  
  const newGem = { 
    ...gem,
    effect1: gem.effect1 ? { ...gem.effect1 } : { name: '공격력', level: 1 },
    effect2: gem.effect2 ? { ...gem.effect2 } : { name: '추가 피해', level: 1 },
    currentRerollAttempts: gem.currentRerollAttempts - 1
  };
  
  // 새로운 옵션을 젬에 포함
  newGem.currentOptions = processGem(newGem);
  
  return newGem;
}

// 옵션 설명 생성
function getOptionDescription(action) {
  const descriptions = {
    'willpower_+1': '의지력 효율 +1 증가',
    'willpower_+2': '의지력 효율 +2 증가',
    'willpower_+3': '의지력 효율 +3 증가',
    'willpower_+4': '의지력 효율 +4 증가',
    'willpower_-1': '의지력 효율 -1 감소',
    'corePoint_+1': '질서/혼돈 포인트 +1 증가',
    'corePoint_+2': '질서/혼돈 포인트 +2 증가',
    'corePoint_+3': '질서/혼돈 포인트 +3 증가',
    'corePoint_+4': '질서/혼돈 포인트 +4 증가',
    'corePoint_-1': '질서/혼돈 포인트 -1 감소',
    'effect1_+1': '첫번째 효과 Lv. +1 증가',
    'effect1_+2': '첫번째 효과 Lv. +2 증가',
    'effect1_+3': '첫번째 효과 Lv. +3 증가',
    'effect1_+4': '첫번째 효과 Lv. +4 증가',
    'effect1_-1': '첫번째 효과 Lv. -1 감소',
    'effect2_+1': '두번째 효과 Lv. +1 증가',
    'effect2_+2': '두번째 효과 Lv. +2 증가',
    'effect2_+3': '두번째 효과 Lv. +3 증가',
    'effect2_+4': '두번째 효과 Lv. +4 증가',
    'effect2_-1': '두번째 효과 Lv. -1 감소',
    'effect1_change': '첫번째 효과 변경',
    'effect2_change': '두번째 효과 변경',
    'cost_+100': '가공 비용 +100% 증가',
    'cost_-100': '가공 비용 -100% 감소',
    'maintain': '가공 상태 유지',
    'reroll_+1': '다른 항목 보기 +1회 증가',
    'reroll_+2': '다른 항목 보기 +2회 증가'
  };
  
  return descriptions[action] || action;
}

// 초기 젬 생성 (가공용)
// 옵션의 포인트 값 계산 (포인트 변화 옵션만)
function getOptionValue(action) {
  // 포인트에 영향을 주는 옵션만 고려
  const match = action.match(/(willpower|corePoint|effect1|effect2)_([+-]\d+)/);
  if (!match) return null; // 포인트 변화가 아닌 옵션은 null 반환
  
  const value = parseInt(match[2]);
  return value;
}

// 전략 정의
export const PROCESSING_STRATEGIES = {
  NO_REROLL: {
    name: '기본 전략 (다른 항목 보기 사용 안함)',
    description: '다른 항목 보기를 전혀 사용하지 않고 끝까지 진행',
    shouldReroll: () => false
  },
  THRESHOLD_REROLL: {
    name: '임계값 기반 전략',
    description: '옵션 평균 값이 임계값 이하일 때 다른 항목 보기 사용',
    params: { threshold: 0 },
    shouldReroll: (gem, options, params = { threshold: 0 }) => {
      if (gem.currentRerollAttempts <= 0 || gem.processingCount === 0) return false;
      
      // 모든 옵션을 고려한 기댓값 계산 (포인트 변화 없는 옵션은 0으로 계산)
      const optionValues = options.map(opt => getOptionValue(opt.action) || 0);
      
      if (optionValues.length === 0) return false;
      
      const average = optionValues.reduce((a, b) => a + b, 0) / optionValues.length;
      return average <= params.threshold;
    },
    wantsReroll: (gem, options, params = { threshold: 0 }) => {
      // 1회차에는 리롤 자체가 불가능
      if (gem.processingCount === 0) return false;
      
      // 모든 옵션을 고려한 기댓값 계산 (포인트 변화 없는 옵션은 0으로 계산)
      const optionValues = options.map(opt => getOptionValue(opt.action) || 0);
      
      if (optionValues.length === 0) return false;
      
      const average = optionValues.reduce((a, b) => a + b, 0) / optionValues.length;
      return average <= params.threshold;
    }
  }
};

// 가공 시뮬레이션 (가공 횟수를 모두 소모할 때까지)
export function simulateProcessing(initialGem, trackOptions = false, strategy = PROCESSING_STRATEGIES.NO_REROLL, strategyParams = {}) {
  let gem = { ...initialGem };
  const history = [{ ...gem }];
  const optionValuesByAttempt = []; // 각 차수별 옵션 값들
  let totalRerollsUsed = 0;
  let totalRerollsWanted = 0; // 리롤하고 싶었지만 못한 횟수
  let earlyTerminated = false; // 조기 종료 여부
  const optionAppearances = {}; // 옵션 등장 횟수 추적
  let totalGoldSpent = 0; // 총 소모 골드
  let isFirstProcessing = true; // 첫 번째 가공인지 확인
  
  while (gem.remainingAttempts > 0) {
    // 첫 번째 가공에서는 현재 옵션 사용, 그 이후에는 새로 생성
    let options;
    if (isFirstProcessing && gem.currentOptions && gem.currentOptions.length > 0) {
      options = gem.currentOptions;
      isFirstProcessing = false;
    } else {
      options = processGem(gem);
    }
    
    if (options.length === 0) {
      break; // 옵션이 없으면 중단
    }
    
    // 전략에 따라 다른 항목 보기 사용 여부 결정
    // 먼저 리롤을 원하는지 체크 (wantsReroll이 있으면 사용, 없으면 shouldReroll 사용)
    const wantsToReroll = strategy.wantsReroll ? 
      strategy.wantsReroll(gem, options, strategyParams) : 
      strategy.shouldReroll(gem, options, strategyParams);
    
    if (wantsToReroll && gem.currentRerollAttempts <= 0) {
      // 리롤하고 싶지만 횟수가 없는 경우
      totalRerollsWanted++;
    }
    
    let rerollUsedThisAttempt = false;
    if (strategy.shouldReroll(gem, options, strategyParams)) {
      const rerollResult = rerollProcessingOptions(gem);
      if (rerollResult) {
        gem = rerollResult;
        options = gem.currentOptions;
        totalRerollsUsed++;
        rerollUsedThisAttempt = true;
      }
    }
    
    // 옵션 값들 추적 (통계 분석용) - 리롤 후 최종 옵션으로 추적
    if (trackOptions) {
      const attemptNumber = history.length; // 현재 가공 차수
      // 모든 옵션을 고려한 기댓값 계산 (포인트 변화 없는 옵션은 0으로 계산)
      const optionValues = options.map(opt => getOptionValue(opt.action) || 0);
      
      // 각 옵션 등장 횟수 추적
      options.forEach(opt => {
        optionAppearances[opt.action] = (optionAppearances[opt.action] || 0) + 1;
      });
      
      optionValuesByAttempt.push({
        attempt: attemptNumber,
        values: optionValues,
        average: optionValues.length > 0 ? 
          optionValues.reduce((a, b) => a + b, 0) / optionValues.length : 0,
        rerollUsed: rerollUsedThisAttempt
      });
    }
    
    // 랜덤하게 옵션 선택 (25% 확률)
    const randomIndex = Math.floor(Math.random() * options.length);
    const selectedAction = options[randomIndex].action;
    
    // 가공 비용 계산 (가공 실행 전)
    const currentCost = 900 * (1 + (gem.costIncrease || 0) / 100);
    totalGoldSpent += currentCost;
    
    // 가공 실행
    gem = executeGemProcessing(gem, selectedAction);
    history.push({ ...gem });
    
    // 조기 종료 체크 (가공을 1회 이상 진행하고 총 포인트가 20)
    if (gem.processingCount >= 1 && gem.totalPoints === 20) {
      earlyTerminated = true;
      break;
    }
  }
  
  return {
    finalGem: gem,
    history: history,
    totalProcessingSteps: history.length - 1,
    optionValuesByAttempt: optionValuesByAttempt,
    totalRerollsUsed: totalRerollsUsed,
    totalRerollsWanted: totalRerollsWanted,
    remainingRerolls: gem.currentRerollAttempts || 0,
    earlyTerminated: earlyTerminated,
    optionAppearances: trackOptions ? optionAppearances : null,
    totalGoldSpent: totalGoldSpent
  };
}

// 대량 가공 시뮬레이션
export function bulkProcessingSimulation(mainType, subType, grade, simulationCount, trackOptions = false, strategy = PROCESSING_STRATEGIES.NO_REROLL, strategyParams = {}) {
  const results = [];
  
  for (let i = 0; i < simulationCount; i++) {
    const initialGem = createProcessingGem(mainType, subType, grade);
    const result = simulateProcessing(initialGem, trackOptions, strategy, strategyParams);
    results.push(result);
  }
  
  return results;
}

// 차수별 옵션 값 통계 계산
export function calculateAttemptWiseOptionStats(results) {
  if (results.length === 0 || !results[0].optionValuesByAttempt) return null;
  
  // 최대 가공 차수 찾기 (스택 오버플로우 방지)
  let maxAttempts = 0;
  for (const result of results) {
    if (result.optionValuesByAttempt && result.optionValuesByAttempt.length > maxAttempts) {
      maxAttempts = result.optionValuesByAttempt.length;
    }
  }
  
  const attemptStats = [];
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const averagesAtThisAttempt = [];
    let totalSamples = 0;
    let rerollCount = 0;
    
    results.forEach(result => {
      const attemptData = result.optionValuesByAttempt.find(a => a.attempt === attempt);
      if (attemptData && attemptData.average !== null) {
        averagesAtThisAttempt.push(attemptData.average);
        totalSamples++;
        if (attemptData.rerollUsed) {
          rerollCount++;
        }
      }
    });
    
    if (averagesAtThisAttempt.length > 0) {
      const avgOfAverages = averagesAtThisAttempt.reduce((a, b) => a + b, 0) / averagesAtThisAttempt.length;
      
      // 스택 오버플로우 방지
      let min = averagesAtThisAttempt[0];
      let max = averagesAtThisAttempt[0];
      for (const val of averagesAtThisAttempt) {
        if (val < min) min = val;
        if (val > max) max = val;
      }
      const rerollRate = (rerollCount / totalSamples) * 100;
      
      // 표준편차 계산
      const variance = averagesAtThisAttempt.reduce((sum, val) => {
        return sum + Math.pow(val - avgOfAverages, 2);
      }, 0) / averagesAtThisAttempt.length;
      const stdev = Math.sqrt(variance);
      
      attemptStats.push({
        attempt: attempt,
        avgOptionValue: avgOfAverages,
        stdev: stdev,
        minAvg: min,
        maxAvg: max,
        samples: totalSamples,
        rerollRate: rerollRate
      });
    }
  }
  
  return attemptStats;
}

// 포인트에 따른 등급 결정
function determineGradeByPoints(totalPoints) {
  if (totalPoints >= 19) return 'ANCIENT';
  if (totalPoints >= 16) return 'RELIC';
  return 'LEGENDARY';
}

// 특정 옵션이 사용 가능한지 확인
function isOptionAvailable(gem, action) {
  const config = PROCESSING_POSSIBILITIES[action];
  if (!config) return false;
  return checkCondition(config.condition, gem);
}

// 재귀적 확률 계산 (정확한 값) - 동기 버전으로 복원
export function calculateExactProbabilities(processingGem, memo = {}, progressCallback = null) {
  // 목표 조건 정의
  const targetConditions = {
    '5/5': (gem) => gem.willpower >= 5 && gem.corePoint >= 5,
    '5/4': (gem) => gem.willpower >= 5 && gem.corePoint >= 4,
    '4/5': (gem) => gem.willpower >= 4 && gem.corePoint >= 5,
    '5/3': (gem) => gem.willpower >= 5 && gem.corePoint >= 3,
    '4/4': (gem) => gem.willpower >= 4 && gem.corePoint >= 4,
    '3/5': (gem) => gem.willpower >= 3 && gem.corePoint >= 5,
    'sum8+': (gem) => (gem.willpower + gem.corePoint) >= 8,
    'sum9+': (gem) => (gem.willpower + gem.corePoint) >= 9,
    'relic+': (gem) => {
      const total = gem.willpower + gem.corePoint + gem.effect1.level + gem.effect2.level;
      return total >= 16;
    },
    'ancient+': (gem) => {
      const total = gem.willpower + gem.corePoint + gem.effect1.level + gem.effect2.level;
      return total >= 19;
    }
  };

  // 진행률 추적을 위한 변수들
  let totalStatesCalculated = 0;
  let cacheHits = 0;
  const startTime = Date.now();

  // 상태를 키로 변환
  const stateToKey = (gem) => {
    return `${gem.willpower},${gem.corePoint},${gem.effect1.level},${gem.effect2.level},${gem.remainingAttempts},${gem.currentRerollAttempts}`;
  };

  // 재귀 함수 (동기 버전)
  function calculateFromState(gem, fixedOptions = null) {
    const key = stateToKey(gem) + (fixedOptions ? ',fixed' : '');
    
    if (memo[key]) {
      cacheHits++;
      return memo[key];
    }
    
    totalStatesCalculated++;

    // 초기화
    const result = {};
    for (const target in targetConditions) {
      result[target] = 0;
    }

    // 기저 사례: 남은 시도 횟수가 0
    if (gem.remainingAttempts === 0) {
      for (const target in targetConditions) {
        result[target] = targetConditions[target](gem) ? 1.0 : 0.0;
      }
      memo[key] = result;
      return result;
    }

    // 이미 모든 목표를 달성한 경우 - 최적화를 위해 제거 (각 목표가 다른 조건)

    // 사용 가능한 옵션 가져오기
    let optionsToUse;
    if (fixedOptions) {
      // 이미 선택된 4개 옵션이 있는 경우 (고정된 옵션)
      optionsToUse = fixedOptions.filter(opt => isOptionAvailable(gem, opt.action));
      if (optionsToUse.length === 0) {
        for (const target in targetConditions) {
          result[target] = targetConditions[target](gem) ? 1.0 : 0.0;
        }
        memo[key] = result;
        return result;
      }
      
      // 4개 중 균등하게 선택 (각각 1/n 확률)
      const equalProb = 1.0 / optionsToUse.length;
      for (const option of optionsToUse) {
        const nextGem = executeGemProcessing({ ...gem }, option.action);
        const futureProbs = calculateFromState(nextGem, null);
        
        for (const target in targetConditions) {
          result[target] += equalProb * futureProbs[target];
        }
      }
    } else {
      // 새로운 4개 옵션을 뽑아야 하는 경우
      // 모든 가능한 옵션 가져오기
      const allAvailableOptions = generateProcessingOptions(gem);
      
      if (allAvailableOptions.length === 0) {
        for (const target in targetConditions) {
          result[target] = targetConditions[target](gem) ? 1.0 : 0.0;
        }
        memo[key] = result;
        return result;
      }
      
      // Es 함수와 유사한 방식: 가중치 기반 기댓값 계산
      // 각 옵션이 선택될 때의 확률을 가중치로 사용
      const totalProb = allAvailableOptions.reduce((sum, opt) => sum + opt.probability, 0);
      
      if (totalProb > 0) {
        for (const option of allAvailableOptions) {
          // 이 옵션의 가중치 비율
          const optionWeight = option.probability / totalProb;
          
          const nextGem = executeGemProcessing({ ...gem }, option.action);
          const futureProbs = calculateFromState(nextGem, null);
          
          for (const target in targetConditions) {
            result[target] += optionWeight * futureProbs[target];
          }
        }
      }
    }

    memo[key] = result;
    return result;
  }

  // 1. 현재 상태에서의 확률
  const currentProbabilities = calculateFromState(processingGem);

  // 2. 리롤 후 확률 (리롤 가능한 경우)
  let rerollProbabilities = null;
  if (processingGem.currentRerollAttempts > 0 && processingGem.remainingAttempts > 0) {
    const rerolledGem = { ...processingGem };
    rerolledGem.currentOptions = processGem(rerolledGem); // 4개만 선택
    rerolledGem.currentRerollAttempts -= 1;
    rerollProbabilities = calculateFromState(rerolledGem);
  }

  // 3. 현재 옵션만 사용했을 때의 확률
  let fixedOptionsProbabilities = null;
  if (processingGem.currentOptions && processingGem.currentOptions.length > 0) {
    fixedOptionsProbabilities = calculateFromState(processingGem, processingGem.currentOptions);
  }

  // 계산 완료 후 통계 로그
  const endTime = Date.now();
  const elapsedTime = endTime - startTime;
  
  if (progressCallback) {
    progressCallback(100, {
      totalStates: totalStatesCalculated,
      cacheHits: cacheHits,
      cacheHitRate: (cacheHits / (totalStatesCalculated + cacheHits) * 100).toFixed(1),
      elapsedTime: elapsedTime,
      completed: true
    });
  }

  return {
    current: currentProbabilities,
    afterReroll: rerollProbabilities,
    withCurrentOptions: fixedOptionsProbabilities,
    stats: {
      totalStates: totalStatesCalculated,
      cacheHits: cacheHits,
      elapsedTime: elapsedTime
    }
  };
}


// 가공 시뮬레이션 통계 계산
export function calculateProcessingStatistics(results) {
  if (results.length === 0) return null;
  
  const stats = {
    totalRuns: results.length,
    averageTotalPoints: 0,
    averageProcessingSteps: 0,
    averageRerollsUsed: 0,
    averageRerollsWanted: 0,
    averageRemainingRerolls: 0,
    averageGoldSpent: 0,
    minGoldSpent: Number.MAX_VALUE,
    maxGoldSpent: 0,
    earlyTerminationRate: 0,
    earlyTerminationCount: 0,
    gradeDistribution: {
      LEGENDARY: 0,
      RELIC: 0,
      ANCIENT: 0
    },
    gradeGoldAverage: {
      LEGENDARY: 0,
      RELIC: 0,
      ANCIENT: 0
    },
    gradeGoldTotal: {
      LEGENDARY: 0,
      RELIC: 0,
      ANCIENT: 0
    },
    pointDistribution: {},
    willpowerDistribution: {},
    corePointDistribution: {},
    effect1Distribution: {},
    effect2Distribution: {},
    rerollUsageDistribution: {},
    rerollsWantedDistribution: {},
    remainingRerollsDistribution: {},
    optionAppearanceFrequency: {}, // 옵션 등장 빈도
    bestGems: [],
    worstGems: []
  };
  
  let totalPoints = 0;
  let totalSteps = 0;
  let totalRerolls = 0;
  let totalRerollsWanted = 0;
  let totalRemainingRerolls = 0;
  let earlyTerminationCount = 0;
  let totalWillpower = 0;
  let totalCorePoint = 0;
  let totalEffect1Level = 0;
  let totalEffect2Level = 0;
  let totalGoldSpent = 0;
  
  results.forEach(result => {
    const gem = result.finalGem;
    
    // 포인트 통계
    totalPoints += gem.totalPoints;
    stats.pointDistribution[gem.totalPoints] = (stats.pointDistribution[gem.totalPoints] || 0) + 1;
    
    // 등급 분포 (포인트 기준)
    const grade = determineGradeByPoints(gem.totalPoints);
    stats.gradeDistribution[grade]++;
    
    // 골드 통계
    const goldSpent = result.totalGoldSpent || 0;
    totalGoldSpent += goldSpent;
    stats.minGoldSpent = Math.min(stats.minGoldSpent, goldSpent);
    stats.maxGoldSpent = Math.max(stats.maxGoldSpent, goldSpent);
    stats.gradeGoldTotal[grade] += goldSpent;
    
    // 가공 단계 통계
    totalSteps += result.totalProcessingSteps;
    
    // 리롤 사용 통계
    const rerollsUsed = result.totalRerollsUsed || 0;
    totalRerolls += rerollsUsed;
    stats.rerollUsageDistribution[rerollsUsed] = (stats.rerollUsageDistribution[rerollsUsed] || 0) + 1;
    
    // 리롤 원했지만 못한 통계
    const rerollsWanted = result.totalRerollsWanted || 0;
    totalRerollsWanted += rerollsWanted;
    stats.rerollsWantedDistribution[rerollsWanted] = (stats.rerollsWantedDistribution[rerollsWanted] || 0) + 1;
    
    // 남은 리롤 횟수 통계
    const remainingRerolls = result.remainingRerolls || 0;
    totalRemainingRerolls += remainingRerolls;
    stats.remainingRerollsDistribution[remainingRerolls] = (stats.remainingRerollsDistribution[remainingRerolls] || 0) + 1;
    
    // 조기 종료 통계
    if (result.earlyTerminated) {
      earlyTerminationCount++;
    }
    
    // 개별 능력치 분포
    stats.willpowerDistribution[gem.willpower || 1] = (stats.willpowerDistribution[gem.willpower || 1] || 0) + 1;
    stats.corePointDistribution[gem.corePoint || 1] = (stats.corePointDistribution[gem.corePoint || 1] || 0) + 1;
    
    // 의지력/코어포인트 총합 계산
    totalWillpower += gem.willpower || 1;
    totalCorePoint += gem.corePoint || 1;
    
    const effect1Level = gem.effect1?.level || 1;
    const effect2Level = gem.effect2?.level || 1;
    stats.effect1Distribution[effect1Level] = (stats.effect1Distribution[effect1Level] || 0) + 1;
    stats.effect2Distribution[effect2Level] = (stats.effect2Distribution[effect2Level] || 0) + 1;
    
    // 효과 레벨 총합 계산
    totalEffect1Level += effect1Level;
    totalEffect2Level += effect2Level;
    
    // 옵션 등장 빈도 집계
    if (result.optionAppearances) {
      for (const [option, count] of Object.entries(result.optionAppearances)) {
        stats.optionAppearanceFrequency[option] = (stats.optionAppearanceFrequency[option] || 0) + count;
      }
    }
  });
  
  stats.averageTotalPoints = totalPoints / results.length;
  stats.averageProcessingSteps = totalSteps / results.length;
  stats.averageRerollsUsed = totalRerolls / results.length;
  stats.averageRerollsWanted = totalRerollsWanted / results.length;
  stats.averageRemainingRerolls = totalRemainingRerolls / results.length;
  stats.averageWillpower = totalWillpower / results.length;
  stats.averageCorePoint = totalCorePoint / results.length;
  stats.averageEffect1Level = totalEffect1Level / results.length;
  stats.averageEffect2Level = totalEffect2Level / results.length;
  stats.averageGoldSpent = totalGoldSpent / results.length;
  stats.earlyTerminationCount = earlyTerminationCount;
  stats.earlyTerminationRate = (earlyTerminationCount / results.length) * 100;
  
  // 등급별 평균 골드 계산
  for (const grade of ['LEGENDARY', 'RELIC', 'ANCIENT']) {
    if (stats.gradeDistribution[grade] > 0) {
      stats.gradeGoldAverage[grade] = stats.gradeGoldTotal[grade] / stats.gradeDistribution[grade];
    }
  }
  
  // minGoldSpent가 초기값이면 0으로 설정
  if (stats.minGoldSpent === Number.MAX_VALUE) {
    stats.minGoldSpent = 0;
  }
  
  // 최고/최악 젬 찾기 (포인트 기준)
  const sortedByPoints = [...results].sort((a, b) => b.finalGem.totalPoints - a.finalGem.totalPoints);
  stats.bestGems = sortedByPoints.slice(0, 5).map(r => r.finalGem);
  stats.worstGems = sortedByPoints.slice(-5).map(r => r.finalGem);
  
  return stats;
}

export function createProcessingGem(mainType, subType, grade = 'UNCOMMON') {
  // 동기적으로 GEM_EFFECTS를 가져오기 위해 상수로 정의
  const GEM_EFFECTS = {
    ORDER: {
      STABLE: ['공격력', '추가 피해', '아군 피해 강화', '낙인력'],
      SOLID: ['공격력', '보스 피해', '아군 피해 강화', '아군 공격 강화'],
      IMMUTABLE: ['추가 피해', '보스 피해', '낙인력', '아군 공격 강화']
    },
    CHAOS: {
      EROSION: ['공격력', '추가 피해', '아군 피해 강화', '낙인력'],
      DISTORTION: ['공격력', '보스 피해', '아군 피해 강화', '아군 공격 강화'],
      COLLAPSE: ['추가 피해', '보스 피해', '낙인력', '아군 공격 강화']
    }
  };
  const effectPool = GEM_EFFECTS[mainType][subType];
  const shuffled = fisherYatesShuffle(effectPool);
  
  // 등급별 다른 항목 보기 횟수 설정
  const getRerollAttempts = (grade) => {
    switch (grade) {
      case 'UNCOMMON': return 0;  // 고급 젬 (0회)
      case 'RARE': return 1;      // 희귀 젬 (1회)
      case 'HEROIC': return 2;    // 영웅 젬 (2회)
      default: return 0;
    }
  };
  
  // 등급별 가공 횟수 설정
  const getProcessingAttempts = (grade) => {
    switch (grade) {
      case 'UNCOMMON': return 5;  // 고급 젬 (5회)
      case 'RARE': return 7;      // 희귀 젬 (7회)
      case 'HEROIC': return 9;    // 영웅 젬 (9회)
      default: return 5;
    }
  };
  
  // 안전하게 효과 선택
  const effect1Name = shuffled[0] || effectPool[0] || '공격력';
  const effect2Name = shuffled[1] || effectPool[1] || '추가 피해';

  const newGem = {
    grade,
    mainType,
    subType,
    willpower: 1,
    corePoint: 1,
    effect1: {
      name: effect1Name,
      level: 1
    },
    effect2: {
      name: effect2Name,
      level: 1
    },
    totalPoints: 4,
    remainingAttempts: getProcessingAttempts(grade),
    maxRerollAttempts: getRerollAttempts(grade),
    currentRerollAttempts: getRerollAttempts(grade),
    processingCount: 0, // 가공 진행 횟수
    costIncrease: 0
  };
  
  // 초기 옵션 생성하여 포함
  newGem.currentOptions = processGem(newGem);
  
  return newGem;
}