import { observable, config } from "@observablehq/notebook-kit/vite";
import { defineConfig } from "vite";
import { debugNotebook } from "@rreusser/mcp-observable-notebookkit-debug";
import { cpSync, existsSync } from "fs";
import { resolve } from "path";

function copyStaticAssets() {
  return {
    name: "copy-static-assets",
    closeBundle() {
      const rootDir = resolve(import.meta.dirname, "..");
      const outDir = resolve(rootDir, "_site");

      // Copy images directory
      const imagesSource = resolve(rootDir, "docs/images");
      const imagesDest = resolve(outDir, "images");
      if (existsSync(imagesSource)) {
        cpSync(imagesSource, imagesDest, { recursive: true });
      }
    }
  };
}

export default defineConfig({
  ...config(),
  plugins: [debugNotebook(), observable(), copyStaticAssets()],
  root: "docs",
  build: {
    target: "esnext",
    outDir: "../_site",
    emptyOutDir: true,
  },
  optimizeDeps: {
    esbuildOptions: {
      target: "esnext",
    },
  },
});
