"""Pièces des Améliorations navales (#2987, catégorie `amelioration`) : une scène par Amélioration, en mètres, bâtie
sur la coque de la caraque (`modele.py`, sa forme `Coque` calée sur ses ponts) et ses données.

Repère de chaque pièce : celui de `maille.py`, l'avant du navire vers -y. Origine :
- montée aux postes (Sabord) : l'origine de la pièce montée au poste, le pied de son affût, l'extérieur vers -y ;
- montée aux ancrages : le point d'ancrage du manifeste du navire.
"""
import math

from mathutils import Matrix, Vector

import habillage
from caraque import modele as K
from maille import Maille, lineaire, objet, poutre


def sabord(D):
    """Trappe de Sabord, charnière en haut de l'ouverture, devant le cadre de la coque (nœud `avec-sabord`) : `ferme`
    plaquée sur le cadre, `ouvert` relevée vers l'extérieur ; la même sur chaque bord, que l'hôte tourne vers lui."""
    mats = habillage.materiaux(D["MATERIAUX_DES_AMELIORATIONS"])
    E, CA = D["EMBRASURE"], D["CANON"]
    lo, ho = E["ouverture"]
    cadre, saillie = E["cadre"]
    mur = CA["bouche"] - CA["saillie"]            # du pied de la pièce à la face du mur, vers -y
    zc = CA["axe"]
    for nom, angle in (("ferme", 0.0), ("ouvert", 70.0)):
        m = Maille(list(mats.values()))
        charniere = Vector((0, -(mur + saillie + 0.04), zc + ho / 2 + cadre))
        rot = Matrix.Rotation(math.radians(-angle), 4, "X")
        def p(v):  # noqa: E306
            return charniere + rot @ (Vector(v))
        larg, haut, ep = lo + 2 * cadre, ho + 2 * cadre, 0.07
        # panneau, du gond vers le bas, épaisseur vers l'extérieur (-y)
        a, b = p((0, -ep / 2, 0)), p((0, -ep / 2, -haut))
        poutre(m, a, b, larg, ep, (0, 1, 0) if angle == 0 else tuple(rot @ Vector((0, 1, 0))), "bois")
        for t in (0.2, 0.8):   # pentures de fer
            a, b = p((-larg / 2 + 0.05, -ep - 0.012, -haut * t)), p((larg / 2 - 0.05, -ep - 0.012, -haut * t))
            poutre(m, a, b, 0.06, 0.02, tuple(rot @ Vector((0, 1, 0))), "fer")
        objet(nom, m, (0, 0, 0), 35)
    return {"montage": "postes"}


def figure_de_proue(D):
    """Figure de proue : sirène sculptée et peinte, penchée vers l'avant sous le beaupré, sa queue dorée sur l'étrave."""
    mats = habillage.materiaux(D["MATERIAUX_DES_AMELIORATIONS"])
    m = Maille(list(mats.values()))
    incl = math.radians(35)
    axe = Vector((0, -math.sin(incl), math.cos(incl)))   # du bas (sur l'étrave) vers la tête, penché vers l'avant
    pied = Vector((0, 0.35, -0.9))
    K.fuseau(m, pied, pied + axe * 1.2, [(0, 0), (0, 0.10), (0.3, 0.22), (0.7, 0.26), (1, 0.18), (1, 0)], 10, "dorure")
    buste = pied + axe * 1.2
    K.fuseau(m, buste, buste + axe * 0.75, [(0, 0), (0, 0.19), (0.4, 0.25), (0.8, 0.2), (1, 0.12), (1, 0)], 10, "peinture")
    tete = buste + axe * 0.95
    K.fuseau(m, tete - axe * 0.18, tete + axe * 0.2, [(0, 0), (0.05, 0.12), (0.5, 0.17), (0.95, 0.12), (1, 0)], 10, "chair")
    for s in (1, -1):   # bras croisés vers l'arrière, mains jointes
        epaule = buste + axe * 0.62 + Vector((s * 0.24, 0, 0))
        K.espar(m, epaule, epaule + Vector((s * 0.05, 0.25, -0.35)), 0.07, 0.055, 6, "chair")
    for s in (1, -1):   # nageoire caudale contre l'étrave
        poutre(m, pied, pied + Vector((s * 0.35, 0.15, -0.4)), 0.25, 0.05, (0, 1, 0), "dorure")
    objet("figure", m, (0, 0, 0), 35)
    return {"montage": "ancrages"}


def ancre(D):
    """Ancre à jas, suspendue par son organeau à l'ancrage, pattes vers le bas."""
    mats = habillage.materiaux(D["MATERIAUX_DES_AMELIORATIONS"])
    m = Maille(list(mats.values()))
    haut, bas = Vector((0, 0, -0.25)), Vector((0, 0, -2.3))
    K.fuseau(m, Vector((0, 0, 0.0)), Vector((0, 0, -0.25)), [(0, 0), (0, 0.12), (1, 0.12), (1, 0)], 8, "fer")  # organeau
    K.espar(m, haut, bas, 0.09, 0.11, 8, "fer")                                        # verge
    poutre(m, Vector((-0.9, 0, -0.45)), Vector((0.9, 0, -0.45)), 0.16, 0.16, (0, 1, 0), "bois")   # jas, en travers
    for s in (1, -1):   # bras en arc et pattes, dans le plan y
        coude = bas + Vector((0, s * 0.55, 0.25))
        K.espar(m, bas, coude, 0.10, 0.08, 6, "fer")
        bout = coude + Vector((0, s * 0.25, 0.45))
        K.espar(m, coude, bout, 0.08, 0.04, 6, "fer")
        poutre(m, coude + Vector((0, s * 0.05, 0.05)), bout - Vector((0, 0, 0.05)), 0.28, 0.03, (0, 1, 0), "fer")
    objet("ancre", m, (0, 0, 0), 35)
    return {"montage": "ancrages"}


def loft(maille, sections, mat):
    """Volume fermé par des sections [(y, [(x, z), …])] de même nombre de points, bouts fermés en éventail."""
    sommets, rangs = [], []
    for yy, pts in sections:
        debut = len(sommets)
        sommets.extend((x, yy, z) for x, z in pts)
        rangs.append(list(range(debut, debut + len(pts))))
    n = len(sections[0][1])
    faces = [[a[k], a[(k + 1) % n], b[(k + 1) % n], b[k]] for a, b in zip(rangs, rangs[1:]) for k in range(n)]
    for rang, (yy, pts) in ((rangs[0], sections[0]), (rangs[-1], sections[-1])):
        centre = len(sommets)
        sommets.append((sum(x for x, _ in pts) / n, yy, sum(z for _, z in pts) / n))
        faces.extend([[rang[k], rang[(k + 1) % n], centre] for k in range(n)])
    maille.ajouter(sommets, faces, mat)


def octogone(largeur, hauteur, z=0.0, crete=0.0):
    """Section octogonale `largeur` × `hauteur` centrée en z, son sommet relevé de `crete` (arête du dessus)."""
    l, h = largeur / 2, hauteur / 2
    return [(l, z - h * 0.4), (l, z + h * 0.4), (l * 0.45, z + h), (0, z + h + crete), (-l * 0.45, z + h),
            (-l, z + h * 0.4), (-l, z - h * 0.4), (0, z - h)]


def belier(D):
    """Bélier : lourd éperon de bronze qui prolonge l'étrave à la flottaison, arête vive dessus, coiffe remontant sur
    l'étrave jusque sous la figure de proue, encastré dans le bordé à l'arrière."""
    mats = habillage.materiaux(D["MATERIAUX_DES_AMELIORATIONS"])
    m = Maille(list(mats.values()))
    loft(m, [(1.2, octogone(1.1, 1.7, 0.0, 0.0)), (0.2, octogone(1.0, 1.5, 0.0, 0.12)), (-1.2, octogone(0.75, 0.95, -0.05, 0.22)),
             (-2.6, octogone(0.42, 0.5, -0.1, 0.12)), (-3.4, octogone(0.14, 0.2, -0.12, 0.02))], "bronze")
    for t in (0.0, -0.9):   # colliers
        loft(m, [(t + 0.12, octogone(1.16, 1.62, -0.02, 0.1)), (t - 0.12, octogone(1.1, 1.5, -0.03, 0.12))], "bronze")
    poutre(m, Vector((0, 0.15, 0.55)), Vector((0, -0.45, 1.1)), 0.55, 0.12, (0, -1, 0.4), "bronze")   # coiffe d'étrave, sous la figure
    objet("belier", m, (0, 0, 0), 35)
    return {"montage": "ancrages"}


def nid_de_pie(D):
    """Nid-de-pie : la hune de l'illustration, panier rond au sommet du grand mât ; son pied à l'ancrage."""
    mats = habillage.materiaux(D["MATERIAUX_DES_AMELIORATIONS"])
    m = Maille(list(mats.values()))
    hune = D["HUNE"]
    z0, z1 = hune[0][0], max(z for z, _ in hune)
    K.fuseau(m, (0, 0, 0), (0, 0, z1 - z0), [((z - z0) / (z1 - z0), r) for z, r in hune], D["COTES_HUNE"], "bois")
    objet("hune", m, (0, 0, 0), 35)
    return {"montage": "ancrages"}


def embarcation(D):
    """Embarcation de bord : canot de 5 m sur ses chantiers, au milieu du pont principal."""
    mats = habillage.materiaux(D["MATERIAUX_DES_AMELIORATIONS"])
    m = Maille(list(mats.values()))
    L, demi, creux = 5.0, 0.85, 0.7
    stations = [i / 8 for i in range(9)]
    def largeur(t):  # noqa: E306
        return demi * math.sin(math.pi * t) ** 0.6
    z_fond = 1.55
    anneaux = []
    for zz, k in ((z_fond, 0.35), (z_fond + creux * 0.5, 0.85), (z_fond + creux, 1.0)):
        anneaux.append([(largeur(t) * k, (t - 0.5) * L, zz) for t in stations])
    K.enceinte(m, anneaux, True, (0.06, 0.08), lambda yy: z_fond + 0.15, "bois")
    for t in (0.3, 0.55, 0.8):   # bancs
        poutre(m, (-largeur(t) * 0.92, (t - 0.5) * L, z_fond + creux * 0.6), (largeur(t) * 0.92, (t - 0.5) * L, z_fond + creux * 0.6), 0.25, 0.05, (0, 0, 1), "bois")
    for y0 in (-1.4, 1.4):         # chantiers sur le pont
        poutre(m, (-0.9, y0, z_fond / 2), (0.9, y0, z_fond / 2), 0.3, z_fond, (0, 0, 1), "bois")
    for s in (1, -1):              # avirons rangés
        K.espar(m, (s * 0.35, -2.0, z_fond + creux * 0.7), (s * 0.35, 2.0, z_fond + creux * 0.7), 0.04, 0.03, 6, "bois")
    objet("canot", m, (0, 0, 0), 35)
    return {"montage": "ancrages"}


def ralentisseurs(D):
    """Ralentisseur latéral : aileron de bois en éventail, replié le long du flanc, son pivot sur un axe ferré à la
    préceinte qui l'écarte du bordé et du blindage."""
    mats = habillage.materiaux(D["MATERIAUX_DES_AMELIORATIONS"])
    m = Maille(list(mats.values()))
    rangs = [[(0, -0.6, 0.3), (0, 0.6, 0.3)], [(0, -0.9, -1.2), (0, 0.9, -1.2)], [(0, -0.8, -2.4), (0, 0.8, -2.4)]]
    for (a, b), (c, d) in zip(rangs, rangs[1:]):
        for x in (-0.06, 0.06):
            K.nappe(m, [[(x, *a[1:]), (x, *b[1:])], [(x, *c[1:]), (x, *d[1:])]], "bois")
    poutre(m, (0, -0.95, -1.2), (0, 0.95, -1.2), 0.12, 0.16, (0, 0, 1), "fer")
    K.fuseau(m, (-0.4, 0, 0.3), (0.4, 0, 0.3), [(0, 0), (0, 0.12), (1, 0.12), (1, 0)], 8, "fer")   # axe, du bordé au pivot
    for x in (-0.4, 0.4):   # ferrures sur la préceinte
        poutre(m, (x, -0.25, 0.3), (x, 0.25, 0.3), 0.3, 0.08, (1, 0, 0), "fer")
    objet("aileron", m, (0, 0, 0), 35)
    return {"montage": "ancrages"}


def triangle_raye(m, amure, tete, ecoute, creux, rayures, ns=6, nt=4):
    """Voile triangulaire rayée parallèlement à sa chute (tête → écoute), gonflée vers +x de `creux`."""
    xs, mats = K.grille_rayee(ns, rayures)
    rangs = []
    for j in range(nt + 1):
        t = j / nt
        rang = []
        for s_ in xs:
            haut, bas = amure + (tete - amure) * s_, amure + (ecoute - amure) * s_
            p = haut + (bas - haut) * t
            rang.append(tuple(p + Vector((creux * math.sin(math.pi * s_) * math.sin(math.pi * max(t, 0.15)), 0, 0))))
        rangs.append(rang)
    K.nappe(m, rangs, None, mats)


def clinfoc(D, C):
    """Clinfoc : foc triangulaire rayé sur l'étai de misaine, son point d'amure au bout du beaupré (l'ancrage)."""
    mats = habillage.materiaux(D["MATERIAUX_DES_AMELIORATIONS"])
    m = Maille(list(mats.values()))
    (fa, za), (fb, zb) = D["ETAIS"][1]
    etai = Vector((0, C.y(fa) - C.y(fb), za - zb))
    amure = etai * 0.04
    tete = etai * 0.74
    ecoute = Vector((0, 6.5, -3.5))
    triangle_raye(m, amure, tete, ecoute, 0.45, D["RAYURES"])
    K.espar(m, ecoute, ecoute + Vector((0, 0.0, -0.01)) + (amure - ecoute) * 0.02, 0.04, 0.04, 4, "bois")
    objet("foc", m, (0, 0, 0), 35)
    return {"montage": "ancrages"}


def sabords(D, C, sorte, marge):
    """Les rectangles des sabords des ponts percés dans une paroi de `sorte` (`SOUS_LES_PONTS`), cadre compris, agrandis
    de `marge` : (axe du plan le long de la muraille, de, à, z bas, z haut), dans le repère du navire, origine en y au
    milieu de la coque."""
    E = D["EMBRASURE"]
    lo, ho = E["ouverture"]
    cadre = E["cadre"][0]
    demi_l = lo / 2 + cadre + marge
    demi_h = ho / 2 + cadre + marge
    rects = []
    for centre, bord, _, s_, _ in K.sabords_des_ponts(D, C.P, C, K.Pieces(D, C.P, C)):
        if s_ != sorte:
            continue
        if bord in ("tribord", "babord"):
            yy = centre.y - C.y(0.5)
            rects.append(("y", yy - demi_l, yy + demi_l, centre.z - demi_h, centre.z + demi_h))
        else:
            rects.append(("x", centre.x - demi_l, centre.x + demi_l, centre.z - demi_h, centre.z + demi_h))
    return rects


def libre(a, b, za, zb, rects):
    """La plaque de `a` à `b` (points du plan), de za à zb, n'empiète sur aucun des `rects` (`sabords`)."""
    for axe, de, a_, z0, z1 in rects:
        k = 0 if axe == "x" else 1
        if min(a[k], b[k]) < a_ and max(a[k], b[k]) > de and za < z1 and zb > z0:
            return False
    return True


def plaques(m, p0, p1, z0, z1, n, mat, longueur=1.2, hauteur=0.62, jeu=0.04, epaisseur=0.05, decale=0.0, rects=(), sur=None):
    """Plaques d'un mur vertical de p0 à p1 (points du plan, le mur dans le plan vertical qui les joint), de z0 à z1,
    posées à plat vers la normale `n`, en rangs décalés d'une demi-plaque ; celles qui empiètent sur les sabords `rects`
    vont dans la maille `sur` (le nœud `sans-sabord`, montré quand la coque n'a pas de Sabord, qui les bouche)."""
    p0, p1, n = Vector((p0[0], p0[1], 0)), Vector((p1[0], p1[1], 0)), Vector(n).normalized()
    d = p1 - p0
    long_ = d.length
    if long_ < 0.3:
        return
    d.normalize()
    rangs = max(1, round((z1 - z0) / hauteur))
    h = (z1 - z0) / rangs
    for r in range(rangs):
        z = z0 + h * (r + 0.5)
        debut = -(longueur / 2) * ((r + decale) % 2)
        x = debut
        while x < long_:
            a, b = max(x, 0.0) + jeu / 2, min(x + longueur, long_) - jeu / 2
            if b - a > 0.2:
                cible = m if libre(p0 + d * a, p0 + d * b, z - h / 2, z + h / 2, rects) else sur
                poutre(cible, p0 + d * a + Vector((0, 0, z)) + n * epaisseur / 2, p0 + d * b + Vector((0, 0, z)) + n * epaisseur / 2,
                         h - jeu, epaisseur, n, mat)
            x += longueur


def blindage(D, C, mat):
    """Blindage : plaques de métal sur les œuvres vives et mortes, de la flottaison basse à la préceinte, des deux bords,
    épousant le bordé ; celles qui couvrent les sabords de la batterie dans le nœud `sans-sabord` ; origine à l'ancrage
    (milieu de la coque, flottaison)."""
    mats = habillage.materiaux(D["MATERIAUX_DES_AMELIORATIONS"])
    m, sur = Maille(list(mats.values())), Maille(list(mats.values()))
    y0 = C.y(0.5)
    rects = sabords(D, C, "bord", 0.03)
    rangs = [(-0.45, 0.15), (0.15, 0.62), (0.88, 1.4), (1.4, 1.95)]
    for r, (za, zb) in enumerate(rangs):
        zc = (za + zb) / 2
        f = 0.16 + 0.0215 * (r % 2)
        while f < 0.935:
            f1 = min(f + 0.043, 0.95)
            for signe in (1, -1):
                pa = Vector((signe * (C.bord(f, zc) + 0.15), C.y(f) - y0, zc))
                pb = Vector((signe * (C.bord(f1, zc) + 0.15), C.y(f1) - y0, zc))
                if C.bord(f, za) > 0.6:
                    nrm = C.normale((f + f1) / 2, zc, signe)
                    dd = (pb - pa).normalized()
                    poutre(m if libre(pa, pb, za, zb, rects) else sur, pa + dd * 0.02, pb - dd * 0.02, zb - za - 0.04, 0.05, nrm, mat)
            f = f1
    objet("plaques", m, (0, 0, 0), 35)
    objet("sans-sabord", sur, (0, 0, 0), 35)
    return {"montage": "ancrages", "selon": {"sabord": {}}}


def exterieure(p0, p1, signe):
    """Normale horizontale du mur de p0 à p1 tournée vers le bord `signe` (1 bâbord, -1 tribord)."""
    n = Vector((p1[1] - p0[1], -(p1[0] - p0[0]), 0)).normalized()
    return n if n.x * signe > 0 else -n


def murs_blindes(D, C):
    """Murs blindés : plaques de fer sur les murailles du château de poupe (flancs, tableau, façade sur l'embelle), hors
    de ses sabords, et du gaillard d'avant (flancs, façade arrière, avant) ; celles qui couvrent les sabords dans le
    nœud `sans-sabord`."""
    mats = habillage.materiaux(D["MATERIAUX_DES_AMELIORATIONS"])
    m, sur = Maille(list(mats.values())), Maille(list(mats.values()))
    y0 = C.y(0.5)
    rects = sabords(D, C, "chateau", 0.03)
    Y = lambda f: C.y(f) - y0  # noqa: E731
    KC, A = D["CHATEAU"], D["GAILLARD"]
    sa = KC["niveaux"][4][1] + 0.01
    st = KC["stations"]
    for signe in (1, -1):
        for f0, f1 in zip(st, st[1:]):
            p0, p1 = (signe * (C.lisse(f0) + sa), Y(f0)), (signe * (C.lisse(f1) + sa), Y(f1))
            plaques(m, p0, p1, 3.62, 5.9, exterieure(p0, p1, signe), "fer", hauteur=0.57, rects=rects, sur=sur)
    xa = C.lisse(st[-1]) + sa
    plaques(m, (-xa, Y(1.0) + 0.01), (xa, Y(1.0) + 0.01), 3.62, 5.9, (0, 1, 0), "fer", hauteur=0.57, rects=rects, sur=sur)
    xf = C.lisse(st[0]) + sa
    plaques(m, (xf, Y(st[0]) - 0.01), (-xf, Y(st[0]) - 0.01), 2.0, 5.9, (0, -1, 0), "fer")
    largeur = A["largeur"] + [(A["stations"][-1], C.lisse(A["stations"][-1]) + 0.12)]
    sg = A["stations"]
    z_haut = A["niveaux"][-1][0] - 0.05
    for signe in (1, -1):
        for f0, f1 in zip(sg, sg[1:]):
            p0 = (signe * (lineaire(largeur, f0) + 0.09), Y(f0))
            p1 = (signe * (lineaire(largeur, f1) + 0.09), Y(f1))
            plaques(m, p0, p1, 4.35, z_haut, exterieure(p0, p1, signe), "fer")
    xg = lineaire(largeur, sg[-1])
    plaques(m, (-xg, Y(sg[-1]) + 0.01), (xg, Y(sg[-1]) + 0.01), 1.85, z_haut, (0, 1, 0), "fer")
    x0 = lineaire(largeur, 0.0)
    plaques(m, (x0, Y(0.0) - 0.01), (-x0, Y(0.0) - 0.01), 4.35, z_haut, (0, -1, 0), "fer")
    objet("plaques", m, (0, 0, 0), 35)
    objet("sans-sabord", sur, (0, 0, 0), 35)
    return {"montage": "ancrages", "selon": {"sabord": {}}}


def bouteur(D, C):
    """Bouteur : gouvernail auxiliaire de proue, pelle devant l'étrave sur ses aiguillots, mèche montant sous le gaillard."""
    mats = habillage.materiaux(D["MATERIAUX_DES_AMELIORATIONS"])
    m = Maille(list(mats.values()))
    bas, haut = Vector((0, C.y(0.168) - C.y(0.12) - 0.5, -2.3)), Vector((0, C.y(0.096) - C.y(0.12) - 0.5, 2.45))
    poutre(m, bas, haut, 0.9, 0.26, (1, 0, 0), "bois")
    d = (haut - bas).normalized()
    for t in (0.15, 0.5, 0.85):
        c = bas + (haut - bas) * t
        poutre(m, c - d * 0.06, c + d * 0.06, 1.0, 0.32, (1, 0, 0), "fer")
    K.espar(m, haut, Vector((0, haut.y - 0.3, 4.3)), 0.13, 0.11, 6, "bois")
    objet("bouteur", m, (0, 0, 0), 35)
    return {"montage": "ancrages"}


def proue_idole(D):
    """Proue-idole de Stromfels : idole du Dieu Requin taillée dans le bois et peinte de rouge sombre (MDG p.97), posée
    comme une figure de proue sur l'étrave, sous le beaupré et au-dessus du bélier : corps dressé et penché vers l'avant,
    nageoires en bras rabattus, tête de requin à la gueule ouverte, caudale contre l'étrave."""
    mats = habillage.materiaux(D["MATERIAUX_DES_AMELIORATIONS"])
    m = Maille(list(mats.values()))
    incl = math.radians(35)
    axe = Vector((0, -math.sin(incl), math.cos(incl)))   # du pied (sur l'étrave) vers les épaules, penché vers l'avant
    dos = Vector((0, math.cos(incl), math.sin(incl)))     # vers l'arrière et le haut, côté étrave
    pied = Vector((0, 0.35, -0.9))
    cou = pied + axe * 1.45
    K.fuseau(m, pied, cou, [(0, 0), (0, 0.09), (0.3, 0.2), (0.7, 0.29), (1, 0.27), (1, 0)], 10, "sang")   # corps
    K.fuseau(m, cou - axe * 0.12, cou + axe * 0.1, [(0, 0), (0, 0.3), (1, 0.3), (1, 0)], 10, "dorure")      # collier
    regard = Vector((0, -1, 0.3)).normalized()                                                              # tête vers l'avant
    tete = cou + axe * 0.08
    K.fuseau(m, tete, tete + regard * 1.05, [(0, 0), (0, 0.24), (0.3, 0.3), (0.65, 0.24), (0.9, 0.12), (1, 0)], 10, "sang")
    haut_t = regard.cross(Vector((1, 0, 0))).normalized()
    if haut_t.z < 0:
        haut_t = -haut_t
    g = tete + regard * 0.62 - haut_t * 0.16
    poutre(m, g - regard * 0.22, g + regard * 0.24, 0.36, 0.13, haut_t, "ombre")                        # gueule ouverte
    for k in range(5):
        for s_ in (1, -1):
            t = g + regard * (-0.16 + 0.085 * k) + Vector((s_ * 0.15, 0, 0))
            K.fuseau(m, t + haut_t * 0.065, t - haut_t * 0.04, [(0, 0), (0, 0.035), (1, 0)], 4, "dent")
    for s_ in (1, -1):                                                                                      # yeux
        o = tete + regard * 0.5 + haut_t * 0.1 + Vector((s_ * 0.21, 0, 0))
        K.fuseau(m, o - Vector((s_ * 0.03, 0, 0)), o + Vector((s_ * 0.05, 0, 0)), [(0, 0), (0, 0.06), (1, 0.045), (1, 0)], 6, "ombre")

    def aile(base, pointe, fond, ep=0.035):
        for e in (ep, -ep):
            dx = Vector((e, 0, 0))
            K.nappe(m, [[tuple(base + dx), tuple(fond + dx)], [tuple(pointe + dx)]], "sang")
    aile(tete + haut_t * 0.2 + regard * 0.15, tete + haut_t * 0.75 - regard * 0.2, tete + haut_t * 0.2 - regard * 0.3)   # aileron dorsal
    for s_ in (1, -1):                                                                                      # nageoires-bras rabattus
        epaule = cou - axe * 0.15 + Vector((s_ * 0.26, 0, 0))
        for e in (0.03, -0.03):
            K.nappe(m, [[tuple(epaule + dos * e), tuple(epaule + dos * e - axe * 0.45)],
                        [tuple(epaule + dos * e - axe * 0.85 + Vector((s_ * 0.22, 0, 0)) - dos * 0.05)]], "sang")
    q = pied + axe * 0.08
    aile(q, q + dos * 0.15 + axe * 0.75, q + axe * 0.35)                                                  # caudale contre l'étrave
    aile(q, q + dos * 0.1 - axe * 0.45, q + axe * 0.25)
    objet("idole", m, (0, 0, 0), 35)
    return {"montage": "ancrages"}


def safran(D, C):
    """Safran : grande pelle de gouvernail qui coiffe celle du navire, ferrée de cinq pentures."""
    mats = habillage.materiaux(D["MATERIAUX_DES_AMELIORATIONS"])
    m = Maille(list(mats.values()))
    G = D["GOUVERNAIL"]
    (fb, zb), (fh, zh) = G["bas"], G["haut"]
    f0, z0 = 0.966, 0.2
    recul = G["recul"] + 0.45
    bas, haut = Vector((0, C.y(fb) - C.y(f0) + recul, zb - z0 - 0.2)), Vector((0, C.y(fh) - C.y(f0) + recul, zh - z0))
    poutre(m, bas, haut, 1.6, 0.36, (1, 0, 0), "bois")
    d = (haut - bas).normalized()
    for t in (0.1, 0.3, 0.5, 0.7, 0.9):
        c = bas + (haut - bas) * t - Vector((0, 0.35, 0))
        poutre(m, c - d * 0.07, c + d * 0.07, 1.0, 0.42, (1, 0, 0), "fer")
    objet("safran", m, (0, 0, 0), 35)
    return {"montage": "ancrages"}


def fourquines(D):
    """Fourquine : baguette de fer fourchue plantée dans un taquet sur la lisse ; la fourche ouverte en long."""
    mats = habillage.materiaux(D["MATERIAUX_DES_AMELIORATIONS"])
    m = Maille(list(mats.values()))
    poutre(m, Vector((0, 0, 0)), Vector((0, 0, 0.12)), 0.2, 0.2, (1, 0, 0), "bois")
    K.espar(m, Vector((0, 0, 0.1)), Vector((0, 0, 0.6)), 0.03, 0.025, 6, "fer")
    for s_ in (1, -1):
        K.espar(m, Vector((0, 0, 0.6)), Vector((0, s_ * 0.09, 0.8)), 0.022, 0.018, 5, "fer")
    objet("fourquine", m, (0, 0, 0), 35)
    return {"montage": "ancrages"}


def propulsion(D):
    """Propulsion à vapeur : chaudière couchée sur ses berceaux au milieu du pont, deux cheminées cerclées (la Belle
    Fregar, MDG p.157)."""
    mats = habillage.materiaux(D["MATERIAUX_DES_AMELIORATIONS"])
    m = Maille(list(mats.values()))
    K.fuseau(m, Vector((0, -1.4, 0.95)), Vector((0, 1.4, 0.95)), [(0, 0), (0, 0.6), (0.04, 0.85), (0.96, 0.85), (1, 0.6), (1, 0)], 12, "fer")
    for yy in (-0.9, 0.9):
        poutre(m, Vector((-0.8, yy, 0.25)), Vector((0.8, yy, 0.25)), 0.35, 0.5, (0, 0, 1), "bois")
    for yy in (-0.6, 0.6):
        pied, tete = Vector((0, yy, 1.6)), Vector((0, yy, 8.5))
        K.fuseau(m, pied, tete, [(0, 0), (0, 0.36), (0.92, 0.36), (0.97, 0.46), (1, 0.46), (1, 0.3)], 12, "fer")
        K.fuseau(m, tete - Vector((0, 0, 0.12)), tete - Vector((0, 0, 0.1)), [(0, 0), (0, 0.33), (1, 0.33), (1, 0)], 12, "ombre")
        for z in (3.0, 6.0):
            K.fuseau(m, pied + Vector((0, 0, z - 1.6)), pied + Vector((0, 0, z - 1.6 + 0.45)), [(0, 0.38), (1, 0.38)], 12, "peinture")
    objet("vapeur", m, (0, 0, 0), 35)
    return {"montage": "ancrages"}


# Les pièces, et celles qui se bâtissent sur la forme de la coque (`K.Coque`).
PIECES = {
    "sabord": sabord, "figure-de-proue": figure_de_proue, "ancre": ancre, "belier": belier, "nid-de-pie": nid_de_pie,
    "embarcation-de-bord": embarcation, "ralentisseurs-lateraux": ralentisseurs, "proue-idole-de-stromfels": proue_idole,
    "fourquines": fourquines, "propulsion-a-vapeur": propulsion,
}
PIECES_SUR_LA_COQUE = {
    "clinfoc": clinfoc, "bouteur": bouteur, "safran": safran, "murs-blindes": murs_blindes,
    "blindage-fer": lambda D, C: blindage(D, C, "fer"), "blindage-bronze": lambda D, C: blindage(D, C, "bronze"),
}


def elements(D, P):
    """Une pièce par Amélioration de `PIECES` et `PIECES_SUR_LA_COQUE` (la coque calée sur les ponts `P`), clé
    `amelioration` (Amélioration de `src/data/naval-traits.json`)."""
    C = K.Coque(D, P)
    batisseurs = {**{nom: (lambda piece=piece: piece(D)) for nom, piece in PIECES.items()},
                  **{nom: (lambda piece=piece: piece(D, C)) for nom, piece in PIECES_SUR_LA_COQUE.items()}}
    for nom, batir in batisseurs.items():
        yield {"glb": nom, "cles": [("amelioration", {"amelioration": nom})], "materiaux": D["MATERIAUX_DES_AMELIORATIONS"],
               "blasons": (), "construire": batir}
