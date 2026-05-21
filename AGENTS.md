# Project: NestJS Backend Starter

A production-ready NestJS backend template — auth, RBAC, email, and core infrastructure baked in. Reusable foundation for multiple projects.

Current focus: initial scaffolding — auth module, user module, and the global exception filter come first.

## Reference docs (read when relevant)

- `.opencode/specs/architecture.md` — layering, naming, error handling, modules, logging
- `.opencode/specs/api.md` — response shapes, error shape, pagination, status codes
- `.opencode/specs/tech.md` — stack, validation boundaries, Docker conventions
- `.opencode/specs/product.md` — feature scope and requirements

## Rules

- Before modifying a function, read every call site.
- Before you do any work, mention how you could verify that work.
- Write tests alongside the implementation, not after.
- Don't create helper files or utility modules unless explicitly asked. Prefer adding to existing files over creating new ones.
- Prisma is touched only in services. If you find yourself importing `PrismaService` outside a service, stop and rethink.
- All errors flow through the `AppException` hierarchy and the global exception filter. Never throw raw `Error` or construct error responses manually.
- When all plan steps are complete, stop and propose shipping (commit + PR) per the Git section.
- After building each step, suggest running the code-reviewer agent before moving to the next step.

## Planning

When asked to plan a feature (or when in plan mode):

- Break work into vertical slices. Each step delivers a complete, testable piece of functionality (migration + service + controller + test together, not "step 1: migration, step 2: service" in isolation).
- Not too small (don't split "create file" from "add function"). Not too big (don't lump unrelated work).
- Ask about anything unclear before writing the plan.
- Write the plan to `.opencode/plans/<short-name>.md` with one line per step describing what it does and one line describing how to verify it.
- Don't pad. Three steps is fine if three is enough.

## Git

- Before starting build on any planned feature, create a feature branch (feat/_ or fix/_) from main. Always pull main before branching. Branch name matches the plan file name. Never build on main.
- When all plan steps are built and reviewed, propose shipping: show the commit message, the PR title, and the list of files to stage. One confirmation — I say yes, you commit, push, and open the PR via gh pr create. Include the plan summary as the PR body.
- After opening the PR, ask whether to merge now or leave it for review. If merging now, merge via gh, switch to main, and pull.
- Commit message: type(scope): what (conventional commits: feat, fix, refactor, test, chore, docs).
- Never git add . — stage explicitly.
- Never push to main or force-push without confirmation.
- Never commit .env, secrets, or build artifacts.

## Gotchas

(none yet — add entries here as you discover them)
