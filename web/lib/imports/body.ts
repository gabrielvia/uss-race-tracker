export class InputError extends Error { constructor(message: string, public status = 400) { super(message); } }
export async function readBytes(request: Request, limit: number): Promise<Uint8Array> {
  if (Number(request.headers.get("Content-Length")) > limit) throw new InputError("The request exceeds the size limit.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new InputError("A request body is required.");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read(); if (done) break;
      size += value.length;
      if (size > limit) { await reader.cancel(); throw new InputError("The request exceeds the size limit.", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const output = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return output;
}
export async function readJson(request: Request): Promise<unknown> {
  if (request.headers.get("Content-Type")?.split(";")[0].trim() !== "application/json") throw new InputError("Use application/json.", 415);
  const bytes = await readBytes(request, 128 * 1024);
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new InputError("Invalid JSON."); }
}
export function inputFailure(error: unknown): Response | null {
  return error instanceof InputError ? Response.json({error: error.message}, {status: error.status}) : null;
}
export function officialUrl(value: string): boolean {
  try { const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password && !u.port && ["assets.contentstack.io", "www.usspeedskating.org", "usspeedskating.org"].includes(u.hostname); }
  catch { return false; }
}
