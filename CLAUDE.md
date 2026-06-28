# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A userscript (`youtube-timestamp-manager.user.js`) that runs on YouTube via Violentmonkey/Tampermonkey. It lets users create, annotate, and copy video timestamps from a floating panel injected into the page.

## Build

```bash
npm install        # installs esbuild, vitest, jsdom
npm run build      # bundles src/index.js → dist/youtube-timestamp-manager.user.js
npm test           # runs vitest against src/utils/
```

The **committed production file** is `youtube-timestamp-manager.user.js` at the repo root — this is what gets installed by users and what the CI release workflow reads the `@version` from. The `src/` + `dist/` directory with the modular build is untracked in-progress work.

**Never edit `youtube-timestamp-manager.user.js` directly.** It is build output. Always edit files under `src/`, then run `npm run build` to regenerate the root `.user.js`.

`build.js` reads `@version` from the root `.user.js` and injects it into the userscript banner before bundling. `build.config.js` holds esbuild options.

## Tests

Tests live in `tests/utils/` and run with vitest + jsdom:

- `time.test.js` — `formatTime` unit tests
- `storage.test.js` — localStorage CRUD and expiration logic
- `debounce.test.js` — debounce timing
- `video.test.js` — videoId extraction from YouTube URLs

Run with `npm test`. No integration or UI tests exist.

## Release workflow

CI (`.github/workflows/release.yml`) triggers on pushes to `main` that touch `youtube-timestamp-manager.user.js`, `package.json`, or `README.md`. It:
1. Reads `@version` from the userscript header via regex
2. Auto-detects bump type from the commit message (`feat:` → minor, `feat!:` / `BREAKING CHANGE` → major, else patch)
3. Updates `@version` in-file, commits with `git add youtube-timestamp-manager.user.js README.md`
4. Creates GitHub Release via `gh release create` with the `.user.js` as asset

The `@version` field in the userscript header is the single source of truth for versioning.

## Architecture

### Two artifacts

| File | Role |
|---|---|
| `youtube-timestamp-manager.user.js` | Monolithic IIFE. Production. What users install. |
| `src/` | Modular source. Bundled into `dist/` via esbuild. In-progress, untracked by CI. |

The monolithic file mirrors the `src/` module structure as plain-object namespaces inside the IIFE.

### src/ modules

| File | Role |
|---|---|
| `index.js` | Entry point. DOMContentLoaded + `MutationObserver` + `popstate` for SPA navigation detection. |
| `state.js` | Shared mutable refs: `elements` (`video`, `pane`) and `state` (`videoId`, `nowid` rAF handle). No imports. |
| `lifecycle.js` | `shouldShowTimestampManager()` (URL check). `initTimestampManager()` polls for `<video>`, calls `ui.init()` + `progressMarkers.init()`. `cleanupTimestampManager()` cancels rAF, removes pane, clears state. |
| `ui.js` | Creates all DOM elements (pane, header, settings modal, timestamp rows) and injects scoped `<style>`. |
| `handlers.js` | Add/save/copy/delete timestamp actions. `watchTime()` rAF loop keeps "End of Video" stamp live. Imports `ui` and `lifecycle` inside functions to avoid circular reference at module level. |
| `progressMarkers.js` | Injects clickable pin elements into YouTube's progress bar. Re-renders when timestamps change. |
| `utils/time.js` | `formatTime(seconds)` → `HH:MM:SS` string. |
| `utils/clipboard.js` | Clipboard API + copy feedback UI. |
| `utils/storage.js` | `localStorage` CRUD. Key: `ytts_${videoId}`. Schema: `{time, note, creation, expiration}[]`. |
| `utils/notification.js` | Toast notification helper. |
| `utils/debounce.js` | Debounce utility. |
| `utils/video.js` | `<video>` DOM query + videoId extraction from URL. |

### Storage schema

Timestamps stored per-video in `localStorage`:
- Key: `ytts_${videoId}` — array of `{time, note, creation, expiration}` objects
- `expiration` is set to 30 days after `creation`; setting `ytts_auto_cleanup` controls whether expired entries are pruned on load

### SPA navigation

YouTube is a SPA. Navigation is detected via a `MutationObserver` on `document` plus a `popstate` listener. Both call `initTimestampManager()` (or `cleanupTimestampManager()` if leaving a video page) after a short timeout.

### CSP constraint

All DOM construction uses `document.createElement` — never `innerHTML`, `DOMParser`, or `parseFromString`. This is required to comply with YouTube's Content Security Policy. Do not use those APIs.

### Userscript metadata

- `@grant none` — no GM APIs; the script relies only on web APIs available on youtube.com
- `@run-at document-start` — initialises early; actual UI waits for `<video>` to appear via polling
- `@noframes` — prevents running in iframes
