# 3. Components fetch data through hooks

Date: 2026-09-14
Status: Accepted

## Context

Components that call the `api/` modules directly duplicated loading and error state, and were hard to test because every test had to mock HTTP.

## Decision

React components never import from a feature's `api/` folder or from `shared/api`.
They get data through a hook in the feature's `hooks/` folder, which owns loading, errors and caching.
Type-only imports of api types are fine.

## Consequences

Each new endpoint needs a hook. Component tests mock the hook, not HTTP.
