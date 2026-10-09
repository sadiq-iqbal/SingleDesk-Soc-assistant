import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze, parseLogs, sampleLogs, MAX_EVENTS } from "../dist/core.mjs";
const e = (seconds, user = "admin", ip = "192.0.2.1", status = "failure") => ({
  timestamp: new Date(Date.UTC(2026, 9, 9, 9, 0, seconds)).toISOString(),
  source_ip: ip,
  username: user,
  status,
});
test("mixed sample yields the three expected findings and normal sample yields none", () => {
  assert.deepEqual(
    analyze(sampleLogs())
      .findings.map((f) => f.ruleId)
      .sort(),
    ["AUTH-001", "AUTH-002", "AUTH-003"],
  );
  assert.equal(analyze(sampleLogs("normal")).findings.length, 0);
  assert.deepEqual(
    analyze(sampleLogs("spray")).findings.map((f) => f.ruleId),
    ["AUTH-002"],
  );
});
test("rule thresholds are inclusive and events outside the window do not qualify", () => {
  assert.equal(
    analyze(JSON.stringify([0, 60, 120, 180, 300].map((s) => e(s)))).findings
      .length,
    1,
  );
  assert.equal(
    analyze(JSON.stringify([0, 61, 122, 183, 301].map((s) => e(s)))).findings
      .length,
    0,
  );
  assert.equal(
    analyze(JSON.stringify([0, 1, 2, 3].map((s) => e(s)))).findings.length,
    0,
  );
});
test("spray rule counts unique users, not just attempts", () => {
  assert.ok(
    !analyze(JSON.stringify([0, 1, 2, 3, 4].map((s) => e(s)))).findings.some(
      (f) => f.ruleId === "AUTH-002",
    ),
  );
  assert.ok(
    analyze(
      JSON.stringify([0, 1, 2, 3, 4].map((s) => e(s, "u" + s))),
    ).findings.some((f) => f.ruleId === "AUTH-002"),
  );
});
test("success correlation requires matching account, source and time", () => {
  const f = [e(0), e(1), e(2)];
  assert.equal(
    analyze(JSON.stringify([...f, e(3, "admin", "192.0.2.1", "success")]))
      .findings.length,
    1,
  );
  for (const success of [
    e(3, "other", "192.0.2.1", "success"),
    e(3, "admin", "192.0.2.2", "success"),
    e(603, "admin", "192.0.2.1", "success"),
  ])
    assert.equal(analyze(JSON.stringify([...f, success])).findings.length, 0);
});
test("out-of-order logs are sorted without changing original evidence identifiers", () => {
  const r = analyze(
    JSON.stringify([e(3, "admin", "192.0.2.1", "success"), e(2), e(0), e(1)]),
  );
  assert.equal(r.events.at(-1).id, "E1");
  assert.deepEqual(r.findings[0].evidenceIds, ["E3", "E4", "E2", "E1"]);
});
test("CSV supports quoted commas and escaped quotes", () => {
  const r = parseLogs(
    'timestamp,source_ip,username,status\n2026-10-09T09:00:00Z,192.0.2.1,"a,""b""",failed',
  );
  assert.equal(r.events[0].username, 'a,"b"');
});
test("malformed records are surfaced and valid records survive", () => {
  const r = parseLogs(
    JSON.stringify([
      e(0),
      { ...e(1), source_ip: "999.0.0.1" },
      { ...e(2), timestamp: "2026-02-30T00:00:00Z" },
      { ...e(3), timestamp: "2026-10-09 09:00:00" },
    ]),
  );
  assert.equal(r.events.length, 1);
  assert.equal(r.issues.length, 3);
});
test("SSH ISO timestamps supported, yearless syslog rejected", () => {
  assert.equal(
    parseLogs(
      "2026-10-09T09:00:00Z host sshd[12]: Failed password for invalid user root from 192.0.2.2 port 2234 ssh2",
    ).events[0].status,
    "failure",
  );
  assert.throws(() =>
    parseLogs(
      "Oct 9 09:00:00 host sshd[12]: Failed password for root from 192.0.2.2 port 2234 ssh2",
    ),
  );
});
test("duplicate-looking rows retained with a warning count; NDJSON and IPv6 supported", () => {
  const r = parseLogs(
    [e(0), e(0), e(2, "bob", "2001:db8::1")].map(JSON.stringify).join("\n"),
  );
  assert.equal(r.duplicates, 1);
  assert.equal(r.events.length, 3);
});
test("empty, excessive or broken input rejected", () => {
  assert.throws(() => parseLogs(""));
  assert.throws(() => parseLogs("[not valid]"));
  assert.throws(() => parseLogs("x".repeat(2 * 1024 * 1024 + 1)));
  assert.throws(() =>
    parseLogs(JSON.stringify(Array(MAX_EVENTS + 1).fill(e(0)))),
  );
});
test("unknown outcomes are not treated as failures", () => {
  const r = parseLogs(JSON.stringify([e(0), e(1, "a", "192.0.2.1", "logout")]));
  assert.equal(r.events.length, 1);
  assert.equal(r.issues.length, 1);
});
