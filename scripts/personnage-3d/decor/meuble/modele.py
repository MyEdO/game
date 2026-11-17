"""Les meubles (#4335) : un GLB par décor de `DECORS`, bâti dans l'enveloppe convexe des primitives de sa recette
(`gabarit.py`), dont il lit les cotes (`geometrie.pave`) et où `Gabarit.rentrer` ramène le sommet qui en sortirait.
Chaque pièce est une coque close (`geometrie.coque`) d'anneaux pris dans des plans parallèles : une pièce équarrie, des
rectangles aux coins abattus (`geometrie.barre`) ; une pièce tournée, des cercles (`geometrie.tournee`) ; une assise,
les contours emboîtés d'un plateau creusé (`galette`) ; une pièce de literie ou un coussin d'assise, ceux d'un coussin
(`coussin`) ; une garniture, des rectangles qui rentrent le long de sa saillie (`dossier_garni`). Seule
exception, une planche du plateau d'un comptoir d'angle (`comptoir`) : son dernier anneau, l'onglet, est coupé sur la
diagonale de l'angle. Un pied en dévers garde ses anneaux horizontaux : il pose à plat. Les pièces s'assemblent en se
pénétrant, tenon dans mortaise ; une cheville en marque chaque assemblage. L'aléa est semé des codes de caractères de
l'id du décor : deux constructions rendent les mêmes octets."""
import math

from mathutils import Vector

import geometrie
from geometrie import (ANGLES, CHEVILLE, COTES, CYLINDRE, HAUT, MAT, X, Y, a_la_hauteur, anneau, barre, cap, cheville,
                       clou, coque, normales, octogone, pave, planche, profilee, rond, tournee)
from gabarit import VERSANTS

DECORS = ("table", "table-2x1", "chaise", "banc", "tabouret", "armoire", "bureau", "bureau-2x1", "etagere", "lit",
          "comptoir-droit", "comptoir-angle", "etabli", "etabli-2x1", "siege", "fauteuil-loge", "canape", "coiffeuse",
          "table-ronde-4-tabourets", "table-murale-2-tabourets")
NOEUDS = {"armoire": {MAT: (MAT,), "ferrures": ("fer",)}, "etagere": {MAT: (MAT,), "objets": ("cuir",)},
          "lit": {MAT: (MAT,), "literie": ("ecru", "rouge")},
          **{id_: {MAT: (MAT,), "fers": ("fer",)}
             for id_ in ("comptoir-droit", "comptoir-angle", "etabli", "etabli-2x1", "table-ronde-4-tabourets")},
          **{id_: {MAT: (MAT,), "garniture": ("rouge",), "dorures": ("laiton",)}
             for id_ in ("siege", "fauteuil-loge", "canape")},
          "coiffeuse": {MAT: (MAT,), "glace": ("glace",)}}
"""Les nœuds d'un décor qui en a d'autres que celui de son bois, et les matériaux de chacun (`MATERIAUX` de
`donnees.py`)."""
AXES = (X, Y)
CAPS = (-Y, X, Y, -X)
"""Les normales des quatre faces d'un corps, du devant de la recette et dans le sens direct ; chaque face se parcourt
le long de `HAUT.cross(normale)`."""


def droite(m, a, b, u, v, du, dv, arete, mat=MAT):
    """Une pièce équarrie de `a` à `b`, de section constante, ses bouts pris dans les pièces qu'elle joint."""
    chanfrein = min(du, dv) * arete
    barre(m, [(a, du, dv, chanfrein), (b, du, dv, chanfrein)], u, v, mat)


def panneau(m, c, n, u, v, du, dv, saillie, P, arete):
    """Un panneau à plate-bande de demi-côtés `du` sur `u`, `dv` sur `v`, en `c` sur la face de normale `n` : son champ
    en `saillie` sur elle, sa plate-bande d'après `P` (`PANNEAU`)."""
    biseau, chanfrein = min(du, dv) * P["biseau"], min(du, dv) * arete
    barre(m, [(c, du, dv, chanfrein), (c + n * (saillie * (1 - P["champ"])), du, dv, chanfrein),
              (c + n * saillie, du - biseau, dv - biseau, chanfrein)], u, v)


def moulure(m, c, hauteur, dedans, dehors, profil, arete):
    """Une moulure de `hauteur` sur le point `c`, centre de son dessous : ses sections horizontales, de demi-côtés
    (x, y) entre `dedans` et `dehors` d'après `profil` [(part de la hauteur, part du débord)]."""
    barre(m, [(c + HAUT * (hauteur * t), dedans[0] + (dehors[0] - dedans[0]) * part, dedans[1] + (dehors[1] - dedans[1]) * part, min(dedans) * arete)
              for t, part in profil], X, Y)


def barreau(m, a, b, rayon, B):
    """Un barreau tourné horizontal de `a` à `b`, d'après `B` (côtés, profil)."""
    tournee(m, a, b, HAUT, (b - a).cross(HAUT).normalized(), rayon, B["profil"], B["cotes"])


def pied_tourne(m, bas, de, haut, cote, P, arete):
    """Un pied tourné de `bas` à `de`, d'après `P` (côtés, profil), sous son dé carré de `de` à `haut`, de demi-côté
    `cote`."""
    tournee(m, bas, de, X, Y, cote, P["profil"], P["cotes"])
    profilee(m, de, haut, (cote, cote), ((0.0, 1.0, arete), (1.0, 1.0, arete)))


def cintree(gauche, droit, demi, fleche, t):
    """Le centre et la demi-hauteur, à la part `t` de sa longueur, de la traverse de `gauche` à `droit`, de `demi`
    hauteur à ses bouts, dont le dessus se cintre de `fleche`."""
    haut = demi + fleche * 2 * t * (1 - t)
    return gauche.lerp(droit, t) + HAUT * (haut - demi), haut


def traverse_cintree(m, gauche, droit, demi, fleche, epais, stations, arete):
    """La traverse cintrée (`cintree`) de `gauche` à `droit`, de demi-épaisseur `epais`, en `stations` sections."""
    sections = [(*cintree(gauche, droit, demi, fleche, k / (stations - 1)), epais, epais * 2 * arete)
                for k in range(stations)]
    barre(m, sections, HAUT, Y)


def tiroir(m, x, facade, z, du, dv, devant, places, T, D):
    """La face d'un tiroir, panneau à plate-bande de demi-côtés `du` et `dv` en (`x`, `facade`, `z`) sur une façade
    tournée vers -y, en saillie d'après `T` (`saillie`, `bouton`) vers `devant`, où s'arrêtent ses boutons tournés,
    posés aux `places` (fractions de `du`)."""
    saillie = (facade - devant) * T["saillie"]
    panneau(m, Vector((x, facade, z)), -Y, X, HAUT, du, dv, saillie, D["PANNEAU"], D["ARETE"])
    for place in places:
        tournee(m, Vector((x + du * place, facade - saillie, z)), Vector((x + du * place, devant, z)), X, HAUT,
                dv * T["bouton"]["rayon"], T["bouton"]["profil"], T["bouton"]["cotes"])


def lisse(m, primitive, L, mat):
    """La lisse tournée, à pommeaux, que porte `primitive` le long de x, d'après `L` (`LISSE`)."""
    c, (lx, _, lz) = pave(primitive)
    tournee(m, c - X * (lx / 2), c + X * (lx / 2), *normales(X), lz / 2 * L["rayon"], L["profil"], L["cotes"], mat)


def dossier_garni(pieces, bas, haut, du, profond, travees, S, D):
    """Un dossier garni dressé de `bas` à `haut`, de demi-largeur `du`, d'après `S` (`DOSSIER`) en fractions de
    `profond` : une âme de bois et, par travée, une garniture devant, rembourrée de sa saillie, son contour rentré le
    long d'elle d'après `GARNI`, et un panneau à plate-bande au dos."""
    m, K = pieces[MAT], D["GARNI"]
    droite(m, bas, haut, X, Y, du, profond * S["ame"], D["ARETE"])
    large, dv = du / travees, (haut.z - bas.z) / 2
    for k in range(travees):
        c = (bas + haut) / 2 + X * (large * (2 * k + 1 - travees))
        gu, gv, saillie = large * S["garni"][0], dv * S["garni"][1], profond * S["garni"][2]
        barre(pieces["garniture"], [(c - Y * (saillie * t), gu - saillie * r, gv - saillie * r, min(gu, gv) * K["coin"])
                                    for t, r in K["profil"]], X, HAUT, "rouge")
        panneau(m, c, Y, -X, HAUT, large * S["panneau"][0], dv * S["panneau"][1], profond * S["panneau"][2],
                D["PANNEAU"], D["ARETE"])


def contour(du, dv, rayon, par_coin):
    """Le rectangle horizontal de demi-côtés `du` et `dv`, ses coins arrondis de `rayon` en `par_coin` segments : ses
    points (x, y) autour de son centre."""
    return [(sx * (du - rayon) + rayon * math.cos(math.pi / 2 * (q + j / par_coin)), sy * (dv - rayon) + rayon * math.sin(math.pi / 2 * (q + j / par_coin)))
            for q, (sx, sy) in enumerate(((1, 1), (-1, 1), (-1, -1), (1, -1))) for j in range(par_coin + 1)]


def galette(m, dessus, epaisseur, rive, chanfrein, creux, cuvette):
    """Une assise d'`epaisseur` sous le point `dessus`, centre de sa face haute : `rive(retrait)` rend son contour
    (x, y) rentré de `retrait` ; ses arêtes abattues de `chanfrein`, sa face haute creusée de `creux` au centre, par
    les anneaux de `cuvette` (part du contour que chacun garde)."""
    def etage(points, z, part=1.0):
        return [dessus + Vector((x * part, y * part, z)) for x, y in points]
    plein, rentre = rive(0.0), rive(chanfrein)
    anneaux = [etage(rentre, -epaisseur), etage(plein, chanfrein - epaisseur), etage(plein, -chanfrein), etage(rentre, 0.0)]
    anneaux += [etage(rentre, -creux * (1 - part * part), part) for part in cuvette]
    coque(m, anneaux, MAT, dessus - HAUT * creux)


def coussin(m, c, du, dv, epaisseur, K, mat):
    """Un coussin d'`epaisseur` sur le point `c`, centre de son dessous, de demi-côtés `du` (x) et `dv` (y), d'après
    `K` (`MATELAS`, `OREILLER`, `COUVERTURE`, `RABAT`, `ASSISE`) : coins arrondis, contour rentré le long de son
    profil, dessus bombé."""
    rayon = min(du, dv) * K["arrondi"]
    anneaux = [[c + Vector((x, y, epaisseur * t)) for x, y in contour(du - epaisseur * r, dv - epaisseur * r, rayon - epaisseur * r, K["par_coin"])]
               for t, r in K["profil"]]
    coque(m, anneaux, mat, c + HAUT * (epaisseur * (1 + K["bombe"])))


def plateau(m, primitive, P, a):
    """Le plateau de planches jointes que porte `primitive`, d'après `P` (`PLANCHES`) : rives adoucies, bouts inégaux ;
    rend la hauteur de son dessous et celle du plus bas des dessus de ses planches."""
    c, cotes = pave(primitive)
    ex, ey, ez = (k / 2 for k in cotes)
    largeurs = [a.uniform(*P["largeurs"]) for _ in range(P["planches"])]
    y = c.y - ey
    dessus = c.z + ez
    for part in largeurs:
        demi_largeur = ey * part / sum(largeurs)
        enfonce = ez * a.uniform(*P["affleurement"])
        bouts = [ex - ey * a.uniform(0, P["bouts"]) for _ in range(2)]
        planche(m, Vector((c.x - bouts[0], y + demi_largeur, c.z - enfonce)), Vector((c.x + bouts[1], y + demi_largeur, c.z - enfonce)),
                Y, HAUT, demi_largeur, ez - enfonce, ez * P["rive"])
        y += 2 * demi_largeur
        dessus = min(dessus, c.z + ez - 2 * enfonce)
    return c.z - ez, dessus


def quatre_pieds(G, rangs, tete):
    """Les axes des quatre pieds que portent les primitives de `rangs`, par (signe de x, signe de y) : chacun du sol,
    au centre de sa primitive, à `tete(centre)` ; et le demi-côté de leur primitive."""
    pieds = {}
    for rang in rangs:
        c, cotes = pave(G.primitives[rang])
        pieds[(1 if c.x > 0 else -1, 1 if c.y > 0 else -1)] = (Vector((c.x, c.y, c.z - cotes[2] / 2)), tete(c))
    return pieds, cotes[0] / 2


def traverse(m, bouts, travers, cote, ecart, section, arete, face, chevilles, a):
    """La traverse qui joint les points `bouts` des axes de deux pieds, écartée d'`ecart` de ces axes vers le dehors, du
    côté `cote` (-1, 1) de l'axe `travers`, de `section` (demi-épaisseur, demi-hauteur) ; et ses `chevilles` (rayon,
    hauteurs en fractions de sa demi-hauteur), dans la face du pied que son tenon longe, à `face` de l'axe du pied."""
    dehors = travers * cote
    droite(m, bouts[0] + dehors * ecart, bouts[1] + dehors * ecart, travers, HAUT, *section, arete)
    for bout in bouts:
        for rayon, h in chevilles:
            cheville(m, bout + dehors * face + HAUT * (h * section[1]), dehors, rayon, a)


def traverses(m, pieds, z, sens, ecart, section, arete, face, chevilles, a):
    """Les deux traverses (`traverse`) qui joignent, à la hauteur `z`, les pieds voisins le long de l'axe `sens`
    (0 : x, 1 : y), une de chaque côté."""
    for cote in COTES:
        traverse(m, [a_la_hauteur(pieds[(t, cote) if sens == 0 else (cote, t)], z) for t in COTES], AXES[1 - sens],
                 cote, ecart, section, arete, face, chevilles, a)


def pieds_droits(m, G, rangs, tete, P):
    """Les quatre pieds dressés (`quatre_pieds`), de demi-côté et de profil d'après `P` (`cote`, `profil`) : leurs axes
    et leur demi-côté."""
    pieds, cote = quatre_pieds(G, rangs, tete)
    cote *= P["cote"]
    for bas, haut in pieds.values():
        profilee(m, bas, haut, (cote, cote), P["profil"])
    return pieds, cote


def traverses_basses(m, pieds, z, section, rayon, arete, cote, a):
    """Les traverses (`traverses`) qui joignent le long de y, à la hauteur `z`, les pieds de demi-côté `cote`, de
    `section`, une cheville de `rayon` à chaque bout : le milieu de chacune, de x croissant."""
    traverses(m, pieds, z, 1, 0.0, section, arete, cote, [(rayon, 0.0)], a)
    return [(a_la_hauteur(pieds[(sx, -1)], z) + a_la_hauteur(pieds[(sx, 1)], z)) / 2 for sx in COTES]


def pietement(m, pieds, cote, dessous, C, demi_haut, rayon, z, basse, saillie, corps, tenon, clavette, arete, a):
    """Le piétement en H des `pieds` de demi-côté `cote` sous un plateau de `dessous` : sa ceinture d'après `C`
    (`epaisseur`, `retrait`, `chevilles`), de `demi_haut`, chevillée de `rayon` ; ses traverses basses
    (`traverses_basses`) à `z`, de section `basse` ; l'entretoise qui les joint (`entretoise`, `saillie`, `corps`,
    `tenon`, `clavette`) ; rend le milieu de chaque traverse basse."""
    for sens in (0, 1):
        traverses(m, pieds, dessous - demi_haut, sens, cote * (1 - C["retrait"] - C["epaisseur"]),
                  (cote * C["epaisseur"], demi_haut), arete, cote, [(rayon, h) for h in C["chevilles"]], a)
    gauche, droit = traverses_basses(m, pieds, z, basse, rayon, arete, cote, a)
    entretoise(m, gauche, droit, saillie, corps, tenon, clavette, arete)
    return gauche, droit


def entretoise(m, gauche, droit, saillie, corps, tenon, C, arete):
    """L'entretoise de `gauche` à `droit`, axes des traverses qu'elle joint : son `corps` et son `tenon` (demi-largeur,
    demi-hauteur), qui traverse chacune et la dépasse de `saillie`, claveté d'après `C` (`clavette`, en fractions de la
    demi-hauteur du tenon)."""
    d = (droit - gauche).normalized()
    travers = HAUT.cross(d)
    droite(m, gauche, droit, travers, HAUT, *corps, arete)
    planche(m, gauche - d * saillie, droit + d * saillie, travers, HAUT, *tenon, min(tenon) * 2 * arete)
    h = tenon[1]
    for bout, sens in ((gauche, -1), (droit, 1)):
        p = bout + d * (sens * saillie * C["place"])
        barre(m, [(p - HAUT * (h * C["depasse"][0]), h * C["demi"][0] * C["pointe"], h * C["demi"][1], h * C["demi"][0] * C["pointe"] * arete),
                  (p + HAUT * (h * C["depasse"][1]), h * C["demi"][0], h * C["demi"][1], h * C["demi"][0] * arete)], d, travers)


def table(D, G, pieces, a):
    """Une table d'après `TABLE` : plateau de planches, pieds à chanfreins arrêtés, ceinture chevillée, piétement en
    H."""
    T, arete, m = D["TABLE"], D["ARETE"], pieces[MAT]
    dessous, _ = plateau(m, G.primitives[T["plateau"]], T, a)
    pieds, cote = pieds_droits(m, G, T["pieds"], lambda c: Vector((c.x, c.y, dessous)), T["pied"])
    C, E = T["ceinture"], T["entretoise"]
    pietement(m, pieds, cote, dessous, C, pave(G.primitives[T["ceinture_lue"]])[1][2] / 2 * C["hauteur"],
              cote * T["cheville"], dessous * E["hauteur"], tuple(cote * f for f in E["traverse"]), cote * E["saillie"],
              tuple(cote * f for f in E["corps"]), tuple(cote * f for f in E["tenon"]), E["clavette"], arete, a)


def banc(D, G, pieces, a):
    """Un banc d'après `BANC` : planche creusée, pieds en dévers, traverses chevillées, entretoise clavetée."""
    B, arete, m = D["BANC"], D["ARETE"], pieces[MAT]
    c, cotes = pave(G.primitives[B["assise"]])
    ex, ey, ez = (k / 2 for k in cotes)
    galette(m, c + HAUT * ez, 2 * ez, lambda retrait: contour(ex - retrait, ey - retrait, ey * B["arrondi"] - retrait, B["par_coin"]),
            ez * B["chanfrein"], 2 * ez * B["creux"], D["CUVETTE"])
    dessous = c.z - ez
    pieds, cote = pieds_droits(m, G, B["pieds"],
                               lambda c: Vector((c.x * (1 - B["devers"][0]), c.y * (1 - B["devers"][1]), dessous)),
                               B["pied"])
    centre, (lx, ly, lz) = pave(G.primitives[B["entretoise"]])
    rayon = cote * B["cheville"]
    haute = tuple(cote * f for f in B["traverse"])
    traverses(m, pieds, dessous - haute[1], 1, 0.0, haute, arete, cote, [(rayon, 0.0)], a)
    gauche, droit = traverses_basses(m, pieds, centre.z, tuple(cote * f for f in B["traverse_basse"]), rayon, arete,
                                     cote, a)
    entretoise(m, gauche, droit, centre.x + lx / 2 - droit.x, (ly / 2, lz / 2), (ly / 2 * B["tenon"][0], lz / 2 * B["tenon"][1]), B["clavette"], arete)


def trepied(m, c, rayon, epais, pieds, cote, z, section, T, cuvette):
    """Un tabouret d'après `T` (`TABOURET`) : son assise ronde de `rayon`, d'`epais`, creusée par `cuvette`, centrée en
    `c` ; un pied tourné de rayon `cote` depuis chacun des points `pieds` du sol, en dévers vers l'axe de l'assise ; un
    barreau tourné de rayon `section` d'un pied au suivant, à la hauteur `z`."""
    galette(m, c + HAUT * epais / 2, epais,
            lambda retrait: [q.to_2d() for q in anneau(Vector(), X, Y, rayon - retrait, T["cotes"])],
            epais / 2 * T["chanfrein"], epais * T["creux"], cuvette)
    noeuds = []
    for p in pieds:
        pied = (p, Vector((c.x + (p.x - c.x) * (1 - T["devers"]), c.y + (p.y - c.y) * (1 - T["devers"]), c.z)))
        tournee(m, *pied, X, Y, cote, T["pied"]["profil"], T["pied"]["cotes"])
        noeuds.append(a_la_hauteur(pied, z))
    for i, p in enumerate(noeuds):
        barreau(m, p, noeuds[(i + 1) % len(noeuds)], section, T["barreau"])


def tabouret(D, G, pieces, a):
    """Un tabouret d'après `TABOURET` : assise ronde creusée, trois pieds tournés en dévers, trois barreaux."""
    T, m = D["TABOURET"], pieces[MAT]
    c, (lx, _, lz) = pave(G.primitives[T["assise"]])
    disque, (_, _, epais) = pave(G.primitives[T["disque"]])
    pieds = [pave(G.primitives[rang]) for rang in T["pieds"]]
    trepied(m, c, lx / 2 * T["rayon"], lz, [Vector((p.x, p.y, p.z - haut / 2)) for p, (_, _, haut) in pieds],
            pieds[0][1][0] / 2 * T["pied"]["rayon"], disque.z, epais / 2 * T["barreau"]["rayon"], T, D["CUVETTE"])


def tabouret_de_table(D, G, m, assise, fut):
    """Le tabouret (`trepied`) d'une table à tabourets, d'après `TABOURETS`, à la place de l'`assise` et du `fut`
    (rangs) de la recette : ses pieds dans l'emprise du fût."""
    S = D["TABOURETS"]
    (c, rayon, epais), (axe, portee, haut) = rond(G.primitives[assise]), rond(G.primitives[fut])
    sol = Vector((axe.x, axe.y, axe.z - haut / 2))
    trepied(m, c, rayon * S["assise"], epais, [sol + cap(azimut) * (portee * S["ecart"]) for azimut in S["azimuts"]],
            portee * S["pied"], sol.z + haut * S["barreaux"], epais * S["barreau"], D["TABOURET"], D["CUVETTE"])


def chaise(D, G, pieces, a):
    """Une chaise d'après `CHAISE` : pieds avant tournés, montants arrière d'une pièce, assise creusée sur sa ceinture,
    barreaux tournés, dossier à lattes sous une traverse cintrée."""
    C, arete, m = D["CHAISE"], D["ARETE"], pieces[MAT]
    c, cotes = pave(G.primitives[C["assise"]])
    ex, ey, ez = (k / 2 for k in cotes)
    galette(m, c + HAUT * ez, 2 * ez, lambda retrait: contour(ex - retrait, ey - retrait, ex * C["arrondi"] - retrait, C["par_coin"]),
            ez * C["chanfrein"], 2 * ez * C["creux"], D["CUVETTE"])
    dessous = c.z - ez
    pieds, cote = quatre_pieds(G, C["avant"] + tuple(pied for pied, _ in C["arriere"]), lambda c: Vector((c.x, c.y, dessous)))
    demi_haut = cote * C["ceinture"]["hauteur"]
    de = dessous - 2 * demi_haut
    for cle in [cle for cle in pieds if cle[1] < 0]:
        bas, haut = pieds[cle]
        pied_tourne(m, bas, a_la_hauteur(pieds[cle], de), haut, cote, C["pied"], arete)
    montants = {}
    for pied, montant in C["arriere"]:
        (p, demi), (tete, haut) = pave(G.primitives[pied]), pave(G.primitives[montant])
        cle = (1 if p.x > 0 else -1, 1)
        montants[cle[0]] = (Vector((p.x, p.y, p.z - demi[2] / 2)), Vector((tete.x, tete.y, tete.z + haut[2] / 2)))
        pieds[cle] = montants[cle[0]]
        profilee(m, *montants[cle[0]], (demi[0] / 2, demi[1] / 2), C["montant"])
    rayon = cote * C["cheville"]
    for sens in (0, 1):
        traverses(m, pieds, dessous - demi_haut, sens, cote * (1 - C["ceinture"]["retrait"] - C["ceinture"]["epaisseur"]),
                  (cote * C["ceinture"]["epaisseur"], demi_haut), arete, cote, [(rayon, 0.0)], a)
    B = C["barreaux"]
    devant, (_, _, section) = pave(G.primitives[C["barreau"]])
    r = section / 2 * B["rayon"]
    barreau(m, a_la_hauteur(pieds[(-1, -1)], devant.z), a_la_hauteur(pieds[(1, -1)], devant.z), r, B)
    barreau(m, a_la_hauteur(pieds[(-1, 1)], dessous * B["arriere_h"]), a_la_hauteur(pieds[(1, 1)], dessous * B["arriere_h"]), r, B)
    for sx in COTES:
        barreau(m, a_la_hauteur(pieds[(sx, -1)], dessous * B["cotes_h"]), a_la_hauteur(pieds[(sx, 1)], dessous * B["cotes_h"]), r, B)
    S = C["dossier"]
    (haute, (_, epais_haute, haut_haute)), (basse, (_, epais_basse, haut_basse)), (latte, (large_latte, epais_latte, _)) = (
        pave(G.primitives[C[cle]]) for cle in ("haute", "basse", "latte"))
    gauche, droit = [a_la_hauteur(montants[sx], basse.z) for sx in COTES]
    droite(m, gauche, droit, Y, HAUT, epais_basse / 2 * S["epaisseur"], haut_basse / 2, arete)
    gauche, droit = [a_la_hauteur(montants[sx], haute.z) for sx in COTES]
    fleche = (montants[1][1].z - haute.z - haut_haute / 2) * S["cintre"]
    traverse_cintree(m, gauche, droit, haut_haute / 2, fleche, epais_haute / 2 * S["epaisseur"], S["stations"], arete)
    for place in S["lattes"]:
        x = abs(latte.x) * place
        pied = Vector((x, latte.y, basse.z))
        tete = cintree(gauche, droit, haut_haute / 2, fleche, (x - gauche.x) / (droit.x - gauche.x))[0]
        droite(m, pied, Vector((x, latte.y, tete.z)), X, Y,
               large_latte / 2 * S["latte"][0], epais_latte / 2 * S["latte"][1], arete)
    for sx in COTES:
        for z in (basse.z, haute.z):
            p = a_la_hauteur(montants[sx], z)
            cheville(m, Vector((p.x, p.y - cote, p.z)), -Y, rayon, a)


def bureau(D, G, pieces, a):
    """Un bureau d'après `BUREAU` : plateau de planches, caisson à tiroirs entre quatre poteaux, deux pieds à l'autre
    bout, ceinture chevillée, traverse basse et entretoise."""
    B, arete, m = D["BUREAU"], D["ARETE"], pieces[MAT]
    dessous, _ = plateau(m, G.primitives[B["plateau"]], B, a)
    jambes = {}
    for rang in B["pieds"]:
        c, cotes = pave(G.primitives[rang])
        jambes[1 if c.y > 0 else -1] = (Vector((c.x, c.y, c.z - cotes[2] / 2)), Vector((c.x, c.y, dessous)))
    cote = pave(G.primitives[B["pieds"][0]])[1][0] / 2 * B["pied"]["cote"]
    caisson, (lx, ly, lz) = pave(G.primitives[B["caisson"]])
    hx, hy, sol = lx / 2, ly / 2, caisson.z - lz / 2
    poteaux = {(sx, sy): (Vector((caisson.x + sx * (hx - cote), sy * (hy - cote), sol)), Vector((caisson.x + sx * (hx - cote), sy * (hy - cote), dessous)))
               for sx, sy in ANGLES}
    for bas, haut in jambes.values():
        profilee(m, bas, haut, (cote, cote), B["pied"]["profil"])
    for bas, haut in poteaux.values():
        profilee(m, bas, haut, (cote, cote), B["poteau"])

    C = B["ceinture"]
    section, ecart = (cote * C["epaisseur"], cote * C["hauteur"]), cote * (1 - C["retrait"] - C["epaisseur"])
    chevilles = [(cote * B["cheville"], 0.0)]
    z = dessous - section[1]
    traverses(m, {(-1, sy): jambes[sy] for sy in COTES} | {(1, sy): poteaux[(-1, sy)] for sy in COTES}, z, 0, ecart,
              section, arete, cote, chevilles, a)
    traverse(m, [a_la_hauteur(jambes[sy], z) for sy in COTES], X, -1, ecart, section, arete, cote, chevilles, a)
    basse, (bx, _, bz) = pave(G.primitives[B["traverse"]])
    traverse(m, [a_la_hauteur(jambes[sy], basse.z) for sy in COTES], X, -1, 0.0, (bx / 2, bz / 2), arete, cote,
             chevilles, a)
    droite(m, Vector((basse.x, 0, basse.z)), Vector((caisson.x - hx + cote, 0, basse.z)), Y, HAUT, bx / 2 * B["entretoise"][0],
           bz / 2 * B["entretoise"][1], arete)
    cheville(m, Vector((basse.x, 0, basse.z + bz / 2)), HAUT, chevilles[0][0], a)

    S, T = B["caisse"], B["tiroir"]
    garde, retrait = sol + (dessous - sol) * S["garde"], cote * S["retrait"]
    barre(m, [(Vector((caisson.x, 0, h)), hx - retrait, hy - retrait, cote * arete) for h in (garde, dessous)], X, Y)
    epais, recul, demi = (cote * f for f in S["traverse"])
    for cles, travers, signe in ((((1, -1), (1, 1)), X, 1), (((-1, -1), (-1, 1)), X, -1), (((-1, 1), (1, 1)), Y, 1)):
        for h in (garde + demi, dessous - demi):
            traverse(m, [a_la_hauteur(poteaux[cle], h) for cle in cles], travers, signe, cote - recul - epais, (epais, demi), arete, cote,
                     chevilles, a)
    facade = -(hy - retrait)
    bords = [garde]
    for primitive in sorted(G.primitives[slice(*B["tiroirs"])], key=lambda p: p["center"]["hM"]):
        c, (tx, ty, tz) = pave(primitive)
        dv = tz / 2 * T["hauteur"]
        tiroir(m, c.x, facade, c.z, tx / 2 * T["largeur"], dv, c.y - ty / 2, T["boutons"][G.id], T, D)
        bords += [c.z - dv, c.z + dv]
    bords.append(dessous)
    for bas, haut in zip(bords[::2], bords[1::2]):
        traverse(m, [a_la_hauteur(poteaux[(sx, -1)], (bas + haut) / 2) for sx in COTES], Y, -1, cote - recul - epais,
                 (epais, (haut - bas) / 2 * T["traverse"]), arete, cote, [], a)


def armoire(D, G, pieces, a):
    """Une armoire d'après `ARMOIRE` : caisse entre quatre montants sur une plinthe et des pieds en boule, corniche,
    deux portes à panneaux sur leurs pentures, battement et boutons."""
    A, arete, m, fers = D["ARMOIRE"], D["ARETE"], pieces[MAT], pieces["ferrures"]
    (socle, (sx_, sy_, sz_)), (corps, (cx_, cy_, cz_)), (corniche, (kx_, ky_, kz_)), (battement, (bx_, by_, _)) = (
        pave(G.primitives[A["rangs"][cle]]) for cle in ("socle", "corps", "corniche", "battement"))
    hx, hy, bas, haut = cx_ / 2, cy_ / 2, corps.z - cz_ / 2, corps.z + cz_ / 2
    sol = socle.z - sz_ / 2
    P = A["pied"]
    rayon = sy_ / 2 * P["rayon"]
    for sx, sy in ANGLES:
        pied = Vector((sx * (sx_ / 2 - rayon), sy * (sy_ / 2 - rayon), sol))
        tournee(m, pied, pied + HAUT * (sz_ * P["hauteur"]), X, Y, rayon, P["profil"], P["cotes"])
    z = sol + sz_ * P["hauteur"]
    moulure(m, Vector((socle.x, socle.y, z)), bas - z, (hx, hy), (sx_ / 2, sy_ / 2), A["plinthe"], arete)
    z = haut - kz_ * A["bandeau"]
    moulure(m, Vector((corniche.x, corniche.y, z)), corniche.z + kz_ / 2 - z, (hx, hy), (kx_ / 2, ky_ / 2), A["corniche"], arete)

    cote = bx_ * A["montant"]
    retrait = cote * A["caisse"]
    devant = battement.y + by_ / 2
    barre(m, [(Vector((corps.x, (hy - retrait + devant) / 2, h)), hx - retrait, (hy - retrait - devant) / 2, cote * arete) for h in (bas, haut)], X, Y)
    montants = {(sx, sy): (Vector((sx * (hx - cote), sy * (hy - cote), bas)), Vector((sx * (hx - cote), sy * (hy - cote), haut))) for sx, sy in ANGLES}
    for pied, tete in montants.values():
        droite(m, pied, tete, X, Y, cote, cote, arete)
    F = A["flanc"]
    section = (cote * F["epaisseur"], cote * F["hauteur"])
    for part in F["hauteurs"]:
        traverses(m, montants, bas + (haut - bas) * part, 1, cote * (1 - F["retrait"] - F["epaisseur"]), section, arete,
                  cote, [], a)

    O = A["porte"]
    jeu, cadre = cote * O["jeu"], cote * O["cadre"]
    face = -hy - (-hy - (battement.y - by_ / 2)) * O["saillie"]
    epais = (devant - face) / 2
    pied_porte, tete_porte = bas + 2 * section[1] + jeu, haut - kz_ * A["bandeau"] - jeu
    for cote_x, h in ((-1, bas + section[1]), (1, tete_porte + (haut - tete_porte) / 2)):
        droite(m, Vector((-hx + cote, -hy + cote * (F["retrait"] + F["epaisseur"]), h)), Vector((hx - cote, -hy + cote * (F["retrait"] + F["epaisseur"]), h)),
               Y, HAUT, cote * F["epaisseur"], section[1] if cote_x < 0 else (haut - tete_porte) / 2, arete)
    planche(m, Vector((battement.x, battement.y, pied_porte)), Vector((battement.x, battement.y, tete_porte)), X, Y, bx_ / 2, by_ / 2, bx_ / 2 * 2 * arete)
    milieu = pied_porte + (tete_porte - pied_porte) * O["milieu"]
    N, B = A["penture"], A["bouton"]
    for sx in COTES:
        dedans, dehors = sx * (bx_ / 2 + jeu), sx * (hx - 2 * cote - jeu)
        y = (face + devant) / 2
        for x in (dedans + sx * cadre, dehors - sx * cadre):
            droite(m, Vector((x, y, pied_porte)), Vector((x, y, tete_porte)), X, Y, cadre, epais, arete)
        for h in (pied_porte + cadre, milieu, tete_porte - cadre):
            droite(m, Vector((dedans + sx * cadre, devant - epais * O["traverse"], h)), Vector((dehors - sx * cadre, devant - epais * O["traverse"], h)), Y, HAUT,
                   epais * O["traverse"], cadre, arete)
            for x in (dedans + sx * cadre, dehors - sx * cadre):
                cheville(m, Vector((x, face, h)), -Y, cote * O["cheville"], a)
        for z0, z1 in ((pied_porte + 2 * cadre, milieu - cadre), (milieu + cadre, tete_porte - 2 * cadre)):
            panneau(m, Vector(((dedans + dehors) / 2, devant, (z0 + z1) / 2)), -Y, X, HAUT, abs(dehors - dedans) / 2 - 2 * cadre, (z1 - z0) / 2,
                    (devant - face) * O["panneau"], D["PANNEAU"], arete)
        fer, demi = cote * N["epaisseur"], cote * N["hauteur"]
        charniere = sx * (hx - 2 * cote)
        for part in N["hauteurs"]:
            h = pied_porte + (tete_porte - pied_porte) * part
            bout = dehors + (dedans - dehors) * N["longueur"]
            planche(fers, Vector((charniere, face - fer / 2, h)), Vector((bout, face - fer / 2, h)), Y, HAUT, fer / 2 + fer, demi, fer, "fer")
            for place in N["clous"]:
                cheville(fers, Vector((charniere + (bout - charniere) * place, face - fer, h)), -Y, demi * N["clou"], a,
                         "fer")
            tournee(fers, Vector((charniere, face, h - cote * N["noeud"][1])), Vector((charniere, face, h + cote * N["noeud"][1])), X, Y,
                    cote * N["noeud"][0], CYLINDRE, N["cotes"], "fer")
    for rang in A["boutons"]:
        c, (_, py, pz) = pave(G.primitives[rang])
        platine = py * B["platine"][2]
        droite(fers, Vector((c.x, face, c.z - pz * B["platine"][1])), Vector((c.x, face, c.z + pz * B["platine"][1])), X, Y, pz * B["platine"][0],
               platine, arete, "fer")
        tournee(fers, Vector((c.x, face, c.z)), Vector((c.x, c.y - py / 2, c.z)), X, HAUT, pz / 2 * B["rayon"], B["profil"], B["cotes"], "fer")


def etagere(D, G, pieces, a):
    """Une étagère d'après `ETAGERE` : quatre poteaux, tablettes de planches sur leurs traverses chevillées, croix de
    contreventement au dos, livres et coffret."""
    E, arete, m, objets = D["ETAGERE"], D["ARETE"], pieces[MAT], pieces["objets"]
    poteaux = {}
    for rang in E["montants"]:
        c, (lx, ly, lz) = pave(G.primitives[rang])
        for sy in COTES:
            y = sy * (ly / 2 - lx / 2)
            poteaux[(1 if c.x > 0 else -1, sy)] = (Vector((c.x, y, c.z - lz / 2)), Vector((c.x, y, c.z + lz / 2)))
    cote = lx / 2 * E["poteau"]["cote"]
    for pied, tete in poteaux.values():
        profilee(m, pied, tete, (cote, cote), E["poteau"]["profil"])
    section = tuple(cote * f for f in E["traverse"])
    chevilles = [(cote * E["cheville"], 0.0)]
    sol = c.z - lz / 2
    traverses(m, poteaux, sol + lz * E["basse"], 1, 0.0, section, arete, cote, chevilles, a)
    dessus, dessous = {}, {}
    for rang in E["tablettes"]:
        t, cotes = pave(G.primitives[rang])
        dessus[rang] = (t, cotes)
        dessous[rang], _ = plateau(m, G.primitives[rang], E, a)
        z = dessous[rang] - section[1]
        traverses(m, poteaux, z, 1, 0.0, section, arete, cote, chevilles, a)
        traverse(m, [a_la_hauteur(poteaux[(sx, 1)], z) for sx in COTES], Y, 1, 0.0, section, arete, cote, chevilles, a)
    C = E["croix"]
    du, dv = (cote * f for f in C["section"])
    for sous, sur in zip(E["tablettes"], E["tablettes"][1:]):
        z0, z1 = dessus[sous][0].z + dessus[sous][1][2] / 2, dessous[sur] - 2 * section[1]
        marge = (z1 - z0) * C["marge"]
        for rang, (sa, sb) in enumerate(((-1, 1), (1, -1))):
            p, q = a_la_hauteur(poteaux[(sa, 1)], z0 + marge) + Y * (2 * du * rang), a_la_hauteur(poteaux[(sb, 1)], z1 - marge) + Y * (2 * du * rang)
            droite(m, p, q, Y, (q - p).normalized().cross(Y), du, dv, arete)

    L = E["livres"]
    t, (tx, ty, tz) = dessus[L["tablette"]]
    x, fin, pose = t.x + tx / 2 * L["depart"], t.x + tx / 2 * L["fin"], t.z + tz / 2
    while True:
        haut, profond, epais = (ty * a.uniform(*L[cle]) for cle in ("hauteur", "profondeur", "epaisseur"))
        y = t.y + ty / 2 * L["fond"] - profond / 2
        if x + epais > fin:
            break
        droite(objets, Vector((x + epais / 2, y, pose)), Vector((x + epais / 2, y, pose + haut)), X, Y, epais / 2, profond / 2, arete, "cuir")
        x += epais
    d = Vector((-L["penche"], 0, 1)).normalized()
    travers = Y.cross(d)
    pied = Vector((x + haut * L["penche"] + epais, y, pose)) + HAUT * (epais / 2 * L["penche"])
    droite(objets, pied, pied + d * haut, travers, Y, epais / 2, profond / 2, arete, "cuir")
    I = E["pile"]
    t, (tx, ty, tz) = dessus[I["tablette"]]
    pose = t.z + tz / 2
    for _ in range(I["livres"]):
        haut, profond, epais = (ty * a.uniform(*L[cle]) for cle in ("hauteur", "profondeur", "epaisseur"))
        centre = Vector((t.x + tx / 2 * I["place"] + profond * a.uniform(-I["desordre"], I["desordre"]), t.y + profond * a.uniform(-I["desordre"], I["desordre"]), pose))
        droite(objets, centre, centre + HAUT * epais, X, Y, haut / 2, profond / 2, arete, "cuir")
        pose += epais
    O = E["coffret"]
    pose = t.z + tz / 2
    centre = Vector((t.x + tx / 2 * O["place"], t.y, pose))
    du, dv = (ty * f for f in O["demi"])
    droite(m, centre, centre + HAUT * (ty * O["caisse"]), X, Y, du, dv, arete)
    z = pose + ty * (O["caisse"] + O["couvercle"] / 2)
    planche(m, Vector((centre.x - du * O["debord"], centre.y, z)), Vector((centre.x + du * O["debord"], centre.y, z)), Y, HAUT, dv * O["debord"],
            ty * O["couvercle"] / 2, ty * O["couvercle"] / 2 * O["chanfrein"] * arete)


def lit(D, G, pieces, a):
    """Un lit d'après `LIT` : quatre poteaux, longerons et traverses chevillés, chevet haut à panneaux, matelas,
    oreiller, couverture et drap rabattu."""
    L, arete, m, literie = D["LIT"], D["ARETE"], pieces[MAT], pieces["literie"]
    (cadre, (cx_, cy_, cz_)), (chevet, (hx_, hy_, hz_)), (matelas, (mx_, my_, mz_)), (oreiller, (ox_, oy_, oz_)), (couverture, (vx_, vy_, vz_)) = (
        pave(G.primitives[L["rangs"][cle]]) for cle in ("cadre", "chevet", "matelas", "oreiller", "couverture"))
    sol, cote = cadre.z - cz_ / 2, hx_ / 2 * L["poteau"]
    pieds = {}
    for sy in COTES:
        y = sy * (hy_ / 2 - hx_ / 2)
        pieds[(-1, sy)] = (Vector((chevet.x, y, sol)), Vector((chevet.x, y, chevet.z + hz_ / 2)))
        pieds[(1, sy)] = (Vector((cadre.x + cx_ / 2 - hx_ / 2, y, sol)), Vector((cadre.x + cx_ / 2 - hx_ / 2, y, cadre.z + cz_ / 2)))
        profilee(m, *pieds[(-1, sy)], (cote, cote), L["tete"])
        profilee(m, *pieds[(1, sy)], (cote, cote), L["pied"])
    R = L["longeron"]
    section = (cote * R["epaisseur"], cz_ * R["demi"])
    rayon = cote * L["cheville"]
    for sens in (0, 1):
        traverses(m, pieds, sol + cz_ * R["hauteur"], sens, cote * (1 - R["retrait"] - R["epaisseur"]), section, arete, cote,
                  [(rayon, h) for h in R["chevilles"]], a)

    C = L["chevet"]
    demi_haut, epais = (cote * f for f in C["traverse"])
    basse, haute = (sol + hz_ * C[cle] for cle in ("basse", "haute"))
    for h in (basse, haute):
        traverse(m, [a_la_hauteur(pieds[(-1, sy)], h) for sy in COTES], X, 1, 0.0, (epais, demi_haut), arete, cote,
                 [(rayon, 0.0)], a)
    large, demi_montant, epais_montant = hy_ / 2 - hx_ / 2 - cote, cote * C["montant"][0], cote * C["montant"][1]
    demi_panneau = (large - (C["panneaux"] - 1) * demi_montant) / C["panneaux"]
    z0, z1 = basse + demi_haut, haute - demi_haut
    for k in range(C["panneaux"]):
        y = -large + demi_panneau + k * 2 * (demi_panneau + demi_montant)
        for n in (X, -X):
            panneau(m, Vector((chevet.x, y, (z0 + z1) / 2)), n, Y, HAUT, demi_panneau, (z1 - z0) / 2, cote * C["saillie"], D["PANNEAU"], arete)
        if k:
            y -= demi_panneau + demi_montant
            droite(m, Vector((chevet.x, y, z0)), Vector((chevet.x, y, z1)), X, Y, epais_montant, demi_montant, arete)

    M = L["matelas"]
    tete, pied = chevet.x + hx_ / 2, matelas.x + mx_ / 2
    dessous = matelas.z - mz_ / 2 - mz_ * M["enfonce"]
    dessus = matelas.z - mz_ / 2 + mz_ * M["dessus"]
    coussin(literie, Vector(((tete + pied) / 2, matelas.y, dessous)), (pied - tete) / 2 * M["demi"], my_ / 2 * M["demi"], dessus - dessous, D["MATELAS"], "ecru")
    pose = dessus - oz_ * L["oreiller"]["enfonce"]
    coussin(literie, Vector((oreiller.x, oreiller.y, pose)), ox_ / 2, oy_ / 2, (oreiller.z + oz_ / 2 - pose) / (1 + D["OREILLER"]["bombe"]), D["OREILLER"], "ecru")
    V = L["couverture"]
    pose = couverture.z - vz_ / 2 - mz_ * V["tombee"]
    tete = couverture.x - vx_ / 2
    haut = couverture.z + vz_ / 2 - pose
    coussin(literie, Vector(((tete + pied) / 2, couverture.y, pose)), (pied - tete) / 2, vy_ / 2, haut * V["dessus"], D["COUVERTURE"], "rouge")
    rabat = (pied - tete) * V["rabat"]
    coussin(literie, Vector((tete + rabat, couverture.y, pose)), rabat, vy_ / 2, haut, D["RABAT"], "ecru")


def le_long(axe, cotes):
    """Le côté, le long de l'`axe` horizontal X ou Y ou de son opposé, du pavé de `cotes` (x, y, z)."""
    return abs(axe.x) * cotes[0] + abs(axe.y) * cotes[1]


def cadre(m, origine, u, n, largeur, hauteurs, jours, epais, C, D, a):
    """Le cadre chevillé d'une face de normale `n`, parcourue le long de `u` sur `largeur` depuis `origine`, point bas
    de sa face de dehors : d'`epais`, un montant de part et d'autre de chacun des `jours` [(abscisse de son axe,
    demi-largeur)] et deux traverses de l'axe du premier montant à celui du dernier, entre les `hauteurs` (bas du
    cadre, bas des jours, haut des jours, haut du cadre), d'après `C` (`COMPTOIR`) ; rend le centre de chaque jour, au
    fond du cadre."""
    bas, z0, z1, haut = hauteurs
    fine = epais * C["traverse"] / 2
    bords = [0.0, *(s + cote * demi for s, demi in jours for cote in COTES), largeur]
    for dessous, dessus in ((bas, z0), (z1, haut)):
        axe = origine - n * (epais - fine) + HAUT * ((dessous + dessus) / 2 - bas)
        droite(m, axe + u * (bords[1] / 2), axe + u * ((bords[-2] + largeur) / 2), n, HAUT, fine,
               (dessus - dessous) / 2, D["ARETE"])
    for gauche, droit in zip(bords[::2], bords[1::2]):
        pied = origine + u * ((gauche + droit) / 2)
        droite(m, pied - n * (epais / 2), pied - n * (epais / 2) + HAUT * (haut - bas), u, n, (droit - gauche) / 2,
               epais / 2, D["ARETE"])
        for h in ((bas + z0) / 2, (z1 + haut) / 2):
            cheville(m, pied + HAUT * (h - bas), n, epais * C["cheville"], a)
    return [origine + u * s - n * epais + HAUT * ((z0 + z1) / 2 - bas) for s, _ in jours]


def comptoir(D, G, pieces, a):
    """Un comptoir d'après `COMPTOIR` : corps sur sa plinthe, une face par cap de `CAPS` (façade à panneaux en
    saillie sur le corps ; bout ou niche de service, en retrait de la tête de leurs chevilles sous la face du corps),
    plateau en débord sur son chant, d'onglet là où deux façades se suivent, repose-pied de fer sur ses supports."""
    C, arete, m, fers = D["COMPTOIR"], D["ARETE"], pieces[MAT], pieces["fers"]
    R = C["rangs"][G.id]
    (corps, cotes), (socle, (sx_, sy_, sz_)), (dessus, table_) = (pave(G.primitives[R[cle]])
                                                                  for cle in ("corps", "socle", "plateau"))
    etalon, (large, epais, haut_panneau) = pave(G.primitives[R["panneau"]])
    bas, haut = corps.z - cotes[2] / 2, corps.z + cotes[2] / 2
    hauteurs = (bas, etalon.z - haut_panneau / 2, etalon.z + haut_panneau / 2, haut)
    e = epais * C["cadre"]
    jeu = e * C["cheville"] * CHEVILLE["saillie"][1]
    barre(m, [(Vector((socle.x, socle.y, h)), sx_ / 2, sy_ / 2, sz_ * arete) for h in (socle.z - sz_ / 2, bas)], X, Y)

    saillante = [genre == "facade" for genre, _ in R["faces"]]
    retraits = []
    for k, (n, (genre, rangs)) in enumerate(zip(CAPS, R["faces"])):
        u = HAUT.cross(n)
        avant, apres = saillante[k - 1], saillante[(k + 1) % len(CAPS)]
        portee, recul = le_long(u, cotes), le_long(n, cotes) / 2
        niche = le_long(n, cotes) * C["niche"] if genre == "niche" else 0.0
        retraits.append((0.0 if saillante[k] else e + jeu) + niche)
        dehors = recul + (e if saillante[k] else -jeu)
        debut = -portee / 2 + (0.0 if saillante[k] or avant else e)
        fin = portee / 2 + (e if saillante[k] and apres else 0.0)
        pied = Vector((corps.x, corps.y, bas)) + n * dehors
        if rangs:
            jours = []
            for rang in rangs:
                c, panneau_ = pave(G.primitives[rang])
                jours.append(((c - pied).dot(u) - debut, le_long(u, panneau_) / 2))
        else:
            bord, montant = large * C["bord"], large * C["montant"]
            demi = (fin - debut - 2 * bord - (C["jours"] - 1) * montant) / C["jours"] / 2
            jours = [(bord + demi + i * (2 * demi + montant), demi) for i in range(C["jours"])]
        centres = cadre(m, pied + u * debut, u, n, fin - debut, hauteurs, jours, e, C, D, a)
        if genre == "niche":
            T = C["tablette"]
            axe = pied - n * (e + niche / 2) + HAUT * ((haut - bas) * T[0])
            planche(m, axe + u * (-portee / 2 + e), axe + u * (portee / 2 - e), n, HAUT, niche / 2, e * T[1],
                    e * T[1] * 2 * arete)
        else:
            for c, (_, demi) in zip(centres, jours):
                panneau(m, c, n, u, HAUT, demi, haut_panneau / 2, e * C["panneau"], D["PANNEAU"], arete)
        if saillante[k]:
            H = C["chant"]
            demi_large = ((dessus - corps).dot(n) + le_long(n, table_) / 2 - dehors) * H[0] / 2
            demi_haut = (haut - hauteurs[2]) * H[1] / 2
            axe = pied + n * demi_large + HAUT * (haut - bas - demi_haut)
            planche(m, axe + u * (-portee / 2 - (e if avant else 0.0)),
                    axe + u * (portee / 2 + (e + 2 * demi_large if apres else 0.0)), n, HAUT, demi_large, demi_haut,
                    demi_large * H[2])
    devant, est, dos, ouest = retraits
    barre(m, [(Vector((corps.x + (ouest - est) / 2, corps.y + (devant - dos) / 2, h)), (cotes[0] - ouest - est) / 2,
               (cotes[1] - devant - dos) / 2, e * arete) for h in (bas, haut)], X, Y)

    coin = next((k for k in range(len(CAPS)) if saillante[k] and saillante[(k + 1) % len(CAPS)]), None)
    if coin is None:
        plateau(m, G.primitives[R["plateau"]], C, a)
    else:
        ez = table_[2] / 2
        rive = ez * C["rive"]
        for n, vers in ((CAPS[coin], CAPS[(coin + 1) % len(CAPS)]), (CAPS[(coin + 1) % len(CAPS)], CAPS[coin])):
            demi = le_long(n, table_) / 2 / C["planches"]
            angle = dessus + n * (le_long(n, table_) / 2) + vers * (le_long(vers, table_) / 2)
            for k in range(C["planches"]):
                enfonce = ez * a.uniform(*C["affleurement"])
                onglet = angle - (n + vers) * ((2 * k + 1) * demi) - HAUT * enfonce
                bout = angle - n * ((2 * k + 1) * demi) - vers * le_long(vers, table_) - HAUT * enfonce
                coque(m, [octogone(bout, n, HAUT, demi - rive, ez - enfonce - rive, rive / 2),
                          octogone(bout + vers * rive, n, HAUT, demi, ez - enfonce, rive),
                          octogone(onglet, n + vers, HAUT, demi, ez - enfonce, rive)], MAT)

    B, S = C["barre"], C["support"]
    rayons = {}
    for rang in R["barres"]:
        c, tube = pave(G.primitives[rang])
        axe = X if tube[0] > tube[1] else Y
        rayons[rang] = tube[2] / 2 * B["rayon"]
        tournee(fers, c - axe * (le_long(axe, tube) / 2), c + axe * (le_long(axe, tube) / 2), *normales(axe),
                rayons[rang], CYLINDRE, B["cotes"], "fer")
    tete = rayons[R["barres"][-1]] * S["tete"]
    for rang in R["supports"]:
        c, (lx, ly, lz) = pave(G.primitives[rang])
        tournee(fers, c - HAUT * (lz / 2), c + HAUT * (lz / 2 + tete), X, Y, min(lx, ly) / 2 * S["rayon"], S["profil"],
                S["cotes"], "fer")


def etabli(D, G, pieces, a):
    """Un établi d'après `ETABLI` : plateau de madriers, pieds à chanfreins arrêtés, ceinture chevillée, traverses
    basses, entretoise clavetée et tablette basse, presse à mors de bois et vis de fer, maillet, scie de la
    recette."""
    E, arete, m, fers = D["ETABLI"], D["ARETE"], pieces[MAT], pieces["fers"]
    R = E["rangs"]
    table_, (px_, py_, pz_) = pave(G.primitives[R["plateau"]])
    dessous, dessus = plateau(m, G.primitives[R["plateau"]], E, a)
    pieds, cote = pieds_droits(m, G, R["pieds"], lambda c: Vector((c.x, c.y, dessous)), E["pied"])
    centre, (_, ly, lz) = pave(G.primitives[R["entretoise"]])
    basse = tuple(cote * f for f in E["basse"])
    gauche, droit = pietement(m, pieds, cote, dessous, E["ceinture"], cote * E["ceinture"]["hauteur"],
                              cote * E["cheville"], centre.z, basse, cote * E["saillie"], (ly / 2, lz / 2),
                              (ly / 2 * E["tenon"][0], lz / 2 * E["tenon"][1]), E["clavette"], arete, a)
    T = E["tablette"]
    demi, epais = (pieds[(1, 1)][0].y - centre.y - cote) * T["largeur"], cote * T["epaisseur"]
    pose = centre.z + basse[1] + epais
    for k in range(T["planches"]):
        y = centre.y + demi * (2 * k + 1 - T["planches"]) / T["planches"]
        planche(m, Vector((gauche.x - basse[0], y, pose)), Vector((droit.x + basse[0], y, pose)), Y, HAUT,
                demi / T["planches"], epais, epais * E["rive"])

    S = E["presse"]
    etau, (ex_, ey_, ez_) = pave(G.primitives[R["etau"]])
    depart, sommet = etau.x - ex_ / 2, etau.z + ez_ / 2
    M, V, L = S["mors"], S["vis"], S["levier"]
    for part in S["places"]:
        x = depart + ex_ * part
        planche(m, Vector((x, etau.y, dessus - (sommet - dessus) * M["enfonce"])), Vector((x, etau.y, sommet)), X, Y,
                ex_ * M["epaisseur"], ey_ * M["largeur"], ex_ * M["epaisseur"] * M["chanfrein"])
    axe = Vector((depart + ex_ * V["depart"], etau.y, dessus + (sommet - dessus) * V["hauteur"]))
    bout = Vector((etau.x + ex_ / 2, axe.y, axe.z))
    rayon = (sommet - dessus) * V["rayon"]
    tournee(fers, axe, bout, *normales(X), rayon, V["profil"], V["cotes"], "fer")
    bras = (Y + HAUT * L["pente"]) * (ey_ * L["demi"])
    moyeu = axe.lerp(bout, L["place"])
    tournee(fers, moyeu - bras, moyeu + bras, *normales(bras.normalized()), rayon * L["rayon"], L["profil"], L["cotes"],
            "fer")

    Q = E["maillet"]
    longue, large, haute = (pz_ * f for f in Q["tete"])
    manche = Vector((*Q["manche"]["direction"], 0)).normalized()
    tete = Vector((table_.x + px_ / 2 * Q["place"][0], table_.y + py_ / 2 * Q["place"][1], dessus + haute))
    planche(m, tete - HAUT.cross(manche) * longue, tete + HAUT.cross(manche) * longue, manche, HAUT, large, haute,
            haute * 2 * arete)
    rayon = pz_ * Q["manche"]["rayon"]
    bout = Vector((tete.x, tete.y, dessus + rayon)) + manche * (pz_ * Q["manche"]["longueur"])
    tournee(m, tete, bout, *normales((bout - tete).normalized()), rayon, CYLINDRE, Q["manche"]["cotes"])

    if G.id in E["scie"]:
        (lame, (bx, by, bz)), (poignee, (hx, hy, hz)) = (pave(G.primitives[rang]) for rang in E["scie"][G.id])
        sens = Vector((lame.x - poignee.x, 0, 0)).normalized()
        fine, talon, pointe = bz * E["lame"][0], by / 2 * E["lame"][1], by / 2 * E["lame"][2]
        pose = Vector((lame.x, lame.y, dessus + fine))
        barre(fers, [(pose - sens * (bx / 2), talon, fine, fine * arete),
                     (pose + sens * (bx / 2), pointe, fine, fine * arete)], Y, HAUT, "fer")
        demi_large, demi_haut = hy / 2 * E["poignee"][0], hz * E["poignee"][1]
        chanfrein = demi_haut * E["poignee"][2]
        pose = Vector((poignee.x, poignee.y, dessus + demi_haut))
        planche(m, pose - sens * (hx / 2), pose + sens * (hx / 2), Y, HAUT, demi_large, demi_haut, chanfrein)


def siege(D, G, pieces, a):
    """Un siège garni d'après `SIEGE` : pieds avant tournés prolongés d'une console, montants arrière d'une pièce,
    ceinture chevillée et cloutée, barreaux en H, coussin, dossier garni sous sa lisse, accoudoirs coudés."""
    S, arete, m, dorures = D["SIEGE"], D["ARETE"], pieces[MAT], pieces["dorures"]
    R = S["rangs"]
    (caisse, (cx_, cy_, cz_)), (assise, (_, ay_, az_)), (dos, (dx_, dy_, _)), (rampe, _) = (
        pave(G.primitives[R[cle]]) for cle in ("caisse", "coussin", "dossier", "lisse"))
    sol, haut = caisse.z - cz_ / 2, caisse.z + cz_ / 2
    cote = cx_ / 2 * S["pied"]["cote"]
    demi_haut = cote * S["ceinture"]["hauteur"]
    A = S["accoudoir"]
    noeud, mat = A["noeud"][G.id]
    pieds = {}
    for rang in R["accoudoirs"]:
        c, (lx, ly, lz) = pave(G.primitives[rang])
        sx = 1 if c.x > 0 else -1
        x, y = caisse.x + sx * (cx_ / 2 - cote), cy_ / 2 - cote
        avant = pieds[(sx, -1)] = (Vector((x, caisse.y - y, sol)), Vector((c.x, caisse.y - y, c.z)))
        arriere = pieds[(sx, 1)] = (Vector((x, caisse.y + y, sol)),
                                    Vector((dos.x + sx * (dx_ / 2 - cote), dos.y, rampe.z)))
        assis = a_la_hauteur(avant, haut)
        pied_tourne(m, avant[0], a_la_hauteur(avant, haut - 2 * demi_haut), assis, cote, S["pied"], arete)
        tournee(m, assis, avant[1], X, Y, cote, S["console"]["profil"], S["console"]["cotes"])
        profilee(m, *arriere, (cote, cote), S["montant"])
        du, dv = lx / 2 * A["section"][0], lz / 2 * A["section"][1]
        chanfrein = min(du, dv) * 2 * arete
        attache, bout = a_la_hauteur(arriere, c.z), Vector((c.x, c.y - ly / 2, c.z))
        coude = Vector((c.x, attache.y - ly * A["coude"], c.z))
        barre(pieces[noeud], [(attache, du, dv, chanfrein), (coude, du, dv, chanfrein),
                              (bout + Y * du, du, dv, chanfrein),
                              (bout, du * A["bout"], dv * A["bout"], chanfrein * A["bout"])], X, HAUT, mat)

    C, L = S["ceinture"], S["clous"]
    z, ecart, section = haut - demi_haut, cote * (1 - C["retrait"] - C["epaisseur"]), (cote * C["epaisseur"], demi_haut)
    for sens in (0, 1):
        traverses(m, pieds, z, sens, ecart, section, arete, cote, [(cote * S["cheville"], 0.0)], a)
    for gauche, droit, n, nombre in (((-1, -1), (1, -1), -Y, L["devant"]), ((-1, -1), (-1, 1), -X, L["flanc"]),
                                     ((1, -1), (1, 1), X, L["flanc"])):
        p, q = a_la_hauteur(pieds[gauche], z), a_la_hauteur(pieds[droit], z)
        for k in range(nombre):
            t = L["marge"] + (1 - 2 * L["marge"]) * k / (nombre - 1)
            clou(dorures, p.lerp(q, t) + n * (ecart + section[0]), n, L["clou"], demi_haut, "laiton")
    B = S["barreaux"]
    milieux = []
    for sx in COTES:
        p, q = (a_la_hauteur(pieds[(sx, sy)], sol + cz_ * B["hauteur"]) for sy in COTES)
        barreau(m, p, q, cote * B["rayon"], B)
        milieux.append((p + q) / 2)
    barreau(m, *milieux, cote * B["rayon"], B)

    devant, fond = assise.y - ay_ / 2, a_la_hauteur(pieds[(1, 1)], assise.z).y
    coussin(pieces["garniture"], Vector((caisse.x, (devant + fond) / 2, haut)),
            a_la_hauteur(pieds[(1, -1)], assise.z).x - caisse.x - cote, (fond - devant) / 2,
            (assise.z + az_ / 2 - haut) / (1 + D["ASSISE"]["bombe"]), D["ASSISE"], "rouge")
    bas, sommet = ((a_la_hauteur(pieds[(-1, 1)], h) + a_la_hauteur(pieds[(1, 1)], h)) / 2 for h in (assise.z, rampe.z))
    dossier_garni(pieces, bas, sommet, dx_ / 2 - cote, dy_ / 2, S["travees"], S["dossier"], D)
    lisse(dorures, G.primitives[R["lisse"]], D["LISSE"], "laiton")


def canape(D, G, pieces, a):
    """Un canapé d'après `CANAPE` : pieds en boule sous un corps plein, façade à panneaux, coussins entre deux
    accoudoirs à rouleau, dossier garni par travées sous sa lisse."""
    C, arete, m, tissu, dorures = D["CANAPE"], D["ARETE"], pieces[MAT], pieces["garniture"], pieces["dorures"]
    R, travees = C["rangs"], C["travees"]
    (caisse, (cx_, cy_, cz_)), (assise, (_, ay_, az_)), (dos, (dx_, dy_, _)), (rampe, _) = (
        pave(G.primitives[R[cle]]) for cle in ("caisse", "coussin", "dossier", "lisse"))
    sol, haut = caisse.z - cz_ / 2, caisse.z + cz_ / 2
    P = C["pied"]
    rayon, garde = cy_ / 2 * P["rayon"], sol + cz_ * P["hauteur"]
    for place in P["places"]:
        for sy in COTES:
            pied = Vector((caisse.x + place * (cx_ / 2 - rayon), caisse.y + sy * (cy_ / 2 - rayon), sol))
            tournee(m, pied, Vector((pied.x, pied.y, garde)), X, Y, rayon, P["profil"], P["cotes"])
    hx, hy = cx_ / 2 * C["corps"][0], cy_ / 2 * C["corps"][1]
    barre(m, [(Vector((caisse.x, caisse.y, h)), hx, hy, rayon * arete) for h in (garde, haut)], X, Y)
    large, demi_haut, saillie = (
        cote * f for cote, f in zip((hx / travees, (haut - garde) / 2, cy_ / 2 - hy), C["facade"]))
    for k in range(travees):
        centre = Vector((caisse.x + hx / travees * (2 * k + 1 - travees), caisse.y - hy, (garde + haut) / 2))
        panneau(m, centre, -Y, X, HAUT, large, demi_haut, saillie, D["PANNEAU"], arete)

    A = C["accoudoir"]
    devant = assise.y - ay_ / 2
    bords = []
    for rang in R["accoudoirs"]:
        c, (lx, ly, lz) = pave(G.primitives[rang])
        sx = 1 if c.x > 0 else -1
        dedans, demi, r = c.x - sx * lx / 2, lx / 2 * A["flanc"], lx / 2 * A["rouleau"]["rayon"]
        axe = c.z + lz / 2 - r
        barre(tissu, [(Vector((dedans + sx * demi * part, (devant + dos.y) / 2, haut + (axe - haut) * t)), demi * part,
                       (dos.y - devant) / 2, demi * part * A["coin"]) for t, part in A["profil"]], X, Y, "rouge")
        nez = Vector((c.x, devant + r * A["rosace"][1], axe))
        tournee(tissu, Vector((c.x, c.y + ly / 2, axe)), nez, X, HAUT, r, A["rouleau"]["profil"], A["rouleau"]["cotes"],
                "rouge")
        clou(dorures, nez, -Y, A["rosace"], r, "laiton")
        bords.append(dedans)
    large, fond = (max(bords) - min(bords)) / travees, dos.y - dy_ / 2
    epais = (assise.z + az_ / 2 - haut) / (1 + D["ASSISE"]["bombe"])
    for k in range(travees):
        coussin(tissu, Vector((min(bords) + large * (2 * k + 1) / 2, (devant + fond) / 2, haut)), large / 2,
                (fond - devant) / 2, epais, D["ASSISE"], "rouge")
    dossier_garni(pieces, Vector((dos.x, dos.y, haut)), Vector((dos.x, dos.y, rampe.z)), dx_ / 2, dy_ / 2, travees,
                  C["dossier"], D)
    lisse(dorures, G.primitives[R["lisse"]], D["LISSE"], "laiton")


def coiffeuse(D, G, pieces, a):
    """Une coiffeuse d'après `COIFFEUSE` : pieds tournés sous leurs poteaux, deux caissons à tiroirs et un tablier,
    plateau de planches, gradin à tiroirs, miroir à traverse cintrée."""
    C, arete, m = D["COIFFEUSE"], D["ARETE"], pieces[MAT]
    R = C["rangs"]
    (caisse, (cx_, cy_, cz_)), (_, (_, py_, _)), (psyche, (fx_, fy_, fz_)), (_, (gx_, _, _)) = (
        pave(G.primitives[R[cle]]) for cle in ("caisse", "plateau", "cadre", "glace"))
    dessous, pose = plateau(m, G.primitives[R["plateau"]], C, a)
    bas, devant = caisse.z - cz_ / 2, caisse.y - cy_ / 2
    cote = pave(G.primitives[R["pieds"][0]])[1][0] / 2 * C["pied"]["cote"]
    for rang in R["pieds"]:
        c, (_, ly, lz) = pave(G.primitives[rang])
        sx = 1 if c.x > 0 else -1
        for sy in COTES:
            pied = Vector((c.x, c.y + sy * (ly / 2 - cote), c.z - lz / 2))
            coin = Vector((caisse.x + sx * (cx_ / 2 - cote), caisse.y + sy * (cy_ / 2 - cote), bas))
            pied_tourne(m, pied, coin, Vector((coin.x, coin.y, dessous)), cote, C["pied"], arete)

    T = C["tiroir"]
    garde = bas + (dessous - bas) * C["garde"]
    hx, hy = cx_ / 2 - cote * C["retrait"], cy_ / 2 - cote * C["retrait"]
    large, demi = hx * C["caisson"], (dessous - garde) / 4
    for sx in COTES:
        x = caisse.x + sx * (hx - large)
        barre(m, [(Vector((x, caisse.y, h)), large, hy, cote * arete) for h in (garde, dessous)], X, Y)
        for h in (garde + demi, dessous - demi):
            tiroir(m, x, caisse.y - hy, h, large * T["largeur"], demi * T["hauteur"], devant, T["boutons"]["caisson"],
                   T, D)
    milieu, tablier, recul = hx - 2 * large, (dessous - garde) * C["tablier"], hy * C["recul"]
    barre(m, [(Vector((caisse.x, caisse.y, h)), milieu, recul, cote * arete)
              for h in (dessous - tablier, dessous)], X, Y)
    tiroir(m, caisse.x, caisse.y - recul, dessous - tablier / 2, milieu * T["largeur"], tablier / 2 * T["hauteur"],
           devant, T["boutons"]["tablier"], T, D)

    M, N = C["miroir"], C["gradin"]
    sommet, seuil = psyche.z + fz_ / 2, psyche.z - fz_ / 2
    demi, epais, fleche = (fx_ - gx_) / 4 * M["montant"], fy_ / 2 * M["epaisseur"], fz_ * M["cintre"]
    naissance, fine = sommet - fleche - demi, epais * M["traverse"]
    gauche, droit = (Vector((psyche.x + sx * (fx_ / 2 - demi), psyche.y, seuil + demi)) for sx in COTES)
    for bout in (gauche, droit):
        tete = Vector((bout.x, bout.y, sommet - fleche * M["oreille"]))
        droite(m, Vector((bout.x, bout.y, pose)), tete, X, Y, demi, epais, arete)
    droite(m, gauche, droit, Y, HAUT, fine, demi, arete)
    traverse_cintree(m, Vector((gauche.x, gauche.y, naissance)), Vector((droit.x, droit.y, naissance)), demi, fleche,
                     fine, M["stations"], arete)
    droite(pieces["glace"], Vector((psyche.x, psyche.y, seuil + demi)), Vector((psyche.x, psyche.y, naissance)), X, Y,
           fx_ / 2 - demi, epais * M["glace"], arete, "glace")
    marche, profond, du = (seuil - pose) * N["hauteur"], py_ * N["profondeur"], fx_ / 2 * N["largeur"]
    face = psyche.y - profond
    barre(m, [(Vector((psyche.x, psyche.y - profond / 2, h)), du, profond / 2, epais * arete)
              for h in (pose, pose + marche)], X, Y)
    for sx in COTES:
        tiroir(m, psyche.x + sx * du / 2, face, pose + marche / 2, du / 2 * T["largeur"], marche / 2 * T["hauteur"],
               face - epais * N["face"], T["boutons"]["caisson"], T, D)


def table_ronde(D, G, pieces, a):
    """Une table ronde d'après `TABLE_RONDE` : plateau tourné cerclé de fer, fût en balustre bagué, patins cambrés et
    goussets, et ses tabourets (`tabouret_de_table`)."""
    T, arete, m, fers = D["TABLE_RONDE"], D["ARETE"], pieces[MAT], pieces["fers"]
    (c, rayon, epais), (fut, large, haut), (_, portee, _) = (
        rond(G.primitives[T["rangs"][cle]]) for cle in ("plateau", "fut", "socle"))
    dessous, sol = c.z - epais / 2, Vector((fut.x, fut.y, fut.z - haut / 2))
    P, E, F, B = T["plateau"], T["cercle"], T["fut"], T["bague"]
    tournee(m, c - HAUT * (epais / 2), c + HAUT * (epais / 2), X, Y, rayon * P["rayon"], P["profil"], P["cotes"])
    bande = HAUT * (epais / 2 * E["hauteur"])
    tournee(fers, c - bande, c + bande, X, Y, rayon * E["rayon"], CYLINDRE, P["cotes"], "fer")
    pied, tete = sol + HAUT * (haut * F["depart"]), Vector((fut.x, fut.y, dessous))
    tournee(m, pied, tete, X, Y, large * F["rayon"], F["profil"], F["cotes"])
    tournee(fers, *(pied.lerp(tete, t) for t in B["hauteurs"]), X, Y, large * F["rayon"] * B["rayon"], CYLINDRE,
            F["cotes"], "fer")
    S, U = T["patin"], T["gousset"]
    mince = portee * S["epaisseur"]
    for azimut in T["azimuts"]:
        d = cap(azimut)
        travers = HAUT.cross(d)
        barre(m, [(sol + d * (portee * r) + HAUT * (haut * h), mince, haut * demi, mince * 2 * arete)
                  for r, h, demi in S["stations"]], travers, HAUT)
        p, q = tete + d * (large * U["pied"][0]) - HAUT * (haut * U["pied"][1]), tete + d * (rayon * U["tete"])
        droite(m, p, q, travers, (q - p).normalized().cross(travers), large * U["section"][0], large * U["section"][1],
               arete)
    for assise, axe in T["tabourets"]:
        tabouret_de_table(D, G, m, assise, axe)


def table_murale(D, G, pieces, a):
    """Une table murale d'après `TABLE_MURALE` : plateau de planches sur deux consoles chevillées, montant, bras et
    jambe de force, une lisse entre elles, et ses tabourets (`tabouret_de_table`)."""
    T, arete, m = D["TABLE_MURALE"], D["ARETE"], pieces[MAT]
    dessous, _ = plateau(m, G.primitives[T["plateau"]], T, a)
    descend = VERSANTS[G.primitives[T["consoles"][0]]["slope"]][1]
    mur = Y * -descend
    cote = pave(G.primitives[T["consoles"][0]])[1][0] / 2 * T["montant"]["cote"]
    rayon = cote * T["cheville"]
    B, J = T["bras"], T["jambe"]
    bras, jambe, barre_ = (tuple(cote * f for f in section) for section in (B["section"], J["section"], T["lisse"]))
    montants = []
    for rang in T["consoles"]:
        c, (_, ly, lz) = pave(G.primitives[rang])
        dehors = X * (1 if c.x > 0 else -1)
        pied = Vector((c.x, c.y, c.z - lz / 2)) + mur * (ly / 2 - cote)
        montants.append((pied, Vector((pied.x, pied.y, dessous))))
        profilee(m, *montants[-1], (cote, cote), T["montant"]["profil"])
        epaule = Vector((pied.x, pied.y, dessous - bras[1]))
        bout = Vector((c.x, c.y, epaule.z)) - mur * (ly / 2 * B["portee"])
        droite(m, epaule, bout, X, (bout - epaule).normalized().cross(X), *bras, arete)
        talon = Vector((pied.x, pied.y, pied.z + (dessous - pied.z) * J["pied"]))
        appui = epaule.lerp(bout, J["tete"]) - HAUT * bras[1]
        droite(m, talon, appui, X, (appui - talon).normalized().cross(X), *jambe, arete)
        for p, face in ((epaule, cote), (talon, cote), (appui, bras[0])):
            cheville(m, p + dehors * face, dehors, rayon, a)
    traverse(m, [a_la_hauteur(montant, dessous - barre_[1]) for montant in montants], Y, descend, 0.0, barre_, arete,
             cote, [(rayon, 0.0)], a)
    for assise, axe in T["tabourets"]:
        tabouret_de_table(D, G, m, assise, axe)


CONSTRUCTEURS = {"table": table, "table-2x1": table, "chaise": chaise, "banc": banc, "tabouret": tabouret, "armoire": armoire,
                 "bureau": bureau, "bureau-2x1": bureau, "etagere": etagere, "lit": lit,
                 "comptoir-droit": comptoir, "comptoir-angle": comptoir, "etabli": etabli, "etabli-2x1": etabli,
                 "siege": siege, "fauteuil-loge": siege, "canape": canape, "coiffeuse": coiffeuse,
                 "table-ronde-4-tabourets": table_ronde, "table-murale-2-tabourets": table_murale}


def construire(D, id_):
    return geometrie.par_noeuds(D, id_, NOEUDS.get(id_, {MAT: (MAT,)}), CONSTRUCTEURS[id_])


def elements(D):
    return geometrie.elements(D, DECORS, construire)
