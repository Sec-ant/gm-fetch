import type { GM_xmlhttpRequest as GmXhrFc } from "$";

declare const GM_xmlhttpRequest: typeof GmXhrFc;

function parseHeaders(rawHeaders: string) {
  const headers = new Headers();
  // Replace instances of \r\n and \n followed by at least one space or horizontal tab with a space
  // https://tools.ietf.org/html/rfc7230#section-3.2
  const preProcessedHeaders = rawHeaders.replace(/\r?\n[\t ]+/g, " ");
  preProcessedHeaders.split(/\r?\n/).forEach(function (line) {
    var parts = line.split(":");
    var key = parts.shift()?.trim();
    if (key) {
      var value = parts.join(":").trim();
      try {
        headers.append(key, value);
      } catch (error) {
        console.warn("Response " + (error as Error).message);
      }
    }
  });
  return headers;
}

const gmFetch: typeof fetch = async function (input, init) {
  // construct a new request to apply default values
  const request = new Request(input, init);
  // reject aborted request
  if (request.signal.aborted) {
    throw new DOMException("Request is aborted", "AbortError");
  }
  // convert request data to blob
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
    const responseBlobPromise = new Promise<Blob>((resolveBlob) => {
      const { abort } = GM_xmlhttpRequest({
        method: request.method.toUpperCase(),
        url: (request.url ?? "") || location.href,
        headers,
        data: data.size ? data : undefined,
        binary: true,
        nocache: request.cache === "no-store",
        revalidate: request.cache === "reload",
        timeout: 300_000,
        responseType: GM_xmlhttpRequest.RESPONSE_TYPE_STREAM ?? "blob",
        overrideMimeType: request.headers.get("Content-Type") ?? undefined,
        anonymous: request.credentials === "omit",
        onload: ({ response: responseBody }) => {
          if (settled) {
            return;
          }
          resolveBlob(responseBody);
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
            return;
          }
          // DONE or HEADERS_RECEIVED
          const response = new Response(
            responseBody instanceof ReadableStream
              ? responseBody
              : await responseBlobPromise,
            {
              headers: parseHeaders(responseHeaders),
              status,
              statusText,
            }
          );
          Object.defineProperties(response, {
            url: {
              value: finalUrl,
            },
            redirected: {
              value: request.url !== finalUrl,
            },
            type: {
              value: "basic",
            },
          });
          resolve(response);
          settled = true;
        },
        onerror: ({ statusText, error }) => {
          reject(
            new TypeError(statusText || error || "Network request failed.")
          );
        },
        ontimeout() {
          reject(new TypeError("Network request timeout."));
        },
        onabort() {
          reject(new DOMException("Aborted", "AbortError"));
        },
      });
      request.signal.addEventListener("abort", abort);
    });
  });
};

export default gmFetch;
