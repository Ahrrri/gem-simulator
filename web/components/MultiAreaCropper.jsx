import React, { useState, useRef, useEffect } from 'react';
import './MultiAreaCropper.css';

const CROP_AREAS = [
  { id: 'gem_option_1', name: '젬 옵션 1', color: '#FF6B6B' },
  { id: 'gem_option_2', name: '젬 옵션 2', color: '#FF6B6B' },
  { id: 'gem_option_3', name: '젬 옵션 3', color: '#FF6B6B' },
  { id: 'gem_option_4', name: '젬 옵션 4', color: '#FF6B6B' },
  { id: 'processing_option_1', name: '가공 옵션 1', color: '#4ECDC4' },
  { id: 'processing_option_2', name: '가공 옵션 2', color: '#4ECDC4' },
  { id: 'processing_option_3', name: '가공 옵션 3', color: '#4ECDC4' },
  { id: 'processing_option_4', name: '가공 옵션 4', color: '#4ECDC4' },
  { id: 'processing_counts', name: '가공 횟수 정보', color: '#333333' },
  { id: 'reroll_button', name: '리롤 버튼', color: '#333333' },
  { id: 'cost_modifier', name: '가공 비용', color: '#333333' }
];

const MultiAreaCropper = ({ imageDataUrl, onComplete, onCancel, savedAreas = {} }) => {
  const canvasRef = useRef(null);
  const [currentAreaIndex, setCurrentAreaIndex] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });
  const [cropAreas, setCropAreas] = useState(savedAreas);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [canvasScale, setCanvasScale] = useState(1);
  
  const imageRef = useRef(new Image());

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;

    img.onload = () => {
      const maxWidth = window.innerWidth * 0.85;
      const maxHeight = window.innerHeight * 0.7;
      
      let displayWidth = img.width;
      let displayHeight = img.height;
      
      if (displayWidth > maxWidth) {
        displayHeight = (displayHeight * maxWidth) / displayWidth;
        displayWidth = maxWidth;
      }
      if (displayHeight > maxHeight) {
        displayWidth = (displayWidth * maxHeight) / displayHeight;
        displayHeight = maxHeight;
      }
      
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      
      setCanvasScale(img.width / displayWidth);
      
      redrawCanvas();
      setImageLoaded(true);
    };
    
    img.src = imageDataUrl;
  }, [imageDataUrl]);

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    // 저장된 모든 영역 그리기
    Object.entries(cropAreas).forEach(([areaId, area]) => {
      const areaConfig = CROP_AREAS.find(a => a.id === areaId);
      if (areaConfig && area) {
        // 실제 크기를 캔버스 크기로 변환
        const displayArea = {
          x: area.x / canvasScale,
          y: area.y / canvasScale,
          width: area.width / canvasScale,
          height: area.height / canvasScale
        };
        
        ctx.strokeStyle = areaConfig.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(displayArea.x, displayArea.y, displayArea.width, displayArea.height);
        
        ctx.fillStyle = areaConfig.color + '30';
        ctx.fillRect(displayArea.x, displayArea.y, displayArea.width, displayArea.height);
        
        // 레이블 표시
        ctx.setLineDash([]);
        ctx.fillStyle = areaConfig.color;
        ctx.font = '12px sans-serif';
        ctx.fillText(areaConfig.name, displayArea.x + 2, displayArea.y - 5);
      }
    });
    
    ctx.setLineDash([]);
  };

  useEffect(() => {
    if (imageLoaded) {
      redrawCanvas();
    }
  }, [cropAreas, imageLoaded]);

  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleMouseDown = (e) => {
    if (!imageLoaded) return;
    
    const pos = getMousePos(e);
    setIsDrawing(true);
    setStartPos(pos);
    setCurrentPos(pos);
  };

  const handleMouseMove = (e) => {
    if (!isDrawing || !imageLoaded) return;
    
    const pos = getMousePos(e);
    setCurrentPos(pos);
    
    redrawCanvas();
    
    // 현재 그리는 영역 표시
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const currentArea = CROP_AREAS[currentAreaIndex];
    
    const width = pos.x - startPos.x;
    const height = pos.y - startPos.y;
    
    ctx.strokeStyle = currentArea.color;
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(startPos.x, startPos.y, width, height);
    
    ctx.fillStyle = currentArea.color + '40';
    ctx.fillRect(startPos.x, startPos.y, width, height);
    
    ctx.setLineDash([]);
  };

  const handleMouseUp = (e) => {
    if (!isDrawing || !imageLoaded) return;
    
    setIsDrawing(false);
    
    const width = currentPos.x - startPos.x;
    const height = currentPos.y - startPos.y;
    
    if (Math.abs(width) < 10 || Math.abs(height) < 10) {
      redrawCanvas();
      return;
    }
    
    const normalizedArea = {
      x: Math.round(Math.min(startPos.x, currentPos.x) * canvasScale),
      y: Math.round(Math.min(startPos.y, currentPos.y) * canvasScale),
      width: Math.round(Math.abs(width) * canvasScale),
      height: Math.round(Math.abs(height) * canvasScale)
    };
    
    const currentArea = CROP_AREAS[currentAreaIndex];
    setCropAreas(prev => ({
      ...prev,
      [currentArea.id]: normalizedArea
    }));
  };

  const skipCurrentArea = () => {
    if (currentAreaIndex < CROP_AREAS.length - 1) {
      setCurrentAreaIndex(currentAreaIndex + 1);
    }
  };

  const goToPreviousArea = () => {
    if (currentAreaIndex > 0) {
      setCurrentAreaIndex(currentAreaIndex - 1);
    }
  };

  const clearCurrentArea = () => {
    const currentArea = CROP_AREAS[currentAreaIndex];
    setCropAreas(prev => {
      const newAreas = { ...prev };
      delete newAreas[currentArea.id];
      return newAreas;
    });
  };

  const clearAllAreas = () => {
    setCropAreas({});
  };

  const handleComplete = () => {
    onComplete(cropAreas);
  };

  const currentArea = CROP_AREAS[currentAreaIndex];
  const hasCurrentArea = cropAreas[currentArea.id] !== undefined;
  const totalAreasSet = Object.keys(cropAreas).length;

  return (
    <div className="multi-area-cropper-overlay">
      <div className="multi-area-cropper-container">
        <div className="cropper-header">
          <h3>텍스트 영역 설정</h3>
          <div className="area-progress">
            <span className="current-area" style={{ color: currentArea.color }}>
              현재: {currentArea.name} 
              {hasCurrentArea && ' ✓'}
            </span>
            <span className="area-counter">
              ({currentAreaIndex + 1}/{CROP_AREAS.length}) - 설정됨: {totalAreasSet}개
            </span>
          </div>
          <p className="area-instruction">
            각 텍스트 영역을 드래그하여 선택하세요. 필요없는 영역은 건너뛸 수 있습니다.
          </p>
        </div>
        
        <div className="cropper-canvas-container">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="cropper-canvas"
          />
        </div>
        
        <div className="area-list">
          {CROP_AREAS.map((area, index) => (
            <div 
              key={area.id}
              className={`area-item ${index === currentAreaIndex ? 'active' : ''} ${cropAreas[area.id] ? 'completed' : ''}`}
              onClick={() => setCurrentAreaIndex(index)}
              style={{ 
                borderColor: area.color,
                backgroundColor: index === currentAreaIndex ? area.color + '20' : 'transparent'
              }}
            >
              <span style={{ color: area.color }}>{area.name}</span>
              {cropAreas[area.id] && (
                <span className="area-size">
                  {cropAreas[area.id].width}×{cropAreas[area.id].height}
                </span>
              )}
            </div>
          ))}
        </div>
        
        <div className="cropper-controls">
          <button 
            onClick={goToPreviousArea}
            className="btn-nav"
            disabled={currentAreaIndex === 0}
          >
            ← 이전 영역
          </button>
          
          <button 
            onClick={clearCurrentArea}
            className="btn-clear"
            disabled={!hasCurrentArea}
          >
            현재 영역 초기화
          </button>
          
          <button 
            onClick={skipCurrentArea}
            className="btn-skip"
            disabled={currentAreaIndex === CROP_AREAS.length - 1}
          >
            다음 영역 →
          </button>
          
          <button 
            onClick={clearAllAreas}
            className="btn-clear-all"
            disabled={totalAreasSet === 0}
          >
            모두 초기화
          </button>
          
          <button 
            onClick={onCancel}
            className="btn-cancel"
          >
            취소
          </button>
          
          <button 
            onClick={handleComplete}
            className="btn-complete"
            disabled={totalAreasSet === 0}
          >
            설정 완료 ({totalAreasSet}개)
          </button>
        </div>
      </div>
    </div>
  );
};

export default MultiAreaCropper;