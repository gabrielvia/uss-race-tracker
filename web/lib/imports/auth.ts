import { env } from "cloudflare:workers";
import { timingSafeEqual } from "node:crypto";

// Local ingestion and the bootstrap endpoint share the existing machine secret.
// Sites visitor access alone never authorizes a write.
export function importAuthorized(request: Request): boolean {
  const expected = Buffer.from(env.SEED_TOKEN ?? "");
  const supplied = Buffer.from(request.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "");
  return expected.length > 0 && supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
export const unauthorized = () => Response.json({ error: "Unauthorized." }, { status: 401, headers: { "Cache-Control": "no-store" } });
