"""Kit des culottes (#4318, #4394) : une culotte d'anneaux horizontaux skinnée sur la base, autour des hanches de la
ceinture à l'entrejambe, puis autour de chaque jambe, d'après le `donnees.py` de la pièce (aucun nombre ici). Le
`modele.py` de la pièce donne l'azimut de ses colonnes et leur aisance ; le kit en fait la nappe.

Chaque jambe a `COLONNES_JAMBE` colonnes ; au-dessus de l'entrejambe, l'anneau des hanches reprend les colonnes du dehors
des deux jambes et les deux coutures du milieu, devant et derrière. À la rangée de l'entrejambe, les colonnes de
l'entrejambe des deux jambes sont les mêmes sommets, sur le plan du milieu : la culotte reste d'un seul tenant. Poids
empruntés au corps sommet par sommet, ceux du milieu à la moyenne des deux jambes.
"""
import numpy as np

from robe import Nappe
from tissu import anneau, centre_de, direction, emprunter

COTES = {'g': 1.0, 'd': -1.0}


def table(points, z):
    return float(np.interp(z, *zip(*sorted(points))))


def coupe(b, z, zones):
    return b.coupe(zones, (0.0, 0.0, z), (0.0, 0.0, 1.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0), minimum=1)


def colonnes_des_hanches(D, azimut):
    """L'anneau des hanches : (colonne de jambe, côté, azimut autour des hanches), de la couture devant par la gauche, la
    couture du dos, puis la droite."""
    m, f, d = D['COLONNES_JAMBE'], D['COUTURE_DEVANT'], D['COUTURE_DOS']
    dehors = [(f + 1 + k) % m for k in range((d - f) % m - 1)]
    arc = (azimut(D, d) - azimut(D, f)) % 360.0

    def autour(j):
        return 180.0 * ((azimut(D, j) - azimut(D, f)) % 360.0) / arc
    return ([(f, 'g', 0.0)] + [(j, 'g', autour(j)) for j in dehors] + [(d, 'g', 180.0)]
            + [(j, 'd', -autour(j)) for j in reversed(dehors)])


def nappe_de_culotte(D, b, azimut, aisances, haut_fixe):
    """La nappe de la culotte : `azimut(D, j)`, l'azimut de la colonne `j` à la jambe gauche (degrés, en miroir à la
    droite) ; `aisances(D, z, js)`, l'aisance des colonnes `js` à la hauteur `z`. `haut_fixe` : la rangée du haut garde
    les poids du corps, sans lissage. Rend la nappe et ses bandes dans l'ordre de leurs faces, deux triangles par
    sommet : ((colonne, côté) par sommet, rang de la bande sous l'entrejambe ou `None` aux hanches)."""
    b.exiger(D['PORTEUSES'])
    porteurs = {'T': b.porteur(D['PORTEUSES']),
                **{c: b.porteur([z for z in D['PORTEUSES'] if z == 'hanches' or z.endswith(f'_{c}')]) for c in COTES}}
    m = D['COLONNES_JAMBE']
    nappe, bandes = Nappe(), []

    def relier(A, B, cols, ref, rang):
        nappe.bande(A, B, ref)
        bandes.append((cols, rang))

    def anneau_de_jambe(z, cote):
        """Les `COLONNES_JAMBE` points de la jambe `cote` à `z`, et le centre de sa coupe."""
        s = COTES[cote]
        P = coupe(b, z, D['PORTEUSES'])
        P = P[s * P[:, 0] > 0]
        c = centre_de(P)
        js = list(range(m))
        pts = anneau(P, c, [direction(s * azimut(D, j)) for j in js], aisances(D, z, js), D['DEGAGEMENT_MIN'],
                     au_plus_pres=True)
        return [np.array([p[0], p[1], z]) for p in pts], np.array([c[0], c[1], z])

    # Hanches : de la ceinture à la rangée au-dessus de l'entrejambe.
    hanches = colonnes_des_hanches(D, azimut)
    cols_h = [(j, c) for j, c, _ in hanches]
    anneaux_h = []
    for k, z in enumerate(D['CEINTURE']):
        P = coupe(b, z, D['PORTEUSES'])
        c = centre_de(P)
        pts = anneau(P, c, [direction(t) for _, _, t in hanches], aisances(D, z, [j for j, _, _ in hanches]),
                     D['DEGAGEMENT_MIN'], au_plus_pres=True)
        pts = [np.array([p[0], p[1], z]) for p in pts]
        anneaux_h.append((nappe.poser(pts, [emprunter(p, porteurs['T'])[0] for p in pts], fixes=haut_fixe and k == 0),
                          np.array([c[0], c[1], z])))

    # Entrejambe : un anneau par jambe ; les coutures et l'entrejambe sur le plan du milieu, communs aux deux.
    z = D['ENTREJAMBE']
    jambes = {c: anneau_de_jambe(z, c) for c in COTES}
    milieu = [D['COUTURE_DEVANT'], D['COUTURE_DOS']] + [j for j in range(m) if (j - D['COUTURE_DOS']) % m
                                                         < (D['COUTURE_DEVANT'] - D['COUTURE_DOS']) % m and j != D['COUTURE_DOS']]
    communs = {}
    for j in milieu:
        p = np.array([0.0, (jambes['g'][0][j][1] + jambes['d'][0][j][1]) / 2, z])
        w = (emprunter(p, porteurs['g'])[0] + emprunter(p, porteurs['d'])[0]) / 2
        communs[j] = nappe.poser([p], [w])[0]
    rangee = {}
    for c in COTES:
        pts, _ = jambes[c]
        propres = [j for j in range(m) if j not in communs]
        idx = nappe.poser([pts[j] for j in propres], [emprunter(pts[j], porteurs[c])[0] for j in propres])
        rangee[c] = [communs[j] if j in communs else idx[propres.index(j)] for j in range(m)]
    entrejambe = [rangee[c][j] for j, c in cols_h]
    centre_e = np.array([0.0, float(np.mean([jambes[c][1][1] for c in COTES])), z])
    for (A, ca), (B, cb) in zip(anneaux_h, anneaux_h[1:] + [(entrejambe, centre_e)]):
        relier(A, B, cols_h, (ca + cb) / 2, None)

    # Jambes : sous l'entrejambe.
    for c in COTES:
        cols = [(j, c) for j in range(m)]
        precedent, centre_p = rangee[c], jambes[c][1]
        for k, zj in enumerate(D['JAMBE']):
            pts, centre = anneau_de_jambe(zj, c)
            A = nappe.poser(pts, [emprunter(p, porteurs[c])[0] for p in pts])
            relier(precedent, A, cols, (centre_p + centre) / 2, k)
            precedent, centre_p = A, centre
    return nappe, bandes
