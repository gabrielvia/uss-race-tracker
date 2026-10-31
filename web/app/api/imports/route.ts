import { COMPETITION_ID } from "@/lib/competition-id";
import { database, unavailable } from "@/lib/database";
import { importAuthorized, unauthorized } from "@/lib/imports/auth";
import { head, submit } from "@/lib/imports/service";
export const dynamic = "force-dynamic";
const LIMIT = 8 * 1024 * 1024;
export async function POST(request: Request) {
  if (!importAuthorized(request)) return unauthorized();
  if (request.headers.get("Content-Type")?.split(";")[0].trim() !== "application/json") return Response.json({ error: "Use application/json." }, { status: 415 });
  if (Number(request.headers.get("Content-Length")) > LIMIT) return Response.json({ error: "Candidate exceeds the 8 MiB limit." }, { status: 413 });
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ error: "A JSON candidate is required." }, { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > LIMIT) { await reader.cancel(); return Response.json({ error: "Candidate exceeds the 8 MiB limit." }, { status: 413 }); }
      chunks.push(value);
    }
    let value: unknown;
    try { value = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
    const result = await submit(value);
    return Response.json(result, { status: result.report.valid ? 200 : 422, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return unavailable(error); }
  finally { reader.releaseLock(); }
}

export async function GET(request: Request) {
  if (!importAuthorized(request)) return unauthorized();
  const competitionId = new URL(request.url).searchParams.get("competition");
  if (!competitionId || !COMPETITION_ID.test(competitionId)) return Response.json({ error: "A valid competition ID is required." }, { status: 400 });
  try {
    if (new URL(request.url).searchParams.get("history") === "1") {
      const page = new URL(request.url).searchParams.get("page") ?? "1";
      if (!/^[1-9]\d{0,4}$/.test(page)) return Response.json({error:"Use a positive history page."},{status:400});
      const db = database();
      const [count, rows] = await db.batch<Record<string, unknown>>([
        db.prepare("SELECT COUNT(*) total FROM import_batches b LEFT JOIN publication_revisions r ON r.batch_id=b.id WHERE b.competition_id = ? OR r.competition_id = ?").bind(competitionId,competitionId),
        db.prepare("SELECT b.id, b.status, b.report_json, b.created_at, b.published_at, r.previous_batch_id, r.source_hash, r.season_label, r.reviewer, r.notes FROM import_batches b LEFT JOIN publication_revisions r ON r.batch_id=b.id WHERE b.competition_id = ? OR r.competition_id = ? ORDER BY b.created_at DESC, b.id LIMIT 25 OFFSET ?").bind(competitionId,competitionId,(Number(page)-1)*25),
      ]);
      return Response.json({competitionId, page:Number(page), pageSize:25, total:count.results[0]?.total ?? 0, batches:rows.results.map(r=>{const {report_json,...rest}=r;return {...rest,report:JSON.parse(String(report_json))};})},{headers:{"Cache-Control":"no-store"}});
    }
    return Response.json({ competitionId, baseBatchId: (await head(competitionId))?.batch_id ?? null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return unavailable(error); }
}
