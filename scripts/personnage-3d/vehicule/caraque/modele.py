"""La caraque (fiche `caraque` de `src/data/vehicles.json`, #2987 lots V3 à V5) : les nœuds `coque`, `beaupre`,
`misaine`, `grand_mat`, `grand_mat_arriere`, `artimon`, et ceux que l'Amélioration Sabord départage : `avec-sabord`
(les cartouches sculptés du château autour de ses ouvertures), `sans-sabord` (le bordé qui bouche les ouvertures des
sabords et les ouvertures vides, `OUVERTURES_VIDES`) ;
meshes sans skin ni armature. Ses ponts suivent leur source unique (`ponts` de la fiche, `plan_de_jeu.py`, #3686), que
lit aussi le plan de jeu : pièces creusées, hauteurs, cloisons, portes, écoutilles, échelles, sabords, pieds des mâts,
proue et trappe de fret sur les cases et arêtes du plan (#3815).
L'origine est le centre du plan ; z = 0 reste la flottaison. Les Améliorations navales se bâtissent sur sa coque
(`ameliorations.py`)."""
import math

import bpy
from mathutils import Vector

import habillage
import plan_de_jeu
from maille import Maille, boite, lineaire, objet, poutre
from navire import (AXES, Coque, Pieces, amenager, booleen, carre_de_blason, cloison, emprises, enceinte, espar, fondre,
                    fuseau, nappe, reunir, uv_de_blason, vergue)


def grille_rayee(ns, rayures, bornes=()):
    """Abscisses relatives d'une toile (de 0 à 1) et matériau de chaque colonne : `ns` divisions régulières, les
    `bornes` du carré de l'emblème, plus les bords des `rayures` (nombre, largeur relative), bandes du matériau
    `rayure` sur le fond `toile`."""
    n, w = rayures["nombre"], rayures["largeur"]
    bandes = [((k + 0.5) / n - w / 2, (k + 0.5) / n + w / 2) for k in range(n)]
    xs = sorted({i / ns for i in range(ns + 1)} | {b for bande in bandes for b in bande} | set(bornes))
    mats = ["rayure" if any(a <= (x0 + x1) / 2 <= b for a, b in bandes) else "toile" for x0, x1 in zip(xs, xs[1:])]
    return xs, mats


def voile_carree(maille, y0, z_haut, tete, bordure, z_bas, creux, grille, rayures, blason):
    """Voile carrée rayée centrée en x, sa tête sous la vergue en y0, gonflée vers l'avant (-y) ; l'emblème dans son
    carré `blason` (part, centre en hauteur)."""
    ns, nt = grille
    bornes = carre_de_blason((tete + bordure) / 2, z_haut - z_bas, *blason)
    xs, mats = grille_rayee(ns, rayures, bornes[0])
    ts = sorted({j / nt for j in range(nt + 1)} | set(bornes[1]))
    rangs, uvs = [], []
    for t in ts:
        uvs.append([uv_de_blason(s, t, bornes) for s in xs])
        demi = (tete + (bordure - tete) * t) / 2
        z = z_haut + (z_bas - z_haut) * t
        rang = []
        for s in xs:
            gonfle = creux * math.sin(math.pi * s) ** 0.7 * math.sin(math.pi * t * 0.62)
            rang.append(((2 * s - 1) * demi, y0 - gonfle, z))
        rangs.append(rang)
    nappe(maille, rangs, None, mats, uvs)


def sabords_des_ponts(D, P, C, pieces):
    """Chaque sabord des ponts : (centre de son ouverture sur la face extérieure de la muraille, bord, plancher de sa
    case, sorte de sa paroi, distance de la face extérieure à son arête). Au milieu de sa case sur un flanc ; sur le
    tableau, au milieu de sa case tant que l'ouverture et son cadre y tiennent."""
    E, CA = D["EMBRASURE"], D["CANON"]
    demi = E["ouverture"][0] / 2 + E["cadre"][0] + D["CLOISON"]["epaisseur"] / 2
    saillie = D["CHATEAU"]["niveaux"][4][1]
    sortie = []
    for z, (cx, cy), bord in plan_de_jeu.sabords(P):
        c = (cx, cy, z)
        plancher = pieces.plancher(c)
        zc = plancher + CA["axe"]
        sorte = D["SOUS_LES_PONTS"][pieces.couverture[c]]["paroi"][0]
        if bord in ("tribord", "babord"):
            yy = C.y_du_plan(cx + 0.5)
            f = C.f(yy)
            mur = C.bord(f, zc) if sorte == "bord" else C.lisse(f) + saillie
            centre = Vector((AXES[bord].x * mur, yy, zc))
            profondeur = mur - abs(C.x_du_plan(cy if bord == "tribord" else cy + 1))
        else:
            yy = C.y_du_plan(cx + 1 if bord == "poupe" else cx)
            borne = C.lisse(C.f(yy)) + saillie - demi
            centre = Vector((min(max(C.x_du_plan(cy + 0.5), -borne), borne), yy, zc))
            profondeur = 0.0
        sortie.append((centre, bord, plancher, sorte, profondeur))
    return sortie


def ouvertures_vides(D, C):
    """Chaque ouverture vide du Sabord (`OUVERTURES_VIDES`), des deux bords : (centre de son ouverture sur la face
    extérieure de la muraille, bord, sorte de sa paroi)."""
    for O in D["OUVERTURES_VIDES"]:
        zc = C.hauteur(O["plancher"]) + O["axe"]
        for xp in O["cases"]:
            yy = C.y_du_plan(xp)
            f = C.f(yy)
            mur = C.bord(f, zc) if O["sorte"] == "bord" else C.lisse(f) + D["CHATEAU"]["niveaux"][4][1]
            for bord in ("tribord", "babord"):
                yield Vector((AXES[bord].x * mur, yy, zc)), bord, O["sorte"]


def mats(D, P, C):
    """Les `MATS`, chacun au milieu de la case de son pied (`GLYPHES["pieds"]`, de l'avant à l'arrière) : cette case,
    son abscisse f, son x et son emplanture au plancher de cette case."""
    pieds = sorted(k for k, g in P["cases"].items() if g in D["GLYPHES"]["pieds"])
    return {nom: {**M, "case": (x, yy, z), "f": C.f(C.y_du_plan(x + 0.5)), "x": C.x_du_plan(yy + 0.5),
                  "emplanture": P["hauteurs"][P["cases"][(x, yy, z)]]}
            for (nom, M), (x, yy, z) in zip(D["MATS"].items(), pieds, strict=True)}


def poulaine(D, P, C, coque, interieurs):
    """La proue (`POULAINE`) : les cases du pont principal en avant du gaillard d'avant, sous le ciel ; la coque arasée au
    plancher de ces cases jusqu'à la cloison avant du gaillard, la poulaine qui la prolonge au-delà de l'étrave sur son
    éperon, et leur garde-corps le long de la coque arasée puis de la poulaine, fermé à son bout."""
    PL, GL = D["POULAINE"], D["GLYPHES"]
    debut = min(x for (x, _, z), g in P["cases"].items() if g == GL["gaillard"])
    proue = [(x, yy, z) for (x, yy, z) in P["cases"]
             if z == D["PONT_PRINCIPAL"] and x < debut and not any((x, yy, zz) in P["cases"] for zz in range(z + 1, P["ponts"]))]
    h = max(P["hauteurs"][P["cases"][c]] for c in proue)
    y_cloison = C.y_du_plan(debut) - D["CLOISON"]["sous_un_pont"] / 2
    y_bout = C.y_du_plan(PL["bout"])
    boite(interieurs, (-8.0, y_bout - 2.0, h + 0.005), (8.0, y_cloison, D["GAILLARD"]["niveaux"][0][0] - 0.01), "bois")
    demi = PL["largeur"] / 2
    boite(coque, (-demi, y_bout, h - 0.005 - PL["epaisseur"]), (demi, C.y_du_plan(1.0), h - 0.005), "bois")
    (xa, za), (xb, zb) = PL["eperon"]
    lp, hp = PL["section"]
    poutre(coque, (0, C.y_du_plan(xa), za), (0, C.y_du_plan(xb), zb), hp, lp, (1, 0, 0), "bois")
    hg, pas, sg = PL["garde_corps"]
    retrait = 0.12
    n = math.ceil((y_cloison - y_bout) / 0.25)
    cote = [(max(demi, C.bord(C.f(yy), h)) - retrait, yy) for yy in (y_cloison - (y_cloison - y_bout - retrait) * i / n for i in range(n + 1))]
    tour = [Vector((x, yy, 0)) for x, yy in cote + [(-x, yy) for x, yy in cote[::-1]]]
    for a, b in zip(tour, tour[1:]):
        for zr in (h + hg - sg / 2, h + hg / 2):
            poutre(coque, a + Vector((0, 0, zr)), b + Vector((0, 0, zr)), sg, sg, (0, 0, 1), "bois")
    cumul = [0.0]
    for a, b in zip(tour, tour[1:]):
        cumul.append(cumul[-1] + (b - a).length)
    k = max(1, round(cumul[-1] / pas))
    for i in range(k + 1):
        d = cumul[-1] * i / k
        j = min(max(next(j for j, c in enumerate(cumul) if c >= d - 1e-9), 1), len(tour) - 1)
        a, b = tour[j - 1], tour[j]
        p = a + (b - a) * ((d - cumul[j - 1]) / max(cumul[j] - cumul[j - 1], 1e-9))
        poutre(coque, p + Vector((0, 0, h - 0.01)), p + Vector((0, 0, h + hg)), sg, sg, (1, 0, 0), "bois")


def cloisons_au_bord_des_trappes(D, P, C, pieces, coque):
    """Les cloisons du plan entre une case sous un pont qui ne se creuse pas (le dessous du gaillard d'avant) et la place
    d'une trappe d'un autre pont, que `amenager` ne pose pas (`plan_de_jeu.murs` ne garde que les arêtes entre deux
    cases) ; de son plancher au pont qui la couvre, une trappe à son niveau (`Pieces.au_niveau`) ; jusqu'à la paroi
    quand la rangée voisine n'a pas de case."""
    marge, ep = D["CLOISON"]["marge"], D["CLOISON"]["sous_un_pont"]
    trappes = {k[:2] for k in pieces.pieds}
    for s, x, yy, z, g in P["aretes"]:
        if g not in plan_de_jeu.MURS:
            continue
        a, b = [(cx, cy, z) for cx, cy in plan_de_jeu.voisines(s, x, yy)]
        for c, trou in ((a, b), (b, a)):
            if c not in P["cases"] or trou in P["cases"] or trou[:2] not in trappes:
                continue
            bas, haut, couvrant = pieces.au_niveau(c)
            if couvrant is None or D["SOUS_LES_PONTS"][couvrant]["paroi"] is not None:
                continue
            za, zb = bas - marge, haut + marge
            if s == "t":
                yc = C.y_du_plan(x)
                hw = pieces.paroi(c, C.f(yc), (za + zb) / 2) + marge
                s0 = C.x_du_plan(yy) if (c[0], yy - 1, z) in P["cases"] else -hw
                s1 = C.x_du_plan(yy + 1) if (c[0], yy + 1, z) in P["cases"] else hw
                cloison(coque, Vector((0, yc, 0)), Vector((1, 0, 0)), Vector((0, 1, 0)), s0, s1, za, zb, ep, None, D["PORTE"])
            else:
                cloison(coque, Vector((C.x_du_plan(yy), 0, 0)), Vector((0, 1, 0)), Vector((1, 0, 0)), C.y_du_plan(x),
                        C.y_du_plan(x + 1), za, zb, ep, None, D["PORTE"])


def trappes_de_fret(P):
    """Chaque trappe de fret des ponts : un trou rectangulaire d'un pont, entouré de ses cases, hors des trappes des
    échelles, au-dessus d'une case d'un pont plus bas ; (pont, (x de, y de, x à, y à) en cases,
    fins exclues, plancher le plus haut sous le trou, hauteur du pont autour)."""
    trappes = {trappe for _, trappe, _, _ in plan_de_jeu.echelles(P)}
    for z in range(1, P["ponts"]):
        vides = {(x, yy) for x in range(P["W"]) for yy in range(P["H"]) if (x, yy, z) not in P["cases"] and (x, yy) not in trappes}
        while vides:
            pile, trou = [vides.pop()], set()
            while pile:
                x, yy = pile.pop()
                trou.add((x, yy))
                for v in ((x + 1, yy), (x - 1, yy), (x, yy + 1), (x, yy - 1)):
                    if v in vides:
                        vides.discard(v)
                        pile.append(v)
            xs, ys = [x for x, _ in trou], [yy for _, yy in trou]
            dessous = [P["hauteurs"][P["cases"][(x, yy, zz)]] for x, yy in trou for zz in range(z) if (x, yy, zz) in P["cases"]]
            if min(xs) == 0 or min(ys) == 0 or max(xs) == P["W"] - 1 or max(ys) == P["H"] - 1 or not dessous:
                continue
            rect = (min(xs), min(ys), max(xs) + 1, max(ys) + 1)
            assert len(trou) == (rect[2] - rect[0]) * (rect[3] - rect[1]), f"trappe de fret non rectangulaire au pont {z} : {sorted(trou)}"
            autour = [P["hauteurs"][P["cases"][(vx, vy, z)]] for x, yy in trou for vx, vy in ((x + 1, yy), (x - 1, yy), (x, yy + 1), (x, yy - 1))
                      if (vx, vy, z) in P["cases"]]
            yield z, rect, max(dessous), max(autour)


def trappe_de_fret(D, C, places, bas, haut, coque, interieurs):
    """Le puits d'une trappe de fret (`trappes_de_fret`) creusé du plancher `bas`, qu'il découvre, au-dessus du pont
    `haut`, et l'hiloire
    (`ECOUTILLE`) qui borde son ouverture dans ce pont, à l'aplomb de ses bords."""
    x0, y0, x1, y1 = places
    xa, xb, ya, yb = C.x_du_plan(y0), C.x_du_plan(y1), C.y_du_plan(x0), C.y_du_plan(x1)
    boite(interieurs, (xa, ya, bas), (xb, yb, haut + 0.3), "bois")
    lh, hh = D["ECOUTILLE"]["hiloire"]
    za, zb = haut - 0.1, haut + hh
    for mini, maxi in (((xa, ya, za), (xa + lh, yb, zb)), ((xb - lh, ya, za), (xb, yb, zb)),
                       ((xa + lh, ya, za), (xb - lh, ya + lh, zb)), ((xa + lh, yb - lh, za), (xb - lh, yb, zb))):
        boite(coque, mini, maxi, "bois")


def construire(D, P):
    """Bâtit la caraque sur ses ponts `P` (`plan_de_jeu.py`) ; rend les `postes`, `selon`, `ancrages` et `cases` de son manifeste,
    en mètres glTF."""
    tous = list(habillage.materiaux(D["MATERIAUX"]).values())
    C = Coque(D, P)
    y = C.y
    GL = D["GLYPHES"]
    D = {**D, "MATS": mats(D, P, C)}

    # coque : bordé lissé de la quille au plat-bord, préceinte, pavois, pont (un solide, que les sabords percent) ;
    # gouvernail
    coque, interieurs = Maille(tous), Maille(tous)
    bordage, chateau = Maille(tous), Maille(tous)
    anneaux = []
    for n in range(len(D["NIVEAUX"])):
        rang = []
        for u in D["STATIONS"]:
            w, f, z = C.niveau(n, u)
            rang.append((w, y(f), z))
        anneaux.append(rang)
    enceinte(bordage, anneaux, True, D["PAVOIS"], C.pont, "bois")
    G = D["GOUVERNAIL"]
    (fb, zb), (fh, zh) = G["bas"], G["haut"]
    poutre(coque, (0, y(fb) + G["recul"], zb), (0, y(fh) + G["recul"], zh), G["corde"], G["epaisseur"], (1, 0, 0), "bois")

    # château de poupe : murailles sur le plat-bord, bandeau de base, balustrade, pont de dunette ; sabords
    K = D["CHATEAU"]
    anneaux = [[(C.lisse(f) + saillie, y(f), z) for f in K["stations"]] for z, saillie in K["niveaux"]]
    enceinte(chateau, anneaux, False, K["garde_corps"], lambda _: C.hauteur(GL["plage"]), "bois")

    # gaillard d'avant en surplomb : avant plat, fond, pavois, pont ; cloison arrière jusqu'au pont principal
    A = D["GAILLARD"]
    f_arriere = A["stations"][-1]
    largeur = A["largeur"] + [(f_arriere, C.lisse(f_arriere) + 0.12)]
    anneaux = [[(lineaire(largeur, f) + saillie, y(f), z) for f in A["stations"]] for z, saillie in A["niveaux"]]
    gaillard = Maille(tous)
    enceinte(gaillard, anneaux, False, A["garde_corps"], lambda _: C.hauteur(GL["gaillard"]), "bois")
    f_avant = A["stations"][0]
    poulaine(D, P, C, coque, interieurs)

    # passerelle en travers de l'embelle : tablier sur ses cases, garde-corps, poutres de support sur des épontilles posées
    # sur le plat-bord ; un passage à travers le pavois du pont qui la prolonge à chacun de ses bouts
    PA = D["PASSERELLE"]
    passages, travees = [], []
    for zp, yp, x in sorted((z, yy, x) for (x, yy, z), g in P["cases"].items() if g == GL["passerelle"]):
        if travees and travees[-1][1:] == (yp, zp) and travees[-1][0][1] == x - 1:
            travees[-1] = ((travees[-1][0][0], x), yp, zp)
        else:
            travees.append(((x, x), yp, zp))
    for (x0, x1), yp, zp in travees:
        h = P["hauteurs"][GL["passerelle"]]
        ya, yb, xc = C.y_du_plan(x0), C.y_du_plan(x1 + 1), C.x_du_plan(yp + 0.5)
        demi = PA["largeur"] / 2
        poutre(coque, (xc, ya, h - PA["epaisseur"] / 2), (xc, yb, h - PA["epaisseur"] / 2), PA["largeur"], PA["epaisseur"], (0, 0, 1), "bois")
        hg, sg = PA["garde_corps"]
        for s_ in (1, -1):
            xg = xc + s_ * (demi - sg / 2)
            poutre(coque, (xg, ya, h + hg - sg / 2), (xg, yb, h + hg - sg / 2), sg, sg, (0, 0, 1), "bois")
            for yy in [ya, yb] + [C.y_du_plan(xp) for xp in PA["poutres"] if ya < C.y_du_plan(xp) < yb]:
                poutre(coque, (xg, yy, h), (xg, yy, h + hg - sg), sg, sg, (1, 0, 0), "bois")
        lp, hp = PA["section"]
        zp_ = h - PA["epaisseur"] - hp / 2
        for xp in PA["poutres"]:
            yy = C.y_du_plan(xp)
            if not ya < yy < yb:
                continue
            f = C.f(yy)
            w = C.lisse(f) - D["PAVOIS"][0]
            poutre(coque, (-w, yy, zp_), (w, yy, zp_), lp, hp, (0, 0, 1), "bois")
            e = PA["epontille"]
            for s_ in (1, -1):
                poutre(coque, (s_ * (w - e / 2), yy, lineaire(D["LISSE"], f)), (s_ * (w - e / 2), yy, zp_ - hp / 2), e, e, (1, 0, 0), "bois")
        for xb, yy in ((x0 - 1, ya), (x1 + 1, yb)):
            voisin = P["cases"].get((xb, yp, zp))
            if voisin is None or voisin == GL["passerelle"]:
                continue
            hv = P["hauteurs"][voisin]
            passages.append((xc - demi, xc + demi, yy))
            zc = (hv + PA["passage"]) / 2
            poutre(interieurs, (xc, yy - 0.6, zc), (xc, yy + 0.6, zc), PA["largeur"], PA["passage"] - hv, (0, 0, 1), "bois")

    def hors_des_passages(segments):
        """Les `segments` (x, y) sans ce qui croise un passage de la passerelle : une traverse coupée de part et d'autre."""
        sortie = []
        for a, b in segments:
            coupe = next(((xa, xb) for xa, xb, yy in passages if abs(a[1] - yy) < 0.5 and abs(b[1] - yy) < 0.5), None)
            if coupe is None:
                sortie.append((a, b))
                continue
            au = lambda xx: (xx, a[1] + (b[1] - a[1]) * (xx - a[0]) / (b[0] - a[0]))  # noqa: E731
            pres, loin = coupe if a[0] < b[0] else coupe[::-1]
            sortie += [(a, au(pres)), (au(loin), b)]
        return sortie

    def contour(points):
        """Segments du contour fermé `points` (x, y) : bâbord dans l'ordre, puis tribord à rebours."""
        tour = points + [(-x, yy) for x, yy in points[::-1]]
        return list(zip(tour, tour[1:] + tour[:1]))

    def le_long(segments, pas):
        """Points espacés d'au plus `pas` le long des `segments`, extrémités comprises une fois."""
        sortie = []
        for (x0, y0), (x1, y1) in segments:
            n = max(1, math.ceil(math.hypot(x1 - x0, y1 - y0) / pas))
            sortie.extend((x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n) for i in range(n))
        return sortie

    # balustrade du château : balustres tournés et main courante sur le couronnement
    BA = D["BALUSTRADE"]
    z_bas, saillie_haut = K["niveaux"][-1]
    retrait = BA["main"][0] / 2 + 0.02
    segs = contour([(C.lisse(f) + saillie_haut - retrait, y(f) if f < 1.0 else y(f) - retrait) for f in K["stations"]])
    segs[-1] = (segs[-1][0], (segs[-1][1][0], segs[-1][1][1] + retrait))
    segs = hors_des_passages(segs)
    r_col, r_panse = BA["rayons"]
    for px, py in le_long(segs, BA["pas"]):
        fuseau(coque, (px, py, z_bas), (px, py, BA["haut"] - BA["main"][1]),
               [(0, 0), (0, r_col), (0.12, r_col), (0.45, r_panse), (0.75, r_col * 0.8), (1, r_col), (1, 0)], 5, "bois")
    for (x0, y0), (x1, y1) in segs:
        zr = BA["haut"] - BA["main"][1] / 2
        poutre(coque, (x0, y0, zr), (x1, y1, zr), BA["main"][0], BA["main"][1], (0, 0, 1), "bois")

    # garde-corps à claire-voie du gaillard : montants et deux lisses sur les flancs et l'arrière ; avant plein
    CV = D["CLAIRE_VOIE"]
    z_mur = A["niveaux"][-1][0]
    sa = A["niveaux"][-1][1]
    ep = CV["epaisseur"]
    bords_g = [(lineaire(largeur, f) + sa - ep / 2, y(f)) for f in A["stations"]]
    segs_g = hors_des_passages(contour(bords_g)[:-1])          # sans l'avant plat
    for px, py in le_long(segs_g, CV["pas"]) + [segs_g[-1][1]]:
        poutre(coque, (px, py, z_mur), (px, py, CV["haut"]), CV["montant"], CV["montant"], (1, 0, 0), "bois")
    for (x0, y0), (x1, y1) in segs_g:
        d = Vector((x1 - x0, y1 - y0, 0)).normalized()
        n_h = Vector((d.y, -d.x, 0))
        for za, zb in CV["lisses"]:
            poutre(coque, (x0, y0, (za + zb) / 2), (x1, y1, (za + zb) / 2), zb - za, ep, n_h, "bois")
    x_av = lineaire(largeur, f_avant) + sa
    poutre(coque, (-x_av, y(f_avant) + 0.125, (z_mur + CV["haut"]) / 2), (x_av, y(f_avant) + 0.125, (z_mur + CV["haut"]) / 2),
           CV["haut"] - z_mur, 0.25, (0, 1, 0), "bois")

    # défenses verticales de l'embelle, entre les sabords de la batterie, épousant le bordé
    DF = D["DEFENSES"]
    for f in (C.f(C.y_du_plan(xp)) for xp in DF["cases"]):
        z_haut = lineaire(D["LISSE"], f) - 0.05
        zs = [DF["z"] + (z_haut - DF["z"]) * i / 8 for i in range(9)]
        for signe in (1, -1):
            pts = [Vector((signe * (C.bord(f, z) + DF["saillie"] / 2), y(f), z)) for z in zs]
            for a, b in zip(pts, pts[1:]):
                poutre(coque, a, b, DF["section"], DF["saillie"], C.normale(f, (a.z + b.z) / 2, signe), "bois")

    # postes : sur les ponts découverts sans Sabord, derrière les sabords avec ; chaque pièce et chaque ouverture
    # regardent exactement leur bord (`AXES`), comme l'hôte tourne la pièce montée vers lui
    CA, E, CT = D["CANON"], D["EMBRASURE"], D["CARTOUCHE"]
    lo, ho = E["ouverture"]
    cadre, saillie_cadre = E["cadre"]
    postes, sabords = {}, {}
    ouvertures, cartouches = Maille(tous), Maille(tous)

    def au_pont(face, bord, plancher, recul):
        """Pièce dont la bouche passe par-dessus le plat-bord de face intérieure `face` (x ou y selon le bord), son origine
        de `recul` derrière elle."""
        origine = Vector(face) - AXES[bord] * recul
        postes.setdefault(bord, []).append((origine.x, origine.y, plancher))

    for G in D["POSTES_DU_PONT"]:
        for bord in G["bords"]:
            if "cases" in G:
                for xp in G["cases"]:
                    yy = C.y_du_plan(xp + 0.5)
                    x = AXES[bord].x * (C.lisse(C.f(yy)) - D["PAVOIS"][0])
                    au_pont((x, yy, 0), bord, C.pont(yy), G["recul"])
            else:
                yy = y(f_avant) + 0.25 if bord == "proue" else y(1.0) - D["BALUSTRADE"]["main"][0] - 0.02
                for x in G["x"]:
                    au_pont((x, yy, 0), bord, C.hauteur(G["plancher"]), G["recul"])

    def caisson(maille, centre, axe, largeur, hauteur, devant, derriere, mat):
        """Boîte de `largeur` × `hauteur` centrée sur `centre`, de `derriere` avant lui à `devant` après lui le long
        d'`axe` (horizontal)."""
        cote = axe.cross(Vector((0, 0, 1))).normalized()
        haut = Vector((0, 0, hauteur / 2))
        coins = [(-cote * largeur / 2 - haut), (cote * largeur / 2 - haut), (cote * largeur / 2 + haut), (-cote * largeur / 2 + haut)]
        sommets = [tuple(centre - axe * derriere + c) for c in coins] + [tuple(centre + axe * devant + c) for c in coins]
        maille.ajouter(sommets, [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]], mat)

    def ouverture(centre, bord, cartouche, profondeur):
        """Ouverture traversant la muraille au point `centre` de sa face extérieure, jusqu'à `profondeur` au moins ; le
        cartouche du château autour de son cadre (celui de la pièce de l'Amélioration) dans `cartouches`."""
        c, a = Vector(centre), AXES[bord]
        cote = a.cross(Vector((0, 0, 1))).normalized()
        haut = Vector((0, 0, 1))
        caisson(ouvertures, c, a, lo, ho, 0.6, max(0.7, profondeur + 0.1), "bois")
        if cartouche:
            r_arc, ep_arc, sa_arc = CT["arc"]
            r = lo / 2 + cadre + r_arc
            pied_arc = c + a * (saillie_cadre + sa_arc / 2) + haut * (ho / 2 + cadre / 2)
            pas = 7
            for k in range(pas):
                a0, a1 = math.pi * k / pas, math.pi * (k + 1) / pas
                p0 = pied_arc + cote * (r * math.cos(a0)) + haut * (r * math.sin(a0))
                p1 = pied_arc + cote * (r * math.cos(a1)) + haut * (r * math.sin(a1))
                poutre(cartouches, p0, p1, ep_arc, sa_arc, a, "dorure")
            lp, hp, sp, ecart = CT["panneau"]
            centre_p = c + a * (sp / 2) - haut * (ho / 2 + cadre + ecart + hp / 2)
            poutre(cartouches, centre_p - cote * lp / 2, centre_p + cote * lp / 2, hp, 2 * sp, a, "bois")
            poutre(cartouches, centre_p + a * sp - cote * lp * 0.3, centre_p + a * sp + cote * lp * 0.3, hp * 0.45, 0.04, a, "dorure")

    pieces = Pieces(D, P, C)
    for centre, bord, plancher, sorte, profondeur in sabords_des_ponts(D, P, C, pieces):
        ouverture(centre, bord, sorte != "bord", profondeur)
        origine = Vector(centre) - AXES[bord] * (CA["bouche"] - CA["saillie"])
        sabords.setdefault(bord, []).append((origine.x, origine.y, plancher))
    for centre, bord, sorte in ouvertures_vides(D, C):
        ouverture(centre, bord, sorte != "bord", 0.0)

    pieces.creuser(interieurs)
    amenager(D, P, C, pieces, coque, interieurs)
    cloisons_au_bord_des_trappes(D, P, C, pieces, coque)
    for z, places, bas, haut in trappes_de_fret(P):
        trappe_de_fret(D, C, places, bas, haut, coque, interieurs)

    # mâts
    noeuds = {}
    for nom, M in D["MATS"].items():
        m = Maille(tous)
        xm = M.get("x", 0.0)
        pied = (xm, y(M["f"]), M["pied"])
        espar(m, pied, (xm, y(M["f"]), M["tete"]), *M["rayons"], D["COTES_MAT"], "bois")
        espar(m, (xm, y(M["f"]), M["emplanture"]), pied, M["rayons"][0], M["rayons"][0], D["COTES_MAT"], "bois")
        noeuds[nom] = (m, pied)

    m, (xm, ym, _) = noeuds["grand_mat"]
    a, b, r0, r1 = D["MAT_DE_HUNE"]
    z_hune = C.hauteur(GL["hune"])
    espar(m, (xm, ym, z_hune + a), (xm, ym, z_hune + b), r0, r1, D["COTES_MAT"], "bois")
    pied_de_hune = (xm, ym, z_hune + D["HUNE"][0][0])

    for nom, V in D["VOILES_CARREES"].items():
        m, (_, ym, _) = noeuds[nom]
        yv = ym - V["devant"]
        demi = V["longueur"] / 2
        vergue(m, (-demi, yv, V["vergue"]), (demi, yv, V["vergue"]), *V["rayons"], 6, "bois")
        voile_carree(m, yv - 0.05, V["vergue"] - 0.2, V["tete"], V["bordure"], V["bas"], V["creux"], D["GRILLE_VOILE"], D["RAYURES"], D["BLASON"])

    m, (_, _, _) = noeuds["grand_mat_arriere"]
    T = D["LATINE"]
    fm = D["MATS"]["grand_mat_arriere"]["f"]
    point = lambda df, z: Vector((T["x"], y(fm + df), z))  # noqa: E731
    amure, tete, ecoute = point(*T["amure"]), point(*T["tete"]), point(*T["ecoute"])
    vergue(m, amure, tete, *T["rayons"], 6, "bois")
    ns, nt = T["grille"]
    xs, mats_latine = grille_rayee(ns, D["RAYURES"])
    rangs = []
    for j in range(nt + 1):
        t = j / nt
        rang = []
        for s in xs:
            haut_s = amure + (tete - amure) * s          # sur la vergue
            bas_s = amure + (ecoute - amure) * s         # sur la bordure : chaque colonne parallèle à la chute
            p = haut_s + (bas_s - haut_s) * t
            rang.append(tuple(p + Vector((T["creux"] * math.sin(math.pi * s) * math.sin(math.pi * max(t, 0.15)) + 0.06, 0, 0))))
        rangs.append(rang)
    nappe(m, rangs, None, mats_latine)

    beaupre = Maille(tous)
    B = D["BEAUPRE"]
    ft, zt = B["talon"]
    pente = math.tan(math.radians(B["pente_deg"]))
    z_a = lambda f: zt + (y(ft) - y(f)) * pente  # noqa: E731
    talon = (0.0, y(ft), zt)
    espar(beaupre, talon, (0.0, y(B["bout_f"]), z_a(B["bout_f"])), *B["rayons"], D["COTES_MAT"], "bois")
    V = D["CIVADIERE"]
    zv = z_a(V["f"]) - V["sous"]
    demi = V["longueur"] / 2
    vergue(beaupre, (-demi, y(V["f"]), zv), (demi, y(V["f"]), zv), *V["rayons"], 6, "bois")
    voile_carree(beaupre, y(V["f"]) - 0.05, zv - 0.1, V["tete"], V["bordure"], zv - 0.1 - V["hauteur"], V["creux"], D["GRILLE_VOILE"], D["RAYURES"], D["BLASON"])
    noeuds["beaupre"] = (beaupre, talon)

    # haubans et enfléchures des deux bords, étais ; cordages dans la coque
    CO = D["CORDAGE"]
    for nom, H in D["HAUBANS"].items():
        M = D["MATS"][nom]
        ym_ = y(M["f"])
        r_mat = M["rayons"][1]
        for signe in (1, -1):
            hauts, bas = [], []
            for df in H["cadenes"]:
                f = M["f"] + df
                bas.append(Vector((signe * (C.lisse(f) + H["saillie"]) if nom == "grand_mat" else signe * (lineaire(largeur, f) + H["saillie"]), y(f), H["z"])))
                hauts.append(Vector((signe * r_mat, ym_ + 0.1, H["capelage"])))
            for a, b in zip(hauts, bas):
                poutre(coque, a, b, CO["hauban"], CO["hauban"], (0, 1, 0), "cordage")
            z = H["z"] + D["ENFLECHURES"]
            while z < H["capelage"] - 2.0:
                t = (H["capelage"] - z) / (H["capelage"] - H["z"])
                pts = [a + (b - a) * t for a, b in zip(hauts, bas)]
                for a, b in zip(pts, pts[1:]):
                    poutre(coque, a, b, CO["enflechure"], CO["enflechure"], (0, 0, 1), "cordage")
                z += D["ENFLECHURES"]
    for (mat, za), (fb_, zb) in D["ETAIS"]:
        fa = D["MATS"][mat]["f"]
        poutre(coque, (0, y(fa), za), (0, y(fb_), zb), CO["etai"], CO["etai"], (1, 0, 0), "cordage")

    # pavillon de poupe sur sa hampe penchée vers l'arrière, flamme en tête du grand mât (toile, rayure)
    PV = D["PAVILLON"]
    (fh, zh), z_tete, recul = PV["hampe"]
    pied_h = Vector((0, y(fh), zh))
    tete_h = Vector((0, y(fh) + recul, z_tete))
    espar(coque, pied_h, tete_h, 0.07, 0.05, 6, "bois")
    lt, ht = PV["toile"]
    bornes = carre_de_blason(lt, ht, PV["blason"], 0.5)
    ss = sorted({i / 6 for i in range(7)} | set(bornes[0]))
    rangs, uvs = [], []
    for t in sorted({j / 4 for j in range(5)} | set(bornes[1])):
        base = tete_h + (pied_h - tete_h).normalized() * (0.1 + ht * t)
        rangs.append([(0.25 * math.sin(math.pi * 1.6 * s_) * s_, base.y + lt * s_, base.z - 0.05 * s_) for s_ in ss])
        uvs.append([uv_de_blason(s_, t, bornes) for s_ in ss])
    nappe(coque, rangs, None, ["rayure" if (a + b) / 2 < PV["guindant"] else "toile" for a, b in zip(ss, ss[1:])], uvs)
    m_gm, (_, ym_gm, _) = noeuds["grand_mat"]
    zf, lf, hf = PV["flamme"]
    nappe(m_gm, [[(0.3 * math.sin(math.pi * 1.4 * i / 6) * i / 6, ym_gm + lf * i / 6, zf - hf * 0.5 * (i / 6)) for i in range(7)],
                 [(0.3 * math.sin(math.pi * 1.4 * i / 6) * i / 6, ym_gm + lf * i / 6, zf - hf + hf * 0.5 * (i / 6)) for i in range(7)]],
          None, ["rayure", "toile", "rayure", "toile", "rayure", "toile"])

    # l'origine au centre du plan ; z = 0 reste la flottaison
    gltf = lambda x, yy, z: [round(x, 3), round(z, 3), round(-yy, 3)]  # noqa: E731
    def z_de(xp, z):
        return C.pont(C.y_du_plan(xp)) if z == "pont" else C.hauteur(z) if isinstance(z, str) else z
    aux_cases = {nom: [gltf(x, C.y_du_plan(xp), z_de(xp, z)) for x, xp, z in points] for nom, points in D["ANCRAGES_AUX_CASES"].items()}
    lisse = {nom: [gltf(s_ * (C.lisse(C.f(C.y_du_plan(xp))) - D["PAVOIS"][0] / 2), C.y_du_plan(xp), lineaire(D["LISSE"], C.f(C.y_du_plan(xp))))
                   for xp in xps for s_ in (1, -1)] for nom, xps in D["ANCRAGES_LISSE"].items()}
    sortie = {
        "postes": {bord: [gltf(*p) for p in positions] for bord, positions in postes.items()},
        "selon": {"sabord": {"postes": {bord: [gltf(*p) for p in positions] for bord, positions in sabords.items()}}},
        "ancrages": {**{nom: [gltf(x, y(f), z) for x, f, z in points] for nom, points in D["ANCRAGES"].items()}, **aux_cases,
                     "nid-de-pie": [gltf(*pied_de_hune)], **lisse},
    }
    percer(objet("coque", coque, (0.0, 0.0, 0.0), 35), [objet("bordage", bordage, (0, 0, 0), 35), objet("chateau", chateau, (0, 0, 0), 35),
                                                     objet("gaillard", gaillard, (0, 0, 0), 35)],
           objet("interieurs", interieurs, (0, 0, 0), 35), objet("ouvertures", ouvertures, (0, 0, 0), 35))
    objet("avec-sabord", cartouches, (0.0, 0.0, 0.0), 35)
    for nom in ("beaupre", "misaine", "grand_mat", "grand_mat_arriere", "artimon"):
        mm, pied = noeuds[nom]
        objet(nom, mm, pied, 35)
    sortie["cases"] = emprises(D, P, C)
    return sortie


def percer(coque, solides, interieurs, ouvertures):
    """Réunit les `solides` (bordé, château, gaillard) en un seul volume, sans faces internes qui se chevauchent, y creuse
    les `interieurs` (cale, entrepont, pièces du château, écoutilles, portes, passages de la passerelle), puis les `ouvertures` des
    sabords : ce qui les traverse va au nœud `sans-sabord` (le bordé qui les bouche sans Sabord), le reste à `coque`."""
    solide = fondre(solides, interieurs)
    sans = solide.copy()
    sans.data = solide.data.copy()
    bpy.context.scene.collection.objects.link(sans)
    booleen(sans, "INTERSECT", ouvertures)
    booleen(solide, "DIFFERENCE", ouvertures)
    reunir(sans, [])
    sans.name = sans.data.name = "sans-sabord"
    reunir(coque, [solide])
    bpy.data.objects.remove(ouvertures)


def elements(D):
    """La caraque, puis les pièces de ses Améliorations."""
    from caraque import ameliorations
    P = plan_de_jeu.lire("caraque")
    yield {"glb": "caraque", "cles": [("vehicule", {"definition": "caraque"})], "materiaux": D["MATERIAUX"],
           "blasons": D["BLASONS"], "construire": lambda: construire(D, P)}
    yield from ameliorations.elements(D, P)
