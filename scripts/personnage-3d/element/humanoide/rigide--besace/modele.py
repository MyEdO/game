"""Géométrie de `humanoide--rigide--besace` : un corps de cuir bombé à fond arrondi, un rabat qui passe sur le dessus et
tombe sur le devant, un bouton, deux pattes d'attache, le fond incliné vers l'extérieur, dans le repère de la prise (+Y vers le bas une fois rangée, +Z
sortant)."""
import math

from maille import Maille, basculer_maille, cylindre, objet, poutre


def contour(D):
    """Le contour du corps dans le plan (x, y), sens trigonométrique vu de +z : bord haut droit, fond en demi-lune."""
    w, y0, h, r, n = D['LARGEUR'] / 2, D['HAUT'], D['HAUTEUR'], D['RAYON_DU_FOND'], D['POINTS_DU_CONTOUR']
    bas = y0 + h - r
    pts = [(-w, y0), (w, y0), (w, bas)]
    arc = (n - 4) // 2
    for k in range(1, arc + 1):
        t = math.pi / 2 * k / arc
        pts.append((w - r + r * math.cos(t), bas + r * math.sin(t)))
    for k in range(arc + 1):
        t = math.pi / 2 + math.pi / 2 * k / arc
        pts.append((-w + r + r * math.cos(t), bas + r * math.sin(t)))
    return pts


def retrait(pts, d):
    """Le contour `pts` décalé vers l'intérieur de `d`, le long des bissectrices."""
    n = len(pts)
    sortie = []
    for i in range(n):
        (ax, ay), (bx, by), (cx, cy) = pts[i - 1], pts[i], pts[(i + 1) % n]
        n1 = (by - ay, -(bx - ax))
        n2 = (cy - by, -(cx - bx))
        l1, l2 = math.hypot(*n1), math.hypot(*n2)
        nx, ny = n1[0] / l1 + n2[0] / l2, n1[1] / l1 + n2[1] / l2
        ln = math.hypot(nx, ny)
        sortie.append((bx - d * nx / ln, by - d * ny / ln))
    return sortie


def corps(m, D):
    pts, A, t = contour(D), D['ARRONDI'], D['EPAISSEUR']
    anneaux = [(0.0, retrait(pts, A['dos'])), (A['pas'], pts), (t - A['pas'], pts), (t, retrait(pts, A['devant']))]
    n = len(pts)
    sommets = [(x, y, z) for z, anneau in anneaux for x, y in anneau]
    faces = [[k * n + i, k * n + (i + 1) % n, (k + 1) * n + (i + 1) % n, (k + 1) * n + i]
             for k in range(len(anneaux) - 1) for i in range(n)]
    faces += [list(range(n))[::-1], [(len(anneaux) - 1) * n + i for i in range(n)]]
    m.ajouter(sommets, faces, 'cuir')


def rabat(m, D):
    """Le rabat, profil (y, z) extrudé en x, son épaisseur `RABAT['epaisseur']` posée vers l'extérieur."""
    R, y0, t = D['RABAT'], D['HAUT'], D['EPAISSEUR']
    profil = [(y0 + 0.012, -0.002), (y0 - 0.006, 0.012), (y0 - 0.010, t * 0.5), (y0 - 0.004, t + 0.004),
              (y0 + 0.030, t + 0.010), (y0 + R['tombe'], t + 0.006)]
    demi = D['LARGEUR'] / 2 + R['debord']
    largeurs = [demi] * 4 + [demi * (1 + R['resserre']) / 2, demi * R['resserre']]
    sommets = []
    for i, (y, z) in enumerate(profil):
        a, b = profil[max(i - 1, 0)], profil[min(i + 1, len(profil) - 1)]
        dy, dz = b[0] - a[0], b[1] - a[1]
        l = math.hypot(dy, dz)
        ny, nz = dz / l, -dy / l        # normale vers l'intérieur (le bas, puis l'arrière)
        for x in (-largeurs[i], largeurs[i]):
            sommets += [(x, y, z), (x, y - ny * R['epaisseur'], z - nz * R['epaisseur'])]
    faces = []
    for i in range(len(profil) - 1):
        a, b = 4 * i, 4 * (i + 1)
        faces += [[a, b, b + 2, a + 2], [a + 1, a + 3, b + 3, b + 1], [a, a + 1, b + 1, b], [a + 2, b + 2, b + 3, a + 3]]
    k = 4 * (len(profil) - 1)
    faces += [[0, 2, 3, 1], [k, k + 1, k + 3, k + 2]]
    m.ajouter(sommets, faces, 'cuir')


def construire(D, materiaux):
    m = Maille(list(materiaux.values()))
    corps(m, D)
    rabat(m, D)
    B, R, t = D['BOUTON'], D['RABAT'], D['EPAISSEUR']
    cylindre(m, t + 0.004, t + B['saillie'], B['rayon'], 'z', (0.0, D['HAUT'] + R['tombe'] - 0.014, 0.0), B['segments'],
             'metal')
    P = D['PATTES']
    for x in (-P['ecart'], P['ecart']):
        poutre(m, (x, D['HAUT'] + 0.03, P['epaisseur'] / 2), (x, -P['au_dessus'], P['epaisseur'] / 2), P['largeur'],
               P['epaisseur'], (0, 0, 1), 'cuir')
    basculer_maille(m, (0.0, 0.0), -D['ECART'])
    return [objet('humanoide--rigide--besace', m, (0.0, 0.0, 0.0), D['ANGLE_LISSE'])]
