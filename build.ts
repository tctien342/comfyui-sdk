/// <reference types="bun-types" />
import { generateDtsBundle } from "dts-bundle-generator";
import fs from "fs";

import { peerDependencies } from "./package.json";

const start = Date.now();

console.log("JSCompiling", "Building...");

await Bun.build({
  entrypoints: ["./index.ts"],
  external: Object.keys(Object.keys(peerDependencies)),
  format: "esm",
  minify: true,
  outdir: "./build",
  sourcemap: "external",
  target: "browser",
});
console.log("JSCompiling", "Done!");

console.log("TypeCompiling", "Building...");
const typedContent = generateDtsBundle([
  {
    filePath: "./index.ts",
  },
]);

// Write typed content to index.d.ts
fs.writeFileSync("./build/index.d.ts", typedContent.join("\n"));
console.log("TypeCompiling", "Done!");
console.log("Build", `Build success, take ${Date.now() - start}ms`);
