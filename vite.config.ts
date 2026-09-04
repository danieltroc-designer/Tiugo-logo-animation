import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves this repo from a subpath, so built asset URLs need that
// prefix. Dev keeps serving from the root.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === "build" ? "/Tiugo-logo-animation/" : "/",
}));
