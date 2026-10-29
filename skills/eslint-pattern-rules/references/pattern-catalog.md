# Pattern catalog

Signals to probe while scanning, with what makes each detectable and the built-in rule to check first.
Treat them as a starting point, not a checklist: propose only what the project already mostly does, or what an ADR asks for.

Lintability:
- **AST**: one file's syntax is enough.
- **Scope**: needs `sourceCode.getScope` to resolve identifiers.
- **Types**: needs type-aware linting.
- **Cross-file**: needs knowledge of other files. Usually not a good fit for a lint rule, so suggest a script or architecture test instead.

## Security

Built-in rules usually ban a sink outright. A custom rule can allow "only through *our* safe helper".

| Pattern | Signal | Check first | Lintability |
|---|---|---|---|
| HTML only through the project's sanitizer | `innerHTML`/`outerHTML` assignment, `insertAdjacentHTML`, `document.write`, `v-html`, `dangerouslySetInnerHTML`, `{@html}`, where the value is not a call to the configured sanitizer | `vue/no-v-html`, `react/no-danger`, `svelte/no-at-html-tags` (these ban outright; a custom rule allows the helper) | AST |
| No dynamic code | `eval`, `new Function`, string first arg to `setTimeout`/`setInterval` | `no-eval`, `no-implied-eval`, `no-new-func` | AST |
| No secrets in source | string literals matching key or token shapes (`sk_live_`, `AKIA`, `ghp_`, JWT `eyJ...`), or assigned to names like `apiKey`, `secret`, `token` | none (also suggest a secret scanner in CI) | AST |
| Auth tokens never in web storage | `localStorage`/`sessionStorage.setItem` with a key or value named like a token | `no-restricted-properties` | AST/Scope |
| `postMessage` listeners check the origin | `addEventListener('message', fn)` where `fn` never reads `event.origin` | none | AST/Scope |
| URLs built through the project's helper, not string concat of input | template or concatenation passed to `fetch`, `axios`, `location.href`, `window.open` | none | AST |
| External links are safe | `target="_blank"` without `rel="noopener"` (when not handled by the framework) | `react/jsx-no-target-blank` | AST |
| No `javascript:` URLs | literal `javascript:` in `href`/`src` attributes or assignments | `no-script-url`, `vue/no-v-html`-style plugin rules | AST |

## Bug prevention

| Pattern | Signal | Check first | Lintability |
|---|---|---|---|
| Promises are awaited, returned, or marked `void` | call returning a promise used as a statement | `@typescript-eslint/no-floating-promises` | Types (an AST version can match the project's known async functions by name, via options) |
| One async style per function | `.then/.catch/.finally` together with `await` in the same function | none | AST |
| Pure modules take time and randomness as parameters | `Date.now()`, `new Date()`, `Math.random()`, `crypto.randomUUID()` outside parameter defaults in configured folders | `no-restricted-syntax` (misses destructured defaults and shadowed `Date`) | AST/Scope |
| IDs, keys and storage names come from the project's helpers | a direct `crypto.randomUUID()` or a string literal duplicating a helper's output (`'task:' + id`) | `no-restricted-syntax` | AST |
| Exhaustive switches on unions | `switch` over a union type without every case | `@typescript-eslint/switch-exhaustiveness-check` | Types |
| No mutation of props, state or function arguments | assignment to a member of a param, or of a prop in Vue/React | `no-param-reassign` with `props: true`, `vue/no-mutating-props` | AST |
| Async callbacks where they are ignored | `async` function passed to `forEach`, or as an event handler that should report failures | `@typescript-eslint/no-misused-promises` | Types/AST |
| Cleanup paired with setup | `setInterval`/`addEventListener` in a component setup with no matching clear/remove in its unmount/cleanup | `react-hooks/exhaustive-deps` (partial) | AST |

## Clean Code

| Pattern | Signal | Check first | Lintability |
|---|---|---|---|
| No boolean flag parameters | a param with a boolean default or `boolean` type, or a call with literal `true`/`false` args | none | AST/Types |
| Options object past N params | `params.length > N` | `max-params` | AST |
| No magic strings/numbers where a constant exists | a literal equal to the value of a known exported constant | `no-magic-numbers` | Scope/Cross-file (pass the constants via options) |
| Handler naming (`handleX` for definitions, `onX` for props) | function names assigned to event props/attributes | `react/jsx-handler-names` | AST |
| Composable/hook naming (`useX`) | exported function that calls other `use*` functions | `react-hooks/rules-of-hooks` (React) | AST |
| No empty or swallowing catch | `CatchClause` with an empty body or only `console.*` | `no-empty`, `no-useless-catch` | AST |
| Errors go through the shared helper | `catch` bodies that don't call the configured helper | none | AST |
| Early return instead of deep nesting | `if` wrapping the whole function body, `else` after `return` | `no-else-return`, `max-depth` | AST |
| No negated conditionals with an else | `if (!x) {} else {}` | `no-negated-condition` | AST |
| No commented-out code | comments that parse as code | none (custom, with `sourceCode.getAllComments()`) | AST |
| No barrel re-export cycles | cross-file | `import/no-cycle` | Cross-file |
| Consistent return shape (e.g. `Result` objects, never throw from services) | `ThrowStatement` in configured folders | `no-restricted-syntax` | AST |

## SOLID

### Single Responsibility

| Pattern | Signal | Check first | Lintability |
|---|---|---|---|
| Functions and components stay small | statement/line count per function, nesting depth | `max-lines-per-function`, `max-statements`, `max-depth`, `complexity` | AST |
| One main export per module (e.g. one component per file) | count of exported declarations in `Program:exit` | `import/max-dependencies`, `import/no-namespace` | AST |
| UI files don't do data fetching | `fetch`/`axios`/client calls inside component files | `no-restricted-syntax`, `no-restricted-imports` | AST/Scope |
| No mixed concerns in one function (DOM + fetch + state) | the same function calls APIs from several categories, configured by the user | none | Scope |

### Open/Closed

| Pattern | Signal | Check first | Lintability |
|---|---|---|---|
| Lookup map instead of a growing `switch`/`if` chain on a discriminator | `SwitchStatement` with many `case`s on a string, or `if/else if` chains comparing one identifier to literals | `no-restricted-syntax` with `SwitchStatement[cases.length>6]` covers the switch form. `if/else if` chains need a custom rule | AST |
| Extend through config or registration, not by editing a core module | hard to see in one file | none | Cross-file |

### Liskov Substitution

Mostly not lintable without types.
One exception: subclasses overriding a method to throw "not implemented" (`MethodDefinition` whose body is a single `throw`).
**AST**

### Interface Segregation

| Pattern | Signal | Check first | Lintability |
|---|---|---|---|
| Small props/params interfaces | `TSInterfaceDeclaration` / `TSTypeLiteral` member count, component props count | none | AST |
| Components receive what they use, not a whole store or object | a prop/param whose only use is `.x` reads of one or two fields | none | Scope/Types |

### Dependency Inversion

| Pattern | Signal | Check first | Lintability |
|---|---|---|---|
| Layer boundaries (UI → services → infra, never backwards) | import target path vs importing file path, layers configured via options | `no-restricted-imports` + per-folder `files`, `import/no-restricted-paths`, `boundaries/*` | AST |
| Depend on an abstraction or injected dependency instead of `new ConcreteClient()` inside business logic | `NewExpression` of configured classes outside configured composition roots | `no-restricted-syntax` | AST |
| No direct `localStorage`/`window`/`chrome.*`/`document` in domain code | `MemberExpression` on configured globals in configured folders | `no-restricted-globals`, `no-restricted-properties` | AST |
