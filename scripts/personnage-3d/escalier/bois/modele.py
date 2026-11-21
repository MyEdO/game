"""L'escalier de bois (#4471) : le GLB `escalier--bois`, un nœud par pièce de `BATIR`, bâti d'après `donnees.py` dans
le repère d'une pièce d'escalier (`volee.py`), à plat. Chaque planche, chaque balustre et chaque fer est une coque
close ; rien n'y est tiré au sort : deux constructions rendent les mêmes octets."""
import volee
from maille import tour
from volee import REPERE as R

LIMON, BALUSTRE, MAIN_COURANTE, FER = "limon", "balustre", "main-courante", "ferrure"


def eclisses(D, m, h, c, bouts=()):
    """La demi-éclisse de chaque bout de la case que la pièce raccorde (hors de `bouts`), sur la joue à `c` du plan du
    bord, entre les hauteurs `h`, et ses deux clous."""
    E, demi = D["ECLISSE"], D["LONGUEUR"] / 2
    cote, saillie, retrait = E["clou"]
    for s in (-1, 1):
        if s in bouts:
            continue
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


def tourne(m, a, c, cote, h, fut, mat):
    """Un montant tourné d'axe (`a`, `c`), de `cote` (m) : son pied et sa tête carrés entre les hauteurs `h` (pied du
    pied, sa tête, pied de la tête, sa tête), et son `fut` tourné entre eux."""
    demi = cote / 2
    for bornes in (h[:2], h[2:]):
        R.boite(m, (a - demi, a + demi), bornes, (c - demi, c + demi), mat)
    galbe = [(h[1] + (h[2] - h[1]) * part, rayon) for part, rayon in fut["profil"]]
    tour(m, [(galbe[0][0], 0), *galbe, (galbe[-1][0], 0)], "z", R.point(a, 0, c), fut["cotes"], mat)


def rampe(bouts):
    """La rampe : ses balustres d'aplomb sur le limon, à un demi-pas des bouts, sous la main courante filée d'un bout à
    l'autre de la case, et ses demi-éclisses. À chacun des `bouts` (`volee.BOUTS`), un poteau prend la place du
    balustre du bout, de la face de celui-ci au bout de la case, et reçoit la main courante."""
    def batir(D, m, _):
        P, T, demi, socle = D["RAMPE"], D["POTEAU"], D["LONGUEUR"] / 2, D["LIMON"]["hauteur"]
        C = P["main_courante"]
        pas, axe = D["LONGUEUR"] / P["balustres"], P["axe"]
        fort = pas / 2 + P["carre"] / 2
        for k in range(P["balustres"]):
            s = {0: -1, P["balustres"] - 1: 1}.get(k)
            if s in bouts:
                a = s * (demi - fort / 2)
                tourne(m, a, fort / 2, fort, (socle, T["pied"], T["tete"], T["dessus"]), T["fut"], BALUSTRE)
                hauteur, retrait = T["pointe"]
                volee.pointe(m, (a - fort / 2, a + fort / 2), (T["dessus"], T["dessus"] + hauteur), (0.0, fort),
                             retrait, BALUSTRE)
            else:
                tourne(m, -demi + (k + 0.5) * pas, axe, P["carre"], (socle, P["pied"], P["tete"], C["dessous"]),
                       P["fut"], BALUSTRE)
        bas, haut, large, f = C["dessous"], C["dessus"], C["largeur"], C["chanfrein"]
        volee.profil(m, tuple(s * (demi - fort if s in bouts else demi) for s in (-1, 1)), [
            (bas, f), (bas + f, 0.0), (haut - f, 0.0), (haut, f), (haut, large - f), (haut - f, large),
            (bas + f, large), (bas, large - f)], MAIN_COURANTE)
        eclisses(D, m, D["ECLISSE"]["main_courante"], large, bouts)
    return batir


BATIR = {"limon": limon, **volee.a_chaque_position("rampe", rampe)}


def elements(D):
    return volee.elements(D, BATIR)
