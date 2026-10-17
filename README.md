# TradeShark - Multi-asset trading platform

React + Vite frontend served by an Express API (Node 20). Real accounts, sessions, KYC uploads, deposits/withdrawals with admin approval, trading with live-simulated prices, CopyTrader, admin back office and transactional email.

## Deploy on Railway

1. Push this folder to GitHub and create a new Railway project from the repo.
2. In the project, **+ New -> Database -> PostgreSQL**.
3. On the app service -> **Variables**, add at least:
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   JWT_SECRET=<openssl rand -hex 32>
   ADMIN_PASSWORD=<strong password>
   ADMIN_EMAIL=you@yourdomain.com
   RESEND_API_KEY=<from resend.com/api-keys - "Full access" so the site can read your verified domains>
   SUPPORT_EMAIL=support@yourdomain.com
   ```
   Full list in `.env.example`. Everything else (brand name, address, socials, bank/crypto details, AI key...) is in `.env.example`.
4. **Settings -> Networking -> Generate Domain** (or add your custom domain and set `APP_URL=https://yourdomain.com`).
5. Deploy. Health check: `/api/health`. Build/start commands are in `railway.json`.

Admin console: `https://yourdomain/admin` (username `admin` unless you changed `ADMIN_USERNAME`).
Client portal: `https://yourdomain/dashboard`.

> Railway blocks outbound SMTP on the Trial plan - use `RESEND_API_KEY` there. SMTP works on Hobby/Pro.
> Without any email provider, emails are written to the deploy logs (useful for testing).

## Client login security

- **Email code (OTP)** on every client sign-in: 6 digits, valid 10 min, 5 tries, resend after 60s (`LOGIN_OTP=false` to turn off).
- **Lockout** after 5 wrong passwords for 15 min (client is emailed).
- **Sessions are revoked** on password change/reset; admins can sign a client out of all devices (`POST /api/admin/users/:id/revoke-sessions`).
- No email provider configured → codes are printed to the Railway deploy logs, so set one before going live.
- Admin -> Emails shows the live provider and has a **Send test** button that returns the real error if delivery fails.

## CopyTrader

Popular Investors are stored in the database and managed in **Admin -> CopyTrader & Investors** (add, edit, hide, delete, set a daily performance %).
Each investor's performance moves every 10 seconds; every copier's portfolio value follows it. Copier counts = base number + real active copies.
Admins can set a copy's P&L % or add/subtract cash, and close a copy. Copy stop-loss closes a copy automatically.

## Local development

```bash
npm install
cp .env.example .env        # fill what you need; SEED_DEMO_DATA=true ENABLE_DEMO_LOGINS=true is handy locally
npm run dev:api             # API on :3000 (terminal 1)
npm run dev                 # Vite on :5173 with /api proxied (terminal 2)
```
Production-style run: `npm run build && npm start` -> http://localhost:3000

## What sends email

| Event | To |
|---|---|
| Registration (welcome + verify email link) | client (+ admin alert) |
| Forgot / reset / changed password | client |
| Admin-created account (set-password link) | client |
| KYC submitted / approved / rejected / resubmit requested | client (+ admin alert on submit) |
| Deposit request (with payment instructions) / credited / rejected | client (+ admin alert) |
| Withdrawal request / released / rejected | client (+ admin alert) |
| Balance credit / debit / bonus | client |
| Trade executed / position closed, CopyTrader start/stop | client |
| Status, tier or leverage changed by admin | client |
| Admin compose, reply, broadcast | client(s) |
| Client "Contact broker desk" message | admin |
| Website forms (contact, careers, press, affiliates, pro, club, newsletter) | admin + auto-reply |

Every client email is also stored in the client's portal inbox; delivery status shows in Admin -> Emails -> Outbox.

## Routes

`/markets`, `/markets/:category`, `/popular-investors`, `/fees`, `/copytrader`, `/shark-ai`, `/about`, `/help`, `/careers`, `/press`,
`/regulation`, `/risk-disclosure`, `/privacy`, `/terms`, `/cookies`, `/affiliates`, `/invite-a-friend` and ~30 more
(content lives in `src/data/pages.ts`; brand/contact placeholders are filled from env vars). `/sitemap.xml` and `/robots.txt` are generated.

## Admin roles

- **Super-Admin** (`ADMIN_USERNAME`/`ADMIN_PASSWORD`) - everything.
- **compliance** (`COMPLIANCE_PASSWORD`) - KYC, AML, account status, emails.
- **treasury** (`TREASURY_PASSWORD`) - funding approvals, balance adjustments, payment settings, emails.

## Storage

With `DATABASE_URL` all data (and KYC files) are stored in Postgres (tables `app_documents`, `app_files`, created automatically).
Without it, data goes to `DATA_DIR` - attach a Railway volume or it resets on each deploy.
