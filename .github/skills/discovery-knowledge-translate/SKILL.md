---
name: discovery-knowledge-translate
description: Translates Word documents (DOCX), PowerPoint presentations (PPTX), and Markdown files between languages while preserving formatting, tables, images, and structural relationships.
license: Apache-2.0
compatibility: DOCX and PPTX files. Requires python-docx / python-pptx and an LLM or Wormhole translation backend.
metadata:
  author: discovery-knowledge
  version: "1.0"
---

# discovery-knowledge-translate — Structure-Preserving Translation

**Invoke when**: Translating Word documents (DOCX), PowerPoint presentations (PPTX), or Markdown files while preserving formatting, tables, images, and structural relationships. Supports bidirectional translation (any language ↔ any language).

**Inputs**:
- Source file path: `<path>` (e.g., `input/arquitectura.docx`, `docs/handbook.pptx`)
- Target language code: `<lang>` (e.g., `es`, `fr`, `de`, `ja`, `pt-BR`, `en`)

**Options**:
- `--preserve-ids` — Maintain deterministic section IDs (wormhole mode only)
- `--mode [wormhole|llm]` — Force specific translation engine (default: auto-detect)

**Outputs**:
- **Translated DOCX/PPTX**: `<name>_<lang>.docx` or `<name>_<lang>.pptx` (same directory as input)
- **Markdown export**: `<name>_<lang>.md` (`.discovery/knowledge/translations/`)
- **Translation metadata**: `.discovery/knowledge/translations/<name>_<lang>.json`

**Supported Formats**:
- Word: `.docx` (not `.doc` — requires conversion first)
- PowerPoint: `.pptx` (not `.ppt` — requires conversion first)
- Markdown: `.md` (text-only, no embedded images)

**Prerequisites**:

### Preferred Path: wormhole (deterministic, structure-preserving)
- ✅ **Wormhole CLI**: `npm install -g @wormhole/cli` OR `cargo install wormhole` (Rust)
- ✅ **Wormhole API key**: `WORMHOLE_API_KEY` environment variable
- **Benefit**: Preserves exact formatting, tables, images, speaker notes; maintains IDs for cross-referencing

### Fallback Path: LLM (lossy, lossy structure-preservation)
- 🔄 **LLM API key**: `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` environment variable
- 🔄 **python-docx** (for DOCX) or **python-pptx** (for PPTX): `pip install python-docx python-pptx`
- **Trade-off**: Good semantic translation; loses some formatting precision, may break complex layouts

**Steps**:

1. **Detect File Type & Language**
   - Parse file extension: `.docx` → DOCX, `.pptx` → PPTX, `.md` → Markdown
   - Extract current language (auto-detect via content or metadata)
   - Check: File is valid and readable

2. **Check Prerequisites**
   - If DOCX/PPTX: Check wormhole available → use wormhole path
   - If wormhole unavailable: Fall back to LLM path with python-docx/pptx
   - If Markdown: Use LLM path directly (no structural preservation needed)

3. **Translate via wormhole (preferred)**
   - Command: `wormhole translate --input <file> --output-lang <lang> --preserve-ids --output <output_file>`
   - Wormhole handles: Text, tables, images (references), headers, embedded styles
   - Output: Native DOCX/PPTX with structure intact
   - Benefit: Deterministic ID preservation enables cross-doc linking

4. **Translate via LLM (fallback)**
   - Parse source file (python-docx/pptx API):
     - Extract: Text blocks, paragraph styles, table structure, image paths, heading levels
     - Preserve: Structural JSON `{type, style, content, nested_elements}`
   - Send to LLM: "Translate this business document structure to <lang>, preserving all formatting directives"
   - LLM outputs: Translated JSON
   - Render: 
     - DOCX: Use python-docx to rebuild document with translated text, original styles
     - PPTX: Use python-pptx to rebuild slides with translated text, original layouts
   - **Caveat**: Complex tables or nested structures may require manual post-processing

5. **Generate Markdown Export**
   - Convert translated file to Markdown (for readability in `.discovery/knowledge/`)
   - Extract: Headings, body text, tables, image alt-text, speaker notes (PPTX)
   - Format: Maintain heading hierarchy, numbered lists, blockquotes
   - Output: `.discovery/knowledge/translations/<name>_<lang>.md`

6. **Create Metadata JSON**
   - Log entry at `.discovery/knowledge/translations/<name>_<lang>.json`:
     ```json
     {
       "type": "translation",
       "source_file": "<original_path>",
       "target_language": "<lang>",
       "source_language": "<detected>",
       "translation_tool": "wormhole|llm",
       "translated_file": "<name>_<lang>.docx/pptx",
       "markdown_export": ".discovery/knowledge/translations/<name>_<lang>.md",
       "sections_translated": <count>,
       "images_preserved": <count>,
       "tables_preserved": <count>,
       "preserve_ids": <bool>,
       "created": "<ISO-8601>"
     }
     ```

7. **Verify Outputs**
   - Check: All output files exist and are valid (Office file format or valid Markdown)
   - Check: Markdown is well-formed (balanced headers, valid table syntax)
   - Check: Image references are valid (if embedded, verify they're present)
   - Sample: LLM spot-check for translation quality (1-2 paragraphs + table)

**Error Handling**:

- **File format unsupported**: "{filename} is not DOCX, PPTX, or Markdown"
- **wormhole unavailable**: Log warning, fall back to LLM path
- **LLM timeout** (>120s): Return partial translation with completion marker; log timeout warning
- **Corrupted DOCX/PPTX**: "File is not valid Office format; try `libreoffice --headless --convert <file>` first"
- **Language code invalid**: "Unknown language code {lang}; use ISO-639-1 (e.g., 'es', 'fr', 'de')"
- **python-docx/pptx error**: "Failed to parse structure; may require manual inspection"

**Quality Checks**:
- Verify wormhole mode: Confirm output file is valid binary DOCX/PPTX (check magic bytes)
- Verify LLM mode: Spot-check 3 random sections for translation quality (semantic accuracy > 90%)
- Verify IDs: If `--preserve-ids`, confirm header IDs match source (wormhole mode)
- Warn if table count differs between source and output (structural loss in LLM mode)

**Integration with Discovery-Knowledge Agent**:
- Called by: `@discovery-knowledge translate <file> -t <lang>` → routes to this skill
- Input source: User specifies file path; skill validates existence and format
- Output consumption: Translated file placed next to original; Markdown export ingested into `.discovery/knowledge/translations/`

**Tier 1 / Tier 2 Strategy**:
- **Tier 1 (Deterministic)**: Use wormhole for precision-critical documents (formal specs, architecture, contracts)
- **Tier 2 (Semantic)**: Use LLM for best-effort translation of narrative content (release notes, guides, lessons learned)

**Example Invocation**:
```
@discovery-knowledge translate input/arquitectura.docx -t en
@discovery-knowledge translate docs/handbook.pptx -t es --preserve-ids
```

**Output Example**:
```
Input: arquitectura.docx (Spanish)
Output: arquitectura_en.docx (English, wormhole mode)
       + .discovery/knowledge/translations/arquitectura_en.md (Markdown export)
       + .discovery/knowledge/translations/arquitectura_en.json (metadata)
```

**Determinability**:
- wormhole mode: ✅ Fully deterministic (same input → same output byte-for-byte, if API stable)
- LLM mode: ⚠️ Non-deterministic (LLM may vary translation on each call, but semantically equivalent)
