# 현재 작업 현황 · Simulith Stage 1–5

> 기준 시각: 2026-10-06 (Asia/Seoul)
> 저장소: [harshlad79/academy-manage](https://github.com/harshlad79/academy-manage)
> 브랜치 기준: `main`
> 상태 기준: 2026-09-21에 수행한 ego-browser 기록과 정적 검증 결과를 현재 작업 트리 문서로 정리함.

## 먼저 읽을 문서

- 이 문서: 현재 범위, 검증 결과, 재개 순서
- [Simulith 전수검사 기록](simulith-exhaustive-verification-plan.md): 화면·역할·클릭·저장·재조회 증거
- [화면 검증 계획](simulith-screen-verification-plan.md): 화면 목록과 검증 기준
- [화면 검증 evidence](simulith-screen-verification-evidence.md): 실행 증거 원본
- [화면 검증 보고서](simulith-screen-verification-report-2026-09-20.md): 이전 회차 보고서
- [OMX durable plan](../.omx/ultragoal/goals.json): goal 상태 원본
- [OMX audit ledger](../.omx/ultragoal/ledger.jsonl): goal 변경 이력

## 현재 판정

Simulith Stage 1–5 화면 구성은 완료 상태다. 로컬 SQLite 시뮬레이션에서 관리자·강사·학부모·전체관리자 화면을 ego-browser로 확인했고, 핵심 UI 흐름을 실제 입력·클릭·저장·재조회했다.

G001 화면 구성 goal은 완료 처리됐다. G002 ego 전수검사는 화면 검증과 정적 검증은 끝났지만, 독립 `code-reviewer`·`architect` 결과가 반환되지 않아 OMX 최종 품질 게이트는 `review_blocked` 상태다. 따라서 이 문서는 기능 검증 완료와 최종 독립 리뷰 미완료를 분리해 기록한다.

## 검증된 범위

- 관리자 서버: `5177`
- 강사 서버: `5178`, 사용자 `teacher-demo`
- 학부모 서버: `5179`, 사용자 `parent-kim`
- 전체관리자 서버: `5180`, 사용자 `superadmin`
- 시뮬레이션: `SIMULATION_MODE=sqlite`
- 브라우저: ego TaskSpace `6`
- 확인한 역할 경계:
  - 강사: `/reports`, `/attendance`, `/makeups`, `/communications` 허용
  - 강사: `/students`, `/payments` 접근 차단
  - 학부모: `/p`, `/p/settings` 표시; 업무 화면은 `/p`로 이동
  - 전체관리자: `/platform`, `/platform/academies`, `/platform/inquiries` 표시

## 실제로 확인한 UI 흐름

- 학생·클래스 검색, 수강생 필터, 정산 월 필터
- 공지 발행 후 학부모 포털 재조회
- 청구 추가 → 납부 처리 → 최근 수납 이력 재조회
- 출결 클래스 선택 → 결석·사유 저장 → 재조회
- 보강 등록
- 상담 직접 등록 → 신규에서 대기로 상태 변경 → 재조회
- 지원서 입력 → `/apply/success`
- 전체관리자 학원 추가와 기능 플래그 저장
- 빈 입력·빈 목록·권한 거부 상태 표시
- teacher 출석 화면에서 담당 클래스 선택 후 학생 행·기존 값 표시
- 브라우저 콘솔 오류 0건(teacher 출석 재검증)

## 정적 검증 증거

2026-09-21 최종 실행:

- `npm run check`: 0 errors, 0 warnings
- `npm test`: 32 files, 152 tests passed
- `npm run lint`: passed
- `npm run build`: passed

## 범위 밖 / 아직 확정하지 않은 것

- 실제 MongoDB 연동
- 실제 외부 이메일·SMS 발송
- Simulith Stage 6 이후의 도메인·영속화·실서비스 검증
- 학부모 설정 저장: 목업 모드에서 의도적으로 비활성화된 상태
- 독립 최종 code review의 APPROVE/CLEAR 판정

## 재개 절차

1. 이 문서와 [Simulith 전수검사 기록](simulith-exhaustive-verification-plan.md)을 먼저 읽는다.
2. 현재 서버가 필요한 경우 포트 충돌을 확인한다. 다른 Codex가 사용하는 `5173`은 건드리지 않는다.
3. SQLite 시뮬레이션 서버를 역할별 포트로 띄운다.
4. ego-browser는 기존 TaskSpace `6`을 재사용한다.
5. 기능 검증과 독립 리뷰 판정을 별도로 기록한다.
6. 완료 주장 전 `npm run check` → `npm test` → `npm run lint` → `npm run build`를 다시 실행한다.

## GitHub 라우팅

새 작업자는 아래 순서로 문서를 읽으면 된다.

```text
README.md
  -> docs/current-status.md
     -> docs/simulith-exhaustive-verification-plan.md
        -> docs/simulith-screen-verification-evidence.md
        -> .omx/ultragoal/goals.json
        -> .omx/ultragoal/ledger.jsonl
```

코드 변경 전에는 [AGENTS.md](../AGENTS.md)의 범위·검증·Git 규칙을 적용한다. goal 재개가 필요하면 `.omx/ultragoal/goals.json`의 G002/G003 상태와 ledger를 먼저 대조한다.
