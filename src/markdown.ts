import DOMPurify from "dompurify";
import hljs from "highlight.js/lib/common";
import { marked } from "marked";

export type Heading = {
	depth: number;
	id: string;
	text: string;
};

export type CodeBlock = {
	language: string;
	text: string;
};

export type FormattedMarkdown = {
	headings: Heading[];
	codeBlocks: CodeBlock[];
};

const SAFE_MARKDOWN_OPTIONS = {
	FORBID_TAGS: ["base", "embed", "form", "iframe", "object", "script", "style"],
};

export function renderMarkdown(raw: string): string {
	const parsed = marked.parse(raw, {
		async: false,
		breaks: false,
		gfm: true,
	}) as string;

	return DOMPurify.sanitize(parsed, SAFE_MARKDOWN_OPTIONS);
}

function slugify(text: string): string {
	const slug = text
		.toLocaleLowerCase()
		.trim()
		.replace(/[^\p{L}\p{N}]+/gu, "-")
		.replace(/^-+|-+$/g, "");
	return slug || "section";
}

function getLanguage(code: HTMLElement): string {
	const languageClass = Array.from(code.classList).find((name) =>
		name.startsWith("language-"),
	);
	return languageClass?.slice("language-".length) || "text";
}

function highlightCode(
	code: HTMLElement,
	text: string,
	language: string,
): void {
	const highlighted =
		language !== "text" && hljs.getLanguage(language)
			? hljs.highlight(text, { language }).value
			: hljs.highlightAuto(text).value;
	code.innerHTML = highlighted;
	code.classList.add("hljs");
}

function prepareCodeBlock(pre: HTMLPreElement, code: HTMLElement): CodeBlock {
	const text = code.textContent ?? "";
	const language = getLanguage(code);
	highlightCode(code, text, language);

	const wrapper = document.createElement("div");
	wrapper.className = "mm-code-block";
	pre.parentNode?.insertBefore(wrapper, pre);
	wrapper.append(pre);

	return { language, text };
}

export function highlightSourceLine(
	source: string,
	language = "markdown",
): string {
	const supportedLanguage = hljs.getLanguage(language) ? language : "plaintext";
	return hljs.highlight(source, {
		language: supportedLanguage,
		ignoreIllegals: true,
	}).value;
}

export function prepareFormattedContent(
	container: HTMLElement,
): FormattedMarkdown {
	const headings: Heading[] = [];
	const usedIds = new Map<string, number>();

	container
		.querySelectorAll<HTMLHeadingElement>("h1, h2, h3, h4, h5, h6")
		.forEach((heading) => {
			const text = heading.textContent?.trim() || "Section";
			const baseId = slugify(text);
			const count = usedIds.get(baseId) ?? 0;
			usedIds.set(baseId, count + 1);
			const id = count === 0 ? baseId : `${baseId}-${count + 1}`;
			heading.id = id;
			headings.push({ depth: Number(heading.tagName.slice(1)), id, text });
		});

	container.querySelectorAll<HTMLAnchorElement>("a").forEach((link) => {
		link.rel = "noopener noreferrer";
	});

	const codeBlocks: CodeBlock[] = [];
	container.querySelectorAll<HTMLPreElement>("pre").forEach((pre) => {
		const code = pre.querySelector<HTMLElement>(":scope > code");
		if (!code || !pre.parentNode) return;
		codeBlocks.push(prepareCodeBlock(pre, code));
	});

	return { headings, codeBlocks };
}
