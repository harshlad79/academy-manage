# Simulith 화면 검증 증거

## 실행 조건

- 서버: `SIMULATION_MODE=sqlite AUTH_MODE=mock npm run dev -- --host 127.0.0.1`
- 저장소: `.simulation/academy.sqlite` (Git 제외)
- 검증 기준: Simulith Stage 1–5
- 검증 방식: HTTP 상태 확인 + 실제 Chrome 화면 접근성 트리·렌더링 확인

## Stage 4 화면 루트

일반 관리자(`AUTH_MOCK_USER_ID=testuser`)로 단일 SvelteKit 서버에 접속해 다음 루트를 순회했다.

| 루트                          | 확인 결과                                             |
| ----------------------------- | ----------------------------------------------------- |
| `/`                           | 대시보드, 학생 2명·클래스 2개·수강 2건·미납 청구 표시 |
| `/students`                   | 학생 관리 화면                                        |
| `/students/student-1/edit`    | 학생 수정 화면, `김학생` fixture 표시                 |
| `/teachers`                   | 강사 관리 화면                                        |
| `/teachers/teacher-demo/edit` | 강사 수정 화면                                        |
| `/courses`                    | 클래스 관리 화면                                      |
| `/courses/course-1/edit`      | 클래스 수정 화면                                      |
| `/enrollments`                | 수강 관리, 학생·클래스 선택 및 수강 목록              |
| `/payments`                   | 수납·청구, 미납 청구·최근 수납 영역                   |
| `/reports`                    | 리포트 화면                                           |
| `/reports/course-revenue`     | 클래스별 매출 화면                                    |
| `/attendance`                 | 출결 화면, 클래스·수강생 fixture                      |
| `/makeups`                    | 보강 화면, 수강 선택·목록                             |
| `/leads`                      | 상담·대기 화면                                        |
| `/communications`             | 소통·공지 화면                                        |
| `/settings/members`           | 학원 설정·멤버 화면                                   |
| `/leads/<simulation-lead-id>` | 상담 상세 화면, 상태 변경                             |

보조 화면도 simulation 서버에서 확인했다: `/academy-inquiry`, `/academy-inquiry/success`, `/apply`, `/apply/success`, `/auth/sign-in`, `/invite/accept`, `/trial-expired`, `/reports`, `/p`, `/p/settings`. 일반 관리자에서 `/platform`은 `403`, superadmin에서는 `200`으로 RBAC 경계를 확인했다.

Chrome 접근성 트리에서 대시보드 네비게이션과 `수납 · 청구`, `최근 수납 이력` 제목을 확인했다. 브라우저 내비게이션 중 서버 오류 문구와 MongoDB 연결 오류는 나타나지 않았다.

## Stage 5 상호작용

- 학생 생성·삭제, 빈 이름 오류
- 강사 생성·삭제
- 클래스 생성·삭제
- 수강 등록·삭제·중복 등록 오류
- 공지 작성·목록 반영
- 출결 상태·사유 저장
- 보강 등록
- 상담 생성
- 청구 생성·수납 처리

각 항목은 동일한 SQLite 파일에 반영되고, 후속 GET에서 변경 결과를 재확인했다.

## 역할 경계

- `testuser`: 학원 운영 화면 접근
- `superadmin`: `/platform`, `/platform/academies`, `/platform/inquiries`, 학원 멤버 관리 접근
- `parent-kim`: `/p`, `/p/settings` 접근; 운영자 화면 접근 시 `/p`로 리다이렉트

Chrome에서 `superadmin`으로 `/platform`의 `플랫폼` 제목을 확인했고, `parent-kim`으로 `/p`의 `학부모 포털`·`내 자녀` 제목과 `/students` 접근 후 `/p` 리다이렉트를 확인했다.

## 검증 명령

- `npm run check` 통과
- `npm run lint` 통과
- `npm test` 통과: 30개 파일, 146개 테스트
- `npm run build` 통과

Stage 6 이후의 실제 MongoDB·외부 알림·오픈뱅킹 통합 검증은 이 로컬 화면 검증 범위에 포함하지 않는다.
