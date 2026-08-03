# Security

## Reporting

Do not open a public issue containing credentials, session cookies, customer data, order details, packing slips, or captured HTTP traffic. Report a vulnerability privately to the repository owner through GitHub's private vulnerability reporting feature when available.

## Credential handling

This package accepts an existing authorized seller session and holds it only long enough to create request headers. It does not persist credentials, log request bodies, log response bodies, or automate login. Consumers are responsible for protected session storage, rotation, and revocation.

Never use production credentials in tests or bug reports.
