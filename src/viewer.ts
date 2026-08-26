import chevronDownIcon from "@primer/octicons/build/svg/chevron-down-12.svg?raw";
import listUnorderedIcon from "@primer/octicons/build/svg/list-unordered-16.svg?raw";
import xIcon from "@primer/octicons/build/svg/x-16.svg?raw";
import {
	type FormattedMarkdown,
	type Heading,
	highlightSourceLine,
	prepareFormattedContent,
	renderMarkdown,
} from "./markdown";
import { extensionUrl, readPreference, writePreference } from "./platform";

type ViewMode = "preview" | "code" | "raw";
export type Theme = "light" | "dark" | "auto";

const THEME_KEY = "markdown-monroe-theme";

function isTheme(value: string): value is Theme {
	return value === "light" || value === "dark" || value === "auto";
}

function requiredElement<T extends Element>(
	root: ParentNode,
	selector: string,
): T {
	const element = root.querySelector<T>(selector);
	if (!element) throw new Error(`Viewer element not found: ${selector}`);
	return element;
}

function createShell(root: HTMLElement): void {
	root.innerHTML = `
    <div class="mm-viewer-frame">
      <header class="mm-toolbar" role="toolbar" aria-label="Markdown viewer controls">
        <div class="mm-toolbar-primary">
          <div class="mm-view-tabs" role="group" aria-label="View mode">
            <button type="button" class="mm-view-button mm-active" data-view="preview" aria-pressed="true">Preview</button>
            <button type="button" class="mm-view-button" data-view="code" aria-pressed="false">Code</button>
            <button type="button" class="mm-view-button" data-view="raw" aria-pressed="false">Raw</button>
          </div>
          <span id="mm-document-stats" class="mm-document-stats"></span>
        </div>
        <div class="mm-toolbar-actions">
          <button type="button" id="mm-toc-toggle" class="mm-toolbar-button" aria-label="Outline" aria-controls="mm-toc" aria-expanded="true">
            <span class="mm-icon" aria-hidden="true">${listUnorderedIcon}</span>
            <span>Outline</span>
          </button>
          <label class="mm-theme-control" for="mm-theme">
            <span>Theme</span>
            <select id="mm-theme" aria-label="Theme">
              <option value="auto">Auto</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </div>
      </header>
      <button type="button" id="mm-toc-backdrop" class="mm-toc-backdrop" aria-label="Close Outline" hidden></button>
      <main class="mm-layout">
        <section class="mm-reading" aria-label="Markdown document">
          <article id="mm-preview" class="mm-preview"></article>
          <div id="mm-code" class="mm-source mm-code-source" aria-label="Highlighted Markdown source" hidden></div>
          <pre id="mm-raw" class="mm-raw" aria-label="Raw Markdown source" hidden><code></code></pre>
        </section>
        <aside id="mm-toc" class="mm-toc" aria-label="Table of Contents">
          <div class="mm-toc-header">
            <div class="mm-toc-heading">Outline</div>
            <button type="button" id="mm-toc-close" class="mm-icon-button" aria-label="Close Outline">
              <span class="mm-icon" aria-hidden="true">${xIcon}</span>
            </button>
          </div>
          <nav aria-label="Document headings">
            <ol id="mm-toc-list"></ol>
          </nav>
        </aside>
      </main>
    </div>
  `;
}

function buildToc(list: HTMLOListElement, headings: Heading[]): void {
	list.replaceChildren();
	for (const heading of headings) {
		const item = document.createElement("li");
		item.style.setProperty(
			"--mm-heading-depth",
			String(Math.max(0, heading.depth - 1)),
		);
		const link = document.createElement("a");
		link.href = `#${heading.id}`;
		link.textContent = heading.text;
		item.append(link);
		list.append(item);
	}
}

function getSourceLines(raw: string): string[] {
	const normalized = raw.replace(/\r\n?/g, "\n");
	const lines = normalized.split("\n");
	if (normalized.endsWith("\n")) lines.pop();
	return lines.length > 0 ? lines : [""];
}

function formatDocumentStats(raw: string): string {
	const lines = getSourceLines(raw);
	const nonEmptyLines = lines.filter((line) => line.trim().length > 0).length;
	const bytes = new TextEncoder().encode(raw).byteLength;
	const size =
		bytes < 1024 ? `${bytes} Bytes` : `${(bytes / 1024).toFixed(2)} KB`;
	return `${lines.length} lines (${nonEmptyLines} loc) · ${size}`;
}

function isNarrowScreen(): boolean {
	return window.matchMedia?.("(max-width: 760px)").matches ?? false;
}

type CodeSection = {
	button: HTMLButtonElement;
	collapsed: boolean;
	end: number;
	start: number;
};

function buildCodeView(container: HTMLElement, raw: string): void {
	const lines = getSourceLines(raw);
	const rows: HTMLElement[] = [];
	const sections: CodeSection[] = [];
	let fenceLanguage: string | null = null;

	lines.forEach((line, index) => {
		const row = document.createElement("div");
		row.className = "mm-source-line";
		row.dataset.line = String(index + 1);

		const gutter = document.createElement("span");
		gutter.className = "mm-source-gutter";

		const heading =
			fenceLanguage === null ? /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line) : null;
		if (heading) {
			const toggle = document.createElement("button");
			toggle.type = "button";
			toggle.className = "mm-fold-toggle";
			toggle.setAttribute("aria-label", `Collapse ${heading[2]}`);
			toggle.setAttribute("aria-expanded", "true");
			toggle.innerHTML = chevronDownIcon;
			gutter.append(toggle);
			sections.push({
				button: toggle,
				collapsed: false,
				end: lines.length,
				start: index,
			});
			row.dataset.headingDepth = String(heading[1].length);
		}

		const number = document.createElement("span");
		number.className = "mm-line-number";
		number.textContent = String(index + 1);
		gutter.append(number);

		const code = document.createElement("code");
		code.className = "mm-source-code";

		const fence = /^\s*(`{3,}|~{3,})\s*([\w+-]+)?/.exec(line);
		code.innerHTML = highlightSourceLine(
			line || " ",
			fenceLanguage ?? "markdown",
		);
		if (fence) {
			fenceLanguage = fenceLanguage === null ? fence[2] || "plaintext" : null;
		}

		row.append(gutter, code);
		rows.push(row);
		container.append(row);
	});

	sections.forEach((section, sectionIndex) => {
		const depth = Number(rows[section.start]?.dataset.headingDepth ?? 6);
		const nextSection = sections.slice(sectionIndex + 1).find((candidate) => {
			const candidateDepth = Number(
				rows[candidate.start]?.dataset.headingDepth ?? 6,
			);
			return candidateDepth <= depth;
		});
		section.end = nextSection?.start ?? lines.length;
	});

	const renderCollapsedSections = () => {
		rows.forEach((row, index) => {
			row.hidden = sections.some(
				(section) =>
					section.collapsed && index > section.start && index < section.end,
			);
		});
		sections.forEach((section) => {
			section.button.classList.toggle("mm-collapsed", section.collapsed);
			section.button.setAttribute("aria-expanded", String(!section.collapsed));
			const headingText =
				rows[section.start]?.querySelector(".mm-source-code")?.textContent ??
				"section";
			section.button.setAttribute(
				"aria-label",
				`${section.collapsed ? "Expand" : "Collapse"} ${headingText.replace(/^#+\s*/, "")}`,
			);
		});
	};

	sections.forEach((section) => {
		section.button.addEventListener("click", () => {
			section.collapsed = !section.collapsed;
			renderCollapsedSections();
		});
	});
}

function setView(root: HTMLElement, mode: ViewMode, tocOpen: boolean): void {
	const preview = root.querySelector<HTMLElement>("#mm-preview");
	const code = root.querySelector<HTMLElement>("#mm-code");
	const raw = root.querySelector<HTMLElement>("#mm-raw");
	const toc = root.querySelector<HTMLElement>("#mm-toc");
	const tocToggle = root.querySelector<HTMLButtonElement>("#mm-toc-toggle");
	const tocBackdrop = root.querySelector<HTMLButtonElement>("#mm-toc-backdrop");
	if (!preview || !code || !raw || !toc || !tocToggle || !tocBackdrop) return;

	preview.hidden = mode !== "preview";
	code.hidden = mode !== "code";
	raw.hidden = mode !== "raw";
	const tocVisible = mode === "preview" && tocOpen && !tocToggle.disabled;
	toc.hidden = !tocVisible;
	tocBackdrop.hidden = !tocVisible;
	tocToggle.hidden = mode !== "preview";
	tocToggle.setAttribute("aria-expanded", String(tocVisible));
	root.classList.toggle("mm-no-toc", !tocVisible);
	root.dataset.view = mode;
	root
		.querySelectorAll<HTMLButtonElement>(".mm-view-button")
		.forEach((button) => {
			const active = button.dataset.view === mode;
			button.classList.toggle("mm-active", active);
			button.setAttribute("aria-pressed", String(active));
		});
}

function renderToc(root: HTMLElement, formatted: FormattedMarkdown): void {
	const tocList = root.querySelector<HTMLOListElement>("#mm-toc-list");
	const tocToggle = root.querySelector<HTMLButtonElement>("#mm-toc-toggle");
	if (!tocList || !tocToggle) return;

	buildToc(tocList, formatted.headings);
	tocToggle.disabled = formatted.headings.length === 0;
}

export async function createViewer(raw: string): Promise<void> {
	const themePreference = await readPreference<string>(THEME_KEY, "auto");
	const theme: Theme = isTheme(themePreference) ? themePreference : "auto";

	document.documentElement.dataset.markdownMonroe = "viewer";
	const head = document.createElement("head");
	const body = document.createElement("body");
	document.documentElement.replaceChildren(head, body);
	document.title = "Markdown Monroe";

	const stylesheet = document.createElement("link");
	stylesheet.rel = "stylesheet";
	stylesheet.href = extensionUrl("content.css");
	head.append(stylesheet);

	const root = document.createElement("div");
	root.id = "mm-root";
	root.dataset.theme = theme;
	root.dataset.view = "preview";
	createShell(root);
	body.append(root);

	const preview = requiredElement<HTMLElement>(root, "#mm-preview");
	const codeView = requiredElement<HTMLElement>(root, "#mm-code");
	const rawView = requiredElement<HTMLElement>(root, "#mm-raw code");
	const stats = requiredElement<HTMLElement>(root, "#mm-document-stats");
	const themeSelect = requiredElement<HTMLSelectElement>(root, "#mm-theme");
	let currentView: ViewMode = "preview";
	let tocOpen = true;

	themeSelect.value = theme;
	stats.textContent = formatDocumentStats(raw);
	preview.innerHTML = renderMarkdown(raw);
	buildCodeView(codeView, raw);
	rawView.textContent = raw;

	const previewDetails = prepareFormattedContent(preview);
	renderToc(root, previewDetails);
	tocOpen = previewDetails.headings.length > 0;
	setView(root, currentView, tocOpen);

	root
		.querySelectorAll<HTMLButtonElement>(".mm-view-button")
		.forEach((button) => {
			button.addEventListener("click", () => {
				const mode = button.dataset.view;
				if (mode !== "preview" && mode !== "code" && mode !== "raw") return;
				currentView = mode;
				setView(root, currentView, tocOpen);
			});
		});

	const closeToc = () => {
		tocOpen = false;
		setView(root, currentView, tocOpen);
	};

	root
		.querySelector<HTMLButtonElement>("#mm-toc-toggle")
		?.addEventListener("click", () => {
			tocOpen = !tocOpen;
			setView(root, currentView, tocOpen);
		});
	root
		.querySelector<HTMLButtonElement>("#mm-toc-close")
		?.addEventListener("click", closeToc);
	root
		.querySelector<HTMLButtonElement>("#mm-toc-backdrop")
		?.addEventListener("click", closeToc);
	root
		.querySelector<HTMLOListElement>("#mm-toc-list")
		?.addEventListener("click", (event) => {
			if (event.target instanceof HTMLAnchorElement && isNarrowScreen()) {
				closeToc();
			}
		});

	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape" && currentView === "preview" && tocOpen)
			closeToc();
	});

	themeSelect.addEventListener("change", async () => {
		const next = themeSelect.value;
		if (!isTheme(next)) return;
		root.dataset.theme = next;
		await writePreference(THEME_KEY, next);
	});
}
