# YouTube Timestamp Manager

[![Version](https://img.shields.io/badge/version-1.2.0-blue.svg)](https://github.com/filipemanuelofs/youtube-timestamp-manager)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Userscript](https://img.shields.io/badge/userscript-violentmonkey-orange.svg)](https://violentmonkey.github.io/)

> 🎯 Create, manage and copy YouTube video timestamps with notes. Perfect for lectures, tutorials and live streams.

<img width="300" height="140" alt="image" src="https://github.com/user-attachments/assets/ad11e324-f8fb-485e-8a07-731ae50c03d9" />

## ✨ Features

- 📝 **Add timestamps** with custom notes
- 🔗 **Copy individual links** with specific timestamp
- 📋 **Copy complete list** of all timestamps
- 🗑️ **Delete unwanted timestamps**
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

The panel automatically appears in the bottom-left corner when you open a YouTube video:

### Panel Controls

| Button/Icon       | Function                             |
| ----------------- | ------------------------------------ |
| **−**             | Minimize/restore panel               |
| **×**             | Close panel (with confirmation)      |
| **📋**            | Copy individual timestamp            |
| **🗑️**            | Delete timestamp (with confirmation) |
| **Add Timestamp** | Add current video timestamp          |
| **Copy List**     | Copy all timestamps                  |

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
   - **Complete list:** Click "Copy List"

5. **Manage your list:**
   - Delete unwanted timestamps with the 🗑️ icon
   - Minimize the panel with the − button

## ⚙️ Settings

The userscript works automatically without requiring configuration. All preferences are saved locally during the session.

### Supported Sites

- ✅ `youtube.com/watch` - Regular videos
- ✅ `youtube.com/live` - Lives and broadcasts
- ✅ `youtube.com/shorts` - YouTube Shorts
- ✅ `m.youtube.com` - YouTube Mobile
- ✅ `music.youtube.com` - YouTube Music

## 🔧 Development

### How the project is organized

The main file users install is `youtube-timestamp-manager.user.js` at the root. It's a single self-contained file that runs directly in the browser — no server, no backend.

Inside `src/` there's a modular version of the same code, split into smaller files to make development easier. Running `npm run build` bundles everything back into one file in `dist/`.

```
youtube-timestamp-manager.user.js   ← what users install (single file)

src/
├── index.js            ← starting point: detects when you open/leave a YouTube video
├── state.js            ← keeps track of the current video and panel reference
├── lifecycle.js        ← creates or removes the panel when navigating between pages
├── ui.js               ← builds all the visible elements (panel, buttons, list)
├── handlers.js         ← responds to user actions (add, copy, delete timestamp)
├── progressMarkers.js  ← places clickable markers on the YouTube progress bar
└── utils/
    ├── time.js         ← converts seconds to readable time (e.g. 1:23:45)
    ├── clipboard.js    ← handles copying text to clipboard
    ├── storage.js      ← saves and loads timestamps in the browser (localStorage)
    ├── notification.js ← shows brief success/error messages on screen
    ├── debounce.js     ← prevents actions from firing too many times at once
    └── video.js        ← finds the video element and reads the current video ID
```

**How they connect:** `index.js` starts everything. When you open a YouTube video, it calls `lifecycle.js` to mount the panel. `ui.js` builds the panel UI and wires up buttons to `handlers.js`. When you add a timestamp, `handlers.js` saves it via `storage.js` and tells `progressMarkers.js` to update the markers on the progress bar. When you leave the video, `lifecycle.js` removes everything and clears state.

### Building

```bash
npm install       # install esbuild (only dev dependency)
npm run build     # bundles src/ → dist/youtube-timestamp-manager.user.js
```

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

### Copy button doesn't work

- Check browser clipboard permissions
- Test on an HTTPS tab
- Use Ctrl+V to verify if it was copied

### Incorrect timestamps

- Wait for the video to load completely
- Check if the video is not in live mode
- Reload the page if necessary

## 🌐 Em português

- [Português](README.md)

## ⚠️ Disclaimer

This project is built on top of [ytlivestamper.js](https://github.com/Krazete/bookmarklets/blob/master/ytlivestamper.js) but has no relation to the original author.

## 🤝 Support

- 📧 **Issues:** [GitHub Issues](https://github.com/filipemanuelofs/youtube-timestamp-manager/issues)
- 💬 **Discussions:** [GitHub Discussions](https://github.com/filipemanuelofs/youtube-timestamp-manager/discussions)
- ⭐ **Rating:** If you liked it, leave a star on the repository!
