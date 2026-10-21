# Package bug fixes

Each numbered fix gets a focused regression test, a patch changeset, and its own commit.
Validate each affected package before continuing; finish with workspace tests, builds, and lint.

1. [x] Prevent mangled names from colliding with existing bindings and properties.
2. [x] Preserve JavaScript token boundaries when stripping comments.
3. [x] Preserve default imports through prebundle proxies.
4. [x] Restore prebundle discovery and emission on cached rebuilds.
5. [x] Keep dynamic dependencies in prebundle output.
6. [ ] Settle the HTML template promise after read errors.
7. [ ] Re-emit copied assets in subsequent bundles.
8. [ ] Set executable permissions when using `output.file`.
9. [ ] Retain all outputs when serving from memory.
10. [ ] Await combined asset factories before falling back.
