import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = resolve(projectRoot, "dist");
const requested = process.argv[2] ?? "all";
const targets = requested === "all" ? ["chrome", "firefox"] : [requested];

if (targets.some((target) => target !== "chrome" && target !== "firefox")) {
	throw new Error("Usage: bun scripts/package.ts [chrome|firefox|all]");
}

const manifest = Bun.file(resolve(dist, "manifest.json"));
if (!(await manifest.exists())) {
	throw new Error("dist/manifest.json is missing; run bun run build first");
}

for (const target of targets) {
	const output = resolve(projectRoot, `markdown-monroe-${target}.zip`);
	await mkdir(projectRoot, { recursive: true });
	const result = Bun.spawnSync(["zip", "-qr", output, "."], { cwd: dist });
	if (result.exitCode !== 0) {
		throw new Error(new TextDecoder().decode(result.stderr));
	}
	console.log(`Created ${output}`);
}
