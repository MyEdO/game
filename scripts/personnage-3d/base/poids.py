"""#3104 issuecomment-6549354475 ; #3101 issuecomment-6516197619."""
import copy
import math
from typing import NamedTuple

import bpy
import numpy
from mathutils.kdtree import KDTree

from animation import assign_action
from formes import region_locale
from diagnostic_poids import rapport, publier, sauvegarder
from pas_des_poids import (ANNEAUX_MAX, appliquer, cellules_du_domaine, corriger_region, limiter, longueurs_de_reference,
                           melanges_par_lots, mesurer_par_lots, minima_des_cellules, par_groupes)
from pistes import aller_a, sacs
from seuils import (ETIREMENT_DES_CLES, ETIREMENT_EN_CLIP, IMAGES_PAR_SECONDE, INSTANTS_CONFONDUS, MARGE_DE_GRILLE,
                    TOLERANCE_JUMEAUX_POSITION_M)

PASSES_MAX = 200
"""Passes de correction des poids, de `formes.raboter` et de `point_fixe.atteindre_le_point_fixe`, au-delà desquelles la construction s'arrête."""


def cadence():
    """Les images par seconde de la scène."""
    rendu = bpy.context.scene.render
    return rendu.fps / rendu.fps_base


def instants_confondus():
    """`INSTANTS_CONFONDUS`, en images à la cadence de la scène (`cadence`)."""
    return INSTANTS_CONFONDUS * cadence()


def instants(action):
    """Les instants de `action`, en images à la cadence de la scène : l'union des multiples de `pas` compris entre sa
    première et sa dernière clé, `pas` valant 1/`IMAGES_PAR_SECONDE` s, et des clés de toutes ses courbes, triée, un
    élément qui suit le précédent de `instants_confondus` images au plus n'en faisant qu'un avec lui ; aucun pour une
    action sans clé. Une action dont la première clé est 0 a les instants de l'évaluateur (`echantillonnage.ts`
    `instants`), en images. Une clé qui n'est pas un instant suit de `instants_confondus` images au plus l'élément qui
    la précède dans le tri."""
    cles = [float(k.co[0]) for sac in sacs(action) for c in sac.fcurves for k in c.keyframe_points]
    if not cles:
        return []
    pas = cadence() / IMAGES_PAR_SECONDE
    debut, fin = math.ceil(min(cles) / pas - MARGE_DE_GRILLE), math.floor(max(cles) / pas + MARGE_DE_GRILLE)
    grille = [k * pas for k in range(debut, fin + 1)]
    tous = sorted(grille + cles)
    confondus = instants_confondus()
    return [t for i, t in enumerate(tous) if i == 0 or t - tous[i - 1] > confondus]


def poses(rig, action, temps=None):
    """Par instant de `temps` (défaut : `instants(action)`), en images, de `action` joué sur `rig`, la matrice monde de
    chaque os, dans l'ordre de `rig.data.bones` : (instants, os, 4, 4)."""
    scene = bpy.context.scene
    image = scene.frame_current
    assign_action(rig, action)
    echantillons = []
    for instant in instants(action) if temps is None else temps:
        aller_a(scene, instant)
        echantillons.append([rig.matrix_world @ rig.pose.bones[b.name].matrix for b in rig.data.bones])
    scene.frame_set(image)
    return numpy.array(echantillons)


def repos(rig):
    """Par os de `rig`, l'inverse de sa matrice de repos, repère monde : (os, 4, 4) ; `poses(…) @ repos(rig)` donne les
    matrices de peau."""
    return numpy.array([b.matrix_local.inverted() @ rig.matrix_world.inverted() for b in rig.data.bones])


def peau_lineaire(peau, noms):
    """Les sommets de `peau` au repos, repère monde et homogènes, et leurs poids sur les os `noms`, réduits à
    `INFLUENCES_MAX` et normalisés : le skinning de l'export glTF."""
    index = {n: i for i, n in enumerate(noms)}
    groupes = {g.index: g.name for g in peau.vertex_groups}
    if set(groupes.values()) - index.keys():
        raise RuntimeError(f'{peau.name} : groupes hors du squelette {sorted(set(groupes.values()) - index.keys())}')
    sommets = peau.data.vertices
    x = numpy.array([(*(peau.matrix_world @ v.co), 1.0) for v in sommets], dtype=numpy.float32)
    w = numpy.zeros((len(sommets), len(noms)), dtype=numpy.float32)
    for v in sommets:
        for g in v.groups:
            w[v.index, index[groupes[g.group]]] = g.weight
    if not w.sum(axis=1).all():
        raise RuntimeError(f'{peau.name} : sommet sans poids')
    return x, limiter(w)


def deformer_par_lots(w, x, matrices):
    """Par lot de `LOT` échantillons de `matrices` de peau, les positions monde des sommets (`w`, `x`) : (lot,
    sommets, 3)."""
    for melange in melanges_par_lots(w, matrices):
        yield appliquer(melange, x)


def deformer(w, x, matrices):
    """Les positions monde des sommets (`w`, `x`) sous chaque échantillon de `matrices` de peau : (échantillons,
    sommets, 3)."""
    return numpy.concatenate(list(deformer_par_lots(w, x, matrices)))


class GroupePondere(tuple):
    """`(positions, references, matrices)` d'un jeu de facteurs : par état, ses positions, ses positions de référence
    sans silhouettes ni clés croisées (`etats_ponderes`) et sa pile de matrices de peau, partagée par référence entre les
    états de mêmes poids de silhouettes à os ; `cellules`, sa topologie de silhouettes ; `demandes`, ses états ; `clips`,
    les longueurs des clips des piles après la clause repos (leur premier échantillon). `clauses` : par échantillon,
    l'indice de sa clause, le repos puis chaque clip (`pas_des_poids.retenir`)."""

    def __new__(cls, positions, references, matrices, cellules, demandes, clips):
        objet = super().__new__(cls, (positions, references, matrices))
        if len(matrices) != len(positions):
            raise ValueError(f'piles-incoherentes : {len(matrices)} pile(s) pour {len(positions)} état(s)')
        if len({len(pile) for pile in matrices}) != 1:
            raise ValueError(f'clips-incoherents : piles de {sorted({len(pile) for pile in matrices})} échantillons')
        reste = len(matrices[0]) - 1
        clips = tuple(int(n) for n in clips)
        if sum(clips) != reste or any(n < 1 for n in clips):
            raise ValueError(f'clips-incoherents : {list(clips)} pour {reste} échantillon(s) après le repos')
        objet.cellules, objet.demandes, objet.clips = cellules, demandes, clips
        objet.clauses = numpy.repeat(numpy.arange(1 + len(clips)), (1,) + clips)
        return objet


class MinimumDuDomaine(NamedTuple):
    bas: numpy.ndarray
    exact: numpy.ndarray
    cellules: numpy.ndarray
    poids: dict
    instants: numpy.ndarray
    cotes: numpy.ndarray
    certifiees_par_arete: numpy.ndarray
    resolues_par_arete: numpy.ndarray

    @property
    def certifiees(self):
        return int(self.certifiees_par_arete.sum())

    @property
    def resolues(self):
        return int(self.resolues_par_arete.sum())


class TraceDesExtremes(NamedTuple):
    bas: numpy.ndarray
    haut: numpy.ndarray
    instants_bas: numpy.ndarray
    instants_haut: numpy.ndarray
    longueurs_reference: numpy.ndarray
    rapports_repos: numpy.ndarray
    cotes_repos: numpy.ndarray
    clips_mesures: bool
    cotes_clip: numpy.ndarray
    domaine_repos: MinimumDuDomaine
    domaine_clip: MinimumDuDomaine
    bornes_repos: tuple


def extremes(w, aretes, groupes, traces=None, filtrer=True):
    """hotes/godot/pont/CONTRAT.md, « Gabarit d'une base »."""
    sommets, locales = numpy.unique(aretes, return_inverse=True)
    locales = locales.reshape(aretes.shape)

    def mesurer_groupe(groupe):
        positions, _, piles = groupe
        cellules = cellules_du_domaine(groupe)
        noms = list(cellules[0]['origine']) if cellules else []
        def vide():
            return MinimumDuDomaine(numpy.full(len(aretes), numpy.inf), numpy.ones(len(aretes), dtype=bool),
                numpy.full(len(aretes), '', dtype=object), {n: numpy.zeros(len(aretes)) for n in noms},
                numpy.zeros(len(aretes), dtype=int), numpy.full(len(aretes), -1, dtype=numpy.int8),
                numpy.zeros(len(aretes), dtype=int), numpy.zeros(len(aretes), dtype=int))
        domaine_repos, domaine_clip = vide(), vide()
        longueurs_du_groupe = longueurs_de_reference(w, groupe, sommets, locales)
        valides = longueurs_du_groupe > 0
        bas = numpy.full((len(positions), len(aretes)), numpy.inf, dtype=numpy.float64)
        haut = numpy.zeros_like(bas)
        ib, ih = [numpy.zeros(bas.shape, dtype=int) for _ in range(2)]
        mesures_repos = numpy.full(bas.shape, numpy.nan)
        colonnes = numpy.arange(len(aretes))

        def mesurer_cellules(lot, debut, fin, domaine, bornes):
            normes = lot.normes[:, debut:fin]
            forcer = (normes > bornes[1] * longueurs_du_groupe[:, None]).any(axis=(0, 1))[None] if filtrer else True
            for cellule, minimum in zip(cellules, minima_des_cellules(lot.vecteurs[:, debut:fin], normes,
                                                                       longueurs_du_groupe, cellules, bornes[0], forcer)):
                valide = valides[cellule['coins'][0]]
                domaine.certifiees_par_arete[:] += ((~minimum.exactes) & valide[None]).sum(axis=0)
                domaine.resolues_par_arete[:] += minimum.exactes.sum(axis=0)
                instant = minimum.rapports.argmin(axis=0)
                plus_bas = minimum.rapports[instant, colonnes]
                change = plus_bas < domaine.bas
                domaine.bas[change] = plus_bas[change]
                domaine.exact[change] = minimum.exactes[instant, colonnes][change]
                domaine.cellules[change] = cellule['nom']
                domaine.instants[change] = lot.debut + debut + instant[change]
                argmin = minimum.uv[instant, colonnes]
                for nom in noms:
                    ca, cb = (col[nom] for col in cellule['colonnes'])
                    poids = cellule['origine'][nom] + argmin[:, 0] * ca + argmin[:, 1] * cb
                    domaine.poids[nom][change] = poids[change]
            domaine.cotes[:] = numpy.where(domaine.bas < bornes[0], 0, -1)
            return domaine

        for lot in mesurer_par_lots(w, groupe, sommets, locales, longueurs_du_groupe):
            debut = min(lot.rapports.shape[1], max(0, 1 - lot.debut))
            for e, rapports in enumerate(lot.rapports):
                if debut:
                    mesures_repos[e, valides[e]] = rapports[0, valides[e]]
                rapport = rapports[debut:]
                if not len(rapport):
                    continue
                rb, rh = rapport.argmin(axis=0), rapport.argmax(axis=0)
                vb, vh = rapport[rb, colonnes], rapport[rh, colonnes]
                change = valides[e] & (vb < bas[e])
                ib[e, change] = lot.debut + debut + rb[change]
                change = valides[e] & (vh > haut[e])
                ih[e, change] = lot.debut + debut + rh[change]
                bas[e, valides[e]] = numpy.minimum(bas[e, valides[e]], rapport[:, valides[e]].min(axis=0))
                haut[e, valides[e]] = numpy.maximum(haut[e, valides[e]], rapport[:, valides[e]].max(axis=0))
            if cellules:
                if debut:
                    domaine_repos = mesurer_cellules(lot, 0, debut, domaine_repos, ETIREMENT_DES_CLES)
                if debut < lot.rapports.shape[1]:
                    domaine_clip = mesurer_cellules(lot, debut, lot.rapports.shape[1], domaine_clip, ETIREMENT_EN_CLIP)
        cotes_repos = numpy.where((not cellules) & (mesures_repos < ETIREMENT_DES_CLES[0]), 0,
                                  numpy.where(mesures_repos > ETIREMENT_DES_CLES[1], 1, -1))
        cotes_clip = numpy.where((not cellules) & (bas < ETIREMENT_EN_CLIP[0]), 0,
                                 numpy.where(haut > ETIREMENT_EN_CLIP[1], 1, -1))
        if cellules and filtrer:
            defauts = (cotes_repos >= 0).any(axis=0) | (cotes_clip >= 0).any(axis=0)
            defauts |= (domaine_repos.cotes >= 0) | (domaine_clip.cotes >= 0)
            incomplets = defauts & ((numpy.isfinite(domaine_repos.bas) & ~domaine_repos.exact)
                                    | (numpy.isfinite(domaine_clip.bas) & ~domaine_clip.exact))
            if incomplets.any():
                indices = numpy.flatnonzero(incomplets)
                detail = []
                extremes(w, aretes[indices], [groupe], detail, filtrer=False)
                trace = TraceDesExtremes(bas, haut, ib, ih, longueurs_du_groupe, mesures_repos, cotes_repos,
                    len(piles[0]) > 1, cotes_clip, domaine_repos, domaine_clip, ETIREMENT_DES_CLES)
                integrer_trace(trace, detail[0], indices)
                return trace
        return TraceDesExtremes(bas, haut, ib, ih, longueurs_du_groupe, mesures_repos, cotes_repos,
            len(piles[0]) > 1, cotes_clip, domaine_repos, domaine_clip, ETIREMENT_DES_CLES)
    mesures = par_groupes(mesurer_groupe, groupes)
    if traces is not None:
        traces.extend(mesures)
    return numpy.concatenate([m.bas for m in mesures]), numpy.concatenate([m.haut for m in mesures])


def jumeaux(x):
    """Par sommet, le plus petit indice des sommets confondus avec lui au repos."""
    arbre = KDTree(len(x))
    for i, p in enumerate(x):
        arbre.insert(p[:3], i)
    arbre.balance()
    return numpy.array([min(i for _, i, _ in arbre.find_range(p[:3], TOLERANCE_JUMEAUX_POSITION_M)) for p in x])


def decouper_trace(trace, indices):
    champs = {}
    for nom, valeur in trace._asdict().items():
        if isinstance(valeur, numpy.ndarray):
            champs[nom] = valeur[:, indices]
        elif isinstance(valeur, MinimumDuDomaine):
            champs[nom] = valeur._replace(**{
                champ: {n: p[indices] for n, p in v.items()} if isinstance(v, dict) else v[indices]
                for champ, v in valeur._asdict().items()})
    return trace._replace(**champs)


def integrer_trace(cible, source, indices):
    for nom, valeur in source._asdict().items():
        avant = getattr(cible, nom)
        if isinstance(valeur, numpy.ndarray):
            avant[:, indices] = valeur
        elif isinstance(valeur, MinimumDuDomaine):
            for champ in MinimumDuDomaine._fields:
                v, a = getattr(valeur, champ), getattr(avant, champ)
                if isinstance(v, dict):
                    for n, p in v.items():
                        a[n][indices] = p
                else:
                    a[indices] = v


def mesurer_correction(etat, indices=None):
    """#3104 issuecomment-6549354475."""
    if indices is None:
        indices = numpy.arange(len(etat['aretes']))
    traces = []
    bas, haut = extremes(etat['w'], etat['aretes'][indices], etat['groupes'], traces)
    if 'traces' not in etat:
        etat['traces'] = traces
    else:
        for cible, source in zip(etat['traces'], traces):
            integrer_trace(cible, source, indices)
    repos = numpy.concatenate([m.rapports_repos for m in traces])
    cotes_repos = numpy.concatenate([m.cotes_repos for m in traces])
    if 'bas' not in etat:
        etat['bas'], etat['haut'], etat['repos'], etat['cotesRepos'] = bas, haut, repos, cotes_repos
    else:
        etat['bas'][:, indices], etat['haut'][:, indices] = bas, haut
        etat['repos'][:, indices], etat['cotesRepos'][:, indices] = repos, cotes_repos
    hors_clip = numpy.concatenate([m.cotes_clip for m in traces])
    if 'cotesClip' not in etat:
        etat['cotesClip'] = hors_clip
        etat['domaineRepos'] = numpy.zeros(len(etat['aretes']), dtype=bool)
        etat['domaineClip'] = numpy.zeros(len(etat['aretes']), dtype=bool)
    else:
        etat['cotesClip'][:, indices] = hors_clip
    etat['domaineRepos'][indices] = numpy.logical_or.reduce([m.domaine_repos.cotes >= 0 for m in traces])
    etat['domaineClip'][indices] = numpy.logical_or.reduce([m.domaine_clip.cotes >= 0 for m in traces])
    etat['horsClip'] = (etat['cotesClip'] >= 0).any(axis=0) | etat['domaineClip']
    etat['horsRepos'] = (etat['cotesRepos'] >= 0).any(axis=0) | etat['domaineRepos']
    etat['hors'] = etat['horsClip'] | etat['horsRepos']
    return etat['hors']


SUITE_DE_CORRECTION = ('w', 'origine', 'retouches', 'passe', 'anneau')
"""Les champs d'un état de correction que ses passes font avancer : le reste se déduit de la scène et de la phase, ses
mesures de `w` (#3793)."""


def preparer_correction(nom, x, w, jumeau, aretes, groupes, contraintes=(), diagnostic=None, pieds=(), suite=None):
    """#3104 issuecomment-6549354475. `pieds` : les indices d'os de chaque pied, descendants compris. `suite` : les champs
    `SUITE_DE_CORRECTION` d'une correction déjà avancée, qui la continuent."""
    etat = {'nom': nom, 'x': x, 'w': w.copy(), 'origine': w.copy(), 'jumeau': jumeau, 'aretes': aretes, 'groupes': groupes,
            'contraintes': numpy.array(contraintes, dtype=int),
            'diagnostic': diagnostic or {}, 'pieds': pieds, 'anneau': 0,
            'retouches': set(), 'passe': 0, **(suite or {})}
    mesurer_correction(etat)
    return etat


def imprimer_correction(etat, passe):
    """#3104 issuecomment-6549354475. `écart` : le maximum de `ecart_des_aretes` sur les arêtes marquées."""
    bas, haut, hors = etat['bas'], etat['haut'], etat['hors']
    print('POIDS', etat['nom'], 'passe', passe, 'arêtes', int(hors.sum()), 'rapports',
          round(float(bas.min()), 4) if bas.size else 1.0,
          round(float(haut.max()), 3) if haut.size else 1.0, 'anneaux', etat['anneau'],
          'états', len(bas), 'écart', round(float(ecart_des_aretes(etat)[hors].max()), 6) if hors.any() else 0.0, flush=True)


def refuser_correction(etat, passe, raison=None):
    """#3104 issuecomment-6549354475."""
    groupes = etat['groupes']
    traces = [decouper_trace(trace, etat['hors']) for trace in etat['traces']]
    detail = rapport(etat['nom'], passe, etat['x'], etat['w'], etat['origine'],
                     etat['aretes'][etat['hors']], etat['jumeau'], etat['contraintes'], groupes, etat['diagnostic'], traces)
    publier(detail)
    sauvegarder(etat, groupes)
    erreur = RuntimeError(raison or f"{etat['nom']} : {int(etat['hors'].sum())} arête(s) hors de {ETIREMENT_EN_CLIP} après {passe} passes")
    erreur.diagnostic = detail
    raise erreur


def verifier_repos_cuit(etat):
    """#3104 issuecomment-6549354475 ; #3101 issuecomment-6516197619."""
    reste = {'aretes': int(etat['horsRepos'].sum()), 'phase': 'cuisson-repos', 'etats': len(etat['repos'])}
    print('CUISSON_REPOS', reste, flush=True)
    if reste['aretes']:
        refuser_correction(etat, 0, f"cuisson : clause R hors de {ETIREMENT_DES_CLES}, reste {reste}")


def ecart_des_aretes(etat):
    """#3104 : (arêtes,), en log, nul dans les bornes : la sortie de chaque arête, minimum du domaine compris, sur une
    échelle commune à `ETIREMENT_EN_CLIP` et `ETIREMENT_DES_CLES`. Choisit l'arête d'une passe (`avancer_correction`)."""
    bas, bas_repos = etat['bas'].min(axis=0), numpy.fmin.reduce(etat['repos'], axis=0)
    for trace in etat['traces']:
        bas = numpy.minimum(bas, trace.domaine_clip.bas)
        bas_repos = numpy.fmin(bas_repos, trace.domaine_repos.bas)
    with numpy.errstate(divide='ignore', invalid='ignore'):
        sorties = [numpy.log(ETIREMENT_EN_CLIP[0] / bas), numpy.log(etat['haut'].max(axis=0) / ETIREMENT_EN_CLIP[1]),
                   numpy.log(ETIREMENT_DES_CLES[0] / bas_repos),
                   numpy.log(numpy.fmax.reduce(etat['repos'], axis=0) / ETIREMENT_DES_CLES[1])]
    return numpy.fmax.reduce([numpy.zeros(len(bas)), *sorties])


def essayer_le_pas(etat, incidentes, proposition):
    """Mesure `proposition` sur `incidentes` : si toutes sont dans les bornes, l'état la prend et rend vrai ; sinon
    l'état reste intact."""
    essai = {**etat, 'w': proposition, 'traces': copy.deepcopy(etat['traces'])}
    for cle in ['bas', 'haut', 'repos', 'cotesRepos', 'cotesClip', 'domaineRepos', 'domaineClip']:
        essai[cle] = etat[cle].copy()
    mesurer_correction(essai, incidentes)
    if essai['hors'][incidentes].any():
        return False
    for cle in ['w', 'bas', 'haut', 'repos', 'cotesRepos', 'cotesClip', 'domaineRepos', 'domaineClip', 'horsClip', 'horsRepos', 'hors', 'traces']:
        etat[cle] = essai[cle]
    return True


def avancer_correction(etat):
    """#3104 issuecomment-6565228921. Une passe traite la pire arête marquée de `ecart_des_aretes`, premier indice à égalité : anneaux
    0 à `ANNEAUX_MAX` (`formes.region_locale`), le premier qui réussit gagne ; sinon `refuser_correction`. Une arête aux deux
    sommets fixes, qu'aucune région ne touche, refuse tout de suite."""
    if not etat['hors'].any():
        return False
    aretes, w, fixes = etat['aretes'], etat['w'], etat['contraintes']
    marquees = numpy.flatnonzero(etat['hors'])
    cible = marquees[ecart_des_aretes(etat)[marquees].argmax()]
    etat['passe'] += 1
    if numpy.isin(aretes[cible], fixes).all():
        refuser_correction(etat, etat['passe'], f"{etat['nom']} : arête {aretes[cible].tolist()} hors bornes, ses deux sommets sont fixes")
    masque = numpy.arange(len(aretes)) == cible
    groupes = etat['groupes']
    essais = []
    for anneau in range(ANNEAUX_MAX + 1):
        etat['anneau'] = anneau
        region = numpy.flatnonzero(region_locale(aretes, masque, anneau, len(w)))
        region = region[~numpy.isin(region, fixes)]
        incidentes = numpy.flatnonzero(numpy.isin(aretes, region).any(axis=1))
        try:
            resolution = corriger_region(w, region, aretes[incidentes], groupes, etat['pieds'])
        except numpy.linalg.LinAlgError as erreur:
            refuser_correction(etat, etat['passe'], f"{etat['nom']} : arête {aretes[cible].tolist()}, anneau {anneau} : {erreur}")
        essais.append(resolution.statut)
        if resolution.statut == 'ok' and essayer_le_pas(etat, incidentes, resolution.w):
            etat['retouches'].update(region[numpy.any(resolution.w[region] != w[region], axis=1)].tolist())
            return bool(etat['hors'].any())
    refuser_correction(etat, etat['passe'], f"{etat['nom']} : arête {aretes[cible].tolist()} sans pas aux anneaux 0 à {ANNEAUX_MAX} : {essais}")


def retouches_de_la_correction(etat):
    """#3104 issuecomment-6549354475."""
    return numpy.flatnonzero(numpy.isin(etat['jumeau'], list(etat['retouches'])))


def appliquer_correction(peau, noms, etat):
    """#3104 issuecomment-6549354475."""
    retouches = retouches_de_la_correction(etat)
    for s in retouches:
        for g in list(peau.data.vertices[s].groups):
            peau.vertex_groups[g.group].remove([int(s)])
        for i in numpy.flatnonzero(etat['w'][etat['jumeau'][s]]):
            groupe = peau.vertex_groups.get(noms[i]) or peau.vertex_groups.new(name=noms[i])
            groupe.add([int(s)], float(etat['w'][etat['jumeau'][s], i]), 'REPLACE')
    return retouches


def sommets_des_surfaces(surfaces):
    return numpy.flatnonzero(numpy.logical_or.reduce(list(surfaces.values())))


def etats_ponderes(x, deltas, groupes):
    """Les `GroupePondere` des `groupes` `(domaine, matrices, clips)`, `matrices` la pile de chaque état du domaine : les
    états du domaine sur `x` décalé par `deltas`, les coins de chaque cellule parmi ses états."""
    def sous(poids):
        p = x.copy()
        for nom, poids_de_cle in poids.items():
            if poids_de_cle:
                p[:, :3] += poids_de_cle * deltas[nom]
        return p
    resultats = []
    for domaine, matrices, clips in groupes:
        topologie = cellules_du_domaine(domaine)
        demandes = domaine['etats']
        cellules = []
        for cellule in topologie:
            coins = []
            for u, v in ((0, 0), (1, 0), (0, 1), (1, 1)):
                poids = {n: p + u * cellule['colonnes'][0][n] + v * cellule['colonnes'][1][n]
                         for n, p in cellule['origine'].items()}
                indice = next((i for i, e in enumerate(demandes) if dict(e['poidsSilhouettes']) == poids), None)
                if indice is None:
                    raise RuntimeError(f"cellule-incomplete : {cellule['nom']} : coin absent {poids}")
                coins.append(indice)
            cellules.append({**cellule, 'coins': coins})
        resultats.append(GroupePondere(
            numpy.array([sous({**e['poidsSilhouettes'], **e['poidsGabarit']}) for e in demandes]),
            numpy.array([sous(e['poidsReference']) for e in demandes]), matrices, cellules, demandes, clips))
    return resultats
