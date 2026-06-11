# 🧩 Puzzle Royale

A daily puzzle competition **desktop app** (Electron): whoever solves the most puzzles
in a day wins a huge prize. While you solve a puzzle the screen **truly locks** — the
window goes into kiosk/fullscreen mode, OS shortcuts (Alt+Tab, Alt+F4, Win, Ctrl+W/Q/R…)
are swallowed, and the window can't be closed until you solve it or forfeit.

## How it works

- Enter your name to join.
- Hit **Lock In & Solve a Puzzle** — the screen goes fullscreen and locks. Page-leaving
  shortcuts (Esc, Ctrl/Cmd+W/T/N/R/L) and tab-close are blocked while a puzzle is active.
- Puzzles are randomly generated: mental math, number sequences, anagrams, and riddles.
- Solve correctly to score a point and unlock; or **Forfeit** to bail without scoring.
- The **leaderboard** ranks everyone by puzzles solved today. Scores reset each calendar day.
- The day's top solver who reaches the win threshold claims the **Grand Prize** 🏆.

## Run it (desktop app)

```bash
npm install
npm start
```

This launches the Electron app. The same UI also runs as a plain web page (open
`index.html` in a browser) — there it falls back to a Fullscreen-API lock instead of
the real OS-level kiosk lock.

## How the lock works

- **Desktop (Electron):** `main.js` puts the window into kiosk + fullscreen, sets it
  always-on-top and unclosable, and registers the OS shortcut combos as no-ops via
  `globalShortcut` so they can't be used to escape. `preload.js` exposes this to the
  renderer as `window.puzzleLock`. (OS-reserved combos like Ctrl+Alt+Del can never be
  intercepted by any app — that's intentional at the OS level.)
- **Browser fallback:** Fullscreen API plus keyboard/`beforeunload` guards.

## Accounts

- **Sign up** with a username (2–20 chars) and password (min 4 chars), or **log in** to
  an existing account. Usernames are case-insensitive.
- Passwords are never stored in plaintext: each account gets a random 16-byte salt and
  the password is hashed with **PBKDF2-SHA256 (100k iterations)** via the Web Crypto API.
- Accounts live in this machine's `localStorage` (no server), and your session persists
  across restarts until you log out.

## Notes

- State is stored per-machine in `localStorage`, scoped by calendar day, so players on
  the same device share one leaderboard (resets each day).
- Fonts load from Google Fonts when online and fall back to system fonts offline.
