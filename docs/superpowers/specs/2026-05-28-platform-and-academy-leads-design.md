# 설계: 플랫폼 학원 등록 문의 + 학원 내부 Lead·대기 큐

**날짜**: 2026-05-28  
**상태**: 승인됨 (brainstorming)  
**범위**: A(플랫폼 학원 도입 문의·trial) + B(학원별 학부모 Lead·대기·전환). **한 설계 문서**, 구현은 **2개 계획**으로 분리.

**전제**: [PRD.md](../../PRD.md) §6, [session-handoff-and-status.md](../../session-handoff-and-status.md), 기존 `AcademyInvite`·OAuth·SMS 초대(merged `main`).

**구현 계획**:

1. [../plans/2026-05-28-platform-academy-inquiry.md](../plans/2026-05-28-platform-academy-inquiry.md)
2. [../plans/2026-05-28-academy-lead-waitlist.md](../plans/2026-05-28-academy-lead-waitlist.md)

---

## 1. 배경·목표

### 조직·역할 (합의)

```text
외부 학원 → 플랫폼 학원 등록 문의 (공개 폼)
super_admin → 문의 검토·trial 승인 → Academy(trial) + 원장 academy_admin 이메일 초대
원장(academy_admin) → 행정·강사 초대, 학원 내부 Lead·대기 운영
외부 학부모 → 학원별 공개 신청 (로그인 없음) → Lead
행정·원장 → Lead 처리 → Student → (선택) Enrollment → enrolledAt
```

### 현재 구현 갭

| 요구                       | 현재                                                 |
| -------------------------- | ---------------------------------------------------- |
| 학원 등록 문의 공개 페이지 | 없음                                                 |
| 문의 큐·trial 승인         | 없음 (`/platform/academies`에서 학원 직접 생성만)    |
| 원장 `academy_admin` 초대  | super_admin 전용 멤버 화면; 원장용 학원 설정 UI 없음 |
| 학원 내부 Lead·대기 큐     | 없음 (`/communications`는 카운트만)                  |
| `Academy.status=trial`     | `active` / `inactive` 만                             |

---

## 2. Part A — 플랫폼 학원 등록 문의

### 2.1 공개 폼 `/academy-inquiry`

**로그인 없음.** 필드(합의 **C**):

| 필드          | 필수                       |
| ------------- | -------------------------- |
| 학원명        | ○                          |
| 원장/담당자명 | ○                          |
| 휴대번호      | ○ (`normalizeInvitePhone`) |
| 이메일        | ○ (`normalizeInviteEmail`) |
| 지역/주소     | ○                          |
| 문의 메모     | 선택                       |

제출 → `AcademyInquiry` 생성, `status=new`, 감사 안내 화면.

### 2.2 모델 `AcademyInquiry`

| 필드                | 타입      | 설명                                                        |
| ------------------- | --------- | ----------------------------------------------------------- |
| `academyName`       | string    |                                                             |
| `contactName`       | string    |                                                             |
| `phone`             | string    | 정규화                                                      |
| `email`             | string    | 정규화                                                      |
| `region`            | string    | 지역/주소                                                   |
| `memo`              | string?   |                                                             |
| `status`            | enum      | `new` \| `contacted` \| `trial` \| `approved` \| `rejected` |
| `trialDays`         | number?   | 승인 시 기록(기본 7)                                        |
| `academyId`         | ObjectId? | trial/approved 시 연결                                      |
| `processedByUserId` | string?   | super_admin                                                 |
| `processedAt`       | Date?     |                                                             |

인덱스: `status`, `createdAt`, `email`.

### 2.3 문의 상태 (합의 **C**)

| 상태        | 의미                                 |
| ----------- | ------------------------------------ |
| `new`       | 접수                                 |
| `contacted` | 플랫폼 관리자 연락                   |
| `trial`     | Academy 생성·원장 초대 완료, 체험 중 |
| `approved`  | 정식 전환                            |
| `rejected`  | 거절                                 |

### 2.4 `Academy` 확장 (합의 **B**)

```text
Academy.status = trial | active | inactive
Academy.trialEndsAt?: Date
```

| status     | 의미    |
| ---------- | ------- |
| `trial`    | 체험 중 |
| `active`   | 정식    |
| `inactive` | 중지    |

### 2.5 Trial 정책 (합의 **B** + 만료 차단)

**기간**: super_admin이 trial 승인 시 선택, **기본 7일** (`trialDays` → `Academy.trialEndsAt`).

**trial 중 허용**: 학생·수업·출결·수납(수기)·Lead·대기 큐·내부 CRUD.

**trial 중 제한**: SMS 실발송, 초대 메일/SMTP 실발송(또는 스텁 유지), 은행 API, 대량 외부 발송.

**만료 후** (`now > trialEndsAt` && `status===trial`):

- 해당 학원 **스태ff** (`academy_admin`, `office`, `teacher`) → 업무 화면 차단
- 안내: 「체험 기간이 종료되었습니다. 플랫폼 관리자에게 문의하세요.」+ 연락 CTA
- `super_admin`·`parent`(비활성 학원 규칙 기존) 예외는 PRD·`active-academy` 정책에 맞게 유지
- **데이터 삭제 없음** — `approved` 시 그대로 사용

**정식 전환**: 문의 `approved` + `Academy.status=active`, `trialEndsAt` clear 또는 유지(감사).

### 2.6 super_admin 워크플로 `/platform/inquiries` (신규)

| 액션           | 동작                                                                                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 목록·필터      | `status`별 큐                                                                                                                                                                   |
| `contacted`    | 상태만 변경                                                                                                                                                                     |
| **trial 승인** | `Academy.create({ status:'trial', trialEndsAt })` + `AcademyInquiry` 연결 + **이메일 `AcademyInvite`** (`role=academy_admin`, 문의 email) + `AcademyInvite` 기존 SMTP 스텁/발송 |
| `approved`     | `Academy.status=active`, 문의 `approved`                                                                                                                                        |
| `rejected`     | 문의 `rejected`                                                                                                                                                                 |

**원장 계정**: 직접 생성·비밀번호 발급 없음 — **초대 수락만**(기존 `/invite/accept` + 이메일 일치).

### 2.7 기존 `/platform/academies`와 관계

- **유지**: 수동 학원 생성·비활성화(운영 백도어)
- **권장 경로**: 외부 학원 → `/academy-inquiry` → 큐 → trial

---

## 3. Part B — 학원 내부 Lead·대기

### 3.1 공개 폼 `/apply`

**로그인 없음**(합의). 학원 귀속:

```text
/apply?a={academyId}
```

행정·원장이 학원별 링크/QR 배포. 학원은 **super_admin이 등록한 뒤** 존재.

필드(MVP):

| 필드            | 필수 |
| --------------- | ---- |
| 학생(자녀) 이름 | ○    |
| 보호자명        | ○    |
| 휴대번호        | ○    |
| 희망 수업/메모  | 선택 |

제출 → `Lead` 생성, `status=new`, `source=web`.

### 3.2 모델 `Lead`

| 필드               | 타입      | 설명                                            |
| ------------------ | --------- | ----------------------------------------------- |
| `academyId`        | ObjectId  |                                                 |
| `studentName`      | string    | 신청 시                                         |
| `guardianName`     | string    |                                                 |
| `phone`            | string    |                                                 |
| `memo`             | string?   | 희망 수업 등                                    |
| `source`           | enum      | `web` \| `staff`                                |
| `status`           | enum      | §3.3                                            |
| `studentId`        | ObjectId? | 전환 후                                         |
| `convertedAt`      | Date?     | Student 생성 시                                 |
| `enrolledAt`       | Date?     | 해당 `studentId` **첫 Enrollment** 생성 시 자동 |
| `assignedToUserId` | string?   | 담당 행정(선택)                                 |
| `createdByUserId`  | string?   | staff 입력 시                                   |

### 3.3 Lead 상태 (합의 **B**)

| 상태         | 의미                                        |
| ------------ | ------------------------------------------- |
| `new`        | 접수                                        |
| `contacted`  | 학원 연락                                   |
| `waitlisted` | 대기(자리 없음)                             |
| `converted`  | Student 생성·연결 완료                      |
| `closed`     | 종료(거절·중복·포기 등, `closeReason` 선택) |

**`enrolled` 상태는 사용하지 않음.** 수강 완료는 **`enrolledAt`** 로 표시.

### 3.4 `enrolledAt` (합의)

- `converted` 이후 해당 `studentId`에 **첫 `Enrollment` 생성** 시 `enrolledAt = now` (이미 있으면 유지).
- UI: `converted` + `enrolledAt` 없음 → 「등록됨·수강 미배정」; 있음 → 「수강 등록 · 날짜」.
- `waitlisted` → `enrolledAt` 채워지면 대기 해소 지표.

### 3.5 Lead → Student 전환 (합의 **D**)

행정·`academy_admin` 액션 `convertLead`:

1. `Student` 생성 (`name`, `guardianPhone`, `guardianName` from Lead)
2. `Lead.studentId`, `convertedAt`, `status=converted`
3. **자동 `ParentStudentLink`·SMS 초대는 하지 않음** — 기존처럼 스태ff 후속

### 3.6 스태ff UI `/leads` (또는 `/communications` 확장)

**권한**: `academy_admin`, `office` (강사는 읽기 제한 또는 미노출 — MVP는 **admin·office만**).

| 뷰          | 필터                              |
| ----------- | --------------------------------- |
| 신규        | `new`                             |
| 진행        | `contacted`                       |
| **대기 큐** | `waitlisted`                      |
| 전환        | `converted` (+ `enrolledAt` 유무) |
| 종료        | `closed`                          |

액션: 상태 변경, 메모, `convertLead`, (선택) SMS 초대는 기존 `Student` 편집·`AcademyInvite` parent 흐름.

**행정 수동 Lead**: `source=staff`, 동일 폼.

### 3.7 원장·행정 계정 관리 (갭 해소)

**MVP 필수**: `academy_admin`용 **학원 설정 → 멤버·초대** (`/settings/members` 또는 `/academy/members`).

- 기존 `/platform/.../members` 로직 **재사용**, 가드만 `ensureElevatedStaffRole` + `academyId` 스코프.
- `super_admin` 플랫폼 화면은 유지.

---

## 4. 아키텍처 요약

```text
[Public]
  /academy-inquiry → AcademyInquiry
  /apply?a=...     → Lead

[Platform super_admin]
  /platform/inquiries → trial 승인 → Academy + AcademyInvite(academy_admin)

[Academy staff]
  /leads → Lead 큐, convert → Student
  /academy/members → staff/parent 초대 (academy_admin)
  hooks → trial 만료 시 staff 차단

[Existing]
  Enrollment create → Lead.enrolledAt (if linked)
```

---

## 5. 비범위

- 결제·요금제·자동 과금
- 학원별 커스텀 도메인·슬러그 URL (`/a/{slug}`)
- Lead용 SMS OTP·전화 엄격 매칭
- `enrolled` Lead 상태 (필드 `enrolledAt`만)
- 학원 문의 `trial` 자동 연장(수동만)

---

## 6. 에러·엣지

| 상황                                | 처리                                                 |
| ----------------------------------- | ---------------------------------------------------- |
| 비활성·없는 `academyId` on `/apply` | 404                                                  |
| trial 만료 스태ff                   | 403 + 안내 페이지                                    |
| 중복 문의 email                     | 허용 또는 `contacted` 합치기(MVP: 허용, 메모로 표시) |
| Lead 중복 phone                     | MVP: 별도 Lead 허용; UI에서 최근 건 표시             |
| mock 모드                           | 문의·Lead 생성은 DB; trial 게이트 live 동일          |

---

## 7. 테스트·롤아웃

- 단위: `AcademyInquiry` 상태 전이, `trialEndsAt` 계산, Lead `enrolledAt` on Enrollment
- 통합: 공개 폼 → super_admin trial → invite accept → staff `/leads` convert
- `npm run check` → `npm test` → `npm run lint` → `npm run build`

---

## 8. 구현 순서 권장

1. **platform-academy-inquiry** — `AcademyInquiry`, `/academy-inquiry`, `/platform/inquiries`, `Academy.status=trial`, trial gate
2. **academy-lead-waitlist** — `Lead`, `/apply`, `/leads`, `convertLead`, `enrolledAt`, `/academy/members`

---

## 9. 합의 체크리스트

| 항목             | 결정                        |
| ---------------- | --------------------------- |
| 문의 필드        | C                           |
| 원장 계정        | B — 이메일 초대             |
| 문의 상태        | C                           |
| Academy.status   | trial \| active \| inactive |
| Trial 기능       | B — 핵심 O, 외부 연동 X     |
| Trial 기간       | D, 기본 7일                 |
| Lead 생성        | C — staff + web             |
| 공개 신청 로그인 | 없음                        |
| Apply URL        | `/apply?a={academyId}`      |
| Lead 상태        | B                           |
| 수강 시점        | `enrolledAt` 필드           |
