"""Données de `humanoide--accessoire--ceinture-large` (le Gladiateur, #4394, contrat du 2026-11-22), lues par `modele.py` :
la variante `ceinture-large` de la pièce `ceinture` de la garde-robe, liée en surface et posée sur la culotte du
Gladiateur comme la ceinture à boucle du Sorcier sur sa robe (`accessoire--ceinture-a-boucle`).

Illustration directrice : celle du Gladiateur fournie par l'utilisateur le 2026-11-02 (#4394), 773 × 1257 px, hors dépôt.

Ce qu'elle montre : une large ceinture en deux bandes, serrée sur la culotte sous le nombril : en haut un bourrelet de
cuir roulé, clair ; dessous une bande de cuir sombre qui porte des plaques de métal doré, de la hanche droite vers le
devant un disque, un triangle, puis de petites plaques ; un médaillon en soleil, disque à rayons, pend sous la bande à
la hanche droite ; une languette de tissu clair à bout fourchu pend devant, entre le médaillon et le milieu. Omis
(contrat) : les deux crânes, la chaîne, les pendants, le liseré rouge de la languette. Le milieu du devant et la hanche
gauche sont cachés par un crâne et par le bras : une boucle au milieu et des disques à gauche, HYPOTHÈSE. Le dos ne se
voit pas : le cuir fait le tour, sans plaque, HYPOTHÈSE du contrat. Échelle : ~580 px/m
(`vetement--haut-de-chausses-ample`).

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x). Une abscisse se compte le long du cuir depuis le milieu du devant, vers la gauche du personnage.
"""

MANIFESTE = {
    'categorie': 'accessoire',
    'cle': {'piece': 'ceinture-large'},
    'liaison': {'mode': 'surface'},
    'couche': 'tenue',
}
"""Couche `tenue`, celle de la culotte : à couche égale, un accessoire se porte par-dessus (`ordreDesCouches`,
`hotes/godot/asset/pile.ts`)."""

MATERIAUX = {
    'cuir': ('cuir', 'cuir-tanne'),
    'metal': ('metal', 'laiton-dore'),
    'tissu': ('vet1', 'toile-ecrue'),
}
"""Illustration : cuir brun du bourrelet et de la bande ; plaques, médaillon et boucle d'un métal doré ; languette
d'une toile claire (`vet1`)."""

BUDGET_TRIANGLES = 800            # procédure du skill, section 7 : accessoire

CONTOURNE = {'culotte': 'humanoide--vetement--haut-de-chausses-ample'}
"""La ceinture repose sur la culotte du preset `gladiateur` : elle en emprunte les poids et les clés (ses meshes des
zones `ZONES_DE_LA_CULOTTE`)."""
MATIERES_DE_LA_CULOTTE = ['toile']
ZONES_DE_LA_CULOTTE = ['torse', 'hanches', 'cuisse_g', 'cuisse_d']
ZONES = ['torse', 'hanches', 'cuisse_g', 'cuisse_d']   # zones du corps que la ceinture traverse

EMPLACEMENT = 'ceinture_avant'
ABSCISSE_DE_L_EMPLACEMENT = 0.075
"""L'emplacement de la garde-robe que la ceinture offre, sur la face de la bande. HYPOTHÈSE : à gauche de la boucle, sur
le cuir nu entre elle et le premier disque."""

HAUTEUR = 1.078
"""z du milieu de la bande. Illustration : la ceinture sous le nombril, haute de ~60 px (~10 cm) au milieu du devant,
sur un bassin basculé ; sous le haut de la culotte, à 1,13 (`vetement--haut-de-chausses-ample`)."""
LARGEUR = 0.055                   # illustration : la bande à plaques haute de ~32 px
EPAISSEUR = 0.004                 # HYPOTHÈSE : un cuir épais
SEGMENTS = 24                     # sections autour de la taille (HYPOTHÈSE de maillage)
JEU = 0.005
"""HYPOTHÈSE : l'envers du cuir à 5 mm de la culotte, mesurés le long de chaque rayon ; jamais plus près de l'axe que la
corde de ses deux sections voisines, en `PASSES_DE_PONT` passes."""
PASSES_DE_PONT = 3
PORTEE = 0.6                      # m : départ des visées vers la culotte, depuis l'axe du corps

BOURRELET = {'hauteur': 1.117, 'rayon': 0.013, 'cotes': 5, 'rentre': 0.006}
"""Le bourrelet de cuir roulé : z de son axe, rayon et côtés de sa section, et ce dont il rentre vers le corps.
Illustration : un boudin de ~15 px (2,6 cm) posé sur le bord haut de la bande ; son haut, à 1,13, cache le bord de la
culotte, sur lequel il rentre de 6 mm (HYPOTHÈSE) : posé au jeu, il laissait voir une fente entre lui et le ventre
(rendu de trois-quarts)."""

BOUCLE = {'largeur': 0.05, 'hauteur': 0.068, 'barre': 0.010, 'epaisseur': 0.008}
"""HYPOTHÈSE (cachée par un crâne dans l'illustration) : un cadre rectangulaire au milieu du devant, plus haut que la
bande."""
DISQUES = {'abscisses': [-0.235, -0.135, 0.14, 0.19, 0.24], 'rayon': 0.016, 'cotes': 8, 'epaisseur': 0.005}
"""Illustration : un disque de ~20 px (3,4 cm) près de la hanche droite, de petites plaques vers le devant ; à gauche,
HYPOTHÈSE (cachés)."""
TRIANGLE = {'abscisse': -0.185, 'cote': 0.036, 'epaisseur': 0.005}
"""Illustration : une plaque en triangle pointe en haut, de ~20 px de côté, entre le disque de la hanche et le devant."""
SOLEIL = {'abscisse': -0.16, 'sous_la_bande': 0.012, 'rayon': 0.024, 'rayons': 8, 'pointe': 0.038, 'epaisseur': 0.004,
          'bosse': 0.015, 'saillie': 0.004}
"""Le médaillon en soleil : son centre à `sous_la_bande` sous le bord bas de la bande, un disque de `rayon` à `rayons`
pointes de `pointe`, une bosse ronde au milieu. Illustration : ~45 px (7,6 cm) de pointe à pointe, à la hanche droite,
à cheval sur le bord bas de la ceinture."""
LANGUETTE = {'abscisse': -0.085, 'demi_largeur': 0.026, 'epaisseur': 0.004,
             'rangs': [1.078, 1.03, 0.985, 0.94, 0.90], 'fourche': 0.03}
"""La languette de toile : z de ses rangs, du milieu de la bande à ses deux pointes, le milieu du dernier rang remonté
de `fourche`. Illustration : ~30 px de large (5,2 cm), ~105 px de long (18 cm), le bout fourchu, à ~50 px (8,5 cm) à la
droite du personnage du milieu du devant."""

ANGLE_VIF = 40                    # degrés : au-delà, une arête reste vive (chants du cuir, arêtes des plaques)
