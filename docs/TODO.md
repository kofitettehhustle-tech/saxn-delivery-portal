# SAXN Music Delivery Portal — Delivery Outcomes

Status: core application implementation and documentation are in place; final static/build validation is pending. Live Supabase, worker-host and production deployment acceptance remains pending because no owner credentials/accounts were configured. Mark an outcome complete only after local evidence exists; do not treat stubs or pending external setup as live functionality.

## 1. Protected administrator access and overview
- [x] `/admin` routes protected by Supabase Auth + active `admin_profiles` authorization; client delivery route never renders admin controls.
- [x] Supabase email/password login, logout, session refresh, password reset/update; no public registration or hardcoded credentials. README contains an explicit initial-admin provisioning procedure.
- [x] Live query-backed overview totals: total, ready, authorized-download-requested, awaiting request, expired, revoked, storage usage; recent delivery/download-request activity and shortcuts.
- [x] No fake/demo metrics. “Downloaded” means at least one signed download URL was authorized; this app cannot confirm transfer completion after the redirect to Supabase Storage.
- [ ] Validate login and every admin route/API against a provisioned Supabase test project.

## 2. Delivery creation and uploads
- [x] Client name/email optional, track, supported service type, multiple individual files, preview selection, message, expiry and optional password; select existing/create a new client.
- [x] Drag/drop and file picker, TUS-resumable private transfers, size, filename editing, categories, removal before creation, progress/retry, server-generated paths and completion verification.
- [x] WAV/MP3/FLAC/AIFF/PDF checks; configurable limits and explicitly approved additional extensions; private storage buckets and original retention.
- [ ] Verify large-file resume behavior with real Supabase Storage and load tests.

## 3. ZIP packaging worker
- [x] Separate Node worker using an atomic PostgreSQL job claim and streaming Archiver; no browser archive or serverless packaging function.
- [x] Organize files by `01_FINAL_MASTERS`, `02_INSTRUMENTALS`, `03_STEMS`, `04_EXTRAS`; collision-safe filenames; include `DELIVERY_NOTES.txt`; no empty category folders.
- [x] Safe entry-path checks, ZIP entry read/integrity validation, private archive bucket upload, READY only on atomic worker completion, retries, failure recording, cleanup and health endpoint.
- [x] Optional FFmpeg WAV-to-MP3 preview conversion on worker hosts where FFmpeg is installed; compatible WAV fallback does not block ZIPs.
- [ ] Exercise real worker claims, retry/recovery, storage streaming, ZIP extraction and preview conversion in a configured test project.

## 4. Private delivery links and access lifecycle
- [x] Random cryptographic bearer link tokens; only SHA-256 hashes persisted, raw link returned at issuance; link rotation mints a new token for copy/reissue.
- [x] Expiration presets 7/14/30/90 days, custom and never-until-revoked; extend/revoke; optional bcrypt hash; protected link checks on every public API access.
- [x] Signed download/preview URLs short-lived; private buckets only; page views, password failures, download requests and preview requests are distinct events.
- [ ] End-to-end test token/password/expiry/revocation and signed-URL timeout against Supabase.

## 5. Client delivery page and audio preview
- [x] `/d/[token]` requires no client account, never returns client email/admin APIs/storage paths, and has responsive SAXN client presentation, specified heading/greeting, metadata, message, archive/size, status/expiry and actual signed download.
- [x] Clear download start/failure feedback; configurable brand wordmark/logo, location, tagline, contact email and only configured socials; required producer/Ghana footer defaults.
- [x] Optional protected WAV/MP3 playback with play/pause/seek/time/duration. If worker FFmpeg is available, a selected WAV is additionally converted to private MP3; otherwise the source WAV remains available under a short-lived signed URL.
- [ ] Verify browser playback and password-gate cookie behavior across desktop/tablet/mobile browsers.

## 6. Delivery and client administration
- [x] Live delivery search/status/service filters, detail, link issuance/rotation, expiry extension, revocation, safe delete, download-request history, packaging retry/regeneration.
- [x] Documented statuses DRAFT, UPLOADING, PROCESSING, READY, FAILED, EXPIRED, REVOKED; worker queue/job attempts/errors; page views are not downloads.
- [x] Client add/edit/search/history and guarded deletion so active deliveries cannot be silently orphaned.
- [ ] Verify management lifecycle against configured database.

## 7. Branding, settings and storage operations
- [x] Admin-managed brand name, official optional PNG/JPEG/WebP logo, location, tagline, contact and Instagram/YouTube/TikTok/Facebook/X/website/beat-store links. No invented emblem or default social handle.
- [x] Private originals/archive/preview/brand buckets, usage/size reporting, configurable retention and limits, extension approval, guarded explicit cleanup of expired/revoked deliveries, and provider-neutral storage adapter contract.
- [ ] Verify Supabase bucket limits, actual storage metering and cleanup safety in a test project. R2 is a documented future adapter, not a live connection.

## 8. Database, API and security
- [x] SQL migrations for admin profiles, brand settings, clients, deliveries, files, token/password hashes, download events, processing jobs, rate-limit buckets and storage settings; indexes, foreign keys, constraints, RLS and worker/dashboard RPCs.
- [x] Validated admin/public route families for clients, deliveries, uploads, packaging, link lifecycle, previews/downloads, branding/storage/settings and health.
- [x] Server-only service credentials, server-side admin checks, secure session cookies, origin/Fetch Metadata guard on mutations, rate limiting, safe input/filenames/archive paths, no-store private APIs and short-lived signed object URLs.
- [ ] Run adversarial tests for auth, CSRF, RLS and cross-client visibility on a non-production Supabase project.

## 9. Project, operations, documentation and QA
- [x] Modular Next.js routes/components/helpers, separate Node worker, additive migration scripts, npm scripts, pinned npm manager and placeholder-only environment template.
- [x] README covers required Supabase provisioning, migration order, first admin, local install, worker, production deployment, backups, retention and troubleshooting.
- [x] `npm install` completed with the pinned npm 10.9.3 toolchain; it created `package-lock.json` and installed the declared dependency set.
- [x] The focused security unit suite passed 3/3; the worker TypeScript build passed; the direct ESLint binary completed cleanly after the final UI lint fixes.
- [x] A strict root TypeScript check passed before final UI polish; a final post-polish rerun could not be completed because Node terminated with V8 out-of-memory/allocation failures on the desktop.
- [ ] Final root typecheck and production Next.js build remain pending rerun in a runtime with sufficient Node memory; do not treat the incomplete reruns as a code failure or a pass.
- [ ] Review browser Preview at desktop/tablet/mobile widths after starting only on the declared Session port.
- [ ] Production deployment, DNS/HTTPS, Supabase Auth redirect and real service configuration remain pending owner credentials/account decisions.

## 10. End-to-end workflow
- [x] Implemented the intended path: create client/delivery → authorize resumable private upload → verify → queue background packaging → worker validates/private uploads ZIP → return a one-time private link → public client page validates password/expiry/revocation → signed preview/download request → event recorded.
- [ ] Full workflow acceptance against real Supabase and worker infrastructure remains pending external configuration and end-to-end tests.
