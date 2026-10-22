---
"@rollup-extras/plugin-angularjs-template-cache": patch
---

Mark generated template registrations as having side effects regardless of standalone mode, so Rollup retains side-effect-only imports when registering templates on an existing AngularJS module.
