---
name: discovery-code-repomix
description: Compresses a codebase into a single AI-friendly XML file using repomix, preserving signatures, imports, and structure with ~70% token reduction vs. raw source.
license: Apache-2.0
compatibility: Any Node.js codebase. Requires Node.js v16+ and repomix CLI.
metadata:
  author: discovery-code
  version: "1.0"
---

# discovery-code-repomix — Compress Codebase to AI-Friendly XML

**Invoke when**: Need to analyze large codebases compactly without saturating LLM context. Converts source tree into a single compressed XML file preserving signatures, imports, and structure (~70% token reduction vs. raw source).

**Inputs**:
- Module slug: `<slug>` (e.g., `trans`, `trans2`, `legacy-service`) — corresponds to `.discovery/code/modules/<slug>/`

**Outputs**:
- **Compressed XML**: `.discovery/code/scans/<slug>/repomix-output.xml` — Single file with all source symbols and structure

**Prerequisites**:
- ✅ **Node.js/npm**: `node --version` (v16+)
- ✅ **repomix CLI**: `npm install -g repomix` (or `npx repomix@latest`)

**Steps**:

1. **Verify Module Directory**
   - Check: `.discovery/code/modules/<slug>/` exists
   - Validate: Contains source files (not empty)
   - Validate: No symlink loops

2. **Create Output Directory**
   - Ensure: `.discovery/code/scans/<slug>/` exists
   - Create: If not present

3. **Run repomix Compression**
   - Command: `cd .discovery/code/modules/<slug> && npx repomix@latest --compress --style xml --output ../../scans/<slug>/repomix-output.xml`
   - Flags:
     - `--compress` — Enable token reduction (~70% squash)
     - `--style xml` — XML format (not JSON or markdown)
     - `--output <path>` — Destination file

4. **Verify Compression Ratio**
   - Calculate: `original_size / compressed_size` (should be ~3-5x)
   - Log: Compression ratio to `.discovery/code/scans/<slug>/repomix-stats.json`
     ```json
     {
       "original_lines": <int>,
       "compressed_lines": <int>,
       "compression_ratio": <float>,
       "file_count": <int>,
       "languages": [<list>],
       "created": "<ISO-8601>"
     }
     ```

5. **Validate XML Output**
   - Check: File is valid XML (parse with libxml2 or Python xml.etree)
   - Check: File size < 1MB (repomix should ensure this; warn if over 2MB)
   - Check: Root element is `<repository>` with child `<files>` and `<structure>`

6. **Create Module Tag**
   - Append entry to `.discovery/code/state.json`:
     ```json
     {
       "type": "repomix_scan",
       "module": "<slug>",
       "tool": "repomix",
       "status": "success|failed",
       "output_path": ".discovery/code/scans/<slug>/repomix-output.xml",
       "stats_path": ".discovery/code/scans/<slug>/repomix-stats.json",
       "created": "<ISO-8601>"
     }
     ```

**Error Handling**:
- **Module directory missing**: "Module <slug> not found in .discovery/code/modules/"
- **repomix not installed**: "Install repomix: `npm install -g repomix`"
- **Compression failed**: Log stderr; may indicate invalid code (syntax errors are OK for repomix)
- **Output file too large** (>2MB): Warn and suggest splitting module or using `--max-file-size` flag
- **XML parse error**: "Repomix output is not valid XML; check language grammar support"

**Quality Checks**:
- Spot-check: Open repomix-output.xml; verify it contains recognizable signatures/imports
- Verify: Compression ratio in expected range (2-5x)
- Verify: File is readable and not truncated

**Integration with Discovery-Code Agent**:
- Called by: `@discovery-code compress <slug>` → routes to this skill (planned)
- Manual invocation: `sca-repomix <slug>`
- Input: Module slug (user or agent provides)
- Output: `.discovery/code/scans/<slug>/repomix-output.xml` can be loaded directly into LLM for analysis
- **Benefit**: Allows analysis of 50K+ line modules in single LLM context window

**Example Invocation**:
```bash
# Direct invocation
sca-repomix trans

# Result: .discovery/code/scans/trans/repomix-output.xml
# Usage: Load directly into LLM for questions like "Map all HTTP calls in this module"
```

**Output Structure** (XML):
```xml
<repository>
  <metadata>
    <name>trans</name>
    <languageBreakdown>
      <language name="TypeScript">42</language>
      <language name="HTML">18</language>
    </languageBreakdown>
  </metadata>
  <files>
    <file name="src/controllers/marks.controller.ts" type="typescript">
      <signature>export class MarksController { consultMarks(): void; ... }</signature>
      <imports>import { MarkService } from '../services/marks.service';</imports>
    </file>
    ...
  </files>
</repository>
```

**Token Savings Example**:
- Original codebase: ~50,000 lines → ~250K tokens (gpt-4)
- Compressed by repomix: ~15,000 lines → ~75K tokens
- Savings: ~70% reduction; fits comfortably in 8K context window

**Limitations**:
- repomix preserves structure but strips implementation (method bodies, internal logic)
- Safe for signature analysis, import mapping, architecture review
- NOT suitable for detailed code inspection (use `discovery-code-parse-file` for line-by-line)

**Complementary Skills**:
- Use `discovery-code-extract-symbols` for full symbol index (includes internals)
- Use `discovery-code-repomix` for quick structural overview (compressed & fast)
