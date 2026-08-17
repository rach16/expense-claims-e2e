# expense-claims-e2e

> A reference-quality test automation project — Playwright + TypeScript against a
> purpose-built expense-claims app, with seeded bugs that prove the suite earns its keep.

[![ci](https://github.com/rach16/expense-claims-e2e/actions/workflows/e2e-ci.yml/badge.svg)](https://github.com/rach16/expense-claims-e2e/actions/workflows/e2e-ci.yml)
[![nightly](https://github.com/rach16/expense-claims-e2e/actions/workflows/nightly.yml/badge.svg)](https://github.com/rach16/expense-claims-e2e/actions/workflows/nightly.yml)
[![detection matrix](https://github.com/rach16/expense-claims-e2e/actions/workflows/detection-matrix.yml/badge.svg)](https://github.com/rach16/expense-claims-e2e/actions/workflows/detection-matrix.yml)
![node](https://img.shields.io/badge/node-%E2%89%A522-339933?logo=node.js&logoColor=white)
![playwright](https://img.shields.io/badge/playwright-1.62-2EAD33?logo=playwright&logoColor=white)
![typescript](https://img.shields.io/badge/typescript-strict-3178C6?logo=typescript&logoColor=white)
![license](https://img.shields.io/badge/license-MIT-blue)

📊 **[Latest test report](https://rach16.github.io/expense-claims-e2e/)** — merged from every CI shard, published on each push to `main`.

**Status: 🚧 under construction — phases 0–9 complete.** What exists today: a
test-first domain core, an auth'd API (argon2id, rotating refresh tokens), a React
UI with a spec-generated typed client, ~110 tests across unit, API, E2E, and a11y
layers — worker-isolated, running against the containerized app, gated in CI by
coverage floor, contract drift, and Trivy image scanning — and seven seeded bugs
with a detection matrix proving the suite catches every one. CI hardening is done — sharded jobs, a merged report on Pages,
and a quality gate that blocks on failures and excess flake. The ephemeral-AWS
tier is still to come — see the roadmap.

---

## The idea

Most automation portfolios point tests at a demo site they don't control. This project
inverts that: it ships a **small app built to be tested** — controllable data,
injectable clock, deterministic auth — and a test suite that demonstrates the
decisions that actually matter in production automation:

- **Layered testing** — every scenario lives at the *fastest* layer that can observe
  its failure. No E2E test for anything an API test can see.
- **Seeded, feature-flagged bugs** — `BUGS=IDOR_CLAIM_READ npm test` and watch exactly
  the right tests fail. The detection matrix runs all seven and asserts each is caught
  by the expected tests, and only those: **7/7**.
- **Parallel-safe isolation** — worker-scoped tenants, no shared golden data, no
  truncation between tests.
- **Flake as a first-class concern** — retries are instrumentation, not paint;
  explicit waits are lint errors.
- **Zero long-lived secrets** — CI generates its own credentials per run; cloud auth
  is OIDC-federated. Fork it and it's green.
- **Ephemeral cloud environments** — Terraform spins up a real AWS environment per
  smoke run and destroys it after. Total project cloud spend: under $1.

## Architecture

![System overview: three test layers calling the API and UI, the generated OpenAPI spec closing the contract loop, and seven seeded bugs mapped to the layer that catches each](docs/diagrams/system-overview.svg)

Tests never import app internals — they hit the app over HTTP like a real client.
The apps are npm workspaces; the test layers are outside consumers.

**→ [The visual guide](docs/visual-guide.md)** walks the whole project in four
diagrams: system, parallel isolation, auth, and the CI pipeline.

## Test strategy

| Layer | Runner | Owns | Budget |
|---|---|---|---|
| Unit | Vitest | Money math, state machine, validators | < 2s |
| API | Playwright `request` | CRUD, authz matrix, pagination, concurrency | ~60s |
| Contract | OpenAPI + oasdiff | Breaking-change detection, spec drift | ~15s |
| E2E | Playwright | 12–15 user journeys, nothing an API test can see | ~90s sharded |
| a11y | axe-core | Zero serious/critical per screen | ~10s |
| Smoke (deployed) | Playwright | Real infra, real TLS, ephemeral AWS env | ~3m |

## Getting started

```bash
nvm use                        # Node 22+
npm ci                         # exact lockfile install
npx playwright install chromium
docker compose up -d db        # Postgres 16
npm run db:migrate --workspace @expense-claims/api
npm test                       # typecheck → unit → api → e2e, cheapest first
```

Other entry points:

```bash
npm run test:matrix            # prove the suite catches all 7 seeded bugs
docker compose --profile app up   # run the API from its production image
BUGS=IDOR_CLAIM_READ npm run test:api   # watch the authz tests catch a planted bug
```

## Reviewer's guide

Short on time? These five files carry the argument:

| Look at | Why it matters |
|---|---|
| [`tests/api/fixtures.ts`](tests/api/fixtures.ts) | Worker-scoped tenants + per-role contexts — how the suite runs fully parallel without shared state |
| [`scripts/detection-matrix.mjs`](scripts/detection-matrix.mjs) | Proof the tests catch real defects, per layer, with expectations that can't silently change |
| [`tests/e2e/setup.ts`](tests/e2e/setup.ts) | Auth minted once per role via API, reused as `storageState`; one test drives the real login form |
| [`apps/api/src/routes/claims.ts`](apps/api/src/routes/claims.ts) | Schema-per-route (validation + types + OpenAPI), tenant scoping as 404, atomic conditional updates for concurrency |
| [`.github/workflows/e2e-ci.yml`](.github/workflows/e2e-ci.yml) | Cheap-first fan-out, sharding, blob merge, published report, one required gate |

Then: [visual guide](docs/visual-guide.md) · [architecture](docs/architecture.md) ·
[ADRs](docs/adr/) · [seeded bugs](docs/seeded-bugs.md) ·
[triage runbook](docs/triage-runbook.md)

## Roadmap

- [x] **P0** — Repo skeleton: strict TS, Vitest, Playwright, CI pipeline
- [x] **P1** — Domain core: money, claim state machine, validators — 62 unit tests, 100% coverage, 90% floor enforced
- [x] **P2** — Fastify API + Postgres + generated OpenAPI spec *(claims endpoints land with auth in P3–P4)*
- [x] **P2.5** — Docker: multi-stage image (non-root, healthchecked, npm-free runtime), compose profile, Trivy gate
- [x] **P3** — Auth + fixture graph: worker tenants, per-role contexts, IDOR + refresh-rotation suites *(browser storageStates join in P6)*
- [x] **P4** — Full API suite: lifecycle, pagination, double-approve race, contract drift gate
- [x] **P5** — React UI (4 screens), typed client generated from the spec
- [x] **P6** — E2E journeys (POM, storageState, two-role contexts), axe checks, console-error guard
- [x] **P7** — Seeded bug flags + detection matrix — 7/7 caught by exactly the expected tests
- [x] **P8** — CI hardening: 4-way sharding, blob merge, Pages-published report, quality gate, nightly cross-browser
- [x] **P9** — Docs: architecture guide, 7 ADRs, seeded-bug reference, triage runbook, reviewer's guide
- [ ] **P10** — Terraform: OIDC, ECR, ephemeral Fargate stack
- [ ] **P11** — Deploy-smoke workflow: apply → test → always destroy
- [ ] **P12** — Cost guardrails: janitor, budget alarm, scorched-earth script

## Design principles

1. **Tests touch nothing we don't control.** No external sites, no third-party APIs.
2. **A test creates exactly the data it asserts on.** Never reads another test's.
3. **The assertion is the wait.** Web-first assertions only; `waitForTimeout` is a lint error.
4. **Cheapest check first.** Locally and in CI: typecheck → unit → api → e2e.
5. **Green must be reproducible.** Lockfile replay, pinned browsers, one Node version source.

## License

MIT
