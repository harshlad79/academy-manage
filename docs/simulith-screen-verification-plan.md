# Simulith 화면 검증 계획

## 범위

기존 MongoDB, Mongoose, Better Auth, Web Push, SMTP/SMS 경로는 제품 실행 경로로 유지한다. 별도 `SIMULATION_MODE=sqlite` 실행 경로에서만 SQLite와 fake adapter를 사용해 역할별 화면을 로컬 단일 서버로 검증한다.

이번 목표는 Simulith Stage 1–5다. Stage 6 이후의 시나리오·도메인 추출·계약 테스트·실제 인프라 교체는 이 목표의 완료 조건에 포함하지 않는다.

## 단계 산출물

1. **User Flow Discovery** — staff, teacher, parent, super admin의 진입 화면과 핵심 이동 경로 목록.
2. **Visual Prototype** — 각 화면의 idle, loading, empty, error, success 상태 목록.
3. **Simulated State Interaction** — `src/lib/simulation/` 아래 SQLite store, 고정 fixture, fake auth·notification·external response adapter.
4. **UX Review** — 단일 로컬 서버에서 역할별 루트를 브라우저로 열고 화면 상태와 이동을 확인한 기록.
5. **Behavior Validation** — 권한, 빈 데이터, 실패 응답, 폼 성공·실패를 재현하는 검증 목록과 실행 증거.

## 경계

`SIMULATION_MODE`가 비어 있거나 `false`이면 현재 MongoDB 기반 코드를 그대로 사용한다. `sqlite`일 때만 인증·학원 맥락·업무 조회·업무 변경·알림·외부 연동을 simulation adapter로 연결한다. 제품 코드가 simulation 전용 데이터베이스를 기본값으로 사용하지 않도록 한다.

SQLite adapter가 제공해야 할 최소 맥락은 학원, 멤버십, 사용자 역할, 학생, 강사, 클래스, 수강, 출결, 보강, 청구·수납, 입금, 공지, Lead, 문의, 초대, 학부모 연결이다. 외부 발송은 실제 전송 없이 결과와 발송 기록만 반환한다.

## 완료 조건

- MongoDB 없이 단일 SvelteKit 서버가 simulation 모드로 기동한다.
- staff, teacher, parent, super admin 고정 프로필로 각 허용 화면 루트를 연다.
- 각 루트에서 성공·빈 상태·권한 거부·입력 실패·DB/외부 실패 화면을 재현한다.
- 기존 기본 실행 경로의 `check`, `test`, `lint`, `build`가 유지된다.
- 브라우저 검증 경로와 fixture 초기화 명령이 문서화된다.

## 제외

- 기존 MongoDB 모델 삭제·교체
- 프로덕션 SQLite 도입
- 외부 API 실연동 변경
- Stage 6 이후 정식 시나리오·도메인·계약 테스트 체계 도입
