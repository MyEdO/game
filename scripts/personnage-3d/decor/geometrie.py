"""La géométrie commune aux modèles des décors (#4335) : les axes, le front de la recette, les axes d'une primitive de
la recette, les coins d'un carré, les deux côtés d'un axe, la boîte et le cylindre d'une primitive en `Vector`,
l'apothème d'un cylindre et les bouts de son axe, le rampant d'un prisme et le point sous lui, le
repère normal à un axe, le point d'une boîte de la recette compté en demi-côtés, le cap d'un azimut, le vecteur d'un
plan à un angle, les normales d'une tangente, le point d'un chemin à une hauteur, la courbe lissée par des points, le
facteur d'un relief, l'anneau régulier, la section bosselée et la coque close d'une suite d'anneaux ; les pièces que
les familles partagent
(coque bosselée, pièce équarrie, planche, planche rampante, pièce profilée, son profil de poteau à chanfreins arrêtés
et la pièce profilée dans une boîte de la recette, pièce tournée, son profil droit, le fil droit et la pièce tournée
dans un cylindre de la recette, prolongée dans ses voisines, étoffe froncée et le point de sa surface, pièce ronde
courbée, feuille en lame, cheville et ses cotes, clou, anneau plat de section rectangulaire, chaîne pendue, bougie sur
sa bobèche, étoffe plissée et dais, rampe d'escalier, pierre taillée, assise et massif harpé, charbons, ardoises,
planches côte à côte, pièce plate découpée) et le partage inégal d'une longueur ; et la déclaration des éléments d'une
famille, avec ses nœuds par matériau et la construction d'un décor dont les nœuds se bâtissent ensemble."""
import math

from mathutils import Vector

import habillage
from gabarit import NOEUD_EMISSIF, VERSANTS, Gabarit, boite, vers_blender
from maille import Maille, cylindre, lineaire, objet, point, poutre, tirage, tore, tour

X, Y, HAUT = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
FRONT = Vector(vers_blender(0, 1, 0))
"""Le sens du front de la recette (`yM` croissant) dans le repère de Blender."""
ANGLES = ((1, 1), (-1, 1), (-1, -1), (1, -1))
"""Les signes (x, y) des quatre coins d'un carré centré, dans le sens direct."""
COTES = (-1, 1)
"""Les signes des deux côtés d'un axe, le négatif puis le positif."""
AXES = {"x": ("x", X), "y": ("y", Y), "h": ("z", HAUT)}
"""L'axe de `maille` (`point`, `tour`, `tore`) et le vecteur unitaire d'un axe de la recette, l'`axis` d'un cylindre."""
MAT = "bois"
"""Le matériau d'une pièce de bois (`barre`, `planche`, `profilee`, `tournee`, `cheville`, `bordage`)."""
BRAISES = "braises"
"""Le matériau des braises et de leurs charbons (`charbons`), qui luit (`par_materiau`)."""


def pave(primitive):
    """Le centre et les côtés (x, y, z) de la boîte, du prisme ou du cylindre d'axe vertical `primitive` de la recette
    (`gabarit.boite`)."""
    centre, demi = boite(primitive)
    return Vector(centre), tuple(2 * e for e in demi)


def rond(primitive):
    """Le centre, le rayon et la longueur du cylindre `primitive` de la recette (`pave`)."""
    centre, (diametre, _, longueur) = pave(primitive)
    return centre, diametre / 2, longueur


def apotheme(primitive):
    """L'apothème du cylindre `primitive` de la recette : le rayon du cercle inscrit dans son polygone, celui de la
    plus grande pièce tournée qu'il contienne."""
    return primitive["radiusM"] * math.cos(math.pi / primitive["sides"])


def bouts(primitive):
    """Les deux bouts de l'axe du cylindre `primitive` de la recette, dans le sens direct du repère de son axe
    (`repere`), ce repère et son rayon : ses sommets sont ceux d'un anneau de ce repère."""
    centre, rayon, longueur = rond(primitive)
    u, w = repere(AXES[primitive["axis"]][0])
    demi = u.cross(w) * (longueur / 2)
    return centre - demi, centre + demi, u, w, rayon


def rampant(primitive):
    """Le rampant du prisme `primitive` de la recette : le sens horizontal unitaire où il descend (`VERSANTS`), le
    milieu de sa crête, celui de son égout, sa longueur dans ce sens et sa largeur en travers."""
    c, (lx, ly, lz) = pave(primitive)
    descend = Vector(VERSANTS[primitive["slope"]])
    long = abs(descend.x) * lx + abs(descend.y) * ly
    return (descend, c - descend * (long / 2) + HAUT * (lz / 2), c + descend * (long / 2) - HAUT * (lz / 2), long,
            lx + ly - long)


def repere(axe):
    """Les deux vecteurs unitaires `(u, w)` du plan normal à l'axe `axe` de `maille` ('x', 'y' ou 'z'), dans l'ordre
    des décalages de `maille.point`."""
    return tuple(Vector(point(axe, (0, 0, 0), *decale)) for decale in ((0, 1, 0), (0, 0, 1)))


def cadre(primitive, cote):
    """La fonction qui rend le point de position `(x, y, z)` dans la boîte de `primitive`, comptée en demi-côtés depuis
    son centre : `x` du côté `cote` (-1 ou 1), `y` vers le front, `z` vers le haut."""
    c, (lx, ly, lz) = pave(primitive)
    return lambda p: c + X * (cote * p[0] * lx / 2) + FRONT * (p[1] * ly / 2) + HAUT * (p[2] * lz / 2)


def sous_le_rampant(pente, p, sous):
    """Le point à l'aplomb de `p`, à `sous` (m) sous le rampant `pente` (`rampant`)."""
    descend, crete, egout, long, _ = pente
    return Vector((p.x, p.y, crete.z + (p - crete).dot(descend) * (egout.z - crete.z) / long - sous))


def cap(azimut):
    """Le vecteur horizontal unitaire d'`azimut` degrés."""
    return Vector((math.cos(math.radians(azimut)), math.sin(math.radians(azimut)), 0))


def autour(u, w, angle):
    """Le vecteur `u cos(angle) + w sin(angle)` : à `angle` radians de `u` vers `w` s'ils sont unitaires et normaux,
    sinon le point de l'ellipse de demi-axes `u` et `w`."""
    return u * math.cos(angle) + w * math.sin(angle)


def normale(t):
    """Une normale unitaire à la tangente unitaire `t`."""
    ref = X if abs(t.x) < 0.9 else Y
    return (ref - t * ref.dot(t)).normalized()


def normales(t):
    """Deux normales unitaires `(n, b)` à la tangente unitaire `t`, `(t, n, b)` direct."""
    n = normale(t)
    return n, t.cross(n)


def a_la_hauteur(chemin, z):
    """Le point de `chemin`, qui monte, à la hauteur `z`."""
    i = max(i for i, p in enumerate(chemin[:-1]) if p.z <= z)
    return chemin[i].lerp(chemin[i + 1], (z - chemin[i].z) / (chemin[i + 1].z - chemin[i].z))


def lisse(points, pas):
    """La courbe de Catmull-Rom par `points`, `pas` points par tronçon."""
    chemin = []
    for i in range(len(points) - 1):
        p0, p1, p2, p3 = points[max(i - 1, 0)], points[i], points[i + 1], points[min(i + 2, len(points) - 1)]
        for s in range(pas):
            t = s / pas
            chemin.append(0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t ** 2
                                 + (3 * p1 - p0 - 3 * p2 + p3) * t ** 3))
    return chemin + [points[-1]]


def relief(e1, e2, part):
    """Le facteur d'un relief à l'écart `(e1, e2)` de son milieu, compté en demi-étendues sur chacun de ses deux
    sens : il gonfle de `part` en son milieu, ou creuse si elle est négative, jusqu'à rien à son bord et au-delà."""
    if abs(e1) < 1 and abs(e2) < 1:
        return 1 + part * (math.cos(math.pi * e1 / 2) * math.cos(math.pi * e2 / 2)) ** 2
    return 1.0


def anneau(centre, u, v, rayon, cotes):
    """Les `cotes` sommets du polygone régulier de `rayon` autour de `centre`, dans le plan de `u` et `v` unitaires, le
    premier sur `u`, dans le sens de `u` vers `v`."""
    return [centre + autour(u, v, 2 * math.pi * j / cotes) * rayon for j in range(cotes)]


def bosselee(a, u, v, cotes, bosse):
    """La section bosselée de `cotes` côtés dans le plan de `u` et `v` (triplets), chacun à une part du rayon tirée
    dans `bosse`, tournée d'un angle tiré ensuite : la fonction qui rend ses sommets autour d'un centre, à un rayon,
    chacun calculé en double précision avant son `Vector`."""
    bosses = [a.uniform(*bosse) for _ in range(cotes)]
    phase = a.uniform(0, 2 * math.pi)
    angles = [phase + 2 * math.pi * j / cotes for j in range(cotes)]
    return lambda centre, rayon: [Vector([p + (du * math.cos(t) + dv * math.sin(t)) * (rayon * b)
                                          for p, du, dv in zip(centre, u, v)]) for t, b in zip(angles, bosses)]


def coque(m, anneaux, mat, pointe=None):
    """La coque close des `anneaux` successifs (listes de points de même longueur) : le premier fermé à plat, le
    dernier à plat aussi, ou en cône vers `pointe`."""
    k = len(anneaux[0])
    sommets = [tuple(p) for anneau in anneaux for p in anneau]
    faces = [[i * k + j, i * k + (j + 1) % k, (i + 1) * k + (j + 1) % k, (i + 1) * k + j]
             for i in range(len(anneaux) - 1) for j in range(k)]
    faces.append(list(range(k))[::-1])
    dernier = (len(anneaux) - 1) * k
    if pointe is None:
        faces.append([dernier + j for j in range(k)])
    else:
        faces += [[dernier + j, dernier + (j + 1) % k, len(sommets)] for j in range(k)]
        sommets.append(tuple(pointe))
    m.ajouter(sommets, faces, mat)


def bossue(m, a, b, section, rayon, profil, mat, pointe):
    """Une coque bosselée de `a` à `b` : un anneau de `section` (la fonction de ses sommets autour d'un centre, à un
    rayon : `bosselee`) par rang de `profil` [(part de la longueur, part de `rayon`)], fermée en cône vers `pointe`.
    Rend ses anneaux."""
    anneaux = [section(a.lerp(b, t), rayon * part) for t, part in profil]
    coque(m, anneaux, mat, pointe)
    return anneaux


def octogone(c, u, v, du, dv, chanfrein):
    """Le rectangle de centre `c` et de demi-côtés `du` sur `u`, `dv` sur `v`, ses coins abattus de `chanfrein`."""
    return [c + u * x + v * y for x, y in ((du - chanfrein, -dv), (du, -dv + chanfrein), (du, dv - chanfrein),
                                           (du - chanfrein, dv), (-du + chanfrein, dv), (-du, dv - chanfrein),
                                           (-du, -dv + chanfrein), (-du + chanfrein, -dv))]


def barre(m, stations, u, v, mat=MAT):
    """Une pièce équarrie aux arêtes abattues : la coque des sections `stations` [(centre, du, dv, chanfrein)], chacune
    dans le plan de `u` et `v`."""
    coque(m, [octogone(c, u, v, du, dv, chanfrein) for c, du, dv, chanfrein in stations], mat)


def planche(m, a, b, u, v, du, dv, chanfrein, mat=MAT):
    """Une planche de `a` à `b`, ses rives et ses bouts adoucis de `chanfrein`."""
    d = (b - a).normalized() * chanfrein
    barre(m, [(a, du - chanfrein, dv - chanfrein, chanfrein / 2), (a + d, du, dv, chanfrein),
              (b - d, du, dv, chanfrein), (b, du - chanfrein, dv - chanfrein, chanfrein / 2)], u, v, mat)


def rampante(m, a, b, du, dv, chanfrein, mat=MAT):
    """Une planche de `a` à `b` (`planche`), de demi-côtés `du` en travers, horizontal, et `dv` dans son plan
    vertical."""
    fil = (b - a).normalized()
    travers = fil.cross(HAUT).normalized()
    planche(m, a, b, travers, fil.cross(travers), du, dv, chanfrein, mat)


def profilee(m, a, b, demi, profil, mat=MAT, u=X, v=Y):
    """Une pièce équarrie de `a` à `b`, ses sections dans le plan de `u` et `v` (horizontales par défaut), de
    demi-côtés `demi` (sur `u`, sur `v`) d'après `profil` [(part de la longueur, part du demi-côté sur `u`, part du
    demi-côté sur `v`, chanfrein en fraction du plus petit demi-côté de `demi`)]."""
    barre(m, [(a.lerp(b, t), demi[0] * part_x, demi[1] * part_y, min(demi) * chanfrein)
              for t, part_x, part_y, chanfrein in profil], u, v, mat)


POTEAU = ((0.0, 1.0, 1.0, 0.08), (0.06, 1.0, 1.0, 0.08), (0.10, 1.0, 1.0, 0.30), (0.86, 1.0, 1.0, 0.30),
          (0.90, 1.0, 1.0, 0.08), (1.0, 1.0, 1.0, 0.08))
"""Le profil d'un poteau à chanfreins arrêtés (`profilee`)."""


def profile(m, primitive, axe, profil, mat):
    """La pièce profilée dans la boîte `primitive` de la recette, d'un bout à l'autre de son axe `axe` ('x', 'y' ou
    'h'), ses sections dans le repère de cet axe (`repere`), de demi-côtés ceux de la boîte, d'après `profil`
    (`profilee`). Rend ses deux bouts."""
    c, taille = pave(primitive)
    nom, long = AXES[axe]
    u, v = repere(nom)
    demi_long, du, dv = (sum(cote * e for cote, e in zip(taille, d)) / 2 for d in (long, u, v))
    a, b = c - long * demi_long, c + long * demi_long
    profilee(m, a, b, (du, dv), profil, mat, u, v)
    return a, b


def tournee(m, a, b, u, v, rayon, profil, cotes, mat=MAT):
    """Une pièce tournée de `a` à `b`, ses cercles dans le plan de `u` et `v`, de `rayon` d'après `profil`
    [(part de la longueur, part du rayon)]."""
    coque(m, [anneau(a.lerp(b, t), u, v, rayon * part, cotes) for t, part in profil], mat)


CYLINDRE = ((0.0, 1.0), (1.0, 1.0))
"""Le profil d'une pièce tournée de rayon constant (`tournee`)."""


def fil(m, a, b, rayon, cotes, mat=MAT):
    """Un fil droit de `a` à `b`, de `rayon`, à `cotes` côtés."""
    tournee(m, a, b, *normales((b - a).normalized()), rayon, CYLINDRE, cotes, mat)


def tourne(m, primitive, profil, cotes, mat, ancrage=(0.0, 0.0)):
    """La pièce tournée dans le cylindre `primitive` de la recette, de rayon son apothème d'après `profil` [(part de la
    longueur, part de l'apothème)] (`tournee`), prolongée au-delà du premier et du second des bouts de son axe
    (`bouts`) des parts `ancrage` de la longueur du cylindre, où elle entre dans ses voisines. Rend ses deux bouts."""
    a, b, u, w, _ = bouts(primitive)
    a, b = a - (b - a) * ancrage[0], b + (b - a) * ancrage[1]
    tournee(m, a, b, u, w, apotheme(primitive), profil, cotes, mat)
    return a, b


def froncee(m, stations, plis, pas, a, mat, pointe=None):
    """Une étoffe froncée : la coque des anneaux horizontaux de `stations` [(centre, demi-axes (x, y), creux)], chacun
    ovale, de `plis` plis de `pas` points, son rayon ramené de la part `creux` au fond de chaque pli, le premier pli à
    une phase tirée ; fermée à plat, ou en cône vers `pointe` (`coque`). Rend la fonction du point de sa surface sur
    l'anneau d'une station, à un azimut (radians), à `saillie` (m) au-dehors d'elle sur son demi-axe x."""
    phase = a.uniform(0, 2 * math.pi)

    def surface(station, angle, saillie=0.0):
        c, (du, dv), creux = station
        rayon = du * (1 - creux * (1 - math.cos(plis * angle + phase)) / 2)
        return c + (X * math.cos(angle) + Y * (math.sin(angle) * (dv / du))) * (rayon + saillie)
    angles = [2 * math.pi * j / (plis * pas) for j in range(plis * pas)]
    coque(m, [[surface(station, t) for t in angles] for station in stations], mat, pointe)
    return surface


def courbee(m, chemin, axe, rayons, cotes, mat):
    """Une pièce ronde courbée le long de `chemin`, courbe d'un plan normal à `axe` unitaire, son rayon de
    `rayons[0]` au premier point à `rayons[1]` au dernier."""
    dernier = len(chemin) - 1
    anneaux = []
    for i, p in enumerate(chemin):
        t = (chemin[min(i + 1, dernier)] - chemin[max(i - 1, 0)]).normalized()
        anneaux.append(anneau(p, axe, t.cross(axe), rayons[0] + (rayons[1] - rayons[0]) * i / dernier, cotes))
    coque(m, anneaux, mat)


def feuille(m, depart, d, travers, long, F, large, epais, mat):
    """Une feuille en lame de `long` depuis `depart`, dans le sens `d` unitaire, de demi-largeur `large` sur
    `travers` unitaire, normal à `d`, et de demi-épaisseur `epais`, d'après `F` : son fil lissé par `nervure`
    (`lisse`, `pas` points par tronçon), sa demi-largeur le long du fil (`limbe`), ses rives biseautées (`biseau`)."""
    dessus = d.cross(travers)
    chemin = lisse([depart + d * (long * t) + dessus * (long * fleche) for t, fleche in F["nervure"]], F["pas"])
    barre(m, [(p, large * lineaire(F["limbe"], i / (len(chemin) - 1)), epais, epais * F["biseau"])
              for i, p in enumerate(chemin)], travers, dessus, mat)


# Cheville (`cheville`) : côtés ; part de son rayon enfoncée dans le bois ; saillie de sa tête (fraction de son rayon,
# tirée) ; profil (part de la longueur, part du rayon).
CHEVILLE = {"cotes": 5, "enfonce": 1.0, "saillie": (0.25, 0.45), "profil": ((0.0, 1.0), (1.0, 0.75))}


def cheville(m, p, n, rayon, a, mat=MAT):
    """Une cheville de `rayon` enfoncée en `p` dans la face de normale `n`, sa tête en saillie, d'après `CHEVILLE`."""
    C = CHEVILLE
    tournee(m, p - n * (rayon * C["enfonce"]), p + n * (rayon * a.uniform(*C["saillie"])), *normales(n), rayon,
            C["profil"], C["cotes"], mat)


def clou(m, centre, dehors, C, demi, mat):
    """Une tête de clou en pointe de diamant posée sur `centre`, tournée vers `dehors`, d'après `C` (`CLOU`), en
    fractions de `demi`."""
    u, v = normales(dehors)
    c = C[0] * demi
    coque(m, [[centre + u * a * c + v * b * c for a, b in ANGLES]], mat, centre + dehors * C[1] * demi)


def cercle(m, axe, centre, r, h, e, segments, mat):
    """Un anneau plat de section rectangulaire autour de l'axe `axe` par `centre` : son rayon moyen `r`, sa hauteur `h`
    le long de l'axe, son épaisseur `e`."""
    tour(m, [(-h / 2, r - e / 2), (h / 2, r - e / 2), (h / 2, r + e / 2), (-h / 2, r + e / 2)], axe, centre, segments,
         mat, ferme=True)


def chaine(m, x, y, z0, z1, nombre, grand, petit, segments, mat):
    """Une chaîne de `nombre` maillons à l'aplomb de (`x`, `y`), leurs centres de `z0` à `z1`, chacun un tore de rayon
    `grand` et de fer `petit` (`segments` du tour et de la section), le premier normal à x, les suivants alternés."""
    for k in range(nombre):
        tore(m, "xy"[k % 2], (x, y, z0 + (z1 - z0) * k / (nombre - 1)), grand, petit, *segments, mat)


def bougie(bobeche, cire, flamme, pied, demi, haut, sommet, B):
    """Une bougie d'après `B`, ses rayons et la hauteur de sa flamme en fractions de `demi` : sa bobèche et son binet,
    tournés dans `bobeche`, leur profil en parts de `haut` au-dessus de `pied` ; sa cire dans `cire`, de `haut`
    au-dessus de `pied` à la hauteur `sommet` ; sa flamme dans `flamme`, sur la cire."""
    axe = (pied.x, pied.y, 0)
    segments, pans = B["segments"]
    tour(bobeche, [(pied.z + part * haut, f * demi) for part, f in B["bobeche"]], "z", axe, segments, "laiton")
    cylindre(cire, pied.z + haut, sommet, B["cire"] * demi, "z", axe, segments, "cire")
    hauteur, profil = B["flamme"]
    tour(flamme, [(sommet + part * hauteur * demi, f * demi) for part, f in profil], "z", axe, pans, "flamme")


def partage(a, nombre, ecart):
    """Les bornes de `nombre` parts de [0, 1], chaque borne du dedans écartée d'au plus `ecart` de sa part."""
    return [0.0] + [(k + a.uniform(-ecart, ecart)) / nombre for k in range(1, nombre)] + [1.0]


def onde(c, u, n, demi, epais, creux, plis, phase, pas, festons, chute):
    """Le contour clos d'une étoffe d'épaisseur `epais`, de demi-largeur `demi` le long de `u` autour de `c`, qui
    ondule de `creux` le long de `n` en `plis` plis de `pas` points, le premier à `phase`, et se déplace de `chute`
    au milieu de chacun de ses `festons` : sa face du côté de `n`, puis l'autre au retour."""
    points = plis * pas
    fil = [c + u * (demi * (2 * j / points - 1)) + n * (creux * math.cos(2 * math.pi * j / pas + phase))
           + chute * abs(math.sin(math.pi * festons * j / points)) for j in range(points + 1)]
    return [p + n * (epais / 2) for p in fil] + [p - n * (epais / 2) for p in reversed(fil)]


def dais(m, pente, V, tombee, chute, chevron, a):
    """La toile d'un dais sur le rampant `pente` (`rampant`), d'après `V`, en fractions de sa largeur : `epais`,
    `creux` de son onde sur la pente, `pli` de son lambrequin ; `largeur`, sa demi-largeur (part de celle du
    rampant) ; `pente`, ses rangs de la crête à l'égout (parts de la pente) ; `lambrequin`, ses rangs pendus à
    l'égout (part de `tombee`, part de `chute`) ; `plis`, `pas`, `festons` (`onde`). Ses chevrons ont la hauteur et
    entrent de la part de celle-ci dans leur sablière de `chevron`. Rend la normale de la toile vers le dessus, le
    point de l'axe d'un chevron à l'aplomb d'un point, et le dessus d'une sablière à l'aplomb d'un point."""
    descend, crete, egout, _, large = pente
    travers = descend.cross(HAUT)
    n = travers.cross((egout - crete).normalized())
    epais, creux, pli = (large * V[nom] for nom in ("epais", "creux", "pli"))
    rangs = [(crete.lerp(egout, t) - n * (creux + epais / 2), n, creux, 0) for t in V["pente"]]
    rangs += [(egout - descend * (pli + epais / 2) - HAUT * (tombee * t), descend, pli, feston)
              for t, feston in V["lambrequin"]]
    phase = a.uniform(0, 2 * math.pi)
    coque(m, [onde(p, travers, vers, large / 2 * V["largeur"], epais, ampleur, V["plis"], phase, V["pas"],
                   V["festons"], chute * feston) for p, vers, ampleur, feston in rangs], "toile")
    haut, entaille = chevron
    sous = (creux + epais + haut / 2) / n.z

    def axe(p):
        """Le point de l'axe d'un chevron à l'aplomb de `p`."""
        return sous_le_rampant(pente, p, sous)

    def appui(p):
        """La hauteur du dessus d'une sablière à l'aplomb de `p`, où entre un chevron."""
        return axe(p).z - haut / 2 / n.z * (1 - entaille)
    return n, axe, appui


def rampe(m, G, R, arete, pommeau):
    """Une rampe d'après `R`, son bois dans `m`, ses arêtes adoucies d'`arete` (fraction de l'épaisseur d'une pièce) :
    la lisse basse de la boîte de rang `lisse` de la recette ; par paire de `poteaux` (rangs du cylindre d'un poteau
    et de celui de son pommeau), un poteau à chanfreins arrêtés (`POTEAU`) de demi-côté `poteau["cote"]` (part du
    rayon de son cylindre), dressé de la part `poteau["ancrage"]` de la hauteur de la lisse sous son dessus, coiffé de
    son pommeau tourné dans `pommeau` (maille, matériau), de `pommeau["profil"]` (part de la hauteur, part du rayon),
    `pommeau["cotes"]`, entré dans le poteau de la part `pommeau["ancrage"]` de sa hauteur ; une main courante sous la
    tête des poteaux et une lisse rampante sur leur pied (hauteurs `main` et `rampante`, parts de la hauteur du
    premier poteau), de demi-largeur et demi-hauteur `section` (parts de son rayon) ; entre elles, `balustres` :
    `nombre`, `rayon` (part de celui du poteau), `profil`, `cotes`."""
    cl, (lx, ly, lz) = pave(G.primitives[R["lisse"]])
    long = Y if ly > lx else X
    planche(m, cl - long * (max(lx, ly) / 2), cl + long * (max(lx, ly) / 2), long.cross(HAUT), HAUT, min(lx, ly) / 2,
            lz / 2, lz * arete)
    Po, Pm = R["poteau"], R["pommeau"]
    pied_z = cl.z + lz / 2 - lz * Po["ancrage"]
    tetes = []
    for poteau, boule in R["poteaux"]:
        cp, r, h = rond(G.primitives[poteau])
        tete = cp + HAUT * (h / 2)
        profilee(m, Vector((cp.x, cp.y, pied_z)), tete, (r * Po["cote"],) * 2, POTEAU)
        cb, rb, hb = rond(G.primitives[boule])
        tournee(pommeau[0], cb - HAUT * (hb / 2 + hb * Pm["ancrage"]), cb + HAUT * (hb / 2), X, Y, rb, Pm["profil"],
                Pm["cotes"], pommeau[1])
        tetes.append((tete, r, h))
    (t0, r, h), (t1, _, _) = tetes
    main = [t - HAUT * (h * R["main"]) for t in (t0, t1)]
    depart = Vector((t0.x, t0.y, pied_z + h * R["rampante"]))
    basse = (depart, depart + main[1] - main[0])
    demi_l, demi_h = (r * part for part in R["section"])
    for bas, haut in (main, basse):
        rampante(m, bas, haut, demi_l, demi_h, demi_h * 2 * arete)
    B = R["balustres"]
    for k in range(1, B["nombre"] + 1):
        t = k / (B["nombre"] + 1)
        tournee(m, basse[0].lerp(basse[1], t), main[0].lerp(main[1], t), X, Y, r * B["rayon"], B["profil"],
                B["cotes"])


def moellon(m, face, dehors, u, du, dv, queue, K, a):
    """Une pierre taillée dont `face` est le milieu du parement, tourné vers `dehors`, de demi-côtés `du` sur `u` et
    `dv` en travers, enfoncée de `queue`, d'après `K` (en fractions de `dv` : `joint`, demi-joint laissé sur son
    pourtour ; `arete`, chanfrein de ses arêtes ; `parement`, recul de sa face, tiré entre ces bornes)."""
    joint, arete = dv * K["joint"], dv * K["arete"]
    p = face - dehors * (dv * a.uniform(*K["parement"]))
    barre(m, [(p - dehors * queue, du - joint, dv - joint, arete), (p - dehors * arete, du - joint, dv - joint, arete),
              (p, du - joint - arete, dv - joint - arete, arete / 2)], u, dehors.cross(u), "pierre")


def assise(m, centre, dehors, u, bornes, nombre, ecart, dv, queue, K, a):
    """Une assise du parement tourné vers `dehors` : `nombre` moellons (`moellon`) le long de `u`, depuis `centre`, de
    `bornes[0]` à `bornes[1]`, de demi-hauteur `dv`, enfoncés de `queue`, leurs joints écartés d'au plus `ecart`
    (`partage`)."""
    t0, t1 = bornes
    milieu, demi = (t0 + t1) / 2, (t1 - t0) / 2
    limites = [milieu + demi * (2 * part - 1) for part in partage(a, nombre, ecart)]
    for b0, b1 in zip(limites, limites[1:]):
        moellon(m, centre + u * ((b0 + b1) / 2), dehors, u, (b1 - b0) / 2, dv, queue, K, a)


def appareil(m, c, cotes, lit, tete, P, K, a, baies):
    """Le massif de pierres taillées de la boîte de centre `c` et de `cotes` (x, y, z), du `lit` à la `tete`, d'après
    `P` : par assise (`assises`), par face normale à x puis normale à y, de chaque côté, une assise (`assise`) de
    `pierres` moellons (par face normale à x, puis à y) taillés d'après `K`, enfoncés de `queue` (fraction de son plus
    petit demi-côté), leurs joints écartés d'au plus `ecart`, harpée aux angles : une assise sur deux, de parités
    alternées d'une face à l'autre, s'arrête à `queue` de chaque bout ; devant un blocage plein dont le dessus reste
    à `retrait` (fraction d'une assise) sous la tête. `baies` {côté : (bornes sur x depuis `c`, bornes en hauteur)}
    ouvre ses faces normales à y : l'assise dont le milieu tombe entre ces hauteurs n'y garde que ses deux côtés,
    chacun de la moitié de ses pierres. Rend le dessus du blocage et la queue."""
    lx, ly, _ = cotes
    queue = min(lx, ly) / 2 * P["queue"]
    haut = (tete - lit) / P["assises"]
    for k in range(P["assises"]):
        milieu = Vector((c.x, c.y, lit + haut * (k + 0.5)))
        for rang, (dehors, u, demi, portee) in enumerate(((X, Y, lx / 2, ly / 2), (Y, X, ly / 2, lx / 2))):
            courte = portee - (queue if (k + rang) % 2 else 0)
            nombre = P["pierres"][rang]
            for cote in COTES:
                troncons = [((-courte, courte), nombre)]
                baie = baies.get(cote) if rang else None
                if baie and baie[1][0] < milieu.z < baie[1][1]:
                    troncons = [((-courte, baie[0][0]), -(-nombre // 2)), ((baie[0][1], courte), -(-nombre // 2))]
                for bornes, pierres in troncons:
                    assise(m, milieu + dehors * (cote * demi), dehors * cote, u, bornes, pierres, P["ecart"], haut / 2,
                           queue, K, a)
    dessus = tete - haut * P["retrait"]
    poutre(m, (c.x, c.y, lit), (c.x, c.y, dessus), lx - queue, ly - queue, Y, "pierre")
    return dessus, queue


def charbons(m, dessus, du, dv, L, a):
    """Des charbons en pointe semés sur le lit de braises de milieu `dessus`, dans ses demi-côtés `du` (x) et `dv`
    (y), d'après `L` : leur nombre `charbons` ; chacun de demi-côté tiré dans `grosseur` (fractions de `du`), enfoncé
    de la part `enfonce`, taillé d'après `charbon` (`clou`)."""
    for _ in range(L["charbons"]):
        demi = du * a.uniform(*L["grosseur"])
        pose = dessus + X * (du * a.uniform(-1, 1)) + Y * (dv * a.uniform(-1, 1)) - HAUT * (demi * L["enfonce"])
        clou(m, pose, HAUT, L["charbon"], demi, BRAISES)


def ardoises(m, crete, fil, travers, n, pente, large, mesure, A, a):
    """Les ardoises d'un versant posées sous sa face de normale `n`, de sa `crete` (milieu) le long de `fil` sur
    `pente` (m), larges de `large` le long de `travers`, d'après `A` : `rangs` ; `recouvrement` d'un rang par le
    suivant (part d'un rang) ; `nombre` d'ardoises d'un rang pair, puis d'un rang impair ; `ecart` de leurs joints
    (`partage`) ; `jour` entre deux (fraction de `large`) ; en fractions de `mesure`, leur `epaisseur` et le `jeu`
    laissé sous la face ; `bascule` : ce dont la tête d'une ardoise s'enfonce plus que son pied (en épaisseurs)."""
    e, jeu = mesure * A["epaisseur"], mesure * A["jeu"]
    for rang in range(A["rangs"]):
        t0, t1 = max(rang - A["recouvrement"], 0) / A["rangs"], (rang + 1) / A["rangs"]
        bornes = partage(a, A["nombre"][rang % 2], A["ecart"])
        for x0, x1 in zip(bornes, bornes[1:]):
            axe = crete + travers * (large * ((x0 + x1) / 2 - 1 / 2))
            poutre(m, axe + fil * (pente * t0) - n * (jeu + e / 2 + e * A["bascule"]),
                   axe + fil * (pente * t1) - n * (jeu + e / 2), large * (x1 - x0 - A["jour"]), e, n, "ardoise")


def bordage(m, centre, fil, travers, long, large, epais, P, D, a, mat=MAT):
    """Des planches côte à côte autour de `centre`, longues de `long` le long de `fil`, réparties sur `large` le long
    de `travers`, épaisses de `epais`, leurs arêtes adoucies de `D["ARETE"]`, d'après `P` : leur nombre `planches`,
    l'`ecart` de leur partage (`partage`), le `jour` entre deux (fraction de `large`), la part de sa longueur dont
    chacune s'arrête avant son bout du côté de `fil` (`bout`, tirée). Rend l'axe de chacune, à mi-longueur."""
    bornes = [large * (part - 1 / 2) for part in partage(a, P["planches"], P["ecart"])]
    axes = [centre + travers * ((g0 + g1) / 2) for g0, g1 in zip(bornes, bornes[1:])]
    for axe, g0, g1 in zip(axes, bornes, bornes[1:]):
        planche(m, axe - fil * (long / 2), axe + fil * (long / 2 - long * a.uniform(*P["bout"])), travers,
                fil.cross(travers), (g1 - g0) / 2 - large * P["jour"], epais / 2, epais * D["ARETE"], mat)
    return axes


def decoupee(m, contour, n, faces, arete, mat):
    """Une pièce plate de `contour` plan (points), ses deux faces aux distances `faces` de son plan le long de `n`
    unitaire, chacune réduite d'`arete` vers le milieu du contour."""
    centre = sum(contour, Vector()) / len(contour)
    petit = [centre.lerp(p, 1 - arete / (p - centre).length) for p in contour]
    s0, s1 = faces
    sens = math.copysign(arete, s1 - s0)
    coque(m, [[p + n * s for p in tranche]
              for tranche, s in ((petit, s0), (contour, s0 + sens), (contour, s1 - sens), (petit, s1))], mat)


def par_materiau(materiaux, emissif=None):
    """Les nœuds d'un décor de `materiaux` : un par matériau, à son nom, celui d'`emissif`, s'il en est un, qui luit,
    au nom `gabarit.NOEUD_EMISSIF`."""
    return {NOEUD_EMISSIF if nom == emissif else nom: (nom,) for nom in materiaux}


def par_noeuds(D, id_, noeuds, batir):
    """Le décor `id_` dont les `noeuds` {nœud : noms de ses matériaux (`D["MATERIAUX"]`)} se bâtissent ensemble par
    `batir(D, gabarit, mailles par nœud, aléa)`, chaque sommet ramené dans l'enveloppe à `D["RETRAIT"]` sous elle
    (`Gabarit.rentrer`), chaque nœud lissé sous `D["ANGLE_LISSE"][nœud]`, ses triangles dans `D["BUDGET_TRIANGLES"]`."""
    G = Gabarit(id_)
    mats = habillage.materiaux(D["MATERIAUX"][id_])
    pieces = {noeud: Maille([mats[nom] for nom in noms]) for noeud, noms in noeuds.items()}
    batir(D, G, pieces, tirage(id_))
    objets = []
    for noeud, maille in pieces.items():
        maille.v = [tuple(p) for p in G.rentrer(maille.v, D["RETRAIT"])]
        objets.append(objet(noeud, maille, (0.0, 0.0, 0.0), D["ANGLE_LISSE"][noeud]))
    triangles = sum(len(o.data.polygons) for o in objets)
    if triangles > D["BUDGET_TRIANGLES"][id_]:
        raise ValueError(f"{id_} : {triangles} triangles, budget {D['BUDGET_TRIANGLES'][id_]}")
    return {}


def elements(D, decors, construire):
    """Les éléments de la famille (`construire.py`) : un par décor de `decors`, sa clé `decor`, ses matériaux
    `D["MATERIAUX"][id]`, bâti par `construire(D, id)`."""
    for id_ in decors:
        yield {"glb": id_, "cles": [("decor", {"prop": id_})], "materiaux": D["MATERIAUX"][id_], "blasons": (),
               "construire": lambda id_=id_: construire(D, id_)}
