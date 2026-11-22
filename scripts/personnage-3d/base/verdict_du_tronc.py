"""Le verdict de la garde `membres` (`hotes/godot/asset/evaluateur/gardes/membres.ts`) sur des clips, rendu par la
construction (#3810) : sous chaque état du gabarit (`cuisson_gabarit.etats_du_gabarit`), aux matrices de peau que
`gabarit.mjs` donne à l'état (`cuisson_gabarit.groupes_de_peau`), la peau de l'avant-bras et de la main de chaque côté
se pose comme la peau du tronc, ses sommets au repos sous les clés de forme de l'état à leurs poids (`tronc.Jeu`,
`tronc.peau_des_zones`) ; la posture du tronc est celle de ses os (`tronc.posture_du_tronc`), et la profondeur de
chaque sommet sa profondeur exacte (`tronc.profondeurs_exactes`). Une cellule est un état et un clip dont la peau d'un
côté entre dans le tronc de plus de `SOL_TOLERANCE_M`, à son pire sommet."""
from typing import NamedTuple

import numpy

from cuisson_gabarit import groupes_de_peau
from pas_des_poids import LOT, appliquer, melanges_par_lots, par_groupes, piles_distinctes
from poids import instants
from seuils import SOL_TOLERANCE_M
from tronc import TRONC, TroncPose, jeu_de_l_etat, peau_des_zones, poids_des_os, posture_du_tronc, profondeurs_exactes

ZONES = {'r': ('avant_bras_d', 'main_d'), 'l': ('avant_bras_g', 'main_g')}
"""Par côté, les zones de la peau jugée : l'avant-bras et la main."""


class Cellule(NamedTuple):
    """Un état (nom) et un clip (nom) dont la peau entre dans le tronc : l'instant de son pire sommet, en images, son côté
    et sa profondeur exacte, en mètres."""
    etat: str
    clip: str
    image: float
    cote: str
    profondeur: float


def cellules_du_tronc(rig, peaux, actions, table, etats, plantes):
    """Les `Cellule` des `actions` de `rig` sous les `etats` de `gabarit.mjs` de la `table`, la peau de `peaux`, les
    clips de `plantes` jambes plantées (`cuisson_gabarit.clips_plantes`), comme la garde `membres` les juge : par état et
    par clip, le pire sommet des deux côtés sur tous les instants du clip, s'il est plus enfoncé que `SOL_TOLERANCE_M`.
    Le premier des `etats` est le corps neutre (`tronc.TRONC`)."""
    jeux = [jeu_de_l_etat(table, etat) for etat in etats]
    rang = {etat['nom']: i for i, etat in enumerate(etats)}
    tronc = peau_des_zones(rig, peaux, TRONC['zones'], jeux)
    membres = {cote: peau_des_zones(rig, peaux, zones, jeux) for cote, zones in ZONES.items()}
    poids = poids_des_os(tronc)
    vers_rig, monde = numpy.array(rig.matrix_world.inverted()), numpy.array(rig.matrix_world)
    images = [instants(action) for action in actions]

    def juger(groupe):
        etats_du_groupe, piles, longueurs = groupe
        pires = {}
        for pile, portes in piles_distinctes(piles):
            for debut in range(1, len(pile), LOT):
                matrices = vers_rig @ numpy.asarray(pile[debut:debut + LOT], dtype=numpy.float64) @ monde
                retours = [posture_du_tronc(poids, m).T for m in matrices]
                melanges = {cote: list(melanges_par_lots(peau.w, matrices))[0] for cote, peau in (('tronc', tronc), *membres.items())}
                for e in portes:
                    j = rang[etats_du_groupe[e]['nom']]
                    sommets = appliquer(melanges['tronc'], tronc.x[j])
                    cotes = {cote: appliquer(melanges[cote], membres[cote].x[j]) for cote in ZONES}
                    for k, retour in enumerate(retours):
                        pose = TroncPose(sommets[k][None], None, [], retour, tronc.triangles)
                        for cote, points in cotes.items():
                            profondeur = float(profondeurs_exactes(pose, points[k][None])[0].max())
                            echantillon = debut + k - 1
                            clip = int(numpy.searchsorted(numpy.cumsum(longueurs), echantillon, side='right'))
                            cle = (j, clip)
                            if profondeur > pires.get(cle, (-numpy.inf,))[0]:
                                pires[cle] = (profondeur, echantillon - sum(longueurs[:clip]), cote)
        return pires

    with groupes_de_peau(rig, actions, table, etats, plantes) as (_, groupes):
        pires = {cle: v for p in par_groupes(juger, groupes) for cle, v in p.items()}
    return [Cellule(etats[j]['nom'], actions[c].name, images[c][i], cote, profondeur)
            for (j, c), (profondeur, i, cote) in sorted(pires.items()) if profondeur > SOL_TOLERANCE_M]
