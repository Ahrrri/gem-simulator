import './FusionStatistics.css';
import { GEM_TYPES } from '../utils/gemConstants';

function FusionStatistics({ statistics, allResults, selectedCombo, setSelectedCombo }) {
  const getGradeName = (grade) => {
    const gradeNames = {
      LEGENDARY: '전설',
      RELIC: '유물',
      ANCIENT: '고대'
    };
    return gradeNames[grade] || grade;
  };

  const getGemTypeName = (mainType, subType) => {
    if (mainType === 'ORDER') {
      return `질서의 젬: ${GEM_TYPES.ORDER[subType]}`;
    } else {
      return `혼돈의 젬: ${GEM_TYPES.CHAOS[subType]}`;
    }
  };

  // 특정 조합의 예시 젬들 가져오기 (랜덤 선택)
  const getComboExamples = (combo) => {
    const [targetW, targetC] = combo.split('/').map(Number);
    const filtered = allResults
      .filter(gem => gem.willpower === targetW && gem.corePoint === targetC);
    
    // 랜덤으로 최대 5개 선택
    const shuffled = [...filtered].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 5);
  };

  // 조합 클릭 핸들러
  const handleComboClick = (combo) => {
    setSelectedCombo(selectedCombo === combo ? null : combo);
  };

  return (
    <div className="statistics-section">
      <h2>📊 통계</h2>
      <div className="stats-compact">
        <div className="stat-row">
          <span>총 시도: <strong>{statistics.totalRuns}</strong></span>
          <span>평균: <strong>{statistics.averagePoints.toFixed(1)}pt</strong></span>
          <span>전설: <strong>{(statistics.gradeDistribution.LEGENDARY / statistics.totalRuns * 100).toFixed(1)}%</strong></span>
          <span>유물: <strong>{(statistics.gradeDistribution.RELIC / statistics.totalRuns * 100).toFixed(1)}%</strong></span>
          <span>고대: <strong>{(statistics.gradeDistribution.ANCIENT / statistics.totalRuns * 100).toFixed(1)}%</strong></span>
        </div>
        <div className="stat-row">
          <span>총 골드: <strong>{statistics.totalGoldSpent ? statistics.totalGoldSpent.toLocaleString() : '0'}</strong></span>
          <span>평균 골드: <strong>{statistics.averageGoldSpent ? statistics.averageGoldSpent.toFixed(0) : '0'}</strong></span>
        </div>
      </div>

      {/* 의지력/코어포인트 조합 분포 */}
      <div className="combo-section">
        <h3>의지력/코어포인트 조합</h3>
        <div className="combo-grid">
          {Object.entries(statistics.willpowerCoreDistribution)
            .sort((a, b) => {
              const [w1, c1] = a[0].split('/').map(Number);
              const [w2, c2] = b[0].split('/').map(Number);
              return (w2 + c2) - (w1 + c1) || w2 - w1;
            })
            .map(([combo, count]) => {
              const percentage = (count / statistics.totalRuns * 100);
              const [w, c] = combo.split('/').map(Number);
              const isPerfect = w === 5 && c === 5;
              const isGood = w >= 4 && c >= 4;
              return (
                <div 
                  key={combo} 
                  className={`combo-item ${isPerfect ? 'perfect' : isGood ? 'good' : ''} ${selectedCombo === combo ? 'selected' : ''}`}
                  onClick={() => handleComboClick(combo)}
                >
                  <div className="combo-label">{combo}</div>
                  <div className="combo-value">{count}</div>
                  <div className="combo-percent">{percentage.toFixed(2)}%</div>
                </div>
              );
            })}
        </div>
        
        {/* 선택된 조합의 예시 */}
        {selectedCombo && (
          <div className="combo-examples">
            <h4>{selectedCombo} 조합 예시</h4>
            <div className="examples-grid">
              {getComboExamples(selectedCombo).map((gem, index) => (
                <div key={index} className="example-gem">
                  <div className="example-header">
                    <span className={`example-grade ${gem.grade.toLowerCase()}`}>
                      {getGradeName(gem.grade)}
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
            {getComboExamples(selectedCombo).length === 0 && (
              <div className="no-examples">이 조합의 예시가 없습니다.</div>
            )}
          </div>
        )}
      </div>

      {/* 포인트 분포 히스토그램 */}
      <div className="histogram-section">
        <h3>포인트 분포 히스토그램</h3>
        <div className="histogram">
          {Object.entries(statistics.pointDistribution)
            .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
            .map(([points, count]) => {
              const percentage = (count / statistics.totalRuns * 100);
              const maxCount = Math.max(...Object.values(statistics.pointDistribution));
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

export default FusionStatistics;