"""Géométrie de `humanoide--accessoire--bandouliere-a-parchemins` (`element/tissu.py`, `maille.py`), d'après `donnees.py`
(aucun nombre ici).

- `sangle` : une bande fermée autour du tronc, dans le plan oblique de l'épaule droite à la hanche gauche ; chaque
  colonne posée sur la robe publiée, au plus loin de ses deux bords et de son milieu (la sangle ponte les creux sans s'y
  plier), plus le jeu, en double nappe ; poids empruntés à la robe puis lissés.
- rouleaux et fioles : des solides de révolution glissés en travers de la sangle, devant ; chacun suit d'un bloc le
  sommet de la sangle sous lui (ses poids) : un objet aux poids de la robe sommet par sommet s'étire avec elle.
Silhouettes et clés `gabarit_*` transférées de la robe publiée sous la sangle.
"""
import math

import numpy as np
from maille import Maille, tour
from mathutils import Vector
from tissu import Maillage, centre_de, emprunter, joindre, lisser, maillage_skinne, poids_normalises, porteur_de, voisinage


def unitaire(x):
    return x / np.linalg.norm(x)


def points_d_attache(b, D, robe):
    """Le point d'épaule, en haut de la robe, et le point de hanche, sur le tronc de la base au repos."""
    R = robe['P'][np.unique(robe['T'])]
    haut = R[np.abs(R[:, 0] - D['EPAULE']) < 0.015]
    epaule = haut[np.argmax(haut[:, 2])]
    P = np.concatenate([b.corps(z)[0] for z in D['ZONES']])
    flanc = P[np.abs(P[:, 2] - D['HANCHE']) < 0.01]
    hanche = np.array([flanc[:, 0].max(), (flanc[:, 1].min() + flanc[:, 1].max()) / 2, D['HANCHE']])
    return epaule, hanche


def solide(m, profil, mats, axe, centre, D):
    """Révolution de `profil` [(a, r)] autour de `axe` passant par `centre` (monde), ajoutée à `m` ; rend son nombre de
    sommets."""
    local = Maille(m.materiaux)
    tour(local, profil, 'y', (0.0, 0.0, 0.0), D['SEGMENTS_OBJET'], mats)
    ex = unitaire(np.cross(axe, (0.0, 0.0, 1.0)) if abs(axe[2]) < 0.9 else np.cross(axe, (1.0, 0.0, 0.0)))
    ez = np.cross(ex, axe)
    debut = len(m.v)
    noms = [x.name for x in m.materiaux]
    for face, i in zip(local.f, local.m):
        m.f.append([debut + k for k in face])
        m.m.append(noms.index(local.materiaux[i].name))
    m.v.extend(tuple(centre + x * ex + y * axe + z * ez) for x, y, z in local.v)
    return len(local.v)


def construire(D, materiaux, b):
    b.exiger(D['ZONES'])
    robe = porteur_de(*b.matieres_publiees(D['CONTOURNE']['robe'], D['MATIERES_DE_LA_ROBE']))
    epaule, hanche = points_d_attache(b, D, robe)
    e1 = unitaire(hanche - epaule)
    e2 = unitaire(np.array([0.0, 1.0, 0.0]) - e1[1] * e1)
    n = np.cross(e1, e2)
    demi = D['LARGEUR'] / 2

    # Sangle : rayon par direction autour du centre de la coupe médiane, jusqu'à la robe.
    centre = centre_de(b.coupe(D['ZONES'], epaule, n, e1, e2))
    s = D['SEGMENTS']
    dirs = [np.array([math.cos(2 * math.pi * i / s), math.sin(2 * math.pi * i / s)]) for i in range(s)]

    def sur_la_robe(i):
        """Distance au centre de la robe la plus extérieure le long de la colonne `i`, sur ses deux bords et son milieu
        (un bord au-dessus de l'encolure ne touche rien)."""
        d = dirs[i][0] * e1 + dirs[i][1] * e2
        distances = []
        for k in (-1, 0, 1):
            origine = epaule + k * demi * n + centre[0] * e1 + centre[1] * e2
            touche = robe['arbre'].ray_cast(Vector((origine + D['PORTEE'] * d).tolist()), Vector((-d).tolist()),
                                            D['PORTEE'])
            if touche[0] is not None:
                distances.append(D['PORTEE'] - touche[3])
        if not distances:
            raise ValueError(f'colonne {i} : aucune robe sous la sangle')
        return max(distances)

    rayons = np.array([sur_la_robe(i) for i in range(s)]) + D['JEU'] + D['EPAISSEUR']

    def monde(i, k):
        q = centre + rayons[i] * dirs[i]
        return epaule + k * demi * n + q[0] * e1 + q[1] * e2

    centre_monde = epaule + centre[0] * e1 + centre[1] * e2
    M = Maillage()
    bords = [M.ajouter([monde(i, k) for i in range(s)], None) for k in (-1, 1)]
    M.bande(bords[0], bords[1], centre_monde)
    X, orientes, normales = M.orienter()
    W = lisser(np.array([emprunter(p, robe)[0] for p in X]), voisinage(orientes, len(X)), D['LISSAGE_POIDS'])
    sangle = b.nappe('sangle', X, normales, W, orientes, materiaux['sangle'], D['EPAISSEUR'])

    # Le devant de la sangle, de l'épaule à la hanche : colonnes du milieu de bande, abscisse curviligne.
    milieu = np.array([(X[a] + X[c]) / 2 for a, c in zip(bords[0], bords[1])])
    le_long = (milieu - epaule) @ e1
    i0, i1 = int(np.argmin(le_long)), int(np.argmax(le_long))
    def arc(sens):
        c = [i0]
        while c[-1] != i1:
            c.append((c[-1] + sens) % s)
        return c
    chemin = min((arc(1), arc(-1)), key=lambda c: float(np.mean((milieu[c] - centre_monde) @ e2)))
    longueurs = np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(milieu[chemin], axis=0), axis=1))])

    def sur_la_sangle(t):
        """Point du milieu de bande à l'abscisse `t` (0 épaule, 1 hanche), tangente vers la hanche, normale sortante, et
        poids du sommet de sangle le plus proche."""
        a = t * longueurs[-1]
        j = min(int(np.searchsorted(longueurs, a, side='right')) - 1, len(chemin) - 2)
        u = (a - longueurs[j]) / (longueurs[j + 1] - longueurs[j])
        p = milieu[chemin[j]] * (1 - u) + milieu[chemin[j + 1]] * u
        tangente = unitaire(milieu[chemin[j + 1]] - milieu[chemin[j]])
        sortante = unitaire(np.cross(n, tangente))
        if sortante @ (p - centre_monde) < 0:
            sortante = -sortante
        return p, tangente, sortante, W[bords[0][chemin[j + (u > 0.5)]]]

    objets = Maille(list(materiaux.values()))
    poids_objets = []

    def poser(t, angle, decalage, rayon, profil, mats):
        p, tangente, sortante, w = sur_la_sangle(t)
        a = math.radians(angle)
        axe = unitaire(math.cos(a) * n - math.sin(a) * tangente)
        centre_objet = p + sortante * (rayon + D['JEU_OBJET']) + axe * decalage
        poids_objets.extend([w] * solide(objets, profil, mats, axe, centre_objet, D))

    for t, angle, decalage, r, longueur in D['ROULEAUX']:
        poser(t, angle, decalage, r, [(-longueur / 2, 0), (-longueur / 2, r), (longueur / 2, r), (longueur / 2, 0)],
              'parchemin')
    for t, angle, decalage, r, longueur, bouchon in D['FIOLES']:
        a0, a1, a2 = -longueur / 2, longueur / 2 - bouchon, longueur / 2
        poser(t, angle, decalage, r, [(a0, 0), (a0, r), (a1, r), (a1, 0.6 * r), (a2, 0.6 * r), (a2, 0)],
              ['fiole', 'fiole', 'fiole', 'bouchon', 'bouchon'])

    poids_objets = poids_normalises(np.array(poids_objets), b.os)
    pieces = [sangle]
    noms = [x.name for x in objets.materiaux]
    for k, nom in enumerate(noms):
        faces = [f for f, m in zip(objets.f, objets.m) if m == k]
        if not faces:
            continue
        utilises = sorted({i for f in faces for i in f})
        renum = {i: j for j, i in enumerate(utilises)}
        pieces.append(maillage_skinne(nom, [objets.v[i] for i in utilises], [[renum[i] for i in f] for f in faces],
                                      materiaux[nom], b.rig, [poids_objets[i] for i in utilises]))
    piece = joindre(pieces)
    piece.name = 'bandouliere-a-parchemins'
    b.transferer(piece, D['ZONES'], masques=[([True] * len(piece.data.vertices), D['ZONES'],
                                               {D['CONTOURNE']['robe']: D['ZONES_DE_LA_ROBE']})])
    return piece
