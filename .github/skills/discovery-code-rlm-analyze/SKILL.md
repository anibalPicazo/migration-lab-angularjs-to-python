---
name: discovery-code-rlm-analyze
description: Recursive LLM analysis for queries that exceed direct context window. Hierarchically decomposes large multi-file analysis tasks and produces structured Markdown and JSON reports.
license: Apache-2.0
compatibility: Any indexed codebase. Requires symbols and graph from discovery-code-extract-symbols.
metadata:
  author: discovery-code
  version: "1.0"
---

# discovery-code-rlm-analyze — Recursive LLM Analysis for Large Queries

**Invoke when**: Query depth or context requirement exceeds direct LLM context window (>8K tokens), or analysis spans multiple files/modules requiring hierarchical decomposition. Typical use: "Trace data flow across 50+ files" or "Map all HTTP calls system-wide".

**Inputs**:
- Codebase path: `.discovery/code/` directory (symbols, graph, modules)
- Query or analysis prompt: `<description>` (e.g., "Trace data flow from API input to database commit")
- Optional: Max REPL iterations (default: 20), max sub-calls (default: 50), token budget per sub-call (default: 8K)

**Outputs**:
- **Analysis Report (Markdown)**: `.discovery/code/scans/<slug>/rlm-analysis-<timestamp>.md` — Human-readable findings
- **Analysis Report (JSON)**: `.discovery/code/scans/<slug>/rlm-analysis-<timestamp>.json` — Structured with metadata, sub-calls, findings
- **REPL Session Log**: `.discovery/code/scans/<slug>/rlm-repl-<timestamp>.log` — Full LLM decomposition steps

**Prerequisites**:
- ✅ Codebase indexed: `.discovery/code/modules/*/`, `.discovery/code/graph/edges.json` exist from `discovery-code-extract-symbols`
- Python execution: `python3` with standard library (no external deps required)

**Steps**:

1. **Parse Query & Estimate Context**
   - Load `.discovery/code/graph/edges.json` (relationship graph)
   - Load `.discovery/code/modules/*/symbols.json` (all symbol indexes)
   - Estimate: Required context tokens to answer directly
   - Decision: If < 4K tokens available after question → proceed with direct LLM
   - Decision: If ≥ 4K tokens needed → enter RLM (recursive decomposition) mode

2. **RLM Mode: Decompose Into Sub-Questions**
   - Primary LLM call: "Given this query: '{query}', break it into 5-10 independent sub-questions that together answer the original query. Each sub-question should be answerable by examining 1-5 files. Return numbered list with file hints."
   - Parse LLM response: Extract sub-questions and file hints
   - Log: Decomposition strategy to REPL log

3. **RLM Mode: Load Code Into REPL Environment**
   - Create pseudo-REPL (simulation; no actual interpreter):
     - Bind all relevant file contents to pseudo-variables: `files = {filename: content, ...}`
     - Bind graph context: `graph = {edges.json parsed}`
     - Bind module index: `modules = {slug: index.json, ...}`
   - Initialize: Set REPL iteration counter = 0, sub-call counter = 0

4. **RLM Mode: Iterative Sub-Analysis Loop**
   - For each sub-question:
     1. Sub-LLM call (with REPL context budget 8K tokens): "Using this REPL environment [<REPL state>], analyze: '{sub-question}'. Return findings in Markdown."
     2. Parse sub-LLM response: Extract findings, identify new questions, update REPL state
     3. Increment sub-call counter; check: sub_calls < max_sub_calls (default 50)
     4. Log: Sub-call request/response to REPL log
   - Loop until: All sub-questions answered OR sub-call counter exhausted

5. **RLM Mode: Synthesize Findings**
   - Final LLM call: "Given these sub-analyses [<all sub-responses>], synthesize a coherent answer to the original query: '{original query}'. Provide 1-2 key findings + evidence from file locations + risk/confidence assessment."
   - Parse response: Extract findings, references, confidence levels

6. **Generate Markdown Report**
   - Template: `.discovery/code/scans/<slug>/rlm-analysis-<timestamp>.md`
   - Sections:
     - **Query**: Original user inquiry
     - **Decomposition**: List of sub-questions + rationale
     - **Findings**: Synthesized results with evidence
     - **File References**: Annotated map of examined files (path, line ranges, relevance)
     - **Confidence**: "High" (consistent across multiple files), "Medium" (inferred), "Low" (single mention)
     - **REPL Iterations**: Count of steps taken; iteration efficiency metric

7. **Generate JSON Report**
   - Structure:
     ```json
     {
       "timestamp": "<ISO-8601>",
       "query": "<original>",
       "decomposition": [
         {"id": 1, "sub_question": "...", "file_hints": ["file.ts"]},
         ...
       ],
       "findings": [
         {"summary": "...", "confidence": "high|medium|low", "file_references": ["src/x.ts:10-20"]},
         ...
       ],
       "repl_iterations": <count>,
       "sub_llm_calls": <count>,
       "max_sub_calls": <int>,
       "total_tokens_used": <int>,
       "status": "success|exhausted|error"
     }
     ```

8. **Log REPL Session**
   - Capture all LLM requests/responses in `.discovery/code/scans/<slug>/rlm-repl-<timestamp>.log`
   - Format (per iteration):
     ```
     ========== Iteration 1 ==========
     [DECOMPOSITION REQUEST]
     Query: ...
     [DECOMPOSITION RESPONSE]
     Sub-questions: ...
     
     ========== Sub-call 1.1 ==========
     [SUB-ANALYSIS REQUEST]
     Context: <first 2K tokens of REPL state>
     Sub-question: ...
     [SUB-ANALYSIS RESPONSE]
     Findings: ...
     ```

9. **Update `.discovery/code/state.json`**
   - Append entry:
     ```json
     {
       "type": "rlm_analysis",
       "query": "<slug or description>",
       "status": "success|exhausted|error",
       "report_path": ".discovery/code/scans/<slug>/rlm-analysis-<timestamp>.md",
       "json_path": ".discovery/code/scans/<slug>/rlm-analysis-<timestamp>.json",
       "repl_log_path": ".discovery/code/scans/<slug>/rlm-repl-<timestamp>.log",
       "iterations": <count>,
       "sub_calls": <count>,
       "created": "<ISO-8601>"
     }
     ```

**Error Handling**:
- **LLM timeout on sub-call**: Skip that sub-question; log timeout; continue with remaining sub-calls
- **Sub-call counter exhausted**: Stop early; synthesize findings from completed sub-calls; mark status as "exhausted"
- **REPL context explosion** (state grows > 16K tokens): Truncate oldest findings; log truncation event
- **Invalid JSON from LLM response**: Parse with regex fallback; extract Markdown fragments if JSON unparseable
- **Graph or symbol files missing**: "Codebase index incomplete; run `discovery-code-extract-symbols` first"

**Configuration (Optional)**: Arguments passed to skill:
- `--max-iterations 20` — Set REPL iteration limit (default: 20)
- `--max-sub-calls 50` — Set sub-LLM call limit (default: 50)
- `--token-budget 8000` — Set token budget per sub-call (default: 8000)
- `--timeout 120` — Set LLM call timeout in seconds (default: 120)

**Quality Checks**:
- Verify Markdown is well-formed (check for unclosed code blocks, missing headers)
- Verify JSON is valid (parse with jq or Python json)
- Verify file references exist in codebase (spot-check 3 random references)
- Verify findings are grounded in file locations (not speculative)
- Confidence assessment is appropriate (high confidence → multiple corroborating files)

**Integration with Discovery-Code Agent**:
- Called by: `@discovery-code deep-analyze <query>` → routes to this skill
- Input: User or agent provides free-form analysis question
- Output: `.discovery/code/scans/<slug>/rlm-analysis-<timestamp>.md` readable by other agents + humans
- **Benefit**: Enables nuanced, multi-file analysis without user doing manual assembly

**Example Invocation**:
```bash
# Direct invocation
sca-rlm-analyze "Trace data flow from HTTP POST /marks/update to database commit in marks service"

# Result: .discovery/code/scans/<slug>/rlm-analysis-2024-11-15T10-30-45Z.md
# Output snippet:
#   Query: Trace data flow from HTTP POST /marks/update to database commit...
#   Decomposition:
#     1. Find HTTP route handler for POST /marks/update (marks.controller.ts)
#     2. Identify service method called (marks.service.ts)
#     3. Trace database queries (marks.repository.ts)
#     4. Map request fields to stored columns (schema)
#   Findings:
#     - HTTP → Service: DTO mapping in MarksController.updateMarks()
#     - Service → Repo: Direct pass-through (no transformation)
#     - Repo → DB: Parameterized query via prisma.marks.update()
#     - Risk: No input validation in controller (validate in service instead)
#   Evidence: src/controllers/marks.controller.ts:L45-60, ...
```

**Execution Model**:
- RLM analyzes file-by-file, not line-by-line
- Each sub-call gets ~8K token budget (configurable)
- Max 50 sub-calls (configurable) prevents runaway LLM spending
- Max 20 REPL iterations (configurable) prevents infinite loops
- Non-deterministic: Results may vary if LLM decomposition differs (but semantically similar)

**Comparison with Direct LLM Analysis**:
| Aspect | Direct | RLM |
|--------|--------|-----|
| Context size | Limited to 4-8K tokens | Unlimited (recursive) |
| Query complexity | Simple, single-file | Complex, multi-file |
| Execution time | ~1-2s | ~5-30s (depends on iterations) |
| Token cost | ~1-2K per query | ~20-100K per query (proportional to analysis depth) |
| Reasoning transparency | Hidden in LLM | Visible in REPL log |
| **When to use** | Quick lookups | Deep architectural analysis |

**Complementary Skills**:
- Use `discovery-code-extract-symbols` for symbol inventory
- Use `discovery-code-build-graph` for relationship graph
- Use `discovery-code-rlm-analyze` for complex multi-file reasoning
- Use `discovery-code-find-usages` for targeted single-symbol searches
