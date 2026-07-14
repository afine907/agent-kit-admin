# PROMPTS.md — v0.3.0 Team Collaboration Release

## Phase 1 — Team Management Backend

### Task 1: Server Team Invite Flow

```
Implement the team invite flow for agent-kit-admin.

## Context
- Team/TeamMember models exist in apps/server/app/models/team.py
- TeamService in apps/server/app/services/team.py has create_team, list_members, etc.
- Teams API router in apps/server/app/api/teams.py

## What to build
1. New model: TeamInvite (team_id, token, created_by, expires_at, max_uses)
2. Token generation: 6-char alphanumeric, stored hashed or plain (check existing patterns)
3. POST /teams/{team_id}/invite — create invite token, return token + link
4. POST /teams/join — accept token, create TeamMember entry; reject if expired/used
5. DELETE /teams/{team_id}/invites/{token} — revoke invite
6. GET /teams/{team_id}/invites — list active invites

## Implementation
- Follow existing patterns in TeamService (check_permission, db commit)
- Add to apps/server/app/models/team.py
- Add service methods in TeamService
- Add API routes in teams.py
- Add Pydantic schemas in apps/server/app/schemas/team.py

## Tests
- pytest tests for invite creation, accept, expiry, max_uses, revoke

## Validation
- cd apps/server && pytest tests/test_team_invite.py -v
- cd apps/server && ruff check app/
- cd apps/server && mypy app/
```

### Task 2: Server Team RBAC

```
Implement role management for teams.

## Context
- TeamMember.role: owner | admin | member
- TeamService._check_admin_permission, _check_owner_permission already exist
- No role promotion/demotion/transfer endpoints exist yet

## What to build
1. PUT /teams/{team_id}/members/{user_id}/role — change role (owner → admin/member, admin ↔ member)
2. POST /teams/{team_id}/transfer-ownership — transfer owner role to another admin
3. Ownership transfer must be accepted (add accepted_at field to TeamInvite or a separate PendingOwnershipTransfer table)
4. Prevent owner from being demoted below admin
5. Prevent self-demotion of owner (owner must transfer first)

## Implementation
- Add role change validation (owner can change any; admin can only promote member→admin)
- Ownership transfer: create pending transfer record → target accepts → update owner
- Add necessary fields to TeamMember or new TeamRoleChange table

## Tests
- pytest: owner can promote member→admin; owner can transfer; admin cannot promote to owner
```

### Task 3: Server Team Settings

```
Implement team settings CRUD.

## What to build
1. New TeamSettings model (team_id PK, name, slug, description, avatar_url, default_visibility)
2. GET /teams/{team_id}/settings — return settings
3. PUT /teams/{team_id}/settings — update settings (admin+ only)
4. Slug must be unique; update triggers redirect if slug changed

## Validation
- ruff + mypy
- pytest
```

### Task 4: Server Team Visibility Enforcement

```
Audit and fix team-only package visibility enforcement.

## Context
- Package.visibility: public | private | team
- team visibility should mean: only TeamMember can see, install, download

## What to check/fix
1. GET /packages — filter team packages by membership (already done? verify)
2. GET /packages/{scope}/{name} — return 404 for team packages to non-members
3. GET /packages/{scope}/{name}/download — return 403 for non-members
4. GET /packages/{scope}/{name}/versions/{version}/download — same
5. GET /teams/{team_id}/packages — ensure only members can list

## Implementation
- Add helper: is_team_member(team_id, user_id) — already exists in PackageService
- Add @require_team_membership decorator or inline check in each endpoint
- Write tests verifying non-members get 404/403
```

## Phase 2 — Package Enhancements Backend

### Task 5: Server Package Categories

```
Add category support to packages.

## What to build
1. Add category field to Package model (String(50), nullable, index=True)
2. Migration: ALTER TABLE packages ADD COLUMN category VARCHAR(50)
3. PUT /packages/{scope}/{name} supports category update
4. GET /packages supports ?category=foo filter
5. PackageResponse schema includes category

## Validation
- cd apps/server && pytest -v
```

### Task 6: Server Tag API

```
Enhance tag-related endpoints.

## What to build
1. GET /packages/tags — returns all tags with usage counts: [{"tag": "mcp", "count": 12}]
2. GET /packages?tag=mcp — filter packages by tag
3. Tag count computed from Package.tags JSONB array

## Validation
- pytest
```

### Task 7: Server Deprecation Lifecycle

```
Implement package deprecation with reason.

## What to build
1. Version.deprecated already exists (Boolean default=False)
2. Add deprecation_reason field to Version model (String, nullable)
3. POST /packages/{scope}/{name}/deprecate — body: {"reason": "Use @team/new-pkg instead", "version": "1.0.0"} (optional version, defaults to all)
4. POST /packages/{scope}/{name}/undeprecate — body: {"version": "1.0.0"} (optional)
5. GET /packages/{scope}/{name} returns deprecated=true if any version is deprecated
6. PackageResponse includes deprecation_reason

## Validation
- pytest
```

### Task 8: Server Dependency Graph

```
Implement full dependency graph resolution with cycle detection.

## Context
- POST /packages/check-dependencies exists (returns resolved deps)
- Package model has no stored manifest_dependencies yet
- Dependency graph needs cycle detection

## What to build
1. Add manifest_dependencies JSONB to Package model (nullable)
2. On package publish: parse manifest from uploaded tarball, store deps
3. GET /packages/{scope}/{name}/dependencies — returns full dependency tree
4. Enhance POST /packages/check-dependencies:
   - Recursive resolution (resolve each dep's deps)
   - Cycle detection (DFS, return cycle path if found)
   - Version compatibility check (semver)
5. Store resolved dependency graph on Package model

## Cycle Detection Algorithm
- Use DFS with recursion stack
- If node already in current stack → cycle detected, return cycle path

## Validation
- pytest: cycle detected, normal resolution, version conflict
```

## Phase 3 — CLI Team Commands

### Task 9: CLI Team Commands

```
Add `akit team` subcommand group.

## Context
- CLI in apps/cli/src/commands/
- Existing commands: install, publish, search, list, whoami, login, logout, info, init
- Use oclif-style command structure

## What to build
akit team invite <team-name>
  → GET /teams/{team_id}/invite → print invite link

akit team join <token>
  → POST /teams/join {"token"}

akit team members <team-name>
  → GET /teams/{team_id}/members → print table

akit team role <user-id> --role <admin|member>
  → PUT /teams/{team_id}/members/{user_id}/role

akit team settings <team-name> [--name X] [--description X]
  → PUT /teams/{team_id}/settings

## Implementation
- New file: apps/cli/src/commands/team.ts
- Subcommands: invite, join, members, role, settings
- Use existing API client from apps/cli/src/api/client.ts
- Add tests in apps/cli/tests/commands/team.test.ts

## Validation
- cd apps/cli && pnpm exec vitest run
- pnpm --filter akit lint
- pnpm --filter akit typecheck
```

### Task 10: CLI Dependency Install

```
Enhance `akit install` to support recursive dependency resolution.

## Context
- Current install: flat install, no dependency resolution
- Server has dependency graph endpoints (Task 8)

## What to build
1. On `akit install @team/pkg`, call GET /packages/{scope}/{name}/dependencies
2. Build dependency tree, detect cycles
3. Show what will be installed (dry-run mode: akit install --dry-run)
4. Install in correct topological order
5. Show warning if cycle detected (but allow proceed)
6. Store dependency info in install record

## Cycle Handling
- If cycle: warn user, skip cycled packages, continue with acyclic deps

## Validation
- vitest: mock API, test cycle detection, test order
```

## Phase 4 — Frontend

### Task 11: Web Team Management Page

```
Rewrite Teams.tsx into full team management UI.

## Context
- Current Teams.tsx is read-only
- Design system: shadcn/ui, tailwind, zustand stores

## What to build
Tabs:
1. Overview tab: team name/description/avatar, stats (member count, package count, total installs)
2. Members tab: member list table (name, email, role badge, joined date), invite button, role dropdown per member, remove button (with confirmation dialog)
3. Packages tab: team's package list (same as Home.tsx card grid)
4. Settings tab: edit name/description/avatar URL/default visibility (admin+ only)

## Implementation
- Add tabs with shadcn/ui Tabs component
- Team member role badges: owner=purple, admin=blue, member=gray
- Invite: modal with copy-link button
- Role change: dropdown with confirmation for owner transfer
- Use existing API client (apps/web/src/lib/api.ts)
- Add zustand store for team data if needed

## Validation
- pnpm --filter web typecheck
- pnpm --filter web lint
```

### Task 12: Web User Settings Page

```
Create Settings.tsx with user profile and API token management.

## What to build
Route: /settings

Sections:
1. Profile: display name input, avatar URL input, save button
2. Security: change password form (current + new + confirm); API tokens list (name, created, expiry), create token (name + expiry), revoke button per token
3. Notifications: email toggles (UI only, no backend wire yet) — label as "coming soon"

API endpoints needed:
- GET /users/me — current user info
- PUT /users/me — update display name, avatar
- GET /users/me/tokens — list tokens
- POST /users/me/tokens — create token
- DELETE /users/me/tokens/{id} — revoke token

## Implementation
- New page: apps/web/src/pages/Settings.tsx
- Add route in App.tsx
- Add Settings link in Header user dropdown

## Validation
- pnpm --filter web typecheck
- pnpm --filter web lint
- vitest if tests exist for new pages
```

### Task 13: Web Dashboard Stats

```
Create Dashboard.tsx with metrics and activity feed.

## What to build
Route: /dashboard

Backend: GET /admin/stats → {total_packages, total_installs_30d, active_teams, active_users, recent_activity: [...]}

Frontend:
1. Metrics cards (4): Total Packages, Installs (30d), Active Teams, Active Users — use Card component
2. Activity feed: list of recent publishes/installs with timestamp and actor
3. Simple bar chart: installs per day (last 14 days) — use simple CSS bars or recharts if already installed

Navigation:
- Link in Header navbar
- Admin-only route (check user role)

## Validation
- pnpm --filter web typecheck
- pnpm --filter web lint
```

### Task 14: Web Package Category Filter

```
Add category filter and tag cloud to package list.

## What to build
1. Category dropdown in package list header (fetch from GET /packages/tags?field=category)
2. Tag cloud on home page sidebar (fetch all tags from GET /packages/tags)
3. Clickable tags filter the list (URL param: ?tag=mcp)
4. Selected tag shown as removable chip
5. Category badge on PackageCard

## Implementation
- Modify Home.tsx to support tag/category filter params
- Add tag cloud component in sidebar
- Use URL params for shareable filtered views

## Validation
- pnpm --filter web typecheck
- pnpm --filter web lint
```

## Phase 5 — Final

### Task 15: E2E Verification

```
End-to-end verification of complete team workflow.

## What to test
1. Create team → invite user → accept invite → verify member list
2. Publish package under team → install as member → verify install record
3. Admin demotes member → verify permissions changed
4. Owner transfers ownership → new owner accepts → verify role changed
5. Deprecate package → verify warning shown on install
6. Dashboard stats update after publish/install actions

## Implementation
- pytest-asyncio: test_e2e_v030.py in apps/server/tests/
- Covers all new API endpoints

## Validation
- cd apps/server && pytest tests/test_e2e_v030.py -v
```

### Task 16: Security Review

```
Security review of all v0.3.0 changes.

## Scope
- Invite token: brute-force resistance, expiry, token generation randomness
- RBAC: privilege escalation vectors, owner transfer hijacking, role demotion bypass
- Team visibility: information disclosure via timing (404 vs 403), enumerate private team packages
- Deprecation: reason field injection (XSS in UI), mass deprecation DoS
- Dependency graph: cycle attack (self-referencing packages), recursion depth limits
- API tokens: token generation security, exposure in logs, CSRF
- User settings: password change CSRF, token revocation authorization

## Deliverable
- analysis_results/SECURITY_REVIEW.md with findings, severity, recommendations

## Validation
- No critical findings unfixed before release
```

### Task 17: Skills & Agents Discovery

```
Discover new skills and agent patterns from v0.3.0 work.

## What to check
- New CLI patterns: team subcommand group — worth a skill?
- Dependency resolution logic — worth a reusable skill?
- RBAC service patterns — worth documenting?
- Dashboard data fetching — worth a React hook skill?

## Deliverable
- analysis_results/SKILLS_AGENTS_DISCOVERY.md

## Validation
- Read .agents/skills/ catalog, compare new patterns
```

### Task 18: Executive Report

```
Generate final v0.3.0 release report.

## What to include
1. Executive Summary — what shipped, why it matters
2. Product Impact — new user-facing capabilities
3. Technical Details — architecture decisions, schema changes, API additions
4. QA Verification Guide — how to test each feature
5. Migration Notes — breaking changes, upgrade steps
6. FAQs — common questions
7. Next Steps — v0.4.0 planning

## Deliverable
- analysis_results/EXECUTIVE_REPORT.md

## Validation
- Report readable, complete, accurate
```
