"""Géométrie de `humanoide--vetement--robe` (`element/tissu.py`), d'après `donnees.py` (aucun nombre ici).

Deux nappes doubles jointes en une pièce :
- `robe` (robe de dessus) : le corsage, anneaux horizontaux coupés dans les zones du tronc et du cou ; la jupe, rangées
  ouvertes devant en V sous la ceinture, cône évasé depuis la ligne des hanches, jamais à moins du dégagement des
  jambes ; chaque manche, anneaux perpendiculaires aux os du bras, ajustée au bras puis évasée dès le coude, un pan
  pendant vers le bas-arrière, fermée à l'épaule par un cône dans le corps ;
- `dessous` (robe de dessous) : le pan de devant, sous la robe de dessus, vu par l'ouverture ; la manche ajustée de
  l'avant-bras, vue dans la manche évasée.
Poids : le corsage et le haut des manches empruntent au corps ; les anneaux évasés de l'avant-bras prennent le poids
de leur axe (l'anneau suit l'avant-bras d'un bloc) ; la jupe passe, sous la tête des brins, du bassin aux brins de la
chaîne `jupe` (secteurs angulaires de `donnees.py`), jamais aux cuisses. Silhouettes et clés `gabarit_*` transférées.
"""
import math

import numpy as np
from tissu import Maillage, anneau, centre_de, emprunter, joindre, lisser, repere_de_plan, voisinage

TRONC, COU = ['hanches', 'torse'], ['cou']
BRAS = {c: [f'bras_haut_{c}', f'avant_bras_{c}'] for c in 'gd'}
OS_BRAS = {'g': ('upperarm_l', 'lowerarm_l', 'hand_l'), 'd': ('upperarm_r', 'lowerarm_r', 'hand_r')}
JAMBES = [f'{z}_{c}' for z in ('cuisse', 'genou', 'mollet') for c in 'gd']
PORTEUSES = TRONC + COU + BRAS['g'] + BRAS['d'] + JAMBES
OS_DES_JAMBES = ('thigh_l', 'thigh_r', 'calf_l', 'calf_r')


def unitaire(x):
    return x / np.linalg.norm(x)


def direction(theta):
    """Direction horizontale (x, y) de l'angle `theta` (degrés, depuis l'avant -Y vers la gauche +X)."""
    t = math.radians(theta)
    return np.array([math.sin(t), -math.cos(t)])


class Nappe(Maillage):
    """Un `Maillage` qui garde, par sommet, ses poids bruts sur les os de la base."""

    def __init__(self):
        super().__init__()
        self.poids, self.fixes = [], []

    def poser(self, points, poids, fixes=False):
        """`fixes` : poids gardés tels quels, sans lissage (jupe : deux nappes aux mêmes poids, sommet pour sommet)."""
        self.poids.extend(poids)
        self.fixes.extend([fixes] * len(points))
        return self.ajouter(points, None)


def piece_de(D, b, M, mat, surface):
    X, orientes, normales = M.orienter()
    W0 = np.array(M.poids)
    voisins = voisinage(orientes, len(X))
    W = np.where(np.array(M.fixes)[:, None], W0, lisser(W0, voisins, D['LISSAGE_POIDS']))
    return b.nappe(surface, X, normales, W, orientes, mat, D['EPAISSEUR'])


def construire(D, materiaux, b):
    b.exiger(PORTEUSES)
    porteurs = {'T': b.porteur(TRONC + COU), 'J': b.porteur(TRONC), 'g': b.porteur(['torse'] + BRAS['g']),
                'd': b.porteur(['torse'] + BRAS['d'])}
    robe, dessous = Nappe(), Nappe()

    # Corsage.
    ancres = {'bas': float(b.corps('torse')[0][:, 2].min()),
              'aisselle': min(float(b.corps(z)[0][:, 2].min()) for z in ('bras_haut_g', 'bras_haut_d')),
              'cou': float(b.corps('cou')[0][:, 2].min())}
    m = D['SEGMENTS_CORPS']
    thetas = [360.0 * i / m for i in range(m)]
    corsage = []
    for ancre, dz, e in D['CORSAGE']:
        z = ancres[ancre] + dz
        P = b.coupe(TRONC + COU, (0.0, 0.0, z), (0.0, 0.0, 1.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0), minimum=1)
        centre = centre_de(P)
        pts = [np.array([p[0], p[1], z]) for p in anneau(P, centre, [direction(t) for t in thetas], [e] * m,
                                                          D['DEGAGEMENT_MIN'], au_plus_pres=True)]
        corsage.append((robe.poser(pts, [emprunter(p, porteurs['T'])[0] for p in pts]), np.array([centre[0], centre[1], z])))
    for (A, ca), (B, cb) in zip(corsage, corsage[1:]):
        robe.bande(A, B, (ca + cb) / 2)

    # Jupe : rayon par direction autour du centre des hanches.
    zones_jupe = TRONC + JAMBES
    P = b.coupe(zones_jupe, (0.0, 0.0, D['Z_HANCHES']), (0.0, 0.0, 1.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0))
    centre_j = centre_de(P)
    z_haut, z_brin = D['RANGEES_JUPE'][0], float(b.tete('jupe_avant_01').z)
    tetes_des_os = [float(b.tete(f'jupe_avant_0{k}').z) for k in (1, 2, 3)]

    def rayon(z, theta):
        """Rayon de la robe de dessus à la hauteur `z`, direction `theta`."""
        d = direction(theta)
        Pz = b.coupe(zones_jupe, (0.0, 0.0, max(z, D['OURLET_ROBE'])), (0.0, 0.0, 1.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0))
        appui = float(np.linalg.norm(anneau(Pz, centre_j, [d], [0.0], 0.0, au_plus_pres=True)[0] - centre_j))
        jeu = D['DEGAGEMENT_MIN'] + D['ECART_DESSOUS'] + D['EPAISSEUR']
        if z >= D['Z_HANCHES']:
            return appui + max(D['AISANCE_HANCHES'], jeu)
        hanches = float(np.linalg.norm(anneau(P, centre_j, [d], [D['AISANCE_HANCHES']], 0.0, au_plus_pres=True)[0] - centre_j))
        t = (D['Z_HANCHES'] - z) / (D['Z_HANCHES'] - D['OURLET_ROBE'])
        evasement = D['EVASEMENT_DEVANT'] + (D['EVASEMENT_ARRIERE'] - D['EVASEMENT_DEVANT']) * (1 - math.cos(math.radians(theta))) / 2
        return max(hanches * (1 + (evasement - 1) * t), appui + jeu)

    rayons_min = {}

    def part_des_brins(z):
        """Part des brins à la hauteur `z`, bornée sous le repli des arêtes (`donnees.py`, poids de la jupe)."""
        if z >= z_brin:
            return 0.0
        if z not in rayons_min:
            rayons_min[z] = min(rayon(z, t) for t in (0.0, 90.0, 180.0, 270.0))
        c = 2 * math.sin(math.radians(D['ROTATION_RELATIVE_MAX']) / 2)
        return min(1.0, D['MARGE_DE_PLI'] / c * min(1.0, math.pi * rayons_min[z] / (2 * (z_brin - z))))

    def poids_de_jupe(p, z, theta):
        part = part_des_brins(z)
        w = np.zeros(len(b.os))
        if part < 1:
            corps_ = emprunter(np.array([p[0], p[1], max(z, D['Z_HANCHES'])]), porteurs['J'])[0]
            for os_ in OS_DES_JAMBES:
                corps_[b.indice_os['pelvis']] += corps_[b.indice_os[os_]]
                corps_[b.indice_os[os_]] = 0.0
            w += (1 - part) * corps_
        k = 1 if z >= tetes_des_os[1] else 2 if z >= tetes_des_os[2] else 3
        t = theta % 360.0
        cote = 'g' if t < 180 else 'd'
        avant = min(t, 360 - t)
        parts = {'avant': max(0.0, 1 - avant / 90), cote: 1 - abs(avant - 90) / 90,
                 'arriere': max(0.0, (avant - 90) / 90)}
        for brin, v in parts.items():
            w[b.indice_os[f'jupe_{brin}_0{k}']] += part * v
        return w

    def rangee(nappe_, zs, thetas_, ecart):
        """Une rangée de jupe : un sommet par (hauteur, angle)."""
        pts = [np.array([centre_j[0], centre_j[1], z]) + np.append((rayon(z, t) - ecart) * direction(t), 0.0)
               for z, t in zip(zs, thetas_)]
        return (nappe_.poser(pts, [poids_de_jupe(p, z, t) for p, z, t in zip(pts, zs, thetas_)], fixes=True),
                np.array([centre_j[0], centre_j[1], float(np.mean(zs))]))

    def fraction(z, z_bas):
        return (z_haut - z) / (z_haut - z_bas)

    def colonnes(z, z_bas):
        """Les angles des colonnes de la robe de dessus à la hauteur `z`, de l'ouverture gauche à l'ouverture droite."""
        o = D['OUVERTURE_TAILLE'] + (D['OUVERTURE_OURLET'] - D['OUVERTURE_TAILLE']) * fraction(z, z_bas)
        return [o + (360 - 2 * o) * k / m for k in range(m + 1)]

    rangees = D['RANGEES_JUPE'] + [D['OURLET_ROBE']]
    jupe = [rangee(robe, [z] * (m + 1), colonnes(z, D['OURLET_ROBE']), 0.0) for z in rangees]
    (A, ca), (B, cb) = corsage[0], jupe[0]
    for i in range(m):
        robe.quad(A[i], A[(i + 1) % m], B[i + 1], B[i], (ca + cb) / 2)
    for (A, ca), (B, cb) in zip(jupe, jupe[1:]):
        for i in range(m):
            robe.quad(A[i], A[i + 1], B[i + 1], B[i], (ca + cb) / 2)

    # Pan de dessous : sous la robe de dessus, aux angles mêmes de ses `RECOUVREMENT_DESSOUS` premières colonnes de
    # chaque bord (mêmes poids, sommet pour sommet), et `COLONNES_OUVERTURE` intervalles dans l'ouverture ; à l'ourlet,
    # bas dans l'ouverture, remonté sous la robe de dessus au-delà.
    K, G = D['RECOUVREMENT_DESSOUS'], D['COLONNES_OUVERTURE']
    pan = []
    for z in rangees:
        c = colonnes(z, D['OURLET_ROBE'])
        o = c[0]
        thetas_d = [t - 360 for t in c[m - K:]] + [-o + 2 * o * k / G for k in range(1, G)] + c[:K + 1]
        if z == D['OURLET_ROBE']:
            zs = []
            for t in thetas_d:
                x = min(1.0, max(0.0, (abs(t) - o) / (c[K] - o)))
                zs.append(D['OURLET_DESSOUS'] + (D['OURLET_ROBE'] + D['REMONTEE_DESSOUS'] - D['OURLET_DESSOUS']) * x * x * (3 - 2 * x))
        else:
            zs = [z] * len(thetas_d)
        pan.append(rangee(dessous, zs, thetas_d, D['ECART_DESSOUS']))
    for (A, ca), (B, cb) in zip(pan, pan[1:]):
        for i in range(len(A) - 1):
            dessous.quad(A[i], A[i + 1], B[i + 1], B[i], (ca + cb) / 2)

    # Manches.
    s = D['SEGMENTS_MANCHE']
    phis = [360.0 * i / s for i in range(s)]
    dirs_m = [np.array([math.cos(math.radians(t)), math.sin(math.radians(t))]) for t in phis]
    lobe = [max(0.0, math.cos(math.radians(t - D['ANGLE_DU_PAN']))) ** 2 for t in phis]
    for c, signe in (('g', 1.0), ('d', -1.0)):
        epaule, coude, poignet = (np.array(b.tete(o)) for o in OS_BRAS[c])

        def anneau_de_bras(segment, f, ais):
            o0, o1 = (epaule, coude) if segment == 'haut' else (coude, poignet)
            axe = unitaire(o1 - o0)
            u, v = repere_de_plan(axe, (0.0, 0.0, 1.0), signe)
            O = o0 + f * (o1 - o0)
            Pm = b.coupe(BRAS[c], o0 + max(f, D['COUPE_MIN']) * (o1 - o0), axe, u, v)
            Pm = Pm[np.hypot(Pm[:, 0], Pm[:, 1]) < D['RAYON_DE_COUPE_MAX']]
            centre = centre_de(Pm)
            pts = [O + p[0] * u + p[1] * v for p in anneau(Pm, centre, dirs_m, ais, D['DEGAGEMENT_MIN'])]
            return pts, O + centre[0] * u + centre[1] * v

        liste = []
        for segment, f, e, pend in D['MANCHE']:
            pts, axe_pt = anneau_de_bras(segment, f, [e + pend * l for l in lobe])
            if segment == 'haut':
                poids = [emprunter(p, porteurs[c])[0] for p in pts]
            else:
                poids = [emprunter(axe_pt, porteurs[c])[0]] * s
            liste.append((robe.poser(pts, poids), axe_pt))
        for (A, ca), (B, cb) in zip(liste, liste[1:]):
            robe.bande(A, B, (ca + cb) / 2)
        R, cR = liste[0]
        rentre = unitaire(cR - liste[1][1])
        fond = robe.poser([np.mean([robe.sommets[i] for i in R], axis=0) + D['CREUX_DE_LA_RACINE'] * rentre],
                          [emprunter(cR, porteurs[c])[0]])[0]
        for i in range(s):
            robe.triangle(R[i], R[(i + 1) % s], fond, cR + (cR - liste[1][1]))

        sous = []
        for f, e in D['SOUS_MANCHE']:
            pts, axe_pt = anneau_de_bras('bas', f, [e] * s)
            sous.append((dessous.poser(pts, [emprunter(p, porteurs[c])[0] for p in pts]), axe_pt))
        for (A, ca), (B, cb) in zip(sous, sous[1:]):
            dessous.bande(A, B, (ca + cb) / 2)

    piece = joindre([piece_de(D, b, robe, materiaux['robe'], 'robe'),
                     piece_de(D, b, dessous, materiaux['dessous'], 'dessous')])
    b.transferer(piece, PORTEUSES, D['BORNES_DES_CLES'])
    return piece
