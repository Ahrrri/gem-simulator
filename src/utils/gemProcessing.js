// 젬 가공 관련 확률 테이블 및 로직
import {
  PROCESSING_POSSIBILITIES,
  PROCESSING_ACTION_DESCRIPTIONS,
  GEM_EFFECTS,
  getRerollAttempts,
  getProcessingAttempts
} from './gemConstants.js';

// ============================================================================
// 1. 젬 생성 관련
// ============================================================================

// 젬 타입과 서브타입으로부터 효과 목록 가져오기
export function getEffectsForGem(mainType, subType) {
  return GEM_EFFECTS[mainType]?.[subType] || [];
}

// 초기 젬 생성 (가공용)
export function createProcessingGem(mainType, subType, grade = 'UNCOMMON', combination = null) {
  
  // 기본 조합들 (참고용)
  const defaultCombinations = [
    [1, 1, 0, 0], // dealerA + dealerB
    [1, 0, 1, 0], // dealerA + supportA
    [1, 0, 0, 1], // dealerA + supportB
    [0, 1, 1, 0], // dealerB + supportA
    [0, 1, 0, 1], // dealerB + supportB
    [0, 0, 1, 1]  // supportA + supportB
  ];
  
  // combination 처리: 배열, 객체, 또는 null
  let dealerA, dealerB, supportA, supportB;
  
  if (combination) {
    if (Array.isArray(combination) && combination.length === 4) {
      // 배열 형태: [dealerA, dealerB, supportA, supportB]
      [dealerA, dealerB, supportA, supportB] = combination;
    } else if (typeof combination === 'object') {
      // 객체 형태: { dealerA: 1, dealerB: 0, supportA: 1, supportB: 0 }
      dealerA = combination.dealerA || 0;
      dealerB = combination.dealerB || 0;
      supportA = combination.supportA || 0;
      supportB = combination.supportB || 0;
    } else {
      // 잘못된 형태면 랜덤 선택
      const randomCombination = defaultCombinations[Math.floor(Math.random() * defaultCombinations.length)];
      [dealerA, dealerB, supportA, supportB] = randomCombination;
    }
  } else {
    // combination이 null이면 랜덤 선택
    const randomCombination = defaultCombinations[Math.floor(Math.random() * defaultCombinations.length)];
    [dealerA, dealerB, supportA, supportB] = randomCombination;
  }

  const newGem = {
    grade,
    mainType,
    subType,
    willpower: 1,
    corePoint: 1,
    // 4개 옵션 시스템: 랜덤으로 선택된 2개 옵션이 1, 나머지는 0
    dealerA,
    dealerB, 
    supportA,
    supportB,
    totalPoints: 4, // 의지력 + 코어포인트 + 활성화된 2개 옵션
    remainingAttempts: getProcessingAttempts(grade),
    maxRerollAttempts: getRerollAttempts(grade),
    currentRerollAttempts: getRerollAttempts(grade),
    processingCount: 0, // 가공 진행 횟수
    isFirstProcessing: 1, // 첫 가공인지
    costModifier: 0, // costIncrease -> costModifier로 변경
    totalGoldSpent: 0, // 누적 가공 비용
    // Linked List 히스토리
    previousState: null, // 이전 젬 상태 (linked list의 이전 노드)
    processedWith: null // 이 상태로 만든 가공 옵션 정보 { action, description, cost }
  };
  
  // 초기 옵션 생성하여 포함 (자동 모드용)
  newGem.autoOptionSet = sampleAutoOptionSet(newGem);
  
  return newGem;
}

// ============================================================================
// 2. 옵션 관련
// ============================================================================

// 사용 가능한 옵션들 가져오기
export function getAvailableProcessingOptions(gem) {
  const options = [];
  
  for (const [action, config] of Object.entries(PROCESSING_POSSIBILITIES)) {
    if (checkCondition(config.condition, gem)) {
      options.push({
        action: action,
        probability: config.probability,
        description: getActionDescription(action)
      });
    }
  }
  
  return options;
}

// 자동 옵션 샘플링 함수
export function sampleAutoOptionSet(gem) {
  // 가공 가능한 옵션들 생성
  const availableOptions = getAvailableProcessingOptions(gem);
  
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
      description: getActionDescription(selectedOption.action),
      probability: selectedOption.probability // 원래 확률 (표시용)
    });
    
    // 선택된 옵션을 목록에서 제거 (중복 방지)
    remainingOptions.splice(selectedIndex, 1);
  }
  
  return selectedOptions;
}

// ============================================================================
// 3. 가공 및 리롤 로직
// ============================================================================

// 다른 항목 보기 (옵션 재생성)
export function rerollProcessingOptions(gem) {
  if (gem.currentRerollAttempts <= 0 || gem.processingCount === 0) {
    return null; // 재생성 불가
  }
  
  const newGem = { 
    ...gem,
    currentRerollAttempts: gem.currentRerollAttempts - 1
  };
  
  // 새로운 옵션을 젬에 포함 (자동 모드용)
  newGem.autoOptionSet = sampleAutoOptionSet(newGem);
  // 수동 옵션 세트는 초기화 (리롤 후에는 수동 선택 리셋)
  newGem.manualOptionSet = null;
  
  return newGem;
}

// 가공 실행 (게임 로직용 - 추가 처리 포함)
export function executeGemProcessing(gem, selectedOption, targetOption = null) {
  // 안전성 검사
  if (!gem) {
    return gem;
  }
  
  // 가공 비용 계산 및 누적 (액션 적용 전 현재 상태 기준)
  const processingCost = 900 * (1 + (gem.costModifier || 0) / 100);
  
  // 공통 액션 적용 함수 사용 (횟수 감소/증가 포함)
  const newGem = applyGemAction(gem, selectedOption, targetOption);
  
  // 비용 누적
  newGem.totalGoldSpent = (gem.totalGoldSpent || 0) + processingCost;
  
  // 히스토리 링크 연결 (현재 젬의 이전 상태를 이전 젬으로 설정)
  newGem.previousState = gem;
  newGem.processedWith = {
    action: selectedOption,
    description: getActionDescription ? getActionDescription(selectedOption) : selectedOption,
    cost: processingCost,
  };
  
  // 총 포인트 재계산 (공통 유틸리티 사용)
  newGem.totalPoints = calculateTotalPoints(newGem);
  
  // 가공 후 새로운 옵션 생성 (남은 가공 횟수가 있을 때만)
  if (newGem.remainingAttempts > 0) {
    newGem.autoOptionSet = sampleAutoOptionSet(newGem);
    // 가공 후에는 수동 선택 초기화
    newGem.manualOptionSet = null;
  } else {
    newGem.autoOptionSet = [];
    newGem.manualOptionSet = null;
  }
  
  return newGem;
}

// ============================================================================
// 5. 공통 유틸리티 함수들
// ============================================================================

// 공통 액션 적용 함수 (게임 로직과 확률 계산 모두에서 사용)
export function applyGemAction(gem, action, targetOption = null) {
  const newGem = { ...gem };
  const [property, operation] = action.split('_');
  
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
      
    case 'dealerA':
    case 'dealerB':
    case 'supportA':
    case 'supportB':
      if (operation === 'change') {
        // 새로운 changeGemOption 함수 사용
        const changedGem = changeGemOption(newGem, property, targetOption);
        if (changedGem) {
          // 변경된 젬을 newGem에 적용하고 아래 공통 처리를 받도록 함
          Object.assign(newGem, changedGem);
        }
      } else if (operation.startsWith('+')) {
        const increase = parseInt(operation.substring(1));
        newGem[property] = Math.min(5, (newGem[property] || 0) + increase);
      } else if (operation.startsWith('-')) {
        const decrease = parseInt(operation.substring(1));
        newGem[property] = Math.max(0, (newGem[property] || 0) - decrease);
      }
      break;
      
    case 'cost':
      if (operation === '+100') {
        newGem.costModifier = Math.min(100, (newGem.costModifier || 0) + 100);
      } else if (operation === '-100') {
        newGem.costModifier = Math.max(-100, (newGem.costModifier || 0) - 100);
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
  
  // 가공 시 공통 처리: 횟수 감소 및 진행 횟수 증가
  newGem.remainingAttempts = Math.max(0, (newGem.remainingAttempts || 10) - 1);
  newGem.processingCount = (newGem.processingCount || 0) + 1;
  newGem.isFirstProcessing = 0;
  
  return newGem;
}

// 옵션 변경 처리 (targetOption이 없으면 랜덤 선택)
export function changeGemOption(gem, fromOption, targetOption = null) {
  const currentOptions = ['dealerA', 'dealerB', 'supportA', 'supportB'];
  const inactiveOptions = currentOptions.filter(opt => (gem[opt] || 0) === 0);
  
  if (inactiveOptions.length === 0) {
    return null; // 변경할 수 있는 옵션이 없음
  }
  
  let selectedOption;
  if (targetOption && inactiveOptions.includes(targetOption)) {
    // 지정된 옵션으로 변경 (수동 가공용)
    selectedOption = targetOption;
  } else {
    // 랜덤 선택 (자동 가공용)
    selectedOption = inactiveOptions[Math.floor(Math.random() * inactiveOptions.length)];
  }
  
  // 현재 레벨을 새 옵션으로 이동
  const currentLevel = gem[fromOption] || 0;
  const newGem = { ...gem };
  newGem[fromOption] = 0;
  newGem[selectedOption] = currentLevel;
  
  return newGem;
}

// 총 포인트 계산 (4개 옵션 시스템)
export function calculateTotalPoints(gem) {
  return (gem.willpower || 0) + (gem.corePoint || 0) + 
         (gem.dealerA || 0) + (gem.dealerB || 0) + 
         (gem.supportA || 0) + (gem.supportB || 0);
}

// 옵션 설명 가져오기 함수
export function getActionDescription(action) {
  return PROCESSING_ACTION_DESCRIPTIONS[action] || action;
}

// ============================================================================
// 6. 디버깅 및 분석 관련
// ============================================================================

// 모든 옵션 상태 확인 (디버깅용)
export function getAllOptionsStatus(gem) {
  const allOptions = [];
  
  for (const [action, config] of Object.entries(PROCESSING_POSSIBILITIES)) {
    const isAvailable = checkCondition(config.condition, gem);
    allOptions.push({
      action,
      description: getActionDescription(action),
      probability: config.probability,
      condition: config.condition,
      isAvailable,
      gemState: {
        willpower: gem.willpower,
        corePoint: gem.corePoint,
        dealerA: gem.dealerA || 0,
        dealerB: gem.dealerB || 0,
        supportA: gem.supportA || 0,
        supportB: gem.supportB || 0,
        costModifier: gem.costModifier || 0,
        remainingAttempts: gem.remainingAttempts || 0
      }
    });
  }
  
  return allOptions;
}

// 젬의 가공 히스토리 순회를 위한 유틸리티 함수들
export function getProcessingHistory(gem) {
  const history = [];
  let current = gem;
  
  while (current) {
    history.unshift({
      gem: { ...current, previousState: null, processedWith: null }, // 순환 참조 방지
      processedWith: current.processedWith,
      timestamp: current.processedWith?.timestamp || null
    });
    current = current.previousState;
  }
  
  return history;
}

export function getProcessingSteps(gem) {
  const steps = [];
  let current = gem;
  
  while (current && current.processedWith) {
    steps.unshift(current.processedWith);
    current = current.previousState;
  }
  
  return steps;
}

// ============================================================================
// 7. 내부 헬퍼 함수들
// ============================================================================

// 조건 확인 함수
function checkCondition(condition, gem) {
  // PROCESSING_POSSIBILITIES의 condition 함수 직접 실행
  if (typeof condition === 'function') {
    return condition(gem);
  }
  
  console.warn('Unknown condition type:', condition);
  return false;
}