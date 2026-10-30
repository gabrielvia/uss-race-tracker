import { bucket, database, unavailable } from "@/lib/database";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const row = await database().prepare("SELECT COUNT(*) AS count FROM competitions").first<{ count: number }>();
    const source = await database().prepare("SELECT object_key FROM sources ORDER BY id LIMIT 1").first<{ object_key: string }>();
    const evidenceReady = source ? !!(await bucket().head(source.object_key)) : false;
    return Response.json({ database: "connected", competitionCount: row?.count ?? 0, evidenceReady, ready: !!row?.count && evidenceReady }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return unavailable(error); }
}
