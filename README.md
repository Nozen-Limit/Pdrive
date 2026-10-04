# Project Sikap

A real Teacher Module Submission & Approval System. GitHub Pages hosts the interface; Supabase provides shared accounts, a PostgreSQL database, private file storage, and permission enforcement. No ChatGPT identity, Vercel, Cloudflare, local-only demo database, or custom server is needed.

## Deploy in this order

### 1. Connect Supabase

1. Create a NEW project at https://supabase.com/dashboard. Keep its database password private.
2. In **SQL Editor**, paste the complete contents of `supabase/setup.sql` and click Run. Run it once on a new database, not over an existing app. This creates all tables, protected workflow functions, access rules, the private document bucket and new-user profile trigger.
3. Find the **Project URL** and **publishable key** in the project's Connect/API settings. A legacy `anon` key also works. These are public frontend configuration values, not administrator credentials.
4. Edit **docs/config.js** and fill in `supabaseUrl` and `supabasePublishableKey`. Never put a `service_role`, `sb_secret_`, database password, Google secret, or access token in the repository. `docs/config.js` is the deployment configuration; later builds preserve it. Root `config.js` is only the initial blank template.
5. In **Authentication → URL Configuration**, set Site URL to `https://nozen-limit.github.io/Pdrive/` and add that exact address to Redirect URLs. Add `http://127.0.0.1:4175/Pdrive/` only for local testing.
6. Enable Email/password authentication. Leave email confirmation enabled for real users. Configure a production SMTP provider before inviting school users; default Supabase email delivery has restrictions and is not a school mailing service. Set the minimum password length to 12 in Supabase too. Password-reset links return to the same Pages address.

### 2. Upload to GitHub and enable Pages

1. Extract the ZIP. Upload these files into the ROOT of `Nozen-Limit/Pdrive`, keeping the `docs` folder intact. Replace the previous versions where filenames overlap. Do not upload node_modules, local databases, secrets, or the ZIP itself.
2. In the repository, go to **Settings → Pages**.
3. Choose **Deploy from a branch**, select your actual branch (usually `main`), select **/docs**, and Save.
4. Wait for GitHub's Pages deployment to finish. In Settings → Pages use **Visit site**; the expected address is `https://nozen-limit.github.io/Pdrive/`.
5. GitHub Free requires a PUBLIC repository for Pages. Do not expose a private repository without reviewing its contents and authorizing that change. GitHub Pro/eligible paid plans support Pages from private repositories. The published website itself is public, but Supabase protects the records and files behind login.

`docs` contains prebuilt browser assets. No GitHub Actions, Node installation, Vercel or Cloudflare is needed for the branch-based deployment above. A repository URL (`github.com/...`) is not the live website (`...github.io/...`). A 404 usually means Pages is not enabled, /docs is not selected, or deployment is not finished. A setup message means docs/config.js is still blank. Authentication errors require checking Supabase URLs, Email provider and confirmation. Don't add secrets to fix a setup error.

### 3. Set the owner / Head Teacher

1. Open your live website, Sign Up with YOUR email and confirm it from your inbox.
2. Edit the email placeholder in `supabase/set-owner.sql` and run it in Supabase SQL Editor. This explicitly makes your account owner and Head Teacher. The first random visitor never becomes administrator.
3. Sign in again. Open **Teachers** to assign other users Teacher or Head Teacher roles. All new accounts start as Teachers, including Google accounts. Only the owner can manage roles. A Head Teacher cannot approve their own submission.

### 4. Optional Google sign-in

Email/password works without Google. For Google, enable the Google provider in Supabase Authentication and supply your Google Web OAuth client ID/secret THERE, not in GitHub. In Google Cloud, authorize `https://nozen-limit.github.io` as the JavaScript origin and the Supabase callback shown in the provider settings (normally `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`) as the redirect URI. Keep the Pages URL allowed in Supabase too. Configure Google audience/test users or production status as appropriate. Supabase handles OAuth tokens and validation. The Google button reports provider errors if it has not been enabled. Explicit linking from Profile additionally requires Supabase's Allow manual linking setting. Google login does not give access to Google Drive.

## Features

Clean responsive Inter login; signup/confirmation, logout, password recovery and optional Google sign-in; visible account roles; resizable desktop sidebar/mobile drawer; subject/grade/term/year/search/status filters; upload PDF/DOCX (20 MB); private modules; feedback, return, resubmission, immutable version history, approval record/final-version lock; notes create/edit/pin/delete, notifications, profile, teacher role management, CSV reports, stars, archive/restore. PDF previews use signed file URLs. DOCX preview extracts text; download for original layout.

All data and documents are shared across devices through Supabase, not a browser-only demo. Browser storage holds the authentication session and layout preferences. Remember me uses persistent storage; otherwise the session uses the current tab's session storage. OAuth callbacks must return to the same browser that initiated them. Sign-out revokes this device's session. Use trusted devices and avoid entering real sensitive school records until your deployment and rules have been reviewed.

## Approval and storage safety

Database functions lock the module row and check its revision before deciding or resubmitting. Teachers cannot directly change module status, roles, version files, or activity history through the API. Uploaded objects are append-only; no authenticated update/delete storage policies exist. File reads require access to the corresponding module. Signed links expire after one hour; reopening the module renews them. Anyone holding a signed link can use it until expiry, so don't share those links publicly.

Approval records the approver, date and final version, plus an `approved_folder` organization index (`approved/year/subject/grade/module/version`). It points to the same immutable stored original; this version does NOT physically duplicate files into that folder or connect Google Drive. `src/backend.js` is the storage-provider boundary for a future server-managed Drive integration. No Google Drive tokens belong in frontend code. Failed submissions may leave unreferenced uploaded objects; arrange an administrator-only retention/cleanup job before heavy production use. File signature/extension checks are made in the interface, with size/MIME and ownership enforcement in storage/database. Malware scanning is not included.

This installation represents ONE school. Head Teachers can see all that school's modules. Do not reuse one project for unrelated schools without adding school-level tenancy policies. Registration is open to users who can confirm their email; configure Supabase signup restrictions/invitations if the school wants invitation-only access. Email notifications and scheduled reminders are not included; notifications are in-app and refresh when navigating/saving/reloading. Existing data from the earlier hosted application is NOT automatically migrated. New installation starts with no school records.

## Development and tests

Install Node 22 or newer, then:

```sh
npm ci
npm test
npm run build
npm run dev
```

Open http://127.0.0.1:4175/Pdrive/. Edit interface source in src, then rebuild. PostgreSQL tests run locally using PGlite and verify real SQL/RLS, role protection, teacher isolation, private storage, feedback, stale reviews, preserved revisions and approved locks. These are not live Supabase/Google integration tests: complete your connection and verify with separate Teacher and Head Teacher accounts before inviting clients. No live project credentials are included in the ZIP.

Official setup references:
- https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/storage/security/access-control
