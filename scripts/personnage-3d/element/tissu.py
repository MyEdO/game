"""Pièce skinnée sur une base (#3743) : ce qu'un vêtement emprunte à la base au repos, pour le `modele.py` d'un élément
de liaison `squelette` que bâtit `element/construire.py`.

`Base` ouvre la base au repos avec ses zones (un mesh par zone, `extras.zone`) : repères d'os, surfaces porteuses
(positions, triangles, poids par os), coupes planes des zones, éléments publiés qu'une pièce contourne, transfert des
silhouettes et des clés `gabarit_*` (du corps au plus près, des éléments publiés par liaison de surface), découpe de la
pièce par zone. Le reste se compose dans le
modèle : un anneau à aisance sur une coupe (`anneau`), un maillage par anneaux orienté vers l'extérieur (`Maillage`),
des poids empruntés (`emprunter`) puis lissés (`lisser`), une double nappe (`nappe`).
"""
import math
import random

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

from anatomie import attache
from filets import filets_au_repos
from formes import aretes_des_triangles, aux_noeuds, decalages, poser_la_cle, rapports, region_locale, retournees_par, transferer_les_cles

BORNES_DES_CLES = (0.4, 2.5)
"""Rapport de longueur d'arête sous une clé transférée (clé / repos) hors duquel `Base.transferer` lisse la clé : marge
prise sur la porte d'étirement de l'évaluateur ([0,25 ; 4]). Une pièce longue (robe jusqu'aux chevilles) suit le bas de
jambe tassé sous `gabarit_legs_moins` et passe les siennes : le lissage, qui ne réduit pas un tassement uniforme,
s'étendrait sinon à toute la pièce et la décollerait du corps (`suiviDuCorps/cle-non-suivie`)."""


CHARNIERE_M = 0.10
"""Hauteur, en mètres, sous les racines d'un filet, sur laquelle une nappe passe du corps au filet (`Filet.part`)."""
FONDU_D_OS_M = 0.12
"""Hauteur, en mètres, autour de l'articulation de deux os d'un brin, sur laquelle une nappe passe de l'un à l'autre
(`Filet.poids`)."""
EGALITE_DE_ZONE_M = 1e-5
"""Écart de distance, en mètres, sous lequel deux zones sont aussi proches d'une face (`Base.zones_des_faces`) : le
point le plus proche d'une face posée sur la couture de deux zones est sur leurs deux bords, à des distances que
l'arrondi de la machine départage (la robe de #4002 : 61 faces à égalité, écarts de 1e-8 à 3e-7 m)."""


def direction(theta):
    """Direction horizontale (x, y) de l'azimut `theta` (degrés, depuis l'avant -Y vers la gauche +X)."""
    t = math.radians(theta)
    return np.array([math.sin(t), -math.cos(t)])


def fondu(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


class Filet:
    """Un filet de la base au repos (`filets_au_repos`, `base/filets.py`) sous la nappe qui le suit : son rayon autour de
    son axe et ses poids, par os de la base, en un point donné par sa hauteur `z` et son azimut `theta` (`direction`)."""

    def __init__(self, repos, indice_os):
        self.brins, self.os, self.axe, self.ferme, self.indice_os = repos['brins'], repos['os'], repos['axe'], repos['ferme'], indice_os
        hors = self.brins[:, -1, :2] - self.axe
        self.hors = hors / np.linalg.norm(hors, axis=1, keepdims=True)
        self.azimuts = np.round(np.degrees(np.arctan2(hors[:, 0], -hors[:, 1])), 6) % 360.0
        self.rayons = np.linalg.norm(self.brins[:, :, :2] - self.axe, axis=2)

    def azimut(self, p):
        """L'azimut du point `p` autour de l'axe du filet."""
        return math.degrees(math.atan2(p[0] - self.axe[0], self.axe[1] - p[1]))

    def part(self, z):
        """Part du filet à la hauteur `z` : nulle à ses racines, entière `CHARNIERE_M` au-dessous."""
        return fondu((float(self.brins[:, 0, 2].max()) - z) / CHARNIERE_M)

    def rayon_du_brin(self, s, z):
        """Rayon du brin `s` à la hauteur `z`, le long de ses os, le dernier prolongé sous l'ourlet."""
        zs, rs = self.brins[s, :, 2], self.rayons[s]
        k = int(np.clip(np.searchsorted(-zs, -z) - 1, 0, len(zs) - 2))
        return rs[k] + (rs[k + 1] - rs[k]) * max(0.0, (zs[k] - z) / (zs[k] - zs[k + 1]))

    def point(self, z, theta):
        """Le rayon du filet en (`z`, `theta`), sur la corde entre ses deux brins voisins, ces deux brins et la part du
        second ; au-delà du bord d'un filet ouvert, son brin de bord."""
        i = int(np.searchsorted(self.azimuts, theta % 360.0, side='right')) - 1
        i, j = (i % len(self.brins), (i + 1) % len(self.brins)) if self.ferme else (max(i, 0), min(i + 1, len(self.brins) - 1))
        if i == j:
            return float(self.rayon_du_brin(i, z)), i, j, 0.0
        coins = [self.rayon_du_brin(s, z) * self.hors[s] for s in (i, j)]
        rho, part = np.linalg.solve(np.column_stack([direction(theta), coins[0] - coins[1]]), coins[0])
        return float(rho), i, j, float(min(1.0, max(0.0, part)))

    def poids(self, z, theta):
        """Les poids du point (`z`, `theta`) : entre ses deux brins voisins selon l'azimut, le long de chacun d'un os au
        suivant sur `FONDU_D_OS_M` autour de leur articulation."""
        _, i, j, part = self.point(z, theta)
        w = np.zeros(len(self.indice_os))
        for s, reste in ((i, 1 - part), (j, part)):
            for k, os_ in enumerate(self.os[s]):
                sous = fondu((self.brins[s, k + 1, 2] + FONDU_D_OS_M / 2 - z) / FONDU_D_OS_M) if k + 1 < len(self.os[s]) else 0.0
                w[self.indice_os[os_]] += reste * (1 - sous)
                reste *= sous
        return w


class Base:
    """La base `glb` au repos, son manifeste `manifeste`, ses zones de peau (un mesh par zone, de la surface de palette
    `peau` : les sourcils et les yeux portent aussi une zone) ; `publies(id)` rend le GLB d'un élément publié."""

    def __init__(self, glb, manifeste, publies):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(glb))
        self.glb = glb
        rigs = [o for o in bpy.data.objects if o.type == 'ARMATURE']
        if len(rigs) != 1:
            raise ValueError(f'{len(rigs)} armatures dans la base, une attendue')
        self.rig = rigs[0]
        if self.rig.animation_data:
            self.rig.animation_data.action = None
        for pb in self.rig.pose.bones:
            pb.matrix_basis.identity()
        bpy.context.view_layer.update()
        self.manifeste = manifeste
        self.publies = publies
        peaux = {s_['nom'] for s_ in manifeste['surfaces'] if s_['palette'] == 'peau'}
        self.zones = {}
        for o in bpy.data.objects:
            if o.type == 'MESH' and o.get('zone') and {m.name.split('.')[0] for m in o.data.materials} & peaux:
                if o['zone'] in self.zones:
                    raise ValueError(f"zone {o['zone']} : deux meshes de peau, {self.zones[o['zone']].name} et {o.name}")
                self.zones[o['zone']] = o
        self.os = manifeste['os']
        self.indice_os = {n: i for i, n in enumerate(self.os)}
        self._corps = {}
        self.emplacements = {}

    def exiger(self, noms):
        absentes = [z for z in noms if z not in self.zones]
        if absentes:
            raise ValueError(f'zones absentes de la base : {absentes}')

    def filet(self, nom):
        """Le filet `nom` de la base au repos."""
        return Filet(filets_au_repos(self.glb)[nom], self.indice_os)

    def tete(self, nom):
        """La tête de l'os `nom`, monde, au repos."""
        return self.rig.matrix_world @ self.rig.data.bones[nom].head_local

    def corps(self, zone):
        """Positions monde, triangles et poids (par os de la base) de la zone `zone` au repos."""
        if zone not in self._corps:
            objet = self.zones[zone]
            M = np.array(objet.matrix_world)
            P = np.array([v.co for v in objet.data.vertices]) @ M[:3, :3].T + M[:3, 3]
            objet.data.calc_loop_triangles()
            T = np.array([t.vertices[:] for t in objet.data.loop_triangles])
            W = np.zeros((len(P), len(self.os)))
            noms = {g.index: g.name for g in objet.vertex_groups}
            for v in objet.data.vertices:
                for g in v.groups:
                    if noms[g.group] in self.indice_os:
                        W[v.index, self.indice_os[noms[g.group]]] = g.weight
            self._corps[zone] = (P, T, W)
        return self._corps[zone]

    def porteur(self, noms):
        """La surface porteuse jointe des zones `noms` : positions, triangles, poids et arbre de recherche."""
        P, T, W, decalage = [], [], [], 0
        for n in noms:
            p, t, w = self.corps(n)
            P.append(p)
            T.append(t + decalage)
            W.append(w)
            decalage += len(p)
        return porteur_de(np.concatenate(P), np.concatenate(T), np.concatenate(W))

    def matieres_publiees(self, id_, matieres):
        """Positions monde au repos, triangles des faces de `matieres` et poids (par os de la base) de l'élément publié
        `id_`, que la pièce contourne ; ses objets sont retirés de la scène ensuite."""
        avant = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(self.publies(id_)))
        nouveaux = [o for o in bpy.data.objects if o not in avant]
        P, T, W, n = [], [], [], 0
        for o in nouveaux:
            if o.type != 'MESH' or not o.data.materials:
                continue
            noms = [m.name.split('.')[0] if m else '' for m in o.data.materials]
            M = np.array(o.matrix_world)
            co = np.array([v.co[:] for v in o.data.vertices]) @ M[:3, :3].T + M[:3, 3]
            o.data.calc_loop_triangles()
            t = np.array([lt.vertices[:] for lt in o.data.loop_triangles if noms[lt.material_index] in matieres],
                         int).reshape(-1, 3)
            groupes = {g.index: self.indice_os[g.name] for g in o.vertex_groups if g.name in self.indice_os}
            w = np.zeros((len(co), len(self.os)))
            for v in o.data.vertices:
                for g in v.groups:
                    if g.group in groupes:
                        w[v.index, groupes[g.group]] = g.weight
            P.append(co)
            T.append(t + n)
            W.append(w)
            n += len(co)
        for o in nouveaux:
            bpy.data.objects.remove(o, do_unlink=True)
        if not n:
            raise ValueError(f'{id_} : aucune face de {matieres}')
        return np.concatenate(P), np.concatenate(T), np.concatenate(W)

    def coupe(self, zones, origine, normale, u, v, minimum=4):
        """Points de la coupe des arêtes des zones `zones` par le plan (`origine`, `normale`), en coordonnées (u, v)
        relatives à `origine`."""
        n0, n1, n2 = normale
        d = origine[0] * n0 + origine[1] * n1 + origine[2] * n2
        ou = origine[0] * u[0] + origine[1] * u[1] + origine[2] * u[2]
        ov = origine[0] * v[0] + origine[1] * v[1] + origine[2] * v[2]
        points = []
        for obj in (self.zones[z] for z in zones):
            for edge in obj.data.edges:
                a, b = [obj.matrix_world @ obj.data.vertices[i].co for i in edge.vertices]
                sa = a.x * n0 + a.y * n1 + a.z * n2
                sb = b.x * n0 + b.y * n1 + b.z * n2
                if (sa - d) * (sb - d) < 0:
                    p = a.lerp(b, (d - sa) / (sb - sa))
                    points.append((p.x * u[0] + p.y * u[1] + p.z * u[2] - ou, p.x * v[0] + p.y * v[1] + p.z * v[2] - ov))
        if len(points) < minimum:
            raise ValueError(f'coupe insuffisante au plan {tuple(origine)}, {tuple(normale)}')
        return np.array(points)

    def offrir(self, nom, w, point, axes):
        """Offre l'emplacement `nom` (`emplacements` du manifeste) : au repos, au `point` du repère Blender, d'axes `axes`
        (colonnes X, Y, Z du repère glTF de l'emplacement, en Blender), attaché à l'os qui pèse le plus dans les poids `w`
        (par os de la base, ceux de la pièce sous le point) dans son repère (`base/anatomie.py`, `attache`) ; il suit le
        mélange de ces os (`poids`) s'ils sont plusieurs."""
        w = np.asarray(w, dtype=float) / np.sum(w)
        os_ = self.os[int(np.argmax(w))]
        repere = Matrix.Translation(Vector(point)) @ Matrix([list(r) for r in np.array(axes).T]).to_4x4()
        poids = {self.os[k]: round(float(x), 4) for k, x in enumerate(w) if round(float(x), 4) > 0}
        self.emplacements[nom] = {'os': os_, **attache(self.rig.data.bones[os_].matrix_local, repere),
                                  **({'poids': poids} if len(poids) > 1 else {})}

    def nappe(self, nom, X, normales, W, orientes, mat, epaisseur):
        """La double nappe skinnée `nom` sur la nappe extérieure (positions `X`, `normales`, poids `W` par os de la base,
        triangles `orientes`), l'intérieure à `epaisseur` en retrait le long des normales."""
        return double_nappe(nom, X, normales, poids_normalises(W, self.os), orientes, mat, self.rig, epaisseur)

    def transferer(self, piece, zones, bornes=BORNES_DES_CLES, masques=()):
        """Silhouettes déclarées par la base et toutes ses clés `gabarit_*`, transférées sur `piece` depuis la copie
        jointe des zones `zones` qu'elle traverse, au plus près (`deplacer_au_plus_pres`) ; chaque `(masque, zones,
        publies)` de `masques` les reprend par liaison de surface, sur les sommets de son masque, de ses propres zones et
        des meshes des éléments publiés `publies` (`{id: zones de ses meshes}`) sur lesquels ils reposent, porteurs des
        mêmes clés : un pan suit le vêtement qu'il couvre, pas le corps dessous. Rend les noms des clés."""
        source = self._source(zones, {})
        noms_cles = [k.name for k in source.data.shape_keys.key_blocks if k != source.data.shape_keys.reference_key]
        manquantes = [s for s in self.manifeste['silhouettes'] if s not in noms_cles]
        if manquantes:
            raise ValueError(f'silhouettes absentes des zones porteuses : {manquantes}')
        cles = list(self.manifeste['silhouettes']) + [k for k in noms_cles if k.startswith('gabarit_')]
        reprises = []
        for masque, zones_du_masque, publies in masques:
            autre = self._source(zones_du_masque, publies)
            transferer_les_cles(autre, piece, cles)
            bpy.data.objects.remove(autre, do_unlink=True)
            reprises.append((np.asarray(masque)[:, None], {nom: decalages(piece, nom) for nom in cles}))
        deplacer_au_plus_pres(source, piece, cles)
        bpy.data.objects.remove(source, do_unlink=True)
        jumeaux = jumeaux_de(piece)
        for nom in cles:
            champ = decalages(piece, nom)
            for masque, champs in reprises:
                champ = np.where(masque, champs[nom], champ)
            poser_la_cle(piece, nom, champ[jumeaux])
        lisser_aux_aretes_fautives(piece, cles, bornes, jumeaux)
        return cles

    def _source(self, zones, publies):
        """Un objet : copie jointe des zones `zones` et des meshes des zones `publies[id]` de chaque élément publié."""
        copies = []
        for nom in zones:
            copie = self.zones[nom].copy()
            copie.data = self.zones[nom].data.copy()
            bpy.context.scene.collection.objects.link(copie)
            copies.append(copie)
        for id_, zones_publiees in publies.items():
            avant = set(bpy.data.objects)
            bpy.ops.import_scene.gltf(filepath=str(self.publies(id_)))
            nouveaux = [o for o in bpy.data.objects if o not in avant]
            gardes = [o for o in nouveaux if o.type == 'MESH' and o.get('zone') in zones_publiees]
            if not gardes:
                raise ValueError(f'{id_} : aucun mesh des zones {zones_publiees}')
            for o in gardes:
                o.modifiers.clear()
                monde = o.matrix_world.copy()
                o.parent = None
                o.matrix_world = monde
                copies.append(o)
            for o in nouveaux:
                if o not in gardes:
                    bpy.data.objects.remove(o, do_unlink=True)
        with bpy.context.temp_override(active_object=copies[0], selected_editable_objects=copies, object=copies[0]):
            bpy.ops.object.join()
        return copies[0]

    def zones_des_faces(self, piece):
        """Par face de `piece`, la zone de la base la plus proche de son centre au repos ; des zones à égalité
        (`EGALITE_DE_ZONE_M`), la première par nom."""
        noms = sorted(self.zones)
        arbres = [porteur_de(*self.corps(n))['arbre'] for n in noms]
        zones = []
        for p in piece.data.polygons:
            centre = piece.matrix_world @ p.center
            d = np.array([a.find_nearest(centre)[3] for a in arbres])
            zones.append(noms[int(np.flatnonzero(d <= d.min() + EGALITE_DE_ZONE_M)[0])])
        return zones

    def decouper_par_zone(self, piece):
        """La pièce découpée (`decouper`) en un objet par zone du corps (#2972) : chaque face va à la zone de la base la
        plus proche de son centre au repos ; chaque objet porte sa zone (`zone`, exportée en `extras.zone`). Rend les
        objets."""
        nom = piece.name
        objets = decouper(piece, self.zones_des_faces(piece))
        for z, o in objets:
            o['zone'] = z
            o.name = o.data.name = f'{nom}-{z}'
        return [o for _, o in objets]


def decouper(piece, parties):
    """La pièce découpée en un objet par valeur de `parties` (une par face) ; chaque objet garde les normales de la
    pièce entière, pour que la couture ne marque pas l'ombrage. Elles sont figées en normales
    libres (attribut de coin `custom_normal`), copiées au bit près : encodées dans les espaces de normale de Blender,
    elles se redécodaient, aux sommets que la découpe laisse en éventails disjoints, à quelques 1e-4 d'écart, fusionnés
    ou non par l'export glTF selon l'arrondi de la machine (#3865). Rend les couples (valeur, objet)."""
    me = piece.data
    normales = np.empty(len(me.loops) * 3, dtype=np.float32)
    me.corner_normals.foreach_get('vector', normales)
    if 'custom_normal' in me.attributes:
        me.attributes.remove(me.attributes['custom_normal'])
    me.attributes.new('custom_normal', 'FLOAT_VECTOR', 'CORNER').data.foreach_set('vector', normales)
    valeurs = sorted(set(parties))
    attribut = me.attributes.new('partie_de_la_face', 'INT', 'FACE')
    attribut.data.foreach_set('value', [valeurs.index(p) for p in parties])
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = piece
    piece.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for k in range(1, len(valeurs)):
        bm = bmesh.from_edit_mesh(piece.data)
        couche = bm.faces.layers.int['partie_de_la_face']
        for f in bm.faces:
            f.select_set(False)
        for f in bm.faces:
            if f[couche] == k:
                f.select_set(True)
        bmesh.update_edit_mesh(piece.data)
        bpy.ops.mesh.separate(type='SELECTED')
    bpy.ops.object.mode_set(mode='OBJECT')
    objets = []
    for o in bpy.context.selected_objects:
        if o.type == 'MESH':
            objets.append((valeurs[o.data.attributes['partie_de_la_face'].data[0].value], o))
            o.data.attributes.remove(o.data.attributes['partie_de_la_face'])
    return objets


def lambeaux(L, n):
    """La profondeur de chacune des `n` colonnes d'un bord en lambeaux `L` : une pointe sur deux, de 50 à 100 % de
    `profondeur`, l'autre un creux d'au plus `creux` fois la profondeur ; tirage déterministe, graine des codes de
    caractères de `graine` (procédure, section 6)."""
    tirage = random.Random(sum(ord(c) * (i + 1) for i, c in enumerate(L['graine'])))
    return [L['profondeur'] * (tirage.uniform(0.5, 1.0) if j % 2 == 0 else tirage.uniform(0.0, L['creux']))
            for j in range(n)]


def porteur_de(P, T, W):
    """Une surface porteuse : positions `P`, triangles `T`, poids `W` par os de la base et arbre de recherche."""
    return {'P': P, 'T': T, 'W': W, 'arbre': BVHTree.FromPolygons([tuple(p) for p in P], T.tolist(), all_triangles=True)}


def repere_de_plan(normale, haut, signe):
    """Repère (u, v) d'un plan de coupe : u, la projection de `haut` sur le plan ; v = signe·(normale × u), pour que
    les deux côtés d'un corps symétrique se lisent dans le même sens."""
    n = np.asarray(normale, dtype=float)
    u = np.asarray(haut, dtype=float) - (np.asarray(haut, dtype=float) @ n) * n
    u /= np.linalg.norm(u)
    return u, signe * np.cross(n, u)


def centre_de(P):
    """Centre de la boîte englobante d'une coupe."""
    return np.array([(P[:, 0].min() + P[:, 0].max()) / 2, (P[:, 1].min() + P[:, 1].max()) / 2])


def enveloppe_convexe(P):
    """Sommets de l'enveloppe convexe d'une coupe, dans le sens trigonométrique (chaîne monotone)."""
    pts = sorted(set(map(tuple, np.round(P, 9))))

    def tour(suite):
        h = []
        for p in suite:
            while len(h) >= 2 and (h[-1][0] - h[-2][0]) * (p[1] - h[-2][1]) - (h[-1][1] - h[-2][1]) * (p[0] - h[-2][0]) <= 0:
                h.pop()
            h.append(p)
        return h
    bas, haut = tour(pts), tour(reversed(pts))
    return np.array(bas[:-1] + haut[:-1])


def rayon_a_l_enveloppe(H, centre, d):
    """Distance de `centre` au bord de l'enveloppe convexe H le long de la direction unitaire d."""
    meilleur = 0.0
    for a, b in zip(H, np.roll(H, -1, axis=0)):
        e = b - a
        det = d[0] * e[1] - d[1] * e[0]
        if abs(det) < 1e-12:
            continue
        w = a - centre
        t = (w[0] * e[1] - w[1] * e[0]) / det
        s = (w[0] * d[1] - w[1] * d[0]) / det
        if -1e-9 <= s <= 1 + 1e-9 and t > meilleur:
            meilleur = t
    return meilleur


def anneau(P, centre, dirs, aisances, degagement, au_plus_pres=False):
    """Un point par direction : rayon de l'ellipse inscrite dans la boîte de la coupe ou appui de la coupe, le plus
    grand, plus l'aisance, jamais à moins de `degagement` de l'appui. `au_plus_pres` : rayon jusqu'au bord de
    l'enveloppe convexe de la coupe le long de la direction, plus la plus grande de l'aisance et du dégagement."""
    if au_plus_pres:
        H = enveloppe_convexe(P)
        return [centre + (rayon_a_l_enveloppe(H, centre, d) + max(e, degagement)) * d for d, e in zip(dirs, aisances)]
    hx = max((P[:, 0] - centre[0]).max(), (centre[0] - P[:, 0]).max(), 1e-3)
    hy = max((P[:, 1] - centre[1]).max(), (centre[1] - P[:, 1]).max(), 1e-3)
    pts = []
    for d, e in zip(dirs, aisances):
        r_ell = 1 / math.sqrt((d[0] / hx) ** 2 + (d[1] / hy) ** 2)
        s = float(((P - centre) @ d).max())
        pts.append(centre + max(max(r_ell, s) + e, s + degagement) * d)
    return pts


class Maillage:
    """Sommets (avec leur partie) et quads d'une nappe, chaque triangle orienté à l'opposé de son point de référence."""

    def __init__(self):
        self.sommets, self.parties, self.triangles, self.references = [], [], [], []

    def ajouter(self, points, partie):
        debut = len(self.sommets)
        for p in points:
            self.sommets.append(p)
            self.parties.append(partie)
        return list(range(debut, len(self.sommets)))

    def triangle(self, a, b, c, ref):
        self.triangles.append((a, b, c))
        self.references.append(ref)

    def quad(self, a, b, c, d, ref):
        self.triangles.extend([(a, b, c), (a, c, d)])
        self.references.extend([ref, ref])

    def bande(self, A, B, ref):
        """Relie deux anneaux fermés de même compte."""
        for i in range(len(A)):
            j = (i + 1) % len(A)
            self.quad(A[i], A[j], B[j], B[i], ref)

    def orienter(self):
        """Positions, triangles orientés et normales de sommet (moyenne des normales de face)."""
        X = np.array(self.sommets)
        normales = np.zeros_like(X)
        orientes = []
        for (a, b, c), ref in zip(self.triangles, self.references):
            nrm = np.cross(X[b] - X[a], X[c] - X[a])
            if nrm @ ((X[a] + X[b] + X[c]) / 3 - ref) < 0:
                a, b = b, a
                nrm = -nrm
            orientes.append((a, b, c))
            for v in (a, b, c):
                normales[v] += nrm
        normales /= np.linalg.norm(normales, axis=1, keepdims=True)
        return X, orientes, normales


def emprunter(p, porteur_):
    """Poids et distance du point le plus proche de la surface porteuse."""
    loc, _, face, dist = porteur_['arbre'].find_nearest(Vector(p.tolist()))
    if loc is None:
        raise ValueError(f'{p} sans surface porteuse')
    t = porteur_['T'][face]
    A, B, C = porteur_['P'][t]
    u, v, q = B - A, C - A, np.array(loc) - A
    uu, uv, vv, qu, qv = u @ u, u @ v, v @ v, q @ u, q @ v
    det = uu * vv - uv * uv
    beta, gamma = (vv * qu - uv * qv) / det, (uu * qv - uv * qu) / det
    bary = np.clip([1 - beta - gamma, beta, gamma], 0, 1)
    return (bary / bary.sum()) @ porteur_['W'][t], dist


def voisinage(orientes, n):
    voisins = [set() for _ in range(n)]
    for a, b, c in orientes:
        voisins[a].update((b, c))
        voisins[b].update((a, c))
        voisins[c].update((a, b))
    return [sorted(v) for v in voisins]


def lisser(W, voisinage_, passes):
    """Passes laplaciennes des poids sur le graphe de la pièce."""
    for _ in range(passes):
        W = 0.5 * W + 0.5 * np.array([W[v].mean(axis=0) for v in voisinage_])
    return W


def normalise(valeurs):
    """Les quatre plus fortes influences de `valeurs` `{os: poids}`, ramenées à une somme de 1."""
    gardees = sorted(((nom, v) for nom, v in valeurs.items() if v > 1e-8), key=lambda e: e[1], reverse=True)[:4]
    total = sum(v for _, v in gardees)
    return {nom: v / total for nom, v in gardees}


def poids_normalises(W, os_):
    return [normalise({os_[k]: float(w[k]) for k in np.flatnonzero(w > 1e-6)}) for w in W]


def maillage_skinne(nom, sommets, faces, mat, rig, poids):
    """Le mesh `nom` enfant de `rig`, aux groupes de sommets `poids` (`{os: poids}` par sommet) et au modificateur
    d'armature."""
    data = bpy.data.meshes.new(nom)
    data.from_pydata(sommets, [], faces)
    data.update()
    obj = bpy.data.objects.new(nom, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    obj.parent = rig
    obj.matrix_parent_inverse = rig.matrix_world.inverted()
    for os_ in sorted({k for p in poids for k in p}):
        groupe = obj.vertex_groups.new(name=os_)
        for i, valeurs in enumerate(poids):
            if valeurs.get(os_, 0) > 0:
                groupe.add([i], valeurs[os_], 'REPLACE')
    obj.modifiers.new('Squelette commun', 'ARMATURE').object = rig
    return obj


def double_nappe(nom, X, normales, poids, triangles, mat, rig, epaisseur):
    """Deux nappes et leurs bords : chaque sommet porté par plusieurs éventails de triangles est dédoublé par éventail,
    la nappe intérieure est la copie retournée à `epaisseur` le long des normales, chaque arête de bord est fermée ;
    normales recalculées vers l'extérieur. Nappes et bords sont lisses chacun de son côté d'une arête vive : les coins d'un
    sommet sur une même face d'un côté portent la même normale au bit près, que l'export glTF fusionne quel que soit
    l'arrondi de la machine ; à plat, les faces presque coplanaires d'un bord donnaient des normales à quelques 1e-5,
    fusionnées ou non selon leur arrondi à 4 décimales (#3865)."""
    points = [Vector(p.tolist()) for p in X]
    normales = [Vector(n.tolist()) for n in normales]
    poids = list(poids)
    triangles = [tuple(t) for t in triangles]
    for sommet in range(len(points)):
        incidents = {i for i, t in enumerate(triangles) if sommet in t}
        eventails = []
        while incidents:
            eventail, a_voir = set(), {min(incidents)}
            while a_voir:
                i = a_voir.pop()
                if i in eventail:
                    continue
                eventail.add(i)
                a_voir.update(j for j in incidents - eventail if len(set(triangles[i]) & set(triangles[j])) >= 2)
            incidents.difference_update(eventail)
            eventails.append(eventail)
        for eventail in eventails[1:]:
            double = len(points)
            points.append(points[sommet].copy())
            normales.append(normales[sommet].copy())
            poids.append(dict(poids[sommet]))
            for i in eventail:
                triangles[i] = tuple(double if s == sommet else s for s in triangles[i])
    moitie = len(points)
    faces, sortes, aretes = [], [], {}
    for t in triangles:
        faces.extend((t, tuple(moitie + i for i in reversed(t))))
        sortes.extend((0, 1))
        for a, b in zip(t, t[1:] + t[:1]):
            arete = tuple(sorted((a, b)))
            aretes[arete] = aretes.get(arete, 0) + 1
    if max(aretes.values()) > 2:
        raise ValueError(f'{nom} : nappe non manifold')
    for (a, b), compte in aretes.items():
        if compte == 1:
            faces.extend(((a, moitie + a, moitie + b), (a, moitie + b, b)))
            sortes.extend((2, 2))
    obj = maillage_skinne(nom, points + [p - n * epaisseur for p, n in zip(points, normales)], faces, mat, rig,
                          poids + poids)
    obj.data.attributes.new(JUMEAU, 'INT', 'POINT').data.foreach_set('value', [0] * moitie + [-moitie] * moitie)
    obj.data.materials.append(mat)
    obj.data.materials.append(mat)
    for polygone, sorte in zip(obj.data.polygons, sortes):
        polygone.material_index = sorte
        polygone.use_smooth = True
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    for arete in bm.edges:
        arete.smooth = len({f.material_index == 2 for f in arete.link_faces}) == 1
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    return obj


def deplacer_au_plus_pres(source, cible, noms):
    """Pose sur `cible` chaque shape key `noms` de `source` : le décalage, sous la clé, du point de `source` le plus
    proche de chaque sommet au repos, interpolé dans son triangle. Une liaison de surface tourne l'écart d'un sommet au
    corps avec la normale du corps : la couture d'épaule de la robe, à 3 cm au-dessus de l'épaule, rentrait de 2,6 cm
    sous `carrure_plus` quand le corps dessous bougeait de moins d'1 cm, et passait devant la bandoulière (30 mm,
    Hampe_Attaque). Sur un élément publié, qui ponte les creux du corps, le point le plus proche saute d'une paroi à
    l'autre : `transferer_les_cles` y reste (masques de `Base.transferer`)."""
    Ms, Mc = np.array(source.matrix_world), np.array(cible.matrix_world)
    source.data.calc_loop_triangles()
    T = np.array([t.vertices[:] for t in source.data.loop_triangles])
    Xs = np.array([v.co[:] for v in source.data.vertices]) @ Ms[:3, :3].T + Ms[:3, 3]
    arbre = BVHTree.FromPolygons([tuple(p) for p in Xs], T.tolist(), all_triangles=True)
    Xc = np.array([v.co[:] for v in cible.data.vertices]) @ Mc[:3, :3].T + Mc[:3, 3]
    idx, bary = [], []
    for p in Xc:
        loc, _, f, _ = arbre.find_nearest(Vector(p.tolist()))
        a, b, c = Xs[T[f]]
        v0, v1, v2 = b - a, c - a, np.array(loc) - a
        d00, d01, d11, d20, d21 = v0 @ v0, v0 @ v1, v1 @ v1, v2 @ v0, v2 @ v1
        den = d00 * d11 - d01 * d01
        bv = (d11 * d20 - d01 * d21) / den
        bw = (d00 * d21 - d01 * d20) / den
        idx.append(T[f]); bary.append((1 - bv - bw, bv, bw))
    idx, bary = np.array(idx), np.array(bary)
    inv = np.linalg.inv(Mc[:3, :3])
    for nom in noms:
        d = decalages(source, nom) @ Ms[:3, :3].T
        poser_la_cle(cible, nom, (d[idx] * bary[:, :, None]).sum(1) @ inv.T)


JUMEAU = 'jumeau'
"""Attribut de sommet d'une double nappe : l'écart d'indice d'un sommet de la nappe intérieure à son jumeau de la
nappe extérieure (0 sur celle-ci). Il survit à `joindre`, qui garde l'ordre des sommets de chaque objet ; un sommet sans
lui (mesh joint d'une autre source) vaut 0, son propre jumeau."""


def jumeaux_de(piece):
    """Par sommet de `piece`, l'indice de son jumeau extérieur, dont la nappe intérieure prend les clés : liées chacune au
    plus près, les deux nappes d'un bord, à `epaisseur` l'une de l'autre, divergeaient de centimètres là où la surface
    porteuse se creuse (entrejambe, nuque), et le lissage de leur arête de bord s'étendait à toute la pièce (robe r25 :
    40 anneaux, 356 nœuds sous `carrure_plus`). L'attribut est retiré : il ne sert qu'au transfert."""
    attribut = piece.data.attributes[JUMEAU]
    ecarts = np.zeros(len(piece.data.vertices), dtype=np.int64)
    attribut.data.foreach_get('value', ecarts)
    piece.data.attributes.remove(attribut)
    return np.arange(len(ecarts)) + ecarts


def joindre(objets):
    """Un seul objet (matériaux, groupes de sommets et modificateur du premier conservés)."""
    if len(objets) == 1:
        return objets[0]
    with bpy.context.temp_override(active_object=objets[0], selected_editable_objects=objets, object=objets[0]):
        bpy.ops.object.join()
    return objets[0]


def lisser_aux_aretes_fautives(piece, cles, bornes, jumeaux, passes_max=400):
    """Chaque clé transférée dont une arête sort de `bornes` est lissée (moyenne laplacienne des décalages sur le graphe
    de la pièce) aux seuls nœuds de ces arêtes, puis de leurs anneaux quand une passe ne réduit plus le défaut : un
    sommet qui ponte un creux du corps (entrejambe) ou deux nappes liées à des faces différentes suivent la moyenne de
    leurs voisins au lieu de s'écarter. Une arête que la clé retourne (sens opposé au repos) est fautive quelle que soit
    sa longueur. Ailleurs la clé reste la liaison de surface. Chaque nœud de la nappe intérieure garde, à chaque passe, le
    décalage de son jumeau extérieur (`jumeaux`, par sommet)."""
    x = np.array([v.co[:] for v in piece.data.vertices])
    _, premier, noeud = np.unique(np.round(x * 1e5).astype(np.int64), axis=0, return_index=True, return_inverse=True)
    noeud = noeud.ravel()
    xn = x[premier]
    jumeau = noeud[jumeaux[premier]]
    aretes = aretes_des_triangles(piece, noeud)
    voisins = [[] for _ in range(len(xn))]
    for a, b in aretes:
        voisins[a].append(b)
        voisins[b].append(a)
    bas, haut = bornes
    for nom in cles:
        champ = aux_noeuds(decalages(piece, nom), noeud)
        anneaux, pire, passe = 0, None, 0
        while passe < passes_max:
            r, retournees = rapports(xn, champ, aretes), retournees_par(xn, champ, aretes)
            fautives = (r < bas) | (r > haut) | retournees
            if not fautives.any():
                break
            ecart = int(retournees.sum()) + float(np.maximum(bas / r.min(), r.max() / haut))
            if pire is not None and ecart > pire - 1e-3:
                anneaux += 1
            pire = ecart
            dans = np.flatnonzero(region_locale(aretes, fautives, anneaux, len(xn)))
            champ[dans] = 0.5 * champ[dans] + 0.5 * np.array([champ[voisins[i]].mean(axis=0) for i in dans])
            champ = champ[jumeau]
            passe += 1
        r = rapports(xn, champ, aretes)
        reste = int(((r < bas) | (r > haut) | retournees_par(xn, champ, aretes)).sum())
        if reste:
            raise ValueError(f'{piece.name} {nom} : {reste} arête(s) hors {bornes} ou retournée(s) après {passe} passes de lissage')
        poser_la_cle(piece, nom, champ[noeud])
