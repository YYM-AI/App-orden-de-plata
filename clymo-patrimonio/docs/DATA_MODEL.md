# Data model

All financial amounts, quantities, percentages, prices, FX and UF values are decimal strings; schema validation rejects JavaScript numbers, negative amounts, NaN, Infinity, exponents, ambiguous grouping, malformed currencies/dates and duplicate entity IDs. Asset/liability direction is a separate typed field. Financial state has a schema version, revision and cutoff.

| Entity                           | Meaning                                                                                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Household                        | One fictional economic workspace, explicitly synthetic                                                                                          |
| User / Membership                | Administrative or read-only helper reference; no real authentication                                                                            |
| FinancialParty                   | Economic owner or obligation counterparty, independent of login                                                                                 |
| OwnershipDecision                | Household percentage, party, confirmation/dispute status, actor, reason and dates                                                               |
| Institution                      | Illustrative institution identity, country and synthetic flag                                                                                   |
| LogicalAccount                   | One economic source with currency, direction, category and valuation basis                                                                      |
| SourceBinding                    | Manual or fictitious statement provenance, logical target and selection priority                                                                |
| RawObservation                   | Normalized immutable evidence metadata; no document/payload intake                                                                              |
| BalanceObservation               | Balance, broker cash, informational container total or credit limit                                                                             |
| Instrument / PositionObservation | Fictional instrument, resolved identity and dated quantity                                                                                      |
| PriceObservation                 | Approved or unapproved fictional price with currency and dates                                                                                  |
| ExchangeRate / UFValue           | Approved fictional rate or indexed unit (CLF), original direction, effective and record dates                                                   |
| ManualAsset / Liability          | Supplemental identity for manually declared assets and principal-only liabilities                                                               |
| PersonalObligation               | Receivable or payable with fictional counterparty and original currency                                                                         |
| ObligationEvent                  | Initial principal, repayment, adjustment, forgiveness, write-off, settlement, dispute; optional cash-observation link                           |
| InclusionDecision                | Explicit included/excluded preference, subject to mandatory eligibility checks                                                                  |
| DuplicateCandidate               | Unbound secondary statement, proposed logical target, concrete identity evidence                                                                |
| ReviewTask / ResolutionDecision  | Review problem and append-only acknowledgment, reopening, binding or reversal                                                                   |
| ValuationComponent               | Selected originals, reporting amount, ownership, status, reasons, source/observation/decision IDs, dates, conversion path and calculation steps |
| NetWorthSnapshot                 | Dated deterministic components, totals, coverage and oldest included source date                                                                |

Global entity IDs are unique across arrays. Household-owned records are checked against the one demo household; foreign references are validated. These model checks are not production tenant isolation. The optional helper has no economic share and command-level viewer writes fail, but users can inspect/edit their local browser storage.

The broker has one logical account, a primary source, cash and ETF position, an informational total, and an unbound duplicate statement with another informational total. Binding/unbinding is derived from resolution history. No destructive merge or second economic account is created.
