#!/usr/bin/env node
// Run one JS-plugin rule over a codebase with the project's own oxlint, without touching its config:
// a scratch config outside the project turns every native rule off and enables only that rule.
// Usage (from the project root):
//   node try-oxlint.mjs <plugin-file> <rule-id> [paths...] [--options '<json array>']
// The oxlint binary is $OXLINT_BIN, else node_modules/.bin/oxlint.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const oi = args.indexOf('--options');
const options = oi < 0 ? [] : JSON.parse(args.splice(oi, 2)[1] ?? '[]');
const [pluginFile, ruleId, ...paths] = args;
if (!pluginFile || !ruleId || !Array.isArray(options)) {
  console.error("usage: node try-oxlint.mjs <plugin-file> <rule-id> [paths...] [--options '<json array>']");
  process.exit(2);
}

const bin = process.env.OXLINT_BIN || path.resolve('node_modules/.bin/oxlint');
if (!fs.existsSync(bin)) {
  console.error(`try-oxlint: no oxlint at ${bin}; install the project's dependencies or set OXLINT_BIN`);
  process.exit(1);
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'try-oxlint-'));
const config = path.join(tmp, 'oxlintrc.json');
fs.writeFileSync(config, JSON.stringify({
  categories: { correctness: 'off' },
  jsPlugins: [path.resolve(pluginFile)],
  rules: { [ruleId]: ['error', ...options] },
}));
const r = spawnSync(bin, ['-c', config, '--format', 'json', ...(paths.length ? paths : ['.'])], { encoding: 'utf8', maxBuffer: 1 << 28 });
fs.rmSync(tmp, { recursive: true, force: true });

let diagnostics;
try { ({ diagnostics } = JSON.parse(r.stdout)); } catch {
  console.error(`try-oxlint: oxlint failed (exit ${r.status ?? r.error?.message}):\n${`${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n').slice(-20).join('\n')}`);
  process.exit(1);
}
// oxlint prints rule ids as plugin(rule)
const hits = diagnostics.filter((d) => String(d.code).replace(/^(.+?)\((.+)\)$/, '$1/$2') === ruleId);
console.log(`${ruleId}: ${hits.length} hit(s) in ${new Set(hits.map((h) => h.filename)).size} file(s)`);
for (const h of hits) console.log(`  ${h.filename}:${h.labels?.[0]?.span?.line ?? 0}  ${h.message}`);
const other = diagnostics.length - hits.length;
if (other) console.log(`${other} other diagnostic(s), such as parse errors:\n${diagnostics.filter((d) => !hits.includes(d)).slice(0, 5).map((d) => `  ${d.filename}: ${d.message}`).join('\n')}`);
