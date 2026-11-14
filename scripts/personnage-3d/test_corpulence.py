"""corpulence.combler sur une plaque à sillon, avec et sans graisse ; corpulence.delta_du_donneur sur un donneur de
fixture à deux états et une cible, et sa cible absente nommée."""
import gzip
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent / 'base'))

import corpulence  # noqa: E402

COTE, PAS, SILLON = 9, 0.01, 0.006


def plaque():
    """Une plaque `COTE`×`COTE` du plan XY, normales +Z, dont la colonne du milieu est creusée de `SILLON` : sommets,
    arêtes, normales et indices du sillon."""
    i, j = np.meshgrid(np.arange(COTE), np.arange(COTE), indexing='ij')
    x = np.stack([i.ravel() * PAS, j.ravel() * PAS, np.zeros(COTE * COTE)], axis=1)
    sillon = np.flatnonzero(i.ravel() == COTE // 2)
    x[sillon, 2] = -SILLON
    numero = np.arange(COTE * COTE).reshape(COTE, COTE)
    aretes = np.concatenate([np.stack([numero[:-1].ravel(), numero[1:].ravel()], axis=1),
                             np.stack([numero[:, :-1].ravel(), numero[:, 1:].ravel()], axis=1)])
    normales = np.tile([0.0, 0.0, 1.0], (COTE * COTE, 1))
    return x, aretes, normales, sillon


def ecrire_cible(chemin, delta):
    chemin.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(chemin, 'wt', encoding='utf-8') as fichier:
        fichier.write('# fixture\n')
        for indice, (dx, dy, dz) in enumerate(delta):
            fichier.write(f'{indice} {dx} {dy} {dz}\n')


class Comblement(unittest.TestCase):
    def test_le_sillon_remonte_sans_qu_aucun_sommet_ne_recule(self):
        x, aretes, normales, sillon = plaque()
        graisse = np.tile([0.0, 0.0, 3 * corpulence.GRAISSE_PLEINE / 2], (len(x), 1))
        rendu = corpulence.combler(x, graisse, aretes, normales)
        apport = np.einsum('sk,sk->s', rendu - graisse, normales)
        self.assertGreaterEqual(float(apport.min()), 0.0)
        self.assertGreaterEqual(float(np.einsum('sk,sk->s', rendu, normales).min()), 0.0)
        bord = np.setdiff1d(np.arange(len(x)), sillon)
        profondeur = float((x + rendu)[bord, 2].mean() - (x + rendu)[sillon, 2].mean())
        self.assertLess(profondeur, SILLON / 2)

    def test_sans_graisse_rien_ne_bouge(self):
        x, aretes, normales, _ = plaque()
        rendu = corpulence.combler(x, np.zeros_like(x), aretes, normales)
        self.assertEqual(float(np.abs(rendu).max()), 0.0)


class Recette(unittest.TestCase):
    TAILLE = 4

    def donneur(self, dossier):
        rng = np.random.default_rng(4002)
        macro = Path(dossier) / 'targets' / 'macrodetails'
        etat = corpulence.ETAT_DU_DELTA
        maximum, moyen, cible = (rng.normal(size=(self.TAILLE, 3)) for _ in range(3))
        ecrire_cible(macro / f'universal-{etat}-{corpulence.POIDS_MAX}.target.gz', maximum)
        ecrire_cible(macro / f'universal-{etat}-{corpulence.REFERENCE}.target.gz', moyen)
        ecrire_cible(Path(dossier) / 'targets' / 'stomach' / 'fixture.target.gz', cible)
        return maximum, moyen, cible

    def test_le_delta_est_la_somme_ponderee(self):
        with tempfile.TemporaryDirectory() as dossier, \
                mock.patch.object(corpulence, 'CIBLES', (('stomach/fixture', 0.9),)):
            maximum, moyen, cible = self.donneur(dossier)
            rendu = corpulence.delta_du_donneur(dossier, self.TAILLE)
        attendu = corpulence.FACTEUR * (maximum - moyen) + 0.9 * cible
        np.testing.assert_allclose(rendu, attendu, atol=1e-12)

    def test_une_cible_absente_arrete_en_la_nommant(self):
        with tempfile.TemporaryDirectory() as dossier, \
                mock.patch.object(corpulence, 'CIBLES', (('stomach/fixture', 0.9), ('stomach/absente', 1.0))):
            self.donneur(dossier)
            with self.assertRaisesRegex(RuntimeError, 'stomach/absente'):
                corpulence.delta_du_donneur(dossier, self.TAILLE)


if __name__ == '__main__':
    unittest.main()
