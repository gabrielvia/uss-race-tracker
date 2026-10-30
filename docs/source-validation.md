# Source inventory and extraction validation

Checked on October 29, 2026. This is a bounded source-validation milestone, not a completed historical importer or deployed app.

## Directory coverage

The official [results directory](https://www.usspeedskating.org/results) was downloaded successfully over HTTPS. Its server-rendered HTML contains the season links, so the inventory does not require browser automation. Some earlier text-fetch tools returned HTTP 403; future fetch failures must be reported instead of interpreted as an empty directory. A saved HTML file is also accepted for offline reproduction.

The snapshot has **498 directory entries across 14 season/year groups**, representing **493 distinct entry URLs**. There are 265 PDF entries and 233 page entries. Counts describe directory listings, not verified unique competitions. A single competition can have several files, and a file can be listed under several labels.

See [the inventory](../data/sources/inventory.json) for original titles, season labels, absolute URLs, source IDs, unique directory-entry IDs, format hints, and review flags. `discovered` does not mean the target was fetched or parsed. File modification dates remain null unless a download supplies them. A title date is never silently promoted to a verified event date.

Four entries have title dates outside their listed July-to-June season. Two of those have future title dates relative to this snapshot; one generic `Article` link has an ambiguous label. These are review flags, not automatic corrections. Historical single-year group labels are preserved without assigning a modern season convention.

## PDF samples

| Sample | PDF pages | Roster observations | Distinct competition bibs | Selected race sample |
| --- | ---: | ---: | ---: | --- |
| 2026 Short Track Age Group Nationals | 177 | 213 | 213 | Page 75, race 101: 5 results |
| 2026 Long Track Age Group Nationals | 118 | 77 | 76 | Page 84, race 101: 7 results |
| 2026 MASA Championships | 72 | 84 | 84 | Not sampled |

Structured output is in [data/samples](../data/samples/). Each output records the source URL, source ID, whole-file SHA-256, parser version, and physical PDF page numbers starting at 1. PDF printed page numbers can differ. These JSON files are extraction evidence, not production skater profiles or a seeded database.

Roster extraction scans the first 10 physical pages and uses word coordinates and table headers to preserve names, affiliations, status labels, and competition divisions separately. Short-track and long-track roster pages were rendered and visually spot-checked against extracted fields. All 213 short-track observations and all 77 long-track observations passed the extractor's row checks; those checks do not constitute a manual audit of every athlete.

### Important findings

- Long-track bib 370 appears twice for Andrea Sudjapun, once in a combined division and once in Master Women. The raw age annotations differ in wording but agree on 40-44. Keep both participation observations; do not create two people or count the observations as two distinct bibs.
- Long-track age categories can appear in parentheses in the name column. The extractor preserves the raw name and separates a recognized age suffix. Other parenthetical names are left unchanged.
- MASA has no explicit age-status column. Its named racing groups do not establish an age. The sample also contains one empty roster template on physical page 5, recorded as an unsupported header for review; no athlete row was found on that page.
- `Direct` is preserved as an affiliation, with `club_name` left null. Full club names and abbreviations are not merged automatically.
- Race samples preserve time strings and integer microseconds without floating-point rounding. Race and classification tables are kept separate. Unsupported non-finishes cause an explicit sampling error rather than a zero time; complete status handling belongs in the production importer.
- A roster bib identifies a participant only within a competition. These samples do not resolve identities across competitions or calculate final skating ages.

## Historical discovery

The [2014 short-track age-group page](https://www.usspeedskating.org/events/results/2014/march/21/2014-st-national-age-group) returned HTTP 200 and links to a PDF on the Team USA migration S3 host. The URL and page hash are saved in [the discovery record](../data/sources/legacy-sample-discovery.json). That PDF has not been downloaded or parsed. The remaining 232 page entries have not been individually inspected.

## Reproduce

Use Python 3.11 or newer. Run commands from the repository root. Creating a virtual environment is optional if the required dependency is already available.

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-data.txt
python3 -m unittest discover -s tests -v
python3 scripts/source_inventory.py
```

For a saved directory response, use `python3 scripts/source_inventory.py --html path/to/results.html`.

Download and inspect one sample:

```sh
python3 scripts/download_sample.py --source-id 9567603f2ef7d57a --output .data-cache/long-track.pdf
.venv/bin/python scripts/inspect_roster.py --file .data-cache/long-track.pdf --source-id 9567603f2ef7d57a --output outputs/long-track-roster.json
.venv/bin/python scripts/inspect_race.py --file .data-cache/long-track.pdf --roster outputs/long-track-roster.json --page 84 --race-id 101 --output outputs/long-track-race.json
```

Other sampled source IDs:

- Short-track AGN: `381947c967290f89`; selected race is 101 on page 75.
- MASA: `a3e0ccc938d4730c`; roster only.

`--max-pages` controls the roster sampling bound. Repeated directory labels can share a source ID; `directory_entry_id` distinguishes the listings. Sample IDs belong to this snapshot. Refreshing the directory does not refresh downloaded PDFs or sample outputs; regenerate them together when reviewing an update. Keep binary PDFs, download metadata, rendered images, environments, and transient outputs out of Git. Compare downloaded hashes with checked-in sample hashes before reusing physical page selections after source updates.

## Next milestone

The directory inventory and representative current-format extraction are ready for the minimal local/Sites database slice. Historical and unsupported layouts remain explicitly outside validated coverage. Build one real-sample read API with D1 and verify the same code locally and on a private Site. Production identity reconciliation, skating-age calculation, complete race/status handling, revised-file reconciliation, and bulk historical imports remain later milestones.
