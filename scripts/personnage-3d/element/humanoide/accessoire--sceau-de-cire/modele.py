"""Géométrie de `humanoide--accessoire--sceau-de-cire` : la feuille de parchemin cintrée qui pend sous l'origine (la corde),
son bas déchiré et un coin relevé ; le sceau de cire bombé posé sur elle, son cachet en creux ; la bande de parchemin qui
pend sous le sceau en queue d'aronde (+Y vers le bas une fois posée, +Z sortant)."""
from maille import Maille, objet, tour


def dos_de_la_feuille(F, x):
    """z du dos de la feuille cintrée à l'abscisse `x` : le milieu sur z = 0, les bords en retrait."""
    return -x * x / (2 * F['rayon'])


def feuille(m, D):
    F, dechirures = D['FEUILLE'], D['DECHIRURES']
    n, k = F['colonnes'], F['rangs']
    demi, haut = F['largeur'] / 2, -F['au_dessus']
    grille = []
    for i in range(n + 1):
        x = -demi + F['largeur'] * i / n
        bas = F['hauteur'] - F['au_dessus'] - dechirures[i]
        coin = max(0.0, 1 - (x + demi) / (0.35 * F['largeur']))
        colonne = []
        for j in range(k + 1):
            t = j / k
            z = dos_de_la_feuille(F, x) + D['COIN_RELEVE'] * coin * t * t
            colonne.append((x, haut + (bas - haut) * t, z))
        grille.append(colonne)
    e = F['epaisseur']
    dos = [p for colonne in grille for p in colonne]
    face = [(x, y, z + e) for x, y, z in dos]
    nd = len(dos)

    def idx(i, j):
        return i * (k + 1) + j

    faces = []
    for i in range(n):
        for j in range(k):
            a, b, c, d = idx(i, j), idx(i + 1, j), idx(i + 1, j + 1), idx(i, j + 1)
            faces.append([a, b, c, d])
            faces.append([nd + d, nd + c, nd + b, nd + a])
    bord = [idx(i, 0) for i in range(n + 1)] + [idx(n, j) for j in range(1, k + 1)]
    bord += [idx(i, k) for i in range(n - 1, -1, -1)] + [idx(0, j) for j in range(k - 1, 0, -1)]
    for s, t in zip(bord, bord[1:] + bord[:1]):
        faces.append([s, nd + s, nd + t, t])
    m.ajouter(dos + face, faces, 'parchemin')


def dalle(m, contour, z, epaisseur, mat):
    """Plaque plane de `contour` [(x, y)], du dos à z à la face à z + `epaisseur`."""
    n = len(contour)
    sommets = [(x, y, z) for x, y in contour] + [(x, y, z + epaisseur) for x, y in contour]
    faces = [list(range(n)), list(range(2 * n - 1, n - 1, -1))]
    faces += [[i, n + i, n + (i + 1) % n, (i + 1) % n] for i in range(n)]
    m.ajouter(sommets, faces, mat)


def construire(D, materiaux):
    m = Maille(list(materiaux.values()))
    F, S, C, R = D['FEUILLE'], D['SCEAU'], D['CACHET'], D['RUBAN']
    feuille(m, D)
    z = dos_de_la_feuille(F, S['x']) + F['epaisseur']
    n, w, haut = R['segments'], R['largeur'] / 2, S['y'] - S['rayon'] / 2
    pas = [(S['x'] + R['derive'] * (i / n) ** 2, haut + (R['longueur'] + S['rayon'] / 2) * i / n) for i in range(n + 1)]
    gauche = [(x - w, y) for x, y in pas]
    droite = [(x + w, y) for x, y in pas]
    pointe = (pas[-1][0], pas[-1][1] - R['aronde'])
    dalle(m, gauche + [pointe] + droite[::-1], z, R['epaisseur'], 'parchemin')
    e, r = S['epaisseur'], S['rayon']
    profil = [(0.0, 0.0), (0.0, r), (e * 0.5, r), (e, r * 0.85), (e, r * C['rayon']),
              (e - C['creux'], r * C['rayon'] * 0.85), (e - C['creux'], 0.0)]
    tour(m, profil, 'z', (S['x'], S['y'], z + R['epaisseur']), S['segments'], 'cire')
    return [objet('humanoide--accessoire--sceau-de-cire', m, (0.0, 0.0, 0.0), D['ANGLE_LISSE'])]
