# 학원 관리 시스템 PRD (제품 전용)

웹 애플리케이션 공통 관행(환경 변수, 접근성, E2E, 배포 개념 등)은 **[web-project-common.md](web-project-common.md)** 를 따른다. 다른 프로젝트에 재사용할 때는 해당 파일만 복사하면 된다.

에이전트 스킬·GSD 적용 순서(다른 프로젝트 참고용): **[agent-skills-and-gsd-workflow-order.md](agent-skills-and-gsd-workflow-order.md)**.  
자율 실행·추론 기록: **[agent-autonomy-policy.md](agent-autonomy-policy.md)**, **[inferred-decisions-log.md](inferred-decisions-log.md)**.  
**세션 끊김 시 구현·대화 맥락 재개용(PRD와 별도):** **[session-handoff-and-status.md](session-handoff-and-status.md)**.

외부 콘솔·키 발급 등 프로젝트 전용 체크리스트: [개발자가 처리할 항목.md](개발자가-처리할-항목.md).

---

## 1. 개요

SvelteKit 기반 학원 관리 시스템으로, 학생·출결·수납·클래스·학부모 소통을 다룬다. **다중 학원(multi-tenant)** 을 전제로 설계하며, 모든 비즈니스 문서에 `academyId`를 둔다. 사용자는 **학원 단위로 계정이 연동**되며, 역할·위임 권한에 따라 접근 가능한 데이터와 메뉴가 달라진다.

**학원 생성**은 **전체관리자(플랫폼 슈퍼 관리자)** 만 수행한다. 일반 학원 관리자는 소속 학원 내 운영만 담당한다.

---

## 2. 기술 스택 (본 프로젝트)

- 프레임워크: SvelteKit (Svelte 5)
- UI: Tailwind CSS, shadcn-svelte
- 데이터: MongoDB + Mongoose(도메인), Better Auth + Mongo 어댑터(인증 저장소)
- 인증·세션 분리 원칙: [web-project-common.md §3](web-project-common.md#3-인증-vs-데이터-접근역할-분리)

---

## 3. 지역·통화 (본 제품)

- 통화: **원화(KRW) 고정**
- 날짜·시간: **대한민국(Asia/Seoul)** 단일 가정
- 로케일: ko-KR 권장

---

## 4. 환경·인증·테스트 (본 프로젝트에서의 적용)

공통 규칙: [web-project-common.md §2](web-project-common.md#2-환경-변수-정책).

본 시스템에서의 구체 값은 루트 [**`.env.example`**](../.env.example)(커밋)과 **`.env`**(비커밋)에 둔다. 운영자는 목업 단계에서는 **가장 로그인**으로 `testuser` 고정 세션, MVP·실서비스 전환 시 가장 비활성 + 실제 SNS 로그인(Better Auth)을 쓴다. 소셜 제공자: 카카오·네이버·구글.

---

## 5. 인증·회원가입·약관

1. 소셜 로그인·회원가입: 카카오, 네이버, 구글.
2. 약관·개인정보 동의 화면 포함.
3. Better Auth 사용자와 **학원 소속·역할**은 Mongoose 도메인(예: `AcademyMembership`)으로 바인딩. 학부모도 포털 로그인 계정 필요.

---

## 6. 역할 계층·계정 운영·데이터 범위

### 6.1 역할 정의

| 역할 코드       | 설명                                                                  |
| --------------- | --------------------------------------------------------------------- |
| `super_admin`   | **전체관리자**. 학원(Academy) **생성·비활성화 등 플랫폼 단** 작업.    |
| `academy_admin` | 학원 **관리자**. 전체 조회·설정·청구·계정 초대·**권한 위임** 지정.    |
| `office`        | **행정**. 소속 학원 **전체 조회·수정**.                               |
| `teacher`       | **강사**. **담당 반만** 조회·출결·보강 등.                            |
| `parent`        | **학부모**. **연결된 자녀** 및 대상 공지·청구·출결 요약만(읽기 중심). |

### 6.2 학부모–자녀 연결

**관리자·강사·행정**이 학생과 학부모 사용자 계정을 **지정·연결**한다. 미연결 학부모는 자녀 데이터 비조회.

### 6.3 스태프 계정 추가·수정·위임

- **추가**: 학원 **관리자**가 강사·행정 등 초대.
- 강사·행정 계정의 수정·추가 권한: 관리자가 **지정한 대상에 한함**(서버 검증·로그).

### 6.4 학원 생성 권한

**오직 `super_admin`** 만 새 학원 생성.

### 6.5 역할별 데이터·메뉴 요약

- **`super_admin`**: 학원 생성·플랫폼 설정.
- **`academy_admin`·`office`**: 학원 내 전체 학생·클래스·청구·출결·설정, 계정·연결·위임.
- **`teacher`**: 담당 반만; 타 반·전체 재무 집계 비노출.
- **`parent`**: 노출 대상 공지 + 연결 자녀 관련 정보만.

### 6.6 기능 플래그(학원 단)

| 플래그(예시)            | 켜졌을 때                     | 꺼졌을 때        |
| ----------------------- | ----------------------------- | ---------------- |
| `billingAutoImport`     | **은행 API**로 입금 조회·매칭 | 수기만           |
| `parentPortalEnabled`   | 학부모 포털 활성              | 비활성 또는 안내 |
| `communicationsEnabled` | 소통·공지 사용                | 비활성           |

---

## 7. 청구·납부

### 7.1 청구 단위

**학생 × 수업(Enrollment) 단위** 청구 라인.

### 7.2 할인·분납

- 할인: 학생별·이벤트성·임의 입력.
- 분납: **카드 할부**만 기입·표시.

### 7.3 입금 자동화

**은행 공식 API**(오픈뱅킹 등)로 입금 내역 수집·청구와 매칭. 스크래핑 금지. **관리자·행정 수기 수납·완료 체크** 병행. 외부 계약·키는 [개발자가 처리할 항목.md](개발자가-처리할-항목.md).

---

## 8. 출결·보강

- 상태: 출석 / 지각 / 결석; 지각·결석 시 **사유** 입력 가능.
- **보강**: 날짜·일시·설명(`MakeupSession`).
- **과거 수정 허용**, 수정마다 **감사 로그**.

---

## 9. 핵심 엔티티 (초안)

모든 비즈니스 엔티티에 `academyId`.

- **Academy**, **AcademyMembership**(역할·위임·강사 담당 반 등), **ParentStudentLink**, Student, Class, Enrollment, InvoiceLine, Payment(은행 API 거래 참조 등), Attendance, MakeupSession, AuditLog.

---

## 10. 사이트 구조 및 라우팅

스태프·관리(학원 맥락): `/`, `/academy`, `/billing`, `/classes`, `/students`, `/attendance`, `/communications`, `/reports`, `/settings`.

**플랫폼(`super_admin`)**: 예 `/platform/academies`.

**학부모 포털**: 예 `/p/*`.

**로그인·약관**: `/login`, `/signup`, `/terms` 등.

---

## 11. UX·대시보드·데이터 밀도

- 반응형: 데스크톱 **좌측 사이드바**, 모바일 **햄버거**.
- **관리자·강사·행정 대시보드**는 실무상 **최우선**(역할별 위젯).
- 데이터 밀도 **2~3 variant** 후 현업 선택.

(접근성 공통 목표: [web-project-common.md §4](web-project-common.md#4-접근성간단-목표))

---

## 12. 테스트·E2E (본 프로젝트)

공통: [web-project-common.md §5](web-project-common.md#5-테스트-전략).

MVP 후 Playwright 실계정 플로는 자격 증명을 Secrets로만 보관.

---

## 13. 멀티에이전트 분배

절차·파일 경계·검증 순서·이슈 기록: **[multi-agent.md](multi-agent.md)** · [multi-agent-lessons.md](multi-agent-lessons.md).

| 에이전트 | 담당                                                                |
| -------- | ------------------------------------------------------------------- |
| A        | 인증·OAuth·약관·가장 로그인·`.env.example`·개발자 체크리스트 동기화 |
| B        | 다중 학원·`super_admin`·멤버십·위임                                 |
| C        | 학생·학부모 연결·포털                                               |
| D        | 클래스·수강·담당 반 스코프                                          |
| E        | 출결·보강·감사                                                      |
| F        | 청구·할부·수기 수납·은행 API 매칭                                   |
| G        | 소통·공지 타게팅                                                    |
| H        | 통계                                                                |
| I        | 반응형 셸·역할별 대시보드·밀도 variant                              |

병합 전: `npm run check`, `npm run lint`, `npm test`.

**멀티에이전트 운영:** [multi-agent.md](multi-agent.md) · [multi-agent-lessons.md](multi-agent-lessons.md)

---

## 14. 추가로 정하면 좋은 사항

- 한 사용자 **다중 학원** 소속 시 학원 전환 UX.
- 위임 세부(사람 단위 vs 역할 그룹).
- 공지 타게팅(반·학생·전체 외 세그먼트).
- 은행 API 확정 사항 → 개발자 체크리스트 반영.
- 약관·개인정보 문안·동의 철회.
- `super_admin` 최초 시드 방법.
