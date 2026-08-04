# Provenance

## Behavioral reference

- Repository: <https://github.com/todd-skelton/tcgplayer-automation-app>
- Inspected commit: `50c8d15008d0939bf50b80d93abbdacac5ebba6d`
- Inspection date: 2026-08-03
- License observed: none (no license/copying/notice file and no package license declaration at the inspected revision)

No source code from the reference repository is copied into this package. The implementation is independently written from the protocol facts listed below. Any future source reuse requires separately verified permission and an update to this document.

## Observed protocol facts

The inspected revision showed these read-only seller behaviors:

- Origin: `https://order-management-api.tcgplayer.com`
- Authentication: a caller's authorized `TCGAuthTicket_Production` cookie value
- Search: `POST /orders/search?api-version=2.0`
- Detail: `GET /orders/{encodedOrderNumber}?api-version=2.0`
- Packing slips: `POST /orders/packing-slips/export?api-version=2.0`
- Packing-slip response: PDF bytes
- Observed search range: `LastThreeMonths`
- Observed ready-to-ship filter: `ReadyToShip`
- Observed packing-slip format values: `ByRelease` and `Default`

The following files were consulted to identify those facts:

- `app/core/clients/baseDomainClient.server.ts`
- `app/core/clients/orderManagementApi.client.server.ts`
- `app/core/config/httpConfig.shared.ts`
- `app/integrations/tcgplayer/client/search-seller-orders.server.ts`
- `app/integrations/tcgplayer/client/get-seller-order.server.ts`
- `app/integrations/tcgplayer/client/export-packing-slips.server.ts`

## Live compatibility observation

An opt-in, read-only compatibility check against an authorized seller account on 2026-08-03 confirmed order search, exact-order confirmation, order-detail retrieval, and packing-slip export. No response bodies, credentials, order values, customer data, tracking values, or document bytes were retained.

The schema-only observations needed for compatibility were:

- `trackingNumbers` contains objects with the string fields `createdAt`, `carrier`, `trackingNumber`, and `status`.
- Packing-slip bytes may be served as `application/octet-stream`; the observed body had a valid `%PDF-` signature.

These interfaces are undocumented and may change without notice. The package validates responses and reports compatibility errors instead of silently accepting drift.
