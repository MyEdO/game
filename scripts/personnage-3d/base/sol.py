"""Les clips de la base humanoïde au sol (#3098, porte L1 de #2972). Un clip se joue relatif au repos (`humanoide.py`) :
le corps UBC, d'autres proportions et un autre repos que le mannequin UAL qui porte le clip, ne pose pas ses pieds où ce
mannequin pose les siens. À chaque instant de l'évaluateur (`poids.instants`), en skinning linéaire (`poids.deformer`) :
- le pelvis monte ou descend de l'écart entre le sommet le plus bas du mannequin source et celui du corps, puis monte de
  ce qui reste sous le sol hors des pieds ;
- un pied sous le sol remonte au sol par IK de jambe, son orientation gardée (`tendre`) ;
- un pied de clip de marche suit, pendant l'appui, un sommet de contact fixe dans le monde à une vitesse au sol commune
  aux deux pieds, puis rejoint le clip pendant l'envol par un décalage interpolé (`planter`). L'appui, la direction, le
  sommet de contact et la vitesse se mesurent comme `hotes/godot/asset/evaluateur/gardes/appuis.ts` ;
- le pelvis descend là où un pied décalé sortirait de l'allonge que le clip donne à sa jambe (`descente_a_portee`).

Un clip dont le pelvis source passe sous le sol n'a pas de sol à tenir : il se retire de la base (`retirer_sans_sol`).
"""
import math

import bpy
import numpy
from mathutils import Matrix, Quaternion, Vector

from animation import assign_action
from poids import aller_a, deformer, instants, peau_lineaire, poses, repos

CONTACT = .5
"""Part du poids d'un sommet portée par le pied ou ses descendants qui le range dans la surface du pied (appuis.ts:46)."""
ITERATIONS_MAX = 50
"""Passes de plantation au-delà desquelles l'appui ou la direction ne tiennent pas de point fixe."""
POINT_FIXE_RAD = 1e-9
"""Écart entre la direction plantée et la direction mesurée sur le clip planté sous lequel la plantation tient son point
fixe."""
ATTEINTE_M = 1e-5
"""Écart admis entre la tête du pied posée par l'IK et sa cible."""
HAUT = numpy.array([0.0, 0.0, 1.0])
"""Le haut du monde Blender."""


def sacs(action):
    """Les sacs de F-curves d'une action en couches (Blender 5)."""
    return [sac for couche in action.layers for bande in couche.strips for slot in action.slots
            if (sac := bande.channelbag(slot))]


def empiler(peaux, noms):
    """Les sommets au repos et les poids des peaux `peaux` sur les os `noms`, mis bout à bout (`peau_lineaire`)."""
    parts = [peau_lineaire(peau, noms) for peau in peaux]
    return numpy.vstack([x for x, _ in parts]), numpy.vstack([w for _, w in parts])


def bas(w, x, matrices):
    """Par échantillon de `matrices` de peau, la hauteur du sommet le plus bas des sommets (`w`, `x`)."""
    return deformer(w, x, matrices)[:, :, 2].min(axis=1)


def bas_des_sources(rig, peaux, clips, pelvis):
    """Par clip de `clips` joué sur son rig source `rig`, la hauteur du sommet le plus bas de ses peaux `peaux` à chaque
    instant, et la hauteur minimale de la tête de `pelvis`."""
    noms = [b.name for b in rig.data.bones]
    x, w = empiler(peaux, noms)
    inverses, i = repos(rig), noms.index(pelvis)
    sources = {}
    for action in clips:
        p = poses(rig, action)
        sources[action.name] = (bas(w, x, p @ inverses), float(p[:, i, 2, 3].min()))
    return sources


def retirer_sans_sol(clips, sources, pelvis):
    """Les clips de `clips` dont le pelvis source reste au-dessus du sol ; les autres (la nage, sous sa surface)
    s'effacent."""
    gardes = []
    for action in clips:
        hauteur = sources[action.name][1]
        if hauteur >= 0:
            gardes.append(action)
            continue
        print('RETIRE', action.name, f': {pelvis} source à {hauteur:.4f} m, sous le sol', flush=True)
        bpy.data.actions.remove(action)
    return gardes


def reecrire(action, os, propriete, valeurs):
    """Remplace les clés de `propriete` de l'os `os` dans `action` par `valeurs`, une par instant de `action`, LINEAR."""
    sac, = sacs(action)
    chemin = f'pose.bones["{os}"].{propriete}'
    temps = instants(action)
    for indice in range(len(valeurs[0])):
        courbe = next((c for c in sac.fcurves if c.data_path == chemin and c.array_index == indice), None)
        courbe = courbe or sac.fcurves.new(chemin, index=indice)
        courbe.keyframe_points.clear()
        courbe.keyframe_points.add(len(temps))
        courbe.keyframe_points.foreach_set('co', [c for t, v in zip(temps, valeurs) for c in (t, v[indice])])
        for cle in courbe.keyframe_points:
            cle.interpolation = 'LINEAR'
        courbe.update()


def decaler_le_pelvis(rig, action, pelvis, montees):
    """Monte le pelvis de `montees[k]` mètres, repère monde, à chaque instant k de `action`."""
    assign_action(rig, action)
    os = rig.pose.bones[pelvis]
    haut = rig.matrix_world.inverted().to_3x3() @ Vector((0, 0, 1))
    valeurs = []
    for instant, montee in zip(instants(action), montees):
        aller_a(instant)
        os.matrix = Matrix.Translation(haut * float(montee)) @ os.matrix
        valeurs.append(tuple(os.location))
    reecrire(action, pelvis, 'location', valeurs)


def pivoter(os, pivot, depuis, vers):
    """Tourne l'os `os` autour de `pivot`, repère de l'armature, de la rotation la plus courte de `depuis` vers `vers`."""
    rotation = depuis.rotation_difference(vers).to_matrix().to_4x4()
    os.matrix = Matrix.Translation(pivot) @ rotation @ Matrix.Translation(-pivot) @ os.matrix
    bpy.context.view_layer.update()


def tendre(rig, pied, cible):
    """Pose hanche et genou de la jambe de `pied` pour que sa tête atteigne `cible`, repère de l'armature, dans le plan
    de la jambe courante, l'orientation du pied gardée : IK analytique à deux os."""
    os_pied = rig.pose.bones[pied]
    genou = os_pied.parent
    hanche = genou.parent
    orientation = os_pied.matrix.to_3x3()
    h, k, a = hanche.head.copy(), genou.head.copy(), os_pied.head.copy()
    cuisse, jambe, vers = (k - h).length, (a - k).length, cible - h
    distance = vers.length
    if not abs(cuisse - jambe) < distance < cuisse + jambe:
        raise RuntimeError(f'{pied} : cible à {distance:.4f} m de la hanche, hors de portée de la jambe ({cuisse:.4f} + {jambe:.4f} m)')
    axe = vers / distance
    plan = (k - h) - axe * (k - h).dot(axe)
    if plan.length < ATTEINTE_M:
        raise RuntimeError(f'{pied} : jambe tendue, plan du genou indéterminé')
    long = (cuisse * cuisse - jambe * jambe + distance * distance) / (2 * distance)
    k_cible = h + axe * long + plan.normalized() * math.sqrt(cuisse * cuisse - long * long)
    pivoter(hanche, h, k - h, k_cible - h)
    pivoter(genou, genou.head.copy(), os_pied.head - genou.head, cible - genou.head)
    os_pied.matrix = Matrix.Translation(os_pied.head) @ orientation.to_4x4()
    bpy.context.view_layer.update()
    if (os_pied.head - cible).length > ATTEINTE_M:
        raise RuntimeError(f'{pied} : IK à {(os_pied.head - cible).length:.6f} m de sa cible')


def tendre_les_jambes(rig, action, decalages):
    """Déplace la tête de chaque pied de `decalages[pied][k]`, repère monde, à chaque instant k de `action`, par
    `tendre` ; réécrit les rotations de hanche, genou et pied des jambes touchées."""
    assign_action(rig, action)
    vers_armature = rig.matrix_world.inverted().to_3x3()
    chaines = {pied: (rig.pose.bones[pied].parent.parent.name, rig.pose.bones[pied].parent.name, pied) for pied in decalages}
    for nom in (n for chaine in chaines.values() for n in chaine):
        if rig.pose.bones[nom].rotation_mode != 'QUATERNION':
            raise RuntimeError(f'{nom} : rotation {rig.pose.bones[nom].rotation_mode}, QUATERNION attendue')
    valeurs = {nom: [] for chaine in chaines.values() for nom in chaine}
    for k, instant in enumerate(instants(action)):
        aller_a(instant)
        for pied, decalage in decalages.items():
            if decalage[k].any():
                tendre(rig, pied, rig.pose.bones[pied].head + vers_armature @ Vector(decalage[k]))
        for nom, suite in valeurs.items():
            q = rig.pose.bones[nom].rotation_quaternion.copy()
            suite.append(tuple(-q if suite and q.dot(Quaternion(suite[-1])) < 0 else q))
    for nom, suite in valeurs.items():
        reecrire(action, nom, 'rotation_quaternion', suite)


def direction(relatives, hauteurs):
    """La direction de marche, XY monde : l'axe principal de l'excursion des têtes de pied autour de leur moyenne,
    orienté pour que le parcours vers l'arrière soit le plus bas en moyenne (`directionDe`, appuis.ts:68)."""
    xx = yy = xy = 0.0
    for p in relatives.values():
        c = p - p.mean(axis=0)
        xx, yy, xy = xx + (c[:, 0] ** 2).sum(), yy + (c[:, 1] ** 2).sum(), xy + (c[:, 0] * c[:, 1]).sum()
    angle = math.atan2(2 * xy, xx - yy) / 2
    d = numpy.array([math.cos(angle), math.sin(angle)])
    somme, compte = {-1: 0.0, 1: 0.0}, {-1: 0, 1: 0}
    for pied, p in relatives.items():
        projection = numpy.diff(p, axis=0) @ d
        milieu = (hauteurs[pied][1:] + hauteurs[pied][:-1]) / 2
        for signe, masque in ((-1, projection < 0), (1, projection > 0)):
            somme[signe] += milieu[masque].sum()
            compte[signe] += int(masque.sum())
    if compte[-1] and compte[1] and somme[-1] / compte[-1] > somme[1] / compte[1]:
        d = -d
    return d


def contact(surface, a, b, montees=(0.0, 0.0)):
    """Le sommet de contact de l'intervalle (a, b) : celui dont la hauteur maximale aux deux bornes est la plus basse
    (appuis.ts:120), les bornes montées de `montees`."""
    return int(numpy.argmin(numpy.maximum(surface[a][:, 2] + montees[0], surface[b][:, 2] + montees[1])))


def vitesse_au_sol(surfaces, racines, appuis, d, pas):
    """La vitesse au sol des pieds, tous appuis confondus : le recul de leur sommet de contact relativement à la racine,
    sur la durée de leurs appuis (appuis.ts:118-130)."""
    distance = duree = 0.0
    for pied, surface in surfaces.items():
        for j in numpy.flatnonzero(appuis[pied]):
            k = contact(surface, j, j + 1)
            distance -= (surface[j + 1][k] - surface[j][k] - racines[j + 1] + racines[j])[:2] @ d
            duree += pas
    return distance / duree


def planter_un_pied(surface, racines, appui, d, vitesse, pas):
    """Le décalage monde du pied à chaque instant d'un cycle de `len(appui)` instants : pendant chaque suite d'intervalles
    d'appui, le sommet le plus bas posé au sol et le sommet de contact reculant de `vitesse` le long de `d` ; pendant
    l'envol, interpolé entre l'appui qui finit et celui qui commence, sans passer sous le sol."""
    n = len(appui)
    if appui.all() or not appui.any():
        raise RuntimeError(f'appui sur {int(appui.sum())}/{n} intervalles : ni envol ni appui, rien à planter')
    debuts = [j for j in range(n) if appui[j] and not appui[j - 1]]
    decalage = numpy.zeros((n, 3))
    bornes = []
    for debut in debuts:
        fin = debut
        while appui[(fin + 1) % n]:
            fin += 1
        images = [i % n for i in range(debut, fin + 2)]
        montees = [-surface[i][:, 2].min() for i in images]
        plan = numpy.zeros((len(images), 2))
        for m in range(1, len(images)):
            a, b = images[m - 1], images[m]
            k = contact(surface, a, b, (montees[m - 1], montees[m]))
            plan[m] = plan[m - 1] + (surface[a][k] - surface[b][k] + racines[b] - racines[a])[:2] - vitesse * pas * d
        plan -= plan.mean(axis=0)
        decalage[images] = numpy.column_stack([plan, montees])
        bornes.append((debut, images[-1]))
    for (_, fin), (debut, _) in zip(bornes, bornes[1:] + bornes[:1]):
        ecart = (debut - fin) % n
        for m in range(1, ecart):
            i = (fin + m) % n
            decalage[i] = decalage[fin] + (decalage[debut] - decalage[fin]) * m / ecart
            decalage[i, 2] = max(decalage[i, 2], -surface[i][:, 2].min())
    return decalage


def planter(tetes, racines, surfaces, pas):
    """Les décalages monde des pieds d'un clip de marche bouclé, à chaque instant (le dernier, celui du premier), et sa
    vitesse au sol. L'appui (recul de la tête relativement à la racine, appuis.ts:115) et la direction se mesurent sur le
    clip planté : la plantation cherche par la sécante la direction qui se mesure sur le clip qu'elle plante, l'appui ne
    faisant que croître."""
    n = len(racines) - 1
    for nom, valeurs in (('racine', racines), *tetes.items(), *surfaces.items()):
        if numpy.abs(valeurs[n] - valeurs[0]).max() > ATTEINTE_M:
            raise RuntimeError(f'{nom} : premier et dernier instants différents, marche non bouclée')
    cycle = numpy.arange(n + 1) % n
    decalages = {pied: numpy.zeros((n, 3)) for pied in tetes}
    appuis = {pied: numpy.zeros(n, dtype=bool) for pied in tetes}
    vitesse = angle = None
    essais = []
    for _ in range(ITERATIONS_MAX):
        plantes = {pied: tetes[pied][:n] + decalages[pied] - racines[:n] for pied in tetes}
        d = direction({pied: p[cycle, :2] for pied, p in plantes.items()}, {pied: p[cycle, 2] + racines[cycle, 2] for pied, p in plantes.items()})
        avant = sum(int(a.sum()) for a in appuis.values())
        for pied, p in plantes.items():
            appuis[pied] |= numpy.diff(p[cycle, :2], axis=0) @ d < 0
        mesure = math.atan2(d[1], d[0])
        if vitesse is None:
            vitesse = vitesse_au_sol(surfaces, racines, appuis, d, pas)
        elif avant != sum(int(a.sum()) for a in appuis.values()):
            essais.clear()
        else:
            ecart = math.remainder(mesure - angle, math.tau)
            if abs(ecart) < POINT_FIXE_RAD:
                return {pied: decalage[cycle] for pied, decalage in decalages.items()}, vitesse
            essais.append((angle, ecart))
        angle = mesure
        if len(essais) >= 2 and essais[-1][1] != essais[-2][1]:
            (a0, e0), (a1, e1) = essais[-2:]
            angle = a1 - e1 * math.remainder(a1 - a0, math.tau) / (e1 - e0)
        d = numpy.array([math.cos(angle), math.sin(angle)])
        decalages = {pied: planter_un_pied(surfaces[pied][:n], racines[:n], appuis[pied], d, vitesse, pas) for pied in tetes}
    raise RuntimeError(f'plantation sans point fixe après {ITERATIONS_MAX} passes')


def allonges(poses_, indice, hanche):
    """Par pied, l'allonge maximale de sa jambe sous les poses `poses_` d'un clip : la plus grande distance de la tête de
    hanche à celle du pied."""
    return {pied: float(numpy.linalg.norm(poses_[:, indice[pied], :3, 3] - poses_[:, indice[h], :3, 3], axis=1).max())
            for pied, h in hanche.items()}


def descente_a_portee(hanches, tetes, decalages, allonge):
    """La descente du pelvis, à chaque instant, qui ramène chaque tête de pied décalée à `allonge[pied]` au plus de sa
    hanche, l'allonge du clip lui-même : un pied planté ne tend pas la jambe au-delà de ce que le clip la tend."""
    descente = numpy.zeros(len(next(iter(hanches.values()))))
    for pied, decalage in decalages.items():
        ecart = tetes[pied] + decalage - hanches[pied]
        reste = allonge[pied] ** 2 - (ecart[:, :2] ** 2).sum(axis=1)
        if (reste <= 0).any():
            raise RuntimeError(f'{pied} : cible hors de portée horizontale de la hanche')
        descente = numpy.maximum(descente, -numpy.sqrt(reste) - ecart[:, 2])
    return descente


def poser_les_clips_au_sol(rig, peaux, clips, sources, pieds, racine, pelvis, marches):
    """Pose au sol chaque clip de `clips` joué sur les peaux `peaux` du rig, contre `sources` (`bas_des_sources`) ;
    plante les pieds `pieds` des clips de `marches`."""
    noms = [b.name for b in rig.data.bones]
    indice = {nom: i for i, nom in enumerate(noms)}
    x, w = empiler(peaux, noms)
    surfaces = {pied: w[:, [indice[pied], *(indice[b.name] for b in rig.data.bones[pied].children_recursive)]].sum(axis=1) >= CONTACT
                for pied in pieds}
    hors_pieds = ~numpy.logical_or.reduce(list(surfaces.values()))
    hanche = {pied: rig.pose.bones[pied].parent.parent.name for pied in pieds}
    inverses = repos(rig)
    pas = bpy.context.scene.render.fps_base / bpy.context.scene.render.fps
    inconnues = set(marches) - {a.name for a in clips}
    if inconnues:
        raise RuntimeError(f'clips de marche absents de la base : {sorted(inconnues)}')
    for action in clips:
        p = poses(rig, action)
        matrices = p @ inverses
        bas_hors_pieds = bas(w[hors_pieds], x[hors_pieds], matrices)
        positions = {pied: deformer(w[s], x[s], matrices) for pied, s in surfaces.items()}
        bas_du_corps = numpy.minimum(bas_hors_pieds, numpy.min([q[:, :, 2].min(axis=1) for q in positions.values()], axis=0))
        montees = sources[action.name][0] - bas_du_corps
        montees += numpy.maximum(0.0, -(bas_hors_pieds + montees))
        for q in positions.values():
            q[:, :, 2] += montees[:, None]
        tetes = {pied: p[:, indice[pied], :3, 3] + montees[:, None] * HAUT for pied in pieds}
        if action.name in marches:
            decalages, vitesse = planter(tetes, p[:, indice[racine], :3, 3], positions, pas)
            print('MARCHE', action.name, 'vitesse au sol', round(vitesse, 6), 'm/s', flush=True)
        else:
            decalages = {pied: numpy.maximum(0.0, -q[:, :, 2].min(axis=1))[:, None] * HAUT for pied, q in positions.items()}
        hanches = {pied: p[:, indice[hanche[pied]], :3, 3] + montees[:, None] * HAUT for pied in pieds}
        descente = descente_a_portee(hanches, tetes, decalages, allonges(p, indice, hanche))
        montees -= descente
        decalages = {pied: d + descente[:, None] * HAUT for pied, d in decalages.items()}
        decaler_le_pelvis(rig, action, pelvis, montees)
        decalages = {pied: d for pied, d in decalages.items() if d.any()}
        if decalages:
            tendre_les_jambes(rig, action, decalages)
        print('SOL', action.name, 'pelvis', round(float(montees.min()), 4), 'à', round(float(montees.max()), 4), 'm ; descente',
              round(float(descente.max()), 4), 'm ; pieds', {pied: round(float(numpy.abs(d).max()), 4) for pied, d in decalages.items()},
              flush=True)
