import './ProcessingGemDisplay.css';
import { 
  executeGemProcessing, 
  createProcessingGem, 
  rerollProcessingOptions, 
  getAllOptionsStatus, 
  getProcessingHistory,
  getActionDescription, 
} from '../utils/gemProcessing';
import { GEM_TYPES, GEM_GRADES, GEM_EFFECTS } from '../utils/gemConstants';
import { 
  checkServerHealth,
  getAllGemData
} from '../utils/apiClient';

// API URL 가져오기 (환경변수 기반)
const API_BASE_URL = (typeof import.meta.env !== 'undefined' && import.meta.env.VITE_API_URL) || 'http://localhost:3001';
import { useState, useEffect } from 'react';

function ProcessingGemDisplay({
  processingGem,
  setProcessingGem,
  processingHistory,
  setProcessingHistory,
  lastProcessingResult,
  setLastProcessingResult,
  showDisplayProbability,
  setShowDisplayProbability,
  showNormalizedProbability,
  setShowNormalizedProbability,
  selectedHistoryIndex,
  setSelectedHistoryIndex
}) {
  const [serverStatus, setServerStatus] = useState('disconnected');
  const [currentData, setCurrentData] = useState(null);
  const [optionData, setOptionData] = useState(null);
  const [rerollData, setRerollData] = useState(null);
  const [rerollsData, setRerollsData] = useState([]); // 모든 리롤 데이터 배열
  const [currentRerollIndex, setCurrentRerollIndex] = useState(0); // 현재 표시 중인 리롤 인덱스
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isManualOptionSampling, setIsManualOptionSampling] = useState(false);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(null);
  const [showChangeTargets, setShowChangeTargets] = useState(false);
  const [selectedChangeOption, setSelectedChangeOption] = useState(null);
  const [selectedTargetOption, setSelectedTargetOption] = useState(null);
  const [gemPrice, setGemPrice] = useState(null);
  const [initialProbabilities, setInitialProbabilities] = useState(null); // 젬 초기 상태의 확률 정보
  const [initialGemStats, setInitialGemStats] = useState(null); // 젬 초기 상태의 목표별 확률과 예상비용
  const [allData, setAllData] = useState(null); // 통합 API 응답 데이터

  // 현재 사용할 옵션 세트 계산
  const getCurrentOptionSet = () => {
    if (!processingGem) return [];
    if (isManualOptionSampling) {
      return processingGem.manualOptionSet || [];
    } else {
      return processingGem.autoOptionSet || [];
    }
  };

  // 서버 연결 상태 확인
  useEffect(() => {
    checkServerHealth()
      .then(() => {
        setServerStatus('connected');
        console.log('✅ API 서버 연결 성공');
      })
      .catch(error => {
        setServerStatus('error');
        console.error('❌ API 서버 연결 실패:', error);
      });
  }, []);

  // 젬이 새로 설정될 때 초기 확률 정보 저장
  useEffect(() => {
    if (processingGem && currentData && !initialProbabilities) {
      setInitialProbabilities(currentData);
    }
  }, [processingGem, currentData]);

  // 젬이 새로 설정되거나 젬 가격이 변동될 때 초기 통계 계산
  useEffect(() => {
    if (processingGem && gemPrice && initialProbabilities) {
      const stats = {};
      const targets = ['5/5', '5/4', '4/5', '5/3', '4/4', '3/5', 'sum8+', 'sum9+', 'relic+', 'ancient+', 'dealer_complete', 'support_complete'];
      
      for (const target of targets) {
        const currentProb = parseFloat(initialProbabilities.probabilities[target]?.value || 0);
        
        if (currentProb > 0) {
          // initialProbabilities에서 해당 목표의 예상 비용 가져오기
          const expectedCost = initialProbabilities?.expectedCosts?.[target] || 0;
          
          // 기준치: (젬 가격 + 예상 비용) / 현재 확률
          stats[target] = {
            baseThreshold: (gemPrice + expectedCost) / currentProb,
            expectedCost,
            currentProbability: currentProb
          };
        }
      }
      setInitialGemStats(stats);
    }
    else {
      setInitialGemStats(null);
    }
  }, [gemPrice, initialProbabilities]);

  // 젬의 핵심 상태나 서버 상태 변경 시 API 호출
  useEffect(() => {
    if (processingGem && serverStatus === 'connected') {
      handleLoadAllProbabilities();
    } else {
      setCurrentData(null);
      setOptionData(null);
      setRerollData(null);
    }
  }, [processingGem?.processingCount, serverStatus]);

  // 옵션 세트 변경 시 기존 데이터를 재활용하여 필터링
  useEffect(() => {
    if (!allData) return;
    
    updateOptionData();
  }, [processingGem?.autoOptionSet, isManualOptionSampling, processingGem?.manualOptionSet, allData]);

  // 통합 확률 조회 - 현재, 리롤, 모든 옵션을 한 번에
  const handleLoadAllProbabilities = async () => {
    if (!processingGem) return;
    
    try {
      setIsLoadingData(true);
      // 모든 확률 초기화
      setCurrentData(null);
      setOptionData(null);
      setRerollData(null);
      
      // 한 번의 API 호출로 모든 데이터 가져오기
      const allData = await getAllGemData(processingGem);
      
      // 전체 데이터 저장
      setAllData(allData);
      
      // 현재 상태 확률 설정
      if (allData.current) {
        setCurrentData(allData.current);
      }
      
      // 리롤 확률 설정 (배열로 처리)
      if (allData.rerolls && allData.rerolls.length > 0) {
        setRerollsData(allData.rerolls);
        setRerollData(allData.rerolls[0]); // 첫 번째 리롤 데이터를 기본으로 표시
        setCurrentRerollIndex(0);
      } else {
        setRerollsData([]);
        setRerollData(null);
        setCurrentRerollIndex(0);
      }
      
      // 옵션별 확률은 별도 함수에서 처리
      updateOptionData(allData);
    } catch (error) {
      console.error('통합 확률 조회 실패:', error);
      setCurrentData(null);
      setOptionData(null);
      setRerollData(null);
    } finally {
      setIsLoadingData(false);
    }
  };

  // 옵션 확률 업데이트 (기존 데이터 재활용)
  const updateOptionData = (data = allData) => {
    if (!data?.options || data.options.length === 0) {
      setOptionData(null);
      return;
    }
    
    // 수동 모드일 때는 4개 옵션이 모두 선택된 경우에만 표시
    if (isManualOptionSampling) {
      const manualSet = processingGem?.manualOptionSet || [];
      if (manualSet.length !== 4) {
        setOptionData(null);
        return;
      }
    }
    
    // 현재 옵션 순서대로 매칭하여 정렬
    const currentOptions = getCurrentOptionSet();
    const formattedOptions = [];
    
    // 각 타겟별 확률 비교 정보 계산
    const targets = ['5/5', '5/4', '4/5', '5/3', '4/4', '3/5', 'sum8+', 'sum9+', 'relic+', 'ancient+', 'dealer_complete', 'support_complete'];
    const targetComparisons = {};
    
    for (const target of targets) {
      // 옵션별 확률 평균 계산
      const validProbs = [];
      for (const currentOption of currentOptions) {
        const matchedOption = data.options.find(opt => opt.action === currentOption.action);
        if (matchedOption?.probabilities?.[target]) {
          const prob = parseFloat(matchedOption.probabilities[target].percent || '0.0');
          if (!isNaN(prob)) {
            validProbs.push(prob);
          }
        }
      }
      
      const avgOptionProb = validProbs.length > 0 ? validProbs.reduce((sum, p) => sum + p, 0) / validProbs.length : 0;
      
      // 리롤 확률
      const rerollProb = parseFloat(rerollData?.probabilities?.[target]?.percent || '0.0');
      
      // 비교 결과
      let isOptionBetter = true;
      let isRerollBetter = false;
      if (avgOptionProb < rerollProb && processingGem?.currentRerollAttempts > 0 && processingGem?.processingCount > 0) {
        isOptionBetter = false;
        isRerollBetter = true;
      }
      
      targetComparisons[target] = {
        avgOptionProb,
        rerollProb,
        isOptionBetter,
        isRerollBetter
      };
    }
    
    for (const currentOption of currentOptions) {
      const matchedOption = data.options.find(opt => opt.action === currentOption.action);
      if (matchedOption) {
        formattedOptions.push({
          action: matchedOption.action,
          description: getActionDescription(matchedOption.action),
          resultProbabilities: matchedOption.probabilities,
          resultExpectedCosts: matchedOption.expectedCosts || {},
          targetComparisons
        });
      }
    }
    
    setOptionData(formattedOptions);
  };

  // _change 옵션의 가능한 대상 옵션들 찾기
  const getAvailableChangeTargets = () => {
    if (!processingGem) return [];
    
    const currentOptions = ['dealerA', 'dealerB', 'supportA', 'supportB'];
    const inactiveOptions = currentOptions.filter(opt => (processingGem[opt] || 0) === 0);
    
    return inactiveOptions.map(opt => {
      const effectName = getEffectName(processingGem, opt);
      return { optionKey: opt, effectName };
    });
  };

  // 현재 활성화된 옵션들 가져오기 (0이 아닌 값들)
  const getActiveEffects = (gem) => {
    const effects = [];
    const optionTypes = [
      { key: 'dealerA', name: 'dealerA' },
      { key: 'dealerB', name: 'dealerB' }, 
      { key: 'supportA', name: 'supportA' },
      { key: 'supportB', name: 'supportB' }
    ];
    
    optionTypes.forEach(option => {
      const level = gem[option.key] || 0;
      if (level > 0) {
        effects.push({
          name: getEffectName(gem, option.name),
          level: level
        });
      }
    });
    
    // 활성화된 효과가 없으면 기본값 반환
    if (effects.length === 0) {
      return [
        { name: getEffectName(gem, 'dealerA'), level: 1 },
        { name: getEffectName(gem, 'dealerB'), level: 1 }
      ];
    }
    
    return effects;
  };

  // 옵션 이름 매핑 (4개 옵션을 실제 효과명으로)
  const getEffectName = (gem, optionType) => {
    const defaultNames = {
      'dealerA': '첫번째 효과',
      'dealerB': '두번째 효과', 
      'supportA': '세번째 효과',
      'supportB': '네번째 효과'
    };
    
    if (!gem.mainType || !gem.subType) {
      return defaultNames[optionType] || optionType;
    }
    
    // GEM_EFFECTS에서 직접 효과 이름 가져오기
    try {
      const effects = GEM_EFFECTS[gem.mainType]?.[gem.subType] || [];
      const index = {
        'dealerA': 0,
        'dealerB': 1, 
        'supportA': 2,
        'supportB': 3
      }[optionType];

      return effects[index] || defaultNames[optionType] || optionType;
    } catch (error) {
      console.warn('효과 이름을 가져올 수 없음:', error);
      return defaultNames[optionType] || optionType;
    }
  };

  // 서버 연결 상태 새로고침
  const handleRefreshConnection = async () => {
    setIsLoadingData(true);
    
    try {
      await checkServerHealth();
      setServerStatus('connected');
      console.log('✅ API 서버 연결 새로고침 성공');
      
      if (processingGem) {
        await handleLoadAllProbabilities();
      }
    } catch (error) {
      setServerStatus('error');
      console.error('❌ API 서버 연결 실패:', error);
    } finally {
      setIsLoadingData(false);
    }
  };


  // 서버 상태 표시용 함수
  const getServerStatusDisplay = () => {
    switch (serverStatus) {
      case 'connected':
        return { text: '서버 연결됨', icon: '✅', color: '#27ae60' };
      case 'disconnected':
        return { text: '서버 연결 중...', icon: '🔄', color: '#f39c12' };
      case 'error':
        return { text: '서버 연결 실패', icon: '❌', color: '#e74c3c' };
      default:
        return { text: '알 수 없음', icon: '❓', color: '#95a5a6' };
    }
  };

  const getGemTypeName = (mainType, subType) => {
    if (mainType === 'ORDER') {
      return `질서의 젬: ${GEM_TYPES.ORDER[subType]}`;
    } else {
      return `혼돈의 젬: ${GEM_TYPES.CHAOS[subType]}`;
    }
  };

  const getGradeName = (grade) => {
    return GEM_GRADES[grade] || grade;
  };

  const getGradeByPoints = (totalPoints) => {
    if (totalPoints >= 19) return '고대';
    if (totalPoints >= 16) return '유물';
    return '전설';
  };


  // 처리 계속 vs 새 젬 구매 권장사항
  const getProcessingRecommendation = (target, isRerollBetter = false) => {
    if (!initialGemStats?.[target] || !optionData) {
      return null;
    }
    
    // 각 옵션별로 계산 후 평균
    const processingCost = 900 * (1 + (processingGem.costModifier || 0) / 100);
    
    const validExpectedCosts = [];
    const validExpectedProfits = [];
    for (const option of optionData) {
      if (option.resultProbabilities?.[target] && option.resultExpectedCosts?.[target] !== undefined) {
        const prob = parseFloat(option.resultProbabilities[target].value || 0);
        const cost = option.resultExpectedCosts[target];
        
        const expectedCost = processingCost + cost;
        const expectedProfit = prob * initialGemStats[target].baseThreshold;
        validExpectedCosts.push(expectedCost);
        validExpectedProfits.push(expectedProfit);
      }
    }
    if (validExpectedCosts.length === 0) {
      return null;
    }
    
    // 기댓값들의 평균
    const currentExpectedCost = validExpectedCosts.reduce((sum, cost) => sum + cost, 0) / validExpectedCosts.length;
    const currentExpectedProfit = validExpectedProfits.reduce((sum, cost) => sum + cost, 0) / validExpectedProfits.length;
    
    const canReroll = processingGem?.currentRerollAttempts > 0 && processingGem?.processingCount > 0;
        
    if (currentExpectedCost < currentExpectedProfit) {
      // 가공이 더 효율적인 경우: isRerollBetter에 따라 결정
      if (isRerollBetter && canReroll) {
        return {
          recommendation: 'reroll_better',
          reason: '리롤 후 가공이 더 효율적',
          currentExpectedCost,
          currentExpectedProfit
        };
      } else {
        return { 
          recommendation: 'continue_processing', 
          reason: '가공이 더 효율적',
          currentExpectedCost,
          currentExpectedProfit
        };
      }
    } else {
      // 새 젬 구매가 더 효율적인 경우: 리롤 가능하면 리롤 시도
      if (canReroll) {
        return {
          recommendation: 'reroll_better',
          reason: '리롤 시도 후 판단',
          currentExpectedCost,
          currentExpectedProfit
        };
      } else {
        return { 
          recommendation: 'buy_new', 
          reason: '새 젬 구매가 더 효율적',
          currentExpectedCost,
          currentExpectedProfit
        };
      }
    }
  };

  // 확률 목표 표시용 라벨
  const getTargetDisplayLabel = (target) => {
    const targetLabels = {
      '5/5': '5/5',
      '5/4': '5/4 이상',
      '4/5': '4/5 이상', 
      '5/3': '5/3 이상',
      '4/4': '4/4 이상',
      '3/5': '3/5 이상',
      'sum8+': '합 8 이상',
      'sum9+': '합 9 이상',
      'relic+': '유물 이상',
      'ancient+': '고대',
      'dealer_complete': '딜러 종결',
      'support_complete': '서폿 종결'
    };
    return targetLabels[target] || target;
  };

  // 설명에서 옵션 이름과 코어 포인트 타입을 실제 이름으로 교체하는 함수
  const formatDescription = (description, gem) => {
    if (!description || !gem) return description;
    
    let desc = description;
    
    // 옵션 이름 교체
    desc = desc.replace(/딜러A 옵션/g, getEffectName(gem, 'dealerA'));
    desc = desc.replace(/딜러B 옵션/g, getEffectName(gem, 'dealerB'));
    desc = desc.replace(/서폿A 옵션/g, getEffectName(gem, 'supportA'));
    desc = desc.replace(/서폿B 옵션/g, getEffectName(gem, 'supportB'));
    
    // 질서/혼돈 포인트를 실제 타입에 맞게 교체
    const corePointName = gem.mainType === 'ORDER' ? '질서' : '혼돈';
    desc = desc.replace(/질서\/혼돈/g, corePointName);
    
    return desc;
  };


  if (!processingGem) {
    return (
      <div className="processing-gem-display">
        <h2>젬 가공</h2>
        <p>가공할 젬을 선택해주세요.</p>
        
        <div className="api-server-controls">
          <div className="server-status">
            <span 
              className="status-indicator"
              style={{ color: getServerStatusDisplay().color }}
            >
              {getServerStatusDisplay().icon} {getServerStatusDisplay().text}
            </span>
          </div>
          
          <button 
            onClick={handleRefreshConnection} 
            disabled={isLoadingData}
            className="refresh-connection-btn"
          >
            {isLoadingData ? '연결 중...' : '서버 연결 새로고침'}
          </button>
        </div>

        {serverStatus === 'error' && (
          <div className="error-message">
            <p>❌ API 서버에 연결할 수 없습니다.</p>
            <p>서버가 실행 중인지 확인해주세요. (혹은, 최초 접속시 SSL 인증서 이슈로 인해 <a href={`${API_BASE_URL}/health`} target="_blank" rel="noopener noreferrer">여기</a>를 클릭해 한 번 접속해 주세요.)</p>
          </div>
        )}

        {serverStatus === 'connected' && (
          <div className="server-ready">
            <p>✅ API 서버에 연결되었습니다. 젬을 선택하면 확률을 조회합니다.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="processing-gem-section">
      {/* Left Column */}
      <div className="processing-left-column">
        <div className="processing-layout">
          <div className="processing-left">
            <div className="current-gem">
              <h3>가공 중인 젬</h3>
              <div className={`gem-card processing ${processingGem.grade.toLowerCase()}`}>
                <div className="gem-grade">{getGradeName(processingGem.grade)}</div>
                <div className="gem-type">
                  {getGemTypeName(processingGem.mainType, processingGem.subType)}
                </div>
                <div className="gem-stats">
                  <div className="stat-row">
                    <span>의지력 효율:</span>
                    <span className={processingGem.willpower === 5 ? 'max' : ''}>
                      {processingGem.willpower}
                    </span>
                  </div>
                  <div className="stat-row">
                    <span>{processingGem.mainType === 'ORDER' ? '질서' : '혼돈'} 포인트:</span>
                    <span className={processingGem.corePoint === 5 ? 'max' : ''}>
                      {processingGem.corePoint}
                    </span>
                  </div>
                  {getActiveEffects(processingGem).map((effect, index) => (
                    <div key={index} className="stat-row">
                      <span>{effect.name}:</span>
                      <span className={effect.level === 5 ? 'max' : ''}>
                        Lv.{effect.level}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="gem-info">
                  <div className="info-row">
                    <span>가공 진행: {processingGem.processingCount}회</span>
                  </div>
                  <div className="info-row">
                    <span>남은 가공 횟수: {processingGem.remainingAttempts}회</span>
                  </div>
                  <div className="info-row">
                    <span>
                      포인트 총합: {processingGem.totalPoints} ({getGradeByPoints(processingGem.totalPoints)})
                      <span 
                        className="grade-tooltip" 
                        title="전설(4~15), 유물(16~18), 고대(19~20)"
                      >
                        ℹ️
                      </span>
                    </span>
                  </div>
                  <div className="info-row">
                    <span>
                      가공 비용 상태: <span className={`cost-modifier ${processingGem.costModifier < 0 ? 'discount' : processingGem.costModifier > 0 ? 'expensive' : 'normal'}`}>
                        {processingGem.costModifier > 0 ? '+' : ''}{processingGem.costModifier}%
                      </span>
                      <span 
                        className="grade-tooltip" 
                        title="-100%, 0%, +100% 중 하나"
                      >
                        ℹ️
                      </span>
                    </span>
                  </div>
                  <div className="info-row">
                    <span>누적 가공 비용: {Math.round(processingGem.totalGoldSpent || 0).toLocaleString()}골드</span>
                  </div>
                  <div className="info-row">
                    <span>다른 항목 보기: {processingGem.currentRerollAttempts}회 남음</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        
        {/* 오른쪽: 컴팩트한 옵션 상태 패널 */}
        <div className="processing-right">
          <div className="options-status-panel">
            <div className="options-status-header">
              <h4>⚙️ 가공 옵션 상태</h4>
              <div className="probability-checkboxes">
                <label className="probability-checkbox">
                  <input
                    type="checkbox"
                    checked={showDisplayProbability}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setShowNormalizedProbability(false);
                      }
                      setShowDisplayProbability(e.target.checked);
                    }}
                  />
                  실제 출현 확률 표시
                  <span 
                    className="grade-tooltip" 
                    title="실제로 4개 옵션 조합에 포함될 확률"
                  >
                    ℹ️
                  </span>
                </label>
                <label className="probability-checkbox">
                  <input
                    type="checkbox"
                    checked={showNormalizedProbability}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setShowDisplayProbability(false);
                      }
                      setShowNormalizedProbability(e.target.checked);
                    }}
                  />
                  총합 400 기준 가중치 표시
                  <span 
                    className="grade-tooltip" 
                    title="가중치 합이 400이 되도록 정규화한 값"
                  >
                    ℹ️
                  </span>
                </label>
              </div>
            </div>
            {(() => {
              const allOptions = getAllOptionsStatus(processingGem);
              
              // 선택된 4개 옵션의 액션들 추출
              const selectedActions = new Set(getCurrentOptionSet().map(opt => opt.action));
              
              // 확률 표시 모드에 따른 계산
              let displayOptions = allOptions;
              
              if (showDisplayProbability && currentData?.availableOptions) {
                // 모드 1: DB에서 온 selectionProbability × 4가 실제 출현 확률
                const selectionProbMap = {};
                currentData.availableOptions.forEach(apiOpt => {
                  selectionProbMap[apiOpt.action] = apiOpt.selectionProbability;
                });
                
                displayOptions = allOptions.map(opt => ({
                  ...opt,
                  displayProbability: (selectionProbMap[opt.action] || 0) * 4
                }));
              } else if (showNormalizedProbability) {
                // 모드 2: 총합 400 기준 정규화된 가중치 (사용 가능한 옵션만)
                const availableOptions = allOptions.filter(opt => opt.isAvailable);
                const totalProbability = availableOptions.reduce((sum, opt) => sum + opt.probability, 0);
                
                displayOptions = allOptions.map(opt => ({
                  ...opt,
                  displayProbability: opt.isAvailable && totalProbability > 0 
                    ? (opt.probability / totalProbability) * 4 
                    : 0
                }));
              } else {
                // 모드 3: 기본 probability (4-combo에서의 가중치)
                displayOptions = allOptions.map(opt => ({
                  ...opt,
                  displayProbability: opt.probability
                }));
              }
              
              // 카테고리별로 옵션 분류 (첫 행: 젬 효과, 둘째 행: 기본 스탯)
              const categories = [
                // 첫 행: 젬 효과들
                {
                  dealerA: {
                    title: getEffectName(processingGem, 'dealerA'),
                    options: displayOptions.filter(opt => opt.action.startsWith('dealerA_'))
                  },
                  dealerB: {
                    title: getEffectName(processingGem, 'dealerB'), 
                    options: displayOptions.filter(opt => opt.action.startsWith('dealerB_'))
                  },
                  supportA: {
                    title: getEffectName(processingGem, 'supportA'),
                    options: displayOptions.filter(opt => opt.action.startsWith('supportA_'))
                  },
                  supportB: {
                    title: getEffectName(processingGem, 'supportB'), 
                    options: displayOptions.filter(opt => opt.action.startsWith('supportB_'))
                  }
                },
                // 둘째 행: 기본 스탯들 + 가공 결과
                {
                  willpower: {
                    title: '의지력 효율',
                    options: displayOptions.filter(opt => opt.action.startsWith('willpower_'))
                  },
                  corePoint: {
                    title: `${processingGem.mainType === 'ORDER' ? '질서' : '혼돈'} 포인트`, 
                    options: displayOptions.filter(opt => opt.action.startsWith('corePoint_'))
                  },
                  etc: {
                    title: '기타',
                    options: displayOptions.filter(opt => 
                      opt.action.startsWith('cost_') || 
                      opt.action.startsWith('reroll_') || 
                      opt.action === 'maintain'
                    )
                  },
                  result: {
                    title: '가공 히스토리',
                    isSpecial: true // 특별한 섹션임을 표시
                  }
                }
              ];
              
              return (
                <div className="compact-options-grid">
                  {categories.map((row, rowIndex) => (
                    <div key={rowIndex} className="options-row">
                      {Object.values(row).map((category, categoryIndex) => {
                        // 특별한 섹션 (가공 결과)인지 확인
                        if (category.isSpecial) {
                          return (
                            <div key={categoryIndex} className="option-category result-category">
                              <div className="category-title">{category.title}</div>
                              <div className="result-content">
                                {/* 히스토리 네비게이션 버튼들 */}
                                {processingGem && (
                                  <div className="history-navigation">
                                    {(() => {
                                      const history = getProcessingHistory(processingGem);
                                      return (
                                        <div className="history-buttons">
                                          {history.map((_, index) => (
                                            <button
                                              key={index}
                                              className={`history-btn ${selectedHistoryIndex === index ? 'active' : ''}`}
                                              onClick={() => setSelectedHistoryIndex(index)}
                                            >
                                              {index}
                                            </button>
                                          ))}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                )}
                                
                                {/* 선택된 히스토리 또는 최근 결과 표시 */}
                                {(() => {
                                  if (processingGem && selectedHistoryIndex !== null) {
                                    // 히스토리에서 선택된 상태 표시
                                    const history = getProcessingHistory(processingGem);
                                    const selectedHistory = history[selectedHistoryIndex];
                                    
                                    // 공통 되돌리기 함수
                                    const handleRestore = () => {
                                      if (selectedHistoryIndex === history.length - 1) {
                                        return;
                                      }
                                      
                                      // 원본 젬을 linked list를 통해 직접 찾기
                                      let targetGem = processingGem;
                                      const targetIndex = selectedHistoryIndex;
                                      const currentIndex = history.length - 1;
                                      
                                      // 현재에서 목표 위치까지 거슬러 올라가기
                                      for (let i = 0; i < (currentIndex - targetIndex); i++) {
                                        if (targetGem && targetGem.previousState) {
                                          targetGem = targetGem.previousState;
                                        }
                                      }
                                      
                                      if (targetGem) {
                                        setProcessingGem(targetGem);
                                        setSelectedHistoryIndex(targetIndex);
                                      }
                                    };

                                    return (
                                      <div>
                                        <div className="processing-result-card-compact">
                                          <div className="result-badges">
                                            <span className="result-badge history-step">
                                              {selectedHistory && selectedHistory.processedWith 
                                                ? `${selectedHistoryIndex}회차` 
                                                : '초기 상태'}
                                            </span>
                                          </div>
                                          <div className="result-option-compact">
                                            {selectedHistory && selectedHistory.processedWith
                                              ? formatDescription(selectedHistory.processedWith.description, processingGem)
                                              : '가공 시작 전'}
                                          </div>
                                        </div>
                                        <button 
                                          className="btn-secondary restore-btn"
                                          onClick={handleRestore}
                                          disabled={selectedHistoryIndex === history.length - 1}
                                        >
                                          🔄 이 상태로 되돌리기
                                        </button>
                                      </div>
                                    );
                                  } else if (lastProcessingResult) {
                                    // 기존 최근 결과 표시
                                    return (
                                      <div className="processing-result-card-compact">
                                        <div className="result-badges">
                                          <span className={`result-badge ${lastProcessingResult.optionGeneration === 'manual' ? 'manual-generation' : 'auto-generation'}`}>
                                            {lastProcessingResult.optionGeneration === 'manual' ? '수동 생성' : '자동 생성'}
                                          </span>
                                          <span className={`result-badge ${lastProcessingResult.selectionMethod === 'manual' ? 'manual-selection' : 'auto-selection'}`}>
                                            {lastProcessingResult.selectionMethod === 'manual' ? '수동 선택' : '자동 선택'}
                                          </span>
                                        </div>
                                        <div className="result-option-compact">
                                          {formatDescription(lastProcessingResult.option.description, processingGem)}
                                        </div>
                                      </div>
                                    );
                                  } else {
                                    return <div className="no-result">아직 가공하지 않음</div>;
                                  }
                                })()}
                              </div>
                            </div>
                          );
                        }
                        
                        // 일반 옵션 카테고리
                        return (
                          <div key={categoryIndex} className="option-category">
                            <div className="category-title">{category.title}</div>
                            <div className="category-options">
                              {category.options.map((option, index) => {
                                const isAutoSelected = selectedActions.has(option.action);
                                const isInManualSet = (processingGem.manualOptionSet || []).some(manualOpt => manualOpt.action === option.action);
                                const isSelected = isManualOptionSampling ? isInManualSet : isAutoSelected;
                                return (
                                  <div 
                                    key={index} 
                                    className={`compact-option ${option.isAvailable ? 'available' : 'disabled'} ${isSelected ? 'selected' : ''} ${isManualOptionSampling && option.isAvailable ? 'clickable' : ''}`}
                                    onClick={() => {
                                      if (isManualOptionSampling && option.isAvailable) {
                                        const currentManualSet = processingGem.manualOptionSet || [];
                                        if (isInManualSet) {
                                          // 이미 선택된 옵션 - 제거
                                          setProcessingGem(prev => ({
                                            ...prev,
                                            manualOptionSet: currentManualSet.filter(opt => opt.action !== option.action)
                                          }));
                                        } else if (currentManualSet.length < 4) {
                                          // 새 옵션 추가 (최대 4개까지)
                                          setProcessingGem(prev => ({
                                            ...prev,
                                            manualOptionSet: [...currentManualSet, option]
                                          }));
                                        }
                                      }
                                    }}
                                  >
                                    <div className="compact-option-name">
                                      {(() => {
                                        let desc = option.description;

                                        // 실제 효과 이름으로 교체
                                        desc = formatDescription(desc, processingGem);
                                        return desc.replace(/Lv\.|증가|감소|상태|보기/g, '').trim();
                                      })()}({(option.displayProbability * 100).toFixed(2)}%)
                                    </div>
                                    <div className="compact-option-status">
                                      {option.isAvailable ? '✓' : '✗'}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              );
            })()} 
          </div>
          </div>
        </div>
        
        {/* 가공 옵션 */}
        <div className="processing-options">
          <div className="options-header">
            <h3>가공 옵션 선택</h3>
            <div className="options-controls">
              {/* 수동/자동 모드 토글 */}
              <div className="manual-mode-toggle">
                <label>
                  <input
                    type="checkbox"
                    checked={isManualOptionSampling}
                    onChange={(e) => {
                      setIsManualOptionSampling(e.target.checked);
                      setSelectedOptionIndex(null);
                    }}
                  />
                  직접 옵션 샘플링
                </label>
              </div>
              
              {/* 다른 항목 보기 버튼 */}
              <button
                className="reroll-btn"
                disabled={processingGem.processingCount === 0 || processingGem.currentRerollAttempts === 0 || processingGem.remainingAttempts === 0}
                title={(() => {
                  if (processingGem.remainingAttempts === 0) {
                    return '가공이 완료되었습니다.';
                  } else if (processingGem.currentRerollAttempts === 0) {
                    return '남은 횟수를 모두 소진하였습니다.';
                  } else if (processingGem.processingCount === 0) {
                    return '첫 가공은 진행해야 합니다.';
                  } else {
                    return '다른 항목 보기를 진행할 수 있습니다.';
                  }
                })()}
                onClick={() => {
                  // 실제로 리롤 실행
                  const result = rerollProcessingOptions(processingGem);
                  if (result) {
                    setProcessingGem(result);
                    setSelectedOptionIndex(null);
                    // 리롤 후 다음 depth의 데이터를 표시
                    if (rerollsData && rerollsData.length > currentRerollIndex + 1) {
                      const nextIndex = currentRerollIndex + 1;
                      setCurrentRerollIndex(nextIndex);
                      setRerollData(rerollsData[nextIndex]);
                    }
                  }
                }}
              >
                🔄 다른 항목 보기 ({processingGem.currentRerollAttempts}회)
              </button>
            </div>
          </div>
          
          <div className="options-display">
            {(() => {
              const currentOptionSet = getCurrentOptionSet();
              return currentOptionSet.length > 0 && processingGem.remainingAttempts > 0 ? (
                currentOptionSet.map((option, index) => (
                <div
                  key={index}
                  className={`option-display clickable ${selectedOptionIndex === index ? 'selected' : ''}`}
                  onClick={() => {
                    const isChangeOption = option.action.endsWith('_change');
                    
                    if (isChangeOption && selectedOptionIndex !== index) {
                      // _change 옵션을 새로 선택한 경우
                      setSelectedOptionIndex(index);
                      setSelectedChangeOption(option);
                      setSelectedTargetOption(null); // 새로운 _change 옵션 선택 시 이전 타겟 초기화
                      setShowChangeTargets(true);
                    } else if (selectedOptionIndex === index) {
                      // 같은 옵션을 다시 클릭한 경우 (선택 해제)
                      setSelectedOptionIndex(null);
                      setShowChangeTargets(false);
                      setSelectedChangeOption(null);
                      setSelectedTargetOption(null);
                    } else {
                      // 일반 옵션 선택
                      setSelectedOptionIndex(index);
                      setShowChangeTargets(false);
                      setSelectedChangeOption(null);
                      setSelectedTargetOption(null);
                    }
                  }}
                >
                  {selectedOptionIndex === index && (
                    <div className="option-selector">✓</div>
                  )}
                  <div className="option-description">
                    {(() => {
                      let desc = option.description;
                      // 실제 효과 이름으로 교체
                      return formatDescription(desc, processingGem);
                    })()}
                  </div>
                  
                  {/* _change 옵션의 대상 선택 UI - 선택된 옵션 내부에 위치 */}
                  {selectedOptionIndex === index && showChangeTargets && selectedChangeOption && (
                    <div className="change-target-selection">
                      <div className="change-target-header">  
                        <span>변경할 대상을 선택하세요:</span>
                      </div>
                      <div className="change-target-buttons">
                        {getAvailableChangeTargets().map((target, idx) => (
                          <button
                            key={idx}
                            className={`change-target-btn ${selectedTargetOption?.optionKey === target.optionKey ? 'selected' : ''}`}
                            onClick={(e) => {
                              // 이벤트 전파 방지 (부모 option-display 클릭 이벤트와 충돌 방지)
                              e.stopPropagation();
                              // 타겟 옵션 선택만 하기 (실행하지 않음)
                              setSelectedTargetOption(target);
                            }}
                          >
                            {target.effectName}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                ))
              ) : (
                <div className="no-options-message">
                  {isManualOptionSampling ? `수동 옵션 선택 (${(processingGem.manualOptionSet || []).length}/4)` : '가공 완료'}
                </div>
              );
            })()}
          </div>
        </div>
        
        {/* 가공하기 버튼 / 완료 메시지 */}
        <div className="processing-action">
          {processingGem.remainingAttempts > 0 ? (
            <div className="processing-buttons">
              {/* 랜덤 가공 버튼 */}
              <button
                className="btn btn-secondary processing-btn"
                onClick={() => {
                  const currentOptionSet = getCurrentOptionSet();
                  if (currentOptionSet.length > 0) {
                    // 랜덤 선택
                    const randomIndex = Math.floor(Math.random() * currentOptionSet.length);
                    const selectedOption = currentOptionSet[randomIndex];
                    
                    // 선택된 옵션 정보 저장
                    setLastProcessingResult({
                      option: selectedOption,
                      beforeGem: { ...processingGem },
                      optionGeneration: isManualOptionSampling ? 'manual' : 'auto',
                      selectionMethod: 'auto'
                    });
                    
                    // 가공 실행
                    const newGem = executeGemProcessing(processingGem, selectedOption.action);
                    setProcessingGem(newGem);
                    setProcessingHistory([...processingHistory, newGem]);
                    setSelectedOptionIndex(null);
                    setSelectedHistoryIndex(newGem.processingCount);
                  }
                }}
                disabled={getCurrentOptionSet().length === 0}
              >
                랜덤 가공
              </button>
              
              {/* 옵션 골라서 가공 버튼 */}
              <button
                className="btn btn-primary processing-btn"
                title={(() => {
                  const currentOptionSet = getCurrentOptionSet();
                  if (currentOptionSet.length === 0) {
                    return '가공할 옵션이 없습니다.';
                  } else if (selectedOptionIndex === null) {
                    return '샘플된 4개의 옵션 중 하나를 선택하면 해당 옵션으로 가공을 진행할 수 있습니다.';
                  } else {
                    return '선택한 옵션으로 가공하기';
                  }
                })()}
                onClick={() => {
                  const currentOptionSet = getCurrentOptionSet();
                  if (selectedOptionIndex !== null && currentOptionSet.length > 0) {
                    const selectedOption = currentOptionSet[selectedOptionIndex];
                    
                    // 선택된 옵션 정보 저장
                    setLastProcessingResult({
                      option: selectedOption,
                      beforeGem: { ...processingGem },
                      optionGeneration: isManualOptionSampling ? 'manual' : 'auto',
                      selectionMethod: 'manual'
                    });
                    
                    // 가공 실행
                    const targetOption = selectedOption.action.endsWith('_change') ? selectedTargetOption?.optionKey : null;
                    const newGem = executeGemProcessing(processingGem, selectedOption.action, targetOption);
                    setProcessingGem(newGem);
                    setProcessingHistory([...processingHistory, newGem]);
                    setSelectedOptionIndex(null);
                    setSelectedHistoryIndex(newGem.processingCount);
                    
                    // _change 관련 상태 초기화
                    setShowChangeTargets(false);
                    setSelectedChangeOption(null);
                    setSelectedTargetOption(null);
                  }
                }}
                disabled={(() => {
                  const currentOptionSet = getCurrentOptionSet();
                  if (currentOptionSet.length === 0 || selectedOptionIndex === null) {
                    return true;
                  }
                  const selectedOption = currentOptionSet[selectedOptionIndex];
                  // _change 옵션인 경우 타겟이 선택되지 않았으면 비활성화
                  if (selectedOption.action.endsWith('_change') && !selectedTargetOption) {
                    return true;
                  }
                  return false;
                })()}
              >
                옵션 골라서 가공
              </button>
            </div>
          ) : (
            <div className="completion-message">
              가공이 완료되었습니다!
            </div>
          )}
        </div>
        
        {/* 가공 완료/리셋 */}
        <div className="processing-controls">
          <div className="control-buttons">
            <button
              className="btn btn-secondary"
              onClick={() => {
                // 현재 젬의 조합 추출 (dealerA, dealerB, supportA, supportB의 0/1 패턴)
                const currentCombination = [
                  processingGem.dealerA > 0 ? 1 : 0,
                  processingGem.dealerB > 0 ? 1 : 0, 
                  processingGem.supportA > 0 ? 1 : 0,
                  processingGem.supportB > 0 ? 1 : 0
                ];
                
                // 같은 조합으로 젬을 처음부터 다시 가공
                const resetGem = createProcessingGem(
                  processingGem.mainType, 
                  processingGem.subType, 
                  processingGem.grade, 
                  currentCombination
                );
                setProcessingGem(resetGem);
                setProcessingHistory([resetGem]);
                setSelectedOptionIndex(null);
                setLastProcessingResult(null);
                setSelectedHistoryIndex(0);
              }}
            >
              다시 가공
            </button>
            <button
              className="btn btn-reset"
              onClick={() => {
                setProcessingGem(null);
                setInitialProbabilities(null);
                setInitialGemStats(null);
                setProcessingHistory([]);
                setLastProcessingResult(null);
              }}
            >
              돌아가기
            </button>
          </div>
        </div>
      </div>
      
      {/* Right Column */}
      <div className="processing-right-column">
        {/* 서버 연결 상태 */}
        <div className="api-server-controls">
          <div className="server-status">
            <span 
              className="status-indicator"
              style={{ color: getServerStatusDisplay().color }}
            >
              {getServerStatusDisplay().icon} {getServerStatusDisplay().text}
            </span>
          </div>
          
          <button 
            onClick={handleRefreshConnection} 
            disabled={isLoadingData}
            className="refresh-connection-btn"
          >
            {isLoadingData ? '연결 중...' : '서버 연결 새로고침'}
          </button>
        </div>

        {/* 목표 확률 표시 - 백엔드 API 사용 */}
        {serverStatus === 'connected' && (
          <div className="target-probabilities-section">
          <div className="probability-header">
            <h4>목표 달성 확률</h4>
            <div className="gem-price-input">
              <label htmlFor="gemPrice">젬 가격:</label>
              <input 
                id="gemPrice"
                type="number" 
                value={gemPrice || ''}
                onChange={(e) => setGemPrice(e.target.value ? parseInt(e.target.value) : null)}
                placeholder="골드"
                min="0"
                max="500000"
                step="100"
              />
              <span>G</span>
            </div>
          </div>
          
          {/* 확률 비교 테이블 */}
          <div className="probability-table">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th className="target-column">목표</th>
                  <th className="option-column">현재 옵션 기반</th>
                  <th className="reroll-column">리롤 시{rerollData?.rerollDepth && ` (${rerollData.rerollDepth}회째)`}</th>
                  <th className="current-column">현재 젬 평균</th>
                  <th className="recommendation-column">추천</th>
                </tr>
              </thead>
              <tbody>
                {/* 목표별 확률 행들 */}
                {['5/5', '5/4', '4/5', '5/3', '4/4', '3/5', 'sum8+', 'sum9+', 'relic+', 'ancient+', 'dealer_complete', 'support_complete'].map((target) => {
                  // 현재 젬 상태 확률
                  const currentProb = currentData?.probabilities[target]?.percent || '0.0';
                  
                  // 미리 계산된 비교 정보 가져오기
                  const comparison = optionData?.[0]?.targetComparisons?.[target];
                  const optionProb = comparison ? comparison.avgOptionProb.toFixed(4) : '0.0';
                  const rerollProb = rerollData?.probabilities?.[target]?.percent || '0.0';
                  const isOptionBetter = comparison ? comparison.isOptionBetter : true;
                  const isRerollBetter = comparison ? comparison.isRerollBetter : false;
                  
                  // percentile 정보 찾기
                  let percentileText = '';
                  if (comparison && currentData?.percentiles?.[target]) {
                    const currentProbDecimal = comparison.avgOptionProb / 100;
                    const percentiles = currentData.percentiles[target];
                    
                    // 현재 확률이 어느 percentile에 해당하는지 찾기
                    let foundPercentile = 100;
                    for (let p = 90; p >= 10; p -= 10) {
                      if (percentiles[p] && currentProbDecimal >= percentiles[p]) {
                        foundPercentile = p;
                      } else {
                        break;
                      }
                    }
                    percentileText = ` 상위 ${foundPercentile}%`;
                  }
                  
                  return (
                    <tr key={target}>
                      <td className="target-name">
                        {getTargetDisplayLabel(target)}
                      </td>
                      <td className="prob-cell">
                        {isLoadingData ? (
                          <span className="prob-unavailable">로드 중...</span>
                        ) : optionData ? (
                          <div className="prob-content">
                            <div className="prob-main has-details">
                              <span className={`prob-value ${isOptionBetter ? 'better' : ''}`}>
                                {optionProb}%
                                {isOptionBetter && parseFloat(rerollProb) > 0 && <span className="better-indicator">↑</span>}
                              </span>
                              
                              {/* 호버 툴팁 - 각 옵션별 확률 및 비용 표시 */}
                              <div className="prob-tooltip">
                                <div className="tooltip-title">
                                  각 옵션 별 {currentData?.probabilities?.[target]?.label || target} 확률 및 이후 예상 비용
                                  {percentileText && (
                                    <div style={{ color: '#4CAF50', marginTop: '4px' }}>
                                      이 옵션 세트의 백분위: {percentileText}
                                    </div>
                                  )}
                                </div>
                                {optionData.map((option, idx) => {
                                  const optionTargetProb = option.resultProbabilities ? 
                                    option.resultProbabilities?.[target]?.percent || '0.0' : '0.0';
                                  const optionDesc = option.description || option.action;

                                  // Expected cost 가져오기 (option.expectedCosts가 있다면)
                                  const optionExpectedCost = option.resultExpectedCosts?.[target];
                                  const costDisplay = optionExpectedCost !== undefined ? 
                                    (optionExpectedCost === Infinity ? '∞' : `${Math.round(optionExpectedCost).toLocaleString()}G`) : 
                                    '-';
                                  
                                  return (
                                    <div key={idx} className="tooltip-option">
                                      <span className="tooltip-option-name">
                                        {(() => {
                                          let desc = optionDesc;
                                          desc = formatDescription(desc, processingGem);
                                          return desc;
                                        })()}
                                      </span>
                                      <span className="tooltip-option-prob">{optionTargetProb}%</span>
                                      <span className="tooltip-option-cost" style={{ marginLeft: '8px', color: '#756400ff' }}>
                                        ({costDisplay})
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="prob-unavailable">-</span>
                        )}
                      </td>
                      <td className="prob-cell">
                        {isLoadingData ? (
                          <span className="prob-unavailable">로드 중...</span>
                        ) : processingGem && processingGem.currentRerollAttempts > 0 && processingGem.processingCount > 0 ? (
                          rerollData ? (
                            <div className="prob-content">
                              <div className="prob-main has-details">
                                <span className={`prob-value ${isRerollBetter ? 'better' : ''}`}>
                                  {rerollProb}%
                                  {isRerollBetter && <span className="better-indicator">↑</span>}
                                </span>
                                
                                {/* 호버 툴팁 - 리롤 체인 확률 표시 */}
                                <div className="prob-tooltip">
                                  <div className="tooltip-title">
                                    리롤 횟수별 {currentData?.probabilities?.[target]?.label || target} 확률
                                  </div>
                                  {rerollsData.map((reroll, idx) => {
                                    const rerollTargetProb = reroll.probabilities?.[target]?.percent || '0.0';
                                    const isCurrentReroll = idx === currentRerollIndex;
                                    
                                    return (
                                      <div key={idx} className={`tooltip-option ${isCurrentReroll ? 'current-reroll' : ''}`}>
                                        <span className="tooltip-option-name">
                                          {reroll.rerollDepth}회째
                                        </span>
                                        <span className="tooltip-option-prob">
                                          {rerollTargetProb}%
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <span className="prob-unavailable">-</span>
                          )
                        ) : (
                          <span className="prob-unavailable">
                            {processingGem.processingCount === 0 ? "첫 가공" : "횟수 없음"}
                          </span>
                        )}
                      </td>
                      <td className="prob-cell">
                        {isLoadingData ? (
                          <span className="prob-unavailable">로드 중...</span>
                        ) : currentData ? (
                          <span className="prob-value">{currentProb}%</span>
                        ) : (
                          <span className="prob-unavailable">-</span>
                        )}
                      </td>
                      <td className="recommendation-cell">
                        {(() => {
                          if (isLoadingData) {
                            return <span className="prob-loading">로드 중...</span>;
                          }
                          
                          const recommendation = getProcessingRecommendation(target, isRerollBetter);
                          if (!recommendation) {
                            return <span className="prob-unavailable">젬 가격 입력</span>;
                          }
                          
                          return (
                            <div className="recommendation-content">
                              <div className={`recommendation-text ${
                                recommendation.recommendation === 'continue_processing' ? 'continue' : 
                                recommendation.recommendation === 'reroll_better' ? 'reroll' : 'buy-new'
                              }`}
                                   title={recommendation.currentExpectedCost !== undefined ? 
                                     `기대 이득: ${Math.round(recommendation.currentExpectedProfit).toLocaleString()}G vs 기대 비용: ${Math.round(recommendation.currentExpectedCost).toLocaleString()}G` : 
                                     ''}>
                                {recommendation.recommendation === 'continue_processing' ? 
                                  '가공' : 
                                  recommendation.recommendation === 'reroll_better' ?
                                  '리롤' :
                                  'GG'
                                }
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {serverStatus === 'error' && (
          <div className="no-server-message">
            <p>❌ API 서버에 연결할 수 없어 확률을 조회할 수 없습니다.</p>
            <p>서버를 시작하고 '서버 연결 새로고침'을 눌러주세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProcessingGemDisplay;