---
model: claude-sonnet-4-6
---

You are restyling UI components in RDeploy. The project uses dark mode, Tailwind CSS, shadcn/ui, and strict atomic design.

Restyle request: $ARGUMENTS

## Step 1 — Understand the Scope

Parse the request and identify:
- Which component(s) are being restyled (name, layer, file path)
- What the change is: color, spacing, layout, typography, animation, responsiveness, etc.
- Whether the change is isolated to one component or needs to ripple up/down the atomic layers

## Step 2 — Locate the Components

Search the codebase to find the exact files:
```
Codebase/Front-End/src/components/atoms/
Codebase/Front-End/src/components/molecules/
Codebase/Front-End/src/components/organisms/
Codebase/Front-End/src/components/templates/
```

Read each affected component before making any changes.

## Step 3 — Respect Atomic Design Rules

Before applying any style changes, verify these rules are not violated:

| Layer | Rules |
|-------|-------|
| **atoms** | Must stay generic and reusable. No hardcoded context-specific colors or sizes. Style via props/variants if variation is needed. |
| **molecules** | Style changes here must not break the atoms they compose. Do not add layout logic that belongs in an organism. |
| **organisms** | Can have context-specific styling. Internal layout is fine here. |
| **templates** | Only layout and spacing — no color, no component-specific styles. |

**Ripple check:** If you restyle an atom, check every molecule and organism that uses it. If restyling a molecule, check every organism that uses it. Report any components that will be visually affected.

## Step 4 — Apply the Changes

- Use `cn()` from `lib/utils.ts` for all conditional class merging — never string concatenation
- Use Tailwind CSS utility classes only — no inline styles, no CSS modules
- Keep dark mode in mind — all colors must work on dark backgrounds
- Use shadcn/ui design tokens (e.g. `bg-card`, `text-muted-foreground`, `border`) over raw Tailwind colors where applicable
- Do not change component logic, props, or data flow — style only
- Do not add new props unless absolutely required for the style variation, and only if the atom/molecule genuinely needs a new variant

## Step 5 — Report

After applying all changes, report:

---

**Components restyled:**
- [layer/ComponentName](path/to/file) — what changed

**Ripple impact:**
- [layer/ComponentName](path/to/file) — visually affected / not affected

**Rules followed:**
- ✅ / ⚠️ [any atomic design rule notes or trade-offs made]

---

Do not update ROADMAP.md or CHANGELOG.md for pure style changes unless the request was a tracked task.
If this was a tracked task, trigger the `docs-updater` agent after.
