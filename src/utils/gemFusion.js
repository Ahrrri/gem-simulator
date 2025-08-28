// 젬 융합 관련 확률 테이블 및 로직
import { 
  GEM_EFFECTS,
  FUSION_GRADE_PROBABILITY,
  LEGENDARY_POINT_DISTRIBUTION,
  RELIC_POINT_DISTRIBUTION,
  ANCIENT_POINT_DISTRIBUTION
} from './gemConstants.js';

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
    },
    goldSpent: 500 // 융합 비용 고정
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
    totalGoldSpent: results.length * 500, // 융합당 500골드 고정
    averageGoldSpent: 500, // 융합당 평균 골드 (고정)
    gradeDistribution: {
      LEGENDARY: 0,
      RELIC: 0,
      ANCIENT: 0
    },
    gradeGoldAverage: {
      LEGENDARY: 500,  // 융합은 고정 비용
      RELIC: 500,
      ANCIENT: 500
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