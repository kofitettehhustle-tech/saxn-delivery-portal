# SAXN Music Delivery Portal

A private client handoff portal for SAXN music production projects. The application is a Next.js 14 App Router site in TypeScript; Supabase Auth, PostgreSQL and private Storage provide identity, data and object storage. API inputs are runtime-validated, and SQL migrations define the authoritative tables, RLS and worker RPCs. ZIP generation runs as a separate Node.js worker. This repository contains the application and deployment instructions; it is not connected to or deployed on an owner Supabase/Vercel/worker account until those services and credentials are supplied.

## Product surface

- `/login` — administrator-only Supabase password login and recovery; public signup is not implemented.
- `/admin` — database-backed overview and recent delivery/download-request activity.
- `/admin/deliveries/new` — delivery form with TUS-resumable private uploads, safe filenames, progress/retry, optional protected WAV/MP3 preview, expiry/password controls, and background ZIP requests.
- `/admin/deliveries` and `/admin/deliveries/:id` — search, filtering, history and delivery lifecycle actions.
- `/admin/clients` and `/admin/clients/:id` — client records/history.
- `/admin/settings/brand`, `/admin/storage`, `/admin/account` — public brand values/private official logo upload, storage policy/usage and password recovery.
- `/d/:token` — private, no-account delivery page. The random bearer token is hashed in PostgreSQL; expiry, revocation and optional password gating are checked on every request.
- `/api/health` and worker `/health` — non-secret health checks.

Originals, archives, optional previews and brand assets remain in private Supabase buckets. To stay below Supabase's per-object upload cap, the worker groups MP3s together, packages each WAV separately, and batches other files by category; each ZIP is capped at 45 MiB. It validates ZIP entry names and contents before setting READY. Signed delivery URLs are short-lived. A `download_requested` event means the server authorized a signed download link; the browser's transfer then runs at Supabase Storage, so the application cannot prove that all bytes reached the recipient. Page views and authorized download requests are displayed separately.

## Requirements

- Node.js 20 or later and npm compatible with the `packageManager` pin in `package.json`.
- A Supabase project with Auth, PostgreSQL and Storage enabled.
- FFmpeg on the worker host is optional. When available, WAV preview sources are converted to a private 128-kbps MP3 preview. Without FFmpeg, a compatible WAV/MP3 source is used directly. ZIP packaging does not depend on FFmpeg.
- A worker host (for example Railway or Render) with persistent process support for the packaging loop. The Next.js/Vercel runtime is not used for ZIP creation.

## Supabase provisioning

1. Create or select the Supabase project and keep the project URL, anon key and service-role key available only in approved secret storage. Do not place the service-role key in any `NEXT_PUBLIC_` variable or browser bundle.
2. The ordered SQL migrations live in `supabase/migrations/` and are managed by the Supabase CLI. After installing the project dependencies, link to the intended project with `npx supabase link --project-ref <project-ref>`, review its history with `npx supabase migration list --remote`, then inspect the proposed changes with `npx supabase db push --dry-run --remote`. Only run `npx supabase db push --remote` after confirming the target project and migration plan. Migrations create RLS, service-role-only worker/dashboard RPCs, private buckets and optional preview metadata; migrations 006–008 add and harden split archive packaging. If migrations were previously run manually in the dashboard, reconcile the remote migration history with the local files before applying anything; do not blindly rerun them.
3. In Supabase Auth, disable public user signups. Create/invite the first user from the Supabase dashboard or an authorized admin workflow; no public registration route exists in this application. Then provision that existing account as an active portal administrator using a trusted SQL session (replace the placeholder email and display name):

   ```sql
   insert into public.admin_profiles (id, email, display_name, is_active)
   select id, email, 'SAXN Administrator', true
   from auth.users
   where lower(email) = lower('replace-with-the-admin-email@example.com')
   on conflict (id) do update
     set email = excluded.email,
         display_name = excluded.display_name,
         is_active = true;
   ```

   Confirm the query affected exactly the intended existing user. This profile does not create a Supabase Auth user or set a password.
4. Configure Supabase Auth site URL and the allowed callback URL to your local or production origin, including `/auth/callback`. Keep email/password provider enabled. Use HTTPS in production.
5. Bucket names, file allowlists and initial limits are declared by migration `001`; database storage policy defaults are seeded by migration `002`. If the database is already in use, inspect the target tables and bucket policies before rerunning or adapting migrations.

## Local setup (Windows PowerShell)

```powershell
Copy-Item .env.example .env.local
# Edit .env.local using a trusted editor and replace all placeholder values.
npm install
npx supabase start
npm run typecheck
npm test
npm run dev -- --hostname 127.0.0.1 --port 3000
```

The `.env.local` file is ignored by Git. For local packaging, run the separate worker in another PowerShell window:

```powershell
npm run worker:dev
```

The worker loads `.env.local` through Next's environment loader. It exposes `/health` on `WORKER_HEALTH_PORT` (default 8787); do not publish this port unnecessarily. If port 3000 is occupied, stop the conflicting local process or choose a different free port and update the current Manus Session preview setting rather than silently switching the project configuration.

Required `.env.local` values are `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `DELIVERY_COOKIE_SECRET`. Generate the cookie secret locally with a cryptographic random generator (for example, Node `crypto.randomBytes(32)`); do not use the example placeholder. Optional bucket names/worker limits can remain at defaults. Environment variables are read at process start; restart app and worker after changes.

## Delivery worker

Build/run the same repository on a long-lived Node host with its own copies of the worker's server-side secrets:

```sh
npm ci
npm run worker:build
npm run worker:start
```

Set the Supabase project URL, service-role key, bucket names, `WORKER_POLL_INTERVAL_MS`, `WORKER_STALE_SECONDS`, `MAX_PROCESSING_ATTEMPTS`, and `WORKER_HEALTH_PORT` as host-managed secrets/configuration. The service-role key must never be put in a client environment. Install FFmpeg on the worker host and set `FFMPEG_PATH` only if MP3 preview generation is wanted. The worker claims queue jobs with an atomic database function, retries safely, uses temporary files, verifies each ZIP entry, removes incomplete outputs and records failed attempts. Ensure the host allows sufficient temporary disk space for the largest delivery and ZIP output; choose limits that fit its disk/RAM/network capacity.

## Production deployment

1. Build/publish the Next.js application through the chosen host (for example Vercel) using the repository's normal `npm run build`/`npm start` scripts. Configure the four required environment values and private bucket names in the host secret manager. Private links use Vercel's production domain when system environment variables are enabled. Set `PUBLIC_APP_URL` to the canonical HTTPS origin to guarantee production links, or when deploying elsewhere.
2. Deploy `worker/` as a separate persistent process from the same revision, with server-only Supabase credentials. Build with `npm run worker:build`; `npm run worker:start` launches the compiled entry point. Do not schedule ZIP jobs in short-lived serverless request handlers.
3. Add the custom HTTPS domain, set Supabase Auth site/redirect URLs to the exact production origin, verify signed upload/download flows, and check web and worker health endpoints.
4. Test with non-sensitive test audio before client data. Verify password/expiration/revocation, archive contents, preview authorization, signed URL expiry, download-request records, cleanup protections and worker retry behavior.
5. Configure automated Supabase database backups and separately define object-storage retention/backup. Test restoration in a non-production project. Retention cleanup is manual from admin storage settings and targets only expired/revoked deliveries after the configured period; original files for active deliveries remain protected.

## Environment reference

`.env.example` documents the variables. Database `storage_settings` values become authoritative after migrations. The storage adapter contract in `lib/storage.ts` currently has an active Supabase implementation; a Cloudflare R2 adapter would be an additional provider implementation, not a configured connection.

## Checks and troubleshooting

`types/database.ts` records the expected migration schema as a reference contract. The Supabase SDK client factories currently use a lightweight generic because full generated SDK schema inference exhausted this desktop's Node compiler memory; API inputs remain runtime-validated and the SQL migrations are authoritative. After configuring the project, rerun `npm run typecheck` in a runtime with adequate memory before production deployment; consider binding regenerated Supabase types into the SDK clients as a follow-up.

- **Login rejected / no admin profile:** verify Supabase URL/anon key, Auth user existence, active row in `public.admin_profiles`, email provider and callback allowlist. There is no seeded demo admin or public signup.
- **Uploads denied:** check Storage bucket privacy, RLS policies, Supabase Auth session, bucket file limit and approved MIME metadata. TUS resume state is browser-local.
- **Package remains PROCESSING:** check worker `/health`, worker logs, Supabase service-role secret, `claim_processing_job` permissions, temporary disk, object paths and `processing_jobs.error_message`.
- **Package fails with retryable error:** use the delivery detail retry action after reviewing the worker error. The worker will not mark a failed or corrupt archive READY.
- **Preview:** only WAV/MP3 can be selected. If WAV conversion fails or FFmpeg is unavailable, the source WAV remains eligible for browser playback; ZIP delivery is independent.
- **Link unavailable:** verify that it was copied before leaving the one-time issuance screen, and check token revocation, delivery expiry and password. Only a token hash is stored; use the administrator's rotate/issue-link action to mint a fresh bearer link. Never include bearer links in public logs or analytics.
- **Database migrations:** apply in numeric order and only to the intended Supabase project; changing SQL after application requires a new reviewed migration.

## Data and privacy notes

Admin operations use a server-only Supabase service role after Supabase Auth and `admin_profiles` authorization. Row Level Security and private buckets remain enabled. Public endpoints are rate-limited, redact client email and internal storage paths, and return only short-lived signed URLs after token/password validation. Do not send client emails or tokens to third-party analytics. The dashboard's “downloaded” count means a delivery had at least one authorized download request, not that the complete transfer was independently acknowledged by the browser/storage service.

No live Supabase credentials, worker host, domain, or external deployment are included in this repository. Configure those services before treating the portal as production-ready.
