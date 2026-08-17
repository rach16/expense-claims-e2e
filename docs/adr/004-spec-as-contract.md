# 004 — Generated OpenAPI spec as the contract, not Pact

**Status:** accepted (P2, P4)

## Context

"Contract testing" usually means consumer-driven contracts with Pact and a
broker. This project has one first-party consumer.

## Decision

The OpenAPI 3.1 spec is generated from the same TypeBox schemas that validate
live traffic, committed to the repo, and enforced two ways: CI regenerates it
and fails on any diff, and the UI's HTTP client is generated from it.

## Why

The failure mode contract testing prevents is a provider changing shape without
the consumer noticing. Here that is impossible: a renamed field changes the
generated spec (CI blocks on drift) and changes the generated client types (the
UI stops compiling). That is consumer-driven pressure with zero infrastructure.

Pact's broker earns its cost when many consumer teams deploy independently and
need per-consumer verification and can-i-deploy checks. With one consumer in the
same repo, the ceremony would exceed the signal — and a broker is not free.

## Costs accepted

- No per-consumer expectations, versioning, or can-i-deploy gating; if a second
  independent consumer appeared, revisit.
- The guarantee is only as good as schema coverage: a route without a declared
  response schema would escape both gates.
