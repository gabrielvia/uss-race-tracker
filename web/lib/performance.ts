import type { RaceResult } from "@/lib/types";

export type PerformanceRecord = RaceResult & {
  series_id: string; name: string; bib: string; affiliation: string;
  competition_id: string; competition_title: string; discipline: string; season: string;
  starts_on: string | null; ends_on: string | null; source_url: string;
  entry_division: string | null; event_gender: string; group_label: string;
  competition_group: string | null;
};
export type PerformanceSeries = { id: string; name: string; identity_status: string };
export type CompetitionBest = PerformanceRecord & {performances: PerformanceRecord[]};
export type PerformanceData = {
  query: string; selectionRequired: boolean;
  series: PerformanceSeries[]; records: PerformanceRecord[]; competitionBests: CompetitionBest[];
  options: {discipline: string; distance: number; round: string}[];
  trackSpecification: null;
};
export function validDate(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function dated(record: Pick<PerformanceRecord, "starts_on" | "ends_on">): boolean {
  return validDate(record.starts_on) && validDate(record.ends_on) && record.starts_on <= record.ends_on;
}
export function validPerformance(record: Pick<RaceResult, "time_microseconds" | "result_status">): boolean {
  return record.result_status === null && Number.isSafeInteger(record.time_microseconds) && record.time_microseconds! > 0;
}
export function chartPoint(record: PerformanceRecord) {
  return {x: Date.parse(record.starts_on!), y: record.time_microseconds, record};
}
export function competitionDates(record: Pick<PerformanceRecord, "starts_on" | "ends_on">): string {
  if (!dated(record)) return "Competition dates unknown";
  return record.starts_on === record.ends_on ? `${record.starts_on} (competition date)` : `${record.starts_on} – ${record.ends_on} (competition range)`;
}
// One best time per full competition/distance. Tied source performances remain
// evidence for that one point; a deterministic representative supplies its ID.
export function competitionBests(records: PerformanceRecord[]): CompetitionBest[] {
  const bests = new Map<string, PerformanceRecord[]>();
  for (const r of records.filter(validPerformance)) {
    const key = JSON.stringify([r.series_id, r.competition_id, r.discipline, r.distance]);
    const ties = bests.get(key);
    if (!ties || r.time_microseconds! < ties[0].time_microseconds!) bests.set(key, [r]);
    else if (r.time_microseconds === ties[0].time_microseconds) ties.push(r);
  }
  return [...bests.values()].map(rows => {
    const performances = rows.toSorted((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    return {...performances[0], performances};
  });
}
export function performancePoints(bests: CompetitionBest[]): CompetitionBest[] {
  return bests.filter(dated);
}
// A competition range is not an individual race timestamp. Never join rounds
// within a competition or imply an order for overlapping competition ranges.
export function trendSegments(points: PerformanceRecord[]): [PerformanceRecord, PerformanceRecord][] {
  const groups = new Map<string, PerformanceRecord[]>();
  for (const r of points) groups.set(r.series_id, [...(groups.get(r.series_id) ?? []), r]);
  const segments: [PerformanceRecord, PerformanceRecord][] = [];
  for (const rows of groups.values()) {
    const competitions = [...new Map(rows.map(r => [r.competition_id, r])).values()].sort((a, b) => a.starts_on!.localeCompare(b.starts_on!) || a.competition_id.localeCompare(b.competition_id));
    for (let i = 1; i < competitions.length; i++) {
      if (competitions[i - 1].ends_on! < competitions[i].starts_on!) segments.push([competitions[i - 1], competitions[i]]);
    }
  }
  return segments;
}
export function timeLabel(microseconds: number): string {
  const whole = Math.floor(microseconds / 1_000_000), fraction = String(microseconds % 1_000_000).padStart(6, "0");
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}.${fraction}`;
}
