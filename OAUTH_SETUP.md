# Inkrya OAuth activation

Google and GitHub client flows are implemented. Both providers currently report disabled from Supabase Auth settings. These are not activated by connecting ChatGPT plugins.

## Provider credentials (owner configuration required)

Create an OAuth Web application in Google Auth Platform and an OAuth app in GitHub Developer Settings. Each requires its own Client ID and Client Secret. Store secrets only in Supabase provider settings, never in source code, browser configuration, or chat.

Use these exact URLs:

- Homepage / Google authorized JavaScript origin: https://inkrya.vercel.app
- Provider authorization callback URL (Google and GitHub): https://ecurjotykfqiejrpczdm.supabase.co/auth/v1/callback
- Supabase Auth Site URL: https://inkrya.vercel.app/
- Supabase redirect allowlist: https://inkrya.vercel.app/

In Supabase Authentication → Sign In / Providers, enable Google and GitHub with their respective credentials. No change to email confirmation or RLS is required.

Google: configure consent branding/audience and email/profile/openid scopes; if testing mode, add intended test users. GitHub: only basic user/email scopes; repository permissions are not requested.

The UI checks /api/auth/providers without caching. After enabling a provider, reload Inkrya to enable its button. Supabase JS handles the existing browser-based implicit session callback at the root route. This app does not yet use cookie-based SSR auth.

## Original signup error: unresolved diagnosis

Reported: Database error saving new user.

Verified: no noninternal Auth triggers; Auth tables owned by supabase_auth_admin and insert privileges present; standard user constraints; one existing unconfirmed user with identity and nonnull confirmation-token fields. No broad permission/schema change was made without evidence.

User supplied Auth log: SQLSTATE 23505 on users_email_partial_key during POST /signup; SQLSTATE 25P02 is the secondary aborted transaction error. The email was already present. Existing account has a password, email identity and unconfirmed email; instance_id is the normal zero UUID. Why the Auth service attempted a duplicate insertion is not established.

Added explicit confirmation-email resend through auth.resend(type=signup), a 60-second UI cooldown and generic recovery guidance on signup failures. No emails sent by the agent, no users deleted or manually confirmed, and no unique constraints removed. Delivery and completion still require the user's mailbox and correct Supabase redirect settings. The log referer is localhost:3000; verify dashboard Site URL rather than assuming that field alone proves a configuration error.

## Verification remaining

- Complete Google and GitHub sign-in with an authorized real user after credentials are configured.
- Verify callback returns to Inkrya and session persists after refresh/logout.
- Confirm signup error root cause from Auth logs and fix/test separately.

References:
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/auth/social-login/auth-github
- https://supabase.com/docs/guides/troubleshooting/database-error-saving-new-user-RU_EwB
