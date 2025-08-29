import { useState, useRef, useEffect } from 'react';
import './BatchAnalyzer.css';
import { BatchSimulationRunner, BatchReportGenerator } from '../utils/batchAnalyzer.js';

// 동적 import를 통한 모듈 로딩
let ADVANCED_STRATEGIES = null;

async function loadStrategies() {
  if (!ADVANCED_STRATEGIES) {
    const module = await import('../utils/strategicEngine.js');
    ADVANCED_STRATEGIES = module.ADVANCED_STRATEGIES;
  }
}

function BatchAnalyzer() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ percentage: 0, message: '', completed: 0, total: 0 });
  const [results, setResults] = useState(null);
  const [report, setReport] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [reportFormat, setReportFormat] = useState('structured');
  const [strategiesLoaded, setStrategiesLoaded] = useState(false);
  const [availableStrategies, setAvailableStrategies] = useState({});
  
  const runnerRef = useRef(null);
  
  const [batchConfig, setBatchConfig] = useState({
    strategies: [],
    runsPerStrategy: 50,
    includeBaseline: true,
    gemConfigs: [
      { mainType: 'DEALER', subType: 'CRIT', grade: 'RARE', label: '딜러 치명타 희귀' },
      { mainType: 'DEALER', subType: 'SPECIALTY', grade: 'RARE', label: '딜러 특성 희귀' },
      { mainType: 'SUPPORT', subType: 'CRIT', grade: 'RARE', label: '서포터 치명타 희귀' }
    ]
  });

  // 컴포넌트 마운트 시 전략 로드
  useEffect(() => {
    async function init() {
      await loadStrategies();
      setAvailableStrategies(ADVANCED_STRATEGIES || {});
      setBatchConfig(prev => ({
        ...prev,
        strategies: Object.keys(ADVANCED_STRATEGIES || {})
      }));
      setStrategiesLoaded(true);
    }
    init();
  }, []);

  const handleStrategyToggle = (strategyKey) => {
    setBatchConfig(prev => ({
      ...prev,
      strategies: prev.strategies.includes(strategyKey)
        ? prev.strategies.filter(s => s !== strategyKey)
        : [...prev.strategies, strategyKey]
    }));
  };

  const handleGemConfigChange = (index, field, value) => {
    setBatchConfig(prev => ({
      ...prev,
      gemConfigs: prev.gemConfigs.map((config, i) => 
        i === index ? { ...config, [field]: value } : config
      )
    }));
  };

  const addGemConfig = () => {
    setBatchConfig(prev => ({
      ...prev,
      gemConfigs: [...prev.gemConfigs, { 
        mainType: 'DEALER', 
        subType: 'CRIT', 
        grade: 'RARE', 
        label: `설정 ${prev.gemConfigs.length + 1}` 
      }]
    }));
  };

  const removeGemConfig = (index) => {
    if (batchConfig.gemConfigs.length > 1) {
      setBatchConfig(prev => ({
        ...prev,
        gemConfigs: prev.gemConfigs.filter((_, i) => i !== index)
      }));
    }
  };

  const runBatchAnalysis = async () => {
    if (isRunning || batchConfig.strategies.length === 0) return;

    setIsRunning(true);
    setResults(null);
    setReport(null);
    setShowReport(false);
    setProgress({ percentage: 0, message: '시작 중...', completed: 0, total: 0 });

    try {
      runnerRef.current = new BatchSimulationRunner();
      
      // 진행 상황 콜백 설정
      runnerRef.current.onProgress((progressData) => {
        setProgress(progressData);
      });

      // 배치 실행
      const batchResults = await runnerRef.current.runMultiStrategyBatch(batchConfig);
      
      setResults(batchResults);
      
      // 보고서 생성
      const generatedReport = BatchReportGenerator.generateComprehensiveReport(
        batchResults,
        { format: reportFormat }
      );
      
      setReport(generatedReport);
      setProgress({ 
        percentage: 100, 
        message: '분석 완료!', 
        completed: progress.total, 
        total: progress.total 
      });

    } catch (error) {
      console.error('배치 분석 오류:', error);
      alert(`배치 분석 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsRunning(false);
      runnerRef.current = null;
    }
  };

  const downloadReport = () => {
    if (!report) return;

    const content = reportFormat === 'markdown' ? report : JSON.stringify(report, null, 2);
    const blob = new Blob([content], { 
      type: reportFormat === 'markdown' ? 'text/markdown' : 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gem-strategy-analysis-${new Date().getTime()}.${reportFormat === 'markdown' ? 'md' : 'json'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const totalEstimatedRuns = batchConfig.strategies.length * 
                            batchConfig.gemConfigs.length * 
                            batchConfig.runsPerStrategy +
                            (batchConfig.includeBaseline ? 
                              batchConfig.gemConfigs.length * batchConfig.runsPerStrategy : 0);

  if (!strategiesLoaded) {
    return (
      <div className="batch-analyzer-container">
        <div className="loading-message">
          <span className="loading-spinner"></span>
          전략 로딩 중...
        </div>
      </div>
    );
  }

  return (
    <div className="batch-analyzer-container">
      <div className="batch-analyzer-header">
        <h2 className="batch-analyzer-title">
          📊 배치 분석 시스템
        </h2>
        <div className="analysis-mode-info">
          <span>대량 시뮬레이션 및 통계 분석</span>
        </div>
      </div>

      {/* 분석 설정 */}
      <div className="analysis-configuration">
        <div className="config-section">
          <h3>전략 선택</h3>
          <div className="strategy-checkboxes">
            {Object.entries(availableStrategies).map(([key, strategy]) => (
              <label key={key} className="strategy-checkbox">
                <input
                  type="checkbox"
                  checked={batchConfig.strategies.includes(key)}
                  onChange={() => handleStrategyToggle(key)}
                  disabled={isRunning}
                />
                <span className="checkbox-label">{strategy.name}</span>
              </label>
            ))}
          </div>
          
          <label className="strategy-checkbox baseline-option">
            <input
              type="checkbox"
              checked={batchConfig.includeBaseline}
              onChange={(e) => setBatchConfig(prev => ({ ...prev, includeBaseline: e.target.checked }))}
              disabled={isRunning}
            />
            <span className="checkbox-label">베이스라인 전략 포함 (랜덤 선택)</span>
          </label>
        </div>

        <div className="config-section">
          <h3>젬 설정</h3>
          {batchConfig.gemConfigs.map((config, index) => (
            <div key={index} className="gem-config-row">
              <input
                type="text"
                value={config.label}
                onChange={(e) => handleGemConfigChange(index, 'label', e.target.value)}
                className="config-input label-input"
                placeholder="설정 이름"
                disabled={isRunning}
              />
              <select
                value={config.mainType}
                onChange={(e) => handleGemConfigChange(index, 'mainType', e.target.value)}
                className="config-input"
                disabled={isRunning}
              >
                <option value="DEALER">딜러</option>
                <option value="SUPPORT">서포터</option>
              </select>
              <select
                value={config.subType}
                onChange={(e) => handleGemConfigChange(index, 'subType', e.target.value)}
                className="config-input"
                disabled={isRunning}
              >
                <option value="CRIT">치명타</option>
                <option value="SPECIALTY">특성</option>
              </select>
              <select
                value={config.grade}
                onChange={(e) => handleGemConfigChange(index, 'grade', e.target.value)}
                className="config-input"
                disabled={isRunning}
              >
                <option value="UNCOMMON">고급</option>
                <option value="RARE">희귀</option>
                <option value="HEROIC">영웅</option>
              </select>
              <button
                onClick={() => removeGemConfig(index)}
                className="remove-config-btn"
                disabled={isRunning || batchConfig.gemConfigs.length === 1}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            onClick={addGemConfig}
            className="add-config-btn"
            disabled={isRunning}
          >
            + 젬 설정 추가
          </button>
        </div>

        <div className="config-section">
          <h3>실행 설정</h3>
          <div className="execution-controls">
            <div className="control-group">
              <label>전략당 실행 횟수</label>
              <input
                type="number"
                value={batchConfig.runsPerStrategy}
                onChange={(e) => setBatchConfig(prev => ({ 
                  ...prev, 
                  runsPerStrategy: Math.max(1, parseInt(e.target.value) || 1) 
                }))}
                className="config-input"
                min="1"
                max="500"
                disabled={isRunning}
              />
            </div>
            <div className="control-group">
              <label>보고서 형식</label>
              <select
                value={reportFormat}
                onChange={(e) => setReportFormat(e.target.value)}
                className="config-input"
                disabled={isRunning}
              >
                <option value="structured">구조화된 데이터</option>
                <option value="markdown">마크다운</option>
                <option value="json">JSON</option>
              </select>
            </div>
          </div>
          
          <div className="estimation-info">
            <div className="estimation-card">
              <div className="estimation-value">{totalEstimatedRuns.toLocaleString()}</div>
              <div className="estimation-label">총 예상 실행 횟수</div>
            </div>
            <div className="estimation-card">
              <div className="estimation-value">~{Math.ceil(totalEstimatedRuns / 100)}</div>
              <div className="estimation-label">예상 소요 시간 (분)</div>
            </div>
          </div>
        </div>
      </div>

      {/* 실행 제어 */}
      <div className="execution-section">
        <button 
          className="run-batch-btn"
          onClick={runBatchAnalysis}
          disabled={isRunning || batchConfig.strategies.length === 0}
        >
          {isRunning ? (
            <>
              <span className="loading-spinner"></span>
              분석 실행 중...
            </>
          ) : (
            '배치 분석 실행'
          )}
        </button>
        
        {batchConfig.strategies.length === 0 && (
          <div className="warning-message">
            최소 하나의 전략을 선택해주세요.
          </div>
        )}
      </div>

      {/* 진행 상황 */}
      {isRunning && (
        <div className="progress-section">
          <div className="progress-info">
            <span className="progress-text">{progress.message}</span>
            <span className="progress-numbers">
              {progress.completed.toLocaleString()} / {progress.total.toLocaleString()}
            </span>
          </div>
          <div className="progress-bar-container">
            <div 
              className="progress-bar"
              style={{ width: `${progress.percentage}%` }}
            ></div>
          </div>
          <div className="progress-percentage">{progress.percentage.toFixed(1)}%</div>
        </div>
      )}

      {/* 결과 요약 */}
      {results && !isRunning && (
        <div className="results-section">
          <div className="results-header">
            <h3>분석 완료</h3>
            <div className="results-actions">
              <button
                onClick={() => setShowReport(!showReport)}
                className="toggle-report-btn"
              >
                {showReport ? '요약 보기' : '상세 보고서 보기'}
              </button>
              {report && (
                <button
                  onClick={downloadReport}
                  className="download-report-btn"
                >
                  📥 보고서 다운로드
                </button>
              )}
            </div>
          </div>

          {!showReport ? (
            <div className="results-summary">
              <div className="summary-stats">
                <div className="summary-card">
                  <div className="summary-value">{results.length}</div>
                  <div className="summary-label">젬 설정 수</div>
                </div>
                <div className="summary-card">
                  <div className="summary-value">
                    {results.reduce((sum, config) => sum + Object.keys(config.strategies).length, 0)}
                  </div>
                  <div className="summary-label">전략 테스트 수</div>
                </div>
                <div className="summary-card">
                  <div className="summary-value">
                    {results.reduce((sum, config) => 
                      sum + Object.values(config.strategies).reduce((s, strategy) => 
                        s + strategy.results.length, 0), 0
                    ).toLocaleString()}
                  </div>
                  <div className="summary-label">총 시뮬레이션</div>
                </div>
              </div>

              {/* 최고 성능 전략 */}
              {report && report.summary && (
                <div className="best-strategy-highlight">
                  <h4>최고 성능 전략</h4>
                  <div className="best-strategy-info">
                    <div className="strategy-name">{report.summary.bestStrategy.name}</div>
                    <div className="strategy-stats">
                      평균 {report.summary.bestStrategy.avgPoints.toFixed(2)}점 | 
                      Ancient 달성률 {report.summary.bestStrategy.ancientRate.toFixed(1)}%
                    </div>
                  </div>
                </div>
              )}

              {/* 주요 발견사항 */}
              {report && report.summary && report.summary.keyFindings.length > 0 && (
                <div className="key-findings">
                  <h4>주요 발견사항</h4>
                  <ul className="findings-list">
                    {report.summary.keyFindings.map((finding, index) => (
                      <li key={index} className={`finding-item ${finding.importance}`}>
                        <span className="finding-type">{finding.type}</span>
                        <span className="finding-message">{finding.message}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="detailed-report">
              {reportFormat === 'markdown' ? (
                <pre className="markdown-report">{report}</pre>
              ) : (
                <div className="structured-report">
                  {/* 전략 비교 표 */}
                  {report.comparison && (
                    <div className="comparison-section">
                      <h4>전략 성능 비교</h4>
                      <table className="comparison-table">
                        <thead>
                          <tr>
                            <th>전략</th>
                            <th>평균 점수</th>
                            <th>Ancient 달성률</th>
                            <th>일관성 점수</th>
                            <th>총 실행 수</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(report.comparison)
                            .sort(([,a], [,b]) => b.overallAvgPoints - a.overallAvgPoints)
                            .map(([key, data], index) => (
                            <tr key={key} className={index === 0 ? 'best-strategy-row' : ''}>
                              <td>{data.name}</td>
                              <td>{data.overallAvgPoints.toFixed(2)}</td>
                              <td>{data.overallAncientRate.toFixed(1)}%</td>
                              <td>{(data.consistencyScore * 100).toFixed(1)}%</td>
                              <td>{data.totalRuns.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* 인사이트 */}
                  {report.insights && report.insights.length > 0 && (
                    <div className="insights-section">
                      <h4>분석 인사이트</h4>
                      {report.insights.map((insight, index) => (
                        <div key={index} className="insight-card">
                          <h5>{insight.title}</h5>
                          <p>{insight.message}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 권장사항 */}
                  {report.recommendations && (
                    <div className="recommendations-section">
                      <h4>권장사항</h4>
                      {report.recommendations.map((rec, index) => (
                        <div key={index} className={`recommendation-card ${rec.type}`}>
                          <h5>{rec.title}</h5>
                          <p>{rec.message}</p>
                          <small>{rec.reason}</small>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default BatchAnalyzer;