"""Silhouettes de la base humanoïde (#2972, L1d #3101) : les shape keys de la table `SILHOUETTES`, sur le corps et ses peaux secondaires.

- `feminin` : le corps F d'Universal Base Characters, posé par son skin sur le repos du squelette H (chaque os F amené
  sur l'os H homonyme, tête et queue confondues), puis chaque sommet du corps H projeté sur cette surface ; le décalage
  fait la clé. Chaque sommet se lie à cette surface par `formes.lier`, la liaison filtrée par os de toute clé tirée
  d'un donneur.
- `carrure_moins`, `carrure_plus` (#4002 issuecomment-6817454030), de rapport r la borne min, resp. max, de `st`
  (`bornes_de_st`) : T = C + H. H, homothétie de rapport r de chaque sommet autour de ses axes de chair
  (`portage.axes_de_chair`), son centre la combinaison, par ses poids, de ses points les plus proches sur ces axes
  (`carrure`). C, portage des têtes d'os que la même homothétie déplace (`portage.tetes_portees`, `portage.portage`) ;
  la table locale de ces têtes, champ `osDesSilhouettes`, vit sur l'armature (`portage.ecrire_os_des_silhouettes`).
- `corpulence` : `corpulence.py`.
- Extrémités : les pieds, les mains des prises et la tête (`extremites`), rigides au portage ; part libre `libre`
  d'un sommet, 1 sans poids d'extrémité, 0 dès que sa part de poids d'extrémité atteint `MAJORITE_DU_POIDS` (la
  surface d'un pied, `sol.poser_les_clips_au_sol`), linéaire entre les deux (`fondu`). Champ fini F + T′,
  F = (1 − libre)·C, T′ = libre·T (F et C nuls hors silhouette à os).
- Une silhouette à os garde F + T′ (#4002 issuecomment-6826035694). Les autres : T′ des champs rabotés ensemble aux
  seules arêtes fautives (`formes.raboter`, #3104) hors du socle, fautes par site mesurées sur tous les champs finis,
  chaque champ raboté à la part qu'il prend aux fautes (`parts_des_fautes`, #4002) : jusqu'à
  `ETIREMENT_DES_CLES` au repos sur tout le domaine de `etatsDuGabarit`, aux facteurs non neutres par les clés
  `gabarit_*` cuites sur le résidu F + T′ − C (`cuisson_gabarit.cuisson_des_champs`, #3104), et jusqu'à
  `ETIREMENT_EN_CLIP` sous les clips aux facteurs neutres.
- Correction de T′ des champs rabotés par les anneaux articulaires (`correction`, #3101 issuecomment-6489583109),
  après le rabot et le fondu : la clé la plus proche de sa source, en énergie d'arêtes, dont le centre de chaque
  anneau de la garde des silhouettes reste en place. Les anneaux sont ceux de la garde, calculés sur le maillage de la
  construction par `anneaux.mjs` (`anneaux`). Le rabot se mesure sur les clés corrigées (`raboter_sous_correction` ;
  hotes/godot/pont/CONTRAT.md, « Gabarit d'une base »). Les sommets jumeaux prennent le même décalage ; puis chaque clé passe aux peaux
  secondaires par liaison de surface (`formes.transferer_les_cles`).

Les poids sont ceux de l'export glTF (`poids.peau_lineaire`).
"""
import json
import time
from pathlib import Path

import numpy

from anatomie import PEAUX_SECONDAIRES, PIEDS, POING, ZONE_DE_L_OS
from noms_silhouettes import FEMININ, CARRURE_MOINS, CARRURE_PLUS, SILHOUETTES
from formes import (aretes_des_triangles, aux_noeuds, decalages, lier, noms_des_cles, positions, poser_la_cle,
                    raboter, rapports, transferer_les_cles, transporter, voisins)
from poids import deformer, etats_ponderes, extremes, jumeaux, peau_lineaire
from cuisson_gabarit import cuisson_des_champs, groupes_de_peau
from portage import (axes_de_chair, ecrire_os_des_silhouettes, lire_os_des_silhouettes, portages_des_silhouettes, projete,
                     table_locale, tetes_portees, vers_le_mesh)
from script_node import lancer
from seuils import ETIREMENT_DES_CLES, ETIREMENT_EN_CLIP, INFLUENCES_MAX, MAJORITE_DU_POIDS, SOL_TOLERANCE_M

ICI = Path(__file__).resolve().parent
DONNEES = ICI.parents[2] / 'src' / 'data'
PASSES_DE_RABOT = 400
"""Passes de rabot sous correction (`raboter_sous_correction`) au-delà desquelles la construction s'arrête : valeur
d'ingénierie #3104 (53 passes mesurées sur la capture r9 de la base `humanoide` le 2026-11-04)."""


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


def fondu(w, noms, extremes, groupe):
    """Par sommet de poids `w` sur les os `noms`, la part de son décalage qu'il garde : 1 sans poids d'extrémité
    (`extremes`), 0 dès que sa part de poids d'extrémité atteint `MAJORITE_DU_POIDS`, linéaire entre les deux. Les
    sommets d'un même nœud (`groupe`, `poids.jumeaux`) gardent la plus petite part du nœud : un nœud est tenu dès
    qu'un de ses sommets l'est."""
    part = w[:, [i for i, n in enumerate(noms) if n in extremes]].sum(axis=1)
    sommet = numpy.clip(1.0 - part / MAJORITE_DU_POIDS, 0.0, 1.0)
    noeud = numpy.ones(groupe.max() + 1)
    numpy.minimum.at(noeud, groupe, sommet)
    return noeud[groupe]


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


def surface_ramenee(squelette, squelette_donneur, donneur, noms):
    """La surface de la peau `donneur`, skinnée à `squelette_donneur`, posée sur le repos de `squelette` (chaque os
    du donneur amené sur l'os homonyme, `ramener`) : ses sommets (repère monde), ses triangles et l'os dominant
    (indice dans `noms`) de chaque triangle, le donneur que lie `formes.lier`."""
    xd, wd = peau_lineaire(donneur, noms)
    surface = deformer(wd, xd, ramener(squelette, squelette_donneur, noms)[None])[0]
    faces = triangles(donneur)
    dominants = wd.argmax(axis=1)
    return surface, faces, numpy.array([numpy.bincount(dominants[t], minlength=len(noms)).argmax() for t in faces])


def feminin(squelette, corps, squelette_feminin, corps_feminin):
    """Le décalage `feminin` de chaque sommet de `corps` (repère monde), et la sonde de sa projection."""
    noms = [b.name for b in squelette.data.bones]
    x, w = peau_lineaire(corps, noms)
    surface, faces, os_des_faces = surface_ramenee(squelette, squelette_feminin, corps_feminin, noms)
    os_de_x, voisinage = w.argmax(axis=1), voisins(squelette, noms)
    face, barycentres, distances = lier(x[:, :3], os_de_x, surface, faces, os_des_faces, voisinage)
    points = transporter(surface, faces, face, barycentres)
    face_libre, barycentres_libres, _ = lier(x[:, :3], numpy.zeros(len(x), dtype=int), surface, faces, os_des_faces,
                                             [list(range(len(noms)))])
    libre, os_libre = transporter(surface, faces, face_libre, barycentres_libres), os_des_faces[face_libre]
    pire = int(distances.argmax())
    sonde = {'distances': numpy.percentile(distances, [50, 90, 99, 100]).round(4).tolist(),
             'pire': (pire, noms[os_de_x[pire]], round(float(distances[pire]), 4)),
             'ailleurs_sans_voisinage': int(sum(o not in voisinage[a] for a, o in zip(os_de_x, os_libre))),
             'ecart_au_libre': round(float(numpy.linalg.norm(points - libre, axis=1).max()), 4)}
    return points - x[:, :3], sonde


def carrure(x, w, noms, axes, rapport):
    """H : le décalage de chaque sommet `x` (repère monde, poids `w` sur les os `noms`) sous l'homothétie de rapport
    `rapport` autour des axes de chair `axes` (`portage.axes_de_chair`) de ses os."""
    x, w = x[:, :3].astype(numpy.float64), w.astype(numpy.float64)
    centre = numpy.zeros_like(x)
    for i, nom in enumerate(noms):
        if nom in axes:
            centre += w[:, i, None] * projete(axes[nom], x)
    return (rapport - 1.0) * (x - centre)


def rapports_de_carrure(bornes):
    """Par clé de carrure, son rapport : `carrure_moins` la borne min de `st` (`bornes`), `carrure_plus` la max."""
    return {CARRURE_MOINS: bornes['min'], CARRURE_PLUS: bornes['max']}


def ajouter_feminin_et_carrure(squelette, corps, squelette_feminin, corps_feminin, bornes):
    """Pose sur `corps` les clés `feminin` (depuis `corps_feminin` skinné à `squelette_feminin`), `carrure_moins` et
    `carrure_plus` (bornes de `st` `bornes`), décalages bruts T = C + H, avant `finir_les_silhouettes` ; pose sur
    `squelette` la table locale des deux carrures."""
    decalage, sonde = feminin(squelette, corps, squelette_feminin, corps_feminin)
    print('FEMININ projection', sonde, flush=True)
    poser_la_cle(corps, FEMININ, vers_le_mesh(corps, decalage))
    noms = [b.name for b in squelette.data.bones]
    x, w = peau_lineaire(corps, noms)
    axes = axes_de_chair(squelette, corps)
    unites = tetes_portees(squelette, axes, extremites(squelette))
    rapports_ = rapports_de_carrure(bornes)
    ecrire_os_des_silhouettes(squelette, {nom: table_locale(squelette, {o: (rapport - 1.0) * d for o, d in unites.items()})
                                          for nom, rapport in rapports_.items()})
    portages = portages_des_silhouettes(squelette, w, noms, lire_os_des_silhouettes(squelette))
    for nom, rapport in rapports_.items():
        poser_la_cle(corps, nom, vers_le_mesh(corps, portages[nom][1] + carrure(x, w, noms, axes, rapport)))


class AnneauIndetectable(RuntimeError):
    """Le corps n'a aucun anneau articulaire (`anneauxArticulaires`) : aucune somme d'anneau à tenir, pendant de
    l'écart `anneau-indetectable` de la garde des silhouettes. Ses sous-classes nomment chaque autre cas où la
    correction (`correction`) ne tient pas les anneaux."""
    RAISON = "aucun anneau articulaire, aucune somme d'anneau à tenir"

    def __init__(self, sujet):
        super().__init__(f'anneau-indetectable : {sujet} : {self.RAISON}')


class ContraintesLiees(AnneauIndetectable):
    """Les contraintes retenues par `correction` ne sont pas de rang plein (`liees`) : son complément de Schur est
    singulier. Le sujet nomme chaque contrainte d'une combinaison nulle : deux anneaux dont la part libre est le même
    nœud."""
    RAISON = "contraintes liées, somme d'anneau indéterminée"


class ComposanteSansAppui(AnneauIndetectable):
    """Une composante connexe de nœuds libres n'a aucune arête vers un nœud fixe (`preparerLaplacien`, `scripts/personnage-3d/base/laplacien.ts`) : le laplacien des
    nœuds libres, que `correction` résout, est singulier."""
    RAISON = "composante de nœuds libres sans arête vers un nœud fixe, laplacien singulier"


def liees(contraintes, etiquettes):
    """Les étiquettes (`etiquettes`, une par ligne) des lignes de `contraintes` qui portent une combinaison nulle, vide
    si la matrice est de rang plein. Le rang est celui de `numpy.linalg.matrix_rank` à son seuil par défaut (valeurs
    singulières sous S.max() × max(M, N) × eps) ; les combinaisons sont les vecteurs singuliers à gauche au-delà du
    rang, unitaires, une ligne y entrant dès que son coefficient dépasse max(M, N) × eps."""
    k = len(contraintes)
    if k == 0:
        return []
    rang = numpy.linalg.matrix_rank(contraintes)
    if rang == k:
        return []
    nulles = numpy.linalg.svd(contraintes, full_matrices=k > contraintes.shape[1])[0][:, rang:]
    seuil = max(contraintes.shape) * numpy.finfo(contraintes.dtype).eps
    return list(dict.fromkeys(e for e, poids in zip(etiquettes, numpy.abs(nulles).max(axis=1)) if poids > seuil))


def anneaux(squelette, corps, x, w, noms):
    """Les anneaux articulaires de `corps` (sommets `x`, repère monde, poids `w` sur les os `noms`), par `anneaux.mjs` :
    `anneaux` (os, sommets, centre, rayon, axe de chaque anneau au repos) et `lePlusEpais`, son indice. Un corps sans
    anneau lève `AnneauIndetectable`."""
    rang = numpy.argsort(-w, axis=1, kind='stable')[:, :INFLUENCES_MAX]
    vidage = {
        'os': [{'nom': b.name, 'parent': b.parent.name if b.parent else None,
                'matrice': numpy.array(squelette.matrix_world @ b.matrix_local).T.ravel().tolist()}
               for b in (squelette.data.bones[n] for n in noms)],
        'corps': [{'nom': corps.name, 'positions': x[:, :3].ravel().tolist(), 'indices': rang.ravel().tolist(),
                   'poids': numpy.take_along_axis(w, rang, axis=1).ravel().tolist()}],
    }
    lus = json.loads(lancer(ICI / 'anneaux.mjs', [], json.dumps(vidage)))
    if lus['lePlusEpais'] is None:
        raise AnneauIndetectable(corps.name)
    return lus


def correction(x, aretes, noeud_de, fixe, anneaux_du_corps):
    """#3101 issuecomment-6489583109 ; #4002 issuecomment-6826035694. La correction des clés du corps de sommets `x`
    (repère monde) : la fonction qui rend, pour chaque champ d0 de `champs`, le champ de décalages
    d = argmin Σ_arêtes |(d − d0)_i − (d − d0)_j|² / ℓ₀² sur les arêtes `aretes` (`formes.aretes_des_triangles`), sous :
    une seule valeur par nœud (`noeud_de`, `poids.jumeaux`), d nul sur chaque nœud qui porte un sommet `fixe`, et Σ d
    nulle sur les sommets de chaque anneau de `anneaux_du_corps` (`anneaux`) qui a un nœud libre. Avec `repartitions`
    (par champ, un facteur par sommet dans ]0, 1], ou `None`), la part de d que les contraintes imposent se répartit au
    prorata de ce facteur à chaque nœud : un nœud de facteur faible en reçoit peu. Rend aussi le nombre de nœuds libres,
    de contraintes, et la durée de la résolution de `champs` en secondes. Une composante de nœuds libres sans arête vers
    un nœud fixe lève `ComposanteSansAppui` ; des contraintes liées (`liees`), `ContraintesLiees`."""
    reps, noeud = numpy.unique(noeud_de, return_inverse=True)
    n = len(reps)
    fixes = numpy.zeros(n, dtype=bool)
    numpy.logical_or.at(fixes, noeud, fixe)
    bouts = numpy.searchsorted(reps, aretes)
    graphe = {'fixes': fixes.tolist(), 'aretes': bouts.tolist(),
              'positions': x.tolist(), 'aretesNeutres': aretes.tolist()}
    laplacien = json.loads(lancer(ICI / 'laplacien.mjs', [], json.dumps(graphe)))
    libres = numpy.array(laplacien['libres'], dtype=int)
    m = len(libres)
    bord = laplacien['bord']
    isolees = laplacien['isolees']
    if isolees:
        raise ComposanteSansAppui(', '.join(f'{len(c)} nœud(s) libre(s) du sommet {reps[libres[c[0]]]}'
                                            for c in isolees))
    lignes, etiquettes = [], []
    for anneau in anneaux_du_corps['anneaux']:
        s = numpy.array([v['indice'] for v in anneau['sommets']], dtype=int)
        compte = numpy.bincount(noeud[s], minlength=n)[libres].astype(float)
        if compte.any():
            for c in range(3):
                ligne = numpy.zeros((3, m))
                ligne[c] = compte
                lignes.append(ligne.ravel())
                etiquettes.append(f"{anneau['os']} centre")
    contraintes = numpy.array(lignes).reshape(len(lignes), 3 * m)
    dependantes = liees(contraintes, etiquettes)
    if dependantes:
        raise ContraintesLiees(', '.join(dependantes))
    k_contraintes = len(contraintes)

    def corriger(champs, repartitions=None):
        debut = time.perf_counter()
        valeurs = [aux_noeuds(champ, noeud) for champ in champs]
        seconds = numpy.zeros((m, len(valeurs), 3))
        for p, f, poids in bord:
            for k, valeur in enumerate(valeurs):
                seconds[p, k] -= poids * valeur[f]
        seconds = numpy.concatenate(
            [contraintes.reshape(k_contraintes, 3, m).transpose(2, 0, 1).reshape(m, 3 * k_contraintes),
             seconds.reshape(m, 3 * len(valeurs))], axis=1)
        resolu = numpy.array(json.loads(lancer(ICI / 'laplacien.mjs', [],
                                               json.dumps({'laplacien': laplacien, 'seconds': seconds.tolist()})))).reshape(seconds.shape)
        z = resolu[:, :k_contraintes * 3].reshape(m, k_contraintes, 3).transpose(1, 2, 0).reshape(k_contraintes, 3 * m)
        libres_seuls = resolu[:, k_contraintes * 3:].reshape(m, len(valeurs), 3)
        schur = numpy.linalg.inv(contraintes @ z.T)
        resultats = []
        for k, valeur in enumerate(valeurs):
            d = valeur[libres].T.ravel() + libres_seuls[:, k].T.ravel()
            if repartitions is None or repartitions[k] is None:
                d -= z.T @ (schur @ (contraintes @ d))
            else:
                reponse = z.T * numpy.tile(aux_noeuds(repartitions[k], noeud)[libres], 3)[:, None]
                d -= reponse @ numpy.linalg.solve(contraintes @ reponse, contraintes @ d)
            plein = numpy.zeros((n, 3))
            plein[libres] = d.reshape(3, m).T
            resultats.append(plein[noeud])
        duree = time.perf_counter() - debut
        return resultats, {'noeuds_libres': m, 'contraintes': k_contraintes, 'resolution_s': round(duree, 3)}

    return corriger


def raboter_sous_correction(bruts, groupe, aretes, libre, corriger, vers_le_monde, hors, rabot=None, portes=None):
    """#3104 ; #3101 issuecomment-6489583109 ; #4002 issuecomment-6826035694. Les champs finis des `bruts` (nom -> T au
    repère du mesh), rendus au repère du mesh dans l'ordre de `bruts`. Un nom de `portes` (nom -> C au repère du mesh)
    rend C + libre·(T − C), sans rabot ni correction. Les autres, libre·T, sont rabotés ensemble (`formes.raboter`,
    nœuds `groupe`, arêtes `aretes`, fondu `libre`) jusqu'à ce que leur correction (`corriger`, repère monde
    `vers_le_monde`, matrice 3×3 à droite) ne laisse plus aucune arête marquée. `hors` (nom -> champ fini au repère du
    mesh, tous les noms de `bruts`) rend `(fautes, parts)`, la forme de la mesure de `mesurer_domaine` ; le socle, les
    fautes que `hors` rend quand les noms portés ont leur champ fini et les rabotés un champ nul (#4002). Une arête
    est marquée pour un nom raboté avec la force de la plus grande part du nom aux sites qui y sont en faute hors du
    socle, marquée dès que cette force est non nulle. La correction de
    chaque passe porte le rabot cumulé de chaque clé en `repartitions` : elle ne rend pas aux nœuds rabotés ce que le
    rabot leur ôte. Le rabot repart du rabot cumulé `rabot` (nom -> facteur par sommet) d'un tour précédent de la
    construction ; rend aussi le rabot cumulé de ce tour, des seuls noms rabotés."""
    portes = portes or {}
    portes_finis = {nom: c + libre[:, None] * (bruts[nom] - c) for nom, c in portes.items()}
    noms = [nom for nom in bruts if nom not in portes]
    if not noms:
        return {nom: portes_finis[nom] for nom in bruts}, {}
    inverse = numpy.linalg.inv(vers_le_monde)

    def tous(courants):
        return {nom: portes_finis[nom] if nom in portes else courants[nom] for nom in bruts}

    socle, _ = hors(tous({nom: numpy.zeros_like(bruts[nom]) for nom in noms}))
    print('SILHOUETTES socle : arêtes en défaut sans les clés rabotées', int(socle.any(axis=0).sum()), flush=True)
    sondes = []

    def mesurer(pile, cumul):
        champs, sonde = corriger([pile[:, k] @ vers_le_monde for k in range(len(noms))],
                                 [cumul[:, k] for k in range(len(noms))])
        sondes.append(sonde)
        courants = {nom: d @ inverse for nom, d in zip(noms, champs)}
        fautes, parts = hors(tous(courants))
        hors_socle = fautes & ~socle
        marques = numpy.stack([numpy.where(hors_socle, parts[nom], 0.0).max(axis=0) for nom in noms], axis=1)
        print('SILHOUETTES rabot : arêtes en défaut, décalage corrigé le plus grand à leurs nœuds (m)',
              {nom: (int((marques[:, k] > 0).sum()),
                     round(float(numpy.linalg.norm(courants[nom][aretes[marques[:, k] > 0].ravel()], axis=1).max(initial=0)), 5))
               for k, nom in enumerate(noms)}, flush=True)
        return numpy.stack([courants[nom] for nom in noms], axis=1), marques

    depart = None if rabot is None else numpy.stack([rabot[nom] for nom in noms], axis=1)
    pile, passes, cumul = raboter(numpy.stack([bruts[nom] for nom in noms], axis=1), groupe, aretes, libre, mesurer,
                                  PASSES_DE_RABOT, depart)
    print('SILHOUETTES rabot', passes, 'passe(s) ; correction', sondes[-1], flush=True)
    return tous({nom: pile[:, k] for k, nom in enumerate(noms)}), {nom: cumul[:, k] for k, nom in enumerate(noms)}


def exces(rapport, bornes):
    """La distance du log de `rapport` à l'intervalle `bornes` en log, nulle dedans (#4002)."""
    log = numpy.log(rapport)
    return numpy.maximum.reduce([numpy.log(bornes[0]) - log, numpy.zeros_like(log), log - numpy.log(bornes[1])])


def parts_des_fautes(w, aretes, groupes, traces, monde, noms, portes=()):
    """#4002 : nom de `noms` -> part (sites, arêtes) dans [0, 1] de chaque site en faute aux arêtes `aretes`, sous les
    `GroupePondere` `groupes` aux champs monde `monde` (silhouettes et clés qui en dérivent), selon leurs traces
    `traces` (`poids.extremes`), sites dans l'ordre de `mesurer_domaine`. Chaque clause en faute d'un site se relit à
    son point extrême : l'instant, et pour une clause de domaine le point de sa cellule que portent les poids de la
    trace. Son excès (`exces`) se recalcule sans chaque nom hors de `portes` qui pèse au site, son champ et ses clés
    dérivées (`nomDeCleDuGabarit`, suffixe `_<nom>`) à poids nul, mêmes matrices de peau ; le gain d'un nom est la
    baisse relative de l'excès, sa part son gain rapporté au plus grand gain de la clause parmi ces noms, bornée à
    [0, 1], 1 à chacun d'eux qui pèse quand aucun n'a de gain positif. Un nom de `portes` déplace les os : ses mêmes
    matrices de peau ne disent pas son effet, il a la part 0 partout. La part du site est la plus grande de ses
    clauses ; un nom qui ne pèse pas au site y a la part 0."""
    etats = [e for g in groupes for e in g.demandes]
    parts = {nom: numpy.zeros((len(etats) + len(groupes), len(aretes))) for nom in noms}
    clauses = []
    debut = 0
    for gi, (groupe, t) in enumerate(zip(groupes, traces)):
        def etat(i, j, instant, bornes):
            clauses.append((debut + i, j, gi, (i, i, i), (0.0, 0.0), instant, bornes, t.longueurs_reference[i, j],
                            groupe.demandes[i]['poidsSilhouettes']))
        for i, j in zip(*numpy.nonzero(t.cotes_repos >= 0)):
            etat(i, j, 0, ETIREMENT_DES_CLES)
        for i, j in zip(*numpy.nonzero(t.cotes_clip >= 0)):
            if t.haut[i, j] > ETIREMENT_EN_CLIP[1]:
                etat(i, j, t.instants_haut[i, j], ETIREMENT_EN_CLIP)
            if t.cotes_clip[i, j] == 0:
                etat(i, j, t.instants_bas[i, j], ETIREMENT_EN_CLIP)
        cellules = {c['nom']: c for c in groupe.cellules}
        d = t.domaine_repos
        for j in numpy.flatnonzero(d.cotes >= 0):
            c = cellules[d.cellules[j]]
            origine = list(c['origine'])
            uv = numpy.linalg.lstsq(numpy.array([[c['colonnes'][0][n], c['colonnes'][1][n]] for n in origine]),
                                    numpy.array([d.poids[n][j] - c['origine'][n] for n in origine]), rcond=None)[0]
            clauses.append((len(etats) + gi, j, gi, tuple(c['coins'][:3]), tuple(uv), d.instants[j], ETIREMENT_DES_CLES,
                            t.longueurs_reference[c['coins'][0], j], {n: p[j] for n, p in d.poids.items()}))
        debut += len(groupe.demandes)
    rabotes = [nom for nom in noms if nom not in portes]
    if not clauses or not rabotes:
        return parts
    site, colonne, gi, coins, uv, instant, bornes, reference = (numpy.array(v) for v in list(zip(*clauses))[:8])
    au_site = [c[8] for c in clauses]
    sommets = aretes[colonne]
    positions = numpy.stack([groupes[g][0][list(c)][:, s] for g, c, s in zip(gi, coins, sommets)]).astype(numpy.float64)
    melanges = numpy.stack([numpy.einsum('vb,cbij->cvij', w[s], numpy.stack([groupes[g][2][e][i, :, :3] for e in c]))
                            for g, c, s, i in zip(gi, coins, sommets, instant)])
    poids_des_coins = [[{**groupes[g].demandes[e]['poidsSilhouettes'], **groupes[g].demandes[e]['poidsGabarit']}
                        for e in c] for g, c in zip(gi, coins)]

    def excedent(retire=()):
        p = positions.copy()
        for k in retire:
            poids = numpy.array([[q.get(k, 0) for q in coin] for coin in poids_des_coins])
            p[..., :3] -= poids[:, :, None, None] * monde[k][sommets][:, None]
        posees = numpy.einsum('pcvij,pcvj->pcvi', melanges, p)
        v = posees[:, :, 1] - posees[:, :, 0]
        point = v[:, 0] + uv[:, :1] * (v[:, 1] - v[:, 0]) + uv[:, 1:] * (v[:, 2] - v[:, 0])
        return exces(numpy.linalg.norm(point, axis=1) / reference, bornes.T)

    avec = excedent()
    gains = {}
    for nom in rabotes:
        pese = numpy.array([p.get(nom, 0) != 0 for p in au_site])
        propres = [nom, *(k for k in monde if k not in noms and k.endswith('_' + nom))]
        gains[nom] = numpy.full(len(clauses), -numpy.inf)
        gains[nom][pese] = numpy.divide(avec - excedent(propres), avec, out=numpy.zeros_like(avec), where=avec > 0)[pese]
    plus_grand = numpy.max(list(gains.values()), axis=0)
    for nom, gain in gains.items():
        part = numpy.where(plus_grand > 0, numpy.clip(gain / numpy.where(plus_grand > 0, plus_grand, 1), 0, 1), 1.0)
        numpy.maximum.at(parts[nom], (site, colonne), numpy.where(numpy.isfinite(gain), part, 0.0))
    return parts


def mesurer_domaine(w, x, aretes, groupes, vers_le_monde, derivees=None, portes=()):
    """hotes/godot/pont/CONTRAT.md, « Gabarit d'une base » : `groupes`, `[(domaine, matrices, clips)]` ; `derivees`, des champs
    aux décalages monde des clés qui en dérivent (`cuisson_gabarit.cuisson_des_champs`). La mesure rend `(fautes, parts)`
    par site (#4002) : un site est un état des domaines, ses clauses repos et clip réunies, dans leur ordre, puis par
    groupe sa clause de domaine au repos (`poids.extremes`). `fautes`, booléen (sites, arêtes), le site
    en faute à l'arête ; `parts`, nom de `champs` -> (sites, arêtes) dans [0, 1], la part du nom à chaque site en faute
    (`parts_des_fautes`, noms portés `portes`), nulle ailleurs. Seules les arêtes que déplace un champ changé depuis la mesure précédente se
    remesurent ; les tableaux rendus sont des copies."""
    etats = [e for domaine, _, _ in groupes for e in domaine['etats']]
    vus, fautes, parts = None, None, None

    def mesurer(champs):
        nonlocal vus, fautes, parts
        monde = {nom: d @ vers_le_monde for nom, d in champs.items()}
        if derivees is not None:
            monde.update(derivees(champs))
        if vus is None:
            touchees = numpy.ones(len(aretes), dtype=bool)
            fautes = numpy.zeros((len(etats) + len(groupes), len(aretes)), dtype=bool)
            parts = {n: numpy.zeros(fautes.shape) for n in champs}
        else:
            sommets = numpy.logical_or.reduce([(monde[n] != vus[n]).any(axis=1) for n in monde])
            touchees = sommets[aretes].any(axis=1)
        if touchees.any():
            traces = []
            ponderes = etats_ponderes(x, monde, groupes)
            extremes(w, aretes[touchees], ponderes, traces)
            fautes[:, touchees] = numpy.concatenate([(t.cotes_repos >= 0) | (t.cotes_clip >= 0) for t in traces]
                                                    + [numpy.stack([t.domaine_repos.cotes >= 0 for t in traces])])
            for nom, p in parts_des_fautes(w, aretes[touchees], ponderes, traces, monde, list(champs),
                                             portes).items():
                parts[nom][:, touchees] = p
        vus = {nom: d.copy() for nom, d in monde.items()}
        return fautes.copy(), {nom: p.copy() for nom, p in parts.items()}

    return mesurer


def par_nom(fautes, parts):
    """Nom de `parts` -> booléen par arête : un site de `fautes` y est en faute et le nom y a une part (#4002)."""
    return {nom: (fautes & (p > 0)).any(axis=0) for nom, p in parts.items()}


def refuser_les_inertes(finis):
    """Lève `silhouette-inerte` si un champ fini de `finis` (nom -> décalages) ne déplace aucun sommet de plus que
    `SOL_TOLERANCE_M`, seuil de la garde `silhouette-inerte` de l'évaluateur (`gardes/silhouettes.ts`)."""
    inertes = {nom: float(numpy.linalg.norm(d, axis=1).max(initial=0)) for nom, d in finis.items()}
    inertes = {nom: v for nom, v in inertes.items() if v <= SOL_TOLERANCE_M}
    if inertes:
        raise RuntimeError('silhouette-inerte après la finition : ' + ', '.join(
            f'{nom} {v:.4f} m <= {SOL_TOLERANCE_M} m' for nom, v in inertes.items()))


def finir_les_silhouettes(squelette, corps, secondaires, table, etats, clips, plantes, etats_des_clips, rabot=None):
    """hotes/godot/pont/CONTRAT.md, « Gabarit d'une base » ; `rabot`, le rabot cumulé du tour précédent, rendu à jour."""
    noms = [b.name for b in squelette.data.bones]
    x, w = peau_lineaire(corps, noms)
    groupe = jumeaux(x)
    repos = positions(corps.data)
    aretes = aretes_des_triangles(corps, groupe)
    cles = [nom for nom in SILHOUETTES if nom in noms_des_cles(corps)]
    bruts = {nom: decalages(corps, nom) for nom in cles}
    lus = anneaux(squelette, corps, x, w, noms)
    print('ANNEAUX', len(lus['anneaux']), '; le plus épais', lus['anneaux'][lus['lePlusEpais']]['os'],
          round(lus['anneaux'][lus['lePlusEpais']]['rayon'], 4), 'm ;',
          ' '.join(f"{a['os']}:{len(a['sommets'])}" for a in lus['anneaux']), flush=True)
    vers_le_monde = numpy.array(corps.matrix_world.to_3x3()).T
    libre = fondu(w, noms, extremites(squelette), groupe)
    portages = portages_des_silhouettes(squelette, w, noms,
                                        {nom: t for nom, t in lire_os_des_silhouettes(squelette).items() if nom in bruts})
    portes = {nom: vers_le_mesh(corps, c) for nom, (_, c) in portages.items()}

    def groupes(piles, cellules):
        return [({'etats': jeu, 'cellulesSilhouettes': cellules}, matrices, longueurs) for jeu, matrices, longueurs in piles]

    with groupes_de_peau(squelette, [], table, etats['etats'], ()) as (_, piles), \
            groupes_de_peau(squelette, clips, table, etats_des_clips['etats'], plantes) as (_, piles_des_clips):
        du_repos = groupes(piles, etats['cellulesSilhouettes'])
        domaine = du_repos + groupes(piles_des_clips, etats_des_clips['cellulesSilhouettes'])
        for nom, brut in bruts.items():
            c = portes.get(nom, 0.0)
            r = rapports(repos, c + (brut - c) * libre[:, None], aretes)
            print('SILHOUETTE', nom, 'brute sous le fondu : rapports au repos', round(float(r.min()), 4),
                  round(float(r.max()), 3), flush=True)
        corriger = correction(x[:, :3].astype(numpy.float64), aretes, groupe, libre == 0, lus)
        cuire = cuisson_des_champs(squelette, corps, table)

        def derivees(champs):
            return cuire({nom: d - portes[nom] if nom in portes else d for nom, d in champs.items()})

        finis, rabot = raboter_sous_correction(bruts, groupe, aretes, libre, corriger, vers_le_monde,
                                               mesurer_domaine(w, x, aretes, domaine, vers_le_monde, derivees,
                                                               portes=list(portes)), rabot,
                                               portes)
    for nom, d in finis.items():
        poser_la_cle(corps, nom, d)
        print('SILHOUETTE', nom, 'amplitude', round(float(numpy.linalg.norm(bruts[nom], axis=1).max()), 4), '->',
              round(float(numpy.linalg.norm(d, axis=1).max()), 4), 'm ; tenus hors portage',
              round(float(numpy.linalg.norm((d - portes.get(nom, 0.0))[libre == 0],
                                            axis=1).max(initial=0)), 6), 'm',
              flush=True)
    print('SILHOUETTES sommets invariants', int((libre == 0).sum()), 'en fondu', int(((libre > 0) & (libre < 1)).sum()),
          'sur', len(libre), flush=True)
    refuser_les_inertes(finis)
    for peau in secondaires:
        transferer_les_cles(corps, peau, cles)
    return rabot
