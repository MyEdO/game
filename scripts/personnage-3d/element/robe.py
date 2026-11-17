"""Kit des robes (#3743, #3867, #4351) : une robe longue skinnée sur la base, de chaîne `jupe`, d'après le `donnees.py` de
la pièce (aucun nombre ici). Un dossier de robe ne porte que son `donnees.py` et `from robe import construire`.

Une double nappe `robe`, d'un seul pan, fermée :
- le corsage, anneaux horizontaux de `CORSAGE` (ancre de `ancres_du_corps`, décalage, aisance) coupés dans le tronc et le
  cou ;
- la jupe, rangées de `RANGEES_JUPE` jusqu'à `OURLET_ROBE`, posée au jeu sur le filet `jupe` de la base au repos, jamais à
  moins du dégagement des jambes, l'ourlet en lambeaux si `LAMBEAUX_ROBE` ;
- chaque manche de `MANCHE` (vide pour une jupe), anneaux perpendiculaires à `upperarm`, un pan incliné sur l'axe du
  bras, fermée à l'épaule par un cône dans le corps, le bord en lambeaux si `LAMBEAUX_MANCHE`.
Poids : le corsage et le raccord des manches à l'épaule empruntent au corps, sommet par sommet ; au-delà de
`RACCORD_EPAULE`, la manche suit d'un bloc les os de la peau à `COUPE_DES_POIDS`, sans lissage ; la jupe prend les os
des deux brins voisins du filet (`tissu.Filet`), jamais les cuisses.
Silhouettes et clés `gabarit_*` transférées. Chaque emplacement de `EMPLACEMENTS_DEPLACES` passe de la peau de la base
à la surface de la robe (`Base.offrir_sur`).

Un vêtement d'une autre coupe compose les mêmes pièces dans son `modele.py` : `Nappe`, `ancres_du_corps`, `sur_le_tronc`,
`anneaux`, `bras_de`, `fermer_a_l_epaule`, `manches`, `piece_de`.
"""
import math

import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

from anatomie import EMPLACEMENTS
from tissu import (Maillage, anneau, centre_de, direction, emprunter, enveloppe_convexe, lambeaux, lisser, porteur_de,
                   rayon_a_l_enveloppe, repere_de_plan, unitaire, voisinage)

TRONC, COU = ['hanches', 'torse'], ['cou']
BRAS = {c: [f'bras_haut_{c}', f'avant_bras_{c}'] for c in 'gd'}
OS_BRAS = {'g': ('upperarm_l', 'lowerarm_l'), 'd': ('upperarm_r', 'lowerarm_r')}
JAMBES = [f'{z}_{c}' for z in ('cuisse', 'genou', 'mollet') for c in 'gd']
PORTEUSES = TRONC + COU + BRAS['g'] + BRAS['d'] + JAMBES


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

    def lisses(self, passes):
        """Positions, triangles orientés, normales et poids, ceux des sommets non fixes lissés de `passes` passes."""
        X, orientes, normales = self.orienter()
        W = np.array(self.poids)
        W = np.where(np.array(self.fixes)[:, None], W, lisser(W, voisinage(orientes, len(X)), passes))
        return X, orientes, normales, W


def hauteurs(z, n, ourlet, L):
    """Les hauteurs des `n` colonnes d'une rangée de jupe à `z` : à l'`ourlet` en lambeaux `L`, chaque colonne remonte de
    la profondeur que lui laisse `lambeaux`."""
    return [z + L['profondeur'] - d for d in lambeaux(L, n)] if L and z == ourlet else [z] * n


def deplacer(b, robe, nom):
    """Offre l'emplacement `nom` de la base sur la surface extérieure de la robe : le rayon qui le cherche sur la peau
    (`EMPLACEMENTS` de `base/anatomie.py`) s'arrête sur la robe ; ses poids sont ceux de la robe au point touché."""
    os_, ancre, d = EMPLACEMENTS[nom]
    bone = b.rig.data.bones[os_]
    point = b.rig.matrix_world @ bone.head_local.lerp(bone.tail_local, ancre)
    X, T = np.array(robe.sommets), np.array(robe.triangles)
    touche = BVHTree.FromPolygons([tuple(p) for p in X], T.tolist(), all_triangles=True).ray_cast(point - Vector(d), Vector(d))[0]
    if touche is None:
        raise ValueError(f'emplacement {nom} : aucune robe sous {tuple(point - Vector(d))}')
    b.offrir_sur(nom, np.array(touche), porteur_de(X, T, np.array(robe.poids)))


def ancres_du_corps(b):
    """Les hauteurs où s'ancrent les anneaux d'un corps de vêtement : `bas` (bas du torse), `aisselle` (bas du haut des
    bras), `cou` (bas du cou)."""
    return {'bas': float(b.corps('torse')[0][:, 2].min()),
            'aisselle': min(float(b.corps(z)[0][:, 2].min()) for z in BRAS['g'][:1] + BRAS['d'][:1]),
            'cou': float(b.corps('cou')[0][:, 2].min())}


def sur_le_tronc(D, b, porteur, zones, z):
    """La coupe horizontale des zones `zones` à la hauteur `z` : `poser(nappe, thetas, aisance)` pose sur `nappe` un
    sommet par angle de `thetas`, sur l'enveloppe de la coupe plus la plus grande de l'aisance et de `DEGAGEMENT_MIN`,
    aux poids de `porteur` sous lui, et rend ses sommets et son centre ; `rayon(theta)`, le rayon de l'enveloppe."""
    P = b.coupe(zones, (0.0, 0.0, z), (0.0, 0.0, 1.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0), minimum=1)
    centre, H = centre_de(P), enveloppe_convexe(P)

    def rayon(theta):
        return rayon_a_l_enveloppe(H, centre, direction(theta))

    def poser(nappe, thetas, aisance):
        pts = [np.append(centre + (rayon(t) + max(aisance, D['DEGAGEMENT_MIN'])) * direction(t), z) for t in thetas]
        return nappe.poser(pts, [emprunter(p, porteur)[0] for p in pts]), np.array([centre[0], centre[1], z])
    return poser, rayon


def anneaux(D, b, nappe, porteur, liste, m, au_cou=COU):
    """Les anneaux horizontaux fermés de `liste` (ancre de `ancres_du_corps`, décalage, aisance), `m` colonnes, coupés
    dans le tronc et le cou, dans `au_cou` au-dessus du bas du cou (la coupe du tronc y passe encore sur le trapèze,
    jusqu'aux épaules), reliés en bandes : le corps fermé d'une chemise, d'un pourpoint ou d'une robe. Rend les anneaux
    (sommets, centre)."""
    ancres = ancres_du_corps(b)
    thetas = [360.0 * i / m for i in range(m)]
    faits = []
    for ancre, dz, e in liste:
        poser, _ = sur_le_tronc(D, b, porteur, au_cou if ancre == 'cou' and dz > 0 else TRONC + COU, ancres[ancre] + dz)
        faits.append(poser(nappe, thetas, e))
    for (A, ca), (B, cb) in zip(faits, faits[1:]):
        nappe.bande(A, B, (ca + cb) / 2)
    return faits


def piece_de(D, b, M, mat, surface):
    X, orientes, normales, W = M.lisses(D['LISSAGE_POIDS'])
    return b.nappe(surface, X, normales, W, orientes, mat, D['EPAISSEUR'])


def construire(D, materiaux, b):
    b.exiger(PORTEUSES)
    porteurs = {'T': b.porteur(TRONC + COU), 'g': b.porteur(['torse'] + BRAS['g']),
                'd': b.porteur(['torse'] + BRAS['d'])}
    robe = Nappe()
    m = D['SEGMENTS_CORPS']
    thetas = [360.0 * i / m for i in range(m)]
    corsage = anneaux(D, b, robe, porteurs['T'], [(ancre, dz, e) for ancre, dz, e, _ in D['CORSAGE']], m, TRONC + COU)

    # Jupe : sous la charnière, sur le filet `jupe` de la base.
    zones_jupe = TRONC + JAMBES
    filet = b.filet('jupe')
    centre_j = filet.axe
    z_haut = D['RANGEES_JUPE'][0]
    if filet.part(z_haut) < 1:
        raise ValueError(f'robe : la première rangée de la jupe ({z_haut} m) monte au-dessus de la charnière du filet `jupe`')
    jeu = D['DEGAGEMENT_MIN'] + D['EPAISSEUR']

    def rayon(z, theta):
        """Rayon de la robe à la hauteur `z`, direction `theta`."""
        Pz = b.coupe(zones_jupe, (0.0, 0.0, max(z, D['OURLET_ROBE'])), (0.0, 0.0, 1.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0))
        appui = float(np.linalg.norm(anneau(Pz, centre_j, [direction(theta)], [0.0], 0.0, au_plus_pres=True)[0] - centre_j))
        return max(filet.point(z, theta)[0] + jeu, appui + jeu)

    jupe = []
    for z in D['RANGEES_JUPE'] + [D['OURLET_ROBE']]:
        zs = hauteurs(z, m, D['OURLET_ROBE'], D.get('LAMBEAUX_ROBE'))
        pts = [np.array([centre_j[0], centre_j[1], z_]) + np.append(rayon(z_, t) * direction(t), 0.0)
               for z_, t in zip(zs, thetas)]
        jupe.append((robe.poser(pts, [filet.poids(z_, t) for z_, t in zip(zs, thetas)], fixes=True),
                     np.array([centre_j[0], centre_j[1], float(np.mean(zs))])))
    for (A, ca), (B, cb) in zip(corsage[:1] + jupe, jupe):
        robe.bande(A, B, (ca + cb) / 2)

    # Manches, s'il en est : une jupe n'en a pas.
    if D['MANCHE']:
        manches(D, b, robe, porteurs)
    for nom in D.get('EMPLACEMENTS_DEPLACES', []):
        deplacer(b, robe, nom)
    piece = piece_de(D, b, robe, materiaux['robe'], 'robe')
    b.transferer(piece, PORTEUSES, D['BORNES_DES_CLES'])
    return piece


def bras_de(D, b, c, signe, dirs, porteur):
    """Le bras `c` sous une manche d'anneaux perpendiculaires à `upperarm`, un sommet par direction de `dirs` dans leur
    plan : son axe ; `anneau_de_bras(f, aisances)`, l'anneau à la fraction `f` de l'os (au-delà de 1 passé le coude), ses
    points à leurs aisances, son centre et la peau de la coupe, prise à `COUPE_MIN` en deçà et sans ce qui passe
    `RAYON_DE_COUPE_MAX` ; les poids d'un bloc, moyenne de ceux de `porteur` sous la peau à `COUPE_DES_POIDS`."""
    o0, o1 = (np.array(b.tete(o)) for o in OS_BRAS[c])
    axe = unitaire(o1 - o0)
    u, v = repere_de_plan(axe, (0.0, 0.0, 1.0), signe)

    def anneau_de_bras(f, aisances):
        O = o0 + f * (o1 - o0)
        Oc = o0 + max(f, D['COUPE_MIN']) * (o1 - o0)
        P = b.coupe(BRAS[c], Oc, axe, u, v)
        P = P[np.hypot(P[:, 0], P[:, 1]) < D['RAYON_DE_COUPE_MAX']]
        centre = centre_de(P)
        return ([O + p[0] * u + p[1] * v for p in anneau(P, centre, dirs, aisances, D['DEGAGEMENT_MIN'])],
                O + centre[0] * u + centre[1] * v, [Oc + p[0] * u + p[1] * v for p in P])

    peau = anneau_de_bras(D['COUPE_DES_POIDS'], [0.0] * len(dirs))[2]
    return axe, anneau_de_bras, np.mean([emprunter(q, porteur)[0] for q in peau], axis=0)


def fermer_a_l_epaule(D, nappe, liste, porteur):
    """Ferme à l'épaule la manche d'anneaux `liste` (sommets, centre) : un cône de son premier anneau à un fond dans le
    corps, rentré de `CREUX_DE_LA_RACINE` dans l'axe de la manche, aux poids de `porteur` sous le centre de l'anneau."""
    (racine, centre), (_, suivant) = liste[:2]
    fond = nappe.poser([np.mean([nappe.sommets[i] for i in racine], axis=0)
                        + D['CREUX_DE_LA_RACINE'] * unitaire(centre - suivant)], [emprunter(centre, porteur)[0]])[0]
    for i in range(len(racine)):
        nappe.triangle(racine[i], racine[(i + 1) % len(racine)], fond, centre + (centre - suivant))


def manches(D, b, robe, porteurs):
    """Chaque manche de `robe`, anneaux perpendiculaires à `upperarm` (`MANCHE`), fermée à l'épaule par un cône dans le
    corps."""
    s = D['SEGMENTS_MANCHE']
    phis = [360.0 * i / s for i in range(s)]
    dirs_m = [np.array([math.cos(math.radians(t)), math.sin(math.radians(t))]) for t in phis]
    lobe = [max(0.0, math.cos(math.radians(t - D['ANGLE_DU_PAN']))) ** 2 for t in phis]
    radial, axial = math.sin(math.radians(D['INCLINAISON_DU_PAN'])), math.cos(math.radians(D['INCLINAISON_DU_PAN']))
    for c, signe in (('g', 1.0), ('d', -1.0)):
        axe, anneau_de_bras, poids_du_bras = bras_de(D, b, c, signe, dirs_m, porteurs[c])
        liste = []
        for f, e, pend in D['MANCHE']:
            pts, centre, _ = anneau_de_bras(f, [e + pend * radial * l for l in lobe])
            pts = [p + pend * axial * l * axe for p, l in zip(pts, lobe)]
            raccord = f < D['RACCORD_EPAULE']
            poids = [emprunter(p, porteurs[c])[0] for p in pts] if raccord else [poids_du_bras] * s
            liste.append((robe.poser(pts, poids, fixes=not raccord), centre))
        if 'LAMBEAUX_MANCHE' in D:
            # Le bord en lambeaux : chaque colonne du dernier anneau recule le long de la manche de la profondeur que lui
            # laisse `lambeaux`, tirage propre à chaque côté.
            L = dict(D['LAMBEAUX_MANCHE'], graine=D['LAMBEAUX_MANCHE']['graine'] + c)
            for i, j, d in zip(liste[-2][0], liste[-1][0], lambeaux(L, s)):
                pente = robe.sommets[j] - robe.sommets[i]
                robe.sommets[j] = robe.sommets[j] - (L['profondeur'] - d) * unitaire(pente)
        for (A, ca), (B, cb) in zip(liste, liste[1:]):
            robe.bande(A, B, (ca + cb) / 2)
        fermer_a_l_epaule(D, robe, liste, porteurs[c])
