import { test } from "node:test";
import assert from "node:assert/strict";
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

function harness(fixture = structuredClone(sample)) {
  const sqlite = new DatabaseSync(":memory:");
  for (const name of readdirSync(path.join(root, "drizzle")).filter(n => n.endsWith(".sql")).sort()) {
    sqlite.exec(readFileSync(path.join(root, "drizzle", name), "utf8"));
  }
  const objects = new Map();
  const state = { batchCalls: 0, executed: 0, failAt: null, writes: 0, failWriteAt: null };
  function prepare(sql, bindings = []) {
    return {
      sql, bindings,
      bind(...values) { return prepare(sql, values); },
      async first() { return sqlite.prepare(sql).get(...bindings) ?? null; },
      async all() { return { results: sqlite.prepare(sql).all(...bindings) }; },
    };
  }
  const db = {
    prepare,
    async batch(statements) {
      state.batchCalls++;
      sqlite.exec("BEGIN");
      try {
        for (const statement of statements) {
          state.executed++;
          if (state.executed === state.failAt) throw new Error("Injected SQL failure");
          sqlite.prepare(statement.sql).run(...statement.bindings);
        }
        sqlite.exec("COMMIT");
        return statements.map(() => ({ success: true }));
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
  function snapshot() {
    const tables = ["sources", "competitions", "participants", "entries", "results"];
    return Object.fromEntries(tables.map(table => [table, sqlite.prepare(`SELECT * FROM ${table} ORDER BY id`).all()]));
  }
  function publishedEvidence() {
    return sqlite.prepare("SELECT object_key FROM sources ORDER BY id").all().map(row => objects.get(row.object_key));
  }
  return { sqlite, state, objects, seed, snapshot, publishedEvidence, fixture,
    health: () => load(path.join(root, "app/api/health/route.ts")).GET(),
    close: () => sqlite.close() };
}

test("SQL failure leaves no partial competition and readiness stays false", async () => {
  const h = harness();
  try {
    h.state.failAt = 45;
    assert.equal((await h.seed()).status, 503);
    assert.equal(h.state.batchCalls, 1);
    assert.deepEqual(Object.fromEntries(Object.entries(h.snapshot()).map(([key, rows]) => [key, rows.length])), { sources: 0, competitions: 0, participants: 0, entries: 0, results: 0 });
    assert.equal((await (await h.health()).json()).ready, false);
    h.state.failAt = null;
    assert.equal((await h.seed()).status, 200);
    const before = h.snapshot();
    assert.equal((await h.seed()).status, 200);
    assert.deepEqual(h.snapshot(), before);
    assert.equal(before.participants.length, 289);
    assert.equal(before.entries.length, 290);
    assert.equal(before.results.length, 21);
    assert.equal((await (await h.health()).json()).ready, true);
  } finally { h.close(); }
});

test("later R2 failure cannot publish an earlier competition", async () => {
  const h = harness();
  try {
    h.state.failWriteAt = 2;
    assert.equal((await h.seed()).status, 503);
    assert.equal(h.snapshot().competitions.length, 0);
  } finally { h.close(); }
});

test("failed reseed preserves old data and referenced evidence", async () => {
  const h = harness();
  try {
    assert.equal((await h.seed()).status, 200);
    const before = h.snapshot(), evidence = h.publishedEvidence();
    h.fixture.competitions[0].evidence.race.parser_version = "new-extraction-version";
    h.state.failAt = h.state.executed + 45;
    assert.equal((await h.seed()).status, 503);
    assert.deepEqual(h.snapshot(), before);
    assert.equal(JSON.stringify(h.publishedEvidence()), JSON.stringify(evidence), "Published evidence changed after a failed import");
  } finally { h.close(); }
});

test("unauthorized seed requests never write", async () => {
  const h = harness();
  try {
    assert.equal((await h.seed(false)).status, 401);
    assert.equal(h.state.batchCalls, 0);
    assert.equal(h.state.writes, 0);
  } finally { h.close(); }
});

test("failure in the last competition rolls back the entire sample", async () => {
  const h = harness();
  try {
    h.state.failAt = 604;
    assert.equal((await h.seed()).status, 503);
    assert.equal(h.state.batchCalls, 1);
    assert.ok(Object.values(h.snapshot()).every(rows => rows.length === 0));
  } finally { h.close(); }
});
