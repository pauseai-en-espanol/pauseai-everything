# PauseAI Everything App

A custom-built CRM and operational platform for [PauseAI Global](https://pauseai.info). Starts as a CRM, grows into the central hub for managing volunteers, campaigns, and outreach. Supports multi-tenancy via workspaces for PauseAI Global and national chapters.

**Production (this fork, VPN-only):** https://crm.pauseai.es
**Repo:** https://github.com/pauseai-en-espanol/pauseai-everything (fork of https://github.com/PauseAI/pauseai-everything)

---

## What this is

A Next.js web app + background worker that replaces Airtable + manual email workflows. Core features:

- **Workspaces** — multi-tenant architecture with a global workspace (PauseAI Global) and chapter workspaces (e.g., Pause IA France). Each workspace has its own contacts, tags, fields, segments, campaigns, communication categories, and team members. Workspace switcher in the sidebar for users belonging to multiple workspaces.
- **Contacts** — spreadsheet-style table with inline editing, custom fields, tags, interaction history. Contacts are scoped to workspaces — each workspace sees only its own contacts. A contact can belong to multiple workspaces.
- **Segments** — visual query builder to define dynamic audiences (e.g. "contacts with tag 'parisien'"). Segments are workspace-scoped.
- **Campaigns** — compose and send broadcast emails to segments via Mailersend; schedule for later; assign email categories for preference-based filtering
- **Communication preferences** — three-state subscription model (subscribed/unsubscribed/neutral) per workspace per category; contacts must be explicitly subscribed to receive categorized emails; public unsubscribe page with preference center; HMAC-signed unsubscribe links; `{{unsubscribe}}` merge variable for in-body links
- **Scripts** — write JavaScript automation scripts that run on a schedule or on demand (e.g. flag dormant contacts, bulk-update fields)
- **Settings** — manage workspaces, custom fields, users (per-workspace), API keys, email categories, app-level settings
- **My Email Contacts** — connect your personal Gmail account to browse email contacts, import them to the workspace, and auto-log email interactions on contact timelines. User-scoped connections with per-contact sync/visibility settings, encrypted OAuth tokens, and worker-based periodic sync.
- **Role-based access** — two-layer role system (global + workspace roles) with invite-only login via Google OAuth

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router, TypeScript) |
| Database | PostgreSQL via Drizzle ORM |
| Job queue | graphile-worker (Postgres-backed) |
| UI | shadcn/ui + Tailwind CSS + AG Grid (Community) |
| Auth | Auth.js v5 (Google OAuth) |
| Email | Mailersend API |
| Hosting | Kubernetes on danilupion-com via Argo CD (this fork); upstream uses Railway — see [docs/deployment.md](docs/deployment.md) |
| Tests | Vitest |

## Quick start (local dev)

### Prerequisites

- Node.js 20+
- PostgreSQL running locally (or use Docker: `docker-compose up -d`)

### 1. Clone and install

```bash
git clone https://github.com/Maximophone/pauseai-everything.git
cd pauseai-everything
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` — see [docs/development.md](docs/development.md) for what each variable does and how to get them.

Minimum required for local dev:
```
DATABASE_URL=postgresql://localhost:5432/pauseai
NEXTAUTH_SECRET=any-random-string
NEXTAUTH_URL=http://localhost:3000
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
DEV_BYPASS_AUTH=true   # skip Google login in development
ADMIN_EMAILS=you@example.com   # auto-promote to admin
UNSUBSCRIBE_SECRET=...         # openssl rand -hex 32
EMAIL_ENCRYPTION_KEY=...       # openssl rand -hex 32 (encrypts OAuth tokens + connection credentials)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Set up the database

```bash
npm run db:generate    # generate migration files (if schema changed)
npx drizzle-kit push   # push schema to local Postgres (no migration files needed in dev)
```

### 4. Run the app

```bash
# Web server (Next.js)
npm run dev

# Background worker (in a separate terminal)
npm run worker
```

Open http://localhost:3000.

With `DEV_BYPASS_AUTH=true`, you'll be logged in automatically as "Dev User" with admin access — no Google setup needed.

---

## Project structure

```
pauseai-everything/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── dashboard/          # All authenticated pages
│   │   │   ├── contacts/       # Contact list + detail pages
│   │   │   ├── email/          # Campaigns
│   │   │   ├── segments/       # Segment builder
│   │   │   ├── automations/    # Script editor (JS automation)
│   │   │   ├── my-email-contacts/ # Gmail integration (personal email contacts)
│   │   │   └── settings/       # Workspaces, fields, users, API keys, email categories
│   │   ├── api/                # API route handlers
│   │   │   ├── contacts/
│   │   │   ├── campaigns/
│   │   │   ├── segments/
│   │   │   ├── scripts/
│   │   │   ├── tags/
│   │   │   ├── fields/
│   │   │   ├── users/
│   │   │   ├── api-keys/
│   │   │   ├── communication-categories/
│   │   │   ├── auth/gmail/         # Gmail OAuth flow
│   │   │   ├── email-connections/  # Email connection CRUD + contacts + import
│   │   │   ├── email-contact-settings/ # Per-contact sync settings
│   │   │   ├── settings/
│   │   │   ├── unsubscribe/
│   │   │   └── webhooks/
│   │   ├── login/
│   │   └── unsubscribe/        # Public unsubscribe preference center
│   ├── components/             # React components
│   ├── db/
│   │   └── schema/             # Drizzle table definitions
│   ├── lib/                    # Business logic (no React)
│   └── worker/
│       ├── index.ts            # Worker entry point
│       └── tasks/              # One file per background job type
├── docs/                       # Documentation
│   ├── architecture.md         # System design and patterns
│   ├── build-plan.md           # Phase-by-phase build roadmap + status
│   ├── deployment.md           # Railway deployment guide
│   ├── development.md          # Local development setup
│   └── features.md             # Feature specs and backlog
├── .env.example
├── railway.toml                # Worker service start command (for Railway deploys)
└── drizzle.config.ts
```

## Key commands

```bash
npm run dev           # Next.js dev server (http://localhost:3000)
npm run worker        # Background worker
npm run build         # Production build
npm run test          # Run Vitest tests
npm run test:watch    # Watch mode

npm run db:generate   # Generate Drizzle migration files
npm run db:migrate    # Apply migration files
npm run db:studio     # Open Drizzle Studio (DB browser)
npm run db:seed       # Seed with sample data

npm run docs:api      # Regenerate docs/api-reference.md from Zod schemas
```

## Documentation

All project documentation lives in this repo. Some docs are **served on the frontend** at `/dashboard/docs` (accessible to all logged-in users, configured in `src/lib/docs-manifest.ts`). Others are developer-only.

**If you're new to the project**, start with:
1. This README (project overview, tech stack, setup)
2. [docs/architecture.md](docs/architecture.md) (system design, data model, key patterns)
3. [docs/development.md](docs/development.md) (local dev setup, env vars, workflow)

### Actively maintained docs

These reflect the current state of the system and are kept up to date as features change.

| Doc | What's in it | On frontend? |
|-----|-------------|:------------:|
| [docs/architecture.md](docs/architecture.md) | System design, data model, key patterns | Yes |
| [docs/api-reference.md](docs/api-reference.md) | Full REST API reference (auto-generated via `npm run docs:api`) | Yes |
| [docs/development.md](docs/development.md) | Full local setup, env vars, database, tips | Yes |
| [docs/deployment.md](docs/deployment.md) | Railway deployment, env vars | Yes |
| [docs/features.md](docs/features.md) | Feature descriptions — what's built, what's planned | Yes |
| [docs/build-plan.md](docs/build-plan.md) | 12-phase build progression with completion status | Yes |
| [docs/future-features.md](docs/future-features.md) | Ideas and backlog items not yet planned | Yes |
| [docs/user-guide/](docs/user-guide/) | End-user guides (contacts, email, settings, etc.) | Yes |

### `docs/specs/` — Historical design specifications

Design documents written **before or during** feature implementation. These capture the original intent and design thinking, but **may not reflect the current state** of the software — the implementation may have departed from the spec. Valuable for understanding *why* things were built a certain way; for *how* things work now, refer to the actively maintained docs above.

| Doc | What's in it |
|-----|-------------|
| [docs/specs/workspaces.md](docs/specs/workspaces.md) | Original multi-tenancy design specification |
| [docs/specs/gmail-integration.md](docs/specs/gmail-integration.md) | Gmail / personal email integration design |
| [docs/specs/crm-research-brief.md](docs/specs/crm-research-brief.md) | Initial CRM research and requirements |

**New feature specs should always be placed in `docs/specs/`.** When a spec leads to implementation, the actively maintained docs should be updated to reflect what was actually built.

### `docs/audits/` — Audits and reports

One-off assessments, security audits, and investigative reports. These are point-in-time snapshots and are not updated after the fact (though findings may be tracked in `BUGS.md`).

| Doc | What's in it |
|-----|-------------|
| [docs/audits/api-blackbox-audit-2026-04-04.md](docs/audits/api-blackbox-audit-2026-04-04.md) | API security audit (86 test scenarios, 28 findings) |

### Root-level docs

| Doc | What's in it |
|-----|-------------|
| [CLAUDE.md](CLAUDE.md) | Project instructions for AI assistants (Claude Code) |
| [DEVLOG.md](DEVLOG.md) | Reverse-chronological development session log |
| [BUGS.md](BUGS.md) | Bug tracker — security audit findings and fix status |

## Auth & Permissions

**Invite-only access** — users must be invited by an admin before they can sign in with Google. Uninvited emails are rejected at login.

**Two-layer role system:**

Users have a **global role** (system-wide) and a **workspace role** (per-workspace). The effective role in any workspace is the maximum of the two. For example, a user with global "member" role and workspace "admin" role is effectively an admin in that workspace.

| Role | Can do | Cannot do |
|------|--------|-----------|
| **Admin** | Manage users, settings, campaigns, scripts, segments, fields, contacts within their workspace | — |
| **Member** | View/edit contacts, tags, interactions | Send campaigns, manage segments/scripts/fields, access settings |
| **Viewer** | View all data (read-only) | Create, edit, or delete anything |

**Global admins** additionally can: create/delete workspaces, define core and global_internal custom fields, view all workspaces.

- Workspace roles assigned by workspace admins in Settings > Users
- Global roles managed by global admins
- `ADMIN_EMAILS` env var auto-promotes specified emails to global admin
- API key auth (`Bearer pai_<key>`) grants admin access
- All API routes enforce role checks server-side; UI buttons are disabled for insufficient roles

## Deployment

Deployed on Railway with three services: **web**, **worker**, **Postgres**. See [docs/deployment.md](docs/deployment.md) for the full guide.

**Current production URL:** https://web-production-4523c.up.railway.app

To deploy:
```bash
# Deploy web service
cat > railway.toml << 'EOF'
[build]
builder = "RAILPACK"
[deploy]
startCommand = "npx drizzle-kit push && npm start"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
EOF
railway up --detach --service web

# Deploy worker service
cat > railway.toml << 'EOF'
[build]
builder = "RAILPACK"
[deploy]
startCommand = "npx tsx src/worker/index.ts"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
EOF
railway up --detach --service worker
```

## Contributing

See [docs/development.md](docs/development.md) for the full development guide including how to add new features, database schema changes, and testing conventions.

### End-of-session ritual

At the end of every development session, run the **`/wrapup`** slash command (defined in `.claude/commands/wrapup.md`). This:

1. Reviews all commits since the last devlog entry
2. Writes a new entry in `DEVLOG.md`
3. Scans **every** documentation file, triages which ones need updates based on what changed, and updates them
4. Commits and pushes all documentation changes

This ensures docs never go stale. If you're wrapping up a session (e.g., "let's commit and push", "I think that's done"), always run `/wrapup` before ending.
