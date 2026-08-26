import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const version = process.argv[2];
const chromeVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const versionParts = version?.split(".").map(Number) ?? [];
const isChromeVersion =
	version !== undefined &&
	chromeVersionPattern.test(version) &&
	versionParts.some((part) => part !== 0) &&
	versionParts.every((part) => part <= 65_535);

if (!isChromeVersion) {
	throw new Error(
		"Usage: bun scripts/set-version.ts <major.minor.patch> (numeric parts must be 0-65535 and the version cannot be 0.0.0)",
	);
}

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const files = ["package.json", "public/manifest.json"];

for (const relativePath of files) {
	const path = resolve(projectRoot, relativePath);
	const source = await Bun.file(path).text();
	const contents: unknown = JSON.parse(source);
	if (
		typeof contents !== "object" ||
		contents === null ||
		!("version" in contents) ||
		typeof contents.version !== "string"
	) {
		throw new Error(`${relativePath} does not contain a string version`);
	}

	const updated = source.replace(/("version"\s*:\s*)"[^"]+"/, `$1"${version}"`);
	await Bun.write(path, updated);
}

console.log(`Set Markdown Monroe version to ${version}`);
