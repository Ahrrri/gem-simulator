#!/usr/bin/env python3
"""
젬 가공 확률 테이블을 사전 계산하여 JSON 파일로 저장하는 스크립트

모든 가능한 젬 상태 (27,500개)에 대해 확률을 계산하여 정적 파일로 저장합니다.
브라우저에서는 이 파일을 로드하여 즉시 확률을 조회할 수 있습니다.
"""

import json
import time
import sys
import inspect
import threading
import sqlite3
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap
from typing import Dict, Any, Tuple, List
from dataclasses import dataclass
from itertools import combinations, permutations

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
    elif 'costModifier' in condition and 'remainingAttempts' in condition:
        if '< 100' in condition:
            return gem.costModifier < 100 and gem.remainingAttempts > 1
        else:
            return gem.costModifier > -100 and gem.remainingAttempts > 1
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

def get_available_options_with_descriptions(gem: GemState) -> list:
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

def apply_processing(gem: GemState, action: str) -> GemState:
    """가공 옵션을 적용하여 새로운 젬 상태를 반환 (4개 옵션 시스템)"""
    
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
            new_gem.dealerA = max(0, new_gem.dealerA - change)
        elif action == 'dealerA_change':
            # 4개 옵션 중에서 현재 0인 다른 옵션으로 이동
            current_options = ['dealerA', 'dealerB', 'supportA', 'supportB']
            inactive_options = [opt for opt in current_options if getattr(new_gem, opt) == 0]
            
            if inactive_options:
                import random
                current_level = new_gem.dealerA
                random_inactive = random.choice(inactive_options)
                new_gem.dealerA = 0
                setattr(new_gem, random_inactive, current_level)
    elif action.startswith('dealerB_'):
        if '+' in action:
            change = int(action.split('+')[1])
            new_gem.dealerB = min(5, new_gem.dealerB + change)
        elif '-' in action:
            change = int(action.split('-')[1])
            new_gem.dealerB = max(0, new_gem.dealerB - change)
        elif action == 'dealerB_change':
            current_options = ['dealerA', 'dealerB', 'supportA', 'supportB']
            inactive_options = [opt for opt in current_options if getattr(new_gem, opt) == 0]
            
            if inactive_options:
                import random
                current_level = new_gem.dealerB
                random_inactive = random.choice(inactive_options)
                new_gem.dealerB = 0
                setattr(new_gem, random_inactive, current_level)
    elif action.startswith('supportA_'):
        if '+' in action:
            change = int(action.split('+')[1])
            new_gem.supportA = min(5, new_gem.supportA + change)
        elif '-' in action:
            change = int(action.split('-')[1])
            new_gem.supportA = max(0, new_gem.supportA - change)
        elif action == 'supportA_change':
            current_options = ['dealerA', 'dealerB', 'supportA', 'supportB']
            inactive_options = [opt for opt in current_options if getattr(new_gem, opt) == 0]
            
            if inactive_options:
                import random
                current_level = new_gem.supportA
                random_inactive = random.choice(inactive_options)
                new_gem.supportA = 0
                setattr(new_gem, random_inactive, current_level)
    elif action.startswith('supportB_'):
        if '+' in action:
            change = int(action.split('+')[1])
            new_gem.supportB = min(5, new_gem.supportB + change)
        elif '-' in action:
            change = int(action.split('-')[1])
            new_gem.supportB = max(0, new_gem.supportB - change)
        elif action == 'supportB_change':
            current_options = ['dealerA', 'dealerB', 'supportA', 'supportB']
            inactive_options = [opt for opt in current_options if getattr(new_gem, opt) == 0]
            
            if inactive_options:
                import random
                current_level = new_gem.supportB
                random_inactive = random.choice(inactive_options)
                new_gem.supportB = 0
                setattr(new_gem, random_inactive, current_level)
    elif action.startswith('cost_'):
        if '+' in action:
            change = int(action.split('+')[1])
            new_gem.costModifier = min(100, new_gem.costModifier + change)
        elif '-' in action:
            change = int(action.split('-')[1])
            new_gem.costModifier = max(-100, new_gem.costModifier - change)
    elif action.startswith('reroll_'):
        change = int(action.split('+')[1])
        # 실제 리롤 횟수는 제한 없이 증가 가능 (메모이제이션 키에서만 4로 제한)
        new_gem.currentRerollAttempts = new_gem.currentRerollAttempts + change
    
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

# 진행 상황 추적을 위한 전역 변수
calculation_counter = 0

# 옵션 선택 확률 메모이제이션
option_selection_memo = {}

class ProgressVisualizer:
    def __init__(self, max_attempts=10, max_rerolls=5):
        self.max_attempts = max_attempts
        self.max_rerolls = max_rerolls
        
        # 각 셀당 서브그리드 크기 (costModifier=3, willpower*corePoint=25, 4options=150)
        # 실제 상태 수: 3 * 5 * 5 * 150 = 11,250개
        # 125 * 90 = 11,250개로 정확히 맞춤
        self.sub_grid_width = 125
        self.sub_grid_height = 90
        
        # 전체 이미지 크기
        self.image_width = max_attempts * self.sub_grid_width
        self.image_height = max_rerolls * self.sub_grid_height
        
        # 진행 상황 배열 (0: 미완료, 1: 완료)
        self.progress = np.zeros((self.image_height, self.image_width))
        
        # matplotlib 설정 (headless mode)
        import matplotlib
        matplotlib.use('Agg')  # GUI 없이 이미지만 생성
        plt.ioff()  # 비인터랙티브 모드
        self.fig, self.ax = plt.subplots(figsize=(15, 8), dpi=100)
        self.im = self.ax.imshow(self.progress, cmap='RdYlGn', vmin=0, vmax=1)
        
        # 이미지 저장 설정
        self.save_counter = 0
        self.frames_dir = "progress_frames"
        import os
        os.makedirs(self.frames_dir, exist_ok=True)
        
        # 격자 표시
        for i in range(max_attempts + 1):
            self.ax.axvline(x=i * self.sub_grid_width - 0.5, color='black', linewidth=2)
        for i in range(max_rerolls + 1):
            self.ax.axhline(y=i * self.sub_grid_height - 0.5, color='black', linewidth=2)
        
        # 레이블
        self.ax.set_xlabel('Remaining Attempts')
        self.ax.set_ylabel('Current Reroll Attempts')
        self.ax.set_title('Gem Probability Calculation Progress')
        
        # 축 눈금 설정
        self.ax.set_xticks([i * self.sub_grid_width + self.sub_grid_width/2 for i in range(max_attempts)])
        self.ax.set_xticklabels([str(i) for i in range(max_attempts)])
        self.ax.set_yticks([i * self.sub_grid_height + self.sub_grid_height/2 for i in range(max_rerolls)])
        self.ax.set_yticklabels([str(i) for i in range(max_rerolls)])
        
        plt.tight_layout()
        
    def update_progress(self, remaining_attempts, current_rerolls, sub_index):
        """특정 위치의 서브 셀 하나를 완료로 표시"""
        # 서브그리드 내 위치 계산 (125 x 90 격자)
        sub_x = sub_index % self.sub_grid_width
        sub_y = sub_index // self.sub_grid_width
        
        # 전체 이미지에서의 실제 위치
        actual_x = remaining_attempts * self.sub_grid_width + sub_x
        actual_y = current_rerolls * self.sub_grid_height + sub_y
        
        # 완료 표시
        if actual_y < self.image_height and actual_x < self.image_width:
            self.progress[actual_y, actual_x] = 1
            
    def refresh_display(self):
        """프레임을 이미지 파일로 저장"""
        self.im.set_data(self.progress)
        
        # 프레임 저장
        frame_filename = f"{self.frames_dir}/frame_{self.save_counter:05d}.png"
        self.fig.savefig(frame_filename, bbox_inches='tight', dpi=100)
        self.save_counter += 1
        
        if self.save_counter % 10 == 0:
            print(f"📸 프레임 {self.save_counter}개 저장됨")
        
    def close(self):
        plt.close(self.fig)
        
    def create_video(self, output_filename="calculation_progress.mp4", fps=10):
        """저장된 프레임들을 영상으로 합성"""
        try:
            import cv2
            import glob
            
            # 프레임 파일들 정렬
            frame_files = sorted(glob.glob(f"{self.frames_dir}/frame_*.png"))
            
            if not frame_files:
                print("⚠️ 저장된 프레임이 없습니다.")
                return
            
            # 첫 번째 프레임으로 영상 크기 결정
            frame = cv2.imread(frame_files[0])
            height, width, layers = frame.shape
            
            # 영상 작성기 초기화
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            video = cv2.VideoWriter(output_filename, fourcc, fps, (width, height))
            
            print(f"🎬 {len(frame_files)}개 프레임으로 영상 생성 중...")
            
            for frame_file in frame_files:
                frame = cv2.imread(frame_file)
                video.write(frame)
            
            video.release()
            print(f"✅ 영상 저장 완료: {output_filename}")
            
        except ImportError:
            print("⚠️ OpenCV가 설치되지 않았습니다. pip install opencv-python")
        except Exception as e:
            print(f"⚠️ 영상 생성 실패: {e}")

# 전역 시각화 객체
visualizer = None

def state_to_key(gem: GemState) -> str:
    """젬 상태를 키 문자열로 변환 (4개 옵션 시스템, 리롤 횟수는 4 이상을 4로 통일)"""
    # 리롤 횟수는 4 이상을 모두 4로 간주 (메모이제이션 효율성)
    capped_reroll = min(4, gem.currentRerollAttempts)
    first_processing = 1 if gem.isFirstProcessing else 0
    return f"{gem.willpower},{gem.corePoint},{gem.dealerA},{gem.dealerB},{gem.supportA},{gem.supportB},{gem.remainingAttempts},{capped_reroll},{gem.costModifier},{first_processing}"

def get_option_pattern_key(gem: GemState) -> str:
    """젬의 전체 상태를 기반으로 패턴 키 생성"""
    levels = []
    if gem.dealerA > 0:
        levels.append(gem.dealerA)
    if gem.dealerB > 0:
        levels.append(gem.dealerB)
    if gem.supportA > 0:
        levels.append(gem.supportA)
    if gem.supportB > 0:
        levels.append(gem.supportB)
    
    # 레벨들을 정렬해서 패턴으로 만들기
    levels.sort(reverse=True)  # 높은 레벨부터
    
    # 모든 관련 상태 포함
    return (f"levels:{','.join(map(str, levels))}"
            f",wp:{gem.willpower},cp:{gem.corePoint}"
            f",att:{gem.remainingAttempts}"
            f",reroll:{min(4, gem.currentRerollAttempts)}"  # 리롤은 4 이상을 4로 통일
            f",cost:{gem.costModifier}")

def calculate_option_selection_probabilities(available_options: List[dict], gem: GemState) -> Dict[str, float]:
    """옵션 풀에서 각 옵션이 선택될 확률을 계산 (메모이제이션)"""
    # 우선 일반적인 패턴으로 변환 (level1, level2 형태)
    active_options = []
    option_to_generic = {}  # 실제 옵션명 -> 일반화된 이름
    generic_to_option = {}  # 일반화된 이름 -> 실제 옵션명
    
    # 활성 옵션들을 레벨 순으로 정렬하여 일반화
    if gem.dealerA > 0:
        active_options.append(('dealerA', gem.dealerA))
    if gem.dealerB > 0:
        active_options.append(('dealerB', gem.dealerB))
    if gem.supportA > 0:
        active_options.append(('supportA', gem.supportA))
    if gem.supportB > 0:
        active_options.append(('supportB', gem.supportB))
    
    # 레벨 기준으로 정렬
    active_options.sort(key=lambda x: (-x[1], x[0]))  # 레벨 내림차순, 이름 오름차순
    
    # 일반화된 이름 매핑 생성
    for i, (opt_name, level) in enumerate(active_options):
        generic_name = f"option{i+1}"  # option1, option2 등
        for action_type in ['+1', '+2', '+3', '+4', '-1', 'change']:
            actual = f"{opt_name}_{action_type}"
            generic = f"{generic_name}_{action_type}"
            option_to_generic[actual] = generic
            generic_to_option[generic] = actual
    
    # 일반화된 available_options 생성
    generic_available = []
    for opt in available_options:
        if opt['action'] in option_to_generic:
            generic_available.append({
                'action': option_to_generic[opt['action']],
                'probability': opt['probability']
            })
        else:
            # willpower, corePoint, cost, maintain, reroll은 그대로
            generic_available.append(opt)
    
    # 패턴 키 생성 (일반화된 버전)
    pattern_key = get_option_pattern_key(gem)
    
    global option_selection_memo
    if pattern_key in option_selection_memo:
        # 캐시된 일반화된 결과를 실제 옵션명으로 변환
        cached_result = option_selection_memo[pattern_key]
        mapped_result = {}
        
        for generic_action, prob in cached_result.items():
            if generic_action in generic_to_option:
                actual_action = generic_to_option[generic_action]
                mapped_result[actual_action] = prob
            else:
                # willpower, corePoint 등은 그대로
                mapped_result[generic_action] = prob
        
        return mapped_result
    
    selection_probs = {}
    
    # 일반화된 옵션들로 계산 수행
    if len(generic_available) <= 4:
        equal_prob = 1.0 / len(generic_available)
        for option in generic_available:
            selection_probs[option['action']] = equal_prob
    else:
        # 4개 이상이면 모든 4개 조합에 대해 계산
        option_indices = list(range(len(generic_available)))
        
        # 각 옵션의 선택 확률 초기화
        for option in generic_available:
            selection_probs[option['action']] = 0.0
        
        for combo_indices in combinations(option_indices, 4):
            combo_options = [generic_available[i] for i in combo_indices]
            
            # 이 4개 조합이 뽑힐 확률 계산
            combo_prob = calculate_4combo_probability(list(combo_indices), 
                                                     [opt['probability'] for opt in generic_available])
            
            # 4개 중 하나를 균등하게 선택 (25% 확률)
            for option in combo_options:
                selection_probs[option['action']] += combo_prob * 0.25
    
    # 일반화된 형태로 메모이제이션에 저장
    option_selection_memo[pattern_key] = selection_probs
    
    # 실제 옵션명으로 변환하여 반환
    mapped_result = {}
    for generic_action, prob in selection_probs.items():
        if generic_action in generic_to_option:
            actual_action = generic_to_option[generic_action]
            mapped_result[actual_action] = prob
        else:
            # willpower, corePoint 등은 그대로
            mapped_result[generic_action] = prob
    
    return mapped_result

def calculate_probabilities(gem: GemState, memo: Dict[str, Dict]) -> Dict[str, float]:
    """재귀적으로 확률을 계산. 여기서의 확률은 아직 옵션 4개를 보지 못한 상태임"""
    global calculation_counter, visualizer
    
    key = state_to_key(gem)
    if key in memo:
        return memo[key]['probabilities']
    
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
        'relic+': (gem.willpower + gem.corePoint + gem.dealerA + gem.dealerB + gem.supportA + gem.supportB) >= 16,
        'ancient+': (gem.willpower + gem.corePoint + gem.dealerA + gem.dealerB + gem.supportA + gem.supportB) >= 19
    }
    
    # 현재 상태에서 각 목표 달성 여부를 기본값으로 설정
    # (이미 달성한 목표는 확률 1.0으로 시작)
    base_probabilities = {}
    for target, achieved in targets.items():
        base_probabilities[target] = 1.0 if achieved else 0.0
    
    # 사용 가능한 옵션들 가져오기 (설명도 포함)
    available_options = get_available_options_with_descriptions(gem)
    
    # 기저 조건: 남은 시도 횟수가 0 또는 사용 가능한 옵션이 없음
    if gem.remainingAttempts == 0 or not available_options:
        memo[key] = {
            'probabilities': base_probabilities,
            'availableOptions': available_options
        }
        # 새로운 계산 완료 시 진행 상황 출력
        calculation_counter += 1
        print(f"계산 완료: {calculation_counter:>5d}개 상태 ({key}) sum8+: {base_probabilities['sum8+']:.6f}, sum9+: {base_probabilities['sum9+']:.6f}, relic+: {base_probabilities['relic+']:.6f}, ancient+: {base_probabilities['ancient+']:.6f}")
        
        # 시각화 업데이트 (기저 조건 계산 완료 시)
        if visualizer:
            # key에서 상태 정보 파싱
            parts = key.split(',')
            if len(parts) == 10:
                wp, cp, dealerA, dealerB, supportA, supportB, attempts, reroll, cost, isFirst = map(int, parts)
                
                cost_idx = {-100: 0, 0: 1, 100: 2}.get(cost, 1)
                wp_idx = wp - 1
                cp_idx = cp - 1
                
                # 4개 옵션 조합 인덱스 계산 (정확히 2개만 활성화)
                active_options = []
                if dealerA > 0:
                    active_options.append(('dealerA', dealerA))
                if dealerB > 0:
                    active_options.append(('dealerB', dealerB))
                if supportA > 0:
                    active_options.append(('supportA', supportA))
                if supportB > 0:
                    active_options.append(('supportB', supportB))
                
                if len(active_options) == 2:
                    opt1_name, opt1_val = active_options[0]
                    opt2_name, opt2_val = active_options[1]
                    
                    combo_patterns = [
                        ('dealerA', 'dealerB'), ('dealerA', 'supportA'), ('dealerA', 'supportB'),
                        ('dealerB', 'supportA'), ('dealerB', 'supportB'), ('supportA', 'supportB')
                    ]
                    
                    current_pattern = (opt1_name, opt2_name)
                    if current_pattern in combo_patterns:
                        pattern_idx = combo_patterns.index(current_pattern)
                    else:
                        reversed_pattern = (opt2_name, opt1_name)
                        if reversed_pattern in combo_patterns:
                            pattern_idx = combo_patterns.index(reversed_pattern)
                            opt1_val, opt2_val = opt2_val, opt1_val
                        else:
                            pattern_idx = 0
                    
                    sub_combo_idx = (opt1_val - 1) * 5 + (opt2_val - 1)
                    option_idx = pattern_idx * 25 + sub_combo_idx
                else:
                    option_idx = 0
                
                sub_index = (cost_idx * 5 * 5 * 150 + 
                            wp_idx * 5 * 150 + 
                            cp_idx * 150 + 
                            option_idx)
                
                visualizer.update_progress(attempts, reroll, sub_index)
                
                if calculation_counter % 75 == 0:
                    visualizer.refresh_display()
        
        return base_probabilities
    
    # 실제 게임 로직: 4개 조합을 뽑고 그 중 하나를 25% 확률로 선택
    result = {target: 0.0 for target in targets}
    
    # 현재 옵션으로 진행하는 경우의 기댓값 계산
    def calculate_expected_value_with_options(options):
        expected = {target: 0.0 for target in targets}
        selection_probs = calculate_option_selection_probabilities(options, gem)
        
        for option in options:
            selection_prob = selection_probs[option['action']]
            if selection_prob > 0:
                next_gem = apply_processing(gem, option['action'])
                future_probs = calculate_probabilities(next_gem, memo)
                
                for target in targets:
                    expected[target] += selection_prob * future_probs[target]
        
        return expected
    
    # 현재 옵션으로 진행하는 경우
    current_expected = calculate_expected_value_with_options(available_options)
    
    # reroll이 가능한지 확인 (첫 시도에서는 불가능)
    can_reroll = gem.currentRerollAttempts > 0 and gem.remainingAttempts > 0 and not gem.isFirstProcessing
    
    # 각 목표별로 최적 선택 계산: 현재 상태 vs 진행 vs 리롤
    result = {}
    
    for target in targets:
        options_for_target = []
        
        # 선택지 1: 현재 상태에서 종료 (이미 달성했으면 1.0, 아니면 0.0)
        current_value = base_probabilities[target]
        options_for_target.append(current_value)
        
        # 선택지 2: 가공 진행
        progress_value = current_expected[target]
        options_for_target.append(progress_value)
        
        # 선택지 3: 리롤 (가능한 경우)
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
                isFirstProcessing=False  # 리롤 후에도 첫 가공이 아님
            )
            
            reroll_future_probs = calculate_probabilities(rerolled_gem, memo)
            reroll_value = reroll_future_probs[target]
            options_for_target.append(reroll_value)
        
        # 최적 선택
        result[target] = max(options_for_target)
    
    # 옵션 선택 확률도 함께 저장
    selection_probs = calculate_option_selection_probabilities(available_options, gem)
    
    # availableOptions에 선택 확률 추가
    options_with_probs = []
    for option in available_options:
        options_with_probs.append({
            'action': option['action'],
            'probability': option['probability'],
            'description': option.get('description', ''),
            'selectionProbability': selection_probs[option['action']]  # 실제로 선택될 확률
        })
    
    memo[key] = {
        'probabilities': result,
        'availableOptions': options_with_probs
    }
    
    # 새로운 계산 완료 시 진행 상황 출력
    calculation_counter += 1
    print(f"계산 완료: {calculation_counter:>5d}개 상태 ({key}) sum8+: {result['sum8+']:.6f}, sum9+: {result['sum9+']:.6f}, relic+: {result['relic+']:.6f}, ancient+: {result['ancient+']:.6f}")
    
    # 시각화 업데이트 (실제 계산 완료 시)
    if visualizer:
        # key에서 상태 정보 파싱: "wp,cp,dealerA,dealerB,supportA,supportB,attempts,reroll,cost,isFirst"
        parts = key.split(',')
        if len(parts) == 10:
            wp, cp, dealerA, dealerB, supportA, supportB, attempts, reroll, cost, isFirst = map(int, parts)
            
            # 서브 인덱스 계산
            cost_idx = {-100: 0, 0: 1, 100: 2}.get(cost, 1)
            wp_idx = wp - 1
            cp_idx = cp - 1
            
            # 4개 옵션 조합 인덱스 계산 (정확히 2개만 활성화)
            active_options = []
            if dealerA > 0:
                active_options.append(('dealerA', dealerA))
            if dealerB > 0:
                active_options.append(('dealerB', dealerB))
            if supportA > 0:
                active_options.append(('supportA', supportA))
            if supportB > 0:
                active_options.append(('supportB', supportB))
            
            # 활성화된 2개 옵션의 조합 패턴에 따라 인덱스 계산
            if len(active_options) == 2:
                opt1_name, opt1_val = active_options[0]
                opt2_name, opt2_val = active_options[1]
                
                # 6가지 조합 패턴
                combo_patterns = [
                    ('dealerA', 'dealerB'),
                    ('dealerA', 'supportA'), 
                    ('dealerA', 'supportB'),
                    ('dealerB', 'supportA'),
                    ('dealerB', 'supportB'),
                    ('supportA', 'supportB')
                ]
                
                # 현재 조합이 어떤 패턴인지 찾기
                current_pattern = (opt1_name, opt2_name)
                if current_pattern in combo_patterns:
                    pattern_idx = combo_patterns.index(current_pattern)
                else:
                    # 순서가 바뀐 경우
                    reversed_pattern = (opt2_name, opt1_name)
                    if reversed_pattern in combo_patterns:
                        pattern_idx = combo_patterns.index(reversed_pattern)
                        opt1_val, opt2_val = opt2_val, opt1_val  # 값도 순서 맞춤
                    else:
                        pattern_idx = 0  # fallback
                
                # 각 패턴 내에서 25가지 조합 (5 * 5)
                sub_combo_idx = (opt1_val - 1) * 5 + (opt2_val - 1)
                option_idx = pattern_idx * 25 + sub_combo_idx
            else:
                option_idx = 0  # fallback
            
            sub_index = (cost_idx * 5 * 5 * 150 + 
                        wp_idx * 5 * 150 + 
                        cp_idx * 150 + 
                        option_idx)
            
            visualizer.update_progress(attempts, reroll, sub_index)
            
            # 화면 갱신은 가끔만
            if calculation_counter % 100 == 0:
                visualizer.refresh_display()
    
    return result

def generate_probability_table(enable_visualization=True):
    """모든 가능한 젬 상태에 대한 확률 테이블 생성"""
    print("🎲 확률 테이블 생성 시작...")
    start_time = time.time()
    
    # 전역 카운터 초기화
    global calculation_counter, visualizer
    calculation_counter = 0
    
    # 시각화 초기화
    if enable_visualization:
        try:
            visualizer = ProgressVisualizer(max_attempts=10, max_rerolls=5)
            print("📊 진행 상황 시각화 활성화")
        except Exception as e:
            print(f"⚠️ 시각화 초기화 실패: {e}")
            visualizer = None
    
    probability_table = {}
    memo = {}
    total_states = 0
    
    # 모든 가능한 상태 순회 (Bottom-up: reroll부터, 그다음 remainingAttempts가 작은 것부터). 5*13*3*5*5*6*5*5=562500
    for currentRerollAttempts in range(5):  # 0~4 (리롤 횟수를 가장 먼저)
        for remainingAttempts in range(10):  # 0~9 (JavaScript와 일치)
            for costModifier in [-100, 0, 100]:  # 가능한 비용 수정값
                for willpower in range(1, 6):
                    for corePoint in range(1, 6):
                        for dealerA in range(0, 6):
                            for dealerB in range(0, 6):
                                for supportA in range(0, 6):
                                    for supportB in range(0, 6):
                                        # 4개 옵션 중 정확히 2개만 0이 아니어야 함 (유효한 젬 상태)
                                        non_zero_count = sum(1 for x in [dealerA, dealerB, supportA, supportB] if x > 0)
                                        if non_zero_count != 2:
                                            continue
                                                                                
                                        # remainingAttempts가 5,7,9일 때만 isFirstProcessing이 True일 수 있음
                                        for isFirstProcessing in ([True, False] if remainingAttempts in [5, 7, 9] else [False]):
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
                                                probs = calculate_probabilities(gem, memo)
                                                
                                                # 상태 키 생성 및 저장 (확률 + 사용가능 옵션)
                                                state_key = state_to_key(gem)
                                                if state_key in memo:
                                                    probability_table[state_key] = memo[state_key]
                                                else:
                                                    # fallback: 확률만 저장
                                                    probability_table[state_key] = {'probabilities': probs, 'availableOptions': []}
                                                    
                                                total_states += 1
                                                
                                            except Exception as e:
                                                print(f"\n❌ 에러 발생!")
                                                print(f"에러 메시지: {e}")
                                                print(f"현재 젬 상태:")
                                                print(f"  - willpower: {gem.willpower}")
                                                print(f"  - corePoint: {gem.corePoint}")
                                                print(f"  - dealerA: {gem.dealerA}")
                                                print(f"  - dealerB: {gem.dealerB}")
                                                print(f"  - supportA: {gem.supportA}")
                                                print(f"  - supportB: {gem.supportB}")
                                                print(f"  - remainingAttempts: {gem.remainingAttempts}")
                                                print(f"  - currentRerollAttempts: {gem.currentRerollAttempts}")
                                                print(f"  - isFirstProcessing: {gem.isFirstProcessing}")
                                                
                                                state_key = state_to_key(gem)
                                                print(f"\n상태 키: {state_key}")
                                                
                                                if state_key in memo:
                                                    print(f"memo[{state_key}] 내용:")
                                                    print(f"  - keys: {memo[state_key].keys()}")
                                                    if 'probabilities' in memo[state_key]:
                                                        print(f"  - probabilities: {memo[state_key]['probabilities']}")
                                                    if 'availableOptions' in memo[state_key]:
                                                        print(f"  - availableOptions 개수: {len(memo[state_key]['availableOptions'])}")
                                                else:
                                                    print(f"memo에 {state_key} 키가 없음")
                                                
                                                # option_selection_memo 상태 출력
                                                pattern_key = get_option_pattern_key(gem)
                                                print(f"\npattern_key: {pattern_key}")
                                                print(f"option_selection_memo 크기: {len(option_selection_memo)}")
                                                
                                                if pattern_key in option_selection_memo:
                                                    print(f"option_selection_memo[{pattern_key}] 내용:")
                                                    cached_probs = option_selection_memo[pattern_key]
                                                    for action, prob in cached_probs.items():
                                                        if prob > 0:
                                                            print(f"  - {action}: {prob:.6f}")
                                                else:
                                                    print(f"option_selection_memo에 {pattern_key} 키가 없음")
                                                    
                                                    # 에러를 다시 발생시켜 프로그램 중단
                                                    raise
    
    end_time = time.time()
    elapsed_time = end_time - start_time
    
    # 최종 시각화 업데이트
    if visualizer:
        visualizer.refresh_display()
        print("📊 시각화 완료 - 창을 닫으려면 아무 키나 누르세요")
    
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

def create_database_schema(db_path: str):
    """SQLite 데이터베이스 스키마 생성"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 젬 상태 테이블
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS gem_states (
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
            -- 확률들
            prob_5_5 REAL NOT NULL,
            prob_5_4 REAL NOT NULL,
            prob_4_5 REAL NOT NULL,
            prob_5_3 REAL NOT NULL,
            prob_4_4 REAL NOT NULL,
            prob_3_5 REAL NOT NULL,
            prob_sum8 REAL NOT NULL,
            prob_sum9 REAL NOT NULL,
            prob_relic REAL NOT NULL,
            prob_ancient REAL NOT NULL,
            UNIQUE(willpower, corePoint, dealerA, dealerB, supportA, supportB, 
                   remainingAttempts, currentRerollAttempts, costModifier, isFirstProcessing)
        )
    """)
    
    # 사용 가능한 옵션들 테이블
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS available_options (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            gem_state_id INTEGER NOT NULL,
            action TEXT NOT NULL,
            probability REAL NOT NULL,
            description TEXT NOT NULL,
            selectionProbability REAL NOT NULL,
            FOREIGN KEY (gem_state_id) REFERENCES gem_states (id)
        )
    """)
    
    # 인덱스 생성
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_willpower_corepoint 
        ON gem_states (willpower, corePoint)
    """)
    
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_probabilities 
        ON gem_states (prob_sum8, prob_sum9, prob_relic, prob_ancient)
    """)
    
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_attempts 
        ON gem_states (remainingAttempts, currentRerollAttempts)
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
        
        # 젬 상태 저장
        cursor.execute("""
            INSERT OR REPLACE INTO gem_states (
                willpower, corePoint, dealerA, dealerB, supportA, supportB,
                remainingAttempts, currentRerollAttempts, costModifier, isFirstProcessing,
                prob_5_5, prob_5_4, prob_4_5, prob_5_3, prob_4_4, prob_3_5,
                prob_sum8, prob_sum9, prob_relic, prob_ancient
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            wp, cp, dealerA, dealerB, supportA, supportB,
            attempts, reroll, cost, isFirstProcessing,
            probabilities.get('5/5', 0.0),
            probabilities.get('5/4', 0.0),
            probabilities.get('4/5', 0.0),
            probabilities.get('5/3', 0.0),
            probabilities.get('4/4', 0.0),
            probabilities.get('3/5', 0.0),
            probabilities.get('sum8+', 0.0),
            probabilities.get('sum9+', 0.0),
            probabilities.get('relic+', 0.0),
            probabilities.get('ancient+', 0.0)
        ))
        
        gem_state_id = cursor.lastrowid
        
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
        
        processed += 1
        if processed % 1000 == 0:
            print(f"진행: {processed}/{total_states} ({processed/total_states*100:.1f}%)")
            conn.commit()
    
    conn.commit()
    conn.close()
    
    # 파일 크기 확인
    import os
    file_size_mb = os.path.getsize(db_path) / 1024 / 1024
    print(f"💾 데이터베이스 저장 완료: {db_path} ({file_size_mb:.1f} MB)")

def query_database_examples(db_path: str):
    """데이터베이스 쿼리 예제들"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("\n📊 데이터베이스 쿼리 예제들:")
    
    # 1. 가장 높은 ancient+ 확률을 가진 상태들
    cursor.execute("""
        SELECT willpower, corePoint, dealerA, dealerB, supportA, supportB, 
               remainingAttempts, prob_ancient
        FROM gem_states 
        WHERE prob_ancient > 0.5
        ORDER BY prob_ancient DESC 
        LIMIT 5
    """)
    
    print("\n🏆 Ancient+ 확률 0.5 이상인 상위 5개 상태:")
    for row in cursor.fetchall():
        wp, cp, dA, dB, sA, sB, att, prob = row
        print(f"  {wp}/{cp} [{dA},{dB},{sA},{sB}] 시도:{att} → {prob:.3f}")
    
    # 2. 특정 조건의 통계
    cursor.execute("""
        SELECT 
            COUNT(*) as total_states,
            AVG(prob_sum8) as avg_sum8,
            AVG(prob_sum9) as avg_sum9,
            AVG(prob_relic) as avg_relic,
            AVG(prob_ancient) as avg_ancient
        FROM gem_states 
        WHERE remainingAttempts >= 3
    """)
    
    result = cursor.fetchone()
    print(f"\n📈 남은 시도 3+ 상태들의 평균 확률:")
    print(f"  총 상태 수: {result[0]}")
    print(f"  Sum8+ 평균: {result[1]:.3f}")
    print(f"  Sum9+ 평균: {result[2]:.3f}") 
    print(f"  Relic+ 평균: {result[3]:.3f}")
    print(f"  Ancient+ 평균: {result[4]:.3f}")
    
    conn.close()

if __name__ == "__main__":
    # 시각화 옵션 확인
    enable_viz = '--no-viz' not in sys.argv
    
    try:
        # 확률 테이블 생성
        table = generate_probability_table(enable_visualization=enable_viz)
        
        # JSON 파일로 저장
        json_file = "./probability_table.json"
        save_to_json(table, json_file)
        
        # SQLite 데이터베이스로 저장
        db_file = "./probability_table.db"
        create_database_schema(db_file)
        save_to_database(table, db_file)
        
        # 쿼리 예제 실행
        query_database_examples(db_file)
        
        print(f"\n🚀 사용법:")
        print(f"JSON: {json_file}을 프로젝트에서 import")
        print(f"DB: {db_file}를 SQLite로 쿼리")
        print(f"예: SELECT * FROM gem_states WHERE prob_ancient > 0.8 ORDER BY prob_ancient DESC;")
        
    finally:
        # 시각화 정리 및 영상 생성
        if visualizer:
            if enable_viz:
                print("🎬 계산 완료! 영상을 생성합니다...")
                visualizer.create_video("gem_calculation_progress.mp4", fps=30)
            visualizer.close()