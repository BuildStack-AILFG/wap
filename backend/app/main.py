from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.broadcasts import router as broadcasts_router
from app.api.contacts import router as contacts_router
from app.api.custom_replies import router as custom_replies_router
from app.api.flows import router as flows_router
from app.api.settings import router as settings_router
from app.api.templates import router as templates_router
from app.api.workspace import router as workspace_router
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(title="WhatsApp Automation API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(contacts_router, prefix="/api")
app.include_router(templates_router, prefix="/api")
app.include_router(broadcasts_router, prefix="/api")
app.include_router(flows_router, prefix="/api")
app.include_router(custom_replies_router, prefix="/api")
app.include_router(settings_router, prefix="/api")
app.include_router(workspace_router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
