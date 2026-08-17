# 005 — Seeded bugs + detection matrix over mutation testing

**Status:** accepted (P7)

## Context

Coverage says which lines executed, not whether defects would be caught. The
standard answer is mutation testing (Stryker); the alternative is deliberately
planted, toggleable defects.

## Decision

Seven seeded bugs behind `BUGS=` / `VITE_BUGS=` flags, plus
`scripts/detection-matrix.mjs`, which boots the stack once per flag and asserts
that the expected tests fail — and only those.

## Why

- The bugs are **realistic** rather than syntactic: float money math, a widened
  state table, a dropped tenant check, an off-by-one OFFSET, a removed atomic
  guard, a stale UI total, a missing form label. Mutation operators produce
  mutants that are often unreachable or semantically irrelevant.
- The matrix asserts **which layer** catches each defect, which is what keeps
  the layering rule honest: five of seven are caught without a browser.
- It runs across the full stack (HTTP, DB, browser); mutation testing is
  practical mainly for pure units and is slow over a whole suite.

It caught two real problems immediately: a concurrency test that wasn't actually
concurrent, and an app bug where a late fetch could clobber unsaved edits.

## Costs accepted

- Coverage is limited to the defects imagined; mutation testing is exhaustive
  within its scope. These are complements — the domain layer is a fine future
  home for Stryker.
- Bug branches live in production code paths. Mitigated by keeping the registry
  tiny, explicit, and flag-gated off by default.
