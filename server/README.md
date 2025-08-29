# Gem Simulator API Server

SQLite 데이터베이스를 백엔드에서 처리하는 Express.js API 서버

## 실행 방법

1. **서버 시작:**
```bash
cd server
npm start
```

2. **개발 모드 (자동 재시작):**
```bash
cd server
npm run dev
```

## API 엔드포인트

### GET /health
서버 상태 확인

### GET /api/stats?minAttempts=3
데이터베이스 통계 정보

### GET /api/gem-probabilities
젬 상태별 확률 조회
- Parameters: willpower, corePoint, dealerA, dealerB, supportA, supportB, remainingAttempts, currentRerollAttempts, costModifier, isFirstProcessing

### GET /api/high-probability?target=prob_ancient&minProb=0.8&limit=10
높은 확률 상태들 조회

### POST /api/query
커스텀 SQL 쿼리 (SELECT만 허용)
```json
{
  "sql": "SELECT * FROM gem_states WHERE prob_ancient > 0.9 LIMIT 5",
  "params": []
}
```

### GET /api/available-options/:gemStateId
특정 젬 상태의 사용 가능한 옵션들 조회

## 보안

- SELECT 쿼리만 허용
- 위험한 SQL 키워드 차단
- CORS 활성화
- SQL injection 방지

## 요구사항

- Node.js 18+
- `probability_table.db` 파일이 프로젝트 루트에 위치해야 함