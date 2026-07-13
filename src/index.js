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

const onNavigate = () => {
  const url = location.href;
  if (url !== state.currentUrl) {
    state.currentUrl = url;
    state.videoId = null;
    setTimeout(() => {
      if (shouldShowTimestampManager()) {
        initTimestampManager();
      } else {
        cleanupTimestampManager();
      }
    }, 100);
  }
};

const origPushState = history.pushState.bind(history);
history.pushState = function (...args) {
  origPushState(...args);
  onNavigate();
};

const origReplaceState = history.replaceState.bind(history);
history.replaceState = function (...args) {
  origReplaceState(...args);
  onNavigate();
};

window.addEventListener("popstate", onNavigate);
