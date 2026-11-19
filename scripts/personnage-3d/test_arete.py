"""Construction des arêtes (#4471) : chaque modèle d'`arete/` se bâtit par `construire.py`, deux fois aux mêmes octets,
et reproduit ses éléments publiés sans lire hors de ses entrées (`reconstruction.DUneFamille`). Son GLB porte un
nœud racine à mesh par pièce (`PieceDArete`, `src/noyau/monde/aretes.ts`), à l'origine de l'arête, dans son repère
(`arete/geometrie.py`) : X le long d'elle, centrée, d'un bout à l'autre de sa longueur ; Y de son pied à sa hauteur ;
Z son épaisseur, centrée pour le mur. Chaque nœud tient dans son budget de triangles et n'est fait que de coques closes
aux faces vers le dehors (`glb.coques_en_defaut`). Les données d'un modèle ne portent aucune couleur."""
import json
import re
import runpy
import tempfile
import unittest
from pathlib import Path

import numpy as np

import reconstruction
from entrees import modeles
from glb import coques_en_defaut, lire_accesseur, lire_glb
from reconstruction import construire_le_modele

ICI = Path(__file__).resolve().parent
FAMILLE = 'arete'
PIECES = {'mur', 'porte-fermee', 'porte-ouverte', 'fenetre', 'fenetre-close', 'breche'}
TOLERANCE = 0.001   # m
COULEUR = re.compile(r'#[0-9a-fA-F]{6}')


def valeurs(v):
    """Les feuilles de la valeur `v`, à toute profondeur de ses tables et de ses listes."""
    if isinstance(v, dict):
        return [f for e in v.values() for f in valeurs(e)]
    return [f for e in v for f in valeurs(e)] if isinstance(v, (list, tuple)) else [v]


class Construction(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dossier = tempfile.TemporaryDirectory()
        cls.addClassCleanup(cls.dossier.cleanup)
        cls.bati = {}
        for modele in modeles(FAMILLE):
            sorties = [Path(cls.dossier.name) / f'{modele}-{k}' for k in range(2)]
            essais = [construire_le_modele(FAMILLE, modele, sortie) for sortie in sorties]
            for vu, _ in essais:
                assert vu.returncode == 0, vu.stdout[-2000:] + vu.stderr[-2000:]
            id_ = f'{FAMILLE}--{modele}'
            cls.bati[modele] = {'dossiers': [sortie / id_ for sortie in sorties], 'id': id_,
                                'D': runpy.run_path(str(ICI / FAMILLE / modele / 'donnees.py'))}

    def chaque(self):
        for modele, bati in sorted(self.bati.items()):
            with self.subTest(modele=modele):
                yield modele, bati, bati['dossiers'][0] / f"{bati['id']}.glb"

    def noeuds(self, glb):
        """Par nœud racine du GLB, ses sommets (glTF) et le nombre de ses triangles."""
        document, binaire = lire_glb(glb)
        sortie = {}
        for i in document['scenes'][document.get('scene', 0)]['nodes']:
            noeud = document['nodes'][i]
            self.assertEqual(sorted(noeud), ['mesh', 'name'], f"{noeud.get('name')} : un mesh à l'origine, sans enfant")
            primitives = document['meshes'][noeud['mesh']]['primitives']
            positions = [lire_accesseur(document, binaire, p['attributes']['POSITION']) for p in primitives]
            triangles = sum(document['accessors'][p['indices']]['count'] for p in primitives) // 3
            sortie[noeud['name']] = (np.concatenate(positions), triangles)
        return sortie

    def test_un_modele_existe(self):
        self.assertIn('colombage', self.bati)

    def test_deux_constructions_rendent_les_memes_octets(self):
        for _, bati, _ in self.chaque():
            un, deux = bati['dossiers']
            for fichier in (f"{bati['id']}.glb", f"{bati['id']}.element.json", 'manifest.json'):
                self.assertEqual((un / fichier).read_bytes(), (deux / fichier).read_bytes(), fichier)

    def test_le_manifeste_nomme_le_kit_et_habille_chaque_surface(self):
        for modele, bati, _ in self.chaque():
            manifeste = json.loads((bati['dossiers'][0] / f"{bati['id']}.element.json").read_text(encoding='utf-8'))
            self.assertEqual((manifeste['categorie'], manifeste['cle']), (FAMILLE, {'kit': modele}))
            self.assertEqual([s['nom'] for s in manifeste['surfaces']], list(bati['D']['MATERIAUX']))
            self.assertTrue(all(s['palette'] and s['matiere'].startswith('prop--') for s in manifeste['surfaces']))

    def test_les_donnees_ne_portent_aucune_couleur(self):
        for _, bati, _ in self.chaque():
            donnees = {nom: v for nom, v in bati['D'].items() if nom.isupper()}
            self.assertEqual([v for v in valeurs(donnees) if isinstance(v, str) and COULEUR.fullmatch(v)], [])

    def test_un_noeud_racine_par_piece(self):
        for _, _, glb in self.chaque():
            self.assertEqual(set(self.noeuds(glb)), PIECES)

    def test_chaque_piece_tient_dans_le_repere_de_l_arete(self):
        for _, bati, glb in self.chaque():
            demi, haut, nu = bati['D']['LONGUEUR'] / 2, bati['D']['HAUTEUR'], bati['D']['EPAISSEUR'] / 2
            for piece, (sommets, _) in self.noeuds(glb).items():
                with self.subTest(piece=piece):
                    bas, hauts = sommets.min(axis=0), sommets.max(axis=0)
                    cadre = (bas[0], hauts[0], bas[1], hauts[1])
                    np.testing.assert_allclose(cadre, (-demi, demi, 0, haut), atol=TOLERANCE)
                    self.assertLessEqual(bas[2], -nu + TOLERANCE)
                    self.assertGreaterEqual(hauts[2], nu - TOLERANCE)
            sommets, _ = self.noeuds(glb)['mur']
            np.testing.assert_allclose((sommets[:, 2].min(), sommets[:, 2].max()), (-nu, nu), atol=TOLERANCE)

    def test_chaque_piece_tient_dans_son_budget_de_triangles(self):
        for _, bati, glb in self.chaque():
            for piece, (_, triangles) in self.noeuds(glb).items():
                with self.subTest(piece=piece):
                    self.assertLessEqual(triangles, bati['D']['BUDGET_TRIANGLES'][piece])

    def test_chaque_piece_est_faite_de_coques_closes_aux_faces_vers_le_dehors(self):
        for _, _, glb in self.chaque():
            self.assertEqual(coques_en_defaut(glb), [])


class Reconstruction(reconstruction.DUneFamille, unittest.TestCase):
    FAMILLE = 'arete'


if __name__ == '__main__':
    unittest.main()
