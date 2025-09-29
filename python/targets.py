"""
Generated from TypeScript source
⚠️  DO NOT EDIT - This file is auto-generated
🔄 Run tools/ts2py.js to regenerate
"""

from .types import getTotalStats, getWillpowerCorepointSum, getDealerStats, getSupportStats, hasBothDealer, hasBothSupport
from .constants import TARGET_THRESHOLDS
"""
젬 시뮬레이터 타겟 함수들🎯 TypeScript-first 소스 오브 트루스Python 코드는 이 파일에서 자동 생성됨
"""

# Type imports removed for Python compatibility;
# from .types import get_total_stats, get_willpower_corepoint_sum, get_dealer_stats, get_support_stats, has_both_dealer, has_both_support;
# from .constants import TARGET_THRESHOLDS;# === 기본 타겟 함수들 ===

def target_5_5(gem: GemState) -> bool:
    """target_5_5"""
    return gem.willpower >= 5  and  gem.core_point >= 5;;

def target_5_5_dealer_both(gem: GemState) -> bool:
    """target_5_5_dealer_both"""
    return gem.willpower >= 5  and  gem.core_point >= 5  and  has_both_dealer(gem);;

def target_5_5_support_both(gem: GemState) -> bool:
    """target_5_5_support_both"""
    return gem.willpower >= 5  and  gem.core_point >= 5  and  has_both_support(gem);;

def target_5_4(gem: GemState) -> bool:
    """target_5_4"""
    return gem.willpower >= 5  and  gem.core_point >= 4;;

def target_5_4_dealer_both(gem: GemState) -> bool:
    """target_5_4_dealer_both"""
    return gem.willpower >= 5  and  gem.core_point >= 4  and  has_both_dealer(gem);;

def target_5_4_support_both(gem: GemState) -> bool:
    """target_5_4_support_both"""
    return gem.willpower >= 5  and  gem.core_point >= 4  and  has_both_support(gem);;

def target_4_5(gem: GemState) -> bool:
    """target_4_5"""
    return gem.willpower >= 4  and  gem.core_point >= 5;;

def target_4_5_dealer_both(gem: GemState) -> bool:
    """target_4_5_dealer_both"""
    return gem.willpower >= 4  and  gem.core_point >= 5  and  has_both_dealer(gem);;

def target_4_5_support_both(gem: GemState) -> bool:
    """target_4_5_support_both"""
    return gem.willpower >= 4  and  gem.core_point >= 5  and  has_both_support(gem);;

def target_5_3(gem: GemState) -> bool:
    """target_5_3"""
    return gem.willpower >= 5  and  gem.core_point >= 3;;

def target_5_3_dealer_both(gem: GemState) -> bool:
    """target_5_3_dealer_both"""
    return gem.willpower >= 5  and  gem.core_point >= 3  and  has_both_dealer(gem);;

def target_5_3_support_both(gem: GemState) -> bool:
    """target_5_3_support_both"""
    return gem.willpower >= 5  and  gem.core_point >= 3  and  has_both_support(gem);;

def target_4_4(gem: GemState) -> bool:
    """target_4_4"""
    return gem.willpower >= 4  and  gem.core_point >= 4;;

def target_4_4_dealer_both(gem: GemState) -> bool:
    """target_4_4_dealer_both"""
    return gem.willpower >= 4  and  gem.core_point >= 4  and  has_both_dealer(gem);;

def target_4_4_support_both(gem: GemState) -> bool:
    """target_4_4_support_both"""
    return gem.willpower >= 4  and  gem.core_point >= 4  and  has_both_support(gem);;

def target_3_5(gem: GemState) -> bool:
    """target_3_5"""
    return gem.willpower >= 3  and  gem.core_point >= 5;;

def target_3_5_dealer_both(gem: GemState) -> bool:
    """target_3_5_dealer_both"""
    return gem.willpower >= 3  and  gem.core_point >= 5  and  has_both_dealer(gem);;

def target_3_5_support_both(gem: GemState) -> bool:
    """target_3_5_support_both"""
    return gem.willpower >= 3  and  gem.core_point >= 5  and  has_both_support(gem);;# === 합계 기반 타겟들 ===

def target_sum8(gem: GemState) -> bool:
    """target_sum8"""
    return get_willpower_corepoint_sum(gem) >= 8;;

def target_sum8_dealer_both(gem: GemState) -> bool:
    """target_sum8_dealer_both"""
    return get_willpower_corepoint_sum(gem) >= 8  and  has_both_dealer(gem);;

def target_sum8_support_both(gem: GemState) -> bool:
    """target_sum8_support_both"""
    return get_willpower_corepoint_sum(gem) >= 8  and  has_both_support(gem);;

def target_sum9(gem: GemState) -> bool:
    """target_sum9"""
    return get_willpower_corepoint_sum(gem) >= 9;;

def target_sum9_dealer_both(gem: GemState) -> bool:
    """target_sum9_dealer_both"""
    return get_willpower_corepoint_sum(gem) >= 9  and  has_both_dealer(gem);;

def target_sum9_support_both(gem: GemState) -> bool:
    """target_sum9_support_both"""
    return get_willpower_corepoint_sum(gem) >= 9  and  has_both_support(gem);;# === 등급 기반 타겟들 ===

def target_relic(gem: GemState) -> bool:
    """target_relic"""
    return get_total_stats(gem) >= TARGET_THRESHOLDS.RELIC_THRESHOLD;;

def target_relic_dealer_both(gem: GemState) -> bool:
    """target_relic_dealer_both"""
    return get_total_stats(gem) >= TARGET_THRESHOLDS.RELIC_THRESHOLD  and  has_both_dealer(gem);;

def target_relic_support_both(gem: GemState) -> bool:
    """target_relic_support_both"""
    return get_total_stats(gem) >= TARGET_THRESHOLDS.RELIC_THRESHOLD  and  has_both_support(gem);;

def target_ancient(gem: GemState) -> bool:
    """target_ancient"""
    return get_total_stats(gem) >= TARGET_THRESHOLDS.ANCIENT_THRESHOLD;;

def target_ancient_dealer_both(gem: GemState) -> bool:
    """target_ancient_dealer_both"""
    return get_total_stats(gem) >= TARGET_THRESHOLDS.ANCIENT_THRESHOLD  and  has_both_dealer(gem);;

def target_ancient_support_both(gem: GemState) -> bool:
    """target_ancient_support_both"""
    return get_total_stats(gem) >= TARGET_THRESHOLDS.ANCIENT_THRESHOLD  and  has_both_support(gem);;# === 종결 타겟들 ===

def target_dealer_complete(gem: GemState) -> bool:
    """target_dealer_complete"""
    return (gem.willpower + gem.core_point + get_dealer_stats(gem)) === TARGET_THRESHOLDS.COMPLETE_THRESHOLD;;

def target_support_complete(gem: GemState) -> bool:
    """target_support_complete"""
    return (gem.willpower + gem.core_point + get_support_stats(gem)) === TARGET_THRESHOLDS.COMPLETE_THRESHOLD;;# === 타겟 매핑 (타입 안전성 보장) ===

TARGETS = {
    "5/5": target_5_5,
    "5/5_dealer_both": target_5_5_dealer_both,
    "5/5_support_both": target_5_5_support_both,
    "5/4": target_5_4,
    "5/4_dealer_both": target_5_4_dealer_both,
    "5/4_support_both": target_5_4_support_both,
    "4/5": target_4_5,
    "4/5_dealer_both": target_4_5_dealer_both,
    "4/5_support_both": target_4_5_support_both,
    "5/3": target_5_3,
    "5/3_dealer_both": target_5_3_dealer_both,
    "5/3_support_both": target_5_3_support_both,
    "4/4": target_4_4,
    "4/4_dealer_both": target_4_4_dealer_both,
    "4/4_support_both": target_4_4_support_both,
    "3/5": target_3_5,
    "3/5_dealer_both": target_3_5_dealer_both,
    "3/5_support_both": target_3_5_support_both,
    "sum8+": target_sum8,
    "sum8+_dealer_both": target_sum8_dealer_both,
    "sum8+_support_both": target_sum8_support_both,
    "sum9+": target_sum9,
    "sum9+_dealer_both": target_sum9_dealer_both,
    "sum9+_support_both": target_sum9_support_both,
    "relic+": target_relic,
    "relic+_dealer_both": target_relic_dealer_both,
    "relic+_support_both": target_relic_support_both,
    "ancient+": target_ancient,
    "ancient+_dealer_both": target_ancient_dealer_both,
    "ancient+_support_both": target_ancient_support_both,
    "dealer_complete": target_dealer_complete,
    "support_complete": target_support_complete
}# === 유틸리티 함수들 ===

"""
주어진 젬 상태에서 모든 타겟들을 검사하여 결과를 반환
"""
check_all_targets = (gem: GemState): Record<TargetKey, boolean> => {
  const results = {}<TargetKey, boolean>

  for (const [target_name, target_function] of Object.entries(TARGETS)) {
    results[target_name] = target_function(gem);
  }

  return results;
};

"""
특정 타겟들만 검사하여 결과를 반환
"""
check_selected_targets = (
  gem: GemState,
  target_keys: TargetKey[]
): Partial<Record<TargetKey, boolean>> => {
  const results: Partial<Record<TargetKey, boolean>> = {}

  for (const target_key of target_keys) {
    const target_function = TARGETS[target_key];
    if (target_function) {
      results[target_key] = target_function(gem);
    }
  }

  return results;
};

"""
달성된 타겟들만 반환
"""
get_achieved_targets = (gem: GemState): TargetKey[] => {
  const achieved: TargetKey[] = []

  for (const [target_name, target_function] of Object.entries(TARGETS)) {
    if (target_function(gem)) {
      achieved.push(target_name);
    }
  }

  return achieved;
};