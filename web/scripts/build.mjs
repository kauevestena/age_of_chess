import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(fileURLToPath(new URL("..", import.meta.url))),
  dest = resolve(root, "dist");
await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });
for (const name of ["index.html", "styles.css", "src", "assets", "licenses"])
  await cp(resolve(root, name), resolve(dest, name), { recursive: true });
await writeFile(resolve(dest, ".nojekyll"), "");
console.log(
  "Static site built in web/dist (no runtime server or build dependencies).",
);
