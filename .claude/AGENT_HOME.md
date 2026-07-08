# Agent Home Directory

This directory (`.claude/`) is the Claude Code configuration home.

## Structure

- `rules/` — Project-specific coding rules (always loaded by Claude Code)
- `retrospectives/` — Session retrospectives and lessons learned
- `AGENT_HOME.md` — This file

## Relationship to `.agents/`

The canonical cross-agent home is **`.agents/`** at the repository root:

- `.agents/agents/` — Agent definitions
- `.agents/skills/` — Skill definitions
- `.agents/commands/` — DWP command delegators
- `.agents/docs/` — Catalog and reference docs
- `.agents/settings.json` — Agent settings

`.claude/` continues to hold Claude Code-specific configuration (rules, retrospectives). These two directories serve different purposes and coexist.

## Why Not Symlink?

The DWP methodology recommends `.claude → .agents` symlink. However:

1. `.claude/` already contains valuable content (9 rule files, 3 retrospectives)
2. Windows symlink creation requires admin privileges
3. Claude Code specifically looks for `.claude/rules/` — symlinking would break this

**Resolution:** Keep both directories. `.agents/` is the cross-agent home, `.claude/` is the Claude Code home.
