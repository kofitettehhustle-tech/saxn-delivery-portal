# SAXN Music Delivery Portal — Implementation Plan

## Scope and implementation approach

Build the standalone SAXN portal in the existing initialized project root using its Next.js 14, React 18 and TypeScript stack. Preserve the existing managed website declaration and package conventions. Supabase is the authoritative application data/auth/storage provider because the owner explicitly selected Supabase; the enabled Manus MySQL capability is not an application data store. Keep the Manus web server capability for serving the site. No live Supabase credentials, worker host, Vercel account or Supabase project were supplied, so the code, migrations and runbooks are completed locally, while service-connected acceptance remains pending configuration.

The web app uses Next.js App Router server components/API handlers. Client-facing data is fetched through narrow server APIs. Admin authorization is enforced server-side with Supabase Auth sessions and an administrator profile record; public signup is absent. Supabase service-role access is server-only and used only for validated administrative/background operations. A migration-backed TypeScript reference contract records expected table rows and RPCs; all write inputs are validated at runtime. PostgreSQL migrations define the schema, RLS, indexes, constraints and safe atomic worker functions. Browser access is restricted by RLS; bearer-link access is resolved on the server from a cryptographic token hash and never exposes raw storage keys.

File uploads use authenticated, resumable TUS transfers to private Supabase Storage buckets after an administrator-only API returns server-generated storage paths. The database records ownership and validated file metadata. A standalone Node worker claims packaging jobs transactionally, streams source objects through Archiver, writes categorized paths and notes, validates archive entries/integrity, uploads the result to a private bucket, and transitions status only on success. Retries are idempotent and incomplete output is cleaned up. When FFmpeg is installed on the worker, selected WAV preview sources are converted to a private compressed MP3; if it is unavailable, the compatible WAV source remains available. Previews do not block ZIP delivery.

Private delivery tokens are random bearer credentials; only hashes are stored. The issuance response reveals a raw link once; management issues/rotates a new token when the owner requests another copy. Optional delivery passwords are bcrypt-hashed and rate-limited. Link validity checks expiry/revocation on every access; download and preview authorization returns short-lived signed URLs, not public paths. Record page views separately from authorized download requests. Since signed storage URLs hand the transfer to Supabase Storage, an authorized download request is observable but the app cannot prove that a client's transfer completed; the admin UI and documentation will label that evidence accurately.

Database relations are loaded through explicit, batched server-side queries rather than deeply nested PostgREST select strings. This keeps the contract statically checkable and bounds the data returned to the browser; public delivery responses omit client email, internal storage paths, hashes and database identifiers.

## Product structure

- `app/`: responsive admin routes, login/reset/update, `/d/[token]`, and typed API handlers for clients, deliveries, upload, packaging, access, download, previews, branding and health.
- `components/admin/`: responsive navigation, dashboard, client/delivery detail, storage/brand settings and real upload form.
- `components/delivery/`: client delivery page, password gate, download feedback and protected audio player.
- `components/`: configurable brand logo component; text-only SAXN wordmark until the official emblem is uploaded.
- `lib/`: Supabase browser/server/service clients, session/role checks, cryptographic token/password utilities, validation, rate limiting, filename safety, configuration and provider-neutral private-storage adapter contract with Supabase as the active adapter.
- `worker/`: separate Node process, database job-claim loop, streaming Archiver processor, optional FFmpeg preview transcoding, private storage adapter and health endpoint.
- `supabase/migrations/`: ordered additive SQL migrations for core schema/RLS/private buckets, storage policy/worker RPC, preview and worker hardening, bounded dashboard metrics and size-bounded split delivery archives. No production test data is seeded.
- `tests/`: unit checks for token/filename/MIME/formatting utilities. Integration runs require credentials in an isolated Supabase test project; do not run destructive tests against shared production data.
- `README.md`, `.env.example`, `.npmrc`, package scripts: exact prerequisites, package install, first-admin provisioning, migration order, worker/deployment, backups and troubleshooting without real secrets.

## Design system

- **Design Movement:** restrained luxury audio-instrument minimalism, grounded in a premium mastering-room control surface rather than a generic SaaS dashboard.
- **Core Principles:** generous negative space; clear signal-to-noise hierarchy; precise status feedback; quiet, accessible interaction.
- **Color Philosophy:** obsidian and graphite recede so music and delivery status remain central; white, muted gray and platinum communicate clarity and finish without neon spectacle.
- **Layout Paradigm:** editorial split-pane admin workspace with a compact navigation rail and wide content canvas; client delivery is a vertical listening/download narrative optimized for mobile.
- **Signature Elements:** fine platinum hairlines and section labels; restrained waveform/progress marks; consistent monochrome status chips.
- **Interaction Philosophy:** actions acknowledge real server state, explain failures plainly and remain keyboard accessible; no pretend progress or success.
- **Animation:** short 140–220 ms transitions, reduced-motion aware; upload/processing progress is data-driven, not decorative.
- **Typography System:** modern sans-serif system stack with strong large headings and compact uppercase metadata; tabular numerals for sizes, dates and counts.
- **Brand Essence:** premium mix/master delivery for clients who expect studio-grade finish and a private, dependable handoff; precise, calm, assured.
- **Brand Voice:** direct and polished. Example: “YOUR MUSIC IS READY.” / “Secure handoff. Your files stay private.”
- **Wordmark & Logo:** `SAXN` text wordmark only until the official emblem is uploaded; the configurable brand component displays the official uploaded logo when configured and never invents a replacement emblem.
- **Signature Brand Color:** platinum silver `#C4C7CC`.

## Dependencies and material constraints

The project pins npm and uses Next.js, Supabase SSR/client, TUS uploads, Archiver, yauzl ZIP validation, bcryptjs and Zod. `.npmrc` explicitly leaves the required npm lifecycle scripts enabled. Environment examples contain placeholders only. Browser configuration includes only the Supabase URL and anon key; service-role key and worker secrets remain server-only. Supabase is external and must be provisioned/configured by the owner; the project’s managed Manus database is MySQL and deliberately unused. Railway/Render, Vercel and custom domain setup are documented, not claimed as performed. Storage settings in Supabase Postgres are authoritative after migrations; signed URL issuance is tracked as an authorized download request rather than proof the user's full transfer completed.

## Serving, validation and operations

The Next.js app is the web/control plane; the separate long-running worker is the packaging plane. The worker polls/claims PostgreSQL jobs safely, handles bounded retries, optionally transcodes previews, and exposes a non-secret health response. Local preview binds only to loopback on the Session's declared port; do not start on an unregistered port. TypeScript, lint, unit tests and production build are the required local gates. Connected integration tests, real storage transfer, worker processing and deployment remain pending until Supabase credentials and external accounts are supplied. No automatic public publishing or checkpoint is authorized.
