# Manual production-browser verification

Date: **6 September 2026**. Target: local Next production build at `http://127.0.0.1:3100`, opened in the real Codex browser. Interactions used visible application controls; this record is separate from Playwright's automated test assertions. All names and amounts below are invented QA data.

| Check                 | Observed result                                                                                                                                                                                                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Four sections         | Resumen, Fuentes, Revisión and Configuración opened and operated                                                                                                                                                                                                              |
| Canonical summary     | Assets CLP 60,240,000; liabilities CLP 7,700,000; net worth CLP 52,540,000; liquid cash CLP 25,250,000; 9/13 sources included                                                                                                                                                 |
| Four explanations     | Opened net worth, cash, assets and liabilities dialogs; component lists and totals matched                                                                                                                                                                                    |
| Broker provenance     | USD 5,000 cash + 100 units × USD 42 = USD 9,200; × CLP 950 = CLP 8,740,000; distinct quantity, price and FX dates visible                                                                                                                                                     |
| Joint ownership       | Santander original CLP 15,000,000 at 50% produced CLP 7,500,000 for the household                                                                                                                                                                                             |
| Exclusions            | EUR 8,000 preserved with conversion unavailable; CLP 2,000,000 old account excluded; CLP 150,000,000 home and UF 1,000 mortgage both excluded                                                                                                                                 |
| Manual asset          | Created “Activo QA Demo”, CLP 100,000, 100%, other asset                                                                                                                                                                                                                      |
| Manual liability      | Created “Pasivo QA Demo”, CLP 200,000, 100%, loan; net worth became CLP 52,440,000                                                                                                                                                                                            |
| Refresh persistence   | Both manual sources remained visible after reloading the browser                                                                                                                                                                                                              |
| Partial repayment     | Recorded CLP 500,000 from María Demo with linked checking account. Receivable fell from CLP 3,000,000 to CLP 2,500,000; cash rose to CLP 25,750,000; net worth stayed CLP 52,440,000 with the QA additions                                                                    |
| Duplicate review      | Bound the additional broker source, pending count fell from 4 to 3; net worth stayed unchanged. Undid binding, pending count returned to 4; history retained both decisions                                                                                                   |
| Currency              | Changed CLP to USD; net worth after QA additions was USD 55,200.00; reload preserved USD; switching back restored CLP 52,440,000                                                                                                                                              |
| Reset                 | Confirmed reset discarded QA additions/events/decisions, restored CLP and all canonical totals; repeated after final review verification                                                                                                                                      |
| Responsive            | Visually inspected 320 and 390 px summary, 390 px manual form, 768 px settings and 1440 px summary/source/review. Navigation, text and controls remained usable. DOM width checks at 320 and 768 matched viewport; automated tests covered all four routes at all four widths |
| Console               | Production-browser error/warning log queries returned an empty list                                                                                                                                                                                                           |
| Optional WebMCP       | Discovered `get_synthetic_net_worth`; `{}` returned the same synthetic snapshot; unexpected input was rejected. No writes or external financial calls                                                                                                                         |
| Final copy correction | Reopened final production build and bound duplicate again: description correctly said it was linked and counted once; decision label identified its effective date                                                                                                            |

The final UI was reset and returned to Resumen. Local data are synthetic. No real statement, credential, bank or broker was involved.

## Screenshot evidence

- `manual-desktop.png`: 1440×1000 desktop viewport; three canonical totals and liquid cash.
- `manual-mobile-320.png`: 320×900 phone viewport.
- `manual-mobile-390.png`: 390×900 phone viewport.
- `manual-mobile-form.png`: 390×900 entry dialog; the dialog scrolls to remaining controls.
- `manual-tablet-settings.png`: 768×1024 settings viewport.
- `manual-broker.png`: broker provenance panel.
- `manual-review.png`: resolved duplicate on desktop.
- `summary-320.png`, `summary-390.png`, `summary-768.png`, `summary-1440.png`: separate full-page screenshots generated by the automated E2E suite.

Manual images are direct browser captures, without compositing or content edits. Browser viewport capture was used for the final manual images because long-page capture introduced stitching artifacts. Fixed mobile navigation appears within full-page automated screenshots at the capture viewport position.

## Limits

This is agent-operated manual UI inspection plus automated Chromium coverage, not a study with older users, a screen-reader certification, a physical-device/Safari/Firefox lab, a ten-second comprehension study or a production security review. No private staging deployment was available; verification remained local.
