# What to understand and demonstrate

This project is a portfolio prototype. A strong application needs an explanation of your contribution, repeatable measurements, and honest limits.

## Prerequisite knowledge

1. JavaScript modules, arrays, maps, promises, `async/await`, and error handling.
2. HTTP requests, JSON, browser events, and safe text rendering.
3. IP addresses, authentication success/failure, timestamps, timezones, and log formats.
4. The difference between repeated password attempts, possible password spraying, and a confirmed compromise.
5. Sliding time windows, grouping by source and account, and inclusive boundaries.
6. LLM inference versus model training; prompts, context limits, hallucinations, and untrusted input.
7. Precision, recall, false positives, false negatives, and development versus held-out evaluation.
8. Git commits, branches, reproducible commands, and documenting changes.

## Read the code in this order

Start with `sampleLogs()` and `parseLogs()` in `dist/core.mjs`. Follow a record into a normalized event with an evidence ID. Read `firstWindow()` and `detect()`, then change a test input so it falls just outside a rule's time boundary.

Next, read `explain()` and compare its deterministic output with a model-generated explanation. Read `server.mjs` to see how the evidence is selected, why thinking is explicitly off, and what citation validation does and does not prove.

Finally, run the Evaluation screen and trace one false positive and one miss. Read `dist/evaluation.mjs` and calculate the same precision and recall by hand.

## Suggested demonstration

1. Load the mixed-activity sample and explain the three findings.
2. Open an evidence event and connect it to the rule threshold.
3. Mark a finding as investigating and record a specific uncertainty.
4. Connect to your installed model and request an explanation with thinking off.
5. Check each factual claim against the evidence, including counts and timestamps.
6. Export the investigation and show the labelled-case evaluation.
7. Show a failure example and explain a possible next experiment.

## Portfolio deliverables still needed

- A frozen test set labelled separately from rule development, with documented provenance and assumptions.
- Human review of final explanations, including incorrect counts, unsupported claims, citation support, and usefulness.
- A short screen recording and a report with saved results.
- Clear documentation of AI-assisted scaffolding and your own changes, experiments, and conclusions.

The assistant's own review is not an independent human evaluation. A small synthetic smoke test does not establish real-world detection performance, research novelty, or internship acceptance.
