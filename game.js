const socket = io();

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
canvas.width = 900;
canvas.height = 600;

const GRAVITY = 0.22;

const fruitTypes = [
  { name: "watermelon", color: "#2e8b57", inner: "#ff4757", radius: 38, points: 1 },
  { name: "apple", color: "#c0392b", inner: "#fff5e1", radius: 28, points: 1 },
  { name: "orange", color: "#e67e22", inner: "#fdcb6e", radius: 26, points: 1 },
  { name: "banana", color: "#f1c40f", inner: "#fdf3d0", radius: 30, points: 2 },
];

const game = {
  phase: "idle",
  score: 0,
  fruits: [],
  particles: [],
  halves: [],
  shockwaves: [],
  slices: [],
  spawnTimer: 0,
  startsAt: 0,
  endsAt: 0,
  lastEmit: 0,
  lastCountdown: 0,
  mouse: { x: 0, y: 0, px: 0, py: 0, active: false },
};

let currentUser = null;
let roomInfo = null;
let liveScores = [];

const screens = {
  auth: document.getElementById("auth-screen"),
  lobby: document.getElementById("lobby-screen"),
  room: document.getElementById("room-screen"),
  game: document.getElementById("game-screen"),
  result: document.getElementById("result-screen"),
};

const el = {
  tabLogin: document.getElementById("tab-login"),
  tabRegister: document.getElementById("tab-register"),
  authForm: document.getElementById("auth-form"),
  authUsername: document.getElementById("auth-username"),
  authPassword: document.getElementById("auth-password"),
  authPassword2: document.getElementById("auth-password2"),
  authMsg: document.getElementById("auth-msg"),
  authSubmit: document.getElementById("auth-submit"),
  authMusicBtn: document.getElementById("auth-music-btn"),
  lobbyUsername: document.getElementById("lobby-username"),
  lobbyBest: document.getElementById("lobby-best"),
  lobbyMsg: document.getElementById("lobby-msg"),
  musicToggle: document.getElementById("music-toggle"),
  sfxToggle: document.getElementById("sfx-toggle"),
  logoutBtn: document.getElementById("logout-btn"),
  createRoomBtn: document.getElementById("create-room-btn"),
  roomCodeInput: document.getElementById("room-code-input"),
  joinRoomBtn: document.getElementById("join-room-btn"),
  leaderboardBody: document.getElementById("leaderboard-body"),
  roleBadge: document.getElementById("role-badge"),
  createHint: document.getElementById("create-hint"),
  adminPanel: document.getElementById("admin-panel"),
  adminUsername: document.getElementById("admin-username"),
  adminAddBtn: document.getElementById("admin-add-btn"),
  adminRemoveBtn: document.getElementById("admin-remove-btn"),
  adminList: document.getElementById("admin-list"),
  adminMsg: document.getElementById("admin-msg"),
  roomCodeLabel: document.getElementById("room-code-label"),
  roomAdmin: document.getElementById("room-admin"),
  roomStatus: document.getElementById("room-status"),
  roomPlayers: document.getElementById("room-players"),
  startMatchBtn: document.getElementById("start-match-btn"),
  waitAdminBtn: document.getElementById("wait-admin-btn"),
  deleteRoomBtn: document.getElementById("delete-room-btn"),
  leaveRoomBtn: document.getElementById("leave-room-btn"),
  countdownEl: document.getElementById("countdown-el"),
  gameTimer: document.getElementById("game-timer"),
  gameScore: document.getElementById("game-score"),
  liveRanks: document.getElementById("live-ranks"),
  resultRanking: document.getElementById("result-ranking"),
  backToRoomBtn: document.getElementById("back-to-room-btn"),
  backToLobbyBtn: document.getElementById("back-to-lobby-btn"),
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function showScreen(name) {
  for (const [key, s] of Object.entries(screens)) {
    s.classList.toggle("active", key === name);
  }
}

let authMode = "login";

function setAuthMode(mode) {
  authMode = mode;
  el.tabLogin.classList.toggle("active", mode === "login");
  el.tabRegister.classList.toggle("active", mode === "register");
  el.authPassword2.classList.toggle("hidden", mode === "login");
  el.authPassword2.required = mode === "register";
  el.authSubmit.textContent = mode === "login" ? "登 录" : "注 册";
  el.authMsg.textContent = "";
}

el.tabLogin.addEventListener("click", () => setAuthMode("login"));
el.tabRegister.addEventListener("click", () => setAuthMode("register"));

el.authForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const username = el.authUsername.value.trim();
  const password = el.authPassword.value;
  if (authMode === "register" && password !== el.authPassword2.value) {
    el.authMsg.textContent = "两次输入的密码不一致";
    return;
  }
  socket.emit(authMode === "login" ? "login" : "register", { username, password }, (res) => {
    if (!res.ok) {
      el.authMsg.textContent = res.error || "操作失败";
      return;
    }
    completeAuth(res);
  });
});

function completeAuth(res) {
  currentUser = { username: res.username, token: res.token, bestScore: res.bestScore || 0, role: res.role || "user" };
  localStorage.setItem("fn-token", res.token);
  localStorage.setItem("fn-username", res.username);
  renderLobbyHeader();
  renderRoleUI();
  refreshLeaderboard();
  showScreen("lobby");
}

function renderLobbyHeader() {
  el.lobbyUsername.textContent = currentUser.username;
  el.lobbyBest.textContent = currentUser.bestScore;
}

function isAdmin() {
  return currentUser && (currentUser.role === "admin" || currentUser.role === "superadmin");
}

function renderRoleUI() {
  const roleText = currentUser.role === "superadmin" ? "🛡️ 超级管理员" : currentUser.role === "admin" ? "🛡️ 管理员" : "";
  el.roleBadge.textContent = roleText;
  el.roleBadge.classList.toggle("hidden", !roleText);
  const canCreate = isAdmin();
  el.createRoomBtn.classList.toggle("hidden", !canCreate);
  el.createHint.classList.toggle("hidden", canCreate);
  el.adminPanel.classList.toggle("hidden", currentUser.role !== "superadmin");
  if (currentUser.role === "superadmin") refreshAdminList();
}

function refreshAdminList() {
  socket.emit("getAdmins", { token: currentUser.token }, (res) => {
    if (!res || !res.ok) return;
    el.adminList.innerHTML = "";
    res.list.forEach((u) => {
      const li = document.createElement("li");
      li.textContent = (u.role === "superadmin" ? "🛡️ " : "🛡️ ") + u.username + (u.role === "superadmin" ? " (超级)" : " (管理员)");
      el.adminList.appendChild(li);
    });
  });
}

el.adminAddBtn.addEventListener("click", () => {
  const username = el.adminUsername.value.trim();
  if (!username) return;
  socket.emit("setAdmin", { token: currentUser.token, username, makeAdmin: true }, (res) => {
    el.adminMsg.textContent = res.ok ? `已将 ${username} 设为管理员` : res.error || "操作失败";
    if (res.ok) { el.adminUsername.value = ""; refreshAdminList(); }
  });
});

el.adminRemoveBtn.addEventListener("click", () => {
  const username = el.adminUsername.value.trim();
  if (!username) return;
  socket.emit("setAdmin", { token: currentUser.token, username, makeAdmin: false }, (res) => {
    el.adminMsg.textContent = res.ok ? `已取消 ${username} 的管理员权限` : res.error || "操作失败";
    if (res.ok) { el.adminUsername.value = ""; refreshAdminList(); }
  });
});

function refreshLeaderboard() {
  socket.emit("getLeaderboard", (res) => {
    if (!res.ok) return;
    el.leaderboardBody.innerHTML = "";
    res.list.forEach((u, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${i + 1}</td><td>${escapeHtml(u.username)}</td><td>${u.bestScore}</td>`;
      if (u.username === currentUser.username) tr.style.fontWeight = "bold";
      el.leaderboardBody.appendChild(tr);
    });
  });
}

el.createRoomBtn.addEventListener("click", () => {
  socket.emit("createRoom", { token: currentUser.token }, (res) => {
    if (!res.ok) {
      el.lobbyMsg.textContent = res.error || "创建失败";
      return;
    }
    el.lobbyMsg.textContent = "";
    roomInfo = res.room;
    renderRoom();
    showScreen("room");
  });
});

el.joinRoomBtn.addEventListener("click", () => {
  const code = el.roomCodeInput.value.trim().toUpperCase();
  if (!code) return;
  socket.emit("joinRoom", { token: currentUser.token, code }, (res) => {
    if (!res.ok) {
      el.lobbyMsg.textContent = res.error || "加入失败";
      return;
    }
    el.lobbyMsg.textContent = "";
    el.roomCodeInput.value = "";
    roomInfo = res.room;
    renderRoom();
    showScreen("room");
  });
});

function renderRoom() {
  if (!roomInfo) return;
  el.roomCodeLabel.textContent = roomInfo.code;
  el.roomAdmin.textContent = "主持人: " + (roomInfo.admin || roomInfo.owner || "-");
  el.roomStatus.textContent =
    roomInfo.status === "playing"
      ? `🔴 比赛进行中... (${roomInfo.players.length}/${roomInfo.maxPlayers}人)`
      : `🟢 等待玩家... (${roomInfo.players.length}/${roomInfo.maxPlayers}人)`;
  el.roomPlayers.innerHTML = "";
  roomInfo.players.forEach((p) => {
    const li = document.createElement("li");
    const isHost = roomInfo.admin && p.username === roomInfo.admin;
    li.textContent = (isHost ? "👑 " : roomInfo.owner === p.username ? "🎙️ " : "👤 ") + p.username;
    el.roomPlayers.appendChild(li);
  });
  const isHostAdmin = isAdmin();
  const waiting = roomInfo.status === "waiting";
  el.startMatchBtn.classList.toggle("hidden", !isHostAdmin || !waiting);
  el.startMatchBtn.disabled = !waiting;
  el.startMatchBtn.textContent = roomInfo.players.length === 1 ? "🚀 开始比赛 (单人练习, 60秒)" : "🚀 开始比赛 (60秒)";
  el.waitAdminBtn.classList.toggle("hidden", isHostAdmin || !waiting);
  el.deleteRoomBtn.classList.toggle("hidden", !isHostAdmin);
  el.deleteRoomBtn.disabled = !waiting;
}

el.deleteRoomBtn.addEventListener("click", () => {
  if (!confirm("确定关闭该房间吗？所有玩家将被移出。")) return;
  socket.emit("deleteRoom", { token: currentUser.token, code: roomInfo.code }, (res) => {
    if (res && !res.ok) alert(res.error || "关闭失败");
  });
});

socket.on("roomClosed", () => {
  roomInfo = null;
  hideToast();
  refreshLeaderboard();
  showScreen("lobby");
});

el.startMatchBtn.addEventListener("click", () => {
  el.startMatchBtn.disabled = true;
  socket.emit("startMatch", { token: currentUser.token }, (res) => {
    if (res && !res.ok) {
      alert(res.error || "无法开始比赛");
      el.startMatchBtn.disabled = false;
    }
  });
});

el.leaveRoomBtn.addEventListener("click", () => {
  socket.emit("leaveRoom");
  roomInfo = null;
  refreshLeaderboard();
  showScreen("lobby");
});

el.backToRoomBtn.addEventListener("click", () => {
  showScreen("room");
  renderRoom();
});

el.backToLobbyBtn.addEventListener("click", () => {
  socket.emit("leaveRoom");
  roomInfo = null;
  refreshLeaderboard();
  showScreen("lobby");
});

el.logoutBtn.addEventListener("click", () => {
  currentUser = null;
  roomInfo = null;
  localStorage.removeItem("fn-token");
  localStorage.removeItem("fn-username");
  socket.emit("leaveRoom");
  el.authForm.reset();
  setAuthMode("login");
  showScreen("auth");
});

socket.on("roomUpdate", (room) => {
  roomInfo = room;
  if (screens.room.classList.contains("active")) renderRoom();
});

socket.on("matchStart", ({ startsAt, endsAt }) => {
  AudioMan.playGo();
  resetGame();
  game.phase = "countdown";
  game.startsAt = startsAt;
  game.endsAt = endsAt;
  game.lastCountdown = 0;
  el.countdownEl.classList.remove("hidden");
  el.countdownEl.textContent = "3";
  showScreen("game");
});

socket.on("liveScores", ({ scores }) => {
  liveScores = scores;
  renderLiveScores();
});

socket.on("matchEnd", ({ ranking }) => {
  game.phase = "idle";
  game.mouse.active = false;
  renderResults(ranking);
  showScreen("result");
});

let reconnecting = false;

socket.on("disconnect", () => {
  if (!currentUser) return;
  reconnecting = true;
  showToast("连接已断开，正在重连...");
});

socket.on("connect", () => {
  if (!reconnecting) return;
  reconnecting = false;
  const token = localStorage.getItem("fn-token");
  socket.emit("loginWithToken", { token }, (res) => {
    if (!res || !res.ok) {
      currentUser = null;
      roomInfo = null;
      localStorage.removeItem("fn-token");
      localStorage.removeItem("fn-username");
      hideToast();
      setAuthMode("login");
      showScreen("auth");
      el.authMsg.textContent = "服务器已重启，请重新登录";
      return;
    }
    completeAuth(res);
    if (roomInfo && roomInfo.code) {
      socket.emit("joinRoom", { token: res.token, code: roomInfo.code }, (jr) => {
        if (jr && jr.ok) {
          roomInfo = jr.room;
          hideToast();
          if (screens.room.classList.contains("active")) renderRoom();
          else showScreen("room");
        } else {
          roomInfo = null;
          hideToast();
          el.lobbyMsg.textContent = "已重新连接（原房间已失效）";
          showScreen("lobby");
        }
      });
    } else {
      hideToast();
      showScreen("lobby");
    }
  });
});

function showToast(msg) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.remove("hidden");
}

function hideToast() {
  const t = document.getElementById("toast");
  if (t) t.classList.add("hidden");
}

function renderLiveScores() {
  const medals = ["🥇", "🥈", "🥉"];
  el.liveRanks.innerHTML = "";
  liveScores.forEach((p, i) => {
    const li = document.createElement("li");
    const mark = i < 3 ? medals[i] : (i + 1) + ".";
    li.innerHTML = `<span>${mark} ${escapeHtml(p.username)}</span><b>${p.score}</b>`;
    if (p.username === currentUser.username) li.classList.add("me");
    el.liveRanks.appendChild(li);
  });
}

function renderResults(ranking) {
  const medals = ["🥇", "🥈", "🥉"];
  el.resultRanking.innerHTML = "";
  ranking.forEach((p, i) => {
    const li = document.createElement("li");
    const mark = i < 3 ? medals[i] : (i + 1) + ".";
    li.innerHTML = `<span>${mark} ${escapeHtml(p.username)}</span><b>${p.score} 分</b>`;
    if (p.username === currentUser.username) li.classList.add("me");
    el.resultRanking.appendChild(li);
  });
}

function updateAudioButtons() {
  const musicLabel = "🎵 音乐: " + (AudioMan.musicOn ? "开" : "关");
  const sfxLabel = "🔊 音效: " + (AudioMan.sfxOn ? "开" : "关");
  el.musicToggle.textContent = musicLabel;
  el.authMusicBtn.textContent = musicLabel;
  el.sfxToggle.textContent = sfxLabel;
}

el.musicToggle.addEventListener("click", () => {
  AudioMan.setMusic(!AudioMan.musicOn);
  updateAudioButtons();
});

el.sfxToggle.addEventListener("click", () => {
  AudioMan.setSfx(!AudioMan.sfxOn);
  updateAudioButtons();
});

el.authMusicBtn.addEventListener("click", () => {
  AudioMan.setMusic(!AudioMan.musicOn);
  updateAudioButtons();
});

document.addEventListener("click", (e) => {
  if (e.target.closest("button")) AudioMan.playClick();
}, true);

document.addEventListener("click", function initAudio() {
  AudioMan.ensure();
  AudioMan.startMusic();
  document.removeEventListener("click", initAudio);
});

function getCanvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * canvas.width,
    y: ((e.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function spawnFruit() {
  const isBomb = Math.random() < 0.16;
  const x = 80 + Math.random() * (canvas.width - 160);
  const vx = (Math.random() - 0.5) * 6;
  const vy = -(11 + Math.random() * 7);
  if (isBomb) {
    game.fruits.push({
      type: null,
      bomb: true,
      x,
      y: canvas.height + 50,
      vx,
      vy,
      radius: 30,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.1,
      sliced: false,
    });
  } else {
    const type = fruitTypes[Math.floor(Math.random() * fruitTypes.length)];
    game.fruits.push({
      type,
      bomb: false,
      x,
      y: canvas.height + 50,
      vx,
      vy,
      radius: type.radius,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.1,
      sliced: false,
    });
  }
}

function spawnParticles(fruit, juiceColor) {
  const color = fruit.bomb ? "#2d3436" : juiceColor;
  for (let i = 0; i < 16; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2.5 + Math.random() * 6;
    game.particles.push({
      x: fruit.x,
      y: fruit.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      life: 1,
      r: 2 + Math.random() * 4,
      color,
    });
  }
}

function spawnHalves(fruit, sliceAngle) {
  const perp = sliceAngle + Math.PI / 2;
  const jx = Math.cos(perp);
  const jy = Math.sin(perp);
  const data = fruit.bomb
    ? { color: "#2d3436", inner: "#555555" }
    : { color: fruit.type.color, inner: fruit.type.inner };
  for (let side = -1; side <= 1; side += 2) {
    game.halves.push({
      x: fruit.x + jx * side * 8,
      y: fruit.y + jy * side * 8,
      vx: fruit.vx * 0.5 + jx * side * (2.5 + Math.random() * 2.5) + (Math.random() - 0.5) * 2,
      vy: fruit.vy * 0.5 + (Math.random() - 0.5) * 3,
      rotation: sliceAngle + (side > 0 ? 0 : Math.PI),
      rotSpeed: (Math.random() - 0.5) * 0.18,
      r: fruit.radius,
      color: data.color,
      inner: data.inner,
      life: 1,
    });
  }
}

function spawnExplosion(fruit) {
  const colors = ["#ff4757", "#ff6b81", "#ffa502", "#ffd32a", "#2d3436", "#dfe6e9"];
  for (let i = 0; i < 30; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 3 + Math.random() * 7;
    game.particles.push({
      x: fruit.x,
      y: fruit.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      life: 1,
      r: 2 + Math.random() * 5,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }
  game.shockwaves.push({ x: fruit.x, y: fruit.y, radius: 8, maxRadius: 100, life: 1 });
}

function sliceFruit(fruit, sliceAngle) {
  if (fruit.sliced) return;
  fruit.sliced = true;
  const angle = sliceAngle || 0;
  if (fruit.bomb) {
    spawnHalves(fruit, angle);
    spawnExplosion(fruit);
    AudioMan.playBomb();
    game.score = Math.max(0, game.score - 3);
  } else {
    spawnHalves(fruit, angle);
    spawnParticles(fruit, fruit.type.inner);
    AudioMan.playSplat();
    game.score += fruit.type.points;
  }
  el.gameScore.textContent = "得分: " + game.score;
}

function segmentCircleHit(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return Math.hypot(cx - x1, cy - y1) <= r;
  }
  let t = ((cx - x1) * dx + (cy - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const px = x1 + t * dx;
  const py = y1 + t * dy;
  return Math.hypot(cx - px, cy - py) <= r;
}

function checkSlices() {
  const { px, py, x, y, active } = game.mouse;
  if (!active || (px === x && py === y)) return;
  const sliceAngle = Math.atan2(y - py, x - px);
  for (const fruit of game.fruits) {
    if (fruit.sliced || fruit.y < -60) continue;
    if (segmentCircleHit(px, py, x, y, fruit.x, fruit.y, fruit.radius)) {
      sliceFruit(fruit, sliceAngle);
    }
  }
}

function drawFruit(fruit) {
  ctx.save();
  ctx.translate(fruit.x, fruit.y);
  ctx.rotate(fruit.rotation);
  if (fruit.bomb) {
    const g = ctx.createRadialGradient(-6, -6, 4, 0, 0, fruit.radius);
    g.addColorStop(0, "#636e72");
    g.addColorStop(1, "#2d3436");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, fruit.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fdcb6e";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -fruit.radius);
    ctx.lineTo(6, -fruit.radius - 12);
    ctx.stroke();
    ctx.fillStyle = "#ff7675";
    ctx.beginPath();
    ctx.arc(6, -fruit.radius - 16, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (fruit.type.name === "banana") {
    ctx.fillStyle = fruit.type.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, fruit.radius, fruit.radius * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#e1b12c";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 4, fruit.radius * 0.4, fruit.radius * 0.18, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#fdf3d0";
    ctx.fill();
  } else {
    const g = ctx.createRadialGradient(-8, -8, 5, 0, 0, fruit.radius);
    g.addColorStop(0, fruit.type.inner);
    g.addColorStop(1, fruit.type.color);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, fruit.radius, 0, Math.PI * 2);
    ctx.fill();
    if (fruit.type.name === "watermelon") {
      ctx.strokeStyle = "#1e6b3a";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, fruit.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "#4caf50";
    ctx.fillRect(-3, -fruit.radius - 8, 6, 10);
  }
  ctx.restore();
}

function drawSliceTrail() {
  if (game.slices.length < 2) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const s of game.slices) {
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 5;
    ctx.stroke();
  }
  ctx.restore();
}

function drawHalf(h) {
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(h.rotation);
  ctx.globalAlpha = Math.max(0, h.life);
  ctx.fillStyle = h.color;
  ctx.beginPath();
  ctx.arc(0, 0, h.r, 0, Math.PI);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = h.inner;
  ctx.beginPath();
  ctx.arc(0, 0, h.r * 0.8, 0, Math.PI);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawShockwave(w) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, w.life);
  ctx.strokeStyle = "#ffa502";
  ctx.lineWidth = 5 * w.life;
  ctx.beginPath();
  ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function resetGame() {
  game.score = 0;
  game.fruits = [];
  game.particles = [];
  game.halves = [];
  game.shockwaves = [];
  game.slices = [];
  game.spawnTimer = 0;
  game.lastEmit = 0;
  el.gameScore.textContent = "得分: 0";
  el.gameTimer.textContent = "60s";
  liveScores = [];
  renderLiveScores();
}

function update(dt) {
  const now = Date.now();

  if (game.phase === "countdown") {
    const remain = Math.ceil((game.startsAt - now) / 1000);
    el.countdownEl.textContent = remain > 0 ? remain : "GO!";
    if (remain !== game.lastCountdown) {
      game.lastCountdown = remain;
      if (remain > 0) AudioMan.playCountdown();
      else AudioMan.playGo();
    }
    if (now >= game.startsAt) {
      game.phase = "playing";
      el.countdownEl.classList.add("hidden");
      game.lastEmit = now;
      socket.emit("scoreUpdate", { token: currentUser.token, score: 0 });
    }
    return;
  }

  if (game.phase === "playing") {
    const remaining = Math.max(0, game.endsAt - now);
    el.gameTimer.textContent = Math.ceil(remaining / 1000) + "s";
    if (remaining <= 0) {
      game.phase = "finished";
      game.mouse.active = false;
      el.countdownEl.textContent = "等待结果...";
      el.countdownEl.classList.remove("hidden");
      socket.emit("scoreUpdate", { token: currentUser.token, score: game.score });
      return;
    }

    game.spawnTimer += dt;
    const elapsed = now - game.startsAt;
    const spawnInterval = Math.max(450, 1100 - elapsed / 200);
    if (game.spawnTimer > spawnInterval) {
      game.spawnTimer = 0;
      spawnFruit();
    }

    if (now - game.lastEmit > 300) {
      game.lastEmit = now;
      socket.emit("scoreUpdate", { token: currentUser.token, score: game.score });
    }
  }

  for (const fruit of game.fruits) {
    fruit.x += fruit.vx;
    fruit.y += fruit.vy;
    fruit.vy += GRAVITY;
    fruit.rotation += fruit.rotSpeed;
  }

  game.fruits = game.fruits.filter((f) => f.y <= canvas.height + 80);

  for (const p of game.particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += GRAVITY;
    p.life -= 0.02;
  }
  game.particles = game.particles.filter((p) => p.life > 0);

  for (const h of game.halves) {
    h.x += h.vx;
    h.y += h.vy;
    h.vy += GRAVITY;
    h.rotation += h.rotSpeed;
    h.life -= 0.018;
  }
  game.halves = game.halves.filter((h) => h.life > 0 && h.y < canvas.height + 80);

  for (const w of game.shockwaves) {
    const t = 1 - w.life;
    w.radius = w.maxRadius * t * t * (3 - 2 * t);
    w.life -= 0.04;
  }
  game.shockwaves = game.shockwaves.filter((w) => w.life > 0);

  game.slices = game.slices.filter((s) => s.life > 0);
  for (const s of game.slices) s.life -= 0.05;
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawSliceTrail();
  for (const w of game.shockwaves) {
    drawShockwave(w);
  }
  for (const fruit of game.fruits) {
    drawFruit(fruit);
  }
  for (const h of game.halves) {
    drawHalf(h);
  }
  for (const p of game.particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r || 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

let lastTime = 0;
function loop(ts) {
  const dt = Math.min(30, ts - lastTime);
  lastTime = ts;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

canvas.addEventListener("mousedown", (e) => {
  if (game.phase !== "playing") return;
  const pos = getCanvasPos(e);
  game.mouse.x = pos.x;
  game.mouse.y = pos.y;
  game.mouse.px = pos.x;
  game.mouse.py = pos.y;
  game.mouse.active = true;
  AudioMan.playSlice();
});

canvas.addEventListener("mousemove", (e) => {
  if (game.phase !== "playing") return;
  const pos = getCanvasPos(e);
  game.mouse.px = game.mouse.x;
  game.mouse.py = game.mouse.y;
  game.mouse.x = pos.x;
  game.mouse.y = pos.y;
  if (game.mouse.active) {
    game.slices.push({ x1: game.mouse.px, y1: game.mouse.py, x2: game.mouse.x, y2: game.mouse.y, life: 1 });
    checkSlices();
  }
});

canvas.addEventListener("mouseup", () => {
  game.mouse.active = false;
});

canvas.addEventListener("mouseleave", () => {
  game.mouse.active = false;
});

canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  if (game.phase !== "playing") return;
  const t = e.changedTouches[0];
  const pos = getCanvasPos({ clientX: t.clientX, clientY: t.clientY });
  game.mouse.x = pos.x;
  game.mouse.y = pos.y;
  game.mouse.px = pos.x;
  game.mouse.py = pos.y;
  game.mouse.active = true;
  AudioMan.playSlice();
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  if (game.phase !== "playing") return;
  const t = e.changedTouches[0];
  const pos = getCanvasPos({ clientX: t.clientX, clientY: t.clientY });
  game.mouse.px = game.mouse.x;
  game.mouse.py = game.mouse.y;
  game.mouse.x = pos.x;
  game.mouse.y = pos.y;
  if (game.mouse.active) {
    game.slices.push({ x1: game.mouse.px, y1: game.mouse.py, x2: game.mouse.x, y2: game.mouse.y, life: 1 });
    checkSlices();
  }
}, { passive: false });

canvas.addEventListener("touchend", (e) => {
  e.preventDefault();
  game.mouse.active = false;
}, { passive: false });

canvas.addEventListener("touchcancel", () => {
  game.mouse.active = false;
});

const savedToken = localStorage.getItem("fn-token");
if (savedToken) {
  socket.emit("loginWithToken", { token: savedToken }, (res) => {
    if (res.ok) completeAuth(res);
  });
}

updateAudioButtons();
requestAnimationFrame(loop);
