# Connect Project Sikap Google sign-in

## 1. Apply the account-approval database upgrade FIRST

For the existing connected Supabase project, run **supabase/account-approval.sql** in SQL Editor. Do not rerun setup.sql on the existing database.
This preserves modules/files and existing Head Teachers. All non-Head accounts need approval after the first upgrade. The upgrade is safe to rerun and does not reset approved Teachers.
If the website shows “Database update needed,” this step has not been applied.

For a brand-new database only: run setup.sql, account-approval.sql, then set-owner.sql with your confirmed email.

## 2. Create a Google OAuth Web client

Open https://console.cloud.google.com/auth/overview and select/create a project for Project Sikap.
Configure branding (Project Sikap, support email), audience and these basic scopes only: openid, userinfo.email, userinfo.profile. Google sign-in does not need Drive permissions.
If the audience is in Testing, add the Google accounts you will use as test users.
Under Clients, create a **Web application** client with:

- Authorized JavaScript origin: `https://nozen-limit.github.io`
- Authorized redirect URI: `https://keuaxstqovfaapizwhfj.supabase.co/auth/v1/callback`

Keep the Client Secret private. Enter it directly in Supabase, not chat, config.js, or GitHub.

## 3. Enable Google in Supabase

Open https://supabase.com/dashboard/project/keuaxstqovfaapizwhfj/auth/providers
Enable Google, enter the Web Client ID and Client Secret, and save.
Keep nonce checks enabled. Manual linking is optional: enable it only if you want existing users to link Google from their Profile.

In Authentication → URL Configuration:

- Site URL: `https://nozen-limit.github.io/Pdrive/`
- Redirect URLs: `https://nozen-limit.github.io/Pdrive/`

These are two different redirects: Google returns to Supabase's callback; Supabase returns to the website above. Do not use the ChatGPT Sites URL here.

## 4. Verify with separate accounts

1. Sign in as the preregistered Head Teacher using the original email/password login.
2. In another browser/profile, click Google and use a new confirmed test account.
3. The new account must show **Awaiting approval**, not the Teacher dashboard.
4. Head Teacher opens Teachers, reviews the request and approves it.
5. The applicant clicks Check status and enters the Teacher dashboard.
6. Test a rejection too. Rejected accounts must have no access to modules or uploads.

Database tests verify permissions locally. A full Google login cannot be verified until the real provider credentials and redirect settings are configured.

Official reference: https://supabase.com/docs/guides/auth/social-login/auth-google
