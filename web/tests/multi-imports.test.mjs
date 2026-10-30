import { test } from "node:test";
import assert from "node:assert/strict";
import { harness, multiFixture } from "./support.mjs";

function payload(index = 0, baseBatchId = null) {
  const item = multiFixture().competitions[index];
  delete item.source.objectKey;
  return { schemaVersion: 3, coverage: "selected-events", baseBatchId,
    review: { reviewer: "Test operator", seasonSourceLabel: "2025-2026", notes: "Checked all selected source events.", confirmed: true }, item };
}
async function submit(h, p) {
  const response = await h.request("imports", "POST", p);
  return { status: response.status, body: await response.json() };
}
const publish = (h, id) => h.request("imports/[id]/publish", "POST", undefined, true, id);
const detail = async (h, id) => (await h.request("competitions/[id]", "GET", undefined, false, id)).json();
function firstOnly(p, version = 3) {
  const first = p.item.evidence.events[0];
  p.item.results = p.item.results.filter(r => r.eventLabel === first.event_label_raw);
  p.item.evidence = version === 2 ? { roster: p.item.evidence.roster, race: first } : { roster: p.item.evidence.roster, events: [first] };
  p.schemaVersion = version; p.coverage = version === 2 ? "selected-event" : "selected-events";
  return p;
}

test("both disciplines publish complete independent events with explicit partial coverage", async () => {
  const h = harness();
  try {
    for (const index of [0, 1]) {
      const p = payload(index), submitted = await submit(h, p), a = submitted.body;
      assert.equal(submitted.status, 200, JSON.stringify(a.report));
      assert.equal(a.report.counts.events, 2);
      assert.equal(a.report.events.length, 2);
      assert.ok(a.report.events.every(e => e.valid));
      assert.equal((await submit(h, p)).body.id, a.id);
      assert.equal((await publish(h, a.id)).status, 200);
      const before = h.snapshot();
      assert.equal((await publish(h, a.id)).status, 200);
      assert.deepEqual(h.snapshot(), before);
      const d = await detail(h, p.item.competition.id);
      assert.equal(d.coverage.completeCompetition, false);
      assert.equal(d.coverage.eventCount, 2);
      assert.equal(d.results.length, index === 0 ? 53 : 14);
      assert.deepEqual(d.events.map(e => e.source_event_number), index === 0 ? ["1", "2"] : ["1", "6"]);
      assert.deepEqual(d.events.map(e => e.result_count), index === 0 ? [14, 39] : [7, 7]);
      assert.deepEqual(d.events.map(e => e.heat_count), index === 0 ? [3, 7] : [1, 1]);
      for (const e of d.events) {
        const rows = d.results.filter(r => r.event_key === e.id);
        assert.ok(rows.every(r => r.event_label === e.label));
        assert.ok(rows.every(r => r.distance === e.distance && r.round === e.round));
        assert.equal(rows.length, e.result_count);
      }
      const evidence = h.publishedEvidence().map(JSON.parse).find(e => e.events?.length === 2 && e.roster.source_id === p.item.source.id);
      assert.ok(evidence);
    }
    assert.equal(h.snapshot().competition_events.length, 4);
    const listing = await (await h.request("competitions", "GET")).json();
    assert.deepEqual(listing.competitions.map(c => c.event_count), [2, 2]);
    const pen = h.snapshot().results.find(r => r.result_status === "PEN");
    assert.ok(pen);
    assert.equal(pen.time_microseconds, null);
  } finally { h.close(); }
});

test("a later invalid event rejects the candidate without touching the prior publication", async () => {
  const h = harness();
  try {
    const a = (await submit(h, firstOnly(payload()))).body;
    assert.equal((await publish(h, a.id)).status, 200);
    const before = h.snapshot();
    const p = payload(0, a.id); p.item.evidence.events[1].heats.pop();
    const b = await submit(h, p);
    assert.equal(b.status, 422);
    assert.equal(b.body.report.events[0].valid, true);
    assert.equal(b.body.report.events[1].valid, false);
    assert.ok(b.body.report.errors.some(e => e.path.includes("events.1")));
    assert.equal((await publish(h, b.body.id)).status, 409);
    assert.deepEqual(h.snapshot(), before);
  } finally { h.close(); }
});

const invalid = {
  "duplicate source events": p => { p.item.evidence.events[1].event_number = "1"; },
  "duplicate source race": p => { p.item.evidence.events[1].heats[0].race_id = "101"; },
  "mixed group": p => { p.item.evidence.events[1].results[0].group_label = "Other group"; },
  "source revision mismatch": p => { p.item.evidence.events[1].sha256 = "0".repeat(64); },
  "undeclared result": p => { p.item.results.push({ ...p.item.results[0], id: "unlisted-result", eventKey: "unlisted-event" }); },
};
for (const [name, mutate] of Object.entries(invalid)) {
  test(`multi-event validation rejects ${name}`, async () => {
    const h = harness();
    try {
      const p = payload(); mutate(p);
      const a = await submit(h, p);
      assert.equal(a.status, 422);
      assert.ok(a.body.report.errors.length);
      assert.equal((await publish(h, a.body.id)).status, 409);
      assert.equal(h.snapshot().results.length, 0);
    } finally { h.close(); }
  });
}

test("single-event legacy data expands without losing original rows or source evidence", async () => {
  const h = harness();
  try {
    assert.equal((await h.seed()).status, 200);
    // Simulate the new schema over legacy rows, before any event-table data exists.
    h.sqlite.exec("DELETE FROM competition_events");
    const legacy = await detail(h, "st-agn-2026");
    assert.equal(legacy.events.length, 1);
    assert.equal(legacy.events[0].result_count, 14);
    const originalIds = legacy.results.map(r => r.id), priorEvidence = h.publishedEvidence();
    const p = payload(), a = (await submit(h, p)).body;
    assert.equal((await publish(h, a.id)).status, 200);
    const expanded = await detail(h, "st-agn-2026");
    assert.equal(expanded.events.length, 2);
    assert.ok(originalIds.every(id => expanded.results.some(r => r.id === id)));
    for (const old of priorEvidence) assert.ok([...h.objects.values()].includes(old));
  } finally { h.close(); }
});

test("neither v2 nor v3 candidates can accidentally remove a published event", async () => {
  for (const version of [2, 3]) {
    const h = harness();
    try {
      const a = (await submit(h, payload())).body;
      assert.equal((await publish(h, a.id)).status, 200);
      const before = h.snapshot();
      const p = firstOnly(payload(0, a.id), version), b = (await submit(h, p)).body;
      assert.equal(b.report.valid, true);
      const response = await publish(h, b.id);
      assert.equal(response.status, 409);
      assert.match((await response.json()).error, /previously published events/);
      assert.deepEqual(h.snapshot(), before);
    } finally { h.close(); }
  }
});

test("SQL failure inside a later event preserves all live rows, event metadata and head", async () => {
  const h = harness();
  try {
    const a = (await submit(h, firstOnly(payload()))).body;
    assert.equal((await publish(h, a.id)).status, 200);
    const before = h.snapshot(), evidence = h.publishedEvidence();
    const p = payload(0, a.id), b = (await submit(h, p)).body;
    h.state.failAt = h.state.executed + p.item.participants.length + p.item.entries.length + 30;
    assert.equal((await publish(h, b.id)).status, 503);
    assert.deepEqual(h.snapshot(), before);
    assert.deepEqual(h.publishedEvidence(), evidence);
    assert.equal(h.sqlite.prepare("SELECT batch_id FROM import_publications").get().batch_id, a.id);
    h.state.failAt = null;
    assert.equal((await publish(h, b.id)).status, 200);
    assert.equal((await detail(h, p.item.competition.id)).results.length, 53);
  } finally { h.close(); }
});

test("the transaction coverage guard prevents loss when bootstrap wins the first-publish race", async () => {
  const h = harness(multiFixture());
  try {
    const a = (await submit(h, firstOnly(payload()))).body;
    h.state.beforeWriteBatch = async () => { assert.equal((await h.seed()).status, 200); };
    const response = await publish(h, a.id);
    assert.equal(response.status, 409);
    assert.match((await response.json()).error, /coverage changed/);
    assert.equal(h.snapshot().results.length, 67);
    assert.equal(h.snapshot().competition_events.length, 4);
    assert.equal(h.sqlite.prepare("SELECT count(*) n FROM import_publications").get().n, 0);
  } finally { h.close(); }
});
