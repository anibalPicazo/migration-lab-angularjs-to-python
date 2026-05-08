---
name: delivery-specify
description: Build a backlog when feature is unknown, produce a 12-section ready Feature Spec, and run migration readiness gates M3/M4 from foundational sources.
license: Apache-2.0
compatibility: Requires .foundation/ and optional docs/requirements.
metadata:
  author: delivery-agent
  version: "2.2"
---

Produce a standalone Feature Spec that is ready for OpenSpec artifact generation.

---

## Step 1 - Identify feature

If user already provides a feature, use it.

If feature is not provided:
1. Read foundation docs.
2. Derive 8-12 backlog candidates.
3. Ask user to select one feature before continuing.

Each candidate must include:
- title
- owning service
- intent
- scope boundary
- up to 3 acceptance scenarios
- interfaces touched
- data entities
- risks

---

## Step 2 - Read baseline context

Read available foundation documents in this order when present:
1. .foundation/project-intent.md
2. .foundation/domain-landscape.md
3. .foundation/data-model.md
4. .foundation/service-map.md
5. .foundation/guardrails.md
6. .foundation/api-contracts.md
7. .foundation/anti-patterns.md
8. .foundation/task-spec.md
9. .foundation/framework-api-registry.md
10. .foundation/coding-conventions.md
11. .foundation/architecture-decisions.md
12. .foundation/testing-strategy.md
13. .foundation/user-journey-ui.md
14. .foundation/crossref-summary.md

If docs/requirements exists, ingest feature sources from there.

---

## Step 3 - Resolve ambiguities

Before writing the final spec:
- list missing assumptions
- list contradictions between sources
- list unknown API signatures or data contracts

Ask user to resolve blocking ambiguity.

---

## Step 4 - Write Feature Spec (12 sections)

1. Intent
2. Scope (in/out)
3. Constraints
4. Functional behavior (Given/When/Then)
5. Domain and data
6. Service ownership
7. Interfaces
8. UI/Journey
9. Test expectations
10. Observability
11. Open questions
12. References

Rules:
- max 5 acceptance scenarios
- deterministic wording
- no unresolved blockers in final ready state

---

## Step 5 - Definition of Ready

All must be true:
- intent is clear
- scope is explicit
- scenarios are deterministic
- owner is identified
- constraints from guardrails are applied
- data entities are identified
- interface deltas are known
- tests are mapped
- open questions are resolved

If any fails, do not proceed to propose.

---

## Step 6 - Migration readiness gates (M3/M4)

Run this step only for migration features.

Source policy:
- use only foundational sources as validation input
- do not inspect legacy source code directly during this step

### Gate M3 - API Contract Verification

Validate section 7 (Interfaces) against foundational contracts:
- .foundation/api-contracts.md
- migration evidence already consolidated in foundational docs (when available)

Pass criteria:
- method, endpoint, params/body, and response are complete per contract
- discrepancies and assumptions are explicitly recorded

Output requirement:
- section 7 must include a verification table with source references from foundational docs

### Gate M4 - Route Inventory Verification

Validate section 8 (UI/Journey) against foundational route inventory:
- .foundation/service-map.md
- route cross-reference documents under .foundation/ when available

Pass criteria:
- all relevant routes are classified for migration impact
- any new capability route is listed in open questions and explicitly approved

Output requirement:
- section 8 must include route classification and approval status for new capability routes

Ready rule for migration specs:
- a migration feature is not READY if M3 or M4 fails

---

## Handoff

When READY:
- use openspec-propose (preferred)
- or openspec-new-change plus openspec-continue-change
