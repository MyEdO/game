"""#3104 issuecomment-6547804765."""
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from glb import lire_accesseur, lire_glb  # noqa: E402

SEUIL_POSITION_M = 1e-5
SEUIL_P99_DEGRES = 1.0
SEUIL_MAX_DEGRES = 2.0


def normaliser(n):
    normes = np.linalg.norm(n, axis=1)
    if not np.isfinite(n).all() or (normes <= 1e-15).any():
        raise RuntimeError('gabarit : normales non finies ou nulles')
    return n / normes[:, None]


def angles_des_normales(n, reference):
    a, b = normaliser(n), normaliser(reference)
    return np.degrees(np.arctan2(np.linalg.norm(np.cross(a, b), axis=1), (a * b).sum(axis=1)))


def correspondance_des_coins(document, binaire, mesh, reference):
    descriptions = [m for m in json.loads(str(reference['meshes'])) if m['nom'] == mesh.get('name')]
    if len(descriptions) != 1:
        raise RuntimeError('gabarit : mesh de référence absent ou ambigu')
    description = descriptions[0]
    debut, fin = description['triangles']
    sources = {}
    for triangle in reference['triangles'][debut:fin]:
        for rotation in range(3):
            coins = np.roll(triangle, -rotation)
            cle = tuple(reference['base'][coins].astype(np.float32).ravel())
            sources.setdefault(cle, []).append(coins)
    couvert = set()
    correspondances = []
    fusions = 0
    divergents = 0
    ecart_position = 0.0
    ecart_angle = 0.0
    for primitive in mesh['primitives']:
        attributs = primitive['attributes']
        if any(nom.startswith('_') for nom in attributs):
            raise RuntimeError('gabarit : attribut livré sans consommateur')
        base = lire_accesseur(document, binaire, attributs['POSITION'])
        normales = lire_accesseur(document, binaire, attributs['NORMAL'])
        if base.shape != normales.shape or not np.isfinite(base).all():
            raise RuntimeError('gabarit : attributs de base invalides')
        lus = (lire_accesseur(document, binaire, primitive['indices']).ravel()
               if 'indices' in primitive else np.arange(len(base)))
        ids = lus.astype(np.int64)
        if (lus != ids).any() or (ids < 0).any() or (ids >= len(base)).any() or len(ids) % 3:
            raise RuntimeError('gabarit : indices de sommet invalides')
        par_sommet = [set() for _ in base]
        for triangle in ids.reshape(-1, 3):
            cle = tuple(base[triangle].astype(np.float32).ravel())
            candidats = sources.get(cle)
            if not candidats:
                raise RuntimeError('gabarit : triangle livré sans référence')
            for coins in candidats:
                couvert.update(coins.tolist())
                for sommet, coin in zip(triangle, coins):
                    par_sommet[sommet].add(int(coin))
        sommets_livres, coins_sources = [], []
        for sommet, coins in enumerate(par_sommet):
            if not coins:
                raise RuntimeError('gabarit : sommet livré sans coin')
            coins = sorted(coins)
            if len(coins) > 1:
                different = False
                for champ in ('positions', 'normales', 'normales_silhouettes'):
                    valeurs = reference[champ][:, coins]
                    different |= not np.all(valeurs == valeurs[:, :1])
                    if champ == 'positions':
                        ecart_position = max(ecart_position, float(np.linalg.norm(
                            valeurs[:, :, None] - valeurs[:, None, :], axis=3).max()))
                    else:
                        unites = normaliser(valeurs.reshape(-1, 3)).reshape(valeurs.shape)
                        angles = np.degrees(np.arctan2(
                            np.linalg.norm(np.cross(unites[:, :, None], unites[:, None, :]), axis=3),
                            (unites[:, :, None] * unites[:, None, :]).sum(axis=3)))
                        ecart_angle = max(ecart_angle, float(angles.max()))
                divergents += int(different)
            fusions += len(coins) - 1
            sommets_livres.extend([sommet] * len(coins))
            coins_sources.extend(coins)
        correspondances.append((np.array(sommets_livres, dtype=np.int64), np.array(coins_sources, dtype=np.int64)))
    if couvert != set(range(*description['coins'])):
        raise RuntimeError(f"gabarit : couverture des coins {len(couvert)}/{description['coins'][1] - description['coins'][0]}")
    print('GABARIT_FUSIONS', json.dumps({'mesh': mesh.get('name'), 'fusions': fusions,
                                       'references_differentes': divergents, 'position_max_m': ecart_position,
                                       'normale_max_deg': ecart_angle}), flush=True)
    return correspondances, couvert


def verifier_gabarit(chemin, reference):
    document, binaire = lire_glb(chemin)
    etats = json.loads(str(reference['etats']))
    if sum(e['pointCuisson'] for e in etats) != int(reference['sens_cuits']):
        raise RuntimeError('gabarit : nombre de points de cuisson différent des sens cuits')
    erreurs = []
    mesures = {e['nom']: {'positions': [], 'angles': [], 'angles_silhouettes': [],
                         'point_cuisson': e['pointCuisson']} for e in etats}
    comptes = []
    vus = set()
    for mesh in document.get('meshes', []):
        noms = mesh.get('extras', {}).get('targetNames', [])
        comptes.append({'mesh': mesh.get('name'), 'cles': len(noms)})
        correspondances, couvert = correspondance_des_coins(document, binaire, mesh, reference)
        vus.update(couvert)
        for primitive, (sommets, ids) in zip(mesh['primitives'], correspondances):
            attributs = primitive['attributes']
            base = lire_accesseur(document, binaire, attributs['POSITION'])
            normales = lire_accesseur(document, binaire, attributs['NORMAL'])
            cibles = primitive.get('targets', [])
            if len(noms) != len(cibles):
                raise RuntimeError('gabarit : noms de clés et cibles en nombre différent')
            par_nom = dict(zip(noms, cibles))
            for rang, etat in enumerate(etats):
                p, n, ns = base.copy(), normales.copy(), normales.copy()
                for nom, poids in {**etat['poidsSilhouettes'], **etat['poidsGabarit']}.items():
                    if nom not in par_nom:
                        raise RuntimeError(f"gabarit : clé {nom} absente de {mesh.get('name')}")
                    cible = par_nom[nom]
                    if 'POSITION' not in cible or 'NORMAL' not in cible:
                        raise RuntimeError(f"gabarit : POSITION/NORMAL absent de {mesh.get('name')} {nom}")
                    p += poids * lire_accesseur(document, binaire, cible['POSITION'])
                    delta_normal = lire_accesseur(document, binaire, cible['NORMAL'])
                    n += poids * delta_normal
                    if nom in etat['poidsSilhouettes']:
                        ns += poids * delta_normal
                distances_par_coin = np.linalg.norm(p[sommets] - reference['positions'][rang, ids], axis=1)
                angles_par_coin = angles_des_normales(n[sommets], reference['normales'][rang, ids])
                silhouettes_par_coin = angles_des_normales(ns[sommets], reference['normales_silhouettes'][rang, ids])
                distances, angles, angles_silhouettes = (np.zeros(len(base)) for _ in range(3))
                np.maximum.at(distances, sommets, distances_par_coin)
                np.maximum.at(angles, sommets, angles_par_coin)
                np.maximum.at(angles_silhouettes, sommets, silhouettes_par_coin)
                mesures[etat['nom']]['positions'].extend(distances.tolist())
                mesures[etat['nom']]['angles'].extend(angles.tolist())
                mesures[etat['nom']]['angles_silhouettes'].extend(angles_silhouettes.tolist())
                if not np.isfinite(distances).all() or not np.isfinite(angles).all() or not np.isfinite(angles_silhouettes).all():
                    raise RuntimeError('gabarit : mesure non finie')
    if vus != set(range(reference['positions'].shape[1])):
        raise RuntimeError(f"gabarit : couverture des coins {len(vus)}/{reference['positions'].shape[1]}")
    for nom, mesure in mesures.items():
        position = max(mesure['positions'])
        p99, maximum = float(np.percentile(mesure['angles'], 99)), max(mesure['angles'])
        refuse = position > SEUIL_POSITION_M or (mesure['point_cuisson'] and (p99 > SEUIL_P99_DEGRES or maximum > SEUIL_MAX_DEGRES))
        print('GABARIT_PORTE', json.dumps({'etat': nom, 'position_max_m': position, 'normale_p99_deg': p99,
                                        'normale_max_deg': maximum, 'normales_bloquantes': mesure['point_cuisson'],
                                        'silhouettes_seules_p99_deg': float(np.percentile(mesure['angles_silhouettes'], 99)),
                                        'silhouettes_seules_max_deg': max(mesure['angles_silhouettes']), 'ok': not refuse}), flush=True)
        if refuse:
            erreurs.append(nom)
    print('GABARIT_MESHES', json.dumps(comptes), flush=True)
    if erreurs:
        raise RuntimeError(f'gabarit : porte refusée sur {len(erreurs)} état(s) : {", ".join(erreurs)}')
    print('GABARIT_PORTE_OK', len(mesures), 'etats', flush=True)
