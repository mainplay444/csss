"""Last Round dedicated WebSocket room server.
Usage: python server.py soldier 8765
       python server.py tank 8766
This relays room state; it is still a prototype, not an authoritative game simulation.
"""
import asyncio
import json
import secrets
import sys
import websockets

VALID_MODES = {"soldier", "tank"}
mode = sys.argv[1].lower() if len(sys.argv) > 1 else "soldier"
port = int(sys.argv[2]) if len(sys.argv) > 2 else (8766 if mode == "tank" else 8765)
if mode not in VALID_MODES:
    raise SystemExit("Mode must be 'soldier' or 'tank'.")

ROOMS = {}
PLAYER_TEAMS = {}

async def handler(ws):
    room = None
    try:
        async for raw in ws:
            try:
                msg = json.loads(raw)
            except (json.JSONDecodeError, TypeError):
                continue
            action = msg.get("action")
            requested_mode = "tank" if msg.get("mode") == "tank" else "soldier"
            if action in ("create", "join") and requested_mode != mode:
                await ws.send(json.dumps({"type":"error", "message": f"Это сервер режима {mode}. Выбери соответствующий режим игры."}, ensure_ascii=False))
                continue
            if action == "create":
                room = secrets.token_hex(3).upper()[:6]
                ROOMS[room] = {ws}
                PLAYER_TEAMS[ws] = "T"
                await ws.send(json.dumps({"type":"room_created", "code":room, "team":"T", "mode":mode, "players":1}))
            elif action == "join":
                code = str(msg.get("code", "")).upper()
                if code not in ROOMS:
                    await ws.send(json.dumps({"type":"error", "message":"Комната не найдена"}, ensure_ascii=False))
                    continue
                members = ROOMS[code]
                t_count = sum(1 for peer in members if PLAYER_TEAMS.get(peer) == "T")
                ct_count = sum(1 for peer in members if PLAYER_TEAMS.get(peer) == "CT")
                team = "T" if t_count <= ct_count else "CT"
                room = code
                members.add(ws)
                PLAYER_TEAMS[ws] = team
                await ws.send(json.dumps({"type":"joined", "code":code, "team":team, "mode":mode, "players":len(members)}, ensure_ascii=False))
                await broadcast(room, {"type":"player_joined", "players":len(members)}, exclude=ws)
            elif room and action == "state":
                player = msg.get("player", {})
                if isinstance(player, dict):
                    # Only relay a small, known set of fields.
                    safe = {k: player[k] for k in ("id", "x", "y", "angle", "team", "hp", "vehicle") if k in player}
                    await broadcast(room, {"type":"state", "player":safe}, exclude=ws)
            elif room and action == "chat":
                await broadcast(room, {"type":"chat", "text":str(msg.get("text", ""))[:200]}, exclude=ws)
    finally:
        if room and room in ROOMS:
            ROOMS[room].discard(ws)
            PLAYER_TEAMS.pop(ws, None)
            if not ROOMS[room]:
                del ROOMS[room]
            else:
                await broadcast(room, {"type":"player_left", "players":len(ROOMS[room])})

async def broadcast(room, payload, exclude=None):
    peers = [peer for peer in ROOMS.get(room, set()) if peer is not exclude]
    if peers:
        data = json.dumps(payload, ensure_ascii=False)
        await asyncio.gather(*(peer.send(data) for peer in peers), return_exceptions=True)

async def main():
    async with websockets.serve(handler, "0.0.0.0", port):
        print(f"Last Round {mode} server listening on ws://0.0.0.0:{port}")
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
