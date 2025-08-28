// 젬 가공 확률 계산 엔진 (Python 로직을 JavaScript로 포팅)
import { 
  applyGemAction,
  gemStateToKey,
  getAvailableProcessingOptions
} from './gemConstants.js';





/**
 * 가공 적용 (확률 계산용 - 카운터 변경만 포함)
 */
function applyProcessing(gem, action) {
  // 공통 액션 적용 함수 사용
  const newGem = applyGemAction(gem, action);
  
  // 확률 계산 전용 처리
  newGem.remainingAttempts = Math.max(0, gem.remainingAttempts - 1);
  newGem.processingCount = (gem.processingCount || 0) + 1;
  newGem.currentRerollAttempts = gem.currentRerollAttempts;
  
  // 4개 옵션 기본값 설정 (혹시 없는 경우 대비)
  newGem.dealerA = newGem.dealerA || 0;
  newGem.dealerB = newGem.dealerB || 0;
  newGem.supportA = newGem.supportA || 0;
  newGem.supportB = newGem.supportB || 0;
  newGem.costModifier = newGem.costModifier || 0;
  
  return newGem;
}

/**
 * 옵션 선택 확률 계산 (4개 조합에서 각각 25% 확률)
 */
function calculateOptionSelectionProbabilities(availableOptions) {
  const selectionProbs = {};
  
  // 모든 옵션에 대해 0으로 초기화
  availableOptions.forEach(option => {
    selectionProbs[option.action] = 0;
  });
  
  if (availableOptions.length <= 4) {
    // 옵션이 4개 이하면 모두 25% 확률
    const prob = 0.25;
    availableOptions.forEach(option => {
      selectionProbs[option.action] = prob;
    });
  } else {
    // 4개 조합 생성 (가중 확률 고려)
    const combinations = getCombinations(availableOptions, 4);
    let totalWeight = 0;
    const combWeights = [];
    
    for (const comb of combinations) {
      const weight = comb.reduce((w, opt) => w * opt.probability, 1);
      combWeights.push(weight);
      totalWeight += weight;
    }
    
    // 각 조합이 선택될 확률과 그 안에서 각 옵션이 선택될 확률 계산
    combinations.forEach((comb, idx) => {
      const combProb = combWeights[idx] / totalWeight;
      const optionProb = combProb * 0.25; // 조합 내에서 균등 선택
      
      comb.forEach(option => {
        selectionProbs[option.action] += optionProb;
      });
    });
  }
  
  return selectionProbs;
}

/**
 * 조합 생성 함수
 */
function getCombinations(arr, size) {
  const result = [];
  
  function combine(temp, start) {
    if (temp.length === size) {
      result.push([...temp]);
      return;
    }
    
    for (let i = start; i < arr.length; i++) {
      temp.push(arr[i]);
      combine(temp, i + 1);
      temp.pop();
    }
  }
  
  combine([], 0);
  return result;
}

/**
 * 확률 계산 (재귀 + 메모이제이션). 여기서의 젬 상태는 옵션 4개를 아직 뽑아보지 못한 상태임
 */
export function calculateProbabilities(gem, memo = {}, progressCallback = null) {
  const key = gemStateToKey(gem);
  
  // 이미 계산된 상태 (probabilities까지 완료)
  if (memo[key] && memo[key].probabilities) {
    return memo[key].probabilities;
  }
  
  // 상태 항목이 없으면 초기화
  if (!memo[key]) {
    memo[key] = {};
  }
  
  // 4개 옵션 레벨 직접 접근
  const dealerA = gem.dealerA || 0;
  const dealerB = gem.dealerB || 0;
  const supportA = gem.supportA || 0;
  const supportB = gem.supportB || 0;
  const totalEffectLevel = dealerA + dealerB + supportA + supportB;
  
  // 목표 조건들
  const targets = {
    '5/5+': gem.willpower >= 5 && gem.corePoint >= 5,
    '5/4+': gem.willpower >= 5 && gem.corePoint >= 4,
    '4/5+': gem.willpower >= 4 && gem.corePoint >= 5,
    '5/3+': gem.willpower >= 5 && gem.corePoint >= 3,
    '4/4+': gem.willpower >= 4 && gem.corePoint >= 4,
    '3/5+': gem.willpower >= 3 && gem.corePoint >= 5,
    'sum8+': (gem.willpower + gem.corePoint) >= 8,
    'sum9+': (gem.willpower + gem.corePoint) >= 9,
    'relic+': (gem.willpower + gem.corePoint + totalEffectLevel) >= 16,
    'ancient+': (gem.willpower + gem.corePoint + totalEffectLevel) >= 19
  };
  
  // 사용 가능한 옵션들
  const availableOptions = getAvailableProcessingOptions(gem);
  memo[key].availableOptions = availableOptions;
  
  // 기저 조건: 남은 시도 횟수가 0
  if (gem.remainingAttempts === 0 || availableOptions.length === 0) {
    const result = {};
    for (const [target, achieved] of Object.entries(targets)) {
      result[target] = achieved ? 1.0 : 0.0;
    }
    
    memo[key].probabilities = result;
    
    if (progressCallback) {
      progressCallback(Object.keys(memo).length);
    }
    
    return result;
  }
  
  // 실제 게임 로직: 4개 조합을 뽑고 그 중 하나를 25% 확률로 선택
  const result = {};
  for (const target of Object.keys(targets)) {
    result[target] = 0.0;
  }
  
  // 옵션 선택 확률 계산 (이미 계산되었는지 확인)
  let selectionProbs = memo[key].optionSelectionProbs;
  if (!selectionProbs) {
    selectionProbs = calculateOptionSelectionProbabilities(availableOptions);
    memo[key].optionSelectionProbs = selectionProbs;
  }
  
  // 각 옵션에 대해 확률 계산
  for (const option of availableOptions) {
    const selectionProb = selectionProbs[option.action];
    if (selectionProb > 0) {
      const nextGem = applyProcessing(gem, option.action);
      const futureProbs = calculateProbabilities(nextGem, memo, progressCallback);
      
      for (const target of Object.keys(targets)) {
        result[target] += selectionProb * futureProbs[target];
      }
    }
  }
  
  // 리롤 가능한 경우 계산
  const canReroll = gem.currentRerollAttempts > 0 && gem.remainingAttempts > 0 && (gem.processingCount || 0) > 0;
  
  if (canReroll) {
    // 리롤 시 최적의 선택 계산
    const rerollGem = {
      ...gem,
      currentRerollAttempts: gem.currentRerollAttempts - 1
    };
    
    const rerollProbs = calculateProbabilities(rerollGem, memo, progressCallback);
    
    // 각 목표별로 최적 선택
    for (const target of Object.keys(targets)) {
      if (rerollProbs[target] > result[target]) {
        result[target] = rerollProbs[target];
      }
    }
  }
  
  // 결과 저장 (이미 availableOptions와 optionSelectionProbs는 저장됨)
  memo[key].probabilities = result;
  
  // availableOptions에 selectionProbability 추가
  memo[key].availableOptions = availableOptions.map(opt => ({
    ...opt,
    selectionProbability: selectionProbs[opt.action]
  }));
  
  if (progressCallback) {
    progressCallback(Object.keys(memo).length);
  }
  
  return result;
}

/**
 * 전체 확률 테이블 생성
 */
export function generateFullProbabilityTable() {
  const memo = {};
  const startTime = Date.now();
  let totalStates = 0;
  
  // 모든 가능한 상태 순회 (리롤부터, 그다음 remainingAttempts가 작은 것부터) 5*5*5*5*6*5*5 = 93750
  for (let currentRerollAttempts = 0; currentRerollAttempts < 5; currentRerollAttempts++) {
    for (let remainingAttempts = 0; remainingAttempts < 5; remainingAttempts++) {
      for (let willpower = 1; willpower <= 5; willpower++) {
        for (let corePoint = 1; corePoint <= 5; corePoint++) {
          for (let dealerA = 0; dealerA <= 5; dealerA++) {
            for (let dealerB = 0; dealerB <= 5; dealerB++) {
              for (let supportA = 0; supportA <= 5; supportA++) {
                for (let supportB = 0; supportB <= 5; supportB++) {
                  // 4개 옵션 중 정확히 2개만 0이 아니어야 함 (유효한 젬 상태)
                  const nonZeroCount = [dealerA, dealerB, supportA, supportB].filter(x => x > 0).length;
                  if (nonZeroCount !== 2) continue;
                  
                  const gem = {
                    willpower,
                    corePoint,
                    dealerA,
                    dealerB,
                    supportA,
                    supportB,
                    remainingAttempts,
                    currentRerollAttempts,
                    processingCount: currentRerollAttempts > 0 ? 1 : 0
                  };
                  
                  calculateProbabilities(gem, memo);
                  totalStates++;
                  
                  if (totalStates % 1 === 0) {
                    console.log(`계산 진행: ${totalStates}개 완료 - Reroll ${currentRerollAttempts}, Attempts ${remainingAttempts}, Point ${willpower},${corePoint},${dealerA},${dealerB},${supportA},${supportB}`);
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  
  const endTime = Date.now();
  console.log(`✅ 확률 테이블 생성 완료: ${totalStates}개 상태, ${(endTime - startTime) / 1000}초`);
  
  return memo;
}

/**
 * 확률 테이블을 파일로 저장
 */
export function saveProbabilityTable(table) {
  const blob = new Blob([JSON.stringify(table, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gem_probability_table_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 파일에서 확률 테이블 로드
 */
export function loadProbabilityTable(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const table = JSON.parse(e.target.result);
        resolve(table);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export default {
  calculateProbabilities,
  generateFullProbabilityTable,
  saveProbabilityTable,
  loadProbabilityTable,
  gemStateToKey
};