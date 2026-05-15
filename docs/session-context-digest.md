# academy-manage — 컨텍스트 다이제스트 (신규 대화용)

> **새 대화 시작 시 이 파일만 `@`로 붙이고** 이어가면 토큰을 크게 줄일 수 있다.  
> 상세·규칙: [`session-handoff-and-status.md`](session-handoff-and-status.md), [`inferred-decisions-log.md`](inferred-decisions-log.md), [`PRD.md`](PRD.md).  
> 에이전트 기본 원칙: [AGENTS.md](../AGENTS.md) — **답·서브 요청·보고 = 본문 caveman**, 경로·계약·원문 등은 **`[CRITICAL]`** 펜스 안만 전문. 멀티에이전트: [멀티에이전트 작업 가이드](multi-agent.md) · [실수 방지 히스토리](multi-agent-lessons.md).

## 스택·목업

- SvelteKit 5, Tailwind, TS strict, Mongo + Mongoose, Better Auth.
- **`AUTH_MODE=mock`**: 세션만 고정 사용자로 대체. **DB 없이 쿠키만으로 업무 데이터를 대체하지 않음** — 데모·시연도 **`DB_URL` MongoDB 가동 + `npm run seed` 권장**.
- 학원 스코프: **`withAcademyScope()`** — `active_academy_id` httpOnly 쿠키(멤버십 검증) + `DEV_ACADEMY_ID` 폴백.
- Mock 사용자: `AUTH_MOCK_USER_ID` → `testuser` / `parent-kim` / **`superadmin`(플랫폼·시드 후)**.

## 최근 구현 스냅샷 (요약)

| 주제                   | 내용                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| 수납                   | `BankDeposit` 미매칭 입금 수기 등록, **금액 일치** 시 청구 `matchDeposit` → `Payment` `bank_import` |
| 정산                   | **`/reports`** 허브 → `/reports/course-revenue` — 월별 수납·미납, 강사는 담당 클래스만              |
| 학부모 `/p`            | 미납·납부 이력·최근 출결(읽기)                                                                      |
| 날짜                   | `seoulMonthRange`, `formatSeoulYearMonth` (`date-seoul.ts`)                                         |
| 대시보드 `/`           | 학생·클래스·수강·미납·미매칭 입금 + **보강·강사** 건수 카드                                         |
| 소통 `/communications` | 연결·학부모 멤버십·학생 수 3열 통계, 학생 관리 안내                                                 |
| 멀티에이전트 문서      | [`multi-agent.md`](multi-agent.md), [`multi-agent-lessons.md`](multi-agent-lessons.md)              |
| 다학원·초대            | `AcademyInvite`·**SMTP 메일**(`invite-mail`, `INVITE_MAIL_ENABLED`)·재발송·**`/invite/accept`** 수락 |

## 경로

- 수강: `src/routes/enrollments/*` (학생 편집 링크)
- 정산: `src/routes/reports/+page.*`, `reports/course-revenue/*`
- 포털: `src/routes/p/*`, `src/routes/+layout.server.ts`
- 대시보드: `src/routes/+page.svelte`, `+page.server.ts`
- 플랫폼: `src/routes/platform/*`, `platform/academies/[academyId]/members/*`

## 검증

`npm run check` → `npm test` → `npm run lint` → `npm run build`

## 다음 후보

수락 **비가입자 → 가입 후 복귀** UX, 은행 API, 학부모 영수증·알림. Taskplane **`integrations`(7)**.
