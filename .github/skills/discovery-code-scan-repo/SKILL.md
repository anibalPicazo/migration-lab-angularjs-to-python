---
name: discovery-code-scan-repo
description: Scans a repository to discover structure, languages, frameworks, and entry points. Generates a scan-manifest.json that feeds all downstream indexing skills.
license: Apache-2.0
compatibility: Any codebase. Uses find, ls, and file inspection — no external dependencies.
metadata:
  author: discovery-code
  version: "1.0"
---

# Codebase — Scan Repository

Discover the structure of a codebase: directories, languages, frameworks, entry points, and file counts. Produces a `scan-manifest.json` that all other indexing skills consume.

## Input

- **Path**: The root directory to scan (default: `.` — current workspace)
- **User context**: The user may provide hints like "this is a monorepo", "ignore src/legacy/", "services are in packages/"
- **Exclusions**: `--exclude vendor,dist,generated` or similar

## Steps

### 1. Scan directory structure

```bash
find <root> -maxdepth 4 -type d \
  -not -path '*/\.*' \
  -not -path '*/node_modules/*' \
  -not -path '*/vendor/*' \
  -not -path '*/__pycache__/*' \
  -not -path '*/target/*' \
  -not -path '*/dist/*' \
  -not -path '*/build/*' \
  -not -path '*/.discovery/code/*' \
  -not -path '*/.discovery/runtime/*' \
  | head -100
```

Note any user-specified exclusions and add them to the find command.

### 2. Detect languages by extension and manifests

**Manifests** (check existence):
```bash
ls package.json tsconfig.json pom.xml build.gradle settings.gradle \
  *.csproj *.sln go.mod Cargo.toml requirements.txt pyproject.toml \
  Pipfile Gemfile composer.json mix.exs build.sbt CMakeLists.txt \
  Makefile Dockerfile docker-compose.yml 2>/dev/null
```

**Count files by extension** (top languages):
```bash
find <root> -type f \
  \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \
  -o -name '*.py' -o -name '*.java' -o -name '*.cs' -o -name '*.go' \
  -o -name '*.php' -o -name '*.rb' -o -name '*.rs' -o -name '*.kt' \
  -o -name '*.swift' -o -name '*.dart' -o -name '*.scala' \
  -o -name '*.c' -o -name '*.cpp' -o -name '*.h' \) \
  -not -path '*/node_modules/*' \
  -not -path '*/vendor/*' \
  -not -path '*/dist/*' \
  -not -path '*/build/*' \
  | sed 's/.*\.//' | sort | uniq -c | sort -rn
```

### 3. Detect frameworks from configs

Read the relevant manifest files to identify frameworks:

| Manifest | Look for |
|----------|----------|
| `package.json` | dependencies: react, angular, vue, express, nestjs, next, nuxt, fastify, etc. |
| `pom.xml` / `build.gradle` | Spring Boot, Jakarta EE, Quarkus, Micronaut |
| `*.csproj` | ASP.NET, Blazor, Entity Framework |
| `go.mod` | gin, echo, fiber, gorm |
| `requirements.txt` / `pyproject.toml` | django, flask, fastapi, sqlalchemy |
| `Cargo.toml` | actix, axum, rocket, tokio |
| `Gemfile` | rails, sinatra |

### 4. Detect entry points

Look for common entry point patterns:
- `src/main.*`, `src/index.*`, `src/app.*`
- `main.go`, `main.py`, `Main.java`, `Program.cs`
- `server.*`, `app.*`
- Scripts in `package.json` → `scripts.start`, `scripts.dev`
- Docker entrypoints in `Dockerfile` → `ENTRYPOINT`, `CMD`

### 5. Generate scan-manifest.json

Create `.discovery/code/scan-manifest.json`:

```json
{
  "version": 1,
  "scanned_at": "<ISO timestamp>",
  "root": "<scanned path>",
  "languages": [
    {"language": "typescript", "files": 234, "extensions": [".ts", ".tsx"], "confidence": "high"},
    {"language": "java", "files": 89, "extensions": [".java"], "confidence": "high"}
  ],
  "frameworks": ["react", "spring-boot", "postgresql"],
  "manifests_found": ["package.json", "pom.xml"],
  "entry_points": ["src/main.ts", "src/main/java/App.java"],
  "directories": {
    "total": 45,
    "source": ["src/", "lib/", "packages/"],
    "test": ["test/", "tests/", "__tests__/", "src/**/*.spec.*"],
    "config": [".github/", "config/"],
    "excluded": ["node_modules/", "dist/", "vendor/"]
  },
  "total_files": 542,
  "user_context": "<any hints the user provided, verbatim>",
  "exclusions": ["vendor", "dist"]
}
```

### 6. Initialize state.json (if not exists)

If `.discovery/code/state.json` does not exist, create it:

```json
{
  "version": 1,
  "pipeline": {
    "scan": {
      "status": "completed",
      "completed_at": "<ISO timestamp>",
      "root": "<scanned path>"
    },
    "extract_symbols": { "status": "never" },
    "build_graph": { "status": "never" }
  },
  "file_hashes": {}
}
```

If it already exists, update only the `scan` section.

### 7. Report summary

Present to user:
```
📊 Scan complete: <root>
├── Languages: TypeScript (234 files), Java (89 files), Python (19 files)
├── Frameworks: React, Spring Boot, PostgreSQL
├── Entry points: src/main.ts, src/main/java/App.java
├── Total: 542 files in 45 directories
└── Manifest saved: .discovery/code/scan-manifest.json

Next: Run `@discovery-code index` to parse and build the symbol graph.
```

## Fast Path: `pipeline.js`

If `.discovery/code/tools/pipeline.js` exists, this skill's work can be performed automatically as part of the full pipeline:

```bash
node .discovery/code/tools/pipeline.js "<src-dir>" --clean
```

This runs scan → extract → graph → resolve in a single command. Use this when processing a new module end-to-end. Use the individual skill steps when you need fine-grained control or debugging.

See `how-to/HOW-TO-PIPELINE.md` for full documentation.

## Guardrails

- **DO NOT** read file contents during scan — only names, extensions, and manifest files
- **DO NOT** scan inside `node_modules/`, `vendor/`, `.git/`, or other dependency directories
- **DO NOT** scan inside `.discovery/code/` or `.discovery/runtime/` output directories
- **Respect user exclusions** — if the user says "ignore src/legacy/", exclude it
- **Cap directory listing** — don't list more than 100 directories to avoid noise
- **Handle large repos** — if >10,000 files, warn and suggest narrowing scope


## Multi-Module Convention

All per-module artifacts are namespaced under a **module slug** subdirectory. See `.github/MULTI-MODULE.md` for full layout.

**Path resolution**: When this skill references a path like `.discovery/code/scan-manifest.json` or `.requirement/<slug>/flows/`, the actual path is `.discovery/code/scans/<module-slug>/scan-manifest.json` or `.requirement/<module-slug>/flows/`.

**Registry**: Read `.discovery/code/registry.json` or `.discovery/runtime/registry.json` to discover available modules. Update the registry when producing new artifacts.

**Module slug**: Derived from the app URL path (e.g., `tran-adequacyTRAN` from `http://localhost:3000/tran-adequacyTRAN`). If only one module exists, use it implicitly. If multiple exist, ask the user.
