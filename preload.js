const { contextBridge, ipcRenderer } = require("electron");

// Bridge the real OS-level screen lock into the renderer. The web UI checks
// for `window.puzzleLock` and uses it when present; in a plain browser it
// falls back to the Fullscreen-API lock.
contextBridge.exposeInMainWorld("puzzleLock", {
  isDesktopApp: true,
  engage: () => ipcRenderer.invoke("lock:engage"),
  release: () => ipcRenderer.invoke("lock:release"),
  quit: () => ipcRenderer.invoke("app:quit"),
});
