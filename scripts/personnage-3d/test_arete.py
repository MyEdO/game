"""Construction des arêtes (#4471) : chaque modèle d'`arete/` se bâtit par `construire.py`, deux fois aux mêmes octets,
et reproduit ses éléments publiés sans lire hors de ses entrées (`reconstruction.DUneFamille`). Chaque famille `kit`
d'une apparence de `src/data/structureAppearance.json` a son modèle. Son GLB porte un nœud racine à mesh pour chaque
pièce (`PieceDArete`, `src/noyau/monde/aretes.ts`), à l'origine de l'arête, dans son repère
(`arete/geometrie.py`) : X le long d'elle, centrée, d'un bout à l'autre de sa longueur ; Y de son pied à sa hauteur ;
Z son épaisseur, centrée pour le mur. Chaque nœud tient dans son budget de triangles et n'est fait que de coques closes
aux faces vers le dehors (`glb.coques_en_defaut`). Une pièce pleine (`PLEINES`) ne laisse passer aucun jour à
travers son épaisseur, d'un bout à l'autre de l'arête, sa vitre ôtée (`menuiserie.VITRE`), hors le kit dont les données
se déclarent à claire-voie (`CLAIRE_VOIE`). Les données d'un modèle ne portent aucune couleur."""
import json
import re
import runpy
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np

import reconstruction
from entrees import modeles
from glb import coques_en_defaut, lire_accesseur, lire_glb
from reconstruction import construire_le_modele
from script_node import lancer

ICI = Path(__file__).resolve().parent
FAMILLE = 'arete'
sys.path.insert(0, str(ICI / FAMILLE))
from menuiserie import VITRE  # noqa: E402
PIECES = set(json.loads(lancer(ICI / FAMILLE / 'pieces.mjs', [], '')))
TOLERANCE = 0.001   # m
SEPARATEUR, POSITIONS = '--', ('gauche', 'milieu', 'droite')
PLEINES = ('mur', 'fenetre-close')
PAS_DU_JOUR = 0.005   # m
COULEUR = re.compile(r'#[0-9a-fA-F]{6}')


def valeurs(v):
    """Les feuilles de la valeur `v`, à toute profondeur de ses tables et de ses listes."""
    if isinstance(v, dict):
        return [f for e in v.values() for f in valeurs(e)]
    return [f for e in v for f in valeurs(e)] if isinstance(v, (list, tuple)) else [v]


def jours(glb, piece, demi, haut):
    """Les points (x, y) de la face du nœud `piece` de `glb`, pris tous les `PAS_DU_JOUR` entre ses deux bouts et
    de son pied à `haut`, qu'aucun de ses triangles ne couvre vus le long de son épaisseur, ceux de sa vitre
    (`VITRE`) ôtés : le jour la traverse."""
    document, binaire = lire_glb(glb)
    noeud = next(n for n in document['nodes'] if n.get('name') == piece)
    triangles = np.concatenate([
        lire_accesseur(document, binaire, p['attributes']['POSITION'])[
            lire_accesseur(document, binaire, p['indices']).astype(np.int64).reshape(-1, 3)]
        for p in document['meshes'][noeud['mesh']]['primitives']
        if document['materials'][p['material']]['name'] != VITRE])[:, :, :2]
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

    def test_chaque_kit_d_une_apparence_a_son_modele(self):
        donnee = ICI.parents[1] / 'src' / 'data' / 'structureAppearance.json'
        apparences = json.loads(donnee.read_text(encoding='utf-8'))
        self.assertEqual(sorted({a['kit'] for a in apparences} - set(self.bati)), [])

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
                    self.assertLessEqual(triangles, bati['D']['BUDGET_TRIANGLES'][piece.partition(SEPARATEUR)[0]])

    def test_chaque_piece_est_faite_de_coques_closes_aux_faces_vers_le_dehors(self):
        for _, _, glb in self.chaque():
            self.assertEqual(coques_en_defaut(glb), [])

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
