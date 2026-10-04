# ClassFlow

Teacher module submission and approval portal. The published app uses trusted Sites identity headers, D1 records, and R2 document storage. Approved modules are private to their submitting teacher and head teachers.

## Accounts

The first platform-authenticated visitor initializes the workspace as its owner/head teacher. The existing Site access policy currently allows only its owner. The centered login page supports multiple independent school accounts with hashed passwords and HttpOnly sessions. Sign out to create or sign into a different school account. The first school account preserves the visitor's existing data; additional accounts default to Teacher. The workspace owner can promote accounts on Teachers; client role selection never grants permission. School sessions do not bypass the outer Sites access policy. Password recovery is not yet configured.

## Optional Google sign-in setup

The Google authorization-code integration is implemented, but real sign-in requires the school's OAuth credentials. Create a Web application client in Google Cloud / Google Auth Platform, configure branding/audience and test users if in Testing, and authorize this exact redirect:

`https://classflow-module-approval.eznet06.chatgpt.site/api/auth/google/callback`

Set production runtime `GOOGLE_CLIENT_ID` and secret `GOOGLE_CLIENT_SECRET` through Sites environment settings. `GOOGLE_REDIRECT_URI` is optional and defaults to the URI above. Never place the secret in frontend code, a commit, or chat. For local OAuth testing use ignored `.dev.vars` and explicitly authorize a localhost callback URI. `.env.example` documents the same keys; it is not loaded into production automatically.

Google only requests openid/email/profile (not Drive access). State, PKCE, nonce, signed ID tokens, issuer/audience/expiry and verified email are checked server-side. Existing password accounts must sign in first and explicitly link Google from Profile; matching emails do not silently link accounts. New Google accounts default to Teacher. Google credentials and provider tokens are not sent to the browser or retained after sign-in. Sign-in remains unavailable with a clear explanation until credentials are configured. Access for other real users additionally requires an authorized Site access-policy change; current owner-only access is preserved.

A head teacher cannot approve their own submission. Assign a second head teacher before using the workspace owner as a submitting teacher.

## Workflow

PDF/DOCX uploads are limited to 20 MB. Each revised upload gets a new immutable file and version record. Return requires feedback; approval records reviewer/date/final version. Optimistic revisions prevent stale review decisions. Archived files can be restored. All file, feedback, notes, and reporting routes enforce identity and ownership on the server.

PDFs have native browser previews. DOCX previews show extracted text; download to view original images/layout in Word. CSV exports contain the currently filtered records. Notifications are in-app; this version does not send email or scheduled reminders.

Existing browser-only prototype data remains untouched in local storage; it is not imported as real submissions because those records do not contain uploaded documents. `dist/app.js` retains the previous prototype source for reference but is not served by the Worker. Local test records never become production data.

## Local development

## Moving the source into your own Git repository

The supplied ClassFlow-project.zip includes editable source, the dependency lockfile, tests, migrations, and built output. It excludes credentials, uploaded school records, local test databases, node_modules, and the existing Git history. Extract it into an empty folder, create your repository there, and follow the local development steps below. Do not upload private credentials or .dev.vars.

This is a Cloudflare Worker application, not a static HTML-only site. GitHub can store the project, but GitHub Pages cannot run its database/authentication/upload backend. Production currently uses Sites identity headers as an outer access boundary plus D1/R2. Deploying outside Sites requires configuring those services and replacing the platform-identity boundary; merely uploading the files will not enable account access or Google sign-in. Google OAuth still requires your own configured credentials.

1. `npm install`
2. `npm run db:generate` only after schema changes.
3. `npm run build`
4. `npx wrangler d1 migrations apply classflow-local --local`
5. `npm run dev -- --port 8787`
6. `node scripts/test-flow.mjs` on a fresh local database verifies the workflow with fictional test identities.
7. `node scripts/preview-proxy.mjs` exposes the fictional teacher preview at localhost:4174. This helper is local-only and is excluded from the Worker bundle. It is not a production auth mechanism.

## Storage organization and Google Drive

Current credentials-free storage uses R2. Original uploads use `submissions/{moduleId}/v{version}/{objectId}`. Approval also copies the final bytes into `approved/{schoolYear}/{subject}/{grade}/{moduleId}/v{version}/{filename}`. D1 is authoritative for version and approval metadata; storage folder locations do not grant access.

Google Drive is not connected. A future provider should implement the same upload/read/copy/delete operations behind the existing storage boundary, record its provider file ID in the version record, and keep the same server authorization and final-version lock. Google permissions, token refresh, and retries must be handled server-side; never put credentials in the browser. Replacing the storage provider must not replace version or approval history.
