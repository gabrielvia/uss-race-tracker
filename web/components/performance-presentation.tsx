import { competitionDates, dated, timeLabel, validPerformance, type CompetitionBest, type PerformanceRecord } from "@/lib/performance";

export function PerformanceTooltip({record: r}: {record: CompetitionBest}) {
  return <div className="performance-tooltip"><strong>{r.name} · {r.time_raw}</strong><p>{r.competition_title} · Competition best</p><p>{competitionDates(r)}</p><p>{r.round} · {r.race_label} · Race {r.race_id} · Heat {r.heat_number ?? "—"}</p><p>{r.event_label} · Source p. {r.source_page}</p>{r.performances.length > 1 && <p>{r.performances.length} equal-best source performances · One point</p>}<p>Select point or list row for source links.</p></div>;
}

export function PerformanceSymbol({record: r, cx, cy, color, number, selected, inspect}: {record: PerformanceRecord; cx: number; cy: number; color: string; number: number; selected: boolean; inspect: (r: PerformanceRecord) => void}) {
  return <g role="button" tabIndex={0} data-result-id={r.id} aria-label={`${number}. ${r.name}, ${r.time_raw}, ${competitionDates(r)}, ${r.round}, race ${r.race_id}, source page ${r.source_page}`} onClick={() => inspect(r)} onFocus={() => inspect(r)} onKeyDown={e => {if (e.key === "Enter" || e.key === " ") {e.preventDefault();inspect(r);}}}><circle cx={cx} cy={cy} r={selected ? 8 : 6} fill={color} stroke="white" strokeWidth={2}/><text x={cx} y={cy + 3} textAnchor="middle" fill="white" fontSize={8}>{number}</text></g>;
}

export function PerformanceRows({rows, pointIds, selectedId, inspect, onRace}: {rows: CompetitionBest[]; pointIds: Set<string>; selectedId: string | null; inspect: (r: PerformanceRecord) => void; onRace: (r: PerformanceRecord) => void}) {
  return <>{rows.map(r => <tr key={r.id} data-result-id={r.id} className={selectedId === r.id ? "selected-row" : ""}>
    <td>{r.name}<span className="bib-label">{r.competition_title} · {r.season}</span><span className="bib-label">{competitionDates(r)}</span></td>
    <td className="time">{r.time_raw ?? "—"}<span className="bib-label">{pointIds.has(r.id) ? <button className="skater-link" aria-pressed={selectedId === r.id} onClick={() => inspect(r)}>Select point</button> : !validPerformance(r) ? "Not a valid timed finish" : !dated(r) ? "Dates unknown" : "Outside best-time view"}</span>{validPerformance(r) && <span className="sr-only">{timeLabel(r.time_microseconds!)}</span>}</td>
    <td>{r.event_label}<span className="bib-label">{r.entry_division ?? "Unknown entry"} · {r.event_gender} · {r.competition_group ?? "No labelled group"}</span><span className="bib-label">{r.round} · {r.race_label} · Race {r.race_id} · Heat {r.heat_number ?? "—"}</span><button className="skater-link" onClick={() => onRace(r)}>View event ↗</button></td>
    <td>{r.rank ?? "—"} / {r.result_status ?? (r.finish_note ? "Not recorded" : "—")} / {r.qualification ?? "—"}</td>
    <td><a href={`${r.source_url}#page=${r.source_page}`} target="_blank" rel="noreferrer">p. {r.source_page} ↗</a>{r.performances.length > 1 && <details><summary>{r.performances.length} equal-best performances</summary>{r.performances.map(source => <p key={source.id}>{source.round} · {source.race_label} · Race {source.race_id}<br/><a href={`${source.source_url}#page=${source.source_page}`} target="_blank" rel="noreferrer">p. {source.source_page} ↗</a><br/><button className="skater-link" onClick={() => onRace(source)}>View event ↗</button></p>)}</details>}</td>
  </tr>)}</>;
}
