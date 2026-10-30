"""Tenue au sol des clés de la base humanoïde (#3101, plan issuecomment-6535025119) : le sol des clips dépend des clés, et
les clés finies se mesurent sous les clips posés. Les gestes de Blender (sol, mesure, finition) se passent en callables,
que `humanoide.py` lie à la construction ; ce module n'importe pas Blender.
"""

TOURS_DE_SOL = 4
"""Tours au plus de `tenir_au_sol` : valeur d'ingénierie #3101."""


class NeutreHorsDuClip(RuntimeError):
    """Sous les clips posés, des arêtes du neutre de la peau sortent de `ETIREMENT_EN_CLIP` : aucune clé ne les change,
    seuls les poids le peuvent."""

    def __init__(self, tour, aretes):
        super().__init__(f'neutre-hors-du-clip : tour {tour} : {aretes} arête(s) du neutre hors de ETIREMENT_EN_CLIP '
                         'sous les clips posés')


def tenir_au_sol(poser_au_sol, mesurer, refinir, tours_max=TOURS_DE_SOL):
    """Au plus `tours_max` tours, chacun : `poser_au_sol()` pose les clips au sol et rend leurs matrices de peau ;
    `mesurer(matrices)` rend le masque des arêtes du neutre hors bornes et, par clé, celui de ses arêtes hors bornes. Un
    neutre hors bornes lève `NeutreHorsDuClip` ; aucune clé hors bornes rend le tour, sans `refinir` ; sinon
    `refinir(matrices)` reprend les clés et rend le nombre de sommets changés. Au-delà de `tours_max`, la construction
    s'arrête."""
    for tour in range(1, tours_max + 1):
        matrices = poser_au_sol()
        neutre, cles = mesurer(matrices)
        hors = {nom: int(masque.sum()) for nom, masque in cles.items()}
        print('SOL tour', tour, ': arêtes hors du neutre', int(neutre.sum()), '; par clé',
              ' '.join(f'{nom}:{n}' for nom, n in hors.items()), flush=True)
        if neutre.any():
            raise NeutreHorsDuClip(tour, int(neutre.sum()))
        if not any(hors.values()):
            return tour
        print('SOL tour', tour, ': sommets changés', refinir(matrices), flush=True)
    raise RuntimeError(f'sol : {", ".join(f"{nom}:{n}" for nom, n in hors.items() if n)} arête(s) hors bornes après '
                       f'{tours_max} tours de sol')
