"""Géométrie de `humanoide--accessoire--ecu-au-dos` : un écu de planches cerclé d'acier, posé derrière le dos, penché
(`donnees.py`).

Dans le plan de l'écu : X vers sa corne gauche, Y vers son bord haut ; la profondeur se compte vers l'arrière, de la
face avant du cerclage. Le plan penche (`ROULIS`, `TANGAGE`, `LACET`) et recule jusqu'au `JEU` de tout ce qui est sous
le contour. Le cerclage suit le contour sur la largeur `BORDURE`, en saillie du bois sur les deux faces ; le bois est
découpé en planches dans la hauteur, une sur deux en retrait (`RESSAUT`), et le contour porte un sommet à chaque joint
de planches : planches et cerclage partagent leurs sommets, sans quoi le lissage des clés gagnait tout l'écu. Un seul
jeu de poids, celui du pourpoint au milieu du dos : l'écu reste rigide. Clés reprises du corps, chaque sommet prenant
celles du premier sommet posé au même point du plan : l'épaisseur ne se déforme pas.
"""
import math

import numpy as np
from tissu import JUMEAU, emprunter, joindre_les_surfaces, maillage_skinne, poids_normalises, porteur_de


def contour_entier(D):
    """Le contour fermé dans le plan (X, Y) : de la corne des X positifs à la pointe basse, puis à l'autre corne."""
    moitie = [(x, -y) for x, y in D['CONTOUR']]
    return np.array(moitie + [(-x, y) for x, y in reversed(moitie[:-1])])


def rentre(V, r):
    """Le contour `V` rentré de `r` : chaque sommet à l'intersection des parallèles à ses deux côtés."""
    I = []
    for i in range(len(V)):
        cotes = [V[i] - V[i - 1], V[(i + 1) % len(V)] - V[i]]
        n1, n2 = [np.array([c[1], -c[0]]) / np.linalg.norm(c) for c in cotes]
        I.append(V[i] + r * (n1 + n2) / (1 + n1 @ n2))
    return np.array(I)


def coupe(polygone, borne, signe):
    """Le polygone convexe gardé du côté `signe`·X <= `signe`·`borne`."""
    garde = []
    for p, q in zip(polygone, polygone[1:] + polygone[:1]):
        dp, dq = signe * (borne - p[0]), signe * (borne - q[0])
        if dp >= 0:
            garde.append(p)
        if dp * dq < 0:
            garde.append(p + (q - p) * dp / (dp - dq))
    return garde


class Solide:
    """Sommets soudés par position et triangles, chacun tourné vers la normale voulue, avec son matériau."""

    def __init__(self, repere):
        self.repere, self.rangs, self.points, self.plans, self.faces, self.matieres = repere, {}, [], [], [], []

    def sommet(self, x, y, profondeur):
        cle = (round(x, 6), round(y, 6), round(profondeur, 6))
        if cle not in self.rangs:
            self.rangs[cle] = len(self.points)
            self.points.append(self.repere(x, y, profondeur))
            self.plans.append(cle[:2])
        return self.rangs[cle]

    def face(self, coins, normale, matiere):
        """Le polygone convexe `coins` (`(x, y, profondeur)`), en éventail, tourné vers `normale` (x, y, profondeur)."""
        a, b, c = [self.repere(*p) for p in coins[:3]]
        dehors = self.repere(*normale) - self.repere(0, 0, 0)
        sens = list(coins) if np.cross(b - a, c - a) @ dehors > 0 else list(reversed(coins))
        rangs = [self.sommet(*p) for p in sens]
        for j in range(1, len(rangs) - 1):
            if len({rangs[0], rangs[j], rangs[j + 1]}) == 3:
                self.faces.append((rangs[0], rangs[j], rangs[j + 1]))
                self.matieres.append(matiere)


def aux_joints(V, I, joints):
    """Le contour `V` et son rentré `I`, un sommet ajouté à chacun là où un joint de planches (`joints`, en X) croise un
    côté de `I` : les planches et le cerclage partagent leurs sommets."""
    Vs, Is = [], []
    for i in range(len(I)):
        j = (i + 1) % len(I)
        parts = sorted((x - I[i][0]) / (I[j][0] - I[i][0]) for x in joints if (x - I[i][0]) * (x - I[j][0]) < 0)
        for t in [0.0] + parts:
            Vs.append(V[i] + t * (V[j] - V[i]))
            Is.append(I[i] + t * (I[j] - I[i]))
    return np.array(Vs), np.array(Is)


def ecu(D, repere):
    """Le solide de l'écu : cerclage et planches des deux faces."""
    S = Solide(repere)
    planches = 2 * math.ceil(max(x for x, _ in D['CONTOUR']) / D['PLANCHE'])
    bords = (np.arange(planches + 1) - planches // 2) * D['PLANCHE']
    V = contour_entier(D)
    V, I = aux_joints(V, rentre(V, D['BORDURE']), bords[1:-1])
    pointe = int(np.argmin(I[:, 1]))
    moitie = I[:pointe + 1]
    if (np.diff(moitie[:, 1]) >= 0).any() or (moitie[:-1, 0] <= 0).any():
        raise ValueError('écu : le contour rentré de la bordure ne descend plus de la corne à la pointe')
    fond = D['RELIEF'] + D['RESSAUT']
    dos = D['RELIEF'] + D['EPAISSEUR_DU_BOIS']
    total = dos + fond
    centre = V.mean(axis=0)
    for i in range(len(V)):
        j = (i + 1) % len(V)
        dehors = np.append((V[i] + V[j]) / 2 - centre, 0.0)
        for profondeur, normale in ((0.0, (0, 0, -1)), (total, (0, 0, 1))):
            S.face([(*V[i], profondeur), (*V[j], profondeur), (*I[j], profondeur), (*I[i], profondeur)], normale, 'cerclage')
        S.face([(*V[i], 0.0), (*V[j], 0.0), (*V[j], total), (*V[i], total)], dehors, 'cerclage')
        S.face([(*I[i], 0.0), (*I[j], 0.0), (*I[j], fond), (*I[i], fond)], -dehors, 'cerclage')
        S.face([(*I[i], total), (*I[j], total), (*I[j], dos), (*I[i], dos)], -dehors, 'cerclage')
    ressauts = [D['RESSAUT'] * (p % 2) for p in range(planches)]
    for (xa, ya), (xb, yb) in zip(moitie, moitie[1:]):
        rang = [np.array(q) for q in ((-xa, ya), (xa, ya), (xb, yb), (-xb, yb))]
        for p in range(planches):
            planche = coupe(coupe(rang, bords[p], -1), bords[p + 1], 1)
            if len(planche) >= 3:
                for profondeur, normale in ((D['RELIEF'] + ressauts[p], (0, 0, -1)), (dos + ressauts[p], (0, 0, 1))):
                    S.face([(*q, profondeur) for q in planche], normale, 'bois')
        for p in range(1, planches):
            # Le chant entre deux planches, là où leur joint est dans le contour : tourné vers la planche en retrait.
            if abs(bords[p]) > min(xa, xb):
                continue
            vers = 1.0 if ressauts[p] > ressauts[p - 1] else -1.0
            for base, normale in ((D['RELIEF'], (vers, 0, 0)), (dos, (-vers, 0, 0))):
                S.face([(bords[p], ya, base + ressauts[p - 1]), (bords[p], yb, base + ressauts[p - 1]),
                        (bords[p], yb, base + ressauts[p]), (bords[p], ya, base + ressauts[p])], normale, 'bois')
    return S


def construire(D, materiaux, b):
    b.exiger(D['ZONES_DES_CLES'])
    publies = {k: b.matieres_publiees(i, D['MATIERES'][k]) for k, i in D['CONTOURNE'].items()}
    P, T, _ = joindre_les_surfaces(list(publies.values()) + [b.corps(z) for z in D['ZONES_DU_CORPS']])
    obstacles = np.concatenate([P[np.unique(T)], P[T].mean(axis=1)])
    roulis, tangage, lacet = (math.radians(D[k]) for k in ('ROULIS', 'TANGAGE', 'LACET'))
    arriere = np.array([-math.sin(lacet) * math.cos(tangage), math.cos(lacet) * math.cos(tangage), -math.sin(tangage)])
    e1 = np.array([math.cos(lacet), math.sin(lacet), 0.0])
    e2 = np.cross(e1, arriere)
    ex, ey = math.cos(roulis) * e1 - math.sin(roulis) * e2, math.sin(roulis) * e1 + math.cos(roulis) * e2
    origine = np.array([D['ORIGINE'][0], 0.0, D['ORIGINE'][1]])
    relatifs = obstacles - origine
    x, y = relatifs @ ex, relatifs @ ey
    demi_largeurs, profondeurs = zip(*D['CONTOUR'])
    dessous = (y < D['MARGE']) & (y > -profondeurs[-1] - D['MARGE'])
    dessous &= np.abs(x) < np.interp(-y, profondeurs, demi_largeurs) + D['MARGE']
    # Tout ce qui est sous le contour reste au jeu devant la face avant du cerclage.
    origine[1] = ((relatifs @ arriere)[dessous].max() + D['JEU']) / arriere[1]
    S = ecu(D, lambda X, Y, profondeur: origine + X * ex + Y * ey + profondeur * arriere)
    w = emprunter(np.array(D['POINT_DES_POIDS']), porteur_de(*publies[D['PORTEUR']]))[0]
    noms = list(D['MATERIAUX'])
    piece = maillage_skinne(D['MANIFESTE']['cle']['piece'], [tuple(p) for p in S.points], S.faces, materiaux[noms[0]], b.rig,
                            poids_normalises(np.tile(w, (len(S.points), 1)), b.os))
    for nom in noms[1:]:
        piece.data.materials.append(materiaux[nom])
    for polygone, matiere in zip(piece.data.polygons, S.matieres):
        polygone.material_index = noms.index(matiere)
        polygone.use_smooth = True
    piece.data.set_sharp_from_angle(angle=math.radians(D['ANGLE_LISSE']))
    premiers = {}
    piece.data.attributes.new(JUMEAU, 'INT', 'POINT').data.foreach_set(
        'value', [premiers.setdefault(plan, i) - i for i, plan in enumerate(S.plans)])
    b.transferer(piece, D['ZONES_DES_CLES'], bornes=D['BORNES_DES_CLES'])
    return piece
