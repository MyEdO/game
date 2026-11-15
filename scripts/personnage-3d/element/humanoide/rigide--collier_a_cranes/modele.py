"""Géométrie de `humanoide--rigide--collier_a_cranes` : les deux brins de chaîne qui descendent des côtés du cou
jusqu'aux fuseaux, les ailes qui tiennent le petit crâne aux brins, le bout de chaîne qui en pend jusqu'au crâne d'os,
et les deux fuseaux coiffés de leur capuchon (+Y vers le bas une fois rangé, +Z sortant)."""
from mathutils import Vector

from maille import Maille, objet, poutre, tour

def etirer(D, y):
    """La cote y relevée sur l'illustration, étirée sous la zone d'appui pour que le pivot de l'hôte la ramène à sa
    place (`ETIREMENT` des données)."""
    E = D['ETIREMENT']
    return y if y <= E['depuis'] else E['depuis'] + (y - E['depuis']) * E['facteur']


def chaine(m, D, chemin, C):
    """Les maillons le long de la ligne brisée `chemin` [(x, y, z)], au pas le plus proche de `C['pas']`, à plat puis de
    chant en alternance, leur face arrière sur la cote z du chemin."""
    pts = [Vector((x, etirer(D, y), z + C['largeur'] / 2)) for x, y, z in chemin]
    longueurs = [(b - a).length for a, b in zip(pts, pts[1:])]
    n = max(1, round(sum(longueurs) / C['pas']))
    pas = sum(longueurs) / n

    def le_long(s):
        for a, b, l in zip(pts, pts[1:], longueurs):
            if s <= l:
                return a.lerp(b, s / l)
            s -= l
        return pts[-1]

    for i in range(n):
        a, b = le_long(i * pas), le_long((i + 1) * pas)
        d = (b - a).normalized()
        normale = (0.0, 0.0, 1.0) if i % 2 == 0 else tuple(d.cross(Vector((0.0, 0.0, 1.0))))
        poutre(m, a - d * C['recouvrement'], b + d * C['recouvrement'], C['largeur'], C['epaisseur'], normale, 'metal')


def crane(m, D, K, mat):
    """Le crâne `K` de face, révolution elliptique de `PROFIL_DE_CRANE` autour de Y, sa face arrière sur
    `K['arriere']` ; ses orbites, si `K` en porte, creusées dans l'anneau à leur hauteur."""
    l, h, p = K['largeur'] / 2, K['hauteur'], K['profondeur'] / 2
    haut, zc = etirer(D, K['centre']) - h / 2, K['arriere'] + p
    debut = len(m.v)
    profil = [(f * h, r * l, w * p) for f, r, w in D['PROFIL_DE_CRANE']]
    tour(m, profil, 'y', (0.0, haut, zc), K['segments'], mat)
    O = K.get('orbites')
    if O:
        y = haut + O['hauteur'] * h
        orbite = lambda x, yv, zv: abs(yv - y) < 1e-9 and zv > zc and abs(x) > 1e-9  # noqa: E731
        m.v[debut:] = [(x * O['creux'], yv, zc + (zv - zc) * O['creux']) if orbite(x, yv, zv) else (x, yv, zv)
                       for x, yv, zv in m.v[debut:]]


def fuseau(m, D, signe):
    """Le fuseau, révolution de son profil autour de son axe le long de Y, sa face arrière sur le plan au plus
    large."""
    F = D['FUSEAU']
    axe = D['PLAN'] + max(r for _, r in F['profil'])
    tour(m, F['profil'], 'y', (signe * F['x'], etirer(D, F['haut']), axe), F['segments'], 'metal')


def construire(D, materiaux):
    m = Maille(list(materiaux.values()))
    C = D['CHAINON']
    for signe in (-1, 1):
        chaine(m, D, [(signe * x, y, z) for x, y, z in D['BRINS']], C)
        chaine(m, D, [(signe * x, y, z) for x, y, z in D['AILE']], C)
        fuseau(m, D, signe)
    crane(m, D, D['PETIT_CRANE'], 'metal')
    chaine(m, D, D['CHAINE_DU_CRANE'], C)
    crane(m, D, D['CRANE'], 'os')
    return [objet('humanoide--rigide--collier_a_cranes', m, (0.0, 0.0, 0.0), D['ANGLE_LISSE'])]
