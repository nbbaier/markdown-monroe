import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
	build: {
		outDir: "dist",
		emptyOutDir: true,
		target: "es2022",
		lib: {
			entry: resolve(projectRoot, "src/content.ts"),
			name: "markdownMonroe",
			formats: ["iife"],
			fileName: () => "content.js",
		},
		rollupOptions: {
			output: {
				assetFileNames: "content.[ext]",
			},
		},
	},
});
