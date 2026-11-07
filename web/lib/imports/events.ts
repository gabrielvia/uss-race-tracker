import { createHash } from "node:crypto";
import reviewedRaceScopes from "@/lib/imports/reviewed-race-scopes.json";

export function sourceRaceScope(sourceHash: string, eventLabel: string) {
  const source = reviewedRaceScopes.find(rule => rule.sha256 === sourceHash);
  const event = source?.events.find(rule => rule.label === eventLabel);
  return source && event ? { ...event, prefix: source.prefix } : undefined;
}

export function sourceRaceKey(sourceHash: string, eventLabel: string, raceId: string) {
  const scope = sourceRaceScope(sourceHash, eventLabel);
  return scope ? `${scope.prefix}-${raceId}` : raceId;
}

type EventEvidence = {
  parser_version?: string; event_number: string; event_label_raw: string;
  results: { group_label: string; distance_metres: number | null; distance_laps?: number; distance_unit?: string; event_kind?: string; round_raw: string }[];
};
export function sourceEventKey(competitionId: string, event: {parser_version?: string; event_number?: string; event_label_raw: string}) {
  const occurrence = event.parser_version === "reviewed-speedskating-pro-event/1" ? `|${event.event_number}` : "";
  return createHash("sha256").update(`${competitionId}|${event.event_label_raw}${occurrence}`).digest("hex").slice(0,20);
}
export function eventDefinitions(item: { competition: { id: string }; evidence: { race?: EventEvidence; events?: EventEvidence[] } }) {
  const events = item.evidence.events ?? (item.evidence.race ? [item.evidence.race] : []);
  return events.map(event => {
    const first = event.results[0];
    if (!first) throw new Error("An event must contain result evidence.");
    return {
      id: sourceEventKey(item.competition.id, event),
      sourceEventNumber: event.event_number, label: event.event_label_raw,
      groupLabel: first.group_label, distance: first.distance_metres ?? first.distance_laps!, distanceUnit: first.distance_unit ?? "metres", eventKind: first.event_kind ?? "individual", round: first.round_raw,
    };
  });
}
