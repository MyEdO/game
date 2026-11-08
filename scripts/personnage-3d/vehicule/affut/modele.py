"""Les pièces sur l'affût de campagne (#2987) : un GLB par pièce, aux nœuds `affut`, la pièce (pivot à l'axe des
tourillons), `roue_g`, `roue_d` (meshes sans skin ni armature), l'emprise recentrée ; une clé par engin de ses
`definitions`."""
import math

import habillage
from maille import Maille, basculer_maille, boite, cylindre, lineaire, objet, plaque, poutre, recentrer, roue, tore, tour, tube


def coupe(profil, y):
    """z bas et haut du profil de flasque à l'abscisse `y`."""
    zs = []
    for (y0, z0), (y1, z1) in zip(profil, profil[1:] + profil[:1]):
        if y0 != y1 and min(y0, y1) <= y <= max(y0, y1):
            zs.append(z0 + (z1 - z0) * (y - y0) / (y1 - y0))
    return min(zs), max(zs)


def tourillons(maille, A, embase, mat):
    """Les tourillons de la pièce et leur embase (rayon, demi-longueur), sur l'axe des tourillons de l'affût `A`."""
    y, z = A["tourillons"]
    rt, lt = A["tourillon"]
    cylindre(maille, -lt, lt, rt, "x", (0, y, z), 10, mat)
    re_, le_ = embase
    cylindre(maille, -le_, le_, re_, "x", (0, y, z), 10, mat)


def anses(maille, F, z):
    """Les anses (dauphins) de bronze du fût `F` dont l'axe est à la hauteur `z`."""
    n = F["anse_segments"]
    for x, y0, y1, fleche, r in F["anses"]:
        dessus = z + F["anse_pied"]
        chemin = [(x, y0 + (y1 - y0) * (1 - math.cos(math.pi * i / n)) / 2, dessus + fleche * math.sin(math.pi * i / n)) for i in range(n + 1)]
        tube(maille, chemin, r, 6, "bronze")


def canon(D, mats):
    """Le fût de bronze du canon, ses tourillons et ses anses."""
    F, A = D["CANON"], D["AFFUT"]
    fut = Maille([mats["bronze"]])
    y, z = A["tourillons"]
    tour(fut, F["profil"], "y", (0.0, 0.0, z), F["segments"], "bronze")
    tourillons(fut, A, F["embase"], "bronze")
    anses(fut, F, z)
    return "fut", fut


def mortier(D, mats):
    """Le fût de bronze du mortier, ses tourillons et ses anses, levé de son élévation."""
    F, A = D["MORTIER"], D["AFFUT"]
    fut = Maille([mats["bronze"]])
    y, z = A["tourillons"]
    tour(fut, F["profil"], "y", (0.0, y, z), F["segments"], "bronze")
    tourillons(fut, A, F["embase"], "bronze")
    anses(fut, F, z)
    basculer_maille(fut, (y, z), F["elevation"])
    return "fut", fut


def affut_et_roues(D, mats):
    """L'affût (flasques ferrés, entretoises, coin de mire, essieu, sabot, mascarons) et ses deux roues."""
    bronze, bois, fer = mats["bronze"], mats["bois"], mats["fer"]
    A, R, zE = D["AFFUT"], D["ROUE"], D["ESSIEU_Z"]
    roues = {nom: (roue(R, signe * R["voie"], zE, signe, bois, fer), (signe * R["voie"], 0.0, zE))
             for nom, signe in (("roue_g", 1), ("roue_d", -1))}
    affut = Maille([bois, fer, bronze])
    profil, table, ep = A["flasque"], A["flasque_x"], A["flasque_epaisseur"]
    for signe in (1, -1):
        plaque(affut, [(signe * lineaire(table, y), y, z) for y, z in profil], ep, "bois")
        bl, bep = A["bande"]
        for y in A["bandes"]:
            bas, haut = coupe(profil, y)
            cx = signe * lineaire(table, y)
            boite(affut, (cx - ep / 2 - bep, y - bl / 2, bas - bep), (cx + ep / 2 + bep, y + bl / 2, haut + bep), "fer")
        sl, sep, sw = A["sus_bande"]
        cx = signe * lineaire(table, 0.0)
        boite(affut, (cx - ep / 2 - sw / 2, -sl / 2, coupe(profil, 0.0)[1] - 0.05), (cx + ep / 2 + sw / 2, sl / 2, A["tourillons"][1] + A["tourillon"][0] + sep), "fer")
        rm_, saillie, ra, rs = A["mascaron"]
        for y, z in A["mascarons"]:
            xf = signe * (lineaire(table, y) + ep / 2)
            a, b = sorted((xf - signe * 0.005, xf + signe * saillie))
            tour(affut, [(a, 0), (a, rm_), (b, rm_ * 0.75), (b, 0)], "x", (0, y, z), 10, "bronze")
            tore(affut, "x", (xf + signe * rs, y, z - ra), ra, rs, 10, 4, "bronze")
    for y, z0, z1, prof in A["entretoises"]:
        demi = lineaire(table, y)
        boite(affut, (-demi, y - prof / 2, z0), (demi, y + prof / 2, z1), "bois")
    y, z0, z1, larg, prof = A["coin"]
    boite(affut, (-larg / 2, y - prof / 2, z0), (larg / 2, y + prof / 2, z1), "bois")
    demi, z0, z1, prof = A["corps_essieu"]
    boite(affut, (-demi, -prof / 2, z0), (demi, prof / 2, z1), "bois")
    rf, lf = A["fusee"]
    cylindre(affut, -lf, lf, rf, "x", (0, 0, zE), 8, "fer")
    y0, y1, sep = A["sabot"]
    demi = lineaire(table, y1) + ep / 2 + 0.01
    boite(affut, (-demi, y0, 0.0), (demi, y1, sep), "fer")
    return affut, roues


def construire(D, materiaux, piece):
    """La pièce `piece(D, mats)` → (nom, maille) sur l'affût et ses roues, l'emprise recentrée en x et y (le sol reste
    z = 0) ; la pièce pivote à l'axe des tourillons."""
    mats = habillage.materiaux(materiaux)
    nom, maille = piece(D, mats)
    affut, roues = affut_et_roues(D, mats)
    dx, dy = recentrer([maille, affut] + [r for r, _ in roues.values()])
    ty, tz = D["AFFUT"]["tourillons"]
    objet("affut", affut, (0.0, 0.0, 0.0), 35)
    objet(nom, maille, (dx, ty + dy, tz), 35)
    for nom_roue, (r, c) in roues.items():
        objet(nom_roue, r, (c[0] + dx, c[1] + dy, c[2]), 35)
    return {}


def feu_d_enfer(D, mats):
    """Le barillet du canon à répétition feu d'enfer : trois rangées de trois canons serrées de frettes autour de
    l'arbre, le tambour des tourillons et la manivelle circulaire."""
    F, A = D["FEU_D_ENFER"], D["AFFUT"]
    barillet = Maille([mats["bronze"], mats["fer"]])
    y, z = A["tourillons"]
    rb = F["rangee_rayon"]
    longueur, epaisseur = F["frette"]
    for angle in F["rangees"]:
        c, s = math.cos(math.radians(angle)), math.sin(math.radians(angle))
        for t in F["canons_t"]:
            tour(barillet, F["profil"], "y", (rb * c - t * s, 0.0, z + rb * s + t * c), F["segments"], "bronze")
        for fy, largeur in F["frettes"]:
            centre = (rb * c, fy, z + rb * s)
            a_ = (centre[0] + longueur / 2 * s, fy, centre[2] - longueur / 2 * c)
            b_ = (centre[0] - longueur / 2 * s, fy, centre[2] + longueur / 2 * c)
            poutre(barillet, a_, b_, largeur, epaisseur, (c, 0, s), "fer")
    rt, lt = F["tambour"]
    cylindre(barillet, -lt / 2, lt / 2, rt, "y", (0.0, y, z), 16, "fer")
    tourillons(barillet, A, F["embase"], "fer")
    ra, a0, a1 = F["arbre"]
    cylindre(barillet, a0, a1, ra, "y", (0.0, 0.0, z), 10, "fer")
    vy, vr, vs, n, rayons = F["volant"]
    tore(barillet, "y", (0.0, vy, z), vr, vs, n, 6, "fer")
    for k in range(rayons):
        t = 2 * math.pi * k / rayons
        tube(barillet, [(0.0, vy, z), (vr * math.cos(t), vy, z + vr * math.sin(t))], vs * 0.8, 6, "fer")
    pr, pl = F["poignee"]
    cylindre(barillet, vy, vy + pl, pr, "y", (vr, 0.0, z), 8, "fer")
    return "barillet", barillet


def batterie(D, mats):
    """Le cadre de la batterie tonnerre de feu : neuf fusées en trois rangées sur les barreaux de ses échelles, levé de
    son élévation."""
    B, A = D["BATTERIE"], D["AFFUT"]
    cadre = Maille([mats["bois"], mats["fer"], mats["pointe"]])
    y, z = A["tourillons"]
    demi, av, ar = B["cadre"]
    bas, haut = z + B["etageres_z"][0], z + B["haut"]
    boite(cadre, (-demi, av, bas), (demi, ar, bas + B["fond"]), "bois")
    prof, ep, montant = B["traverse"]
    for ty in B["traverses_y"]:
        for signe in (1, -1):
            a, b = sorted((signe * demi, signe * (demi - montant)))
            boite(cadre, (a, ty - prof / 2, bas), (b, ty + prof / 2, haut), "bois")
        for pz in B["etageres_z"][1:]:
            boite(cadre, (-demi, ty - prof / 2, z + pz), (demi, ty + prof / 2, z + pz + ep), "fer")
    lg = B["longeron"]
    for signe in (1, -1):
        a, b = sorted((signe * demi, signe * (demi - lg)))
        boite(cadre, (a, av, haut - lg), (b, ar, haut), "bois")
    r, culot, ogive, pointe = B["fusee"]
    for k, pz in enumerate(B["etageres_z"]):
        for cx in B["fusees_x"]:
            centre = (cx, 0.0, z + pz + (B["fond"] if k == 0 else ep) + r)
            cylindre(cadre, culot, ogive, r, "y", centre, B["segments"], "fer")
            tour(cadre, [(ogive, 0), (ogive, r), (pointe, 0)], "y", centre, B["segments"], "pointe")
    tourillons(cadre, A, B["embase"], "fer")
    basculer_maille(cadre, (y, z), B["elevation"])
    return "cadre", cadre


def flammes(D, mats):
    """Le canon à flammes nain : réservoir cerclé sur les tourillons, lance à buse évasée, manomètre, vanne et tuyau."""
    F, A = D["FLAMMES"], D["AFFUT"]
    fut = Maille([mats["cuivre"], mats["fer"]])
    y, z = A["tourillons"]
    s = F["segments"]
    tour(fut, F["reservoir"], "y", (0.0, 0.0, z), s, "cuivre")
    rayon = max(r for _, r in F["reservoir"])
    for cy in F["cercles_y"]:
        tore(fut, "y", (0.0, cy, z), rayon, F["cercle"], s, 6, "fer")
    tour(fut, F["lance"], "y", (0.0, 0.0, z), s, "fer")
    tourillons(fut, A, F["embase"], "fer")
    my, mr, m0, m1 = F["manometre"]
    cylindre(fut, m0, m1, mr, "z", (0.0, my, z), 12, "cuivre")
    vy, vt, v0, v1, vr, vs = F["vanne"]
    cylindre(fut, v0, v1, vt, "z", (0.0, vy, z), 8, "fer")
    tore(fut, "z", (0.0, vy, z + v1), vr, vs, 16, 6, "fer")
    chemin, tr = F["tuyau"]
    tube(fut, [(x, cy, z + cz) for x, cy, cz in chemin], tr, 8, "cuivre")
    return "fut", fut


PIECES = (("canon", "CANON", canon), ("mortier", "MORTIER", mortier), ("feu-d-enfer", "FEU_D_ENFER", feu_d_enfer), ("batterie", "BATTERIE", batterie),
          ("canon-a-flammes", "FLAMMES", flammes))


def elements(D):
    return habillage.pieces(D, PIECES, construire)
