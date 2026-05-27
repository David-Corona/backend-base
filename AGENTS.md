# Project: NestJS Backend Starter

## Reference docs

- `.opencode/specs/ARCHITECTURE.md` — layering, naming, error handling, modules, logging, validation boundaries, Docker conventions
- `.opencode/specs/API.md` — response shapes, error shape, pagination, status codes

## Coding rules

- Before modifying a function, read every call site.
- Before you do any work, mention how you could verify that work.
- Write tests alongside the implementation, not after.
- Prefer adding to existing files over creating new ones. Don't create
  helper files or utility modules unless explicitly asked.

## Workflow rules

- At the start of each step, list key implementation decisions
  and wait for approval before writing code.
- After building each step, suggest running the code-reviewer agent.
- After a code review, present findings and wait for instructions.
  Do not fix issues automatically.
- When all plan steps are complete, propose shipping via the
  git-ship agent.

## Planning

- Break work into vertical slices — each step delivers a complete,
  testable piece (migration + service + controller + test together).
- Not too small, not too big.
- Ask about anything unclear before writing the plan.
- First build step saves the plan to `.opencode/plans/<short-name>.md`.
- Don't pad. Three steps is fine if three is enough.

## Git

- Before building, create a feature branch (`feat/*` or `fix/*`) from
  main. Pull main first. Branch name matches the plan file name.
- When all plan steps are built and reviewed, invoke git-ship for 
  staging, commit, PR, and optional merge.

## Gotchas

(none yet)