import { observable, config } from "@observablehq/notebook-kit/vite";
import { defineConfig } from "vite";
import { debugNotebook } from "@rreusser/mcp-observable-notebookkit-debug";

export default defineConfig({
  ...config(),
  plugins: [debugNotebook(), observable()],
  root: "docs-src",
  build: {
    target: "esnext",
    outDir: "../docs",
    emptyOutDir: false,
  },
  optimizeDeps: {
    esbuildOptions: {
      target: "esnext",
    },
  },
});
