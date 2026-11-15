"""Géométrie de `humanoide--rigide--livre` : un livre relié couché sur le côté, plats et dos de couverture, bloc des pages,
le champ carré du plat avant (surface `blason`, UV sur le carré [0,1]²), coins de métal au plat avant, fermoir sur la
tranche avant, sangle de cuir qui le ceint et monte à l'emplacement (+Y vers le bas une fois rangé, +Z sortant, +X vers
l'avant du personnage à `ceinture_g`)."""
from maille import Maille, boite, objet


def champ(m, D, ym, z1):
    """Le champ : un carré en relief sur le plat avant, ses flancs en `couverture`, sa face avant seule en `plat`."""
    C = D['CHAMP']
    a, xc, z2 = C['cote'] / 2, C['x'], z1 + C['relief']
    carre = [(xc - a, ym - a), (xc + a, ym - a), (xc + a, ym + a), (xc - a, ym + a)]
    sommets = [(x, y, z1) for x, y in carre] + [(x, y, z2) for x, y in carre]
    debut = len(m.v)
    m.ajouter(sommets, [[3, 2, 1, 0]] + [[k, (k + 1) % 4, 4 + (k + 1) % 4, 4 + k] for k in range(4)], 'couverture')
    m.f.append([debut + 4 + k for k in range(4)])
    m.m.append([x.name for x in m.materiaux].index('plat'))
    m.uv.append(uv_du_champ(carre, a, xc, ym))


def uv_du_champ(carre, a, xc, ym):
    """Les UV des coins du champ sur le carré [0,1]² : rangé à `ceinture_g`, le plat regarde dehors, +X vers l'avant du
    personnage, à gauche de qui le regarde ; u croît donc vers -x, et v de Blender vers le haut (-y), l'export glTF le
    retourne."""
    return [(0.5 - (x - xc) / (2 * a), 0.5 - (y - ym) / (2 * a)) for x, y in carre]


def construire(D, materiaux):
    m = Maille(list(materiaux.values()))
    S, P, C, F = D['SANGLE'], D['PLAT'], D['COINS'], D['FERMOIR']
    w, y0, t, p, d, e = D['LARGEUR'] / 2, D['HAUT'], D['EPAISSEUR'], P['epaisseur'], P['debord'], S['epaisseur']
    y1, z0 = y0 + D['HAUTEUR'], S['epaisseur']
    z1 = z0 + t
    boite(m, (-w, y0, z0), (w, y1, z0 + p), 'couverture')
    boite(m, (-w, y0, z1 - p), (w, y1, z1), 'couverture')
    boite(m, (-w, y0, z0 + p), (-w + p, y1, z1 - p), 'couverture')
    boite(m, (-w + p, y0 + d, z0 + p), (w - d, y1 - d, z1 - p), 'pages')
    c, ec = C['cote'], C['epaisseur']
    for x0, x1 in ((-w, -w + c), (w - c, w)):
        for ya, yb in ((y0, y0 + c), (y1 - c, y1)):
            boite(m, (x0, ya, z1), (x1, yb, z1 + ec), 'metal')
    ym, lf, ef = (y0 + y1) / 2, F['largeur'] / 2, F['epaisseur']
    champ(m, D, ym, z1)
    boite(m, (w, ym - lf, z0 + p), (w + ef, ym + lf, z1 + ef), 'cuir')
    boite(m, (w - F['sur_le_plat'], ym - lf, z1), (w, ym + lf, z1 + ef), 'cuir')
    bl, bh, be = F['boucle']
    xb = w - F['sur_le_plat']
    boite(m, (xb, ym - bh / 2, z1), (xb + bl, ym + bh / 2, z1 + ef + be), 'metal')
    x0, x1 = S['x'] - S['largeur'] / 2, S['x'] + S['largeur'] / 2
    boite(m, (x0, y0 - e, z1), (x1, y1 + e, z1 + e), 'cuir')
    boite(m, (x0, y1, 0.0), (x1, y1 + e, z1), 'cuir')
    boite(m, (x0, y0 - e, z0), (x1, y0, z1), 'cuir')
    boite(m, (x0, -S['au_dessus'], 0.0), (x1, y1, z0), 'cuir')
    return [objet('humanoide--rigide--livre', m, (0.0, 0.0, 0.0), D['ANGLE_LISSE'])]
