"""PWA 아이콘 생성 (외부 라이브러리 없이). 초록 바탕 + 흰 달력 + 초록 체크.
python3 scripts/make_icons.py → web/public/icons/*.png"""
import struct, zlib, pathlib

OUT = pathlib.Path(__file__).resolve().parent.parent / "web/public/icons"
BG, FG, MARK = (15, 107, 92), (255, 255, 255), (15, 107, 92)
SS = 4  # 슈퍼샘플링 배율(안티앨리어싱)


def rrect(x, y, x0, y0, x1, y1, r):
    if not (x0 <= x <= x1 and y0 <= y <= y1):
        return False
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return ((px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2) ** 0.5


def shade(u, v):
    """u, v ∈ [0,1] 좌표의 색. 내용은 가운데 70% 안(마스커블 안전 영역)."""
    if rrect(u, v, 0.22, 0.25, 0.78, 0.78, 0.07):
        if 0.375 < v < 0.40:  # 머리띠 구분선
            return BG
        for x in (0.36, 0.64):  # 고리 구멍
            if (u - x) ** 2 + (v - 0.315) ** 2 < 0.022 ** 2:
                return BG
        if min(seg_dist(u, v, 0.37, 0.57, 0.46, 0.66), seg_dist(u, v, 0.46, 0.66, 0.64, 0.47)) < 0.035:
            return MARK
        return FG
    for x in (0.36, 0.64):  # 고리
        if rrect(u, v, x - 0.025, 0.19, x + 0.025, 0.31, 0.025):
            return FG
    return BG


def png(size, path):
    rows = []
    n = size * SS
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            acc = [0, 0, 0]
            for sy in range(SS):
                for sx in range(SS):
                    c = shade((x * SS + sx + 0.5) / n, (y * SS + sy + 0.5) / n)
                    acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]
            row += bytes(a // (SS * SS) for a in acc)
        rows.append(bytes(row))
    raw = zlib.compress(b"".join(rows), 9)
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)) + chunk(b"IDAT", raw) + chunk(b"IEND", b""))


for size, name in [(192, "icon-192.png"), (512, "icon-512.png"), (180, "apple-touch-icon.png"), (32, "favicon-32.png")]:
    png(size, OUT / name)
    print(name)
