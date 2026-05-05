# Security Policy

This repository is primarily a documentation reference. Security relevance is concentrated in three places: the runnable code under `/examples`, doc inaccuracies that could mislead production decisions, and links to third-party resources.

## Reporting

Please email **security@cryptorefills.com** with a clear subject line. Do not open public issues or pull requests for security matters.

If you prefer encrypted communication, request our PGP key in your initial message and we will reply with the public key fingerprint.

## What we want in a report

- A clear description of the issue.
- The path of the file or resource affected.
- Steps to reproduce, if applicable.
- Impact assessment from your perspective.
- Suggested remediation, if you have one.

## Scope

**In scope:**
- Code in `/examples` (Apache-2.0 licensed).
- Documentation inaccuracies that could materially mislead a production deployment.
- Misconfigured GitHub Actions workflows or repository settings.
- Outdated or rotated third-party links that resolve to unintended destinations.

**Out of scope:**
- Issues in third-party protocols, products, or services we link to. Please report those to the maintaining organization (we link to their canonical sources for this reason).
- Hypothetical or theoretical issues without a concrete reproduction.
- Issues in users' downstream forks of this repository.

## Supported versions

This is a documentation repository. The `main` branch is the supported version. Forks and historical commits are not maintained.

## Disclosure timeline

- We acknowledge receipt within **3 business days**.
- We aim to provide an initial assessment within **7 business days**.
- We target a fix or mitigation within **30 days** of acknowledgement, depending on complexity.
- We follow a coordinated-disclosure model. We will not publish details until a fix is in place, unless the reporter requires a different timeline for legitimate reasons.

## Recognition

Reporters who request acknowledgement will be credited in a Hall of Thanks file once their report is resolved. If you prefer to remain anonymous, we will respect that preference.

## Questions

For non-security questions, please use [GitHub Discussions](https://github.com/cryptorefills/agentic-commerce/discussions) (once enabled) or open a regular issue.
