import { defineConfig } from "vite";
import * as path from "path";

import dts from "vite-plugin-dts";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    emptyOutDir: true,

    lib: {
      entry: path.resolve(__dirname, "./src/index.ts"),
      name: "WebIME",
      fileName: (format) => `webime.${format}.js`,
    },
    minify: "terser",
  },
  plugins: [dts()],
});
