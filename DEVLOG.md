# Dev Log

Reverse-chronological log of development sessions. Each entry is self-contained.

---

## 2026-09-16 — Kubernetes deployment for the pauseai-en-espanol fork

**What:** Made the fork deployable to the danilupion-com cluster via Argo CD, following the pauseai-website-es pattern: Docker image → Harbor → chart tag bump on `main` → Argo CD sync. Cluster wiring (ApplicationSet, values, HTTPRoute, sealed secrets, Postgres provisioning) lives in the `danilupion/gitops` repo.

**Key changes:**
- `Dockerfile`, `.dockerignore` — single image for web, worker and migrations (full node_modules; tsx + drizzle-kit run from `src/`). Verified locally: health endpoint, worker startup, 1.5 GB.
- `charts/pauseai-everything/` — Helm chart: web + worker Deployments, Service, migrate Job as an Argo CD Sync-phase hook (wave 1, Deployments at wave 2) (`drizzle-kit push` + seed), `existingSecret` injected via envFrom.
- `.github/workflows/ci.yml`, `cd.yml`, `.github/actions/setup-node` — copied from website-es (self-hosted juggernaut runner, PAT_TOKEN push of the tag bump).
- `src/app/api/health/route.ts` — DB-free probe endpoint.
- `next.config.ts` — `GIT_SHA` build arg feeds `NEXT_PUBLIC_GIT_SHA`; `package.json` — `docker:build` / `docker:push`.
- Docs: `docs/deployment.md` rewritten; README, CLAUDE.md, architecture.md, development.md, api-reference.md updated. Railway content removed from this fork's docs (`railway.toml` kept for clean upstream merges).

**Decisions:**
- Branches: `dev` is a fast-forward-only mirror of upstream `dev`; `main` is the deploy branch and carries all deployment commits plus CD tag bumps. Upstream's `main` and `dev` had identical trees with one duplicated commit; `main` was aligned by merging `dev` (force-push was declined by tooling).
- Dashboard is VPN-only: HTTPRoute on `gateway-private` at `crm.pauseai.es`. Consequence: unsubscribe links and inbound webhooks (Mailersend, Tally) do not work until a second, path-restricted public hostname is added — deferred until email goes live.
- `EMAIL_MODE=sandbox` in production for now; Mailersend not configured. Mailu SMTP transport and magic-link login discussed as future options to drop the Mailersend and Google dependencies.
- Reused the `pauseai-es` Harbor project and its pull robot (re-sealed for the new namespace) instead of creating a per-app robot.

**Open items:**
- Google OAuth client for `crm.pauseai.es` not yet created; sealed secret has `CHANGE_ME` placeholders for `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` and must be re-sealed.
- `PAT_TOKEN` repository secret needed on the fork for CD; set `main` as the fork's default branch.
- `scripts/generate-api-docs.ts` regenerates CLAUDE.md from a stale template — do not run `npm run docs:api` without first syncing the template with the hand-maintained CLAUDE.md.

## 2026-04-07 — Shared field mapper, type-aware editors, and UI consistency

**What:** Extracted duplicated field mapper code (~300 lines) into shared components reused by sync config, sync detail, and CSV import. Added type-aware constant value editors and new cell editors for multiselect/date fields in the contacts table. Unified tags and multiselect UI to use the same dropdown-to-add pattern everywhere.

**Key changes:**
- `src/lib/field-mapper-utils.ts` — shared types (CrmFieldDef, UIMapping, SourceField) and conversion utilities (toApiEntry, entryToUIMapping, autoSuggestMappings)
- `src/lib/hooks/use-crm-fields.ts` — shared hook to fetch CRM field definitions with type metadata
- `src/components/field-mapper.tsx` — shared field mapper UI (CRM field | Field/Fixed toggle | source value | remove)
- `src/components/field-value-editor.tsx` — type-aware value editor (select, multiselect, tags, boolean, number, date, text) used in field mapper, contact detail form, and cell editors
- `src/components/multiselect-cell-editor.tsx`, `date-cell-editor.tsx` — popup editors for contacts table
- `src/components/contact-tags.tsx`, `tag-cell-editor.tsx` — unified from clickable pill buttons to dropdown pattern (matching multiselect)
- `src/app/api/contacts/import/route.ts` — added `constantValues` support for fixed values during CSV import (including tag creation)
- Refactored `sync-config-wizard.tsx`, `sync-detail.tsx`, `csv-importer.tsx`, `contact-detail-form.tsx` to use shared components

**Decisions:**
- Tags "Fixed" mode in field mapper uses freeform type-to-add (TagPillInput) rather than fetching existing workspace tags — keeps the mapper stateless and avoids tag management in a mapping context
- `constantValue` in UIMapping is `unknown` (not string) to support typed values natively (arrays for tags/multiselect, booleans, numbers)
- Unified tags and multiselect to both use "selected pills + dropdown to add" pattern for consistency and scalability (previous tag UI showed all available tags as clickable pills, which doesn't scale)

**Open items:**
- Run `npx drizzle-kit push` to drop the `required` column from the database (from previous session)
- Pre-existing build error in `my-email-contacts.tsx:345` (`fetchConnections` not found) — unrelated to this work

---

## 2026-04-05 — Remove required fields functionality

**What:** Removed the `required` boolean from field definitions entirely. Required fields were inconsistently enforced (only on direct API create/update, not on CSV import, Tally webhooks, or sync engine), which caused a bug chain: contacts entered without required fields couldn't be edited later because the PUT validation would reject unrelated edits.

**Key changes:**
- `src/db/schema/field-definitions.ts` — dropped `required` column
- `src/lib/contacts.ts` — removed required-field check from `validateCustomFields()`
- `src/lib/schemas/fields.ts` — removed `required` from Create/Update Zod schemas
- `src/components/fields-manager.tsx` — removed required checkbox from create/edit forms, removed `*` indicators
- `src/components/contact-detail-form.tsx`, `contacts-table.tsx` — removed `required` from types and UI
- `src/db/seed.ts` — removed all `required` properties from default field definitions
- `src/lib/__tests__/contacts.test.ts` — removed required-field test, updated assertions
- `docs/future-features.md` — added "Field Descriptions & Importance" as future replacement

**Decisions:**
- Chose full removal over soft-required (visual warnings) for simplicity. A future "importance" flag + field descriptions can bring back the nudge without blocking edits
- Historical audit docs left unchanged (they document what existed at audit time)

**Open items:**
- Run `npx drizzle-kit push` to drop the `required` column from the database
- Future: field descriptions (tooltips) + importance flag to replace the guidance that required fields provided

---

## 2026-04-05 — API black-box audit and security fixes

**What:** Conducted a comprehensive black-box API audit (86 test scenarios, 28 bugs found), then fixed all critical and high-severity issues. The audit uncovered a systemic workspace isolation failure — non-member users could access any workspace's data by setting the `X-Workspace-Id` header.

**Key changes:**
- `src/lib/workspace-context.ts` — Added `hasWorkspaceMembership()` check to `requireWorkspaceMember()` and `requireWorkspaceAdmin()`. Previously, `getEffectiveRole()` returned "member" for anyone with a global member role, bypassing workspace boundaries
- 18 API route files — Upgraded from `requireAuth()`/`requireMember()` to `requireWorkspaceMember()` for workspace-scoped endpoints
- `src/lib/workspace-context.ts` — `getActiveWorkspaceId()` now defaults to API key's workspace when no header is specified
- `src/lib/mailersend.ts` — Added `escapeHtml()` to `renderTemplate()` to prevent HTML injection via contact names/custom fields in email templates
- `src/lib/segments.ts` — Added `is_empty`/`is_not_empty` operator aliases, renamed preview response field from `sample` to `contacts`
- 11 files across `src/lib/` — Replaced all `updatedAt: new Date()` with `sql`now()`` for consistent UTC timestamps
- `src/lib/schemas/campaigns.ts` — Added max length validation for campaign name, subject, body

**Decisions:**
- API keys inherit the creator's per-workspace permissions (not locked to one workspace). The key's `workspaceId` serves as default when no header is sent, but the holder can specify any workspace they have membership in
- `DEV_BYPASS_AUTH=true` makes all unauthenticated requests auto-authenticate as admin — the "unauthenticated access" bugs (B1-B9) are dev-only, not production vulnerabilities
- B24 (campaign send pre-validation) deprioritized — worker correctly rejects and resets to draft, low user impact

**Open items:**
- B24: Campaign send could validate unsubscribe upfront instead of letting worker reject (minor UX improvement)
- The audit report is at `docs/api-blackbox-audit-2026-04-04.md` with full repro steps for all 28 findings

---

## 2026-04-04 — Sandbox mode (email testing)

**What:** Implemented sandbox mode that intercepts all outbound email at the application level, writing to a `sandbox_emails` table instead of calling Mailersend. Enables safe end-to-end testing of the entire campaign pipeline — including event simulation — without any real email leaving the system.

**Key changes:**
- `src/lib/mailersend.ts` — Added `getEmailMode()` (reads `EMAIL_MODE` env var, defaults to `sandbox`), split `sendEmail()` into `sendEmailLive()` and `sendEmailSandbox()` paths. Added optional `_sandbox` metadata param for callers to pass campaignId/workspaceId
- `src/lib/email-events.ts` — New module: extracted webhook event processing logic (`processEmailEvent`, `recalculateCampaignCounts`, `handleUnsubscribe`) from the Mailersend webhook handler into shared functions. Both the webhook and sandbox simulate endpoint call the same code
- `src/app/api/webhooks/mailersend/route.ts` — Refactored to use shared `processEmailEvent()` from email-events.ts
- `src/db/schema/sandbox-emails.ts` — New `sandbox_emails` table (message_id, to/from, rendered body, headers, campaign/workspace FKs, status + status_history)
- `src/app/api/sandbox/` — 6 new endpoints: status, list (with filters), detail, simulate event, bulk simulate, clear
- `src/components/sandbox-banner.tsx` — Persistent amber banner when in sandbox mode
- `src/components/sandbox-email-viewer.tsx` — Full viewer UI at `/dashboard/sandbox` with table, detail panel, event simulation buttons, HTML preview iframe
- `src/components/app-sidebar.tsx` — Sandbox nav item (flask icon, admin-only, sandbox-mode-only)
- `src/lib/campaigns.ts` — Pass `_sandbox: { campaignId, workspaceId }` to enrich sandbox records

**Decisions:**
- Default to `sandbox` when `EMAIL_MODE` is unset — fail-safe, never accidentally send real email
- Single interception point in `sendEmail()` — all 6 call sites (campaigns, previews, scripts, invitations, ticket notifications) are automatically covered
- Event simulation reuses the real webhook processing code via `processEmailEvent()` — not a separate fake path. This means simulating "unsubscribed" actually updates the contact's communication preferences, simulating "delivered" updates campaign stats, etc.
- Sandbox API returns 404 (not 403) in live mode — the sandbox shouldn't exist as a concept in production
- campaignId is extracted from tags (`campaign:xxx`) as fallback when `_sandbox` metadata isn't provided — makes the interception work even for call sites that don't pass explicit metadata

**Open items:**
- Migration file (`drizzle/0004_sandbox-emails.sql`) exists but `drizzle-kit migrate` fails due to missing earlier migration file (`0000_harsh_crusher_hogan.sql`). Table was created via direct SQL. Need to fix migration history or use `drizzle-kit push` approach
- Branch `feature/sandbox-mode` not yet merged to main

---

## 2026-04-04 — Workspace-scoped API keys (bug #32)

**What:** Redesigned API key system to be workspace-scoped with proper role resolution, fixing the last high-severity security bug.

**Key changes:**
- `src/lib/api-auth.ts` — `checkAuth()` now looks up the user's actual role from DB instead of hardcoding `"admin"` for API key auth
- `src/db/schema/api-keys.ts` — new `workspace_id` FK column (NOT NULL, cascading delete)
- `src/lib/users.ts` — `createApiKey()` takes workspaceId, new `listApiKeysForWorkspace()` with JOIN for creator info, new `getApiKey()` for permission checks
- `src/app/api/api-keys/route.ts` — requires `X-Workspace-Id` header + workspace admin; lists keys for workspace only
- `src/app/api/api-keys/[id]/route.ts` — revocation checks workspace admin in the key's workspace
- `src/components/api-keys-manager.tsx` — uses `useWorkspaceFetch()`, shows creator name/email per key

**Decisions:**
- API key = user identity model (like GitHub PATs): key identifies who you are, workspace is per-request via `X-Workspace-Id` header, effective role checked same way as session auth. Rejected alternative of baking workspace into the key itself — stateless per-request model is simpler and consistent with the UI
- No "superkey" concept needed — global admins already have access to all workspaces through the effective role system, same as in the UI
- Workspace admins can see and revoke all keys in their workspace (not just their own) — needed for security auditing and key management when someone is unavailable
- Migration backfills existing keys to the global workspace

**Open items:**
- Bugs #43-49 (medium/low): N+1 queries, FK constraints, dead flags, pagination — need user input or architectural planning

---

## 2026-04-04 — Unsubscribe enforcement and medium bug fixes

**What:** Fixed medium severity bugs (#37-40, #42) and implemented full unsubscribe enforcement for categorized campaigns (bug #41) with three-layer protection: UI warning modal, database flag, and server-side send rejection.

**Key changes:**
- `src/lib/sync-engine.ts` — atomic upserts with `ON CONFLICT` to fix race conditions (#37, #38), workspace-scoped tag creation (#39)
- `src/lib/unsubscribe-tokens.ts`, `src/lib/ticket-unsubscribe-tokens.ts` — `console.error` when `UNSUBSCRIBE_SECRET` missing (#40)
- `src/lib/contacts.ts` — `listFieldDefinitions()` returns only core fields when no workspace (#42)
- `src/db/schema/campaigns.ts` — new `allow_no_unsubscribe` boolean column (default false)
- `src/lib/campaigns.ts` — `sendCampaign()` now refuses to send categorized campaigns without a working unsubscribe mechanism unless `allowNoUnsubscribe` is set; resets status to `draft` on rejection
- `src/components/campaign-manager.tsx` — warning modal on create/edit when category is set but no unsubscribe mechanism is available; user can "Go Back & Fix" or "Save Anyway" (sets the flag)
- `src/app/api/campaigns/unsubscribe-status/route.ts` — new endpoint returning infrastructure status (secret configured, List-Unsubscribe setting)
- `src/lib/schemas/campaigns.ts` — `allowNoUnsubscribe` added to create/update Zod schemas

**Decisions:**
- Unsubscribe warning at save-time (not send-time) so users can fix it in the editor and scheduled campaigns are covered
- `allowNoUnsubscribe` flag lives on the campaign record itself — no per-request override needed
- Flag is not reset when user adds `{{unsubscribe}}` later — harmless when mechanism is present, avoids complexity
- Server-side enforcement is the hard stop; UI modal is the user-friendly layer

**Open items:**
- Bug #32: API keys always grant admin role — needs scoped API key design
- Bugs #43-49 (medium/low): N+1 queries in sync engine, missing FK constraints, dead schema flags, pagination — need user input or architectural planning

---

## 2026-04-04 — Security audit and bug fixes (critical + high)

**What:** Conducted a full security audit of the codebase, documenting 26 new bugs (BUGS.md #24-49). Fixed all 5 critical and 6 of 7 high severity issues. #32 (API keys always grant admin) deferred for architectural planning.

**Key changes:**
- `src/lib/auth.ts` — removed `allowDangerousEmailAccountLinking` from Google OAuth (account takeover vector)
- `src/app/api/webhooks/mailersend/route.ts` — added HMAC-SHA256 signature verification, fixed workspace-scoped preference key in `handleWebhookUnsubscribe`
- `src/app/api/webhooks/tally/route.ts` — added HMAC-SHA256 signature verification, new contacts now linked to global workspace
- `src/app/api/contacts/[id]/route.ts` — workspace-scoped access control on GET and PUT via new `getContactForWorkspace()` helper
- `src/app/api/workspaces/[id]/route.ts` — membership check on GET, Zod validation + workspace-admin on PUT
- `src/app/api/workspaces/[id]/members/route.ts` — membership check on GET
- New `src/lib/credentials-encryption.ts` — AES-256-GCM encrypt/decrypt for connection credentials (Airtable/Notion API keys)
- New `src/lib/schemas/workspaces.ts` — Zod schema for workspace updates
- Decrypt credentials at all read points: connection routes, sync engine

**Decisions:**
- Webhook signing secrets fail-closed: if env var is missing, webhooks are rejected (not silently accepted)
- Credential encryption reuses `EMAIL_ENCRYPTION_KEY` rather than introducing a second key — simpler ops, same security level
- `getContactForWorkspace()` uses INNER JOIN on `contact_workspaces` — returns nothing if contact isn't linked to workspace. Global admins bypass via `getContact()` (no join)
- Workspace PUT downgraded from global-admin-only to workspace-admin — workspace self-management is the right model
- Backward compat for credential encryption: `decryptCredentials()` detects `_encrypted` marker key, falls through to plaintext for pre-encryption rows

**Open items:**
- Bug #32: API keys always grant admin role — needs scoped API key design
- Bugs #37-49 (medium/low): race conditions in sync engine, missing FK constraints, N+1 queries, dead schema flags — not yet addressed
