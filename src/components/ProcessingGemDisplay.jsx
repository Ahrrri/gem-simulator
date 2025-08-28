import { useState, useEffect } from 'react';
import './ProcessingGemDisplay.css';
import { 
  calculateProbabilities, 
  generateFullProbabilityTable, 
  saveProbabilityTable, 
  loadProbabilityTable
} from '../utils/gemProbabilityCalculator';
import { GEM_TYPES, GEM_EFFECTS, GEM_GRADES, gemStateToKey } from '../utils/gemConstants';

function ProcessingGemDisplay({
  processingGem,
  setProcessingGem,
  processingHistory,
  setProcessingHistory,
  lastProcessingResult,
  setLastProcessingResult,
  totalGoldSpent,
  setTotalGoldSpent,
  individualProbabilityData,
  setIndividualProbabilityData
}) {
  const [probabilityTable, setProbabilityTable] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculationProgress, setCalculationProgress] = useState(null);
  const [currentProbabilities, setCurrentProbabilities] = useState(null);

  // 젬이 변경될 때마다 현재 확률 계산
  useEffect(() => {
    if (processingGem && probabilityTable) {
      const key = gemStateToKey(processingGem);
      const probData = probabilityTable[key];
      setCurrentProbabilities(probData ? probData.probabilities : null);
    }
  }, [processingGem, probabilityTable]);

  // 젬 타입 이름 가져오기
  const getGemTypeName = (mainType, subType) => {
    if (mainType === 'ORDER') {
      return `질서의 젬: ${GEM_TYPES.ORDER[subType]}`;
    } else {
      return `혼돈의 젬: ${GEM_TYPES.CHAOS[subType]}`;
    }
  };

  // 등급 이름 가져오기
  const getGradeName = (grade) => {
    const gradeNames = {
      UNCOMMON: '고급',
      RARE: '희귀',
      HEROIC: '영웅',
      LEGENDARY: '전설',
      RELIC: '유물', 
      ANCIENT: '고대'
    };
    return gradeNames[grade] || grade;
  };

  // 옵션 이름 매핑 (4개 옵션을 실제 효과명으로)
  const getEffectName = (gem, optionType) => {
    if (!gem.mainType || !gem.subType) return optionType;
    
    const effects = GEM_EFFECTS[gem.mainType][gem.subType];
    const index = {
      'dealerA': 0,
      'dealerB': 1, 
      'supportA': 2,
      'supportB': 3
    }[optionType];
    
    return effects[index] || optionType;
  };

  // 전체 확률 테이블 계산
  const handleCalculateTable = () => {
    setIsCalculating(true);
    
    try {
      const table = generateFullProbabilityTable();
      setProbabilityTable(table);
      console.log(`✅ 확률 테이블 계산 완료: ${Object.keys(table).length}개 상태`);
    } catch (error) {
      console.error('확률 테이블 계산 실패:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  // 확률 테이블 저장
  const handleSaveTable = () => {
    if (probabilityTable) {
      saveProbabilityTable(probabilityTable);
    }
  };

  // 확률 테이블 로드
  const handleLoadTable = (event) => {
    const file = event.target.files[0];
    if (file) {
      loadProbabilityTable(file)
        .then(table => {
          setProbabilityTable(table);
          console.log(`✅ 확률 테이블 로드 완료: ${Object.keys(table).length}개 상태`);
        })
        .catch(error => {
          console.error('확률 테이블 로드 실패:', error);
        });
    }
  };

  if (!processingGem) {
    return (
      <div className="processing-gem-display">
        <h2>젬 가공</h2>
        <p>가공할 젬을 선택해주세요.</p>
        
        <div className="probability-table-controls">
          <button 
            onClick={handleCalculateTable} 
            disabled={isCalculating}
            className="calculate-table-btn"
          >
            {isCalculating ? '계산 중...' : '확률 테이블 계산하기'}
          </button>
          
          {probabilityTable && (
            <button 
              onClick={handleSaveTable}
              className="save-table-btn"
            >
              확률 테이블 저장하기
            </button>
          )}
          
          <label className="load-table-btn">
            확률 테이블 불러오기
            <input 
              type="file" 
              accept=".json" 
              onChange={handleLoadTable}
              style={{ display: 'none' }}
            />
          </label>
        </div>

        {isCalculating && calculationProgress && (
          <div className="calculation-progress">
            <p>계산 진행: {calculationProgress.completed}개 상태 완료</p>
            <p>현재 처리 중: {calculationProgress.current}</p>
          </div>
        )}

        {probabilityTable && (
          <div className="table-status">
            <p>✅ 확률 테이블 준비됨 ({Object.keys(probabilityTable).length}개 상태)</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="processing-gem-display">
      <h2>젬 가공</h2>
      
      {/* 젬 정보 */}
      <div className="gem-info">
        <h3>{getGemTypeName(processingGem.mainType, processingGem.subType)}</h3>
        <p>등급: {getGradeName(processingGem.grade)}</p>
        <p>의지력: {processingGem.willpower} | 코어포인트: {processingGem.corePoint}</p>
        
        {/* 4개 옵션 표시 */}
        <div className="gem-options">
          <h4>현재 옵션:</h4>
          {['dealerA', 'dealerB', 'supportA', 'supportB'].map(optionType => {
            const level = processingGem[optionType] || 0;
            if (level > 0) {
              return (
                <div key={optionType} className="option-item">
                  {getEffectName(processingGem, optionType)}: {level}
                </div>
              );
            }
            return null;
          })}
        </div>
        
        <p>남은 시도: {processingGem.remainingAttempts}</p>
        <p>리롤 횟수: {processingGem.currentRerollAttempts || 0}</p>
      </div>

      {/* 확률 테이블 컨트롤 */}
      <div className="probability-table-controls">
        <button 
          onClick={handleCalculateTable} 
          disabled={isCalculating}
          className="calculate-table-btn"
        >
          {isCalculating ? '계산 중...' : '확률 테이블 계산하기'}
        </button>
        
        {probabilityTable && (
          <button 
            onClick={handleSaveTable}
            className="save-table-btn"
          >
            확률 테이블 저장하기
          </button>
        )}
        
        <label className="load-table-btn">
          확률 테이블 불러오기
          <input 
            type="file" 
            accept=".json" 
            onChange={handleLoadTable}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {isCalculating && calculationProgress && (
        <div className="calculation-progress">
          <p>계산 진행: {calculationProgress.completed}개 상태 완료</p>
          <p>현재 처리 중: {calculationProgress.current}</p>
        </div>
      )}

      {/* 현재 젬 상태의 확률 표시 */}
      {currentProbabilities && (
        <div className="current-probabilities">
          <h4>현재 상태 기준 목표 달성 확률:</h4>
          <div className="probability-list">
            {Object.entries(currentProbabilities).map(([target, probability]) => (
              <div key={target} className="probability-item">
                <span className="target">{target}</span>: 
                <span className="probability">{(probability * 100).toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!probabilityTable && (
        <div className="no-table-message">
          <p>확률을 확인하려면 먼저 확률 테이블을 계산하거나 불러와주세요.</p>
        </div>
      )}
    </div>
  );
}

export default ProcessingGemDisplay;