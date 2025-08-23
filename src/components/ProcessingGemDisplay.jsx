import './ProcessingGemDisplay.css';
import { executeGemProcessing, createProcessingGem, rerollProcessingOptions, getAllOptionsStatus } from '../utils/gemProcessing';
import { GEM_TYPES } from '../utils/gemFusion';

function ProcessingGemDisplay({
  processingGem,
  setProcessingGem,
  processingHistory,
  setProcessingHistory,
  lastProcessingResult,
  setLastProcessingResult,
  showNormalizedProbability,
  setShowNormalizedProbability,
  targetProbabilities,
  rerollProbabilities,
  isCalculatingProbabilities,
  isCalculatingRerollProbabilities,
  manualRerollThreshold,
  setManualRerollThreshold
}) {
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

  // 특정 목표 리스트 (의지력 + 코어포인트 >= 8)
  const targetGoals = ['5/5', '5/4', '4/5', '5/3', '4/4', '3/5'];
  
  // 합 기준 목표
  const sumTargets = [
    { key: 'sum9+', label: '합 9+', minSum: 9 },
    { key: 'sum8+', label: '합 8+', minSum: 8 }
  ];
  
  // 특정 목표 이상의 누적 확률 계산
  const calculateCumulativeProbabilities = (probabilities) => {
    const cumulativeProbs = {};
    
    targetGoals.forEach(target => {
      const [targetW, targetC] = target.split('/').map(Number);
      
      let cumulativeProb = 0;
      targetGoals.forEach(otherTarget => {
        const [otherW, otherC] = otherTarget.split('/').map(Number);
        
        // 의지력과 코어포인트가 모두 목표 이상인 조합의 확률 합산
        if (otherW >= targetW && otherC >= targetC) {
          cumulativeProb += probabilities[otherTarget] || 0;
        }
      });
      
      cumulativeProbs[target] = cumulativeProb;
    });
    
    return cumulativeProbs;
  };

  return (
    <div className="processing-gem-section">
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
                <div className="stat-row">
                  <span>{processingGem.effect1.name}:</span>
                  <span className={processingGem.effect1.level === 5 ? 'max' : ''}>
                    Lv.{processingGem.effect1.level}
                  </span>
                </div>
                <div className="stat-row">
                  <span>{processingGem.effect2.name}:</span>
                  <span className={processingGem.effect2.level === 5 ? 'max' : ''}>
                    Lv.{processingGem.effect2.level}
                  </span>
                </div>
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
                effect1: {
                  title: processingGem.effect1?.name || '첫번째 효과',
                  options: normalizedOptions.filter(opt => opt.action.startsWith('effect1_'))
                },
                effect2: {
                  title: processingGem.effect2?.name || '두번째 효과', 
                  options: normalizedOptions.filter(opt => opt.action.startsWith('effect2_'))
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
                                  if (processingGem.effect1?.name) {
                                    desc = desc.replace(/첫번째 효과/g, processingGem.effect1.name);
                                  }
                                  if (processingGem.effect2?.name) {
                                    desc = desc.replace(/두번째 효과/g, processingGem.effect2.name);
                                  }
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
                      if (processingGem.effect1?.name) {
                        desc = desc.replace(/첫번째 효과/g, processingGem.effect1.name);
                      }
                      if (processingGem.effect2?.name) {
                        desc = desc.replace(/두번째 효과/g, processingGem.effect2.name);
                      }
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
          {/* 다른 항목 보기 버튼 */}
          <button
            className="reroll-btn"
            disabled={processingGem.processingCount === 0 || processingGem.currentRerollAttempts === 0 || processingGem.remainingAttempts === 0}
            onClick={() => {
              const result = rerollProcessingOptions(processingGem);
              if (result) {
                setProcessingGem(result);
              }
            }}
          >
            🔄 다른 항목 보기 ({processingGem.currentRerollAttempts}회)
          </button>
        </div>
        <div className="options-display">
          {(processingGem.currentOptions || []).length > 0 && processingGem.remainingAttempts > 0 ? (
            (processingGem.currentOptions || []).map((option, index) => (
              <div
                key={index}
                className="option-display"
              >
                <div className="option-description">
                  {(() => {
                    let desc = option.description;
                    // 실제 효과 이름으로 교체
                    if (processingGem.effect1?.name) {
                      desc = desc.replace(/첫번째 효과/g, processingGem.effect1.name);
                    }
                    if (processingGem.effect2?.name) {
                      desc = desc.replace(/두번째 효과/g, processingGem.effect2.name);
                    }
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
      
      {/* 목표 확률 표시 */}
      <div className="target-probabilities-section">
        <div className="probability-header">
          <h4>🎯 목표 달성 확률 비교</h4>
          <div className="threshold-control">
            <label>
              리롤 임계값:
              <input
                type="number"
                value={manualRerollThreshold}
                onChange={(e) => setManualRerollThreshold(Number(e.target.value))}
                min="-1"
                max="4"
                step="0.25"
                style={{ width: '60px', marginLeft: '5px' }}
              />
            </label>
            <span className="threshold-hint">
              (평균 값 ≤ {manualRerollThreshold}일 때 리롤)
            </span>
          </div>
        </div>
        
        <div className="probability-comparison">
          {/* 현재 옵션으로 가공 */}
          <div className="probability-option">
            <h5>🔨 현재 옵션으로 가공</h5>
            {targetProbabilities ? (
              <div className="probability-grid">
                {(() => {
                  const cumulativeProbs = calculateCumulativeProbabilities(targetProbabilities.probabilities);
                  
                  const targetElements = targetGoals.map(target => {
                    const [w, c] = target.split('/').map(Number);
                    const cumulativeProb = cumulativeProbs[target] || 0;
                    const isGood = w + c >= 8;
                    
                    return (
                      <div 
                        key={target} 
                        className={`probability-target small ${isGood ? 'good' : ''}`}
                      >
                        <div className="target-label">{target}+</div>
                        <div className="target-probability">
                          {(cumulativeProb * 100).toFixed(2)}%
                        </div>
                      </div>
                    );
                  });
                  
                  const sumElements = sumTargets.map(sumTarget => {
                    const prob = targetProbabilities.probabilities[sumTarget.key] || 0;
                    
                    return (
                      <div 
                        key={sumTarget.key} 
                        className="probability-target small sum-target"
                      >
                        <div className="target-label">{sumTarget.label}</div>
                        <div className="target-probability">
                          {(prob * 100).toFixed(2)}%
                        </div>
                      </div>
                    );
                  });
                  
                  return [...targetElements, ...sumElements];
                })()}
                <div className="probability-status">
                  {isCalculatingProbabilities ? (
                    <span className="calculating">
                      계산 중... ({targetProbabilities.completedSimulations}/{targetProbabilities.totalSimulations})
                    </span>
                  ) : (
                    <span className="completed">
                      완료 ({targetProbabilities.completedSimulations}회)
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="no-probabilities">
                계산할 수 없습니다.
              </div>
            )}
          </div>

          {/* 다른 항목 보기 후 가공 */}
          <div className="probability-option">
            <h5>🔄 다른 항목 보기 후 가공</h5>
            {processingGem && processingGem.currentRerollAttempts > 0 ? (
              rerollProbabilities ? (
                <div className="probability-grid">
                  {(() => {
                    const cumulativeProbs = calculateCumulativeProbabilities(rerollProbabilities.probabilities);
                    
                    const targetElements = targetGoals.map(target => {
                      const [w, c] = target.split('/').map(Number);
                      const cumulativeProb = cumulativeProbs[target] || 0;
                      const currentProb = targetProbabilities ? calculateCumulativeProbabilities(targetProbabilities.probabilities)[target] || 0 : 0;
                      const isGood = w + c >= 8;
                      const isBetter = cumulativeProb > currentProb;
                      
                      return (
                        <div 
                          key={target} 
                          className={`probability-target small ${isGood ? 'good' : ''} ${isBetter ? 'better' : ''}`}
                        >
                          <div className="target-label">{target}+</div>
                          <div className="target-probability">
                            {(cumulativeProb * 100).toFixed(2)}%
                            {isBetter && <span className="better-indicator">↑</span>}
                          </div>
                        </div>
                      );
                    });
                    
                    const sumElements = sumTargets.map(sumTarget => {
                      const prob = rerollProbabilities.probabilities[sumTarget.key] || 0;
                      const currentProb = targetProbabilities ? targetProbabilities.probabilities[sumTarget.key] || 0 : 0;
                      const isBetter = prob > currentProb;
                      
                      return (
                        <div 
                          key={sumTarget.key} 
                          className={`probability-target small sum-target ${isBetter ? 'better' : ''}`}
                        >
                          <div className="target-label">{sumTarget.label}</div>
                          <div className="target-probability">
                            {(prob * 100).toFixed(2)}%
                            {isBetter && <span className="better-indicator">↑</span>}
                          </div>
                        </div>
                      );
                    });
                    
                    return [...targetElements, ...sumElements];
                  })()}
                  <div className="probability-status">
                    {isCalculatingRerollProbabilities ? (
                      <span className="calculating">
                        계산 중... ({rerollProbabilities.completedSimulations}/{rerollProbabilities.totalSimulations})
                      </span>
                    ) : (
                      <span className="completed">
                        완료 ({rerollProbabilities.completedSimulations}회)
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="no-probabilities">
                  첫 가공에는 다른 항목 보기가 불가능합니다.
                </div>
              )
            ) : (
              <div className="no-probabilities">
                다른 항목 보기 횟수가 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* 가공하기 버튼 / 완료 메시지 */}
      <div className="processing-action">
        {processingGem.remainingAttempts > 0 ? (
          <button
            className="btn btn-primary processing-btn"
            onClick={() => {
              if ((processingGem.currentOptions || []).length > 0) {
                // 4개 옵션 중 랜덤 선택 (25% 확률)
                const randomIndex = Math.floor(Math.random() * processingGem.currentOptions.length);
                const selectedOption = processingGem.currentOptions[randomIndex];
                const selectedAction = selectedOption.action;
                
                // 선택된 옵션 정보 저장
                setLastProcessingResult({
                  option: selectedOption,
                  beforeGem: { ...processingGem }
                });
                
                const newGem = executeGemProcessing(processingGem, selectedAction);
                setProcessingGem(newGem);
                setProcessingHistory([...processingHistory, newGem]);
              }
            }}
            disabled={(processingGem.currentOptions || []).length === 0}
          >
            ⚒️ 가공하기
          </button>
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