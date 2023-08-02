import { defineConfig } from "vite";
import monkey from "vite-plugin-monkey";
import { name } from "./package.json";

const UMD_LIB_NAME = "gmFetch";

export default defineConfig(({ mode }) => {
  switch (mode) {
    case "package": {
      return {
        build: {
          emptyOutDir: false,
          lib: {
            entry: {
              index: "./src/index.ts",
            },
            formats: ["es", "umd"],
            name: UMD_LIB_NAME,
            fileName: (format, entryName) =>
              `${entryName}${format === "es" ? "" : `.${format}`}.js`,
          },
        },
      };
    }
    case "monkey":
      return {
        build: {
          emptyOutDir: false,
          lib: {
            entry: "./src/index.ts",
            formats: ["umd"],
            name: UMD_LIB_NAME,
            // NOTE:
            // we have to use function to return the file name,
            // or the export won't be exposed in globalThis.
            // this seems to be a vite-plugin-monkey bug.
            fileName: () => `${name.split("/").pop()}.user.js`,
          },
        },
        plugins: [
          monkey({
            entry: "./src/index.ts",
            build: {
              fileName: `${name.split("/").pop()}.user.js`,
            },
            userscript: {
              name: "GM Fetch",
              namespace: "https://github.com/Sec-ant/gm-fetch",
              match: "*://*/*",
              grant: "GM_xmlhttpRequest",
            },
          }),
        ],
      };
    default:
      throw new Error("Unknown mode.");
  }
});
