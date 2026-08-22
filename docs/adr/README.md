# Architecture Decision Record â Agent Kit Admin

> A private package registry for AI Agent ecosystems. Think "npm for AI skills."
>
> **Author:** Agent Kit Admin Team
> **Date:** 2026-08-22
> **Status:** Implemented
> **Repository:** https://github.com/afine907/agent-kit-admin

---

## 1. Context

Teams using AI agents (Claude Code, Codex, Cursor) face a problem: there is no good way to share and version Agent Skills internally. Public registries like npm do not understand AI agent manifests, and they do not provide private team scopes.

We needed to build a private registry that:

- Stores AI agent skills with versioning
- Supports team-based access control (`@team/package`)
- Provides a CLI that integrates into agent workflows
- Ships as a single deployable unit (Docker Compose)
- Can be maintained by a solo developer

---

## 2. Key Decisions

### Decision 1: Three Separate Applications, One Deployment

**Decision:** Build three independent apps (FastAPI server, React SPA, Node CLI) in a monorepo, deployed together via Docker Compose.

**Alternatives considered:**
- Monolithic FastAPI app serving both API and React (rejected: tight coupling, poor DX)
- Serverless functions (rejected: overkill for a private registry, cold start issues)
- Single Next.js app with API routes (rejected: CLI needs standalone Node runtime)

**Rationale:**
- Each component has different runtime requirements (Python ASGI, Node.js, browser)
- Independent testability and deployment flexibility
- Clear mental model: Server = state, CLI = client, Web = dashboard
- Monorepo keeps shared concerns (Docker Compose, CI) in one place while keeping code isolated

**Consequences:
- Can develop and test each component independently
- Tech stack optimized per component
- Three sets of dependencies to maintain
- Shared types need manual sync (mitigated by OpenAPI schema as source of truth)

---

### Decision 2: PostgreSQL + MinIO (not S3 or filesystem)

**Decision:** Use PostgreSQL for metadata, MinIO for tarball storage.

**Alternatives considered:**
- AWS S3 (rejected: requires cloud account, not self-hosted)
- Local filesystem (rejected: not portable, hard to backup)
- Pure PostgreSQL with bytea/BLOB (rejected: blobs bloat the database)

**Rationale:**
- MinIO is S3-compatible, self-hosted, and runs in a container
- PostgreSQL gives us ACID transactions for package metadata, users, teams
- Separation of concerns: metadata is queried frequently (needs indexing), tarballs are large and accessed rarely
- MinIO bucket-per-scope design maps naturally to our package namespace

**Consequences:**
- Self-hosted, no cloud vendor lock-in
- Metadata and storage scale independently
- MinIO provides presigned URLs for direct downloads
- One more service in Docker Compose

---

### Decision 3: Soft Delete with Namespace Reclamation Prevention

**Decision:** Packages use `deleted_at` for soft delete. Deleted package names cannot be re-registered.

**Rationale:**
- Audit trail: we need to know what was published and when
- Dependency integrity: installed packages may reference old versions
- Namespace squatting prevention: without this restriction, someone could delete and re-register a malicious version of the same name

**Consequences:**
- Prevents supply-chain-style attacks via name reclamation
- Downloads and installs remain functional for historical versions
- Database grows indefinitely (mitigated by the fact that package count is bounded by team size)

---

### Decision 4: Unified Scope Namespace

**Decision:** `@username` and `@team-slug` share a single namespace â no collisions allowed.

**Alternatives considered:**
- Separate namespaces (`/user/username/` vs `/team/team-slug/`) (rejected: complicates routing and validation)
- Hierarchical namespace (`username/team-slug/package`) (rejected: over-engineered for current scale)

**Rationale:**
- Simpler mental model: every package has one unique name, period
- Team slugs must be validated against existing usernames at creation time
- Mirrors npm scoped packages but flattens the hierarchy

**Consequences:**
- Single source of truth for name uniqueness
- Install command is always `akit install @scope/name`
- Team creation can fail if username already exists (acceptable trade-off)

---

### Decision 5: Layered Architecture (API â Service â Model)

**Decision:** Enforce strict layering in the server: Routes call Services, Services call Models. No shortcuts.

**Rationale:**
- Testability: services can be tested without HTTP, models without services
- Single responsibility: routes parse, services orchestrate, models query
- Team onboarding: new contributors know exactly where logic belongs

**Enforced via:**
- Code review checklist in CLAUDE.md
- Import rules (models do not import services, services do not import routes)

**Consequences:**
- Highly testable codebase (13K+ lines of tests)
- Easy to add new endpoints without touching existing logic
- Some boilerplate for simple CRUD operations (acceptable)

---

### Decision 6: Content Threshold â Inline vs. MinIO Storage

**Decision:** Package content under 10KB is stored inline in PostgreSQL; over 10KB is stored in MinIO.

**Rationale:**
- Most skills are small configurations (trigger patterns, permissions)
- Inline storage avoids a network round-trip for the common case
- Large content (embedded prompts, documentation) benefits from MinIO streaming

**Consequences:**
- Fast reads for the majority of packages
- No practical size limit on skill content (50KB manifest limit)
- Two code paths for content retrieval (mitigated by a unified `get_content()` service method)

---

### Decision 7: Health Inspection Worker Pattern

**Decision:** Implement an APScheduler-based background worker that periodically inspects package health.

**Alternatives considered:**
- On-demand inspection at publish time (rejected: does not catch external URL rot)
- External cron job (rejected: couples to deployment infrastructure)
- Event-driven inspection (rejected: too complex for current scale)

**Rationale:**
- Package health degrades over time (URLs break, dependencies change)
- Background worker decouples inspection from API request path
- APScheduler is lightweight, in-process, and fits the single-server deployment model

**Dimensions checked:**
- **Compliance:** Manifest schema validation, required fields
- **Content:** Accessibility of embedded URLs, size limits
- **Freshness:** Version staleness, update frequency
- **Functional:** LLM-based test conversation to verify skill behavior

**Consequences:**
- Proactive issue detection before users report problems
- Health badges in Web UI build trust
- Adds CPU/memory overhead during inspection windows

---

### Decision 8: CLI Architecture â Commands to API Client

**Decision:** CLI follows a flat architecture where each command maps to API calls via a shared HTTP client.

**Rationale:**
- CLI is a thin client; all business logic lives on the server
- Easy to add new commands (one file per command)
- Shared auth (token refresh, API key injection) in one place

**Key patterns:**
- `ConfigManager` handles persistent state (auth tokens, registry URL)
- `ApiClient` centralizes auth headers, error handling, token refresh
- Commands are registered via Commander.js with consistent error handling

---

### Decision 9: i18n Strategy â Chinese First

**Decision:** Primary language is Chinese for UI and CLI output. English support planned post-v1.0.

**Rationale:**
- Initial target audience is Chinese-speaking developer teams
- CLI output and error messages in native language reduce friction
- i18next (Web) and i18next-fs-backend (CLI) provide a migration path for English

**Consequences:**
- Immediate usability for target audience
- i18n infrastructure in place for future expansion
- English-speaking contributors may face minor barriers

---

## 3. Infrastructure Decisions

### Docker Compose as Deployment Unit

All services (PostgreSQL, MinIO, Server, Web, Caddy, Worker) are defined in a single `docker-compose.yml`. This ensures:

- One command to start the entire stack (`docker compose up -d`)
- Network isolation: internal services are not exposed externally
- Caddy handles TLS termination and reverse proxy

### CI/CD with GitHub Actions

The CI pipeline runs on every PR:
- **Lint:** oxlint (TypeScript), ruff (Python) â both with `--deny-warnings`
- **TypeCheck:** `tsc --noEmit` for all TS projects
- **Test:** pytest (server), vitest (CLI, Web) with coverage thresholds
- **Build:** Docker image build test

This "fail fast" approach ensures no broken code reaches master.

---

## 4. Technology Choices Summary

| Layer | Technology | Why |
|---|---|---|
| API Server | Python 3.11+, FastAPI | Async-native, automatic OpenAPI docs, Pydantic validation |
| ORM | SQLAlchemy 2.0 (async) | Mature, type-safe, async support |
| Migrations | Alembic | Standard for SQLAlchemy |
| Object Storage | MinIO | S3-compatible, self-hosted |
| CLI | Node.js 20+, TypeScript, Commander.js | Cross-platform, familiar to JS ecosystem |
| Web | React 18, Vite 5, shadcn/ui | Fast dev experience, accessible components |
| State Management | Zustand (Web) | Minimal boilerplate, no provider overhead |
| Data Fetching | TanStack Query | Caching, background refetch, error handling |
| Scheduling | APScheduler | In-process, no external dependencies |
| Gateway | Caddy 2 | Automatic HTTPS, simple config |

---

## 5. What We Would Do Differently

No project is perfect. Here are the trade-offs we would reconsider with hindsight:

1. **OAuth removal was costly.** We initially built OAuth for WeChat Work/Feishu/DingTalk, then removed it for v1.0 because enterprise SSO needs per-customer configuration. We would start with email-only and add OAuth as a plugin later.

2. **Spec-driven development saved us.** Every feature (team packages, health inspector) started with a written spec before code. This prevented scope creep and made AI-assisted development reliable.

3. **Test coverage ratio matters.** Having 13K lines of tests against 19K lines of production code caught regressions early. The initial investment paid off within weeks.

---

## 6. Project Stats

- **Development period:** June 2026 â August 2026 (~2.5 months)
- **Total commits:** 123
- **Production code:** ~19,600 lines (Server 7,575 + CLI 4,212 + Web 7,837)
- **Test code:** ~13,150 lines (Server 8,532 + CLI 2,241 + Web 2,377)
- **Test-to-code ratio:** ~67%
- **License:** MIT
- **Deployment:** Docker Compose (5 services)

---

_This ADR is a living document. As the project evolves, decisions will be revisited and new ones added._
