"""Split knowledge markdown into heading-scoped chunks.

Mirrors the Shopify chatbot's settings (500 chars, 75 overlap) but splits on
markdown headings first, so a Q&A pair ("## question" + answer) stays together.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass

MAX_CHARS = 500
OVERLAP = 75

_HEADING = re.compile(r"^#{1,6}\s+(.*)$")
_FRONT_MATTER = re.compile(r"^category:\s")


@dataclass(frozen=True)
class Chunk:
    source: str
    heading: str
    content: str
    content_hash: str


def chunk_markdown(
    text: str, source: str, max_chars: int = MAX_CHARS, overlap: int = OVERLAP
) -> list[Chunk]:
    """Return chunks for one markdown document. ``source`` is stored as-is."""
    chunks: list[Chunk] = []
    for heading, body in _sections(text):
        for piece in _windows(body, max_chars, overlap):
            content = f"{heading}\n{piece}" if heading else piece
            digest = hashlib.sha256(f"{source}\n{content}".encode()).hexdigest()
            chunks.append(Chunk(source, heading, content, digest))
    return chunks


def _sections(text: str) -> list[tuple[str, str]]:
    lines = text.splitlines()
    first = next((i for i, line in enumerate(lines) if line.strip()), None)
    if first is not None and _FRONT_MATTER.match(lines[first]):
        lines = lines[first + 1 :]

    sections: list[tuple[str, str]] = []
    heading, body = "", list[str]()
    for line in lines:
        match = _HEADING.match(line)
        if match:
            sections.append((heading, "\n".join(body).strip()))
            heading, body = match.group(1).strip(), []
        else:
            body.append(line)
    sections.append((heading, "\n".join(body).strip()))
    return [(h, b) for h, b in sections if b]


def _windows(body: str, max_chars: int, overlap: int) -> list[str]:
    if len(body) <= max_chars:
        return [body]
    step = max_chars - overlap
    return [body[i : i + max_chars] for i in range(0, len(body) - overlap, step)]
