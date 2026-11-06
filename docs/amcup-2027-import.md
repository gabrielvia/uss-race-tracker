# 2026-2027 AmCup 1 import

Phase6 remains in progress. This increment imports one complete competition, preserving the newest-to-oldest season workflow.

## Source and publication

- Official title:2027 U.S. Fall World Cup Qualifier & American Cup1.
- Source-confirmed dates:October30-November1,2026, Milwaukee,WI.
- Original source: https://assets.contentstack.io/v3/assets/blteb7d012fc7ebef7f/bltc12a6d42aed8c552/6ae92444332c2f3c0ea5fac0/2027_AmCup_1_FWCQ.pdf
- PDF:50 physical pages,10754225 bytes, SHA-256 `33d17599ed3cc66b082be4f0590227444ed85bdea41c79c82ece32eb90bad1bd`.
- Competition:`lt-amcup1-2027`;70 participants/entries,18 events,370 result rows.
- Ordinary metre-distance rows:317, including307 positive timed rows with no result status. Separate16-lap mass-start rows:53.
- Private Site v22 source commit:`9351f51884c3e7de008e5df6fbe34f4038b6b52d`.
- Deployment:`appgdep_6aebde8b79508191a8617e8091705639`, succeeded.
- Published batch:`b93f0b734689ec139607e516d372bfb8534b7a33b4a47742629b597006037a2f`.
- Previous four publication heads retained; repeated submit/publish requests are idempotent. No GitHub commit or push was made for this increment.

## Fidelity and scope

This scanned PDF has no embedded text. Local CPU OCR assists extraction; the curated review checked all370 result rows and70 distinct roster observations against original page images. The checked-in source review and complete item are bound to the PDF hash and an exact whole-item digest; subsequent changes require a new review.

Official places and times remain independent. In particular, physical page6 retains Allison LA place15/45.59 and Evie FORRER place16/45.57. Neither value is corrected or excluded from PBs solely because of its apparent ordering. Competition tables display official places.

Mass starts retain16 laps without a guessed metre distance, and remain outside ordinary-distance PBs/trends. Missing Time values remain missing; Cum.Split and other finish-report columns are preserved separately. WDR, DQ/T08, printed parenthetical tie precision, country, lane, behind and original names remain source evidence. Country is separate from an absent club affiliation. Truncated or differently capitalized row names remain literal source names. No cross-competition identity merge or historical numeric age rule is inferred.

Append-only migrations0009 and0010 add nullable evidence fields and metre/individual defaults for existing records. No existing competition is re-seeded.

## Verification

-102 backend tests,76 Python tests and TypeScript checking passed. The final event-order adjustment also passed both focused scanned-source tests. Production build and diff whitespace checks passed.
- The original archived PDF hash and all3608 source rows, new persisted fields, participant country/affiliation and original extraction evidence were verified by hosted readback.
- All490 active identities and1746 PB groups were verified, together with70 new profiles and228 new chart queries. Credential-free report:`outputs/amcup-hosted-verification.json`.
- Browser verification recovered using a fresh tab in the same in-app browser. The published competition, literal page6 places/times, country versus absent club, and separate16-lap filter with53 results were confirmed. No responsive/mobile verification is claimed.

Complete logs remain outside conversation context. The operational token-saving boundary is documented in `docs/season-import-workflow.md`; full-record checks and required source review are retained.
