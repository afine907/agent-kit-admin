# Security Review — PLAN_release_prep_v020

## Scope

Review of all code changes from tasks 1-11 (CLI install/update, server endpoints, web OAuth/token/UI).

## Summary

**No critical security findings.** All changes follow existing security patterns and introduce no new attack surfaces beyond what is already documented.

## Detailed Findings

### 1. CLI Tarball Extraction (Tasks 1-2)

- **File:** `apps/cli/src/utils/tarball.ts`, `apps/cli/src/commands/install.ts`, `apps/cli/src/commands/update.ts`
- **Risk Level:** Low
- **Analysis:** `extractTarball()` uses `tar.extract()` with `strip: 1` — standard pattern, no path traversal risk beyond the target directory. Tarball is downloaded over HTTPS (API returns presigned MinIO URL). File is cleaned up after extraction.
- **Finding:** No issues.

### 2. Server Leave-Team Endpoint (Task 3)

- **File:** `apps/server/app/api/teams.py`, `apps/server/app/services/team.py`
- **Risk Level:** Low
- **Analysis:** Authenticated endpoint. Owner guard prevents owner from leaving (returns 400 with guidance). Uses existing `_get_member` pattern with SQLAlchemy ORM — no SQL injection risk. Membership record is deleted (not soft-deleted), which is appropriate for a leave action.
- **Finding:** No issues.

### 3. Server Uninstall-Team-Package Endpoint (Task 4)

- **File:** `apps/server/app/api/teams.py`, `apps/server/app/services/team_package.py`
- **Risk Level:** Low
- **Analysis:** Authenticated endpoint. Verifies team membership before allowing uninstall. Uses SQLAlchemy ORM. Returns 404 if install record not found.
- **Finding:** No issues.

### 4. Server API Key Flush (Task 5)

- **File:** `apps/server/app/main.py`
- **Risk Level:** Low
- **Analysis:** Periodic background task flushes in-memory `last_used_at` updates to database. Uses existing `APIKeyService.flush_pending_updates()`. No new attack surface. Task is properly cancelled on shutdown with a final flush.
- **Finding:** No issues.

### 5. Server Download Recording (Task 5)

- **File:** `apps/server/app/api/packages.py`
- **Risk Level:** Low
- **Analysis:** `ip_address` extracted from `request.client.host` (trusted from ASGI server). `user_agent` from `request.headers.get("user-agent")` — user-controlled but stored as text, no execution risk. Both fields are optional and nullable in the Download model.
- **Finding:** No issues.

### 6. Web OAuth Callback (Task 6)

- **File:** `apps/web/src/pages/AuthCallback.tsx`
- **Risk Level:** Low
- **Analysis:** Token extracted from URL search params (`?token=...`). User info parsed from either `?user=JSON` param or JWT payload (base64 decode). No `eval()` or `dangerouslySetInnerHTML` used. Token is stored in Zustand (persisted to localStorage). The OAuth redirect URL is controlled by the server, so token is trustworthy.
- **Finding:** No issues. Note: JWT payload parsing uses `atob()` which is safe for base64 decoding.

### 7. Web Token Refresh (Task 7)

- **File:** `apps/web/src/lib/api.ts`
- **Risk Level:** Low
- **Analysis:** Standard refresh token flow. Uses promise queue to prevent multiple simultaneous refreshes. On refresh failure, clears auth state. No new attack surface — refresh endpoint already existed on the server.
- **Finding:** No issues.

### 8. Web TeamPackagesTab Buttons (Task 8)

- **File:** `apps/web/src/components/TeamPackagesTab.tsx`
- **Risk Level:** Low
- **Analysis:** Publish button navigates to `/publish?scope=team:{teamId}` — teamId comes from the server response, not user input. Delete button shows confirmation dialog before calling API. No XSS vectors — React escapes all content.
- **Finding:** No issues.

### 9. Web Sort Controls (Task 9)

- **File:** `apps/web/src/pages/Home.tsx`, `apps/web/src/hooks/usePackages.ts`
- **Risk Level:** Low
- **Analysis:** Sort parameters (`sort`, `order`) passed to API as query params. Backend validates these parameters. No injection risk — values are from a fixed enum in the frontend.
- **Finding:** No issues.

### 10. Web PackageEdit (Task 10)

- **File:** `apps/web/src/components/PackageEdit.tsx`, `apps/web/src/lib/api.ts`
- **Risk Level:** Low
- **Analysis:** New fields (license, repository, homepage) use standard HTML input types (`text`, `url`). URL fields have browser-native validation via `type="url"`. Backend validates via Pydantic. No XSS — React escapes content.
- **Finding:** No issues.

### 11. Web i18n (Task 11)

- **File:** Locale JSON files, TeamPackagesTab.tsx, PackageEdit.tsx
- **Risk Level:** Low
- **Analysis:** Translation strings use `t()` with safe interpolation (`{{name}}`). No dynamic code execution. No injection risk.
- **Finding:** No issues.

## Overall Assessment

| Category | Status |
|----------|--------|
| Hardcoded secrets | ✅ None found |
| SQL injection | ✅ All DB access via SQLAlchemy ORM |
| XSS | ✅ No dangerouslySetInnerHTML, React escapes content |
| Auth/permission | ✅ All new endpoints require authentication, proper permission checks |
| Input validation | ✅ Backend Pydantic validation, frontend HTML5 validation |
| New attack surface | ✅ Minimal — new endpoints follow existing patterns |
| Dependencies | ✅ No new dependencies introduced |

## Recommendations

1. **Rate limiting:** The new `leave` and `uninstall` endpoints should be covered by existing rate limiting middleware (verify in production).
2. **Audit logging:** Consider adding audit logs for leave-team and uninstall-team-package actions for compliance.
3. **Token storage:** The OAuth callback stores JWT in localStorage (via Zustand persist). This is standard for SPAs but vulnerable to XSS if an XSS bug is introduced. Consider httpOnly cookies for higher security in future.
