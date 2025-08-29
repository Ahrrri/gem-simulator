import { useState } from 'react';
import './ProcessingTab.css';
import GemCreationSection from './GemCreationSection';
import ProcessingGemDisplay from './ProcessingGemDisplay';
// import StrategicSimulation from './StrategicSimulation';
// import BatchAnalyzer from './BatchAnalyzer';

function ProcessingTab() {
  // 젬 가공 관련 상태 (내부 관리)
  const [processingGem, setProcessingGem] = useState(null);
  const [processingHistory, setProcessingHistory] = useState([]);
  const [selectedProcessingGrade, setSelectedProcessingGrade] = useState('RARE');
  const [lastProcessingResult, setLastProcessingResult] = useState(null);
  const [totalGoldSpent, setTotalGoldSpent] = useState(0);
  const [individualProbabilityData, setIndividualProbabilityData] = useState(null);
  const [showNormalizedProbability, setShowNormalizedProbability] = useState(false);

  return (
    <div className="processing-tab">
      <div className="processing-sections">
        <GemCreationSection 
          processingGem={processingGem}
          setProcessingGem={setProcessingGem}
          setProcessingHistory={setProcessingHistory}
          setLastProcessingResult={setLastProcessingResult}
          selectedProcessingGrade={selectedProcessingGrade}
          setSelectedProcessingGrade={setSelectedProcessingGrade}
        />
        
        <ProcessingGemDisplay
          processingGem={processingGem}
          setProcessingGem={setProcessingGem}
          processingHistory={processingHistory}
          setProcessingHistory={setProcessingHistory}
          lastProcessingResult={lastProcessingResult}
          setLastProcessingResult={setLastProcessingResult}
          totalGoldSpent={totalGoldSpent}
          setTotalGoldSpent={setTotalGoldSpent}
          individualProbabilityData={individualProbabilityData}
          setIndividualProbabilityData={setIndividualProbabilityData}
          showNormalizedProbability={showNormalizedProbability}
          setShowNormalizedProbability={setShowNormalizedProbability}
        />
      </div>
      
      {/* 전략적 시뮬레이션 섹션 - 개발 중 */}
      {/* <StrategicSimulation /> */}
      
      {/* 배치 분석 섹션 - 개발 중 */}
      {/* <BatchAnalyzer /> */}
    </div>
  );
}

export default ProcessingTab;