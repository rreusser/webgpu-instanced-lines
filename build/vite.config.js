import { observable, config } from "@observablehq/notebook-kit/vite";
import { defineConfig } from "vite";
import { debugNotebook } from "@rreusser/mcp-observable-notebookkit-debug";
import { copyFileSync, cpSync, existsSync, mkdirSync } from "fs";
import { resolve } from "path";

function copyStaticAssets() {
  return {
    name: "copy-static-assets",
    closeBundle() {
      const rootDir = resolve(import.meta.dirname, "..");
      const outDir = resolve(rootDir, "docs");

      // Copy images directory
      const imagesSource = resolve(rootDir, "docs-src/images");
      const imagesDest = resolve(outDir, "images");
      if (existsSync(imagesSource)) {
        cpSync(imagesSource, imagesDest, { recursive: true });
      }

      // Copy API.md
      const apiSource = resolve(rootDir, "docs-src/API.md");
      const apiDest = resolve(outDir, "API.md");
      if (existsSync(apiSource)) {
        copyFileSync(apiSource, apiDest);
      }
    }
  };
}

export default defineConfig({
  ...config(),
  plugins: [debugNotebook(), observable(), copyStaticAssets()],
  root: "docs-src",
  build: {
    target: "esnext",
    outDir: "../docs",
    emptyOutDir: true,
  },
  optimizeDeps: {
    esbuildOptions: {
      target: "esnext",
    },
  },
});
