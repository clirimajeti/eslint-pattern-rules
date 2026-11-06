---
name: eslint-pattern-rules
description: Turn a codebase's own conventions into custom ESLint rules with RuleTester tests, and suggest well-known ESLint rules it is missing. Use when the user wants a custom ESLint rule or local plugin, asks which of their patterns, ADRs or CLAUDE.md / AGENTS.md instructions could become lint rules, asks which clean-code, bug-prevention, security or test rules the project lacks, or wants to enforce a convention the code mostly follows.
---

# ESLint Pattern Rules

A **convention** is what the codebase already mostly does, or what one of its decision records chose. This skill encodes one convention per rule, so the majority pattern becomes the only pattern. The project's code and decisions are the source of truth, and the user settles every design choice.
Nothing is written until the user has picked it.

A rule also saves context: a convention written as prose in CLAUDE.md or AGENTS.md is read by every agent session, while a rule costs nothing until it is broken.

Count and locate with `rg -c` / `rg -n`, always with a path (in scripts, `rg` without one waits on stdin) (with several `-g` globs the last matching one wins, so put exclusions like `-g '!*.spec.ts'` after the includes), and open a file only for details a count can't give.

## 1. Detect the setup

Look each of these up rather than asking:
- **ESLint version**: `node -p "require('eslint/package.json').version"`. v9+ uses the flat APIs, v8 the legacy ones.
  When `node_modules` is missing, ask before installing dependencies (`npm ci --ignore-scripts` with a lockfile, `npm install --ignore-scripts --no-package-lock` without one, both git-ignored); without them, report every count that needs ESLint as "not counted".
- **Config file**, **module format**, **installed parsers**, `tsconfig.json` `paths`, and **test runner**.
- **An existing custom-rules folder**: if there is one, follow its layout and style.
- **Generated code**: generator markers such as `.yo-rc.json`, `.jhipster/`, `.openapi-generator/`, `@Generated`, or `DO NOT EDIT` headers, and the source folders each generator owns.
  A rule still guards new code there, but existing hits are fixed in the generator's template or blueprint, not by hand: say so for each hit in generated code.
- **Decision records**: `docs/adr/`, `docs/decisions/`, `notes/decisions/`, `ADR-*.md`, CONTRIBUTING.
- **Agent docs**: every `CLAUDE.md`, `AGENTS.md` and `GEMINI.md` in the repo, `.github/copilot-instructions.md`, `.github/instructions/*.md`, `.cursor/rules/`, `.cursorrules`, `.windsurfrules`.

Done when you can state each of these in one line.

## 2. Pick the convention

- **The user named one:** find 2-3 real examples of it and every violation. They become the test cases.
  Note every agent-doc line that states the same convention, for step 6.
- **The user wants candidates:** read [`references/discovery.md`](references/discovery.md) and follow it. It covers the scan of code, decision records and agent docs, the general rules from [`references/general-rules.md`](references/general-rules.md), what is already enforced, risk, the mode question (automatic or manual), and the selection dialog.

A built-in rule wins when it can express the convention (`no-restricted-syntax`, `no-restricted-imports`, `max-params`, or a rule from an installed plugin). Offer its exact config as the candidate. Once picked, add it to the ESLint config, scoped by `files`, and verify it with the project's own ESLint run instead of steps 4 and 5. A custom rule earns its place when the logic needs scope, paths, options, a tailored message or a fix.

Done when every convention you will build has its good examples and its full violation list.

## 3. Settle the design with the user

For each rule, work through these, skipping whatever the code already answers:
- **Boundary**: what is flagged. Test it against the real edge cases: nested callbacks, test files, generated code, re-exports, type-only imports, JSX/templates, computed access (`p["then"]`), and fully qualified or global-qualified access (`globalThis.Date.now()`, `window.fetch(...)`).
- **Scope**: which files. Set this through the config's `files` globs. Use rule options only when the logic itself depends on paths (layer A must not import layer B). Folder names live in config or options, so the rule fits any layout.
- **Options**: only the knobs needed today. Each one gets a JSON `schema` and a default that fits the project, such as aliases read from `tsconfig.json`.
- **Fix**: `fix` when behavior is provably unchanged, `suggest` when a human should confirm, none otherwise.
- **Message, type, severity, name** (`gen-<name>`).
- **Layer**: the main config, or the suggestions layer (step 4) when the existing code breaks the rule.

Ask with `AskUserQuestion`, in rounds of up to 4 questions whose prerequisites are settled. Put your recommended answer first and label it "(Recommended)". Show a real code example in the question or in an option's `preview`. Without the tool, ask the same rounds as a numbered list in chat.

When the rule was selected automatically, or nobody can answer, answer with your recommendations and take the **safer** side: `suggest` over `fix` and the narrower scope.
Severity: always `error`.
With no open hits the rule goes in the main config, because nothing old breaks; with open hits it goes in the suggestions layer (step 4), so CI stays green while agent feedback loops, which block only on errors, still show it on new code.
Step 7 puts these answers to the user.

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

**Suggestions layer**, for a rule the existing code breaks.
At `error` in the main config it would fail CI on day one; at `warning` nobody sees it, since feedback loops block only on errors.
So it goes into a second config at `error` and stays out of the main one:
- **Flat config**: `eslint.config.suggestions.mjs` beside the main config, importing it and adding one object with the suggestion rules, scoped by their `files`:
  ```js
  import base from './eslint.config.mjs';
  export default [...base, { name: 'suggestions', files: ['src/**/*.ts'], rules: { 'local/gen-<name>': 'error' } }];
  ```
  Spread the main config the way its export is built (an array, `defineConfig(...)`, `tseslint.config(...)`), and register the local plugin in the main config, so it is defined once.
- **Legacy `.eslintrc`**: `.eslintrc.suggestions.cjs` holding only the suggestion rules; `eslint -c .eslintrc.suggestions.cjs` merges it over the project's own config.
- When the project already has a second config that extends the main one for this purpose (stricter, "suggestions", "next"), add the rules there instead of creating another.
- Anyone working on a file, and a feedback loop, runs `npx --no-install eslint -c <suggestions config> <files>`; CI keeps running the main config.
  `package.json` stays byte-identical, so propose a `lint:suggestions` script in the report.
- When a rule's open hits reach 0, move it to the main config and out of the suggestions config.

## 5. Verify

1. Run the rule's tests until they pass.
2. From the project root, run the rule over the real code:
   ```bash
   node <skill-dir>/scripts/try-rule.mjs <rules-dir>/gen-<name>.js [paths...] [--options '<json>'] [--fix-dry-run]
   ```
3. Account for every hit: each one is a violation under the agreed boundary. A false positive becomes a `valid` test and a rule fix, then a rerun. Report any file type the "Parsers" line lists as skipped or only partly checked.
4. Run the project's own ESLint on one flagged file, to confirm the config loads and reports `local/gen-<name>`; for a suggestion rule, run it with `-c <suggestions config>`, and run the main config once more to confirm it reports nothing new.

Done when the tests pass, every hit is accounted for, and the project's ESLint reports the rule.

## 6. Offer the agent-doc cleanup

Only for a rule built or enabled in this run and verified (a custom rule through step 5, a config change through the project's own ESLint run), and only for the agent-doc lines that state the convention it now enforces.
A rule in the suggestions layer counts: a feedback loop that runs the suggestions config shows it on every changed line.
Without such a loop, say in the question that only people who run the suggestions config see it.
The cleanup always asks, in both modes: it changes a doc.
In manual mode, ask one `AskUserQuestion` per rule; in automatic mode, ask the lines of every built rule in one call after the builds.
Quote each line with its file and line number:
- **Delete the line**: recommended when the fix is local and mechanical, so the rule's message alone tells an agent what to do.
- **Shorten it to a pointer**, such as `Data fetching: hooks only (enforced by local/gen-<name>).`: recommended when the convention shapes code before it is written, so an agent that never saw it would build the wrong thing and redo it.
  The pointer goes where the agent will load it: a `CLAUDE.md` in the folder the rule applies to, or an instructions file with an `applyTo` glob for those paths.
  A pointer left only in a file the agent has to follow a link to read is not seen up front, so propose the place in the same question.
- **Keep it as it is.**

Before recommending a delete, make sure the rule's message carries what the line said, plus the ADR link if there is one.
Edit the doc only as answered, and never touch a line no verified rule covers.
With nobody to answer, change no doc and list the lines in the report.

Done when every covered line is answered or listed.

## 7. Report

Keep it short:
- each rule, with its hit count and a few hits
- the config change, as a short diff
- the suggestions layer, when there is one: its rules with their open hits, the command to run it, the proposed `lint:suggestions` script, and that each rule moves to the main config once its hits reach 0
- any install or parser command
- the agent-doc lines deleted, shortened or kept, with the doc tokens removed (characters / 4), split into always-loaded and on-demand lines, since only always-loaded lines cost tokens in every session
- the bigger saving is usually not the doc tokens but the fix rounds a rule avoids: say so instead of presenting the character count as the benefit
- the general rules offered and not picked, and those that need a plugin
- the conventions you didn't build
- whether agents get the rule's feedback while they work: when nothing lints an agent's edits before the session ends (a hook, or an instruction to run the linter before finishing), recommend one, for example the `codemyrules` feedback loop; without it a broken rule only surfaces in CI, after the session
- the scan log, if you scanned

If you answered design questions on the user's behalf, close with one `AskUserQuestion` round that presents those answers, with yours as the first option. Apply the changes, then rerun step 5 for that rule.
With nobody to answer, end the report with those answers as a numbered list instead, each with its reason and the alternative.
