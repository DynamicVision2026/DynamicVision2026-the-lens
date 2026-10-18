// Bundle the Node server (and the shared src/ code it imports) into dist-server/index.js.
import { build } from "esbuild";
await build({
  entryPoints: ["server/index.ts"],
  outfile: "dist-server/index.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  packages: "external", // keep node_modules (sharp, sdk, hono) as runtime deps
  logLevel: "info",
});
