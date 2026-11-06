# ESLint Pattern Rules

An agent skill that turns your codebase's own conventions into custom ESLint rules, each with RuleTester tests.

Every codebase has conventions it mostly follows but never enforces.
Components fetch through hooks, pure modules take `now` as a parameter, IDs come from one helper.
They live in review comments and in the heads of whoever was around when they were decided.

This skill finds them, asks you which ones to enforce and how, and writes one rule per convention.
The majority pattern becomes the only pattern.

It works with any framework (React, Vue, Svelte, Angular, plain TS/JS) and any folder layout.
Folder names live in your ESLint config or in rule options, so the same rule fits every app.

## Installation (one-minute setup)

### 1. Get the skill

**Claude Code**

```bash
claude plugin marketplace add clirimajeti/eslint-pattern-rules
claude plugin install eslint-pattern-rules@eslint-pattern-rules
```

**Codex, Copilot, Cursor and others**

```bash
npx skills add clirimajeti/eslint-pattern-rules
```

Run `npx skills update` to update.

**Manual**

Copy `skills/eslint-pattern-rules/` into your agent's skills folder, for example `~/.claude/skills/eslint-pattern-rules/`.

### 2. Ask for a rule

The skill is model-invoked, so there is no command to remember.
Ask in your own words, or name it:

- "Turn our rule that components never import from `api/` into an ESLint rule."
- "Which of our patterns or ADRs could become lint rules?"
- "We agreed to stop mixing `await` with `.then()` chains. Enforce it."

### 3. Run your linter

The rule lands in `eslint-rules/`, already registered in your ESLint config.
The convention is enforced from the next lint run on.

## Why This Skill Exists

Lint rules are the cheapest code review you will ever get.
They run on every save, never get tired, and never argue.
But writing a good custom rule is fiddly, so most teams never do, and the conventions slowly erode.
I kept running into the same four problems when I asked agents to help.

### #1: The Convention Only Exists In Reviews

> "Don't live with broken windows."
>
> David Thomas & Andrew Hunt, [The Pragmatic Programmer](https://pragprog.com/titles/tpp20/the-pragmatic-programmer-20th-anniversary-edition/)

**The Problem**: A convention that is only enforced by people is enforced inconsistently.
One violation slips through, gets copied, and soon there are two ways to do the same thing.
Agents make this worse, because they learn from whatever the code already does, violations included.

**The Fix**: Turn the convention into a rule.
The skill reads your ADRs and your code, counts the good and bad usages of each pattern, and proposes the ones the codebase already mostly follows.
Under roughly 80% agreement it is a team decision, not a discovery, and the skill says so instead of picking a side.

### #2: Generic Rules Don't Know Your Code

> "It is not enough for code to work."
>
> Robert C. Martin, [Clean Code](https://www.oreilly.com/library/view/clean-code-a/9780136083238/)

**The Problem**: Built-in and plugin rules can ban `innerHTML` or restrict an import path.
They can't know that `sanitize()` is your safe helper, that `features/*/api` is off limits to components, or that `@/` is an alias.
So teams either ban too much or leave the gap open.

**The Fix**: Rules that encode "only through *our* helper" and "only across *our* boundaries".
Before writing anything, the skill checks whether a core or installed rule already does the job, and recommends that config instead.
A custom rule is only written when nothing else fits.

<details>
<summary>
Example
</summary>

A React app has an ADR saying components fetch through hooks, never through `api/` directly.
Most components follow it, a couple don't.

- **Generic**: `no-restricted-imports` with a hard-coded path, which misses the moment someone imports through the `@/` alias.
- **Generated**: a `gen-` rule that reads the alias from `tsconfig` paths, takes the folder names as options, and reports exactly the offenders.
  The same rule then fits your other apps with a different folder layout.

</details>

### #3: The Agent Rewrites Your Setup

**The Problem**: Ask an agent for a lint rule and it will often bump ESLint, add a plugin, rewrite your config, and touch half your source files along the way.
Now a small change has become a dependency upgrade nobody asked for.

**The Fix**: The skill has a hard footprint.
It writes exactly two files per rule, `eslint-rules/gen-<name>.js` and `eslint-rules/gen-<name>.test.js`.
The `gen-` prefix keeps generated rules apart from hand-written ones.
In your ESLint config it adds only the entry that enables the rule, scoped to the files it applies to.
It leaves alone:

- **`package.json` and your lockfile**, whenever ESLint is already installed, directly or through another tool.
  Only a project with no ESLint at all gets `eslint` and the parsers it needs, pinned to exact versions.
- **The rest of your ESLint config.**
- **Your source files and hand-written rules.**
- **Your agent docs**, except the lines you approve deleting or shortening once a rule enforces them.

### #4: Nobody Trusts A Noisy Rule

**The Problem**: A rule that needs a disable comment every other file is worse than no rule.
People learn to ignore it, and then they ignore the real reports too.

**The Fix**: Every rule ships with RuleTester tests, and is run against your real code before you see it.
[`try-rule.mjs`](./skills/eslint-pattern-rules/scripts/try-rule.mjs) runs one rule over the codebase with your project's own ESLint, without touching your config.
Every hit it reports is accounted for, either as a real violation or as a bug in the rule that gets fixed.

> [!TIP]
> When no TypeScript or Vue parser is installed, `try-rule.mjs` falls back to Node's built-in type stripping (Node 22.13+) and the `<script>` blocks of `.vue` files.

### Summary

Your codebase already knows its own rules.
This skill writes them down in the one place they can't be ignored.

## Reference

### How It Works

1. **Detects your setup**: ESLint version (v8 or v9 flat), config format, parsers, path aliases, test runner, an existing custom-rules folder, decision records (ADRs), and agent docs (CLAUDE.md, AGENTS.md, Copilot and Cursor instructions).
2. **Finds the convention.**
   Either the one you named, with its real examples and every violation, or a scan for candidates.
   The scan looks at your code, your ADRs and the rules written as prose in your agent docs.
   It also checks a list of well-known clean-code, bug-prevention, security and test rules your project doesn't use yet, with how many places each would flag today.
   It skips anything already enforced by an existing rule or architecture test.
3. **Selects the candidates.**
   First asks: automatic or manual.
   Automatic builds every recommended rule and asks only for doc changes, doc-vs-code contradictions and high-risk rules.
   Manual shows every candidate in one selection, well-known rules included, recommended ones marked, and builds only what you pick.
4. **Asks you the design questions**: boundary, scope, options, autofix, severity.
   Each comes with a recommended answer and a real example from your code.
   In automatic mode the skill answers them itself and shows you its answers for review at the end.
5. **Writes the rule and its test**, and registers the rule in your ESLint config.
   A rule your existing code breaks goes into a suggestions config (`eslint.config.suggestions.mjs`) instead, so CI stays green while new code is still checked.
6. **Verifies** the rule: its tests pass, every hit it reports on your real code is accounted for, and your own ESLint picks it up.
7. **Offers to clean up your agent docs**: for each line the new rule now enforces, you choose to delete it, shorten it to a pointer, or keep it.
   Fewer prose rules means less context every agent session has to read.

### Layout

```
skills/eslint-pattern-rules/
├── SKILL.md                    # the workflow
├── agents/openai.yaml          # Codex picker metadata
├── references/
│   ├── discovery.md            # candidate scan, coverage, risk, selection
│   ├── pattern-catalog.md      # signals to probe, with built-in rules to check first
│   └── general-rules.md        # well-known rules to suggest when the project lacks them
├── scripts/try-rule.mjs        # runs one rule over real code without touching your config
└── evals/                      # a test case for `claude plugin eval`
```

### Running the Evals

```bash
cd skills/eslint-pattern-rules
claude plugin eval . --allow-tools Write,Edit,Bash --scaffold
```

## License

MIT
