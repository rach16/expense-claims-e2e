# 002 — No BDD/Cucumber layer

**Status:** accepted (P0)

## Context

Cucumber is common in QA-owned suites and frequently asked about in interviews.

## Decision

No Gherkin layer. Tests are plain Playwright/Vitest with descriptive names.

## Why

BDD earns its indirection when non-technical stakeholders genuinely read and
write scenarios. Nobody outside engineering reads this suite. Without that
audience, Gherkin adds a step-definition layer between the test name and the
code — extra parsing, extra regex glue, worse stack traces, and one more place
for a mismatch to hide.

Readability is achieved instead with descriptive test titles, `it.each` tables
for enumerable inputs, and builder functions (`aDraft({ title: '' })`) so each
test states only what it exercises.

## Costs accepted

- If a product owner ever wants to co-author scenarios, this decision must be
  revisited — the domain layer is pure enough to sit under Gherkin later.
- Interviewers who expect Cucumber will want this reasoning out loud.
