import { useState } from 'react';
import './ProcessingGemDisplay.css';
import { executeGemProcessing, createProcessingGem, rerollProcessingOptions, getAllOptionsStatus, calculateExactProbabilities } from '../utils/gemProcessing';
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
  setManualRerollThreshold,
  selectedOptions,
  setSelectedOptions,
  calculateProbabilities,
  calculationProgress,
  calculationStates,
  isTableLoading,
  isTableLoaded,
  tableLoadError,
  loadProbabilityTable
}) {
  // 수동 모드 상태 관리
  const [isManualMode, setIsManualMode] = useState(false);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(null);
  const [isManualOptionGeneration, setIsManualOptionGeneration] = useState(false); // 수동 옵션 생성 모드

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
    { key: 'sum8+', label: '합 8+', minSum: 8 },
    { key: 'relic+', label: '유물+', minSum: 16 },
    { key: 'ancient+', label: '고대+', minSum: 19 }
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

  // 각 옵션별 확률 표시 (계산된 확률이 있으면 표시, 없으면 UI만 제공)
  const getIndividualOptionDisplay = (target, isSum) => {
    let optionsToUse = [];
    
    if (isManualOptionGeneration && selectedOptions.length === 4) {
      // 수동 옵션 4개가 선택된 경우
      optionsToUse = selectedOptions;
    } else if (!isManualOptionGeneration && processingGem.currentOptions && processingGem.currentOptions.length > 0) {
      // 자동 옵션 생성인 경우
      optionsToUse = processingGem.currentOptions;
    }
    
    if (optionsToUse.length === 0) return [];
    
    return optionsToUse.map((option, idx) => {
      let calculatedProbability = null;
      
      // 확률이 이미 계산되어 있는 경우에만 개별 확률을 계산
      if (targetProbabilities?.exactProbabilities?.withCurrentOptions) {
        try {
          const nextGem = executeGemProcessing({ ...processingGem }, option.action);
          const optionProb = calculateExactProbabilities(nextGem);
          
          if (isSum) {
            calculatedProbability = optionProb.current[target] || 0;
          } else {
            const cumulativeProbs = calculateCumulativeProbabilities(optionProb.current);
            calculatedProbability = cumulativeProbs[target] || 0;
          }
        } catch (error) {
          console.warn('Error calculating option probability:', error);
          calculatedProbability = 0;
        }
      }
      
      return {
        index: idx,
        probability: calculatedProbability,
        description: option.description,
        hasCalculatedProb: calculatedProbability !== null
      };
    });
  };

  // 유효 숫자 4자리로 확률을 포맷하는 함수
  const formatProbability = (probability) => {
    if (probability === 0) return '0.000%';
    
    const percentage = probability * 100;
    
    // 유효 숫자 4자리로 변환
    const significantDigits = 4;
    const order = Math.floor(Math.log10(percentage));
    const factor = Math.pow(10, significantDigits - 1 - order);
    const rounded = Math.round(percentage * factor) / factor;
    
    // 소숫점 자릿수 결정
    if (rounded >= 100) {
      return rounded.toFixed(1) + '%';
    } else if (rounded >= 10) {
      return rounded.toFixed(2) + '%';
    } else if (rounded >= 1) {
      return rounded.toFixed(3) + '%';
    } else {
      return rounded.toFixed(4) + '%';
    }
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
              <h4>⚙️ 가공 옵션 상태 {isManualOptionGeneration && `(${selectedOptions.length}/4 선택됨)`}</h4>
              <div className="header-controls">
                <label className="probability-checkbox">
                  <input
                    type="checkbox"
                    checked={showNormalizedProbability}
                    onChange={(e) => setShowNormalizedProbability(e.target.checked)}
                  />
                  불가능 옵션 고려한 확률 표시
                </label>
              </div>
            </div>
            {(() => {
              const allOptions = getAllOptionsStatus(processingGem);
              
              // 선택된 옵션들의 액션들 추출 (모드에 따라 다름)
              let selectedActions;
              if (isManualOptionGeneration) {
                // 수동 모드: selectedOptions 사용
                selectedActions = new Set(selectedOptions.map(opt => opt.action));
              } else {
                // 자동 모드: currentOptions 사용
                selectedActions = new Set((processingGem.currentOptions || []).map(opt => opt.action));
              }
              
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
                              className={`compact-option ${option.isAvailable ? 'available' : 'disabled'} ${isSelected ? 'selected' : ''} ${isManualOptionGeneration ? 'clickable' : ''}`}
                              onClick={() => {
                                if (!isManualOptionGeneration || !option.isAvailable) return;
                                
                                const isCurrentlySelected = selectedOptions.some(sel => sel.action === option.action);
                                
                                if (selectedOptions.length >= 4 && !isCurrentlySelected) {
                                  alert('최대 4개까지만 선택할 수 있습니다.');
                                  return;
                                }
                                
                                if (isCurrentlySelected) {
                                  // 이미 선택된 옵션이면 제거
                                  setSelectedOptions(prev => prev.filter(sel => sel.action !== option.action));
                                } else {
                                  // 새로운 옵션 추가
                                  setSelectedOptions(prev => [...prev, option]);
                                }
                                setSelectedOptionIndex(null);
                              }}
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
                {lastProcessingResult.actionType && (
                  <div className="processing-result-type">
                    <span className="result-label">선택 방식:</span>
                    <span className={`result-value ${lastProcessingResult.actionType === '수동 선택' ? 'manual' : 'auto'}`}>
                      {lastProcessingResult.actionType}
                    </span>
                  </div>
                )}
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
            {/* 옵션 생성 모드 토글 */}
            <div className="mode-toggle">
              <label>
                <input
                  type="checkbox"
                  checked={isManualOptionGeneration}
                  onChange={(e) => {
                    setIsManualOptionGeneration(e.target.checked);
                    if (e.target.checked) {
                      setSelectedOptions([]);
                    }
                    setSelectedOptionIndex(null);
                  }}
                />
                수동 옵션 생성
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
          {(() => {
            // 수동 옵션 생성 모드인 경우 selectedOptions 사용, 아니면 기존 currentOptions 사용
            const displayOptions = isManualOptionGeneration ? selectedOptions : (processingGem.currentOptions || []);
            
            return displayOptions.length > 0 && processingGem.remainingAttempts > 0 ? (
            displayOptions.map((option, index) => (
              <div
                key={index}
                className={`option-display ${isManualMode ? 'clickable' : ''} ${selectedOptionIndex === index ? 'selected' : ''}`}
                onClick={() => {
                  if (isManualMode) {
                    setSelectedOptionIndex(selectedOptionIndex === index ? null : index);
                  }
                }}
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
                {isManualMode && (
                  <div className="option-selector">
                    {selectedOptionIndex === index ? '✓' : '○'}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="no-options-message">
              {isManualOptionGeneration ? "옵션을 선택해주세요 (최대 4개)" : "가공 완료"}
            </div>
          );
          })()}
        </div>
      </div>
      
      {/* 목표 확률 비교 표 */}
      <div className="probability-table-section">
        <div className="probability-header">
          <h4>🎯 목표 달성 확률 비교</h4>
        </div>
        
        {(targetProbabilities || rerollProbabilities) && (
          <div className="probability-table">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th className="target-column">목표</th>
                  <th className="fixed-column">현재 젬+선택지 상태 기준</th>
                  <th className="reroll-column">리롤 후</th>
                  <th className="current-column">현재 젬 상태 기준</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const allTargets = [...targetGoals, ...sumTargets.map(st => st.key)];
                  
                  return allTargets.map(target => {
                    const isSum = sumTargets.some(st => st.key === target);
                    const targetLabel = isSum 
                      ? sumTargets.find(st => st.key === target)?.label || target
                      : target + '+';
                    
                    // 현재 확률
                    let currentProb = 0;
                    if (targetProbabilities) {
                      if (isSum) {
                        currentProb = targetProbabilities.sumProbabilities?.[target] || 0;
                      } else {
                        const cumulativeProbs = calculateCumulativeProbabilities(targetProbabilities.probabilities);
                        currentProb = cumulativeProbs[target] || 0;
                      }
                    }
                    
                    // 리롤 확률
                    let rerollProb = 0;
                    let rerollAvailable = false;
                    if (rerollProbabilities && processingGem?.currentRerollAttempts > 0 && processingGem?.processingCount > 0) {
                      rerollAvailable = true;
                      if (isSum) {
                        rerollProb = rerollProbabilities.sumProbabilities?.[target] || 0;
                      } else {
                        const cumulativeProbs = calculateCumulativeProbabilities(rerollProbabilities.probabilities);
                        rerollProb = cumulativeProbs[target] || 0;
                      }
                    }
                    
                    // 확정 옵션 확률 (선택지 기준)
                    let fixedProb = 0;
                    let hasFixedProb = false;
                    if (targetProbabilities && targetProbabilities.exactProbabilities?.withCurrentOptions) {
                      hasFixedProb = true;
                      const fixedData = targetProbabilities.exactProbabilities.withCurrentOptions;
                      if (isSum) {
                        fixedProb = fixedData[target] || 0;
                      } else {
                        const cumulativeProbs = calculateCumulativeProbabilities(fixedData);
                        fixedProb = cumulativeProbs[target] || 0;
                      }
                    }
                    
                    // 가장 높은 확률 찾기
                    const probValues = [
                      { value: fixedProb, available: hasFixedProb },
                      { value: rerollProb, available: rerollAvailable },
                      { value: currentProb, available: targetProbabilities }
                    ];
                    const validProbs = probValues.filter(p => p.available).map(p => p.value);
                    const maxProb = validProbs.length > 0 ? Math.max(...validProbs) : 0;
                    
                    const isGoodTarget = !isSum && (
                      target.split('/').map(Number).reduce((a, b) => a + b, 0) >= 8
                    );
                    
                    return (
                      <tr key={target} className={isGoodTarget ? 'good-target' : ''}>
                        <td className="target-name">{targetLabel}</td>
                        <td className={`prob-cell fixed ${hasFixedProb && fixedProb === maxProb && maxProb > 0 ? 'highest' : ''}`}>
                          {hasFixedProb ? (
                            <div className="prob-content">
                              <div className={`prob-main ${((isManualOptionGeneration && selectedOptions.length === 4) || 
                                (!isManualOptionGeneration && processingGem.currentOptions && processingGem.currentOptions.length > 0)) ? 'has-details' : ''}`}>
                                <span className="prob-value">{formatProbability(fixedProb)}</span>
                                {((isManualOptionGeneration && selectedOptions.length === 4) || 
                                  (!isManualOptionGeneration && processingGem.currentOptions && processingGem.currentOptions.length > 0)) && (
                                  <span className="prob-note">(평균)</span>
                                )}
                                
                                {/* 호버 시 나타나는 개별 확률 툴팁 */}
                                {((isManualOptionGeneration && selectedOptions.length === 4) || 
                                  (!isManualOptionGeneration && processingGem.currentOptions && processingGem.currentOptions.length > 0)) && (
                                  <div className="prob-tooltip">
                                    <div className="tooltip-title">개별 옵션 확률:</div>
                                    {getIndividualOptionDisplay(target, isSum).map((optionData) => (
                                      <div key={optionData.index} className="tooltip-option">
                                        <span className="tooltip-option-name">
                                          {(() => {
                                            let desc = optionData.description;
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
                                        <span className="tooltip-option-prob">
                                          {optionData.hasCalculatedProb ? 
                                            formatProbability(optionData.probability) : 
                                            <span className="calc-needed">확률 계산 필요</span>
                                          }
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="prob-unavailable">-</span>
                          )}
                        </td>
                        <td className={`prob-cell reroll ${rerollAvailable && rerollProb === maxProb && maxProb > 0 ? 'highest' : ''}`}>
                          {rerollAvailable ? (
                            <span className="prob-value">
                              {formatProbability(rerollProb)}
                            </span>
                          ) : (
                            <span className="prob-unavailable">리롤 불가능</span>
                          )}
                        </td>
                        <td className={`prob-cell current ${targetProbabilities && currentProb === maxProb && maxProb > 0 ? 'highest' : ''}`}>
                          {targetProbabilities ? 
                            <span className="prob-value">{formatProbability(currentProb)}</span> : 
                            <span className="prob-unavailable">-</span>
                          }
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
            
            <div className="table-status">
              {isCalculatingProbabilities ? (
                <span className="calculating">계산 중...</span>
              ) : (
                <span className="completed">
                  {targetProbabilities?.totalSimulations === 'exact' ? '정확한 계산 완료' : '계산 완료'}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* 가공하기 버튼 / 완료 메시지 */}
      <div className="processing-action">
        {processingGem.remainingAttempts > 0 ? (
          <div className="processing-buttons">
            {/* 수동 선택 모드 체크박스 */}
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
                수동 선택
              </label>
            </div>
            {!isTableLoaded ? (
              <button
                className="btn btn-warning load-table-btn"
                onClick={loadProbabilityTable}
                disabled={isTableLoading}
              >
                {isTableLoading ? '📥 테이블 로드 중...' : '📥 확률 테이블 로드'}
              </button>
            ) : (
              <button
                className="btn btn-secondary calc-prob-btn"
                onClick={calculateProbabilities}
                disabled={isCalculatingProbabilities}
              >
                {isCalculatingProbabilities ? '⏳ 계산 중...' : '📊 확률 계산'}
              </button>
            )}
            
            {tableLoadError && (
              <div className="table-load-error">
                ❌ {tableLoadError}
              </div>
            )}
            
            {isTableLoaded && (
              <div className="table-loaded-info">
                ✅ 확률 테이블 로드됨 (27,500개 상태)
              </div>
            )}
            <button
              className="btn btn-primary processing-btn"
              onClick={() => {
                const displayOptions = isManualOptionGeneration ? selectedOptions : (processingGem.currentOptions || []);
                
                if (displayOptions.length > 0) {
                  let selectedOption;
                  let actionType;
                  
                  if (isManualMode) {
                    // 수동 모드: 사용자가 선택한 옵션 사용
                    if (selectedOptionIndex !== null) {
                      selectedOption = displayOptions[selectedOptionIndex];
                      actionType = isManualOptionGeneration ? "수동 생성/수동 선택" : "자동 생성/수동 선택";
                    } else {
                      alert("옵션을 선택해주세요!");
                      return;
                    }
                  } else {
                    // 자동 모드: 랜덤 선택
                    const randomIndex = Math.floor(Math.random() * displayOptions.length);
                    selectedOption = displayOptions[randomIndex];
                    actionType = isManualOptionGeneration ? "수동 생성/자동 선택" : "자동 생성/자동 선택";
                  }
                  
                  const selectedAction = selectedOption.action;
                  
                  // 선택된 옵션 정보 저장
                  setLastProcessingResult({
                    option: selectedOption,
                    beforeGem: { ...processingGem },
                    actionType: actionType
                  });
                  
                  const newGem = executeGemProcessing(processingGem, selectedAction);
                  setProcessingGem(newGem);
                  setProcessingHistory([...processingHistory, newGem]);
                  setSelectedOptionIndex(null); // 선택 초기화
                }
              }}
              disabled={(() => {
                const displayOptions = isManualOptionGeneration ? selectedOptions : (processingGem.currentOptions || []);
                return displayOptions.length === 0 || (isManualMode && selectedOptionIndex === null);
              })()}
            >
              ⚒️ {isManualMode ? '선택한 옵션으로 가공' : '랜덤 가공'}
            </button>
            {isManualMode && selectedOptionIndex === null && (
              <div className="selection-hint">
                ↑ 위에서 옵션을 선택하세요
              </div>
            )}
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