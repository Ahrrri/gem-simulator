import './ProcessingGemDisplay.css';
import { executeGemProcessing, createProcessingGem, rerollProcessingOptions, getAllOptionsStatus } from '../utils/gemProcessing';
import { GEM_TYPES, GEM_EFFECTS } from '../utils/gemConstants';
import { 
  getGemProbabilities,
  getProcessingOptionProbabilities,
  formatProbabilities,
  checkServerHealth,
  getDatabaseStats
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
  const [isManualMode, setIsManualMode] = useState(false);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(null);
  const [isManualProcessing, setIsManualProcessing] = useState(false);

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

  // 젬이 변경될 때마다 백엔드에서 확률 조회
  useEffect(() => {
    if (processingGem && serverStatus === 'connected') {
      loadCurrentProbabilities();
      loadOptionProbabilities();
      loadRerollProbabilities();
    } else {
      setCurrentProbabilities(null);
      setOptionProbabilities(null);
      setRerollOptionProbabilities(null);
    }
  }, [processingGem, serverStatus]);

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
    if (!processingGem.currentOptions || processingGem.currentOptions.length === 0) {
      setOptionProbabilities(null);
      return;
    }

    try {
      const gemState = convertGemToState(processingGem);
      const optionsWithProbabilities = await getProcessingOptionProbabilities(
        gemState,
        processingGem.currentOptions
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

  // 서버 통계 정보 조회
  const handleViewStats = async () => {
    try {
      const stats = await getDatabaseStats();
      alert(`데이터베이스 통계:\\n총 상태: ${stats.total_states.toLocaleString()}개\\nSum8+ 평균: ${(stats.avg_sum8 * 100).toFixed(1)}%\\nAncient+ 평균: ${(stats.avg_ancient * 100).toFixed(1)}%\\nAncient+ 최고: ${(stats.max_ancient * 100).toFixed(1)}%`);
    } catch (error) {
      alert(`통계 조회 실패: ${error.message}`);
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
          
          <button 
            onClick={handleViewStats}
            disabled={serverStatus !== 'connected'}
            className="view-stats-btn"
          >
            데이터베이스 통계 보기
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
        
        <button 
          onClick={handleViewStats}
          disabled={serverStatus !== 'connected'}
          className="view-stats-btn"
        >
          데이터베이스 통계 보기
        </button>
      </div>

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
                  <span>남은 가공 횟수: {processingGem.remainingAttempts}</span>
                </div>
                <div className="info-row">
                  <span>총 포인트: {processingGem.totalPoints}</span>
                </div>
                <div className="info-row">
                  <span>가공 진행: {processingGem.processingCount}회</span>
                </div>
                <div className="info-row">
                  <span>다른 항목 보기: {processingGem.currentRerollAttempts}/{processingGem.maxRerollAttempts}</span>
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
              const selectedActions = new Set((processingGem.currentOptions || []).map(opt => opt.action));
              
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
              
              // 카테고리별로 옵션 분류
              const categories = {
                willpower: {
                  title: '의지력 효율',
                  options: normalizedOptions.filter(opt => opt.action.startsWith('willpower_'))
                },
                corePoint: {
                  title: '질서/혼돈 포인트', 
                  options: normalizedOptions.filter(opt => opt.action.startsWith('corePoint_'))
                },
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
                },
                etc: {
                  title: '기타',
                  options: normalizedOptions.filter(opt => 
                    opt.action.startsWith('cost_') || 
                    opt.action.startsWith('reroll_') || 
                    opt.action === 'maintain'
                  )
                }
              };
              
              return (
                <div className="compact-options-grid">
                  {Object.values(categories).map((category, categoryIndex) => (
                    <div key={categoryIndex} className="option-category">
                      <div className="category-title">{category.title}</div>
                      <div className="category-options">
                        {category.options.map((option, index) => {
                          const isSelected = selectedActions.has(option.action);
                          return (
                            <div 
                              key={index} 
                              className={`compact-option ${option.isAvailable ? 'available' : 'disabled'} ${isSelected ? 'selected' : ''}`}
                            >
                              <div className="compact-option-name">
                                {(() => {
                                  let desc = option.description;

                                  // 실제 효과 이름으로 교체
                                  desc = desc.replace(/딜러A 옵션/g, getEffectName(processingGem, 'dealerA'));
                                  desc = desc.replace(/딜러B 옵션/g, getEffectName(processingGem, 'dealerB'));
                                  desc = desc.replace(/서폿A 옵션/g, getEffectName(processingGem, 'supportA'));
                                  desc = desc.replace(/서폿B 옵션/g, getEffectName(processingGem, 'supportB'));
                                  return desc.replace(/Lv\.|증가|감소|포인트|상태|보기/g, '').trim();
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
                  ))}
                </div>
              );
            })()} 
          </div>
          
          {/* 최근 가공 결과 */}
          {lastProcessingResult && (
            <div className="processing-result-section">
              <h4>✨ 최근 가공 결과</h4>
              <div className="processing-result-card">
                <div className="result-option">
                  <span className="result-label">선택된 옵션:</span>
                  <span className="result-value">
                    {(() => {
                      let desc = lastProcessingResult.option.description;
                      // 실제 효과 이름으로 교체
                      desc = desc.replace(/딜러A 옵션/g, getEffectName(processingGem, 'dealerA'));
                      desc = desc.replace(/딜러B 옵션/g, getEffectName(processingGem, 'dealerB'));
                      desc = desc.replace(/서폿A 옵션/g, getEffectName(processingGem, 'supportA'));
                      desc = desc.replace(/서폿B 옵션/g, getEffectName(processingGem, 'supportB'));
                      return desc;
                    })()}
                  </span>
                </div>
              </div>
            </div>
          )}
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
                  checked={isManualMode}
                  onChange={(e) => {
                    setIsManualMode(e.target.checked);
                    setSelectedOptionIndex(null);
                  }}
                />
                수동 옵션 선택
              </label>
            </div>
            
            {/* 다른 항목 보기 버튼 */}
            <button
              className="reroll-btn"
              disabled={processingGem.processingCount === 0 || processingGem.currentRerollAttempts === 0 || processingGem.remainingAttempts === 0}
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
          {(processingGem.currentOptions || []).length > 0 && processingGem.remainingAttempts > 0 ? (
            (processingGem.currentOptions || []).map((option, index) => (
              <div
                key={index}
                className={`option-display ${isManualMode ? 'clickable' : ''} ${isManualMode && selectedOptionIndex === index ? 'selected' : ''}`}
                onClick={() => {
                  if (isManualMode) {
                    setSelectedOptionIndex(selectedOptionIndex === index ? null : index);
                  }
                }}
              >
                {isManualMode && selectedOptionIndex === index && (
                  <div className="option-selector">✓</div>
                )}
                <div className="option-description">
                  {(() => {
                    let desc = option.description;
                    // 실제 효과 이름으로 교체
                    desc = desc.replace(/딜러A 옵션/g, getEffectName(processingGem, 'dealerA'));
                    desc = desc.replace(/딜러B 옵션/g, getEffectName(processingGem, 'dealerB'));
                    desc = desc.replace(/서폿A 옵션/g, getEffectName(processingGem, 'supportA'));
                    desc = desc.replace(/서폿B 옵션/g, getEffectName(processingGem, 'supportB'));
                    return desc;
                  })()}
                </div>
              </div>
            ))
          ) : (
            <div className="no-options-message">
              가공 완료
            </div>
          )}
        </div>
      </div>
      
      {/* 목표 확률 표시 - 백엔드 API 사용 */}
      {serverStatus === 'connected' && (
        <div className="target-probabilities-section">
          <div className="probability-header">
            <h4>🎯 목표 달성 확률 비교 (백엔드 API)</h4>
          </div>
          
          {/* 확률 비교 테이블 */}
          <div className="probability-table">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th className="target-column">목표</th>
                  <th className="option-column">🔨 현재 옵션으로 가공</th>
                  <th className="reroll-column">🔄 다른 항목 보기 후 가공</th>
                  <th className="current-column">💎 현재 젬 상태</th>
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
                  const probs = [parseFloat(currentProb), parseFloat(optionProb), parseFloat(rerollProb)];
                  const maxProb = Math.max(...probs);
                  const isGoodTarget = ['sum8+', 'sum9+', 'relic+', 'ancient+'].includes(target);
                  
                  return (
                    <tr key={target} className={isGoodTarget ? 'good-target' : ''}>
                      <td className="target-name">
                        {currentProbabilities?.[target]?.label || target}
                      </td>
                      <td className={`prob-cell ${parseFloat(optionProb) === maxProb && maxProb > 0 ? 'highest' : ''}`}>
                        {optionProbabilities ? (
                          <div className="prob-content">
                            <div className="prob-main has-details">
                              <span className={`prob-value ${parseFloat(optionProb) > parseFloat(currentProb) ? 'better' : ''}`}>
                                {optionProb}%
                                {parseFloat(optionProb) > parseFloat(currentProb) && <span className="better-indicator">↑</span>}
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
                                          desc = desc.replace(/딜러A 옵션/g, getEffectName(processingGem, 'dealerA'));
                                          desc = desc.replace(/딜러B 옵션/g, getEffectName(processingGem, 'dealerB'));
                                          desc = desc.replace(/서폿A 옵션/g, getEffectName(processingGem, 'supportA'));
                                          desc = desc.replace(/서폿B 옵션/g, getEffectName(processingGem, 'supportB'));
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
                            <span className={`prob-value ${parseFloat(rerollProb) > parseFloat(currentProb) ? 'better' : ''}`}>
                              {rerollProb}%
                              {parseFloat(rerollProb) > parseFloat(currentProb) && <span className="better-indicator">↑</span>}
                            </span>
                          ) : (
                            <span className="prob-unavailable">-</span>
                          )
                        ) : (
                          <span className="prob-unavailable">
                            {processingGem.processingCount === 0 ? "첫 가공에는 불가" : "횟수 없음"}
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
            
            <div className="table-status">
              {isLoadingProbabilities && (
                <span className="calculating">🔄 확률 조회 중...</span>
              )}
              {!isLoadingProbabilities && currentProbabilities && (
                <span className="completed">✅ 확률 조회 완료</span>
              )}
            </div>
          </div>
        </div>
      )}

      {serverStatus === 'error' && (
        <div className="no-server-message">
          <p>❌ API 서버에 연결할 수 없어 확률을 조회할 수 없습니다.</p>
          <p>서버를 시작하고 '서버 연결 새로고침'을 눌러주세요.</p>
        </div>
      )}
      
      {/* 가공하기 버튼 / 완료 메시지 */}
      <div className="processing-action">
        {processingGem.remainingAttempts > 0 ? (
          <div className="processing-buttons">
            {/* 수동 모드에서는 선택 힌트 표시 */}
            {isManualMode && selectedOptionIndex === null && (
              <div className="selection-hint">옵션을 선택해주세요</div>
            )}
            
            {/* 수동/자동 가공 토글 */}
            <div className="manual-mode-toggle">
              <label>
                <input
                  type="checkbox"
                  checked={isManualProcessing}
                  onChange={(e) => setIsManualProcessing(e.target.checked)}
                />
                수동 가공
              </label>
            </div>
            
            <button
              className="btn btn-primary processing-btn"
              onClick={() => {
                if ((processingGem.currentOptions || []).length > 0) {
                  let selectedOption;
                  let selectedAction;
                  
                  if (isManualMode && selectedOptionIndex !== null) {
                    // 수동 모드: 선택된 옵션 사용
                    selectedOption = processingGem.currentOptions[selectedOptionIndex];
                    selectedAction = selectedOption.action;
                  } else if (!isManualMode) {
                    // 자동 모드: 랜덤 선택
                    const randomIndex = Math.floor(Math.random() * processingGem.currentOptions.length);
                    selectedOption = processingGem.currentOptions[randomIndex];
                    selectedAction = selectedOption.action;
                  } else {
                    // 수동 모드인데 선택되지 않음
                    return;
                  }
                  
                  // 선택된 옵션 정보 저장
                  setLastProcessingResult({
                    option: selectedOption,
                    beforeGem: { ...processingGem }
                  });
                  
                  if (isManualProcessing) {
                    // 수동 가공: 한 단계씩 진행
                    const newGem = executeGemProcessing(processingGem, selectedAction);
                    setProcessingGem(newGem);
                    setProcessingHistory([...processingHistory, newGem]);
                    setSelectedOptionIndex(null);
                  } else {
                    // 자동 가공: 끝까지 진행
                    let currentGem = { ...processingGem };
                    const newHistory = [...processingHistory];
                    
                    while (currentGem.remainingAttempts > 0 && (currentGem.currentOptions || []).length > 0) {
                      const randomIndex = Math.floor(Math.random() * currentGem.currentOptions.length);
                      const option = currentGem.currentOptions[randomIndex];
                      currentGem = executeGemProcessing(currentGem, option.action);
                      newHistory.push({ ...currentGem });
                    }
                    
                    setProcessingGem(currentGem);
                    setProcessingHistory(newHistory);
                    setSelectedOptionIndex(null);
                  }
                }
              }}
              disabled={(processingGem.currentOptions || []).length === 0 || (isManualMode && selectedOptionIndex === null)}
            >
              {isManualProcessing ? (isManualMode ? '⚒️ 선택된 옵션으로 가공' : '⚒️ 한 단계 가공') : (isManualMode ? '🚀 선택된 옵션으로 완료' : '🚀 자동 가공 완료')}
            </button>
          </div>
        ) : (
          <div className="completion-message">
            ✨ 가공이 완료되었습니다!
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
            🔄 다시 가공
          </button>
          <button
            className="btn btn-reset"
            onClick={() => {
              setProcessingGem(null);
              setProcessingHistory([]);
              setLastProcessingResult(null);
            }}
          >
            🆕 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProcessingGemDisplay;