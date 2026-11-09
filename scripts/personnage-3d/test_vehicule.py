"""Construction des véhicules (#2987) : chaque modèle de `vehicule/` reconstruit depuis le dépôt les GLB et les
manifestes publiés sous `hotes/godot/projet/modeles/`, octet pour octet (l'empreinte du manifeste) ; chaque véhicule et
chaque Amélioration publiés y ont leur modèle ; une sortie dans le dépôt est refusée. La caraque suit ses ponts
(`ponts` de sa fiche, #3686) à une épaisseur de cloison près, et une caraque allongée dans la source aussi. Sur chaque
navire, toute case des ponts s'atteint et tient un occupant debout (#3790)."""
import copy
import hashlib
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
    où)]}. Planchers : le sol sous le milieu de chaque case et la hauteur de son glyphe. Cloisons : la matière d'une
    cloison ou d'une porte du plan et son arête, à 1 m du plus bas de ses planchers. Ouvertes : la matière à moins de 0,2 m
    d'une arête sans cloison, à 0,6 m de son plancher.
    Échelles : leur montant et leur arête, l'écoutille ouverte jusqu'au plancher du pied. Sabords : le plancher et la
    case de chaque poste. Hune : son plancher et le pied du grand mât, la case du mât."""
    D = runpy.run_path(str(ICI / 'vehicule' / 'caraque' / 'donnees.py'))
    x_de = lambda yp: (yp - P['H'] / 2) * METRES_PAR_CASE  # noqa: E731
    y_de = lambda xp: (xp - P['W'] / 2) * METRES_PAR_CASE  # noqa: E731
    E = {f: [] for f in ('planchers', 'cloisons', 'ouvertes', 'echelles', 'sabords', 'hune')}

    def sol(x, y, h):
        hauts = [h + 0.5 - d for d, n in touches((x, y, h + 0.5), (0, 0, -1), 1.0) if n.z > 0.5]
        return min((abs(z - h) for z in hauts), default=math.inf)

    for (cx, cy, z), g in sorted(P['cases'].items()):
        E['planchers'].append((sol(x_de(cy + 0.5), y_de(cx + 0.5), P['hauteurs'][g]), ('case', cx, cy, z)))

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

    for z in range(P['ponts']):
        for s, x, y, g in plan_de_jeu.murs(P, z):
            h = min(plan_de_jeu.hauteur(P, z, *c) for c in plan_de_jeu.voisines(s, x, y))
            E['cloisons'].append((matiere(*arete(s, x, y, h + 1.0)), (s, x, y, z)))
        for s, x, y in plan_de_jeu.ouvertes(P, z):
            m, n = arete(s, x, y, plan_de_jeu.hauteur(P, z, *plan_de_jeu.voisines(s, x, y)[1]) + 0.6)
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

    (mx, my, mz), = [k for k, g in P['cases'].items() if g == D['GLYPHES']['mat']]
    gx, gy, gz = sortie['ancrages']['nid-de-pie'][0]
    E['hune'].append((max(abs(gx - x_de(my + 0.5)), abs(-gz - y_de(mx + 0.5)),
                          abs(gy - D['HUNE'][0][0] - P['hauteurs'][D['GLYPHES']['hune']])), 'nid-de-pie'))
    return E


def allongee(fiche, colonne, n):
    """La fiche dont chaque pont répète `n` fois la colonne de cases `colonne` (et l'arête qui la suit)."""
    fiche = copy.deepcopy(fiche)
    debut = 2 * colonne + 1
    fiche['ponts'][0] = ['\n'.join(l[:debut] + l[debut:debut + 2] * n + l[debut:] for l in p.split('\n')) for p in fiche['ponts'][0]]
    return fiche


class Ponts(unittest.TestCase):
    """La caraque bâtie sur ses ponts, puis sur ses ponts allongés de trois cases dans l'embelle : nul écart au-delà
    d'une épaisseur de cloison entre le modèle et la source."""

    def batie(self, fiche):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        D = runpy.run_path(str(ICI / 'vehicule' / 'caraque' / 'donnees.py'))
        P = plan_de_jeu.depuis(fiche)
        return P, modele.construire(D, P)

    def verifier(self, fiche):
        P, sortie = self.batie(fiche)
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


STEP_MAX_M = 1.0      # la plus haute marche franchie à pied (`src/noyau/monde/relief.ts`)
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
    """Chaque navire à ponts (`ponts` de sa fiche) : toute case de ses ponts s'atteint, et l'emprise libre que son modèle
    publié laisse à chaque case (`cases` de son manifeste) tient un occupant debout."""

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
