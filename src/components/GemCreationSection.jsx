import './GemCreationSection.css';
import { createProcessingGem } from '../utils/gemProcessing';

function GemCreationSection({
  processingGem,
  setProcessingGem,
  setProcessingHistory,
  setLastProcessingResult,
  selectedProcessingGrade,
  setSelectedProcessingGrade
}) {
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

  return (
    <div className="gem-creation-section">
      {!processingGem ? (
        <div className="gem-creation">
          <div className="creation-modes">
            <div className="manual-processing">
              <h3>수동 가공</h3>
              
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
              <div className="gem-type-selection">
                <h4>젬 타입 선택</h4>
                <div className="type-buttons">
                  {gemTypeOptions.map(option => (
                    <button
                      key={option.value}
                      className="gem-type-btn"
                      onClick={() => {
                        const [mainType, subType] = option.value.split('_');
                        const newGem = createProcessingGem(mainType, subType, selectedProcessingGrade);
                        setProcessingGem(newGem);
                        setProcessingHistory([newGem]);
                        setLastProcessingResult(null);
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
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