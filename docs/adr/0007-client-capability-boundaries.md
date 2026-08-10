# ADR 0007: Client capability boundaries

- Status: Accepted
- Date: 2026-08-10

## Context

The public seller client accumulated authentication, account, payments,
feedback, messages, orders, fulfillment mutations, marketplace search, catalog,
and inventory mutations in one implementation file. The public API remained
useful, but transport assumptions, input policy, and unrelated endpoint groups
were difficult to review independently.

## Decision

- Keep `TcgplayerSellerClient` and `createTcgplayerSellerClient` as the only
  public client entry points. Existing method names, arguments, results, error
  behavior, and the root package export remain unchanged.
- Implement the facade through independent account, order, marketplace/catalog,
  and inventory-mutation capability services.
- Construct one `SellerApiTransport` per public client and inject that same
  instance into every capability. Request pacing, session refresh, retry policy,
  authentication callbacks, and caller-provided transport therefore retain one
  shared state boundary.
- Keep common input normalization and the observed Seller Portal inventory-form
  encoder in an internal client-input module. Endpoint paths remain with the
  capability that owns them.
- Do not export capability classes or internal modules through the package
  export map. The generated declaration bundle must expose the flat public
  facade rather than its implementation graph.
- Verify every public client method in both ESM and CommonJS from a clean install
  of the packed tarball.

## Consequences

Endpoint families can now change and be reviewed independently without forcing
consumers to assemble subclients. The facade contains explicit delegation, which
adds a small amount of runtime code but makes the supported package contract
visible in one place. A new capability must be wired into the shared transport,
covered by contract tests, and deliberately added to the facade and packed
consumer verification.
