import { readFile, mkdir, writeFile } from "node:fs/promises";
import {
  DEVELOPMENT_SUITE,
  parseSuite,
  evaluateSuite,
} from "../dist/evaluation.mjs";
const input = process.argv[2];
const suite = input
  ? parseSuite(await readFile(input, "utf8"))
  : DEVELOPMENT_SUITE;
const report = evaluateSuite(suite);
await mkdir("artifacts", { recursive: true });
await writeFile(
  "artifacts/evaluation-results.json",
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify(
    {
      suite: report.suite,
      cases: report.caseCount,
      exactMatches: report.exactMatches,
      ...report.totals,
      report: "artifacts/evaluation-results.json",
    },
    null,
    2,
  ),
);
console.log(
  "Development examples only unless you supplied an independently labelled evaluation set. LLM performance has not been measured.",
);
