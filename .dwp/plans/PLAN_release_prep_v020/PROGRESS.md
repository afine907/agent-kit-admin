# Progress — PLAN_release_prep_v020

## Task Summaries

| # | Task | Status | Started | Completed | Notes |
|---|------|--------|---------|-----------|-------|
| 1 | Fix CLI install: add tarball extraction | ✅ Done | 2026-07-08 | 2026-07-08 | Added extractTarball + cleanup in install flow |
| 2 | Fix CLI update: re-download and apply | ✅ Done | 2026-07-08 | 2026-07-08 | Download + extract + manifest-based config rewrite |
| 3 | Add server leave-team endpoint | ✅ Done | 2026-07-08 | 2026-07-08 | POST /teams/{id}/leave with owner guard |
| 4 | Add server uninstall-team-package endpoint | ✅ Done | 2026-07-08 | 2026-07-08 | DELETE /teams/{id}/packages/{pid}/install |
| 5 | Fix server API Key flush + download recording | ✅ Done | 2026-07-08 | 2026-07-08 | Periodic flush + ip/ua in download records |
| 6 | Add web OAuth callback handler | ✅ Done | 2026-07-08 | 2026-07-08 | AuthCallback page + /auth/callback route |
| 7 | Add web token refresh | ✅ Done | 2026-07-08 | 2026-07-08 | Auto token refresh with queue pattern |
| 8 | Fix web TeamPackagesTab buttons | ✅ Done | 2026-07-08 | 2026-07-08 | Publish navigates, Delete with confirm dialog |
| 9 | Add web sort controls | ✅ Done | 2026-07-08 | 2026-07-08 | Sort dropdown: newest/downloads/name |
| 10 | Complete web PackageEdit | ✅ Done | 2026-07-08 | 2026-07-08 | Added license/repository/homepage fields |
| 11 | Fix web i18n gaps | ✅ Done | 2026-07-08 | 2026-07-08 | All hardcoded strings → i18n t() calls |
| 12 | Security Review | ⬜ Pending | — | — | — |
| 13 | Skills & Agents Discovery | ⬜ Pending | — | — | — |
| 14 | Executive Report | ⬜ Pending | — | — | — |

## Key Decisions

(To be filled during execution)

## Important Values & Paths

- Plan root: `.dwp/plans/PLAN_release_prep_v020/`
- Branch: `feature/release-prep-v020`
- Server dir: `apps/server/`
- CLI dir: `apps/cli/`
- Web dir: `apps/web/`
