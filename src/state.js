export const elements = { video: null, pane: null };

export const state = {
  nowid: null,
  videoId: null,
  currentUrl: location.href,
  // MutationObserver à espera do <video>, quando há um. Fica aqui porque quem
  // o desarma é o cleanup, não o próprio init que o criou.
  observer: null,
};
