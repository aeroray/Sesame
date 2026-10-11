# Area: Verification

Memory here applies only when touched files or task scope match this area.

## MC-AREA-20261111-a7b8c9d0 — Serve browser harnesses through Vite

Status: active
Scope: area:verify
Entry-Type: decision
Subject: MC-SUBJ-20261111-f1a2b3c4
Facet: workflow
Evidence:
- repo:src/lib/utils/platform.ts

Decision:
A harness importing project modules must load from the Vite dev server, never from disk or a proxy forwarding only `/src/**`.

Reason:
Vite rewrites bare module names when serving; a hand-served copy leaves `from 'svelte'` unresolved, and the failure is silent.

## MC-AREA-20261111-b8c9d0e1 — Trust the probe only after it can pass

Status: active
Scope: area:verify
Entry-Type: decision
Subject: MC-SUBJ-20261111-f1a2b3c4
Facet: performance
Evidence:
- repo:docs/design/design.md

Decision:
Before acting on a failed check, confirm the probe can report success at all, using a control known to pass. A harness must never restate the CSS it tests.

Reason:
Four false alarms came from broken probes, not code. See design.md section 16.

## MC-AREA-20261111-c9d0e1f2 — Test OS input in the built app

Status: active
Scope: area:verify
Entry-Type: decision
Subject: MC-SUBJ-20261111-f1a2b3c4
Facet: compatibility
Evidence:
- repo:src/lib/components/layout/Shell.svelte

Decision:
For OS-level input drive the built `sesame.exe`, not headless Edge. Assert layout with `getBoundingClientRect`, not class names.

Reason:
Edge consumes `Ctrl+Tab` for its own tabs, so the shell reports no keydowns and proves a bug that is not there.

## MC-AREA-20261111-e1f2a3b4 — Check the artifact, not the build log

Status: active
Scope: area:verify
Entry-Type: decision
Subject: MC-SUBJ-20261111-f1a2b3c4
Facet: lifecycle
Evidence:
- repo:package.json

Decision:
Confirm a build by inspecting what it produced: embedded asset names, signature key ids, timestamps. Re-run with a clean package when cargo finishes suspiciously fast.

Reason:
Cargo reuses results by mtime and can "succeed" without compiling. Compressed embedded assets hide literal strings, so compare the asset hash rather than grepping for content.

## MC-AREA-20261111-f4d5e6f7 — Release notes come from a file per tag

Status: active
Scope: area:verify
Entry-Type: decision
Subject: MC-SUBJ-20261111-f1a2b3c4
Facet: version-policy
Evidence:
- repo:scripts/load-release-notes.mjs

Decision:
The release body comes from `docs/releases/<tag>.md`, and a missing or empty file fails the build rather than publishing silently.

Reason:
Inline notes get reused verbatim when forgotten, so the previous version's text ships under the new tag.
