"""FastAPI application entry point."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_db
from app.api.v1.router import api_router
from app.websocket.manager import ws_manager
from app.workers.sync_scheduler import start_sync_scheduler, stop_sync_scheduler

settings = get_settings()

# ── Logging ──
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# ── Lifespan ──
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown logic."""
    logger.info("Starting %s (env=%s)", settings.app_name, settings.app_env)

    # Initialize database tables
    await init_db()
    logger.info("Database initialized")

    if settings.seed_on_start:
        try:
            from app.seed import seed_database
            await seed_database()
        except Exception as e:
            logger.warning("Seed failed (may already exist): %s", e)

    # Start sync scheduler
    await start_sync_scheduler()

    yield

    # Shutdown
    logger.info("Shutting down %s", settings.app_name)
    await stop_sync_scheduler()


# ── Application ──
app = FastAPI(
    title=settings.app_name,
    description="Local On-Premise Biometric Attendance & Executive Dashboard",
    version="1.0.0",
    lifespan=lifespan,
)

# Private-network origins so other PCs can use the app over LAN in development.
_LAN_ORIGIN_RE = (
    r"https?://("
    r"localhost"
    r"|127\.0\.0\.1"
    r"|\[::1\]"
    r"|192\.168\.\d{1,3}\.\d{1,3}"
    r"|10\.\d{1,3}\.\d{1,3}\.\d{1,3}"
    r"|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}"
    r")(?::\d+)?"
)

# ── CORS ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=_LAN_ORIGIN_RE if settings.is_development else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── API Routes ──
app.include_router(api_router)


# ── WebSocket ──
@app.websocket("/ws/dashboard")
async def websocket_dashboard(websocket: WebSocket):
    """WebSocket endpoint for live dashboard updates."""
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep connection alive, receive client pings
            data = await websocket.receive_text()
            if data == "ping":
                await ws_manager.send_personal(websocket, {"event": "pong"})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)


# ── Root ──
@app.get("/")
async def root():
    return {
        "name": settings.app_name,
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }
