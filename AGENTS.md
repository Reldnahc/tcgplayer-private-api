# AGENTS.md

## Purpose

This repository contains an unofficial, narrowly scoped client for the private TCGplayer seller interface. It exists to isolate seller authentication/session behavior and the minimum endpoints required to confirm orders and retrieve packing slips for authorized sellers.

The primary consumer is:

- <https://github.com/Reldnahc/TCGPlayerAlert>

“Private API” means an undocumented interface used by TCGplayer's seller experience. It does not mean this repository may contain private credentials, captured customer data, or access-control bypasses.

## Current Phase

The repository is in bootstrap and architecture-discovery mode. Do not begin implementation until the user explicitly requests it. Initial work should identify the smallest reusable slice of upstream behavior, verify reuse rights, document observed contracts, and choose a language/package boundary.

## Scope

This repository owns:

- Authenticated seller-session establishment, validation, refresh, and expiration behavior.
- HTTP transport details for the required private seller endpoints.
- Runtime validation and normalization of private API requests and responses.
- Retrieval of authorized seller orders needed to confirm a sale notification.
- Retrieval of packing-slip content and metadata.
- Typed errors, retry hints, compatibility detection, and sanitized contract fixtures.
- A stable, documented client contract that applications can version and consume.

This repository does not own:

- Mailbox access or email parsing.
- Sale-notification polling or scheduling.
- Cross-provider domain workflows.
- User-configurable rules or action dispatch.
- Printer discovery, label rendering, or print-job submission.
- Application UI, user accounts, application databases, or deployment stacks.
- Marking orders shipped, purchasing postage, changing inventory, or other seller mutations unless separately requested, reviewed, and explicitly authorized.

If a feature can be expressed without knowledge of TCGplayer's private transport, it probably belongs in the consuming application rather than here.

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

## Architecture Rules

- Separate public client interfaces, models, authentication/session handling, transport, endpoint mappings, validation, and fixtures.
- Centralize HTTP behavior such as base URLs, headers, cookies, timeouts, status mapping, and redaction.
- Keep endpoint-specific code small and declarative where practical.
- Validate every remote response at runtime before returning it.
- Treat HTML, JSON, PDFs, redirects, cookies, filenames, and headers as untrusted input.
- Inject networking, clocks, randomness, and credential/session storage for deterministic testing.
- Do not require a database, web framework, background worker, or UI to use the client.
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

Record the language, runtime, package format, and supported versions in an architecture decision before implementation. Once chosen, configure one canonical formatter, linter, strict type checker where supported, test runner, dependency audit, and build command.

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
- Use UTF-8, platform-neutral paths, and cross-platform APIs.
- Maintain backward compatibility within a major version or publish a clear migration guide.

## Testing Standards

- Unit-test models, validators, redaction, error mapping, retry decisions, authentication state, and transport orchestration without live network access.
- Contract-test every supported endpoint against sanitized fixtures.
- Test expired and invalid sessions, redirects to login, malformed JSON/HTML, unexpected content types, truncated documents, timeouts, rate limits, server failures, and schema drift.
- Every bug fix requires a regression test that fails for the original defect.
- Keep tests deterministic by injecting clocks, randomness, and transport.
- Live tests require explicit credentials and an opt-in command, must default to read-only operations, and must never print response bodies containing PII.
- Formatting, linting, type checking, tests, build, and security checks must pass before a change is complete.

## Release and Consumer Discipline

- Keep `main` releasable and use focused branches and commits.
- Publish explicit versions and release notes for consumer-visible changes.
- Classify breaking changes conservatively; private endpoint drift does not justify silently breaking the client contract.
- Document the minimum supported runtime and the tested TCGplayer behavior date/revision.
- Provide a changelog and migration notes once releases begin.
- The consuming application must depend on a released version or immutable commit, never an unpinned branch.
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

## Early Decisions Still Required

- Language, runtime, packaging, and distribution method.
- Exact authentication/session acquisition and renewal boundaries.
- Verified upstream license or permission status and reuse strategy.
- Initial read-only endpoint inventory and observed response formats.
- Supported packing-slip content types and size limits.
- Session-storage interface and secure defaults.
- Compatibility-test strategy for an authorized seller account.
- Versioning policy before the first consuming application integration.

Resolve consequential choices with short architecture decision records before implementation.
