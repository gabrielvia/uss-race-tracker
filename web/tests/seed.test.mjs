import { test } from "node:test";
import assert from "node:assert/strict";
import { harness } from "./support.mjs";

test("SQL failure leaves no partial competition and readiness stays false", async () => {
  const h = harness();
  try {
    h.state.failAt = 45;
    assert.equal((await h.seed()).status, 503);
    assert.equal(h.state.batchCalls, 1);
    assert.deepEqual(Object.fromEntries(Object.entries(h.snapshot()).map(([key, rows]) => [key, rows.length])), { sources: 0, competitions: 0, participants: 0, entries: 0, results: 0, competition_events: 0 });
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
    h.state.failAt = 608;
    assert.equal((await h.seed()).status, 503);
    assert.equal(h.state.batchCalls, 1);
    assert.ok(Object.values(h.snapshot()).every(rows => rows.length === 0));
  } finally { h.close(); }
});
