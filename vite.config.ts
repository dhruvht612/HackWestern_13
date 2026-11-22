import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  // Pre-bundle deps that are only imported by later routes (graph, uploads). Otherwise Vite
  // discovers them on first visit, re-optimizes, and the open tab loads stale chunks (504s, blank page).
  optimizeDeps: {
    include: ["@xyflow/react", "react-dropzone", "@tanstack/react-query", "react-router-dom", "lucide-react"],
  },
  server: {
    fs: {
      allow: [path.resolve(import.meta.dirname, "."), path.resolve(import.meta.dirname, "./shared")],
    },
  },
});

