"""La caraque (fiche `caraque` de `src/data/vehicles.json`, #2987 lots V3 à V5) : les nœuds `coque`, `beaupre`,
`misaine`, `grand_mat`, `grand_mat_arriere`, `artimon`, et ceux que l'Amélioration Sabord départage : `avec-sabord`
(cadres et cartouches des sabords), `sans-sabord` (le bordé qui bouche leurs ouvertures) ; meshes sans skin ni
armature. Ses ponts suivent leur source unique (`ponts` de la fiche, `plan_de_jeu.py`, #3686), que lit aussi le plan de
jeu : pièces creusées, hauteurs, cloisons, portes, écoutilles, échelles et sabords sur les cases et arêtes du plan.
L'origine est le centre du plan ; z = 0 reste la flottaison. Les Améliorations navales se bâtissent sur sa coque
(`ameliorations.py`)."""
import math

import bmesh
import bpy
from mathutils import Vector

import habillage
from caraque import plan_de_jeu
from maille import Maille, lineaire, objet, poutre

VEHICULES = habillage.DEPOT / "src" / "data" / "vehicles.json"


def nettoyee(face):
    """La face sans sommet répété consécutif (anneau cyclique) ; None si moins de trois sommets restent."""
    sortie = []
    for i in face:
        if not sortie or sortie[-1] != i:
            sortie.append(i)
    if len(sortie) > 1 and sortie[0] == sortie[-1]:
        sortie.pop()
    return sortie if len(set(sortie)) >= 3 else None


def affine(table, x):
    """Interpolation linéaire par morceaux de `table` [(x, y)] croissante, prolongée au-delà des extrémités."""
    i = 0
    while i < len(table) - 2 and x >= table[i + 1][0]:
        i += 1
    (x0, y0), (x1, y1) = table[i], table[i + 1]
    return y0 + (y1 - y0) * (x - x0) / (x1 - x0)


class Coque:
    """Fonctions de forme lues dans les données et les ponts `P` (`plan_de_jeu.py`) : y d'une abscisse f ou d'une
    abscisse du plan (f calée sur les ponts par `CALAGE` et `COPLE`), demi-largeur d'un niveau, plat-bord, pont
    principal."""

    def __init__(self, D, P):
        self.D, self.P = D, P
        self.case = D["CASE"]
        haut = P["ponts"] - 1
        calage = []
        for glyphe, (fa, fb) in D["CALAGE"].items():
            xs = [x for (x, _, z), g in P["cases"].items() if z == haut and g == glyphe]
            calage += [(fa, min(xs)), (fb, max(xs) + 1)]
        calage = sorted(calage)
        (fe, fs), K = D["COPLE"]["f"], D["COPLE"]
        avant = max(x for f, x in calage if f < fe)
        arriere = min(x for f, x in calage if f > fs)
        self.calage = sorted(calage + [(fe, avant + K["entree"] / self.case), (fs, arriere - K["sortie"] / self.case)])
        colonnes = {}
        for (x, y, z), g in P["cases"].items():
            if z == D["PONT_PRINCIPAL"]:
                colonnes[x] = min(colonnes.get(x, math.inf), P["hauteurs"][g])
        self.pont_principal = [(self.y_du_plan(x + 0.5), h) for x, h in sorted(colonnes.items())]

    def y_du_plan(self, xp):
        """y de l'abscisse `xp` du plan, en cases (proue à 0) ; l'origine au centre du plan."""
        return (xp - self.P["W"] / 2) * self.case

    def x_du_plan(self, yp):
        """x de l'ordonnée `yp` du plan, en cases (tribord à 0)."""
        return (yp - self.P["H"] / 2) * self.case

    def y(self, f):
        return self.y_du_plan(affine(self.calage, f))

    def f(self, y):
        """L'abscisse f de y, inverse de `y`."""
        return affine([(b, a) for a, b in self.calage], y / self.case + self.P["W"] / 2)

    def hauteur(self, glyphe):
        return self.P["hauteurs"][glyphe]

    def pont(self, y):
        """z du pont principal en y : les hauteurs de ses colonnes, au milieu de chacune."""
        return lineaire(self.pont_principal, y)

    def forme(self, u, rapport):
        u0, exposant = self.D["FORME_POUPE"]
        if u <= u0:
            return lineaire(self.D["FORME_PLAN"], u)
        return 1.0 - (1.0 - rapport) * ((u - u0) / (1.0 - u0)) ** exposant

    def niveau(self, n, u):
        """(demi-largeur, f, z) du niveau `n` à la station u."""
        z, demi, fb, fs, rapport, saillie = self.D["NIVEAUX"][n]
        f = fb + u * (fs - fb)
        w = self.forme(u, rapport) * demi
        if w > 0:
            w += saillie
        zz = lineaire(self.D["LISSE"], f) if z == "lisse" else z
        return w, f, zz

    def bord(self, f, z):
        """Demi-largeur du bordé à l'abscisse f et à la hauteur z, entre les deux niveaux qui l'encadrent."""
        N = self.D["NIVEAUX"]
        pts = [self.niveau(k, min(max((f - N[k][2]) / (N[k][3] - N[k][2]), 0.0), 1.0)) for k in range(len(N))]
        for (w0, _, z0), (w1, _, z1) in zip(pts, pts[1:]):
            if z0 <= z <= z1:
                return w0 + (w1 - w0) * (z - z0) / (z1 - z0)
        return pts[-1][0]

    def normale(self, f, z, signe):
        """Normale horizontale-et-verticale du bordé du bord `signe` (1 bâbord, -1 tribord) en (f, z)."""
        h = 0.005
        dwdy = (self.bord(f + h, z) - self.bord(f - h, z)) / (self.y(f + h) - self.y(f - h))
        dwdz = (self.bord(f, z + 0.05) - self.bord(f, z - 0.05)) / 0.1
        return Vector((signe, -dwdy, -dwdz)).normalized()

    def lisse(self, f):
        """Demi-largeur du plat-bord à l'abscisse f, bornée au tableau arrière."""
        n = len(self.D["NIVEAUX"]) - 1
        _, _, fb, fs, _, _ = self.D["NIVEAUX"][n]
        u = min(max((f - fb) / (fs - fb), 0.0), 1.0)
        return self.niveau(n, u)[0]


def anneau(babord, partage):
    """Anneau fermé : bâbord de l'avant à l'arrière, puis tribord de l'arrière à l'avant ; `partage` : l'étrave est un
    sommet unique."""
    tribord = [(-x, y, z) for x, y, z in babord]
    return babord + (tribord[1:] if partage else tribord)[::-1]


def enceinte(maille, anneaux, partage, retrait, z_pont, mat):
    """Coque fermée : lissage des `anneaux` (listes bâbord, du bas au haut), plat-bord en retrait (`retrait` = x, y),
    pavois intérieur jusqu'au pont `z_pont(y)`, pont et fond en bandes bâbord/tribord."""
    sommets, faces = [], []
    n = len(anneaux[0])
    largeur = 2 * n - 1 if partage else 2 * n

    def poser(babord):
        debut = len(sommets)
        sommets.extend(anneau(babord, partage))
        return list(range(debut, debut + largeur))

    def lisser(a, b):
        for k in range(largeur):
            k2 = (k + 1) % largeur
            face = nettoyee([a[k], a[k2], b[k2], b[k]])
            if face:
                faces.append(face)

    def bande(r):
        """Les faces qui ferment l'anneau `r` entre bâbord et tribord, station par station."""
        bab = r[:n]
        tri = [r[0] if partage and i == 0 else r[2 * n - 1 - i] for i in range(n)]
        for i in range(n - 1):
            face = nettoyee([bab[i], bab[i + 1], tri[i + 1], tri[i]])
            if face:
                faces.append(face)

    rangs = [poser(a) for a in anneaux]
    for a, b in zip(rangs, rangs[1:]):
        lisser(a, b)
    haut = anneaux[-1]
    ymin, ymax = min(p[1] for p in haut), max(p[1] for p in haut)
    rx, ry = retrait
    interieur = [(max(x - rx, 0.0), min(max(y, ymin + ry), ymax - ry), z) for x, y, z in haut]
    pont = [(x, y, z_pont(y)) for x, y, _ in interieur]
    r_int, r_pont = poser(interieur), poser(pont)
    lisser(rangs[-1], r_int)
    lisser(r_int, r_pont)
    bande(r_pont)
    bande(rangs[0])
    maille.ajouter(sommets, faces, mat)


def repere(d):
    ref = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))
    e1 = (ref - d * ref.dot(d)).normalized()
    return e1, d.cross(e1)


def fuseau(maille, a, b, profil, cotes, mat):
    """Révolution du profil [(t, r)] le long du segment a→b (t de 0 à 1) ; r = 0 ferme sur l'axe."""
    a, b = Vector(a), Vector(b)
    d = (b - a).normalized()
    longueur = (b - a).length
    e1, e2 = repere(d)
    sommets, anneaux = [], []
    for t, r in profil:
        c = a + d * (t * longueur)
        if r == 0:
            anneaux.append([len(sommets)])
            sommets.append(tuple(c))
        else:
            debut = len(sommets)
            for k in range(cotes):
                ang = 2 * math.pi * k / cotes
                sommets.append(tuple(c + (e1 * math.cos(ang) + e2 * math.sin(ang)) * r))
            anneaux.append(list(range(debut, debut + cotes)))
    faces = []
    for ra, rb in zip(anneaux, anneaux[1:]):
        for k in range(cotes):
            k2 = (k + 1) % cotes
            if len(ra) == 1:
                faces.append([ra[0], rb[k], rb[k2]])
            elif len(rb) == 1:
                faces.append([ra[k], rb[0], ra[k2]])
            else:
                faces.append([ra[k], ra[k2], rb[k2], rb[k]])
    maille.ajouter(sommets, faces, mat)


def espar(maille, a, b, r_pied, r_bout, cotes, mat):
    """Espar effilé de a (rayon r_pied) à b (rayon r_bout), fermé aux deux bouts."""
    fuseau(maille, a, b, [(0, 0), (0, r_pied), (1, r_bout), (1, 0)], cotes, mat)


def vergue(maille, a, b, r_milieu, r_bout, cotes, mat):
    """Vergue renflée au milieu, de a à b."""
    fuseau(maille, a, b, [(0, 0), (0, r_bout), (0.5, r_milieu), (1, r_bout), (1, 0)], cotes, mat)


HORS_BLASON = (0.002, 0.002)      # UV d'une face hors du carré de l'emblème : le coin transparent de son image


def nappe(maille, rangs, mat, mats=None, uvs=None):
    """Toile d'une seule face : rangs de sommets du haut au bas ; un rang d'un seul sommet ferme en éventail. `mats` :
    le matériau de chaque colonne, à la place de `mat`. `uvs` : l'UV de chaque sommet, de même forme que `rangs` ; une
    face dont le centre tombe hors de [0, 1]² prend `HORS_BLASON` à chaque coin, pour que l'emblème ne s'y répète pas."""
    sommets, index, plats = [], [], []
    for j, rang in enumerate(rangs):
        debut = len(sommets)
        sommets.extend(rang)
        index.append(list(range(debut, debut + len(rang))))
        plats.extend(uvs[j] if uvs else [HORS_BLASON] * len(rang))
    colonnes = {}
    for ra, rb in zip(index, index[1:]):
        for i in range(len(ra) - 1):
            face = [ra[i], ra[i + 1], rb[0]] if len(rb) == 1 else [ra[i], ra[i + 1], rb[i + 1], rb[i]]
            coins = [plats[k] for k in face]
            cu, cv = sum(c[0] for c in coins) / len(coins), sum(c[1] for c in coins) / len(coins)
            if not (0.0 <= cu <= 1.0 and 0.0 <= cv <= 1.0):
                coins = [HORS_BLASON] * len(face)
            faces, uv = colonnes.setdefault(mats[i] if mats else mat, ([], []))
            faces.append(face)
            uv.append(coins)
    for m, (faces, uv) in colonnes.items():
        maille.ajouter(sommets, faces, m, uv)


def carre_de_blason(largeur, hauteur, part, centre_t):
    """Bornes (s0, s1), (t0, t1) du carré centré de l'emblème sur une toile `largeur` × `hauteur`, de côté `part` de la
    plus petite des deux, son centre à `centre_t` de la hauteur."""
    cote = part * min(largeur, hauteur)
    ds, dt = cote / largeur / 2, cote / hauteur / 2
    return (0.5 - ds, 0.5 + ds), (centre_t - dt, centre_t + dt)


def uv_de_blason(s, t, bornes):
    (s0, s1), (t0, t1) = bornes
    return ((s - s0) / (s1 - s0), 1.0 - (t - t0) / (t1 - t0))


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


def vantail(maille, o, t, n, s, z0, PO, h):
    """Porte fermée d'une cloison dont `o` est l'origine, `t` le sens (horizontal) et `n` la normale : vantail de planches
    centré en `s` le long de `t`, du seuil `z0` à `z0 + h`, traverses au revers, pentures et anneau de fer à l'avers,
    cadre (jambages et linteau) débordant des deux faces."""
    w, (c_l, c_p) = PO["largeur"], PO["cadre"]
    haut = Vector((0, 0, 1))
    base = o + t * s + haut * z0
    k = max(2, round(w / PO["planche"]))
    pl = (w - (k - 1) * PO["joint"]) / k
    for i in range(k):
        c = base + t * (-w / 2 + pl / 2 + i * (pl + PO["joint"]))
        poutre(maille, c, c + haut * h, pl, PO["epaisseur"], n, "bois")
    for zr in (0.22, 0.78):
        c = base + haut * (h * zr) - n * (PO["epaisseur"] / 2 + 0.015)
        poutre(maille, c - t * (w / 2 - 0.04), c + t * (w / 2 - 0.04), 0.13, 0.03, n, "bois")
    lp, ep_p = PO["penture"]
    for zr in (0.2, 0.8):
        c = base + haut * (h * zr) + n * (PO["epaisseur"] / 2 + ep_p / 2)
        poutre(maille, c - t * (w / 2 - 0.02), c + t * (w * 0.15), lp, ep_p, n, "fer")
        espar(maille, c - t * (w / 2 + 0.01) - haut * 0.06, c - t * (w / 2 + 0.01) + haut * 0.06, 0.022, 0.022, 6, "fer")
    r = PO["anneau"]
    c = base + t * (w / 2 - 0.13) + haut * (h * 0.5) + n * (PO["epaisseur"] / 2 + 0.02)
    pts = [c + t * (r * math.sin(2 * math.pi * i / 8)) - haut * (r * (1 - math.cos(2 * math.pi * i / 8))) for i in range(9)]
    for a, b in zip(pts, pts[1:]):
        poutre(maille, a, b, 0.016, 0.016, n, "fer")
    espar(maille, c - n * 0.02, c + n * 0.01, 0.03, 0.03, 6, "fer")
    for sg in (-1, 1):
        a = base + t * (sg * (w / 2 + c_l / 2))
        poutre(maille, a - haut * 0.02, a + haut * h, c_l, c_p, n, "bois")
    a = base + haut * (h + c_l / 2)
    poutre(maille, a - t * (w / 2 + c_l), a + t * (w / 2 + c_l), c_l, c_p, n, "bois")


def cloison(maille, o, t, n, s0, s1, z0, z1, ep, porte, PO):
    """Cloison de planches de `s0` à `s1` le long de `t` depuis `o`, de `z0` à `z1`, d'épaisseur `ep` ; `porte` : None ou
    (s du milieu, hauteur) d'une porte (`vantail`) qui y passe."""
    haut = Vector((0, 0, 1))
    def panneau(a, b, za, zb):  # noqa: E306
        if b - a > 0.05 and zb - za > 0.05:
            c = o + haut * ((za + zb) / 2)
            poutre(maille, c + t * a, c + t * b, zb - za, ep, n, "bois")
    if porte is None:
        panneau(s0, s1, z0, z1)
        return
    sp, h = porte
    demi = PO["largeur"] / 2 + PO["cadre"][0]
    panneau(s0, sp - demi, z0, z1)
    panneau(sp + demi, s1, z0, z1)
    panneau(sp - demi, sp + demi, z0 + PO["seuil"] + h + PO["cadre"][0], z1)
    vantail(maille, o, t, n, sp, z0 + PO["seuil"], PO, h)


def echelle(maille, haut_, d, z_bas, E):
    """Échelle de meunier dont le haut des montants est en `haut_` (au niveau du pont), son pied plus loin le long de `d`
    (horizontal), sur le plancher `z_bas`."""
    run = (haut_.z - z_bas) / math.tan(math.radians(E["pente"]))
    pied = haut_ + d * run
    pied.z = z_bas
    cote = d.cross(Vector((0, 0, 1))).normalized()
    (lm, em), (rb, pas) = E["montant"], E["barreau"]
    axe = (haut_ - pied).normalized()
    for sg in (-1, 1):
        dec = cote * (sg * E["largeur"] / 2)
        poutre(maille, pied + dec, haut_ + dec, lm, em, cote, "bois")
    n = int((haut_.z - z_bas) / pas)
    for i in range(1, n + 1):
        c = pied + axe * ((haut_ - pied).length * i / (n + 0.5))
        espar(maille, c - cote * (E["largeur"] / 2), c + cote * (E["largeur"] / 2), rb, rb, 6, "bois")


class Pieces:
    """Les pièces des ponts `P` ramenées au modèle : pour chaque case, son plancher, le pont qui la couvre (la case la
    plus basse au-dessus d'elle ; une trappe y compte au niveau de son pied, le pont qu'elle perce), et, sous un pont de
    `SOUS_LES_PONTS` à paroi, la boîte creusée dans la coque à sa place."""

    def __init__(self, D, P, C):
        self.D, self.P, self.C = D, P, C
        self.pieds = {}
        for z, trappe, pied, _ in plan_de_jeu.echelles(P):
            self.pieds[trappe + (z,)] = P["cases"][pied + (z,)]
        self.couverture = {}
        for (x, y, z), g in P["cases"].items():
            h = P["hauteurs"][g]
            dessus = [(P["hauteurs"][gg], gg) for (xx, yy, zz), gg in
                      ((k, self.pieds.get(k, v)) for k, v in P["cases"].items()) if (xx, yy) == (x, y) and zz > z]
            dessus = [d for d in dessus if d[0] > h]
            self.couverture[(x, y, z)] = min(dessus)[1] if dessus else None

    def plancher(self, c):
        return self.P["hauteurs"][self.P["cases"][c]]

    def plafond(self, c):
        """z du dessous du pont qui couvre la case `c`, None sous le ciel."""
        g = self.couverture[c]
        return None if g is None else self.P["hauteurs"][g] - self.D["SOUS_LES_PONTS"][g]["epaisseur"]

    def creusee(self, c):
        g = self.couverture[c]
        return g is not None and self.D["SOUS_LES_PONTS"][g]["paroi"] is not None

    def au_niveau(self, c):
        """(plancher, plafond, glyphe couvrant) de la case `c` au niveau de son pont, pour ses cloisons : une trappe au
        niveau de son pied, sous le pont qu'elle perce ; une autre case comme elle est."""
        if c not in self.pieds:
            return self.plancher(c), self.plafond(c), self.couverture[c]
        g = self.P["cases"][c]
        return self.P["hauteurs"][self.pieds[c]], self.P["hauteurs"][g] - self.D["SOUS_LES_PONTS"][g]["epaisseur"], g

    def paroi(self, c, f, z):
        """Demi-largeur intérieure en (f, z) de la pièce de la case `c` : creusée, la muraille de sa paroi ; sous le
        gaillard ou le ciel, le pavois."""
        C = self.C
        g = self.couverture[c]
        if not self.creusee(c):
            return C.lisse(f) - self.D["PAVOIS"][0]
        sorte, decalage = self.D["SOUS_LES_PONTS"][g]["paroi"]
        if sorte == "bord":
            return C.bord(f, z) + decalage
        return C.lisse(f) + self.D["CHATEAU"]["niveaux"][4][1] + decalage

    def creusees_en(self, x, y, za, zb):
        """Une case creusée à la place (x, y), sur un pont quelconque, dont la boîte croise les hauteurs de za à zb."""
        return any(self.creusee(c) and self.plancher(c) < zb and self.plafond(c) > za
                   for c in self.P["cases"] if c[:2] == (x, y))

    def tient(self, c, x, y):
        """La place (x, y) voisine de la case `c` tiendrait une case de sa pièce : son milieu dans la paroi, à mi-hauteur."""
        if not (0 <= x < self.P["W"] and 0 <= y < self.P["H"]):
            return False
        C = self.C
        zm = (self.plancher(c) + (self.plafond(c) or self.plancher(c) + 2.0)) / 2
        return abs(C.x_du_plan(y + 0.5)) <= self.paroi(c, C.f(C.y_du_plan(x + 0.5)), zm)

    def mot(self, sens, x, y, z):
        return next((g for s, xx, yy, zz, g in self.P["aretes"] if (s, xx, yy, zz) == (sens, x, y, z)), " ")

    def bornes(self, c):
        """Bornes de la boîte de la case `c` : (y de, y à, x de, x à), x à None vers la paroi. Elle déborde de
        `CLOISON.marge` chez une voisine creusée aux mêmes hauteurs ; elle laisse `MURAILLE` devant une cloison du plan
        qui ne donne sur aucune ; elle va jusqu'à la paroi vers une voisine absente qui ne tiendrait pas."""
        x, y, z = c
        C, D = self.C, self.D
        za, zb = self.plancher(c), self.plafond(c) or self.plancher(c) + 2.0
        marge = D["CLOISON"]["marge"]

        def bout(vx, vy, sens, ax, ay):
            if self.creusees_en(vx, vy, za, zb):
                return marge
            return -D["MURAILLE"] if self.mot(sens, ax, ay, z) in plan_de_jeu.MURS + plan_de_jeu.PORTE + plan_de_jeu.SABORD + "o" else 0.0

        def cote(vx, vy):
            if self.creusees_en(vx, vy, za, zb):
                return marge
            if (vx, vy, z) in self.P["cases"] or self.tient(c, vx, vy):
                return 0.0
            return None

        ya = C.y_du_plan(x) - bout(x - 1, y, "t", x, y)
        yb = C.y_du_plan(x + 1) + bout(x + 1, y, "t", x + 1, y)
        bas, haut = cote(x, y - 1), cote(x, y + 1)
        xa = None if bas is None else C.x_du_plan(y) - bas
        xb = None if haut is None else C.x_du_plan(y + 1) + haut
        return ya, yb, xa, xb

    def creuser(self, interieurs):
        """Les boîtes des cases creusées, rognées à leur paroi au plancher et au plafond, rangée par rangée."""
        C = self.C
        for c in sorted(self.P["cases"]):
            if not self.creusee(c):
                continue
            ya, yb, xa, xb = self.bornes(c)
            za, zb = self.plancher(c), self.plafond(c)
            sections = []
            for i in range(9):
                yy = ya + (yb - ya) * i / 8
                f = C.f(yy)
                sec = []
                for zz in (za, zb):
                    w = self.paroi(c, f, zz)
                    sec.append((zz, -w if xa is None else max(xa, -w), w if xb is None else min(xb, w)))
                if all(b - a > 0.05 for _, a, b in sec):
                    sections.append((yy, sec))
            if len(sections) >= 2:
                prisme(interieurs, sections, "bois")


AXES = {"babord": Vector((1, 0, 0)), "tribord": Vector((-1, 0, 0)), "proue": Vector((0, -1, 0)), "poupe": Vector((0, 1, 0))}


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


def prisme(maille, sections, mat):
    """Volume fermé par des sections [(y, [(z bas, x de, x à), (z haut, x de, x à)])], bouts fermés."""
    sommets = []
    for yy, ((zb, ab, bb), (zh, ah, bh)) in sections:
        sommets.extend([(ab, yy, zb), (bb, yy, zb), (bh, yy, zh), (ah, yy, zh)])
    n = len(sections)
    faces = [[4 * i + k, 4 * i + (k + 1) % 4, 4 * (i + 1) + (k + 1) % 4, 4 * (i + 1) + k] for i in range(n - 1) for k in range(4)]
    faces += [[3, 2, 1, 0], [4 * (n - 1) + k for k in range(4)]]
    maille.ajouter(sommets, faces, mat)


def amenager(D, P, C, pieces, coque, interieurs):
    """Cloisons et portes des ponts, écoutilles et échelles qui les relient, membrures et baux de la cale, sur les arêtes
    des ponts `P`."""
    y_de, x_de = C.y_du_plan, C.x_du_plan
    A, PO = D["GAILLARD"], D["PORTE"]
    marge, ep_cl = D["CLOISON"]["marge"], D["CLOISON"]["epaisseur"]
    demi = PO["largeur"] / 2 + PO["cadre"][0] + 0.05

    def hauteur_de_porte(seuil, plafond):
        return min(PO["hauteur"], plafond - seuil - PO["jeu"])

    def etendue(cases, vy, za, zb, s, borne):
        """Borne `s` d'une cloison transversale entre les `cases`, prolongée jusqu'à la paroi `borne` si leurs voisines
        du rang `vy` sont absentes et ne tiendraient pas, comme leurs boîtes (`Pieces.bornes`)."""
        for c in cases:
            if (c[0], vy, c[2]) in P["cases"] or pieces.creusees_en(c[0], vy, za, zb) or pieces.tient(c, c[0], vy):
                return s
        return borne

    for z in range(P["ponts"]):
        for sens, xp, yp, g in plan_de_jeu.murs(P, z):
            a, b = [(cx, cy, z) for cx, cy in plan_de_jeu.voisines(sens, xp, yp)]
            porte = g == plan_de_jeu.PORTE
            niveaux = {c: pieces.au_niveau(c) for c in (a, b)}
            couvertes = [c for c in (a, b) if niveaux[c][2] is not None]
            if not couvertes:
                continue
            creusees = [c for c in couvertes if D["SOUS_LES_PONTS"][niveaux[c][2]]["paroi"] is not None]
            z0 = min(niveaux[a][0], niveaux[b][0])
            z1 = max(niveaux[c][1] for c in couvertes)
            seuil = max(niveaux[a][0], niveaux[b][0])
            h = hauteur_de_porte(seuil, min(niveaux[c][1] for c in couvertes))
            if sens == "t":
                yy = y_de(xp)
                f = C.f(yy)
                o, t, n = Vector((0, yy, 0)), Vector((1, 0, 0)), Vector((0, 1, 0))
                ref = creusees[0] if creusees else couvertes[0]
                hw = pieces.paroi(ref, f, (z0 + z1) / 2) + marge
                s0 = max(etendue((a, b), yp - 1, z0, z1, x_de(yp), -hw), -hw)
                s1 = min(etendue((a, b), yp + 1, z0, z1, x_de(yp + 1), hw), hw)
            else:
                xe = x_de(yp)
                ya = min(pieces.bornes(c)[0] for c in (a, b))
                yb = max(pieces.bornes(c)[1] for c in (a, b))
                ok = [ya + (yb - ya) * i / 40 for i in range(41)]
                ok = [v for v in ok if all(pieces.paroi(c, C.f(v), (z0 + z1) / 2) >= abs(xe) + ep_cl for c in (a, b))]
                if len(ok) < 2:
                    continue
                o, t, n = Vector((xe, 0, 0)), Vector((0, 1, 0)), Vector((1, 0, 0))
                s0, s1 = ok[0], ok[-1]
            if s1 - s0 < 0.3:
                continue
            sp = min(max((s0 + s1) / 2, s0 + demi), s1 - demi) if porte and s1 - s0 >= 2 * demi else None
            if len(creusees) == 1 and len(couvertes) == 1:
                # façade d'une pièce creusée sur un pont découvert : sa muraille, que la porte perce
                if sp is not None:
                    vers = 1.0 if creusees[0] == b else -1.0
                    zm = (niveaux[creusees[0]][0] + seuil + h) / 2
                    centre = o + t * sp + n * (vers * D["MURAILLE"] / 2)
                    poutre(interieurs, centre - n * (D["MURAILLE"] / 2 + 0.1) + Vector((0, 0, zm)),
                           centre + n * (D["MURAILLE"] / 2 + 0.1) + Vector((0, 0, zm)),
                           PO["largeur"], seuil + h - niveaux[creusees[0]][0], (0, 0, 1), "bois")
                    vantail(coque, o + n * (vers * D["MURAILLE"] / 2), t, -n * vers, sp, seuil, PO, h)
                continue
            ep = A["cloison"] if len(couvertes) == 1 else ep_cl
            cloison(coque, o, t, n, s0, s1, z0 - marge, z1 + marge, ep, None if sp is None else (sp, h),
                    {**PO, "seuil": seuil - z0 + marge})

    # écoutilles et échelles : l'ouverture dans le pont du dessus, au-dessus de la trappe, depuis l'arête de l'échelle,
    # creusée jusqu'au plancher du pied ; l'échelle à cheval sur l'arête, du plancher du pied au pont de la trappe
    EC, E = D["ECOUTILLE"], D["ECHELLE"]
    larg, long_ = EC["ouverture"]
    lh, hh = EC["hiloire"]
    for z, trappe, pied, (sens, xp, yp) in plan_de_jeu.echelles(P):
        z_haut, z_bas = plan_de_jeu.hauteur(P, z, *trappe), plan_de_jeu.hauteur(P, z, *pied)
        if sens == "t":
            d = Vector((0, 1 if pied[0] > trappe[0] else -1, 0))
            bord = Vector((x_de(yp + 0.5), y_de(xp), 0))
        else:
            d = Vector((1 if pied[1] > trappe[1] else -1, 0, 0))
            bord = Vector((x_de(yp), y_de(xp + 0.5), 0))
        cote = d.cross(Vector((0, 0, 1))).normalized()
        centre = bord - d * (long_ / 2)
        zc = (z_bas + z_haut + 0.1) / 2
        poutre(interieurs, centre - d * (long_ / 2) + Vector((0, 0, zc)), centre + d * (long_ / 2) + Vector((0, 0, zc)),
               z_haut + 0.1 - z_bas, larg, cote, "bois")
        boite_ = [centre + cote * (sx * larg / 2) + d * (sy * long_ / 2) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        for k, (p0, p1) in enumerate(zip(boite_, boite_[1:] + boite_[:1])):
            m = (p0 + p1) / 2
            vers = (m - centre)
            vers.z = 0
            vers.normalize()
            bout = (p1 - p0).normalized() * (lh if k % 2 == 0 else 0.0)    # deux côtés couvrent les coins, les autres y butent
            a_, b_ = p0 + vers * (lh / 2) - bout, p1 + vers * (lh / 2) + bout
            poutre(coque, a_ + Vector((0, 0, z_haut + hh / 2 - 0.02)), b_ + Vector((0, 0, z_haut + hh / 2 - 0.02)), hh + 0.04, lh, vers, "bois")
        run = (z_haut - z_bas) / math.tan(math.radians(E["pente"]))
        echelle(coque, bord - d * (run / 2) + Vector((0, 0, z_haut)), d, z_bas, E)

    # cale : membrures le long des murailles qu'atteignent les pièces de son fond, baux sous le pont du dessus, sur un pas
    # commun depuis la proue
    M = D["MEMBRURES"]
    fond = min(pieces.plancher(c) for c in P["cases"] if c[2] == 0)
    for c in sorted(c for c in P["cases"] if c[2] == 0 and pieces.creusee(c) and pieces.plancher(c) == fond):
        ya, yb, xa, xb = pieces.bornes(c)
        za, zb = pieces.plancher(c), pieces.plafond(c)
        for k in range(math.ceil((ya - y_de(0)) / M["pas"] - 0.5), math.floor((yb - y_de(0)) / M["pas"] - 0.5) + 1):
            yy = y_de(0) + M["pas"] * (k + 0.5)
            f = C.f(yy)
            wb, wt = pieces.paroi(c, f, za), pieces.paroi(c, f, zb)
            for sg, libre in ((1, xb is None), (-1, xa is None)):
                if libre:
                    p0 = Vector((sg * (wb - M["section"][1] / 2 + 0.02), yy, za))
                    p1 = Vector((sg * (wt - M["section"][1] / 2 + 0.02), yy, zb))
                    poutre(coque, p0, p1, M["section"][0], M["section"][1], (sg, 0, 0), "bois")
            if k % 2 == 0 and c[1] == P["H"] // 2:
                lb, eb = M["baux"]
                poutre(coque, (-wt - 0.02, yy, zb - eb / 2), (wt + 0.02, yy, zb - eb / 2), lb, eb, (0, 0, 1), "bois")


def plus_grand_rectangle(libre):
    """Le plus grand rectangle de cellules vraies de la grille `libre` (rangs de booléens) : (i0, j0, i1, j1), les fins
    exclues."""
    colonnes, meilleur, aire = [0] * len(libre[0]), (0, 0, 0, 0), 0
    for i, rang in enumerate(libre):
        colonnes = [c + 1 if v else 0 for c, v in zip(colonnes, rang)]
        pile = []
        for j, c in enumerate(colonnes + [0]):
            debut = j
            while pile and pile[-1][1] >= c:
                debut, ck = pile.pop()
                if ck * (j - debut) > aire:
                    aire, meilleur = ck * (j - debut), (i - ck + 1, debut, i + 1, j)
            pile.append((debut, c))
    return meilleur


def emprises(D, P, C):
    """L'emprise libre de chaque case que la scène rogne au-delà de l'écart toléré, en cases du plan : {"x,y,z": [x0, y0,
    x1, y1]}, la case (x, y) couvrant [x, x+1] × [y, y+1]. Une sonde de la grille de la case (`EMPRISE`) part d'une
    stature au-dessus de sa hauteur : elle est libre quand elle n'est pas dans la matière (ce qu'elle touche d'abord de part
    et d'autre en travers ne lui tourne pas le dos) et que, vers le bas, elle touche d'abord un plancher à cette hauteur. L'emprise est
    le plus grand rectangle de sondes libres."""
    E = D["EMPRISE"]
    graphe = bpy.context.evaluated_depsgraph_get()
    n = round(C.case / E["pas"])
    bas, cote = Vector((0, 0, -1)), Vector((1, 0, 0))

    def libre(px, py, h):
        o = Vector((C.x_du_plan(py), C.y_du_plan(px), h + E["stature"]))
        if all(ok and normale.dot(d) > 0 for d in (cote, -cote) for ok, _, normale, _, _, _ in [bpy.context.scene.ray_cast(graphe, o, d)]):
            return False
        ok, lieu, normale, _, _, _ = bpy.context.scene.ray_cast(graphe, o, bas, distance=E["stature"] + E["ecart"])
        return ok and normale.z > 0.5 and abs(lieu.z - h) <= E["ecart"]

    sortie = {}
    for (cx, cy, z), g in sorted(P["cases"].items()):
        h = P["hauteurs"][g]
        i0, j0, i1, j1 = plus_grand_rectangle([[libre(cx + (i + 0.5) / n, cy + (j + 0.5) / n, h) for j in range(n)] for i in range(n)])
        if max(i0, j0, n - i1, n - j1) * E["pas"] > E["ecart"] + 1e-9:
            sortie[f"{cx},{cy},{z}"] = [round(v, 3) for v in (cx + i0 / n, cy + j0 / n, cx + i1 / n, cy + j1 / n)]
    return sortie


def construire(D, P):
    """Bâtit la caraque sur ses ponts `P` (`plan_de_jeu.py`) ; rend les `postes`, `selon`, `ancrages` et `cases` de son manifeste,
    en mètres glTF."""
    tous = list(habillage.materiaux(D["MATERIAUX"]).values())
    C = Coque(D, P)
    y = C.y
    GL = D["GLYPHES"]
    (xm, ym_), = [(x, yy) for (x, yy, _), g in P["cases"].items() if g == GL["mat"]]
    D = {**D, "MATS": {**D["MATS"], "grand_mat": {**D["MATS"]["grand_mat"], "f": C.f(C.y_du_plan(xm + 0.5)), "x": C.x_du_plan(ym_ + 0.5)}}}

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
    F = D["FANAL"]
    yf = y(1.0) - 0.4
    espar(coque, (0, yf, C.hauteur(GL["plage"])), (0, yf, F["z"]), F["pied"], F["pied"], 6, "fer")
    fuseau(coque, (0, yf, F["z"]), (0, yf, F["z"] + F["hauteur"]),
           [(0, 0), (0, F["rayon"] * 0.6), (0.15, F["rayon"]), (0.75, F["rayon"]), (0.85, F["rayon"] * 0.5), (1, 0)], 8, "fer")

    # gaillard d'avant en surplomb : avant plat, fond, pavois, pont ; cloison arrière jusqu'au pont principal
    A = D["GAILLARD"]
    f_arriere = A["stations"][-1]
    largeur = A["largeur"] + [(f_arriere, C.lisse(f_arriere) + 0.12)]
    anneaux = [[(lineaire(largeur, f) + saillie, y(f), z) for f in A["stations"]] for z, saillie in A["niveaux"]]
    gaillard = Maille(tous)
    enceinte(gaillard, anneaux, False, A["garde_corps"], lambda _: C.hauteur(GL["gaillard"]), "bois")

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
    x_av = lineaire(largeur, 0.0) + sa
    poutre(coque, (-x_av, y(0.0) + 0.125, (z_mur + CV["haut"]) / 2), (x_av, y(0.0) + 0.125, (z_mur + CV["haut"]) / 2),
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
    ouvertures, cadres = Maille(tous), Maille(tous)

    def au_pont(face, bord, plancher):
        """Pièce dont la bouche passe par-dessus le plat-bord de face intérieure `face` (x ou y selon le bord)."""
        origine = Vector(face) - AXES[bord] * CA["recul"]
        postes.setdefault(bord, []).append((origine.x, origine.y, plancher))

    for G in D["POSTES_DU_PONT"]:
        for bord in G["bords"]:
            if "cases" in G:
                for xp in G["cases"]:
                    yy = C.y_du_plan(xp + 0.5)
                    x = AXES[bord].x * (C.lisse(C.f(yy)) - D["PAVOIS"][0])
                    au_pont((x, yy, 0), bord, C.pont(yy))
            else:
                yy = y(0.0) + 0.25 if bord == "proue" else y(1.0) - D["BALUSTRADE"]["main"][0] - 0.02
                for x in G["x"]:
                    au_pont((x, yy, 0), bord, C.hauteur(G["plancher"]))

    def boite(maille, centre, axe, largeur, hauteur, devant, derriere, mat):
        """Boîte de `largeur` × `hauteur` centrée sur `centre`, de `derriere` avant lui à `devant` après lui le long
        d'`axe` (horizontal)."""
        cote = axe.cross(Vector((0, 0, 1))).normalized()
        haut = Vector((0, 0, hauteur / 2))
        coins = [(-cote * largeur / 2 - haut), (cote * largeur / 2 - haut), (cote * largeur / 2 + haut), (-cote * largeur / 2 + haut)]
        sommets = [tuple(centre - axe * derriere + c) for c in coins] + [tuple(centre + axe * devant + c) for c in coins]
        maille.ajouter(sommets, [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]], mat)

    def sabord(centre, bord, plancher, cartouche, profondeur):
        """Ouverture traversant la muraille au point `centre` de sa face extérieure, jusqu'à `profondeur` au moins ; cadre
        et cartouche dans `cadres`."""
        c, a = Vector(centre), AXES[bord]
        cote = a.cross(Vector((0, 0, 1))).normalized()
        haut = Vector((0, 0, 1))
        boite(ouvertures, c, a, lo, ho, 0.6, max(0.7, profondeur + 0.1), "bois")
        for s_ in (1, -1):
            poutre(cadres, c + haut * s_ * (ho + cadre) / 2 - cote * (lo / 2 + cadre), c + haut * s_ * (ho + cadre) / 2 + cote * (lo / 2 + cadre), cadre, 2 * saillie_cadre, a, "bois")
            poutre(cadres, c + cote * s_ * (lo + cadre) / 2 - haut * ho / 2, c + cote * s_ * (lo + cadre) / 2 + haut * ho / 2, cadre, 2 * saillie_cadre, a, "bois")
        if cartouche:
            r_arc, ep_arc, sa_arc = CT["arc"]
            r = lo / 2 + cadre + r_arc
            pied_arc = c + a * (saillie_cadre + sa_arc / 2) + haut * (ho / 2 + cadre / 2)
            pas = 7
            for k in range(pas):
                a0, a1 = math.pi * k / pas, math.pi * (k + 1) / pas
                p0 = pied_arc + cote * (r * math.cos(a0)) + haut * (r * math.sin(a0))
                p1 = pied_arc + cote * (r * math.cos(a1)) + haut * (r * math.sin(a1))
                poutre(cadres, p0, p1, ep_arc, sa_arc, a, "dorure")
            lp, hp, sp, ecart = CT["panneau"]
            centre_p = c + a * (sp / 2) - haut * (ho / 2 + cadre + ecart + hp / 2)
            poutre(cadres, centre_p - cote * lp / 2, centre_p + cote * lp / 2, hp, 2 * sp, a, "bois")
            poutre(cadres, centre_p + a * sp - cote * lp * 0.3, centre_p + a * sp + cote * lp * 0.3, hp * 0.45, 0.04, a, "dorure")
        origine = c - a * (CA["bouche"] - CA["saillie"])
        sabords.setdefault(bord, []).append((origine.x, origine.y, plancher))

    pieces = Pieces(D, P, C)
    for centre, bord, plancher, sorte, profondeur in sabords_des_ponts(D, P, C, pieces):
        sabord(centre, bord, plancher, sorte != "bord", profondeur)

    pieces.creuser(interieurs)
    amenager(D, P, C, pieces, coque, interieurs)

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
    for (fa, za), (fb_, zb) in D["ETAIS"]:
        fa = D["MATS"][fa]["f"] if fa in D["MATS"] else fa
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
    aux_cases = {nom: [gltf(x, C.y_du_plan(xp), C.pont(C.y_du_plan(xp)) if z == "pont" else z) for x, xp, z in points]
                 for nom, points in D["ANCRAGES_AUX_CASES"].items()}
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
    objet("avec-sabord", cadres, (0.0, 0.0, 0.0), 35)
    for nom in ("beaupre", "misaine", "grand_mat", "grand_mat_arriere", "artimon"):
        mm, pied = noeuds[nom]
        objet(nom, mm, pied, 35)
    sortie["cases"] = emprises(D, P, C)
    return sortie


def booleen(obj, operation, operande):
    """`obj` remplacé par son opération booléenne exacte avec `operande` (les faces nées de l'opérande prennent ses
    matériaux)."""
    mod = obj.modifiers.new("booleen", "BOOLEAN")
    mod.operation, mod.solver, mod.object, mod.material_mode = operation, "EXACT", operande, "TRANSFER"
    mod.use_hole_tolerant = True
    mod.use_self = True          # l'opérande réunit des volumes qui se chevauchent (écoutilles, portes, ponts)
    evalue = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    maillage = bpy.data.meshes.new_from_object(evalue)
    obj.modifiers.remove(mod)
    ancien, obj.data = obj.data, maillage
    bpy.data.meshes.remove(ancien)


def reunir(cible, sources):
    """Les meshes de `sources` versés dans `cible` (matériaux réunis par nom), puis supprimés."""
    bm = bmesh.new()
    bm.from_mesh(cible.data)
    noms = [m.name for m in cible.data.materials]
    for src in sources:
        avant = len(bm.faces)
        bm.from_mesh(src.data)
        bm.faces.ensure_lookup_table()
        for face in bm.faces[avant:]:
            mat = src.data.materials[face.material_index]
            if mat.name not in noms:
                noms.append(mat.name)
                cible.data.materials.append(mat)
            face.material_index = noms.index(mat.name)
        bpy.data.objects.remove(src)
    bm.to_mesh(cible.data)
    bm.free()
    for poly in cible.data.polygons:
        poly.use_smooth = True
    cible.data.set_sharp_from_angle(angle=math.radians(35))


def percer(coque, solides, interieurs, ouvertures):
    """Réunit les `solides` (bordé, château, gaillard) en un seul volume, sans faces internes qui se chevauchent, y creuse
    les `interieurs` (cale, entrepont, pièces du château, écoutilles, portes, passages de la passerelle), puis les `ouvertures` des
    sabords : ce qui les traverse va au nœud `sans-sabord` (le bordé qui les bouche sans Sabord), le reste à `coque`."""
    solide = solides[0]
    for s_ in solides[1:]:
        booleen(solide, "UNION", s_)
        bpy.data.objects.remove(s_)
    booleen(solide, "DIFFERENCE", interieurs)
    sans = solide.copy()
    sans.data = solide.data.copy()
    bpy.context.scene.collection.objects.link(sans)
    booleen(sans, "INTERSECT", ouvertures)
    booleen(solide, "DIFFERENCE", ouvertures)
    reunir(sans, [])
    sans.name = sans.data.name = "sans-sabord"
    reunir(coque, [solide])
    for o in (interieurs, ouvertures):
        bpy.data.objects.remove(o)


def elements(D):
    """La caraque, puis les pièces de ses Améliorations."""
    from caraque import ameliorations
    P = plan_de_jeu.lire(VEHICULES, "caraque")
    yield {"glb": "caraque", "cles": [("vehicule", {"definition": "caraque"})], "materiaux": D["MATERIAUX"],
           "blasons": D["BLASONS"], "construire": lambda: construire(D, P)}
    yield from ameliorations.elements(D, P)
