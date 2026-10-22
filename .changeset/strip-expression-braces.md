---
"@rollup-extras/plugin-strip-comments": patch
---

Port package-prune's expression-brace tracking so division after object, function, and class expressions cannot cause later regular expressions to be stripped as comments. Preserve statement-block context inside function and arrow bodies.
