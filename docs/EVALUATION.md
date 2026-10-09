# Evaluation results and limitations

Recorded on 9 October 2026. This is a development record, not a held-out research benchmark.

## Rule evaluation

Command: `npm run evaluate`.

The bundled suite contains 12 hand-authored synthetic cases. The evaluation unit is one case × one rule label. Multiple alerts for the same rule in one case count once. Desired labels express which patterns the scenario author considers worth reviewing, including context that the logs may not contain.

| Result | Value |
|---|---:|
| Exact case matches | 10 / 12 |
| True-positive labels | 7 |
| False-positive labels | 1 |
| Missed labels | 1 |
| True-negative labels | 27 |
| Micro precision | 87.5% |
| Micro recall | 87.5% |

Precision is TP / (TP + FP). Recall is TP / (TP + FN). The development suite intentionally includes a known benign maintenance-retry false positive and a slow-attempt miss. It is neither independent nor representative of operational traffic; these percentages are not real-world attack-detection accuracy.

## Real local-model runs

Environment: Windows, Node.js v24.13.1, Ollama 0.40.2, model `qwen3.5:4b`, Q4_K_M quantization. Ollama reported CPU execution with zero VRAM allocation. The installed model metadata reported approximately 4.2B parameters. The saved JSON records include the exact model digest.

Both runs explicitly sent `think: false`. No thinking field content was returned in any of the six responses. Model weights were not trained or fine-tuned for this project.

The first run used a 220-word prompt request and a 650-token output limit. One explanation passed the original reference validator. Two were rejected: the validator did not support comma-separated reference groups, and one output also used an ambiguous reference range. The source was then changed to accept explicit groups while continuing to reject unknown IDs and ranges. The revised prompt asked for fewer than 140 words, discouraged unsupported statistical claims, and used a 450-token output limit. Word limits are prompt requests, not enforced guarantees.

| Rule | First run | First latency | Revised run | Revised latency |
|---|---|---:|---|---:|
| AUTH-003 | Accepted | 81.984 s | Accepted | 101.891 s |
| AUTH-002 | Reference check rejected | 74.943 s | Accepted | 103.054 s |
| AUTH-001 | Reference check rejected | 88.921 s | Accepted | 81.650 s |

Accepted means that a final answer was received and all recognized evidence IDs passed the validator. It does not mean factual correctness. CPU load and other local activity were not controlled, so these timings cannot establish that one prompt is faster. There was one response per rule per version, without repeated trials or an independent test set.

## Review of the revised answers

This review was performed by the coding assistant against the saved input, not by an independent human evaluator.

| Rule | Observed issue |
|---|---|
| AUTH-003 | The answer says **five** failed logins, but the supplied evidence contains **six** failures and one success. All cited IDs exist, so ID validation did not catch the count error. The wording also adds urgency not established by the logs. |
| AUTH-002 | The answer says **28 seconds**, but the interval from 09:04:00 to 09:05:28 is **88 seconds**. It also introduces attack terminology and likelihood wording that the evidence cannot establish. |
| AUTH-001 | The five-event count, account, source, and time bounds match the supplied evidence. Its proposed service-account explanation remains a hypothesis, not an observed fact. |

The built-in deterministic explanations compute counts and timestamps from the selected evidence. They should remain available as the factual baseline. A useful next experiment is to supply the model with these computed facts explicitly and measure whether count and duration errors decrease on a separate labelled set. Another is to have reviewers score usefulness and unsupported claims without knowing which explanation produced them.

## Reproduce and inspect

```sh
npm test
npm run evaluate
npm run evaluate:llm -- qwen3.5:4b
```

The last command uses your locally installed model, takes several minutes on a CPU, and writes `artifacts/real-model-smoke.json`. It may produce different text on another run. It does not download a model or use a paid API.

Committed snapshots contain only generated demo logs using documentation IP ranges:

- [Initial model run](evaluations/qwen3.5-4b-baseline.json)
- [Revised model run](evaluations/qwen3.5-4b-revised.json)
- [Rule development results](evaluations/rule-development.json)

Each model snapshot contains the exact input, prompts, final answers, output checks, and timings. Model reasoning traces are not stored. Keep future real or sensitive logs out of committed evaluation files.
