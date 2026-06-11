/* Puzzle Royale — solve the most puzzles in a day, win the prize.
 * State persists in localStorage, scoped per calendar day. No backend.
 */

const PRIZE = "a brand-new gaming laptop 💻";
const WIN_THRESHOLD = 5; // solve this many in a day to claim the prize

const $ = (id) => document.getElementById(id);
const screens = {
  signin: $("signin"),
  lobby: $("lobby"),
  puzzle: $("puzzle"),
};

function show(name) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[name].classList.add("active");
}

/* ---------- persistence ---------- */
const todayKey = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

function loadDay() {
  const raw = localStorage.getItem("pr-scores-" + todayKey());
  return raw ? JSON.parse(raw) : {}; // { name: solvedCount }
}
function saveDay(scores) {
  localStorage.setItem("pr-scores-" + todayKey(), JSON.stringify(scores));
}

let player = localStorage.getItem("pr-player") || "";

/* ---------- puzzle generation ---------- */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];

function makePuzzle() {
  const kind = choice(["math", "sequence", "anagram", "riddle"]);
  switch (kind) {
    case "math": {
      const a = randInt(12, 99), b = randInt(12, 99);
      const op = choice(["+", "-", "×"]);
      const q = `${a} ${op} ${b} = ?`;
      const ans = op === "+" ? a + b : op === "-" ? a - b : a * b;
      return { kind: "Mental Math", question: q, answer: String(ans) };
    }
    case "sequence": {
      const start = randInt(1, 9), step = randInt(2, 6);
      const seq = [start, start + step, start + 2 * step, start + 3 * step];
      return {
        kind: "Find the next number",
        question: `${seq.join(", ")}, ?`,
        answer: String(start + 4 * step),
      };
    }
    case "anagram": {
      const words = ["puzzle", "winner", "prize", "locked", "genius", "victory", "champion", "riddle"];
      const w = choice(words);
      let scrambled = w;
      while (scrambled === w) {
        scrambled = w.split("").sort(() => Math.random() - 0.5).join("");
      }
      return {
        kind: "Unscramble the word",
        question: scrambled.toUpperCase(),
        answer: w,
      };
    }
    default: {
      const riddles = [
        { q: "I have keys but no locks, space but no room. What am I?", a: "keyboard" },
        { q: "What has hands but cannot clap?", a: "clock" },
        { q: "What gets wetter the more it dries?", a: "towel" },
        { q: "What has a head and a tail but no body?", a: "coin" },
        { q: "The more you take, the more you leave behind. What are they?", a: "footsteps" },
      ];
      const r = choice(riddles);
      return { kind: "Riddle", question: r.q, answer: r.a };
    }
  }
}

const norm = (s) => s.trim().toLowerCase().replace(/\s+/g, " ");

/* ---------- screen lock ---------- */
let locked = false;
let current = null;
let timerId = null;
let startTs = 0;

function tickTimer() {
  const s = Math.floor((Date.now() - startTs) / 1000);
  const m = Math.floor(s / 60);
  $("puzzle-timer").textContent = `${m}:${String(s % 60).padStart(2, "0")}`;
}

function beforeUnload(e) {
  if (locked) { e.preventDefault(); e.returnValue = ""; return ""; }
}
function blockKeys(e) {
  if (!locked) return;
  // Block common "escape the page" shortcuts while locked.
  const k = e.key.toLowerCase();
  if (k === "escape") { e.preventDefault(); }
  if ((e.ctrlKey || e.metaKey) && ["w", "t", "n", "r", "l"].includes(k)) {
    e.preventDefault();
  }
}

function lockScreen() {
  locked = true;
  document.documentElement.requestFullscreen?.().catch(() => {});
  window.addEventListener("beforeunload", beforeUnload);
  window.addEventListener("keydown", blockKeys, true);
  startTs = Date.now();
  tickTimer();
  timerId = setInterval(tickTimer, 1000);
}

function unlockScreen() {
  locked = false;
  clearInterval(timerId);
  window.removeEventListener("beforeunload", beforeUnload);
  window.removeEventListener("keydown", blockKeys, true);
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
}

/* ---------- puzzle flow ---------- */
function startPuzzle() {
  current = makePuzzle();
  $("puzzle-kind").textContent = current.kind;
  $("puzzle-question").textContent = current.question;
  $("answer-input").value = "";
  $("puzzle-feedback").textContent = "";
  $("puzzle-feedback").className = "feedback";
  show("puzzle");
  lockScreen();
  $("answer-input").focus();
}

function solvePuzzle() {
  const scores = loadDay();
  scores[player] = (scores[player] || 0) + 1;
  saveDay(scores);
  unlockScreen();
  show("lobby");
  renderLobby();
  if (scores[player] === WIN_THRESHOLD || isLeader(scores)) {
    maybeCelebrate(scores);
  }
}

function isLeader(scores) {
  const max = Math.max(...Object.values(scores));
  return scores[player] === max && Object.values(scores).filter((v) => v === max).length === 1;
}

function maybeCelebrate(scores) {
  if (scores[player] >= WIN_THRESHOLD && isLeader(scores)) {
    $("winner-text").textContent =
      `${player}, you're today's top solver with ${scores[player]} puzzles — you've won ${PRIZE}!`;
    $("winner-banner").classList.remove("hidden");
  }
}

/* ---------- rendering ---------- */
function renderLobby() {
  const scores = loadDay();
  const mine = scores[player] || 0;
  $("player-name").textContent = player;
  $("today-date").textContent = new Date().toLocaleDateString(undefined, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  $("my-solved").textContent = mine;

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const rank = sorted.findIndex(([n]) => n === player) + 1;
  $("my-rank").textContent = rank > 0 ? "#" + rank : "—";

  const list = $("leaderboard");
  list.innerHTML = "";
  if (sorted.length === 0) {
    list.innerHTML = `<li class="muted">No puzzles solved yet today — be the first!</li>`;
    return;
  }
  sorted.forEach(([name, count], i) => {
    const li = document.createElement("li");
    if (name === player) li.classList.add("me");
    if (i === 0) li.classList.add("leader");
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "";
    li.innerHTML = `<span class="rank">${medal || "#" + (i + 1)}</span>
      <span class="who">${escapeHtml(name)}</span>
      <span class="count">${count}</span>`;
    list.appendChild(li);
  });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- events ---------- */
$("signin-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("name-input").value.trim();
  if (!name) return;
  player = name;
  localStorage.setItem("pr-player", player);
  show("lobby");
  renderLobby();
});

$("logout-btn").addEventListener("click", () => {
  localStorage.removeItem("pr-player");
  player = "";
  show("signin");
  $("name-input").value = "";
});

$("start-puzzle-btn").addEventListener("click", startPuzzle);

$("answer-form").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!current) return;
  const guess = norm($("answer-input").value);
  if (!guess) return;
  if (guess === norm(current.answer)) {
    $("puzzle-feedback").textContent = "Correct! 🎉";
    $("puzzle-feedback").className = "feedback ok";
    setTimeout(solvePuzzle, 600);
  } else {
    $("puzzle-feedback").textContent = "Not quite — try again.";
    $("puzzle-feedback").className = "feedback bad";
    $("answer-input").select();
  }
});

$("forfeit-btn").addEventListener("click", () => {
  unlockScreen();
  current = null;
  show("lobby");
  renderLobby();
});

$("winner-close").addEventListener("click", () => {
  $("winner-banner").classList.add("hidden");
});

/* ---------- boot ---------- */
$("prize-name").textContent = PRIZE;
$("prize-name-2").textContent = PRIZE;
if (player) {
  show("lobby");
  renderLobby();
} else {
  show("signin");
}
