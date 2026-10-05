# Simulith 화면 검증 보고서

검증일: 2026-09-20 21:38 KST
범위: Simulith Stage 1–5
실행 모드: `SIMULATION_MODE=sqlite AUTH_MODE=mock AUTH_MOCK_USER_ID=testuser`
서버: `http://127.0.0.1:5173`
저장소: `.simulation/academy.sqlite`

## 결론

현재 SQLite 시뮬레이션 서버에서 주요 화면 루트 25개를 Chrome으로 순차 이동해 렌더링을 확인했다. 확인한 루트에서는 500 오류, 서버 오류 문구, MongoDB 연결 오류가 나타나지 않았다.

학생 수정 화면에서는 이름·학년·보호자 이름·보호자 휴대번호를 함께 입력한 뒤 잘못된 번호를 제출해도 다른 입력값이 유지되는 것을 확인했고, 올바른 번호를 다시 저장한 뒤 재조회해 값이 유지되는 것도 확인했다.

소스 변경 후 Vite pane 로그에 SvelteKit 파일의 `page reload`가 기록되어 개발 서버 hot-reload 동작도 확인했다.

## 루트별 화면 확인

| 구분 | 루트                          | 결과                                                                                          |
| ---- | ----------------------------- | --------------------------------------------------------------------------------------------- |
| 운영 | `/`                           | 통과: 대시보드 렌더링                                                                         |
| 운영 | `/students`                   | 통과: 학생 관리                                                                               |
| 운영 | `/students/student-1/edit`    | 통과: 학생 수정                                                                               |
| 운영 | `/teachers`                   | 통과: 강사 관리                                                                               |
| 운영 | `/teachers/teacher-demo/edit` | 통과: 강사 수정                                                                               |
| 운영 | `/courses`                    | 통과: 클래스 관리                                                                             |
| 운영 | `/courses/course-1/edit`      | 통과: 클래스 수정                                                                             |
| 운영 | `/enrollments`                | 통과: 수강 관리                                                                               |
| 운영 | `/payments`                   | 통과: 수납·청구                                                                               |
| 운영 | `/reports`                    | 통과: 리포트                                                                                  |
| 운영 | `/reports/course-revenue`     | 통과: 클래스별 매출                                                                           |
| 운영 | `/attendance`                 | 통과: 출결                                                                                    |
| 운영 | `/makeups`                    | 통과: 보강                                                                                    |
| 운영 | `/leads`                      | 통과: 상담·대기                                                                               |
| 운영 | `/communications`             | 통과: 소통·공지                                                                               |
| 운영 | `/settings/members`           | 통과: 학원 설정·멤버                                                                          |
| 보조 | `/academy-inquiry`            | 통과: 문의 화면                                                                               |
| 보조 | `/academy-inquiry/success`    | 통과: 문의 완료                                                                               |
| 보조 | `/apply`                      | 통과: 지원 화면                                                                               |
| 보조 | `/apply/success`              | 통과: 지원 완료                                                                               |
| 보조 | `/auth/sign-in`               | 통과: 로그인 화면                                                                             |
| 보조 | `/invite/accept`              | 통과: 초대 수락 화면                                                                          |
| 보조 | `/trial-expired`              | 통과: 이용 기간 만료 화면                                                                     |
| 역할 | `/p`, `/p/settings`           | 현재 `testuser`에서는 `/`로 리다이렉트. `parent-kim` 별도 실행 검증은 기존 증거 문서에 기록됨 |

각 루트는 Chrome 접근성 트리에서 페이지 URL과 학원 관리 컨테이너를 확인했다. 오류 문구 검색 기준은 `500`, `Internal Server Error`, `MongoDB`, `ECONNREFUSED`다.

## 상호작용 확인

### 학생 수정 전체 필드

1. `/students/student-2/edit`에서 네 필드 입력.
2. 보호자 휴대번호를 `999`로 바꿔 제출.
3. `보호자 휴대번호 형식이 올바르지 않습니다(010).` 오류 확인.
4. 이름, 학년, 보호자 이름, 잘못 입력한 번호가 화면에 유지되는지 확인.
5. 번호를 `01012345678`로 바꿔 저장.
6. 다시 화면을 열어 올바른 번호가 유지되는지 확인.

결과: 통과. 오류 필드 때문에 전체 폼이 초기 상태로 돌아가지 않는다.

### 기존 상호작용 증거

기존 Stage 5 검증에서 다음 SQLite 변경과 후속 GET 반영을 확인했다.

- 학생 생성·삭제, 빈 이름 오류
- 강사 생성·삭제
- 클래스 생성·삭제
- 수강 등록·삭제·중복 등록 오류
- 공지 작성·목록 반영
- 출결 상태·사유 저장
- 보강 등록
- 상담 생성
- 청구 생성·수납 처리

상세 기록은 [simulith-screen-verification-evidence.md](./simulith-screen-verification-evidence.md)에 둔다.

## 역할 경계

이번 실행의 고정 사용자는 `testuser`다. 따라서 이번 루트 순회만으로 parent·superadmin의 현재 실행을 새로 주장하지 않는다.

기존 증거에는 다음이 기록되어 있다.

- `superadmin`: `/platform`, `/platform/academies`, `/platform/inquiries`, 학원 멤버 관리 접근
- `testuser`: `/platform` 접근 시 `403`
- `parent-kim`: `/p`, `/p/settings` 접근 및 `/students` 접근 시 `/p` 리다이렉트

역할별 검증을 다시 실행하려면 각 `AUTH_MOCK_USER_ID`로 별도 개발 서버를 기동하고 동일 루트 표를 재실행해야 한다.

## HMR 확인

학생 수정 Svelte 파일 변경 후 실행 중인 Vite pane에서 다음 형태의 로그를 확인했다.

```text
[vite] (client) page reload .svelte-kit/generated/client/...
[vite] (ssr) page reload .svelte-kit/generated/server/...
```

서버 재기동 없이 브라우저 화면이 새 소스에 맞춰 갱신됐다. 따라서 현재 개발 검증 경로에서는 소스 수정 후 hot-reload가 동작한다.

## 정적 검증

| 명령            | 결과                        |
| --------------- | --------------------------- |
| `npm run check` | 통과, 0 errors / 0 warnings |
| `npm test`      | 통과, 30 files / 146 tests  |
| `npm run lint`  | 통과                        |
| `npm run build` | 통과                        |

## 남은 검증 범위

- 이번 실행에서는 `testuser` 기준 루트 렌더링을 새로 확인했다.
- `parent-kim`, `superadmin`, `teacher-demo`를 같은 방식으로 다시 순회한 실행 로그는 이 보고서에 새로 생성하지 않았다. 기존 역할 증거는 보존되어 있으나, 역할별 최신 재검증까지 끝났다고 표시하지 않는다.
- MongoDB, Better Auth live, Web Push, SMTP/SMS, 오픈뱅킹 같은 실제 외부 인프라 경로는 이 Stage 1–5 보고서 범위 밖이다.

## 전수 클릭 검증 정정

이 보고서의 기존 상호작용 항목은 핵심 업무 동작 샘플이다. 각 화면의 모든 클릭 가능한 요소를 전부 검증했다는 뜻이 아니다.

전수 검증을 위해 다음 요소를 현재 목록화했다.

- 공통 메뉴 링크
- 목록 검색·필터·페이지 이동
- 생성·수정·삭제·취소 버튼
- 선택 팝업과 날짜·시간 선택기
- 알림·초대·연결·상태 변경 버튼
- CSV 다운로드와 보조 링크

현재 확인된 상태: 요소 목록화 완료, 전수 동작 검증 진행 전. 따라서 DB 연결 전제 조건인 “모든 화면 동작 완료” 상태로 판정하지 않는다.

## 2026-09-21 전수검증 최종 보강

SQLite 시뮬레이션 서버를 기준으로 ego-lite 실제 사용자 조작을 이어서 수행했다.

- 관리자: 학생·강사·클래스·수강·수납·출결·보강·상담·소통·리포트·설정 검증
- 강사: 허용 메뉴 표시와 관리자 전용 메뉴 접근 경계 검증
- 학부모: `/p`, `/p/settings` 표시와 업무 메뉴 접근 경계 검증
- 전체관리자: `/platform`, 문의 큐, 학원 추가, 플래그 저장, 멤버 관리 링크 검증
- 정상·빈값·형식 오류·중복·저장 후 재조회·Tab/Enter 입력 흐름 확인
- HMR 후 수정 결과 재조회 확인

이번 전수검증에서 수정한 SQLite 경로 결함:

1. 출결 시뮬레이션 행을 빈 배열로 덮어쓰던 문제
2. 클래스별 정산 화면·CSV가 Mongo 집계만 호출해 503이 되던 문제
3. SQLite 멤버 초대가 Mongo 초대 생성기로 진입해 500이 되던 문제
4. SQLite 생성 학원 ID를 Mongo ObjectId로만 검증하던 플랫폼 액션 문제
5. SQLite 플랫폼 학원 멤버 관리 링크가 ID 형식 때문에 리다이렉트되던 문제

최종 명령 검증:

- `npm run check`: 통과
- `npm test`: 30개 파일, 146개 테스트 통과
- `npm run lint`: 통과
- `npm run build`: 통과

목업 모드에서 학부모 프로필 저장은 화면에 명시된 대로 비활성화되어 있어 실제 저장 동작은 검증 대상에서 제외했다. 외부 MongoDB·이메일·SMS는 호출하지 않았다.
