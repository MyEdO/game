"""Construction des décors (#4335) : chaque modèle de `decor/` reconstruit depuis le dépôt les GLB et les manifestes
publiés sous `hotes/godot/projet/modeles/`, et chaque décor publié y a son modèle (`reconstruction.py`). Chaque sommet de
chaque GLB d'un décor tient dans l'enveloppe convexe des primitives de sa recette (`decor/gabarit.py`), sol compris, à
`TOLERANCE` près : le modèle garde l'encombrement que le jeu lit dans ces primitives."""
import sys
import unittest
from pathlib import Path

import numpy as np

ICI = Path(__file__).resolve().parent
sys.path[:0] = [str(ICI / 'decor'), str(ICI)]

import gabarit  # noqa: E402
import reconstruction  # noqa: E402
from entrees import modeles  # noqa: E402
from glb import lire_accesseur, lire_glb  # noqa: E402
from rendu import matrice_du_noeud  # noqa: E402

TOLERANCE = 0.001   # m


def sommets(chemin):
    """Les sommets de chaque mesh du GLB `chemin`, dans le repère de sa scène (nœuds composés), en glTF."""
    document, binaire = lire_glb(chemin)
    sortie = []

    def parcourir(i, parent):
        noeud = document['nodes'][i]
        matrice = parent @ matrice_du_noeud(noeud)
        for p in document['meshes'][noeud['mesh']]['primitives'] if 'mesh' in noeud else []:
            positions = lire_accesseur(document, binaire, p['attributes']['POSITION'])
            sortie.append((np.c_[positions, np.ones(len(positions))] @ matrice.T)[:, :3])
        for enfant in noeud.get('children', []):
            parcourir(enfant, matrice)
    for i in document['scenes'][document.get('scene', 0)]['nodes']:
        parcourir(i, np.eye(4))
    return np.concatenate(sortie)


def hors_du_gabarit(prop, points):
    """Le nombre des `points` (glTF) hors de l'enveloppe convexe des primitives du décor `prop`, et les cinq premiers."""
    recette = np.array([gabarit.depuis_gltf(*p) for p in points])
    hors = recette[gabarit.depassement(recette, gabarit.enveloppe(gabarit.fiche(prop)['volume']['primitives'])) > TOLERANCE]
    return len(hors), [tuple(round(float(c), 4) for c in p) for p in hors[:5]]


class Reconstruction(reconstruction.DUneFamille, unittest.TestCase):
    FAMILLE = 'decor'

    def test_chaque_sommet_tient_dans_le_gabarit_de_son_decor(self):
        for modele in modeles(self.FAMILLE):
            produits, _ = self.construire(modele)
            for id_, dossier in produits.items():
                with self.subTest(id=id_):
                    self.assertEqual(hors_du_gabarit(id_.removeprefix('decor--'), sommets(dossier / f'{id_}.glb')), (0, []),
                                     f'{id_} : sommets (xM, yM, hM) hors de l\'enveloppe convexe des primitives de sa recette')


if __name__ == '__main__':
    unittest.main()
