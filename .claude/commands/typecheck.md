---
model: claude-haiku-4-5-20251001
---

Run TypeScript type-checking on both backend and frontend without emitting files.

```bash
cd Codebase/Back-End && npx tsc --noEmit
```

```bash
cd Codebase/Front-End && npx tsc --noEmit
```

Report results:
- ✅ if no errors
- ❌ list every error with file path and line number

If errors are found, use `/fix` with the error output to resolve them.

This is the same check run in the Definition of Done for every task. All TypeScript must be clean before a phase can be finished.
