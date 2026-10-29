"""Les clips de la base humanoïde au sol (#3098, porte L1 de #2972). Un clip se joue relatif au repos (`humanoide.py`) :
le corps UBC, d'autres proportions et un autre repos que le mannequin UAL qui porte le clip, ne pose pas ses pieds où ce
mannequin pose les siens.

Le clip se joue d'abord comme le jeu le joue : les quaternions de clés consécutives d'une même courbe prennent un
produit scalaire positif (`plus_court_chemin`), le chemin le plus court que prend three. Puis ses instants se densifient
(`densifier`) : un intervalle entre deux instants se coupe en son milieu tant que la borne de flèche de la peau
(`fleches`) y dépasse `FLECHE_MAX_M`, et chaque coupe pose un instant sur toutes les F-curves (`poser_les_instants`). Ces
instants ne changent pas le clip joué : au milieu de deux points de quaternions unitaires de produit scalaire positif,
l'interpolation linéaire normalisée de Blender est le slerp de three, et une position s'interpole linéairement des deux
côtés.

À chaque instant densifié (`poids.instants`), en skinning linéaire (`poids.deformer`) :
- le pelvis monte ou descend de l'écart entre le sommet le plus bas du mannequin source, interpolé entre ses clés, et
  celui du corps, puis monte de ce qui reste sous le sol hors des pieds ;
- un pied sous le sol remonte au sol par IK de jambe, son orientation gardée (`tendre`) ;
- un pied de clip de marche est planté (`planter`) : de l'instant où sa tête est le plus en avant, relativement à la
  racine et le long de l'avant du personnage (`AXES_DU_PERSONNAGE`), à celui où elle est le plus en arrière (`appuis`),
  son sommet posé recule le long de cet avant à la consigne de plantation (`consigne_de_plantation`), le recul du sommet
  posé sur la source rapporté à la durée d'appui ; le reste du cycle, il rejoint le clip par un décalage interpolé. La
  vitesse au sol publiée est celle que l'évaluateur mesure sur le clip planté ;
- le pelvis descend là où un pied décalé sortirait de l'allonge que le clip donne à sa jambe (`descente_a_portee`).
Sur le clip corrigé, la borne se revérifie : un instant dont le sommet le plus bas passe sous `-SOL_TOLERANCE_M` arrête
la construction (`garder_les_instants`), et le sommet le plus bas garanti d'un intervalle (`plus_bas_garanti`) ne passe
pas sous `-SOL_TOLERANCE_M`. Un intervalle qui y passe, les corrections y ajoutant de la rotation, se coupe sur le clip
avant correction (`restaurer`, `couper`), et les corrections se reposent à tous les instants ; un intervalle trop court
pour se couper arrête la construction. Un clip dont le pelvis source passe sous le sol n'a pas de sol à
tenir : il se retire de la base (`retirer_sans_sol`).

Silhouettes (décision 6 du design de #3101). Le sommet le plus bas, de la montée du pelvis aux revérifications, se prend
au pire coin des shape keys des peaux (`bas`), quels que soient leurs noms. Le jeu pose une shape key de poids c_k dans
[0, 1] en ajoutant c_k d_k au repos du sommet, d_k son déplacement de la clé de référence à la clé (`deplacements`) ; en
skinning linéaire, sa hauteur déformée vaut z_0 + Σ_k c_k (M d_k)_z, M la matrice de peau mélangée du sommet, affine en
chaque c_k. Son minimum sur [0, 1]^K vaut z_0 + Σ_k min(0, (M d_k)_z) : chaque clé prend, pour ce sommet et cet instant,
le poids 0 ou 1 qui l'abaisse. Le plus bas des sommets à ce coin propre est le plus bas du corps sur toutes les
combinaisons, car le minimum sur les sommets et le minimum sur les combinaisons commutent. Un sommet déplacé par une clé
reste un point rigide de ses os : la borne de flèche tient avec r_b mesuré au repos plus Σ_k |d_k| (`geometrie`). La
plantation et l'IK des pieds se calculent sur le repos sans clé, qui vaut à toute silhouette parce qu'aucune clé ne
déplace un sommet de pied (décision 4 du même design), ce que `garder_les_pieds` vérifie.

Borne de flèche. Sur un intervalle, paramétré par s dans [0, 1], three tourne chaque os j de sa rotation locale à vitesse
angulaire constante, d'angle θ_j, et translate linéairement les positions animées. Dans la chaîne de la racine à l'os b,
la vitesse angulaire monde du maillon k vaut Ω_k = Σ_{j ≤ k} ω_j, de norme au plus S_k = Σ_{j ≤ k} θ_j ; chaque ω_j tourne
avec le maillon parent, d'où |Ω_k'| ≤ Σ_{j ≤ k} S_{j-1} θ_j = Q_k = (S_k² − Σ_{j ≤ k} θ_j²) / 2. Un vecteur e porté par le
maillon k, de longueur linéaire dans son repère, a pour dérivée seconde Ω_k' × e + Ω_k × (Ω_k × e) + 2 Ω_k × e', de norme
au plus (S_k² + Q_k) |e| + 2 S_k |Δe|. Un point rigide de b est la tête de la racine, de mouvement linéaire, plus les
segments tête à tête de la chaîne, plus son décalage à la tête de b : |p''| ≤ Σ_segments ((S_k² + Q_k) |e| + 2 S_k |Δe|)
+ (S_b² + Q_b) r_b, k parent du segment, r_b la plus grande distance au repos d'un sommet pondéré sur b à la tête de b.
L'écart d'une courbe à sa corde vaut au plus max|p''| / 8, et un sommet de peau linéaire, combinaison convexe de points
rigides de ses os, a une flèche au plus la plus grande des leurs. La borne (Σθ)² · R / 8, R mesuré de la tête de la racine,
ne tient pas : un segment replié rapproche le point de la racine sans réduire son rayon autour de la jointure qui tourne,
et le terme Q_k ajoute jusqu'à la moitié de S_k².

La borne suppose des os rigides : une clé d'échelle s'écartant de 1 de plus que `TOLERANCE_ECHELLE` arrête la
construction (`courbes_de_rotation`). En deçà, l'échelle des os j de la chaîne d'un sommet déplace ce sommet d'au plus
Σ_j |s_j − 1| r_j, r_j sa distance à la jointure de j : à `TOLERANCE_ECHELLE`, 1e-4 m par mètre de Σ r_j, le
vingt-cinquième de `FLECHE_MAX_M` par mètre. Sonde du 2026-10-28, 832 455 clés d'échelle des clips UAL1 et UAL2 :
|s − 1| au plus 3,874e-6, le bruit float32 de l'export, soit 3,9e-6 m par mètre de Σ r_j.
"""
import math

import bpy
import numpy
from mathutils import Matrix, Quaternion, Vector

from anatomie import AXES_DU_PERSONNAGE, gabarit
from animation import assign_action
from pistes import aller_a, sacs
from poids import CLES_CONFONDUES, LOT, deformer, instants, peau_lineaire, poses, repos
from seuils import MAJORITE_DU_POIDS, SOL_TOLERANCE_M, TOLERANCE_ECHELLE, TOLERANCE_JUMEAUX_POSITION_M

ATTEINTE_M = 1e-5
"""Écart admis entre la tête du pied posée par l'IK (`tendre`) et sa cible, le bruit float32 des matrices de pose de
Blender : sonde du 2026-10-28, `tendre` à chaque clé des 86 clips UAL sur le corps UBC, cible 1 cm au-dessus de la tête
du pied, 8 532 poses, écart au plus 4,8e-7 m, centile 99 3,3e-7 m."""
BOUCLE_FERMEE_M = 1e-6
"""Écart admis entre le premier et le dernier instant d'un clip de marche bouclé : sonde du 2026-10-28, Walk_Loop sur
le corps UBC, têtes d'os et sommets identiques (écart 0) ; la marge couvre l'arrondi float32 d'une position à 1 m."""
JAMBE_FLECHIE = math.radians(10)
"""Angle entre cuisse et jambe au-delà duquel le plan hanche-genou-pied est défini ; en deçà, la jambe tendue, il ne se
lit pas (`tendre`)."""
PLAN_DE_FLEXION_MIN = 0.95
"""Plancher de |normale du plan hanche-genou-pied · axe x du genou| sur une jambe fléchie de plus de `JAMBE_FLECHIE` :
sonde du 2026-10-28 (juge de #3098), 8 113 jambes fléchies aux clés des 86 clips UAL sur le corps UBC, minimum 0,9885,
centile 1 0,9954, médiane 0,9998, aucune sous 0,95. Sous ce plancher, fléchir autour de x sortirait la jambe de son
plan."""
FUSION_BLENDER = 0.01
"""Écart, en images, jusqu'auquel `FCurve.update()` peut fusionner deux clés voisines, selon l'arrondi float32 de
l'image : sonde bpy 5.2.2 du 2026-10-28 par `ecrire`, écarts de 0,005 à 0,0101 image aux images 0, 3,33…, 5,65625, 100
et 1000, des fusions jusqu'à 0,01 tout juste selon l'image, aucune à 0,01001. Un intervalle dont les moitiés passent
sous cet écart, plus `CLES_CONFONDUES`, ne se coupe pas."""
HAUT = numpy.array([0.0, 0.0, 1.0])
"""Le haut du monde Blender."""
FLECHE_MAX_M = SOL_TOLERANCE_M / 2
"""Borne de flèche au-delà de laquelle un intervalle se coupe : la moitié de la tolérance au sol, l'autre moitié laissée
aux rotations que les corrections ajoutent, que `plus_bas_garanti` revérifie."""


def deplacements(peau):
    """Par shape key de `peau` hors sa clé de référence, le déplacement monde de chaque sommet de la référence à la clé,
    celui que l'export glTF publie en morph target : (sommets, 3)."""
    cles = peau.data.shape_keys
    if not cles:
        return {}
    rotation = numpy.array(peau.matrix_world.to_3x3())

    def lire_cle(cle):
        co = numpy.empty(3 * len(cle.data))
        cle.data.foreach_get('co', co)
        return co.reshape(-1, 3)

    reference = lire_cle(cles.reference_key)
    return {cle.name: (lire_cle(cle) - reference) @ rotation.T for cle in cles.key_blocks if cle != cles.reference_key}


def empiler(peaux, noms):
    """Les sommets au repos et les poids des peaux `peaux` sur les os `noms`, mis bout à bout (`peau_lineaire`), les noms
    des shape keys des peaux et, par nom, le déplacement de chaque sommet (`deplacements`), nul sur une peau qui ne porte
    pas la clé : (clés, sommets, 3)."""
    parts = [peau_lineaire(peau, noms) for peau in peaux]
    par_peau = [deplacements(peau) for peau in peaux]
    cles = list(dict.fromkeys(nom for d in par_peau for nom in d))
    tailles = [len(x) for x, _ in parts]
    d = numpy.zeros((len(cles), sum(tailles), 3), dtype=numpy.float32)
    for debut, taille, deltas in zip(numpy.cumsum([0, *tailles]), tailles, par_peau):
        for nom, delta in deltas.items():
            d[cles.index(nom), debut:debut + taille] = delta
    return numpy.vstack([x for x, _ in parts]), numpy.vstack([w for _, w in parts]), cles, d


def bas(w, x, d, matrices):
    """Par échantillon de `matrices` de peau, la hauteur du sommet le plus bas des sommets (`w`, `x`) au pire coin de
    leurs shape keys `d` (`empiler`) : chaque sommet y prend, par clé, le poids 0 ou 1 qui l'abaisse (docstring du
    module). Seule la ligne de hauteur des matrices mélangées se calcule."""
    hauteurs = []
    for k in range(0, len(matrices), LOT):
        lot = matrices[k:k + LOT]
        ligne = (w @ lot[:, :, 2, :].transpose(1, 0, 2).reshape(lot.shape[1], -1)).reshape(len(x), len(lot), 4)
        z = numpy.einsum('snj,sj->ns', ligne, x)
        if len(d):
            z += numpy.minimum(0.0, numpy.einsum('sni,ksi->kns', ligne[:, :, :3], d)).sum(axis=0)
        hauteurs.append(z.min(axis=1))
    return numpy.concatenate(hauteurs)


def bas_des_sources(rig, peaux, clips, pelvis):
    """Par clip de `clips` joué sur son rig source `rig`, ses clés, en images, la hauteur du sommet le plus bas de ses
    peaux `peaux` à chacune (`bas`), et la hauteur minimale de la tête de `pelvis`."""
    noms = [b.name for b in rig.data.bones]
    x, w, _, d = empiler(peaux, noms)
    inverses, i = repos(rig), noms.index(pelvis)
    sources = {}
    for action in clips:
        p = poses(rig, action)
        sources[action.name] = (numpy.array(instants(action)), bas(w, x, d, p @ inverses), float(p[:, i, 2, 3].min()))
    return sources


def garder_les_pieds(cles, d, surfaces):
    """Arrête la construction si une shape key de `cles` (déplacements `d`, `empiler`) déplace un sommet d'une surface
    de pied de `surfaces` de plus de `TOLERANCE_JUMEAUX_POSITION_M`, l'écart sous lequel deux positions de repos sont un
    même point : la plantation et l'IK des pieds se calculent sur le repos sans clé (décision 4 du design de #3101)."""
    for pied, surface in surfaces.items():
        for nom, ecart in zip(cles, numpy.linalg.norm(d[:, surface], axis=2).max(axis=1, initial=0.0)):
            if ecart > TOLERANCE_JUMEAUX_POSITION_M:
                raise RuntimeError(f'shape key « {nom} » : un sommet de la surface de {pied} déplacé de {ecart:.6f} m, '
                                   f'au-delà de {TOLERANCE_JUMEAUX_POSITION_M} m ; les silhouettes ne déplacent pas les pieds')


def retirer_sans_sol(clips, sources, pelvis):
    """Les clips de `clips` dont le pelvis source reste au-dessus du sol ; les autres (la nage, sous sa surface)
    s'effacent."""
    gardes = []
    for action in clips:
        hauteur = sources[action.name][2]
        if hauteur >= 0:
            gardes.append(action)
            continue
        print('RETIRE', action.name, f': {pelvis} source à {hauteur:.4f} m, sous le sol', flush=True)
        bpy.data.actions.remove(action)
    return gardes


def courbes_de_rotation(action):
    """Par os de `action`, ses quatre courbes `rotation_quaternion` dans l'ordre w, x, y, z ; une rotation d'un autre mode
    ou une échelle animée arrête la construction : la borne de flèche suppose des os rigides tournés par quaternion."""
    sac, = sacs(action)
    groupes = {}
    for courbe in sac.fcurves:
        propriete = courbe.data_path.rsplit('.', 1)[-1]
        if propriete in ('rotation_euler', 'rotation_axis_angle'):
            raise RuntimeError(f'{action.name} : {courbe.data_path} animée, rotation par quaternion attendue')
        if propriete == 'scale' and any(abs(k.co[1] - 1) > TOLERANCE_ECHELLE for k in courbe.keyframe_points):
            raise RuntimeError(f'{action.name} : {courbe.data_path} animée, os rigides attendus')
        if propriete == 'rotation_quaternion':
            groupes.setdefault(courbe.data_path, {})[courbe.array_index] = courbe
    return {chemin: [courbes[i] for i in range(4)] for chemin, courbes in groupes.items()}


def lire(courbe):
    """Les points de `courbe` : (points, 2), temps et valeur."""
    co = numpy.empty(2 * len(courbe.keyframe_points))
    courbe.keyframe_points.foreach_get('co', co)
    return co.reshape(-1, 2)


def ecrire(courbe, points):
    """Remplace les points de `courbe` par `points` : (points, 2), temps et valeur, LINEAR."""
    courbe.keyframe_points.clear()
    courbe.keyframe_points.add(len(points))
    courbe.keyframe_points.foreach_set('co', numpy.asarray(points, dtype=float).ravel().tolist())
    for point in courbe.keyframe_points:
        point.interpolation = 'LINEAR'
    courbe.update()


def plus_court_chemin(action):
    """Retourne le signe des quaternions de `action` pour que deux clés consécutives d'une même courbe aient un produit
    scalaire positif ; rend le nombre de paires retournées."""
    retournees = 0
    for chemin, courbes in courbes_de_rotation(action).items():
        cles = [lire(c) for c in courbes]
        if any(len(c) != len(cles[0]) or numpy.abs(c[:, 0] - cles[0][:, 0]).max() > CLES_CONFONDUES for c in cles):
            raise RuntimeError(f'{action.name} : {chemin}, composantes à des clés différentes')
        q = numpy.column_stack([c[:, 1] for c in cles])
        negatifs = (q[1:] * q[:-1]).sum(axis=1) < 0
        if not negatifs.any():
            continue
        retournees += int(negatifs.sum())
        signes = numpy.concatenate([[1.0], numpy.cumprod(numpy.where(negatifs, -1.0, 1.0))])
        for courbe, c, composante in zip(courbes, cles, (q * signes[:, None]).T):
            ecrire(courbe, numpy.column_stack([c[:, 0], composante]))
    return retournees


def piste(courbe):
    """Ce qui nomme `courbe` dans son action : son chemin et sa composante."""
    return courbe.data_path, courbe.array_index


def poser_les_instants(action, temps):
    """Pose chaque instant de `temps`, en images, en point LINEAR sur toutes les F-curves de `action`, à la valeur que
    Blender y évalue ; un quaternion évalué se normalise."""
    sac, = sacs(action)
    valeurs = {piste(courbe): numpy.array([courbe.evaluate(t) for t in temps]) for courbe in sac.fcurves}
    for courbes in courbes_de_rotation(action).values():
        norme = numpy.linalg.norm([valeurs[piste(c)] for c in courbes], axis=0)
        for c in courbes:
            valeurs[piste(c)] = valeurs[piste(c)] / norme
    for courbe in sac.fcurves:
        points = numpy.vstack([lire(courbe), numpy.column_stack([temps, valeurs[piste(courbe)]])])
        ecrire(courbe, points[numpy.argsort(points[:, 0], kind='stable')])


def geometrie(rig, w, x, d):
    """La géométrie de la borne de flèche du corps (`w`, `x`, shape keys `d`) sur `rig` : par os, l'indice de son parent
    (-1 pour une racine), la matrice de ses ancêtres, lui compris, le rayon r_b de ses sommets pondérés autour de sa
    tête, au repos plus la somme des normes de leurs déplacements de clé, et s'il porte un sommet."""
    os = rig.data.bones
    indice = {b.name: i for i, b in enumerate(os)}
    parent = numpy.array([indice[b.parent.name] if b.parent else -1 for b in os])
    ancetres = numpy.zeros((len(os), len(os)))
    for i, b in enumerate(os):
        while b:
            ancetres[i, indice[b.name]] = 1.0
            b = b.parent
    tetes = numpy.array([tuple(rig.matrix_world @ b.head_local) for b in os])
    portes = w > 0
    distances = numpy.linalg.norm(d, axis=2).sum(axis=0)
    rayons = numpy.array([(numpy.linalg.norm(x[portes[:, i], :3] - tetes[i], axis=1) + distances[portes[:, i]]).max()
                          if portes[:, i].any() else 0.0 for i in range(len(os))])
    return parent, ancetres, rayons, portes.any(axis=0)


def fleches(p, geo):
    """Par intervalle entre deux instants consécutifs des poses monde `p` (`poids.poses`) et par os, la borne de flèche
    des points rigides de l'os (docstring du module), nulle pour un os qui ne porte aucun sommet de `geo` (`geometrie`) ;
    la flèche d'un sommet est au plus la plus grande de celles de ses os."""
    parent, ancetres, rayons, portants = geo
    racine = parent < 0
    porteur = numpy.where(racine, 0, parent)
    rotations = p[:, :, :3, :3] / numpy.linalg.norm(p[:, :, :3, :3], axis=2, keepdims=True)
    du_parent = rotations[:, porteur]
    du_parent[:, racine] = numpy.eye(3)
    locales = numpy.einsum('nbji,nbjk->nbik', du_parent, rotations)
    segments = numpy.einsum('nbji,nbj->nbi', du_parent, p[:, :, :3, 3] - p[:, porteur][:, :, :3, 3])
    segments[:, racine] = 0.0
    ecarts = numpy.einsum('nbji,nbjk->nbik', locales[:-1], locales[1:])
    theta = numpy.arccos(numpy.clip((numpy.trace(ecarts, axis1=2, axis2=3) - 1) / 2, -1.0, 1.0))
    s = theta @ ancetres.T
    k = s ** 2 + (s ** 2 - (theta ** 2) @ ancetres.T) / 2
    longueurs = numpy.maximum(numpy.linalg.norm(segments[:-1], axis=2), numpy.linalg.norm(segments[1:], axis=2))
    variations = numpy.linalg.norm(segments[1:] - segments[:-1], axis=2)
    termes = k[:, porteur] * longueurs + 2 * s[:, porteur] * variations
    termes[:, racine] = 0.0
    return numpy.where(portants, (termes @ ancetres.T + k * rayons) / 8, 0.0)


def couper(rig, action, temps, p, coupes):
    """Pose le milieu de chaque intervalle `coupes` des instants `temps` de `action` (`poser_les_instants`) ; rend les
    instants et leurs poses `p` complétés. Un intervalle trop court pour se couper arrête la construction."""
    if numpy.diff(temps)[coupes].min() / 2 < FUSION_BLENDER + CLES_CONFONDUES:
        j = coupes[int(numpy.argmin(numpy.diff(temps)[coupes]))]
        raise RuntimeError(f'{action.name} : intervalle {temps[j]:.6f} à {temps[j + 1]:.6f} à couper, ses moitiés sous '
                           f'{FUSION_BLENDER} image, où Blender fusionne les clés')
    milieux = (temps[coupes] + temps[coupes + 1]) / 2
    poser_les_instants(action, milieux.tolist())
    ordre = numpy.argsort(numpy.concatenate([temps, milieux]), kind='stable')
    return numpy.concatenate([temps, milieux])[ordre], numpy.concatenate([p, poses(rig, action, milieux.tolist())])[ordre]


def densifier(rig, action, geo, temps, p):
    """Coupe en son milieu chaque intervalle entre deux instants `temps` de `action`, de poses `p`, dont la borne de
    flèche (`fleches`) dépasse `FLECHE_MAX_M`, jusqu'à ce qu'aucun ne la dépasse ; rend les instants densifiés et leurs
    poses."""
    while True:
        coupes = numpy.flatnonzero(fleches(p, geo).max(axis=1) > FLECHE_MAX_M)
        if not len(coupes):
            break
        temps, p = couper(rig, action, temps, p, coupes)
    if len(instants(action)) != len(temps):
        poses_ = numpy.array(instants(action))
        absents = [float(t) for t in temps if numpy.abs(poses_ - t).min() > CLES_CONFONDUES]
        raise RuntimeError(f'{action.name} : {len(poses_)} instants posés, {len(temps)} attendus ; absents {absents[:6]}, '
                           f'intervalle le plus court {numpy.diff(temps).min():.6f} image')
    return temps, p


def plus_bas_garanti(rig, action, w, x, d, inverses, geo):
    """Sur `action` corrigée, la plus grande borne de flèche, par intervalle entre deux instants le sommet le plus bas
    garanti (le plus bas de ses deux bornes moins sa borne de flèche), et par instant la hauteur du sommet le plus bas,
    au pire coin des shape keys `d` (`bas`)."""
    p = poses(rig, action)
    hauteurs = bas(w, x, d, p @ inverses)
    f = fleches(p, geo).max(axis=1)
    return float(f.max()), numpy.minimum(hauteurs[:-1], hauteurs[1:]) - f, hauteurs


def garder_les_instants(action, temps, hauteurs):
    """Arrête la construction si, sur `action` corrigée, le sommet le plus bas d'un instant de `temps` (`hauteurs`) est
    sous `-SOL_TOLERANCE_M` : la pose posée elle-même traverse le sol, ce que couper un intervalle ne change pas."""
    sous = numpy.flatnonzero(hauteurs < -SOL_TOLERANCE_M)
    if len(sous):
        i = int(sous[numpy.argmin(hauteurs[sous])])
        raise RuntimeError(f'{action.name} : {len(sous)} instant(s) corrigé(s) sous le sol, le plus bas à l\'image '
                           f'{temps[i]:.6f}, sommet à {hauteurs[i]:.4f} m sous -{SOL_TOLERANCE_M} m : la correction '
                           f'(pelvis, descente à portée, IK des pieds) y laisse la pose sous le sol, hors de toute flèche')


def figer(action):
    """Les points de chaque F-curve de `action`, par piste."""
    sac, = sacs(action)
    return {piste(courbe): lire(courbe) for courbe in sac.fcurves}


def restaurer(action, figee):
    """Rend à `action` les points `figee` (`figer`) : une F-curve absente de `figee` se retire, une F-curve changée
    reprend ses points, LINEAR."""
    sac, = sacs(action)
    for courbe in list(sac.fcurves):
        points = figee.get(piste(courbe))
        if points is None:
            sac.fcurves.remove(courbe)
            continue
        actuels = lire(courbe)
        if actuels.shape != points.shape or not numpy.array_equal(actuels, points):
            ecrire(courbe, points)


def reecrire(action, os, propriete, valeurs):
    """Remplace les points de `propriete` de l'os `os` dans `action` par `valeurs`, une par instant de `action`, LINEAR."""
    sac, = sacs(action)
    chemin = f'pose.bones["{os}"].{propriete}'
    temps = instants(action)
    for indice in range(len(valeurs[0])):
        courbe = next((c for c in sac.fcurves if c.data_path == chemin and c.array_index == indice), None)
        ecrire(courbe or sac.fcurves.new(chemin, index=indice), [(t, v[indice]) for t, v in zip(temps, valeurs)])


def decaler_le_pelvis(rig, action, pelvis, montees):
    """Monte le pelvis de `montees[k]` mètres, repère monde, à chaque instant k de `action`."""
    scene = bpy.context.scene
    assign_action(rig, action)
    os = rig.pose.bones[pelvis]
    haut = rig.matrix_world.inverted().to_3x3() @ Vector((0, 0, 1))
    valeurs = []
    for instant, montee in zip(instants(action), montees):
        aller_a(scene, instant)
        os.matrix = Matrix.Translation(haut * float(montee)) @ os.matrix
        valeurs.append(tuple(os.location))
    reecrire(action, pelvis, 'location', valeurs)


def pivoter(os, pivot, rotation):
    """Tourne l'os `os` autour de `pivot`, repère de l'armature, de la matrice de rotation 3x3 `rotation`."""
    os.matrix = Matrix.Translation(pivot) @ rotation.to_4x4() @ Matrix.Translation(-pivot) @ os.matrix
    bpy.context.view_layer.update()


def flexion(u, v, axe, distance):
    """L'angle, en radians, de plus petite valeur absolue, dont tourner le segment `v` (genou à tête du pied) autour de
    `axe` met la tête du pied à `distance` de la hanche, `u` allant de la hanche au genou. Par Rodrigues, u · R v vaut
    c + m cos(ψ − φ) : c la part de `v` le long de `axe`, m et φ celles de sa part orthogonale."""
    parallele = axe * v.dot(axe)
    orthogonale = v - parallele
    p, q = u.dot(orthogonale), u.dot(axe.cross(orthogonale))
    m = math.hypot(p, q)
    cosinus = ((distance * distance - u.length_squared - v.length_squared) / 2 - u.dot(parallele)) / m if m else math.inf
    if abs(cosinus) > 1:
        return None
    phase, ecart = math.atan2(q, p), math.acos(cosinus)
    return min((math.remainder(phase + ecart, math.tau), math.remainder(phase - ecart, math.tau)), key=abs)


def jambe(rig, pied):
    """La hanche et le genou de la jambe de `pied` : son grand-parent et son parent, tous deux segments de jambe du
    gabarit (`anatomie.gabarit`), sans quoi la construction s'arrête : `tendre` pivote la jambe à la tête de l'un et la
    fléchit à celle de l'autre."""
    segments = gabarit(rig)['legs']
    genou = rig.data.bones[pied].parent
    hanche = genou.parent if genou else None
    if hanche is None or genou.name not in segments or hanche.name not in segments:
        chaine = ' ← '.join(b.name for b in (rig.data.bones[pied], genou, hanche) if b)
        raise RuntimeError(f'{pied} : chaîne {chaine}, son parent et son grand-parent attendus parmi les segments de '
                           f'jambe du gabarit {segments}')
    return hanche.name, genou.name


def garder_le_plan(pied, cuisse, tibia, axe):
    """Arrête la construction si, la jambe de `pied` fléchie de plus de `JAMBE_FLECHIE` (`cuisse` de la hanche au genou,
    `tibia` du genou à la tête du pied), la normale de son plan s'écarte de `axe` au-delà de `PLAN_DE_FLEXION_MIN`."""
    if cuisse.angle(tibia) <= JAMBE_FLECHIE:
        return
    alignement = abs(cuisse.cross(tibia).normalized().dot(axe))
    if alignement < PLAN_DE_FLEXION_MIN:
        raise RuntimeError(f'{pied} : jambe fléchie hors du plan normal à l\'axe x du genou, |normale · axe| '
                           f'{alignement:.4f} sous {PLAN_DE_FLEXION_MIN}')


def tendre(rig, chaine, cible):
    """Pose hanche et genou de la jambe `chaine` (hanche, genou, pied ; `jambe`) pour que la tête du pied atteigne
    `cible`, repère de l'armature, l'orientation du pied gardée. Le genou fléchit autour de son axe x, celui de la flexion
    de genou des clips UAL (`garder_le_plan`), du plus petit angle qui met la tête du pied à la distance de la cible à la
    hanche (`flexion`) ; la hanche tourne ensuite de la rotation la plus courte qui l'y porte. Le plan hanche-genou-pied
    ne se lit pas : la jambe tendue, il est indéterminé, et une IK qui le suit saute d'un instant au suivant."""
    hanche, genou, os_pied = (rig.pose.bones[nom] for nom in chaine)
    pied = os_pied.name
    orientation = os_pied.matrix.to_3x3()
    h, k, a = hanche.head.copy(), genou.head.copy(), os_pied.head.copy()
    cuisse, tibia, distance = (k - h).length, (a - k).length, (cible - h).length
    if not abs(cuisse - tibia) < distance < cuisse + tibia:
        raise RuntimeError(f'{pied} : cible à {distance:.4f} m de la hanche, hors de portée de la jambe ({cuisse:.4f} + {tibia:.4f} m)')
    axe = genou.matrix.to_3x3().col[0].normalized()
    garder_le_plan(pied, k - h, a - k, axe)
    angle = flexion(k - h, a - k, axe, distance)
    if angle is None:
        raise RuntimeError(f'{pied} : cible à {distance:.4f} m de la hanche, hors de la flexion du genou autour de son axe')
    pivoter(genou, k, Matrix.Rotation(angle, 3, axe))
    pivoter(hanche, h, (os_pied.head - h).rotation_difference(cible - h).to_matrix())
    os_pied.matrix = Matrix.Translation(os_pied.head) @ orientation.to_4x4()
    bpy.context.view_layer.update()
    if (os_pied.head - cible).length > ATTEINTE_M:
        raise RuntimeError(f'{pied} : IK à {(os_pied.head - cible).length:.6f} m de sa cible')


def tendre_les_jambes(rig, action, decalages):
    """Déplace la tête de chaque pied de `decalages[pied][k]`, repère monde, à chaque instant k de `action`, par
    `tendre` ; réécrit les rotations de hanche, genou et pied des jambes touchées."""
    scene = bpy.context.scene
    assign_action(rig, action)
    vers_armature = rig.matrix_world.inverted().to_3x3()
    chaines = {pied: (*jambe(rig, pied), pied) for pied in decalages}
    for nom in (n for chaine in chaines.values() for n in chaine):
        if rig.pose.bones[nom].rotation_mode != 'QUATERNION':
            raise RuntimeError(f'{nom} : rotation {rig.pose.bones[nom].rotation_mode}, QUATERNION attendue')
    valeurs = {nom: [] for chaine in chaines.values() for nom in chaine}
    for k, instant in enumerate(instants(action)):
        aller_a(scene, instant)
        for pied, decalage in decalages.items():
            if decalage[k].any():
                try:
                    tendre(rig, chaines[pied], rig.pose.bones[pied].head + vers_armature @ Vector(decalage[k]))
                except RuntimeError as erreur:
                    raise RuntimeError(f'{action.name}, image {instant:.6f} : {erreur}') from erreur
        for nom, suite in valeurs.items():
            q = rig.pose.bones[nom].rotation_quaternion.copy()
            suite.append(tuple(-q if suite and q.dot(Quaternion(suite[-1])) < 0 else q))
    for nom, suite in valeurs.items():
        reecrire(action, nom, 'rotation_quaternion', suite)


def sommet_pose(surface, a, b, montees):
    """L'indice du sommet posé de l'intervalle (a, b) : celui que ses deux bornes, montées de `montees`, gardent le plus
    près du sol."""
    return int(numpy.argmin(numpy.maximum(surface[a][:, 2] + montees[0], surface[b][:, 2] + montees[1])))


def appuis(tetes, racines, surfaces, secondes, avant):
    """Par pied d'un clip de marche bouclé, son appui : de l'instant où sa tête, relativement à la racine, est le plus en
    avant le long de `avant` à celui où elle est le plus en arrière. Rend ses instants, la montée qui y pose son sommet le
    plus bas au sol, le recul relatif à la racine du sommet posé de chaque intervalle (`sommet_pose`), et sa durée."""
    n = len(racines) - 1
    for nom, valeurs in (('racine', racines), *tetes.items(), *surfaces.items()):
        if numpy.abs(valeurs[n] - valeurs[0]).max() > BOUCLE_FERMEE_M:
            raise RuntimeError(f'{nom} : premier et dernier instants différents, marche non bouclée')
    duree = secondes[n] - secondes[0]
    resultat = {}
    for pied, tete in tetes.items():
        le_long = (tete[:n] - racines[:n])[:, :2] @ avant
        debut, fin = int(numpy.argmax(le_long)), int(numpy.argmin(le_long))
        if debut == fin:
            raise RuntimeError(f'{pied} : tête immobile le long de l\'avant, rien à planter')
        images = [i % n for i in range(debut, fin + (n if fin < debut else 0) + 1)]
        montees = [-surfaces[pied][i][:, 2].min() for i in images]
        recul = numpy.zeros((len(images), 2))
        for m in range(1, len(images)):
            a, b = images[m - 1], images[m]
            k = sommet_pose(surfaces[pied], a, b, montees[m - 1:m + 1])
            recul[m] = (surfaces[pied][a][k] - surfaces[pied][b][k] + racines[b] - racines[a])[:2]
        resultat[pied] = (images, montees, recul, (secondes[fin] - secondes[debut]) % duree)
    return resultat


def consigne_de_plantation(appuis_, avant):
    """La vitesse de plantation d'un clip de marche, en m/s : le recul le long de `avant` du sommet posé, sommé sur les
    intervalles d'appui `appuis_` (`appuis`) des deux pieds, rapporté à la somme des durées d'appui. Un geste de
    plantation sur la source, pas une mesure : elle se prend une fois, au premier passage, sur le clip avant correction,
    et les passages suivants la gardent."""
    return float(sum(recul.sum(axis=0) @ avant for _, _, recul, _ in appuis_.values())
                 / sum(duree for *_, duree in appuis_.values()))


def planter(appuis_, consigne, surfaces, secondes, avant):
    """Les décalages monde des pieds d'un clip de marche bouclé, à chaque instant (le dernier, celui du premier). Dans
    l'appui d'un pied (`appuis`), son sommet le plus bas est posé au sol, et le sommet posé de chaque intervalle recule le
    long de `avant` à la `consigne` de plantation (`consigne_de_plantation`). Hors de l'appui, le décalage s'interpole
    dans le temps entre la fin d'un appui et le début du suivant, sans passer sous le sol."""
    n = len(secondes) - 1
    duree = secondes[n] - secondes[0]
    decalages = {}
    for pied, (images, montees, recul, temps) in appuis_.items():
        attendu = numpy.array([(secondes[i] - secondes[images[0]]) % duree for i in images])[:, None] * consigne * avant
        plan = numpy.cumsum(recul, axis=0) - attendu
        plan -= plan.mean(axis=0)
        decalage = numpy.zeros((n, 3))
        decalage[images] = numpy.column_stack([plan, montees])
        debut, fin = images[0], images[-1]
        envol = duree - temps
        for m in range(1, (debut - fin) % n):
            i = (fin + m) % n
            part = ((secondes[i] - secondes[fin]) % duree) / envol
            decalage[i] = decalage[fin] + (decalage[debut] - decalage[fin]) * part
            decalage[i, 2] = max(decalage[i, 2], -surfaces[pied][i][:, 2].min())
        decalages[pied] = decalage[numpy.arange(n + 1) % n]
    return decalages


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
    plante les pieds `pieds` des clips de `marches`. La surface d'un pied est l'ensemble des sommets dont la part du poids
    liée au pied et à ses descendants atteint `MAJORITE_DU_POIDS`, comme `surfacesDesPieds` de
    `hotes/godot/asset/evaluateur/gardes/appuis.ts`. Le corps se tient au sol au pire coin des shape keys des peaux
    (`bas`), dont aucune ne déplace un pied (`garder_les_pieds`)."""
    noms = [b.name for b in rig.data.bones]
    indice = {nom: i for i, nom in enumerate(noms)}
    x, w, cles_de_forme, d = empiler(peaux, noms)
    surfaces = {pied: w[:, [indice[pied], *(indice[b.name] for b in rig.data.bones[pied].children_recursive)]].sum(axis=1)
                >= MAJORITE_DU_POIDS for pied in pieds}
    garder_les_pieds(cles_de_forme, d, surfaces)
    hors_pieds = ~numpy.logical_or.reduce(list(surfaces.values()))
    hanche = {pied: jambe(rig, pied)[0] for pied in pieds}
    inverses = repos(rig)
    geo = geometrie(rig, w, x, d)
    scene = bpy.context.scene
    avant = numpy.array(AXES_DU_PERSONNAGE.col[2])[:2]
    avant /= numpy.linalg.norm(avant)
    inconnues = set(marches) - {a.name for a in clips}
    if inconnues:
        raise RuntimeError(f'clips de marche absents de la base : {sorted(inconnues)}')
    for action in clips:
        retournees = plus_court_chemin(action)
        temps = numpy.array(instants(action))
        cles = len(temps)
        temps, p = densifier(rig, action, geo, temps, poses(rig, action, temps))
        cles_source, bas_source, _ = sources[action.name]
        passes = 0
        while True:
            brut = figer(action)
            matrices = p @ inverses
            bas_hors_pieds = bas(w[hors_pieds], x[hors_pieds], d[:, hors_pieds], matrices)
            positions = {pied: deformer(w[s], x[s], matrices) for pied, s in surfaces.items()}
            bas_du_corps = numpy.minimum(bas_hors_pieds, numpy.min([q[:, :, 2].min(axis=1) for q in positions.values()], axis=0))
            montees = numpy.interp(temps, cles_source, bas_source) - bas_du_corps
            montees += numpy.maximum(0.0, -(bas_hors_pieds + montees))
            for q in positions.values():
                q[:, :, 2] += montees[:, None]
            tetes = {pied: p[:, indice[pied], :3, 3] + montees[:, None] * HAUT for pied in pieds}
            if action.name in marches:
                secondes = temps * scene.render.fps_base / scene.render.fps
                appuis_ = appuis(tetes, p[:, indice[racine], :3, 3], positions, secondes, avant)
                if not passes:
                    consigne = consigne_de_plantation(appuis_, avant)
                decalages = planter(appuis_, consigne, positions, secondes, avant)
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
            fleche, garantis, hauteurs = plus_bas_garanti(rig, action, w, x, d, inverses, geo)
            garder_les_instants(action, temps, hauteurs)
            coupes = numpy.flatnonzero(garantis < -SOL_TOLERANCE_M)
            if not len(coupes):
                break
            passes += 1
            restaurer(action, brut)
            temps, p = densifier(rig, action, geo, *couper(rig, action, temps, p, coupes))
        if action.name in marches:
            print('MARCHE', action.name, 'consigne de plantation', round(consigne, 6), 'm/s', flush=True)
        print('SOL', action.name, 'pelvis', round(float(montees.min()), 4), 'à', round(float(montees.max()), 4), 'm ; descente',
              round(float(descente.max()), 4), 'm ; pieds', {pied: round(float(numpy.abs(d).max()), 4) for pied, d in decalages.items()},
              '; quaternions retournés', retournees, '; clés', cles, '→ instants', len(temps), '; recoupes', passes,
              '; flèche', round(fleche, 4), 'm ; plus bas garanti', round(float(garantis.min()), 4), 'm ; bas max', round(float(hauteurs.max()), 4),
              'm, source', round(float(bas_source.max()), 4), 'm', flush=True)
