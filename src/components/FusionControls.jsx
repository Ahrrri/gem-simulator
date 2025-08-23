import './FusionControls.css';

function FusionControls({
  simulationCount,
  setSimulationCount,
  isSimulating,
  executeSingleFusion,
  executeBulkSimulation,
  reset
}) {
  return (
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
  );
}

export default FusionControls;