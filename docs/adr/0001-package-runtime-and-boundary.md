# ADR 0001: Package runtime and boundary

- Status: Accepted
- Date: 2026-08-03

## Context

The seller client must be installable by TCGPlayerAlert and unrelated server applications without importing another repository's source. It handles authenticated seller data and therefore must not be delivered to browsers.

## Decision

- Publish a standard npm package named `tcgplayer-private-api`.
- Support Node.js 20.19 or newer.
- Author in strict TypeScript and publish compiled ESM and CommonJS JavaScript plus declarations.
- Use the platform `fetch` implementation and no runtime dependencies.
- Pin transitive build tooling when necessary to resolve audited development-only vulnerabilities, and remove overrides once direct tools declare a patched compatible range.
- Accept a caller-provided session value or session provider; do not own credential persistence.
- Keep the first public surface read-only: order search, order detail, exact-order confirmation, and packing-slip export.
- Keep the TCGplayer origin fixed in production code. Tests replace `fetch` rather than redirecting credentials to another host.
- Treat the package contract, types, declared exports, and error semantics as versioned API.

## Consequences

Consumers can install one package and use it from either module system. The minimum Node version reflects the native `fetch` and current quality-tool requirements. Browser bundling is unsupported because it would expose seller sessions. Automated login and session persistence remain outside this package.
