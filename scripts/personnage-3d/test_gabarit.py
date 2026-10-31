"""La table du gabarit sur un rig synthétique."""
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent / 'base'))

from anatomie import SEGMENTS_DU_GABARIT, gabarit  # noqa: E402
from faux_rig import Bones  # noqa: E402


def squelette():
    racine = SimpleNamespace(name='root', parent=None)
    noms = ('thigh_l', 'calf_l', 'thigh_r', 'calf_r',
            'upperarm_l', 'lowerarm_l', 'upperarm_r', 'lowerarm_r', 'Head', 'foot_l', 'foot_r')
    os = Bones([racine, *(SimpleNamespace(name=nom, parent=racine) for nom in noms)])
    return SimpleNamespace(data=SimpleNamespace(bones=os))


class Gabarit(unittest.TestCase):
    def test_la_tete_porte_head_sans_suffixe(self):
        self.assertEqual(gabarit(squelette())['head'], ['Head'])

    def test_les_membres_gardent_leur_ordre_et_la_racine(self):
        table = gabarit(squelette())
        self.assertEqual(table['legs'], ['thigh_l', 'calf_l', 'thigh_r', 'calf_r'])
        self.assertEqual(table['arms'], ['upperarm_l', 'lowerarm_l', 'upperarm_r', 'lowerarm_r'])
        self.assertEqual(table['racine'], 'root')

    def test_un_os_sous_deux_cles_arrete_en_le_nommant(self):
        segments = {**SEGMENTS_DU_GABARIT, 'arms': (*SEGMENTS_DU_GABARIT['arms'], 'calf_l')}
        with patch('anatomie.SEGMENTS_DU_GABARIT', segments):
            with self.assertRaisesRegex(RuntimeError, 'calf_l.*legs.*arms'):
                gabarit(squelette())

    def test_un_os_head_avec_enfant_arrete_en_le_nommant(self):
        rig = squelette()
        rig.data.bones['foot_l'].parent = rig.data.bones['Head']
        with self.assertRaisesRegex(RuntimeError, 'Head.*foot_l'):
            gabarit(rig)

    def test_un_os_absent_arrete_en_le_nommant(self):
        for nom in ('Head', 'calf_r', 'lowerarm_l', 'foot_r'):
            with self.subTest(os=nom):
                rig = squelette()
                del rig.data.bones[nom]
                with self.assertRaisesRegex(RuntimeError, nom):
                    gabarit(rig)


if __name__ == '__main__':
    unittest.main()
