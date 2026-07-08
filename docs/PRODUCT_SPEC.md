# Product Specification

## What Is Agent Kit Admin?

A **private Package Registry** for AI Agent ecosystems — think "npm registry" but for AI agent capabilities.

## Problem

Teams using AI agents (Claude Code, Codex, Cursor, etc.) need a way to:
- Share MCP servers and Agent Skills across the team
- Version and distribute agent tooling
- Control who can publish and install packages
- Track what tools each team member is using

## Solution

Agent Kit Admin provides:

1. **Registry Server** — stores, versions, and serves packages
2. **CLI (`akit`)** — command-line tool for publishing, installing, and managing packages
3. **Admin Dashboard** — web UI for browsing, team management, and analytics

## Target Users

- **AI Agent Users** — install MCP servers and skills to enhance their agents
- **Team Leads** — manage team tooling, control access, track usage
- **Tool Authors** — publish and version their MCP servers and skills
- **Platform Admins** — manage users, teams, and system configuration

## Core User Stories

1. As a developer, I want to `akit install @team/web-search` so my Claude Code agent can search the web
2. As a tool author, I want to `akit publish` my MCP server so others can use it
3. As a team lead, I want to see what tools my team is using so I can standardize
4. As an admin, I want to manage teams and permissions so I can control access

## Package Types

| Type | Description | Example |
|---|---|---|
| **MCP** | Model Context Protocol server | `@team/pg-mcp` — PostgreSQL MCP server |
| **Skill** | Agent behavior/capability | `@team/web-search` — web search skill |

## Key Differentiators

- **Private by default** — your packages, your infrastructure
- **Agent-aware** — auto-configures Claude Code, Codex, Cursor, and more
- **Team-scoped** — `@team/package` namespace with RBAC
- **Version-locked** — published versions are immutable

## Success Metrics

- Packages published per team
- Install count per package
- Team adoption rate
- Time from publish to first install
