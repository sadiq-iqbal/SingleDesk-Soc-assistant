import { analyze, RULES, MAX_BYTES } from "./core.mjs";

// These are development examples, not a held-out research benchmark.
const event = (
  seconds,
  user = "admin",
  ip = "192.0.2.10",
  status = "failure",
) => ({
  timestamp: new Date(Date.UTC(2026, 9, 9, 9, 0, seconds)).toISOString(),
  source_ip: ip,
  username: user,
  status,
});
const failures = (times, user = "admin", ip = "192.0.2.10") =>
  times.map((t) => event(t, user, ip));
const fixture = (id, name, events, expected, note) => ({
  id,
  name,
  events,
  expected,
  note,
});
export const DEVELOPMENT_SUITE = {
  name: "Synthetic development examples v1",
  provenance:
    "Hand-authored synthetic scenarios. Expected rule labels describe which activity an analyst should review, using the scenario context. Not independent or representative of production traffic.",
  cases: [
    fixture(
      "D01",
      "Ordinary successful sign-ins",
      [
        event(0, "sara", "192.0.2.20", "success"),
        event(30, "omar", "192.0.2.21", "success"),
      ],
      [],
      "No failures.",
    ),
    fixture(
      "D02",
      "A corrected password",
      [event(0), event(15), event(40, "admin", "192.0.2.10", "success")],
      [],
      "Two mistakes followed by success; below the review threshold.",
    ),
    fixture(
      "D03",
      "Rapid attempts on one account",
      failures([0, 20, 40, 60, 80]),
      ["AUTH-001"],
      "Five failures within five minutes.",
    ),
    fixture(
      "D04",
      "Failures followed by success",
      [...failures([0, 20, 40]), event(60, "admin", "192.0.2.10", "success")],
      ["AUTH-003"],
      "Investigate the successful session; compromise is not assumed.",
    ),
    fixture(
      "D05",
      "Multiple accounts from one source",
      [0, 1, 2, 3, 4].map((i) => event(i * 30, "account" + i)),
      ["AUTH-002"],
      "Five distinct accounts in a short period.",
    ),
    fixture(
      "D06",
      "Mixed repeated failures and success",
      [
        ...failures([0, 20, 40, 60, 80]),
        event(100, "admin", "192.0.2.10", "success"),
      ],
      ["AUTH-001", "AUTH-003"],
      "Two different rule labels are expected.",
    ),
    fixture(
      "D07",
      "Separate sources, unrelated accounts",
      [0, 1, 2, 3, 4].map((i) =>
        event(i * 10, "account" + i, "192.0.2." + (30 + i)),
      ),
      [],
      "Events must not be merged into a spray from one source.",
    ),
    fixture(
      "D08",
      "Successful session from a different source",
      [...failures([0, 10, 20]), event(30, "admin", "192.0.2.11", "success")],
      [],
      "Success correlation requires the same source and account.",
    ),
    fixture(
      "D09",
      "Known benign maintenance retries",
      failures([0, 15, 30, 45, 60], "backup-service"),
      [],
      "Intentional false-positive example: maintenance context is known to the labeler but absent from the logs.",
    ),
    fixture(
      "D10",
      "Slow attempts requiring review",
      failures([0, 360, 720, 1080, 1440]),
      ["AUTH-001"],
      "Intentional miss: the labelled suspicious sequence is too slow for the current five-minute rule.",
    ),
    fixture(
      "D11",
      "Failures spanning midnight",
      [
        ...failures([53950, 53970, 53990]),
        event(54010, "admin", "192.0.2.10", "success"),
      ],
      ["AUTH-003"],
      "UTC dates must be retained when events cross midnight.",
    ),
    fixture(
      "D12",
      "IPv6 source",
      failures([0, 20, 40, 60, 80], "admin", "2001:db8::10"),
      ["AUTH-001"],
      "IPv6 is handled the same way as IPv4.",
    ),
  ],
};

export function validateSuite(value) {
  if (
    !value ||
    typeof value !== "object" ||
    !Array.isArray(value.cases) ||
    !value.cases.length ||
    value.cases.length > 100
  )
    throw Error("Provide a suite with 1–100 cases.");
  if (
    typeof value.name !== "string" ||
    !value.name.trim() ||
    value.name.length > 200
  )
    throw Error("The suite needs a name of up to 200 characters.");
  const ids = new Set();
  for (const c of value.cases) {
    if (
      !c ||
      typeof c.id !== "string" ||
      !c.id ||
      c.id.length > 80 ||
      ids.has(c.id)
    )
      throw Error("Each case needs a unique ID of up to 80 characters.");
    ids.add(c.id);
    if (typeof c.name !== "string" || !c.name.trim() || c.name.length > 200)
      throw Error(`Case ${c.id} needs a name.`);
    if (!Array.isArray(c.events) || !c.events.length || c.events.length > 2000)
      throw Error(`Case ${c.id}: provide 1–2,000 events.`);
    if (
      !Array.isArray(c.expected) ||
      new Set(c.expected).size !== c.expected.length ||
      c.expected.some((id) => !RULES.some((r) => r.id === id))
    )
      throw Error(
        `Case ${c.id}: expected must contain unique supported rule IDs.`,
      );
    if (
      c.note !== undefined &&
      (typeof c.note !== "string" || c.note.length > 2000)
    )
      throw Error(`Case ${c.id}: note must be text up to 2,000 characters.`);
    const parsed = analyze(JSON.stringify(c.events));
    if (parsed.issues.length)
      throw Error(
        `Case ${c.id} contains invalid events. Fix them before evaluation.`,
      );
  }
  return value;
}
export function parseSuite(text) {
  if (new TextEncoder().encode(text).length > MAX_BYTES)
    throw Error("Evaluation file exceeds 2 MB.");
  let suite;
  try {
    suite = JSON.parse(text);
  } catch {
    throw Error("Evaluation file must contain valid JSON.");
  }
  return validateSuite(suite);
}
export function evaluateSuite(suite) {
  validateSuite(suite);
  const perRule = RULES.map((r) => ({
    id: r.id,
    name: r.name,
    tp: 0,
    fp: 0,
    fn: 0,
    tn: 0,
  }));
  const cases = suite.cases.map((c) => {
    const actual = [
      ...new Set(
        analyze(JSON.stringify(c.events)).findings.map((f) => f.ruleId),
      ),
    ];
    const expected = c.expected;
    const falsePositives = actual.filter((id) => !expected.includes(id));
    const falseNegatives = expected.filter((id) => !actual.includes(id));
    for (const metric of perRule) {
      const has = actual.includes(metric.id),
        wanted = expected.includes(metric.id);
      metric[has ? (wanted ? "tp" : "fp") : wanted ? "fn" : "tn"]++;
    }
    return {
      id: c.id,
      name: c.name,
      expected,
      actual,
      falsePositives,
      falseNegatives,
      match: !falsePositives.length && !falseNegatives.length,
      note: c.note ?? "",
    };
  });
  const totals = perRule.reduce(
    (a, r) => ({
      tp: a.tp + r.tp,
      fp: a.fp + r.fp,
      fn: a.fn + r.fn,
      tn: a.tn + r.tn,
    }),
    { tp: 0, fp: 0, fn: 0, tn: 0 },
  );
  const metrics = (m) => ({
    ...m,
    precision: m.tp + m.fp ? m.tp / (m.tp + m.fp) : null,
    recall: m.tp + m.fn ? m.tp / (m.tp + m.fn) : null,
    f1: 2 * m.tp + m.fp + m.fn ? (2 * m.tp) / (2 * m.tp + m.fp + m.fn) : null,
  });
  return {
    suite: suite.name,
    provenance:
      suite.provenance ??
      "User-provided labels; independence and quality have not been verified.",
    unit: "One case × one rule label; multiple alerts with the same rule in a case count once.",
    caseCount: cases.length,
    exactMatches: cases.filter((c) => c.match).length,
    totals: metrics(totals),
    perRule: perRule.map(metrics),
    cases,
  };
}
