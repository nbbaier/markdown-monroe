import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const fixtureRoot = resolve(
	fileURLToPath(new URL("../fixtures", import.meta.url)),
);
const projectRoot = resolve(fixtureRoot, "..");
const port = Number(process.env.MARKDOWN_MONROE_PORT ?? 4173);

const contentTypes: Record<string, string> = {
	"/": "text/html; charset=utf-8",
	"/index.html": "text/html; charset=utf-8",
	"/markdown.md": "text/markdown; charset=utf-8",
	"/unsafe.md": "text/markdown; charset=utf-8",
	"/plain.txt": "text/plain; charset=utf-8",
	"/ordinary.html": "text/html; charset=utf-8",
	"/viewer.html": "text/html; charset=utf-8",
	"/dist/content.css": "text/css; charset=utf-8",
	"/dist/content.js": "text/javascript; charset=utf-8",
};

async function createViewerHarness(): Promise<Response> {
	const markdown = await Bun.file(resolve(fixtureRoot, "markdown.md")).text();
	const harnessMarkdown = markdown.endsWith("\n")
		? markdown.slice(0, -1)
		: markdown;
	const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Markdown Monroe viewer harness</title>
    <script>
      const preferences = {};
      globalThis.chrome = {
        runtime: { getURL: (path) => \`/dist/\${path}\` },
        storage: {
          local: {
            get: async (defaults) => ({ ...defaults, ...preferences }),
            set: async (items) => Object.assign(preferences, items),
          },
        },
      };
      Object.defineProperty(document, "contentType", { configurable: true, value: "text/markdown" });
    </script>
    <script src="/dist/content.js" defer></script>
  </head>
  <body><pre></pre><script>document.querySelector("pre").textContent=${JSON.stringify(harnessMarkdown)};document.currentScript.remove();</script></body>
</html>`;
	return new Response(html, {
		headers: { "content-type": contentTypes["/viewer.html"] },
	});
}

const server = Bun.serve({
	port,
	async fetch(request) {
		const url = new URL(request.url);
		const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
		if (pathname === "/viewer.html") return createViewerHarness();

		const root = pathname.startsWith("/dist/") ? projectRoot : fixtureRoot;
		const file = Bun.file(resolve(root, pathname.slice(1)));
		if (!(await file.exists()))
			return new Response("Not found", { status: 404 });

		return new Response(file, {
			headers: {
				"content-type": contentTypes[pathname] ?? "text/plain; charset=utf-8",
			},
		});
	},
});

console.log(`Markdown Monroe fixtures: ${server.url}`);
