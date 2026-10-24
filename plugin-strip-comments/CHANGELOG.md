# @rollup-extras/plugin-strip-comments

## 0.1.3

### Patch Changes

- 46f5737: Port package-prune's label and switch-colon tracking so regular expressions after labelled blocks and case/default blocks are preserved. Keep object-property and conditional-expression colons in expression context.
- 4474865: Port package-prune's Unicode-escaped identifier scanning. Consume fixed-width and braced escapes as part of identifiers so their braces cannot corrupt division, regular-expression, label, or property context.

## 0.1.2

### Patch Changes

- dc8c0de: Port package-prune's expression-brace tracking so division after object, function, and class expressions cannot cause later regular expressions to be stripped as comments. Preserve statement-block context inside function and arrow bodies.
- 164517a: Port package-prune's shared quoted-string scanner. Preserve comment-like text after raw Unicode line separators and escaped CRLF line continuations inside single- and double-quoted strings.
- 1488632: Port package-prune's statement and for-of context tracking. Preserve regular expressions after do, jump statements, and restricted line breaks while distinguishing the for-of operator from ordinary identifiers named of.
- 8e4ed0e: Port package-prune's complete JavaScript whitespace classification. Recognize Unicode spaces as token separators instead of identifier characters so regular expressions after control conditions are preserved.

## 0.1.1

### Patch Changes

- a8e3354: Preserve token boundaries and line terminators when removing comments so generated JavaScript keeps its original behavior.
- ad6d21a: Preserve regex literals after control conditions and inside template expressions, distinguish division after objects and keyword-named properties, and recognize all JavaScript line terminators when scanning comments.

## 0.1.0

### Minor Changes

- a76a99d: initial release
