"""Géométrie de `humanoide--armure--tassettes` : sur le devant de chaque cuisse, trois lames d'acier superposées, leur
bordure et leurs coins dorés, posées sur le haut-de-chausses publié (`donnees.py`).

Chaque lame est une grille de quatre rangs (`PROFIL`) et sept colonnes : les deux bords, le bord intérieur de chaque
bordure, le coin doré et le milieu. Chaque nœud est posé au `JEU` du point le plus avancé du haut-de-chausses entre
ses rangs et ses colonnes voisins, visé de l'avant sur une grille (`VISEES`) : la lame épouse le galbe de la cuisse ;
elle s'écarte de son fond du bord haut au bord bas,
par-dessus la lame suivante. La dorure reprend les nœuds de la lame, au `RELIEF` : une bande le long de chaque côté,
une le long du bas de la dernière lame, un triangle par lame. Doubles nappes ; le bord haut et le bord bas d'une lame
portent chacun la moyenne des poids qu'il emprunte au haut-de-chausses, et les rangs entre eux passent de l'un à
l'autre en ligne droite : la lame plie dans sa hauteur, jamais en travers ; la dorure porte les poids de l'acier
qu'elle borde. Clés reprises du corps.
"""
import numpy as np
from mathutils import Vector
from tissu import Maillage, direction_spatiale, emprunter, joindre, porteur_de


def nappe(b, nom, noeuds, W, quads, triangles, derriere, mat, epaisseur, relief):
    """La double nappe des `quads` et `triangles` (indices de `noeuds`), ses sommets au `relief` devant eux."""
    utiles = sorted({i for face in quads + triangles for i in face})
    rang = {i: k for k, i in enumerate(utiles)}
    M = Maillage()
    M.ajouter([noeuds[i] + relief for i in utiles], nom)
    for a, c, d, e in quads:
        M.quad(rang[a], rang[c], rang[d], rang[e], derriere)
    for a, c, d in triangles:
        M.triangle(rang[a], rang[c], rang[d], derriere)
    X, orientes, normales = M.orienter()
    return b.nappe(nom, X, normales, W[utiles], orientes, mat, epaisseur)


def tassette(D, b, porteur, cote, signe, materiaux):
    """Les lames et la dorure de la tassette du côté `cote` (`l` : `signe` +1, `r` : -1)."""
    hanche = np.array(b.tete(f"{D['OS']}_{cote}"))
    face = direction_spatiale(signe * D['AZIMUT'])
    travers = np.array([-face[1], face[0], 0.0])
    hauteur = (D['LAMES'] - 1) * D['PAS'] + D['LONGUEUR']
    relief = D['RELIEF'] * face
    objets = []
    for k in range(D['LAMES']):
        zs = [D['Z_HAUT'] - k * D['PAS'] - t * D['LONGUEUR'] for t, _ in D['PROFIL']]
        noeuds = []
        for r, (z, (_, ecart)) in enumerate(zip(zs, D['PROFIL'])):
            demi = np.interp((D['Z_HAUT'] - z) / hauteur, *zip(*D['LARGEUR'])) / 2
            us = [-demi, -demi + D['BORDURE'], -D['COIN'] * demi, 0.0, D['COIN'] * demi, demi - D['BORDURE'], demi]
            for c, u in enumerate(us):
                avancees = []
                for uv in np.linspace(us[max(c - 1, 0)], us[min(c + 1, len(us) - 1)], D['VISEES']):
                    for zv in np.linspace(zs[max(r - 1, 0)], zs[min(r + 1, len(zs) - 1)], D['VISEES']):
                        depart = np.array([hanche[0], hanche[1], zv]) + uv * travers + D['PORTEE'] * face
                        touche = porteur['arbre'].ray_cast(Vector(depart.tolist()), Vector((-face).tolist()), D['PORTEE'])
                        if touche[0] is not None:
                            avancees.append(D['PORTEE'] - touche[3])
                if not avancees:
                    raise ValueError(f'tassette {cote} : aucun haut-de-chausses devant le nœud z = {z:.3f}, u = {u:.3f}')
                noeuds.append(np.array([hanche[0], hanche[1], z]) + u * travers
                              + (max(avancees) + D['JEU'] + D['EPAISSEUR'] + ecart) * face)
        colonnes, rangs = len(noeuds) // len(D['PROFIL']), len(D['PROFIL'])
        i = lambda r, c: r * colonnes + c
        maille = lambda r, c: (i(r, c), i(r, c + 1), i(r + 1, c + 1), i(r + 1, c))
        derriere = np.array([hanche[0], hanche[1], D['Z_HAUT'] - k * D['PAS'] - D['LONGUEUR'] / 2])
        acier = [maille(r, c) for r in range(rangs - 1) for c in range(colonnes - 1)]
        # Du bord haut au bord bas, les poids passent en ligne droite de la moyenne de l'un à celle de l'autre.
        du_haut, du_bas = (np.mean([emprunter(p, porteur)[0] for p in noeuds[i(r, 0):i(r, colonnes)]], axis=0)
                           for r in (0, rangs - 1))
        W = np.repeat([(1 - t) * du_haut + t * du_bas for t, _ in D['PROFIL']], colonnes, axis=0)
        dorure = [maille(r, c) for r in range(rangs - 1) for c in (0, colonnes - 2)]
        if k == D['LAMES'] - 1:
            dorure += [maille(rangs - 2, c) for c in range(1, colonnes - 2)]
        coin = [(i(1, 2), i(1, 3), i(2, 3)), (i(1, 3), i(1, 4), i(2, 3))]
        objets.append(nappe(b, f'lame_{cote}{k}', noeuds, W, acier, [], derriere, materiaux['acier'], D['EPAISSEUR'],
                            np.zeros(3)))
        objets.append(nappe(b, f'dorure_{cote}{k}', noeuds, W, dorure, coin, derriere, materiaux['dorure'],
                            D['EPAISSEUR_DE_LA_DORURE'], relief))
    return objets


def construire(D, materiaux, b):
    b.exiger(D['ZONES_DES_CLES'])
    porteur = porteur_de(*b.matieres_publiees(D['CONTOURNE']['haut_de_chausses'], D['MATIERES']['haut_de_chausses']))
    piece = joindre([o for cote, signe in (('l', 1), ('r', -1)) for o in tassette(D, b, porteur, cote, signe, materiaux)])
    piece.name = D['MANIFESTE']['cle']['piece']
    b.transferer(piece, D['ZONES_DES_CLES'])
    return piece
