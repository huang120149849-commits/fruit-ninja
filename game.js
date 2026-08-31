const socket = io();

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
canvas.width = 800;
canvas.height = 1100;

const GRAVITY = 0.22;

const speedMul = 1;

const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
const fruitScale = isTouchDevice ? 1.5625 : 1;

const memeImg = new Image();
memeImg.src = "assets/meme.png";

const fruitTypes = [
  { name: "watermelon", emoji: "🍉", color: "#2e8b57", inner: "#ff4757", radius: 60, points: 1 },
  { name: "apple", emoji: "🍎", color: "#c0392b", inner: "#fff5e1", radius: 48, points: 1 },
  { name: "greenapple", emoji: "🍏", color: "#27ae60", inner: "#e8f8e0", radius: 48, points: 1 },
  { name: "orange", emoji: "🍊", color: "#e67e22", inner: "#fdcb6e", radius: 46, points: 1 },
  { name: "lemon", emoji: "🍋", color: "#f1c40f", inner: "#fdf3d0", radius: 46, points: 1 },
  { name: "banana", emoji: "🍌", color: "#f1c40f", inner: "#fdf3d0", radius: 52, points: 2 },
  { name: "grapes", emoji: "🍇", color: "#8e44ad", inner: "#d2b4de", radius: 50, points: 1 },
  { name: "strawberry", emoji: "🍓", color: "#e74c3c", inner: "#f5b7b1", radius: 44, points: 2 },
  { name: "kiwi", emoji: "🥝", color: "#6f9e4f", inner: "#c8e6a0", radius: 44, points: 1 },
  { name: "peach", emoji: "🍑", color: "#ff9ff3", inner: "#ffeaa7", radius: 48, points: 2 },
  { name: "pear", emoji: "🍐", color: "#a3d15a", inner: "#f0f7d4", radius: 48, points: 1 },
  { name: "cherries", emoji: "🍒", color: "#c0392b", inner: "#ffd9d9", radius: 46, points: 2 },
  { name: "pineapple", emoji: "🍍", color: "#d68910", inner: "#fdebd0", radius: 50, points: 1 },
  { name: "mango", emoji: "🥭", color: "#f39c12", inner: "#ffe0b2", radius: 48, points: 1 },
];

const game = {
  phase: "idle",
  score: 0,
  fruits: [],
  particles: [],
  halves: [],
  shockwaves: [],
  slices: [],
  bonuses: [],
  floaters: [],
  spawnTimer: 0,
  bonusTimer: 0,
  speedFactor: 1,
  gravityFactor: 1,
  speedMod: 1,
  speedModTarget: 1,
  speedModTimer: 0,
  startsAt: 0,
  endsAt: 0,
  lastEmit: 0,
  lastCountdown: 0,
  mouse: { x: 0, y: 0, px: 0, py: 0, active: false },
};

let currentUser = null;
let arenaInfo = null;
let liveScores = [];
let tournament = { active: false, round: 0, rankCounts: {} };
let choiceTimer = null;
let choiceDeadline = 0;
let choiceResolved = false;

const screens = {
  auth: document.getElementById("auth-screen"),
  lobby: document.getElementById("lobby-screen"),
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
  authTrackBtn: document.getElementById("auth-track-btn"),
  musicTrackToggle: document.getElementById("music-track-toggle"),
  gameMusicTrackToggle: document.getElementById("game-music-track-toggle"),
  lobbyUsername: document.getElementById("lobby-username"),
  lobbyBest: document.getElementById("lobby-best"),
  lobbyMsg: document.getElementById("lobby-msg"),
  musicToggle: document.getElementById("music-toggle"),
  sfxToggle: document.getElementById("sfx-toggle"),
  logoutBtn: document.getElementById("logout-btn"),
  gameMusicToggle: document.getElementById("game-music-toggle"),
  gameSfxToggle: document.getElementById("game-sfx-toggle"),
  gameLogoutBtn: document.getElementById("game-logout-btn"),
  leaderboardBtn: document.getElementById("leaderboard-btn"),
  lobbyBackBtn: document.getElementById("lobby-back-btn"),
  leaderboardBody: document.getElementById("leaderboard-body"),
  roleBadge: document.getElementById("role-badge"),
  adminPanel: document.getElementById("admin-panel"),
  adminUsername: document.getElementById("admin-username"),
  adminAddBtn: document.getElementById("admin-add-btn"),
  adminRemoveBtn: document.getElementById("admin-remove-btn"),
  adminList: document.getElementById("admin-list"),
  adminMsg: document.getElementById("admin-msg"),
  startMatchBtn: document.getElementById("start-match-btn"),
  soloTestBtn: document.getElementById("solo-test-btn"),
  soloTestRow: document.getElementById("solo-test-row"),
  testDuration: document.getElementById("test-duration"),
  startTournamentBtn: document.getElementById("start-tournament-btn"),
  tournamentStatus: document.getElementById("tournament-status"),
  tournamentAdmin: document.getElementById("tournament-admin"),
  rankCountInput: document.getElementById("rank-count-input"),
  setRankCountBtn: document.getElementById("set-rank-count-btn"),
  resultTitle: document.getElementById("result-title"),
  choicePanel: document.getElementById("choice-panel"),
  choiceMsg: document.getElementById("choice-msg"),
  choiceCountdown: document.getElementById("choice-countdown"),
  keepRankBtn: document.getElementById("keep-rank-btn"),
  advanceBtn: document.getElementById("advance-btn"),
  exportLogBtn: document.getElementById("export-log-btn"),
  waitingOverlay: document.getElementById("waiting-overlay"),
  waitingMsg: document.getElementById("waiting-msg"),
  onlineCount: document.getElementById("online-count"),
  sidebarTitle: document.getElementById("sidebar-title"),
  countdownEl: document.getElementById("countdown-el"),
  gameTimer: document.getElementById("game-timer"),
  gameScore: document.getElementById("game-score"),
  liveRanks: document.getElementById("live-ranks"),
  resultRanking: document.getElementById("result-ranking"),
  resultBackBtn: document.getElementById("result-back-btn"),
  beatOverlay: document.getElementById("beat-overlay"),
  rememberChk: document.getElementById("remember-chk"),
  authScreen: document.getElementById("auth-screen"),
  bgAdmin: document.getElementById("bg-admin"),
  bgFile: document.getElementById("bg-file"),
  bgUploadBtn: document.getElementById("bg-upload-btn"),
  bgResetBtn: document.getElementById("bg-reset-btn"),
  bgPreview: document.getElementById("bg-preview"),
  bgPreviewRow: document.getElementById("bg-preview-row"),
  bgMsg: document.getElementById("bg-msg"),
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
  if (el.rememberChk && el.rememberChk.checked) {
    localStorage.setItem("fn-cred", JSON.stringify({ u: res.username, p: el.authPassword.value }));
  } else {
    localStorage.removeItem("fn-cred");
  }
  renderLobbyHeader();
  renderRoleUI();
  refreshLeaderboard();
  resetGame();
  showScreen("game");
  renderArena();
}

function prefillCredentials() {
  if (!el.rememberChk) return;
  let cred = null;
  try {
    cred = JSON.parse(localStorage.getItem("fn-cred") || "null");
  } catch (e) {}
  if (cred && cred.u) {
    el.authUsername.value = cred.u;
    el.authPassword.value = cred.p || "";
    el.rememberChk.checked = true;
  }
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
  el.adminPanel.classList.toggle("hidden", currentUser.role !== "superadmin");
  if (el.bgAdmin) el.bgAdmin.classList.toggle("hidden", !isAdmin());
  if (currentUser.role === "superadmin") refreshAdminList();
  if (isAdmin()) refreshBgPreview();
  renderArena();
}

async function loadLoginBg() {
  try {
    const res = await fetch("/api/login-bg", { cache: "no-store" });
    const data = await res.json();
    if (el.authScreen) {
      if (data.hasBg) {
        el.authScreen.style.backgroundImage = `url("${data.url}")`;
      } else {
        el.authScreen.style.backgroundImage = "";
      }
    }
    return data;
  } catch (e) {
    return { hasBg: false };
  }
}

async function refreshBgPreview() {
  const data = await loadLoginBg();
  if (!el.bgPreview || !el.bgPreviewRow) return;
  if (data.hasBg) {
    el.bgPreview.src = data.url;
    el.bgPreviewRow.classList.remove("hidden");
  } else {
    el.bgPreview.removeAttribute("src");
    el.bgPreviewRow.classList.add("hidden");
  }
}

function renderArena() {
  const waiting = !arenaInfo || arenaInfo.status === "waiting";
  el.onlineCount.textContent = "在线玩家: " + (arenaInfo ? arenaInfo.players.length : 0);
  el.waitingOverlay.classList.toggle("hidden", !waiting);
  el.sidebarTitle.textContent = waiting ? "👥 在线玩家" : "📊 实时排名";
  el.startMatchBtn.classList.toggle("hidden", !(isAdmin() && waiting));
  el.startMatchBtn.disabled = !waiting;
  el.soloTestRow.classList.toggle("hidden", !(isAdmin() && waiting));
  el.soloTestBtn.disabled = !waiting;
  if (arenaInfo && arenaInfo.tournament && waiting) {
    el.startTournamentBtn.classList.add("hidden");
    el.tournamentStatus.classList.remove("hidden");
    const rankCounts = arenaInfo.rankCounts || {};
    el.tournamentStatus.textContent =
      `🏆 3局晋级赛: 第 ${arenaInfo.round || 1}/3 局` +
      (rankCounts[arenaInfo.round] ? ` | 本局取前 ${rankCounts[arenaInfo.round]} 名` : " | 未设置得名次人数");
    el.tournamentAdmin.classList.toggle("hidden", !isAdmin());
  } else {
    el.startTournamentBtn.classList.toggle("hidden", !(isAdmin() && waiting && (!arenaInfo || !arenaInfo.tournament)));
    el.tournamentStatus.classList.add("hidden");
    el.tournamentAdmin.classList.add("hidden");
  }
  if (waiting) {
    el.liveRanks.innerHTML = "";
    if (arenaInfo) {
      arenaInfo.players.forEach((p) => {
        const li = document.createElement("li");
        const badge = p.role === "superadmin" ? "🛡️" : p.role === "admin" ? "🛡️" : "👤";
        const outMark = p.active === false ? " ❌已淘汰" : p.kept ? " 🏅已保留名次" : "";
        li.textContent = badge + " " + p.username + outMark + (p.username === currentUser.username ? " (我)" : "");
        if (p.username === currentUser.username) li.classList.add("me");
        el.liveRanks.appendChild(li);
      });
    }
  } else {
    renderLiveScores();
  }
}

function refreshAdminList() {
  socket.emit("getAdmins", { token: currentUser.token }, (res) => {
    if (!res || !res.ok) return;
    el.adminList.innerHTML = "";
    res.list.forEach((u) => {
      const li = document.createElement("li");
      li.textContent = "🛡️ " + u.username + (u.role === "superadmin" ? " (超级)" : " (管理员)");
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

el.bgUploadBtn.addEventListener("click", () => {
  const file = el.bgFile.files && el.bgFile.files[0];
  if (!file) {
    el.bgMsg.textContent = "请先选择一张图片";
    return;
  }
  el.bgUploadBtn.disabled = true;
  el.bgMsg.textContent = "上传中...";
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const res = await fetch("/api/login-bg", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-auth-token": currentUser.token },
        body: JSON.stringify({ image: reader.result, name: file.name }),
      });
      const data = await res.json();
      el.bgMsg.textContent = data.ok ? "✅ 背景已更新" : data.error || "上传失败";
      if (data.ok) {
        el.bgFile.value = "";
        refreshBgPreview();
      }
    } catch (e) {
      el.bgMsg.textContent = "上传失败: " + (e.message || e);
    } finally {
      el.bgUploadBtn.disabled = false;
    }
  };
  reader.onerror = () => { el.bgMsg.textContent = "读取文件失败"; el.bgUploadBtn.disabled = false; };
  reader.readAsDataURL(file);
});

el.bgResetBtn.addEventListener("click", async () => {
  el.bgResetBtn.disabled = true;
  el.bgMsg.textContent = "恢复中...";
  try {
    const res = await fetch("/api/login-bg/clear", { method: "POST", headers: { "x-auth-token": currentUser.token } });
    const data = await res.json();
    el.bgMsg.textContent = data.ok ? "✅ 已恢复默认背景" : data.error || "操作失败";
    if (data.ok) refreshBgPreview();
  } catch (e) {
    el.bgMsg.textContent = "操作失败: " + (e.message || e);
  } finally {
    el.bgResetBtn.disabled = false;
  }
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

el.startMatchBtn.addEventListener("click", () => {
  el.startMatchBtn.disabled = true;
  requestGameFullscreen();
  socket.emit("startMatch", { token: currentUser.token }, (res) => {
    if (res && !res.ok) {
      alert(res.error || "无法开始比赛");
      el.startMatchBtn.disabled = false;
    }
  });
});

el.soloTestBtn.addEventListener("click", () => {
  el.soloTestBtn.disabled = true;
  requestGameFullscreen();
  const duration = parseInt(el.testDuration.value, 10) || 15;
  socket.emit("startSoloTest", { token: currentUser.token, duration }, (res) => {
    if (res && !res.ok) {
      alert(res.error || "无法开始测试");
      el.soloTestBtn.disabled = false;
    }
  });
});

el.startTournamentBtn.addEventListener("click", () => {
  el.startTournamentBtn.disabled = true;
  socket.emit("startTournament", { token: currentUser.token }, (res) => {
    if (res && !res.ok) {
      alert(res.error || "无法开启晋级赛");
      el.startTournamentBtn.disabled = false;
    }
  });
});

el.setRankCountBtn.addEventListener("click", () => {
  const count = parseInt(el.rankCountInput.value, 10);
  if (!count || count < 1 || count > 50) {
    alert("请输入 1-50 之间的得名次人数");
    return;
  }
  socket.emit("setRankCount", { token: currentUser.token, round: tournament.round || 1, count }, (res) => {
    if (res && !res.ok) alert(res.error || "设置失败");
  });
});

el.leaderboardBtn.addEventListener("click", () => {
  refreshLeaderboard();
  exitGameFullscreen();
  renderRoleUI();
  showScreen("lobby");
});

el.lobbyBackBtn.addEventListener("click", () => {
  showScreen("game");
  renderArena();
});

el.resultBackBtn.addEventListener("click", () => {
  game.phase = "idle";
  showScreen("game");
  renderArena();
});
el.logoutBtn.addEventListener("click", logout);
el.gameLogoutBtn.addEventListener("click", logout);

function logout() {
  currentUser = null;
  arenaInfo = null;
  localStorage.removeItem("fn-token");
  localStorage.removeItem("fn-username");
  exitGameFullscreen();
  el.authForm.reset();
  setAuthMode("login");
  showScreen("auth");
}

socket.on("arenaUpdate", (snap) => {
  arenaInfo = snap;
  if (snap.tournament !== undefined) {
    tournament = { active: !!snap.tournament, round: snap.round || 0, rankCounts: snap.rankCounts || {} };
  }
  if (screens.game.classList.contains("active")) renderArena();
  if (screens.lobby.classList.contains("active") && isAdmin()) refreshAdminList();
});

socket.on("matchStart", ({ startsAt, endsAt, soloTest }) => {
  if (tournament.active && !isMeActive()) {
    showToast("❌ 你已被淘汰, 本轮无参赛资格");
    return;
  }
  AudioMan.playGo();
  resetGame();
  guardHistory();
  if (soloTest) showToast(`🧪 单元测试模式 (${Math.round((endsAt - startsAt) / 1000)}秒, 不计入排行榜)`);
  game.phase = "countdown";
  game.startsAt = startsAt;
  game.endsAt = endsAt;
  game.lastCountdown = 0;
  el.waitingOverlay.classList.add("hidden");
  el.countdownEl.classList.remove("hidden");
  el.countdownEl.textContent = "3";
  showScreen("game");
});

function isMeActive() {
  if (!arenaInfo || !arenaInfo.players) return true;
  const me = arenaInfo.players.find((p) => p.username === currentUser.username);
  return me ? me.active !== false : true;
}


socket.on("liveScores", ({ scores }) => {
  liveScores = scores;
  if (!arenaInfo || arenaInfo.status !== "waiting") renderLiveScores();
});

socket.on("matchEnd", ({ ranking }) => {
  game.phase = "idle";
  game.mouse.active = false;
  AudioMan.setIntensity(0);
  renderResults(ranking);
  el.resultTitle.textContent = tournament.active ? `🏁 第${tournament.round}局结束` : "🏁 比赛结束";
  el.choicePanel.classList.add("hidden");
  showScreen("result");
  exitGameFullscreen();
});

socket.on("tournamentStart", () => {
  tournament = { active: true, round: 1, rankCounts: {} };
  showToast("🏆 3局晋级赛已开启, 由管理员设置每局得名次人数");
  renderArena();
});

socket.on("roundConfig", ({ round, count, rankCounts }) => {
  tournament.round = round;
  tournament.rankCounts = rankCounts || {};
  showToast(`📋 第${round}局得名次人数已设置: ${count} 名`);
  renderArena();
});

socket.on("roundResult", ({ round, ranking, ranked, deadline }) => {
  tournament.round = round;
  choiceDeadline = deadline;
  choiceResolved = false;
  renderResults(ranking);
  el.resultTitle.textContent = `🏅 第${round}局 得名次名单`;
  const iAmRanked = ranked.includes(currentUser.username);
  if (iAmRanked) {
    el.choicePanel.classList.remove("hidden");
    el.keepRankBtn.classList.remove("hidden");
    el.advanceBtn.classList.remove("hidden");
    el.choiceMsg.textContent = "🎉 恭喜进入得名次名单! ⏰ 请在 9 秒内选择「保留名次」或「晋级下一局」,超时将自动晋级!";
    el.keepRankBtn.disabled = false;
    el.advanceBtn.disabled = false;
    startChoiceCountdown();
  } else {
    el.choicePanel.classList.remove("hidden");
    el.choiceMsg.textContent = "⏰ 得名次者需在 9 秒内做出选择,超时未选将自动晋级下一局";
    el.choiceCountdown.textContent = "";
    el.keepRankBtn.classList.add("hidden");
    el.advanceBtn.classList.add("hidden");
  }
  showScreen("result");
  exitGameFullscreen();
});

function startChoiceCountdown() {
  stopChoiceCountdown();
  el.choiceCountdown.textContent = "9";
  choiceTimer = setInterval(() => {
    const remain = Math.max(0, Math.ceil((choiceDeadline - Date.now()) / 1000));
    if (choiceResolved) {
      stopChoiceCountdown();
      return;
    }
    if (remain <= 0) {
      stopChoiceCountdown();
      el.choiceMsg.textContent = "⏰ 未做出选择, 已自动晋级下一局";
      el.choiceCountdown.textContent = "0";
      el.keepRankBtn.disabled = true;
      el.advanceBtn.disabled = true;
      return;
    }
    el.choiceCountdown.textContent = String(remain);
  }, 200);
}

function stopChoiceCountdown() {
  if (choiceTimer) {
    clearInterval(choiceTimer);
    choiceTimer = null;
  }
}

el.keepRankBtn.addEventListener("click", () => {
  choiceResolved = true;
  stopChoiceCountdown();
  el.keepRankBtn.disabled = true;
  el.advanceBtn.disabled = true;
  el.choiceMsg.textContent = "🏅 已选择保留名次!";
  el.choiceCountdown.textContent = "";
  socket.emit("chooseRound", { token: currentUser.token, action: "keep" });
});

el.advanceBtn.addEventListener("click", () => {
  choiceResolved = true;
  stopChoiceCountdown();
  el.keepRankBtn.disabled = true;
  el.advanceBtn.disabled = true;
  el.choiceMsg.textContent = "🚀 已选择晋级下一局!";
  el.choiceCountdown.textContent = "";
  socket.emit("chooseRound", { token: currentUser.token, action: "advance" });
});

socket.on("roundChoices", ({ round, kept, advanced, finalRanks }) => {
  stopChoiceCountdown();
  el.choicePanel.classList.add("hidden");
  el.resultTitle.textContent = `📋 第${round}局 晋级结果`;
  el.resultRanking.innerHTML = "";
  if (advanced.length > 0) {
    const li1 = document.createElement("li");
    li1.innerHTML = `<span>🚀 晋级下一局:</span><b>${advanced.length}人</b>`;
    el.resultRanking.appendChild(li1);
    advanced.forEach((u) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>  ${escapeHtml(u)}</span>`;
      el.resultRanking.appendChild(li);
    });
  }
  if (kept.length > 0) {
    const li2 = document.createElement("li");
    li2.innerHTML = `<span>🏅 保留名次:</span><b>${kept.length}人</b>`;
    el.resultRanking.appendChild(li2);
    kept.forEach((u) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>  ${escapeHtml(u)}</span>`;
      el.resultRanking.appendChild(li);
    });
  }
});

socket.on("roundReady", ({ round }) => {
  tournament.round = round;
  showScreen("game");
  renderArena();
  showToast(`📣 第${round}局准备就绪, 等待管理员设置并开始比赛`);
});

socket.on("tournamentEnd", ({ ranking, finalRanks, log }) => {
  tournament = { active: false, round: 0, rankCounts: {} };
  stopChoiceCountdown();
  el.choicePanel.classList.add("hidden");
  el.resultTitle.textContent = "🏆 晋级赛结束 · 最终名次";
  el.resultRanking.innerHTML = "";
  if (finalRanks.length === 0) {
    const li = document.createElement("li");
    li.textContent = "无得名次人员";
    el.resultRanking.appendChild(li);
  } else {
    finalRanks.forEach((f, i) => {
      const li = document.createElement("li");
      const medal = i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1 + ".";
      li.innerHTML = `<span>${medal} ${escapeHtml(f.username)}</span><b>第${f.round}局 第${f.pos}名</b>`;
      if (f.username === currentUser.username) li.classList.add("me");
      el.resultRanking.appendChild(li);
    });
  }
  lastTournamentLog = log || null;
  el.exportLogBtn.classList.toggle("hidden", !isAdmin());
  showScreen("result");
  exitGameFullscreen();
});

let lastTournamentLog = null;

el.exportLogBtn.addEventListener("click", () => {
  if (!lastTournamentLog || lastTournamentLog.length === 0) {
    socket.emit("getTournamentLog", { token: currentUser.token }, (res) => {
      if (res && res.ok) {
        lastTournamentLog = res.log || [];
        downloadTournamentLog(lastTournamentLog, res.finalRanks || []);
      } else {
        alert(res && res.error ? res.error : "无可用比赛记录");
      }
    });
    return;
  }
  downloadTournamentLog(lastTournamentLog, []);
});

function downloadTournamentLog(log, finalRanks) {
  const lines = [];
  lines.push("=== 水果忍者 3局晋级赛 比赛记录 ===");
  lines.push("导出时间: " + new Date().toLocaleString("zh-CN"));
  lines.push("");
  log.forEach((e) => {
    lines.push(`--- 第${e.round}局 (得名次人数: ${e.rankCount}) ---`);
    lines.push("完整排名:");
    e.ranking.forEach((r, i) => {
      lines.push(`  ${i + 1}. ${r.username} - ${r.score}分`);
    });
    lines.push(`得名次名单: ${e.ranked.map((r) => r.username).join(", ") || "无"}`);
    if (e.advanced && e.advanced.length) lines.push(`晋级下一局: ${e.advanced.join(", ")}`);
    if (e.kept && e.kept.length) lines.push(`保留名次: ${e.kept.join(", ")}`);
    lines.push("");
  });
  if (finalRanks.length) {
    lines.push("=== 最终名次 ===");
    finalRanks.forEach((f, i) => {
      lines.push(`  ${i + 1}. ${f.username} (第${f.round}局 第${f.pos}名)`);
    });
  }
  const text = lines.join("\r\n");
  const blob = new Blob(["\ufeff" + text], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `晋级赛记录_${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  a.remove();
}

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
      arenaInfo = null;
      localStorage.removeItem("fn-token");
      localStorage.removeItem("fn-username");
      hideToast();
      setAuthMode("login");
      showScreen("auth");
      el.authMsg.textContent = "服务器已重启，请重新登录";
      return;
    }
    completeAuth(res);
    hideToast();
    showScreen("game");
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
  const trackLabel = "🎼 曲风: " + AudioMan.getTrackName();
  el.musicToggle.textContent = musicLabel;
  el.authMusicBtn.textContent = musicLabel;
  el.sfxToggle.textContent = sfxLabel;
  if (el.authTrackBtn) el.authTrackBtn.textContent = trackLabel;
  if (el.musicTrackToggle) el.musicTrackToggle.textContent = trackLabel;
  if (el.gameMusicToggle) el.gameMusicToggle.textContent = musicLabel;
  if (el.gameMusicTrackToggle) el.gameMusicTrackToggle.textContent = trackLabel;
  if (el.gameSfxToggle) el.gameSfxToggle.textContent = sfxLabel;
}

function cycleTrack() {
  AudioMan.setTrack(AudioMan.getTrackIndex() + 1);
  updateAudioButtons();
}

if (el.authTrackBtn) el.authTrackBtn.addEventListener("click", cycleTrack);
if (el.musicTrackToggle) el.musicTrackToggle.addEventListener("click", cycleTrack);
if (el.gameMusicTrackToggle) el.gameMusicTrackToggle.addEventListener("click", cycleTrack);

el.musicToggle.addEventListener("click", () => {
  AudioMan.setMusic(!AudioMan.musicOn);
  updateAudioButtons();
});

el.sfxToggle.addEventListener("click", () => {
  AudioMan.setSfx(!AudioMan.sfxOn);
  updateAudioButtons();
});

if (el.gameMusicToggle) {
  el.gameMusicToggle.addEventListener("click", () => {
    AudioMan.setMusic(!AudioMan.musicOn);
    updateAudioButtons();
  });
}

if (el.gameSfxToggle) {
  el.gameSfxToggle.addEventListener("click", () => {
    AudioMan.setSfx(!AudioMan.sfxOn);
    updateAudioButtons();
  });
}

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
  const sf = game.speedFactor || 1;
  const isBomb = Math.random() < 0.16;
  const dirRoll = Math.random();
  let x, y, vx, vy;
  if (dirRoll < 0.2) {
    x = -50;
    y = canvas.height * (0.15 + Math.random() * 0.5);
    vx = (2.5 + Math.random() * 3.5) * sf * speedMul;
    vy = -(canvas.height * (0.008 + Math.random() * 0.006)) * sf;
  } else if (dirRoll < 0.4) {
    x = canvas.width + 50;
    y = canvas.height * (0.15 + Math.random() * 0.5);
    vx = -(2.5 + Math.random() * 3.5) * sf * speedMul;
    vy = -(canvas.height * (0.008 + Math.random() * 0.006)) * sf;
  } else {
    x = 80 + Math.random() * (canvas.width - 160);
    y = canvas.height + 50;
    vx = (Math.random() - 0.5) * 3.5 * sf * speedMul;
    vy = -(canvas.height * 0.019 * speedMul + Math.random() * canvas.height * 0.006 * speedMul) * sf;
  }
  if (isBomb) {
    game.fruits.push({
      type: null,
      bomb: true,
      x,
      y,
      vx,
      vy,
      radius: 44 * fruitScale,
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
      y,
      vx,
      vy,
      radius: type.radius * fruitScale,
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
  for (let i = 0; i < 3; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = 3 + Math.random() * 4;
    game.halves.push({
      x: fruit.x,
      y: fruit.y,
      vx: Math.cos(ang) * sp + fruit.vx * 0.3,
      vy: Math.sin(ang) * sp - 1,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.3,
      r: fruit.radius * (0.18 + Math.random() * 0.18),
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

function spawnBonus() {
  const emojis = ["💰", "⭐", "🎁", "💎", "🔥", "🎯", "🍀"];
  const sf = game.speedFactor || 1;
  const dirRoll = Math.random();
  let x, y, vx, vy;
  if (dirRoll < 0.3) {
    x = -50;
    y = canvas.height * (0.15 + Math.random() * 0.5);
    vx = (2.5 + Math.random() * 3) * sf * speedMul;
    vy = -(canvas.height * (0.01 + Math.random() * 0.005)) * sf;
  } else if (dirRoll < 0.6) {
    x = canvas.width + 50;
    y = canvas.height * (0.15 + Math.random() * 0.5);
    vx = -(2.5 + Math.random() * 3) * sf * speedMul;
    vy = -(canvas.height * (0.01 + Math.random() * 0.005)) * sf;
  } else {
    x = 100 + Math.random() * (canvas.width - 200);
    y = canvas.height + 50;
    vx = (Math.random() - 0.5) * 5 * sf * speedMul;
    vy = -(canvas.height * 0.021 * speedMul + Math.random() * canvas.height * 0.005 * speedMul) * sf;
  }
  game.bonuses.push({
    emoji: emojis[Math.floor(Math.random() * emojis.length)],
    img: Math.random() < 0.5 ? memeImg : null,
    x,
    y,
    vx,
    vy,
    radius: 48 * fruitScale,
    rotation: 0,
    rotSpeed: (Math.random() - 0.5) * 0.06,
    sliced: false,
  });
}

function sliceBonus(b, sliceAngle) {
  if (b.sliced) return;
  b.sliced = true;
  game.score += 10;
  el.gameScore.textContent = "得分: " + game.score;
  spawnImageHalves(b, sliceAngle || 0);
  const colors = ["#ffd32a", "#ffa502", "#fff200", "#ffed4a"];
  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 4;
    game.particles.push({
      x: b.x,
      y: b.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      life: 1,
      r: 2 + Math.random() * 3,
      color: colors[i % colors.length],
    });
  }
  game.floaters.push({ x: b.x, y: b.y - 12, text: "+10", life: 1, vy: -1.4 });
  AudioMan.playBonus();
}

function spawnImageHalves(b, sliceAngle) {
  const perp = sliceAngle + Math.PI / 2;
  const jx = Math.cos(perp);
  const jy = Math.sin(perp);
  for (let side = -1; side <= 1; side += 2) {
    game.halves.push({
      x: b.x + jx * side * 8,
      y: b.y + jy * side * 8,
      vx: b.vx * 0.5 + jx * side * (2.5 + Math.random() * 2.5) + (Math.random() - 0.5) * 2,
      vy: b.vy * 0.5 + (Math.random() - 0.5) * 3,
      rotation: sliceAngle + (side > 0 ? 0 : Math.PI),
      rotSpeed: (Math.random() - 0.5) * 0.18,
      r: b.radius,
      img: memeImg,
      side,
      life: 1,
    });
  }
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
  for (const b of game.bonuses) {
    if (b.sliced || b.y < -60) continue;
    if (segmentCircleHit(px, py, x, y, b.x, b.y, b.radius)) {
      sliceBonus(b, sliceAngle);
    }
  }
}

function drawFruit(fruit) {
  ctx.save();
  ctx.translate(fruit.x, fruit.y);
  ctx.rotate(fruit.rotation);
  ctx.font = `${Math.round(fruit.radius * 2)}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (fruit.bomb) {
    ctx.fillText("💣", 0, 2);
  } else {
    ctx.fillText(fruit.type.emoji, 0, 2);
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
  if (h.img && h.img.complete && h.img.naturalWidth > 0) {
    const size = h.r * 2;
    ctx.beginPath();
    if (h.side > 0) ctx.rect(0, -size / 2, size / 2, size);
    else ctx.rect(-size / 2, -size / 2, size / 2, size);
    ctx.clip();
    ctx.drawImage(h.img, -size / 2, -size / 2, size, size);
  } else {
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
  }
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

function drawBonus(b) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.rotation);
  ctx.strokeStyle = "rgba(255,200,60,0.9)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, b.radius + 4, 0, Math.PI * 2);
  ctx.stroke();
  if (b.img && b.img.complete && b.img.naturalWidth > 0) {
    const size = b.radius * 1.9;
    ctx.drawImage(b.img, -size / 2, -size / 2, size, size);
  } else {
    ctx.font = `${Math.round(b.radius * 1.9)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(b.emoji, 0, 2);
  }
  ctx.restore();
}

function drawFloater(f) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, f.life);
  ctx.font = "bold 30px 'Microsoft YaHei', sans-serif";
  ctx.textAlign = "center";
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth = 4;
  ctx.strokeText(f.text, f.x, f.y);
  ctx.fillStyle = "#ffd32a";
  ctx.fillText(f.text, f.x, f.y);
  ctx.restore();
}

function resetGame() {
  game.score = 0;
  game.fruits = [];
  game.particles = [];
  game.halves = [];
  game.shockwaves = [];
  game.slices = [];
  game.bonuses = [];
  game.floaters = [];
  game.spawnTimer = 0;
  game.bonusTimer = 0;
  game.speedFactor = 1;
  game.gravityFactor = 1;
  game.speedMod = 1;
  game.speedModTarget = 1;
  game.speedModTimer = 0;
  game.lastEmit = 0;
  el.gameScore.textContent = "得分: 0";
  el.gameTimer.textContent = "60s";
  liveScores = [];
  renderLiveScores();
}

function update(dt) {
  const now = Date.now();

  if (game.phase === "countdown") {
    AudioMan.setIntensity(0.5);
    const remain = Math.ceil((game.startsAt - now) / 1000);
    el.countdownEl.textContent = remain > 0 ? remain : "GO!";
    if (remain !== game.lastCountdown) {
      game.lastCountdown = remain;
      if (remain > 0) AudioMan.playCountdown();
      else AudioMan.playGo();
    }
    if (now >= game.startsAt) {
      game.phase = "playing";
      hideToast();
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
      AudioMan.setIntensity(0);
      el.countdownEl.textContent = "等待结果...";
      el.countdownEl.classList.remove("hidden");
      socket.emit("scoreUpdate", { token: currentUser.token, score: game.score });
      return;
    }

    game.spawnTimer += dt;
    game.bonusTimer += dt;
    const elapsed = now - game.startsAt;
    const matchLen = Math.max(1, game.endsAt - game.startsAt);
    const progress = Math.min(1, elapsed / matchLen);
    AudioMan.setIntensity(progress);
    if (elapsed < 10000) {
      game.speedModTarget = 0.7;
    } else if (elapsed < 20000) {
      game.speedModTarget = 1.0;
    } else if (elapsed < 30000) {
      game.speedModTarget = 0.7;
    } else if (elapsed < 40000) {
      game.speedModTarget = 1.1;
    } else if (elapsed < 50000) {
      game.speedModTimer -= dt;
      if (game.speedModTimer <= 0) {
        game.speedModTimer = 4000;
        game.speedModTarget = 1.1 + Math.random() * 0.4;
      }
    } else {
      game.speedModTarget = 0.8;
    }
    game.speedMod += (game.speedModTarget - game.speedMod) * 0.05;
    game.speedFactor = (1.0 + 0.4 * progress) * game.speedMod;
    game.gravityFactor = (0.8 + 0.2 * progress) * game.speedMod;
    const spawnInterval = Math.max(900, 1900 - progress * 800);
    if (game.spawnTimer > spawnInterval) {
      game.spawnTimer = 0;
      spawnFruit();
    }
    if (game.bonusTimer > 3500) {
      game.bonusTimer = 0;
      if (Math.random() < 0.6) spawnBonus();
    }

    if (now - game.lastEmit > 300) {
      game.lastEmit = now;
      socket.emit("scoreUpdate", { token: currentUser.token, score: game.score });
    }
  }

  const grav = GRAVITY * game.gravityFactor;

  for (const fruit of game.fruits) {
    fruit.x += fruit.vx;
    fruit.y += fruit.vy;
    fruit.vy += grav;
    fruit.rotation += fruit.rotSpeed;
  }

  game.fruits = game.fruits.filter((f) => f.y <= canvas.height + 80 && f.x > -200 && f.x < canvas.width + 200);

  for (const b of game.bonuses) {
    b.x += b.vx;
    b.y += b.vy;
    b.vy += grav;
    b.rotation += b.rotSpeed;
  }
  game.bonuses = game.bonuses.filter((b) => !b.sliced && b.y <= canvas.height + 80 && b.x > -200 && b.x < canvas.width + 200);

  for (const f of game.floaters) {
    f.y += f.vy;
    f.life -= 0.03;
  }
  game.floaters = game.floaters.filter((f) => f.life > 0);

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

  if (game.phase === "idle" || game.phase === "finished") {
    AudioMan.setIntensity(0);
  }
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
  for (const b of game.bonuses) {
    drawBonus(b);
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
  for (const f of game.floaters) {
    drawFloater(f);
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

function requestGameFullscreen() {
  const root = document.documentElement;
  if (!document.fullscreenEnabled && !document.webkitFullscreenEnabled) return;
  if (document.fullscreenElement || document.webkitFullscreenElement) return;
  const req = root.requestFullscreen || root.webkitRequestFullscreen;
  if (req) {
    try { req.call(root); } catch (e) {}
  }
}

function exitGameFullscreen() {
  const doc = document;
  if (doc.fullscreenElement || doc.webkitFullscreenElement) {
    const ex = doc.exitFullscreen || doc.webkitExitFullscreen;
    if (ex) { try { ex.call(doc); } catch (e) {} }
  }
}

document.addEventListener("touchmove", (e) => {
  if (game.phase === "playing" || game.phase === "countdown") e.preventDefault();
}, { passive: false });

document.addEventListener("touchstart", (e) => {
  if (game.phase === "playing" || game.phase === "countdown") e.preventDefault();
}, { passive: false });

document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("gesturechange", (e) => e.preventDefault());
document.addEventListener("gestureend", (e) => e.preventDefault());
document.addEventListener("dblclick", (e) => e.preventDefault());
document.addEventListener("contextmenu", (e) => {
  if (game.phase === "playing" || game.phase === "countdown") e.preventDefault();
});

function guardHistory() {
  try { history.pushState({ fnGuard: true }, ""); } catch (e) {}
}

window.addEventListener("popstate", () => {
  if (game.phase === "playing" || game.phase === "countdown") {
    try { history.pushState({ fnGuard: true }, ""); } catch (e) {}
  }
});

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
  if (game.phase !== "playing" && game.phase !== "countdown") return;
  requestGameFullscreen();
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
    else autoLoginWithSavedCred();
  });
} else {
  autoLoginWithSavedCred();
}

function autoLoginWithSavedCred() {
  let cred = null;
  try {
    cred = JSON.parse(localStorage.getItem("fn-cred") || "null");
  } catch (e) {}
  if (!cred || !cred.u) return;
  el.authUsername.value = cred.u;
  el.authPassword.value = cred.p || "";
  el.rememberChk.checked = true;
  setTimeout(() => {
    el.authForm.dispatchEvent(new Event("submit", { cancelable: true }));
  }, 300);
}

prefillCredentials();
loadLoginBg();

AudioMan.onBeat(() => {
  if (!el.beatOverlay) return;
  el.beatOverlay.style.transition = "none";
  el.beatOverlay.style.opacity = "0.35";
  requestAnimationFrame(() => {
    el.beatOverlay.style.transition = "opacity 0.45s ease-out";
    el.beatOverlay.style.opacity = "0";
  });
});

updateAudioButtons();
requestAnimationFrame(loop);
