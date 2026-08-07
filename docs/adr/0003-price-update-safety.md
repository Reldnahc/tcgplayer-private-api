# ADR 0003: Price-update safety

- Status: Accepted
- Date: 2026-08-03

## Context

Seller Portal's pricing save request combines price fields with inventory state. A client that submits only a SKU and price could unintentionally clear or alter quantity. The private interface also provides no idempotency key, so a lost mutation response cannot prove whether the request was accepted.

## Decision

- Expose one capability method, `updateSellerPrices`, instead of a raw inventory endpoint.
- Require the complete observed listing identity plus current quantity and reserve quantity.
- Fix `AddToQuantity` and `ExistingQuantity` at zero; do not expose quantity mutation through this method.
- Validate identifiers, bounds, cent precision, batch size, and unique product-condition/channel pairs before any request begins.
- Submit the observed jQuery-compatible form encoding only to the fixed Seller Portal origin.
- Never automatically retry. Treat timeouts, lost responses, aborts after submission begins, and server errors as `AMBIGUOUS_RESULT`.
- Cover the request contract with synthetic tests only. A live price change requires a deliberately selected listing and operator supervision.

## Consequences

Consumers must obtain fresh listing state before queuing a change and must reconcile ambiguous results in Seller Portal. Background queues can pace definite, independent updates, but must stop an ambiguous job for review instead of blindly resubmitting it.
