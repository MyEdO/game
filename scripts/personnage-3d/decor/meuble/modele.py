"""Les meubles (#4335) : un GLB par décor de `DECORS`, bâti dans l'enveloppe convexe des primitives de sa recette
(`gabarit.py`), dont il lit les cotes (`geometrie.pave`) et où `Gabarit.rentrer` ramène le sommet qui en sortirait.
Chaque pièce est une coque close (`geometrie.coque`) d'anneaux pris dans des plans parallèles : une pièce équarrie, des rectangles aux coins abattus (`barre`) ; une pièce
tournée, des cercles (`tournee`) ; une assise, les contours emboîtés d'un plateau creusé (`galette`). Un pied en dévers
garde ses anneaux horizontaux : il pose à plat. Les pièces s'assemblent en se pénétrant, tenon dans mortaise ; une
cheville en marque chaque assemblage. L'aléa est semé des codes de caractères de l'id du décor : deux constructions
rendent les mêmes octets."""
import math

from mathutils import Vector

import geometrie
from geometrie import HAUT, X, Y, a_la_hauteur, anneau, coque, normales, pave

DECORS = ("table", "table-2x1", "chaise", "banc", "tabouret")
MAT = "bois"
AXES = (X, Y)


def octogone(c, u, v, du, dv, chanfrein):
    """Le rectangle de centre `c` et de demi-côtés `du` sur `u`, `dv` sur `v`, ses coins abattus de `chanfrein`."""
    return [c + u * x + v * y for x, y in ((du - chanfrein, -dv), (du, -dv + chanfrein), (du, dv - chanfrein), (du - chanfrein, dv),
                                           (-du + chanfrein, dv), (-du, dv - chanfrein), (-du, -dv + chanfrein), (-du + chanfrein, -dv))]


def barre(m, stations, u, v):
    """Une pièce équarrie aux arêtes abattues : la coque des sections `stations` [(centre, du, dv, chanfrein)], chacune
    dans le plan de `u` et `v`."""
    coque(m, [octogone(c, u, v, du, dv, chanfrein) for c, du, dv, chanfrein in stations], MAT)


def droite(m, a, b, u, v, du, dv, arete):
    """Une pièce équarrie de `a` à `b`, de section constante, ses bouts pris dans les pièces qu'elle joint."""
    chanfrein = min(du, dv) * arete
    barre(m, [(a, du, dv, chanfrein), (b, du, dv, chanfrein)], u, v)


def planche(m, a, b, u, v, du, dv, chanfrein):
    """Une planche de `a` à `b`, ses rives et ses bouts adoucis de `chanfrein`."""
    d = (b - a).normalized() * chanfrein
    barre(m, [(a, du - chanfrein, dv - chanfrein, chanfrein / 2), (a + d, du, dv, chanfrein), (b - d, du, dv, chanfrein),
              (b, du - chanfrein, dv - chanfrein, chanfrein / 2)], u, v)


def profilee(m, a, b, demi, profil):
    """Une pièce équarrie dressée de `a` à `b`, sections horizontales, de demi-côtés `demi` (x, y) d'après `profil`
    [(part de la longueur, part du demi-côté, chanfrein en fraction du plus petit demi-côté)]."""
    barre(m, [(a.lerp(b, t), demi[0] * part, demi[1] * part, min(demi) * chanfrein) for t, part, chanfrein in profil], X, Y)


def tournee(m, a, b, u, v, rayon, profil, cotes):
    """Une pièce tournée de `a` à `b`, ses cercles dans le plan de `u` et `v`, de `rayon` d'après `profil`
    [(part de la longueur, part du rayon)]."""
    coque(m, [anneau(a.lerp(b, t), u, v, rayon * part, cotes) for t, part in profil], MAT)


def barreau(m, a, b, rayon, B):
    """Un barreau tourné horizontal de `a` à `b`, d'après `B` (côtés, profil)."""
    tournee(m, a, b, HAUT, (b - a).cross(HAUT).normalized(), rayon, B["profil"], B["cotes"])


def cheville(m, p, n, rayon, K, a):
    """Une cheville de `rayon` enfoncée en `p` dans la face de normale `n`, sa tête en saillie, d'après `K` (`CHEVILLE`)."""
    tournee(m, p - n * (rayon * K["enfonce"]), p + n * (rayon * a.uniform(*K["saillie"])), *normales(n), rayon, K["profil"], K["cotes"])


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


def quatre_pieds(G, rangs, tete):
    """Les axes des quatre pieds que portent les primitives de `rangs`, par (signe de x, signe de y) : chacun du sol,
    au centre de sa primitive, à `tete(centre)` ; et le demi-côté de leur primitive."""
    pieds = {}
    for rang in rangs:
        c, cotes = pave(G.primitives[rang])
        pieds[(1 if c.x > 0 else -1, 1 if c.y > 0 else -1)] = (Vector((c.x, c.y, c.z - cotes[2] / 2)), tete(c))
    return pieds, cotes[0] / 2


def traverses(m, pieds, z, sens, ecart, section, arete, face, chevilles, K, a):
    """Les deux traverses qui joignent, à la hauteur `z`, les pieds voisins le long de l'axe `sens` (0 : x, 1 : y),
    chacune écartée d'`ecart` de l'axe de ses pieds vers le dehors, de `section` (demi-épaisseur, demi-hauteur) ; et
    ses `chevilles` (rayon, hauteurs en fractions de sa demi-hauteur), dans la face du pied que son tenon longe, à `face`
    de l'axe du pied."""
    travers = AXES[1 - sens]
    for cote in (-1, 1):
        dehors = travers * cote
        bouts = [a_la_hauteur(pieds[(t, cote) if sens == 0 else (cote, t)], z) for t in (-1, 1)]
        droite(m, bouts[0] + dehors * ecart, bouts[1] + dehors * ecart, travers, HAUT, *section, arete)
        for bout in bouts:
            for rayon, h in chevilles:
                cheville(m, bout + dehors * face + HAUT * (h * section[1]), dehors, rayon, K, a)


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


def table(m, G, D, a):
    """Une table d'après `TABLE` : plateau de planches, pieds à chanfreins arrêtés, ceinture chevillée, piétement en H."""
    T, arete = D["TABLE"], D["ARETE"]
    c, cotes = pave(G.primitives[T["plateau"]])
    ex, ey, ez = (k / 2 for k in cotes)
    dessous = c.z - ez
    largeurs = [a.uniform(*T["largeurs"]) for _ in range(T["planches"])]
    y = c.y - ey
    for part in largeurs:
        demi_largeur = ey * part / sum(largeurs)
        enfonce = ez * a.uniform(*T["affleurement"])
        bouts = [ex - ey * a.uniform(0, T["bouts"]) for _ in range(2)]
        planche(m, Vector((c.x - bouts[0], y + demi_largeur, c.z - enfonce)), Vector((c.x + bouts[1], y + demi_largeur, c.z - enfonce)),
                Y, HAUT, demi_largeur, ez - enfonce, ez * T["rive"])
        y += 2 * demi_largeur
    pieds, cote = quatre_pieds(G, T["pieds"], lambda c: Vector((c.x, c.y, dessous)))
    cote *= T["pied"]["cote"]
    for bas, haut in pieds.values():
        profilee(m, bas, haut, (cote, cote), T["pied"]["profil"])
    C = T["ceinture"]
    demi_haut = pave(G.primitives[T["ceinture_lue"]])[1][2] / 2 * C["hauteur"]
    for sens in (0, 1):
        traverses(m, pieds, dessous - demi_haut, sens, cote * (1 - C["retrait"] - C["epaisseur"]), (cote * C["epaisseur"], demi_haut), arete,
                  cote, [(cote * T["cheville"], h) for h in C["chevilles"]], D["CHEVILLE"], a)
    E = T["entretoise"]
    z = dessous * E["hauteur"]
    traverses(m, pieds, z, 1, 0.0, tuple(cote * f for f in E["traverse"]), arete, cote, [(cote * T["cheville"], 0.0)], D["CHEVILLE"], a)
    gauche, droit = [(a_la_hauteur(pieds[(sx, -1)], z) + a_la_hauteur(pieds[(sx, 1)], z)) / 2 for sx in (-1, 1)]
    entretoise(m, gauche, droit, cote * E["saillie"], tuple(cote * f for f in E["corps"]), tuple(cote * f for f in E["tenon"]), E["clavette"], arete)


def banc(m, G, D, a):
    """Un banc d'après `BANC` : planche creusée, pieds en dévers, traverses chevillées, entretoise clavetée."""
    B, arete = D["BANC"], D["ARETE"]
    c, cotes = pave(G.primitives[B["assise"]])
    ex, ey, ez = (k / 2 for k in cotes)
    galette(m, c + HAUT * ez, 2 * ez, lambda retrait: contour(ex - retrait, ey - retrait, ey * B["arrondi"] - retrait, B["par_coin"]),
            ez * B["chanfrein"], 2 * ez * B["creux"], D["CUVETTE"])
    dessous = c.z - ez
    pieds, cote = quatre_pieds(G, B["pieds"], lambda c: Vector((c.x * (1 - B["devers"][0]), c.y * (1 - B["devers"][1]), dessous)))
    cote *= B["pied"]["cote"]
    for bas, haut in pieds.values():
        profilee(m, bas, haut, (cote, cote), B["pied"]["profil"])
    centre, (lx, ly, lz) = pave(G.primitives[B["entretoise"]])
    cheville_ = [(cote * B["cheville"], 0.0)]
    haute = tuple(cote * f for f in B["traverse"])
    traverses(m, pieds, dessous - haute[1], 1, 0.0, haute, arete, cote, cheville_, D["CHEVILLE"], a)
    traverses(m, pieds, centre.z, 1, 0.0, tuple(cote * f for f in B["traverse_basse"]), arete, cote, cheville_, D["CHEVILLE"], a)
    gauche, droit = [(a_la_hauteur(pieds[(sx, -1)], centre.z) + a_la_hauteur(pieds[(sx, 1)], centre.z)) / 2 for sx in (-1, 1)]
    entretoise(m, gauche, droit, centre.x + lx / 2 - droit.x, (ly / 2, lz / 2), (ly / 2 * B["tenon"][0], lz / 2 * B["tenon"][1]), B["clavette"], arete)


def tabouret(m, G, D, a):
    """Un tabouret d'après `TABOURET` : assise ronde creusée, trois pieds tournés en dévers, trois barreaux."""
    T = D["TABOURET"]
    c, (lx, _, lz) = pave(G.primitives[T["assise"]])
    galette(m, c + HAUT * lz / 2, lz, lambda retrait: [q.to_2d() for q in anneau(Vector(), X, Y, lx / 2 * T["rayon"] - retrait, T["cotes"])],
            lz / 2 * T["chanfrein"], lz * T["creux"], D["CUVETTE"])
    disque, (_, _, epais) = pave(G.primitives[T["disque"]])
    pieds = []
    for rang in T["pieds"]:
        p, (cote, _, haut) = pave(G.primitives[rang])
        pied = (Vector((p.x, p.y, p.z - haut / 2)), Vector((p.x * (1 - T["devers"]), p.y * (1 - T["devers"]), c.z)))
        tournee(m, *pied, X, Y, cote / 2 * T["pied"]["rayon"], T["pied"]["profil"], T["pied"]["cotes"])
        pieds.append(a_la_hauteur(pied, disque.z))
    for i, p in enumerate(pieds):
        barreau(m, p, pieds[(i + 1) % len(pieds)], epais / 2 * T["barreau"]["rayon"], T["barreau"])


def chaise(m, G, D, a):
    """Une chaise d'après `CHAISE` : pieds avant tournés, montants arrière d'une pièce, assise creusée sur sa ceinture,
    barreaux tournés, dossier à lattes sous une traverse cintrée."""
    C, arete, K = D["CHAISE"], D["ARETE"], D["CHEVILLE"]
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
        tournee(m, bas, a_la_hauteur(pieds[cle], de), X, Y, cote, C["pied"]["profil"], C["pied"]["cotes"])
        profilee(m, a_la_hauteur(pieds[cle], de), haut, (cote, cote), ((0.0, 1.0, arete), (1.0, 1.0, arete)))
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
                  (cote * C["ceinture"]["epaisseur"], demi_haut), arete, cote, [(rayon, 0.0)], K, a)
    B = C["barreaux"]
    devant, (_, _, section) = pave(G.primitives[C["barreau"]])
    r = section / 2 * B["rayon"]
    barreau(m, a_la_hauteur(pieds[(-1, -1)], devant.z), a_la_hauteur(pieds[(1, -1)], devant.z), r, B)
    barreau(m, a_la_hauteur(pieds[(-1, 1)], dessous * B["arriere_h"]), a_la_hauteur(pieds[(1, 1)], dessous * B["arriere_h"]), r, B)
    for sx in (-1, 1):
        barreau(m, a_la_hauteur(pieds[(sx, -1)], dessous * B["cotes_h"]), a_la_hauteur(pieds[(sx, 1)], dessous * B["cotes_h"]), r, B)
    S = C["dossier"]
    (haute, (_, epais_haute, haut_haute)), (basse, (_, epais_basse, haut_basse)), (latte, (large_latte, epais_latte, _)) = (
        pave(G.primitives[C[cle]]) for cle in ("haute", "basse", "latte"))
    gauche, droit = [a_la_hauteur(montants[sx], basse.z) for sx in (-1, 1)]
    droite(m, gauche, droit, Y, HAUT, epais_basse / 2 * S["epaisseur"], haut_basse / 2, arete)
    gauche, droit = [a_la_hauteur(montants[sx], haute.z) for sx in (-1, 1)]
    fleche = (montants[1][1].z - haute.z - haut_haute / 2) * S["cintre"]

    def cintree(t):
        """Le centre et la demi-hauteur de la traverse haute à la part `t` de sa longueur."""
        demi = haut_haute / 2 + fleche * 2 * t * (1 - t)
        return gauche.lerp(droit, t) + HAUT * (demi - haut_haute / 2), demi
    chanfrein = epais_haute / 2 * S["epaisseur"] * 2 * arete
    barre(m, [(*cintree(k / (S["stations"] - 1)), epais_haute / 2 * S["epaisseur"], chanfrein) for k in range(S["stations"])], HAUT, Y)
    for place in S["lattes"]:
        x = abs(latte.x) * place
        pied = Vector((x, latte.y, basse.z))
        droite(m, pied, Vector((x, latte.y, cintree((x - gauche.x) / (droit.x - gauche.x))[0].z)), X, Y,
               large_latte / 2 * S["latte"][0], epais_latte / 2 * S["latte"][1], arete)
    for sx in (-1, 1):
        for z in (basse.z, haute.z):
            p = a_la_hauteur(montants[sx], z)
            cheville(m, Vector((p.x, p.y - cote, p.z)), -Y, rayon, K, a)


CONSTRUCTEURS = {"table": table, "table-2x1": table, "chaise": chaise, "banc": banc, "tabouret": tabouret}


def construire(D, id_):
    return geometrie.par_noeuds(D, id_, {MAT: (MAT,)}, lambda D, G, pieces, a: CONSTRUCTEURS[id_](pieces[MAT], G, D, a))


def elements(D):
    return geometrie.elements(D, DECORS, construire)
