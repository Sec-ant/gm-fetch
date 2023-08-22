import { defineConfig, Plugin } from "vite";
import monkey from "vite-plugin-monkey";
import { name } from "./package.json";
import replace from "@rollup/plugin-replace";

const LIB_NAME = "gmFetch";

export default defineConfig(({ mode }) => {
  switch (mode) {
    case "es":
      return {
        build: {
          emptyOutDir: false,
          lib: {
            entry: {
              index: "./src/index.ts",
            },
            formats: ["es"],
          },
        },
      };
    case "iife":
      return {
        build: {
          emptyOutDir: false,
          lib: {
            entry: {
              index: "./src/index.ts",
            },
            formats: ["iife"],
            name: LIB_NAME,
            fileName: (format, entryName) => `${entryName}.${format}.js`,
          },
        },
        resolve: {
          alias: {
            "vite-plugin-monkey/dist/client": "vite-plugin-monkey/dist/native",
          },
        },
      };
    case "monkey":
      return {
        build: {
          emptyOutDir: false,
          lib: {
            entry: "./src/index.ts",
            formats: ["umd"],
            name: LIB_NAME,
            // NOTE:
            // we have to use function to return the file name,
            // or the export won't be exposed in globalThis.
            fileName: () => `${name.split("/").pop()}.user.js`,
          },
        },
        resolve: {
          alias: {
            "vite-plugin-monkey/dist/client": "vite-plugin-monkey/dist/native",
          },
        },
        plugins: [
          replace({
            preventAssignment: true,
            values: {
              exports: JSON.stringify(undefined),
              define: JSON.stringify(undefined),
            },
          }) as Plugin,
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
      throw new Error(`Unknown mode: ${mode}`);
  }
});
