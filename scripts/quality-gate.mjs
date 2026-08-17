#!/usr/bin/env node
/**
 * Quality gate: the single required check.
 *
 * Reads the merged Playwright JSON report and decides pass/fail on policy, not
 * vibes. Also emits a markdown summary for the PR comment and the job summary.
 *
 *   node scripts/quality-gate.mjs merged-report.json
 *
 * Policy:
 *   - any test that failed after all retries          -> BLOCK
 *   - a test that only passed on retry (flaky)        -> report, block above threshold
 *   - suite duration regression                       -> report only
 */
import { readFileSync, writeFileSync } from 'node:fs'

const MAX_FLAKY = Number(process.env.MAX_FLAKY ?? 2)

const reportPath = process.argv[2] ?? 'merged-report.json'
const report = JSON.parse(readFileSync(reportPath, 'utf8'))

const specs = []
const walk = (suite, project) => {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      specs.push({
        title: spec.title,
        file: suite.file ?? spec.file ?? '',
        project: test.projectName ?? project ?? '',
        status: test.status, // expected | unexpected | flaky | skipped
        durationMs: (test.results ?? []).reduce((sum, r) => sum + (r.duration ?? 0), 0),
      })
    }
  }
  for (const child of suite.suites ?? []) walk(child, project)
}
for (const suite of report.suites ?? []) walk(suite)

const failed = specs.filter((s) => s.status === 'unexpected')
const flaky = specs.filter((s) => s.status === 'flaky')
const skipped = specs.filter((s) => s.status === 'skipped')
const passed = specs.filter((s) => s.status === 'expected')
const totalMs = specs.reduce((sum, s) => sum + s.durationMs, 0)
const slowest = [...specs].sort((a, b) => b.durationMs - a.durationMs).slice(0, 3)

const blocked = failed.length > 0 || flaky.length > MAX_FLAKY

const lines = [
  `### ${blocked ? '❌ Quality gate failed' : '✅ Quality gate passed'}`,
  '',
  `| | count |`,
  `|---|---|`,
  `| ✅ passed | ${passed.length} |`,
  `| ❌ failed | ${failed.length} |`,
  `| ⚠️ flaky (passed on retry) | ${flaky.length} / ${MAX_FLAKY} allowed |`,
  `| ⏭️ skipped | ${skipped.length} |`,
  `| ⏱️ total test time | ${(totalMs / 1000).toFixed(1)}s |`,
  '',
]

if (failed.length) {
  lines.push('**Failures**', '')
  for (const f of failed) lines.push(`- \`${f.project}\` ${f.title} — ${f.file}`)
  lines.push('')
}
if (flaky.length) {
  lines.push('**Flaky — passed only on retry, triage these before they rot the suite**', '')
  for (const f of flaky) lines.push(`- \`${f.project}\` ${f.title} — ${f.file}`)
  lines.push('')
}
lines.push(
  '<details><summary>Slowest tests</summary>',
  '',
  ...slowest.map((s) => `- ${(s.durationMs / 1000).toFixed(1)}s — ${s.title}`),
  '',
  '</details>',
)

const summary = lines.join('\n')
writeFileSync('quality-gate-summary.md', `${summary}\n`)
console.log(summary)

if (process.env.GITHUB_STEP_SUMMARY) {
  writeFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`, { flag: 'a' })
}

process.exit(blocked ? 1 : 0)
