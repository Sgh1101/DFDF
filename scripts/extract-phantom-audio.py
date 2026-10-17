"""Read the supplied mod's constant sound tables with javap; never load/run the mod."""
import hashlib
import json
from pathlib import Path
import re
import shutil
import struct
import subprocess
import sys
import zipfile

source = Path(sys.argv[1])
table_class = "com.seafle.championsphantom.client.g.b"
record_class = "com/seafle/championsphantom/client/g/a"
listing = subprocess.run([shutil.which("javap"), "-p", "-c", "-classpath", str(source), table_class], check=True, capture_output=True, text=True).stdout
stack, fields = [], {}
for line in listing.splitlines():
    match = re.match(r"\s+\d+:\s+(\w+)\s*(.*)", line)
    if not match:
        continue
    op, rest = match.groups()
    argument, _, comment = rest.partition("// ")
    argument, comment = argument.strip(), comment.strip()
    if op.startswith("iconst_"):
        stack.append(-1 if op == "iconst_m1" else int(op[-1]))
    elif op.startswith("fconst_"):
        stack.append(float(op[-1]))
    elif op in ("bipush", "sipush"):
        stack.append(int(argument))
    elif op in ("ldc", "ldc_w"):
        if comment.startswith("String "):
            stack.append(comment[7:])
        else:
            assert comment.startswith("float "), comment
            stack.append(struct.unpack(">f", struct.pack(">f", float(comment[6:].rstrip("f"))))[0])
    elif op in ("newarray", "anewarray"):
        assert argument in ("float", "short") or comment == "class java/lang/String"
        count = stack.pop()
        assert isinstance(count, int) and 0 <= count <= 4096
        stack.append([None] * count)
    elif op == "dup":
        stack.append(stack[-1])
    elif op in ("aastore", "sastore", "fastore"):
        value, index, array = stack.pop(), stack.pop(), stack.pop()
        assert isinstance(array, list) and isinstance(index, int) and 0 <= index < len(array)
        array[index] = value
    elif op == "new":
        assert comment == "class " + record_class
        stack.append({})
    elif op == "invokespecial":
        assert comment == 'Method ' + record_class + '."<init>":(Ljava/lang/String;Ljava/lang/String;FF[F[S[F[F)V'
        args = [stack.pop() for _ in range(8)][::-1]
        record = stack.pop()
        record.update(zip(("name", "category", "loopStart", "loopEnd", "times", "sounds", "pitches", "volumes"), args))
    elif op == "putstatic":
        name = comment.split("Field ", 1)[1].split(":", 1)[0]
        fields[name] = stack.pop()
    elif op == "return":
        assert not stack
    else:
        raise ValueError("Not a constant table instruction: " + op)

sounds = fields["a"]
profiles = {}
for record in fields.values():
    if not isinstance(record, dict) or not re.fullmatch(r"kill_[1-5]", record["name"]):
        continue
    assert len({len(record[key]) for key in ("times", "sounds", "pitches", "volumes")}) == 1
    profiles[record["name"]] = {"category": record["category"], "events": [{"at": at, "sound": sounds[sound], "pitch": pitch, "volume": volume} for at, sound, pitch, volume in zip(record["times"], record["sounds"], record["pitches"], record["volumes"])]}
assert len(profiles) == 5
with zipfile.ZipFile(source) as archive:
    data = archive.read(table_class.replace(".", "/") + ".class")
result = {"sourceClass": table_class, "sourceClassSha256": hashlib.sha256(data).hexdigest(), "sourceJarSha256": hashlib.sha256(source.read_bytes()).hexdigest(), "minecraftVersion": "1.20.1", "profiles": profiles}
target = Path(__file__).resolve().parent.parent / "assets/champions-phantom/2026-0.1.0/audio/kill-sequences.json"
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="")
print(json.dumps({name: {"events": len(profile["events"]), "duration": max(event["at"] for event in profile["events"]), "sounds": sorted({event["sound"] for event in profile["events"]})} for name, profile in profiles.items()}, indent=2))
