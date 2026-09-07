# CLAUDE.md

Userscript for YouTube (Violentmonkey/Tampermonkey): floating panel to create,
annotate and copy video timestamps.

## Commands

- `npm run build` — esbuild bundles `src/index.js` into
  `youtube-timestamp-manager.user.js` at the repo root. That root file is
  **build output**: never edit it. Edit under `src/`, rebuild, commit both.
- `npm test` — vitest + jsdom. The release workflow has no test job, so run it
  locally before committing.
- The userscript metadata banner (`@name`, `@match`, `@grant`, icon) lives in
  `build.js`, not in the root file — edit it there or the next build wipes the
  change. `build.config.js` is empty despite `package.json`'s `main`; esbuild
  options are inline in `build.js`.

## Version and release

`@version` in the root `.user.js` header is the only source of truth;
`build.js` reads it back out of that file on every build. The `version` field
in `package.json` is stale and unused.

Any push to `main` touching `youtube-timestamp-manager.user.js`,
`package.json` or `README.md` fires `.github/workflows/release.yml`: it bumps
`@version` from the commit message prefix (major on `feat!:` /
`BREAKING CHANGE`, minor on `feat:`, patch otherwise), rebuilds, commits the
bump and publishes a GitHub Release. Every build pushed to `main` cuts a
release, and the bot commit lands on `main` — `git pull` before committing
again.

## Tests

Every module under `src/` has a suite in `tests/` (`src/utils/*` →
`tests/utils/*`), except `src/state.js`. Before writing a DOM suite, read the
JSDoc in `tests/helpers/dom.js`: it documents the fixtures and why `getVideo()`
is stubbed by assigning `elements.video` directly (jsdom's
`HTMLMediaElement.duration` is read-only).

`src/index.js` patches `history` and attaches listeners at import time; its
suite reloads the module with `vi.resetModules()` and undoes both in
`afterEach`. Anything that must be triggered by `popstate` or
`yt-navigate-finish` has to move the URL with the *pristine* `replaceState`,
otherwise the patched wrapper fires the navigation and the test passes even
with the listener deleted.

## Constraints

- **No HTML-string APIs.** YouTube's CSP blocks them. Build DOM with
  `document.createElement` only — never `innerHTML`, `insertAdjacentHTML`,
  `DOMParser` or `parseFromString`.
- **`@grant none`.** No `GM_*` APIs; persistence is plain `localStorage`.
- **`handlers.js` imports `ui` and `lifecycle` at module level but must only
  *use* them inside functions** — that is what keeps the circular import
  resolvable at runtime.
- **`__VERSION__` is an esbuild `define`**, so `src/ui.js` only runs bundled.
  `vitest.config.mjs` mirrors the same define; any other runner has to as well.

## Conventions

- Comments and JSDoc under `src/` are pt-BR; user-facing UI strings are English
  and inline (there is no i18n layer).
- `README.md` and `README.pt-BR.md` are mirrors — a user-facing change updates
  both.

## SPA navigation

YouTube never reloads the page. `src/index.js` catches navigation by patching
`history.pushState` / `replaceState` and listening to `popstate` and
`yt-navigate-finish` (on both `window` and `document`); each hit re-runs
`initTimestampManager()` or `cleanupTimestampManager()`.
