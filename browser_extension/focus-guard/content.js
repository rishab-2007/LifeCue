(() => {
    console.log("LifeCue Focus Guard content.js loaded!");
  const allowedOrigins = new Set([
    "http://localhost:5173",
    "http://127.0.0.1:5173"
  ]);

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (!allowedOrigins.has(event.origin)) return;

    const request = event.data;

    if (!request || request.source !== "LIFECUE_WEBSITE") {
      return;
    }

    const allowedTypes = new Set([
      "GET_STATE",
      "START_SESSION",
      "STOP_SESSION"
    ]);

    if (!allowedTypes.has(request.type)) return;

    chrome.runtime.sendMessage(
      request,
      (response) => {
        const error = chrome.runtime.lastError;

        window.postMessage(
          {
            source: "LIFECUE_EXTENSION",
            requestId: request.requestId,
            response: error
              ? { ok: false, error: error.message }
              : { ok: true, data: response }
          },
          event.origin
        );
      }
    );
  });
})();