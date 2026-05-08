---
name: discovery-knowledge-convert-pdf
description: Converts PDF documents to Markdown + JSON using Python (pdfplumber). Extracts text, tables, and metadata. Falls back to OCR (Tesseract) for scanned PDFs.
license: Apache-2.0
compatibility: Requires Python 3. Installs pdfplumber on demand. Optional Tesseract for OCR.
metadata:
  author: discovery-knowledge
  version: "1.0"
---

# Knowledge - Convert PDF

Convert a PDF document to structured output in `.discovery/knowledge/`. Extracts text, tables, images, and metadata.

## Output Format

- **Text-heavy PDFs** (docs, specs, manuals) → Markdown (`.md`)
- **Table-heavy PDFs** (data sheets, reports) → JSON (`.json`) + Markdown summary
- Both formats include frontmatter/metadata with source, pages, and conversion date

## Steps

### 1. Check tool availability

```bash
python3 -c "import pdfplumber; print(pdfplumber.__version__)" 2>/dev/null && echo "OK" || echo "NOT INSTALLED"
```

If NOT INSTALLED:
```bash
pip install pdfplumber
```

For scanned PDFs (OCR), check Tesseract:
```bash
tesseract --version 2>/dev/null && echo "TESSERACT OK" || echo "NO OCR"
```

If Tesseract not available and OCR needed:
```bash
# macOS
brew install tesseract
# Also install Python bindings
pip install pytesseract Pillow
```

### 2. Analyze PDF type

```python
import pdfplumber

with pdfplumber.open("<input_path>") as pdf:
    first_page = pdf.pages[0]
    text = first_page.extract_text() or ""
    tables = first_page.extract_tables()

    if len(text.strip()) < 50 and not tables:
        print("SCANNED_PDF")  # needs OCR
    elif tables and len(tables) > 0:
        print("TABLE_HEAVY")  # produce JSON + MD
    else:
        print("TEXT_HEAVY")   # produce MD
```

### 3. Extract content

Create or use `.discovery/knowledge/tools/pdf-convert.py`:

```python
#!/usr/bin/env python3
import pdfplumber
import json
import sys
import os
from datetime import datetime

input_path = sys.argv[1]
basename = os.path.splitext(os.path.basename(input_path))[0]
output_dir = ".discovery/knowledge/ingested"
os.makedirs(output_dir, exist_ok=True)

with pdfplumber.open(input_path) as pdf:
    metadata = {
        "source": input_path,
        "pages": len(pdf.pages),
        "converted_at": datetime.now().isoformat(),
        "converter": "pdfplumber",
    }

    all_text = []
    all_tables = []

    for i, page in enumerate(pdf.pages):
        page_text = page.extract_text() or ""
        page_tables = page.extract_tables() or []

        all_text.append(f"<!-- Page {i+1} -->\n{page_text}")

        for j, table in enumerate(page_tables):
            all_tables.append({
                "page": i + 1,
                "table_index": j,
                "headers": table[0] if table else [],
                "rows": table[1:] if table else [],
            })

    # Generate Markdown
    frontmatter = f"""---
source: {input_path}
pages: {len(pdf.pages)}
converted_at: {metadata['converted_at']}
converter: pdfplumber
---

"""
    md_content = frontmatter + "\n\n".join(all_text)

    # Write Markdown
    md_path = os.path.join(output_dir, f"{basename}.md")
    with open(md_path, "w") as f:
        f.write(md_content)
    print(f"Markdown: {md_path}")

    # If tables found, also write JSON
    if all_tables:
        json_data = {
            "metadata": metadata,
            "tables": all_tables,
        }
        json_path = os.path.join(output_dir, f"{basename}.tables.json")
        with open(json_path, "w") as f:
            json.dump(json_data, f, indent=2, ensure_ascii=False)
        print(f"Tables JSON: {json_path}")
```

Run:
```bash
python3 .discovery/knowledge/tools/pdf-convert.py "<input_path>"
```

### 4. OCR fallback for scanned PDFs

If the PDF is scanned (no extractable text), use Tesseract:

```python
#!/usr/bin/env python3
import pdfplumber
from PIL import Image
import pytesseract
import io

with pdfplumber.open("<input_path>") as pdf:
    for i, page in enumerate(pdf.pages):
        # Convert page to image
        img = page.to_image(resolution=300)
        # Run OCR
        text = pytesseract.image_to_string(img.original)
        print(f"--- Page {i+1} ---")
        print(text)
```

If Tesseract is not available, warn:
```
⚠️ This PDF appears to be scanned (no extractable text).
   Install Tesseract for OCR: brew install tesseract && pip install pytesseract Pillow
   Without OCR, only metadata can be extracted.
```

### 5. Handle embedded images

For PDFs with important diagrams or charts:
1. Extract images using `pdfplumber` page images
2. If LLM has vision capabilities, describe each image
3. Insert image descriptions inline in the Markdown

### 6. Verify and report

```
📄 PDF converted: requirements.pdf
├── Pages: 42
├── Output: .discovery/knowledge/requirements.md (text)
├── Tables: .discovery/knowledge/requirements.tables.json (8 tables)
├── OCR: not needed (text-based PDF)
└── Size: 2,847 lines extracted
```

## Guardrails

- **DO NOT modify the source PDF** — read-only
- **Preserve structure** — maintain headings, lists, tables as much as possible
- **Frontmatter required** — every output must include source, pages, and conversion date
- **Large PDFs** — for PDFs >100 pages, report progress every 25 pages
- **Encoding** — handle non-ASCII characters properly (UTF-8)
- **Fallback chain** — pdfplumber → OCR (Tesseract) → LLM description → warn user
