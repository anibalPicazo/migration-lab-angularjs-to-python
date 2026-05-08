---
name: discovery-knowledge-convert-excel
description: Converts Excel files (.xlsx/.xls/.csv) to JSON + Markdown using Python (openpyxl). Extracts sheets, tables, formulas, and relationships.
license: Apache-2.0
compatibility: Requires Python 3. Installs openpyxl on demand.
metadata:
  author: discovery-knowledge
  version: "1.0"
---

# Knowledge - Convert Excel

Convert Excel files to structured output in `.discovery/knowledge/`. Excel is inherently structured, so the **primary output is JSON** with a Markdown summary.

## Output Format

- **JSON** (`.json`) — primary: sheets, headers, rows, data types, formulas, named ranges
- **Markdown** (`.md`) — summary: sheet overview + table previews (first 10 rows per sheet)

## Steps

### 1. Check tool availability

```bash
python3 -c "import openpyxl; print(openpyxl.__version__)" 2>/dev/null && echo "OK" || echo "NOT INSTALLED"
```

If NOT INSTALLED:
```bash
pip install openpyxl
```

For `.xls` (old format), also check:
```bash
python3 -c "import xlrd; print('OK')" 2>/dev/null || echo "xlrd NOT INSTALLED"
```

### 2. Convert

Create or use `.discovery/knowledge/tools/excel-convert.py`:

```python
#!/usr/bin/env python3
import openpyxl
import json
import sys
import os
from datetime import datetime

input_path = sys.argv[1]
basename = os.path.splitext(os.path.basename(input_path))[0]
output_dir = ".discovery/knowledge/ingested"
os.makedirs(output_dir, exist_ok=True)

wb = openpyxl.load_workbook(input_path, data_only=False)

metadata = {
    "source": input_path,
    "sheets": wb.sheetnames,
    "sheet_count": len(wb.sheetnames),
    "converted_at": datetime.now().isoformat(),
    "converter": "openpyxl",
}

sheets_data = []
md_lines = [
    "---",
    f"source: {input_path}",
    f"sheets: {len(wb.sheetnames)}",
    f"converted_at: {metadata['converted_at']}",
    f"converter: openpyxl",
    "---\n",
    f"# {basename}\n",
]

for sheet_name in wb.sheetnames:
    ws = wb[sheet_name]
    rows = []
    headers = []
    formulas = []

    for i, row in enumerate(ws.iter_rows(values_only=False)):
        cell_values = []
        for cell in row:
            val = cell.value
            # Track formulas
            if isinstance(val, str) and val.startswith("="):
                formulas.append({
                    "cell": cell.coordinate,
                    "formula": val,
                })
            cell_values.append(str(val) if val is not None else "")

        if i == 0:
            headers = cell_values
        else:
            rows.append(cell_values)

    sheet_data = {
        "name": sheet_name,
        "headers": headers,
        "row_count": len(rows),
        "rows": rows,
        "formulas": formulas if formulas else None,
        "dimensions": ws.dimensions,
    }
    sheets_data.append(sheet_data)

    # Markdown summary
    md_lines.append(f"## {sheet_name}\n")
    md_lines.append(f"Rows: {len(rows)} | Columns: {len(headers)}")
    if formulas:
        md_lines.append(f" | Formulas: {len(formulas)}")
    md_lines.append("\n")

    # Table preview (first 10 rows)
    if headers:
        md_lines.append("| " + " | ".join(headers[:8]) + " |")
        md_lines.append("| " + " | ".join(["---"] * min(len(headers), 8)) + " |")
        for row in rows[:10]:
            md_lines.append("| " + " | ".join(row[:8]) + " |")
        if len(rows) > 10:
            md_lines.append(f"\n*... {len(rows) - 10} more rows*\n")

# Write JSON (primary)
json_data = {
    "metadata": metadata,
    "sheets": sheets_data,
}
json_path = os.path.join(output_dir, f"{basename}.json")
with open(json_path, "w") as f:
    json.dump(json_data, f, indent=2, ensure_ascii=False, default=str)
print(f"JSON: {json_path}")

# Write Markdown summary
md_path = os.path.join(output_dir, f"{basename}.md")
with open(md_path, "w") as f:
    f.write("\n".join(md_lines))
print(f"Markdown: {md_path}")
```

Run:
```bash
python3 .discovery/knowledge/tools/excel-convert.py "<input_path>"
```

### 3. Handle CSV files

If the input is `.csv`:
```python
import csv
with open(input_path, newline='', encoding='utf-8') as f:
    reader = csv.reader(f)
    headers = next(reader)
    rows = list(reader)
```

### 4. Detect relationships

If multiple sheets reference each other (VLOOKUP, formulas referencing other sheets), note these as relationships in the JSON:

```json
{
  "cross_references": [
    {
      "from_sheet": "Orders",
      "from_cell": "D2",
      "formula": "=VLOOKUP(B2, Products!A:C, 3, FALSE)",
      "to_sheet": "Products"
    }
  ]
}
```

### 5. Verify and report

```
📊 Excel converted: data-model.xlsx
├── Sheets: 4 (Users, Orders, Products, Config)
├── Total rows: 1,247
├── Formulas: 23
├── Cross-references: 3
├── Output JSON: .discovery/knowledge/data-model.json
└── Output MD: .discovery/knowledge/data-model.md (summary)
```

## Guardrails

- **DO NOT modify the source file** — read-only
- **JSON is primary** — Excel data is structured; JSON preserves it best
- **Large files** — for sheets with >10,000 rows, warn and offer to truncate
- **Formula preservation** — store formulas as strings, don't evaluate them
- **Encoding** — handle non-ASCII in cell values
- **Fallback** — openpyxl → csv reader → LLM description → warn user
