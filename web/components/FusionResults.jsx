import './FusionResults.css';
import { GEM_TYPES } from '../utils/gemConstants';

function FusionResults({ currentResult }) {
  const getGemTypeName = (mainType, subType) => {
    if (mainType === 'ORDER') {
      return `질서의 젬: ${GEM_TYPES.ORDER[subType]}`;
    } else {
      return `혼돈의 젬: ${GEM_TYPES.CHAOS[subType]}`;
    }
  };

  const getGradeName = (grade) => {
    const gradeNames = {
      LEGENDARY: '전설',
      RELIC: '유물',
      ANCIENT: '고대'
    };
    return gradeNames[grade] || grade;
  };

  return (
    <div className="result-section">
      <h2>융합 결과</h2>
      <div className={`result-card ${currentResult.grade.toLowerCase()}`}>
        <div className="result-grade">{getGradeName(currentResult.grade)}</div>
        <div className="result-type">
          {getGemTypeName(currentResult.mainType, currentResult.subType)}
        </div>
        <div className="result-points">
          <div className="point-item">
            <span className="point-label">총 포인트:</span>
            <span className="point-value">{currentResult.totalPoints}</span>
          </div>
          <div className="point-item">
            <span className="point-label">의지력 효율:</span>
            <span className={`point-value ${currentResult.willpower === 5 ? 'max' : ''}`}>
              {currentResult.willpower}
            </span>
          </div>
          <div className="point-item">
            <span className="point-label">{currentResult.mainType === 'ORDER' ? '질서' : '혼돈'} 포인트:</span>
            <span className={`point-value ${currentResult.corePoint === 5 ? 'max' : ''}`}>
              {currentResult.corePoint}
            </span>
          </div>
          <div className="point-item">
            <span className="point-label">{currentResult.effect1.name}:</span>
            <span className={`point-value ${currentResult.effect1.level === 5 ? 'max' : ''}`}>
              Lv.{currentResult.effect1.level}
            </span>
          </div>
          <div className="point-item">
            <span className="point-label">{currentResult.effect2.name}:</span>
            <span className={`point-value ${currentResult.effect2.level === 5 ? 'max' : ''}`}>
              Lv.{currentResult.effect2.level}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FusionResults;