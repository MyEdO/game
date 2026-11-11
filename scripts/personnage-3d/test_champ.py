"""element/champ.py sur des peaux synthétiques maillées au pas de 2 mm : un carré plan z = 0, six os en chapeaux le long
de x, chacun un segment parallèle à y sous la peau, une silhouette et une clé `gabarit_*` affines en x ; un creux en V,
un os par versant ; un carré aux arêtes de 4 cm ; deux doigts, bandes disjointes côte à côte, un os par bande. Le champ
est continu de part et d'autre du creux et rend au contact la peau interpolée, même grossière ; il ne lit pas la peau
d'un doigt voisin ; deux points qui échangent leur 4e os gardent des poids proches ; deux points d'une
même normale dans la `BANDE` ont les mêmes poids et les mêmes clés, et le champ est continu au bord de la bande ;
`re_peser` pose le champ sur une pièce au contact, laisse ses poids à une pièce au-delà de `BANDE` + `LARGEUR` en lui
posant les clés du champ, laisse un sommet de chaîne et une clé hors du champ inchangés, et fond à la frontière d'une
chaîne des poids qui somment à 1 ; donne les mêmes poids aux deux nappes d'un même point, mais pas aux faces de deux
doigts qui se touchent ; `repeser.py` refuse un élément de couche `peau`."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

import bpy
import numpy as np

ICI = Path(__file__).resolve().parent
sys.path[:0] = [str(ICI / 'element'), str(ICI), str(ICI / 'base')]

import repeser  # noqa: E402
import champ  # noqa: E402
from champ import Champ, garder_les_plus_forts, re_peser  # noqa: E402
from formes import decalages, poser_la_cle  # noqa: E402

PAS = 0.002
COTE = 20
CENTRES = -0.03 + 0.012 * np.arange(6)
DEMI_LARGEUR = 0.012
ECART_DOIGTS = 0.003
OS = [f'os_{j}' for j in range(6)] + ['jupe_avant_01']


def chapeaux(x):
    """Poids des six os en `x` (points,) : chapeaux de `DEMI_LARGEUR` sur `CENTRES`, ramenés à une somme de 1, constants
    au-delà des centres extrêmes."""
    x = np.clip(x, CENTRES[0], CENTRES[-1])
    w = np.clip(1 - np.abs(x[:, None] - CENTRES[None]) / DEMI_LARGEUR, 0, None)
    return np.hstack([w / w.sum(axis=1, keepdims=True), np.zeros((len(x), 1))])


def cles(x):
    return {'feminin': np.stack([0.1 * x, 0 * x, 0 * x], axis=1),
            'gabarit_st_plus': np.stack([0 * x, 0 * x, 0.02 + 0.5 * x], axis=1)}


def peau(creux=False, pas=PAS, cote=COTE):
    """Le carré plan au pas `pas`, ou, `creux`, le V z = |x| aux os `os_0` (x < 0) et `os_1` (x > 0)."""
    i, j = np.meshgrid(np.arange(-cote, cote + 1), np.arange(-cote, cote + 1), indexing='ij')
    P = np.stack([i.ravel() * pas, j.ravel() * pas, np.abs(i.ravel() * pas) if creux else np.zeros(i.size)], axis=1)
    n = 2 * cote + 1
    T = []
    for a in range(n - 1):
        for b in range(n - 1):
            s = a * n + b
            T += [(s, s + n, s + n + 1), (s, s + n + 1, s + 1)]
    W = chapeaux(P[:, 0])
    if creux:
        W = np.zeros((len(P), len(OS)))
        W[:, 0], W[:, 1] = (P[:, 0] < 0) + 0.5 * (P[:, 0] == 0), (P[:, 0] > 0) + 0.5 * (P[:, 0] == 0)
    return Champ(P, np.array(T), W, OS, cles(P[:, 0]), ['feminin'], {'jupe_avant_01'}, segments(creux))


def grille(x0, x1, pas=PAS, cote=COTE):
    """Positions et triangles d'une bande plane z = 0, de x0 à x1 en x, de −`cote`·`pas` à `cote`·`pas` en y."""
    i, j = np.meshgrid(np.linspace(x0, x1, int(round((x1 - x0) / pas)) + 1), np.arange(-cote, cote + 1) * pas,
                       indexing='ij')
    P = np.stack([i.ravel(), j.ravel(), np.zeros(i.size)], axis=1)
    n, m = i.shape
    T = [t for a in range(n - 1) for b in range(m - 1)
         for t in ((a * m + b, (a + 1) * m + b, (a + 1) * m + b + 1), (a * m + b, (a + 1) * m + b + 1, a * m + b + 1))]
    return P, np.array(T)


def doigts():
    """Deux bandes disjointes à `ECART_DOIGTS` l'une de l'autre, x < 0 à `os_0`, x > 0 à `os_1`, chacune sur son os à
    1 cm sous elle."""
    Pa, Ta = grille(-0.03, -ECART_DOIGTS / 2)
    Pb, Tb = grille(ECART_DOIGTS / 2, 0.03)
    P, T = np.vstack([Pa, Pb]), np.vstack([Ta, Tb + len(Pa)])
    W = np.zeros((len(P), len(OS)))
    W[:len(Pa), 0], W[len(Pa):, 1] = 1, 1
    x = np.array([-0.015, 0.015, 0, 0, 0, 0, 0])
    z = np.where(np.arange(len(OS)) < 2, -0.01, -0.05)
    os_ = np.stack([np.stack([x, -0.05 + 0 * x, z], axis=1), np.stack([x, 0.05 + 0 * x, z], axis=1)], axis=1)
    return Champ(P, T, W, OS, cles(P[:, 0]), ['feminin'], {'jupe_avant_01'}, os_)


def segments(creux):
    """Par os de `OS`, un segment parallèle à y : sous chaque centre à 1 cm du carré, ou sous chaque versant du V."""
    x = np.array([-0.02, 0.02, 0, 0, 0, 0, 0]) if creux else np.append(CENTRES, 0)
    z = np.where(np.arange(len(OS)) < 6, -0.01, -0.05)
    return np.stack([np.stack([x, -0.05 + 0 * x, z], axis=1), np.stack([x, 0.05 + 0 * x, z], axis=1)], axis=1)


def ecart_de_poids(a, b):
    return 0.5 * np.abs(a - b).sum()


def piece(nom, hauteur, poids, decalage):
    """Un triangle skinné `nom` à `hauteur` au-dessus du carré, groupes `poids` (`{os: poids}` par sommet), clés
    `feminin`, `gabarit_st_plus` et `visage_inverse` décalées de `decalage`."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sommets = [(0.004, -0.003, hauteur), (0.01, 0.0, hauteur), (0.0, 0.01, hauteur)]
    data = bpy.data.meshes.new(nom)
    data.from_pydata(sommets, [], [(0, 1, 2)])
    objet = bpy.data.objects.new(nom, data)
    bpy.context.scene.collection.objects.link(objet)
    for i, valeurs in enumerate(poids):
        for os_, w in valeurs.items():
            (objet.vertex_groups.get(os_) or objet.vertex_groups.new(name=os_)).add([i], w, 'REPLACE')
    objet.modifiers.new('Squelette commun', 'ARMATURE')
    for nom_cle in ('feminin', 'gabarit_st_plus', 'visage_inverse'):
        poser_la_cle(objet, nom_cle, np.full((3, 3), decalage))
    return objet


def nappes(nom, faces, poids):
    """Un mesh skinné `nom` de triangles `faces` (par face, ses trois sommets ; leur ordre fait la normale), groupes
    `poids` (`{os: poids}` par face, sur ses trois sommets), clé `feminin` nulle."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    data = bpy.data.meshes.new(nom)
    data.from_pydata([s for f in faces for s in f], [], [(3 * k, 3 * k + 1, 3 * k + 2) for k in range(len(faces))])
    objet = bpy.data.objects.new(nom, data)
    bpy.context.scene.collection.objects.link(objet)
    for k, valeurs in enumerate(poids):
        for os_, w in valeurs.items():
            groupe = objet.vertex_groups.get(os_) or objet.vertex_groups.new(name=os_)
            groupe.add([3 * k, 3 * k + 1, 3 * k + 2], w, 'REPLACE')
    objet.modifiers.new('Squelette commun', 'ARMATURE')
    poser_la_cle(objet, 'feminin', np.zeros((3 * len(faces), 3)))
    return objet


def poids_de(objet, i):
    noms = {g.index: g.name for g in objet.vertex_groups}
    return {noms[g.group]: g.weight for g in objet.data.vertices[i].groups if g.weight > 0}


class ChampDePeau(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.champ = peau()

    def test_le_champ_est_continu_de_part_et_d_autre_d_un_creux(self):
        W, _ = peau(creux=True).evaluer(np.array([[-0.0005, 0.0, 0.02], [0.0005, 0.0, 0.02]]))
        self.assertLess(np.abs(W[0] - W[1]).max(), 0.2)

    def test_au_contact_le_champ_rend_la_peau_interpolee_sur_un_maillage_grossier(self):
        x = np.array([[0.013, 0.007, 0.0]])
        _, D = peau(pas=0.04, cote=5).evaluer(x)
        for nom, attendu in cles(x[:, 0]).items():
            self.assertLess(np.linalg.norm(D[nom] - attendu), 0.001)

    def test_le_champ_ne_lit_pas_la_peau_d_un_doigt_voisin(self):
        W, _ = doigts().evaluer(np.array([[-ECART_DOIGTS / 2 - 0.0005, 0.0, 0.002]]))
        self.assertEqual(W[0, 1], 0)

    def test_deux_points_voisins_qui_echangent_leur_quatrieme_os_ont_des_poids_proches(self):
        W = garder_les_plus_forts(np.array([[0.3, 0.25, 0.2, 0.13, 0.12, 0.0, 0.0],
                                            [0.3, 0.25, 0.2, 0.12, 0.13, 0.0, 0.0]]))
        self.assertLess(np.abs(W[0] - W[1]).max(), 0.05)
        np.testing.assert_allclose(W.sum(axis=1), 1)
        self.assertTrue((np.count_nonzero(W, axis=1) <= 4).all())

    def test_deux_points_d_une_meme_normale_dans_la_bande_ont_les_memes_poids_et_les_memes_cles(self):
        W, D = self.champ.evaluer(np.array([[0.006, 0.0, h] for h in (0.002, 0.015, champ.BANDE)]))
        for i in (1, 2):
            self.assertLessEqual(ecart_de_poids(W[0], W[i]), 0.03)
            for nom in D:
                self.assertLess(np.linalg.norm(D[nom][0] - D[nom][i]), 0.001)

    def test_le_champ_est_continu_au_bord_de_la_bande(self):
        W, D = self.champ.evaluer(np.array([[0.006, 0.0, champ.BANDE + e] for e in (-1e-4, 1e-4)]))
        self.assertLessEqual(ecart_de_poids(W[0], W[1]), 0.01)
        for nom in D:
            self.assertLess(np.linalg.norm(D[nom][0] - D[nom][1]), 1e-4)

    def test_au_contact_la_piece_prend_le_champ(self):
        objet = piece('contact', 0.001, [{'os_5': 1.0}] * 3, 0.03)
        W, D = self.champ.evaluer(np.array([v.co[:] for v in objet.data.vertices]))
        re_peser([objet], self.champ)
        for i in range(3):
            self.assertEqual(poids_de(objet, i).keys(), {OS[k] for k in np.flatnonzero(W[i])})
            for os_, w in poids_de(objet, i).items():
                self.assertAlmostEqual(w, W[i, OS.index(os_)], places=6)
        for nom in ('feminin', 'gabarit_st_plus'):
            np.testing.assert_allclose(decalages(objet, nom), D[nom], atol=1e-7)
        np.testing.assert_allclose(decalages(objet, 'visage_inverse'), np.full((3, 3), 0.03), atol=1e-7)

    def test_loin_du_corps_la_piece_garde_ses_poids_et_prend_les_cles_du_champ(self):
        objet = piece('loin', champ.BANDE + champ.LARGEUR + 0.001, [{'os_5': 1.0}] * 3, 0.03)
        _, D = self.champ.evaluer(np.array([v.co[:] for v in objet.data.vertices]))
        re_peser([objet], self.champ)
        for i in range(3):
            self.assertEqual(poids_de(objet, i), {'os_5': 1.0})
        np.testing.assert_allclose(decalages(objet, 'feminin'), D['feminin'], atol=1e-7)

    def test_un_sommet_de_chaine_garde_ses_poids_et_ses_cles(self):
        objet = piece('jupe', 0.001, [{'jupe_avant_01': 0.7, 'os_2': 0.3}, {'os_5': 1.0}, {'os_5': 1.0}], 0.03)
        re_peser([objet], self.champ)
        self.assertEqual({k: round(w, 6) for k, w in poids_de(objet, 0).items()}, {'jupe_avant_01': 0.7, 'os_2': 0.3})
        np.testing.assert_allclose(decalages(objet, 'feminin')[0], [0.03] * 3, atol=1e-7)
        self.assertFalse(np.allclose(decalages(objet, 'feminin')[1], 0.03))

    def test_les_poids_fondus_a_la_frontiere_d_une_chaine_somment_a_un(self):
        publies = {'os_0': 0.25, 'os_1': 0.25, 'os_4': 0.25, 'os_5': 0.25}
        objet = piece('fondu', 0.001, [{'jupe_avant_01': 1.0}, publies, publies], 0.03)
        re_peser([objet], self.champ)
        for i in (1, 2):
            poids = poids_de(objet, i)
            self.assertAlmostEqual(sum(poids.values()), 1, places=6)
            self.assertLessEqual(len(poids), 4)

    def test_les_deux_nappes_d_un_point_portent_les_memes_poids(self):
        h = champ.BANDE + champ.LARGEUR / 2
        dessus = [(0.004, -0.003, h + 0.0015), (0.01, 0.0, h + 0.0015), (0.0, 0.01, h + 0.0015)]
        dessous = [(x, y, z - 0.003) for x, y, z in reversed(dessus)]
        objet = nappes('double', [dessus, dessous], [{'os_5': 1.0}, {'os_4': 1.0}])
        re_peser([objet], self.champ)
        for i, j in ((0, 5), (1, 4), (2, 3)):
            self.assertEqual({k: round(w, 6) for k, w in poids_de(objet, i).items()},
                             {k: round(w, 6) for k, w in poids_de(objet, j).items()})

    def test_les_faces_de_deux_doigts_qui_se_touchent_gardent_chacune_son_doigt(self):
        x = ECART_DOIGTS / 2 - 0.0007
        face_a = [(-x, -0.003, 0.001), (-x, 0.003, 0.001), (-x, 0.0, 0.004)]
        face_b = [(x, y, z) for _, y, z in reversed(face_a)]
        objet = nappes('gant', [face_a, face_b], [{'os_5': 1.0}, {'os_5': 1.0}])
        re_peser([objet], doigts())
        for i in range(3):
            self.assertEqual(poids_de(objet, i).keys(), {'os_0'})
            self.assertEqual(poids_de(objet, 3 + i).keys(), {'os_1'})

    def test_un_element_de_couche_peau_est_refuse(self):
        with tempfile.TemporaryDirectory() as dossier:
            glb = Path(dossier) / 'tete.glb'
            glb.write_bytes(b'')
            (Path(dossier) / 'tete.manifeste.json').write_text(json.dumps({'couche': 'peau'}), encoding='utf-8')
            sys.argv = ['repeser.py', str(glb), '--base', str(glb), '--manifeste', str(glb), '--sortie', dossier]
            with self.assertRaises(SystemExit) as refus:
                repeser.main()
        self.assertIn('couche peau', str(refus.exception))


if __name__ == '__main__':
    unittest.main()
