/**
 * 백엔드 API 클라이언트
 * SQLite 데이터베이스 API와 통신
 */

const API_BASE_URL = (typeof import.meta.env !== 'undefined' && import.meta.env.VITE_API_URL) || 'http://localhost:3001';

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
 * 통합 확률 조회 - 현재, 리롤, 모든 옵션의 확률을 한 번에
 */
export async function getAllGemData(gemState) {
  const params = [
    gemState.willpower || 0,
    gemState.corePoint || 0,
    gemState.dealerA || 0,
    gemState.dealerB || 0,
    gemState.supportA || 0,
    gemState.supportB || 0,
    gemState.remainingAttempts || 0,
    gemState.currentRerollAttempts || 0,
    gemState.costModifier || 0,
    gemState.isFirstProcessing || 0
  ].join('_');
  
  const response = await fetch(`${API_BASE_URL}/api/gem-all-probabilities?s=${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch all probabilities: ${response.statusText}`);
  }
  
  const result = await response.json();
  
  // 각 상태의 확률 데이터를 포맷
  if (result.current?.probabilities) {
    result.current.probabilities = formatProbabilities(result.current.probabilities);
  }
  
  if (result.rerolls) {
    result.rerolls = result.rerolls
      .map(reroll => ({
        ...reroll,
        probabilities: formatProbabilities(reroll.probabilities)
      }))
      .sort((a, b) => a.rerollDepth - b.rerollDepth); // rerollDepth 순서대로 정렬
  }
  
  if (result.options) {
    result.options = result.options.map(option => ({
      ...option,
      probabilities: formatProbabilities(option.probabilities)
    }));
  }
  
  return result;
}

/**
 * 젬 상태별 확률 조회 (포맷된 결과 반환)
 */
export async function getGemData(gemState) {
  // 압축된 형식 사용: s=willpower_corePoint_dealerA_dealerB_supportA_supportB_remainingAttempts_currentRerollAttempts_costModifier_isFirstProcessing
  const values = [
    gemState.willpower,
    gemState.corePoint,
    gemState.dealerA || 0,
    gemState.dealerB || 0,
    gemState.supportA || 0,
    gemState.supportB || 0,
    gemState.remainingAttempts,
    gemState.currentRerollAttempts || 0,
    gemState.costModifier || 0,
    gemState.isFirstProcessing !== undefined ? gemState.isFirstProcessing : (gemState.processingCount === 0 ? 1 : 0)
  ];
  
  const params = new URLSearchParams({
    s: values.join('_')
  });

  const result = await apiRequest(`/api/gem-probabilities?${params}`);
  return result;
}

/**
 * 확률 데이터를 사용자 친화적 형태로 포맷
 */
export function formatProbabilities(probabilities) {
  if (!probabilities) return null;

  const result = {
    '5/5': { value: probabilities.prob_5_5, label: '5/5', percent: (probabilities.prob_5_5 * 100).toFixed(4) },
    '5/4': { value: probabilities.prob_5_4, label: '5/4+', percent: (probabilities.prob_5_4 * 100).toFixed(4) },
    '4/5': { value: probabilities.prob_4_5, label: '4/5+', percent: (probabilities.prob_4_5 * 100).toFixed(4) },
    '5/3': { value: probabilities.prob_5_3, label: '5/3+', percent: (probabilities.prob_5_3 * 100).toFixed(4) },
    '4/4': { value: probabilities.prob_4_4, label: '4/4+', percent: (probabilities.prob_4_4 * 100).toFixed(4) },
    '3/5': { value: probabilities.prob_3_5, label: '3/5+', percent: (probabilities.prob_3_5 * 100).toFixed(4) },
    'sum8+': { value: probabilities.prob_sum8, label: '합 8+', percent: (probabilities.prob_sum8 * 100).toFixed(4) },
    'sum9+': { value: probabilities.prob_sum9, label: '합 9+', percent: (probabilities.prob_sum9 * 100).toFixed(4) },
    'relic+': { value: probabilities.prob_relic, label: '유물+', percent: (probabilities.prob_relic * 100).toFixed(4) },
    'ancient+': { value: probabilities.prob_ancient, label: '고대', percent: (probabilities.prob_ancient * 100).toFixed(4) },
    'dealer_complete': { value: probabilities.prob_dealer_complete, label: '딜러 종결', percent: (probabilities.prob_dealer_complete * 100).toFixed(4) },
    'support_complete': { value: probabilities.prob_support_complete, label: '서폿 종결', percent: (probabilities.prob_support_complete * 100).toFixed(4) }
  };
  
  return result;
}

export { ApiError };

export default {
  checkServerHealth,
  getGemData,
  formatProbabilities
};