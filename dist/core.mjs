export const MAX_BYTES = 2 * 1024 * 1024;
export const MAX_EVENTS = 20000;
export const RULES = [
  {
    id: "AUTH-001",
    name: "Repeated login failures",
    severity: "medium",
    threshold: 5,
    window: 5 * 60 * 1000,
    description:
      "At least 5 failed sign-ins for the same account from the same source IP within 5 minutes.",
    caveat:
      "A mistyped password, stale service credential, or automated retry can produce this pattern.",
    steps: [
      "Check whether the user recognizes these attempts.",
      "Compare the source with expected devices or networks.",
      "Inspect nearby successful sign-ins before deciding on a response.",
    ],
  },
  {
    id: "AUTH-002",
    name: "Possible password spraying",
    severity: "high",
    threshold: 5,
    window: 10 * 60 * 1000,
    description:
      "Failed sign-ins against at least 5 different accounts from one source IP within 10 minutes.",
    caveat:
      "Shared networks, proxies, and misconfigured services may group legitimate users under one IP. Password contents are not observed.",
    steps: [
      "Check whether the source is a shared gateway or known service.",
      "Review which accounts were targeted and whether any later succeeded.",
      "Ask the responsible analyst to validate the pattern before acting.",
    ],
  },
  {
    id: "AUTH-003",
    name: "Success after repeated failures",
    severity: "high",
    threshold: 3,
    window: 10 * 60 * 1000,
    description:
      "A successful login follows at least 3 failures since the previous success, for the same account and source IP within 10 minutes.",
    caveat:
      "The user may simply have remembered their password. This sequence alone does not confirm compromise.",
    steps: [
      "Verify the successful sign-in with the account owner.",
      "Review device, location, and MFA context if available in other systems.",
      "Inspect subsequent account activity for unexpected changes.",
    ],
  },
];
const failed = new Set([
  "failure",
  "failed",
  "fail",
  "denied",
  "invalid",
  "authentication_failure",
  "login_failed",
]);
const succeeded = new Set([
  "success",
  "successful",
  "accepted",
  "ok",
  "authentication_success",
  "login_success",
]);
function csvRows(text) {
  let rows = [],
    row = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (!quoted && cell.length)
        throw Error("Unexpected quote in CSV field.");
      else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw Error("CSV contains an unclosed quote.");
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}
function ipValid(ip) {
  if (ip.includes(":")) {
    if (!/^[\da-f:.]+$/i.test(ip)) return false;
    try {
      new URL("http://[" + ip + "]/");
      return true;
    } catch {
      return false;
    }
  }
  const a = ip.split(".");
  return (
    a.length === 4 && a.every((x) => /^\d{1,3}$/.test(x) && Number(x) <= 255)
  );
}
function timestamp(raw) {
  if (
    typeof raw !== "string" ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/i.test(
      raw,
    )
  )
    throw Error("timestamp must be ISO 8601 with a timezone");
  const date = raw.slice(0, 10),
    [y, m, d] = date.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (m < 1 || m > 12 || d < 1 || d > days)
    throw Error("invalid calendar date");
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) throw Error("invalid timestamp");
  return ms;
}
function sshRecord(line) {
  const m = line.match(
    /^(\S+)\s+.*?sshd(?:\[\d+\])?:\s+(Failed|Accepted)\s+\S+\s+for\s+(?:invalid user\s+)?(\S+)\s+from\s+(\S+)\s+port\s+\d+/i,
  );
  if (!m)
    throw Error(
      "unsupported SSH line; use an ISO timestamp and an sshd Failed/Accepted event",
    );
  return { timestamp: m[1], status: m[2], username: m[3], source_ip: m[4] };
}
export function parseLogs(input) {
  if (typeof input !== "string" || !input.trim())
    throw Error("Add a log file, paste events, or load a sample first.");
  if (new TextEncoder().encode(input).length > MAX_BYTES)
    throw Error("This file is larger than 2 MB. Use a smaller log excerpt.");
  const text = input.replace(/^\uFEFF/, "").trim();
  let records = [],
    format = "JSONL";
  if (text.startsWith("[")) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw Error("Invalid JSON array. Check commas, quotes, and brackets.");
    }
    if (!Array.isArray(parsed)) throw Error("Expected a JSON array.");
    records = parsed.map((value, i) => ({ value, label: `Record ${i + 1}` }));
    format = "JSON";
  } else if (text.startsWith("{")) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {}
    if (parsed) {
      if (Array.isArray(parsed.events)) {
        records = parsed.events.map((value, i) => ({
          value,
          label: `Record ${i + 1}`,
        }));
        format = "JSON";
      } else {
        records = [{ value: parsed, label: "Record 1" }];
        format = "JSON";
      }
    } else
      records = text
        .split(/\r?\n/)
        .map((raw, i) => ({ raw, label: `Line ${i + 1}`, json: true }));
  } else if (text.split(/\r?\n/)[0].includes(",")) {
    const rows = csvRows(text);
    const heads = rows.shift().map((x) => x.trim().toLowerCase());
    if (new Set(heads).size !== heads.length)
      throw Error("CSV headers must be unique.");
    records = rows.map((row, i) => ({
      value: Object.fromEntries(heads.map((h, j) => [h, row[j]])),
      label: `CSV row ${i + 2}`,
      error:
        row.length !== heads.length
          ? "column count does not match the header"
          : null,
    }));
    format = "CSV";
  } else {
    records = text
      .split(/\r?\n/)
      .map((raw, i) => ({ raw, label: `Line ${i + 1}`, ssh: true }));
    format = "SSH";
  }
  if (records.length > MAX_EVENTS)
    throw Error(`Use ${MAX_EVENTS.toLocaleString()} records or fewer.`);
  let events = [],
    issues = [],
    seen = new Set(),
    duplicates = 0;
  for (const record of records) {
    if (record.raw !== undefined && !record.raw.trim()) continue;
    try {
      if (record.error) throw Error(record.error);
      const r =
        record.value ??
        (record.json ? JSON.parse(record.raw) : sshRecord(record.raw));
      if (!r || typeof r !== "object" || Array.isArray(r))
        throw Error("expected an event object");
      const when = r.timestamp ?? r.time ?? r["@timestamp"];
      let ip = String(r.source_ip ?? r.src_ip ?? r.ip ?? "").trim();
      const user = String(r.username ?? r.user ?? r.account ?? "").trim();
      const outcome = String(r.status ?? r.outcome ?? r.event ?? "")
        .trim()
        .toLowerCase();
      const ms = timestamp(when);
      if (!ipValid(ip)) throw Error("source_ip must be a valid IP address");
      ip = ip.includes(":")
        ? new URL("http://[" + ip + "]/").hostname.slice(1, -1)
        : ip.split(".").map(Number).join(".");
      if (!user || user.length > 128)
        throw Error("username is missing or exceeds 128 characters");
      const status = failed.has(outcome)
        ? "failure"
        : succeeded.has(outcome)
          ? "success"
          : null;
      if (!status)
        throw Error("status must describe authentication success or failure");
      const normalizedTime = new Date(ms).toISOString();
      const key = JSON.stringify([normalizedTime, ip, user, status]);
      if (seen.has(key)) duplicates++;
      seen.add(key);
      events.push({
        id: `E${events.length + 1}`,
        timestamp: normalizedTime,
        ms,
        source_ip: ip,
        username: user,
        status,
        raw: record.raw ?? JSON.stringify(r),
        source: record.label,
      });
    } catch (e) {
      issues.push({ source: record.label, reason: e.message });
    }
  }
  if (!events.length)
    throw Error(
      `No supported authentication events found. ${issues[0]?.reason ?? "The input was empty."}`,
    );
  events.sort(
    (a, b) => a.ms - b.ms || Number(a.id.slice(1)) - Number(b.id.slice(1)),
  );
  return { events, issues, duplicates, format, total: records.length };
}
function groupBy(events, key) {
  const m = new Map();
  for (const e of events) {
    const k = key(e);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(e);
  }
  return m;
}
function firstWindow(events, window, threshold, distinct = false) {
  let start = 0;
  const users = new Map();
  for (let end = 0; end < events.length; end++) {
    const user = events[end].username;
    users.set(user, (users.get(user) || 0) + 1);
    while (events[end].ms - events[start].ms > window) {
      const u = events[start++].username;
      users.set(u, users.get(u) - 1);
      if (!users.get(u)) users.delete(u);
    }
    if ((distinct ? users.size : end - start + 1) >= threshold)
      return events.slice(start, end + 1);
  }
  return null;
}
export function detect(events) {
  const findings = [];
  const failures = events.filter((e) => e.status === "failure");
  const byPair = groupBy(events, (e) =>
    JSON.stringify([e.source_ip, e.username]),
  );
  const push = (rule, evidence) => {
    const ips = [...new Set(evidence.map((e) => e.source_ip))],
      users = [...new Set(evidence.map((e) => e.username))];
    findings.push({
      ruleId: rule.id,
      title: rule.name,
      severity: rule.severity,
      ip: ips[0],
      users,
      start: evidence[0].timestamp,
      end: evidence.at(-1).timestamp,
      evidenceIds: evidence.map((e) => e.id),
      description: rule.description,
      caveat: rule.caveat,
      steps: rule.steps,
    });
  };
  for (const group of byPair.values()) {
    const f = group.filter((e) => e.status === "failure");
    const match = firstWindow(f, RULES[0].window, RULES[0].threshold);
    if (match) push(RULES[0], match);
    let pending = [],
      start = 0;
    for (const e of group) {
      while (
        start < pending.length &&
        e.ms - pending[start].ms > RULES[2].window
      )
        start++;
      if (e.status === "failure") {
        pending.push(e);
      } else if (pending.length - start >= RULES[2].threshold) {
        push(RULES[2], [...pending.slice(start), e]);
        break;
      } else {
        pending = [];
        start = 0;
      }
    }
  }
  for (const group of groupBy(failures, (e) => e.source_ip).values()) {
    const match = firstWindow(group, RULES[1].window, RULES[1].threshold, true);
    if (match) push(RULES[1], match);
  }
  findings.sort(
    (a, b) =>
      (a.severity === "high" ? 0 : 1) - (b.severity === "high" ? 0 : 1) ||
      a.start.localeCompare(b.start) ||
      a.ruleId.localeCompare(b.ruleId),
  );
  return findings.map((f, i) => ({ ...f, id: `F${i + 1}` }));
}
export function explain(f) {
  const span = `${f.start.replace("T", " ").replace(".000Z", "")} to ${f.end.replace("T", " ").replace(".000Z", "")} UTC`;
  const refs = f.evidenceIds.map((id) => `[${id}]`).join(" ");
  if (f.ruleId === "AUTH-001")
    return `${f.evidenceIds.length} failed logins for “${f.users[0]}” came from ${f.ip} during ${span}. This meets the repeated-failure rule and warrants a review of the account and source. ${refs}`;
  if (f.ruleId === "AUTH-002")
    return `${f.ip} attempted unsuccessful sign-ins to ${f.users.length} different accounts during ${span}. This meets the multi-account failure rule and may indicate password spraying. The logs do not reveal whether the same password was used. ${refs}`;
  return `${f.evidenceIds.length - 1} failed logins for “${f.users[0]}” from ${f.ip} were followed by a successful login during ${span}. Verify whether the account owner recognizes the successful session. ${refs}`;
}
export function analyze(input) {
  const parsed = parseLogs(input);
  return { ...parsed, findings: detect(parsed.events) };
}
export function sampleLogs(kind = "mixed") {
  const events = [];
  const add = (sec, ip, user, status) =>
    events.push({
      timestamp: new Date(Date.UTC(2026, 9, 9, 9, 0, sec)).toISOString(),
      source_ip: ip,
      username: user,
      status,
    });
  for (let i = 0; i < 14; i++)
    add(
      i * 37,
      "192.0.2." + (20 + (i % 4)),
      ["sara", "omar", "ali", "maria"][i % 4],
      "success",
    );
  add(15, "192.0.2.25", "ahmed", "failure");
  add(65, "192.0.2.25", "ahmed", "success");
  if (kind === "mixed") {
    for (let i = 0; i < 6; i++)
      add(35 + i * 24, "198.51.100.42", "admin", "failure");
    add(200, "198.51.100.42", "admin", "success");
  }
  if (kind === "mixed" || kind === "spray")
    for (let i = 0; i < 6; i++)
      add(
        240 + i * 22,
        "203.0.113.77",
        ["sara", "omar", "ali", "maria", "ahmed", "admin"][i],
        "failure",
      );
  return JSON.stringify(
    events.sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    null,
    2,
  );
}
