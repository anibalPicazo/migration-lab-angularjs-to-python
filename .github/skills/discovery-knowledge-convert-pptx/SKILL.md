---
name: discovery-knowledge-convert-pptx
description: Converts PowerPoint presentations (.pptx) to Markdown + JSON using Python (python-pptx). Extracts slides, text, speaker notes, and embedded images.
license: Apache-2.0
compatibility: Requires Python 3. Installs python-pptx on demand.
metadata:
  author: discovery-knowledge
  version: "1.0"
---

# Knowledge - Convert PPTX

Convert PowerPoint presentations to structured output in `.discovery/knowledge/`. Extracts slide content, speaker notes, and describes embedded images.

## Output Format

- **Markdown** (`.md`) — slide-by-slide content with headings, text, and image descriptions
- **JSON** (`.json`) — structured slide data with relationships, if the presentation contains diagrams or data

## Steps

### 1. Check tool availability

```bash
python3 -c "from pptx import Presentation; print('OK')" 2>/dev/null || echo "NOT INSTALLED"
```

If NOT INSTALLED:
```bash
pip install python-pptx
```

### 2. Convert

Create or use `.discovery/knowledge/tools/pptx-convert.py`:

```python
#!/usr/bin/env python3
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.shapes import MSO_SHAPE_TYPE
import json
import sys
import os
from datetime import datetime

input_path = sys.argv[1]
basename = os.path.splitext(os.path.basename(input_path))[0]
output_dir = ".discovery/knowledge/ingested"
os.makedirs(output_dir, exist_ok=True)

prs = Presentation(input_path)

metadata = {
    "source": input_path,
    "slides": len(prs.slides),
    "width": str(prs.slide_width),
    "height": str(prs.slide_height),
    "converted_at": datetime.now().isoformat(),
    "converter": "python-pptx",
}

md_lines = [
    "---",
    f"source: {input_path}",
    f"slides: {len(prs.slides)}",
    f"converted_at: {metadata['converted_at']}",
    f"converter: python-pptx",
    "---\n",
    f"# {basename}\n",
]

slides_data = []
image_count = 0

for i, slide in enumerate(prs.slides):
    slide_info = {
        "slide_number": i + 1,
        "layout": slide.slide_layout.name if slide.slide_layout else "unknown",
        "shapes": [],
        "notes": "",
    }

    md_lines.append(f"## Slide {i + 1}\n")

    # Extract title if present
    if slide.shapes.title:
        title = slide.shapes.title.text.strip()
        md_lines.append(f"### {title}\n")
        slide_info["title"] = title

    # Extract all shapes
    for shape in slide.shapes:
        if shape.has_text_frame:
            for para in shape.text_frame.paragraphs:
                text = para.text.strip()
                if text:
                    # Detect bullet level
                    level = para.level or 0
                    indent = "  " * level
                    if level > 0:
                        md_lines.append(f"{indent}- {text}")
                    else:
                        md_lines.append(text)
            md_lines.append("")
            slide_info["shapes"].append({
                "type": "text",
                "content": shape.text_frame.text,
            })

        elif shape.has_table:
            table = shape.table
            headers = [cell.text for cell in table.rows[0].cells]
            md_lines.append("| " + " | ".join(headers) + " |")
            md_lines.append("| " + " | ".join(["---"] * len(headers)) + " |")

            rows = []
            for row in table.rows[1:]:
                cells = [cell.text for cell in row.cells]
                md_lines.append("| " + " | ".join(cells) + " |")
                rows.append(cells)

            md_lines.append("")
            slide_info["shapes"].append({
                "type": "table",
                "headers": headers,
                "rows": rows,
            })

        elif shape.shape_type == MSO_SHAPE_TYPE.PICTURE:
            image_count += 1
            md_lines.append(f"*[Image {image_count}: embedded picture]*\n")
            slide_info["shapes"].append({
                "type": "image",
                "image_index": image_count,
            })

        elif shape.shape_type == MSO_SHAPE_TYPE.GROUP:
            md_lines.append(f"*[Group shape: {shape.name}]*\n")
            slide_info["shapes"].append({
                "type": "group",
                "name": shape.name,
            })

    # Extract speaker notes
    if slide.has_notes_slide:
        notes = slide.notes_slide.notes_text_frame.text.strip()
        if notes:
            md_lines.append(f"> **Speaker notes:** {notes}\n")
            slide_info["notes"] = notes

    md_lines.append("---\n")
    slides_data.append(slide_info)

# Write Markdown
md_path = os.path.join(output_dir, f"{basename}.md")
with open(md_path, "w") as f:
    f.write("\n".join(md_lines))
print(f"Markdown: {md_path}")

# Write JSON
json_data = {
    "metadata": metadata,
    "slides": slides_data,
}
json_path = os.path.join(output_dir, f"{basename}.json")
with open(json_path, "w") as f:
    json.dump(json_data, f, indent=2, ensure_ascii=False)
print(f"JSON: {json_path}")

print(f"Images found: {image_count}")
```

Run:
```bash
python3 .discovery/knowledge/tools/pptx-convert.py "<input_path>"
```

### 3. Handle embedded images

For slides with important diagrams or charts:
1. Extract images from the PPTX (they're stored in `pptx/media/`)
2. If LLM has vision capabilities, describe each image
3. Replace `*[Image N]*` placeholders with descriptions in the Markdown

```python
# Extract images from PPTX
from pptx.opc.constants import RELATIONSHIP_TYPE as RT
for slide in prs.slides:
    for rel in slide.part.rels.values():
        if "image" in rel.reltype:
            image_data = rel.target_part.blob
            # Save or describe via LLM vision
```

### 4. Handle SmartArt and charts

SmartArt and charts are complex shapes:
- **SmartArt**: Extract the underlying XML to get text nodes and hierarchy
- **Charts**: Extract data series from the embedded Excel or chart XML
- If extraction fails, describe via LLM vision

### 5. Verify and report

```
📊 PPTX converted: project-overview.pptx
├── Slides: 24
├── Layout types: Title, Content, Two Column, Blank
├── Speaker notes: 18 slides have notes
├── Tables: 3 (slides 5, 12, 19)
├── Images: 7 embedded
├── Output MD: .discovery/knowledge/project-overview.md
└── Output JSON: .discovery/knowledge/project-overview.json
```

## Guardrails

- **DO NOT modify the source file** — read-only
- **Preserve slide order** — slides must appear in presentation order
- **Speaker notes are valuable** — always extract and include them
- **Tables preserved** — convert to Markdown tables with headers
- **Frontmatter required** — source, slide count, date
- **Large presentations** — for >50 slides, report progress every 10 slides
- **Fallback chain** — python-pptx → LLM description (if user attaches file in chat) → warn
