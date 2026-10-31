// Identifiers and column names below are supplied by server code, never requests.
export function bulkInsert(db: D1Database, table: string, rows: Record<string, unknown>[], conflict = ""): D1PreparedStatement[] {
  if (!rows.length) return [];
  const columns = Object.keys(rows[0]);
  const statements: D1PreparedStatement[] = [];
  let chunk: Record<string, unknown>[] = [], size = 0;
  const flush = () => {
    if (!chunk.length) return;
    statements.push(db.prepare(`INSERT INTO ${table} (${columns.join(",")}) SELECT ${columns.map(c => `json_extract(value, '$.${c}')`).join(",")} FROM json_each(?) WHERE 1 ${conflict}`).bind(JSON.stringify(chunk)));
    chunk = []; size = 0;
  };
  for (const row of rows) {
    const bytes = new TextEncoder().encode(JSON.stringify(row)).length;
    if (chunk.length >= 100 || size + bytes > 64 * 1024) flush();
    chunk.push(row); size += bytes;
  }
  flush();
  return statements;
}
