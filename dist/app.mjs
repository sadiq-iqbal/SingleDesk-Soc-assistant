import { initEvaluation } from "./evaluation-ui.mjs";
import {
  clearReviews,
  getReview,
  renderTriage,
  renderTimeline,
  reportMarkdown,
} from "./workbench.mjs";
import { analyze, explain, sampleLogs, RULES, MAX_BYTES } from "./core.mjs";
const $ = (id) => document.getElementById(id);
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let result = null,
  selected = null,
  page = 0,
  highlight = null,
  analyzedText = "",
  model = "",
  aiReady = false,
  sourceName = "Pasted logs",
  generation = 0;
const aiResults = new Map();
const stat = (label, value, note, accent = false) =>
  `<div class="stat ${accent ? "accent" : ""}"><div class="stat-label">${label}</div><div class="stat-value">${value}</div><div class="stat-note">${note}</div></div>`;
function resetResults() {
  generation++;
  result = null;
  selected = null;
  aiResults.clear();
  clearReviews();
  $("results").hidden = true;
  $("empty").hidden = false;
  $("export").disabled = true;
}
function run() {
  try {
    const next = analyze($("log-input").value);
    generation++;
    result = next;
    analyzedText = $("log-input").value;
    selected = result.findings[0]?.id ?? null;
    page = 0;
    highlight = null;
    aiResults.clear();
    clearReviews();
    $("results").hidden = false;
    $("empty").hidden = true;
    $("export").disabled = false;
    const notes = [];
    if (next.issues.length)
      notes.push(
        `${next.issues.length} record(s) skipped: ${next.issues
          .slice(0, 3)
          .map((x) => `${x.source}: ${x.reason}`)
          .join(
            "; ",
          )}${next.issues.length > 3 ? " … See the exported report for all issues." : ""}`,
      );
    if (next.duplicates)
      notes.push(
        `${next.duplicates} duplicate-looking event(s) retained. Check for repeated ingestion before interpreting counts.`,
      );
    $("status").textContent = notes.join(" ");
    $("input-note").textContent =
      `${sourceName} · ${next.format} · ${next.events.length} valid events · times displayed in UTC.`;
    render();
    return {
      events: next.events.length,
      findings: next.findings.length,
      skipped: next.issues.length,
    };
  } catch (e) {
    resetResults();
    $("status").textContent = e.message;
    throw e;
  }
}
function render() {
  const ev = result.events;
  const failed = ev.filter((e) => e.status === "failure").length;
  $("stats").innerHTML =
    stat("EVENTS ANALYZED", ev.length, "Valid authentication records") +
    stat(
      "FINDINGS TO REVIEW",
      result.findings.length,
      "First match per rule and entity",
      true,
    ) +
    stat(
      "FAILED SIGN-INS",
      failed,
      `${ev.length - failed} successful sign-ins`,
    ) +
    stat(
      "SOURCE ADDRESSES",
      new Set(ev.map((e) => e.source_ip)).size,
      `${new Set(ev.map((e) => e.username)).size} accounts observed`,
    );
  renderAlerts();
  renderEvents();
  renderTimeline(result);
}
function renderAlerts() {
  const findings = result.findings.filter(
    (f) => $("severity").value === "all" || f.severity === $("severity").value,
  );
  if (!findings.some((f) => f.id === selected))
    selected = findings[0]?.id ?? null;
  $("alert-count").textContent = `(${findings.length})`;
  $("alerts").innerHTML = findings.length
    ? findings
        .map(
          (f) =>
            `<button class="alert ${f.id === selected ? "selected" : ""}" data-id="${f.id}" aria-pressed="${f.id === selected}"><div class="alert-top"><span class="badge ${f.severity}">${f.severity}</span><span>${f.ruleId}</span></div><strong>${escape(f.title)}</strong><p>${escape(f.ip)} · ${f.users.length === 1 ? escape(f.users[0]) : `${f.users.length} accounts`}</p><div class="alert-bottom"><span>${f.evidenceIds.length} evidence events</span><span>${f.start.slice(11, 19)} UTC</span></div></button>`,
        )
        .join("")
    : `<div class="empty-card">${result.findings.length ? "No alerts match this filter." : "No matching alerts. These rules found no qualifying patterns in the valid events. This is not a full security assessment."}</div>`;
  $("alerts")
    .querySelectorAll("[data-id]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          selected = b.dataset.id;
          renderAlerts();
        }),
    );
  renderDetail();
}
function renderDetail() {
  const f = result.findings.find((x) => x.id === selected);
  if (!f) {
    $("detail").innerHTML =
      '<div class="empty-card">Choose an alert to inspect its explanation and supporting evidence.</div>';
    return;
  }
  $("detail").innerHTML =
    `<div class="detail-top"><span>FINDING ${f.id.slice(1).padStart(2, "0")}</span><span class="badge ${f.severity}">${f.severity} · review needed</span></div><h2>${escape(f.title)}</h2><p class="muted">${escape(f.description)}</p><div class="facts"><div><span>SOURCE ADDRESS</span><strong>${escape(f.ip)}</strong></div><div><span>OBSERVED WINDOW · UTC</span><strong>${f.start.replace("T", " ").replace(".000Z", "")} → ${f.end.replace("T", " ").replace(".000Z", "")}</strong></div></div><h3>Why this was flagged</h3><div class="explanation">${escape(explain(f))}</div><p class="muted">Built-in explanation · rule-based</p><h3>Consider the context</h3><p class="muted">${escape(f.caveat)}</p><h3>Supporting evidence</h3><div class="evidence-chips">${f.evidenceIds
      .slice(0, 100)
      .map((id) => `<button class="chip" data-evidence="${id}">${id}</button>`)
      .join(
        "",
      )}</div>${f.evidenceIds.length > 100 ? '<p class="muted">First 100 evidence links shown; all are included in the report.</p>' : ""}<pre class="raw" id="raw-evidence" hidden></pre><h3>Suggested checks</h3><ul>${f.steps.map((s) => `<li>${escape(s)}</li>`).join("")}</ul><section id="triage"></section><div class="ai-box"><button id="explain-ai" class="secondary">${aiReady ? "Explain with local AI" : "Set up local AI explanation"}</button><p class="muted">Optional model interpretation. Verify its claims against the evidence.</p><div class="ai-answer" id="ai-answer"></div></div>`;
  const cached = aiResults.get(f.id);
  if (cached)
    $("ai-answer").textContent =
      `${cached.explanation}\n\nModel: ${cached.model} · ${cached.latencyMs ?? "—"} ms · unverified interpretation`;
  renderTriage(f);
  $("detail")
    .querySelectorAll("[data-evidence]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          const e = result.events.find((x) => x.id === b.dataset.evidence);
          highlight = e.id;
          $("raw-evidence").hidden = false;
          $("raw-evidence").textContent = `[${e.id}] ${e.source}\n${e.raw}`;
          $("event-search").value = "";
          page = Math.floor(result.events.indexOf(e) / 50);
          renderEvents();
        }),
    );
  $("explain-ai").onclick = () =>
    aiReady ? askAI(f) : $("settings").showModal();
}
function renderEvents() {
  const q = $("event-search").value.toLowerCase();
  const rows = result.events.filter((e) =>
    `${e.id} ${e.timestamp} ${e.source_ip} ${e.username} ${e.status}`
      .toLowerCase()
      .includes(q),
  );
  page = Math.min(page, Math.max(0, Math.ceil(rows.length / 50) - 1));
  $("event-count").textContent = `(${rows.length})`;
  $("events").innerHTML =
    rows
      .slice(page * 50, page * 50 + 50)
      .map(
        (e) =>
          `<tr class="${highlight === e.id ? "highlight" : ""}"><td>${e.id}</td><td>${e.timestamp.replace("T", " ").replace(".000Z", "")}</td><td>${escape(e.source_ip)}</td><td>${escape(e.username)}</td><td class="${e.status}">${e.status}</td></tr>`,
      )
      .join("") || '<tr><td colspan="5">No matching events.</td></tr>';
  $("page-info").textContent = rows.length
    ? `${page * 50 + 1}–${Math.min(page * 50 + 50, rows.length)} of ${rows.length} events`
    : "0 events";
  $("prev").disabled = page === 0;
  $("next").disabled = (page + 1) * 50 >= rows.length;
}
async function askAI(f) {
  const current = generation;
  const button = $("explain-ai");
  button.disabled = true;
  button.textContent = "Generating local explanation…";
  $("ai-answer").textContent = "";
  try {
    const response = await fetch("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: analyzedText, alertId: f.id, model }),
      signal: AbortSignal.timeout(125000),
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || "Local AI request failed.");
    if (current !== generation) return;
    aiResults.set(f.id, data);
    if (selected === f.id)
      $("ai-answer").textContent =
        `${data.explanation}\n\nModel: ${data.model} · ${data.latencyMs ?? "—"} ms · unverified interpretation`;
  } catch (e) {
    if (current === generation && selected === f.id)
      $("ai-answer").textContent =
        `Local AI unavailable: ${e.message}. The built-in explanation remains available.`;
  } finally {
    if (current === generation && selected === f.id) {
      button.disabled = false;
      button.textContent = "Explain with local AI";
    }
  }
}
document.querySelectorAll("[data-view]").forEach((b) =>
  b.addEventListener("click", () => {
    document
      .querySelectorAll("[data-view]")
      .forEach((x) =>
        x.classList.toggle("active", x.dataset.view === b.dataset.view),
      );
    ["investigate", "evaluation", "rules", "guide"].forEach(
      (v) => ($(v + "-view").hidden = v !== b.dataset.view),
    );
    $("breadcrumb").textContent =
      b.dataset.view === "investigate" ? "Investigation" : b.textContent.trim();
  }),
);
$("upload").onclick = () => $("file").click();
$("ai-settings").onclick = () => $("settings").showModal();
$("close-settings").onclick = () => $("settings").close();
$("log-input").addEventListener("input", () => {
  resetResults();
  sourceName = "Pasted logs";
  $("status").textContent = "";
  $("input-note").textContent =
    "Input changed. Analyze again to see current results.";
});
$("analyze").onclick = () => {
  try {
    run();
  } catch {}
};
$("load-sample").onclick = () => {
  resetResults();
  $("log-input").value = sampleLogs($("sample").value);
  sourceName = "Synthetic sample";
  $("status").textContent = "";
  $("input-note").textContent =
    "Synthetic demonstration using documentation-only IP addresses. Click Analyze logs.";
};
$("file").onchange = async () => {
  const file = $("file").files[0];
  if (!file) return;
  resetResults();
  $("log-input").value = "";
  $("status").textContent = "";
  try {
    if (file.size > MAX_BYTES)
      throw Error("File exceeds 2 MB. Choose a smaller log excerpt.");
    $("log-input").value = await file.text();
    sourceName = file.name;
    $("input-note").textContent = `${file.name} loaded. Click Analyze logs.`;
  } catch (e) {
    $("status").textContent = e.message;
  } finally {
    $("file").value = "";
  }
};
$("severity").onchange = () => result && renderAlerts();
$("event-search").oninput = () => {
  page = 0;
  if (result) renderEvents();
};
$("prev").onclick = () => {
  page--;
  renderEvents();
};
$("next").onclick = () => {
  page++;
  renderEvents();
};
$("export").onclick = () => {
  if (!result) return;
  const report = {
    application: "SignalDesk",
    generatedAt: new Date().toISOString(),
    source: sourceName,
    scope:
      "Three authentication rules; first qualifying window per rule and entity. Findings require verification.",
    issues: result.issues,
    duplicateLookingEvents: result.duplicates,
    findings: result.findings.map((f) => ({
      ...f,
      analystReview: getReview(f.id),
      explanation: explain(f),
      localAIInterpretation: aiResults.get(f.id) ?? null,
    })),
    events: result.events,
  };
  const markdown = $("report-format").value === "markdown";
  const url = URL.createObjectURL(
    new Blob(
      [markdown ? reportMarkdown(report) : JSON.stringify(report, null, 2)],
      { type: markdown ? "text/markdown" : "application/json" },
    ),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = markdown
    ? "signaldesk-investigation.md"
    : "signaldesk-investigation.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$("check-ai").onclick = async () => {
  $("check-ai").disabled = true;
  $("ai-status").textContent = "Checking the local companion…";
  aiReady = false;
  try {
    const r = await fetch("/api/models", { signal: AbortSignal.timeout(7000) });
    if (!r.ok)
      throw Error(
        "Start the local companion with npm start and make sure Ollama is running.",
      );
    const d = await r.json();
    if (!Array.isArray(d.models) || !d.models.length)
      throw Error(
        "No installed models found. Download an Ollama model, then check again.",
      );
    $("model").replaceChildren(
      ...d.models.map((name) => new Option(name, name)),
    );
    model = d.models[0];
    aiReady = true;
    $("ai-status").textContent =
      `Connected to local Ollama. ${d.models.length} model(s) available.`;
  } catch (e) {
    model = "";
    $("model").replaceChildren(new Option("No local model connected", ""));
    $("ai-status").textContent = e.message;
  } finally {
    $("check-ai").disabled = false;
    if (result) renderDetail();
  }
};
$("model").onchange = () => {
  model = $("model").value;
};
$("rule-list").innerHTML =
  RULES.map(
    (r) =>
      `<article class="rule-card"><code>${r.id}</code><h2 style="margin-top:12px">${escape(r.name)}</h2><p>${escape(r.description)}</p><p><strong>Possible alternative explanation:</strong> ${escape(r.caveat)}</p></article>`,
  ).join("") +
  '<p class="muted">The engine reports the first qualifying time window for each rule and entity. It retains duplicate-looking records and warns about them. Events are ordered by timestamp; ties retain input order. Rules use inclusive time-window boundaries.</p>';
if (document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  try {
    Promise.resolve(
      document.modelContext.registerTool(
        {
          name: "analyze_authentication_logs",
          title: "Analyze authentication logs",
          description:
            "Replace the input with supplied log text, run the three detection rules, and show the resulting investigation.",
          inputSchema: {
            type: "object",
            properties: { text: { type: "string" } },
            required: ["text"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: true },
          execute(input) {
            if (!input || typeof input.text !== "string")
              throw Error("text must be a string");
            analyze(input.text);
            $("log-input").value = input.text;
            sourceName = "Agent-provided logs";
            document.querySelector('[data-view="investigate"]').click();
            return run();
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
  } catch {}
  window.addEventListener("pagehide", () => lifecycle.abort(), { once: true });
}
initEvaluation();
document.addEventListener("inspect-evaluation-case", (event) => {
  resetResults();
  $("log-input").value = JSON.stringify(event.detail.events, null, 2);
  sourceName = "Evaluation: " + event.detail.name;
  $("severity").value = "all";
  $("event-search").value = "";
  document.querySelector('[data-view="investigate"]').click();
  run();
});
$("log-input").value = sampleLogs();
sourceName = "Synthetic sample";
run();
