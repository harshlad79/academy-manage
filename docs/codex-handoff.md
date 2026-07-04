# Codex handoff — academy-manage

Cursor 등에서 끊긴 뒤 **OpenAI Codex**(또는 다른 CLI/에이전트)가 이어갈 때 쓰는 **복붙 프롬프트 모음**이다.  
저장소 단일 근거: **Git `main`** + 아래 문서. 대화 요약만으로 handoff 하지 않는다.

**동기화 시점**: 2026-05-29 · **`main` @ `8b74fb2`** — `feat(notify): parent payment due SMS, email, and push`

---

## 0. Codex 시작 전 (로컬)

```bash
git clone https://github.com/harshlad79/academy-manage.git
cd academy-manage
git pull origin main
git log -1 --oneline   # 8b74fb2 이상 확인
npm install
cp .env.example .env
# DB_URL, AUTH_MODE=mock 등
npm run seed           # mock·데모 시
```

검증 루프(작업 완료 시 필수):

```bash
npm run check && npm test && npm run lint && npm run build
```

---

## 1. 공통 bootstrap (모든 Codex 세션 첫 메시지)

아래 블록 전체를 Codex 첫 프롬프트로 붙인다. **「다음 작업」** 한 줄만 바꾼다.

```text
프로젝트: academy-manage
저장소: https://github.com/harshlad79/academy-manage
브랜치: main (HEAD 8b74fb2 — parent notify SMS·email·push 스텁)

다음 순서로 읽고 컨텍스트를 맞춘 뒤, 아래 「다음 작업」만 진행해.

읽기 순서:
1. docs/session-handoff-and-status.md §0
2. docs/inferred-decisions-log.md — 최신 5개 항목(2026-05-29 notify·Lead·trial)
3. docs/PRD.md — 범위 교차검증
4. AGENTS.md — Git·검증·inferred 로그
5. git status && git log -5 --oneline

이미 main에 완료(재구현 금지):
- 플랫폼 학원 문의·trial: /academy-inquiry, /platform/inquiries, trial gate
  plan: docs/superpowers/plans/2026-05-28-platform-academy-inquiry.md
- Lead·대기: /apply, /leads, convertLead, enrolledAt, /settings/members
  plan: docs/superpowers/plans/2026-05-28-academy-lead-waitlist.md
- 학부모 납부 안내 알림 스텁: /payments SMS·이메일·푸시, /p/settings 동의
  modules: src/lib/server/parent-notify-*.ts, parent-payment-notify.ts

스택: SvelteKit 5, Tailwind 4, TS strict, Mongo+Mongoose, Better Auth(mock|live).
학원 스코프: withAcademyScope(), active_academy_id 쿠키.
Mock: AUTH_MODE=mock — 세션만 우회, 업무 데이터는 Mongo 필수.

운영 규칙:
- agent-autonomy-policy.md — 추론은 docs/inferred-decisions-log.md에 기록
- 커밋·push는 사용자가 요청할 때만
- .env·시크릿 커밋 금지, prod DB reset·force push main 금지

[CRITICAL]
검증: npm run check → npm test → npm run lint → npm run build
다음 작업: (여기 한 줄)
[/CRITICAL]

한국어로 답변. 설계가 필요하면 코드 전에 spec 초안을 docs/superpowers/specs/에 두고 승인 받기.
```

토큰 절약 시: `docs/session-context-digest.md`만 첨부하고 위 「읽기 순서」는 저장소에서 직접 읽게 한다.

---

## 2. 다음 작업 A — 오픈뱅킹 실연동 (권장 우선)

`.pi/taskplane-config.json` → **`integrations`(7)**. PRD §7.3 · handoff §0 「다음 과제」.

```text
(§1 bootstrap 붙인 뒤, [CRITICAL] 안 「다음 작업」을 아래로 교체)

[CRITICAL]
다음 작업: 오픈뱅킹 프로덕션 어댑터 — open-banking-stub 위에 실 API 레이어 추가. /payments 기존 importOpenBankingStubDeposit·preview 흐름 유지·확장.

참고 파일:
- src/lib/server/banking/open-banking-stub.ts
- src/lib/server/banking/open-banking-stub.test.ts
- src/routes/payments/+page.server.ts (openBankingPreview, importOpenBankingStubDeposit)
- docs/integrations-checklist.md §1
- docs/개발자가-처리할-항목.md §3

목표(1차 슬라이스):
1. spec: docs/superpowers/specs/YYYY-MM-DD-open-banking-production-design.md
   — stub vs prod 스위치, env, OpenBankingTransaction 공통 타입, 멱등(externalRef), trial 차단 여부
2. plan: docs/superpowers/plans/YYYY-MM-DD-open-banking-production.md
3. 구현: fetchOpenBankingTransactions({ from, to }) 인터페이스 + stub 구현체 + prod 스켈레ton(키 없으면 skipped)
4. .env.example 주석, inferred-decisions-log 항목, handoff §0 한 줄 갱신

비범위(1차): 웹훅 수신, 자동 matchDeposit, 실제 금융사 OAuth UI(키는 env만).

금지: 스크래핑, .env 커밋, 기존 BankDeposit matchDeposit 시맨틱 변경 without 테스트
검증: npm run check → npm test → npm run lint → npm run build
[/CRITICAL]
```

---

## 3. 다음 작업 B — SMS 실 API (알리고·솔라피 등)

초대 SMS(`invite-sms.ts`)·납부 안내 SMS(`parent-notify-sms.ts`) 패턴 재사용.

```text
(§1 bootstrap + [CRITICAL] 교체)

[CRITICAL]
다음 작업: 학부모·초대 SMS 실 발송 provider — INVITE_SMS_PROVIDER / PARENT_NOTIFY와 공통 또는 분리 어댑터.

참고 파일:
- src/lib/server/invite-sms.ts, invite-sms.test.ts
- src/lib/server/parent-notify-sms.ts, parent-notify-sms.test.ts
- src/lib/server/academy-trial.ts — academyBlocksExternalComms (trial 차단)
- docs/superpowers/specs/2026-05-19-invite-sms-phone-design.md
- docs/개발자가-처리할-항목.md §7 (SMS)

목표(1차 슬라이스):
1. spec: provider 인터페이스, env (INVITE_SMS_* 유지·확장), 실패 시 DB 유지·UI notice
2. stub provider 기본 + solapi|aligo skeleton (HTTP mock 또는 opt-in 실호출)
3. trial 학원 발송 차단 테스트 유지
4. .env.example, inferred-decisions-log, handoff §0

비범위: OTP, OAuth 전화 엄격 매칭, 자동 납부 SMS(수동 /payments 버튼만)

검증: npm run check → npm test → npm run lint → npm run build
[/CRITICAL]
```

---

## 4. 다음 작업 C — 푸시 실 API (FCM / Web Push)

현재 `pushSubscriptionEndpoint`는 스텁 문자열. Web Push 구독 UI 없음.

```text
(§1 bootstrap + [CRITICAL] 교체)

[CRITICAL]
다음 작업: 학부모 푸시 실연동 1차 — Web Push 구독(/p/settings) + sendPaymentDuePush prod path.

참고:
- src/lib/server/parent-notify-push.ts
- src/routes/p/settings/+page.server.ts (pushNotifyConsentAt, pushSubscriptionEndpoint)
- docs/integrations-checklist.md §2

1차: spec → plan → service worker·VAPID env 스켈레ton → parent-notify-push provider
비범위: iOS 네이티브, 자동 발송

검증: npm run check → npm test → npm run lint → npm run build
[/CRITICAL]
```

---

## 5. 다음 작업 D — multiAcademy (Taskplane 6)

```text
[CRITICAL]
다음 작업: 다학원 UX·DEV_ACADEMY_ID 의존 축소 — active_academy.ts·Navigation switcher 이미 있음. super_admin /platform 과 멤버십 전환 정책 문서화·갭 구현.

참고: .pi/taskplane-config.json taskAreas.multiAcademy, docs/PRD.md §14, src/lib/server/active-academy.ts

1차: spec(전환 UX·inactive/trial 학원) → plan → hooks/locals 정리
[/CRITICAL]
```

---

## 6. Codex 완료 시 돌려줄 보고 형식

Codex에게 마무리 시 아래 형식으로 보고하라고 요청한다.

```text
## 완료 보고
- HEAD 커밋: (hash)
- 변경 요약: (3 bullet)
- inferred-decisions-log: (항목 제목)
- 검증: check/test/lint/build 결과
- 미착수·블로커: (키 없음, 계약 대기 등)
```

---

## 8. Codex Agent CLI에서 이어하기

저장소 루트 **`AGENTS.md`** 가 Codex 기본 지침이다. handoff 본문은 **`docs/codex-handoff.md`**(이 파일).

### 8.1 새 세션 (권장 — Git 기준 handoff)

```bash
cd /path/to/academy-manage
git pull origin main
codex
```

첫 메시지에 **§1 bootstrap** 전체 붙이기. 또는 한 줄로 시작:

```bash
codex "docs/codex-handoff.md §1과 §2를 읽고 오픈뱅킹 1차 슬라이스만 진행. 한국어."
```

### 8.2 프롬프트 파일로 시작 (`exec`)

```bash
cd /path/to/academy-manage
git pull origin main
codex exec "$(cat docs/codex-resume.prompt)"
```

작업 전환 시 `docs/codex-resume.prompt` 안 **`NEXT_TASK`** 한 줄만 수정한다.

### 8.3 이전 Codex 세션 resume

같은 머신·같은 repo에서 **직전 대화**를 이어갈 때:

```bash
cd /path/to/academy-manage
codex resume              # 세션 선택
codex resume --last       # 가장 최근 세션
```

후속 지시만 덧붙이기:

```bash
codex exec resume --last "docs/codex-handoff.md §2 오픈뱅킹 spec부터. 커밋은 하지 마."
```

세션은 `~/.codex/sessions/` 에 저장된다. **다른 PC·새 설치**에서는 `git pull` + **§8.1** 또는 **`codex-resume.prompt`** 가 안전하다.

### 8.4 작업 끝낼 때 (다음 Codex/Cursor용)

1. `docs/inferred-decisions-log.md` 최상단에 추론 기록
2. `docs/session-handoff-and-status.md` §0 한 줄 갱신
3. 필요 시 `docs/codex-handoff.md` **동기화 시점**·HEAD 해시 갱신
4. `git commit` → `git push` (사용자 요청 시)

---

## 9. 문서 링크 요약

| 문서 | 용도 |
|------|------|
| [session-handoff-and-status.md](session-handoff-and-status.md) | 구현 스냅샷 §0 |
| [session-context-digest.md](session-context-digest.md) | 짧은 재개 |
| [inferred-decisions-log.md](inferred-decisions-log.md) | 추론·가정 |
| [PRD.md](PRD.md) | 제품 범위 |
| [AGENTS.md](../AGENTS.md) | 에이전트 Git·검증 |
| [integrations-checklist.md](integrations-checklist.md) | 연동 체크 |
| [superpowers/specs/](superpowers/specs/) | 승인된 설계 |
| [codex-handoff.md](codex-handoff.md) | **Codex CLI** 복붙·resume |

---

_본 파일은 handoff용이다. 제품 정의는 PRD, 구현 동기화는 session-handoff-and-status §0을 따른다._
