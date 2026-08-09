# ADR 0006: Order refund mutation safety

- Status: Accepted
- Date: 2026-08-09

## Context

An operator needs full and partial refunds from an order workspace. Refunds
move money, can notify the buyer, and do not have a documented idempotency key.
A stale order, duplicate submission, or lost response therefore has a larger
impact than a read-only order request.

## Decision

- Expose option discovery plus separate full- and partial-refund methods; do
  not expose a raw endpoint or a generic money-movement command.
- Require the seller key and exact order number, then freshly confirm seller
  ownership, order detail, and the provider's exact refund capability before
  each submission.
- For partial refunds, derive provider line identifiers from the confirmed
  order and reject amounts above the remaining product or shipping value after
  prior refunds. Require cent-precision values and a non-zero total.
- Leave selection, review, and mandatory operator confirmation to the consumer.
  The package never schedules, automates, or chooses a refund.
- Never retry a refund submission. Timeouts, disconnects, server errors, and
  aborts after submission may have begun return `AMBIGUOUS_RESULT`; the caller
  must reconcile the order in TCGplayer before any further refund.
- Use synthetic contract tests only. A live refund requires a separately
  selected real order and deliberate operator action outside CI.

## Consequences

The reusable client can support a narrow reviewed refund experience without
becoming a general payment API. Fresh confirmation adds two reads immediately
before each mutation. The race cannot be eliminated without a provider
idempotency contract, so an uncertain result deliberately blocks automatic
recovery.
