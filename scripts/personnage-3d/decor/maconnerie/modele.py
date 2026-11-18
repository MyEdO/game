"""La maçonnerie (#4335) : un GLB par décor de `DECORS`, bâti dans l'enveloppe convexe des primitives de sa recette
(`gabarit.py`), dont il lit les cotes (`geometrie.pave` et `geometrie.rond`) et où `Gabarit.rentrer` ramène le sommet
qui en sortirait. Chaque pièce est une coque close : une pierre taillée d'un mur rond, ses sections en onglet le long du
polygone de la recette (`claveau`), devant un blocage plein (`geometrie.cercle`) ; un bloc mouluré, ses sections
horizontales empilées (`dalle`) ; un tambour cannelé et sa cassure ; une dalle dressée, son contour d'une face à
l'autre, des ardoises en rangs, une pièce tournée, une planche, un poteau et une cheville, ceux de `geometrie`. Chaque
matériau du décor est un nœud à son nom. L'aléa est semé des codes de caractères de l'id du décor : deux constructions
rendent les mêmes octets."""
import math

from mathutils import Vector

import geometrie
from geometrie import (COTES, CYLINDRE, HAUT, MAT, POTEAU, X, Y, barre, cap, cercle, cheville, coque, decoupee, lisse,
                       octogone, partage, pave, planche, profilee, rampant, rond, tournee)
from gabarit import VERSANTS
from maille import poutre, tube

DECORS = ("puits", "fontaine", "abreuvoir", "autel", "sarcophage", "tombe", "colonne-brisee")


def dalle(m, pied, demi, hauteur, profil, mat):
    """Un bloc mouluré dressé sur `pied`, milieu de son dessous, de demi-côtés `demi` (x, y), d'après `profil`
    [(part de la hauteur, retrait, chanfrein)], ces deux-là en fractions de `hauteur`."""
    dx, dy = demi
    barre(m, [(pied + HAUT * (hauteur * t), dx - hauteur * retrait, dy - hauteur * retrait, hauteur * chanfrein)
              for t, retrait, chanfrein in profil], X, Y, mat)


def claveau(m, centre, cotes, rayon, demi, haut, bornes, K, a):
    """Une pierre taillée d'une assise de hauteur `haut` autour de `centre`, entre les abscisses `bornes`, comptées en
    côtés depuis le sommet posé sur +x, du polygone régulier de `cotes` côtés inscrit dans le cercle de `rayon` que suit
    son axe, de demi-épaisseur `demi` au milieu d'un côté, d'après `K` (`TAILLE`) : une section à chaque sommet du
    polygone qu'elle franchit, en onglet."""
    cote = 2 * rayon * math.sin(math.pi / cotes)
    joint, arete = haut * K["joint"], haut * K["arete"]
    s0, s1 = bornes[0] + joint / cote, bornes[1] - joint / cote
    debut, fin = s0 + arete / cote, s1 - arete / cote
    abscisses = [s0, debut, *range(math.floor(debut) + 1, math.ceil(fin)), fin, s1]
    recul = haut * a.uniform(*K["parement"]) / 2
    anneaux = []
    for rang, s in enumerate(abscisses):
        k = math.floor(s)
        p = (centre + cap(360 * k / cotes) * rayon).lerp(centre + cap(360 * (k + 1) / cotes) * rayon, s - k)
        u = p - centre
        onglet = u.length / (rayon * math.cos(math.pi / cotes))
        u.normalize()
        bout = arete if rang in (0, len(abscisses) - 1) else 0
        anneaux.append(octogone(p - u * (recul * onglet), u, HAUT, (demi - recul - bout) * onglet,
                                haut / 2 - joint - bout, arete - bout / 2))
    coque(m, anneaux, "pierre")


def mur_rond(m, sol, cotes, rayon, hauteur, M, K, a):
    """Un mur de pierres taillées autour de `sol`, sur le polygone de `cotes` côtés et de `rayon` de la recette, d'après
    `M` (`maconnerie`) : ses assises aux joints décalés (`claveau`), devant leur blocage plein."""
    for lit, tete, dehors, dedans, nombre, decalage in M["assises"]:
        centre = sol + HAUT * (hauteur * (lit + tete) / 2)
        demi = rayon * (dehors - dedans) / 2 * math.cos(math.pi / cotes)
        bornes = [decalage + cotes * part for part in partage(a, nombre, M["ecart"])]
        for paire in zip(bornes, bornes[1:]):
            claveau(m, centre, cotes, rayon * (dehors + dedans) / 2, demi, hauteur * (tete - lit), paire, K, a)
    lit, tete, dehors, dedans = M["blocage"]
    cercle(m, "z", tuple(sol + HAUT * (hauteur * (lit + tete) / 2)), rayon * (dehors + dedans) / 2,
           hauteur * (tete - lit), rayon * (dehors - dedans), cotes, "pierre")


def ovale(centre, du, dv, O, a):
    """Les sommets d'un ovale horizontal de demi-côtés `du` (x) et `dv` (y) autour de `centre`, d'après `O` : `cotes`
    sommets, `exposant` de sa superellipse, chaque rayon réduit d'au plus `jeu`, tiré."""
    points = []
    for j in range(O["cotes"]):
        t = 2 * math.pi * j / O["cotes"]
        x, y = (math.copysign(abs(f) ** (2 / O["exposant"]), f) for f in (math.cos(t), math.sin(t)))
        garde = a.uniform(1 - O["jeu"], 1)
        points.append(centre + X * (du * garde * x) + Y * (dv * garde * y))
    return points


def puits(D, G, pieces, a):
    """Un puits d'après `PUITS` : mur rond et margelle, bouche d'ombre, poteaux, charpente et ardoises de son toit,
    treuil à manivelle, seau pendu à sa corde."""
    P, bois, fer = D["PUITS"], pieces[MAT], pieces["fer"]
    mur = G.primitives[P["mur"]]
    centre, rayon, hauteur = rond(mur)
    sol = centre - HAUT * (hauteur / 2)
    mur_rond(pieces["pierre"], sol, mur["sides"], rayon, hauteur, P["maconnerie"], D["TAILLE"], a)
    dessous, dessus, part = P["bouche"]
    tournee(pieces["ombre"], sol + HAUT * (hauteur * dessous), sol + HAUT * (hauteur * dessus), X, Y, rayon * part,
            CYLINDRE, mur["sides"], "ombre")

    poteaux = [pave(G.primitives[rang]) for rang in P["poteaux"]]
    _, (cote, _, haut_p) = poteaux[0]
    demi = cote / 2 * P["poteau"]["cote"]
    arete = cote * D["ARETE"]
    for c, _ in poteaux:
        profilee(bois, c - HAUT * (haut_p / 2 + haut_p * P["poteau"]["ancrage"]), c + HAUT * (haut_p / 2), (demi, demi),
                 POTEAU)

    versants = [(pave(G.primitives[rang]), rampant(G.primitives[rang])) for rang in P["versants"]]
    A = P["ardoises"]
    for (c, (large, _, haut)), (_, faite, egout, _, _) in versants:
        d, pente = (egout - faite).normalized(), (egout - faite).length
        n = d.cross(X)
        n *= math.copysign(1, n.z)
        prof, dh, dl, reste = P["chevron"]
        for p, _ in poteaux:
            axe = X * (p.x - c.x) - n * (haut * prof)
            planche(bois, faite + axe, egout + axe - d * (pente * reste), X, n, cote * dl, haut * dh, arete)
        prof, de, dl, bout = P["volige"]
        lit = n * (haut * prof)
        planche(bois, faite - lit + d * (pente * bout), egout - lit - d * (pente * bout), X, n, large / 2 * dl,
                haut * de, haut * de * D["MINCE"])
        geometrie.ardoises(pieces["ardoise"], faite, d, X, n, pente, large, haut, A, a)

    (cv, (_, long, haut_v)), _ = versants[0]
    portee, dh, de = P["entrait"]
    pied_l, tete_l, dl_l, de_l = P["lien"]
    prof_f, dh_f, de_f = P["faitage"]
    axe_f = cv.z + haut_v / 2 - haut_v * prof_f
    for c, _ in poteaux:
        tete = c + HAUT * (haut_p / 2)
        planche(bois, tete - Y * (long * portee), tete + Y * (long * portee), X, HAUT, cote * de, cote * dh, arete)
        for sy in COTES:
            p0, p1 = tete - HAUT * (haut_p * pied_l), tete + Y * (sy * long * portee * tete_l)
            planche(bois, p0, p1, X, (p1 - p0).normalized().cross(X), cote * de_l, cote * dl_l, arete)
        planche(bois, tete, Vector((tete.x, tete.y, axe_f)), X, Y, cote * P["poincon"], cote * P["poincon"], arete)
    (gauche, _), (droite, _) = poteaux
    planche(bois, Vector((gauche.x, gauche.y, axe_f)), Vector((droite.x, droite.y, axe_f)), Y, HAUT, cote * de_f,
            cote * dh_f, arete)

    T = P["treuil"]
    axe, r_arbre, _ = rond(G.primitives[P["arbre"]])
    bouts = [Vector((p.x + sx * cote * T["depasse"], axe.y, axe.z)) for sx, (p, _) in zip(COTES, poteaux)]
    tournee(bois, *bouts, Y, HAUT, r_arbre, T["profil"], T["cotes"])
    seau, r_seau, h_seau = rond(G.primitives[P["seau"]])
    _, (corde, _, _) = pave(G.primitives[P["corde"]])
    nombre, creux, demi_l = T["spires"]
    spires = [(k / (2 * nombre), creux if k % 2 == 0 else 1.0) for k in range(2 * nombre + 1)]
    enroule = Vector((seau.x, axe.y, axe.z))
    tournee(pieces["corde"], enroule - X * (r_seau * demi_l), enroule + X * (r_seau * demi_l), Y, HAUT,
            r_arbre * T["tambour"] + corde, spires, T["cotes"], "corde")

    Mn = P["manivelle"]
    epais, large_b = Mn["bras"]
    longueur, r_poignee = Mn["poignee"]
    moyeu = Vector((droite.x + cote / 2 + cote * Mn["ecart"], axe.y, axe.z))
    bout = moyeu + (Y * Mn["bout"][0] + HAUT * Mn["bout"][1]) * cote
    poutre(fer, moyeu, bout, cote * large_b, cote * epais, X, "fer")
    tournee(fer, bout, bout + X * (cote * longueur), Y, HAUT, cote * r_poignee, CYLINDRE, Mn["cotes"], "fer")

    S = P["douves"]
    (_, r_pied), (_, r_tete) = S["profil"][:2]
    pied = seau - HAUT * (h_seau / 2)
    bord = pied + HAUT * h_seau
    tournee(bois, pied, bord, X, Y, r_seau, S["profil"], S["cotes"])
    hauteurs, demi_h, dedans, dehors = S["cercles"]
    for part in hauteurs:
        r = r_seau * (r_pied + (r_tete - r_pied) * part)
        cercle(fer, "z", tuple(pied + HAUT * (h_seau * part)), r * (dedans + dehors) / 2, h_seau * 2 * demi_h,
               r * (dehors - dedans), S["cotes"], "fer")
    fleche, part_fer, troncons = S["anse"]
    anse = [bord - Y * (r_seau * r_tete * math.cos(math.pi * k / troncons))
            + HAUT * (r_seau * fleche * math.sin(math.pi * k / troncons)) for k in range(troncons + 1)]
    tube(fer, anse, corde / 2 * part_fer, P["cotes_corde"], "fer")
    tube(pieces["corde"], [bord + HAUT * (r_seau * fleche), enroule], corde / 2, P["cotes_corde"], "corde")


def fontaine(D, G, pieces, a):
    """Une fontaine d'après `FONTAINE` : bassin à pans de pierres taillées, fût en balustre, vasque creuse, pinacle,
    l'eau du bassin et celle de la vasque."""
    F, m, eau = D["FONTAINE"], pieces["pierre"], pieces["eau"]
    bassin = G.primitives[F["bassin"]]
    centre, rayon, hauteur = rond(bassin)
    sol = centre - HAUT * (hauteur / 2)
    mur_rond(m, sol, bassin["sides"], rayon, hauteur, F["maconnerie"], D["TAILLE"], a)
    dessous, dessus, part = F["eau"]
    tournee(eau, sol + HAUT * (hauteur * dessous), sol + HAUT * (hauteur * dessus), X, Y, rayon * part, CYLINDRE,
            bassin["sides"], "eau")

    fut, r_fut, long_fut = rond(G.primitives[F["fut"]])
    tournee(m, sol + HAUT * (hauteur * F["pied"]), fut + HAUT * (long_fut / 2), X, Y, r_fut, F["profil"], F["pans"],
            "pierre")
    vasque, r_vasque, h_vasque = rond(G.primitives[F["vasque"]])
    bord = vasque + HAUT * (h_vasque / 2)
    fond = bord - HAUT * (h_vasque * (1 + F["descente"]))
    tournee(m, fond, bord, X, Y, r_vasque, F["coupe"], F["cotes"], "pierre")
    dessous, dessus, part = F["eau_haute"]
    tournee(eau, fond.lerp(bord, dessous), fond.lerp(bord, dessus), X, Y, r_vasque * part, CYLINDRE, F["cotes"],
            "eau")
    pinacle, r_pinacle, h_pinacle = rond(G.primitives[F["pinacle"]])
    tournee(m, fond.lerp(bord, F["pied_du_pinacle"]), pinacle + HAUT * (h_pinacle / 2), X, Y, r_pinacle, F["bouton"],
            F["pans"], "pierre")


def abreuvoir(D, G, pieces, a):
    """Un abreuvoir d'après `ABREUVOIR` : patins, fond, bords de planches, bouts, tasseaux chevillés, eau."""
    A, m = D["ABREUVOIR"], pieces[MAT]
    c, (long, large, haut) = pave(G.primitives[A["auge"]])
    patins = [pave(G.primitives[rang]) for rang in A["patins"]]
    for p, (lx, ly, lz) in patins:
        planche(m, p - Y * (ly / 2), p + Y * (ly / 2), X, HAUT, lx / 2, lz / 2, lx * D["ARETE"])
    p, (_, _, haut_patin) = patins[0]
    assise, tete = p.z + haut_patin / 2, c.z + haut / 2
    e, arete = large * A["planche"], large * A["planche"] * D["ARETE"]
    et, dt = (large * part for part in A["tasseau"])
    face, bout = large / 2 * A["parement"], long / 2 * A["parement"]
    dedans = face - et - e
    planche(m, Vector((c.x - bout, c.y, assise + e / 2)), Vector((c.x + bout, c.y, assise + e / 2)), Y, HAUT,
            dedans + e / 2, e / 2, arete)

    nombre, ecart, jour = A["bords"]
    jour *= tete - assise
    bornes = [assise + (tete - assise) * part for part in partage(a, nombre, ecart)]
    rayon, hauteurs = A["chevilles"]
    for sy in COTES:
        y = c.y + sy * (dedans + e / 2)
        for z0, z1 in zip(bornes, bornes[1:]):
            planche(m, Vector((c.x - bout, y, (z0 + z1) / 2)), Vector((c.x + bout, y, (z0 + z1) / 2)), Y, HAUT, e / 2,
                    (z1 - z0) / 2 - jour, arete)
        for x in (*(p.x for p, _ in patins), c.x):
            pied = Vector((x, c.y + sy * (face - et / 2), assise))
            planche(m, pied, pied + HAUT * (tete - assise), X, Y, dt, et / 2, et * D["ARETE"])
            for z0, z1 in zip(bornes, bornes[1:]):
                for part in hauteurs:
                    tete_c = Vector((x, c.y + sy * face, z0 + (z1 - z0) * part))
                    cheville(m, tete_c, Y * sy, large * rayon, a)
    recul = bout - e * A["bout"]
    for sx in COTES:
        milieu = Vector((c.x + sx * recul, c.y, (assise + tete) / 2))
        planche(m, milieu - Y * (dedans + e * A["prise"]), milieu + Y * (dedans + e * A["prise"]), X, HAUT, e / 2,
                (tete - assise) / 2 - jour, arete)

    dessus, de = A["eau"]
    niveau = Vector((c.x, c.y, c.z - haut / 2 + haut * (dessus - de)))
    planche(pieces["eau"], niveau - X * recul, niveau + X * recul, Y, HAUT, dedans + e * A["prise"], haut * de,
            haut * de * D["MINCE"], "eau")


def coulure(m, tete, chute, demi, epais, chanfrein, profil):
    """Une coulure de sang depuis `tete`, sur `chute` de haut, de demi-largeur `demi` (x) et de demi-épaisseur `epais`
    (y), ses arêtes abattues de `chanfrein`, d'après `profil` [(part de la chute, part de la largeur)]."""
    barre(m, [(tete - HAUT * (chute * t), demi * part, epais, chanfrein) for t, part in profil], X, Y, "sang")


def autel(D, G, pieces, a):
    """Un autel d'après `AUTEL` : massif de pierres taillées entre plinthe et corniche, table, cierges, sang."""
    A, K, m, marbre, sang = D["AUTEL"], D["TAILLE"], pieces["pierre"], pieces["marbre"], pieces["sang"]
    c, (lx, ly, lz) = pave(G.primitives[A["massif"]])
    sol = c - HAUT * (lz / 2)
    dalle(m, sol, (lx / 2, ly / 2), lz * A["plinthe"], D["PLINTHE"], "pierre")
    lit, tete, retrait, nombres, ecart = A["assises"]
    dx, dy = lx / 2 - lz * retrait, ly / 2 - lz * retrait
    haut = lz * (tete - lit) / len(nombres)
    joint = haut * K["joint"]
    for k, nombre in enumerate(nombres):
        z = sol.z + lz * lit + haut * (2 * k + 1) / 2
        bornes = [c.x + dx * (2 * part - 1) for part in partage(a, nombre, ecart)]
        for x0, x1 in zip(bornes, bornes[1:]):
            planche(m, Vector((x0 + joint, c.y, z)), Vector((x1 - joint, c.y, z)), Y, HAUT,
                    dy - haut * a.uniform(*K["parement"]), haut / 2 - joint, haut * K["arete"], "pierre")
    dalle(m, sol + HAUT * (lz * lit), (dx - lz * A["noyau"], dy - lz * A["noyau"]), lz * (tete - lit), D["PAVE"],
          "pierre")
    lit_c, corniche = A["corniche"]
    dalle(m, sol + HAUT * (lz * lit_c), (lx / 2, ly / 2), lz * (1 - lit_c), corniche, "pierre")
    t, (tx, ty, tz) = pave(G.primitives[A["table"]])
    dalle(marbre, t - HAUT * (tz / 2), (tx / 2, ty / 2), tz, A["tablette"], "marbre")

    Ci = A["cierge"]
    bas, haut_m, part = Ci["meche"]
    for rang in A["cierges"]:
        p, r, h = rond(G.primitives[rang])
        pied, garde = p - HAUT * (h / 2), h * a.uniform(*Ci["hauteur"])
        tournee(pieces["cire"], pied, pied + HAUT * garde, X, Y, r, Ci["profil"], Ci["cotes"], "cire")
        tournee(pieces["meche"], pied + HAUT * (garde * bas), pied + HAUT * (garde * haut_m), X, Y, r * part,
                CYLINDRE, Ci["cotes"], "meche")

    s, (sx, _, sz) = pave(G.primitives[A["sang"]])
    Fq, Co = A["flaque"], A["coulures"]
    dessus = t.z + tz / 2
    e = tz * Fq["epaisseur"]
    fond = Vector((s.x, t.y, dessus - e * Fq["enfonce"]))
    bord = ovale(fond, sx / 2 * Fq["demi"][0], ty / 2 * Fq["demi"][1], Fq, a)
    coque(sang, [bord, [fond.lerp(q, Fq["dessus"]) + HAUT * e for q in bord]], "sang")
    ep = tz * Co["epaisseur"]
    mince = ep * D["MINCE"]
    chant = ty / 2 - tz * min(r for _, r, _ in A["tablette"])
    Fi = A["filets"]
    for k in range(Co["nombre"]):
        part = (2 * k + 1 + a.uniform(-Co["ecart"], Co["ecart"])) / Co["nombre"] - 1
        x = s.x + sx / 2 * Co["place"] * part
        demi = sx / 2 * a.uniform(*Co["largeur"])
        rive = Vector((x, t.y - chant, dessus))
        source = Vector((s.x + (x - s.x) * a.uniform(*Fi["depart"]), t.y, dessus))
        points = []
        for j in range(Fi["meandres"] + 1):
            u = j / Fi["meandres"]
            points.append(source.lerp(rive, u) + X * (sx / 2 * Fi["sinuosite"] * a.uniform(-1, 1) * u * (1 - u)))
        chemin = lisse(points, Fi["pas"])
        barre(sang, [(p, demi * (1 + Fi["evase"] * (1 - rang / (len(chemin) - 1))), ep, mince)
                     for rang, p in enumerate(chemin)], X, HAUT, "sang")
        coulure(sang, rive, tz * a.uniform(*Co["chant"]), demi, ep, mince, A["filet"])
        larmier = Vector((x, c.y - dy, sol.z + lz * lit_c))
        coulure(sang, larmier, larmier.z - a.uniform(s.z - sz / 2, s.z + sz / 2), demi, ep, mince, A["filet"])


def sarcophage(D, G, pieces, a):
    """Un sarcophage d'après `SARCOPHAGE` : cuve à pilastres sur plinthe, bandeau, couvercle en bâtière, gisant sur
    son coussin."""
    S, m, marbre = D["SARCOPHAGE"], pieces["pierre"], pieces["marbre"]
    c, (lx, ly, lz) = pave(G.primitives[S["cuve"]])
    sol = c - HAUT * (lz / 2)
    dalle(m, sol, (lx / 2, ly / 2), lz * S["plinthe"], D["PLINTHE"], "pierre")
    lit, tete, retrait = S["corps"]
    relief = lz * retrait
    dalle(m, sol + HAUT * (lz * lit), (lx / 2 - relief, ly / 2 - relief), lz * (tete - lit), D["PAVE"], "pierre")
    lit_b, bandeau = S["bandeau"]
    dalle(m, sol + HAUT * (lz * lit_b), (lx / 2, ly / 2), lz * (1 - lit_b), bandeau, "pierre")
    angle, courant, travees = S["pilastre"]
    d = lx * angle
    for sx in COTES:
        for sy in COTES:
            pied = Vector((c.x + sx * (lx / 2 - d), c.y + sy * (ly / 2 - d), sol.z + lz * lit))
            dalle(m, pied, (d, d), lz * (tete - lit), S["fut"], "pierre")
        for k in range(1, travees):
            pied = Vector((c.x + sx * (lx / 2 - relief), c.y + ly * (k / travees - 1 / 2), sol.z + lz * lit))
            dalle(m, pied, (relief, d * courant), lz * (tete - lit), D["PAVE"], "pierre")
    k, (kx, ky, kz) = pave(G.primitives[S["couvercle"]])
    dalle(marbre, k - HAUT * (kz / 2), (kx / 2, ky / 2), kz, S["batiere"], "marbre")

    o, (ox, oy, oz) = pave(G.primitives[S["coussin"]])
    g, (gx, gy, gz) = pave(G.primitives[S["gisant"]])
    vers = Y * math.copysign(1, g.y - o.y)
    part, part_h, forme = S["coussin_forme"]
    dalle(marbre, o - HAUT * (oz / 2), (ox / 2 * part, oy / 2 * part), oz * part_h, forme, "marbre")
    rayon, recul, cotes, boule = S["tete"]
    sommet = o + HAUT * (oz / 2) + vers * (oy * recul)
    tournee(marbre, sommet - HAUT * (2 * ox * rayon), sommet, X, Y, ox * rayon, boule, cotes, "marbre")
    anneaux = []
    for t, large, haut in S["corps_du_gisant"]:
        centre = g - HAUT * (gz / 2) + vers * (gy * (t - 1 / 2))
        anneaux.append([centre + X * (gx / 2 * large * math.cos(math.pi * j / (S["arc"] - 1)))
                        + HAUT * (gz * haut * math.sin(math.pi * j / (S["arc"] - 1))) for j in range(S["arc"])])
    coque(marbre, anneaux, "marbre")


def tombe(D, G, pieces, a):
    """Une tombe d'après `TOMBE` : socle, stèle épaulée à tête cintrée et son cartouche, tertre."""
    T, m = D["TOMBE"], pieces["pierre"]
    s, (sx, sy, sz) = pave(G.primitives[T["socle"]])
    dalle(m, s - HAUT * (sz / 2), (sx / 2, sy / 2), sz, D["PLINTHE"], "pierre")
    c, (lx, ly, lz) = pave(G.primitives[T["stele"]])
    fronton = G.primitives[T["fronton"]]
    _, (_, _, haut_f) = pave(fronton)
    descend = VERSANTS[fronton["slope"]][0]
    contour = [Vector((c.x + lx / 2 * T["largeur"] * px, 0, c.z - lz / 2 + pz * (lz + haut_f * (1 - px * descend) / 2)))
               for px, pz in T["contour"]]
    t, (tx, ty, tz) = pave(G.primitives[T["tertre"]])
    devant = math.copysign(1, t.y - c.y)
    dos, arete = c.y - devant * ly / 2, ly * T["arete"]
    decoupee(m, contour, Y, (dos, dos + devant * ly * T["corps"]), arete, "pierre")
    part, fond, saillie = T["cartouche"]
    milieu = sum(contour, Vector()) / len(contour)
    decoupee(m, [milieu.lerp(p, part) for p in contour], Y, (dos + devant * ly * fond, dos + devant * ly * saillie),
             arete, "pierre")

    Te = T["tertre_forme"]
    base = t - HAUT * (tz / 2)
    anneaux = [ovale(base + HAUT * (tz * h), tx / 2 * part, ty / 2 * part, Te, a) for h, part in Te["anneaux"]]
    coque(pieces["terre"], anneaux, "terre", base + HAUT * (tz * Te["sommet"]))


def cannele(centre, rayon, C):
    """Les sommets de la section cannelée de `rayon` autour de `centre`, d'après `C` (`cannele`) : une arête puis un
    creux par cannelure."""
    n = 2 * C["cannelures"]
    return [centre + cap(360 * j / n) * (rayon * (1 if j % 2 == 0 else C["creux"])) for j in range(n)]


def tambour(m, pied, hauteur, rayons, C, mat):
    """Un tambour cannelé dressé sur `pied`, des `rayons` de son lit à sa tête, ses deux lits chanfreinés."""
    r0, r1 = rayons
    e = r0 * C["arete"]
    lits = ((0, r0 - e), (e, r0), (hauteur - e, r1), (hauteur, r1 - e))
    coque(m, [cannele(pied + HAUT * z, r, C) for z, r in lits], mat)


def cassure(m, centre, rayon, hauteur, descend, C, K, a, mat):
    """La cassure d'un tambour cannelé de `rayon` au-dessus de `centre`, haute de `hauteur` du côté opposé à `descend`,
    d'après `K` (`eclatee`) : des anneaux qui se resserrent, chaque sommet monté selon son côté, tiré."""
    anneaux = []
    for part, monte in K["anneaux"]:
        anneaux.append([p + HAUT * (hauteur * monte * a.uniform(*K["jeu"])
                                    * (K["bas"] + (1 - K["bas"]) * (1 - (p - centre).normalized().dot(descend)) / 2))
                        for p in cannele(centre, rayon * part, C)])
    coque(m, anneaux, mat, centre + HAUT * (hauteur * K["coeur"]))


def colonne(D, G, pieces, a):
    """Une colonne brisée d'après `COLONNE` : socle, base moulurée, tambours cannelés et cassure du fût, tambour
    tombé, éclat."""
    K, m, marbre = D["COLONNE"], pieces["pierre"], pieces["marbre"]
    s, (sx, sy, sz) = pave(G.primitives[K["socle"]])
    dalle(m, s - HAUT * (sz / 2), (sx / 2, sy / 2), sz, D["PLINTHE"], "pierre")
    b, r_base, h_base = rond(G.primitives[K["base"]])
    part, cotes, moulure = K["moulure"]
    tournee(marbre, b - HAUT * (h_base / 2), b + HAUT * (h_base / 2), X, Y, r_base * part, moulure, cotes, "marbre")

    f, r_fut, h_fut = rond(G.primitives[K["fut"]])
    nombre, ecart = K["tambours"]
    r_pied, r_tete = (r_fut * part for part in K["defilement"])
    bornes = partage(a, nombre, ecart)
    for t0, t1 in zip(bornes, bornes[1:]):
        tambour(marbre, f + HAUT * (h_fut * (t0 - 1 / 2)), h_fut * (t1 - t0),
                (r_pied + (r_tete - r_pied) * t0, r_pied + (r_tete - r_pied) * t1), K["cannele"], "marbre")
    brise = G.primitives[K["cassure"]]
    _, (_, _, h_cassure) = pave(brise)
    cassure(marbre, f + HAUT * (h_fut / 2), r_tete, h_cassure, Vector(VERSANTS[brise["slope"]]), K["cannele"],
            K["eclatee"], a, "marbre")

    t, r_tombe, h_tombe = rond(G.primitives[K["tambour"]])
    garde, azimut = K["tombe"]
    pied = t - HAUT * (h_tombe / 2)
    tambour(marbre, pied, h_tombe * garde, (r_tombe * K["defilement"][0],) * 2, K["cannele"], "marbre")
    cassure(marbre, pied + HAUT * (h_tombe * garde), r_tombe * K["defilement"][0], h_tombe * (1 - garde), cap(azimut),
            K["cannele"], K["eclatee"], a, "marbre")

    eclat = G.primitives[K["eclat"]]
    e, (ex, ey, ez) = pave(eclat)
    E = K["eclat_forme"]
    descend, _, _, long, _ = rampant(eclat)
    monte, demi = -descend, long / 2
    base = e - HAUT * (ez / 2)
    h_median, part, deport = E["median"]
    median = ovale(base + HAUT * (ez * h_median) + monte * (demi * deport), ex / 2 * part, ey / 2 * part, E, a)
    coque(m, [ovale(base, ex / 2, ey / 2, E, a), median], "pierre", base + HAUT * ez + monte * (demi * E["pointe"]))


BATIR = {"puits": puits, "fontaine": fontaine, "abreuvoir": abreuvoir, "autel": autel, "sarcophage": sarcophage,
         "tombe": tombe, "colonne-brisee": colonne}


def construire(D, id_):
    return geometrie.par_noeuds(D, id_, geometrie.par_materiau(D["MATERIAUX"][id_]), BATIR[id_])


def elements(D):
    return geometrie.elements(D, DECORS, construire)
