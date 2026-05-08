---
name: discovery-knowledge-convert-docx
description: Converts Word documents (.docx) to Markdown using Python (python-docx). Extracts text, headings, tables, and styles.
license: Apache-2.0
compatibility: Requires Python 3. Installs python-docx on demand. Optional pandoc for advanced conversion.
metadata:
  author: discovery-knowledge
  version: "1.0"
---

# Knowledge - Convert DOCX

Convert a Word document (.docx) to structured Markdown in `.discovery/knowledge/`.

## Output Format

- **Markdown** (`.md`) with frontmatter — preserving headings, tables, lists, and bold/italic
- **JSON** (`.json`) only if the document contains significant structured data (tables, properties)

## Steps

### 1. Check tool availability

Preferred — python-docx:
```bash
python3 -c "import docx; print('OK')" 2>/dev/null || echo "NOT INSTALLED"
```

If NOT INSTALLED:
```bash
pip install python-docx
```

Alternative — pandoc (if available, produces high-quality Markdown):
```bash
pandoc --version 2>/dev/null | head -1 && echo "PANDOC OK" || echo "NO PANDOC"
```

### 2. Convert with python-docx

Create or use `.discovery/knowledge/tools/docx-convert.py`:

```python
#!/usr/bin/env python3
import docx
import json
import sys
import os
from datetime import datetime

input_path = sys.argv[1]
basename = os.path.splitext(os.path.basename(input_path))[0]
output_dir = ".discovery/knowledge/ingested"
os.makedirs(output_dir, exist_ok=True)

doc = docx.Document(input_path)

metadata = {
    "source": input_path,
    "paragraphs": len(doc.paragraphs),
    "tables": len(doc.tables),
    "converted_at": datetime.now().isoformat(),
    "converter": "python-docx",
}

# Extract core properties
props = doc.core_properties
if props.title:
    metadata["title"] = props.title
if props.author:
    metadata["author"] = props.author

md_lines = [
    "---",
    f"source: {input_path}",
    f"converted_at: {metadata['converted_at']}",
    f"converter: python-docx",
]
if props.title:
    md_lines.append(f"title: {props.title}")
if props.author:
    md_lines.append(f"author: {props.author}")
md_lines.append("---\n")

# Convert paragraphs
heading_map = {
    "Heading 1": "#",
    "Heading 2": "##",
    "Heading 3": "###",
    "Heading 4": "####",
    "Heading 5": "#####",
}

for para in doc.paragraphs:
    style = para.style.name if para.style else ""
    text = para.text.strip()
    if not text:
        md_lines.append("")
        continue

    if style in heading_map:
        md_lines.append(f"{heading_map[style]} {text}\n")
    elif style == "List Bullet":
        md_lines.append(f"- {text}")
    elif style == "List Number":
        md_lines.append(f"1. {text}")
    else:
        # Handle inline formatting
        runs_md = ""
        for run in para.runs:
            t = run.text
            if run.bold and run.italic:
                runs_md += f"***{t}***"
            elif run.bold:
                runs_md += f"**{t}**"
            elif run.italic:
                runs_md += f"*{t}*"
            else:
                runs_md += t
        md_lines.append(runs_md if runs_md else text)

# Convert tables
all_tables = []
for i, table in enumerate(doc.tables):
    md_lines.append(f"\n### Table {i+1}\n")
    rows = []
    for j, row in enumerate(table.rows):
        cells = [cell.text.strip() for cell in row.cells]
        rows.append(cells)
        if j == 0:
            md_lines.append("| " + " | ".join(cells) + " |")
            md_lines.append("| " + " | ".join(["---"] * len(cells)) + " |")
        else:
            md_lines.append("| " + " | ".join(cells) + " |")

    all_tables.append({
        "table_index": i,
        "headers": rows[0] if rows else [],
        "rows": rows[1:] if rows else [],
    })

# Write Markdown
md_path = os.path.join(output_dir, f"{basename}.md")
with open(md_path, "w") as f:
    f.write("\n".join(md_lines))
print(f"Markdown: {md_path}")

# Write JSON if tables present
if all_tables:
    json_data = {"metadata": metadata, "tables": all_tables}
    json_path = os.path.join(output_dir, f"{basename}.tables.json")
    with open(json_path, "w") as f:
        json.dump(json_data, f, indent=2, ensure_ascii=False)
    print(f"Tables JSON: {json_path}")
```

Run:
```bash
python3 .discovery/knowledge/tools/docx-convert.py "<input_path>"
```

### 3. Alternative: pandoc

If pandoc is available and python-docx fails:
```bash
pandoc "<input_path>" -t markdown --wrap=none -o ".discovery/knowledge/<basename>.md"
```

Then prepend frontmatter to the output.

### 4. Handle embedded images

- If the DOCX contains images, python-docx can extract them from `doc.inline_shapes`
- Describe extracted images using LLM vision if available
- Insert descriptions at the correct position in the Markdown

### 5. Verify and report

```
📝 DOCX converted: architecture-spec.docx
├── Title: System Architecture Specification
├── Author: John Doe
├── Paragraphs: 234
├── Tables: 5
├── Output: .discovery/knowledge/architecture-spec.md
└── Tables JSON: .discovery/knowledge/architecture-spec.tables.json
```

## Guardrails

- **DO NOT modify the source file** — read-only
- **Preserve hierarchy** — headings, sub-headings, nested lists must maintain structure
- **Handle empty styles** — some DOCX files use custom styles; fall back to plain paragraphs
- **Encoding** — handle non-ASCII and special characters (UTF-8)
- **Fallback chain** — python-docx → pandoc → LLM direct reading → warn user
