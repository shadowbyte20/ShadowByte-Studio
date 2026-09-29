const http = require("http");
const WebSocket = require("ws");

const PORT = Number(process.env.PORT || 8080);
const rooms = new Map();

function newRoomCode() {
  let code;
  do {
    code = String(Math.floor(100000 + Math.random() * 900000));
  } while (rooms.has(code));
  return code;
}

function send(ws, data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function broadcast(room, data, except = null) {
  for (const player of [room.white, room.black]) {
    if (player && player !== except) send(player, data);
  }
}

function closeRoom(code, message = "Room closed") {
  const room = rooms.get(code);
  if (!room) return;
  broadcast(room, { type: "room-closed", message });
  if (room.white) room.white.roomCode = null;
  if (room.black) room.black.roomCode = null;
  rooms.delete(code);
}

const httpServer = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Shadow Chess X 2.0 multiplayer server is running.");
});

const wss = new WebSocket.Server({ server: httpServer });

wss.on("connection", (ws) => {
  ws.roomCode = null;
  ws.color = null;

  send(ws, {
    type: "hello",
    game: "Shadow Chess X 2.0",
    protocol: 1
  });

  ws.on("message", raw => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      send(ws, { type: "error", message: "Invalid message." });
      return;
    }

    if (msg.type === "create") {
      if (ws.roomCode) {
        send(ws, { type: "error", message: "You are already in a room." });
        return;
      }

      const code = newRoomCode();
      rooms.set(code, {
        white: ws,
        black: null
      });

      ws.roomCode = code;
      ws.color = "w";

      send(ws, {
        type: "room-created",
        room: code,
        color: "w",
        started: false
      });
      return;
    }

    if (msg.type === "join") {
      const code = String(msg.room || "").trim();

      if (!/^\d{6}$/.test(code)) {
        send(ws, { type: "error", message: "Room code must be 6 digits." });
        return;
      }

      const room = rooms.get(code);
      if (!room) {
        send(ws, { type: "error", message: "Room not found." });
        return;
      }

      if (room.black) {
        send(ws, { type: "error", message: "Room is full." });
        return;
      }

      if (room.white === ws) {
        send(ws, { type: "error", message: "You created this room." });
        return;
      }

      room.black = ws;
      ws.roomCode = code;
      ws.color = "b";

      send(ws, {
        type: "room-joined",
        room: code,
        color: "b",
        started: true
      });

      if (room.white) {
        send(room.white, {
          type: "player-joined",
          room: code,
          color: "w",
          started: true
        });
      }
      return;
    }

    const code = ws.roomCode;
    const room = code ? rooms.get(code) : null;

    if (!room) {
      send(ws, { type: "error", message: "You are not in a room." });
      return;
    }

    if (msg.type === "state") {
      if (msg.room !== code || msg.color !== ws.color) {
        send(ws, { type: "error", message: "State rejected." });
        return;
      }

      if (!room.white || !room.black) {
        send(ws, { type: "error", message: "Waiting for opponent." });
        return;
      }

      // Relay the complete position to the other player.
      // The client chess engine remains responsible for legal move generation.
      broadcast(room, {
        type: "state",
        room: code,
        color: ws.color,
        state: msg.state
      }, ws);
      return;
    }

    if (msg.type === "rematch") {
      broadcast(room, { type: "rematch" }, ws);
      return;
    }

    if (msg.type === "leave") {
      if (msg.room === code) {
        const other = ws.color === "w" ? room.black : room.white;
        if (other) send(other, { type: "player-left" });
        closeRoom(code, "A player left the room.");
      }
      try { ws.close(); } catch {}
      return;
    }

    send(ws, { type: "error", message: "Unknown message type." });
  });

  ws.on("close", () => {
    const code = ws.roomCode;
    const room = code ? rooms.get(code) : null;
    if (!room) return;

    const other = ws.color === "w" ? room.black : room.white;
    if (other) send(other, { type: "player-left" });

    rooms.delete(code);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Shadow Chess X 2.0 server listening on port ${PORT}`);
});
