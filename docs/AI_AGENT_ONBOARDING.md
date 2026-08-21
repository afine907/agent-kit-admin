# AI Agent Onboarding

> Welcome to Agent Kit Admin. This guide orients you to the repository structure, conventions, and workflows.

## What This Repository Is

A private Package Registry for AI Agent ecosystems. Three components:

- **Server** (Python/FastAPI) - REST API, package storage, auth
- **CLI** (TypeScript/Commander.js) - kit command-line tool
- **Web** (React/Vite) - Admin dashboard

## First Steps

1. Read AGENTS.md (project root) - agent index with Quick Commands
2. Read docs/ARCHITECTURE.md - system overview
3. Read the relevant source code before working on a component:
   - Server: pps/server/app/ (api, services, models, schemas)
   - CLI: pps/cli/src/commands/
   - Web: pps/web/src/pages/ and pps/web/src/components/

## Code Quality Gates

Every commit must pass these checks **before** pushing:

| Check | Server | CLI | Web |
|---|---|---|---|
| Lint | 
uff check . | pnpm lint | pnpm lint |
| Format | 
uff format --check . | (via oxlint) | (via oxlint) |
| TypeCheck | mypy app (optional) | pnpm typecheck | pnpm typecheck |
| Test | pytest -v | pnpm test | pnpm test |

## Key Conventions

- **Language:** Chinese for UI/CLI user-facing text, English for code and commits
- **Commits:** Conventional Commits - <type>(<scope>): <subject>
- **Architecture:** API Layer -> Service Layer -> Model Layer
- **Errors:** AppError(code, message, status_code) pattern

## Common Pitfalls

1. **Don't skip typecheck** - pnpm typecheck is separate from pnpm lint
2. **Don't use 
uff format without 
uff check** - both are required
3. **Don't commit without running tests** - CI will catch it, save the round-trip
4. **Don't modify database models** without creating an Alembic migration

## Working With Agents

- .agents/ contains agent definitions, skills, and commands
- Existing skills: kit (trigger), kit-agent (proactive)
