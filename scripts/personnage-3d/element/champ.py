"""Champ de peau de la base (#3842) : les poids et les décalages de clé que porte un point de l'espace autour du corps,
fonction continue de sa position au repos, pour que deux couches au même endroit, de pièces ou de tenues différentes,
portent les mêmes poids et les mêmes clés.

Le corps est la réunion des zones de peau de `tissu.Base` au repos (`Base.porteur`), avec ses silhouettes et ses clés
`gabarit_*`, échantillonnée à `NIVEAUX` pas (`echantillonner`). Pour un point x à la distance d de la peau : poids et
décalages sont la moyenne des échantillons s autour de x par un noyau gaussien de |s − x|² − d², pondéré par l'aire de
chaque échantillon, tronqué à 3σ et à la peau connexe au pied dans cette boule (`connexes`, à un échantillon du triangle
du pied s'il n'y en a aucun), lue au plus grossier niveau dont le pas ne dépasse pas σ/3 (au plus fin sous 3·`PAS_M`) :
sur une peau plane, deux points d'une même normale y lisent le même noyau ; un doigt ou un membre voisin, que la boule
touche sans que la peau l'y relie, n'y entre pas. Dans la `BANDE`, σ = `PAS_M` pour les décalages et ρ pour les
poids, ρ la grosseur locale du membre (par sommet de peau, sa distance au segment de son os dominant fois
`FACTEUR_RAYON`, moyennée en x par le noyau de largeur sa valeur au pied de x) ; au-delà, σ croît de
`ALPHA`·(d − `BANDE`). Les poids gardent leurs `OS_RETENUS` plus forts, diminués du suivant écarté et ramenés à une
somme de 1 (`garder_les_plus_forts`). `re_peser` pose les clés du champ sur une pièce hors de ses sommets de chaîne,
et ses poids hors de ses sommets de chaîne et dans la bande, fondus aux deux frontières (`part_du_champ`).
"""
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

from formes import decalages, noms_des_cles, poser_la_cle, positions
from tissu import lisser, voisinage

PAS_M = 0.003
"""Pas d'échantillonnage le plus fin de la peau, en m, et largeur minimale du noyau : valeur d'ingénierie #3842."""
NIVEAUX = 4
"""Niveaux d'échantillonnage de la peau, de pas `PAS_M`·3^k : valeur d'ingénierie #3842 (durée de re-pesée)."""
ALPHA = 0.75
"""Croissance du noyau par mètre d'écart au corps au-delà de la `BANDE` : valeur d'ingénierie #3842 (porte de la tenue
du Sorcier)."""
BANDE = 0.03
"""Écart au corps, en m, sous lequel le noyau ne dépend pas de l'écart : couches empilées aux mêmes poids, valeur
d'ingénierie #3842."""
FACTEUR_RAYON = 0.5
"""Largeur du noyau des poids par mètre de rayon local du membre : valeur d'ingénierie #3842 (porte, 0,5 ; 1)."""
LARGEUR = 0.04
"""Écart, en m, au-delà de la `BANDE`, sur lequel les poids passent du champ à ceux de la pièce : valeur d'ingénierie
#3842 (porte, 2 ; 4 cm)."""
PASSES = 32
"""Passes de lissage du fondu à la frontière des chaînes, sur le graphe d'arêtes de la pièce : valeur d'ingénierie
#3842 (porte, 8 ; 16 ; 32)."""
JUMEAU_M = 0.005
"""Écart, en m, sous lequel deux sommets de normales opposées sont les deux nappes d'un même point (`tissu.double_nappe`) :
au-dessus de l'épaisseur des doubles nappes du kit (`EPAISSEUR` des `donnees.py`, 1,5 à 4 mm)."""
CONFONDUS_M = 1e-5
"""Écart, en m, sous lequel deux sommets sont le même point (couture de la découpe par zone, `Base.decouper_par_zone`)."""
OS_RETENUS = 4
"""Influences par sommet que porte l'export glTF de la base."""


def garder_les_plus_forts(W):
    """Les `OS_RETENUS` plus forts poids de chaque ligne de `W` (points, os), chacun diminué du suivant écarté, ramenés à
    une somme de 1 : deux os qui s'échangent le dernier rang retenu y pèsent tous deux presque rien."""
    rang = np.argsort(-W, axis=1, kind='stable')
    ecarte = np.take_along_axis(W, rang[:, OS_RETENUS:OS_RETENUS + 1], axis=1) if W.shape[1] > OS_RETENUS else 0.0
    garde = np.zeros_like(W)
    retenus = rang[:, :OS_RETENUS]
    np.put_along_axis(garde, retenus, np.maximum(np.take_along_axis(W, retenus, axis=1) - ecarte, 0.0), axis=1)
    total = garde.sum(axis=1, keepdims=True)
    if (total == 0).any():
        raise ValueError(f'{int((total == 0).sum())} point(s) aux {OS_RETENUS + 1} plus forts os de poids égaux')
    return garde / total


class Champ:
    """Le champ d'une peau : positions `P` (sommets, 3) et triangles `T` au repos, repère monde ; poids `W` (sommets, os)
    sur les os `os_` ; décalages monde `cles` `{nom: (sommets, 3)}`, dont les `silhouettes` de la base ;
    `os_de_chaine`, les noms des os des chaînes de la base ; `segments` (os, 2, 3), la tête et la queue de chaque os au
    repos, monde."""

    def __init__(self, P, T, W, os_, cles, silhouettes, os_de_chaine, segments):
        self.P, self.T, self.W, self.os = P, T, W, list(os_)
        self.rayon = FACTEUR_RAYON * distance_au_segment(P, segments[W.argmax(axis=1)])
        self.noms = list(cles)
        self.silhouettes = list(silhouettes)
        self.os_de_chaine = set(os_de_chaine)
        self.D = np.stack([cles[n] for n in self.noms], axis=1).reshape(len(P), -1)
        soudes = np.unique(np.round(P / CONFONDUS_M).astype(np.int64), axis=0, return_inverse=True)[1].ravel()
        self.sommets_soudes = soudes[T]
        self.triangles_du_sommet = [[] for _ in range(soudes.max() + 1)]
        for t, sommets in enumerate(self.sommets_soudes):
            for s in sommets:
                self.triangles_du_sommet[s].append(t)
        self.arbre = BVHTree.FromPolygons([tuple(p) for p in P], T.tolist(), all_triangles=True)
        self.niveaux = []
        for k in range(NIVEAUX):
            points, aires, valeurs, faces = echantillonner(P, T, np.hstack([W, self.D, self.rayon[:, None]]),
                                                           PAS_M * 3 ** k)
            kd = KDTree(len(points))
            for i, p in enumerate(points):
                kd.insert(p, i)
            kd.balance()
            n = W.shape[1] + self.D.shape[1]
            self.niveaux.append((PAS_M * 3 ** k, kd, aires, valeurs[:, :W.shape[1]], valeurs[:, W.shape[1]:n],
                                 valeurs[:, n], points, faces, np.unique(faces, return_index=True)[1]))

    def pied(self, x):
        """Le point de peau le plus proche de `x` : sa distance, le rayon local de la peau en ce point, son triangle."""
        y, _, f, d = self.arbre.find_nearest(Vector(x))
        if y is None:
            raise ValueError(f'{tuple(x)} : aucun point de peau')
        A, B, C = self.P[self.T[f]]
        b = np.linalg.lstsq(np.column_stack([B - A, C - A]), np.array(y) - A, rcond=None)[0]
        return d, np.array([1 - b.sum(), *b]) @ self.rayon[self.T[f]], f

    def connexes(self, faces, f):
        """Parmi les triangles `faces` (ensemble), ceux que relie au triangle `f` une suite de triangles de `faces` à
        sommets soudés communs."""
        vus, pile = {f}, [f]
        while pile:
            for s in self.sommets_soudes[pile.pop()]:
                for t in self.triangles_du_sommet[s]:
                    if t in faces and t not in vus:
                        vus.add(t)
                        pile.append(t)
        return vus

    def relies(self, a, b):
        """Les pieds des points `a` et `b` sont-ils reliés par la peau à moins de leur écart plus `JUMEAU_M` du pied de
        `a` (`connexes`, au niveau le plus fin) ?"""
        ya, _, fa, _ = self.arbre.find_nearest(Vector(a))
        yb, _, fb, _ = self.arbre.find_nearest(Vector(b))
        _, kd, _, _, _, _, _, faces, _ = self.niveaux[0]
        proches = kd.find_range(ya, (ya - yb).length + JUMEAU_M)
        return fb in self.connexes({int(faces[j]) for _, j, _ in proches} | {fa, fb}, fa)

    def noyau(self, x, d, sigma, f):
        """Le noyau de largeur `sigma` en `x`, à la distance `d` de la peau, de pied sur le triangle `f` : les indices
        des échantillons retenus, leurs coefficients (de somme 1), leurs poids, leurs décalages et leurs rayons, au
        niveau de `sigma`."""
        _, kd, aires, We, De, Re, points, faces, du_pied = ([n for n in self.niveaux if n[0] <= sigma / 3]
                                                            or self.niveaux[:1])[-1]
        proches = kd.find_range(x, np.sqrt(9 * sigma ** 2 + d ** 2))
        lies = self.connexes({int(faces[j]) for _, j, _ in proches} | {f}, f)
        idx = np.array([j for _, j, _ in proches if faces[j] in lies] or [du_pied[f]])
        e2 = np.maximum(np.linalg.norm(points[idx] - x, axis=1) ** 2 - d ** 2, 0)
        k = aires[idx] * np.exp(-0.5 * e2 / sigma ** 2)
        return idx, k / k.sum(), We, De, Re

    def evaluer(self, X):
        """Par point de `X` (points, 3), monde, au repos : poids par os (points, os) et décalages monde
        `{nom: (points, 3)}`."""
        W = np.zeros((len(X), len(self.os)))
        D = np.zeros((len(X), self.D.shape[1]))
        for i, x in enumerate(X):
            d, rayon_au_pied, f = self.pied(x)
            idx, k, _, _, Re = self.noyau(x, d, max(rayon_au_pied, PAS_M), f)
            rayon = max(k @ Re[idx], PAS_M)
            au_dela = ALPHA * max(d - BANDE, 0.0)
            idx, k, _, De, _ = self.noyau(x, d, PAS_M + au_dela, f)
            D[i] = k @ De[idx]
            idx, k, We, _, _ = self.noyau(x, d, rayon + au_dela, f)
            W[i] = k @ We[idx]
        D = D.reshape(len(X), len(self.noms), 3)
        return garder_les_plus_forts(W), {n: D[:, j] for j, n in enumerate(self.noms)}


def distance_au_segment(X, segments):
    """Par point de `X` (points, 3), sa distance à son segment de `segments` (points, 2, 3)."""
    A, B = segments[:, 0], segments[:, 1]
    AB = B - A
    t = np.clip(np.einsum('ij,ij->i', X - A, AB) / np.maximum(np.einsum('ij,ij->i', AB, AB), 1e-12), 0, 1)
    return np.linalg.norm(X - (A + t[:, None] * AB), axis=1)


def echantillonner(P, T, valeurs, pas):
    """La peau (positions `P`, triangles `T`) échantillonnée au pas `pas` : chaque triangle découpé en n² sous-triangles
    égaux, n le plus petit entier qui ramène ses arêtes sous `pas` ; rend les centres des sous-triangles, leurs aires,
    les `valeurs` (par sommet de peau) interpolées en chacun par barycentres et l'indice de leur triangle."""
    A, B, C = P[T[:, 0]], P[T[:, 1]], P[T[:, 2]]
    n = np.maximum(1, np.ceil(np.max([np.linalg.norm(B - A, axis=1), np.linalg.norm(C - B, axis=1),
                                      np.linalg.norm(A - C, axis=1)], axis=0) / pas)).astype(int)
    aire = 0.5 * np.linalg.norm(np.cross(B - A, C - A), axis=1)
    points, aires, interpolees, faces = [], [], [], []
    for m in np.unique(n):
        f = np.flatnonzero(n == m)
        uv = [(i + 1 / 3, j + 1 / 3) for i in range(m) for j in range(m - i)]
        uv += [(i + 2 / 3, j + 2 / 3) for i in range(m - 1) for j in range(m - 1 - i)]
        uv = np.array(uv) / m
        b = np.column_stack([1 - uv.sum(axis=1), uv])
        points.append(np.einsum('sk,fkc->fsc', b, P[T[f]]).reshape(-1, 3))
        interpolees.append(np.einsum('sk,fkc->fsc', b, valeurs[T[f]]).reshape(-1, valeurs.shape[1]))
        aires.append(np.repeat(aire[f] / m ** 2, len(b)))
        faces.append(np.repeat(f, len(b)))
    return (np.concatenate(points), np.concatenate(aires), np.concatenate(interpolees).astype(np.float32),
            np.concatenate(faces))


def champ_de(base):
    """Le champ de la peau de `base` (`tissu.Base`) : toutes ses zones de peau au repos, leurs silhouettes et leurs clés
    `gabarit_*`, les os des `chaines` de son manifeste, les segments de ses os au repos."""
    zones = sorted(base.zones)
    porteur = base.porteur(zones)
    noms = {k for z in zones for k in noms_des_cles(base.zones[z])}
    absentes = [s for s in base.manifeste['silhouettes'] if s not in noms]
    if absentes:
        raise ValueError(f'silhouettes absentes de la peau de la base : {absentes}')
    cles = list(base.manifeste['silhouettes']) + sorted(k for k in noms if k.startswith('gabarit_'))

    def monde(objet, nom):
        if nom not in noms_des_cles(objet):
            return np.zeros((len(objet.data.vertices), 3))
        return decalages(objet, nom) @ np.array(objet.matrix_world)[:3, :3].T

    D = {n: np.concatenate([monde(base.zones[z], n) for z in zones]) for n in cles}
    chaines = {os_ for brins in base.manifeste['chaines'].values() for os_ in brins}
    M = base.rig.matrix_world
    os_ = base.rig.data.bones
    segments = np.array([[M @ os_[n].head_local, M @ os_[n].tail_local] for n in base.os])
    return Champ(porteur['P'], porteur['T'], porteur['W'], base.os, D, base.manifeste['silhouettes'], chaines, segments)


def skinne(objet):
    return objet.type == 'MESH' and any(m.type == 'ARMATURE' for m in objet.modifiers)


def egaliser(valeurs, groupes, fixes, origine):
    """`valeurs` (sommets, …) moyennées sur chaque groupe `groupes` (par sommet, l'indice de son groupe : nappes
    jumelles et sommets confondus), `origine` sur les sommets `fixes`."""
    effectif = np.bincount(groupes)
    plat = valeurs.reshape(len(valeurs), -1)
    moyenne = np.zeros((len(effectif), plat.shape[1]))
    np.add.at(moyenne, groupes, plat)
    egales = (moyenne / effectif[:, None])[groupes]
    return np.where(fixes[:, None], origine.reshape(plat.shape), egales).reshape(valeurs.shape)


def lisser_sur(valeurs, voisins, groupes, fixes, passes):
    """`valeurs` (sommets, …) lissées `passes` fois sur le graphe `voisins`, égales sur chaque groupe `groupes`,
    inchangées sur les sommets `fixes` (`egaliser`)."""
    v = egaliser(valeurs, groupes, fixes, valeurs)
    for _ in range(passes):
        v = egaliser(lisser(v, voisins, 1), groupes, fixes, valeurs)
    return v


def part_du_champ(d):
    """La part des poids du champ d'un sommet à la distance `d` (par sommet) de la peau : entière dans la `BANDE`,
    nulle au-delà de `BANDE` + `LARGEUR`, en smoothstep entre les deux."""
    t = np.clip((d - BANDE) / LARGEUR, 0, 1)
    return 1 - t * t * (3 - 2 * t)


def groupes_de(X, normales, champ):
    """Par sommet de `X` (points, 3), l'indice de son groupe : sommets confondus (`CONFONDUS_M`) et nappes jumelles (à
    moins de `JUMEAU_M`, normales `normales` opposées, pieds reliés par la peau de `champ`, `Champ.relies`), de proche
    en proche : deux doigts de gant qui se touchent ne sont pas deux nappes."""
    kd = KDTree(len(X))
    for i, p in enumerate(X):
        kd.insert(p, i)
    kd.balance()
    parent = np.arange(len(X))

    def racine(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i, p in enumerate(X):
        for _, j, e in kd.find_range(p, JUMEAU_M):
            if j != i and (e < CONFONDUS_M or normales[i] @ normales[j] < 0 and champ.relies(p, X[j])):
                parent[racine(i)] = racine(j)
    return np.unique([racine(i) for i in range(len(X))], return_inverse=True)[1].ravel()


def re_peser(objets, champ):
    """Pose sur les meshes skinnés de `objets`, une pièce, ses poids et les décalages de ses clés `gabarit_*` et
    silhouettes fondus avec ceux de `champ` : les clés pour une part nulle aux sommets de chaîne, les poids pour une
    part nulle aux sommets de chaîne et hors de la bande (`part_du_champ`), chaque part lissée à ses frontières, les
    poids égaux sur les nappes jumelles ; ses autres clés restent, comme tout sommet de part nulle."""
    pieces = [o for o in objets if skinne(o)]
    indice_os = {n: k for k, n in enumerate(champ.os)}
    X, N, Wp, en_chaine, triangles, cles = [], [], [], [], [], []
    for objet in pieces:
        M = np.array(objet.matrix_world)
        X.append(positions(objet.data) @ M[:3, :3].T + M[:3, 3])
        n = np.empty(len(objet.data.vertices) * 3)
        objet.data.vertices.foreach_get('normal', n)
        n = n.reshape(-1, 3) @ np.linalg.inv(M[:3, :3])
        N.append(n / np.linalg.norm(n, axis=1, keepdims=True))
        noms = {g.index: g.name for g in objet.vertex_groups}
        w = np.zeros((len(objet.data.vertices), len(champ.os)))
        for v in objet.data.vertices:
            for g in v.groups:
                if noms[g.group] not in indice_os:
                    raise ValueError(f'{objet.name} : os {noms[g.group]} absent de la base')
                w[v.index, indice_os[noms[g.group]]] = g.weight
        Wp.append(w)
        en_chaine.append(np.array([any(noms[g.group] in champ.os_de_chaine and g.weight > 0 for g in v.groups)
                                   for v in objet.data.vertices]))
        objet.data.calc_loop_triangles()
        decalage = sum(len(x) for x in X[:-1])
        triangles += [tuple(decalage + s for s in t.vertices) for t in objet.data.loop_triangles]
        cles.append([n for n in noms_des_cles(objet) if n.startswith('gabarit_') or n in champ.silhouettes])
        sans_champ = [n for n in cles[-1] if n not in champ.noms]
        if sans_champ:
            raise ValueError(f'{objet.name} : clés sans champ sur la peau de la base : {sans_champ}')
    X, N, W_publies, en_chaine = np.concatenate(X), np.concatenate(N), np.concatenate(Wp), np.concatenate(en_chaine)
    voisins, groupes = voisinage(triangles, len(X)), groupes_de(X, N, champ)
    part = lisser_sur(np.where(en_chaine, 0.0, 1.0), voisins, groupes, en_chaine, PASSES)
    d = np.array([champ.pied(x)[0] for x in X])
    part_des_poids = lisser_sur(np.where(en_chaine, 0.0, part_du_champ(d)), voisins, groupes, en_chaine, PASSES)
    suit = np.flatnonzero(part > 0)
    W_champ, D_champ = champ.evaluer(X[suit])
    fondu = part_des_poids[suit, None]
    W = W_publies.copy()
    W[suit] = fondu * W_champ + (1 - fondu) * W_publies[suit]
    W = egaliser(W, groupes, part_des_poids == 0, W_publies)
    melanges = np.flatnonzero(part_des_poids > 0)
    W[melanges] = garder_les_plus_forts(W[melanges])
    debut = 0
    for objet, noms in zip(pieces, cles):
        fin = debut + len(objet.data.vertices)
        dans = (suit >= debut) & (suit < fin)
        locaux, M = suit[dans] - debut, np.array(objet.matrix_world)[:3, :3]
        for nom in noms:
            propre = decalages(objet, nom) @ M.T
            propre[locaux] = part[suit[dans], None] * D_champ[nom][dans] + (1 - part[suit[dans], None]) * propre[locaux]
            poser_la_cle(objet, nom, propre @ np.linalg.inv(M).T)
        poser_les_poids(objet, W[debut:fin], champ.os, locaux)
        debut = fin


def poser_les_poids(objet, W, os_, sommets):
    """Remplace les groupes de sommets des `sommets` de `objet` par leurs poids `W` (sommets de l'objet, os `os_`)."""
    a_changer = sommets.tolist()
    for groupe in objet.vertex_groups:
        groupe.remove(a_changer)
    groupes = {g.name: g for g in objet.vertex_groups}
    for k in np.flatnonzero(W[sommets].any(axis=0)):
        groupe = groupes.get(os_[k]) or objet.vertex_groups.new(name=os_[k])
        for i in sommets[W[sommets, k] > 0]:
            groupe.add([int(i)], float(W[i, k]), 'REPLACE')
