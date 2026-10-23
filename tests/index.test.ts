import type {
  GmResponseEvent,
  GmXmlhttpRequestOption,
} from "vite-plugin-monkey/dist/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import gmFetch from "../src";

type Options = GmXmlhttpRequestOption<"blob" | "stream">;
type Event = GmResponseEvent<"blob" | "stream">;
const url = new URL("/resource", location.href).href;
let options: Options;
const abort = vi.fn(() => options.onabort?.());
const gmXhr = vi.fn((details: Options) => {
  options = details;
  return { abort };
});

function event(overrides: Partial<Event> = {}): Event {
  return {
    readyState: 4,
    status: 200,
    statusText: "OK",
    finalUrl: url,
    responseHeaders: "Content-Type: text/plain\r\n",
    response: new Blob(["hello"]),
    responseText: "",
    responseXML: null,
    context: undefined,
    ...overrides,
  };
}

function networkError(details = options) {
  const response = { ...event(), error: "failed", statusText: "" };
  details.onerror?.call(response, response);
}

function load(response = event()) {
  options.onreadystatechange?.call(response, response);
  options.onload?.call(response, response);
}

beforeEach(() => {
  gmXhr.mockClear();
  abort.mockClear();
  vi.stubGlobal("GM_xmlhttpRequest", gmXhr);
  vi.stubGlobal("GM", undefined);
  vi.stubGlobal("GM_info", undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("responses", () => {
  it("reads a buffered response and parses folded headers", async () => {
    const pending = gmFetch(url);
    load(event({ responseHeaders: "X-Value: one\r\n\ttwo:three\r\n" }));
    const response = await pending;
    expect(response.status).toBe(200);
    expect(response.headers.get("x-value")).toBe("one two:three");
    expect(await response.text()).toBe("hello");
  });

  it.each([204, 205, 304])(
    "returns a null body for status %i",
    async (status) => {
      const pending = gmFetch(url);
      load(event({ status, response: new Blob([]) }));
      const response = await pending;
      expect(response.status).toBe(status);
      expect(response.body).toBeNull();
      expect(await response.text()).toBe("");
    },
  );

  it("returns a null body for HEAD", async () => {
    const pending = gmFetch(url, { method: "HEAD" });
    load();
    expect((await pending).body).toBeNull();
  });

  it("resolves HTTP errors", async () => {
    const pending = gmFetch(url);
    load(event({ status: 404, statusText: "Not Found" }));
    const response = await pending;
    expect(response.ok).toBe(false);
    expect(await response.text()).toBe("hello");
  });

  it("preserves metadata and cookie headers through repeated clones", async () => {
    const pending = gmFetch(url);
    const finalUrl = new URL("/redirected", url).href;
    load(
      event({
        finalUrl,
        responseHeaders: "Set-Cookie: id=1\r\nX-Test: original",
      }),
    );
    const response = await pending;
    response.headers.set("x-test", "changed");
    const clone = response.clone().clone();
    expect(clone.url).toBe(finalUrl);
    expect(clone.redirected).toBe(true);
    expect(clone.type).toBe("basic");
    expect(clone.headers.get("set-cookie")).toBe("id=1");
    expect(clone.headers.get("x-test")).toBe("changed");
    expect(await clone.text()).toBe("hello");
    expect(await response.text()).toBe("hello");
    expect(() => response.clone()).toThrow(TypeError);
  });

  it("strips manager transport fragments from response URLs", async () => {
    const pending = gmFetch(url);
    load(event({ finalUrl: `${url}#VMxhrTransport` }));
    const response = await pending;
    expect(response.url).toBe(url);
    expect(response.redirected).toBe(false);
    expect(response.clone().url).toBe(url);
    await response.text();
  });

  it("ignores the request fragment when detecting redirects", async () => {
    const pending = gmFetch(`${url}#fragment`);
    load();
    expect((await pending).redirected).toBe(false);
  });
});

describe("GM adapters and failures", () => {
  it("rejects missing grants", async () => {
    vi.stubGlobal("GM_xmlhttpRequest", undefined);
    await expect(gmFetch(url)).rejects.toMatchObject({ name: "NotFoundError" });
  });

  it("supports GM.xmlHttpRequest and a callback API without a handle", async () => {
    vi.stubGlobal("GM_xmlhttpRequest", undefined);
    vi.stubGlobal("GM", {
      xmlHttpRequest(details: Options) {
        options = details;
      },
    });
    const pending = gmFetch(url);
    load();
    expect(await (await pending).text()).toBe("hello");
  });

  it("supports promise-only GM APIs and keeps their receiver", async () => {
    const manager = {
      xmlHttpRequest() {
        expect(this).toBe(manager);
        return Promise.resolve(event());
      },
    };
    vi.stubGlobal("GM_xmlhttpRequest", undefined);
    vi.stubGlobal("GM", manager);
    expect(await (await gmFetch(url)).text()).toBe("hello");
  });

  it("accepts responseURL from promise-only managers", async () => {
    const finalUrl = new URL("/redirected", url).href;
    vi.stubGlobal("GM_xmlhttpRequest", undefined);
    vi.stubGlobal("GM", {
      xmlHttpRequest: () =>
        Promise.resolve({
          ...event(),
          finalUrl: undefined,
          responseURL: finalUrl,
        }),
    });
    const response = await gmFetch(url);
    expect(response.url).toBe(finalUrl);
    expect(response.redirected).toBe(true);
    await response.text();
  });

  it("propagates synchronous GM failures", async () => {
    const error = new Error("GM failed");
    vi.stubGlobal("GM_xmlhttpRequest", () => {
      throw error;
    });
    await expect(gmFetch(url)).rejects.toBe(error);
  });

  it("preserves the modern GM streaming capability when binding its receiver", async () => {
    const manager = {
      xmlHttpRequest: Object.assign(
        function (this: unknown, details: Options) {
          expect(this).toBe(manager);
          options = details;
          return { abort };
        },
        { RESPONSE_TYPE_STREAM: "stream" },
      ),
    };
    vi.stubGlobal("GM_xmlhttpRequest", undefined);
    vi.stubGlobal("GM", manager);
    const pending = gmFetch(url);
    expect(options.responseType).toBe("stream");
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });
    const response = event({ readyState: 2, response: stream });
    options.onloadstart?.call(response, response);
    expect(await (await pending).text()).toBe("");
  });

  it("supports an asynchronously returned abort handle", async () => {
    vi.stubGlobal("GM_xmlhttpRequest", (details: Options) => {
      options = details;
      return Promise.resolve({ abort });
    });
    const controller = new AbortController();
    const pending = gmFetch(url, { signal: controller.signal });
    await Promise.resolve();
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(abort).toHaveBeenCalledOnce();
  });

  it("handles a rejected GM promise", async () => {
    const error = new TypeError("GM rejected");
    vi.stubGlobal("GM_xmlhttpRequest", () => Promise.reject(error));
    await expect(gmFetch(url)).rejects.toBe(error);
  });

  it("handles promise rejection alongside an error callback", async () => {
    vi.stubGlobal("GM_xmlhttpRequest", (details: Options) => {
      queueMicrotask(() => networkError(details));
      return Promise.reject(new TypeError("failed"));
    });
    await expect(gmFetch(url)).rejects.toThrow("failed");
  });

  it("rejects response construction failures", async () => {
    const pending = gmFetch(url);
    load(event({ status: 0 }));
    await expect(pending).rejects.toBeInstanceOf(RangeError);
    expect(abort).toHaveBeenCalledOnce();
  });

  it.each(["error", "timeout", "abort"] as const)(
    "rejects transport %s",
    async (type) => {
      const pending = gmFetch(url);
      if (type === "error") networkError();
      if (type === "timeout") options.ontimeout?.();
      if (type === "abort") options.onabort?.();
      await expect(pending).rejects.toMatchObject({
        name: type === "abort" ? "AbortError" : "TypeError",
      });
    },
  );
});

describe("requests and cancellation", () => {
  it.each([
    ["same-origin", false, false],
    ["same-origin", true, true],
    ["include", false, false],
    ["include", true, false],
    ["omit", false, true],
    ["omit", true, true],
  ] as const)(
    "maps credentials=%s with crossOrigin=%s",
    async (credentials, crossOrigin, anonymous) => {
      const target = crossOrigin ? "https://remote.example/resource" : url;
      const pending = gmFetch(target, { credentials });
      expect(options.anonymous).toBe(anonymous);
      load(event({ finalUrl: target }));
      await (await pending).text();
    },
  );

  it("buffers Unicode uploads and preserves request options", async () => {
    const pending = gmFetch(url, {
      method: "POST",
      body: "你好",
      headers: { "X-Test": "value", "User-Agent": "gm-fetch" },
      cache: "no-store",
      redirect: "error",
    });
    await vi.waitFor(() => expect(gmXhr).toHaveBeenCalledOnce());
    expect(options.method).toBe("POST");
    expect(options.binary).toBeUndefined();
    expect(options.nocache).toBe(true);
    expect(options.redirect).toBe("error");
    expect(options.headers).toMatchObject({
      "x-test": "value",
      "user-agent": "gm-fetch",
    });
    expect(await (options.data as Blob).text()).toBe("你好");
    load();
    await (await pending).text();
  });

  it("reuses buffered Blob uploads while keeping cancellation active", async () => {
    const body = new Blob(["你好"], { type: "text/plain" });
    const controller = new AbortController();
    const pending = gmFetch(url, {
      method: "POST",
      body,
      signal: controller.signal,
    });
    expect(options.data).toBe(body);
    expect(options.headers?.["content-type"]).toBe("text/plain");
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(abort).toHaveBeenCalledOnce();
  });

  it("serializes Greasemonkey uploads as binary strings", async () => {
    vi.stubGlobal("GM_info", { scriptHandler: "Greasemonkey" });
    const bytes = new Uint8Array([
      0,
      127,
      128,
      255,
      ...new TextEncoder().encode("你好"),
    ]);
    const pending = gmFetch(url, { method: "POST", body: bytes });
    await vi.waitFor(() => expect(gmXhr).toHaveBeenCalledOnce());
    expect(options.binary).toBe(true);
    expect(typeof options.data).toBe("string");
    const encoded = options.data as string;
    expect(Uint8Array.from(encoded, (value) => value.charCodeAt(0))).toEqual(
      bytes,
    );
    load();
    await (await pending).text();
  });

  it("suppresses automatic Greasemonkey cookies for anonymous requests", async () => {
    vi.stubGlobal("GM_info", { scriptHandler: "Greasemonkey" });
    const pending = gmFetch(url, { credentials: "omit" });
    expect(options.headers?.cookie).toBe("");
    load();
    await (await pending).text();
  });

  it("preserves a pre-aborted signal's reason", async () => {
    const reason = new Error("stop");
    await expect(
      gmFetch(url, { signal: AbortSignal.abort(reason) }),
    ).rejects.toBe(reason);
    expect(gmXhr).not.toHaveBeenCalled();
  });

  it("cancels body buffering before starting the GM request", async () => {
    const controller = new AbortController();
    const cancel = vi.fn();
    const body = new ReadableStream({ cancel });
    const NativeRequest = Request;
    vi.stubGlobal(
      "Request",
      class extends NativeRequest {
        get body() {
          return body;
        }
      },
    );
    const pending = gmFetch(url, {
      method: "POST",
      body: "pending",
      signal: controller.signal,
    });
    const rejected = expect(pending).rejects.toMatchObject({
      name: "AbortError",
    });
    controller.abort();
    await rejected;
    expect(cancel).toHaveBeenCalledOnce();
    expect(gmXhr).not.toHaveBeenCalled();
  });

  it("aborts an active request and removes its signal listener", async () => {
    const controller = new AbortController();
    const reason = new Error("stop");
    const pending = gmFetch(url, { signal: controller.signal });
    controller.abort(reason);
    await expect(pending).rejects.toBe(reason);
    expect(abort).toHaveBeenCalledOnce();
    load();
  });

  it("handles cancellation inside GM startup", async () => {
    const controller = new AbortController();
    vi.stubGlobal("GM_xmlhttpRequest", (details: Options) => {
      options = details;
      controller.abort();
      return { abort };
    });
    await expect(
      gmFetch(url, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(abort).toHaveBeenCalledOnce();
  });

  it("keeps buffered response consumption abortable", async () => {
    const controller = new AbortController();
    const pending = gmFetch(url, { signal: controller.signal });
    load();
    const response = await pending;
    controller.abort();
    await expect(response.body?.getReader().read()).rejects.toMatchObject({
      name: "AbortError",
    });
  });

  it("preserves cancellation from an input Request", async () => {
    const controller = new AbortController();
    const pending = gmFetch(new Request(url, { signal: controller.signal }));
    load();
    const response = await pending;
    controller.abort();
    await expect(response.body?.getReader().read()).rejects.toMatchObject({
      name: "AbortError",
    });
  });

  it("cleans up after consuming the response", async () => {
    const controller = new AbortController();
    const pending = gmFetch(url, { signal: controller.signal });
    load();
    await (await pending).text();
    controller.abort();
    expect(abort).not.toHaveBeenCalled();
  });
});

describe("streaming", () => {
  function start(signal?: AbortSignal) {
    let source!: ReadableStreamDefaultController<Uint8Array>;
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        source = controller;
      },
      cancel,
    });
    vi.stubGlobal(
      "GM_xmlhttpRequest",
      Object.assign((details: Options) => gmXhr(details), {
        RESPONSE_TYPE_STREAM: "stream",
      }),
    );
    const pending = gmFetch(url, { signal });
    expect(options.responseType).toBe("stream");
    const response = event({ readyState: 2, response: stream });
    options.onloadstart?.call(response, response);
    return { pending, source, stream, cancel };
  }

  it("reads chunks before the transport completes", async () => {
    const { pending, source } = start();
    const response = await pending;
    const reader = response.body?.getReader();
    source.enqueue(new TextEncoder().encode("first"));
    expect(new TextDecoder().decode((await reader?.read())?.value)).toBe(
      "first",
    );
    source.enqueue(new TextEncoder().encode("second"));
    source.close();
    expect(new TextDecoder().decode((await reader?.read())?.value)).toBe(
      "second",
    );
    expect((await reader?.read())?.done).toBe(true);
  });

  it.each(["error", "timeout", "abort"] as const)(
    "errors the response body on %s",
    async (type) => {
      const controller = new AbortController();
      const { pending, stream, cancel } = start(controller.signal);
      const response = await pending;
      const loaded = event({ response: stream });
      options.onload?.call(loaded, loaded);
      const reading = response.body?.getReader().read();
      if (type === "error") networkError();
      if (type === "timeout") options.ontimeout?.();
      if (type === "abort") controller.abort();
      await expect(reading).rejects.toMatchObject({
        name: type === "abort" ? "AbortError" : "TypeError",
      });
      expect(cancel).toHaveBeenCalledOnce();
    },
  );

  it("cancels the source and transport when the response body is cancelled", async () => {
    const { pending, cancel } = start();
    const response = await pending;
    await response.body?.cancel("stop reading");
    expect(abort).toHaveBeenCalledOnce();
    expect(cancel.mock.calls[0]?.[0]).toBe("stop reading");
  });

  it("fulfills reads when the wrapper has a zero high-water mark", async () => {
    const NativeReadableStream = ReadableStream;
    vi.stubGlobal(
      "ReadableStream",
      class<T> extends NativeReadableStream<T> {
        constructor(
          source?: UnderlyingSource<T>,
          strategy?: QueuingStrategy<T>,
        ) {
          super(source, { highWaterMark: 0, ...strategy });
        }
      },
    );
    const { pending, source } = start();
    const reading = pending.then((response) => response.text());
    source.enqueue(new TextEncoder().encode("zero buffer"));
    source.close();
    expect(await reading).toBe("zero buffer");
  });

  it("keeps buffering bounded when a consumer pauses", async () => {
    let produced = 0;
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array([produced++]));
      },
      cancel,
    });
    vi.stubGlobal(
      "GM_xmlhttpRequest",
      Object.assign((details: Options) => gmXhr(details), {
        RESPONSE_TYPE_STREAM: "stream",
      }),
    );
    const pending = gmFetch(url);
    const loaded = event({ readyState: 2, response: stream });
    options.onloadstart?.call(loaded, loaded);
    const response = await pending;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(produced).toBeLessThanOrEqual(3);
    const reader = response.body?.getReader();
    expect((await reader?.read())?.value).toEqual(new Uint8Array([0]));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(produced).toBeLessThanOrEqual(4);
    await reader?.cancel("paused");
    expect(cancel).toHaveBeenCalledOnce();
    expect(abort).toHaveBeenCalledOnce();
  });

  it("propagates source stream failures", async () => {
    const { pending, source } = start();
    const response = await pending;
    const error = new TypeError("stream failed");
    source.error(error);
    await expect(response.body?.getReader().read()).rejects.toBe(error);
  });
});
