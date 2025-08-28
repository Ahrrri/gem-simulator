import { useState } from 'react';
import './FusionTab.css';
import { fuseGems, calculateStatistics } from '../utils/gemFusion';
import MaterialSection from './MaterialSection';
import FusionControls from './FusionControls';
import FusionResults from './FusionResults';
import FusionStatistics from './FusionStatistics';

function FusionTab() {
  // 융합 관련 상태 (내부 관리)
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

  // 융합 실행
  const executeFusion = () => {
    const result = fuseGems(materials);
    setCurrentResult(result);
  };

  // 대량 시뮬레이션 실행
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
        executeSingleFusion={executeFusion}
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