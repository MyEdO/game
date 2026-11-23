"""Géométrie de `humanoide--armure--brassards-cloutes` (`element/tissu.py`, `maille.py`), d'après `donnees.py` (aucun
nombre ici). Sur chaque avant-bras, autour de l'axe coude-poignet :

- le canon de cuir : des anneaux fermés de dessous la fourrure au poignet, double nappe ;
- la collerette de fourrure : des anneaux du dessus du coude (plus haut à l'arrière, sur sa pointe) au haut du cuir,
  gonflés, en touffes, les deux bords en mèches, double nappe ;
- la sangle du poignet, en relief sur le cuir, sa boucle ronde, les pointes et les têtes de clous : des solides, chacun
  aux poids du sommet du cuir qui le porte.
Le rayon de chaque sommet est celui de l'enveloppe convexe des coupes du bras à son abscisse, plus son jeu. Poids
empruntés au corps sommet par sommet puis lissés sur la grille ; silhouettes et clés `gabarit_*` transférées."""
import math

import numpy as np
from maille import lineaire, revolution, tirage
from tente import HAUT
from tissu import (Maillage, emprunter, enveloppe_convexe, joindre, lambeaux, lisser, rayon_a_l_enveloppe,
                   repere_de_plan, voisinage)


class Bras:
    """L'avant-bras `c` (`g` ou `d`) : son axe du coude au poignet, son repère d'azimut et l'enveloppe de ses coupes."""

    def __init__(self, D, b, c):
        cote, signe = {'g': ('l', 1.0), 'd': ('r', -1.0)}[c]
        self.D, self.b, self.c, self.zones = D, b, c, D['ZONES'][c]
        self.coude, poignet = np.array(b.tete(f'lowerarm_{cote}')), np.array(b.tete(f'hand_{cote}'))
        self.axe = (poignet - self.coude) / np.linalg.norm(poignet - self.coude)
        self.u, self.v = repere_de_plan(self.axe, HAUT, signe)
        self.porteur = b.porteur(self.zones)
        self.thetas = {nom: [math.radians(360.0 * j / n) for j in range(n)] for nom, n in D['COLONNES'].items()}
        self._coupes = {}

    def radiale(self, theta):
        return math.cos(theta) * self.u + math.sin(theta) * self.v

    def coupe(self, k):
        """L'enveloppe convexe de la coupe du bras à l'abscisse `k` pas de coupe, `None` sans coupe."""
        if k not in self._coupes:
            P = self.b.coupe(self.zones, self.coude + k * self.D['PAS_DES_COUPES'] * self.axe, self.axe, self.u, self.v,
                             minimum=0).reshape(-1, 2)
            self._coupes[k] = enveloppe_convexe(P) if len(P) >= 3 else None
        return self._coupes[k]

    def rayon(self, s, theta):
        """La distance de l'axe à l'enveloppe du bras à l'abscisse `s`, dans la direction `theta`."""
        k = round(s / self.D['PAS_DES_COUPES'])
        d = np.array([math.cos(theta), math.sin(theta)])
        return max(rayon_a_l_enveloppe(H, np.zeros(2), d) for H in map(self.coupe, (k - 1, k, k + 1)) if H is not None)

    def point(self, s, theta, ecart):
        return self.coude + s * self.axe + (self.rayon(s, theta) + ecart) * self.radiale(theta)

    def nappe(self, nom, rangs, mat, epaisseur):
        """La double nappe des `rangs` (un point par colonne chacun), fermée autour de l'axe ; rend l'objet et les poids
        de sa grille, par rang et par colonne."""
        n = len(rangs[0])
        M = Maillage()
        lignes = [M.ajouter(rang, nom) for rang in rangs]
        for A, B in zip(lignes, lignes[1:]):
            M.bande(A, B, self.coude + ((M.sommets[A[0]] + M.sommets[B[0]]) / 2 - self.coude) @ self.axe * self.axe)
        X, orientes, normales = M.orienter()
        W = lisser(np.array([emprunter(p, self.porteur)[0] for p in X]), voisinage(orientes, len(X)),
                   self.D['LISSAGE_POIDS'])
        objet = self.b.nappe(f'{nom}_{self.c}', X, normales, W, orientes, mat, epaisseur)
        return objet, W.reshape(len(rangs), n, -1)


def cuir(bras):
    C = bras.D['CUIR']
    return [[bras.point(s, t, lineaire(C['jeu'], s)) for t in bras.thetas['cuir']] for s in C['rangs']]


def fourrure(bras):
    F, n = bras.D['FOURRURE'], len(bras.thetas['fourrure'])
    touffes = tirage(F['touffes']['graine'] + bras.c)
    bords = [lambeaux({**F['meches'], 'graine': F['meches']['graine'] + bras.c + bord}, n) for bord in 'hb']
    dernier = len(F['rangs']) - 1
    rangs = []
    for k, (s_dos, s_pli) in enumerate(F['rangs']):
        lobe = math.sin(math.pi * k / dernier)
        rang = []
        for j, t in enumerate(bras.thetas['fourrure']):
            s = s_pli + (s_dos - s_pli) * (1 + math.cos(t - math.radians(bras.D['AZIMUT_ARRIERE']))) / 2
            s += {0: -bords[0][j], dernier: bords[1][j]}.get(k, 0.0)
            rang.append(bras.point(s, t, lineaire(F['jeu'], s) + F['gonflement'] * lobe + lobe * touffes.uniform(0.0, F['touffes']['ampleur'])))
        rangs.append(rang)
    return rangs


def solides(bras, grille, poids_du_cuir):
    """La sangle, la boucle, les pointes et les clous du bras : le maillage, ses poids par sommet."""
    D, n = bras.D, len(bras.thetas['cuir'])
    rangs_s = D['CUIR']['rangs']
    M, W = Maillage(), []

    def porte_par(s, theta):
        """Les poids du sommet du cuir le plus proche de l'abscisse `s` et de l'azimut `theta`."""
        i = int(np.argmin([abs(s - r) for r in rangs_s]))
        return poids_du_cuir[i][round(theta / (2 * math.pi / n)) % n]

    def raidir(w):
        W.extend([w] * (len(M.sommets) - len(W)))

    def sur_le_cuir(s, theta):
        """Le point du cuir à l'abscisse `s` et à l'azimut `theta`, entre ses anneaux et ses colonnes, et sa radiale."""
        i = min(max(int(np.searchsorted(rangs_s, s, side='right')) - 1, 0), len(rangs_s) - 2)
        f = (s - rangs_s[i]) / (rangs_s[i + 1] - rangs_s[i])
        x = theta / (2 * math.pi / n)
        j, g = math.floor(x), x - math.floor(x)
        coin = lambda a, c: np.asarray(grille[a][c % n])
        p = ((1 - f) * ((1 - g) * coin(i, j) + g * coin(i, j + 1)) + f * ((1 - g) * coin(i + 1, j) + g * coin(i + 1, j + 1)))
        return p, bras.radiale(theta)

    # La sangle : par colonne, le chant du coude, la face et le chant du poignet, entre deux anneaux du cuir.
    S = D['SANGLE']
    i0, i1 = (rangs_s.index(s) for s in S['s'])
    sections = []
    for j, t in enumerate(bras.thetas['cuir']):
        d = bras.radiale(t)
        a, c = np.asarray(grille[i0][j]), np.asarray(grille[i1][j])
        sections.append(M.ajouter([a, a + S['relief'] * d, c + S['relief'] * d, c], 'cuir'))
        W.extend([poids_du_cuir[i0][j]] * 2 + [poids_du_cuir[i1][j]] * 2)
    for j in range(n):
        A, B = sections[j], sections[(j + 1) % n]
        dedans = (M.sommets[A[0]] + M.sommets[A[3]] + M.sommets[B[0]] + M.sommets[B[3]]) / 4
        for k in range(3):
            M.quad(A[k], B[k], B[k + 1], A[k + 1], dedans)

    # La boucle : un anneau de section en losange, à plat sur la sangle.
    B = D['BOUCLE']
    theta = math.radians(B['azimut'])
    p, d = sur_le_cuir(sum(S['s']) / 2, theta)
    centre = p + (S['relief'] + B['saillie']) * d
    t1 = bras.axe
    t2 = np.cross(d, t1)
    anneaux = []
    for k in range(B['cotes']):
        a = 2 * math.pi * k / B['cotes']
        r = math.cos(a) * t1 + math.sin(a) * t2
        ame = centre + B['rayon'] * r
        anneaux.append((ame, M.ajouter([ame + B['jonc'] * r, ame + B['jonc'] * d, ame - B['jonc'] * r, ame - B['jonc'] * d],
                                       'clous')))
    for (ame_a, A), (ame_b, C) in zip(anneaux, anneaux[1:] + anneaux[:1]):
        for k in range(4):
            M.quad(A[k], C[k], C[(k + 1) % 4], A[(k + 1) % 4], (ame_a + ame_b) / 2)
    raidir(porte_par(sum(S['s']) / 2, theta))

    # Les pointes et les têtes de clous : des révolutions autour de la radiale, plantées dans le cuir ou la sangle.
    def planter(s, theta, profil, cotes, ancrage):
        p, d = sur_le_cuir(s, theta)
        if S['s'][0] <= s <= S['s'][1]:
            p = p + S['relief'] * d
        t2 = np.cross(d, bras.axe)
        pied = p - ancrage * d
        M.ajouter_faces(*revolution(profil, (d, bras.axe, t2), pied, cotes), 'clous', pied)
        raidir(porte_par(s, theta))

    P = D['POINTES']
    for s in P['s']:
        planter(s, math.radians(P['azimut']), [(0.0, P['rayon']), (P['hauteur'], 0)], P['cotes'], P['ancrage'])
    Q = D['CLOUS']
    for azimut in Q['azimuts']:
        for s in Q['s']:
            planter(s, math.radians(azimut), [(0.0, Q['rayon']), (0.7 * Q['hauteur'], 0.6 * Q['rayon']), (Q['hauteur'], 0)],
                    Q['cotes'], Q['ancrage'])
    return M, np.array(W)


def construire(D, materiaux, b):
    b.exiger(D['ZONES']['g'] + D['ZONES']['d'])
    objets = []
    for c in 'gd':
        bras = Bras(D, b, c)
        grille = cuir(bras)
        canon, poids_du_cuir = bras.nappe('cuir', grille, materiaux['cuir'], D['CUIR']['epaisseur'])
        collerette, _ = bras.nappe('fourrure', fourrure(bras), materiaux['fourrure'], D['FOURRURE']['epaisseur'])
        M, W = solides(bras, grille, poids_du_cuir)
        X, faces, _ = M.orienter()
        teintes = [None if M.parties[f[0]] == 'cuir' else materiaux[M.parties[f[0]]] for f in faces]
        garniture = b.nappe_simple(f'garniture_{c}', [tuple(p) for p in X], [tuple(f) for f in faces], W, materiaux['cuir'],
                                   teintes, D['ANGLE_VIF'])
        objets += [canon, collerette, garniture]
    piece = joindre(objets)
    piece.name = 'brassards-cloutes'
    b.transferer(piece, D['ZONES']['g'] + D['ZONES']['d'])
    return piece
