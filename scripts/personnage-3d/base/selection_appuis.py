"""#3104 issuecomment-6549354475."""
import json
from pathlib import Path
from time import perf_counter

import numpy as np

from cuisson_gabarit import groupes_de_peau, vers_gltf
from pas_des_poids import appliquer, melanges_par_lots, par_groupes, piles_distinctes
from poids import peau_lineaire
from script_node import lancer
from sol import deplacements


def etats_des_appuis(table, silhouettes):
    return json.loads(lancer(Path(__file__).with_name('gabarit.mjs'), [], json.dumps({
        'operation': 'appuis', 'table': table, 'silhouettes': silhouettes})))


def selectionner_sommets(w, x, deltas, groupes, axe_vertical=2):
    def selectionner_groupe(groupe):
        etats, piles, _ = groupe
        retenus = set()
        positions = []
        for etat in etats:
            p = x.copy()
            for nom, poids in {**etat['poidsSilhouettes'], **etat['poidsGabarit']}.items():
                if poids:
                    p[:, :3] += poids * deltas[nom]
            positions.append(p)
        for pile, portes in piles_distinctes(piles):
            for melange in melanges_par_lots(w, pile):
                for e in portes:
                    altitude = appliquer(melange, positions[e])[:, :, axe_vertical]
                    retenus.update(np.flatnonzero((altitude == altitude.min(axis=1, keepdims=True)).any(axis=0)).tolist())
        return retenus
    return sorted(set().union(*par_groupes(selectionner_groupe, groupes)))


def copies_d_appui(x, w, deltas, noms, retenus):
    """Les sommets `retenus` en candidats d'appui du repère glTF, un par candidat distinct : leurs os de poids non nul et
    leurs deltas non nuls."""
    copies = [{'position': vers_gltf(x[i:i + 1, :3])[0].tolist(),
               'os': [{'nom': noms[o], 'poids': float(w[i, o])} for o in np.flatnonzero(w[i])],
               'deltas': {nom: vers_gltf(d[i:i + 1])[0].tolist() for nom, d in deltas.items() if np.any(d[i])}}
              for i in retenus]
    return list({json.dumps(c, sort_keys=True): c for c in copies}.values())


def selectionner_appuis(rig, peaux, clips, plantes, table, etats):
    debut = perf_counter()
    noms = [b.name for b in rig.data.bones]
    linearisees = [peau_lineaire(p, noms) for p in peaux]
    x = np.concatenate([p[0] for p in linearisees])
    w = np.concatenate([p[1] for p in linearisees])
    par_peau = [deplacements(p) for p in peaux]
    cles = dict.fromkeys(nom for champs in par_peau for nom in champs)
    deltas = {nom: np.concatenate([champs.get(nom, np.zeros((len(p[0]), 3))) for champs, p in zip(par_peau, linearisees)])
              for nom in cles}
    with groupes_de_peau(rig, clips, table, etats['etats'], plantes) as (_, groupes):
        retenus = selectionner_sommets(w, x, deltas, groupes)
    copies = copies_d_appui(x, w, deltas, noms, retenus)
    print('APPUIS_VECTORIEL', json.dumps({'etats': len(etats['etats']), 'sommets': len(x), 'candidats': len(copies),
                                        'secondes': perf_counter() - debut}), flush=True)
    return copies
