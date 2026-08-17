# 001 — Playwright + TypeScript over Selenium + Java

**Status:** accepted (P0)

## Context

I have nine years of Selenium/Java. Playwright also ships Java bindings, so
staying in Java was a real option.

## Decision

Playwright with TypeScript.

## Why

The valuable part of Playwright is not the browser driving — it's
`@playwright/test`, the runner, which is TypeScript-only. Java bindings plus
JUnit would have cost the fixture graph, config-level retries with flaky
reporting, trace-on-first-retry, projects, sharding, and blob-report merging:
precisely the features this project exists to demonstrate.

Architecturally: Selenium drives browsers one-way over WebDriver HTTP and polls
for state; Playwright holds a persistent WebSocket and receives events, which is
why auto-waiting is intrinsic rather than bolted on with `WebDriverWait`. Each
release also ships pinned browser builds, eliminating the driver-version
mismatch class of flake.

## Costs accepted

- A real ramp-up in TypeScript idioms, paid mostly in the first two phases.
- Selenium keeps advantages this project forgoes: mature grid ecosystem, broad
  language support, and a larger hiring pool familiar with it.
