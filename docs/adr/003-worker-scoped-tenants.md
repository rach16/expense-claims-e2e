# 003 — Worker-scoped tenants for parallel isolation

**Status:** accepted (P3)

## Context

Tests must run fully parallel without seeing each other's data. Four options
were on the table: truncate between tests, transactional rollback, a schema per
worker, or tenant-scoped data.

## Decision

Every Playwright worker registers its own tenant (plus a second one for
cross-tenant tests) through the real API. All rows are tenant-scoped.

## Why

- **Truncation** serialises the suite — it's mutually exclusive with parallelism.
- **Transaction rollback** can't work across an HTTP boundary; the server owns
  the connection, not the test.
- **Schema-per-worker** works, but requires migration plumbing per worker and is
  invisible to the product — it tests the harness, not the app.
- **Tenant scoping** is the isolation the product already needs for real
  customers, so the tests exercise it continuously. Isolation becomes a property
  of the data model rather than of test ordering.

Cleanup is unnecessary in CI (the database dies with the run) and available
locally via a reset script.

## Costs accepted

- Requires the app to have a tenant concept; a single-tenant product would need
  schema-per-worker instead.
- Tests within a worker share a tenant, so each test must still create the data
  it asserts on — enforced by convention and by the pagination tests, which mint
  their own isolated user when they need to count everything they can see.
