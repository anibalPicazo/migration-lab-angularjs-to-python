---
version: "1.0"
status: active
owner: TBD
created: YYYY-MM-DD
last-updated: YYYY-MM-DD
adopted-from:
  - <path to framework guide or architecture decision records>
changelog:
  - version: "1.0"
    date: YYYY-MM-DD
    change: Generated from guardrails and framework documentation
---

# Anti-Patterns

> For each guardrail violation, see the corresponding G-XX reference in [guardrails.md](guardrails.md).

---

## Guidance

- Each anti-pattern MUST reference exactly one guardrail (`G-XX`) from `guardrails.md`.
- Every entry MUST include: a ❌ forbidden example, a ✅ correct example, and a **Detection** snippet.
- Detection commands should be runnable as-is (PowerShell preferred; adapt to project tooling).
- Keep examples minimal — enough to illustrate the mistake, not a full implementation.
- Add entries here whenever a recurring mistake is identified in code reviews or AI-generated output.

---

## Quick Checklist

Guidance: List every guardrail as a checkbox. Agents and reviewers scan this before submitting code.

Before submitting any generated code, verify:

- [ ] [Brief description of constraint] (G-01)
- [ ] [Brief description of constraint] (G-02)
- [ ] [Brief description of constraint] (G-03)
- [ ] [Add one line per guardrail defined in guardrails.md]

---

## Anti-Pattern #1 — [Short Name of Anti-Pattern]

**Violates:** G-XX

Guidance: Describe in one sentence why this pattern is harmful.

❌ **FORBIDDEN:**
```[language]
// Bad example — show exactly what not to do
```

✅ **CORRECT:**
```[language]
// Fixed example — show the minimal correct form
```

**Detection:**
```powershell
# Command to find this anti-pattern in the codebase
```

---

## Anti-Pattern #2 — [Short Name of Anti-Pattern]

**Violates:** G-XX

Guidance: You may include multiple ❌ variants if there are several common wrong forms.

❌ **FORBIDDEN — [Variant A]:**
```[language]
// Bad variant A
```

❌ **FORBIDDEN — [Variant B, e.g. silent swallowing]:**
```[language]
// Bad variant B
```

✅ **CORRECT:**
```[language]
// Fixed example
```

**Detection:**
```powershell
# Command to find this anti-pattern in the codebase
```

---

<!-- Repeat the Anti-Pattern block above for each guardrail defined in guardrails.md.    -->
<!-- Recommended ordering: structural patterns first, then error handling, then testing.     -->
<!-- Numbering is sequential and stable — do not reorder entries once published.            -->

---

*Validation script reference: `scripts/validate-anti-patterns.[ps1|sh]`*

