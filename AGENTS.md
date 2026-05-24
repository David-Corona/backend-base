# Project: NestJS Backend Starter

A production-ready NestJS backend template — auth, RBAC, email, and core
infrastructure baked in. Reusable foundation for multiple projects.

## Reference docs (read when relevant)

- `.opencode/specs/architecture.md` — layering, naming, error handling, modules, logging
- `.opencode/specs/api.md` — response shapes, error shape, pagination, status codes
- `.opencode/specs/tech.md` — stack, validation boundaries, Docker conventions
- `.opencode/specs/product.md` — feature scope and requirements

## Coding rules

- Before modifying a function, read every call site.
- Before you do any work, mention how you could verify that work.
- Write tests alongside the implementation, not after.
- Don't create helper files or utility modules unless explicitly asked.
  Prefer adding to existing files over creating new ones.
- Prisma is touched only in services. If you find yourself importing
  `PrismaService` outside a service, stop and rethink.
- All errors flow through the `AppException` hierarchy and the global
  exception filter. Never throw raw `Error` or construct error responses
  manually.

## Workflow rules

- At the start of each step, list key implementation decisions
  (schema choices, patterns, flows) and wait for approval before
  writing code.
- After building each step, suggest running the code-reviewer agent
  before moving to the next step.
- After a code review, present the findings and wait for instructions.
  Do not fix issues automatically.
- When all plan steps are complete, stop and propose shipping
  (commit + PR) per the Git section.

## Planning

When asked to plan a feature (or when in plan mode):

- Break work into vertical slices. Each step delivers a complete,
  testable piece of functionality (migration + service + controller +
  test together, not "step 1: migration, step 2: service" in isolation).
- Not too small (don't split "create file" from "add function").
  Not too big (don't lump unrelated work).
- Ask about anything unclear before writing the plan.
- The first build step must save the plan to
  `.opencode/plans/<short-name>.md` before starting any other work.
- Don't pad. Three steps is fine if three is enough.

## Git

- Before starting build on any planned feature, create a feature
  branch (feat/* or fix/*) from main. Always pull main before
  branching. Branch name matches the plan file name.
- When all plan steps are built and reviewed, invoke the git-ship
  agent. It will handle staging, commit message, PR creation, and
  optionally merging.

## Gotchas

(none yet — add entries here as you discover them)