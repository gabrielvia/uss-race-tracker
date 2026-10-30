import { COMPETITION_ID } from "@/lib/competition-id";
import { unavailable } from "@/lib/database";
import { importAuthorized, unauthorized } from "@/lib/imports/auth";
import { head, submit } from "@/lib/imports/service";
export const dynamic = "force-dynamic";
const LIMIT = 2 * 1024 * 1024;
export async function POST(request: Request) {
  if (!importAuthorized(request)) return unauthorized();
  if (request.headers.get("Content-Type")?.split(";")[0].trim() !== "application/json") return Response.json({ error: "Use application/json." }, { status: 415 });
  if (Number(request.headers.get("Content-Length")) > LIMIT) return Response.json({ error: "Candidate exceeds the 2 MiB limit." }, { status: 413 });
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ error: "A JSON candidate is required." }, { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > LIMIT) { await reader.cancel(); return Response.json({ error: "Candidate exceeds the 2 MiB limit." }, { status: 413 }); }
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
    return Response.json({ competitionId, baseBatchId: (await head(competitionId))?.batch_id ?? null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return unavailable(error); }
}
