"""Données de `humanoide--accessoire--baudrier-sur-armure` (le Soldat, #4318), lues par `modele.py` (kit des sangles,
`element/sangle.py`, et une boucle) : la variante `baudrier-sur-armure` de la pièce `baudrier` de la garde-robe, dont
elle garde l'emplacement `epaule_d`.

Illustration directrice : « Soldat | soldat | `carrieres/soldat.png` | Livre de Base | 76 | certaine » (`INDEX.md` du
recueil `illustrations-wfrp.zip` ; page du PDF, folio imprimé 74), hors dépôt.

Ce qu'elle montre : un baudrier de cuir fauve, par-dessus le plastron, qui part de l'épaule droite, à côté du cou, et
descend en travers de la poitrine vers la hanche gauche ; une boucle de métal carrée le ferme haut sur la poitrine, sous
la clavicule droite. Le dos ne se voit pas (l'écu le cache) : la sangle remonte du flanc gauche à l'épaule droite par le
dos, nue, HYPOTHÈSE. Échelle relevée : ~520 px/m (`armure--epaulieres/donnees.py`) ; la sangle fait ~25 px de large,
~5 cm, la boucle ~30 px, ~6 cm.

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x). La sangle suit la coupe du tronc par le plan oblique qui passe par le point d'épaule `EPAULE` et le point de hanche
`HANCHE` et contient l'axe avant-arrière. Chaque cote dit d'où elle vient : `illustration`, `base` (sonde de
construction), `bandouliere` (reprise de `accessoire--bandouliere-a-parchemins/donnees.py`, même kit) ou `HYPOTHÈSE`.
"""

MANIFESTE = {
    'categorie': 'accessoire',
    'cle': {'piece': 'baudrier-sur-armure'},
    'liaison': {'mode': 'surface'},
    'couche': 'armure',
}
"""Couche `armure`, celle du plastron : à couche égale, l'accessoire se porte par-dessus."""

MATERIAUX = {
    'sangle': ('cuir', 'cuir-tanne'),
    'boucle': ('metal', 'acier-battu'),
}
"""Illustration : cuir fauve (`cuir`), boucle de métal clair (`metal`)."""

BUDGET_TRIANGLES = 500
"""Sous les 800 d'un accessoire (procédure, section 7)."""

ZONES = ['torse', 'hanches']      # zones du tronc que la sangle ceint

CONTOURNE = {'plastron': 'humanoide--armure--plastron'}
"""La sangle repose sur le plastron du preset `soldat` : elle en emprunte les poids et les clés (ses meshes des zones
`ZONES_DU_SUPPORT`). Le plastron ceint le tronc de 1,06 à 1,50 et passe sur l'épaule par sa bretelle."""
MATIERES_DU_SUPPORT = ['acier', 'dorure']
ZONES_DU_SUPPORT = ['torse', 'hanches']

EPAULE = -0.14
"""x du point d'épaule, sur la bretelle droite du plastron (base : ses deux bords à |x| = 0,10 et 0,14 à 0,15 sur
l'épaule ; la tranche `TRANCHE_EPAULE` doit en prendre un bord, la sangle tombe sinon sur l'encolure). Illustration : la
sangle part de l'épaule près du cou."""
CRETE = 0.001                     # bandouliere
TRANCHE_EPAULE = 0.015            # bandouliere

HANCHE = 1.16
"""z du point de hanche, au flanc gauche. Illustration : la sangle atteint la hanche gauche à la taille ; HYPOTHÈSE de
valeur : au-dessus du bas du plastron (1,06), pour que toute la sangle repose sur lui."""
TRANCHE_HANCHE = 0.01             # bandouliere

LARGEUR = 0.05                    # illustration : ~25 px, ~5 cm
SEGMENTS = 32                     # HYPOTHÈSE de maillage : une colonne tous les ~4 cm du tour
JEU = 0.002                       # bandouliere
EPAISSEUR = 0.003                 # bandouliere
PORTEE = 0.5                      # bandouliere
LISSAGE_POIDS = 0
"""Les poids empruntés au plastron, sans lissage : la sangle suit la plaque qu'elle couvre, et la boucle, qui les
emprunte aussi, reste sur elle."""

# --- La boucle : un cadre carré à plat sur le devant de la sangle ---
BOUCLE_Z = 1.45
"""z du centre de la boucle, sur le brin de devant. Illustration : la boucle est haut sur la poitrine droite, au-dessus du
haut de l'insigne (~1,45 m)."""
BOUCLE = (0.060, 0.050, 0.010)
"""m : longueur (le long de la sangle), largeur (en travers, un peu plus large que la sangle) et largeur du cadre.
Illustration : ~30 px sur ~25 px, le cadre ~5 px."""
EPAISSEUR_BOUCLE = 0.004          # HYPOTHÈSE : métal lisible à taille de jeu, double nappe
JEU_BOUCLE = 0.002
"""m, du dessus de la sangle au dessous de la boucle."""
