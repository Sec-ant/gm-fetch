import { defineConfig } from "vite";
import monkey, { cdn } from "vite-plugin-monkey";
import packageJson from "./package.json" with { type: "json" };

const { name } = packageJson;

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
      };
    case "monkey":
      return {
        build: {
          emptyOutDir: false,
        },
        plugins: [
          monkey({
            entry: "./src/userscript.ts",
            build: {
              fileName: `${SCRIPT_NAME}.user.js`,
              metaFileName: true,
            },
            userscript: {
              name: "GM Fetch",
              namespace: "https://github.com/Sec-ant",
              downloadURL: cdn.jsdelivrFastly(
                undefined,
                `dist/${SCRIPT_NAME}.user.js`,
              )[1]("latest", name),
              updateURL: cdn.jsdelivrFastly(
                undefined,
                `dist/${SCRIPT_NAME}.meta.js`,
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
