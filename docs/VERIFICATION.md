# Verification record — 9 October 2026

## Automated checks

`npm test`: 20 tests passed. These cover input parsing and rejection, inclusive time windows, account/source correlation, evidence ordering, IPv6 normalization, midnight timestamps, reset after successful authentication, evaluation arithmetic, suite validation, local API origin controls, server-derived evidence, and rejection of fabricated model citations.

The Ollama integration tests use controlled mock responses. No real model was evaluated during this verification.

`node tests/browser-check.mjs`: passed in headless Microsoft Edge. The check covers sample analysis, severity and event filters, raw evidence, malformed inputs, file upload, JSON and Markdown report downloads, preservation of analyst notes when switching findings, evaluation metrics and invalid imports, case inspection, navigation, and safe rendering of log text.

Desktop (1440 px) and mobile (390 px) screenshots were inspected. No document-level horizontal overflow occurred at the tested widths or during the desktop root-text enlargement check. Scrollable event tables retain their columns. This is not a complete accessibility audit. Native WebMCP was unavailable in the test browser, so registration could not be exercised there.

## Development evaluation

`npm run evaluate`: 12 synthetic development scenarios, 10 exact case matches, 7 true-positive labels, 1 false-positive label, 1 missed label, and 27 true-negative labels. Micro precision and recall are both 87.5%.

Labels represent desired review decisions at the case/rule level. The intentionally benign retry sequence demonstrates missing operational context; slow attempts demonstrate a fixed-window limitation. These examples are not independent, representative, held-out, or an estimate of real-world security performance. They do not evaluate explanation quality.

## Prerequisites and remaining work

`npm run doctor`: Node.js v24.13.1 and application files are available. Ollama was not reachable at its local endpoint. Its installation status was not established by this check.

Remaining evidence: an independently labelled frozen test set, real local-model responses, manual assessment of supported and unsupported claims, saved measurements, a short demonstration, and a report explaining the author's contributions and limitations. Follow [the portfolio proof checklist](PROVE-YOUR-PROJECT.md).
