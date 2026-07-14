# Skills & Agents Catalog

> Auto-generated from `.agents/` structure. Keep in sync with actual files on disk.

## Skills

| Name | Type | Source | Description |
|---|---|---|---|
| `akit` | trigger | `skills/akit.md` | Agent Kit Admin CLI operations — install, search, publish, manage packages |
| `akit-agent` | auto | `skills/akit-agent.md` | Proactive team package monitoring — auto-triggers on team events |
| `deepworkplan` | router | `.agents/skills/deepworkplan/` | Deep Work Plan — structured planning and execution methodology |
| `fix-frontmatter` | utility | `.agents/skills/fix-frontmatter/` | Fix YAML frontmatter issues in markdown files |
| `shellcheck-fix` | utility | `.agents/skills/shellcheck-fix/` | Fix shellcheck warnings in shell scripts |
| `write-bats-test` | utility | `.agents/skills/write-bats-test/` | Write bats test files for shell scripts |

### akit

**Type:** Trigger-style skill
**Trigger:** User mentions install, search, publish, list, update, uninstall package operations
**Capabilities:** Full `akit` CLI command execution with natural language intent parsing
**Source:** [`skills/akit.md`](../../skills/akit.md)

### akit-agent

**Type:** Auto/proactive skill
**Trigger:** Automatic — monitors team package state, recommends updates
**Capabilities:** Team package update monitoring, new tool discovery, usage statistics
**Source:** [`skills/akit-agent.md`](../../skills/akit-agent.md)

### deepworkplan

**Type:** Router skill with 8 sub-skills
**Sub-skills:** `create`, `execute`, `refine`, `resume`, `status`, `verify`, `onboard`, `author`
**Purpose:** Plan and execute structured work using the DWP methodology
**Source:** [`skills/deepworkplan/SKILL.md`](skills/deepworkplan/SKILL.md)
**Installed via:** `npx skills add DailybotHQ/deepworkplan-skill`

## Agents

| Name | Model | Description |
|---|---|---|
| `wellness-agent` | sonnet | Repository health monitor — CI status, dependencies, quality gates |

### wellness-agent

**Purpose:** Run health checks across all three components (server, CLI, web)
**When to use:** Before releases, weekly health checks, after dependency upgrades
**Source:** [`agents/wellness-agent.md`](../agents/wellness-agent.md)

## Commands (DWP Delegators)

| Name | Description |
|---|---|
| `dwp-create` | Create a Deep Work Plan for a goal |
| `dwp-execute` | Execute current plan task-by-task |
| `dwp-status` | Report progress without changes |
| `dwp-refine` | Add/remove/reorder tasks |
| `dwp-resume` | Resume interrupted plan |
| `dwp-verify` | Run conformance check |
| `dwp-onboard` | Onboard repository to DWP |

All commands are thin delegators to the DWP skill's sub-skills.
