"""Données de `humanoide--accessoire--ceinture-a-boucle` (le Sorcier, #4351, contrat du 2026-11-16), lues par `modele.py` :
la variante `ceinture-a-boucle` de la pièce `ceinture` de la garde-robe, liée en surface et posée sur la robe du
Sorcier comme la cordelière du Prêtre sur sa bure (`accessoire--cordeliere`).

Illustration directrice : « Sorcier | sorcier | `carrieres/sorcier.png` » (`INDEX.md` du recueil `illustrations-wfrp`),
LDB folio 92, hors dépôt. Ce qu'elle montre : une ceinture de cuir olive-brun, large, serrée sur la robe à la taille ;
devant, une grande boucle rectangulaire de laiton, plus haute que le cuir, à ardillon ; à la gauche du personnage, le
bout du cuir percé d'œillets (OMIS, contrat) passe sous deux passants de laiton, puis un anneau de laiton est fixé au
cuir. Le dos ne se voit pas (HYPOTHÈSE : le cuir fait le tour, nu). Échelle relevée : 2,0 mm par pixel (semelles à
y 1095 px, sommet du crâne à y ~185 px, pour les 1,82 m de la base).

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x). Une abscisse se compte le long du cuir depuis le milieu du devant, vers la gauche du personnage.
"""

MANIFESTE = {
    'categorie': 'accessoire',
    'cle': {'piece': 'ceinture-a-boucle'},
    'liaison': {'mode': 'surface'},
    'couche': 'armure',
}
"""Couche `armure`, la première au-dessus de `tenue` : la ceinture se porte par-dessus la robe, dont l'évaluateur mesure
alors qu'elle ne la traverse pas (comme `accessoire--cordeliere` sur la bure)."""

MATERIAUX = {
    'cuir': ('cuir', 'cuir-tanne'),
    'laiton': ('metal', 'laiton-dore'),
}

BUDGET_TRIANGLES = 800            # procédure du skill, section 7 : accessoire

CONTOURNE = {'robe': 'humanoide--vetement--robe'}
"""La ceinture repose sur la robe du preset `sorcier` : elle en emprunte les poids et les clés (ses meshes des zones
`ZONES_DE_LA_ROBE`)."""
MATIERES_DE_LA_ROBE = ['robe', 'galon', 'dessous', 'poitrine']
ZONES_DE_LA_ROBE = ['torse', 'hanches', 'cuisse_g', 'cuisse_d']
ZONES = ['torse', 'hanches', 'cuisse_g', 'cuisse_d']   # zones du corps que la ceinture traverse

EMPLACEMENT = 'ceinture_avant'
ABSCISSE_DE_L_EMPLACEMENT = -0.075
"""L'emplacement de la garde-robe que la ceinture offre, sur sa face. Illustration : le médaillon du preset pend du
cuir à la droite de la boucle (~35 px, 7 cm du milieu)."""

HAUTEUR = 1.09
"""z du milieu du cuir. Illustration : le milieu de la ceinture à y ~565 px (1,06 m) ; 3 cm plus haut, le cuir et la
boucle restent sur le corsage de la robe, au-dessus de sa couture avec la jupe (z 1,04 m, bas de la zone `torse` de la
base) : dessous, la jupe posée sur le filet `jupe` s'écarte du corps de 6 cm aux hanches, où la ceinture à cheval
s'évasait en cône (vu au rendu), et passe devant le bas de la boucle quand la hanche plie (`couche-traversee`, 44 mm
en Roll, la boucle descendue à 1,03 m)."""
LARGEUR = 0.07                    # contrat : cuir large de ~7 cm (illustration : ~35 px)
EPAISSEUR = 0.004                 # HYPOTHÈSE : un cuir épais
SEGMENTS = 32                     # sections autour de la taille (HYPOTHÈSE de maillage)
JEU = 0.005
"""HYPOTHÈSE : l'envers du cuir à 5 mm de la robe, mesurés le long de chaque rayon ; le cuir ponte les creux (l'ouverture
de la robe de dessus), jamais plus près de l'axe que la corde de ses deux sections voisines, en `PASSES_DE_PONT` passes."""
PASSES_DE_PONT = 3
PORTEE = 0.6                      # m : départ des visées vers la robe, depuis l'axe du corps

BOUCLE = {'largeur': 0.085, 'hauteur': 0.088, 'barre': 0.014, 'epaisseur': 0.010}
"""Illustration : la boucle, un cadre rectangulaire de ~42 px de large et ~45 px de haut, qui dépasse le cuir en haut et
en bas, aux barres de ~7 px ; HYPOTHÈSE : 10 mm d'épaisseur."""
ARDILLON = {'longueur': 0.05, 'section': 0.008}
"""Illustration : l'ardillon part de la barre droite du cadre (côté droit du personnage) et couche sur le cuir vers sa
gauche, sur ~25 px."""
PASSANTS = {'abscisses': [0.07, 0.105], 'largeur': 0.012, 'debord': 0.006, 'epaisseur': 0.005}
"""Illustration : deux passants de laiton, barres verticales de ~6 px, à ~35 et ~52 px à gauche du milieu de la boucle ;
`debord` : ce dont chacun dépasse le cuir en haut et en bas (HYPOTHÈSE)."""
ANNEAU = {'abscisse': 0.155, 'rayon': 0.02, 'section': 0.005, 'cotes': 10, 'facettes': 6}
"""Illustration : un anneau de laiton de ~22 px de diamètre extérieur (4,5 cm) contre le cuir, ~78 px à gauche du milieu
de la boucle ; la cheville qui en pend : OMIS (détail)."""

ANGLE_VIF = 40                    # degrés : au-delà, une arête reste vive (chants du cuir, arêtes des barres)
