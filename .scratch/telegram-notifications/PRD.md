# PRD: Telegram Notifications for Event Lifecycle

Status: ready-for-agent

## Problem Statement

Organizers and attendees currently have no way of knowing that something happened on an event unless they reopen the app and check. Three moments go silent today:

- A manager invites an existing user to an event — the invitee isn't told anything happened.
- Someone on the waitlist gets promoted to "going" when a spot opens up — they find out only if they happen to check back.
- A manager invites someone who hasn't signed up yet (a pending invite, matched by Telegram username). Once that person finally completes signup, the manager who invited them has no signal that the person is now real and needs to be granted event access (their event key wrapped and added).

Since the whole app is Telegram-auth-based, users already have a live channel — the bot conversation — for these updates. Right now it's only used for login.

## Solution

Extend the existing Telegram bot (already used for `/start` login verification) to also push a message for each of the three moments above:

1. When a manager adds an existing user directly to an event, the new member gets a Telegram message with a link to the event.
2. When an event opens a spot and someone is auto-promoted off the waitlist, that person gets a Telegram message telling them they're going, with a link to the event.
3. When a user completes signup (sets up their encryption keys) and their Telegram username matches one or more pending invites, each inviter gets a Telegram message prompting them to grant the new member access.

All three routes send through one shared helper rather than each hand-rolling a `fetch` call to the Telegram Bot API, matching the pattern already used for the login webhook's reply message.

## User Stories

1. As an event manager, I want the person I just added to an event to be notified on Telegram, so that they know to check the app without me telling them separately.
2. As an event manager, I want to know when someone I invited (via `pendingInvites`) has completed signup, so that I remember to wrap and grant them their event key.
3. As an attendee on the waitlist, I want to be told on Telegram the moment I'm promoted to "going", so that I don't miss the event by not checking back.
4. As an attendee who just got promoted off the waitlist, I want the notification to link straight to the event, so that I don't have to hunt for it in the app.
5. As a newly added member, I want the notification to link straight to the event, so that I can jump right in.
6. As a manager, I want the "someone you invited signed up" notification to link to the event so I can go grant access in one tap.
7. As a user, I want notifications to keep arriving in the same Telegram chat I already use to log in, so that I don't need a separate channel or app permission.
8. As a developer, I want all outbound Telegram messages to go through one function, so that retry/logging/error-handling behavior is consistent and only lives in one place.
9. As a developer, I want a Telegram delivery failure (bad chat id, bot blocked by user, API downtime) to never fail the underlying request (invite, RSVP, signup), so that a notification problem never blocks the actual feature.
10. As a developer, I want delivery failures logged server-side without leaking any PII (no usernames, no message text) into logs, so that we stay compliant with the project's logging rules.
11. As an event manager, I want a pending invite that matches multiple past invites (e.g. re-invited to two different events before signing up) to notify each of those inviters separately, so that no invite silently goes unnoticed.
12. As a user without a Telegram username set, I want the signup flow to simply skip the pending-invite lookup (not error), so that signup still completes normally.
13. As a developer, I want the notification sends to not block the HTTP response any longer than necessary, so that invite/RSVP/signup latency isn't meaningfully worse than before this feature.

## Implementation Decisions

- **Shared seam**: a single `sendTelegramMessage(chatId, text)` function is the one integration point with the Telegram Bot API for all outbound messages (login-verification replies, invite-added, waitlist-promotion, signup-notifies-inviter). No route hand-rolls its own `fetch` to `api.telegram.org`.
- **Failure isolation**: `sendTelegramMessage` swallows its own errors (network failure, non-2xx response) and logs server-side; it never throws into the calling route. A Telegram outage must not turn an invite, RSVP, or signup into a 500.
- **Invite-added notification**: fires only on the "existing user" branch of the invite flow (i.e., the invitee already has a `publicKey` and is added directly to `eventsKeys`). The "pending invite" branch (user doesn't exist yet) does not notify anyone at invite time — there's no one to notify yet.
- **Waitlist-promotion notification**: fires from the existing `promoteFromWaitlist` step, only when a waitlisted RSVP is actually promoted to `going`. No message is sent if there was no one on the waitlist to promote.
- **Signup-notifies-inviter**: on completing key setup (`setup-keys`), if the user has a `username`, normalize it (existing `normalizeTelegramUsername`) and look up all matching rows in `pendingInvites` (case-insensitive match, same normalization used at invite time). For each match, resolve the inviter's `telegramId` and send them a notification. Multiple matches (invited to multiple events before signup) each get their own message.
- **Message content**: each message includes a direct link to the relevant event, built from the request's `url.origin` plus `/events/<eventId>`, matching the existing pattern in the invite/RSVP routes.
- **No new schema**: this feature reads existing tables (`users`, `pendingInvites`, `eventsKeys`, `rsvps`) and adds no columns or tables. `telegramId` is already the durable per-user chat identifier used for delivery.
- **No new dependency**: messages go directly to the Telegram Bot API via `fetch`, consistent with the existing login-webhook implementation. No Telegram SDK is introduced.
- **Concurrency**: the signup-notifies-inviter path notifies all matched inviters in parallel (`Promise.all`), not a sequential loop, per the project's async standards.

## Testing Decisions

- Tests operate at the **route-handler seam**: call the `POST` handler for each of the four affected routes (`invites`, `rsvp`, `setup-keys`, `auth/telegram/webhook`) directly, with `sendTelegramMessage` mocked/spied — not by mocking `fetch` or asserting on Telegram API request bodies. This is the seam confirmed with the developer.
- A good test here asserts observable behavior: was `sendTelegramMessage` called, with which chat id and event link, given a specific DB/request state — not the internal control flow used to get there.
- Modules to test:
  - `POST /api/events/[id]/invites` — notifies the invitee when added directly; does not notify anyone on the pending-invite branch.
  - `POST /api/events/[id]/rsvp` — notifies the promoted user when a waitlist promotion happens; does not send a message when there was nobody to promote.
  - `POST /api/setup-keys` — notifies each matching inviter when the signing-up user's normalized username matches one or more `pendingInvites` rows; sends nothing when the user has no username or no matches exist.
  - `POST /auth/telegram/webhook` — continues to reply via the shared helper for both the "invalid/expired token" and "verified" cases (regression coverage for the refactor away from the route-local `replyToChat`).
- A Telegram delivery failure (mock `sendTelegramMessage` to reject or the underlying `fetch` to fail) must not cause the route to return an error response — the core action (invite recorded, RSVP updated, keys saved) still succeeds and the route still returns its normal success payload.
- Prior art: no existing route-handler tests exist in this repo yet (only `src/lib/vitest-examples/*.spec.ts`, which are unrelated example specs). This PRD's tests are the first real coverage for `+server.ts` route handlers — use Vitest, matching the project's existing test runner.

## Out of Scope

- Notifying managers when a *new* pending invite is created (only signup-time notification is in scope).
- Any in-app notification center, email, or push notification channel — Telegram only.
- User-configurable notification preferences (opt-out, digest, quiet hours).
- Retry/queueing for failed Telegram sends — a failure is logged and dropped, not retried.
- Notifying the manager who removed/declined an RSVP, or any other event-membership change not already listed above.
- Rate limiting or batching outbound Telegram messages.
- Internationalizing notification text (bilingual EN/Amharic support) — messages ship in English only for this PRD.

## Further Notes

- This closes out the in-progress uncommitted work already present in the working tree (`src/lib/server/telegram/bot.ts` plus the four modified routes) — the PRD describes what that diff implements, it is not new work to design from scratch.
- No `CONTEXT.md` exists yet for this repo; this PRD uses the vocabulary already established in the schema and route code (`pendingInvites`, `eventsKeys`, `rsvps.status` of `going`/`waitlisted`, `isManager`, `getEventMembership`). If `/domain-modeling` is run later, these terms are candidates for the glossary.
