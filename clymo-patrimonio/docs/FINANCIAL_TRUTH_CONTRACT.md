# Financial truth contract · synthetic-v1.0

Cutoff: **2026-09-04**, end-of-day timestamp **2026-09-04T23:59:59Z**. The cutoff is deliberately fixed for repeatable demo behavior. Recording a change now does not mean the financial observation became current now.

## Decimal and selection rules

- decimal.js uses 80 significant digits and half-up rounding. Money observations accept up to 8 decimals, quantities/prices up to 12, rates/percentages up to 16, with at most 30 integer digits. Intermediate quantity, ownership and FX calculations do not round to display units. Each final reporting component is materialized to 8 decimals; snapshot sums and subtraction are exact over those stored components.
- CLP displays no decimals, USD two and UF four. Separately rounded visible components can differ by a minor unit from the displayed sum. Full stored amounts remain available in calculation details. Repeating division cannot have a finite exact decimal representation; the component precision is explicit rather than using binary floating point.
- Select observations at or before cutoff, newest effective date first, then binding priority, then append order. Manual corrections have priority 20; primary synthetic statements 10; a bound secondary statement 5. A late entry of an older observation cannot displace a newer effective balance. Retrieval/entry timestamps remain separate.
- Assets increase net worth; liabilities reduce it. Negative input is rejected instead of guessing direction. Credit limits are informational and never counted. An investment account uses either its total or its components, never both.
- Household percentages multiply contributions. Unknown/disputed ownership blocks inclusion. Application access is not ownership. A zero confirmed share contributes zero without inventing another owner's share.
- A manual include decision cannot override missing FX, maximum age, ownership or unsupported property rules. Explicit exclusions are reversible new decisions.

## Currency and provenance

USD 1 = CLP 950; UF 1 = CLP 40,000. UF is stored as `CLF`. No EUR rate exists. Conversion supports approved direct, inverse and CLP-pivot paths, retaining rate ID, direction, method, source, effective date and recording date. Only rates at or before cutoff and within age policy can convert. Missing/expired conversions are `null`, never zero. Switching currency recomputes each original value, not a converted aggregate.

Every component retains account identity, original amount/currency, selected observation/event IDs, source, effective and recording times, ownership/inclusion decision IDs, separate quantity/price/FX dates when relevant, valuation method, status and reasons. Missing full position valuation stays unavailable. An excluded item may show an available equivalent as reference, explicitly outside the sum.

## Freshness

| Input                | Current           | Stale | Very stale, still included | Excluded |
| -------------------- | ----------------- | ----- | -------------------------- | -------- |
| Statement / quantity | 0–35 days         | 36–65 | 66–95                      | >95      |
| Price / FX / UF      | 0–2 business days | 3–5   | 6–10                       | >10      |
| Manual               | 0–30 days         | 31–90 | 91–180                     | >180     |

The prompt leaves gaps between warning and maximum exclusion. These become an explicit “Muy antigua” state, still included until the stated maximum. Default business days are Monday–Friday with a configurable holiday list. No real exchange-calendar certification is claimed. Price age never refreshes quantity age. If any required broker component is ineligible, the whole broker source is excluded rather than showing an unexplained partial account total.

## Obligations and duplicates

Outstanding principal derives from an ordered, append-only event journal. Reductions cannot exceed the remaining balance; settlement must close it exactly; disputes preserve principal and exclude the obligation. An optional cash link is permitted for same-currency, current, fully owned cash and fully owned obligation. One command appends the cash observation and payment event atomically within the stored state. Collection increases cash and reduces receivable; payment reduces cash and payable. Neither creates net worth. Without a link, only the obligation changes and the UI explains that limitation.

Disabling the obligation interface hides it without changing totals/history. An explicit inclusion decision is required to exclude a recorded obligation. Unverified receivables/payables are included only under the clearly named synthetic policy.

Duplicate identity review uses source/institution/account/currency/owner/position evidence, not similar balances alone. The secondary broker statement starts unbound; binding targets the existing account and reversal creates another decision. Neither action modifies raw observations nor increases exposure.

Property and linked mortgage remain excluded together. Assumed liquid cash is checking + household savings share + manual cash + broker cash; it excludes deposits, investments, receivables and credit capacity. This is synthetic assumed liquidity, not verified bank available balance.
