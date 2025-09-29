"""
Generated from TypeScript source
⚠️  DO NOT EDIT - This file is auto-generated
🔄 Run tools/ts2py.js to regenerate
"""

from dataclasses import dataclass
from typing import Optional, Dict, List, Callable, Union
"""
젬 시뮬레이터 핵심 타입 정의🎯 TypeScript-first 소스 오브 트루스Python 코드는 이 파일에서 자동 생성됨
"""# === 기본 젬 상태 ===
@dataclass
class GemState:
    willpower: int
    core_point: int
    dealer_a: int
    dealer_b: int
    support_a: int
    support_b: int
    remaining_attempts: int
    current_reroll_attempts: int
    cost_modifier: Optional[int] = None
    is_first_processing: Optional[bool] = None# === 젬 상태 유틸리티 함수들 ===
def get_total_stats(gem: GemState) -> int:
    """get_total_stats"""
    return gem.willpower + gem.core_point + gem.dealer_a + gem.dealer_b + gem.support_a + gem.support_b;;

def get_willpower_corepoint_sum(gem: GemState) -> int:
    """get_willpower_corepoint_sum"""
    return gem.willpower + gem.core_point;;

def get_dealer_stats(gem: GemState) -> int:
    """get_dealer_stats"""
    return gem.dealer_a + gem.dealer_b;;

def get_support_stats(gem: GemState) -> int:
    """get_support_stats"""
    return gem.support_a + gem.support_b;;

def has_both_dealer(gem: GemState) -> bool:
    """has_both_dealer"""
    return gem.dealer_a > 0  and  gem.dealer_b > 0;;

def has_both_support(gem: GemState) -> bool:
    """has_both_support"""
    return gem.support_a > 0  and  gem.support_b > 0;;# === 타겟 관련 타입들 ===
# Type alias: TargetFunction = (gem: GemState) => boolean

@dataclass
class TargetConfig:
    label: str
    column_name: str

# Type alias: TargetKey = | '5/5' | '5/5_dealer_both' | '5/5_support_both'
  | '5/4' | '5/4_dealer_both' | '5/4_support_both'
  | '4/5' | '4/5_dealer_both' | '4/5_support_both'
  | '5/3' | '5/3_dealer_both' | '5/3_support_both'
  | '4/4' | '4/4_dealer_both' | '4/4_support_both'
  | '3/5' | '3/5_dealer_both' | '3/5_support_both'
  | 'sum8+' | 'sum8+_dealer_both' | 'sum8+_support_both'
  | 'sum9+' | 'sum9+_dealer_both' | 'sum9+_support_both'
  | 'relic+' | 'relic+_dealer_both' | 'relic+_support_both'
  | 'ancient+' | 'ancient+_dealer_both' | 'ancient+_support_both'
  | 'dealer_complete' | 'support_complete'# === 코어 등급 타입들 ===
# Type alias: CoreGrade = 'hero' | 'legendary' | 'relic' | 'ancient'

# Type alias: GemType = 'erosion_stability' | 'distortion_solid' | 'collapse_immutable'# === 확률 계산 관련 타입들 ===
@dataclass
class ProbabilityResult:
    probability: int
    expected_cost: int
    expected_attempts: int

@dataclass
class ComboResult:
    willpower: int
    core_point: int
    dealer_a: int
    dealer_b: int
    support_a: int
    support_b: int
    probability: int# === DB 관련 타입들 ===
@dataclass
class DBQueryOptions:
    batch_size: Optional[int] = None
    cache_size: Optional[int] = None
    timeout: Optional[int] = None

@dataclass
class DBResult:
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    row_count: Optional[int] = None# === 시뮬레이션 옵션 타입들 ===
@dataclass
class SimulationOptions:
    max_reroll_attempts: int
    cost_multiplier: int
    use_smart_reroll_strategy: bool
    target_thresholds: Record<string, number>