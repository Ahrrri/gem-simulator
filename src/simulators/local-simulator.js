#!/usr/bin/env node
/**
 * 로컬 젬 가공 시뮬레이터
 * 
 * 기존 gemProcessingSimulator.js의 로직을 계승하되,
 * API 호출 대신 사전 계산된 확률 테이블을 로컬에서 조회
 */

import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import cliProgress from 'cli-progress';
import { 
  createProcessingGem,
  executeGemProcessing,
  rerollProcessingOptions,
  applyGemAction,
} from '../utils/gemProcessing.js';
import { PROCESSING_POSSIBILITIES } from '../utils/gemConstants.js';

// ES 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SQLite 데이터베이스 연결 및 캐시
let db = null;
const probabilityCache = new Map(); // 확률 캐시

try {
  const dbPath = path.join(__dirname, '../../probability_table.db');
  db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
  console.log('✅ SQLite 데이터베이스 연결 완료');
} catch (error) {
  console.error('❌ 데이터베이스 연결 실패:', error.message);
  console.log('💡 먼저 Python 스크립트로 확률 테이블을 생성해주세요: python generate_probability_table.py');
  process.exit(1);
}

// 목표 정의 (기존과 동일)
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
  'ancient+': '고대 (19포인트) 이상'
};

/**
 * 배열의 순열을 생성하는 함수
 */
function* permutations(arr) {
  if (arr.length <= 1) {
    yield arr.slice();
  } else {
    for (let i = 0; i < arr.length; i++) {
      const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
      for (const perm of permutations(rest)) {
        yield [arr[i], ...perm];
      }
    }
  }
}

/**
 * 조합을 생성하는 함수
 */
function* combinations(arr, k) {
  if (k === 0) {
    yield [];
  } else if (k === arr.length) {
    yield arr.slice();
  } else if (k < arr.length) {
    const [first, ...rest] = arr;
    // first를 포함하는 조합들
    for (const combo of combinations(rest, k - 1)) {
      yield [first, ...combo];
    }
    // first를 포함하지 않는 조합들
    for (const combo of combinations(rest, k)) {
      yield combo;
    }
  }
}

/**
 * 특정 4개 조합이 뽑힐 확률을 계산 (순서 고려)
 */
function calculate4ComboProbability(comboIndices, allWeights) {
  let comboTotalProb = 0.0;
  
  // 4개를 뽑는 모든 순서 고려
  for (const perm of permutations(comboIndices)) {
    let permProb = 1.0;
    const remainingWeights = [...allWeights];
    let remainingTotal = remainingWeights.reduce((sum, w) => sum + w, 0);
    
    // 순서대로 뽑을 확률 계산
    for (const idx of perm) {
      if (remainingTotal <= 0 || remainingWeights[idx] <= 0) {
        permProb = 0;
        break;
      }
      
      // 현재 옵션을 뽑을 확률
      permProb *= remainingWeights[idx] / remainingTotal;
      
      // 뽑힌 옵션은 제거 (복원 추출이 아님)
      remainingTotal -= remainingWeights[idx];
      remainingWeights[idx] = 0;
    }
    
    comboTotalProb += permProb;
  }
  
  return comboTotalProb;
}

/**
 * 주어진 젬 상태에서 사용 가능한 옵션들 반환
 */
function getAvailableOptions(gem) {
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
}

/**
 * Python의 state_to_key 로직을 JavaScript로 포팅
 * 젬 상태를 키 문자열로 변환 (메모이제이션용)
 */
const stateToKey = (gem) => {
  const MAX_REROLL_FOR_MEMOIZATION = 4; // Python과 동일
  
  // 리롤 횟수는 상한까지만 (메모이제이션 효율성)
  const cappedReroll = Math.min(MAX_REROLL_FOR_MEMOIZATION, gem.currentRerollAttempts || 0);
  const firstProcessing = (gem.processingCount || 0) === 0 ? 1 : 0;
  
  return `${gem.willpower || 1},${gem.corePoint || 1},${gem.dealerA || 0},${gem.dealerB || 0},${gem.supportA || 0},${gem.supportB || 0},${gem.remainingAttempts || 0},${cappedReroll},${gem.costModifier || 0},${firstProcessing}`;
};

/**
 * 목표 키를 SQLite 컬럼명으로 변환
 */
const goalKeyToColumn = (goalKey) => {
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
    'ancient+': 'prob_ancient'
  };
  return mapping[goalKey] || null;
};

/**
 * SQLite 데이터베이스에서 확률 조회 (캐싱 포함)
 */
const getLocalProbability = (gem, goalKey) => {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve(0);
      return;
    }
    
    const columnName = goalKeyToColumn(goalKey);
    if (!columnName) {
      resolve(0);
      return;
    }
    
    // 캐시 키 생성 (젬 상태 + 목표)
    const cacheKey = `${stateToKey(gem)}_${goalKey}`;
    
    // 캐시에서 확인
    if (probabilityCache.has(cacheKey)) {
      resolve(probabilityCache.get(cacheKey));
      return;
    }
    
    // gem_states 테이블에서 조회 (gem_state 키가 아닌 개별 컬럼으로 매칭)
    const cappedReroll = Math.min(4, gem.currentRerollAttempts || 0);
    const firstProcessing = (gem.processingCount || 0) === 0 ? 1 : 0;
    
    db.get(
      `SELECT ${columnName} FROM gem_states 
       WHERE willpower = ? AND corePoint = ? AND dealerA = ? AND dealerB = ? 
       AND supportA = ? AND supportB = ? AND remainingAttempts = ? 
       AND currentRerollAttempts = ? AND costModifier = ? AND isFirstProcessing = ?`,
      [
        gem.willpower || 1, 
        gem.corePoint || 1, 
        gem.dealerA || 0, 
        gem.dealerB || 0, 
        gem.supportA || 0, 
        gem.supportB || 0, 
        gem.remainingAttempts || 0, 
        cappedReroll, 
        gem.costModifier || 0, 
        firstProcessing
      ],
      (err, row) => {
        if (err) {
          console.error('DB 쿼리 오류:', err);
          resolve(0);
          return;
        }
        
        let probability = 0;
        if (row && row[columnName] !== null && row[columnName] !== undefined) {
          // DB 값은 0-1 사이이므로 100을 곱해서 퍼센트로 변환
          probability = parseFloat(row[columnName] || 0) * 100;
        }
        
        // 캐시에 저장
        probabilityCache.set(cacheKey, probability);
        
        resolve(probability);
      }
    );
  });
};

/**
 * 로컬 버전의 loadOptionProbabilities
 */
const loadLocalOptionProbabilities = async (gem, options) => {
  if (!options || options.length === 0) {
    return null;
  }

  const optionsWithProbabilities = [];
  
  for (const option of options) {
    try {
      // 각 옵션을 적용한 결과 젬 상태 계산
      const resultGem = applyGemAction(JSON.parse(JSON.stringify(gem)), option.action);
      
      // 모든 목표에 대한 확률 조회
      const resultProbabilities = {};
      for (const goalKey of Object.keys(GOALS)) {
        const prob = await getLocalProbability(resultGem, goalKey);
        resultProbabilities[goalKey] = {
          value: prob / 100,
          percent: prob.toFixed(4)
        };
      }
      
      optionsWithProbabilities.push({
        ...option,
        resultGem,
        resultProbabilities
      });
    } catch (error) {
      console.error('옵션 확률 계산 오류:', error);
    }
  }
  
  return optionsWithProbabilities;
};

/**
 * 로컬 버전의 loadRerollProbabilities
 */
const loadLocalRerollProbabilities = async (gem) => {
  try {
    // 리롤을 실행했을 때의 상태 (리롤 횟수 1 감소)
    const rerollGem = {
      ...gem,
      currentRerollAttempts: Math.max(0, (gem.currentRerollAttempts || 0) - 1)
    };
    
    const rerollProbabilities = {};
    
    for (const goalKey of Object.keys(GOALS)) {
      const prob = await getLocalProbability(rerollGem, goalKey);
      rerollProbabilities[goalKey] = {
        value: prob / 100,
        percent: prob.toFixed(4)
      };
    }
    
    return rerollProbabilities;
  } catch (error) {
    console.error('리롤 확률 계산 오류:', error);
    return null;
  }
};

/**
 * 목표 달성 여부 확인 (기존과 동일)
 */
const checkGoalAchieved = (gem, goalKey) => {
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
    default:
      return false;
  }
};

/**
 * 후회 최소화 전략
 */
export const minimizeRegretStrategy = {
  name: '후회 최소화 전략',
  description: '리롤 후 모든 가능한 4combo 조합을 계산하여 후회 확률 최소화',
  
  async shouldReroll(currentGem, currentOptions, goalKey, isFirstRun) {
    // 목표 달성 시 중단
    if (checkGoalAchieved(currentGem, goalKey)) {
      return { reroll: false, reason: '목표 달성' };
    }
    
    // 리롤 횟수 없으면 중단
    if (currentGem.currentRerollAttempts <= 0) {
      return { reroll: false, reason: '리롤 횟수 소진' };
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
      
      // 2. 리롤 후 사용 가능한 모든 옵션들 조회
      const rerollGem = {
        ...currentGem,
        currentRerollAttempts: Math.max(0, (currentGem.currentRerollAttempts || 0) - 1)
      };
      
      const availableOptions = getAvailableOptions(rerollGem);
      if (availableOptions.length < 4) {
        return { reroll: false, reason: '리롤 후 옵션 부족' };
      }
      
      // 3. 모든 4combo 조합 생성 및 확률 계산
      const allWeights = availableOptions.map(opt => opt.probability);
      
      let betterCombos = 0;
      let worseCombos = 0;
      let totalCombos = 0;
      let weightedProbSum = 0;
      let totalComboWeight = 0;
      
      // 가중치 분포 추적
      let minWeight = Infinity;
      let maxWeight = 0;
      let weightValues = [];
      
      // 모든 4개 조합 생성
      for (const comboIndices of combinations(Array.from({length: availableOptions.length}, (_, i) => i), 4)) {
        const comboWeight = calculate4ComboProbability(comboIndices, allWeights);
        
        if (comboWeight <= 0) continue;
        
        // 이 조합의 4개 옵션에 대한 확률 계산
        const comboGems = [];
        for (const idx of comboIndices) {
          const action = availableOptions[idx].action;
          const resultGem = applyGemAction(JSON.parse(JSON.stringify(rerollGem)), action);
          comboGems.push(resultGem);
        }
        
        // 각 옵션의 목표 달성 확률 계산
        const comboProbs = [];
        for (const gem of comboGems) {
          const prob = await getLocalProbability(gem, goalKey);
          comboProbs.push(prob);
        }
        
        const avgComboProb = comboProbs.reduce((sum, p) => sum + p, 0) / comboProbs.length;
        const maxComboProb = Math.max(...comboProbs);
        
        // 가중 평균에 기여
        const contribution = avgComboProb * comboWeight;
        weightedProbSum += contribution;
        totalComboWeight += comboWeight;
        
        // 가중치 분포 추적
        if (comboWeight > 0) {
          minWeight = Math.min(minWeight, comboWeight);
          maxWeight = Math.max(maxWeight, comboWeight);
          weightValues.push(comboWeight);
        }
        
        // 현재 평균 확률과 비교
        if (avgComboProb > avgCurrentProb) {
          betterCombos++;
        } else if (avgComboProb < avgCurrentProb) {
          worseCombos++;
        }
        
        totalCombos++;
      }
      
      const calculatedAvgRerollProb = totalComboWeight > 0 ? weightedProbSum / totalComboWeight : 0;
      
      // 4. 검증: 리롤 확률과 비교
      const rerollProbResult = await loadLocalRerollProbabilities(currentGem);
      const expectedAvgRerollProb = parseFloat(rerollProbResult?.[goalKey]?.percent || 0);
      
      const betterRate = totalCombos > 0 ? (betterCombos / totalCombos) * 100 : 0;
      const worseRate = totalCombos > 0 ? (worseCombos / totalCombos) * 100 : 0;
      
      // 디버깅: 첫 번째 combination의 세부 정보 출력 (차이점 파악용)
      if (isFirstRun && totalCombos > 0) {
        console.log('\n=== 첫 번째 combination 디버깅 ===');
        const firstComboIndices = Array.from(combinations(Array.from({length: availableOptions.length}, (_, i) => i), 4))[0];
        console.log('첫 번째 combo indices:', firstComboIndices);
        console.log('해당 옵션들:');
        for (const idx of firstComboIndices) {
          console.log(`  [${idx}] ${availableOptions[idx].action}: ${availableOptions[idx].probability}`);
        }
        
        const firstComboWeight = calculate4ComboProbability(firstComboIndices, allWeights);
        console.log('첫 번째 combo weight:', firstComboWeight.toExponential(10));
        
        // 첫 번째 permutation 세부 계산
        const firstPerm = Array.from(permutations(firstComboIndices))[0];
        console.log('첫 번째 permutation:', firstPerm);
        let permProb = 1.0;
        const remainingWeights = [...allWeights];
        let remainingTotal = remainingWeights.reduce((sum, w) => sum + w, 0);
        console.log('초기 total weight:', remainingTotal);
        
        for (let step = 0; step < firstPerm.length; step++) {
          const idx = firstPerm[step];
          const stepProb = remainingWeights[idx] / remainingTotal;
          permProb *= stepProb;
          console.log(`  step ${step+1}: idx=${idx}, weight=${remainingWeights[idx]}, total=${remainingTotal}, prob=${stepProb}, cumulative=${permProb}`);
          remainingTotal -= remainingWeights[idx];
          remainingWeights[idx] = 0;
        }
        
        console.log('첫 번째 permutation 확률:', permProb.toExponential(10));
        console.log('===============================\n');
      }
      
      // 가중치 분포 분석
      const weightOrderMagnitude = maxWeight > 0 && minWeight < Infinity 
        ? Math.log10(maxWeight / minWeight) 
        : 0;
      
      return {
        reroll: betterRate > worseRate && calculatedAvgRerollProb > avgCurrentProb,
        reason: `후회 최소화: 개선확률 ${betterRate.toFixed(4)}% vs 악화확률 ${worseRate.toFixed(4)}%`,
        beforeProb: avgCurrentProb,
        afterProb: calculatedAvgRerollProb,
        analysis: {
          numofAvailableOptions: availableOptions.length,
          currentMax: maxCurrentProb,
          currentAvg: avgCurrentProb,
          totalCombos,
          betterCombos,
          worseCombos,
          betterRate,
          worseRate,
          calculatedAvgRerollProb,
          expectedAvgRerollProb,
          probDiff: Math.abs(calculatedAvgRerollProb - expectedAvgRerollProb),
          weightStats: {
            minWeight: minWeight === Infinity ? 0 : minWeight,
            maxWeight,
            orderMagnitude: weightOrderMagnitude,
            totalWeight: totalComboWeight,
            avgWeight: weightValues.length > 0 ? totalComboWeight / weightValues.length : 0
          }
        }
      };
      
    } catch (error) {
      console.error('후회 최소화 계산 오류:', error);
      return { reroll: false, reason: '계산 실패' };
    }
  }
};

/**
 * 확률 기반 전략 (올바른 버전)
 */
export const probabilityStrategy = {
  name: '확률 기반 전략 (로컬)',
  description: '현재 옵션 세트 vs 리롤 후 확률을 비교하여 리롤 여부 결정',
  
  async shouldReroll(currentGem, currentOptions, goalKey, isFirstRun) {
    // 목표 달성 시 중단
    if (checkGoalAchieved(currentGem, goalKey)) {
      return { reroll: false, reason: '목표 달성' };
    }
    
    try {
      // 1. 현재 옵션 세트의 확률 계산 (단순 평균 - 각 옵션 25% 확률)
      const currentOptionsWithProb = await loadLocalOptionProbabilities(currentGem, currentOptions);
      let currentProbSum = 0;
      let validOptionCount = 0;
      
      if (currentOptionsWithProb && currentOptionsWithProb.length > 0) {
        for (const option of currentOptionsWithProb) {
          if (option.resultProbabilities && option.resultProbabilities[goalKey]) {
            const prob = parseFloat(option.resultProbabilities[goalKey].percent || 0);
            currentProbSum += prob;
            validOptionCount++;
          }
        }
      }
      const avgCurrentProb = validOptionCount > 0 ? currentProbSum / validOptionCount : 0;
      
      // 2. 리롤 후의 확률 계산  
      const rerollProbResult = await loadLocalRerollProbabilities(currentGem);
      const avgRerollProb = parseFloat(rerollProbResult?.[goalKey]?.percent || 0);
      
      // 3. 확률 비교하여 리롤 여부 결정
      if (avgRerollProb > avgCurrentProb) {
        return { 
          reroll: true, 
          reason: `확률 개선: ${avgCurrentProb.toFixed(4)}% → ${avgRerollProb.toFixed(4)}%`,
          beforeProb: avgCurrentProb,
          afterProb: avgRerollProb
        };
      }
      
      return { 
        reroll: false, 
        reason: `확률 개선 없음 (현재: ${avgCurrentProb.toFixed(4)}% vs 리롤: ${avgRerollProb.toFixed(4)}%)`,
        beforeProb: avgCurrentProb,
        afterProb: avgRerollProb
      };
      
    } catch (error) {
      console.error('확률 계산 오류:', error);
      return { reroll: false, reason: '확률 계산 실패' };
    }
  }
};

/**
 * 단일 목표 시뮬레이션 (SQLite 비동기 버전)
 */
export const runSimulation = async (mainType, subType, grade, goalKey, options = {}) => {
  const {
    simulationRuns = 100
  } = options;
  
  const results = [];
  console.log(`\n🚀 ${goalKey} 목표 시뮬레이션 시작 (${simulationRuns}회)`);
  
  // 진행 바 생성
  const progressBar = new cliProgress.SingleBar({
    format: '진행도 |{bar}| {percentage}% | {value}/{total} | ETA: {eta}s',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
    etaBuffer: 1000,  // ETA 계산을 위한 버퍼 크기 증가
    fps: 10  // 초당 10회로 업데이트 빈도 제한
  });
  
  progressBar.start(simulationRuns, 0);
  
  // 진행 바 업데이트 간격 설정 (1% 또는 최소 10개마다)
  const updateInterval = 10;
  
  for (let run = 0; run < simulationRuns; run++) {
    const isFirstRun = run === 0;
    
    // 일정 간격으로만 진행 바 업데이트 (첫 번째 실행에서는 숨김)
    if (!isFirstRun && (run % updateInterval === 0 || run === simulationRuns - 1)) {
      progressBar.update(run);
    }
    
    if (isFirstRun) {
      console.log('\n🔍 첫 번째 시뮬레이션 상세 과정:');
      progressBar.stop(); // 첫 번째에서는 진행 바 잠시 정지
    }
    
    let currentGem = createProcessingGem(mainType, subType, grade);
    let totalCost = 0;
    let attempts = 0;
    let goalAchieved = false;
    
    // 리롤 통계
    let rerollStats = {
      wantedButNoAttempts: 0,    // 리롤하고 싶었지만 횟수 없음
      rerollPerformed: 0,        // 실제 리롤 실행 횟수
      rerollMadeWorse: 0,        // 리롤 후 더 안 좋아진 경우
      maxRerollAttemptsSeenThisGem: 0  // 이 젬에서 본 최대 리롤 횟수
    };
    
    if (isFirstRun) {
      const initialProb = await getLocalProbability(currentGem, goalKey);
      console.log(`초기 젬: 의지력 ${currentGem.willpower}, 코어 ${currentGem.corePoint}, 딜러A ${currentGem.dealerA}, 딜러B ${currentGem.dealerB}, 서폿A ${currentGem.supportA}, 서폿B ${currentGem.supportB}`);
      console.log(`남은 가공 횟수: ${currentGem.remainingAttempts}, 리롤 횟수: ${currentGem.currentRerollAttempts}`);
      console.log(`초기 ${goalKey} 달성 확률: ${initialProb.toFixed(4)}%`);
    }
    
    while (currentGem.remainingAttempts > 0) {
      attempts++;
      
      // 리롤 횟수 통계 업데이트
      const currentRerollAttempts = currentGem.currentRerollAttempts || 0;
      rerollStats.maxRerollAttemptsSeenThisGem = Math.max(
        rerollStats.maxRerollAttemptsSeenThisGem, 
        currentRerollAttempts
      );
      
      if (isFirstRun) {
        const currentProb = await getLocalProbability(currentGem, goalKey);
        console.log(`\n--- 가공 시도 ${attempts} ---`);
        console.log(`현재 젬 상태: 의지력 ${currentGem.willpower}, 코어 ${currentGem.corePoint}, 딜러A ${currentGem.dealerA}, 딜러B ${currentGem.dealerB}, 서폿A ${currentGem.supportA}, 서폿B ${currentGem.supportB}`);
        console.log(`남은 가공: ${currentGem.remainingAttempts}, 리롤: ${currentGem.currentRerollAttempts}`);
        console.log(`현재 ${goalKey} 달성 확률: ${currentProb.toFixed(4)}%`);
      }
            
      // 리롤 루프 - 더 좋은 옵션이 나올 때까지 계속 리롤
      let rerollCount = 0;
      while (true) {
        if (isFirstRun && currentGem.autoOptionSet) {
          console.log(`옵션들: ${currentGem.autoOptionSet.map(opt => opt.action).join(', ')}`);
          
          // 각 옵션의 확률 표시
          const currentOptionsWithProb = await loadLocalOptionProbabilities(currentGem, currentGem.autoOptionSet);
          if (currentOptionsWithProb && currentOptionsWithProb.length > 0) {
            console.log('각 옵션의 확률:');
            for (let i = 0; i < currentOptionsWithProb.length; i++) {
              const option = currentOptionsWithProb[i];
              if (option.resultProbabilities && option.resultProbabilities[goalKey]) {
                const prob = parseFloat(option.resultProbabilities[goalKey].percent || 0);
                console.log(`  ${i+1}. ${option.action}: ${prob.toFixed(4)}%`);
              } else {
                console.log(`  ${i+1}. ${option.action}: 확률 계산 실패`);
              }
            }
          }
        }
        
        const decision = await minimizeRegretStrategy.shouldReroll(
          currentGem, 
          currentGem.autoOptionSet,
          goalKey,
          isFirstRun
        );
        
        if (isFirstRun) {
          console.log(`리롤 결정: ${decision.reason}`);
          if (decision.analysis) {
            const a = decision.analysis;
            console.log(`  분석: 나올 수 있는 옵션 수 총 ${a.numofAvailableOptions}개. 총 ${a.totalCombos}개 조합 중 개선 ${a.betterCombos}개, 악화 ${a.worseCombos}개`);
            console.log(`  현재 옵션 최고: ${a.currentMax.toFixed(4)}%, 평균: ${a.currentAvg.toFixed(4)}% (비교기준: 평균)`);
            console.log(`  직접 계산된 리롤 후 목표 달성 확률: ${a.calculatedAvgRerollProb.toFixed(4)}%, 테이블에 있는 예상 확률: ${a.expectedAvgRerollProb.toFixed(4)}%`);
            console.log(`  확률 차이: ${a.probDiff.toFixed(4)}% (검증용)`);
            console.log(`  가중치 분포: 최소 ${a.weightStats.minWeight.toExponential(3)}, 최대 ${a.weightStats.maxWeight.toExponential(3)}, 크기차이 ${a.weightStats.orderMagnitude.toFixed(1)} 자릿수`);
            console.log(`  총 가중치: ${a.weightStats.totalWeight.toExponential(3)}, 평균 가중치: ${a.weightStats.avgWeight.toExponential(3)}`);
          }
        }
        
        if (!decision.reroll) {
          // 리롤 안 함 - 현재 옵션이 만족스러움
          break;
        }
        
        if (currentGem.currentRerollAttempts > 0) {
          rerollCount++;
          // 리롤 전 확률 저장 (decision에 있음)
          const beforeProb = decision.beforeProb;
          
          // 리롤 실행 (리롤은 무료)
          const rerolledGem = rerollProcessingOptions(currentGem);
          if (rerolledGem) {
            rerollStats.rerollPerformed++;
            currentGem = rerolledGem;
            
            if (isFirstRun) {
              console.log(`  리롤 ${rerollCount} 실행! 새 옵션들: ${currentGem.autoOptionSet.map(opt => opt.action).join(', ')}`);
            }
            
            // 리롤 후 실제 확률 계산
            const afterOptionsWithProb = await loadLocalOptionProbabilities(currentGem, currentGem.autoOptionSet);
            let afterProb = 0;
            if (afterOptionsWithProb && afterOptionsWithProb.length > 0) {
              let probSum = 0;
              let validCount = 0;
              for (const option of afterOptionsWithProb) {
                if (option.resultProbabilities?.[goalKey]) {
                  probSum += parseFloat(option.resultProbabilities[goalKey].percent || 0);
                  validCount++;
                }
              }
              afterProb = validCount > 0 ? probSum / validCount : 0;
            }
            
            // 리롤 후 실제로 더 안 좋아졌는지 확인
            if (afterProb < beforeProb) {
              rerollStats.rerollMadeWorse++;
              if (isFirstRun) {
                console.log(`  ⚠️ 리롤 후 확률이 더 안좋아짐: ${beforeProb.toFixed(4)}% → ${afterProb.toFixed(4)}%`);
              }
            } else if (isFirstRun) {
              console.log(`  ✅ 리롤 후 확률 개선: ${beforeProb.toFixed(4)}% → ${afterProb.toFixed(4)}%`);
            }
            
            // 새로운 옵션으로 다시 판단하기 위해 continue
          } else {
            // 리롤 실패 시 루프 탈출
            if (isFirstRun) console.log(`  ❌ 리롤 실패`);
            break;
          }
        } else {
          // 리롤하고 싶었지만 횟수 없음
          rerollStats.wantedButNoAttempts++;
          if (isFirstRun) console.log(`  ⏰ 리롤하고 싶지만 횟수 없음`);
          break;
        }
      }
      
      // 가공 실행 (랜덤하게 옵션 선택)
      if (currentGem.autoOptionSet && currentGem.autoOptionSet.length > 0) {
        const randomIndex = Math.floor(Math.random() * currentGem.autoOptionSet.length);
        const selectedAction = currentGem.autoOptionSet[randomIndex].action;
        
        if (isFirstRun) {
          console.log(`선택된 옵션: ${selectedAction}`);
        }
        
        const processingCost = 900 * (1 + (currentGem.costModifier || 0) / 100);
        totalCost += processingCost;
        
        currentGem = executeGemProcessing(currentGem, selectedAction);
        
        if (isFirstRun) {
          const afterProcessingProb = await getLocalProbability(currentGem, goalKey);
          console.log(`가공 후: 의지력 ${currentGem.willpower}, 코어 ${currentGem.corePoint}, 딜러A ${currentGem.dealerA}, 딜러B ${currentGem.dealerB}, 서폿A ${currentGem.supportA}, 서폿B ${currentGem.supportB}`);
          console.log(`가공 후 ${goalKey} 달성 확률: ${afterProcessingProb.toFixed(4)}%`);
          console.log(`가공 비용: ${Math.round(processingCost)}골드 (누적: ${Math.round(totalCost)}골드)`);
        }
        
        // 목표 달성 확인
        if (checkGoalAchieved(currentGem, goalKey)) {
          goalAchieved = true;
          if (isFirstRun) {
            console.log(`🎉 목표 달성! (${goalKey})`);
          }
          break;
        }
      } else {
        if (isFirstRun) console.log(`❌ 옵션이 없어서 중단`);
        break; // 옵션이 없으면 중단
      }
    }
    
    if (isFirstRun) {
      console.log(`\n첫 번째 시뮬레이션 결과: ${goalAchieved ? '성공' : '실패'}, 총 ${attempts}회 시도, ${Math.round(totalCost)}골드 소모`);
      console.log('\n나머지 시뮬레이션 진행 중...');
      // 진행 바 재시작
      progressBar.start(simulationRuns, 1);
    }
    
    results.push({
      run: run + 1,
      attempts,
      totalCost,
      goalAchieved,
      costPerAttempt: attempts > 0 ? Math.round(totalCost / attempts) : 0,
      rerollStats
    });
  }
  
  progressBar.update(simulationRuns);
  progressBar.stop();
  console.log(`✅ 시뮬레이션 완료! (캐시 크기: ${probabilityCache.size})`);
  
  // 통계 계산
  const successRuns = results.filter(r => r.goalAchieved);
  const failRuns = results.filter(r => !r.goalAchieved);
  
  // 리롤 통계 집계
  const totalRerollStats = results.reduce((total, r) => ({
    wantedButNoAttempts: total.wantedButNoAttempts + r.rerollStats.wantedButNoAttempts,
    rerollPerformed: total.rerollPerformed + r.rerollStats.rerollPerformed,
    rerollMadeWorse: total.rerollMadeWorse + r.rerollStats.rerollMadeWorse,
    maxRerollAttemptsSeenThisGem: Math.max(total.maxRerollAttemptsSeenThisGem, r.rerollStats.maxRerollAttemptsSeenThisGem)
  }), { wantedButNoAttempts: 0, rerollPerformed: 0, rerollMadeWorse: 0, maxRerollAttemptsSeenThisGem: 0 });
  
  // 4초과 리롤 횟수 통계
  const gemsWithHighRerollCount = results.filter(r => r.rerollStats.maxRerollAttemptsSeenThisGem > 4).length;
  
  return {
    goalKey,
    goalName: GOALS[goalKey],
    successRate: (successRuns.length / simulationRuns) * 100,
    
    // 전체 비용 통계
    avgCost: results.reduce((sum, r) => sum + r.totalCost, 0) / results.length,
    minCost: Math.min(...results.map(r => r.totalCost)),
    maxCost: Math.max(...results.map(r => r.totalCost)),
    
    // 성공/실패별 비용 통계
    avgSuccessCost: successRuns.length > 0 
      ? successRuns.reduce((sum, r) => sum + r.totalCost, 0) / successRuns.length
      : 0,
    avgFailureCost: failRuns.length > 0
      ? failRuns.reduce((sum, r) => sum + r.totalCost, 0) / failRuns.length
      : 0,
    
    // 시도 횟수 통계
    avgAttempts: results.reduce((sum, r) => sum + r.attempts, 0) / results.length,
    avgSuccessAttempts: successRuns.length > 0
      ? successRuns.reduce((sum, r) => sum + r.attempts, 0) / successRuns.length
      : 0,
    
    // 효율성 지표
    avgCostPerAttempt: results.reduce((sum, r) => sum + r.costPerAttempt, 0) / results.length,
    
    // 리롤 통계
    rerollAnalysis: {
      totalWantedButNoAttempts: totalRerollStats.wantedButNoAttempts,
      totalRerollPerformed: totalRerollStats.rerollPerformed,
      totalRerollMadeWorse: totalRerollStats.rerollMadeWorse,
      avgWantedButNoAttempts: totalRerollStats.wantedButNoAttempts / simulationRuns,
      avgRerollPerformed: totalRerollStats.rerollPerformed / simulationRuns,
      avgRerollMadeWorse: totalRerollStats.rerollMadeWorse / simulationRuns,
      rerollWorseRate: totalRerollStats.rerollPerformed > 0 
        ? (totalRerollStats.rerollMadeWorse / totalRerollStats.rerollPerformed) * 100
        : 0,
      maxRerollAttemptsObserved: totalRerollStats.maxRerollAttemptsSeenThisGem,
      gemsWithHighRerollCount: gemsWithHighRerollCount,
      highRerollCountRate: (gemsWithHighRerollCount / simulationRuns) * 100
    },
    
    simulationRuns,
    successCount: successRuns.length,
    failureCount: failRuns.length
  };
};

/**
 * 모든 목표에 대한 시뮬레이션
 */
export const runAllGoalsSimulation = async (mainType, subType, grade, options = {}) => {
  const results = [];
  
  for (const goalKey of Object.keys(GOALS)) {
    // 각 목표마다 같은 조건의 새 젬으로 시뮬레이션
    const result = await runSimulation(mainType, subType, grade, goalKey, options);
    results.push(result);
  }
  
  return { results };
};

// CLI 실행을 위한 메인 함수
const main = async () => {
  console.log('🎮 로컬 젬 가공 시뮬레이터');
  console.log('=====================================');
  
  // CLI 인자 파싱
  const args = process.argv.slice(2);
  let goalKey = 'sum9+';  // 기본값
  let simulationRuns = 1000;  // 기본값
  
  // 인자 처리
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--goal' || arg === '-g') {
      goalKey = args[i + 1];
      i++; // 다음 인자 스킵
    } else if (arg === '--runs' || arg === '-r') {
      simulationRuns = parseInt(args[i + 1]);
      i++; // 다음 인자 스킵
    } else if (arg === '--help' || arg === '-h') {
      console.log('사용법: node src/simulators/local-simulator.js [옵션]');
      console.log('');
      console.log('옵션:');
      console.log('  -g, --goal <목표>     목표 설정 (기본: sum9+)');
      console.log('  -r, --runs <횟수>     시뮬레이션 횟수 (기본: 1000)');
      console.log('  -h, --help           도움말 표시');
      console.log('');
      console.log('사용 가능한 목표:');
      Object.keys(GOALS).forEach(key => {
        console.log(`  ${key}: ${GOALS[key]}`);
      });
      return;
    }
  }
  
  // 목표 유효성 검증
  if (!GOALS[goalKey]) {
    console.error(`❌ 유효하지 않은 목표: ${goalKey}`);
    console.log('사용 가능한 목표:');
    Object.keys(GOALS).forEach(key => {
      console.log(`  ${key}: ${GOALS[key]}`);
    });
    return;
  }
  
  // 시뮬레이션 횟수 유효성 검증
  if (isNaN(simulationRuns) || simulationRuns < 1) {
    console.error(`❌ 유효하지 않은 시뮬레이션 횟수: ${simulationRuns}`);
    return;
  }
  
  try {
    // 목표 시뮬레이션
    const result = await runSimulation('ORDER', 'STABLE', 'RARE', goalKey, { simulationRuns });
    
    console.log('\n🎯 결과:');
    console.log(`성공률: ${result.successRate.toFixed(1)}% (${result.successCount}/${result.simulationRuns})`);
    console.log('\n💰 비용 분석:');
    console.log(`  평균 비용: ${Math.round(result.avgCost)}골드`);
    console.log(`  성공 시 평균: ${Math.round(result.avgSuccessCost)}골드`);
    console.log(`  실패 시 평균: ${Math.round(result.avgFailureCost)}골드`);
    console.log(`  비용 범위: ${Math.round(result.minCost)}~${Math.round(result.maxCost)}골드`);
    console.log('\n⚡ 효율성:');
    console.log(`  평균 시도 횟수: ${result.avgAttempts.toFixed(1)}회`);
    console.log(`  성공 시 평균 시도: ${result.avgSuccessAttempts.toFixed(1)}회`);
    console.log(`  시도당 평균 비용: ${Math.round(result.avgCostPerAttempt)}골드`);
    
    console.log('\n🔄 리롤 분석:');
    console.log(`  리롤 희망했지만 횟수 없음: 총 ${result.rerollAnalysis.totalWantedButNoAttempts}회 (평균 ${result.rerollAnalysis.avgWantedButNoAttempts.toFixed(2)}회/젬)`);
    console.log(`  실제 리롤 실행: 총 ${result.rerollAnalysis.totalRerollPerformed}회 (평균 ${result.rerollAnalysis.avgRerollPerformed.toFixed(2)}회/젬)`);
    console.log(`  리롤 후 더 안좋아짐: 총 ${result.rerollAnalysis.totalRerollMadeWorse}회 (평균 ${result.rerollAnalysis.avgRerollMadeWorse.toFixed(2)}회/젬)`);
    console.log(`  리롤해서 망한 비율: ${result.rerollAnalysis.rerollWorseRate.toFixed(1)}%`);
    console.log(`  최대 리롤 횟수 관찰: ${result.rerollAnalysis.maxRerollAttemptsObserved}회`);
    console.log(`  리롤 횟수 4 초과 젬: ${result.rerollAnalysis.gemsWithHighRerollCount}개 (${result.rerollAnalysis.highRerollCountRate.toFixed(1)}%)`);
    
    console.log('\n✨ 로컬 시뮬레이션 완료!');
  } catch (error) {
    console.error('❌ 시뮬레이션 실행 중 오류:', error.message);
  } finally {
    // 데이터베이스 연결 정리
    if (db) {
      db.close((err) => {
        if (err) console.error('DB 연결 종료 오류:', err);
        else console.log('📦 데이터베이스 연결 종료');
      });
    }
  }
};

// 직접 실행 시 메인 함수 호출
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}