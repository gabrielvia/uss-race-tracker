import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { harness, multiFixture } from "./support.mjs";

const read = name => JSON.parse(readFileSync(new URL(`../../data/samples/${name}`, import.meta.url), "utf8"));
const groupA = read("short-track-agn-event-9-group-a.json");
const groupB = read("short-track-agn-event-9-group-b.json");
const annotated = read("long-track-agn-event-5.json");
function payload(index, additions) {
  const item = multiFixture().competitions[index];
  delete item.source.objectKey;
  for (const event of additions) {
    item.evidence.events.push(structuredClone(event));
    for (const r of event.results) {
      const c = item.competition.id;
      item.results.push({ id: `${c}:${r.race_id}:${r.bib}`, participantId: `${c}:${r.bib}`, raceId: r.race_id,
        distance: r.distance_metres, round: r.round_raw, rank: r.rank, status: r.status_raw,
        timeRaw: r.time_raw, timeMicroseconds: r.time_microseconds, qualification: r.qualification_raw,
        sourcePage: r.source_page, eventKey: createHash("sha256").update(`${c}|${r.event_label_raw}`).digest("hex").slice(0, 20),
        eventLabel: r.event_label_raw, raceLabel: r.race_label_raw, heatNumber: r.heat_number, heatTotal: r.heat_total });
    }
  }
  return { schemaVersion: 3, coverage: "selected-events", baseBatchId: null,
    review: { reviewer: "Test operator", seasonSourceLabel: "2025-2026", notes: "Checked group headings and age-annotated source names.", confirmed: true }, item };
}

test("the Python and server name matchers agree on exact annotation cases", () => {
  const h = harness();
  try {
    const { resultNameMatches } = h.load(new URL("../lib/imports/identity.ts", import.meta.url).pathname);
    const cases = JSON.parse(readFileSync(new URL("../../tests/fixtures/tempus-name-cases.json", import.meta.url), "utf8"));
    for (const c of cases) assert.equal(resultNameMatches(c.result, c), c.valid, JSON.stringify(c));
  } finally { h.close(); }
});

test("same-number Group A and B events publish independently and retain coverage protection", async () => {
  const h = harness();
  try {
    const p = payload(0, [groupA, groupB]);
    const submitted = await h.request("imports", "POST", p), batch = await submitted.json();
    assert.equal(submitted.status, 200, JSON.stringify(batch.report));
    assert.equal(batch.report.validationVersion, "competition-events/6");
    assert.equal(batch.report.events.filter(e => e.sourceEventNumber === "9").length, 2);
    assert.equal((await h.request("imports/[id]/publish", "POST", undefined, true, batch.id)).status, 200);
    const detail = await (await h.request("competitions/[id]", "GET", undefined, false, p.item.competition.id)).json();
    assert.equal(detail.events.length, 4);
    const groups = detail.events.filter(e => e.source_event_number === "9");
    assert.equal(new Set(groups.map(e => e.id)).size, 2);
    assert.deepEqual(groups.map(e => [e.group_label, e.result_count, e.heat_count]).sort(),
      [["Group A Junior E Women's", 10, 2], ["Group B Junior E Women's", 4, 1]]);
    for (const event of groups) assert.ok(detail.results.filter(r => r.event_key === event.id).every(r => r.event_label === event.label));
    const before = h.snapshot(), reduced = payload(0, [groupA]); reduced.baseBatchId = batch.id;
    const b = await (await h.request("imports", "POST", reduced)).json();
    assert.equal(b.report.valid, true);
    assert.equal((await h.request("imports/[id]/publish", "POST", undefined, true, b.id)).status, 409);
    assert.deepEqual(h.snapshot(), before);
  } finally { h.close(); }
});

test("annotated source names publish under exact roster identities with original evidence intact", async () => {
  const h = harness();
  try {
    const p = payload(1, [annotated]);
    const response = await h.request("imports", "POST", p), batch = await response.json();
    assert.equal(response.status, 200, JSON.stringify(batch.report));
    assert.equal((await h.request("imports/[id]/publish", "POST", undefined, true, batch.id)).status, 200);
    const people = h.snapshot().participants;
    assert.equal(people.find(p => p.bib === "366").name, "Keeley Whitcomb");
    const evidence = h.publishedEvidence().map(JSON.parse).find(e => e.events?.some(event => event.event_number === "5"));
    assert.deepEqual(evidence.events.find(e => e.event_number === "5"), annotated);
    assert.equal(h.snapshot().results.length, 18);
  } finally { h.close(); }
});

const invalidNames = {
  "unrecorded category": ["RESULT_IDENTITY", (r, p) => { r.name_raw = "Keeley Whitcomb (Jr B)"; r.row_raw = r.row_raw.replace("(Jr A)", "(Jr B)"); }],
  "spelling alias": ["RESULT_IDENTITY", r => { r.name_raw = "Keely Whitcomb (Jr A)"; r.row_raw = r.row_raw.replace("Keeley", "Keely"); }],
  "unrecognized annotation": ["ROSTER_NAME", (r, p) => { p.item.evidence.roster.observations.find(o => o.bib === r.bib).raw_name = "Keeley Whitcomb (Alias)"; }],
  "missing age evidence": ["ROSTER_NAME", (r, p) => { p.item.evidence.roster.observations.find(o => o.bib === r.bib).age_status_raw = null; }],
  "changed affiliation": ["RESULT_IDENTITY", r => { r.affiliation_raw = "Another Club"; }],
  "discarded raw annotation": ["RESULT_NAME_SOURCE", r => { r.name_raw = "Keeley Whitcomb"; }],
  "invented raw source": ["RESULT_NAME_SOURCE", r => { r.row_raw = r.row_raw.replace("Keeley", "Different"); }],
};
for (const [name, [code, mutate]] of Object.entries(invalidNames)) {
  test(`annotation support rejects ${name}`, async () => {
    const h = harness();
    try {
      const p = payload(1, [annotated]), r = p.item.evidence.events.at(-1).results[0];
      mutate(r, p);
      const response = await h.request("imports", "POST", p), batch = await response.json();
      assert.equal(response.status, 422);
      assert.ok(batch.report.errors.some(e => e.code === code), JSON.stringify(batch.report));
      assert.equal((await h.request("imports/[id]/publish", "POST", undefined, true, batch.id)).status, 409);
      assert.equal(h.snapshot().results.length, 0);
    } finally { h.close(); }
  });
}
