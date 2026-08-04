# Changelog

All notable changes to this package will be documented here.

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
