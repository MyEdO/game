"""Construction des éléments sur base (#3743) : chaque élément d'`element/<base>/` reconstruit depuis le dépôt, sur les GLB
épinglés lus dans le cache des modèles (`CACHE_DES_MODELES` de `hotes/godot/asset/release.ts`, que remplit `godot:sonde`
avant ce test en CI), reproduit le manifeste publié sous `hotes/godot/projet/modeles/` (`ecarts_du_manifeste`), son empreinte de GLB à part,
et la forme du GLB publié (`forme`, `ecarts`), au flottant près, avec l'enveloppe de production et les licences des packs
de la base : sur la même roue bpy, la file de fusion de #3795 a reconstruit chaque GLB à quelques dizaines d'octets du
publié, et une position d'emplacement au dernier chiffre arrondi près. Ses clés de forme (`cles`) : celles de la base, les
silhouettes qu'elle déclare suivies de ses clés `gabarit_*`, et les clés propres du GLB publié (ni l'une ni l'autre), aux
mêmes valeurs, qu'une reprise (`element/publie.py`) garde. Seul se reconstruit un élément dont une entrée a changé depuis
la base du diff, tous sous `WFRP_3D_TOUT=1` (`entrees.py`, #3412), chacun ne lisant que ses entrées ; chaque élément a son
manifeste publié à chaque course. Une peau qui remplace des zones de la base (couche `peau`, `couvre` non vide : une tête)
suit la base à leur couture, au repos et sous chaque clé de la base (`derives_de_la_couture`, #4413) : la reconstruite, et
à chaque course la publiée contre la base épinglée, sans Blender."""
import hashlib
import json
import os
import sys
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI))
from entrees import (a_reconstruire, changements, construire_en_relevant, lectures_hors_entrees, sujets_des_elements,  # noqa: E402
                     sujets_sans_base)
from glb import lire_accesseur, lire_glb  # noqa: E402
from production import CACHE_DES_MODELES, MODELES  # noqa: E402

ECART_DE_POSITION_MAX = 1e-4   # m, entre deux bornes de positions ou deux translations de nœud
ECART_DE_ROTATION_MAX = 1e-4   # composante de quaternion
ECART_DE_COMPTE_MAX = 0.02     # part des sommets ou des indices d'une primitive
ECART_DE_VALEUR_MAX = 2e-4     # nombre d'un manifeste, arrondi au plus à 4 décimales (`poids` de `Base.offrir`)
ECART_DE_COUTURE_MAX = 1e-6    # m, entre un sommet de couture et son jumeau : le flottant simple de l'export, position et clé sommées


def lire(chemin):
    return json.loads(chemin.read_text(encoding='utf-8'))


def forme(chemin):
    """Ce que pose le GLB `chemin` : ses nœuds (nom, parent, mesh, peau, translation, rotation), par mesh ses primitives
    (matériau, sommets, indices, bornes des positions) et les articulations de ses peaux, par nom."""
    doc, _ = lire_glb(chemin)
    noeuds, acces = doc.get('nodes', []), doc.get('accessors', [])
    parents = {c: i for i, n in enumerate(noeuds) for c in n.get('children', [])}
    nom = lambda i: noeuds[i].get('name') if i is not None else None
    materiau = lambda p: doc['materials'][p['material']].get('name') if 'material' in p else None
    return {
        'noeuds': [{'nom': n.get('name'), 'parent': nom(parents.get(i)), 'mesh': doc['meshes'][n['mesh']].get('name') if 'mesh' in n else None,
                    'peau': 'skin' in n, 'translation': n.get('translation', [0, 0, 0]), 'rotation': n.get('rotation', [0, 0, 0, 1])}
                   for i, n in enumerate(noeuds)],
        'meshes': {m.get('name'): [{'materiau': materiau(p), 'sommets': acces[p['attributes']['POSITION']]['count'],
                                    'indices': acces[p['indices']]['count'] if 'indices' in p else 0,
                                    'bornes': acces[p['attributes']['POSITION']]['min'] + acces[p['attributes']['POSITION']]['max']}
                                   for p in m['primitives']] for m in doc.get('meshes', [])},
        'peaux': [[nom(j) for j in s['joints']] for s in doc.get('skins', [])],
    }


def ecarts(a, b):
    """Les écarts entre deux formes (`forme`) au-delà des tolérances : la structure à l'identique, positions et rotations à
    `ECART_DE_POSITION_MAX` et `ECART_DE_ROTATION_MAX` près, comptes à `ECART_DE_COMPTE_MAX` près."""
    proche = lambda u, v, e: len(u) == len(v) and all(abs(x - y) <= e for x, y in zip(u, v))
    compte = lambda u, v: abs(u - v) <= max(1, ECART_DE_COMPTE_MAX * max(u, v))
    structure = lambda f: ([{k: n[k] for k in ('nom', 'parent', 'mesh', 'peau')} for n in f['noeuds']], f['peaux'],
                           {m: [p['materiau'] for p in ps] for m, ps in f['meshes'].items()})
    if structure(a) != structure(b):
        return [('structure', structure(a), structure(b))]
    fautes = [(n['nom'], 'transformation') for n, o in zip(a['noeuds'], b['noeuds'])
              if not (proche(n['translation'], o['translation'], ECART_DE_POSITION_MAX) and proche(n['rotation'], o['rotation'], ECART_DE_ROTATION_MAX))]
    for m, ps in a['meshes'].items():
        for k, (p, q) in enumerate(zip(ps, b['meshes'][m])):
            if not (compte(p['sommets'], q['sommets']) and compte(p['indices'], q['indices']) and proche(p['bornes'], q['bornes'], ECART_DE_POSITION_MAX)):
                fautes.append((m, k, p, q))
    return fautes


def cles(chemin):
    """Les clés de forme du GLB `chemin`, par mesh : `{nom: décalages des sommets de ses primitives mises bout à bout}`,
    dans l'ordre des cibles."""
    doc, binaire = lire_glb(chemin)
    return {m.get('name'): {nom: np.concatenate([lire_accesseur(doc, binaire, p['targets'][k]['POSITION']) for p in m['primitives']])
                            for k, nom in enumerate(m.get('extras', {}).get('targetNames', []))}
            for m in doc.get('meshes', [])}


def gabarits(chemin):
    """Les clés `gabarit_*` de la base `chemin`, dans l'ordre des cibles de son premier mesh qui en porte."""
    doc, _ = lire_glb(chemin)
    return [k for k in next(m['extras']['targetNames'] for m in doc['meshes'] if m.get('extras', {}).get('targetNames'))
            if k.startswith('gabarit_')]


def ecarts_des_cles(produites, publiees, silhouettes, de_gabarit):
    """Les écarts des clés `produites` (`cles`) aux attendues, par mesh : les clés de la base, `silhouettes` suivies de
    `de_gabarit`, à l'identique et dans cet ordre ; les autres, celles de `publiees` pour ce mesh, aux mêmes noms et au même
    décalage à `ECART_DE_POSITION_MAX` près."""
    de_base = lambda k: k in silhouettes or k.startswith('gabarit_')
    fautes = []
    for m, produit in produites.items():
        if produit and [k for k in produit if de_base(k)] != silhouettes + de_gabarit:
            fautes.append((m, 'clés de base', [k for k in produit if de_base(k)]))
        propres = {k: v for k, v in produit.items() if not de_base(k)}
        attendues = {k: v for k, v in publiees.get(m, {}).items() if not de_base(k)}
        if propres.keys() != attendues.keys():
            fautes.append((m, 'clés propres', sorted(propres), sorted(attendues)))
            continue
        fautes += [(m, k, 'décalages') for k in propres
                   if propres[k].shape != attendues[k].shape or np.abs(propres[k] - attendues[k]).max() > ECART_DE_POSITION_MAX]
    return fautes


def etats(chemin, garde=lambda zone: True):
    """Les sommets des meshes du GLB `chemin` dont la zone (`extras.zone` du nœud, `None` hors de la base) passe `garde`,
    mis bout à bout : (positions au repos, `{clé: décalages}`), une clé qu'un mesh ne porte pas nulle sur ses sommets."""
    doc, binaire = lire_glb(chemin)
    positions, decalages = [], {}
    for noeud in doc['nodes']:
        if 'mesh' not in noeud or not garde(noeud.get('extras', {}).get('zone')):
            continue
        mesh = doc['meshes'][noeud['mesh']]
        noms = mesh.get('extras', {}).get('targetNames', [])
        for p in mesh['primitives']:
            avant = sum(len(q) for q in positions)
            positions.append(lire_accesseur(doc, binaire, p['attributes']['POSITION']))
            for k, nom in enumerate(noms):
                decalages.setdefault(nom, []).append((avant, lire_accesseur(doc, binaire, p['targets'][k]['POSITION'])))
    repos = np.concatenate(positions) if positions else np.zeros((0, 3))
    cles_ = {}
    for nom, morceaux in decalages.items():
        cles_[nom] = np.zeros_like(repos)
        for avant, d in morceaux:
            cles_[nom][avant:avant + len(d)] = d
    return repos, cles_


def derives_de_la_couture(element, base, couvre, de_base):
    """#4413. Les dérives de la peau `element`, qui remplace les zones `couvre` de la base `base` (deux GLB), à leur
    couture : les sommets des autres zones de la base confondus au repos avec un sommet d'une zone de `couvre`. Chacun a
    dans l'élément ses jumeaux, confondus au repos, et sous chaque clé de `de_base` tous le suivent, à
    `ECART_DE_COUTURE_MAX` près : rend `[(état, sommets de couture en défaut, pire écart)]`, l'état `'repos'` pour un
    sommet sans jumeau, et `('couture', 0, 0.0)` si la base n'a pas de couture avec ces zones."""
    proches = lambda P, Q: np.linalg.norm(P[:, None] - Q[None], axis=2)
    remplace, _ = etats(base, lambda zone: zone in couvre)
    voisins, cles_des_voisins = etats(base, lambda zone: zone not in couvre)
    de_couture = ((voisins >= remplace.min(axis=0) - ECART_DE_COUTURE_MAX) & (voisins <= remplace.max(axis=0) + ECART_DE_COUTURE_MAX)).all(axis=1)
    de_couture[de_couture] = proches(voisins[de_couture], remplace).min(axis=1) <= ECART_DE_COUTURE_MAX
    if not de_couture.any():
        return [('couture', 0, 0.0)]
    S = voisins[de_couture]
    X, cles_de_l_element = etats(element)
    d = proches(S, X)
    jumeaux = d <= ECART_DE_COUTURE_MAX
    seuls = ~jumeaux.any(axis=1)
    fautes = [('repos', int(seuls.sum()), float(d.min(axis=1)[seuls].max()))] if seuls.any() else []
    for nom in de_base:
        if nom not in cles_de_l_element:
            fautes.append((nom, int(len(S)), float('inf')))
            continue
        du_cou = S + cles_des_voisins[nom][de_couture] if nom in cles_des_voisins else S
        pire = np.where(jumeaux, proches(du_cou, X + cles_de_l_element[nom]), 0.0).max(axis=1)
        if (pire > ECART_DE_COUTURE_MAX).any():
            fautes.append((nom, int((pire > ECART_DE_COUTURE_MAX).sum()), float(pire.max())))
    return fautes


def remplace_la_base(manifeste):
    """Les zones de la base que la peau `manifeste` remplace : son `couvre` si sa couche est `peau`, sinon rien."""
    return manifeste.get('couvre', []) if manifeste.get('couche') == 'peau' else []


def ecarts_du_manifeste(a, b, chemin='manifeste'):
    """Les écarts entre deux manifestes : chaque clé, chaque longueur et chaque valeur non numérique à l'identique, chaque
    nombre à `ECART_DE_VALEUR_MAX` près."""
    if isinstance(a, dict) and isinstance(b, dict):
        if a.keys() != b.keys():
            return [(chemin, sorted(a), sorted(b))]
        return [e for k in a for e in ecarts_du_manifeste(a[k], b[k], f'{chemin}.{k}')]
    if isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            return [(chemin, a, b)]
        return [e for i, (u, v) in enumerate(zip(a, b)) for e in ecarts_du_manifeste(u, v, f'{chemin}[{i}]')]
    nombre = lambda x: isinstance(x, (int, float)) and not isinstance(x, bool)
    if nombre(a) and nombre(b):
        return [] if abs(a - b) <= ECART_DE_VALEUR_MAX else [(chemin, a, b)]
    return [] if type(a) is type(b) and a == b else [(chemin, a, b)]


class Reconstruction(unittest.TestCase):

    def test_chaque_element_reproduit_son_publie(self):
        """Chaque élément dont une entrée a changé (`entrees.a_reconstruire`), reconstruit sous le relevé de ses lectures,
        reproduit son publié et ne lit que ses entrées ; les autres sont sautés en le disant."""
        change = changements()
        elements = sujets_des_elements()
        self.assertTrue(elements, f"aucun élément sous {ICI / 'element'}")
        sujets = elements + sujets_sans_base()
        print(f"[test_element] base {change['base'] or '(aucune)'}" + (f" : {change['motif']}" if change['motif'] else ''))
        with tempfile.TemporaryDirectory() as tmp, ThreadPoolExecutor(max_workers=os.cpu_count()) as file:
            construire = lambda element: construire_en_relevant([ICI / 'element' / 'construire.py', element, '--sortie', Path(tmp) / element],
                                                                capture_output=True, text=True, env={**os.environ, 'PYTHONDONTWRITEBYTECODE': '1'}, timeout=270)
            nom = lambda s: s['dossier'].removeprefix('scripts/personnage-3d/element/').rstrip('/')
            constructions = {nom(s): file.submit(construire, nom(s)) for s in elements if a_reconstruire(s, sujets, change)}
            for s in elements:
                element = nom(s)
                base, dossier = element.split('/')
                id_ = f'{base}--{dossier}'
                with self.subTest(element=element):
                    if element not in constructions:
                        self.skipTest(f"aucune entrée de {id_} changée depuis {change['base']}")
                    vu, lus = constructions[element].result()
                    self.assertEqual(vu.returncode, 0, vu.stdout[-2000:] + vu.stderr[-2000:])
                    self.assertEqual(lectures_hors_entrees(lus, s, sujets, change['racines']), [], f'{id_} lit hors de ses entrées (`entrees.est_entree`)')
                    produit = Path(tmp) / element / id_
                    manifeste = lire(produit / f'{id_}.element.json')
                    octets = (produit / f'{id_}.glb').read_bytes()
                    self.assertEqual(manifeste['glb'], {'sha256': hashlib.sha256(octets).hexdigest(), 'octets': len(octets)})
                    self.assertEqual(lire(produit / 'manifest.json'), {'model': f'{id_}.glb', 'model_sha256': manifeste['glb']['sha256'], 'manifeste': manifeste})
                    licences = {l['fichier'] for l in lire(MODELES / f'{base}.provenance.json')['licences_de_pack']}
                    self.assertEqual({p.name for p in produit.glob('LICENSE*.txt')}, licences)
                    de_la_base = lire(MODELES / f'{base}.manifeste.json')
                    glb_de_base = CACHE_DES_MODELES / f"{de_la_base['glb']['sha256']}.glb"
                    if remplace_la_base(manifeste):
                        self.assertEqual(derives_de_la_couture(produit / f'{id_}.glb', glb_de_base, remplace_la_base(manifeste),
                                                               de_la_base['silhouettes'] + gabarits(glb_de_base)), [],
                                         f'{id_} reconstruit ne suit pas la base à sa couture')
                    publie = MODELES / f'{id_}.manifeste.json'
                    self.assertTrue(publie.exists(), f'{id_} : aucun manifeste publié sous {MODELES}')
                    publie = lire(publie)
                    self.assertEqual(ecarts_du_manifeste({k: v for k, v in manifeste.items() if k != 'glb'}, {k: v for k, v in publie.items() if k != 'glb'}), [])
                    self.assertEqual(ecarts(forme(produit / f'{id_}.glb'), forme(CACHE_DES_MODELES / f"{publie['glb']['sha256']}.glb")), [])
                    self.assertEqual(ecarts_des_cles(cles(produit / f'{id_}.glb'), cles(CACHE_DES_MODELES / f"{publie['glb']['sha256']}.glb"),
                                                     de_la_base['silhouettes'], gabarits(glb_de_base)), [])

    def test_chaque_peau_publiee_suit_la_base_a_sa_couture(self):
        """#4413. Chaque élément publié qui remplace des zones de la base (`remplace_la_base`) la suit à leur couture, sur
        les GLB épinglés : une base republiée sans lui le laisse aux clés de l'ancienne."""
        vus = 0
        for s in sujets_des_elements():
            for id_ in s['publie']:
                publie = MODELES / f'{id_}.manifeste.json'
                if not publie.exists() or not remplace_la_base(lire(publie)):
                    continue
                vus += 1
                publie = lire(publie)
                de_la_base = lire(MODELES / f"{publie['base']}.manifeste.json")
                glb_de_base = CACHE_DES_MODELES / f"{de_la_base['glb']['sha256']}.glb"
                with self.subTest(id=id_):
                    self.assertEqual(derives_de_la_couture(CACHE_DES_MODELES / f"{publie['glb']['sha256']}.glb", glb_de_base, publie['couvre'],
                                                           de_la_base['silhouettes'] + gabarits(glb_de_base)), [],
                                     f"{id_} publié ne suit pas la base {de_la_base['glb']['sha256'][:12]} à sa couture : à reconstruire et republier")
        self.assertTrue(vus, 'aucun élément publié ne remplace une zone de la base')

    def test_chaque_element_a_son_manifeste_publie(self):
        for s in sujets_des_elements():
            for id_ in s['publie']:
                with self.subTest(id=id_):
                    self.assertTrue((MODELES / f'{id_}.manifeste.json').exists(), f'{id_} : aucun manifeste publié sous {MODELES}')


if __name__ == '__main__':
    unittest.main()
