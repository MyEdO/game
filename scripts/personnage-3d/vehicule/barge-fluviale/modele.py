"""La barge fluviale (fiche `barge-fluviale` de `src/data/vehicles.json`, #3790) : les nœuds `coque` et `mat`, meshes
sans skin ni armature. Ses ponts suivent leur source unique (`ponts` de la fiche, `plan_de_jeu.py`) : cale et cabines
creusées, cloisons, portes, écoutilles et échelles sur les cases et arêtes du plan, par les pièces communes des navires
(`navire.py`). L'origine est le centre du plan ; z = 0 reste la flottaison. Aucune Amélioration navale
n'a de pièce à sa taille (`caraque/ameliorations.py`) : son manifeste n'a pas d'`ancrages`."""
import math

from mathutils import Vector

import habillage
import navire as N
import plan_de_jeu
from maille import Maille, objet, poutre, tore


def garde_corps(maille, segments, z, GC):
    """Montants et main courante de hauteur `GC["hauteur"]` au-dessus de `z`, le long des `segments` [((x, y), (x, y))] ;
    un montant au bout commun de deux segments ne se pose qu'une fois."""
    h, pas, s = GC["hauteur"], GC["pas"], GC["section"]
    montants = {}
    for (x0, y0), (x1, y1) in segments:
        n = max(1, math.ceil(math.hypot(x1 - x0, y1 - y0) / pas))
        for i in range(n + 1):
            px, py = x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n
            montants.setdefault((round(px, 3), round(py, 3)), (px, py))
        poutre(maille, (x0, y0, z + h - s / 2), (x1, y1, z + h - s / 2), s * 1.4, s, (0, 0, 1), "bois")
    for px, py in montants.values():
        poutre(maille, (px, py, z), (px, py, z + h), s, s, (1, 0, 0), "bois")


def construire(D, P):
    """Bâtit la barge sur ses ponts `P` (`plan_de_jeu.py`) ; rend les `postes` et `cases` de son manifeste, en mètres glTF."""
    tous = list(habillage.materiaux(D["MATERIAUX"]).values())
    C = N.Coque(D, P)
    y, yp, GL = C.y, C.y_du_plan, D["GLYPHES"]
    coque, interieurs, mat = Maille(tous), Maille(tous), Maille(tous)
    bordage, rouf, plates = Maille(tous), Maille(tous), Maille(tous)

    def interieur(yy):
        """Demi-largeur de la face intérieure du pavois en y."""
        return C.lisse(C.f(yy)) - D["PAVOIS"][0]

    # coque : bordé du fond plat au plat-bord, avant plat sous la plate-forme de proue, tableau, préceinte, pavois, pont
    anneaux = []
    for n in range(len(D["NIVEAUX"])):
        rang = []
        for u in D["STATIONS"]:
            w, f, z = C.niveau(n, u)
            rang.append((w, y(f), z))
        anneaux.append(rang)
    N.enceinte(bordage, anneaux, False, D["PAVOIS"], C.pont, "bois")

    # bandes verticales du bordé, épousant sa forme
    B = D["BANDES"]
    for f in (C.f(yp(xp)) for xp in B["abscisses"]):
        zs = [B["z"] + (N.affine(D["LISSE"], f) - 0.03 - B["z"]) * i / 6 for i in range(7)]
        for signe in (1, -1):
            pts = [Vector((signe * (C.bord(f, z) + B["saillie"] / 2), y(f), z)) for z in zs]
            for a, b in zip(pts, pts[1:]):
                poutre(coque, a, b, B["section"], B["saillie"], C.normale(f, (a.z + b.z) / 2, signe), "fer")

    # rouf : murs en retrait du plat-bord sur ses cases, toit au pont « r », garde-corps, hublots et fenêtres
    R = D["ROUF"]
    xs = sorted({x for (x, _, _), g in P["cases"].items() if g == GL["toit"]})
    ya, yb = yp(xs[0]), yp(xs[-1] + 1)
    toit = C.hauteur(GL["toit"])
    demi = lambda yy: C.lisse(C.f(yy)) - R["retrait"]  # noqa: E731
    stations = [ya + (yb - ya) * i / 8 for i in range(9)]
    N.prisme(rouf, [(yy, [(C.pont(yy) - 0.05, -demi(yy), demi(yy)), (toit, -demi(yy), demi(yy))]) for yy in stations], "bois")
    contour = [(demi(yy) - 0.06, yy) for yy in stations]
    tour = [(x, max(min(yy, yb - 0.06), ya + 0.06)) for x, yy in contour] + [(-x, max(min(yy, yb - 0.06), ya + 0.06)) for x, yy in contour[::-1]]
    garde_corps(coque, list(zip(tour, tour[1:] + tour[:1])), toit, {**D["GARDE_CORPS"], "hauteur": R["garde_corps"][0],
                                                                    "pas": R["garde_corps"][1], "section": R["garde_corps"][2]})
    xh, zh, rh = R["hublots"]
    xf, zf, lf, hf = R["fenetres"]
    for signe in (1, -1):
        for xp in xh:
            yy = yp(xp)
            tore(coque, "x", (signe * (demi(yy) + 0.02), yy, zh), rh, 0.035, 12, 6, "fer")
        for xp in xf:
            yy = yp(xp)
            c = Vector((signe * (demi(yy) + 0.03), yy, zf))
            for s_ in (1, -1):
                poutre(coque, c + Vector((0, -lf / 2 - 0.04, s_ * hf / 2)), c + Vector((0, lf / 2 + 0.04, s_ * hf / 2)), 0.07, 0.06, (signe, 0, 0), "bois")
                poutre(coque, c + Vector((0, s_ * lf / 2, -hf / 2)), c + Vector((0, s_ * lf / 2, hf / 2)), 0.07, 0.06, (signe, 0, 0), "bois")
            poutre(coque, c + Vector((0, 0, -hf / 2)), c + Vector((0, 0, hf / 2)), 0.04, 0.05, (signe, 0, 0), "bois")
            poutre(coque, c + Vector((0, -lf / 2, 0)), c + Vector((0, lf / 2, 0)), 0.04, 0.05, (signe, 0, 0), "bois")

    # plates-formes de proue et de poupe sur leurs cases : plancher (un solide, que la trappe de l'échelle perce),
    # piliers depuis le pont, garde-corps ouvert au-dessus de la trappe
    trappes = {P["cases"][trappe + (z,)]: (trappe, pied) for z, trappe, pied, _ in plan_de_jeu.echelles(P)}
    for g, PL in D["PLATEFORMES"].items():
        xs_g = sorted({x for (x, _, _), gg in P["cases"].items() if gg == g})
        h = C.hauteur(g)
        ep = D["SOUS_LES_PONTS"][g]["epaisseur"]
        y0 = max(yp(xs_g[0]), y(0.0) - PL["debord"])
        y1 = min(yp(xs_g[-1] + 1), y(1.0) + PL["debord"])
        largeur = lambda yy, PL=PL: C.lisse(C.f(min(max(yy, y(0.0)), y(1.0)))) + PL["debord"]  # noqa: E731
        ys = [y0 + (y1 - y0) * i / 8 for i in range(9)]
        N.prisme(plates, [(yy, [(h - ep, -largeur(yy), largeur(yy)), (h, -largeur(yy), largeur(yy))]) for yy in ys], "bois")
        for x, xp in PL["piliers"]:
            for signe in (1, -1):
                poutre(coque, (signe * x, yp(xp), C.pont(yp(xp)) - 0.02), (signe * x, yp(xp), h - ep), PL["section"], PL["section"], (1, 0, 0), "bois")
        (tx, _), (px, _) = trappes[g]
        GC = D["GARDE_CORPS"]
        r = GC["section"] / 2 + 0.02
        yi, ye = (y1 - r, y0 + r) if px > tx else (y0 + r, y1 - r)       # bord intérieur (vers le pied de l'échelle), bout
        bab = [(largeur(yy) - r, min(max(yy, y0 + r), y1 - r)) for yy in ys]
        segments = [(p0, p1) for p0, p1 in zip(bab, bab[1:])] + [((-x0, y0_), (-x1, y1_)) for (x0, y0_), (x1, y1_) in zip(bab, bab[1:])]
        we, wi, o = largeur(ye) - r, largeur(yi) - r, GC["ouverture"]
        segments += [((we, ye), (-we, ye)), ((wi, yi), (o, yi)), ((-o, yi), (-wi, yi))]
        garde_corps(coque, segments, h, GC)

    # bâches de la cargaison sur le pont avant : hiloire de l'écoutille de charge, bâche gonflée sur la cargaison, sangles
    # croisées, de part et d'autre de l'allée axiale
    BA = D["BACHES"]
    y_a, y_b = yp(BA["abscisses"][0]), yp(BA["abscisses"][1])
    hh, lh = BA["hiloire"]
    for signe in (1, -1):
        def bache(s, t, signe=signe):
            """Point de la bâche : s de l'allée au bord, t de l'avant à l'arrière."""
            yy = y_a + (y_b - y_a) * t
            x_in, x_out = BA["allee"] / 2, interieur(yy) - 0.12
            haut = C.pont(yy) + hh + (BA["sommet"] - hh) * math.sin(math.pi * s) ** 0.6 * min(1.0, math.sin(math.pi * t) * 3)
            return (signe * (x_in + (x_out - x_in) * s), yy, haut)
        coins = [bache(s, t)[:2] for s, t in ((0, 0), (1, 0), (1, 1), (0, 1))]
        for (x0, y0_), (x1, y1_) in zip(coins, coins[1:] + coins[:1]):
            poutre(coque, (x0, y0_, C.pont(y0_) + hh / 2 - 0.02), (x1, y1_, C.pont(y1_) + hh / 2 - 0.02), hh + 0.04, lh, (y1_ - y0_, x0 - x1, 0), "bois")
        ss, ts = [i / 8 for i in range(9)], [j / 6 for j in range(7)]
        N.nappe(coque, [[bache(s, t) for s in ss] for t in ts], "toile")
        k = BA["croix"]
        for i in range(k):
            for sens in (1, -1):
                pts = []
                for j in range(13):
                    s = j / 12
                    t = (i + (s if sens == 1 else 1 - s)) / k
                    p = Vector(bache(s, t))
                    pts.append(p + Vector((0, 0, 0.03)))
                for a, b in zip(pts, pts[1:]):
                    poutre(coque, a, b, BA["sangle"], BA["sangle"] * 0.6, (0, 0, 1), "cordage")

    # postes : chaque pièce regarde exactement son bord (`AXES`), comme l'hôte tourne la pièce montée vers lui
    postes = {}
    for bord, xp, g, x in D["POSTES"]:
        yy = yp(xp)
        if x is None:
            x = N.AXES[bord].x * (interieur(yy) - D["RECUL"])
        postes.setdefault(bord, []).append((x, yy, C.hauteur(g)))

    pieces = N.Pieces(D, P, C)
    pieces.creuser(interieurs)
    N.amenager(D, P, C, pieces, coque, interieurs)

    # mât au travers du rouf, vergue et voile ferlée, haubans et étai
    M, V = D["MAT"], D["VERGUE"]
    ym = yp(M["abscisse"])
    pied = (0.0, ym, C.pont(ym))
    N.espar(mat, (0.0, ym, M["emplanture"]), (0.0, ym, M["tete"]), *M["rayons"], 8, "bois")
    (xa_, za), (xb_, zb) = V["de"], V["a"]
    a, b = Vector((V["x"], yp(xa_), za)), Vector((V["x"], yp(xb_), zb))
    N.vergue(mat, a, b, *V["rayons"], 6, "bois")
    r_f, r_b = V["ferlee"]
    d = (b - a).normalized()
    bas = Vector((0, 0, -(V["rayons"][0] + r_f * 0.8)))
    N.fuseau(mat, a + d * 0.5 + bas, b - d * 0.5 + bas, [(0, 0), (0, r_b), (0.12, r_f * 0.85), (0.5, r_f), (0.88, r_f * 0.85), (1, r_b), (1, 0)], 8, "toile")
    L = (b - a).length - 1.0
    for i in range(1, V["rabans"] + 1):
        c = a + d * (0.5 + L * i / (V["rabans"] + 1)) + bas
        N.fuseau(mat, c - d * 0.03, c + d * 0.03, [(0, 0), (0, r_f + 0.02), (1, r_f + 0.02), (1, 0)], 8, "cordage")
    CO, H = D["CORDAGE"], D["HAUBANS"]
    for signe in (1, -1):
        for xp in H["cadenes"]:
            yy = yp(xp)
            poutre(coque, (signe * M["rayons"][1], ym, H["capelage"]), (signe * (C.lisse(C.f(yy)) + 0.04), yy, N.affine(D["LISSE"], C.f(yy))),
                   CO["hauban"], CO["hauban"], (0, 1, 0), "cordage")
    poutre(coque, (0, ym - M["rayons"][1], M["tete"] - 0.4), (0, y(0.0) + 0.2, D["ETAI"]), CO["etai"], CO["etai"], (1, 0, 0), "cordage")

    # fanaux sur les garde-corps
    F = D["FANAUX"]
    lh_, lr = F["lanterne"]
    for x, xp, g in F["points"]:
        z0 = C.hauteur(g)
        yy = yp(xp)
        N.espar(coque, (x, yy, z0), (x, yy, z0 + F["hampe"]), 0.04, 0.04, 6, "bois")
        N.fuseau(coque, (x, yy, z0 + F["hampe"]), (x, yy, z0 + F["hampe"] + lh_),
                 [(0, 0), (0, lr * 0.6), (0.15, lr), (0.75, lr), (0.85, lr * 0.5), (1, 0)], 8, "fer")

    # aviron de queue sur son tolet, sa pale dans l'eau
    AV = D["AVIRON"]
    pt = lambda p: Vector((p[0], yp(p[1]), p[2]))  # noqa: E731
    poignee, tolet, bout = pt(AV["poignee"]), pt(AV["tolet"]), pt(AV["bout"])
    N.espar(coque, poignee, bout, AV["rayon"], AV["rayon"], 6, "bois")
    lp, larg, epp = AV["pale"]
    da = (bout - poignee).normalized()
    poutre(coque, bout - da * lp, bout, larg, epp, (1, 0, 0), "bois")
    N.fuseau(coque, tolet - Vector((0, 0, 0.35)), tolet + Vector((0, 0, 0.12)), [(0, 0), (0, 0.05), (1, 0.05), (1, 0)], 6, "fer")

    # pavillon de poupe sur sa hampe, l'emblème au milieu de sa toile
    PV = D["PAVILLON"]
    xh_, xph = PV["hampe"]
    yh = yp(xph)
    N.espar(coque, (xh_, yh, C.hauteur(GL["poupe"])), (xh_, yh, PV["tete"]), 0.05, 0.035, 6, "bois")
    lt, ht = PV["toile"]
    bornes = N.carre_de_blason(lt, ht, PV["blason"], 0.5)
    ss = sorted({i / 6 for i in range(7)} | set(bornes[0]))
    rangs, uvs = [], []
    for t in sorted({j / 4 for j in range(5)} | set(bornes[1])):
        z = PV["tete"] - 0.08 - ht * t
        rangs.append([(xh_ + 0.15 * math.sin(math.pi * 1.6 * s_) * s_, yh + lt * s_, z - 0.05 * s_) for s_ in ss])
        uvs.append([N.uv_de_blason(s_, t, bornes) for s_ in ss])
    N.nappe(coque, rangs, "rayure", None, uvs)

    # un seul volume (bordé, rouf, plates-formes), creusé de la cale, des cabines et des écoutilles
    solides = [objet(nom, m, (0, 0, 0), 35) for nom, m in (("bordage", bordage), ("rouf", rouf), ("plates-formes", plates))]
    solide = N.fondre(solides, objet("interieurs", interieurs, (0, 0, 0), 35))
    N.reunir(objet("coque", coque, (0, 0, 0), 35), [solide])
    objet("mat", mat, pied, 35)

    gltf = lambda x, yy, z: [round(x, 3), round(z, 3), round(-yy, 3)]  # noqa: E731
    return {"postes": {bord: [gltf(*p) for p in positions] for bord, positions in postes.items()},
            "cases": N.emprises(D, P, C)}


def elements(D):
    """La barge fluviale."""
    P = plan_de_jeu.lire("barge-fluviale")
    yield {"glb": "barge-fluviale", "cles": [("vehicule", {"definition": "barge-fluviale"})], "materiaux": D["MATERIAUX"],
           "blasons": D["BLASONS"], "construire": lambda: construire(D, P)}
