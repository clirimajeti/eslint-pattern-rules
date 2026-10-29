# Discovery

The candidate branch of [`eslint-pattern-rules`](../SKILL.md): the user asked which conventions could become rules. Work the four steps in order. The scan finds conventions, the coverage map keeps you from proposing what the repo already enforces, and the config decides what is built without asking.

## 1. Map what is already enforced

List every place a convention is already checked. Each one is evidence, and each one marks its convention as **covered**:
- ESLint: enabled rules and presets, `files` overrides, `no-restricted-*` selectors, inline local rules.
- Architecture checks: `.dependency-cruiser.*`, `eslint-plugin-boundaries`, `import/no-restricted-paths`, `ts-arch`, tests named `*arch*` / `*boundar*` / `*layer*`.
- CI gates: semgrep, CodeQL, secret scanners.

## 2. Scan for conventions

1. **Probe** every signal in [`pattern-catalog.md`](pattern-catalog.md) with a count of the good form and the bad form. Keep both counts and one example file per side.
2. **Find bypasses.** List the project's own wrappers (exported helpers in `lib/`, `utils/`, `shared/`, `services/`) and count the code that goes around them: `crypto.randomUUID()` beside a `newId()` helper, a raw `fetch` beside the shared client. A wrapper most code uses is a convention; each bypass is a violation.
3. **Read the decision records** for conventions they ask for.

On a large repo, split the scan by top-level folder, with one subagent per folder when serial scanning is too slow. Keep a **scan log** (signal, counts, verdict) so the user can tell a quiet codebase from a shallow scan.

Done when every catalog signal has a count or a stated reason it does not apply.

## 3. Label each candidate

**Coverage:**
- `covered`: something in the map already enforces it. It appears only as a note.
- `documented, not enforced`: a decision record asks for it and nothing fails when it is broken.
- `implicit`: the code mostly follows it, with nothing written or enforced.
- `contradicted`: the docs say X and the code mostly does Y. Raise it as a question to the user and build neither side.

**Risk:**
- `low`: pure AST, no fix or a provably safe fix, and 90%+ of usages already follow it.
- `medium`: needs scope resolution, path or alias options, or `suggest` fixes, or has an 80-90% majority.
- `high`: needs type info or cross-file knowledge, would autofix code whose behavior could change, has under an 80% majority (a team decision, not a discovery), or flags many files.

For each candidate, also note: one sentence on why it matters in project terms, the evidence, the flagged-file count, the ADR path if any, and whether a built-in rule expresses it (then the candidate gets that rule's exact config instead of a custom rule).

## 4. Select

Read `config.json` beside `SKILL.md`. A `.eslint-pattern-rules.json` at the project root overrides its keys.

```json
{ "mode": "ask", "auto": { "maxRisk": "low", "maxFlaggedFiles": 3, "adrBacked": "auto" } }
```

- `mode`: `"ask"` puts every candidate to the user. `"auto"` builds candidates within the `auto` limits without asking.
- `auto.maxRisk`: the highest risk built without asking, `"low"` or `"medium"`. A `high` candidate always goes to the user.
- `auto.maxFlaggedFiles`: the most files a rule may report on day one and still be built without asking.
- `auto.adrBacked`: with `"auto"`, a `documented, not enforced` candidate whose risk is below `high` is built without asking, in either mode. With `"ask"`, it goes to the user like the rest.

Split the candidates:
- **Automatic**: those the config allows. Name them to the user in one line, with the reason ("auto: low risk, 1 file").
- **Offered**: the remaining custom-rule candidates. Present them with `AskUserQuestion`, `multiSelect: true`, up to 4 options per question and 4 questions per call. Each option's label is the rule name. Its description is the why-sentence plus the flagged files and the risk. Each question stands on its own ("Which of these rules should I generate?").
- Without the tool, list the candidates in chat and ask for names. With nobody to answer, build the automatic set, or the single strongest candidate when that set is empty.

Done when every candidate is either built, offered and answered, handed a built-in config, or noted as covered or contradicted.
