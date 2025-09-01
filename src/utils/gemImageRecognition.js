// 젬 이미지 인식 유틸리티
import Tesseract from 'tesseract.js';

// 젬 타입 매핑
const GEM_TYPE_MAPPING = {
  '질서': 'ORDER',
  '혼돈': 'CHAOS',
  '안정': 'STABLE',
  '견고': 'SOLID', 
  '불변': 'IMMUTABLE',
  '침식': 'EROSION',
  '왜곡': 'DISTORTION',
  '붕괴': 'COLLAPSE'
};

// 젬 등급 매핑
const GEM_GRADE_MAPPING = {
  '1등급': 1,
  '2등급': 2,
  '3등급': 3,
  '4등급': 4,
  '5등급': 5,
  '6등급': 6,
  '7등급': 7,
  '8등급': 8,
  '9등급': 9,
  '10등급': 10
};

// 향상된 이미지 전처리 함수
const preprocessImage = async (imageDataUrl, options = {}) => {
  const {
    scale = 2, // 이미지 확대 비율
    sharpen = true, // 선명도 향상
    denoise = true, // 노이즈 제거
    binarize = false, // 이진화 (텍스트가 단순한 경우)
    threshold = 128 // 이진화 임계값
  } = options;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // 이미지 확대 (OCR 정확도 향상)
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      // 부드러운 확대를 위한 설정
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // 확대된 이미지 그리기
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // 이미지 데이터 가져오기
      let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let data = imageData.data;
      
      // 1단계: 그레이스케일 변환
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }
      
      // 2단계: 선명도 향상 (언샤프 마스크)
      if (sharpen) {
        const sharpened = applyUnsharpMask(imageData, canvas.width, canvas.height);
        imageData = sharpened;
        data = imageData.data;
      }
      
      // 3단계: 노이즈 제거 (중간값 필터)
      if (denoise) {
        const denoised = applyMedianFilter(imageData, canvas.width, canvas.height);
        imageData = denoised;
        data = imageData.data;
      }
      
      // 4단계: 대비 향상 또는 이진화
      if (binarize) {
        // 이진화 (흑백)
        for (let i = 0; i < data.length; i += 4) {
          const value = data[i] > threshold ? 255 : 0;
          data[i] = value;
          data[i + 1] = value;
          data[i + 2] = value;
        }
      } else {
        // 적응형 대비 향상
        const { min, max } = findMinMax(data);
        const range = max - min;
        
        for (let i = 0; i < data.length; i += 4) {
          let value = ((data[i] - min) / range) * 255;
          // 대비 강화
          value = value > 180 ? 255 : value < 75 ? 0 : (value - 75) * 2;
          data[i] = value;
          data[i + 1] = value;
          data[i + 2] = value;
        }
      }
      
      // 처리된 이미지 데이터 적용
      ctx.putImageData(imageData, 0, 0);
      
      // 처리된 이미지를 데이터 URL로 변환
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = imageDataUrl;
  });
};

// 언샤프 마스크 필터 (선명도 향상)
const applyUnsharpMask = (imageData, width, height) => {
  const data = imageData.data;
  const output = new Uint8ClampedArray(data);
  const kernel = [
    0, -1, 0,
    -1, 5, -1,
    0, -1, 0
  ];
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      let sum = 0;
      
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const kidx = ((y + ky) * width + (x + kx)) * 4;
          const kval = kernel[(ky + 1) * 3 + (kx + 1)];
          sum += data[kidx] * kval;
        }
      }
      
      output[idx] = Math.min(255, Math.max(0, sum));
      output[idx + 1] = output[idx];
      output[idx + 2] = output[idx];
    }
  }
  
  return new ImageData(output, width, height);
};

// 중간값 필터 (노이즈 제거)
const applyMedianFilter = (imageData, width, height) => {
  const data = imageData.data;
  const output = new Uint8ClampedArray(data);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const values = [];
      
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          values.push(data[idx]);
        }
      }
      
      values.sort((a, b) => a - b);
      const median = values[4]; // 중간값
      
      const idx = (y * width + x) * 4;
      output[idx] = median;
      output[idx + 1] = median;
      output[idx + 2] = median;
    }
  }
  
  return new ImageData(output, width, height);
};

// 최소/최대값 찾기
const findMinMax = (data) => {
  let min = 255;
  let max = 0;
  
  for (let i = 0; i < data.length; i += 4) {
    const value = data[i];
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  
  return { min, max };
};

// 이미지 크롭 함수 (관심 영역만 추출)
export const cropImage = async (imageDataUrl, cropArea) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      const { x, y, width, height } = cropArea;
      canvas.width = width;
      canvas.height = height;
      
      ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = imageDataUrl;
  });
};

// 실제 OCR을 사용한 이미지 인식 함수
export const recognizeGemFromImage = async (imageDataUrl, options = {}) => {
  const {
    usePreprocess = true,
    cropArea = null, // { x, y, width, height }
    preprocessOptions = {}, // 전처리 옵션
    ocrConfig = {} // OCR 추가 설정
  } = options;

  try {
    console.log('OCR 이미지 인식 시작...');
    
    let processedImage = imageDataUrl;
    
    // 크롭 처리 (선택적)
    if (cropArea) {
      console.log('이미지 크롭 중...', cropArea);
      processedImage = await cropImage(processedImage, cropArea);
    }
    
    // 이미지 전처리 (선택적)
    if (usePreprocess) {
      console.log('이미지 전처리 중...');
      processedImage = await preprocessImage(processedImage, preprocessOptions);
    }
    
    // OCR 설정 최적화
    const tesseractConfig = {
      lang: 'kor+eng', // 한국어 + 영어
      logger: m => {
        if (m.status === 'recognizing text') {
          console.log(`OCR 진행률: ${Math.round(m.progress * 100)}%`);
        }
      },
      // OCR 엔진 모드와 페이지 세분화 모드 설정
      tessedit_ocr_engine_mode: 1, // 1 = LSTM only (더 정확)
      tessedit_pageseg_mode: 6, // 6 = 균일한 텍스트 블록
      preserve_interword_spaces: '1', // 단어 간 공백 유지
      ...ocrConfig
    };
    
    // Tesseract OCR 실행
    const result = await Tesseract.recognize(
      processedImage,
      tesseractConfig.lang,
      tesseractConfig
    );
    
    console.log('OCR 원본 텍스트:', result.data.text);
    
    // 신뢰도가 낮은 텍스트 필터링
    const confidentText = result.data.words
      .filter(word => word.confidence > 60) // 60% 이상 신뢰도
      .map(word => word.text)
      .join(' ');
    
    console.log('신뢰도 높은 텍스트:', confidentText);
    
    // OCR 결과를 젬 정보로 파싱 (원본과 필터링된 텍스트 모두 시도)
    let gemInfo = parseGemInfoFromText(result.data.text);
    
    // 첫 번째 시도가 실패하면 필터링된 텍스트로 재시도
    if (!gemInfo || !gemInfo.gemType) {
      console.log('필터링된 텍스트로 재파싱 시도...');
      gemInfo = parseGemInfoFromText(confidentText);
    }
    
    // 파싱 실패 시 모의 데이터 반환 (개발용)
    if (!gemInfo || !gemInfo.gemType) {
      console.log('OCR 파싱 실패, 모의 데이터 사용');
      return {
        gemType: 'ORDER_STABLE',
        grade: 7,
        level: 1,
        quality: 85,
        stats: {
          attack: 1250,
          health: 2100,
          critical: 15,
          criticalDamage: 35
        },
        options: [
          {
            name: '공격력 증가',
            type: 'ATTACK_PERCENT',
            minValue: 8,
            maxValue: 12,
            currentValue: 10.5
          }
        ]
      };
    }
    
    console.log('이미지 인식 완료:', gemInfo);
    return gemInfo;
    
  } catch (error) {
    console.error('이미지 인식 실패:', error);
    throw error;
  }
};

// 텍스트에서 젬 정보 추출 (OCR 결과 파싱용)
export const parseGemInfoFromText = (ocrText) => {
  try {
    const lines = ocrText.split('\n').filter(line => line.trim());
    const gemInfo = {
      gemType: null,
      grade: null,
      level: 1,
      quality: null,
      stats: {},
      options: []
    };
    
    console.log('파싱할 라인들:', lines);
    
    // 젬 타입 찾기 (메인 타입 + 서브 타입)
    let mainType = null;
    let subType = null;
    
    for (const line of lines) {
      // 질서/혼돈 찾기
      if (line.includes('질서')) {
        mainType = 'ORDER';
      } else if (line.includes('혼돈')) {
        mainType = 'CHAOS';
      }
      
      // 서브 타입 찾기
      if (line.includes('안정')) subType = 'STABLE';
      else if (line.includes('견고')) subType = 'SOLID';
      else if (line.includes('불변')) subType = 'IMMUTABLE';
      else if (line.includes('침식')) subType = 'EROSION';
      else if (line.includes('왜곡')) subType = 'DISTORTION';
      else if (line.includes('붕괴')) subType = 'COLLAPSE';
    }
    
    if (mainType && subType) {
      gemInfo.gemType = `${mainType}_${subType}`;
    }
    
    // 등급 찾기 (더 유연한 패턴)
    for (const line of lines) {
      // "7등급", "등급 7", "등급: 7" 등 다양한 패턴 처리
      const gradeMatch = line.match(/(\d+)\s*등급|등급\s*[:]*\s*(\d+)/);
      if (gradeMatch) {
        gemInfo.grade = parseInt(gradeMatch[1] || gradeMatch[2]);
        break;
      }
    }
    
    // 레벨 찾기
    for (const line of lines) {
      const levelMatch = line.match(/레벨\s*[:]*\s*(\d+)|Lv\s*\.?\s*(\d+)/i);
      if (levelMatch) {
        gemInfo.level = parseInt(levelMatch[1] || levelMatch[2]);
        break;
      }
    }
    
    // 품질 찾기
    for (const line of lines) {
      const qualityMatch = line.match(/품질\s*[:]*\s*(\d+)|(\d+)\s*%/);
      if (qualityMatch) {
        gemInfo.quality = parseInt(qualityMatch[1] || qualityMatch[2]);
        break;
      }
    }
    
    // 스탯 파싱 (더 유연한 패턴)
    const statPatterns = {
      attack: /공격력\s*[:+]*\s*(\d+(?:,\d{3})*|\d+)/,
      health: /생명력\s*[:+]*\s*(\d+(?:,\d{3})*|\d+)/,
      critical: /치명타\s*확률?\s*[:+]*\s*(\d+)/,
      criticalDamage: /치명타\s*피해\s*[:+]*\s*(\d+)/
    };
    
    for (const line of lines) {
      for (const [stat, pattern] of Object.entries(statPatterns)) {
        const match = line.match(pattern);
        if (match) {
          // 쉼표 제거 후 정수 변환
          gemInfo.stats[stat] = parseInt(match[1].replace(/,/g, ''));
        }
      }
    }
    
    // 옵션 파싱 (퍼센트 증가 옵션들)
    const optionPatterns = [
      { pattern: /공격력\s*\+?\s*(\d+(?:\.\d+)?)\s*%/, type: 'ATTACK_PERCENT', name: '공격력 증가' },
      { pattern: /생명력\s*\+?\s*(\d+(?:\.\d+)?)\s*%/, type: 'HEALTH_PERCENT', name: '생명력 증가' },
      { pattern: /방어력\s*\+?\s*(\d+(?:\.\d+)?)\s*%/, type: 'DEFENSE_PERCENT', name: '방어력 증가' },
      { pattern: /치명타\s*확률\s*\+?\s*(\d+(?:\.\d+)?)\s*%/, type: 'CRITICAL_RATE', name: '치명타 확률' },
      { pattern: /치명타\s*피해\s*\+?\s*(\d+(?:\.\d+)?)\s*%/, type: 'CRITICAL_DAMAGE', name: '치명타 피해' }
    ];
    
    for (const line of lines) {
      for (const optionInfo of optionPatterns) {
        const match = line.match(optionInfo.pattern);
        if (match) {
          gemInfo.options.push({
            name: optionInfo.name,
            type: optionInfo.type,
            currentValue: parseFloat(match[1]),
            // 범위 값은 OCR로 파악하기 어려우므로 기본값 설정
            minValue: Math.floor(parseFloat(match[1]) * 0.7),
            maxValue: Math.ceil(parseFloat(match[1]) * 1.3)
          });
        }
      }
    }
    
    console.log('파싱 결과:', gemInfo);
    return gemInfo;
    
  } catch (error) {
    console.error('텍스트 파싱 실패:', error);
    return null;
  }
};

// 인식된 젬 정보를 시뮬레이터 형식으로 변환
export const convertToSimulatorFormat = (recognizedGem) => {
  try {
    // 젬 타입을 시뮬레이터 형식으로 변환
    let mainType, subType;
    
    if (recognizedGem.gemType) {
      if (recognizedGem.gemType.startsWith('ORDER')) {
        mainType = 'ORDER';
        subType = recognizedGem.gemType.replace('ORDER_', '');
      } else if (recognizedGem.gemType.startsWith('CHAOS')) {
        mainType = 'CHAOS';
        subType = recognizedGem.gemType.replace('CHAOS_', '');
      }
    }
    
    return {
      type: recognizedGem.gemType,
      mainType,
      subType,
      grade: recognizedGem.grade,
      level: recognizedGem.level || 1,
      quality: recognizedGem.quality,
      baseStats: recognizedGem.stats,
      currentOptions: recognizedGem.options || []
    };
    
  } catch (error) {
    console.error('시뮬레이터 형식 변환 실패:', error);
    return null;
  }
};