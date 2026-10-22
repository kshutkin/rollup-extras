---
"@rollup-extras/plugin-strip-comments": patch
---

Port package-prune's shared quoted-string scanner. Preserve comment-like text after raw Unicode line separators and escaped CRLF line continuations inside single- and double-quoted strings.
