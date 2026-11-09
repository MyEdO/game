"""Les ponts d'un véhicule (`ponts` de sa fiche dans `src/data/vehicles.json`, #3686), la source
unique que lit aussi le noyau (`src/noyau/pontsDeLaFiche.ts`) : emprise de chaque pont en cases, hauteur de chaque
case, cloisons, portes, échelles et sabords, en cases du plan (proue à x = 0, tribord à y = 0).

Grammaire : `GRAMMAIRE_ASCII` et `MOTS_DES_PONTS` de `src/data/schemas/grammaire/carte-ascii.ts`. La case (x, y) au
caractère 2x+1 de la ligne 2y+1 ; l'arête « t » entre les cases (x-1, y) et (x, y) au caractère 2x de la ligne 2y+1 ;
l'arête « l » entre les cases (x, y-1) et (x, y) au caractère 2x+1 de la ligne 2y. Une échelle joint deux cases d'un
même pont ; la plus haute est la trappe, au niveau du pont du dessus, qui n'a pas de case au-dessus d'elle.
"""
import json

import habillage

VEHICULES = habillage.DEPOT / "src" / "data" / "vehicles.json"

BASE = ". "
MURS = "|-"
PORTE = ":"
ECHELLE = "H"
SABORD = "x"


def fiche(id_):
    """La fiche du véhicule `id_` de `src/data/vehicles.json`."""
    return next(f for f in json.loads(VEHICULES.read_text(encoding="utf-8")) if f["id"] == id_)


def lire(id_):
    """Les ponts du véhicule `id_`."""
    return depuis(fiche(id_))


def depuis(fiche):
    """Les ponts d'une fiche : dimensions, cases {(x, y, z): glyphe}, hauteurs {glyphe: m}, arêtes [(sens, x, y, z, mot)]."""
    cartes, hauteurs = fiche["ponts"]
    lignes = [p.split("\n") for p in cartes]
    H = (max(len(l) for l in lignes) - 1) // 2
    W = (max(len(s) for l in lignes for s in l) - 1) // 2

    def a(z, ligne, col):
        rangs = lignes[z]
        return rangs[ligne][col] if ligne < len(rangs) and col < len(rangs[ligne]) else " "

    cases, aretes = {}, []
    for z in range(len(lignes)):
        for y in range(H):
            for x in range(W):
                if a(z, 2 * y + 1, 2 * x + 1) not in BASE:
                    cases[(x, y, z)] = a(z, 2 * y + 1, 2 * x + 1)
            for x in range(W + 1):
                if a(z, 2 * y + 1, 2 * x) not in BASE:
                    aretes.append(("t", x, y, z, a(z, 2 * y + 1, 2 * x)))
        for y in range(H + 1):
            for x in range(W):
                if a(z, 2 * y, 2 * x + 1) not in BASE:
                    aretes.append(("l", x, y, z, a(z, 2 * y, 2 * x + 1)))
    return {"W": W, "H": H, "ponts": len(lignes), "cases": cases, "hauteurs": dict(hauteurs), "aretes": aretes}


def voisines(sens, x, y):
    """Les deux cases que sépare l'arête (sens, x, y)."""
    return ((x - 1, y), (x, y)) if sens == "t" else ((x, y - 1), (x, y))


def hauteur(P, z, x, y):
    """La hauteur de la case (x, y) du pont `z`, None hors de son emprise."""
    g = P["cases"].get((x, y, z))
    return None if g is None else P["hauteurs"][g]


def murs(P, z):
    """Les cloisons et portes intérieures du pont `z` (ses deux cases voisines dans l'emprise) : (sens, x, y, mot)."""
    return [(s, x, y, g) for s, x, y, zz, g in P["aretes"]
            if zz == z and g in MURS + PORTE and all((cx, cy, z) in P["cases"] for cx, cy in voisines(s, x, y))]


def ouvertes(P, z):
    """Les arêtes intérieures du pont `z` sans cloison ni échelle, entre deux cases de même hauteur : (sens, x, y)."""
    pleines = {(s, x, y) for s, x, y, zz, _ in P["aretes"] if zz == z}
    sortie = []
    for (x, y, zz) in P["cases"]:
        if zz != z:
            continue
        for s, vx, vy in (("t", x + 1, y), ("l", x, y + 1)):
            (ax, ay), (bx, by) = voisines(s, vx, vy)
            if (s, vx, vy) not in pleines and (bx, by, z) in P["cases"] and hauteur(P, z, ax, ay) == hauteur(P, z, bx, by):
                sortie.append((s, vx, vy))
    return sortie


def echelles(P):
    """Chaque échelle : (pont, case de la trappe, case du pied, (sens, x, y) de son arête)."""
    sortie = []
    for s, x, y, z, g in P["aretes"]:
        if g != ECHELLE:
            continue
        a, b = voisines(s, x, y)
        trappe, pied = (a, b) if hauteur(P, z, *a) > hauteur(P, z, *b) else (b, a)
        sortie.append((z, trappe, pied, (s, x, y)))
    return sortie


def sabords(P):
    """Chaque sabord, du pont le plus bas vers l'arrière : (pont, case qu'il ouvre, bord), le bord étant le flanc de la coque vers lequel il regarde
    (« tribord » au-dessus de la case, « babord » au-dessous, « proue » devant, « poupe » derrière)."""
    sortie = []
    for s, x, y, z, g in P["aretes"]:
        if g != SABORD:
            continue
        a, b = voisines(s, x, y)
        dedans = b if b + (z,) in P["cases"] else a
        bord = {("t", True): "proue", ("t", False): "poupe", ("l", True): "tribord", ("l", False): "babord"}[(s, dedans == b)]
        sortie.append((z, dedans, bord))
    return sorted(sortie)
