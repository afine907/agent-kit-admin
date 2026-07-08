# Commands Reference

## DWP Commands

All DWP commands are thin delegators that route to the installed DWP skill.

### /dwp-create `<goal>`

Create a structured work plan from a goal description.

```bash
/dwp-create Add API key rotation endpoint with audit logging
```

**Output:** Plan file in `.dwp/plans/` with numbered tasks and validation gates.

---

### /dwp-execute

Execute the current plan step by step. Validates each gate before proceeding.

**Prerequisites:** Active plan in `.dwp/plans/`

---

### /dwp-status

Report plan progress (read-only). Shows task checklist with status indicators.

---

### /dwp-refine

Modify active plan — add, remove, or reorder tasks. Preserves completed work.

---

### /dwp-resume

Resume interrupted plan. Reconstructs state and continues from next pending task.

---

### /dwp-verify

Run conformance check against DWP specification. Returns pass/fail report.

---

### /dwp-onboard

Onboard repository to DWP methodology. Creates AGENTS.md, docs/, .agents/, .dwp/.

---

## Project Commands

### Development

```bash
make dev                    # Start infrastructure (PostgreSQL + MinIO)
pnpm dev:server             # Start FastAPI server (hot-reload)
pnpm dev:cli                # Start CLI in dev mode
pnpm dev:web                # Start React dev server
```

### Quality Gates

```bash
make lint                   # Lint all components
make typecheck              # TypeCheck all components
make test                   # Run all tests
```

### Database

```bash
make db-migrate             # Run migrations
make db-revision            # Create new migration
make db-reset               # Reset database
```
