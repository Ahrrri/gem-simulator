# 젬 시뮬레이터 프로젝트 메모

## 로스트아크 아크 그리드 시스템

### 코어 등급별 공급 의지력
- 영웅: 7
- 전설: 11
- 유물: 15
- 고대: 17

### 젬 타입별 기본 필요 의지력
- 침식/안정: 8
- 왜곡/견고: 9
- 붕괴/불변: 10

### 의지력 효율 시스템
- 의지력 효율로 최대 -5까지 감소 가능
- 실제 필요 의지력 범위: 3~10
- 침식/안정(8) → 최소 3
- 왜곡/견고(9) → 최소 4
- 붕괴/불변(10) → 최소 5

### 코어별 최대 활성화 젬 개수
- 전설 코어(11): 최대 3개
- 유물 코어(15): 최대 4개
- 고대 코어(17): 최대 4개

### 코어 효과 활성화 포인트
10 / 14 / 17 / 18 / 19 / 20 포인트

## 프로젝트 구조
```
gem-simulator/
├── src/
│   ├── scripts/                          # 스크립트 모음
│   │   ├── generate_probability_table.py # 확률 테이블 생성
│   │   ├── compare-reroll-dbs.js         # DB 비교
│   │   ├── json_to_db.py                 # JSON → SQLite 변환
│   │   ├── test_4combo_js.js            # JS 테스트
│   │   ├── test_4combo_python.py        # Python 테스트
│   │   └── verify_db_reroll.py          # DB 검증
│   ├── utils/                            # 유틸리티 모음
│   │   ├── targets.json                 # 중앙화된 타겟 설정
│   │   ├── gemConstants.js              # JavaScript 상수
│   │   └── apiClient.js                 # API 클라이언트
│   ├── components/                       # React 컴포넌트
│   └── ...
├── server/
│   └── server.js                         # 백엔드 서버
├── probability_table_reroll_7.db         # SQLite DB 파일
├── package.json                          # NPM 설정
└── vite.config.js                        # Vite 설정
```

## 시뮬레이터 구조

### 핵심 파일들
- `src/scripts/generate_probability_table.py`: 확률 테이블 생성 스크립트
- `src/utils/targets.json`: 타겟 설정 중앙화 파일
- `src/utils/gemConstants.js`: JavaScript 상수 및 동적 타겟 로더
- `src/utils/apiClient.js`: 프론트엔드 API 클라이언트
- `server/server.js`: 백엔드 SQLite API 서버

### 보조 스크립트들 (src/scripts/)
- `compare-reroll-dbs.js`: 여러 리롤 DB 파일들 간의 확률 차이 비교
- `json_to_db.py`: JSON 파일을 SQLite 데이터베이스로 변환
- `test_4combo_js.js`: JavaScript 4combo 확률 계산 테스트
- `test_4combo_python.py`: Python 4combo 확률 계산 테스트
- `verify_db_reroll.py`: 데이터베이스 리롤 확률 검증

### 주요 기능
- Fixed-point iteration으로 최적 포기 임계값 계산
- autoOptionSet 기반 realistic 시뮬레이션
- 리롤 전략 적용 (smartRerollStrategy)
- SQLite 기반 확률 테이블 캐싱
- 동적 타겟 시스템 (targets.json 중앙화)

### 동적 타겟 시스템
- 모든 타겟 조건이 `src/utils/targets.json`에 중앙화
- Python: 동적 조건 파서로 JSON → 람다 함수 변환
- JavaScript: 런타임에 fetch하여 조건 함수 생성
- Node.js: 서버 시작시 JSON 로드, 동적 SQL 쿼리 생성
- 새 타겟 추가시 JSON 파일만 수정하면 모든 시스템에 자동 반영

### 성능 최적화
- 워커 재사용으로 캐시 효율성 향상
- DB 쿼리 최적화 (확률 + 비용 통합 조회)
- 병렬 처리 시 EventEmitter 리스너 관리

## 실행 방법
```bash
# 확률 테이블 생성
python src/scripts/generate_probability_table.py

# JSON을 SQLite DB로 변환
python src/scripts/json_to_db.py

# DB 파일들 확률 비교
node src/scripts/compare-reroll-dbs.js

# 4combo 확률 테스트 (JavaScript)
node src/scripts/test_4combo_js.js

# 4combo 확률 테스트 (Python)  
python src/scripts/test_4combo_python.py

# DB 리롤 확률 검증
python src/scripts/verify_db_reroll.py
```

## 알려진 이슈
- 높은 편차로 인한 수렴 불안정성 (대량 시뮬레이션 필요)
- Variance reduction 기법 미적용