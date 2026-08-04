# Provenance

## Behavioral reference

- Repository: <https://github.com/todd-skelton/tcgplayer-automation-app>
- Inspected commit: `50c8d15008d0939bf50b80d93abbdacac5ebba6d`
- Inspection date: 2026-08-03
- License observed: none (no license/copying/notice file and no package license declaration at the inspected revision)

No source code from the reference repository is copied into this package. The implementation is independently written from the protocol facts listed below. Any future source reuse requires separately verified permission and an update to this document.

## Observed protocol facts

The inspected revision showed these seller behaviors:

- Origin: `https://order-management-api.tcgplayer.com`
- Authentication: a caller's authorized `TCGAuthTicket_Production` cookie value
- Search: `POST /orders/search?api-version=2.0`
- Detail: `GET /orders/{encodedOrderNumber}?api-version=2.0`
- Packing slips: `POST /orders/packing-slips/export?api-version=2.0`
- Pull sheets: `POST /orders/pull-sheets/export?api-version=2.0`
- Add tracking: `POST /orders/{encodedOrderNumber}/tracking?api-version=2.0` with `carrier` and `trackingNumber`
- Packing-slip response: PDF bytes
- Observed search range: `LastThreeMonths`
- Observed ready-to-ship filter: `ReadyToShip`
- Observed packing-slip format values: `ByRelease` and `Default`
- Marketplace search origin: `https://mp-search-api.tcgplayer.com`
- Marketplace search: `POST /v1/search/request`
- Marketplace product details: `GET /v2/product/{productId}/details`, including SKU, condition, printing variant, and language
- Seller inventory filter: live listings for channel `0`, scoped by `sellerKey`, with quantity at least one

The following files were consulted to identify those facts:

- `app/core/clients/baseDomainClient.server.ts`
- `app/core/clients/orderManagementApi.client.server.ts`
- `app/core/config/httpConfig.shared.ts`
- `app/integrations/tcgplayer/client/search-seller-orders.server.ts`
- `app/integrations/tcgplayer/client/get-seller-order.server.ts`
- `app/integrations/tcgplayer/client/export-packing-slips.server.ts`
- `app/integrations/tcgplayer/client/export-pull-sheet.server.ts`
- `app/integrations/tcgplayer/client/apply-order-tracking.server.ts`
- `app/integrations/tcgplayer/client/get-search-results.server.ts`
- `app/integrations/tcgplayer/client/get-product-details.server.ts`
- `app/features/seller-management/routes/api.seller-inventory.server.ts`

The current public Seller Portal orders bundle was also inspected on 2026-08-03 to confirm protocol shapes independently. It showed carrier detection at `POST /orders/detect-carrier?api-version=2.0`, shipment without tracking at `POST /orders/{encodedOrderNumber}/ship-no-tracking?api-version=2.0`, and bulk status updates at `POST /orders/status-updates?api-version=2.0` with the status `Shipped`. No mutation was sent during inspection.

A read-only marketplace compatibility observation on 2026-08-03 confirmed seller-key inventory filtering and product searches filtered by condition. Only schema and aggregate counts were inspected; listing identifiers, names, prices, and credentials were not retained.

The public Seller Portal pricing bundle (`/admin/scripts/pricing/main-built.31397.js`) was inspected on 2026-08-03 and rechecked on 2026-08-04 after definite request rejections exposed a route mismatch. The bulk Pricing page saves through `POST https://store.tcgplayer.com/admin/pricing/updateinventory`, with `type=Pricing` and `isStaged=false` for live inventory. Its submitted model includes product, condition, channel, relative add-to-quantity, current quantity, price, custom-price identifier, and reserve quantity fields. A separate product-detail screen uses `/admin/product/updateinventory`; it is not the contract implemented by this package. The package independently implements a price-only variant with `AddToQuantity` fixed at zero and a separate positive-addition variant that requires a fresh current quantity and an initial price. `ExistingQuantity` remains fixed at the observed value of zero in both methods.

Anonymous read-only compatibility observations on 2026-08-04 confirmed product-name catalog search and the product-details SKU schema. The observed normalized condition identifiers match TCGplayer's published condition catalog: Near Mint through Unopened map to IDs 1 through 6. Only schema and synthetic examples were retained.

A controlled live compatibility check on 2026-08-04 resubmitted one eligible listing's current price and current quantity through the corrected bulk-Pricing contract. Seller Portal accepted the no-op save; no price, quantity, listing identifiers, or credentials were retained.

## Live compatibility observation

An opt-in, read-only compatibility check against an authorized seller account on 2026-08-03 confirmed order search, exact-order confirmation, order-detail retrieval, packing-slip export, and pull-sheet export. No response bodies, credentials, order values, customer data, tracking values, or document bytes were retained.

The schema-only observations needed for compatibility were:

- `trackingNumbers` contains objects with the string fields `createdAt`, `carrier`, `trackingNumber`, and `status`.
- Packing-slip bytes may be served as `application/octet-stream`; the observed body had a valid `%PDF-` signature.
- Pull-sheet bytes may be served as `application/octet-stream`; the observed UTF-8 CSV used the documented package column contract.

These interfaces are undocumented and may change without notice. The package validates responses and reports compatibility errors instead of silently accepting drift.
