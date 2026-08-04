# tcgplayer-private-api

An unofficial server-side npm client for authorized TCGplayer seller order fulfillment. It supports order discovery, packing slips, pull sheets, carrier detection, tracking submission, and shipment status updates without exposing raw private endpoints.

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

Every method accepts an optional `AbortSignal`. JSON, PDF, and CSV responses are size-limited and validated before they are returned. Read-only requests use bounded retries for rate limits and selected transient failures.

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

Tracking and shipment methods are covered with synthetic contract tests. Exercise them against a real account only with a newly received order selected for that purpose and deliberate operator supervision.

See [docs/PROVENANCE.md](docs/PROVENANCE.md) for the behavioral reference and clean implementation boundary.
