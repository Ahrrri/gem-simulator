import React, { useState, useRef } from 'react';
import './ImageCapture.css';
import MultiAreaCropper from './MultiAreaCropper';
import Tesseract from 'tesseract.js';

// 이미지 영역 크롭 함수
const cropImageArea = (imageDataUrl, cropArea) => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = cropArea.width;
      canvas.height = cropArea.height;
      
      ctx.drawImage(
        img, 
        cropArea.x, cropArea.y, cropArea.width, cropArea.height,
        0, 0, cropArea.width, cropArea.height
      );
      
      resolve(canvas.toDataURL('image/png'));
    };
    
    img.src = imageDataUrl;
  });
};

// 영역별 OCR 실행 함수
const performOCROnArea = async (croppedImageUrl, areaId) => {
  const { data: { text } } = await Tesseract.recognize(croppedImageUrl, 'kor+eng', {
    logger: m => console.log(`${areaId} OCR:`, m)
  });
  
  return {
    areaId,
    text: text.trim(),
    confidence: 'OCR 완료'
  };
};

const ImageCapture = ({ onImageCaptured }) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [showPreprocessed, setShowPreprocessed] = useState(false);
  const [showMultiAreaCropper, setShowMultiAreaCropper] = useState(false);
  const [savedMultiAreas, setSavedMultiAreas] = useState({});
  const [useMultiAreas, setUseMultiAreas] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recognitionError, setRecognitionError] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const startCapture = async () => {
    try {
      setIsCapturing(true);
      
      // Screen Capture API 사용
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          mediaSource: 'screen'
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (error) {
      console.error('화면 캡처 시작 실패:', error);
      setIsCapturing(false);
    }
  };

  const captureImage = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video && canvas) {
      const context = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // 비디오 프레임을 캔버스에 그리기
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // 캔버스를 이미지 데이터로 변환
      const imageDataUrl = canvas.toDataURL('image/png');
      setCapturedImage(imageDataUrl);
      
      // 저장된 영역이 있고 자동 사용이 설정되어 있으면 바로 적용
      if (useMultiAreas && Object.keys(savedMultiAreas).length > 0) {
        onImageCaptured(imageDataUrl, { multiAreas: savedMultiAreas });
      }
      
      // 스트림 정리
      const stream = video.srcObject;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      setIsCapturing(false);
    }
  };

  const stopCapture = () => {
    const video = videoRef.current;
    if (video && video.srcObject) {
      const stream = video.srcObject;
      stream.getTracks().forEach(track => track.stop());
      video.srcObject = null;
    }
    setIsCapturing(false);
  };

  const clearImage = () => {
    setCapturedImage(null);
  };



  const openMultiAreaCropper = () => {
    if (capturedImage) {
      setShowMultiAreaCropper(true);
    }
  };

  const handleMultiAreaComplete = async (multiAreas) => {
    setShowMultiAreaCropper(false);
    setSavedMultiAreas(multiAreas);
    
    try {
      setIsRecognizing(true);
      setRecognitionError(null);
      
      // 멀티 영역 OCR 처리
      console.log('설정된 영역들:', Object.keys(multiAreas));
      
      // 각 영역별로 OCR 실행하여 결과 수집
      const ocrResults = {};
      
      for (const [areaId, cropArea] of Object.entries(multiAreas)) {
        try {
          console.log(`${areaId} 영역 OCR 시작...`, cropArea);
          
          // 영역을 크롭한 이미지로 OCR 실행
          const croppedImageUrl = await cropImageArea(capturedImage, cropArea);
          const ocrResult = await performOCROnArea(croppedImageUrl, areaId);
          
          ocrResults[areaId] = ocrResult;
          console.log(`${areaId} OCR 결과:`, ocrResult);
          
        } catch (error) {
          console.error(`${areaId} OCR 실패:`, error);
          ocrResults[areaId] = { error: error.message };
        }
      }
      
      console.log('모든 영역 OCR 완료:', ocrResults);
      
      // OCR 결과를 부모 컴포넌트에 전달
      onImageCaptured(ocrResults);
      
    } catch (error) {
      console.error('OCR 처리 중 오류:', error);
      setRecognitionError('이미지 인식 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsRecognizing(false);
    }
  };

  const handleMultiAreaCancel = () => {
    setShowMultiAreaCropper(false);
  };

  return (
    <div className="image-capture-container">
      <div className="capture-controls">
        {!isCapturing ? (
          <button 
            onClick={startCapture}
            className="capture-btn start-btn"
          >
            📱 화면 캡처 시작
          </button>
        ) : (
          <div className="capturing-controls">
            <button 
              onClick={captureImage}
              className="capture-btn capture-btn-main"
            >
              📸 캡처
            </button>
            <button 
              onClick={stopCapture}
              className="capture-btn stop-btn"
            >
              ⏹️ 중지
            </button>
          </div>
        )}
        

        {capturedImage && (
          <>
            <button 
              onClick={openMultiAreaCropper}
              className="capture-btn crop-btn"
              style={{ background: '#E91E63' }}
            >
              🎯 텍스트 영역 설정
            </button>
            <button 
              onClick={clearImage}
              className="capture-btn clear-btn"
            >
              🗑️ 이미지 삭제
            </button>
          </>
        )}
        
        {Object.keys(savedMultiAreas).length > 0 && (
          <div className="saved-areas-section">
            <div className="saved-area-option">
              <label style={{ fontSize: '14px', color: '#666' }}>
                <input
                  type="checkbox"
                  checked={useMultiAreas}
                  onChange={(e) => setUseMultiAreas(e.target.checked)}
                  style={{ marginRight: '5px' }}
                />
                텍스트 영역 자동 사용 ({Object.keys(savedMultiAreas).length}개 영역)
              </label>
              <button
                onClick={() => {
                  setSavedMultiAreas({});
                  setUseMultiAreas(false);
                }}
                className="capture-btn"
                style={{ padding: '3px 8px', fontSize: '11px', background: '#999', marginLeft: '8px' }}
              >
                삭제
              </button>
            </div>
          </div>
        )}
        
        {/* OCR 인식 상태 표시 */}
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

      {/* 비디오 미리보기 (화면 공유 중일 때) */}
      {isCapturing && (
        <div className="video-preview">
          <video ref={videoRef} autoPlay muted style={{ maxWidth: '300px', maxHeight: '200px' }} />
        </div>
      )}

      {/* 캡처된 이미지 미리보기 */}
      {capturedImage && (
        <div className="captured-image-preview">
          <h4>캡처된 이미지:</h4>
          <img 
            src={capturedImage} 
            alt="캡처된 화면" 
            style={{ maxWidth: '400px', maxHeight: '300px', border: '1px solid #ccc' }}
          />
          <div className="preprocess-info">
            <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
              💡 팁: 젬 정보가 명확하게 보이는 부분을 캡처하세요.
              OCR이 텍스트를 자동으로 인식합니다.
            </p>
          </div>
        </div>
      )}

      {/* 숨겨진 캔버스 (이미지 캡처용) */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* 멀티 영역 크롭퍼 */}
      {showMultiAreaCropper && (
        <MultiAreaCropper
          imageDataUrl={capturedImage}
          onComplete={handleMultiAreaComplete}
          onCancel={handleMultiAreaCancel}
          savedAreas={savedMultiAreas}
        />
      )}
    </div>
  );
};

export default ImageCapture;