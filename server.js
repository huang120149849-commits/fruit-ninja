const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3000;
const MATCH_DURATION = 60000;
const COUNTDOWN = 3000;
const SUPER_ADMIN = (process.env.SUPER_ADMIN || "admin").trim();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname)));

const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const USERS_FILE = path.join(DATA_DIR, "users.json");

function loadUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString("hex");
}

const tokens = new Map();

function makeToken() {
  return crypto.randomBytes(24).toString("hex");
}

function getRole(username) {
  const users = loadUsers();
  const u = users[username];
  if (u && u.role) return u.role;
  if (username === SUPER_ADMIN) return "superadmin";
  return "user";
}

function isAdminRole(role) {
  return role === "admin" || role === "superadmin";
}

const arena = {
  status: "waiting",
  players: new Map(),
  matchTimer: null,
  liveScoresTimer: null,
  liveScoresPending: false,
  lastLiveScoresAt: 0,
};

function arenaSnapshot() {
  return {
    status: arena.status,
    players: [...arena.players.values()].map((p) => ({ username: p.username, score: p.score, role: p.role })),
  };
}

function broadcastArena(event, payload) {
  for (const socketId of arena.players.keys()) {
    io.to(socketId).emit(event, payload);
  }
}

function addToArena(socket, username, role) {
  if (!arena.players.has(socket.id)) {
    arena.players.set(socket.id, { username, score: 0, role });
    broadcastArena("arenaUpdate", arenaSnapshot());
  } else {
    const p = arena.players.get(socket.id);
    p.username = username;
    p.role = role;
  }
}

function removeFromArena(socketId) {
  if (arena.players.delete(socketId)) {
    broadcastArena("arenaUpdate", arenaSnapshot());
  }
}

function clearMatchTimer() {
  if (arena.matchTimer) {
    clearTimeout(arena.matchTimer);
    arena.matchTimer = null;
  }
}

function clearLiveScoresTimer() {
  if (arena.liveScoresTimer) {
    clearTimeout(arena.liveScoresTimer);
    arena.liveScoresTimer = null;
  }
  arena.liveScoresPending = false;
}

function scheduleLiveScores() {
  if (arena.liveScoresPending) return;
  const elapsed = Date.now() - (arena.lastLiveScoresAt || 0);
  const delay = Math.max(0, 500 - elapsed);
  arena.liveScoresPending = true;
  arena.liveScoresTimer = setTimeout(() => {
    arena.liveScoresPending = false;
    arena.liveScoresTimer = null;
    arena.lastLiveScoresAt = Date.now();
    if (arena.status !== "playing") return;
    const scores = [...arena.players.values()]
      .map((x) => ({ username: x.username, score: x.score }))
      .sort((a, b) => b.score - a.score);
    broadcastArena("liveScores", { scores });
  }, delay);
}

function endMatch() {
  clearMatchTimer();
  clearLiveScoresTimer();
  if (arena.status !== "playing") return;
  arena.status = "waiting";
  const ranking = [...arena.players.values()]
    .map((p) => ({ username: p.username, score: p.score }))
    .sort((a, b) => b.score - a.score);
  const users = loadUsers();
  let changed = false;
  for (const r of ranking) {
    const u = users[r.username];
    if (u && r.score > (u.bestScore || 0)) {
      u.bestScore = r.score;
      changed = true;
    }
  }
  if (changed) saveUsers(users);
  for (const p of arena.players.values()) p.score = 0;
  broadcastArena("matchEnd", { ranking });
  broadcastArena("arenaUpdate", arenaSnapshot());
}

io.on("connection", (socket) => {
  socket.on("register", ({ username, password }, ack) => {
    username = String(username || "").trim();
    password = String(password || "");
    if (username.length < 2 || username.length > 16) {
      return ack({ ok: false, error: "用户名需 2-16 个字符" });
    }
    if (password.length < 4) {
      return ack({ ok: false, error: "密码至少 4 位" });
    }
    const users = loadUsers();
    if (users[username]) {
      return ack({ ok: false, error: "用户名已存在" });
    }
    const salt = crypto.randomBytes(16).toString("hex");
    users[username] = {
      salt,
      hash: hashPassword(password, salt),
      bestScore: 0,
      role: username === SUPER_ADMIN ? "superadmin" : "user",
      createdAt: Date.now(),
    };
    saveUsers(users);
    const token = makeToken();
    tokens.set(token, username);
    const role = users[username].role;
    addToArena(socket, username, role);
    ack({ ok: true, token, username, bestScore: 0, role });
  });

  socket.on("login", ({ username, password }, ack) => {
    username = String(username || "").trim();
    password = String(password || "");
    const users = loadUsers();
    const u = users[username];
    if (!u || hashPassword(password, u.salt) !== u.hash) {
      return ack({ ok: false, error: "用户名或密码错误" });
    }
    if (username === SUPER_ADMIN && u.role !== "superadmin") {
      u.role = "superadmin";
      saveUsers(users);
    }
    const token = makeToken();
    tokens.set(token, username);
    const role = u.role || getRole(username);
    addToArena(socket, username, role);
    ack({ ok: true, token, username, bestScore: u.bestScore || 0, role });
  });

  socket.on("loginWithToken", ({ token }, ack) => {
    const username = tokens.get(token);
    if (!username) return ack({ ok: false });
    const users = loadUsers();
    const u = users[username];
    if (!u) return ack({ ok: false });
    const role = u.role || getRole(username);
    addToArena(socket, username, role);
    ack({ ok: true, token, username, bestScore: u.bestScore || 0, role });
  });

  socket.on("startMatch", (data, ack) => {
    const username = data && tokens.get(data.token);
    if (!username) return ack && ack({ ok: false, error: "未登录" });
    if (!isAdminRole(getRole(username))) {
      return ack && ack({ ok: false, error: "仅管理员可开始比赛" });
    }
    if (arena.status === "playing") return ack && ack({ ok: true });
    if (arena.status !== "waiting") return ack && ack({ ok: false, error: "比赛正在准备中" });
    const startsAt = Date.now() + COUNTDOWN;
    const endsAt = startsAt + MATCH_DURATION;
    arena.status = "playing";
    clearLiveScoresTimer();
    for (const p of arena.players.values()) p.score = 0;
    broadcastArena("matchStart", { startsAt, endsAt });
    broadcastArena("arenaUpdate", arenaSnapshot());
    clearMatchTimer();
    arena.matchTimer = setTimeout(endMatch, endsAt - Date.now() + 500);
    if (ack) ack({ ok: true });
  });

  socket.on("scoreUpdate", (data) => {
    const username = data && tokens.get(data.token);
    if (!username || arena.status !== "playing") return;
    const p = arena.players.get(socket.id);
    if (!p) return;
    if (typeof data.score !== "number" || !isFinite(data.score)) return;
    const score = Math.max(0, Math.round(data.score));
    if (score === p.score) return;
    p.score = score;
    scheduleLiveScores();
  });

  socket.on("setAdmin", (data, ack) => {
    const username = data && tokens.get(data.token);
    if (!username) return ack && ack({ ok: false, error: "未登录" });
    if (getRole(username) !== "superadmin") {
      return ack && ack({ ok: false, error: "仅超级管理员可设置管理员" });
    }
    const target = String(data.username || "").trim();
    const users = loadUsers();
    if (!users[target]) return ack && ack({ ok: false, error: "用户不存在" });
    if (target === SUPER_ADMIN) return ack && ack({ ok: false, error: "超级管理员不可变更" });
    const makeAdmin = !!data.makeAdmin;
    if (makeAdmin) {
      users[target].role = "admin";
    } else {
      delete users[target].role;
    }
    saveUsers(users);
    const updatedRole = users[target].role || "user";
    for (const p of arena.players.values()) {
      if (p.username === target) {
        p.role = updatedRole;
      }
    }
    broadcastArena("arenaUpdate", arenaSnapshot());
    ack({ ok: true, makeAdmin, role: updatedRole });
  });

  socket.on("getAdmins", (data, ack) => {
    const username = data && tokens.get(data.token);
    if (!username) return ack && ack({ ok: false, error: "未登录" });
    if (!isAdminRole(getRole(username))) return ack && ack({ ok: false, error: "无权限" });
    const users = loadUsers();
    const list = Object.entries(users)
      .filter(([, u]) => u.role === "admin" || u.role === "superadmin")
      .map(([name, u]) => ({ username: name, role: u.role }));
    ack({ ok: true, list });
  });

  socket.on("getLeaderboard", (ack) => {
    const users = loadUsers();
    const list = Object.entries(users)
      .map(([username, u]) => ({ username, bestScore: u.bestScore || 0 }))
      .sort((a, b) => b.bestScore - a.bestScore)
      .slice(0, 10);
    ack({ ok: true, list });
  });

  socket.on("disconnect", () => {
    removeFromArena(socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Fruit Ninja server running on port ${PORT}`);
});
