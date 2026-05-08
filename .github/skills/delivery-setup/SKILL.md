---
name: delivery-setup
description: Run mandatory setup and readiness checks for the Delivery Agent. Validates tooling, skills, foundation docs, and cache marker behavior.
license: Apache-2.0
compatibility: Requires Node.js, npm, and OpenSpec CLI.
metadata:
  author: delivery-agent
  version: "2.1"
---

Run the Delivery Agent setup checks before any delivery phase.

Readiness marker:
- .github/delivery-agent.ready

---

## Step 0 - Force behavior

If user requests preflight force:
1. Delete .github/delivery-agent.ready if it exists.
2. Ignore cache for this run.
3. Continue with full setup.

---

## Step 1 - Cache check

If .github/delivery-agent.ready exists:
- Mark setup as cached
- Skip full checks
- Continue pipeline

If marker does not exist:
- Execute full checks below

---

## Step 2 - Tooling gate

Run:

```bash
node --version
npm --version
openspec --version
```

Rules:
- If node or npm are missing, stop and request installation
- If openspec is missing, ask user confirmation before installation guidance

---

## Step 3 - Skills gate

### Check: OpenSpec Skills Present

Verify that `.github/skills/` exists and contains **at least one subfolder whose name starts with `openspec-`** and has a `SKILL.md` file inside (e.g. `openspec-propose`, `openspec-apply-change`, etc.).

> A subfolder named `delivery-*` does **not** satisfy this check. Only `openspec-*` skill folders count.

> OpenSpec skills are not installed manually — they are generated when the repository is initialized with OpenSpec.

**PASS** → continue to Step 4.

**FAIL** → **MANDATORY: STOP ALL execution immediately. Do NOT proceed, do NOT open a terminal, do NOT take any other action.** Use the `vscode_askQuestions` tool to ask the user exactly:

> "❌ OpenSpec skills are not present in this repository. Skills are generated during repository initialization.
> Do you want to initialize OpenSpec now?"

Options: `yes` / `no`. Wait for the user's explicit response. Do not assume or infer an answer.

**If user answers "no":**
- STOP. Inform the user that OpenSpec skills are required to continue and end the session.

**If user answers "yes":**

1. Run in the terminal:
   ```bash
   openspec init --help
   ```
   Parse the output of the `--tools` option to extract the comma-separated list of available tool names (e.g. `github,azure-devops,jira,...`).

2. Use the `vscode_askQuestions` tool to present the tools as a native VS Code multi-select picker. Rules:
   - `multiSelect: true`
   - `allowFreeformInput: false`
   - One option per tool name extracted from the previous step
   - Always include `all` (description: "Install all tools") and `none` (description: "None") as options
   - Question text must be exactly: `"Which AI tools do you want to configure with OpenSpec?"`
   - Do NOT use bullet points or markdown lists — use the tool only.

3. Wait for the user's selection from the picker. Do NOT proceed until received.

4. Run in the terminal (replacing `<tools>` with the user's selection):
   ```bash
   openspec init --tools <tools>
   ```

5. Re-verify `.github/skills/` contains at least one subfolder whose name starts with `openspec-` and has a `SKILL.md` inside.
   - If still missing → report ❌ failure and STOP.
   - If present → continue to Step 4.

---

## Step 4 - Knowledge gate

Verify .foundation exists and has at least one markdown file.

Recommended baseline docs:
- project-intent.md
- domain-landscape.md
- data-model.md
- service-map.md
- guardrails.md
- anti-patterns.md
- coding-conventions.md
- architecture-decisions.md
- task-spec.md
- framework-api-registry.md
- api-contracts.md
- user-journey-ui.md

If missing, stop and request repository initialization.

---

## Step 5 - Write readiness marker

If full setup passed, create or update .github/delivery-agent.ready with:

```json
{
  "passedAt": "<ISO-8601>",
  "by": "delivery-setup"
}
```

If write fails, warn but do not block.

---

## Output format

Report one line per check:

- pass/fail cache status
- pass/fail tooling gate
- pass/fail skills gate
- pass/fail knowledge gate
- marker write status
