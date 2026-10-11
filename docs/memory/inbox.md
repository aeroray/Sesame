# Memory Inbox

Entries are newest first.

## MC-INBOX-20261011-03cee290 — Image writes must match their extension

Status: candidate
Candidate-Type: area
Scope: area:data
Provisional-Subject: MC-SUBJ-20261021-d4e5f6a7
Provisional-Facet: behavior
Evidence:
- repo:src/lib/actions/save-image.ts
- repo:src-tauri/src/commands/media.rs

Statement:
Image rotation must never overwrite a format the engine cannot encode. canvas.toDataURL silently returns PNG for GIF, BMP, ICO and AVIF, so those formats save a PNG copy to a user-chosen path instead of the original. Every image write compares a fingerprint baseline first, and the data URL subtype must match the file extension on the Rust side.

Promotion-Requirement:
toDataURL falls back to PNG silently, so writing an unsupported format would put PNG bytes inside a .ico while keeping the name.
