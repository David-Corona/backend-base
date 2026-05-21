---
description: Grill me on a plan or design until we're aligned
agent: plan
---

Grill me about this plan or design until we reach shared understanding: $ARGUMENTS

Start by identifying the key decisions to make. List them briefly. Then resolve them one at a time, starting with whatever constrains the most other decisions.

For each question:
- Provide your recommended answer with brief reasoning.
- When there are real alternatives (libraries, patterns, approaches), compare briefly before recommending.

Rules:
- One question at a time.
- If a question can be answered by exploring the codebase, explore instead of asking.
- Don't move on until the current decision is resolved.
- If after resolving a decision there are no remaining open questions worth asking, say so and produce the summary without waiting for me.

When grilling is done (or when I say we're done), summarize:
- The goal in one sentence.
- The key decisions and why.
- What's explicitly out of scope.