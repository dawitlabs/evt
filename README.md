# evt

Private events for your people — invites, RSVPs, and tickets in one place. Guests sign in with
Telegram, RSVP (with a waitlist when an event fills up), and get a QR ticket that hosts scan at the
door. Event details are encrypted at rest with a server-held key.

## Stack

SvelteKit 2 (Svelte 5 runes) · Tailwind 4 · Drizzle + Neon Postgres · Telegram bot auth (grammy) ·
PartyKit for live attendee counts · deployed on Vercel.

## Setup

```sh
pnpm install
cp .env.example .env   # then fill in every value
pnpm db:push
pnpm dev
```

Environment variables (see `.env.example`):

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_BOT_USERNAME` / `TELEGRAM_WEBHOOK_SECRET` | Login bot and webhook |
| `PARTYKIT_HOST` / `PUBLIC_PARTYKIT_HOST` | Live attendee counts |
| `TICKET_SIGNING_SECRET` | HMAC key for ticket QR tokens — `openssl rand -hex 32` |
| `EVENT_DATA_KEY` | AES-256-GCM key for event data at rest — `openssl rand -base64 32` |

Rotating `EVENT_DATA_KEY` makes existing event data unreadable; there is no re-encryption path yet.

## Checks

```sh
pnpm check   # svelte-check, TypeScript strict
pnpm test    # vitest
```
