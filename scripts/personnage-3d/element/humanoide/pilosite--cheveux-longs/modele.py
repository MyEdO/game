"""Géométrie de `humanoide--pilosite--cheveux-longs` (`element/tissu.py`) : une chevelure longue tirée en arrière.

Une seule grille, colonnes en azimut autour du centre du crâne, rangs du bord bas de la colonne au haut du crâne,
éventail au sommet :
- sur le crâne, chaque sommet est visé du dehors vers le centre et posé sur la peau de la tête publiée à sa hauteur le
  long de la normale, une colonne sur deux plus haute (des mèches) ; devant l'azimut de la tombée, la colonne s'arrête
  à la naissance des cheveux (`NAISSANCE`) ;
- de la tempe à la nuque, la colonne quitte la peau au-dessus de l'oreille puis à la base du crâne et tombe (`TOMBEE`)
  autour de l'axe du cou jusqu'au haut des épaules, évasée, tenue au jeu de la peau de la tête, du cou, des épaules et des cols publiés,
  les pointes inégales.

Double nappe. Poids de la tête jusqu'à la mâchoire, fondus vers ceux du cou au bas de la tombée, lissés. Silhouettes et clés `gabarit_*`
transférées des zones de la base sous la pièce. Toute cote vient de `donnees.py`.
"""
import numpy as np

from tissu import (Maillage, direction_spatiale, emprunter, joindre_les_surfaces, lambeaux, lisser, porteur_de, selon,
                   toucher, voisinage)


def construire(D, materiaux, b):
    b.exiger(D['ZONES_DES_CLES'])
    tete = b.matieres_publiees(D['CONTOURNE']['tete'], D['MATIERES_DE_LA_TETE'])
    cols = [b.matieres_publiees(D['CONTOURNE'][nom], matieres) for nom, matieres in D['MATIERES_DES_COLS'].items()]
    toutes = joindre_les_surfaces(cols + [b.corps(z) for z in D['ZONES_DU_CORPS']])
    porteur_tete, dessous, porteur_cou = porteur_de(*tete), porteur_de(*toutes), b.porteur(D['ZONES_DES_POIDS'])

    C = np.array(b.tete(D['OS_DU_CENTRE'])) + np.asarray(D['CENTRE'], float)
    n, m, t = D['COLONNES'], D['RANGS'], D['TOMBEE']
    h_bord, h_coeur = D['HAUTEUR']
    phis = [-180.0 + 360.0 * k / n for k in range(n)]
    meches = lambeaux(t['meches'], n)

    def sur_le_crane(phi, e, hauteur):
        d = direction_spatiale(phi, e)
        touche = toucher(porteur_tete, C, d, D['PORTEE'])
        if touche is None:
            raise ValueError(f'cheveux-longs : aucune peau à phi {phi}, élévation {e}')
        return touche[0] + hauteur * touche[1]

    M = Maillage()
    colonnes, parts = [], []
    for k, phi in enumerate(phis):
        strie = D['STRIES'] * (k % 2)
        points, part = [], []
        if abs(phi) < t['azimut']:
            bas = selon(D['NAISSANCE'], phi)
            for j in range(m):
                e = bas + (D['ELEVATION_HAUTE'] - bas) * j / (m - 1)
                points.append(sur_le_crane(phi, e, h_bord if j == 0 else h_coeur + strie))
                part.append(0.0)
        else:
            e_depart = selon(t['depart'], phi)
            depart = sur_le_crane(phi, e_depart, h_coeur + strie)
            axe = C + np.array([t['axe'][0], t['axe'][1], 0.0])
            d = depart - axe
            d[2] = 0.0
            rayon = float(np.linalg.norm(d))
            d /= rayon
            z_bas = C[2] - selon(t['bas'], phi) + meches[k]
            def tenu(z):
                """Le rayon qui tient la chevelure au jeu de ce qu'elle contourne à la hauteur `z`, 0 si rien."""
                pied, r = np.array([axe[0], axe[1], z]), 0.0
                for surfaces, jeu in zip((porteur_tete, dessous), t['jeu']):
                    touche = toucher(surfaces, pied, d, D['PORTEE'])
                    if touche is not None:
                        r = max(r, float(np.linalg.norm(touche[0] - pied)) + jeu)
                return r

            # La chevelure s'arrête au-dessus de l'épaule : là où ce qu'elle contourne la repousserait au-delà de son
            # débord, elle ne descend pas plus bas.
            hauteurs = np.linspace(depart[2], z_bas, t['echantillons'])
            for z in hauteurs[1:]:
                if tenu(z) > rayon + t['debord']:
                    break
                z_bas = z
            # Le rayon le long de la descente, échantillonné fin puis tendu : la chevelure va droit d'un appui au
            # suivant (le crâne, le haut d'un col) au lieu de rentrer entre eux.
            descentes = np.linspace(0.0, 1.0, t['echantillons'])
            rayons = [max(rayon + (selon(t['evasement'], phi) + t['stries'] * (k % 2)) * descente,
                          tenu(depart[2] + (z_bas - depart[2]) * descente)) for descente in descentes]
            tendus = [max([r] + [rayons[a] + (rayons[c] - rayons[a]) * (i - a) / (c - a)
                                 for a in range(i) for c in range(i + 1, len(rayons))])
                      for i, r in enumerate(rayons)]
            for j in range(t['rangs']):
                descente = 1.0 - j / t['rangs']
                z = depart[2] + (z_bas - depart[2]) * descente
                points.append(np.array([axe[0], axe[1], z]) + float(np.interp(descente, descentes, tendus)) * d)
                part.append(min(1.0, max(0.0, (C[2] - t['poids'][0] - z) / (t['poids'][1] - t['poids'][0]))))
            reste = m - t['rangs']
            for j in range(reste):
                e = e_depart + (D['ELEVATION_HAUTE'] - e_depart) * j / (reste - 1)
                points.append(sur_le_crane(phi, e, h_coeur + strie))
                part.append(0.0)
        colonnes.append(M.ajouter(points, 'chevelure'))
        parts.extend(part)
    for j in range(m - 1):
        M.bande([c[j] for c in colonnes], [c[j + 1] for c in colonnes], C)
    pole = M.ajouter([sur_le_crane(0.0, 90.0, h_coeur)], 'chevelure')[0]
    parts.append(0.0)
    for k in range(n):
        M.triangle(colonnes[k][-1], colonnes[(k + 1) % n][-1], pole, C)

    X, orientes, normales = M.orienter()
    W = np.array([(1.0 - q) * emprunter(p, porteur_tete)[0] + q * emprunter(p, porteur_cou)[0] for p, q in zip(X, parts)])
    W = lisser(W, voisinage(orientes, len(X)), D['LISSAGE_DES_POIDS'])
    piece = b.nappe('cheveux_longs', X, normales, W, orientes, materiaux['poil'], D['EPAISSEUR'])
    b.transferer(piece, D['ZONES_DES_CLES'])
    return piece
