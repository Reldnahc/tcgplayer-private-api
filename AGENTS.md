# AGENTS.md

## Purpose

This repository contains an unofficial, narrowly scoped npm client for the private TCGplayer seller interface. It isolates seller authentication/session behavior and the order-fulfillment endpoints required by authorized sellers, while remaining reusable by applications unrelated to TCGPlayerAlert.

The primary consumer is:

- <https://github.com/Reldnahc/TCGPlayerAlert>

"Private API" means an undocumented interface used by TCGplayer's seller experience. It does not mean this repository may contain private credentials, captured customer data, or access-control bypasses.

## Current Phase

The reusable seller client is authorized, including explicit tracking and shipment mutations, catalog/SKU discovery, price-only updates, positive live-inventory additions with an initial price, exact live-SKU inventory clearing, and read-only payout history, payout-detail, and unpaid-balance retrieval. Keep work limited to those reviewed capabilities; verify reuse rights, document observed contracts, and preserve the independent npm package boundary.

## Scope

This repository owns:

- Authenticated seller-session establishment, validation, refresh, and expiration behavior.
- HTTP transport details for the required private seller endpoints.
- Runtime validation and normalization of private API requests and responses.
- Retrieval of authorized seller orders needed to confirm a sale notification.
- Retrieval of packing-slip content and metadata.
- Retrieval of pull-sheet exports and carrier detection.
- Explicit, seller-scoped tracking and shipment-status mutations with reconciliation safeguards.
- Catalog product search and exact condition/printing/language SKU discovery.
- Explicit positive live-inventory additions that submit quantity and initial price together.
- Explicit exact-SKU live-inventory removals that set an observed unreserved quantity to zero.
- Read-only seller payout history, payout details, and unpaid-balance retrieval through the observed Money Movement interface.
- Typed errors, retry hints, compatibility detection, and sanitized contract fixtures.
- A stable, documented client contract that applications can version and consume.
- npm packaging, compiled runtime output, type declarations, and release compatibility.

This repository does not own:

- Mailbox access or email parsing.
- Sale-notification polling or scheduling.
- Cross-provider domain workflows.
- User-configurable rules or action dispatch.
- Printer discovery, label rendering, or print-job submission.
- Application UI, user accounts, application databases, or deployment stacks.
- Payment setup, payment-instrument or bank-account retrieval, payout approval/rejection/retry, purchasing postage, refunds, cancellations, customer messaging, and other Seller Portal mutations unless separately requested, reviewed, and explicitly authorized. Price-only updates, positive inventory additions, and exact unreserved inventory removals are authorized when they preserve other inventory state and follow the mutation-safety rules below.

If a feature can be expressed without knowledge of TCGplayer's private transport, it probably belongs in the consuming application rather than here.

## npm Package Contract

- This repository must build an installable npm package with a finalized, non-placeholder package name before its first registry publication.
- Publish runnable JavaScript and type declarations. Consumers must not need to compile this repository's source language.
- Declare a deliberate `exports` map and expose only supported entry points. Do not support deep imports into internal paths.
- Keep the default entry point safe for server-side Node.js use. Never expose credentials or authenticated sessions to browser bundles.
- Declare supported Node.js versions through `engines` and test every supported major version in CI.
- Keep framework, database, UI, filesystem, and application configuration dependencies out of the public client.
- Accept caller-provided implementations for session persistence, logging, clocks, and transport customization where needed.
- Do not import from or depend on TCGPlayerAlert. Examples may demonstrate integration without coupling package types or defaults to that app.
- Use semantic versioning. Treat public types, export paths, runtime behavior, and documented error semantics as part of the versioned contract.
- Before release, validate the exact packed artifact with `npm pack --dry-run`, install its tarball into a clean consumer fixture, and run public API tests there.
- Local adjacent-repository development may use an npm `file:../tcgplayer-private-api` dependency or packed tarball, but consumers must import only by package name.
- Keep runtime dependencies minimal and justify each one. Put build, test, and type-only tooling in development dependencies.
- Include only necessary compiled output, type declarations, documentation, notices, and runtime assets in the published package.

## Upstream Reference and Provenance

The primary behavioral and implementation reference is:

- <https://github.com/todd-skelton/tcgplayer-automation-app>

Use only the minimum seller-authentication, order, and packing-slip behavior required by the client. Do not adopt its full application, UI, database, shipping, or deployment stack.

Before copying or adapting any source:

1. Verify the license and any applicable permission for the exact upstream revision. Public visibility alone does not grant reuse rights.
2. Record the repository URL, commit SHA, source paths, license, copied concepts or code, and local modifications in a provenance document.
3. Preserve all required copyright, license, and attribution notices.
4. If reuse permission is absent or unclear, use the upstream project only to understand observable behavior and implement an independently written adapter from documented observations.
5. Never import upstream secrets, captured sessions, customer data, environment files, databases, or generated artifacts.

## Authorization and Acceptable Behavior

- Access only accounts and data for which the operator has valid authorization.
- Use normal authentication flows and permissions available to the authenticated seller.
- Do not bypass access controls, CAPTCHAs, rate limits, bot protections, or security mechanisms.
- Do not probe unrelated endpoints or enumerate data outside the required seller workflow.
- Do not disguise the client as an official TCGplayer product.
- Review applicable TCGplayer agreements and policies before implementing, distributing, or operating the client.
- Make remote mutations opt-in, narrowly scoped, and impossible through read-only interfaces.
- Stop safely and report a compatibility error when remote behavior changes; do not guess with customer orders or documents.

## Public Contract

- Expose capability-oriented client methods rather than raw endpoint URLs.
- Keep authentication/session material behind an injected credential or session-store contract.
- Normalize remote payloads into explicit client models, but do not invent cross-marketplace domain abstractions here.
- Preserve unknown remote fields only when needed for forward compatibility; do not leak unvalidated payloads to consumers.
- Represent packing slips as typed metadata plus bytes/streams. Do not assume a filesystem path, PDF, or rendering behavior until verified.
- Return structured, typed errors that distinguish authentication, authorization, compatibility, validation, rate-limit, transient transport, and permanent failures.
- Surface safe retry guidance; do not retry non-idempotent requests automatically.
- Accept caller-provided correlation IDs without logging sensitive order or customer data.
- Keep transport details internal so endpoints can change without forcing needless consumer changes.
- Version the published contract using semantic versioning once the first public release exists.
- Export the smallest useful API. Prefer a configured client instance and explicit capability methods over global state or endpoint-shaped functions.

## Architecture Rules

- Separate public client interfaces, models, authentication/session handling, transport, endpoint mappings, validation, and fixtures.
- Centralize HTTP behavior such as base URLs, headers, cookies, timeouts, status mapping, and redaction.
- Keep endpoint-specific code small and declarative where practical.
- Validate every remote response at runtime before returning it.
- Treat HTML, JSON, PDFs, redirects, cookies, filenames, and headers as untrusted input.
- Inject networking, clocks, randomness, and credential/session storage for deterministic testing.
- Do not require a database, web framework, background worker, or UI to use the client.
- Do not require the TCGPlayerAlert repository, its environment variables, or its domain types to use the client.
- Avoid process-global sessions and mutable singleton clients.
- Do not write packing slips or session material to disk unless the caller supplies an explicit storage abstraction.
- Put every observed private-API assumption in code-adjacent documentation or a contract test.

## Security and Privacy

- Never commit usernames, email addresses used as credentials, passwords, OAuth tokens, session cookies, API tokens, private keys, customer addresses, order exports, packing slips, or real captured traffic.
- Keep `.env*`, cookie jars, browser profiles, HAR files, downloaded documents, local databases, and debug dumps out of Git unless they are purpose-built sanitized examples.
- Redact authorization headers, cookies, tokens, addresses, names, email addresses, order contents, and document bytes from logs and exceptions.
- Minimize the lifetime and scope of session material. Allow consumers to provide protected secret storage.
- Set bounded request and response sizes, connection/read timeouts, redirect limits, and safe content-type checks.
- Do not send credentials or session material to hosts outside the explicitly configured TCGplayer origin set.
- Make TLS verification mandatory in production paths.
- Use synthetic data and reserved domains in tests.

## Reliability and Compatibility

- Assume the private interface can change at any time.
- Detect login pages, consent/interstitial pages, schema drift, content-type changes, and expired sessions explicitly.
- Use bounded retries with exponential backoff and jitter only for safely retryable operations.
- Preserve remote request IDs and safe diagnostic metadata when present.
- Never turn an ambiguous response into a successful order confirmation or packing slip.
- Maintain sanitized fixtures for supported response variants and known failure modes.
- Provide a compatibility test surface that the consuming application can run against an explicitly configured authorized account.
- Live tests must be opt-in, read-only by default, and excluded from ordinary CI.

## Coding Standards

Record the implementation language, module formats, supported Node.js versions, and build layout in an architecture decision before implementation. The output must be a standard npm package with type declarations. Once chosen, configure one canonical formatter, linter, strict type checker, test runner, dependency audit, build command, and package verification command.

- Use clear names, small cohesive modules, and explicit public types.
- Validate boundary inputs at runtime; static typing is not a substitute for validation.
- Keep functions focused and control flow shallow.
- Prefer immutable values and explicit dependency injection.
- Avoid untyped escape hatches and catch-all service objects.
- Use typed errors with safe context; never swallow failures.
- Do not log and rethrow the same error at multiple layers.
- Comments should explain observed constraints and decisions, not obvious syntax.
- Delete dead code instead of commenting it out.
- Pin dependency ranges deliberately, commit the lockfile, and justify security-sensitive or heavyweight dependencies.
- Define package entry points through `package.json`; never rely on consumers reaching into build directories.
- Use UTF-8, platform-neutral paths, and cross-platform APIs.
- Maintain backward compatibility within a major version or publish a clear migration guide.

## Testing Standards

- Unit-test models, validators, redaction, error mapping, retry decisions, authentication state, and transport orchestration without live network access.
- Contract-test every supported endpoint against sanitized fixtures.
- Test expired and invalid sessions, redirects to login, malformed JSON/HTML, unexpected content types, truncated documents, timeouts, rate limits, server failures, and schema drift.
- Every bug fix requires a regression test that fails for the original defect.
- Keep tests deterministic by injecting clocks, randomness, and transport.
- Live tests require explicit credentials and an opt-in command, must default to read-only operations, and must never print response bodies containing PII.
- Test the installed tarball from a clean external consumer fixture so source-only imports and missing published files fail before release.
- Formatting, linting, type checking, tests, build, and security checks must pass before a change is complete.

## Release and Consumer Discipline

- Keep `main` releasable and work directly on it by default. Do not create feature branches or pull requests unless the user explicitly requests them.
- Push focused, validated commits directly to `origin/main` after confirming the diff contains only intended package changes.
- Synchronize with `origin/main` using a fast-forward-safe workflow before pushing. Never force-push or rewrite published `main` history without explicit user authorization.
- Publish explicit npm versions and release notes for consumer-visible changes.
- Classify breaking changes conservatively; private endpoint drift does not justify silently breaking the client contract.
- Document the minimum supported runtime and the tested TCGplayer behavior date/revision.
- Provide a changelog and migration notes once releases begin.
- Consuming applications must depend on a released npm version or immutable package artifact, never an unpinned branch or relative source import.
- Coordinate contract changes with consumer compatibility tests.

## Definition of Done

A change is done only when:

1. It stays within the client boundary and implements only authorized behavior.
2. Runtime validation and typed failure behavior cover all observed responses.
3. Relevant unit and sanitized contract tests cover success and failure paths.
4. Formatting, linting, type checking, tests, build, and security checks pass.
5. No secret, session material, PII, real order data, packing slip, or unsafe capture is present in the diff or history.
6. Compatibility assumptions, provenance, public contract, and release impact are documented.
7. The diff contains no unrelated application functionality.

## Outstanding Release Decisions

- Choose the distribution license and npm registry access policy before publication.
- Decide whether session acquisition or renewal will remain entirely caller-owned or gain a separately reviewed package capability.
- Perform supervised live tracking and shipment compatibility checks when a newly received order is available; never add these mutations to ordinary CI.
- Finalize the first release/versioning policy before application integration.

Record consequential choices with short architecture decision records.
