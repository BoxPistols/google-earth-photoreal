/**
 * Drop a small build-info.json at the static-export root so the client can
 * poll it and detect when a new deploy has shipped while the tab was open.
 */
import { writeFile, mkdir } from "node:fs/promises";

const buildId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
await mkdir("out", { recursive: true });
await writeFile(
  "out/build-info.json",
  JSON.stringify({ buildId, builtAt: new Date().toISOString() }, null, 2),
);
console.log(`[write-build-info] buildId=${buildId}`);
