"""#3104 issuecomment-6570150971 : le réglage BLAS d'`environnement.mjs`, vu du processus fils."""
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ENVIRONNEMENT = Path(__file__).resolve().parent / 'environnement.mjs'


class ReglageBlas(unittest.TestCase):
    def test_le_fils_tourne_a_1_thread_quoi_que_pose_l_appelant(self):
        with tempfile.TemporaryDirectory() as dossier:
            sonde = Path(dossier) / 'sonde.py'
            sonde.write_text("import os\nprint(os.environ['OPENBLAS_NUM_THREADS'])\n", encoding='utf-8')
            vu = subprocess.run([shutil.which('node'), str(ENVIRONNEMENT), str(sonde)], capture_output=True, text=True,
                                env={**os.environ, 'OPENBLAS_NUM_THREADS': '8'})
        self.assertEqual(vu.returncode, 0, vu.stderr)
        self.assertEqual(vu.stdout.strip(), '1')


if __name__ == '__main__':
    unittest.main()
