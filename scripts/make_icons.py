"""Draw the PWA icons with the standard library. No image package required."""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "icons"


def chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def png(size: int) -> bytes:
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        for x in range(size):
            raw.extend(pixel(x, y, size))
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")


def pixel(x: int, y: int, size: int) -> tuple[int, int, int, int]:
    green = (18, 56, 42, 255)
    cream = (244, 231, 200, 255)
    gold = (226, 179, 60, 255)
    cx = cy = (size - 1) / 2
    nx = (x - cx) / size
    ny = (y - cy) / size
    # Drop of milk, sitting in the upper half of a cream disc.
    drop_y = ny + 0.06
    in_disc = nx * nx + (ny - 0.04) ** 2 <= 0.16**2
    in_drop = (nx * nx) / 0.07**2 + ((drop_y + 0.02) ** 2) / 0.16**2 <= 1 and drop_y < 0.02
    if in_drop:
        return gold
    if in_disc:
        return cream
    return green


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for size in (192, 512):
        (OUT / f"icon-{size}.png").write_bytes(png(size))


if __name__ == "__main__":
    main()
