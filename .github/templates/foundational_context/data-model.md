# Canonical Data Model (Core Entities)

Version: 0.1

Owner: <name/role>

Last updated: <YYYY-MM-DD>

Status: Draft | Active

## Purpose

Guidance: Prevent invented fields and naming variants. Ground Feature Specs and tests in authoritative structures.

## Core entity list

Guidance: List only core entities; feature-level additions are refined through DevLoop.

Example:

User, Applicant, VerificationRequest, Account, AuditEvent

## Entity definitions

Guidance: Meaning, identifier, lifecycle, key fields. Keep fields to what is essential.

Example:

### Applicant

Meaning: A person undergoing onboarding.

Primary ID: applicant_id (UUID)

Lifecycle: created → pending_verification → verified | rejected

Key fields:

- applicant_id: UUID

- status: enum(pending_verification, verified, rejected)

- created_at: timestamp

## Relationships

Guidance: Cardinality matters for correct code generation and validation.

Example:

Applicant 1..* VerificationRequest

Verified Applicant 1..1 Account

## Data invariants (hard rules)

Guidance: Rules that must never be violated; agents should treat these as constraints.

Example:

- Account must not exist unless Applicant.status = verified

- AuditEvent must be immutable once created

## Canonical formats

Guidance: Standardize what often breaks integrations.

Example:

- timestamps in ISO-8601 UTC

- ISO 3166-1 alpha-2 country codes

- currency in ISO 4217

## Schema artifacts (optional)

Guidance: Link to JSON Schema / DB schema / protobuf definitions if they exist.

- <link to schema files>
