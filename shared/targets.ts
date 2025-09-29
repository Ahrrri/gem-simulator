/**
 * 젬 시뮬레이터 타겟 함수들
 * 🎯 TypeScript-first 소스 오브 트루스
 * Python 코드는 이 파일에서 자동 생성됨
 */

import type { GemState, TargetKey, TargetFunction } from './types';
import {
  getTotalStats,
  getWillpowerCorepointSum,
  getDealerStats,
  getSupportStats,
  hasBothDealer,
  hasBothSupport
} from './types';
import { TARGET_THRESHOLDS } from './constants';

// === 기본 타겟 함수들 ===

export const target_5_5 = (gem: GemState): boolean => {
  return gem.willpower >= 5 && gem.corePoint >= 5;
};

export const target_5_5_dealer_both = (gem: GemState): boolean => {
  return gem.willpower >= 5 && gem.corePoint >= 5 && hasBothDealer(gem);
};

export const target_5_5_support_both = (gem: GemState): boolean => {
  return gem.willpower >= 5 && gem.corePoint >= 5 && hasBothSupport(gem);
};

export const target_5_4 = (gem: GemState): boolean => {
  return gem.willpower >= 5 && gem.corePoint >= 4;
};

export const target_5_4_dealer_both = (gem: GemState): boolean => {
  return gem.willpower >= 5 && gem.corePoint >= 4 && hasBothDealer(gem);
};

export const target_5_4_support_both = (gem: GemState): boolean => {
  return gem.willpower >= 5 && gem.corePoint >= 4 && hasBothSupport(gem);
};

export const target_4_5 = (gem: GemState): boolean => {
  return gem.willpower >= 4 && gem.corePoint >= 5;
};

export const target_4_5_dealer_both = (gem: GemState): boolean => {
  return gem.willpower >= 4 && gem.corePoint >= 5 && hasBothDealer(gem);
};

export const target_4_5_support_both = (gem: GemState): boolean => {
  return gem.willpower >= 4 && gem.corePoint >= 5 && hasBothSupport(gem);
};

export const target_5_3 = (gem: GemState): boolean => {
  return gem.willpower >= 5 && gem.corePoint >= 3;
};

export const target_5_3_dealer_both = (gem: GemState): boolean => {
  return gem.willpower >= 5 && gem.corePoint >= 3 && hasBothDealer(gem);
};

export const target_5_3_support_both = (gem: GemState): boolean => {
  return gem.willpower >= 5 && gem.corePoint >= 3 && hasBothSupport(gem);
};

export const target_4_4 = (gem: GemState): boolean => {
  return gem.willpower >= 4 && gem.corePoint >= 4;
};

export const target_4_4_dealer_both = (gem: GemState): boolean => {
  return gem.willpower >= 4 && gem.corePoint >= 4 && hasBothDealer(gem);
};

export const target_4_4_support_both = (gem: GemState): boolean => {
  return gem.willpower >= 4 && gem.corePoint >= 4 && hasBothSupport(gem);
};

export const target_3_5 = (gem: GemState): boolean => {
  return gem.willpower >= 3 && gem.corePoint >= 5;
};

export const target_3_5_dealer_both = (gem: GemState): boolean => {
  return gem.willpower >= 3 && gem.corePoint >= 5 && hasBothDealer(gem);
};

export const target_3_5_support_both = (gem: GemState): boolean => {
  return gem.willpower >= 3 && gem.corePoint >= 5 && hasBothSupport(gem);
};

// === 합계 기반 타겟들 ===

export const target_sum8 = (gem: GemState): boolean => {
  return getWillpowerCorepointSum(gem) >= 8;
};

export const target_sum8_dealer_both = (gem: GemState): boolean => {
  return getWillpowerCorepointSum(gem) >= 8 && hasBothDealer(gem);
};

export const target_sum8_support_both = (gem: GemState): boolean => {
  return getWillpowerCorepointSum(gem) >= 8 && hasBothSupport(gem);
};

export const target_sum9 = (gem: GemState): boolean => {
  return getWillpowerCorepointSum(gem) >= 9;
};

export const target_sum9_dealer_both = (gem: GemState): boolean => {
  return getWillpowerCorepointSum(gem) >= 9 && hasBothDealer(gem);
};

export const target_sum9_support_both = (gem: GemState): boolean => {
  return getWillpowerCorepointSum(gem) >= 9 && hasBothSupport(gem);
};

// === 등급 기반 타겟들 ===

export const target_relic = (gem: GemState): boolean => {
  return getTotalStats(gem) >= TARGET_THRESHOLDS.RELIC_THRESHOLD;
};

export const target_relic_dealer_both = (gem: GemState): boolean => {
  return getTotalStats(gem) >= TARGET_THRESHOLDS.RELIC_THRESHOLD && hasBothDealer(gem);
};

export const target_relic_support_both = (gem: GemState): boolean => {
  return getTotalStats(gem) >= TARGET_THRESHOLDS.RELIC_THRESHOLD && hasBothSupport(gem);
};

export const target_ancient = (gem: GemState): boolean => {
  return getTotalStats(gem) >= TARGET_THRESHOLDS.ANCIENT_THRESHOLD;
};

export const target_ancient_dealer_both = (gem: GemState): boolean => {
  return getTotalStats(gem) >= TARGET_THRESHOLDS.ANCIENT_THRESHOLD && hasBothDealer(gem);
};

export const target_ancient_support_both = (gem: GemState): boolean => {
  return getTotalStats(gem) >= TARGET_THRESHOLDS.ANCIENT_THRESHOLD && hasBothSupport(gem);
};

// === 종결 타겟들 ===

export const target_dealer_complete = (gem: GemState): boolean => {
  return (gem.willpower + gem.corePoint + getDealerStats(gem)) === TARGET_THRESHOLDS.COMPLETE_THRESHOLD;
};

export const target_support_complete = (gem: GemState): boolean => {
  return (gem.willpower + gem.corePoint + getSupportStats(gem)) === TARGET_THRESHOLDS.COMPLETE_THRESHOLD;
};

// === 타겟 매핑 (타입 안전성 보장) ===

export const TARGETS = {
  '5/5': target_5_5,
  '5/5_dealer_both': target_5_5_dealer_both,
  '5/5_support_both': target_5_5_support_both,
  '5/4': target_5_4,
  '5/4_dealer_both': target_5_4_dealer_both,
  '5/4_support_both': target_5_4_support_both,
  '4/5': target_4_5,
  '4/5_dealer_both': target_4_5_dealer_both,
  '4/5_support_both': target_4_5_support_both,
  '5/3': target_5_3,
  '5/3_dealer_both': target_5_3_dealer_both,
  '5/3_support_both': target_5_3_support_both,
  '4/4': target_4_4,
  '4/4_dealer_both': target_4_4_dealer_both,
  '4/4_support_both': target_4_4_support_both,
  '3/5': target_3_5,
  '3/5_dealer_both': target_3_5_dealer_both,
  '3/5_support_both': target_3_5_support_both,
  'sum8+': target_sum8,
  'sum8+_dealer_both': target_sum8_dealer_both,
  'sum8+_support_both': target_sum8_support_both,
  'sum9+': target_sum9,
  'sum9+_dealer_both': target_sum9_dealer_both,
  'sum9+_support_both': target_sum9_support_both,
  'relic+': target_relic,
  'relic+_dealer_both': target_relic_dealer_both,
  'relic+_support_both': target_relic_support_both,
  'ancient+': target_ancient,
  'ancient+_dealer_both': target_ancient_dealer_both,
  'ancient+_support_both': target_ancient_support_both,
  'dealer_complete': target_dealer_complete,
  'support_complete': target_support_complete,
} as const satisfies Record<TargetKey, TargetFunction>;

// === 유틸리티 함수들 ===

/**
 * 주어진 젬 상태에서 모든 타겟들을 검사하여 결과를 반환
 */
export const checkAllTargets = (gem: GemState): Record<TargetKey, boolean> => {
  const results = {} as Record<TargetKey, boolean>;

  for (const [targetName, targetFunction] of Object.entries(TARGETS)) {
    results[targetName as TargetKey] = targetFunction(gem);
  }

  return results;
};

/**
 * 특정 타겟들만 검사하여 결과를 반환
 */
export const checkSelectedTargets = (
  gem: GemState,
  targetKeys: TargetKey[]
): Partial<Record<TargetKey, boolean>> => {
  const results: Partial<Record<TargetKey, boolean>> = {};

  for (const targetKey of targetKeys) {
    const targetFunction = TARGETS[targetKey];
    if (targetFunction) {
      results[targetKey] = targetFunction(gem);
    }
  }

  return results;
};

/**
 * 달성된 타겟들만 반환
 */
export const getAchievedTargets = (gem: GemState): TargetKey[] => {
  const achieved: TargetKey[] = [];

  for (const [targetName, targetFunction] of Object.entries(TARGETS)) {
    if (targetFunction(gem)) {
      achieved.push(targetName as TargetKey);
    }
  }

  return achieved;
};