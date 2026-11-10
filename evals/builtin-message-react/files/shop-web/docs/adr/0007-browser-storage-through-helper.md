# 7. Browser storage through one helper

Date: 2026-10-02
Status: Accepted

## Context

Features read and wrote `localStorage` directly with their own key names and JSON handling, so a key change broke users' saved settings and nothing handled a full or disabled storage.

## Decision

Only `src/shared/storage.ts` touches `localStorage` and `sessionStorage`.
Everything else calls `readSetting` and `writeSetting` from it.

## Consequences

One place owns the key prefix, JSON parsing and the fallback when storage is unavailable.
