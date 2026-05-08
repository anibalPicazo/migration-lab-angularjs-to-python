---
name: delivery-validate
description: Run runtime validation gates for build, tests, coverage, guardrails, and anti-pattern scanning.
license: Apache-2.0
compatibility: Tech-stack agnostic; commands and thresholds are read from foundation docs.
metadata:
  author: delivery-agent
  version: "2.1"
---

Run runtime validation before archive.

---

## Gate 1 - Build and tests

Read .foundation/guardrails.md and execute configured build and test commands.

Pass criteria:
- build succeeds
- tests pass
- no unhandled test errors

On failure:
- report failing test and root error
- stop further gates

---

## Gate 2 - Coverage

Read thresholds from .foundation/guardrails.md.
If not defined, use fallback minimum 80 percent for core service and controller layers.

Report:
- measured coverage
- threshold
- status per relevant layer

---

## Gate 3 - Guardrail commands

Execute detection commands listed in .foundation/guardrails.md.

Pass criteria:
- every detection command returns zero violations

On violation:
- list file and line references for each result

---

## Gate 4 - Anti-pattern scan

If .foundation/anti-patterns.md exists, run all its detection commands.

Pass criteria:
- zero violations

If file does not exist:
- mark gate as skipped

---

## Output

Return a structured runtime validation report with:
- per-gate status
- blockers
- final verdict

Note:
- spec alignment is executed separately through openspec-verify-change.
