const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3000;
const MATCH_DURATION = 60000;
const COUNTDOWN = 3000;
const MAX_PLAYERS = 100;
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
const rooms = new Map();

function makeToken() {
  return crypto.randomBytes(24).toString("hex");
}

function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (rooms.has(code));
  return code;
}

function findRoomBySocket(socketId) {
  for (const room of rooms.values()) {
    if (room.players.has(socketId)) return room;
  }
  return null;
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

function roomSnapshot(room) {
  return {
    code: room.code,
    status: room.status,
    admin: room.admin || null,
    owner: room.players.has(room.ownerId) ? room.players.get(room.ownerId).username : null,
    players: [...room.players.values()].map((p) => ({ username: p.username, score: p.score })),
    maxPlayers: MAX_PLAYERS,
  };
}

function emitToPlayers(room, event, payload) {
  for (const socketId of room.players.keys()) {
    io.to(socketId).emit(event, payload);
  }
}

function broadcastRoom(room) {
  const snap = roomSnapshot(room);
  emitToPlayers(room, "roomUpdate", snap);
}

function clearMatchTimer(room) {
  if (room.matchTimer) {
    clearTimeout(room.matchTimer);
    room.matchTimer = null;
  }
}

function endMatch(room) {
  clearMatchTimer(room);
  clearLiveScoresTimer(room);
  if (!rooms.has(room.code)) return;
  room.status = "waiting";
  const ranking = [...room.players.values()]
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
  for (const p of room.players.values()) {
    p.score = 0;
  }
  emitToPlayers(room, "matchEnd", { ranking });
  broadcastRoom(room);
}

function clearLiveScoresTimer(room) {
  if (room.liveScoresTimer) {
    clearTimeout(room.liveScoresTimer);
    room.liveScoresTimer = null;
  }
  room.liveScoresPending = false;
}

function scheduleLiveScores(room) {
  if (room.liveScoresPending) return;
  const elapsed = Date.now() - (room.lastLiveScoresAt || 0);
  const delay = Math.max(0, 500 - elapsed);
  room.liveScoresPending = true;
  room.liveScoresTimer = setTimeout(() => {
    room.liveScoresPending = false;
    room.liveScoresTimer = null;
    room.lastLiveScoresAt = Date.now();
    if (!rooms.has(room.code)) return;
    const scores = [...room.players.values()]
      .map((x) => ({ username: x.username, score: x.score }))
      .sort((a, b) => b.score - a.score);
    emitToPlayers(room, "liveScores", { scores });
  }, delay);
}

function removeFromRoom(socketId) {
  const room = findRoomBySocket(socketId);
  if (!room) return;
  room.players.delete(socketId);
  if (room.players.size === 0) {
    clearMatchTimer(room);
    clearLiveScoresTimer(room);
    if (room.preCreated) {
      room.ownerId = null;
      return;
    }
    rooms.delete(room.code);
    return;
  }
  if (room.ownerId === socketId) {
    const newOwner = [...room.players.keys()].find((id) => isAdminRole(getRole(room.players.get(id).username)));
    room.ownerId = newOwner || null;
  }
  broadcastRoom(room);
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
    ack({ ok: true, token, username, bestScore: 0, role: users[username].role });
  });

  socket.on("login", ({ username, password }, ack) => {
    username = String(username || "").trim();
    password = String(password || "");
    const users = loadUsers();
    const u = users[username];
    if (!u || hashPassword(password, u.salt) !== u.hash) {
      return ack({ ok: false, error: "用户名或密码错误" });
    }
    const token = makeToken();
    tokens.set(token, username);
    if (username === SUPER_ADMIN && u.role !== "superadmin") {
      u.role = "superadmin";
      saveUsers(users);
    }
    ack({ ok: true, token, username, bestScore: u.bestScore || 0, role: u.role || getRole(username) });
  });

  socket.on("loginWithToken", ({ token }, ack) => {
    const username = tokens.get(token);
    if (!username) return ack({ ok: false });
    const users = loadUsers();
    const u = users[username];
    if (!u) return ack({ ok: false });
    ack({ ok: true, token, username, bestScore: u.bestScore || 0, role: u.role || getRole(username) });
  });

  socket.on("createRoom", (data, ack) => {
    const username = data && tokens.get(data.token);
    if (!username) return ack({ ok: false, error: "未登录" });
    if (!isAdminRole(getRole(username))) {
      return ack({ ok: false, error: "仅管理员可创建房间" });
    }
    removeFromRoom(socket.id);
    const code = makeRoomCode();
    const room = {
      code,
      status: "waiting",
      admin: username,
      ownerId: socket.id,
      players: new Map([[socket.id, { username, score: 0 }]]),
      matchTimer: null,
      preCreated: true,
    };
    rooms.set(code, room);
    ack({ ok: true, room: roomSnapshot(room) });
  });

  socket.on("deleteRoom", (data, ack) => {
    const username = data && tokens.get(data.token);
    if (!username) return ack && ack({ ok: false, error: "未登录" });
    const role = getRole(username);
    const room = findRoomBySocket(socket.id) || rooms.get(String(data.code || "").trim().toUpperCase());
    if (!room) return ack && ack({ ok: false, error: "房间不存在" });
    if (!isAdminRole(role)) return ack && ack({ ok: false, error: "仅管理员可关闭房间" });
    if (role !== "superadmin" && room.admin !== username) {
      return ack && ack({ ok: false, error: "只能关闭自己创建的房间" });
    }
    clearMatchTimer(room);
    clearLiveScoresTimer(room);
    rooms.delete(room.code);
    emitToPlayers(room, "roomClosed", { code: room.code });
    if (ack) ack({ ok: true });
  });

  socket.on("joinRoom", (data, ack) => {
    const username = data && tokens.get(data.token);
    if (!username) return ack({ ok: false, error: "未登录" });
    const code = String(data.code || "").trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return ack({ ok: false, error: "房间不存在" });
    if (room.status !== "waiting") return ack({ ok: false, error: "比赛进行中，请稍后再试" });
    if (room.players.size >= MAX_PLAYERS) {
      return ack({ ok: false, error: `房间已满 (最多 ${MAX_PLAYERS} 人)` });
    }
    removeFromRoom(socket.id);
    if (!room.ownerId && isAdminRole(getRole(username))) {
      room.ownerId = socket.id;
      room.admin = room.admin || username;
    }
    room.players.set(socket.id, { username, score: 0 });
    broadcastRoom(room);
    ack({ ok: true, room: roomSnapshot(room) });
  });

  socket.on("startMatch", (data, ack) => {
    const username = data && tokens.get(data.token);
    const room = findRoomBySocket(socket.id);
    if (!username || !room) return ack && ack({ ok: false, error: "未登录或不在房间" });
    if (!isAdminRole(getRole(username))) {
      return ack && ack({ ok: false, error: "仅管理员可开始比赛，请等待管理员启动" });
    }
    if (room.status === "playing") return ack && ack({ ok: true });
    if (room.status !== "waiting") return ack && ack({ ok: false, error: "房间状态异常，请退出房间重新加入" });
    const startsAt = Date.now() + COUNTDOWN;
    const endsAt = startsAt + MATCH_DURATION;
    room.status = "playing";
    clearLiveScoresTimer(room);
    for (const p of room.players.values()) p.score = 0;
    emitToPlayers(room, "matchStart", { startsAt, endsAt });
    clearMatchTimer(room);
    room.matchTimer = setTimeout(() => endMatch(room), endsAt - Date.now() + 500);
    broadcastRoom(room);
    if (ack) ack({ ok: true });
  });

  socket.on("scoreUpdate", (data) => {
    const username = data && tokens.get(data.token);
    const room = findRoomBySocket(socket.id);
    if (!username || !room || room.status !== "playing") return;
    const p = room.players.get(socket.id);
    if (!p) return;
    if (typeof data.score !== "number" || !isFinite(data.score)) return;
    const score = Math.max(0, Math.round(data.score));
    if (score === p.score) return;
    p.score = score;
    scheduleLiveScores(room);
  });

  socket.on("leaveRoom", () => {
    removeFromRoom(socket.id);
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
    ack({ ok: true, makeAdmin, role: users[target].role || "user" });
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
    removeFromRoom(socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Fruit Ninja server running on port ${PORT}`);
});
