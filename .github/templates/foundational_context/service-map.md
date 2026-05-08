# Service & Capability Map

Version: 0.1

Owner: <name/role>

Last updated: <YYYY-MM-DD>

Status: Draft | Active

## Purpose

Guidance: Define where functionality lives. Agents need ownership to place code, tests, and contracts correctly.

Guidance: This is logical ownership, not deployment topology.

## Services (or modules) and owned capabilities

Guidance: If not using microservices, treat these as modules/components.

Example:

### onboarding-service

Owns:

- Applicant lifecycle

- Verification orchestration

- Provisioning workflow state

### identity-service

Owns:

- User identity

- Authentication and authorization

- Identity verification integration (if centralized)

## Ownership rules (guardrails)

Guidance: Explicit "must live here" rules prevent architectural drift.

Example:

- All KYC workflow state lives in onboarding-service

- All access control decisions live in identity-service

## Integration points (high level)

Guidance: Identify edges; details go into API/contract docs.

Example:

onboarding-service calls identity-service to create verified user records.

## Non-functional allocation (optional)

Guidance: If different services have distinct SLAs, state it.

Example:

onboarding-service must handle burst traffic during marketing campaigns.

## Client artifacts (optional)

Guidance: Link to existing catalogs/taxonomies.

- <link to client service catalog>
