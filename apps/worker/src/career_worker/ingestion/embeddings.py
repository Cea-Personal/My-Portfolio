from __future__ import annotations

import hashlib
import math


def embed_deterministically(text: str, dimensions: int = 64) -> tuple[float, ...]:
    if not 8 <= dimensions <= 3072:
        raise ValueError("embedding dimensions out of bounds")
    digest = hashlib.sha256(text.encode()).digest()
    values = [((digest[index % len(digest)] / 255) * 2) - 1 for index in range(dimensions)]
    norm = math.sqrt(sum(value * value for value in values)) or 1
    return tuple(value / norm for value in values)


def compatible_embedding(existing_dimensions: int | None, requested_dimensions: int) -> bool:
    return existing_dimensions is None or existing_dimensions == requested_dimensions
