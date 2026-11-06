import { createHash } from "node:crypto";
import { z } from "zod";
import { dimensions, DIMENSION_VERSION, MASA_DIMENSION_VERSION, LT2025_DIMENSION_VERSION, SCANNED_DIMENSION_VERSION, SPEED_PRO_DIMENSION_VERSION, OPEN_DIMENSION_VERSION } from "@/lib/imports/dimensions";
import { COMPETITION_ID } from "@/lib/competition-id";
import { resultNameMatches, rosterNameIsConsistent } from "@/lib/imports/identity";

import { validateSpeedPro } from "@/lib/imports/speedskating-pro";
import { joinedSourceHeading } from "@/lib/imports/source-heading";
import reviewedTables from "@/lib/imports/reviewed-source-tables.json";
import { sourceRaceKey, sourceRaceScope } from "@/lib/imports/events";
import reviewedEmptyRosters from "@/lib/imports/reviewed-empty-rosters.json";
import reviewedRaceScopes from "@/lib/imports/reviewed-race-scopes.json";
import reviewedFinalRaces from "@/lib/imports/reviewed-final-races.json";
import reviewedRosterFields from "@/lib/imports/reviewed-roster-fields.json";
import reviewedTempusLayouts from "@/lib/imports/reviewed-tempus-layouts.json";
import historicalScopes from "@/lib/imports/long-track-2025-scopes.json";
export const VALIDATION_VERSION = "competition-events/19";
import scannedReviews from "@/lib/imports/reviewed-scanned-sources.json";
const label = z.string().min(1).max(300).refine(value => value.trim().length > 0, "A nonblank value is required.");
const id = z.string().regex(/^[a-zA-Z0-9:_-]{1,180}$/);
const positive = z.number().int().positive().max(1_000_000_000);
const timeMicros = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const metres = z.number().positive().max(1_000_000_000);
const page = positive.max(5000);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const nullableLabel = label.nullable();
const resultStatus = z.enum(["PEN", "DNS", "DNF", "DQ", "FNT", "YC", "WDR"]).nullable();
const finishNote = z.enum(["Time not recorded in source.", "Printed time cannot be interpreted."]);
const observation = z.object({
  bib: label, name: label, affiliation_raw: label.or(z.literal("")), division_raw: label,
  age_status_raw: nullableLabel, school_raw: nullableLabel.optional(), raw_name: label, page,
}).passthrough();
const rawResult = z.object({
  finish_note: finishNote.optional(),
  rank: positive.nullable(), status_raw: resultStatus, row_raw: z.string().min(1).max(2000), bib: label, name_raw: label, affiliation_raw: label.or(z.literal("")),
  time_raw: nullableLabel, time_microseconds: timeMicros.nullable(), qualification_raw: nullableLabel,
  event_label_raw: label, event_number: label, distance_metres: metres.nullable(),
  round_raw: label, race_id: id, race_label_raw: label, source_page: page,
  distance_laps: positive.optional(), distance_unit: z.enum(["metres","laps"]).optional(), event_kind: z.enum(["individual","mass-start"]).optional(),
  country_raw: label.optional(), lane_raw: nullableLabel.optional(), points_raw: nullableLabel.optional(), behind_raw: nullableLabel.optional(), source_fields: z.record(z.string(),z.string().nullable()).optional(),
  group_label: label, heat_number: positive.nullable(), heat_total: positive.nullable(),
}).passthrough();
const participant = z.object({ id, bib: label.or(z.literal("")), name: label, affiliation: label.or(z.literal("")), country: label.optional() }).strict();
const entry = z.object({ id, participantId: id, division: label, ageStatus: nullableLabel, rawName: label, sourcePage: page }).strict();
const protocolContract = z.object({
  parser_version: z.enum(["tempus-protocol-batch/0.1", "tempus-protocol-batch/0.2", "tempus-protocol-batch/0.3", "tempus-protocol-batch/0.4", "reviewed-scanned-protocol/1", "reviewed-group-table-protocol/1", "reviewed-speedskating-pro-protocol/1"]), sha256: digest,
  supplementary_pages: z.array(z.object({page,kind:z.enum(["team-results","team-roster","club-standings","school-standings","competition-standings","infringement-report"]),label,text_raw:z.string().min(1).max(100000),distance_metres:metres.optional()}).strict()).max(100).optional(),
  empty_roster_pages: z.array(z.object({page, text_raw: z.string().min(1).max(2000)}).strict()).max(10).optional(),
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
  id, participantId: id, raceId: id, distance: metres, round: label,
  distanceUnit:z.enum(["metres","laps"]).optional(),eventKind:z.enum(["individual","mass-start"]).optional(),country:label.optional(),sourceNameRaw:label.optional(),lane:nullableLabel.optional(),pointsRaw:nullableLabel.optional(),behindRaw:nullableLabel.optional(),sourceFields:z.record(z.string(),z.string().nullable()).optional(),
  finishNote: finishNote.optional(),
  rank: positive.nullable(), status: resultStatus, timeRaw: nullableLabel, timeMicroseconds: timeMicros.nullable(), qualification: nullableLabel,
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
        parser_version: z.enum(["tempus-roster-sample/0.1","reviewed-scanned-roster/1", "reviewed-group-table-roster/1", "reviewed-speedskating-pro-roster/1"]), source_id: label, source_url: label, sha256: digest,
        page_count: page, observation_count: positive, distinct_bib_count: positive,
        roster_pages: z.array(page).min(1).max(1000).optional(),
        issues: z.array(z.unknown()).max(100), observations: z.array(observation).min(1).max(2000),
      }).passthrough(),
      race: z.object({
        parser_version: z.enum(["tempus-complete-event/0.2", "tempus-complete-event/0.3", "tempus-complete-event/0.4", "tempus-complete-event/0.5", "tempus-complete-event/0.6", "tempus-complete-event/0.7", "reviewed-scanned-event/1", "reviewed-group-table-event/1", "reviewed-speedskating-pro-event/1"]), status: z.literal("complete_selected_event"),
        source_heading_lines: z.tuple([label, label]).optional(),
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
    dimensions: z.object({version:z.enum([DIMENSION_VERSION,MASA_DIMENSION_VERSION,LT2025_DIMENSION_VERSION,SCANNED_DIMENSION_VERSION,SPEED_PRO_DIMENSION_VERSION,OPEN_DIMENSION_VERSION]),entries:z.array(z.object({id,gender:label,division:label,page}).strict()).max(2000),events:z.array(z.object({id,gender:label,division:label,competitionGroup:nullableLabel,rawDivision:nullableLabel,pages:z.array(page),status:label}).strict()).max(250),results:z.array(z.object({id,entryId:id.nullable(),gender:label,division:label,status:label}).strict()).max(5000)}).strict().optional(),
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
function validateSingle(value: unknown, allowBlankAffiliation = false): { payload?: SingleEventPayload; report: ValidationReport } {
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
  const hasBlankAffiliation = participants.some(p => !p.affiliation.trim()) || race.results.some(r => !r.affiliation_raw.trim());
  if (roster.parser_version !== "tempus-roster-sample/0.1" || !allowBlankAffiliation && hasBlankAffiliation || participants.some(p => p.country) || race.results.some(r => r.distance_laps || r.distance_unit || r.event_kind || r.country_raw)) error("FORMAT_CONTRACT", "item", "Use the applicable reviewed contract for source fields, scanned timing protocols and lap-count events.");
  const expectedPeople = new Map<string, z.infer<typeof participant>>();
  const rosterFields = reviewedRosterFields.sources.find(rule => rule.sha256 === source.sha256);
  const sourceLayout = reviewedTempusLayouts.sources.find(rule => rule.sha256 === source.sha256);
  const expectedEntries = roster.observations.map((o, index) => {
    const affiliation = rosterFields?.affiliations.find(rule => rule.bib === o.bib && rule.name === o.raw_name && rule.page === o.page && rule.rosterValue === o.affiliation_raw);
    const person = { id: `${c.id}:${o.bib}`, bib: o.bib, name: o.name, affiliation: affiliation?.resultValue ?? o.affiliation_raw };
    if (rosterFields?.statusColumn === "school" && (o.age_status_raw !== null || o.school_raw === undefined)) error("ROSTER_STATUS_COLUMN", `item.evidence.roster.observations.${index}`, "Preserve the school in the source Status column separately from age categories.");
    if (expectedPeople.has(o.bib) && !same(expectedPeople.get(o.bib), person)) error("BIB_CONFLICT", `item.evidence.roster.observations.${index}`, "One competition bib identifies conflicting people or affiliations.");
    expectedPeople.set(o.bib, person);
    if (!rosterNameIsConsistent(o)) error("ROSTER_NAME", `item.evidence.roster.observations.${index}`, "A normalized name must preserve the roster name or remove only a supported, evidenced age annotation.");
    if (o.page > roster.page_count) error("SOURCE_PAGE", `item.evidence.roster.observations.${index}`, "Roster page is outside the PDF.");
    return { id: `${person.id}:${index}`, participantId: person.id, division: o.division_raw, ageStatus: o.age_status_raw, rawName: o.raw_name, sourcePage: o.page };
  });
  if (roster.distinct_bib_count !== expectedPeople.size || !same(participants, [...expectedPeople.values()]) || !same(entries, expectedEntries)) error("ROSTER_MAPPING", "item.participants", "Participants and entries must exactly preserve the parsed roster, including repeated entries.");
  const event = (race.parser_version === "tempus-complete-event/0.7" ? /^(.+?) (\d+)(?: \(#[2-4]\))? (Heats|Quarter-Finals|Semi-Finals|Finals|Super Final Finals) Event #(\d+)$/ : ["tempus-complete-event/0.5", "tempus-complete-event/0.6", "tempus-complete-event/0.7"].includes(race.parser_version) ? /^(.+?) (\d+)(?: \(#2\))? (Quarter-Finals|Semi-Finals|Finals|Super Final Finals) Event #(\d+)$/ : /^(.+?) (\d+) (Quarter-Finals|Semi-Finals|Finals) Event #(\d+)$/).exec(race.event_label_raw);
  const pinnedHeading = source.sha256 === historicalScopes.sha256 ? historicalScopes.wrappedHeadings.find(h => h.label === race.event_label_raw) : undefined;
  if (pinnedHeading && canonical(race.source_heading_lines) !== canonical(pinnedHeading.lines) || sourceLayout?.separateEventHeading && !race.source_heading_lines) error("EVENT_HEADING_SOURCE", "item.evidence.race.source_heading_lines", "The reviewed heading must retain both original source lines.");
  if (race.source_heading_lines) {
    const joined = joinedSourceHeading(race.source_heading_lines, sourceLayout?.separateEventHeading);
    const supported = ["tempus-complete-event/0.6","tempus-complete-event/0.7"].includes(race.parser_version) || ["tempus-complete-event/0.4", "tempus-complete-event/0.5"].includes(race.parser_version) && / Semi- Event #\d+$/.test(race.source_heading_lines[0]) && race.source_heading_lines[1] === "Finals";
    if (!supported || joined !== race.event_label_raw) error("EVENT_HEADING_SOURCE", "item.evidence.race.source_heading_lines", "A wrapped title must exactly rejoin its two original source lines under the supported parser.");
  }
  if (!event || event[4] !== race.event_number) error("EVENT_LABEL", "item.evidence.race", "The source event label must identify one group, distance, round and event number.");
  const expectedResults = race.results.map((r, index) => {
    const p = expectedPeople.get(r.bib);
    const observations = roster.observations.filter(o => o.bib === r.bib);
    const nameMatches = observations.some(o => resultNameMatches(r.name_raw, o));
    if (!p || !nameMatches || p.affiliation !== r.affiliation_raw) error("RESULT_IDENTITY", `item.evidence.race.results.${index}`, "The result must match the roster bib, exact name or evidenced age annotation, and affiliation.");
    const prefixes = r.rank === null ? [r.bib, ...(r.status_raw ? [`${r.status_raw} ${r.bib}`] : [])] : [`${r.rank} ${r.bib}`];
    const sourceIdentity = r.affiliation_raw ? `${r.name_raw} ${r.affiliation_raw}` : r.name_raw;
    if (!prefixes.some(prefix => r.row_raw === `${prefix} ${sourceIdentity}` || r.row_raw.startsWith(`${prefix} ${sourceIdentity} `))) error("RESULT_NAME_SOURCE", `item.evidence.race.results.${index}`, "The result bib, name and affiliation must be preserved in the original source row.");
    const untimedQualification = sourceLayout?.untimedQualifiedRows?.find(rule => rule.page === r.source_page && rule.row === r.row_raw)?.qualification;
    const untimedSourceRow = `${r.rank} ${r.bib} ${sourceIdentity}${untimedQualification ? ` ${untimedQualification}` : ""}`;
    if (r.finish_note && (!["tempus-complete-event/0.4", "tempus-complete-event/0.5", "tempus-complete-event/0.6", "tempus-complete-event/0.7"].includes(race.parser_version) || r.time_raw !== null || r.time_microseconds !== null || r.status_raw !== null || r.rank === null || r.row_raw !== untimedSourceRow || r.qualification_raw !== (untimedQualification ?? null))) error("MISSING_FINISH_SOURCE", `item.evidence.race.results.${index}`, "A missing finish must preserve the exact original row and any reviewed qualification marker.");
    if (r.time_raw === null ? r.time_microseconds !== null : micros(r.time_raw) === null || micros(r.time_raw) !== r.time_microseconds) error("TIME_PRECISION", `item.evidence.race.results.${index}`, "A recorded time must match exact integer microseconds; absent times must remain null.");
    if (r.status_raw === null && (r.rank === null || r.time_raw === null && !r.finish_note)) error("FINISH_FIELDS", `item.evidence.race.results.${index}`, "A result without an official status requires a place and recorded time.");
    const rowStatuses: string[] = r.row_raw.match(/\b(?:PEN|DNS|DNF|DQ|FNT|YC)\b/g) ?? [];
    if (rowStatuses.some(code => code !== r.status_raw) || r.status_raw !== null && !rowStatuses.includes(r.status_raw)) error("STATUS_MAPPING", `item.evidence.race.results.${index}`, "The official status must be preserved from the source row.");
    if (r.qualification_raw && /\b(?:PEN|DNS|DNF|DQ|FNT|YC)\b/.test(r.qualification_raw)) error("STATUS_MAPPING", `item.evidence.race.results.${index}`, "Official statuses must be recorded separately from qualification markers.");
    if (!race.pages.includes(r.source_page) || r.source_page > roster.page_count) error("SOURCE_PAGE", `item.evidence.race.results.${index}`, "Result page must be selected and inside the PDF.");
    if (!event || r.group_label !== event[1] || r.distance_metres !== Number(event[2]) || r.round_raw !== event[3] || r.event_number !== event[4] || r.event_label_raw !== race.event_label_raw) error("EVENT_MIX", `item.evidence.race.results.${index}`, "Different groups, genders, distances, rounds or source events cannot be combined.");
    return { id: `${c.id}:${sourceRaceKey(source.sha256, race.event_label_raw, r.race_id)}:${r.bib}`, participantId: `${c.id}:${r.bib}`, raceId: r.race_id, distance: r.distance_metres, round: r.round_raw, rank: r.rank, status: r.status_raw, timeRaw: r.time_raw, timeMicroseconds: r.time_microseconds, qualification: r.qualification_raw, sourcePage: r.source_page, eventKey: hash(`${c.id}|${r.event_label_raw}`).slice(0, 20), eventLabel: r.event_label_raw, raceLabel: r.race_label_raw, heatNumber: r.heat_number, heatTotal: r.heat_total, ...(r.finish_note ? { finishNote: r.finish_note } : {}) };
  });
  if (!same(results, expectedResults) || race.result_count !== results.length) error("RESULT_MAPPING", "item.results", "Results must exactly match every extracted source row.");
  if (new Set(results.map(r => r.id)).size !== results.length) error("DUPLICATE_RESULT", "item.results", "A skater cannot appear twice in one race.");
  const scope = sourceRaceScope(source.sha256, race.event_label_raw);
  if (scope && (race.heats.length !== 1 || race.heats[0].race_id !== scope.raceId || race.results.some(row => row.source_page !== scope.page))) error("REVIEWED_RACE_SCOPE", "item.evidence.race", "Preserve the reviewed section’s original race number and source page.");
  const heatIds = new Set(race.heats.map(h => h.race_id));
  if (heatIds.size !== race.heats.length || race.heat_count !== race.heats.length || results.some(r => !heatIds.has(r.raceId))) error("HEAT_MAPPING", "item.evidence.race.heats", "Each declared race must occur exactly once and account for all results.");
  const numbered = race.heats.some(h => h.heat_number !== null || h.heat_total !== null);
  const totals = race.heats.map(h => h.heat_total);
  const numbers = race.heats.map(h => h.heat_number);
  const tiers = race.heats.map(h => /^([A-Z]) Final Race #\d+$/.exec(h.label)?.[1]);
  const reviewedFinals = reviewedFinalRaces.find(rule => rule.sha256 === source.sha256 && rule.eventLabel === race.event_label_raw);
  const finalLabelsMatch = reviewedFinals
    ? same(race.heats.map(heat => [heat.race_id, heat.label]), reviewedFinals.races)
    : [...tiers].sort().every((tier, i) => tier === String.fromCharCode(65 + i));
  const completeFinals = ["tempus-complete-event/0.4", "tempus-complete-event/0.5", "tempus-complete-event/0.6", "tempus-complete-event/0.7"].includes(race.parser_version) && ["Finals", "Super Final Finals"].includes(event?.[3] ?? "") && finalLabelsMatch;
  if (reviewedFinals && (numbered || !completeFinals)) error("FINAL_RACE_SOURCE", "item.evidence.race.heats", "Preserve the original reviewed final race IDs, labels and order.");
  if (numbered ? totals.some(t => t !== race.heats.length) || numbers.some((_, i) => !numbers.includes(i + 1)) : !completeFinals && (["tempus-complete-event/0.4", "tempus-complete-event/0.5", "tempus-complete-event/0.6", "tempus-complete-event/0.7"].includes(race.parser_version) || race.heats.length !== 1 || c.discipline === "short-track" && event?.[3] !== "Finals")) error("MISSING_HEAT", "item.evidence.race.heats", "Every announced heat must be present, or one explicitly unnumbered final must be supplied.");
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
  if (item.protocol?.parser_version === "reviewed-speedskating-pro-protocol/1") return validateSpeedPro(payload);
  if (item.protocol?.parser_version === "reviewed-scanned-protocol/1" || item.protocol?.parser_version === "reviewed-group-table-protocol/1") return validateReviewedTiming(payload);
  const reviewedLayout = reviewedTempusLayouts.sources.find(source => source.sha256 === item.source.sha256);
  const reviewedDigest = reviewedLayout?.reviewedScannedItemSha256;
  const exactScannedItem = reviewedDigest !== undefined && reviewedDigest === hash(canonical(item));
  if (reviewedDigest && !exactScannedItem) {
    report.errors.push({ code: "SCANNED_SOURCE_REVIEW", path: "item", message: "The complete extraction must exactly match its reviewed PDF-bound item digest." });
  }
  if (item.protocol) {
    const p = item.protocol;
    const count = item.evidence.roster.page_count;
    const classificationRosterPages = reviewedLayout?.classificationRosterPages;
    if (classificationRosterPages) {
      const classifications = p.classifications.filter(table => classificationRosterPages.includes(table.page) && table.kind === "overall");
      const observations = classifications.flatMap(table => table.text_raw.split("\n").flatMap(line => {
        const row = /^\d+ (\d+) (.+?) (JR(?: [A-G])?|SR|\d+\+) (.+?) [\d,]+ \d+ \d+ \d+:\d{2}\.\d{3}$/.exec(line);
        return row ? [{bib: row[1], name: row[2], raw_name: row[2], age_status_raw: row[3], affiliation_raw: row[4], division_raw: table.text_raw.split("\n")[1], page: table.page, row_raw: line}] : [];
      }));
      const supplied = item.evidence.roster.observations.map(o => ({bib: o.bib, name: o.name, raw_name: o.raw_name, age_status_raw: o.age_status_raw, affiliation_raw: o.affiliation_raw, division_raw: o.division_raw, page: o.page, row_raw: o.row_raw}));
      if (canonical(classifications.map(table => table.page)) !== canonical(classificationRosterPages) || canonical(supplied) !== canonical(observations) || item.evidence.roster.observations.some(o => o.gender !== undefined)) report.errors.push({code:"CLASSIFICATION_ROSTER_ROWS",path:"item.evidence.roster",message:"Preserve each original overall classification entry and its source fields without inferring an individual gender."});
    }
    const supplementary = p.supplementary_pages ?? [];
    const expectedTables = reviewedTables.sources.find(source => source.sha256 === item.source.sha256)?.pages ?? [];
    if (canonical(supplementary) !== canonical(expectedTables) || supplementary.length && !["tempus-protocol-batch/0.3", "tempus-protocol-batch/0.4"].includes(p.parser_version)) report.errors.push({code:"SUPPLEMENTARY_SOURCE",path:"item.protocol.supplementary_pages",message:"Every reviewed team/club source page must retain its exact physical page, kind, label and original text under the reviewed PDF hash."});
    if (supplementary.some(table => table.page > count || p.classification_pages.includes(table.page) || item.evidence.events.some(event => event.pages.includes(table.page)) || p.roster_verification.pages.includes(table.page))) report.errors.push({code:"SUPPLEMENTARY_PAGE_SCOPE",path:"item.protocol.supplementary_pages",message:"Supplemental source tables cannot overlap individual results, rosters or classification pages."});
    const empty = p.empty_roster_pages ?? [];
    const expectedEmpty = reviewedEmptyRosters.find(rule => rule.sha256 === item.source.sha256)?.pages ?? [];
    if (canonical(empty) !== canonical(expectedEmpty) || empty.length && !["tempus-protocol-batch/0.2", "tempus-protocol-batch/0.4"].includes(p.parser_version) || empty.some(page => item.evidence.roster.observations.some(o => o.page === page.page))) report.errors.push({code:"EMPTY_ROSTER_SOURCE",path:"item.protocol.empty_roster_pages",message:"An empty roster page requires exact reviewed text, physical page and source hash, without supplied observations."});
    if (item.evidence.roster.roster_pages && canonical([...item.evidence.roster.roster_pages].sort((a,b)=>a-b)) !== canonical([...p.roster_verification.pages].sort((a,b)=>a-b))) report.errors.push({code:"ROSTER_PROTOCOL_COVERAGE",path:"item.protocol.roster_verification",message:"The roster page inventory must remain intact, including reviewed empty pages."});
    const extraRaces = reviewedRaceScopes.find(rule => rule.sha256 === item.source.sha256)?.events ?? [];
    if (extraRaces.some(rule => !item.evidence.events.some(event => event.event_label_raw === rule.label))) report.errors.push({code:"REVIEWED_RACE_SCOPE",path:"item.evidence.events",message:"The complete protocol must retain all reviewed race sections."});
    if(p.roster_verification.observation_count!==item.evidence.roster.observations.length||canonical([...p.roster_verification.pages].sort((a,b)=>a-b))!==canonical([...new Set([...item.evidence.roster.observations.map(o=>o.page),...empty.map(e=>e.page)])].sort((a,b)=>a-b)))report.errors.push({code:"ROSTER_PROTOCOL_COVERAGE",path:"item.protocol.roster_verification",message:"The full-source roster audit must account for every supplied observation and roster page."});
    if (p.sha256 !== item.source.sha256 || p.issues.length || p.result_count !== item.results.length || p.scanned_pages.length !== count || new Set(p.scanned_pages).size !== count || p.scanned_pages.some(n => n > count) || canonical([...p.event_labels].sort()) !== canonical(item.evidence.events.map(e => e.event_label_raw).sort())) report.errors.push({ code: "PROTOCOL_COVERAGE", path: "item.protocol", message: "A complete RESULTS manifest must account for all physical pages and every declared event/result without unresolved extraction issues." });
    const invalidClassification = p.classifications.some(classification => {
      const lines = classification.text_raw.split("\n");
      if (classification.page > count || !classification.text_raw.toUpperCase().includes("CLASSIFICATION")) return true;
      if (p.parser_version === "tempus-protocol-batch/0.4" && lines.some(line => /^Points # Name Affiliation (?:(?:Q )?S )?F Best$/.test(line))) {
        const expectedRows = lines.flatMap(line => {
          const match = /^(?:(\d+) [\d,]+|0) (\d+) .+$/.exec(line);
          return match ? [{rank: match[1] ? Number(match[1]) : null, bib: match[2], row_raw: line}] : [];
        });
        return canonical(classification.rows) !== canonical(expectedRows);
      }
      return classification.rows.some(row => {
        const match = /^(\d+|PEN|DNS|DNF|DQ|FNT|YC)\s+(\d+)\s+/.exec(row.row_raw);
        return !lines.includes(row.row_raw) || !match || match[2] !== row.bib || row.rank !== (/^\d+$/.test(match[1]) ? Number(match[1]) : null);
      });
    });
    if (canonical([...p.classification_pages].sort((a,b)=>a-b)) !== canonical(p.classifications.map(c=>c.page).sort((a,b)=>a-b)) || new Set(p.classifications.map(c => c.page)).size !== p.classifications.length || invalidClassification) report.errors.push({ code: "CLASSIFICATION_SOURCE", path: "item.protocol.classifications", message: "Classification pages and rows must preserve the original source text, separately from race results." });
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
      const raceKey = sourceRaceKey(item.source.sha256, event.event_label_raw, heat.race_id);
      if (raceIds.has(raceKey)) add("DUPLICATE_RACE", `item.evidence.events.${index}.heats`, "A source race ID cannot be reused across selected events in this parser contract.");
      raceIds.add(raceKey);
    }
    const rows = item.results.filter(r => r.eventKey === eventKey);
    const { protocol: _protocol, dimensions: _dimensions, ...singleItem } = item;
    const checked = validateSingle({ ...payload, schemaVersion: 2, coverage: "selected-event", item: { ...singleItem, results: rows, evidence: { roster: item.evidence.roster, race: event } } }, exactScannedItem);
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
  const mapped = dimensions(item);
  if (item.dimensions && canonical(item.dimensions) !== canonical(mapped)) add("DIMENSION_EVIDENCE", "item.dimensions", "Structured dimensions must exactly match the reviewed source headings and applicable roster entries.");
  const unresolved = mapped.results.filter(r => r.status === "needs-review").length;
  if (unresolved) report.warnings.push({code:"DIMENSION_REVIEW",path:"item.dimensions",message:`${unresolved} results have unresolved entry scope and remain explicitly Unknown.`});
  report.valid = report.errors.length === 0;
  return { payload, report };
}

// A reviewed timing protocol is accepted only after the whole extraction has been visually
// reviewed against one immutable PDF revision. The digest covers every item field.
function validateReviewedTiming(payload: z.infer<typeof multiContract>): {payload: ImportPayload; report: ValidationReport} {
 const item=payload.item, report:ValidationReport={validationVersion:VALIDATION_VERSION,valid:false,errors:[],warnings:[],coverage:"protocol-results",events:[]};
 const add=(code:string,message:string)=>report.errors.push({code,path:"item",message});
 const review=scannedReviews.sources.find(r=>r.sha256===item.source.sha256);
 const groupTable=item.protocol?.parser_version==="reviewed-group-table-protocol/1";
 const prefix=groupTable ? "reviewed-group-table" : "reviewed-scanned";
 if(!review || review.itemSha256!==hash(canonical(item)))add("SCANNED_SOURCE_REVIEW","The complete extraction must exactly match its reviewed PDF-bound item digest.");
 const roster=item.evidence.roster,protocol=item.protocol!;
 if(roster.parser_version!==`${prefix}-roster/1` || roster.issues.length || roster.observation_count!==roster.observations.length || roster.distinct_bib_count!==item.participants.length)add("SCANNED_ROSTER","Every source participant must have reviewed roster evidence.");
 const url=new URL(item.source.url),c=item.competition;
 if(url.protocol!=="https:" || url.username || url.password || !["assets.contentstack.io","www.usspeedskating.org","usspeedskating.org"].includes(url.hostname))add("SOURCE_URL","Use an official HTTPS source.");
 const [start,end]=c.season.split("-").map(Number);
 if(end!==start+1 || !validDate(c.startsOn) || !validDate(c.endsOn) || c.startsOn>c.endsOn || c.startsOn<`${start}-07-01` || c.endsOn>=`${end}-07-01`)add("SEASON_DATES","Use source-confirmed dates within the reviewed season.");
 if(canonical(protocol.scanned_pages)!==canonical(Array.from({length:roster.page_count},(_,i)=>i+1)) || protocol.result_count!==item.results.length || canonical(protocol.event_labels)!==canonical(item.evidence.events.map(e=>e.event_label_raw)))add("SCANNED_COVERAGE","Every physical page, original event and result must be accounted for.");
 if(new Set(item.participants.map(p=>p.id)).size!==item.participants.length || new Set(item.entries.map(e=>e.id)).size!==item.entries.length || new Set(item.results.map(r=>r.id)).size!==item.results.length)add("DUPLICATE_ID","Source IDs must be unique.");
 for(const evidence of [roster,...item.evidence.events])if(evidence.sha256!==item.source.sha256 || evidence.source_id!==item.source.id || evidence.source_url!==item.source.url)add("SOURCE_MISMATCH","All extraction evidence must identify the same PDF.");
 const mapped=dimensions(item),entries=new Map(item.entries.map(e=>[e.participantId,e]));
 const people = new Map(item.participants.map(p => [p.id, p]));
 if ((!groupTable && item.entries.length!==item.participants.length) ||
     item.entries.some(entry => !people.has(entry.participantId)) ||
     item.participants.some(p => !entries.has(p.id) || p.affiliation!=="" ||
       (groupTable ? p.bib!=="" || p.country!==undefined : p.id!==`${c.id}:${p.bib}` || !p.country))) {
   add("SCANNED_PARTICIPANTS", "Use the reviewed participants and preserve the source identifiers and country fields.");
 }
 if(mapped.results.some(r=>r.status!=="source-mapped") || item.dimensions && canonical(item.dimensions)!==canonical(mapped))add("DIMENSION_EVIDENCE","Every source row must resolve to exactly one reviewed source entry.");
 let offset=0,heats=0;
 for(const event of item.evidence.events){
  const rows=item.results.slice(offset,offset+event.result_count);offset+=event.result_count;heats+=event.heats.length;
  if(event.parser_version!==`${prefix}-event/1` || event.result_count!==event.results.length || event.heat_count!==event.heats.length || rows.length!==event.result_count)add("SCANNED_EVENT","Source event and original row counts must agree.");
  const eventKey=hash(`${c.id}|${event.event_label_raw}`).slice(0,20);
  event.results.forEach((raw,i)=>{
   const row=rows[i],person=people.get(`${c.id}:${raw.bib}`),lap=raw.distance_unit==="laps";
   const expected={id:`${c.id}:${raw.race_id}:${raw.bib}`,participantId:`${c.id}:${raw.bib}`,raceId:raw.race_id,distance:lap?raw.distance_laps:raw.distance_metres,distanceUnit:raw.distance_unit,eventKind:raw.event_kind,round:raw.round_raw,rank:raw.rank,status:raw.status_raw,timeRaw:raw.time_raw,timeMicroseconds:raw.time_microseconds,qualification:raw.qualification_raw,sourcePage:raw.source_page,eventKey,eventLabel:raw.event_label_raw,raceLabel:raw.race_label_raw,heatNumber:raw.heat_number,heatTotal:raw.heat_total,...(raw.country_raw===undefined?{}:{country:raw.country_raw}),sourceNameRaw:raw.name_raw,lane:raw.lane_raw,pointsRaw:raw.points_raw,behindRaw:raw.behind_raw,sourceFields:raw.source_fields,...(raw.finish_note?{finishNote:raw.finish_note}:{})};
   if(!person || canonical(row)!==canonical(expected) || !event.pages.includes(raw.source_page) || raw.source_page>roster.page_count || raw.event_label_raw!==event.event_label_raw || raw.event_number!==event.event_number)add("SCANNED_RESULT_MAPPING","Every normalized result must exactly preserve its original source row and physical page.");
   if(lap ? raw.event_kind!=="mass-start" || raw.distance_metres!==null || !raw.distance_laps : raw.event_kind!=="individual" || !raw.distance_metres || raw.distance_laps!==undefined)add("DISTANCE_UNIT","Keep lap-count mass-start events separate from metre distances.");
   if(raw.time_raw===null ? raw.time_microseconds!==null : officialMicros(raw.time_raw)!==raw.time_microseconds)add("TIME_PRECISION","Preserve the exact printed timing precision.");
   if(!raw.status_raw && ((!groupTable && raw.rank===null) || raw.time_raw===null && !raw.finish_note))add("FINISH_FIELDS","Missing source finishes need an explicit retained-source note.");
  });
  for(const heat of event.heats)if(rows.filter(r=>r.raceId===heat.race_id).length!==heat.result_count)add("HEAT_ROWS","Every declared source race group must account for its rows.");
  report.events!.push({eventKey,sourceEventNumber:event.event_number,label:event.event_label_raw,valid:true,resultCount:event.result_count,heatCount:event.heat_count,errors:[]});
 }
 if(offset!==item.results.length)add("SCANNED_COVERAGE","No extra or omitted individual source rows are allowed.");
 report.counts={participants:item.participants.length,entries:item.entries.length,results:item.results.length,events:item.evidence.events.length,heats};
 report.warnings=[{code:"REVIEWED_SCANNED_SOURCE",path:"item",message:"All official places and printed times are retained independently. OCR output requires whole-source visual review; countries are not club affiliations. No cross-competition identity or age rule is inferred."},{code:"LAP_COUNT_RESULTS",path:"item.results",message:"Mass-start results retain laps, places, times and other original source columns independently; they do not establish ordinary metre-distance PBs or trends."}];
 if (groupTable) report.warnings = [{code:"REVIEWED_GROUP_TABLE", path:"item", message:"Original group standings and distance columns are preserved. The results table provides overall places and individual times and points."}];
 report.valid=report.errors.length===0;return {payload,report};
}
export function officialMicros(raw:string):number|null {
 const marked=/^(.*\.\d{2})\((\d)\)$/.exec(raw);
 return micros(marked?marked[1]+marked[2]:raw);
}
