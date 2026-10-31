import { cpSync, mkdirSync, rmSync } from "node:fs";

const files = [
  "admin.css",
  "admin.html",
  "admin.js",
  "admin-utils.js",
  "app.js",
  "catalog.js",
  "index.html",
  "styles.css",
  "youtube-import.js",
];

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });
for (const file of files) cpSync(file, `dist/${file}`);
