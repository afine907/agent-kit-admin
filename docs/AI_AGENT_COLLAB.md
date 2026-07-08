# Agent Collaboration Patterns

## Single Agent Workflow

Most work is done by a single agent (Claude Code) following the DWP methodology:

1. `/dwp-create <goal>` — plan the work
2. `/dwp-execute` — execute task by task
3. `/dwp-status` — check progress at any time
4. `/dwp-verify` — confirm conformance when done

## Multi-Agent Patterns

### Worktree Isolation

When multiple agents work in parallel, each gets an isolated git worktree:

```
main branch
├── worktree-agent-1/  (feature A)
├── worktree-agent-2/  (feature B)
└── worktree-agent-3/  (bugfix C)
```

Each worktree is independent — no merge conflicts until integration.

### Agent Roles

| Agent | Role | Model Tier |
|---|---|---|
| Main agent | Planning, coordination, complex logic | Default |
| Explore agent | Codebase research, file discovery | Default |
| Wellness agent | Health checks, quality gates | Sonnet |

### Handoff Pattern

When one agent finishes and another continues:

1. First agent commits work to its branch
2. Second agent checks out the branch
3. Second agent reads plan file to reconstruct context
4. Second agent continues from next pending task

## Communication

- Agents communicate through **plan files** (`.dwp/plans/`) and **commit messages**
- No direct agent-to-agent messaging
- Plan files serve as the shared state

## Conflict Resolution

- Each agent works on a separate worktree/branch
- Merge conflicts are resolved at PR time by a human
- Plan files track who did what and why
