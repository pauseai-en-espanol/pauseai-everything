# Deployment Guide

> Last updated: 2026-09-16. This fork (pauseai-en-espanol) deploys to the `danilupion-com`
> Kubernetes cluster via Argo CD. Upstream (PauseAI/pauseai-everything) deploys to Railway;
> `railway.toml` is kept only so merges from upstream stay clean.

## Overview

One Docker image, three workloads, all rendered by the Helm chart in `charts/pauseai-everything`:

| Workload | Command | Notes |
|----------|---------|-------|
| **web** | `npm start` | Next.js on :3000; readiness/liveness on `GET /api/health` |
| **worker** | `npx tsx src/worker/index.ts` | graphile-worker (campaign sending, scripts, syncs, churn detection) |
| **migrate** | `npx drizzle-kit push && npx tsx src/db/seed.ts` | Argo CD Sync hook at wave 1, after secrets and before the wave-2 Deployments. Runs on every sync, mirroring the Railway `drizzle-kit push` start command |

PostgreSQL is the shared cluster instance (`postgresql.postgresql.svc.cluster.local`), database and
role `pauseai_everything`, provisioned declaratively by the gitops repo.

## Branches

- `dev` — clean mirror of upstream `dev`. Never commit here; fast-forward only.
- `main` — deploy branch. Everything deployment-specific (Dockerfile, chart, workflows) lives here,
  and CD commits image-tag bumps here. Ship upstream changes with `git merge dev` on `main`.

## Pipeline

```
push to main ──▶ CI (self-hosted juggernaut runner: npm ci, npm test, npm run build)
                  └─▶ CD: docker build (GIT_SHA build arg) ──▶ push harbor.danilupion.com/pauseai-es/pauseai-everything:<version>.<sha>
                        └─▶ yq bumps charts/pauseai-everything/values.yaml image.tag, commits "[skip ci]" to main
                              └─▶ Argo CD (gitops repo ApplicationSet) syncs: PreSync migrate Job → web + worker rollout
```

Workflows: `.github/workflows/ci.yml`, `.github/workflows/cd.yml` (copied from pauseai-website-es).
CD needs the `PAT_TOKEN` repository secret (push access to `main`) and the org-level self-hosted
runner, which supplies `DOCKER_REGISTRY` and Harbor push credentials.

## Where things live

| What | Where |
|------|-------|
| Dockerfile / `.dockerignore` | repo root |
| Helm chart | `charts/pauseai-everything` |
| Argo CD ApplicationSet | gitops: `catalog/apps/pauseai-everything/applicationset.yaml` |
| Cluster values (hostname, env, secret name) | gitops: `clusters/danilupion-com/values/apps/pauseai-everything.yaml` |
| HTTPRoute (`crm.pauseai.es` on gateway-private, VPN-only via Headscale) | gitops: `clusters/danilupion-com/resources/apps/pauseai-everything/httproute.yaml` |
| Sealed secrets | gitops: `.../resources/apps/pauseai-everything/secrets/` and `.../resources/data/postgresql/pauseai-everything-db-credentials.yaml` |
| DB provisioning | gitops: `clusters/danilupion-com/values/data/postgresql.yaml` (`databases:` list) |

DNS (Cloudflare via external-dns) and TLS (wildcard `*.pauseai.es` on the private gateway) are
automatic once the HTTPRoute exists. The record resolves to the VPN address 172.31.240.1, so the
CRM is only reachable from devices joined to the Headscale network.

## Environment variables

Plain values come from the chart's `env` list (overridden in the gitops cluster values); secrets
come from the Secret named by `existingSecret`, injected with `envFrom` into every pod.

| Variable | Source | Notes |
|----------|--------|-------|
| `DATABASE_URL` | secret | `postgresql://pauseai_everything:<pw>@postgresql.postgresql.svc.cluster.local:5432/pauseai_everything?sslmode=disable` |
| `NEXTAUTH_SECRET` | secret | `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | secret | Google OAuth client; redirect URI `https://crm.pauseai.es/api/auth/callback/google` |
| `UNSUBSCRIBE_SECRET` | secret | `openssl rand -hex 32` |
| `EMAIL_ENCRYPTION_KEY` | secret | `openssl rand -hex 32`; encrypts OAuth tokens and connector credentials at rest, rotating it invalidates them |
| `MAILERSEND_API_KEY`, `MAILERSEND_FROM_EMAIL`, `MAILERSEND_WEBHOOK_SIGNING_SECRET`, `TALLY_WEBHOOK_SIGNING_SECRET` | secret | only needed once `EMAIL_MODE=live` |
| `EMAIL_MODE` | env | `sandbox` (default) captures all outbound mail in `sandbox_emails`; `live` sends via Mailersend |
| `AUTH_TRUST_HOST` | env | `true`; Auth.js behind the Envoy gateway |
| `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL` | env | `https://crm.pauseai.es` |
| `ADMIN_EMAILS` | env | comma-separated; auto-promoted to admin on first sign-in |

## Local image build

```bash
GIT_SHA=$(git rev-parse --short HEAD) DOCKER_TAG_SUFFIX=local npm run docker:build
docker run --rm -p 3000:3000 --env-file .env pauseai-es/pauseai-everything:1.0.0.local
curl localhost:3000/api/health
```

`helm lint charts/pauseai-everything` and `helm template x charts/pauseai-everything` render the manifests.

## Rotating or adding secrets

Edit an unsealed copy, then re-seal against the cluster (the sealed files carry the unsealed template
as a header comment):

```bash
kubectl config use-context danilupion.com
kubeseal --controller-namespace sealed-secrets --controller-name sealed-secrets --format yaml \
  < /tmp/pauseai-everything-credentials.yaml \
  > clusters/danilupion-com/resources/apps/pauseai-everything/secrets/pauseai-everything-credentials.yaml
rm /tmp/pauseai-everything-credentials.yaml
```

The DB password must be identical in `pauseai-everything-db-credentials` (namespace `postgresql`) and
inside `DATABASE_URL`.

## Schema changes

`drizzle-kit push` runs in the PreSync Job on every deploy. It applies additive changes unattended;
a change that would drop data makes the Job fail (it prompts for confirmation, which a Job cannot
answer) and the rollout stops. Apply such changes manually with `npx drizzle-kit push` from a machine
with `DATABASE_URL` pointing at the cluster DB (port-forward `svc/postgresql -n postgresql 5432`).

## Rollback

Revert the `chore: update image tag` commit on `main` (or set `image.tag` in the gitops cluster
values to a previous `<version>.<sha>`); Argo CD rolls back. Schema is not rolled back.
