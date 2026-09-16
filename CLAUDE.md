# PauseAI Everything App

CRM and operations platform for PauseAI Global. Built with Next.js 16 (App Router), PostgreSQL, Drizzle ORM, Graphile Worker. Supports multi-tenancy via workspaces (Global + chapter workspaces).

## Quick Reference

- **API docs:** See [docs/api-reference.md](docs/api-reference.md) for all endpoints, request/response schemas, and auth requirements
- **DB schemas:** `src/db/schema/*.ts` (Drizzle ORM, PostgreSQL)
- **API validation schemas:** `src/lib/schemas/*.ts` (Zod — source of truth for request validation)
- **Route handlers:** `src/app/api/**/route.ts`
- **Business logic:** `src/lib/*.ts`
- **Connectors:** `src/lib/connectors/` (Airtable, Notion, Demo)
- **Sync engine:** `src/lib/sync-engine.ts`
- **Email connections schema:** `src/db/schema/email-connections.ts` (email_connections + email_contact_settings tables)
- **Gmail client:** `src/lib/gmail.ts` (OAuth, message fetching, address parsing)
- **Encryption:** `src/lib/encryption.ts` (AES-256-GCM), `src/lib/credentials-encryption.ts` (connection credential encrypt/decrypt)
- **Email event processing:** `src/lib/email-events.ts` (shared webhook/sandbox event logic)
- **Sandbox schema:** `src/db/schema/sandbox-emails.ts` (sandbox_emails table)
- **Background workers:** `src/worker/` (Graphile Worker)
- **UI components:** `src/components/` (React + shadcn/ui)
- **Shared field mapper:** `src/lib/field-mapper-utils.ts` (types + conversion), `src/components/field-mapper.tsx` (UI), `src/lib/hooks/use-crm-fields.ts` (hook)
- **Type-aware field editor:** `src/components/field-value-editor.tsx` — renders appropriate input control based on field type (select, multiselect, tags, boolean, number, date, text)
- **Workspace design:** See [docs/specs/workspaces.md](docs/specs/workspaces.md) for the multi-tenancy specification
- **Dev log:** `DEVLOG.md` — reverse-chronological session log (updated via `/wrapup`)
- **Bug tracker:** `BUGS.md` — security audit findings and fix status
- **Deployment:** `Dockerfile`, `charts/pauseai-everything/` (Helm: web + worker + migrate hook), `.github/workflows/{ci,cd}.yml`; cluster wiring in the gitops repo. See [docs/deployment.md](docs/deployment.md). Branches: `dev` mirrors upstream, `main` deploys

## Workspaces (Multi-Tenancy)

The app supports multiple workspaces: one **global** workspace (PauseAI Global) and **chapter** workspaces (e.g., Pause IA France). Key concepts:

- **Workspace context:** Determined by cookie (`pauseai_workspace`), header (`X-Workspace-Id`), or query param. Server components use `getServerWorkspaceId()`, client components use `useWorkspace()` / `useWorkspaceFetch()`.
- **Contacts:** Exist once globally, linked to workspaces via `contact_workspaces` junction table. A workspace only sees its own contacts.
- **Effective role:** `max(global role, workspace role)` — computed by `useEffectiveRole()` (client) or `getEffectiveRole()` (server). A user with global "member" role but workspace "admin" role is an admin in that workspace.
- **Workspace-scoped entities:** Tags, segments, campaigns, communication categories, connections, custom fields (scope: core/global_internal/workspace), user memberships, API keys, automations (scripts + rules).
- **Workspace provider:** `src/components/workspace-provider.tsx` — provides `activeWorkspace`, `useWorkspaceId()`, `useWorkspaceFetch()` (auto-injects `X-Workspace-Id` header).
- **Server-side workspace:** `src/lib/workspace-server.ts` — `getServerWorkspaceId()` reads from cookies, `isServerWorkspaceGlobal()`.
- **API workspace context:** `src/lib/workspace-context.ts` — `getActiveWorkspaceId(request)` reads from header/query/cookie.

## Auth

- Google OAuth via NextAuth (`src/lib/auth.ts`)
- Dev login with Credentials provider (development only) — preset users + custom email form with workspace selector
- API keys: `Authorization: Bearer pai_<key>` (`src/lib/api-auth.ts`) — workspace-scoped, use creator's actual role (not hardcoded). Holder passes `X-Workspace-Id` per-request, effective role checked same as session auth
- Admin role from `ADMIN_EMAILS` env var
- Two-layer roles: global role (users table) + workspace role (user_workspaces table)

## Key Commands

- `npm run dev` — dev server with Turbopack
- `npm run test` — run tests (Vitest)
- `npm run build` — production build
- `npm run worker` — background job worker
- `npm run db:migrate` — run migrations
- `npm run db:seed` — seed default field definitions
- `npm run docs:api` — regenerate API docs from Zod schemas

## Conventions

- All API validation uses Zod schemas in `src/lib/schemas/`
- Error format: `{ error: string, details?: string[] }`
- Route handlers use `validateBody()` from `src/lib/api-validate.ts`
- Tests required for all backend features (`src/lib/__tests__/`)
- Client-side API calls MUST use `useWorkspaceFetch()` to include workspace context header
- Communication preference keys are namespaced: `workspaceId:categoryName`
- Segment tag conditions use operator `has`/`not_has` (not `eq`). Emptiness checks: `is_set`/`is_not_set` (canonical) or `is_not_empty`/`is_empty` (aliases)
- Email template merge variables (`{{firstName}}`, etc.) are HTML-escaped by `renderTemplate()` in `src/lib/mailersend.ts` — never render user data as raw HTML
- Workspace switching triggers `window.location.reload()` — don't use refs to detect changes; check entity workspace ownership after fetch instead
- Connections UI lives at `/dashboard/connections` (top-level sidebar, admin-only), not under Settings
- When using `stripNulls()` in API routes, extract nullable fields that carry meaning (like `segmentId`, `categoryId`) before stripping
- Email connections are **user-scoped** (not workspace-scoped like Airtable/Notion connections). Imported contacts belong to the active workspace.
- Email interaction visibility: a user's own synced emails are always visible to them; other users only see interactions where `visible_to_team = true`
- OAuth tokens for email connections are encrypted at rest with AES-256-GCM (`EMAIL_ENCRYPTION_KEY` env var)
- Connection credentials (Airtable API keys, Notion tokens) are also encrypted at rest using `src/lib/credentials-encryption.ts` (same `EMAIL_ENCRYPTION_KEY`)
- Webhook endpoints (Mailersend, Tally) require HMAC signature verification — set `MAILERSEND_WEBHOOK_SIGNING_SECRET` and `TALLY_WEBHOOK_SIGNING_SECRET` env vars
- Contact API endpoints (`GET/PUT /api/contacts/:id`) enforce workspace scoping — non-admin users can only access contacts linked to their active workspace
- Categorized campaigns enforce unsubscribe mechanism: `sendCampaign()` refuses to send unless `allowNoUnsubscribe` is `true` on the campaign record. The UI warns at save-time and sets the flag only with explicit user acknowledgment
- **Sandbox mode:** `EMAIL_MODE=sandbox` (default if unset) intercepts all outbound email in `sendEmail()` and writes to `sandbox_emails` table instead of calling Mailersend. `EMAIL_MODE=live` sends real email. All email-sending paths MUST go through `sendEmail()` in `src/lib/mailersend.ts`
- Sandbox API endpoints (`/api/sandbox/*`) only function when `EMAIL_MODE=sandbox`; they return 404 in live mode. All require admin role
- Sandbox event simulation (`POST /api/sandbox/emails/:id/simulate`) reuses the same `processEmailEvent()` logic as the Mailersend webhook handler — tests the real code path

## End-of-Session Ritual

At the end of every coding session, run `/wrapup`. This updates the dev log (`DEVLOG.md`), syncs all documentation, and commits. If the user seems to be wrapping up (e.g., "let's commit and push", "I think that's it for today"), suggest running `/wrapup` before ending.
