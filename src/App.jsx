import { useState } from 'react';
import './App.css';
import { fuseGems, calculateStatistics, getFusionProbabilities, GEM_TYPES } from './utils/gemFusion';
import { processGem, executeGemProcessing, createProcessingGem, rerollProcessingOptions, getAllOptionsStatus, bulkProcessingSimulation, calculateProcessingStatistics, calculateAttemptWiseOptionStats, PROCESSING_STRATEGIES } from './utils/gemProcessing';

function App() {
  const [materials, setMaterials] = useState([
    { id: 1, mainType: 'ORDER', subType: 'STABLE', grade: 'LEGENDARY' },
    { id: 2, mainType: 'ORDER', subType: 'STABLE', grade: 'LEGENDARY' },
    { id: 3, mainType: 'ORDER', subType: 'STABLE', grade: 'LEGENDARY' }
  ]);

  // 젬 타입 조합 옵션
  const gemTypeOptions = [
    { value: 'ORDER_STABLE', label: '질서: 안정' },
    { value: 'ORDER_SOLID', label: '질서: 견고' },
    { value: 'ORDER_IMMUTABLE', label: '질서: 불변' },
    { value: 'CHAOS_EROSION', label: '혼돈: 침식' },
    { value: 'CHAOS_DISTORTION', label: '혼돈: 왜곡' },
    { value: 'CHAOS_COLLAPSE', label: '혼돈: 붕괴' }
  ];

  const gradeOptions = [
    { value: 'LEGENDARY', label: '전설' },
    { value: 'RELIC', label: '유물' },
    { value: 'ANCIENT', label: '고대' }
  ];
  
  // 가공용 젬 등급 옵션
  const processingGradeOptions = [
    { value: 'UNCOMMON', label: '고급 (가공 5회/리롤 0회)' },
    { value: 'RARE', label: '희귀 (가공 7회/리롤 1회)' },
    { value: 'HEROIC', label: '영웅 (가공 9회/리롤 2회)' }
  ];
  
  const [currentResult, setCurrentResult] = useState(null);
  const [allResults, setAllResults] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [simulationCount, setSimulationCount] = useState(100000);
  const [selectedCombo, setSelectedCombo] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState('fusion'); // 'fusion' or 'processing'
  
  // 젬 가공 관련 상태
  const [processingGem, setProcessingGem] = useState(null);
  const [processingOptions, setProcessingOptions] = useState([]);
  const [processingHistory, setProcessingHistory] = useState([]);
  const [selectedProcessingGrade, setSelectedProcessingGrade] = useState('RARE');
  const [lastProcessingResult, setLastProcessingResult] = useState(null);
  
  // 가공 시뮬레이션 관련 상태
  const [processingSimulationResults, setProcessingSimulationResults] = useState([]);
  const [processingStatistics, setProcessingStatistics] = useState(null);
  const [processingSimulationCount, setProcessingSimulationCount] = useState(10000);
  const [isProcessingSimulating, setIsProcessingSimulating] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [selectedSimulationGemType, setSelectedSimulationGemType] = useState('ORDER_STABLE');
  const [selectedSimulationGrade, setSelectedSimulationGrade] = useState('RARE');
  const [selectedProcessingCombo, setSelectedProcessingCombo] = useState(null);
  const [selectedStrategy, setSelectedStrategy] = useState('NO_REROLL');
  const [strategyThreshold, setStrategyThreshold] = useState(0);

  // 재료 젬 업데이트
  const updateMaterial = (index, field, value) => {
    const newMaterials = [...materials];
    
    if (field === 'type') {
      const [mainType, subType] = value.split('_');
      newMaterials[index].mainType = mainType;
      newMaterials[index].subType = subType;
    } else {
      newMaterials[index][field] = value;
    }
    
    setMaterials(newMaterials);
  };

  // 단일 융합 실행
  const executeSingleFusion = () => {
    const result = fuseGems(materials);
    setCurrentResult(result);
    const newResults = [...allResults, result];
    setAllResults(newResults);
    setStatistics(calculateStatistics(newResults));
  };

  // 대량 시뮬레이션 실행 (진행률 표시와 함께)
  const executeBulkSimulation = async () => {
    setIsSimulating(true);
    setProgress(0);
    
    const results = [];
    const batchSize = Math.min(25000, Math.max(5000, Math.floor(simulationCount / 10))); // 5000-25000 사이의 배치 크기
    
    for (let i = 0; i < simulationCount; i++) {
      results.push(fuseGems(materials));
      
      // 배치마다 UI 업데이트
      if (i % batchSize === 0 || i === simulationCount - 1) {
        const progressPercent = ((i + 1) / simulationCount) * 100;
        setProgress(progressPercent);
        
        // UI 업데이트를 위해 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    setAllResults(results);
    setStatistics(calculateStatistics(results));
    setCurrentResult(results[results.length - 1]);
    setIsSimulating(false);
    setProgress(0);
  };

  // 초기화
  const reset = () => {
    setCurrentResult(null);
    setAllResults([]);
    setStatistics(null);
  };

  // 가공 시뮬레이션 실행
  const executeProcessingSimulation = async () => {
    // 이전 결과 먼저 클리어 (메모리 해제)
    setProcessingSimulationResults([]);
    setProcessingStatistics(null);
    setSelectedProcessingCombo(null);
    
    // 가비지 컬렉션을 위한 짧은 대기
    await new Promise(resolve => setTimeout(resolve, 50));
    
    setIsProcessingSimulating(true);
    setProcessingProgress(0);
    
    const [mainType, subType] = selectedSimulationGemType.split('_');
    // 더 작은 배치 크기로 더 자주 업데이트
    const batchSize = Math.min(250, Math.max(50, Math.floor(processingSimulationCount / 50)));
    
    // 선택된 전략과 파라미터 준비
    const strategy = PROCESSING_STRATEGIES[selectedStrategy];
    const strategyParams = selectedStrategy === 'THRESHOLD_REROLL' ? 
      { threshold: strategyThreshold } : {};
    
    // 결과를 청크로 나누어 처리 (메모리 효율성)
    let allResults = [];
    
    for (let i = 0; i < processingSimulationCount; i += batchSize) {
      const currentBatchSize = Math.min(batchSize, processingSimulationCount - i);
      // 옵션 추적과 전략을 활성화하여 시뮬레이션 실행
      const batchResults = bulkProcessingSimulation(
        mainType, subType, selectedSimulationGrade, currentBatchSize, 
        true, strategy, strategyParams
      );
      
      allResults.push(...batchResults);
      
      // 메모리 관리: history 데이터만 제거 (통계에 필요 없음)
      if (allResults.length > 10000) {
        // 최근 10000개를 제외한 나머지의 history 제거
        for (let j = 0; j < allResults.length - 10000; j++) {
          if (allResults[j].history) {
            allResults[j].history = null; // history만 제거
          }
        }
      }
      
      const progressPercent = ((i + currentBatchSize) / processingSimulationCount) * 100;
      setProcessingProgress(progressPercent);
      
      // UI 업데이트를 위해 잠시 대기 (더 짧은 간격)
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    setProcessingSimulationResults(allResults);
    setProcessingStatistics(calculateProcessingStatistics(allResults));
    setIsProcessingSimulating(false);
    setProcessingProgress(0);
  };

  // 가공 시뮬레이션 초기화
  const resetProcessingSimulation = () => {
    setProcessingSimulationResults([]);
    setProcessingStatistics(null);
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

  // 특정 조합의 예시 젬들 가져오기 (랜덤 선택)
  const getComboExamples = (combo) => {
    const [targetW, targetC] = combo.split('/').map(Number);
    const filtered = allResults
      .filter(gem => gem.willpower === targetW && gem.corePoint === targetC);
    
    // 랜덤으로 최대 5개 선택
    const shuffled = [...filtered].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 5);
  };

  // 조합 클릭 핸들러
  const handleComboClick = (combo) => {
    setSelectedCombo(selectedCombo === combo ? null : combo);
  };

  // 가공 조합 예시 가져오기
  const getProcessingComboExamples = (combo) => {
    const [targetW, targetC] = combo.split('/').map(Number);
    const filtered = processingSimulationResults
      .filter(result => result.finalGem.willpower === targetW && result.finalGem.corePoint === targetC);
    
    // 처음 5개 선택 (랜덤 제거)
    return filtered.slice(0, 5).map(result => result.finalGem);
  };

  // 가공 조합 클릭 핸들러
  const handleProcessingComboClick = (combo) => {
    setSelectedProcessingCombo(selectedProcessingCombo === combo ? null : combo);
  };

  return (
    <div className="App">
      <h1>🎮 로스트아크 젬 시뮬레이터</h1>
      
      {/* 탭 네비게이션 */}
      <div className="tab-navigation">
        <button 
          className={`tab-button ${activeTab === 'fusion' ? 'active' : ''}`}
          onClick={() => setActiveTab('fusion')}
        >
          🔮 젬 융합
        </button>
        <button 
          className={`tab-button ${activeTab === 'processing' ? 'active' : ''}`}
          onClick={() => setActiveTab('processing')}
        >
          ⚒️ 젬 가공
        </button>
      </div>
      
      <div className="container">
        {/* 젬 융합 탭 */}
        {activeTab === 'fusion' && (
          <>
        {/* 재료 설정 */}
        <div className="material-section">
          <h2>📦 재료 젬 설정</h2>
          <div className="materials">
            {materials.map((material, index) => (
              <div key={material.id} className="material-card">
                <h3>재료 {index + 1}</h3>
                <div className="material-controls">
                  <label>
                    젬 타입:
                    <select 
                      value={`${material.mainType}_${material.subType}`}
                      onChange={(e) => updateMaterial(index, 'type', e.target.value)}
                    >
                      {gemTypeOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    등급:
                    <select
                      value={material.grade}
                      onChange={(e) => updateMaterial(index, 'grade', e.target.value)}
                    >
                      {gradeOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="material-display">
                  {getGradeName(material.grade)} {getGemTypeName(material.mainType, material.subType)}
                </div>
              </div>
            ))}
          </div>
          
          {/* 융합 확률 표시 */}
          <div className="fusion-probability">
            <h3>🎯 융합 확률</h3>
            <div className="probability-grid">
              {(() => {
                const probs = getFusionProbabilities(materials);
                return Object.entries(probs).map(([grade, probability]) => (
                  <div key={grade} className={`probability-item ${grade.toLowerCase()}`}>
                    <span className="probability-grade">{getGradeName(grade)}</span>
                    <span className="probability-value">{(probability * 100).toFixed(1)}%</span>
                  </div>
                ));
              })()} 
            </div>
          </div>
        </div>

        {/* 실행 버튼 */}
        <div className="control-section">
          <button 
            className="btn btn-primary"
            onClick={executeSingleFusion}
            disabled={isSimulating}
          >
            🎲 단일 융합 실행
          </button>
          
          <div className="bulk-controls">
            <input
              type="number"
              value={simulationCount}
              onChange={(e) => setSimulationCount(parseInt(e.target.value) || 1)}
              min="1"
              max="1000000"
              disabled={isSimulating}
            />
            <button 
              className="btn btn-secondary"
              onClick={executeBulkSimulation}
              disabled={isSimulating}
            >
              {isSimulating ? '🔄 시뮬레이션 중...' : '🔄 대량 시뮬레이션'}
            </button>
          </div>
          
          <button 
            className="btn btn-reset"
            onClick={reset}
            disabled={isSimulating}
          >
            🗑️ 초기화
          </button>
        </div>

        {/* 진행률 표시 */}
        {isSimulating && (
          <div className="progress-section">
            <div className="progress-info">
              <span>시뮬레이션 진행 중...</span>
              <span>{progress.toFixed(1)}%</span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${Math.min(progress, 100)}%` }}
                data-progress={progress.toFixed(1)}
              />
            </div>
            <div className="progress-details">
              진행: {Math.floor((progress / 100) * simulationCount).toLocaleString()} / {simulationCount.toLocaleString()}
            </div>
          </div>
        )}

        {/* 현재 결과 */}
        {currentResult && (
          <div className="result-section">
            <h2>✨ 융합 결과</h2>
            <div className={`result-card ${currentResult.grade.toLowerCase()}`}>
              <div className="result-grade">{getGradeName(currentResult.grade)}</div>
              <div className="result-type">
                {getGemTypeName(currentResult.mainType, currentResult.subType)}
              </div>
              <div className="result-points">
                <div className="point-item">
                  <span className="point-label">총 포인트:</span>
                  <span className="point-value">{currentResult.totalPoints}</span>
                </div>
                <div className="point-item">
                  <span className="point-label">의지력 효율:</span>
                  <span className={`point-value ${currentResult.willpower === 5 ? 'max' : ''}`}>
                    {currentResult.willpower}
                  </span>
                </div>
                <div className="point-item">
                  <span className="point-label">{currentResult.mainType === 'ORDER' ? '질서' : '혼돈'} 포인트:</span>
                  <span className={`point-value ${currentResult.corePoint === 5 ? 'max' : ''}`}>
                    {currentResult.corePoint}
                  </span>
                </div>
                <div className="point-item">
                  <span className="point-label">{currentResult.effect1.name}:</span>
                  <span className={`point-value ${currentResult.effect1.level === 5 ? 'max' : ''}`}>
                    Lv.{currentResult.effect1.level}
                  </span>
                </div>
                <div className="point-item">
                  <span className="point-label">{currentResult.effect2.name}:</span>
                  <span className={`point-value ${currentResult.effect2.level === 5 ? 'max' : ''}`}>
                    Lv.{currentResult.effect2.level}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 통계 */}
        {statistics && (
          <div className="statistics-section">
            <h2>📊 통계</h2>
            <div className="stats-compact">
              <div className="stat-row">
                <span>총 시도: <strong>{statistics.totalRuns}</strong></span>
                <span>평균: <strong>{statistics.averagePoints.toFixed(1)}pt</strong></span>
                <span>전설: <strong>{(statistics.gradeDistribution.LEGENDARY / statistics.totalRuns * 100).toFixed(1)}%</strong></span>
                <span>유물: <strong>{(statistics.gradeDistribution.RELIC / statistics.totalRuns * 100).toFixed(1)}%</strong></span>
                <span>고대: <strong>{(statistics.gradeDistribution.ANCIENT / statistics.totalRuns * 100).toFixed(1)}%</strong></span>
              </div>
            </div>

            {/* 의지력/코어포인트 조합 분포 */}
            <div className="combo-section">
              <h3>의지력/코어포인트 조합</h3>
              <div className="combo-grid">
                {Object.entries(statistics.willpowerCoreDistribution)
                  .sort((a, b) => {
                    const [w1, c1] = a[0].split('/').map(Number);
                    const [w2, c2] = b[0].split('/').map(Number);
                    return (w2 + c2) - (w1 + c1) || w2 - w1;
                  })
                  .map(([combo, count]) => {
                    const percentage = (count / statistics.totalRuns * 100);
                    const [w, c] = combo.split('/').map(Number);
                    const isPerfect = w === 5 && c === 5;
                    const isGood = w >= 4 && c >= 4;
                    return (
                      <div 
                        key={combo} 
                        className={`combo-item ${isPerfect ? 'perfect' : isGood ? 'good' : ''} ${selectedCombo === combo ? 'selected' : ''}`}
                        onClick={() => handleComboClick(combo)}
                      >
                        <div className="combo-label">{combo}</div>
                        <div className="combo-value">{count}</div>
                        <div className="combo-percent">{percentage.toFixed(2)}%</div>
                      </div>
                    );
                  })}
              </div>
              
              {/* 선택된 조합의 예시 */}
              {selectedCombo && (
                <div className="combo-examples">
                  <h4>{selectedCombo} 조합 예시</h4>
                  <div className="examples-grid">
                    {getComboExamples(selectedCombo).map((gem, index) => (
                      <div key={index} className="example-gem">
                        <div className="example-header">
                          <span className={`example-grade ${gem.grade.toLowerCase()}`}>
                            {getGradeName(gem.grade)}
                          </span>
                          <span className="example-total">{gem.totalPoints}pt</span>
                        </div>
                        <div className="example-effects">
                          <div className="effect-row">
                            <span>{gem.effect1.name}</span>
                            <span className={gem.effect1.level === 5 ? 'max' : ''}>Lv.{gem.effect1.level}</span>
                          </div>
                          <div className="effect-row">
                            <span>{gem.effect2.name}</span>
                            <span className={gem.effect2.level === 5 ? 'max' : ''}>Lv.{gem.effect2.level}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {getComboExamples(selectedCombo).length === 0 && (
                    <div className="no-examples">이 조합의 예시가 없습니다.</div>
                  )}
                </div>
              )}
            </div>

            {/* 포인트 분포 히스토그램 */}
            <div className="histogram-section">
              <h3>포인트 분포 히스토그램</h3>
              <div className="histogram">
                {Object.entries(statistics.pointDistribution)
                  .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
                  .map(([points, count]) => {
                    const percentage = (count / statistics.totalRuns * 100);
                    const maxCount = Math.max(...Object.values(statistics.pointDistribution));
                    const height = Math.max((count / maxCount) * 120, 2);
                    return (
                      <div key={points} className="histogram-bar">
                        <div 
                          className="histogram-fill" 
                          style={{ height: `${height}px` }}
                          title={`${points}pt: ${count}개 (${percentage.toFixed(1)}%)`}
                        />
                        <div className="histogram-label">{points}</div>
                        <div className="histogram-count">{count}</div>
                        <div className="histogram-percent">{percentage.toFixed(1)}%</div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
          </>
        )}
        
        {/* 젬 가공 탭 */}
        {activeTab === 'processing' && (
          <>
            {/* 젬 생성 섹션 */}
            <div className="gem-creation-section">
              <h2>⚒️ 젬 가공 시뮬레이터</h2>
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
                                setProcessingOptions(processGem(newGem));
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
            
            {/* 가공 시뮬레이션 진행률 */}
            {isProcessingSimulating && (
              <div className="progress-section">
                <div className="progress-info">
                  <span>가공 시뮬레이션 진행 중...</span>
                  <span>{processingProgress.toFixed(1)}%</span>
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${Math.min(processingProgress, 100)}%` }}
                    data-progress={processingProgress.toFixed(1)}
                  />
                </div>
                <div className="progress-details">
                  진행: {Math.floor((processingProgress / 100) * processingSimulationCount).toLocaleString()} / {processingSimulationCount.toLocaleString()}
                </div>
              </div>
            )}
            
            {/* 가공 시뮬레이션 결과 */}
            {processingStatistics && !processingGem && (
              <div className="statistics-section">
                <h2>📊 통계</h2>
                <div className="stats-compact">
                  <div className="stat-row">
                    <span>총 시도: <strong>{processingStatistics.totalRuns.toLocaleString()}</strong></span>
                    <span>평균 포인트: <strong>{processingStatistics.averageTotalPoints.toFixed(3)}pt</strong></span>
                    <span>평균 가공 횟수: <strong>{processingStatistics.averageProcessingSteps.toFixed(3)}회</strong></span>
                    <span>조기 종료: <strong>{processingStatistics.earlyTerminationRate ? processingStatistics.earlyTerminationRate.toFixed(2) : '0.00'}%</strong></span>
                  </div>
                  <div className="stat-row">
                    <span>평균 리롤 사용: <strong>{processingStatistics.averageRerollsUsed.toFixed(3)}회</strong></span>
                    <span>리롤 못함: <strong>{processingStatistics.averageRerollsWanted ? processingStatistics.averageRerollsWanted.toFixed(3) : '0.000'}회</strong></span>
                    <span>남은 리롤: <strong>{processingStatistics.averageRemainingRerolls ? processingStatistics.averageRemainingRerolls.toFixed(3) : '0.000'}회</strong></span>
                  </div>
                  <div className="stat-row">
                    <span>평균 의지력: <strong>{processingStatistics.averageWillpower ? processingStatistics.averageWillpower.toFixed(3) : '0.000'}</strong></span>
                    <span>평균 코어포인트: <strong>{processingStatistics.averageCorePoint ? processingStatistics.averageCorePoint.toFixed(3) : '0.000'}</strong></span>
                    <span>의지력-코어포인트: <strong>{processingStatistics.averageWillpower && processingStatistics.averageCorePoint ? (processingStatistics.averageWillpower - processingStatistics.averageCorePoint).toFixed(3) : '0.000'}</strong></span>
                  </div>
                  <div className="stat-row">
                    <span>전설: <strong>{(processingStatistics.gradeDistribution.LEGENDARY / processingStatistics.totalRuns * 100).toFixed(2)}%</strong></span>
                    <span>유물: <strong>{(processingStatistics.gradeDistribution.RELIC / processingStatistics.totalRuns * 100).toFixed(2)}%</strong></span>
                    <span>고대: <strong>{(processingStatistics.gradeDistribution.ANCIENT / processingStatistics.totalRuns * 100).toFixed(2)}%</strong></span>
                  </div>
                </div>

                {/* 옵션 등장 빈도 통계 */}
                {processingStatistics.optionAppearanceFrequency && Object.keys(processingStatistics.optionAppearanceFrequency).length > 0 && (
                  <div className="option-frequency-section">
                    <h3>📊 옵션 등장 빈도</h3>
                    <p className="stats-description">4개 선택지에 각 옵션이 등장한 총 횟수</p>
                    <div className="option-frequency-grid">
                      {(() => {
                        const totalAppearances = Object.values(processingStatistics.optionAppearanceFrequency).reduce((a, b) => a + b, 0);
                        const sortedOptions = Object.entries(processingStatistics.optionAppearanceFrequency)
                          .sort((a, b) => b[1] - a[1]);
                        
                        // 카테고리별로 옵션 분류
                        const willpowerOptions = sortedOptions.filter(([key]) => key.startsWith('willpower_'));
                        const corePointOptions = sortedOptions.filter(([key]) => key.startsWith('corePoint_'));
                        const effect1Options = sortedOptions.filter(([key]) => key.startsWith('effect1_'));
                        const effect2Options = sortedOptions.filter(([key]) => key.startsWith('effect2_'));
                        const otherOptions = sortedOptions.filter(([key]) => 
                          !key.startsWith('willpower_') && 
                          !key.startsWith('corePoint_') && 
                          !key.startsWith('effect1_') && 
                          !key.startsWith('effect2_')
                        );
                        
                        return (
                          <>
                            <div className="frequency-comparison">
                              <div className="frequency-category">
                                <h4>의지력 효율</h4>
                                {willpowerOptions.map(([option, count]) => (
                                  <div key={option} className="frequency-item">
                                    <span className="option-name">{option.replace('willpower_', '')}</span>
                                    <span className="option-count">{count.toLocaleString()}</span>
                                    <span className="option-percent">{((count / totalAppearances) * 100).toFixed(2)}%</span>
                                  </div>
                                ))}
                                <div className="category-total">
                                  총: {willpowerOptions.reduce((sum, [, count]) => sum + count, 0).toLocaleString()} 
                                  ({((willpowerOptions.reduce((sum, [, count]) => sum + count, 0) / totalAppearances) * 100).toFixed(2)}%)
                                </div>
                              </div>
                              <div className="frequency-category">
                                <h4>코어포인트</h4>
                                {corePointOptions.map(([option, count]) => (
                                  <div key={option} className="frequency-item">
                                    <span className="option-name">{option.replace('corePoint_', '')}</span>
                                    <span className="option-count">{count.toLocaleString()}</span>
                                    <span className="option-percent">{((count / totalAppearances) * 100).toFixed(2)}%</span>
                                  </div>
                                ))}
                                <div className="category-total">
                                  총: {corePointOptions.reduce((sum, [, count]) => sum + count, 0).toLocaleString()} 
                                  ({((corePointOptions.reduce((sum, [, count]) => sum + count, 0) / totalAppearances) * 100).toFixed(2)}%)
                                </div>
                              </div>
                              <div className="frequency-category">
                                <h4>첫번째 효과</h4>
                                {effect1Options.map(([option, count]) => (
                                  <div key={option} className="frequency-item">
                                    <span className="option-name">{option.replace('effect1_', '')}</span>
                                    <span className="option-count">{count.toLocaleString()}</span>
                                    <span className="option-percent">{((count / totalAppearances) * 100).toFixed(2)}%</span>
                                  </div>
                                ))}
                                <div className="category-total">
                                  총: {effect1Options.reduce((sum, [, count]) => sum + count, 0).toLocaleString()} 
                                  ({((effect1Options.reduce((sum, [, count]) => sum + count, 0) / totalAppearances) * 100).toFixed(2)}%)
                                </div>
                              </div>
                              <div className="frequency-category">
                                <h4>두번째 효과</h4>
                                {effect2Options.map(([option, count]) => (
                                  <div key={option} className="frequency-item">
                                    <span className="option-name">{option.replace('effect2_', '')}</span>
                                    <span className="option-count">{count.toLocaleString()}</span>
                                    <span className="option-percent">{((count / totalAppearances) * 100).toFixed(2)}%</span>
                                  </div>
                                ))}
                                <div className="category-total">
                                  총: {effect2Options.reduce((sum, [, count]) => sum + count, 0).toLocaleString()} 
                                  ({((effect2Options.reduce((sum, [, count]) => sum + count, 0) / totalAppearances) * 100).toFixed(2)}%)
                                </div>
                              </div>
                            </div>
                            <div className="frequency-other">
                              <h4>기타 옵션</h4>
                              <div className="other-options-grid">
                                {otherOptions.map(([option, count]) => (
                                  <div key={option} className="frequency-item-inline">
                                    <span className="option-name">{option.replace(/_/g, ' ')}</span>
                                    <span className="option-count">{count.toLocaleString()}</span>
                                    <span className="option-percent">({((count / totalAppearances) * 100).toFixed(2)}%)</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="frequency-summary">
                              <div className="summary-item">
                                <span>전체 옵션 등장 횟수:</span>
                                <strong>{totalAppearances.toLocaleString()}</strong>
                              </div>
                              <div className="summary-item">
                                <span>평균 가공당 옵션:</span>
                                <strong>{(totalAppearances / processingStatistics.totalRuns / processingStatistics.averageProcessingSteps).toFixed(2)}</strong>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* 차수별 옵션 값 통계 */}
                <div className="attempt-stats-section">
                  <h3>🎯 차수별 옵션 값 분석</h3>
                  <p className="stats-description">각 가공 차수에서 제공되는 포인트 변화 옵션들의 평균 값</p>
                  <div className="attempt-stats-grid">
                    {(() => {
                      const attemptStats = calculateAttemptWiseOptionStats(processingSimulationResults);
                      if (!attemptStats || attemptStats.length === 0) return <div>통계 데이터 없음</div>;
                      
                      return attemptStats.map(stat => (
                        <div key={stat.attempt} className="attempt-stat-item">
                          <div className="attempt-number">{stat.attempt}차</div>
                          <div className={`attempt-avg-value ${stat.avgOptionValue < 0 ? 'negative' : stat.avgOptionValue > 2 ? 'positive' : ''}`}>
                            평균: {stat.avgOptionValue.toFixed(2)}
                          </div>
                          <div className="attempt-stdev">
                            σ: {stat.stdev.toFixed(2)}
                          </div>
                          <div className="attempt-reroll">
                            리롤: {stat.rerollRate.toFixed(3)}%
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                  <div className="stats-insight">
                    💡 음수 값이 나타나는 차수에서 "다른 항목 보기"를 고려해볼 수 있습니다. 리롤 비율은 해당 차수에서 전략이 실제로 리롤을 사용한 비율입니다.
                  </div>
                </div>

                {/* 의지력/코어포인트 조합 분포 */}
                <div className="combo-section">
                  <h3>의지력/코어포인트 조합</h3>
                  <div className="combo-grid">
                    {(() => {
                      // 의지력/코어포인트 조합 생성
                      const combinations = {};
                      processingSimulationResults.forEach(result => {
                        const combo = `${result.finalGem.willpower}/${result.finalGem.corePoint}`;
                        combinations[combo] = (combinations[combo] || 0) + 1;
                      });
                      
                      return Object.entries(combinations)
                        .sort((a, b) => {
                          const [w1, c1] = a[0].split('/').map(Number);
                          const [w2, c2] = b[0].split('/').map(Number);
                          return (w2 + c2) - (w1 + c1) || w2 - w1;
                        })
                        .map(([combo, count]) => {
                          const percentage = (count / processingStatistics.totalRuns * 100);
                          const [w, c] = combo.split('/').map(Number);
                          const isPerfect = w === 5 && c === 5;
                          const isGood = w + c >= 8;
                          return (
                            <div 
                              key={combo} 
                              className={`combo-item ${isPerfect ? 'perfect' : isGood ? 'good' : ''} ${selectedProcessingCombo === combo ? 'selected' : ''}`}
                              onClick={() => handleProcessingComboClick(combo)}
                            >
                              <div className="combo-label">{combo}</div>
                              <div className="combo-value">{count}</div>
                              <div className="combo-percent">{percentage.toFixed(2)}%</div>
                            </div>
                          );
                        });
                    })()}
                  </div>
                  
                  {/* 선택된 조합의 예시 */}
                  {selectedProcessingCombo && (
                    <div className="combo-examples">
                      <h4>{selectedProcessingCombo} 조합 예시</h4>
                      <div className="examples-grid">
                        {getProcessingComboExamples(selectedProcessingCombo).map((gem, index) => (
                          <div key={index} className="example-gem">
                            <div className="example-header">
                              <span className={`example-grade ${(() => {
                                if (gem.totalPoints >= 19) return 'ancient';
                                if (gem.totalPoints >= 16) return 'relic';
                                return 'legendary';
                              })()}`}>
                                {(() => {
                                  if (gem.totalPoints >= 19) return '고대';
                                  if (gem.totalPoints >= 16) return '유물';
                                  return '전설';
                                })()}
                              </span>
                              <span className="example-total">{gem.totalPoints}pt</span>
                            </div>
                            <div className="example-effects">
                              <div className="effect-row">
                                <span>{gem.effect1.name}</span>
                                <span className={gem.effect1.level === 5 ? 'max' : ''}>Lv.{gem.effect1.level}</span>
                              </div>
                              <div className="effect-row">
                                <span>{gem.effect2.name}</span>
                                <span className={gem.effect2.level === 5 ? 'max' : ''}>Lv.{gem.effect2.level}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {getProcessingComboExamples(selectedProcessingCombo).length === 0 && (
                        <div className="no-examples">이 조합의 예시가 없습니다.</div>
                      )}
                    </div>
                  )}
                </div>

                {/* 포인트 분포 히스토그램 */}
                <div className="histogram-section">
                  <h3>포인트 분포 히스토그램</h3>
                  <div className="histogram">
                    {Object.entries(processingStatistics.pointDistribution)
                      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
                      .map(([points, count]) => {
                        const percentage = (count / processingStatistics.totalRuns * 100);
                        const maxCount = Math.max(...Object.values(processingStatistics.pointDistribution));
                        const height = Math.max((count / maxCount) * 120, 2);
                        return (
                          <div key={points} className="histogram-bar">
                            <div 
                              className="histogram-fill" 
                              style={{ height: `${height}px` }}
                              title={`${points}pt: ${count}개 (${percentage.toFixed(1)}%)`}
                            />
                            <div className="histogram-label">{points}</div>
                            <div className="histogram-count">{count}</div>
                            <div className="histogram-percent">{percentage.toFixed(1)}%</div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}
            
            {/* 가공 중인 젬 표시 */}
            {processingGem && (
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
                      <h4>⚙️ 가공 옵션 상태</h4>
                      {(() => {
                        const allOptions = getAllOptionsStatus(processingGem);
                        
                        // 카테고리별로 옵션 분류
                        const categories = {
                          willpower: {
                            title: '의지력 효율',
                            options: allOptions.filter(opt => opt.action.startsWith('willpower_'))
                          },
                          corePoint: {
                            title: '질서/혼돈 포인트', 
                            options: allOptions.filter(opt => opt.action.startsWith('corePoint_'))
                          },
                          effect1: {
                            title: processingGem.effect1?.name || '첫번째 효과',
                            options: allOptions.filter(opt => opt.action.startsWith('effect1_'))
                          },
                          effect2: {
                            title: processingGem.effect2?.name || '두번째 효과', 
                            options: allOptions.filter(opt => opt.action.startsWith('effect2_'))
                          },
                          etc: {
                            title: '기타',
                            options: allOptions.filter(opt => 
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
                                  {category.options.map((option, index) => (
                                    <div 
                                      key={index} 
                                      className={`compact-option ${option.isAvailable ? 'available' : 'disabled'}`}
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
                                        })()}({(option.probability * 100).toFixed(2)}%)
                                      </div>
                                      <div className="compact-option-status">
                                        {option.isAvailable ? '✓' : '✗'}
                                      </div>
                                    </div>
                                  ))}
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
                      disabled={processingGem.processingCount === 0 || processingGem.currentRerollAttempts === 0}
                      onClick={() => {
                        const result = rerollProcessingOptions(processingGem);
                        if (result) {
                          setProcessingGem(result.gem);
                          setProcessingOptions(result.options);
                        }
                      }}
                    >
                      🔄 다른 항목 보기 ({processingGem.currentRerollAttempts}회)
                    </button>
                  </div>
                  <div className="options-display">
                    {processingOptions.length > 0 && processingGem.remainingAttempts > 0 ? (
                      processingOptions.map((option, index) => (
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
                          <div className="option-probability">{(option.probability * 100).toFixed(1)}%</div>
                        </div>
                      ))
                    ) : (
                      <div className="no-options-message">
                        가공이 완료되었습니다
                      </div>
                    )}
                  </div>
                </div>
                
                {/* 가공하기 버튼 / 완료 메시지 */}
                <div className="processing-action">
                  {processingGem.remainingAttempts > 0 ? (
                    <button
                      className="btn btn-primary processing-btn"
                      onClick={() => {
                        if (processingOptions.length > 0) {
                          // 4개 옵션 중 랜덤 선택 (25% 확률)
                          const randomIndex = Math.floor(Math.random() * processingOptions.length);
                          const selectedOption = processingOptions[randomIndex];
                          const selectedAction = selectedOption.action;
                          
                          // 선택된 옵션 정보 저장
                          setLastProcessingResult({
                            option: selectedOption,
                            beforeGem: { ...processingGem }
                          });
                          
                          const newGem = executeGemProcessing(processingGem, selectedAction);
                          setProcessingGem(newGem);
                          setProcessingHistory([...processingHistory, newGem]);
                          if (newGem.remainingAttempts > 0) {
                            setProcessingOptions(processGem(newGem));
                          } else {
                            setProcessingOptions([]);
                          }
                        }
                      }}
                      disabled={processingOptions.length === 0}
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
                        setProcessingOptions(processGem(resetGem));
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
                        setProcessingOptions([]);
                        setProcessingHistory([]);
                        setLastProcessingResult(null);
                      }}
                    >
                      🆕 새로운 젬 선택
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
