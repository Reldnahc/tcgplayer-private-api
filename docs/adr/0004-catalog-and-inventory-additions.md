# ADR 0004: Catalog discovery and positive inventory additions

- Status: Accepted
- Date: 2026-08-04

## Context

An application cannot safely list a card from its name and condition alone. It must identify the exact TCGplayer product and the SKU representing condition, printing, and language. The Seller Portal inventory request also combines a relative quantity change with current quantity, price, channel, and reserve state, and it provides no idempotency key.

## Decision

- Expose `searchCatalogProducts` and `getCatalogProduct` as validated capability methods instead of raw marketplace URLs.
- Use the marketplace text-query contract and expose set facets plus optional set/product-type filters so consumers can narrow large name families without exhaustively paging them.
- Allow catalog callers to opt into English Near Mint Foil market-price enrichment. Filter the search response's embedded listings to identify matching SKUs and request all price points in one batch, avoiding per-product reads.
- Normalize only TCGplayer's published condition IDs and fail safely on an unknown condition.
- Keep `updateSellerPrices` quantity-neutral and expose positive quantity changes only through the separate `addSellerInventory` method.
- Require a positive relative quantity, freshly observed current quantity, complete SKU identity, initial price, channel, and reserve state.
- Submit the relative quantity, absolute post-add quantity, and price in one live-inventory request. Seller Portal computes that absolute quantity as current quantity plus the relative addition.
- Validate the entire batch before submission, allow at most 100 unique SKU/channel pairs, and never retry automatically.
- Treat timeouts, disconnects, server errors, and aborts after submission begins as `AMBIGUOUS_RESULT`.
- Cover catalog reads and inventory additions with sanitized synthetic contract tests. Live additions require a deliberately selected card and operator supervision.

## Consequences

Consumers own product-selection UX, pricing policy, durable queues, preflight seller-inventory reads, and post-submission reconciliation. Foil price enrichment is optional because it adds one safe marketplace request per catalog page, and products without a live English Near Mint Foil listing have no enriched price. A consumer must stop for review when current inventory differs from its queued expectation or when submission outcome is ambiguous.
