/**
 * 백엔드 API 클라이언트
 * SQLite 데이터베이스 API와 통신
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/**
 * API 요청 헬퍼 함수
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        errorData.error || `HTTP ${response.status}: ${response.statusText}`,
        response.status
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(`네트워크 오류: ${error.message}`, 0);
  }
}

/**
 * 서버 헬스 체크
 */
export async function checkServerHealth() {
  return await apiRequest('/health');
}

/**
 * 데이터베이스 통계 조회
 */
export async function getDatabaseStats(minAttempts = 3) {
  return await apiRequest(`/api/stats?minAttempts=${minAttempts}`);
}

/**
 * 젬 상태별 확률 조회
 */
export async function getGemProbabilities(gemState) {
  const params = new URLSearchParams({
    willpower: gemState.willpower,
    corePoint: gemState.corePoint,
    dealerA: gemState.dealerA || 0,
    dealerB: gemState.dealerB || 0,
    supportA: gemState.supportA || 0,
    supportB: gemState.supportB || 0,
    remainingAttempts: gemState.remainingAttempts,
    currentRerollAttempts: gemState.currentRerollAttempts || 0,
    costModifier: gemState.costModifier || 0,
    isFirstProcessing: gemState.isFirstProcessing ? 1 : 0
  });

  const result = await apiRequest(`/api/gem-probabilities?${params}`);
  return result;
}

/**
 * 높은 확률 상태들 조회
 */
export async function getHighProbabilityStates(target = 'prob_ancient', minProb = 0.8, limit = 10) {
  const params = new URLSearchParams({
    target,
    minProb,
    limit
  });

  return await apiRequest(`/api/high-probability?${params}`);
}

/**
 * 커스텀 SQL 쿼리 실행
 */
export async function executeCustomQuery(sql, params = []) {
  return await apiRequest('/api/query', {
    method: 'POST',
    body: JSON.stringify({ sql, params })
  });
}

/**
 * 사용 가능한 옵션들 조회
 */
export async function getAvailableOptions(gemStateId) {
  return await apiRequest(`/api/available-options/${gemStateId}`);
}

/**
 * 여러 젬 상태의 확률을 한번에 조회 (배치 처리)
 */
export async function getBatchGemProbabilities(gemStates) {
  const promises = gemStates.map(state => 
    getGemProbabilities(state).catch(error => {
      console.warn('확률 조회 실패:', state, error);
      return null;
    })
  );
  
  const results = await Promise.all(promises);
  return results.filter(result => result !== null);
}

/**
 * 처리 옵션별 예상 확률 계산
 */
export async function getProcessingOptionProbabilities(currentGem, availableOptions) {
  try {
    // 각 옵션을 적용한 후의 젬 상태들 생성
    const futureStates = availableOptions.map(option => {
      return {
        ...applyProcessingAction(currentGem, option.action),
        optionAction: option.action,
        optionDescription: option.description,
        selectionProbability: option.selectionProbability || 0.25
      };
    });

    // 배치로 확률 조회
    const probabilities = await getBatchGemProbabilities(futureStates);
    
    // 옵션별 결과 매핑
    return availableOptions.map((option, index) => ({
      ...option,
      futureGemState: futureStates[index],
      futureProbabilities: probabilities[index] || null
    }));
    
  } catch (error) {
    console.error('처리 옵션 확률 계산 실패:', error);
    return availableOptions.map(option => ({
      ...option,
      futureProbabilities: null
    }));
  }
}

/**
 * 처리 액션을 젬 상태에 적용 (프론트엔드용 간단 구현)
 */
function applyProcessingAction(gem, action) {
  const newGem = {
    ...gem,
    remainingAttempts: Math.max(0, gem.remainingAttempts - 1),
    isFirstProcessing: false
  };

  // 액션별 처리
  if (action.startsWith('willpower_')) {
    const change = parseInt(action.match(/[+-]\d+/)[0]);
    newGem.willpower = Math.max(1, Math.min(5, gem.willpower + change));
  } else if (action.startsWith('corePoint_')) {
    const change = parseInt(action.match(/[+-]\d+/)[0]);
    newGem.corePoint = Math.max(1, Math.min(5, gem.corePoint + change));
  } else if (action.startsWith('dealerA_')) {
    if (action.includes('change')) {
      // 옵션 변경은 복잡하므로 일단 현재값 유지
      // 실제로는 백엔드에서 처리해야 함
    } else {
      const change = parseInt(action.match(/[+-]\d+/)[0]);
      newGem.dealerA = Math.max(0, Math.min(5, (gem.dealerA || 0) + change));
    }
  } else if (action.startsWith('dealerB_')) {
    if (!action.includes('change')) {
      const change = parseInt(action.match(/[+-]\d+/)[0]);
      newGem.dealerB = Math.max(0, Math.min(5, (gem.dealerB || 0) + change));
    }
  } else if (action.startsWith('supportA_')) {
    if (!action.includes('change')) {
      const change = parseInt(action.match(/[+-]\d+/)[0]);
      newGem.supportA = Math.max(0, Math.min(5, (gem.supportA || 0) + change));
    }
  } else if (action.startsWith('supportB_')) {
    if (!action.includes('change')) {
      const change = parseInt(action.match(/[+-]\d+/)[0]);
      newGem.supportB = Math.max(0, Math.min(5, (gem.supportB || 0) + change));
    }
  } else if (action.startsWith('cost_')) {
    const change = parseInt(action.match(/[+-]\d+/)[0]);
    newGem.costModifier = Math.max(-100, Math.min(100, (gem.costModifier || 0) + change));
  } else if (action.startsWith('reroll_')) {
    const change = parseInt(action.match(/\+\d+/)[0].slice(1));
    newGem.currentRerollAttempts = (gem.currentRerollAttempts || 0) + change;
  }

  return newGem;
}

/**
 * 확률 데이터를 사용자 친화적 형태로 포맷
 */
export function formatProbabilities(probabilities) {
  if (!probabilities) return null;

  return {
    '5/5': { value: probabilities.prob_5_5, label: '5/5', percent: (probabilities.prob_5_5 * 100).toFixed(4) },
    '5/4': { value: probabilities.prob_5_4, label: '5/4', percent: (probabilities.prob_5_4 * 100).toFixed(4) },
    '4/5': { value: probabilities.prob_4_5, label: '4/5', percent: (probabilities.prob_4_5 * 100).toFixed(4) },
    '5/3': { value: probabilities.prob_5_3, label: '5/3', percent: (probabilities.prob_5_3 * 100).toFixed(4) },
    '4/4': { value: probabilities.prob_4_4, label: '4/4', percent: (probabilities.prob_4_4 * 100).toFixed(4) },
    '3/5': { value: probabilities.prob_3_5, label: '3/5', percent: (probabilities.prob_3_5 * 100).toFixed(4) },
    'sum8+': { value: probabilities.prob_sum8, label: 'Sum 8+', percent: (probabilities.prob_sum8 * 100).toFixed(4) },
    'sum9+': { value: probabilities.prob_sum9, label: 'Sum 9+', percent: (probabilities.prob_sum9 * 100).toFixed(4) },
    'relic+': { value: probabilities.prob_relic, label: 'Relic+', percent: (probabilities.prob_relic * 100).toFixed(4) },
    'ancient+': { value: probabilities.prob_ancient, label: 'Ancient+', percent: (probabilities.prob_ancient * 100).toFixed(4) }
  };
}

export { ApiError };

export default {
  checkServerHealth,
  getDatabaseStats,
  getGemProbabilities,
  getHighProbabilityStates,
  executeCustomQuery,
  getAvailableOptions,
  getBatchGemProbabilities,
  getProcessingOptionProbabilities,
  formatProbabilities
};