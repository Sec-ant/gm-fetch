# @sec-ant/gm-fetch

A fetch API of `GM_xmlhttpRequest`.

## Features

- Use `responseType: stream` to prevent buffering large data when possible.
- Use Typescript.
- Provides es module, umd module and lib mode userscript as well.

## Install

If you use [vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey):

```bash
npm i @sec-ant/gm-fetch
```

or just plain userscript (change the version number as needed):

```js
// @require   https://cdn.jsdelivr.net/npm/@sec-ant/gm-fetch@0.0.1/dist/index.umd.js
```

## Usage

1.  Grant necessary GM_APIs:

    vite-plugin-monkey:

    ```ts
    {
      plugins: [
        monkey({
          userscript: {
            grant: "GM_xmlhttpRequest",
            // whatever websites you're to make requests to
            connect: ["localhost"],
          },
        }),
      ];
    }
    ```

    plain userscript:

    ```js
    // @grant     GM_xmlhttpRequest
    // @connect   localhost
    ```

2.  Use it just like fetch:

    vite-plugin-monkey:

    ```ts
    import gmFetch from "@sec-ant/gm-fetch";

    gmFetch("http://localhost:4567/100.zip");
    ```

    plain userscript:

    ```js
    /* globals gmFetch */
    (function () {
      "use strict";
      gmFetch("http://localhost:4567/100.zip");
    })();
    ```

## License

MIT
