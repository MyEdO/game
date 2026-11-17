"""Géométrie de `humanoide--vetement--robe` (kit des robes `element/robe.py`, `element/tissu.py`), d'après `donnees.py`
(aucun nombre ici) : la robe du Sorcier, une robe de dessus galonnée, ouverte du col à l'ourlet sur une robe de dessous,
aux manches en cloche.

Trois nappes jointes en une pièce :
- `robe`, nappe simple : le corsage, anneaux horizontaux sur l'enveloppe des coupes du tronc, ouverts devant, fermés au
  col ; la jupe, rangées ouvertes devant qui s'évasent de la taille au filet `jupe` de la base, sur lequel elles reposent
  au jeu, plissées (une colonne sur deux en creux sous le filet, de plus en plus bas), l'ourlet à la hauteur de chaque
  direction, en dents ; la première et la dernière colonne et la bande de l'ourlet sont du galon ;
- `dessous`, nappe simple : la robe de dessous, jupe fermée sous la robe de dessus, aux mêmes colonnes et aux mêmes plis,
  l'ourlet plus bas, en dents profondes ; elle monte au ras du tronc jusqu'à la taille, puis en bande sous l'ouverture
  du corsage ;
- `manches`, double nappe, l'envers en doublure : par bras, anneaux perpendiculaires au bras, de l'épaule à
  l'avant-bras ; le dessus suit le bras, le dessous pend en poche sous l'avant-bras, creusée de godets depuis le coude,
  ouverte en entonnoir, le bord en dents galonné ; fermée à l'épaule par un cône dans le corps.
Poids : le corsage et la manche jusqu'au coude empruntent au corps, sommet par sommet, lissés ; au-delà, la manche suit
l'avant-bras d'un bloc ; les jupes prennent les os des deux brins voisins du filet (`tissu.Filet`). Silhouettes et clés
`gabarit_*` transférées.
"""
import math

import numpy as np
from maille import tirage
from robe import BRAS, COU, JAMBES, PORTEUSES, TRONC, Nappe, ancres_du_corps, bras_de, fermer_a_l_epaule, sur_le_tronc
from tissu import direction, emprunter, enveloppe_convexe, fondu, joindre, lambeaux, rayon_a_l_enveloppe, selon


class Toile(Nappe):
    """Une `Nappe` qui garde, par triangle, la matière `matiere` en cours à sa pose (`None` : celle de la nappe)."""

    def __init__(self):
        super().__init__()
        self.matieres, self.matiere = [], None

    def triangle(self, a, b, c, ref):
        super().triangle(a, b, c, ref)
        self.matieres.append(self.matiere)

    def quad(self, a, b, c, d, ref):
        super().quad(a, b, c, d, ref)
        self.matieres.extend([self.matiere] * 2)

    def relier(self, A, B, ref, colonnes, galons=()):
        """Les quads des `colonnes` premières colonnes entre deux anneaux ; ceux des colonnes `galons` sont du galon."""
        for i in range(colonnes):
            self.matiere = 'galon' if i in galons else None
            self.quad(A[i], A[(i + 1) % len(A)], B[(i + 1) % len(B)], B[i], ref)
        self.matiere = None


def nappe_simple(b, D, toile, nom, materiaux):
    """La nappe simple `nom` de `toile`, lisse hors des arêtes de plus d'`ANGLE_VIF` (le fond et la crête des plis) ;
    chaque triangle posé dans une matière en prend le matériau."""
    X, orientes, _, W = toile.lisses(D['LISSAGE_POIDS'])
    return b.nappe_simple(nom, [tuple(x) for x in X], [list(t) for t in orientes], W, materiaux[nom],
                          [materiaux[matiere] if matiere else None for matiere in toile.matieres], D['ANGLE_VIF'])


def construire(D, materiaux, b):
    b.exiger(PORTEUSES)
    tronc = b.porteur(TRONC + COU)
    robe, dessous = Toile(), Toile()
    m, G = D['COLONNES'], D['COLONNES_OUVERTURE']
    galon = D['GALON']
    bords = (0, m - 1)

    def colonnes(o, largeur_du_galon):
        """Les `m + 1` angles d'un anneau ouvert devant de la demi-ouverture `o` (degrés), la première et la dernière
        colonne larges de `largeur_du_galon` (degrés)."""
        g = largeur_du_galon
        return [o] + [o + g + (360 - 2 * (o + g)) * k / (m - 2) for k in range(m - 1)] + [360 - o]

    def dans_l_ouverture(o):
        """Les angles des `G - 1` colonnes de la robe de dessous dans l'ouverture, de la droite à la gauche du devant."""
        return [360 - o + 2 * o * k / G for k in range(1, G)]

    # Corsage : anneaux sur l'enveloppe de la coupe du tronc.
    ancres = ancres_du_corps(b)
    corsage, bande, thetas = [], [], None
    for ancre, dz, aisance, o in D['CORSAGE']:
        poser, rayon = sur_le_tronc(D, b, tronc, TRONC + COU, ancres[ancre] + dz)
        if o > 0:
            thetas = colonnes(o, math.degrees(galon / (rayon(o) + aisance)))
            g = D['COLONNES_POITRINE']
            cote = o + D['RECOUVREMENT_POITRINE']
            bande.append(poser(dessous, [-cote + 2 * cote * i / g for i in range(g + 1)], 0.0))
        elif len(thetas) == m + 1:
            thetas = thetas + dans_l_ouverture(360 - thetas[-1])      # le col, fermé, garde les colonnes de l'ouverture
        corsage.append((poser(robe, thetas, aisance), o))
        if not dz and ancre == 'bas':
            taille, angles_de_la_taille = poser, thetas
    for ((A, ca), oa), ((B, cb), ob) in zip(corsage, corsage[1:]):
        if oa > 0:
            robe.relier(A, B, (ca + cb) / 2, m, bords)
        else:
            robe.bande(A, B, (ca + cb) / 2)
    for (A, ca), (B, cb) in zip(bande, bande[1:]):
        dessous.relier(A, B, (ca + cb) / 2, D['COLONNES_POITRINE'])

    # Jupes : de la taille au filet `jupe` de la base.
    zones_jupe = TRONC + JAMBES
    filet = b.filet('jupe')
    centre = filet.axe
    z_taille = ancres['bas']
    ourlets = D['OURLET_PAR_AZIMUT']
    z_ourlet = ourlets[0][1]
    enveloppes = {}

    def appui(z, theta):
        """Rayon de l'enveloppe du corps à la hauteur `z`, direction `theta`."""
        if z not in enveloppes:
            enveloppes[z] = enveloppe_convexe(b.coupe(zones_jupe, (0.0, 0.0, z), (0.0, 0.0, 1.0), (1.0, 0.0, 0.0),
                                                      (0.0, 1.0, 0.0)))
        return rayon_a_l_enveloppe(enveloppes[z], centre, direction(theta))

    def rayon(z, theta, creux=0.0):
        """Rayon de la robe de dessus à la hauteur `z`, direction `theta` : à l'aisance de la taille en haut, au jeu sur
        le filet `EVASEMENT` plus bas, moins le `creux` d'un pli, jamais à moins du jeu du corps."""
        corps = appui(round(max(z, D['OURLET_DESSOUS']), 3), theta)
        jeu = D['DEGAGEMENT_MIN'] + D['ECART_DESSOUS']
        part = fondu((z_taille - z) / D['EVASEMENT'])
        pose = (1 - part) * (corps + D['CORSAGE'][0][2]) + part * (filet.point(z, theta)[0] + jeu)
        return max(corps + jeu, pose - creux)

    def ouverture(z):
        """Demi-ouverture de la robe de dessus à la hauteur nominale `z`, menée de la taille à l'ourlet."""
        f = (z_taille - max(z, z_ourlet)) / (z_taille - z_ourlet)
        return D['OUVERTURE_TAILLE'] + (D['OUVERTURE_OURLET'] - D['OUVERTURE_TAILLE']) * f

    def niveau(z, theta):
        """La hauteur réelle de la hauteur nominale `z` de la robe de dessus dans la direction `theta` : ses rangées
        s'étirent de la taille à l'ourlet de chaque direction."""
        return z_taille - (z_taille - z) * (z_taille - selon(ourlets, theta)) / (z_taille - z_ourlet)

    def angles(z):
        """Les angles des colonnes de la robe de dessus à la hauteur nominale `z` (à son ourlet au-dessous)."""
        o = ouverture(z)
        return colonnes(o, math.degrees(galon / rayon(niveau(max(z, z_ourlet), o), o)))

    hasard = tirage(D['PLIS']['graine'])
    plis = [0.0, 0.0] + [hasard.uniform(0.5, 1.0) if k % 2 else 0.0 for k in range(m - 3)] + [0.0, 0.0]
    plis_de_l_ouverture = [hasard.uniform(0.5, 1.0) if k % 2 == 0 else 0.0 for k in range(G - 1)]

    def creux(z, pli):
        """Ce dont une colonne de pli `pli` rentre sous le rayon à la hauteur `z` : rien à la taille, tout
        `PLIS['hauteur']` plus bas."""
        return D['PLIS']['amplitude'] * pli * min(1.0, max(0.0, (z_taille - z) / D['PLIS']['hauteur']))

    def rangee(toile, zs, thetas, plis, ecart):
        """Une rangée de jupe : un sommet par (hauteur, angle, pli), aux poids du filet."""
        pts = [np.append(centre + (rayon(z, t, creux(z, p)) - ecart) * direction(t), z) for z, t, p in zip(zs, thetas, plis)]
        return (toile.poser(pts, [filet.poids(z, t) for z, t in zip(zs, thetas)], fixes=True),
                np.array([centre[0], centre[1], float(np.mean(zs))]))

    dents = lambeaux(D['LAMBEAUX_ROBE'], m + 1)
    jupe = []
    for k, z in enumerate(D['RANGEES_JUPE'] + [z_ourlet + galon, z_ourlet]):
        t = angles(z)      # les deux dernières rangées, celles du galon de l'ourlet, suivent ses dents
        mordu = D['LAMBEAUX_ROBE']['profondeur'] if k >= len(D['RANGEES_JUPE']) else None
        zs = [niveau(z + (mordu - d if mordu else 0.0), a) for a, d in zip(t, dents)]
        jupe.append(rangee(robe, zs, t, plis, 0.0))
    for k, ((A, ca), (B, cb)) in enumerate(zip([corsage[0][0]] + jupe, jupe)):
        robe.relier(A, B, (ca + cb) / 2, m, range(m) if k == len(jupe) - 1 else bords)

    # Robe de dessous : anneaux fermés, de la taille à son ourlet, aux angles et aux plis de la robe de dessus à la même
    # hauteur, plus les colonnes de l'ouverture.
    o = D['OUVERTURE_TAILLE']
    sous = [taille(dessous, angles_de_la_taille + dans_l_ouverture(o), 0.0)]
    dents = lambeaux(D['LAMBEAUX_DESSOUS'], m + G)
    for z in D['RANGEES_DESSOUS'] + [D['OURLET_DESSOUS']]:
        t = angles(z) + dans_l_ouverture(ouverture(z))
        zs = [z + (D['LAMBEAUX_DESSOUS']['profondeur'] - d if z == D['OURLET_DESSOUS'] else 0.0) for d in dents]
        sous.append(rangee(dessous, zs, t, plis + plis_de_l_ouverture, D['ECART_DESSOUS']))
    for (A, ca), (B, cb) in zip(sous, sous[1:]):
        dessous.bande(A, B, (ca + cb) / 2)

    pieces = [nappe_simple(b, D, robe, 'robe', materiaux), nappe_simple(b, D, dessous, 'dessous', materiaux),
              manches(D, b, materiaux)]
    piece = joindre(pieces)
    piece.name = 'robe'
    b.transferer(piece, PORTEUSES, D['BORNES_DES_CLES'])
    return piece


def manches(D, b, materiaux):
    """Les deux manches, double nappe à l'envers en doublure : anneaux perpendiculaires à l'axe du bras (`MANCHE`), aux
    azimuts `AZIMUTS_DE_MANCHE`, serrés dessous. Le dessus suit le bras à son aisance ; dessous, la poche pend en lobe vers
    `ANGLE_DE_LA_POCHE`, de plus en plus bas passé le coude, ses godets creusés une colonne sur deux ; le bord en dents,
    galonné. Jusqu'au coude, la manche emprunte ses poids au bras, sommet par sommet ; au-delà, elle suit l'avant-bras
    d'un bloc."""
    toile = Toile()
    M, G, phis = D['MANCHE'], D['GODETS'], D['AZIMUTS_DE_MANCHE']
    s = len(phis)
    dirs = [np.array([math.cos(math.radians(t)), math.sin(math.radians(t))]) for t in phis]
    lobe = [max(0.0, math.cos(math.radians(t - D['ANGLE_DE_LA_POCHE']))) ** D['GALBE_DE_LA_POCHE'] for t in phis]
    radial, axial = math.sin(math.radians(D['INCLINAISON_DE_LA_POCHE'])), math.cos(math.radians(D['INCLINAISON_DE_LA_POCHE']))
    for c, signe in (('g', 1.0), ('d', -1.0)):
        porteur = b.porteur(['torse'] + BRAS[c])
        axe, anneau_de_bras, poids_de_l_avant_bras = bras_de(D, b, c, signe, dirs, porteur)
        dents = lambeaux(dict(D['LAMBEAUX_MANCHE'], graine=D['LAMBEAUX_MANCHE']['graine'] + c), s)
        liste = []
        for k, (f, dessus, poche) in enumerate(M):
            godet = G['creux'] * min(1.0, max(0.0, (f - G['debut']) / (M[-1][0] - G['debut'])))
            aisances = [max(dessus, dessus + poche * radial * l - (godet if i in G['colonnes'] else 0.0))
                        for i, l in enumerate(lobe)]
            pts, milieu, _ = anneau_de_bras(f, aisances)
            recul = [D['LAMBEAUX_MANCHE']['profondeur'] - d if k == len(M) - 1 else 0.0 for d in dents]
            pts = [p + (poche * axial * l - r) * axe for p, l, r in zip(pts, lobe, recul)]
            au_bras = f < D['RACCORD_AU_BRAS']
            poids = [emprunter(p, porteur)[0] for p in pts] if au_bras else [poids_de_l_avant_bras] * s
            liste.append((toile.poser(pts, poids, fixes=not au_bras), milieu))
        for k, ((A, ca), (B, cb)) in enumerate(zip(liste, liste[1:])):
            toile.relier(A, B, (ca + cb) / 2, s, range(s) if k == len(liste) - 2 else ())
        fermer_a_l_epaule(D, toile, liste, porteur)
    X, orientes, normales, W = toile.lisses(D['LISSAGE_POIDS'])
    piece = b.nappe('manches', X, normales, W, orientes, materiaux['robe'], D['EPAISSEUR'],
                    [(materiaux[matiere] if matiere else None, materiaux['doublure']) for matiere in toile.matieres])
    piece.data.set_sharp_from_angle(angle=math.radians(D['ANGLE_VIF']))
    return piece
