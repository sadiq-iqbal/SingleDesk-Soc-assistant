import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEVELOPMENT_SUITE,
  evaluateSuite,
  parseSuite,
} from "../dist/evaluation.mjs";
import { analyze, explain } from "../dist/core.mjs";

test("development evaluation exposes a known false positive and miss", () => {
  const r = evaluateSuite(DEVELOPMENT_SUITE);
  assert.equal(r.caseCount, 12);
  assert.equal(r.exactMatches, 10);
  assert.deepEqual(
    [r.totals.tp, r.totals.fp, r.totals.fn, r.totals.tn],
    [7, 1, 1, 27],
  );
  assert.equal(r.totals.precision, 0.875);
  assert.equal(r.totals.recall, 0.875);
  assert.deepEqual(r.cases.find((c) => c.id === "D09").falsePositives, [
    "AUTH-001",
  ]);
  assert.deepEqual(r.cases.find((c) => c.id === "D10").falseNegatives, [
    "AUTH-001",
  ]);
});
test("no-positive suites return undefined precision and recall as null", () => {
  const r = evaluateSuite({
    name: "Negative only",
    cases: [DEVELOPMENT_SUITE.cases[0]],
  });
  assert.equal(r.totals.precision, null);
  assert.equal(r.totals.recall, null);
});
test("suite validation rejects duplicate cases, invalid labels and malformed events", () => {
  const suite = () => structuredClone(DEVELOPMENT_SUITE);
  const duplicate = suite();
  duplicate.cases.push(duplicate.cases[0]);
  assert.throws(() => parseSuite(JSON.stringify(duplicate)), /unique ID/);
  const invalid = suite();
  invalid.cases[0].expected = ["FAKE"];
  assert.throws(() => parseSuite(JSON.stringify(invalid)), /supported rule/);
  const broken = suite();
  broken.cases[0].events.push({});
  assert.throws(() => parseSuite(JSON.stringify(broken)), /invalid events/);
  assert.throws(() => parseSuite("{"), /valid JSON/);
});
test("equivalent IPv6 spellings correlate and cross-date explanations retain dates", () => {
  const source = structuredClone(
    DEVELOPMENT_SUITE.cases.find((c) => c.id === "D12").events,
  );
  source[1].source_ip = "2001:0DB8:0000:0000:0000:0000:0000:0010";
  assert.equal(analyze(JSON.stringify(source)).findings.length, 1);
  const midnight = analyze(
    JSON.stringify(DEVELOPMENT_SUITE.cases.find((c) => c.id === "D11").events),
  );
  assert.match(explain(midnight.findings[0]), /2026-10-09.*2026-10-10/);
});
test("success correlation counts failures since the previous successful session", () => {
  const events = structuredClone(
    DEVELOPMENT_SUITE.cases.find((c) => c.id === "D04").events,
  );
  events[1].status = "success";
  const r = analyze(JSON.stringify(events));
  assert.equal(r.findings.length, 0);
});
