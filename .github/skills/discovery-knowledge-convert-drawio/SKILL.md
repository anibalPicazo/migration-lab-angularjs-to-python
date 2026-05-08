---
name: discovery-knowledge-convert-drawio
description: Converts Draw.io diagrams (.drawio/.xml) to Markdown + JSON by parsing the XML structure. Extracts nodes, edges, labels, and generates Mermaid diagrams.
license: Apache-2.0
compatibility: Requires Python 3. No external dependencies (uses stdlib xml.etree).
metadata:
  author: discovery-knowledge
  version: "1.0"
---

# Knowledge - Convert Draw.io

Convert Draw.io diagrams to structured output in `.discovery/knowledge/`. Parses the **XML directly** to extract components, connections, and labels. Generates both a structured JSON and a human-readable Markdown with Mermaid equivalents.

## Output Format

- **JSON** (`.json`) — primary: nodes (components), edges (connections), styles, pages
- **Markdown** (`.md`) — readable description + Mermaid diagram equivalent

## Steps

### 1. Verify file format

Draw.io files are XML. Check:
```bash
head -5 "<input_path>"
```

Expected: `<mxfile>` root element or `<mxGraphModel>`.

If the file is compressed (some `.drawio` files use deflate), decompress first:
```python
import base64, zlib
# Some drawio files store content as base64+deflate in <diagram> element
```

### 2. Parse XML

Create or use `.discovery/knowledge/tools/drawio-convert.py`:

```python
#!/usr/bin/env python3
import xml.etree.ElementTree as ET
import json
import sys
import os
import base64
import zlib
import urllib.parse
from datetime import datetime

input_path = sys.argv[1]
basename = os.path.splitext(os.path.basename(input_path))[0]
output_dir = ".discovery/knowledge/ingested"
os.makedirs(output_dir, exist_ok=True)

tree = ET.parse(input_path)
root = tree.getroot()

metadata = {
    "source": input_path,
    "converted_at": datetime.now().isoformat(),
    "converter": "xml.etree (drawio parser)",
}

pages = []
all_nodes = []
all_edges = []

# Handle both <mxfile><diagram>... and direct <mxGraphModel>
diagrams = root.findall(".//diagram")
if not diagrams:
    # Direct mxGraphModel
    diagrams = [root]

for page_idx, diagram in enumerate(diagrams):
    page_name = diagram.get("name", f"Page {page_idx + 1}")

    # Check if content is compressed
    graph_model = diagram.find(".//mxGraphModel")
    if graph_model is None and diagram.text and diagram.text.strip():
        # Compressed content — decode
        try:
            compressed = base64.b64decode(diagram.text.strip())
            xml_str = zlib.decompress(compressed, -15).decode("utf-8")
            xml_str = urllib.parse.unquote(xml_str)
            graph_model = ET.fromstring(xml_str)
        except Exception:
            graph_model = None

    if graph_model is None:
        continue

    page_nodes = []
    page_edges = []

    for cell in graph_model.iter("mxCell"):
        cell_id = cell.get("id", "")
        value = cell.get("value", "").strip()
        style = cell.get("style", "")
        source = cell.get("source")
        target = cell.get("target")
        vertex = cell.get("vertex")
        edge = cell.get("edge")
        parent = cell.get("parent", "")

        # Skip root cells (id 0 and 1 are container/layer)
        if cell_id in ("0", "1"):
            continue

        if vertex == "1":
            # This is a node (component/box)
            node_type = "unknown"
            if "shape=mxgraph.aws" in style or "shape=mxgraph.azure" in style:
                node_type = "cloud_service"
            elif "shape=cylinder" in style or "shape=mxgraph.flowchart.database" in style:
                node_type = "database"
            elif "rounded=1" in style or "ellipse" in style:
                node_type = "process"
            elif "rhombus" in style or "diamond" in style:
                node_type = "decision"
            elif "shape=mxgraph.flowchart" in style:
                node_type = "flowchart_element"
            else:
                node_type = "component"

            # Clean HTML from value
            clean_value = value.replace("<br>", " ").replace("<br/>", " ")
            # Strip HTML tags
            import re
            clean_value = re.sub(r"<[^>]+>", "", clean_value).strip()

            page_nodes.append({
                "id": cell_id,
                "label": clean_value,
                "type": node_type,
                "parent": parent if parent not in ("0", "1") else None,
            })
            all_nodes.append({
                "id": cell_id,
                "label": clean_value,
                "type": node_type,
                "page": page_name,
            })

        elif edge == "1" and source and target:
            # This is an edge (connection)
            # Clean label
            clean_value = value.replace("<br>", " ").replace("<br/>", " ")
            import re
            clean_value = re.sub(r"<[^>]+>", "", clean_value).strip()

            edge_style = "solid"
            if "dashed=1" in style:
                edge_style = "dashed"
            if "endArrow=none" in style:
                edge_style += "_bidirectional"

            page_edges.append({
                "source": source,
                "target": target,
                "label": clean_value,
                "style": edge_style,
            })
            all_edges.append({
                "source": source,
                "target": target,
                "label": clean_value,
                "page": page_name,
            })

    pages.append({
        "name": page_name,
        "nodes": page_nodes,
        "edges": page_edges,
    })

# Build node lookup for Mermaid generation
node_map = {n["id"]: n["label"] or f"node_{n['id']}" for n in all_nodes}

# Sanitize labels for Mermaid (no special chars)
import re
def mermaid_id(label):
    clean = re.sub(r"[^a-zA-Z0-9_]", "_", label)
    return clean[:30] if clean else "node"

# Generate Mermaid
mermaid_lines = ["graph TD"]
seen_ids = {}
for node in all_nodes:
    mid = mermaid_id(node["label"] or f"n{node['id']}")
    if mid in seen_ids:
        mid = f"{mid}_{node['id']}"
    seen_ids[node["id"]] = mid
    label = node["label"] or node["id"]
    mermaid_lines.append(f"    {mid}[{label}]")

for edge in all_edges:
    src = seen_ids.get(edge["source"], edge["source"])
    tgt = seen_ids.get(edge["target"], edge["target"])
    label = edge["label"]
    if label:
        mermaid_lines.append(f"    {src} -->|{label}| {tgt}")
    else:
        mermaid_lines.append(f"    {src} --> {tgt}")

mermaid = "\n".join(mermaid_lines)

# Write JSON
json_data = {
    "metadata": metadata,
    "pages": pages,
    "summary": {
        "total_nodes": len(all_nodes),
        "total_edges": len(all_edges),
        "page_count": len(pages),
    },
}
json_path = os.path.join(output_dir, f"{basename}.json")
with open(json_path, "w") as f:
    json.dump(json_data, f, indent=2, ensure_ascii=False)
print(f"JSON: {json_path}")

# Write Markdown
md = f"""---
source: {input_path}
pages: {len(pages)}
nodes: {len(all_nodes)}
edges: {len(all_edges)}
converted_at: {metadata['converted_at']}
converter: drawio-xml-parser
---

# {basename}

## Components ({len(all_nodes)})

| # | Label | Type | Page |
|---|-------|------|------|
"""
for i, node in enumerate(all_nodes, 1):
    md += f"| {i} | {node['label']} | {node['type']} | {node['page']} |\n"

md += f"""
## Connections ({len(all_edges)})

| From | To | Label | Page |
|------|-----|-------|------|
"""
for edge in all_edges:
    src_label = node_map.get(edge["source"], edge["source"])
    tgt_label = node_map.get(edge["target"], edge["target"])
    md += f"| {src_label} | {tgt_label} | {edge['label']} | {edge['page']} |\n"

md += f"""
## Mermaid Equivalent

```mermaid
{mermaid}
```
"""

md_path = os.path.join(output_dir, f"{basename}.md")
with open(md_path, "w") as f:
    f.write(md)
print(f"Markdown: {md_path}")
```

Run:
```bash
python3 .discovery/knowledge/tools/drawio-convert.py "<input_path>"
```

### 3. Handle multi-page diagrams

Draw.io files can have multiple pages (tabs). Each `<diagram>` element is a page. The script processes all pages and groups nodes/edges by page in the JSON.

### 4. Handle compressed content

Some Draw.io exports compress the diagram content as base64+deflate inside the `<diagram>` text node. The script detects and decompresses automatically.

### 5. Verify and report

```
📐 Draw.io converted: system-architecture.drawio
├── Pages: 3 (Overview, Backend, Frontend)
├── Nodes: 24 components identified
├── Edges: 31 connections identified
├── Node types: component(12), database(3), cloud_service(5), process(4)
├── Mermaid diagram: generated
├── Output JSON: .discovery/knowledge/system-architecture.json
└── Output MD: .discovery/knowledge/system-architecture.md
```

## Guardrails

- **DO NOT modify the source file** — read-only
- **JSON is primary** — Draw.io data is inherently structured (nodes + edges)
- **Mermaid is bonus** — generate it but warn if the diagram is too complex (>50 nodes)
- **Handle compressed** — auto-detect base64+deflate content
- **HTML in labels** — strip HTML tags from `value` attributes (Draw.io uses HTML formatting)
- **Style detection** — use `style` attribute to infer node types (database, cloud, etc.)
- **Frontmatter required** — source, pages, node count, edge count, date
- **No external deps** — uses only Python stdlib (`xml.etree`, `base64`, `zlib`)
