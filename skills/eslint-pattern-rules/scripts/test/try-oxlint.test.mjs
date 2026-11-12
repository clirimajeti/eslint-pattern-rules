import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SCRIPT = path.join(import.meta.dirname, '..', 'try-oxlint.mjs');
const which = (bin) => spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin], { encoding: 'utf8' }).stdout.trim().split('\n')[0];
const OXLINT = process.env.OXLINT_BIN || which('oxlint');

const RULE = `export default {
  meta: { type: 'problem', schema: [], messages: { noLog: 'No console.log.' } },
  create(context) {
    return { 'CallExpression[callee.object.name="console"][callee.property.name="log"]'(node) { context.report({ node, messageId: 'noLog' }); } };
  },
};
`;

test('try-oxlint runs only the named rule and prints its hits', { skip: !OXLINT && 'needs oxlint: set OXLINT_BIN or put oxlint on PATH' }, (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'try-oxlint-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'oxlint-rules'));
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  fs.writeFileSync(path.join(dir, 'oxlint-rules/gen-no-log.js'), RULE);
  fs.writeFileSync(path.join(dir, 'oxlint-rules/index.js'), "import r from './gen-no-log.js';\nexport default { meta: { name: 'local' }, rules: { 'gen-no-log': r } };\n");
  // debugger is a native correctness finding: it must not show up
  fs.writeFileSync(path.join(dir, 'src/a.ts'), 'console.log(1);\ndebugger;\nconsole.log(2);\n');
  fs.writeFileSync(path.join(dir, 'src/b.ts'), 'export const b = 1;\n');
  const r = spawnSync('node', [SCRIPT, 'oxlint-rules/index.js', 'local/gen-no-log', 'src'], { cwd: dir, encoding: 'utf8', env: { ...process.env, OXLINT_BIN: OXLINT } });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /local\/gen-no-log: 2 hit\(s\) in 1 file\(s\)/);
  assert.match(r.stdout, /src\/a\.ts:1  No console\.log\./);
  assert.match(r.stdout, /src\/a\.ts:3 /);
  assert.doesNotMatch(r.stdout, /debugger/);
});

test('try-oxlint without a rule id explains its usage', () => {
  const r = spawnSync('node', [SCRIPT, 'oxlint-rules/index.js'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /usage: node try-oxlint\.mjs <plugin-file> <rule-id>/);
});
