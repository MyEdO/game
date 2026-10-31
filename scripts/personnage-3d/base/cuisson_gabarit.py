"""hotes/godot/pont/CONTRAT.md, « Gabarit d'une base »."""
import json
from pathlib import Path

import numpy as np

from formes import aretes_des_triangles, aux_noeuds, decalages, positions, poser_la_cle
from poids import jumeaux, peau_lineaire
from script_node import lancer
from silhouettes import SILHOUETTES

ICI = Path(__file__).resolve().parent
ATTRIBUT_SOMMET = '_gabarit_sommet'
ATTRIBUT_COIN = '_gabarit_coin'


def bornes_du_gabarit():
    return json.loads(lancer(ICI / 'gabarit.mjs', [], json.dumps({'operation': 'bornes'})))


def matrice(m):
    return [m[r][c] for c in range(4) for r in range(4)]


def corps_du_gabarit(peau, noms, squelette):
    x, w = peau_lineaire(peau, noms)
    _, noeud = np.unique(jumeaux(x), return_inverse=True)
    poids = aux_noeuds(w, noeud)
    formes = [{'nom': nom, 'deltas': aux_noeuds(decalages(peau, nom), noeud).tolist()} for nom in SILHOUETTES
              if peau.data.shape_keys and nom in peau.data.shape_keys.key_blocks]
    corps = {'positions': aux_noeuds(x[:, :3], noeud).tolist(),
             'aretes': aretes_des_triangles(peau, noeud).tolist(),
             'poids': [[(int(o), float(ws[o])) for o in np.flatnonzero(ws)] for ws in poids],
             'squelette': squelette, 'silhouettes': formes}
    return corps, noeud


def cuire_gabarit(rig, peaux, table):
    noms = [b.name for b in rig.data.bones]
    index = {nom: i for i, nom in enumerate(noms)}
    mondes = {b.name: rig.matrix_world @ b.matrix_local for b in rig.data.bones}
    squelette = [{'nom': b.name, 'parent': index[b.parent.name] if b.parent else None,
                  'repos': matrice(mondes[b.parent.name].inverted() @ mondes[b.name] if b.parent else mondes[b.name]),
                  'boneInverse': matrice(mondes[b.name].inverted())} for b in rig.data.bones]
    references = []
    decalage = 0
    for peau in peaux:
        corps, noeud = corps_du_gabarit(peau, noms, squelette)
        nombre = len(noeud)
        resultat = json.loads(lancer(ICI / 'gabarit.mjs', [], json.dumps({'table': table, 'corps': corps})))
        for cle in resultat['cles']:
            poser_la_cle(peau, cle['nom'], np.array(cle['deltas'])[noeud])
        for etat in resultat['etats']:
            etat['positions'] = np.array(etat['positions'])[noeud].tolist()
        attribut = peau.data.attributes.new(ATTRIBUT_SOMMET, 'INT', 'POINT')
        attribut.data.foreach_set('value', np.arange(decalage, decalage + nombre, dtype=np.int32))
        print('GABARIT_CUIT', peau.name, 'ancres', resultat['ancres'], 'sommets', nombre, 'noeuds', len(corps['positions']),
              'cles', len(resultat['cles']), [c['nom'] for c in resultat['cles']], flush=True)
        references.append((decalage, nombre, resultat))
        decalage += nombre
    return references


def vers_gltf(x):
    return np.column_stack((x[:, 0], x[:, 2], -x[:, 1]))


def preparer_reference(peaux, references):
    etats = references[0][2]['etats']
    for _, _, reference in references:
        if [(e['nom'], e['poids']) for e in reference['etats']] != [(e['nom'], e['poids']) for e in etats]:
            raise RuntimeError('gabarit : états et poids différents entre les peaux')
    resolus = np.concatenate([np.array([e['positions'] for e in r['etats']]) for _, _, r in references], axis=1)
    positions_par_coin, normales_par_coin, normales_silhouettes_par_coin = [], [], []
    coin = 0
    for peau in peaux:
        ids = np.empty(len(peau.data.vertices), dtype=np.int32)
        peau.data.attributes[ATTRIBUT_SOMMET].data.foreach_get('value', ids)
        sommets_des_coins = np.array([c.vertex_index for c in peau.data.loops])
        attribut = peau.data.attributes.new(ATTRIBUT_COIN, 'INT', 'CORNER')
        attribut.data.foreach_set('value', np.arange(coin, coin + len(sommets_des_coins), dtype=np.int32))
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
            for nom, poids in etats[rang]['poids'].items():
                if not nom.startswith('gabarit_'):
                    silhouette += poids * decalages(peau, nom)
            cle = poser_la_cle(peau, 'oracle_silhouettes_seules', silhouette - positions(peau.data))
            ns.append(vers_gltf(np.array(cle.normals_split_get()).reshape(-1, 3)))
            peau.shape_key_remove(cle)
        positions_par_coin.append(np.array(p))
        normales_par_coin.append(np.array(n))
        normales_silhouettes_par_coin.append(np.array(ns))
        print('GABARIT_ORACLE', peau.name, len(sommets_des_coins), 'coins', len(etats), 'etats', flush=True)
    return {'etats': np.array(json.dumps([{k: v for k, v in e.items() if k != 'positions'} for e in etats])),
            'positions': np.concatenate(positions_par_coin, axis=1),
            'normales': np.concatenate(normales_par_coin, axis=1),
            'normales_silhouettes': np.concatenate(normales_silhouettes_par_coin, axis=1)}


def sauver_reference(chemin, reference):
    chemin.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(chemin, **reference)
