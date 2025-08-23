import './ProcessingStatistics.css';
import { calculateAttemptWiseOptionStats } from '../utils/gemProcessing';

function ProcessingStatistics({ 
  processingStatistics, 
  processingSimulationResults, 
  selectedProcessingCombo, 
  setSelectedProcessingCombo 
}) {
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
          <span>평균 첫 번째 효과: <strong>{processingStatistics.averageEffect1Level ? processingStatistics.averageEffect1Level.toFixed(3) : '0.000'}</strong></span>
          <span>평균 두 번째 효과: <strong>{processingStatistics.averageEffect2Level ? processingStatistics.averageEffect2Level.toFixed(3) : '0.000'}</strong></span>
        </div>
        <div className="stat-row">
          <span>전설: <strong>{(processingStatistics.gradeDistribution.LEGENDARY / processingStatistics.totalRuns * 100).toFixed(2)}%</strong></span>
          <span>유물: <strong>{(processingStatistics.gradeDistribution.RELIC / processingStatistics.totalRuns * 100).toFixed(2)}%</strong></span>
          <span>고대: <strong>{(processingStatistics.gradeDistribution.ANCIENT / processingStatistics.totalRuns * 100).toFixed(2)}%</strong></span>
        </div>
        <div className="stat-row">
          <span>평균 골드: <strong>{processingStatistics.averageGoldSpent ? processingStatistics.averageGoldSpent.toFixed(0) : '0'}</strong></span>
          <span>최소 골드: <strong>{processingStatistics.minGoldSpent ? processingStatistics.minGoldSpent.toFixed(0) : '0'}</strong></span>
          <span>최대 골드: <strong>{processingStatistics.maxGoldSpent ? processingStatistics.maxGoldSpent.toFixed(0) : '0'}</strong></span>
        </div>
        <div className="stat-row">
          <span>전설 평균 골드: <strong>{processingStatistics.gradeGoldAverage?.LEGENDARY ? processingStatistics.gradeGoldAverage.LEGENDARY.toFixed(0) : '0'}</strong></span>
          <span>유물 평균 골드: <strong>{processingStatistics.gradeGoldAverage?.RELIC ? processingStatistics.gradeGoldAverage.RELIC.toFixed(0) : '0'}</strong></span>
          <span>고대 평균 골드: <strong>{processingStatistics.gradeGoldAverage?.ANCIENT ? processingStatistics.gradeGoldAverage.ANCIENT.toFixed(0) : '0'}</strong></span>
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
  );
}

export default ProcessingStatistics;