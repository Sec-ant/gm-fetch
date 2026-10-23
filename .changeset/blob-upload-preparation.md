---
"@sec-ant/gm-fetch": patch
---

Reuse buffered Blob request bodies and avoid unnecessary upload stream wrappers when no cancellation signal is supplied, reducing upload preparation time while preserving request cancellation.
