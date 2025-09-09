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

## 시뮬레이터 구조

### 핵심 파일들
- `local-optimal-strategy.js`: 최적 포기 전략 계산기 (멀티코어 병렬 지원)
- `local_util.js`: 공통 함수 및 DB 인터페이스
- `persistent-worker.js`: 재사용 가능한 워커 스레드
- `simulation-worker.js`: 일회성 워커 스레드

### 주요 기능
- Fixed-point iteration으로 최적 포기 임계값 계산
- autoOptionSet 기반 realistic 시뮬레이션
- 리롤 전략 적용 (smartRerollStrategy)
- SQLite 기반 확률 테이블 캐싱

### 성능 최적화
- 워커 재사용으로 캐시 효율성 향상
- DB 쿼리 최적화 (확률 + 비용 통합 조회)
- 병렬 처리 시 EventEmitter 리스너 관리

## 실행 방법
```bash
# 단일 스레드
node local-optimal-strategy.js GRADE GOAL COST SIMULATIONS

# 멀티코어 병렬
node local-optimal-strategy.js GRADE GOAL COST SIMULATIONS parallel
```

## 알려진 이슈
- 높은 편차로 인한 수렴 불안정성 (대량 시뮬레이션 필요)
- Variance reduction 기법 미적용