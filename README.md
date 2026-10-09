# SignalDesk — basic SOC assistant

A portfolio application for investigating authentication logs. It combines deterministic detection rules, evidence-linked explanations, analyst review notes, reproducible evaluation, and an optional local Ollama model. There is no payment system, subscription, paid API, or required API key.

**Status:** working prototype with 21 automated checks, browser verification, and recorded real `qwen3.5:4b` tests. Thinking is disabled. The model tests exposed incorrect counts and time spans; citation validation alone is not a factual-accuracy guarantee. See [actual results and limitations](docs/EVALUATION.md).

## Get the project

```sh
git clone https://github.com/sadiq-iqbal/SingleDesk-Soc-assistant.git
cd SingleDesk-Soc-assistant
```

The GitHub repository is named `SingleDesk-Soc-assistant`; the application's display name is SignalDesk.

## Run

Requires Node.js 20 or later. No dependency installation is needed.

```sh
npm start
```

Open http://127.0.0.1:4173. The mixed-activity sample is loaded automatically. Run `npm test` for the parser, rule, and local API checks.

## Optional local LLM

Install Ollama from https://ollama.com and download a model supported by your hardware, for example:

```sh
ollama pull qwen3:1.7b
```

Start Ollama, run this application's companion server with `npm start`, then choose **Local AI settings → Check connection**. Select an installed model and use **Explain with local AI** on an alert. Smaller models are appropriate for machines with limited memory; response speed depends on hardware. Nothing downloads automatically.

Thinking is explicitly disabled (`think: false`), including for models whose default is thinking on. The assistant uses only the final answer. Your installed `qwen3.5:4b` model is detected through Ollama's installed-model list; no additional model download is needed.

For a repeatable real-model smoke test, run `npm run evaluate:llm -- qwen3.5:4b`. It tests three synthetic findings sequentially and saves prompts, final answers, citation-check results, and timings in `artifacts/real-model-smoke.json`. This can take several minutes on a CPU. The command is separate from the automated tests and does not measure factual accuracy; each response requires review.

The hosted static version provides the complete rule-based workflow. Local LLM explanations require the local Node companion and Ollama; the hosted site cannot reach a server running on your computer through its own `/api` route. Local AI is never represented as connected until the models endpoint succeeds.

The companion is bound to loopback, rejects other origins and Host headers, and accepts only installed model names. It rebuilds findings from the supplied logs, sends only selected normalized evidence to the model, and rejects missing or unknown event citations. This does not verify the truth of model-generated claims or guarantee prompt-injection resistance. Model output remains visibly unverified and never executes actions.

## Supported input

- JSON array, one JSON event, or `{ "events": [...] }`.
- JSONL / NDJSON (one object per line).
- CSV with `timestamp,source_ip,username,status` columns; quoted fields supported.
- ISO-dated SSH `sshd` Failed/Accepted text lines.

```json
{
  "timestamp": "2026-10-09T09:00:00Z",
  "source_ip": "192.0.2.10",
  "username": "admin",
  "status": "failure"
}
```

Timestamps must include a timezone. Yearless syslog is rejected rather than assigned a guessed year. Field aliases include `time`/`@timestamp`, `ip`/`src_ip`, `user`/`account`, and `outcome`/`event`. Authentication outcomes must be recognizable success/failure values. Unknown outcomes and invalid rows are reported. Maximum input: 2 MB, 20,000 records. Timestamps are normalized to UTC. Duplicate-looking rows are retained with a warning. Demo IP addresses use documentation ranges.

## Detection rules

| ID       | Pattern                                               | Window     | Severity |
| -------- | ----------------------------------------------------- | ---------- | -------- |
| AUTH-001 | 5 failures for the same user and source               | 5 minutes  | Medium   |
| AUTH-002 | Failures against 5 distinct users from one source     | 10 minutes | High     |
| AUTH-003 | Success after 3 failures for the same user and source | 10 minutes | High     |

Rules report the first qualifying window per entity. Boundaries are inclusive. Evidence IDs refer to original valid-record order; evaluation uses timestamp order, preserving input order for ties. Alerts are hypotheses for analyst review, not confirmed attacks. No-match results are not proof of safety. This is a learning prototype, not a SIEM replacement or incident-response service.

## Data handling

Analysis and display happen in browser memory. Reloading clears uploaded logs; a synthetic demo is then loaded. Export explicitly downloads the current report, including raw evidence. Local AI sends the current input to the loopback companion to recompute findings; only the selected normalized evidence subset reaches Ollama. No telemetry or external fonts are used. Private hosting protects site access but does not add a database. No customer log files are shipped with the app.

## Investigation and evaluation

The activity timeline groups events into 12 equal intervals. Review a finding, choose a disposition, assess explanation support, and add investigation notes. Notes are kept in memory until you replace or reanalyze the logs or reload. Export JSON for the complete evidence and data-quality details, or a readable Markdown investigation report.

The Evaluation screen compares expected and detected rule labels. The 12 included synthetic development scenarios intentionally include a benign-retry false positive and a slow-attempt miss. Their expected output is 7 true positives, 1 false positive, and 1 missed label: 87.5% precision and recall, with 10/12 exact case matches. **These are hand-authored development results, not real-world detection accuracy or LLM accuracy.** Each case/rule pair counts once; repeated alerts of one rule do not increase that count.

Import independently labelled cases using the downloadable JSON example format. Preserve a frozen evaluation set that you do not use to tune the rules. The interface and command-line runner use the same evaluation logic:

```sh
npm run doctor
npm run evaluate
npm run evaluate -- path/to/labelled-cases.json
```

The runner saves the input and results in `artifacts/evaluation-results.json`. See [the portfolio proof checklist](docs/PROVE-YOUR-PROJECT.md) for installation, model evaluation, and report requirements.

## Structure

- `dist/core.mjs`: parsing, normalization, rules, built-in explanations, samples.
- `dist/app.mjs`: interface state, evidence view, filtering, export, optional AI.
- `dist/evaluation.mjs` and `evaluation-ui.mjs`: labelled-case evaluation and interface.
- `dist/workbench.mjs`: timeline, analyst notes, and readable reports.
- `dist/index.html` and `styles.css`: accessible responsive interface.
- `server.mjs`: dependency-free static server and local Ollama integration.
- `tests/`: rule boundaries, malformed input, evidence correlation, local API behavior.
- `scripts/`: prerequisite diagnostics and reproducible evaluation runner.

## Portfolio research extension

Start with the supplied examples, then create an independently labelled held-out set. Compare rule output and AI explanations. Report alert precision/recall separately from explanation accuracy and unsupported-claim rate. The automated checks verify behavior, not real-world detection accuracy. The committed real-model runs are small development experiments; they are not a held-out benchmark.

## Documentation

- [Architecture, data flow, API, and rule behavior](docs/ARCHITECTURE.md)
- [Evaluation method, actual results, and model mistakes](docs/EVALUATION.md)
- [Verification record](docs/VERIFICATION.md)
- [Prerequisite knowledge and demonstration guide](docs/LEARNING-GUIDE.md)
- [Portfolio proof checklist](docs/PROVE-YOUR-PROJECT.md)

## Troubleshooting

| Problem | Next step |
|---|---|
| Local AI is unavailable | Start Ollama, run `npm run doctor`, and check the installed model list. |
| The hosted page cannot connect to Ollama | Run `npm start` and use the local URL. The hosted site only provides browser-based features. |
| A response takes a long time | CPU-only inference took about 75–103 seconds in the recorded runs. Wait for completion; avoid parallel model jobs. |
| Evidence references are rejected | Use the built-in explanation and inspect the saved model response. Do not remove the validator to make an invalid answer appear supported. |
| Notes disappeared | Notes are session-only and reset on reanalysis or reload. Export the report before replacing the input. |
| No findings appear | Check input validity and rule thresholds. Absence of these three patterns is not proof of safety. |

## Contribution and research claims

This prototype was built with AI coding assistance. The student should document personal changes, experiments, and conclusions and be able to explain the implementation. It uses a pretrained model for inference; it does not train a model. The project does not claim production readiness, original research, or guaranteed internship selection.
