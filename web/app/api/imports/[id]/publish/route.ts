import { unavailable } from "@/lib/database";
import { importAuthorized, unauthorized } from "@/lib/imports/auth";
import { getBatch, ImportConflict, publish } from "@/lib/imports/service";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!importAuthorized(request)) return unauthorized();
  const { id } = await context.params;
  if (!/^[a-f0-9]{64}$/.test(id)) return Response.json({ error: "Batch not found." }, { status: 404 });
  try {
    const batch = await getBatch(id);
    if (!batch) return Response.json({ error: "Batch not found." }, { status: 404 });
    return Response.json(await publish(batch), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ImportConflict) return Response.json({ error: error.message }, { status: 409, headers: { "Cache-Control": "no-store" } });
    return unavailable(error);
  }
}
