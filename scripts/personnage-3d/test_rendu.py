"""rendu (#4002) : les os de repos déplacés par `gabarit.osDesSilhouettes`, chaque translation tournée par le repère de
repos de son parent, invisibles au repos et centre de rotation de l'os sous une pose ; le relief de la peau sous
`corpulence`."""
import tempfile
import unittest
from pathlib import Path

import numpy

from glb import ecrire_glb, lire_glb
from rendu import accuser_le_relief, deplacements_des_os, deplacer_les_os, facteur_de_relief, importer, matrice_du_noeud

RACINE_TOURNEE = [0, 0, 2 ** -0.5, 2 ** -0.5]
"""Quart de tour autour de Z (glTF)."""
BRAS_TOURNE = [2 ** -0.5, 0, 0, 2 ** -0.5]
"""Quart de tour autour de X (glTF)."""
TABLE = {'feminin': {'bras': [0.05, 0, 0]}, 'carrure_plus': {'main': [0, 0, 0.2]}}
POIDS = {'feminin': 1, 'carrure_plus': 0.5}
DEPLACEMENTS = {'bras': [0, 0.05, 0], 'main': [0.1, 0.05, 0]}
"""`TABLE` aux `POIDS`, à la main : `bras` tourné par la racine, `main` par la racine puis le bras, plus celui du bras."""
TETE_DE_LA_MAIN = (-0.9, -1, 0.05)
"""La tête de `main` déplacée, monde Blender : (-1, 0, 1) glTF au repos, plus son déplacement, Y haut vers Z haut."""


def squelette():
    """racine (tournée) → bras (tourné, à 1 m) → main (à 1 m), et un corps skinné : un triangle par os, chacun à son os
    seul."""
    return [{'name': 'racine', 'rotation': RACINE_TOURNEE, 'children': [1]},
            {'name': 'bras', 'translation': [0, 1, 0], 'rotation': BRAS_TOURNE, 'children': [2]},
            {'name': 'main', 'translation': [0, 1, 0]}]


def glb_d_essai(chemin):
    """Le GLB de `squelette` : ses liaisons inverses des repos du monde, ses sommets autour de chaque os."""
    noeuds = squelette() + [{'name': 'corps', 'mesh': 0, 'skin': 0}]
    mondes = []
    for i in range(3):
        locale = matrice_du_noeud(noeuds[i])
        mondes.append(locale if i == 0 else mondes[i - 1] @ locale)
    sommets, joints = [], []
    for os_, monde in enumerate(mondes):
        for decalage in ([0.1, 0, 0], [0, 0.1, 0.05], [0, 0, 0.1]):
            sommets.append(monde[:3, 3] + monde[:3, :3] @ numpy.array([0, 0.3, 0]) + decalage)
            joints.append([os_, 0, 0, 0])
    sommets = numpy.array(sommets, dtype='<f4')
    morceaux = [sommets.tobytes(), numpy.array(joints, dtype='<u2').tobytes(),
                numpy.tile(numpy.array([1, 0, 0, 0], dtype='<f4'), (len(sommets), 1)).tobytes(),
                numpy.array([numpy.linalg.inv(m).T.ravel() for m in mondes], dtype='<f4').tobytes()]
    vues, binaire = [], b''
    for morceau in morceaux:
        vues.append({'buffer': 0, 'byteOffset': len(binaire), 'byteLength': len(morceau)})
        binaire += morceau
    document = {
        'asset': {'version': '2.0'}, 'scene': 0, 'scenes': [{'nodes': [0, 3]}], 'nodes': noeuds,
        'skins': [{'joints': [0, 1, 2], 'skeleton': 0, 'inverseBindMatrices': 3}],
        'meshes': [{'primitives': [{'attributes': {'POSITION': 0, 'JOINTS_0': 1, 'WEIGHTS_0': 2}}]}],
        'accessors': [
            {'bufferView': 0, 'componentType': 5126, 'count': len(sommets), 'type': 'VEC3',
             'min': sommets.min(axis=0).tolist(), 'max': sommets.max(axis=0).tolist()},
            {'bufferView': 1, 'componentType': 5123, 'count': len(sommets), 'type': 'VEC4'},
            {'bufferView': 2, 'componentType': 5126, 'count': len(sommets), 'type': 'VEC4'},
            {'bufferView': 3, 'componentType': 5126, 'count': 3, 'type': 'MAT4'}],
        'bufferViews': vues, 'buffers': [{'byteLength': len(binaire)}]}
    ecrire_glb(chemin, document, binaire)


class DeplacementsDesOs(unittest.TestCase):
    def test_chaque_translation_tourne_du_repere_de_repos_de_son_parent_et_s_ajoute_a_celui_du_parent(self):
        deplacements = deplacements_des_os({'nodes': squelette()}, TABLE, POIDS)
        self.assertEqual(sorted(deplacements), sorted(DEPLACEMENTS))
        for os_, attendu in DEPLACEMENTS.items():
            numpy.testing.assert_allclose(deplacements[os_], attendu, atol=1e-12)

    def test_sans_table_ou_a_poids_nuls_rien_ne_bouge(self):
        self.assertEqual(deplacements_des_os({'nodes': squelette()}, {}, POIDS), {})
        self.assertEqual(deplacements_des_os({'nodes': squelette()}, TABLE, {}), {})
        self.assertEqual(deplacements_des_os({'nodes': squelette()}, TABLE, {'feminin': 0, 'carrure_plus': 0}), {})


class FacteurDeRelief(unittest.TestCase):
    def test_le_relief_suit_le_poids_de_corpulence(self):
        manifeste = {'reliefDeCorpulence': 0.2}
        self.assertEqual(facteur_de_relief(manifeste, {'corpulence': 1}), 0.2)
        self.assertEqual(facteur_de_relief(manifeste, {'corpulence': 0.5}), 0.6)
        self.assertIsNone(facteur_de_relief(manifeste, {'corpulence': 0}))
        self.assertIsNone(facteur_de_relief(manifeste, {'feminin': 1}))
        self.assertIsNone(facteur_de_relief({}, {'corpulence': 1}))


class DansBlender(unittest.TestCase):
    """Le GLB d'essai importé par Blender, qui réoriente ses os : les os déplacés n'y changent rien au repos, et `main`
    tourne autour de sa tête déplacée."""

    @classmethod
    def setUpClass(cls):
        import bpy
        cls.bpy = bpy
        bpy.ops.wm.read_factory_settings(use_empty=True)
        with tempfile.TemporaryDirectory() as dossier:
            chemin = Path(dossier) / 'essai.glb'
            glb_d_essai(chemin)
            cls.objets = importer(bpy, chemin)
            cls.document = lire_glb(chemin)[0]
        cls.rig = next(o for o in cls.objets if o.type == 'ARMATURE')
        cls.corps = next(o for o in cls.objets if o.type == 'MESH')

    def sommets(self):
        from mesure import world_vertices
        self.bpy.context.view_layer.update()
        return world_vertices(self.bpy, [self.corps])[self.corps.name]

    def test_au_repos_rien_ne_change_et_sous_une_pose_main_tourne_autour_de_sa_tete_deplacee(self):
        from mathutils import Quaternion, Vector
        repos = self.sommets()
        deplacer_les_os(self.bpy, self.rig, deplacements_des_os(self.document, TABLE, POIDS))
        numpy.testing.assert_allclose(self.sommets(), repos, atol=1e-6)
        os_ = self.rig.data.bones['main']
        tete = self.rig.matrix_world @ os_.head_local
        numpy.testing.assert_allclose(tete, TETE_DE_LA_MAIN, atol=1e-6)
        pose = self.rig.pose.bones['main']
        pose.rotation_mode = 'QUATERNION'
        pose.rotation_quaternion = Quaternion(Vector((0.3, 0.2, 1)).normalized(), 0.9)
        repere = (self.rig.matrix_world @ os_.matrix_local).to_3x3()
        rotation = numpy.array(repere @ pose.rotation_quaternion.to_matrix() @ repere.inverted())
        tete = numpy.array(tete)
        attendus = tete + (repos[6:] - tete) @ rotation.T
        posee = self.sommets()
        numpy.testing.assert_allclose(posee[6:], attendus, atol=1e-6)
        numpy.testing.assert_allclose(posee[:6], repos[:6], atol=1e-6)

    def test_le_relief_multiplie_une_fois_la_force_des_normal_maps_des_seules_surfaces_de_peau(self):
        bpy = self.bpy
        materiaux = {}
        for nom in ('Peau', 'Cheveux'):
            materiau = bpy.data.materials.new(nom)
            materiau.node_tree.nodes.new('ShaderNodeNormalMap').inputs['Strength'].default_value = 0.8
            materiaux[nom] = materiau
        maillages = []
        for nom in ('Tete', 'Torse'):
            maillage = bpy.data.objects.new(nom, bpy.data.meshes.new(nom))
            bpy.context.scene.collection.objects.link(maillage)
            maillage.data.materials.append(materiaux['Peau'])
            maillage.data.materials.append(materiaux['Cheveux'])
            maillages.append(maillage)
        accuser_le_relief(maillages, {'Peau'}, 0.5)
        force = {nom: next(n for n in m.node_tree.nodes if n.type == 'NORMAL_MAP').inputs['Strength'].default_value
                 for nom, m in materiaux.items()}
        self.assertAlmostEqual(force['Peau'], 0.4, places=6)
        self.assertAlmostEqual(force['Cheveux'], 0.8, places=6)


if __name__ == '__main__':
    unittest.main()
