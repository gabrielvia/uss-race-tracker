import scannedReviews from "@/lib/imports/reviewed-scanned-sources.json";
import speedProReviews from "@/lib/imports/reviewed-speedskating-pro-sources.json";
import { sourceEventKey } from "@/lib/imports/events";
import openScopes from "@/lib/imports/open-division-scopes.json";
import lt2025Scopes from "@/lib/imports/long-track-2025-scopes.json";

export const SCANNED_DIMENSION_VERSION = "single-distance-dimensions/1";
export const SPEED_PRO_DIMENSION_VERSION = "speedskating-pro-dimensions/1";
export const OPEN_DIMENSION_VERSION = "tempus-open-dimensions/1";
export const DIMENSION_VERSION = "tempus-agn-dimensions/1";
export const MASA_DIMENSION_VERSION = "tempus-masa-dimensions/1";
export const LT2025_DIMENSION_VERSION = "tempus-lt-agn-2025-dimensions/1";
const masaHash = "2671f997837bdc170dfc1fc995fbe9431ea30df968678e51e62d350a72440ae2";
const scannedGroups = ["Men", "Women", "Mixed"];
const masaDivisions = ["DeClemente", "Heo", "Kim", "Letai", "NEST MEN", "NEST WOMEN", "Santos", "Stoddard"];
const reviewedSources = new Set([
  "96baa4cc09283058cc4a458f6ced92316f2b029fa5b7d3cf75d6f371f848744f",
  "7a22b0b5b4713fae920d83e4ee500d40cee3aca58e23d3b895c774e1a88db45f",
]);
type Item = {
  competition: { id: string }; source: { sha256: string };
  entries: { id: string; participantId: string; division: string; sourcePage: number }[];
  participants: { id: string; bib: string }[];
  results: { id: string; participantId: string; eventKey: string }[];
  evidence: { roster: { observations: { bib: string; division_raw: string; gender?: unknown; page: number }[] }; events?: Event[]; race?: Event };
};
type Event = { parser_version?:string; event_number?:string; event_label_raw: string; pages?: number[]; results: { group_label: string; source_page: number }[] };
export type EntryDimension = { id: string; gender: string; division: string; page: number };
export type EventDimension = { id: string; gender: string; division: string; competitionGroup: string | null; rawDivision: string | null; pages: number[]; status: string };
export type ResultDimension = { id: string; entryId: string | null; gender: string; division: string; status: string };
export type Dimensions = { version: typeof DIMENSION_VERSION | typeof MASA_DIMENSION_VERSION | typeof LT2025_DIMENSION_VERSION | typeof SCANNED_DIMENSION_VERSION | typeof SPEED_PRO_DIMENSION_VERSION | typeof OPEN_DIMENSION_VERSION; entries: EntryDimension[]; events: EventDimension[]; results: ResultDimension[] };

// This vocabulary is reviewed against the two hash-pinned AGN protocols. Unknown
// headings stay unresolved; a matching name, age or performance is never evidence.
export function dimensions(item: Item): Dimensions {
  const scanned = scannedReviews.sources.some(s=>s.sha256===item.source.sha256);
  const speedPro = speedProReviews.sources.some((s:{sha256:string})=>s.sha256===item.source.sha256);
  const open = openScopes.sources.find(s=>s.sha256===item.source.sha256);
  const reviewed = reviewedSources.has(item.source.sha256);
  const masa = item.source.sha256 === masaHash;
  const lt2025 = item.source.sha256 === lt2025Scopes.sha256;
  const people = new Map(item.participants.map(p => [p.id, p.bib || p.id.split(":").at(-1)]));
  const entries = item.entries.map(e => {
    const o = item.evidence.roster.observations.find(o => o.bib === people.get(e.participantId) && o.division_raw === e.division && o.page === e.sourcePage);
    const gender = o?.gender === "Female" ? "Women" : o?.gender === "Male" ? "Men" : "Unknown";
    const match = /^(Junior [CDE]|Junior A-B-Senior|Combined|Master) (Men|Women)$/.exec(e.division);
    const division = open ? open.entries.find(s=>s.raw===e.division&&(s.gender===gender||s.gender==="Mixed"))?.division??"Unknown" : speedPro ? e.division : scanned && scannedGroups.includes(e.division) ? e.division : lt2025 ? lt2025Scopes.entries.find(s => s.raw === e.division)?.division ?? "Unknown" : masa && masaDivisions.includes(e.division) ? e.division : reviewed ? match?.[1] ?? (/^Group [12] Master$/.test(e.division) ? e.division : "Unknown") : "Unknown";
    return { id: e.id, gender, division, page: e.sourcePage };
  });
  const events = (item.evidence.events ?? (item.evidence.race ? [item.evidence.race] : [])).map(e => {
    const raw = e.results[0]?.group_label ?? "";
    const prefix = /^(Group [AB]) (.+)$/.exec(raw), group = prefix?.[2] ?? raw;
    const match = /^(Junior [CDE]|Junior A-B-Senior|Combined|Master) (Women's|Men's)$/.exec(group);
    const mixed = /^(Group [12] Master)'s$/.exec(group);
    const known = reviewed && !!(match || mixed);
    const masaDivision = masa ? masaDivisions.find(d => group === d + (d === "Santos" ? "'" : "'s")) : undefined;
    const scannedGroup = scanned && scannedGroups.includes(group) ? group : undefined;
    const historical = lt2025 ? lt2025Scopes.events.find(s => s.group === group) : undefined;
    const openGroup=open?.entries.find(s=>s.eventGroup===group);
    const speedGroup = speedPro && item.entries.some(e=>e.division===raw) ? raw : undefined;
    const speedGenders = new Set(entries.filter(en=>item.entries.find(x=>x.id===en.id)?.division===raw).map(en=>en.gender));
    const speedGender = speedGroup ? speedGenders.size===1 ? [...speedGenders][0] : "Mixed" : undefined;
    return { id: sourceEventKey(item.competition.id,e),
      gender: openGroup?.gender ?? speedGender ?? scannedGroup ?? historical?.gender ?? (masaDivision ? masaDivision === "NEST MEN" ? "Men" : masaDivision === "NEST WOMEN" ? "Women" : "Mixed" : known ? match ? match[2] === "Women's" ? "Women" : "Men" : "Mixed" : "Unknown"),
      division: openGroup?.division ?? speedGroup ?? scannedGroup ?? historical?.division ?? masaDivision ?? (known ? match?.[1] ?? mixed![1] : "Unknown"), competitionGroup: prefix?.[1] ?? null,
      rawDivision: openGroup?.raw ?? speedGroup ?? scannedGroup ?? historical?.rawDivision ?? masaDivision ?? (known ? match ? `${match[1]} ${match[2] === "Women's" ? "Women" : "Men"}` : mixed![1] : null),
      pages: [...new Set(e.results.map(r => r.source_page))].sort((a,b) => a-b), status: openGroup || speedGroup || scannedGroup || known || masaDivision || historical ? "source-mapped" : "needs-review" };
  });
  const eventMap = new Map(events.map(e => [e.id, e])), entryMap = new Map(entries.map(e => [e.id, e]));
  const results = item.results.map(r => {
    const event = eventMap.get(r.eventKey);
    const candidates = item.entries.filter(e => e.participantId === r.participantId && event &&
      (e.division === event.rawDivision || scanned && event.rawDivision === "Mixed") &&
      (event.gender === "Mixed" || entryMap.get(e.id)?.gender === event.gender));
    const entry = candidates.length === 1 ? entryMap.get(candidates[0].id) : undefined;
    return { id: r.id, entryId: entry?.id ?? null, gender: entry?.gender ?? "Unknown", division: entry?.division ?? "Unknown", status: entry ? "source-mapped" : "needs-review" };
  });
  return { version: open ? OPEN_DIMENSION_VERSION : speedPro ? SPEED_PRO_DIMENSION_VERSION : scanned ? SCANNED_DIMENSION_VERSION : lt2025 ? LT2025_DIMENSION_VERSION : masa ? MASA_DIMENSION_VERSION : DIMENSION_VERSION, entries, events, results };
}
