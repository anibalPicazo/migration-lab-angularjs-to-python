# Architectural Guardrails

Version: 0.1

Owner: <architect/lead>

Last updated: <YYYY-MM-DD>

Status: Draft | Active

## Purpose

Guidance: Make constraints explicit and enforceable. This is what keeps AI-generated output aligned.

Guidance: Keep it short; split into sub-docs only when necessary.

## Allowed technologies (hard constraints)

Example:

Backend: Java 21 + Spring Boot

Frontend: React + TypeScript

Infra: Terraform

CI: GitHub Actions

## Forbidden patterns (hard constraints)

Example:

- No direct database access from frontend

- No secrets in config files

- No synchronous calls between services A and B (use events)

## Architecture and code rules (must/should)

Guidance: Only rules that materially reduce risk and divergence.

Example:

- All external calls must use the standard HTTP client wrapper

- Every new endpoint must have contract tests

- Logging must use structured JSON logging

## Quality gates (definition of "valid")

Guidance: This defines what "Validate" means in DevLoop.

Example:

- Unit tests required for new business logic

- Lint/format passes

- SAST scan passes

- Coverage threshold: 80% on changed files

## Security and compliance constraints

Example:

- PII must be encrypted at rest

- Audit events must be immutable

- Data retention: 7 years
