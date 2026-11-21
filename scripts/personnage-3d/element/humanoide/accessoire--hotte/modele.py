"""Géométrie de `humanoide--accessoire--hotte` : le panier d'osier posé derrière le dos et la tête, ses deux bretelles
de cuir, et les cases de ses fioles dans l'ouverture (`donnees.py`).

- panier : anneaux elliptiques horizontaux du fond au bord, au ventre gonflé, l'axe penché vers l'arrière, la paroi
  avant au jeu de tout ce qui est derrière le dos (éléments contournés et corps), rangs d'osier en anneaux alternés
  creux et gonflés, bord roulé, fond en éventail ; double nappe ; un seul jeu de poids, celui du pourpoint au milieu du
  dos : le panier reste rigide ;
- bretelles : de chaque côté, une bande du haut de la paroi avant du panier, posée sur le pourpoint par-dessus l'épaule,
  devant, sous l'aisselle et derrière elle, jusqu'au bas de la paroi avant ; poids empruntés au pourpoint, reportés du
  bras à la clavicule, ceux du panier à ses deux bouts, lissés ;
- cases : `charge_dos`, puis `charge_dos#<rang>`, aux axes que l'hôte leur donne (`MiseEnPage.axe_de_rangement`).
Silhouettes et clés `gabarit_*` : du corps pour le panier, du pourpoint publié pour les bretelles.
"""
import math

import numpy as np
from tissu import (Maillage, centre_de, emprunter, joindre, joindre_les_surfaces, lisser, porteur_de, unitaire, viser,
                   voisinage)


def selon_t(table, t):
    """La valeur de `table` (`[(t, valeur)]`) en `t`, interpolée."""
    return np.interp(t, *zip(*table))


class Panier:
    """La forme du panier : demi-axes et centre de la section à la hauteur `z`, la paroi avant, rangs gonflés et bord
    compris, au jeu des obstacles."""

    def __init__(self, D, obstacles):
        self.D = D
        self.pente = math.tan(math.radians(D['INCLINAISON']))
        self.avant = 0.0
        jeu = D['JEU_DU_PANIER'] + max(D['RELIEF'], D['BORD'])
        z = np.clip(obstacles[:, 2], D['Z_BAS'], D['Z_HAUT'])
        a, b = self.demi_axes(z)
        dans = (obstacles[:, 2] > D['Z_BAS'] - jeu) & (obstacles[:, 2] < D['Z_HAUT'] + jeu)
        dans &= np.abs(obstacles[:, 0]) < a + jeu
        arc = b * np.sqrt(np.clip(1 - (obstacles[:, 0] / (a + jeu)) ** 2, 0.0, 1.0))
        # Chaque obstacle sous l'empreinte du panier reste au jeu devant l'arc avant de sa section.
        self.avant = float((obstacles[:, 1] + jeu + arc - self.centre(z))[dans].max())

    def demi_axes(self, z):
        t = (z - self.D['Z_BAS']) / (self.D['Z_HAUT'] - self.D['Z_BAS'])
        return selon_t(self.D['LARGEUR'], t), selon_t(self.D['PROFONDEUR'], t)

    def centre(self, z):
        """y du centre de la section à `z` : la paroi avant, penchée, plus le demi-axe en y."""
        return self.avant + self.pente * (z - self.D['Z_BAS']) + self.demi_axes(z)[1]

    def point(self, z, theta, ecart):
        a, b = self.demi_axes(z)
        return np.array([(a + ecart) * math.cos(theta), self.centre(z) + (b + ecart) * math.sin(theta), z])


def panier(D, b, forme, w, mat):
    n, rangs = D['COLONNES'], D['RANGS']
    zs = np.linspace(D['Z_BAS'], D['Z_HAUT'], rangs + 1)

    def ecart(k):
        """Le bord roulé en haut, puis, en descendant, un anneau gonflé sur deux ; le fond à la section."""
        if k == rangs:
            return D['BORD']
        return D['RELIEF'] if k > 0 and (rangs - k) % 2 == 0 else 0.0

    M = Maillage()
    anneaux = [M.ajouter([forme.point(z, 2 * math.pi * j / n, ecart(k)) for j in range(n)], 'panier')
               for k, z in enumerate(zs)]
    for A, B, za, zb in zip(anneaux, anneaux[1:], zs, zs[1:]):
        zm = (za + zb) / 2
        M.bande(A, B, np.array([0.0, forme.centre(zm), zm]))
    (fond,) = M.ajouter([np.array([0.0, forme.centre(zs[0]), zs[0]])], 'panier')
    dedans = np.array([0.0, forme.centre(zs[0]), zs[0] + 0.1])
    for j in range(n):
        M.triangle(fond, anneaux[0][j], anneaux[0][(j + 1) % n], dedans)
    X, orientes, normales = M.orienter()
    return b.nappe('panier', X, normales, np.tile(w, (len(X), 1)), orientes, mat, D['EPAISSEUR'])


def bretelle(D, b, support, forme, w, signe, mat):
    """La bretelle gauche (`signe` +1) ou droite (-1) : son milieu, d'une attache du panier à l'autre par l'épaule."""
    B = D['BRETELLE']
    origine = np.array([signe * B['plan'], 0.0, 0.0])
    e1, e2, n = np.array([0.0, 0.0, -1.0]), np.array([0.0, 1.0, 0.0]), np.array([1.0, 0.0, 0.0])
    zones = [z if z == 'torse' else f"{z}_{'g' if signe > 0 else 'd'}" for z in D['ZONES_DE_L_EPAULE']]
    centre = centre_de(b.coupe(zones, origine, n, e1, e2))
    milieu = origine + centre[0] * e1 + centre[1] * e2
    demi = B['largeur'] / 2

    def sur_l_epaule(phi):
        """Le milieu de la bretelle dans la direction `phi` : au plus loin du pourpoint sous ses deux bords et son
        milieu, au jeu."""
        t = math.radians(phi)
        d = math.cos(t) * e1 + math.sin(t) * e2
        distances = []
        for k in (-1, 0, 1):
            depart = milieu + k * demi * n
            touche = viser(support, depart, d, B['portee'])
            if touche[0] is not None:
                distances.append(B['portee'] - touche[3])
        if not distances:
            raise ValueError(f'bretelle {signe} : direction {phi} sans pourpoint dessous')
        return milieu + (max(distances) + B['jeu'] + B['epaisseur']) * d

    def attache(z):
        """Le point de la paroi avant du panier à `z`, à |x| = `attache_x` fois le demi-axe, devant ses rangs
        gonflés."""
        p = forme.point(z, -math.acos(B['attache_x']), 0.0)
        return np.array([signe * p[0], p[1] - D['RELIEF'] - B['jeu'] - B['epaisseur'], z])

    phis = np.arange(B['arc'][0], B['arc'][1] + 1e-9, B['pas'])
    chemin = [attache(B['attache_haut'])] + [sur_l_epaule(phi) for phi in phis] + [attache(B['attache_bas'])]
    M = Maillage()
    bords = [M.ajouter([p + k * demi * n for p in chemin], 'bretelle') for k in (-1, 1)]
    for i in range(len(chemin) - 1):
        M.quad(bords[0][i], bords[0][i + 1], bords[1][i + 1], bords[1][i], milieu)
    X, orientes, normales = M.orienter()
    W = np.array([emprunter(p, support)[0] for p in X])
    for depuis, vers in D['OS_REPORTES'].items():
        W[:, b.indice_os[vers]] += W[:, b.indice_os[depuis]]
        W[:, b.indice_os[depuis]] = 0.0
    for bord in bords:
        W[[bord[0], bord[-1]]] = w
    W = lisser(W, voisinage(orientes, len(X)), D['LISSAGE_POIDS'])
    return b.nappe(f'bretelle{signe:+d}', X, normales, W, orientes, mat, B['epaisseur'])


def offrir_les_cases(D, b, forme, w):
    """Les cases des fioles dans l'ouverture : chacune à l'axe de rangement que l'hôte lui donne, +Z sur la normale
    sortante, hors de l'axe de l'os qui porte le panier, +Y vers le haut ; reculée du rayon de la fiole, dont le dos se
    pose sur la case."""
    os_ = b.rig.data.bones[b.os[int(np.argmax(w))]]
    repere = np.array(b.rig.matrix_world @ os_.matrix_local)
    a, p = forme.demi_axes(D['Z_HAUT'])
    retrait = D['EPAISSEUR'] + D['RAYON_DE_LA_FIOLE']
    for rang, (u, v, dz) in enumerate(D['CASES'], start=1):
        axe = np.array([u * (a - retrait), forme.centre(D['Z_HAUT']) + v * (p - retrait), D['Z_HAUT'] + dz])
        local = np.linalg.solve(repere[:3, :3], axe - repere[:3, 3])
        z = unitaire(repere[:3, :3] @ np.array([local[0], 0.0, local[2]]))
        y = unitaire(np.array([0.0, 0.0, 1.0]) - z[2] * z)
        b.offrir(D['EMPLACEMENT'] if rang == 1 else f"{D['EMPLACEMENT']}#{rang}", w, axe - z * D['RAYON_DE_LA_FIOLE'],
                 (np.cross(y, z), y, z))


def construire(D, materiaux, b):
    b.exiger(D['ZONES_DES_CLES'] + D['ZONES_DU_SUPPORT'])
    publies = {k: b.matieres_publiees(i, D['MATIERES'][k]) for k, i in D['CONTOURNE'].items()}
    P, T, _ = joindre_les_surfaces(list(publies.values()) + [b.corps(z) for z in D['ZONES_DU_CORPS']])
    forme = Panier(D, np.concatenate([P[np.unique(T)], P[T].mean(axis=1)]))
    support = porteur_de(*publies['pourpoint'])
    w = emprunter(np.array([0.0, forme.avant + forme.pente * (D['Z_DES_POIDS'] - D['Z_BAS']), D['Z_DES_POIDS']]),
                  support)[0]
    corps = panier(D, b, forme, w, materiaux['osier'])
    bretelles = [bretelle(D, b, support, forme, w, signe, materiaux['cuir']) for signe in (1, -1)]
    offrir_les_cases(D, b, forme, w)
    dans_le_panier = len(corps.data.vertices)
    piece = joindre([corps] + bretelles)
    piece.name = D['MANIFESTE']['cle']['piece']
    masque = [i >= dans_le_panier for i in range(len(piece.data.vertices))]
    b.transferer(piece, D['ZONES_DES_CLES'], masques=[(masque, D['ZONES_DU_SUPPORT'],
                                                       {D['CONTOURNE']['pourpoint']: D['ZONES_DU_SUPPORT']})])
    return piece
