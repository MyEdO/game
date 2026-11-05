"""#3104 issuecomment-6549354475."""

import json


class ToursSansTour(ValueError):
    """`atteindre_le_point_fixe` reçoit moins d'un tour."""

    def __init__(self, tours_max):
        super().__init__(f'tours-sans-tour : tours_max {tours_max}, au moins 1')


def suite_de_phase(phase, retouches, ecart_cles, tolerance):
    if phase == 'neutre':
        return 'silhouettes', False, False
    if retouches:
        return 'silhouettes', True, False
    if phase == 'silhouettes':
        return 'gabarit', False, False
    if phase != 'gabarit':
        raise ValueError(f'phase inconnue : {phase}')
    return 'gabarit', False, ecart_cles <= tolerance


def atteindre_le_point_fixe(construire_tour, passes_max, refuser):
    """#3104 issuecomment-6549354475. Sans point fixe après `passes_max` passes, `refuser(passe, reste)` puis le refus
    `point fixe absent`."""
    if passes_max < 1:
        raise ToursSansTour(passes_max)
    for passe in range(1, passes_max + 1):
        reste = construire_tour(passe)
        print('CONSTRUCTION passe', passe, json.dumps(reste), flush=True)
        if not any(reste.values()):
            return passe
    refuser(passe, reste)
    raise RuntimeError(f'construction : point fixe absent après {passes_max} passes : {reste}')
