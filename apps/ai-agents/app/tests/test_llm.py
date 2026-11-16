"""Draft-writer provider switch (LLM_PROVIDER): OpenAI (default) or Claude.

Offline: both SDK clients are replaced by fakes that record the request.
"""

from __future__ import annotations

import json
from types import SimpleNamespace
from typing import Any

import pytest

from app.config import get_settings
from app.services import llm

REPLY = {"voice_reply": "Hi", "email_subject": "Re: paddle", "email_body": "Thanks for writing."}


@pytest.fixture(autouse=True)
def _fresh():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


class _FakeOpenAI:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    def _create(self, **kw: Any) -> Any:
        self.calls.append(kw)
        msg = SimpleNamespace(content=json.dumps(REPLY))
        return SimpleNamespace(choices=[SimpleNamespace(message=msg)])


class _FakeAnthropic:
    def __init__(self, text: str = json.dumps(REPLY)) -> None:
        self.calls: list[dict[str, Any]] = []
        self.text = text
        self.messages = SimpleNamespace(create=self._create)

    def _create(self, **kw: Any) -> Any:
        self.calls.append(kw)
        return SimpleNamespace(
            content=[SimpleNamespace(type="text", text=self.text)],
            model=kw["model"],
            stop_reason="end_turn",
        )


@pytest.fixture
def fakes(monkeypatch: pytest.MonkeyPatch) -> tuple[_FakeOpenAI, _FakeAnthropic]:
    oa, an = _FakeOpenAI(), _FakeAnthropic()
    monkeypatch.setattr(llm, "get_openai", lambda: oa)
    monkeypatch.setattr(llm, "get_anthropic", lambda: an)
    return oa, an


def test_default_provider_is_openai_with_original_settings(fakes) -> None:
    oa, an = fakes
    raw, model = llm.draft_reply("SYSTEM", "USER")
    assert json.loads(raw) == REPLY and model == "gpt-4o"
    assert an.calls == []
    call = oa.calls[0]
    assert call["model"] == "gpt-4o"
    assert call["response_format"] == {"type": "json_object"}
    assert call["temperature"] == 0.4
    assert call["messages"] == [{"role": "system", "content": "SYSTEM"}, {"role": "user", "content": "USER"}]


def test_anthropic_provider_uses_cheap_model_schema_cap_and_cache(fakes, monkeypatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "anthropic")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    get_settings.cache_clear()
    oa, an = fakes
    raw, model = llm.draft_reply("SYSTEM", "USER")
    assert json.loads(raw) == REPLY and model == "claude-haiku-5-5"
    assert oa.calls == []
    call = an.calls[0]
    assert call["model"] == "claude-haiku-5-5"
    assert call["max_tokens"] == llm.DRAFT_MAX_TOKENS
    assert "temperature" not in call  # not a Messages API parameter any more
    # Drafting needs no reasoning; default thinking used up max_tokens and cut the JSON (live QA).
    assert call["thinking"] == {"type": "disabled"}
    assert call["system"] == [{"type": "text", "text": "SYSTEM", "cache_control": {"type": "ephemeral"}}]
    assert call["messages"] == [{"role": "user", "content": "USER"}]
    schema = call["output_config"]["format"]["schema"]
    assert call["output_config"]["format"]["type"] == "json_schema"
    assert set(schema["required"]) == {"voice_reply", "email_subject", "email_body"}
    assert schema["additionalProperties"] is False
    # Live QA: Claude left voice_reply empty on email claims (3/6) — every field must be filled.
    assert all(schema["properties"][k]["minLength"] == 1 for k in schema["required"])
    assert "even for email" in schema["properties"]["voice_reply"]["description"]


def test_anthropic_without_key_falls_back_to_openai(fakes, monkeypatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "anthropic")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "")
    get_settings.cache_clear()
    oa, an = fakes
    _, model = llm.draft_reply("SYSTEM", "USER")
    assert model == "gpt-4o" and an.calls == [] and len(oa.calls) == 1


def test_provider_typo_falls_back_to_openai(monkeypatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "claud")
    get_settings.cache_clear()
    assert get_settings().llm_provider == "openai"


def test_model_can_be_changed_without_code(fakes, monkeypatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "anthropic")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setenv("ANTHROPIC_MODEL", "claude-sonnet-5-5")
    get_settings.cache_clear()
    _, model = llm.draft_reply("SYSTEM", "USER")
    assert model == "claude-sonnet-5-5"


def test_truncated_anthropic_reply_raises_clearly(monkeypatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "anthropic")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    get_settings.cache_clear()
    cut = _FakeAnthropic()
    cut._create = lambda **kw: SimpleNamespace(  # type: ignore[method-assign]
        content=[SimpleNamespace(type="text", text='{"voice_reply":"I am sorry')],
        model=kw["model"], stop_reason="max_tokens")
    cut.messages = SimpleNamespace(create=cut._create)
    monkeypatch.setattr(llm, "get_anthropic", lambda: cut)
    with pytest.raises(llm.ClaudeOutputError, match="max_tokens"):
        llm._claude_draft("SYSTEM", "USER")


def test_anthropic_reply_without_text_raises(monkeypatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "anthropic")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    get_settings.cache_clear()
    empty = _FakeAnthropic()
    empty._create = lambda **kw: SimpleNamespace(content=[], model=kw["model"], stop_reason="refusal")  # type: ignore[method-assign]
    empty.messages = SimpleNamespace(create=empty._create)
    monkeypatch.setattr(llm, "get_anthropic", lambda: empty)
    with pytest.raises(llm.ClaudeOutputError, match="no text"):
        llm._claude_draft("SYSTEM", "USER")


def test_anthropic_call_only_uses_real_sdk_parameters(fakes, monkeypatch) -> None:
    """The fake accepts anything — so check every argument exists on the real SDK method.
    (Caught live: the SDK rejects ``temperature``.)"""
    import inspect

    import anthropic

    monkeypatch.setenv("LLM_PROVIDER", "anthropic")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    get_settings.cache_clear()
    _, an = fakes
    llm.draft_reply("SYSTEM", "USER")
    real = inspect.signature(anthropic.Anthropic(api_key="x").messages.create).parameters
    assert set(an.calls[0]) <= set(real), set(an.calls[0]) - set(real)


# ---- runtime fallback: a Claude failure must never stop drafting ------------------ #


def _anthropic_on(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "anthropic")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    get_settings.cache_clear()


def _raising(exc: Exception) -> _FakeAnthropic:
    fake = _FakeAnthropic()

    def _create(**kw: Any) -> Any:
        fake.calls.append(kw)
        raise exc

    fake.messages = SimpleNamespace(create=_create)
    return fake


def _api_errors() -> list[Exception]:
    import anthropic
    import httpx

    req = httpx.Request("POST", "https://api.anthropic.com/v1/messages")

    def status(code: int, cls: type) -> Exception:
        return cls("boom", response=httpx.Response(code, request=req), body=None)

    return [
        status(401, anthropic.AuthenticationError),  # rotated / wrong key
        status(429, anthropic.RateLimitError),
        status(529, anthropic.InternalServerError),  # overloaded
        anthropic.APIConnectionError(request=req),
        anthropic.APITimeoutError(request=req),
    ]


@pytest.mark.parametrize("exc", _api_errors(), ids=lambda e: type(e).__name__)
def test_claude_api_error_falls_back_to_openai(fakes, monkeypatch, exc: Exception) -> None:
    _anthropic_on(monkeypatch)
    oa, _ = fakes
    broken = _raising(exc)
    monkeypatch.setattr(llm, "get_anthropic", lambda: broken)
    raw, model = llm.draft_reply("SYSTEM", "USER")
    assert json.loads(raw) == REPLY and model == "gpt-4o"
    assert len(broken.calls) == 1 and len(oa.calls) == 1


def test_cut_off_claude_reply_falls_back_to_openai(fakes, monkeypatch) -> None:
    _anthropic_on(monkeypatch)
    oa, _ = fakes
    cut = _FakeAnthropic()
    cut.messages = SimpleNamespace(create=lambda **kw: SimpleNamespace(
        content=[SimpleNamespace(type="text", text='{"voice_reply":"I am')],
        model=kw["model"], stop_reason="max_tokens"))
    monkeypatch.setattr(llm, "get_anthropic", lambda: cut)
    _, model = llm.draft_reply("SYSTEM", "USER")
    assert model == "gpt-4o" and len(oa.calls) == 1


def test_claude_invalid_json_falls_back_to_openai(fakes, monkeypatch) -> None:
    _anthropic_on(monkeypatch)
    oa, _ = fakes
    monkeypatch.setattr(llm, "get_anthropic", lambda: _FakeAnthropic(text="not json"))
    raw, model = llm.draft_reply("SYSTEM", "USER")
    assert model == "gpt-4o" and json.loads(raw) == REPLY and len(oa.calls) == 1


def test_programming_errors_are_not_hidden_by_fallback(fakes, monkeypatch) -> None:
    """Only provider/output failures fall back; a bug in our own code must surface."""
    _anthropic_on(monkeypatch)
    monkeypatch.setattr(llm, "get_anthropic", lambda: _raising(TypeError("bad argument")))
    with pytest.raises(TypeError):
        llm.draft_reply("SYSTEM", "USER")


def test_claude_empty_field_falls_back_to_openai(fakes, monkeypatch) -> None:
    _anthropic_on(monkeypatch)
    oa, _ = fakes
    empty_voice = json.dumps({**REPLY, "voice_reply": "  "})
    monkeypatch.setattr(llm, "get_anthropic", lambda: _FakeAnthropic(text=empty_voice))
    _, model = llm.draft_reply("SYSTEM", "USER")
    assert model == "gpt-4o" and len(oa.calls) == 1
