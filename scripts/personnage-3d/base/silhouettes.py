"""Silhouettes de la base humanoïde (#2972, L1d #3101) : les shape keys de la table `SILHOUETTES`, sur le corps et ses peaux secondaires.

- `feminin` : le corps F d'Universal Base Characters, posé par son skin sur le repos du squelette H (chaque os F amené
  sur l'os H homonyme, tête et queue confondues), puis chaque sommet du corps H projeté sur cette surface ; le décalage
  fait la clé. Chaque sommet se lie à cette surface par `formes.lier`, la liaison filtrée par os de toute clé tirée
  d'un donneur.
- `carrure_moins`, `carrure_plus` : homothétie de chaque sommet autour de l'axe de la chair de ses os, de rapport la
  borne min, resp. max, de `st` (`bornes_de_st`). L'axe de la chair d'un os est la droite parallèle à l'os qui passe
  par le centroïde de ses sommets pondéré par leurs poids ; le centre d'un sommet combine, par ses poids, ses points
  les plus proches sur ces droites.
- `corpulence` : `corpulence.py`.
- Extrémités invariantes : les pieds, les mains des prises et la tête (`extremites`) ; un sommet garde son décalage en
  entier tant qu'aucun poids d'extrémité ne le porte, ne bouge plus dès que sa part de poids d'extrémité atteint
  `MAJORITE_DU_POIDS` (la surface d'un pied, `sol.poser_les_clips_au_sol`), et entre les deux en proportion
  (`fondu`). Chaque clé est lissée jusqu'à `ETIREMENT_DES_CLES` au repos (`formes.lisser`, région pleine), fondu
  compris.
- Correction des clés par les anneaux articulaires (`correction`, #3101 issuecomment-6489583109), sur chaque clé,
  après le lissage et le fondu : la clé la plus proche de sa source, en énergie d'arêtes, qui garde le centre de
  chaque anneau de la garde des silhouettes, et, pour la carrure, porte le rayon de l'anneau le plus épais à la borne
  de `st`. Les anneaux sont ceux de la garde, calculés sur le maillage de la construction par `anneaux.mjs`
  (`anneaux`). Une clé corrigée dont une arête sort de ses bornes est relissée, sans fondu neuf, puis recorrigée, au
  plus `TOURS_DE_CORRECTION` tours (`alterner`). Les sommets jumeaux prennent le même décalage ; puis chaque clé passe
  aux peaux secondaires par liaison de surface (`formes.transferer_les_cles`).
- Finition en clip (#3101 issuecomment-6535025119) : `finir_les_silhouettes` rend `refinir(matrices)`, qui reprend
  les clés courantes par `alterner` en région locale, bornes au repos et sous les matrices de peau des clips
  (`en_clip`, mesure incrémentale de `poids.extremes`), et `mesurer(matrices)`, sur la préparation de
  `finir_les_silhouettes`.

Les poids sont ceux de l'export glTF (`poids.peau_lineaire`).
"""
import json
import time
from pathlib import Path

import numpy

from anatomie import PEAUX_SECONDAIRES, PIEDS, POING, ZONE_DE_L_OS
from corpulence import NOM as CORPULENCE
from formes import (aretes_des_triangles, aux_noeuds, decalages, lier, lisser, noms_des_cles, positions, poser_la_cle,
                    rapports, transferer_les_cles, transporter, voisins)
from poids import PASSES_MAX, deformer, extremes, jumeaux, peau_lineaire
from script_node import lancer
from seuils import ETIREMENT_AU_REPOS, ETIREMENT_EN_CLIP, INFLUENCES_MAX, MAJORITE_DU_POIDS
from tenue_au_sol import ToursSansTour

ICI = Path(__file__).resolve().parent
DONNEES = ICI.parents[2] / 'src' / 'data'
FEMININ = 'feminin'
CARRURE_MOINS = 'carrure_moins'
CARRURE_PLUS = 'carrure_plus'
SILHOUETTES = (FEMININ, CARRURE_MOINS, CARRURE_PLUS, CORPULENCE)
TOURS_DE_CORRECTION = 5
"""Tours de lissage puis correction (`alterner`) au-delà desquels la construction s'arrête : valeur d'ingénierie
#3101."""
ETIREMENT_DES_CLES = (max(ETIREMENT_AU_REPOS[0], ETIREMENT_EN_CLIP[0]), min(ETIREMENT_AU_REPOS[1], ETIREMENT_EN_CLIP[1]))
"""Bornes de l'étirement d'une clé au repos : l'intersection de `ETIREMENT_AU_REPOS` et `ETIREMENT_EN_CLIP`, plafond
de la T-pose (#3101)."""


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


def feminin(squelette, corps, squelette_feminin, corps_feminin):
    """Le décalage `feminin` de chaque sommet de `corps` (repère monde), et la sonde de sa projection."""
    noms = [b.name for b in squelette.data.bones]
    x, w = peau_lineaire(corps, noms)
    xf, wf = peau_lineaire(corps_feminin, noms)
    surface = deformer(wf, xf, ramener(squelette, squelette_feminin, noms)[None])[0]
    faces = triangles(corps_feminin)
    dominants_f = wf.argmax(axis=1)
    os_des_faces = numpy.array([numpy.bincount(dominants_f[t], minlength=len(noms)).argmax() for t in faces])
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


def rapports_de_carrure(bornes):
    """Par clé de carrure, son rapport : `carrure_moins` la borne min de `st` (`bornes`), `carrure_plus` la max."""
    return {CARRURE_MOINS: bornes['min'], CARRURE_PLUS: bornes['max']}


def ajouter_feminin_et_carrure(squelette, corps, squelette_feminin, corps_feminin, bornes):
    """Pose sur `corps` les clés `feminin` (depuis `corps_feminin` skinné à `squelette_feminin`), `carrure_moins` et
    `carrure_plus` (bornes de `st` `bornes`), décalages bruts, avant `finir_les_silhouettes`."""
    decalage, sonde = feminin(squelette, corps, squelette_feminin, corps_feminin)
    print('FEMININ projection', sonde, flush=True)
    poser_la_cle(corps, FEMININ, vers_le_mesh(corps, decalage))
    for nom, rapport in rapports_de_carrure(bornes).items():
        poser_la_cle(corps, nom, vers_le_mesh(corps, carrure(squelette, corps, rapport)))


class AnneauIndetectable(RuntimeError):
    """Le corps n'a aucun anneau articulaire (`anneauxArticulaires`) : ni centre ni épaisseur à tenir, pendant de
    l'écart `anneau-indetectable` de la garde des silhouettes. Ses sous-classes nomment chaque autre cas où la
    correction (`correction`) ne tient pas les anneaux."""
    RAISON = 'aucun anneau articulaire, ni centre ni épaisseur à tenir'

    def __init__(self, sujet):
        super().__init__(f'anneau-indetectable : {sujet} : {self.RAISON}')


class ContraintesLiees(AnneauIndetectable):
    """Les contraintes retenues par `correction` ne sont pas de rang plein (`liees`) : son complément de Schur est
    singulier. Le sujet nomme chaque contrainte d'une combinaison nulle : deux anneaux dont la part libre est le même
    nœud, une épaisseur portée par les seuls nœuds des sommes d'un anneau, l'épaisseur visée d'un anneau le plus épais
    tout fixe."""
    RAISON = 'contraintes liées, centre ou épaisseur indéterminés'


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
    """La correction des clés du corps de sommets `x` (repère monde) : la fonction qui rend, pour chaque couple
    (champ d0, rapport) de `champs`, le champ de décalages d = argmin Σ_arêtes |(d − d0)_i − (d − d0)_j|² sur les
    arêtes `aretes` (`formes.aretes_des_triangles`), sous : une seule valeur par nœud (`noeud_de`, `poids.jumeaux`),
    d nul sur chaque nœud qui porte un sommet `fixe`, Σ d nulle sur les sommets de chaque anneau de `anneaux_du_corps`
    (`anneaux`) et, si `rapport` n'est pas `None`, moyenne de d·u sur l'anneau le plus épais égale à (rapport − 1) × son
    rayon, u la direction radiale de chaque sommet depuis la droite de son centre et de son axe. Rend aussi le nombre
    de nœuds libres, de contraintes, et la durée de la résolution de `champs` en secondes. Une composante de nœuds
    libres sans arête vers un nœud fixe lève `ComposanteSansAppui` ; des contraintes retenues liées (`liees`),
    `ContraintesLiees`."""
    reps, noeud = numpy.unique(noeud_de, return_inverse=True)
    n = len(reps)
    fixes = numpy.zeros(n, dtype=bool)
    numpy.logical_or.at(fixes, noeud, fixe)
    bouts = numpy.searchsorted(reps, aretes)
    graphe = {'fixes': fixes.tolist(), 'aretes': bouts.tolist()}
    laplacien = json.loads(lancer(ICI / 'laplacien.mjs', [], json.dumps(graphe)))
    libres = numpy.array(laplacien['libres'], dtype=int)
    m = len(libres)
    bord = laplacien['bord']
    isolees = laplacien['isolees']
    if isolees:
        raise ComposanteSansAppui(', '.join(f'{len(c)} nœud(s) libre(s) du sommet {reps[libres[c[0]]]}'
                                            for c in isolees))
    liste, sommets = anneaux_du_corps['anneaux'], []
    lignes, etiquettes = [], []
    for anneau in liste:
        s = numpy.array([v['indice'] for v in anneau['sommets']], dtype=int)
        sommets.append(s)
        compte = numpy.bincount(noeud[s], minlength=n)[libres].astype(float)
        if compte.any():
            for c in range(3):
                ligne = numpy.zeros((3, m))
                ligne[c] = compte
                lignes.append(ligne.ravel())
                etiquettes.append(f"{anneau['os']} centre")
    epais = liste[anneaux_du_corps['lePlusEpais']]
    s = sommets[anneaux_du_corps['lePlusEpais']]
    axe, centre = numpy.array(epais['axe']), numpy.array(epais['centre'])
    radial = x[s] - centre
    radial -= (radial @ axe)[:, None] * axe
    radial /= numpy.linalg.norm(radial, axis=1, keepdims=True) * len(s)
    epaisseur = numpy.zeros((3, n))
    for c in range(3):
        numpy.add.at(epaisseur[c], noeud[s], radial[:, c])
    contraintes = numpy.array([*lignes, epaisseur[:, libres].ravel()])
    etiquettes.append(f"{epais['os']} épaisseur")

    def corriger(champs):
        debut = time.perf_counter()
        vises = {rapport is not None for _, rapport in champs}
        portees = len(contraintes) if True in vises else len(contraintes) - 1
        dependantes = liees(contraintes[:portees], etiquettes[:portees])
        if dependantes:
            raise ContraintesLiees(', '.join(dependantes))
        valeurs = [aux_noeuds(champ, noeud) for champ, _ in champs]
        seconds = numpy.zeros((m, len(valeurs), 3))
        for p, f in bord:
            for k, valeur in enumerate(valeurs):
                seconds[p, k] -= valeur[f]
        k_contraintes = len(contraintes)
        seconds = numpy.concatenate(
            [contraintes.reshape(k_contraintes, 3, m).transpose(2, 0, 1).reshape(m, 3 * k_contraintes),
             seconds.reshape(m, 3 * len(valeurs))], axis=1)
        resolu = numpy.array(json.loads(lancer(ICI / 'laplacien.mjs', [],
                                               json.dumps({**graphe, 'seconds': seconds.tolist()})))).reshape(seconds.shape)
        z = resolu[:, :k_contraintes * 3].reshape(m, k_contraintes, 3).transpose(1, 2, 0).reshape(k_contraintes, 3 * m)
        libres_seuls = resolu[:, k_contraintes * 3:].reshape(m, len(valeurs), 3)
        retenues = {vise: (contraintes, z) if vise else (contraintes[:-1], z[:-1]) for vise in vises}
        schurs = {vise: numpy.linalg.inv(c @ zz.T) for vise, (c, zz) in retenues.items()}
        resultats = []
        for k, ((_, rapport), valeur) in enumerate(zip(champs, valeurs)):
            vise = rapport is not None
            c, zz = retenues[vise]
            cible = numpy.zeros(len(c))
            if vise:
                cible[-1] = (rapport - 1.0) * epais['rayon']
            d = valeur[libres].T.ravel() + libres_seuls[:, k].T.ravel()
            d -= zz.T @ (schurs[vise] @ (c @ d - cible))
            plein = numpy.zeros((n, 3))
            plein[libres] = d.reshape(3, m).T
            resultats.append(plein[noeud])
        duree = time.perf_counter() - debut
        return resultats, {'noeuds_libres': m, 'contraintes': k_contraintes, 'resolution_s': round(duree, 3)}

    return corriger


def hors_de(r, bornes):
    """Par rapport de `r`, s'il sort de l'intervalle `bornes` (bas, haut)."""
    return (r < bornes[0]) | (r > bornes[1])


def alterner(bruts, repos, groupe, aretes, libre, corriger, vers_le_monde, hors, region, tours_max=TOURS_DE_CORRECTION):
    """Les clés `bruts` (nom -> (champ brut au repère du mesh, rapport de `correction` ou `None`)) des sommets au repos
    `repos`, chacune lissée (`formes.lisser`, nœuds `groupe`, arêtes `aretes`, région `region`) jusqu'à ce que
    `hors(nom, champ)` (masque des arêtes hors bornes de la clé `nom`) ne marque plus rien, sous le fondu `libre`, puis
    corrigée par `corriger` (`correction`, repère monde : `vers_le_monde`, matrice 3×3 à droite). Tant que `hors` marque
    une arête d'une clé corrigée, le champ corrigé est relissé, de facteur `libre > 0` (le fondu déjà appliqué ne se
    réapplique pas), puis recorrigé ; au-delà de `tours_max` tours, la construction s'arrête. Rend, par nom, le champ
    corrigé dans le repère du mesh. Un `tours_max` sous 1 lève `ToursSansTour`."""
    if tours_max < 1:
        raise ToursSansTour(tours_max)
    inverse = numpy.linalg.inv(vers_le_monde)
    champs = {nom: champ for nom, (champ, _) in bruts.items()}
    facteurs = dict.fromkeys(bruts, libre)
    finis = {}
    for tour in range(1, tours_max + 1):
        lisses = {}
        for nom, champ in champs.items():
            lisses[nom], passes = lisser(champ, repos, groupe, aretes, facteurs[nom], lambda d, nom=nom: hors(nom, d),
                                         PASSES_MAX, region)
            print('SILHOUETTE', nom, 'tour', tour, 'lissage', region, passes, 'passe(s)', flush=True)
        corriges, sonde = corriger([(d @ vers_le_monde, bruts[nom][1]) for nom, d in lisses.items()])
        print('SILHOUETTES correction tour', tour, sonde, flush=True)
        restantes = {}
        for nom, d in zip(lisses, corriges):
            d = d @ inverse
            r = rapports(repos, d, aretes)
            n = int(hors(nom, d).sum())
            print('SILHOUETTE', nom, 'tour', tour, 'rapports au repos', round(float(r.min()), 4), round(float(r.max()), 3),
                  '; arêtes hors bornes', n, flush=True)
            if n:
                restantes[nom] = n
                champs[nom], facteurs[nom] = d, (libre > 0).astype(numpy.float64)
            else:
                finis[nom] = d
                del champs[nom]
        if not champs:
            return {nom: finis[nom] for nom in bruts}
    raise RuntimeError(', '.join(f'{nom} : {n} arête(s) hors bornes après {tours_max} tours de correction'
                                 for nom, n in restantes.items()))


def extremes_au_monde(w, x, champs, aretes, longueurs, matrices, vers_le_monde):
    """`poids.extremes` des champs `champs` (liste de (sommets, 3)) au repère du mesh (`vers_le_monde`, matrice 3×3 à
    droite), portés au repère monde de `x`."""
    monde = numpy.array([d @ vers_le_monde for d in champs]).reshape(len(champs), len(x), 3)
    return extremes(w, x, monde, aretes, longueurs, matrices)


def en_clip(w, x, aretes, longueurs, matrices, vers_le_monde):
    """La mesure `(nom, d) -> masque` des arêtes `aretes` de la clé `nom`, champ `d` au repère du mesh (`vers_le_monde`,
    matrice 3×3 à droite), hors de `ETIREMENT_EN_CLIP` dans l'état de la clé sous les matrices de peau `matrices`
    (`poids.extremes`, sommets `x`, poids `w`, longueurs au repos `longueurs`). Le rapport d'une arête ne dépend que de
    ses deux extrémités : par clé, la mesure garde le dernier champ et ses (bas, haut), et ne remesure que les arêtes
    dont une extrémité a changé."""
    vus = {}

    def mesurer(nom, d):
        if nom in vus:
            champ, bas, haut = vus[nom]
            touchees = (d != champ).any(axis=1)[aretes].any(axis=1)
        else:
            bas, haut = numpy.empty(len(aretes), dtype=numpy.float32), numpy.empty(len(aretes), dtype=numpy.float32)
            touchees = numpy.ones(len(aretes), dtype=bool)
        if touchees.any():
            b, h = extremes_au_monde(w, x, [d], aretes[touchees], longueurs[touchees], matrices, vers_le_monde)
            bas[touchees], haut[touchees] = b[1], h[1]
        vus[nom] = (d.copy(), bas, haut)
        return hors_de(bas, ETIREMENT_EN_CLIP) | hors_de(haut, ETIREMENT_EN_CLIP)

    return mesurer


def finir_les_silhouettes(squelette, corps, secondaires, bornes):
    """Applique aux silhouettes de `corps` le lissage en région pleine jusqu'à `ETIREMENT_DES_CLES` au repos, les
    extrémités invariantes et la correction par les anneaux articulaires (`alterner`, `correction`, rayon de la carrure
    aux bornes de `st` `bornes`), puis les transfère aux peaux `secondaires`. Les silhouettes présentes à
    l'appel servent de source. Rend `refinir(matrices)` : sur leurs décalages courants, `alterner` en région locale
    contre `ETIREMENT_DES_CLES` au repos et `ETIREMENT_EN_CLIP` sous les matrices de peau `matrices` (`en_clip`),
    avec la préparation de cet appel (poids, fondu, anneaux, `correction`) ; pose les clés, les transfère aux
    `secondaires`, et rend le nombre de sommets dont une clé a changé. Les clés traitées sont les entrées de
    `SILHOUETTES` présentes sur `corps`. Rend aussi `mesurer(matrices)`, en une passe de
    `poids.extremes` sur ces silhouettes de `corps` : le masque des arêtes du neutre hors de
    `ETIREMENT_EN_CLIP` sous `matrices`, et par clé celui de ses arêtes hors, dans son état sous `matrices` ou au repos
    hors de `ETIREMENT_DES_CLES`."""
    noms = [b.name for b in squelette.data.bones]
    x, w = peau_lineaire(corps, noms)
    groupe = jumeaux(x)
    libre = fondu(w, noms, extremites(squelette), groupe)
    repos = positions(corps.data)
    aretes = aretes_des_triangles(corps, groupe)
    cles = [nom for nom in SILHOUETTES if nom in noms_des_cles(corps)]
    rapports_de_st = rapports_de_carrure(bornes)
    bruts = {nom: (decalages(corps, nom), rapports_de_st.get(nom)) for nom in cles}
    for nom, (brut, _) in bruts.items():
        r = rapports(repos, brut * libre[:, None], aretes)
        print('SILHOUETTE', nom, 'brute sous le fondu : rapports au repos', round(float(r.min()), 4),
              round(float(r.max()), 3), flush=True)
    lus = anneaux(squelette, corps, x, w, noms)
    print('ANNEAUX', len(lus['anneaux']), '; le plus épais', lus['anneaux'][lus['lePlusEpais']]['os'],
          round(lus['anneaux'][lus['lePlusEpais']]['rayon'], 4), 'm ;',
          ' '.join(f"{a['os']}:{len(a['sommets'])}" for a in lus['anneaux']), flush=True)
    corriger = correction(x[:, :3].astype(numpy.float64), aretes, groupe, libre == 0, lus)
    vers_le_monde = numpy.array(corps.matrix_world.to_3x3()).T

    def au_repos(_, d):
        return hors_de(rapports(repos, d, aretes), ETIREMENT_DES_CLES)

    finis = alterner(bruts, repos, groupe, aretes, libre, corriger, vers_le_monde, au_repos, 'pleine')
    for nom, d in finis.items():
        poser_la_cle(corps, nom, d)
        print('SILHOUETTE', nom, 'amplitude', round(float(numpy.linalg.norm(bruts[nom][0], axis=1).max()), 4), '->',
              round(float(numpy.linalg.norm(d, axis=1).max()), 4), 'm ; extrémités',
              round(float(numpy.linalg.norm(d[libre == 0], axis=1).max(initial=0)), 6), 'm', flush=True)
    print('SILHOUETTES sommets invariants', int((libre == 0).sum()), 'en fondu', int(((libre > 0) & (libre < 1)).sum()),
          'sur', len(libre), flush=True)
    for peau in secondaires:
        transferer_les_cles(corps, peau, cles)
    longueurs = numpy.linalg.norm(x[aretes[:, 0], :3] - x[aretes[:, 1], :3], axis=1)
    sans_fondu = (libre > 0).astype(numpy.float64)

    def mesurer(matrices):
        courants = {nom: decalages(corps, nom) for nom in cles}
        bas, haut = extremes_au_monde(w, x, list(courants.values()), aretes, longueurs, matrices, vers_le_monde)
        hors = hors_de(bas, ETIREMENT_EN_CLIP) | hors_de(haut, ETIREMENT_EN_CLIP)
        return hors[0], {nom: au_repos(nom, d) | hors[1 + k] for k, (nom, d) in enumerate(courants.items())}

    def refinir(matrices):
        dans_le_clip = en_clip(w, x, aretes, longueurs, matrices, vers_le_monde)

        def hors(nom, d):
            return au_repos(nom, d) | dans_le_clip(nom, d)

        courants = {nom: (decalages(corps, nom), rapports_de_st.get(nom)) for nom in cles}
        refinis = alterner(courants, repos, groupe, aretes, sans_fondu, corriger, vers_le_monde, hors, 'locale')
        change = numpy.zeros(len(repos), dtype=bool)
        for nom, d in refinis.items():
            change |= ((repos + d).astype(numpy.float32) != positions(corps.data, nom)).any(axis=1)
            poser_la_cle(corps, nom, d)
        for peau in secondaires:
            transferer_les_cles(corps, peau, list(refinis))
        print('SILHOUETTES refinies : sommets changés', int(change.sum()), flush=True)
        return int(change.sum())

    return refinir, mesurer
