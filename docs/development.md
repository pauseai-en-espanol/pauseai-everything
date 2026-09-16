# Development Guide

> Last updated: 2026-09-16.

## Prerequisites

- **Node.js** 20+
- **PostgreSQL** 14+ (local install or Docker)
- **Docker** (optional) — to build the production image locally
- **kubectl** with the `danilupion.com` context (optional) — to inspect production, see [deployment.md](deployment.md)

## First-time setup

### 1. Install dependencies

```bash
npm install
```

### 2. Start a local database

**Option A: Docker (recommended)**
```bash
docker-compose up -d
# Postgres will be available at postgresql://pauseai:pauseai@localhost:5432/pauseai
```

**Option B: Local Postgres**
```bash
createdb pauseai
# Then set DATABASE_URL=postgresql://localhost:5432/pauseai in your .env
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`:

| Variable | Description | How to get it |
|----------|-------------|---------------|
| `DATABASE_URL` | PostgreSQL connection string | See above |
| `NEXTAUTH_SECRET` | Random string for JWT signing | Any random string in dev |
| `NEXTAUTH_URL` | Base URL of the app | `http://localhost:3000` |
| `AUTH_GOOGLE_ID` | Google OAuth client ID | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret | Same as above |
| `MAILERSEND_API_KEY` | Mailersend API key | [Mailersend dashboard](https://app.mailersend.com) |
| `MAILERSEND_FROM_EMAIL` | Default sender email | A verified Mailersend sender |
| `ADMIN_EMAILS` | Comma-separated emails auto-promoted to admin | e.g. `you@example.com` |
| `UNSUBSCRIBE_SECRET` | HMAC secret for unsubscribe tokens | `openssl rand -hex 32` |
| `NEXT_PUBLIC_APP_URL` | Public URL for unsubscribe links | `http://localhost:3000` |
| `EMAIL_ENCRYPTION_KEY` | AES-256 key for encrypting OAuth tokens and connection credentials | `openssl rand -hex 32` |
| `MAILERSEND_WEBHOOK_SIGNING_SECRET` | HMAC secret for verifying Mailersend webhook signatures | From Mailersend dashboard (optional in dev) |
| `TALLY_WEBHOOK_SIGNING_SECRET` | HMAC secret for verifying Tally webhook signatures | From Tally form settings (optional in dev) |
| `EMAIL_MODE` | `sandbox` (default if unset) — captures all outbound email in the database instead of sending via Mailersend. Set to `live` only when you want to send real emails. **Leave unset or set to `sandbox` for all development and testing.** | No (defaults to `sandbox`) |
| `DEV_BYPASS_AUTH` | Set to `true` to skip Google login in dev | Dev only |

**Two auth modes for development:**

1. **`DEV_BYPASS_AUTH=true`** — skips login entirely, auto-logged in as "Dev User" with admin access. Simplest option for single-user dev. Only activates when `NODE_ENV=development`.

2. **Dev login (recommended for workspace testing)** — set `DEV_BYPASS_AUTH=false` (or unset) and go to `/login`. You'll see a dev login form with preset users:
   - **Admin** (admin@pauseai.info) — global admin, full access to all workspaces
   - **Member** (member@pauseai.info) — global member, member of Global workspace
   - **Viewer** (viewer@pauseai.info) — global viewer, read-only access
   - **France Chapter Admin** (france@pauseai.info) — global member, admin of France workspace only

   You can also enter a custom email/name/role and select which workspace to add the user to. This creates real user records and workspace memberships in the database, allowing you to test the full multi-tenancy flow by switching between users.

### 4. Push the database schema

```bash
npx drizzle-kit push
```

This introspects the Drizzle schema files in `src/db/schema/` and creates/updates all tables in your local database. No SQL files needed.

### 5. (Optional) Seed with sample data

```bash
npm run db:seed
```

### 6. Run the app

In two terminals:

```bash
# Terminal 1: Web server
npm run dev

# Terminal 2: Background worker (needed for campaign sending, scripts, etc.)
npm run worker
```

Open http://localhost:3000. With `DEV_BYPASS_AUTH=true` you'll land directly on the dashboard. With it unset, you'll see the dev login page where you can choose a user to test with.

---

## Sandbox mode (email testing)

**By default, no real emails are sent.** The app starts in sandbox mode (`EMAIL_MODE=sandbox` or unset), which intercepts all outbound email — campaigns, previews, script-triggered sends, invitations, ticket notifications — and writes them to the `sandbox_emails` database table instead of calling the Mailersend API. Zero HTTP requests are made to Mailersend when in sandbox mode.

This means you can safely:
- Send campaigns to thousands of contacts during testing
- Run end-to-end tests (UI tests, API tests, AI-driven tests) that exercise the full email pipeline
- Inspect exactly what the system would send: rendered HTML, headers, recipient, merge variables
- Simulate delivery events (delivered, opened, clicked, bounced, unsubscribed) to test the full email lifecycle

### How to use sandbox mode

1. **Leave `EMAIL_MODE` unset** (or set it to `sandbox`) — this is the default
2. You'll see an **amber banner** at the top of the dashboard: "SANDBOX MODE — No emails are being sent"
3. A **Sandbox** item appears in the sidebar (admin-only, flask icon) linking to `/dashboard/sandbox`
4. The sandbox viewer shows all captured emails with filters, detail view, and event simulation buttons

### Sandbox API

The sandbox is fully drivable via API (all endpoints require admin role):

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sandbox/status` | GET | Check current mode (`sandbox` or `live`) |
| `/api/sandbox/emails` | GET | List captured emails (filters: `campaignId`, `to`, `workspaceId`, `status`, `since`) |
| `/api/sandbox/emails/:id` | GET | Get full email detail (rendered HTML, headers, etc.) |
| `/api/sandbox/emails/:id/simulate` | POST | Simulate an event on one email (`delivered`, `opened`, `clicked`, `bounced`, `unsubscribed`) |
| `/api/sandbox/emails/simulate-bulk` | POST | Simulate an event on all matching emails |
| `/api/sandbox/emails` | DELETE | Clear sandbox data (optionally scoped to a campaign) |

Event simulation calls the **same internal logic** as the Mailersend webhook handler — it updates the `emails` table, recalculates campaign stats, and processes unsubscribes. This tests the real code path, not a fake one.

### Switching to live mode

To actually send emails (e.g., for production or manual testing against real Mailersend):

```bash
EMAIL_MODE=live
```

Set this in your `.env` file and restart the dev server and worker. Production stays in sandbox mode until Mailersend is configured; flipping to `live` is described in [deployment.md](deployment.md).

### All development testing should use sandbox mode

- **Frontend tests**: The sandbox banner confirms you're in the right mode. Use the sandbox viewer to inspect sent emails.
- **API tests**: Use `DELETE /api/sandbox/emails` to clear state, then run your test flow, then `GET /api/sandbox/emails` to verify what was sent.
- **End-to-end tests**: The sandbox API enables fully automated test flows — create contacts, send campaigns, simulate delivery events, verify stats — all without sending real email.

---

## Development workflow

### Making schema changes

1. Edit the relevant file in `src/db/schema/`
2. Run `npx drizzle-kit push` to apply changes to your local DB
3. When ready to deploy to production, `drizzle-kit push` also runs as part of the web service start command

The project uses **push-based migrations** (not `drizzle-kit migrate` with migration files). This keeps things simple for a small team. If you need a history of migrations, switch to `drizzle-kit generate` + `drizzle-kit migrate`.

### Adding a new API route

1. Create `src/app/api/your-thing/route.ts`
2. Use `checkAuth()` from `src/lib/api-auth.ts` for authentication
3. Use `requireAdmin()` if the endpoint is admin-only
4. Add business logic to a corresponding `src/lib/your-thing.ts` file (keep routes thin)

```typescript
// Example: src/app/api/things/route.ts
import { NextRequest, NextResponse } from "next/server";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { listThings } from "@/lib/things";

export async function GET(request: NextRequest) {
  const auth = await checkAuth(request);
  if (!auth.authenticated) return auth.error!;

  const things = await listThings();
  return NextResponse.json(things);
}
```

### Adding a new worker task

1. Create `src/worker/tasks/my-task.ts`:

```typescript
import type { Task } from "graphile-worker";

export const myTask: Task = async (payload, helpers) => {
  // payload is the job's JSON data
  helpers.logger.info("Doing the thing...");
  // throw to trigger graphile-worker's retry logic
};
```

2. Register it in `src/worker/index.ts`:

```typescript
import { myTask } from "./tasks/my-task";

const taskList = {
  // ...existing tasks...
  my_task: myTask,
};
```

3. To enqueue from the web, use `src/lib/worker-client.ts`:

```typescript
import { addJob } from "@/lib/worker-client";
await addJob("my_task", { someData: 123 });
```

4. To add a cron trigger, add to `parseCronItems` in `src/worker/index.ts`:

```typescript
{ task: "my_task", match: "0 8 * * *", identifier: "daily_my_task" }
```

### Adding a new connector (external data source)

1. Create `src/lib/connectors/my-source.ts` implementing the `Connector` interface:

```typescript
import { Connector, ExternalField, ExternalResource, FetchResult } from "./types";
import { z } from "zod";

const CredentialsSchema = z.object({ apiKey: z.string() });

export const mySourceConnector: Connector = {
  type: "my_source",
  label: "My Source",
  credentialsSchema: CredentialsSchema,

  async testConnection(credentials) { /* validate creds, return success message */ },
  async listResources(credentials) { /* return available tables/databases */ },
  async getSchema(credentials, resource) { /* return field definitions */ },
  async fetchRecords(credentials, resource, cursor?) { /* return records + optional next cursor */ },
};
```

2. Register it in `src/lib/connectors/index.ts`:

```typescript
import { mySourceConnector } from "./my-source";
// Add to the connectors map
```

3. Add the type to `CONNECTOR_TYPES` in `src/lib/connectors/types.ts`:

```typescript
{ type: "my_source", label: "My Source", available: true },
```

4. Add credential fields to the connection creation UI in `src/components/connections-manager.tsx` (the credential form is connector-specific).

### Running tests

```bash
npm test          # run all tests once
npm run test:watch # watch mode
```

Tests live in `src/lib/__tests__/`. The test suite uses Vitest. Currently, unit tests cover the script engine and segment query builder. API integration tests are a known gap.

---

## Architecture overview

### Two processes, one database

```
HTTP requests → Next.js (web process)
                    ↓
              PostgreSQL DB ← graphile-worker (worker process)
```

The web process handles API routes and the dashboard UI. Heavy work (sending campaigns, running scripts) is enqueued as jobs into the Postgres-backed graphile-worker queue. The worker picks these up asynchronously.

See [architecture.md](architecture.md) for the full design.

### Key patterns

**Flexible fields:** Contacts store all custom data in a `customFields` JSONB column. Field definitions are rows in the `field_definitions` table, not code. Admins can add/remove fields without schema changes.

**Segment filters:** Segments are stored as JSON (a `SegmentFilter` type). The `buildSegmentWhere()` function in `src/lib/segments.ts` translates these into Drizzle `where()` clauses.

**Script engine:** User-defined JavaScript runs in a Node.js `vm` sandbox with a `ctx` SDK injected (contacts, tags, email operations). 30s timeout, max 1000 contacts per run. See `src/lib/script-engine.ts`.

**Auth:** Two auth paths — browser sessions (Google OAuth → JWT via Auth.js) and API keys (Bearer token with `pai_` prefix, hashed in DB). Checked by `checkAuth()` in `src/lib/api-auth.ts`.

---

## Database

### Viewing data

```bash
npm run db:studio   # opens Drizzle Studio at https://local.drizzle.studio
```

### Schema files

All table definitions are in `src/db/schema/`:

| File | Tables |
|------|--------|
| `contacts.ts` | `contacts`, `contact_tags` |
| `fields.ts` | `field_definitions` |
| `interactions.ts` | `interactions` |
| `tags.ts` | `tags` |
| `segments.ts` | `segments` |
| `campaigns.ts` | `campaigns` |
| `emails.ts` | `emails` |
| `scripts.ts` | `scripts`, `script_runs` |
| `automations.ts` | `automation_rules` |
| `communication-categories.ts` | `communication_categories` |
| `app-settings.ts` | `app_settings` (key-value store) |
| `connections.ts` | `connections`, `sync_configurations`, `sync_runs` |
| `email-connections.ts` | `email_connections`, `email_contact_settings` |
| `sandbox-emails.ts` | `sandbox_emails` (captured emails in sandbox mode) |
| `users.ts` | `user`, `account`, `session`, `verificationToken` (NextAuth tables) |
| `index.ts` | Re-exports all schemas |

### Useful queries

```sql
-- Check contact count
SELECT COUNT(*) FROM contacts;

-- See all users
SELECT id, email, name, is_admin FROM "user";

-- See recent campaigns
SELECT id, name, status, sent_count, scheduled_at, sent_at
FROM campaigns ORDER BY created_at DESC LIMIT 10;

-- See recent script runs
SELECT s.name, r.status, r.started_at, r.contacts_affected
FROM script_runs r
JOIN scripts s ON s.id = r.script_id
ORDER BY r.started_at DESC LIMIT 20;

-- Check graphile-worker job queue
SELECT id, task_identifier, payload, attempts, run_at
FROM graphile_worker.jobs ORDER BY created_at DESC LIMIT 20;
```

---

## Accessing production

Production runs on the `danilupion-com` Kubernetes cluster, namespace `pauseai-everything`, and is
reachable only from the Headscale VPN. Deploys are automatic on push to `main`
(see [deployment.md](deployment.md)).

### Logs

```bash
kubectl -n pauseai-everything logs deploy/pauseai-everything -f          # web
kubectl -n pauseai-everything logs deploy/pauseai-everything-worker -f   # worker
kubectl -n pauseai-everything logs job/pauseai-everything-migrate         # last migration run
```

### Environment variables

Plain values live in the gitops repo (`clusters/danilupion-com/values/apps/pauseai-everything.yaml`);
secrets are sealed in `clusters/danilupion-com/resources/apps/pauseai-everything/secrets/`. Commit a
change there and Argo CD rolls it out.

### Production database

```bash
kubectl -n postgresql port-forward svc/postgresql 5433:5432
# DATABASE_URL=postgresql://pauseai_everything:<password>@localhost:5433/pauseai_everything
```

The password is in the `pauseai-everything-credentials` secret
(`kubectl -n pauseai-everything get secret pauseai-everything-credentials -o jsonpath='{.data.DATABASE_URL}' | base64 -d`).

---

## Common issues

**`drizzle-kit push` fails with "relation does not exist"**
Your schema references a table that doesn't exist yet. Run `npx drizzle-kit push` again — it resolves dependencies automatically.

**Worker crashes on startup**
Check `DATABASE_URL` is set. The worker requires it and will throw immediately if missing.

**Gmail integration setup**
The personal email integration requires a Google Cloud project with the Gmail API enabled. Upstream uses the **`pauseai-everything`** GCP project; this fork needs its own OAuth client. The OAuth consent screen is set to **External** (so users with any email domain can connect) and the Gmail API is enabled.

The same OAuth client (`AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`) is used for both login and Gmail. The following **authorized redirect URIs** must be configured in [Google Cloud Console](https://console.cloud.google.com/apis/credentials?project=pauseai-everything):

- `http://localhost:3000/api/auth/callback/google` (login — dev)
- `http://localhost:3000/api/auth/gmail/callback` (Gmail — dev)
- `https://crm.pauseai.es/api/auth/callback/google` (login — prod)
- `https://crm.pauseai.es/api/auth/gmail/callback` (Gmail — prod)

And these **authorized JavaScript origins**:
- `http://localhost:3000`
- `https://crm.pauseai.es`

Set `EMAIL_ENCRYPTION_KEY` to a random 32-byte hex string (`openssl rand -hex 32`). This must be the same value in both the web and worker services.

**Google OAuth "redirect_uri_mismatch"**
The callback URL `http://localhost:3000/api/auth/callback/google` must be in your Google Cloud Console's authorized redirect URIs.

**Campaign stuck in "sending" status**
The worker wasn't running when the campaign was sent, or it failed mid-send. Reset the campaign status in the DB (`UPDATE campaigns SET status = 'draft' WHERE id = '...'`), then retry.

**`error: column X of relation Y does not exist`**
The schema was changed but `drizzle-kit push` hasn't been run yet. Run it, or in production, redeploy the web service (which runs `drizzle-kit push` on startup).
