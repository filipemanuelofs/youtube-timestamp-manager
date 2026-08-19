import { elements, state } from "../../src/state.js";

/**
 * Builds the minimum pane skeleton that handlers/ui/progressMarkers query:
 * `#ytls-pane > .ytls-header > #ytts-drag-handle + #ytts-select-all`,
 * `#ytls-pane > ul >
 * li.now-playing > a + input` and `#ytls-pane > .ytls-buttons >
 * #ytls-delete-selected`.
 *
 * The selection controls are here so `ui.updateSelectionUI()` hits its real
 * branches instead of the "element missing" guard. They carry no listeners —
 * tests that need those call `ui.init()` instead.
 * @returns {HTMLDivElement} The pane element, already in document.body.
 */
export function createPane() {
  const pane = document.createElement("div");
  pane.id = "ytls-pane";

  const header = document.createElement("div");
  header.className = "ytls-header";
  const dragHandle = document.createElement("span");
  dragHandle.id = "ytts-drag-handle";
  dragHandle.textContent = "⠿";
  header.appendChild(dragHandle);
  const selectAllBox = document.createElement("input");
  selectAllBox.type = "checkbox";
  selectAllBox.id = "ytts-select-all";
  selectAllBox.style.display = "none";
  header.appendChild(selectAllBox);

  const list = document.createElement("ul");
  const nowLi = document.createElement("li");
  nowLi.className = "now-playing";
  nowLi.appendChild(document.createElement("a"));
  nowLi.appendChild(document.createElement("input"));
  list.appendChild(nowLi);

  const buttons = document.createElement("div");
  buttons.className = "ytls-buttons";
  const deleteSelectedBtn = document.createElement("button");
  deleteSelectedBtn.id = "ytls-delete-selected";
  deleteSelectedBtn.textContent = "Delete Selected (0)";
  deleteSelectedBtn.style.display = "none";
  buttons.appendChild(deleteSelectedBtn);

  pane.appendChild(header);
  pane.appendChild(list);
  pane.appendChild(buttons);
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
 * Points `getVideoId()` at a fixed id by seeding its cache, and stamps the pane
 * with it so `saveCurrentTimestamps` sees the two agreeing. `createPane()` runs
 * before this in the suites, so the stamp has to be applied from here.
 * @param {string} videoId
 */
export function stubVideoId(videoId) {
  state.videoId = videoId;
  if (elements.pane) {
    elements.pane.dataset.videoId = videoId;
  }
}

/**
 * Clears DOM, module-level caches and localStorage between tests. The observer
 * is disconnected, not just dropped: `initTimestampManager()` arms one whenever
 * the `<video>` is missing, and a live one would keep firing into the next test.
 */
export function resetEnvironment() {
  document.body.replaceChildren();
  elements.video = null;
  elements.pane = null;
  state.videoId = null;
  state.nowid = null;
  state.observer?.disconnect();
  state.observer = null;
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
      note: item.querySelector(".ytts-note").value,
    }),
  );
}
