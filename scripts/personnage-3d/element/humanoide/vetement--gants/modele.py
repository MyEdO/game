"""Géométrie de `humanoide--vetement--gants` : par main, un fourreau d'anneaux du poignet aux jointures, fermé aux
jointures, et un tube par doigt et pour le pouce, anneaux aux têtes des phalanges, bout en pointe arrondie ; chaque
anneau ajusté sur la coupe de la main de la base (`donnees.py`). Une nappe simple, ses poids empruntés au corps sommet
par sommet puis lissés, silhouettes et clés `gabarit_*` transférées."""
import numpy as np

from tissu import (JUMEAU, Maillage, anneau, centre_de, emprunter, joindre, lisser, maillage_skinne, poids_normalises,
                   repere_de_plan, voisinage)

HAUT = np.array([0.0, 0.0, 1.0])


def repere(axe, signe):
    return repere_de_plan(axe, HAUT if abs(axe @ HAUT) < 0.9 else np.array([0.0, -1.0, 0.0]), signe)


def autour(centre, u, v, P, c, colonnes, aisance):
    """`colonnes` points autour du centre `c` (u, v) de la coupe `P`, au bord de son enveloppe plus l'`aisance`."""
    dirs = [np.array([np.cos(t), np.sin(t)]) for t in np.linspace(0, 2 * np.pi, colonnes, endpoint=False)]
    return [centre + p[0] * u + p[1] * v for p in anneau(P, c, dirs, [aisance] * colonnes, aisance, au_plus_pres=True)]


def anneau_de_paume(b, zones, centre, axe, signe, colonnes, rayon, aisance):
    """L'anneau du fourreau dans le plan normal à `axe` par `centre`, ajusté à la coupe des `zones` de la base à `rayon`
    de l'axe."""
    u, v = repere(axe, signe)
    P = b.coupe(zones, centre, axe, u, v, minimum=0).reshape(-1, 2)
    P = P[np.linalg.norm(P, axis=1) < rayon]
    if len(P) < 3:
        raise ValueError(f'coupe de la main insuffisante en {tuple(np.round(centre, 3))}')
    return autour(centre, u, v, P, np.zeros(2), colonnes, aisance)


def anneau_de_doigt(b, zone, os_, centre, axe, signe, colonnes, tranche, aisance):
    """L'anneau d'un doigt dans le plan normal à `axe` par `centre`, ajusté aux sommets de la main de la base que l'os
    `os_` porte le plus, à `tranche` du plan, centré sur leur boîte : une tête d'os de doigt n'est pas au milieu du doigt
    (base : jusqu'à 4 mm de sa surface), et une coupe près des jointures prend les doigts voisins."""
    u, v = repere(axe, signe)
    P, _, W = b.corps(zone)
    garde = (np.argmax(W, axis=1) == b.indice_os[os_]) & (np.abs((P - centre) @ axe) < tranche)
    Q = np.stack([(P[garde] - centre) @ u, (P[garde] - centre) @ v], axis=1)
    if len(Q) < 3:
        raise ValueError(f'{os_} : trop peu de sommets en {tuple(np.round(centre, 3))}')
    return autour(centre, u, v, Q, centre_de(Q), colonnes, aisance)


def tube(M, anneaux, bout):
    """Ajoute à `M` les bandes entre `anneaux` (listes de points), ouvert au premier, fermé en éventail vers `bout`."""
    ids = [M.ajouter(a, None) for a in anneaux]
    centres = [np.mean(a, axis=0) for a in anneaux]
    for i in range(len(ids) - 1):
        M.bande(ids[i], ids[i + 1], (centres[i] + centres[i + 1]) / 2)
    pointe = M.ajouter([bout], None)[0]
    dernier = ids[-1]
    for j in range(len(dernier)):
        M.triangle(dernier[j], dernier[(j + 1) % len(dernier)], pointe, centres[-1])


def main(D, b, c, mat):
    cote, signe = {'g': ('l', 1.0), 'd': ('r', -1.0)}[c]
    tete = lambda nom: np.array(b.tete(f'{nom}_{cote}'))
    zones = D['ZONES'][c]
    M = Maillage()
    poignet = tete('hand')
    jointures = np.mean([tete(f'{d}_01') for d in D['DOIGTS']], axis=0)
    axe = (jointures - poignet) / np.linalg.norm(jointures - poignet)
    longueur = np.linalg.norm(jointures - poignet)
    paume = [anneau_de_paume(b, zones, poignet + t * longueur * axe, axe, signe, D['COLONNES_PAUME'], D['RAYON_PAUME'], e)
             for t, e in D['PAUME']]
    tube(M, paume, jointures + 0.01 * axe)
    for doigt in D['DOIGTS'] + ('thumb',):
        os_ = [tete(f'{doigt}_0{k}') for k in (1, 2, 3)] + [tete(f'{doigt}_04_leaf')]
        anneaux = []
        for part, nom in D['PHALANGES_DU_POUCE' if doigt == 'thumb' else 'PHALANGES']:
            k = int(nom) - 1
            direction = (os_[k + 1] - os_[k]) / np.linalg.norm(os_[k + 1] - os_[k])
            centre = os_[k] + part * np.linalg.norm(os_[k + 1] - os_[k]) * direction
            anneaux.append(anneau_de_doigt(b, f'main_{c}', f'{doigt}_{nom}_{cote}', centre, direction, signe,
                                           D['COLONNES_DOIGT'], D['TRANCHE'], D['AISANCE_DOIGT']))
        direction = (os_[3] - os_[2]) / np.linalg.norm(os_[3] - os_[2])
        tube(M, anneaux, os_[3] + D['BOUT'] * direction)
    X, orientes, _ = M.orienter()
    porteur = b.porteur(zones)
    W = lisser(np.array([emprunter(p, porteur)[0] for p in X]), voisinage(orientes, len(X)), D['LISSAGE_POIDS'])
    return maillage_skinne(f'gant_{c}', [tuple(p) for p in X], orientes, mat, b.rig, poids_normalises(W, b.os))


def construire(D, materiaux, b):
    b.exiger(D['ZONES']['g'] + D['ZONES']['d'])
    piece = joindre([main(D, b, c, materiaux['cuir']) for c in 'gd'])
    piece.name = 'gants'
    for polygone in piece.data.polygons:
        polygone.use_smooth = True
    piece.data.attributes.new(JUMEAU, 'INT', 'POINT')   # nappe simple : chaque sommet est son propre jumeau
    b.transferer(piece, D['ZONES']['g'] + D['ZONES']['d'])
    return piece
