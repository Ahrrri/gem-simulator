import './GemCreationSection.css';
import { createProcessingGem, PROCESSING_STRATEGIES } from '../utils/gemProcessing';

function GemCreationSection({
  processingGem,
  setProcessingGem,
  setProcessingHistory,
  setLastProcessingResult,
  selectedProcessingGrade,
  setSelectedProcessingGrade,
  
  // 시뮬레이션 관련
  processingSimulationCount,
  setProcessingSimulationCount,
  isProcessingSimulating,
  selectedSimulationGemType,
  setSelectedSimulationGemType,
  selectedSimulationGrade,
  setSelectedSimulationGrade,
  selectedStrategy,
  setSelectedStrategy,
  strategyThreshold,
  setStrategyThreshold,
  executeProcessingSimulation,
  resetProcessingSimulation
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
            
            <div className="simulation-processing">
              <h3>가공 시뮬레이션</h3>
              
              {/* 시뮬레이션 설정 */}
              <div className="simulation-settings">
                <div className="simulation-controls">
                  <div className="sim-setting">
                    <label>젬 타입:</label>
                    <select 
                      value={selectedSimulationGemType}
                      onChange={(e) => setSelectedSimulationGemType(e.target.value)}
                      disabled={isProcessingSimulating}
                    >
                      {gemTypeOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="sim-setting">
                    <label>젬 등급:</label>
                    <select
                      value={selectedSimulationGrade}
                      onChange={(e) => setSelectedSimulationGrade(e.target.value)}
                      disabled={isProcessingSimulating}
                    >
                      {processingGradeOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="sim-setting">
                    <label>시뮬레이션 횟수:</label>
                    <input
                      type="number"
                      value={processingSimulationCount}
                      onChange={(e) => setProcessingSimulationCount(parseInt(e.target.value) || 1)}
                      min="1"
                      max="100000"
                      disabled={isProcessingSimulating}
                    />
                  </div>
                  
                  <div className="sim-setting">
                    <label>전략:</label>
                    <select
                      value={selectedStrategy}
                      onChange={(e) => setSelectedStrategy(e.target.value)}
                      disabled={isProcessingSimulating}
                    >
                      {Object.entries(PROCESSING_STRATEGIES).map(([key, strategy]) => (
                        <option key={key} value={key}>
                          {strategy.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {selectedStrategy === 'THRESHOLD_REROLL' && (
                    <div className="sim-setting">
                      <label>임계값:</label>
                      <input
                        type="number"
                        value={strategyThreshold}
                        onChange={(e) => setStrategyThreshold(Number(e.target.value))}
                        min="-5"
                        max="5"
                        step="0.5"
                        disabled={isProcessingSimulating}
                      />
                      <span className="threshold-hint">
                        (평균 값 ≤ {strategyThreshold}일 때 리롤)
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="simulation-buttons">
                  <button 
                    className="btn btn-primary"
                    onClick={executeProcessingSimulation}
                    disabled={isProcessingSimulating}
                  >
                    {isProcessingSimulating ? '🔄 시뮬레이션 중...' : '🎲 시뮬레이션 실행'}
                  </button>
                  
                  <button 
                    className="btn btn-reset"
                    onClick={resetProcessingSimulation}
                    disabled={isProcessingSimulating}
                  >
                    🗑️ 초기화
                  </button>
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