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
    mainType: 'DEALER',
    subType: 'CRIT',
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
        const initialGem = createProcessingGem(gemConfig.mainType, gemConfig.subType, gemConfig.grade);
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
      const initialGem = createProcessingGem(gemConfig.mainType, gemConfig.subType, gemConfig.grade);
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
        <div className="loading-message">
          <span className="loading-spinner"></span>
          모듈 로딩 중...
        </div>
      </div>
    );
  }

  return (
    <div className="strategic-simulation-container">
      <div className="strategic-simulation-header">
        <h2 className="strategic-simulation-title">
          🎯 전략적 시뮬레이션
        </h2>
        <div className="mode-toggle">
          <button 
            className={`mode-btn ${!comparisonMode ? 'active' : ''}`}
            onClick={() => setComparisonMode(false)}
          >
            단일 전략
          </button>
          <button 
            className={`mode-btn ${comparisonMode ? 'active' : ''}`}
            onClick={() => setComparisonMode(true)}
          >
            전략 비교
          </button>
        </div>
      </div>

      {/* 젬 설정 */}
      <div className="gem-config-section">
        <h3>젬 설정</h3>
        <div className="gem-config-controls">
          <div className="control-group">
            <label>젬 타입</label>
            <select 
              value={gemConfig.mainType}
              onChange={(e) => setGemConfig(prev => ({ ...prev, mainType: e.target.value }))}
              className="control-input"
            >
              <option value="DEALER">딜러</option>
              <option value="SUPPORT">서포터</option>
            </select>
          </div>
          <div className="control-group">
            <label>서브 타입</label>
            <select 
              value={gemConfig.subType}
              onChange={(e) => setGemConfig(prev => ({ ...prev, subType: e.target.value }))}
              className="control-input"
            >
              <option value="CRIT">치명타</option>
              <option value="SPECIALTY">특성</option>
            </select>
          </div>
          <div className="control-group">
            <label>젬 등급</label>
            <select 
              value={gemConfig.grade}
              onChange={(e) => setGemConfig(prev => ({ ...prev, grade: e.target.value }))}
              className="control-input"
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
          <div className="strategy-selector">
            {Object.entries(strategies).map(([key, strategy]) => (
              <div 
                key={key}
                className={`strategy-card ${selectedStrategy === key ? 'selected' : ''}`}
                onClick={() => setSelectedStrategy(key)}
              >
                <div className="strategy-name">{strategy.name}</div>
                <div className="strategy-description">{strategy.description}</div>
              </div>
            ))}
          </div>

          {/* 시뮬레이션 제어 */}
          <div className="simulation-controls">
            <div className="control-group">
              <label>시뮬레이션 횟수</label>
              <input
                type="number"
                value={simulationCount}
                onChange={(e) => setSimulationCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="control-input"
                min="1"
                max="1000"
              />
            </div>
            <button 
              className="run-simulation-btn"
              onClick={runSingleStrategy}
              disabled={isRunning}
            >
              {isRunning ? (
                <>
                  <span className="loading-spinner"></span>
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
          <div className="comparison-info">
            <p>모든 전략을 동일한 조건으로 비교합니다.</p>
            <div className="simulation-controls">
              <div className="control-group">
                <label>전략당 실행 횟수</label>
                <input
                  type="number"
                  value={Math.floor(simulationCount / Object.keys(strategies).length)}
                  onChange={(e) => setSimulationCount(Math.max(Object.keys(strategies).length, parseInt(e.target.value) * Object.keys(strategies).length))}
                  className="control-input"
                  min="1"
                  max="200"
                />
              </div>
              <button 
                className="run-simulation-btn"
                onClick={runStrategyComparison}
                disabled={isRunning}
              >
                {isRunning ? (
                  <>
                    <span className="loading-spinner"></span>
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
        <div className="simulation-progress">
          <div 
            className="progress-bar"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      )}

      {/* 결과 표시 */}
      {!comparisonMode && results && (
        <div className="simulation-results">
          <h3>시뮬레이션 결과</h3>
          <div className="results-summary">
            <div className="result-card">
              <div className="result-value">{results.averagePoints}</div>
              <div className="result-label">평균 포인트</div>
            </div>
            <div className="result-card">
              <div className="result-value">{results.ancientRate}%</div>
              <div className="result-label">Ancient 달성률</div>
            </div>
            <div className="result-card">
              <div className="result-value">{results.relicRate}%</div>
              <div className="result-label">Relic 달성률</div>
            </div>
            <div className="result-card">
              <div className="result-value">{results.averageRerolls}</div>
              <div className="result-label">평균 리롤 사용</div>
            </div>
          </div>

          {/* 최고/최악 결과 */}
          <div className="extreme-results">
            <div className="extreme-result">
              <h4>최고 결과</h4>
              <p>포인트: {results.bestResult.finalGem.totalPoints} / 단계: {results.bestResult.totalProcessingSteps} / 리롤: {results.bestResult.totalRerollsUsed}</p>
            </div>
            <div className="extreme-result">
              <h4>최악 결과</h4>
              <p>포인트: {results.worstResult.finalGem.totalPoints} / 단계: {results.worstResult.totalProcessingSteps} / 리롤: {results.worstResult.totalRerollsUsed}</p>
            </div>
          </div>

          {/* 의사결정 분석 (첫 번째 시뮬레이션 결과) */}
          {results.rawResults.length > 0 && results.rawResults[0].decisions && (
            <div className="decision-analysis">
              <h4 className="decision-analysis-title">의사결정 분석 (샘플)</h4>
              <div className="decision-timeline">
                {results.rawResults[0].decisions.slice(0, 10).map((decision, index) => (
                  <div key={index} className="decision-step">
                    <div className="step-number">{decision.attempt}</div>
                    <div className="decision-details">
                      <div className="decision-action">
                        {decision.selectedAction}
                        {decision.rerollDecision && <span className="reroll-indicator">리롤</span>}
                      </div>
                      <div className="decision-reason">{decision.selectionReason}</div>
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
        <div className="strategy-comparison">
          <h3 className="comparison-title">전략 비교 결과</h3>
          <table className="comparison-table">
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
                <tr key={strategyKey} className={index === 0 ? 'best-strategy' : ''}>
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