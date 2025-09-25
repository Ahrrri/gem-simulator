/**
 * 백엔드 API 클라이언트
 * SQLite 데이터베이스 API와 통신
 */

// 공유 설정에서 타겟 정보 import
import { getTargets } from './gemConstants.js';

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
 * 확률 데이터를 사용자 친화적 형태로 포맷 (동적)
 */
export function formatProbabilities(probabilities) {
  if (!probabilities) return null;

  const result = {};
  const targets = getTargets(); // 동적으로 로드된 타겟 사용
  
  // 공유 설정의 TARGETS를 이용하여 동적으로 포맷
  for (const [targetName, targetInfo] of Object.entries(targets)) {
    const columnName = targetInfo.columnName;
    const probabilityKey = `prob_${columnName}`;
    
    if (probabilities[probabilityKey] !== undefined) {
      result[targetName] = {
        value: probabilities[probabilityKey],
        label: targetInfo.label,
        percent: (probabilities[probabilityKey] * 100).toFixed(4)
      };
    }
  }
  
  return result;
}

export { ApiError };

export default {
  checkServerHealth,
  getGemData,
  formatProbabilities
};