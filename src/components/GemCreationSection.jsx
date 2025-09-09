import './GemCreationSection.css';
import { createProcessingGem, getEffectsForGem } from '../utils/gemProcessing';
import { useState } from 'react';

function GemCreationSection({
  processingGem,
  setProcessingGem,
  setProcessingHistory,
  setLastProcessingResult,
  selectedProcessingGrade,
  setSelectedProcessingGrade,
  setSelectedHistoryIndex
}) {
  const [selectedGemType, setSelectedGemType] = useState(null);
  const [showCombinationSelection, setShowCombinationSelection] = useState(false);
  // 젬 타입 조합 옵션
  const gemTypeOptions = [
    { value: 'ORDER_STABLE', label: '질서: 안정' },
    { value: 'ORDER_SOLID', label: '질서: 견고' },
    { value: 'ORDER_IMMUTABLE', label: '질서: 불변' },
    { value: 'CHAOS_EROSION', label: '혼돈: 침식' },
    { value: 'CHAOS_DISTORTION', label: '혼돈: 왜곡' },
    { value: 'CHAOS_COLLAPSE', label: '혼돈: 붕괴' }
  ];

  // 가공용 젬 등급 옵션
  const processingGradeOptions = [
    { value: 'UNCOMMON', label: '고급 (가공 5회/리롤 0회)' },
    { value: 'RARE', label: '희귀 (가공 7회/리롤 1회)' },
    { value: 'HEROIC', label: '영웅 (가공 9회/리롤 2회)' }
  ];

  // 조합 옵션 (dealerA, dealerB, supportA, supportB 중 2개 선택)
  const combinationOptions = [
    { value: [1, 1, 0, 0], label: '딜러A + 딜러B', description: 'dealerA + dealerB' },
    { value: [1, 0, 1, 0], label: '딜러A + 서폿A', description: 'dealerA + supportA' },
    { value: [1, 0, 0, 1], label: '딜러A + 서폿B', description: 'dealerA + supportB' },
    { value: [0, 1, 1, 0], label: '딜러B + 서폿A', description: 'dealerB + supportA' },
    { value: [0, 1, 0, 1], label: '딜러B + 서폿B', description: 'dealerB + supportB' },
    { value: [0, 0, 1, 1], label: '서폿A + 서폿B', description: 'supportA + supportB' }
  ];

  // 젬 타입 선택 핸들러
  const handleGemTypeClick = (gemTypeValue) => {
    setSelectedGemType(gemTypeValue);
    setShowCombinationSelection(true);
  };

  // 조합을 사용해서 젬 생성
  const createGemWithCombination = (combination) => {
    if (!selectedGemType) return;
    
    const [mainType, subType] = selectedGemType.split('_');
    const newGem = createProcessingGem(mainType, subType, selectedProcessingGrade, combination);
    setProcessingGem(newGem);
    setProcessingHistory([newGem]);
    setLastProcessingResult(null);
    setSelectedHistoryIndex(0);
    
    // 상태 초기화
    setSelectedGemType(null);
    setShowCombinationSelection(false);
  };

  // 자동 조합으로 젬 생성
  const createGemWithRandomCombination = () => {
    if (!selectedGemType) return;
    
    const [mainType, subType] = selectedGemType.split('_');
    const newGem = createProcessingGem(mainType, subType, selectedProcessingGrade); // combination = null (랜덤)
    setProcessingGem(newGem);
    setProcessingHistory([newGem]);
    setLastProcessingResult(null);
    setSelectedHistoryIndex(0);
    
    // 상태 초기화
    setSelectedGemType(null);
    setShowCombinationSelection(false);
  };

  // 취소 핸들러
  const handleCancel = () => {
    setSelectedGemType(null);
    setShowCombinationSelection(false);
  };

  return (
    <div className="gem-creation-section">
      {!processingGem ? (
        <div className="gem-creation">
          <div className="creation-modes">
            <div className="manual-processing">
              <h3>수동 생성</h3>
              
              {/* 젬 등급 선택 */}
              <div className="grade-selection">
                <h4>젬 등급 선택</h4>
                <div className="grade-buttons">
                  {processingGradeOptions.map(option => (
                    <button
                      key={option.value}
                      className={`grade-btn ${selectedProcessingGrade === option.value ? 'selected' : ''}`}
                      onClick={() => setSelectedProcessingGrade(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* 젬 타입 선택 */}
              {!showCombinationSelection ? (
                <div className="gem-type-selection">
                  <h4>젬 타입 선택</h4>
                  <div className="type-buttons">
                    {gemTypeOptions.map(option => (
                      <button
                        key={option.value}
                        className="gem-type-btn"
                        onClick={() => handleGemTypeClick(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* 조합 선택 단계 */
                <div className="combination-selection">
                  <h4>
                    {gemTypeOptions.find(opt => opt.value === selectedGemType)?.label} - 조합 선택
                  </h4>
                  <p className="combination-desc">
                    4개 효과 중 2개가 활성화됩니다. 조합을 직접 선택하거나 자동으로 설정할 수 있습니다.
                  </p>
                  
                  {/* 자동 조합 버튼 */}
                  <div className="auto-combination">
                    <button
                      className="auto-combo-btn"
                      onClick={createGemWithRandomCombination}
                    >
                      🎲 자동 조합 (랜덤)
                    </button>
                  </div>
                  
                  {/* 수동 조합 선택 */}
                  <div className="manual-combination">
                    <h5>수동 조합 선택</h5>
                    {selectedGemType && (() => {
                      const [mainType, subType] = selectedGemType.split('_');
                      const effects = getEffectsForGem(mainType, subType);
                      
                      return (
                        <div className="combination-buttons">
                          {combinationOptions.map((combo, index) => {
                            const [dealerA, dealerB, supportA, supportB] = combo.value;
                            const activeEffects = [];
                            if (dealerA) activeEffects.push(effects[0] || '딜러A');
                            if (dealerB) activeEffects.push(effects[1] || '딜러B');
                            if (supportA) activeEffects.push(effects[2] || '서폿A');
                            if (supportB) activeEffects.push(effects[3] || '서폿B');
                            
                            return (
                              <button
                                key={index}
                                className="combination-btn"
                                onClick={() => createGemWithCombination(combo.value)}
                              >
                                <div className="combo-effects-main">{activeEffects.join(' + ')}</div>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                  
                  {/* 취소 버튼 */}
                  <div className="selection-controls">
                    <button
                      className="cancel-btn"
                      onClick={handleCancel}
                    >
                      ← 뒤로 가기
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        // 기존 수동 가공 인터페이스는 그대로 유지
        null
      )}
    </div>
  );
}

export default GemCreationSection;