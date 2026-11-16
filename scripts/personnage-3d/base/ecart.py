"""L'écart au tronc (`tronc`) de la peau de l'avant-bras et de la main, commun aux clips dérivés à deux mains
(`deux_mains`) et aux clips du pack (`membres`) : la marge que vise le champ du tronc posé, la plus petite avancée le
long de l'avant du tronc posé (`tronc.avant`) qui sort une peau portée d'un bloc, et son enveloppe continue dans le
temps ; la tolérance qui décide, celle de la garde `membres` (`SOL_TOLERANCE_M` de `seuils`), sur la profondeur exacte de la
peau (`enfoncement`, `tronc.profondeurs_exactes`) (#4002, #3810).
"""
import math

import numpy

from seuils import IMAGES_PAR_SECONDE
from tronc import avant, profondeurs, profondeurs_exactes

ECART_DU_TRONC = {'marge': 0.005, 'echelle': 0.01}
"""En mètres : la peau de l'avant-bras et de la main (`tronc.peau_du_membre`) se tient à `marge` hors du tronc
(`tronc.TRONC`) sous chacun de ses jeux, les os déplacés comme l'hôte les joue ; le pire de ses sommets, plus près que
`marge` ou dedans, se paie par pas d'`echelle` (`deux_mains.prix_du_tronc`, #3806, #4002, #3810). La marge vise : lue
sur le champ, qui s'écarte de l'enfoncement exact de 6,5 mm au plus (`tronc.CHAMP`), elle ne décide pas ; la profondeur
exacte décide (`enfoncement`)."""
POUSSEE = {'pas': 0.01, 'borne': 0.15, 'tolerance': 1e-4}
"""La poussée hors du tronc (`poussee_requise`), en mètres le long de l'avant du tronc posé : la plus petite avancée qui
tient une peau à `ECART_DU_TRONC['marge']` dehors se cherche par pas de `pas`, puis par dichotomie à `tolerance` près ;
une peau que l'avancée n'a pas sortie à `borne`, ou qu'un pas n'enfonce pas moins, n'est pas poussée : au-delà de
`borne`, le geste n'est plus celui de sa source (#4002, #3810)."""
RACCORD = 0.5
"""En secondes, la durée sur laquelle une grandeur d'écart monte de zéro à la valeur requise d'une image et en
redescend, en cosinus surélevé (`envelopper`) : la grandeur d'une image est le plus grand des produits de chaque valeur
requise par son raccord à cette image, continue dans le temps et jamais sous la valeur requise de l'image (#3810)."""


def enfoncement(tronc, peau):
    """Le sommet le plus enfoncé de `peau` (jeux, sommets, 3) dans le `tronc.TroncPose` `tronc`, chacun sous son jeu, à
    sa profondeur exacte (`tronc.profondeurs_exactes`, `-inf` dehors) : son enfoncement en mètres, son jeu et son
    indice. Une peau plus enfoncée que `SOL_TOLERANCE_M` est dans le tronc pour la garde `membres`."""
    dedans = profondeurs_exactes(tronc, peau)
    jeu, i = numpy.unravel_index(dedans.argmax(), dedans.shape)
    return float(dedans[jeu, i]), int(jeu), int(i)


def poussee_requise(tronc, peau, jeux=slice(None)):
    """La plus petite avancée s ≥ 0, en mètres le long de l'avant du `tronc.TroncPose` `tronc` (`tronc.avant`), qui tient
    la `peau` (jeux, sommets, 3) à `ECART_DU_TRONC['marge']` dehors sous les `jeux` (indices), à `POUSSEE['tolerance']`
    près : nulle si elle y est déjà, `None` si l'avancée ne la sort pas avant `POUSSEE['borne']`."""
    direction = avant(tronc)

    def exces(s):
        return float(profondeurs(tronc, peau + s * direction)[jeux].max()) + ECART_DU_TRONC['marge']

    precedent = exces(0.0)
    if precedent <= POUSSEE['tolerance']:
        return 0.0
    bas, haut = 0.0, 0.0
    while True:
        haut = bas + POUSSEE['pas']
        if haut > POUSSEE['borne']:
            return None
        courant = exces(haut)
        if courant <= 0.0:
            break
        if courant >= precedent:
            return None
        bas, precedent = haut, courant
    while haut - bas > POUSSEE['tolerance']:
        milieu = (bas + haut) / 2
        bas, haut = (bas, milieu) if exces(milieu) <= 0.0 else (milieu, haut)
    return haut


def envelopper(requises, instants_):
    """Par image, la grandeur (images,) qui enveloppe les valeurs `requises` (images,) aux `instants_` (images,), en
    images de `IMAGES_PAR_SECONDE` : le plus grand des produits de chaque valeur requise par son raccord à l'image, en
    cosinus surélevé de 1 à son image à 0 à `RACCORD` d'elle."""
    ecarts = numpy.abs(numpy.subtract.outer(numpy.asarray(instants_, dtype=float), numpy.asarray(instants_, dtype=float)))
    raccords = 0.5 * (1 + numpy.cos(math.pi * numpy.minimum(ecarts / (RACCORD * IMAGES_PAR_SECONDE), 1.0)))
    return (raccords * numpy.asarray(requises, dtype=float)[None]).max(axis=1)
