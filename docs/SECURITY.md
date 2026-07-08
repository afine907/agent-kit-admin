# Security Posture

## Overview

Agent Kit Admin is a private package registry. Security is critical because it manages packages that are installed into AI agent environments.

## Authentication

- **JWT tokens** for user sessions (short-lived, with automatic refresh)
- **API Keys** for CLI operations (scoped, revocable, last_used_at tracked)
- **OAuth** for enterprise SSO (WeChat Work, Feishu, DingTalk) — callback handled at `/auth/callback`
- **Token refresh** — automatic refresh on 401 with promise queue to prevent concurrent refresh storms
- Auth implementation: [`docs/architecture/07-auth-design.md`](architecture/07-auth-design.md)

## Authorization

- **RBAC** — admin and regular user roles
- **Team-scoped permissions** — package access controlled by team membership
- **Scope namespace** — `@username` and `@team-slug` share one namespace, no collisions

## Package Security

- **Manifest validation** — all packages validated against `akit.json` schema before publish
- **Soft delete** — deleted packages cannot be re-registered (prevents namespace squatting)
- **Version immutability** — published versions cannot be overwritten
- **Size limits** — Skill content max 50KB (larger stored in MinIO)

## Infrastructure

- **PostgreSQL** — metadata storage, not exposed externally
- **MinIO** — package tarball storage, internal network only
- **Caddy** — TLS termination, reverse proxy
- **Docker Compose** — all services in isolated network

## Secrets Management

- Environment variables via `.env` files (not committed)
- `.env.example` provides template with safe defaults
- Secrets never logged or returned in API responses

## Dependencies

- Python: `pip-audit` for vulnerability scanning (planned)
- Node.js: `pnpm audit` available
- CI does not currently run dependency audits (planned)

## Network

- All internal services communicate over Docker network
- Only Caddy exposes ports 80/443 externally
- Rate limiting middleware on all API endpoints

## Reporting

Report security issues privately through GitHub's vulnerability reporting on the repository.
