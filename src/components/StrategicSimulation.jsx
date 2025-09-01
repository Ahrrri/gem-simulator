import { useState, useEffect } from 'react';
import './StrategicSimulation.css';

// 동적 import를 통한 모듈 로딩
let ADVANCED_STRATEGIES = null;
let runStrategicSimulation = null;
let compareStrategies = null;
let createProcessingGem = null;

// 컴포넌트 로드 시 필요한 모듈 동적 import
async function loadModules() {
  if (!ADVANCED_STRATEGIES) {
    const strategicModule = await import('../utils/strategicEngine.js');
    ADVANCED_STRATEGIES = strategicModule.ADVANCED_STRATEGIES;
    runStrategicSimulation = strategicModule.runStrategicSimulation;
    compareStrategies = strategicModule.compareStrategies;
  }
  
  if (!createProcessingGem) {
    const processingModule = await import('../utils/gemProcessing.js');
    createProcessingGem = processingModule.createProcessingGem;
  }
}

function StrategicSimulation() {
  const [selectedStrategy, setSelectedStrategy] = useState('EXPECTED_VALUE');
  const [simulationCount, setSimulationCount] = useState(100);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [comparisonResults, setComparisonResults] = useState(null);
  const [strategies, setStrategies] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  
  const [gemConfig, setGemConfig] = useState({
    type: 'ORDER_STABLE',
    grade: 'RARE'
  });

  // 컴포넌트 마운트 시 모듈 로드
  useEffect(() => {
    async function init() {
      await loadModules();
      setStrategies(ADVANCED_STRATEGIES || {});
      setIsLoading(false);
    }
    init();
  }, []);

  const runSingleStrategy = async () => {
    if (isRunning) return;
    
    setIsRunning(true);
    setProgress(0);
    setResults(null);
    
    try {
      const strategy = strategies[selectedStrategy];
      const results = [];
      
      for (let i = 0; i < simulationCount; i++) {
        const initialGem = createProcessingGem(gemConfig.type, gemConfig.grade);
        const result = await runStrategicSimulation(initialGem, strategy);
        results.push(result);
        
        setProgress(((i + 1) / simulationCount) * 100);
      }
      
      setResults(calculateSummaryStatistics(results));
    } catch (error) {
      console.error('시뮬레이션 실행 오류:', error);
      alert('시뮬레이션 실행 중 오류가 발생했습니다.');
    } finally {
      setIsRunning(false);
      setProgress(0);
    }
  };

  const runStrategyComparison = async () => {
    if (isRunning) return;
    
    setIsRunning(true);
    setProgress(0);
    setComparisonResults(null);
    
    try {
      const initialGem = createProcessingGem(gemConfig.type, gemConfig.grade);
      const comparison = await compareStrategies(initialGem, strategies, Math.floor(simulationCount / Object.keys(strategies).length));
      
      setComparisonResults(comparison);
    } catch (error) {
      console.error('전략 비교 오류:', error);
      alert('전략 비교 중 오류가 발생했습니다.');
    } finally {
      setIsRunning(false);
      setProgress(0);
    }
  };

  const calculateSummaryStatistics = (results) => {
    if (results.length === 0) return null;
    
    const totalPoints = results.reduce((sum, r) => sum + (r.finalGem.totalPoints || 0), 0);
    const totalRerolls = results.reduce((sum, r) => sum + (r.totalRerollsUsed || 0), 0);
    const totalSteps = results.reduce((sum, r) => sum + (r.totalProcessingSteps || 0), 0);
    
    const ancientCount = results.filter(r => (r.finalGem.totalPoints || 0) >= 19).length;
    const relicCount = results.filter(r => (r.finalGem.totalPoints || 0) >= 16 && (r.finalGem.totalPoints || 0) < 19).length;
    
    const bestResult = results.reduce((best, current) => 
      (current.finalGem.totalPoints || 0) > (best.finalGem.totalPoints || 0) ? current : best
    );
    
    const worstResult = results.reduce((worst, current) => 
      (current.finalGem.totalPoints || 0) < (worst.finalGem.totalPoints || 0) ? current : worst
    );

    return {
      totalRuns: results.length,
      averagePoints: (totalPoints / results.length).toFixed(2),
      averageRerolls: (totalRerolls / results.length).toFixed(2),
      averageSteps: (totalSteps / results.length).toFixed(2),
      ancientRate: ((ancientCount / results.length) * 100).toFixed(1),
      relicRate: ((relicCount / results.length) * 100).toFixed(1),
      bestResult,
      worstResult,
      rawResults: results
    };
  };

  if (isLoading) {
    return (
      <div className="strategic-simulation-container">
        <div className="strategic-loading-message">
          <span className="strategic-strategic-loading-spinner"></span>
          모듈 로딩 중...
        </div>
      </div>
    );
  }

  return (
    <div className="strategic-simulation-container">
      <div className="strategic-simulation-header">
        <h2 className="strategic-simulation-title">
          전략 시뮬레이션
        </h2>
        <div className="strategic-mode-toggle">
          <button 
            className={`strategic-mode-btn ${!comparisonMode ? 'active' : ''}`}
            onClick={() => setComparisonMode(false)}
          >
            단일 전략
          </button>
          <button 
            className={`strategic-mode-btn ${comparisonMode ? 'active' : ''}`}
            onClick={() => setComparisonMode(true)}
          >
            전략 비교
          </button>
        </div>
      </div>

      {/* 젬 설정 */}
      <div className="strategic-gem-config-section">
        <h3>젬 설정</h3>
        <div className="strategic-gem-config-controls">
          <div className="strategic-control-group">
            <label>젬 타입</label>
            <select 
              value={gemConfig.type}
              onChange={(e) => setGemConfig(prev => ({ ...prev, type: e.target.value }))}
              className="strategic-control-input"
            >
              <option value="ORDER_STABLE">질서: 안정</option>
              <option value="ORDER_SOLID">질서: 견고</option>
              <option value="ORDER_IMMUTABLE">질서: 불변</option>
              <option value="CHAOS_EROSION">혼돈: 침식</option>
              <option value="CHAOS_DISTORTION">혼돈: 왜곡</option>
              <option value="CHAOS_COLLAPSE">혼돈: 붕괴</option>
            </select>
          </div>
          <div className="strategic-control-group">
            <label>젬 등급</label>
            <select 
              value={gemConfig.grade}
              onChange={(e) => setGemConfig(prev => ({ ...prev, grade: e.target.value }))}
              className="strategic-control-input"
            >
              <option value="UNCOMMON">고급 (5회)</option>
              <option value="RARE">희귀 (7회)</option>
              <option value="HEROIC">영웅 (9회)</option>
            </select>
          </div>
        </div>
      </div>

      {!comparisonMode ? (
        <>
          {/* 전략 선택 */}
          <div className="strategic-control-group">
            <label>전략</label>
            <select 
              value={selectedStrategy}
              onChange={(e) => setSelectedStrategy(e.target.value)}
              className="strategic-control-input"
            >
              {Object.entries(strategies).map(([key, strategy]) => (
                <option key={key} value={key}>
                  {strategy.name}
                </option>
              ))}
            </select>
          </div>

          {/* 시뮬레이션 제어 */}
          <div className="strategic-simulation-controls">
            <div className="strategic-control-group">
              <label>시뮬레이션 횟수</label>
              <input
                type="number"
                value={simulationCount}
                onChange={(e) => setSimulationCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="strategic-control-input"
                min="1"
                max="1000"
              />
            </div>
            <button 
              className="strategic-run-simulation-btn"
              onClick={runSingleStrategy}
              disabled={isRunning}
            >
              {isRunning ? (
                <>
                  <span className="strategic-loading-spinner"></span>
                  실행 중...
                </>
              ) : (
                '시뮬레이션 실행'
              )}
            </button>
          </div>
        </>
      ) : (
        <>
          {/* 전략 비교 모드 */}
          <div className="strategic-comparison-info">
            <p>모든 전략을 동일한 조건으로 비교합니다.</p>
            <div className="strategic-simulation-controls">
              <div className="strategic-control-group">
                <label>전략당 실행 횟수</label>
                <input
                  type="number"
                  value={Math.floor(simulationCount / Object.keys(strategies).length)}
                  onChange={(e) => setSimulationCount(Math.max(Object.keys(strategies).length, parseInt(e.target.value) * Object.keys(strategies).length))}
                  className="strategic-control-input"
                  min="1"
                  max="200"
                />
              </div>
              <button 
                className="strategic-run-simulation-btn"
                onClick={runStrategyComparison}
                disabled={isRunning}
              >
                {isRunning ? (
                  <>
                    <span className="strategic-loading-spinner"></span>
                    비교 중...
                  </>
                ) : (
                  '전략 비교 실행'
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {/* 진행 상황 */}
      {isRunning && (
        <div className="strategic-simulation-progress">
          <div 
            className="strategic-progress-bar"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      )}

      {/* 결과 표시 */}
      {!comparisonMode && results && (
        <div className="strategic-simulation-results">
          <h3>시뮬레이션 결과</h3>
          <div className="strategic-results-summary">
            <div className="strategic-result-card">
              <div className="strategic-result-value">{results.averagePoints}</div>
              <div className="strategic-result-label">평균 포인트</div>
            </div>
            <div className="strategic-result-card">
              <div className="strategic-result-value">{results.ancientRate}%</div>
              <div className="strategic-result-label">Ancient 달성률</div>
            </div>
            <div className="strategic-result-card">
              <div className="strategic-result-value">{results.relicRate}%</div>
              <div className="strategic-result-label">Relic 달성률</div>
            </div>
            <div className="strategic-result-card">
              <div className="strategic-result-value">{results.averageRerolls}</div>
              <div className="strategic-result-label">평균 리롤 사용</div>
            </div>
          </div>

          {/* 최고/최악 결과 */}
          <div className="strategic-strategic-extreme-results">
            <div className="strategic-extreme-result">
              <h4>최고 결과</h4>
              <p>포인트: {results.bestResult.finalGem.totalPoints} / 단계: {results.bestResult.totalProcessingSteps} / 리롤: {results.bestResult.totalRerollsUsed}</p>
            </div>
            <div className="strategic-extreme-result">
              <h4>최악 결과</h4>
              <p>포인트: {results.worstResult.finalGem.totalPoints} / 단계: {results.worstResult.totalProcessingSteps} / 리롤: {results.worstResult.totalRerollsUsed}</p>
            </div>
          </div>

          {/* 의사결정 분석 (첫 번째 시뮬레이션 결과) */}
          {results.rawResults.length > 0 && results.rawResults[0].decisions && (
            <div className="strategic-decision-analysis">
              <h4 className="strategic-strategic-decision-analysis-title">의사결정 분석 (샘플)</h4>
              <div className="strategic-decision-timeline">
                {results.rawResults[0].decisions.slice(0, 10).map((decision, index) => (
                  <div key={index} className="strategic-decision-step">
                    <div className="strategic-step-number">{decision.attempt}</div>
                    <div className="strategic-decision-details">
                      <div className="strategic-decision-action">
                        {decision.selectedAction}
                        {decision.rerollDecision && <span className="strategic-reroll-indicator">리롤</span>}
                      </div>
                      <div className="strategic-decision-reason">{decision.selectionReason}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 전략 비교 결과 */}
      {comparisonMode && comparisonResults && (
        <div className="strategic-strategy-comparison">
          <h3 className="strategic-comparison-title">전략 비교 결과</h3>
          <table className="strategic-comparison-table">
            <thead>
              <tr>
                <th>전략</th>
                <th>평균 포인트</th>
                <th>Ancient 달성률</th>
                <th>Relic 달성률</th>
                <th>평균 리롤 사용</th>
                <th>평균 단계</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(comparisonResults)
                .sort(([,a], [,b]) => parseFloat(b.statistics.averageFinalPoints) - parseFloat(a.statistics.averageFinalPoints))
                .map(([strategyKey, data], index) => (
                <tr key={strategyKey} className={index === 0 ? 'strategic-best-strategy' : ''}>
                  <td>{data.strategy.name}</td>
                  <td>{data.statistics.averageFinalPoints.toFixed(2)}</td>
                  <td>{data.statistics.ancientRate.toFixed(1)}%</td>
                  <td>{data.statistics.relicRate.toFixed(1)}%</td>
                  <td>{data.statistics.averageRerollsUsed.toFixed(2)}</td>
                  <td>{data.statistics.averageSteps.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default StrategicSimulation;