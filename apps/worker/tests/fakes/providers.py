from __future__ import annotations

import hashlib


def fake_embedding(text: str, dimensions: int = 8) -> list[float]:
    digest = hashlib.sha256(text.encode()).digest()
    return [digest[index % len(digest)] / 255 for index in range(dimensions)]
