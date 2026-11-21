"""Construction des escaliers (#4471) : chaque modèle d'`escalier/` se bâtit par `construire.py`, deux fois aux mêmes
octets, et reproduit ses éléments publiés sans lire hors de ses entrées (`reconstruction.DUneFamille`), sous les gardes
communes aux kits de pièces (`banc_des_kits.py`). Son GLB porte un nœud racine à mesh par pièce (`PIECES_D_ESCALIER`,
`src/noyau/monde/piecesDArete.ts`), et aucun autre, à plat, dans le repère d'une pièce d'escalier (`escalier/volee.py`) : X le long de l'axe montant, d'un bout à l'autre de la case ; Y depuis
le pied du limon, sur le dessus duquel la rampe se dresse ; Z vers le dehors, depuis le plan du bord de la case, que rien
ne passe. Deux cases voisines se raccordent
bout à bout : la section d'une pièce est la même à ses deux bouts, et ses vides (l'écart de deux balustres) sont tous
de la même largeur, celui que partagent deux cases compris."""
import json
import unittest

import numpy as np

import reconstruction
from banc_des_kits import ICI, TOLERANCE, DesKits, triangles_du_noeud
from script_node import lancer

FAMILLE = 'escalier'
PIECES = sorted(json.loads(lancer(ICI / FAMILLE / 'pieces.mjs', [], '')))
LIMON, RAMPE = 'limon', 'rampe'
PAS_DES_COUPES = 0.05   # m


def vides(triangles, hauteur, demi):
    """Les largeurs (m) des vides de la pièce de `triangles` à la `hauteur`, le long de la case de demi-longueur
    `demi` : les écarts entre les étendues en X de ses triangles que coupe le plan de cette hauteur, celui qui
    passe le bout de la case compté une fois, avec la case voisine."""
    coupes = triangles[(triangles[:, :, 1].min(axis=1) < hauteur) & (triangles[:, :, 1].max(axis=1) > hauteur)]
    if not len(coupes):
        return []
    etendues = sorted(zip(coupes[:, :, 0].min(axis=1), coupes[:, :, 0].max(axis=1)))
    pleins = [list(etendues[0])]
    for gauche, droite in etendues[1:]:
        if gauche <= pleins[-1][1] + TOLERANCE:
            pleins[-1][1] = max(pleins[-1][1], droite)
        else:
            pleins.append([gauche, droite])
    entre = [float(d[0] - g[1]) for g, d in zip(pleins, pleins[1:])]
    au_joint = float(pleins[0][0] + demi + demi - pleins[-1][1])
    return entre + ([au_joint] if au_joint > TOLERANCE else [])


class Construction(DesKits, unittest.TestCase):
    FAMILLE = FAMILLE

    def chaque_piece(self):
        for _, bati, glb in self.chaque():
            for piece, (sommets, _) in self.noeuds(glb).items():
                with self.subTest(piece=piece):
                    yield bati['D']['LONGUEUR'] / 2, glb, piece, sommets

    def test_les_noeuds_racine_sont_les_pieces_d_un_cote_de_marches(self):
        for _, _, glb in self.chaque():
            self.assertEqual(sorted(self.noeuds(glb)), PIECES)

    def test_chaque_piece_tient_dans_le_repere_d_une_piece_d_escalier(self):
        for demi, _, _, sommets in self.chaque_piece():
            bas, hauts = sommets.min(axis=0), sommets.max(axis=0)
            np.testing.assert_allclose((bas[0], hauts[0]), (-demi, demi), atol=TOLERANCE)
            self.assertGreaterEqual(bas[2], -TOLERANCE)

    def test_la_rampe_se_dresse_sur_le_limon_pose_au_pied(self):
        for _, _, glb in self.chaque():
            (limon, _), (rampe, _) = (self.noeuds(glb)[piece] for piece in (LIMON, RAMPE))
            np.testing.assert_allclose((limon[:, 1].min(), limon[:, 2].min(), rampe[:, 1].min()),
                                       (0, 0, limon[:, 1].max()), atol=TOLERANCE)

    def test_la_section_d_une_piece_est_la_meme_a_ses_deux_bouts(self):
        for demi, _, _, sommets in self.chaque_piece():
            sections = [{(round(float(y), 3), round(float(z), 3)) for x, y, z in sommets if abs(x - bout) < TOLERANCE}
                        for bout in (-demi, demi)]
            self.assertTrue(sections[0])
            self.assertEqual(*sections)

    def test_les_vides_d_une_piece_se_suivent_au_meme_pas_d_une_case_a_l_autre(self):
        for demi, glb, piece, sommets in self.chaque_piece():
            triangles = triangles_du_noeud(glb, piece)
            for hauteur in np.arange(PAS_DES_COUPES / 2, sommets[:, 1].max(), PAS_DES_COUPES):
                largeurs = vides(triangles, hauteur, demi)
                if largeurs:
                    np.testing.assert_allclose(largeurs, largeurs[0], atol=TOLERANCE, err_msg=f'{piece} à {hauteur:.3f} m')


class Reconstruction(reconstruction.DUneFamille, unittest.TestCase):
    FAMILLE = FAMILLE


if __name__ == '__main__':
    unittest.main()
