"""rendu (#4002) : les os de repos déplacés par `gabarit.osDesSilhouettes`, chaque translation tournée par le repère de
repos de son parent, invisibles au repos et centre de rotation de l'os sous une pose ; le relief de la peau sous
`corpulence` ; la palette et les matières d'un preset, celles de sa race d'abord, et la matière de la race ajoutée en
détail aux surfaces de son emplacement, aux UV à l'échelle mesurée (#4379)."""
import argparse
import math
import tempfile
import unittest
from pathlib import Path

import numpy

from glb import ecrire_glb, lire_glb
from habillage import couleur_lineaire
from rendu import (METRES_PAR_MOTIF, POIDS_DU_DETAIL, accuser_le_relief, apparence, deplacements_des_os, deplacer_les_os, facteur_de_relief,
                   habiller_le_modele, importer, lire_cadre, matrice_du_noeud)

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


class Apparence(unittest.TestCase):
    """La palette et les matières d'un preset (#4379)."""

    RACES = [{'id': 'orc', 'couleurs': {'peau': {'id': 'vert'}, 'yeux': {'id': 'rouge'}}, 'matieres': {'peau': {'id': 'peau-epaisse'}}},
             {'id': 'humain'}]
    NUANCIER = [{'id': 'vert', 'domain': 'couleur', 'color': '#2a5a2a'}, {'id': 'rouge', 'domain': 'couleur', 'color': '#a02020'},
                {'id': 'bleu', 'domain': 'couleur', 'color': '#2030a0'}]

    def test_les_couleurs_de_la_race_puis_celles_du_preset_et_les_matieres_de_la_race(self):
        palette, matieres = apparence({'race': {'id': 'orc'}, 'couleurs': {'yeux': {'id': 'bleu'}}}, self.RACES, self.NUANCIER)
        self.assertEqual(palette, {'peau': couleur_lineaire('#2a5a2a'), 'yeux': couleur_lineaire('#2030a0')})
        self.assertEqual(matieres, {'peau': 'prop--peau-epaisse'})

    def test_une_race_sans_couleurs_ni_matieres_n_en_donne_aucune(self):
        self.assertEqual(apparence({'race': {'id': 'humain'}, 'couleurs': {'yeux': {'id': 'bleu'}}}, self.RACES, self.NUANCIER),
                         ({'yeux': couleur_lineaire('#2030a0')}, {}))


class LireCadre(unittest.TestCase):
    """`--cadre` (#4338)."""

    def test_quatre_nombres_en_metres(self):
        self.assertEqual(lire_cadre('0,0.02,0.62,1.35'), (0.0, 0.02, 0.62, 1.35))
        self.assertEqual(lire_cadre('-0.5,1,-2,0.6'), (-0.5, 1.0, -2.0, 0.6))

    def test_refuse_un_cadre_mal_forme_ou_d_etendue_nulle(self):
        for texte in ('0,0,0.6', '0,0,0.6,1,2', '0,0,haut,1', '0,0,0.6,0', '0,0,0.6,-1', '0,0,nan,1', '0,0,0.6,inf', ''):
            with self.subTest(texte=texte), self.assertRaises(argparse.ArgumentTypeError):
                lire_cadre(texte)


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

    def test_la_matiere_de_la_race_s_ajoute_en_detail_aux_uv_a_l_echelle_du_materiau_sur_tout_le_modele_et_le_materiau_reste(self):
        bpy = self.bpy
        matiere = 'prop--peau-epaisse'
        mat = bpy.data.materials.new('PeauDeRace')
        nt = mat.node_tree
        bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
        bsdf.inputs['Base Color'].default_value = (0.2, 0.4, 0.1, 1)
        atlas = nt.nodes.new('ShaderNodeTexImage')
        atlas.image = bpy.data.images.new('atlas', 4, 4)
        carte = nt.nodes.new('ShaderNodeNormalMap')
        carte.inputs['Strength'].default_value = 0.8
        nt.links.new(atlas.outputs['Color'], carte.inputs['Color'])
        nt.links.new(carte.outputs['Normal'], bsdf.inputs['Normal'])
        objets = []
        for nom, cote, etendue in (('Torse', 4, 1), ('Bras', 1, 0.5)):
            maillage = bpy.data.meshes.new(nom)
            maillage.from_pydata([(0, 0, 0), (cote, 0, 0), (0, cote, 0)], [], [(0, 1, 2)])
            maillage.uv_layers.new(name='UVMap')
            for boucle, uv in zip(maillage.uv_layers[0].data, ((0, 0), (etendue, 0), (0, etendue))):
                boucle.uv = uv
            maillage.materials.append(mat)
            objets.append(bpy.data.objects.new(nom, maillage))
            bpy.context.scene.collection.objects.link(objets[-1])
        manifeste = {'surfaces': [{'nom': 'PeauDeRace', 'palette': 'peau'}]}
        habiller_le_modele(bpy, objets, manifeste, None, True, {}, {'peau': matiere})
        self.assertFalse(any(n.type == 'TEX_IMAGE' and n.projection == 'BOX' for n in nt.nodes))
        self.assertEqual(bsdf.inputs['Normal'].links[0].from_node, carte)
        self.assertAlmostEqual(carte.inputs['Strength'].default_value, 0.8 / POIDS_DU_DETAIL, places=6)
        melange = carte.inputs['Color'].links[0].from_node
        self.assertEqual((melange.blend_type, melange.inputs['Factor'].default_value), ('MIX', POIDS_DU_DETAIL))
        entrees = [s for s in melange.inputs if s.type == 'RGBA']
        self.assertEqual(entrees[0].links[0].from_node, atlas)
        self.assertEqual(entrees[1].links[0].from_node.image.name, f'{matiere}.normale.jpg')
        teinte = bsdf.inputs['Base Color'].links[0].from_node
        self.assertEqual((teinte.blend_type, teinte.inputs['Factor'].default_value), ('MULTIPLY', POIDS_DU_DETAIL))
        couleurs = [s for s in teinte.inputs if s.type == 'RGBA']
        numpy.testing.assert_allclose(couleurs[0].default_value, (0.2, 0.4, 0.1, 1), atol=1e-6)
        self.assertEqual(couleurs[1].links[0].from_node.image.name, f'{matiere}.neutre.jpg')
        mise = next(n for n in nt.nodes if n.type == 'MAPPING')
        echelle = math.sqrt((8 + 0.5) / (0.5 + 0.125)) / METRES_PAR_MOTIF
        numpy.testing.assert_allclose(mise.inputs['Scale'].default_value, (echelle, echelle, 1), atol=1e-6)

    def test_sans_relief_au_catalogue_ni_texture_rien_ne_s_ajoute(self):
        bpy = self.bpy
        mat = bpy.data.materials.new('SansTexture')
        maillage = bpy.data.meshes.new('SansTexture')
        maillage.from_pydata([(0, 0, 0), (1, 0, 0), (0, 1, 0)], [], [(0, 1, 2)])
        maillage.uv_layers.new(name='UVMap')
        maillage.materials.append(mat)
        objet = bpy.data.objects.new('SansTexture', maillage)
        bpy.context.scene.collection.objects.link(objet)
        avant = len(mat.node_tree.nodes)
        habiller_le_modele(bpy, [objet], {'surfaces': [{'nom': 'SansTexture', 'palette': 'peau', 'matiere': 'prop--sans-texture'},
                                                       ]}, None, True, {}, {'peau': 'prop--peau-epaisse'})
        habiller_le_modele(bpy, [objet], {'surfaces': [{'nom': 'SansTexture', 'palette': 'peau'}]}, None, True, {},
                           {'peau': 'prop--sans-texture'})
        self.assertEqual(len(mat.node_tree.nodes), avant)

if __name__ == '__main__':
    unittest.main()
