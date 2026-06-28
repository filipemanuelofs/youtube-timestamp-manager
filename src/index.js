import { state } from "./state.js";
import {
  shouldShowTimestampManager,
  initTimestampManager,
  cleanupTimestampManager,
} from "./lifecycle.js";

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTimestampManager);
} else {
  initTimestampManager();
}

let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    state.videoId = null;
    setTimeout(() => {
      if (shouldShowTimestampManager()) {
        initTimestampManager();
      } else {
        cleanupTimestampManager();
      }
    }, 100);
  }
}).observe(document, { subtree: true, childList: true });

window.addEventListener("popstate", () => {
  setTimeout(() => {
    if (shouldShowTimestampManager()) {
      initTimestampManager();
    } else {
      cleanupTimestampManager();
    }
  }, 100);
});
