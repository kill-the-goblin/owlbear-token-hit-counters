import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  server: { cors: true, port: 11209, strictPort: true },
  build: {
    rollupOptions: {
      input: {
        background: resolve(import.meta.dirname, "background.html"),
        menu: resolve(import.meta.dirname, "menu.html"),
      },
    },
  },
});
