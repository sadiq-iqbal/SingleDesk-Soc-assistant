# From prototype to an internship portfolio

## What exists now

- Working authentication-log investigation tool with three documented detection rules.
- Evidence references, raw log inspection, analyst notes, and downloadable investigation reports.
- Optional local Ollama integration; automated integration checks use controlled mock model responses.
- A reproducible synthetic development evaluation plus support for importing your own labelled cases.

These show implementation progress. They do not establish real-world security effectiveness, original research, or successful LLM evaluation.

## What to install

Node.js 20+ runs the app. Node.js was already present in this workspace when checked. There are no runtime dependencies to install.

For AI explanations, install Ollama: https://ollama.com/download/windows. Then download one model, such as `ollama pull qwen3:1.7b` as a smaller starting option or `ollama pull qwen3:4b` if your hardware can support it. Download size and runtime memory differ; response speed depends on your machine. No model is downloaded automatically. Official model information: https://ollama.com/library/qwen3.

Run `npm run doctor` to check local prerequisites. Run `npm start`, open http://127.0.0.1:4173, then use Local AI settings → Check connection. A hosted preview does not include the local Ollama process.

## Evidence you should collect

1. **An independently labelled test set.** Prepare around 30–50 varied scenarios after fixing your development choices. Include ordinary activity, ambiguous retries, multiple-account attempts, slow attempts, IPv6, and malformed records. Have a faculty member or knowledgeable peer review labels if possible. Record dataset origin, labeling assumptions, and exclusions. Do not label a suspicious sequence as confirmed compromise without supporting context.
2. **Detection results.** Import your labelled cases in Evaluation or run `npm run evaluate -- path/to/suite.json`. Save precision, recall, false positives, and missed labels. The evaluation unit is one case × one rule label; this does not measure localization, duplicate alerts, or incident-level performance.
3. **Real model results.** Run the same chosen local model across the relevant findings. Save the model name, date, prompts, evidence, responses, and latency. Manually assess factual support, useful verification questions, and unsupported claims. Citation validity alone is not factual correctness. Compare these explanations with the deterministic explanations on the same findings.
4. **Failure analysis.** Show several mistakes and explain why they happen. The built-in maintenance-retry false positive and slow-attempt miss are useful development examples, not held-out discoveries.
5. **A short demo.** In 2–3 minutes, import logs, inspect a finding, follow an evidence reference, add an analyst note, and show an evaluation result.
6. **A 2–3 page report.** State the question, design, data, evaluation method, results, limitations, and next experiment. Cite related work. Make no performance claim without a saved result.
7. **Your own understanding.** Explain parsing, time windows, matching accounts and sources, prompt construction, citation checking, precision/recall, and why these checks cannot prove an attack. Document AI assistance and distinguish the initial scaffold from your experiments and changes.

## Useful research question

Does an evidence-linked local LLM explanation help a reviewer interpret rule-generated authentication alerts, without adding unsupported claims?

Measure detection quality separately from explanation quality. Improving the interface alone cannot answer this question. No paper or acceptance outcome is guaranteed.

## Report outline

- Problem and research question
- Relevant project requirements and related work
- System diagram and implementation choices
- Dataset provenance, labels, and evaluation split
- Baselines and metrics
- Actual results with saved artifacts
- Error examples and limitations
- Your contribution and next steps
