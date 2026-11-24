"""Compare deux séries d'images de `images.mjs` : pour chaque écran, le nombre de pixels dont un canal s'écarte de
plus de 24 niveaux (le grain du rendu des textures en dessous). Usage : python3 projets/roguelite/recette/comparer.py <avant> <après>"""
import sys
from pathlib import Path
from PIL import Image, ImageChops

avant, apres = Path(sys.argv[1]), Path(sys.argv[2])
ecarts = 0
for f in sorted(avant.glob('*.png')):
    g = apres / f.name
    if not g.exists():
        print(f'{f.name} : absente après'); ecarts += 1; continue
    a, b = Image.open(f).convert('RGB'), Image.open(g).convert('RGB')
    if a.size != b.size:
        print(f'{f.name} : taille {a.size} → {b.size}'); ecarts += 1; continue
    d = ImageChops.difference(a, b).convert('L').point(lambda v: 255 if v > 24 else 0)
    n = d.histogram()[255]
    if n:
        print(f'{f.name} : {n} pixels, zone {d.getbbox()}'); ecarts += 1
print('identiques' if not ecarts else f'{ecarts} écran(s) diffèrent')
sys.exit(1 if ecarts else 0)
