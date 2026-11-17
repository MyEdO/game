"""Géométrie de `humanoide--armure--plastron` : plastron et dossière d'un seul tenant, anneaux horizontaux autour du
tronc ouverts aux emmanchures, joints sur chaque épaule par une bretelle posée sur l'épaule ; le devant bombé, une arête
sur la colonne de l'avant, le bas évasé en rebord ; bordure dorée au bas et à l'encolure (surface
`dorure`). Poids empruntés au tronc puis lissés, silhouettes et clés `gabarit_*` transférées ; l'emplacement `poitrine`
offert sur la face du plastron (`Base.offrir`)."""
import math

import numpy as np
from mathutils import Vector

from robe import COU, TRONC, Nappe, piece_de
from tissu import anneau, centre_de, direction, emprunter, porteur_de, unitaire

ZONES = TRONC + COU + ['bras_haut_g', 'bras_haut_d']


def construire(D, materiaux, b):
    b.exiger(ZONES)
    tronc = b.porteur(TRONC + COU)
    m = D['COLONNES']
    hauteurs = D['HAUTEURS']
    z_bom, v_bom = zip(*D['BOMBE'])
    z_emm, c_emm = D['EMMANCHURE']
    emmanchure = {j for j in range(m) if c_emm <= min(j, m - j) <= m // 2 - c_emm}
    thetas = [360.0 * j / m for j in range(m)]
    M = Nappe()
    grille = []
    centres = []
    for r, z in enumerate(hauteurs):
        P = b.coupe(TRONC + COU, (0.0, 0.0, z), (0.0, 0.0, 1.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0), minimum=1)
        c = centre_de(P)
        bombe = float(np.interp(z, z_bom, v_bom))
        aisance = float(np.interp(z, *zip(*D['AISANCE'])))
        aisances = []
        for j, t in enumerate(thetas):
            e = aisance + bombe * max(0.0, math.cos(math.radians(t))) ** 2
            if j == 0 and r > 0:
                e += D['ARETE']
            if r == 0:
                e += D['EVASEMENT_DU_BAS']
            aisances.append(e)
        pts = anneau(P, c, [direction(t) for t in thetas], aisances, D['DEGAGEMENT_MIN'], au_plus_pres=True)
        rang = []
        for j, p in enumerate(pts):
            if z > z_emm and j in emmanchure:
                rang.append(None)
                continue
            q = np.array([p[0], p[1], z])
            rang.append(M.poser([q], [emprunter(q, tronc)[0]])[0])
        grille.append(rang)
        centres.append(np.array([c[0], c[1], z]))

    dorees = set()

    def quad(a, bb, cc, d, ref, doree):
        if doree:
            dorees.update((len(M.triangles), len(M.triangles) + 1))
        M.quad(a, bb, cc, d, ref)

    n = len(hauteurs)
    for r in range(n - 1):
        ref = (centres[r] + centres[r + 1]) / 2
        doree = r < D['DORURE']['bas'] or r >= n - 1 - D['DORURE']['haut']
        for j in range(m):
            k = (j + 1) % m
            v = (grille[r][j], grille[r][k], grille[r + 1][k], grille[r + 1][j])
            if None not in v:
                quad(*v, ref, doree)

    # Bretelles : de chaque colonne de `BRETELLE` de l'encolure du plastron (et son symétrique à gauche) à sa symétrique
    # de la dossière, des rangées posées sur l'épaule au `JEU_DE_BRETELLE`.
    haut = grille[-1]
    for signe in (1, -1):
        colonnes = []
        for j in range(D['BRETELLE'][0], D['BRETELLE'][1] + 1):
            devant, dos = (signe * j) % m, (m // 2 - signe * j) % m
            a, bb = M.sommets[haut[devant]], M.sommets[haut[dos]]
            ligne = [haut[devant]]
            for f in D['TRAVERSE_DE_BRETELLE']:
                p = a + f * (bb - a)
                touche = tronc['arbre'].ray_cast(Vector((p[0], p[1], p[2] + 0.5)), Vector((0.0, 0.0, -1.0)), 1.0)[0]
                if touche is None:
                    raise ValueError(f'bretelle : aucune épaule sous {tuple(p)}')
                q = np.array([p[0], p[1], max(p[2], touche.z + D['JEU_DE_BRETELLE'])])
                ligne += M.poser([q], [emprunter(q, tronc)[0]])
            colonnes.append(ligne + [haut[dos]])
        dessous = centres[-1] - np.array([0.0, 0.0, 0.15])
        for A, B in zip(colonnes, colonnes[1:]):
            for i in range(len(A) - 1):
                quad(A[i], A[i + 1], B[i + 1], B[i], dessous, False)

    piece = piece_de(D, b, M, materiaux['acier'], 'plastron')
    # `tissu.double_nappe` : la face extérieure du triangle t est le polygone 2t.
    piece.data.materials.append(materiaux['dorure'])
    indice = len(piece.data.materials) - 1
    for t in dorees:
        piece.data.polygons[2 * t].material_index = indice

    poitrine(D, b, M)
    b.transferer(piece, ZONES, D['BORNES_DES_CLES'])
    return piece


def poitrine(D, b, M):
    """Offre l'emplacement `poitrine` sur la face extérieure du plastron, au point (x, z) de `POITRINE` : son +Z glTF sur
    la normale sortante, son +Y vers le haut, ses poids ceux du plastron sous le point."""
    plastron = porteur_de(np.array(M.sommets), np.array(M.triangles), np.array(M.poids))
    x, z = D['POITRINE']
    touche, normale, _, _ = plastron['arbre'].ray_cast(Vector((x, -1.0, z)), Vector((0.0, 1.0, 0.0)), 2.0)
    if touche is None:
        raise ValueError(f'poitrine : aucun plastron en ({x}, {z})')
    p = np.array(touche)
    nz = unitaire(np.array(normale) * (1 if normale.y < 0 else -1))
    ny = unitaire(np.array([0.0, 0.0, 1.0]) - nz[2] * nz)
    nx = np.cross(ny, nz)
    w = emprunter(p, plastron)[0]
    b.offrir('poitrine', w, p, (nx, ny, nz))
