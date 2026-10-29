"""Silhouette `corpulence` de la base humanoïde (#3101, décision 2) : le delta de poids max de MakeHuman, transféré au
corps UBC par la liaison à un donneur filtrée par os (`formes.lier`).

Donneur : `3dobjs/base.obj` (corps seul, groupe `body`) chargé des cibles `macrodetails` d'un homme jeune très musclé
(`targetservice.py` `calculate_target_stack_from_macro_info_dict`) ; la clé est la différence entre l'état poids max et
l'état poids moyen, à genre, âge et muscle fixés. Pose commune : celle du donneur. Le donneur est mis à l'échelle et
recalé sur le tronc du squelette au repos par moindres carrés ; chaque os des membres du corps UBC prend, par son
armature, la position, la direction et la longueur des articulations MakeHuman (groupes `joint-*` de `base.obj`). Le
corps se pose par le skin linéaire aux poids de l'export (`poids.peau_lineaire`) et chaque sommet se lie au donneur :
l'os dominant d'une face du donneur est celui de ses sommets aux poids du rig `game_engine` de MPFB, dont les os portent
les noms d'UAL (`OS_DU_DONNEUR`). Le delta lu au point lié revient au repos par l'inverse de ce même skin, sommet par
sommet ; le lissage de la clé et ses extrémités invariantes sont ceux de toutes les silhouettes
(`silhouettes.finir_les_silhouettes`).
"""
import gzip
import json
from pathlib import Path

import numpy as np

from animation import clear_animation
from formes import lier, poser_la_cle, transporter, voisins
from poids import deformer, peau_lineaire, repos as inverses_du_repos

SOMMETS_DU_CORPS = 13380
"""Sommets du corps de `base.obj`, avant les helpers."""
RACES = ('african', 'asian', 'caucasian')
"""Races de `macro.json` ; MPFB les mélange à parts égales par défaut (`get_default_macro_info_dict`)."""
ETAT = 'male-young-maxmuscle'
"""Genre, âge et muscle du donneur : le corps UBC est un homme jeune très musclé (« Superhero »)."""
REFERENCE, POIDS_MAX = 'averageweight', 'maxweight'
NOM = 'corpulence'
OS_DU_DONNEUR = 'game_engine'
"""Le rig MPFB (`rigs/standard/weights.<rig>.json`) dont les os nomment ceux d'UAL, à la casse près."""
ECART_MAX = 1e-4
"""Écart maximal (m) entre le corps posé portant la clé et le déplacement lié (inverse du skin)."""

RECALAGE = (('joint-l-upper-leg', 'thigh_l'), ('joint-r-upper-leg', 'thigh_r'), ('joint-l-shoulder', 'upperarm_l'),
            ('joint-r-shoulder', 'upperarm_r'), ('joint-neck', 'neck_01'), ('joint-head', 'Head'))
"""Articulations MakeHuman et têtes d'os UBC qui fixent échelle et translation : tronc seul, que la pose ne bouge pas."""
DOIGTS = (('1', 'thumb'), ('2', 'index'), ('3', 'middle'), ('4', 'ring'), ('5', 'pinky'))


def alignements(cote):
    """`(os, os d'arrivée, articulation de départ, articulation d'arrivée, torsion)` du côté `l` ou `r`, dans l'ordre
    de la hiérarchie : l'os tourne pour que sa tête vers la tête de l'os d'arrivée prenne la direction des deux
    articulations ; `torsion`, s'il y en a une, est une seconde paire (os, os, articulation, articulation) qui fixe le
    roulis autour de cette direction."""
    j = f'joint-{cote}-'
    paume = (f'index_01_{cote}', f'pinky_01_{cote}', f'{j}finger-2-1', f'{j}finger-5-1')
    liste = [(f'clavicle_{cote}', f'upperarm_{cote}', f'{j}clavicle', f'{j}shoulder', None),
             (f'upperarm_{cote}', f'lowerarm_{cote}', f'{j}shoulder', f'{j}elbow', None),
             (f'lowerarm_{cote}', f'hand_{cote}', f'{j}elbow', f'{j}hand', None),
             (f'hand_{cote}', f'middle_01_{cote}', f'{j}hand', f'{j}finger-3-1', paume)]
    for numero, doigt in DOIGTS:
        for phalange in (1, 2, 3):
            fin = f'{doigt}_0{phalange + 1}_{cote}' if phalange < 3 else f'{doigt}_04_leaf_{cote}'
            liste.append((f'{doigt}_0{phalange}_{cote}', fin, f'{j}finger-{numero}-{phalange}',
                          f'{j}finger-{numero}-{phalange + 1}', None))
    liste += [(f'thigh_{cote}', f'calf_{cote}', f'{j}upper-leg', f'{j}knee', None),
              (f'calf_{cote}', f'foot_{cote}', f'{j}knee', f'{j}ankle', None)]
    return liste


def lire_obj(chemin):
    """Sommets (repère MakeHuman, Y en haut), faces du groupe `body`, et sommets de chaque groupe `joint-*`."""
    sommets, faces, joints, groupe = [], [], {}, None
    with open(chemin, encoding='utf-8') as fichier:
        for ligne in fichier:
            if ligne.startswith('v '):
                sommets.append([float(x) for x in ligne.split()[1:4]])
            elif ligne.startswith('g '):
                groupe = ligne.split(None, 1)[1].strip()
            elif ligne.startswith('f '):
                face = [int(t.split('/')[0]) - 1 for t in ligne.split()[1:]]
                if groupe == 'body':
                    faces.append(face)
                elif groupe and groupe.startswith('joint-'):
                    joints.setdefault(groupe, set()).update(face)
    if any(i >= SOMMETS_DU_CORPS for f in faces for i in f):
        raise RuntimeError(f'{chemin} : une face du groupe body passe le sommet {SOMMETS_DU_CORPS}')
    return np.array(sommets), faces, {nom: sorted(s) for nom, s in joints.items()}


def lire_cible(chemin, taille):
    """Les déplacements d'un `.target.gz` (lignes `indice dx dy dz`, repère MakeHuman) sur `taille` sommets."""
    delta = np.zeros((taille, 3))
    with gzip.open(chemin, 'rt', encoding='utf-8') as fichier:
        for ligne in fichier:
            champs = ligne.split()
            if len(champs) == 4 and not ligne.startswith('#'):
                delta[int(champs[0])] = [float(x) for x in champs[1:]]
    return delta


def vers_blender(points):
    """Repère MakeHuman (Y en haut) vers Blender (Z en haut) : `targetservice.py` `_target_string_to_shape_key_info`."""
    return np.stack([points[:, 0], -points[:, 2], points[:, 1]], axis=1)


def donneur(mpfb):
    """`(référence, poids max, triangles, joints)` du donneur, en repère Blender et unités MakeHuman ; ses quads sont
    coupés en triangles ; `joints` donne le centre de chaque groupe `joint-*` à la référence."""
    macro = Path(mpfb) / 'targets' / 'macrodetails'
    sommets, faces, groupes = lire_obj(Path(mpfb) / '3dobjs' / 'base.obj')
    taille = len(sommets)
    reference = sommets + sum(lire_cible(macro / f'{r}-male-young.target.gz', taille) for r in RACES) / len(RACES)
    reference = reference + lire_cible(macro / f'universal-{ETAT}-{REFERENCE}.target.gz', taille)
    poids_max = reference + lire_cible(macro / f'universal-{ETAT}-{POIDS_MAX}.target.gz', taille) \
        - lire_cible(macro / f'universal-{ETAT}-{REFERENCE}.target.gz', taille)
    reference, poids_max = vers_blender(reference), vers_blender(poids_max)
    joints = {nom: reference[indices].mean(axis=0) for nom, indices in groupes.items()}
    triangles = np.array([t for a, b, c, d in faces for t in ((a, b, c), (a, c, d))])
    return reference[:SOMMETS_DU_CORPS], poids_max[:SOMMETS_DU_CORPS], triangles, joints


def os_des_faces(mpfb, noms, triangles):
    """Par triangle du donneur, l'indice dans `noms` de son os dominant : l'os le plus fréquent parmi les os dominants
    de ses sommets, aux poids du rig `OS_DU_DONNEUR`."""
    chemin = Path(mpfb) / 'rigs' / 'standard' / f'weights.{OS_DU_DONNEUR}.json'
    poids = json.loads(chemin.read_text(encoding='utf-8'))['weights']
    index = {n.lower(): i for i, n in enumerate(noms)}
    if set(o.lower() for o in poids) - index.keys():
        raise RuntimeError(f'{chemin} : os hors du squelette {sorted(set(o.lower() for o in poids) - index.keys())}')
    w = np.zeros((SOMMETS_DU_CORPS, len(noms)))
    for os_, liste in poids.items():
        for i, p in liste:
            if i < SOMMETS_DU_CORPS:
                w[i, index[os_.lower()]] = max(w[i, index[os_.lower()]], p)
    if not w[np.unique(triangles)].sum(axis=1).all():
        raise RuntimeError(f'{chemin} : sommet du corps du donneur sans poids')
    dominants = w.argmax(axis=1)
    return np.array([np.bincount(dominants[t], minlength=len(noms)).argmax() for t in triangles])


def tetes(squelette):
    """Tête de chaque os de `squelette`, posée, en repère monde."""
    return {pb.name: np.array(squelette.matrix_world @ pb.head) for pb in squelette.pose.bones}


def recalage(joints, os):
    """`(échelle, translation)` des moindres carrés qui portent les articulations de `RECALAGE` sur leurs os."""
    m = np.array([joints[a] for a, _ in RECALAGE])
    u = np.array([os[b] for _, b in RECALAGE])
    mc, uc = m - m.mean(axis=0), u - u.mean(axis=0)
    echelle = float((mc * uc).sum() / (mc * mc).sum())
    return echelle, u.mean(axis=0) - echelle * m.mean(axis=0)


def transformer(bpy, squelette, nom, transformation):
    """Applique la transformation monde `transformation` (4x4, autour de l'origine) à l'os `nom`."""
    pb = squelette.pose.bones[nom]
    monde = squelette.matrix_world
    pb.matrix = monde.inverted() @ transformation @ monde @ pb.matrix
    bpy.context.view_layer.update()


def autour(point, lineaire):
    """La transformation 4x4 de partie linéaire `lineaire` (3x3) qui fixe `point`."""
    from mathutils import Matrix
    return Matrix.Translation(point) @ lineaire.to_4x4() @ Matrix.Translation(-point)


def poser_comme_le_donneur(bpy, squelette, joints):
    """Pose les membres de `squelette` sur les articulations `joints` (repère monde, recalées) : chaque os porte sa
    tête sur son articulation de départ, tourne vers l'articulation d'arrivée et s'étire à sa longueur. L'étirement ne
    passe pas aux enfants : rend l'`inherit_scale` d'origine des os, que remet `rendre_l_heritage`."""
    from mathutils import Matrix, Vector
    heritage = {b.name: b.inherit_scale for b in squelette.data.bones}
    for b in squelette.data.bones:
        b.inherit_scale = 'NONE'
    for cote in ('l', 'r'):
        for os, fin, depart, arrivee, torsion in alignements(cote):
            tete = Vector(tetes(squelette)[os])
            transformer(bpy, squelette, os, Matrix.Translation(Vector(joints[depart]) - tete))
            os_ = tetes(squelette)
            tete, v, w = Vector(os_[os]), Vector(os_[fin] - os_[os]), Vector(joints[arrivee] - joints[depart])
            transformer(bpy, squelette, os, autour(tete, v.rotation_difference(w).to_matrix()))
            axe = w.normalized()
            if torsion:
                a, b, ja, jb = torsion
                os_ = tetes(squelette)
                v2, w2 = Vector(os_[b] - os_[a]), Vector(joints[jb] - joints[ja])
                v2, w2 = v2 - axe * v2.dot(axe), w2 - axe * w2.dot(axe)
                transformer(bpy, squelette, os, autour(tete, v2.rotation_difference(w2).to_matrix()))
            longueur = Vector(tetes(squelette)[fin]) - tete
            k = w.length / longueur.length - 1
            etirement = Matrix([[float(i == j) + k * axe[i] * axe[j] for j in range(3)] for i in range(3)])
            transformer(bpy, squelette, os, autour(tete, etirement))
    return heritage


def rendre_l_heritage(bpy, squelette, heritage):
    """Remet `squelette` au repos et son `inherit_scale` d'origine."""
    for b in squelette.data.bones:
        b.inherit_scale = heritage[b.name]
    clear_animation(squelette)
    bpy.context.view_layer.update()


def peau_de_la_pose(squelette):
    """Par os de `squelette`, dans l'ordre de `squelette.data.bones`, sa matrice de peau à la pose courante, repère
    monde : (os, 4, 4)."""
    poses = np.array([squelette.matrix_world @ squelette.pose.bones[b.name].matrix for b in squelette.data.bones])
    return poses @ inverses_du_repos(squelette).astype(np.float64)


def ajouter_corpulence(squelette, corps, mpfb: Path) -> None:
    """Pose sur `corps` (skinné à `squelette`, au repos) la shape key `corpulence` : le delta de poids max de
    MakeHuman, lu au point lié au donneur (`formes.lier`) dans la pose du donneur, ramené au repos par l'inverse du
    skin."""
    import bpy
    noms = [b.name for b in squelette.data.bones]
    x, w = peau_lineaire(corps, noms)
    x, w = x.astype(np.float64), w.astype(np.float64)
    reference, poids_max, faces, joints = donneur(mpfb)
    echelle, translation = recalage(joints, tetes(squelette))
    reference, poids_max = reference * echelle + translation, poids_max * echelle + translation
    joints = {nom: p * echelle + translation for nom, p in joints.items()}
    heritage = poser_comme_le_donneur(bpy, squelette, joints)
    peau = peau_de_la_pose(squelette)
    rendre_l_heritage(bpy, squelette, heritage)
    posees = deformer(w, x, peau[None])[0]
    face, barycentres, distances = lier(posees, w.argmax(axis=1), reference, faces, os_des_faces(mpfb, noms, faces),
                                        voisins(squelette, noms))
    pire = int(distances.argmax())
    print('CORPULENCE recalage', round(echelle, 6), 'liaison (m) médiane', round(float(np.median(distances)), 4),
          'p99', round(float(np.percentile(distances, 99)), 4), 'max', round(float(distances[pire]), 4), 'sommet', pire,
          flush=True)

    deplacement = transporter(poids_max - reference, faces, face, barycentres)

    skin = np.einsum('sb,bij->sij', w, peau[:, :3, :3])
    repos = np.linalg.solve(skin, deplacement[..., None])[..., 0]
    porte = x.copy()
    porte[:, :3] += repos
    ecart = float(np.abs(deformer(w, porte, peau[None])[0] - posees - deplacement).max())
    if ecart > ECART_MAX:
        raise RuntimeError(f'corpulence : clé posée à {ecart:.2e} m du déplacement lié (> {ECART_MAX})')
    poser_la_cle(corps, NOM, repos @ np.array(corps.matrix_world.inverted().to_3x3()).T)
    amplitude = np.linalg.norm(repos, axis=1)
    print('CORPULENCE clé posée : amplitude max', round(float(amplitude.max()), 4), 'm, moyenne',
          round(float(amplitude.mean()), 4), 'm, écart du skin', f'{ecart:.1e}', flush=True)
