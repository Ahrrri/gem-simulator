import { useState } from 'react';
import './FusionTab.css';
import MaterialSection from './MaterialSection';
import FusionControls from './FusionControls';
import FusionResults from './FusionResults';
import FusionStatistics from './FusionStatistics';

function FusionTab({
  materials,
  setMaterials,
  currentResult,
  setCurrentResult,
  allResults,
  setAllResults,
  statistics,
  setStatistics,
  simulationCount,
  setSimulationCount,
  selectedCombo,
  setSelectedCombo,
  isSimulating,
  setIsSimulating,
  progress,
  setProgress,
  executeSingleFusion,
  executeBulkSimulation,
  reset
}) {
  return (
    <>
      {/* 재료 설정 */}
      <MaterialSection 
        materials={materials}
        setMaterials={setMaterials}
      />

      {/* 실행 버튼 */}
      <FusionControls
        simulationCount={simulationCount}
        setSimulationCount={setSimulationCount}
        isSimulating={isSimulating}
        executeSingleFusion={executeSingleFusion}
        executeBulkSimulation={executeBulkSimulation}
        reset={reset}
      />

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
        <FusionResults 
          currentResult={currentResult}
        />
      )}

      {/* 통계 */}
      {statistics && (
        <FusionStatistics
          statistics={statistics}
          allResults={allResults}
          selectedCombo={selectedCombo}
          setSelectedCombo={setSelectedCombo}
        />
      )}
    </>
  );
}

export default FusionTab;