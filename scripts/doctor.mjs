import { access } from "node:fs/promises";
console.log(
  `Node.js: ${process.version} ${Number(process.versions.node.split(".")[0]) >= 20 ? "OK" : "NEEDS VERSION 20+"}`,
);
try {
  await access(new URL("../dist/index.html", import.meta.url));
  console.log("Application files: OK");
} catch {
  console.log("Application files: MISSING");
  process.exitCode = 1;
}
try {
  const response = await fetch("http://127.0.0.1:11434/api/tags", {
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) throw Error();
  const data = await response.json();
  const names = (data.models ?? []).map((m) => m.name);
  console.log("Ollama: running locally");
  console.log(
    names.length
      ? "Installed models: " + names.join(", ")
      : "Models: none; download one with ollama pull qwen3:1.7b",
  );
} catch {
  console.log(
    "Ollama: not reachable. Optional AI requires Ollama and a downloaded model.",
  );
}
console.log("Core application: npm start, then open http://127.0.0.1:4173");
console.log("No paid API key, database, Python, or Docker is needed.");
