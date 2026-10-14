
# Envara ✉️

A calmer, more thoughtfully designed email experience. A responsive Vite app with a working **local demo** and a secure Supabase + Resend integration **when configured**.

> **Status:** UI and local demo work without accounts or keys. Supabase auth and data need a dedicated project. Real outgoing and incoming internet email require a verified provider, routing, and secrets. This repository does NOT connect an existing Gmail or Outlook inbox.

## Features

- Redesigned three-panel desktop workspace and focused mobile reader
- Light, dark, and system themes; compact or comfortable message density
- Inbox, starred, all mail, sent, drafts, archive, spam, and trash
- Search, unread counts, starred/unread filters, select-all and bulk actions
- Compose, draft editing, reply, forward, archive, restore, and delete
- Keyboard: **C** compose, **/** search, **J/K** next/previous, **E** archive, **?** help, **Esc** close
- Persistent local demo with clearly simulated sending
- Optional email/password authentication and Supabase per-user row-level security
- Optional server-side Resend sending with an explicit approved-user list and basic quota
- Optional signed Resend inbound webhook and per-address mailbox routing
- Automated unit tests and GitHub CI

## Local demo

Requires Node.js 20.19+ or 22.12+ (Vite 8).

    npm install
    npm run dev

With no environment variables, Envara launches in Demo mode. The demo does not send or receive real internet email. Run **npm test** for pure-mail tests and **npm run build** for the production build.

## Connect a Supabase database

1. Create a **new, dedicated Supabase project for Envara**. Do not reuse the existing project of another application.
2. In its SQL Editor, inspect and run **supabase/schema.sql**.
3. Enable email login in Supabase Auth. Set your production/site URL and permitted redirect URLs.
4. Copy **.env.example** to **.env** and fill in VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY from the new project's browser-safe settings.
5. Start the app and create/confirm a user. You can now save private drafts and use the mailbox UI against Supabase.

**Migration warning:** the schema enforces ownership on the messages table and removes old policies. Legacy messages without an owner become inaccessible. Verify ownership before any manual data migration. Do not run this SQL on a shared database.

## Sending real email with Resend

Envara never accepts an arbitrary sender address from the browser.

1. Verify a sending domain at https://resend.com/domains and create an API key.
2. In **Supabase project secrets** set:
   - RESEND_API_KEY: your server-only email provider API key
   - ENVARA_FROM_ADDRESS: a verified sender, such as Envara <hello@mail.example.com>
   - ENVARA_ALLOWED_EMAILS: comma-separated Supabase **login** addresses permitted to send
3. Deploy the Supabase Edge Function from **supabase/functions/send-email/index.ts**, named **send-email**, requiring an authenticated user JWT (see **supabase/config.toml**).
4. Test with an approved account. Then set **VITE_ENVARA_SEND_ENABLED=true** in the website environment and rebuild.

Before this is configured, pressing the send action saves a draft instead of pretending a message was sent. After enabling it, a success toast means the provider **accepted** delivery, not that the recipient necessarily received it.

Basic sending limits are 10 per hour and 40 per day per approved account. These are not atomic distributed limits. Keep your server-side allowlist and provider-side abuse protection enabled before production.

## Receiving real email with Resend

Resend can receive mail on its own incoming domain or a configured receiving domain. **Do not modify MX records on a domain already used for important email without understanding the consequences.** A separate subdomain is safer.

1. Set up receiving in your Resend dashboard.
2. After your Supabase user exists, insert an owner-approved mailbox mapping in the dedicated project's SQL Editor:

        insert into public.mailboxes (address, user_id)
        select 'hello@mail.example.com', id
        from auth.users
        where email = 'your-login@example.com'
        on conflict (address) do nothing;

3. Deploy the Edge Function in **supabase/functions/receive-email/index.ts**. In **supabase/config.toml**, receive-email must have verify_jwt=false: Resend does not have a Supabase JWT, so the handler verifies the **raw Svix cryptographic signature** instead.
4. Create a Resend webhook for event **email.received** pointing to:
   https://YOUR_PROJECT_REF.supabase.co/functions/v1/receive-email
5. Store its signing secret in Supabase project secrets as RESEND_WEBHOOK_SECRET. Test with a real message to the mapped address and refresh the Envara inbox.

Unknown recipient addresses are ignored. Incoming content is saved as text only: HTML rendering and attachments are not supported yet. This webhook is not yet a replacement for a professional email service's backup, spam filtering, and retention features.

## Architecture

- **src/main.js**: screens, app state, auth, message actions, sending
- **src/mail.js**: pure utility functions with unit tests
- **src/style.css**: responsive design system
- **supabase/schema.sql**: tables, indexes, owner-only RLS
- **supabase/functions/send-email**: authenticated, allowlisted sending
- **supabase/functions/receive-email**: signed webhooks mapped to inbox owners

There are two deliberately different modes:
- **Without Supabase variables:** localStorage sample data, demo-only send
- **With Supabase variables:** authenticated, RLS-protected database. Internet mail requires the additional steps above.

Never place service-role or Resend secrets in browser-exposed VITE_ variables. The UI treats email text as text and escapes it before display.

## Still to build

Rich threading, attachments, safe HTML email rendering, inbox imports via IMAP/Gmail/Outlook, full-text server search, unlimited pagination, real-time sync and production-grade abuse protection. These features are not claimed to exist.
