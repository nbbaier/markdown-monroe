export {};

type PageTarget = {
	type: string;
	url: string;
	webSocketDebuggerUrl?: string;
};

type CdpResponse = {
	id?: number;
	error?: { message?: string };
	result?: {
		result?: { value?: unknown; description?: string };
		exceptionDetails?: { text?: string };
	};
};

const port = Number(process.env.MARKDOWN_MONROE_CDP_PORT ?? 9222);
const fixtureOrigin =
	process.env.MARKDOWN_MONROE_FIXTURE_ORIGIN ?? "http://127.0.0.1:4174";

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

function wait(milliseconds: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function findPageTarget(): Promise<PageTarget> {
	const response = await fetch(`http://127.0.0.1:${port}/json/list`);
	assert(response.ok, `DevTools target list failed: ${response.status}`);
	const targets = (await response.json()) as PageTarget[];
	const target =
		targets.find(
			(candidate) =>
				candidate.type === "page" &&
				candidate.url === `${fixtureOrigin}/markdown.md` &&
				candidate.webSocketDebuggerUrl,
		) ??
		targets.find(
			(candidate) =>
				candidate.type === "page" && candidate.webSocketDebuggerUrl,
		);
	assert(
		target?.webSocketDebuggerUrl,
		"No debuggable Chrome page target found",
	);
	return target;
}

async function connect(webSocketUrl: string) {
	const socket = new WebSocket(webSocketUrl);
	const pending = new Map<number, (response: CdpResponse) => void>();
	let nextId = 0;

	await new Promise<void>((resolve, reject) => {
		socket.addEventListener("open", () => resolve(), { once: true });
		socket.addEventListener(
			"error",
			() => reject(new Error("Could not connect to Chrome DevTools")),
			{ once: true },
		);
	});

	socket.addEventListener("message", (event) => {
		const message = JSON.parse(String(event.data)) as CdpResponse;
		if (message.id === undefined) return;
		const resolve = pending.get(message.id);
		if (!resolve) return;
		pending.delete(message.id);
		resolve(message);
	});

	async function call(
		method: string,
		params: Record<string, unknown> = {},
	): Promise<CdpResponse> {
		const id = ++nextId;
		const response = new Promise<CdpResponse>((resolve) =>
			pending.set(id, resolve),
		);
		socket.send(JSON.stringify({ id, method, params }));
		return response;
	}

	async function evaluate<T>(
		expression: string,
		userGesture = false,
	): Promise<T> {
		const response = await call("Runtime.evaluate", {
			expression,
			awaitPromise: true,
			returnByValue: true,
			userGesture,
		});
		const exception = response.result?.exceptionDetails;
		assert(
			!response.error && !exception,
			response.error?.message ?? exception?.text ?? "Chrome evaluation failed",
		);
		return response.result?.result?.value as T;
	}

	return { call, evaluate, close: () => socket.close() };
}

async function waitForPage(
	evaluate: <T>(expression: string, userGesture?: boolean) => Promise<T>,
): Promise<void> {
	const deadline = Date.now() + 7000;
	while (Date.now() < deadline) {
		const ready = await evaluate<boolean>("document.readyState === 'complete'");
		if (ready) {
			await wait(180);
			return;
		}
		await wait(100);
	}
	throw new Error("Timed out waiting for Chrome page load");
}

async function navigate(
	call: (
		method: string,
		params?: Record<string, unknown>,
	) => Promise<CdpResponse>,
	evaluate: <T>(expression: string, userGesture?: boolean) => Promise<T>,
	path: string,
): Promise<void> {
	await call("Page.navigate", { url: `${fixtureOrigin}${path}` });
	await waitForPage(evaluate);
}

const target = await findPageTarget();
const webSocketDebuggerUrl = target.webSocketDebuggerUrl;
assert(webSocketDebuggerUrl, "No debuggable Chrome page target found");
const browser = await connect(webSocketDebuggerUrl);
await browser.call("Runtime.enable");
await browser.call("Page.enable");

const source = await Bun.file("fixtures/markdown.md").text();

await waitForPage(browser.evaluate);
const markdownSnapshot = await browser.evaluate<{
	url: string;
	contentType: string;
	bodyChildren: string[];
	bodyText: string;
	viewer: boolean;
	raw: string;
	headings: number;
	tocLinks: number;
	tables: number;
	tasks: number;
	strike: number;
	blockquotes: number;
	codeBlocks: number;
	highlighted: number;
	unsafeScripts: number;
}>(`(() => ({
  url: location.href,
  contentType: document.contentType,
  bodyChildren: Array.from(document.body?.children ?? []).map((child) => child.tagName),
  bodyText: document.body?.textContent?.slice(0, 120) ?? "",
  viewer: Boolean(document.querySelector("#mm-root")),
  raw: document.querySelector("#mm-raw code")?.textContent ?? "",
  headings: document.querySelectorAll("#mm-preview h1, #mm-preview h2, #mm-preview h3").length,
  tocLinks: document.querySelectorAll("#mm-toc-list a").length,
  tables: document.querySelectorAll("#mm-preview table").length,
  tasks: document.querySelectorAll("#mm-preview input[type=checkbox]").length,
  strike: document.querySelectorAll("#mm-preview del").length,
  blockquotes: document.querySelectorAll("#mm-preview blockquote").length,
  codeBlocks: document.querySelectorAll("#mm-preview .mm-code-block").length,
  highlighted: document.querySelectorAll("#mm-preview code.hljs").length,
  unsafeScripts: document.querySelectorAll("#mm-preview script, #mm-preview [onerror]").length,
}))()`);
console.log("Chrome initial Markdown page snapshot", markdownSnapshot);
assert(markdownSnapshot.viewer, "Markdown MIME response was not replaced");
assert(
	markdownSnapshot.raw === source,
	"Raw view does not preserve the original Markdown",
);
assert(
	markdownSnapshot.headings >= 5,
	"Expected Markdown headings are missing",
);
assert(
	markdownSnapshot.tocLinks === markdownSnapshot.headings,
	"TOC does not contain every heading",
);
assert(markdownSnapshot.tables === 1, "GFM table was not rendered");
assert(markdownSnapshot.tasks === 3, "GFM task list was not rendered");
assert(markdownSnapshot.strike === 1, "GFM strikethrough was not rendered");
assert(markdownSnapshot.blockquotes === 1, "Blockquote was not rendered");
assert(
	markdownSnapshot.codeBlocks === 3 && markdownSnapshot.highlighted === 3,
	"Code blocks were not highlighted",
);
assert(
	markdownSnapshot.unsafeScripts === 0,
	"Unsafe elements survived sanitization",
);
console.log("Chrome Markdown rendering: PASS", markdownSnapshot);

await browser.evaluate(
	`document.querySelector('[data-view="raw"]')?.click()`,
	true,
);
const rawMode = await browser.evaluate<{
	previewHidden: boolean;
	rawHidden: boolean;
	lineNumbers: number;
}>(`(() => ({
  previewHidden: Boolean(document.querySelector("#mm-preview")?.hidden),
  rawHidden: Boolean(document.querySelector("#mm-raw")?.hidden),
  lineNumbers: document.querySelectorAll("#mm-raw .mm-line-number").length,
}))()`);
assert(
	rawMode.previewHidden && !rawMode.rawHidden && rawMode.lineNumbers === 0,
	"Raw view toggle failed",
);

await browser.evaluate(
	`document.querySelector('[data-view="preview"]')?.click()`,
	true,
);
await browser.evaluate(
	`document.querySelector('#mm-toc-toggle')?.click()`,
	true,
);
const tocHidden = await browser.evaluate<boolean>(
	"Boolean(document.querySelector('#mm-toc')?.hidden)",
);
assert(tocHidden, "TOC hide toggle failed");
await browser.evaluate(
	`document.querySelector('#mm-toc-toggle')?.click()`,
	true,
);
const tocVisible = await browser.evaluate<boolean>(
	"!document.querySelector('#mm-toc')?.hidden",
);
assert(tocVisible, "TOC show toggle failed");
console.log("Chrome view and TOC controls: PASS");

await browser.evaluate(
	`document.querySelector('[data-view="code"]')?.click()`,
	true,
);
const codeMode = await browser.evaluate<{
	rows: number;
	folds: number;
	tocHidden: boolean;
}>(`(() => ({
  rows: document.querySelectorAll("#mm-code .mm-source-line").length,
  folds: document.querySelectorAll("#mm-code .mm-fold-toggle").length,
  tocHidden: Boolean(document.querySelector("#mm-toc")?.hidden),
}))()`);
assert(
	codeMode.rows > 100 &&
		codeMode.folds === markdownSnapshot.headings &&
		codeMode.tocHidden,
	"Code view rendering failed",
);
await browser.evaluate(
	`document.querySelector("#mm-code .mm-fold-toggle")?.click()`,
	true,
);
const collapsedRows = await browser.evaluate<number>(
	"document.querySelectorAll('#mm-code .mm-source-line[hidden]').length",
);
assert(collapsedRows > 0, "Code section folding failed");
console.log("Chrome Code source rendering and folding: PASS");

for (const theme of ["light", "dark", "auto"]) {
	await browser.evaluate(
		`(() => { const select = document.querySelector('#mm-theme'); if (!(select instanceof HTMLSelectElement)) throw new Error('Theme select missing'); select.value = ${JSON.stringify(theme)}; select.dispatchEvent(new Event('change', { bubbles: true })); })()`,
		true,
	);
	await wait(100);
	const applied = await browser.evaluate<string>(
		"document.querySelector('#mm-root')?.dataset.theme ?? ''",
	);
	assert(applied === theme, `Theme ${theme} was not applied`);
}
await browser.evaluate(
	`(() => { const select = document.querySelector('#mm-theme'); if (!(select instanceof HTMLSelectElement)) throw new Error('Theme select missing'); select.value = 'dark'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`,
	true,
);
await wait(200);
await browser.call("Page.reload", { ignoreCache: true });
await waitForPage(browser.evaluate);
const persistedTheme = await browser.evaluate<string>(
	"document.querySelector('#mm-root')?.dataset.theme ?? ''",
);
assert(
	persistedTheme === "dark",
	`Theme did not persist after reload: ${persistedTheme}`,
);
console.log("Chrome light/dark/auto theme selection and persistence: PASS");

const copyControls = await browser.evaluate<number>(
	"document.querySelectorAll('#mm-copy-markdown, #mm-copy-code, .mm-code-copy').length",
);
assert(
	copyControls === 0,
	"Copy controls should be absent from this interface pass",
);

await navigate(browser.call, browser.evaluate, "/plain.txt");
const plainDetected = await browser.evaluate<boolean>(
	"Boolean(document.querySelector('#mm-root'))",
);
assert(plainDetected, "Markdown-shaped text/plain response was not detected");
console.log("Chrome text/plain Markdown detection: PASS");

await navigate(browser.call, browser.evaluate, "/ordinary.html");
const ordinaryPage = await browser.evaluate<{
	viewer: boolean;
	heading: string;
}>(`(() => ({
  viewer: Boolean(document.querySelector('#mm-root')),
  heading: document.querySelector('h1')?.textContent ?? '',
}))()`);
assert(
	!ordinaryPage.viewer && ordinaryPage.heading.includes("Ordinary HTML"),
	"Ordinary HTML page was replaced",
);
console.log("Chrome ordinary HTML preservation: PASS");

await navigate(browser.call, browser.evaluate, "/unsafe.md");
const unsafePage = await browser.evaluate<{
	viewer: boolean;
	scripts: number;
	handlers: number;
	javascriptLinks: number;
}>(`(() => ({
  viewer: Boolean(document.querySelector('#mm-root')),
  scripts: document.querySelectorAll('#mm-preview script').length,
  handlers: document.querySelectorAll('#mm-preview [onerror], #mm-preview [onclick]').length,
  javascriptLinks: Array.from(document.querySelectorAll<HTMLAnchorElement>('#mm-preview a')).filter((link) => link.href.startsWith('javascript:')).length,
}))()`);
assert(
	unsafePage.viewer &&
		unsafePage.scripts === 0 &&
		unsafePage.handlers === 0 &&
		unsafePage.javascriptLinks === 0,
	"Unsafe Markdown was not sanitized",
);
console.log("Chrome unsafe Markdown sanitization: PASS");

browser.close();
