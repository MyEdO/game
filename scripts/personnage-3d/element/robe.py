"""Kit des robes (#3743, #3867, #4351) : une robe longue skinnée sur la base, de chaîne `jupe`, d'après le `donnees.py` de
la pièce (aucun nombre ici). Un dossier de robe ne porte que son `donnees.py` et `from robe import construire`.

Une double nappe `robe`, d'un seul pan, fermée :
- le corsage, anneaux horizontaux de `CORSAGE` (ancre de `ancres_du_corps`, décalage, aisance) coupés dans le tronc et le
  cou ;
- la jupe, rangées de `RANGEES_JUPE` jusqu'à `OURLET_ROBE`, posée au jeu sur le filet `jupe` de la base au repos, jamais à
  moins du dégagement des jambes, l'ourlet en lambeaux si `LAMBEAUX_ROBE` ;
- chaque manche de `MANCHE` (vide pour une jupe), anneaux perpendiculaires à `upperarm`, un pan en lobe sous le bras,
  fermée à l'épaule par un cône dans le corps, le bord en lambeaux si `LAMBEAUX_MANCHE`.
Poids : le corsage et le raccord des manches à l'épaule empruntent au corps, sommet par sommet ; au-delà de
`RACCORD_EPAULE`, la manche suit d'un bloc les os de la peau à `COUPE_DES_POIDS`, sans lissage ; passé le coude, un
anneau qui porte un pan suit l'os du tube de la manche de la base, et son pan, ses brins (`tissu.Manche`) ; la jupe
prend les os des deux brins voisins du filet (`tissu.Filet`), jamais les cuisses.
Silhouettes et clés `gabarit_*` transférées. Chaque emplacement de `EMPLACEMENTS_DEPLACES` passe de la peau de la base
à la surface de la robe (`Base.offrir_sur`).

Un vêtement d'une autre coupe compose les mêmes pièces dans son `modele.py` : `Nappe`, `ancres_du_corps`, `sur_le_tronc`,
`anneaux`, `rangee`, `bras_de`, `bloc_du_bras`, `dents_de_manche`, `fermer_a_l_epaule`, `manches`, `piece_de`.
"""
import math

import numpy as np
from mathutils import Vector

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


def tour(n):
    """Les `n` angles réguliers d'un tour, en degrés."""
    return [360.0 * i / n for i in range(n)]


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
    surface = porteur_de(np.array(robe.sommets), np.array(robe.triangles), np.array(robe.poids))
    touche = surface['arbre'].ray_cast(point - Vector(d), Vector(d))[0]
    if touche is None:
        raise ValueError(f'emplacement {nom} : aucune robe sous {tuple(point - Vector(d))}')
    b.offrir_sur(nom, np.array(touche), surface)


def ancres_du_corps(b):
    """Les hauteurs où s'ancrent les anneaux d'un corps de vêtement : `bas` (bas du torse), `aisselle` (bas du haut des
    bras), `cou` (bas du cou)."""
    return {'bas': float(b.corps('torse')[0][:, 2].min()),
            'aisselle': min(float(b.corps(z)[0][:, 2].min()) for z in BRAS['g'][:1] + BRAS['d'][:1]),
            'cou': float(b.corps('cou')[0][:, 2].min())}


def sur_le_tronc(D, b, porteur, zones, z):
    """La coupe horizontale des zones `zones` à la hauteur `z` : `poser(nappe, thetas, aisance)` pose sur `nappe` un
    sommet par angle de `thetas` (`tissu.anneau`, au plus près : sur l'enveloppe de la coupe plus la plus grande de
    l'aisance et de `DEGAGEMENT_MIN`), aux poids de `porteur` sous lui, et rend ses sommets et son centre ;
    `rayon(theta)`, le rayon de l'enveloppe."""
    P = b.coupe(zones, (0.0, 0.0, z), (0.0, 0.0, 1.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0), minimum=1)
    centre, H = centre_de(P), enveloppe_convexe(P)

    def rayon(theta):
        return rayon_a_l_enveloppe(H, centre, direction(theta))

    def poser(nappe, thetas, aisance):
        pts = [np.append(p, z) for p in anneau(P, centre, [direction(t) for t in thetas], [aisance] * len(thetas),
                                               D['DEGAGEMENT_MIN'], au_plus_pres=True)]
        return nappe.poser(pts, [emprunter(p, porteur)[0] for p in pts]), np.array([centre[0], centre[1], z])
    return poser, rayon


def anneaux(D, b, nappe, porteur, liste, m, au_cou=COU):
    """Les anneaux horizontaux fermés de `liste` (ancre de `ancres_du_corps`, décalage, aisance), `m` colonnes, coupés
    dans le tronc et le cou, dans `au_cou` au-dessus du bas du cou, reliés en bandes : le corps fermé d'une chemise,
    d'un pourpoint ou d'une robe. Au-dessus du bas du cou, la coupe du tronc passe encore sur le trapèze, jusqu'aux
    épaules : le col droit d'une chemise ne s'y coupe que dans le cou ; une robe y garde le tronc (`TRONC + COU`), son
    col couvre le trapèze des épaules au cou. Rend les anneaux (sommets, centre)."""
    ancres = ancres_du_corps(b)
    thetas = tour(m)
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
    thetas = tour(m)
    corsage = anneaux(D, b, robe, porteurs['T'], D['CORSAGE'], m, TRONC + COU)

    # Jupe : sous la charnière, sur le filet `jupe` de la base.
    zones_jupe = TRONC + JAMBES
    filet = b.filet('jupe')
    z_haut = D['RANGEES_JUPE'][0]
    if filet.part(z_haut) < 1:
        raise ValueError(f'robe : la première rangée de la jupe ({z_haut} m) monte au-dessus de la charnière du filet `jupe`')
    jeu = D['DEGAGEMENT_MIN'] + D['EPAISSEUR']

    def rayon(z, theta):
        """Rayon de la robe à la hauteur `z`, direction `theta`."""
        Pz = b.coupe(zones_jupe, (0.0, 0.0, max(z, D['OURLET_ROBE'])), (0.0, 0.0, 1.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0))
        appui = float(np.linalg.norm(anneau(Pz, filet.axe, [direction(theta)], [0.0], 0.0, au_plus_pres=True)[0] - filet.axe))
        return max(filet.point(z, theta)[0] + jeu, appui + jeu)

    jupe = []
    for z in D['RANGEES_JUPE'] + [D['OURLET_ROBE']]:
        zs = hauteurs(z, m, D['OURLET_ROBE'], D.get('LAMBEAUX_ROBE'))
        jupe.append(rangee(robe, filet, zs, thetas, [rayon(z_, t) for z_, t in zip(zs, thetas)]))
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


def rangee(nappe, filet, zs, thetas, rayons):
    """Une rangée de jupe posée sur `nappe` : un sommet par (hauteur, angle, rayon) autour de l'axe du filet `filet`, à
    ses poids, sans lissage. Rend ses sommets et son centre."""
    pts = [np.append(filet.axe + r * direction(t), z) for z, t, r in zip(zs, thetas, rayons)]
    return (nappe.poser(pts, [filet.poids(z, t) for z, t in zip(zs, thetas)], fixes=True),
            np.array([filet.axe[0], filet.axe[1], float(np.mean(zs))]))


def bras_de(D, b, c, signe, phis):
    """Le bras `c` sous une manche d'anneaux perpendiculaires à `upperarm`, un sommet par azimut de `phis` (degrés) dans
    leur plan : son axe ; `anneau_de_bras(f, aisances)`, l'anneau à la fraction `f` de l'os (au-delà de 1 passé le
    coude), ses points à leurs aisances, son centre et la peau de la coupe, prise à `COUPE_MIN` en deçà et sans ce qui
    passe `RAYON_DE_COUPE_MAX`."""
    o0, o1 = (np.array(b.tete(o)) for o in OS_BRAS[c])
    axe = unitaire(o1 - o0)
    u, v = repere_de_plan(axe, (0.0, 0.0, 1.0), signe)
    dirs = [np.array([math.cos(math.radians(t)), math.sin(math.radians(t))]) for t in phis]

    def anneau_de_bras(f, aisances):
        O = o0 + f * (o1 - o0)
        Oc = o0 + max(f, D['COUPE_MIN']) * (o1 - o0)
        P = b.coupe(BRAS[c], Oc, axe, u, v)
        P = P[np.hypot(P[:, 0], P[:, 1]) < D['RAYON_DE_COUPE_MAX']]
        centre = centre_de(P)
        return ([O + p[0] * u + p[1] * v for p in anneau(P, centre, dirs, aisances, D['DEGAGEMENT_MIN'])],
                O + centre[0] * u + centre[1] * v, [Oc + p[0] * u + p[1] * v for p in P])

    return axe, anneau_de_bras


def bloc_du_bras(D, anneau_de_bras, n, porteur):
    """Les poids d'un bloc de manche : la moyenne de ceux de `porteur` sous la peau de l'anneau à `COUPE_DES_POIDS`,
    d'un anneau de `n` sommets."""
    return np.mean([emprunter(q, porteur)[0] for q in anneau_de_bras(D['COUPE_DES_POIDS'], [0.0] * n)[2]], axis=0)


def dents_de_manche(D, c, n):
    """La profondeur des `n` colonnes du bord en lambeaux (`LAMBEAUX_MANCHE`) de la manche du bras `c`, tirage propre à
    chaque côté."""
    return lambeaux(dict(D['LAMBEAUX_MANCHE'], graine=D['LAMBEAUX_MANCHE']['graine'] + c), n)


def fermer_a_l_epaule(nappe, liste, porteur):
    """Ferme à l'épaule la manche d'anneaux `liste` (sommets, centre) : un cône de son premier anneau à un fond en son
    milieu, dans le corps, aux poids de `porteur` sous le centre de l'anneau."""
    (racine, centre), (_, suivant) = liste[:2]
    fond = nappe.poser([np.mean([nappe.sommets[i] for i in racine], axis=0)], [emprunter(centre, porteur)[0]])[0]
    for i in range(len(racine)):
        nappe.triangle(racine[i], racine[(i + 1) % len(racine)], fond, centre + (centre - suivant))


def manches(D, b, robe, porteurs):
    """Chaque manche de `robe`, anneaux perpendiculaires à `upperarm` (`MANCHE`), fermée à l'épaule par un cône dans le
    corps. Un pan pend en lobe sous le bras tendu : jusqu'au coude, il suit le bras ; au-delà, il pend à la manche de la
    base (`tissu.Manche.pendre`), dont l'anneau suit l'os du tube."""
    s = D['SEGMENTS_MANCHE']
    phis = tour(s)
    lobe = [max(0.0, -math.cos(math.radians(t))) ** 2 for t in phis]
    for c, signe in (('g', 1.0), ('d', -1.0)):
        _, anneau_de_bras = bras_de(D, b, c, signe, phis)
        poids_du_bras = None
        manche = b.manche(c) if any(f > 1 and pend for f, _, pend in D['MANCHE']) else None
        liste = []
        for f, e, pend in D['MANCHE']:
            pendu = f > 1 and pend > 0
            pts, centre, _ = anneau_de_bras(f, [e + (0.0 if pendu else pend * l) for l in lobe])
            raccord = f < D['RACCORD_EPAULE']
            if pendu:
                pts, poids = manche.pendre(pts, [pend * l for l in lobe])
            elif raccord:
                poids = [emprunter(p, porteurs[c])[0] for p in pts]
            else:
                if poids_du_bras is None:
                    poids_du_bras = bloc_du_bras(D, anneau_de_bras, s, porteurs[c])
                poids = [poids_du_bras] * s
            liste.append((robe.poser(pts, poids, fixes=not raccord), centre))
        if 'LAMBEAUX_MANCHE' in D:
            # Le bord en lambeaux : chaque colonne du dernier anneau recule le long de la manche de la profondeur que lui
            # laissent ses dents.
            for i, j, d in zip(liste[-2][0], liste[-1][0], dents_de_manche(D, c, s)):
                pente = robe.sommets[j] - robe.sommets[i]
                robe.sommets[j] = robe.sommets[j] - (D['LAMBEAUX_MANCHE']['profondeur'] - d) * unitaire(pente)
        for (A, ca), (B, cb) in zip(liste, liste[1:]):
            robe.bande(A, B, (ca + cb) / 2)
        fermer_a_l_epaule(robe, liste, porteurs[c])
