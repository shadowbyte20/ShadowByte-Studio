# Shadow Chess X 2.0 — Online Multiplayer

Files:
- Shadow-Chess-X-2.0-Online.html — updated game client
- server.js — WebSocket room server
- package.json — Node.js dependency configuration

## Protocol
- Create Room -> 6-digit room code
- Join Room -> second player gets Black
- Server relays complete board-state snapshots
- The existing chess engine remains on each client for legal move selection

## Important
The HTML client contains a placeholder:
`wss://YOUR-SHADOW-CHESS-SERVER.example`

Replace that value with the secure WebSocket URL of your deployed Node.js server.

GitHub Pages can host the HTML file, but the Node.js WebSocket server must run separately.
