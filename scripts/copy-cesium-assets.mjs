// Copies Cesium's static assets (Workers, Assets, Widgets, ThirdParty) into /public/cesium
// so Next.js can serve them. Cesium needs CESIUM_BASE_URL to point here at runtime.
import { existsSync, mkdirSync, cpSync } from "node:fs";
import { resolve, join } from "node:path";

const root = resolve(process.cwd());
const src = join(root, "node_modules", "cesium", "Build", "Cesium");
const dst = join(root, "public", "cesium");

if (!existsSync(src)) {
  console.warn("[cesium] node_modules/cesium not found yet — skipping asset copy.");
  process.exit(0);
}

mkdirSync(dst, { recursive: true });
for (const sub of ["Workers", "Assets", "Widgets", "ThirdParty"]) {
  const from = join(src, sub);
  const to = join(dst, sub);
  if (existsSync(from)) {
    cpSync(from, to, { recursive: true });
    console.log(`[cesium] copied ${sub}`);
  }
}
