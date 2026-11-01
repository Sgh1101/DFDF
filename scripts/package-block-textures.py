"""Extract actual vanilla block pixels from a local Minecraft client JAR.
No Java is run. Atlas packing preserves source resolution; no image generation.
Requires Pillow. Usage: python scripts/package-block-textures.py <client.jar>
"""
import hashlib,io,json,sys,zipfile,math
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parent.parent
jar=Path(sys.argv[1]);z=zipfile.ZipFile(jar);out=root/'assets/maps/ascent';dest=out/'vanilla';dest.mkdir(exist_ok=True)
colors=['white','orange','magenta','light_blue','yellow','lime','pink','gray','light_gray','cyan','purple','blue','brown','green','red','black']
woods=['oak','spruce','birch','jungle','acacia','dark_oak']
slabs=['stone','sandstone','oak_planks','cobblestone','bricks','stone_bricks','nether_bricks','quartz_block_side']
fixed={4:'cobblestone',7:'bedrock',13:'gravel',14:'gold_ore',15:'iron_ore',16:'coal_ore',19:'sponge',21:'lapis_ore',22:'lapis_block',25:'note_block',28:'powered_rail',33:'piston_side',37:'dandelion',39:'brown_mushroom',40:'red_mushroom',41:'gold_block',42:'iron_block',45:'bricks',47:'bookshelf',48:'mossy_cobblestone',54:'oak_planks',58:'crafting_table_side',59:'wheat_stage7',61:'furnace_front',63:'oak_planks',64:'oak_door_bottom',65:'ladder',66:'rail',68:'oak_planks',69:'lever',70:'stone',71:'iron_door_bottom',72:'oak_planks',73:'redstone_ore',77:'stone',78:'snow',80:'snow',82:'clay',84:'jukebox_side',85:'oak_planks',89:'glowstone',93:'repeater',96:'oak_trapdoor',99:'brown_mushroom_block',100:'red_mushroom_block',101:'iron_bars',106:'vine',107:'oak_planks',110:'mycelium_side',112:'nether_bricks',113:'nether_bricks',118:'cauldron_side',121:'end_stone',124:'redstone_lamp_on',131:'tripwire_hook',133:'emerald_block',139:'cobblestone',140:'flower_pot',143:'oak_planks',144:'soul_sand',145:'anvil',148:'iron_block',149:'comparator',151:'daylight_detector_side',152:'redstone_block',154:'hopper_outside',158:'dropper_front',166:'stone',167:'iron_trapdoor',170:'hay_block_side',172:'terracotta',173:'coal_block',174:'packed_ice',176:'white_wool',177:'white_wool',178:'daylight_detector_side',180:'red_sandstone',181:'red_sandstone',182:'red_sandstone',183:'spruce_planks',184:'birch_planks',185:'jungle_planks',186:'dark_oak_planks',188:'spruce_planks',189:'birch_planks',190:'jungle_planks',191:'dark_oak_planks',192:'acacia_planks',193:'spruce_door_bottom',194:'birch_door_bottom',195:'jungle_door_bottom',196:'acacia_door_bottom',197:'dark_oak_door_bottom',198:'end_rod',201:'purpur_block',203:'purpur_block',205:'purpur_block',206:'end_stone_bricks',216:'bone_block_side',218:'observer_side'}
stairs={53:'oak_planks',67:'cobblestone',108:'bricks',109:'stone_bricks',114:'nether_bricks',128:'sandstone',134:'spruce_planks',135:'birch_planks',136:'jungle_planks',156:'quartz_block_side',163:'acacia_planks',164:'dark_oak_planks',180:'red_sandstone',203:'purpur_block'}
def texture_names(i,d):
 n=fixed.get(i,stairs.get(i,'stone'));s=[n]*6;t=[0xffffff]*6
 if i==1:n=['stone','granite','polished_granite','diorite','polished_diorite','andesite','polished_andesite'][min(d,6)];s=[n]*6
 if i==2:s=['grass_block_side']*4+['dirt','grass_block_top'];t[-1]=0x91bd59
 if i==3:s=[['dirt','coarse_dirt','podzol_side'][min(d,2)]]*6
 if i==5:s=[woods[min(d,5)]+'_planks']*6
 if i==6:s=[woods[d%6]+'_sapling']*6
 if i==12:s=['red_sand' if d==1 else 'sand']*6
 if i in (17,162):
  w=woods[(d&1)+4] if i==162 else woods[d&3];s=[w+'_log']*6
  axis=(d&12);ends=[4,5] if axis==0 else [2,3] if axis==4 else [0,1] if axis==8 else []
  for a in ends:s[a]=w+'_log_top'
 if i in (18,161):s=[woods[(d&1)+4]+'_leaves' if i==161 else woods[d&3]+'_leaves']*6;t=[0x77ab2f]*6
 if i==24:s=[['sandstone','chiseled_sandstone','cut_sandstone'][min(d,2)]]*4+['sandstone_bottom','sandstone_top']
 if i==31:s=[['dead_bush','grass','fern'][min(d,2)]]*6;t=[0x91bd59 if d else 0xffffff]*6
 if i in (35,95,159,160,171,251,252):s=[colors[d&15]+{35:'_wool',95:'_stained_glass',159:'_terracotta',160:'_stained_glass',171:'_wool',251:'_concrete',252:'_concrete_powder'}[i]]*6
 if i in (43,44):s=[slabs[d&7]]*6
 if i==47:s=['bookshelf']*4+['oak_planks']*2
 if i in (125,126):s=[woods[min(d&7,5)]+'_planks']*6
 if i==98:s=[['stone_bricks','mossy_stone_bricks','cracked_stone_bricks','chiseled_stone_bricks'][d&3]]*6
 if i in (99,100):
  n='brown_mushroom_block' if i==99 else 'red_mushroom_block';s=['mushroom_block_inside']*6
  if d>=10:s=['mushroom_stem']*6
  else:
   if d in (1,2,3,4,5,6,7,8,9):s[5]=n
   if d in (1,2,3):s[0]=n
   if d in (7,8,9):s[1]=n
   if d in (1,4,7):s[2]=n
   if d in (3,6,9):s[3]=n
 if i==110:s=['mycelium_side']*4+['dirt','mycelium_top']
 if i==139:s=['mossy_cobblestone' if d else 'cobblestone']*6
 if i==155:s=['quartz_block_side']*4+['quartz_block_bottom','quartz_block_top'];s=['quartz_pillar']*6 if d>=2 else s
 if i==168:s=[['prismarine','prismarine_bricks','dark_prismarine'][min(d,2)]]*6
 if i==170:s=['hay_block_side']*4+['hay_block_top']*2
 if i==175:s=[['sunflower_front','lilac_top','tall_grass_top','large_fern_top','rose_bush_top','peony_top'][min(d&7,5)]]*6
 if i==216:s=['bone_block_side']*4+['bone_block_top']*2
 if i==218:s=['observer_front','observer_back','observer_side','observer_side','observer_top','observer_top']
 if 235<=i<=250:s=[colors[i-235]+'_glazed_terracotta']*6
 if i in (64,71,193,194,195,196,197) and d&8:s=[n.replace('_bottom','_top')]*6
 return s,t
hist=json.loads((out/'manifest.json').read_text(encoding='utf8'))['histogram'];palette={};names=set()
for i in map(int,hist):
 for d in range(16):
  textures,tints=texture_names(i,d);names.update(textures);palette[f'{i}:{d}']={'names':textures,'tints':tints}
tiles=[];original=[];images=[]
for name in sorted(names):
 entry=f'assets/minecraft/textures/block/{name}.png'
 if entry not in z.namelist():raise ValueError('Missing actual block texture '+entry)
 data=z.read(entry);(dest/(name+'.png')).write_bytes(data);original.append({'name':name+'.png','sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)})
 im=Image.open(io.BytesIO(data)).convert('RGBA');im=im.crop((0,0,16,16)) # first original frame for animated blocks
 if name=='grass_block_side':
  overlay=Image.open(io.BytesIO(z.read('assets/minecraft/textures/block/grass_block_side_overlay.png'))).convert('RGBA')
  pix=overlay.load()
  for y in range(16):
   for x in range(16):
    r,g,b,a=pix[x,y];pix[x,y]=(r*145//255,g*189//255,b*89//255,a)
  im.alpha_composite(overlay)
 alpha=im.getchannel('A');values=set(alpha.getdata());tiles.append({'name':name,'transparent':any(0<a<255 for a in values)});images.append(im)
cols=16;cell=20;rows=math.ceil(len(tiles)/cols);atlas=Image.new('RGBA',(cols*cell,rows*cell),(0,0,0,0))
for i,im in enumerate(images):
 x=(i%cols)*cell+2;y=(i//cols)*cell+2;atlas.paste(im,(x,y))
 # Extrude the original edge texels into padding; no source pixels resized.
 atlas.paste(im.crop((0,0,1,16)).resize((2,16),Image.Resampling.NEAREST),(x-2,y));atlas.paste(im.crop((15,0,16,16)).resize((2,16),Image.Resampling.NEAREST),(x+16,y))
 atlas.paste(im.crop((0,0,16,1)).resize((16,2),Image.Resampling.NEAREST),(x,y-2));atlas.paste(im.crop((0,15,16,16)).resize((16,2),Image.Resampling.NEAREST),(x,y+16))
atlas.save(out/'vanilla-atlas.png')
lookup={tile['name']:i for i,tile in enumerate(tiles)}
for p in palette.values():p['tiles']=[lookup[n] for n in p.pop('names')]
manifest={'version':1,'source':jar.name,'sourceSha256':hashlib.sha256(jar.read_bytes()).hexdigest(),'atlas':'vanilla-atlas.png','atlasSha256':hashlib.sha256((out/'vanilla-atlas.png').read_bytes()).hexdigest(),'width':cols*cell,'height':rows*cell,'columns':cols,'cell':cell,'tileSize':16,'padding':2,'tiles':tiles,'palette':palette,'originalFiles':original}
(out/'vanilla-palette.json').write_text(json.dumps(manifest,separators=(',',':')),encoding='utf8');print('Packed',len(tiles),'actual vanilla textures from',jar.name)
