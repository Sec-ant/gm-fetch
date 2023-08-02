import { defineConfig } from "vite";
import monkey from "vite-plugin-monkey";
import { name } from "./package.json";

const UMD_LIB_NAME = "gmFetch";

export default defineConfig(({ mode }) => {
  switch (mode) {
    case "es": {
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
    }
    case "umd": {
      return {
        build: {
          emptyOutDir: false,
          lib: {
            entry: {
              index: "./src/index.ts",
            },
            formats: ["umd"],
            name: UMD_LIB_NAME,
            fileName: (format, entryName) => `${entryName}.${format}.js`,
          },
        },
        resolve: {
          alias: {
            "vite-plugin-monkey/dist/client": "vite-plugin-monkey/dist/native",
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
            fileName: () => `${name.split("/").pop()}.user.js`,
          },
        },
        resolve: {
          alias: {
            "vite-plugin-monkey/dist/client": "vite-plugin-monkey/dist/native",
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
