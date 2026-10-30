import { createHash } from "node:crypto";

type EventEvidence = {
  event_number: string; event_label_raw: string;
  results: { group_label: string; distance_metres: number; round_raw: string }[];
};
export function eventDefinitions(item: { competition: { id: string }; evidence: { race?: EventEvidence; events?: EventEvidence[] } }) {
  const events = item.evidence.events ?? (item.evidence.race ? [item.evidence.race] : []);
  return events.map(event => {
    const first = event.results[0];
    if (!first) throw new Error("An event must contain result evidence.");
    return {
      id: createHash("sha256").update(`${item.competition.id}|${event.event_label_raw}`).digest("hex").slice(0, 20),
      sourceEventNumber: event.event_number, label: event.event_label_raw,
      groupLabel: first.group_label, distance: first.distance_metres, round: first.round_raw,
    };
  });
}
