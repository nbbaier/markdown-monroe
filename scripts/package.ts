import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = resolve(projectRoot, "dist");
const release = resolve(projectRoot, "release");

const manifest = Bun.file(resolve(dist, "manifest.json"));
if (!(await manifest.exists())) {
	throw new Error("dist/manifest.json is missing; run bun run build first");
}

const manifestContents: unknown = await manifest.json();
if (
	typeof manifestContents !== "object" ||
	manifestContents === null ||
	!("version" in manifestContents) ||
	typeof manifestContents.version !== "string"
) {
	throw new Error("dist/manifest.json does not contain a valid version");
}

await mkdir(release, { recursive: true });
const output = resolve(
	release,
	`markdown-monroe-v${manifestContents.version}.zip`,
);
await rm(output, { force: true });
const result = Bun.spawnSync(["zip", "-qr", output, "."], { cwd: dist });
if (result.exitCode !== 0) {
	throw new Error(new TextDecoder().decode(result.stderr));
}
console.log(`Created ${output}`);
