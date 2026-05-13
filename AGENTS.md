# academy-manage — 에이전트 운영 지침

IDE·Cursor CLI 에이전트가 이 저장소에서 작업할 때의 **기본 원칙**이다.  
(`~/.cursor/cli-config.json`에는 커밋 주기·서브 강제 같은 워크플로 키가 없으므로, 되돌리기·감사는 **Git**을 기준으로 한다.)

## Git

- **논리 단위**(한 이슈·한 기능 슬라이스)마다 작업 후 `git add` → `git commit`까지 끊고, 다른 주제로 넘어간다.
- 커밋 메시지: 무엇을·왜 한 줄 요약; 필요 시 본문.
- **병렬 서브**가 같은 브랜치에서 동시에 `commit`하지 않는다. 커밋·머지는 **한 트랙**(부모 또는 지정 담당)이 순차 처리한다.

## 서브에이전트·멀티에이전트

- 쪼갤 수 있으면 **Task(서브)**에 위임한다. 부모는 브리프·충돌 경로·검증만 맡긴다.
- 서브 브리프: 짧게 쓰고, **`[CRITICAL]`** 블록에만 경로·계약·금지·완료 조건을 **전문**으로 둔다. 보고는 간략해도 되나 **변경 파일 전체 경로 목록**은 반드시 남긴다.
- 경로 분배·공유 파일 단일 담당·병합 후 검증: [docs/multi-agent.md](docs/multi-agent.md), 실수 방지: [docs/multi-agent-lessons.md](docs/multi-agent-lessons.md).

## 검증

- 머지 또는 단위 완료 후: `npm run check` → `npm test` → `npm run lint` → `npm run build`.

## CLI

- `git commit` / `git add` / `git status` / `git diff` 등이 `~/.cursor/cli-config.json`의 `permissions.allow`에 없으면 에이전트가 커밋하지 못한다. 필요 시 패턴을 추가한다.

## 파일 이름

- Cursor 등에서 관례적으로 쓰는 표준 파일명은 **`AGENTS.md`**(복수)이다. 이 저장소의 에이전트 운영 원칙 단일 원본도 **`AGENTS.md`** 로 둔다.
