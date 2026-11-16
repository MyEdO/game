"""Géométrie de `humanoide--accessoire--plumet` : deux plumes d'autruche, bâties dans le repère de l'emplacement `cimier`.

Chaque plume est un volume fermé le long de sa hampe (`chemin`, courbe de Catmull-Rom) : des sections en lentille de
six points, larges des barbes et épaisses au droit de la hampe, le bord des barbes arqué vers l'arrière de la face
(`RETOMBEE`) et alternativement avancé et reculé d'une section à la suivante (`FRANGE`) ; pied et pointe fermés en
éventail. Le repère de la section suit la hampe par transport de la normale de la face. Toute cote vient de
`donnees.py`.
"""
import numpy as np
from maille import Maille, lineaire, objet

AVANT = np.array([0.0, 0.0, 1.0])
COTES = 6
"""Points du tour d'une section : les deux bords des barbes, deux au-dessus, deux au-dessous."""


def courbe(points, n):
    """`n` points à pas égal le long de la courbe de Catmull-Rom (uniforme) par `points`."""
    P = [points[0] + (points[0] - points[1])] + list(points) + [points[-1] + (points[-1] - points[-2])]
    fins = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for t in np.linspace(0.0, 1.0, 16, endpoint=False):
            fins.append(0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                               + (3 * p1 - p0 - 3 * p2 + p3) * t ** 3))
    fins = np.array(fins + [P[-2]])
    s = np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(fins, axis=0), axis=1))])
    return np.array([[np.interp(v, s, fins[:, a]) for a in range(3)] for v in np.linspace(0.0, s[-1], n)])


def plume(D, m, nom):
    p = D['PLUMES'][nom]
    n = p['sections']
    centres = courbe([np.asarray(q, float) for q in p['chemin']], n)
    tangentes = np.gradient(centres, axis=0)
    tangentes /= np.linalg.norm(tangentes, axis=1, keepdims=True)
    face = AVANT
    sommets, faces = [], []
    for k, (c, T) in enumerate(zip(centres, tangentes)):
        face = face - (face @ T) * T
        face /= np.linalg.norm(face)
        travers = np.cross(T, face)
        part = k / (n - 1)
        w = lineaire(p['largeurs'], part) * (1.0 + D['FRANGE'] * (1 if k % 2 == 0 else -1))
        e = lineaire(p['epaisseurs'], part)
        # le tour de la lentille : bord gauche, dessus, bord droit, dessous
        for u, v in ((-1.0, -D['RETOMBEE'] * w / e), (-0.45, 0.85), (0.45, 0.85), (1.0, -D['RETOMBEE'] * w / e),
                     (0.45, -0.55), (-0.45, -0.55)):
            sommets.append(c + u * w * travers + v * e * face)
    for k in range(n - 1):
        for i in range(COTES):
            j = (i + 1) % COTES
            faces.append([COTES * k + i, COTES * k + j, COTES * (k + 1) + j, COTES * (k + 1) + i])
    pied, pointe = len(sommets), len(sommets) + 1
    sommets.append(centres[0] - 0.004 * tangentes[0])
    sommets.append(centres[-1] + 0.5 * lineaire(p['largeurs'], 1.0) * tangentes[-1])
    for i in range(COTES):
        j = (i + 1) % COTES
        faces.append([pied, j, i])
        faces.append([pointe, COTES * (n - 1) + i, COTES * (n - 1) + j])
    m.ajouter(sommets, faces, nom)


def construire(D, materiaux):
    m = Maille(list(materiaux.values()))
    for nom in D['PLUMES']:
        plume(D, m, nom)
    return [objet('humanoide--accessoire--plumet', m, (0.0, 0.0, 0.0), D['ANGLE_LISSE'])]
