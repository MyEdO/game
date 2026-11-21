"""Construction des arêtes (#4471) : chaque modèle d'`arete/` se bâtit par `construire.py`, deux fois aux mêmes octets,
et reproduit ses éléments publiés sans lire hors de ses entrées (`reconstruction.DUneFamille`). Chaque famille `kit`
d'une apparence de `src/data/structureAppearance.json` a son modèle. Son GLB porte un nœud racine à mesh pour chaque
pièce (`PIECES_D_ARETE`, `src/noyau/monde/piecesDArete.ts`), à l'origine de l'arête, dans son repère
(`arete/geometrie.py`) : X le long d'elle, centrée, d'un bout à l'autre de sa longueur ; Y de son pied à sa hauteur ;
Z son épaisseur, centrée pour le mur ; l'échelle seule se dresse contre le plan de l'arête, du pied à la hauteur du kit,
sans tenir sa longueur ni son épaisseur. Chaque nœud tient dans son budget de triangles et n'est fait que de coques
closes aux faces vers le dehors (`banc_des_kits.py`, commun aux kits d'escalier). Une pièce pleine (`PLEINES`) ne laisse passer aucun jour à
travers son épaisseur, d'un bout à l'autre de l'arête, sa vitre ôtée (`menuiserie.VITRE`), hors le kit dont les données
se déclarent à claire-voie (`CLAIRE_VOIE`). Les données d'un modèle ne portent aucune couleur."""
import json
import sys
import unittest

import numpy as np

import reconstruction
from banc_des_kits import ICI, SEPARATEUR, TOLERANCE, DesKits, triangles_du_noeud
from script_node import lancer

FAMILLE = 'arete'
sys.path.insert(0, str(ICI / FAMILLE))
from geometrie import DROITE, GAUCHE, MILIEU  # noqa: E402
from menuiserie import VITRE  # noqa: E402
PIECES = set(json.loads(lancer(ICI / FAMILLE / 'pieces.mjs', [], '')))
POSITIONS = (GAUCHE, MILIEU, DROITE)
PLEINES = ('mur', 'fenetre-close')
ECHELLE = 'echelle'
PAS_DU_JOUR = 0.005   # m


def jours(glb, piece, demi, haut):
    """Les points (x, y) de la face du nœud `piece` de `glb`, pris tous les `PAS_DU_JOUR` entre ses deux bouts et
    de son pied à `haut`, qu'aucun de ses triangles ne couvre vus le long de son épaisseur, ceux de sa vitre
    (`VITRE`) ôtés : le jour la traverse."""
    triangles = triangles_du_noeud(glb, piece, (VITRE,))[:, :, :2]
    xs = np.arange(-demi + PAS_DU_JOUR / 10, demi, PAS_DU_JOUR)
    ys = np.arange(PAS_DU_JOUR / 2, haut, PAS_DU_JOUR)
    couvert = np.zeros((len(ys), len(xs)), bool)
    for a, b, c in triangles:
        i0, i1 = np.searchsorted(xs, [min(a[0], b[0], c[0]), max(a[0], b[0], c[0])])
        k0, k1 = np.searchsorted(ys, [min(a[1], b[1], c[1]), max(a[1], b[1], c[1])])
        x, y = np.meshgrid(xs[i0:i1], ys[k0:k1])
        s = [(v[0] - u[0]) * (y - u[1]) - (v[1] - u[1]) * (x - u[0]) for u, v in ((a, b), (b, c), (c, a))]
        couvert[k0:k1, i0:i1] |= ~(((s[0] < 0) | (s[1] < 0) | (s[2] < 0)) & ((s[0] > 0) | (s[1] > 0) | (s[2] > 0)))
    return [(round(float(xs[i]), 3), round(float(ys[k]), 3)) for k, i in zip(*np.nonzero(~couvert))]


class Construction(DesKits, unittest.TestCase):
    FAMILLE = FAMILLE

    def test_chaque_kit_d_une_apparence_a_son_modele(self):
        donnee = ICI.parents[1] / 'src' / 'data' / 'structureAppearance.json'
        apparences = json.loads(donnee.read_text(encoding='utf-8'))
        self.assertEqual(sorted({a['kit'] for a in apparences} - set(self.bati)), [])

    def test_chaque_noeud_racine_est_une_piece_ou_sa_position_dans_une_ouverture(self):
        for _, _, glb in self.chaque():
            noeuds = set(self.noeuds(glb))
            self.assertEqual(sorted(PIECES - noeuds), [])
            for nom in noeuds:
                with self.subTest(noeud=nom):
                    piece, _, position = nom.partition(SEPARATEUR)
                    self.assertIn(piece, PIECES)
                    self.assertIn(position, ('', *POSITIONS))

    def test_chaque_piece_tient_dans_le_repere_de_l_arete(self):
        for _, bati, glb in self.chaque():
            demi, haut, nu = bati['D']['LONGUEUR'] / 2, bati['D']['HAUTEUR'], bati['D']['EPAISSEUR'] / 2
            noeuds = self.noeuds(glb)
            for piece, (sommets, _) in noeuds.items():
                if piece == ECHELLE:
                    continue
                with self.subTest(piece=piece):
                    bas, hauts = sommets.min(axis=0), sommets.max(axis=0)
                    cadre = (bas[0], hauts[0], bas[1], hauts[1])
                    np.testing.assert_allclose(cadre, (-demi, demi, 0, haut), atol=TOLERANCE)
                    self.assertLessEqual(bas[2], -nu + TOLERANCE)
                    self.assertGreaterEqual(hauts[2], nu - TOLERANCE)
            sommets, _ = noeuds['mur']
            np.testing.assert_allclose((sommets[:, 2].min(), sommets[:, 2].max()), (-nu, nu), atol=TOLERANCE)

    def test_l_echelle_se_dresse_contre_le_plan_de_l_arete(self):
        """Du pied à la hauteur du kit, centrée, entre les deux bouts de l'arête, le dos sur son plan, vers le dehors :
        elle ne change pas la boîte du kit, dont l'hôte tire l'étirement de chaque pièce."""
        for _, bati, glb in self.chaque():
            demi, haut = bati['D']['LONGUEUR'] / 2, bati['D']['HAUTEUR']
            sommets, _ = self.noeuds(glb)[ECHELLE]
            bas, hauts = sommets.min(axis=0), sommets.max(axis=0)
            np.testing.assert_allclose((bas[1], hauts[1], bas[2], bas[0] + hauts[0]), (0, haut, 0, 0), atol=TOLERANCE)
            self.assertLess(hauts[0], demi)
            self.assertGreater(hauts[2], 0)

    def test_une_piece_pleine_ne_laisse_passer_aucun_jour(self):
        for _, bati, glb in self.chaque():
            if bati['D'].get('CLAIRE_VOIE'):
                continue
            couronnement = bati['D'].get('APPAREIL', {}).get('couronnement')
            haut = bati['D']['HAUTEUR'] - (couronnement['hauteur'] if couronnement else 0.0)
            for piece in (nom for nom in self.noeuds(glb) if nom.partition(SEPARATEUR)[0] in PLEINES):
                with self.subTest(piece=piece):
                    a_jour = jours(glb, piece, bati['D']['LONGUEUR'] / 2, haut)
                    self.assertEqual(a_jour[:6], [], f'{len(a_jour)} points à jour')


class Reconstruction(reconstruction.DUneFamille, unittest.TestCase):
    FAMILLE = 'arete'


if __name__ == '__main__':
    unittest.main()
