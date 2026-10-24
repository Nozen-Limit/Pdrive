# Password recovery and Philippine phone numbers

The local website remains at http://127.0.0.1:4175/Pdrive/.

## Password recovery

- Reset requests are protected against simultaneous sends and repeated requests for the same email within 60 seconds. The cooldown survives a refresh in the requesting browser. Provider limits are reported as failures, not as a successful send.
- Reset emails now request a callback to `http://127.0.0.1:4175/Pdrive/?recovery=1`. The app supports Supabase's PKCE flow and the older implicit recovery event. A delayed `PASSWORD_RECOVERY` event opens the new-password form even if the dashboard has already started loading. The explicit recovery marker survives refreshes.
- The new-password page still requires an authenticated recovery session. Expired links, failed verification and links opened without the requesting browser's PKCE verifier show a useful message and allow requesting another link. The app never bypasses email verification or the provider's rate limits.
- On a successful password change, the recovery marker and dirty-form state are cleared. Mismatched/short passwords and simultaneous submissions are rejected.

### Supabase administrator configuration

In Authentication → URL Configuration, allow the exact callback above, plus the corresponding deployed HTTPS callback with `?recovery=1`. If you also use localhost instead of 127.0.0.1, allow `http://localhost:4175/Pdrive/?recovery=1` too. Use one host consistently when requesting and opening a reset link: the PKCE verifier belongs to that browser origin.

The default recovery email template must use `{{ .ConfirmationURL }}` so Supabase verifies the token before redirecting back. Keep the existing Site URL pointing at the intended deployed app; do not substitute a bare login URL for the confirmation link.

Supabase's built-in email provider has a project-wide limit of **2 auth emails per hour**, shared by signup/recovery/email-change operations, and recovery requests also default to a **60-second per-user interval**. A client-side fix cannot raise that quota. Configure a supported custom SMTP provider for reliable testing/use, then review Authentication → Rate Limits. No account passwords or SMTP credentials are needed in the website's public config.

Sources: https://supabase.com/docs/guides/auth/rate-limits, https://supabase.com/docs/guides/auth/passwords, https://supabase.com/docs/guides/auth/redirect-urls.

## Phone numbers

The optional profile phone field accepts Philippine mobiles and landlines using libphonenumber-js's full validation metadata. It accepts local or `+63` formats, rejects invalid lengths/prefixes and other countries, stores a normalized `+63…` value, and displays the international number with spaces. Validation runs both in the form and in the app's profile API wrapper before a database write. It validates numbering format, not ownership or whether a number can receive calls. Existing invalid stored values remain visible so the user can correct them; no mass rewrite is performed.

Examples: `0912 345 6789` → `+63 912 345 6789`; `(02) 8123 4567` → `+63 2 8123 4567`.
