#!/usr/bin/env python3
"""
Python의 4combo 확률 계산 테스트
generate_probability_table.py의 함수들을 직접 import해서 사용
"""

import sys
from itertools import combinations, permutations
from generate_probability_table import (
    GemState,
    get_available_options,
    calculate_4combo_probability,
    PROCESSING_POSSIBILITIES
)

def test_gem_state(gem_values):
    """특정 젬 상태에 대한 4combo 확률 계산"""
    
    # GemState 생성
    gem = GemState(
        willpower=gem_values[0],
        corePoint=gem_values[1],
        dealerA=gem_values[2],
        dealerB=gem_values[3],
        supportA=gem_values[4],
        supportB=gem_values[5],
        remainingAttempts=gem_values[6],
        currentRerollAttempts=gem_values[7],
        costModifier=gem_values[8],
        isFirstProcessing=gem_values[9]
    )
    
    print("="*60)
    print("📊 Python 4combo 확률 계산")
    print("="*60)
    print(f"젬 상태: willpower={gem.willpower}, corePoint={gem.corePoint}, "
          f"dealerA={gem.dealerA}, dealerB={gem.dealerB}, "
          f"supportA={gem.supportA}, supportB={gem.supportB}")
    print(f"기타: remainingAttempts={gem.remainingAttempts}, "
          f"currentRerollAttempts={gem.currentRerollAttempts}, "
          f"costModifier={gem.costModifier}, isFirstProcessing={gem.isFirstProcessing}")
    
    # 사용 가능한 옵션들 가져오기
    options = get_available_options(gem)
    print(f"\n사용 가능한 옵션 수: {len(options)}")
    
    if len(options) < 4:
        print("⚠️  옵션이 4개 미만이므로 4combo를 만들 수 없습니다.")
        return None
    
    # 각 옵션 출력
    print("\n옵션 목록:")
    for i, opt in enumerate(options):
        print(f"  [{i:2d}] {opt['action']:20s}: weight={opt['probability']:.4f}")
    
    # 가중치 배열
    all_weights = [opt['probability'] for opt in options]
    total_weight = sum(all_weights)
    print(f"\n총 가중치: {total_weight:.6f}")
    
    # 모든 4개 조합에 대한 확률 계산
    combo_probs = []
    print("\n4개 조합 확률 계산 중...")
    
    for combo_indices in combinations(range(len(options)), 4):
        combo_prob = calculate_4combo_probability(list(combo_indices), all_weights)
        combo_probs.append({
            'indices': combo_indices,
            'probability': combo_prob,
            'options': [options[i] for i in combo_indices]
        })
    
    # 확률 기준으로 정렬
    combo_probs.sort(key=lambda x: x['probability'], reverse=True)
    
    # 상위 10개 조합 출력
    print(f"\n총 {len(combo_probs)}개 조합 중 상위 10개:")
    for i, combo in enumerate(combo_probs[:10]):
        indices = combo['indices']
        prob = combo['probability']
        actions = [opt['action'] for opt in combo['options']]
        print(f"  {i+1:2d}. [{', '.join(f'{idx:2d}' for idx in indices)}] "
              f"P={prob:.8f} ({prob*100:.6f}%)")
        print(f"      => {' | '.join(actions)}")
    
    # 전체 확률 합계 (검증용)
    total_prob = sum(c['probability'] for c in combo_probs)
    print(f"\n전체 4combo 확률 합계: {total_prob:.10f} (이론적으로 1이어야 함)")
    
    # 첫 번째 조합의 상세 계산 과정 출력
    if combo_probs:
        print("\n" + "="*60)
        print("🔍 첫 번째 조합의 상세 계산 과정")
        print("="*60)
        
        first_combo = combo_probs[0]
        indices = list(first_combo['indices'])
        print(f"조합 indices: {indices}")
        print(f"해당 옵션들:")
        for idx in indices:
            print(f"  [{idx:2d}] {options[idx]['action']:20s}: {all_weights[idx]:.4f}")
        
        print("\n각 순열(permutation)별 확률:")
        perm_count = 0
        total_perm_prob = 0.0
        
        for perm in permutations(indices):
            if perm_count < 5:  # 처음 5개만 출력
                perm_prob = 1.0
                remaining_weights = all_weights.copy()
                remaining_total = sum(remaining_weights)
                
                print(f"\n  순열 {perm_count+1}: {perm}")
                for step, idx in enumerate(perm):
                    if remaining_total > 0 and remaining_weights[idx] > 0:
                        step_prob = remaining_weights[idx] / remaining_total
                        perm_prob *= step_prob
                        print(f"    Step {step+1}: idx={idx:2d}, "
                              f"weight={remaining_weights[idx]:.4f}, "
                              f"total={remaining_total:.4f}, "
                              f"prob={step_prob:.6f}, "
                              f"cumulative={perm_prob:.8f}")
                        remaining_total -= remaining_weights[idx]
                        remaining_weights[idx] = 0
                    else:
                        perm_prob = 0
                        print(f"    Step {step+1}: 확률 0 (조건 불만족)")
                        break
                
                print(f"  => 이 순열의 최종 확률: {perm_prob:.8f}")
                total_perm_prob += perm_prob
            else:
                # 나머지는 계산만
                perm_prob = 1.0
                remaining_weights = all_weights.copy()
                remaining_total = sum(remaining_weights)
                
                for idx in perm:
                    if remaining_total > 0 and remaining_weights[idx] > 0:
                        perm_prob *= remaining_weights[idx] / remaining_total
                        remaining_total -= remaining_weights[idx]
                        remaining_weights[idx] = 0
                    else:
                        perm_prob = 0
                        break
                
                total_perm_prob += perm_prob
            
            perm_count += 1
        
        print(f"\n총 {perm_count}개 순열의 확률 합: {total_perm_prob:.8f}")
        print(f"저장된 조합 확률: {first_combo['probability']:.8f}")
        print(f"차이: {abs(total_perm_prob - first_combo['probability']):.10f}")
    
    return combo_probs

def main():
    # 기본값 또는 사용자 입력
    if len(sys.argv) > 1:
        # 명령행 인자로 받기
        gem_values = eval(sys.argv[1])
    else:
        # 기본값 사용 (사용자가 제공한 예시)
        gem_values = (1, 3, 2, 0, 5, 0, 2, 1, 0, False)
    
    result = test_gem_state(gem_values)
    
    if result:
        print("\n✅ Python 계산 완료")
        print(f"총 {len(result)}개 조합 계산됨")

if __name__ == "__main__":
    main()