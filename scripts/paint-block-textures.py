"""Paint the block textures of 하늘섬 마을 (the imported block map, internal id ascent_trial).

Every tile is drawn here from simple rules (noise, bricks, boards, rings, sprites) with this project's own colours;
nothing is read from a game client or another texture pack. The tile list, its order and the block-state palette
(which tile each block face uses, and the tint the geometry multiplies in) are kept from the existing palette, so
geometry.bin and the mobile geometry do not change: a tile that was fully opaque stays fully opaque, a cut-out tile
keeps see-through pixels, and the glass tiles stay half see-through.

Requires Pillow and numpy.  python scripts/paint-block-textures.py   then   python scripts/package-mobile-map.py
"""
import hashlib, json, math, zlib
from pathlib import Path
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parent.parent
out = root / 'assets/maps/ascent'
src = json.loads((out / 'blocks-palette.json').read_text(encoding='utf8'))
# which tiles are fully solid: the mobile pack's geometry was simplified with these, so they must not change
SOLID = [t['opaque'] for t in json.loads((out / 'mobile/palette.json').read_text(encoding='utf8'))['tiles']]

DYES = {'white': 0xe9ecec, 'orange': 0xf0802c, 'magenta': 0xc456b8, 'light_blue': 0x5fb4dc, 'yellow': 0xf3c63a, 'lime': 0x7cc43a,
        'pink': 0xf09ab4, 'gray': 0x4c5257, 'light_gray': 0x9c9d97, 'cyan': 0x1f8c96, 'purple': 0x7a35ae, 'blue': 0x3746a8,
        'brown': 0x7a5232, 'green': 0x56702a, 'red': 0xae3029, 'black': 0x1c1c22}
WOOD = {'oak': (0xb08a54, 0x6a5232, 0xc49c62), 'spruce': (0x7a5a36, 0x3e2c1a, 0x8c6a42), 'birch': (0xd2c088, 0xe4e2d8, 0xdccc96),
        'jungle': (0xb07c58, 0x5a4422, 0xbc8a64), 'acacia': (0xbc6434, 0x6a625a, 0xc87444), 'dark_oak': (0x4c3220, 0x3a2a1a, 0x5a3c26)}


def rgb(h):
    return np.array([(h >> 16) & 255, (h >> 8) & 255, h & 255], dtype=float)


class Tile:
    def __init__(self, name):
        self.seed = zlib.crc32(name.encode()) or 7
        self.c = np.zeros((16, 16, 3))
        self.a = np.full((16, 16), 255.0)

    def r(self):
        self.seed = (self.seed * 1664525 + 1013904223) & 0xffffffff
        return self.seed / 4294967296

    def fill(self, base, var=0.07, pix=1):
        b = rgb(base) if isinstance(base, int) else base
        for y in range(0, 16, pix):
            for x in range(0, 16, pix):
                self.c[y:y + pix, x:x + pix] = b * (1 + (self.r() - 0.5) * 2 * var)

    def specks(self, col, n, size=1):
        for _ in range(n):
            x, y = int(self.r() * 16), int(self.r() * 16)
            self.c[y:y + size, x:x + size] = rgb(col) * (0.95 + self.r() * 0.1)

    def px(self, x, y, col, a=255):
        if 0 <= x < 16 and 0 <= y < 16:
            self.c[y, x] = rgb(col) if isinstance(col, int) else col
            self.a[y, x] = a


def shade(h, k):
    c = rgb(h) * k
    c = np.clip(c, 0, 255).astype(int)
    return (int(c[0]) << 16) | (int(c[1]) << 8) | int(c[2])


# ── patterns ──
def bricks(t, base, mortar, row=4, w=8, bevel=0.0, var=0.06):
    for y in range(16):
        for x in range(16):
            r_ = y // row
            off = (r_ % 2) * (w // 2)
            if y % row == row - 1 or (x + off) % w == w - 1:
                t.c[y, x] = rgb(mortar) * (1 + (t.r() - 0.5) * 0.08)
            else:
                k = 1 + (bevel if y % row == 0 else 0) + (((x + off) // w + r_ * 3) % 3 - 1) * 0.04
                t.c[y, x] = rgb(base) * k * (1 + (t.r() - 0.5) * 2 * var)


def cobble(t, cols, mortar):
    pts = [(t.r() * 16, t.r() * 16, cols[int(t.r() * len(cols))]) for _ in range(7)]
    for y in range(16):
        for x in range(16):
            d = []
            for sx, sy, col in pts:
                for ox in (-16, 0, 16):
                    for oy in (-16, 0, 16):
                        d.append((math.hypot(x - sx - ox, y - sy - oy), col))
            d.sort(key=lambda v: v[0])
            gap = d[1][0] - d[0][0]
            t.c[y, x] = rgb(mortar) if gap < 0.9 else rgb(d[0][1]) * (0.88 if gap < 1.8 else 1) * (1 + (t.r() - 0.5) * 0.08)


def boards(t, base, line, h=4):
    for y in range(16):
        b = y // h
        seam = (b * 5 + 3) % 16
        for x in range(16):
            t.c[y, x] = rgb(line) if (y % h == h - 1 or x == seam) else rgb(base) * (1 + ((b * 7) % 3 - 1) * 0.05) * (1 + (t.r() - 0.5) * 0.08)


def bark(t, base, dark):
    for y in range(16):
        for x in range(16):
            k = (x * 5 + y // 4) % 4
            t.c[y, x] = (rgb(dark) if k == 0 else rgb(base) * (0.9 + 0.1 * k / 3)) * (1 + (t.r() - 0.5) * 0.1)


def rings(t, inner, bark_c):
    for y in range(16):
        for x in range(16):
            d = max(abs(x - 7.5), abs(y - 7.5))
            t.c[y, x] = rgb(bark_c) if d >= 7 else rgb(inner) * (1.08 if int(d) % 2 else 0.94) * (1 + (t.r() - 0.5) * 0.06)


def plate(t, base, rivets=True):
    t.fill(base, 0.03)
    for i in range(16):
        for (x, y) in ((i, 0), (i, 15), (0, i), (15, i)):
            t.c[y, x] = rgb(base) * 0.72
    for i in range(1, 15):
        t.c[1, i] = rgb(base) * 1.12
    if rivets:
        for (x, y) in ((2, 2), (13, 2), (2, 13), (13, 13)):
            t.c[y, x] = rgb(base) * 0.6


def polished(t, base):
    t.fill(base, 0.03)
    for i in range(16):
        t.c[0, i] = t.c[i, 0] = rgb(base) * 1.1
        t.c[15, i] = t.c[i, 15] = rgb(base) * 0.8


def ore(t, gem):
    t.fill(0x8a8a8a, 0.05)
    for _ in range(4):
        cx, cy = 2 + int(t.r() * 12), 2 + int(t.r() * 12)
        for dx, dy in ((0, 0), (1, 0), (0, 1), (-1, 0), (1, 1)):
            t.px(cx + dx, cy + dy, shade(gem, 0.85 if dx + dy > 0 else 1.15))


def glazed(t, col):
    for y in range(16):
        for x in range(16):
            d = abs(x - 7.5) + abs(y - 7.5)
            band = int(d) // 3 % 2
            t.c[y, x] = rgb(col) * (1.15 if band else 0.8) if d < 12 else rgb(0xe8e4d8)
    for i in range(16):
        t.c[i, i] = t.c[i, 15 - i] = rgb(col) * 0.6


def sprite_plant(t, stem, leaf, flower=None, tall=12, tint=False):
    t.a[:] = 0
    for k, x in enumerate((3, 6, 8, 11, 13)):
        top = 16 - tall + int(t.r() * 5)
        for y in range(top, 16):
            t.px(x + (1 if (y + k) % 5 == 0 else 0), y, stem if y > 10 else leaf)
        if flower is not None and k % 2 == 0:
            for dx, dy in ((0, 0), (1, 0), (0, 1), (-1, 0), (0, -1)):
                t.px(x + dx, top + dy, flower if (dx or dy) else 0xf3e27a)


def sapling(t, leaf, stem):
    t.a[:] = 0
    for y in range(9, 16):
        t.px(7, y, stem); t.px(8, y, stem)
    for y in range(2, 10):
        for x in range(3, 13):
            if (x - 7.5) ** 2 / 25 + (y - 6) ** 2 / 16 < 1 and t.r() > 0.15:
                t.px(x, y, shade(leaf, 0.8 + t.r() * 0.4))


def leaves(t):
    # drawn light: the map multiplies in its own leaf green
    t.fill(0xc8d0c0, 0.12)
    t.specks(0x8a9488, 26)
    for _ in range(26):
        t.px(int(t.r() * 16), int(t.r() * 16), 0, 0)


def door(t, wood, top):
    boards(t, wood, shade(wood, 0.6), 4)
    for i in range(16):
        t.c[i, 0] = t.c[i, 15] = rgb(wood) * 0.55
    if top:
        for y in range(3, 9):
            for x in range(3, 13):
                if x not in (7, 8):
                    t.px(x, y, 0, 0)
    t.px(12, 9 if top else 4, 0xc8c8c8)


def glass(t, col):
    c = rgb(col)
    for y in range(16):
        for x in range(16):
            edge = x in (0, 15) or y in (0, 15)
            t.c[y, x] = c * (0.7 if edge else 1.05)
            t.a[y, x] = 255 if edge else 96
    for x, y in ((3, 6), (4, 5), (5, 4), (6, 3), (10, 12), (11, 11)):
        t.c[y, x] = np.minimum(c * 1.6 + 60, 255)
        t.a[y, x] = 170


def bars(t, col, gap=4):
    t.a[:] = 0
    for y in range(16):
        for x in range(16):
            if x % gap == 1 or y in (0, 15):
                t.px(x, y, shade(col, 1.1 if x % gap == 1 else 0.85))


def rail(t, powered):
    t.a[:] = 0
    for y in (1, 2, 6, 7, 11, 12):
        for x in range(1, 15):
            t.px(x, y, 0x7a5530)
    for y in range(16):
        for x in (3, 12):
            t.px(x, y, 0xc4cad0)
            t.px(x + (1 if x == 3 else -1), y, 0x8a9096)
    if powered:
        for y in range(0, 16, 3):
            t.px(7, y, 0xd8b030); t.px(8, y, 0xd8b030)


def paint(name):
    t = Tile(name)
    n = name
    wood = next((w for w in sorted(WOOD, key=len, reverse=True) if n.startswith(w + '_')), None)
    dye = next((d for d in sorted(DYES, key=len, reverse=True) if n.startswith(d + '_')), None)
    if dye and n.endswith('_wool'):
        for y in range(16):
            for x in range(16):
                t.c[y, x] = rgb(DYES[dye]) * (1.08 if (x + y) % 4 == 0 else 0.93 if (x - y) % 4 == 0 else 1) * (1 + (t.r() - 0.5) * 0.08)
    elif dye and n.endswith('_concrete_powder'):
        t.fill(shade(DYES[dye], 1.08), 0.12)
    elif dye and n.endswith('_concrete'):
        t.fill(DYES[dye], 0.025)
    elif dye and n.endswith('_glazed_terracotta'):
        glazed(t, DYES[dye])
    elif dye and n.endswith('_terracotta'):
        t.fill(shade(DYES[dye], 0.72) + 0, 0.05, 2)
        t.c = t.c * 0.75 + rgb(0x9a6a50) * 0.25
    elif dye and n.endswith('_stained_glass'):
        glass(t, DYES[dye])
    elif wood and n.endswith('_planks'):
        boards(t, WOOD[wood][0], shade(WOOD[wood][0], 0.62))
    elif wood and n.endswith('_log_top'):
        rings(t, WOOD[wood][2], WOOD[wood][1])
    elif wood and n.endswith('_log'):
        bark(t, WOOD[wood][1], shade(WOOD[wood][1], 0.6))
    elif n.endswith('_leaves'):
        leaves(t)
    elif wood and n.endswith('_sapling'):
        sapling(t, 0x5aa040 if wood != 'birch' else 0x8ab858, WOOD[wood][1])
    elif n.endswith('_door_bottom') or n.endswith('_door_top'):
        door(t, 0xa8acb0 if n.startswith('iron') else WOOD[wood][0], n.endswith('_top'))
    elif n in ('stone', 'andesite', 'diorite', 'granite'):
        t.fill({'stone': 0x868686, 'andesite': 0x8a8c8a, 'diorite': 0xc4c2be, 'granite': 0x9a6a58}[n], 0.06)
        t.specks({'stone': 0x707070, 'andesite': 0x6e706e, 'diorite': 0x8e8c88, 'granite': 0xb88070}[n], 18, 2 if n != 'stone' else 1)
    elif n.startswith('polished_'):
        polished(t, {'andesite': 0x8a8c8a, 'diorite': 0xc8c6c2, 'granite': 0x9e6c5a}[n[9:]])
    elif n == 'cobblestone':
        cobble(t, [0x9a9a9a, 0x8a8a8a, 0xa6a6a6], 0x5e5e5e)
    elif n == 'mossy_cobblestone':
        cobble(t, [0x8a9a7a, 0x8a8a8a, 0x7a9a5a], 0x4e5a46)
    elif n in ('stone_bricks', 'mossy_stone_bricks', 'cracked_stone_bricks'):
        bricks(t, 0x8c8c8c, 0x5a5a5a, 8, 8, 0.1)
        if n.startswith('mossy'):
            for _ in range(22): t.px(int(t.r() * 16), int(t.r() * 6) + int(t.r() * 10), shade(0x5a8a3a, 0.8 + t.r() * 0.4))
        if n.startswith('cracked'):
            x, y = 4, 2
            for _ in range(10): t.px(x, y, 0x4a4a4a); x += 1 if t.r() > 0.5 else 0; y += 1
    elif n == 'chiseled_stone_bricks':
        plate(t, 0x8c8c8c, False)
        for i in range(4, 12): t.px(i, 4, 0x5a5a5a); t.px(i, 11, 0x5a5a5a); t.px(4, i, 0x5a5a5a); t.px(11, i, 0x5a5a5a)
    elif n == 'bricks':
        bricks(t, 0xa4483a, 0xbcb4a6)
    elif n == 'nether_bricks':
        bricks(t, 0x4a2228, 0x24121a)
    elif n == 'end_stone_bricks':
        bricks(t, 0xd8d8a0, 0xa0a07a, 8, 8, 0.08)
    elif n == 'prismarine_bricks':
        bricks(t, 0x64aa98, 0x3a6a62, 8, 8, 0.06)
    elif n in ('prismarine', 'dark_prismarine'):
        t.fill(0x5aa49a if n == 'prismarine' else 0x3a5a4e, 0.1, 2)
    elif n in ('sandstone', 'red_sandstone', 'cut_sandstone', 'chiseled_sandstone', 'sandstone_top', 'sandstone_bottom'):
        base = 0xb8622e if n.startswith('red') else 0xdccc94
        t.fill(base, 0.04)
        for y in range(16):
            if n in ('sandstone', 'red_sandstone') and y % 5 == 4: t.c[y, :] = rgb(base) * 0.86
        if n == 'cut_sandstone': polished(t, base)
        if n == 'chiseled_sandstone':
            for i in range(3, 13): t.px(i, 3, shade(base, 0.75)); t.px(i, 12, shade(base, 0.75)); t.px(7, i, shade(base, 0.75))
    elif n in ('sand', 'red_sand'):
        t.fill(0xdcca92 if n == 'sand' else 0xbc6632, 0.07)
    elif n == 'gravel':
        t.fill(0x847e78, 0.14, 2)
    elif n in ('dirt', 'coarse_dirt', 'podzol_side', 'soul_sand', 'clay', 'snow', 'packed_ice', 'end_stone', 'bedrock', 'sponge', 'glowstone'):
        base = {'dirt': 0x8a5a35, 'coarse_dirt': 0x7a5232, 'podzol_side': 0x6a4a2a, 'soul_sand': 0x5a4434, 'clay': 0xa0a6b2, 'snow': 0xf2f6f8,
                'packed_ice': 0x9cc0ec, 'end_stone': 0xdcdca2, 'bedrock': 0x4e4e4e, 'sponge': 0xccc04a, 'glowstone': 0xd8a85a}[n]
        t.fill(base, 0.08, 2 if n in ('coarse_dirt', 'bedrock', 'glowstone') else 1)
        if n == 'podzol_side':
            for x in range(16):
                for y in range(3 + int(t.r() * 2)): t.px(x, y, shade(0x6a4a24, 0.9 + t.r() * 0.2))
        if n == 'glowstone': t.specks(0xffe8a0, 20, 2)
    elif n in ('grass_block_top', 'grass'):
        if n == 'grass':
            sprite_plant(t, 0xb8c0b0, 0xd0d6c8, None, 11)
        else:
            t.fill(0xc4c4c4, 0.09); t.specks(0x9a9a9a, 18)
    elif n == 'grass_block_side':
        t.fill(0x8a5a35, 0.07)
        for x in range(16):
            for y in range(3 + (1 if t.r() < 0.45 else 0) + (1 if t.r() < 0.2 else 0)):
                t.px(x, y, shade(0x6aa84a, 0.88 + t.r() * 0.24))
    elif n in ('mycelium_top', 'mycelium_side'):
        t.fill(0x7a6a78 if n.endswith('top') else 0x8a5a35, 0.08)
        if n.endswith('side'):
            for x in range(16):
                for y in range(3 + int(t.r() * 2)): t.px(x, y, 0x7a6a78)
    elif n in ('fern', 'large_fern_top', 'tall_grass_top', 'dead_bush'):
        light = n != 'dead_bush'
        sprite_plant(t, 0xb8c0b0 if light else 0x8a6a3a, 0xd0d6c8 if light else 0xa07a44, None, 14 if 'top' in n else 12)
    elif n in ('dandelion', 'lilac_top', 'peony_top', 'rose_bush_top', 'sunflower_front'):
        fl = {'dandelion': 0xf0d030, 'lilac_top': 0xb48ad8, 'peony_top': 0xe8a0c8, 'rose_bush_top': 0xd03a3a, 'sunflower_front': 0xf0c020}[n]
        sprite_plant(t, 0x4a8a30, 0x5aa03a, fl, 12)
    elif n in ('brown_mushroom', 'flower_pot'):
        t.a[:] = 0
        cap = 0x9a6a48 if n == 'brown_mushroom' else 0x9a5a3a
        for y in range(8, 14):
            for x in range(3 if n == 'flower_pot' else 5, 13 if n == 'flower_pot' else 11):
                t.px(x, y, shade(cap, 0.9 + t.r() * 0.2))
        if n == 'brown_mushroom':
            for y in range(13, 16): t.px(7, y, 0xd8ccb0); t.px(8, y, 0xd8ccb0)
    elif n == 'wheat_stage7':
        sprite_plant(t, 0x8a9a34, 0xc8b040, 0xe0c050, 14)
    elif n == 'vine':
        t.a[:] = 0
        for x in (2, 6, 10, 13):
            for y in range(16):
                if t.r() > 0.2: t.px(x + (y // 4) % 2, y, shade(0x4a8a2a, 0.85 + t.r() * 0.3))
    elif n in ('brown_mushroom_block', 'red_mushroom_block'):
        t.fill(0x9a6a48 if n.startswith('brown') else 0xb83a30, 0.06)
        if n.startswith('red'): t.specks(0xf0ece0, 7, 2)
    elif n in ('mushroom_block_inside', 'mushroom_stem'):
        t.fill(0xd8ccb0 if n.endswith('inside') else 0xe0dccc, 0.05)
    elif n in ('coal_ore', 'iron_ore', 'gold_ore', 'lapis_ore', 'redstone_ore'):
        ore(t, {'coal_ore': 0x2a2a2a, 'iron_ore': 0xd8a888, 'gold_ore': 0xf0d040, 'lapis_ore': 0x2a50b8, 'redstone_ore': 0xd03030}[n])
    elif n in ('coal_block', 'iron_block', 'gold_block', 'emerald_block', 'lapis_block', 'redstone_block', 'purpur_block', 'quartz_block_side', 'quartz_block_top', 'quartz_block_bottom'):
        plate(t, {'coal_block': 0x2c2c2e, 'iron_block': 0xd2d6da, 'gold_block': 0xf0c83a, 'emerald_block': 0x3ac46a, 'lapis_block': 0x2a50b0,
                  'redstone_block': 0xb02a20, 'purpur_block': 0xa47aa8, 'quartz_block_side': 0xece6dc, 'quartz_block_top': 0xece6dc, 'quartz_block_bottom': 0xe2dcd2}[n], n not in ('purpur_block',) and not n.startswith('quartz'))
    elif n == 'quartz_pillar':
        t.fill(0xece6dc, 0.03)
        for y in range(16): t.c[y, 3] = t.c[y, 12] = rgb(0xc8c2b8)
    elif n in ('bone_block_side', 'bone_block_top'):
        t.fill(0xe4e0cc, 0.04)
        if n.endswith('side'):
            for y in range(16): t.c[y, 5] = t.c[y, 10] = rgb(0xc4c0aa)
        else:
            rings(t, 0xe4e0cc, 0xc4c0aa)
    elif n in ('hay_block_side', 'hay_block_top'):
        if n.endswith('side'):
            for y in range(16):
                for x in range(16):
                    t.c[y, x] = rgb(0x8a4b2a) if y in (3, 4, 11, 12) else rgb([0xc9a332, 0xe3c04c, 0xd8b23a][x % 3]) * (1 + (t.r() - 0.5) * 0.12)
        else:
            rings(t, 0xdcb63e, 0xb8932a)
    elif n == 'bookshelf':
        boards(t, 0xb08a54, 0x6a5232, 8)
        for y0 in (1, 9):
            x = 1
            while x < 15:
                w = 1 + int(t.r() * 2); col = [0xa83a2a, 0x3a5aa8, 0x3a8a4a, 0xc8a040][int(t.r() * 4)]
                for xx in range(x, min(15, x + w)):
                    for y in range(y0 + int(t.r() * 2), y0 + 6): t.px(xx, y, shade(col, 0.9 + t.r() * 0.2))
                x += w + (1 if t.r() < 0.3 else 0)
    elif n in ('crafting_table_side', 'jukebox_side', 'note_block'):
        boards(t, 0x9a6a3a, 0x5a3a20, 4)
        plate_c = 0x5a3a20
        for i in range(16): t.c[0, i] = t.c[15, i] = t.c[i, 0] = t.c[i, 15] = rgb(plate_c)
        if n == 'note_block':
            for (x, y) in ((6, 5), (6, 6), (6, 7), (6, 8), (6, 9), (5, 10), (4, 10), (7, 5), (8, 6)): t.px(x, y, 0x2a1a10)
        if n == 'crafting_table_side':
            for y in range(4, 9): t.px(4, y, 0x8a8a8a); t.px(11, y, 0x6a4a2a)
    elif n in ('furnace_front', 'dropper_front', 'observer_front', 'observer_back', 'observer_side', 'observer_top', 'piston_side', 'cauldron_side',
               'hopper_outside', 'anvil', 'daylight_detector_side', 'comparator', 'repeater', 'redstone_lamp_on'):
        base = {'anvil': 0x4a4a4e, 'cauldron_side': 0x4a4a4e, 'hopper_outside': 0x4a4a4e, 'redstone_lamp_on': 0xd89a4a, 'daylight_detector_side': 0x8a6a3a,
                'comparator': 0xb4b0a8, 'repeater': 0xb4b0a8, 'piston_side': 0x7a7a7a}.get(n, 0x787878)
        plate(t, base)
        if n in ('furnace_front', 'dropper_front', 'observer_front'):
            for y in range(6, 12):
                for x in range(4, 12): t.px(x, y, 0x1c1c1c if n != 'observer_front' else 0x3a3a3a)
        if n == 'redstone_lamp_on':
            for y in range(3, 13):
                for x in range(3, 13): t.px(x, y, shade(0xffd27a, 0.9 + t.r() * 0.2))
        if n in ('comparator', 'repeater'):
            t.px(4, 7, 0xd03030); t.px(11, 7, 0xd03030); t.px(7, 4, 0xd03030)
        if n == 'piston_side':
            for y in range(4): t.c[y, :] = rgb(0xb08a54)
    elif n in ('iron_bars',):
        bars(t, 0x8a8e92)
    elif n in ('iron_trapdoor', 'oak_trapdoor'):
        col = 0xa8acb0 if n.startswith('iron') else 0xb08a54
        boards(t, col, shade(col, 0.6))
        for y in (4, 5, 10, 11):
            for x in (4, 5, 10, 11): t.px(x, y, 0, 0)
    elif n == 'ladder':
        t.a[:] = 0
        for y in range(16): t.px(2, y, 0x8a6a3a); t.px(13, y, 0x8a6a3a)
        for y in (1, 5, 9, 13):
            for x in range(2, 14): t.px(x, y, 0xa07a44)
    elif n in ('rail', 'powered_rail'):
        rail(t, n == 'powered_rail')
    elif n in ('lever', 'tripwire_hook', 'end_rod'):
        t.a[:] = 0
        for y in range(3, 15): t.px(7, y, 0x8a6a3a if n != 'end_rod' else 0xf0ece8); t.px(8, y, 0x7a5a30 if n != 'end_rod' else 0xe0dcd8)
        for x in range(5, 11): t.px(x, 14, 0x7a7a7a)
    else:
        t.fill(0x8a8a8a, 0.06)
    return t


tiles = src['tiles']
cols, cell, pad = src['columns'], src['cell'], src['padding']
rows = math.ceil(len(tiles) / cols)
atlas = Image.new('RGBA', (cols * cell, rows * cell), (0, 0, 0, 0))
tinted = {src['tiles'][ti]['name'] for p in src['palette'].values() for tt, ti in zip(p['tints'], p['tiles']) if tt != 0xffffff}
for i, tile in enumerate(tiles):
    t = paint(tile['name'])
    c = np.clip(t.c, 0, 255)
    a = t.a.copy()
    # keep each tile's kind: fully solid tiles stay solid; cut-outs only 0/255 and keep a hole; glass stays half see-through
    if SOLID[i]:
        c = np.where(a[..., None] < 255, c * 0.45, c)
        a[:] = 255
    elif tile['transparent']:
        a[(a > 0) & (a < 255)] = np.clip(a[(a > 0) & (a < 255)], 1, 254)
    else:
        a = np.where(a >= 128, 255, 0)
        if a.min() == 255:
            a[0, 0] = a[15, 15] = 0  # a cut-out tile keeps at least one see-through texel
    im = Image.fromarray(np.dstack([c, a]).astype('uint8'), 'RGBA')
    x, y = (i % cols) * cell + pad, (i // cols) * cell + pad
    # the border repeats the tile's edge texels, as the original packer did
    big = im.resize((16 + 2 * pad, 16 + 2 * pad), Image.Resampling.NEAREST)
    for Y in range(16 + 2 * pad):
        for X in range(16 + 2 * pad):
            big.putpixel((X, Y), im.getpixel((max(0, min(15, X - pad)), max(0, min(15, Y - pad)))))
    atlas.paste(big, (x - pad, y - pad))
atlas.save(out / 'blocks-atlas.png', optimize=True)
sha = hashlib.sha256((out / 'blocks-atlas.png').read_bytes()).hexdigest()
src.update({'version': 2, 'source': 'scripts/paint-block-textures.py', 'atlas': 'blocks-atlas.png', 'atlasSha256': sha})
src.pop('sourceSha256', None)
src.pop('originalFiles', None)
(out / 'blocks-palette.json').write_text(json.dumps(src, separators=(',', ':')), encoding='utf8')
m = json.loads((out / 'manifest.json').read_text(encoding='utf8'))
m.update({'textures': 'blocks-palette.json', 'atlas': 'blocks-atlas.png', 'atlasSha256': sha})
(out / 'manifest.json').write_text(json.dumps(m, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
print('Painted', len(tiles), 'tiles;', len(tinted), 'drawn light for the map tint:', ', '.join(sorted(tinted)))
