import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    server: {
      watch: {
        ignored: [
          "**/.git/**",
          "**/.astro/**",
          "**/.cache/**",
          "**/dist/**",
          "**/node_modules/**",
          "**/tmp/**",
          "**/data/**",
        ],
      },
    },
    resolve: {
      alias: {
        "@": path.join(rootDir, "src"),
      },
    },
  },
});
