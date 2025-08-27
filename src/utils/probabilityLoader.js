// 사전 계산된 확률 테이블을 로드하는 간단한 유틸리티

class ProbabilityLoader {
  constructor() {
    this.table = null;
    this.isLoading = false;
    this.isLoaded = false;
  }

  // 젬 상태를 키로 변환
  getStateKey(gem) {
    return `${gem.willpower},${gem.corePoint},${gem.effect1.level},${gem.effect2.level},${gem.remainingAttempts},${gem.currentRerollAttempts}`;
  }

  // 확률 테이블 로드
  async loadTable() {
    if (this.isLoaded) return true;
    if (this.isLoading) return false;

    try {
      this.isLoading = true;
      console.log('📊 확률 테이블 로드 중...');
      
      // JSON 파일 로드
      const response = await fetch('/src/data/probability_table.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      this.table = await response.json();
      this.isLoaded = true;
      this.isLoading = false;
      
      console.log('✅ 확률 테이블 로드 완료');
      return true;
      
    } catch (error) {
      console.error('❌ 확률 테이블 로드 실패:', error);
      this.isLoading = false;
      return false;
    }
  }

  // 확률 조회 (기본 상태)
  getProbabilities(gem) {
    if (!this.isLoaded || !this.table) {
      console.warn('확률 테이블이 로드되지 않았습니다. loadTable()을 먼저 호출하세요.');
      return null;
    }

    const key = this.getStateKey(gem);
    const current = this.table[key];
    
    if (!current) {
      console.warn(`상태 키 ${key}에 대한 확률을 찾을 수 없습니다.`);
      return null;
    }

    // 리롤 후 확률 계산 (리롤 가능한 경우)
    let afterReroll = null;
    if (gem.currentRerollAttempts > 0 && gem.remainingAttempts > 0 && gem.processingCount > 0) {
      const rerollGem = {
        ...gem,
        currentRerollAttempts: gem.currentRerollAttempts - 1
      };
      const rerollKey = this.getStateKey(rerollGem);
      afterReroll = this.table[rerollKey] || null;
    }

    return {
      current: current,
      afterReroll: afterReroll,
      withCurrentOptions: null // 현재 옵션은 동적으로 계산
    };
  }

  // 수동 선택된 옵션들에 대한 확률 (간단한 근사치)
  getProbabilitiesWithOptions(gem, options) {
    if (!this.isLoaded || !this.table || !options || options.length === 0) {
      return this.getProbabilities(gem);
    }

    // 각 옵션에 대한 결과 확률을 평균내기 (단순화된 접근)
    const result = {};
    const targets = ['5/5', '5/4', '4/5', '5/3', '4/4', '3/5', 'sum8+', 'sum9+', 'relic+', 'ancient+'];
    
    // 각 타겟에 대해 0으로 초기화
    targets.forEach(target => {
      result[target] = 0;
    });

    // 옵션별 확률 평균 (1/n 확률로 가정)
    const optionProb = 1.0 / options.length;
    
    for (const option of options) {
      // 각 옵션 적용 후 상태에 대한 확률 조회
      const nextGem = this.simulateOptionApplication(gem, option.action);
      const nextKey = this.getStateKey(nextGem);
      const nextProbs = this.table[nextKey];
      
      if (nextProbs) {
        targets.forEach(target => {
          result[target] += optionProb * (nextProbs[target] || 0);
        });
      }
    }

    return {
      current: this.getProbabilities(gem).current,
      afterReroll: this.getProbabilities(gem).afterReroll,
      withCurrentOptions: result
    };
  }

  // 옵션 적용 시뮬레이션 (단순화된 버전)
  simulateOptionApplication(gem, action) {
    const newGem = {
      willpower: gem.willpower,
      corePoint: gem.corePoint,
      effect1: { level: gem.effect1.level },
      effect2: { level: gem.effect2.level },
      remainingAttempts: Math.max(0, gem.remainingAttempts - 1),
      currentRerollAttempts: gem.currentRerollAttempts,
      processingCount: gem.processingCount + 1
    };

    // 간단한 액션 적용
    if (action.includes('willpower_+')) {
      const change = parseInt(action.split('+')[1]);
      newGem.willpower = Math.min(5, newGem.willpower + change);
    } else if (action.includes('willpower_-')) {
      const change = parseInt(action.split('-')[1]);
      newGem.willpower = Math.max(1, newGem.willpower - change);
    } else if (action.includes('corePoint_+')) {
      const change = parseInt(action.split('+')[1]);
      newGem.corePoint = Math.min(5, newGem.corePoint + change);
    } else if (action.includes('corePoint_-')) {
      const change = parseInt(action.split('-')[1]);
      newGem.corePoint = Math.max(1, newGem.corePoint - change);
    } else if (action.includes('effect1_+')) {
      const change = parseInt(action.split('+')[1]);
      newGem.effect1.level = Math.min(5, newGem.effect1.level + change);
    } else if (action.includes('effect2_+')) {
      const change = parseInt(action.split('+')[1]);
      newGem.effect2.level = Math.min(5, newGem.effect2.level + change);
    }
    // 기타 액션들도 필요시 추가

    return newGem;
  }

  // 테이블 로드 상태 확인
  getLoadStatus() {
    return {
      isLoaded: this.isLoaded,
      isLoading: this.isLoading,
      tableSize: this.table ? Object.keys(this.table).length : 0
    };
  }
}

// 전역 인스턴스
const probabilityLoader = new ProbabilityLoader();

export default probabilityLoader;