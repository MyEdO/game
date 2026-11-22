"""Construction des toits (#4471) : chaque modèle de `toit/` se bâtit par `construire.py`, deux fois aux mêmes octets,
et reproduit ses éléments publiés sans lire hors de ses entrées (`reconstruction.DUneFamille`), sous les gardes
communes aux kits de pièces (`banc_des_kits.py`). Chaque famille de kit de toit qu'une couverture nomme (`kit`,
`src/data/materials.json`) a son modèle. Son GLB porte un nœud racine à mesh par pièce qu'il couvre (`PIECES_DE_TOIT`,
`src/noyau/monde/piecesDArete.ts`), la `faitiere` au moins, dans le repère d'une faîtière (`toit/faitage.py`) : X le long
du faîte, d'un bout à l'autre de la case ; Y depuis l'arête du faîte ; Z en travers, autant d'un côté que de l'autre.
Elle coiffe le toit d'école, dont chaque pan descend d'une pente de 1 : elle passe l'arête du faîte, rien d'elle ne
descend sous un pan, et le bord de chacun de ses bras est posé sur le sien. Deux cases voisines se raccordent bout à
bout : la section de la pièce est la même à ses deux bouts, que rien ne passe."""
import json
import sys
import unittest

import numpy as np

import reconstruction
from banc_des_kits import ICI, TOLERANCE, DesKits, section
from script_node import lancer

FAMILLE = 'toit'
sys.path.insert(0, str(ICI / FAMILLE))
from faitage import FAITIERE  # noqa: E402

PIECES = sorted(json.loads(lancer(ICI / FAMILLE / 'pieces.mjs', [], '')))


class Construction(DesKits, unittest.TestCase):
    FAMILLE = FAMILLE

    def chaque_faitiere(self):
        for _, bati, glb in self.chaque():
            sommets, _ = self.noeuds(glb)[FAITIERE]
            yield bati['D']['LONGUEUR'] / 2, sommets

    def test_chaque_kit_de_toit_d_une_couverture_a_son_modele(self):
        donnee = ICI.parents[1] / 'src' / 'data' / 'materials.json'
        couvertures = [m for m in json.loads(donnee.read_text(encoding='utf-8')) if m.get('couverture')]
        self.assertEqual(sorted({m['kit'] for m in couvertures if 'kit' in m} - set(self.bati)), [])

    def test_les_noeuds_racine_sont_des_pieces_d_une_arete_de_toit_dont_la_faitiere(self):
        for _, _, glb in self.chaque():
            noeuds = set(self.noeuds(glb))
            self.assertIn(FAITIERE, noeuds)
            self.assertEqual(sorted(noeuds - set(PIECES)), [])

    def test_la_faitiere_tient_la_case_d_un_bout_a_l_autre_et_passe_l_arete_du_faite(self):
        for demi, sommets in self.chaque_faitiere():
            bas, hauts = sommets.min(axis=0), sommets.max(axis=0)
            np.testing.assert_allclose((bas[0], hauts[0]), (-demi, demi), atol=TOLERANCE)
            self.assertAlmostEqual(bas[2], -hauts[2], delta=TOLERANCE)
            self.assertGreater(hauts[1], TOLERANCE)

    def test_rien_ne_descend_sous_les_pans_et_chaque_bras_y_pose_son_bord(self):
        for _, sommets in self.chaque_faitiere():
            levees = sommets[:, 1] + np.abs(sommets[:, 2])
            self.assertGreaterEqual(levees.min(), -TOLERANCE)
            for bras in (-1, 1):
                with self.subTest(bras=bras):
                    travers = bras * sommets[:, 2]
                    self.assertAlmostEqual(levees[travers > travers.max() - TOLERANCE].min(), 0, delta=TOLERANCE)

    def test_la_section_de_la_faitiere_est_la_meme_a_ses_deux_bouts(self):
        for demi, sommets in self.chaque_faitiere():
            reference = section(sommets, -demi)
            self.assertTrue(reference)
            self.assertEqual(section(sommets, demi), reference)


class Reconstruction(reconstruction.DUneFamille, unittest.TestCase):
    FAMILLE = FAMILLE


if __name__ == '__main__':
    unittest.main()
