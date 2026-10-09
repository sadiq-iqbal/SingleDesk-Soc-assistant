const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const reviews = new Map();
export const getReview = (id) =>
  reviews.get(id) ?? {
    status: "new",
    note: "",
    explanationAssessment: "not-reviewed",
  };
export function clearReviews() {
  reviews.clear();
}
export function renderTriage(finding) {
  const container = $("triage");
  if (!container) return;
  const review = getReview(finding.id);
  container.innerHTML = `<h3>Analyst review</h3><div class="review-controls"><label>Disposition<select id="review-status"><option value="new">New</option><option value="reviewing">Investigating</option><option value="escalate">Needs escalation</option><option value="benign">Likely benign</option></select></label><label>Explanation assessment<select id="review-quality"><option value="not-reviewed">Not reviewed</option><option value="supported">Claims supported</option><option value="unsupported">Contains unsupported claims</option><option value="unclear">Needs more evidence</option></select></label></div><label class="note-label" for="review-note">Investigation notes</label><textarea id="review-note" maxlength="4000" placeholder="What did you verify? What is still unknown?"></textarea><p class="muted">Notes stay in this session. Export a report to keep them.</p>`;
  $("review-status").value = review.status;
  $("review-quality").value = review.explanationAssessment;
  $("review-note").value = review.note;
  const save = () => {
    reviews.set(finding.id, {
      status: $("review-status").value,
      note: $("review-note").value,
      explanationAssessment: $("review-quality").value,
      updatedAt: new Date().toISOString(),
    });
  };
  $("review-status").onchange = save;
  $("review-quality").onchange = save;
  $("review-note").oninput = save;
}
export function renderTimeline(result) {
  const events = result.events;
  const start = events[0].ms,
    end = events.at(-1).ms;
  const bins = Array.from({ length: 12 }, () => ({ success: 0, failure: 0 }));
  const width = Math.max(1, end - start + 1) / 12;
  for (const e of events)
    bins[Math.min(11, Math.floor((e.ms - start) / width))][e.status]++;
  const max = Math.max(1, ...bins.map((b) => b.success + b.failure));
  $("timeline").innerHTML =
    `<div class="section-heading"><h2>Authentication activity</h2><span class="timeline-legend"><span class="legend-success">Successful</span><span class="legend-failure">Failed</span></span></div><div class="timeline-bars" role="img" aria-label="Authentication events over twelve equal time intervals. ${events.filter((e) => e.status === "failure").length} failures and ${events.filter((e) => e.status === "success").length} successes.">${bins.map((b, i) => `<div class="timeline-slot" title="${new Date(start + i * width).toISOString()}: ${b.success} successes, ${b.failure} failures"><div class="timeline-stack" style="height:${Math.max(2, ((b.success + b.failure) / max) * 100)}%"><div class="bar-failure" style="flex:${b.failure}"></div><div class="bar-success" style="flex:${b.success}"></div></div><span>${b.success + b.failure}</span></div>`).join("")}</div><div class="timeline-axis"><span>${esc(events[0].timestamp.replace("T", " ").replace(".000Z", " UTC"))}</span><span>${esc(events.at(-1).timestamp.replace("T", " ").replace(".000Z", " UTC"))}</span></div>`;
  const quality = $("data-quality");
  quality.hidden = !result.issues.length && !result.duplicates;
  quality.innerHTML = `<summary>Data quality · ${result.issues.length} skipped · ${result.duplicates} duplicate-looking</summary><p class="muted">Duplicate-looking records are retained because identical timestamps can represent different attempts. Review repeated ingestion before interpreting counts.</p><ul>${result.issues
    .slice(0, 30)
    .map((i) => `<li><strong>${esc(i.source)}</strong>: ${esc(i.reason)}</li>`)
    .join(
      "",
    )}</ul>${result.issues.length > 30 ? "<p>First 30 issues shown; the JSON report contains all issues.</p>" : ""}`;
}
export function reportMarkdown(report) {
  const safe = (v) =>
    String(v ?? "")
      .replace(/[<>`]/g, "")
      .replace(/\r?\n/g, " ");
  const lines = [
    "# SignalDesk investigation report",
    "",
    `Generated: ${report.generatedAt}`,
    `Source: ${safe(report.source)}`,
    "",
    report.scope,
    "",
    `Valid events: ${report.events.length}. Findings: ${report.findings.length}. Skipped records: ${report.issues.length}.`,
    "",
  ];
  for (const f of report.findings) {
    lines.push(
      `## ${f.id}: ${safe(f.title)}`,
      `Rule: ${f.ruleId} | Severity: ${f.severity} | Disposition: ${safe(f.analystReview.status)}`,
      "",
      f.explanation,
      "",
      `Alternative explanation: ${f.caveat}`,
      "",
      `Analyst notes: ${safe(f.analystReview.note) || "None recorded."}`,
      `Explanation assessment: ${safe(f.analystReview.explanationAssessment)}`,
      "",
    );
    if (f.localAIInterpretation) {
      lines.push(
        `Local AI (${safe(f.localAIInterpretation.model)}; ${f.localAIInterpretation.latencyMs ?? "unknown"} ms; unverified):`,
        "",
        ...f.localAIInterpretation.explanation
          .split("\n")
          .map((line) => "> " + safe(line)),
        "",
      );
    }
    lines.push(
      "Evidence:",
      "",
      ...report.events
        .filter((e) => f.evidenceIds.includes(e.id))
        .map(
          (e) =>
            `- [${e.id}] ${e.timestamp} | ${safe(e.source_ip)} | ${safe(e.username)} | ${e.status}`,
        ),
      "",
    );
  }
  lines.push(
    "## Limits",
    "",
    "Three deterministic authentication rules; alerts require analyst review. AI citation checks do not establish factual correctness. No automatic response actions are performed.",
  );
  return lines.join("\n");
}
