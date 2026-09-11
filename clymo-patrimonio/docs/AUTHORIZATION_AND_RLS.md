# Authorization and Row Level Security

| Household operation                                         | Owner                                 | Helper | Anonymous / unrelated / revoked |
| ----------------------------------------------------------- | ------------------------------------- | ------ | ------------------------------- |
| View sources, calculations, review tasks                    | Yes                                   | Yes    | No                              |
| Append assets, liabilities, balances, ownership, repayments | Yes                                   | No     | No                              |
| Inclusion or duplicate decisions; settings                  | Yes                                   | No     | No                              |
| Export JSON / CSV                                           | Yes                                   | No     | No                              |
| Authorize/revoke members or change roles                    | Yes                                   | No     | No                              |
| Reset or delete the household                               | Yes; deletion requires recent sign-in | No     | No                              |
| Rewrite historical evidence directly                        | No                                    | No     | No                              |

Self-account deletion acts only on the authenticated account, subject to last-owner protection; it cannot delete someone else's household. Allowlisted users may create their own empty household. Being a helper elsewhere confers no authority over that other household.

All 27 public application tables and the private deletion-receipt table have RLS. Household-owned rows use explicit `household_id` or the household's own primary key. There are no anon table grants. Member SELECT policies check live session, allowlist and active membership. Owner INSERT policies use WITH CHECK. There are deliberately no ordinary UPDATE/DELETE policies on financial evidence: updates are new observations, while lifecycle deletion/reset uses a guarded transactional RPC. Household metadata and membership writes have no direct client grants.

`private.allowed()` and `private.has_role()` are narrow boolean security-definer helpers, with pinned empty search paths and qualified references. Public RPCs are invokers that call narrowly granted private operations. Internal clearing/appending/valuation functions are not executable by ordinary users. Private schema is not exposed by PostgREST. PUBLIC function execution is revoked. `account_inventory` is a security-invoker view; joins retain table RLS. There are no storage objects or storage paths.

The owner lock and live membership recheck serialize membership changes with writes. Helper self-promotion, adding oneself to another household, cross-household inserts/updates, changing a row's household, and manipulating RPC IDs all fail. The last-owner trigger prevents demotion, revocation or account deletion that would orphan a household. Audits are append-only and cannot be forged through ordinary table operations.

Real local database tests exercise all 26 household resources × three target households × eight actors × SELECT/INSERT/UPDATE/DELETE = 2,496 matrix cases. Every table is populated with rollback-only sentinel rows, including C, avoiding empty-result false confidence. Additional catalog, profile, join/view, RPC, lifecycle and actual PostgREST tests are separate. Auth sessions are real; direct SQL tests assume the actual authenticated database role and verified locally issued claims. No RLS mock is used. See the current results in [implementation status](IMPLEMENTATION_STATUS.md).
