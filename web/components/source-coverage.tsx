import type { CoverageData } from "@/lib/types";

export function SourceCoverage({ data, error }: { data?: CoverageData | null; error?: string }) {
  return <div className="coverage-note"><span className="small-tag">SOURCE COVERAGE</span><div>
    {error ? <p role="alert">Source coverage is temporarily unavailable.</p> : !data ? <p role="status">Loading source coverage…</p> : <>
      <p>{data.published.competitionCount} published competitions · {data.published.resultCount.toLocaleString("en-US")} race results · Seasons: {data.published.seasons.join(", ") || "None"}.</p>
      <details><summary>Directory discovery, audits and pending sources</summary>
        <p>{data.directory.entries} directory listings · {data.directory.sources} distinct season/source links. Directory checked: {data.directory.checkedAt}. Listings are not unique competitions.</p>
        <p>{data.audit.auditedSources} fully audited RESULTS sources · {data.audit.partlyParsedSources} partly parsed sources needing review · {data.audit.uninspectedSources} uninspected sources. Pending full audit: {data.audit.pendingSources}.</p>
        <p>Source audits last checked: {data.audit.lastCheckedAt || "Not available"}. Latest data publication: {data.published.latestPublishedAt || "None"}. Publication counts come from the active database; audit counts refer to pinned PDF revisions. Classifications remain separate evidence.</p>
        <ul>{data.seasons.map(s => <li key={s.season}>{s.season}: {s.directorySources} directory sources · {s.auditedSources} audited · {s.pendingSources} pending</li>)}</ul>
        {data.reviews.filter(r => r.status === "needs-review").map(r => <p key={r.sourceId}><a href={r.url} target="_blank" rel="noreferrer">{r.title} ↗</a>: {r.parsedEvents}/{r.discoveredEvents} numbered events parsed; {r.needsReviewEvents} event issues, {r.sourceIssues.length} source/page issues. Not approved for publication.</p>)}
      </details>
    </>}
    <p>Profiles link across competitions through a full-name and club match or an explicit review.</p>
  </div></div>;
}
