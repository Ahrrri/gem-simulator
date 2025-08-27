import { useState, useEffect } from 'react';
import './App.css';
import { fuseGems, calculateStatistics } from './utils/gemFusion';
import { rerollProcessingOptions, bulkProcessingSimulation, calculateProcessingStatistics, PROCESSING_STRATEGIES } from './utils/gemProcessing';
import probabilityLoader from './utils/probabilityLoader';
import FusionTab from './components/FusionTab';
import ProcessingTab from './components/ProcessingTab';

function App() {
  const [materials, setMaterials] = useState([
    { id: 1, mainType: 'ORDER', subType: 'STABLE', grade: 'LEGENDARY' },
    { id: 2, mainType: 'ORDER', subType: 'STABLE', grade: 'LEGENDARY' },
    { id: 3, mainType: 'ORDER', subType: 'STABLE', grade: 'LEGENDARY' }
  ]);

  
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
  const [showNormalizedProbability, setShowNormalizedProbability] = useState(false);
  
  // 목표 확률 계산 관련 상태
  const [targetProbabilities, setTargetProbabilities] = useState(null);
  const [rerollProbabilities, setRerollProbabilities] = useState(null);
  const [isCalculatingProbabilities, setIsCalculatingProbabilities] = useState(false);
  const [isCalculatingRerollProbabilities, setIsCalculatingRerollProbabilities] = useState(false);
  const [manualRerollThreshold, setManualRerollThreshold] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState([]); // 수동 선택 옵션
  const [calculationProgress, setCalculationProgress] = useState(0);
  const [calculationStates, setCalculationStates] = useState(0);
  
  // 테이블 로드 관련 상태
  const [isTableLoading, setIsTableLoading] = useState(false);
  const [isTableLoaded, setIsTableLoaded] = useState(false);
  const [tableLoadError, setTableLoadError] = useState(null);
  
  // 특정 결과 목표 리스트 (의지력 + 코어포인트 >= 8)
  const targetGoals = ['5/5', '5/4', '4/5', '5/3', '4/4', '3/5'];
  
  // 합 기준 목표
  const sumTargets = [
    { key: 'sum9+', label: '합 9+', minSum: 9 },
    { key: 'sum8+', label: '합 8+', minSum: 8 }
  ];
  
  
  // 테이블 로드 함수
  const loadProbabilityTable = async () => {
    if (isTableLoaded || isTableLoading) return;
    
    setIsTableLoading(true);
    setTableLoadError(null);
    
    try {
      const success = await probabilityLoader.loadTable();
      if (success) {
        setIsTableLoaded(true);
        setTableLoadError(null);
      } else {
        setTableLoadError('테이블 로드에 실패했습니다.');
      }
    } catch (error) {
      setTableLoadError(error.message);
    } finally {
      setIsTableLoading(false);
    }
  };

  // 실시간 확률 계산 함수 (사전 계산된 테이블 조회)
  const calculateRealTimeProbabilities = (gem) => {
    if (!gem || gem.remainingAttempts === 0) {
      setTargetProbabilities(null);
      return;
    }
    
    if (!isTableLoaded) {
      console.warn('확률 테이블이 로드되지 않았습니다.');
      return;
    }
    
    setIsCalculatingProbabilities(true);
    
    // 사전 계산된 테이블에서 즉시 조회
    const exactProbs = probabilityLoader.getProbabilities(gem);
    
    if (!exactProbs) {
      setIsCalculatingProbabilities(false);
      return;
    }
    
    // UI에 표시할 형식으로 변환
    const probabilities = {};
    const sumProbabilities = {};
    
    // 기존 목표들
    targetGoals.forEach(target => {
      probabilities[target] = exactProbs.current[target] || 0;
    });
    
    // 합 목표들
    sumTargets.forEach(target => {
      sumProbabilities[target.key] = exactProbs.current[target.key] || 0;
    });
    
    // 새로운 목표들 (유물+, 고대+)
    sumProbabilities['relic+'] = exactProbs.current['relic+'] || 0;
    sumProbabilities['ancient+'] = exactProbs.current['ancient+'] || 0;
    
    setTargetProbabilities({
      probabilities: probabilities,
      sumProbabilities: sumProbabilities,
      exactProbabilities: exactProbs,
      totalSimulations: 'exact',
      completedSimulations: 'exact'
    });
    
    setIsCalculatingProbabilities(false);
  };


  // 리롤 후 확률 계산 함수 (이미 probabilityTable에서 계산됨)
  const calculateRerollProbabilities = (gem) => {
    // targetProbabilities에 이미 리롤 확률이 포함되어 있으므로
    // 별도로 계산할 필요 없음
    if (targetProbabilities && targetProbabilities.exactProbabilities && targetProbabilities.exactProbabilities.afterReroll) {
      const rerollProbs = targetProbabilities.exactProbabilities.afterReroll;
      
      const probabilities = {};
      const sumProbabilities = {};
      
      // 기존 목표들
      targetGoals.forEach(target => {
        probabilities[target] = rerollProbs[target] || 0;
      });
      
      // 합 목표들
      sumTargets.forEach(target => {
        sumProbabilities[target.key] = rerollProbs[target.key] || 0;
      });
      
      // 새로운 목표들
      sumProbabilities['relic+'] = rerollProbs['relic+'] || 0;
      sumProbabilities['ancient+'] = rerollProbs['ancient+'] || 0;
      
      setRerollProbabilities({
        probabilities: probabilities,
        sumProbabilities: sumProbabilities,
        totalSimulations: 'exact',
        completedSimulations: 'exact'
      });
    } else {
      setRerollProbabilities(null);
    }
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
        await new Promise(resolve => setTimeout(resolve, 10));
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
    await new Promise(resolve => setTimeout(resolve, 10));
    
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

  // 젬이 변경되거나 완료되면 확률 초기화
  useEffect(() => {
    if (!processingGem || processingGem.remainingAttempts === 0) {
      setTargetProbabilities(null);
      setRerollProbabilities(null);
    }
  }, [processingGem]);

  // 선택된 옵션이 변경되면 선택지 기반 확률만 초기화
  useEffect(() => {
    if (processingGem && processingGem.remainingAttempts > 0 && targetProbabilities) {
      // 기존 확률은 유지하되, withCurrentOptions만 제거
      setTargetProbabilities(prev => ({
        ...prev,
        exactProbabilities: prev.exactProbabilities ? {
          ...prev.exactProbabilities,
          withCurrentOptions: null
        } : null
      }));
    }
  }, [selectedOptions]);

  // 확률 계산 함수 (옵션에 따라 다르게 계산)
  const calculateProbabilities = () => {
    if (processingGem && processingGem.remainingAttempts > 0) {
      if (selectedOptions.length === 4) {
        // 수동 옵션 4개가 선택된 경우
        const gemForCalculation = { ...processingGem, currentOptions: selectedOptions };
        calculateRealTimeProbabilities(gemForCalculation);
        calculateRerollProbabilities(gemForCalculation);
      } else {
        // 일반적인 경우
        calculateRealTimeProbabilities(processingGem);
        calculateRerollProbabilities(processingGem);
      }
    }
  };

  return (
    <div className="App">
      <h1>🎮 로스트아크 젬 시뮬레이터</h1>
      <div className="version-info">v2025.08.23. 14:16</div>
      
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
          <FusionTab
            materials={materials}
            setMaterials={setMaterials}
            currentResult={currentResult}
            setCurrentResult={setCurrentResult}
            allResults={allResults}
            setAllResults={setAllResults}
            statistics={statistics}
            setStatistics={setStatistics}
            simulationCount={simulationCount}
            setSimulationCount={setSimulationCount}
            selectedCombo={selectedCombo}
            setSelectedCombo={setSelectedCombo}
            isSimulating={isSimulating}
            setIsSimulating={setIsSimulating}
            progress={progress}
            setProgress={setProgress}
            executeSingleFusion={executeSingleFusion}
            executeBulkSimulation={executeBulkSimulation}
            reset={reset}
          />
        )}
        
        {/* 젬 가공 탭 */}
        {activeTab === 'processing' && (
          <ProcessingTab
            // 젬 가공 관련 상태
            processingGem={processingGem}
            setProcessingGem={setProcessingGem}
            processingHistory={processingHistory}
            setProcessingHistory={setProcessingHistory}
            selectedProcessingGrade={selectedProcessingGrade}
            setSelectedProcessingGrade={setSelectedProcessingGrade}
            lastProcessingResult={lastProcessingResult}
            setLastProcessingResult={setLastProcessingResult}
            
            // 가공 시뮬레이션 관련 상태
            processingSimulationResults={processingSimulationResults}
            setProcessingSimulationResults={setProcessingSimulationResults}
            processingStatistics={processingStatistics}
            setProcessingStatistics={setProcessingStatistics}
            processingSimulationCount={processingSimulationCount}
            setProcessingSimulationCount={setProcessingSimulationCount}
            isProcessingSimulating={isProcessingSimulating}
            setIsProcessingSimulating={setIsProcessingSimulating}
            processingProgress={processingProgress}
            setProcessingProgress={setProcessingProgress}
            selectedSimulationGemType={selectedSimulationGemType}
            setSelectedSimulationGemType={setSelectedSimulationGemType}
            selectedSimulationGrade={selectedSimulationGrade}
            setSelectedSimulationGrade={setSelectedSimulationGrade}
            selectedProcessingCombo={selectedProcessingCombo}
            setSelectedProcessingCombo={setSelectedProcessingCombo}
            selectedStrategy={selectedStrategy}
            setSelectedStrategy={setSelectedStrategy}
            strategyThreshold={strategyThreshold}
            setStrategyThreshold={setStrategyThreshold}
            showNormalizedProbability={showNormalizedProbability}
            setShowNormalizedProbability={setShowNormalizedProbability}
            
            // 목표 확률 계산 관련 상태
            targetProbabilities={targetProbabilities}
            setTargetProbabilities={setTargetProbabilities}
            rerollProbabilities={rerollProbabilities}
            setRerollProbabilities={setRerollProbabilities}
            isCalculatingProbabilities={isCalculatingProbabilities}
            setIsCalculatingProbabilities={setIsCalculatingProbabilities}
            isCalculatingRerollProbabilities={isCalculatingRerollProbabilities}
            setIsCalculatingRerollProbabilities={setIsCalculatingRerollProbabilities}
            manualRerollThreshold={manualRerollThreshold}
            setManualRerollThreshold={setManualRerollThreshold}
            selectedOptions={selectedOptions}
            setSelectedOptions={setSelectedOptions}
            calculationProgress={calculationProgress}
            calculationStates={calculationStates}
            
            // 테이블 로드 관련 상태
            isTableLoading={isTableLoading}
            isTableLoaded={isTableLoaded}
            tableLoadError={tableLoadError}
            
            // 함수들
            executeProcessingSimulation={executeProcessingSimulation}
            resetProcessingSimulation={resetProcessingSimulation}
            calculateProbabilities={calculateProbabilities}
            loadProbabilityTable={loadProbabilityTable}
          />
        )}
      </div>
    </div>
  );
}

export default App;
