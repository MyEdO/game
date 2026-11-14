"""Géométrie de `humanoide--accessoire--cordeliere` (`element/tissu.py`), d'après `donnees.py` (aucun nombre ici).

- la corde : un tube rond fermé autour de la taille, chaque section posée sur la bure publiée, au plus loin de l'axe du
  corps le long de son rayon, plus le jeu ; les rayons tombent de part et d'autre du milieu du devant, jamais sur la
  couture du milieu, où la visée passe entre deux triangles ;
- le nœud : un fuseau couché le long de la corde, à l'angle `NOEUD['angle']` depuis le devant, jamais plus fin qu'elle ;
- l'emplacement `ceinture_avant`, offert sur la face extérieure de la corde au milieu du devant (`Base.offrir`), aux
  poids de la bure sous lui, comme la bure l'offre sur sa surface (`element/robe.py`, `deplacer`) ;
- les bouts : deux tubes qui pendent du nœud, posés sur la bure le long de leur descente, renflés à la pointe, raides :
  chacun prend en bloc les poids de la bure sous le nœud (pliés avec la bure au pli de l'aine, leurs arêtes s'y
  écrasaient : `Slide_Exit`, `Roll`, l_c/l_b 0,003 à 0,0099).
Chaque autre sommet prend les poids de la bure au plus près de lui (pris au centre de sa section, la bure perçait les bouts
de 8 à 21 mm en `Roll` et `ClimbUp_1m`), lissés sur la corde ; silhouettes et clés `gabarit_*` transférées de
la bure publiée sous la corde.
"""
import math

import numpy as np
from anatomie import AXES_DU_PERSONNAGE
from tissu import JUMEAU, emprunter, lisser, maillage_skinne, poids_normalises, porteur_de, sur_le_porteur, voisinage


def unitaire(x):
    return x / np.linalg.norm(x)


def tube(sections, cotes, boucle):
    """Sommets et faces d'un tube aux `sections` `(centre, e1, e2, rayon)` ; `boucle` : fermé sur lui-même, sinon bouché
    aux deux bouts."""
    sommets = [c + r * (math.cos(2 * math.pi * k / cotes) * e1 + math.sin(2 * math.pi * k / cotes) * e2)
               for c, e1, e2, r in sections for k in range(cotes)]
    n = len(sections)
    faces = [[i * cotes + k, i * cotes + (k + 1) % cotes, ((i + 1) % n) * cotes + (k + 1) % cotes,
              ((i + 1) % n) * cotes + k] for i in range(n if boucle else n - 1) for k in range(cotes)]
    if not boucle:
        faces += [list(range(cotes))[::-1], [(n - 1) * cotes + k for k in range(cotes)]]
    return sommets, faces


def repere(tangente, sortante):
    """Deux axes de section normaux à `tangente`, le premier au plus près de `sortante`."""
    e1 = unitaire(sortante - (sortante @ tangente) * tangente)
    return e1, np.cross(tangente, e1)


def construire(D, materiaux, b):
    b.exiger(D['ZONES'])
    bure = porteur_de(*b.matieres_publiees(D['CONTOURNE']['bure'], D['MATIERES_DE_LA_BURE']))
    P = np.concatenate([b.corps(z)[0] for z in D['ZONES']])
    tranche = P[np.abs(P[:, 2] - D['HAUTEUR']) < 0.02]
    axe = np.array([(tranche[:, 0].min() + tranche[:, 0].max()) / 2, (tranche[:, 1].min() + tranche[:, 1].max()) / 2, 0.0])
    haut = np.array([0.0, 0.0, 1.0])
    R, s = D['RAYON'], D['SEGMENTS']

    def point(theta):
        d = np.array([math.sin(theta), -math.cos(theta), 0.0])
        o = axe + haut * (D['HAUTEUR'] - D['PENTE'] / 2 * math.cos(theta))
        p, _ = sur_le_porteur(bure, o, d, D['PORTEE'])
        return p + d * (D['JEU'] + R), d

    anneau = [point(2 * math.pi * (i + 0.5) / s) for i in range(s)]
    sections = []
    for i, (c, d) in enumerate(anneau):
        t = unitaire(anneau[(i + 1) % s][0] - anneau[i - 1][0])
        sections.append((c, *repere(t, d), R))
    parties = [(*tube(sections, D['COTES'], True), None)]
    milieu = unitaire(anneau[-1][1] + anneau[0][1])
    devant = (anneau[-1][0] + anneau[0][0]) / 2 + milieu * R
    b.offrir(D['EMPLACEMENT'], emprunter(devant, bure)[0], devant, np.array(AXES_DU_PERSONNAGE).T)

    N = D['NOEUD']
    k = round(math.radians(N['angle']) / (2 * math.pi) * s)      # le nœud entre les sections k - 1 et k
    d0 = unitaire(anneau[k - 1][1] + anneau[k][1])
    t0 = unitaire(anneau[k][0] - anneau[k - 1][0])
    e1, e2 = repere(t0, d0)
    centre_du_noeud = (anneau[k - 1][0] + anneau[k][0]) / 2 + d0 * (N['rayon'] - R)
    profil = [math.sin(math.pi * k / (N['segments'] - 1)) for k in range(N['segments'])]
    noeud = [(centre_du_noeud + t0 * N['longueur'] * (k / (N['segments'] - 1) - 0.5), e1, e2, max(f * N['rayon'], R))
             for k, f in enumerate(profil)]
    parties.append((*tube(noeud, D['COTES'], False), None))

    poids_du_noeud = emprunter(centre_du_noeud, bure)[0]
    for depart, pointe in D['BOUTS']:
        centres = []
        for k in range(D['PAS_DES_BOUTS'] + 1):
            u = k / D['PAS_DES_BOUTS']
            o = centre_du_noeud + t0 * (depart + (pointe - depart) * u) - haut * (N['rayon'] + D['LONGUEUR_DES_BOUTS'] * u)
            p, n = sur_le_porteur(bure, o - d0 * D['PORTEE'] / 2, d0, D['PORTEE'])
            r = R * (1 + (D['EPAISSEUR_DU_BOUT'] - 1) * max(0.0, 2 * u - 1))
            centres.append((p + n * (D['JEU_DES_BOUTS'] + r), r))
        bout = []
        for k, (c, r) in enumerate(centres):
            t = unitaire(centres[min(k + 1, len(centres) - 1)][0] - centres[max(k - 1, 0)][0])
            bout.append((c, *repere(t, d0), r))
        parties.append((*tube(bout, D['COTES'], False), poids_du_noeud))

    sommets, faces, W = [], [], []
    for pts, fcs, poids in parties:
        debut = len(sommets)
        sommets += [tuple(p) for p in pts]
        faces += [[debut + i for i in f] for f in fcs]
        W += [emprunter(np.asarray(p), bure)[0] if poids is None else poids for p in pts]
    triangles = [(f[0], f[k], f[k + 1]) for f in faces for k in range(1, len(f) - 1)]
    W = lisser(np.array(W), voisinage(triangles, len(sommets)), D['LISSAGE_POIDS'])
    corde = maillage_skinne('cordeliere', sommets, faces, materiaux['corde'], b.rig, poids_normalises(W, b.os))
    for poly in corde.data.polygons:
        poly.use_smooth = True
    corde.data.set_sharp_from_angle(angle=math.radians(D['ANGLE_LISSE']))
    corde.data.attributes.new(JUMEAU, 'INT', 'POINT')   # nappe simple : chaque sommet est son propre jumeau
    b.transferer(corde, D['ZONES'], masques=[([True] * len(sommets), D['ZONES'],
                                               {D['CONTOURNE']['bure']: D['ZONES_DE_LA_BURE']})])
    return corde
