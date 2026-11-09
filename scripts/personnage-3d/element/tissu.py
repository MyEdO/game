"""Pièce skinnée sur une base (#3743) : ce qu'un vêtement emprunte à la base au repos, pour le `modele.py` d'un élément
de liaison `squelette` que bâtit `element/construire.py`.

`Base` ouvre la base au repos avec ses zones (un mesh par zone, `extras.zone`) : repères d'os, surfaces porteuses
(positions, triangles, poids par os), coupes planes des zones, éléments publiés qu'une pièce contourne, transfert des
silhouettes et des clés `gabarit_*` par liaison de surface, découpe de la pièce par zone. Le reste se compose dans le
modèle : un anneau à aisance sur une coupe (`anneau`), un maillage par anneaux orienté vers l'extérieur (`Maillage`),
des poids empruntés (`emprunter`) puis lissés (`lisser`), une double nappe (`nappe`).
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

from formes import aretes_des_triangles, aux_noeuds, decalages, poser_la_cle, rapports, region_locale, retournees_par, transferer_les_cles

BORNES_DES_CLES = (0.4, 2.5)
"""Rapport de longueur d'arête sous une clé transférée (clé / repos) hors duquel `Base.transferer` lisse la clé : marge
prise sur la porte d'étirement de l'évaluateur ([0,25 ; 4]). Une pièce longue (robe jusqu'aux chevilles) suit le bas de
jambe tassé sous `gabarit_legs_moins` et passe les siennes : le lissage, qui ne réduit pas un tassement uniforme,
s'étendrait sinon à toute la pièce et la décollerait du corps (`suiviDuCorps/cle-non-suivie`)."""


class Base:
    """La base `glb` au repos, son manifeste `manifeste`, ses zones de peau (un mesh par zone, de la surface de palette
    `peau` : les sourcils et les yeux portent aussi une zone) ; `publies(id)` rend le GLB d'un élément publié."""

    def __init__(self, glb, manifeste, publies):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(glb))
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

    def exiger(self, noms):
        absentes = [z for z in noms if z not in self.zones]
        if absentes:
            raise ValueError(f'zones absentes de la base : {absentes}')

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

    def nappe(self, nom, X, normales, W, orientes, mat, epaisseur):
        """La double nappe skinnée `nom` sur la nappe extérieure (positions `X`, `normales`, poids `W` par os de la base,
        triangles `orientes`), l'intérieure à `epaisseur` en retrait le long des normales."""
        return double_nappe(nom, X, normales, poids_normalises(W, self.os), orientes, mat, self.rig, epaisseur)

    def transferer(self, piece, zones, bornes=BORNES_DES_CLES, publies=None):
        """Silhouettes déclarées par la base et toutes ses clés `gabarit_*`, transférées sur `piece` par liaison de
        surface depuis la copie jointe des zones `zones` qu'elle traverse et des meshes des éléments publiés `publies`
        (`{id: zones de ses meshes}`) sur lesquels elle repose, porteurs des mêmes clés : la pièce y suit le vêtement,
        pas le corps dessous ; rend les noms des clés."""
        copies = []
        for nom in zones:
            copie = self.zones[nom].copy()
            copie.data = self.zones[nom].data.copy()
            bpy.context.scene.collection.objects.link(copie)
            copies.append(copie)
        importes = []
        for id_, zones_publiees in (publies or {}).items():
            avant = set(bpy.data.objects)
            bpy.ops.import_scene.gltf(filepath=str(self.publies(id_)))
            nouveaux = [o for o in bpy.data.objects if o not in avant]
            gardes = [o for o in nouveaux if o.type == 'MESH' and o.get('zone') in zones_publiees]
            if not gardes:
                raise ValueError(f'{id_} : aucun mesh des zones {zones_publiees}')
            importes += [o for o in nouveaux if o not in gardes]
            for o in gardes:
                o.modifiers.clear()
                monde = o.matrix_world.copy()
                o.parent = None
                o.matrix_world = monde
                copies.append(o)
        with bpy.context.temp_override(active_object=copies[0], selected_editable_objects=copies, object=copies[0]):
            bpy.ops.object.join()
        source = copies[0]
        noms_cles = [k.name for k in source.data.shape_keys.key_blocks if k != source.data.shape_keys.reference_key]
        manquantes = [s for s in self.manifeste['silhouettes'] if s not in noms_cles]
        if manquantes:
            raise ValueError(f'silhouettes absentes des zones porteuses : {manquantes}')
        cles = list(self.manifeste['silhouettes']) + [k for k in noms_cles if k.startswith('gabarit_')]
        transferer_les_cles(source, piece, cles)
        for o in [source, *importes]:
            bpy.data.objects.remove(o, do_unlink=True)
        lisser_aux_aretes_fautives(piece, cles, bornes)
        return cles

    def decouper_par_zone(self, piece):
        """La pièce découpée en un objet par zone du corps (#2972) : chaque face va à la zone de la base la plus proche
        de son centre au repos ; chaque objet porte sa zone (`zone`, exportée en `extras.zone`) et garde les normales
        de la pièce entière, pour que la couture ne marque pas l'ombrage. Rend les objets."""
        noms = sorted(self.zones)
        sup = self.porteur(noms)
        bornes = np.cumsum([len(self.corps(n)[1]) for n in noms])
        me = piece.data
        me.normals_split_custom_set([tuple(n.vector) for n in me.corner_normals])
        attribut = me.attributes.new('zone_de_la_face', 'INT', 'FACE')
        for p in me.polygons:
            face = sup['arbre'].find_nearest(piece.matrix_world @ p.center)[2]
            attribut.data[p.index].value = int(np.searchsorted(bornes, face, side='right'))
        bpy.ops.object.select_all(action='DESELECT')
        bpy.context.view_layer.objects.active = piece
        piece.select_set(True)
        restantes = sorted({d.value for d in attribut.data})
        bpy.ops.object.mode_set(mode='EDIT')
        for z in restantes[1:]:
            bm = bmesh.from_edit_mesh(piece.data)
            couche = bm.faces.layers.int['zone_de_la_face']
            for f in bm.faces:
                f.select_set(False)
            for f in bm.faces:
                if f[couche] == z:
                    f.select_set(True)
            bmesh.update_edit_mesh(piece.data)
            bpy.ops.mesh.separate(type='SELECTED')
        bpy.ops.object.mode_set(mode='OBJECT')
        objets = [o for o in bpy.context.selected_objects if o.type == 'MESH']
        nom = piece.name
        for o in objets:
            z = noms[o.data.attributes['zone_de_la_face'].data[0].value]
            o.data.attributes.remove(o.data.attributes['zone_de_la_face'])
            o['zone'] = z
            o.name = o.data.name = f'{nom}-{z}'
        return objets


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
    nappes lisses, bords à plat, normales recalculées vers l'extérieur."""
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
    obj.data.materials.append(mat)
    obj.data.materials.append(mat)
    for polygone, sorte in zip(obj.data.polygons, sortes):
        polygone.material_index = sorte
        polygone.use_smooth = sorte != 2
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    return obj


def joindre(objets):
    """Un seul objet (matériaux, groupes de sommets et modificateur du premier conservés)."""
    if len(objets) == 1:
        return objets[0]
    with bpy.context.temp_override(active_object=objets[0], selected_editable_objects=objets, object=objets[0]):
        bpy.ops.object.join()
    return objets[0]


def lisser_aux_aretes_fautives(piece, cles, bornes, passes_max=400):
    """Chaque clé transférée dont une arête sort de `bornes` est lissée (moyenne laplacienne des décalages sur le graphe
    de la pièce) aux seuls nœuds de ces arêtes, puis de leurs anneaux quand une passe ne réduit plus le défaut : un
    sommet qui ponte un creux du corps (entrejambe) ou deux nappes liées à des faces différentes suivent la moyenne de
    leurs voisins au lieu de s'écarter. Une arête que la clé retourne (sens opposé au repos) est fautive quelle que soit
    sa longueur. Ailleurs la clé reste la liaison de surface."""
    x = np.array([v.co[:] for v in piece.data.vertices])
    _, premier, noeud = np.unique(np.round(x * 1e5).astype(np.int64), axis=0, return_index=True, return_inverse=True)
    noeud = noeud.ravel()
    xn = x[premier]
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
            passe += 1
        r = rapports(xn, champ, aretes)
        reste = int(((r < bas) | (r > haut) | retournees_par(xn, champ, aretes)).sum())
        if reste:
            raise ValueError(f'{piece.name} {nom} : {reste} arête(s) hors {bornes} ou retournée(s) après {passe} passes de lissage')
        poser_la_cle(piece, nom, champ[noeud])
