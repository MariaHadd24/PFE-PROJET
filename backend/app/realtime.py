from __future__ import annotations

import asyncio
from typing import Any, Dict, Set

import anyio
from fastapi import WebSocket


class RealtimeHub:
    def __init__(self) -> None:
        self._clients: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._clients.add(ws)

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self._clients.discard(ws)

    async def broadcast(self, message: Dict[str, Any]) -> None:
        async with self._lock:
            clients = list(self._clients)

        if not clients:
            return

        dead: list[WebSocket] = []
        for ws in clients:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)

        if dead:
            async with self._lock:
                for ws in dead:
                    self._clients.discard(ws)


hub = RealtimeHub()


def notify(message: Dict[str, Any]) -> None:
    """Best-effort cross-thread notify.

    Endpoints are mostly sync (run in a threadpool), while websocket
    connections live in the main event loop. Use AnyIO to hop threads.
    """

    # If called from a worker thread under AnyIO, this schedules on the main loop.
    try:
        anyio.from_thread.run(hub.broadcast, message)
        return
    except Exception:
        pass

    # If called from inside an event loop, schedule a task.
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return

    try:
        loop.create_task(hub.broadcast(message))
    except Exception:
        return
