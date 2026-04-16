---
model: claude-haiku-4-5-20251001
---

Find the next uncompleted task in ROADMAP.md and ask the user for confirmation before starting.

1. Read `ROADMAP.md`
2. Find the first `[ ]` task — scan phases in order (Phase 1 first, then 2, etc.)
3. Note which phase it belongs to and what the full task description is
4. Check the current git branch to understand if a phase is already in progress
5. Report back in this format:

---

**Next task:** [task description]
**Phase:** Phase {number} — {name}
**Branch:** phase/{number}-{name} (exists / needs to be created)

**What this will build:** [1-2 sentence plain English description of what the agent will implement]

**Agent:** [which agent will handle it — db-designer / backend-builder / frontend-builder / docker-engineer]

Ready to start? Reply **yes** to build this task, or **build-phase {number}** to run the entire phase automatically.

---

Do not start building anything. Only report and wait for the user's reply.
