"""Géométrie de `humanoide--pilosite--barbe-longue` (`element/tissu.py`) : des cheveux mi-longs et une longue barbe, deux
nappes de colonnes en azimut posées sur la peau de la tête publiée, qui la quittent et tombent.

- Les cheveux : colonnes autour du centre du crâne, rangs en élévation du bord de la colonne au sommet, chaque point visé
  du dehors vers le centre et posé à sa hauteur au-dessus de la peau ; au-delà de la tempe, la colonne quitte le crâne à
  son bord et tombe droit jusqu'à la mâchoire, au jeu de l'oreille et du cou, en pointes inégales.
- La barbe : colonnes d'un favori à l'autre autour d'un centre derrière la bouche, rangs du bord haut (moustache, ligne
  de la joue) à la mâchoire, de plus en plus fournis ; sous la mâchoire, chaque colonne tombe, par rangs communs à toutes,
  jusqu'à sa longueur, se resserre vers le milieu et recule vers la poitrine, jamais à moins du jeu de la robe et du corps, ondulée, son
  dernier rang en pointes.

Double nappe ; poids de la peau de la tête, fondus sous la mâchoire vers ceux de la robe, du cou et du torse ; silhouettes et clés
`gabarit_*` transférées des zones de la base sous la pièce. Toute cote vient de `donnees.py`.
"""
import math

import numpy as np
from mathutils import Vector

from tissu import Maillage, direction, direction_spatiale, emprunter, fondu, joindre, joindre_les_surfaces, lambeaux, lisser, porteur_de, selon, sur_le_porteur, voisinage


def au_jeu(D, surfaces, axe, d, rayon, jeu):
    """Le rayon, depuis `axe` le long de `d`, du point le plus extérieur à `jeu` des `surfaces`, jamais sous `rayon` :
    marché du dehors (`PORTEE`) vers `rayon`."""
    r = D['PORTEE']
    while r > rayon:
        if surfaces['arbre'].find_nearest(Vector((axe + r * d).tolist()))[3] <= jeu + D['EPAISSEUR']:
            return r + D['PAS']
        r -= D['PAS']
    return rayon


def mailler(colonnes, centre, pole=None):
    """La nappe des `colonnes` (`{rang: point}` par colonne) : un quad entre deux colonnes voisines là où toutes deux
    portent deux rangs consécutifs ; `pole` ferme en éventail le plus haut rang d'un tour complet. Rend positions,
    triangles et normales, orientés vers le dehors de `centre` sur la peau (rangs positifs), de l'axe du cou dans la
    tombée."""
    M = Maillage()
    indices = [{k: M.ajouter([p], k)[0] for k, p in sorted(c.items())} for c in colonnes]
    voisines = list(zip(indices, indices[1:] + indices[:1])) if pole is not None else list(zip(indices, indices[1:]))

    def ref(*sommets):
        z = float(np.mean([M.sommets[s][2] for s in sommets]))
        return np.array([0.0, 0.02, z - 0.03])

    for a, b_ in voisines:
        for k in sorted(set(a) & set(b_)):
            if k + 1 in a and k + 1 in b_:
                M.quad(a[k], b_[k], b_[k + 1], a[k + 1], centre if k >= 0 else ref(a[k], b_[k], b_[k + 1], a[k + 1]))
    if pole is not None:
        haut = max(indices[0])
        sommet = M.ajouter([pole], haut + 1)[0]
        for a, b_ in voisines:
            M.triangle(a[haut], b_[haut], sommet, centre)
    return M.orienter()


def cheveux(D, b, tete, toutes):
    """Les colonnes des cheveux et leur pôle : rangs négatifs sous le bord (la tombée), 0 au bord, positifs sur le crâne."""
    c = D['CHEVEUX']
    C = np.array(b.tete(c['os_du_centre'])) + np.asarray(c['centre'], float)
    axe = np.array([*D['AXE'], 0.0])
    n = c['colonnes']
    phis = [360.0 * (j + 0.5) / n - 180.0 for j in range(n)]
    pointes = lambeaux(c['meches'], n)
    colonnes = []
    for j, phi in enumerate(phis):
        bord = selon(c['bord'], phi)
        colonne = {}
        for k, e in enumerate(np.linspace(bord, c['elevation_haute'], c['rangs'] + 1)):
            d = direction_spatiale(phi, e)
            peau, _ = sur_le_porteur(tete, C, d, D['PORTEE'])
            hauteur = c['hauteur'][1] + (c['stries'] if j % 2 else 0.0) if k or abs(phi) > c['tombee'] else c['hauteur'][0]
            colonne[k] = peau + hauteur * d
        if abs(phi) > c['tombee']:
            depart = colonne[0]
            d = np.array([*direction(phi), 0.0])
            rayon = float((depart - axe)[:2] @ d[:2])
            bas = selon(c['bas'], phi) - pointes[j]
            for i in range(1, c['rangs_de_tombee'] + 1):
                z = depart[2] + (bas - depart[2]) * i / c['rangs_de_tombee']
                O = np.array([axe[0], axe[1], z])
                colonne[-i] = O + au_jeu(D, toutes, O, d, 0.75 * rayon, c['jeu']) * d
        colonnes.append(colonne)
    pole, _ = sur_le_porteur(tete, C, np.array([0.0, 0.0, 1.0]), D['PORTEE'])
    return colonnes, pole + np.array([0.0, 0.0, c['hauteur'][1]]), C


def barbe(D, b, tete, dessous):
    """Les colonnes de la barbe, d'un favori à l'autre : rangs positifs sur la peau, du bord haut (le plus grand) à la
    mâchoire (0), négatifs sous elle (la tombée, aux mêmes hauteurs d'une colonne à l'autre, chaque colonne arrêtée à sa
    longueur) ; par point, dans l'ordre des colonnes et des rangs, sa profondeur sous la mâchoire du milieu ; et le
    centre."""
    c = D['BARBE']
    C = np.array(b.tete(c['os_du_centre'])) + np.asarray(c['centre'], float)
    axe = np.array([*D['AXE'], 0.0])
    n = c['colonnes']
    phis = np.linspace(-c['demi_ouverture'], c['demi_ouverture'], n)
    pointes = lambeaux(c['meches'], n)
    colonnes = []
    for j, phi in enumerate(phis):
        colonne = {}
        for k, t in enumerate(np.linspace(0.0, 1.0, c['rangs'] + 1)):
            e = selon(c['machoire'], phi) + t * (selon(c['haut'], phi) - selon(c['machoire'], phi))
            d = direction_spatiale(phi, e)
            peau, _ = sur_le_porteur(tete, C, d, D['PORTEE'])
            colonne[k] = peau + (c['hauteur'][1] + t * (c['hauteur'][0] - c['hauteur'][1])) * d
        colonnes.append(colonne)
    z0 = colonnes[n // 2][0][2]
    profondeurs = []
    for j, (phi, colonne) in enumerate(zip(phis, colonnes)):
        depart = colonne[0]
        for i in range(1, c['rangs_de_tombee'] + 1):
            t = i / c['rangs_de_tombee']
            if t * c['longueur'][0][1] > selon(c['longueur'], phi) + 1e-9:
                break
            pointe = pointes[j] if i == c['rangs_de_tombee'] else 0.0
            p = np.array([depart[0] * (1.0 - c['resserrement'] * t), depart[1], z0 - t * c['longueur'][0][1] - pointe])
            O = np.array([axe[0], axe[1], p[2]])
            rayon = float(np.linalg.norm((p - O)[:2]))
            d = (p - O) / rayon
            onde = 0.5 * (1.0 + math.sin(2 * math.pi * c['ondes']['periodes'] * t))
            relief = c['ondes']['ampleur'] * t * onde + c['ventre'] * math.sin(math.pi * t)
            colonne[-i] = O + (au_jeu(D, dessous, O, d, rayon - c['recul'] * t, c['jeu']) + relief) * d
        profondeurs += [max(0.0, z0 - colonne[k][2]) if k < 0 else 0.0 for k in sorted(colonne)]
    return colonnes, profondeurs, C



def construire(D, materiaux, b):
    b.exiger(D['ZONES_DES_CLES'])
    peau = b.matieres_publiees(D['CONTOURNE']['tete'], D['MATIERES']['tete'])
    robe = b.matieres_publiees(D['CONTOURNE']['robe'], D['MATIERES']['robe'])
    corps = [b.corps(z) for z in D['ZONES_DU_CORPS']]
    tete = porteur_de(*peau)
    toutes, dessous = porteur_de(*joindre_les_surfaces([peau] + corps)), porteur_de(*joindre_les_surfaces([robe] + corps))

    def poids(X, part):
        return np.array([(1 - t) * emprunter(p, tete)[0] + t * emprunter(p, dessous)[0] for p, t in zip(X, part)])

    colonnes, pole, centre = cheveux(D, b, tete, toutes)
    X, orientes, normales = mailler(colonnes, centre, pole)
    W = lisser(poids(X, np.zeros(len(X))), voisinage(orientes, len(X)), D['LISSAGE_DES_POIDS'])
    nappes = [b.nappe('barbe_longue', X, normales, W, orientes, materiaux['poil'], D['EPAISSEUR'])]

    colonnes, sous, centre = barbe(D, b, tete, dessous)
    X, orientes, normales = mailler(colonnes, centre)
    haut, bas = D['BARBE']['poids']
    W = lisser(poids(X, np.array([fondu((s - haut) / (bas - haut)) for s in sous])), voisinage(orientes, len(X)),
               D['LISSAGE_DES_POIDS'])
    nappes.append(b.nappe('barbe', X, normales, W, orientes, materiaux['poil'], D['EPAISSEUR']))
    piece = joindre(nappes)
    b.transferer(piece, D['ZONES_DES_CLES'])
    return piece
