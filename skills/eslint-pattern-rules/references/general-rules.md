# General rules

Well-known rules worth suggesting when a project does not use them yet, whatever its code mostly does today.
Almost all of them already exist in ESLint core or in a plugin the project may have, so a suggestion is usually a config entry, not a custom rule.
A rule from a plugin the project does not have is never installed: it goes into the report as an option, with its install command.
Under oxlint, a rule is suggested only when `oxlint --rules -f json` lists it, by its oxlint name (`<scope>/<value>`), and counted as [`oxlint.md`](oxlint.md) describes; the ESLint commands below do not apply.

Count today's hits without touching the config, in **one** ESLint run with every candidate rule as a `--rule` override (each run lints the whole tree, so one run per rule multiplies the time):

```bash
npx --no-install eslint --rule '{"complexity": ["warn", 10]}' --rule '{"max-params": ["warn", 3]}' --format json "src/**/*.{js,ts,vue}" > /tmp/general.json \
  || true; node -e 'const r=require("/tmp/general.json");const by={};for(const f of r)for(const m of f.messages){(by[m.ruleId]??=new Set()).add(f.filePath);(by[m.ruleId].n=(by[m.ruleId].n||0)+1)}for(const[k,v]of Object.entries(by))console.log(k,v.n,"hits in",v.size,"files")'
```

`--rule` only works for core rules: for a plugin rule (`@typescript-eslint/*`, `@angular-eslint/*`, `vue/*`) ESLint cannot find the plugin and crashes.
For those, write a scratch config outside the repo that imports the project's config and appends one object with the candidate rules, and run it with `--config`:

```js
// <scratch>/probe.config.mjs
import base from '<project>/eslint.config.js'; // or .mjs / .ts, whatever the project uses
export default [...base, { basePath: '<project>', rules: { '@typescript-eslint/no-floating-promises': 'warn' } }];
```

`basePath` (ESLint 9.30+) keeps the project's `files` and `ignores` relative to the project root; on older versions, put the probe in a git-ignored folder inside the project instead.

Write the JSON to a scratch file, not the repo.
When the output is empty or not JSON, ESLint crashed: rerun without `--format json` and read the first error.

For a limit, offer two starting values: the standard one below, with its hit count, and the strictest value the code already meets, which starts at zero hits.
Get the strictest value from a run with the limit set to 1: the rule's messages carry each function's actual value, and the maximum is the strictest value with zero hits.

A type-aware rule runs only on files with type information.
When the config gives it to some files only, count on those (`"src/**/*.ts"`) and label the count as partial, with the file types left out.

## Clean code limits

| Rule | Check first | Standard value |
|---|---|---|
| Cyclomatic complexity per function | `complexity` | 10 |
| Nesting depth | `max-depth` | 4 |
| Function length | `max-lines-per-function` (skip blank lines and comments) | 50 |
| Parameters per function | `max-params` | 3, then an options object |
| No nested ternaries | `no-nested-ternary` | on |
| No `else` after `return` | `no-else-return` | on |
| No unused variables and imports | `no-unused-vars`, `@typescript-eslint/no-unused-vars` | on, with `_` as the ignore pattern |
| Unused files and exports | `knip` (a separate tool, report only) | - |

## Agent-friendly code

Code an agent can read whole and change locally costs fewer tokens per task.

| Rule | Check first | Standard value |
|---|---|---|
| File length | `max-lines` (skip blank lines and comments) | 400 |
| No commented-out code | `sonarjs/no-commented-code` when installed, else a custom rule | on |
| No leftover debug output | `no-console`, `no-debugger` | error in CI |
| Generated and vendored code is excluded | `ignores` entries for generated folders | present for every generated folder |

## Bug-prevention basics

| Rule | Check first | Needs |
|---|---|---|
| Strict equality | `eqeqeq` | - |
| Promises are awaited or handled | `@typescript-eslint/no-floating-promises`, `@typescript-eslint/no-misused-promises` | type-aware config |
| Exhaustive `switch` on unions | `@typescript-eslint/switch-exhaustiveness-check` | type-aware config |
| No fallthrough, no unreachable loop, no self-compare | `no-fallthrough`, `no-unreachable-loop`, `no-self-compare` | - |
| No constant conditions | `no-constant-binary-expression`, `no-constant-condition` | - |
| Array callbacks return | `array-callback-return` | - |
| No unsafe optional chaining | `no-unsafe-optional-chaining` | - |
| Vue reactivity is kept | `vue/no-mutating-props`, `vue/no-setup-props-reactivity-loss`, `vue/no-ref-object-reactivity-loss` | `eslint-plugin-vue` |
| React hooks rules | `react-hooks/rules-of-hooks`, `react-hooks/exhaustive-deps` | `eslint-plugin-react-hooks` |

## Security basics

| Rule | Check first | Needs |
|---|---|---|
| No dynamic code | `no-eval`, `no-implied-eval`, `no-new-func` | - |
| No `javascript:` URLs | `no-script-url` | - |
| No raw HTML | `vue/no-v-html`, `react/no-danger`, `svelte/no-at-html-tags` | the framework plugin |
| Safe external links | `vue/no-template-target-blank`, `react/jsx-no-target-blank` | the framework plugin |
| No secrets in source | a secret scanner in CI (gitleaks, trufflehog) | report only |

## Framework rules from installed plugins

Offer these only when the plugin is installed and no enabled preset turns them on.

| Rule | Check first | Needs |
|---|---|---|
| Signals over plain fields for component state | `@angular-eslint/prefer-signals` | `angular-eslint` |
| Signals are called in templates and code | `@angular-eslint/no-uncalled-signals` | `angular-eslint` |
| `inject()` over constructor injection | `@angular-eslint/prefer-inject` | `angular-eslint` |
| Standalone components | `@angular-eslint/prefer-standalone` | `angular-eslint` |

## Test hygiene

| Rule | Check first | Needs |
|---|---|---|
| No focused tests left in | `vitest/no-focused-tests`, `jest/no-focused-tests`, else `no-restricted-properties` on `it.only`, `describe.only`, `test.only` | - |
| No skipped tests without a reason | `vitest/no-disabled-tests`, `jest/no-disabled-tests` | the test plugin |
| Every test asserts | `vitest/expect-expect`, `jest/expect-expect` | the test plugin |
| No duplicate test titles | `vitest/no-identical-title`, `jest/no-identical-title` | the test plugin |
