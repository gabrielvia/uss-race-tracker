import { createHash } from "node:crypto";
import { z } from "zod";
import { COMPETITION_ID } from "@/lib/competition-id";

export const VALIDATION_VERSION = "selected-event/2";
const label = z.string().min(1).max(300).refine(value => value.trim().length > 0, "A nonblank value is required.");
const id = z.string().regex(/^[a-zA-Z0-9:_-]{1,180}$/);
const positive = z.number().int().positive().max(1_000_000_000);
const page = positive.max(5000);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const nullableLabel = label.nullable();
const resultStatus = z.enum(["PEN", "DNS", "DNF", "DQ"]).nullable();
const observation = z.object({
  bib: label, name: label, affiliation_raw: label, division_raw: label,
  age_status_raw: nullableLabel, raw_name: label, page,
}).passthrough();
const rawResult = z.object({
  rank: positive.nullable(), status_raw: resultStatus, row_raw: z.string().min(1).max(2000), bib: label, name_raw: label, affiliation_raw: label,
  time_raw: nullableLabel, time_microseconds: positive.nullable(), qualification_raw: nullableLabel,
  event_label_raw: label, event_number: label, distance_metres: positive,
  round_raw: label, race_id: id, race_label_raw: label, source_page: page,
  group_label: label, heat_number: positive.nullable(), heat_total: positive.nullable(),
}).passthrough();
const participant = z.object({ id, bib: label, name: label, affiliation: label }).strict();
const entry = z.object({ id, participantId: id, division: label, ageStatus: nullableLabel, rawName: label, sourcePage: page }).strict();
const result = z.object({
  id, participantId: id, raceId: id, distance: positive, round: label,
  rank: positive.nullable(), status: resultStatus, timeRaw: nullableLabel, timeMicroseconds: positive.nullable(), qualification: nullableLabel,
  sourcePage: page, eventKey: id, eventLabel: label, raceLabel: label,
  heatNumber: positive.nullable(), heatTotal: positive.nullable(),
}).strict();
const contract = z.object({
  schemaVersion: z.literal(2), coverage: z.literal("selected-event"),
  baseBatchId: digest.nullable(),
  review: z.object({ reviewer: label, seasonSourceLabel: label, notes: label, confirmed: z.literal(true) }).strict(),
  item: z.object({
    source: z.object({ id: z.string().regex(/^[a-f0-9]{16}$/), url: z.string().url().max(2000), sha256: digest }).strict(),
    competition: z.object({
      id: z.string().regex(COMPETITION_ID), title: label,
      discipline: z.enum(["short-track", "long-track"]), season: z.string().regex(/^20\d{2}-20\d{2}$/),
      startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), location: label,
    }).strict(),
    participants: z.array(participant).min(1).max(1000), entries: z.array(entry).min(1).max(2000),
    results: z.array(result).min(1).max(1000),
    evidence: z.object({
      roster: z.object({
        parser_version: z.literal("tempus-roster-sample/0.1"), source_id: label, source_url: label, sha256: digest,
        page_count: page, observation_count: positive, distinct_bib_count: positive,
        issues: z.array(z.unknown()).max(100), observations: z.array(observation).min(1).max(2000),
      }).passthrough(),
      race: z.object({
        parser_version: z.literal("tempus-complete-event/0.2"), status: z.literal("complete_selected_event"),
        source_id: label, source_url: label, sha256: digest, pages: z.array(page).min(1).max(100),
        event_number: label, event_label_raw: label, heat_count: positive, result_count: positive,
        heats: z.array(z.object({ race_id: id, label, heat_number: positive.nullable(), heat_total: positive.nullable(), result_count: positive }).strict()).min(1).max(100),
        results: z.array(rawResult).min(1).max(1000),
      }).passthrough(),
    }).strict(),
  }).strict(),
}).strict();
export type ImportPayload = z.infer<typeof contract>;
export type Issue = { code: string; path: string; message: string };
export type ValidationReport = {
  validationVersion: string; valid: boolean; errors: Issue[]; warnings: Issue[];
  counts?: { participants: number; entries: number; results: number; heats: number };
  coverage: "selected-event";
};
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, v]) => `${JSON.stringify(key)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
export const hash = (text: string) => createHash("sha256").update(text).digest("hex");
export const candidateId = (value: unknown) => hash(`${VALIDATION_VERSION}\n${canonical(value)}`);
function micros(raw: string): number | null {
  const m = /^(?:(\d+):)?(\d{1,2})\.(\d{1,6})$/.exec(raw);
  if (!m || Number(m[2]) >= 60) return null;
  return ((Number(m[1] ?? 0) * 60 + Number(m[2])) * 1_000_000) + Number(m[3].padEnd(6, "0"));
}
function validDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
export function validate(value: unknown): { payload?: ImportPayload; report: ValidationReport } {
  const report: ValidationReport = { validationVersion: VALIDATION_VERSION, valid: false, errors: [], warnings: [], coverage: "selected-event" };
  const parsed = contract.safeParse(value);
  if (!parsed.success) {
    report.errors = parsed.error.issues.slice(0, 100).map(i => ({ code: "SCHEMA", path: i.path.join("."), message: i.message }));
    return { report };
  }
  const payload = parsed.data;
  const { competition: c, source, participants, entries, results, evidence: { roster, race } } = payload.item;
  const error = (code: string, path: string, message: string) => { if (report.errors.length < 100) report.errors.push({ code, path, message }); };
  const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);
  const sourceUrl = new URL(source.url);
  if (sourceUrl.protocol !== "https:" || sourceUrl.username || sourceUrl.password || !["assets.contentstack.io", "www.usspeedskating.org", "usspeedskating.org"].includes(sourceUrl.hostname)) error("SOURCE_URL", "item.source.url", "An official HTTPS source URL is required.");
  const [start, end] = c.season.split("-").map(Number);
  if (end !== start + 1 || !validDate(c.startsOn) || !validDate(c.endsOn) || c.startsOn > c.endsOn || c.startsOn < `${start}-07-01` || c.endsOn >= `${end}-07-01`) error("SEASON_DATES", "item.competition", "Dates must be real, ordered dates within the reviewed July-to-June season. Exceptions require a future explicit rule.");
  for (const [key, evidence] of Object.entries({ roster, race })) {
    if (evidence.sha256 !== source.sha256 || evidence.source_id !== source.id || evidence.source_url !== source.url) error("SOURCE_MISMATCH", `item.evidence.${key}`, "Evidence must refer to the submitted source ID, URL and PDF hash.");
  }
  if (roster.issues.length || roster.observation_count !== roster.observations.length) error("ROSTER_INCOMPLETE", "item.evidence.roster", "Roster issues must be resolved and observation counts must match.");
  const expectedPeople = new Map<string, z.infer<typeof participant>>();
  const expectedEntries = roster.observations.map((o, index) => {
    const person = { id: `${c.id}:${o.bib}`, bib: o.bib, name: o.name, affiliation: o.affiliation_raw };
    if (expectedPeople.has(o.bib) && !same(expectedPeople.get(o.bib), person)) error("BIB_CONFLICT", `item.evidence.roster.observations.${index}`, "One competition bib identifies conflicting people or affiliations.");
    expectedPeople.set(o.bib, person);
    if (o.page > roster.page_count) error("SOURCE_PAGE", `item.evidence.roster.observations.${index}`, "Roster page is outside the PDF.");
    return { id: `${person.id}:${index}`, participantId: person.id, division: o.division_raw, ageStatus: o.age_status_raw, rawName: o.raw_name, sourcePage: o.page };
  });
  if (roster.distinct_bib_count !== expectedPeople.size || !same(participants, [...expectedPeople.values()]) || !same(entries, expectedEntries)) error("ROSTER_MAPPING", "item.participants", "Participants and entries must exactly preserve the parsed roster, including repeated entries.");
  const event = /^(.+?) (\d+) (Quarter-Finals|Semi-Finals|Finals) Event #(\d+)$/.exec(race.event_label_raw);
  if (!event || event[4] !== race.event_number) error("EVENT_LABEL", "item.evidence.race", "The source event label must identify one group, distance, round and event number.");
  const expectedResults = race.results.map((r, index) => {
    const p = expectedPeople.get(r.bib);
    if (!p || p.name !== r.name_raw || p.affiliation !== r.affiliation_raw) error("RESULT_IDENTITY", `item.evidence.race.results.${index}`, "The result must match the roster bib, name and affiliation.");
    if (r.time_raw === null ? r.time_microseconds !== null : micros(r.time_raw) === null || micros(r.time_raw) !== r.time_microseconds) error("TIME_PRECISION", `item.evidence.race.results.${index}`, "A recorded time must match exact integer microseconds; absent times must remain null.");
    if (r.status_raw === null && (r.rank === null || r.time_raw === null)) error("FINISH_FIELDS", `item.evidence.race.results.${index}`, "A result without an official status requires a place and recorded time.");
    const rowStatuses: string[] = r.row_raw.match(/\b(?:PEN|DNS|DNF|DQ)\b/g) ?? [];
    if (rowStatuses.some(code => code !== r.status_raw) || r.status_raw !== null && !rowStatuses.includes(r.status_raw)) error("STATUS_MAPPING", `item.evidence.race.results.${index}`, "The official status must be preserved from the source row.");
    if (r.qualification_raw && /\b(?:PEN|DNS|DNF|DQ)\b/.test(r.qualification_raw)) error("STATUS_MAPPING", `item.evidence.race.results.${index}`, "Official statuses must be recorded separately from qualification markers.");
    if (!race.pages.includes(r.source_page) || r.source_page > roster.page_count) error("SOURCE_PAGE", `item.evidence.race.results.${index}`, "Result page must be selected and inside the PDF.");
    if (!event || r.group_label !== event[1] || r.distance_metres !== Number(event[2]) || r.round_raw !== event[3] || r.event_number !== event[4] || r.event_label_raw !== race.event_label_raw) error("EVENT_MIX", `item.evidence.race.results.${index}`, "Different groups, genders, distances, rounds or source events cannot be combined.");
    return { id: `${c.id}:${r.race_id}:${r.bib}`, participantId: `${c.id}:${r.bib}`, raceId: r.race_id, distance: r.distance_metres, round: r.round_raw, rank: r.rank, status: r.status_raw, timeRaw: r.time_raw, timeMicroseconds: r.time_microseconds, qualification: r.qualification_raw, sourcePage: r.source_page, eventKey: hash(`${c.id}|${r.event_label_raw}`).slice(0, 20), eventLabel: r.event_label_raw, raceLabel: r.race_label_raw, heatNumber: r.heat_number, heatTotal: r.heat_total };
  });
  if (!same(results, expectedResults) || race.result_count !== results.length) error("RESULT_MAPPING", "item.results", "Results must exactly match every extracted source row.");
  if (new Set(results.map(r => r.id)).size !== results.length) error("DUPLICATE_RESULT", "item.results", "A skater cannot appear twice in one race.");
  const heatIds = new Set(race.heats.map(h => h.race_id));
  if (heatIds.size !== race.heats.length || race.heat_count !== race.heats.length || results.some(r => !heatIds.has(r.raceId))) error("HEAT_MAPPING", "item.evidence.race.heats", "Each declared race must occur exactly once and account for all results.");
  const numbered = race.heats.some(h => h.heat_number !== null || h.heat_total !== null);
  const totals = race.heats.map(h => h.heat_total);
  const numbers = race.heats.map(h => h.heat_number);
  if (numbered ? totals.some(t => t !== race.heats.length) || numbers.some((_, i) => !numbers.includes(i + 1)) : race.heats.length !== 1 || c.discipline === "short-track" && event?.[3] !== "Finals") error("MISSING_HEAT", "item.evidence.race.heats", "Every announced heat must be present, or one explicitly unnumbered final must be supplied.");
  for (const h of race.heats) {
    const rows = results.filter(r => r.raceId === h.race_id);
    if (rows.length !== h.result_count || rows.some(r => r.heatNumber !== h.heat_number || r.heatTotal !== h.heat_total || r.raceLabel !== h.label)) error("HEAT_ROWS", "item.evidence.race.heats", "Heat labels, counts and row membership must agree.");
    const heatLabel = /^Heat (\d+) of (\d+) Race #(\d+)$/.exec(h.label);
    if (numbered && (!heatLabel || Number(heatLabel[1]) !== h.heat_number || Number(heatLabel[2]) !== h.heat_total || heatLabel[3] !== h.race_id)) error("HEAT_LABEL", "item.evidence.race.heats", "Heat metadata must preserve the original heat label.");
  }
  report.counts = { participants: participants.length, entries: entries.length, results: results.length, heats: race.heats.length };
  report.warnings = [
    { code: "SELECTED_EVENT_ONLY", path: "coverage", message: "Only this selected event is covered. The whole competition has not been imported." },
    { code: "COMPETITION_LOCAL_IDENTITY", path: "item.participants", message: "Bibs identify people only within this competition. Cross-competition identity and skating age are not inferred." },
    { code: "OPERATOR_REVIEW", path: "review", message: "Metadata, season assignment and PDF extraction require the recorded operator review. Validation does not independently verify the original PDF." },
  ];
  report.valid = report.errors.length === 0;
  return { payload, report };
}
