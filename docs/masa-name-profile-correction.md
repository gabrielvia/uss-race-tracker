# MASA names and shared profiles

User correction: November 4, 2026. A known skater appearing in both MASA and AGN should have one profile, and the stars attached to female names in the MASA protocol are source annotations rather than part of the normal name.

## Implemented behavior

All 30 starred names in the pinned MASA 2026 PDF now display and search normally. For example, `Lindsay* Lin` displays as `Lindsay Lin`, and `Xinyu (Lilian)* Li` displays as `Xinyu (Lilian) Li`. Parentheses, hyphens, case and other name text remain intact. This source rule applies only to MASA PDF hash `2671f997837bdc170dfc1fc995fbe9431ea30df968678e51e62d350a72440ae2`. The original participant name is returned as `source_name`; roster entry names, aliases, original extraction rows and PDF bytes remain literal.

`web/lib/source-name.ts` supplies the same SQL expression to search, competition participants, profile headers, full history, PB evidence and chart series/records. Normalization alone does not link identities.

The explicit review in `data/sources/masa-agn-identity-review.json` contains 32 MASA/short-track AGN pairs, including 12 starred-name pairs. Each has one exact full-name match after removing the MASA annotation, matching source gender, a reviewed full/short club-label correspondence, physical roster pages and the two pinned PDF revisions. The complete set contains 17 male and 15 female pairs. No new pairs are inferred from a bib or an approximate name.

Each pair uses the existing AGN skater identity as its anchor. Both competition-local links are marked reviewed through the protected identity endpoint, using current link/publication revisions. There are 64 auditable decisions. No participant, entry, race, result, source PDF, extraction object, competition publication or age-rule assignment is replaced. Historical local identity rows remain available for audit and reversal.

The resulting current projection has 373 competition-local participants and **341 distinct active profile identities**. A search for either the normal name or its original starred spelling reaches one linked identity. Either competition-local URL reads the same combined profile/history/PBs; old source links remain valid aliases. Personal bests span both competitions and use one minimum per discipline/distance. Charts retain one best per identity/whole competition/distance, so different competitions still contribute separate points. Needs-review records remain isolated.

MASA ability divisions still establish no numerical age. Existing reviewed AGN age evidence is available through the corrected identity, with the same rule/version/source. No birthday, current club or age category is inferred from the star.

## Operations

`scripts/reconcile_masa_agn.py` defaults to inspection. It verifies both current source hashes, all source/target names and affiliations, current identity scopes and publication revisions before preparing decisions. An unexpected existing identity or needs-review state stops the entire preparation before any write. `--apply` submits only the explicit reviewed pairs. Completed reviewed links are skipped on resume; the endpoint also enforces revision checks and immutable decision history. Final verification checks both members and retained competition heads.

```sh
python3 -m scripts.reconcile_masa_agn --url <existing-private-origin> --report outputs/identity-plan.json
python3 -m scripts.reconcile_masa_agn --url <existing-private-origin> --apply --report outputs/identity-apply.json
```

Credentials are read through hidden stdin. The reviewed pair manifest is required; this is not a global name-matching importer. Existing corpus checkers that explicitly assume every participant is unmerged describe the earlier phase 6 checkpoint and should not be used to assert current merged PB totals.

## Validation and private release

98 backend tests, 72 Python tests, TypeScript and the production build pass. Real-source regression fixtures verify clean and raw name searches, retained parentheses/punctuation, both source aliases, combined histories/PBs, comparison deduplication, separate competition-best points, unchanged source rows and needs-review isolation. Reconciliation tests verify read-only default behavior, source drift/identity-review blocking and idempotent resume.

The original owner-private Site is deployed as v20, Sites source commit `18007f2a28e4d76dfb600a57e1c390b5377cc100`, deployment `appgdep_6aeb934ae9208191ae5a15cd3e4a3845`. Site metadata still shows one allowed owner and zero external visitors. The 32 reviewed pairs/64 decisions have been applied and verified through the protected API; competition heads remain unchanged.

Credential-free evidence is saved in ignored `outputs/name-fix-identity-plan.json`, `outputs/name-fix-identity-apply.json`, `outputs/name-fix-all-tests.txt`, `outputs/name-fix-python-tests.txt` and `outputs/name-fix-typescript.txt`. Final hosted conformance passes: all 2,729 original result rows and source evidence are retained; all 341 active identities/1,149 PB groups, 64 source profile aliases and 119 merged chart scopes match the reviewed records. Search pagination contains 341 unique identities, both ordinary/starred searches return one identity for each reviewed pair, and age evidence is unchanged. See `outputs/name-fix-hosted-verification.json`. Browser interaction acceptance is not claimed by these API checks. GitHub commit/push/merge has not been performed.
