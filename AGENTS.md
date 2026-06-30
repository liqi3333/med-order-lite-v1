# AGENTS.md

## Project overview

Vanilla TypeScript monorepo (no framework). Frontend is plain TS + HTML served by a custom static server; backend is a plain Node.js HTTP server. No database — drug data is stored as Markdown files with **JSON frontmatter** in `server/kb/drugs/`.

## Two-package layout

| Package | Path | Entry | Compiles to |
|---|---|---|---|
| Frontend | `./` | `src/main.ts` | `dist/` (via `tsconfig.web.json`) |
| Backend | `server/` | `server/src/server.ts` | `server/dist/` (via `server/tsconfig.json`) |

Root `tsconfig.json` is `noEmit: true` — used only by `npm run typecheck`.

## Setup and commands

```bash
# First-time setup (both packages have independent node_modules)
npm install
npm install --prefix server

# Dev server (runs both; Ctrl+C to stop)
npm run dev            # frontend :5173 (auto-compiles on src/ change), backend :8787

# Build / verify
npm run build:all      # compile:all + build:indexes + build:public-snapshot
npm run compile:all    # compile frontend + backend
npm run typecheck      # typecheck both frontend and backend
npm run test           # unit tests (node:test + tsx, 82 tests)
npm run validate:drugs # validate drug.md files
npm run smoke:test     # backend integration smoke test
npm run build:indexes  # rebuild drug index after manual drug file changes
```

## Non-obvious gotchas

- **Backend `dev` script recompiles on every start** (`tsc && node dist/...`). No watch mode.
- **Drug files use JSON frontmatter, NOT YAML.** A YAML-style frontmatter will crash parsing.
- **After adding/editing `server/kb/drugs/*.md` manually**, run `npm run build:indexes` or the drug won't appear in search.
- **Two independent `node_modules`**: root and `server/`. A dependency used in server code must be in `server/package.json`.
- **ESM throughout** — both packages set `"type": "module"`. Use `.js` extensions in relative imports (TypeScript NodeNext resolution).
- **Test files** (`*.test.ts`) live alongside source in `server/src/`. Excluded from `tsc` compilation via `server/tsconfig.json` `exclude`. Run with `node --import tsx --test`.
- **Auto-compile**: `scripts/dev-all.mjs` uses `fs.watch` + `tsc` with debounce for frontend changes.
- **Route table**: Backend routes defined in table format in `server/src/server.ts`, matched by `server/src/core/router.ts`.
- **Index optimization**: `readById` checks `drugs.index.json` first, falls back to directory scan if missing.

## Architecture notes

- **Backend routing**: table-based route definitions in `server/src/server.ts`, matched by `server/src/core/router.ts` (supports `:param` patterns). Middleware chain (CORS, logging, error handling) in `server/src/core/middleware.ts`.
- **Drug index**: `readById` first looks up the file path in `drugs.index.json`, falls back to directory scan if index is missing.
- **Frontend UI**: Modern warm beige design with glassmorphism nav, pill-based filters, card grid layout.

## Key directories

```
server/kb/drugs/        # drug.md source files (the data store)
server/kb/indexes/      # drugs.index.json (generated)
server/kb/taxonomies/   # category/form/route/risk-tag dictionaries (JSON)
server/src/core/        # router, middleware, app-context, config
server/src/modules/     # drug-kb, drug-entry-plugin, order-generator, taxonomy
scripts/dev-all.mjs     # spawns static web server (with auto-compile) + backend API
```
