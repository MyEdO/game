"""La porterie (#4471) : le GLB `arete--porterie`, un nœud par pièce de `BATIR`, bâti d'après `donnees.py` dans le
repère d'une arête (`geometrie.py`) par l'appareil de `maconnerie`. `mur` est la porte close, `breche` la porte
abattue, `porte-fermee` et `porte-ouverte` la poterne posée dans son mur ; chacune existe seule sur son arête et en
moitiés gauche et droite d'une ouverture de deux arêtes. `fenetre` et `fenetre-close` sont l'archère. L'aléa d'une
pièce est semé de son nom : deux constructions rendent les mêmes octets."""
import geometrie
from geometrie import DEHORS, DROITE, GAUCHE, X, Repere, biais, noeud
from maconnerie import PIERRE, Appareil
from menuiserie import FER, MENUISERIE, VOLET, vantail

MOITIES = {None: (0, (-1, 1)), GAUCHE: (1, (-1,)), DROITE: (-1, (1,))}
"""Par position, l'abscisse de la clef du porche (en demi-longueurs d'arête) et les côtés qu'en porte l'arête."""


def porte(abattue, position=None):
    """La porte de ville à la `position` de son ouverture : son porche, puis sa herse baissée devant ses vantaux
    clos, ou leurs restes si elle est `abattue`."""
    def batir(D, m, alea):
        A, H, C, B = Appareil(D, m, alea), D["HERSE"], D["VANTAUX"], D["BRECHE"]
        V = D["PORCHES"]["ouverture" if position else None]
        axe, cotes = MOITIES[position][0] * A.demi, MOITIES[position][1]
        intrados = A.porche(axe, cotes, V)
        portee, naissance, T = V["portee"], V["naissance"], C["vantail"]
        tete = H["tete"] * (naissance + V["fleche"])
        nombre = max(1, round(portee * H["barreaux"] / D["LONGUEUR"]))
        devant = (H["axe"], H["axe"] + H["section"])
        for cote in cotes:
            for k in range(nombre):
                x = axe + cote * portee * (k + 0.5) / nombre
                h = (0.0, min(tete, intrados(x) + C["prise"]))
                if abattue:
                    if alea.random() > B["tiennent"]:
                        continue
                    h = (h[1] - alea.uniform(*B["longueur"]), h[1])
                A.R.boite(m, (x - H["section"] / 2, x + H["section"] / 2), h, devant, FER)
            large = tuple(sorted((axe, axe + cote * (portee + C["ancrage"]))))
            for part in H["traverses"][1:] if abattue else H["traverses"]:
                haut_t, epais_t = H["traverse"]
                A.R.boite(m, large, (part * tete - haut_t / 2, part * tete + haut_t / 2),
                          (devant[0] - epais_t, devant[0]), FER)
            gond = A.R.point(axe + cote * (portee + C["ancrage"]), 0, -T["epaisseur"])
            repere = Repere(gond, -cote * X, DEHORS)
            if abattue:
                planches, hauteur = B["planches"]
                pas = (portee + C["ancrage"]) / T["planches"]
                for k in range(planches):
                    repere.boite(m, (k * pas, (k + 1) * pas), (0.0, naissance * alea.uniform(*hauteur)),
                                 (0, T["epaisseur"]), MENUISERIE)
                continue
            vantail(m, repere, portee + C["ancrage"], (0.0, naissance), T)
            pas = [axe + cote * portee * k / V["claveaux"] for k in range(V["claveaux"] + 1)]
            for g, d in zip(sorted(pas), sorted(pas)[1:]):
                biais(m, (g, d), (naissance, intrados(g) + C["prise"]), (naissance, intrados(d) + C["prise"]),
                      (-T["epaisseur"], 0.0), MENUISERIE)
        if abattue:
            G = B["gravats"]
            geometrie.eboulis(m, A.R, alea, G, A.demi,
                              lambda tirage: FER if tirage.random() < G["fer"] else MENUISERIE)
    return batir


def poterne(ouverte, position=None):
    """La poterne à la `position` de son ouverture : son porche, son seuil, et son vantail gondé au bout extérieur de
    l'ouverture, sa tête cintrée sous l'arc, fermé ou `ouverte` d'un quart de tour vers le dedans."""
    def batir(D, m, alea):
        A, P = Appareil(D, m, alea), D["POTERNE"]
        A.porte_cintree(MOITIES[position][0] * A.demi, MOITIES[position][1],
                        P["porches"]["ouverture" if position else None], P["seuil"], P["jeu"], P["vantail"], ouverte)
    return batir


def prisme(m, contour, h, mat):
    """Le prisme droit de `contour` [(abscisse, épaisseur vers le dehors)] entre les hauteurs `h`."""
    aire = sum(a0 * c1 - a1 * c0 for (a0, c0), (a1, c1) in zip(contour, contour[1:] + contour[:1]))
    plan, k = contour if aire > 0 else contour[::-1], len(contour)
    faces = [list(range(k)), list(range(2 * k - 1, k - 1, -1)),
             *([(i + 1) % k, i, k + i, k + (i + 1) % k] for i in range(k))]
    m.ajouter([(a, -c, z) for z in h for a, c in plan], faces, mat)


def archere(close):
    """L'archère : sa fente entre deux jambages ébrasés vers le dedans et chanfreinés vers le dehors, sur son appui et
    sous le tympan de son arc de décharge, son volet rabattu sur le parement du dehors ou `close`, fermé devant
    elle."""
    def batir(D, m, alea):
        A, F = Appareil(D, m, alea), D["ARCHERE"]
        V, pied = F["porche"], F["appui"] - F["pierre_d_appui"]
        portee, naissance, (retrait, prise) = V["portee"], V["naissance"], F["tympan"]
        (baie, creux), gorge = F["chanfrein"], F["gorge"]
        intrados = A.porche(0.0, (-1, 1), V)
        A.pan((-portee, portee), (0.0, pied))
        A.R.boite(m, (-portee, portee), (pied, F["appui"]), (-A.nu, A.nu), PIERRE)
        for cote in (-1, 1):
            fente = cote * F["fente"] / 2
            prisme(m, [(cote * portee, -A.nu), (cote * portee, A.nu), (cote * baie / 2, A.nu),
                       (fente, A.nu - creux), (fente, A.nu - creux - gorge)], (F["appui"], naissance), PIERRE)
            pas = sorted(cote * portee * k / V["claveaux"] for k in range(V["claveaux"] + 1))
            for g, d in zip(pas, pas[1:]):
                biais(m, (g, d), (naissance, intrados(g) + prise), (naissance, intrados(d) + prise),
                      (retrait - A.nu, A.nu - retrait), PIERRE)
        largeur, deborde = F["volet"]
        if close:
            gond = Repere(A.R.point(-largeur / 2, 0, A.nu + VOLET["section"][1]), X, DEHORS)
        else:
            gond = Repere(A.R.point(-largeur / 2, 0, A.nu + VOLET["epaisseur"]), -X, -DEHORS)
        vantail(m, gond, largeur, (F["appui"] - deborde, naissance + deborde), VOLET)
    return batir


BATIR = {**{noeud(piece, position): batir(etat, position)
            for piece, batir, etat in (("mur", porte, False), ("porte-fermee", poterne, False),
                                       ("porte-ouverte", poterne, True), ("breche", porte, True))
            for position in (None, GAUCHE, DROITE)},
         "fenetre": archere(False), "fenetre-close": archere(True)}


def elements(D):
    return geometrie.elements(D, D["KIT"], BATIR)
