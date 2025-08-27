#!/usr/bin/env python3
"""
젬 가공 확률 테이블을 사전 계산하여 JSON 파일로 저장하는 스크립트

모든 가능한 젬 상태 (27,500개)에 대해 확률을 계산하여 정적 파일로 저장합니다.
브라우저에서는 이 파일을 로드하여 즉시 확률을 조회할 수 있습니다.
"""

import json
import time
from typing import Dict, Any, Tuple
from dataclasses import dataclass

# 젬 가공 확률 테이블
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
    
    'effect1_+1': {'probability': 0.1165, 'condition': 'effect1 < 5'},
    'effect1_+2': {'probability': 0.0440, 'condition': 'effect1 < 4'},
    'effect1_+3': {'probability': 0.0175, 'condition': 'effect1 < 3'},
    'effect1_+4': {'probability': 0.0045, 'condition': 'effect1 < 2'},
    'effect1_-1': {'probability': 0.0300, 'condition': 'effect1 > 1'},
    
    'effect2_+1': {'probability': 0.1165, 'condition': 'effect2 < 5'},
    'effect2_+2': {'probability': 0.0440, 'condition': 'effect2 < 4'},
    'effect2_+3': {'probability': 0.0175, 'condition': 'effect2 < 3'},
    'effect2_+4': {'probability': 0.0045, 'condition': 'effect2 < 2'},
    'effect2_-1': {'probability': 0.0300, 'condition': 'effect2 > 1'},
    
    'effect1_change': {'probability': 0.0325, 'condition': 'always'},
    'effect2_change': {'probability': 0.0325, 'condition': 'always'},
    
    'cost_+100': {'probability': 0.0175, 'condition': 'costIncrease < 100 && remainingAttempts > 1'},
    'cost_-100': {'probability': 0.0175, 'condition': 'costIncrease > -100 && remainingAttempts > 1'},
    
    'maintain': {'probability': 0.0175, 'condition': 'always'},
    'reroll_+1': {'probability': 0.0250, 'condition': 'remainingAttempts > 1'},
    'reroll_+2': {'probability': 0.0075, 'condition': 'remainingAttempts > 1'}
}

@dataclass
class GemState:
    willpower: int
    corePoint: int
    effect1: int
    effect2: int
    remainingAttempts: int
    currentRerollAttempts: int
    costIncrease: int = 0
    processingCount: int = 1

def check_condition(condition: str, gem: GemState) -> bool:
    """조건을 확인하는 함수"""
    if condition == 'always':
        return True
    
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
    elif condition == 'effect1 < 5':
        return gem.effect1 < 5
    elif condition == 'effect1 < 4':
        return gem.effect1 < 4
    elif condition == 'effect1 < 3':
        return gem.effect1 < 3
    elif condition == 'effect1 < 2':
        return gem.effect1 < 2
    elif condition == 'effect1 > 1':
        return gem.effect1 > 1
    elif condition == 'effect2 < 5':
        return gem.effect2 < 5
    elif condition == 'effect2 < 4':
        return gem.effect2 < 4
    elif condition == 'effect2 < 3':
        return gem.effect2 < 3
    elif condition == 'effect2 < 2':
        return gem.effect2 < 2
    elif condition == 'effect2 > 1':
        return gem.effect2 > 1
    elif 'costIncrease' in condition and 'remainingAttempts' in condition:
        if '< 100' in condition:
            return gem.costIncrease < 100 and gem.remainingAttempts > 1
        else:
            return gem.costIncrease > -100 and gem.remainingAttempts > 1
    elif condition == 'remainingAttempts > 1':
        return gem.remainingAttempts > 1
    
    return False

def get_available_options(gem: GemState) -> list:
    """사용 가능한 옵션들과 그 확률을 반환"""
    options = []
    for action, config in PROCESSING_POSSIBILITIES.items():
        if check_condition(config['condition'], gem):
            options.append({
                'action': action,
                'probability': config['probability']
            })
    return options

def apply_processing(gem: GemState, action: str) -> GemState:
    """가공 옵션을 적용하여 새로운 젬 상태를 반환"""
    new_gem = GemState(
        willpower=gem.willpower,
        corePoint=gem.corePoint,
        effect1=gem.effect1,
        effect2=gem.effect2,
        remainingAttempts=max(0, gem.remainingAttempts - 1),
        currentRerollAttempts=gem.currentRerollAttempts,
        costIncrease=gem.costIncrease,
        processingCount=gem.processingCount + 1
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
    elif action.startswith('effect1_'):
        if '+' in action:
            change = int(action.split('+')[1])
            new_gem.effect1 = min(5, new_gem.effect1 + change)
        elif '-' in action:
            change = int(action.split('-')[1])
            new_gem.effect1 = max(1, new_gem.effect1 - change)
        # effect1_change는 별도 로직 필요 (여기서는 단순화)
    elif action.startswith('effect2_'):
        if '+' in action:
            change = int(action.split('+')[1])
            new_gem.effect2 = min(5, new_gem.effect2 + change)
        elif '-' in action:
            change = int(action.split('-')[1])
            new_gem.effect2 = max(1, new_gem.effect2 - change)
    elif action.startswith('cost_'):
        if '+' in action:
            change = int(action.split('+')[1])
            new_gem.costIncrease = min(100, new_gem.costIncrease + change)
        elif '-' in action:
            change = int(action.split('-')[1])
            new_gem.costIncrease = max(-100, new_gem.costIncrease - change)
    elif action.startswith('reroll_'):
        change = int(action.split('+')[1])
        new_gem.currentRerollAttempts = min(3, new_gem.currentRerollAttempts + change)
    
    return new_gem

def state_to_key(gem: GemState) -> str:
    """젬 상태를 키 문자열로 변환"""
    return f"{gem.willpower},{gem.corePoint},{gem.effect1},{gem.effect2},{gem.remainingAttempts},{gem.currentRerollAttempts}"

def calculate_probabilities(gem: GemState, memo: Dict[str, Dict[str, float]]) -> Dict[str, float]:
    """재귀적으로 확률을 계산"""
    key = state_to_key(gem)
    if key in memo:
        return memo[key]
    
    # 목표 조건들
    targets = {
        '5/5': gem.willpower >= 5 and gem.corePoint >= 5,
        '5/4': gem.willpower >= 5 and gem.corePoint >= 4,
        '4/5': gem.willpower >= 4 and gem.corePoint >= 5,
        '5/3': gem.willpower >= 5 and gem.corePoint >= 3,
        '4/4': gem.willpower >= 4 and gem.corePoint >= 4,
        '3/5': gem.willpower >= 3 and gem.corePoint >= 5,
        'sum8+': (gem.willpower + gem.corePoint) >= 8,
        'sum9+': (gem.willpower + gem.corePoint) >= 9,
        'relic+': (gem.willpower + gem.corePoint + gem.effect1 + gem.effect2) >= 16,
        'ancient+': (gem.willpower + gem.corePoint + gem.effect1 + gem.effect2) >= 19
    }
    
    # 기저 조건: 남은 시도 횟수가 0
    if gem.remainingAttempts == 0:
        result = {}
        for target, achieved in targets.items():
            result[target] = 1.0 if achieved else 0.0
        memo[key] = result
        return result
    
    # 사용 가능한 옵션들 가져오기
    available_options = get_available_options(gem)
    
    if not available_options:
        # 사용 가능한 옵션이 없으면 현재 상태 유지
        result = {}
        for target, achieved in targets.items():
            result[target] = 1.0 if achieved else 0.0
        memo[key] = result
        return result
    
    # 가중 평균으로 확률 계산
    total_weight = sum(opt['probability'] for opt in available_options)
    result = {target: 0.0 for target in targets}
    
    for option in available_options:
        weight = option['probability'] / total_weight
        next_gem = apply_processing(gem, option['action'])
        future_probs = calculate_probabilities(next_gem, memo)
        
        for target in targets:
            result[target] += weight * future_probs[target]
    
    memo[key] = result
    return result

def generate_probability_table():
    """모든 가능한 젬 상태에 대한 확률 테이블 생성"""
    print("🎲 확률 테이블 생성 시작...")
    start_time = time.time()
    
    probability_table = {}
    memo = {}
    total_states = 0
    
    # 모든 가능한 상태 순회
    for willpower in range(1, 6):
        for corePoint in range(1, 6):
            for effect1 in range(1, 6):
                for effect2 in range(1, 6):
                    for remainingAttempts in range(11):  # 0~10
                        for currentRerollAttempts in range(4):  # 0~3
                            gem = GemState(
                                willpower=willpower,
                                corePoint=corePoint,
                                effect1=effect1,
                                effect2=effect2,
                                remainingAttempts=remainingAttempts,
                                currentRerollAttempts=currentRerollAttempts
                            )
                            
                            # 확률 계산
                            probs = calculate_probabilities(gem, memo)
                            
                            # 상태 키 생성 및 저장
                            state_key = state_to_key(gem)
                            probability_table[state_key] = probs
                            
                            total_states += 1
                            
                            # 진행 상황 출력
                            if total_states % 1000 == 0:
                                progress = (total_states / 27500) * 100
                                elapsed = time.time() - start_time
                                print(f"진행률: {progress:.1f}% ({total_states}/27500) - {elapsed:.1f}초 경과")
    
    end_time = time.time()
    elapsed_time = end_time - start_time
    
    print(f"\n✅ 완료!")
    print(f"총 {total_states}개 상태 계산 완료")
    print(f"소요 시간: {elapsed_time:.1f}초")
    print(f"평균 계산 속도: {total_states/elapsed_time:.0f} 상태/초")
    
    return probability_table

def save_to_json(table: dict, filename: str):
    """테이블을 JSON 파일로 저장"""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(table, f, indent=2, ensure_ascii=False)
    
    # 파일 크기 확인
    import os
    file_size_mb = os.path.getsize(filename) / 1024 / 1024
    print(f"💾 {filename}에 저장 완료 ({file_size_mb:.1f} MB)")

if __name__ == "__main__":
    # 확률 테이블 생성
    table = generate_probability_table()
    
    # JSON 파일로 저장
    output_file = "src/data/probability_table.json"
    save_to_json(table, output_file)
    
    print(f"\n🚀 사용법:")
    print(f"생성된 {output_file}를 프로젝트에서 import하여 사용하세요.")
    print(f"예: const probTable = await import('./data/probability_table.json');")