# oxlint

The oxlint branch of [`eslint-pattern-rules`](../SKILL.md), for a project that lints JS/TS with oxlint and not ESLint.
When the project runs ESLint at all, alone or next to oxlint, ignore this file and take the ESLint path.

oxlint runs ESLint-style rules through its JS plugins (alpha), so the rule file is the same as for ESLint.
What changes is setup, built-in rules, registration, the suggestions layer, tests and verify.
Checked with oxlint 1.93.0.

## Setup (step 1)

- Version: `node_modules/.bin/oxlint --version`.
- Config: `.oxlintrc.json` or `.oxlintrc.jsonc` (also `oxlint.config.ts`), its existing `jsPlugins`, and `overrides`.
- The lint script in `package.json`: its flags (`--type-aware`, `-c`, the paths it lints).
- Suppressions: oxlint honors `oxlint-disable*` and `eslint-disable*` comments; count both in discovery.

## Limits

JS plugins see no Vue, Svelte or Angular templates and no TypeScript types.
A convention that needs either is reported as "not built: oxlint JS plugins cannot see templates" (or "types"), unless a native oxlint rule covers it.
A `.vue` file's script block is linted; its template is not.

## Built-in rules (step 2)

- Native rules are listed by `node_modules/.bin/oxlint --rules -f json` (`scope`, `value`, `type_aware`).
- Name every rule as oxlint prints it in its `code`, `plugin(rule)` turned into `plugin/rule`: `eslint/no-console`, `typescript/no-explicit-any`, `jsx-a11y/alt-text`, `next/no-img-element`.
  The `--rules` scope is not always that name (`jsx_a11y`, `nextjs`, `react_perf`), and the loop's baseline keys rules by the printed name, so use it in the config, the report and the baseline alike.
- A `type_aware` rule runs only when the lint script passes `--type-aware`.
- `no-restricted-imports`, `no-restricted-globals` and `no-restricted-properties` exist and carry a `message` per entry.
- There is no `no-restricted-syntax`: a convention that needs a selector becomes a custom rule.
- Count today's hits in one run with every candidate rule: a scratch config outside the repo with `"extends": ["<abs path>/.oxlintrc.json"]` and the candidates in `rules`, run as `node_modules/.bin/oxlint -c <scratch> --format json <paths>`; count diagnostics per `code` (`eslint(no-console)` is `eslint/no-console`).

## Rule files (step 4)

```
oxlint-rules/index.js            the plugin: export default { meta: { name: 'local' }, rules: { 'gen-<name>': rule } }
oxlint-rules/gen-<name>.js       the rule, the same object as for ESLint (meta with schema and messages, create)
oxlint-rules/gen-<name>.test.js  its tests
```

- `oxlint-rules/` sits beside the config file; when the project already has a JS plugin file, add the rule there instead.
- ESM: oxlint imports the plugin.
- Never install ESLint or a parser for an oxlint project: step 4's "only when ESLint is absent altogether" install does not apply, and `package.json` stays byte-identical.
- Register in the config without asking: `"jsPlugins": ["./oxlint-rules/index.js"]` at the top level, and the rule in an `overrides` entry scoped by the agreed `files`:
  ```json
  { "jsPlugins": ["./oxlint-rules/index.js"], "overrides": [{ "files": ["src/**/*.ts"], "rules": { "local/gen-<name>": "error" } }] }
  ```
- The rule id is `local/gen-<name>`, as for ESLint; oxlint prints it as `local(gen-<name>)`.

## Suggestions layer

`.oxlintrc.suggestions.json` beside the main config, holding only the suggestion rules:

```json
{ "extends": ["./.oxlintrc.json"], "overrides": [{ "files": ["src/**/*.ts"], "rules": { "local/gen-<name>": "error" } }] }
```

Run it with `node_modules/.bin/oxlint -c .oxlintrc.suggestions.json <files>`; CI keeps the main config.
Propose a `lint:suggestions` script in the report.

## Tests

`RuleTester` comes from `oxlint/plugins-dev`:

```js
import { describe, it } from 'node:test'; // or vitest without globals
import { RuleTester } from 'oxlint/plugins-dev';
import rule from './gen-<name>.js';
RuleTester.describe = describe; RuleTester.it = it;
new RuleTester().run('gen-<name>', rule, { valid: [...], invalid: [{ code: '...', errors: [{ messageId: '...' }] }] });
```

When the project's oxlint has no `oxlint/plugins-dev`, say so in the report and rely on the real-code run in step 5.

## Verify (step 5)

```bash
node <skill-dir>/scripts/try-oxlint.mjs oxlint-rules/index.js local/gen-<name> [paths...] [--options '<json array>']
```

It runs only that rule over the code, with the project's own oxlint, and prints every hit.
Then run the project's own oxlint on one flagged file (with `-c .oxlintrc.suggestions.json` for a suggestion rule) to confirm the config loads and reports `local(gen-<name>)`.
