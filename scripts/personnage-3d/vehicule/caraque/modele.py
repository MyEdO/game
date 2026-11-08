"""La caraque (fiche `caraque` de `src/data/vehicles.json`, #2987 lots V3 à V5) : les nœuds `coque`, `beaupre`,
`misaine`, `grand_mat`, `grand_mat_arriere`, `artimon`, et ceux que l'Amélioration Sabord départage : `avec-sabord`
(cadres et cartouches des sabords), `sans-sabord` (le bordé qui bouche leurs ouvertures) ; meshes sans skin ni
armature. Portes, écoutilles, échelles et cale suivent le plan de jeu (`src/noyau/planDeLaCaraque.ts`,
`plan_de_jeu.py`). L'emprise est recentrée en x et y ; z = 0 reste la flottaison. Les Améliorations navales se bâtissent
sur sa coque (`ameliorations.py`)."""
import math

import bmesh
import bpy
from mathutils import Vector

import habillage
from caraque import plan_de_jeu
from maille import Maille, lineaire, objet, poutre

PLAN_DE_JEU = habillage.DEPOT / "src" / "noyau" / "planDeLaCaraque.ts"


def nettoyee(face):
    """La face sans sommet répété consécutif (anneau cyclique) ; None si moins de trois sommets restent."""
    sortie = []
    for i in face:
        if not sortie or sortie[-1] != i:
            sortie.append(i)
    if len(sortie) > 1 and sortie[0] == sortie[-1]:
        sortie.pop()
    return sortie if len(set(sortie)) >= 3 else None


class Coque:
    """Fonctions de forme lues dans les données : y d'une abscisse f, demi-largeur d'un niveau, plat-bord."""

    def __init__(self, D):
        self.D = D
        self.L = D["LONGUEUR"]

    def y(self, f):
        return (f - 0.5) * self.L

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


def etendue(C, V):
    """Bornes (f de, f à) du volume intérieur `V` : là où sa demi-largeur, plancher et plafond, atteint `largeur_min`,
    jusqu'à `f_max`."""
    (za, zb), ep = V["z"], V["muraille"]
    ok = [f / 1000 for f in range(0, round(V["f_max"] * 1000) + 1)
          if min(C.bord(f / 1000, za), C.bord(f / 1000, zb)) - ep >= V["largeur_min"]]
    return ok[0], ok[-1]


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


def amenager(D, P, C, coque, interieurs):
    """Cloisons et portes des ponts du plan de jeu, écoutilles et échelles qui les relient, membrures, baux et barriques
    de la cale. Les cases du plan ramenées au modèle par `PLAN` (`calage` en x, `case` en y)."""
    y = C.y
    H = P["H"]
    case = D["PLAN"]["case"]
    f_de = lambda xp: lineaire(D["PLAN"]["calage"], xp)  # noqa: E731
    x_de = lambda yp: (yp - H / 2) * case  # noqa: E731
    A, K, PO = D["GAILLARD"], D["CHATEAU"], D["PORTE"]
    CL, EN, CB = D["CALE"], D["ENTREPONT"], D["CHATEAU_BAS"]
    fc, zc0, zc1, ep_c = A["cloison"]
    f_facade = K["stations"][0]
    marge = D["CLOISON"]["marge"]

    def carve(V, f):
        (za, zb), ep = V["z"], V["muraille"]
        return min(C.bord(f, za), C.bord(f, zb)) - ep

    def volume(z, f):
        """(demi-largeur, plancher, plafond) du pont `z` du plan en `f`, None hors de ses volumes intérieurs."""
        if z == 0 and CL["f"][0] <= f <= CL["f"][1]:
            return carve(CL, f), *CL["z"]
        if z == 1 and EN["f"][0] <= f <= EN["f"][1]:
            return carve(EN, f), *EN["z"]
        if z == 2 and f < fc:
            return C.lisse(f) - D["PAVOIS"][0], lineaire(D["PONT"], f), A["niveaux"][0][0]
        if z == 2 and f_facade + CB["facade"] / C.L <= f <= 1.0 - CB["facade"] / C.L:
            return C.lisse(f) - CB["muraille"], *CB["z"]
        return None

    def hauteur_de_porte(seuil, plafond):
        return min(PO["hauteur"], plafond - seuil - PO["jeu"])

    # cloisons et portes
    for z in range(3):
        for sens, xp, yp, g in plan_de_jeu.murs(P, z):
            porte = g == ":"
            if sens == "t":
                f = f_de(xp)
                o = Vector((0, y(f), 0))
                t, n = Vector((1, 0, 0)), Vector((0, 1, 0))
                s0, s1 = x_de(yp), x_de(yp + 1)
                if z == 2 and abs(f - f_facade) < 1e-6:
                    # façade du château sur l'embelle : la porte perce la muraille pleine jusqu'à la pièce du dessous
                    if porte:
                        sp = (s0 + s1) / 2
                        z_seuil = lineaire(D["PONT"], f)
                        h = hauteur_de_porte(z_seuil, CB["z"][1])
                        zm = (CB["z"][0] + z_seuil + h) / 2
                        poutre(interieurs, (sp, y(f) - 0.01, zm), (sp, y(f) + CB["facade"] + 0.1, zm),
                               PO["largeur"], z_seuil + h - CB["z"][0], (0, 0, 1), "bois")
                        vantail(coque, o + Vector((0, CB["facade"] / 2, 0)), t, -n, sp, z_seuil, PO, h)
                    continue
                if z == 2 and abs(f - fc) < 1e-6:
                    hw, z0, z1, ep = C.lisse(fc) - D["PAVOIS"][0] + 0.05, zc0, zc1, ep_c
                    seuil = lineaire(D["PONT"], fc)
                else:
                    v = volume(z, f)
                    if v is None:
                        continue
                    hw, z0, z1 = v
                    hw, ep, seuil = hw + marge, D["CLOISON"]["epaisseur"], z0
                s0, s1 = max(s0, -hw), min(s1, hw)
                if s1 - s0 < 0.3:
                    continue
                h = hauteur_de_porte(seuil, min(z1, A["niveaux"][0][0]) if z == 2 and f <= fc else z1)  # sous le gaillard
                demi = PO["largeur"] / 2 + PO["cadre"][0] + 0.05
                sp = min(max((s0 + s1) / 2, s0 + demi), s1 - demi) if porte and s1 - s0 >= 2 * demi else None
                cloison(coque, o, t, n, s0, s1, z0 - marge, z1 + marge, ep, None if sp is None else (sp, h), {**PO, "seuil": seuil - z0 + marge})
            else:
                xe = x_de(yp)
                fa, fb = f_de(xp), f_de(xp + 1)
                ok = [fa + (fb - fa) * i / 40 for i in range(41)]
                ok = [f for f in ok if volume(z, f) and volume(z, f)[0] >= abs(xe) + D["CLOISON"]["epaisseur"]]
                if len(ok) < 2:
                    continue
                fa, fb = ok[0], ok[-1]
                _, z0, z1 = volume(z, (fa + fb) / 2)
                o = Vector((xe, 0, 0))
                t, n = Vector((0, 1, 0)), Vector((1, 0, 0))
                s0, s1 = y(fa) - marge, y(fb) + marge
                h = hauteur_de_porte(z0, z1)
                demi = PO["largeur"] / 2 + PO["cadre"][0] + 0.05
                sp = (s0 + s1) / 2 if porte and s1 - s0 >= 2 * demi else None
                cloison(coque, o, t, n, s0, s1, z0 - marge, z1 + marge, D["CLOISON"]["epaisseur"], None if sp is None else (sp, h), {**PO, "seuil": marge})

    # écoutilles et échelles : l'ouverture dans le pont de la trappe, du bord de l'arête vers la case du pied ; l'échelle
    # du plancher du pied jusqu'au bord de l'arête
    EC, E = D["ECOUTILLE"], D["ECHELLE"]
    larg, long_ = EC["ouverture"]
    lh, hh = EC["hiloire"]
    for z, trappe, pied, (sens, xp, yp) in plan_de_jeu.echelles(P):
        glyphe = plan_de_jeu.case(P, z, *trappe)
        if sens == "t":
            f_e = f_de(xp)
            d = Vector((0, 1 if pied[0] > trappe[0] else -1, 0))
            bord = Vector((min(max(x_de(trappe[1] + 0.5), -EC["x_max"]), EC["x_max"]), y(f_e), 0))
        else:
            f_e = f_de(trappe[0] + 0.5)
            d = Vector((1 if pied[1] > trappe[1] else -1, 0, 0))
            bord = Vector((x_de(yp), y(f_e), 0))
        f_pied = f_e + d.y * (long_ / 2) / C.L
        z_bas = {0: CL["z"][0], 1: EN["z"][0]}.get(z) or (lineaire(D["PONT"], f_pied) if f_pied < fc else CB["z"][0])
        z_haut, z_coupe = {"j": (EN["z"][0], CL["z"][1]), "k": (lineaire(D["PONT"], f_e), EN["z"][1]),
                           "g": (A["pont"], A["niveaux"][0][0]), "h": (K["pont"], CB["z"][1])}[glyphe]
        cote = d.cross(Vector((0, 0, 1))).normalized()
        centre = bord + d * (long_ / 2)
        boite_ = [centre + cote * (sx * larg / 2) + d * (sy * long_ / 2) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        zc = (z_coupe - 0.05 + z_haut + 0.1) / 2
        poutre(interieurs, centre - d * (long_ / 2) + Vector((0, 0, zc)), centre + d * (long_ / 2) + Vector((0, 0, zc)),
               z_haut + 0.1 - z_coupe + 0.05, larg, cote, "bois")
        for k, (a, b) in enumerate(zip(boite_, boite_[1:] + boite_[:1])):
            m = (a + b) / 2
            vers = (m - centre)
            vers.z = 0
            vers.normalize()
            bout = (b - a).normalized() * (lh if k % 2 == 0 else 0.0)    # deux côtés couvrent les coins, les autres y butent
            a_, b_ = a + vers * (lh / 2) - bout, b + vers * (lh / 2) + bout
            poutre(coque, a_ + Vector((0, 0, z_haut + hh / 2 - 0.02)), b_ + Vector((0, 0, z_haut + hh / 2 - 0.02)), hh + 0.04, lh, vers, "bois")
        echelle(coque, bord + d * E["marge"] + Vector((0, 0, z_haut)), d, z_bas, E)

    # cale : membrures le long de la muraille, baux sous le plancher de l'entrepont, barriques cerclées
    M = D["MEMBRURES"]
    (za, zb), ep = CL["z"], CL["muraille"]
    f = CL["f"][0] + M["pas"] / C.L / 2
    k = 0
    while f < CL["f"][1]:
        wb, wt = C.bord(f, za) - ep, C.bord(f, zb) - ep
        for sg in (1, -1):
            a = Vector((sg * (wb - M["section"][1] / 2 + 0.02), y(f), za))
            b = Vector((sg * (wt - M["section"][1] / 2 + 0.02), y(f), zb))
            poutre(coque, a, b, M["section"][0], M["section"][1], (sg, 0, 0), "bois")
        if k % 2 == 0:
            lb, eb = M["baux"]
            poutre(coque, (-wt - 0.02, y(f), zb - eb / 2), (wt + 0.02, y(f), zb - eb / 2), lb, eb, (0, 0, 1), "bois")
        f += M["pas"] / C.L
        k += 1
    B = D["BARRIQUES"]
    r0, r1 = B["rayons"]
    hb = B["hauteur"]
    profil = [(0, 0), (0, r0), (0.25, r1 * 0.96), (0.5, r1), (0.75, r1 * 0.96), (1, r0), (1, 0)]
    f = B["f"][0]
    while f <= B["f"][1]:
        wb = C.bord(f, za) - ep
        for rang in range(B["rangs"]):
            for sg in (1, -1):
                c = Vector((sg * (wb - 0.6 - rang * (2 * r1 + 0.1)), y(f), za))
                fuseau(coque, c, c + Vector((0, 0, hb)), profil, 8, "bois")
                for t_ in (0.12, 0.88):
                    r = r0 + (r1 * 0.96 - r0) * min(t_, 1 - t_) / 0.25 + 0.012
                    fuseau(coque, c + Vector((0, 0, hb * t_ - 0.03)), c + Vector((0, 0, hb * t_ + 0.03)), [(0, 0), (0, r), (1, r), (1, 0)], 8, "fer")
        f += B["pas"] / C.L


def construire(D, P):
    """Bâtit la caraque ; rend les `postes`, `selon` et `ancrages` de son manifeste, en mètres glTF."""
    D = {**D, "CALE": dict(D["CALE"]), "ENTREPONT": dict(D["ENTREPONT"])}
    tous = list(habillage.materiaux(D["MATERIAUX"]).values())
    C = Coque(D)
    y = C.y

    # coque : bordé lissé de la quille au plat-bord, préceinte, pavois, pont (un solide, que les sabords percent) ;
    # gouvernail
    coque = Maille(tous)
    bordage, chateau = Maille(tous), Maille(tous)
    anneaux = []
    for n in range(len(D["NIVEAUX"])):
        rang = []
        for u in D["STATIONS"]:
            w, f, z = C.niveau(n, u)
            rang.append((w, y(f), z))
        anneaux.append(rang)
    pont = D["PONT"]
    enceinte(bordage, anneaux, True, D["PAVOIS"], lambda yy: lineaire(pont, yy / C.L + 0.5), "bois")
    G = D["GOUVERNAIL"]
    (fb, zb), (fh, zh) = G["bas"], G["haut"]
    poutre(coque, (0, y(fb) + G["recul"], zb), (0, y(fh) + G["recul"], zh), G["corde"], G["epaisseur"], (1, 0, 0), "bois")

    # château de poupe : murailles sur le plat-bord, bandeau de base, balustrade, pont de dunette ; sabords
    K = D["CHATEAU"]
    anneaux = [[(C.lisse(f) + saillie, y(f), z) for f in K["stations"]] for z, saillie in K["niveaux"]]
    enceinte(chateau, anneaux, False, K["garde_corps"], lambda _: K["pont"], "bois")
    F = D["FANAL"]
    yf = y(1.0) - 0.4
    espar(coque, (0, yf, K["pont"]), (0, yf, F["z"]), F["pied"], F["pied"], 6, "fer")
    fuseau(coque, (0, yf, F["z"]), (0, yf, F["z"] + F["hauteur"]),
           [(0, 0), (0, F["rayon"] * 0.6), (0.15, F["rayon"]), (0.75, F["rayon"]), (0.85, F["rayon"] * 0.5), (1, 0)], 8, "fer")

    # gaillard d'avant en surplomb : avant plat, fond, pavois, pont ; cloison arrière jusqu'au pont principal
    A = D["GAILLARD"]
    f_arriere = A["stations"][-1]
    largeur = A["largeur"] + [(f_arriere, C.lisse(f_arriere) + 0.12)]
    anneaux = [[(lineaire(largeur, f) + saillie, y(f), z) for f in A["stations"]] for z, saillie in A["niveaux"]]
    gaillard = Maille(tous)
    enceinte(gaillard, anneaux, False, A["garde_corps"], lambda _: A["pont"], "bois")

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
    segs_g = contour(bords_g)[:-1]          # sans l'avant plat
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
    for f in DF["f"]:
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
    AXES = {"babord": Vector((1, 0, 0)), "tribord": Vector((-1, 0, 0)), "proue": Vector((0, -1, 0)), "poupe": Vector((0, 1, 0))}
    postes, sabords = {}, {}
    ouvertures, cadres = Maille(tous), Maille(tous)

    def au_pont(face, bord, plancher):
        """Pièce dont la bouche passe par-dessus le plat-bord de face intérieure `face` (x ou y selon le bord)."""
        origine = Vector(face) - AXES[bord] * CA["recul"]
        postes.setdefault(bord, []).append((origine.x, origine.y, plancher))

    for G in D["POSTES_DU_PONT"]:
        for bord in G["bords"]:
            if "f" in G:
                for f in G["f"]:
                    x = AXES[bord].x * (C.lisse(f) - D["PAVOIS"][0])
                    au_pont((x, y(f), 0), bord, lineaire(D["PONT"], f))
            else:
                yy = y(0.0) + 0.25 if bord == "proue" else y(1.0) - D["BALUSTRADE"]["main"][0] - 0.02
                for x in G["x"]:
                    au_pont((x, yy, 0), bord, G["plancher"])

    def boite(maille, centre, axe, largeur, hauteur, devant, derriere, mat):
        """Boîte de `largeur` × `hauteur` centrée sur `centre`, de `derriere` avant lui à `devant` après lui le long
        d'`axe` (horizontal)."""
        cote = axe.cross(Vector((0, 0, 1))).normalized()
        haut = Vector((0, 0, hauteur / 2))
        coins = [(-cote * largeur / 2 - haut), (cote * largeur / 2 - haut), (cote * largeur / 2 + haut), (-cote * largeur / 2 + haut)]
        sommets = [tuple(centre - axe * derriere + c) for c in coins] + [tuple(centre + axe * devant + c) for c in coins]
        maille.ajouter(sommets, [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]], mat)

    def sabord(centre, bord, plancher, cartouche):
        """Ouverture traversant la muraille au point `centre` de sa face extérieure ; cadre et cartouche dans `cadres`."""
        c, a = Vector(centre), AXES[bord]
        cote = a.cross(Vector((0, 0, 1))).normalized()
        haut = Vector((0, 0, 1))
        boite(ouvertures, c, a, lo, ho, 0.6, 0.7, "bois")
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

    saillie_chateau = K["niveaux"][4][1]
    for G in D["SABORDS"]:
        zc = G["plancher"] + CA["axe"]
        for bord in G["bords"]:
            if "f" in G:
                for f in G["f"]:
                    mur = C.bord(f, zc) if G["groupe"] == "batterie" else C.lisse(f) + saillie_chateau
                    sabord((AXES[bord].x * mur, y(f), zc), bord, G["plancher"], G["groupe"] == "chateau")
            else:
                for x in G["x"]:
                    sabord((x, y(1.0), zc), bord, G["plancher"], True)

    def solide(maille, profils, mat):
        """Volume fermé par des sections [(y, z bas, demi-largeur en bas, z haut, demi-largeur en haut)], bouts fermés."""
        sommets = []
        for yy, zb, wb, zh, wh in profils:
            sommets.extend([(-wb, yy, zb), (wb, yy, zb), (wh, yy, zh), (-wh, yy, zh)])
        faces = [[4 * i + k, 4 * i + (k + 1) % 4, 4 * (i + 1) + (k + 1) % 4, 4 * (i + 1) + k] for i in range(len(profils) - 1) for k in range(4)]
        faces += [[3, 2, 1, 0], [4 * (len(profils) - 1) + k for k in range(4)]]
        maille.ajouter(sommets, faces, mat)

    interieurs = Maille(tous)
    for V in (D["CALE"], D["ENTREPONT"]):
        V["f"] = etendue(C, V)
        (fa, fb_), (za, zb_), ep = V["f"], V["z"], V["muraille"]
        fs = [fa + (fb_ - fa) * i / 24 for i in range(25)]
        solide(interieurs, [(y(f), za, C.bord(f, za) - ep, zb_, C.bord(f, zb_) - ep) for f in fs], "bois")
    CB = D["CHATEAU_BAS"]
    (za, zb_), ep = CB["z"], CB["muraille"]
    fs = [K["stations"][0] + CB["facade"] / C.L] + K["stations"][1:-1] + [K["stations"][-1] - CB["facade"] / C.L]
    solide(interieurs, [(y(f), za, C.lisse(f) - ep, zb_, C.lisse(f) - ep) for f in fs], "bois")
    amenager(D, P, C, coque, interieurs)
    CH = D["CHAMBRE"]
    (za, zb_), ep = CH["z"], CH["muraille"]
    fs = [K["stations"][0] + ep / C.L] + [f for f in K["stations"][1:-1]] + [K["stations"][-1] - ep / C.L]
    solide(interieurs, [(y(f), za, C.lisse(f) + saillie_chateau - ep, zb_, C.lisse(f) + saillie_chateau - ep) for f in fs], "bois")

    # mâts
    noeuds = {}
    for nom, M in D["MATS"].items():
        m = Maille(tous)
        pied = (0.0, y(M["f"]), M["pied"])
        espar(m, pied, (0.0, y(M["f"]), M["tete"]), *M["rayons"], D["COTES_MAT"], "bois")
        espar(m, (0.0, y(M["f"]), M["emplanture"]), pied, M["rayons"][0], M["rayons"][0], D["COTES_MAT"], "bois")
        noeuds[nom] = (m, pied)

    m, (_, ym, _) = noeuds["grand_mat"]
    a, b, r0, r1 = D["MAT_DE_HUNE"]
    espar(m, (0, ym, a), (0, ym, b), r0, r1, D["COTES_MAT"], "bois")

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
    z_a = lambda f: zt + (ft - f) * C.L * pente  # noqa: E731
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
        poutre(coque, (0, y(fa), za), (0, y(fb_), zb), CO["etai"], CO["etai"], (1, 0, 0), "cordage")

    # pavillon de poupe sur sa hampe penchée vers l'arrière, flamme en tête du grand mât (toile, rayure)
    P = D["PAVILLON"]
    (fh, zh), z_tete, recul = P["hampe"]
    pied_h = Vector((0, y(fh), zh))
    tete_h = Vector((0, y(fh) + recul, z_tete))
    espar(coque, pied_h, tete_h, 0.07, 0.05, 6, "bois")
    lt, ht = P["toile"]
    bornes = carre_de_blason(lt, ht, P["blason"], 0.5)
    ss = sorted({i / 6 for i in range(7)} | set(bornes[0]))
    rangs, uvs = [], []
    for t in sorted({j / 4 for j in range(5)} | set(bornes[1])):
        base = tete_h + (pied_h - tete_h).normalized() * (0.1 + ht * t)
        rangs.append([(0.25 * math.sin(math.pi * 1.6 * s_) * s_, base.y + lt * s_, base.z - 0.05 * s_) for s_ in ss])
        uvs.append([uv_de_blason(s_, t, bornes) for s_ in ss])
    nappe(coque, rangs, None, ["rayure" if (a + b) / 2 < P["guindant"] else "toile" for a, b in zip(ss, ss[1:])], uvs)
    m_gm, (_, ym_gm, _) = noeuds["grand_mat"]
    zf, lf, hf = P["flamme"]
    nappe(m_gm, [[(0.3 * math.sin(math.pi * 1.4 * i / 6) * i / 6, ym_gm + lf * i / 6, zf - hf * 0.5 * (i / 6)) for i in range(7)],
                 [(0.3 * math.sin(math.pi * 1.4 * i / 6) * i / 6, ym_gm + lf * i / 6, zf - hf + hf * 0.5 * (i / 6)) for i in range(7)]],
          None, ["rayure", "toile", "rayure", "toile", "rayure", "toile"])

    # emprise recentrée en x et y ; z = 0 reste la flottaison
    toutes = coque.v + bordage.v + chateau.v + gaillard.v + [p for mm, _ in noeuds.values() for p in mm.v]
    dx = -(min(p[0] for p in toutes) + max(p[0] for p in toutes)) / 2
    dy = -(min(p[1] for p in toutes) + max(p[1] for p in toutes)) / 2
    for mm in [coque, bordage, chateau, gaillard, interieurs, ouvertures, cadres] + [mm for mm, _ in noeuds.values()]:
        mm.v = [(x + dx, yy + dy, z) for x, yy, z in mm.v]
    gltf = lambda x, yy, z: [round(x + dx, 3), round(z, 3), round(-(yy + dy), 3)]  # noqa: E731
    sortie = {
        "postes": {bord: [gltf(*p) for p in positions] for bord, positions in postes.items()},
        "selon": {"sabord": {"postes": {bord: [gltf(*p) for p in positions] for bord, positions in sabords.items()}}},
        "ancrages": {**{nom: [gltf(x, y(f), z) for x, f, z in points] for nom, points in D["ANCRAGES"].items()},
                     **{nom: [gltf(s_ * (C.lisse(f) - D["PAVOIS"][0] / 2), y(f), lineaire(D["LISSE"], f)) for f in fs for s_ in (1, -1)]
                        for nom, fs in D["ANCRAGES_LISSE"].items()}},
    }
    percer(objet("coque", coque, (0.0, 0.0, 0.0), 35), [objet("bordage", bordage, (0, 0, 0), 35), objet("chateau", chateau, (0, 0, 0), 35),
                                                     objet("gaillard", gaillard, (0, 0, 0), 35)],
           objet("interieurs", interieurs, (0, 0, 0), 35), objet("ouvertures", ouvertures, (0, 0, 0), 35))
    objet("avec-sabord", cadres, (0.0, 0.0, 0.0), 35)
    for nom in ("beaupre", "misaine", "grand_mat", "grand_mat_arriere", "artimon"):
        mm, (px, py, pz) = noeuds[nom]
        objet(nom, mm, (px + dx, py + dy, pz), 35)
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
    les `interieurs` (cale, entrepont, pièces et chambre du château, écoutilles, portes), puis les `ouvertures` des
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
    yield {"glb": "caraque", "cles": [("vehicule", {"definition": "caraque"})], "materiaux": D["MATERIAUX"],
           "blasons": D["BLASONS"], "construire": lambda: construire(D, plan_de_jeu.lire(PLAN_DE_JEU))}
    yield from ameliorations.elements(D)
