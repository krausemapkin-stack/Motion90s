import { mkdir, copyFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const output = resolve(root, "www");
const webFiles = [
  "index.html",
  "admin.html",
  "app.js",
  "admin.js",
  "admin-utils.js",
  "catalog.js",
  "youtube-import.js",
  "styles.css",
  "admin.css",
];

await mkdir(output, { recursive: true });
await Promise.all(
  webFiles.map((file) => copyFile(resolve(root, file), resolve(output, file))),
);
console.log(`Prepared ${webFiles.length} web assets in www/ for Capacitor.`);
