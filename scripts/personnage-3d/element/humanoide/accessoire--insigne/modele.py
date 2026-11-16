"""Géométrie de `humanoide--accessoire--insigne` : un écu de métal cintré, bâti dans le repère de l'emplacement
`poitrine` ; le champ (surface `blason`, UV sur le carré [0,1]²) en retrait du liseré, flancs et revers en `bordure`."""
import math

from maille import Maille, objet


def contour(D):
    """Le tour de l'écu (x, y), dans le sens trigonométrique vu de face, depuis le coin supérieur gauche : le flanc
    gauche, son arrondi jusqu'à la pointe, l'arrondi et le flanc droits, le bord supérieur ; centré sur sa boîte."""
    w, h = D['LARGEUR'] / 2, D['HAUTEUR']
    haut, flanc = h / 2, h / 2 - D['FLANC'] * h
    n = D['POINTS_DE_L_ARRONDI']
    # L'arrondi : un quart d'ellipse de la fin du flanc (x = ±w) à la pointe (x = 0, y = -h/2).
    droite = [(w * math.cos(math.pi / 2 * k / n), flanc - (flanc + haut) * math.sin(math.pi / 2 * k / n)) for k in range(n + 1)]
    gauche = [(-x, y) for x, y in droite[:-1]]
    return [(-w, haut)] + gauche + [droite[-1]] + list(reversed(droite[:-1])) + [(w, haut)]


def retrait(points, d):
    """Le tour `points` ramené de `d` vers l'intérieur, chaque sommet le long de la bissectrice de ses deux arêtes."""
    n = len(points)
    sortie = []
    for i, (x, y) in enumerate(points):
        (xa, ya), (xb, yb) = points[i - 1], points[(i + 1) % n]
        na = (ya - y, x - xa)
        nb = (y - yb, xb - x)
        la, lb = math.hypot(*na), math.hypot(*nb)
        bx, by = na[0] / la + nb[0] / lb, na[1] / la + nb[1] / lb
        lbis = math.hypot(bx, by)
        cos_demi = (bx * na[0] / la + by * na[1] / la) / lbis
        sortie.append((x + d * bx / lbis / cos_demi, y + d * by / lbis / cos_demi))
    return sortie


def construire(D, materiaux):
    m = Maille(list(materiaux.values()))
    R = D['RAYON_DE_CINTRE']

    def cintre(x, y, z):
        return (x, y, z - x * x / (2 * R))

    ext = contour(D)
    inte = retrait(ext, D['LISERE'])
    n = len(ext)
    z0 = D['JEU']
    z1 = z0 + D['EPAISSEUR']
    z2 = z1 + D['RELIEF_DU_LISERE']
    revers = [cintre(x, y, z0) for x, y in ext]
    lisere_ext = [cintre(x, y, z2) for x, y in ext]
    lisere_int = [cintre(x, y, z2) for x, y in inte]
    champ = [cintre(x, y, z1) for x, y in inte]
    debut = len(m.v)
    m.ajouter(revers + lisere_ext + lisere_int + champ,
              [list(reversed(range(n)))] +
              [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)] +
              [[n + i, n + (i + 1) % n, 2 * n + (i + 1) % n, 2 * n + i] for i in range(n)] +
              [[2 * n + i, 2 * n + (i + 1) % n, 3 * n + (i + 1) % n, 3 * n + i] for i in range(n)],
              'bordure')
    # Le champ : vu de face (+Z), u croît vers +X (à droite de qui le regarde), v de Blender vers le haut (+Y) ;
    # le carré [0,1]² est celui de la hauteur, centré.
    h = D['HAUTEUR']
    m.f.append([debut + 3 * n + i for i in range(n)])
    m.m.append([x.name for x in m.materiaux].index('champ'))
    m.uv.append([(0.5 + x / h, 0.5 + y / h) for x, y in inte])
    return [objet('humanoide--accessoire--insigne', m, (0.0, 0.0, 0.0), 40.0)]
