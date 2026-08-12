# Changelog

All notable changes to this package will be documented here.

## 0.17.0 - Unreleased

- Preserve validated, provider-supplied card types on marketplace-product
  batches so consumers can distinguish lands from other colorless products.

## 0.16.0 - Unreleased

- Add validated, batched exact-SKU market-price reads so consumers can price
  the precise condition, printing, and language represented by a
  ProductConditionId.

## 0.15.0 - Unreleased

- Preserve each validated order-number and quantity allocation on typed
  pull-sheet rows so consumers can track per-order picking progress without
  reparsing provider CSV.

## 0.14.1 - Unreleased

- Accept TCGplayer's per-order pull-sheet allocation format, sum each product
  row's requested quantity, and omit the trailing order-summary record from
  typed rows.
- Adopt the MIT License and declare public npm registry access for future
  publication.

## 0.14.0 - Unreleased

- Preserve validated, provider-supplied card colors on catalog summaries,
  product details, and marketplace-product batches when a product line exposes
  them; omit the optional field when no color metadata exists.

## 0.13.0 - Unreleased

- Parse validated pull-sheet CSV into typed product rows while preserving the
  original in-memory document text for existing consumers.
- Reject malformed quoting, unexpected columns, invalid quantities, oversized
  rows, and unsafe field content before returning pull-sheet data.

## 0.12.0 - Unreleased

- Add validated refund-option discovery and explicit full- and partial-order
  refund methods.
- Derive refund capabilities from TCGplayer's exact allowed actions, confirm
  seller ownership immediately before submission, and bound partial refunds
  against the confirmed order and its prior refunds.
- Never retry refund mutations; report an uncertain remote result as
  `AMBIGUOUS_RESULT` so consumers must reconcile before taking another action.

## 0.11.0 - Unreleased

- Add explicit seller-message thread mark-read and reply methods.
- Retry only the idempotent mark-read operation; never retry a reply whose
  remote result may be ambiguous.
- Validate and bound reply text without logging or persisting message content.

## 0.10.0 - Unreleased

- Add an optional authentication-required observer so applications can expire a
  shared credential, pause work, and request an operator-owned browser renewal.
- Keep observer failures isolated from the original typed authentication error.

## 0.9.0 - Unreleased

- Add a read-only authenticated-seller identity method so consumers can validate a session and discover its seller key without prior account configuration.

## 0.8.2 - Unreleased

- Preserve legacy upcoming-payment rows that TCGplayer labels `Not Scheduled` and represent their unavailable dates as `null`.

## 0.8.1 - Unreleased

- Accept message conversations without linked order metadata and normalize their nullable order fields to empty strings.

## 0.8.0 - Unreleased

- Add validated, paginated read-only seller message inbox and thread-detail retrieval.
- Add the authenticated seller's unread-message count for application notification badges.
- Keep replies, read-state changes, deletion, resolution, and escalation outside the public contract.

## 0.7.2 - Unreleased

- Report validated seller-inventory page and product counts through an optional progress callback without adding marketplace requests.

## 0.7.1 - Unreleased

- Retry a read-only legacy payment table once when a successful HTML response fails runtime validation, while preserving explicit failure for repeated malformed responses.

## 0.7.0 - Unreleased

- Add validated, paginated read-only seller feedback with rating, comment-only, and age filters.
- Add aggregate star and fulfillment-question rating summaries.
- Accept feedback rows that omit optional fulfillment-question answers.
- Omit provider user keys and seller-order identifiers, and never send the seller-session cookie to the public feedback service.

## 0.6.1 - Unreleased

- Detect whether the authenticated seller uses TCGplayer's legacy Payments experience or the newer Money Movement experience.
- Add validated, paginated legacy past-payment summaries and upcoming estimated payments.
- Ignore the legacy table's aggregate totals row instead of treating it as a payment record.
- Keep both payment experiences read-only and omit payment instruments, bank details, and mutation capabilities.

## 0.6.0 - Unreleased

- Add validated, paginated read-only seller payout history from TCGplayer's Money Movement interface.
- Add read-only payout details with normalized order, refund, and adjustment transactions.
- Add the current unpaid balance and pending transactions while deliberately omitting payment-instrument and bank-account data.
- Keep payout approval, rejection, retry, payment setup, and every other payment mutation outside the public client contract.

## 0.5.4 - Unreleased

- Add a validated, paginated per-product marketplace-listings search with explicit condition, printing, language, channel, listing-type, and price-sort controls.
- Preserve TCGplayer's exact filtered listing count separately from the bounded page of returned listing records.

## 0.5.3 - Unreleased

- Add normalized order-status codes for search summaries and order details while preserving TCGplayer's raw display labels.
- Map unrecognized provider status labels to an explicit `Unknown` enum value instead of requiring consumers to compare display text.

## 0.5.2 - Unreleased

- Preserve validated Direct product, seller, Authentication Center inventory, listing-type, and seller-program evidence from marketplace responses.
- Send explicit U.S. buyer context with marketplace searches so ranking and shipping values match the buyer-facing marketplace context more closely.

## 0.5.1 - Unreleased

- Preserve the marketplace response's optional `directListing` eligibility flag. Consumers must not infer customer-visible Direct eligibility from `channelId` alone.

## 0.5.0 - Unreleased

- Add an explicit exact-SKU inventory-removal method that clears a freshly observed, unreserved live quantity without weakening price-only or positive-addition contracts.

## 0.4.7 - Unreleased

- Expose validated product-line facets alongside set facets in catalog search results.

## 0.4.6 - Unreleased

- Send catalog search text through TCGplayer's marketplace `q` parameter so numbered and artwork-specific name variants remain discoverable.
- Expose validated set facets and optional set/product-type filters for bounded catalog searches.

## 0.4.5 - Unreleased

- Accept the non-sequential condition identifiers returned by live TCGplayer listings when submitting price and inventory updates.

## 0.4.4 - Unreleased

- Optionally enrich catalog searches with English Near Mint Foil market prices through one batched SKU price-point request per search page.

## 0.4.3 - Unreleased

- Restore catalog name filtering after TCGplayer moved product-name searches to the term-filter array contract.

## 0.4.2 - Unreleased

- Correct positive inventory additions to submit Seller Portal's absolute post-add quantity alongside the relative add quantity.
- Preserve the existing absolute quantity for price-only updates.

## 0.4.1 - Unreleased

- Rank catalog search results by normalized name likeness, with exact-name matches first.
- Include a public TCGplayer product-image URL on catalog summaries and product details.

## 0.4.0 - Unreleased

- Add validated marketplace catalog search and exact product SKU discovery by condition, printing, and language.
- Add positive live-inventory additions that submit a relative quantity and initial price together without weakening the price-only mutation contract.
- Keep inventory additions non-retrying so uncertain results require reconciliation before another submission.

## 0.3.1 - Unreleased

- Submit live price updates through the bulk Pricing page route with its required pricing-type and live-inventory fields.
- Correct the earlier product-detail route mismatch that caused definite HTTP rejections for repricing jobs.

## 0.3.0 - Unreleased

- Add validated, paginated seller-inventory reads through `listSellerInventory`.
- Add product, condition, printing, and language marketplace comparison searches through `searchMarketplaceProducts`.
- Keep pricing policy outside the transport package so applications can implement their own repricing rules.

## 0.2.0 - Unreleased

- Add validated price-only Seller Portal listing updates through `updateSellerPrices`.
- Preserve quantity and reserve quantity in the observed update contract and reject duplicate listing/channel pairs.
- Keep price mutations non-retrying and report uncertain outcomes as `AMBIGUOUS_RESULT`.

## 0.1.0 - Unreleased

- Establish the independently implemented seller-fulfillment client.
- Support order search, order detail retrieval, exact-order confirmation, packing-slip PDF export, pull-sheet CSV export, and carrier detection.
- Support seller-scoped tracking submission, shipment without tracking, and bulk mark-shipped operations with preflight reconciliation and no automatic mutation retries.
- Report uncertain mutation outcomes as `AMBIGUOUS_RESULT` so consumers reconcile remote state before retrying.
- Match the live structured tracking-number response and signed PDF octet-stream response observed during the August 2026 compatibility check.
- Publish dual ESM/CommonJS output with TypeScript declarations.
