#!/usr/bin/env node
/**
 * 로컬 시뮬레이션 공통 유틸리티 함수들
 * 
 * SQLite DB와 상호작용하는 공통 함수들과 상수들을 모아둠
 */

import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import { applyGemAction, rerollProcessingOptions } from '../utils/gemProcessing.js';
import { PROCESSING_POSSIBILITIES } from '../utils/gemConstants.js';

// ES 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SQLite 데이터베이스 연결
let db = null;
const probabilityCache = new Map();
let MAX_REROLL = 7; // 기본값

try {
  const dbPath = path.join(__dirname, '../../probability_table_reroll_7.db');
  
  const rerollMatch = dbPath.match(/reroll_(\d+)\.db/);
  if (rerollMatch) {
    MAX_REROLL = parseInt(rerollMatch[1]);
  }
  
  db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
} catch (error) {
  console.error('❌ 데이터베이스 연결 실패:', error.message);
  process.exit(1);
}

// 젬 등급별 구매 비용 설정
export const GEM_PURCHASE_COSTS = {
  uncommon: 1000,
  rare: 2500, 
  heroic: 5000
};

// 목표 정의
export const GOALS = {
  '5/5': '의지력 5, 코어포인트 5',
  '5/4': '의지력 5, 코어포인트 4',
  '4/5': '의지력 4, 코어포인트 5',
  '5/3': '의지력 5, 코어포인트 3',
  '4/4': '의지력 4, 코어포인트 4',
  '3/5': '의지력 3, 코어포인트 5',
  'sum8+': '의지력+코어포인트 8 이상',
  'sum9+': '의지력+코어포인트 9 이상',
  'relic+': '유물 (16포인트) 이상',
  'ancient+': '고대 (19포인트) 이상',
  'dealer_complete': '딜러 종결 젬',
  'support_complete': '서폿 종결 젬'
};

// 젬 등급별 기본 설정
export const GEM_CONFIGS = {
  UNCOMMON: {
    maxProcessingAttempts: 5,
    maxRerollAttempts: 0
  },
  RARE: {
    maxProcessingAttempts: 7,
    maxRerollAttempts: 1
  },
  HEROIC: {
    maxProcessingAttempts: 9,
    maxRerollAttempts: 2
  }
};

// 목표 키를 SQLite 컬럼명으로 변환
export const goalKeyToColumn = (goalKey) => {
  const mapping = {
    '5/5': 'prob_5_5',
    '5/4': 'prob_5_4', 
    '4/5': 'prob_4_5',
    '5/3': 'prob_5_3',
    '4/4': 'prob_4_4',
    '3/5': 'prob_3_5',
    'sum8+': 'prob_sum8',
    'sum9+': 'prob_sum9',
    'relic+': 'prob_relic',
    'ancient+': 'prob_ancient',
    'dealer_complete': 'prob_dealer_complete',
    'support_complete': 'prob_support_complete',
  };
  return mapping[goalKey] || null;
};

// 젬 상태를 키로 변환
export const stateToKey = (gem) => {
  const cappedReroll = Math.min(MAX_REROLL, gem.currentRerollAttempts || 0);
  const firstProcessing = (gem.processingCount || 0) === 0 ? 1 : 0;
  
  return `${gem.willpower || 1},${gem.corePoint || 1},${gem.dealerA || 0},${gem.dealerB || 0},${gem.supportA || 0},${gem.supportB || 0},${gem.remainingAttempts || 0},${cappedReroll},${gem.costModifier || 0},${firstProcessing}`;
};

// 확률과 예상비용 조회 함수 (최적화된 버전)
export const getLocalProbabilityAndCost = (gem, goalKey) => {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve({ probability: 0, expectedCost: Infinity });
      return;
    }
    
    const columnName = goalKeyToColumn(goalKey);
    if (!columnName) {
      resolve({ probability: 0, expectedCost: Infinity });
      return;
    }
    
    // 캐시 키 생성
    const cacheKey = `${stateToKey(gem)}_${goalKey}_full`;
    
    // 캐시에서 확인
    if (probabilityCache.has(cacheKey)) {
      resolve(probabilityCache.get(cacheKey));
      return;
    }
    
    // DB에서 확률과 예상비용을 한 번에 조회
    const cappedReroll = Math.min(MAX_REROLL, gem.currentRerollAttempts || 0);
    const firstProcessing = (gem.processingCount || 0) === 0 ? 1 : 0;
    
    // 먼저 gem_state_id를 찾고, 그것으로 expected_cost 조회
    db.get(
      `SELECT id, ${columnName} FROM goal_probabilities 
       WHERE willpower = ? AND corePoint = ? AND dealerA = ? AND dealerB = ? 
       AND supportA = ? AND supportB = ? AND remainingAttempts = ? 
       AND currentRerollAttempts = ? AND costModifier = ? AND isFirstProcessing = ?`,
      [
        gem.willpower || 1, gem.corePoint || 1,
        gem.dealerA || 0, gem.dealerB || 0,
        gem.supportA || 0, gem.supportB || 0,
        gem.remainingAttempts || 0, cappedReroll,
        gem.costModifier || 0, firstProcessing
      ],
      (err, row) => {
        if (err) {
          console.error('DB 쿼리 오류:', err);
          resolve({ probability: 0, expectedCost: Infinity });
          return;
        }
        
        if (!row) {
          const result = { probability: 0, expectedCost: Infinity };
          probabilityCache.set(cacheKey, result);
          resolve(result);
          return;
        }
        
        // 확률 계산
        const probability = row[columnName] ? parseFloat(row[columnName]) * 100 : 0;
        const gemStateId = row.id;
        
        // expected_cost 조회
        db.get(
          `SELECT expected_cost_to_goal FROM expected_costs 
           WHERE gem_state_id = ? AND target = ?`,
          [gemStateId, goalKey],
          (err, costRow) => {
            let expectedCost = Infinity;
            if (!err && costRow && costRow.expected_cost_to_goal !== null) {
              expectedCost = parseFloat(costRow.expected_cost_to_goal);
            }
            
            const result = { probability, expectedCost };
            
            // 캐시에 저장
            probabilityCache.set(cacheKey, result);
            resolve(result);
          }
        );
      }
    );
  });
};

// 목표 달성 여부 확인
export const checkGoalAchieved = (gem, goalKey) => {
  if (!gem) return false;
  
  const willpower = gem.willpower || 1;
  const corePoint = gem.corePoint || 1;
  const dealerA = gem.dealerA || 0;
  const dealerB = gem.dealerB || 0;
  const supportA = gem.supportA || 0;
  const supportB = gem.supportB || 0;
  const totalPoints = willpower + corePoint + dealerA + dealerB + supportA + supportB;
  
  switch (goalKey) {
    case '5/5':
      return willpower >= 5 && corePoint >= 5;
    case '5/4':
      return willpower >= 5 && corePoint >= 4;
    case '4/5':
      return willpower >= 4 && corePoint >= 5;
    case '5/3':
      return willpower >= 5 && corePoint >= 3;
    case '4/4':
      return willpower >= 4 && corePoint >= 4;
    case '3/5':
      return willpower >= 3 && corePoint >= 5;
    case 'sum8+':
      return (willpower + corePoint) >= 8;
    case 'sum9+':
      return (willpower + corePoint) >= 9;
    case 'relic+':
      return totalPoints >= 16;
    case 'ancient+':
      return totalPoints >= 19;
    case 'dealer_complete':
      return willpower + corePoint + dealerA + dealerB == 20;
    case 'support_complete':
      return willpower + corePoint + supportA + supportB == 20;
    default:
      return false;
  }
};

// 로컬 버전의 loadOptionProbabilities (확률과 비용을 함께 조회하는 개선된 버전)
export const loadLocalOptionProbabilities = async (gem, options) => {
  if (!options || options.length === 0) {
    return null;
  }

  const optionsWithProbabilities = [];
  
  for (const option of options) {
    try {
      // 각 옵션을 적용한 결과 젬 상태 계산
      const resultGem = applyGemAction(JSON.parse(JSON.stringify(gem)), option.action);
      
      // 모든 목표에 대한 확률과 예상비용 조회
      const resultProbabilities = {};
      const resultExpectedCosts = {};
      
      for (const goalKey of Object.keys(GOALS)) {
        const result = await getLocalProbabilityAndCost(resultGem, goalKey);
        resultProbabilities[goalKey] = {
          value: result.probability / 100,
          percent: result.probability.toFixed(4)
        };
        resultExpectedCosts[goalKey] = result.expectedCost;
      }
      
      optionsWithProbabilities.push({
        ...option,
        resultGem,
        resultProbabilities,
        resultExpectedCosts
      });
    } catch (error) {
      console.error('옵션 확률 계산 오류:', error);
    }
  }
  
  return optionsWithProbabilities;
};

// 데이터베이스 정리 함수
export const closeDatabase = () => {
  if (db) {
    db.close((err) => {
      if (err) console.error('DB 연결 종료 오류:', err);
      else console.log('📦 데이터베이스 연결 종료');
    });
  }
};

// 캐시 크기 조회
export const getCacheSize = () => probabilityCache.size;

// 주어진 젬 상태에서 사용 가능한 옵션들 반환
export const getAvailableOptions = (gem) => {
  const options = [];
  for (const [action, config] of Object.entries(PROCESSING_POSSIBILITIES)) {
    if (typeof config.condition === 'function' && config.condition(gem)) {
      options.push({
        action: action,
        probability: config.probability
      });
    }
  }
  return options;
};

// 로컬 버전의 loadRerollProbabilities
export const loadLocalRerollProbabilities = async (gem) => {
  try {
    // 리롤을 실행했을 때의 상태 (리롤 횟수 1 감소)
    const rerollGem = {
      ...gem,
      currentRerollAttempts: Math.max(0, (gem.currentRerollAttempts || 0) - 1)
    };
    
    const rerollProbabilities = {};
    
    for (const goalKey of Object.keys(GOALS)) {
      const result = await getLocalProbabilityAndCost(rerollGem, goalKey);
      rerollProbabilities[goalKey] = {
        value: result.probability / 100,
        percent: result.probability.toFixed(4)
      };
    }
    
    return rerollProbabilities;
  } catch (error) {
    console.error('리롤 확률 계산 오류:', error);
    return null;
  }
};

// 조합 생성 함수 (n개 중 r개 선택)
const combinations = (arr, r) => {
  if (r === 0) return [[]];
  if (r > arr.length) return [];
  if (r === arr.length) return [arr];
  
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, r - 1).map(combo => [first, ...combo]);
  const withoutFirst = combinations(rest, r);
  
  return [...withFirst, ...withoutFirst];
};

// 스마트 리롤 전략
export const smartRerollStrategy = {
  name: '스마트 리롤 전략',
  description: 'DB 기반 확률 비교 및 percentile 분석으로 최적 리롤 결정',
  
  async shouldReroll(currentGem, currentOptions, goalKey, isFirstRun = false) {
    // 목표 달성 시 중단
    if (checkGoalAchieved(currentGem, goalKey)) {
      return { reroll: false, reason: '목표 달성' };
    }
    
    try {
      // 1. 현재 옵션들의 확률 계산
      const currentOptionsWithProb = await loadLocalOptionProbabilities(currentGem, currentOptions);
      let currentOptionProbs = [];
      
      if (currentOptionsWithProb && currentOptionsWithProb.length > 0) {
        for (const option of currentOptionsWithProb) {
          if (option.resultProbabilities && option.resultProbabilities[goalKey]) {
            const prob = parseFloat(option.resultProbabilities[goalKey].percent || 0);
            currentOptionProbs.push(prob);
          } else {
            currentOptionProbs.push(0);
          }
        }
      }
      
      const avgCurrentProb = currentOptionProbs.length > 0 
        ? currentOptionProbs.reduce((sum, p) => sum + p, 0) / currentOptionProbs.length 
        : 0;
      const maxCurrentProb = Math.max(...currentOptionProbs, 0);
      
      // 2. 리롤 후 확률 (DB에서 바로 조회)
      const rerollProbResult = await loadLocalRerollProbabilities(currentGem);
      const expectedAvgRerollProb = parseFloat(rerollProbResult?.[goalKey]?.percent || 0);
      
      // 리롤 횟수 체크
      const canActuallyReroll = (currentGem.currentRerollAttempts || 0) > 0;
      const wouldWantToReroll = expectedAvgRerollProb > avgCurrentProb;
      
      if (!canActuallyReroll) {
        return { 
          reroll: false, 
          reason: '리롤 횟수 없음',
          wouldWantToReroll,
          canActuallyReroll,
          beforeProb: avgCurrentProb
        };
      }
      
      if (!wouldWantToReroll) {
        return { 
          reroll: false, 
          reason: '현재 옵션이 더 좋음',
          wouldWantToReroll,
          canActuallyReroll,
          beforeProb: avgCurrentProb
        };
      }
      
      return { 
        reroll: true, 
        reason: '리롤 실행',
        wouldWantToReroll,
        canActuallyReroll,
        beforeProb: avgCurrentProb,
        expectedAfterProb: expectedAvgRerollProb
      };
      
    } catch (error) {
      console.error('리롤 결정 오류:', error);
      return { reroll: false, reason: '오류 발생' };
    }
  }
};