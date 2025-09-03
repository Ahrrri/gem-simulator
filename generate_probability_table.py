#!/usr/bin/env python3
"""
젬 가공 확률 테이블을 사전 계산하여 JSON 파일로 저장하는 스크립트

모든 가능한 젬 상태 (27,500개)에 대해 확률을 계산하여 정적 파일로 저장합니다.
브라우저에서는 이 파일을 로드하여 즉시 확률을 조회할 수 있습니다.
"""

import time
import sys
import inspect
import threading
import sqlite3
import numpy as np
import matplotlib
import matplotlib.pyplot as plt
import random
from matplotlib.colors import LinearSegmentedColormap, ListedColormap
from typing import Dict, Any, Tuple, List
from dataclasses import dataclass
from itertools import combinations, permutations
from math import comb

# 상수 정의
MAX_REROLL_ATTEMPTS = 7  # 전체 상태 생성 시 고려하는 최대 리롤 횟수 (0~6)
MAX_REROLL_FOR_MEMOIZATION = MAX_REROLL_ATTEMPTS - 1  # 메모이제이션 효율성을 위한 리롤 횟수 상한 (6)
import shutil
import os

try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False

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
    elif 'costModifier' in condition:
        if '< 100' in condition:
            return gem.costModifier < 100
        else:
            return gem.costModifier > -100
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
            new_gem.dealerA = max(1, new_gem.dealerA - change)
        elif action == 'dealerA_change':
            # 4개 옵션 중에서 현재 0인 다른 옵션으로 이동
            current_options = ['dealerA', 'dealerB', 'supportA', 'supportB']
            inactive_options = [opt for opt in current_options if getattr(new_gem, opt) == 0]
            
            if inactive_options:
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
            new_gem.dealerB = max(1, new_gem.dealerB - change)
        elif action == 'dealerB_change':
            current_options = ['dealerA', 'dealerB', 'supportA', 'supportB']
            inactive_options = [opt for opt in current_options if getattr(new_gem, opt) == 0]
            
            if inactive_options:
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
            new_gem.supportA = max(1, new_gem.supportA - change)
        elif action == 'supportA_change':
            current_options = ['dealerA', 'dealerB', 'supportA', 'supportB']
            inactive_options = [opt for opt in current_options if getattr(new_gem, opt) == 0]
            
            if inactive_options:
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
            new_gem.supportB = max(1, new_gem.supportB - change)
        elif action == 'supportB_change':
            current_options = ['dealerA', 'dealerB', 'supportA', 'supportB']
            inactive_options = [opt for opt in current_options if getattr(new_gem, opt) == 0]
            
            if inactive_options:
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
start_time = None


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
        
        # 진행 상황 배열 (0: 미완료, 1: 계산 완료, 2: 메모이제이션 히트)
        self.progress = np.zeros((self.image_height, self.image_width))
        
        # matplotlib 설정 (headless mode)
        matplotlib.use('Agg')  # GUI 없이 이미지만 생성
        plt.ioff()  # 비인터랙티브 모드
        self.fig, self.ax = plt.subplots(figsize=(15, 8), dpi=100)
        
        # 커스텀 컬러맵: 0(검은색)=미완료, 1(초록색)=계산완료, 2(파란색)=메모히트
        colors = ['black', 'green', 'blue']
        custom_cmap = ListedColormap(colors)
        
        self.im = self.ax.imshow(self.progress, cmap=custom_cmap, vmin=0, vmax=2)
        
        # 실시간 영상 생성 설정
        self.frame_counter = 0
        self.video_writer = None
        self.output_filename = "gem_calculation_progress.mp4"
        self.fps = 60
        
        # OpenCV 비디오 라이터 초기화
        if CV2_AVAILABLE:
            try:
                # 이미지 크기 결정 (matplotlib figure 크기 기반)
                self.fig.canvas.draw()
                # Agg backend를 사용하여 배열 가져오기
                canvas = self.fig.canvas
                width, height = canvas.get_width_height()
                buf = np.frombuffer(canvas.buffer_rgba(), dtype=np.uint8) # type: ignore
                buf = buf.reshape((height, width, 4))  # RGBA
                buf_rgb = buf[:, :, :3]  # RGB로 변환
                height, width = buf_rgb.shape[:2]
                
                # 비디오 라이터 생성
                fourcc = cv2.VideoWriter_fourcc(*'mp4v') # type: ignore
                self.video_writer = cv2.VideoWriter(self.output_filename, fourcc, self.fps, (width, height))
                print(f"📹 실시간 영상 생성 시작: {self.output_filename} ({width}x{height})")
                
            except Exception as e:
                print(f"⚠️ 비디오 라이터 초기화 실패: {e}")
                self.video_writer = None
        else:
            print("⚠️ OpenCV가 설치되지 않았습니다. 실시간 영상 생성이 비활성화됩니다.")
            self.video_writer = None
        
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
        
    def update_progress(self, remaining_attempts, current_rerolls, sub_index, progress_type='calculated'):
        """특정 위치의 서브 셀 하나를 완료로 표시"""
        # 서브그리드 내 위치 계산 (125 x 90 격자)
        sub_x = sub_index % self.sub_grid_width
        sub_y = sub_index // self.sub_grid_width
        
        # 전체 이미지에서의 실제 위치
        actual_x = remaining_attempts * self.sub_grid_width + sub_x
        actual_y = current_rerolls * self.sub_grid_height + sub_y
        
        # 상태 표시 (1: 계산 완료, 2: 메모이제이션 히트)
        if actual_y < self.image_height and actual_x < self.image_width:
            if progress_type == 'memo_hit':
                self.progress[actual_y, actual_x] = 2  # 파란색
            else:
                self.progress[actual_y, actual_x] = 1  # 초록색
            
    def refresh_display(self):
        """프레임을 실시간으로 영상에 추가"""
        self.im.set_data(self.progress)
        
        if self.video_writer:
            try:
                # matplotlib figure를 numpy 배열로 변환
                self.fig.canvas.draw()
                canvas = self.fig.canvas
                width, height = canvas.get_width_height()
                
                # Agg backend에서 buffer_rgba() 사용
                buf = np.frombuffer(canvas.buffer_rgba(), dtype=np.uint8) # type: ignore
                buf = buf.reshape((height, width, 4))  # RGBA
                
                # RGBA를 RGB로 변환 (알파 채널 제거)
                buf_rgb = buf[:, :, :3]
                
                # RGB를 BGR로 변환 (OpenCV 형식)
                frame_bgr = cv2.cvtColor(buf_rgb, cv2.COLOR_RGB2BGR)
                
                # 영상에 프레임 추가
                self.video_writer.write(frame_bgr)
                self.frame_counter += 1
                    
            except Exception as e:
                print(f"⚠️ 프레임 추가 실패: {e}")
                # 비디오 라이터 비활성화
                self.video_writer = None
        
        # 프레임 카운터 증가 및 로그 출력 (try 블록 외부에서)
        if self.video_writer and self.frame_counter % 100 == 0:
            print(f"🎬 영상 프레임 {self.frame_counter}개 추가됨")
        
        # 프레임 생성 후 파란색(메모 히트) 셀들을 초록색으로 변경
        self.progress[self.progress == 2] = 1
        
    def save_current_video(self, suffix=""):
        """현재까지의 영상을 저장 (중간 저장용)"""
        if self.video_writer:
            try:
                # 현재 비디오 라이터 해제
                temp_writer = self.video_writer
                self.video_writer = None
                temp_writer.release()
                
                # 파일명 생성
                if suffix:
                    base_name = self.output_filename.replace('.mp4', f'_{suffix}.mp4')
                else:
                    base_name = self.output_filename.replace('.mp4', f'_frame_{self.frame_counter}.mp4')
                    
                # 기존 파일을 새 이름으로 복사
                if os.path.exists(self.output_filename):
                    shutil.copy2(self.output_filename, base_name)
                    print(f"💾 중간 영상 저장: {base_name} ({self.frame_counter}프레임)")
                
                # 비디오 라이터 재초기화
                fourcc = cv2.VideoWriter_fourcc(*'mp4v') # type: ignore
                self.fig.canvas.draw()
                canvas = self.fig.canvas
                width, height = canvas.get_width_height()
                buf = np.frombuffer(canvas.buffer_rgba(), dtype=np.uint8) # type: ignore
                buf = buf.reshape((height, width, 4))  # RGBA
                buf_rgb = buf[:, :, :3]  # RGB로 변환
                height, width = buf_rgb.shape[:2]
                self.video_writer = cv2.VideoWriter(self.output_filename, fourcc, self.fps, (width, height))
                
            except Exception as e:
                print(f"⚠️ 중간 영상 저장 실패: {e}")
    
    def close(self):
        """시각화 종료 및 최종 영상 저장"""
        if self.video_writer:
            self.video_writer.release()
            print(f"🎬 최종 영상 완료: {self.output_filename} ({self.frame_counter}프레임)")
        plt.close(self.fig)
        

# 전역 시각화 객체
visualizer = None

# 메모이제이션 히트 버퍼 (배치 처리용)
memo_hit_buffer = set()  # state_key들을 저장

def update_visualization_progress(state_key: str, is_memo_hit: bool = False):
    """시각화 진행상황 업데이트"""
    global visualizer
    
    if not visualizer:
        return
        
    try:
        # key에서 상태 정보 파싱: "wp,cp,dealerA,dealerB,supportA,supportB,attempts,reroll,cost,isFirst"
        parts = state_key.split(',')
        if len(parts) != 10:
            return
            
        wp, cp, dealerA, dealerB, supportA, supportB, attempts, reroll, cost, _ = map(int, parts)
        
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
        
        # 메모이제이션 히트 여부에 따라 다른 값으로 업데이트
        if is_memo_hit:
            visualizer.update_progress(attempts, reroll, sub_index, progress_type='memo_hit')
        else:
            visualizer.update_progress(attempts, reroll, sub_index, progress_type='calculated')
            
    except Exception as e:
        # 시각화 오류가 전체 계산을 망가뜨리지 않도록
        print(f"시각화 업데이트 오류: {e}")
        pass

def flush_memo_hits_to_visualization():
    """버퍼에 쌓인 메모 히트들을 일괄 시각화 처리"""
    global memo_hit_buffer
    
    if not memo_hit_buffer:
        return 0
        
    memo_hit_count = len(memo_hit_buffer)
    
    # 모든 메모 히트를 시각화
    for state_key in memo_hit_buffer:
        update_visualization_progress(state_key, is_memo_hit=True)
    
    # 버퍼 클리어
    memo_hit_buffer.clear()
    
    return memo_hit_count

def create_generalized_gem_pattern(gem: GemState) -> str:
    """젬을 일반화된 패턴으로 변환 (combo_memo용)"""
    # 활성 옵션들 추출
    active_options = []
    if gem.dealerA > 0:
        active_options.append(('dealerA', gem.dealerA))
    if gem.dealerB > 0:
        active_options.append(('dealerB', gem.dealerB))
    if gem.supportA > 0:
        active_options.append(('supportA', gem.supportA))
    if gem.supportB > 0:
        active_options.append(('supportB', gem.supportB))
    
    # 레벨 기준으로 정렬 (높은 레벨부터)
    active_options.sort(key=lambda x: (-x[1], x[0]))
    
    # 일반화된 패턴 생성
    option_levels = [str(level) for _, level in active_options]
    option_pattern = ','.join(option_levels) if option_levels else '0,0'
    
    # remainingAttempts는 1보다 큰지만 확인
    has_attempts = 1 if gem.remainingAttempts > 1 else 0
    
    return f"{gem.willpower},{gem.corePoint},{option_pattern},{has_attempts},{gem.costModifier}"

def state_to_key(gem: GemState) -> str:
    """젬 상태를 키 문자열로 변환 (4개 옵션 시스템, 리롤 횟수는 상한까지만)"""
    # 리롤 횟수는 상한 이상을 모두 상한으로 간주 (메모이제이션 효율성)
    capped_reroll = min(MAX_REROLL_FOR_MEMOIZATION, gem.currentRerollAttempts)
    first_processing = 1 if gem.isFirstProcessing else 0
    return f"{gem.willpower},{gem.corePoint},{gem.dealerA},{gem.dealerB},{gem.supportA},{gem.supportB},{gem.remainingAttempts},{capped_reroll},{gem.costModifier},{first_processing}"


def calculate_probabilities(gem: GemState, memo: Dict[str, Dict], combo_memo: Dict[str, Dict]) -> Dict[str, float]:
    """재귀적으로 확률을 계산. 매우 중요: 여기서의 확률은 아직 옵션 4개를 보지 못한 상태임"""
    global calculation_counter, visualizer
    
    key = state_to_key(gem)
    if key in memo:
        # 메모이제이션 히트 - 버퍼에 저장 (배치 처리용)
        global memo_hit_buffer
        memo_hit_buffer.add(key)
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
        'ancient+': (gem.willpower + gem.corePoint + gem.dealerA + gem.dealerB + gem.supportA + gem.supportB) >= 19,
        'dealer_active': gem.dealerA > 0 and gem.dealerB > 0,
        'support_active': gem.supportA > 0 and gem.supportB > 0
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
        
        # 버퍼에 쌓인 메모 히트들을 일괄 처리
        memo_hit_count = flush_memo_hits_to_visualization()
        
        available_options = get_available_options(gem)
        total_combo_count = sum(len(combos) for combos in combo_memo.values())
        elapsed_time = time.time() - start_time if start_time else 0
        avg_time_per_state = elapsed_time / calculation_counter if calculation_counter > 0 else 0
        available_count = len(available_options)
        combo_4_count = comb(available_count, 4) if available_count >= 4 else 0
        print(f"기저 조건: {calculation_counter:>5d}개 상태 ({key}) "
              f"sum8+: {base_probabilities['sum8+']:.6f}, sum9+: {base_probabilities['sum9+']:.6f}, "
              f"relic+: {base_probabilities['relic+']:.6f}, ancient+: {base_probabilities['ancient+']:.6f}, "
              f"dealer: {base_probabilities['dealer_active']:.6f}, support: {base_probabilities['support_active']:.6f}, "
              f"memo_hit: {memo_hit_count:2d}개, combo_memo: {len(combo_memo)}패턴/{total_combo_count}조합, "
              f"options: {available_count}개, 4조합: {combo_4_count}개, "
              f"경과시간: {elapsed_time:.2f}s, 평균: {avg_time_per_state * 1000:.3f}s/1000 상태")
        
        # 시각화 업데이트 (기저 조건 계산 완료 시)
        update_visualization_progress(key, is_memo_hit=False)
        
        if visualizer:
            visualizer.refresh_display()
            
        # 중간 영상 저장 (1만개마다)
        if calculation_counter % 10000 == 0 and visualizer:
            visualizer.save_current_video(f"checkpoint_{calculation_counter}")
        
        return base_probabilities
    
    # 실제 게임 로직: 4개 조합을 뽑고 그 중 하나를 25% 확률로 선택
    result = {target: 0.0 for target in targets}
    
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
        reroll_future_probs = calculate_probabilities(rerolled_gem, memo, combo_memo)
    
    # 모든 target에 대한 결과 초기화
    for target in targets:
        result[target] = 0.0
    
    # 전역 젬 패턴별 조합 확률 메모이제이션 사용
    generalized_gem_pattern = create_generalized_gem_pattern(gem)
    
    # 조합 확률들 계산 또는 캐시에서 가져오기
    combo_probs = {}
    if generalized_gem_pattern in combo_memo:
        # 캐시된 조합 확률들 사용
        combo_probs = combo_memo[generalized_gem_pattern]
    else:
        # 새로운 젬 패턴 - 모든 4개 조합 확률 미리 계산
        for combo_indices in combinations(range(len(available_options)), 4):
            combo_prob = calculate_4combo_probability(
                list(combo_indices), 
                [opt['probability'] for opt in available_options]
            )
            combo_probs[combo_indices] = combo_prob
        
        # 조합 확률들을 메모이제이션에 저장
        combo_memo[generalized_gem_pattern] = combo_probs
    
    # 모든 4개 조합에 대해 실제 확률 계산
    for combo_indices, combo_prob in combo_probs.items():
        combo_options = [available_options[i] for i in combo_indices]
        
        # 이 조합의 각 옵션별 미래 확률 계산
        combo_future_probs = {}
        for option in combo_options:
            next_gem = apply_processing(gem, option['action'])
            future_probs = calculate_probabilities(next_gem, memo, combo_memo)
            combo_future_probs[option['action']] = future_probs
        
        # 모든 target에 대해 이 조합의 기여도 계산
        for target in targets:
            # 이 조합에서의 진행 확률 (4개 중 균등 선택)
            combo_progress_value = 0.0
            for option in combo_options:
                combo_progress_value += combo_future_probs[option['action']][target] * 0.25
            
            # 이 조합에서 최적 선택 (현재 상태, 진행, 리롤 중)
            combo_options_list = [base_probabilities[target], combo_progress_value]
            if can_reroll and reroll_future_probs:
                combo_options_list.append(reroll_future_probs[target])
            
            combo_best = max(combo_options_list)
            result[target] += combo_prob * combo_best
    
    # 선택 확률 계산 (조합 확률 재사용)
    selection_probs = {opt['action']: 0.0 for opt in available_options}
    for combo_indices, combo_prob in combo_probs.items():
        for idx in combo_indices:
            selection_probs[available_options[idx]['action']] += combo_prob * 0.25
    
    # availableOptions에 선택 확률 추가
    options_with_probs = []
    for option in available_options:
        options_with_probs.append({
            'action': option['action'],
            'probability': option['probability'],
            'description': option.get('description', ''),
            'selectionProbability': selection_probs[option['action']]  # 실제로 더 이상 리롤하지 않았을 때 선택될 확률
        })
    
    memo[key] = {
        'probabilities': result,
        'availableOptions': options_with_probs
    }
    
    # 새로운 계산 완료 시 진행 상황 출력
    calculation_counter += 1
    
    # 버퍼에 쌓인 메모 히트들을 일괄 처리
    memo_hit_count = flush_memo_hits_to_visualization()
        
    total_combo_count = sum(len(combos) for combos in combo_memo.values())
    elapsed_time = time.time() - start_time if start_time else 0
    avg_time_per_state = elapsed_time / calculation_counter if calculation_counter > 0 else 0
    available_count = len(available_options)
    combo_4_count = comb(available_count, 4) if available_count >= 4 else 0
    print(f"계산 완료: {calculation_counter:>5d}개 상태 ({key}) "
          f"sum8+: {result['sum8+']:.6f}, sum9+: {result['sum9+']:.6f}, "
          f"relic+: {result['relic+']:.6f}, ancient+: {result['ancient+']:.6f}, "
          f"dealer: {result['dealer_active']:.6f}, support: {result['support_active']:.6f}, "
          f"memo_hit: {memo_hit_count:2d}개, combo_memo: {len(combo_memo)}패턴/{total_combo_count}조합, "
          f"options: {available_count}개, 4조합: {combo_4_count}개, "
          f"경과시간: {elapsed_time:.2f}s, 평균: {avg_time_per_state * 1000:.3f}s/1000 상태")
    
    # 시각화 업데이트 (실제 계산 완료 시)
    update_visualization_progress(key, is_memo_hit=False)
    
    # 화면 갱신은 가끔만
    if visualizer:
        visualizer.refresh_display()
        
    # 중간 영상 저장 (1만개마다)
    if calculation_counter % 10000 == 0 and visualizer:
        visualizer.save_current_video(f"checkpoint_{calculation_counter}")
    
    return result

def generate_probability_table(enable_visualization=True):
    """모든 가능한 젬 상태에 대한 확률 테이블 생성"""
    print("🎲 확률 테이블 생성 시작...")
    
    # 전역 카운터 초기화
    global calculation_counter, visualizer, start_time
    calculation_counter = 0
    start_time = time.time()  # 전역 시작 시간 설정
    
    # 시각화 초기화
    if enable_visualization:
        try:
            visualizer = ProgressVisualizer(max_attempts=10, max_rerolls=MAX_REROLL_ATTEMPTS)
            print("📊 진행 상황 시각화 활성화")
            time.sleep(3)
        except Exception as e:
            print(f"⚠️ 시각화 초기화 실패: {e}")
            visualizer = None
    
    probability_table = {}
    memo = {}
    combo_memo = {}  # 조합 메모이제이션
    total_states = 0
    
    # 모든 가능한 상태 순회 (Bottom-up: reroll부터, 그다음 remainingAttempts가 작은 것부터). 5*10*3*5*5*6*5*5+a=562500+a
    for currentRerollAttempts in range(MAX_REROLL_ATTEMPTS):  # 0~(MAX_REROLL_ATTEMPTS-1) (리롤 횟수를 가장 먼저)
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
                                        # 그리고 isFirstProcessing=True일 때는 모든 값의 합이 4여야 함 (초기 상태)
                                        total_values = willpower + corePoint + dealerA + dealerB + supportA + supportB
                                        possible_first = [True, False] if (remainingAttempts in [5, 7, 9] and total_values == 4) else [False]
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
                                                probs = calculate_probabilities(gem, memo, combo_memo)
                                                
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
            prob_dealer_active REAL NOT NULL,
            prob_support_active REAL NOT NULL,
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
                prob_sum8, prob_sum9, prob_relic, prob_ancient, prob_dealer_active, prob_support_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            probabilities.get('ancient+', 0.0),
            probabilities.get('dealer_active', 0.0),
            probabilities.get('support_active', 0.0)
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
        
        # SQLite 데이터베이스로 저장
        db_file = f"./probability_table_reroll_{MAX_REROLL_FOR_MEMOIZATION}.db"
        create_database_schema(db_file)
        save_to_database(table, db_file)
        
        # 쿼리 예제 실행
        query_database_examples(db_file)
        
        print(f"\n🚀 사용법:")
        print(f"DB: {db_file}를 SQLite로 쿼리")
        print(f"예: SELECT * FROM gem_states WHERE prob_ancient > 0.8 ORDER BY prob_ancient DESC;")
        
    finally:
        # 시각화 정리
        if visualizer:
            print("🎬 시각화 완료!")
            visualizer.close()