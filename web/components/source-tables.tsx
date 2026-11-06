"use client";
import { useEffect, useState } from "react";

type SourceTable = {page: number; label: string; kind: string; text_raw: string; distance_metres?: number};

export function SourceTables({url, count, source}: {url: string; count: number; source: string}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<{url: string; pages?: SourceTable[]; error?: string}>({url: ""});
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetch(url, {signal: controller.signal}).then(async response => {
      const data = await response.json() as {pages: SourceTable[]; error?: string};
      if (!response.ok) throw new Error(data.error || "Unable to load source tables.");
      if (!controller.signal.aborted) setState({url, pages: data.pages});
    }).catch(error => { if (!controller.signal.aborted) setState({url, error: error.message}); });
    return () => controller.abort();
  }, [url, open, source]);
  return <details className="profile-note" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Additional source tables · {count} pages</summary>
    <p>Original standings and other source tables remain separate from individual results and personal bests.</p>
    {open && state.url !== url && <p role="status">Loading source tables…</p>}
    {state.url === url && state.error && <p role="alert">{state.error}</p>}
    {state.url === url && state.pages?.map(page => <section key={page.page}>
      <h4>{page.label} · Source p. {page.page}</h4>
      {page.distance_metres !== undefined && <p>Distance · {page.distance_metres} m</p>}
      <a href={`${source}#page=${page.page}`} target="_blank" rel="noreferrer">View original table ↗</a>
      <details><summary>Original extracted text</summary><pre style={{whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: "0.8rem"}}>{page.text_raw}</pre></details>
    </section>)}
  </details>;
}
