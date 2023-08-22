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

## License

MIT
