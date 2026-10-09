import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp, evidenceCitations } from "../server.mjs";
import { sampleLogs } from "../dist/core.mjs";
async function app(t, mock) {
  const server = createApp({ ollamaFetch: mock });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return "http://127.0.0.1:" + server.address().port;
}
test("companion serves assets and rejects cross-origin API requests", async (t) => {
  const url = await app(
    t,
    async () => new Response(JSON.stringify({ models: [] })),
  );
  assert.equal((await fetch(url)).status, 200);
  assert.equal(
    (
      await fetch(url + "/api/models", {
        headers: { Origin: "https://example.com" },
      })
    ).status,
    403,
  );
  assert.equal(
    (await fetch(url + "/api/models", { method: "POST" })).status,
    405,
  );
  assert.equal((await fetch(url + "/missing")).status, 404);
});
test("local model receives server-derived normalized evidence and returns cited text", async (t) => {
  let prompt;
  const url = await app(t, async (path, options) => {
    if (path.endsWith("/api/tags"))
      return Response.json({ models: [{ name: "test-model" }] });
    prompt = JSON.parse(options.body);
    const ids = JSON.parse(prompt.messages[1].content).providedEvidence.map(
      (e) => e.id,
    );
    return Response.json({
      message: {
        content: `Observed repeated failures [${ids[0]}]. Review the evidence; compromise is not confirmed.`,
      },
    });
  });
  const response = await fetch(url + "/api/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: sampleLogs(),
      alertId: "F1",
      model: "test-model",
      think: true,
    }),
  });
  assert.equal(response.status, 200);
  const output = await response.json();
  assert.equal(output.verified, false);
  assert.equal(output.thinkingRequested, false);
  assert.equal(prompt.think, false, "the caller cannot enable reasoning");
  const evidence = JSON.parse(prompt.messages[1].content).providedEvidence;
  assert.ok(evidence.length);
  assert.ok(evidence.every((e) => !("raw" in e)));
  assert.match(prompt.messages[0].content, /untrusted/);
});
test("invalid citations are rejected rather than displayed as supported", async (t) => {
  const url = await app(t, async (path) =>
    Response.json(
      path.endsWith("/api/tags")
        ? { models: [{ name: "test-model" }] }
        : { message: { content: "Attack confirmed [E999999]." } },
    ),
  );
  const r = await fetch(url + "/api/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: sampleLogs(),
      alertId: "F1",
      model: "test-model",
    }),
  });
  assert.equal(r.status, 503);
  assert.match((await r.json()).error, /evidence/);
});

test('citation groups accept only supplied IDs and reject unknown or ambiguous references', () => {
  assert.deepEqual(evidenceCitations('Events [E17, E19] and [E20][E17].', ['E17','E19','E20']), ['E17','E19','E20']);
  assert.throws(() => evidenceCitations('Events [E17, E999].', ['E17']), /invalid evidence/);
  assert.throws(() => evidenceCitations('Events [E17-E19].', ['E17','E19']), /format/);
  assert.throws(() => evidenceCitations('No citations.', ['E17']), /missing/);
});
test("uninstalled models and fabricated alerts are rejected", async (t) => {
  const url = await app(t, async () => Response.json({ models: [] }));
  for (const [alertId, model] of [
    ["F1", "missing"],
    ["F999", "test"],
  ]) {
    const r = await fetch(url + "/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: sampleLogs(), alertId, model }),
    });
    assert.equal(r.status, 400);
  }
});
