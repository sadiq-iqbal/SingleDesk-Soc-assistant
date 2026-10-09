# Verification record — 9 October 2026

## Automated checks

`npm test`: 21 tests passed. These cover input parsing and rejection, inclusive time windows, account/source correlation, evidence ordering, IPv6 normalization, midnight timestamps, reset after successful authentication, evaluation arithmetic, suite validation, local API origin controls, server-derived evidence, reasoning disabled despite caller input, explicit citation groups, and rejection of unknown or ambiguous references.

Automated API tests use controlled mock responses. Separate real runs evaluated `qwen3.5:4b` on three synthetic findings before and after a citation-format fix. All revised calls completed, but two answers contained factual mistakes. See [the evaluation record](EVALUATION.md) and its saved outputs.

`node tests/browser-check.mjs`: passed in headless Microsoft Edge. The check covers sample analysis, severity and event filters, raw evidence, malformed inputs, file upload, JSON and Markdown report downloads, preservation of analyst notes when switching findings, evaluation metrics and invalid imports, case inspection, navigation, and safe rendering of log text.

Desktop (1440 px) and mobile (390 px) screenshots were inspected. No document-level horizontal overflow occurred at the tested widths or during the desktop root-text enlargement check. Scrollable event tables retain their columns. This is not a complete accessibility audit. Native WebMCP was unavailable in the test browser, so registration could not be exercised there.

## Development evaluation

`npm run evaluate`: 12 synthetic development scenarios, 10 exact case matches, 7 true-positive labels, 1 false-positive label, 1 missed label, and 27 true-negative labels. Micro precision and recall are both 87.5%.

Labels represent desired review decisions at the case/rule level. The intentionally benign retry sequence demonstrates missing operational context; slow attempts demonstrate a fixed-window limitation. These examples are not independent, representative, held-out, or an estimate of real-world security performance. They do not evaluate explanation quality.

## Prerequisites and remaining work

`npm run doctor`: Node.js v24.13.1 and application files are available. After the user installed Ollama and `qwen3.5:4b`, the local service was reachable and reported that model. A browser check confirmed the model was selected, the explanation action was enabled, and the interface showed thinking off.

Remaining evidence: an independently labelled frozen test set, independent human assessment of supported and unsupported claims, repeated measurements, a short demonstration, and the student's report explaining personal contributions and limitations. Follow [the portfolio proof checklist](PROVE-YOUR-PROJECT.md).
