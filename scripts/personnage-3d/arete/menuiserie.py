"""La menuiserie commune aux kits d'arêtes (#4471) : le vantail de planches d'une porte ou d'un volet (`vantail`), la
croisée d'une fenêtre (`croisee`) et ses deux volets (`volets`), bâtis dans le repère que le kit leur donne
(`geometrie.Repere`), et leurs cotes d'adaptation, en mètres ou en fractions nommées. Un kit qui les pose déclare
les matériaux `MENUISERIE`, `CROISEE` et `FER`."""
from geometrie import DEHORS, X, Repere

MENUISERIE, CROISEE, FER = "menuiserie", "croisee", "ferrure"

# Vantail de planches (`vantail`) : `planches` jointives, épaisses de `epaisseur` (m), une sur deux en retrait de
# `relief` (m) au parement ; `barres` : hauteur de l'axe de chaque barre au dos (fractions de la hauteur du vantail),
# leur `section` (hauteur, épaisseur, m), leur `marge` aux rives (m) ; `echarpe` : une écharpe au dos, d'une barre à
# l'autre ; `pentures` : sur chaque barre, au parement, leur longueur (fraction de la largeur du vantail), leur hauteur
# et leur épaisseur (m), ce dont elles dépassent du côté du gond (m) ; `poignee` : sa platine (largeur, hauteur,
# épaisseur, m), sa distance à la rive battante (m), sa hauteur (fraction de celle du vantail) et la saillie de sa
# prise (m), `None` sans poignée.
PORTE_DE_PLANCHES = {
    "planches": 5, "epaisseur": 0.045, "relief": 0.006,
    "barres": (0.16, 0.84), "section": (0.14, 0.025), "marge": 0.11, "echarpe": True,
    "pentures": (0.62, 0.05, 0.008, 0.03),
    "poignee": {"platine": (0.06, 0.14, 0.008), "rive": 0.09, "hauteur": 0.5, "saillie": 0.03},
}
VOLET = {
    "planches": 3, "epaisseur": 0.03, "relief": 0.004,
    "barres": (0.18, 0.82), "section": (0.07, 0.018), "marge": 0.03, "echarpe": False,
    "pentures": (0.7, 0.035, 0.006, 0.02),
    "poignee": None,
}
JEU_DES_VOLETS = 0.008
"""Le jeu (m) entre les deux volets clos."""

# Croisée : `dormant` : sa section vue (m) et ses bornes dans l'épaisseur (m, depuis l'axe du mur vers le dehors) ;
# `meneau` : la section vue du meneau et du croisillon (m) ; `croisillon` : sa hauteur (fraction de celle de la baie) ;
# `petits_bois` : leur section (m), le nombre de leurs traverses sous le croisillon puis au-dessus, un montant au
# milieu de chaque vantail.
CROISEE_A_PETITS_BOIS = {
    "dormant": (0.05, (0.0, 0.075)), "meneau": 0.045, "croisillon": 0.64,
    "petits_bois": {"section": 0.016, "traverses": (2, 1)},
}


def vantail(m, R, largeur, h, V):
    """Un vantail de planches d'après `V` (`PORTE_DE_PLANCHES`, `VOLET`) dans le repère `R` de son gond : large de
    `largeur` depuis lui, entre les hauteurs `h`, son parement vers la normale du repère, ses barres au dos."""
    epais, pas = V["epaisseur"], largeur / V["planches"]
    for k in range(V["planches"]):
        R.boite(m, (k * pas, (k + 1) * pas), h, (0, epais - (k % 2) * V["relief"]), MENUISERIE)
    haut_b, epais_b = V["section"]
    axes = [h[0] + (h[1] - h[0]) * part for part in V["barres"]]
    for axe in axes:
        R.boite(m, (V["marge"], largeur - V["marge"]), (axe - haut_b / 2, axe + haut_b / 2), (-epais_b, 0), MENUISERIE)
        long, haut_p, epais_p, depasse = V["pentures"]
        R.boite(m, (-depasse, largeur * long), (axe - haut_p / 2, axe + haut_p / 2), (epais, epais + epais_p), FER)
    if V["echarpe"]:
        rive = V["marge"] + haut_b / 2
        R.poutre(m, (rive, axes[0] + haut_b / 2), (largeur - rive, axes[1] - haut_b / 2), haut_b, (-epais_b * 0.9, 0),
                 MENUISERIE)
    if V["poignee"]:
        G = V["poignee"]
        large, haut_g, epais_g = G["platine"]
        a, z = largeur - G["rive"], h[0] + (h[1] - h[0]) * G["hauteur"]
        R.boite(m, (a - large / 2, a + large / 2), (z - haut_g / 2, z + haut_g / 2), (epais, epais + epais_g), FER)
        R.boite(m, (a - large / 6, a + large / 6), (z - haut_g / 3, z + haut_g / 3),
                (epais + epais_g, epais + epais_g + G["saillie"]), FER)


def croisee(m, R, baie, appui, linteau):
    """La croisée (`CROISEE_A_PETITS_BOIS`) de la baie de demi-largeur `baie`, entre les hauteurs `appui` et `linteau`,
    dans le repère `R` de l'arête : un dormant, un meneau, un croisillon et des petits bois, sans vitre."""
    F = CROISEE_A_PETITS_BOIS
    dormant, c = F["dormant"]
    meneau = F["meneau"]
    dedans = (appui + dormant, linteau - dormant)
    for a in ((-baie, -baie + dormant), (baie - dormant, baie)):
        R.boite(m, a, (appui, linteau), c, CROISEE)
    large = (-baie + dormant, baie - dormant)
    for h in ((appui, appui + dormant), (linteau - dormant, linteau)):
        R.boite(m, large, h, c, CROISEE)
    R.boite(m, (-meneau / 2, meneau / 2), dedans, c, CROISEE)
    croisillon = appui + (linteau - appui) * F["croisillon"]
    fin = (c[0] + 0.004, c[1] - 0.004)
    R.boite(m, large, (croisillon - meneau / 2, croisillon + meneau / 2), fin, CROISEE)
    B = F["petits_bois"]
    section, milieu = B["section"], (c[0] + c[1]) / 2
    for s in (-1, 1):
        a = s * (meneau / 2 + baie - dormant) / 2
        R.boite(m, (a - section / 2, a + section / 2), dedans, (milieu - section / 2, milieu + section / 2), CROISEE)
    compartiments = ((dedans[0], croisillon - meneau / 2), (croisillon + meneau / 2, dedans[1]))
    for (bas, haut), nombre in zip(compartiments, B["traverses"]):
        for k in range(1, nombre + 1):
            h = bas + (haut - bas) * k / (nombre + 1)
            R.boite(m, large, (h - section / 2, h + section / 2), (milieu - section * 0.4, milieu + section * 0.4),
                    CROISEE)


def volets(m, R, baie, h, nu, close):
    """Les deux volets (`VOLET`) de la baie de demi-largeur `baie`, entre les hauteurs `h`, sur le parement du dehors
    (à `nu` de l'axe du mur) : rabattus à plat de part et d'autre, ou `close`, fermés devant la baie."""
    for s in (-1, 1):
        if close:
            gond = Repere(R.point(s * baie, 0, nu), -s * X, DEHORS)
        else:
            gond = Repere(R.point(s * baie, 0, nu + VOLET["epaisseur"]), s * X, -DEHORS)
        vantail(m, gond, baie - JEU_DES_VOLETS / 2, h, VOLET)
