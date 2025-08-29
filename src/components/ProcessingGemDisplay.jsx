import './ProcessingGemDisplay.css';
import { executeGemProcessing, createProcessingGem, rerollProcessingOptions, getAllOptionsStatus, getProcessingHistory, getProcessingSteps } from '../utils/gemProcessing';
import { GEM_TYPES, GEM_EFFECTS } from '../utils/gemConstants';
import { 
  getGemProbabilities,
  getProcessingOptionProbabilities,
  formatProbabilities,
  checkServerHealth
} from '../utils/apiClient';
import { useState, useEffect } from 'react';

function ProcessingGemDisplay({
  processingGem,
  setProcessingGem,
  processingHistory,
  setProcessingHistory,
  lastProcessingResult,
  setLastProcessingResult,
  showNormalizedProbability,
  setShowNormalizedProbability
}) {
  const [serverStatus, setServerStatus] = useState('disconnected');
  const [currentProbabilities, setCurrentProbabilities] = useState(null);
  const [optionProbabilities, setOptionProbabilities] = useState(null);
  const [rerollOptionProbabilities, setRerollOptionProbabilities] = useState(null);
  const [isLoadingProbabilities, setIsLoadingProbabilities] = useState(false);
  const [isManualOptionSampling, setIsManualOptionSampling] = useState(false);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(null);
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState(null);

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

  // 젬 변경, 토글 상태, 옵션 세트 변경에 따른 확률 조회
  useEffect(() => {
    if (processingGem && serverStatus === 'connected') {
      // 수동 모드에서는 4개 옵션이 모두 선택된 경우에만 확률 조회
      if (isManualOptionSampling) {
        const manualSet = processingGem.manualOptionSet || [];
        if (manualSet.length === 4) {
          loadCurrentProbabilities();
          loadOptionProbabilities();
          loadRerollProbabilities();
        } else {
          // 4개 미만이면 확률 초기화
          setOptionProbabilities(null);
        }
      } else {
        // 자동 모드에서는 항상 확률 조회
        loadCurrentProbabilities();
        loadOptionProbabilities();
        loadRerollProbabilities();
      }
    } else {
      setCurrentProbabilities(null);
      setOptionProbabilities(null);
      setRerollOptionProbabilities(null);
    }
  }, [processingGem, serverStatus, isManualOptionSampling, processingGem?.manualOptionSet]);

  // 현재 젬 상태의 확률 조회
  const loadCurrentProbabilities = async () => {
    try {
      setIsLoadingProbabilities(true);
      const gemState = convertGemToState(processingGem);
      const probabilities = await getGemProbabilities(gemState);
      setCurrentProbabilities(formatProbabilities(probabilities));
    } catch (error) {
      console.error('현재 확률 조회 실패:', error);
      setCurrentProbabilities(null);
    } finally {
      setIsLoadingProbabilities(false);
    }
  };

  // 현재 옵션으로 가공했을 때의 확률 조회
  const loadOptionProbabilities = async () => {
    const currentOptions = getCurrentOptionSet();
    if (!currentOptions || currentOptions.length === 0) {
      setOptionProbabilities(null);
      return;
    }

    try {
      const gemState = convertGemToState(processingGem);
      const optionsWithProbabilities = await getProcessingOptionProbabilities(
        gemState,
        currentOptions
      );
      setOptionProbabilities(optionsWithProbabilities);
    } catch (error) {
      console.error('옵션 확률 조회 실패:', error);
      setOptionProbabilities(null);
    }
  };

  // 리롤 후 가공 확률 조회
  const loadRerollProbabilities = async () => {
    if (processingGem.currentRerollAttempts <= 0 || processingGem.processingCount === 0) {
      setRerollOptionProbabilities(null);
      return;
    }

    try {
      // 리롤된 젬 상태로 확률 조회
      const rerolledGem = { 
        ...processingGem, 
        currentRerollAttempts: processingGem.currentRerollAttempts - 1 
      };
      const gemState = convertGemToState(rerolledGem);
      
      // 리롤된 상태의 확률을 직접 조회
      const rerollProbabilities = await getGemProbabilities(gemState);
      setRerollOptionProbabilities(formatProbabilities(rerollProbabilities));
    } catch (error) {
      console.error('리롤 확률 조회 실패:', error);
      setRerollOptionProbabilities(null);
    }
  };

  // 젬 객체를 백엔드 상태 형식으로 변환
  const convertGemToState = (gem) => {
    return {
      willpower: gem.willpower,
      corePoint: gem.corePoint,
      dealerA: gem.dealerA || 0,
      dealerB: gem.dealerB || 0,
      supportA: gem.supportA || 0,
      supportB: gem.supportB || 0,
      remainingAttempts: gem.remainingAttempts,
      currentRerollAttempts: gem.currentRerollAttempts || 0,
      costModifier: gem.costModifier || 0,
      isFirstProcessing: gem.processingCount === 0
    };
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
    if (!gem.mainType || !gem.subType) {
      const defaultNames = {
        'dealerA': '첫번째 효과',
        'dealerB': '두번째 효과', 
        'supportA': '세번째 효과',
        'supportB': '네번째 효과'
      };
      return defaultNames[optionType] || optionType;
    }
    
    // gemConstants에서 실제 효과 이름 가져오기
    try {
      const effects = GEM_EFFECTS[gem.mainType][gem.subType];
      const index = {
        'dealerA': 0,
        'dealerB': 1, 
        'supportA': 2,
        'supportB': 3
      }[optionType];

      return effects[index] || optionType;
    } catch (error) {
      console.warn('GEM_EFFECTS를 가져올 수 없음:', error);
      const defaultNames = {
        'dealerA': '첫번째 효과',
        'dealerB': '두번째 효과', 
        'supportA': '세번째 효과',
        'supportB': '네번째 효과'
      };
      return defaultNames[optionType] || optionType;
    }
  };

  // 서버 연결 상태 새로고침
  const handleRefreshConnection = async () => {
    setIsLoadingProbabilities(true);
    
    try {
      await checkServerHealth();
      setServerStatus('connected');
      console.log('✅ API 서버 연결 새로고침 성공');
      
      if (processingGem) {
        await loadCurrentProbabilities();
        await loadOptionProbabilities();
        await loadRerollProbabilities();
      }
    } catch (error) {
      setServerStatus('error');
      console.error('❌ API 서버 연결 실패:', error);
    } finally {
      setIsLoadingProbabilities(false);
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
    const gradeNames = {
      LEGENDARY: '전설',
      RELIC: '유물',
      ANCIENT: '고대',
      UNCOMMON: '고급',
      RARE: '희귀',
      HEROIC: '영웅'
    };
    return gradeNames[grade] || grade;
  };

  const getGradeByPoints = (totalPoints) => {
    if (totalPoints >= 19) return '고대';
    if (totalPoints >= 16) return '유물';
    return '전설';
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
      'ancient+': '고대'
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
            disabled={isLoadingProbabilities}
            className="refresh-connection-btn"
          >
            {isLoadingProbabilities ? '연결 중...' : '서버 연결 새로고침'}
          </button>
        </div>

        {serverStatus === 'error' && (
          <div className="error-message">
            <p>❌ API 서버에 연결할 수 없습니다.</p>
            <p>서버가 실행 중인지 확인해주세요. (http://localhost:3001)</p>
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
              <label className="probability-checkbox">
                <input
                  type="checkbox"
                  checked={showNormalizedProbability}
                  onChange={(e) => setShowNormalizedProbability(e.target.checked)}
                />
                불가능 옵션 고려한 확률 표시
              </label>
            </div>
            {(() => {
              const allOptions = getAllOptionsStatus(processingGem);
              
              // 선택된 4개 옵션의 액션들 추출
              const selectedActions = new Set(getCurrentOptionSet().map(opt => opt.action));
              
              // 정규화된 확률 계산 (체크박스가 체크된 경우)
              let normalizedOptions = allOptions;
              if (showNormalizedProbability) {
                const availableOptions = allOptions.filter(opt => opt.isAvailable);
                const totalProbability = availableOptions.reduce((sum, opt) => sum + opt.probability, 0);
                
                normalizedOptions = allOptions.map(opt => ({
                  ...opt,
                  displayProbability: opt.isAvailable ? (opt.probability / totalProbability) : 0
                }));
              } else {
                normalizedOptions = allOptions.map(opt => ({
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
                    options: normalizedOptions.filter(opt => opt.action.startsWith('dealerA_'))
                  },
                  dealerB: {
                    title: getEffectName(processingGem, 'dealerB'), 
                    options: normalizedOptions.filter(opt => opt.action.startsWith('dealerB_'))
                  },
                  supportA: {
                    title: getEffectName(processingGem, 'supportA'),
                    options: normalizedOptions.filter(opt => opt.action.startsWith('supportA_'))
                  },
                  supportB: {
                    title: getEffectName(processingGem, 'supportB'), 
                    options: normalizedOptions.filter(opt => opt.action.startsWith('supportB_'))
                  }
                },
                // 둘째 행: 기본 스탯들 + 가공 결과
                {
                  willpower: {
                    title: '의지력 효율',
                    options: normalizedOptions.filter(opt => opt.action.startsWith('willpower_'))
                  },
                  corePoint: {
                    title: `${processingGem.mainType === 'ORDER' ? '질서' : '혼돈'} 포인트`, 
                    options: normalizedOptions.filter(opt => opt.action.startsWith('corePoint_'))
                  },
                  etc: {
                    title: '기타',
                    options: normalizedOptions.filter(opt => 
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
                                {processingGem && processingGem.processingCount > 0 && (
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

                                    if (selectedHistory && selectedHistory.processedWith) {
                                      return (
                                        <div>
                                          <div className="processing-result-card-compact">
                                            <div className="result-badges">
                                              <span className="result-badge history-step">
                                                {selectedHistoryIndex}회차
                                              </span>
                                            </div>
                                            <div className="result-option-compact">
                                              {formatDescription(selectedHistory.processedWith.description, processingGem)}
                                            </div>
                                          </div>
                                          {selectedHistoryIndex !== history.length - 1 && (
                                            <button 
                                              className="btn-secondary restore-btn"
                                              onClick={handleRestore}
                                            >
                                              🔄 이 상태로 되돌리기
                                            </button>
                                          )}
                                        </div>
                                      );
                                    } else {
                                      return (
                                        <div>
                                          <div className="processing-result-card-compact">
                                            <div className="result-badges">
                                              <span className="result-badge history-step">초기 상태</span>
                                            </div>
                                            <div className="result-option-compact">
                                              가공 시작 전
                                            </div>
                                          </div>
                                          {selectedHistoryIndex !== history.length - 1 && (
                                            <button 
                                              className="btn-secondary restore-btn"
                                              onClick={handleRestore}
                                            >
                                              🔄 이 상태로 되돌리기
                                            </button>
                                          )}
                                        </div>
                                      );
                                    }
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
                  const result = rerollProcessingOptions(processingGem);
                  if (result) {
                    setProcessingGem(result);
                    setSelectedOptionIndex(null);
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
                    setSelectedOptionIndex(selectedOptionIndex === index ? null : index);
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
                    const newGem = executeGemProcessing(processingGem, selectedOption.action);
                    setProcessingGem(newGem);
                    setProcessingHistory([...processingHistory, newGem]);
                    setSelectedOptionIndex(null);
                    setSelectedHistoryIndex(newGem.processingCount);
                  }
                }}
                disabled={getCurrentOptionSet().length === 0 || selectedOptionIndex === null}
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
                // 같은 젬을 처음부터 다시 가공
                const resetGem = createProcessingGem(processingGem.mainType, processingGem.subType, processingGem.grade);
                setProcessingGem(resetGem);
                setProcessingHistory([resetGem]);
                setLastProcessingResult(null);
              }}
            >
              다시 가공
            </button>
            <button
              className="btn btn-reset"
              onClick={() => {
                setProcessingGem(null);
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
            disabled={isLoadingProbabilities}
            className="refresh-connection-btn"
          >
            {isLoadingProbabilities ? '연결 중...' : '서버 연결 새로고침'}
          </button>
        </div>

        {/* 목표 확률 표시 - 백엔드 API 사용 */}
        {serverStatus === 'connected' && (
          <div className="target-probabilities-section">
          <div className="probability-header">
            <h4>목표 달성 확률 비교 (백엔드 API)</h4>
          </div>
          
          {/* 확률 비교 테이블 */}
          <div className="probability-table">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th className="target-column">목표</th>
                  <th className="option-column">현재 옵션 기반</th>
                  <th className="reroll-column">리롤 시</th>
                  <th className="current-column">현재 젬 평균</th>
                </tr>
              </thead>
              <tbody>
                {/* 목표별 확률 행들 */}
                {['5/5', '5/4', '4/5', '5/3', '4/4', '3/5', 'sum8+', 'sum9+', 'relic+', 'ancient+'].map((target) => {
                  // 현재 젬 상태 확률
                  const currentProb = currentProbabilities?.[target]?.percent || '0.0';
                  
                  // 현재 옵션으로 가공 확률 (4개 옵션의 평균)
                  let optionProb = '0.0';
                  if (optionProbabilities && optionProbabilities.length > 0) {
                    const validProbs = optionProbabilities
                      .map(opt => opt.futureProbabilities ? formatProbabilities(opt.futureProbabilities)?.[target]?.percent || '0.0' : '0.0')
                      .map(p => parseFloat(p))
                      .filter(p => !isNaN(p));
                    
                    if (validProbs.length > 0) {
                      const avgProb = validProbs.reduce((sum, p) => sum + p, 0) / validProbs.length;
                      optionProb = avgProb.toFixed(4);
                    }
                  }
                  
                  // 리롤 후 가공 확률
                  let rerollProb = '0.0';
                  if (rerollOptionProbabilities && rerollOptionProbabilities[target]) {
                    rerollProb = rerollOptionProbabilities[target].percent;
                  }
                  
                  // 최고 확률 찾기 (하이라이트용)
                  const probs = [parseFloat(optionProb), parseFloat(rerollProb)];
                  const maxProb = Math.max(...probs);
                  const isGoodTarget = ['sum8+', 'sum9+', 'relic+', 'ancient+'].includes(target);
                  
                  return (
                    <tr key={target} className={isGoodTarget ? 'good-target' : ''}>
                      <td className="target-name">
                        {getTargetDisplayLabel(target)}
                      </td>
                      <td className={`prob-cell ${parseFloat(optionProb) === maxProb && maxProb > 0 ? 'highest' : ''}`}>
                        {optionProbabilities ? (
                          <div className="prob-content">
                            <div className="prob-main has-details">
                              <span className={`prob-value ${parseFloat(optionProb) === maxProb && maxProb > 0 ? 'better' : ''}`}>
                                {optionProb}%
                                {parseFloat(optionProb) === maxProb && maxProb > 0 && parseFloat(rerollProb) > 0 && <span className="better-indicator">↑</span>}
                              </span>
                              
                              {/* 호버 툴팁 - 각 옵션별 확률 표시 */}
                              <div className="prob-tooltip">
                                <div className="tooltip-title">각 옵션별 {currentProbabilities?.[target]?.label || target} 확률</div>
                                {optionProbabilities.map((option, idx) => {
                                  const optionTargetProb = option.futureProbabilities ? 
                                    formatProbabilities(option.futureProbabilities)?.[target]?.percent || '0.0' : '0.0';
                                  const optionDesc = option.description || option.action;
                                  
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
                      <td className={`prob-cell ${parseFloat(rerollProb) === maxProb && maxProb > 0 ? 'highest' : ''}`}>
                        {processingGem && processingGem.currentRerollAttempts > 0 && processingGem.processingCount > 0 ? (
                          rerollOptionProbabilities ? (
                            <span className={`prob-value ${parseFloat(rerollProb) === maxProb && maxProb > 0 ? 'better' : ''}`}>
                              {rerollProb}%
                              {parseFloat(rerollProb) === maxProb && maxProb > 0 && parseFloat(optionProb) > 0 && <span className="better-indicator">↑</span>}
                            </span>
                          ) : (
                            <span className="prob-unavailable">-</span>
                          )
                        ) : (
                          <span className="prob-unavailable">
                            {processingGem.processingCount === 0 ? "첫 가공" : "횟수 없음"}
                          </span>
                        )}
                      </td>
                      <td className={`prob-cell ${parseFloat(currentProb) === maxProb && maxProb > 0 ? 'highest' : ''}`}>
                        {isLoadingProbabilities ? (
                          <span className="prob-unavailable">계산 중...</span>
                        ) : currentProbabilities ? (
                          <span className="prob-value">{currentProb}%</span>
                        ) : (
                          <span className="prob-unavailable">-</span>
                        )}
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