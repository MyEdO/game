"""Pièces communes des navires bâtis sur leurs ponts (`ponts` de leur fiche dans `src/data/vehicles.json`,
`plan_de_jeu.py`, #3686, #3790) : la coque et sa forme (`Coque`, `enceinte`), espars et toiles, cloisons, portes,
écoutilles et échelles des arêtes du plan (`amenager`), pièces creusées dans le volume (`Pieces`, `prisme`), emprise
libre de chaque case (`emprises`), opérations booléennes. Chaque fonction lit ses dimensions nommées dans les données
`D` du navire ; repère de `maille.py`, la proue vers -y."""
import math

import bmesh
import bpy
from mathutils import Vector

import plan_de_jeu
from maille import lineaire, poutre


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
        """Demi-largeur intérieure en (f, z) de la pièce de la case `c` : creusée, la muraille de sa paroi (« bord » : le
        bordé ; « chateau » : la muraille du château, `CHATEAU`) ; sous un pont ouvert ou le ciel, le pavois."""
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
    PO = D["PORTE"]
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
            ep = D["CLOISON"]["sous_un_pont"] if len(couvertes) == 1 else ep_cl
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


def fondre(solides, interieurs):
    """Les `solides` réunis en un seul volume, sans faces internes qui se chevauchent, creusé des `interieurs` (pièces,
    écoutilles, portes), qui sont supprimés ; rend ce volume."""
    solide = solides[0]
    for s_ in solides[1:]:
        booleen(solide, "UNION", s_)
        bpy.data.objects.remove(s_)
    booleen(solide, "DIFFERENCE", interieurs)
    bpy.data.objects.remove(interieurs)
    return solide
