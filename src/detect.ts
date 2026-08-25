export type MarkdownDocument = {
  raw: string;
  mimeType: string;
};

const MARKDOWN_MIME_TYPES = new Set([
  "application/markdown",
  "application/x-markdown",
  "text/markdown",
  "text/x-markdown",
]);

const TEXT_MIME_TYPES = new Set([
  "text/plain",
  "text/x-component",
  "application/octet-stream",
]);

function getMimeType(): string {
  return (document.contentType || "").split(";", 1)[0].trim().toLowerCase();
}

function isPlainTextDocument(): boolean {
  const body = document.body;
  return Boolean(
    body &&
      body.children.length === 1 &&
      body.firstElementChild?.tagName.toLowerCase() === "pre"
  );
}

function looksLikeMarkdown(raw: string): boolean {
  return [
    /^ {0,3}#{1,6}\s+\S/m,
    /^ {0,3}(```|~~~)/m,
    /^ {0,3}>\s?/m,
    /^\s*[-+*]\s+(?:\[[ xX]\]\s+)?\S/m,
    /^\s*\d+[.)]\s+\S/m,
    /\[[^\]]+\]\([^\s)]+\)/,
    /(?:^|\s)(?:\*\*|__)[^\n]+(?:\*\*|__)(?:\s|$)/,
    /(?:^|\s)~~[^\n]+~~(?:\s|$)/,
    /^\s*\|?.+\|.+\|?\s*$/m,
  ].some((pattern) => pattern.test(raw));
}

function getRawText(): string {
  return document.body?.textContent ?? "";
}

export function detectMarkdownDocument(): MarkdownDocument | null {
  if (!document.body || document.documentElement.dataset.markdownMonroe === "viewer") {
    return null;
  }

  const raw = getRawText();
  if (!raw.trim()) return null;

  const mimeType = getMimeType();
  const isMarkdownMime = MARKDOWN_MIME_TYPES.has(mimeType);
  const isTextMime = TEXT_MIME_TYPES.has(mimeType);

  if (isMarkdownMime) {
    return { raw, mimeType };
  }

  if (isTextMime && isPlainTextDocument() && looksLikeMarkdown(raw)) {
    return { raw, mimeType };
  }

  return null;
}
