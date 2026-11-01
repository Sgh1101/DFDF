"""Paint the block textures of 하늘섬 마을 (the imported block map, internal id ascent_trial).

Every tile is ONE flat colour: no noise, no pattern, no grain. The colour is picked for what the block is on this
map's terrain (plaster white, terracotta roof, slate, weathered timber, warm sandstone, moss, water-blue glass...);
the light and the fog of the game do the rest. Nothing is read from a game client or another texture pack.

What is kept from the existing palette, so geometry.bin and the mobile geometry do not change:
  · the tile list, its order and the atlas cell layout (16 px tile, 2 px edge padding);
  · the block-state palette (which tile each block face uses, and the tint the geometry multiplies in);
  · each tile's kind: a fully solid tile stays solid; a cut-out tile (leaves, plants, doors, bars, rails...) keeps its
    see-through pixels (the silhouettes are in scripts/block-shapes.json) and is one flat colour inside them; a glass
    tile stays half see-through, in one tint over its whole face.
Tiles the geometry multiplies a green tint into (grass tops, grass sprites, leaves) are a light neutral grey, so the
tint makes the green.

Requires Pillow and numpy.   python scripts/paint-block-textures.py   then   python scripts/package-mobile-map.py
(or: npm run paint:blocks)
"""
import hashlib, json, math
from pathlib import Path
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parent.parent
out = root / 'assets/maps/ascent'
src = json.loads((out / 'blocks-palette.json').read_text(encoding='utf8'))
SOLID = [t['opaque'] for t in json.loads((out / 'mobile/palette.json').read_text(encoding='utf8'))['tiles']]
SHAPES = json.loads((root / 'scripts/block-shapes.json').read_text(encoding='utf8'))
GLASS_ALPHA = 118


def rgb(h):
    return ((h >> 16) & 255, (h >> 8) & 255, h & 255)


def mix(a, b, k):
    return tuple(round(a[i] * (1 - k) + b[i] * k) for i in range(3))


def lit(c, k):
    return tuple(max(0, min(255, round(v * k))) for v in c)


# ── the dyes: one colour each, then wool / concrete / powder / terracotta / glazed / glass are tuned from it ──
DYE = {'white': 0xece9e0, 'orange': 0xdd7a2c, 'magenta': 0xb04f9a, 'light_blue': 0x5ba6d2, 'yellow': 0xe9bf3a, 'lime': 0x77b638,
       'pink': 0xe390a8, 'gray': 0x4a5054, 'light_gray': 0x9a9b97, 'cyan': 0x218a92, 'purple': 0x7240a0, 'blue': 0x33449a,
       'brown': 0x7a5434, 'green': 0x516c2c, 'red': 0xa72f28, 'black': 0x202126}
CLAY = rgb(0x8d5f47)  # what terracotta is made of: the dye shows through it, muted

COLORS = {}
for d, h in DYE.items():
    c = rgb(h)
    COLORS[d + '_wool'] = c
    COLORS[d + '_concrete'] = lit(c, 0.93)
    COLORS[d + '_concrete_powder'] = mix(lit(c, 1.06), rgb(0xe6e2d6), 0.12)
    COLORS[d + '_terracotta'] = mix(c, CLAY, 0.55) if d not in ('white', 'black') else (rgb(0xcdb5a4) if d == 'white' else rgb(0x2b1d17))
    COLORS[d + '_glazed_terracotta'] = lit(c, 1.04)
    COLORS[d + '_stained_glass'] = c
# the glass of this map's windows reads as water-blue / teal, not as a dye
COLORS['white_stained_glass'] = rgb(0x9ccfdc)
COLORS['light_gray_stained_glass'] = rgb(0x8fb0bb)
COLORS['gray_stained_glass'] = rgb(0x5d7480)
COLORS['brown_stained_glass'] = rgb(0xa88a58)
COLORS['black_stained_glass'] = rgb(0x1f2a33)
COLORS['terracotta'] = rgb(0x9a5f45)

# ── woods: planks, log side, log top; doors take the planks, a little darker ──
WOOD = {'oak': (0xb08b55, 0x6d5233, 0xb59a62), 'spruce': (0x6a4a2e, 0x45301e, 0x7a5a38), 'birch': (0xd8c88f, 0xdedcd2, 0xd0c088),
        'jungle': (0xa9774f, 0x5d4a2c, 0xa98456), 'acacia': (0xb8683a, 0x6b675e, 0xb87c4e), 'dark_oak': (0x45301f, 0x37281b, 0x4a3524)}
for w, (planks, log, top) in WOOD.items():
    COLORS[w + '_planks'] = rgb(planks)
    COLORS[w + '_log'] = rgb(log)
    COLORS[w + '_log_top'] = rgb(top)
    COLORS[w + '_door_bottom'] = lit(rgb(planks), 0.9)
    COLORS[w + '_door_top'] = lit(rgb(planks), 0.9)
    COLORS[w + '_sapling'] = rgb(0x4c8f36)
    COLORS[w + '_leaves'] = rgb(0xcdd2c4)  # light: the geometry multiplies the leaf green in

COLORS.update({
    # stone: darker to lighter, so floors, walls and cliffs separate by value
    'cobblestone': rgb(0x625f5b), 'mossy_cobblestone': rgb(0x66765a), 'stone_bricks': rgb(0x8b8882), 'mossy_stone_bricks': rgb(0x7a8670),
    'cracked_stone_bricks': rgb(0x7f7b75), 'chiseled_stone_bricks': rgb(0x938f89), 'stone': rgb(0xa6a39d), 'andesite': rgb(0x7b8588),
    'polished_andesite': rgb(0x93999b), 'diorite': rgb(0xc8c5bd), 'polished_diorite': rgb(0xd2cfc7), 'granite': rgb(0x9b6c58),
    'polished_granite': rgb(0xa97b67), 'bedrock': rgb(0x3f3f43),
    # roofs and walls
    'bricks': rgb(0xa2463a), 'red_sandstone': rgb(0xbb663a), 'nether_bricks': rgb(0x474952), 'quartz_block_side': rgb(0xebe6da),
    'quartz_block_top': rgb(0xf0ebe0), 'quartz_block_bottom': rgb(0xddd7ca), 'quartz_pillar': rgb(0xe2ddd0),
    'sandstone': rgb(0xd9c68e), 'cut_sandstone': rgb(0xd1bd84), 'chiseled_sandstone': rgb(0xcab57a), 'sandstone_top': rgb(0xddca94),
    'sandstone_bottom': rgb(0xc9b67c), 'end_stone': rgb(0xdedab0), 'end_stone_bricks': rgb(0xddd3a8), 'prismarine': rgb(0x5fa394),
    'prismarine_bricks': rgb(0x4e9488), 'dark_prismarine': rgb(0x37584c), 'purpur_block': rgb(0x9d8aa7), 'bone_block_side': rgb(0xe0dcc8),
    'bone_block_top': rgb(0xd6d1bb), 'coal_block': rgb(0x2d2e32), 'iron_block': rgb(0xd3d7da), 'gold_block': rgb(0xe8bb3a),
    'emerald_block': rgb(0x37b066), 'lapis_block': rgb(0x2d4d9a), 'redstone_block': rgb(0xa42b23),
    # ground
    'dirt': rgb(0x7f593a), 'coarse_dirt': rgb(0x6f5842), 'podzol_side': rgb(0x5d4731), 'grass_block_side': rgb(0x73603c),
    'grass_block_top': rgb(0xdadad4), 'gravel': rgb(0x86817b), 'sand': rgb(0xdbc88f), 'red_sand': rgb(0xb4612f), 'clay': rgb(0x9fa6ae),
    'snow': rgb(0xf3f6f8), 'packed_ice': rgb(0x9cc1e8), 'soul_sand': rgb(0x54443a), 'mycelium_top': rgb(0x756879),
    'mycelium_side': rgb(0x6d5b4b), 'sponge': rgb(0xc8bc4f), 'hay_block_side': rgb(0xd0a734), 'hay_block_top': rgb(0xdbb43f),
    # ores (the stone with a hint of the metal)
    'coal_ore': rgb(0x55565a), 'iron_ore': rgb(0x8c7968), 'gold_ore': rgb(0xa89a62), 'lapis_ore': rgb(0x586b94), 'redstone_ore': rgb(0x93605c),
    # mushrooms
    'brown_mushroom_block': rgb(0x8b6645), 'red_mushroom_block': rgb(0xae3b31), 'mushroom_block_inside': rgb(0xd9ceb4),
    'mushroom_stem': rgb(0xe0dccc), 'brown_mushroom': rgb(0x8d6a4a),
    # fittings
    'iron_door_bottom': rgb(0xaeb3b5), 'iron_door_top': rgb(0xaeb3b5), 'iron_trapdoor': rgb(0x8d9397), 'oak_trapdoor': rgb(0x7a5b39),
    'iron_bars': rgb(0x73797e), 'ladder': rgb(0x8a6a3e), 'rail': rgb(0x7a6a5a), 'powered_rail': rgb(0x8d6f48), 'lever': rgb(0x6e6e6e),
    'tripwire_hook': rgb(0x7c7c7c), 'end_rod': rgb(0xf0eee6), 'flower_pot': rgb(0x9b5b3d), 'anvil': rgb(0x3f4044), 'cauldron_side': rgb(0x3d3e42),
    'hopper_outside': rgb(0x46474b), 'furnace_front': rgb(0x7a7977), 'dropper_front': rgb(0x797977), 'observer_front': rgb(0x6c6e70),
    'observer_back': rgb(0x6c6e70), 'observer_side': rgb(0x6c6e70), 'observer_top': rgb(0x70727a), 'piston_side': rgb(0x8a8882),
    'comparator': rgb(0xb0aca4), 'repeater': rgb(0xb0aca4), 'daylight_detector_side': rgb(0x8d6b3d), 'jukebox_side': rgb(0x6f4a2e),
    'note_block': rgb(0x8a6038), 'crafting_table_side': rgb(0x8a6a3e), 'bookshelf': rgb(0x6c4f33), 'glowstone': rgb(0xe0b25e),
    'redstone_lamp_on': rgb(0xf0c070),
    # plants (leaf and grass sprites are tinted green by the map, so they are light grey)
    'grass': rgb(0xd6dad0), 'fern': rgb(0xd0d6cc), 'large_fern_top': rgb(0xd0d6cc), 'tall_grass_top': rgb(0xd6dad0), 'dead_bush': rgb(0x8a6a3a),
    'vine': rgb(0x3f7a2a), 'wheat_stage7': rgb(0xcdb34a), 'dandelion': rgb(0xeec62a), 'lilac_top': rgb(0xa985cf), 'peony_top': rgb(0xe49ac0),
    'rose_bush_top': rgb(0xc93a3a), 'sunflower_front': rgb(0xefc020),
})

tiles = src['tiles']
cols, cell, pad = src['columns'], src['cell'], src['padding']
rows = math.ceil(len(tiles) / cols)
atlas = Image.new('RGBA', (cols * cell, rows * cell), (0, 0, 0, 0))
missing = [t['name'] for t in tiles if t['name'] not in COLORS]
if missing:
    raise SystemExit('no colour for: ' + ', '.join(missing))
for i, tile in enumerate(tiles):
    n = tile['name']
    c = COLORS[n]
    px = np.zeros((16, 16, 4), dtype=np.uint8)
    px[..., :3] = c
    if SOLID[i]:
        px[..., 3] = 255
    elif n.endswith('_stained_glass'):
        px[..., 3] = GLASS_ALPHA
    else:
        px[..., 3] = np.array([[255 if ch == '#' else 0 for ch in row] for row in SHAPES[n]], dtype=np.uint8)
    # the cell's padding repeats the tile's edge texels, as before
    im = Image.fromarray(px, 'RGBA')
    big = Image.new('RGBA', (16 + 2 * pad, 16 + 2 * pad))
    for Y in range(16 + 2 * pad):
        for X in range(16 + 2 * pad):
            big.putpixel((X, Y), im.getpixel((max(0, min(15, X - pad)), max(0, min(15, Y - pad)))))
    atlas.paste(big, ((i % cols) * cell, (i // cols) * cell))
atlas.save(out / 'blocks-atlas.png', optimize=True)
sha = hashlib.sha256((out / 'blocks-atlas.png').read_bytes()).hexdigest()
src.update({'version': 3, 'source': 'scripts/paint-block-textures.py', 'atlas': 'blocks-atlas.png', 'atlasSha256': sha})
(out / 'blocks-palette.json').write_text(json.dumps(src, separators=(',', ':')), encoding='utf8')
m = json.loads((out / 'manifest.json').read_text(encoding='utf8'))
m.update({'textures': 'blocks-palette.json', 'atlas': 'blocks-atlas.png', 'atlasSha256': sha})
(out / 'manifest.json').write_text(json.dumps(m, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
print('Painted', len(tiles), 'flat tiles')
