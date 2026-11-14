"""hotes/godot/pont/CONTRAT.md, « Gabarit d'une base »."""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from contextlib import contextmanager

import numpy as np

from formes import aretes_des_triangles, aux_noeuds, decalages, positions, poser_la_cle
from poids import cadence, instants, jumeaux, peau_lineaire, poses
from portage import lire_os_des_silhouettes, portages_des_silhouettes, vers_le_mesh
from script_node import lancer
from noms_silhouettes import SILHOUETTES

ICI = Path(__file__).resolve().parent
ATTRIBUT_SOMMET = '_gabarit_sommet'


def bornes_du_gabarit():
    return json.loads(lancer(ICI / 'gabarit.mjs', [], json.dumps({'operation': 'bornes'})))


def etats_aux_facteurs_neutres(table, silhouettes):
    """`etatsAuxFacteursNeutres` et `cellulesSilhouettes` de `gabarit.mjs` : `{etats, cellulesSilhouettes}`."""
    return json.loads(lancer(ICI / 'gabarit.mjs', [], json.dumps({
        'operation': 'etatsAuxFacteursNeutres', 'table': table, 'silhouettes': silhouettes})))


def etats_du_gabarit(table, silhouettes):
    """`etatsDuGabarit` et `cellulesSilhouettes` de `gabarit.mjs` : `{etats, cellulesSilhouettes}`."""
    return json.loads(lancer(ICI / 'gabarit.mjs', [], json.dumps({
        'operation': 'etatsDuGabarit', 'table': table, 'silhouettes': silhouettes})))


def matrice(m):
    return [m[r][c] for c in range(4) for r in range(4)]


def squelette_du_gabarit(rig):
    """Les noms d'os de `rig` et son squelette pour `gabarit.mjs` : parent, repos relatif et inverse de bind."""
    noms = [b.name for b in rig.data.bones]
    index = {nom: i for i, nom in enumerate(noms)}
    mondes = {b.name: rig.matrix_world @ b.matrix_local for b in rig.data.bones}
    return noms, [{'nom': b.name, 'parent': index[b.parent.name] if b.parent else None,
                   'repos': matrice(mondes[b.parent.name].inverted() @ mondes[b.name] if b.parent else mondes[b.name]),
                   'boneInverse': matrice(mondes[b.name].inverted())} for b in rig.data.bones]


def corps_du_gabarit(peau, rig, champs=None):
    """L'entrée `corps` de `gabarit.mjs` pour `peau` skinnée à `rig`, aux nœuds de ses sommets jumeaux, et ce `noeud`
    par sommet. Les silhouettes sont `champs` (nom -> résidus par sommet, portage nul), à défaut les shape keys de
    `SILHOUETTES` de `peau`, T = C + d̃ (#4002 issuecomment-6817454030) : C le portage des os de la table de `rig`
    (`portage.lire_os_des_silhouettes`) sous les poids de `peau`, d̃ = T − C ; repère du mesh."""
    noms, squelette = squelette_du_gabarit(rig)
    x, w = peau_lineaire(peau, noms)
    _, noeud = np.unique(jumeaux(x), return_inverse=True)
    poids = aux_noeuds(w, noeud)
    portages = {}
    if champs is None:
        totaux = {nom: decalages(peau, nom) for nom in SILHOUETTES
                  if peau.data.shape_keys and nom in peau.data.shape_keys.key_blocks}
        tables = {nom: t for nom, t in lire_os_des_silhouettes(rig).items() if nom in totaux}
        portages = {nom: vers_le_mesh(peau, c) for nom, (_, c) in portages_des_silhouettes(rig, w, noms, tables).items()}
        champs = {nom: t - portages[nom] if nom in portages else t for nom, t in totaux.items()}
    corps = {'positions': aux_noeuds(x[:, :3], noeud).tolist(),
             'aretes': aretes_des_triangles(peau, noeud).tolist(),
             'poids': [[(int(o), float(ws[o])) for o in np.flatnonzero(ws)] for ws in poids],
             'squelette': squelette, 'silhouettes': formes_aux_noeuds(champs, portages, noeud)}
    return corps, noeud


def formes_aux_noeuds(champs, portages, noeud):
    """Les silhouettes de l'entrée `corps` de `gabarit.mjs`, aux nœuds `noeud` : `deltas` les résidus `champs` (nom ->
    décalages par sommet), `portage` le portage `portages` (nom -> décalages par sommet), nul sans entrée."""
    return [{'nom': nom, 'deltas': aux_noeuds(d, noeud).tolist(),
             'portage': aux_noeuds(portages[nom] if nom in portages else np.zeros_like(d), noeud).tolist()}
            for nom, d in champs.items()]


def cuisson_des_champs(rig, peau, table):
    """#3104 : des champs de silhouettes de `peau` (nom -> décalages par sommet) aux décalages par sommet des clés
    `gabarit_*` que `gabarit.mjs` (opération `cles`) cuit sur eux, sous les poids courants de `peau`. La clé croisée
    d'une silhouette ne lit que son champ (`cuire` de `gabarit.ts`) : seuls les champs changés depuis l'appel précédent
    repassent par `gabarit.mjs`."""
    corps, noeud = corps_du_gabarit(peau, rig, {})
    vus, cles, croisees = {}, {}, {}

    def cuire(champs):
        changes = {nom: d for nom, d in champs.items() if nom not in vus or not np.array_equal(vus[nom], d)}
        if changes or not cles:
            entree = {'operation': 'cles', 'table': table, 'corps': {**corps, 'silhouettes': formes_aux_noeuds(changes, {}, noeud)}}
            sortie = json.loads(lancer(ICI / 'gabarit.mjs', [], json.dumps(entree)))
            for nom in changes:
                vus[nom] = changes[nom].copy()
                croisees[nom] = {}
            for cle, silhouette in zip(sortie['cles'], sortie['silhouettes']):
                (croisees[silhouette] if silhouette else cles)[cle['nom']] = np.array(cle['deltas'])[noeud]
        return {**cles, **{nom: d for s in champs for nom, d in croisees[s].items()}}

    return cuire


def cuire_gabarit(rig, peaux, table, captures=None):
    references = []
    decalage = 0
    for peau in peaux:
        corps, noeud = corps_du_gabarit(peau, rig)
        nombre = len(noeud)
        entree = {'table': table, 'corps': corps}
        resultat = json.loads(lancer(ICI / 'gabarit.mjs', [], json.dumps(entree)))
        if captures is not None:
            captures[peau.name] = {'entree': json.loads(json.dumps(entree)), 'noeud': noeud.tolist(),
                                   'resultat': json.loads(json.dumps(resultat))}
        for cle in resultat['cles']:
            cle['deltas'] = np.array(cle['deltas'])[noeud].tolist()
        for etat in resultat['etats']:
            etat['positions'] = np.array(etat['positions'])[noeud].tolist()
        print('GABARIT_CUIT', peau.name, 'ancres', resultat['ancres'], 'sommets', nombre, 'noeuds', len(corps['positions']),
              'cles', len(resultat['cles']), [c['nom'] for c in resultat['cles']], flush=True)
        references.append((decalage, nombre, resultat))
        decalage += nombre
    return references


def exporter_gabarit(peaux, references):
    for peau, (decalage, nombre, resultat) in zip(peaux, references):
        for cle in resultat['cles']:
            poser_la_cle(peau, cle['nom'], np.array(cle['deltas']))
        attribut = peau.data.attributes.new(ATTRIBUT_SOMMET, 'INT', 'POINT')
        attribut.data.foreach_set('value', np.arange(decalage, decalage + nombre, dtype=np.int32))


def clips_plantes(declaration):
    """Les clips plantés de la déclaration du corps `declaration` (`clipsPlantes`, `hotes/godot/asset/gabarit.ts`)."""
    return json.loads(lancer(ICI / 'gabarit.mjs', [], json.dumps({
        'operation': 'clipsPlantes', **{cle: declaration[cle] for cle in ('clips', 'clipsDeuxMains') if cle in declaration}})))


@contextmanager
def groupes_de_peau(rig, clips, table, etats, plantes, diagnostic=None):
    """Les noms d'os de `rig` et, par jeu de facteurs des `etats`, `(etats, matrices, longueurs des clips)` : par état,
    les matrices de peau de `gabarit.mjs` (opération `matrices`) au repos puis à chaque instant des `clips`, jambes
    pliées sur les clips de `plantes` (`clips_plantes`), lues en memmap ; une pile par fichier, partagée entre les
    états de mêmes facteurs et de mêmes poids des silhouettes à os (#4002 issuecomment-6817454030)."""
    noms, squelette = squelette_du_gabarit(rig)
    with TemporaryDirectory(prefix='gabarit-peau-') as dossier:
        chemin = Path(dossier) / 'poses.bin'
        neutre = np.array([[rig.matrix_world @ b.matrix_local for b in rig.data.bones]])
        des_clips = [poses(rig, a) for a in clips]
        np.concatenate([neutre, *des_clips]).astype(np.float32).tofile(chemin)
        groupes = json.loads(lancer(ICI / 'gabarit.mjs', [], json.dumps({
            'operation': 'matrices', 'table': table, 'corps': {'squelette': squelette},
            'clips': [[a.name, len(p)] for a, p in zip(clips, des_clips)], 'plantes': list(plantes),
            'poses': str(chemin), 'sortie': dossier, 'etats': etats})))
        groupes = groupes['groupes']
        if diagnostic is not None:
            diagnostic['echantillons'] = [{'clip': 'repos', 't': 0.0}] + [
                {'clip': a.name, 't': float(t / cadence())} for a in clips for t in instants(a)]
            diagnostic['etats'] = [g['etats'] for g in groupes]
        piles, fichiers, jeux = [], [], {}
        try:
            for groupe in groupes:
                for nom in groupe['fichiers']:
                    if nom not in jeux:
                        fichier = np.memmap(nom, dtype=np.float32, mode='r')
                        fichiers.append(fichier)
                        jeux[nom] = fichier.reshape(-1, len(noms), 4, 4)
                piles.append((groupe['etats'], [jeux[groupe['fichiers'][j]] for j in groupe['jeux']],
                              [len(p) for p in des_clips]))
            print('GABARIT_MATRICES', len(etats), 'états', len(jeux), 'jeux', len(piles[0][1][0]), 'échantillons',
                  flush=True)
            yield noms, piles
        finally:
            for fichier in fichiers:
                fichier._mmap.close()
            piles.clear()
            fichiers.clear()
            jeux.clear()


def vers_gltf(x):
    return np.column_stack((x[:, 0], x[:, 2], -x[:, 1]))


def preparer_reference(peaux, references):
    etats = references[0][2]['etats']
    for _, _, reference in references:
        if reference['sensCuits'] != references[0][2]['sensCuits'] or [
                {k: v for k, v in e.items() if k != 'positions'} for e in reference['etats']] != [
                {k: v for k, v in e.items() if k != 'positions'} for e in etats]:
            raise RuntimeError('gabarit : états et poids différents entre les peaux')
    resolus = np.concatenate([np.array([e['positions'] for e in r['etats']]) for _, _, r in references], axis=1)
    positions_par_coin, normales_par_coin, normales_silhouettes_par_coin = [], [], []
    coin = 0
    bases, triangles, meshes = [], [], []
    for peau in peaux:
        ids = np.empty(len(peau.data.vertices), dtype=np.int32)
        peau.data.attributes[ATTRIBUT_SOMMET].data.foreach_get('value', ids)
        peau.data.attributes.remove(peau.data.attributes[ATTRIBUT_SOMMET])
        sommets_des_coins = np.array([c.vertex_index for c in peau.data.loops])
        peau.data.calc_loop_triangles()
        debut = sum(len(t) for t in triangles)
        triangles.append(np.array([t.loops for t in peau.data.loop_triangles], dtype=np.int64) + coin)
        meshes.append({'nom': peau.data.name, 'triangles': [debut, debut + len(triangles[-1])],
                       'coins': [coin, coin + len(sommets_des_coins)]})
        bases.append(vers_gltf(positions(peau.data)[sommets_des_coins]).astype(np.float32))
        coin += len(sommets_des_coins)
        p, n, ns = [], [], []
        for rang, etat in enumerate(resolus):
            co = etat[ids]
            cle = poser_la_cle(peau, 'oracle_h5_direct', co - positions(peau.data))
            p.append(vers_gltf(co[sommets_des_coins]))
            normales = np.array(cle.normals_split_get()).reshape(-1, 3)
            n.append(vers_gltf(normales))
            peau.shape_key_remove(cle)
            silhouette = positions(peau.data).copy()
            for nom, poids in etats[rang]['poidsSilhouettes'].items():
                silhouette += poids * decalages(peau, nom)
            cle = poser_la_cle(peau, 'oracle_silhouettes_seules', silhouette - positions(peau.data))
            ns.append(vers_gltf(np.array(cle.normals_split_get()).reshape(-1, 3)))
            peau.shape_key_remove(cle)
        positions_par_coin.append(np.array(p))
        normales_par_coin.append(np.array(n))
        normales_silhouettes_par_coin.append(np.array(ns))
        print('GABARIT_ORACLE', peau.name, len(sommets_des_coins), 'coins', len(etats), 'etats', flush=True)
    return {'etats': np.array(json.dumps([{k: v for k, v in e.items() if k != 'positions'} for e in etats])),
            'sens_cuits': np.array(references[0][2]['sensCuits']),
            'base': np.concatenate(bases), 'triangles': np.concatenate(triangles), 'meshes': np.array(json.dumps(meshes)),
            'positions': np.concatenate(positions_par_coin, axis=1),
            'normales': np.concatenate(normales_par_coin, axis=1),
            'normales_silhouettes': np.concatenate(normales_silhouettes_par_coin, axis=1)}
