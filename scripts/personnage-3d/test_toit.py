"""Construction des toits (#4471) : chaque modèle de `toit/` se bâtit par `construire.py`, deux fois aux mêmes octets,
et reproduit ses éléments publiés sans lire hors de ses entrées (`reconstruction.DUneFamille`), sous les gardes
communes aux kits de pièces (`banc_des_kits.py`). Chaque famille de kit de toit qu'une couverture nomme (`kit`,
`src/data/materials.json`) a son modèle. Les nœuds racine de son GLB sont exactement les pièces d'une arête de toit
(`PIECES_DE_TOIT`, `src/noyau/monde/piecesDArete.ts`), un mesh chacun, dans le repère d'une pièce de toit
(`toit/faitage.py`) : X le long de l'arête, d'un bout à l'autre de la pièce (`faitage.longueur`) ; Y depuis l'arête ; Z
en travers, autant d'un côté que de l'autre, sans passer la demi-largeur de pose (`DEMI_LARGEUR_DE_POSE_M`). Elle
coiffe le toit d'école, dont chaque pan descend de l'arête d'une pente de 1, ou en monte sous la noue
(`faitage.VERSANT`) : rien d'elle ne descend sous un pan, et le bord de chacun de ses bras est posé sur le sien. Posés
comme l'hôte les pose (`posee`), l'arêtier tient de même sur la croupe d'école et la noue dans le creux d'école
(`TOITS_D_ECOLE`). Deux pièces voisines se raccordent bout à bout : la section de la pièce est la même à ses deux bouts,
que rien ne passe."""
import json
import math
import sys
import unittest

import numpy as np

import reconstruction
from banc_des_kits import ICI, TOLERANCE, DesKits, section
from script_node import lancer

FAMILLE = 'toit'
sys.path.insert(0, str(ICI / FAMILLE))
import faitage  # noqa: E402

DU_NOYAU = json.loads(lancer(ICI / FAMILLE / 'pieces.mjs', [], ''))
PIECES = sorted(DU_NOYAU['pieces'])
DEMI_LARGEUR_DE_POSE_M = DU_NOYAU['demiLargeurDePoseM']

TOITS_D_ECOLE = {faitage.ARETIER: np.minimum, faitage.NOUE: np.maximum}
"""Par pièce d'une arête montante, le toit d'école qui la porte : deux pans de pente 1, l'un montant vers +x, l'autre
vers +y, qui se coupent sur la diagonale ; la croupe en est le plus bas des deux, le creux d'une noue le plus haut."""


def posee(sommets):
    """Les `sommets` (glTF) d'une pièce posée comme l'hôte la pose (`MiseEnPage.echelle_de_faitiere`,
    `VolumeDeScene.transform_d_instance`) sur la diagonale du toit d'école : (x, y, hauteur), sa hauteur étirée à la
    demi-différence des gradients (1, 0) et (0, 1) des deux pans, puis cisaillée de leur gradient moyen."""
    le_long, travers = np.array([1.0, 1.0]) / math.sqrt(2.0), np.array([1.0, -1.0]) / math.sqrt(2.0)
    plan = sommets[:, [0]] * le_long + sommets[:, [2]] * travers
    return np.column_stack([plan, sommets[:, 1] / math.sqrt(2.0) + plan.mean(axis=1)])


class Construction(DesKits, unittest.TestCase):
    FAMILLE = FAMILLE

    def chaque_piece(self):
        for _, bati, glb in self.chaque():
            for piece, (sommets, _) in sorted(self.noeuds(glb).items()):
                with self.subTest(piece=piece):
                    yield piece, faitage.longueur(bati['D'], piece) / 2, sommets

    def test_chaque_kit_de_toit_d_une_couverture_a_son_modele(self):
        donnee = ICI.parents[1] / 'src' / 'data' / 'materials.json'
        couvertures = [m for m in json.loads(donnee.read_text(encoding='utf-8')) if m.get('couverture')]
        self.assertEqual(sorted({m['kit'] for m in couvertures if 'kit' in m} - set(self.bati)), [])

    def test_les_noeuds_racine_sont_les_pieces_d_une_arete_de_toit(self):
        self.assertEqual(sorted(faitage.PIECES), PIECES)
        for _, _, glb in self.chaque():
            self.assertEqual(sorted(self.noeuds(glb)), PIECES)

    def test_chaque_piece_tient_sa_longueur_d_un_bout_a_l_autre_autant_d_un_cote_que_de_l_autre(self):
        for _, demi, sommets in self.chaque_piece():
            bas, hauts = sommets.min(axis=0), sommets.max(axis=0)
            np.testing.assert_allclose((bas[0], hauts[0]), (-demi, demi), atol=TOLERANCE)
            self.assertAlmostEqual(bas[2], -hauts[2], delta=TOLERANCE)

    def test_aucune_piece_ne_passe_la_demi_largeur_de_pose(self):
        for _, _, sommets in self.chaque_piece():
            self.assertLessEqual(np.abs(sommets[:, 2]).max(), DEMI_LARGEUR_DE_POSE_M + TOLERANCE)

    def test_la_faitiere_et_l_aretier_passent_leur_arete(self):
        for piece, _, sommets in self.chaque_piece():
            if faitage.VERSANT[piece] < 0:
                self.assertGreater(sommets[:, 1].max(), TOLERANCE)

    def test_rien_ne_descend_sous_les_pans_et_chaque_bras_y_pose_son_bord(self):
        for piece, _, sommets in self.chaque_piece():
            self.sur_les_pans(sommets[:, 2], sommets[:, 1] - faitage.VERSANT[piece] * np.abs(sommets[:, 2]))

    def test_l_aretier_tient_sur_la_croupe_d_ecole_et_la_noue_dans_son_creux(self):
        for piece, _, sommets in self.chaque_piece():
            if piece in TOITS_D_ECOLE:
                x, y, hauteur = posee(sommets).T
                self.sur_les_pans(sommets[:, 2], hauteur - TOITS_D_ECOLE[piece](x, y))

    def sur_les_pans(self, travers, levees):
        """Aucune des `levees` au-dessus du toit n'est négative, et le bord de chaque bras, au bout du `travers`, est à
        zéro."""
        self.assertGreaterEqual(levees.min(), -TOLERANCE)
        for bras in faitage.BRAS:
            with self.subTest(bras=bras):
                self.assertAlmostEqual(levees[bras * travers > (bras * travers).max() - TOLERANCE].min(), 0, delta=TOLERANCE)

    def test_la_section_de_chaque_piece_est_la_meme_a_ses_deux_bouts(self):
        for _, demi, sommets in self.chaque_piece():
            reference = section(sommets, -demi)
            self.assertTrue(reference)
            self.assertEqual(section(sommets, demi), reference)


class Reconstruction(reconstruction.DUneFamille, unittest.TestCase):
    FAMILLE = FAMILLE


if __name__ == '__main__':
    unittest.main()
