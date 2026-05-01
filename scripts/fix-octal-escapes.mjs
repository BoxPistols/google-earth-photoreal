/**
 * Post-build pass that rewrites legacy octal escape sequences in the static
 * export to their hex equivalents.
 *
 * Why: Cesium 1.140 ships Emscripten-compiled WASM glue (e.g. @spz-loader/core)
 * whose binary blobs are inlined as JS strings containing sequences like "\00".
 * Strict-mode template literals — which Webpack/SWC produce by default — forbid
 * legacy octal escapes (\00–\07, \1–\7, ...). The browser then throws
 *   "Octal escape sequences are not allowed in template strings"
 * and the chunk fails to execute (surfaces as ChunkLoadError).
 *
 * Replacing "\00" with "\x00" (hex escape) is byte-for-byte equivalent and is
 * accepted in strict-mode templates.
 *
 * Scope: walk out/_next/static/chunks/ recursively, fix .js files in place.
 */
import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";

const ROOT = "out/_next/static/chunks";

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

/**
 * Replace legacy octal escape sequences with hex equivalents.
 * - "\0" alone (followed by a non-digit) is allowed in strict templates → leave it
 * - "\00".."\07", "\10".."\77", "\000".."\377" → "\x{hex}"
 * - "\\0..." (escaped backslash before zero) is left alone (negative lookbehind)
 */
function fixOctals(src) {
  return src.replace(/(?<!\\)\\([0-7]{1,3})/g, (m, octal) => {
    if (octal === "0") return m; // bare \0 is fine
    const v = parseInt(octal, 8);
    if (v > 0xff) return m; // shouldn't happen given regex, but be safe
    return "\\x" + v.toString(16).padStart(2, "0");
  });
}

async function maybeFixFile(path) {
  const src = await readFile(path, "utf8");
  const fixed = fixOctals(src);
  if (fixed === src) return false;
  await writeFile(path, fixed);
  return true;
}

try {
  const s = await stat(ROOT);
  if (!s.isDirectory()) throw new Error(`${ROOT} is not a directory`);
} catch {
  console.warn(`[fix-octal-escapes] ${ROOT} not found; skipping`);
  process.exit(0);
}

const files = (await walk(ROOT)).filter((f) => f.endsWith(".js"));
let changed = 0;
for (const f of files) {
  if (await maybeFixFile(f)) {
    changed++;
    console.log(`  fixed: ${f}`);
  }
}
console.log(
  `[fix-octal-escapes] scanned ${files.length} files, rewrote ${changed}`,
);
