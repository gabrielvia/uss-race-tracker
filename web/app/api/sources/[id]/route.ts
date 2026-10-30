import { bucket, database, unavailable } from "@/lib/database";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[a-f0-9]{16}$/.test(id)) return Response.json({ error: "Source not found." }, { status: 404 });
  try {
    const source = await database().prepare("SELECT object_key FROM sources WHERE id = ?").bind(id).first<{ object_key: string }>();
    if (!source) return Response.json({ error: "Source not found." }, { status: 404 });
    const file = await bucket().get(source.object_key);
    if (!file) return Response.json({ error: "The source evidence file is unavailable." }, { status: 404 });
    return new Response(file.body, { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return unavailable(error); }
}
