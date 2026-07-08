# AI Agent Onboarding

> Welcome to Agent Kit Admin. This guide orients you to the repository structure, conventions, and workflows.

## What This Repository Is

A private Package Registry for AI Agent ecosystems. Three components:

- **Server** (Python/FastAPI) — REST API, package storage, auth
- **CLI** (TypeScript/Commander.js) — `akit` command-line tool
- **Web** (React/Vite) — Admin dashboard

## First Steps

1. Read [`AGENTS.md`](../AGENTS.md) — agent index with Quick Commands
2. Read [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) — system overview
3. Read the relevant design doc before working on a component:
   - Server: [`docs/architecture/16-developer-quickstart.md`](architecture/16-developer-quickstart.md)
   - CLI: [`docs/architecture/06-cli-design.md`](architecture/06-cli-design.md)
   - Web: [`docs/architecture/20-frontend-types.md`](architecture/20-frontend-types.md)

## Code Quality Gates

Every commit must pass these checks **before** pushing:

| Check | Server | CLI | Web |
|---|---|---|---|
| Lint | `ruff check .` | `pnpm lint` | `pnpm lint` |
| Format | `ruff format --check .` | (via oxlint) | (via oxlint) |
| TypeCheck | `mypy app` (optional) | `pnpm typecheck` | `pnpm typecheck` |
| Test | `pytest -v` | `pnpm test` | `pnpm test` |

## Key Conventions

- **Language:** Chinese for UI/CLI user-facing text, English for code and commits
- **Commits:** Conventional Commits — `<type>(<scope>): <subject>`
- **Architecture:** API Layer → Service Layer → Model Layer
- **Errors:** `AppError(code, message, status_code)` pattern

## Common Pitfalls

1. **Don't skip typecheck** — `pnpm typecheck` is separate from `pnpm lint`
2. **Don't use `ruff format` without `ruff check`** — both are required
3. **Don't commit without running tests** — CI will catch it, save the round-trip
4. **Don't modify `docs/architecture/`** without reading the related doc first

## Working With Agents

- `.agents/` contains agent definitions, skills, and commands
- `/dwp-create` to plan work, `/dwp-execute` to run it
- Existing skills: `akit` (trigger), `akit-agent` (proactive)
