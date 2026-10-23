import { expect, it } from "vitest";
import userscript from "../dist/gm-fetch.user.js?raw";
import iife from "../dist/index.iife.js?raw";

it.each([
  ["IIFE", false, iife],
  ["IIFE", true, iife],
  ["userscript", false, userscript],
  ["userscript", true, userscript],
] as const)(
  "runs the %s bundle with modernGM=%s",
  async (_format, modern, code) => {
    const iframe = document.createElement("iframe");
    document.body.append(iframe);
    try {
      const scope = iframe.contentWindow as Window &
        typeof globalThis & {
          gmFetch: typeof fetch;
        };
      const request = (details: {
        url: string;
        onload: (response: object) => void;
      }) => {
        queueMicrotask(() =>
          details.onload({
            status: 200,
            statusText: "OK",
            finalUrl: details.url,
            responseHeaders: "",
            response: new Blob(["bundle"]),
          }),
        );
        return { abort() {} };
      };
      Object.assign(
        scope,
        modern
          ? { GM: { xmlHttpRequest: request } }
          : { GM_xmlhttpRequest: request },
      );
      const script = scope.document.createElement("script");
      script.textContent = code;
      scope.document.head.append(script);
      expect(typeof scope.gmFetch).toBe("function");
      expect(code).not.toContain("__MONKEY_WINDOW_KEY__");
      const response = await scope.gmFetch(location.href);
      expect(await response.text()).toBe("bundle");
    } finally {
      iframe.remove();
    }
  },
);
