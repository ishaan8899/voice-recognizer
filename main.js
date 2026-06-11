const { app, BrowserWindow, ipcMain, globalShortcut } = require("electron");
const path = require("path");

let win = null;
let locked = false;

// Shortcuts we swallow while a puzzle is in progress so the player can't
// tab/alt away or close the window. (OS-reserved combos like Ctrl+Alt+Del
// can never be intercepted — that's by design at the OS level.)
const LOCK_SHORTCUTS = [
  "Alt+Tab", "Alt+F4", "Super", "Super+D", "Super+Tab",
  "CommandOrControl+W", "CommandOrControl+Q", "CommandOrControl+R",
  "CommandOrControl+M", "CommandOrControl+H", "F11", "Escape",
];

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 480,
    minHeight: 600,
    backgroundColor: "#0f1226",
    title: "Puzzle Royale",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile("index.html");
  win.once("ready-to-show", () => win.show());

  // Block any close attempt while a puzzle is locked.
  win.on("close", (e) => {
    if (locked) e.preventDefault();
  });

  win.on("closed", () => { win = null; });
}

function engageLock() {
  if (!win) return;
  locked = true;
  win.setKiosk(true);
  win.setFullScreen(true);
  win.setAlwaysOnTop(true, "screen-saver");
  win.setClosable(false);
  win.setMinimizable(false);
  win.focus();
  for (const accel of LOCK_SHORTCUTS) {
    try { globalShortcut.register(accel, () => {}); } catch { /* combo not registrable on this OS */ }
  }
}

function releaseLock() {
  if (!win) return;
  locked = false;
  globalShortcut.unregisterAll();
  win.setAlwaysOnTop(false);
  win.setClosable(true);
  win.setMinimizable(true);
  win.setKiosk(false);
  win.setFullScreen(false);
}

ipcMain.handle("lock:engage", () => { engageLock(); return true; });
ipcMain.handle("lock:release", () => { releaseLock(); return true; });
ipcMain.handle("app:quit", () => { if (!locked) app.quit(); });

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
