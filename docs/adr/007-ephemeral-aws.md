# 007 — Ephemeral AWS environments, no always-on server

**Status:** accepted (planned, P10–P12)

## Context

The project needs to prove tests can run against real infrastructure — real
network, real TLS, real container orchestration — on a budget under $5 total.

## Decision

Terraform creates a tagged, disposable environment per smoke run (ECS Fargate,
one task carrying the API container plus a Postgres sidecar), the smoke suite
runs against it, and `terraform destroy` runs in an `if: always()` step. GitHub
authenticates to AWS via OIDC federation — no long-lived keys anywhere.

## Why

- **Cost as an engineering constraint.** No ALB (~$16/mo idle), no NAT gateway
  (~$32/mo idle), no RDS. Public subnet, security group scoped to the runner.
  A run costs roughly a cent because nothing exists between runs.
- **Postgres as a sidecar, not RDS:** 8–12 minutes of provisioning for a
  database whose data is discarded is pure waste; a sidecar boots in seconds and
  is honest about being disposable.
- **OIDC over stored credentials:** short-lived tokens, nothing to rotate or
  leak, and it keeps the repo's zero-secrets claim intact.
- Rejected EKS (resume-driven for a four-screen app), Lambda + API Gateway
  (would fork the app into a second runtime shape and pollute the test story),
  Elastic Beanstalk (legacy signal), and an always-on EC2 demo (a permanent bill
  and a permanently drifting environment).

Guardrails are part of the deliverable, not ops hygiene: teardown in
`always()`, an hourly janitor workflow destroying anything tagged and older than
two hours, and a $4 budget alarm as the backstop.

## Costs accepted

- No permanent demo URL. The answer to "can I see it running?" is a
  workflow-dispatch button, which is a better answer than a stale link.
- Each smoke run pays a few minutes of provisioning latency, which is why the
  deployed tier is a small suite on a schedule, not the full suite per PR.
