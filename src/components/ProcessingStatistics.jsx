import './ProcessingStatistics.css';

function ProcessingStatistics({ 
  processingStatistics 
}) {

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