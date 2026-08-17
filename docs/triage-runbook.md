# Triage runbook

What to do when CI is red. Optimised for the 2am version of you: decide *what
kind* of failure it is first, then follow that branch.

## 0. Read the PR comment, not the logs

Every run posts a sticky comment and job summary: pass/fail/flaky counts, the
failing test names, and a link to the merged HTML report (traces attached).
Open raw logs only when the report doesn't explain it.

Live report for `main`: <https://rach16.github.io/expense-claims-e2e/>

## 1. Classify the failure

| Signal | Likely class | Go to |
|---|---|---|
| One test, fails consistently, related to the diff | real regression | §2 |
| Marked ⚠️ flaky (passed on retry) | flake | §3 |
| Whole shard/job red, many unrelated tests | infrastructure | §4 |
| `Contract drift gate` failed | spec drift | §5 |
| `Trivy` or `coverage floor` failed | policy gate | §6 |
| Green locally, red in CI only | environment | §7 |

## 2. Real regression

1. Open the trace from the report (`trace.zip` → drag into
   <https://trace.playwright.dev> or `npx playwright show-trace`). It has DOM
   snapshots per action, network, and console.
2. Reproduce locally: `npx playwright test -g "<test title>"`.
3. Fix the app, not the test — unless the assertion encoded a wrong
   expectation, in which case say so explicitly in the PR.

## 3. Flake

A retry-passer is reported, never silently green. The gate allows at most two
per run; above that it blocks.

1. Confirm it's flaky, not order-dependent: `npx playwright test -g "<title>" --repeat-each=10`.
   Then check order sensitivity: `--workers=1` vs default.
2. Diagnose by cause, in likelihood order:
   - **Racing the app's own async work** — a request in flight when the test
     navigates or asserts. Fix by making the app expose completion (a status
     element, a disabled state) and waiting on *that*. This exact bug shipped
     here once: a late refetch clobbered unsaved edits, and the "flaky" test
     was correctly reporting data loss.
   - **Non-web-first assertion** — `expect(await locator.textContent())` freezes
     a value instead of retrying. Use `expect(locator).toHaveText(...)`.
   - **Shared data** — a test asserting on rows another test can touch. Give it
     its own tenant/user (see `newIsolatedUser`).
   - **Strict-mode ambiguity** — the locator matched more than one element only
     under certain data. Scope it.
3. Never fix flake with `waitForTimeout`. If a sleep is the only thing that
   works, the app has no observable signal for the state you need — add one.

## 4. Infrastructure

Symptoms: every test in a job fails, or the job dies before tests run.

- Postgres service container not ready → check the `db` service health block and
  the migrate step.
- `npm ci` failure → lockfile/peer-dependency conflict; reproduce with
  `rm -rf node_modules && npm ci` locally.
- Browser install failure → transient; re-run the job.
- Both shards of one project red while the other project is green → suspect the
  app or the migration, not the tests.

## 5. Contract drift

`git diff --exit-code apps/api/openapi/openapi.json` failed: the code generates
a spec different from the committed one.

- **Intended API change?** Run `npm run openapi:generate --workspace @expense-claims/api`
  and commit the spec with the change. Review the diff — it *is* the API review.
- **Unintended?** Something altered a schema by accident. The diff names the
  route.

## 6. Policy gates

- **Coverage floor** — the domain layer dropped below 90%. Add the missing
  tests; don't lower the number. If the uncovered code isn't domain logic, it's
  in the wrong directory.
- **Trivy** — a *fixable* critical CVE. Bump the dependency, or remove the
  component if the runtime doesn't need it (that's how npm left the image).
  Unfixable base-image CVEs are ignored by policy; see ADR 006.

## 7. Green locally, red in CI

The usual differences, in the order worth checking:

1. **Retries** — CI retries twice, local runs zero. A CI-only pass on retry is
   flake that your machine hides.
2. **Machine speed** — CI runners are slower and noisier; races surface there
   first. Reproduce with `--repeat-each=10`, or throttle CPU.
3. **Fresh database** — CI starts empty every run; your local DB has history.
   Reproduce with `docker compose down -v && docker compose up -d db` then migrate.
4. **Server reuse** — locally Playwright reuses a running server, which may have
   been booted with different env (this is why the detection matrix forces fresh
   servers via `DETECTION_MATRIX=1`).
5. **Headless/viewport** — CI is always headless at a fixed viewport.

## Escalation

If `main` is red and the fix isn't obvious within ~15 minutes: revert the
offending commit, reopen it as a PR, and debug there. `main` staying green is
worth more than any individual change landing quickly.
