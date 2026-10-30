import { test } from "node:test";
import assert from "node:assert/strict";
import { harness } from "./support.mjs";

function payload(h, index = 0, baseBatchId = null) {
  const item = structuredClone(h.fixture.competitions[index]);
  delete item.source.objectKey;
  return { schemaVersion: 2, coverage: "selected-event", baseBatchId,
    review: { reviewer: "Test operator", seasonSourceLabel: "2025-2026", notes: "Reviewed metadata and selected PDF pages.", confirmed: true }, item };
}
async function submit(h, p) {
  const response = await h.request("imports", "POST", p);
  return { status: response.status, ...await response.json() };
}
const publish = (h, id, authorized = true) => h.request("imports/[id]/publish", "POST", undefined, authorized, id);
const report = (h, id, authorized = true) => h.request("imports/[id]", "GET", undefined, authorized, id);

test("both verified formats validate, repeat submission is stable and candidates stay private", async () => {
  const h = harness();
  try {
    for (let index = 0; index < 2; index++) {
      const p = payload(h, index);
      const a = await submit(h, p);
      assert.equal(a.status, "validated", JSON.stringify(a.report));
      assert.equal(a.report.valid, true);
      assert.equal(a.report.warnings[0].code, "SELECTED_EVENT_ONLY");
      assert.equal((await submit(h, JSON.parse(JSON.stringify(p)))).id, a.id);
      assert.equal((await report(h, a.id)).status, 200);
      assert.equal((await report(h, a.id, false)).status, 401);
    }
    assert.equal(h.sqlite.prepare("SELECT count(*) n FROM import_batches").get().n, 2);
    assert.ok(Object.values(h.snapshot()).every(rows => rows.length === 0));
  } finally { h.close(); }
});

test("authorization protects all ingestion operations before storage", async () => {
  const h = harness();
  try {
    assert.equal((await h.request("imports", "POST", payload(h), false)).status, 401);
    assert.equal((await report(h, "0".repeat(64), false)).status, 401);
    assert.equal((await publish(h, "0".repeat(64), false)).status, 401);
    assert.equal(h.state.writes, 0);
    assert.equal(h.state.batchCalls, 0);
  } finally { h.close(); }
});

const invalid = {
  "missing heat": p => { p.item.evidence.race.heats.pop(); },
  "mixed gender or group": p => { p.item.evidence.race.results[0].group_label = "Men"; },
  "wrong timing precision": p => { p.item.evidence.race.results[0].time_microseconds++; },
  "wrong season": p => { p.item.competition.season = "2024-2025"; },
  "invalid date": p => { p.item.competition.startsOn = "2026-02-30"; },
  "conflicting bib identity": p => { p.item.evidence.roster.observations.push({ ...p.item.evidence.roster.observations[0], name: "Other person" }); },
  "unknown result participant": p => { p.item.evidence.race.results[0].bib = "999999"; },
  "duplicate result": p => { p.item.results.push(p.item.results[0]); },
  "lost repeated entry": p => { p.item.entries.pop(); },
  "source hash mismatch": p => { p.item.source.sha256 = "0".repeat(64); },
  "unresolved parsing issue": p => { p.item.evidence.roster.issues.push("Unparsed row"); },
  "unreviewed metadata": p => { p.review.confirmed = false; },
  "unsupported parser": p => { p.item.evidence.race.parser_version = "unknown/1"; },
  "status stored as a time instead of a status": p => { p.item.evidence.race.results[0].time_raw = "DNF"; },
};
for (const [name, mutate] of Object.entries(invalid)) {
  test(`rejected ${name} is reported and cannot publish`, async () => {
    const h = harness();
    try {
      const p = payload(h); mutate(p);
      const response = await h.request("imports", "POST", p);
      assert.equal(response.status, 422);
      const result = await response.json();
      assert.equal(result.status, "rejected");
      assert.ok(result.report.errors.length);
      assert.equal((await publish(h, result.id)).status, 409);
      assert.ok(Object.values(h.snapshot()).every(rows => rows.length === 0));
    } finally { h.close(); }
  });
}

test("publish is atomic, revisioned and idempotent; seed cannot overwrite it", async () => {
  const h = harness();
  try {
    assert.equal((await h.seed()).status, 200);
    const a = await submit(h, payload(h));
    assert.equal((await publish(h, a.id)).status, 200);
    const before = h.snapshot();
    assert.equal(before.participants.length, 289);
    assert.equal(before.entries.length, 290);
    assert.equal(before.results.length, 21);
    assert.equal((await publish(h, a.id)).status, 200);
    assert.deepEqual(h.snapshot(), before);
    assert.equal((await h.seed()).status, 409);
    const p = payload(h, 0, a.id); p.item.competition.location = "Reviewed venue correction";
    const b = await submit(h, p);
    assert.equal((await publish(h, b.id)).status, 200);
    assert.equal((await publish(h, a.id)).status, 409);
    assert.equal((await (await report(h, a.id)).json()).status, "published");
    assert.equal((await (await report(h, b.id)).json()).status, "published");
    assert.equal(h.snapshot().competitions.find(c => c.id === p.item.competition.id).location, p.item.competition.location);
  } finally { h.close(); }
});

test("SQL failure near end of replacement preserves live rows, evidence and publication head", async () => {
  const h = harness();
  try {
    const a = await submit(h, payload(h));
    assert.equal((await publish(h, a.id)).status, 200);
    const before = h.snapshot(), evidence = h.publishedEvidence();
    const p = payload(h, 0, a.id); p.item.competition.title = "Corrected title";
    const b = await submit(h, p);
    const count = p.item.participants.length + p.item.entries.length + p.item.results.length + 10;
    h.state.failAt = h.state.executed + count;
    assert.equal((await publish(h, b.id)).status, 503);
    assert.deepEqual(h.snapshot(), before);
    assert.deepEqual(h.publishedEvidence(), evidence);
    assert.equal(h.sqlite.prepare("SELECT batch_id FROM import_publications").get().batch_id, a.id);
    assert.equal((await (await report(h, b.id)).json()).status, "validated");
    h.state.failAt = null;
    assert.equal((await publish(h, b.id)).status, 200);
  } finally { h.close(); }
});

test("R2 failure and corrupted candidate cannot change published rows", async () => {
  const h = harness();
  try {
    assert.equal((await h.seed()).status, 200);
    const before = h.snapshot();
    const a = await submit(h, payload(h));
    h.state.failWriteAt = h.state.writes + 1;
    assert.equal((await publish(h, a.id)).status, 503);
    assert.deepEqual(h.snapshot(), before);
    h.state.failWriteAt = null;
    h.objects.set(`imports/candidates/${a.id}.json`, "{}");
    assert.equal((await publish(h, a.id)).status, 503);
    assert.deepEqual(h.snapshot(), before);
  } finally { h.close(); }
});

test("concurrent revisions of one competition admit only one winner", async () => {
  const h = harness();
  try {
    const p = payload(h), q = payload(h); q.item.competition.title = "Other revision";
    const a = await submit(h, p), b = await submit(h, q);
    const responses = await Promise.all([publish(h, a.id), publish(h, b.id)]);
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
    assert.equal(h.sqlite.prepare("SELECT count(*) n FROM import_publications").get().n, 1);
    assert.equal(h.sqlite.prepare("SELECT count(*) n FROM import_assertions").get().n, 0);
  } finally { h.close(); }
});

test("chunked body limit and malformed JSON do not write storage", async () => {
  const h = harness();
  try {
    const { POST } = h.load(new URL("../app/api/imports/route.ts", import.meta.url).pathname);
    const headers = { Authorization: "Bearer test-only-seed-token", "Content-Type": "application/json" };
    assert.equal((await POST(new Request("https://example.test", { method: "POST", headers, body: "[" }))).status, 400);
    assert.equal((await POST(new Request("https://example.test", { method: "POST", headers, body: " ".repeat(2 * 1024 * 1024 + 1) }))).status, 413);
    assert.equal(h.state.writes, 0);
  } finally { h.close(); }
});

const detail = (h, id) => h.request("competitions/[id]", "GET", undefined, false, id);
function statusRow(p, status, recordedTime = false) {
  const raw = p.item.evidence.race.results[0], row = p.item.results[0];
  raw.status_raw = row.status = status;
  raw.rank = row.rank = null;
  raw.qualification_raw = row.qualification = null;
  if (!recordedTime) {
    raw.time_raw = row.timeRaw = null;
    raw.time_microseconds = row.timeMicroseconds = null;
  }
  raw.row_raw = `${raw.bib} ${raw.name_raw} ${raw.affiliation_raw}${recordedTime ? ` ${raw.time_raw}` : ""} ${status}`;
}
for (const status of ["PEN", "DNS", "DNF", "DQ"]) {
  test(`${status} is published and readable with absent or retained time`, async () => {
    for (const recordedTime of [false, true]) {
      const h = harness();
      try {
        const p = payload(h); statusRow(p, status, recordedTime);
        const a = await submit(h, p);
        assert.equal(a.status, "validated", JSON.stringify(a.report));
        assert.equal((await publish(h, a.id)).status, 200);
        const response = await detail(h, p.item.competition.id);
        assert.equal(response.status, 200);
        const data = await response.json();
        assert.equal(data.results.length, p.item.results.length);
        const row = data.results.find(r => r.id === p.item.results[0].id);
        assert.equal(row.result_status, status);
        assert.equal(row.rank, null);
        assert.equal(row.time_raw, recordedTime ? p.item.results[0].timeRaw : null);
        assert.equal(row.time_microseconds, recordedTime ? p.item.results[0].timeMicroseconds : null);
        assert.equal(data.results.at(-1).id, row.id, "Status rows must not outrank ordinary timed finishers");
        assert.equal(h.load(new URL("../lib/result-display.ts", import.meta.url).pathname).hasComparableTime(row), false);
        assert.equal(h.load(new URL("../lib/result-display.ts", import.meta.url).pathname).hasComparableTime(data.results[0]), true);
      } finally { h.close(); }
    }
  });
}

test("status corruption and a missing ordinary finishing time are rejected", async () => {
  const h = harness();
  try {
    const inconsistent = payload(h); statusRow(inconsistent, "PEN");
    inconsistent.item.evidence.race.results[0].status_raw = null;
    assert.equal((await submit(h, inconsistent)).report.valid, false);
    const missing = payload(h);
    missing.item.evidence.race.results[0].time_raw = null;
    missing.item.evidence.race.results[0].time_microseconds = null;
    missing.item.results[0].timeRaw = null;
    missing.item.results[0].timeMicroseconds = null;
    assert.equal((await submit(h, missing)).report.valid, false);
    const old = payload(h); old.schemaVersion = 1;
    old.item.evidence.race.parser_version = "tempus-complete-event/0.1";
    assert.equal((await submit(h, old)).report.valid, false, "Old parser batches must be regenerated with status support");
  } finally { h.close(); }
});

test("detail metadata, source and rows stay on the same revision when a publisher intervenes", async () => {
  const h = harness();
  try {
    const p = payload(h), a = await submit(h, p);
    assert.equal((await publish(h, a.id)).status, 200);
    const q = payload(h, 0, a.id);
    q.item.competition.title = "Corrected competition title";
    const person = q.item.participants.find(p => p.id === q.item.results[0].participantId);
    const oldName = person.name, name = "Corrected source name";
    person.name = name;
    for (const entry of q.item.entries.filter(e => e.participantId === person.id)) entry.rawName = name;
    for (const raw of q.item.evidence.roster.observations.filter(o => o.bib === person.bib)) { raw.name = name; raw.raw_name = name; }
    for (const raw of q.item.evidence.race.results.filter(r => r.bib === person.bib)) { raw.name_raw = name; raw.row_raw = raw.row_raw.replace(oldName, name); }
    const b = await submit(h, q);
    assert.equal(b.status, "validated", JSON.stringify(b.report));
    let publications = 0;
    const intervene = async () => {
      h.state.afterFirst = h.state.beforeReadBatch = null;
      assert.equal((await publish(h, b.id)).status, 200);
      publications++;
    };
    // Exercise either the former gap after a standalone metadata read or the
    // new boundary before the single read transaction.
    h.state.afterFirst = h.state.beforeReadBatch = intervene;
    const data = await (await detail(h, p.item.competition.id)).json();
    assert.equal(publications, 1);
    assert.equal(data.competition.title, q.item.competition.title);
    assert.equal(data.competition.source_id, h.snapshot().competitions[0].source_id);
    assert.equal(data.participants.find(p => p.id === person.id).name, name);
    assert.equal(data.entries.find(e => e.participant_id === person.id).raw_name, name);
    assert.equal(data.results.length, q.item.results.length);
  } finally { h.close(); }
});

test("61 and 80 character competition IDs can be imported, listed and opened", async () => {
  const { createHash } = await import("node:crypto");
  for (const size of [61, 80]) {
    const h = harness();
    try {
      const p = payload(h), previous = p.item.competition.id, id = "c".repeat(size);
      p.item.competition.id = id;
      for (const row of p.item.participants) row.id = row.id.replace(previous, id);
      for (const row of p.item.entries) { row.id = row.id.replace(previous, id); row.participantId = row.participantId.replace(previous, id); }
      for (const row of p.item.results) {
        row.id = row.id.replace(previous, id); row.participantId = row.participantId.replace(previous, id);
        row.eventKey = createHash("sha256").update(`${id}|${row.eventLabel}`).digest("hex").slice(0, 20);
      }
      const a = await submit(h, p);
      assert.equal(a.status, "validated", JSON.stringify(a.report));
      assert.equal((await publish(h, a.id)).status, 200);
      assert.equal((await detail(h, id)).status, 200);
      const listing = await (await h.request("competitions", "GET")).json();
      assert.equal(listing.competitions[0].id, id);
      const tooLong = structuredClone(p); tooLong.item.competition.id = "c".repeat(81);
      assert.equal((await submit(h, tooLong)).report.valid, false);
      assert.equal((await detail(h, "c".repeat(81))).status, 404);
    } finally { h.close(); }
  }
});
