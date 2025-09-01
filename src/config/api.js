// API 설정
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export const apiConfig = {
  baseURL: API_URL,
  endpoints: {
    // 예시 엔드포인트들
    processGem: '/api/process-gem',
    getGemStats: '/api/gem-stats',
    runSimulation: '/api/run-simulation',
    // 필요한 엔드포인트 추가
  }
};

// API 호출 헬퍼 함수
export const apiCall = async (endpoint, options = {}) => {
  const url = `${API_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API Call Error:', error);
    throw error;
  }
};

export default apiConfig;