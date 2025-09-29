"""
Generated from TypeScript source
⚠️  DO NOT EDIT - This file is auto-generated
🔄 Run tools/ts2py.js to regenerate
"""
"""
젬 시뮬레이터 상수 정의🎯 TypeScript-first 소스 오브 트루스Python 코드는 이 파일에서 자동 생성됨
"""

# Type imports removed for Python compatibility;# === 아크 그리드 시스템 상수들 ===
ARC_GRID_CONSTANTS = {# 코어 등급별 공급 의지력
  CORE_WILLPOWER: {
    hero: 9,
    legendary: 12,
    relic: 15,
    ancient: 17,
  }, number>,# 젬 타입별 기본 필요 의지력
  GEM_BASE_WILLPOWER: {
    erosion_stability: 8,      // 침식/안정
    distortion_solid: 9,       // 왜곡/견고
    collapse_immutable: 10,    // 붕괴/불변
  }, number>,# 의지력 효율 시스템
  WILLPOWER_EFFICIENCY: {
    MAX_REDUCTION: 5,          // 최대 5까지 감소 가능
    MIN_WILLPOWER: {
      erosion_stability: 3,     // 8 - 5 = 3
      distortion_solid: 4,      // 9 - 5 = 4
      collapse_immutable: 5,    // 10 - 5 = 5
    }, number>,
  },# 코어별 최대 활성화 젬 개수
  MAX_GEMS_PER_CORE: {
    legendary: 4,
    relic: 4,
    ancient: 4,
  },# 코어 효과 활성화 포인트
  CORE_ACTIVATION_POINTS: [10, 14, 17, 18, 19, 20],
}# === 확률 계산 관련 상수들 ===
PROBABILITY_CONSTANTS = {# 기본 확률들 (예시 - 실제 값은 게임 데이터에서)
  BASE_SUCCESS_RATES: {
    1: 0.75,   // 1등급 성공률
    2: 0.65,   // 2등급 성공률
    3: 0.55,   // 3등급 성공률
    4: 0.45,   // 4등급 성공률
    5: 0.35,   // 5등급 성공률
    6: 0.25,   // 6등급 성공률
    7: 0.15,   // 7등급 성공률
    8: 0.10,   // 8등급 성공률
    9: 0.05,   // 9등급 성공률
    10: 0.01,  // 10등급 성공률
  }, number>,# 리롤 관련
  MAX_REROLL_ATTEMPTS: 5,
  REROLL_COST_MULTIPLIER: 1.5,
}# === DB 관련 상수들 ===
DB_CONSTANTS = {
    "DEFAULT_DB_NAME": 'probability_table_reroll_7.db',
    "BATCH_SIZE": 1000,
    "CACHE_SIZE": 10000,
    "DEFAULT_TIMEOUT": 30000
}# === 타겟 임계값들 ===
TARGET_THRESHOLDS = {
    "RELIC_THRESHOLD": 16,
    "// 유물+ 임계값
  ANCIENT_THRESHOLD": 19,
    "// 고대 임계값
  COMPLETE_THRESHOLD": 20
}# === 파일 경로 관련 상수들 ===
PATH_CONSTANTS = {
    "DATA_DIR": '../data',
    "CACHE_DIR": '../data/cache',
    "EXPORTS_DIR": '../data/exports',
    "PYTHON_DIR": '../python',
    "TOOLS_DIR": '../tools'
}# === 시뮬레이션 관련 상수들 ===
SIMULATION_CONSTANTS = {
    "# 기본 시뮬레이션 설정
  DEFAULT_MAX_ATTEMPTS": 1000000,
    "DEFAULT_BATCH_SIZE": 10000,
    "DEFAULT_WORKER_COUNT": 4,
    "# 수렴 관련 설정
  CONVERGENCE_TOLERANCE": 1e-6,
    "MIN_ITERATIONS": 1000,
    "MAX_ITERATIONS": 100000,
    "# 메모리 관리
  MEMORY_LIMIT_MB": 8192,
    "// 8_g_b
  GC_THRESHOLD": 1000000
}# === 타겟 설정 매핑 ===
TARGET_CONFIGS = {
  '5/5': {
    label: '5/5',
    column_name: '5_5'
  },
  '5/5_dealer_both': {
    label: '5/5 (딜러 이중)',
    column_name: '5_5_dealer_both'
  },
  '5/5_support_both': {
    label: '5/5 (서폿 이중)',
    column_name: '5_5_support_both'
  },
  '5/4': {
    label: '5/4+',
    column_name: '5_4'
  },
  '5/4_dealer_both': {
    label: '5/4+ (딜러 이중)',
    column_name: '5_4_dealer_both'
  },
  '5/4_support_both': {
    label: '5/4+ (서폿 이중)',
    column_name: '5_4_support_both'
  },
  '4/5': {
    label: '4/5+',
    column_name: '4_5'
  },
  '4/5_dealer_both': {
    label: '4/5+ (딜러 이중)',
    column_name: '4_5_dealer_both'
  },
  '4/5_support_both': {
    label: '4/5+ (서폿 이중)',
    column_name: '4_5_support_both'
  },
  '5/3': {
    label: '5/3+',
    column_name: '5_3'
  },
  '5/3_dealer_both': {
    label: '5/3+ (딜러 이중)',
    column_name: '5_3_dealer_both'
  },
  '5/3_support_both': {
    label: '5/3+ (서폿 이중)',
    column_name: '5_3_support_both'
  },
  '4/4': {
    label: '4/4+',
    column_name: '4_4'
  },
  '4/4_dealer_both': {
    label: '4/4+ (딜러 이중)',
    column_name: '4_4_dealer_both'
  },
  '4/4_support_both': {
    label: '4/4+ (서폿 이중)',
    column_name: '4_4_support_both'
  },
  '3/5': {
    label: '3/5+',
    column_name: '3_5'
  },
  '3/5_dealer_both': {
    label: '3/5+ (딜러 이중)',
    column_name: '3_5_dealer_both'
  },
  '3/5_support_both': {
    label: '3/5+ (서폿 이중)',
    column_name: '3_5_support_both'
  },
  'sum8+': {
    label: '합 8+',
    column_name: 'sum8'
  },
  'sum8+_dealer_both': {
    label: '합 8+ (딜러 이중)',
    column_name: 'sum8_dealer_both'
  },
  'sum8+_support_both': {
    label: '합 8+ (서폿 이중)',
    column_name: 'sum8_support_both'
  },
  'sum9+': {
    label: '합 9+',
    column_name: 'sum9'
  },
  'sum9+_dealer_both': {
    label: '합 9+ (딜러 이중)',
    column_name: 'sum9_dealer_both'
  },
  'sum9+_support_both': {
    label: '합 9+ (서폿 이중)',
    column_name: 'sum9_support_both'
  },
  'relic+': {
    label: '유물+',
    column_name: 'relic'
  },
  'relic+_dealer_both': {
    label: '유물+ (딜러 이중)',
    column_name: 'relic_dealer_both'
  },
  'relic+_support_both': {
    label: '유물+ (서폿 이중)',
    column_name: 'relic_support_both'
  },
  'ancient+': {
    label: '고대',
    column_name: 'ancient'
  },
  'ancient+_dealer_both': {
    label: '고대 (딜러 이중)',
    column_name: 'ancient_dealer_both'
  },
  'ancient+_support_both': {
    label: '고대 (서폿 이중)',
    column_name: 'ancient_support_both'
  },
  'dealer_complete': {
    label: '딜러 종결',
    column_name: 'dealer_complete'
  },
  'support_complete': {
    label: '서폿 종결',
    column_name: 'support_complete'
  },
}