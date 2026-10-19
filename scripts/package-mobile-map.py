"""Build a separate light atlas; retain all original cutout/glass pixels.
Requires Pillow. Run this, then node scripts/mobile-map-geometry.js.
Original vanilla assets are never overwritten.
"""
import hashlib,json,math
from pathlib import Path
from PIL import Image

root=Path(__file__).resolve().parent.parent/'assets/maps/ascent'
dest=root/'mobile';dest.mkdir(exist_ok=True)
source=json.loads((root/'vanilla-palette.json').read_text(encoding='utf8'))
original=Image.open(root/'vanilla-atlas.png').convert('RGBA')
tiles=[];images=[]
for i,t in enumerate(source['tiles']):
    x=i%source['columns']*source['cell']+source['padding']
    y=i//source['columns']*source['cell']+source['padding']
    im=original.crop((x,y,x+16,y+16))
    opaque=im.getchannel('A').getextrema()==(255,255)
    size=8 if opaque else 16
    if opaque: im=im.resize((size,size),Image.Resampling.BOX)
    tiles.append(dict(t,opaque=opaque,size=size,padding=1 if opaque else 2));images.append(im)
width=256;y=0
for size in [8,16]:
    ids=[i for i,t in enumerate(tiles) if t['size']==size]
    cell=size+2*tiles[ids[0]]['padding'];cols=width//cell
    for j,i in enumerate(ids): tiles[i].update(x=j%cols*cell,y=y+j//cols*cell)
    y+=math.ceil(len(ids)/cols)*cell
atlas=Image.new('RGBA',(width,y))
for t,im in zip(tiles,images):
    x=t['x'];y=t['y'];p=t['padding'];s=t['size']
    # Extrude all edges and corners so mip filtering cannot sample a neighbour.
    padded=im.resize((s+2*p,s+2*p),Image.Resampling.NEAREST)
    for Y in range(s+2*p):
        for X in range(s+2*p): padded.putpixel((X,Y),im.getpixel((max(0,min(s-1,X-p)),max(0,min(s-1,Y-p)))))
    atlas.paste(padded,(x,y))
atlas.save(dest/'atlas.png')
palette={'version':1,'profile':'mobile','sourceAtlasSha256':source['atlasSha256'],'atlas':'atlas.png','atlasSha256':hashlib.sha256((dest/'atlas.png').read_bytes()).hexdigest(),'width':atlas.width,'height':atlas.height,'tiles':tiles}
(dest/'palette.json').write_text(json.dumps(palette,separators=(',',':'))+'\n',encoding='utf8')
print('Mobile atlas:',atlas.size,'original:',original.size,'opaque patterns 8x8; all cutouts/glass unchanged')
