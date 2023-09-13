import { defineConfig, Plugin } from "vite";
import monkey, { cdn } from "vite-plugin-monkey";
import replace from "@rollup/plugin-replace";
import { name } from "./package.json";

const LIB_NAME = "gmFetch";
const SCRIPT_NAME = name.split("/").pop();

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
            fileName: () => `${SCRIPT_NAME}.user.js`,
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
              fileName: `${SCRIPT_NAME}.user.js`,
              metaFileName: true,
            },
            userscript: {
              name: "GM Fetch",
              namespace: "https://github.com/Sec-ant",
              downloadURL: cdn.npmmirror(
                undefined,
                `dist/${SCRIPT_NAME}.user.js`
              )[1]("latest", name),
              updateURL: cdn.npmmirror(
                undefined,
                `dist/${SCRIPT_NAME}.meta.js`
              )[1]("latest", name),
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
