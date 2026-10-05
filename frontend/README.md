# 대빵 프론트엔드

서비스 소개와 화면은 [루트 README](../README.md)를 참고하세요.

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm demo
```

Node.js 24 / pnpm 11.19.0. 미리보기는 `http://127.0.0.1:5173`, 가상 로그인은 `demo@example.test` / `portfolio-demo`입니다. 합성 데이터로 실제 UI를 둘러보며 외부 API·DB는 사용하지 않습니다. 회원가입·리뷰 저장·랭킹은 미리보기에서 제공하지 않습니다.

`pnpm dev`는 실제 로컬 API(`http://localhost:8080`)를 사용합니다. `API_PROXY_TARGET`으로 개발 프록시를 지정할 수 있으며 원본 팀 서버를 기본값으로 사용하지 않습니다. Google 로그인에는 본인의 `VITE_GOOGLE_CLIENT_ID`와 백엔드 설정이 필요합니다.

`pnpm build`로 생성한 정적 파일에는 미리보기 API와 안내 배너가 포함되지 않습니다. 실제 배포에는 `/api`와 `/images/` 처리가 별도로 필요합니다.

토큰은 현재 계약에 따라 `sessionStorage`에 보관합니다. 공개 코드는 운영 보안 감사를 통과한 배포 템플릿이 아니며 인증·저장·권한은 실제 환경에서 별도 검증해야 합니다.
