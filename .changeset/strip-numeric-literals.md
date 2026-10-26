---
"@rollup-extras/plugin-strip-comments": patch
---

Track complete numeric literals in the comment scanner so division after a trailing decimal point does not corrupt subsequent regular expression literals.
