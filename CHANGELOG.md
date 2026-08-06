# Changelog

All notable changes to this package will be documented here.

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
