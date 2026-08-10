# ADR 0008: Transport execution boundaries

- Status: Accepted
- Date: 2026-08-10

## Context

The seller transport combined origin selection, session loading, request pacing,
timeouts, retries, body-size enforcement, authentication notification, response
decoding, document validation, and mutation-specific ambiguity handling in one
module. Those concerns share a security boundary but change for different
reasons.

## Decision

- Keep `SellerApiTransport` as the internal capability-facing transport
  contract.
- Move generic HTTP execution into one `SellerHttpTransport`: the fixed
  TCGplayer origin allowlist, session validation, cookie/header construction,
  start pacing, timeout and abort handling, bounded safe retries, response-size
  limits, redirect handling, status mapping, and authentication notification.
- Keep endpoint/media adapters in `SellerApiTransport`: JSON variants, legacy
  HTML, PDF and CSV validation, message commands, form mutations, and
  mutation-response ambiguity classification.
- Inject exactly one HTTP executor into the response adapter. Do not expose a
  raw URL or arbitrary-origin request method to package consumers.
- Preserve retry policy at the request specification. Read and idempotent
  operations may use bounded retry; non-idempotent mutations continue to use
  `never` and convert uncertain outcomes into `AMBIGUOUS_RESULT`.
- Keep both modules internal to the single root package export.

## Consequences

Origin and credential safety can be reviewed independently from provider payload
decoding. New endpoint adapters reuse the same pacing, session, and size limits,
while changes to response formats no longer require editing the low-level
request loop. The split does not create another public entry point or permit
caller-selected origins.
