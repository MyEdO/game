"""Lecture du plan de jeu de la caraque (`src/noyau/planDeLaCaraque.ts`, #3686) : cloisons, portes et échelles de ses ponts,
en cases du plan (proue à x = 0, tribord à y = 0).

Dans `walled`, une ligne de cases sur deux : la case (x, y) au caractère 2x+1 de la ligne 2y+1 ; l'arête verticale
entre les cases x-1 et x au caractère 2x de la ligne 2y+1 ; l'arête horizontale entre les rangs y-1 et y au caractère
2x+1 de la ligne 2y. `|` et `-` : cloison ; `:` : porte ; `o` : fenêtre ou garde-corps.
"""
import re
from pathlib import Path

COTES = {"O": (-1, 0), "E": (1, 0), "N": (0, -1), "S": (0, 1)}


def lire(chemin):
    texte = Path(chemin).read_text(encoding="utf-8")
    blocs = dict(re.findall(r"const (\w+) = String\.raw`\n(.*?)`;", texte, re.S))
    W, H = (int(re.search(rf"const {n} = (\d+);", texte).group(1)) for n in ("W", "H"))
    walled = dict(re.findall(r"(z\d): (\w+)", re.search(r"walled: \{([^}]*)\}", texte).group(1)))
    eleve = re.findall(r"(\w): PONTS\.\w+", re.search(r"elevate: \{([^}]*)\}", texte).group(1))
    plan = texte[texte.index("export const PLAN_DE_LA_CARAQUE"):]
    plan = plan[:plan.index("\n};")]
    echelles = [(int(x), int(y), c, int(z)) for x, y, c, z in
                re.findall(r"\{ x: (\d+), y: (\d+), side: '(\w)', z: (\d+), climb: \{ kind: 'ladder' \} \}", plan)]
    ponts = {}
    for cle, nom in walled.items():
        lignes = [l.ljust(2 * W + 1) for l in blocs[nom].split("\n")[:2 * H + 1]]
        ponts[int(cle[1:])] = lignes
    return {"W": W, "H": H, "ponts": ponts, "trappes": set(eleve) - {"a"}, "echelles": echelles}


def case(P, z, x, y):
    if not (0 <= x < P["W"] and 0 <= y < P["H"]):
        return " "
    return P["ponts"][z][2 * y + 1][2 * x + 1]


def murs(P, z):
    """Les arêtes intérieures du pont `z` (les deux cases voisines occupées) : (sens, x, y, glyphe), sens "t" pour une
    arête entre les cases x-1 et x du rang y (cloison transversale), "l" entre les rangs y-1 et y de la colonne x."""
    lignes = P["ponts"][z]
    sortie = []
    for y in range(P["H"]):
        for x in range(1, P["W"]):
            g = lignes[2 * y + 1][2 * x]
            if g in "|:" and case(P, z, x - 1, y) != " " and case(P, z, x, y) != " ":
                sortie.append(("t", x, y, g))
    for y in range(1, P["H"]):
        for x in range(P["W"]):
            g = lignes[2 * y][2 * x + 1]
            if g in "-:" and case(P, z, x, y - 1) != " " and case(P, z, x, y) != " ":
                sortie.append(("l", x, y, g))
    return sortie


def echelles(P):
    """Chaque échelle : (pont du bas, case de la trappe, case du pied, arête) ; l'arête comme dans `murs`."""
    sortie = []
    for x, y, cote, z in P["echelles"]:
        dx, dy = COTES[cote]
        a, b = (x, y), (x + dx, y + dy)
        trappe, pied = (a, b) if case(P, z, *a) in P["trappes"] else (b, a)
        arete = ("t", max(a[0], b[0]), y) if dx else ("l", x, max(a[1], b[1]))
        sortie.append((z, trappe, pied, arete))
    return sortie

