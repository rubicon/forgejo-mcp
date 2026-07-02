# Security Policy

## Supported versions

This project is pre-1.0. Security fixes are released against the latest published
minor.

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |
| < 0.1   | No        |

## Reporting a vulnerability

Please report security issues **privately**. Do not open a public issue, pull
request, or discussion for a suspected vulnerability.

Use either channel:

- GitHub: the repository's **Security → Report a vulnerability** (private
  advisory) form.
- Email: [dax@rubicontv.com](mailto:dax@rubicontv.com).

Include the affected version, a description of the issue, and reproduction steps
or a proof of concept if you have one.

## What to expect

- Acknowledgement of your report within **3 business days**.
- An initial assessment and severity classification within **10 business days**.
- Coordinated disclosure: we will agree on a disclosure timeline with you and
  credit you in the release notes unless you prefer to remain anonymous.

## Scope notes

This server exposes read tools plus additive writes only, with no merge, delete,
or admin surface, and it holds no secrets at rest. The API token and base URL are
supplied at runtime. Reports that depend on granting the server a broadly scoped
token contradict the documented least-privilege guidance; please include the
token scope you tested with.
