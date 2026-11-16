"""Géométrie de `humanoide--accessoire--ceinture-a-boucle` (`element/tissu.py`), d'après `donnees.py` (aucun nombre ici).

- le cuir : une bande de section rectangulaire fermée autour de la taille, chaque section posée sur la robe publiée, son
  bord haut et son bord bas chacun au plus loin de l'axe du corps le long de son rayon, plus le jeu ; elle ponte
  l'ouverture de la robe de dessus ;
- la boucle : un cadre de quatre barres au milieu du devant, et son ardillon ; deux passants, barres verticales en
  travers du cuir ; un anneau couché contre le cuir. Chacun, raide, prend en bloc les poids de la robe sous son centre ;
- l'emplacement `EMPLACEMENT`, offert sur la face du cuir (`Base.offrir`), aux poids de la robe sous lui.
Chaque section du cuir prend en bloc les poids de la robe au plus près du milieu de son envers (pris sommet par
sommet, les arêtes de son épaisseur s'étiraient au-delà de la porte, `arete-etiree` en 9 clips sur 12) ; silhouettes et clés `gabarit_*` transférées de
la robe publiée sous la ceinture.
"""
import math

import bmesh
import numpy as np
from anatomie import AXES_DU_PERSONNAGE
from tissu import JUMEAU, emprunter, maillage_skinne, poids_normalises, porteur_de, sur_le_porteur

HAUT = np.array([0.0, 0.0, 1.0])
FACES_DE_BOITE = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]


def boite(centre, axes, demis):
    """Sommets et faces du pavé de centre `centre`, de demi-côtés `demis` le long de `axes`."""
    e = [a * d for a, d in zip(axes, demis)]
    return [centre + i * e[0] + j * e[1] + k * e[2] for i in (-1, 1) for j in (-1, 1) for k in (-1, 1)], FACES_DE_BOITE


def tore(centre, axes, rayon, section, cotes, facettes):
    """Sommets et faces d'un tore couché dans le plan des deux premiers `axes`."""
    sommets = []
    for i in range(cotes):
        a = 2 * math.pi * i / cotes
        radial = math.cos(a) * axes[0] + math.sin(a) * axes[1]
        for j in range(facettes):
            b = 2 * math.pi * j / facettes
            sommets.append(centre + (rayon + section * math.cos(b)) * radial + section * math.sin(b) * axes[2])
    faces = [[i * facettes + j, ((i + 1) % cotes) * facettes + j, ((i + 1) % cotes) * facettes + (j + 1) % facettes,
              i * facettes + (j + 1) % facettes] for i in range(cotes) for j in range(facettes)]
    return sommets, faces


def construire(D, materiaux, b):
    b.exiger(D['ZONES'])
    robe = porteur_de(*b.matieres_publiees(D['CONTOURNE']['robe'], D['MATIERES_DE_LA_ROBE']))
    P = np.concatenate([b.corps(z)[0] for z in D['ZONES']])
    tranche = P[np.abs(P[:, 2] - D['HAUTEUR']) < 0.02]
    axe = np.array([(tranche[:, 0].min() + tranche[:, 0].max()) / 2, (tranche[:, 1].min() + tranche[:, 1].max()) / 2, 0.0])
    s, demi = D['SEGMENTS'], D['LARGEUR'] / 2
    angles = [2 * math.pi * (i + 0.5) / s for i in range(s)]

    def sortante(theta):
        return np.array([math.sin(theta), -math.cos(theta), 0.0])

    def rayons(dz):
        """Par section, la distance à l'axe de l'envers du cuir à la hauteur `HAUTEUR + dz` : la robe plus le jeu,
        jamais sous la corde des deux sections voisines."""
        r = []
        for theta in angles:
            o = axe + HAUT * (D['HAUTEUR'] + dz)
            p, _ = sur_le_porteur(robe, o, sortante(theta), D['PORTEE'])
            r.append(float(np.linalg.norm((p - o)[:2])) + D['JEU'])
        for _ in range(D['PASSES_DE_PONT']):
            r = [max(r[i], (r[i - 1] + r[(i + 1) % s]) / 2) for i in range(s)]
        return r

    bas, haut = rayons(-demi), rayons(demi)
    sommets, faces, poids, laiton = [], [], [], []
    for i, theta in enumerate(angles):
        d = sortante(theta)
        for r, dz in ((bas[i], -demi), (bas[i] + D['EPAISSEUR'], -demi), (haut[i] + D['EPAISSEUR'], demi), (haut[i], demi)):
            sommets.append(axe + HAUT * (D['HAUTEUR'] + dz) + r * d)
    for i in range(s):
        j = (i + 1) % s
        faces += [[4 * i + k, 4 * i + (k + 1) % 4, 4 * j + (k + 1) % 4, 4 * j + k] for k in range(4)]
    for i, theta in enumerate(angles):
        envers = axe + HAUT * D['HAUTEUR'] + (bas[i] + haut[i]) / 2 * sortante(theta)
        poids += [emprunter(envers, robe)[0]] * 4
    devant = (bas[-1] + bas[0] + haut[-1] + haut[0]) / 4 + D['EPAISSEUR']

    def sur_le_cuir(abscisse):
        """Le point du milieu de la face du cuir à l'`abscisse`, et son repère (le long du cuir vers la gauche du
        personnage, le haut, la sortante)."""
        u = abscisse / devant / (2 * math.pi / s) - 0.5
        i, f = math.floor(u), u - math.floor(u)
        r = sum(((1 - f) * c[i % s] + f * c[(i + 1) % s]) / 2 for c in (bas, haut)) + D['EPAISSEUR']
        d = sortante(abscisse / devant)
        return axe + HAUT * D['HAUTEUR'] + r * d, (np.cross(HAUT, d), HAUT, d)

    def raide(pts, fcs, centre):
        """Ajoute une pièce de laiton, aux poids de la robe sous `centre`."""
        debut = len(sommets)
        sommets.extend(pts)
        laiton.extend(range(len(faces), len(faces) + len(fcs)))
        faces.extend([[debut + k for k in f] for f in fcs])
        poids.extend([emprunter(centre, robe)[0]] * len(pts))

    B = D['BOUCLE']
    c, (t, z, d) = sur_le_cuir(0.0)
    c = c + d * B['epaisseur'] / 2
    montant, traverse = (B['hauteur'] / 2, B['largeur'] / 2 - B['barre'])
    for cote in (-1, 1):
        raide(*boite(c + cote * (B['largeur'] - B['barre']) / 2 * t, (t, z, d), (B['barre'] / 2, montant, B['epaisseur'] / 2)), c)
        raide(*boite(c + cote * (B['hauteur'] - B['barre']) / 2 * z, (t, z, d), (traverse, B['barre'] / 2, B['epaisseur'] / 2)), c)
    A = D['ARDILLON']
    raide(*boite(c + (A['longueur'] - B['largeur'] + B['barre']) / 2 * t + (B['epaisseur'] + A['section']) / 2 * d, (t, z, d),
                 (A['longueur'] / 2, A['section'] / 2, A['section'] / 2)), c)

    Q = D['PASSANTS']
    for abscisse in Q['abscisses']:
        c, (t, z, d) = sur_le_cuir(abscisse)
        raide(*boite(c + d * Q['epaisseur'] / 2, (t, z, d), (Q['largeur'] / 2, demi + Q['debord'], Q['epaisseur'] / 2)), c)

    N = D['ANNEAU']
    c, (t, z, d) = sur_le_cuir(N['abscisse'])
    raide(*tore(c + d * N['section'], (t, z, d), N['rayon'] - N['section'], N['section'], N['cotes'], N['facettes']), c)

    point, _ = sur_le_cuir(D['ABSCISSE_DE_L_EMPLACEMENT'])
    b.offrir(D['EMPLACEMENT'], emprunter(point, robe)[0], point, np.array(AXES_DU_PERSONNAGE).T)

    ceinture = maillage_skinne('ceinture-a-boucle', [tuple(p) for p in sommets], faces, materiaux['cuir'], b.rig,
                               poids_normalises(np.array(poids), b.os))
    ceinture.data.materials.append(materiaux['laiton'])
    for k in laiton:
        ceinture.data.polygons[k].material_index = 1
    bm = bmesh.new()
    bm.from_mesh(ceinture.data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(ceinture.data)
    bm.free()
    for poly in ceinture.data.polygons:
        poly.use_smooth = True
    ceinture.data.set_sharp_from_angle(angle=math.radians(D['ANGLE_VIF']))
    ceinture.data.attributes.new(JUMEAU, 'INT', 'POINT')   # nappe simple : chaque sommet est son propre jumeau
    b.transferer(ceinture, D['ZONES'], masques=[([True] * len(sommets), D['ZONES'],
                                                  {D['CONTOURNE']['robe']: D['ZONES_DE_LA_ROBE']})])
    return ceinture
