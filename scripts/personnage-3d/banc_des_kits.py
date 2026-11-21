"""Le banc commun aux kits de pièces (#4471), ceux des arêtes (`test_arete.py`) et ceux des escaliers
(`test_escalier.py`) : chaque modèle d'une famille bâti deux fois par `construire.py` (`DesKits`), la lecture des
nœuds racine de son GLB (`noeuds`) et les gardes qu'ils partagent : mêmes octets, manifeste, données sans couleur,
budget de triangles, coques closes aux faces vers le dehors (`glb.coques_en_defaut`)."""
import json
import re
import runpy
import tempfile
from pathlib import Path

import numpy as np

from entrees import modeles
from glb import coques_en_defaut, lire_accesseur, lire_glb
from reconstruction import construire_le_modele

ICI = Path(__file__).resolve().parent
TOLERANCE = 0.001   # m
SEPARATEUR = '--'
COULEUR = re.compile(r'#[0-9a-fA-F]{6}')


def valeurs(v):
    """Les feuilles de la valeur `v`, à toute profondeur de ses tables et de ses listes."""
    if isinstance(v, dict):
        return [f for e in v.values() for f in valeurs(e)]
    return [f for e in v for f in valeurs(e)] if isinstance(v, (list, tuple)) else [v]


def triangles_du_noeud(glb, piece, sauf=()):
    """Les triangles (n, 3, 3, glTF) du nœud `piece` de `glb`, ceux des matériaux `sauf` ôtés."""
    document, binaire = lire_glb(glb)
    noeud = next(n for n in document['nodes'] if n.get('name') == piece)
    return np.concatenate([
        lire_accesseur(document, binaire, p['attributes']['POSITION'])[
            lire_accesseur(document, binaire, p['indices']).astype(np.int64).reshape(-1, 3)]
        for p in document['meshes'][noeud['mesh']]['primitives']
        if document['materials'][p['material']]['name'] not in sauf])


class DesKits:
    """Les gardes communes aux kits de la famille `FAMILLE`, à mêler à `unittest.TestCase` : `bati` donne, par modèle,
    ses deux dossiers de production, son id et ses données."""

    FAMILLE = None

    @classmethod
    def setUpClass(cls):
        cls.dossier = tempfile.TemporaryDirectory()
        cls.addClassCleanup(cls.dossier.cleanup)
        cls.bati = {}
        for modele in modeles(cls.FAMILLE):
            sorties = [Path(cls.dossier.name) / f'{modele}-{k}' for k in range(2)]
            essais = [construire_le_modele(cls.FAMILLE, modele, sortie) for sortie in sorties]
            for vu, _ in essais:
                assert vu.returncode == 0, vu.stdout[-2000:] + vu.stderr[-2000:]
            id_ = f'{cls.FAMILLE}--{modele}'
            cls.bati[modele] = {'dossiers': [sortie / id_ for sortie in sorties], 'id': id_,
                                'D': runpy.run_path(str(ICI / cls.FAMILLE / modele / 'donnees.py'))}

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

    def test_deux_constructions_rendent_les_memes_octets(self):
        for _, bati, _ in self.chaque():
            un, deux = bati['dossiers']
            for fichier in (f"{bati['id']}.glb", f"{bati['id']}.element.json", 'manifest.json'):
                self.assertEqual((un / fichier).read_bytes(), (deux / fichier).read_bytes(), fichier)

    def test_le_manifeste_nomme_le_kit_et_habille_chaque_surface(self):
        for modele, bati, _ in self.chaque():
            manifeste = json.loads((bati['dossiers'][0] / f"{bati['id']}.element.json").read_text(encoding='utf-8'))
            self.assertEqual((manifeste['categorie'], manifeste['cle']), (self.FAMILLE, {'kit': modele}))
            self.assertEqual([s['nom'] for s in manifeste['surfaces']], list(bati['D']['MATERIAUX']))
            self.assertTrue(all(s['palette'] and s['matiere'].startswith('prop--') for s in manifeste['surfaces']))

    def test_les_donnees_ne_portent_aucune_couleur(self):
        for _, bati, _ in self.chaque():
            donnees = {nom: v for nom, v in bati['D'].items() if nom.isupper()}
            self.assertEqual([v for v in valeurs(donnees) if isinstance(v, str) and COULEUR.fullmatch(v)], [])

    def test_chaque_piece_tient_dans_son_budget_de_triangles(self):
        for _, bati, glb in self.chaque():
            for piece, (_, triangles) in self.noeuds(glb).items():
                with self.subTest(piece=piece):
                    self.assertLessEqual(triangles, bati['D']['BUDGET_TRIANGLES'][piece.partition(SEPARATEUR)[0]])

    def test_chaque_piece_est_faite_de_coques_closes_aux_faces_vers_le_dehors(self):
        for _, _, glb in self.chaque():
            self.assertEqual(coques_en_defaut(glb), [])
