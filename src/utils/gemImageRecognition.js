// 젬 이미지 인식 유틸리티
// 실제로는 OCR이나 이미지 처리 라이브러리가 필요하지만,
// 현재는 기본 구조를 만들고 추후 확장 가능하도록 구성

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

// 모의 이미지 인식 함수 (실제로는 OCR 또는 ML 모델 사용)
export const recognizeGemFromImage = async (imageDataUrl) => {
  try {
    // TODO: 실제 이미지 처리 로직 구현
    // 현재는 테스트용 모의 데이터 반환
    
    console.log('이미지 인식 시작...');
    
    // 인식 시뮬레이션을 위한 지연
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 모의 인식 결과 (실제로는 이미지에서 추출)
    const mockRecognitionResult = {
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
        },
        {
          name: '생명력 증가', 
          type: 'HEALTH_PERCENT',
          minValue: 15,
          maxValue: 25,
          currentValue: 20.2
        },
        {
          name: '치명타 확률',
          type: 'CRITICAL_RATE',
          minValue: 3,
          maxValue: 7,
          currentValue: 5.8
        }
      ]
    };
    
    console.log('이미지 인식 완료:', mockRecognitionResult);
    return mockRecognitionResult;
    
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
    
    // 젬 타입 찾기
    for (const line of lines) {
      for (const [korean, english] of Object.entries(GEM_TYPE_MAPPING)) {
        if (line.includes(korean)) {
          gemInfo.gemType = english;
          break;
        }
      }
    }
    
    // 등급 찾기
    for (const line of lines) {
      for (const [korean, number] of Object.entries(GEM_GRADE_MAPPING)) {
        if (line.includes(korean)) {
          gemInfo.grade = number;
          break;
        }
      }
    }
    
    // 스탯 파싱 (예: "공격력: 1250")
    const statPatterns = {
      attack: /공격력[:\s]*(\d+)/,
      health: /생명력[:\s]*(\d+)/,
      critical: /치명타[:\s]*(\d+)/,
      criticalDamage: /치명타 피해[:\s]*(\d+)/
    };
    
    for (const line of lines) {
      for (const [stat, pattern] of Object.entries(statPatterns)) {
        const match = line.match(pattern);
        if (match) {
          gemInfo.stats[stat] = parseInt(match[1]);
        }
      }
    }
    
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