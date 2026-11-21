"""Données de `humanoide--vetement--gants` (le Soldat, #4318), lues par `modele.py` : la pièce `gants` de la garde-robe,
que portent l'uniforme de soldat (`tenue-uniforme-de-soldat`) et l'objet `gants` (`trapping-gants`) ; aucun autre preset
ne la porte. Elle reste la paire de gants de cuir générique : ajustée, à manchette courte.

Illustration directrice : « Soldat | soldat | `carrieres/soldat.png` | Livre de Base | 76 | certaine » (`INDEX.md` du
recueil `illustrations-wfrp.zip` ; page du PDF, folio imprimé 74), hors dépôt.

Ce qu'elle montre (main gauche fermée sur la hampe, x ≈ 380-460, y ≈ 565-625 px) : un gant de cuir fauve, souple et
ajusté, les doigts et le pouce lisibles, sans crispin évasé ; sa manchette entre sous le canon d'avant-bras
(`armure--brassards-d-acier`). Coutures et plis omis (détail). Échelle relevée : ~520 px/m.

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x), bras à l'horizontale, main à plat. Chaque cote dit d'où elle vient : `illustration`, `base` (sonde de construction)
ou `HYPOTHÈSE` (à trancher en revue).
"""

MANIFESTE = {
    'categorie': 'vetement',
    'cle': {'piece': 'gants'},
    'liaison': {'mode': 'squelette'},
    'couche': 'tenue',
    'couvre': ['main_g', 'main_d'],
}
"""La main entière, doigts et pouce fermés dans leurs tubes ; la manchette monte sur le poignet, sous la manche."""

MATERIAUX = {'cuir': ('cuir', 'cuir-tanne')}
"""Illustration : cuir fauve (`cuir`, fauve au preset `soldat`)."""

BUDGET_TRIANGLES = 800
"""Sous les 2 500 d'un vêtement (procédure, section 7) ; un
tube par doigt, la main en un seul fourreau."""

ZONES = {c: [f'avant_bras_{c}', f'main_{c}'] for c in 'gd'}
"""Par main, les zones que le gant traverse : ses poids et ses clés en viennent."""

DOIGTS = ('index', 'middle', 'ring', 'pinky')
"""Les quatre doigts de la base, os `<doigt>_01` à `<doigt>_04_leaf`."""

PAUME = [(-0.30, 0.006), (-0.12, 0.005), (0.0, 0.004), (0.35, 0.003), (0.7, 0.003), (1.0, 0.003)]
"""(t, aisance en m) : les anneaux du fourreau de la main, t en part de la longueur du poignet (tête de `hand_*`) aux
jointures (milieu des têtes des `<doigt>_01`) ; t < 0 remonte sur l'avant-bras (base : la paume fait ~0,116 m, la
manchette monte de 3,5 cm, sous la manche de la chemise, qui descend à s = 0,208 de l'avant-bras). Le dernier anneau,
aux jointures, est fermé en éventail. HYPOTHÈSE de valeurs : la manchette
un peu plus lâche que le dos de la main ; à la manchette, sous le canon des brassards (`armure--brassards-d-acier`,
anneau du poignet à s = 0,236-0,248)."""
COLONNES_PAUME = 12                # HYPOTHÈSE de maillage
RAYON_PAUME = 0.07
"""m : les points de la coupe retenus pour la paume, autour de son axe ; base : la main fait ~0,09 m de large."""

PHALANGES = [(0.3, '01'), (0.0, '02'), (0.0, '03'), (0.7, '03')]
"""Les anneaux d'un doigt : (part, os) ; à la tête de l'os, décalé de `part` × la longueur de l'os vers le suivant. Le
premier anneau, à 30 % de la première phalange (hors de la palmure), est sous le bout du fourreau de la main, fermé
1 cm au-delà des jointures (base : en deçà, la coupe est celle de la paume entière)."""
PHALANGES_DU_POUCE = [(0.4, '01'), (0.0, '02'), (0.0, '03'), (0.7, '03')]
"""Les anneaux du pouce : son premier os se fond dans la paume (base : sa coupe s'y élargit), le tube part de sa
moitié, dans le fourreau de la main."""
COLONNES_DOIGT = 6                 # HYPOTHÈSE de maillage
AISANCE_DOIGT = 0.0025
"""m, du doigt de la base. Illustration : gant ajusté, doigts lisibles ; HYPOTHÈSE de valeur."""
TRANCHE = 0.004
"""m : de part et d'autre du plan d'un anneau de doigt, les sommets de la main de la base portés surtout par l'os de la
phalange, dont l'anneau prend la forme (base : ~3 mm entre deux rangées de sommets d'un doigt)."""
BOUT = 0.003
"""m : le bout de chaque doigt, au-delà de la tête de `<doigt>_04_leaf`, en pointe arrondie (éventail)."""
LISSAGE_POIDS = 1
