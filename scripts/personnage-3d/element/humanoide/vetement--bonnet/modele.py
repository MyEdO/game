"""Géométrie de `humanoide--vetement--bonnet` (`element/tissu.py`) : une coiffe ajustée à oreillettes, d'une pièce.

Une grille (colonnes en azimut, rangs en élévation, éventail au sommet) de rayons visés du dehors vers un centre de la
tête ; chaque rayon s'arrête, marché du dehors au pas `pas`, là où il approche au jeu près la plus extérieure des surfaces
contournées (peau et sourcils de la tête publiée, poil de la coiffure publiée, nattes comprises) ; rayons lissés sans
passer sous ce plancher. Les cellules sous le bord (le visage, le dessous des oreillettes, la nuque) sont retirées, et le
plus bas sommet de chaque ligne de colonne est posé sur le bord. La couture centrale est un relief sur les lignes de
colonne de l'avant et de l'arrière.

Double nappe, poids empruntés à la peau de la tête publiée puis lissés, silhouettes et clés `gabarit_*` transférées des
zones de la tête et du cou, au plus près. Toute cote vient de `donnees.py`.
"""
import numpy as np
from mathutils import Vector

from tissu import Maillage, arbre_de, direction_spatiale, emprunter, joindre_les_surfaces, lisser, porteur_de, selon, voisinage


def construire(D, materiaux, b):
    b.exiger(D['ZONES_DES_CLES'])
    c = D['COIFFE']
    tete = b.matieres_publiees(D['CONTOURNE']['tete'], D['MATIERES_DE_LA_TETE'])
    coiffure = b.matieres_publiees(D['CONTOURNE']['coiffure'], D['MATIERES_DE_LA_COIFFURE'])
    P, T, _ = joindre_les_surfaces([tete, coiffure])
    arbre = arbre_de(P, T)
    C = np.array(b.tete(c['os_du_centre'])) + np.asarray(c['centre'], float)

    def rayon(d, jeu):
        """Le rayon le plus grand, marché du dehors vers `C` le long de `d`, où un point approche les surfaces à `jeu`
        plus l'épaisseur près (le jeu est celui de la nappe intérieure)."""
        r = c['portee']
        while r > 0:
            if arbre.find_nearest(Vector((C + r * d).tolist()))[3] <= jeu + D['EPAISSEUR']:
                return r + c['pas']
            r -= c['pas']
        raise ValueError(f'bonnet : aucune surface sous la direction {d.round(3).tolist()}')

    n, m = c['colonnes'], c['rangs']
    pas_phi = 360.0 / n
    phis = [-180.0 + pas_phi * k for k in range(n)]
    elevations = np.linspace(c['elevation_bas'], c['elevation_haut'], m)
    pas_e = elevations[1] - elevations[0]
    gardees = {(j, k) for j in range(m - 1) for k in range(n)
               if 0.5 * (elevations[j] + elevations[j + 1]) >= selon(c['bord'], phis[k] + 0.5 * pas_phi)}
    utilises = {(j + dj, (k + dk) % n) for j, k in gardees for dj in (0, 1) for dk in (0, 1)} | {(m - 1, k) for k in range(n)}

    # Le plus bas sommet de chaque ligne de colonne est posé sur le bord, le plus bas des deux cellules voisines, à un
    # demi-rang près.
    elevation_de = {}
    for k in range(n):
        j0 = min(j for j, kk in utilises if kk == k)
        cible = min(selon(c['bord'], phis[k] - 0.5 * pas_phi), selon(c['bord'], phis[k] + 0.5 * pas_phi))
        for j, kk in utilises:
            if kk == k:
                elevation_de[j, k] = elevations[j] if j != j0 else float(np.clip(cible, elevations[j] - 0.5 * pas_e,
                                                                                 elevations[j] + 0.5 * pas_e))
    jeu = {k: selon(c['jeu'], phis[k]) for k in range(n)}
    plancher = {jk: rayon(direction_spatiale(phis[jk[1]], elevation_de[jk]), jeu[jk[1]]) for jk in utilises}
    plancher_pole = rayon(np.array([0.0, 0.0, 1.0]), selon(c['jeu'], 0.0))
    r, r_pole = dict(plancher), plancher_pole
    for _ in range(c['passes_de_lissage']):
        lisse = {}
        for (j, k), v in r.items():
            voisins = [r.get((j, (k + 1) % n)), r.get((j, (k - 1) % n)), r.get((j - 1, k)),
                       r.get((j + 1, k)) if j + 1 < m else r_pole]
            voisins = [x for x in voisins if x is not None]
            lisse[j, k] = max(0.5 * v + 0.5 * float(np.mean(voisins)), plancher[j, k])
        r_pole = max(0.5 * r_pole + 0.5 * float(np.mean([r[m - 1, k] for k in range(n)])), plancher_pole)
        r = lisse
    couture = {k for k in range(n) if abs(phis[k]) < 1e-9 or abs(abs(phis[k]) - 180.0) < 1e-9}

    M = Maillage()
    index = {}
    for jk in sorted(utilises):
        j, k = jk
        d = direction_spatiale(phis[k], elevation_de[jk])
        index[jk] = M.ajouter([C + (r[jk] + (c['couture'] if k in couture else 0.0)) * d], 'coiffe')[0]
    for j, k in sorted(gardees):
        M.quad(index[j, k], index[j, (k + 1) % n], index[j + 1, (k + 1) % n], index[j + 1, k], C)
    pole = M.ajouter([C + (r_pole + c['couture']) * np.array([0.0, 0.0, 1.0])], 'coiffe')[0]
    for k in range(n):
        M.triangle(index[m - 1, k], index[m - 1, (k + 1) % n], pole, C)

    X, orientes, normales = M.orienter()
    porteur = porteur_de(*tete)
    W = lisser(np.array([emprunter(p, porteur)[0] for p in X]), voisinage(orientes, len(X)), c['passes_de_lissage'])
    piece = b.nappe('bonnet', X, normales, W, orientes, materiaux['bonnet'], D['EPAISSEUR'])
    b.transferer(piece, D['ZONES_DES_CLES'], bornes=D['BORNES_DES_CLES'])
    return piece
