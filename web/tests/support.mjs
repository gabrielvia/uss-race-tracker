import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const nodeRequire = createRequire(import.meta.url);
const sample = JSON.parse(readFileSync(path.join(root, "lib/sample-data.json"), "utf8"));
const dummyToken = "test-only-seed-token";

export function multiFixture() { return structuredClone(sample); }
export function singleFixture() {
  const fixture = structuredClone(sample);
  for (const item of fixture.competitions) {
    if (!item.evidence.events) continue;
    const first = item.evidence.events[0];
    item.evidence = { roster: item.evidence.roster, race: first };
    item.results = item.results.filter(r => r.eventLabel === first.event_label_raw);
  }
  fixture.schemaVersion = 2;
  return fixture;
}

export function harness(fixture = singleFixture()) {
  const sqlite = new DatabaseSync(":memory:");
  for (const name of readdirSync(path.join(root, "drizzle")).filter(n => n.endsWith(".sql")).sort()) {
    sqlite.exec(readFileSync(path.join(root, "drizzle", name), "utf8"));
  }
  const objects = new Map();
  const state = { batchCalls: 0, executed: 0, failAt: null, failSql: null, writes: 0, failWriteAt: null, beforeReadBatch: null, beforeWriteBatch: null, afterFirst: null };
  function prepare(sql, bindings = []) {
    return {
      sql, bindings,
      bind(...values) { return prepare(sql, values); },
      async first() {
        const row = sqlite.prepare(sql).get(...bindings) ?? null;
        if (state.afterFirst) { const hook = state.afterFirst; state.afterFirst = null; await hook(sql); }
        return row;
      },
      async all() { return { results: sqlite.prepare(sql).all(...bindings) }; },
    };
  }
  const db = {
    prepare,
    async batch(statements) {
      state.batchCalls++;
      if (state.beforeReadBatch && statements.every(s => /^SELECT\b/i.test(s.sql))) {
        const hook = state.beforeReadBatch; state.beforeReadBatch = null; await hook();
      }
      if (state.beforeWriteBatch && statements.some(s => !/^SELECT\b/i.test(s.sql))) {
        const hook = state.beforeWriteBatch; state.beforeWriteBatch = null; await hook();
      }
      sqlite.exec("BEGIN");
      try {
        const responses = [];
        for (const statement of statements) {
          state.executed++;
          if (state.executed === state.failAt || state.failSql?.(statement)) throw new Error("Injected SQL failure");
          const prepared = sqlite.prepare(statement.sql);
          const results = prepared.columns().length ? prepared.all(...statement.bindings) : (prepared.run(...statement.bindings), []);
          responses.push({ success: true, results });
        }
        sqlite.exec("COMMIT");
        return responses;
      } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
  };
  const bucket = {
    async put(key, value) {
      state.writes++;
      if (state.writes === state.failWriteAt) throw new Error("Injected R2 failure");
      objects.set(key, value);
    },
    async head(key) { return objects.has(key) ? { key } : null; },
    async get(key) { return objects.has(key) ? { text: async () => objects.get(key), body: objects.get(key) } : null; },
  };
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    function require(specifier) {
      if (specifier === "cloudflare:workers") return { env: { DB: db, BUCKET: bucket, SEED_TOKEN: dummyToken } };
      if (specifier === "@/lib/sample-data.json") return fixture;
      if (specifier.startsWith("@/")) return load(path.join(root, specifier.slice(2) + ".ts"));
      return nodeRequire(specifier);
    }
    new Function("require", "module", "exports", compiled)(require, module, module.exports);
    return module.exports;
  }
  async function seed(authorized = true) {
    const headers = authorized ? { Authorization: `Bearer ${dummyToken}` } : {};
    const original = console.error;
    console.error = () => {};
    try { return await load(path.join(root, "app/api/admin/seed/route.ts")).POST(new Request("https://example.test/api/admin/seed", { method: "POST", headers })); }
    finally { console.error = original; }
  }
  async function request(route, method, body, authorized = true, id = "") {
    const headers = { "Content-Type": "application/json", ...(authorized ? { Authorization: `Bearer ${dummyToken}` } : {}) };
    const original = console.error;
    console.error = () => {};
    try {
      return await load(path.join(root, `app/api/${route.split("?")[0]}/route.ts`))[method](
        new Request("https://example.test/api/" + route, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }),
        { params: Promise.resolve({ id }) });
    } finally { console.error = original; }
  }
  function snapshot() {
    const tables = ["sources", "competitions", "participants", "entries", "results", "competition_events"];
    return Object.fromEntries(tables.map(table => [table, sqlite.prepare(`SELECT * FROM ${table} ORDER BY id`).all()]));
  }
  function publishedEvidence() {
    return sqlite.prepare("SELECT object_key FROM sources ORDER BY id").all().map(row => objects.get(row.object_key));
  }
  return { sqlite, state, objects, seed, request, load, snapshot, publishedEvidence, fixture,
    health: () => load(path.join(root, "app/api/health/route.ts")).GET(),
    close: () => sqlite.close() };
}
