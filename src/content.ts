import "./styles/viewer.css";
import { detectMarkdownDocument } from "./detect";
import { createViewer } from "./viewer";

async function init(): Promise<void> {
  const markdown = detectMarkdownDocument();
  if (!markdown) return;
  await createViewer(markdown.raw);
}

void init();
