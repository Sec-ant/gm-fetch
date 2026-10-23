import type {
  GmAbortHandle,
  GmContextType,
  GmResponseEvent,
  GmType,
  GmXmlhttpRequestOption,
} from "vite-plugin-monkey/dist/client";

type GmResponse = GmResponseEvent<"blob" | "stream"> & {
  responseURL?: string;
};
type GmOptions = GmXmlhttpRequestOption<"blob" | "stream"> & {
  withCredentials?: boolean;
};
type GmXhr = {
  (
    options: GmOptions,
  ):
    | GmAbortHandle
    | (Promise<GmResponse | GmAbortHandle | undefined> & Partial<GmAbortHandle>)
    | undefined;
  RESPONSE_TYPE_STREAM?: "stream";
};

declare const GM: GmType | undefined;
declare const GM_info: GmContextType["GM_info"] | undefined;
declare const GM_xmlhttpRequest: GmContextType["GM_xmlhttpRequest"] | undefined;

function getGmXhr(): GmXhr | undefined {
  if (typeof GM_xmlhttpRequest === "function") {
    return GM_xmlhttpRequest;
  }
  if (typeof GM !== "undefined" && typeof GM.xmlHttpRequest === "function") {
    return Object.assign(GM.xmlHttpRequest.bind(GM), {
      RESPONSE_TYPE_STREAM: GM.xmlHttpRequest.RESPONSE_TYPE_STREAM,
    });
  }
  return undefined;
}

function parseHeaders(rawHeaders: string) {
  const headers = new Headers();
  // Unfold obsolete line folding before parsing each header.
  const preProcessedHeaders = rawHeaders.replace(/\r?\n[\t ]+/g, " ");
  for (const line of preProcessedHeaders.split(/\r?\n/)) {
    const parts = line.split(":");
    const key = parts.shift()?.trim();
    if (key) {
      const value = parts.join(":").trim();
      try {
        headers.append(key, value);
      } catch (error) {
        console.warn(`Response ${(error as Error).message}`);
      }
    }
  }
  return headers;
}

function setResponseMetadata(
  response: Response,
  url: string,
  redirected: boolean,
  headers: Headers,
): Response {
  const clone = response.clone.bind(response);
  Object.defineProperties(response, {
    url: { value: url },
    type: { value: "basic" },
    redirected: { value: redirected },
    clone: {
      value: () =>
        setResponseMetadata(
          clone(),
          url,
          redirected,
          new Headers(response.headers),
        ),
    },
    ...(headers.has("set-cookie") || headers.has("set-cookie2")
      ? { headers: { value: headers } }
      : {}),
  });
  return response;
}

const gmFetch: typeof fetch = async (input, init) => {
  const gmXhr = getGmXhr();
  if (!gmXhr) {
    throw new DOMException(
      "GM_xmlhttpRequest or GM.xmlHttpRequest is not granted.",
      "NotFoundError",
    );
  }
  const request = new Request(input, init);
  const { signal } = request;
  const hasSignal =
    init?.signal != null ||
    (typeof input === "object" && input !== null && "signal" in input);
  signal.throwIfAborted();
  const headers = Object.fromEntries(request.headers);
  // Preserve headers that Request filters but GM APIs allow.
  new Headers(init?.headers).forEach((value, key) => {
    headers[key] = value;
  });
  const scriptHandler =
    typeof GM_info !== "undefined"
      ? GM_info.scriptHandler
      : typeof GM !== "undefined"
        ? GM.info?.scriptHandler
        : undefined;
  const isGreasemonkey = scriptHandler === "Greasemonkey";
  const requestUrl = new URL(request.url);
  requestUrl.hash = "";
  const anonymous =
    request.credentials === "omit" ||
    (request.credentials === "same-origin" &&
      requestUrl.origin !== location.origin);

  // Greasemonkey uses withCredentials and an explicit Cookie header instead of anonymous.
  if (isGreasemonkey && anonymous) headers.cookie ??= "";

  return new Promise<Response>((resolve, reject) => {
    let responseResolved = false;
    let finished = false;
    let abortRequest: (() => void) | undefined;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let bodyController: ReadableStreamDefaultController<Uint8Array> | undefined;

    function cleanup() {
      signal.removeEventListener("abort", onAbort);
    }

    function fail(error: unknown) {
      if (finished) return;
      finished = true;
      cleanup();
      reject(error);
      bodyController?.error(error);
      void reader?.cancel(error).catch(() => {});
    }

    function onAbort() {
      fail(signal.reason);
      abortRequest?.();
    }

    function respond(event: GmResponse, loaded = false) {
      if (finished || responseResolved || (!loaded && !event.status)) return;
      const empty =
        request.method === "HEAD" || [204, 205, 304].includes(event.status);
      if (!empty && !(event.response instanceof ReadableStream) && !loaded) {
        return;
      }
      try {
        let body = empty ? null : event.response;
        // Completed Blob responses need a wrapper only when callers can abort.
        if (body instanceof ReadableStream || (body && hasSignal)) {
          const source = body instanceof ReadableStream ? body : body.stream();
          const sourceReader = source.getReader();
          reader = sourceReader;
          body = new ReadableStream<Uint8Array>({
            start(controller) {
              bodyController = controller;
            },
            async pull(controller) {
              try {
                const { done, value } = await sourceReader.read();
                if (finished) return;
                if (done) {
                  finished = true;
                  cleanup();
                  controller.close();
                  sourceReader.releaseLock();
                } else {
                  controller.enqueue(value);
                }
              } catch (error) {
                fail(error);
              }
            },
            cancel(reason) {
              finished = true;
              cleanup();
              abortRequest?.();
              return sourceReader.cancel(reason);
            },
          });
        }
        const parsedHeaders = parseHeaders(event.responseHeaders);
        const responseUrl = new URL(
          event.finalUrl || event.responseURL || requestUrl.href,
        );
        responseUrl.hash = "";
        const finalUrl = responseUrl.href;
        const response = setResponseMetadata(
          new Response(body, {
            headers: parsedHeaders,
            status: event.status,
            statusText: event.statusText,
          }),
          finalUrl,
          requestUrl.href !== finalUrl,
          parsedHeaders,
        );
        responseResolved = true;
        if (!(body instanceof ReadableStream)) {
          finished = true;
          cleanup();
        }
        resolve(response);
      } catch (error) {
        fail(error);
        abortRequest?.();
      }
    }

    signal.addEventListener("abort", onAbort, { once: true });
    const send = async () => {
      // Firefox may not expose Request.body. Keep its native Blob conversion.
      let data: Blob | string | undefined =
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : init?.body instanceof Blob
            ? init.body
            : await (request.body && hasSignal
                ? new Response(
                    request.body.pipeThrough(new TransformStream(), { signal }),
                  ).blob()
                : request.blob());
      // Greasemonkey serializes details as JSON, so Blob uploads need a binary string.
      if (data && isGreasemonkey) {
        const bytes = new Uint8Array(await data.arrayBuffer());
        const parts: string[] = [];
        for (let i = 0; i < bytes.length; i += 0x8000) {
          parts.push(String.fromCharCode(...bytes.subarray(i, i + 0x8000)));
        }
        data = parts.join("");
      }
      if (finished) return;
      const handle = gmXhr({
        method: request.method,
        url: request.url,
        headers,
        data,
        redirect: request.redirect,
        ...(isGreasemonkey ? { binary: true } : {}),
        withCredentials: !anonymous,
        nocache: request.cache === "no-store",
        revalidate: request.cache === "reload",
        timeout: 300_000,
        responseType: gmXhr.RESPONSE_TYPE_STREAM ?? "blob",
        overrideMimeType: request.headers.get("Content-Type") ?? undefined,
        anonymous,
        onload: (event) => respond(event, true),
        onloadstart: (event) => respond(event),
        onreadystatechange(event) {
          if (event.readyState === 2 || event.readyState === 4) respond(event);
        },
        onerror: ({ statusText, error }) => {
          fail(new TypeError(statusText || error || "Network request failed."));
        },
        ontimeout() {
          fail(new TypeError("Network request timeout."));
        },
        onabort() {
          fail(
            signal.aborted
              ? signal.reason
              : new DOMException("Network request aborted.", "AbortError"),
          );
        },
      });
      abortRequest = () => handle?.abort?.();
      if (handle && "then" in handle) {
        void handle.then((event) => {
          if (event && "status" in event) {
            respond(event, true);
          } else if (event) {
            abortRequest = () => event.abort();
            if (signal.aborted) abortRequest();
          }
        }, fail);
      }
      if (signal.aborted) onAbort();
    };
    void send().catch(fail);
  });
};

export default gmFetch;
