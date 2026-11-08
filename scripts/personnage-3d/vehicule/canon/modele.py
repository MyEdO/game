"""Le canon de campagne (#2987 lot V3) : les nœuds `affut`, `fut`, `roue_g`, `roue_d` (meshes sans skin ni armature),
l'emprise recentrée ; un GLB pour les trois clés de `DEFINITIONS`."""
import math

from mathutils import Vector

import habillage
from maille import Maille, lineaire, objet, poutre


def tour(maille, profil, axe, centre, segments, mats, ferme=False):
    """Révolution du profil [(a, r)] autour de l'axe 'x' ou 'y' passant par `centre` ; r = 0 ferme sur l'axe.
    `mats` : un matériau, ou un par tronçon du profil. `ferme` : profil en boucle (anneau)."""
    mats = mats if isinstance(mats, list) else [mats] * len(profil)
    anneaux = []
    sommets = []
    for a, r in profil:
        if r == 0:
            anneaux.append([len(sommets)])
            sommets.append(point(axe, centre, a, 0, 0))
        else:
            debut = len(sommets)
            for k in range(segments):
                t = 2 * math.pi * k / segments
                sommets.append(point(axe, centre, a, r * math.cos(t), r * math.sin(t)))
            anneaux.append(list(range(debut, debut + segments)))
    paires = list(zip(range(len(profil) - 1), range(1, len(profil))))
    if ferme:
        paires.append((len(profil) - 1, 0))
    faces_par_mat = {}
    for i, j in paires:
        a, b = anneaux[i], anneaux[j]
        faces = faces_par_mat.setdefault(mats[i], [])
        for k in range(segments):
            k2 = (k + 1) % segments
            if len(a) == 1:
                faces.append([a[0], b[k], b[k2]])
            elif len(b) == 1:
                faces.append([a[k], b[0], a[k2]])
            else:
                faces.append([a[k], a[k2], b[k2], b[k]])
    for mat, faces in faces_par_mat.items():
        utilises = sorted({i for face in faces for i in face})
        renum = {i: n for n, i in enumerate(utilises)}
        maille.ajouter([sommets[i] for i in utilises], [[renum[i] for i in face] for face in faces], mat)


def point(axe, centre, a, u, w):
    cx, cy, cz = centre
    if axe == "y":
        return (cx + u, cy + a, cz + w)
    return (cx + a, cy + u, cz + w)


def boite(maille, mini, maxi, mat):
    (x0, y0, z0), (x1, y1, z1) = mini, maxi
    sommets = [(x, y, z) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)]
    faces = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]
    maille.ajouter(sommets, faces, mat)


def tube(maille, chemin, rayon, cotes, mat):
    """Tube fermé de section polygonale le long de `chemin` (points), repère par transport du vecteur x."""
    pts = [Vector(p) for p in chemin]
    sommets, faces = [], []
    for i, p in enumerate(pts):
        d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        e1 = Vector((1, 0, 0))
        e1 = (e1 - d * e1.dot(d)).normalized()
        e2 = d.cross(e1)
        for k in range(cotes):
            t = 2 * math.pi * k / cotes
            sommets.append(tuple(p + (e1 * math.cos(t) + e2 * math.sin(t)) * rayon))
    for i in range(len(pts) - 1):
        for k in range(cotes):
            k2 = (k + 1) % cotes
            faces.append([i * cotes + k, i * cotes + k2, (i + 1) * cotes + k2, (i + 1) * cotes + k])
    faces.append(list(range(cotes))[::-1])
    faces.append([(len(pts) - 1) * cotes + k for k in range(cotes)])
    maille.ajouter(sommets, faces, mat)


def tore_x(maille, centre, grand, petit, n_grand, n_petit, mat):
    """Tore d'axe x (anneau plaqué contre une face de normale x)."""
    cx, cy, cz = centre
    sommets, faces = [], []
    for i in range(n_grand):
        t = 2 * math.pi * i / n_grand
        for j in range(n_petit):
            s = 2 * math.pi * j / n_petit
            r = grand + petit * math.cos(s)
            sommets.append((cx + petit * math.sin(s), cy + r * math.cos(t), cz + r * math.sin(t)))
    for i in range(n_grand):
        for j in range(n_petit):
            i2, j2 = (i + 1) % n_grand, (j + 1) % n_petit
            faces.append([i * n_petit + j, i2 * n_petit + j, i2 * n_petit + j2, i * n_petit + j2])
    maille.ajouter(sommets, faces, mat)


def coupe(profil, y):
    """z bas et haut du profil de flasque à l'abscisse `y`."""
    zs = []
    for (y0, z0), (y1, z1) in zip(profil, profil[1:] + profil[:1]):
        if y0 != y1 and min(y0, y1) <= y <= max(y0, y1):
            zs.append(z0 + (z1 - z0) * (y - y0) / (y1 - y0))
    return min(zs), max(zs)


def construire(D):
    mats = habillage.materiaux(D["MATERIAUX"])
    bronze, bois, fer = mats["bronze"], mats["bois"], mats["fer"]
    F, A, R, zE = D["FUT"], D["AFFUT"], D["ROUE"], D["ESSIEU_Z"]

    # fût : bronze, tourillons, anses ; pivot à l'axe des tourillons
    fut = Maille([bronze])
    axe = (0.0, 0.0, F["axe_z"])
    tour(fut, F["profil"], "y", axe, F["segments"], "bronze")
    rt, lt = F["tourillon"]
    tour(fut, [(-lt, 0), (-lt, rt), (lt, rt), (lt, 0)], "x", (0, F["tourillon_y"], F["axe_z"]), 10, "bronze")
    re_, le_ = F["embase"]
    tour(fut, [(-le_, 0), (-le_, re_), (le_, re_), (le_, 0)], "x", (0, F["tourillon_y"], F["axe_z"]), 10, "bronze")
    n = F["anse_segments"]
    for x, y0, y1, fleche, r in F["anses"]:
        dessus = F["axe_z"] + F["anse_pied"]
        chemin = [(x, y0 + (y1 - y0) * (1 - math.cos(math.pi * i / n)) / 2, dessus + fleche * math.sin(math.pi * i / n)) for i in range(n + 1)]
        tube(fut, chemin, r, 6, "bronze")

    # roues : bois et fer ; pivot à l'essieu
    roues = {}
    for nom, signe in (("roue_g", 1), ("roue_d", -1)):
        roue = Maille([bois, fer])
        c = (signe * R["voie"], 0.0, zE)
        s = R["segments"]
        ri, ro, w = R["bandage"]
        tour(roue, [(c[0] - w / 2, ri), (c[0] + w / 2, ri), (c[0] + w / 2, ro), (c[0] - w / 2, ro)], "x", (0, 0, zE), s, "fer", ferme=True)
        ri, ro, w = R["jante"]
        tour(roue, [(c[0] - w / 2, ri), (c[0] + w / 2, ri), (c[0] + w / 2, ro), (c[0] - w / 2, ro)], "x", (0, 0, zE), s, "bois", ferme=True)
        rm, xi, xo = R["moyeu"]
        a, b = sorted((c[0] + signe * xi, c[0] + signe * xo))
        tour(roue, [(a, 0), (a, rm), (b, rm), (b, 0)], "x", (0, 0, zE), R["segments_moyeu"], "bois")
        for (rf, f0, f1) in (R["chapeau"], R["frette"]):
            a, b = sorted((c[0] + signe * f0, c[0] + signe * f1))
            tour(roue, [(a, 0), (a, rf), (b, rf), (b, 0)], "x", (0, 0, zE), R["segments_moyeu"], "fer")
        largeur, epaisseur = R["rayon_section"]
        for k in range(R["rayons"]):
            t = 2 * math.pi * (k + 0.5) / R["rayons"]
            d = (0, math.cos(t), math.sin(t))
            poutre(roue, (c[0], rm * 0.9 * d[1], zE + rm * 0.9 * d[2]), (c[0], (R["jante"][0] + 0.02) * d[1], zE + (R["jante"][0] + 0.02) * d[2]), largeur, epaisseur, (1, 0, 0), "bois")
        roues[nom] = (roue, c)

    # affût : flasques ferrés, entretoises, coin de mire, essieu, sabot, mascarons
    affut = Maille([bois, fer, bronze])
    profil, table, ep = A["flasque"], A["flasque_x"], A["flasque_epaisseur"]
    for signe in (1, -1):
        sommets = []
        for y, z in profil:
            cx = signe * lineaire(table, y)
            sommets.append((cx - ep / 2, y, z))
        for y, z in profil:
            cx = signe * lineaire(table, y)
            sommets.append((cx + ep / 2, y, z))
        k = len(profil)
        faces = [list(range(k)), list(range(2 * k - 1, k - 1, -1))]
        faces += [[i, (i + 1) % k, k + (i + 1) % k, k + i] for i in range(k)]
        affut.ajouter(sommets, faces, "bois")
        bl, bep = A["bande"]
        for y in A["bandes"]:
            bas, haut = coupe(profil, y)
            cx = signe * lineaire(table, y)
            boite(affut, (cx - ep / 2 - bep, y - bl / 2, bas - bep), (cx + ep / 2 + bep, y + bl / 2, haut + bep), "fer")
        sl, sep, sw = A["sus_bande"]
        cx = signe * lineaire(table, 0.0)
        boite(affut, (cx - ep / 2 - sw / 2, -sl / 2, coupe(profil, 0.0)[1] - 0.05), (cx + ep / 2 + sw / 2, sl / 2, F["axe_z"] + F["tourillon"][0] + sep), "fer")
        rm_, saillie, ra, rs = A["mascaron"]
        for y, z in A["mascarons"]:
            xf = signe * (lineaire(table, y) + ep / 2)
            a, b = sorted((xf - signe * 0.005, xf + signe * saillie))
            tour(affut, [(a, 0), (a, rm_), (b, rm_ * 0.75), (b, 0)], "x", (0, y, z), 10, "bronze")
            tore_x(affut, (xf + signe * rs, y, z - ra), ra, rs, 10, 4, "bronze")
    for y, z0, z1, prof in A["entretoises"]:
        demi = lineaire(table, y)
        boite(affut, (-demi, y - prof / 2, z0), (demi, y + prof / 2, z1), "bois")
    y, z0, z1, larg, prof = A["coin"]
    boite(affut, (-larg / 2, y - prof / 2, z0), (larg / 2, y + prof / 2, z1), "bois")
    demi, z0, z1, prof = A["corps_essieu"]
    boite(affut, (-demi, -prof / 2, z0), (demi, prof / 2, z1), "bois")
    rf, lf = A["fusee"]
    tour(affut, [(-lf, 0), (-lf, rf), (lf, rf), (lf, 0)], "x", (0, 0, zE), 8, "fer")
    y0, y1, sep = A["sabot"]
    demi = lineaire(table, y1) + ep / 2 + 0.01
    boite(affut, (-demi, y0, 0.0), (demi, y1, sep), "fer")

    # emprise recentrée en x et y ; le sol reste z = 0
    toutes = fut.v + affut.v + [p for roue, _ in roues.values() for p in roue.v]
    dx = -(min(p[0] for p in toutes) + max(p[0] for p in toutes)) / 2
    dy = -(min(p[1] for p in toutes) + max(p[1] for p in toutes)) / 2
    for m in [fut, affut] + [roue for roue, _ in roues.values()]:
        m.v = [(x + dx, y + dy, z) for x, y, z in m.v]
    objet("affut", affut, (0.0, 0.0, 0.0), 35)
    objet("fut", fut, (dx, F["tourillon_y"] + dy, F["axe_z"]), 35)
    for nom, (roue, c) in roues.items():
        objet(nom, roue, (c[0] + dx, c[1] + dy, c[2]), 35)
    return {}


def elements(D):
    yield {"glb": "canon", "cles": [("vehicule", {"definition": d}) for d in D["DEFINITIONS"]],
           "materiaux": D["MATERIAUX"], "blasons": (), "construire": lambda: construire(D)}
