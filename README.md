# YouTube Timestamp Manager

[![Version](https://img.shields.io/badge/version-1.6.0-blue.svg)](https://github.com/filipemanuelofs/youtube-timestamp-manager)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Userscript](https://img.shields.io/badge/userscript-violentmonkey-orange.svg)](https://violentmonkey.github.io/)

> 🎯 Create, manage and copy YouTube video timestamps with notes. Perfect for lectures, tutorials and live streams.

<img width="300" height="140" alt="image" src="https://github.com/user-attachments/assets/ad11e324-f8fb-485e-8a07-731ae50c03d9" />

## ✨ Features

- 📝 **Add timestamps** with custom notes
- 🔗 **Copy individual links** with specific timestamp
- 📋 **Copy complete list** of all timestamps
- ⛔ **Delete unwanted timestamps** one by one
- ☑️ **Bulk delete** - select multiple timestamps and remove them in one go
- 📍 **Progress bar markers** - every timestamp gets a clickable pin on the video scrubber
- 💾 **Automatic saving** - timestamps persist per video and expire after 30 days
- ⠿ **Drag the panel anywhere** - grab the handle and drop it where it suits you; the spot is remembered
- 🔽 **Minimize panel** to avoid interfering with viewing experience
- ⚡ **Quick navigation** - click timestamp to jump to that moment
- 🎬 **Full support** - YouTube, Lives, Shorts, Mobile and YouTube Music
- 🌙 **Elegant interface** with modern and transparent design

## 🚀 Installation

### Prerequisites

- Modern browser (Chrome, Firefox, Safari, Edge)
- Userscript extension installed:
  - [Violentmonkey](https://violentmonkey.github.io/) (Recommended)
  - [Tampermonkey](https://www.tampermonkey.net/)
  - [Greasemonkey](https://www.greasespot.net/)
  - [Userscripts](https://github.com/quoid/userscripts) (Safari)

### Script Installation

1. **Click the installation link:**

   - [Youtube Timestamp Manager](https://github.com/filipemanuelofs/youtube-timestamp-manager/raw/main/youtube-timestamp-manager.user.js)

2. **Or install manually:**
   - Open Violentmonkey extension
   - Click the ➕ button
   - Paste the code from `youtube-timestamp-manager.user.js`
   - Save (Ctrl+S)

## 📖 How to Use

### Panel Interface

The panel automatically appears in the bottom-left corner when you open a YouTube video. It starts minimized by default — click 🔼 to expand it, or turn the behaviour off in the settings.

Drag it by the ⠿ handle to park it anywhere on screen. The spot is remembered across videos and reloads, and the panel always stays inside the window: it sticks to whichever edge it is nearest, so minimizing it or adding timestamps never pushes it off screen. "Reset widget position" in the settings sends it back to the corner.

### Panel Controls

| Button/Icon             | Function                                           |
| ----------------------- | -------------------------------------------------- |
| **⠿**                   | Drag handle — move the panel around the screen     |
| **⚙️**                  | Open settings                                      |
| **🔽 / 🔼**             | Minimize/restore panel                             |
| **❌**                  | Close panel (with confirmation)                    |
| **📋**                  | Copy individual timestamp                          |
| **⛔**                  | Delete timestamp (with confirmation)               |
| **Add Timestamp**       | Add current video timestamp                        |
| **Copy Timestamps**     | Copy all timestamps                                |
| **☑️ (per row)**        | Select a timestamp for bulk delete                 |
| **☑️ (in the header)**  | Select or clear every timestamp at once            |
| **Delete Selected (N)** | Delete the selected timestamps (with confirmation) |

The selection controls only show up once the list has more than 3 timestamps — below that, deleting one by one with ⛔ is faster.

### Step by Step

1. **Open a YouTube video**

   - The panel appears automatically in the bottom-left corner

2. **Add timestamps:**

   - Click "Add Timestamp" at the desired moment
   - Type a note in the text field
   - Repeat to add more timestamps

3. **Navigate through timestamps:**

   - Click on the time (e.g., 22:30) to jump to that moment

4. **Copy timestamps:**

   - **Individual:** Click the 📋 icon next to the timestamp
   - **Complete list:** Click "Copy Timestamps"

5. **Manage your list:**
   - Delete a single timestamp with the ⛔ icon
   - Past 3 timestamps, checkboxes appear: tick the ones you want gone and click
     "Delete Selected (N)". The checkbox in the header selects or clears them all.
   - Minimize the panel with the 🔽 button
   - Drag the panel out of the way by the ⠿ handle — it stays there for the next video

## ⚙️ Settings

Timestamps are saved automatically per video in the browser's `localStorage`, and
each one expires 30 days after it was created. Click ⚙️ in the panel header to
open the settings:

| Setting                                    | Default | What it does                                           |
| ------------------------------------------ | ------- | ------------------------------------------------------ |
| **Automatically clean expired timestamps** | Off     | Drops timestamps older than 30 days when a video loads |
| **Start widget minimized**                 | On      | Opens the panel collapsed, showing only the header     |

The settings also carry a **Reset widget position** button, which drops the saved
position and sends the panel back to the bottom-left corner. It acts on click —
no need to press Save.

Both settings are stored locally and persist across sessions, and so is the panel
position.

## 🎬 Saved videos

The settings modal has a second tab, **Videos**, listing every video that still
has timestamps saved — thumbnail, title and how many timestamps it holds, newest
first. The title opens the video in a new tab, and ⛔ wipes every timestamp of
that video after a confirmation.

Titles are captured the moment timestamps are saved, so a video saved before this
feature existed shows its video ID until you open it again and edit its
timestamps.

The tab lives inside the panel, so it is reachable from a video page (`/watch`,
`/live/`, `/shorts/`) — not from the YouTube home page.

### Supported Sites

- ✅ `youtube.com/watch` - Regular videos
- ✅ `youtube.com/live` - Lives and broadcasts
- ✅ `youtube.com/shorts` - YouTube Shorts
- ✅ `m.youtube.com` - YouTube Mobile
- ✅ `music.youtube.com` - YouTube Music

## 🔧 Development

### How the project is organized

The main file users install is `youtube-timestamp-manager.user.js` at the root. It's a single self-contained file that runs directly in the browser — no server, no backend.

Inside `src/` there's a modular version of the same code, split into smaller files to make development easier. Running `npm run build` bundles everything back into that root file, so `src/` and `youtube-timestamp-manager.user.js` should always be committed together — never edit the root file by hand.

```
youtube-timestamp-manager.user.js   ← what users install (single file)

src/
├── index.js            ← starting point: detects when you open/leave a YouTube video
├── state.js            ← keeps track of the current video and panel reference
├── lifecycle.js        ← creates or removes the panel when navigating between pages
├── ui.js               ← builds all the visible elements (panel, buttons, list)
├── handlers.js         ← responds to user actions (add, copy, delete timestamp)
├── drag.js             ← moves the panel around and keeps it inside the window
├── progressMarkers.js  ← places clickable markers on the YouTube progress bar
└── utils/
    ├── time.js         ← converts seconds to readable time (e.g. 1:23:45)
    ├── clipboard.js    ← handles copying text to clipboard
    ├── storage.js      ← saves and loads timestamps in the browser (localStorage)
    ├── notification.js ← shows brief success/error messages on screen
    ├── debounce.js     ← prevents actions from firing too many times at once
    └── video.js        ← finds the video element and reads the current video ID
```

**How they connect:** `index.js` starts everything. When you open a YouTube video, it calls `lifecycle.js` to mount the panel. `ui.js` builds the panel UI and wires up buttons to `handlers.js`. When you add a timestamp, `handlers.js` saves it via `storage.js` and tells `progressMarkers.js` to update the markers on the progress bar. `drag.js` owns where the panel sits: `ui.js` hands it the panel on mount and pings it whenever the panel's height changes, so it can keep the panel anchored to its nearest edge. When you leave the video, `lifecycle.js` removes everything and clears state.

### Building

```bash
npm install       # install dev dependencies (esbuild, vitest)
npm run build     # bundles src/ → youtube-timestamp-manager.user.js (repo root)
```

The `@version` line in the root file's userscript header is the single source of
truth for the version — `build.js` reads it back out on every build.

### Testing

```bash
npm test          # vitest + jsdom, single run
npm run test:watch
```

Every module under `src/` has a suite: helpers in `tests/utils/`, the rest in
`tests/*.test.js`.

### Contributing

1. Fork the repository
2. Create a branch for your feature (`git checkout -b feature/new-feature`)
3. Commit your changes (`git commit -am 'feat: describe the change'`)
4. Push to the branch (`git push origin feature/new-feature`)
5. Open a Pull Request

## 🐛 Troubleshooting

### Panel doesn't appear

- Check if Violentmonkey is active
- Confirm you're on a YouTube page
- Reload the page (F5 or CTRL+F5)

### Panel is somewhere awkward

- Drag it by the ⠿ handle in the header
- Or open ⚙️ and click "Reset widget position" to send it back to the
  bottom-left corner

### Copy button doesn't work

- Check browser clipboard permissions
- Test on an HTTPS tab
- Use Ctrl+V to verify if it was copied

### Incorrect timestamps

- Wait for the video to load completely
- Check if the video is not in live mode
- Reload the page if necessary

### Timestamps disappeared

- Timestamps expire 30 days after they were created
- If "Automatically clean expired timestamps" is on, they are dropped the next
  time you open the video
- They are stored in the browser's `localStorage`, so clearing site data or
  using a different browser/profile loses them

## 🌐 Languages

- [English](README.md)
- [Português](README.pt-BR.md)

## ⚠️ Disclaimer

This project is built on top of [ytlivestamper.js](https://github.com/Krazete/bookmarklets/blob/master/ytlivestamper.js) but has no relation to the original author.

## 🤝 Support

- 📧 **Issues:** [GitHub Issues](https://github.com/filipemanuelofs/youtube-timestamp-manager/issues)
- 💬 **Discussions:** [GitHub Discussions](https://github.com/filipemanuelofs/youtube-timestamp-manager/discussions)
- ⭐ **Rating:** If you liked it, leave a star on the repository!
