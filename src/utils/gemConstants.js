// 젬 관련 공통 상수 및 정의

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

// 젬 효과 정의 (4개 옵션: 딜러A, 딜러B, 서폿A, 서폿B)
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

// 효과 인덱스 매핑 (0: 딜러A, 1: 딜러B, 2: 서폿A, 3: 서폿B)
export const EFFECT_INDEX_NAMES = {
  0: 'dealerA',
  1: 'dealerB', 
  2: 'supportA',
  3: 'supportB'
};

export const EFFECT_NAME_INDEXES = {
  'dealerA': 0,
  'dealerB': 1,
  'supportA': 2,
  'supportB': 3
};

// 젬 등급 정의
export const GEM_GRADES = {
  UNCOMMON: '고급',
  RARE: '희귀',
  HEROIC: '영웅',
  LEGENDARY: '전설',
  RELIC: '유물',
  ANCIENT: '고대'
};

// 젬 등급별 색상
export const GEM_GRADE_COLORS = {
  UNCOMMON: '#4CAF50',
  RARE: '#2196F3',
  HEROIC: '#9C27B0',
  LEGENDARY: '#FF9800',
  RELIC: '#F44336',
  ANCIENT: '#C0C0C0'
};


// 가공 가능성 확률 테이블 (4개 옵션 지원)
export const PROCESSING_POSSIBILITIES = {
  'willpower_+1': { probability: 0.1165, condition: (gem) => gem.willpower < 5 },
  'willpower_+2': { probability: 0.0440, condition: (gem) => gem.willpower < 4 },
  'willpower_+3': { probability: 0.0175, condition: (gem) => gem.willpower < 3 },
  'willpower_+4': { probability: 0.0045, condition: (gem) => gem.willpower < 2 },
  'willpower_-1': { probability: 0.0300, condition: (gem) => gem.willpower > 1 },
  
  'corePoint_+1': { probability: 0.1165, condition: (gem) => gem.corePoint < 5 },
  'corePoint_+2': { probability: 0.0440, condition: (gem) => gem.corePoint < 4 },
  'corePoint_+3': { probability: 0.0175, condition: (gem) => gem.corePoint < 3 },
  'corePoint_+4': { probability: 0.0045, condition: (gem) => gem.corePoint < 2 },
  'corePoint_-1': { probability: 0.0300, condition: (gem) => gem.corePoint > 1 },
  
  // 4개 옵션 각각에 대한 레벨 조정
  'dealerA_+1': { probability: 0.1165, condition: (gem) => (gem.dealerA || 0) < 5 && (gem.dealerA || 0) > 0 },
  'dealerA_+2': { probability: 0.0440, condition: (gem) => (gem.dealerA || 0) < 4 && (gem.dealerA || 0) > 0 },
  'dealerA_+3': { probability: 0.0175, condition: (gem) => (gem.dealerA || 0) < 3 && (gem.dealerA || 0) > 0 },
  'dealerA_+4': { probability: 0.0045, condition: (gem) => (gem.dealerA || 0) < 2 && (gem.dealerA || 0) > 0 },
  'dealerA_-1': { probability: 0.0300, condition: (gem) => (gem.dealerA || 0) > 1 },
  
  'dealerB_+1': { probability: 0.1165, condition: (gem) => (gem.dealerB || 0) < 5 && (gem.dealerB || 0) > 0 },
  'dealerB_+2': { probability: 0.0440, condition: (gem) => (gem.dealerB || 0) < 4 && (gem.dealerB || 0) > 0 },
  'dealerB_+3': { probability: 0.0175, condition: (gem) => (gem.dealerB || 0) < 3 && (gem.dealerB || 0) > 0 },
  'dealerB_+4': { probability: 0.0045, condition: (gem) => (gem.dealerB || 0) < 2 && (gem.dealerB || 0) > 0 },
  'dealerB_-1': { probability: 0.0300, condition: (gem) => (gem.dealerB || 0) > 1 },
  
  'supportA_+1': { probability: 0.1165, condition: (gem) => (gem.supportA || 0) < 5 && (gem.supportA || 0) > 0 },
  'supportA_+2': { probability: 0.0440, condition: (gem) => (gem.supportA || 0) < 4 && (gem.supportA || 0) > 0 },
  'supportA_+3': { probability: 0.0175, condition: (gem) => (gem.supportA || 0) < 3 && (gem.supportA || 0) > 0 },
  'supportA_+4': { probability: 0.0045, condition: (gem) => (gem.supportA || 0) < 2 && (gem.supportA || 0) > 0 },
  'supportA_-1': { probability: 0.0300, condition: (gem) => (gem.supportA || 0) > 1 },
  
  'supportB_+1': { probability: 0.1165, condition: (gem) => (gem.supportB || 0) < 5 && (gem.supportB || 0) > 0 },
  'supportB_+2': { probability: 0.0440, condition: (gem) => (gem.supportB || 0) < 4 && (gem.supportB || 0) > 0 },
  'supportB_+3': { probability: 0.0175, condition: (gem) => (gem.supportB || 0) < 3 && (gem.supportB || 0) > 0 },
  'supportB_+4': { probability: 0.0045, condition: (gem) => (gem.supportB || 0) < 2 && (gem.supportB || 0) > 0 },
  'supportB_-1': { probability: 0.0300, condition: (gem) => (gem.supportB || 0) > 1 },
  
  // 옵션 변경 (0이 아닌 옵션을 다른 옵션으로 변경)
  'dealerA_change': { probability: 0.0325, condition: (gem) => (gem.dealerA || 0) > 0 },
  'dealerB_change': { probability: 0.0325, condition: (gem) => (gem.dealerB || 0) > 0 },
  'supportA_change': { probability: 0.0325, condition: (gem) => (gem.supportA || 0) > 0 },
  'supportB_change': { probability: 0.0325, condition: (gem) => (gem.supportB || 0) > 0 },
  
  'cost_+100': { probability: 0.0175, condition: (gem) => (gem.costModifier || 0) < 100 && gem.remainingAttempts > 1 },
  'cost_-100': { probability: 0.0175, condition: (gem) => (gem.costModifier || 0) > -100 && gem.remainingAttempts > 1 },
  
  // 기타
  'maintain': { probability: 0.0175, condition: () => true }, // 변동 없음
  'reroll_+1': { probability: 0.0250, condition: (gem) => gem.remainingAttempts > 1 }, // 리롤 횟수 1회 증가
  'reroll_+2': { probability: 0.0075, condition: (gem) => gem.remainingAttempts > 1 }  // 리롤 횟수 2회 증가
};

// 젬 융합 시 등급별 확률 (확률 페이지 기반)
export const FUSION_GRADE_PROBABILITY = {
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
export const LEGENDARY_POINT_DISTRIBUTION = {
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
export const RELIC_POINT_DISTRIBUTION = {
  16: 0.80,
  17: 0.15,
  18: 0.05
};

// 고대 등급 포인트 분포
export const ANCIENT_POINT_DISTRIBUTION = {
  19: 0.95,
  20: 0.05
};


// 가공 옵션 설명 (통합됨)
export const PROCESSING_ACTION_DESCRIPTIONS = {
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
  'dealerA_+1': '딜러A 옵션 Lv. +1 증가',
  'dealerA_+2': '딜러A 옵션 Lv. +2 증가',
  'dealerA_+3': '딜러A 옵션 Lv. +3 증가',
  'dealerA_+4': '딜러A 옵션 Lv. +4 증가',
  'dealerA_-1': '딜러A 옵션 Lv. -1 감소',
  'dealerB_+1': '딜러B 옵션 Lv. +1 증가',
  'dealerB_+2': '딜러B 옵션 Lv. +2 증가',
  'dealerB_+3': '딜러B 옵션 Lv. +3 증가',
  'dealerB_+4': '딜러B 옵션 Lv. +4 증가',
  'dealerB_-1': '딜러B 옵션 Lv. -1 감소',
  'supportA_+1': '서폿A 옵션 Lv. +1 증가',
  'supportA_+2': '서폿A 옵션 Lv. +2 증가',
  'supportA_+3': '서폿A 옵션 Lv. +3 증가',
  'supportA_+4': '서폿A 옵션 Lv. +4 증가',
  'supportA_-1': '서폿A 옵션 Lv. -1 감소',
  'supportB_+1': '서폿B 옵션 Lv. +1 증가',
  'supportB_+2': '서폿B 옵션 Lv. +2 증가',
  'supportB_+3': '서폿B 옵션 Lv. +3 증가',
  'supportB_+4': '서폿B 옵션 Lv. +4 증가',
  'supportB_-1': '서폿B 옵션 Lv. -1 감소',
  'dealerA_change': '딜러A 옵션 변경',
  'dealerB_change': '딜러B 옵션 변경',
  'supportA_change': '서폿A 옵션 변경',
  'supportB_change': '서폿B 옵션 변경',
  'cost_+100': '가공 비용 +100% 증가',
  'cost_-100': '가공 비용 -100% 감소',
  'maintain': '가공 상태 유지',
  'reroll_+1': '다른 항목 보기 +1회 증가',
  'reroll_+2': '다른 항목 보기 +2회 증가'
};

// 등급별 다른 항목 보기 횟수 설정
export const getRerollAttempts = (grade) => {
  switch (grade) {
    case 'UNCOMMON': return 0;  // 고급 젬 (0회)
    case 'RARE': return 1;      // 희귀 젬 (1회)
    case 'HEROIC': return 2;    // 영웅 젬 (2회)
    default: return 0;
  }
};

// 등급별 가공 횟수 설정
export const getProcessingAttempts = (grade) => {
  switch (grade) {
    case 'UNCOMMON': return 5;  // 고급 젬 (5회)
    case 'RARE': return 7;      // 희귀 젬 (7회)
    case 'HEROIC': return 9;    // 영웅 젬 (9회)
    default: return 5;
  }
};

// 젬 가공 기본 비용 (골드)
export const PROCESSING_COST = 900;

export default {
  GEM_TYPES,
  GEM_EFFECTS,
  EFFECT_INDEX_NAMES,
  EFFECT_NAME_INDEXES,
  GEM_GRADES,
  GEM_GRADE_COLORS,
  PROCESSING_POSSIBILITIES,
  PROCESSING_ACTION_DESCRIPTIONS,
  FUSION_GRADE_PROBABILITY,
  LEGENDARY_POINT_DISTRIBUTION,
  RELIC_POINT_DISTRIBUTION,
  ANCIENT_POINT_DISTRIBUTION,
  PROCESSING_COST,
  getRerollAttempts,
  getProcessingAttempts
};