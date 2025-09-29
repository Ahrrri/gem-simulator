#!/usr/bin/env python3
"""
특정 젬 상태에 대해 데이터베이스를 통한 리롤 후 확률을 직접 계산하여 검증하는 스크립트
"""

import sqlite3
import sys
from generate_probability_table import GemState, calculate_4combo_probability, apply_processing, PROCESSING_POSSIBILITIES, check_condition
from itertools import combinations

def get_gem_probability_from_db(db_path, gem_state, target):
    """데이터베이스에서 특정 젬 상태의 목표 확률 조회"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT prob_sum8, prob_sum9, prob_relic, prob_ancient, prob_dealer_complete, prob_support_complete
        FROM gem_states 
        WHERE willpower=? AND corePoint=? AND dealerA=? AND dealerB=? AND supportA=? AND supportB=? 
              AND remainingAttempts=? AND currentRerollAttempts=? AND costModifier=? AND isFirstProcessing=?
    """, (
        gem_state.willpower, gem_state.corePoint, gem_state.dealerA, gem_state.dealerB,
        gem_state.supportA, gem_state.supportB, gem_state.remainingAttempts,
        gem_state.currentRerollAttempts, gem_state.costModifier, gem_state.isFirstProcessing
    ))
    
    result = cursor.fetchone()
    conn.close()
    
    if result:
        target_map = {
            'sum8+': result[0],
            'sum9+': result[1], 
            'relic+': result[2],
            'ancient+': result[3],
            'dealer_active': result[4],
            'support_active': result[5]
        }
        return target_map.get(target, 0.0)
    return None

def calculate_reroll_probability_direct(initial_gem, target, db_path):
    """리롤 후 확률을 4combo를 통해 직접 계산"""
    print(f"=== 직접 4combo 계산으로 리롤 후 {target} 확률 계산 ===")
    print(f"초기 젬 상태: willpower={initial_gem.willpower}, corePoint={initial_gem.corePoint}")
    print(f"dealerA={initial_gem.dealerA}, dealerB={initial_gem.dealerB}, supportA={initial_gem.supportA}, supportB={initial_gem.supportB}")
    print(f"remainingAttempts={initial_gem.remainingAttempts}, currentRerollAttempts={initial_gem.currentRerollAttempts}")
    print(f"costModifier={initial_gem.costModifier}, isFirstProcessing={initial_gem.isFirstProcessing}")
    print()
    
    # 현재 젬의 사용 가능한 옵션들 얻기
    available_options = []
    option_weights = []
    
    for action, data in PROCESSING_POSSIBILITIES.items():
        if check_condition(data['condition'], initial_gem):
            available_options.append(action)
            option_weights.append(data['probability'])
    
    print(f"사용 가능한 옵션 수: {len(available_options)}")
    total_weight = sum(option_weights)
    print(f"총 가중치: {total_weight:.6f}")
    
    for i, (action, weight) in enumerate(zip(available_options, option_weights)):
        print(f"  [{i:2d}] {action:15s}: weight={weight:.4f}")
    print()
    
    # 4combo 확률 계산
    combo_count = 0
    weighted_prob_sum = 0.0
    total_combo_weight = 0.0
    
    print("4combo 계산 시작...")
    
    for combo_indices in combinations(range(len(available_options)), 4):
        # 이 조합의 확률 계산 (기존 함수 사용)
        combo_weight = calculate_4combo_probability(list(combo_indices), option_weights)
        
        if combo_weight <= 0:
            continue
            
        # 이 조합에서 각 옵션을 적용한 젬 상태들의 목표 확률 계산
        combo_probs = []
        for idx in combo_indices:
            action = available_options[idx]
            result_gem = apply_processing(initial_gem, action)
            
            # 리롤된 젬이므로 리롤 횟수 감소
            result_gem.currentRerollAttempts -= 1
            
            prob = get_gem_probability_from_db(db_path, result_gem, target)
            if prob is None:
                print(f"경고: 데이터베이스에서 상태를 찾을 수 없음: {result_gem}")
                prob = 0.0
            combo_probs.append(prob)
        
        # 평균 확률 사용 (JavaScript와 동일)
        avg_prob = sum(combo_probs) / len(combo_probs) if combo_probs else 0.0
        
        weighted_prob_sum += combo_weight * avg_prob
        total_combo_weight += combo_weight
        combo_count += 1
    
    calculated_avg = weighted_prob_sum / total_combo_weight if total_combo_weight > 0 else 0.0
    
    print(f"\n총 {combo_count}개 조합 계산 완료")
    print(f"가중 확률 합: {weighted_prob_sum:.6f}")
    print(f"총 조합 가중치: {total_combo_weight:.6f}")
    print(f"계산된 평균 확률: {calculated_avg:.6f} ({calculated_avg*100:.4f}%)")
    
    return calculated_avg


def main():
    if len(sys.argv) < 2:
        print("사용법: python verify_db_reroll.py <db_path>")
        sys.exit(1)
    
    db_path = sys.argv[1]
    
    # 검증할 젬 상태 (로그에서 가져온 상태)
    test_gem = GemState(
        willpower=1,
        corePoint=3, 
        dealerA=1,
        dealerB=0,
        supportA=1,
        supportB=0,
        remainingAttempts=6,
        currentRerollAttempts=1,
        costModifier=0,
        isFirstProcessing=False
    )
    
    target = 'sum8+'
    
    print("=== 데이터베이스 검증 스크립트 ===")
    print()
    
    # 1. 데이터베이스에서 현재 젬의 확률 조회
    current_prob = get_gem_probability_from_db(db_path, test_gem, target)
    if current_prob is not None:
        print(f"현재 젬 상태의 {target} 확률 (DB): {current_prob:.6f} ({current_prob*100:.4f}%)")
    else:
        print("현재 젬 상태를 데이터베이스에서 찾을 수 없습니다")
        return
    
    # 2. 리롤 후 젬 상태의 확률 조회 (리롤 횟수 -1)
    reroll_gem = GemState(
        test_gem.willpower, test_gem.corePoint, test_gem.dealerA, test_gem.dealerB,
        test_gem.supportA, test_gem.supportB, test_gem.remainingAttempts,
        test_gem.currentRerollAttempts - 1, test_gem.costModifier, test_gem.isFirstProcessing
    )
    
    reroll_prob = get_gem_probability_from_db(db_path, reroll_gem, target)
    if reroll_prob is not None:
        print(f"리롤 후 젬 상태의 {target} 확률 (DB): {reroll_prob:.6f} ({reroll_prob*100:.4f}%)")
    else:
        print("리롤 후 젬 상태를 데이터베이스에서 찾을 수 없습니다")
    
    print()
    
    # 3. 4combo를 통한 직접 계산
    calculated_prob = calculate_reroll_probability_direct(test_gem, target, db_path)
    
    print(f"\n=== 결과 비교 ===")
    print(f"현재 젬 확률 (DB): {current_prob*100:.4f}%")
    if reroll_prob is not None:
        print(f"리롤 후 확률 (DB): {reroll_prob*100:.4f}%")
        print(f"직접 계산 확률: {calculated_prob*100:.4f}%")
        diff = abs(calculated_prob - reroll_prob) * 100
        print(f"확률 차이: {diff:.4f}%")
    else:
        print(f"직접 계산 확률: {calculated_prob*100:.4f}%")

if __name__ == "__main__":
    main()