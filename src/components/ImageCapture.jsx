import React, { useState, useRef } from 'react';
import './ImageCapture.css';

const ImageCapture = ({ onImageCaptured }) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [showPreprocessed, setShowPreprocessed] = useState(false);
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
      
      // 부모 컴포넌트에 이미지 전달
      if (onImageCaptured) {
        onImageCaptured(imageDataUrl);
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
          <button 
            onClick={clearImage}
            className="capture-btn clear-btn"
          >
            🗑️ 이미지 삭제
          </button>
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
    </div>
  );
};

export default ImageCapture;