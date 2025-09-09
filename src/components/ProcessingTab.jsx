import { useState } from 'react';
import './ProcessingTab.css';
import GemCreationSection from './GemCreationSection';
import ProcessingGemDisplay from './ProcessingGemDisplay';
import ImageCapture from './ImageCapture';
import { convertOCRResultsToGem } from '../utils/gemImageRecognition';
// import BatchAnalyzer from './BatchAnalyzer';

function ProcessingTab() {
  // 젬 가공 관련 상태 (내부 관리)
  const [processingGem, setProcessingGem] = useState(null);
  const [processingHistory, setProcessingHistory] = useState([]);
  const [selectedProcessingGrade, setSelectedProcessingGrade] = useState('RARE');
  const [lastProcessingResult, setLastProcessingResult] = useState(null);
  const [totalGoldSpent, setTotalGoldSpent] = useState(0);
  const [individualProbabilityData, setIndividualProbabilityData] = useState(null);
  const [showDisplayProbability, setShowDisplayProbability] = useState(false);
  const [showNormalizedProbability, setShowNormalizedProbability] = useState(false);
  
  // 젬 생성 방식 상태 (auto: OCR 자동 생성, manual: 수동 입력)
  const [gemCreationMode, setGemCreationMode] = useState('auto');
  
  // 히스토리 선택 인덱스 상태
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState(null);
  

  // 이미지 캡처 후 젬 정보 인식 처리
  const handleImageCaptured = async (ocrResults) => {
    try {
      console.log('OCR 결과 수신:', ocrResults);
      
      if (ocrResults) {
        // OCR 결과를 젬 정보로 변환
        const convertedGem = convertOCRResultsToGem(ocrResults);
        
        if (convertedGem) {
          // 인식된 젬을 processingGem으로 설정
          setProcessingGem(convertedGem);
          console.log('젬 정보 자동 업데이트 완료:', convertedGem);
        } else {
          console.warn('OCR 결과를 젬 정보로 변환 실패');
        }
      }
      
    } catch (error) {
      console.error('젬 정보 변환 실패:', error);
    }
  };

  return (
    <div className="processing-tab">
      {/* 젬 생성 방식 선택 */}
      <div className="gem-creation-mode-selector">
        <div className="mode-buttons">
          <button
            className={`mode-btn ${gemCreationMode === 'auto' ? 'active' : ''}`}
            onClick={() => setGemCreationMode('auto')}
          >
            🖼️ 이미지 자동 인식
          </button>
          <button
            className={`mode-btn ${gemCreationMode === 'manual' ? 'active' : ''}`}
            onClick={() => setGemCreationMode('manual')}
          >
            ✏️ 수동 입력
          </button>
        </div>
      </div>

      {/* OCR 자동 인식 섹션 */}
      {gemCreationMode === 'auto' && (
        <div className="image-capture-section">
          <ImageCapture onImageCaptured={handleImageCaptured} />
        </div>
      )}

      {/* 수동 입력 섹션 */}
      {gemCreationMode === 'manual' && (
        <div className="manual-creation-section">
          <GemCreationSection 
            processingGem={processingGem}
            setProcessingGem={setProcessingGem}
            setProcessingHistory={setProcessingHistory}
            setLastProcessingResult={setLastProcessingResult}
            selectedProcessingGrade={selectedProcessingGrade}
            setSelectedProcessingGrade={setSelectedProcessingGrade}
            setSelectedHistoryIndex={setSelectedHistoryIndex}
          />
        </div>
      )}
      
      <div className="processing-sections">
        
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
          showDisplayProbability={showDisplayProbability}
          setShowDisplayProbability={setShowDisplayProbability}
          showNormalizedProbability={showNormalizedProbability}
          setShowNormalizedProbability={setShowNormalizedProbability}
          selectedHistoryIndex={selectedHistoryIndex}
          setSelectedHistoryIndex={setSelectedHistoryIndex}
        />
      </div>
    </div>
  );
}

export default ProcessingTab;