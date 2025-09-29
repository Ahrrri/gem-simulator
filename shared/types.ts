/**
 * 젬 시뮬레이터 핵심 타입 정의
 * 🎯 TypeScript-first 소스 오브 트루스
 * Python 코드는 이 파일에서 자동 생성됨
 */

// === 기본 젬 상태 ===
export interface GemState {
  readonly willpower: number;
  readonly corePoint: number;
  readonly dealerA: number;
  readonly dealerB: number;
  readonly supportA: number;
  readonly supportB: number;
  readonly remainingAttempts: number;
  readonly currentRerollAttempts: number;
  readonly costModifier?: number;
  readonly isFirstProcessing?: boolean;
}

// === 젬 상태 유틸리티 함수들 ===
export const getTotalStats = (gem: GemState): number => {
  return gem.willpower + gem.corePoint + gem.dealerA + gem.dealerB + gem.supportA + gem.supportB;
};

export const getWillpowerCorepointSum = (gem: GemState): number => {
  return gem.willpower + gem.corePoint;
};

export const getDealerStats = (gem: GemState): number => {
  return gem.dealerA + gem.dealerB;
};

export const getSupportStats = (gem: GemState): number => {
  return gem.supportA + gem.supportB;
};

export const hasBothDealer = (gem: GemState): boolean => {
  return gem.dealerA > 0 && gem.dealerB > 0;
};

export const hasBothSupport = (gem: GemState): boolean => {
  return gem.supportA > 0 && gem.supportB > 0;
};

// === 타겟 관련 타입들 ===
export type TargetFunction = (gem: GemState) => boolean;

export interface TargetConfig {
  readonly label: string;
  readonly columnName: string;
}

export type TargetKey =
  | '5/5' | '5/5_dealer_both' | '5/5_support_both'
  | '5/4' | '5/4_dealer_both' | '5/4_support_both'
  | '4/5' | '4/5_dealer_both' | '4/5_support_both'
  | '5/3' | '5/3_dealer_both' | '5/3_support_both'
  | '4/4' | '4/4_dealer_both' | '4/4_support_both'
  | '3/5' | '3/5_dealer_both' | '3/5_support_both'
  | 'sum8+' | 'sum8+_dealer_both' | 'sum8+_support_both'
  | 'sum9+' | 'sum9+_dealer_both' | 'sum9+_support_both'
  | 'relic+' | 'relic+_dealer_both' | 'relic+_support_both'
  | 'ancient+' | 'ancient+_dealer_both' | 'ancient+_support_both'
  | 'dealer_complete' | 'support_complete';

// === 코어 등급 타입들 ===
export type CoreGrade = 'hero' | 'legendary' | 'relic' | 'ancient';

export type GemType = 'erosion_stability' | 'distortion_solid' | 'collapse_immutable';

// === 확률 계산 관련 타입들 ===
export interface ProbabilityResult {
  readonly probability: number;
  readonly expectedCost: number;
  readonly expectedAttempts: number;
}

export interface ComboResult {
  readonly willpower: number;
  readonly corePoint: number;
  readonly dealerA: number;
  readonly dealerB: number;
  readonly supportA: number;
  readonly supportB: number;
  readonly probability: number;
}

// === DB 관련 타입들 ===
export interface DBQueryOptions {
  readonly batchSize?: number;
  readonly cacheSize?: number;
  readonly timeout?: number;
}

export interface DBResult {
  readonly success: boolean;
  readonly data?: any;
  readonly error?: string;
  readonly rowCount?: number;
}

// === 시뮬레이션 옵션 타입들 ===
export interface SimulationOptions {
  readonly maxRerollAttempts: number;
  readonly costMultiplier: number;
  readonly useSmartRerollStrategy: boolean;
  readonly targetThresholds: Record<string, number>;
}