// pnpm dev: API server (tsx watch, :8080) + Vite dev server (:5173, proxies /api).
import { spawn } from "node:child_process";
const run = (cmd, args) => spawn(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
const procs = [run("npx", ["tsx", "watch", "server/index.ts"]), run("npx", ["vite"])];
const stop = () => procs.forEach((p) => p.kill());
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
procs.forEach((p) => p.on("exit", stop));
