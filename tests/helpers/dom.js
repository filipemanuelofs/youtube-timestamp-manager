import { elements, state } from "../../src/state.js";

/**
 * Builds the minimum pane skeleton that handlers/ui/progressMarkers query:
 * `#ytls-pane > ul > li.now-playing > a + input`.
 * @returns {HTMLDivElement} The pane element, already in document.body.
 */
export function createPane() {
  const pane = document.createElement("div");
  pane.id = "ytls-pane";

  const list = document.createElement("ul");
  const nowLi = document.createElement("li");
  nowLi.className = "now-playing";
  nowLi.appendChild(document.createElement("a"));
  nowLi.appendChild(document.createElement("input"));
  list.appendChild(nowLi);

  pane.appendChild(list);
  document.body.appendChild(pane);
  elements.pane = pane;
  return pane;
}

/**
 * Installs a fake video into `elements.video`, which is what `getVideo()` returns
 * once cached. jsdom's HTMLMediaElement has a read-only `duration`, so a plain
 * object is used instead.
 * @param {{currentTime?: number, duration?: number}} [props]
 * @returns {{currentTime: number, duration: number}} The fake video.
 */
export function stubVideo({ currentTime = 0, duration = 600 } = {}) {
  elements.video = { currentTime, duration };
  return elements.video;
}

/**
 * Installs a fake progress bar so `progressMarkers.createMarkersContainer()`
 * finds a mount point instead of retrying on a timer.
 * @returns {HTMLDivElement} The progress bar element.
 */
export function createProgressBar() {
  const bar = document.createElement("div");
  bar.className = "ytp-progress-bar-container";
  document.body.appendChild(bar);
  return bar;
}

/**
 * Points `getVideoId()` at a fixed id by seeding its cache.
 * @param {string} videoId
 */
export function stubVideoId(videoId) {
  state.videoId = videoId;
}

/** Clears DOM, module-level caches and localStorage between tests. */
export function resetEnvironment() {
  document.body.replaceChildren();
  elements.video = null;
  elements.pane = null;
  state.videoId = null;
  state.nowid = null;
  localStorage.clear();
}

/**
 * Reads the timestamp rows currently rendered in the pane.
 * @returns {Array<{time: string, note: string}>}
 */
export function readListItems() {
  return [...document.querySelectorAll("#ytls-pane ul li:not(.now-playing)")].map(
    (item) => ({
      time: item.querySelector("a").dataset.time,
      note: item.querySelector("input").value,
    }),
  );
}
