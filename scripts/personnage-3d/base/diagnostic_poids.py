"""#3104 issuecomment-6549354475."""
import json
import os
from pathlib import Path
import numpy as np
from pas_des_poids import appliquer, melanges_par_lots, piles_distinctes


def decrire_aretes(aretes, groupes, contexte, traces):
    resultats = [{'sommets': [int(a), int(b)], 'minimum': None, 'maximum': None, 'parEtat': []}
                 for a, b in aretes]
    for g, (groupe, trace) in enumerate(zip(groupes, traces)):
        positions = groupe[0]
        bas, haut = trace.bas, trace.haut
        ib, ih = trace.instants_bas, trace.instants_haut
        longueurs, repos, cotes_repos = trace.longueurs_reference, trace.rapports_repos, trace.cotes_repos
        etats = contexte.get('etats', [])[g] if g < len(contexte.get('etats', [])) else [
            {'nom': f'groupe-{g}-etat-{i}'} for i in range(len(positions))]
        bornes_clips = [('minimum', bas, ib), ('maximum', haut, ih)] if trace.clips_mesures else []
        for a, resultat in enumerate(resultats):
            domaine = trace.domaine_repos
            if np.isfinite(domaine.bas[a]):
                instant = int(domaine.instants[a])
                temps = contexte.get('echantillons', [])
                pose = temps[instant] if instant < len(temps) else {'clip': 'echantillon', 't': instant}
                mesure = {'clause': 'R', 'rapport': float(domaine.bas[a]),
                          'nature': 'EXACT' if domaine.exact[a] else 'CERTIFIÉ',
                          'basEstUneBorneInferieure': not bool(domaine.exact[a]),
                          'portee': 'exact sur les silhouettes, aux facteurs de etatsDuGabarit',
                          'cellule': str(domaine.cellules[a]), 'echantillon': instant,
                          'clip': pose['clip'], 't': float(pose['t']), 'cote': int(domaine.cotes[a]),
                          'poids': {n: float(p[a]) for n, p in domaine.poids.items()} if domaine.exact[a] else None}
                resultat.setdefault('domaine', []).append(mesure)
            for e, etat in enumerate(etats):
                if longueurs[e, a] <= 0:
                    continue
                mesures = {}
                for cle, valeurs, indices in bornes_clips:
                    instant = int(indices[e, a])
                    temps = contexte.get('echantillons', [])
                    pose = temps[instant] if instant < len(temps) else {'clip': 'echantillon', 't': instant}
                    mesures[cle] = {'etat': etat['nom'], 'clip': pose['clip'], 't': float(pose['t']),
                                    'echantillon': instant, 'l_b': float(longueurs[e, a]),
                                    'rapport': float(valeurs[e, a]),
                                    'longueurDeformee': float(valeurs[e, a] * longueurs[e, a])}
                    precedent = resultat[cle]
                    if precedent is None or (cle == 'minimum' and mesures[cle]['rapport'] < precedent['rapport']) or (
                            cle == 'maximum' and mesures[cle]['rapport'] > precedent['rapport']):
                        resultat[cle] = mesures[cle]
                if np.isfinite(repos[e, a]):
                    cote = int(cotes_repos[e, a])
                    mesures['repos'] = {'etat': etat['nom'], 'clip': 'repos', 't': 0.0, 'echantillon': 0,
                                        'clause': 'R', 'rapport': float(repos[e, a]),
                                        'l_b': float(longueurs[e, a]),
                                        'longueurDeformee': float(repos[e, a] * longueurs[e, a]),
                                        'seuil': trace.bornes_repos[cote] if cote >= 0 else None,
                                        'cote': cote}
                resultat['parEtat'].append(mesures)
    return resultats


def rapport(nom, passe, x, w, origine, aretes, jumeau, contraintes, groupes, contexte, traces):
    noms = contexte.get('noms', [str(i) for i in range(w.shape[1])])
    resultat = decrire_aretes(aretes, groupes, contexte, traces)
    fixes = set(map(int, contraintes))
    for entree, (a, b) in zip(resultat, aretes):
        entree['mesh'] = nom
        entree['osDominants'] = [noms[int(w[s].argmax())] for s in (a, b)]
        entree['osDominantsOrigine'] = [noms[int(origine[s].argmax())] for s in (a, b)]
        entree['fixes'] = [int(a) in fixes, int(b) in fixes]
        entree['jumeaux'] = [np.flatnonzero(jumeau == s).tolist() for s in (a, b)]
        entree['poids'] = [[{'os': noms[o], 'poids': float(w[s, o])} for o in np.flatnonzero(w[s])] for s in (a, b)]
        entree['l_b_neutre'] = float(np.linalg.norm(x[a, :3] - x[b, :3]))
        for mesures in entree['parEtat']:
            for mesure in mesures.values():
                mesure['l_b_sur_neutre'] = mesure['l_b'] / entree['l_b_neutre']
    return {'mesh': nom, 'passe': passe, 'aretes': resultat}


def chemin_du_refus(suffixe):
    prefixe = os.environ.get('DIAGNOSTIC_POIDS_PREFIXE')
    if not prefixe:
        return None
    chemin = Path(prefixe + suffixe)
    chemin.parent.mkdir(parents=True, exist_ok=True)
    return chemin


def publier(diagnostic):
    print('POIDS_REFUS', json.dumps(diagnostic, ensure_ascii=False), flush=True)
    chemin = chemin_du_refus('-refus.json')
    if chemin is not None:
        chemin.write_text(json.dumps(diagnostic, ensure_ascii=False, indent=2), encoding='utf-8')


def sauvegarder(etat, groupes):
    chemin = chemin_du_refus('-refus.npz')
    if chemin is None:
        return
    champs = {'x': etat['x'], 'w_initial': etat['origine'], 'w_final': etat['w'],
              'aretes': etat['aretes'], 'jumeau': etat['jumeau'], 'fixes': etat['contraintes'],
              'contexte': np.array(json.dumps(etat['diagnostic'], ensure_ascii=False))}
    if 'h5' in etat:
        champs['h5'] = np.array(json.dumps(etat['h5'], ensure_ascii=False))
    piles = {}
    description = []
    for i, groupe in enumerate(groupes):
        positions, references, matrices = groupe
        cle_positions = f'positions_{i}'
        cle_references = f'references_{i}'
        for pile in matrices:
            if id(pile) not in piles:
                piles[id(pile)] = len(piles)
                champs[f'matrices_{piles[id(pile)]}'] = pile
        champs[cle_positions] = positions
        champs[cle_references] = references
        description.append({'positions': cle_positions, 'references': cle_references,
                            'matrices': [piles[id(pile)] for pile in matrices], 'cellules': groupe.cellules,
                            'clips': list(groupe.clips)})
    champs['configuration'] = np.array(json.dumps({'nom': etat['nom'], 'groupes': description,
        'passe': etat['passe'], 'anneaux': etat['anneau'], 'retouches': sorted(etat['retouches']),
        'pieds': [list(map(int, pied)) for pied in etat['pieds']]}))
    np.savez_compressed(chemin, **champs)


def recharger(z, groupe):
    """Les piles par état d'un groupe de la `configuration` d'un refus sauvegardé (`sauvegarder`) relu en `z` : une
    même pile pour les états qui la partageaient."""
    piles = {k: z[f'matrices_{k}'] for k in set(groupe['matrices'])}
    return [piles[k] for k in groupe['matrices']]


def retournes(w, groupes, aretes, faces):
    """#3104 issuecomment-6565228921 B4 : par arête et par face, si elle s'oppose à au moins un état et un instant de clip de `groupes`
    à sa référence, son vecteur ou sa normale sans les poids, transportés par la matrice moyenne de ses sommets."""
    sommets, locales = np.unique(np.concatenate([aretes.ravel(), faces.ravel()]), return_inverse=True)
    locales = locales.reshape(-1)
    arete = locales[:aretes.size].reshape(aretes.shape)
    face = locales[aretes.size:].reshape(faces.shape)
    w = w[sommets].astype(np.float64)
    aretes_sorties, faces_sorties = np.zeros(len(aretes), dtype=bool), np.zeros(len(faces), dtype=bool)
    for positions, _, piles in groupes:
        for pile, etats in piles_distinctes(piles):
            for melange in melanges_par_lots(w, pile[1:]):
                lineaire = melange[:, :, :3, :3]
                for xs in positions[etats][:, sommets]:
                    p = appliquer(melange, xs)
                    x0 = xs[:, :3].astype(np.float64)
                    vecteur = p[:, arete[:, 0]] - p[:, arete[:, 1]]
                    moyenne = (lineaire[arete[:, 0]] + lineaire[arete[:, 1]]) / 2
                    reference = np.einsum('anij,aj->nai', moyenne, x0[arete[:, 0]] - x0[arete[:, 1]])
                    aretes_sorties |= (np.einsum('nai,nai->na', vecteur, reference) < 0).any(axis=0)
                    if len(faces):
                        normale = np.cross(p[:, face[:, 1]] - p[:, face[:, 0]], p[:, face[:, 2]] - p[:, face[:, 0]])
                        moyenne = lineaire[face].sum(axis=1) / 3
                        n0 = np.cross(x0[face[:, 1]] - x0[face[:, 0]], x0[face[:, 2]] - x0[face[:, 0]])
                        reference = np.einsum('anij,aj->nai', moyenne, n0)
                        faces_sorties |= (np.einsum('nai,nai->na', normale, reference) < 0).any(axis=0)
    return aretes_sorties, faces_sorties


def retournements_neufs(etat, faces):
    """#3104 issuecomment-6565228921 B4 : les arêtes et les faces incidentes aux sommets retouchés de la phase, retournées sous ses
    poids de sortie et pas sous ses poids d'entrée `etat['origine']`. `faces` : (faces, 3), entre nœuds."""
    retouches = sorted(etat['retouches'])
    aretes = etat['aretes'][np.isin(etat['aretes'], retouches).any(axis=1)]
    faces = faces[np.isin(faces, retouches).any(axis=1)]
    entree = retournes(etat['origine'], etat['groupes'], aretes, faces)
    sortie = retournes(etat['w'], etat['groupes'], aretes, faces)
    return {'aretes': int((sortie[0] & ~entree[0]).sum()), 'faces': int((sortie[1] & ~entree[1]).sum())}


def imprimer_retournements(etat, faces):
    """Le journal de `retournements_neufs`, sans seuil."""
    neufs = retournements_neufs(etat, faces)
    print('POIDS_RETOURNEMENTS', etat['nom'], 'arêtes', neufs['aretes'], 'faces', neufs['faces'], flush=True)
