# Codex Handoff — academy-manage

> **목적**: OpenAI Codex 에이전트가 이 저장소에서 즉시 작업을 이어갈 수 있도록 전체 컨텍스트를 한 문서에 전달한다.
> **출처**: Cursor Cloud 에이전트 작성(`origin/cursor/env-setup-780a` @ `03c369b`, 2026-07-08) — 로컬 `main`에 별도 문서로 편입. 복붙 프롬프트 모음은 [`codex-handoff.md`](codex-handoff.md) 참조.

---

## 1. 프로젝트 요약

**academy-manage** — 한국 학원(다학원 스코프) 운영·수납·출결·플랫폼 관리 웹 앱.

| 항목          | 값                                          |
| ------------- | ------------------------------------------- |
| 프레임워크    | SvelteKit 5 (Svelte 5 runes)                |
| 스타일        | Tailwind CSS v4                             |
| 언어          | TypeScript strict (`any`/`@ts-ignore` 금지) |
| DB            | MongoDB + Mongoose v9                       |
| 인증          | Better Auth v1 (mock / live 모드)           |
| 빌드          | Vite 8, ESM (`"type": "module"`)            |
| 테스트        | Vitest v4                                   |
| 린트          | ESLint v10 + Prettier                       |
| 패키지 매니저 | npm (lockfile: `package-lock.json`)         |
| Node 버전     | 20+ (현재 v22 사용)                         |

---

## 2. 환경 설정 (로컬)

```bash
# 1. 의존성
npm install

# 2. 환경 변수
cp .env.example .env
# AUTH_MODE=mock (기본) — OAuth 없이 고정 사용자 세션

# 3. MongoDB 기동
mongod --fork --logpath /tmp/mongod.log --dbpath /data/db

# 4. 시드 데이터
npm run seed
# ⚠️ scripts/seed.ts 151행 디스트럭처링 버그: `enb[0]._id` → `enb._id`
# 에러 발생 시 메인 학원 데이터는 이미 삽입됨, 멤버십만 수동 보완 필요

# 5. 개발 서버
npm run dev   # → http://localhost:5173
```

### 환경 변수 (핵심)

| 변수                    | 기본값                              | 설명                                                    |
| ----------------------- | ----------------------------------- | ------------------------------------------------------- |
| `AUTH_MODE`             | `mock`                              | `mock`=고정 사용자, `live`=Better Auth OAuth            |
| `DB_URL`                | `mongodb://127.0.0.1:27017/academy` | MongoDB 연결                                            |
| `DEV_ACADEMY_ID`        | `507f1f77bcf86cd799439011`          | 기본 학원 ObjectId                                      |
| `DEV_ACADEMY_SECOND_ID` | `507f1f77bcf86cd799439022`          | 분원 ObjectId                                           |
| `AUTH_MOCK_USER_ID`     | `testuser`                          | mock 모드 사용자 (`testuser`/`superadmin`/`parent-kim`) |
| `BETTER_AUTH_SECRET`    | —                                   | live 모드 필수                                          |
| `BETTER_AUTH_URL`       | `http://localhost:5173`             | OAuth 리다이렉트                                        |

---

## 3. 검증 커맨드

```bash
npm run check   # svelte-kit sync + svelte-check (타입 체크)
npm test        # vitest --run (46 tests, 13 files)
npm run lint    # prettier --check + eslint
npm run build   # vite build
```

---

## 4. 브랜치 구조

| 브랜치                  | 상태          | 설명                                                  |
| ----------------------- | ------------- | ----------------------------------------------------- |
| `feat/platform-invite`  | **활성 개발** | 플랫폼 초대·소셜 로그인·SMS 초대 기능                 |
| `cursor/env-setup-780a` | draft PR #2   | AGENTS.md Cloud 지침 추가 (feat/platform-invite 기반) |

**최근 커밋 흐름** (feat/platform-invite, 37 commits):

1. 기본 CRUD (학생·강사·클래스·수강·출결·수납·보강)
2. 대시보드·리포트·학부모 포털
3. 플랫폼 관리(다학원·멤버·초대)
4. SMTP 이메일 초대·수락 플로
5. Live OAuth (카카오·네이버·구글) + 약관 동의
6. SMS 초대 (학부모·보호자)

---

## 5. 아키텍처 개요

### 디렉터리 구조

```
src/
├── lib/
│   ├── server/
│   │   ├── models/          # Mongoose 모델 (15개)
│   │   ├── rbac.ts          # 역할 기반 접근 제어
│   │   ├── academy-scope.ts # withAcademyScope() — 학원 스코프 헬퍼
│   │   ├── auth.ts          # Better Auth 설정
│   │   ├── invite-consume.ts   # 초대 수락 로직
│   │   ├── invite-mail.ts      # SMTP 메일 발송
│   │   ├── teacher-membership-link.ts
│   │   └── mongo-populate-guards.ts  # populate 타입 가드
│   └── (client-side shared utils)
├── routes/
│   ├── (스태프 루트)
│   │   ├── students/
│   │   ├── teachers/
│   │   ├── courses/
│   │   ├── enrollments/
│   │   ├── attendance/
│   │   ├── makeups/
│   │   ├── payments/
│   │   ├── reports/         # 허브 + course-revenue
│   │   └── communications/
│   ├── platform/            # 전체관리자 (super_admin)
│   │   └── academies/[academyId]/members/
│   ├── p/                   # 학부모 포털 (읽기 전용)
│   ├── invite/              # 초대 수락
│   └── auth/                # 로그인·회원가입
scripts/
└── seed.ts                  # 시드 데이터
```

### Mongoose 모델 (15개)

`Academy`, `AcademyMembership`, `AcademyInvite`, `Student`, `Teacher`, `Course`, `Enrollment`, `Attendance`, `AttendanceAuditLog`, `InvoiceLine`, `Payment`, `BankDeposit`, `MakeupSession`, `ParentStudentLink`

### 역할 계층 (RBAC)

| 역할            | 접근 범위                  |
| --------------- | -------------------------- |
| `super_admin`   | 플랫폼 전체 + 모든 학원    |
| `academy_admin` | 소속 학원 전체             |
| `office`        | 학원 내 행정 (수납·청구)   |
| `teacher`       | 담당 반 (출결·보강)        |
| `parent`        | `/p` 포털만 (내 자녀 읽기) |

### 인증 모드

- **mock**: `hooks.server.ts`에서 `AUTH_MOCK_USER_ID`로 고정 세션. DB 접근은 정상 동작.
- **live**: Better Auth + 소셜 OAuth (카카오·네이버·구글). `termsAcceptedAt` 없으면 약관 페이지로 리다이렉트.

### 학원 스코프

- 모든 비즈니스 문서에 `academyId` 필드
- `withAcademyScope()` — `active_academy_id` httpOnly 쿠키(멤버십 검증) + `DEV_ACADEMY_ID` 폴백
- 다학원 전환 UI 제공 (시드 시 testuser·superadmin 양쪽 멤버십)

---

## 6. 데이터 규칙

| 규칙             | 내용                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------- |
| 수강 삭제        | Attendance, AuditLog, MakeupSession, InvoiceLine, Payment 연쇄 정리 후 Enrollment 삭제 |
| 학생·클래스 삭제 | Enrollment 있으면 400 (고아 방지)                                                      |
| 강사 삭제        | 담당 Course 있으면 400                                                                 |
| 청구 삭제        | `open`(미납)만 가능. `paid`는 삭제 불가                                                |

---

## 7. 초대 시스템 (최신 기능)

### 이메일 초대

- `AcademyInvite` 모델 (token, email, role, status)
- SMTP: 네이버 (`INVITE_MAIL_ENABLED=true` + SMTP env)
- 플로: 생성 → 메일 발송 → `/invite/accept?token=` → 로그인/가입 → 멤버십 생성

### SMS 초대 (학부모)

- `channel: 'sms'` in AcademyInvite
- `phone` 필드 + 정규화 (`phone-normalize.ts`)
- Student에 `guardianName`/`guardianPhone` 필드
- 학부모 프로필에 전화번호·SMS 동의

### 수락 플로

- `invite-consume.ts`: 이메일/전화 매칭 → 멤버십 생성
- 강사 초대: `linkedTeacherId` 검증
- live: 가입/로그인 후 `callbackURL`로 `/invite/accept` 복귀

---

## 8. 문서 맵

| 문서                | 경로                                                       | 용도                   |
| ------------------- | ---------------------------------------------------------- | ---------------------- |
| PRD                 | `docs/PRD.md`                                              | 제품 요구·범위 정의    |
| 세션 핸드오프       | `docs/session-handoff-and-status.md`                       | 구현 스냅샷·재개 안내  |
| 컨텍스트 다이제스트 | `docs/session-context-digest.md`                           | 짧은 재개용 요약       |
| 추론 기록           | `docs/inferred-decisions-log.md`                           | 에이전트 의사결정 로그 |
| 에이전트 운영       | `AGENTS.md`                                                | Git·서브·검증·통신 톤  |
| 멀티에이전트        | `docs/multi-agent.md`                                      | 서브에이전트 워크플로  |
| 멀티에이전트 교훈   | `docs/multi-agent-lessons.md`                              | 실수 방지 히스토리     |
| 초대 메일 설계      | `docs/superpowers/specs/2026-05-15-invite-email-design.md` | SMTP 초대 스펙         |
| 개발자 체크리스트   | `docs/개발자가-처리할-항목.md`                             | 외부 키 발급·설정 항목 |
| 연동 체크리스트     | `docs/integrations-checklist.md`                           | 외부 API 연동 상태     |

---

## 9. 미구현·후속 과제

| 과제                        | 관련 영역            |
| --------------------------- | -------------------- |
| 오픈뱅킹 API 실연동         | 수납 (`BankDeposit`) |
| 학부모 영수증·알림 푸시     | 학부모 포털 `/p`     |
| SMS 실발송 연동 (현재 stub) | 초대                 |
| 다학원 추가 런타임 기능     | 플랫폼               |
| E2E 테스트 (Playwright)     | 전체                 |
| 배포 파이프라인             | DevOps               |

---

## 10. Codex 작업 시 규칙

1. **검증 필수**: 작업 완료 후 반드시 `npm run check` → `npm test` → `npm run lint` → `npm run build`
2. **학원 스코프**: 새 모델/쿼리에 항상 `academyId` 포함
3. **타입 안전**: `any`/`@ts-ignore` 금지, populate 결과는 `mongo-populate-guards.ts` 사용
4. **커밋 단위**: 논리 단위마다 커밋, 메시지는 무엇·왜 한 줄 요약
5. **시드 스크립트 버그**: `scripts/seed.ts:151` — `enb[0]._id`는 `enb._id`로 수정 필요
6. **mock 모드에서도 MongoDB 필수**: 세션만 우회, 업무 데이터는 전부 DB

---

## 11. 빠른 시작 (Codex용)

```bash
# 환경 준비
npm install
cp .env.example .env
mongod --fork --logpath /tmp/mongod.log --dbpath /data/db
npm run seed  # 에러 무시 가능 — 메인 데이터는 삽입됨

# 개발
npm run dev

# 검증
npm run check && npm test && npm run lint && npm run build
```

**활성 브랜치**: `feat/platform-invite`
**다음 우선순위**: `docs/개발자가-처리할-항목.md` 및 PRD §6–§10 참조.

---

_생성: 2026-07-08 | 기준 커밋: `34505b6` (feat/platform-invite HEAD)_
