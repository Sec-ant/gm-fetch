# @sec-ant/gm-fetch

## 1.2.6

### Patch Changes

- 4e021cb: Reuse buffered Blob request bodies and avoid unnecessary upload stream wrappers when no cancellation signal is supplied, reducing upload preparation time while preserving request cancellation.
- 4e021cb: Handle HEAD and 204, 205, and 304 responses with a null body so that empty responses resolve successfully.
- 4e021cb: Preserve Unicode and binary uploads across userscript managers by sending Blob data without the string-only binary flag and using binary strings for Greasemonkey's JSON-based request API.
- 4e021cb: Honor cancellation while buffering uploads and reading response bodies, preserve abort reasons, and cancel the underlying request when a response stream is cancelled.
- 4e021cb: Respect the default same-origin credentials policy for cross-origin request URLs. Use credentials: "include" to send cookies on cross-origin requests.
- 4e021cb: Support callback-based and promise-only GM request APIs, preserve modern GM method receivers, and propagate request failures and response construction errors to callers.
- 4e021cb: Preserve response URLs, redirect information, response types, and cookie headers through cloning, and normalize responseURL aliases and transport fragments when reporting response URLs and redirects.
- 4e021cb: Expose gmFetch on the global object in the userscript bundle with an explicit entry point that works with the updated build tools.

## 1.2.5

### Patch Changes

- 806be62: Fix the IIFE bundle referencing vite-plugin-monkey's internal `__MONKEY_WINDOW_KEY__` placeholder at runtime.

## 1.2.4

### Patch Changes

- 1faea32: Bump deps and enable OIDC publishing

## 1.2.3

### Patch Changes

- 42f102f: Fix "Request with GET/HEAD method cannot have body" regression. @rachpt

## 1.2.2

### Patch Changes

- 5442a84: Fix non-english data corruption when posting in binary mode

## 1.2.1

### Patch Changes

- 27e3e50: Update vite-plugin-monkey to fix a bug
