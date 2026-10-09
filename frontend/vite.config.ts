import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Proxy to the backend so the session cookie is same-origin during development.
const target = "http://localhost:4000";
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": target, "/auth": target, "/admin": target } },
});
