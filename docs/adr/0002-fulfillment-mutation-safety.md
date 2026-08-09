# ADR 0002: Fulfillment mutation safety

- Status: Accepted
- Date: 2026-08-03

## Context

Fulfillment automation needs to add tracking and mark seller orders shipped. These private operations are not idempotent by a documented contract, and a timeout or lost response can leave the caller unable to know whether TCGplayer applied the action.

## Decision

- Add capability-oriented methods for tracking submission, shipment without tracking, and bulk shipment status updates.
- Require a seller key and exact order number for every mutation, then confirm each order through seller-scoped search and detail retrieval before sending it.
- Treat a matching existing tracking number or an already shipped/delivered status as an already-applied success without sending another mutation.
- Never automatically retry a mutation, even when read-only retry settings are enabled.
- Return `AMBIGUOUS_RESULT` for timeouts, connection loss, server errors, or unsupported success responses after a mutation may have been accepted. Consumers must reconcile current order state before manually retrying.
- Keep live compatibility checks read-only by default. A real mutation requires a separately chosen order and deliberate operator action outside automated CI.
- Keep postage purchasing and cancellations outside the authorized package
  surface. Refunds follow the separately reviewed financial safeguards in ADR
  0006; inventory, pricing, and messaging follow their own later decisions.

## Consequences

Consumers can automate the intended fulfillment workflow without gaining a raw private-API escape hatch. Preflight confirmation adds requests and cannot eliminate every race, but it prevents common duplicates and cross-seller mistakes. Ambiguous outcomes require an explicit reconciliation step instead of unsafe automatic recovery.
