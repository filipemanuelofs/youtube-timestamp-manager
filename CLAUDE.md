# CLAUDE.md

Userscript for YouTube (Violentmonkey/Tampermonkey): floating panel to create,
annotate and copy video timestamps.

## Build

`youtube-timestamp-manager.user.js` at the repo root is **build output** —
esbuild bundles `src/index.js` into it. Never edit it directly: edit under
`src/`, then `npm run build`, and commit both. (`dist/` is a stale leftover:
gitignored and no longer written to.)

The userscript metadata banner (`@name`, `@match`, `@grant`, icon) lives in
`build.js`, not in the root file — edit it there or the next build wipes the
change. `build.config.js` is empty; esbuild options are inline in `build.js`.

## Version

`@version` in the root `.user.js` header is the only source of truth.
`build.js` reads it back out of that file on every build; the `version` field
in `package.json` is stale and unused.

Any push to `main` touching `youtube-timestamp-manager.user.js`,
`package.json` or `README.md` fires `.github/workflows/release.yml`: it bumps
`@version` (major on `feat!:` / `BREAKING CHANGE`, minor on `feat:`, patch
otherwise), commits the bump and publishes a GitHub Release. The commit
message prefix picks the bump, and every build pushed to `main` cuts a
release.

## Tests

`npm test` (vitest + jsdom). Only `src/utils/` is covered, by `tests/utils/`.
There are no UI, DOM or integration tests — a change to `ui.js`,
`handlers.js` or `progressMarkers.js` has to be checked in the browser.

## Constraints

- **No HTML-string APIs.** YouTube's CSP blocks them. Build DOM with
  `document.createElement` only — never `innerHTML`, `insertAdjacentHTML`,
  `DOMParser` or `parseFromString`.
- **`@grant none`.** No `GM_*` APIs; persistence is plain `localStorage`.
- **`handlers.js` imports `ui` and `lifecycle` inside functions**, not at
  module level, to break a circular import. Keep it that way.
- **`__VERSION__` is an esbuild `define`**, so `src/ui.js` only runs bundled —
  importing it raw from a test throws.

## SPA navigation

YouTube never reloads the page. `src/index.js` catches navigation by patching
`history.pushState` / `replaceState` and listening to `popstate` and
`yt-navigate-finish`; each hit re-runs `initTimestampManager()` or
`cleanupTimestampManager()`. Most regressions here come from a navigation path
that none of those hooks catch.
