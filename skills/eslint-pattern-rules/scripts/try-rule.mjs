#!/usr/bin/env node
// Run one custom rule over a codebase using the project's own ESLint, without touching its config.
// Usage (from the project root):
//   node try-rule.mjs <rule-file> [paths...] [--options '<json array>'] [--parser <module>] [--fix-dry-run]
// Prints every report from the rule plus parse errors, so false positives are easy to spot.
import fs from 'node:fs'
import {createRequire, stripTypeScriptTypes} from 'node:module'
import path from 'node:path'
import {pathToFileURL} from 'node:url'

const args = process.argv.slice(2)
function takeFlag(name, hasValue) {
  const i = args.indexOf(name)
  if (i === -1) return undefined
  const [, value] = args.splice(i, hasValue ? 2 : 1)
  return hasValue ? value : true
}
const options = JSON.parse(takeFlag('--options', true) ?? '[]')
const parserName = takeFlag('--parser', true)
const fixDryRun = Boolean(takeFlag('--fix-dry-run', false))
const [ruleFile, ...paths] = args
if (!ruleFile || !Array.isArray(options)) {
  console.error("Usage: node try-rule.mjs <rule-file> [paths...] [--options '<json array>'] [--parser <module>] [--fix-dry-run]")
  process.exit(2)
}

const cwd = process.cwd()
const projectRequire = createRequire(path.join(cwd, 'package.json'))
const importFromProject = async (id) => import(pathToFileURL(projectRequire.resolve(id)).href)
const tryResolve = (id) => {
  try {
    return projectRequire.resolve(id)
  } catch {
    return null
  }
}

const {ESLint} = await importFromProject('eslint')
const ruleModule = await import(pathToFileURL(path.resolve(ruleFile)).href)
const rule = ruleModule.default ?? ruleModule
const ruleId = 'local/' + path.basename(ruleFile).replace(/\.[cm]?[jt]s$/, '')
const plugin = {rules: {[ruleId.slice('local/'.length)]: rule}}
const flat = Number(ESLint.version.split('.')[0]) >= 9 // v8.57's opt-in flat mode is treated as legacy

// TS parser: an explicit --parser wins, otherwise typescript-eslint or @typescript-eslint/parser if installed.
const tsParserId = parserName ?? ['@typescript-eslint/parser'].find(tryResolve) ?? (tryResolve('typescript-eslint') && 'typescript-eslint')
const vueParserId = tryResolve('vue-eslint-parser') && 'vue-eslint-parser'
const extensions = ['.js', '.jsx', '.mjs', '.cjs', ...(tsParserId ? ['.ts', '.tsx', '.mts', '.cts'] : []), ...(vueParserId ? ['.vue'] : [])]
const ignores = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**', '**/.output/**', '**/.wxt/**', '**/.next/**', '**/.nuxt/**']

async function makeEslint(fix) {
  if (flat) {
    const loadParser = async (id) => {
      const mod = await importFromProject(id)
      return mod.parser ?? mod.default?.parser ?? mod.default ?? mod
    }
    const tsParser = tsParserId && (await loadParser(tsParserId))
    const base = {ecmaVersion: 'latest', sourceType: 'module', parserOptions: {ecmaFeatures: {jsx: true}}}
    const config = [
      {ignores},
      {files: extensions.map((ext) => `**/*${ext}`), plugins: {local: plugin}, rules: {[ruleId]: ['error', ...options]}, languageOptions: base},
    ]
    if (tsParser) config.push({files: ['**/*.{ts,tsx,mts,cts}'], languageOptions: {...base, parser: tsParser}})
    if (vueParserId) {
      const vueParser = await loadParser(vueParserId)
      config.push({files: ['**/*.vue'], languageOptions: {...base, parser: vueParser, parserOptions: {...base.parserOptions, parser: tsParser || undefined}}})
    }
    return new ESLint({cwd, overrideConfigFile: true, overrideConfig: config, errorOnUnmatchedPattern: false, fix})
  }
  const parserOptions = {ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: {jsx: true}}
  const overrides = []
  if (tsParserId) overrides.push({files: ['*.ts', '*.tsx', '*.mts', '*.cts'], parser: projectRequire.resolve(tsParserId === 'typescript-eslint' ? '@typescript-eslint/parser' : tsParserId)})
  if (vueParserId) overrides.push({files: ['*.vue'], parser: projectRequire.resolve(vueParserId), parserOptions: {...parserOptions, parser: tsParserId ? projectRequire.resolve('@typescript-eslint/parser') : undefined}})
  return new ESLint({
    cwd,
    useEslintrc: false,
    plugins: {local: plugin},
    extensions,
    errorOnUnmatchedPattern: false,
    fix,
    overrideConfig: {plugins: ['local'], rules: {[ruleId]: ['error', ...options]}, parserOptions, ignorePatterns: ignores, overrides},
  })
}

const targets = paths.length ? paths : ['.']
const eslint = await makeEslint(false)
const results = await eslint.lintFiles(targets)

// Fallback for projects without a TS or Vue parser: strip types with Node's built-in stripper and blank out
// everything outside <script> in .vue files. Both keep line and column positions, so hits point at the real source.
const stripTs = !tsParserId && stripTypeScriptTypes
const fallbackExts = [...(stripTs ? ['.ts', '.mts', '.cts'] : []), ...(!vueParserId ? ['.vue'] : [])]
const fallbackErrors = []
if (fallbackExts.length) {
  const skipDir = /(^|[\\/])(node_modules|dist|build|coverage|\.output|\.wxt|\.next|\.nuxt|\.git)([\\/]|$)/
  const files = targets.flatMap((t) => {
    const abs = path.resolve(t)
    if (!fs.statSync(abs, {throwIfNoEntry: false})?.isDirectory()) return [abs]
    return fs.readdirSync(abs, {recursive: true}).map((f) => path.join(abs, f)).filter((f) => !skipDir.test(path.relative(cwd, f)))
  }).filter((f) => fallbackExts.includes(path.extname(f)))
  for (const file of files) {
    let code = fs.readFileSync(file, 'utf8')
    let isTs = path.extname(file) !== '.vue'
    if (path.extname(file) === '.vue') {
      const blocks = [...code.matchAll(/(<script\b[^>]*>)([\s\S]*?)<\/script>/g)]
      isTs = blocks.some((m) => /lang=["']ts["']/.test(m[1]))
      let masked = code.replace(/[^\n]/g, ' ')
      for (const m of blocks) {
        const start = m.index + m[1].length
        masked = masked.slice(0, start) + m[2] + masked.slice(start + m[2].length)
      }
      code = masked
    }
    try {
      if (isTs) {
        if (!stripTypeScriptTypes) throw new Error('TS in .vue needs Node 22.13+ type stripping or a TS parser')
        code = stripTypeScriptTypes(code, {mode: 'strip'})
      }
    } catch (error) {
      fallbackErrors.push(`${path.relative(cwd, file)}: ${error.message.split('\n')[0]}`)
      continue
    }
    const [result] = await eslint.lintText(code, {filePath: file + '.mjs'})
    if (result) results.push({...result, filePath: file})
  }
}
let hits = 0
const filesWithHits = new Set()
const parseErrors = []
for (const result of results) {
  const file = path.relative(cwd, result.filePath)
  for (const msg of result.messages) {
    if (msg.fatal) parseErrors.push(`${file}:${msg.line ?? 0}: ${msg.message}`)
    else if (msg.ruleId === ruleId) {
      hits++
      filesWithHits.add(file)
      console.log(`${file}:${msg.line}:${msg.column}  ${msg.message}${msg.fix ? '  [fixable]' : ''}${msg.suggestions?.length ? '  [suggestion]' : ''}`)
    }
  }
}
if (fixDryRun) {
  // Second pass with fixes applied in memory only (outputFixes is never called, so no file is written).
  for (const result of await (await makeEslint(true)).lintFiles(targets)) {
    if (result.output) console.log(`\n--- fixed output (not written): ${path.relative(cwd, result.filePath)} ---\n${result.output}\n--- end ---`)
  }
}
console.log(`\n${hits} report(s) in ${filesWithHits.size} file(s), ${results.length} file(s) linted.`)
const tsNote = tsParserId ? `ts via ${tsParserId}` : stripTs ? 'ts via Node type stripping (no TS parser; .tsx skipped)' : 'no TS parser (TS files skipped)'
const vueNote = vueParserId ? 'vue via vue-eslint-parser' : 'vue <script> only (no vue-eslint-parser; templates not checked)'
console.log(`Parsers: js, ${tsNote}, ${vueNote}.`)
if (fixDryRun && (stripTs || !vueParserId)) console.log('Fix dry-run covers parser-backed files only.')
if (fallbackErrors.length) console.log(`\n${fallbackErrors.length} file(s) the fallback could not strip (e.g. enums), rule did not run on these:\n${fallbackErrors.join('\n')}`)
if (parseErrors.length) console.log(`\n${parseErrors.length} parse error(s), rule did not run on these:\n${parseErrors.join('\n')}`)
