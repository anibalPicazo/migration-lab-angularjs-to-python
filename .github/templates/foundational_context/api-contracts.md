# API & Integration Contracts (Index)

Version: 0.1

Owner: <name/role>

Last updated: <YYYY-MM-DD>

Status: Draft | Active

## Purpose

Guidance: Index canonical contract artifacts and capture behavioral expectations.

Guidance: Feature Specs should reference specific endpoints/events and constraints.

## Canonical contract files

Example:

- REST: /contracts/openapi.yaml

- Events: /contracts/asyncapi.yaml

- Auth: /contracts/authz.md

## Key endpoints/events (curated summary)

Example:

- POST /v1/applicants: create onboarding applicant

- POST /v1/verification-requests: start verification

- Event ApplicantVerified: emitted when onboarding completes

## Contract invariants (global rules)

Example:

- All endpoints are versioned under /v1

- Error responses follow RFC7807 problem+json

## External integrations and constraints

Example:

KYC provider: callback within 30s; retry policy exponential backoff, max 5 retries

## Minimal snippet (optional)

Guidance: Provide a tiny snippet to show shape; keep canonical details in the contract file.

Example:

```yaml
paths:
  /v1/applicants:
    post:
      summary: Create applicant
      responses:
        "201": { description: Created }
```
