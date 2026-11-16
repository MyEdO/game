"""Construction des décors (#4335) : chaque modèle de `decor/` reconstruit depuis le dépôt les GLB et les manifestes
publiés sous `hotes/godot/projet/modeles/`, et chaque décor publié y a son modèle (`reconstruction.py`). Chaque sommet de
chaque GLB publié d'un décor, lu dans le cache des modèles (`CACHE_DES_MODELES`, que remplit `godot:sonde` avant ce test
en CI) à l'empreinte de son manifeste publié, tient dans l'enveloppe convexe des primitives de sa recette
(`decor/gabarit.py`), sol compris, à `TOLERANCE` près : le modèle garde l'encombrement que le jeu lit dans ces
primitives. Aucun build : un modèle dont une entrée a changé se reconstruit à l'empreinte publiée
(`test_chaque_modele_reproduit_ses_elements_publies`), si bien que la garde vaut pour lui."""
import json
import sys
import unittest
from pathlib import Path

import numpy as np

ICI = Path(__file__).resolve().parent
sys.path[:0] = [str(ICI / 'decor'), str(ICI)]

import gabarit  # noqa: E402
import reconstruction  # noqa: E402
from glb import lire_accesseur, lire_glb  # noqa: E402
from production import CACHE_DES_MODELES, MODELES  # noqa: E402
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
    faces = gabarit.enveloppe(gabarit.polygones(gabarit.fiche(prop)['volume']['primitives']))
    hors = recette[gabarit.depassement(recette, faces) > TOLERANCE]
    return len(hors), [tuple(round(float(c), 4) for c in p) for p in hors[:5]]


class Reconstruction(reconstruction.DUneFamille, unittest.TestCase):
    FAMILLE = 'decor'

    def test_chaque_sommet_publie_tient_dans_le_gabarit_de_son_decor(self):
        for id_ in sorted(id_ for ids in self.publie.values() for id_ in ids):
            with self.subTest(id=id_):
                publie = json.loads((MODELES / f'{id_}.manifeste.json').read_text(encoding='utf-8'))
                glb = CACHE_DES_MODELES / f"{publie['glb']['sha256']}.glb"
                self.assertEqual(hors_du_gabarit(id_.removeprefix('decor--'), sommets(glb)), (0, []),
                                 f'{id_} : sommets (xM, yM, hM) hors de l\'enveloppe convexe des primitives de sa recette')


if __name__ == '__main__':
    unittest.main()
