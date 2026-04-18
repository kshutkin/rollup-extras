# Emit Asset Mode — Implementation Plan

This document outlines the plan for implementing "emit asset" mode in `@rollup-extras/plugin-script-loader`. This mode emits legacy scripts as a separate, non-module asset file that runs in global scope without strict mode.

## Goals

1. **Non-module output** — Emit a classic `<script>` file, not an ES module
2. **Non-strict mode** — Code runs in sloppy mode (required for truly legacy libraries)
3. **Stable order** — Scripts appear in the order they're imported
4. **Minification** — User-provided minifier function (optional)
5. **Sourcemaps** — Concatenated sourcemap support (optional, enabled by default)
6. **Integration with plugin-html** — Works via existing `assetsFactory` pattern

---

## New Configuration Options

```typescript
type ScriptLoaderPluginOptions = {
  // Existing options
  prefix?: string; // 'script!' by default
  useStrict?: boolean; // true by default (for inline mode)
  pluginName?: string;
  verbose?: boolean;

  // New options for emit mode
  emit?: "inline" | "asset"; // 'inline' by default (current behavior)
  name?: string; // 'vendor.js' by default, base name for the emitted asset
  exactFileName?: boolean; // true by default, when false Rollup applies assetFileNames pattern
  sourcemap?: boolean; // true by default when emit: 'asset'
  minify?: (
    code: string,
    sourcemap?: SourceMap
  ) => Promise<{ code: string; map?: SourceMap }>;
};
```

### Option Details

#### `emit`

- `'inline'` (default): Current behavior — scripts inlined into main bundle
- `'asset'`: New behavior — scripts concatenated and emitted as separate asset

#### `name`

- Default: `'vendor.js'`
- Base name for the emitted asset file
- How it's used depends on `exactFileName` option

#### `exactFileName`

- Default: `true`
- When `true`: Uses Rollup's `fileName` property — asset emitted with exact name (e.g., `vendor.js`)
- When `false`: Uses Rollup's `name` property — Rollup applies `output.assetFileNames` pattern
  - Example: with `assetFileNames: 'assets/[name].[hash].[ext]'` → `assets/vendor.abc123.js`

This follows the same pattern as `@rollup-extras/plugin-copy` with its `exactFileNames` option.

````

#### `sourcemap`
- Default: `true` when `emit: 'asset'`
- When enabled, generates a concatenated sourcemap pointing back to original files
- Emitted alongside the asset: `vendor.js.map` (or `vendor.[hash].js.map`)

#### `minify`
- Default: `undefined` (no minification)
- User provides an async function matching the signature above
- Example with terser:
  ```js
  import { minify } from 'terser';

  scriptLoader({
      emit: 'asset',
      minify: async (code, map) => {
          const result = await minify(code, {
              sourceMap: map ? { content: map } : false
          });
          return { code: result.code, map: result.map };
      }
  })
````

- Example with oxc-minify:

  ```js
  import { minify } from "oxc-minify";

  scriptLoader({
    emit: "asset",
    minify: async (code) => {
      const result = await minify("vendor.js", code);
      return { code: result.code, map: result.map };
    },
  });
  ```

---

## Internal Data Structures

### Script Entry

```typescript
interface ScriptEntry {
  /** Sequence number for ordering (assigned in resolveId) */
  order: number;

  /** Original file path (for sourcemap) */
  filePath: string;

  /** Raw source code */
  code: string;

  /** Original sourcemap if the file had one (e.g., .min.js with .min.js.map) */
  originalMap?: SourceMap;
}
```

### Collection State

```typescript
/** Map from virtual ID to script entry */
const scripts: Map<string, ScriptEntry> = new Map();

/** Counter for ordering */
let orderCounter = 0;
```

---

## Implementation Phases

### Phase 1: Collection (resolveId + load)

#### resolveId Hook

```
1. Check if source starts with prefix ('script!')
2. If not, return null (unchanged)
3. Strip prefix to get bare specifier
4. Resolve via this.resolve() to get actual file path
5. Clean up virtual module markers (\0 prefix, ?query suffix)
6. Assign order number: orderCounter++
7. Store order in a side map: orderMap.set(virtualId, order)
8. Return virtual ID with moduleSideEffects: true
```

#### load Hook

```
1. Check if id starts with scriptPrefix ('\0script-loader:')
2. If not, return null
3. Extract real file path from id
4. Read source code from file
5. Optionally read existing sourcemap (look for .map file or inline map)
6. Create ScriptEntry:
   - order: orderMap.get(id)
   - filePath: real file path
   - code: source code
   - originalMap: existing sourcemap if found
7. Store in scripts map: scripts.set(id, entry)
8. Return placeholder for main bundle:
   - code: '/* [script-loader] externalized: ${filePath} */\n'
   - map: null
   - moduleSideEffects: true
```

The placeholder keeps the import in the graph (preserving any side-effect semantics in the main bundle) but adds no meaningful code.

### Phase 2: Concatenation (generateBundle)

```
1. Skip if emit !== 'asset' or scripts.size === 0
2. Sort script entries by order number
3. Build concatenated code and sourcemap:

   let concatenatedCode = '';
   const sourcemapGenerator = new SourceMapGenerator({ file: fileName });
   let currentLine = 1;

   for (const entry of sortedEntries) {
       // Add source to sourcemap
       if (sourcemap) {
           sourcemapGenerator.setSourceContent(entry.filePath, entry.code);
           // Map each line to original
           const lines = entry.code.split('\n');
           for (let i = 0; i < lines.length; i++) {
               sourcemapGenerator.addMapping({
                   generated: { line: currentLine + i, column: 0 },
                   source: entry.filePath,
                   original: { line: i + 1, column: 0 }
               });
           }
           // If entry has originalMap, need to remap through it
           if (entry.originalMap) {
               // Use source-map's applySourceMap or manual remapping
           }
       }

       concatenatedCode += entry.code + '\n';
       currentLine += entry.code.split('\n').length;
   }

4. Apply minification if configured:

   if (minify) {
       const minified = await minify(concatenatedCode, sourcemapGenerator.toJSON());
       concatenatedCode = minified.code;
       if (minified.map) {
           // Replace sourcemap with minified one
       }
   }

5. Emit the asset using Rollup's native hashing:

   // Emit main asset WITHOUT sourceMappingURL first
   const assetRefId = this.emitFile({
       type: 'asset',
       [exactFileName ? 'fileName' : 'name']: name,
       source: concatenatedCode
   });

   // Get the final filename (may include hash if exactFileName: false)
   const finalFileName = this.getFileName(assetRefId);

6. Emit sourcemap and update main asset (if enabled):

   if (sourcemap) {
       // Compute sourcemap filename based on the (possibly hashed) main filename
       const mapFileName = finalFileName + '.map';

       // Emit sourcemap with EXACT fileName (no additional hashing)
       this.emitFile({
           type: 'asset',
           fileName: mapFileName,
           source: JSON.stringify(sourcemapGenerator.toJSON())
       });

       // Modify main asset in bundle to add sourceMappingURL
       // (bundle mutation after emitFile is supported and persists to output)
       bundle[finalFileName].source += `\n//# sourceMappingURL=${basename(mapFileName)}`;
   }

   // Note: This approach was verified experimentally:
   // - emitFile with 'name' → Rollup hashes immediately
   // - getFileName(refId) returns hashed name right away
   // - bundle[fileName] is accessible and mutable after emitFile
   // - Modifications to bundle[fileName].source persist to final output
```

### Phase 3: Cleanup

```
1. In buildEnd or generateBundle (after emission):
   - Clear scripts map
   - Reset orderCounter
   - (Supports watch mode / rebuild)
```

---

## Sourcemap Strategy

### Concatenation Sourcemap

When concatenating multiple files, we need a sourcemap that:

1. Points each segment back to its original file
2. Preserves line/column offsets correctly
3. Handles files that already have sourcemaps (remap through them)

### Sourcemap + Hashing (Confirmed Approach)

When using Rollup's native hashing (`exactFileName: false`), we need to ensure the
sourceMappingURL comment references the correct hashed filename. This is achieved by:

```js
// 1. Emit main asset WITHOUT sourceMappingURL
const refId = this.emitFile({
  type: "asset",
  name: "vendor.js", // Rollup will hash this
  source: concatenatedCode,
});

// 2. Get hashed filename immediately
const mainFileName = this.getFileName(refId);
// → e.g., "assets/vendor.C_3a_Azj.js"

// 3. Emit sourcemap with EXACT fileName (derived from main hash)
const mapFileName = mainFileName + ".map";
this.emitFile({
  type: "asset",
  fileName: mapFileName, // exact, no additional hashing
  source: JSON.stringify(sourcemap),
});

// 4. Modify main asset in bundle to add sourceMappingURL
bundle[mainFileName].source += `\n//# sourceMappingURL=${basename(
  mapFileName
)}`;
// → adds: //# sourceMappingURL=vendor.C_3a_Azj.js.map
```

This approach was experimentally verified and works correctly.

### Library Options

1. **`source-map`** (Mozilla) — Full-featured, well-tested
2. **`magic-string`** — Simpler API, good for concatenation
3. **`@ampproject/remapping`** — Specifically for remapping through existing maps

**Recommendation**: Use `magic-string` for concatenation (it handles the basic case well) and `@ampproject/remapping` if we need to remap through existing sourcemaps.

### Sourcemap Handling Flow

```
┌─────────────────┐
│  d3.min.js      │──→ Has d3.min.js.map? ──→ Remap through it
└─────────────────┘                     │
                                        ↓
┌─────────────────┐                 ┌───────────────────┐
│  angular.js     │──→ No map ──→  │ Direct line mapping│
└─────────────────┘                 └───────────────────┘
                                        │
                                        ↓
                              ┌─────────────────────┐
                              │ Concatenated map    │
                              │ (pre-minification)  │
                              └─────────────────────┘
                                        │
                                        ↓ (if minify)
                              ┌─────────────────────┐
                              │ Minifier remaps     │
                              │ through concat map  │
                              └─────────────────────┘
                                        │
                                        ↓
                              ┌─────────────────────┐
                              │ Final sourcemap     │
                              │ vendor.js.map       │
                              └─────────────────────┘
```

---

## Integration with plugin-html

### Recommended User Configuration

```js
import scriptLoader from "@rollup-extras/plugin-script-loader";
import html from "@rollup-extras/plugin-html";
import {
  simpleES5Script,
  combineAssetFactories,
} from "@rollup-extras/plugin-html/asset-factories";

export default {
  input: "src/main.js",
  output: {
    format: "es",
    dir: "dist",
    sourcemap: true,
    assetFileNames: "assets/[name].[hash].[ext]", // Rollup's pattern for hashed assets
  },
  plugins: [
    scriptLoader({
      emit: "asset",
      name: "vendor.js",
      exactFileName: false, // Let Rollup apply assetFileNames pattern
      sourcemap: true,
      // minify: async (code, map) => { ... }  // optional
    }),

    html({
      template: "index.html",
      assetsFactory: combineAssetFactories(
        // Inject vendor bundle as classic script (before module scripts)
        simpleES5Script(/vendor\..*\.js$/)
        // ... other asset factories
      ),
    }),
  ],
};
```

With `exactFileName: true` (default), the asset is emitted as exactly `vendor.js`:

```js
scriptLoader({
  emit: "asset",
  name: "vendor.js",
  // exactFileName: true  // default
});
// → emits: vendor.js
```

With `exactFileName: false`, Rollup applies the `assetFileNames` pattern:

```js
// output.assetFileNames: 'assets/[name].[hash].[ext]'
scriptLoader({
  emit: "asset",
  name: "vendor.js",
  exactFileName: false,
});
// → emits: assets/vendor.abc123.js
```

### Injection Order

plugin-html injects assets by type in this order (in `defaultTemplateFactory`):

1. `asset` (CSS, etc.)
2. `iife`
3. `umd`
4. `es`

For the vendor bundle, `simpleES5Script` returns an `AssetDescriptor` with `type: 'asset'`. This means it will be injected before ES module scripts — which is exactly what we want.

### Generated HTML

```html
<!DOCTYPE html>
<html>
  <head>
    <link rel="stylesheet" href="assets/main.abc123.css" />
  </head>
  <body>
    <script src="vendor.def456.js" type="text/javascript"></script>
    <script src="assets/main.xyz789.js" type="module"></script>
  </body>
</html>
```

---

## File Structure Changes

### New Dependencies

```json
{
  "dependencies": {
    "magic-string": "^0.30.0"
  }
}
```

Note: `magic-string` is lightweight and commonly used. Alternatively, could use `source-map` for more control.

### Source Files

```
plugin-script-loader/
├── src/
│   ├── index.js          # Main plugin (add emit mode logic)
│   ├── concatenate.js    # New: concatenation + sourcemap logic
│   └── sourcemap.js      # New: sourcemap utilities (optional, could inline)
├── tests/
│   ├── index.spec.mjs    # Existing tests
│   ├── emit-asset.spec.mjs   # New: tests for emit mode
│   └── sourcemap.spec.mjs    # New: tests for sourcemap generation
```

---

## Test Plan

### Unit Tests

1. **Collection ordering**

   - Multiple script imports maintain order
   - Order preserved across async resolution

2. **Concatenation**

   - Scripts concatenated in correct order
   - Each script separated by newline

3. **Sourcemap generation**

   - Line mappings correct for simple case
   - Works with files that have existing sourcemaps
   - Disabled when `sourcemap: false`

4. **Minification**

   - Custom minify function called with code and map
   - Result used correctly
   - Sourcemap chain preserved through minification

5. **Filename**

   - `exactFileName: true` emits with exact name
   - `exactFileName: false` lets Rollup apply assetFileNames pattern
   - Sourcemap filename follows the same pattern

6. **Asset emission**
   - Asset emitted with correct fileName
   - Sourcemap emitted when enabled
   - `sourceMappingURL` comment appended

### Integration Tests

1. **With plugin-html**

   - Vendor bundle injected as classic script
   - Injected before ES module scripts
   - Correct path in HTML

2. **Full build**
   - Build succeeds with emit: 'asset'
   - Vendor bundle runs in browser (no strict mode errors)
   - Sourcemaps work in browser devtools

---

## Migration Path

### For Existing Users

The default behavior (`emit: 'inline'`) is unchanged. Users opt into the new mode explicitly:

```js
// Before (still works)
scriptLoader();

// After (new mode)
scriptLoader({ emit: "asset" });
```

### Documentation Updates

1. Update README with emit mode documentation
2. Add examples for:
   - Basic emit: 'asset' usage
   - Custom minification with terser
   - Custom minification with oxc-minify
   - Integration with plugin-html
3. Document sourcemap behavior

---

## Open Questions

1. **Should we provide built-in minification?**

   - Current plan: No, user provides minify function
   - Alternative: Include oxc-minify as optional peer dep with built-in support

2. **Should we auto-detect plugin-html and configure it?**

   - Current plan: No, user configures assetsFactory manually
   - Alternative: Export a helper or detect plugin-html in plugin communication

3. **How to handle watch mode?**

   - Scripts map must be cleared between builds
   - Need to test incremental rebuild behavior

4. **Sourcemap filename when using Rollup's hashing?** ✅ RESOLVED
   - Verified approach:
     1. Emit main asset with `name` (Rollup hashes it)
     2. Call `getFileName(refId)` to get hashed name immediately
     3. Emit sourcemap with exact `fileName: hashedMainName + '.map'` (no additional hashing)
     4. Modify `bundle[hashedMainName].source` to append sourceMappingURL
   - This ensures sourceMappingURL always matches the actual .map filename
   - Bundle mutation after emitFile is supported and persists to output

---

## Implementation Order

1. **Phase 1**: Basic emit mode without sourcemaps

   - Collection, ordering, concatenation
   - Asset emission with fixed filename
   - Tests for basic flow

2. **Phase 2**: Sourcemap support

   - Add magic-string or source-map dependency
   - Implement concatenation sourcemap
   - Handle existing sourcemaps in input files
   - Tests for sourcemap correctness

3. **Phase 3**: Minification support

   - Add minify option
   - Chain sourcemaps through minification
   - Tests with mock minifier

4. **Phase 4**: Polish
   - `exactFileName` option (Rollup-native hashing)
   - Verbose logging
   - Documentation
   - Integration tests with plugin-html

---

## Timeline Estimate

- Phase 1: ~2-3 hours
- Phase 2: ~3-4 hours (sourcemaps are tricky)
- Phase 3: ~1-2 hours
- Phase 4: ~2-3 hours

Total: ~8-12 hours of focused implementation work
