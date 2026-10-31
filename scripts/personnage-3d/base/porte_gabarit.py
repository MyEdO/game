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


def point_de_cuisson(etat):
    actifs = [(nom, poids) for nom, poids in etat['poids'].items() if poids != 0]
    return len(actifs) == 1 and actifs[0][0].startswith('gabarit_') and actifs[0][0].count('_') == 2 and actifs[0][1] == 1


def verifier_gabarit(chemin, reference):
    document, binaire = lire_glb(chemin)
    etats = json.loads(str(reference['etats']))
    erreurs = []
    mesures = {e['nom']: {'positions': [], 'angles': [], 'angles_silhouettes': [],
                         'point_cuisson': point_de_cuisson(e)} for e in etats}
    comptes = []
    vus = set()
    for mesh in document.get('meshes', []):
        noms = mesh.get('extras', {}).get('targetNames', [])
        comptes.append({'mesh': mesh.get('name'), 'cles': len(noms)})
        for primitive in mesh['primitives']:
            attributs = primitive['attributes']
            if '_GABARIT_COIN' not in attributs:
                raise RuntimeError(f"gabarit : {mesh.get('name')} sans identifiants de coin")
            ids_lus = lire_accesseur(document, binaire, attributs['_GABARIT_COIN']).ravel()
            ids = ids_lus.astype(np.int64)
            if (ids_lus != ids).any() or (ids < 0).any() or (ids >= reference['positions'].shape[1]).any():
                raise RuntimeError('gabarit : identifiants de coin invalides')
            vus.update(ids.tolist())
            base = lire_accesseur(document, binaire, attributs['POSITION'])
            normales = lire_accesseur(document, binaire, attributs['NORMAL'])
            cibles = primitive.get('targets', [])
            if len(noms) != len(cibles):
                raise RuntimeError('gabarit : noms de clés et cibles en nombre différent')
            par_nom = dict(zip(noms, cibles))
            for rang, etat in enumerate(etats):
                p, n, ns = base.copy(), normales.copy(), normales.copy()
                for nom, poids in etat['poids'].items():
                    if nom not in par_nom:
                        raise RuntimeError(f"gabarit : clé {nom} absente de {mesh.get('name')}")
                    cible = par_nom[nom]
                    if 'POSITION' not in cible or 'NORMAL' not in cible:
                        raise RuntimeError(f"gabarit : POSITION/NORMAL absent de {mesh.get('name')} {nom}")
                    p += poids * lire_accesseur(document, binaire, cible['POSITION'])
                    delta_normal = lire_accesseur(document, binaire, cible['NORMAL'])
                    n += poids * delta_normal
                    if not nom.startswith('gabarit_'):
                        ns += poids * delta_normal
                distances = np.linalg.norm(p - reference['positions'][rang, ids], axis=1)
                angles = angles_des_normales(n, reference['normales'][rang, ids])
                angles_silhouettes = angles_des_normales(ns, reference['normales_silhouettes'][rang, ids])
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


if __name__ == '__main__':
    with np.load(sys.argv[2], allow_pickle=False) as archive:
        verifier_gabarit(Path(sys.argv[1]), archive)
