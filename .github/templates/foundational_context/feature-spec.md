# Feature Spec: <Feature Name>

Feature ID: <JIRA-123 / internal id>

Owner: <name/role>

Service owner(s): <service/module names from Service & Capability Map>

Status: Draft | Ready for Plan | In Implementation | Validated | Done

Last updated: <YYYY-MM-DD>

## 0. Purpose of this Feature Spec

Guidance: This doc is the primary execution context for AI agents implementing this feature.

Guidance: It must be operationally standalone: enough detail to implement + test without hunting through other docs.

Guidance: Links exist for traceability, not as required reading for first-pass implementation.

## 1. Intent and Outcome

Guidance: One paragraph: what changes for the user/system when this feature is delivered.

Example:

Enable a user to submit identity details and start verification, producing a trackable onboarding status.

## 2. Scope (In / Out)

Guidance: Define sharp scope boundaries; agents need explicit limits.

In:

- <what is included>

Out:

- <what is explicitly excluded>

Example:

In: create applicant, start verification, store status, expose status endpoint

Out: document upload, selfie capture, third-party fraud scoring

## 3. Primary Constraints and Guardrails

Guidance: Pull only the feature-relevant constraints from Architectural Guardrails and business constraints.

Must:

- <must comply with>

Must not:

- <must not do>

Example:

Must: encrypt PII at rest, follow standard HTTP client wrapper, pass CI gates

Must not: store secrets in repo, bypass authz checks

## 4. Functional Behaviour (What "correct" means)

Guidance: Describe behaviour in clear, testable terms. Avoid vague prose.

Guidance: If you have acceptance criteria already (Jira/PRD), rewrite them here into precise conditions.

### 4.1 Acceptance Scenarios (executable style)

Guidance: Provide 2–5 scenarios. Keep them deterministic. These drive test generation.

Format suggestion:

Scenario: <name>

Given <preconditions>

When <action>

Then <expected result>

Example:

Scenario: Create Applicant

Given no applicant exists for email X

When POST /v1/applicants is called with email X and country NL

Then respond 201 with applicant_id

And applicant.status = "pending_verification"

And an AuditEvent is recorded

Scenario: Reject Duplicate Applicant

Given applicant exists for email X with status "pending_verification"

When POST /v1/applicants is called with email X

Then respond 409 with problem+json

And no new applicant is created

## 5. Domain and Data (What changes in the model)

Guidance: Pull the minimum necessary from Canonical Data Model; do not redefine the full model.

### 5.1 Entities and fields touched

Example:

Applicant: applicant_id, status, created_at, email

VerificationRequest: request_id, applicant_id, provider, status

### 5.2 Data invariants specific to this feature

Guidance: Add only new invariants or feature-specific constraints.

Example:

- A VerificationRequest must reference an existing Applicant

- Applicant.status transitions must be validated against allowed states

### 5.3 Persistence / migration notes (if needed)

Guidance: If schema changes are required, state it explicitly and minimally.

Example:

Add column applicant.country_code (CHAR(2), not null)

## 6. Service Ownership and Boundaries

Guidance: Use the Service & Capability Map to place responsibilities.

Example:

- onboarding-service owns Applicant lifecycle and VerificationRequest creation

- identity-service provides authn/authz; onboarding-service consumes it

## 7. Interfaces (API / Events / Integrations)

Guidance: Only include what this feature adds/changes; point to canonical contracts for full detail.

### 7.1 API changes

Example:

- POST /v1/applicants (new)

- GET /v1/applicants/{id}/status (new)

### 7.2 Event changes (if applicable)

Example:

- Emit ApplicantCreated event (topic onboarding.applicant.created)

### 7.3 External dependencies (if applicable)

Example:

KYC provider: synchronous request, max 30s timeout, retry policy per guardrails

## 8. UI / User Journey (optional; include only if UI exists)

Guidance: Add a journey slice and UI intent if the feature is user-facing.

Journey slice:

- Entry:

- Steps:

- Exit:

UI intent:

- <what the user must understand / be able to do>

## 9. Test Expectations

Guidance: Explicitly state test types expected so the agent generates the right mix.

Example:

- Unit tests for Applicant status transitions

- Integration tests for POST /v1/applicants

- Contract tests against OpenAPI paths added

- Negative tests for duplicate applicant and invalid transitions

## 10. Observability / Rollout (optional, but recommended for production systems)

Guidance: Keep it minimal; focus on what must be instrumented.

Example:

- Metrics: applicant_create_success, applicant_create_conflict

- Logs: structured log on applicant creation with applicant_id

- Rollout: feature flag "onboarding_applicant_v1" default off

## 11. Open Questions / Decisions Needed

Guidance: Keep short; unresolved items must block "Ready for Plan".

Example:

- Do we allow multiple applicants per email across countries?

- Is the provider callback mandatory for phase 1?

## 12. References (canonical sources)

Guidance: Links for traceability. Do not require these for basic implementation.

- Project Intent: /docs/intent.md

- Domain Landscape: /docs/domain-landscape.md

- Data Model: /docs/data-model.md

- Service Map: /docs/service-map.md

- Guardrails: /docs/guardrails.md

- API Contract: /contracts/openapi.yaml

- Jira: <link>

- Figma (if UI): <link>

## 13. Change Log

- <date> <change summary> <author>
