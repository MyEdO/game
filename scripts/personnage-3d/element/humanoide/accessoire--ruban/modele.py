"""Géométrie de `humanoide--accessoire--ruban` : sur le bas de la jambe gauche (`donnees.py`), une bande qui en fait le
tour sous le genou, un nœud sur son dehors et deux bouts qui pendent le long du mollet ; chaque sommet posé au `JEU` du
bas, visé depuis le dehors vers l'axe de la jambe. Doubles nappes ; poids empruntés au bas sous chaque sommet, puis
lissés ; silhouettes et clés `gabarit_*` reprises du corps."""
import numpy as np
from mathutils import Vector

from tissu import Maillage, direction, emprunter, joindre, lisser, porteur_de, voisinage


def construire(D, materiaux, b):
    b.exiger(D['ZONES_DES_CLES'])
    bas = porteur_de(*b.matieres_publiees(D['CONTOURNE']['bas'], D['MATIERES']['bas']))
    tete = np.array(b.tete(D['OS']))
    queue = np.array(b.rig.matrix_world @ b.rig.data.bones[D['OS']].tail_local)

    def axe(z):
        return tete + (queue - tete) * (tete[2] - z) / (tete[2] - queue[2])

    def sur_le_bas(z, theta, devant=0.0):
        """Le point du bas à `z`, azimut `theta`, au jeu, plus `devant`."""
        d = np.append(direction(theta), 0.0)
        o = axe(z)
        touche = bas['arbre'].ray_cast(Vector((o + D['PORTEE'] * d).tolist()), Vector((-d).tolist()), D['PORTEE'])
        if touche[0] is None:
            raise ValueError(f'ruban : aucun bas à z = {z:.3f}, azimut {theta:.0f}')
        return np.array(touche[0]) + (D['JEU'] + D['EPAISSEUR'] + devant) * d

    def piece(nom, M):
        X, orientes, normales = M.orienter()
        W = lisser(np.array([emprunter(p, bas)[0] for p in X]), voisinage(orientes, len(X)), D['LISSAGE_POIDS'])
        return b.nappe(nom, X, normales, W, orientes, materiaux['ruban'], D['EPAISSEUR'])

    # Bande.
    haut, bas_z = D['BANDE']
    thetas = [360.0 * i / D['COLONNES'] for i in range(D['COLONNES'])]
    M = Maillage()
    A = M.ajouter([sur_le_bas(haut, t) for t in thetas], None)
    B = M.ajouter([sur_le_bas(bas_z, t) for t in thetas], None)
    M.bande(A, B, axe((haut + bas_z) / 2))
    objets = [piece('bande', M)]

    # Nœud : un carré bombé devant la bande ; bouts : une bande de `RANGS_DU_BOUT` rangs, du nœud à son bout.
    face = np.append(direction(D['NOEUD']), 0.0)
    travers = np.array([-face[1], face[0], 0.0])
    milieu = (haut + bas_z) / 2
    large, haut_n = D['TAILLE_DU_NOEUD']
    M = Maillage()
    coins = []
    for dz in (haut_n / 2, 0.0, -haut_n / 2):
        rang = []
        for du in (-large / 2, 0.0, large / 2):
            p = sur_le_bas(milieu + dz, D['NOEUD'], D['RELIEF_DU_NOEUD'] * (1.5 if du == 0 and dz == 0 else 1.0))
            rang.append(p + du * travers)
        coins.append(M.ajouter(rang, None))
    for r in range(2):
        for c in range(2):
            M.quad(coins[r][c], coins[r][c + 1], coins[r + 1][c + 1], coins[r + 1][c], axe(milieu))
    objets.append(piece('noeud', M))
    # Les bouts partent sous le milieu du nœud : de son milieu, leurs coins tombaient sur ceux du nœud, sommets confondus
    # aux poids différents (`poids/jumeaux-divergents`).
    depart = milieu - haut_n / 4
    for decalage, z_bout in D['BOUTS']:
        M = Maillage()
        rangs = []
        for k in range(D['RANGS_DU_BOUT'] + 1):
            z = depart + (z_bout - depart) * k / D['RANGS_DU_BOUT']
            p = sur_le_bas(z, D['NOEUD'], D['RELIEF_DU_NOEUD'] if k == 0 else 0.0)
            centre = p + decalage * travers
            rangs.append(M.ajouter([centre - D['LARGEUR_DU_BOUT'] / 2 * travers,
                                    centre + D['LARGEUR_DU_BOUT'] / 2 * travers], None))
        for R, S in zip(rangs, rangs[1:]):
            M.quad(R[0], R[1], S[1], S[0], axe(milieu))
        objets.append(piece('bout', M))
    ruban = joindre(objets)
    ruban.name = 'ruban'
    b.transferer(ruban, D['ZONES_DES_CLES'])
    return ruban
