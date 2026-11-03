"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { chartPoint, competitionDates, performancePoints, trendSegments, type CompetitionBest, type PerformanceData, type PerformanceRecord } from "@/lib/performance";

import { PerformanceRows, PerformanceSymbol, PerformanceTooltip } from "@/components/performance-presentation";

const colors = ["#264b41", "#a34b22", "#4259a8", "#8b397c"];
const disciplineName = (d: string) => d === "short-track" ? "Short Track" : "Long Track";
const dateTick = (t: number) => new Intl.DateTimeFormat("en-US", {month: "short", day: "numeric", year: "numeric", timeZone: "UTC"}).format(t);
function useData<T>(url: string | null, revision: number) {
  const [state, setState] = useState<{url: string | null; data?: T; error?: string}>({url: null});
  useEffect(() => {
    const controller = new AbortController();
    if (url) fetch(url, {signal: controller.signal}).then(async r => {
      const data = await r.json() as T & {error?: string};
      if (!r.ok) throw new Error(data.error || "Unable to load performances.");
      if (!controller.signal.aborted) setState({url, data});
    }).catch(e => { if (!controller.signal.aborted) setState({url, error: e.message}); });
    return () => controller.abort();
  }, [url, revision]);
  return state.url === url ? state : {url};
}
function peersFrom(value: string | null): string[] {
  try { const peers = JSON.parse(value || "[]"); return Array.isArray(peers) && peers.length <= 3 && peers.every(p => typeof p === "string") ? peers : []; } catch { return []; }
}
type Props = {person: string; params: URLSearchParams; revision: number; navigate: (patch: Record<string, string | null>, replace?: boolean) => void; onRace: (r: PerformanceRecord) => void};
export function PerformanceExplorer({person, params, revision, navigate, onRace}: Props) {
  const owned = params.get("chartOwner") === person;
  const peers = owned ? peersFrom(params.get("chartPeers")) : [];
  const people = [...new Set([person, ...peers])];
  const base = new URLSearchParams(); people.forEach(p => base.append("participant", p));
  const metadata = useData<PerformanceData>(`/api/performances?${base}`, revision);
  const discipline = (owned && params.get("chartDiscipline")) || metadata.data?.options[0]?.discipline || "";
  const distances = [...new Set(metadata.data?.options.filter(o => o.discipline === discipline).map(o => o.distance))];
  const distance = (owned && params.get("chartDistance")) || String(distances[0] || "");
  const from = owned ? params.get("chartFrom") || "" : "", to = owned ? params.get("chartTo") || "" : "";
  const query = new URLSearchParams(base); if (discipline) query.set("discipline", discipline); if (distance) query.set("distance", distance);
  if (from) query.set("from", from); if (to) query.set("to", to);
  const request = discipline && distance ? `/api/performances?${query}` : null;
  const resource = useData<PerformanceData>(request, revision);
  const data = resource.data?.query === query.toString() ? resource.data : undefined;
  const summaries = data?.competitionBests;
  const points = useMemo(() => performancePoints(summaries || []), [summaries]);
  const pointIds = new Set(points.map(r => r.id));
  const segments = trendSegments(points);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = points.find(r => r.id === selectedId);
  const [listPage, setListPage] = useState(1);
  const listKey = query.toString();
  useEffect(() => { setListPage(1); setSelectedId(null); }, [listKey]);
  const [searchDraft, setSearchDraft] = useState(""), [search, setSearch] = useState<string | null>(null);
  const candidates = useData<{skaters: {id: string; name: string; identity_status: string; seasons: string; disciplines: string}[]; total: number; page: number}>(search === null ? null : `/api/skaters?${search}`, revision);
  function change(patch: Record<string, string | null>) { navigate({chartOwner: person, chartDiscipline: discipline || null, chartDistance: distance || null, chartRound: null, chartView: null, ...patch}); }
  function searchPeople(event: FormEvent) { event.preventDefault(); setSearch(new URLSearchParams({q: searchDraft.trim(), page: "1"}).toString()); }
  function inspect(r: PerformanceRecord) { setSelectedId(r.id); setListPage(Math.floor((summaries?.findIndex(row => row.id === r.id) ?? 0) / 25) + 1); }
  const error = metadata.error || resource.error;
  const coincident = selected ? points.filter(r => r.starts_on === selected.starts_on && r.time_microseconds === selected.time_microseconds) : [];
  const ticks = [...new Set(points.flatMap(r => [Date.parse(r.starts_on!), Date.parse(r.ends_on!)]))].sort((a, b) => a - b);
  const bounds: [number, number] | undefined = ticks.length ? [ticks[0] - 86400000, ticks[ticks.length - 1] + 86400000] : undefined;
  const pageRows = (summaries || []).slice((listPage - 1) * 25, listPage * 25);
  useEffect(() => {
    if (owned && (params.has("chartRound") || params.has("chartView"))) navigate({chartRound: null, chartView: null}, true);
  }, [owned, params, navigate]);
  return <section className="performance-explorer" aria-labelledby="performance-title">
    <h3 id="performance-title">Performance history & comparison</h3>
    <p className="scope-note">One best time per skater, competition and distance, across all rounds. Compare up to four separate identities at one discipline and distance. Chart filters do not change personal bests or age evidence. Selecting skaters does not merge their identities.</p>
    <div className="performance-filters">
      <label>Chart discipline<select value={discipline} onChange={e => change({chartDiscipline: e.target.value, chartDistance: null, chartRound: null})}><option value="" disabled>Choose discipline</option>{["short-track", "long-track"].map(d => <option key={d} value={d}>{disciplineName(d)}</option>)}</select></label>
      <label>Chart distance<select value={distance} onChange={e => change({chartDistance: e.target.value, chartRound: null})}><option value="" disabled>Choose distance</option>{distance && !distances.includes(Number(distance)) && <option value={distance}>{distance} m · No records</option>}{distances.map(d => <option key={d} value={d}>{d} m</option>)}</select></label>
      <label>Competition range from<input type="date" value={from} onChange={e => change({chartFrom: e.target.value || null})}/></label>
      <label>Competition range to<input type="date" value={to} onChange={e => change({chartTo: e.target.value || null})}/></label>
    </div>
    <p className="scope-note">Date filters include overlapping competition ranges. Track specification: Unknown — no verified specification is published for these records.</p>
    <details className="comparison-picker"><summary>Add or remove comparison skaters</summary>
      <p className="scope-note">Names can repeat. Choose the competition-local record or reviewed identity you intend to compare. No matching records in this chart scope is a valid empty series.</p>
      <ul>{people.map((id, i) => <li key={id}>{metadata.data?.series.find(s => s.id === id)?.name || id} <small>{id}</small>{i > 0 && <button onClick={() => change({chartPeers: JSON.stringify(peers.filter(p => p !== id))})}>Remove</button>}</li>)}</ul>
      <form className="athlete-search" onSubmit={searchPeople}><label className="search"><input aria-label="Search comparison skaters" placeholder="Search name, club or bib…" maxLength={200} value={searchDraft} onChange={e => setSearchDraft(e.target.value)}/></label><button>Search</button></form>
      {search !== null && !candidates.data && !candidates.error && <p role="status">Searching comparison skaters…</p>}{candidates.error && <p role="alert">{candidates.error}</p>}
      {candidates.data && <><ul className="comparison-candidates">{candidates.data.skaters.map(s => <li key={s.id}><span><strong>{s.name}</strong><small>{s.id} · {s.identity_status} · {s.seasons}</small></span><button disabled={people.includes(s.id) || people.length >= 4} onClick={() => change({chartPeers: JSON.stringify([...peers, s.id])})}>{people.includes(s.id) ? "Selected" : "Compare"}</button></li>)}</ul>{!candidates.data.total && <p role="status">No skaters match your search.</p>}<div className="pagination"><span>{candidates.data.total} matching identities</span><div><button disabled={candidates.data.page <= 1} onClick={() => setSearch(new URLSearchParams({q: new URLSearchParams(search || "").get("q") || "", page: String(candidates.data!.page - 1)}).toString())}>Previous</button><button disabled={candidates.data.page * 25 >= candidates.data.total} onClick={() => setSearch(new URLSearchParams({q: new URLSearchParams(search || "").get("q") || "", page: String(candidates.data!.page + 1)}).toString())}>Next</button></div></div></>}
    </details>
    {error && <p role="alert" className="message">{error}</p>}
    {!error && !metadata.data && <p role="status">Loading chart scopes…</p>}
    {!error && metadata.data && !request && <p role="status" className="message">No race scope is available. Personal bests and full race history remain available independently.</p>}
    {!error && request && !data && <p role="status">Loading performances…</p>}
    {data && <>
      {data.series.length<people.length&&<p className="scope-note">Selected records belonging to the same reviewed identity share one chart series.</p>}
      <h4>{disciplineName(discipline)} · {distance} m</h4>
      <ul className="performance-legend" aria-label="Chart series">{data.series.map((s, i) => <li key={s.id}><span style={{color: colors[i]}}>● {i + 1}</span> {s.name} <small>({s.identity_status}; {points.filter(r => r.series_id === s.id).length} {points.filter(r => r.series_id === s.id).length === 1 ? "point" : "points"})</small></li>)}</ul>
      <p id="chart-date-note" className="scope-note">Horizontal position marks the competition start, not an exact race date. Horizontal bars show the full competition range. Each competition contributes only its best time across all rounds. Lines connect best times only between non-overlapping competition ranges. Equal-best source performances share one point; their source details remain available.</p>
      {points.length > 0 ? <div className="performance-chart" role="group" aria-label={`${disciplineName(discipline)} ${distance} metre performance chart`} aria-describedby="chart-date-note">
        <ResponsiveContainer width="100%" height={340} minWidth={0}>
          <ScatterChart margin={{top: 20, right: 20, bottom: 25, left: 8}} accessibilityLayer>
            <CartesianGrid strokeDasharray="3 3"/><XAxis type="number" dataKey="x" domain={bounds} tickFormatter={dateTick} tick={{fontSize: 10}} minTickGap={45} name="Competition start anchor" label={{value: "Competition date range", position: "bottom", offset: 8}}/>
            <YAxis type="number" dataKey="y" domain={["dataMin - 1000000", "dataMax + 1000000"]} tickFormatter={t => `${(t / 1_000_000).toFixed(1)}s`} tick={{fontSize: 10}} width={65} name="Time" label={{value: "Time (s)", angle: -90, position: "insideLeft"}}/>
            <Tooltip isAnimationActive={false} content={({payload}) => {const r = payload?.[0]?.payload?.record as CompetitionBest | undefined;return r ? <PerformanceTooltip record={r}/> : null;}}/>
            {points.filter(r => r.starts_on !== r.ends_on).map(r => <ReferenceLine key={`range-${r.id}`} segment={[{x: Date.parse(r.starts_on!), y: r.time_microseconds!}, {x: Date.parse(r.ends_on!), y: r.time_microseconds!}]} stroke={colors[data.series.findIndex(s => s.id === r.series_id)]} strokeOpacity={0.35}/>)}
            {segments.map(([a, b]) => <ReferenceLine key={`line-${a.id}-${b.id}`} segment={[{x: Date.parse(a.starts_on!), y: a.time_microseconds!}, {x: Date.parse(b.starts_on!), y: b.time_microseconds!}]} stroke={colors[data.series.findIndex(s => s.id === a.series_id)]} strokeDasharray="5 3"/>)}
            {data.series.map((s, i) => <Scatter key={s.id} name={s.name} fill={colors[i]} isAnimationActive={false} data={points.filter(r => r.series_id === s.id).map(chartPoint)} shape={(props: unknown) => {const {cx, cy, payload} = props as {cx: number; cy: number; payload: {record: PerformanceRecord}};const r = payload.record;return <PerformanceSymbol record={r} cx={cx} cy={cy} color={colors[i]} number={i+1} selected={selectedId===r.id} inspect={inspect}/>;}}/>)}
          </ScatterChart>
        </ResponsiveContainer>
      </div> : <p role="status" className="message">No valid dated competition bests match this scope. Undated bests remain in the summary. Full race history retains status and missing-time records.</p>}
      {selected && <div className="selected-performance" aria-live="polite"><strong>{selected.name} · {selected.time_raw}</strong><p>{selected.competition_title} · {competitionDates(selected)}<br/>{selected.event_label} · {selected.round} · {selected.race_label} · Race {selected.race_id} · Heat {selected.heat_number ?? "—"} · Place {selected.rank ?? "—"}</p><a href={`${selected.source_url}#page=${selected.source_page}`} target="_blank" rel="noreferrer">Original source p. {selected.source_page} ↗</a> <button onClick={() => onRace(selected)}>View competition event ↗</button>{selected.performances.length > 1 && <details><summary>{selected.performances.length} equal-best source performances · One chart point</summary>{selected.performances.map(r => <p key={r.id}>{r.round} · {r.race_label} · Race {r.race_id} · <a href={`${r.source_url}#page=${r.source_page}`} target="_blank" rel="noreferrer">Source p. {r.source_page} ↗</a><button onClick={() => onRace(r)}>View event ↗</button></p>)}</details>}{coincident.length > 1 && <details><summary>{coincident.length} competition bests share this chart position</summary>{coincident.map(r => <p key={r.id}><button onClick={() => inspect(r)}>{r.name} · {r.round} · Race {r.race_id} · Source p. {r.source_page}</button></p>)}</details>}</div>}
      <p className="scope-note">Competition bests plotted: {points.length} · Competition bests in scope: {summaries?.length || 0}. Exact integer microseconds determine each best time. Full records, including every round and status, remain in Browse race history below. This comparison does not establish an official combined ranking.</p>
      <div className="table-scroll"><table className="performance-table"><caption className="sr-only">One best time per skater, competition and distance across all rounds. Equal-best source performances share one summary row and one chart point.</caption><thead><tr><th>SKATER / COMPETITION</th><th>TIME / PLOT</th><th>EVENT / ROUND / RACE</th><th>PLACE / STATUS / QUAL.</th><th>SOURCE</th></tr></thead><tbody><PerformanceRows rows={pageRows} pointIds={pointIds} selectedId={selectedId} inspect={inspect} onRace={onRace}/></tbody></table></div>
      {!summaries?.length && <p role="status" className="message">No valid competition bests match these filters. Full race history retains all source records.</p>}
      <div className="pagination"><span>Competition bests: {summaries?.length || 0} · Page {listPage} of {Math.max(1, Math.ceil((summaries?.length || 0) / 25))}</span><div><button disabled={listPage <= 1} onClick={() => setListPage(p => p - 1)}>Previous</button><button disabled={listPage * 25 >= (summaries?.length || 0)} onClick={() => setListPage(p => p + 1)}>Next</button></div></div>
    </>}
  </section>;
}
