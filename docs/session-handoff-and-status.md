# 세션 핸드오프 · 상태 요약 (PRD와 별도 문서)

**목적**: Cursor 창 전환·에이전트·CLI 재개 실패 등으로 **연속 작업 컨텍스트가 끊길 때** 다음 세션에서 곧바로 이어갈 수 있도록, PRD에는 없는 **실제 구현·대화에서 합의한 운영 규칙**을 한곳에 묶어 둔다.
**단일 제품 근거**는 계속 **[PRD.md](PRD.md)** 이며, 본 문서에는 **합의된 구현 상태·관례 요약**만 둔다.

---

## 0. 최근 동기화 (대화 시작 시 먼저 읽기)

**최근 동기화**: 2026-05-15 — **`AcademyInvite` 초대 메일**(네이버 SMTP, `invite-mail.ts`): `createInvite` 후 `INVITE_MAIL_ENABLED` 시 발송, 실패 시 DB 유지·**`resendInvite`**·`lastEmailSentAt`/`lastEmailError`. 기본 mock·로컬은 미발송. 직전: `/invite/accept` 수락 시 멤버십 생성·`teacher-membership-link` 공유.

### 프로젝트·스택

- **스택**: SvelteKit 5, Tailwind 4, TypeScript strict, MongoDB + Mongoose, Better Auth(mock / live).
- **학원 단위 범위**: `DEV_ACADEMY_ID`, `getDefaultAcademyId()`, 페이지·서버에서 `withAcademyScope()` 사용.
- **권한(RBAC)**: PRD §6에 따라 `AcademyMembership` 과 `hooks.server.ts` 의 `locals.academyMembership`; 가드는 `src/lib/server/rbac.ts` + 각 `+page.server.ts`.
  - **수납·청구**: 학원 내 **관리자·행정**(`academy_admin`, `office` 등 고권한 스태프).
  - **강사**: 출결·보강 등 **담당 반** 범위(`linkedTeacherId`·`Course.teacherId`).
  - **학부모**: 역할 **`/p`** 학부모 포털만(내 자녀 읽기 전용)·스태프 루트는 **redirect(`/p`)** 또는 `ensureStaff*` 시 403 안내 메시지.
- **스태프 주요 라우트**: `/`, `/students`, `/teachers`, `/courses`, `/enrollments`, `/payments`, **`/reports`**(허브) → **`/reports/course-revenue`**, `/attendance`, **`/makeups`**, **`/platform`**(전체관리자) → **`/platform/academies`**

### 데이터 연쇄·삭제 규칙

| 규칙                 | 내용                                                                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **수강 삭제**        | 해당 수강의 `Attendance`, `AttendanceAuditLog`, **`MakeupSession`**, 해당 `InvoiceLine`(들), 해당 **`Payment`**(들) 정리 후 `Enrollment` 삭제. |
| **학생·클래스 삭제** | 해당 학원에서 등록된 **`Enrollment`**가 하나라도 있으면 **400** (고아 데이터 방지).                                                            |
| **강사 삭제**        | 담당 **`Course`**가 있으면 **400**.                                                                                                            |
| **청구 삭제(UI)**    | **`open`(미납)** 만 가능. **`paid`** 는 수납 이력이 연결되어 동일 플로로 미납처럼 삭제하지 않음.                                               |

### TypeScript

- `src` 에서 `any`, `@ts-ignore` 사용하지 않음.
- Mongoose `populate().lean()` 결과는 **`src/lib/server/mongo-populate-guards.ts`** 로 타입 좁힘 (`as unknown as` 연쇄 단언 최소화).

### 시드

- `npm run seed` 실행 시 **기본·분원** 두 학원의 `AcademyMembership`·`AcademyInvite`·해당 `BankDeposit`·`ParentStudentLink` 를 정리한 뒤, 나머지 컬렉션은 대략 **`BankDeposit` → `Payment` → `InvoiceLine` → `AttendanceAuditLog` → `Attendance` → `MakeupSession` → `ParentStudentLink` → `Enrollment` → `Course` → `Teacher` → `Student`** 순으로 비우고 샘플을 다시 넣는다.
- 말미에 **`testuser`·`superadmin`** 은 기본·분원 **양쪽** 멤버십, **`parent-kim`(`parent`)** 은 기본 학원만, `ParentStudentLink` 샘플(김철수 등) 포함.

### 검증 (PR·배포 전 권장)

`npm run check` → `npm test` → `npm run lint` → `npm run build`

### 다음 과제(후보)

수락 전 **비가입자 가입 후 `/invite/accept` 복귀**, **은행 오픈뱅킹 API** 실연동, 학부모 포털 **영수증·알림**, 멀티테넌트·Taskplane 후속. 초대 메일 설계: [`superpowers/specs/2026-05-15-invite-email-design.md`](superpowers/specs/2026-05-15-invite-email-design.md).

### 짧은 재개(토큰 절약)

신규 대화에는 [`session-context-digest.md`](session-context-digest.md) 만 `@`로 붙여도 된다.

**재개 프롬프트 예시**:

```text
프로젝트 academy-manage. docs/session-handoff-and-status.md §0 와 docs/inferred-decisions-log.md 최신 항목을 읽고 이어서 진행.
agent-autonomy-policy.md를 따르고 추론은 inferred-decisions-log에 남긴다.
```

---

## 1. 재개할 때 권장 순서

1. **본 문서 `§0`** 로 스택·데이터 규칙을 맞춘다.
2. **[inferred-decisions-log.md](inferred-decisions-log.md)** 최신 항목을 확인한다.
3. `git status` 등으로 브랜치·변경 목록을 본다.
4. **[PRD.md](PRD.md)** 로 범위를 교차 검증한다.
5. **`.pi/taskplane-config.json`**, **`.env.example`**, 루트 **[AGENTS.md](../AGENTS.md)** 등 환경·작업 설정을 필요 시 확인한다. 응답·서브 브리프 톤은 **AGENTS.md «통신 톤 (caveman + `[CRITICAL]`)»**.

---

## 2. 참고 문서

| 구분                    | 링크                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| 에이전트 운영(Git·서브) | [AGENTS.md](../AGENTS.md) (저장소 루트)                                                                      |
| GSD 순서                | [agent-skills-and-gsd-workflow-order.md](agent-skills-and-gsd-workflow-order.md)                             |
| 추론·정책               | [inferred-decisions-log.md](inferred-decisions-log.md), [agent-autonomy-policy.md](agent-autonomy-policy.md) |

---

## 3. 빌드·런타임

- SvelteKit(Svelte 5), Tailwind 4, TypeScript
- MongoDB + Mongoose, Better Auth
- **`AUTH_MODE=mock`** 은 **로그인·세션 검증만** 우회한다. **학원·수강·수납 등 업무 데이터는 전부 MongoDB**이므로, **목업 데모·모의 시연에서도 `DB_URL` 대상 MongoDB가 로컬·원격 가리지 않고 실행 중**이어야 한다(`connectDB()`·Mongoose 쿼리).
- **`AUTH_MODE=live`**: Better Auth 실경로 + 동일 DB 스택.
- mock 시 선택: **`AUTH_MOCK_USER_ID`**(`testuser` 기본값, 예: `parent-kim`, 플랫폼 확인 시 `superadmin`)
- 검증: `npm run check` → `npm test` → `npm run lint` → `npm run build`

---

## 4. MVP 구현 대응표(요약)

| 영역                  | 경로·비고                                                                                                                                                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 레이아웃·내비         | `Navigation.svelte`, 역할별 링크, `$app/paths` `resolve`                                                                                                                                                                |
| 인증·RBAC             | `hooks.server.ts`, `auth.ts`, `AcademyMembership`, `rbac.ts`                                                                                                                                                            |
| 학생·강사·클래스 CRUD | `/students`, `/teachers`, `/courses`                                                                                                                                                                                    |
| 수강                  | `/enrollments` (중복 삭제 시 연쇄 정리 포함)                                                                                                                                                                            |
| 출결·감사 로그        | `/attendance`, `AttendanceAuditLog`                                                                                                                                                                                     |
| 보강                  | `/makeups`                                                                                                                                                                                                              |
| 청구·수납             | `/payments`, `InvoiceLine`, `Payment`, **`BankDeposit`(입금 줄)**                                                                                                                                                       |
| 클래스 정산           | **`/reports`** → **`/reports/course-revenue`** — 월별 수납·미납 집계                                                                                                                                                    |
| 플랫폼(전체관리자)    | **`/platform`**, **`/platform/academies`**, **`/platform/academies/[id]/members`** — `Academy`·멤버·**`AcademyInvite`** 생성·철회·**SMTP 초대 메일·재발송**, **`/invite/accept?token=`** 수락 시 멤버십 생성 |
| 학부모 포털(읽기)     | **`/p`** — 연결 자녀·수강·미납·납부 이력·출결, `ParentStudentLink`                                                                                                                                                      |

**후속(PRD 대비 미구현·확장)**: 은행 API 실연동, 학부모 영수증·알림, 수락 전용 **가입(회원가입) 플로**와의 딥링크, 다학원·연동 잔여.

## 5. 핵심 파일

`src/lib/server/models/{academy,student,teacher,course,enrollment,attendance,attendance-audit-log,invoice-line,payment,bank-deposit,academy-membership,academy-invite,makeup-session,parent-student-link}.ts`, `invite-consume.ts`, `invite-mail.ts`, `invite-email-meta.ts`, `teacher-membership-link.ts`, `rbac.ts`, `academy-scope.ts`, 라우트 `src/routes/**`

---

## 6. Taskplane·남은 큰 덩어리

**`.pi/taskplane-config.json` 의 `taskAreas`**: `core` … `attendance`(1–5)에 더해 **`multiAcademy`(6)** 다학원 런타임·플랫폼, **`integrations`(7)** 외부 연동·알림을 명시해 두었다. 구체 태스크는 PRD §6·§7·§10과 이 영역 설명을 맞춰 쪼갠다.

다학원 전환·외부 결제 등은 위 Taskplane 영역·이슈 묶음에서 다룬다.

---

## 7. 에이전트 복붙 한 줄

academy-manage 학원 단위 `academyId` + 스태프 RBAC. **본 파일 §0 → inferred 로그 → PRD**.

---

## 8. 문서 수정 원칙

- 제품 요구는 **PRD**에. 여기는 **동기화 스냅샷·재개 안내**.
- 구현 추론은 **inferred-decisions-log**에 상세히.

---

_본 문서는 대화·브랜치 상태를 반영한다. 제품 정의는 PRD를 따른다._
