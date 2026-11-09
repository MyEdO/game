"""Géométrie de `humanoide--rigide--etui_a_parchemin` : une liasse de rouleaux de parchemin serrés par deux sangles,
inclinée le haut vers l'avant, une patte d'attache, une chaîne qui pend en boucle sous elle, le bas écarté du corps, dans le repère de la prise (+Y vers le bas
une fois rangée, +Z sortant)."""
import math

from mathutils import Vector

from maille import Maille, basculer_maille, cylindre, objet, poutre, tour


def incliner(m, yc, angle):
    """Tourne les sommets de `m` autour de l'axe z passant par (0, `yc`) : le haut (-y) part vers +x."""
    c, s = math.cos(math.radians(angle)), math.sin(math.radians(angle))
    m.v = [(x * c - (y - yc) * s, yc + x * s + (y - yc) * c, z) for x, y, z in m.v]


def maillon(m, centre, tangente, normale, R, r, n, k, mat):
    """Anneau de rayon `R` et de section `r`, centré sur `centre`, dans le plan de `tangente` et normal à `normale`."""
    e1 = tangente
    e2 = normale.cross(tangente)
    sommets = []
    for i in range(n):
        t = 2 * math.pi * i / n
        radial = e1 * math.cos(t) + e2 * math.sin(t)
        for j in range(k):
            s = 2 * math.pi * j / k
            sommets.append(tuple(centre + radial * (R + r * math.cos(s)) + normale * (r * math.sin(s))))
    faces = [[i * k + j, ((i + 1) % n) * k + j, ((i + 1) % n) * k + (j + 1) % k, i * k + (j + 1) % k]
             for i in range(n) for j in range(k)]
    m.ajouter(sommets, faces, mat)


def chaine(m, C):
    a, b, c = (Vector(C[p]) for p in ('depart', 'controle', 'arrivee'))
    courbe = [a * (1 - t) ** 2 + b * 2 * t * (1 - t) + c * t ** 2 for t in (i / 200 for i in range(201))]
    poses, reste = [courbe[0]], 0.0
    for p, q in zip(courbe, courbe[1:]):
        reste += (q - p).length
        if reste >= C['pas']:
            poses.append(q)
            reste = 0.0
    plan = Vector((0, 0, 1))
    for i, p in enumerate(poses):
        suivant = poses[min(i + 1, len(poses) - 1)] - poses[max(i - 1, 0)]
        d = suivant.normalized()
        normale = plan if i % 2 == 0 else d.cross(plan).normalized()
        maillon(m, p, d, normale, C['maillon'], C['section'], C['segments'], C['cotes'], 'metal')


def construire(D, materiaux):
    m = Maille(list(materiaux.values()))
    yc = D['CENTRE']
    for u, w, r, longueur, decalage in D['ROULEAUX']:
        a = yc + decalage
        cylindre(m, a - longueur / 2, a + longueur / 2, r, 'y', (u, 0.0, w), D['SEGMENTS_ROULEAU'], 'parchemin')
    S = D['SANGLES']
    su, sw = S['centre']
    for p in S['positions']:
        a0, a1 = yc + p - S['largeur'] / 2, yc + p + S['largeur'] / 2
        r0, r1 = S['rayon'], S['rayon'] + S['epaisseur']
        tour(m, [(a0, r0), (a1, r0), (a1, r1), (a0, r1)], 'y', (su, 0.0, sw), S['segments'], 'cuir', ferme=True)
    incliner(m, yc, D['INCLINAISON'])
    A = D['ATTACHE']
    poutre(m, (0.0, A['depuis'], A['epaisseur'] / 2), (0.0, -A['au_dessus'], A['epaisseur'] / 2), A['largeur'],
           A['epaisseur'], (0, 0, 1), 'cuir')
    chaine(m, D['CHAINE'])
    basculer_maille(m, (0.0, 0.0), -D['ECART'])
    return [objet('humanoide--rigide--etui_a_parchemin', m, (0.0, 0.0, 0.0), D['ANGLE_LISSE'])]
