# Test strategy

All tests use fictional values and local processes. No financial institution, live quote, real document or external account is contacted.

## Automated layers

- `npm run format:check`: source/document formatting via oxfmt.
- `npm run lint`: oxlint with TypeScript, React and accessibility rules, plus the independent-application import boundary check.
- `npm run typecheck`: strict TypeScript, including test files.
- `npm run test:unit`: deterministic engine, fixture totals, ownership, FX/UF, stale/future data, container/component exclusivity, missing quantity/price, original-value preservation, validation and formatting.
- `npm run test:integration`: commands through recalculation and replaceable persistence, append-only history, idempotency, partial/linked repayments and conservation, payable events, review binding reversal, safe hiding, explicit inclusion and reset.
- `npm run build`: optimized Next production build.
- `npm run test:e2e`: Playwright Chromium against a real production server started by the test harness; 23 user journeys/layout/security-boundary scenarios. Includes the four destinations, all headline calculations, provenance, manual asset and liability creation, linked partial repayment, duplicate reversal, currencies, refresh/reset, ownership, new observations, obligation visibility, filtering and validation errors.

The E2E suite runs axe WCAG A/AA tags across all four pages and the manual entry dialog. It checks keyboard focus containment and Escape, widths 320/390/768/1440, 200% root text enlargement, reduced motion, page/console errors and absence of external financial requests. Automated checks do not establish full WCAG conformance or real-user usability.

The first E2E run found inaccessible locator names because help text was part of wrapped labels, and a dialog Tab cycle could leave document focus. The implementation now uses explicit label/control relationships with separately described help and a modal focus loop. Escape focus restoration was also corrected. The final full run passed 23/23; exact final counts and verification evidence are recorded in `IMPLEMENTATION_STATUS.md` and `MANUAL_VERIFICATION.md`.

## Manual verification

Separately open the production build in the Codex browser and interact with the visible controls. Verify canonical totals, all four sections, calculations, source details, manual asset and liability creation, payment, duplicate review, CLP/USD, refresh persistence, reset, desktop/mobile layout and browser console. Automated test success is not recorded as manual verification.

Screenshots in `docs/screenshots/` are synthetic local-app evidence. The automated viewport screenshots come from Playwright; manual browser captures are named separately. They are not real household data or a claim of financial production readiness.

## Coverage limits

Chromium is the automated browser target. No Safari/Firefox/device-lab certification, screen-reader user study, real-world market calendar validation, PostgreSQL/RLS test, external security assessment, OCR/parser certification, bank connector test or target-user ten-second comprehension study is claimed.
