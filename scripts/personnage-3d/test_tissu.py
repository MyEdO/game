"""`tissu.Base.zones_des_faces` sur deux zones planes qui partagent un bord : une face au-dessus d'une seule zone y va,
une face au-dessus du bord commun va à la première zone par nom, quel que soit l'ordre des zones de la base (#4002)."""
import sys
import unittest
from pathlib import Path

import bpy
import numpy as np

sys.path[:0] = [str(Path(__file__).resolve().parent / dossier) for dossier in ('base', 'element')]

from tissu import Base  # noqa: E402

DEMI_PLANS = {'torse': ((0, 0), (1, 0), (1, 1), (0, 1)), 'bras_haut_g': ((-1, 0), (0, 0), (0, 1), (-1, 1))}


class Zones:
    """Ce que `zones_des_faces` lit d'une base : ses zones et la surface au repos de chacune."""

    def __init__(self, ordre):
        self.zones = {nom: None for nom in ordre}

    def corps(self, zone):
        return np.array([(x, y, 0.0) for x, y in DEMI_PLANS[zone]]), np.array([(0, 1, 2), (0, 2, 3)]), np.zeros((4, 1))


def piece(centres):
    """Un objet d'une face triangulaire minuscule par centre, à 5 cm au-dessus du plan des zones."""
    sommets, faces = [], []
    for x, y in centres:
        faces.append(tuple(range(len(sommets), len(sommets) + 3)))
        sommets += [(x - 1e-3, y - 1e-3, 0.05), (x + 1e-3, y - 1e-3, 0.05), (x, y + 2e-3, 0.05)]
    me = bpy.data.meshes.new('piece')
    me.from_pydata(sommets, [], faces)
    objet = bpy.data.objects.new('piece', me)
    bpy.context.scene.collection.objects.link(objet)
    return objet


class ZonesDesFaces(unittest.TestCase):

    def test_une_face_va_a_sa_zone_et_une_face_sur_la_couture_a_la_premiere_par_nom(self):
        objet = piece([(0.5, 0.5), (-0.5, 0.5), (0.0, 0.5)])
        for ordre in (('torse', 'bras_haut_g'), ('bras_haut_g', 'torse')):
            with self.subTest(ordre=ordre):
                self.assertEqual(Base.zones_des_faces(Zones(ordre), objet), ['torse', 'bras_haut_g', 'bras_haut_g'])


if __name__ == '__main__':
    unittest.main()
