"""L'escalier de bois (#4471) : le GLB `escalier--bois`, un nœud par pièce de `BATIR`, bâti d'après `donnees.py` dans
le repère d'une pièce d'escalier (`volee.py`), à plat. Chaque planche, chaque balustre et chaque fer est une coque
close ; rien n'y est tiré au sort : deux constructions rendent les mêmes octets."""
import volee
from maille import tour
from volee import REPERE as R

LIMON, BALUSTRE, MAIN_COURANTE, FER = "limon", "balustre", "main-courante", "ferrure"


def eclisses(D, m, h, c):
    """La demi-éclisse de chaque bout de la case, sur la joue à `c` du plan du bord, entre les hauteurs `h`, et ses
    deux clous."""
    E, demi = D["ECLISSE"], D["LONGUEUR"] / 2
    cote, saillie, retrait = E["clou"]
    for s in (-1, 1):
        R.boite(m, tuple(sorted((s * demi, s * (demi - E["longueur"])))), h, (c, c + E["epaisseur"]), FER)
        a = s * (demi - retrait)
        for part in (0.25, 0.75):
            axe = h[0] + (h[1] - h[0]) * part
            R.boite(m, (a - cote / 2, a + cote / 2), (axe - cote / 2, axe + cote / 2),
                    (c + E["epaisseur"], c + E["epaisseur"] + saillie), FER)


def limon(D, m, _):
    """Le limon : sa planche de chant et son chapeau, filés d'un bout à l'autre de la case, et ses demi-éclisses."""
    L, demi = D["LIMON"], D["LONGUEUR"] / 2
    haut, epais = L["hauteur"], L["epaisseur"]
    chapeau, debord, chanfrein = L["chapeau"]
    volee.profil(m, (-demi, demi), [
        (0.0, 0.0), (haut, 0.0), (haut, epais + debord - chanfrein), (haut - chanfrein, epais + debord),
        (haut - chapeau, epais + debord), (haut - chapeau, epais), (0.0, epais)], LIMON)
    eclisses(D, m, D["ECLISSE"]["limon"], epais)


def rampe(D, m, _):
    """La rampe : ses balustres d'aplomb sur le limon, à un demi-pas des bouts, sous la main courante filée d'un bout à l'autre de
    la case, et ses demi-éclisses."""
    P, demi = D["RAMPE"], D["LONGUEUR"] / 2
    C = P["main_courante"]
    pas, axe, carre = D["LONGUEUR"] / P["balustres"], P["axe"], P["carre"] / 2
    for k in range(P["balustres"]):
        a = -demi + (k + 0.5) * pas
        for h in ((D["LIMON"]["hauteur"], P["pied"]), (P["tete"], C["dessous"])):
            R.boite(m, (a - carre, a + carre), h, (axe - carre, axe + carre), BALUSTRE)
        fut = [(P["pied"] + (P["tete"] - P["pied"]) * part, rayon) for part, rayon in P["fut"]["profil"]]
        tour(m, [(fut[0][0], 0), *fut, (fut[-1][0], 0)], "z", R.point(a, 0, axe), P["fut"]["cotes"], BALUSTRE)
    bas, haut, large, f = C["dessous"], C["dessus"], C["largeur"], C["chanfrein"]
    volee.profil(m, (-demi, demi), [
        (bas, f), (bas + f, 0.0), (haut - f, 0.0), (haut, f), (haut, large - f), (haut - f, large), (bas + f, large),
        (bas, large - f)], MAIN_COURANTE)
    eclisses(D, m, D["ECLISSE"]["main_courante"], large)


BATIR = {"limon": limon, "rampe": rampe}


def elements(D):
    return volee.elements(D, BATIR)
