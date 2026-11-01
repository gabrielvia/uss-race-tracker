import { createHash } from "node:crypto";

export const DIMENSION_VERSION = "tempus-agn-dimensions/1";
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
type Event = { event_label_raw: string; pages?: number[]; results: { group_label: string; source_page: number }[] };
export type EntryDimension = { id: string; gender: string; division: string; page: number };
export type EventDimension = { id: string; gender: string; division: string; competitionGroup: string | null; rawDivision: string | null; pages: number[]; status: string };
export type ResultDimension = { id: string; entryId: string | null; gender: string; division: string; status: string };
export type Dimensions = { version: typeof DIMENSION_VERSION; entries: EntryDimension[]; events: EventDimension[]; results: ResultDimension[] };

// This vocabulary is reviewed against the two hash-pinned AGN protocols. Unknown
// headings stay unresolved; a matching name, age or performance is never evidence.
export function dimensions(item: Item): Dimensions {
  const reviewed = reviewedSources.has(item.source.sha256);
  const people = new Map(item.participants.map(p => [p.id, p.bib]));
  const entries = item.entries.map(e => {
    const o = item.evidence.roster.observations.find(o => o.bib === people.get(e.participantId) && o.division_raw === e.division && o.page === e.sourcePage);
    const gender = o?.gender === "Female" ? "Women" : o?.gender === "Male" ? "Men" : "Unknown";
    const match = /^(Junior [CDE]|Junior A-B-Senior|Combined|Master) (Men|Women)$/.exec(e.division);
    const division = reviewed ? match?.[1] ?? (/^Group [12] Master$/.test(e.division) ? e.division : "Unknown") : "Unknown";
    return { id: e.id, gender, division, page: e.sourcePage };
  });
  const events = (item.evidence.events ?? (item.evidence.race ? [item.evidence.race] : [])).map(e => {
    const raw = e.results[0]?.group_label ?? "";
    const prefix = /^(Group [AB]) (.+)$/.exec(raw), group = prefix?.[2] ?? raw;
    const match = /^(Junior [CDE]|Junior A-B-Senior|Combined|Master) (Women's|Men's)$/.exec(group);
    const mixed = /^(Group [12] Master)'s$/.exec(group);
    const known = reviewed && !!(match || mixed);
    return { id: createHash("sha256").update(`${item.competition.id}|${e.event_label_raw}`).digest("hex").slice(0, 20),
      gender: known ? match ? match[2] === "Women's" ? "Women" : "Men" : "Mixed" : "Unknown",
      division: known ? match?.[1] ?? mixed![1] : "Unknown", competitionGroup: prefix?.[1] ?? null,
      rawDivision: known ? match ? `${match[1]} ${match[2] === "Women's" ? "Women" : "Men"}` : mixed![1] : null,
      pages: [...new Set(e.results.map(r => r.source_page))].sort((a,b) => a-b), status: known ? "source-mapped" : "needs-review" };
  });
  const eventMap = new Map(events.map(e => [e.id, e])), entryMap = new Map(entries.map(e => [e.id, e]));
  const results = item.results.map(r => {
    const event = eventMap.get(r.eventKey);
    const candidates = item.entries.filter(e => e.participantId === r.participantId && e.division === event?.rawDivision && (event.gender === "Mixed" || entryMap.get(e.id)?.gender === event.gender));
    const entry = candidates.length === 1 ? entryMap.get(candidates[0].id) : undefined;
    return { id: r.id, entryId: entry?.id ?? null, gender: entry?.gender ?? "Unknown", division: entry?.division ?? "Unknown", status: entry ? "source-mapped" : "needs-review" };
  });
  return { version: DIMENSION_VERSION, entries, events, results };
}
