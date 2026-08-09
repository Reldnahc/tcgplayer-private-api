# ADR 0005: Seller-message mutation safety

## Status

Accepted.

## Context

The package already exposes authenticated, seller-scoped inbox and thread
reads. Applications now need explicit mark-read and reply actions without
exposing raw Seller Portal routes or weakening the package's mutation safety.
A reply may be accepted even when its response is lost, so automatic retries
could send duplicate buyer messages.

## Decision

Expose `markSellerMessageThreadRead` and `replyToSellerMessageThread` as narrow
client methods. Both require a validated seller key and positive thread ID.
Replies additionally require 1–10,000 characters of text and allow ordinary
line breaks and tabs while rejecting other control characters.

Mark-read is an idempotent state assignment and may use the configured bounded
safe retry policy. Reply submission is never retried. A timeout, caller abort,
or network loss during a reply returns `AMBIGUOUS_RESULT`; consumers must
refresh the thread before deciding whether another reply is appropriate.

Treat any successful HTTP response as command acceptance without exposing an
unvalidated response body. Keep message text out of errors, logs, and durable
package state. Do not add mark-unread, message deletion, resolution,
escalation, or per-message state changes under this decision.

## Consequences

- Consumers can mark a conversation read and reply without raw endpoint access.
- Duplicate automatic replies remain prohibited.
- Contract tests use synthetic bodies and transport doubles; ordinary tests do
  not change a real conversation.
