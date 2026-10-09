import { DEVELOPMENT_SUITE, evaluateSuite, parseSuite } from "./evaluation.mjs";
const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const percent = (n) => (n === null ? "N/A" : `${(100 * n).toFixed(1)}%`);
let suite = DEVELOPMENT_SUITE,
  report = null;
function download(value, name) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function run() {
  report = evaluateSuite(suite);
  $("eval-summary").hidden = false;
  $("eval-export").disabled = false;
  $("eval-metrics").innerHTML = [
    [
      "Precision",
      percent(report.totals.precision),
      "Correctly detected labels / all detected labels",
    ],
    [
      "Recall",
      percent(report.totals.recall),
      "Detected expected labels / all expected labels",
    ],
    [
      "False positives",
      report.totals.fp,
      "Detected labels absent from expected labels",
    ],
    [
      "Missed labels",
      report.totals.fn,
      "Expected labels the rules did not detect",
    ],
  ]
    .map(
      ([a, b, c]) =>
        `<div class="stat"><div class="stat-label">${a}</div><div class="stat-value">${b}</div><div class="stat-note">${c}</div></div>`,
    )
    .join("");
  $("eval-rule-results").innerHTML = report.perRule
    .map(
      (r) =>
        `<tr><td>${r.id}</td><td>${r.tp}</td><td>${r.fp}</td><td>${r.fn}</td><td>${percent(r.precision)}</td><td>${percent(r.recall)}</td></tr>`,
    )
    .join("");
  $("eval-case-results").innerHTML = report.cases
    .map(
      (c) =>
        `<tr><td><strong>${esc(c.name)}</strong><p class="muted">${esc(c.note)}</p></td><td>${c.expected.join(", ") || "None"}</td><td>${c.actual.join(", ") || "None"}</td><td><span class="badge ${c.match ? "match" : "high"}">${c.match ? "Match" : c.falsePositives.length && c.falseNegatives.length ? "False positive + miss" : c.falsePositives.length ? "False positive" : "Miss"}</span><button class="quiet inspect-case" data-case="${esc(c.id)}">Inspect</button></td></tr>`,
    )
    .join("");
  $("eval-case-results")
    .querySelectorAll("[data-case]")
    .forEach(
      (button) =>
        (button.onclick = () =>
          document.dispatchEvent(
            new CustomEvent("inspect-evaluation-case", {
              detail: suite.cases.find((c) => c.id === button.dataset.case),
            }),
          )),
    );
  $("eval-status").textContent =
    `${report.exactMatches}/${report.caseCount} cases match all expected labels. Measured per case and rule, not per event. No LLM accuracy is measured by this screen.`;
}
export function initEvaluation() {
  $("eval-name").textContent = suite.name;
  $("eval-run").onclick = () => {
    try {
      run();
    } catch (e) {
      $("eval-status").textContent = e.message;
    }
  };
  $("eval-example").onclick = () =>
    download(DEVELOPMENT_SUITE, "signaldesk-evaluation-example.json");
  $("eval-export").onclick = () =>
    report &&
    download(
      {
        ...report,
        evaluatedAt: new Date().toISOString(),
        ruleVersion: "1.1",
        suiteInput: suite,
      },
      "signaldesk-evaluation-results.json",
    );
  $("eval-upload").onclick = () => $("eval-file").click();
  $("eval-reset").onclick = () => {
    suite = DEVELOPMENT_SUITE;
    report = null;
    $("eval-name").textContent = suite.name;
    $("eval-summary").hidden = true;
    $("eval-export").disabled = true;
    $("eval-status").textContent =
      "Synthetic development examples loaded. Run the evaluation to inspect results.";
  };
  $("eval-file").onchange = async () => {
    const file = $("eval-file").files[0];
    if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024)
        throw Error("Evaluation file exceeds 2 MB.");
      const incoming = parseSuite(await file.text());
      suite = incoming;
      report = null;
      $("eval-name").textContent = suite.name;
      $("eval-summary").hidden = true;
      $("eval-export").disabled = true;
      $("eval-status").textContent =
        `Loaded ${suite.cases.length} labelled cases. Labels were supplied by the file author and have not been independently verified.`;
    } catch (e) {
      $("eval-status").textContent = e.message;
    } finally {
      $("eval-file").value = "";
    }
  };
}
