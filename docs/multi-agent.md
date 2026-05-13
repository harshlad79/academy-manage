# 멀티에이전트 작업 가이드 (academy-manage)

Cursor·CLI에서 **여러 서브에이전트를 병렬로 돌릴 때** 디렉터리를 나누고, 합친 뒤 한 번에 검증하는 절차를 정리한다.  
**반복된 실수·해결책**은 [`multi-agent-lessons.md`](multi-agent-lessons.md)에만 상세 기록한다.

## 언제 쓰는가

- PRD [§13 멀티에이전트 분배](PRD.md)처럼 **도메인 단위**로 나눌 수 있을 때.
- 한 에이전트가 긴 큐에 막혀 있을 때, **파일 충돌 없이** 나눠서 진행할 때.

## 원칙

1. **편집 경로 고정** — 트랙마다 `src/routes/payments/**` vs `src/routes/reports/**` 처럼 겹치지 않게 한다.
2. **공유 파일 단일 담당** — `.env.example`, `src/lib/server/rbac.ts`, `src/routes/+layout.svelte` 등은 **한 트랙만** 수정하거나, 병합 담당이 마지막에 한 번 수정한다.
3. **문서** — 작업 전·중 [`multi-agent-lessons.md`](multi-agent-lessons.md) 를 참고해 린트·빌드·폼 실수를 줄인다.
4. **CLI worktree** (선택) — Cursor `agent --worktree` 로 **다른 작업 폴더**를 쓰면 로컬 파일 충돌을 더 줄일 수 있다. DB·포트는 여전히 공유되므로 환경을 분리한다.

## 트랙 분할 예 (이 저장소)

| 코드 | 디렉터리·주제  | 비고                  |
| ---- | -------------- | --------------------- |
| F    | 청구·수납·입금 | `payments`, 입금 모델 |
| H    | 리포트·CSV     | `reports/**`          |
| C    | 학부모 포털    | `routes/p/**`         |
| 은행 | 오픈뱅킹 스텁  | `lib/server/banking`  |

## 병합 후 검증 (필수)

```bash
npm run check
npm test
npm run lint
npm run build
```

## 서브 브리프 템플릿

서브에이전트에게 **그대로 붙여 넣을** 브리프 골격이다. **목표 한 줄**과 (선택) **caveman 본문**은 블록 밖에 둔다. 아래 펜스는 **`[CRITICAL]`** 로 시작하는 코드 블록 하나로, 그 안의 경로·계약·금지·인수 조건은 상위가 쓴 **원문을 서브가 그대로** 따른다(의역·축약·재정렬로 의미 바꾸기 금지).

**목표(한 줄):** `<예: src/routes/payments에서 환불 상태 전이만 추가>`

(선택) caveman 본문 — 짧게: 동사·경로·금지만. 군더더기·정중어 생략 가능. **커밋·병렬 서브 규칙**은 루트 [AGENTS.md](../AGENTS.md) 를 따른다.

```[CRITICAL]
- 허용·수정 경로: (글머리 원문 그대로)
- 계약: (타입·API·함수 시그니처·에러 코드 등 원문 그대로)
- 금지 편집: (파일·디렉터리·범위 원문 그대로)
- 인수 조건: (검증 명령·동작·데이터 조건 원문 그대로)
```

**필수 산출:** 작업 종료 답변에 **변경한 파일의 전체 경로 목록**을 반드시 포함한다(저장소 루트 기준 상대 경로, 누락 없음). 목록이 없으면 완료로 보지 않는다.

## 관련 문서

| 문서                                                           | 용도                    |
| -------------------------------------------------------------- | ----------------------- |
| [AGENTS.md](../AGENTS.md) (루트)                               | Git·서브·CLI 기본 원칙  |
| [multi-agent-lessons.md](multi-agent-lessons.md)               | 이슈 히스토리·회피 팁   |
| [session-context-digest.md](session-context-digest.md)         | 신규 대화용 초소형 맥락 |
| [session-handoff-and-status.md](session-handoff-and-status.md) | 상세 핸드오프           |
| [inferred-decisions-log.md](inferred-decisions-log.md)         | 구현 추론·결정 기록     |
