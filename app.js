/* Puzzle Royale — solve the most puzzles in a day, win the prize.
 * Runs as an Electron desktop app (real kiosk screen-lock via window.puzzleLock)
 * and degrades gracefully to a Fullscreen-API lock in a plain browser.
 * State persists in localStorage, scoped per calendar day. No backend.
 */

const PRIZE = "a brand-new gaming laptop 💻";
const WIN_THRESHOLD = 5; // solve this many (and lead) to claim the prize

const $ = (id) => document.getElementById(id);
const screens = { signin: $("signin"), lobby: $("lobby"), puzzle: $("puzzle") };

function show(name) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[name].classList.add("active");
}

/* ---------- persistence ---------- */
const todayKey = () => new Date().toISOString().slice(0, 10);
const loadDay = () => JSON.parse(localStorage.getItem("pr-scores-" + todayKey()) || "{}");
const saveDay = (s) => localStorage.setItem("pr-scores-" + todayKey(), JSON.stringify(s));

let player = localStorage.getItem("pr-player") || "";

/* ---------- accounts (local, salted + hashed passwords) ---------- */
const loadUsers = () => JSON.parse(localStorage.getItem("pr-users") || "{}");
const saveUsers = (u) => localStorage.setItem("pr-users", JSON.stringify(u));

function randomSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password, salt) {
  if (crypto.subtle) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: enc.encode(salt), iterations: 100000, hash: "SHA-256" },
      key, 256
    );
    return Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Insecure-context fallback (e.g. http:// LAN) — better than plaintext, not crypto-grade.
  let h = 0x811c9dc5;
  const s = salt + password + salt;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return "fnv-" + h.toString(16);
}

async function signUp(name, password) {
  const users = loadUsers();
  const key = name.toLowerCase();
  if (users[key]) throw new Error("That username is taken — log in instead.");
  if (password.length < 4) throw new Error("Password must be at least 4 characters.");
  const salt = randomSalt();
  users[key] = { name, salt, hash: await hashPassword(password, salt), createdAt: Date.now() };
  saveUsers(users);
  return users[key].name;
}

async function logIn(name, password) {
  const users = loadUsers();
  const u = users[name.toLowerCase()];
  if (!u) throw new Error("No account with that username — sign up first.");
  if ((await hashPassword(password, u.salt)) !== u.hash) throw new Error("Wrong password — try again.");
  return u.name;
}

/* ---------- helpers ---------- */
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const norm = (s) => s.trim().toLowerCase().replace(/\s+/g, " ");
const initials = (name) => name.trim().slice(0, 2).toUpperCase() || "?";
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- puzzle generation ---------- */
function makePuzzle() {
  const kind = choice(["math", "sequence", "anagram", "riddle"]);
  switch (kind) {
    case "math": {
      const a = randInt(12, 99), b = randInt(12, 99);
      const op = choice(["+", "-", "×"]);
      const ans = op === "+" ? a + b : op === "-" ? a - b : a * b;
      return { kind: "Mental Math", question: `${a} ${op} ${b} = ?`, answer: String(ans) };
    }
    case "sequence": {
      const start = randInt(1, 9), step = randInt(2, 6);
      const seq = [start, start + step, start + 2 * step, start + 3 * step];
      return { kind: "Find the next number", question: `${seq.join(", ")}, ?`, answer: String(start + 4 * step) };
    }
    case "anagram": {
      const words = ["puzzle", "winner", "prize", "locked", "genius", "victory", "champion", "riddle"];
      const w = choice(words);
      let scrambled = w;
      while (scrambled === w) scrambled = w.split("").sort(() => Math.random() - 0.5).join("");
      return { kind: "Unscramble the word", question: scrambled.toUpperCase(), answer: w };
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

/* ---------- screen lock (real on desktop, fullscreen fallback on web) ---------- */
const desktop = window.puzzleLock?.isDesktopApp ? window.puzzleLock : null;
let locked = false, current = null, timerId = null, startTs = 0;

function tickTimer() {
  const s = Math.floor((Date.now() - startTs) / 1000);
  $("puzzle-timer").textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function beforeUnload(e) { if (locked) { e.preventDefault(); e.returnValue = ""; return ""; } }
function blockKeys(e) {
  if (!locked) return;
  const k = e.key.toLowerCase();
  if (k === "escape") e.preventDefault();
  if ((e.ctrlKey || e.metaKey) && ["w", "t", "n", "r", "l"].includes(k)) e.preventDefault();
}

function lockScreen() {
  locked = true;
  if (desktop) desktop.engage();
  else document.documentElement.requestFullscreen?.().catch(() => {});
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
  if (desktop) desktop.release();
  else if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
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
  current = null;
  show("lobby");
  renderLobby();
  maybeCelebrate(scores);
}

const isLeader = (scores) => {
  const max = Math.max(...Object.values(scores));
  return scores[player] === max && Object.values(scores).filter((v) => v === max).length === 1;
};

let prizeClaimed = false;
function maybeCelebrate(scores) {
  if (prizeClaimed) return;
  if (scores[player] >= WIN_THRESHOLD && isLeader(scores)) {
    prizeClaimed = true;
    $("winner-text").textContent =
      `${player}, you're today's top solver with ${scores[player]} puzzles — you've won ${PRIZE}!`;
    $("winner-banner").classList.remove("hidden");
    launchConfetti();
  }
}

/* ---------- confetti ---------- */
function launchConfetti() {
  const layer = $("confetti");
  layer.innerHTML = "";
  const colors = ["#7c6cff", "#00e0c0", "#ff5ea8", "#ffd166", "#ffffff"];
  for (let i = 0; i < 120; i++) {
    const p = document.createElement("span");
    p.className = "confetti-piece";
    p.style.left = Math.random() * 100 + "%";
    p.style.background = colors[i % colors.length];
    p.style.animationDuration = 2.2 + Math.random() * 2 + "s";
    p.style.animationDelay = Math.random() * 0.6 + "s";
    p.style.transform = `rotate(${Math.random() * 360}deg)`;
    layer.appendChild(p);
  }
}

/* ---------- rendering ---------- */
function renderLobby() {
  const scores = loadDay();
  const mine = scores[player] || 0;
  $("player-name").textContent = player;
  $("player-avatar").textContent = initials(player);
  $("today-date").textContent = new Date().toLocaleDateString(undefined, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  $("my-solved").textContent = mine;

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const rank = sorted.findIndex(([n]) => n === player) + 1;
  $("my-rank").textContent = rank > 0 ? "#" + rank : "—";

  const pct = Math.min(100, (mine / WIN_THRESHOLD) * 100);
  $("progress-fill").style.width = pct + "%";
  $("progress-label").textContent = `${Math.min(mine, WIN_THRESHOLD)} / ${WIN_THRESHOLD}`;
  $("progress-hint").textContent =
    mine >= WIN_THRESHOLD
      ? (isLeader(scores) ? "You've hit the target and you're leading — prize is yours! 🏆" : "Target hit! Stay in the lead to keep the prize.")
      : `Solve ${WIN_THRESHOLD - mine} more and lead the board to win.`;

  const list = $("leaderboard");
  list.innerHTML = "";
  if (sorted.length === 0) {
    list.innerHTML = `<li class="empty">No puzzles solved yet today — be the first! 🚀</li>`;
    return;
  }
  sorted.forEach(([name, count], i) => {
    const li = document.createElement("li");
    if (name === player) li.classList.add("me");
    if (i === 0) li.classList.add("leader");
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "#" + (i + 1);
    li.innerHTML =
      `<span class="rank">${medal}</span>
       <span class="avatar sm">${escapeHtml(initials(name))}</span>
       <span class="who">${escapeHtml(name)}${name === player ? '<span class="tag">YOU</span>' : ""}</span>
       <span class="count">${count}</span>`;
    list.appendChild(li);
  });
}

/* ---------- events ---------- */
let authMode = "login";
function setAuthMode(mode) {
  authMode = mode;
  $("tab-login").classList.toggle("active", mode === "login");
  $("tab-signup").classList.toggle("active", mode === "signup");
  $("password-confirm").classList.toggle("hidden", mode === "login");
  $("password-input").autocomplete = mode === "login" ? "current-password" : "new-password";
  $("auth-submit").textContent = mode === "login" ? "Log in →" : "Create account →";
  $("auth-error").textContent = "";
}
$("tab-login").addEventListener("click", () => setAuthMode("login"));
$("tab-signup").addEventListener("click", () => setAuthMode("signup"));

$("auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("name-input").value.trim();
  const password = $("password-input").value;
  $("auth-error").textContent = "";
  if (!name || !password) return;
  try {
    if (authMode === "signup") {
      if (!/^[\w .-]{2,20}$/.test(name)) throw new Error("Username: 2–20 letters, numbers, spaces, . _ -");
      if (password !== $("password-confirm").value) throw new Error("Passwords don't match.");
      player = await signUp(name, password);
    } else {
      player = await logIn(name, password);
    }
    localStorage.setItem("pr-player", player);
    prizeClaimed = false;
    $("password-input").value = "";
    $("password-confirm").value = "";
    show("lobby");
    renderLobby();
  } catch (err) {
    $("auth-error").textContent = err.message;
  }
});

$("logout-btn").addEventListener("click", () => {
  localStorage.removeItem("pr-player");
  player = "";
  $("name-input").value = "";
  $("password-input").value = "";
  $("password-confirm").value = "";
  setAuthMode("login");
  show("signin");
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
    setTimeout(solvePuzzle, 550);
  } else {
    $("puzzle-feedback").textContent = "Not quite — try again.";
    $("puzzle-feedback").className = "feedback bad";
    const inp = $("answer-input");
    inp.classList.remove("shake");
    void inp.offsetWidth; // restart animation
    inp.classList.add("shake");
    inp.select();
  }
});

$("forfeit-btn").addEventListener("click", () => {
  unlockScreen();
  current = null;
  show("lobby");
  renderLobby();
});

$("winner-close").addEventListener("click", () => $("winner-banner").classList.add("hidden"));

/* ---------- boot ---------- */
$("prize-name").textContent = PRIZE;
$("prize-name-2").textContent = PRIZE;
setAuthMode("login");
// Restore the session only if the remembered player still has an account.
if (player && loadUsers()[player.toLowerCase()]) { show("lobby"); renderLobby(); }
else { player = ""; show("signin"); }
