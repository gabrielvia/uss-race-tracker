import { bucket, database, unavailable } from "@/lib/database";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: {params: Promise<{id: string}>}) {
  const {id} = await context.params;
  if (!/^[a-f0-9]{64}$/.test(id)) return Response.json({error:"Document not found."}, {status:404});
  try {
    const doc = await database().prepare("SELECT d.object_key FROM source_documents d WHERE d.sha256 = ? AND EXISTS (SELECT 1 FROM sources s WHERE s.sha256 = d.sha256)").bind(id).first<{object_key:string}>();
    const object = doc ? await bucket().get(doc.object_key) : null;
    if (!object) return Response.json({error:"Document not found."}, {status:404});
    return new Response(object.body, {headers:{"Content-Type":"application/pdf","Content-Disposition":"inline; filename=protocol.pdf","X-Content-Type-Options":"nosniff","Cache-Control":"private, max-age=3600"}});
  } catch (error) { return unavailable(error); }
}
