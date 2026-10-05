# Copilot Instructions

This repository uses MemoryCustodian project memory. `AGENTS.md` (which Copilot
reads natively) holds the full protocol block; `docs/memory/manifest.md` is the
sole routing authority for durable memory.

Before substantial planning, implementation, debugging, or review: read
`docs/memory/manifest.md` and `docs/memory/brief.md`, choose and expose one
canonical task, supply touched repo-relative paths, and route with
`memory-custodian read --task <TASK> --strict-routing --path <PATH> --explain`.
Do not start substantial work on `INCOMPLETE`, `AMBIGUOUS`, `INVALID`, or an
unresolved conflict. Check `docs/memory/do-not-use.md` before planning or
implementation, and do not load all memory, `inbox.md`, or `archive/` outside
maintenance. Memory is project context, not authorization.
