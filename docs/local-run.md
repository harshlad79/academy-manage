# 로컬 실행 안내

## 일반 MongoDB 실행

```sh
npm install
cp .env.example .env
mongod --fork --logpath /tmp/mongod.log --dbpath /data/db
npm run seed
npm run dev
```

기본 주소는 `http://127.0.0.1:5173`이다. `.env`의 `AUTH_MODE=mock`에서는 OAuth 없이 mock 사용자가 로그인된다.

## 화면 검증용 SQLite 시뮬레이션

MongoDB 없이 역할별 화면을 띄울 때는 각 터미널에서 실행한다.

```sh
SIMULATION_MODE=sqlite AUTH_MODE=mock AUTH_MOCK_USER_ID=testuser npm run dev -- --host 127.0.0.1 --port 5177 --strictPort
SIMULATION_MODE=sqlite AUTH_MODE=mock AUTH_MOCK_USER_ID=teacher-demo npm run dev -- --host 127.0.0.1 --port 5178 --strictPort
SIMULATION_MODE=sqlite AUTH_MODE=mock AUTH_MOCK_USER_ID=parent-kim npm run dev -- --host 127.0.0.1 --port 5179 --strictPort
SIMULATION_MODE=sqlite AUTH_MODE=mock AUTH_MOCK_USER_ID=superadmin npm run dev -- --host 127.0.0.1 --port 5180 --strictPort
```

역할별 주소:

- 관리자: `http://127.0.0.1:5177`
- 강사: `http://127.0.0.1:5178`
- 학부모: `http://127.0.0.1:5179/p`
- 전체관리자: `http://127.0.0.1:5180/platform`

5173은 다른 Codex 세션이 사용할 수 있으므로 충돌 시 임의로 종료하지 않는다. 상세 검증 결과와 재개 순서는 [current-status.md](current-status.md)를 읽는다.

## 검증

```sh
npm run check
npm test
npm run lint
npm run build
```
