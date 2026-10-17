"""Copy only data assets, byte for byte. Never load or execute the supplied mod."""
import hashlib
import json
import pathlib
import sys
import zipfile

source = pathlib.Path(sys.argv[1])
target = pathlib.Path(__file__).resolve().parents[1] / 'assets/neon/1.0.0'
prefix = 'assets/valorant_neon/'
files = []
with zipfile.ZipFile(source) as archive:
    for name in sorted(archive.namelist()):
        if not name.startswith(prefix) or not name.endswith(('.png', '.json')):
            continue
        relative = pathlib.PurePosixPath(name[len(prefix):])
        assert not relative.is_absolute() and '..' not in relative.parts
        raw = archive.read(name)
        output = target.joinpath(*relative.parts)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(raw)
        files.append({'file': str(relative), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})
(target / 'manifest.json').write_text(json.dumps({
    'source': source.name, 'sourceJarSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'author': 'Seafle - UnfixedGames', 'version': '1.0.0-release', 'sound': False,
    'note': 'Source contains arms, skill UI, particles and animations, not a full-body character. DFDF supplies its own full-body adaptation and gameplay integration.',
    'files': files,
}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Preserved {len(files)} original Neon data assets')
