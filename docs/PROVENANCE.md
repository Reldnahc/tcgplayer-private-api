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
- Paginated product listings: `POST /v1/product/{productId}/listings`
- Marketplace product details: `GET /v2/product/{productId}/details`, including SKU, condition, printing variant, and language
- Marketplace SKU price points: `POST https://mpgateway.tcgplayer.com/v1/pricepoints/marketprice/skus/search` with a batch of SKU identifiers
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
- `app/integrations/tcgplayer/client/get-price-points.server.ts`
- `app/features/seller-management/routes/api.seller-inventory.server.ts`

The current public Seller Portal orders bundle was also inspected on 2026-08-03 to confirm protocol shapes independently. It showed carrier detection at `POST /orders/detect-carrier?api-version=2.0`, shipment without tracking at `POST /orders/{encodedOrderNumber}/ship-no-tracking?api-version=2.0`, and bulk status updates at `POST /orders/status-updates?api-version=2.0` with the status `Shipped`. No mutation was sent during inspection.

The public Seller Portal Payments bundle at `https://sellerportal-payments-app.tcgplayer.com/payments.js` was inspected on 2026-08-07. It showed the Money Movement origin `https://money-movement.tcgplayer.com/v1` and these seller-scoped reads:

- `GET /Payouts?SellerKey={sellerKey}&Page={page}&PageSize={pageSize}` with the total in `X-Total-Count`
- `GET /payouts/by-seller/{sellerKey}/{referenceId}` for payout details
- `GET /balances/payable?SellerKey={sellerKey}` for the unpaid balance and pending transactions

The bundle formats payout USD values as integer cents and exposes order settlement, refund, and adjustment transaction types. It can also display payment-instrument data and contains administrative payout mutations; this package deliberately implements neither. No TCGplayer source code was copied, no payment mutation was sent, and no seller payment value, identifier, instrument, or credential was retained.

The public Seller Portal navigation bundle at `https://sellerportal-navigation-app.tcgplayer.com/navigation.js` was inspected on 2026-08-07. It routes sellers with the `Seller Portal Payments EPS Integration` feature to the newer Payments application and other sellers to `/admin/payment/sellerpayment`. A read-only, authenticated compatibility observation confirmed that `GET /Account/auth-detail?api-version=1.0` exposes the current seller key and feature-name array, the legacy page contains the `Past Payment History` table, and `GET /admin/payment/loadpendingpayments?r=0` returns the `Estimated Future Payments` table including a separate aggregate totals row. The package independently parses only the displayed payment columns. Only response keys, feature presence, table structure, pagination count, and aggregate row counts were inspected; no seller identity, payment value, payment identifier, order data, or credential was retained.

The public TCGplayer seller storefront bundles under `https://www.tcgplayer.com/js/modules/seller/` were inspected on 2026-08-07. The seller feedback service uses `https://seller-stores-backend.tcgplayer.com` for these anonymous reads:

- `GET /sf/sellerorderfeedback/?sellerKey={sellerKey}&sortBy=createdDate&offset={offset}&rows={rows}` with optional `rating`, `requireComment=true`, and `days` filters.
- `GET /sf/sellerorderfeedback/aggregation/?sellerKey={sellerKey}` with an optional `days` filter.

Schema-only compatibility requests confirmed a paginated result with one-to-five-star feedback and an aggregate result with star totals plus delivery, description, and communication answer counts. A completed end-to-end read also confirmed that individual rows may omit any fulfillment-question answer; those fields remain optional rather than being guessed. The package omits provider user keys, creator keys, seller-order identifiers, and redundant seller identifiers from its normalized result, and the transport does not send the seller-session cookie to this public service. No seller key, buyer nickname, comment, order identifier, or credential was retained.

The public Seller Portal import map, Messages bundle at `https://sellerportal-messages-app.tcgplayer.com/messages.js`, and navigation bundle at `https://sellerportal-navigation-app.tcgplayer.com/navigation.js` were inspected on 2026-08-07. They showed these authenticated reads:

- `GET https://store.tcgplayer.com/admin/sp-msg-api/{sellerKey}/threads?page={page}&pageSize={pageSize}` with optional exact `orderNumber` and deleted-thread inclusion.
- `GET https://store.tcgplayer.com/admin/sp-msg-api/{sellerKey}/threads/{threadId}?messagesPage={page}&messagesPageSize={pageSize}` for thread content.
- `GET https://messages-api.tcgplayer.com/messages/unread-count` for the authenticated account's navigation badge.

The Messages bundle performs separate POST requests for replies, read-state changes, deletion, resolution, and escalation; none are implemented. In particular, fetching thread detail and marking it read are distinct requests, so the package's GET does not intentionally change unread state. Schema-only authenticated compatibility observations confirmed the list, count, and detail field names, types, and pagination counts. No message body, sender or receiver identity, thread or message identifier, order identifier, seller key, or credential was printed or retained.

The behavioral reference repository was rechecked at commit `79b8795dadde14dc7a3b60d6f5a9fabe902ee151`. Its `app/core/clients/messagesApi.client.server.ts` and `app/integrations/tcgplayer/client/create-seller-order-message-thread.server.ts` confirmed the dedicated Messages API origin but implemented only a thread-creation mutation, not inbox reads. No reference source was copied; the package implementation was independently written from the public Seller Portal behavior above.

A read-only marketplace compatibility observation on 2026-08-03 confirmed seller-key inventory filtering and product searches filtered by condition. Only schema and aggregate counts were inspected; listing identifiers, names, prices, and credentials were not retained.

The public Seller Portal pricing bundle (`/admin/scripts/pricing/main-built.31397.js`) was inspected on 2026-08-03 and rechecked on 2026-08-04 after definite request rejections exposed a route mismatch. The bulk Pricing page saves through `POST https://store.tcgplayer.com/admin/pricing/updateinventory`, with `type=Pricing` and `isStaged=false` for live inventory. Its submitted model includes product, condition, channel, relative add-to-quantity, absolute post-add quantity, price, custom-price identifier, and reserve quantity fields. The bundle computes `newQty` as current quantity plus add quantity and submits `newQty` as the condition-level `Quantity`. A separate product-detail screen uses `/admin/product/updateinventory`; it is not the contract implemented by this package. The package independently implements a price-only variant with `AddToQuantity` fixed at zero, a positive-addition variant that requires a fresh current quantity and an initial price, and an exact-removal variant that requires a fresh positive unreserved quantity and submits zero as the absolute quantity. `ExistingQuantity` remains fixed at the observed value of zero in all methods.

Anonymous read-only compatibility observations on 2026-08-04 confirmed product-name catalog search, the product-details SKU schema, and public product artwork at `https://product-images.tcgplayer.com/fit-in/200x279/{productId}.jpg`. The observed normalized condition identifiers match TCGplayer's published condition catalog: Near Mint through Unopened map to IDs 1 through 6. Only schema and synthetic examples were retained.

An anonymous read-only compatibility observation on 2026-08-04 confirmed that filtering embedded catalog listings to English, Near Mint, and Foil leaves the product search result set intact while exposing matching product-condition SKU identifiers where live listings exist. One batched request to the marketplace gateway returned market price points for those SKU identifiers. Only endpoint shape and aggregate behavior were retained.

Anonymous read-only observations on 2026-08-05 confirmed that marketplace catalog text belongs in the `q` query parameter and that `productLineName` and `setName` aggregations can enumerate filter choices without retrieving every candidate. Set term filters sharply bounded large basic-land searches. Only aggregate counts and response shape were inspected; no listing identifiers or credentials were retained.

An anonymous read-only exact-condition observation on 2026-08-06 confirmed that a channel-1 search can return standard seller records explicitly marked `directListing: false`. Therefore `channelId: 1` is not sufficient evidence that a record is a customer-visible Direct offer. The package preserves the optional eligibility flag so consumers can fail closed. No seller identity, listing identifier, or price was retained.

Anonymous read-only comparison observations on 2026-08-06 confirmed that channel-1 records also carry Direct product eligibility, seller eligibility, Authentication Center inventory, listing classification, and seller-program flags. A record that ranked as Direct under explicit U.S. buyer context simultaneously reported `directListing`, `directProduct`, and `directSeller` as true, positive `directInventory`, the `standard` listing type, and the `DirectViewable` seller program. Records missing seller eligibility or Authentication Center inventory remained in the raw channel response but were not marked as Direct listings. Only schema, boolean relationships, and aggregate availability behavior were retained; no seller identity, listing identifier, or price was retained.

An anonymous read-only observation of TCGplayer's public Product Details bundle and marketplace service on 2026-08-06 confirmed that product-search responses embed only three spotlight listing rows even when the product reports hundreds of listings, and that nested listing sort and size fields do not expand or reorder that embedded sample. TCGplayer's own Product Details flow instead calls `POST /v1/product/{productId}/listings` with top-level pagination, exact listing filters, and a sort field of `price` or `price+shipping`. The endpoint accepts marketplace and Direct channel identifiers together and returns an exact filtered total separately from the bounded listing page. Only endpoint shape, schema, and aggregate behavior were retained; no seller identity, listing identifier, or price was retained.

A controlled live compatibility check on 2026-08-04 resubmitted one eligible listing's current price and current quantity through the corrected bulk-Pricing contract. Seller Portal accepted the no-op save; no price, quantity, listing identifiers, or credentials were retained.

## Live compatibility observation

An opt-in, read-only compatibility check against an authorized seller account on 2026-08-03 confirmed order search, exact-order confirmation, order-detail retrieval, packing-slip export, and pull-sheet export. No response bodies, credentials, order values, customer data, tracking values, or document bytes were retained.

The schema-only observations needed for compatibility were:

- `trackingNumbers` contains objects with the string fields `createdAt`, `carrier`, `trackingNumber`, and `status`.
- Packing-slip bytes may be served as `application/octet-stream`; the observed body had a valid `%PDF-` signature.
- Pull-sheet bytes may be served as `application/octet-stream`; the observed UTF-8 CSV used the documented package column contract.

These interfaces are undocumented and may change without notice. The package validates responses and reports compatibility errors instead of silently accepting drift.
