---
name: discovery-knowledge-convert-image
description: Converts images to Markdown using OCR (Tesseract) for text extraction and LLM vision for diagrams/screenshots. Supports PNG, JPG, SVG, BMP, TIFF.
license: Apache-2.0
compatibility: Requires Python 3. Tesseract for OCR. LLM vision for diagram analysis.
metadata:
  author: discovery-knowledge
  version: "1.0"
---

# Knowledge - Convert Image

Convert images to structured Markdown in `.discovery/knowledge/`. Uses **OCR (Tesseract)** for text-containing images and **LLM vision** for diagrams, screenshots, and architecture drawings.

## Output Format

- **Text images** (scanned docs, whiteboard photos) → Markdown with OCR-extracted text
- **Diagrams / screenshots** → Markdown with structured description (components, relationships, layout)
- Both include frontmatter with source, type classification, and conversion date

## Steps

### 1. Check tool availability

OCR (Tesseract):
```bash
tesseract --version 2>/dev/null && echo "TESSERACT OK" || echo "NO TESSERACT"
```

If NOT INSTALLED:
```bash
# macOS
brew install tesseract
# Python bindings
pip install pytesseract Pillow
```

### 2. Classify the image

Determine what type of image it is to choose the right extraction strategy:

```python
#!/usr/bin/env python3
from PIL import Image
import sys

img = Image.open(sys.argv[1])
width, height = img.size
mode = img.mode
fmt = img.format

print(f"Size: {width}x{height}")
print(f"Mode: {mode}")
print(f"Format: {fmt}")

# Heuristics for classification
aspect = width / height
if aspect > 2.5 or aspect < 0.4:
    print("TYPE: banner_or_strip")
elif width > 1200 and height > 800:
    print("TYPE: screenshot_or_diagram")
else:
    print("TYPE: general")
```

Classification guide for the LLM:
- **Screenshot of UI** → extract visible text, layout structure, form fields, buttons, navigation
- **Architecture diagram** → extract components, connections, protocols, data flow direction
- **Flowchart** → extract steps, decisions, branches, start/end points
- **Whiteboard photo** → OCR + describe handwritten elements
- **Data visualization** → describe chart type, axes, trends, key data points
- **Logo / decorative** → brief description, skip detailed analysis

### 3. OCR extraction (for text-heavy images)

Create or use `.discovery/knowledge/tools/image-ocr.py`:

```python
#!/usr/bin/env python3
import pytesseract
from PIL import Image
import sys
import os
from datetime import datetime

input_path = sys.argv[1]
basename = os.path.splitext(os.path.basename(input_path))[0]
output_dir = ".discovery/knowledge/ingested"
os.makedirs(output_dir, exist_ok=True)

img = Image.open(input_path)

# Pre-process for better OCR
# Convert to grayscale
img_gray = img.convert("L")

# Extract text
text = pytesseract.image_to_string(img_gray, lang="eng")

# Also try to get structured data (tables, etc.)
data = pytesseract.image_to_data(img_gray, output_type=pytesseract.Output.DICT)

# Build markdown
md = f"""---
source: {input_path}
type: ocr
dimensions: {img.size[0]}x{img.size[1]}
converted_at: {datetime.now().isoformat()}
converter: tesseract
---

# OCR: {basename}

{text.strip()}
"""

md_path = os.path.join(output_dir, f"{basename}.md")
with open(md_path, "w") as f:
    f.write(md)
print(f"Markdown: {md_path}")
```

Run:
```bash
python3 .discovery/knowledge/tools/image-ocr.py "<input_path>"
```

### 4. LLM vision analysis (for diagrams/screenshots)

If the image is a diagram, screenshot, or architecture drawing, use the LLM's vision capabilities:

1. The user attaches the image to the chat, or the skill reads it from disk
2. Describe the content using structured analysis:

For **UI screenshots**:
```markdown
## Screen: [inferred name]

### Layout
- Header: [description]
- Sidebar: [description]
- Main content: [description]
- Footer: [description]

### Interactive elements
| Element | Type | Label | Location |
|---------|------|-------|----------|
| ... | button | "Submit" | top-right |
| ... | input | "Email" | form center |

### Visible text
[extracted text in reading order]
```

For **architecture diagrams**:
```markdown
## Architecture: [inferred name]

### Components
| Component | Type | Description |
|-----------|------|-------------|
| ... | service | User authentication |

### Connections
| From | To | Protocol/Type | Label |
|------|-----|--------------|-------|
| Frontend | API Gateway | HTTPS | REST calls |

### Data flow
1. User → Frontend (HTTP)
2. Frontend → API Gateway (HTTPS)
3. API Gateway → Auth Service (gRPC)
```

For **flowcharts**:
```markdown
## Flow: [inferred name]

### Steps
1. **Start**: [description]
2. **Decision**: [condition]
   - Yes → Step 3
   - No → Step 4
3. **Action**: [description]
4. **End**: [description]
```

### 5. Combine OCR + Vision

For images that have both text and visual structure (e.g., annotated screenshots):
1. Run OCR first to extract all text
2. Use LLM vision to understand the layout and structure
3. Merge: place OCR text within the structural description

### 6. Save and report

Write to `.discovery/knowledge/{basename}.md`:

```
🖼️ Image converted: architecture-overview.png
├── Type: architecture diagram
├── Size: 1920x1080
├── Components: 8 identified
├── Connections: 12 identified
├── OCR text: 245 characters extracted
└── Output: .discovery/knowledge/architecture-overview.md
```

## Guardrails

- **DO NOT modify the source image** — read-only
- **Classify first** — don't run OCR on diagrams (wastes time), don't skip OCR on text images
- **Frontmatter required** — every output includes source, type, dimensions, date
- **OCR quality** — if OCR confidence is low (<60%), warn and suggest LLM vision instead
- **Multi-language OCR** — if text is not English, try `lang="eng+spa+fra"` or ask user
- **SVG special case** — SVG files are XML; read the XML directly instead of rendering + OCR
- **Fallback chain** — Tesseract OCR → LLM vision → manual description prompt → warn user
