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

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || "";
const USE_SUPABASE = !!(SUPABASE_URL && SUPABASE_KEY);

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

async function sbJson(pathname, options) {
  const res = await fetch(`${SUPABASE_URL}${pathname}`, {
    method: options.method || "GET",
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase request failed: ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const store = {
  async getUser(username) {
    if (USE_SUPABASE) {
      const rows = await sbJson(
        `/rest/v1/users?username=eq.${encodeURIComponent(username)}&select=salt,hash,best_score,role,created_at`
      );
      const r = (rows || [])[0];
      return r
        ? { salt: r.salt, hash: r.hash, bestScore: r.best_score || 0, role: r.role || "user", createdAt: r.created_at }
        : null;
    }
    return loadUsers()[username] || null;
  },
  async saveUser(username, user) {
    if (USE_SUPABASE) {
      await sbJson("/rest/v1/users", {
        method: "POST",
        body: {
          username,
          salt: user.salt,
          hash: user.hash,
          best_score: user.bestScore || 0,
          role: user.role || "user",
          created_at: new Date(user.createdAt || Date.now()).toISOString(),
        },
      });
      return;
    }
    const users = loadUsers();
    users[username] = user;
    saveUsers(users);
  },
  async updateUser(username, patch) {
    const user = await store.getUser(username);
    if (!user) return;
    if (patch.bestScore !== undefined) user.bestScore = patch.bestScore;
    if (patch.role !== undefined) user.role = patch.role;
    await store.saveUser(username, user);
  },
  async getAllUsers() {
    if (USE_SUPABASE) {
      const rows = await sbJson("/rest/v1/users?select=username,salt,hash,best_score,role,created_at");
      const map = {};
      (rows || []).forEach((r) => {
        map[r.username] = {
          salt: r.salt,
          hash: r.hash,
          bestScore: r.best_score || 0,
          role: r.role || "user",
          createdAt: r.created_at,
        };
      });
      return map;
    }
    return loadUsers();
  },
};

const tokens = new Map();

function makeToken() {
  return crypto.randomBytes(24).toString("hex");
}

async function getRole(username) {
  const u = await store.getUser(username);
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

async function endMatch() {
  clearMatchTimer();
  clearLiveScoresTimer();
  if (arena.status !== "playing") return;
  arena.status = "waiting";
  const ranking = [...arena.players.values()]
    .map((p) => ({ username: p.username, score: p.score }))
    .sort((a, b) => b.score - a.score);
  const soloTest = !!arena.soloTest;
  arena.soloTest = false;
  for (const r of ranking) {
    if (soloTest) break;
    if (r.score <= 0) continue;
    const u = await store.getUser(r.username);
    if (u && r.score > (u.bestScore || 0)) {
      await store.updateUser(r.username, { bestScore: r.score });
    }
  }
  for (const p of arena.players.values()) p.score = 0;
  broadcastArena("matchEnd", { ranking });
  broadcastArena("arenaUpdate", arenaSnapshot());
}

io.on("connection", (socket) => {
  socket.on("register", async ({ username, password }, ack) => {
    username = String(username || "").trim();
    password = String(password || "");
    if (username.length < 2 || username.length > 16) {
      return ack({ ok: false, error: "用户名需 2-16 个字符" });
    }
    if (password.length < 4) {
      return ack({ ok: false, error: "密码至少 4 位" });
    }
    const existing = await store.getUser(username);
    if (existing) {
      return ack({ ok: false, error: "用户名已存在" });
    }
    const salt = crypto.randomBytes(16).toString("hex");
    const role = username === SUPER_ADMIN ? "superadmin" : "user";
    await store.saveUser(username, {
      salt,
      hash: hashPassword(password, salt),
      bestScore: 0,
      role,
      createdAt: Date.now(),
    });
    const token = makeToken();
    tokens.set(token, username);
    addToArena(socket, username, role);
    ack({ ok: true, token, username, bestScore: 0, role });
  });

  socket.on("login", async ({ username, password }, ack) => {
    username = String(username || "").trim();
    password = String(password || "");
    const u = await store.getUser(username);
    if (!u || hashPassword(password, u.salt) !== u.hash) {
      return ack({ ok: false, error: "用户名或密码错误" });
    }
    if (username === SUPER_ADMIN && u.role !== "superadmin") {
      u.role = "superadmin";
      await store.saveUser(username, u);
    }
    const token = makeToken();
    tokens.set(token, username);
    const role = u.role || "user";
    addToArena(socket, username, role);
    ack({ ok: true, token, username, bestScore: u.bestScore || 0, role });
  });

  socket.on("loginWithToken", async ({ token }, ack) => {
    const username = tokens.get(token);
    if (!username) return ack({ ok: false });
    const u = await store.getUser(username);
    if (!u) return ack({ ok: false });
    const role = u.role || "user";
    addToArena(socket, username, role);
    ack({ ok: true, token, username, bestScore: u.bestScore || 0, role });
  });

  socket.on("startMatch", async (data, ack) => {
    const username = data && tokens.get(data.token);
    if (!username) return ack && ack({ ok: false, error: "未登录" });
    if (!isAdminRole(await getRole(username))) {
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

  socket.on("startSoloTest", async (data, ack) => {
    const username = data && tokens.get(data.token);
    if (!username) return ack && ack({ ok: false, error: "未登录" });
    if (!isAdminRole(await getRole(username))) {
      return ack && ack({ ok: false, error: "仅管理员可开始比赛" });
    }
    if (arena.status === "playing") return ack && ack({ ok: false, error: "比赛正在进行中" });
    if (arena.status !== "waiting") return ack && ack({ ok: false, error: "比赛正在准备中" });
    const startsAt = Date.now() + COUNTDOWN;
    const endsAt = startsAt + 15000;
    arena.status = "playing";
    arena.soloTest = true;
    clearLiveScoresTimer();
    for (const p of arena.players.values()) p.score = 0;
    broadcastArena("matchStart", { startsAt, endsAt, soloTest: true });
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

  socket.on("setAdmin", async (data, ack) => {
    const username = data && tokens.get(data.token);
    if (!username) return ack && ack({ ok: false, error: "未登录" });
    if ((await getRole(username)) !== "superadmin") {
      return ack && ack({ ok: false, error: "仅超级管理员可设置管理员" });
    }
    const target = String(data.username || "").trim();
    const targetUser = await store.getUser(target);
    if (!targetUser) return ack && ack({ ok: false, error: "用户不存在" });
    if (target === SUPER_ADMIN) return ack && ack({ ok: false, error: "超级管理员不可变更" });
    const makeAdmin = !!data.makeAdmin;
    await store.updateUser(target, { role: makeAdmin ? "admin" : "user" });
    const updatedRole = makeAdmin ? "admin" : "user";
    for (const p of arena.players.values()) {
      if (p.username === target) p.role = updatedRole;
    }
    broadcastArena("arenaUpdate", arenaSnapshot());
    ack({ ok: true, makeAdmin, role: updatedRole });
  });

  socket.on("getAdmins", async (data, ack) => {
    const username = data && tokens.get(data.token);
    if (!username) return ack && ack({ ok: false, error: "未登录" });
    if (!isAdminRole(await getRole(username))) return ack && ack({ ok: false, error: "无权限" });
    const users = await store.getAllUsers();
    const list = Object.entries(users)
      .filter(([, u]) => u.role === "admin" || u.role === "superadmin")
      .map(([name, u]) => ({ username: name, role: u.role }));
    ack({ ok: true, list });
  });

  socket.on("getLeaderboard", async (ack) => {
    const users = await store.getAllUsers();
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
  console.log(`Fruit Ninja server running on port ${PORT} (storage: ${USE_SUPABASE ? "Supabase" : "local JSON"})`);
});
