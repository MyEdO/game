"""Géométrie de `humanoide--vetement--robe` (`element/tissu.py`), d'après `donnees.py` (aucun nombre ici).

Trois nappes doubles jointes en une pièce :
- `robe` (robe de dessus) : le corsage, anneaux horizontaux coupés dans les zones du tronc et du cou, ouverts devant en
  V au-dessus de la poitrine, fermés au-dessus des épaules jusqu'au cou ; la jupe, rangées ouvertes devant en V sous la
  ceinture, posée au jeu sur le filet `jupe` de la base au repos, jamais à moins du dégagement des jambes ; chaque manche, anneaux
  perpendiculaires à `upperarm`, ajustée jusqu'au coude puis en cloche au-delà, un pan incliné sur l'axe du bras, fermée à l'épaule par un cône dans le corps ;
- `dessous` (robe de dessous) : la jupe fermée, sous la robe de dessus, vue par l'ouverture et sous son ourlet, sur le
  même filet ;
- `poitrine` : la peau du V de l'encolure, au ras du torse, sous les bords du corsage.
Poids : le corsage, la poitrine et le raccord des manches à l'épaule empruntent au corps, sommet par sommet ; au-delà,
la manche entière suit `upperarm` d'un bloc, sans lissage, et l'avant-bras plié sort de la cloche ; les jupes passent, sous
les racines du filet, du bassin aux os de ses deux brins voisins (`tissu.Filet`), jamais aux cuisses.
Silhouettes et clés `gabarit_*` transférées.
"""
import math

import numpy as np
from tissu import Maillage, anneau, centre_de, direction, emprunter, joindre, lambeaux, lisser, repere_de_plan, voisinage

TRONC, COU = ['hanches', 'torse'], ['cou']
BRAS = {c: [f'bras_haut_{c}', f'avant_bras_{c}'] for c in 'gd'}
OS_BRAS = {'g': ('upperarm_l', 'lowerarm_l'), 'd': ('upperarm_r', 'lowerarm_r')}
JAMBES = [f'{z}_{c}' for z in ('cuisse', 'genou', 'mollet') for c in 'gd']
PORTEUSES = TRONC + COU + BRAS['g'] + BRAS['d'] + JAMBES
OS_DES_JAMBES = ('thigh_l', 'thigh_r', 'calf_l', 'calf_r')


def unitaire(x):
    return x / np.linalg.norm(x)


def colonnes_ouvertes(o, m):
    """Les angles de `m` colonnes autour du corps : un anneau fermé si `o` est nul, sinon ouvert devant de la demi-ouverture
    `o` (degrés), `m + 1` angles de `o` à `360 - o`."""
    if o == 0:
        return [360.0 * i / m for i in range(m)]
    return [o + (360 - 2 * o) * k / m for k in range(m + 1)]


def relier(nappe, A, B, m, ref):
    """Les `m` quads entre deux anneaux de `m` colonnes, chacun fermé (`m` sommets, ou les `m + 1` d'un V et ceux qui
    comblent son haut) ou ouvert (`m + 1`)."""
    for i in range(m):
        nappe.quad(A[i], A[(i + 1) % len(A)], B[(i + 1) % len(B)], B[i], ref)


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
    robe, dessous, poitrine = Nappe(), Nappe(), Nappe()

    # Corsage.
    ancres = {'bas': float(b.corps('torse')[0][:, 2].min()),
              'aisselle': min(float(b.corps(z)[0][:, 2].min()) for z in ('bras_haut_g', 'bras_haut_d')),
              'cou': float(b.corps('cou')[0][:, 2].min())}
    m = D['SEGMENTS_CORPS']
    corsage, encolure, thetas = [], [], []
    ouvertures = [o for _, _, _, o in D['CORSAGE']]
    for k, (ancre, dz, e, o) in enumerate(D['CORSAGE']):
        # Un anneau fermé au-dessus d'un V garde les colonnes du V et comble son haut ; ceux qui le suivent les gardent :
        # aux colonnes régulières, l'anneau du col tournait par rapport au V et la bande qui les joint se repliait
        # au-dessus de l'épaule droite (garde `enroulement`, robe-torse).
        if o > 0 or k == 0 or (ouvertures[k - 1] == 0 and len(thetas) == m):
            thetas = colonnes_ouvertes(o, m)
        elif ouvertures[k - 1] > 0:
            haut_du_v = ouvertures[k - 1]
            comble = max(1, round(2 * haut_du_v * m / 360))
            thetas = thetas + [360 - haut_du_v + 2 * haut_du_v * j / comble for j in range(1, comble)]
        z = ancres[ancre] + dz
        P = b.coupe(TRONC + COU, (0.0, 0.0, z), (0.0, 0.0, 1.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0), minimum=1)
        centre = centre_de(P)

        def sur_le_tronc(nappe_, thetas_, aisance):
            pts = [np.array([p[0], p[1], z]) for p in anneau(P, centre, [direction(t) for t in thetas_],
                                                              [aisance] * len(thetas_), D['DEGAGEMENT_MIN'], au_plus_pres=True)]
            return nappe_.poser(pts, [emprunter(p, porteurs['T'])[0] for p in pts]), np.array([centre[0], centre[1], z])
        corsage.append(sur_le_tronc(robe, thetas, e))
        if max(ouvertures[max(k - 1, 0):k + 2]) > 0:
            bord = o + D['RECOUVREMENT_POITRINE']
            g = D['COLONNES_POITRINE']
            encolure.append(sur_le_tronc(poitrine, [-bord + 2 * bord * i / g for i in range(g + 1)], 0.0))
    for k, ((A, ca), (B, cb)) in enumerate(zip(corsage, corsage[1:])):
        if ouvertures[k] == ouvertures[k + 1] == 0 and len(A) == len(B):
            robe.bande(A, B, (ca + cb) / 2)
        else:
            relier(robe, A, B, m, (ca + cb) / 2)
    for (A, ca), (B, cb) in zip(encolure, encolure[1:]):
        relier(poitrine, A, B, D['COLONNES_POITRINE'], (ca + cb) / 2)

    # Jupe : sous la charnière, sur le filet `jupe` de la base.
    zones_jupe = TRONC + JAMBES
    filet = b.filet('jupe')
    centre_j = filet.axe
    z_haut = D['RANGEES_JUPE'][0]

    def rayon(z, theta):
        """Rayon de la robe de dessus à la hauteur `z`, direction `theta`."""
        Pz = b.coupe(zones_jupe, (0.0, 0.0, max(z, D['OURLET_DESSOUS'])), (0.0, 0.0, 1.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0))
        appui = float(np.linalg.norm(anneau(Pz, centre_j, [direction(theta)], [0.0], 0.0, au_plus_pres=True)[0] - centre_j))
        jeu = D['DEGAGEMENT_MIN'] + D['ECART_DESSOUS'] + D['EPAISSEUR']
        part = filet.part(z)
        return max((1 - part) * (appui + max(D['AISANCE_HANCHES'], jeu)) + part * (filet.point(z, theta)[0] + jeu), appui + jeu)

    def poids_de_jupe(p, z, theta):
        part = filet.part(z)
        w = part * filet.poids(z, theta)
        if part < 1:
            corps_ = emprunter(np.array([p[0], p[1], max(z, D['Z_HANCHES'])]), porteurs['J'])[0]
            for os_ in OS_DES_JAMBES:
                corps_[b.indice_os['pelvis']] += corps_[b.indice_os[os_]]
                corps_[b.indice_os[os_]] = 0.0
            w += (1 - part) * corps_
        return w

    def rangee(nappe_, zs, thetas_, ecart):
        """Une rangée de jupe : un sommet par (hauteur, angle)."""
        pts = [np.array([centre_j[0], centre_j[1], z]) + np.append((rayon(z, t) - ecart) * direction(t), 0.0)
               for z, t in zip(zs, thetas_)]
        return (nappe_.poser(pts, [poids_de_jupe(p, z, t) for p, z, t in zip(pts, zs, thetas_)], fixes=True),
                np.array([centre_j[0], centre_j[1], float(np.mean(zs))]))

    def colonnes(z):
        """Les angles des colonnes de la robe de dessus à la hauteur `z` (à son ourlet au-dessous), de l'ouverture gauche à
        l'ouverture droite."""
        f = (z_haut - max(z, D['OURLET_ROBE'])) / (z_haut - D['OURLET_ROBE'])
        return colonnes_ouvertes(D['OUVERTURE_TAILLE'] + (D['OUVERTURE_OURLET'] - D['OUVERTURE_TAILLE']) * f, m)

    rangees = D['RANGEES_JUPE'] + [D['OURLET_ROBE']]
    jupe = [rangee(robe, [z] * (m + 1), colonnes(z), 0.0) for z in rangees]
    for (A, ca), (B, cb) in zip(corsage[:1] + jupe, jupe):
        relier(robe, A, B, m, (ca + cb) / 2)

    # Robe de dessous : un anneau fermé par rangée, de la première rangée de la jupe à son ourlet, sous la robe de dessus
    # aux angles de ses colonnes à la même hauteur, `COLONNES_OUVERTURE` intervalles dans l'ouverture ; sous l'ourlet de la
    # robe, aux angles de l'ourlet.
    # Son ourlet est en lambeaux : chaque colonne remonte de la profondeur que lui laisse `lambeaux`.
    G = D['COLONNES_OUVERTURE']
    jupe_dessous = []
    for z in rangees + D['RANGEES_DESSOUS'] + [D['OURLET_DESSOUS']]:
        c = colonnes(z)
        thetas_d = c + [360 - c[0] + 2 * c[0] * k / G for k in range(1, G)]
        L = D['LAMBEAUX_DESSOUS']
        zs = [z + L['profondeur'] - d for d in lambeaux(L, len(thetas_d))] if z == D['OURLET_DESSOUS'] else [z] * len(thetas_d)
        jupe_dessous.append(rangee(dessous, zs, thetas_d, D['ECART_DESSOUS']))
    for (A, ca), (B, cb) in zip(jupe_dessous, jupe_dessous[1:]):
        dessous.bande(A, B, (ca + cb) / 2)

    # Manches.
    s = D['SEGMENTS_MANCHE']
    phis = [360.0 * i / s for i in range(s)]
    dirs_m = [np.array([math.cos(math.radians(t)), math.sin(math.radians(t))]) for t in phis]
    lobe = [max(0.0, math.cos(math.radians(t - D['ANGLE_DU_PAN']))) ** 2 for t in phis]
    radial, axial = math.sin(math.radians(D['INCLINAISON_DU_PAN'])), math.cos(math.radians(D['INCLINAISON_DU_PAN']))
    for c, signe in (('g', 1.0), ('d', -1.0)):
        o0, o1 = (np.array(b.tete(o)) for o in OS_BRAS[c])

        def anneau_de_bras(f, ais):
            axe = unitaire(o1 - o0)
            u, v = repere_de_plan(axe, (0.0, 0.0, 1.0), signe)
            O = o0 + f * (o1 - o0)
            Oc = o0 + max(f, D['COUPE_MIN']) * (o1 - o0)
            Pm = b.coupe(BRAS[c], Oc, axe, u, v)
            Pm = Pm[np.hypot(Pm[:, 0], Pm[:, 1]) < D['RAYON_DE_COUPE_MAX']]
            centre = centre_de(Pm)
            pts = [O + p[0] * u + p[1] * v for p in anneau(Pm, centre, dirs_m, ais, D['DEGAGEMENT_MIN'])]
            return pts, O + centre[0] * u + centre[1] * v, [Oc + p[0] * u + p[1] * v for p in Pm], axe

        peau_du_bras = anneau_de_bras(D['COUPE_DES_POIDS'], [0.0] * s)[2]
        poids_du_bras = np.mean([emprunter(q, porteurs[c])[0] for q in peau_du_bras], axis=0)
        liste = []
        for f, e, pend in D['MANCHE']:
            pts, axe_pt, _, axe = anneau_de_bras(f, [e + pend * radial * l for l in lobe])
            pts = [p + pend * axial * l * axe for p, l in zip(pts, lobe)]
            raccord = f < D['RACCORD_EPAULE']
            poids = [emprunter(p, porteurs[c])[0] for p in pts] if raccord else [poids_du_bras] * s
            liste.append((robe.poser(pts, poids, fixes=not raccord), axe_pt))
        for (A, ca), (B, cb) in zip(liste, liste[1:]):
            robe.bande(A, B, (ca + cb) / 2)
        R, cR = liste[0]
        rentre = unitaire(cR - liste[1][1])
        fond = robe.poser([np.mean([robe.sommets[i] for i in R], axis=0) + D['CREUX_DE_LA_RACINE'] * rentre],
                          [emprunter(cR, porteurs[c])[0]])[0]
        for i in range(s):
            robe.triangle(R[i], R[(i + 1) % s], fond, cR + (cR - liste[1][1]))

    piece = joindre([piece_de(D, b, robe, materiaux['robe'], 'robe'),
                     piece_de(D, b, dessous, materiaux['dessous'], 'dessous'),
                     piece_de(D, b, poitrine, materiaux['poitrine'], 'poitrine')])
    b.transferer(piece, PORTEUSES, D['BORNES_DES_CLES'])
    return piece
