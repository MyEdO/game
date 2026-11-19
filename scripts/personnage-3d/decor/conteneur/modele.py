"""Les conteneurs (#4335) : un GLB par décor de `DECORS`, bâti dans l'enveloppe convexe des primitives de sa recette
(`gabarit.py`), dont il lit les cotes (`geometrie.pave` et `geometrie.rond`) et où `Gabarit.rentrer` ramène le sommet
qui en sortirait. Chaque pièce est une coque close : un tonneau, ses douves en anneaux du pied au jable, ses cercles
tournés, son fond de planches ; une planche, une section chanfreinée entre ses deux bouts ; un fer plat, la coque de
sa section le long d'un profil. L'aléa est semé des codes de caractères de l'id du décor : deux constructions rendent les mêmes
octets."""
import math

from mathutils import Vector

import geometrie
from geometrie import ANGLES, HAUT, X, Y, anneau, cap, clou, coque, partage, pave, rond
from maille import cylindre, poutre, tour, tube
from maille import boite as bloc

DECORS = ("tonneau", "tonneaux-pile", "caisse", "coffre")
NOEUDS = {
    "tonneau": {"douves": ("bois",), "cercles": ("fer",)},
    "tonneaux-pile": {"douves": ("bois",), "cercles": ("fer",)},
    "caisse": {"planches": ("bois",), "clous": ("fer",)},
    "coffre": {"coffre": ("bois",), "ferrures": ("fer", "laiton")},
}
"""Par décor, ses nœuds et les matériaux de chacun (`MATERIAUX` de `donnees.py`)."""


def futs(G):
    """Les cylindres de la recette de `G`, groupés par axe vertical, un groupe par tonneau : (primitive, centre, rayon,
    longueur) de chacun (`geometrie.rond`)."""
    groupes = {}
    for p in G.primitives:
        centre, rayon, longueur = rond(p)
        groupes.setdefault(centre[:2], []).append((p, centre, rayon, longueur))
    return list(groupes.values())


def planche(m, p0, p1, dehors, largeur, epaisseur, chanfrein, mat):
    """Une planche de `p0` à `p1`, les milieux des bouts de sa face de pose : sa face vue tournée vers `dehors`,
    unitaire et normal à son axe, à `epaisseur` de la pose, ses deux arêtes vues abattues de `chanfrein`."""
    u = dehors.cross((p1 - p0).normalized())
    section = [u * -largeur / 2, u * largeur / 2, u * largeur / 2 + dehors * (epaisseur - chanfrein),
               u * (largeur / 2 - chanfrein) + dehors * epaisseur, u * (chanfrein - largeur / 2) + dehors * epaisseur,
               u * -largeur / 2 + dehors * (epaisseur - chanfrein)]
    coque(m, [[p + s for s in section] for p in (p0, p1)], mat)


def ruban(m, profil, x0, x1, fer, mat):
    """Un fer plat de `x0` à `x1` le long de `profil`, [((y, z), (ny, nz))] : un point de la surface qu'il suit et sa
    normale unitaire ; il la dépasse de `fer` et s'y ancre d'autant. La coque de sa section, d'un point du profil à
    l'autre."""
    coque(m, [[(x, y + s * ny * fer, z + s * nz * fer) for s, x in ((1, x0), (1, x1), (-1, x1), (-1, x0))] for (y, z), (ny, nz) in profil], mat)


def tonneau(F, T, P, a):
    """Un tonneau sur les cylindres `F` d'un axe de la recette (`futs`) : ses douves, ses cercles et leurs agrafes, son
    fond dans le jable, sa bonde."""
    corps = max(F, key=lambda f: f[3])
    rayon_du_fut, pans = corps[2], corps[0]["sides"]
    axe = Vector((corps[1].x, corps[1].y, 0))
    pied, tete = min(c.z - l / 2 for _, c, _, l in F), max(c.z + l / 2 for _, c, _, l in F)
    hauteur = tete - pied

    def rayon(z):
        t = 2 * (z - pied) / hauteur - 1
        return rayon_du_fut * (T["ventre"] - (T["ventre"] - T["bout"]) * t * t)

    J = T["joint"]
    pas = 360 / pans
    joints = [(k + 0.5 + a.uniform(-J["ecart"], J["ecart"])) * pas for k in range(pans)]
    jeux = [1 + a.uniform(-T["jeu"], T["jeu"]) for _ in range(pans)]
    section = []
    for k in range(pans):
        section += [(joints[k - 1], 1 - J["creux"]), (joints[k - 1] + J["epaule"] * pas, jeux[k]), (joints[k] - J["epaule"] * pas, jeux[k])]

    def tranche(z, dedans):
        return [axe + cap(azimut) * (rayon(z) * f - dedans) + HAUT * z for azimut, f in section]

    epaisseur = T["epaisseur"] * rayon_du_fut
    fond = tete - T["jable"] * hauteur
    coque(P["douves"], [tranche(pied + hauteur * i / T["rangs"], 0.0) for i in range(T["rangs"] + 1)]
          + [tranche(tete, epaisseur), tranche(fond, epaisseur)], "bois")

    N = T["fond"]
    r = rayon(fond) - epaisseur / 2
    e1 = cap(a.uniform(0, 180))
    e2 = HAUT.cross(e1)
    bornes = partage(a, N["planches"], N["ecart"])
    for u0, u1 in zip(bornes, bornes[1:]):
        t0, t1 = math.acos(2 * u1 - 1), math.acos(2 * u0 - 1)
        rive = [(math.cos(t), math.sin(t)) for t in (t0 + (t1 - t0) * i / N["arc"] for i in range(N["arc"] + 1))]
        contour = rive + [(x, -y) for x, y in reversed(rive) if y > 1e-9]
        dessus = fond + a.uniform(*N["saillie"]) * (tete - fond)
        coque(P["douves"], [[axe + (e1 * x + e2 * y) * r + HAUT * z for x, y in contour]
                            for z in (fond - N["dessous"] * (tete - fond), dessus)], "bois")

    C = T["cercle"]
    largeur = max(l for _, _, r_, l in F if r_ > rayon_du_fut)
    ceintures = [(c.z - l / 2, c.z + l / 2) for _, c, r_, l in F if r_ > rayon_du_fut]
    ceintures += [(pied + part * hauteur - C["largeur_des_bouts"] * largeur / 2, pied + part * hauteur + C["largeur_des_bouts"] * largeur / 2)
                  for part in C["bouts"]]
    fer, ancrage = C["epaisseur"] * rayon_du_fut, C["ancrage"] * rayon_du_fut
    longueur, part, saillie = C["agrafe"]
    for z0, z1 in sorted(ceintures):
        tour(P["cercles"], [(z0, rayon(z0) - ancrage), (z0, rayon(z0) + fer), (z1, rayon(z1) + fer), (z1, rayon(z1) - ancrage)],
             "z", tuple(axe), C["segments"], "fer", ferme=True)
        azimut = a.uniform(0, 360)
        milieu = axe + cap(azimut) * (rayon((z0 + z1) / 2) + fer) + HAUT * (z0 + z1) / 2
        travers = cap(azimut + 90) * longueur * rayon_du_fut / 2
        poutre(P["cercles"], milieu - travers, milieu + travers, part * (z1 - z0), 2 * saillie * rayon_du_fut, cap(azimut), "fer")

    B = T["bonde"]
    douve = round(a.uniform(*B["azimuts"]) / pas) % pans
    vers, travers = cap(douve * pas), cap(douve * pas + 90)
    z = pied + B["hauteur"] * hauteur
    centre = axe + vers * rayon(z) * jeux[douve] + HAUT * z

    coque(P["douves"], [anneau(centre + vers * saillie * rayon_du_fut, travers, HAUT, r, B["cotes"])
                        for saillie, r in ((-B["ancrage"], B["rayon"] * rayon_du_fut), (B["saillie"], B["rayon"] * rayon_du_fut * B["cone"]))], "bois")


def tonneaux(D, G, P, a):
    """Un tonneau par axe de la recette."""
    for F in futs(G):
        tonneau(F, D["TONNEAU"], P, a)


def caisse(D, G, P, a):
    """Les quatre faces de planches debout, leurs traverses et leur écharpe ; le couvercle de planches et ses barres ;
    les clous."""
    C = D["CAISSE"]
    boites = sorted((pave(p) for p in G.primitives), key=lambda b: b[0].z)
    corps = max(boites, key=lambda b: b[1][2])
    couvercle = boites[-1]
    ceintures = [b for b in boites if b is not corps and b is not couvercle]
    demi = corps[1][0] / 2
    pied, tete = corps[0].z - corps[1][2] / 2, corps[0].z + corps[1][2] / 2
    parement, epaisseur, chanfrein = C["parement"] * demi, C["epaisseur"] * demi, C["chanfrein"] * demi
    T, E = C["traverse"], C["echarpe"]

    bloc(P["planches"], (-(parement - epaisseur), -(parement - epaisseur), pied), (parement - epaisseur, parement - epaisseur, tete), "bois")
    for rang, (dehors, travers) in enumerate(((X, Y), (Y, -X), (-X, -Y), (-Y, X))):
        bornes = [parement * (2 * u - 1) for u in partage(a, C["planches"], C["ecart"])]
        milieux = [(u0 + u1) / 2 for u0, u1 in zip(bornes, bornes[1:])]
        for (u0, u1), u in zip(zip(bornes, bornes[1:]), milieux):
            pose = dehors * (parement - epaisseur * (1 + a.uniform(0, C["retrait"]))) + travers * u
            planche(P["planches"], pose + HAUT * pied, pose + HAUT * tete, dehors, u1 - u0 - C["jour"] * demi, epaisseur, chanfrein, "bois")
        for centre, (cote, _, haut) in ceintures:
            saillie = T["parement"] * cote / 2
            portee = saillie if rang % 2 == 0 else parement
            pose = dehors * parement + HAUT * centre.z
            planche(P["planches"], pose - travers * portee, pose + travers * portee, dehors, haut, saillie - parement, T["chanfrein"] * demi, "bois")
            for u in milieux:
                clou(P["clous"], dehors * saillie + travers * u + HAUT * centre.z, dehors, D["CLOU"], demi, "fer")
        (bas, (cote, _, haut_bas)), (haut, (_, _, haut_haut)) = ceintures
        sens = 1 if rang % 2 == 0 else -1
        p0 = dehors * parement - travers * sens * E["portee"] * parement + HAUT * (bas.z + haut_bas / 2)
        p1 = dehors * parement + travers * sens * E["portee"] * parement + HAUT * (haut.z - haut_haut / 2)
        saillie = E["epaisseur"] * (T["parement"] * cote / 2 - parement)
        planche(P["planches"], p0, p1, dehors, E["largeur"] * demi, saillie, T["chanfrein"] * demi, "bois")
        for part in E["clous"]:
            clou(P["clous"], p0.lerp(p1, part) + dehors * saillie, dehors, D["CLOU"], demi, "fer")

    V = C["couvercle"]
    centre, (cote, _, haut) = couvercle
    demi_c, bas = V["demi"] * cote / 2, centre.z - haut / 2
    bornes = [demi_c * (2 * u - 1) for u in partage(a, V["planches"], C["ecart"])]
    milieux = [(u0 + u1) / 2 for u0, u1 in zip(bornes, bornes[1:])]
    for (u0, u1), u in zip(zip(bornes, bornes[1:]), milieux):
        pose = Y * u + HAUT * bas
        planche(P["planches"], pose - X * demi_c, pose + X * demi_c, HAUT, u1 - u0 - C["jour"] * demi, V["epaisseur"] * haut, chanfrein, "bois")
    place, portee, largeur, dessus = V["barres"]
    for s in (-1, 1):
        pose = X * s * place * demi_c + HAUT * (bas + V["epaisseur"] * haut)
        planche(P["planches"], pose - Y * portee * demi_c, pose + Y * portee * demi_c, HAUT, largeur * demi, (dessus - V["epaisseur"]) * haut, chanfrein, "bois")
        for u in milieux:
            clou(P["clous"], X * s * place * demi_c + Y * u + HAUT * (bas + dessus * haut), HAUT, D["CLOU"], demi, "fer")


def coffre(D, G, P, a):
    """La caisse de planches couchées sur sa plinthe ; le couvercle bombé de douves ; les pentures, leurs rivets et
    leurs charnières, les cornières ; la serrure, son entrée et son moraillon ; les poignées."""
    C = D["COFFRE"]
    boites = [pave(p) for p in G.primitives if p["kind"] == "box"]
    rampants = [pave(p) for p in G.primitives if p["kind"] == "prism"]
    corps, (long_, court, haut) = max(boites, key=lambda b: b[1][0] * b[1][1] * b[1][2])
    serrure = min(boites, key=lambda b: b[1][0] * b[1][1] * b[1][2])
    bandes = [b for b in boites if b[0].x != corps.x]
    demi = court / 2
    hx, hy = C["parement"][0] * long_ / 2, C["parement"][1] * demi
    pied = corps.z - haut / 2
    joint, jour = pied + C["joint"] * haut, C["jour_du_joint"] * haut
    egout = min(c.z - cotes[2] / 2 for c, cotes in rampants)
    faite = max(c.z + cotes[2] / 2 for c, cotes in rampants)
    epaisseur, chanfrein = C["epaisseur"] * demi, C["chanfrein"] * demi
    bois, fers = P["coffre"], P["ferrures"]

    bloc(bois, (-(hx - epaisseur), -(hy - epaisseur), pied), (hx - epaisseur, hy - epaisseur, egout), "bois")
    part, parement = C["plinthe"]
    plinthe = pied + part * haut
    px, py = parement * long_ / 2, parement * demi
    for s in (-1, 1):
        planche(bois, Vector((-px, s * hy, (pied + plinthe) / 2)), Vector((px, s * hy, (pied + plinthe) / 2)), Y * s, plinthe - pied, py - hy, chanfrein, "bois")
        planche(bois, Vector((s * hx, -hy, (pied + plinthe) / 2)), Vector((s * hx, hy, (pied + plinthe) / 2)), X * s, plinthe - pied, px - hx, chanfrein, "bois")
        for dehors, long_de, portee, pose in ((Y * s, X, hx, hy - epaisseur), (X * s, Y, hy - epaisseur, hx - epaisseur)):
            bornes = [pied + (joint - jour - pied) * u for u in partage(a, C["planches"], C["ecart"])]
            for z0, z1 in zip(bornes, bornes[1:]):
                milieu = dehors * pose + HAUT * (z0 + z1) / 2
                planche(bois, milieu - long_de * portee, milieu + long_de * portee, dehors, z1 - z0 - C["jour"] * haut, epaisseur, chanfrein, "bois")

    V = C["couvercle"]
    fleche = V["fleche"] * (faite - egout)

    def bombe(s, creux=0.0):
        """Le point du bombé à la place `s` (-1 devant, 1 derrière), enfoncé de `creux`, et sa normale, dans (y, z)."""
        pente = -2 * fleche * s / hy
        n = math.hypot(pente, 1)
        return (s * hy + creux * pente / n, egout + fleche * (1 - s * s) - creux / n), (-pente / n, 1 / n)

    pas = 2 / V["douves"]
    profil = [(-hy, joint + jour)]
    for k in range(V["douves"]):
        s = -1 + k * pas
        profil += [bombe(s, V["creux"] * demi if k else 0.0)[0], bombe(s + V["epaule"] * pas)[0], bombe(s + pas - V["epaule"] * pas)[0]]
    profil += [(hy, egout), (hy, joint + jour)]
    coque(bois, [[Vector((x, y, z)) for y, z in profil] for x in (-hx, hx)], "bois")

    F, R = C["penture"], C["rivets"]
    fer = F["fer"] * demi
    devant, derriere = ((-hy, 0.0), (-1.0, 0.0)), ((hy, 0.0), (1.0, 0.0))
    sur_le_bombe = [((-hy, joint + jour), (-1.0, 0.0)), ((-hy, egout), (-1.0, 0.0))]
    sur_le_bombe += [bombe(-1 + 2 * i / F["points"]) for i in range(1, F["points"])]
    sur_le_bombe += [((hy, egout), (1.0, 0.0)), ((hy, joint + jour), (1.0, 0.0))]
    rayon_charniere, cotes = C["charniere"]
    for centre, (largeur, _, _) in bandes:
        x0, x1 = centre.x - F["largeur"] * largeur / 2, centre.x + F["largeur"] * largeur / 2
        ruban(fers, sur_le_bombe, x0, x1, fer, "fer")
        for s in R["bombe"]:
            (y, z), (ny, nz) = bombe(s)
            clou(fers, Vector((centre.x, y + ny * fer, z + nz * fer)), Vector((0, ny, nz)), D["CLOU"], demi, "fer")
        for ((y, _), (ny, _)) in (devant, derriere):
            ruban(fers, [((y, plinthe), (ny, 0.0)), ((y, joint - jour), (ny, 0.0))], x0, x1, fer, "fer")
            for part in R["bande"]:
                clou(fers, Vector((centre.x, y + ny * fer, plinthe + part * (joint - jour - plinthe))), Y * ny, D["CLOU"], demi, "fer")
        cylindre(fers, x0 - fer, x1 + fer, rayon_charniere * demi, "x", (0, hy + fer, joint), cotes, "fer")

    aile = C["corniere"] * demi
    for sx, sy in ANGLES:
        for (xa, xb), (ya, yb), dehors, milieu in ((((hx - aile), hx + fer), (hy, hy + fer), Y * sy, Vector((sx * (hx - aile / 2), sy * (hy + fer), 0))),
                                                    ((hx, hx + fer), ((hy - aile), hy + fer), X * sx, Vector((sx * (hx + fer), sy * (hy - aile / 2), 0)))):
            bloc(fers, (min(sx * xa, sx * xb), min(sy * ya, sy * yb), plinthe), (max(sx * xa, sx * xb), max(sy * ya, sy * yb), joint - jour), "fer")
            for part in R["bande"]:
                clou(fers, milieu + HAUT * (plinthe + part * (joint - jour - plinthe)), dehors, D["CLOU"], demi, "fer")

    S = C["serrure"]
    centre, (largeur, _, hauteur) = serrure
    largeur *= S["largeur"]
    bas, dessus = centre.z - hauteur / 2, min(centre.z + hauteur / 2, joint - jour)
    platine = S["epaisseur"] * demi
    planche(fers, Vector((centre.x, -hy, bas)), Vector((centre.x, -hy, dessus)), -Y, largeur, platine, S["chanfrein"] * demi, "laiton")
    part, r, saillie, cotes, fente = S["entree"]
    z = bas + part * (dessus - bas)
    cylindre(fers, -saillie * demi, saillie * demi, r * largeur, "y", (centre.x, -(hy + platine), z), cotes, "fer")
    bloc(fers, (centre.x - r * largeur / 2, -(hy + platine + saillie * demi), z - fente * r * largeur), (centre.x + r * largeur / 2, -(hy + platine - saillie * demi), z), "fer")
    part_l, pied_m, tete_m, epais = S["moraillon"]
    bloc(fers, (centre.x - part_l * largeur / 2, -(hy + platine + epais * demi), bas + pied_m * (dessus - bas)),
         (centre.x + part_l * largeur / 2, -(hy - epais * demi), joint + jour + tete_m * (egout - joint - jour)), "fer")

    H = C["poignee"]
    z, ecart, chute, r = pied + H["hauteur"] * (joint - pied), H["ecartement"] * demi, H["chute"] * demi, H["rayon"] * demi
    coude, patte = H["coude"], H["patte"] * r
    for s in (-1, 1):
        x = s * (hx + r + H["jeu"] * demi)
        tube(fers, [(x, -ecart, z), (x, -ecart, z - coude * chute), (x, -coude * ecart, z - chute), (x, coude * ecart, z - chute),
                    (x, ecart, z - coude * chute), (x, ecart, z)], r, H["cotes"], "fer")
        for y in (-ecart, ecart):
            bloc(fers, (min(s * hx, x + s * r), y - patte, z - patte), (max(s * hx, x + s * r), y + patte, z + patte), "fer")


BATIR = {"tonneau": tonneaux, "tonneaux-pile": tonneaux, "caisse": caisse, "coffre": coffre}


def construire(D, id_):
    return geometrie.par_noeuds(D, id_, NOEUDS[id_], BATIR[id_])


def elements(D):
    return geometrie.elements(D, DECORS, construire)
