"use client";

import { useEffect, useRef, useState } from "react";
import { hasComparableTime } from "@/lib/result-display";
import type { Competition, CompetitionDetail, Participant, SkaterProfile } from "@/lib/types";

const disciplineName = (value: string) => value === "short-track" ? "Short track" : "Long track";
const dateLabel = (value: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value + "T12:00:00Z"));

async function readJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "Unable to load competition data.");
  return data;
}

function AgeHelp() {
  const [pinned, setPinned] = useState(false);
  const [transient, setTransient] = useState(false);
  const open = pinned || transient;
  return <span className="age-help" onMouseEnter={() => setTransient(true)} onMouseLeave={() => setTransient(false)} onKeyDown={event => { if (event.key === "Escape") { setPinned(false); setTransient(false); } }}>
    <button type="button" aria-label="About skating age" aria-expanded={open} aria-describedby={open ? "skating-age-explanation" : undefined} onFocus={() => setTransient(true)} onBlur={() => setTransient(false)} onClick={() => { setPinned(!pinned); if (pinned) setTransient(false); }}>ⓘ</button>
    {open && <span className="age-tooltip" id="skating-age-explanation" role="tooltip">Skating age is your season-based competition age, not your current age or years of skating experience. It increases by one each July 1. Values are based on published competition records and may be inferred or shown as a range when the records are incomplete.</span>}
  </span>;
}

export default function Home() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [discipline, setDiscipline] = useState("all");
  const [detail, setDetail] = useState<CompetitionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("results");
  const [query, setQuery] = useState("");
  const [selectedEventKey, setSelectedEventKey] = useState("");
  const [profile, setProfile] = useState<SkaterProfile | null>(null);
  const [profileError, setProfileError] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<Participant | null>(null);
  const [revision, setRevision] = useState(0);
  const profileRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    readJson<{ competitions: Competition[] }>("/api/competitions", controller.signal)
      .then(data => {
        setCompetitions(data.competitions);
        const requested = new URLSearchParams(window.location.search).get("competition");
        setSelectedId(data.competitions.find(c => c.id === requested)?.id || data.competitions[0]?.id || "");
        if (!data.competitions.length) setLoading(false);
      })
      .catch(e => { if (e.name !== "AbortError") { setError(e.message); setLoading(false); } });
    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    setLoading(true); setError(""); setDetail(null); setSelectedPerson(null); setQuery("");
    readJson<CompetitionDetail>(`/api/competitions/${encodeURIComponent(selectedId)}`, controller.signal)
      .then(data => { setDetail(data); const requestedEvent = new URLSearchParams(window.location.search).get("event"); setSelectedEventKey(data.events.find(e => e.id === requestedEvent)?.id || data.events[0]?.id || ""); setLoading(false); })
      .catch(e => { if (e.name !== "AbortError") { setError(e.message); setLoading(false); } });
    return () => controller.abort();
  }, [selectedId, revision]);

  useEffect(() => { if (selectedPerson) profileRef.current?.focus(); }, [selectedPerson]);
  useEffect(() => {
    setProfile(null); setProfileError("");
    if (!selectedPerson) return;
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>; let generation=0;
    const refresh = async () => {
      const current=++generation; clearTimeout(timer);
      try {
        const data=await readJson<SkaterProfile>(`/api/participants/${encodeURIComponent(selectedPerson.id)}/profile`,controller.signal);
        if(current!==generation||controller.signal.aborted)return;
        setProfile(data); setProfileError("");
        timer=setTimeout(refresh,Math.max(1000,Math.min(Date.parse(data.age.nextUpdateAt)-Date.now(),24*60*60*1000)));
      } catch(e) { if(!controller.signal.aborted&&current===generation)setProfileError(e instanceof Error?e.message:"Unable to load age evidence."); }
    };
    void refresh(); window.addEventListener("focus",refresh);
    return()=>{controller.abort();clearTimeout(timer);window.removeEventListener("focus",refresh);};
  },[selectedPerson]);

  function selectCompetition(id: string) {
    if (id === selectedId) return;
    setSelectedId(id);
    const url = new URL(window.location.href); url.searchParams.set("competition", id); url.searchParams.delete("event");
    window.history.replaceState(null, "", url);
  }
  function selectEvent(id: string) {
    setSelectedEventKey(id);
    const url = new URL(window.location.href); url.searchParams.set("competition", selectedId); url.searchParams.set("event", id); window.history.replaceState(null, "", url);
  }
  function filterDiscipline(value: string) {
    setDiscipline(value);
    const matches = competitions.filter(c => value === "all" || c.discipline === value);
    if (!matches.some(c => c.id === selectedId) && matches[0]) selectCompetition(matches[0].id);
  }
  const visibleCompetitions = competitions.filter(c => discipline === "all" || c.discipline === discipline);
  const people = detail?.participants ?? [];
  const search = query.trim().toLowerCase();
  const matchingPeople = people.filter(p => `${p.name} ${p.affiliation} ${p.bib}`.toLowerCase().includes(search));
  const matchingIds = new Set(matchingPeople.map(p => p.id));
  const eventOptions = detail?.events ?? [];
  const eventResults = (detail?.results ?? []).filter(r => r.event_key === selectedEventKey && !!selectedEventKey);
  const heatCount = new Set(eventResults.map(r => r.race_id)).size;
  const finalRaces = eventOptions.find(e=>e.id===selectedEventKey)?.round === "Finals" && heatCount>1;
  const raceCountLabel = heatCount===1 ? "1 race" : finalRaces ? `All ${heatCount} final races` : `All ${heatCount} heats`;
  const matchingResults = eventResults.filter(r => matchingIds.has(r.participant_id));
  const entries = selectedPerson ? detail?.entries.filter(e => e.participant_id === selectedPerson.id) ?? [] : [];
  const competition = detail?.competition;

  return <>
    <header className="topbar"><a className="brand" href="/" aria-label="USS Race Tracker home"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M5 9h25l-7 7H5zm0 12h18l-7 7H5zm0 12h11l-7 5H5z" fill="currentColor" /></svg><span>USS<span className="brand-light"> RACE TRACKER</span></span></a><span className="header-note"><i /> A clearer view of every race.</span></header>
    <main>
      <section className="intro"><div><p className="eyebrow">THE RESULTS EXPLORER</p><h1>Every race.<br /><span>A story in seconds.</span></h1><p className="lede">Explore the competition. Find your skater.<br className="desktop-break" /> Follow the numbers behind the finish.</p></div><div className="intro-stat"><span className="stat-number">{competitions.length ? String(competitions.length).padStart(2, "0") : "—"}<span> /</span></span><p>COMPETITIONS IN THIS SAMPLE</p><span className="season-chip">2025–2026 SEASON</span></div></section>
      <div className="coverage-note"><span className="small-tag">SAMPLE EDITION</span><p>{competitions.reduce((sum, c) => sum + c.event_count, 0)} published events across {competitions.length} competition rosters. Coverage details and original protocols are available with every competition.</p></div>
      <section className="explorer" aria-labelledby="explore-title"><div className="section-heading"><div><p className="eyebrow">01 / COMPETITIONS</p><h2 id="explore-title">On the ice</h2></div><div className="segments" aria-label="Filter by discipline">{[["all", "All disciplines"], ["short-track", "Short track"], ["long-track", "Long track"]].map(([value, label]) => <button key={value} onClick={() => filterDiscipline(value)} aria-pressed={discipline === value}>{label}</button>)}</div></div>
      <div className="competition-grid">{visibleCompetitions.map(c => <button key={c.id} className={`competition-card ${selectedId === c.id ? "active" : ""}`} onClick={() => selectCompetition(c.id)} aria-pressed={selectedId === c.id}><span className="card-top"><span>{disciplineName(c.discipline)}</span><span aria-hidden="true">↗</span></span><h3>{c.title}</h3><p>{c.location}</p><div className="card-bottom"><span>{dateLabel(c.starts_on)}</span><span>{c.participant_count} skaters</span></div></button>)}</div>
      {error && <div role="alert" className="message"><h3>We couldn’t load the results.</h3><p>{error}</p><button className="primary" onClick={() => setRevision(r => r + 1)}>Try again</button></div>}
      {loading && !error && <p role="status" className="message">Loading competition records…</p>}
      {!loading && !error && !competitions.length && <div className="message"><h3>No competitions available yet.</h3><p>Check back when the first results are ready.</p></div>}
      {competition && !error && <section className="records" aria-labelledby="records-title"><div className="records-heading"><div><p className="eyebrow">2026 / {disciplineName(competition.discipline).toUpperCase()}</p><h2 id="records-title">{competition.title}</h2><p>{dateLabel(competition.starts_on)} – {dateLabel(competition.ends_on)}<span className="separator">/</span>{competition.location}</p></div><a className="source-button" href={competition.source_url} target="_blank" rel="noreferrer">Official protocol <span aria-hidden="true">↗</span></a></div>
      <div className="table-toolbar"><div className="view-switch" aria-label="Record view"><button aria-pressed={tab === "results"} onClick={() => setTab("results")}>Race results <span>{detail?.results.length}</span></button><button aria-pressed={tab === "roster"} onClick={() => setTab("roster")}>Skater roster <span>{people.length}</span></button></div><label className="search"><span aria-hidden="true">⌕</span><input aria-label="Search skaters by name, club, or bib" placeholder="Search skater, club or bib…" value={query} onChange={e => setQuery(e.target.value)} /><kbd aria-hidden="true">↵</kbd></label></div>
      {tab === "results" && <div className="event-controls"><label htmlFor="event-choice">Event / round</label><select id="event-choice" value={selectedEventKey} onChange={e => selectEvent(e.target.value)}>{eventOptions.map(event => <option key={event.id} value={event.id}>{event.label}</option>)}</select><span>{raceCountLabel} · {eventResults.length} results</span></div>}
      <div className="sample-context">{tab === "results" ? <>{detail.coverage.eventCount} {detail.coverage.kind === "protocol-results" ? "protocol RESULTS events" : "complete selected events"} covered. Showing all heats in the selected group, distance and round. Timed finishers are ordered by time for comparison; official heat places and result statuses are shown separately. All status records are retained. {eventOptions.find(e=>e.id===selectedEventKey)?.round==="Finals" && heatCount>1 ? "Final groups are separate races; time order is not an official classification." : ""}</> : <>Competition-local roster · All recorded divisions retained</>}</div>
      <div className="table-scroll"><table><caption className="sr-only">{tab === "results" ? "All-heat event results" : "Competition skater roster"}</caption><thead><tr><th scope="col">{tab === "results" ? "TIME ORDER" : "BIB"}</th><th scope="col">SKATER</th><th scope="col">CLUB / AFFILIATION</th><th scope="col">{tab === "results" ? "TIME" : "RECORDED AGE GROUP"}</th>{tab === "results" && <><th scope="col">STATUS</th><th scope="col">HEAT / PLACE</th></>}<th scope="col">SOURCE</th></tr></thead><tbody>{tab === "results" ? matchingResults.map((r, index) => { const p = people.find(p => p.id === r.participant_id)!; return <tr key={r.id}><td><span className={`place ${index === 0 && hasComparableTime(r) ? "first" : ""}`}>{hasComparableTime(r) ? String(index + 1).padStart(2, "0") : "—"}</span></td><td><button className="skater-link" onClick={() => setSelectedPerson(p)}>{p.name}</button><span className="bib-label">BIB {p.bib}{r.qualification ? ` · ${r.qualification}` : ""}</span></td><td>{p.affiliation}</td><td className="time">{r.time_raw ?? "—"}</td><td><span className="age-tag">{r.result_status ?? (r.finish_note ? "Not recorded" : "—")}</span></td><td className="heat-cell"><span>{r.heat_number ? `Heat ${r.heat_number}` : (r.race_label || "Race").replace(/\s+Race #\d+$/, "")}</span><small>Place {r.rank ?? "—"} · Race {r.race_id}</small></td><td><a className="page-link" href={`${competition.source_url}#page=${r.source_page}`} target="_blank" rel="noreferrer">p. {r.source_page} ↗</a></td></tr>; }) : matchingPeople.map(p => { const personEntries = detail?.entries.filter(e => e.participant_id === p.id) ?? []; return <tr key={p.id}><td className="mono">{p.bib}</td><td><button className="skater-link" onClick={() => setSelectedPerson(p)}>{p.name}</button></td><td>{p.affiliation}</td><td><span className="age-tag">{[...new Set(personEntries.map(e => e.age_status).filter(Boolean))].join(" / ") || "See division"}</span></td><td><a className="page-link" href={`${competition.source_url}#page=${personEntries[0]?.source_page ?? 1}`} target="_blank" rel="noreferrer">p. {personEntries[0]?.source_page ?? 1} ↗</a></td></tr>; })}</tbody></table></div>
      {(tab === "results" ? matchingResults : matchingPeople).length === 0 && <p role="status" className="message">No records match your search. Try another name, club or bib.</p>}
      <div className="table-footer"><span>{tab === "results" ? `${matchingResults.length} of ${eventResults.length} event results · ${raceCountLabel.toLowerCase()}` : `${matchingPeople.length} of ${people.length} skaters`}</span><span>{detail.archivedPdf && <a href={detail.archivedPdf} target="_blank" rel="noreferrer">Archived protocol ↗</a>} <a href={`/api/sources/${competition.source_id}`} target="_blank" rel="noreferrer">Extraction evidence (JSON) ↗</a></span></div>
      {selectedPerson && <aside ref={profileRef} tabIndex={-1} className="profile" aria-label="Skater competition record"><button className="close-profile" onClick={() => setSelectedPerson(null)} aria-label="Close skater record">×</button><p className="eyebrow">SKATER / BIB {selectedPerson.bib}</p><h2>{selectedPerson.name}</h2><div className="profile-fields"><div><span>Club at this competition</span><strong>{selectedPerson.affiliation === "Direct" ? "Direct registration" : selectedPerson.affiliation}</strong></div><div><span>Skating age <AgeHelp /></span><strong>{profileError ? "Unavailable" : !profile ? "Loading…" : profile.age.status === "conflict" ? "Needs review" : profile.age.status === "not_available" ? "Not determined" : profile.age.status === "inferred" ? `${profile.age.min} · Inferred` : profile.age.max === null ? `${profile.age.min}+ · Estimated range` : `${profile.age.min}–${profile.age.max} · Estimated range`}</strong>{profile && <small>{profile.age.season}</small>}</div><div><span>Recorded age group · {competition.season}</span><strong>{[...new Set(entries.map(e => e.age_status).filter(Boolean))].join(" / ") || "Not provided"}</strong></div></div>{profile && <details className="profile-note"><summary>Age evidence</summary><p>{profile.age.reason ?? "Season-based inference from published age categories, using reviewed rules. No date of birth is inferred."}</p>{profile.age.evidence.map((e,index)=><p key={index}><a href={`${e.source.sourceUrl}#page=${e.source.page}`} target="_blank" rel="noreferrer">{e.source.category} · p. {e.source.page}</a><br /><a href={`${e.source.ruleSource.url}#page=${e.source.ruleSource.pages[0]}`} target="_blank" rel="noreferrer">{e.source.ruleVersion}</a><br />Baseline: {e.source.baselineDate}</p>)}{profile.unresolvedAgeEvidence.length>0 && <p>Some recorded categories have no reviewed rule and are excluded from this estimate.</p>}</details>}<p className="profile-note">Recorded divisions: {[...new Set(entries.map(e => e.division))].join("; ")}. This record belongs to this competition.</p></aside>}
      </section>}
      </section>
      <footer className="footer"><div><strong>USS RACE TRACKER</strong><p>An independent explorer of published US Speedskating results.</p></div><a href="https://www.usspeedskating.org/results" target="_blank" rel="noreferrer">Visit the official results directory ↗</a></footer>
    </main>
  </>;
}
