// 젬 융합 관련 확률 테이블 및 로직

// 젬 타입 정의
export const GEM_TYPES = {
  ORDER: {
    STABLE: '안정',
    SOLID: '견고',
    IMMUTABLE: '불변'
  },
  CHAOS: {
    EROSION: '침식',
    DISTORTION: '왜곡',
    COLLAPSE: '붕괴'
  }
};

// 젬 효과 정의
export const GEM_EFFECTS = {
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

// 젬 융합 시 등급별 확률 (확률 페이지 기반)
const FUSION_GRADE_PROBABILITY = {
  // 전설 3개
  LEGENDARY_3: {
    LEGENDARY: 0.99,
    RELIC: 0.01,
    ANCIENT: 0.00
  },
  // 전설 2개 + 유물 1개
  LEGENDARY_2_RELIC_1: {
    LEGENDARY: 0.73,
    RELIC: 0.25,
    ANCIENT: 0.02
  },
  // 전설 2개 + 고대 1개
  LEGENDARY_2_ANCIENT_1: {
    LEGENDARY: 0.35,
    RELIC: 0.40,
    ANCIENT: 0.25
  },
  // 전설 1개 + 유물 2개
  LEGENDARY_1_RELIC_2: {
    LEGENDARY: 0.46,
    RELIC: 0.50,
    ANCIENT: 0.04
  },
  // 전설 1개 + 유물 1개 + 고대 1개
  LEGENDARY_1_RELIC_1_ANCIENT_1: {
    LEGENDARY: 0.08,
    RELIC: 0.65,
    ANCIENT: 0.27
  },
  // 전설 1개 + 고대 2개
  LEGENDARY_1_ANCIENT_2: {
    LEGENDARY: 0.00,
    RELIC: 0.50,
    ANCIENT: 0.50
  },
  // 유물 3개
  RELIC_3: {
    LEGENDARY: 0.19,
    RELIC: 0.75,
    ANCIENT: 0.06
  },
  // 유물 2개 + 고대 1개
  RELIC_2_ANCIENT_1: {
    LEGENDARY: 0.00,
    RELIC: 0.71,
    ANCIENT: 0.29
  },
  // 유물 1개 + 고대 2개
  RELIC_1_ANCIENT_2: {
    LEGENDARY: 0.00,
    RELIC: 0.48,
    ANCIENT: 0.52
  },
  // 고대 3개
  ANCIENT_3: {
    LEGENDARY: 0.00,
    RELIC: 0.25,
    ANCIENT: 0.75
  }
};

// 결과 젬 포인트 분포 확률 (전설 등급)
const LEGENDARY_POINT_DISTRIBUTION = {
  4: 0.01,
  5: 0.02,
  6: 0.04,
  7: 0.07,
  8: 0.13,
  9: 0.19,
  10: 0.22,
  11: 0.15,
  12: 0.10,
  13: 0.04,
  14: 0.02,
  15: 0.01
};

// 유물 등급 포인트 분포
const RELIC_POINT_DISTRIBUTION = {
  16: 0.80,
  17: 0.15,
  18: 0.05
};

// 고대 등급 포인트 분포
const ANCIENT_POINT_DISTRIBUTION = {
  19: 0.95,
  20: 0.05
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
  
  // 기본값 (이론적으로 도달하지 않음)
  return Object.keys(weights)[0];
}

// 젬 타입 결정 (재료 젬 타입에 따라)
function determineGemType(materials) {
  // 각 타입의 개수 계산
  const typeCount = {};
  materials.forEach(gem => {
    const key = `${gem.mainType}_${gem.subType}`;
    typeCount[key] = (typeCount[key] || 0) + 1;
  });
  
  // 확률 계산
  const probabilities = {};
  for (const [type, count] of Object.entries(typeCount)) {
    probabilities[type] = count / 3;
  }
  
  // 랜덤 선택
  const selectedType = weightedRandom(probabilities);
  const [mainType, subType] = selectedType.split('_');
  
  return { mainType, subType };
}

// 포인트 분배 함수
function distributePoints(totalPoints) {
  const options = {
    willpower: 1,      // 의지력 효율
    corePoint: 1,      // 질서/혼돈 포인트
    effect1: 1,        // 첫번째 효과
    effect2: 1         // 두번째 효과
  };
  
  let remainingPoints = totalPoints - 4;
  
  // 남은 포인트를 랜덤하게 분배 (최대 5까지)
  while (remainingPoints > 0) {
    const optionKeys = Object.keys(options).filter(key => options[key] < 5);
    if (optionKeys.length === 0) break;
    
    const randomOption = optionKeys[Math.floor(Math.random() * optionKeys.length)];
    options[randomOption]++;
    remainingPoints--;
  }
  
  return options;
}

// 효과 선택 함수
function selectEffects(mainType, subType) {
  const effectPool = GEM_EFFECTS[mainType][subType];
  const shuffled = [...effectPool].sort(() => Math.random() - 0.5);
  
  return {
    effect1: shuffled[0],
    effect2: shuffled[1]
  };
}

// 재료 등급 조합 키 생성
function getMaterialKey(materials) {
  const counts = { LEGENDARY: 0, RELIC: 0, ANCIENT: 0 };
  materials.forEach(gem => counts[gem.grade]++);
  
  const parts = [];
  if (counts.LEGENDARY > 0) parts.push(`LEGENDARY_${counts.LEGENDARY}`);
  if (counts.RELIC > 0) parts.push(`RELIC_${counts.RELIC}`);
  if (counts.ANCIENT > 0) parts.push(`ANCIENT_${counts.ANCIENT}`);
  
  return parts.join('_');
}

// 메인 융합 함수
export function fuseGems(materials) {
  // 1. 재료 조합에 따른 확률 테이블 선택
  const materialKey = getMaterialKey(materials);
  const probabilities = FUSION_GRADE_PROBABILITY[materialKey] || FUSION_GRADE_PROBABILITY.LEGENDARY_3;
  
  // 2. 결과 등급 결정
  const gradeRoll = Math.random();
  let resultGrade;
  let totalPoints;
  
  if (gradeRoll < probabilities.LEGENDARY) {
    resultGrade = 'LEGENDARY';
    totalPoints = parseInt(weightedRandom(LEGENDARY_POINT_DISTRIBUTION));
  } else if (gradeRoll < probabilities.LEGENDARY + probabilities.RELIC) {
    resultGrade = 'RELIC';
    totalPoints = parseInt(weightedRandom(RELIC_POINT_DISTRIBUTION));
  } else {
    resultGrade = 'ANCIENT';
    totalPoints = parseInt(weightedRandom(ANCIENT_POINT_DISTRIBUTION));
  }
  
  // 2. 젬 타입 결정
  const { mainType, subType } = determineGemType(materials);
  
  // 3. 포인트 분배
  const pointDistribution = distributePoints(totalPoints);
  
  // 4. 효과 선택
  const effects = selectEffects(mainType, subType);
  
  // 5. 결과 젬 생성
  const resultGem = {
    grade: resultGrade,
    mainType: mainType,
    subType: subType,
    totalPoints: totalPoints,
    willpower: pointDistribution.willpower,
    corePoint: pointDistribution.corePoint,
    effect1: {
      name: effects.effect1,
      level: pointDistribution.effect1
    },
    effect2: {
      name: effects.effect2,
      level: pointDistribution.effect2
    }
  };
  
  return resultGem;
}

// 재료 조합에 따른 확률 정보 가져오기
export function getFusionProbabilities(materials) {
  const materialKey = getMaterialKey(materials);
  return FUSION_GRADE_PROBABILITY[materialKey] || FUSION_GRADE_PROBABILITY.LEGENDARY_3;
}

// 통계 계산 함수
export function calculateStatistics(results) {
  const stats = {
    totalRuns: results.length,
    gradeDistribution: {
      LEGENDARY: 0,
      RELIC: 0,
      ANCIENT: 0
    },
    perfectGems: 0,  // 의지력 효율 5, 코어 포인트 5
    averagePoints: 0,
    pointDistribution: {},
    willpowerCoreDistribution: {} // 의지력-코어포인트 조합 분포
  };
  
  let totalPoints = 0;
  
  results.forEach(gem => {
    // 등급 분포
    stats.gradeDistribution[gem.grade]++;
    
    // 퍼펙트 젬 체크
    if (gem.willpower === 5 && gem.corePoint === 5) {
      stats.perfectGems++;
    }
    
    // 포인트 통계
    totalPoints += gem.totalPoints;
    stats.pointDistribution[gem.totalPoints] = (stats.pointDistribution[gem.totalPoints] || 0) + 1;
    
    // 의지력-코어포인트 조합 통계
    const combo = `${gem.willpower}/${gem.corePoint}`;
    stats.willpowerCoreDistribution[combo] = (stats.willpowerCoreDistribution[combo] || 0) + 1;
  });
  
  stats.averagePoints = totalPoints / results.length;
  
  return stats;
}