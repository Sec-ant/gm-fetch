# @sec-ant/gm-fetch

A fetch API for `GM_xmlhttpRequest` / `GM.xmlHttpRequest`.

## Features

- Use `responseType: stream` to prevent buffering large data when possible.
- Use Typescript.
- Provides es module, iife script and lib mode userscript as well.

## Install

If you use [vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey):

```bash
npm i @sec-ant/gm-fetch
```

or just plain userscript (change `latest` to the version number as needed):

```js
// @require   https://cdn.jsdelivr.net/npm/@sec-ant/gm-fetch@latest/dist/index.iife.js
```

## Usage

1.  Grant necessary GM_APIs:

    vite-plugin-monkey:

    ```ts
    {
      plugins: [
        monkey({
          userscript: {
            // or GM.xmlHttpRequest
            grant: "GM_xmlhttpRequest",
            // whatever websites you're to make requests to
            connect: ["github.com"],
          },
        }),
      ];
    }
    ```

    plain userscript:

    ```js
    // @grant     GM_xmlhttpRequest
    // @connect   github.com
    ```

2.  Use it just like fetch:

    vite-plugin-monkey:

    ```ts
    import gmFetch from "@sec-ant/gm-fetch";

    gmFetch("https://github.com/Sec-ant/gm-fetch");
    ```

    plain userscript:

    ```js
    /* globals gmFetch */
    (function () {
      "use strict";
      gmFetch("https://github.com/Sec-ant/gm-fetch");
    })();
    ```

The default `credentials: "same-origin"` sends cookies only when the request URL
has the same origin as the current page. Use `credentials: "include"` for
cross-origin requests that need cookies, or `credentials: "omit"` to disable
cookies. Redirect handling follows the userscript manager's cookie policy.

Requests can be cancelled with an `AbortSignal`, including while preparing an
upload or consuming a response body. Uploads are buffered because the GM APIs
accept buffered request data. Streaming downloads are used when the GM API
exposes `RESPONSE_TYPE_STREAM`; other environments use a Blob response.

## Userscript managers

Both Manifest V2 and Manifest V3 managers work through their GM request APIs.
The following extensions were checked with a local HTTP server on 2026-10-24:

| Manager              | Browser                    | Manifest | Verified API                             |
| -------------------- | -------------------------- | -------- | ---------------------------------------- |
| Tampermonkey 5.5.1   | Chromium 156               | V3       | `GM_xmlhttpRequest`, `GM.xmlHttpRequest` |
| Tampermonkey 5.5.0   | Firefox 157                | V2       | `GM.xmlHttpRequest`                      |
| Violentmonkey 2.49.0 | Chromium 156 / Firefox 157 | V3 / V2  | Both APIs                                |
| ScriptCat 1.5.0      | Chromium 156               | V3       | Both APIs                                |
| Greasemonkey 4.14    | Firefox 157                | V2       | `GM.xmlHttpRequest`                      |

Checks cover text and binary uploads, empty responses, cloned redirects, cookie
policies, and cancellation. Violentmonkey and ScriptCat use the Blob fallback.
Greasemonkey uploads use binary strings because its request details are
serialized as JSON. Its API has no abort handle, so cancellation rejects the
fetch call while the manager's network request can continue.

Promise-only APIs and the `responseURL` response shape also have regression
coverage for managers such as FireMonkey and Safari Userscripts; those
extensions have not been tested directly. Header modification, redirects, cache
options, and cookies during redirects follow the manager's implementation.
Grant the appropriate GM API and `@connect` hosts, and enable user scripts in
the browser when required by an MV3 manager.

## Development

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium firefox
pnpm test
pnpm coverage
pnpm type-check
pnpm build
```

Tests run in Chromium and Firefox with simulated GM callbacks. Type checking
covers the library, build configuration, and tests.

## License

MIT
