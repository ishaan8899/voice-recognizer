# 🧩 Puzzle Royale

A daily puzzle competition: **whoever solves the most puzzles in a day wins a huge prize.**
While you solve a puzzle the screen **locks** — you either solve it or forfeit.

## How it works

- Enter your name to join.
- Hit **Lock In & Solve a Puzzle** — the screen goes fullscreen and locks. Page-leaving
  shortcuts (Esc, Ctrl/Cmd+W/T/N/R/L) and tab-close are blocked while a puzzle is active.
- Puzzles are randomly generated: mental math, number sequences, anagrams, and riddles.
- Solve correctly to score a point and unlock; or **Forfeit** to bail without scoring.
- The **leaderboard** ranks everyone by puzzles solved today. Scores reset each calendar day.
- The day's top solver who reaches the win threshold claims the **Grand Prize** 🏆.

## Run it

It's a static app — no build, no backend. Just open `index.html`, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Notes

- State is stored per-browser in `localStorage`, scoped by calendar day, so multiple
  players on the same device share one leaderboard.
- Fullscreen "lock" is enforced via the Fullscreen API plus keyboard/unload guards.
  Browsers can't make this escape-proof at the OS level, but it strongly discourages
  leaving the puzzle mid-solve.
