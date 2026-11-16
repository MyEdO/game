"""Kit des robes (#3743, #3867) : une robe longue skinnée sur la base, de chaîne `jupe`, d'après le `donnees.py` de la pièce
(aucun nombre ici). Un dossier de robe ne porte que son `donnees.py` et `from robe import construire`.

Jusqu'à trois nappes doubles jointes en une pièce :
- `robe` (robe de dessus) : le corsage, anneaux horizontaux coupés dans les zones du tronc et du cou, ouverts devant
  là où `CORSAGE` leur donne une demi-ouverture, fermés au-dessus jusqu'au cou ; la jupe, rangées ouvertes devant en V
  sous la ceinture (`OUVERTURE_TAILLE`, `OUVERTURE_OURLET`, fermées à 0), posée au jeu sur le filet `jupe` de la base au
  repos, jamais à moins du dégagement des jambes, l'ourlet en lambeaux si `LAMBEAUX_ROBE`, à la hauteur de chaque
  direction si `OURLET_PAR_AZIMUT` (`tissu.selon` ; `OURLET_ROBE` reste sa hauteur nominale, celle du devant, et les
  rangées s'étirent de la première à l'ourlet) ; chaque manche de `MANCHE` (vide pour une jupe), anneaux
  perpendiculaires à `upperarm`, ajustée jusqu'au coude puis en cloche au-delà, un pan incliné sur l'axe du bras (en lobe
  cos^`GALBE_DU_PAN`, 2 à défaut : plus bas, le pan s'élargit), fermée
  à l'épaule par un cône dans le corps, le bord en lambeaux si `LAMBEAUX_MANCHE` ;
- `dessous` (robe de dessous, si `MATERIAUX` la nomme) : la jupe fermée, sous la robe de dessus, vue par l'ouverture et
  sous son ourlet, sur le même filet, l'ourlet en lambeaux (`LAMBEAUX_DESSOUS`) ; sous un corsage ouvert dès la taille,
  elle monte au ras du tronc jusqu'à son premier anneau ;
- `poitrine` (si le corsage s'ouvre) : ce que montre l'ouverture du corsage, au ras du torse, sous ses bords : la peau
  d'une encolure en V, ou la robe de dessous, selon la matière que `MATERIAUX` lui donne.
Matières : `GALON` (une largeur, en mètres) borde la robe de dessus du matériau `galon`, sur l'endroit : la première et
la dernière colonne d'un anneau ouvert, larges du galon, la bande de l'ourlet, sous une rangée de plus, et la dernière
bande de chaque manche ; `doublure`, si `MATERIAUX` la nomme, est le matériau de l'envers de la robe de dessus.
Poids : le corsage, la poitrine et le raccord des manches à l'épaule empruntent au corps, sommet par sommet ; au-delà,
la manche entière suit `upperarm` d'un bloc, sans lissage, et l'avant-bras plié sort de la cloche ; les jupes passent, sous
les racines du filet, du bassin aux os de ses deux brins voisins (`tissu.Filet`), jamais aux cuisses.
Silhouettes et clés `gabarit_*` transférées. Chaque emplacement de `EMPLACEMENTS_DEPLACES` passe de la peau de la base
à la surface de la robe (`Base.offrir`).
"""
import math

import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

from anatomie import AXES_DU_PERSONNAGE, EMPLACEMENTS
from tissu import Maillage, anneau, centre_de, direction, emprunter, joindre, lambeaux, lisser, porteur_de, repere_de_plan, selon, voisinage

TRONC, COU = ['hanches', 'torse'], ['cou']
BRAS = {c: [f'bras_haut_{c}', f'avant_bras_{c}'] for c in 'gd'}
OS_BRAS = {'g': ('upperarm_l', 'lowerarm_l'), 'd': ('upperarm_r', 'lowerarm_r')}
JAMBES = [f'{z}_{c}' for z in ('cuisse', 'genou', 'mollet') for c in 'gd']
PORTEUSES = TRONC + COU + BRAS['g'] + BRAS['d'] + JAMBES


def unitaire(x):
    return x / np.linalg.norm(x)


def colonnes_ouvertes(o, m, g=0.0):
    """Les angles de `m` colonnes autour du corps : un anneau fermé si `o` est nul, sinon ouvert devant de la demi-ouverture
    `o` (degrés), `m + 1` angles de `o` à `360 - o` ; `g` (degrés) : la largeur de la première et de la dernière colonne,
    celles du galon qui borde l'ouverture."""
    if o == 0:
        return [360.0 * i / m for i in range(m)]
    if g == 0:
        return [o + (360 - 2 * o) * k / m for k in range(m + 1)]
    return [o] + [o + g + (360 - 2 * (o + g)) * k / (m - 2) for k in range(m - 1)] + [360 - o]


def relier(nappe, A, B, m, ref, galons=()):
    """Les `m` quads entre deux anneaux de `m` colonnes, chacun fermé (`m` sommets, ou les `m + 1` d'un V et ceux qui
    comblent son haut) ou ouvert (`m + 1`) ; ceux des colonnes `galons` sont du galon."""
    for i in range(m):
        nappe.matiere = 'galon' if i in galons else None
        nappe.quad(A[i], A[(i + 1) % len(A)], B[(i + 1) % len(B)], B[i], ref)
    nappe.matiere = None


class Nappe(Maillage):
    """Un `Maillage` qui garde, par sommet, ses poids bruts sur les os de la base, et par triangle la matière `matiere`
    en cours à sa pose (`None` : celle de la nappe)."""

    def __init__(self):
        super().__init__()
        self.poids, self.fixes, self.matieres, self.matiere = [], [], [], None

    def triangle(self, a, b, c, ref):
        super().triangle(a, b, c, ref)
        self.matieres.append(self.matiere)

    def quad(self, a, b, c, d, ref):
        super().quad(a, b, c, d, ref)
        self.matieres.extend([self.matiere] * 2)

    def poser(self, points, poids, fixes=False):
        """`fixes` : poids gardés tels quels, sans lissage (jupe : deux nappes aux mêmes poids, sommet pour sommet)."""
        self.poids.extend(poids)
        self.fixes.extend([fixes] * len(points))
        return self.ajouter(points, None)


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
    p = np.array(touche)
    b.offrir(nom, emprunter(p, porteur_de(X, T, np.array(robe.poids)))[0], p, np.array(AXES_DU_PERSONNAGE).T)


def piece_de(D, b, M, materiaux, surface):
    """La double nappe `surface` de `M` ; l'endroit de chaque triangle posé dans une matière en prend le matériau, et
    l'envers de la robe de dessus celui de `doublure`, si `MATERIAUX` la nomme."""
    X, orientes, normales = M.orienter()
    W0 = np.array(M.poids)
    voisins = voisinage(orientes, len(X))
    W = np.where(np.array(M.fixes)[:, None], W0, lisser(W0, voisins, D['LISSAGE_POIDS']))
    piece = b.nappe(surface, X, normales, W, orientes, materiaux[surface], D['EPAISSEUR'])
    envers = 'doublure' if surface == 'robe' and 'doublure' in materiaux else None
    rangs = {}

    def rang(nom):
        if nom not in rangs:
            piece.data.materials.append(materiaux[nom])
            rangs[nom] = len(piece.data.materials) - 1
        return rangs[nom]

    for k, endroit in enumerate(M.matieres):     # `tissu.double_nappe` : par triangle, la face d'endroit puis celle d'envers
        if endroit:
            piece.data.polygons[2 * k].material_index = rang(endroit)
        if envers:
            piece.data.polygons[2 * k + 1].material_index = rang(envers)
    return piece


def construire(D, materiaux, b):
    b.exiger(PORTEUSES)
    porteurs = {'T': b.porteur(TRONC + COU), 'g': b.porteur(['torse'] + BRAS['g']),
                'd': b.porteur(['torse'] + BRAS['d'])}
    robe, dessous, poitrine = Nappe(), Nappe(), Nappe()
    avec_dessous = 'dessous' in materiaux
    ourlet_bas = D['OURLET_DESSOUS'] if avec_dessous else D['OURLET_ROBE']

    # Corsage.
    ancres = {'bas': float(b.corps('torse')[0][:, 2].min()),
              'aisselle': min(float(b.corps(z)[0][:, 2].min()) for z in ('bras_haut_g', 'bras_haut_d')),
              'cou': float(b.corps('cou')[0][:, 2].min())}
    m = D['SEGMENTS_CORPS']
    galon = D.get('GALON', 0.0)
    bords = (0, m - 1) if galon else ()
    corsage, encolure, thetas = [], [], []
    ouvertures = [o for _, _, _, o in D['CORSAGE']]
    for k, (ancre, dz, e, o) in enumerate(D['CORSAGE']):
        z = ancres[ancre] + dz
        P = b.coupe(TRONC + COU, (0.0, 0.0, z), (0.0, 0.0, 1.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0), minimum=1)
        centre = centre_de(P)

        def sur_le_tronc(nappe_, thetas_, aisance, P=P, centre=centre, z=z):
            pts = [np.array([p[0], p[1], z]) for p in anneau(P, centre, [direction(t) for t in thetas_],
                                                              [aisance] * len(thetas_), D['DEGAGEMENT_MIN'], au_plus_pres=True)]
            return nappe_.poser(pts, [emprunter(p, porteurs['T'])[0] for p in pts]), np.array([centre[0], centre[1], z])
        # Un anneau fermé au-dessus d'un V garde les colonnes du V et comble son haut ; ceux qui le suivent les gardent :
        # aux colonnes régulières, l'anneau du col tournait par rapport au V et la bande qui les joint se repliait
        # au-dessus de l'épaule droite (garde `enroulement`, robe-torse).
        if o > 0 or k == 0 or (ouvertures[k - 1] == 0 and len(thetas) == m):
            lisiere = anneau(P, centre, [direction(o)], [e], D['DEGAGEMENT_MIN'], au_plus_pres=True)[0] if galon and o > 0 else None
            thetas = colonnes_ouvertes(o, m, 0.0 if lisiere is None else math.degrees(galon / np.linalg.norm(lisiere - centre)))
        elif ouvertures[k - 1] > 0:
            haut_du_v = ouvertures[k - 1]
            comble = max(1, round(2 * haut_du_v * m / 360))
            thetas = thetas + [360 - haut_du_v + 2 * haut_du_v * j / comble for j in range(1, comble)]
        corsage.append(sur_le_tronc(robe, thetas, e))
        if k == 0:
            taille = sur_le_tronc
        if max(ouvertures[max(k - 1, 0):k + 2]) > 0:
            bord = o + D['RECOUVREMENT_POITRINE']
            g = D['COLONNES_POITRINE']
            encolure.append(sur_le_tronc(poitrine, [-bord + 2 * bord * i / g for i in range(g + 1)], 0.0))
    for k, ((A, ca), (B, cb)) in enumerate(zip(corsage, corsage[1:])):
        if ouvertures[k] == ouvertures[k + 1] == 0 and len(A) == len(B):
            robe.bande(A, B, (ca + cb) / 2)
        else:
            relier(robe, A, B, m, (ca + cb) / 2, bords)
    for (A, ca), (B, cb) in zip(encolure, encolure[1:]):
        relier(poitrine, A, B, D['COLONNES_POITRINE'], (ca + cb) / 2)

    # Jupe : sous la charnière, sur le filet `jupe` de la base.
    zones_jupe = TRONC + JAMBES
    filet = b.filet('jupe')
    centre_j = filet.axe
    z_haut = D['RANGEES_JUPE'][0]
    if filet.part(z_haut) < 1:
        raise ValueError(f'robe : la première rangée de la jupe ({z_haut} m) monte au-dessus de la charnière du filet `jupe`')

    def rayon(z, theta):
        """Rayon de la robe de dessus à la hauteur `z`, direction `theta`."""
        Pz = b.coupe(zones_jupe, (0.0, 0.0, max(z, ourlet_bas)), (0.0, 0.0, 1.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0))
        appui = float(np.linalg.norm(anneau(Pz, centre_j, [direction(theta)], [0.0], 0.0, au_plus_pres=True)[0] - centre_j))
        jeu = D['DEGAGEMENT_MIN'] + (D['ECART_DESSOUS'] if avec_dessous else 0.0) + D['EPAISSEUR']
        return max(filet.point(z, theta)[0] + jeu, appui + jeu)

    ourlets = D.get('OURLET_PAR_AZIMUT')

    def niveaux(zs, thetas_):
        """Les hauteurs réelles des hauteurs nominales `zs` aux angles `thetas_` : sous `OURLET_PAR_AZIMUT`, la robe de
        dessus s'étire de sa première rangée à l'ourlet de chaque direction ; sous son ourlet nominal, rien ne bouge."""
        if not ourlets:
            return zs
        return [z if z < D['OURLET_ROBE'] else
                z_haut - (z_haut - z) * (z_haut - selon(ourlets, t)) / (z_haut - D['OURLET_ROBE']) for z, t in zip(zs, thetas_)]

    def rangee(nappe_, zs, thetas_, ecart):
        """Une rangée de jupe : un sommet par (hauteur, angle)."""
        zs = niveaux(zs, thetas_)
        pts = [np.array([centre_j[0], centre_j[1], z]) + np.append((rayon(z, t) - ecart) * direction(t), 0.0)
               for z, t in zip(zs, thetas_)]
        return (nappe_.poser(pts, [filet.poids(z, t) for z, t in zip(zs, thetas_)], fixes=True),
                np.array([centre_j[0], centre_j[1], float(np.mean(zs))]))

    def colonnes(z):
        """Les angles des colonnes de la robe de dessus à la hauteur `z` (à son ourlet au-dessous), de l'ouverture gauche à
        l'ouverture droite."""
        zr = max(z, D['OURLET_ROBE'])
        f = (z_haut - zr) / (z_haut - D['OURLET_ROBE'])
        o = D['OUVERTURE_TAILLE'] + (D['OUVERTURE_OURLET'] - D['OUVERTURE_TAILLE']) * f
        return colonnes_ouvertes(o, m, math.degrees(galon / rayon(niveaux([zr], [o])[0], o)) if galon and o > 0 else 0.0)

    # Sous le galon, une rangée court à sa largeur au-dessus de l'ourlet : la bande de l'ourlet est du galon.
    rangees = D['RANGEES_JUPE'] + ([D['OURLET_ROBE'] + galon] if galon else []) + [D['OURLET_ROBE']]
    jupe = [rangee(robe, hauteurs(z, len(colonnes(z)), D['OURLET_ROBE'], D.get('LAMBEAUX_ROBE')), colonnes(z), 0.0)
            for z in rangees]
    for k, ((A, ca), (B, cb)) in enumerate(zip(corsage[:1] + jupe, jupe)):
        relier(robe, A, B, m, (ca + cb) / 2, range(m) if galon and k == len(jupe) - 1 else bords)

    # Robe de dessous : un anneau fermé par rangée, de la première rangée de la jupe à son ourlet, sous la robe de dessus
    # aux angles de ses colonnes à la même hauteur, `COLONNES_OUVERTURE` intervalles dans l'ouverture ; sous l'ourlet de la
    # robe, aux angles de l'ourlet.
    # Son ourlet est en lambeaux : chaque colonne remonte de la profondeur que lui laisse `lambeaux`.
    # Sous un corsage ouvert à la taille, elle monte au ras du tronc jusqu'à son premier anneau, où la poitrine la relaie.
    if avec_dessous:
        G = D['COLONNES_OUVERTURE']
        jupe_dessous = []
        for z in rangees + D['RANGEES_DESSOUS'] + [D['OURLET_DESSOUS']]:
            c = colonnes(z)
            thetas_d = c + [360 - c[0] + 2 * c[0] * k / G for k in range(1, G)]
            if ouvertures[0] > 0 and not jupe_dessous:
                jupe_dessous.append(taille(dessous, thetas_d, 0.0))
            zs = hauteurs(z, len(thetas_d), D['OURLET_DESSOUS'], D['LAMBEAUX_DESSOUS'])
            jupe_dessous.append(rangee(dessous, zs, thetas_d, D['ECART_DESSOUS']))
        for (A, ca), (B, cb) in zip(jupe_dessous, jupe_dessous[1:]):
            dessous.bande(A, B, (ca + cb) / 2)

    # Manches, s'il en est : une jupe n'en a pas.
    if D['MANCHE']:
        manches(D, b, robe, porteurs)
    for nom in D.get('EMPLACEMENTS_DEPLACES', []):
        deplacer(b, robe, nom)
    piece = joindre([piece_de(D, b, nappe_, materiaux, nom)
                     for nom, nappe_ in (('robe', robe), ('dessous', dessous), ('poitrine', poitrine)) if nappe_.sommets])
    b.transferer(piece, PORTEUSES, D['BORNES_DES_CLES'])
    return piece


def manches(D, b, robe, porteurs):
    """Chaque manche de `robe`, anneaux perpendiculaires à `upperarm` (`MANCHE`), fermée à l'épaule par un cône dans le
    corps."""
    s = D['SEGMENTS_MANCHE']
    phis = [360.0 * i / s for i in range(s)]
    dirs_m = [np.array([math.cos(math.radians(t)), math.sin(math.radians(t))]) for t in phis]
    lobe = [max(0.0, math.cos(math.radians(t - D['ANGLE_DU_PAN']))) ** D.get('GALBE_DU_PAN', 2) for t in phis]
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
        if 'LAMBEAUX_MANCHE' in D:
            # Le bord en lambeaux : chaque colonne du dernier anneau recule le long de la manche de la profondeur que lui
            # laisse `lambeaux`, tirage propre à chaque côté.
            L = dict(D['LAMBEAUX_MANCHE'], graine=D['LAMBEAUX_MANCHE']['graine'] + c)
            for i, j, d in zip(liste[-2][0], liste[-1][0], lambeaux(L, s)):
                pente = robe.sommets[j] - robe.sommets[i]
                robe.sommets[j] = robe.sommets[j] - (L['profondeur'] - d) * unitaire(pente)
        for k, ((A, ca), (B, cb)) in enumerate(zip(liste, liste[1:])):
            robe.matiere = 'galon' if D.get('GALON') and k == len(liste) - 2 else None
            robe.bande(A, B, (ca + cb) / 2)
        robe.matiere = None
        R, cR = liste[0]
        rentre = unitaire(cR - liste[1][1])
        fond = robe.poser([np.mean([robe.sommets[i] for i in R], axis=0) + D['CREUX_DE_LA_RACINE'] * rentre],
                          [emprunter(cR, porteurs[c])[0]])[0]
        for i in range(s):
            robe.triangle(R[i], R[(i + 1) % s], fond, cR + (cR - liste[1][1]))
