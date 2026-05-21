"""FastAPI app entry point.

Run locally:

    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI

from app import __version__
from app.config import get_settings
from app.graph.build import get_compiled_graph
from app.routes import health, pipeline, tools


def _configure_logging(level: str) -> None:
    logging.basicConfig(
        level=level.upper(),
        format="%(asctime)s %(levelname)-7s %(name)s :: %(message)s",
    )


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Validate settings + warm the compiled graph + import the system prompt once."""
    settings = get_settings()
    _configure_logging(settings.log_level)
    log = logging.getLogger(__name__)

    # Warm singletons so the first request doesn't pay the cost.
    get_compiled_graph()
    # Pre-import to read the policy doc + bake the system prompt at boot.
    from app.prompts import SYSTEM_PROMPT  # noqa: F401

    log.info(
        "joola-ai-agents v%s ready — model=%s policy=%s",
        __version__,
        settings.openai_model,
        settings.policy_version,
    )

    yield

    log.info("joola-ai-agents shutting down")


app = FastAPI(
    title="JOOLA AI Agents",
    description="7-agent LangGraph pipeline for warranty claim processing.",
    version=__version__,
    lifespan=lifespan,
)

app.include_router(health.router)
app.include_router(pipeline.router)
app.include_router(tools.router)
