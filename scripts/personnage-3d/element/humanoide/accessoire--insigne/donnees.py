"""Données de `humanoide--accessoire--insigne` (le Soldat, #4318), lues par `modele.py` : la pièce `insigne` de la
garde-robe (emplacement `poitrine`), qui reçoit l'emblème du porteur sur sa surface `blason` (#3111) ; au preset
`soldat`, `taureau-rouge`. Pièce publiée sans source (#3761), écrite ici depuis l'illustration.

Illustration directrice : « Soldat | soldat | `carrieres/soldat.png` | Livre de Base | 76 | certaine » (`INDEX.md` du
recueil `illustrations-wfrp.zip` ; page du PDF, folio imprimé 74), hors dépôt.

Ce qu'elle montre : sur la gauche de la poitrine, un insigne en écu, bord supérieur droit, flancs droits puis arrondis
jusqu'à la pointe, cerclé d'un liseré de métal sombre ; le champ porte la tête de taureau rouge (l'emblème, posé au
montage, jamais modelé). Échelle relevée : ~520 px/m (`armure--epaulieres/donnees.py`) ; l'écu fait ~60 px de large sur
~75 px de haut, ~11,5 cm sur ~14,5 cm.

Repère : celui de l'emplacement `poitrine` qu'offre le plastron (`armure--plastron`), où l'insigne se bâtit et pend à
son os : +X vers la gauche du personnage, +Y vers le haut, +Z sortant de la plaque. Chaque cote dit d'où elle vient :
`illustration` ou `HYPOTHÈSE`.
"""

MANIFESTE = {
    'categorie': 'accessoire',
    'cle': {'piece': 'insigne'},
    'liaison': {'mode': 'rigide'},
    'couche': 'armure',
}
"""Couche `armure`, comme l'insigne publié : posé sur le plastron."""

MATERIAUX = {
    'champ': ('vet2', ((0.8, 0.8, 0.8), 0.0, 0.5)),
    'bordure': ('metal', 'acier-battu'),
}
"""`champ` : la face qui reçoit l'emblème, à l'emplacement `vet2` de l'insigne publié ; émail ou peinture sur métal,
qu'aucune matière du catalogue (`materials.json`, domaine `prop`) ne rend : gris de construction. `bordure` : le liseré,
les flancs et le revers, d'acier (illustration : liseré de métal sombre)."""

BLASONS = ('champ',)
"""Le champ reçoit l'emblème du porteur (`embleme` du preset), ses UV sur le carré [0,1]²."""

BUDGET_TRIANGLES = 200
"""Sous les 800 d'un accessoire (procédure, section 7)."""

EMPLACEMENT = 'poitrine'
"""L'emplacement de la garde-robe où se pose la pièce (`insigne`, `src/data/garde-robe.json`)."""
OFFRANT = 'humanoide--armure--plastron'
"""L'élément dont le manifeste offre cet emplacement et donne son repère."""

LARGEUR = 0.115                   # illustration : ~60 px, ~11,5 cm
HAUTEUR = 0.145                   # illustration : ~75 px, ~14,5 cm, du bord supérieur à la pointe
FLANC = 0.45
"""Part de la hauteur, depuis le bord supérieur, où les flancs droits commencent à s'arrondir vers la pointe.
Illustration : l'arrondi commence un peu au-dessus de mi-hauteur."""
POINTS_DE_L_ARRONDI = 5           # HYPOTHÈSE de maillage : par côté, de la fin du flanc à la pointe
LISERE = 0.007                    # illustration : ~3 à 4 px, ~7 mm, du bord au champ
RELIEF_DU_LISERE = 0.002          # HYPOTHÈSE : le liseré ressort du champ, lisible à taille de jeu
EPAISSEUR = 0.004                 # HYPOTHÈSE : plaque de métal, du revers au champ
JEU = 0.003                       # HYPOTHÈSE : m, du revers au plastron, au centre
RAYON_DE_CINTRE = 0.30
"""m : l'écu est cintré autour de l'axe vertical pour épouser la plaque bombée ; HYPOTHÈSE (le plastron a ~0,2 à
0,3 m de rayon de courbure en travers de la poitrine, base)."""
