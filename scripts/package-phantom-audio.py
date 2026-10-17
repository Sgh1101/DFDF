"""Reproduce recipes and copy verified, unmodified installed Minecraft note recordings."""
import hashlib
import json
import pathlib
import subprocess
import sys

jar, minecraft_assets = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
root = pathlib.Path(__file__).resolve().parents[1]
subprocess.run([sys.executable, str(root / 'scripts/extract-phantom-audio.py'), str(jar)], cwd=root, check=True)
target = root / 'assets/champions-phantom/2026-0.1.0/audio'
index = json.loads((minecraft_assets / 'indexes/5.json').read_text())['objects']
notes = {'basedrum': 'bd', 'bass': 'bassattack', 'bell': 'bell', 'flute': 'flute', 'guitar': 'guitar', 'harp': 'harp2', 'pling': 'pling'}
samples = {}
for event, note in notes.items():
    metadata = index[f'minecraft/sounds/note/{note}.ogg']
    sha1 = metadata['hash']
    raw = (minecraft_assets / 'objects' / sha1[:2] / sha1).read_bytes()
    assert len(raw) == metadata['size'] and hashlib.sha1(raw).hexdigest() == sha1
    (target / f'{note}.ogg').write_bytes(raw)
    samples[f'block.note_block.{event}'] = {'file': f'{note}.ogg', 'bytes': len(raw), 'sha1': sha1,
        'sha256': hashlib.sha256(raw).hexdigest(), 'source': f'https://resources.download.minecraft.net/{sha1[:2]}/{sha1}'}
(target / 'samples.json').write_text(json.dumps({'minecraftVersion': '1.20.1',
    'attribution': 'Minecraft note-block recordings by Mojang Studios. Kill arrangements from Seafle ChampionsPhantom2026. Original recordings preserved without re-encoding.',
    'samples': samples}, indent=2) + '\n', encoding='utf-8')
print('Preserved seven original Minecraft note-block recordings')
