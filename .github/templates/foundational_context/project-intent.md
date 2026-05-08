# Project Intent & Business Frame

Version: 0.1

Owner: <name/role>

Last updated: <YYYY-MM-DD>

Status: Draft | Active

## Purpose

Guidance: This is the north star. Answer: why are we building this, for whom, what is success, what is out of scope.

Guidance: Keep it short and stable. Feature Specs will reference it, not reproduce it.

## Problem statement

Guidance: Describe the concrete business problem and why it matters now.

Example:

We need to reduce customer onboarding time from 3 days to < 1 hour by automating identity verification and account provisioning.

## Target users and stakeholders

Guidance: Primary users, secondary users, and the stakeholders who impose constraints (compliance, operations).

Example:

Primary: retail customer

Secondary: onboarding operations agent

Stakeholders: compliance, fraud, support

## Success criteria (measurable)

Guidance: Use measurable outcomes.

Example:

- 90% of onboarding requests completed in < 10 minutes

- < 0.5% false positives in verification

- audit trail retained for 7 years

## Non-goals / out of scope

Guidance: Explicitly protect the team from scope creep.

Example:

- No support for corporate accounts in phase 1

- No migration of legacy CRM in this project

## Constraints (business/operational)

Guidance: Constraints that affect delivery, not deep architecture.

Example:

- Must comply with GDPR

- Must support English + Spanish at launch

- Must integrate with existing KYC provider

## Key assumptions

Guidance: Assumptions will be tested and revised via DevLoop.

Example:

- KYC provider uptime >= 99.9%

- Users have smartphone access for selfie verification

## Links to client artifacts (if any)

Guidance: Keep pointers, do not copy large docs.

- <link to PRD / charter>

- <link to compliance constraints>
