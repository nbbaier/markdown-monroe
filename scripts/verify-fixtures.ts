import { JSDOM } from "jsdom";

type TestGlobals = typeof globalThis & { document: Document };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const browserWindow = new JSDOM("", { url: "http://localhost:4174/markdown.md" }).window;
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
const { prepareFormattedContent, renderMarkdown } = await import("../src/markdown");
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
assert(markdownDetection?.raw === markdown, "Markdown MIME detection did not preserve source");

setFixturePage("text/plain", markdown);
assert(detectMarkdownDocument()?.mimeType === "text/plain", "Markdown-shaped text/plain was not detected");

setFixturePage("text/plain", "A plain paragraph without Markdown syntax.");
assert(!detectMarkdownDocument(), "Arbitrary text/plain content was replaced");

setFixturePage("text/html", markdown);
assert(!detectMarkdownDocument(), "HTML MIME content was replaced");

const formatted = renderMarkdown(markdown);
const container = document.createElement("article");
container.innerHTML = formatted;
const details = prepareFormattedContent(container);
const parsedGfm = marked.parse(markdown, { async: false, gfm: true }) as string;
assert(parsedGfm.includes("<h1>Markdown Monroe fixture</h1>"), "Fixture H1 was not parsed");
assert(details.headings.length >= 4, "Fixture headings were not rendered");
assert(new Set(details.headings.map(({ id }) => id)).size === details.headings.length, "Heading IDs are not unique");
assert(container.querySelector("table"), "GFM table was not rendered");
assert(container.querySelectorAll('input[type="checkbox"]').length === 3, "GFM task list was not rendered");
assert(container.querySelector("del"), "GFM strikethrough was not rendered");
assert(container.querySelector("blockquote"), "Blockquote was not rendered");
assert(details.codeBlocks.length === 2, "Fenced code blocks were not found");
assert(container.querySelectorAll("code.hljs").length === 2, "Code blocks were not highlighted");

const sanitized = renderMarkdown(unsafe);
assert(!/<script\b/i.test(sanitized), "Script survived DOMPurify sanitization");
assert(!/\sonerror\s*=/i.test(sanitized), "Event handler survived DOMPurify sanitization");
assert(!/href=["']javascript:/i.test(sanitized), "javascript: URL survived DOMPurify sanitization");

console.log("Fixture detector, GFM rendering, heading preparation, highlighting, and sanitization: PASS");
