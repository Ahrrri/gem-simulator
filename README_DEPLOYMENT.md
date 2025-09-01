# 배포 환경 설정 가이드

## GitHub Pages 자동 배포 설정

### 1. GitHub Secrets 설정
1. GitHub 저장소 → Settings → Secrets and variables → Actions
2. "New repository secret" 클릭
3. 다음 시크릿 추가:
   - Name: `REACT_APP_API_URL`
   - Value: `https://your-actual-backend-url.com` (실제 백엔드 서버 URL)

### 2. 환경 변수 설정 방법

#### 로컬 개발
```bash
# .env 파일 (git에 포함되지 않음)
REACT_APP_API_URL=http://localhost:3001
```

#### GitHub Pages (자동 배포)
- `.github/workflows/deploy.yml`에서 GitHub Secrets 사용
- GitHub Secrets에서 `REACT_APP_API_URL` 값 관리
- `.env.production` 파일 불필요 (GitHub Actions가 직접 주입)

#### 다른 플랫폼 배포 시
```bash
# Vercel, Netlify 등은 각 플랫폼 대시보드에서 환경 변수 설정
# 또는 빌드 시 직접 설정:
REACT_APP_API_URL=https://api.example.com npm run build
```

### 3. 백엔드 서버 요구사항
백엔드 서버는 CORS를 허용해야 합니다:
```javascript
// Express.js 예시
app.use(cors({
  origin: [
    'http://localhost:3000',  // 로컬 개발
    'https://yourusername.github.io'  // GitHub Pages
  ]
}));
```

### 4. 테스트 방법
1. 브라우저 개발자 도구 → Console
2. 다음 입력:
   ```javascript
   console.log(process.env.REACT_APP_API_URL)
   ```
3. 올바른 URL이 출력되는지 확인

### 5. 문제 해결

#### 환경 변수가 undefined로 나올 때
- GitHub Secrets 설정 확인
- `.github/workflows/deploy.yml`의 env 섹션 확인
- 빌드 캐시 삭제 후 재배포

#### CORS 에러 발생 시
- 백엔드 서버 CORS 설정 확인
- GitHub Pages URL이 백엔드 CORS 허용 목록에 있는지 확인

### 6. 보안 주의사항
- `.env` 파일은 절대 git에 커밋하지 마세요
- API 키나 민감한 정보는 백엔드에서 관리하세요
- 프론트엔드 환경 변수는 빌드 시 코드에 포함되어 공개됩니다