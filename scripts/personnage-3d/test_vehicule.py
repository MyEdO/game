"""Construction des véhicules (#2987) : chaque modèle de `vehicule/` reconstruit depuis le dépôt les GLB et les
manifestes publiés sous `hotes/godot/projet/modeles/`, octet pour octet (l'empreinte du manifeste) ; chaque véhicule et
chaque Amélioration publiés y ont leur modèle ; une sortie dans le dépôt est refusée. La caraque suit ses ponts
(`ponts` de sa fiche, #3686) à une épaisseur de cloison près, et une caraque allongée dans la source aussi. Sur chaque
navire, toute case des ponts s'atteint et tient un occupant debout (#3790), et sa coque est close : ni trou dans un
plancher, ni rayon qui sorte du navire depuis une case (#3815)."""
import copy
import hashlib
import importlib
import json
import math
import os
import runpy
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI / 'vehicule'))

import bpy  # noqa: E402
import construire  # noqa: E402
import navire  # noqa: E402
import plan_de_jeu  # noqa: E402
from caraque import modele  # noqa: E402
from mathutils import Vector  # noqa: E402

MODELES = ICI.parents[1] / 'hotes' / 'godot' / 'projet' / 'modeles'


class Reconstruction(unittest.TestCase):

    def construire(self, modele):
        """Les dossiers de production que `construire.py <modele>` écrit, par id."""
        sortie = Path(self.dossier.name) / modele
        env = {**os.environ, 'PYTHONDONTWRITEBYTECODE': '1'}
        vu = subprocess.run([sys.executable, '-X', 'utf8', str(ICI / 'vehicule' / 'construire.py'), modele, '--sortie', str(sortie)],
                            capture_output=True, text=True, env=env, timeout=240)
        self.assertEqual(vu.returncode, 0, vu.stdout[-2000:] + vu.stderr[-2000:])
        return {d.name: d for d in sorted(sortie.iterdir())}

    def setUp(self):
        self.dossier = tempfile.TemporaryDirectory()

    def tearDown(self):
        self.dossier.cleanup()

    def test_chaque_modele_reproduit_ses_elements_publies(self):
        produits = set()
        for modele in sorted(d.parent.name for d in (ICI / 'vehicule').glob('*/donnees.py')):
            for id_, dossier in self.construire(modele).items():
                produits.add(id_)
                with self.subTest(modele=modele, id=id_):
                    manifeste = json.loads((dossier / f'{id_}.element.json').read_text(encoding='utf-8'))
                    octets = (dossier / f'{id_}.glb').read_bytes()
                    self.assertEqual(manifeste['glb'], {'sha256': hashlib.sha256(octets).hexdigest(), 'octets': len(octets)})
                    enveloppe = json.loads((dossier / 'manifest.json').read_text(encoding='utf-8'))
                    self.assertEqual(enveloppe, {'model': f'{id_}.glb', 'model_sha256': manifeste['glb']['sha256'], 'manifeste': manifeste})
                    publie = MODELES / f'{id_}.manifeste.json'
                    self.assertTrue(publie.exists(), f'{id_} : aucun manifeste publié sous {MODELES}')
                    self.assertEqual(manifeste, json.loads(publie.read_text(encoding='utf-8')))
        publies = {p.name.removesuffix('.manifeste.json') for c in ('vehicule', 'amelioration') for p in MODELES.glob(f'{c}--*.manifeste.json')}
        self.assertEqual(publies - produits, set(), 'élément publié sans modèle sous vehicule/')


TOLERANCE = 0.10      # une épaisseur de cloison (`CLOISON.epaisseur`)
METRES_PAR_CASE = 2.0  # l'échelle du plan (`sceneMetresPerTile`, LDB 15 l.12), son origine au centre du plan
STEP_MAX_M = 1.0      # la plus haute marche franchie à pied (`src/noyau/monde/relief.ts`)


def touches(origine, direction, longueur):
    """Les points où la scène coupe le segment de `origine` le long de `direction` sur `longueur` : (distance, normale)."""
    graphe = bpy.context.evaluated_depsgraph_get()
    direction = Vector(direction).normalized()
    sortie, parcouru, o = [], 0.0, Vector(origine)
    while parcouru < longueur:
        ok, lieu, normale, _, _, _ = bpy.context.scene.ray_cast(graphe, o, direction, distance=longueur - parcouru)
        if not ok:
            break
        parcouru += (lieu - o).length
        sortie.append((parcouru, normale))
        o = lieu + direction * 1e-4
        parcouru += 1e-4
    return sortie


def ecarts(P, sortie):
    """Les écarts, en mètres, entre la caraque construite dans la scène et ses ponts `P`, par famille : {famille: [(écart,
    où)]}. Planchers : le sol sous le milieu de l'emprise libre de chaque case (`cases`) et la hauteur de son glyphe.
    Cloisons : la matière d'une cloison ou d'une porte du plan et son arête, à 1 m du plus bas de ses planchers (une
    trappe au plancher de son pied), entre deux cases d'un pont ou entre une case et la place d'une case d'un autre pont
    à une marche près. Ouvertes : la matière à moins de 0,2 m d'une arête sans cloison, au milieu de ce que les emprises
    libres de ses deux cases en partagent, à 0,6 m de son plancher. Échelles : leur montant et leur arête, l'écoutille
    ouverte jusqu'au plancher du pied. Sabords : le plancher et la case de chaque poste. Hune : son plancher et le pied
    du grand mât, la case du mât. Mâts : le fût de chaque mât hors de l'emprise libre de chaque case qu'il traverse, au
    milieu de la case de son pied."""
    D = runpy.run_path(str(ICI / 'vehicule' / 'caraque' / 'donnees.py'))
    x_de = lambda yp: (yp - P['H'] / 2) * METRES_PAR_CASE  # noqa: E731
    y_de = lambda xp: (xp - P['W'] / 2) * METRES_PAR_CASE  # noqa: E731
    E = {f: [] for f in ('planchers', 'cloisons', 'ouvertes', 'echelles', 'sabords', 'hune', 'mats')}

    def sol(x, y, h):
        hauts = [h + 0.5 - d for d, n in touches((x, y, h + 0.5), (0, 0, -1), 1.0) if n.z > 0.5]
        return min((abs(z - h) for z in hauts), default=math.inf)

    def emprise(cx, cy, z):
        """L'emprise libre de la case (`cases` de la sortie), la case entière sinon : (x de, y de, x à, y à) en cases."""
        return sortie['cases'].get(f'{cx},{cy},{z}', (cx, cy, cx + 1, cy + 1))

    for (cx, cy, z), g in sorted(P['cases'].items()):
        x0, y0, x1, y1 = emprise(cx, cy, z)
        E['planchers'].append((sol(x_de((y0 + y1) / 2), y_de((x0 + x1) / 2), P['hauteurs'][g]), ('case', cx, cy, z)))

    def matiere(milieu, n):
        """Écart entre l'arête de milieu `milieu` (normale horizontale `n`) et la matière qui la traverse, sondée des deux
        côtés à 0,45 m, au milieu et à 0,2 m de part et d'autre (les joints d'un vantail laissent passer une sonde)."""
        cote = n.cross(Vector((0, 0, 1)))
        meilleur = math.inf
        for k in (0.0, -0.2, 0.2):
            m = milieu + cote * k
            a = touches(m - n * 0.45, n, 0.9)
            b = touches(m + n * 0.45, -n, 0.9)
            if a and b:
                meilleur = min(meilleur, max(0.0, a[0][0] - 0.45, b[0][0] - 0.45))
        return meilleur

    def arete(s, x, y, zm):
        if s == 't':
            return Vector((x_de(y + 0.5), y_de(x), zm)), Vector((0, 1, 0))
        return Vector((x_de(y), y_de(x + 0.5), zm)), Vector((1, 0, 0))

    pieds = {trappe + (z,): plan_de_jeu.hauteur(P, z, *pied) for z, trappe, pied, _ in plan_de_jeu.echelles(P)}
    for s, x, y, z, g in P['aretes']:
        if g not in plan_de_jeu.MURS + plan_de_jeu.PORTE:
            continue
        places = plan_de_jeu.voisines(s, x, y)
        sur = [p + (z,) for p in places if p + (z,) in P['cases']]
        if not sur:
            continue
        h = min(pieds.get(c, P['hauteurs'][P['cases'][c]]) for c in sur)
        if len(sur) == 1 and not any(k[:2] in places and k[2] != z and abs(P['hauteurs'][g2] - h) <= STEP_MAX_M
                                     for k, g2 in P['cases'].items()):
            continue
        E['cloisons'].append((matiere(*arete(s, x, y, h + 1.0)), (s, x, y, z)))

    for z in range(P['ponts']):
        for s, x, y in plan_de_jeu.ouvertes(P, z):
            a, b = [emprise(*c, z) for c in plan_de_jeu.voisines(s, x, y)]
            k = 1 if s == 't' else 0
            m, n = arete(s, x, y, plan_de_jeu.hauteur(P, z, *plan_de_jeu.voisines(s, x, y)[1]) + 0.6)
            milieu = (max(a[k], b[k]) + min(a[k + 2], b[k + 2])) / 2
            if s == 't':
                m.x = x_de(milieu)
            else:
                m.y = y_de(milieu)
            E['ouvertes'].append((0.0 if not touches(m - n * 0.2, n, 0.4) else math.inf, (s, x, y, z)))

    EC, EH = D['ECOUTILLE'], D['ECHELLE']
    for z, trappe, pied, (s, x, y) in plan_de_jeu.echelles(P):
        haut, bas = plan_de_jeu.hauteur(P, z, *trappe), plan_de_jeu.hauteur(P, z, *pied)
        m, n = arete(s, x, y, (haut + bas) / 2)
        vers = n if (trappe[0] - pied[0] if s == 't' else trappe[1] - pied[1]) > 0 else -n
        cote = n.cross(Vector((0, 0, 1)))
        montant = matiere(m + cote * (EH['largeur'] / 2), n)
        sonde = m + vers * (EC['ouverture'][1] / 2) + cote * (EC['ouverture'][0] / 2 - 0.12)
        sonde.z = haut + 0.5
        hauts = [haut + 0.5 - d for d, nn in touches(sonde, (0, 0, -1), haut - bas + 1.0) if nn.z > 0.5]
        puits = 0.0 if hauts and abs(hauts[0] - bas) <= TOLERANCE else math.inf
        E['echelles'].append((max(montant, puits), (s, x, y, z)))

    postes = sortie['selon']['sabord']['postes']
    rangs = {bord: 0 for bord in postes}
    for z, (cx, cy), bord in plan_de_jeu.sabords(P):
        gx, gy, gz = postes[bord][rangs[bord]]
        rangs[bord] += 1
        bx, by = gx, -gz
        hors = max(0.0, x_de(cy) - bx, bx - x_de(cy + 1), y_de(cx) - by, by - y_de(cx + 1))
        E['sabords'].append((max(hors, abs(gy - plan_de_jeu.hauteur(P, z, cx, cy))), (bord, cx, cy, z)))
    E['sabords'].append((0.0 if all(rangs[b] == len(postes[b]) for b in postes) else math.inf, 'nombre'))

    for nom, M in modele.mats(D, P, navire.Coque(D, P)).items():
        fx, fy, fz = M['case']
        for z in range(fz, P['ponts']):
            if (fx, fy, z) not in P['cases'] or not M['emplanture'] <= plan_de_jeu.hauteur(P, z, fx, fy) < M['tete']:
                continue
            x0, y0, x1, y1 = sortie['cases'].get(f'{fx},{fy},{z}', (fx, fy, fx + 1, fy + 1))
            cx, cy = fx + 0.5, fy + 0.5
            d = math.hypot(max(x0 - cx, 0.0, cx - x1), max(y0 - cy, 0.0, cy - y1)) * METRES_PAR_CASE
            E['mats'].append((max(0.0, M['rayons'][0] - d), (nom, fx, fy, z)))

    (mx, my, mz), = [k for k, g in P['cases'].items() if g == D['GLYPHES']['mat']]
    gx, gy, gz = sortie['ancrages']['nid-de-pie'][0]
    E['hune'].append((max(abs(gx - x_de(my + 0.5)), abs(-gz - y_de(mx + 0.5)),
                          abs(gy - D['HUNE'][0][0] - P['hauteurs'][D['GLYPHES']['hune']])), 'nid-de-pie'))
    return E


PAS_DES_SONDES = 0.1   # en cases : le pas des sondes de plancher
HAUTEURS_DES_RAYONS = (0.3, 0.6, 1.0, 1.4)   # au-dessus du plancher : des chevilles à l'épaule d'un occupant
FRACTIONS = (0.1, 0.3, 0.5, 0.7, 0.9)        # le long de l'emprise libre d'une case
AU_DELA = 0.1          # en cases : où l'on sonde le sol derrière une arête que le rayon passe


def closes(D, P, sortie):
    """Ce que la coque bâtie dans la scène laisse ouvert, par famille : {famille: [(écart, où)]}, l'écart nul ou infini.
    Trous : chaque sonde (`navire.sonde`, au pas `PAS_DES_SONDES`) de chaque case, hors de la matière et enclose (ses
    quatre rayons horizontaux touchent des faces tournées vers elle), touche un sol vers le bas avant d'être sous sa
    hauteur, sauf dans l'écoutille d'une trappe, la moitié de sa case contre l'arête de son échelle. Étanchéité : depuis
    le milieu de l'emprise libre de chaque case hors trappes (à la hauteur du pont du dessus, sous les murs du sien), en
    `FRACTIONS` de cette emprise le long de chaque arête murée ou sabord (fermé sans l'Amélioration), à
    `HAUTEURS_DES_RAYONS` au-dessus de son plancher, un rayon vers l'arête touche la coque ; s'il la passe, `AU_DELA`
    derrière elle le sol ne tombe pas plus bas qu'une marche (`STEP_MAX_M`) sous ce plancher."""
    C, E = navire.Coque(D, P), D['EMPRISE']
    graphe = bpy.context.evaluated_depsgraph_get()
    bas = Vector((0, 0, -1))

    def sol(px, py, depuis):
        """La hauteur du premier sol sous le point (px, py) du plan, depuis la hauteur `depuis` ; None sans sol."""
        ok, lieu, _, _, _, _ = bpy.context.scene.ray_cast(graphe, Vector((C.x_du_plan(py), C.y_du_plan(px), depuis)), bas)
        return lieu.z if ok else None

    def enclose(px, py, h):
        o = Vector((C.x_du_plan(py), C.y_du_plan(px), h + E['stature']))
        return all(ok and n.dot(d) < 0 for d in (Vector((1, 0, 0)), Vector((-1, 0, 0)), Vector((0, 1, 0)), Vector((0, -1, 0)))
                   for ok, _, n, _, _, _ in [bpy.context.scene.ray_cast(graphe, o, d)])

    F = {f: [] for f in ('trous', 'etancheite')}
    ecoutilles = {trappe + (z,): (s, x, y) for z, trappe, _, (s, x, y) in plan_de_jeu.echelles(P)}
    n = round(1 / PAS_DES_SONDES)
    for (cx, cy, z), g in sorted(P['cases'].items()):
        h = P['hauteurs'][g]
        trous = []
        for i in range(n):
            for j in range(n):
                px, py = cx + (i + 0.5) / n, cy + (j + 0.5) / n
                if (cx, cy, z) in ecoutilles:
                    s, ax, ay = ecoutilles[(cx, cy, z)]
                    if abs((px - ax) if s == 't' else (py - ay)) < 0.5:
                        continue
                if navire.sonde(C, E, px, py, h) is False and enclose(px, py, h):
                    dessous = sol(px, py, h + E['stature'])
                    if dessous is None or dessous < h - E['ecart']:
                        trous.append((round(px, 2), round(py, 2)))
        F['trous'].append((math.inf if trous else 0.0, ('case', cx, cy, z, len(trous), trous[:2])))

    parois = {(s, x, y, z): g for s, x, y, z, g in P['aretes'] if g in plan_de_jeu.MURS + plan_de_jeu.SABORD}
    for (cx, cy, z), g in sorted(P['cases'].items()):
        if (cx, cy, z) in ecoutilles:
            continue
        h = P['hauteurs'][g]
        x0, y0, x1, y1 = sortie['cases'].get(f'{cx},{cy},{z}', (cx, cy, cx + 1, cy + 1))
        for s, ax, ay in (('t', cx, cy), ('t', cx + 1, cy), ('l', cx, cy), ('l', cx, cy + 1)):
            if (s, ax, ay, z) not in parois:
                continue
            arete = ax if s == 't' else ay
            milieu = (x0 + x1) / 2 if s == 't' else (y0 + y1) / 2
            vers = 1 if arete > milieu else -1
            loin = abs(arete - milieu)
            for f in FRACTIONS:
                for dh in HAUTEURS_DES_RAYONS:
                    px, py = (milieu, y0 + f * (y1 - y0)) if s == 't' else (x0 + f * (x1 - x0), milieu)
                    d = Vector((0, vers, 0)) if s == 't' else Vector((vers, 0, 0))
                    t = touches(Vector((C.x_du_plan(py), C.y_du_plan(px), h + dh)), d, 80.0)
                    if not t:
                        ecart = math.inf
                    elif t[0][0] <= (loin + AU_DELA) * C.case:
                        ecart = 0.0
                    else:
                        qx, qy = (arete + vers * AU_DELA, py) if s == 't' else (px, arete + vers * AU_DELA)
                        dessous = sol(qx, qy, h + dh)
                        ecart = 0.0 if dessous is not None and dessous >= h - STEP_MAX_M else math.inf
                    F['etancheite'].append((ecart, (s, ax, ay, z, 'depuis', cx, cy, round(f, 1), dh)))
    return F


def batir(fiche):
    """Le navire de `fiche` bâti dans une scène neuve, sans le nœud `avec-sabord` (ses sabords bouchés) : ses données,
    ses ponts et la sortie de son modèle."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    D = runpy.run_path(str(ICI / 'vehicule' / fiche['id'] / 'donnees.py'))
    P = plan_de_jeu.depuis(fiche)
    sortie = importlib.import_module(f'{fiche["id"]}.modele').construire(D, P)
    for o in [o for o in bpy.data.objects if o.name.startswith('avec-sabord')]:
        bpy.data.objects.remove(o)
    return D, P, sortie


def allongee(fiche, colonne, n):
    """La fiche dont chaque pont répète `n` fois la colonne de cases `colonne` (et l'arête qui la suit)."""
    fiche = copy.deepcopy(fiche)
    debut = 2 * colonne + 1
    fiche['ponts'][0] = ['\n'.join(l[:debut] + l[debut:debut + 2] * n + l[debut:] for l in p.split('\n')) for p in fiche['ponts'][0]]
    return fiche


class Ponts(unittest.TestCase):
    """La caraque bâtie sur ses ponts, puis sur ses ponts allongés de trois cases dans l'embelle : nul écart au-delà
    d'une épaisseur de cloison entre le modèle et la source."""

    def verifier(self, fiche):
        _, P, sortie = batir(fiche)
        for famille, mesures in ecarts(P, sortie).items():
            with self.subTest(famille=famille):
                self.assertTrue(mesures, f'{famille} : rien de mesuré')
                hors = [(round(e, 3), ou) for e, ou in mesures if e > TOLERANCE]
                self.assertEqual(hors, [], f'{famille} : écarts au-delà de {TOLERANCE} m')

    def fiche(self):
        return plan_de_jeu.fiche('caraque')

    def test_la_caraque_suit_ses_ponts(self):
        self.verifier(self.fiche())

    def test_une_caraque_allongee_dans_la_source_suit_ses_ponts(self):
        fiche = allongee(self.fiche(), 7, 3)
        P = plan_de_jeu.depuis(fiche)
        self.assertEqual(P['W'], plan_de_jeu.depuis(self.fiche())['W'] + 3)
        self.verifier(fiche)


CARRURE = 0.25        # la carrure d'un adulte, 0,5 m, en cases : le plus étroit où un pion se tient (#3767)
BLOQUANTES = plan_de_jeu.MURS + plan_de_jeu.SABORD + 'o'


def atteintes(P, depart):
    """Les cases des ponts `P` qu'un pion atteint depuis `depart`, comme le pas à pied du noyau (`neighborsOf` de
    `src/noyau/monde/path.ts`) : une case voisine de tout pont, à une marche (`STEP_MAX_M`) près, sans mur ni sabord ni
    fenêtre sur leur arête au plus haut des deux ponts (une porte s'ouvre) ; ou de l'autre côté d'une échelle de son pont."""
    aretes = {(s, x, y, z): g for s, x, y, z, g in P['aretes']}

    def arete(z, x, y, nx, ny):
        return aretes.get(('t', max(x, nx), y, z) if nx != x else ('l', x, max(y, ny), z), ' ')

    vues, pile = {depart}, [depart]
    while pile:
        x, y, z = pile.pop()
        h = P['hauteurs'][P['cases'][(x, y, z)]]
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            for nz in range(P['ponts']):
                n = (nx, ny, nz)
                if n in vues or n not in P['cases']:
                    continue
                mot = arete(max(z, nz), x, y, nx, ny)
                echelle = nz == z and mot == plan_de_jeu.ECHELLE
                if echelle or (mot not in BLOQUANTES + plan_de_jeu.ECHELLE and abs(P['hauteurs'][P['cases'][n]] - h) <= STEP_MAX_M + 1e-9):
                    vues.add(n)
                    pile.append(n)
    return vues


class Navires(unittest.TestCase):
    """Chaque navire à ponts (`ponts` de sa fiche) : toute case de ses ponts s'atteint, l'emprise libre que son modèle
    publié laisse à chaque case (`cases` de son manifeste) tient un occupant debout, et sa coque bâtie est close
    (`closes`)."""

    def navires(self):
        sortie = [f for f in json.loads(plan_de_jeu.VEHICULES.read_text(encoding='utf-8')) if 'ponts' in f]
        self.assertTrue(sortie, 'aucun navire à ponts')
        return sortie

    def test_toute_case_des_ponts_s_atteint(self):
        for fiche in self.navires():
            with self.subTest(navire=fiche['id']):
                P = plan_de_jeu.depuis(fiche)
                self.assertEqual(sorted(set(P['cases']) - atteintes(P, min(P['cases']))), [])

    def test_l_emprise_libre_de_chaque_case_tient_un_occupant_debout(self):
        for fiche in self.navires():
            with self.subTest(navire=fiche['id']):
                publie = MODELES / f'vehicule--{fiche["id"]}.manifeste.json'
                emprises = json.loads(publie.read_text(encoding='utf-8')).get('cases', {})
                self.assertEqual({k: e for k, e in emprises.items() if min(e[2] - e[0], e[3] - e[1]) < CARRURE}, {})

    def test_la_coque_de_chaque_navire_est_close(self):
        for fiche in self.navires():
            for famille, mesures in closes(*batir(fiche)).items():
                with self.subTest(navire=fiche['id'], famille=famille):
                    self.assertTrue(mesures, f'{famille} : rien de mesuré')
                    self.assertEqual([ou for e, ou in mesures if e > TOLERANCE], [], f'{famille} : ouvert')


class Sortie(unittest.TestCase):

    def test_refuse_le_depot(self):
        with self.assertRaises(ValueError):
            construire.dossier_de_sortie(construire.habillage.DEPOT / 'hotes' / 'godot' / 'sortie-de-vehicule')

    def test_refuse_un_dossier_occupe(self):
        with tempfile.TemporaryDirectory() as dossier:
            (Path(dossier) / 'autre.glb').write_bytes(b'')
            with self.assertRaises(ValueError):
                construire.dossier_de_sortie(dossier)


if __name__ == '__main__':
    unittest.main()
