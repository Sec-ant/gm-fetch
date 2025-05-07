import { GM, GM_xmlhttpRequest } from "vite-plugin-monkey/dist/client";

function parseHeaders(rawHeaders: string) {
  const headers = new Headers();
  // Replace instances of \r\n and \n followed by at least one space or horizontal tab with a space
  // https://tools.ietf.org/html/rfc7230#section-3.2
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

const gmFetch: typeof fetch = async (input, init) => {
  const gmXhr = GM_xmlhttpRequest || GM.xmlHttpRequest;
  if (typeof gmXhr !== "function") {
    throw new DOMException(
      "GM_xmlhttpRequest or GM.xmlHttpRequest is not granted.",
      "NotFoundError",
    );
  }
  // construct a new request to apply default values
  const request = new Request(input, init);
  // reject aborted request
  if (request.signal.aborted) {
    throw new DOMException("Network request aborted.", "AbortError");
  }
  // assign the Blob representation of the request body to data
  // TODO: https://github.com/Tampermonkey/tampermonkey/issues/1757
  const data = await request.blob();
  // apply non-safe headers
  const headers = Object.fromEntries(request.headers);
  // use "new Headers()" to filter out invalidate header keys or values
  new Headers(init?.headers).forEach((value, key) => {
    headers[key] = value;
  });
  return new Promise<Response>((resolve, reject) => {
    let settled = false;
    const responseBlobPromise = new Promise<Blob | null>((resolveBlob) => {
      const { abort } = gmXhr({
        method: request.method.toUpperCase(),
        url: request.url || location.href,
        headers,
        data: data.size ? data : undefined,
        redirect: request.redirect,
        binary: true,
        nocache: request.cache === "no-store",
        revalidate: request.cache === "reload",
        timeout: 300_000,
        responseType: gmXhr.RESPONSE_TYPE_STREAM ?? "blob",
        overrideMimeType: request.headers.get("Content-Type") ?? undefined,
        anonymous: request.credentials === "omit",
        onload: ({ response: responseBody }) => {
          if (settled) {
            resolveBlob(null);
            return;
          }
          resolveBlob(responseBody as Blob);
        },
        async onreadystatechange({
          readyState,
          responseHeaders,
          status,
          statusText,
          finalUrl,
          response: responseBody,
        }) {
          if (readyState === XMLHttpRequest.DONE) {
            request.signal.removeEventListener("abort", abort);
          } else if (readyState !== XMLHttpRequest.HEADERS_RECEIVED) {
            return;
          }
          if (settled) {
            resolveBlob(null);
            return;
          }
          // DONE or HEADERS_RECEIVED
          const parsedHeaders = parseHeaders(responseHeaders);
          const redirected = request.url !== finalUrl;
          const response = new Response(
            responseBody instanceof ReadableStream
              ? responseBody
              : await responseBlobPromise,
            {
              headers: parsedHeaders,
              status,
              statusText,
            },
          );
          // non-intrusive override
          Object.defineProperties(response, {
            url: {
              value: finalUrl,
            },
            type: {
              value: "basic",
            },
            ...(response.redirected !== redirected
              ? {
                  redirected: {
                    value: redirected,
                  },
                }
              : {}),
            // https://fetch.spec.whatwg.org/#forbidden-response-header-name
            ...(parsedHeaders.has("set-cookie") ||
            parsedHeaders.has("set-cookie2")
              ? {
                  headers: {
                    value: parsedHeaders,
                  },
                }
              : {}),
          });
          resolve(response);
          settled = true;
        },
        onerror: ({ statusText, error }) => {
          reject(
            new TypeError(statusText || error || "Network request failed."),
          );
          resolveBlob(null);
        },
        ontimeout() {
          reject(new TypeError("Network request timeout."));
          resolveBlob(null);
        },
        onabort() {
          reject(new DOMException("Network request aborted.", "AbortError"));
          resolveBlob(null);
        },
      });
      request.signal.addEventListener("abort", abort);
    });
  });
};

export default gmFetch;
