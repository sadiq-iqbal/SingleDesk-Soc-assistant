// Real-model smoke test. This is intentionally separate from npm test.
// It sends only the included synthetic demo to the locally running Ollama.
import { createApp } from '../server.mjs';
import { sampleLogs, analyze } from '../dist/core.mjs';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';

const model = process.argv[2];
if (!model) throw Error('Usage: npm run evaluate:llm -- <installed-model-name>');
const base = 'http://127.0.0.1:11434';
const tags = await (await fetch(base + '/api/tags', { signal: AbortSignal.timeout(5000) })).json();
const metadata = tags.models?.find(item => item.name === model);
if (!metadata) throw Error('Choose an installed model reported by npm run doctor.');
const version = await (await fetch(base + '/api/version', { signal: AbortSignal.timeout(5000) })).json();
const input = sampleLogs();
const report = {
  startedAt: new Date().toISOString(), model, modelMetadata: metadata,
  ollamaVersion: version.version, thinkingRequested: false, input,
  scope: 'Three synthetic development findings. Response and citation checks are not factual-accuracy evaluation. Review final answers manually.',
  runs: [],
};
let invocation;
const server = createApp({ ollamaFetch: async (url, options) => {
  const response = await fetch(url, options);
  if (url.endsWith('/api/chat')) {
    const answer = await response.clone().json();
    invocation = {
      request: JSON.parse(options.body), responseStatus: response.status,
      finalAnswer: answer.message?.content, error: answer.error,
      doneReason: answer.done_reason, promptTokens: answer.prompt_eval_count,
      outputTokens: answer.eval_count, thinkingReturned: !!answer.message?.thinking,
      loadDurationNs: answer.load_duration, evalDurationNs: answer.eval_duration,
    };
  }
  return response;
}});
const folder = new URL('../artifacts/', import.meta.url);
const destination = new URL('real-model-smoke.json', folder);
await mkdir(folder, { recursive: true });
server.listen(0, '127.0.0.1');
await once(server, 'listening');
try {
  for (const finding of analyze(input).findings) {
    const started = Date.now(); invocation = null;
    console.log(`Testing ${finding.ruleId} with ${model}; thinking off…`);
    let status = null, output;
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/explain`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input, alertId: finding.id, model }),
        signal: AbortSignal.timeout(130000),
      });
      status = response.status; output = await response.json();
    } catch (error) { output = { error: error.message }; }
    const run = { rule: finding.ruleId, alertId: finding.id, status,
      elapsedMs: Date.now() - started, output, invocation };
    report.runs.push(run);
    await writeFile(destination, JSON.stringify(report, null, 2));
    console.log(`${run.rule}: HTTP ${status ?? 'unavailable'}, ${run.elapsedMs} ms; ${output.error ?? 'response saved for manual review'}`);
  }
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
console.log('Saved artifacts/real-model-smoke.json. Review unsupported claims, citation support, usefulness, and latency.');
if (report.runs.some(run => run.status !== 200)) process.exitCode = 1;
