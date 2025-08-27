import './ProcessingTab.css';
import GemCreationSection from './GemCreationSection';
import ProcessingGemDisplay from './ProcessingGemDisplay';
import ProcessingStatistics from './ProcessingStatistics';

function ProcessingTab({
  // 젬 가공 관련 상태
  processingGem,
  setProcessingGem,
  processingHistory,
  setProcessingHistory,
  selectedProcessingGrade,
  setSelectedProcessingGrade,
  lastProcessingResult,
  setLastProcessingResult,
  
  // 가공 시뮬레이션 관련 상태
  processingSimulationResults,
  setProcessingSimulationResults,
  processingStatistics,
  setProcessingStatistics,
  processingSimulationCount,
  setProcessingSimulationCount,
  isProcessingSimulating,
  setIsProcessingSimulating,
  processingProgress,
  setProcessingProgress,
  selectedSimulationGemType,
  setSelectedSimulationGemType,
  selectedSimulationGrade,
  setSelectedSimulationGrade,
  selectedProcessingCombo,
  setSelectedProcessingCombo,
  selectedStrategy,
  setSelectedStrategy,
  strategyThreshold,
  setStrategyThreshold,
  showNormalizedProbability,
  setShowNormalizedProbability,
  
  // 목표 확률 계산 관련 상태
  targetProbabilities,
  setTargetProbabilities,
  rerollProbabilities,
  setRerollProbabilities,
  isCalculatingProbabilities,
  setIsCalculatingProbabilities,
  isCalculatingRerollProbabilities,
  setIsCalculatingRerollProbabilities,
  manualRerollThreshold,
  setManualRerollThreshold,
  selectedOptions,
  setSelectedOptions,
  calculationProgress,
  calculationStates,
  
  // 테이블 로드 관련 상태
  isTableLoading,
  isTableLoaded,
  tableLoadError,
  
  // 함수들
  executeProcessingSimulation,
  resetProcessingSimulation,
  calculateProbabilities,
  loadProbabilityTable
}) {
  return (
    <>
      {/* 젬 생성 섹션 */}
      <GemCreationSection
        processingGem={processingGem}
        setProcessingGem={setProcessingGem}
        setProcessingHistory={setProcessingHistory}
        setLastProcessingResult={setLastProcessingResult}
        selectedProcessingGrade={selectedProcessingGrade}
        setSelectedProcessingGrade={setSelectedProcessingGrade}
        
        // 시뮬레이션 관련
        processingSimulationCount={processingSimulationCount}
        setProcessingSimulationCount={setProcessingSimulationCount}
        isProcessingSimulating={isProcessingSimulating}
        selectedSimulationGemType={selectedSimulationGemType}
        setSelectedSimulationGemType={setSelectedSimulationGemType}
        selectedSimulationGrade={selectedSimulationGrade}
        setSelectedSimulationGrade={setSelectedSimulationGrade}
        selectedStrategy={selectedStrategy}
        setSelectedStrategy={setSelectedStrategy}
        strategyThreshold={strategyThreshold}
        setStrategyThreshold={setStrategyThreshold}
        executeProcessingSimulation={executeProcessingSimulation}
        resetProcessingSimulation={resetProcessingSimulation}
      />
      
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
        <ProcessingStatistics
          processingStatistics={processingStatistics}
          processingSimulationResults={processingSimulationResults}
          selectedProcessingCombo={selectedProcessingCombo}
          setSelectedProcessingCombo={setSelectedProcessingCombo}
        />
      )}
      
      {/* 가공 중인 젬 표시 */}
      {processingGem && (
        <ProcessingGemDisplay
          processingGem={processingGem}
          setProcessingGem={setProcessingGem}
          processingHistory={processingHistory}
          setProcessingHistory={setProcessingHistory}
          lastProcessingResult={lastProcessingResult}
          setLastProcessingResult={setLastProcessingResult}
          showNormalizedProbability={showNormalizedProbability}
          setShowNormalizedProbability={setShowNormalizedProbability}
          targetProbabilities={targetProbabilities}
          rerollProbabilities={rerollProbabilities}
          isCalculatingProbabilities={isCalculatingProbabilities}
          isCalculatingRerollProbabilities={isCalculatingRerollProbabilities}
          manualRerollThreshold={manualRerollThreshold}
          setManualRerollThreshold={setManualRerollThreshold}
          selectedOptions={selectedOptions}
          setSelectedOptions={setSelectedOptions}
          calculateProbabilities={calculateProbabilities}
          calculationProgress={calculationProgress}
          calculationStates={calculationStates}
          isTableLoading={isTableLoading}
          isTableLoaded={isTableLoaded}
          tableLoadError={tableLoadError}
          loadProbabilityTable={loadProbabilityTable}
        />
      )}
    </>
  );
}

export default ProcessingTab;