import React, { useState } from 'react';
import './GoalBasedSimulation.css';
import { GOALS, runSimulation, runAllGoalsSimulation } from '../utils/gemProcessingSimulator';

const GoalBasedSimulation = ({ processingGem }) => {
  const [simulationSettings, setSimulationSettings] = useState({
    budget: 100000,
    maxAttempts: 500,
    simulationRuns: 50
  });
  
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [selectedGoal, setSelectedGoal] = useState('ALL_10');
  const [showAllGoals, setShowAllGoals] = useState(true);
  
  // 단일 목표 시뮬레이션
  const handleRunSingleSimulation = async () => {
    if (!processingGem) {
      alert('젬을 먼저 선택해주세요.');
      return;
    }
    
    setIsRunning(true);
    try {
      const result = await runSimulation(processingGem, selectedGoal, simulationSettings);
      setResults({ type: 'single', data: result });
    } catch (error) {
      console.error('시뮬레이션 실행 실패:', error);
      alert('시뮬레이션 실행 중 오류가 발생했습니다.');
    } finally {
      setIsRunning(false);
    }
  };
  
  // 모든 목표 시뮬레이션
  const handleRunAllGoalsSimulation = async () => {
    if (!processingGem) {
      alert('젬을 먼저 선택해주세요.');
      return;
    }
    
    setIsRunning(true);
    try {
      const allResults = await runAllGoalsSimulation(processingGem, simulationSettings);
      setResults({ type: 'all', data: allResults.results, totalApiCalls: allResults.totalApiCalls });
    } catch (error) {
      console.error('시뮬레이션 실행 실패:', error);
      alert('시뮬레이션 실행 중 오류가 발생했습니다.');
    } finally {
      setIsRunning(false);
    }
  };
  
  const formatNumber = (num) => {
    return Math.round(num).toLocaleString() + 'G';
  };

  return (
    <div className="goal-simulation-container">
      <h3>🎯 목표 기반 비용 시뮬레이션</h3>
      
      {/* 시뮬레이션 설정 */}
      <div className="simulation-settings">
        <h4>시뮬레이션 설정</h4>
        
        <div className="setting-row">
          <label>예산: </label>
          <input 
            type="number" 
            value={simulationSettings.budget}
            onChange={(e) => setSimulationSettings({...simulationSettings, budget: parseInt(e.target.value) || 0})}
            step="10000"
          />
          <span className="unit">골드</span>
        </div>
        
        <div className="setting-row">
          <label>최대 시도: </label>
          <input 
            type="number" 
            value={simulationSettings.maxAttempts}
            onChange={(e) => setSimulationSettings({...simulationSettings, maxAttempts: parseInt(e.target.value) || 100})}
            step="50"
          />
          <span className="unit">회</span>
        </div>
        
        <div className="setting-row">
          <label>시뮬레이션 횟수: </label>
          <input 
            type="number" 
            value={simulationSettings.simulationRuns}
            onChange={(e) => setSimulationSettings({...simulationSettings, simulationRuns: parseInt(e.target.value) || 10})}
            step="10"
            min="1"
            max="1000"
          />
          <span className="unit">회</span>
        </div>
      </div>
      
      {/* 시뮬레이션 타입 선택 */}
      <div className="simulation-type-selector">
        <label>
          <input 
            type="checkbox" 
            checked={showAllGoals}
            onChange={(e) => setShowAllGoals(e.target.checked)}
          />
          모든 목표 동시 시뮬레이션
        </label>
        
        {!showAllGoals && (
          <div className="single-goal-selector">
            <label>목표 선택: </label>
            <select 
              value={selectedGoal}
              onChange={(e) => setSelectedGoal(e.target.value)}
            >
              {Object.entries(GOALS).map(([key, name]) => (
                <option key={key} value={key}>{name}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      
      {/* 시뮬레이션 실행 */}
      <div className="simulation-controls">
        <button 
          onClick={showAllGoals ? handleRunAllGoalsSimulation : handleRunSingleSimulation}
          disabled={isRunning || !processingGem}
          className="run-simulation-btn"
        >
          {isRunning ? '시뮬레이션 실행 중...' : '시뮬레이션 시작'}
        </button>
      </div>
      
      {/* 결과 표시 */}
      {results && results.type === 'single' && (
        <div className="simulation-results">
          <h4>📊 시뮬레이션 결과: {results.data.goalName}</h4>
          
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">성공률</div>
              <div className="stat-value success-rate">
                {results.data.successRate.toFixed(2)}%
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-label">평균 비용</div>
              <div className="stat-value avg-cost">
                {formatNumber(results.data.avgCost)}
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-label">성공 시 평균 비용</div>
              <div className="stat-value success-cost">
                {results.data.avgSuccessCost > 0 ? formatNumber(results.data.avgSuccessCost) : 'N/A'}
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-label">평균 시도</div>
              <div className="stat-value avg-attempts">
                {Math.round(results.data.avgAttempts)}회
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 모든 목표 결과 표 */}
      {results && results.type === 'all' && (
        <div className="simulation-results">
          <h4>📊 모든 목표 시뮬레이션 결과</h4>
          
          {results.totalApiCalls && (
            <div className="api-call-summary">
              <span>총 API 호출: <strong>{results.totalApiCalls.toLocaleString()}</strong>회</span>
            </div>
          )}
          
          <div className="results-table-container">
            <table className="all-goals-table">
              <thead>
                <tr>
                  <th>목표</th>
                  <th>성공률</th>
                  <th>평균 비용</th>
                  <th>성공 시 평균</th>
                  <th>평균 시도</th>
                  <th>최소 비용</th>
                  <th>최대 비용</th>
                  <th>API 호출</th>
                </tr>
              </thead>
              <tbody>
                {results.data
                  .sort((a, b) => b.successRate - a.successRate)
                  .map(result => (
                    <tr key={result.goalKey} className={result.successRate > 50 ? 'high-success' : result.successRate > 20 ? 'mid-success' : 'low-success'}>
                      <td className="goal-name">{result.goalName}</td>
                      <td className="success-rate">
                        <span className="rate-value">{result.successRate.toFixed(2)}%</span>
                        <div className="rate-bar">
                          <div 
                            className="rate-fill" 
                            style={{ width: `${result.successRate}%` }}
                          />
                        </div>
                      </td>
                      <td className="avg-cost">{formatNumber(result.avgCost)}</td>
                      <td className="success-cost">
                        {result.avgSuccessCost > 0 ? formatNumber(result.avgSuccessCost) : '-'}
                      </td>
                      <td className="avg-attempts">{Math.round(result.avgAttempts)}</td>
                      <td className="min-cost">{formatNumber(result.minCost)}</td>
                      <td className="max-cost">{formatNumber(result.maxCost)}</td>
                      <td className="api-calls">{result.apiCalls?.toLocaleString() || 0}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          
        </div>
      )}
    </div>
  );
};

export default GoalBasedSimulation;