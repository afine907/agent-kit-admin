# Coding Standards

> Detailed rules: `.claude/rules/` (Python, TypeScript, React, Testing, etc.)

## Naming Conventions

| Type | TypeScript | Python |
|---|---|---|
| Variables/Functions | `camelCase` | `snake_case` |
| Classes/Interfaces | `PascalCase` | `PascalCase` |
| Constants | `UPPER_SNAKE_CASE` | `UPPER_SNAKE_CASE` |
| Files | `kebab-case.ts` / `PascalCase.tsx` | `snake_case.py` |

## Formatting

| Language | Tool | Indent | Line Width | Quotes |
|---|---|---|---|---|
| TypeScript | oxlint | 2 spaces | 120 | Single `'` |
| Python | Ruff | 4 spaces | 120 | Double `"` |

## Git

- **Conventional Commits:** `<type>(<scope>): <subject>`
- **Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`
- **Scopes:** `server`, `cli`, `web`, `ci`, `deps`, or omit

## Backend Architecture

```
API Layer (api/)        → thin: parse params, call service, return response
Service Layer (services/) → business logic, transactions, permission checks
Model Layer (models/)    → SQLAlchemy ORM, database queries
```

Use `Depends()` for dependency injection. Errors use `AppError(code, message, status_code)`.

## Frontend Patterns

- **Data fetching:** TanStack Query (`useQuery`, `useMutation`)
- **State management:** Zustand stores
- **Styling:** Tailwind CSS + `cn()` utility (clsx + tailwind-merge)
- **Components:** shadcn/ui base, custom wrappers

## Error Handling

- Never ignore Promise rejections
- Use specific error types, not generic `Exception`
- Handle errors at the appropriate layer
- User-facing errors in Chinese, developer errors in English

## Comments

- Complex logic: explain **why**, not what
- Public APIs: JSDoc (TypeScript) / docstring (Python)
- TODO format: `// TODO(username): description`
