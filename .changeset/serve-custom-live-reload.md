---
"@rollup-extras/plugin-serve": patch
---

Register live reload before customized Hono routes and middleware so their HTML responses receive the reload client script. Preserve the HTML content type when rewriting responses.
