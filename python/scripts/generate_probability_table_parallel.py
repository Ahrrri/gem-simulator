#!/usr/bin/env python3
"""
젬 가공 확률 테이블을 멀티코어를 활용하여 병렬로 계산하는 스크립트
"""

import time
import sqlite3
import random
import os
import json
import multiprocessing as mp
from typing import Dict, List
from dataclasses import dataclass
from itertools import combinations, permutations
from multiprocessing import Pool

# 상수 정의
MAX_REROLL_ATTEMPTS = 6  # 전체 상태 생성 시 고려하는 최대 리롤 횟수 (0~6)

# 젬 가공 관련 상수
PROCESSING_COST = 900  # 기본 가공 비용 (골드)

# isFirstProcessing이 True일 수 있는 유효한 조합
# gemConstants.js의 getProcessingAttempts, getRerollAttempts와 일치
VALID_FIRST_PROCESSING_COMBINATIONS = [
    (5, 0),   # 고급 젬: 5회 가공, 0회 리롤
    (7, 1),   # 희귀 젬: 7회 가공, 1회 리롤  
    (9, 2)    # 영웅 젬: 9회 가공, 2회 리롤
]

# 젬 가공 확률 테이블 (4개 옵션 시스템)
PROCESSING_POSSIBILITIES = {
    'willpower_+1': {'probability': 0.1165, 'condition': 'willpower < 5'},
    'willpower_+2': {'probability': 0.0440, 'condition': 'willpower < 4'},
    'willpower_+3': {'probability': 0.0175, 'condition': 'willpower < 3'},
    'willpower_+4': {'probability': 0.0045, 'condition': 'willpower < 2'},
    'willpower_-1': {'probability': 0.0300, 'condition': 'willpower > 1'},
    
    'corePoint_+1': {'probability': 0.1165, 'condition': 'corePoint < 5'},
    'corePoint_+2': {'probability': 0.0440, 'condition': 'corePoint < 4'},
    'corePoint_+3': {'probability': 0.0175, 'condition': 'corePoint < 3'},
    'corePoint_+4': {'probability': 0.0045, 'condition': 'corePoint < 2'},
    'corePoint_-1': {'probability': 0.0300, 'condition': 'corePoint > 1'},
    
    # 4개 옵션 시스템: dealerA, dealerB, supportA, supportB
    'dealerA_+1': {'probability': 0.1165, 'condition': 'dealerA > 0 && dealerA < 5'},
    'dealerA_+2': {'probability': 0.0440, 'condition': 'dealerA > 0 && dealerA < 4'},
    'dealerA_+3': {'probability': 0.0175, 'condition': 'dealerA > 0 && dealerA < 3'},
    'dealerA_+4': {'probability': 0.0045, 'condition': 'dealerA > 0 && dealerA < 2'},
    'dealerA_-1': {'probability': 0.0300, 'condition': 'dealerA > 1'},
    
    'dealerB_+1': {'probability': 0.1165, 'condition': 'dealerB > 0 && dealerB < 5'},
    'dealerB_+2': {'probability': 0.0440, 'condition': 'dealerB > 0 && dealerB < 4'},
    'dealerB_+3': {'probability': 0.0175, 'condition': 'dealerB > 0 && dealerB < 3'},
    'dealerB_+4': {'probability': 0.0045, 'condition': 'dealerB > 0 && dealerB < 2'},
    'dealerB_-1': {'probability': 0.0300, 'condition': 'dealerB > 1'},
    
    'supportA_+1': {'probability': 0.1165, 'condition': 'supportA > 0 && supportA < 5'},
    'supportA_+2': {'probability': 0.0440, 'condition': 'supportA > 0 && supportA < 4'},
    'supportA_+3': {'probability': 0.0175, 'condition': 'supportA > 0 && supportA < 3'},
    'supportA_+4': {'probability': 0.0045, 'condition': 'supportA > 0 && supportA < 2'},
    'supportA_-1': {'probability': 0.0300, 'condition': 'supportA > 1'},
    
    'supportB_+1': {'probability': 0.1165, 'condition': 'supportB > 0 && supportB < 5'},
    'supportB_+2': {'probability': 0.0440, 'condition': 'supportB > 0 && supportB < 4'},
    'supportB_+3': {'probability': 0.0175, 'condition': 'supportB > 0 && supportB < 3'},
    'supportB_+4': {'probability': 0.0045, 'condition': 'supportB > 0 && supportB < 2'},
    'supportB_-1': {'probability': 0.0300, 'condition': 'supportB > 1'},
    
    # 옵션 변경 (0이 아닌 옵션을 다른 옵션으로 변경)
    'dealerA_change': {'probability': 0.0325, 'condition': 'dealerA > 0'},
    'dealerB_change': {'probability': 0.0325, 'condition': 'dealerB > 0'},
    'supportA_change': {'probability': 0.0325, 'condition': 'supportA > 0'},
    'supportB_change': {'probability': 0.0325, 'condition': 'supportB > 0'},
    
    'cost_+100': {'probability': 0.0175, 'condition': 'costModifier < 100 && remainingAttempts > 1'},
    'cost_-100': {'probability': 0.0175, 'condition': 'costModifier > -100 && remainingAttempts > 1'},
    
    'maintain': {'probability': 0.0175, 'condition': 'always'},
    'reroll_+1': {'probability': 0.0250, 'condition': 'remainingAttempts > 1'},
    'reroll_+2': {'probability': 0.0075, 'condition': 'remainingAttempts > 1'}
}

# 목표 정의 중앙화 (확장 가능한 구조)
# 공유 설정 파일에서 타겟 설정 로드
def load_targets_config():
    """공유 설정 파일에서 타겟 정의를 로드하고 람다 함수로 변환"""
    config_path = os.path.join(os.path.dirname(__file__), '../utils/targets.json')
    with open(config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)
    
    targets = {}
    target_configs = config['targets']
    
    def create_condition_function(condition_string):
        """조건 문자열에서 람다 함수를 동적으로 생성"""
        def evaluate_expression(gem):
            # 젬 속성을 지역 변수로 노출
            local_vars = {
                'willpower': gem.willpower,
                'corePoint': gem.corePoint,
                'dealerA': gem.dealerA or 0,
                'dealerB': gem.dealerB or 0,
                'supportA': gem.supportA or 0,
                'supportB': gem.supportB or 0,
            }
            try:
                # && 를 and로, || 를 or로 변환
                python_condition = condition_string.replace('&&', ' and ').replace('||', ' or ')
                return eval(python_condition, {"__builtins__": {}}, local_vars)
            except:
                return False
        return evaluate_expression
    
    # 각 타겟을 동적으로 생성된 람다 함수로 변환
    for target_name, target_info in target_configs.items():
        if 'condition' in target_info:
            targets[target_name] = create_condition_function(target_info['condition'])
    
    return targets, target_configs

TARGETS, TARGET_CONFIG = load_targets_config()

@dataclass
class GemState:
    willpower: int
    corePoint: int
    dealerA: int
    dealerB: int
    supportA: int
    supportB: int
    remainingAttempts: int
    currentRerollAttempts: int
    costModifier: int = 0
    isFirstProcessing: bool = False

def check_condition(condition: str, gem: GemState) -> bool:
    """조건을 확인하는 함수 (4개 옵션 시스템)"""
    if condition == 'always':
        return True
    
    # && 조건 처리
    if '&&' in condition:
        parts = [part.strip() for part in condition.split('&&')]
        return all(check_condition(part, gem) for part in parts)
    
    # 간단한 조건 파싱
    if condition == 'willpower < 5':
        return gem.willpower < 5
    elif condition == 'willpower < 4':
        return gem.willpower < 4
    elif condition == 'willpower < 3':
        return gem.willpower < 3
    elif condition == 'willpower < 2':
        return gem.willpower < 2
    elif condition == 'willpower > 1':
        return gem.willpower > 1
    elif condition == 'corePoint < 5':
        return gem.corePoint < 5
    elif condition == 'corePoint < 4':
        return gem.corePoint < 4
    elif condition == 'corePoint < 3':
        return gem.corePoint < 3
    elif condition == 'corePoint < 2':
        return gem.corePoint < 2
    elif condition == 'corePoint > 1':
        return gem.corePoint > 1
    # 4개 옵션 시스템
    elif condition == 'dealerA < 5':
        return gem.dealerA < 5
    elif condition == 'dealerA < 4':
        return gem.dealerA < 4
    elif condition == 'dealerA < 3':
        return gem.dealerA < 3
    elif condition == 'dealerA < 2':
        return gem.dealerA < 2
    elif condition == 'dealerA > 1':
        return gem.dealerA > 1
    elif condition == 'dealerA > 0':
        return gem.dealerA > 0
    elif condition == 'dealerB < 5':
        return gem.dealerB < 5
    elif condition == 'dealerB < 4':
        return gem.dealerB < 4
    elif condition == 'dealerB < 3':
        return gem.dealerB < 3
    elif condition == 'dealerB < 2':
        return gem.dealerB < 2
    elif condition == 'dealerB > 1':
        return gem.dealerB > 1
    elif condition == 'dealerB > 0':
        return gem.dealerB > 0
    elif condition == 'supportA < 5':
        return gem.supportA < 5
    elif condition == 'supportA < 4':
        return gem.supportA < 4
    elif condition == 'supportA < 3':
        return gem.supportA < 3
    elif condition == 'supportA < 2':
        return gem.supportA < 2
    elif condition == 'supportA > 1':
        return gem.supportA > 1
    elif condition == 'supportA > 0':
        return gem.supportA > 0
    elif condition == 'supportB < 5':
        return gem.supportB < 5
    elif condition == 'supportB < 4':
        return gem.supportB < 4
    elif condition == 'supportB < 3':
        return gem.supportB < 3
    elif condition == 'supportB < 2':
        return gem.supportB < 2
    elif condition == 'supportB > 1':
        return gem.supportB > 1
    elif condition == 'supportB > 0':
        return gem.supportB > 0
    elif 'costModifier' in condition:
        if '< 100' in condition:
            return gem.costModifier < 100
        else:
            return gem.costModifier > -100
    elif condition == 'remainingAttempts > 1':
        return gem.remainingAttempts > 1
    
    return False

def get_available_options(gem: GemState) -> list:
    """사용 가능한 옵션들과 그 확률, 설명을 반환"""
    options = []
    
    # 옵션별 설명 매핑 (4개 옵션 시스템)
    descriptions = {
        'willpower_+1': '의지력 +1',
        'willpower_+2': '의지력 +2', 
        'willpower_+3': '의지력 +3',
        'willpower_+4': '의지력 +4',
        'willpower_-1': '의지력 -1',
        'corePoint_+1': '질서/혼돈 +1',
        'corePoint_+2': '질서/혼돈 +2',
        'corePoint_+3': '질서/혼돈 +3',
        'corePoint_+4': '질서/혼돈 +4',
        'corePoint_-1': '질서/혼돈 -1',
        'dealerA_+1': '딜러A 옵션 +1',
        'dealerA_+2': '딜러A 옵션 +2',
        'dealerA_+3': '딜러A 옵션 +3', 
        'dealerA_+4': '딜러A 옵션 +4',
        'dealerA_-1': '딜러A 옵션 -1',
        'dealerB_+1': '딜러B 옵션 +1',
        'dealerB_+2': '딜러B 옵션 +2',
        'dealerB_+3': '딜러B 옵션 +3',
        'dealerB_+4': '딜러B 옵션 +4', 
        'dealerB_-1': '딜러B 옵션 -1',
        'supportA_+1': '서폿A 옵션 +1',
        'supportA_+2': '서폿A 옵션 +2',
        'supportA_+3': '서폿A 옵션 +3', 
        'supportA_+4': '서폿A 옵션 +4',
        'supportA_-1': '서폿A 옵션 -1',
        'supportB_+1': '서폿B 옵션 +1',
        'supportB_+2': '서폿B 옵션 +2',
        'supportB_+3': '서폿B 옵션 +3',
        'supportB_+4': '서폿B 옵션 +4', 
        'supportB_-1': '서폿B 옵션 -1',
        'dealerA_change': '딜러A 옵션 변경',
        'dealerB_change': '딜러B 옵션 변경',
        'supportA_change': '서폿A 옵션 변경',
        'supportB_change': '서폿B 옵션 변경',
        'cost_+100': '가공 비용 +100',
        'cost_-100': '가공 비용 -100',
        'maintain': '현재 상태 유지',
        'reroll_+1': '리롤 횟수 +1',
        'reroll_+2': '리롤 횟수 +2'
    }
    
    for action, config in PROCESSING_POSSIBILITIES.items():
        if check_condition(config['condition'], gem):
            options.append({
                'action': action,
                'probability': config['probability'],
                'description': descriptions.get(action, action)
            })
    return options

def apply_processing(gem: GemState, action: str, target_option: str = None) -> GemState: # type: ignore
    """가공 옵션을 적용하여 새로운 젬 상태를 반환 (4개 옵션 시스템)
    
    Args:
        gem: 현재 젬 상태
        action: 적용할 액션
        target_option: 옵션 변경 시 타겟 옵션 (None이면 랜덤 선택)
    """
    
    new_gem = GemState(
        willpower=gem.willpower,
        corePoint=gem.corePoint,
        dealerA=gem.dealerA,
        dealerB=gem.dealerB,
        supportA=gem.supportA,
        supportB=gem.supportB,
        remainingAttempts=max(0, gem.remainingAttempts - 1),
        currentRerollAttempts=gem.currentRerollAttempts,
        costModifier=gem.costModifier,
        isFirstProcessing=False  # 가공 후에는 항상 False
    )
    
    # 액션 적용
    if action.startswith('willpower_'):
        if '+' in action:
            change = int(action.split('+')[1])
            new_gem.willpower = min(5, new_gem.willpower + change)
        elif '-' in action:
            change = int(action.split('-')[1])
            new_gem.willpower = max(1, new_gem.willpower - change)
    elif action.startswith('corePoint_'):
        if '+' in action:
            change = int(action.split('+')[1])
            new_gem.corePoint = min(5, new_gem.corePoint + change)
        elif '-' in action:
            change = int(action.split('-')[1])
            new_gem.corePoint = max(1, new_gem.corePoint - change)
    elif action.startswith('dealerA_'):
        if '+' in action:
            change = int(action.split('+')[1])
            new_gem.dealerA = min(5, new_gem.dealerA + change)
        elif '-' in action:
            change = int(action.split('-')[1])
            new_gem.dealerA = max(1, new_gem.dealerA - change)
    elif action.startswith('dealerB_'):
        if '+' in action:
            change = int(action.split('+')[1])
            new_gem.dealerB = min(5, new_gem.dealerB + change)
        elif '-' in action:
            change = int(action.split('-')[1])
            new_gem.dealerB = max(1, new_gem.dealerB - change)
    elif action.startswith('supportA_'):
        if '+' in action:
            change = int(action.split('+')[1])
            new_gem.supportA = min(5, new_gem.supportA + change)
        elif '-' in action:
            change = int(action.split('-')[1])
            new_gem.supportA = max(1, new_gem.supportA - change)
    elif action.startswith('supportB_'):
        if '+' in action:
            change = int(action.split('+')[1])
            new_gem.supportB = min(5, new_gem.supportB + change)
        elif '-' in action:
            change = int(action.split('-')[1])
            new_gem.supportB = max(1, new_gem.supportB - change)
    elif action.startswith('cost_'):
        if '+' in action:
            change = int(action.split('+')[1])
            new_gem.costModifier = min(100, new_gem.costModifier + change)
        elif '-' in action:
            change = int(action.split('-')[1])
            new_gem.costModifier = max(-100, new_gem.costModifier - change)
    elif action.startswith('reroll_'):
        change = int(action.split('+')[1])
        # 실제 리롤 횟수는 제한 없이 증가 가능 (메모이제이션 키에서만 제한)
        new_gem.currentRerollAttempts = new_gem.currentRerollAttempts + change
    elif action.endswith('_change'):
        # 모든 옵션 변경 액션 통합 처리
        changing_option = action.replace('_change', '')
        current_options = ['dealerA', 'dealerB', 'supportA', 'supportB']
        inactive_options = [opt for opt in current_options if getattr(new_gem, opt) == 0]
        
        if inactive_options and hasattr(new_gem, changing_option):
            current_level = getattr(new_gem, changing_option)
            if target_option and target_option in inactive_options:
                # 지정된 타겟 옵션 사용
                setattr(new_gem, changing_option, 0)
                setattr(new_gem, target_option, current_level)
            else:
                # 랜덤 선택 (기존 방식)
                random_inactive = random.choice(inactive_options)
                setattr(new_gem, changing_option, 0)
                setattr(new_gem, random_inactive, current_level)
    
    return new_gem

def calculate_4combo_probability(combo_indices: List[int], all_weights: List[float]) -> float:
    """특정 4개 조합이 뽑힐 확률을 계산 (순서 고려)"""
    combo_total_prob = 0.0
    
    # 4개를 뽑는 모든 순서 고려
    for perm in permutations(combo_indices):
        perm_prob = 1.0
        remaining_weights = all_weights.copy()
        remaining_total = sum(remaining_weights)
        
        # 순서대로 뽑을 확률 계산
        for option_idx in perm:
            if remaining_total <= 0 or remaining_weights[option_idx] <= 0:
                perm_prob = 0
                break
            
            perm_prob *= remaining_weights[option_idx] / remaining_total
            remaining_total -= remaining_weights[option_idx] 
            remaining_weights[option_idx] = 0
        
        combo_total_prob += perm_prob
    
    return combo_total_prob

# 진행 상황 추적을 위한 변수 (병렬 환경에서는 메인 프로세스에서만 사용)
start_time = None

def create_generalized_gem_pattern(gem: GemState) -> str:
    """젬 상태를 일반화된 패턴으로 변환 (효과적인 메모이제이션을 위해)"""
    # dealer/support 값들을 정렬하여 effect1, effect2로 정규화
    effects = sorted([gem.dealerA, gem.dealerB, gem.supportA, gem.supportB], reverse=True)
    effect1, effect2 = effects[0], effects[1]  # 상위 2개만 사용 (effect3, 4는 항상 0)
    
    # remainingAttempts는 1보다 큰지만 확인
    has_attempts = 1 if gem.remainingAttempts > 1 else 0
    
    return f"{gem.willpower},{gem.corePoint},{effect1},{effect2},{has_attempts},{gem.costModifier}"

def state_to_key(gem: GemState) -> str:
    """젬 상태를 키 문자열로 변환 (4개 옵션 시스템, 리롤 횟수는 상한까지만)"""
    # 리롤 횟수는 상한 이상을 모두 상한으로 간주 (메모이제이션 효율성)
    capped_reroll = min(MAX_REROLL_ATTEMPTS, gem.currentRerollAttempts)
    first_processing = 1 if gem.isFirstProcessing else 0
    return f"{gem.willpower},{gem.corePoint},{gem.dealerA},{gem.dealerB},{gem.supportA},{gem.supportB},{gem.remainingAttempts},{capped_reroll},{gem.costModifier},{first_processing}"

def check_target_conditions(gem: GemState) -> Dict[str, bool]:
    """현재 젬 상태에서 각 목표 달성 여부 확인 (동적 생성)"""
    return {target_name: target_func(gem) for target_name, target_func in TARGETS.items()}

def calculate_combo_probabilities_for_gem(gem: GemState, available_options: List[Dict], combo_memo: Dict[str, Dict]) -> Dict:
    """현재 젬 상태에 대한 4combo 확률 계산 및 메모이제이션"""
    generalized_gem_pattern = create_generalized_gem_pattern(gem)
    
    # 조합 확률들 계산 또는 캐시에서 가져오기
    combo_probs = {}
    if generalized_gem_pattern in combo_memo:
        # 캐시된 조합 확률들 사용
        return combo_memo[generalized_gem_pattern]
    
    # dealer/support를 effect로 매핑하기 위한 준비
    effect_mapping = {}
    effect_idx = 1
    
    # 레벨 높은 순서로 effect 번호 할당
    for name, level in sorted(
        [('dealerA', gem.dealerA), ('dealerB', gem.dealerB), 
         ('supportA', gem.supportA), ('supportB', gem.supportB)],
        key=lambda x: -x[1]  # 레벨 내림차순
    ):
        if level > 0:
            effect_mapping[name] = f'effect{effect_idx}'
            effect_idx += 1
    
    # 새로운 젬 패턴 - 모든 4개 조합 확률 미리 계산
    for combo_indices in combinations(range(len(available_options)), 4):
        combo_prob = calculate_4combo_probability(
            list(combo_indices), 
            [opt['probability'] for opt in available_options]
        )
        
        # 액션 이름을 정규화 (dealerA -> effect1 등)
        normalized_actions = []
        for i in combo_indices:
            action = available_options[i]['action']
            # dealerA_+1 -> effect1_+1 형태로 변환
            for original, normalized in effect_mapping.items():
                action = action.replace(original, normalized)
            normalized_actions.append(action)
        
        combo_actions = tuple(sorted(normalized_actions))
        combo_probs[combo_actions] = combo_prob
    
    # 조합 확률들을 메모이제이션에 저장
    combo_memo[generalized_gem_pattern] = combo_probs
    return combo_probs

def calculate_percentiles_from_combo_data(target_combo_data: Dict[str, List]) -> Dict[str, Dict]:
    """combo 데이터로부터 퍼센타일 계산"""
    target_percentiles = {}
    for target, combo_data in target_combo_data.items():
        if not combo_data:
            target_percentiles[target] = {10: 0.0, 20: 0.0, 30: 0.0, 40: 0.0, 50: 0.0, 
                                         60: 0.0, 70: 0.0, 80: 0.0, 90: 0.0}
            continue
            
        # combo_progress_value 기준으로 내림차순 정렬
        sorted_combos = sorted(combo_data, key=lambda x: x[0], reverse=True)
        
        # 퍼센타일 계산 (10%, 20%, ..., 90%)
        cumulative = 0.0
        percentile_values = {}
        percentile_thresholds = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
        threshold_idx = 0
        
        for combo_value, combo_prob in sorted_combos:
            cumulative += combo_prob
            
            # 현재 누적확률이 다음 threshold를 넘었는지 확인
            while threshold_idx < len(percentile_thresholds) and cumulative >= percentile_thresholds[threshold_idx]:
                percentile_values[int(percentile_thresholds[threshold_idx] * 100)] = combo_value
                threshold_idx += 1
            
            if threshold_idx >= len(percentile_thresholds):
                break
        
        # 남은 percentile들은 마지막 값으로 채움
        last_value = sorted_combos[-1][0] if sorted_combos else 0.0
        for i in range(threshold_idx, len(percentile_thresholds)):
            percentile_values[int(percentile_thresholds[i] * 100)] = last_value
        
        target_percentiles[target] = percentile_values
    
    return target_percentiles

def calculate_probabilities(gem: GemState, memo: Dict[str, Dict], combo_memo: Dict[str, Dict], verbose=True) -> Dict[str, Dict]:
    """재귀적으로 확률을 계산. 매우 중요: 여기서의 확률은 아직 옵션 4개를 보지 못한 상태임"""
    key = state_to_key(gem)
    if key in memo:
        return memo[key]
    
    # 목표 조건들 확인
    targets = check_target_conditions(gem)
    
    # 현재 상태에서 각 목표 달성 여부를 기본값으로 설정
    # (이미 달성한 목표는 확률 1.0으로 시작)
    base_probabilities = {}
    for target, achieved in targets.items():
        base_probabilities[target] = 1.0 if achieved else 0.0
    
    # 사용 가능한 옵션들 가져오기 (설명도 포함)
    available_options = get_available_options(gem)
    
    # 기저 조건: 남은 시도 횟수가 0 또는 사용 가능한 옵션이 없음
    if gem.remainingAttempts == 0 or not available_options:
        # 기저 조건에서는 퍼센타일이 모두 현재 확률과 동일
        base_percentiles = {}
        for target in targets:
            base_prob = base_probabilities[target]
            # 10%, 20%, ..., 90% 모두 동일한 값
            base_percentiles[target] = {10: base_prob, 20: base_prob, 30: base_prob, 
                                        40: base_prob, 50: base_prob, 60: base_prob,
                                        70: base_prob, 80: base_prob, 90: base_prob}
        
        # Terminal 상태에서는 모든 목표의 기대 비용이 0
        terminal_expected_costs = {}
        for target in targets:
            terminal_expected_costs[target] = 0.0
        
        memo[key] = {
            'probabilities': base_probabilities,
            'availableOptions': available_options,
            'percentiles': base_percentiles,
            'expectedCosts': terminal_expected_costs
        }
        # 새로운 계산 완료 시 진행 상황 출력 (병렬 환경에서는 단순화)
        if verbose:
            current_time = time.strftime("%H:%M:%S")
            print(f"기저 조건 계산: ({key}) - {current_time} "
                  f"8+: {base_probabilities.get('sum8+', 0):.6f}, 9+: {base_probabilities.get('sum9+', 0):.6f}, "
                  f"r+: {base_probabilities.get('relic+', 0):.6f}, a+: {base_probabilities.get('ancient+', 0):.6f}, "
                  f"d_comp: {base_probabilities.get('dealer_complete', 0):.6f}, s_comp: {base_probabilities.get('support_complete', 0):.6f}")

        return memo[key]
    
    # 실제 게임 로직: 4개 조합을 뽑고 그 중 하나를 25% 확률로 선택
    probabilities = {target: 0.0 for target in targets}
    expected_costs = {target: 0.0 for target in targets}
    
    # reroll이 가능한지 확인 (첫 시도에서는 불가능)
    can_reroll = gem.currentRerollAttempts > 0 and gem.remainingAttempts > 0 and not gem.isFirstProcessing
    
    # 리롤 후 상태 미리 준비
    rerolled_gem = None
    reroll_future_probs = None
    if can_reroll:
        actual_reroll_after = gem.currentRerollAttempts - 1
        rerolled_gem = GemState(
            willpower=gem.willpower,
            corePoint=gem.corePoint,
            dealerA=gem.dealerA,
            dealerB=gem.dealerB,
            supportA=gem.supportA,
            supportB=gem.supportB,
            remainingAttempts=gem.remainingAttempts,
            currentRerollAttempts=actual_reroll_after,
            costModifier=gem.costModifier,
            isFirstProcessing=False  # 리롤 후는 당연히 첫 가공이 아닌 상태임
        )
        reroll_future_data = calculate_probabilities(rerolled_gem, memo, combo_memo, verbose)
        reroll_future_probs = reroll_future_data['probabilities']
        reroll_future_costs = reroll_future_data['expectedCosts']
        
    # 모든 4개 조합에 대해 실제 확률 계산
    # 4combo 확률 계산 (메모이제이션 포함)
    combo_probs = calculate_combo_probabilities_for_gem(gem, available_options, combo_memo)
    
    # 역매핑 준비 (effect1 -> dealerA 등)
    reverse_mapping = {}
    effect_idx = 1
    for name, level in sorted(
        [('dealerA', gem.dealerA), ('dealerB', gem.dealerB), 
         ('supportA', gem.supportA), ('supportB', gem.supportB)],
        key=lambda x: -x[1]  # 레벨 내림차순
    ):
        if level > 0:
            reverse_mapping[f'effect{effect_idx}'] = name
            effect_idx += 1
            
    # target별로 combo 데이터를 저장 (퍼센타일 계산용)
    target_combo_data = {target: [] for target in targets}
    
    for combo_key, combo_prob in combo_probs.items():
        # combo_key는 항상 정규화된 액션 튜플
        combo_options = []
        
        for normalized_action in combo_key:
            # effect1_+1 -> dealerA_+1 형태로 역변환
            actual_action = normalized_action
            for effect_name, original_name in reverse_mapping.items():
                actual_action = actual_action.replace(effect_name, original_name)
            
            # 실제 옵션 찾기
            for opt in available_options:
                if opt['action'] == actual_action:
                    combo_options.append(opt)
                    break
        
        # 이 조합의 각 옵션별 미래 확률과 cost 계산
        combo_future_probs = {}
        combo_future_costs = {}
        for option in combo_options:
            # 옵션 변경 액션인 경우 특별 처리
            if option['action'].endswith('_change'):                
                # 비활성 옵션들 찾기
                current_options = ['dealerA', 'dealerB', 'supportA', 'supportB']
                inactive_options = [opt for opt in current_options if getattr(gem, opt) == 0]
                
                if inactive_options:
                    # 각 가능한 타겟에 대한 확률과 비용 계산
                    all_target_probs = {target: 0.0 for target in check_target_conditions(gem)}
                    all_target_costs = {target: 0.0 for target in check_target_conditions(gem)}
                    
                    for target_opt in inactive_options:
                        next_gem = apply_processing(gem, option['action'], target_opt)
                        future_data = calculate_probabilities(next_gem, memo, combo_memo, verbose)
                        
                        # 균등 확률로 평균 계산
                        weight = 1.0 / len(inactive_options)
                        for target in all_target_probs:
                            all_target_probs[target] += future_data['probabilities'][target] * weight
                            all_target_costs[target] += future_data['expectedCosts'][target] * weight
                    
                    combo_future_probs[option['action']] = all_target_probs
                    combo_future_costs[option['action']] = all_target_costs
                else:
                    # 변경할 옵션이 없으면 현재 상태 유지
                    next_gem = apply_processing(gem, option['action'])
                    future_data = calculate_probabilities(next_gem, memo, combo_memo, verbose)
                    combo_future_probs[option['action']] = future_data['probabilities']
                    combo_future_costs[option['action']] = future_data['expectedCosts']
            else:
                # 일반 액션
                next_gem = apply_processing(gem, option['action'])
                future_data = calculate_probabilities(next_gem, memo, combo_memo, verbose)
                combo_future_probs[option['action']] = future_data['probabilities']
                combo_future_costs[option['action']] = future_data['expectedCosts']
        
        # 모든 target에 대해 이 조합의 기여도 계산
        for target in targets:
            # 현재 가공 비용 (costModifier 적용)
            processing_cost = PROCESSING_COST * (1 + gem.costModifier / 100)
            
            # 이 조합에서의 진행 확률과 cost (4개 중 균등 선택)
            combo_progress_value = 0.0
            combo_progress_cost = processing_cost  # 현재 가공 비용
            for option in combo_options:
                combo_progress_value += combo_future_probs[option['action']][target] * 0.25
                combo_progress_cost += combo_future_costs[option['action']][target] * 0.25
                        
            # 확률을 1.0으로 클램핑 (1 초과 방지)
            combo_progress_value = min(1.0, combo_progress_value)
            
            # 이 조합에서 최적 선택 (현재 상태에서 중단, 진행, 리롤 중) - 확률 기준
            combo_options_list = [base_probabilities[target], combo_progress_value]
            combo_costs_list = [0.0, combo_progress_cost]  # 현재 상태에서 중단하면 cost 0 (이미 달성)
            
            if can_reroll and reroll_future_probs:
                reroll_prob = min(1.0, reroll_future_probs[target])  # 리롤 확률도 클램핑
                combo_options_list.append(reroll_prob)
                combo_costs_list.append(processing_cost + reroll_future_costs[target])
            
            # 최적 선택 (가장 높은 확률)
            best_idx = combo_options_list.index(max(combo_options_list))
            combo_best = combo_options_list[best_idx]
            combo_best_cost = combo_costs_list[best_idx]
            
            probabilities[target] += combo_prob * combo_best
            expected_costs[target] += combo_prob * combo_best_cost
            
            # 퍼센타일 계산용 데이터 저장
            target_combo_data[target].append((combo_progress_value, combo_prob))
    
    # 각 target에 대한 퍼센타일 계산
    target_percentiles = calculate_percentiles_from_combo_data(target_combo_data)
    
    # 선택 확률 계산 (조합 확률 재사용)
    selection_probs = {opt['action']: 0.0 for opt in available_options}
    
    # combo_probs는 이제 정규화된 액션 튜플이 키이므로 역매핑 필요
    for combo_key, combo_prob in combo_probs.items():
        # combo_key는 정규화된 액션 튜플
        for normalized_action in combo_key:
            # effect1_+1 -> dealerA_+1 형태로 역변환
            actual_action = normalized_action
            for effect_name, original_name in reverse_mapping.items():
                actual_action = actual_action.replace(effect_name, original_name)
            
            # 선택 확률에 추가
            if actual_action in selection_probs:
                selection_probs[actual_action] += combo_prob * 0.25
    
    # availableOptions에 선택 확률 추가
    options_with_probs = []
    for option in available_options:
        options_with_probs.append({
            'action': option['action'],
            'probability': option['probability'],
            'description': option.get('description', ''),
            'selectionProbability': selection_probs[option['action']]  # 실제로 더 이상 리롤하지 않았을 때 선택될 확률
        })   
    
    # 결과를 memo에 저장
    memo[key] = {
        'probabilities': probabilities,
        'availableOptions': options_with_probs,
        'percentiles': target_percentiles,
        'expectedCosts': expected_costs
    }
       
    # 새로운 계산 완료 시 진행 상황 출력 (병렬 환경에서는 단순화)
    if verbose:
        current_time = time.strftime("%H:%M:%S")
        print(f"상태 계산 완료: ({key}) - {current_time} "
              f"8+: {probabilities.get('sum8+', 0):.6f}, 9+: {probabilities.get('sum9+', 0):.6f}, "
              f"r+: {probabilities.get('relic+', 0):.6f}, a+: {probabilities.get('ancient+', 0):.6f}, "
              f"d_comp: {probabilities.get('dealer_complete', 0):.6f}, s_comp: {probabilities.get('support_complete', 0):.6f}")
    
    # 전체 데이터 반환 (memo에 저장된 것과 동일)
    return memo[key]

# 워커 프로세스 전역 변수 (fork로 자동 공유됨)
worker_shared_memo = {}
worker_shared_combo = {}

# 병렬 처리를 위한 워커 함수
def process_batch(batch_data):
    """배치 단위로 상태들을 처리하는 워커 함수 (조용히)"""
    global worker_shared_memo, worker_shared_combo

    # 워커 전용 로컬 딕셔너리
    local_memo = {}
    local_combo_memo = {}

    # 병합된 뷰 생성 (복사 없이)
    class ChainedDict:
        def __init__(self, *dicts):
            self.dicts = dicts

        def __contains__(self, key):
            return any(key in d for d in self.dicts)

        def __getitem__(self, key):
            for d in self.dicts:
                if key in d:
                    return d[key]
            raise KeyError(key)

        def __setitem__(self, key, value):
            # 항상 첫 번째 딕셔너리(local)에만 저장
            self.dicts[0][key] = value

        def get(self, key, default=None):
            try:
                return self[key]
            except KeyError:
                return default

    # 체인 딕셔너리 생성 (로컬 먼저, shared는 읽기 전용 백업)
    chained_memo = ChainedDict(local_memo, worker_shared_memo)
    chained_combo_memo = ChainedDict(local_combo_memo, worker_shared_combo)

    for gem_state in batch_data:
        key = state_to_key(gem_state)
        if key not in chained_memo:
            # 계산 (chained_memo를 일반 dict처럼 사용)
            _ = calculate_probabilities(gem_state, chained_memo, chained_combo_memo, verbose=False) # type: ignore

    # 새로 계산된 결과들만 반환 (local_memo에 있는 것들)
    results = list(local_memo.items())
    combo_results = list(local_combo_memo.items())

    return results, combo_results

def values_equal(val1, val2, tolerance=1e-10):
    """두 계산 결과가 허용 오차 내에서 동일한지 확인"""
    # probabilities 딕셔너리 비교
    for target in val1['probabilities']:
        if target not in val2['probabilities']:
            return False
        diff = abs(val1['probabilities'][target] - val2['probabilities'][target])
        if diff > tolerance:
            return False

    # expectedCosts 딕셔너리 비교
    for target in val1['expectedCosts']:
        if target not in val2['expectedCosts']:
            return False
        diff = abs(val1['expectedCosts'][target] - val2['expectedCosts'][target])
        if diff > tolerance:
            return False

    return True

def combo_dicts_equal(dict1, dict2, tolerance=1e-6):
    """두 콤보 딕셔너리가 허용 오차 내에서 동일한지 확인"""
    if set(dict1.keys()) != set(dict2.keys()):
        return False

    for key in dict1:
        if abs(dict1[key] - dict2[key]) > tolerance:
            return False

    return True

def merge_results_with_validation(shared_memo, shared_combo_memo, batch_results, tolerance=1e-6):
    """워커 결과들을 무결성 검증하면서 병합"""
    conflicts = []
    combo_conflicts = []
    updates_to_apply = {}
    combo_updates_to_apply = {}

    # 통계 수집
    total_results_from_batches = 0
    total_combo_results_from_batches = 0

    # 배치 간 중복 키 검증: 여러 워커가 같은 상태를 연쇄 계산했을 때 일관성 확인
    for results, combo_results in batch_results:
        total_results_from_batches += len(results)
        total_combo_results_from_batches += len(combo_results)
        # 메인 메모 결과 처리
        for key, value in results:
            if key in updates_to_apply:
                # 이미 다른 워커에서 계산한 결과와 비교
                existing_value = updates_to_apply[key]
                if not values_equal(existing_value, value, tolerance):
                    conflicts.append({
                        'key': key,
                        'worker1_prob_sample': list(existing_value['probabilities'].values())[:3],
                        'worker2_prob_sample': list(value['probabilities'].values())[:3]
                    })
            else:
                updates_to_apply[key] = value

        # 콤보 메모 결과 처리
        for key, value in combo_results:
            if key in combo_updates_to_apply:
                # 콤보 메모는 딕셔너리 구조이므로 각 항목별로 비교
                existing_combo_dict = combo_updates_to_apply[key]
                if not combo_dicts_equal(existing_combo_dict, value, tolerance):
                    combo_conflicts.append({
                        'key': key,
                        'worker1_sample': list(existing_combo_dict.items())[:2],
                        'worker2_sample': list(value.items())[:2]
                    })
            else:
                combo_updates_to_apply[key] = value

    # 병합 통계 출력
    print(f"📊 병합 통계: 배치 결과 {total_results_from_batches}개 → 고유 {len(updates_to_apply)}개 "
          f"(중복 {total_results_from_batches - len(updates_to_apply)}개)")
    print(f"📊 콤보 통계: 배치 결과 {total_combo_results_from_batches}개 → 고유 {len(combo_updates_to_apply)}개 "
          f"(중복 {total_combo_results_from_batches - len(combo_updates_to_apply)}개)")

    # Manager 딕셔너리에 한 번에 업데이트
    if updates_to_apply:
        shared_memo.update(updates_to_apply)
    if combo_updates_to_apply:
        shared_combo_memo.update(combo_updates_to_apply)

    # 충돌 보고
    if conflicts:
        print(f"⚠️  워커 간 {len(conflicts)}개 메모 결과 불일치 발견 (tolerance={tolerance})")
        for i, conflict in enumerate(conflicts[:3]):  # 처음 3개만 표시
            print(f"  충돌 {i+1}: {conflict['key'][:50]}...")
            print(f"    워커1: {conflict['worker1_prob_sample']}")
            print(f"    워커2: {conflict['worker2_prob_sample']}")
        if len(conflicts) > 3:
            print(f"  ... 외 {len(conflicts)-3}개")

    if combo_conflicts:
        print(f"⚠️  워커 간 {len(combo_conflicts)}개 콤보 결과 불일치 발견 (tolerance={tolerance})")
        for i, conflict in enumerate(combo_conflicts[:3]):
            print(f"  콤보 충돌 {i+1}: {conflict['key'][:30]}...")
            print(f"    워커1: {conflict['worker1_sample']}")
            print(f"    워커2: {conflict['worker2_sample']}")

    return len(updates_to_apply)


def load_existing_progress(db_path):
    """기존 진행 상황을 DB에서 로드"""
    if not os.path.exists(db_path):
        return {}, {}

    print(f"📂 기존 진행 상황을 로드 중: {db_path}")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 테이블 존재 여부 확인
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='goal_probabilities'")
    if not cursor.fetchone():
        conn.close()
        return {}, {}

    memo = {}

    # 동적으로 확률 컬럼명 생성
    prob_columns = []
    for target_name in TARGETS.keys():
        column_name = TARGET_CONFIG[target_name]['columnName']
        prob_columns.append(f"prob_{column_name}")

    prob_columns_str = ", ".join(prob_columns)

    # 기존 데이터 로드 (모든 데이터 포함)
    cursor.execute(f"""
        SELECT willpower, corePoint, dealerA, dealerB, supportA, supportB,
               remainingAttempts, currentRerollAttempts, costModifier, isFirstProcessing,
               {prob_columns_str}
        FROM goal_probabilities
    """)

    loaded_count = 0
    for row in cursor.fetchall():
        wp, cp, dA, dB, sA, sB, attempts, reroll, cost, isFirst = row[:10]
        prob_values = row[10:]

        state_key = f"{wp},{cp},{dA},{dB},{sA},{sB},{attempts},{reroll},{cost},{isFirst}"

        # 확률 데이터 복원
        probabilities = {}
        for i, (target_name, _) in enumerate(TARGETS.items()):
            probabilities[target_name] = prob_values[i]

        # 완전한 상태 데이터 저장 (availableOptions, percentiles, expectedCosts는 일단 기본값). Todo임
        memo[state_key] = {
            "probabilities": probabilities,
            "availableOptions": [],
            "percentiles": {target: {10: 0.0, 20: 0.0, 30: 0.0, 40: 0.0, 50: 0.0,
                                   60: 0.0, 70: 0.0, 80: 0.0, 90: 0.0} for target in TARGETS.keys()},
            "expectedCosts": {target: 0.0 for target in TARGETS.keys()}
        }
        loaded_count += 1

    conn.close()
    print(f"✅ {loaded_count}개 상태 로드 완료")
    return memo, {}

def save_progress_to_db(shared_memo, db_path, saved_keys, is_final=False):
    """현재 진행 상황을 DB에 저장 (증분 저장)"""
    if not shared_memo:
        return saved_keys

    memo_dict = dict(shared_memo)
    new_keys = set(memo_dict.keys()) - saved_keys
    new_items = {k: memo_dict[k] for k in new_keys}

    if new_items:
        print(f"💾 {'최종' if is_final else '중간'} 결과 저장 중...")

        # 스키마 생성
        create_database_schema(db_path)

        # 새로운 항목만 저장
        save_to_database(new_items, db_path)
        saved_keys.update(new_keys)
        print(f"💾 {len(new_items)}개 새로운 상태 저장 완료")

    return saved_keys

def _generate_probability_table_parallel(num_workers=None, resume_db_path=None):
    """병렬 확률 테이블 생성 (중간 저장 및 재시작 지원)"""
    if num_workers is None:
        num_workers = mp.cpu_count()

    print(f"🚀 {num_workers}개 코어를 사용한 병렬 계산 시작...")

    start_time = time.time()

    # 기존 진행 상황 로드
    shared_memo, shared_combo_memo = {}, {}
    if resume_db_path and os.path.exists(resume_db_path):
        shared_memo, shared_combo_memo = load_existing_progress(resume_db_path)

    # 전역 변수로 설정 (fork 시점에 COW로 자동 공유)
    global worker_shared_memo, worker_shared_combo
    worker_shared_memo = shared_memo
    worker_shared_combo = shared_combo_memo

    # 저장된 키들 추적
    saved_keys = set(shared_memo.keys())  # 기존에 로드된 키들은 이미 저장됨

    total_states = 0

    # 레벨별로 상태들을 그룹화 (currentRerollAttempts, remainingAttempts)
    states_by_level = {}

    # 모든 가능한 상태 생성 및 레벨별 그룹화
    for currentRerollAttempts in range(MAX_REROLL_ATTEMPTS + 1):
        for remainingAttempts in range(10):
            level_key = (currentRerollAttempts, remainingAttempts)
            states_by_level[level_key] = []

            for costModifier in [-100, 0, 100]:
                for willpower in range(1, 6):
                    for corePoint in range(1, 6):
                        for dealerA in range(0, 6):
                            for dealerB in range(0, 6):
                                for supportA in range(0, 6):
                                    for supportB in range(0, 6):
                                        non_zero_count = sum(1 for x in [dealerA, dealerB, supportA, supportB] if x > 0)
                                        if non_zero_count != 2:
                                            continue

                                        total_values = willpower + corePoint + dealerA + dealerB + supportA + supportB
                                        is_valid_first = (
                                            total_values == 4 and
                                            costModifier == 0 and
                                            (remainingAttempts, currentRerollAttempts) in VALID_FIRST_PROCESSING_COMBINATIONS
                                        )
                                        possible_first = [True, False] if is_valid_first else [False]

                                        for isFirstProcessing in possible_first:
                                            gem = GemState(
                                                willpower=willpower,
                                                corePoint=corePoint,
                                                dealerA=dealerA,
                                                dealerB=dealerB,
                                                supportA=supportA,
                                                supportB=supportB,
                                                remainingAttempts=remainingAttempts,
                                                currentRerollAttempts=currentRerollAttempts,
                                                costModifier=costModifier,
                                                isFirstProcessing=isFirstProcessing
                                            )
                                            states_by_level[level_key].append(gem)
                                            total_states += 1

    print(f"📊 총 {total_states}개 상태를 처리합니다.")

    # 레벨별로 순차 처리 (의존성 때문에)
    for currentRerollAttempts in range(MAX_REROLL_ATTEMPTS + 1):
        for remainingAttempts in range(10):
            level_key = (currentRerollAttempts, remainingAttempts)
            level_states = states_by_level[level_key]

            if not level_states:
                continue

            # 이미 계산된 상태들 필터링
            pending_states = []
            skipped_count = 0
            for state in level_states:
                state_key = state_to_key(state)
                if state_key not in shared_memo:
                    pending_states.append(state)
                else:
                    skipped_count += 1

            if not pending_states:
                if skipped_count > 0:
                    print(f"레벨 ({currentRerollAttempts}, {remainingAttempts}): {skipped_count}개 상태 이미 완료 (건너뜀)")
                continue

            print(f"레벨 ({currentRerollAttempts}, {remainingAttempts}): {len(pending_states)}개 상태 처리 중... (건너뜀: {skipped_count}개)")

            # 현재 레벨의 미완료 상태들을 배치로 나눔
            batch_size = max(1, len(pending_states) // num_workers)
            batches = [pending_states[i:i+batch_size] for i in range(0, len(pending_states), batch_size)]

            new_results_count = 0

            # 모든 배치를 워커 프로세스들이 처리 (조용히)
            with Pool(processes=num_workers) as pool:
                batch_results = pool.map(process_batch, batches)

            # 워커 결과를 무결성 검증하면서 공유 메모에 병합
            new_results_count = merge_results_with_validation(shared_memo, shared_combo_memo, batch_results)

            # 중간 저장 (매 레벨마다)
            if resume_db_path and new_results_count > 0:
                saved_keys = save_progress_to_db(shared_memo, resume_db_path, saved_keys, is_final=False)

            # 진행 상황 출력
            processed = len(shared_memo)
            elapsed = time.time() - start_time
            current_time = time.strftime("%H:%M:%S")
            print(f"진행: {processed}/{total_states} ({processed/total_states*100:.1f}%) - {elapsed:.1f}초 경과 - {current_time} (새로 계산: {new_results_count}개)")

    # 최종 결과를 일반 딕셔너리로 변환
    final_memo = dict(shared_memo)

    elapsed_time = time.time() - start_time
    print(f"\n✅ 병렬 계산 완료!")
    print(f"총 {len(final_memo)}개 상태 계산")
    print(f"소요 시간: {elapsed_time:.1f}초")
    print(f"평균 속도: {len(final_memo)/elapsed_time:.0f} 상태/초")

    return final_memo

def generate_probability_table(shared_memo=None, shared_combo_memo=None):
    """순차 확률 테이블 생성 (메모이제이션 공유 가능)"""
    print("🎲 확률 테이블 생성 시작...")

    # 전역 카운터 초기화
    start_time = time.time()

    # 메모이제이션 초기화 또는 외부에서 제공받은 것 사용
    if shared_memo is None:
        memo = {}
    else:
        memo = shared_memo
    if shared_combo_memo is None:
        combo_memo = {}
    else:
        combo_memo = shared_combo_memo
    total_states = 0

    # 모든 가능한 상태 순회
    for currentRerollAttempts in range(MAX_REROLL_ATTEMPTS + 1):
        for remainingAttempts in range(10):
            for costModifier in [-100, 0, 100]:
                for willpower in range(1, 6):
                    for corePoint in range(1, 6):
                        for dealerA in range(0, 6):
                            for dealerB in range(0, 6):
                                for supportA in range(0, 6):
                                    for supportB in range(0, 6):
                                        # 4개 옵션 중 정확히 2개만 0이 아니어야 함
                                        non_zero_count = sum(1 for x in [dealerA, dealerB, supportA, supportB] if x > 0)
                                        if non_zero_count != 2:
                                            continue

                                        # isFirstProcessing=True 조건
                                        total_values = willpower + corePoint + dealerA + dealerB + supportA + supportB
                                        is_valid_first = (
                                            total_values == 4 and
                                            costModifier == 0 and
                                            (remainingAttempts, currentRerollAttempts) in VALID_FIRST_PROCESSING_COMBINATIONS
                                        )
                                        possible_first = [True, False] if is_valid_first else [False]
                                        for isFirstProcessing in possible_first:
                                            try:
                                                gem = GemState(
                                                    willpower=willpower,
                                                    corePoint=corePoint,
                                                    dealerA=dealerA,
                                                    dealerB=dealerB,
                                                    supportA=supportA,
                                                    supportB=supportB,
                                                    remainingAttempts=remainingAttempts,
                                                    currentRerollAttempts=currentRerollAttempts,
                                                    costModifier=costModifier,
                                                    isFirstProcessing=isFirstProcessing
                                                )
                                                # 확률 계산
                                                _ = calculate_probabilities(gem, memo, combo_memo, verbose=True)
                                                total_states += 1

                                            except Exception as e:
                                                print(f"\n❌ 에러 발생!")
                                                print(f"에러 메시지: {e}")
                                                raise

    end_time = time.time()
    elapsed_time = end_time - start_time

    print(f"\n✅ 완료!")
    print(f"총 {total_states}개 상태 계산 완료")
    print(f"소요 시간: {elapsed_time:.1f}초")
    print(f"평균 계산 속도: {total_states/elapsed_time:.0f} 상태/초")

    return memo

def create_database_schema(db_path: str):
    """SQLite 데이터베이스 스키마 생성 (동적 컬럼 생성)"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 동적으로 확률 컬럼 생성 (공유 설정의 컬럼명 사용)
    prob_columns = []
    for target_name in TARGETS.keys():
        column_name = TARGET_CONFIG[target_name]['columnName']
        prob_columns.append(f"prob_{column_name} REAL NOT NULL")
    
    prob_columns_str = ",\n            ".join(prob_columns)
    
    # 목표별 확률 테이블
    cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS goal_probabilities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            willpower INTEGER NOT NULL,
            corePoint INTEGER NOT NULL,
            dealerA INTEGER NOT NULL,
            dealerB INTEGER NOT NULL,
            supportA INTEGER NOT NULL,
            supportB INTEGER NOT NULL,
            remainingAttempts INTEGER NOT NULL,
            currentRerollAttempts INTEGER NOT NULL,
            costModifier INTEGER NOT NULL,
            isFirstProcessing BOOLEAN NOT NULL,
            -- 동적 생성된 확률 컬럼들
            {prob_columns_str},
            UNIQUE(willpower, corePoint, dealerA, dealerB, supportA, supportB, 
                   remainingAttempts, currentRerollAttempts, costModifier, isFirstProcessing)
        )
    """)
    
    # 목표별 확률 분포 테이블 (CDF/percentile 데이터)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS goal_probability_distributions (
            gem_state_id INTEGER NOT NULL,
            target TEXT NOT NULL,
            percentile INTEGER NOT NULL,
            value REAL NOT NULL,
            FOREIGN KEY (gem_state_id) REFERENCES goal_probabilities (id),
            PRIMARY KEY (gem_state_id, target, percentile)
        )
    """)
    
    # 사용 가능한 옵션 테이블
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS available_options (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            gem_state_id INTEGER NOT NULL,
            action TEXT NOT NULL,
            probability REAL NOT NULL,
            description TEXT NOT NULL,
            selectionProbability REAL NOT NULL,
            FOREIGN KEY (gem_state_id) REFERENCES goal_probabilities (id)
        )
    """)
    
    # 기대 비용 테이블
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS expected_costs (
            gem_state_id INTEGER NOT NULL,
            target TEXT NOT NULL,
            expected_cost_to_goal REAL NOT NULL,
            FOREIGN KEY (gem_state_id) REFERENCES goal_probabilities (id),
            PRIMARY KEY (gem_state_id, target)
        )
    """)
    
    # 인덱스 생성
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_willpower_corepoint 
        ON goal_probabilities (willpower, corePoint)
    """)
    
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_expected_costs_target 
        ON expected_costs (target, expected_cost_to_goal)
    """)
    
    conn.commit()
    conn.close()
    print(f"📋 데이터베이스 스키마 생성 완료: {db_path}")

def save_to_database(table: dict, db_path: str):
    """확률 테이블을 SQLite 데이터베이스에 저장"""
    print(f"💾 데이터베이스에 저장 중: {db_path}")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    total_states = len(table)
    processed = 0
    
    for state_key, state_data in table.items():
        # 상태 키 파싱
        parts = state_key.split(',')
        if len(parts) != 10:
            continue
            
        wp, cp, dealerA, dealerB, supportA, supportB, attempts, reroll, cost, isFirst = map(int, parts)
        isFirstProcessing = bool(isFirst)
        
        probabilities = state_data['probabilities']
        available_options = state_data.get('availableOptions', [])
        
        # 퍼센타일 정보 추출
        percentiles = state_data.get('percentiles', {})
        
        # 동적으로 INSERT 쿼리 생성 (공유 설정의 컬럼명 사용)
        prob_column_names = []
        prob_values = []
        for target_name in TARGETS.keys():
            column_name = TARGET_CONFIG[target_name]['columnName']
            prob_column_names.append(f"prob_{column_name}")
            prob_values.append(probabilities.get(target_name, 0.0))
        
        prob_columns_str = ", ".join(prob_column_names)
        prob_placeholders = ", ".join(["?"] * len(prob_column_names))
        
        # 젬 상태 저장
        cursor.execute(f"""
            INSERT OR REPLACE INTO goal_probabilities (
                willpower, corePoint, dealerA, dealerB, supportA, supportB,
                remainingAttempts, currentRerollAttempts, costModifier, isFirstProcessing,
                {prob_columns_str}
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, {prob_placeholders})
        """, (
            wp, cp, dealerA, dealerB, supportA, supportB,
            attempts, reroll, cost, isFirstProcessing,
            *prob_values
        ))
        
        gem_state_id = cursor.lastrowid
        
        # CDF 데이터 저장
        for target, percentile_data in percentiles.items():
            if isinstance(percentile_data, dict):
                for percentile, value in percentile_data.items():
                    cursor.execute("""
                        INSERT OR REPLACE INTO goal_probability_distributions (
                            gem_state_id, target, percentile, value
                        ) VALUES (?, ?, ?, ?)
                    """, (gem_state_id, target, percentile, value))
        
        # 사용 가능한 옵션들 저장
        for option in available_options:
            cursor.execute("""
                INSERT INTO available_options (
                    gem_state_id, action, probability, description, selectionProbability
                ) VALUES (?, ?, ?, ?, ?)
            """, (
                gem_state_id,
                option.get('action', ''),
                option.get('probability', 0.0),
                option.get('description', ''),
                option.get('selectionProbability', 0.0)
            ))
        
        # Expected costs 저장
        expected_costs = state_data.get('expectedCosts', {})
        for target, cost in expected_costs.items():
            cursor.execute("""
                INSERT INTO expected_costs (
                    gem_state_id, target, expected_cost_to_goal
                ) VALUES (?, ?, ?)
            """, (gem_state_id, target, cost))
        
        processed += 1
        if processed % 3000 == 0:
            print(f"진행: {processed}/{total_states} ({processed/total_states*100:.1f}%)")
            conn.commit()
    
    conn.commit()
    conn.close()
    
    # 파일 크기 확인
    file_size_mb = os.path.getsize(db_path) / 1024 / 1024
    print(f"💾 데이터베이스 저장 완료: {db_path} ({file_size_mb:.1f} MB)")

if __name__ == "__main__":
    # 명령줄 인자 파싱
    import argparse
    parser = argparse.ArgumentParser(description='병렬 젬 가공 확률 테이블 생성')
    parser.add_argument('--max-reroll', type=int, default=2,
                        help='최대 리롤 횟수 (기본값: 2)')
    parser.add_argument('--workers', type=int, default=None,
                        help='워커 프로세스 수 (기본값: CPU 코어 수)')
    parser.add_argument('--sequential', action='store_true',
                        help='순차 처리 모드 (비교용)')
    args = parser.parse_args()

    # 전역 변수 업데이트
    MAX_REROLL_ATTEMPTS = args.max_reroll

    print(f"🎲 설정: 최대 리롤 횟수 = {args.max_reroll}")

    # SQLite 데이터베이스 경로
    db_file = f"./probability_table_reroll_{args.max_reroll}_parallel.db"

    if args.sequential:
        print("📝 순차 처리 모드로 실행합니다...")
        # 기존 순차 버전 사용
        table = generate_probability_table()
        # 순차 버전은 한 번에 저장
        create_database_schema(db_file)
        save_to_database(table, db_file)
    else:
        print("⚡ 병렬 처리 모드로 실행합니다...")
        print(f"💾 중간 저장 파일: {db_file}")

        # 병렬 버전 사용 (DB 경로 전달)
        table = _generate_probability_table_parallel(num_workers=args.workers, resume_db_path=db_file)

        # 최종 저장은 이미 매 레벨마다 저장되므로 생략
        print("✅ 모든 계산 및 저장 완료")

    print(f"\n🚀 완료!")
    print(f"DB: {db_file}를 SQLite로 쿼리")
    print(f"예: SELECT * FROM goal_probabilities WHERE prob_5_5 > 0.8 ORDER BY prob_5_5 DESC;")