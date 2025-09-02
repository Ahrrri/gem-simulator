import { useState } from 'react';
import './ProcessingTab.css';
import GemCreationSection from './GemCreationSection';
import ProcessingGemDisplay from './ProcessingGemDisplay';
import ImageCapture from './ImageCapture';
import GoalBasedSimulation from './GoalBasedSimulation';
import { recognizeGemFromImage, convertToSimulatorFormat } from '../utils/gemImageRecognition';
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
  
  // 이미지 인식 관련 상태
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recognitionError, setRecognitionError] = useState(null);
  const [ocrProgress, setOcrProgress] = useState(0);

  // 이미지 캡처 후 젬 정보 인식 처리
  const handleImageCaptured = async (imageDataUrl) => {
    try {
      setIsRecognizing(true);
      setRecognitionError(null);
      setOcrProgress(0);
      
      console.log('이미지 캡처 완료, 인식 시작...');
      
      // 이미지에서 젬 정보 인식 (개선된 옵션 사용)
      const recognizedGem = await recognizeGemFromImage(imageDataUrl, {
        usePreprocess: true,
        preprocessOptions: {
          scale: 2, // 2배 확대
          sharpen: true, // 선명도 향상
          denoise: true, // 노이즈 제거
          binarize: false // 이진화는 배경이 복잡한 경우 비활성화
        },
        ocrConfig: {
          tessedit_char_whitelist: '0123456789가-힣ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz%+:. ', // 인식할 문자 제한
        }
      });
      
      // 인식된 정보를 시뮬레이터 형식으로 변환
      const convertedGem = convertToSimulatorFormat(recognizedGem);
      
      if (convertedGem) {
        // 인식된 젬을 processingGem으로 설정
        setProcessingGem(convertedGem);
        console.log('젬 정보 자동 업데이트 완료:', convertedGem);
        
        // 성공 메시지 표시 (잠시 후 자동 제거)
        setTimeout(() => {
          setOcrProgress(0);
        }, 3000);
      }
      
    } catch (error) {
      console.error('이미지 인식 실패:', error);
      setRecognitionError('이미지에서 젬 정보를 인식하지 못했습니다. 더 선명한 이미지로 다시 시도해주세요.');
    } finally {
      setIsRecognizing(false);
    }
  };

  return (
    <div className="processing-tab">
      {/* 이미지 캡처 섹션 */}
      <div className="image-capture-section">
        <h3>🖼️ 젬 이미지 자동 인식</h3>
        <ImageCapture onImageCaptured={handleImageCaptured} />
        
        {/* 인식 상태 표시 */}
        {isRecognizing && (
          <div className="recognition-status">
            <span>🔍 젬 정보 인식 중...</span>
          </div>
        )}
        
        {recognitionError && (
          <div className="recognition-error">
            <span>❌ {recognitionError}</span>
          </div>
        )}
      </div>
      
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
      
      {/* 목표 기반 시뮬레이션 섹션 */}
      <GoalBasedSimulation processingGem={processingGem} />
      
      {/* 배치 분석 섹션 - 개발 중 */}
      {/* <BatchAnalyzer /> */}
    </div>
  );
}

export default ProcessingTab;