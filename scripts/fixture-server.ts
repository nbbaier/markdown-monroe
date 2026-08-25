import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const fixtureRoot = resolve(fileURLToPath(new URL("../fixtures", import.meta.url)));
const port = Number(process.env.MARKDOWN_MONROE_PORT ?? 4173);

const contentTypes: Record<string, string> = {
  "/": "text/html; charset=utf-8",
  "/index.html": "text/html; charset=utf-8",
  "/markdown.md": "text/markdown; charset=utf-8",
  "/unsafe.md": "text/markdown; charset=utf-8",
  "/plain.txt": "text/plain; charset=utf-8",
  "/ordinary.html": "text/html; charset=utf-8",
};

const server = Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = Bun.file(resolve(fixtureRoot, pathname.slice(1)));
    if (!(await file.exists())) return new Response("Not found", { status: 404 });

    return new Response(file, {
      headers: {
        "content-type": contentTypes[pathname] ?? "text/plain; charset=utf-8",
      },
    });
  },
});

console.log(`Markdown Monroe fixtures: ${server.url}`);
