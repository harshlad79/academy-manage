# academy-manage

학원(다학원 스코프) 운영·수납·출결·플랫폼 관리를 위한 **SvelteKit** 앱입니다.

## 스택

SvelteKit 5, Tailwind 4, TypeScript strict, MongoDB + Mongoose, Better Auth(mock / live).

## 문서

| 문서                                                                     | 용도                   |
| ------------------------------------------------------------------------ | ---------------------- |
| [docs/PRD.md](docs/PRD.md)                                               | 제품 요구·범위         |
| [docs/session-handoff-and-status.md](docs/session-handoff-and-status.md) | 구현 스냅샷·재개 안내  |
| [docs/session-context-digest.md](docs/session-context-digest.md)         | 신규 대화용 짧은 요약  |
| [AGENTS.md](AGENTS.md)                                                   | 에이전트·Git·검증 순서 |

## 로컬 실행

1. `.env`는 [`.env.example`](.env.example)을 참고합니다. `AUTH_MODE=mock`이어도 업무 데이터는 MongoDB를 씁니다.
2. `npm install`
3. MongoDB 기동 후 `npm run seed` 권장
4. `npm run dev`

## 검증

`npm run check` → `npm test` → `npm run lint` → `npm run build`

원 템플릿 안내는 [SvelteKit 문서](https://svelte.dev/docs/kit)를 참고하세요.
