# ADR 0004: Catalog discovery and explicit inventory quantity changes

- Status: Accepted
- Date: 2026-08-04

## Context

An application cannot safely list a card from its name and condition alone. It must identify the exact TCGplayer product and the SKU representing condition, printing, and language. The Seller Portal inventory request also combines a relative quantity change with current quantity, price, channel, and reserve state, and it provides no idempotency key.

## Decision

- Expose `searchCatalogProducts` and `getCatalogProduct` as validated capability methods instead of raw marketplace URLs.
- Use the marketplace text-query contract and expose product-line and set facets plus optional set/product-type filters so consumers can narrow large name families without exhaustively paging them.
- Allow catalog callers to opt into English Near Mint Foil market-price enrichment. Filter the search response's embedded listings to identify matching SKUs and request all price points in one batch, avoiding per-product reads.
- Expose the same validated read as `getSkuMarketPrices` for batches of up to 24 exact ProductConditionIds so pricing consumers do not substitute a product-level or different-variant market value.
- Normalize only TCGplayer's published condition IDs and fail safely on an unknown condition.
- Keep `updateSellerPrices` quantity-neutral and expose positive quantity changes only through the separate `addSellerInventory` method.
- Require a positive relative quantity, freshly observed current quantity, complete SKU identity, initial price, channel, and reserve state.
- Submit the relative quantity, absolute post-add quantity, and price in one live-inventory request. Seller Portal computes that absolute quantity as current quantity plus the relative addition.
- Expose exact-SKU removal separately through `removeSellerInventory`. Require a freshly observed positive quantity and zero reserve quantity, preserve the listing identity and price, and submit an absolute quantity of zero with no relative addition.
- Validate the entire batch before submission, allow at most 100 unique SKU/channel pairs, and never retry automatically.
- Treat timeouts, disconnects, server errors, and aborts after submission begins as `AMBIGUOUS_RESULT`.
- Cover catalog reads, additions, and removals with sanitized synthetic contract tests. Live quantity mutations require a deliberately selected card and operator supervision.

## Consequences

Consumers own product-selection UX, pricing policy, durable queues, preflight seller-inventory reads, and post-submission reconciliation. Foil price enrichment is optional because it adds one safe marketplace request per catalog page, and products without a live English Near Mint Foil listing have no enriched price. A consumer must stop for review when current inventory differs from its queued expectation, reserve inventory is present during removal, or a submission outcome is ambiguous.
