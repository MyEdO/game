"""Les meubles (#4335) : un GLB par décor de `DECORS`, bâti dans l'enveloppe convexe des primitives de sa recette
(`gabarit.py`), dont il lit les cotes (`geometrie.pave`) et où `Gabarit.rentrer` ramène le sommet qui en sortirait.
Chaque pièce est une coque close (`geometrie.coque`) d'anneaux pris dans des plans parallèles : une pièce équarrie, des rectangles aux coins abattus (`barre`) ; une pièce
tournée, des cercles (`tournee`) ; une assise, les contours emboîtés d'un plateau creusé (`galette`) ; une pièce de
literie, ceux d'un coussin (`coussin`). Un pied en dévers
garde ses anneaux horizontaux : il pose à plat. Les pièces s'assemblent en se pénétrant, tenon dans mortaise ; une
cheville en marque chaque assemblage. L'aléa est semé des codes de caractères de l'id du décor : deux constructions
rendent les mêmes octets."""
import math

from mathutils import Vector

import geometrie
from geometrie import ANGLES, HAUT, X, Y, a_la_hauteur, anneau, coque, normales, pave

DECORS = ("table", "table-2x1", "chaise", "banc", "tabouret", "armoire", "bureau", "bureau-2x1", "etagere", "lit")
MAT = "bois"
NOEUDS = {"armoire": {MAT: (MAT,), "ferrures": ("fer",)}, "etagere": {MAT: (MAT,), "objets": ("cuir",)},
          "lit": {MAT: (MAT,), "literie": ("ecru", "rouge")}}
"""Les nœuds d'un décor qui en a d'autres que celui de son bois, et les matériaux de chacun (`MATERIAUX` de `donnees.py`)."""
AXES = (X, Y)


def octogone(c, u, v, du, dv, chanfrein):
    """Le rectangle de centre `c` et de demi-côtés `du` sur `u`, `dv` sur `v`, ses coins abattus de `chanfrein`."""
    return [c + u * x + v * y for x, y in ((du - chanfrein, -dv), (du, -dv + chanfrein), (du, dv - chanfrein), (du - chanfrein, dv),
                                           (-du + chanfrein, dv), (-du, dv - chanfrein), (-du, -dv + chanfrein), (-du + chanfrein, -dv))]


def barre(m, stations, u, v, mat=MAT):
    """Une pièce équarrie aux arêtes abattues : la coque des sections `stations` [(centre, du, dv, chanfrein)], chacune
    dans le plan de `u` et `v`."""
    coque(m, [octogone(c, u, v, du, dv, chanfrein) for c, du, dv, chanfrein in stations], mat)


def droite(m, a, b, u, v, du, dv, arete, mat=MAT):
    """Une pièce équarrie de `a` à `b`, de section constante, ses bouts pris dans les pièces qu'elle joint."""
    chanfrein = min(du, dv) * arete
    barre(m, [(a, du, dv, chanfrein), (b, du, dv, chanfrein)], u, v, mat)


def planche(m, a, b, u, v, du, dv, chanfrein, mat=MAT):
    """Une planche de `a` à `b`, ses rives et ses bouts adoucis de `chanfrein`."""
    d = (b - a).normalized() * chanfrein
    barre(m, [(a, du - chanfrein, dv - chanfrein, chanfrein / 2), (a + d, du, dv, chanfrein), (b - d, du, dv, chanfrein),
              (b, du - chanfrein, dv - chanfrein, chanfrein / 2)], u, v, mat)


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


def profilee(m, a, b, demi, profil):
    """Une pièce équarrie dressée de `a` à `b`, sections horizontales, de demi-côtés `demi` (x, y) d'après `profil`
    [(part de la longueur, part du demi-côté, chanfrein en fraction du plus petit demi-côté)]."""
    barre(m, [(a.lerp(b, t), demi[0] * part, demi[1] * part, min(demi) * chanfrein) for t, part, chanfrein in profil], X, Y)


def tournee(m, a, b, u, v, rayon, profil, cotes, mat=MAT):
    """Une pièce tournée de `a` à `b`, ses cercles dans le plan de `u` et `v`, de `rayon` d'après `profil`
    [(part de la longueur, part du rayon)]."""
    coque(m, [anneau(a.lerp(b, t), u, v, rayon * part, cotes) for t, part in profil], mat)


def barreau(m, a, b, rayon, B):
    """Un barreau tourné horizontal de `a` à `b`, d'après `B` (côtés, profil)."""
    tournee(m, a, b, HAUT, (b - a).cross(HAUT).normalized(), rayon, B["profil"], B["cotes"])


def cheville(m, p, n, rayon, K, a, mat=MAT):
    """Une cheville de `rayon` enfoncée en `p` dans la face de normale `n`, sa tête en saillie, d'après `K` (`CHEVILLE`)."""
    tournee(m, p - n * (rayon * K["enfonce"]), p + n * (rayon * a.uniform(*K["saillie"])), *normales(n), rayon, K["profil"], K["cotes"], mat)


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
    `K` (`MATELAS`, `OREILLER`, `COUVERTURE`, `RABAT`) : coins arrondis, contour rentré le long de son profil, dessus
    bombé."""
    rayon = min(du, dv) * K["arrondi"]
    anneaux = [[c + Vector((x, y, epaisseur * t)) for x, y in contour(du - epaisseur * r, dv - epaisseur * r, rayon - epaisseur * r, K["par_coin"])]
               for t, r in K["profil"]]
    coque(m, anneaux, mat, c + HAUT * (epaisseur * (1 + K["bombe"])))


def plateau(m, primitive, P, a):
    """Le plateau de planches jointes que porte `primitive`, d'après `P` (`PLANCHES`) : rives adoucies, bouts inégaux ;
    rend la hauteur de son dessous."""
    c, cotes = pave(primitive)
    ex, ey, ez = (k / 2 for k in cotes)
    largeurs = [a.uniform(*P["largeurs"]) for _ in range(P["planches"])]
    y = c.y - ey
    for part in largeurs:
        demi_largeur = ey * part / sum(largeurs)
        enfonce = ez * a.uniform(*P["affleurement"])
        bouts = [ex - ey * a.uniform(0, P["bouts"]) for _ in range(2)]
        planche(m, Vector((c.x - bouts[0], y + demi_largeur, c.z - enfonce)), Vector((c.x + bouts[1], y + demi_largeur, c.z - enfonce)),
                Y, HAUT, demi_largeur, ez - enfonce, ez * P["rive"])
        y += 2 * demi_largeur
    return c.z - ez


def quatre_pieds(G, rangs, tete):
    """Les axes des quatre pieds que portent les primitives de `rangs`, par (signe de x, signe de y) : chacun du sol,
    au centre de sa primitive, à `tete(centre)` ; et le demi-côté de leur primitive."""
    pieds = {}
    for rang in rangs:
        c, cotes = pave(G.primitives[rang])
        pieds[(1 if c.x > 0 else -1, 1 if c.y > 0 else -1)] = (Vector((c.x, c.y, c.z - cotes[2] / 2)), tete(c))
    return pieds, cotes[0] / 2


def traverse(m, bouts, travers, cote, ecart, section, arete, face, chevilles, K, a):
    """La traverse qui joint les points `bouts` des axes de deux pieds, écartée d'`ecart` de ces axes vers le dehors, du
    côté `cote` (-1, 1) de l'axe `travers`, de `section` (demi-épaisseur, demi-hauteur) ; et ses `chevilles` (rayon,
    hauteurs en fractions de sa demi-hauteur), dans la face du pied que son tenon longe, à `face` de l'axe du pied."""
    dehors = travers * cote
    droite(m, bouts[0] + dehors * ecart, bouts[1] + dehors * ecart, travers, HAUT, *section, arete)
    for bout in bouts:
        for rayon, h in chevilles:
            cheville(m, bout + dehors * face + HAUT * (h * section[1]), dehors, rayon, K, a)


def traverses(m, pieds, z, sens, ecart, section, arete, face, chevilles, K, a):
    """Les deux traverses (`traverse`) qui joignent, à la hauteur `z`, les pieds voisins le long de l'axe `sens`
    (0 : x, 1 : y), une de chaque côté."""
    for cote in (-1, 1):
        traverse(m, [a_la_hauteur(pieds[(t, cote) if sens == 0 else (cote, t)], z) for t in (-1, 1)], AXES[1 - sens], cote,
                 ecart, section, arete, face, chevilles, K, a)


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
    """Une table d'après `TABLE` : plateau de planches, pieds à chanfreins arrêtés, ceinture chevillée, piétement en H."""
    T, arete, m = D["TABLE"], D["ARETE"], pieces[MAT]
    dessous = plateau(m, G.primitives[T["plateau"]], T, a)
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


def banc(D, G, pieces, a):
    """Un banc d'après `BANC` : planche creusée, pieds en dévers, traverses chevillées, entretoise clavetée."""
    B, arete, m = D["BANC"], D["ARETE"], pieces[MAT]
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


def tabouret(D, G, pieces, a):
    """Un tabouret d'après `TABOURET` : assise ronde creusée, trois pieds tournés en dévers, trois barreaux."""
    T, m = D["TABOURET"], pieces[MAT]
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


def chaise(D, G, pieces, a):
    """Une chaise d'après `CHAISE` : pieds avant tournés, montants arrière d'une pièce, assise creusée sur sa ceinture,
    barreaux tournés, dossier à lattes sous une traverse cintrée."""
    C, arete, K, m = D["CHAISE"], D["ARETE"], D["CHEVILLE"], pieces[MAT]
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


def bureau(D, G, pieces, a):
    """Un bureau d'après `BUREAU` : plateau de planches, caisson à tiroirs entre quatre poteaux, deux pieds à l'autre
    bout, ceinture chevillée, traverse basse et entretoise."""
    B, arete, K, m = D["BUREAU"], D["ARETE"], D["CHEVILLE"], pieces[MAT]
    dessous = plateau(m, G.primitives[B["plateau"]], B, a)
    jambes = {}
    for rang in B["pieds"]:
        c, cotes = pave(G.primitives[rang])
        jambes[1 if c.y > 0 else -1] = (Vector((c.x, c.y, c.z - cotes[2] / 2)), Vector((c.x, c.y, dessous)))
    cote = cotes[0] / 2 * B["pied"]["cote"]
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
    traverses(m, {(-1, sy): jambes[sy] for sy in (-1, 1)} | {(1, sy): poteaux[(-1, sy)] for sy in (-1, 1)}, z, 0, ecart, section, arete,
              cote, chevilles, K, a)
    traverse(m, [a_la_hauteur(jambes[sy], z) for sy in (-1, 1)], X, -1, ecart, section, arete, cote, chevilles, K, a)
    basse, (bx, _, bz) = pave(G.primitives[B["traverse"]])
    traverse(m, [a_la_hauteur(jambes[sy], basse.z) for sy in (-1, 1)], X, -1, 0.0, (bx / 2, bz / 2), arete, cote, chevilles, K, a)
    droite(m, Vector((basse.x, 0, basse.z)), Vector((caisson.x - hx + cote, 0, basse.z)), Y, HAUT, bx / 2 * B["entretoise"][0],
           bz / 2 * B["entretoise"][1], arete)
    cheville(m, Vector((basse.x, 0, basse.z + bz / 2)), HAUT, chevilles[0][0], K, a)

    S, T = B["caisse"], B["tiroir"]
    garde, retrait = sol + (dessous - sol) * S["garde"], cote * S["retrait"]
    barre(m, [(Vector((caisson.x, 0, h)), hx - retrait, hy - retrait, cote * arete) for h in (garde, dessous)], X, Y)
    epais, recul, demi = (cote * f for f in S["traverse"])
    for cles, travers, signe in ((((1, -1), (1, 1)), X, 1), (((-1, -1), (-1, 1)), X, -1), (((-1, 1), (1, 1)), Y, 1)):
        for h in (garde + demi, dessous - demi):
            traverse(m, [a_la_hauteur(poteaux[cle], h) for cle in cles], travers, signe, cote - recul - epais, (epais, demi), arete, cote,
                     chevilles, K, a)
    facade = -(hy - retrait)
    bords = [garde]
    for primitive in sorted(G.primitives[slice(*B["tiroirs"])], key=lambda p: p["center"]["hM"]):
        c, (tx, ty, tz) = pave(primitive)
        du, dv = tx / 2 * T["largeur"], tz / 2 * T["hauteur"]
        devant = c.y - ty / 2
        saillie = (facade - devant) * T["saillie"]
        panneau(m, Vector((c.x, facade, c.z)), -Y, X, HAUT, du, dv, saillie, D["PANNEAU"], arete)
        for place in T["boutons"][G.id]:
            x = c.x + du * place
            tournee(m, Vector((x, facade - saillie, c.z)), Vector((x, devant, c.z)), X, HAUT, dv * T["bouton"]["rayon"], T["bouton"]["profil"],
                    T["bouton"]["cotes"])
        bords += [c.z - dv, c.z + dv]
    bords.append(dessous)
    for bas, haut in zip(bords[::2], bords[1::2]):
        traverse(m, [a_la_hauteur(poteaux[(sx, -1)], (bas + haut) / 2) for sx in (-1, 1)], Y, -1, cote - recul - epais,
                 (epais, (haut - bas) / 2 * T["traverse"]), arete, cote, [], K, a)


def armoire(D, G, pieces, a):
    """Une armoire d'après `ARMOIRE` : caisse entre quatre montants sur une plinthe et des pieds en boule, corniche,
    deux portes à panneaux sur leurs pentures, battement et boutons."""
    A, arete, K, m, fers = D["ARMOIRE"], D["ARETE"], D["CHEVILLE"], pieces[MAT], pieces["ferrures"]
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
        traverses(m, montants, bas + (haut - bas) * part, 1, cote * (1 - F["retrait"] - F["epaisseur"]), section, arete, cote, [], K, a)

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
    for sx in (-1, 1):
        dedans, dehors = sx * (bx_ / 2 + jeu), sx * (hx - 2 * cote - jeu)
        y = (face + devant) / 2
        for x in (dedans + sx * cadre, dehors - sx * cadre):
            droite(m, Vector((x, y, pied_porte)), Vector((x, y, tete_porte)), X, Y, cadre, epais, arete)
        for h in (pied_porte + cadre, milieu, tete_porte - cadre):
            droite(m, Vector((dedans + sx * cadre, devant - epais * O["traverse"], h)), Vector((dehors - sx * cadre, devant - epais * O["traverse"], h)), Y, HAUT,
                   epais * O["traverse"], cadre, arete)
            for x in (dedans + sx * cadre, dehors - sx * cadre):
                cheville(m, Vector((x, face, h)), -Y, cote * O["cheville"], K, a)
        for z0, z1 in ((pied_porte + 2 * cadre, milieu - cadre), (milieu + cadre, tete_porte - 2 * cadre)):
            panneau(m, Vector(((dedans + dehors) / 2, devant, (z0 + z1) / 2)), -Y, X, HAUT, abs(dehors - dedans) / 2 - 2 * cadre, (z1 - z0) / 2,
                    (devant - face) * O["panneau"], D["PANNEAU"], arete)
        fer, demi = cote * N["epaisseur"], cote * N["hauteur"]
        charniere = sx * (hx - 2 * cote)
        for part in N["hauteurs"]:
            h = pied_porte + (tete_porte - pied_porte) * part
            bout = dehors + (dedans - dehors) * N["longueur"]
            planche(fers, Vector((charniere, face - fer / 2, h)), Vector((bout, face - fer / 2, h)), Y, HAUT, fer / 2 + fer, demi, fer, "fer")
            for clou in N["clous"]:
                cheville(fers, Vector((charniere + (bout - charniere) * clou, face - fer, h)), -Y, demi * N["clou"], K, a, "fer")
            tournee(fers, Vector((charniere, face, h - cote * N["noeud"][1])), Vector((charniere, face, h + cote * N["noeud"][1])), X, Y,
                    cote * N["noeud"][0], ((0.0, 1.0), (1.0, 1.0)), N["cotes"], "fer")
    for rang in A["boutons"]:
        c, (_, py, pz) = pave(G.primitives[rang])
        platine = py * B["platine"][2]
        droite(fers, Vector((c.x, face, c.z - pz * B["platine"][1])), Vector((c.x, face, c.z + pz * B["platine"][1])), X, Y, pz * B["platine"][0],
               platine, arete, "fer")
        tournee(fers, Vector((c.x, face, c.z)), Vector((c.x, c.y - py / 2, c.z)), X, HAUT, pz / 2 * B["rayon"], B["profil"], B["cotes"], "fer")


def etagere(D, G, pieces, a):
    """Une étagère d'après `ETAGERE` : quatre poteaux, tablettes de planches sur leurs traverses chevillées, croix de
    contreventement au dos, livres et coffret."""
    E, arete, K, m, objets = D["ETAGERE"], D["ARETE"], D["CHEVILLE"], pieces[MAT], pieces["objets"]
    poteaux = {}
    for rang in E["montants"]:
        c, (lx, ly, lz) = pave(G.primitives[rang])
        for sy in (-1, 1):
            y = sy * (ly / 2 - lx / 2)
            poteaux[(1 if c.x > 0 else -1, sy)] = (Vector((c.x, y, c.z - lz / 2)), Vector((c.x, y, c.z + lz / 2)))
    cote = lx / 2 * E["poteau"]["cote"]
    for pied, tete in poteaux.values():
        profilee(m, pied, tete, (cote, cote), E["poteau"]["profil"])
    section = tuple(cote * f for f in E["traverse"])
    chevilles = [(cote * E["cheville"], 0.0)]
    sol = c.z - lz / 2
    traverses(m, poteaux, sol + lz * E["basse"], 1, 0.0, section, arete, cote, chevilles, K, a)
    dessus, dessous = {}, {}
    for rang in E["tablettes"]:
        t, cotes = pave(G.primitives[rang])
        dessus[rang] = (t, cotes)
        dessous[rang] = plateau(m, G.primitives[rang], E, a)
        z = dessous[rang] - section[1]
        traverses(m, poteaux, z, 1, 0.0, section, arete, cote, chevilles, K, a)
        traverse(m, [a_la_hauteur(poteaux[(sx, 1)], z) for sx in (-1, 1)], Y, 1, 0.0, section, arete, cote, chevilles, K, a)
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
    L, arete, K, m, literie = D["LIT"], D["ARETE"], D["CHEVILLE"], pieces[MAT], pieces["literie"]
    (cadre, (cx_, cy_, cz_)), (chevet, (hx_, hy_, hz_)), (matelas, (mx_, my_, mz_)), (oreiller, (ox_, oy_, oz_)), (couverture, (vx_, vy_, vz_)) = (
        pave(G.primitives[L["rangs"][cle]]) for cle in ("cadre", "chevet", "matelas", "oreiller", "couverture"))
    sol, cote = cadre.z - cz_ / 2, hx_ / 2 * L["poteau"]
    pieds = {}
    for sy in (-1, 1):
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
                  [(rayon, h) for h in R["chevilles"]], K, a)

    C = L["chevet"]
    demi_haut, epais = (cote * f for f in C["traverse"])
    basse, haute = (sol + hz_ * C[cle] for cle in ("basse", "haute"))
    for h in (basse, haute):
        traverse(m, [a_la_hauteur(pieds[(-1, sy)], h) for sy in (-1, 1)], X, 1, 0.0, (epais, demi_haut), arete, cote, [(rayon, 0.0)], K, a)
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


CONSTRUCTEURS = {"table": table, "table-2x1": table, "chaise": chaise, "banc": banc, "tabouret": tabouret, "armoire": armoire,
                 "bureau": bureau, "bureau-2x1": bureau, "etagere": etagere, "lit": lit}


def construire(D, id_):
    return geometrie.par_noeuds(D, id_, NOEUDS.get(id_, {MAT: (MAT,)}), CONSTRUCTEURS[id_])


def elements(D):
    return geometrie.elements(D, DECORS, construire)
