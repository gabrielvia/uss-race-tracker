import { env } from "cloudflare:workers";
export function database(): D1Database {
  if (!env.DB) throw new Error("Database binding is unavailable.");
  return env.DB;
}
export function bucket(): R2Bucket {
  if (!env.BUCKET) throw new Error("File storage binding is unavailable.");
  return env.BUCKET;
}
export function unavailable(error: unknown): Response {
  console.error("Storage request failed", error);
  return Response.json({ error: "The data service is temporarily unavailable. Please try again." }, { status: 503 });
}
