import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In development, forward API calls to the Express server. The browser then sees one
    // origin, so there's no CORS setup and the httpOnly auth cookie works as-is.
    proxy: { "/graphql": "http://localhost:4000" },
  },
});
