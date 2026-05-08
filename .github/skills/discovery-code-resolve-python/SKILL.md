---
name: discovery-code-resolve-python
description: Semantic resolver for Python. Enriches Tree-sitter symbols with real type resolution, inheritance chains (MRO), and dynamic import resolution using Jedi.
license: Apache-2.0
compatibility: Requires .discovery/code/symbols/ with Tree-sitter output. Installs Jedi on demand.
metadata:
  author: discovery-code
  version: "1.0"
---

# Resolver — Python

Enriches Tree-sitter symbols with **real type resolution** using **Jedi** (Python static analysis library). Resolves dynamic typing, MRO (Method Resolution Order), decorators, and complex import chains.

## Common Interface

```
INPUT:
  - file_path: string              ← file to resolve
  - tree_sitter_symbols: Symbol[]  ← symbols already extracted by Tree-sitter
  - scan_manifest: object          ← repo context (frameworks, languages)

OUTPUT:
  - enriched_symbols: Symbol[]     ← same symbols enriched with real semantics
  - additional_edges: Edge[]       ← relationships Tree-sitter couldn't see
  - metadata:
      resolver: "jedi"
      version: "<installed version>"
      confidence: "high"
      source: "resolver"
```

## Steps

### 1. Check tool availability

```bash
python3 -c "import jedi; print(jedi.__version__)" 2>/dev/null && echo "JEDI OK" || echo "NOT INSTALLED"
```

If NOT INSTALLED:
```bash
pip install jedi
```

Check for virtual environment:
```bash
ls .venv/bin/python 2>/dev/null || ls venv/bin/python 2>/dev/null || echo "NO VENV"
```

If venv exists, use it for resolution (better import resolution):
```bash
.venv/bin/python -c "import jedi; print('OK')" 2>/dev/null
```

### 2. Receive input

Key symbols to enrich:
- `import_statement` / `import_from_statement` → resolve to actual module/file
- `call` → resolve to actual function/method definition
- `class_definition` → resolve base classes (MRO)
- `decorator` → resolve to actual decorator function
- `assignment` → infer variable type

### 3. Run resolver

Create or use `.discovery/code/tools/py-resolve.py`:

```python
#!/usr/bin/env python3
import jedi
import json
import sys

file_path = sys.argv[1]

with open(file_path) as f:
    source = f.read()

script = jedi.Script(source, path=file_path)

result = {
    "enriched_symbols": [],
    "additional_edges": [],
}

# Resolve all names in the file
for name in script.get_names(all_scopes=True, definitions=True, references=False):
    defined = name.defined_names()
    full_name = name.full_name
    module_path = name.module_path

    result["enriched_symbols"].append({
        "name": name.name,
        "type": name.type,  # "module", "class", "function", "param", "statement"
        "full_name": str(full_name) if full_name else None,
        "module_path": str(module_path) if module_path else None,
        "line": name.line,
        "column": name.column,
        "description": name.description,
    })

# Resolve references (goto definitions)
lines = source.split("\n")
for line_no, line in enumerate(lines, 1):
    for col, char in enumerate(line):
        if char.isalpha() or char == "_":
            try:
                refs = script.goto(line_no, col)
                for ref in refs:
                    if ref.module_path and str(ref.module_path) != file_path:
                        result["additional_edges"].append({
                            "source": f"{file_path}::line{line_no}",
                            "target": f"{ref.module_path}::{ref.name}",
                            "type": "CALLS" if ref.type == "function" else "USES_TYPE",
                            "confidence": "high",
                            "sources": ["resolver"],
                        })
            except Exception:
                pass

# Resolve class hierarchy
for name in script.get_names(all_scopes=True):
    if name.type == "class":
        try:
            cls_defs = name.defined_names()
            # Get base classes through Jedi's inference
            inferred = name.infer()
            for inf in inferred:
                for base in getattr(inf, "py__bases__", lambda: [])():
                    for base_name in base.infer():
                        if hasattr(base_name, "module_path") and base_name.module_path:
                            result["additional_edges"].append({
                                "source": f"{file_path}::{name.name}",
                                "target": f"{base_name.module_path}::{base_name.name}",
                                "type": "INHERITS",
                                "confidence": "high",
                                "sources": ["resolver"],
                            })
        except Exception:
            pass

print(json.dumps(result, indent=2, default=str))
```

Run:
```bash
python3 .discovery/code/tools/py-resolve.py "<file_path>"
```

### 4. Enrich symbols

- **Functions**: add `return_type_inferred`, `parameter_types_inferred`
- **Classes**: add `bases_resolved` (full MRO chain), `metaclass`
- **Variables**: add `inferred_type` (Jedi's type inference)
- **Imports**: add `resolved_module_path`, `resolved_symbol_name`
- **Decorators**: add `decorator_resolved` (actual function/class the decorator is)

### 5. Emit additional edges

| Edge type | What it captures |
|-----------|-----------------|
| `INHERITS` | Base classes resolved via MRO |
| `CALLS` | Function/method calls resolved to definitions |
| `USES_TYPE` | Type annotations + inferred types |
| `IMPORTS` | Import chains resolved to actual files |
| `DECORATES` | Decorator → decorated function/class |

### 6. Return output

Standard resolver output with `resolver: "jedi"`.

## What This Resolver Sees That Tree-sitter Cannot

| Scenario | Tree-sitter | Jedi |
|----------|-------------|------|
| `from . import utils` | Sees relative import | Resolves to actual `utils.py` path |
| `x = get_user()` | Knows `x` is assigned | Infers `x` is `User` type |
| `class A(B, C)` | Sees base names | Resolves full MRO: A → B → C → object |
| `@app.route("/api")` | Sees decorator call | Resolves `app` as Flask instance, extracts route |
| `**kwargs` | Sees parameter | Can infer expected keyword types from callers |
| `if self._dep is None: return stubs.resolve(p)` in method body | Sees call edge to `stubs` — no indication it's conditional | Detects `None`-guard → annotates `behavioral_modes` on class + emits `CONDITIONAL_DELEGATES_TO` edge |
| `additional_data: str = Field(alias="additionalData")` | Sees attribute `additional_data` only | Reads `alias` argument → records `json_name: "additionalData"` + emits `JSON_MAPPED_AS` edge |

## Framework-Specific Enrichment

If scan manifest indicates **Django**:
- Map `urlpatterns` → route → view function
- Map `models.Model` subclasses → entity model with fields
- Map `@login_required`, `@permission_required` → security constraints

If scan manifest indicates **Flask/FastAPI**:
- Map `@app.route` / `@router.get` → HTTP endpoint metadata
- Map dependency injection patterns

### Conditional None-Field Delegation Pattern (Behavioral Modes)

> **Why this matters**: Tree-sitter extracts method signatures and call edges but **not the conditional logic inside method bodies**. A class that behaves differently depending on whether an injected attribute is `None` will appear in the graph as a normal caller of the delegate — with no indication that the delegation is conditional, that two distinct modes exist, or that a simpler construction path activates them. This leads to synthesized docs that silently omit behavioral modes and leave consuming agents unaware of design-time options (e.g., stub mode for tests/local dev).

**This pattern is language-agnostic** (null-field guard appears in Java, Kotlin, C#, TypeScript, Go, Python, etc.) but this resolver handles the **Python** form.

---

**Detection rule**: After Tree-sitter extraction, scan each class for the following structure:

```python
# 1. Attribute assigned in __init__ — any injectable or dependency type:
class MyService:
    def __init__(self, dep=None):  # or dep: Optional[DepType] = None
        self._field = dep

# 2. No-arg or default-arg construction that leaves the field as None:
service = MyService()          # _field is None
service = MyService(real_dep)  # _field is set

# 3. In method bodies — None guard before the live implementation:
def my_method(self, param):
    if self._field is None:
        return FallbackModule.function(param)  # ← mode A (stub/offline/fallback)
    # ... mode B (live/online) implementation
```

**Variants to detect** (all equivalent in semantics):

| Variant | Example |
|---|---|
| `is None` guard | `if self.client is None: return stubs.resolve(p)` |
| `not self.field` guard | `if not self.client: return stubs.resolve(p)` |
| Ternary / conditional expr | `return stubs.resolve(p) if self.client is None else self.client.handle(p)` |
| Boolean flag toggle | `if not self._is_live: return self._fallback.handle(p)` (set in `__init__`) |
| None guard → return empty | `if self.client is None: return []` |
| None guard → raise | `if self.client is None: raise NotImplementedError` |

**Matching conditions** (all must hold):
1. The class has at least one `self._attr` (or `self.attr`) assigned in `__init__` with a default of `None` or typed `Optional[T]`
2. A no-arg or default-parameter construction path exists that leaves the attribute as `None`
3. At least one method body contains an `if self._attr is None` / `if not self._attr` guard or boolean toggle
4. The guarded branch returns or raises without invoking `self._attr` — i.e., it is a self-contained alternate path

---

**When matched, annotate the class symbol** with `behavioral_modes`:

```json
{
  "behavioral_modes": [
    {
      "name": "stub",
      "activation": "_field is None (no-arg constructor or default parameter)",
      "description": "Fallback path — does not invoke the injected dependency"
    },
    {
      "name": "live",
      "activation": "_field is not None (dependency injected via constructor or DI framework)",
      "description": "Live path — delegates to the injected dependency"
    }
  ],
  "stub_delegate_module": "myapp.stubs",
  "stub_delegate_funcs": ["resolve_xxx", "handle_yyy"]
}
```

**When matched, annotate each method** that contains the guard:

```json
{
  "behavioral_guard": {
    "field": "_field",
    "condition": "self._field is None",
    "stub_branch": {
      "delegate_module": "myapp.stubs",
      "delegate_func": "resolve_xxx",
      "delegate_args": ["param1"]
    },
    "live_branch": "invokes self._field.remote_call(param1)"
  }
}
```

**Emit an additional edge** of type `CONDITIONAL_DELEGATES_TO` for each method with a guard:

```json
{
  "type": "CONDITIONAL_DELEGATES_TO",
  "source": "myapp.services.MyService::my_method",
  "target": "myapp.stubs::resolve_xxx",
  "condition": "_field is None",
  "mode": "stub",
  "confidence": "high",
  "source_tool": "jedi"
}
```

---

**What to document in the synthesized foundation** (`service-map.md`): The `discovery-code-synthesize` skill reads these annotations from the module profile. When `behavioral_modes` is present on a class, synthesize a **Behavioral Modes** subsection in the Service Map:

```markdown
### Behavioral Modes — MyService

| Mode | Activation | Behavior |
|---|---|---|
| **stub** | `MyService()` — _field = None | Delegates to stubs.resolve_xxx(param) |
| **live** | `MyService(dep)` — _field is not None | Real remote call via dep |
```

**Practical note for LLM-assisted resolution** (when Jedi is unavailable): read the full source of every class that has an `__init__` parameter with a default of `None`. For each method, check whether the first meaningful statement is a `is None` or falsy guard on that attribute. If yes, extract the delegate module/function and record the annotations above. This takes priority over inferring call chains from signatures alone.

### JSON Wire Name Mapping Pattern

> **Why this matters**: Tree-sitter extracts attribute names but **not field metadata or `alias` arguments**. A field `additional_data` declared as `Field(alias="additionalData")` (Pydantic) appears in the symbol graph with only its Python name — the wire alias is invisible. Agents writing JSON fixtures from the graph will use the wrong key.

**Detection rule**: For each field/attribute in each class, check whether a wire-name alias is declared that differs from the attribute name.

**Patterns to detect** (Python):

| Pattern | Library | Example |
|---|---|---|
| `Field(alias="wire_name")` | Pydantic v1 / v2 | `additional_data: str = Field(alias="additionalData")` |
| `Field(serialization_alias="wire_name")` | Pydantic v2 (serialize-only) | `additional_data: str = Field(serialization_alias="additionalData")` |
| `fields.Field(data_key="wire_name")` | marshmallow | `additional_data = fields.String(data_key="additionalData")` |
| `field(metadata={"alias": "wire_name"})` | dataclasses | `additional_data: str = field(metadata={"alias": "additionalData"})` |

**When matched, annotate the field symbol** with `json_name`:

```json
{
  "name": "additional_data",
  "json_name": "additionalData",
  "annotations": ["Field(alias=\\\"additionalData\\\")"]
}
```

**Emit an edge** of type `JSON_MAPPED_AS`:

```json
{
  "type": "JSON_MAPPED_AS",
  "source": "my_module.MyDto::additional_data",
  "target_key": "additionalData",
  "confidence": "high",
  "source_tool": "jedi"
}
```

**What to document in the synthesized foundation**: The `discovery-code-synthesize` skill reads `json_name` field annotations and `JSON_MAPPED_AS` edges. When any field has a differing wire name:
- `data-model.md`: Fields column shows `field_name ("wire_name")` with ⚠️
- `api-contracts.md`: Endpoint gains a *Response JSON shape* subsection with wire-format keys
- `framework-api-registry.md`: `### JSON Wire Name Corrections` table added

**LLM fallback note** (when Jedi is unavailable): for every class that inherits from `BaseModel`, `Schema`, or whose name ends in `Response`, `Schema`, `Dto`, read each field declaration and look for `alias`, `data_key`, or `serialization_alias` arguments. If found and the value differs from the attribute name, record `json_name` on the field symbol.

## Guardrails

- **DO NOT modify source code** — read-only analysis
- **Handle missing Jedi** — warn and fall back to Tree-sitter + LLM
- **Virtual env awareness** — prefer project's venv for better resolution
- **Dynamic imports** — flag `importlib.import_module()` as unresolvable with `confidence: "low"`
- **Performance** — resolve one file at a time; Jedi can be slow on large files
- **Fallback** — if Jedi fails, return original symbols unchanged with warning
