# AGENTS.md — Agent Index

> This repository is **AI-first and spec-driven**. All structured work begins from a written Deep Work Plan (DWP), not ad-hoc prompts.

## Repository Overview

**Agent Kit Admin** — a private Package Registry for AI Agent ecosystems. Manages MCP servers and Agent Skills for teams using Claude Code, Codex, and other AI agents. Think "npm registry" but for AI agent capabilities.

**Core flow:** `akit publish` (upload package) → Registry stores in PostgreSQL + MinIO → `akit install` (download + auto-configure Agent)

| Component | Stack | Directory | Purpose |
|---|---|---|---|
| **server** | Python 3.11+ / FastAPI / SQLAlchemy 2.0 | `apps/server/` | REST API + package registry logic |
| **cli** | Node.js 20+ / TypeScript / Commander.js | `apps/cli/` | `akit` CLI — publish, install, manage |
| **web** | React 18 / Vite 5 / shadcn/ui | `apps/web/` | SPA admin dashboard |

Infrastructure: PostgreSQL 16 + MinIO + Caddy — all via Docker Compose.

## Mandatory Rules

1. **English-only in code, commits, and agent-facing docs.** UI text and user-facing CLI output may be in Chinese (per project convention).
2. **Conventional Commits** — `<type>(<scope>): <subject>` — types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`.
3. **Pre-commit gates** — all lint, typecheck, and tests must pass locally before committing.
4. **Spec-driven work** — any non-trivial task starts with a written plan (DWP), not spontaneous edits.
5. **Non-destructive changes** — reconcile existing work, never overwrite without asking.
6. **Layered architecture** — API Layer → Service Layer → Model Layer. No shortcuts.

## Quick Commands

### Development

```bash
make dev                    # Start infrastructure (PostgreSQL + MinIO)
pnpm dev:server             # Start FastAPI server (hot-reload)
pnpm dev:cli                # Start CLI in dev mode
pnpm dev:web                # Start React dev server
```

### Build

```bash
make build                  # Build all components
pnpm build:cli              # Build CLI (tsc)
pnpm build:web              # Build Web (tsc + vite)
make build-server           # Build server Docker image
```

### Test

```bash
make test                   # Run all tests
cd apps/server && pytest -v                     # Server tests
cd apps/cli && pnpm test                        # CLI tests (vitest)
cd apps/web && pnpm test                        # Web tests (vitest)
```

### Lint & Format

```bash
make lint                   # Lint all (oxlint + ruff)
pnpm lint                   # Lint CLI + Web (oxlint)
cd apps/server && ruff check .                  # Server lint
cd apps/server && ruff format --check .         # Server format check
cd apps/server && ruff check --fix && ruff format  # Auto-fix
```

### TypeCheck

```bash
make typecheck              # TypeCheck all
pnpm typecheck              # TypeCheck CLI + Web (tsc --noEmit)
cd apps/server && mypy app                      # Server (optional)
```

### Database

```bash
make db-migrate             # Run alembic upgrade head
make db-revision            # Create new migration
make db-reset               # Reset database
```

### Deep Work Plan

```bash
/dwp-create <goal>          # Create a structured work plan
/dwp-execute                # Execute current plan task-by-task
/dwp-status                 # Report progress
/dwp-refine                 # Adjust plan (add/remove/reorder tasks)
/dwp-resume                 # Resume interrupted plan
/dwp-verify                 # Run conformance check
```

## Documentation Index

| Document | Purpose |
|---|---|
| [docs/README.md](docs/README.md) | Documentation index |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture overview |
| [docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md) | Testing conventions and commands |
| [docs/DEVELOPMENT_COMMANDS.md](docs/DEVELOPMENT_COMMANDS.md) | All development commands reference |
| [docs/SECURITY.md](docs/SECURITY.md) | Security posture and practices |
| [docs/STANDARDS.md](docs/STANDARDS.md) | Coding standards and conventions |
| [docs/AI_AGENT_ONBOARDING.md](docs/AI_AGENT_ONBOARDING.md) | AI agent onboarding guide |
| [docs/AI_AGENT_COLLAB.md](docs/AI_AGENT_COLLAB.md) | Agent collaboration patterns |
| [docs/PERFORMANCE.md](docs/PERFORMANCE.md) | Performance considerations |
| [docs/architecture/](docs/architecture/) | Detailed architecture docs (21 files) |
| [docs/specs/](docs/specs/) | Phase specs and feature plans |

## Agent & Skill Catalog

See [.agents/docs/skills_agents_catalog.md](.agents/docs/skills_agents_catalog.md) for the full catalog of agents, skills, and commands.

| Type | Name | Description |
|---|---|---|
| Skill | `akit` | Trigger-style CLI operations (install, search, publish) |
| Skill | `akit-agent` | Proactive team package monitoring |

## Design Documents

All implementation specs live in `docs/architecture/`. Read these before writing code:

| Document | When to read |
|---|---|
| `01-project-overview.md` | Project vision and target users |
| `02-architecture.md` | Before building any component |
| `04-data-model.md` | Before writing models/migrations |
| `05-api-design.md` | Before writing API routes |
| `06-cli-design.md` | Before writing CLI commands |
| `11-mvp-spec.md` | MVP scope and acceptance criteria |
| `13-edge-cases.md` | Before writing error handling |
| `16-developer-quickstart.md` | Backend layering patterns |
| `18-manifest-schema.md` | Package validation rules |

## Git Branches

- `master` — production, always deployable
- `feat/*` — feature branches
- `fix/*` — fix branches
- `worktree-agent-*` — ephemeral AI agent branches (gitignored)
