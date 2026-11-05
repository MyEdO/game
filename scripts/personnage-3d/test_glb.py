"""Écriture d'un GLB et soudure des normales des cibles de morph aux coutures des pièces (#3380)."""
import tempfile
import unittest
from pathlib import Path

import numpy

from glb import ecrire_glb, lire_accesseur, lire_glb, souder_les_normales_des_cibles


class Soudure(unittest.TestCase):
    """Deux pièces d'une surface plane, de couture le sommet commun (0, 0, 0) : sous la cible `k`, chaque pièce donne à
    ce sommet sa propre normale déformée. La pièce A porte aussi, en (1, 0, 0), un sommet de même position que le
    sommet d'arête vive de la pièce B, de normale de base différente."""

    def setUp(self):
        self.dossier = tempfile.TemporaryDirectory()
        self.chemin = Path(self.dossier.name) / 'pieces.glb'
        haut = [0.0, 0.0, 1.0]
        self.pieces = {
            'A': dict(positions=[[0, 0, 0], [1, 0, 0], [0, 1, 0]], normales=[haut, haut, haut],
                      cible=[[0.3, 0, 0], [0, 0, 0], [0, 0, 0]], creuse=True),
            'B': dict(positions=[[0, 0, 0], [1, 0, 0], [0, -1, 0]], normales=[haut, [1.0, 0, 0], haut],
                      cible=[[-0.3, 0, 0], [0, 0.2, 0], [0, 0, 0]], creuse=False),
        }
        binaire = bytearray()
        document = {'asset': {'version': '2.0'}, 'buffers': [{'byteLength': 0}], 'bufferViews': [], 'accessors': [],
                    'meshes': []}

        def accesseur(valeurs):
            octets = numpy.asarray(valeurs, dtype='<f4').tobytes()
            document['bufferViews'].append({'buffer': 0, 'byteOffset': len(binaire), 'byteLength': len(octets)})
            binaire.extend(octets)
            document['accessors'].append({'bufferView': len(document['bufferViews']) - 1, 'componentType': 5126,
                                          'count': len(valeurs), 'type': 'VEC3'})
            return len(document['accessors']) - 1

        for nom, piece in self.pieces.items():
            if piece['creuse']:
                indices = numpy.asarray([0], dtype='<u4').tobytes()
                document['bufferViews'].append({'buffer': 0, 'byteOffset': len(binaire), 'byteLength': len(indices)})
                binaire.extend(indices)
                vue_indices = len(document['bufferViews']) - 1
                valeur = accesseur([piece['cible'][0]])
                document['accessors'].append({'componentType': 5126, 'count': 3, 'type': 'VEC3', 'sparse': {
                    'count': 1, 'indices': {'bufferView': vue_indices, 'componentType': 5125},
                    'values': {'bufferView': document['accessors'][valeur]['bufferView']}}})
                normale_cible = len(document['accessors']) - 1
            else:
                normale_cible = accesseur(piece['cible'])
            document['meshes'].append({'name': nom, 'extras': {'targetNames': ['k']}, 'primitives': [{
                'attributes': {'POSITION': accesseur(piece['positions']), 'NORMAL': accesseur(piece['normales'])},
                'targets': [{'NORMAL': normale_cible}]}]})
        ecrire_glb(self.chemin, document, binaire)

    def tearDown(self):
        self.dossier.cleanup()

    def normales_deformees(self):
        document, binaire = lire_glb(self.chemin)
        rendues = {}
        for mesh in document['meshes']:
            primitive = mesh['primitives'][0]
            n = (lire_accesseur(document, binaire, primitive['attributes']['NORMAL'])
                 + lire_accesseur(document, binaire, primitive['targets'][0]['NORMAL']))
            rendues[mesh['name']] = n / numpy.linalg.norm(n, axis=1, keepdims=True)
        return rendues

    def test_le_sommet_de_couture_recoit_la_moyenne_des_normales_deformees_des_pieces(self):
        avant = self.normales_deformees()
        self.assertGreater(numpy.abs(avant['A'][0] - avant['B'][0]).max(), 0.1)
        ecart = souder_les_normales_des_cibles(self.chemin)
        apres = self.normales_deformees()
        numpy.testing.assert_allclose(apres['A'][0], [0, 0, 1], atol=1e-6)
        numpy.testing.assert_allclose(apres['B'][0], [0, 0, 1], atol=1e-6)
        self.assertAlmostEqual(ecart, numpy.degrees(numpy.arctan(0.3)), places=4)

    def test_les_sommets_hors_couture_et_l_arete_vive_gardent_leur_normale(self):
        avant = self.normales_deformees()
        souder_les_normales_des_cibles(self.chemin)
        apres = self.normales_deformees()
        for nom, i in (('A', 1), ('A', 2), ('B', 1), ('B', 2)):
            numpy.testing.assert_allclose(apres[nom][i], avant[nom][i], atol=1e-6, err_msg=f'{nom}[{i}]')

    def test_le_glb_reecrit_se_relit_et_son_buffer_suit_le_chunk_bin(self):
        souder_les_normales_des_cibles(self.chemin)
        document, binaire = lire_glb(self.chemin)
        self.assertEqual(document['buffers'][0]['byteLength'], len(binaire))
        self.assertEqual(len(binaire) % 4, 0)


if __name__ == '__main__':
    unittest.main()
