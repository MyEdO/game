"""Les feux (#4335) : un GLB par décor de `DECORS`, bâti dans l'enveloppe convexe des primitives de sa recette
(`gabarit.py`), dont il lit les cotes (`geometrie.pave` et `geometrie.rond`) et où `Gabarit.rentrer` ramène
le sommet qui en sortirait. Chaque pièce est une coque close : un caillou et un tas, des anneaux bruités fermés en
pointe ; une bûche, des anneaux striés le long de son axe, ses bouts sciés rapportés ; un fer forgé, une section carrée
le long d'un chemin plan. L'aléa est semé des codes de caractères de l'id du décor : deux constructions rendent les
mêmes octets.

Partie émissive. Le nœud `emet` (`NOEUD_EMISSIF`) de chaque GLB porte ce qui luit, en matière `braises`, à l'aplomb du
centre de la primitive `emet` de la recette, où le noyau pose le foyer de la lumière (`foyerDe`,
`src/noyau/monde/vision.ts`) ; les autres nœuds (`NOEUDS`) portent le reste, par pièce."""
import math

from mathutils import Vector

import geometrie
from geometrie import ANGLES, HAUT, X, Y, cap, coque, lisse, normales, pave, rond
from gabarit import NOEUD_EMISSIF
from maille import cylindre, lineaire, poutre, tour

DECORS = ("feu-camp", "brasero", "lampadaire")
NOEUDS = {
    "feu-camp": {"pierres": ("pierre",), "buches": ("ecorce", "coupe"), NOEUD_EMISSIF: ("braises",)},
    "brasero": {"trepied": ("fer",), "cuve": ("fer",), NOEUD_EMISSIF: ("braises",)},
    "lampadaire": {"socle": ("pierre",), "fut": ("fer", "laiton"), "lanterne": ("fer", "laiton"), NOEUD_EMISSIF: ("vitres",)},
}
"""Par décor, ses nœuds et les matériaux de chacun (`MATERIAUX` de `donnees.py`)."""


def cylindre_lu(G, emet):
    """Le cylindre de la recette de `G` qui porte `emet` ou non : son centre, son rayon, sa longueur (`geometrie.rond`)."""
    return rond(next(p for p in G.primitives if p["kind"] == "cylinder" and bool(p.get("emet")) == emet))


def caillou(m, pied, demi_axes, hauteur, azimut, C, mat, a):
    """Un caillou posé sur `pied`, de `demi_axes` le long d'`azimut` et en travers, d'après `C` (`CAILLOUX`)."""
    e1, e2 = cap(azimut) * demi_axes[0], cap(azimut + 90) * demi_axes[1]
    k, g = C["cotes"], C["grain"]
    phase = a.uniform(0, 2 * math.pi / k)
    anneaux = [[pied + (e1 * math.cos(phase + 2 * math.pi * j / k) + e2 * math.sin(phase + 2 * math.pi * j / k)) * part * (1 + a.uniform(-g, g))
                + HAUT * hauteur * z for j in range(k)] for z, part in C["profil"]]
    coque(m, anneaux, mat, pied + e1 * a.uniform(-C["pointe"], C["pointe"]) + e2 * a.uniform(-C["pointe"], C["pointe"]) + HAUT * hauteur)


def tas(m, T, profil, pointe, mat, a):
    """Un tas autour de l'axe du décor, d'après `T` (côtés, grain) : ses anneaux `profil` (rayon, hauteur), sa `pointe`."""
    k, g = T["cotes"], T["grain"]
    coque(m, [[cap(360 * j / k) * r * (1 + a.uniform(-g, g)) + HAUT * z for j in range(k)] for r, z in profil], mat, HAUT * pointe)


def morceaux(m, M, C, rayon, profil, pointe, mat, a):
    """Les morceaux de braise `M` (fractions de `rayon`) semés, à densité égale, sur le tas de `profil` et de `pointe`,
    chacun enfoui d'une part de sa hauteur."""
    large = max(range(len(profil)), key=lambda i: profil[i][0])
    dessus = [(0.0, pointe)] + profil[:large - 1 if large else None:-1]
    for _ in range(M["nombre"]):
        d, h = a.uniform(*(x * x for x in M["distance"])) ** 0.5 * rayon, a.uniform(*M["hauteur"]) * rayon
        pied = cap(a.uniform(0, 360)) * d + HAUT * (lineaire(dessus, d) - M["enfoui"] * h)
        caillou(m, pied, (a.uniform(*M["demi_axe"]) * rayon, a.uniform(*M["demi_axe"]) * rayon), h, a.uniform(0, 180), C, mat, a)


def buche(m, p0, p1, rayon, B, cotes, a):
    """Une bûche de `p0` à `p1` d'après `B` : l'écorce, des anneaux striés et fléchis, et à chaque bout sa coupe sciée,
    rapportée en saillie dans l'aubier."""
    t = (p1 - p0).normalized()
    n, b = normales(t)
    stries = [a.uniform(-B["stries"], B["stries"]) for _ in range(cotes)]
    anneaux = []
    for i in range(B["troncons"] + 1):
        c = p0.lerp(p1, i / B["troncons"])
        if 0 < i < B["troncons"]:
            c = c + (n * a.uniform(-B["fleche"], B["fleche"]) + b * a.uniform(-B["fleche"], B["fleche"])) * rayon
        anneaux.append([c + (n * math.cos(2 * math.pi * j / cotes) + b * math.sin(2 * math.pi * j / cotes)) * rayon
                        * (1 + stries[j] + a.uniform(-B["grain"], B["grain"])) for j in range(cotes)])
    coque(m, anneaux, "ecorce")
    for centre, anneau, dehors in ((p0, anneaux[0], -t), (p1, anneaux[-1], t)):
        saillie = dehors * rayon * B["saillie"]
        coque(m, [[centre + (v - centre) * B["aubier"] + saillie for v in anneau]], "coupe", centre - saillie)


def barre(m, chemin, travers, cote, mat):
    """Un fer carré de `cote` le long de `chemin`, courbe d'un plan de normale unitaire `travers`."""
    anneaux = []
    for i, p in enumerate(chemin):
        t = (chemin[min(i + 1, len(chemin) - 1)] - chemin[max(i - 1, 0)]).normalized()
        u, w = travers * cote / 2, t.cross(travers).normalized() * cote / 2
        anneaux.append([p - u - w, p + u - w, p + u + w, p - u + w])
    coque(m, anneaux, mat)


def gradins(m, niveaux, demi, pan, mat, a, grain, pointe=None):
    """Un bloc carré à pans coupés autour de l'axe du décor : un anneau par niveau (hauteur, fraction de `demi`), ses
    angles coupés de `pan` de son demi-côté, chaque sommet écarté d'au plus `grain` mètres dans le plan ; fermé à plat,
    ou en `pointe`."""
    anneaux = []
    for z, f in niveaux:
        h = f * demi
        c = h * (1 - pan)
        anneaux.append([Vector((x + a.uniform(-grain, grain), y + a.uniform(-grain, grain), z))
                        for x, y in ((h, -c), (h, c), (c, h), (-c, h), (-h, c), (-h, -c), (-c, -h), (c, -h))])
    coque(m, anneaux, mat, None if pointe is None else HAUT * pointe)


def feu_camp(D, G, P, a):
    """Le cercle de pierres, le lit de braises et ses morceaux, les bûches couchées, en travers et dressées."""
    F, C = D["FEU_CAMP"], D["CAILLOUX"]
    blocs = [pave(p) for p in G.primitives if p["kind"] == "box"]
    (_, rayon_buche, longueur), (foyer, rayon_foyer, hauteur_foyer) = (cylindre_lu(G, emet) for emet in (False, True))
    cercle = sum(math.hypot(c.x, c.y) for c, _ in blocs) / len(blocs)
    cote, _, haut = blocs[0][1]
    dessous, dessus = foyer.z - hauteur_foyer / 2, foyer.z + hauteur_foyer / 2

    S = F["pierres"]
    tour_ = a.uniform(0, 360)
    for k in range(S["nombre"]):
        azimut = tour_ + (k + a.uniform(-S["pas"], S["pas"])) * 360 / S["nombre"]
        caillou(P["pierres"], cap(azimut) * cercle * a.uniform(*S["distance"]),
                (cote * a.uniform(*S["demi_longueur"]), cote * a.uniform(*S["demi_epaisseur"])), haut * a.uniform(*S["hauteur"]),
                azimut + 90 + a.uniform(-S["cap"], S["cap"]), C["pierre"], "pierre", a)

    profil = [(r * rayon_foyer, z * dessous) for r, z in F["lit"]["profil"]]
    pointe = F["lit"]["pointe"] * dessous
    tas(P[NOEUD_EMISSIF], F["lit"], profil, pointe, "braises", a)
    morceaux(P[NOEUD_EMISSIF], F["morceaux"], C["braise"], rayon_foyer, profil, pointe, "braises", a)

    B = F["buche"]
    jeu = F["jeu"] * rayon_buche
    assise = max(r for _, _, r in F["couchees"]) * rayon_buche
    for long_, travers, rang in ((X, Y, "couchees"), (Y, X, "travers")):
        for ecart, part, r in F[rang]:
            r *= rayon_buche
            z = r if rang == "couchees" else assise + (assise + r) * F["appui"]
            p0, p1 = (travers * (ecart * longueur + a.uniform(-jeu, jeu)) + long_ * s * part * longueur / 2 + HAUT * z for s in (-1, 1))
            buche(P["buches"], p0, p1, r, B, B["cotes"], a)
    R = F["dresse"]
    for azimut_pied, pied, azimut_tete, tete in F["dresses"]:
        buche(P["buches"], cap(azimut_pied) * pied * longueur + HAUT * R["pied"] * dessus,
              cap(azimut_tete) * tete * longueur + HAUT * R["tete"] * dessus, R["rayon"] * rayon_buche, B, R["cotes"], a)


def brasero(D, G, P, a):
    """Le trépied, ses patins et sa ceinture ; la cuve, ses cercles, ses lames et sa coupelle ; le tas de braises."""
    B, C = D["BRASERO"], D["CAILLOUX"]
    pieds = [pave(p) for p in G.primitives if p["kind"] == "box"]
    (cuve, rayon, hauteur), (foyer, rayon_foyer, hauteur_foyer) = (cylindre_lu(G, emet) for emet in (False, True))
    cote = pieds[0][1][0]
    dessous, dessus = cuve.z - hauteur / 2, foyer.z + hauteur_foyer / 2

    def sur_cuve(r, part):
        return r * rayon, dessous + part * hauteur

    (r_pied, z_pied), (r_bord, z_bord) = sur_cuve(*B["pied_de_cuve"]), sur_cuve(*B["bord"])
    for centre, _ in pieds:
        portee = math.hypot(centre.x, centre.y)
        vers = Vector((centre.x, centre.y, 0)) / portee
        points = [(r * portee, z * dessous) for r, z in B["chemin"]] + [(r_pied, z_pied), (r_bord, z_bord), sur_cuve(*B["bout"])]
        barre(P["trepied"], lisse([vers * r + HAUT * z for r, z in points], B["pas"]), HAUT.cross(vers), B["fer"] * cote, "fer")
        cylindre(P["trepied"], 0.0, B["patin"][1] * cote, B["patin"][0] * cote, "z", (centre.x, centre.y, 0.0), 8, "fer")

    def cercle(m, r, z, h, e, segments):
        tour(m, [(z - h / 2, r - e / 2), (z + h / 2, r - e / 2), (z + h / 2, r + e / 2), (z - h / 2, r + e / 2)], "z", (0, 0, 0), segments, "fer", ferme=True)

    rang, h, e, segments = B["ceinture"]
    r, z = B["chemin"][rang]
    cercle(P["trepied"], r * sum(math.hypot(c.x, c.y) for c, _ in pieds) / len(pieds), z * dessous, h * cote, e * cote, segments)

    parts, h, e, segments = B["cercles"]
    for part in parts:
        cercle(P["cuve"], r_pied + (r_bord - r_pied) * part, z_pied + (z_bord - z_pied) * part, h * hauteur, e * hauteur, segments)
    nombre, largeur, epaisseur = B["lames"]
    azimuts = sorted(math.degrees(math.atan2(c.y, c.x)) % 360 for c, _ in pieds)
    for debut, fin in zip(azimuts, azimuts[1:] + [azimuts[0] + 360]):
        for k in range(1, nombre + 1):
            vers = cap(debut + (fin - debut) * k / (nombre + 1))
            poutre(P["cuve"], vers * r_pied + HAUT * z_pied, vers * r_bord + HAUT * z_bord, largeur * rayon, epaisseur * hauteur, vers, "fer")
    profil, segments = B["coupelle"]
    tour(P["cuve"], [(dessous + part * hauteur, r * rayon) for part, r in profil], "z", (0, 0, 0), segments, "fer")

    T = B["tas"]
    profil = [(r * rayon_foyer, dessous + part * (dessus - dessous)) for r, part in T["profil"]]
    pointe = dessous + T["pointe"] * (dessus - dessous)
    tas(P[NOEUD_EMISSIF], T, profil, pointe, "braises", a)
    morceaux(P[NOEUD_EMISSIF], B["morceaux"], C["braise"], rayon_foyer, profil, pointe, "braises", a)


def lampadaire(D, G, P, a):
    """Le socle à deux assises ; le fût tourné, sa barre d'allumeur et ses consoles ; le plateau, la lanterne (montants,
    traverses, petits-bois, vitres) et son chapeau (corniche, toit, lanterneau, épi)."""
    L = D["LAMPADAIRE"]
    boites = {("emet" if p.get("emet") else p["material"]): pave(p) for p in G.primitives if p["kind"] == "box"}
    fut, rayon, longueur = cylindre_lu(G, False)
    faite = max(c.z + cotes[2] / 2 for c, cotes in (pave(p) for p in G.primitives if p["kind"] == "prism"))

    socle, (cote, _, haut) = boites["pierre-atre"]
    for assise in L["assises"]:
        gradins(P["socle"], [(socle.z - haut / 2 + part * haut, f) for part, f in assise], cote / 2, L["pan"], "pierre", a, L["taille"])

    pied = fut.z - longueur / 2
    tour(P["fut"], [(pied + part * longueur, f * rayon) for part, f, _ in L["fut"]], "z", (0, 0, 0), L["segments"], [mat for _, _, mat in L["fut"]])
    part, portee, r, (r_boule, l_boule) = L["barre"]
    z, portee = pied + part * longueur, portee * cote / 2
    cylindre(P["fut"], -portee, portee, r * rayon, "x", (0, 0, z), 6, "fer")
    for s in (-1, 1):
        cylindre(P["fut"], *sorted((s * portee, s * (portee - l_boule * rayon))), r_boule * rayon, "x", (0, 0, z), 6, "fer")

    plateau, (cote_plateau, _, haut_plateau) = boites["fer-noirci"]
    chemin, fer, pas = L["console"]
    for azimut in (0, 90, 180, 270):
        vers = cap(azimut)
        barre(P["fut"], lisse([vers * r * cote_plateau / 2 + HAUT * (pied + part * longueur) for r, part in chemin], pas), HAUT.cross(vers), fer * rayon, "fer")
    niveaux, pan = L["plateau"]
    gradins(P["lanterne"], [(plateau.z - haut_plateau / 2 + part * haut_plateau, f) for part, f in niveaux], cote_plateau / 2, pan, "fer", a, 0.0)

    T = L["lanterne"]
    corps, (cote_corps, _, haut_corps) = boites["emet"]
    demi = cote_corps / 2
    bas, tete = corps.z - haut_corps / 2, corps.z + haut_corps / 2
    fer, petit_bois = T["montant"] * demi, T["petit_bois"] * demi
    pieds = [Vector((x * T["pied"] * demi, y * T["pied"] * demi, bas)) for x, y in ANGLES]
    tetes = [Vector((x * T["tete"] * demi, y * T["tete"] * demi, tete)) for x, y in ANGLES]
    for (x, y), p, t in zip(ANGLES, pieds, tetes):
        poutre(P["lanterne"], p, t, fer, fer, (x, y, 0), "fer")
    for i in range(4):
        j = (i + 1) % 4
        dehors = Vector((ANGLES[i][0] + ANGLES[j][0], ANGLES[i][1] + ANGLES[j][1], 0)).normalized()
        poutre(P["lanterne"], pieds[i] + HAUT * fer / 2, pieds[j] + HAUT * fer / 2, fer, fer, HAUT, "fer")
        poutre(P["lanterne"], tetes[i] - HAUT * fer / 2, tetes[j] - HAUT * fer / 2, fer, fer, HAUT, "fer")
        poutre(P["lanterne"], pieds[i].lerp(pieds[j], 0.5), tetes[i].lerp(tetes[j], 0.5), petit_bois, petit_bois, dehors, "fer")
        poutre(P["lanterne"], pieds[i].lerp(tetes[i], T["croisee"]), pieds[j].lerp(tetes[j], T["croisee"]), petit_bois, petit_bois, dehors, "fer")
        devant = [q - dehors * T["retrait"] * demi for q in (pieds[i], pieds[j], tetes[j], tetes[i])]
        P[NOEUD_EMISSIF].ajouter([tuple(q) for q in devant] + [tuple(q - dehors * T["vitre"] * demi) for q in devant],
                                 [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]], "vitres")

    corniche, (cote_corniche, _, haut_corniche) = boites["laiton-dore"]
    dessous = corniche.z - haut_corniche / 2

    def du_chapeau(niveaux):
        return [(dessous + part * (faite - dessous), f) for part, f in niveaux]

    for niveaux, mat, pointe in ((L["corniche"], "laiton", None), (L["toit"], "fer", None), (L["lanterneau"], "fer", None),
                                 (L["epi"], "laiton", dessous + L["pointe"] * (faite - dessous))):
        gradins(P["lanterne"], du_chapeau(niveaux), cote_corniche / 2, L["pan_du_chapeau"], mat, a, 0.0, pointe)


BATIR = {"feu-camp": feu_camp, "brasero": brasero, "lampadaire": lampadaire}


def construire(D, id_):
    return geometrie.par_noeuds(D, id_, NOEUDS[id_], BATIR[id_])


def elements(D):
    return geometrie.elements(D, DECORS, construire)
