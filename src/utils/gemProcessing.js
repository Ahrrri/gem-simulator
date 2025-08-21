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

// 가능한 가공 옵션 생성
function generateProcessingOptions(gem) {
  const availableOptions = {};
  
  for (const [action, config] of Object.entries(PROCESSING_POSSIBILITIES)) {
    if (checkCondition(config.condition, gem)) {
      availableOptions[action] = config.probability;
    }
  }
  
  // 확률 정규화 (제외된 옵션들로 인해 100%가 되지 않을 수 있음)
  const totalProbability = Object.values(availableOptions).reduce((sum, prob) => sum + prob, 0);
  
  if (totalProbability > 0) {
    for (const action in availableOptions) {
      availableOptions[action] = availableOptions[action] / totalProbability;
    }
  }
  
  return availableOptions;
}

// 가공 실행
function executeProcessing(gem, selectedOption) {
  const newGem = { ...gem };
  
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
        const currentEffect = newGem[property].name;
        const otherEffect = property === 'effect1' ? newGem.effect2.name : newGem.effect1.name;
        
        // 현재 효과와 다른 효과를 제외한 새로운 효과 선택
        const availableEffects = effectPool.filter(effect => 
          effect !== currentEffect && effect !== otherEffect
        );
        
        if (availableEffects.length > 0) {
          const randomEffect = availableEffects[Math.floor(Math.random() * availableEffects.length)];
          newGem[property].name = randomEffect;
        }
      } else if (operation.startsWith('+')) {
        const increase = parseInt(operation.substring(1));
        newGem[property].level = Math.min(5, newGem[property].level + increase);
      } else if (operation.startsWith('-')) {
        const decrease = parseInt(operation.substring(1));
        newGem[property].level = Math.max(1, newGem[property].level - decrease);
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
  newGem.totalPoints = newGem.willpower + newGem.corePoint + newGem.effect1.level + newGem.effect2.level;
  
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
  // 가공 가능한 옵션들 생성 (4개)
  const availableOptions = generateProcessingOptions(gem);
  const optionKeys = Object.keys(availableOptions);
  
  // 디버깅: 모든 옵션 상태 로그
  console.log('젬 상태:', gem);
  console.log('사용 가능한 옵션:', optionKeys.length, optionKeys);
  console.log('모든 옵션 상태:', getAllOptionsStatus(gem));
  
  // 4개 옵션 랜덤 선택
  const selectedOptions = [];
  const shuffled = [...optionKeys].sort(() => Math.random() - 0.5);
  
  for (let i = 0; i < Math.min(4, shuffled.length); i++) {
    selectedOptions.push({
      action: shuffled[i],
      description: getOptionDescription(shuffled[i]),
      probability: 0.25 // 4개 중 각각 25% 확률
    });
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
  
  const newGem = { ...gem };
  newGem.currentRerollAttempts -= 1;
  
  return {
    gem: newGem,
    options: processGem(newGem)
  };
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
// 가공 시뮬레이션 (가공 횟수를 모두 소모할 때까지)
export function simulateProcessing(initialGem) {
  let gem = { ...initialGem };
  const history = [{ ...gem }];
  
  while (gem.remainingAttempts > 0) {
    // 가공 옵션 생성
    const options = processGem(gem);
    
    if (options.length === 0) {
      break; // 옵션이 없으면 중단
    }
    
    // 랜덤하게 옵션 선택 (25% 확률)
    const randomIndex = Math.floor(Math.random() * options.length);
    const selectedAction = options[randomIndex].action;
    
    // 가공 실행
    gem = executeGemProcessing(gem, selectedAction);
    history.push({ ...gem });
  }
  
  return {
    finalGem: gem,
    history: history,
    totalProcessingSteps: history.length - 1
  };
}

// 대량 가공 시뮬레이션
export function bulkProcessingSimulation(mainType, subType, grade, simulationCount) {
  const results = [];
  
  for (let i = 0; i < simulationCount; i++) {
    const initialGem = createProcessingGem(mainType, subType, grade);
    const result = simulateProcessing(initialGem);
    results.push(result);
  }
  
  return results;
}

// 포인트에 따른 등급 결정
function determineGradeByPoints(totalPoints) {
  if (totalPoints >= 19) return 'ANCIENT';
  if (totalPoints >= 16) return 'RELIC';
  return 'LEGENDARY';
}

// 가공 시뮬레이션 통계 계산
export function calculateProcessingStatistics(results) {
  if (results.length === 0) return null;
  
  const stats = {
    totalRuns: results.length,
    averageTotalPoints: 0,
    averageProcessingSteps: 0,
    gradeDistribution: {
      LEGENDARY: 0,
      RELIC: 0,
      ANCIENT: 0
    },
    pointDistribution: {},
    willpowerDistribution: {},
    corePointDistribution: {},
    effect1Distribution: {},
    effect2Distribution: {},
    bestGems: [],
    worstGems: []
  };
  
  let totalPoints = 0;
  let totalSteps = 0;
  
  results.forEach(result => {
    const gem = result.finalGem;
    
    // 포인트 통계
    totalPoints += gem.totalPoints;
    stats.pointDistribution[gem.totalPoints] = (stats.pointDistribution[gem.totalPoints] || 0) + 1;
    
    // 등급 분포 (포인트 기준)
    const grade = determineGradeByPoints(gem.totalPoints);
    stats.gradeDistribution[grade]++;
    
    // 가공 단계 통계
    totalSteps += result.totalProcessingSteps;
    
    // 개별 능력치 분포
    stats.willpowerDistribution[gem.willpower] = (stats.willpowerDistribution[gem.willpower] || 0) + 1;
    stats.corePointDistribution[gem.corePoint] = (stats.corePointDistribution[gem.corePoint] || 0) + 1;
    stats.effect1Distribution[gem.effect1.level] = (stats.effect1Distribution[gem.effect1.level] || 0) + 1;
    stats.effect2Distribution[gem.effect2.level] = (stats.effect2Distribution[gem.effect2.level] || 0) + 1;
  });
  
  stats.averageTotalPoints = totalPoints / results.length;
  stats.averageProcessingSteps = totalSteps / results.length;
  
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
  const shuffled = [...effectPool].sort(() => Math.random() - 0.5);
  
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
  
  return {
    grade,
    mainType,
    subType,
    willpower: 1,
    corePoint: 1,
    effect1: {
      name: shuffled[0],
      level: 1
    },
    effect2: {
      name: shuffled[1],
      level: 1
    },
    totalPoints: 4,
    remainingAttempts: getProcessingAttempts(grade),
    maxRerollAttempts: getRerollAttempts(grade),
    currentRerollAttempts: getRerollAttempts(grade),
    processingCount: 0, // 가공 진행 횟수
    costIncrease: 0
  };
}