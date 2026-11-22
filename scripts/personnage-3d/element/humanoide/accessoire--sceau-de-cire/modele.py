"""Géométrie de `humanoide--accessoire--sceau-de-cire`, d'après `donnees.py` (aucun nombre ici) :

- la feuille : une grille couchée sur la bure publiée, chaque sommet visé depuis l'axe du corps le long de son azimut et
  posé sur la bure, plus le jeu ; son haut au-dessus de la corde publiée, son bas déchiré, un coin relevé ;
- la bande : trois colonnes couchées de même par-dessus la feuille, du sceau à sa queue d'aronde ;
- le sceau : un disque bombé tourné autour de la normale de la bure sous son centre, posé sur la bande, son cachet en
  creux ;
- l'écriture : un trait d'encre par mot, à son jeu au-dessus de la feuille (lignes qui sautent le sceau et la bande) et de
  la bande (le long d'elle), coupé aux colonnes de la feuille et aux rangs de la bande pour en suivre la surface ;
- l'emplacement `EMPLACEMENT`, offert sur la face extérieure de la corde au milieu de la feuille (`Base.offrir`).
Chaque nappe se décrit sur ses paramètres (abscisse le long de la bure, hauteur) par sa distance à l'axe, et se relève
(`relever`) au-dessus de chaque sommet de ce qu'elle couvre, la bure ou la nappe dessous : posée sur la bure aux seuls
sommets visés, la feuille passait derrière un pli de la bure entre deux d'entre eux (`couche-percee-au-repos`, 11 mm).
Feuille et bande, en double nappe, et l'écriture prennent les poids de la bure sous chaque sommet ; le sceau, en bloc, ceux de la bure
sous son centre. Silhouettes et clés `gabarit_*` transférées de la bure publiée sous la pièce.
"""
import math

import numpy as np
from sceau import Cadre, Grille, Ruban, azimut, encre, mots_d_une_ligne, sceau, trait
from tente import HAUT
from tissu import emprunter, joindre, porteur_de


def construire(D, materiaux, b):
    b.exiger(D['ZONES'])
    bure, corde = (porteur_de(*b.matieres_publiees(D['CONTOURNE'][k], D['MATIERES'][k])) for k in ('bure', 'cordeliere'))
    anneau = corde['P'][np.unique(corde['T'])]
    P = np.concatenate([b.corps(z)[0] for z in D['ZONES']])
    tranche = P[np.abs(P[:, 2] - np.median(anneau[:, 2])) < D['TRANCHE_DU_CORPS']]
    centre = np.array([*(tranche[:, :2].min(axis=0) + tranche[:, :2].max(axis=0)) / 2, 0.0])

    pres = anneau[np.abs(azimut(centre, anneau) - D['AZIMUT']) < D['TRANCHE']]
    hauteur = pres[:, 2].mean()
    cadre = Cadre(bure, centre, D['AZIMUT'], hauteur, D['PORTEE'])
    F, R, S, C, E = D['FEUILLE'], D['RUBAN'], D['SCEAU'], D['CACHET'], D['ECRITURE']
    ep_f, ep_r = F['jeu'] + F['epaisseur'], R['jeu'] + R['epaisseur']

    # Feuille : colonne i de la gauche du personnage à sa droite, rang j de haut en bas.
    n, k = F['colonnes'], F['rangs']
    uv_f, rho_f = [], []
    for i in range(n + 1):
        g = F['largeur'] / 2 - F['largeur'] * i / n
        bas = F['hauteur'] - D['DECHIRURES'][i]
        coin = max(0.0, 1 - i / (0.35 * n))
        for j in range(k + 1):
            z = hauteur + F['au_dessus'] - bas * j / k
            uv_f.append((g, z))
            rho_f.append(cadre.sur(g, z)[0] + ep_f + D['COIN_RELEVE'] * coin * (j / k) ** 2)
    feuille = Grille(uv_f, [list(range(i * (k + 1), (i + 1) * (k + 1))) for i in range(n + 1)], rho_f)
    feuille.relever(*cadre.dessous, ep_f)

    # Bande : sur la bure et sur la feuille.
    g_s, z_s = -S['droite'], hauteur - S['sous']
    ruban = Ruban(R, cadre, g_s, z_s, S['rayon'], ep_f + ep_r)
    bande = ruban.grille
    bande.relever(feuille.uv, feuille.rho, ep_r)
    for s, r in enumerate(feuille.sous(bande.uv)):
        if r is not None:
            bande.rho[s] = max(bande.rho[s], r + ep_r)

    # Écriture : sur la feuille, des lignes de mots coupés aux colonnes de sa grille, qui sautent le sceau et la bande ;
    # le long de la bande, des mots coupés à ses rangs.
    traits = []
    coupes_f = sorted({feuille.uv[c[0]][0] for c in feuille.colonnes})
    for rang, longueurs in enumerate(D['LIGNES']):
        z = hauteur - E['sous'] - E['interligne'] * rang
        barrees = []
        dz = abs(z - z_s) - E['trait'] / 2
        if dz < S['rayon'] + E['autour']:
            demi = math.sqrt((S['rayon'] + E['autour']) ** 2 - max(dz, 0.0) ** 2)
            barrees.append((g_s - demi, g_s + demi))
        if z < ruban.haut:
            demi = R['largeur'] / 2 + E['autour']
            barrees.append((ruban.milieu(z) - demi, ruban.milieu(z) + demi))
        for g0, g1 in mots_d_une_ligne(longueurs, -F['largeur'] / 2 + E['marge'], F['largeur'] / 2 - E['marge'],
                                       E['espace'], barrees):
            g = [g0, *(c for c in coupes_f if g0 < c < g1), g1]
            traits.append((trait([(x, z) for x in g], np.array([0.0, 1.0]), E['trait'] / 2), feuille))
    traits += ruban.mots(D['LIGNES_DU_RUBAN'], E)
    ecriture = encre(b, cadre, traits, E['jeu'], materiaux['encre'])
    objets = [feuille.nappe(b, cadre, 'feuille', materiaux['parchemin'], F['epaisseur']),
              bande.nappe(b, cadre, 'bande', materiaux['parchemin'], R['epaisseur']),
              sceau(b, cadre, S, C, *ruban.sous_le_sceau(), materiaux['cire'], D['ANGLE_LISSE']), ecriture]

    d0 = cadre.vers(0)
    dehors = pres[np.argmax(np.linalg.norm(pres[:, :2] - centre[:2], axis=1))]
    point = centre + d0 * np.linalg.norm(dehors[:2] - centre[:2]) + HAUT * hauteur
    b.offrir(D['EMPLACEMENT'], emprunter(point, bure)[0], point, (np.cross(HAUT, d0), HAUT, d0))

    piece = joindre(objets)
    piece.name = D['MANIFESTE']['cle']['piece']
    b.transferer(piece, D['ZONES'], masques=[([True] * len(piece.data.vertices), D['ZONES'],
                                              {D['CONTOURNE']['bure']: D['ZONES_DE_LA_BURE']})])
    return piece
