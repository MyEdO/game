"""Géométrie de `humanoide--vetement--foulard` (`element/tissu.py`) : un foulard roulé autour du cou, posé sur le col du
pourpoint publié, qui retombe en pans courts sur le haut de la poitrine.

Colonnes en azimut autour de l'axe vertical du cou. Le bourrelet : des anneaux visés horizontalement de cet axe vers le
dehors jusqu'au cou, chacun à sa hauteur au-dessus de la couture cou/torse et posé au jeu du cou, plissé, écarté du
pourpoint et de la tête au jeu minimal. Le tombant : sous le bourrelet, chaque colonne suit son profil, visé du dehors
vers le `CENTRE`, sous les épaules, d'élévation en élévation de `ELEVATION_HAUT` au bord de la colonne (`BORD`, en pans
irréguliers, `PANS`), au `JEU` de la plus extérieure des surfaces dessous (pourpoint, cou, torse) ; ses rangs s'y posent
à abscisses curvilignes égales depuis le bas du bourrelet. Double nappe, poids empruntés au plus proche de ces surfaces
(la tête reportée au cou) puis lissés, clés du tombant reprises du pourpoint, celles du bourrelet du corps. Toute cote
vient de `donnees.py`.
"""
import math

import numpy as np
from mathutils import Vector
from mathutils.kdtree import KDTree

from tissu import Maillage, arbre_de, direction_spatiale, emprunter, joindre_les_surfaces, lambeaux, lisser, porteur_de, selon, voisinage


def bourrelet(D, b, psis, obstacles):
    """Les anneaux du bourrelet, du haut vers le bas."""
    c = D['BOURRELET']
    axe = np.array(b.tete(c['os']))
    P, T, _ = b.corps('cou')
    cou = arbre_de(*joindre_les_surfaces([b.corps(z) for z in D['ZONES_DU_CORPS'] + ['tete']])[:2])
    psi_cou = np.degrees(np.arctan2(P[:, 0] - axe[0], -(P[:, 1] - axe[1])))
    anneaux = []
    for k, (h_devant, h_derriere, jeu_devant, jeu_derriere) in enumerate(c['anneaux']):
        anneau = []
        for psi in psis:
            f = 0.5 * (1.0 + math.cos(math.radians(psi)))
            proches = np.abs((psi_cou - psi + 180.0) % 360.0 - 180.0) <= c['fenetre']
            O = np.array([axe[0], axe[1], P[proches, 2].min() + h_derriere + (h_devant - h_derriere) * f])
            d = direction_spatiale(psi)
            # Du dedans du cou vers le dehors : visé du dehors, l'anneau s'arrêtait sur l'épaule, plus haute que lui sur
            # les côtés (`vetement--col-de-fourrure`) ; au ras de la couture, le rayon sort du
            # cou par le torse, et sous l'oreille, par la tête de la base.
            touche = cou.ray_cast(Vector(O.tolist()), Vector(d.tolist()))[0]
            if touche is None:
                raise ValueError(f'foulard : aucun cou à l\'azimut {psi:.1f}')
            pli = c['ampleur'] * 0.5 * (1.0 + math.cos(c['plis'] * math.radians(psi) + c['phase'] * k))
            p = np.array(touche) + (jeu_derriere + (jeu_devant - jeu_derriere) * f + D['EPAISSEUR'] + pli) * d
            while obstacles.find_nearest(Vector(p.tolist()))[3] < c['jeu_min'] + D['EPAISSEUR']:
                p = p + D['PAS'] * d
            anneau.append(p)
        anneaux.append(anneau)
    return anneaux


def construire(D, materiaux, b):
    b.exiger(D['ZONES_DES_CLES'])
    tete = b.matieres_publiees(D['CONTOURNE']['tete'], D['MATIERES']['tete'])
    pourpoint = b.matieres_publiees(D['CONTOURNE']['pourpoint'], D['MATIERES']['pourpoint'])
    P, T, W = joindre_les_surfaces([pourpoint] + [b.corps(z) for z in D['ZONES_DU_CORPS']])
    dessous = arbre_de(P, T)
    Po, To, _ = joindre_les_surfaces([pourpoint, tete])
    m = D['COLONNES']
    psis = [360.0 * j / m for j in range(m)]
    anneaux = bourrelet(D, b, psis, arbre_de(Po, To))

    def vise(depart, d, jeu):
        """Le point le plus extérieur de la demi-droite (`depart`, `d`), sous `PORTEE`, au `jeu` de la nappe intérieure aux
        surfaces dessous."""
        r = D['PORTEE']
        while r > 0:
            if dessous.find_nearest(Vector((depart + r * d).tolist()))[3] <= jeu + D['EPAISSEUR']:
                return depart + (r + D['PAS']) * d
            r -= D['PAS']
        raise ValueError(f'foulard : aucune surface depuis {tuple(depart)} vers {tuple(d)}')

    axe = np.array(b.tete(D['CENTRE']['os']))
    C = axe + np.array([0.0, D['CENTRE']['dy'], 0.0])
    C[2] = D['CENTRE']['z']
    pans = lambeaux(D['PANS'], m)
    rayon = lambda q: math.hypot(q[0] - axe[0], q[1] - axe[1])
    colonnes = []
    for j, psi in enumerate(psis):
        bas = selon(D['BORD'], psi) + pans[j]
        phis = np.linspace(D['ELEVATION_HAUT'], bas, max(2, int(math.ceil((bas - D['ELEVATION_HAUT']) / D['PAS_D_ELEVATION'])) + 1))
        visees = [vise(C, math.sin(math.radians(p)) * direction_spatiale(psi) + np.array([0.0, 0.0, math.cos(math.radians(p))]),
                       D['JEU']) for p in phis]
        # Le profil part du bas du bourrelet et ne garde que les visées qui s'écartent de l'axe au-delà de lui et passent
        # sous lui.
        depart = anneaux[-1][j]
        profil = np.array([depart] + [q for q in visees if rayon(q) > rayon(depart) and q[2] < depart[2]])
        s_ = np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(profil, axis=0), axis=1))])
        u = np.linspace(0.0, 1.0, D['RANGS'] + 1)[1:]
        colonnes.append(np.array([[np.interp(t * s_[-1], s_, profil[:, a]) for a in range(3)] for t in u]))
    rangs = anneaux + [[colonnes[j][k] for j in range(m)] for k in range(D['RANGS'])]

    M = Maillage()
    lignes = [M.ajouter(rang, 'foulard') for rang in rangs]
    for A, B, ra, rb in zip(lignes, lignes[1:], rangs, rangs[1:]):
        hauteur = 0.5 * (np.mean([p[2] for p in ra]) + np.mean([p[2] for p in rb]))
        M.bande(A, B, np.array([axe[0], axe[1], min(hauteur, C[2] + 0.5 * (hauteur - C[2]))]))
    X, orientes, normales = M.orienter()
    porteur = porteur_de(P, T, W)
    Wx = np.array([emprunter(p, porteur)[0] for p in X])
    for a, o in D['OS_REPORTES'].items():
        Wx[:, b.indice_os[o]] += Wx[:, b.indice_os[a]]
        Wx[:, b.indice_os[a]] = 0.0
    Wx = lisser(Wx, voisinage(orientes, len(X)), D['LISSAGE_POIDS'])
    piece = b.nappe('foulard', X, normales, Wx, orientes, materiaux['foulard'], D['EPAISSEUR'])
    # Le tombant, posé sur le pourpoint, en reprend les clés ; le bourrelet prend celles du corps au plus près : repris du
    # pourpoint, son devant ne suivait pas le menton qui descend sous `gabarit_head_plus` (60 mm, `suiviDuCorps`).
    bourrelet_ = KDTree(len(anneaux) * m)
    for k, p in enumerate(p for anneau in anneaux for p in anneau):
        bourrelet_.insert(Vector(p.tolist()), k)
    bourrelet_.balance()
    dans_le_bourrelet = [bourrelet_.find(v.co)[2] < D['EPAISSEUR'] + 1e-4 for v in piece.data.vertices]
    b.transferer(piece, D['ZONES_DES_CLES'], masques=[([not x for x in dans_le_bourrelet], D['ZONES_DES_CLES'],
                                                       {D['CONTOURNE']['pourpoint']: D['ZONES_DU_POURPOINT']})])
    return piece
