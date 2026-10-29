"""Silhouettes de la base humanoïde (#2972, L1d #3101) : les shape keys du corps et de ses peaux secondaires.

- `feminin` : le corps F d'Universal Base Characters, posé par son skin sur le repos du squelette H (chaque os F amené
  sur l'os H homonyme, tête et queue confondues), puis chaque sommet du corps H projeté sur cette surface ; le décalage
  fait la clé. Un sommet ne se projette que sur les faces F dont l'os dominant est le sien, son parent ou un de ses
  enfants (`voisins`) : aux aisselles, à l'entrejambe et entre les doigts, la surface la plus proche d'un autre membre
  n'est pas candidate.
- `carrure_moins`, `carrure_plus` : homothétie de chaque sommet autour de l'axe de la chair de ses os, de rapport la
  borne min, resp. max, de `st` (`bornes_de_st`). L'axe de la chair d'un os est la droite parallèle à l'os qui passe
  par le centroïde de ses sommets pondéré par leurs poids ; le centre d'un sommet combine, par ses poids, ses points
  les plus proches sur ces droites.
- `corpulence` : `corpulence.py`.
- Extrémités invariantes : les pieds, les mains des prises et la tête (`extremites`) ; un sommet garde son décalage en
  entier tant qu'aucun poids d'extrémité ne le porte, ne bouge plus dès que sa part de poids d'extrémité atteint
  `MAJORITE_DU_POIDS` (la surface d'un pied, `sol.poser_les_clips_au_sol`), et entre les deux en proportion
  (`fondu`). Les clés `LISSEES` sont lissées jusqu'à `ETIREMENT_VISE` au repos (`formes.lisser`), fondu compris ; les
  sommets jumeaux prennent le décalage moyen de leur groupe ; puis chaque clé passe aux peaux secondaires par liaison
  de surface (`formes.transferer_les_cles`).

Les poids sont ceux de l'export glTF (`poids.peau_lineaire`).
"""
import json
from pathlib import Path

import numpy
from mathutils.bvhtree import BVHTree

from anatomie import PEAUX_SECONDAIRES, PIEDS, POING, ZONE_DE_L_OS
from corpulence import NOM as CORPULENCE
from formes import (aretes_des_triangles, decalages, lisser, noms_des_cles, positions, poser_la_cle, rapports,
                    transferer_les_cles)
from poids import ETIREMENT_VISE, PASSES_MAX, deformer, jumeaux, peau_lineaire
from seuils import MAJORITE_DU_POIDS

DONNEES = Path(__file__).resolve().parents[3] / 'src' / 'data'
FEMININ = 'feminin'
CARRURE_MOINS = 'carrure_moins'
CARRURE_PLUS = 'carrure_plus'
LISSEES = (FEMININ, CORPULENCE)
"""Les clés lissées : celles d'un donneur, projeté ou lié ; la carrure est exacte par construction."""


def bornes_de_st():
    """Les extrêmes de `st` atteignables : chaque gabarit, et chaque surcharge de race qui le pose."""
    lire = lambda nom: json.loads((DONNEES / nom).read_text(encoding='utf-8'))
    valeurs = [g['st'] for g in lire('gabarits.json')]
    surcharges = [r.get('gabaritOverride') or {} for r in lire('raceAppearance.json')]
    valeurs += [s['st'] for s in surcharges if 'st' in s]
    return {'min': min(valeurs), 'max': max(valeurs)}


def corps_et_secondaires(peaux):
    """Le corps parmi `peaux`, et ses peaux secondaires (`PEAUX_SECONDAIRES`, nom sans suffixe d'import)."""
    secondaires = [p for p in peaux if p.name.split('.')[0] in PEAUX_SECONDAIRES]
    corps = [p for p in peaux if p not in secondaires]
    if len(corps) != 1:
        raise RuntimeError(f'peaux {[p.name for p in peaux]} : un seul corps hors de {PEAUX_SECONDAIRES}')
    return corps[0], secondaires


def descendants(rig, racines):
    """Les noms des os `racines` de `rig` et de tous leurs descendants."""
    return {d.name for r in racines for d in (rig.data.bones[r], *rig.data.bones[r].children_recursive)}


def extremites(rig):
    """Les noms des os d'extrémité de `rig`, descendants compris : les pieds (`PIEDS`), les mains des prises (`POING`)
    et les os de la zone `tete` (`ZONE_DE_L_OS`)."""
    tete = [b.name for b in rig.data.bones if ZONE_DE_L_OS.get(b.name.split('_')[0]) == 'tete']
    return descendants(rig, (*PIEDS, *(f'hand_{cote}' for cote, _, _ in POING.values()), *tete))


def fondu(w, noms, extremes):
    """Par sommet de poids `w` sur les os `noms`, la part de son décalage qu'il garde : 1 sans poids d'extrémité
    (`extremes`), 0 dès que sa part de poids d'extrémité atteint `MAJORITE_DU_POIDS`, linéaire entre les deux."""
    part = w[:, [i for i, n in enumerate(noms) if n in extremes]].sum(axis=1)
    return numpy.clip(1.0 - part / MAJORITE_DU_POIDS, 0.0, 1.0)


def voisins(rig, noms):
    """Par os (indice dans `noms`), les indices de lui-même, de son parent et de ses enfants."""
    index = {n: i for i, n in enumerate(noms)}
    return [sorted({index[b.name], *([index[b.parent.name]] if b.parent else []), *(index[c.name] for c in b.children)})
            for b in (rig.data.bones[n] for n in noms)]


def ramener(rig, rig_source, noms):
    """Par os de `noms`, la matrice monde qui amène l'os homonyme de `rig_source` sur celui de `rig` : sa tête sur la
    tête, ses axes sur les axes, sa longueur sur la longueur : (os, 4, 4)."""
    matrices = []
    for nom in noms:
        cible, source = rig.data.bones[nom], rig_source.data.bones[nom]
        echelle = numpy.diag([1.0, cible.length / source.length, 1.0, 1.0])
        matrices.append(numpy.array(rig.matrix_world @ cible.matrix_local) @ echelle
                        @ numpy.array(source.matrix_local.inverted() @ rig_source.matrix_world.inverted()))
    return numpy.array(matrices, dtype=numpy.float32)


def triangles(peau):
    peau.data.calc_loop_triangles()
    return numpy.array([t.vertices[:] for t in peau.data.loop_triangles])


def projeter(x, os_de_x, surface, faces, os_des_faces, voisinage):
    """Le point le plus proche de chaque point `x` (sommets, 3) sur les faces `faces` de `surface` (sommets, 3) dont
    l'os dominant `os_des_faces` est voisin (`voisinage`) de l'os `os_de_x` du point : (points, distance, os de la face
    retenue)."""
    sommets = [tuple(p) for p in surface]
    arbres = {o: BVHTree.FromPolygons(sommets, faces[os_des_faces == o].tolist(), all_triangles=True)
              for o in numpy.unique(os_des_faces)}
    points, distances, retenus = numpy.empty_like(x), numpy.empty(len(x)), numpy.empty(len(x), dtype=int)
    for i, (p, o) in enumerate(zip(x, os_de_x)):
        meilleur = min(((arbres[v].find_nearest(tuple(p)), v) for v in voisinage[o] if v in arbres),
                       key=lambda t: t[0][3] if t[0][0] is not None else numpy.inf)
        (point, _, _, distance), v = meilleur
        if point is None:
            raise RuntimeError(f'sommet {i} : aucune face de son os ni de ses voisins')
        points[i], distances[i], retenus[i] = point, distance, v
    return points, distances, retenus


def feminin(squelette, corps, squelette_feminin, corps_feminin):
    """Le décalage `feminin` de chaque sommet de `corps` (repère monde), et la sonde de sa projection."""
    noms = [b.name for b in squelette.data.bones]
    x, w = peau_lineaire(corps, noms)
    xf, wf = peau_lineaire(corps_feminin, noms)
    surface = deformer(wf, xf, ramener(squelette, squelette_feminin, noms)[None])[0]
    faces = triangles(corps_feminin)
    dominants_f = wf.argmax(axis=1)
    os_des_faces = numpy.array([numpy.bincount(dominants_f[t], minlength=len(noms)).argmax() for t in faces])
    os_de_x = w.argmax(axis=1)
    points, distances, retenus = projeter(x[:, :3], os_de_x, surface, faces, os_des_faces, voisins(squelette, noms))
    libre, _, os_libre = projeter(x[:, :3], numpy.zeros(len(x), dtype=int), surface, faces, os_des_faces,
                                  [list(range(len(noms)))])
    pire, voisinage = int(distances.argmax()), voisins(squelette, noms)
    sonde = {'distances': numpy.percentile(distances, [50, 90, 99, 100]).round(4).tolist(),
             'pire': (pire, noms[os_de_x[pire]], round(float(distances[pire]), 4)),
             'ailleurs_sans_voisinage': int(sum(o not in voisinage[a] for a, o in zip(os_de_x, os_libre))),
             'ecart_au_libre': round(float(numpy.linalg.norm(points - libre, axis=1).max()), 4)}
    return points - x[:, :3], sonde


def carrure(squelette, corps, rapport):
    """Le décalage de chaque sommet de `corps` (repère monde) sous l'homothétie de rapport `rapport` autour de l'axe de
    la chair de ses os."""
    noms = [b.name for b in squelette.data.bones]
    x, w = peau_lineaire(corps, noms)
    x, w = x[:, :3].astype(numpy.float64), w.astype(numpy.float64)
    portes = w.sum(axis=0) > 0
    w = w[:, portes]
    centroides = (w.T @ x) / w.sum(axis=0)[:, None]
    os_ = [squelette.data.bones[n] for n, porte in zip(noms, portes) if porte]
    axes = numpy.array([squelette.matrix_world.to_3x3() @ (b.tail_local - b.head_local) for b in os_])
    axes /= numpy.linalg.norm(axes, axis=1, keepdims=True)
    long_de_l_axe = numpy.einsum('sbk,bk->sb', x[:, None, :] - centroides[None], axes)
    proches = centroides[None] + long_de_l_axe[..., None] * axes[None]
    centre = numpy.einsum('sb,sbk->sk', w, proches)
    return (rapport - 1.0) * (x - centre)


def vers_le_mesh(objet, decalage):
    """Le décalage monde `decalage` dans le repère du mesh de `objet`."""
    return decalage @ numpy.array(objet.matrix_world.inverted().to_3x3()).T


def ajouter_feminin_et_carrure(squelette, corps, squelette_feminin, corps_feminin, bornes):
    """Pose sur `corps` les clés `feminin` (depuis `corps_feminin` skinné à `squelette_feminin`), `carrure_moins` et
    `carrure_plus` (bornes de `st` `bornes`), décalages bruts, avant `finir_les_silhouettes`."""
    decalage, sonde = feminin(squelette, corps, squelette_feminin, corps_feminin)
    print('FEMININ projection', sonde, flush=True)
    poser_la_cle(corps, FEMININ, vers_le_mesh(corps, decalage))
    for nom, rapport in ((CARRURE_MOINS, bornes['min']), (CARRURE_PLUS, bornes['max'])):
        poser_la_cle(corps, nom, vers_le_mesh(corps, carrure(squelette, corps, rapport)))


def finir_les_silhouettes(squelette, corps, secondaires):
    """Applique à chaque clé de `corps` le lissage des clés `LISSEES`, les extrémités invariantes et l'égalité des
    jumeaux, puis la transfère aux peaux `secondaires` ; rend les noms des clés."""
    noms = [b.name for b in squelette.data.bones]
    x, w = peau_lineaire(corps, noms)
    libre = fondu(w, noms, extremites(squelette))
    groupe = jumeaux(x)
    repos = positions(corps.data)
    aretes = aretes_des_triangles(corps, groupe)
    cles = noms_des_cles(corps)
    for nom in cles:
        if nom in LISSEES:
            brut = rapports(repos, decalages(corps, nom) * libre[:, None], aretes)
            d, passes = lisser(decalages(corps, nom), repos, groupe, aretes, libre, ETIREMENT_VISE, PASSES_MAX)
            r = rapports(repos, d, aretes)
            print('SILHOUETTE', nom, 'lissage', passes, 'passe(s) ; rapports au repos', round(float(brut.min()), 4),
                  round(float(brut.max()), 3), '->', round(float(r.min()), 4), round(float(r.max()), 3),
                  '; arêtes < 0,1', int((brut < 0.1).sum()), '->', int((r < 0.1).sum()), flush=True)
        else:
            d = decalages(corps, nom) * libre[:, None]
        moyenne = numpy.zeros_like(d)
        numpy.add.at(moyenne, groupe, d)
        d = moyenne[groupe] / numpy.bincount(groupe, minlength=len(d))[groupe, None]
        poser_la_cle(corps, nom, d)
        print('SILHOUETTE', nom, 'amplitude', round(float(numpy.linalg.norm(d, axis=1).max()), 4), 'm',
              'extrémités', round(float(numpy.linalg.norm(d[libre == 0], axis=1).max(initial=0)), 6), 'm', flush=True)
    print('SILHOUETTES sommets invariants', int((libre == 0).sum()), 'en fondu', int(((libre > 0) & (libre < 1)).sum()),
          'sur', len(libre), flush=True)
    for peau in secondaires:
        transferer_les_cles(corps, peau, cles)
    return cles
