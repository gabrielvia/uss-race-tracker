import { createHash } from "node:crypto";
import { z } from "zod";
import { COMPETITION_ID } from "@/lib/competition-id";
import { resultNameMatches, rosterNameIsConsistent } from "@/lib/imports/identity";

export const VALIDATION_VERSION = "competition-events/6";
const label = z.string().min(1).max(300).refine(value => value.trim().length > 0, "A nonblank value is required.");
const id = z.string().regex(/^[a-zA-Z0-9:_-]{1,180}$/);
const positive = z.number().int().positive().max(1_000_000_000);
const page = positive.max(5000);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const nullableLabel = label.nullable();
const resultStatus = z.enum(["PEN", "DNS", "DNF", "DQ", "FNT", "YC"]).nullable();
const observation = z.object({
  bib: label, name: label, affiliation_raw: label, division_raw: label,
  age_status_raw: nullableLabel, raw_name: label, page,
}).passthrough();
const rawResult = z.object({
  finish_note: z.literal("Time not recorded in source.").optional(),
  rank: positive.nullable(), status_raw: resultStatus, row_raw: z.string().min(1).max(2000), bib: label, name_raw: label, affiliation_raw: label,
  time_raw: nullableLabel, time_microseconds: positive.nullable(), qualification_raw: nullableLabel,
  event_label_raw: label, event_number: label, distance_metres: positive,
  round_raw: label, race_id: id, race_label_raw: label, source_page: page,
  group_label: label, heat_number: positive.nullable(), heat_total: positive.nullable(),
}).passthrough();
const participant = z.object({ id, bib: label, name: label, affiliation: label }).strict();
const entry = z.object({ id, participantId: id, division: label, ageStatus: nullableLabel, rawName: label, sourcePage: page }).strict();
const protocolContract = z.object({
  parser_version: z.literal("tempus-protocol-batch/0.1"), sha256: digest,
  scanned_pages: z.array(page).min(1).max(5000), event_labels: z.array(label).min(1).max(250),
  roster_verification:z.object({pages:z.array(page).min(1).max(1000),observation_count:positive,exact_rows:z.literal(true)}).strict(),
  classification_pages: z.array(page).max(1000),
  complete_results: z.literal(true), result_count: positive,
  classifications: z.array(z.object({ page, kind: z.enum(["overall", "distance", "other"]), label,
    text_raw: z.string().min(1).max(100000), rows: z.array(z.object({ rank: z.number().int().min(0).max(1000000).nullable(), bib: nullableLabel, row_raw: z.string().min(1).max(2000) }).strict()).max(2000),
  }).strict()).max(1000),
  issues: z.array(z.object({ code: label, page: page.nullable(), message: z.string().max(2000) }).strict()).max(1000),
}).strict();
const result = z.object({
  id, participantId: id, raceId: id, distance: positive, round: label,
  finishNote: z.literal("Time not recorded in source.").optional(),
  rank: positive.nullable(), status: resultStatus, timeRaw: nullableLabel, timeMicroseconds: positive.nullable(), qualification: nullableLabel,
  sourcePage: page, eventKey: id, eventLabel: label, raceLabel: label,
  heatNumber: positive.nullable(), heatTotal: positive.nullable(),
}).strict();
const singleContract = z.object({
  schemaVersion: z.literal(2), coverage: z.literal("selected-event"),
  baseBatchId: digest.nullable(),
  review: z.object({ reviewer: label, seasonSourceLabel: label, notes: label, confirmed: z.literal(true),
    reconciliation: z.object({removedEventKeys:z.array(z.string().regex(/^[a-f0-9]{20}$/)).min(1).max(250),reason:label,confirmed:z.literal(true)}).strict().optional(),
  }).strict(),
  item: z.object({
    source: z.object({ id: z.string().regex(/^[a-f0-9]{16}$/), url: z.string().url().max(2000), sha256: digest }).strict(),
    competition: z.object({
      id: z.string().regex(COMPETITION_ID), title: label,
      discipline: z.enum(["short-track", "long-track"]), season: z.string().regex(/^20\d{2}-20\d{2}$/),
      startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), location: label,
    }).strict(),
    participants: z.array(participant).min(1).max(1000), entries: z.array(entry).min(1).max(2000),
    results: z.array(result).min(1).max(5000),
    evidence: z.object({
      roster: z.object({
        parser_version: z.literal("tempus-roster-sample/0.1"), source_id: label, source_url: label, sha256: digest,
        page_count: page, observation_count: positive, distinct_bib_count: positive,
        issues: z.array(z.unknown()).max(100), observations: z.array(observation).min(1).max(2000),
      }).passthrough(),
      race: z.object({
        parser_version: z.enum(["tempus-complete-event/0.2", "tempus-complete-event/0.3", "tempus-complete-event/0.4"]), status: z.literal("complete_selected_event"),
        source_heading_lines: z.tuple([label, z.literal("Finals")]).optional(),
        source_id: label, source_url: label, sha256: digest, pages: z.array(page).min(1).max(100),
        event_number: label, event_label_raw: label, heat_count: positive, result_count: positive,
        heats: z.array(z.object({ race_id: id, label, heat_number: positive.nullable(), heat_total: positive.nullable(), result_count: positive }).strict()).min(1).max(100),
        results: z.array(rawResult).min(1).max(5000),
      }).passthrough(),
    }).strict(),
  }).strict(),
}).strict();
const multiContract = singleContract.extend({
  schemaVersion: z.literal(3), coverage: z.literal("selected-events"),
  item: singleContract.shape.item.extend({
    protocol: protocolContract.optional(),
    evidence: z.object({
      roster: singleContract.shape.item.shape.evidence.shape.roster,
      events: z.array(singleContract.shape.item.shape.evidence.shape.race).min(1).max(250),
    }).strict(),
  }),
});
export type SingleEventPayload = z.infer<typeof singleContract>;
export type ImportPayload = SingleEventPayload | z.infer<typeof multiContract>;
export type Issue = { code: string; path: string; message: string };
export type ValidationReport = {
  ageChecks?: {basis:string;checkedAt:string;referenceSeason:string;ruleRevision:string|null;checkedSkaters:number;conflicts:{skaterId:string;participantKeys:string[]}[];identityReview:string[];unresolvedCategories:string[]};
  validationVersion: string; valid: boolean; errors: Issue[]; warnings: Issue[];
  counts?: { participants: number; entries: number; results: number; heats: number; events?: number };
  coverage: "selected-event" | "selected-events" | "protocol-results";
  events?: { eventKey: string; sourceEventNumber: string; label: string; valid: boolean; resultCount: number; heatCount: number; errors: Issue[] }[];
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
function validateSingle(value: unknown): { payload?: SingleEventPayload; report: ValidationReport } {
  const report: ValidationReport = { validationVersion: VALIDATION_VERSION, valid: false, errors: [], warnings: [], coverage: "selected-event" };
  const parsed = singleContract.safeParse(value);
  if (!parsed.success) {
    report.errors = parsed.error.issues.slice(0, 100).map(i => ({ code: "SCHEMA", path: i.path.join("."), message: i.message }));
    return { report };
  }
  const payload = parsed.data;
  const { competition: c, source, participants, entries, results, evidence: { roster, race } } = payload.item;
  const error = (code: string, path: string, message: string) => { if (report.errors.length < 100) report.errors.push({ code, path, message }); };
  const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);
  if (payload.review.reconciliation && (!payload.baseBatchId || new Set(payload.review.reconciliation.removedEventKeys).size !== payload.review.reconciliation.removedEventKeys.length)) error("RECONCILIATION", "review.reconciliation", "A reconciliation requires the current base batch and unique explicitly removed event keys.");
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
    if (!rosterNameIsConsistent(o)) error("ROSTER_NAME", `item.evidence.roster.observations.${index}`, "A normalized name must preserve the roster name or remove only a supported, evidenced age annotation.");
    if (o.page > roster.page_count) error("SOURCE_PAGE", `item.evidence.roster.observations.${index}`, "Roster page is outside the PDF.");
    return { id: `${person.id}:${index}`, participantId: person.id, division: o.division_raw, ageStatus: o.age_status_raw, rawName: o.raw_name, sourcePage: o.page };
  });
  if (roster.distinct_bib_count !== expectedPeople.size || !same(participants, [...expectedPeople.values()]) || !same(entries, expectedEntries)) error("ROSTER_MAPPING", "item.participants", "Participants and entries must exactly preserve the parsed roster, including repeated entries.");
  const event = /^(.+?) (\d+) (Quarter-Finals|Semi-Finals|Finals) Event #(\d+)$/.exec(race.event_label_raw);
  if (race.source_heading_lines && (race.parser_version !== "tempus-complete-event/0.4" || !/ Semi- Event #\d+$/.test(race.source_heading_lines[0]) || race.source_heading_lines[0].replace(" Semi- Event #", " Semi-Finals Event #") !== race.event_label_raw)) error("EVENT_HEADING_SOURCE", "item.evidence.race.source_heading_lines", "A wrapped title may be rejoined only from the exact two original source lines.");
  if (!event || event[4] !== race.event_number) error("EVENT_LABEL", "item.evidence.race", "The source event label must identify one group, distance, round and event number.");
  const expectedResults = race.results.map((r, index) => {
    const p = expectedPeople.get(r.bib);
    const observations = roster.observations.filter(o => o.bib === r.bib);
    const nameMatches = observations.some(o => resultNameMatches(r.name_raw, o));
    if (!p || !nameMatches || p.affiliation !== r.affiliation_raw) error("RESULT_IDENTITY", `item.evidence.race.results.${index}`, "The result must match the roster bib, exact name or evidenced age annotation, and affiliation.");
    const prefixes = r.rank === null ? [r.bib, ...(r.status_raw ? [`${r.status_raw} ${r.bib}`] : [])] : [`${r.rank} ${r.bib}`];
    const sourceIdentity = `${r.name_raw} ${r.affiliation_raw}`;
    if (!prefixes.some(prefix => r.row_raw === `${prefix} ${sourceIdentity}` || r.row_raw.startsWith(`${prefix} ${sourceIdentity} `))) error("RESULT_NAME_SOURCE", `item.evidence.race.results.${index}`, "The result bib, name and affiliation must be preserved in the original source row.");
    if (r.finish_note && (race.parser_version !== "tempus-complete-event/0.4" || r.time_raw !== null || r.time_microseconds !== null || r.status_raw !== null || r.rank === null || r.row_raw !== `${r.rank} ${r.bib} ${sourceIdentity}`)) error("MISSING_FINISH_SOURCE", `item.evidence.race.results.${index}`, "A missing finish must be explicit and the original row must contain only its place, bib, name and affiliation.");
    if (r.time_raw === null ? r.time_microseconds !== null : micros(r.time_raw) === null || micros(r.time_raw) !== r.time_microseconds) error("TIME_PRECISION", `item.evidence.race.results.${index}`, "A recorded time must match exact integer microseconds; absent times must remain null.");
    if (r.status_raw === null && (r.rank === null || r.time_raw === null && !r.finish_note)) error("FINISH_FIELDS", `item.evidence.race.results.${index}`, "A result without an official status requires a place and recorded time.");
    const rowStatuses: string[] = r.row_raw.match(/\b(?:PEN|DNS|DNF|DQ|FNT|YC)\b/g) ?? [];
    if (rowStatuses.some(code => code !== r.status_raw) || r.status_raw !== null && !rowStatuses.includes(r.status_raw)) error("STATUS_MAPPING", `item.evidence.race.results.${index}`, "The official status must be preserved from the source row.");
    if (r.qualification_raw && /\b(?:PEN|DNS|DNF|DQ|FNT|YC)\b/.test(r.qualification_raw)) error("STATUS_MAPPING", `item.evidence.race.results.${index}`, "Official statuses must be recorded separately from qualification markers.");
    if (!race.pages.includes(r.source_page) || r.source_page > roster.page_count) error("SOURCE_PAGE", `item.evidence.race.results.${index}`, "Result page must be selected and inside the PDF.");
    if (!event || r.group_label !== event[1] || r.distance_metres !== Number(event[2]) || r.round_raw !== event[3] || r.event_number !== event[4] || r.event_label_raw !== race.event_label_raw) error("EVENT_MIX", `item.evidence.race.results.${index}`, "Different groups, genders, distances, rounds or source events cannot be combined.");
    return { id: `${c.id}:${r.race_id}:${r.bib}`, participantId: `${c.id}:${r.bib}`, raceId: r.race_id, distance: r.distance_metres, round: r.round_raw, rank: r.rank, status: r.status_raw, timeRaw: r.time_raw, timeMicroseconds: r.time_microseconds, qualification: r.qualification_raw, sourcePage: r.source_page, eventKey: hash(`${c.id}|${r.event_label_raw}`).slice(0, 20), eventLabel: r.event_label_raw, raceLabel: r.race_label_raw, heatNumber: r.heat_number, heatTotal: r.heat_total, ...(r.finish_note ? { finishNote: r.finish_note } : {}) };
  });
  if (!same(results, expectedResults) || race.result_count !== results.length) error("RESULT_MAPPING", "item.results", "Results must exactly match every extracted source row.");
  if (new Set(results.map(r => r.id)).size !== results.length) error("DUPLICATE_RESULT", "item.results", "A skater cannot appear twice in one race.");
  const heatIds = new Set(race.heats.map(h => h.race_id));
  if (heatIds.size !== race.heats.length || race.heat_count !== race.heats.length || results.some(r => !heatIds.has(r.raceId))) error("HEAT_MAPPING", "item.evidence.race.heats", "Each declared race must occur exactly once and account for all results.");
  const numbered = race.heats.some(h => h.heat_number !== null || h.heat_total !== null);
  const totals = race.heats.map(h => h.heat_total);
  const numbers = race.heats.map(h => h.heat_number);
  const tiers = race.heats.map(h => /^([A-Z]) Final Race #\d+$/.exec(h.label)?.[1]);
  const completeFinals = race.parser_version === "tempus-complete-event/0.4" && event?.[3] === "Finals" && [...tiers].sort().every((tier, i) => tier === String.fromCharCode(65 + i));
  if (numbered ? totals.some(t => t !== race.heats.length) || numbers.some((_, i) => !numbers.includes(i + 1)) : !completeFinals && (race.parser_version === "tempus-complete-event/0.4" || race.heats.length !== 1 || c.discipline === "short-track" && event?.[3] !== "Finals")) error("MISSING_HEAT", "item.evidence.race.heats", "Every announced heat must be present, or one explicitly unnumbered final must be supplied.");
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
  if (race.results.some(r => r.finish_note)) report.warnings.push({ code: "MISSING_FINISH_RETAINED", path: "item.evidence.race.results", message: "The source has a result without a finish time or status. Its original row is retained with an explicit missing-finish note." });
  if (race.results.some(r => r.status_raw === "FNT" || r.status_raw === "YC")) report.warnings.push({ code: "SOURCE_STATUS_RETAINED", path: "item.evidence.race.results", message: "FNT/YC codes are preserved verbatim; no finish time or expanded meaning is inferred." });
  if (payload.review.reconciliation) report.warnings.push({code:"EXPLICIT_COVERAGE_RECONCILIATION",path:"review.reconciliation",message:"The operator explicitly approved named source-event removals or replacements. Previous evidence and publication history remain retained."});
  report.valid = report.errors.length === 0;
  return { payload, report };
}


export function validate(value: unknown): { payload?: ImportPayload; report: ValidationReport } {
  if (!value || typeof value !== "object" || (value as { schemaVersion?: unknown }).schemaVersion !== 3) {
    const checked = validateSingle(value);
    if (checked.payload) {
      const event = checked.payload.item.evidence.race;
      checked.report.events = [{ eventKey: hash(`${checked.payload.item.competition.id}|${event.event_label_raw}`).slice(0, 20), sourceEventNumber: event.event_number, label: event.event_label_raw, valid: checked.report.valid, resultCount: event.results.length, heatCount: event.heats.length, errors: checked.report.errors }];
      if (checked.report.counts) checked.report.counts.events = 1;
    }
    return checked;
  }
  const report: ValidationReport = { validationVersion: VALIDATION_VERSION, valid: false, errors: [], warnings: [], coverage: "selected-events", events: [] };
  const parsed = multiContract.safeParse(value);
  if (!parsed.success) {
    report.errors = parsed.error.issues.slice(0, 100).map(i => ({ code: "SCHEMA", path: i.path.join("."), message: i.message }));
    return { report };
  }
  const payload = parsed.data;
  const { item } = payload;
  if (item.protocol) {
    const p = item.protocol;
    const count = item.evidence.roster.page_count;
    if(p.roster_verification.observation_count!==item.evidence.roster.observations.length||canonical([...p.roster_verification.pages].sort((a,b)=>a-b))!==canonical([...new Set(item.evidence.roster.observations.map(o=>o.page))].sort((a,b)=>a-b)))report.errors.push({code:"ROSTER_PROTOCOL_COVERAGE",path:"item.protocol.roster_verification",message:"The full-source roster audit must account for every supplied observation and roster page."});
    if (p.sha256 !== item.source.sha256 || p.issues.length || p.result_count !== item.results.length || p.scanned_pages.length !== count || new Set(p.scanned_pages).size !== count || p.scanned_pages.some(n => n > count) || canonical([...p.event_labels].sort()) !== canonical(item.evidence.events.map(e => e.event_label_raw).sort())) report.errors.push({ code: "PROTOCOL_COVERAGE", path: "item.protocol", message: "A complete RESULTS manifest must account for all physical pages and every declared event/result without unresolved extraction issues." });
    if (canonical([...p.classification_pages].sort((a,b)=>a-b)) !== canonical(p.classifications.map(c=>c.page).sort((a,b)=>a-b)) || new Set(p.classifications.map(c => c.page)).size !== p.classifications.length || p.classifications.some(c => c.page > count || !c.text_raw.toUpperCase().includes("CLASSIFICATION") || c.rows.some(r => !c.text_raw.split("\n").includes(r.row_raw) || (()=>{const m=/^(\d+|PEN|DNS|DNF|DQ|FNT|YC)\s+(\d+)\s+/.exec(r.row_raw);return !m||m[2]!==r.bib||r.rank!==(/^\d+$/.test(m[1])?Number(m[1]):null);})()))) report.errors.push({ code: "CLASSIFICATION_SOURCE", path: "item.protocol.classifications", message: "Classification pages and rows must preserve the original source text, separately from race results." });
  }
  const expectedResults: typeof item.results = [];
  const eventKeys = new Set<string>(), raceIds = new Set<string>();
  let heats = 0;
  const add = (code: string, path: string, message: string) => { if (report.errors.length < 100) report.errors.push({ code, path, message }); };
  for (const [index, event] of item.evidence.events.entries()) {
    const eventKey = hash(`${item.competition.id}|${event.event_label_raw}`).slice(0, 20);
    if (eventKeys.has(eventKey)) add("DUPLICATE_EVENT", `item.evidence.events.${index}`, "Each complete source event heading must occur exactly once; a number alone does not identify a group.");
    eventKeys.add(eventKey);
    for (const heat of event.heats) {
      if (raceIds.has(heat.race_id)) add("DUPLICATE_RACE", `item.evidence.events.${index}.heats`, "A source race ID cannot be reused across selected events in this parser contract.");
      raceIds.add(heat.race_id);
    }
    const rows = item.results.filter(r => r.eventKey === eventKey);
    const { protocol: _protocol, ...singleItem } = item;
    const checked = validateSingle({ ...payload, schemaVersion: 2, coverage: "selected-event", item: { ...singleItem, results: rows, evidence: { roster: item.evidence.roster, race: event } } });
    const errors = checked.report.errors.map(i => ({ ...i, path: i.path.replace("item.evidence.race", `item.evidence.events.${index}`) }));
    for (const issue of errors) add(issue.code, issue.path, issue.message);
    report.events!.push({ eventKey, sourceEventNumber: event.event_number, label: event.event_label_raw, valid: checked.report.valid, resultCount: event.results.length, heatCount: event.heats.length, errors });
    expectedResults.push(...rows);
    heats += event.heats.length;
    if (!report.warnings.length) report.warnings = checked.report.warnings.filter(i => i.code !== "SELECTED_EVENT_ONLY");
  }
  if (canonical(expectedResults) !== canonical(item.results)) add("EVENT_RESULT_MAPPING", "item.results", "Every result must belong to exactly one declared event, in declared event order.");
  if (new Set(item.results.map(r => r.id)).size !== item.results.length) add("DUPLICATE_RESULT", "item.results", "Result IDs must be unique across the competition.");
  if(item.protocol){
    report.coverage="protocol-results";
    report.warnings.unshift({code:"PROTOCOL_RESULTS_COVERAGE",path:"item.protocol",message:"Every numbered RESULTS event is covered. Classification pages are retained separately as source evidence; no official classification is recomputed."});
  }else report.warnings.unshift({ code: "SELECTED_EVENTS_ONLY", path: "coverage", message: "All declared events are checked, but the rest of the competition protocol has not been imported." });
  report.counts = { participants: item.participants.length, entries: item.entries.length, results: item.results.length, heats, events: item.evidence.events.length };
  report.valid = report.errors.length === 0;
  return { payload, report };
}
