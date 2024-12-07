/// <reference types="bun-types" />
import { generateDtsBundle } from "dts-bundle-generator";
import fs from "fs";

import { dependencies, peerDependencies } from "./package.json";

// Create build folder if not exist
if (!fs.existsSync("./build")) {
  fs.mkdirSync("./build");
}

const start = Date.now();

console.log("JSCompiling", "Building...");

await Promise.all([
  Bun.build({
    entrypoints: ["./index.ts"],
    external: Object.keys(dependencies).concat(Object.keys(peerDependencies)),
    format: "esm",
    minify: true,
    outdir: "./build",
    naming: "index.esm.js",
    sourcemap: "external",
    target: "browser"
  }),
  Bun.build({
    entrypoints: ["./index.ts"],
    external: Object.keys(dependencies).concat(Object.keys(peerDependencies)),
    format: "cjs",
    minify: true,
    outdir: "./build",
    naming: "index.cjs.js",
    sourcemap: "external",
    target: "node"
  })
]);
console.log("JSCompiling", "Done!");

console.log("TypeCompiling", "Building...");
const typedContent = generateDtsBundle([
  {
    filePath: "./index.ts"
  }
]);

// Write typed content to index.d.ts
fs.writeFileSync("./build/index.d.ts", typedContent.join("\n"));
console.log("TypeCompiling", "Done!");
console.log("Build", `Build success, take ${Date.now() - start}ms`);
