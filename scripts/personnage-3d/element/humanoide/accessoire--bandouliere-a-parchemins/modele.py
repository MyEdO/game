"""Géométrie de `humanoide--accessoire--bandouliere-a-parchemins` (`element/tissu.py`, `maille.py`), d'après `donnees.py`
(aucun nombre ici).

- `sangle` : une bande fermée autour du tronc, dans le plan oblique de l'épaule droite à la hanche gauche ; chaque
  colonne posée sur la robe publiée, au plus loin de ses deux bords et de son milieu (la sangle ponte les creux sans s'y
  plier), plus le jeu, en double nappe ; poids empruntés à la robe puis lissés.
- cases : les emplacements `bandouliere`, puis `bandouliere#<rang>`, que la sangle offre devant (`Base.offrir`), chacun
  sur le milieu de la bande, son +Y glTF le long de l'objet qu'on y glisse, vers le haut, son +Z sur la normale sortante,
  qui suit les poids de la sangle sous lui ; l'hôte y range les objets (#3844).
Silhouettes et clés `gabarit_*` transférées de la robe publiée sous la sangle.
"""
import math

import numpy as np
from mathutils import Vector
from tissu import Maillage, centre_de, emprunter, lisser, porteur_de, voisinage


def unitaire(x):
    return x / np.linalg.norm(x)


def points_d_attache(b, D, robe):
    """Le point d'épaule, au milieu de la crête de la robe (`CRETE`), et le point de hanche, sur le tronc de la base au
    repos."""
    R = robe['P'][np.unique(robe['T'])]
    haut = R[np.abs(R[:, 0] - D['EPAULE']) < D['TRANCHE_EPAULE']]
    epaule = haut[haut[:, 2] >= haut[:, 2].max() - D['CRETE']].mean(axis=0)
    P = np.concatenate([b.corps(z)[0] for z in D['ZONES']])
    flanc = P[np.abs(P[:, 2] - D['HANCHE']) < D['TRANCHE_HANCHE']]
    hanche = np.array([flanc[:, 0].max(), (flanc[:, 1].min() + flanc[:, 1].max()) / 2, D['HANCHE']])
    return epaule, hanche


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

    for rang, (t, angle, decalage) in enumerate(D['CASES'], start=1):
        p, tangente, sortante, w = sur_la_sangle(t)
        a = math.radians(angle)
        axe = unitaire(math.cos(a) * n - math.sin(a) * tangente)
        gauche = axe if axe[0] > 0 else -axe
        haut = axe if axe[2] > 0 else -axe
        z = unitaire(sortante - (sortante @ haut) * haut)
        b.offrir(D['EMPLACEMENT'] if rang == 1 else f"{D['EMPLACEMENT']}#{rang}", w, p + gauche * decalage,
                 (np.cross(haut, z), haut, z))

    sangle.name = 'bandouliere-a-parchemins'
    b.transferer(sangle, D['ZONES'], masques=[([True] * len(sangle.data.vertices), D['ZONES'],
                                                {D['CONTOURNE']['robe']: D['ZONES_DE_LA_ROBE']})])
    return sangle
