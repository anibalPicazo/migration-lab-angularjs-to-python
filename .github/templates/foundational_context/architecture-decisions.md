---
version: "1.0"
status: active
owner: TBD
created: YYYY-MM-DD
last-updated: YYYY-MM-DD
adopted-from:
  - <path to architecture documentation, RFC, or ADR source>
changelog:
  - version: "1.0"
    date: YYYY-MM-DD
    change: Generated during discovery phase from documentation and codebase analysis
---

# 05 — Architecture Decisions

> This document captures Architecture Decision Records (ADRs) for this project.  
> Each decision is **immutable once accepted** — superseded decisions are marked, not deleted.  
> Coding agents MUST read this before proposing structural changes or selecting technologies.

---

## Guidance

- Use the ADR format below for every significant technical decision.
- **Accepted** decisions are constraints — they are not open for debate during delivery.
- Decisions with status **Proposed** or **Under review** are candidates for user confirmation.
- Add new ADRs when discovery reveals an undocumented architectural decision.
- Remove Guidance blocks when sections contain real project data.

---

## ADR Index

| ADR | Title | Status | Date |
|---|---|---|---|
| ADR-001 | [First decision title] | Accepted | YYYY-MM-DD |
| [Add rows as ADRs are discovered or proposed] | | | |

---

## ADR-001 — [Decision Title]

**Status:** Accepted | Proposed | Superseded by ADR-XXX | Deprecated

**Date:** YYYY-MM-DD

### Context

Guidance: Describe the problem or technical constraint that forced this decision.  
What was happening, what options were available, what constraints existed?

*[Describe the situation. One paragraph max.]*

### Decision

Guidance: State the decision clearly in one sentence using active voice.

*We chose to [decision] because [primary reason].*

### Consequences

**Positive:**
- [Benefit 1]
- [Benefit 2]

**Negative / Trade-offs:**
- [Trade-off 1]
- [Trade-off 2]

**Neutral:**
- [Side-effect or ongoing constraint]

---

## ADR Template (copy to add new decisions)

```markdown
## ADR-XXX — [Decision Title]

**Status:** Proposed

**Date:** YYYY-MM-DD

### Context

[Describe the situation.]

### Decision

We chose to [decision] because [primary reason].

### Consequences

**Positive:**
- 

**Negative / Trade-offs:**
- 

**Neutral:**
- 
```

---

## 📎 Sources

*Populated by discovery agents. List architecture documentation, RFCs, and codebase analysis artifacts used to derive these decisions.*

