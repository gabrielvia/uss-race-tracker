# Skater profile mobile improvement plan

Status: planning only. The user reported that the desktop profile works reasonably well but the mobile layout feels awkward. Mobile implementation is explicitly deferred to a later joint design discussion. The competition-best chart correction does not change responsive CSS or redesign the mobile profile.

## Goals and boundaries

Make the profile easy to read and operate on a phone while preserving the current desktop experience. Keep automatic all-season PBs, one competition-best chart point per identity/discipline/distance, independent chart filters, original source evidence and optional complete race history. No required profile season/discipline selection, identity inference, age-rule change, fabricated race date, new track specification or historical data import is part of this work.

The report identifies a usability problem, not a verified list of layout defects. Inspect actual phone layouts before choosing exact component sizes or claiming a root cause.

## Proposed sequence for the later discussion

1. **Inspect and agree on the profile hierarchy.** Review 320, 360, 390 and 430 CSS-pixel widths, landscape and a tablet breakpoint. Use long names, long competition titles, multiple PB distances, up to four comparison identities, loading/error/empty states and source details. Identify overflow, oversized spacing, excessive scrolling and hard-to-reach controls. Agree on the mobile order: identity summary, PBs, competition-best trend, optional detailed history/evidence.
2. **Sketch the mobile profile before implementation.** Explore a compact identity summary and PB cards with readable times and concise metadata. Put extended affiliation/age/source explanations behind labelled disclosure controls without hiding uncertainty or source access. Keep the desktop layout unless the shared component needs a verified fix.
3. **Simplify chart controls and comparison selection.** Explore a compact chart header with discipline/distance controls, optional date-range disclosure, removable comparison chips and a search panel or bottom sheet. Keep selected scope visible. Do not make users repeatedly reselect a profile scope to see PBs.
4. **Design touch interaction for the chart.** Reserve enough height for the plot; adapt tick density, axis labels and legends to the viewport. Provide a persistent tap-selected competition-best card or accessible bottom sheet containing competition date range, exact time and source links. Retain one point per competition and all tied source evidence. Use clear markers plus names so color is not the only identity cue. Avoid gesture conflicts with vertical page scrolling.
5. **Replace dense mobile summary tables with compact records.** Explore one competition-best card per competition with date range, time, competition name and an explicit source-details action. Expand race/round/heat and tied source records on demand. Keep full history available in a separate expandable area; do not discard statuses, slower performances or missing times.
6. **Implement only after the proposed interaction is reviewed together.** Apply shared spacing/typography rules, responsive breakpoints, focus behavior and touch targets consistently rather than accumulating isolated viewport fixes. No changes are authorized by this planning document alone.

## Acceptance criteria for that future work

- No document-level horizontal overflow at the target widths; text and primary controls remain readable at 200% zoom. Long names and source titles wrap without hiding their meaning.
- Touch targets are at least 44 by 44 CSS pixels where practical. Chart selection, comparison search/removal, source links and disclosure controls work with tap, keyboard and screen-reader navigation.
- The chosen point and its source evidence remain available without hover. Focus is restored correctly when a sheet/panel closes; Escape and labelled close controls work.
- PBs remain visible independently of chart filters. Chart selections, refresh/back/forward and source-event navigation retain the agreed URL behavior.
- All plotted values match the competition-best summary and original source records. Dates remain competition ranges, equal-best source records stay traceable, and statuses/missing times stay out of numeric points.
- Empty, loading, error and unavailable-date states are usable on phones. Desktop receives a separate regression check.
- Capture agreed desktop/mobile screenshots and a concise interaction checklist after implementation. Do not mark acceptance complete from CSS inspection alone.

## Deliverables when resumed

An agreed mobile wireframe/interaction proposal, scoped component changes, source/identity/PB regression checks, and browser verification on the target widths. Broader site redesign, Season-menu cosmetics, Admin, domains, login and scheduling/email remain outside this plan.
