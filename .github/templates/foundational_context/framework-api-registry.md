---
version: "1.0"
status: active
owner: TBD
created: YYYY-MM-DD
last-updated: YYYY-MM-DD
adopted-from:
  - <path to API reference doc>
changelog:
  - version: "1.0"
    date: YYYY-MM-DD
    change: Initial extraction from framework documentation
---

# Framework API Registry

> **DOCUMENT TYPE:** Factual registry of API signatures. Does not contain subjective or advisory rules.
> **PRECEDENCE:** This document overrides any pseudocode generated in `design.md` or `tasks.md`.
> **MANDATORY LOOKUP:** Any agent generating code that invokes `[Framework Name]` MUST verify signatures here before writing any call in `tasks.md` or source code.

---

## Instruction for Change-Generation Agents

Before writing any call to a `[Framework Name]` API in `design.md` or `tasks.md`:

1. Locate the service in this document.
2. Copy the exact signature from the **Correct Signature** column.
3. **Never** use variants listed under **Forbidden Signatures** — they will cause a compilation error.

If the method does not appear in this registry → mark it as ⚠️ and verify manually with the user before generating code.

---

## [ServiceName / ClassName]

### [methodName]

| Attribute | Value |
|-----------|-------|
| **Receiver** | `[type of the receiver object, e.g. ExtendedCaseService]` |
| **Correct Signature** | `receiver.methodName(param1: Type1, param2: Type2): ReturnType` |
| **Forbidden Signatures** | `receiver.alternativeMethodName(...)` · `receiver.similarMethod(...)` |
| **Compilation error** | `error: cannot find symbol — method alternativeMethodName(...)` |
| **Source** | `path/to/api-reference.md`, section X |
| **Notes** | [additional context if applicable, e.g. "the second parameter is mandatory even if null"] |

---

<!-- Repeat the block above for each critical framework method -->
<!-- Only include methods where a mistake is easily made:                        -->
<!--   1. The framework explicitly documents incorrect variants                  -->
<!--   2. Multiple similar signatures exist that are easily confused             -->
<!--   3. The method name does not reflect its real signature (surprising agent) -->
