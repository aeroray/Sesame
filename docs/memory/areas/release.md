# Area: Release

Memory here applies only when touched files or task scope match this area.

## MC-AREA-20261111-f1a2b3c4 — One workflow: NSIS and Apple Silicon

Status: active
Scope: area:release
Entry-Type: decision
Subject: MC-SUBJ-20261111-e7f8a9b0
Facet: workflow
Evidence:
- repo:.github/workflows/release.yml

Decision:
A `v*` tag builds Windows NSIS and macOS `aarch64` `app,dmg`, then publishes the release.

Reason:
`app` ships beside `dmg` because the macOS updater artifact derives from the `.app`.

## MC-AREA-20261111-f2b3c4d5 — The updater endpoint is derived at build time

Status: active
Scope: area:release
Entry-Type: decision
Subject: MC-SUBJ-20261111-e7f8a9b0
Facet: architecture
Evidence:
- repo:scripts/prepare-release-config.mjs

Decision:
CI derives `.github/tauri-release.conf.json` from `GITHUB_REPOSITORY` and passes it via `--config`. Gitignored.

Reason:
A hardcoded endpoint makes every fork check the original owner's releases.

## MC-AREA-20261111-f3c4d5e6 — Pin tauri-action; use v1 input names

Status: active
Scope: area:release
Entry-Type: decision
Subject: MC-SUBJ-20261111-e7f8a9b0
Facet: compatibility
Evidence:
- repo:.github/workflows/release.yml

Decision:
Pin `tauri-action` to the v1 commit; pass `uploadUpdaterJson: true` and `generateReleaseNotes: false`.

Reason:
v1 renamed that key, and the old name is ignored without error, shipping no `latest.json`.

## MC-AREA-20261111-f4d5e6f7 — Notes per tag, version must match

Status: active
Scope: area:release
Entry-Type: decision
Subject: MC-SUBJ-20261111-e7f8a9b0
Facet: lifecycle
Evidence:
- repo:scripts/load-release-notes.mjs

Decision:
The body comes from `docs/releases/<tag>.md`; missing, empty, or a tag disagreeing with `package.json`/`Cargo.toml` fails the build.

Reason:
Inline notes are silently reused when forgotten; a mismatch ships a build whose version never matches its tag.

## MC-AREA-20261111-f5e6f7a8 — Update checks stay silent on failure

Status: active
Scope: area:release
Entry-Type: decision
Subject: MC-SUBJ-20261111-e7f8a9b0
Facet: behavior
Evidence:
- repo:src/lib/state/update.svelte.ts

Decision:
Check once three seconds after launch; on failure say nothing. Show a found version under Settings > About, its notes as plain text.

Reason:
Offline or proxy failures are not the user's problem, and the signature covers the binary, not the manifest.

