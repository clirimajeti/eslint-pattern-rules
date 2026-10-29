---
name: eslint-pattern-rules
description: Turn a codebase's own conventions into custom ESLint rules with RuleTester tests. Use when the user wants a custom ESLint rule or local plugin, asks which of their patterns or ADRs could become lint rules, or wants to enforce a convention the code mostly follows.
---

# ESLint Pattern Rules

A **convention** is what the codebase already mostly does, or what one of its decision records chose. This skill encodes one convention per rule, so the majority pattern becomes the only pattern. The project's code and decisions are the source of truth, and the user settles every design choice.

Count and locate with `rg -c` / `rg -n`, and open a file only for details a count can't give.

## 1. Detect the setup

Look each of these up rather than asking:
- **ESLint version**: `node -p "require('eslint/package.json').version"`. v9+ uses the flat APIs, v8 the legacy ones.
- **Config file**, **module format**, **installed parsers**, `tsconfig.json` `paths`, and **test runner**.
- **An existing custom-rules folder**: if there is one, follow its layout and style.
- **Decision records**: `docs/adr/`, `docs/decisions/`, `notes/decisions/`, `ADR-*.md`, CLAUDE.md, CONTRIBUTING.

Done when you can state each of these in one line.

## 2. Pick the convention

- **The user named one:** find 2-3 real examples of it and every violation. They become the test cases.
- **The user wants candidates:** read [`references/discovery.md`](references/discovery.md) and follow it. It covers the scan, what is already enforced, risk, the config-driven auto mode, and the selection dialog.

A built-in rule wins when it can express the convention (`no-restricted-syntax`, `no-restricted-imports`, `max-params`, or a rule from an installed plugin). Hand the user its exact config and move on. A custom rule earns its place when the logic needs scope, paths, options, a tailored message or a fix.

Done when every convention you will build has its good examples and its full violation list.

## 3. Settle the design with the user

For each rule, work through these, skipping whatever the code already answers:
- **Boundary**: what is flagged. Test it against the real edge cases: nested callbacks, test files, generated code, re-exports, type-only imports, JSX/templates, computed access (`p["then"]`).
- **Scope**: which files. Set this through the config's `files` globs. Use rule options only when the logic itself depends on paths (layer A must not import layer B). Folder names live in config or options, so the rule fits any layout.
- **Options**: only the knobs needed today. Each one gets a JSON `schema` and a default that fits the project, such as aliases read from `tsconfig.json`.
- **Fix**: `fix` when behavior is provably unchanged, `suggest` when a human should confirm, none otherwise.
- **Message, type, severity, name** (`gen-<name>`).

Ask with `AskUserQuestion`, in rounds of up to 4 questions whose prerequisites are settled. Put your recommended answer first and label it "(Recommended)". Show a real code example in the question or in an option's `preview`. Without the tool, ask the same rounds as a numbered list in chat.

When the rule was selected automatically, or nobody can answer, answer with your recommendations and take the **safer** side: `suggest` over `fix`, `warn` over `error`, the narrower scope. Step 6 puts these answers to the user.

Done when every question has an answer and you know who gave it.

## 4. Write the rule and its tests

Each rule is exactly two files, both prefixed `gen-` so generated rules stay distinct from hand-written ones:

```
<rules-dir>/gen-<name>.js
<rules-dir>/gen-<name>.test.js
```

`<rules-dir>` is the existing custom-rules folder, or else `eslint-rules/` at the repo root. The rule id is `local/gen-<name>`. Hand-written rules stay as they are. If the folder has a rules index, add the new rule to it in the index's existing style.

Write plain JS in the project's module format, one convention per rule. Comment only where the logic is non-obvious, and leave out doc blocks and `meta.docs`. The gotchas that bite here:
- `meta.schema` is always set (`[]` for no options): v9 rejects options a rule has no schema for.
- Context is tracked with a stack (push on `:function`, decide on `:function:exit`), not by walking `node.parent` or re-traversing a body per match, which goes O(n²) on large files.
- Import rules cover all four forms: `ImportDeclaration`, `ImportExpression`, `ExportNamed/AllDeclaration` with a `source`, and `require()`. They match the resolved target path (relative specifiers resolved against `context.filename`, aliases from tsconfig `paths`), with separators normalised to `/`.
- Vue template checks go through `sourceCode.parserServices.defineTemplateBodyVisitor`, guarded for its absence. Type-aware logic is guarded on `parserServices?.program`, so the rule degrades instead of crashing where type info is not configured.
- RuleTester picks up global `describe`/`it`. Under vitest without `globals` or under `node:test`, assign `RuleTester.describe`, `RuleTester.it` and `RuleTester.itOnly` first, and place the test file where the runner's `include` pattern finds it.

Build the tests from the real code:
- `valid`: the convention and every allowed edge case.
- `invalid`: each kind of violation, with its `messageId` plus `output` (or `output: null`).
- One case per option value.
- The project's TS or framework syntax, when its parser is installed.

**`package.json`** stays byte-identical whenever ESLint is installed, directly or through another tool. A parser the project lacks goes into your report as an install command with an exact version on every package (`npm i -D --save-exact @typescript-eslint/parser@x.y.z`), and the tests use syntax the installed parsers can read. `try-rule.mjs` still checks `.ts` and `.vue` files without those parsers. Only when ESLint is absent altogether, install `eslint` plus the parsers the project's languages need:
- as devDependencies at exact versions: `npm i -D --save-exact eslint@x.y.z`, `pnpm add -D -E`, `yarn add -D --exact` or `bun add -d --exact`
- official packages only: `eslint`, `typescript-eslint`, `@typescript-eslint/parser`, `vue-eslint-parser`, `svelte-eslint-parser`, `astro-eslint-parser`

Run tools from `node_modules/.bin/` or with `npx --no-install`.

Register the rule in the ESLint config yourself, without asking: it is part of building the rule, not a design choice. Add only what the rule needs and leave every other entry as it is:
- **Flat config**: reuse the existing local plugin if there is one (an index or `plugins: {local: ...}` entry), otherwise add `plugins: {local: {rules: {'gen-<name>': rule}}}`. Enable `'local/gen-<name>'` at the agreed severity and options, in a config object scoped by the agreed `files`.
- **Legacy `.eslintrc`**: register it through the project's existing local-rules mechanism (`eslint-plugin-local-rules`, `--rulesdir`). When there is none, the registration would need a new package, so leave the config as it is and put the snippet and its install command in the report.

## 5. Verify

1. Run the rule's tests until they pass.
2. From the project root, run the rule over the real code:
   ```bash
   node <skill-dir>/scripts/try-rule.mjs <rules-dir>/gen-<name>.js [paths...] [--options '<json>'] [--fix-dry-run]
   ```
3. Account for every hit: each one is a violation under the agreed boundary. A false positive becomes a `valid` test and a rule fix, then a rerun. Report any file type the "Parsers" line lists as skipped or only partly checked.
4. Run the project's own ESLint on one flagged file, to confirm the config loads and reports `local/gen-<name>`.

Done when the tests pass, every hit is accounted for, and the project's ESLint reports the rule.

## 6. Report

Keep it short:
- each rule, with its hit count and a few hits
- the config change, as a short diff
- any install or parser command
- the conventions you didn't build
- the scan log, if you scanned

If you answered design questions on the user's behalf, close with one `AskUserQuestion` round that presents those answers, with yours as the first option. Apply the changes, then rerun step 5 for that rule.
