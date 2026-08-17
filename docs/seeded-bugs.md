# Seeded bugs

Eight deliberate defects, each switchable by env var. The detection matrix
(`npm run test:matrix`) boots the stack once per flag and asserts the expected
tests fail — **and only those**.

```bash
BUGS=IDOR_CLAIM_READ npm run test:api          # API-side defects
VITE_BUGS=UI_STALE_TOTAL npm run test:e2e      # UI-side defects
npm run test:matrix                            # all seven, with assertions
```

| Flag | Defect | Layer that catches it | Tests |
|---|---|---|---|
| `MONEY_ROUNDING` | sums money as floating-point dollars | unit | 1 |
| `STATE_SKIP` | transition table allows `draft → approved` | unit | 2 |
| `IDOR_CLAIM_READ` | drops tenant/ownership scoping on read | API | 2 |
| `PAGINATION_OFF_BY_ONE` | wrong `OFFSET` | API | 3 |
| `RACE_DOUBLE_APPROVE` | removes the atomic status guard | API | 1 |
| `UI_STALE_TOTAL` | displayed total never shrinks | E2E | 1 |
| `NO_TOKEN_REFRESH` | client never spends the refresh cookie on 401 | E2E | 2 |
| `A11Y_MISSING_LABEL` | amount input loses its label | E2E + axe | 9 |

Five of seven are caught without starting a browser. That is the layering rule
(*a scenario lives at the fastest layer that can observe its failure*) verified
empirically rather than asserted in a README.

**`NO_TOKEN_REFRESH` came last, and from manual clicking rather than design.**
A five-minute access token expired mid-session while I explored the app by hand;
the UI showed "Save failed" instead of refreshing. No automated test could see
it — they all run seconds after minting a token. The fix, the two tests that pin
expiry with a planted dead token, and this flag all landed together so the gap
cannot reopen.

## Two findings worth reading

**`STATE_SKIP` is caught by unit tests only — and that is correct.** The
decision endpoint independently guards with an atomic
`UPDATE … WHERE status = 'submitted'`, so the illegal transition is still
refused at the database even with the state table corrupted. Two independent
controls; the matrix documents which layer observes which.

**`A11Y_MISSING_LABEL` fails eight tests, not one.** Locators are role- and
label-first, so an accessibility regression is also a functional regression —
the axe test names it, and every test that fills that field falls over too.

## Adding a bug

1. Add the flag to `apps/api/src/bugs.ts` or `apps/web/src/bugs.ts`.
2. Put the defective branch next to the correct code, commented `// BUG <FLAG>:`.
3. Add a row to `MATRIX` in `scripts/detection-matrix.mjs` listing the layers
   that should notice and the test titles expected to fail.
4. Run `npm run test:matrix` — it must report the bug caught by exactly those
   tests. Unexpected failures mean the bug is broader than intended (or a test
   is coupled to something it shouldn't be).
