# tcgplayer-private-api

An unofficial, read-only npm client for authorized access to TCGplayer seller orders and packing slips.

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
npm install ../package
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

Every method accepts an optional `AbortSignal`. JSON and PDF responses are size-limited and validated before they are returned. The client retries bounded, read-only requests only for rate limits and selected transient server failures.

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

Live checks are excluded from ordinary tests and CI. They are read-only and print only endpoint status/count metadata, never order contents, addresses, documents, or credentials.

```shell
TCGPLAYER_AUTH_COOKIE=... TCGPLAYER_SELLER_KEY=... npm run compatibility:check
```

To check an exact order, add `TCGPLAYER_ORDER_NUMBER`. To also retrieve and validate its packing slip in memory, explicitly set `TCGPLAYER_CHECK_PACKING_SLIP=1`. The script never writes the order or PDF to disk.

See [docs/PROVENANCE.md](docs/PROVENANCE.md) for the behavioral reference and clean implementation boundary.
