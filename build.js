const esbuild = require("esbuild");
const fs = require("fs");

function readCurrentVersion() {
  try {
    const content = fs.readFileSync("youtube-timestamp-manager.user.js", "utf8");
    const match = content.match(/@version\s+([\d.]+)/);
    return match ? match[1] : "1.0.0";
  } catch {
    return "1.0.0";
  }
}

const version = readCurrentVersion();

const BANNER = `// ==UserScript==
// @name            YouTube Timestamp Manager
// @name:pt         Gerenciador de Timestamps do YouTube
// @version         ${version}
// @description     Create, manage and copy YouTube video timestamps with notes. Perfect for live streams.
// @description:pt  Crie, gerencie e copie timestamps de vídeos do YouTube com anotações. Perfeito para vídeos ao vivo.
// @author          filipemanuelofs
// @namespace       https://github.com/filipemanuelofs/youtube-timestamp-manager
// @downloadURL     https://github.com/filipemanuelofs/youtube-timestamp-manager/raw/main/youtube-timestamp-manager.user.js
// @updateURL       https://github.com/filipemanuelofs/youtube-timestamp-manager/raw/main/youtube-timestamp-manager.user.js
// @homepageURL     https://github.com/filipemanuelofs/youtube-timestamp-manager
// @supportURL      https://github.com/filipemanuelofs/youtube-timestamp-manager/issues
// @license         MIT
// @match           *://www.youtube.com/*
// @match           *://m.youtube.com/*
// @match           *://music.youtube.com/*
// @icon            data:image/svg+xml;base64,PCEtLQp0YWdzOiBbdGltZSwgaG91ciwgd29yaywgYWxhcm0sIG9uXQpjYXRlZ29yeTogU3lzdGVtCnZlcnNpb246ICIxLjEwNSIKdW5pY29kZTogImY1NDkiCi0tPgo8c3ZnCiAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIzMiIKICBoZWlnaHQ9IjMyIgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMDAwMCIKICBzdHJva2Utd2lkdGg9IjEiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNMTIgN3Y1bDIgMiIgLz4KICA8cGF0aCBkPSJNMTcgMjJsNSAtM2wtNSAtM3oiIC8+CiAgPHBhdGggZD0iTTEzLjAxNyAyMC45NDNhOSA5IDAgMSAxIDcuODMxIC03LjI5MiIgLz4KPC9zdmc+Cg==
// @grant           none
// @run-at          document-start
// @noframes
// ==/UserScript==`;

esbuild
  .build({
    entryPoints: ["src/index.js"],
    bundle: true,
    outfile: "youtube-timestamp-manager.user.js",
    format: "iife",
    banner: { js: BANNER },
    define: { __VERSION__: JSON.stringify(version) },
  })
  .catch(() => process.exit(1));
