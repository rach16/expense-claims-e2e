# 006 — Gates block only on actionable findings

**Status:** accepted (P2.5, P6, P8)

## Context

Three gates could each be configured to fail on everything they detect: the
image scanner, the accessibility check, and the quality gate.

## Decision

Each blocks on findings the author can act on, and reports the rest:

| Gate | Blocks | Reports only |
|---|---|---|
| Trivy | fixable CRITICAL CVEs (`--ignore-unfixed`) | unfixable base-image CVEs |
| axe | serious + critical violations | moderate/minor advisories |
| quality gate | any real failure, >2 flaky tests | duration trend, slowest tests |
| npm audit (nightly) | nothing | all findings, as warnings |

## Why

A gate that fails on findings nobody can fix teaches the team to route around
it — and a routinely-bypassed gate is worse than none, because it still looks
like protection. The first Trivy run made this concrete: it failed on a critical
CVE in npm's bundled tar inside the Node base image. The right response was
removing npm from the runtime stage (the app never runs it), not pinning a
version or lowering the severity threshold.

The coverage floor learned the same lesson from the other direction: a 90%
global floor blocked HTTP bootstrap code that the unit layer doesn't own. Fix
was to scope the floor to `src/domain`, the code that layer is responsible for.
Gates should measure the layer they gate.

## Costs accepted

- Unfixable criticals could hide a genuine risk; nightly audit output and image
  rebuilds are the mitigation, and `--ignore-unfixed` is revisited whenever the
  base image is bumped.
- A flaky-test allowance above zero is a deliberate tolerance; the count is
  surfaced in every PR comment so it can't drift silently upward.
