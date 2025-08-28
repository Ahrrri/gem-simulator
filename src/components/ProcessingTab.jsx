import { useState } from 'react';
import './ProcessingTab.css';
import GemCreationSection from './GemCreationSection';
import ProcessingGemDisplay from './ProcessingGemDisplay';

function ProcessingTab() {
  // 젬 가공 관련 상태 (내부 관리)
  const [processingGem, setProcessingGem] = useState(null);
  const [processingHistory, setProcessingHistory] = useState([]);
  const [selectedProcessingGrade, setSelectedProcessingGrade] = useState('RARE');
  const [lastProcessingResult, setLastProcessingResult] = useState(null);
  const [totalGoldSpent, setTotalGoldSpent] = useState(0);
  const [individualProbabilityData, setIndividualProbabilityData] = useState(null);

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
        />
      </div>
    </div>
  );
}

export default ProcessingTab;