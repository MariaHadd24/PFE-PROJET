from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.api import router as api_router
from app.seed import seed_data, sync_asset_statuses_from_assignments

app = FastAPI(title="PFE Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.on_event("startup")
def _startup() -> None:
    seed_data()
    # Ensure SQL data stays consistent even after imports/manual edits.
    sync_asset_statuses_from_assignments()
