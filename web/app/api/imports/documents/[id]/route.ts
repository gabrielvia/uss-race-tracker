import { createHash } from "node:crypto";
import { bucket, database, unavailable } from "@/lib/database";
import { importAuthorized, unauthorized } from "@/lib/imports/auth";
import { inputFailure, InputError, officialUrl, readBytes } from "@/lib/imports/body";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: {params: Promise<{id: string}>}) {
  if (!importAuthorized(request)) return unauthorized();
  const {id} = await context.params;
  if (!/^[a-f0-9]{64}$/.test(id)) return Response.json({error: "A PDF SHA-256 is required."}, {status:400});
  try {
    const url = request.headers.get("X-Source-URL") ?? "";
    if (!officialUrl(url)) throw new InputError("An official HTTPS source URL is required.");
    if (request.headers.get("Content-Type") !== "application/pdf") throw new InputError("Use application/pdf.", 415);
    const bytes = await readBytes(request, 32 * 1024 * 1024);
    if (new TextDecoder().decode(bytes.slice(0,5)) !== "%PDF-" || createHash("sha256").update(bytes).digest("hex") !== id) throw new InputError("The PDF content does not match the requested source hash.");
    const key = `documents/${id}.pdf`;
    await bucket().put(key, bytes, {httpMetadata: {contentType:"application/pdf"}});
    await database().batch([database().prepare("INSERT INTO source_documents (sha256, url, object_key, byte_length, archived_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(sha256) DO NOTHING").bind(id, url, key, bytes.byteLength, new Date().toISOString())]);
    return Response.json({sha256:id, archived:true, bytes:bytes.byteLength});
  } catch (error) { return inputFailure(error) ?? unavailable(error); }
}
