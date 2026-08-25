import { extensionUrl, readPreference, writePreference } from "./platform";
import {
  prepareFormattedContent,
  renderMarkdown,
  type FormattedMarkdown,
  type Heading,
} from "./markdown";

type ViewMode = "formatted" | "raw";
export type Theme = "light" | "dark" | "auto";

const THEME_KEY = "markdown-monroe-theme";

function isTheme(value: string): value is Theme {
  return value === "light" || value === "dark" || value === "auto";
}

function createShell(root: HTMLElement): void {
  root.innerHTML = `
    <header class="mm-toolbar">
      <div class="mm-brand">
        <strong>Markdown Monroe</strong>
        <span>Markdown response</span>
      </div>
      <div class="mm-toolbar-controls" role="toolbar" aria-label="Markdown viewer controls">
        <div class="mm-control-group" role="group" aria-label="View mode">
          <span class="mm-control-label">View</span>
          <button type="button" class="mm-view-button mm-active" data-view="formatted" aria-pressed="true">Formatted</button>
          <button type="button" class="mm-view-button" data-view="raw" aria-pressed="false">Raw</button>
        </div>
        <button type="button" id="mm-toc-toggle" aria-controls="mm-toc" aria-expanded="true">TOC</button>
        <button type="button" id="mm-copy-markdown">Copy Markdown</button>
        <button type="button" id="mm-copy-code">Copy code blocks</button>
        <label class="mm-theme-control" for="mm-theme">
          <span class="mm-control-label">Theme</span>
          <select id="mm-theme" aria-label="Theme">
            <option value="auto">Auto</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </div>
      <div id="mm-status" class="mm-status" role="status" aria-live="polite"></div>
    </header>
    <main class="mm-layout">
      <aside id="mm-toc" class="mm-toc" aria-label="Table of Contents">
        <div class="mm-toc-heading">Contents</div>
        <nav aria-label="Document headings">
          <ol id="mm-toc-list"></ol>
        </nav>
      </aside>
      <section class="mm-reading" aria-label="Markdown document">
        <article id="mm-formatted" class="mm-formatted"></article>
        <pre id="mm-raw" class="mm-raw" hidden><code></code></pre>
      </section>
    </main>
  `;
}

function buildToc(list: HTMLOListElement, headings: Heading[]): void {
  list.replaceChildren();
  for (const heading of headings) {
    const item = document.createElement("li");
    item.style.setProperty("--mm-heading-depth", String(Math.max(0, heading.depth - 1)));
    const link = document.createElement("a");
    link.href = `#${heading.id}`;
    link.textContent = heading.text;
    item.append(link);
    list.append(item);
  }
}

function setView(root: HTMLElement, mode: ViewMode): void {
  const formatted = root.querySelector<HTMLElement>("#mm-formatted");
  const raw = root.querySelector<HTMLElement>("#mm-raw");
  if (!formatted || !raw) return;

  formatted.hidden = mode !== "formatted";
  raw.hidden = mode !== "raw";
  root.querySelectorAll<HTMLButtonElement>(".mm-view-button").forEach((button) => {
    const active = button.dataset.view === mode;
    button.classList.toggle("mm-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the textarea fallback for pages without clipboard permission.
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  try {
    document.body.append(textarea);
    textarea.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

function setStatus(status: HTMLElement, message: string): void {
  status.textContent = message;
  window.setTimeout(() => {
    if (status.textContent === message) status.textContent = "";
  }, 2200);
}

function renderToc(root: HTMLElement, formatted: FormattedMarkdown): void {
  const toc = root.querySelector<HTMLElement>("#mm-toc");
  const tocList = root.querySelector<HTMLOListElement>("#mm-toc-list");
  const tocToggle = root.querySelector<HTMLButtonElement>("#mm-toc-toggle");
  if (!toc || !tocList || !tocToggle) return;

  buildToc(tocList, formatted.headings);
  tocToggle.disabled = formatted.headings.length === 0;
  if (formatted.headings.length === 0) {
    toc.hidden = true;
    tocToggle.setAttribute("aria-expanded", "false");
  }
  root.classList.toggle("mm-no-toc", toc.hidden);
}

export async function createViewer(raw: string): Promise<void> {
  const themePreference = await readPreference<string>(THEME_KEY, "auto");
  const theme: Theme = isTheme(themePreference) ? themePreference : "auto";

  document.documentElement.dataset.markdownMonroe = "viewer";
  document.documentElement.replaceChildren(document.createElement("head"), document.createElement("body"));
  const head = document.documentElement.querySelector("head")!;
  const body = document.documentElement.querySelector("body")!;
  document.title = "Markdown Monroe";

  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = extensionUrl("content.css");
  head.append(stylesheet);

  const root = document.createElement("div");
  root.id = "mm-root";
  root.dataset.theme = theme;
  createShell(root);
  body.append(root);

  const formatted = root.querySelector<HTMLElement>("#mm-formatted")!;
  const rawView = root.querySelector<HTMLElement>("#mm-raw code")!;
  const status = root.querySelector<HTMLElement>("#mm-status")!;
  const themeSelect = root.querySelector<HTMLSelectElement>("#mm-theme")!;
  themeSelect.value = theme;
  formatted.innerHTML = renderMarkdown(raw);
  rawView.textContent = raw;

  const formattedDetails = prepareFormattedContent(formatted);
  renderToc(root, formattedDetails);

  root.querySelectorAll<HTMLButtonElement>(".mm-view-button").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.view;
      if (mode === "formatted" || mode === "raw") setView(root, mode);
    });
  });

  root.querySelector<HTMLButtonElement>("#mm-toc-toggle")!.addEventListener("click", () => {
    const toc = root.querySelector<HTMLElement>("#mm-toc")!;
    const toggle = root.querySelector<HTMLButtonElement>("#mm-toc-toggle")!;
    const visible = !toc.hidden;
    toc.hidden = visible;
    toggle.setAttribute("aria-expanded", String(!visible));
    root.classList.toggle("mm-no-toc", toc.hidden);
  });

  root.querySelector<HTMLButtonElement>("#mm-copy-markdown")!.addEventListener("click", async () => {
    setStatus(status, (await copyText(raw)) ? "Markdown copied" : "Could not copy Markdown");
  });

  const copyCodeButton = root.querySelector<HTMLButtonElement>("#mm-copy-code")!;
  copyCodeButton.disabled = formattedDetails.codeBlocks.length === 0;
  copyCodeButton.addEventListener("click", async () => {
    const code = formattedDetails.codeBlocks.map((block) => block.text).join("\n\n");
    setStatus(status, (await copyText(code)) ? "Code blocks copied" : "Could not copy code blocks");
  });

  formatted.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement) || !target.classList.contains("mm-code-copy")) return;
    const block = target.closest<HTMLElement>(".mm-code-block");
    if (!block) return;
    const copied = await copyText(block.dataset.code ?? "");
    const original = target.textContent;
    target.textContent = copied ? "Copied" : "Retry";
    setStatus(status, copied ? "Code block copied" : "Could not copy code block");
    window.setTimeout(() => {
      target.textContent = original;
    }, 1600);
  });

  themeSelect.addEventListener("change", async () => {
    const next = themeSelect.value;
    if (!isTheme(next)) return;
    root.dataset.theme = next;
    await writePreference(THEME_KEY, next);
    setStatus(status, `Theme set to ${next}`);
  });
}
