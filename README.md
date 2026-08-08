# tcgplayer-private-api

An unofficial server-side npm client for authorized TCGplayer seller operations. It supports order discovery, packing slips, pull sheets, carrier detection, tracking submission, shipment status updates, catalog and seller-inventory reads, price-only listing updates, positive live-inventory additions, and read-only seller payouts, feedback, and messages without exposing raw private endpoints.

This project is not affiliated with, endorsed by, or supported by TCGplayer. The seller interface is undocumented and can change without notice. Review the agreements and policies that apply to your account before using it.

## Status

The package is under initial development and has not been published to the public npm registry. Its current license is `UNLICENSED` until the repository owner chooses a distribution license.

## Requirements

- Node.js 20.19 or newer
- An authorized TCGplayer seller session
- Server-side use only

Do not include this package or seller session material in browser bundles.

## Local installation

From an adjacent application repository:

```shell
npm install ../tcgplayer-private-api
```

The application still imports by package name:

```ts
import { createTcgplayerSellerClient } from "tcgplayer-private-api";
```

Release builds should consume an immutable published version or package artifact rather than a relative source path.

## Authentication

The client accepts the value of the `TCGAuthTicket_Production` cookie from a seller's own authenticated browser session. Pass the value only, without the cookie name. The package does not automate login, bypass access controls, or persist the session.

Use protected server-side secret storage. Never commit a session cookie or put one in client-side code.

```ts
import { createTcgplayerSellerClient } from "tcgplayer-private-api";

const authCookie = process.env.TCGPLAYER_AUTH_COOKIE;
if (!authCookie) throw new Error("TCGPLAYER_AUTH_COOKIE is required");

const client = createTcgplayerSellerClient({
  session: { authCookie },
});
```

A provider can load a current session on every request:

```ts
const client = createTcgplayerSellerClient({
  session: async () => ({
    authCookie: await secrets.get("tcgplayer-auth-cookie"),
  }),
});
```

## Confirm an order and retrieve its packing slip

```ts
const confirmed = await client.confirmOrder({
  sellerKey: "your-seller-key",
  orderNumber: "your-order-number",
});

const packingSlip = await client.getPackingSlip({
  orderNumber: confirmed.order.orderNumber,
  timezoneOffsetMinutes: new Date().getTimezoneOffset(),
});

// packingSlip.bytes is a validated PDF Uint8Array.
```

`confirmOrder` first performs an exact seller-scoped search and then retrieves the order detail. It fails if the order cannot be confirmed for that seller or if the detail response refers to a different order.

## Public API

- `searchOrders(input, options?)`
- `getOrder(orderNumber, options?)`
- `confirmOrder(input, options?)`
- `getPackingSlip(input, options?)`
- `exportPackingSlips(input, options?)`
- `exportPullSheet(input, options?)`
- `detectCarrier(trackingNumber, options?)`
- `addOrderTracking(input, options?)`
- `shipOrderWithoutTracking(input, options?)`
- `markOrdersShipped(input, options?)`
- `searchCatalogProducts(input, options?)`
- `getCatalogProduct(input, options?)`
- `searchMarketplaceProducts(input, options?)`
- `searchMarketplaceProductListings(input, options?)`
- `listSellerInventory(input, options?)`
- `updateSellerPrices(input, options?)`
- `addSellerInventory(input, options?)`
- `removeSellerInventory(input, options?)`
- `getSellerPaymentExperience(input, options?)`
- `listLegacySellerPayments(input?, options?)`
- `listLegacyUpcomingSellerPayments(options?)`
- `listSellerPayouts(input, options?)`
- `getSellerPayout(input, options?)`
- `getSellerUnpaidBalance(input, options?)`
- `listSellerFeedback(input, options?)`
- `getSellerFeedbackAggregation(input, options?)`
- `listSellerMessageThreads(input, options?)`
- `getSellerMessageThread(input, options?)`
- `getSellerUnreadMessageCount(options?)`

Every method accepts an optional `AbortSignal`. JSON, PDF, and CSV responses are size-limited and validated before they are returned. Read-only requests use bounded retries for rate limits and selected transient failures.

Order responses preserve TCGplayer's validated display label in `orderStatus`
(search summaries) or `status` (details). Consumers should make decisions from
the normalized `orderStatusCode` or `statusCode` enum instead. Unrecognized
provider labels map to `SellerOrderStatus.Unknown`; they are never guessed.

## Read-only seller messages

Message reads use the authenticated seller's current Seller Portal session. Inbox and thread pages are seller-scoped and paginated; the separate unread-count method is scoped by the authenticated session.

```ts
const inbox = await client.listSellerMessageThreads({
  sellerKey: "your-seller-key",
  page: 1,
  pageSize: 25,
});

const unreadCount = await client.getSellerUnreadMessageCount();

const thread = await client.getSellerMessageThread({
  sellerKey: "your-seller-key",
  threadId: inbox.threads[0].threadId,
});
```

These methods only issue GET requests. Retrieving thread detail does not call TCGplayer's separate mark-as-read action. Replies, read-state changes, deletion, resolution, and escalation are deliberately absent from this package contract.

## Read-only seller payments

TCGplayer currently assigns sellers either its legacy Seller Portal payment experience or its newer Money Movement experience. Detect that capability first; an empty Money Movement response does not prove that a legacy seller has no payments. The payment contract is deliberately read-only and does not expose payment instruments, masked bank details, payment setup, payout approval/rejection/retry, or any other payment mutation.

Legacy payment-table reads retry once when a successful HTML response fails runtime validation. A repeated malformed response still raises `INVALID_RESPONSE`; authentication failures and other errors are not retried by this compatibility safeguard.

```ts
const experience = await client.getSellerPaymentExperience({
  sellerKey: "your-seller-key",
});

if (experience === "legacy") {
  const upcoming = await client.listLegacyUpcomingSellerPayments();
  const history = await client.listLegacySellerPayments({ page: 1 });
} else {
  const history = await client.listSellerPayouts({
    sellerKey: "your-seller-key",
    page: 1,
    pageSize: 25,
  });
  const unpaid = await client.getSellerUnpaidBalance({
    sellerKey: "your-seller-key",
  });
}
```

USD amounts are returned as integer minor units (cents). Legacy calendar dates are normalized to `YYYY-MM-DD`; Money Movement timestamps and provider status labels are preserved after validation. Optional target-currency metadata uses major units because that is how the newer Seller Portal formats those fields. Read-only payment requests use the same bounded retry behavior as other reads.

## Read-only seller feedback

Seller feedback comes from TCGplayer's current public storefront service. The feed is sorted newest-first and can be filtered by one-to-five-star rating, comment presence, or age. The aggregate method returns star totals and the three optional fulfillment-question summaries.

```ts
const page = await client.listSellerFeedback({
  sellerKey: "your-seller-key",
  offset: 0,
  rows: 25,
  rating: 5,
  requireComment: true,
  days: 90,
});

const summary = await client.getSellerFeedbackAggregation({
  sellerKey: "your-seller-key",
});
```

The normalized contract omits provider user keys, creator keys, seller-order IDs, and redundant seller identifiers. The feedback transport is anonymous and deliberately does not send the configured seller-session cookie. Buyer nicknames and comments remain operator-visible runtime data; consumers must not log or persist them without an explicit need.

## Fulfillment mutations

Mutation methods require both a seller key and order number. The client confirms each order belongs to that seller and reads its current state before submission. Existing matching tracking and already-shipped states return `outcome: "already-applied"` without another mutation.

```ts
const { carrier } = await client.detectCarrier("your-tracking-number");

await client.addOrderTracking({
  sellerKey: "your-seller-key",
  orderNumber: "your-order-number",
  carrier,
  trackingNumber: "your-tracking-number",
});

await client.markOrdersShipped({
  sellerKey: "your-seller-key",
  orderNumbers: ["your-order-number"],
});
```

For an order intentionally shipped without tracking, use `shipOrderWithoutTracking`. Tracking submission and marking shipped are distinct operations, matching the Seller Portal workflow.

Mutations are never automatically retried. A timeout, lost connection, server error, or invalid success response returns `AMBIGUOUS_RESULT`; re-read the affected order and reconcile tracking/status before choosing whether to retry. Do not treat this error as permission to immediately resubmit.

## Price updates

Use `listSellerInventory` to page through a seller's live listings and `searchMarketplaceProducts` to retrieve bounded product search results. Product-search responses may contain only TCGplayer's small embedded spotlight sample even when `totalListings` is much larger; consumers must not interpret that product-level count as the number of returned comparable records. Use `searchMarketplaceProductListings` when pricing requires TCGplayer's explicitly filtered, sorted, and paginated listing rows for one product. Both marketplace methods include an explicit U.S. buyer context. The package exposes the observed marketplace data but deliberately does not choose a pricing strategy; consumers own rules such as minimums, condition matching, shipping normalization, and whether to raise or lower a price.

`listSellerInventory` accepts an optional `onProgress` callback in its request options. Each validated page reports its channel, pages loaded, products loaded, and TCGplayer-reported total. Progress reporting observes the existing pagination and never creates an additional marketplace request.

```ts
const page = await client.searchMarketplaceProductListings({
  productId: 212043,
  conditions: ["Near Mint", "Lightly Played"],
  printings: ["Normal"],
  languages: ["English"],
  channelIds: [0, 1],
  listingTypes: ["standard"],
  sort: "price",
  limit: 24,
});

console.log(page.totalListings, page.listings.length);
```

For channel 1, no single field proves that a record is customer-buyable through Direct. Consumers using Direct comparisons should fail closed unless `directListing`, `directProduct`, and `directSeller` are all `true`, `directInventory` is a positive integer, `listingType` is `standard`, and `sellerPrograms` contains `DirectViewable`. Missing evidence is ineligible. These fields describe the marketplace response at request time and do not guarantee later cart or checkout availability.

`updateSellerPrices` reproduces Seller Portal's live bulk-Pricing price update. Each update deliberately requires the listing's current quantity, reserve quantity, channel, and identifiers; the method always sends an add-to-quantity value of zero and explicitly targets live rather than staged inventory. This prevents a price update from silently inventing or clearing inventory state.

```ts
await client.updateSellerPrices({
  updates: [
    {
      productId: 123,
      productName: "Example card",
      productConditionId: 456,
      conditionId: 1,
      channelId: 0,
      categoryName: "Example game",
      quantity: 7,
      price: 12.34,
      storePriceCustomId: null,
      reserveQuantity: 0,
    },
  ],
});
```

The method accepts at most 100 distinct product-condition/channel pairs per call, validates prices to cents, and never retries. A returned success means Seller Portal accepted the update request; its own inventory processing can still be asynchronous. `AMBIGUOUS_RESULT` means the listing must be checked in Seller Portal before any retry.

## Catalog and inventory additions

Use `searchCatalogProducts` to find exact products and `getCatalogProduct` to resolve the supported condition, printing, and language combinations to TCGplayer SKU identifiers. Search text uses TCGplayer's marketplace query contract rather than an exact product-name term filter, so numbered and artwork-specific variants remain discoverable. Results include product-line and set facets and may be narrowed with `setName`, `productLineName`, and `productTypeName`. Search results are ranked by normalized name likeness with exact-name matches first, and both summaries and details include a public product-artwork URL. Product names alone are not sufficient to identify a listing.

Set `includeFoilMarketPrices: true` when search results need an English Near Mint Foil market price. The search filters only its embedded listings to identify one matching Foil SKU per product, then submits all discovered SKU IDs in one batched price-point request. Products without a live matching listing omit `foilMarketPrice`; the client never makes one price request per product.

```ts
const search = await client.searchCatalogProducts({
  query: "Synthetic Card",
  productTypeName: "Cards",
  setName: "Synthetic Set",
  includeFoilMarketPrices: true,
});
```

`addSellerInventory` is separate from `updateSellerPrices`. Each addition requires a positive relative quantity, the freshly observed current quantity, the complete SKU identity, and an initial price. It submits the relative addition, the absolute post-add quantity (`currentQuantity + addQuantity`), and price together so a new card is never briefly exposed at a placeholder price.

```ts
const details = await client.getCatalogProduct({ productId: 123 });
const sku = details.skus.find(
  (candidate) =>
    candidate.condition === "Near Mint" &&
    candidate.printing === "Normal" &&
    candidate.language === "English",
);
if (!sku) throw new Error("Requested SKU is unavailable");

await client.addSellerInventory({
  additions: [
    {
      productId: details.productId,
      productName: details.productName,
      productConditionId: sku.productConditionId,
      conditionId: sku.conditionId,
      channelId: 0,
      categoryName: details.productLineName,
      currentQuantity: 0,
      addQuantity: 1,
      price: 4.25,
      storePriceCustomId: null,
      reserveQuantity: 0,
    },
  ],
});
```

`removeSellerInventory` clears an exact live SKU by submitting an absolute quantity of zero. It requires a freshly observed positive quantity, the existing price and identifiers, and zero reserve quantity. Consumers must re-read the listing immediately before submission and stop for review if its quantity or secondary inventory changed.

```ts
await client.removeSellerInventory({
  removals: [
    {
      productId: 123,
      productName: "Example card",
      productConditionId: 456,
      conditionId: 1,
      channelId: 0,
      categoryName: "Magic: The Gathering",
      currentQuantity: 2,
      price: 4.25,
      storePriceCustomId: null,
      reserveQuantity: 0,
    },
  ],
});
```

The caller must re-read seller inventory immediately before submission and preserve secondary-channel reserve state. The method accepts at most 100 distinct SKU/channel pairs and never retries. Acceptance may be asynchronous; reconcile the listing after success, and always reconcile after `AMBIGUOUS_RESULT` before deciding whether to retry.

## Errors

All client and remote failures use `TcgplayerApiError` with a stable `code`, safe message, `retryable` flag, and optional HTTP status/request ID. Response bodies, credentials, and customer details are never included in errors.

```ts
import { isTcgplayerApiError } from "tcgplayer-private-api";

try {
  await client.getOrder("your-order-number");
} catch (error) {
  if (isTcgplayerApiError(error)) {
    console.error(error.code, error.retryable);
  }
}
```

## Development

```shell
npm install
npm run check
npm run audit
```

`npm run package:verify` packs the built package, installs the tarball into a temporary clean consumer, and verifies both ESM and CommonJS imports.

### Opt-in live compatibility check

Live checks are excluded from ordinary tests and CI. The provided compatibility script is strictly read-only and prints only endpoint status/count metadata, never order contents, addresses, documents, or credentials. It does not offer an environment flag for live mutations.

```shell
TCGPLAYER_AUTH_COOKIE=... TCGPLAYER_SELLER_KEY=... npm run compatibility:check
```

To check an exact order, add `TCGPLAYER_ORDER_NUMBER`. To retrieve and validate its packing slip or pull sheet in memory, explicitly set `TCGPLAYER_CHECK_PACKING_SLIP=1` or `TCGPLAYER_CHECK_PULL_SHEET=1`. The script never writes order data or documents to disk.

Tracking, shipment, price-update, and inventory-add methods are covered with synthetic contract tests. Exercise mutations against a real account only with a deliberately selected order or listing and operator supervision.

See [docs/PROVENANCE.md](docs/PROVENANCE.md) for the behavioral reference and clean implementation boundary.
