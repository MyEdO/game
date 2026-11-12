"""Géométrie de `humanoide--vetement--capuche` (`element/tissu.py`) : trois nappes d'un seul tissu, en un seul élément.

- Le capuchon : une grille (colonnes en azimut, rangs en élévation, éventail au sommet) de rayons visés du dehors vers
  un centre de la tête ; chaque rayon s'arrête sur la plus extérieure des surfaces contournées (peau et cheveux de la tête
  publiée, poil de la coiffure, cou et torse de la base), plus un jeu selon l'azimut ; rayons lissés sans passer sous le
  jeu minimal ; la nappe s'élève en pointe autour de la direction de la pointe ; l'ouverture du visage est retirée.
- L'écharpe : des anneaux dans des plans penchés sur l'axe de `neck_01`, chaque point posé à l'aisance au-delà de la plus
  extérieure des surfaces contournées, capuchon compris : l'écharpe enveloppe le bas du capuchon.
- Le pan : une bande qui passe sur l'épaule gauche ; chaque colonne suit, dans son plan sagittal, l'enveloppe convexe de
  la coupe du torse, visée depuis un axe à l'épaule, au jeu au-delà, et au jeu minimal au-delà du torse ; il sort de
  sous l'écharpe, sur le trapèze, et passe sur l'épaule.

Double nappe, poids empruntés au corps sous chaque nappe puis lissés, silhouettes et clés `gabarit_*` transférées puis
tenues au suivi du corps. Toute cote vient de `donnees.py`.
"""
import math

import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

from formes import decalages, poser_la_cle
from seuils import SOL_TOLERANCE_M
from tissu import Maillage, emprunter, enveloppe_convexe, lisser, porteur_de, rayon_a_l_enveloppe, voisinage


def unitaire(x):
    x = np.asarray(x, float)
    return x / np.linalg.norm(x)


def depuis(b, os_, decalage):
    return np.array(b.tete(os_)) + np.asarray(decalage, float)


class Contournees:
    """Les surfaces que la capuche contourne, jointes : le point le plus extérieur sur une demi-droite, visée du dehors."""

    def __init__(self, D, morceaux):
        P, T = surface_jointe(morceaux)
        self.D = D
        self.morceaux = morceaux
        self.arbre = BVHTree.FromPolygons([tuple(p) for p in P], T.tolist(), all_triangles=True)

    def plus(self, autres):
        return Contournees(self.D, self.morceaux + autres)

    def exterieur(self, origine, direction, portee, jeu):
        """Le rayon le plus grand, depuis `origine` le long de `direction` et sous `portee`, où un point approche les
        surfaces à `jeu` plus l'épaisseur près (le jeu est celui de la nappe intérieure), plus un pas : marché du
        dehors vers `origine` au pas `PAS_DE_VISEE`, il ne rase ni ne manque une surface qu'un rayon frôle. Chaque point au-delà du rayon rendu est à plus de `jeu` des surfaces ;
        `None` si aucun point de la demi-droite ne les approche."""
        D = self.D
        d = unitaire(direction)
        o = np.asarray(origine, float)
        r = portee
        while r > 0:
            if self.arbre.find_nearest(Vector((o + r * d).tolist()))[3] <= jeu + D['EPAISSEUR']:
                return min(portee, r + D['PAS_DE_VISEE'])
            r -= D['PAS_DE_VISEE']
        return None


def zone(b, nom):
    P, T, _ = b.corps(nom)
    return P, T


def surface_de(X, faces):
    T = [(f[0], f[i], f[i + 1]) for f in faces for i in range(1, len(f) - 1)]
    return X, np.array(T, int)


# ---------------------------------------------------------------- capuchon

def direction(phi, e):
    a, b = math.radians(phi), math.radians(e)
    return np.array([math.cos(b) * math.sin(a), -math.cos(b) * math.cos(a), math.sin(b)])


def demi_ouverture(c, e):
    """Demi-ouverture (degrés d'azimut) du visage à l'élévation `e` : pleine sous le milieu, en ellipse jusqu'au bord haut."""
    if e <= c['elevation_milieu']:
        return c['demi_ouverture']
    s = (e - c['elevation_milieu']) / (c['elevation_bord_haut'] - c['elevation_milieu'])
    return c['demi_ouverture'] * math.sqrt(max(0.0, 1.0 - s * s))


def capuchon(D, b, M, contournees):
    c = D['CAPUCHON']
    C = depuis(b, c['os_du_centre'], c['centre'])
    n, m = c['colonnes'], c['rangs']
    phis = [-180.0 + 360.0 * k / n for k in range(n)]
    elevations = list(np.linspace(c['elevation_bas'], c['elevation_haut'], m))
    dirs = [[direction(p, e) for p in phis] for e in elevations] + [[np.array([0.0, 0.0, 1.0])]]

    def touche(d):
        h = contournees.exterieur(C, d, c['portee'], c['jeu_min'])
        if h is None:
            raise ValueError(f'capuchon : aucune surface sous la direction {d.round(3).tolist()}')
        return h

    h = np.array([[touche(d) for d in rang] for rang in dirs[:-1]])
    h_pole = touche(dirs[-1][0])
    jeu = np.array([np.interp(abs(p), *zip(*c['jeu'])) for p in phis])
    r = h + jeu - c['jeu_min']
    r_pole = h_pole + float(np.interp(180.0, *zip(*c['jeu']))) - c['jeu_min']
    plancher, plancher_pole = h, h_pole
    for _ in range(c['passes_de_lissage']):
        haut = np.vstack([r[1:], np.full((1, n), r_pole)])
        bas = np.vstack([r[:1], r[:-1]])
        lisse = 0.5 * r + 0.125 * (np.roll(r, 1, 1) + np.roll(r, -1, 1) + haut + bas)
        r_pole = max(0.5 * r_pole + 0.5 * float(r[-1].mean()), plancher_pole)
        r = np.maximum(lisse, plancher)

    # Pointe : la nappe s'élève vers le point de la pointe autour de sa direction ; le sommet le plus proche y est posé.
    Q = depuis(b, 'Head', c['pointe'])
    t = unitaire(Q - C)
    R = float(np.linalg.norm(Q - C))
    u0 = math.radians(c['pointe_ouverture'])

    def eleve(d, rayon):
        u = math.acos(max(-1.0, min(1.0, float(d @ t))))
        w = max(0.0, 1.0 - u / u0) ** c['pointe_exposant']
        return rayon + w * max(0.0, R - rayon), u

    r = np.array([[eleve(dirs[j][k], r[j, k])[0] for k in range(n)] for j in range(m)])
    r_pole = eleve(dirs[-1][0], r_pole)[0]
    ecarts = np.array([[eleve(dirs[j][k], 0.0)[1] for k in range(n)] for j in range(m)])
    jt, kt = np.unravel_index(int(np.argmin(ecarts)), ecarts.shape)
    r[jt, kt] = R
    points = [[C + r[j, k] * dirs[j][k] for k in range(n)] for j in range(m)]
    sommet = C + r_pole * dirs[-1][0]

    def dans_le_visage(j, k):
        phi = phis[k] + 180.0 / n
        phi = (phi + 180.0) % 360.0 - 180.0
        e = 0.5 * (elevations[j] + elevations[j + 1])
        return abs(phi) < demi_ouverture(c, e)

    gardees = {(j, k) for j in range(m - 1) for k in range(n) if not dans_le_visage(j, k)}
    ouvertes = {(j, k) for j in range(m - 1) for k in range(n)} - gardees

    # Bord du visage : chaque sommet d'une cellule gardée qui touche une cellule ouverte est posé sur la courbe de
    # l'ouverture (projeté dans le plan (phi, élévation) normalisé), au rayon interpolé de la grille.
    pas_e = elevations[1] - elevations[0]

    def rayon_interpole(phi, e):
        fk, fj = (phi + 180.0) / (360.0 / n), min(max((e - elevations[0]) / pas_e, 0.0), m - 1.0)
        k0, j0 = int(math.floor(fk)) % n, min(int(math.floor(fj)), m - 2)
        tk, tj = fk - math.floor(fk), fj - j0
        k1 = (k0 + 1) % n
        return ((1 - tj) * ((1 - tk) * r[j0, k0] + tk * r[j0, k1]) + tj * ((1 - tk) * r[j0 + 1, k0] + tk * r[j0 + 1, k1]))

    def sur_le_bord(phi, e):
        x = phi / c['demi_ouverture']
        if e <= c['elevation_milieu']:
            return math.copysign(c['demi_ouverture'], phi), e
        y = (e - c['elevation_milieu']) / (c['elevation_bord_haut'] - c['elevation_milieu'])
        norme = math.hypot(x, y)
        return c['demi_ouverture'] * x / norme, c['elevation_milieu'] + (c['elevation_bord_haut'] - c['elevation_milieu']) * y / norme

    for j in range(m):
        for k in range(n):
            if any(((j - dj, (k - dk) % n) in ouvertes) for dj in (0, 1) for dk in (0, 1)):
                phi, e = sur_le_bord(phis[k] if phis[k] != -180.0 else 180.0, elevations[j])
                d = direction(phi, e)
                points[j][k] = C + max(rayon_interpole(phi, e), touche(d)) * d
    index = {}

    def sommet_de(j, k):
        if (j, k) not in index:
            index[j, k] = M.ajouter([points[j][k]], 'capuchon')[0]
        return index[j, k]

    faces = []
    for j, k in sorted(gardees):
        q = (sommet_de(j, k), sommet_de(j, (k + 1) % n), sommet_de(j + 1, (k + 1) % n), sommet_de(j + 1, k))
        M.quad(*q, C)
        faces.append(q)
    pole = M.ajouter([sommet], 'capuchon')[0]
    for k in range(n):
        f = (sommet_de(m - 1, k), sommet_de(m - 1, (k + 1) % n), pole)
        M.triangle(*f, C)
        faces.append(f)
    return faces


# ---------------------------------------------------------------- écharpe

def couture_du_cou(D, b):
    """Les sommets de la zone `cou` confondus avec ceux de la zone `torse` : le bord bas du cou, que la capuche couvre."""
    P, T = zone(b, 'torse')
    arbre = BVHTree.FromPolygons([tuple(p) for p in P], T.tolist(), all_triangles=True)
    cou = zone(b, 'cou')[0]
    return np.array([q for q in cou if arbre.find_nearest(Vector(q.tolist()))[3] < D['ECHARPE']['couture_tolerance']])


def echarpe(D, b, M, contournees, cols):
    """Le bas de l'écharpe suit la couture du cou, posé sur le torse et sur ce que `cols`, les vêtements à col, en
    couvrent sous lui, par-dessus le col qu'il touche ; chaque anneau au-dessus, à sa hauteur depuis l'os de hauteur
    (l'avant abaissé de sa pente), est visé horizontalement depuis l'axe de la couture."""
    c = D['ECHARPE']
    couture = couture_du_cou(D, b)
    centre = couture[:, :2].mean(0)
    angles = np.arctan2(couture[:, 0] - centre[0], -(couture[:, 1] - centre[1]))
    rayons = np.hypot(couture[:, 0] - centre[0], couture[:, 1] - centre[1])
    s = c['segments']
    thetas = np.array([2 * math.pi * i / s - math.pi for i in range(s)])
    dirs = [np.array([math.sin(t), -math.cos(t), 0.0]) for t in thetas]
    # Le bas : au-delà de la couture (elle va en dents de scie, au gré des triangles des deux zones), au plus grand
    # rayon de ses sommets voisins en angle, posé sur le torse habillé.
    torse = cols.plus([zone(b, 'torse')])
    dz, ecart = c['bas']
    portee_au_col, ecart_au_col, jeu_au_col = c['col']
    voisinage_angulaire = 1.5 * math.pi / s
    r0, hauteurs, rangs, ecarts = [], [], [[]], []
    for t, d in zip(thetas, dirs):
        proches = np.abs((angles - t + math.pi) % (2 * math.pi) - math.pi) < voisinage_angulaire
        r = float(rayons[proches].max()) + ecart
        xy = centre + r * d[:2]
        loc = torse.arbre.ray_cast(Vector((xy[0], xy[1], float(couture[:, 2].max()) + 0.2)), Vector((0.0, 0.0, -1.0)))[0]
        if loc is None:
            raise ValueError(f'écharpe : pas de torse sous {xy.round(3).tolist()}')
        O = np.array([centre[0], centre[1], loc.z + dz])
        vu = cols.exterieur(O, d, portee_au_col, jeu_au_col)
        sur_le_col = vu if vu is not None and vu <= r + ecart_au_col else 0.0
        r0.append(r)
        hauteurs.append(O[2])
        rangs[0].append(O)
        ecarts.append(max(0.0, sur_le_col - r))
    ecarts = np.array(ecarts)
    for _ in range(c['passes_du_col']):
        ecarts = np.maximum(ecarts, 0.5 * (np.roll(ecarts, 1) + np.roll(ecarts, -1)))
    r0 = np.array(r0) + ecarts
    hauteurs = np.array(hauteurs)
    dans_le_dos = np.maximum(0.0, -np.cos(thetas))
    for _ in range(c['passes_du_bas']):
        lisses = 0.5 * hauteurs + 0.25 * (np.roll(hauteurs, 1) + np.roll(hauteurs, -1))
        hauteurs = hauteurs + dans_le_dos * (lisses - hauteurs)
    rangs[0] = [np.array([O[0], O[1], z]) + r * d for O, z, r, d in zip(rangs[0], hauteurs, r0, dirs)]
    z_os = float(b.tete(c['os_hauteur'])[2])
    for k, (h, pente, aisance) in enumerate(c['anneaux']):
        hauteurs = np.maximum(z_os + h - pente * np.maximum(0.0, np.cos(thetas)) ** 2, hauteurs + c['ecart_min'])
        rang = []
        for t, z, d, plancher in zip(thetas, hauteurs, dirs, r0):
            pli = c['ampleur_des_plis'] * 0.5 * (1 + math.cos(c['plis'] * t + c['phase_des_plis'] * k))
            O = np.array([centre[0], centre[1], z])
            rh = contournees.exterieur(O, d, c['portee'], max(aisance + pli, c['jeu_min']))
            rang.append(O + max(plancher, rh or 0.0) * d)
        rangs.append(rang)
    anneaux = [(M.ajouter(rang, 'echarpe'), np.array([centre[0], centre[1], float(np.mean([p[2] for p in rang]))])) for rang in rangs]
    for (A, ca), (B, cb) in zip(anneaux, anneaux[1:]):
        M.bande(A, B, (ca + cb) / 2)
    # Part de `Head` de chaque sommet (devant, sous le menton, l'écharpe est poussée par lui), sommets du bas, et ceux
    # du bas et de l'anneau suivant posés sur la robe, qui en prennent les poids et les clés.
    part_de_la_tete = {i: f * max(0.0, math.cos(t)) for (A, _), f in zip(anneaux, c['part_de_la_tete']) for i, t in zip(A, thetas)}
    posees = [i for A, _ in anneaux[:2] for i, t in zip(A, thetas) if abs(t) >= math.radians(c['bas_sur_la_robe'])]
    return part_de_la_tete, anneaux[0][0], posees


# ---------------------------------------------------------------- pan sur l'épaule

def pan(D, b, M, corps, cape):
    c = D['PAN']
    epaule = np.array(b.tete(c['os_epaule']))
    yc, zc = epaule[1] + c['axe'][1], epaule[2] + c['axe'][2]
    alphas = np.radians(np.linspace(c['angle_devant'], c['angle_derriere'], c['stations']))
    colonnes = []
    for dx in c['colonnes_x']:
        x = epaule[0] + dx
        P = b.coupe(['torse'], (x, 0.0, 0.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0), (0.0, 0.0, 1.0))
        H = enveloppe_convexe(P)
        rho, plancher = [], []
        for a in alphas:
            d2 = np.array([-math.cos(a), math.sin(a)])
            d3 = np.array([0.0, d2[0], d2[1]])
            h = max((v for v in (corps.exterieur((x, yc, zc), d3, c['portee'], c['jeu_min']),
                                 cape.exterieur((x, yc, zc), d3, c['portee'], c['jeu_sur_la_cape'])) if v is not None),
                    default=None)
            rho.append(rayon_a_l_enveloppe(H, np.array([yc, zc]), d2) + c['jeu'])
            plancher.append(0.0 if h is None else h)
        rho, plancher = np.maximum(rho, plancher), np.array(plancher)
        for _ in range(c['passes_de_lissage']):
            rho[1:-1] = np.maximum(0.25 * rho[:-2] + 0.5 * rho[1:-1] + 0.25 * rho[2:], plancher[1:-1])
        colonnes.append([np.array([x, yc - r * math.cos(a), zc + r * math.sin(a)]) for r, a in zip(rho, alphas)])
    rangs = [M.ajouter([col[i] for col in colonnes], 'pan') for i in range(len(alphas))]
    ref = np.array([epaule[0] + float(np.mean(c['colonnes_x'])), yc, zc])
    for i in range(len(alphas) - 1):
        for k in range(len(colonnes) - 1):
            M.quad(rangs[i][k], rangs[i][k + 1], rangs[i + 1][k + 1], rangs[i + 1][k], ref)


# ---------------------------------------------------------------- suivi du corps

def tenir_au_corps(b, piece, cles, marge):
    """Sous chaque clé, chaque sommet reste à moins de `marge` fois son jeu (distance au repos au point le plus proche
    du corps, au moins `SOL_TOLERANCE_M`) du déplacement du corps en ce point : la garde `suiviDuCorps` (#3205) mesure
    ainsi le suivi. Un sommet que la liaison de surface écarte davantage (la pointe, loin du crâne, sous
    `gabarit_head_plus`) est ramené sur cette borne. Dérivé de `tenir_au_corps` des coiffures (#3486)."""
    zones = list(b.zones)
    P, T = surface_jointe([b.corps(z)[:2] for z in zones])
    arbre = BVHTree.FromPolygons([tuple(x) for x in P], T.tolist(), all_triangles=True)
    liens = []
    for q in np.array([v.co[:] for v in piece.data.vertices]):
        loc, _, face, dist = arbre.find_nearest(Vector(q.tolist()))
        liens.append((T[face], barycentre(*P[T[face]], np.array(loc)), dist))
    tol = marge * np.array([max(SOL_TOLERANCE_M, j) for _, _, j in liens])
    for cle in cles:
        dB = np.concatenate([decalages_de(b.zones[z], cle) for z in zones])
        d = decalages(piece, cle)
        du_corps = np.array([bc @ dB[t] for t, bc, _ in liens])
        e = d - du_corps
        n = np.linalg.norm(e, axis=1)
        trop = n > tol
        if trop.any():
            d[trop] = du_corps[trop] + e[trop] * (tol[trop] / n[trop])[:, None]
            poser_la_cle(piece, cle, d)


def surface_jointe(morceaux):
    """Positions et triangles de morceaux (positions, triangles) joints."""
    decalages_ = np.cumsum([0] + [len(p) for p, _ in morceaux[:-1]])
    return np.concatenate([p for p, _ in morceaux]), np.concatenate([t + k for (_, t), k in zip(morceaux, decalages_)])


def decalages_de(o, cle):
    cles = o.data.shape_keys
    if not cles or cle not in cles.key_blocks:
        return np.zeros((len(o.data.vertices), 3))
    M = np.array(o.matrix_world)[:3, :3]
    return decalages(o, cle) @ M.T


def barycentre(a, b, c, p):
    v0, v1, v2 = b - a, c - a, p - a
    d00, d01, d11, d20, d21 = v0 @ v0, v0 @ v1, v1 @ v1, v2 @ v0, v2 @ v1
    den = d00 * d11 - d01 * d01
    v = (d11 * d20 - d01 * d21) / den
    w = (d00 * d21 - d01 * d20) / den
    return np.array([1 - v - w, v, w])


# ---------------------------------------------------------------- ensemble

def construire(D, materiaux, b):
    b.exiger(sorted({z for zs in D['PORTEUSES'].values() for z in zs} | set(D['ZONES_DES_CLES'])))
    peau_et_poids = b.matieres_publiees(D['CONTOURNE']['tete'], D['MATIERES_DE_LA_TETE'])
    peau, poil = peau_et_poids[:2], b.matieres_publiees(D['CONTOURNE']['coiffure'], D['MATIERES_DE_LA_COIFFURE'])[:2]
    tete_et_cou = Contournees(D, [peau, poil, zone(b, 'cou')])
    robe = b.matieres_publiees(D['CONTOURNE']['robe'], D['MATIERES_DE_LA_ROBE'])
    cape = b.matieres_publiees(D['CONTOURNE']['cape'], D['MATIERES_DE_LA_CAPE'])
    sangle = b.matieres_publiees(D['CONTOURNE']['bandouliere'], D['MATIERES_DE_LA_BANDOULIERE'])
    dessous = surface_jointe([robe[:2], cape[:2], sangle[:2]]) + (np.concatenate([robe[2], cape[2], sangle[2]]),)
    M = Maillage()
    faces_capuchon = capuchon(D, b, M, tete_et_cou)
    X = np.array(M.sommets)
    avec_capuchon = tete_et_cou.plus([surface_de(X, faces_capuchon)])
    part_de_la_tete, bas_de_l_echarpe, posees = echarpe(D, b, M, avec_capuchon, Contournees(D, [robe[:2], cape[:2]]))
    pan(D, b, M, Contournees(D, [zone(b, 'torse')]), Contournees(D, [cape[:2]]))

    X, orientes, normales = M.orienter()
    sur_la_sangle = porteur_de(*sangle)['arbre']
    posees = sorted(set(posees) | {i for i, (p, partie) in enumerate(zip(X, M.parties)) if partie == 'echarpe'
                                   and sur_la_sangle.find_nearest(Vector(p.tolist()))[3] <= D['ECHARPE']['pose_sur_la_sangle']})
    porteurs = {nom: b.porteur(zs) for nom, zs in D['PORTEUSES'].items()}
    porteurs['capuchon'] = porteur_de(*peau_et_poids)
    porteurs['pan'] = sur_la_robe = porteur_de(*dessous)
    reports = {nom: [(b.indice_os[a], b.indice_os[o]) for a, o in r.items()] for nom, r in D['OS_REPORTES'].items()}
    W = np.zeros((len(X), len(b.os)))
    for i, (p, partie) in enumerate(zip(X, M.parties)):
        W[i] = emprunter(p, porteurs[partie])[0]
        for a, o in reports.get(partie, []):
            W[i, o] += W[i, a]
            W[i, a] = 0.0
    voisins = voisinage(orientes, len(X))
    parties = np.array(M.parties)
    # Le bas de l'écharpe garde ses poids empruntés ; posés sur la robe ou la cape, le bas et l'anneau suivant prennent
    # ceux de la plus proche, tenus à chaque passe : l'écharpe au-dessus s'y raccorde (lissé avec les autres puis remplacé, le bas s'en
    # écartait au-dessus de l'épaule droite, arête de 14 mm étirée ×2,1 en Idle_Loop au neutre). Devant, lissé puis
    # remplacé : tenu à chaque passe, l'arête vers l'anneau suivant s'étirait ×3,78 en Sword_Regular_A, contre ×3,29.
    empruntes = W[bas_de_l_echarpe]
    W[posees] = [emprunter(X[i], sur_la_robe)[0] for i in posees]
    sous_la_robe = W[posees]

    def lisser_en_tenant_la_robe(W_, passes):
        for _ in range(passes):
            W_ = lisser(W_, voisins, 1)
            W_[posees] = sous_la_robe
        return W_
    W = sum(np.where((parties == nom)[:, None], lisser_en_tenant_la_robe(W, passes), 0.0) for nom, passes in D['LISSAGE_POIDS'].items())
    W[bas_de_l_echarpe] = empruntes
    W[posees] = sous_la_robe
    tete_ = b.indice_os['Head']
    for i, f in part_de_la_tete.items():
        if i in posees:
            continue
        W[i] *= 1.0 - f
        W[i, tete_] += f
    piece = b.nappe('capuche', X, normales, W, orientes, materiaux['capuche'], D['EPAISSEUR'])
    arbre = KDTree(len(X))
    for i, p in enumerate(X):
        arbre.insert(Vector(p.tolist()), i)
    arbre.balance()
    indice_de = [arbre.find(v.co)[1] for v in piece.data.vertices]
    partie_de = [parties[i] for i in indice_de]
    cles = b.transferer(piece, D['ZONES_DES_CLES'], masques=[
        ([p == 'capuchon' for p in partie_de], D['ZONES_DES_CLES_DU_CAPUCHON'], {}),
        ([p == 'pan' for p in partie_de], D['ZONES_DES_CLES'],
         {D['CONTOURNE']['robe']: D['ZONES_DE_LA_ROBE']['pan'], D['CONTOURNE']['cape']: D['ZONES_DE_LA_CAPE']}),
        ([i in posees for i in indice_de], D['ZONES_DES_CLES'],
         {D['CONTOURNE']['robe']: D['ZONES_DE_LA_ROBE']['echarpe'], D['CONTOURNE']['cape']: D['ZONES_DE_LA_CAPE'],
          D['CONTOURNE']['bandouliere']: D['ZONES_DE_LA_BANDOULIERE']}),
    ])
    tenir_au_corps(b, piece, [k for k in cles if k.startswith('gabarit_')], D['MARGE_DE_SUIVI'])
    return piece
