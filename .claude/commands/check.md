---
model: claude-opus-4-6
---

You are checking whether a described feature exists in the RDeploy codebase.

Feature to check: $ARGUMENTS

## Step 1 — Understand the Request

Read `KNOWLEDGE_BASE.md` and `ROADMAP.md` to understand:
- Is this feature part of the spec?
- Is it already marked as done `[x]` in ROADMAP.md?
- Is it listed as a future task `[ ]`?

## Step 2 — Search the Codebase

Use the Explore agent to search the codebase thoroughly:
- Search backend routes, services, middleware
- Search frontend pages, components, hooks, services
- Search Prisma schema for relevant models or fields
- Look for related logic, even if named differently

## Step 3 — Report and Act

### If the feature IS implemented:

Report in this format:

---

**Status:** ✅ Already implemented

**Where to find it:**
- Backend: [file path:line] — [what it does]
- Frontend: [file path:line] — [what it does]
- Schema: [model/field] — [what it does]

**How to use it:** [1-2 sentence plain English guide]

---

Do not build anything. Just report.

---

### If the feature is NOT implemented but IS in the spec (KNOWLEDGE_BASE.md):

It's a pending roadmap task. Report in this format:

---

**Status:** 🔲 Not implemented — exists in spec

**Spec reference:** [quote the relevant section from KNOWLEDGE_BASE.md]

**Current ROADMAP status:** [found as `[ ]` task in Phase X / not yet listed]

---

Then ask the user: "Want me to start building this? Reply **yes** to run `/build-feature` on it."

If the user confirms, trigger `/build-feature` with the task description.

---

### If the feature is NOT in the spec and NOT implemented:

This is a new feature request. It must go through design before being added.

1. Use the `architect` agent to evaluate:
   - Does it fit the RDeploy architecture?
   - What models, endpoints, and UI would it affect?
   - What phase does it belong in?
   - Are there any conflicts with existing spec?

2. After the architect analysis, present the user with a summary and ask for confirmation before touching any files.

3. If the user confirms, update the following files:
   - **`KNOWLEDGE_BASE.md`** — add the feature spec under the appropriate section
   - **`ROADMAP.md`** — add a new `[ ]` task under the correct phase (create a new phase section if needed)
   - **`CLAUDE.md` or `.claude/` components** — only if the feature changes architecture, permissions, or conventions

4. After all doc updates, trigger the `docs-updater` agent to commit the changes with:
   ```
   docs(roadmap): add [feature name] task to roadmap
   ```

5. Report in this format:

---

**Status:** 🆕 New feature — added to roadmap

**Added to:** ROADMAP.md → Phase {X}, KNOWLEDGE_BASE.md → {section}

**What was added:** [1-2 sentence description]

**To build it now:** run `/build-feature [task description]`

---
