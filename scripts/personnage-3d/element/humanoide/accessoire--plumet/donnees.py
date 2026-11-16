"""Données de `humanoide--accessoire--plumet` (le Soldat, #4318), lues par `modele.py` : la pièce `plumet` de la
garde-robe, posée sur l'emplacement `cimier`.

Illustration directrice : « Soldat | soldat | `carrieres/soldat.png` | Livre de Base | 76 | certaine » (`INDEX.md` du
recueil `illustrations-wfrp.zip` ; page du PDF, folio imprimé 74), hors dépôt.

Ce qu'elle montre : deux plumes d'autruche plantées au même point, à l'avant-haut de la calotte du casque. Une grande
plume blanche, large et fournie, qui monte de ~24 cm au-dessus du casque en penchant vers la droite de l'image, la
pointe recourbée ; une plume rouge plus courte et touffue, qui part de sa base vers la droite de l'image à ~40° et
retombe. La tête est tournée d'un quart vers la gauche de l'image : la droite de l'image est la gauche et l'arrière du
personnage. Échelle relevée : ~520 px/m (du bas des bottes au sommet du casque, ~915 px pour ~1,75 m) ; la plume blanche
y fait ~155 px de long et ~50 px de large, la rouge ~105 px de long et ~55 px de large.

Repère : celui de l'emplacement `cimier` qu'offre le casque (`armure--casque`, `CIMIER`), mètres : l'origine sur la
coque, +X la gauche du personnage, +Y la verticale inclinée vers l'arrière, +Z vers l'avant. Chaque cote dit d'où elle
vient : `illustration` ou `HYPOTHÈSE` (rien ne la donne, à trancher en revue).
"""

MANIFESTE = {
    'categorie': 'accessoire',
    'cle': {'piece': 'plumet'},
    'liaison': {'mode': 'rigide'},
    'couche': 'armure',
}
MATERIAUX = {
    'plume': ('plume', ((0.6, 0.6, 0.6), 0.0, 0.95)),
    'plume_rouge': ('accent', ((0.6, 0.6, 0.6), 0.0, 0.95)),
}
"""Aucune matière de plume au catalogue : gris de construction, teinté par les emplacements `plume` (la blanche) et
`accent` (la rouge)."""

BUDGET_TRIANGLES = 800                  # procédure du skill, section 7 : accessoire

EMPLACEMENT = 'cimier'
"""L'emplacement de la garde-robe où se pose la pièce (`plumet`, `src/data/garde-robe.json`) : les plumes se bâtissent
dans son repère et pendent à son os."""
OFFRANT = 'humanoide--armure--casque'
"""L'élément dont le manifeste offre cet emplacement et donne son repère."""
ANGLE_LISSE = 50.0                      # HYPOTHÈSE : degrés, les barbes restent lisses, les franges marquées

# Une plume : une hampe (`chemin`, points de passage d'une courbe) habillée de sections en lentille, la face tournée
# vers l'avant au pied ; `largeurs` et `epaisseurs` donnent, par part de la longueur, la demi-largeur des barbes et la
# demi-épaisseur au droit de la hampe ; `surface`, le matériau de `MATERIAUX` qu'elle prend.
PLUMES = {
    'blanche': {
        'surface': 'plume',
        # illustration : monte de ~24 cm en penchant vers l'arrière-gauche, la pointe retombe vers l'arrière
        'chemin': [(0.0, 0.0, 0.0), (0.008, 0.07, -0.008), (0.022, 0.15, -0.032), (0.042, 0.225, -0.075),
                   (0.062, 0.275, -0.140), (0.074, 0.280, -0.205), (0.080, 0.255, -0.250)],
        # illustration : ~10-11 cm de large au milieu, la pointe arrondie
        'largeurs': [(0.0, 0.004), (0.08, 0.022), (0.3, 0.050), (0.6, 0.058), (0.85, 0.052), (1.0, 0.028)],
        'epaisseurs': [(0.0, 0.004), (0.3, 0.016), (0.8, 0.014), (1.0, 0.007)],   # HYPOTHÈSE : plume fournie
        'sections': 18,                 # HYPOTHÈSE de maillage
    },
    # La touffe rouge : quatre plumes frisées plantées au pied de la blanche, en éventail. Illustration : une masse
    # rouge de ~20 cm sur ~11 cm, qui part vers la gauche du personnage à ~40° et retombe, faite de plusieurs pointes
    # recourbées qui se séparent au bout. HYPOTHÈSE : quatre plumes, chacune ~3,5 cm de demi-largeur, dont les pointes
    # s'écartent de ~6 cm (haut, milieu, bas, arrière), la pointe enroulée vers le bas.
    'rouge_haut': {
        'surface': 'plume_rouge',
        'chemin': [(0.006, 0.0, -0.004), (0.030, 0.060, -0.020), (0.070, 0.125, -0.050), (0.118, 0.160, -0.085),
                   (0.160, 0.150, -0.112), (0.178, 0.112, -0.122)],
        'largeurs': [(0.0, 0.004), (0.15, 0.020), (0.5, 0.036), (0.85, 0.034), (1.0, 0.018)],
        'epaisseurs': [(0.0, 0.004), (0.3, 0.014), (0.8, 0.012), (1.0, 0.006)],
        'sections': 8,                  # HYPOTHÈSE de maillage
    },
    'rouge_milieu': {
        'surface': 'plume_rouge',
        'chemin': [(0.006, 0.0, -0.004), (0.035, 0.045, -0.018), (0.080, 0.090, -0.045), (0.130, 0.118, -0.078),
                   (0.172, 0.112, -0.110), (0.198, 0.078, -0.132), (0.200, 0.045, -0.138)],
        'largeurs': [(0.0, 0.004), (0.15, 0.022), (0.5, 0.038), (0.85, 0.036), (1.0, 0.020)],
        'epaisseurs': [(0.0, 0.004), (0.3, 0.014), (0.8, 0.012), (1.0, 0.006)],
        'sections': 8,
    },
    'rouge_bas': {
        'surface': 'plume_rouge',
        'chemin': [(0.006, 0.0, 0.0), (0.045, 0.030, -0.005), (0.100, 0.060, -0.020), (0.160, 0.068, -0.040),
                   (0.205, 0.045, -0.058), (0.222, 0.005, -0.066)],
        'largeurs': [(0.0, 0.004), (0.15, 0.020), (0.5, 0.034), (0.85, 0.032), (1.0, 0.018)],
        'epaisseurs': [(0.0, 0.004), (0.3, 0.014), (0.8, 0.012), (1.0, 0.006)],
        'sections': 8,
    },
    'rouge_arriere': {
        'surface': 'plume_rouge',
        'chemin': [(0.004, 0.0, -0.008), (0.025, 0.050, -0.040), (0.055, 0.095, -0.090), (0.095, 0.115, -0.145),
                   (0.130, 0.095, -0.190), (0.142, 0.055, -0.205)],
        'largeurs': [(0.0, 0.004), (0.15, 0.020), (0.5, 0.034), (0.85, 0.032), (1.0, 0.018)],
        'epaisseurs': [(0.0, 0.004), (0.3, 0.014), (0.8, 0.012), (1.0, 0.006)],
        'sections': 8,
    },
}
FRANGE = 0.09
"""HYPOTHÈSE : part de la demi-largeur dont le bord des barbes avance ou recule d'une section à la suivante (bord en
dents, des barbes qui se séparent)."""
RETOMBEE = 0.35
"""HYPOTHÈSE : part de la demi-largeur dont le bord des barbes retombe derrière la face de la plume (barbes arquées)."""
