"""Géométrie de `humanoide--accessoire--sceau-de-cire`, d'après `donnees.py` (aucun nombre ici) :

- la feuille : une grille couchée sur la bure publiée, chaque sommet visé depuis l'axe du corps le long de son azimut et
  posé sur la bure, plus le jeu ; son haut au-dessus de la corde publiée, son bas déchiré, un coin relevé ;
- la bande : trois colonnes couchées de même par-dessus la feuille, du sceau à sa queue d'aronde ;
- le sceau : un disque bombé tourné autour de la normale de la bure sous son centre, posé sur la bande, son cachet en
  creux ;
- l'écriture : un trait d'encre par mot, à son jeu au-dessus de la feuille (lignes qui sautent le sceau et la bande) et de
  la bande (le long d'elle), coupé aux colonnes de la feuille et aux rangs de la bande pour en suivre la surface ;
- l'emplacement `EMPLACEMENT`, offert sur la face extérieure de la corde au milieu de la feuille (`Base.offrir`).
Chaque nappe se décrit sur ses paramètres (abscisse le long de la bure, hauteur) par sa distance à l'axe, et se relève
(`relever`) au-dessus de chaque sommet de ce qu'elle couvre, la bure ou la nappe dessous : posée sur la bure aux seuls
sommets visés, la feuille passait derrière un pli de la bure entre deux d'entre eux (`couche-percee-au-repos`, 11 mm).
Feuille et bande, en double nappe, et l'écriture prennent les poids de la bure sous chaque sommet ; le sceau, en bloc, ceux de la bure
sous son centre. Silhouettes et clés `gabarit_*` transférées de la bure publiée sous la pièce.
"""
import math

import numpy as np
from tissu import JUMEAU, Maillage, direction, emprunter, joindre, maillage_skinne, poids_normalises, porteur_de, \
    sur_le_porteur

HAUT = np.array([0.0, 0.0, 1.0])


def unitaire(x):
    return x / np.linalg.norm(x)


def quads(colonnes):
    """Les triangles de la grille `colonnes` (indices de sommet, colonne par colonne), deux par maille, comme
    `Maillage.quad`."""
    tris = []
    for c0, c1 in zip(colonnes, colonnes[1:]):
        for j in range(len(c0) - 1):
            a, b, c, d = c0[j], c1[j], c1[j + 1], c0[j + 1]
            tris += [(a, b, c), (a, c, d)]
    return np.array(tris)


def dans_la_grille(uv, tris, points):
    """Par point de `points` (paramètres), le triangle de la grille de paramètres `uv` qui le contient (-1 hors d'elle)
    et ses coordonnées barycentriques."""
    dedans, bary = np.full(len(points), -1), np.zeros((len(points), 3))
    for t, (a, b, c) in enumerate(tris):
        m = np.array([uv[b] - uv[a], uv[c] - uv[a]]).T
        if abs(np.linalg.det(m)) < 1e-12:
            continue
        l = np.linalg.solve(m, (points - uv[a]).T).T
        w = np.column_stack([1 - l.sum(axis=1), l])
        pris = (w >= -1e-9).all(axis=1) & (dedans < 0)
        dedans[pris], bary[pris] = t, w[pris]
    return dedans, bary


def relever(uv, rho, tris, points, distances, marge):
    """`rho` (distance à l'axe par sommet de la grille) relevé pour passer à `marge` au moins devant chaque point de
    `points` à `distances` de l'axe : chaque sommet monte du plus grand manque des triangles qui le portent, et chaque
    point de ces triangles monte d'autant au moins."""
    dedans, bary = dans_la_grille(uv, tris, points)
    manque = np.zeros(len(tris))
    for t, w, r in zip(dedans, bary, distances):
        if t >= 0:
            manque[t] = max(manque[t], r + marge - w @ rho[tris[t]])
    monte = np.zeros(len(rho))
    for t in np.flatnonzero(manque > 0):
        monte[tris[t]] = np.maximum(monte[tris[t]], manque[t])
    return rho + monte


def mots_d_une_ligne(longueurs, debut, fin, espace, barrees):
    """Les mots (début, fin) de longueurs `longueurs` posés de `debut` vers `fin` à `espace` l'un de l'autre, chacun
    reporté au-delà de chaque intervalle de `barrees` qu'il toucherait ; la ligne s'arrête au premier qui dépasse `fin`."""
    mots, g = [], debut
    for longueur in longueurs:
        for a, z in sorted(barrees):
            if g < z and g + longueur > a:
                g = z
        if g + longueur > fin:
            break
        mots.append((g, g + longueur))
        g += longueur + espace
    return mots


def trait(centres, travers, demi):
    """Les paramètres des deux bords d'un trait de milieu `centres` (paramètres), à `demi` de part et d'autre le long de
    `travers`."""
    return [(c - demi * travers, c + demi * travers) for c in np.asarray(centres, dtype=float)]


def construire(D, materiaux, b):
    b.exiger(D['ZONES'])
    bure, corde = (porteur_de(*b.matieres_publiees(D['CONTOURNE'][k], D['MATIERES'][k])) for k in ('bure', 'cordeliere'))
    anneau = corde['P'][np.unique(corde['T'])]
    P = np.concatenate([b.corps(z)[0] for z in D['ZONES']])
    tranche = P[np.abs(P[:, 2] - np.median(anneau[:, 2])) < D['TRANCHE_DU_CORPS']]
    centre = np.array([*(tranche[:, :2].min(axis=0) + tranche[:, :2].max(axis=0)) / 2, 0.0])

    def azimut(Q):
        return np.degrees(np.arctan2(Q[:, 0] - centre[0], centre[1] - Q[:, 1]))

    pres = anneau[np.abs(azimut(anneau) - D['AZIMUT']) < D['TRANCHE']]
    hauteur = pres[:, 2].mean()
    d0 = np.array([*direction(D['AZIMUT']), 0.0])
    rayon = (sur_le_porteur(bure, centre + HAUT * hauteur, d0, D['PORTEE'])[0] - centre) @ d0

    def vers(g):
        """Direction horizontale de l'abscisse `g` (m, le long de la bure vers la gauche du personnage depuis le milieu
        de la feuille)."""
        return np.array([*direction(D['AZIMUT'] + math.degrees(g / rayon)), 0.0])

    def sur_la_bure(g, z):
        """Distance à l'axe de la bure à l'abscisse `g` et à la hauteur `z`, et sa normale."""
        p, n = sur_le_porteur(bure, centre + HAUT * z, vers(g), D['PORTEE'])
        return (p - centre) @ vers(g), n

    def position(g, z, rho):
        return centre + HAUT * z + vers(g) * rho

    Q = bure['P'][np.unique(bure['T'])]
    sous_bure = np.column_stack([np.radians((azimut(Q) - D['AZIMUT'] + 180) % 360 - 180) * rayon, Q[:, 2]])
    rho_bure = np.linalg.norm(Q[:, :2] - centre[:2], axis=1)
    F, R, S, C = D['FEUILLE'], D['RUBAN'], D['SCEAU'], D['CACHET']
    ep_f, ep_r = F['jeu'] + F['epaisseur'], R['jeu'] + R['epaisseur']

    # Feuille : colonne i de la gauche du personnage à sa droite, rang j de haut en bas.
    n, k = F['colonnes'], F['rangs']
    uv_f, rho_f = [], []
    for i in range(n + 1):
        g = F['largeur'] / 2 - F['largeur'] * i / n
        bas = F['hauteur'] - D['DECHIRURES'][i]
        coin = max(0.0, 1 - i / (0.35 * n))
        for j in range(k + 1):
            z = hauteur + F['au_dessus'] - bas * j / k
            uv_f.append((g, z))
            rho_f.append(sur_la_bure(g, z)[0] + ep_f + D['COIN_RELEVE'] * coin * (j / k) ** 2)
    uv_f = np.array(uv_f)
    colonnes_f = [list(range(i * (k + 1), (i + 1) * (k + 1))) for i in range(n + 1)]
    tris_f = quads(colonnes_f)
    rho_f = relever(uv_f, np.array(rho_f), tris_f, sous_bure, rho_bure, ep_f)

    # Bande : trois colonnes, la pointe du milieu remontée en queue d'aronde, sur la bure et sur la feuille.
    haut, long_ = hauteur - S['sous'] + S['rayon'] / 2, R['longueur'] + S['rayon'] / 2
    m = R['segments']
    uv_r = np.array([(-S['droite'] - R['derive'] * (j / m) ** 2 + c * R['largeur'] / 2,
                      haut - long_ * j / m + (R['aronde'] if j == m and c == 0 else 0.0))
                     for c in (1, 0, -1) for j in range(m + 1)])
    colonnes_r = [list(range(c * (m + 1), (c + 1) * (m + 1))) for c in range(3)]
    tris_r = quads(colonnes_r)
    rho_r = np.array([sur_la_bure(g, z)[0] + ep_f + ep_r for g, z in uv_r])
    rho_r = relever(uv_r, rho_r, tris_r, sous_bure, rho_bure, ep_f + ep_r)
    rho_r = relever(uv_r, rho_r, tris_r, uv_f, rho_f, ep_r)
    dedans, bary = dans_la_grille(uv_f, tris_f, uv_r)
    for s, (t, w) in enumerate(zip(dedans, bary)):
        if t >= 0:
            rho_r[s] = max(rho_r[s], w @ rho_f[tris_f[t]] + ep_r)

    # Écriture : sur la feuille, des lignes de mots coupés aux colonnes de sa grille, qui sautent le sceau et la bande ;
    # le long de la bande, des mots coupés à ses rangs.
    E = D['ECRITURE']
    g_s, z_s, haut_r = -S['droite'], hauteur - S['sous'], hauteur - S['sous'] + S['rayon'] / 2

    def sur_la_bande(z):
        t = (haut_r - z) / long_
        return -S['droite'] - R['derive'] * t ** 2

    traits = []
    coupes_f = sorted({uv_f[c[0]][0] for c in colonnes_f})
    for rang, longueurs in enumerate(D['LIGNES']):
        z = hauteur - E['sous'] - E['interligne'] * rang
        barrees = []
        dz = abs(z - z_s) - E['trait'] / 2
        if dz < S['rayon'] + E['autour']:
            demi = math.sqrt((S['rayon'] + E['autour']) ** 2 - max(dz, 0.0) ** 2)
            barrees.append((g_s - demi, g_s + demi))
        if z < haut_r:
            demi = R['largeur'] / 2 + E['autour']
            barrees.append((sur_la_bande(z) - demi, sur_la_bande(z) + demi))
        for g0, g1 in mots_d_une_ligne(longueurs, -F['largeur'] / 2 + E['marge'], F['largeur'] / 2 - E['marge'],
                                       E['espace'], barrees):
            g = [g0, *(c for c in coupes_f if g0 < c < g1), g1]
            traits.append((trait([(x, z) for x in g], np.array([0.0, 1.0]), E['trait'] / 2), uv_f, tris_f, rho_f))
    t_haut = (S['rayon'] * 1.5 + E['autour']) / long_
    t_bas = 1 - (R['aronde'] + E['autour']) / long_
    coupes_r = [j / m for j in range(m + 1)]
    for decalage, longueurs in D['LIGNES_DU_RUBAN'].items():
        for t0, t1 in mots_d_une_ligne([l / long_ for l in longueurs], t_haut, t_bas, E['espace'] / long_, []):
            t = [t0, *(c for c in coupes_r if t0 < c < t1), t1]
            centres = [(sur_la_bande(haut_r - long_ * x) + decalage, haut_r - long_ * x) for x in t]
            traits.append((trait(centres, np.array([1.0, 0.0]), E['trait'] / 2), uv_r, tris_r, rho_r))
    M = Maillage()
    for bords, uv, tris, rho in traits:
        points = np.array([p for paire in bords for p in paire])
        dedans, bary = dans_la_grille(uv, tris, points)
        if (dedans < 0).any():
            raise ValueError(f'un mot sort de son parchemin : {points[dedans < 0].tolist()}')
        rho_e = np.einsum('ij,ij->i', bary, rho[tris[dedans]]) + E['jeu']
        indices = M.ajouter([position(g, z, r) for (g, z), r in zip(points, rho_e)], None)
        for k in range(len(bords) - 1):
            a, b_, c, d = indices[2 * k], indices[2 * k + 2], indices[2 * k + 3], indices[2 * k + 1]
            M.quad(a, b_, c, d, centre + HAUT * points[2 * k][1])
    X, orientes, _ = M.orienter()
    encre = maillage_skinne('encre', [tuple(p) for p in X], [tuple(t) for t in orientes], materiaux['encre'], b.rig,
                            poids_normalises([emprunter(p, bure)[0] for p in X], b.os))
    for poly in encre.data.polygons:
        poly.use_smooth = True
    encre.data.attributes.new(JUMEAU, 'INT', 'POINT')   # nappe simple : chaque sommet est son propre jumeau

    objets = []
    for nom, uv, rho, colonnes, epaisseur in (('feuille', uv_f, rho_f, colonnes_f, F['epaisseur']),
                                              ('bande', uv_r, rho_r, colonnes_r, R['epaisseur'])):
        M = Maillage()
        M.ajouter([position(g, z, r) for (g, z), r in zip(uv, rho)], None)
        for c0, c1 in zip(colonnes, colonnes[1:]):
            for j in range(len(c0) - 1):
                M.quad(c0[j], c1[j], c1[j + 1], c0[j + 1], centre + HAUT * uv[c0[j]][1])
        X, orientes, normales = M.orienter()
        objets.append(b.nappe(nom, X, normales, [emprunter(p, bure)[0] for p in X], orientes, materiaux['parchemin'],
                              epaisseur))

    # Sceau : profil (hauteur le long de la normale, rayon), tourné autour d'elle, posé sur la bande à son centre.
    g, z = -S['droite'], hauteur - S['sous']
    (t,), (w,) = dans_la_grille(uv_r, tris_r, np.array([(g, z)]))
    o, axe = position(g, z, w @ rho_r[tris_r[t]]), sur_la_bure(g, z)[1]
    u = unitaire(HAUT - (HAUT @ axe) * axe)
    v = np.cross(axe, u)
    e, r = S['epaisseur'], S['rayon']
    profil = [(0.0, r), (e * 0.5, r), (e, r * 0.85), (e, r * C['rayon']), (e - C['creux'], r * C['rayon'] * 0.85)]
    q = S['segments']
    sommets = [o, o + axe * (e - C['creux'])]
    for h, rr in profil:
        sommets += [o + axe * h + rr * (math.cos(2 * math.pi * a / q) * u + math.sin(2 * math.pi * a / q) * v)
                    for a in range(q)]

    def a_l_anneau(rang, a):
        return 2 + rang * q + a % q

    faces = [[0, a_l_anneau(0, a + 1), a_l_anneau(0, a)] for a in range(q)]
    faces += [[a_l_anneau(rang, a), a_l_anneau(rang, a + 1), a_l_anneau(rang + 1, a + 1), a_l_anneau(rang + 1, a)]
              for rang in range(len(profil) - 1) for a in range(q)]
    faces += [[1, a_l_anneau(len(profil) - 1, a), a_l_anneau(len(profil) - 1, a + 1)] for a in range(q)]
    sceau = maillage_skinne('sceau', [tuple(p) for p in sommets], faces, materiaux['cire'], b.rig,
                            poids_normalises([emprunter(o, bure)[0]] * len(sommets), b.os))
    for poly in sceau.data.polygons:
        poly.use_smooth = True
    sceau.data.set_sharp_from_angle(angle=math.radians(D['ANGLE_LISSE']))
    sceau.data.attributes.new(JUMEAU, 'INT', 'POINT')   # nappe simple : chaque sommet est son propre jumeau
    objets += [sceau, encre]

    dehors = pres[np.argmax(np.linalg.norm(pres[:, :2] - centre[:2], axis=1))]
    point = centre + d0 * np.linalg.norm(dehors[:2] - centre[:2]) + HAUT * hauteur
    b.offrir(D['EMPLACEMENT'], emprunter(point, bure)[0], point, (np.cross(HAUT, d0), HAUT, d0))

    piece = joindre(objets)
    piece.name = D['MANIFESTE']['cle']['piece']
    b.transferer(piece, D['ZONES'], masques=[([True] * len(piece.data.vertices), D['ZONES'],
                                              {D['CONTOURNE']['bure']: D['ZONES_DE_LA_BURE']})])
    return piece
