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

The following files were consulted to identify those facts:

- `app/core/clients/baseDomainClient.server.ts`
- `app/core/clients/orderManagementApi.client.server.ts`
- `app/core/config/httpConfig.shared.ts`
- `app/integrations/tcgplayer/client/search-seller-orders.server.ts`
- `app/integrations/tcgplayer/client/get-seller-order.server.ts`
- `app/integrations/tcgplayer/client/export-packing-slips.server.ts`
- `app/integrations/tcgplayer/client/export-pull-sheet.server.ts`
- `app/integrations/tcgplayer/client/apply-order-tracking.server.ts`

The current public Seller Portal orders bundle was also inspected on 2026-08-03 to confirm protocol shapes independently. It showed carrier detection at `POST /orders/detect-carrier?api-version=2.0`, shipment without tracking at `POST /orders/{encodedOrderNumber}/ship-no-tracking?api-version=2.0`, and bulk status updates at `POST /orders/status-updates?api-version=2.0` with the status `Shipped`. No mutation was sent during inspection.

## Live compatibility observation

An opt-in, read-only compatibility check against an authorized seller account on 2026-08-03 confirmed order search, exact-order confirmation, order-detail retrieval, packing-slip export, and pull-sheet export. No response bodies, credentials, order values, customer data, tracking values, or document bytes were retained.

The schema-only observations needed for compatibility were:

- `trackingNumbers` contains objects with the string fields `createdAt`, `carrier`, `trackingNumber`, and `status`.
- Packing-slip bytes may be served as `application/octet-stream`; the observed body had a valid `%PDF-` signature.
- Pull-sheet bytes may be served as `application/octet-stream`; the observed UTF-8 CSV used the documented package column contract.

These interfaces are undocumented and may change without notice. The package validates responses and reports compatibility errors instead of silently accepting drift.
