"""rendu (#4002) : les os de repos déplacés par `gabarit.osDesSilhouettes`, chaque translation tournée par le repère de
repos de son parent, invisibles au repos et centre de rotation de l'os sous une pose ; le relief de la peau sous
`corpulence` ; une matière sans texture au catalogue laisse le matériau ; le relief projeté pose la normale du jeu
(#4527) ; un rigide rangé se pose à la transformation que le jeu lui donne, hors de son os (#4351) ; le cadre tient les
rigides, les zones couvertes se masquent sur la base comme sur les éléments, un rigide seul se dresse (#4338)."""
import argparse
import tempfile
import json
import unittest
from pathlib import Path
from unittest import mock

import numpy

from glb import ecrire_glb, lire_glb
from habillage import couleur_lineaire
from rendu import (HAUTEUR_DE_VUE, LARGEUR_DE_VUE, accuser_le_relief, cadrage, deplacements_des_os, deplacer_les_os, dresser,
                   facteur_de_relief, habiller_le_modele, importer, lire_cadre, masquer_les_zones_couvertes, matrice_du_noeud, preset_du_jeu,
                   ranger)

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


class LireCadre(unittest.TestCase):
    """`--cadre` (#4338)."""

    def test_quatre_nombres_en_metres(self):
        self.assertEqual(lire_cadre('0,0.02,0.62,1.35'), (0.0, 0.02, 0.62, 1.35))
        self.assertEqual(lire_cadre('-0.5,1,-2,0.6'), (-0.5, 1.0, -2.0, 0.6))

    def test_refuse_un_cadre_mal_forme_ou_d_etendue_nulle(self):
        for texte in ('0,0,0.6', '0,0,0.6,1,2', '0,0,haut,1', '0,0,0.6,0', '0,0,0.6,-1', '0,0,nan,1', '0,0,0.6,inf', ''):
            with self.subTest(texte=texte), self.assertRaises(argparse.ArgumentTypeError):
                lire_cadre(texte)


class Maillage(dict):
    """Un mesh de la scène, réduit à ce que lit `masquer_les_zones_couvertes` : son type, ses propriétés (`zone`) et
    `hide_render`."""
    type = 'MESH'
    hide_render = False


COUCHES = {'COUCHES': ['peau', 'dessous', 'tenue', 'armure', 'manteau'], 'RANG_DU_CORPS': -1}
"""`couches_du_jeu`, figées pour le banc."""


class MasquerLesZonesCouvertes(unittest.TestCase):
    """Une chemise (`dessous`, torse et col) sous un pourpoint (`tenue`, torse) sur une base (torse, cou, jambes) : la base
    se masque sous toute couche, la chemise sous le pourpoint, chacun garde ce que rien de plus extérieur ne couvre."""

    def test_chaque_zone_se_masque_sous_une_couche_plus_exterieure(self):
        base = {zone: Maillage(zone=zone) for zone in ('torse', 'cou', 'jambes')}
        chemise = {zone: Maillage(zone=zone) for zone in ('torse', 'col')}
        pourpoint = {'torse': Maillage(zone='torse')}
        sans_zone = Maillage()
        masquer_les_zones_couvertes([(list(base.values()) + [sans_zone], {'base': 'humanoide'}),
                                     (list(chemise.values()), {'couche': 'dessous', 'couvre': ['torse', 'cou']}),
                                     (list(pourpoint.values()), {'couche': 'tenue', 'couvre': ['torse']})], COUCHES)
        masques = {(porteur, zone) for porteur, meshes in (('base', base), ('chemise', chemise), ('pourpoint', pourpoint))
                   for zone, mesh in meshes.items() if mesh.hide_render}
        self.assertEqual(masques, {('base', 'torse'), ('base', 'cou'), ('chemise', 'torse')})
        self.assertFalse(sans_zone.hide_render)


class PresetDuJeu(unittest.TestCase):
    def test_chaque_glb_prend_la_palette_du_preset_completee_de_celle_de_sa_teinte(self):
        reponse = {'sans': [], 'glbs': ['/a.glb', '/b.glb'], 'elements': [None, None], 'silhouettes': {},
                   'palette': {'metal': '#808080', 'tissu': '#202020'}, 'palettes': [{}, {'metal': '#ff8a3a', 'cuir': '#5a2410'}]}
        with mock.patch('rendu.lancer', return_value=json.dumps(reponse)):
            jeu = preset_du_jeu('base.glb', 'base.manifeste.json', [], 'p', {})
        preset = {'metal': couleur_lineaire('#808080'), 'tissu': couleur_lineaire('#202020')}
        self.assertEqual(jeu['palette'], preset)
        self.assertEqual(jeu['palettes'], [preset, {**preset, 'metal': couleur_lineaire('#ff8a3a'), 'cuir': couleur_lineaire('#5a2410')}])


class Rangement(unittest.TestCase):
    """Deux rigides pendus à l'os `main` du GLB d'essai, de même nom de nœud glTF : celui que le jeu range quitte son os
    pour la transformation donnée, convertie de glTF (Y haut) à Blender (Z haut) ; celui qu'il ne range pas y reste."""

    POSE = [0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0.5, 1.25, -0.75, 1]
    """Colonne par colonne : un quart de tour autour de Y glTF, puis la translation (0,5 ; 1,25 ; -0,75)."""

    def test_le_rigide_range_prend_la_pose_du_jeu_et_le_tenu_garde_son_os(self):
        import bpy
        bpy.ops.wm.read_factory_settings(use_empty=True)
        with tempfile.TemporaryDirectory() as dossier:
            chemin = Path(dossier) / 'essai.glb'
            glb_d_essai(chemin)
            rig = next(o for o in importer(bpy, chemin) if o.type == 'ARMATURE')
        fioles = []
        for _ in range(2):
            fiole = bpy.data.objects.new('fiole', bpy.data.meshes.new('fiole'))
            bpy.context.scene.collection.objects.link(fiole)
            fiole.parent, fiole.parent_type, fiole.parent_bone = rig, 'BONE', 'main'
            fioles.append(fiole)
        bpy.context.view_layer.update()
        self.assertEqual([f.name for f in fioles], ['fiole', 'fiole.001'])
        tenue = numpy.array(fioles[0].matrix_world)
        ranger([([fioles[0]], {}), ([fioles[1]], {}), ([rig], {})],
               [{'ligne': 'main', 'meshes': {'fiole': None}}, {'ligne': 'bandouliere', 'meshes': {'fiole': self.POSE}}, None])
        bpy.context.view_layer.update()
        numpy.testing.assert_allclose(numpy.array(fioles[0].matrix_world), tenue, atol=1e-6)
        self.assertEqual(fioles[0].parent_bone, 'main')
        self.assertIsNone(fioles[1].parent)
        numpy.testing.assert_allclose(numpy.array(fioles[1].matrix_world),
                                      [[0, -1, 0, 0.5], [1, 0, 0, 0.75], [0, 0, 1, 1.25], [0, 0, 0, 1]], atol=1e-6)


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

    def test_le_cadre_d_un_personnage_tient_les_rigides_qui_depassent_son_corps(self):
        bpy = self.bpy
        _, corps_haut, _ = cadrage(bpy, [self.corps])
        for nom, sommets in (('hampe dressée', [(0, 0, -0.5), (0.02, 0, 3), (0, 0.02, 3)]),
                             ('lance couchée', [(-4, 0, 0.5), (4, 0, 0.5), (4, 0.02, 0.52)])):
            with self.subTest(nom):
                maillage = bpy.data.meshes.new(nom)
                maillage.from_pydata(sommets, [], [(0, 1, 2)])
                objet = bpy.data.objects.new(nom, maillage)
                bpy.context.scene.collection.objects.link(objet)
                bas, haut, etendue = cadrage(bpy, [self.corps, objet])
                for sommet in sommets:
                    self.assertTrue(all(b - 1e-6 <= c <= h + 1e-6 for b, c, h in zip(bas, sommet, haut)), sommet)
                self.assertGreaterEqual(etendue, haut.z - bas.z - 1e-6)
                self.assertGreaterEqual(etendue * LARGEUR_DE_VUE / HAUTEUR_DE_VUE, numpy.hypot(*(haut - bas)[:2]) - 1e-6)
                bpy.data.objects.remove(objet)
        self.assertLess(corps_haut.z, 3)

    def test_un_rigide_seul_se_dresse_hors_de_son_os_sa_forme_d_os_masquee(self):
        from mathutils import Matrix
        bpy = self.bpy
        lame = bpy.data.objects.new('lame', bpy.data.meshes.new('lame'))
        lame.data.materials.append(bpy.data.materials.new('acier'))
        forme = bpy.data.objects.new('forme', bpy.data.meshes.new('forme'))
        for objet in (lame, forme):
            bpy.context.scene.collection.objects.link(objet)
            objet.parent, objet.parent_type, objet.parent_bone = self.rig, 'BONE', 'main'
        bpy.context.view_layer.update()
        self.assertEqual(dresser([self.rig, lame, forme]), [lame])
        bpy.context.view_layer.update()
        self.assertIsNone(lame.parent)
        numpy.testing.assert_allclose(numpy.array(lame.matrix_world), numpy.array(Matrix.Rotation(numpy.pi / 2, 4, 'X')), atol=1e-6)
        self.assertTrue(forme.hide_render)
        self.assertFalse(lame.hide_render)
        for objet in (lame, forme):
            bpy.data.objects.remove(objet)

    def test_une_matiere_sans_texture_au_catalogue_laisse_le_materiau(self):
        bpy = self.bpy
        mat = bpy.data.materials.new('SansTexture')
        maillage = bpy.data.meshes.new('SansTexture')
        maillage.from_pydata([(0, 0, 0), (1, 0, 0), (0, 1, 0)], [], [(0, 1, 2)])
        maillage.uv_layers.new(name='UVMap')
        maillage.materials.append(mat)
        objet = bpy.data.objects.new('SansTexture', maillage)
        bpy.context.scene.collection.objects.link(objet)
        avant = len(mat.node_tree.nodes)
        habiller_le_modele(bpy, [objet], {'surfaces': [{'nom': 'SansTexture', 'palette': 'peau', 'matiere': 'prop--sans-texture'}]},
                           None, True, {})
        self.assertEqual(len(mat.node_tree.nodes), avant)


class ReliefProjete(unittest.TestCase):
    """La normale du monde que `habiller` pose en projeté, cuite par Cycles sur un carré de 6 cm (texels `Closest`),
    égale à celle de `art/monde.gdshader` rejouée dans le repère de Godot (Y haut, V vers le bas) : poids, plans de
    `triplanar_texture`, base de `vertex()`, `NORMAL_MAP` ; sur une face oblique, et sur une face d'axe dont l'origine
    est à un dixième de texel de la grille du relief (1024 px sur `METRES_PAR_MOTIF`), qu'aucun point lu ne tombe sur
    une frontière de texel."""

    MATIERE = 'prop--corde'
    COTE, PIXELS = 0.06, 64

    def ecart(self, normale, origine):
        import bpy
        from rendu import CATALOGUE, METRES_PAR_MOTIF, NETTETE_DU_MOTIF, habiller
        unite = lambda v: v / numpy.linalg.norm(v)
        n = unite(numpy.array(normale, float))
        u = unite(numpy.cross([0, 0, 1.0] if abs(n[2]) < 0.9 else [1.0, 0, 0], n))
        v = numpy.cross(n, u)
        p0 = numpy.array(origine, float)
        bpy.ops.wm.read_factory_settings(use_empty=True)
        maillage = bpy.data.meshes.new('carre')
        maillage.from_pydata([tuple(p0 + self.COTE * c) for c in (0 * u, u, u + v, v)], [], [(0, 1, 2, 3)])
        couche = maillage.uv_layers.new(name='UVMap')
        for i, st in enumerate([(0, 0), (1, 0), (1, 1), (0, 1)]):
            couche.data[i].uv = st
        mat = bpy.data.materials.new('carre')
        maillage.materials.append(mat)
        objet = bpy.data.objects.new('carre', maillage)
        bpy.context.scene.collection.objects.link(objet)
        habiller(bpy, mat, {'nom': 'carre', 'matiere': self.MATIERE}, 'UVMap', None, False, None)
        nt = mat.node_tree
        for noeud in nt.nodes:
            if noeud.type == 'TEX_IMAGE':
                noeud.interpolation = 'Closest'
        bsdf = next(x for x in nt.nodes if x.type == 'BSDF_PRINCIPLED')
        encodee = nt.nodes.new('ShaderNodeVectorMath')
        encodee.operation = 'MULTIPLY_ADD'
        nt.links.new(bsdf.inputs['Normal'].links[0].from_socket, encodee.inputs[0])
        encodee.inputs[1].default_value = encodee.inputs[2].default_value = (0.5,) * 3
        emission = nt.nodes.new('ShaderNodeEmission')
        nt.links.new(encodee.outputs[0], emission.inputs['Color'])
        nt.links.new(emission.outputs[0], next(x for x in nt.nodes if x.type == 'OUTPUT_MATERIAL').inputs['Surface'])
        cuite = bpy.data.images.new('cuite', self.PIXELS, self.PIXELS, float_buffer=True)
        cuite.colorspace_settings.name = 'Non-Color'
        cible = nt.nodes.new('ShaderNodeTexImage')
        cible.image = cuite
        nt.nodes.active = cible
        scene = bpy.context.scene
        scene.render.engine, scene.cycles.samples, scene.cycles.device = 'CYCLES', 1, 'CPU'
        scene.cycles.filter_width, scene.render.bake.margin = 0.01, 0
        bpy.context.view_layer.objects.active = objet
        objet.select_set(True)
        bpy.ops.object.bake(type='EMIT')
        cuite = numpy.array(cuite.pixels[:]).reshape(self.PIXELS, self.PIXELS, 4)[..., :3] * 2 - 1
        relief = bpy.data.images.load(str(CATALOGUE / f'{self.MATIERE}.normale.jpg'), check_existing=True)
        relief.colorspace_settings.name = 'Non-Color'
        largeur, hauteur = relief.size
        texels = numpy.array(relief.pixels[:]).reshape(hauteur, largeur, 4)[::-1, :, :3]
        lire = lambda s, t: texels[int((t % 1) * hauteur), int((s % 1) * largeur)]
        vers_godot = lambda b: numpy.array([b[0], b[2], -b[1]])
        ng = vers_godot(n)
        a = numpy.abs(ng)
        poids = a ** NETTETE_DU_MOTIF / (a ** NETTETE_DU_MOTIF).sum()
        tangente = unite(a[0] * numpy.array([0, 0, -1.0]) + (a[1] + a[2]) * numpy.array([1.0, 0, 0]))
        bitangente = unite((a[0] + a[2]) * numpy.array([0, 1.0, 0]) + a[1] * numpy.array([0, 0, -1.0]))
        ecarts = []
        for i in range(4, self.PIXELS, 16):
            for j in range(4, self.PIXELS, 16):
                p = vers_godot(p0 + self.COTE * ((j + 0.5) * u + (i + 0.5) * v) / self.PIXELS) / METRES_PAR_MOTIF * [1, -1, 1]
                lu = lire(p[0], p[1]) * poids[2] + lire(p[0], p[2]) * poids[1] + lire(-p[2], p[1]) * poids[0]
                xy = lu[:2] * 2 - 1
                g = unite(tangente * xy[0] + bitangente * xy[1] + ng * numpy.sqrt(max(0, 1 - xy @ xy)))
                ecarts.append(numpy.abs(numpy.array([g[0], -g[2], g[1]]) - unite(cuite[i, j])).max())
        return max(ecarts)

    def test_une_face_oblique_a_la_normale_du_jeu(self):
        self.assertLess(self.ecart((1, 2, 3), (0.37, 0.11, 0.53)), 1e-3)

    def test_une_face_d_axe_a_la_normale_du_jeu(self):
        self.assertLess(self.ecart((0, -1, 0), (169.1 / 512, 0, 312.1 / 512)), 1e-3)


if __name__ == '__main__':
    unittest.main()
