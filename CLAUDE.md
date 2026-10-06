# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

`ioBroker.kiwi` is an ioBroker adapter that exposes ioBroker as an **MCP server** (for Claude Desktop, VS Code, … ) and
ships an **integrated Gemini chat bot** reachable through the `kiwi.X.chat.prompt` / `kiwi.X.chat.response` states.
States get a free-text description (custom settings) that is embedded into a **vector store** for semantic search.

This repo is a **fork** (`michiproep/ioBroker.kiwi`) of the unmaintained upstream `Holger-Will/ioBroker.kiwi`.
The npm package `iobroker.kiwi` is still owned by the upstream author (npm latest = 0.4.2), so the fork cannot publish
to npm under that name yet. See [CONTRIBUTING.md](CONTRIBUTING.md#releasing).

**Current maintenance goal:** keep the adapter and its dependencies current and running on the latest ioBroker
(js-controller, admin, Node.js LTS). Feature work on AI/vector stores is exploratory — see the
"AI and vector store integration status" section in [README.md](README.md).

## Architecture

The code runs in **two different processes**:

| Entry                                                                | Runs in                     | Purpose                                                                                                |
| -------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------ |
| `main.js` → `adapter.mjs` (`McpServer` class)                        | the kiwi adapter process    | indexes object descriptions into the vector DB on `objectChange`, runs the `Chatbot` for `chat.prompt` |
| `lib/web.js` → `lib/mcp-web.mjs` (`webExtension` in io-package.json) | the **web adapter** process | serves the MCP HTTP endpoint `/kiwi/<instance>/mcp` and the static UI in `lib/public/`                 |

Key modules:

- `lib/api_adapter.mjs` – `ioBrokerAdapterApi`: the single implementation layer that all MCP tools call. Owns its own vector DB instance.
- `lib/tools/*.mjs` – one MCP tool per file, aggregated in `lib/tools/allTools.mjs`. Shape:
  `{ name, desc, params /* zod shape */, call: (API) => async (args) => ({ content: [{ type: "text", text }] }) }`.
  Exposed tool names are the `name` field, not the file name (e.g. `getState.mjs` → `getIobrokerState`).
- `lib/chatbot.mjs` – Gemini chat (`@google/genai`) wired to the tools through an in-process MCP transport (`lib/mcp-direct-transport.mjs`).
- Vector stores (only one is active, see README):
    - `lib/openai-sqlite-vectorize.mjs` – **active**: OpenAI `text-embedding-3-large` (3072 dims) + SQLite/`sqlite-vec`.
    - `lib/sqlite-vectorize.mjs` – prepared: Gemini embeddings (768 dims) + SQLite/`sqlite-vec` (original upstream).
    - `lib/openai-postgres-vectorize.mjs` – prepared: OpenAI embeddings + Postgres/pgvector (no config UI).
- `admin/jsonConfig.json` (instance settings), `admin/jsonCustom.json` (per-state "description" custom setting), `admin/i18n/*`.

Gotchas:

- The vector DB is opened up to three times on the same SQLite file (adapter, chatbot API, web extension). WAL mode is on.
- The SQLite vector table dimension is fixed at creation. Switching embedding model/dimension requires deleting
  `<iobroker-data>/kiwi.X/*.sqlite` and re-indexing.
- One `apiKey` setting is passed to both Gemini (chat) and OpenAI (embeddings). That cannot work for both at once.
- Never log the API key; it is `protectedNative`/`encryptedNative`.

## Commands

```sh
npm install             # use `npm ci` in CI; keep package-lock.json in sync with package.json
npm run lint            # ESLint
npm run check           # tsc type check (JS, noEmit)
npm test                # unit + package tests (mocha)
npm run test:integration # starts a real js-controller + adapter (slow, needs network)
npx @iobroker/repochecker https://github.com/michiproep/ioBroker.kiwi --local   # ioBroker compliance check
npm run release -- patch|minor|major   # see CONTRIBUTING.md; only on an up-to-date main
```

## Conventions

- ESM (`.mjs`) for adapter code; `main.js`/`lib/web.js` are CommonJS shims required by ioBroker.
- Tabs, double quotes, semicolons (Prettier + ESLint). Match the surrounding code.
- Use `node:` prefixes for built-ins and `this.setTimeout`/`adapter.setTimeout` instead of global timers (repochecker rules).
- Any new admin label/tooltip needs an entry in `admin/i18n/en.json` (run `npm run translate` for other languages).
- User-facing changes go into README.md under `### **WORK IN PROGRESS**` in the Changelog — the release script turns that into the version entry and the `common.news` in io-package.json. Do not edit `version` or `common.news` by hand.

## Git workflow

- `main` is always releasable. Never commit directly to `main`.
- Branch per change: `feat/…`, `fix/…`, `chore/…` (deps, tooling, CI), `docs/…`. Open a PR to `main`; CI must be green.
- Small, focused commits with imperative messages (`fix: await getHistory call`).
- Releases are tags `vX.Y.Z` created by the release script on `main` — never hand-made tags.
