#!/usr/bin/env node
/**
 * Seeded-bug detection matrix.
 *
 * For each flag: boot the stack with that bug enabled, run the layers that
 * should notice, and assert the EXPECTED tests fail — and only those. A suite
 * nobody has watched fail is a suite nobody should trust.
 *
 *   node scripts/detection-matrix.mjs              # all flags
 *   node scripts/detection-matrix.mjs STATE_SKIP   # one flag
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'

const MATRIX = [
  {
    flag: 'MONEY_ROUNDING',
    where: 'api',
    layers: ['unit'],
    expect: ['sums integer cents exactly'],
  },
  {
    // NOTE: detected by the unit layer only, and that is the correct outcome.
    // The decision endpoint ALSO guards with an atomic WHERE status='submitted',
    // so the illegal draft→approved transition is still refused at the database
    // even with the state table corrupted. Defense in depth: two independent
    // controls, and the matrix documents which one each layer observes.
    flag: 'STATE_SKIP',
    where: 'api',
    layers: ['unit'],
    expect: ['forbids draft → approved', 'throws for draft → approved'],
  },
  {
    flag: 'IDOR_CLAIM_READ',
    where: 'api',
    layers: ['api'],
    expect: [
      'IDOR: a user from another tenant gets 404, not 403',
      'a submitter cannot read a colleague’s claim',
    ],
  },
  {
    // a wrong OFFSET corrupts every listing view, not just the paging test
    flag: 'PAGINATION_OFF_BY_ONE',
    where: 'api',
    layers: ['api'],
    expect: [
      'pages are exact, disjoint, and complete',
      'status filter returns only matching claims',
      'a submitter sees only their own claims in the list',
    ],
  },
  {
    flag: 'RACE_DOUBLE_APPROVE',
    where: 'api',
    layers: ['api'],
    expect: ['concurrent decisions: exactly one wins (RACE_DOUBLE_APPROVE trap)'],
  },
  {
    flag: 'UI_STALE_TOTAL',
    where: 'web',
    layers: ['e2e'],
    expect: ['editing a draft recomputes the total after removing an item'],
  },
  {
    // found by exploratory testing, not by the suite — this row exists so the
    // gap cannot reopen silently
    // the flag disables the whole 401-handling path, so both halves of the
    // session-expiry contract fail: silent recovery AND the fallback redirect
    flag: 'NO_TOKEN_REFRESH',
    where: 'web',
    layers: ['e2e'],
    expect: [
      'recovers silently when the access token has expired',
      'redirects to login, preserving the destination, when refresh also fails',
    ],
  },
  {
    // the axe test names it explicitly; the functional tests fall over too,
    // because role/label-first locators can't find an unlabelled control —
    // accessibility regressions are functional regressions in this suite
    flag: 'A11Y_MISSING_LABEL',
    where: 'web',
    layers: ['e2e'],
    expect: [
      'claim editor',
      'creates a draft with a computed total',
      'surfaces every validation error at once',
      'rejects malformed amounts before hitting the API',
      'editing a draft recomputes the total after removing an item',
      'submits a draft for approval',
      'approver approves a submitted claim',
      'rejection reason round-trips to the submitter',
      'recovers silently when the access token has expired',
    ],
  },
]

const REPORT = 'detection-report.json'

function runLayer(layer, flag, where) {
  const env = {
    ...process.env,
    ...(where === 'api' ? { BUGS: flag } : { VITE_BUGS: flag }),
    // forces fresh servers so the flag actually reaches the app under test
    DETECTION_MATRIX: '1',
    PLAYWRIGHT_JSON_OUTPUT_NAME: REPORT,
  }
  rmSync(REPORT, { force: true })

  try {
    if (layer === 'unit') {
      execFileSync('npx', ['vitest', 'run', '--reporter=json', `--outputFile=${REPORT}`], {
        env,
        stdio: 'pipe',
      })
    } else {
      const project = layer === 'api' ? 'api' : 'chromium'
      execFileSync('npx', ['playwright', 'test', `--project=${project}`, '--reporter=json'], {
        env,
        stdio: 'pipe',
      })
    }
  } catch {
    // non-zero exit is the expected outcome — the report holds the detail
  }

  const report = JSON.parse(readFileSync(REPORT, 'utf8'))
  return layer === 'unit' ? failedUnitTests(report) : failedPlaywrightTests(report)
}

function failedUnitTests(report) {
  return (report.testResults ?? [])
    .flatMap((file) => file.assertionResults ?? [])
    .filter((t) => t.status === 'failed')
    .map((t) => t.title)
}

function failedPlaywrightTests(report) {
  const failures = []
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      if (!spec.ok) failures.push(spec.title)
    }
    for (const child of suite.suites ?? []) walk(child)
  }
  for (const suite of report.suites ?? []) walk(suite)
  return failures
}

const requested = process.argv.slice(2)
const cases = requested.length ? MATRIX.filter((c) => requested.includes(c.flag)) : MATRIX

let allPassed = true
const rows = []

for (const testCase of cases) {
  const failed = testCase.layers.flatMap((layer) => runLayer(layer, testCase.flag, testCase.where))
  const missed = testCase.expect.filter((name) => !failed.some((f) => f.includes(name)))
  const unexpected = failed.filter((name) => !testCase.expect.some((e) => name.includes(e)))
  const ok = missed.length === 0 && unexpected.length === 0
  if (!ok) allPassed = false

  rows.push({ flag: testCase.flag, detected: failed.length, ok, missed, unexpected })
  console.log(
    `${ok ? '✓' : '✗'} ${testCase.flag.padEnd(22)} ${failed.length} test(s) failed` +
      (missed.length ? `\n    MISSED: ${missed.join(', ')}` : '') +
      (unexpected.length ? `\n    UNEXPECTED: ${unexpected.join(', ')}` : ''),
  )
}

rmSync(REPORT, { force: true })

console.log(
  `\n${rows.filter((r) => r.ok).length}/${rows.length} seeded bugs detected by exactly the expected tests`,
)
process.exit(allPassed ? 0 : 1)
