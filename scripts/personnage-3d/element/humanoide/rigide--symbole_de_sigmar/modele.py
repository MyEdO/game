"""Géométrie de `humanoide--rigide--symbole_de_sigmar` : la tête du marteau, deux pans évasés en nœud papillon de part et
d'autre d'un col, son médaillon central en relief, le manche court qui la traverse, dépasse au-dessus et pend dessous
jusqu'à son pommeau, et le cordon qui monte du bout du manche vers le cou (+Y vers le bas une fois rangé, +Z sortant)."""
from maille import Maille, boite, cylindre, objet, tube


def tete(m, T, yc):
    """Le nœud papillon extrudé de z = 0 à `epaisseur` : faces avant et arrière en trois quads (pan, col, pan)."""
    w, h, t, c = T['largeur'] / 2, T['hauteur'] / 2, T['taille'] / 2, T['col']
    contour = [(-w, -h), (-c, -t), (c, -t), (w, -h), (w, h), (c, t), (-c, t), (-w, h)]
    n = len(contour)
    sommets = [(x, y + yc, 0.0) for x, y in contour] + [(x, y + yc, T['epaisseur']) for x, y in contour]
    quads = [[0, 1, 6, 7], [1, 2, 5, 6], [2, 3, 4, 5]]
    faces = [q[::-1] for q in quads] + [[n + i for i in q] for q in quads]
    faces += [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
    m.ajouter(sommets, faces, 'metal')


def construire(D, materiaux):
    m = Maille(list(materiaux.values()))
    T, Md, Mc, C = D['TETE'], D['MEDAILLON'], D['MANCHE'], D['CORDON']
    yc, e = D['DESCENTE'], T['epaisseur']
    tete(m, T, yc)
    a = Md['cote'] / 2
    boite(m, (-a, yc - a, e), (a, yc + a, e + Md['relief']), 'metal')
    haut, bas = yc - T['hauteur'] / 2 - Mc['depasse'], yc + T['hauteur'] / 2 + Mc['longueur']
    centre = (0.0, 0.0, e / 2)
    cylindre(m, haut, bas, Mc['rayon'], 'y', centre, Mc['segments'], 'metal')
    rp, lp = Mc['pommeau']
    cylindre(m, bas, bas + lp, rp, 'y', centre, Mc['segments'], 'metal')
    for signe in (-1, 1):
        tube(m, [(0.0, haut + 0.004, e / 2), (signe * C['ecart_haut'] / 2, haut / 2, C['rayon']),
                 (signe * C['ecart_haut'], -C['au_dessus'], C['rayon'])], C['rayon'], C['cotes'], 'cuir')
    return [objet('humanoide--rigide--symbole_de_sigmar', m, (0.0, 0.0, 0.0), D['ANGLE_LISSE'])]
