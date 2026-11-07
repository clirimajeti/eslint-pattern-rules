# Discovery

The candidate branch of [`eslint-pattern-rules`](../SKILL.md): the user asked which conventions or rules the project could add.
Ask the mode question, then work the five steps in order.
The scan finds conventions in the code, the decision records and the agent docs, the general list adds well-known rules the project lacks, the coverage map keeps you from proposing what is already enforced, and the mode decides what is built without asking.

## 0. Mode

Before the scan, ask one single-select `AskUserQuestion` (header `Mode`):
- **Automatic (Recommended)**: build every recommended candidate (step 5) without asking.
  Ask only at the critical points: a change to an agent doc or decision record, a contradiction between doc and code, and a `high` risk candidate.
- **Manual**: pick the rules yourself from one selection with the recommended ones marked.

Skip the question when the user already said which mode, or when a manager skill such as `codemyrules` asked it and hands the answer on.
When the user said to go ahead with your recommendations, that is automatic.
With nobody to answer and no such word, use manual and build nothing that needs a pick.

## 1. Map what is already enforced

List every place a convention is already checked.
Each one is evidence, and each one marks its convention as **covered**:
- ESLint: enabled rules and presets, `files` overrides, `no-restricted-*` selectors, inline local rules.
- Architecture checks: `.dependency-cruiser.*`, `eslint-plugin-boundaries`, `import/no-restricted-paths`, `ts-arch`, tests named `*arch*` / `*boundar*` / `*layer*`.
- CI gates: semgrep, CodeQL, secret scanners.

A rule written only in prose (an ADR, an agent doc) is not enforcement.
A type-aware rule (typescript-eslint `recommendedTypeChecked` rules and the like) is enforced only where the config gives it type information.

## 2. Scan for conventions

1. **Probe** every signal in [`pattern-catalog.md`](pattern-catalog.md) that fits the project's stack, with a count of the good form and the bad form.
   Keep both counts and one example file per side.
   For an AST signal, count with the project's ESLint and a `no-restricted-syntax` selector through `--rule` rather than `rg`, and read 2 hits to check the selector means what you think.
   A signal whose only proxy is a meaningless text count gets "not probed" and the reason.
2. **Find bypasses.**
   List the project's own wrappers (exported helpers in `lib/`, `utils/`, `shared/`, `services/`) and count the code that goes around them: `crypto.randomUUID()` beside a `newId()` helper, a raw `fetch` beside the shared client.
   A wrapper most code uses is a convention; each bypass is a violation.
3. **Read the decision records** for conventions they ask for.
4. **Read the agent docs** (the list in SKILL.md step 1), plus the docs they link to or import (`@file` lines, Markdown links to repo files), and the docs those link to in turn (an `index.md` that links one file per decision or trap), each file once, for rule-like lines: "always", "never", "must", "don't", "use X instead of Y", "X goes through Y".
   Keep each line's file and line number, so step 6 of SKILL.md can offer to clean it up once a rule enforces it.
   Mark each line **always loaded** (a root `CLAUDE.md`, `AGENTS.md` or `GEMINI.md`, the files those import with `@file`, `.github/copilot-instructions.md`) or **on demand** (linked files, folder-level `CLAUDE.md`, instructions with an `applyTo` glob).
   Always-loaded lines cost tokens in every session; on-demand lines mostly gain enforcement.
   A line that applies only to another part of the stack (backend lines in a frontend run) is out of scope.
   A line a lint rule can check is a candidate.
   A line about process, tone or tools ("run the tests before committing") is not.
5. **Count suppression comments per rule** (`eslint-disable`, `@ts-expect-error`, `@Suppress`, `# noqa`, `ast-grep-ignore`, `//nolint`). Three or more for one rule mean the config fights the code: a `contradicted` candidate with "relax the rule here" or "fix the code" as the options.

On a large repo, split the scan by top-level folder, with one subagent per folder when serial scanning is too slow.
Keep a **scan log** (signal, counts, verdict) so the user can tell a quiet codebase from a shallow scan.

Done when every catalog signal has a count or a stated reason it does not apply, and every rule-like agent-doc line is a candidate or has a reason it is not.

## 3. Check the general rules

Go through [`general-rules.md`](general-rules.md) family by family.
For each rule the project's tooling can run and the coverage map does not already have, count today's hits with the CLI override shown there, without changing the config.
Each one becomes a `general, not used` candidate, unless the project already has it in an optional config or switched off: then it is `built, not enabled` and goes with the project candidates with its hit count.
A rule that needs a plugin the project lacks goes into the report as an option, with its install command, and is not a candidate.

Done when every general rule is a candidate, already covered, or reported as needing a plugin.

## 4. Label each candidate

**Coverage:**
- `covered`: something in the map already enforces it.
  It appears only as a note.
- `built, not enabled`: a rule for it exists but only runs in an optional config or in some folders.
  The candidate is enabling it, with its current hit count, not a new rule.
  A rule from an installed plugin that no enabled preset turns on is `general, not used`, offered with its hit count.
- `switched off`: the config turns the rule off on purpose (`'off'` or `0`, often with a comment). Offer it after the other project candidates, with the reason if the config gives one, since someone decided against it.
- `documented, not enforced`: a decision record or an agent doc asks for it and nothing fails when it is broken.
- `implicit`: the code mostly follows it, with nothing written or enforced.
- `general, not used`: a rule from the general list that the project does not run.
- `contradicted`: the docs say X and the code mostly does Y, a cluster of suppression comments fights a rule,, or the docs ask for something a lint rule or its config forbids.
  Raise it as a question to the user and build neither side.

**Risk:**
- `low`: pure AST, no fix or a provably safe fix, and 90%+ of usages already follow it.
- `medium`: needs scope resolution, path or alias options, or `suggest` fixes, or has an 80-90% majority.
- `high`: needs type info or cross-file knowledge, would autofix code whose behavior could change, has under an 80% majority (a team decision, not a discovery), or flags more than 20 files.

A `documented, not enforced` candidate with a large legacy count is not `high` for its majority alone, because the team already decided: offer it for new code only: the suggestions layer (SKILL.md step 4), a baseline, or an architecture test on changed files.

For each candidate, also note: one sentence on why it matters in project terms, the evidence, the flagged-file count, the ADR or agent-doc lines if any, and whether a built-in rule expresses it (then the candidate gets that rule's config instead of a custom rule).

## 5. Select

Put every candidate into one list: project candidates, `built, not enabled`, `switched off` and general ones together, never split by family (no separate call for general, bug-prevention or style rules).
Order it by coverage (`documented, not enforced` and `built, not enabled` first), then always-loaded agent-doc lines before on-demand ones, then by risk, then by fewest flagged files; general and `switched off` candidates after the project ones.

**Recommended** is every candidate whose risk is below `high`, except `switched off` ones (someone decided against them) and general ones with no hits and no tool the project already runs for them.
`covered` candidates appear only as notes, and `contradicted` ones only as their question.

**Automatic mode:**
- Build every recommended candidate without asking, and name each in one line with its reason ("low risk, 1 file").
- Ask in one `AskUserQuestion` call, and only when there is something to ask: each contradiction as a single-select ("update the doc to match the code" or "enforce the doc"), and the `high` risk candidates as one multi-select ("These rules are high risk, which should I build?").
- Everything not recommended and not asked goes to the report as not built.

**Manual mode:**
- One `AskUserQuestion` call with every candidate, `multiSelect: true`, up to 4 options per question and 4 questions per call.
  Each option's label is the rule name, with `(Recommended)` at the end for a recommended one.
  Its description is the why-sentence plus the flagged files and the risk; a general rule also names its standard value.
  A built-in config candidate is labelled by the rule plus its purpose, such as `no-restricted-imports: toasts only via useToast`.
  Each question stands on its own ("Which of these rules should I build?").
- Contradictions are single-select questions in the same call, ahead of the rest.
- Past 16 options in one call, offer the recommended ones first and list the rest in the report.

Without the tool, list the candidates in chat, recommended ones marked, and ask for names.
In manual mode, build nothing until the user answers.

A picked general or `built, not enabled` rule is a config change: enable it in the ESLint config at the agreed value and severity, scoped by `files`, then verify it with the project's own ESLint run.

Done when every candidate is either built, offered and answered, handed a built-in config, or noted as covered or contradicted.
