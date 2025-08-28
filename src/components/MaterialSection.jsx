import './MaterialSection.css';
import { GEM_TYPES } from '../utils/gemConstants';
import { getFusionProbabilities } from '../utils/gemFusion';

function MaterialSection({ materials, setMaterials }) {
  // 젬 타입 조합 옵션
  const gemTypeOptions = [
    { value: 'ORDER_STABLE', label: '질서: 안정' },
    { value: 'ORDER_SOLID', label: '질서: 견고' },
    { value: 'ORDER_IMMUTABLE', label: '질서: 불변' },
    { value: 'CHAOS_EROSION', label: '혼돈: 침식' },
    { value: 'CHAOS_DISTORTION', label: '혼돈: 왜곡' },
    { value: 'CHAOS_COLLAPSE', label: '혼돈: 붕괴' }
  ];

  const gradeOptions = [
    { value: 'LEGENDARY', label: '전설' },
    { value: 'RELIC', label: '유물' },
    { value: 'ANCIENT', label: '고대' }
  ];

  // 재료 젬 업데이트
  const updateMaterial = (index, field, value) => {
    const newMaterials = [...materials];
    
    if (field === 'type') {
      const [mainType, subType] = value.split('_');
      newMaterials[index].mainType = mainType;
      newMaterials[index].subType = subType;
    } else {
      newMaterials[index][field] = value;
    }
    
    setMaterials(newMaterials);
  };

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
    <div className="material-section">
      <h2>📦 재료 젬 설정</h2>
      <div className="materials">
        {materials.map((material, index) => (
          <div key={material.id} className="material-card">
            <h3>재료 {index + 1}</h3>
            <div className="material-controls">
              <label>
                젬 타입:
                <select 
                  value={`${material.mainType}_${material.subType}`}
                  onChange={(e) => updateMaterial(index, 'type', e.target.value)}
                >
                  {gemTypeOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                등급:
                <select
                  value={material.grade}
                  onChange={(e) => updateMaterial(index, 'grade', e.target.value)}
                >
                  {gradeOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="material-display">
              {getGradeName(material.grade)} {getGemTypeName(material.mainType, material.subType)}
            </div>
          </div>
        ))}
      </div>
      
      {/* 융합 확률 표시 */}
      <div className="fusion-probability">
        <h3>🎯 융합 확률</h3>
        <div className="probability-grid">
          {(() => {
            const probs = getFusionProbabilities(materials);
            return Object.entries(probs).map(([grade, probability]) => (
              <div key={grade} className={`probability-item ${grade.toLowerCase()}`}>
                <span className="probability-grade">{getGradeName(grade)}</span>
                <span className="probability-value">{(probability * 100).toFixed(1)}%</span>
              </div>
            ));
          })()} 
        </div>
      </div>
    </div>
  );
}

export default MaterialSection;