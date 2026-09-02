from __future__ import annotations

import hashlib
import math
import re


def embed_deterministically(text: str, dimensions: int = 64) -> tuple[float, ...]:
    if not 8 <= dimensions <= 3072:
        raise ValueError("embedding dimensions out of bounds")
    values = [0.0 for _ in range(dimensions)]
    for token in re.findall(r"[\w+#.-]{2,}", text.lower())[:4000]:
        digest = hashlib.sha256(token.encode()).digest()
        bucket = int.from_bytes(digest[:4], "big") % dimensions
        values[bucket] += 1 if digest[4] % 2 == 0 else -1
    norm = math.sqrt(sum(value * value for value in values)) or 1
    return tuple(value / norm for value in values)


def compatible_embedding(existing_dimensions: int | None, requested_dimensions: int) -> bool:
    return existing_dimensions is None or existing_dimensions == requested_dimensions
