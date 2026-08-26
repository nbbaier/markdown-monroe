import { JSDOM } from "jsdom";

type TestGlobals = typeof globalThis & { document: Document };

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

const browserWindow = new JSDOM("", {
	url: "http://localhost:4174/markdown.md",
}).window;
const globals = globalThis as TestGlobals;
Object.defineProperty(globalThis, "window", {
	configurable: true,
	value: browserWindow,
});
Object.defineProperty(globalThis, "document", {
	configurable: true,
	value: browserWindow.document,
});

const constructors = [
	"HTMLAnchorElement",
	"HTMLButtonElement",
	"DocumentFragment",
	"Element",
	"HTMLElement",
	"HTMLHeadingElement",
	"HTMLInputElement",
	"HTMLPreElement",
	"HTMLSelectElement",
	"HTMLTemplateElement",
	"Node",
];
for (const name of constructors) {
	Object.defineProperty(globalThis, name, {
		configurable: true,
		value: (browserWindow as unknown as Record<string, unknown>)[name],
	});
}

const { detectMarkdownDocument } = await import("../src/detect");
const { prepareFormattedContent, renderMarkdown } = await import(
	"../src/markdown"
);
const { marked } = await import("marked");

function setFixturePage(mimeType: string, raw: string): void {
	const { document } = globals;
	document.body.replaceChildren();
	const pre = document.createElement("pre");
	pre.textContent = raw;
	document.body.append(pre);
	document.documentElement.dataset.markdownMonroe = "";
	Object.defineProperty(document, "contentType", {
		configurable: true,
		value: mimeType,
	});
}

const markdown = await Bun.file("fixtures/markdown.md").text();
const unsafe = await Bun.file("fixtures/unsafe.md").text();

setFixturePage("text/markdown", markdown);
const markdownDetection = detectMarkdownDocument();
assert(
	markdownDetection?.raw === markdown,
	"Markdown MIME detection did not preserve source",
);

setFixturePage("text/plain", markdown);
assert(
	detectMarkdownDocument()?.mimeType === "text/plain",
	"Markdown-shaped text/plain was not detected",
);

setFixturePage("text/plain", "A plain paragraph without Markdown syntax.");
assert(!detectMarkdownDocument(), "Arbitrary text/plain content was replaced");

setFixturePage("text/html", markdown);
assert(!detectMarkdownDocument(), "HTML MIME content was replaced");

const formatted = renderMarkdown(markdown);
const container = document.createElement("article");
container.innerHTML = formatted;
const details = prepareFormattedContent(container);
const parsedGfm = marked.parse(markdown, { async: false, gfm: true }) as string;
assert(
	parsedGfm.includes("<h1>Markdown Monroe fixture</h1>"),
	"Fixture H1 was not parsed",
);
assert(details.headings.length >= 4, "Fixture headings were not rendered");
assert(
	new Set(details.headings.map(({ id }) => id)).size ===
		details.headings.length,
	"Heading IDs are not unique",
);
assert(container.querySelector("table"), "GFM table was not rendered");
assert(
	container.querySelectorAll('input[type="checkbox"]').length === 3,
	"GFM task list was not rendered",
);
assert(container.querySelector("del"), "GFM strikethrough was not rendered");
assert(container.querySelector("blockquote"), "Blockquote was not rendered");
assert(details.codeBlocks.length === 3, "Fenced code blocks were not found");
assert(
	container.querySelectorAll("code.hljs").length === 3,
	"Code blocks were not highlighted",
);
assert(
	!container.querySelector(".mm-code-copy"),
	"Preview still contains copy controls",
);

const sanitized = renderMarkdown(unsafe);
assert(!/<script\b/i.test(sanitized), "Script survived DOMPurify sanitization");
assert(
	!/\sonerror\s*=/i.test(sanitized),
	"Event handler survived DOMPurify sanitization",
);
assert(
	!/href=["']javascript:/i.test(sanitized),
	"javascript: URL survived DOMPurify sanitization",
);

const storedPreferences: Record<string, unknown> = {};
Object.defineProperty(globalThis, "chrome", {
	configurable: true,
	value: {
		runtime: { getURL: (path: string) => path },
		storage: {
			local: {
				get: async (defaults: Record<string, unknown>) => ({
					...defaults,
					...storedPreferences,
				}),
				set: async (items: Record<string, unknown>) => {
					Object.assign(storedPreferences, items);
				},
			},
		},
	},
});

const { createViewer } = await import("../src/viewer");
await createViewer(markdown);

const root = document.querySelector<HTMLElement>("#mm-root");
const currentView = () =>
	document.querySelector<HTMLElement>("#mm-root")?.dataset.view;
assert(
	root?.dataset.view === "preview",
	"Viewer did not start in Preview mode",
);
assert(
	!document.querySelector("#mm-preview")?.hasAttribute("hidden"),
	"Preview started hidden",
);
assert(
	!document.querySelector("#mm-toc")?.hasAttribute("hidden"),
	"Outline did not start open",
);
assert(
	!document.querySelector("#mm-copy-markdown, #mm-copy-code, .mm-code-copy"),
	"Copy UI is still present",
);
const expectedSourceLines = markdown.endsWith("\n")
	? markdown.replace(/\r\n?/g, "\n").split("\n").length - 1
	: markdown.replace(/\r\n?/g, "\n").split("\n").length;
assert(
	document.querySelectorAll("#mm-code .mm-source-line").length ===
		expectedSourceLines,
	"Code mode did not render every source line",
);
assert(
	document.querySelectorAll("#mm-code .mm-fold-toggle").length ===
		details.headings.length,
	"Code mode did not add one fold toggle per heading",
);

document.querySelector<HTMLButtonElement>('[data-view="code"]')?.click();
assert(currentView() === "code", "Code view toggle failed");
assert(
	document.querySelector("#mm-toc")?.hasAttribute("hidden"),
	"Outline remained visible in Code mode",
);
const foldToggle = document.querySelector<HTMLButtonElement>(
	"#mm-code .mm-fold-toggle",
);
foldToggle?.click();
assert(
	document.querySelector("#mm-code .mm-source-line[hidden]"),
	"Code section did not collapse",
);

document.querySelector<HTMLButtonElement>('[data-view="preview"]')?.click();
assert(
	!document.querySelector("#mm-toc")?.hasAttribute("hidden"),
	"Outline state was not restored in Preview",
);
document.querySelector<HTMLButtonElement>("#mm-toc-toggle")?.click();
document.querySelector<HTMLButtonElement>('[data-view="code"]')?.click();
document.querySelector<HTMLButtonElement>('[data-view="preview"]')?.click();
assert(
	document.querySelector("#mm-toc")?.hasAttribute("hidden"),
	"Closed Outline state was not preserved",
);

document.querySelector<HTMLButtonElement>('[data-view="raw"]')?.click();
assert(currentView() === "raw", "Raw view toggle failed");
assert(
	document.querySelector("#mm-raw code")?.textContent === markdown,
	"Raw view changed the source",
);
assert(
	!document.querySelector("#mm-raw .mm-line-number"),
	"Raw mode contains line numbers",
);

const themeSelect = document.querySelector<HTMLSelectElement>("#mm-theme");
assert(themeSelect, "Theme selector is missing");
themeSelect.value = "dark";
themeSelect.dispatchEvent(new browserWindow.Event("change", { bubbles: true }));
await new Promise((resolve) => setTimeout(resolve, 0));
assert(
	storedPreferences["markdown-monroe-theme"] === "dark",
	"Theme preference was not stored",
);

await createViewer(markdown);
assert(currentView() === "preview", "View mode did not reset to Preview");
assert(
	document.querySelector<HTMLElement>("#mm-root")?.dataset.theme === "dark",
	"Stored theme preference was not restored",
);
assert(
	!document.querySelector("#mm-toc")?.hasAttribute("hidden"),
	"Outline did not reset open",
);
console.log(
	"Fixture detection, rendering, three view modes, folding, Outline state, and sanitization: PASS",
);
