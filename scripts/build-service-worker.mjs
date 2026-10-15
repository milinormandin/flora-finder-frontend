import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const outputDirectory = resolve(process.argv[2] ?? "out");
const templatePath = join(dirname(fileURLToPath(import.meta.url)), "service-worker.js");
const template = await readFile(templatePath, "utf8");

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return filesIn(path);
    return entry.isFile() ? [path] : [];
  }));
  return nested.flat();
}

const allFiles = (await filesIn(outputDirectory))
  .map((path) => relative(outputDirectory, path).split("\\").join("/"))
  .sort();
const coreDocuments = new Map([
  ["index.html", "/"],
  ["plant_list.html", "/plant_list"],
  ["offline.html", "/offline"],
]);
const requiredAssets = [
  "datasets/plants.json",
  "manifest.webmanifest",
  "plant-placeholder.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
];

for (const path of [...coreDocuments.keys(), ...requiredAssets]) {
  if (!allFiles.includes(path)) {
    throw new Error(`Missing PWA export asset: ${path}. Run the Next.js production build first.`);
  }
}

const staticAsset = /^_next\/static\/.*\.(?:js|css|json|woff2?|ttf|otf|eot|ico|svg|png|jpe?g|webp|avif)$/i;
const corePayload = /^(?:index\.txt|__next\.[^/]+\.txt|(?:plant_list|offline)\.txt|(?:plant_list|offline)\/.*\.(?:txt|rsc))$/;
const selectedFiles = allFiles.filter((path) => (
  coreDocuments.has(path)
  || requiredAssets.includes(path)
  || path === "favicon.ico"
  || path.startsWith("icons/")
  || staticAsset.test(path)
  || corePayload.test(path)
));
const precacheUrls = selectedFiles.map((path) => coreDocuments.get(path) ?? `/${path}`);

// Hash the worker logic and every precached byte, including HTML, Next payloads,
// and catalog data. A change to any of them produces a separate cache revision.
const hash = createHash("sha256").update(template).update(JSON.stringify(precacheUrls));
let totalBytes = 0;
for (const path of selectedFiles) {
  const bytes = await readFile(join(outputDirectory, path));
  hash.update(path).update("\0").update(bytes).update("\0");
  totalBytes += bytes.length;
}
const revision = hash.digest("hex").slice(0, 20);
const worker = template
  .replace("__PWA_REVISION__", JSON.stringify(revision))
  .replace("__PWA_PRECACHE_URLS__", JSON.stringify(precacheUrls, null, 2));
await writeFile(join(outputDirectory, "sw.js"), worker);
console.info(`PWA worker ${revision}: ${precacheUrls.length} assets, ${(totalBytes / 1024 / 1024).toFixed(2)} MiB precached.`);

// Catch accidental generation into an invalid export directory before deploy.
await stat(join(outputDirectory, "sw.js"));
