"""Prompt construction for the response agent.

The system prompt is loaded once at process start (auto-cached by OpenAI
once it exceeds 1024 tokens). The user message is rendered per claim.
"""

from app.prompts.render import render_user_message
from app.prompts.system import SYSTEM_PROMPT

__all__ = ["SYSTEM_PROMPT", "render_user_message"]
