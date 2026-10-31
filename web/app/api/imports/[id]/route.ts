import { bucket, unavailable } from "@/lib/database";
import { importAuthorized, unauthorized } from "@/lib/imports/auth";
import { describe, getBatch } from "@/lib/imports/service";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!importAuthorized(request)) return unauthorized();
  const { id } = await context.params;
  if (!/^[a-f0-9]{64}$/.test(id)) return Response.json({ error: "Batch not found." }, { status: 404 });
  try {
    const batch = await getBatch(id);
    if (!batch) return Response.json({ error: "Batch not found." }, { status: 404 });
    if (new URL(request.url).searchParams.get("candidate") === "1") {
      const object=await bucket().get(batch.candidate_key);
      if(!object)return Response.json({error:"Candidate file not found."},{status:404});
      return new Response(object.body,{headers:{"Content-Type":"application/json","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
    }
    return Response.json(describe(batch), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return unavailable(error); }
}
