"""Construction des escaliers (#4471) : chaque modèle d'`escalier/` se bâtit par `construire.py`, deux fois aux mêmes
octets, et reproduit ses éléments publiés sans lire hors de ses entrées (`reconstruction.DUneFamille`), sous les gardes
communes aux kits de pièces (`banc_des_kits.py`). Chaque famille de kit d'escalier qu'un terrain nomme (`kitDEscalier`,
`src/data/terrains.json`) a son modèle. Son GLB porte un nœud racine à mesh par pièce (`PIECES_D_ESCALIER`,
`src/noyau/monde/piecesDArete.ts`), un par position de la rampe au bout d'une suite (`volee.BOUTS`), et aucun autre, à
plat, dans le repère d'une pièce d'escalier (`escalier/volee.py`) : X le long de l'axe montant, d'un bout à l'autre de
la case ; Y depuis le pied du limon, sur le dessus duquel la rampe se dresse ; Z vers le dehors, depuis le plan du bord
de la case, que rien ne passe. Deux cases voisines se raccordent bout à bout : la section d'une pièce est la même à ses
deux bouts, celle d'une rampe de bout est celle de la pièce du milieu au bout qu'elle raccorde, et ses vides (l'écart
de deux balustres) sont tous de la même largeur, celui que partagent deux cases compris, hors celui que borde un
poteau."""
import json
import sys
import unittest

import numpy as np

import reconstruction
from banc_des_kits import ICI, SEPARATEUR, TOLERANCE, DesKits, triangles_du_noeud
from script_node import lancer

FAMILLE = 'escalier'
sys.path.insert(0, str(ICI / FAMILLE))
from volee import BOUTS, noeud  # noqa: E402

PIECES = sorted(json.loads(lancer(ICI / FAMILLE / 'pieces.mjs', [], '')))
LIMON, RAMPE = 'limon', 'rampe'
PAS_DES_COUPES = 0.05   # m


def pleins(triangles, hauteur):
    """Les étendues en X, fondues, des triangles que coupe le plan de la `hauteur`."""
    coupes = triangles[(triangles[:, :, 1].min(axis=1) < hauteur) & (triangles[:, :, 1].max(axis=1) > hauteur)]
    fondus = []
    for gauche, droite in sorted(zip(coupes[:, :, 0].min(axis=1), coupes[:, :, 0].max(axis=1))):
        if fondus and gauche <= fondus[-1][1] + TOLERANCE:
            fondus[-1][1] = max(fondus[-1][1], droite)
        else:
            fondus.append([gauche, droite])
    return fondus


def vides(piece, milieu, bouts, demi):
    """Les largeurs (m) des vides d'une pièce le long de la case de demi-longueur `demi`, d'après ses pleins `piece`
    (`pleins`) : les écarts entre eux, hors celui que borde le poteau de chacun de ses `bouts` (`volee.BOUTS`), puis,
    à chaque bout qu'elle raccorde, le vide qu'elle partage avec la pièce du milieu, de pleins `milieu`."""
    if not piece:
        return []
    entre = [float(d[0] - g[1]) for g, d in zip(piece, piece[1:])]
    entre = entre[-1 in bouts:len(entre) - (1 in bouts)]
    joints = []
    if milieu and -1 not in bouts:
        joints.append(float(piece[0][0] + demi + demi - milieu[-1][1]))
    if milieu and 1 not in bouts:
        joints.append(float(demi - piece[-1][1] + milieu[0][0] + demi))
    return entre + [joint for joint in joints if joint > TOLERANCE]


def section(sommets, bout):
    """La section (Y, Z au millimètre) des `sommets` à l'abscisse `bout`."""
    return {(round(float(y), 3), round(float(z), 3)) for x, y, z in sommets if abs(x - bout) < TOLERANCE}


def bouts_de(nom):
    """La pièce du nœud `nom` et les bouts de volée qu'il termine (`volee.BOUTS`)."""
    piece, _, position = nom.partition(SEPARATEUR)
    return piece, BOUTS[position or None]


class Construction(DesKits, unittest.TestCase):
    FAMILLE = FAMILLE

    def chaque_piece(self):
        for _, bati, glb in self.chaque():
            for piece, (sommets, _) in self.noeuds(glb).items():
                with self.subTest(piece=piece):
                    yield bati['D']['LONGUEUR'] / 2, glb, piece, sommets

    def test_chaque_kit_d_escalier_d_un_terrain_a_son_modele(self):
        donnee = ICI.parents[1] / 'src' / 'data' / 'terrains.json'
        terrains = json.loads(donnee.read_text(encoding='utf-8'))
        self.assertEqual(sorted({t['kitDEscalier'] for t in terrains if 'kitDEscalier' in t} - set(self.bati)), [])

    def test_les_noeuds_racine_sont_les_pieces_d_un_cote_de_marches_et_la_rampe_a_chaque_position(self):
        for _, _, glb in self.chaque():
            self.assertEqual(sorted(self.noeuds(glb)),
                             sorted({*PIECES, *(noeud(RAMPE, position) for position in BOUTS)}))

    def test_chaque_piece_tient_dans_le_repere_d_une_piece_d_escalier(self):
        for demi, _, _, sommets in self.chaque_piece():
            bas, hauts = sommets.min(axis=0), sommets.max(axis=0)
            np.testing.assert_allclose((bas[0], hauts[0]), (-demi, demi), atol=TOLERANCE)
            self.assertGreaterEqual(bas[2], -TOLERANCE)

    def test_chaque_rampe_se_dresse_sur_le_limon_pose_au_pied(self):
        for _, _, glb in self.chaque():
            noeuds = self.noeuds(glb)
            limon, _ = noeuds[LIMON]
            np.testing.assert_allclose((limon[:, 1].min(), limon[:, 2].min()), (0, 0), atol=TOLERANCE)
            for nom in (nom for nom in noeuds if bouts_de(nom)[0] == RAMPE):
                with self.subTest(noeud=nom):
                    self.assertAlmostEqual(noeuds[nom][0][:, 1].min(), limon[:, 1].max(), delta=TOLERANCE)

    def test_la_section_d_une_piece_est_la_meme_a_chaque_bout_qu_elle_raccorde(self):
        for _, bati, glb in self.chaque():
            demi, noeuds = bati['D']['LONGUEUR'] / 2, self.noeuds(glb)
            for nom, (sommets, _) in noeuds.items():
                piece, bouts = bouts_de(nom)
                reference = section(noeuds[piece][0], -demi)
                self.assertTrue(reference)
                for bout in (-1, 1):
                    with self.subTest(noeud=nom, bout=bout):
                        if bout not in bouts:
                            self.assertEqual(section(sommets, bout * demi), reference)

    def test_le_poteau_d_un_bout_est_le_meme_a_chaque_position_et_passe_la_main_courante(self):
        for _, bati, glb in self.chaque():
            demi, noeuds = bati['D']['LONGUEUR'] / 2, self.noeuds(glb)
            milieu, _ = noeuds[RAMPE]
            seule, _ = noeuds[noeud(RAMPE, 'seule')]
            for position, bouts in BOUTS.items():
                sommets, _ = noeuds[noeud(RAMPE, position)]
                for bout in bouts:
                    with self.subTest(position=position, bout=bout):
                        poteau = section(sommets, bout * demi)
                        self.assertEqual(poteau, section(seule, bout * demi))
                        self.assertEqual(poteau, section(seule, -bout * demi))
                        self.assertGreater(max(y for y, _ in poteau), milieu[:, 1].max() + TOLERANCE)
                        self.assertGreater(max(z for _, z in poteau), milieu[:, 2].max() - TOLERANCE)

    def test_les_vides_d_une_piece_se_suivent_au_meme_pas_d_une_case_a_l_autre(self):
        for _, bati, glb in self.chaque():
            demi, noeuds = bati['D']['LONGUEUR'] / 2, self.noeuds(glb)
            for nom, (sommets, _) in noeuds.items():
                piece, bouts = bouts_de(nom)
                triangles, voisine = triangles_du_noeud(glb, nom), triangles_du_noeud(glb, piece)
                for hauteur in np.arange(PAS_DES_COUPES / 2, sommets[:, 1].max(), PAS_DES_COUPES):
                    milieu = pleins(voisine, hauteur)
                    largeurs = vides(milieu, milieu, (), demi) + vides(pleins(triangles, hauteur), milieu, bouts, demi)
                    if largeurs:
                        with self.subTest(noeud=nom):
                            np.testing.assert_allclose(largeurs, largeurs[0], atol=TOLERANCE,
                                                       err_msg=f'{nom} à {hauteur:.3f} m')


class Reconstruction(reconstruction.DUneFamille, unittest.TestCase):
    FAMILLE = FAMILLE


if __name__ == '__main__':
    unittest.main()
