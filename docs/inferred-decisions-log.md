# 추론·가정 기록 (에이전트)

[agent-autonomy-policy.md](agent-autonomy-policy.md) 에 따라, 사용자 확인 없이 내린 **구현 관련 추론**을 작업 단위로 남긴다. **최신 항목이 위**에 오도록 추가한다.

---

## 기록 템플릿 (복붙)

```markdown
### YYYY-MM-DD — 짧은 제목

- **맥락**:
- **추론한 결정**:
  - …
- **대안(포기)**:
- **검증**: (예: `pnpm test` 통과 / 미실행: 이유)
```

---

## 기록

<!-- 새 항목은 이 섹션 맨 위(가장 최근 날짜 아래가 아니라, 기록 제목 최상단)에 추가 -->

### 2026-09-10 — 학원 공지(Announcement) 포털 게시

- **맥락**: 후속「소통·공지」— 외부 계약 불필요한 인앱 공지. SMS·푸시 대량 발송은 계약 후 과제로 분리.
- **추론한 결정**:
  - **`Announcement` 모델**: `academyId`·`title`(≤120)·`body`(≤4000)·`createdByUserId`, 인덱스 `{academyId:1, createdAt:-1}`.
  - **발행 권한**: **관리자·행정·super_admin만**(`gateCommunicationsAction` 신설, `isElevatedStaffRole`). 강사는 담당 반 스코프라 학원 단 공지에서 제외.
  - **열람**: `/communications` 최근 20건 목록·삭제, `/p`는 `communicationsEnabled`·`parentPortalEnabled` 게이트 하 최근 10건. `communicationsEnabled` off면 학부모에게도 숨김(PRD §6.6 플래그 의미 존중).
- **대안(포기)**: 강사 발행 허용(스코프 모호), 공지 대상 반 선택(MVP 후), 발행 시 푸시 자동 발송(대량 발송은 SMS 계약·동의 정책과 함께 별도 과제).
- **검증**: `npm run check` · `npm test`(146 통과) · `npm run lint` · `npm run build`.

### 2026-09-10 — 기능 플래그·Web Push·입금 매칭 제안(외부 계약 불필요 슬라이스)

- **맥락**: 사용자 지시「외부 연결 없이 완료 가능한 것 전부」— PRD §6.6 플래그, 푸시 실발송, §7.3 입금 자동화의 코드 가능 부분.
- **추론한 결정**:
  - **플래그 기본값**: `parentPortalEnabled`·`communicationsEnabled` = `true`(현행 동작 보존), `billingAutoImport` = `false`. 기존 문서 미설정 필드는 기본값 취급(`academy-flags.ts`). 토글 UI는 **`/platform/academies`** 표 안(super_admin).
  - **Web Push**: `PUSH_VAPID_PUBLIC_KEY`·`PUSH_VAPID_PRIVATE_KEY`(·선택 `PUSH_VAPID_SUBJECT`) + 구독 키(`pushSubscription` = `{endpoint, keys.p256dh, keys.auth}`를 user 컬렉션에 저장)가 모두 있으면 `web-push` 실발송, 아니면 기존 스텁 sent. 레거시 `pushSubscriptionEndpoint`-only 구독은 keys null로 하위호환. `sendPaymentDuePush`에 `sendWebPush` 주입점 추가(테스트용).
  - **입금 자동 매칭**: 제안까지만 자동(`deposit-matching.ts` 순수 함수 — 금액 일치 + memo에 학생명 포함 → high, 후보 1개 → medium), **확정은 기존 `matchDeposit` 수동 경로** 그대로(PRD §7.3 수기 수납 병행). 제안 UI는 `billingAutoImport` 학원의 `/payments` 미매칭 입금에 라인 미리선택+신뢰도 배지.
  - **재확인**: 초대→가입 딥링크(`need_login` → `/auth/sign-in?callbackURL=` 가입 후 수락 폼 재제출)·다학원 전환(`buildAcademySwitcherData` + `setActiveAcademy`)은 **이미 구현되어 있었음** — 핸드오프 문서 후속 목록 stale 정정.
  - **`scripts/seed.ts:156`** `enb[0]._id` → `enb._id` 수정(Cursor 문서에서 지적된 실버그, `enb`가 이미 문서 객체).
  - **원격 정리**: GitHub 기본 브랜치 `main` 전환, stale 브랜치 원격 삭제, `docs/codex-full-context.md` 신설(Cursor 전체컨텍스트 문서 보존).
- **대안(포기)**: 플래그 토글을 `/settings/members`에 두기(원장 페이지 범위 벗어남), Web Push를 FCM 전환(외부 의존·자체 키 발급 불필요한 Web Push가 요구에 부합), 매칭 자동 확정(PRD 수기 병행 원칙 위반), 가입 플로 신규 구현(기존 구현 재발견).
- **검증**: `npm run check` · `npm test` · `npm run lint` · `npm run build` 슬라이스마다 실행.

### 2026-05-29 — 학부모 납부 안내 이메일·푸시 스텁

- **맥락**: 후속 C — SMS 외 이메일·푸시 채널.
- **추론한 결정**:
  - **`emailNotifyConsentAt`·`pushNotifyConsentAt`·`pushSubscriptionEndpoint`** — Better Auth `user` 문서·`/p/settings` 저장.
  - **이메일**: `PARENT_NOTIFY_EMAIL_ENABLED` + 기존 SMTP env 시 실발송, 없으면 스텁 `sent`.
  - **푸시**: `PARENT_NOTIFY_PUSH_ENABLED` + 구독 ID 8자+ 스텁.
  - **`/payments`**: 미납 행 **SMS / 이메일 / 푸시** 각각 수동 발송.
- **대안(포기)**: Web Push 구독 UI·FCM 연동, 자동 발송.
- **검증**: `npm run check` · `npm test` · `npm run lint` · `npm run build`.

### 2026-05-29 — 학부모 납부 안내 SMS 스텁

- **맥락**: 핸드오프 후속 `integrations` — 알림·동의 UI(`/p/settings`)는 있으나 발송 경로 없음.
- **추론한 결정**:
  - **`parent-notify-sms.ts`**: `PARENT_NOTIFY_SMS_ENABLED=true` 시 스텁 `sent`; trial 학원은 `academyBlocksExternalComms`로 차단.
  - **수신자**: `ParentStudentLink` + Better Auth `user`의 `phone`·`smsMarketingConsentAt`만(보호자 번호만 있는 경우는 안내 링크 유도).
  - **트리거**: 스태ff `/payments` 미납 청구 행 **「납부 안내 SMS」** 수동(자동 발송·이메일·푸시는 비범위).
  - **`user-profile-read.ts`**: `/p/settings`와 공유.
- **대안(포기)**: `Student.guardianPhone` 무동의 발송, 청구 생성 시 자동 SMS.
- **검증**: `npm run check` · `npm test` · `npm run lint` · `npm run build`.

### 2026-05-29 — Lead·대기·공개 신청

- **맥락**: 설계 `2026-05-28-platform-and-academy-leads-design.md` Part B.
- **추론한 결정**:
  - `Lead` 상태에 `enrolled` 없음; 첫 `Enrollment` 시 `enrolledAt`만 설정.
  - `/settings/members`는 원장·super_admin만; 초대 역할 `office`·`teacher`·`parent` (원장은 플랫폼 문의 승인).
  - `/apply`는 `trial`|`active` 학원만.
- **대안(포기)**: 학원별 slug URL; Lead 중복 phone 자동 병합.
- **검증**: `npm run check` · `npm test` · `npm run lint` · `npm run build`.

### 2026-05-29 — 플랫폼 학원 등록 문의·trial

- **맥락**: [docs/superpowers/specs/2026-05-28-platform-and-academy-leads-design.md](superpowers/specs/2026-05-28-platform-and-academy-leads-design.md), [plans/2026-05-28-platform-academy-inquiry.md](superpowers/plans/2026-05-28-platform-academy-inquiry.md).
- **추론한 결정**:
  - **`AcademyInquiry`**: 공개 **`/academy-inquiry`** POST → `status=new`; super_admin **`/platform/inquiries`**에서 `contacted`·**`approveTrial`**(기본 7일)·**`approveActive`**·`reject`.
  - **`approveInquiryToTrial`**: `Academy(status=trial, trialEndsAt)` + 원장 `academy_admin` **`AcademyInvite`**; trial 중 **`invite-mail`·`invite-sms` 차단**(`academyBlocksExternalComms`).
  - **만료**: `isTrialExpired` → `academyOperationalStatus=trial_locked`; 스태ff **`+layout.server.ts`** → **`/trial-expired`**(플랫폼·인증·문의·학부모 포털 제외).
  - **`/platform/academies`**: `trial` 배지·`trialEndsAt`; `reactivateAcademy`는 `inactive`만(trial→active는 inquiries 경로).
- **대안(포기)**: trial 학원에서 초대 URL만 복사(차단 일원화), 만료 후 parent 차단(현재 parent는 `academyAllowsResolvedContext`로 유지).
- **검증**: `npm run check` → `npm test` → `npm run lint` → `npm run build`.

### 2026-05-19 — 학부모 SMS 초대·보호자 연락처 구현

- **맥락**: [docs/superpowers/specs/2026-05-19-invite-sms-phone-design.md](superpowers/specs/2026-05-19-invite-sms-phone-design.md), [plans/2026-05-19-invite-sms-phone.md](superpowers/plans/2026-05-19-invite-sms-phone.md).
- **추론한 결정**:
  - **`AcademyInvite`**: parent는 `phone`만, 스태ff는 `email`만; 수락 parent는 **토큰-only**.
  - **`invite-sms.ts`**: `INVITE_SMS_ENABLED` 스텁; 미설정 시 URL 복사.
  - **`Student.guardianPhone`**, 학생 편집·플랫폼 멤버 SMS UI; **`/p/settings`** 연락·SMS 동의.
- **대안(포기)**: OAuth 전화 엄격 일치, SMS OTP, 실 알리고·솔라피 HTTP(후속).
- **검증**: `npm run check` → `npm test` → `npm run lint` → `npm run build`.

### 2026-05-19 — Live 소셜 OAuth 구현

- **맥락**: [docs/superpowers/specs/2026-05-19-live-oauth-design.md](superpowers/specs/2026-05-19-live-oauth-design.md), [plans/2026-05-19-live-oauth.md](superpowers/plans/2026-05-19-live-oauth.md).
- **추론한 결정**:
  - **`auth-social.ts`**: env 있는 제공자만 `socialProviders` 등록.
  - **`terms-gate` + `/auth/accept-terms`**: live 최초 약관; Mongo 폴백으로 `termsAcceptedAt` 갱신.
  - **`/auth/sign-in`**: 모바일 소셜 우선; `inviteEmail` 시만 이메일·비밀번호.
  - **초대 수락 UI**: live 시 「카카오로 계속」 CTA.
  - **SMS·전화 초대·대기 큐** 후속.
- **검증**: `npm run check` · `npm test`(52) · `npm run lint` · `npm run build`.

### 2026-05-19 — Live 소셜 OAuth 설계 (brainstorming 승인)

- **맥락**: [docs/superpowers/specs/2026-05-19-live-oauth-design.md](superpowers/specs/2026-05-19-live-oauth-design.md).
- **추론한 결정**:
  - **소셜 3종 동시**(카카오·네이버·구글); mock은 소셜 비노출.
  - **스태프** 이메일 초대·수락 시 **이메일 엄격 일치**; **학부모** 일반 가입은 소셜만·`ParentStudentLink` 연결.
  - **약관** 최초 가입 1회; `inviteEmail` 있을 때만 이메일·비밀번호 보조 UI.
  - **SMS·전화 초대·대기 대시보드**는 본 구현 범위 밖(후속 스펙).
- **검증**: 구현 완료 항목 위 참조.

### 2026-05-15 — 비가입자 가입·로그인 후 `/invite/accept` 복귀

- **맥락**: 초대 수락 UI에서 `need_login`·`email_mismatch` 시 인증 유도; live는 Better Auth 이메일·비밀번호, mock은 `AUTH_MOCK_USER_ID` 안내.
- **추론한 결정**:
  - **`invite-return.ts`**: `sanitizeInviteCallbackURL`로 `/invite/accept?token=` 만 허용; `buildInviteAcceptReturnPath`·`buildInviteAuthSignInSearch`로 sign-in 쿼리 조립.
  - **`/auth/sign-in`**: `callbackURL`·`inviteEmail` 쿼리; live `signIn.email`/`signUp.email` 후 callback; mock은 프로필·`mockUserIdForInviteEmail` 힌트.
  - **`/invite/accept`**: GET form + `resolve()` + hidden `token`/`callbackURL`/`inviteEmail` — `svelte/no-navigation-without-resolve` 준수.
  - **mock**: `mock-invite-auth.ts`에서 초대 이메일→mock userId 매핑 힌트.
- **검증**: `npm run check` · `npm test`(46) · `npm run lint` · `npm run build`.

### 2026-05-15 — AcademyInvite 초대 메일 (네이버 SMTP)

- **맥락**: [docs/superpowers/specs/2026-05-15-invite-email-design.md](superpowers/specs/2026-05-15-invite-email-design.md) 승인 후 구현.
- **추론한 결정**:
  - **`invite-mail.ts`**: `INVITE_MAIL_ENABLED=true` + SMTP env 있을 때만 nodemailer 발송; mock 여부와 무관.
  - **실패(D)**: `createInvite` DB 유지 + `lastEmailError`·목록 재발송·URL 복사; redirect `?notice=` flash.
  - **수락 URL**: `PUBLIC_APP_ORIGIN` → `BETTER_AUTH_URL` → 요청 `origin`.
  - **`AcademyInvite`**: `lastEmailSentAt`, `lastEmailError`.
- **검증**: `npm run check` · `npm test` · `npm run lint` · `npm run build`.

### 2026-05-13 — 초대 수락으로 `AcademyMembership` 생성

- **맥락**: 다이제스트·핸드오프 후속 — 토큰 수락 시 DB 멤버십 반영.
- **추론한 결정**:
  - **`consumeAcademyInviteForLoggedInUser`**(`src/lib/server/invite-consume.ts`): 세션 `user.email` 정규화값과 초대 `email` 일치 필수; live 시 `liveBetterAuthUserExists`; 강사 초대는 `linkedTeacherId` 있을 때만 `assertTeacherLinkValid`; 생성 후 `AcademyInvite` 삭제.
  - **`assertTeacherLinkValid`** + **`TEACHER_INVITE_PENDING_USER_ID`** 를 **`src/lib/server/teacher-membership-link.ts`** 로 이동해 플랫폼 멤버 `createInvite` 와 공유.
  - **`/invite/accept`**: `load` 에 `acceptUi`(로그인·이메일 불일치 등); `acceptInvite` 액션 성공 시 **`/`** 로 리다이렉트.
- **검증**: `npm run check` · `npm test` · `npm run lint` · `npm run build`.

### 2026-05-13 — 핸드오프 §4·§5·README 동기화(초대 MVP 반영)

- **맥락**: §0·다이제스트는 `AcademyInvite`·`/invite/accept` 스텁을 반영했으나 §4 표·후속 문장·핵심 파일 목록·루트 README는 구버전에 가까움.
- **추론한 결정**:
  - **`session-handoff-and-status.md` §4**: 플랫폼 행에 멤버·초대·수락 스텁 명시; 후속에서「이메일 초대」를 **발송·수락 시 멤버십 자동 반영**으로 쪼개어 §0와 모순 제거.
  - **§5**: `academy-invite` 모델 경로를 목록에 추가.
  - **`README.md`**: 프로젝트 한 줄·스택·문서 링크·실행·검증만 최소 기술(기본 `sv` 보일러플레이트 대체).
- **검증**: `npm run check` · `npm test` · `npm run lint` · `npm run build`.

### 2026-05-13 — 플랫폼 멤버 이메일 초대 MVP

- **맥락**: 사용자「무한 반복 완성·멀티에이전트」— digest 후보였던 플랫폼 초대 착수.
- **추론한 결정**:
  - **`AcademyInvite`** 모델(`src/lib/server/models/academy-invite.ts`): `academyId`+`email` 유니크, `token` 유니크, 만료 14일, teacher 시 `linkedTeacherId` 선택·`assertTeacherLinkValid` 재사용(배제용 `__invite_pending__`).
  - **`/platform/academies/[academyId]/members`**: `createInvite`·`revokeInvite`, 목록·수락 URL(`inviteAcceptOrigin`+`resolve('/invite/accept')`).
  - **`/invite/accept`**: 공개 스텁 페이지 — 토큰 검증·만료 안내; 자동 멤버십 생성 없음(MVP).
  - **`scripts/seed.ts`**: `AcademyInvite` 해당 학원 ID 범위 삭제.
- **검증**: `npm run check` · `npm test` · `npm run lint` · `npm run build`.

### 2026-05-13 — 사용자·서브 통신: 항상 caveman + `[CRITICAL]` 전문

- **맥락**: 사용자 지시 — 앞으로 사용자에게 주는 응답은 **항상 caveman**, 다만 크리티컬 정보는 **`[CRITICAL]`** 안에서만 생략·요약 없이; 서브에이전트 요청도 동일 적용 가능해야 함. 표준 파일명은 **`AGENTS.md`** (`AGENT.md` 아님).
- **추론한 결정**:
  - **`AGENTS.md`**: «통신 톤 (caveman + `[CRITICAL]`)» 절 신설. 사용자 답·서브 브리프·서브 완료 보고 동일 규칙.
  - **`multi-agent.md`**: 예전 «사용자는 일반 톤» 문구 삭제, 템플릿과 AGENTS 정렬.
  - **`session-context-digest.md`**, **`session-handoff-and-status.md`**, **`PRD.md` 헤더**, **`web-project-common.md`**: 한 줄로 상호 참조.
- **검증**: 문서만.

### 2026-05-13 — 문서 동기화: mock·MongoDB·서브 caveman 명문화

- **맥락**: 사용자 확인 — 대화 말미 합의(`AUTH_MODE=mock` 은 세션만 우회·업무 데이터는 MongoDB 필수, caveman은 서브 브리프용)가 **핸드오프·다이제스트·AGENTS**와 논리적으로 맞는지.
- **추론한 결정**:
  - **`session-handoff-and-status.md` §0·§3**, **`session-context-digest.md`**, **`.env.example` 주석**: mock 이어도 **`DB_URL` MongoDB 가동** 필요를 명문화.
  - **`AGENTS.md`**, **`multi-agent.md`**: caveman은 **서브 전달용**; 사용자 대화 톤과 혼동 금지.
  - **`session-handoff` §4** 후속: 다학원 일부 구현 반영, 잔여를 이메일 초대 등으로 구체화.
- **검증**: 문서 일관성만; 빌드 불필요.

### 2026-05-13 — 비활성 스태프 레이아웃 가드·live 멤버 userId 검증

- **맥락**: 사용자 요청 — 완성도·데모·안전.
- **추론한 결정**:
  - **`ResolvedAcademyContext.academyOperationalStatus`**: `hooks` 가 `locals.academyOperationalStatus` 에 설정.
  - **`+layout.server.ts`**: `/p` 제외 스태프 경로에서 **비활성 학원**이고 역할이 **`super_admin` 이 아니면** `403` (내비에서 활성 학원으로 전환 안내).
  - **`liveBetterAuthUserExists`**: `AUTH_MODE=live` 일 때 플랫폼 `addMember` 가 Better Auth `academy-db.user` 에 `id`/`userId` 존재 여부 확인. mock 은 스킵(true).
- **검증**: `npm run check` · `npm test` · `npm run lint` · `npm run build`.

### 2026-05-11 — 데모용 시드 2학원(분원)·환경 변수

- **맥락**: 사용자「데모가 급해」— 다학원 전환 UI를 시연 가능하게.
- **추론한 결정**:
  - **`scripts/seed.ts`**: 고정 `academyIdB`(기본 `507f1f77bcf86cd799439022`, `DEV_ACADEMY_SECOND_ID`로 덮어쓰기)에 **분원** `Academy` upsert, 강사·반·학생·수강·미납 청구 1건 최소 시드.
  - **`superadmin`·`testuser`**: 기본 학원·분원 **양쪽** `AcademyMembership`(각각 `super_admin`, `academy_admin`). `parent-kim`은 기본 학원만(자녀 연결 유지).
  - **정리 범위**: `AcademyMembership`·`BankDeposit`·`ParentStudentLink` 는 두 학원 ID `$in` 삭제 후 재생성. 나머지 컬렉션은 기존처럼 전역 비우기.
  - **`.env.example`**: `DEV_ACADEMY_SECOND_ID` 주석 안내.
- **검증**: `npm run check` · `npm test` · `npm run lint` · `npm run build`.

### 2026-05-11 — 학부모 비활성 학원·강사 linkedTeacherId (플랫폼)

- **맥락**: 사용자「진행」— 다학원 후속(다이제스트 후보).
- **추론한 결정**:
  - **`academyAllowsResolvedContext`**: 비활성 학원은 **`super_admin` 또는 `parent`** 만 쿠키/해석/스위처에 사용(학부모 포털 열람). **`academyAllowsStaffContext`** 는 기존 의미(비활성 시 super_admin만 업무) 유지.
  - **`/p`**: `Academy.status`를 읽어 `academyOperationalStatus === 'inactive'`이면 안내 배너.
  - **`/platform/.../members`**: `teacher` 멤버에 **`Teacher` 문서 연결**(`linkedTeacherId`), 학원 소속 검증·타 계정 중복 연결 방지, 행 단위 **`updateLinkedTeacher`** 액션.
- **검증**: `npm run check` · `npm test` · `npm run lint` · `npm run build`.

### 2026-05-13 — 비활성 학원 스코프·플랫폼 멤버 관리

- **맥락**: 사용자「진행」— 다학원 후속.
- **추론한 결정**:
  - **`academyAllowsStaffContext`**: 학원 `inactive`이면 **`super_admin` 멤버십만** “스태프 업무” 관점에서 허용(의미 유지).
  - **`academyAllowsResolvedContext`**(후속 추가): 비활성은 **`super_admin` 또는 `parent`** — 쿠키·`resolveActiveAcademyContext`·`buildAcademySwitcherData`·`setActiveAcademy`에 사용.
  - **`/platform/academies/[academyId]/members`**: 멤버 목록, **`super_admin` 제외 역할** 추가, 삭제 시 **마지막 super_admin 1명** 보호.
- **검증**: `npm run check` · `npm test` · `npm run lint` · `npm run build`.

### 2026-05-13 — 다학원 2단계: 활성 학원 쿠키·플랫폼 학원 CRUD(부분)

- **맥락**: 사용자「진행」— 1단계 `Academy`·`/platform` 이후.
- **추론한 결정**:
  - **`resolveActiveAcademyContext`**(`active-academy.ts`): 쿠키(hex)·기본 학원·첫 멤버십 순으로 활성 학원·멤버십 결정; `hooks` 에서 `locals.activeAcademyId` 설정.
  - **`withAcademyScope`**: `getRequestEvent().locals.activeAcademyId` 우선, 없으면 `DEV_ACADEMY_ID`.
  - **내비**: 소속 학원 2개 이상일 때만 `활성 학원` select + POST **`/?/setActiveAcademy`** (`+page.server.ts` — SvelteKit은 `+layout.server`에 `actions` 불가).
  - **`/platform/academies`**: `createAcademy`(생성 시 현재 사용자 `super_admin` 멤버십 부여), `deactivateAcademy`(`DEV_ACADEMY_ID` 학원은 금지), `reactivateAcademy`.
- **검증**: `npm run check` · `npm test` · `npm run lint` · `npm run build`.

### 2026-05-12 — 다학원 1단계: Academy 모델·시드·플랫폼 조회

- **맥락**: 사용자「안전한 방향으로 에이전트 모드로. 가능한한 멀티에이전트로」— 런타임 단일 학원(`DEV_ACADEMY_ID`)은 유지하고 스키마·UI만 확장.
- **추론한 결정**:
  - **`Academy`** Mongoose 모델(`name`, `status` active/inactive, timestamps). 시드에서 `DEV_ACADEMY_ID` 와 동일 `_id` 로 **upsert** 해 기존 데이터와 정합.
  - 시드에 **`superadmin` + `super_admin`** 멤버십 추가; mock 프로필 `superadmin` 등록. **`AUTH_MOCK_USER_ID=superadmin`** 일 때만 `/platform/*` 접근.
  - **`ensurePlatformSuperAdmin`**, `super_admin` 전용 내비 첫 항목 `플랫폼`, **`/platform`**, **`/platform/academies`** 학원 목록 조회 전용(생성·비활성화는 다음 단계).
- **대안(포기)**: 이번 단계에서 활성 학원 쿠키·`withAcademyScope` 변경 없음(회귀 방지).
- **검증**: `npm run check` · `npm test` · `npm run lint` · `npm run build`.

### 2026-05-12 — Taskplane에 다학원·연동 영역 추가

- **맥락**: 사용자「다학원·Taskplane」— 문서·설정에 후속 에픽을 명시.
- **추론한 결정**:
  - 코드는 `academyId`·`AcademyMembership`으로 **데이터 멀티테넌트**가 가능하나, `getDefaultAcademyId()` / `hooks` 가 **단일 학원**만 바인딩함을 전제로 함.
  - `.pi/taskplane-config.json` 에 `taskAreas.multiAcademy`(priority 6), `integrations`(7) 추가.
  - `session-handoff-and-status.md` §6, `session-context-digest.md` 다음 후보에 위 설정을 가리키도록 갱신.
- **검증**: 해당 JSON·Markdown만 변경(빌드 불필요).

### 2026-05-12 — `/reports` 리포트 허브·내비 정렬

- **맥락**: 사용자「현황 판단하고 계속 진행해」— PRD §10에 `/reports` 가 있으나 구현은 `/reports/course-revenue` 직링크만 존재.
- **추론한 결정**:
  - `src/routes/reports/+page.*` 추가: 스태프만 접근, **클래스별 정산**으로의 카드 링크.
  - `rbac` 내비의 `클래스 정산` 직링크를 **`/reports` · 라벨 `리포트`** 로 변경(강사·전체 동일).
  - 정산 상세 상단에 `← 리포트` 상위 링크.
- **대안(포기)**: 대시보드에 별도 리포트 카드 추가 — 내비로 충분해 생략.
- **검증**: `npm run check` · `npm test` · `npm run lint` · `npm run build`.

### 2026-05-12 — 대시보드 보강·강사 수·수강표 학생 편집 링크

- **맥락**: 사용자「진행」— 트랙 I(홈)·D(수강) 분리.
- **추론한 결정**:
  - **`/`** — `MakeupSession`·`Teacher` 건수를 `Promise.all`에 추가, 2열 카드로 보강·강사 관리 진입.
  - **`/enrollments`** — 학생명 필터 링크 유지 + **학생 편집** 열에서 `/students/[id]/edit` 로 이동.
- **검증**: `npm run check` · `npm test` · `npm run lint`.

### 2026-05-12 — 소통 통계 확장·학부모 포털 납부 기한 안내

- **맥락**: 사용자「진행」— 멀티에이전트 트랙 G/C 분리로 후속 MVP 보강.
- **추론한 결정**:
  - **`/communications`** — `AcademyMembership`(역할 `parent`) 수·`Student` 수를 `ParentStudentLink`와 함께 3열 카드로 표시, 학생 관리로 연결 안내.
  - **`/p`** — 미납 청구 중 **가장 빠른 `dueDate`** 를 `earliestOpenDueDate` 로 내려 amber 안내 배너.
- **검증**: `npm run check` · `npm test` · `npm run lint` · `npm run build`.

### 2026-05-12 — 멀티에이전트 가이드 문서·대시보드·소통 플레이스홀더

- **맥락**: 사용자 피드백 — 멀티에이전트 문서가 없다고 느껴짐(실제로는 `multi-agent-lessons.md` 만 있었고 메인 가이드 없음). 이후 작업 진행 요청.
- **추론한 결정**:
  - **`docs/multi-agent.md`** — 절차·트랙 분할·검증·관련 문서 링크(엔트리 포인트).
  - **`docs/multi-agent-lessons.md`** — 누락된 `###` 제목(공유 파일 섹션) 정리, 상단에 `multi-agent.md` 링크.
  - **PRD §13** · **session-context-digest** 에 위 문서들 링크.
  - **대시보드** `+page.server.ts` / `+page.svelte` — 학원 스코프 집계 카드(학생·클래스·수강·미납 청구).
  - **`/communications`** — PRD G 성격의 준비 중 페이지, **내비**는 `rbac.ts` 에 `소통` 링크(전체·강사 메뉴).
- **검증**: `npm run check` · `npm test` · `npm run lint` · `npm run build` 통과.

### 2026-05-12 — 스텁 입금 등록·CSV 내보내기 안정화 (멀티에이전트)

- **맥락**: 사용자 요청으로 병렬 트랙에서 수납(F)·정산(H) 후속 구현.
- **추론한 결정**:
  - **`importOpenBankingStubDeposit`** — 스텁 행을 `BankDeposit` 으로 옮길 때 서버에서 스텁을 재계산해 위조 방지, `OPEN_BANKING_ENABLED` 게이트, `externalRef` 중복 방지.
  - **CSV `export/+server.ts`** — `withAcademyScope`·집계를 try/catch 하고 실패 시 **503** + plain text(한글 메시지).
- **검증**: `npm run check`, `npm test`, `npm run lint`, `npm run build` 통과.

### 2026-05-12 — 멀티에이전트 실수 방지 로그 (`multi-agent-lessons.md`)

- **맥락**: 병렬 서브에이전트 작업을 이어가면서, ESLint·빌드·폼 중첩·테스트 CLI 등에서 **반복된 이슈**를 히스토리로 남길 요청.
- **추론한 결정**:
  - **`docs/multi-agent-lessons.md`** — 증상·원인·조치·트랙 분할 예시·검증 순서를 한곳에 정리.
  - 이후 멀티에이전트 작업 시 **`@docs/multi-agent-lessons.md`** 를 함께 참조하도록 문서·요약에 링크 가능.
- **대안(포기)**: 매 세션마다 긴 채팅 요약에만 의존(검색·재사용 어려움).
- **검증**: 저장소 문서 추가만(코드 변경 없음).

### 2026-05-12 — 세션 컨텍스트 다이제스트·핸드오프 UTF-8 재생성

- **맥락**: 대화 컨텍스트 점유가 높아 **신규 대화에서 토큰을 줄일** 요약이 필요함.
- **추론한 결정**:
  - **`docs/session-context-digest.md`** — 새 채팅 시 `@`만으로 재개 가능한 초소형 스냅샷(수납·입금 매칭·클래스 정산·`/p`·경로·검증 명령).
  - **`scripts/regenerate-session-handoff.py`** — 최근 동기화 문구·라우트·시드 삭제 순서(`BankDeposit`)·MVP 표에 정산·입금 반영 후 `session-handoff-and-status.md` 재생성(UTF-8).
- **대안(포기)**: Cursor 채팅 토큰 자체를 줄이는 것은 IDE **`/compress`** 등 제품 기능에 의존(에이전트가 MCP `ctx_*`로 현재 세션 컨텍스트를 직접 압축할 수는 없음).
- **검증**: `python scripts/regenerate-session-handoff.py`, `npx prettier` 적용.

### 2026-05-11 — 학부모 `/p` 미납 청구·최근 출결 요약(읽기)

- **맥락**: 사용자「진행」— 학부모 포털에 PRD 성격의 **미납·출결 노출**(수정 불가).
- **추론한 결정**:
  - `InvoiceLine` 중 `status: 'open'` 이면서 `enrollmentId`가 연결 자녀 수강(`Enrollment`)에 포함된 행만. 정렬 납부기한·`createdAt` 보조.
  - `Attendance` 같은 범위, `sessionDate` 내림차, 상한 **48건**(상수 서버 노출해 UI 문구와 일치).
  - 학생 카드 블록 하단에 **미납 청구**·**최근 출결** 테이블(배지·원화 표기).
  - 시드에 김철수 첫 수강(`ens[0]`) 출석·지각 2건 추가로 `parent-kim` 데모에 출결 줄이 나오도록 함.
- **대안(포기)**: 납부 처리·결석 이유 수정, 이메일/푸시 알림 — 범위 밖.
- **검증**: `npm run check`, `npm test`, `npm run lint`, `npm run build`(실행 확인).

### 2026-05-11 — 학부모 포털 `/p`(읽기 MVP) · mock 사용자 전환 PRD 준거

- **맥락**: 사용자「진행」— handoff 우선 과제 후보였던 학부모 포털을 외부 API 없이 로컬로 닫을 수 있는 범위로 개방. `ParentStudentLink` 및 시드 샘플 `parent-kim`이 이미 있음.
- **추론한 결정**:
  - 루트 `+layout.server.ts`: 학부모 멤버십이면 모든 비-`/p` 경로에서 **`redirect(303,'/p')`**. 역으로 스태프·강사는 **`/p`** 접근 시 **`redirect(303,'/')`** .
  - `/p/+page`(읽기): 연결 학생·수강, **미납 청구(`InvoiceLine.open`)**, **최근 출결(`Attendance` 상위 48건)**. 수정 없음.
  - `rbac.ts`: **`NAV_LINKS_PARENT`**(라벨 「내 자녀」·경로 `/p`), `navLinksForRole('parent')` 활성화. `ensureStaffAcademyMember` 의 학부모 메시지는 스태프 경로 차단 안내로 갱신.
  - 목업 세션 전환: `AUTH_MOCK_USER_ID` 선택 env — `MOCK_USER_PROFILES`에 등록된 키만(예: `testuser`, `parent-kim`). 미지정·알 수 없음이면 **`testuser`** .
  - `Navigation`: `portalBrand`(학원 관리 / 학부모 포털).
- **대안(포기)**: 학부모 전용 레이아웃 그룹 분리(`/p` 전용 새 루트), 추가 KPI·세부 차트 등 — 후속으로 분리했다.
- **검증**: `npm run check`, `npm test`, `npm run lint`, `npm run build` 통과 확인.

### 2026-05-12 — `ParentStudentLink` 및 학생 편집 학부모 연결 UI (PRD §6.2)

- **맥락**: 사용자「진행」— 외부 키·계약 의존(OAuth·은행 API) 작업은 막혀 있고, 도메인·내부 UI만으로 닫을 수 있는 PRD §6.2(학부모–자녀 연결)가 다음 자연 단계로 판단됨. 이는 향후 학부모 포털(`/p/*`)의 기반이 됨.
- **추론한 결정**:
  - 모델 `ParentStudentLink`: `academyId`, `parentUserId`(Better Auth user.id 문자열), `studentId`(ref `Student`). 유일 인덱스 `(academyId, parentUserId, studentId)`; 보조 인덱스 `academyId`/`parentUserId`/`studentId`.
  - 연결 관리 권한은 **관리자·행정**(`gateDirectoryAction`)으로 제한. PRD §6.2는 강사 포함이나, 강사 학생 디렉터리 접근은 별도 RBAC 변경이 필요해 본 작업 밖.
  - 학부모 후보는 같은 학원의 `AcademyMembership.role='parent'` 사용자로 한정(Better Auth `user` 컬렉션은 mock 모드에 없어 직접 의존하지 않음). 라벨은 `parentUserId` 자체로 노출.
  - `students/[id]/edit` 라우트 확장:
    - `load`에 `linkedParents`, `candidateParents` 분리 반환.
    - `linkParent`/`unlinkParent` 액션. `parentUserId` 입력은 `^[A-Za-z0-9._@:+-]{1,128}$` 정규식으로 검증.
    - 중복 삽입은 Mongo `11000`을 「이미 연결된 학부모」로 변환.
  - 학생 삭제(`/students` `delete`) 시 `ParentStudentLink.deleteMany({academyId, studentId})` 로 cascade 정리. 수강(`Enrollment`)은 기존대로 **잔여 시 차단**(이력 보존).
  - 시드: 삭제 순서에 `ParentStudentLink` 포함, 샘플 학부모 멤버십(`parent-kim`, role `parent`) + 김철수 학생 연결 1건.
- **대안(포기)**:
  - 강사도 연결 가능하게 RBAC 확장 — 학생 디렉터리 전체 접근이 필요해 별도 작업으로 분리.
  - `Student.parentUserIds` 배열 임베드 — 학부모 측 역조회·삭제 정합이 어려워 별 컬렉션 채택.
  - 학부모 가장 로그인·`/p/*` 포털 — 본 단계 범위 밖. 모델·연결 관리 UI만 우선 닫고, 포털은 후속 작업.
- **검증**: `npm run check`(0 errors), `npm test`(7 files / 17 tests pass), `npm run lint`(prettier+eslint clean), `npm run build` 성공.

### 2026-05-11 — 수납 `Payment` 이력·`markPaid` 연동 (PRD §7)

- **맥락**: 사용자「진행」— 청구(`InvoiceLine`)만 있고 금원 수납 기록 컬렉션이 없어 PRD 입금 매칭·수기 수납의 전제가 부족함.
- **추론한 결정**:
  - Mongoose `Payment`: `academyId`, `invoiceLineId`, `amountKrw`, `method`(`manual`|`bank_import`), `recordedByUserId`(Better Auth `user.id`), `paidAt`, 선택 `note`·`externalRef`.
  - `markPaid`: `status:'open'`인 라인만 `findOneAndUpdate`로 `paid`+`paidAt` 설정 후 `Payment.create`; `create` 실패 시 청구를 `open`으로 되돌리고 `paidAt` 제거. 동시 요청은 한 건만 성공하고 나머지는 「이미 처리」.
  - `/payments` load: 학원별 최근 30건, `invoiceLine`→`enrollment`→학생·클래스 이름 populate·화면 표. 시드: `InvoiceLine` 삭제 전 `Payment.deleteMany`. 수강 삭제: 해당 청구 id로 `Payment` 선삭제.
- **대안(포기)**: 멀티 페이먼트·부분 납부·환불 도메인 — MVP는 1청구 1완납·수기 1건 기록.
- **검증**: `npm run check`, `npm test`, `npm run lint`, `npm run build`.

### 2026-05-11 — 보강 `MakeupSession`·`/makeups` (PRD §8)

- **맥락**: 사용자「진행」— 출결 감사 이후 PRD §8 보강 엔터티 및 스태프 화면이 미구현이었음.
- **추론한 결정**:
  - 모델: `academyId`, `enrollmentId`, `sessionDate`(YYYY-MM-DD), 선택 `sessionTime`(HH:mm), `description`(필수, 2000자 이하).
  - 라우트 `/makeups`: 클래스 필터·등록 폼·목록·삭제; `gateAttendanceWriteAction`(코스 `teacherId`)으로 출결과 동일한 담당 반 스코프. RBAC 메시지 문구를 출결·보강 공통으로 일반화.
  - 내비: 전체 스태프에 `/makeups`, 강사 네비에 **보강**을 출결 앞에 배치.
  - 수강 삭제 시 `MakeupSession` 정리; 시드에 `MakeupSession.deleteMany` 및 샘플 보강 1건.
- **대안(포기)**: 보강 수정·감사 로그·캘린더 연동 — MVP에서 단순 등록/삭제만.
- **검증**: `npm run check`, `npm test`, `npm run lint`, `npm run build`; `session-handoff-and-status.md` 갱신.

### 2026-05-11 — 출결 변경 감사 로그 (PRD §8)

- **맥락**: 사용자「진행」— RBAC 다음으로 PRD 순서상 출결 수정 추적이 자연스러움 (과거 수정 허용·수정마다 감사 로그).
- **추론한 결정**:
  - `AttendanceAuditLog` 모델: `academyId`, `courseId`, `enrollmentId`, `sessionDate`, `actorUserId`, 이전/신규 상태·사유(PR `AttendanceStatus` 정합). 인덱스: 학원+클래스+수업일+`createdAt`.
  - **실질 변경만 기록**: 저장 전·후를 `effectiveAttendanceBefore`(문서 없음=출석·빈 사유)와 저장 정규화 사유로 비교. 암묵 출석에서의 무변경 일괄 저장은 로그 없음.
  - 출결 화면 로드 시 동일 클래스·수업일 최근 80건 조회·표시; 학생명은 `enrollment` populate.
  - 수강 삭제 시 `AttendanceAuditLog` 해당 `enrollmentId` 정리; 시드 시 컬렉션 전체 삭제로 샘플 정합.
  - 순수 비교 로직·라벨 헬퍼는 `attendance-audit.ts` + Vitest.
- **대안(포기)**: 저장 트랜잭션(부분 실패 시 출결·로그 불일치 가능)—MVP에서는 미사용.
- **검증**: `npm run check`, `npm test`, `npm run lint`, `npm run build`; `session-handoff-and-status.md` 반영.

### 2026-05-11 — AcademyMembership·RBAC (PRD §5·§6 선행)

- **맥락**: 사용자 지시 — 논리구조상 최우선 과제를 진행하고 완료 후 `docs` 현황 반영. 출결 감사 로그·입금 매칭보다 **Better Auth 사용자와 학원 역할을 바인딩하는 멤버십** 이 상위 레이어이며, 후속 기능의 전제가 됨(PRD §5, §6, §9 `AcademyMembership`).
- **추론한 결정**:
  - `AcademyMembership`(Mongoose): `userId`(Better Auth id)·`academyId`·PRD 역할 enum·선택 `linkedTeacherId`(강사 담당 반과 `Course.teacherId` 매칭).
  - `hooks.server.ts`: 세션 확정 후 `DEV_ACADEMY_ID` 학원에 대한 멤버십을 적재해 `locals.academyMembership`에 둠(DB 실패 시 스킵으로 훅 전체는 계속).
  - `rbac.ts`: `ensureDirectoryAccess`(학생·강사·클래스·수강)·`ensureFinanceAccess`(수납)·`ensureStaffAcademyMember`+출결 저장 시 `gateAttendanceWriteAction`. `super_admin|academy_admin|office`를 운영층으로 통일, `teacher`는 출결 조회·저장만(클래스 목록은 담당 반으로 필터).
  - 학부모 역할은 레이아웃에서 스태프 셸 접근 차단(포털 `/p/*` 미구현 상태).
  - 내비: `NAV_LINKS_*` 리터럴 + `resolve` 타입 호환. 폼 페이지는 `ActionData`가 `{}`로 좁아지는 문제 회피를 위해 로컬 `FormFlash` 타입 사용.
  - 시드: 해당 학원 멤버십 삭제 후 기존 도메인 정리 순서 유지·말미에 `testuser` / `academy_admin` 멤버십 생성.
- **대안(포기)**: 초대 플로·멀티 학원 선택·플랫폼(super_admin 전용 라우트) — MVP 범위 밖.
- **검증**: `npm run check`, `npm test`, `npm run lint`, `npm run build`. `session-handoff-and-status.md`·본 로그 업데이트.

### 2026-05-11 — 핸드오프 문서에 「0. 최근 동기화」절 추가

- **맥락**: 사용자 요청 — 현재 상황을 docs에 반영해 다음 대화창에서 지속.
- **추론한 결정**:
  - `session-handoff-and-status.md` 상단에 **다음 대화창용** 스냅스트(스택, 라우트, 삭제 규칙, TS 관례, 시드 순서, 검증 명령, 후속 과제, 복붙 프롬프트)를 둠.
  - "재개 시 순서" 목록의 첫 항목을 이 절로 조정.
- **검증**: 문서 일관성 수동 확인.

### 2026-05-11 — TS 정합성 점검 + `InvoiceLine`/`payments` + populate 타입 가드

- **맥락**: Total TypeScript 스타일에 맞는지 검토한 뒤 다음 작업(수납) 진행 요청.
- **추론한 결정**:
  - 스캔 결과: `strict`, `any`/`@ts-ignore` 없음. 주된 개선점은 Mongoose `populate().lean()`의 **`as unknown as` 이중 단언**.
  - `mongo-populate-guards.ts`: `isPopulatedIdName`, `isPopulatedTeacherLean`(+ `instanceof Types.ObjectId`)로 좁혀 `courses`/`enrollments`/`attendance`/`payments` load에서 사용. Vitest 단위 테스트 추가.
  - PRD `InvoiceLine`: `enrollmentId`, `amountKrw`, `description`, `dueDate`(YYYY-MM-DD), `status` `open`|`paid`, `paidAt`. `/payments`: 필터·청구 추가·미납 삭제·납부 처리. 금액 파싱은 `'error' in amount` 판별로 분기.
  - 수강 삭제 시 `InvoiceLine.deleteMany`를 출결 삭제와 함께 수행. 시드에 샘플 미납 청구 1건; 삭제 순서 선두에 `InvoiceLine`.
- **대안(포기)**: 청구 이력 보존을 위해 수강 삭제 시 청구 차단 — MVP에선 cascade로 단순화.
- **검증**: `npm run check`, `npm test`, `npm run lint`, `npm run build`.

### 2026-05-11 — 출결(Attendance): Enrollment·수업일 단위, 수강 삭제 시 출결 정리

- **맥락**: 사용자「진행」— Enrollment 이후 출결을 PRD 순서에 맞춰 연결.
- **추론한 결정**:
  - `Attendance`: `academyId`, `enrollmentId`, `sessionDate`(문자열 **YYYY-MM-DD**, Seoul 달력), `status`(`present`|`late`|`absent`), 선택 `reason`(500자); `(academyId, enrollmentId, sessionDate)` 유일.
  - `src/lib/server/date-seoul.ts`: 기본 오늘·양력 유효성 검사. UI 문구에는 PRD 조항 기호 미사용.
  - `/attendance`: 클래스·수업일 선택(GET) → 해당 **수강생** 행에 출결·사유 → `save` 액션에서 `replaceOne` upsert로 일괄 반영.
  - 수강 삭제 시 `Attendance.deleteMany({ enrollmentId })` 로 **고아 출결 방지**. 보강·감사 로그는 미구현.
  - 시드 삭제 순서 선두에 `Attendance` 추가.
- **대안(포기)**: 출결을 `(studentId, courseId, date)` 직접 보관 —Enrollment가 이미 유일하므로 ref 단일화.
- **검증**: `npm run check`, `npm test`, `npm run lint`, `npm run build`.

### 2026-05-11 — Enrollment(수강): 모델·`/enrollments`·삭제 가드

- **맥락**: 사용자가 구현 순서를 에이전트에게 위임. PRD §7.1 청구 단위가 학생×수강이므로 `payments`·`attendance` 전에 연결 테이블이 필요.
- **추론한 결정**:
  - `Enrollment`: `academyId`, `studentId`, `courseId`, `(academyId, studentId, courseId)` **유일 복합 인덱스**; `timestamps`만 부감.
  - `/enrollments`: 목록(populate)·학생/클래스 쿼리 필터·등록·삭제(confirm); 중복 등록은 Mongo **11000**을 사용자 메시지로 변환.
  - **데이터 고아 방지**: 강사↔클래스와 동일 패턴으로, **수강이 있으면 학생·클래스 삭제 400 차단**; 수강 삭제는 UI에서 가능.
  - 시드: 삭제 순서에 `Enrollment` 포함, 샘플 수강 3건. 내비에 **수강 관리** 추가.
- **대안(포기)**: 학생 삭제 시 수강 cascade — 향후 청구 이력과 충돌할 수 있어 차단만 적용.
- **검증**: `npm run check`, `npm test`, `npm run lint`, `npm run build` (로컬 실행).

### 2026-05-11 — 세션 핸드오프 문서 추가

- **맥락**: Cursor 창 종료·재구동·CLI resume 실패에 대비해 작업 상황과 대화 핵심을 PRD와 분리해 두길 요청.
- **추론한 결정**:
  - `docs/session-handoff-and-status.md` 에 재개 순서, 대화에서 정한 운영 규칙 요약, 구현 완료 표, 다음 후보, 복붙용 프롬프트를 한 곳에 둠.
  - `PRD.md` 서두에 해당 파일 링크만 추가(제품 요구 원천은 PRD 유지).
- **대안(포기)**: PRD 안에 섹션 추가 — PRD가 제품 전용이라 분리 유지.
- **검증**: 문서 링크 및 상대 경로 확인.

### 2026-05-11 — courses·teachers: 스키마·CRUD·강사-클래스 연결

- **맥락**: 사용자「진행」— Taskplane `courses` 및 강사 배정.
- **추론한 결정**:
  - `students-scope`를 **`academy-scope`** 로 이름만 일반화(동일 `withAcademyScope()`).
  - **`Teacher`**: `academyId` + 이름·담당 과목, `/teachers`에서 학생과 동등한 CRUD·이름 검색.
  - **`Course`**: `academyId` + `teacherId`(ref), 목록에서 populate로 강사명 표시; 생성·수정 시 `Teacher.exists`로 같은 학원 소속 검증.
  - 강사 삭제 시 담당 클래스가 있으면 **400**으로 차단(데이터 고아 방지).
  - 시드: Course→Teacher→Student 삭제 순, 공용 모델 import; 레거시 `teacher: string` 스키마 제거.
  - 내비에 **강사 관리** 추가(`/` ~ `/attendance` 라우트 타입 유지).
- **대안(포기)**: 수강(Enrollment)·성적·시간표는 미구현 — PRD 후속.
- **검증**: `npm run check`, `npm test`, `npm run format`, `npm run lint`, `npm run build` 통과.

### 2026-05-11 — students: CRUD·이름 검색·편집 경로

- **맥락**: 사용자「진행」— Taskplane 다음 우선순위 students(CRUD·검색).
- **추론한 결정**:
  - 모든 변경을 `academyId`(현재 `DEV_ACADEMY_ID`/`getDefaultAcademyId`)로 한정해 `withAcademyScope()`로 통일.
  - 이름 검색은 대소문자 무시 부분 일치 regex, 사용자 입력은 `escapeRegex()`로 이스케이프(DoS·오동작 방지).
  - CRUD는 폼 액션(`create`/`delete`)과 `/students/[id]/edit`의 `update`로 분리; 삭제는 `use:enhance`에서 `cancel()`로 확인만(스킷 2 제출 핸들러 시그니처에 맞춤).
  - 이름·학년 길이 상한(120/40)을 서버에서 검증.
  - 단위 테스트: `mongo-util.test.ts`에 `escapeRegex`만 추가(DB 없이 검증 가능).
- **대안(포기)**: 감사 로그·역할 기반 권한은 PRD 후속; 인라인 테이블 편집 대신 별도 편집 페이지로 단순화.
- **검증**: `npm run check`, `npm test`, `npm run format`, `npm run lint`, `npm run build` 통과.

### 2026-05-11 — core: 레이아웃·인증 훅·학생 목록·도구 설정

- **맥락**: 사용자의 일반적「개발 진행」요청. Taskplane `core`(인증, Mongo/Better Auth, 레이아웃, 내비) 우선.
- **추론한 결정**:
  - PRD의 목업 모드: `AUTH_MODE=mock` 시 Better Auth HTTP 경로 없이 `testuser` 고정 세션을 `hooks.server.ts`에서 `locals`에 주입.
  - `AUTH_MODE=live` 시 `betterAuth` + Mongo 어댑터 + `svelteKitHandler`, OAuth 키 없이도 로컬 검증 가능하도록 `emailAndPassword.enabled: true` (PRD 소셜 전제와 병행 가능).
  - 멀티테넌트: `Student` 스키마에 `academyId` 필수, 로컬 스코프는 `DEV_ACADEMY_ID`(기본 hex) + `getDefaultAcademyId()` 로 통일. 이후 `AcademyMembership`으로 치환 예정.
  - 학생 목록은 DB 미기동 시 친화적 에러 문자열로 빈 목록 처리(Mongo 연결 실패 catch).
  - Tailwind 엔트리를 `src/app.css`로 표준화; Prettier `tailwindStylesheet`를 동일 경로로 수정(삭제된 `layout.css` 참조 제거).
  - GSD 번들이 ESLint/Prettier에 잡히지 않도록 `eslint.config.js`의 `ignores`에 `.fusion/**`, `.pi/gsd/**` 추가; `.prettierignore`에도 동일 패턴 유지.
  - 내부 링크는 `$app/paths`의 `resolve` + 경로 리터럴 `as const` 배열로 타입 안전하게 처리.
- **대안(포기)**: 이번 라운드에서 Better 소셜 제공자·실제 로그인 UI는 미구현 — 클라이언트용 `auth-client.ts` 만 깔아 둠.
- **검증**: `npm run check`, `npm run lint`, `npm test`, `npm run build` 통과.

### 2026-05-11 — 에이전트 자율 실행·추론 로그 체계 도입

- **맥락**: 운영자 요청 — 실질적 결정이 필요하기 전까지는 에이전트가 바람직한 추론으로 개발하고, 추론 내역을 `docs`에 남긴 뒤 알릴 것.
- **추론한 결정**:
  - 정책은 `agent-autonomy-policy.md` 에 고정하고, 실행별 세부는 `inferred-decisions-log.md` 에 누적한다.
  - PRD·web-project-common과 충돌하거나 파괴적/보안/비용 이슈일 때만 사용자 확인을 요청하도록 예외를 명시했다.
  - `agent-skills-and-gsd-workflow-order.md`, `web-project-common.md`, `PRD.md` 헤더에서 상호 링크해 다른 프로젝트에서도 찾기 쉽게 했다.
- **대안(포기)**: 단일 README 섹션만 두는 방식 — 검색·재사용성이 떨어져 정책/로그 파일을 분리했다.
- **검증**: 문서 링크 관계 수동 확인(상대 경로 일치).
