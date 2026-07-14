# Documentation Index

> Agent Kit Admin project documentation. All docs are repo-specific, not templates.

## Quick Links

| Document | Purpose | When to Read |
|---|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture overview | Before building any component |
| [TESTING_GUIDE.md](TESTING_GUIDE.md) | Testing conventions and commands | Before writing tests |
| [DEVELOPMENT_COMMANDS.md](DEVELOPMENT_COMMANDS.md) | All development commands | Daily development reference |
| [SECURITY.md](SECURITY.md) | Security posture and practices | Before deploying or handling auth |
| [STANDARDS.md](STANDARDS.md) | Coding standards and conventions | Before writing code |
| [AI_AGENT_ONBOARDING.md](AI_AGENT_ONBOARDING.md) | AI agent onboarding guide | First time working in this repo |
| [AI_AGENT_COLLAB.md](AI_AGENT_COLLAB.md) | Agent collaboration patterns | When multiple agents work together |
| [PERFORMANCE.md](PERFORMANCE.md) | Performance considerations | Before optimization work |

## Architecture Docs (Detailed)

Located in [`architecture/`](architecture/) — 21 design documents:

| Doc | Topic |
|---|---|
| 01-project-overview.md | Project vision and target users |
| 02-architecture.md | System architecture, request flows |
| 03-tech-stack.md | Technology choices and versions |
| 04-data-model.md | SQL schema, indexes, soft delete |
| 05-api-design.md | All endpoints, request/response formats |
| 06-cli-design.md | CLI commands and agent adapter logic |
| 07-auth-design.md | OAuth, JWT, RBAC, API Key auth |
| 08-deployment.md | Docker Compose, env vars, production |
| 09-roadmap.md | Version planning and milestones |
| 10-user-stories.md | User personas and scenarios |
| 11-mvp-spec.md | MVP scope and acceptance criteria |
| 12-dfx.md | Non-functional requirements, CI/CD |
| 13-edge-cases.md | 20 edge cases with exact responses |
| 14-prd-phases.md | Product requirements phased plan |
| 15-user-journey.md | End-to-end user flows |
| 16-developer-quickstart.md | Backend layering patterns |
| 17-akit-skill-design.md | Skill package format |
| 18-manifest-schema.md | JSON Schema for akit.json |
| 19-database-migrations.md | Alembic migration strategy |
| 20-frontend-types.md | TypeScript types and hooks |
| 21-review-issue-search.md | Review and search feature |

## Phase Specs

Located in [`specs/`](specs/) — feature implementation plans.

## Testing

Located in [`testing/`](testing/) — test architecture and E2E guide.

## Diagrams

Located in [`architecture/diagrams/`](architecture/diagrams/) — Mermaid format: architecture overview, data flow sequences, ER diagrams.
