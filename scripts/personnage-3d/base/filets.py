"""Les filets de tissu de la base (#3842) : la jupe et la cape, des brins d'os pendus autour du corps, que pondèrent les
vêtements amples. `draper` pose leurs os sur le GLB exporté de la base, au repos sur le corps, et écrit leurs pistes
dans chaque clip : le drapé en tente (`tente.py`) sur la peau posée de chaque image. `filets_au_repos` relit d'un GLB
drapé ce qu'un élément en attend : les os et les articulations au repos de chaque filet.
Repère de l'armature : +Z le haut, -Y l'avant, +X la gauche du personnage.
"""
import numpy as np

import tente
from glb import ecrire_glb, lire_accesseur, lire_glb
from seuils import IMAGES_PAR_SECONDE

ARMATURE = np.array([[1.0, 0.0, 0.0], [0.0, 0.0, -1.0], [0.0, 1.0, 0.0]])
"""Du repère glTF (+Y le haut) à celui de l'armature."""
GROUPES = {'cuisses': [f'{z}_{c}' for z in ('cuisse', 'genou') for c in 'gd'],
           'mollets': [f'mollet_{c}' for c in 'gd'], 'pieds': [f'pied_{c}' for c in 'gd'],
           'bassin': ['hanches'], 'tronc': ['torse'],
           'bras': [f'{z}_{c}' for z in ('bras_haut', 'avant_bras', 'main') for c in 'gd']}
"""Par groupe de peau que voit un filet, ses zones du corps."""
TOUR = ('avant', 'avant_avant_g', 'avant_g', 'g_avant_g', 'g', 'g_arriere_g', 'arriere_g', 'arriere_arriere_g', 'arriere',
        'arriere_arriere_d', 'arriere_d', 'd_arriere_d', 'd', 'd_avant_d', 'avant_d', 'avant_avant_d')
"""Les brins d'un tour complet, de l'avant vers la gauche."""
FILETS = (
    {'nom': 'jupe', 'porteur': 'pelvis', 'ferme': True, 'os': 3, 'evasement': 1.8,
     'brins': tuple((brin, 360.0 * i / len(TOUR)) for i, brin in enumerate(TOUR)),
     'dedans': ('pieds',), 'cede': ('mollets', 'cuisses', 'bassin'), 'dehors': ('bras',), 'sur': ()},
    {'nom': 'cape', 'porteur': 'spine_03', 'ferme': False, 'os': 4, 'evasement': 1.3,
     'brins': tuple((TOUR[i], 360.0 * i / len(TOUR)) for i in range(5, 12)),
     'dedans': ('tronc', 'bassin', 'cuisses', 'mollets', 'pieds'), 'cede': (), 'dehors': ('bras',), 'sur': ('jupe',)},
)
"""Les filets, dans l'ordre où ils se drapent. `porteur` : l'os qui porte les racines ; `os` : os par brin ; `brins` :
`(nom, azimut en degrés depuis l'avant, vers la gauche)` ; `evasement` : rapport du rayon de l'ourlet à celui des
racines ; `dedans`, `cede`, `dehors` : les groupes de peau de chaque côté (`tente.py`) ; `sur` : les filets qu'il
recouvre."""
JEU_RACINE_M = 0.02
"""Écart, en mètres, entre la peau au repos et le polygone des racines."""
CHEVILLE_M = 0.1
"""Hauteur de l'ourlet des filets au-dessus de la cheville, en mètres."""
COUCHE_M = 0.02
"""Rayon, en mètres, des points d'un filet sous celui qui le recouvre, et leur écart le plus grand le long d'une maille."""
SOUS_LA_CLAVICULE_M = 0.03
"""Hauteur des racines de la cape sous les clavicules, en mètres."""
COUVERCLE_M = 0.01
"""Distance à l'axe du filet du dessus, en mètres, du point qui ferme en haut le filet recouvert sous chacune de ses
racines (`Monte.surface`)."""
BALAYAGE = 3
"""Instants par image où se lit la peau du dehors d'une image à ses voisines : le tissu d'une image passe sous tout ce
que la main balaie depuis l'image d'avant et jusqu'à celle d'après, et le tissu d'entre deux images, fondu des deux,
reste sous elle."""
APLOMB = (0.2, 0.7)
"""Hauteurs de l'axe vertical du porteur (son +Z au repos, 1 : debout) entre lesquelles les plans des brins passent de
ceux du porteur à l'aplomb, et le sol remonte de `COUCHE_SOUS_LE_SOL_M` à `tente.SOL_M`."""
COUCHE_SOUS_LE_SOL_M = 2.0
"""Profondeur, en mètres, du sol d'un filet dont le porteur est couché : le corps repose sur son tissu."""


def unitaire(v):
    return v / np.linalg.norm(v)


def matrice(q):
    """La rotation 3×3 du quaternion `q` (x, y, z, w)."""
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


def quaternion(m):
    """Le quaternion unitaire (x, y, z, w) de la rotation 3×3 `m`."""
    t = np.trace(m)
    if t > 0:
        s = np.sqrt(t + 1.0) * 2
        q = [(m[2, 1] - m[1, 2]) / s, (m[0, 2] - m[2, 0]) / s, (m[1, 0] - m[0, 1]) / s, 0.25 * s]
    elif m[0, 0] > m[1, 1] and m[0, 0] > m[2, 2]:
        s = np.sqrt(1.0 + m[0, 0] - m[1, 1] - m[2, 2]) * 2
        q = [0.25 * s, (m[0, 1] + m[1, 0]) / s, (m[0, 2] + m[2, 0]) / s, (m[2, 1] - m[1, 2]) / s]
    elif m[1, 1] > m[2, 2]:
        s = np.sqrt(1.0 + m[1, 1] - m[0, 0] - m[2, 2]) * 2
        q = [(m[0, 1] + m[1, 0]) / s, 0.25 * s, (m[1, 2] + m[2, 1]) / s, (m[0, 2] - m[2, 0]) / s]
    else:
        s = np.sqrt(1.0 + m[2, 2] - m[0, 0] - m[1, 1]) * 2
        q = [(m[0, 2] + m[2, 0]) / s, (m[1, 2] + m[2, 1]) / s, 0.25 * s, (m[1, 0] - m[0, 1]) / s]
    return unitaire(np.array(q))


def tour(a, b, part=1.0):
    """La rotation la plus courte de l'unitaire `a` vers l'unitaire `b`, ou sa fraction `part`."""
    v = np.cross(a, b)
    s, c = np.linalg.norm(v), float(np.dot(a, b))
    if s < 1e-9:
        return np.eye(3)
    k = v / s
    K = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
    angle = np.arctan2(s, c) * part
    return np.eye(3) + np.sin(angle) * K + (1 - np.cos(angle)) * K @ K


def orthonormer(m):
    """La rotation la plus proche de la matrice 3×3 `m`."""
    u, _, vt = np.linalg.svd(m)
    if np.linalg.det(u @ vt) < 0:
        u[:, -1] *= -1
    return u @ vt


def fondu(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def repere_d_os(direction, dehors):
    """La rotation d'un os de direction `direction` (son +Y), son +Z au plus près de `dehors`."""
    y = unitaire(direction)
    z = unitaire(dehors - (dehors @ y) * y)
    return np.column_stack([np.cross(y, z), y, z])


def os_de(filet, brin, k):
    """Le nom du `k`-ième os (de 1) du brin `brin` de `filet`."""
    return '_'.join(x for x in (filet['nom'], brin, f'{k:02d}') if x)


def os_des_brins(filet):
    return [[os_de(filet, brin, k) for k in range(1, filet['os'] + 1)] for brin, _ in filet['brins']]


class Squelette:
    """Le squelette et les clips d'un GLB : cinématique directe dans le repère de l'armature, pose d'os et de pistes."""

    def __init__(self, chemin):
        self.document, binaire = lire_glb(chemin)
        self.binaire = bytearray(binaire)
        self.noeuds = self.document['nodes']
        self.indice = {n['name']: i for i, n in enumerate(self.noeuds)}
        self.parent = {enfant: i for i, n in enumerate(self.noeuds) for enfant in n.get('children', [])}
        self.clips = {a['name']: a for a in self.document.get('animations', [])}
        self.peau, = self.document['skins']
        self.lus = {}
        self.liaisons = self.lire(self.peau['inverseBindMatrices']).reshape(-1, 16).tolist()

    def lire(self, accesseur):
        if accesseur not in self.lus:
            self.lus[accesseur] = lire_accesseur(self.document, self.binaire, accesseur)
        return self.lus[accesseur]

    def pistes(self, clip):
        """Par (noeud, chemin) animé de `clip`, ses instants et ses valeurs ; refuse une piste qui n'est pas LINEAR."""
        action = self.clips[clip]
        if any(s.get('interpolation', 'LINEAR') != 'LINEAR' for s in action['samplers']):
            raise ValueError(f'{clip} : piste non LINEAR')
        return {(c['target']['node'], c['target']['path']): (self.lire(action['samplers'][c['sampler']]['input']).reshape(-1),
                                                             self.lire(action['samplers'][c['sampler']]['output']))
                for c in action['channels']}

    def locale(self, pistes, i, t):
        noeud = self.noeuds[i]
        valeurs = {chemin: np.array(noeud.get(chemin, repos), float)
                   for chemin, repos in (('translation', (0, 0, 0)), ('rotation', (0, 0, 0, 1)), ('scale', (1, 1, 1)))}
        for chemin in valeurs:
            if (i, chemin) not in pistes:
                continue
            instants, cles = pistes[(i, chemin)]
            k = int(np.searchsorted(instants, t, side='right')) - 1
            if k < 0 or k >= len(instants) - 1:
                valeurs[chemin] = cles[max(0, min(k, len(instants) - 1))]
                continue
            f = (t - instants[k]) / (instants[k + 1] - instants[k])
            a, b = cles[k], cles[k + 1]
            if chemin != 'rotation':
                valeurs[chemin] = a * (1 - f) + b * f
                continue
            if np.dot(a, b) < 0:
                b = -b
            angle = np.arccos(min(1.0, float(np.dot(a, b))))
            v = a * (1 - f) + b * f if angle < 1e-6 else (np.sin((1 - f) * angle) * a + np.sin(f * angle) * b) / np.sin(angle)
            valeurs[chemin] = unitaire(v)
        m = np.eye(4)
        m[:3, :3] = matrice(valeurs['rotation']) * valeurs['scale'][None, :]
        m[:3, 3] = valeurs['translation']
        return m

    def monde(self, pistes, t, noms):
        """Par nom de `noms`, la matrice monde 4×4 du noeud à l'instant `t` de `pistes` (`{}` : au repos)."""
        mondes = {}

        def monde(i):
            if i not in mondes:
                locale = self.locale(pistes, i, t)
                mondes[i] = monde(self.parent[i]) @ locale if i in self.parent else locale
            return mondes[i]
        vers_l_armature = np.eye(4)
        vers_l_armature[:3, :3] = ARMATURE
        return {n: vers_l_armature @ monde(self.indice[n]) for n in noms}

    def ajouter_accesseur(self, tableau, type_):
        tableau = np.asarray(tableau, '<f4')
        self.binaire += b'\0' * (-len(self.binaire) % 4)
        self.document['bufferViews'].append({'buffer': 0, 'byteOffset': len(self.binaire), 'byteLength': tableau.nbytes})
        self.binaire += tableau.tobytes()
        accesseur = {'bufferView': len(self.document['bufferViews']) - 1, 'componentType': 5126, 'count': len(tableau), 'type': type_}
        if type_ == 'SCALAR':
            accesseur['min'], accesseur['max'] = [float(tableau.min())], [float(tableau.max())]
        self.document['accessors'].append(accesseur)
        return len(self.document['accessors']) - 1

    def poser_un_os(self, nom, parent, monde):
        """Pose l'os `nom` sous l'os `parent`, de matrice monde `monde` au repos (armature) : son noeud, joint de la peau ; un os déjà posé se repose."""
        vers_l_armature = np.eye(4)
        vers_l_armature[:3, :3] = ARMATURE
        monde_gltf = np.linalg.inv(vers_l_armature) @ monde
        locale = np.linalg.inv(self.monde({}, 0.0, [parent])[parent]) @ monde
        pose = {'translation': locale[:3, 3].tolist(), 'rotation': quaternion(locale[:3, :3]).tolist()}
        if nom in self.indice:
            i = self.indice[nom]
            self.noeuds[i].update(pose)
            self.noeuds[self.parent[i]]['children'].remove(i)
        else:
            i = len(self.noeuds)
            self.noeuds.append({'name': nom, **pose})
            self.indice[nom] = i
            self.peau['joints'].append(i)
            self.liaisons.append(None)
        self.parent[i] = self.indice[parent]
        self.noeuds[self.indice[parent]].setdefault('children', []).append(i)
        self.liaisons[self.peau['joints'].index(i)] = np.linalg.inv(monde_gltf).T.reshape(16).tolist()

    def ecrire_piste(self, clip, nom, instants, quaternions):
        """Écrit dans `clip` la piste de rotation LINEAR de l'os `nom` : `instants`, un accesseur, et ses `quaternions`."""
        action = self.clips[clip]
        action['samplers'].append({'input': instants, 'output': self.ajouter_accesseur(quaternions, 'VEC4'), 'interpolation': 'LINEAR'})
        cible = {'node': self.indice[nom], 'path': 'rotation'}
        canal = next((c for c in action['channels'] if c['target'] == cible), None)
        if canal is None:
            canal = {'target': cible}
            action['channels'].append(canal)
        canal['sampler'] = len(action['samplers']) - 1

    def ecrire(self, chemin):
        self.peau['inverseBindMatrices'] = self.ajouter_accesseur(self.liaisons, 'MAT4')
        ecrire_glb(chemin, self.document, self.binaire)


class Peau:
    """La peau du corps par groupe : ses sommets, que posent ses os, leur os dominant et ses arêtes."""

    def __init__(self, squelette, corps):
        """`corps` : le nom de l'objet du corps, dont chaque zone est le mesh `<corps>-<zone>`."""
        document = squelette.document
        self.os = [squelette.noeuds[j]['name'] for j in squelette.peau['joints']]
        self.liaisons = np.array(squelette.liaisons).reshape(-1, 4, 4).transpose(0, 2, 1)
        self.groupes, self.aretes, self.dominants = {}, {}, {}
        for groupe, zones in GROUPES.items():
            P, J, W, A, n = [], [], [], [], 0
            for zone in zones:
                primitive, = document['meshes'][squelette.noeuds[squelette.indice[f'{corps}-{zone}']]['mesh']]['primitives']
                P.append(squelette.lire(primitive['attributes']['POSITION']))
                J.append(squelette.lire(primitive['attributes']['JOINTS_0']).astype(int))
                W.append(squelette.lire(primitive['attributes']['WEIGHTS_0']))
                t = squelette.lire(primitive['indices']).astype(int).reshape(-1, 3)
                A.append(np.unique(np.sort(np.concatenate([t[:, [0, 1]], t[:, [1, 2]], t[:, [2, 0]]]), axis=1), axis=0) + n)
                n += len(P[-1])
            P, J, W = np.concatenate(P), np.concatenate(J), np.concatenate(W)
            self.groupes[groupe] = (np.c_[P, np.ones(len(P))], J, W)
            self.aretes[groupe] = np.concatenate(A)
            self.dominants[groupe] = np.array(self.os)[J[np.arange(len(J)), W.argmax(axis=1)]]
        self.utiles = sorted({int(j) for _, J, W in self.groupes.values() for j in np.unique(J[W > 0])})

    def poser(self, squelette, pistes, t, porteurs, groupes=None):
        """Les matrices monde des os de la peau et des `porteurs`, et par groupe ses sommets posés ; `groupes` : ceux
        à poser, tous sans lui."""
        mondes = squelette.monde(pistes, t, [self.os[j] for j in self.utiles] + porteurs)
        M = np.zeros((len(self.os), 4, 4))
        for j in self.utiles:
            M[j] = mondes[self.os[j]] @ self.liaisons[j]
        return mondes, {g: np.einsum('vk,vkij,vj->vi', W, M[J], P)[:, :3] for g, (P, J, W) in self.groupes.items() if groupes is None or g in groupes}


def plan(squelette, filet, P, dominants):
    """Le filet dessiné (S, K+1, 3) et son axe (x, y) : le polygone de ses racines contient le contour du corps à leur
    hauteur, ses brins s'évasent en ligne droite jusqu'à l'ourlet. `P` : les sommets du corps au repos, `dominants` :
    leur os dominant."""
    repos = squelette.monde({}, 0.0, ['thigh_l', 'foot_l', 'clavicle_l'])
    hanche, cheville = repos['thigh_l'][:3, 3], repos['foot_l'][:3, 3]
    hanches = P[np.isin(dominants, ['pelvis', 'thigh_l', 'thigh_r', 'spine_01']) & (P[:, 2] > hanche[2] - 0.18) & (P[:, 2] < hanche[2] + 0.12)]
    centre = np.array([0.0, float((hanches[:, 1].min() + hanches[:, 1].max()) / 2), 0.0])
    if filet['porteur'] == 'pelvis':
        contour = hanches
        haut_de_cuisse = P[(dominants == 'thigh_l') & (P[:, 2] > hanche[2] - 0.1)] - hanche
        z_racines = float(hanche[2] + np.linalg.norm(haut_de_cuisse[:, 1:], axis=1).max() + tente.JEU_M)
    else:
        z_racines = float(repos['clavicle_l'][2, 3] - SOUS_LA_CLAVICULE_M)
        contour = P[np.isin(dominants, ['spine_02', 'spine_03', 'clavicle_l', 'clavicle_r']) & (np.abs(P[:, 2] - z_racines) < 0.08)]
    z_ourlet = float(cheville[2] + CHEVILLE_M)
    azimuts = np.radians([a for _, a in filet['brins']])
    d = np.column_stack([np.sin(azimuts), -np.cos(azimuts), np.zeros(len(azimuts))])
    rayons = ((contour - centre) @ d.T).max(axis=0)
    for a, b in [(s, (s + 1) % len(d)) for s in range(len(d) if filet['ferme'] else len(d) - 1)]:
        m = unitaire(d[a] + d[b])
        face = float(((contour - centre) @ m).max() / (d[a] @ m))
        rayons[a], rayons[b] = max(rayons[a], face), max(rayons[b], face)
    rayons += JEU_RACINE_M
    K = filet['os']
    return np.array([[centre + d[s] * (rayons[s] * (1 + (filet['evasement'] - 1) * k / K)) + np.array([0, 0, z_racines + (z_ourlet - z_racines) * k / K])
                      for k in range(K + 1)] for s in range(len(d))]), centre[:2]


class Monte:
    """Un filet monté sur la base : sa tente, ses os posés au repos, ses racines et son axe dans le repère de son
    porteur, la peau qui lui vient du dehors, et ses mailles subdivisées pour le filet qui le recouvre."""

    def __init__(self, squelette, filet, peau, dessous):
        self.filet, self.peau = filet, peau
        mondes, sommets = peau.poser(squelette, {}, 0.0, [filet['porteur']])
        dessin, centre = plan(squelette, filet, np.concatenate(list(sommets.values())), np.concatenate([peau.dominants[g] for g in sommets]))
        self.tente = tente.Tente(dessin, centre, filet['ferme'])
        self.dehors = {}
        for g in filet['dehors']:
            garde = ~self.tente.sous_le_dessin(sommets[g])
            aretes = peau.aretes[g][garde[peau.aretes[g]].all(axis=1)]
            self.dehors[g] = (garde, (np.cumsum(garde) - 1)[aretes])
        n = filet['os'] + 1
        a, b = self.tente.faces[:, 0] * n, self.tente.faces[:, 1] * n
        brins = np.arange(len(dessin) * n).reshape(-1, n)
        mailles = np.concatenate([np.column_stack([brins[:, :-1].ravel(), brins[:, 1:].ravel()])]
                                 + [np.column_stack([a + i, b + j]) for i, j in [(k, k) for k in range(n)] + [(k, k + 1) for k in range(n - 1)]])
        porteur = mondes[filet['porteur']]
        inverse = np.linalg.inv(porteur)
        self.locales = np.vstack([dessin[:, 0], self.tente.axe]) @ inverse[:3, :3].T + inverse[:3, 3]
        self.porteur_au_repos = orthonormer(porteur[:3, :3])
        self.repos, _ = self.tente.poser(*self.etat(mondes, sommets, [(m, m.repos) for m in dessous], [])[0], None, 0.0)
        bouts = np.vstack([self.repos.reshape(-1, 3), np.tile(self.tente.axe, (len(dessin), 1))])
        de, vers, part, self.aretes = [], [], [], []
        for i, j in np.vstack([mailles, np.column_stack([brins[:, 0], brins.size + np.arange(len(dessin))])]):
            pas = int(np.ceil(np.linalg.norm(bouts[i] - bouts[j]) / COUCHE_M))
            chaine = [i, *range(len(bouts) + len(de), len(bouts) + len(de) + pas - 1), j]
            self.aretes += zip(chaine, chaine[1:])
            de += [i] * (pas - 1)
            vers += [j] * (pas - 1)
            part += [k / pas for k in range(1, pas)]
        self.subdivision = np.array(de), np.array(vers), np.array(part)[:, None]
        self.aretes = np.array(self.aretes)
        segments = self.repos[:, 1:] - self.repos[:, :-1]
        self.directions = segments / np.linalg.norm(segments, axis=2, keepdims=True)
        self.repos_des_os = {}
        for s, noms in enumerate(os_des_brins(filet)):
            parent = filet['porteur']
            dehors = unitaire((self.repos[s, -1] - self.repos[s, 0]) * np.array([1, 1, 0]))
            for k, nom in enumerate(noms):
                monde = np.eye(4)
                monde[:3, :3] = repere_d_os(segments[s, k], dehors)
                monde[:3, 3] = self.repos[s, k]
                squelette.poser_un_os(nom, parent, monde)
                self.repos_des_os[nom] = monde[:3, :3]
                parent = nom

    def surface(self, x, O, haut):
        """Le filet posé `x` vu du filet d'axe (`O`, `haut`) qui le recouvre : ses articulations, son couvercle (de chaque
        racine au point de même hauteur à `COUVERCLE_M` de l'axe), et leurs mailles en points distants de `COUCHE_M` au
        plus. Rend les points et leurs arêtes."""
        pieds = O + ((x[:, 0] - O) @ haut)[:, None] * haut
        bouts = np.vstack([x.reshape(-1, 3), pieds + COUVERCLE_M * (x[:, 0] - pieds) / np.linalg.norm(x[:, 0] - pieds, axis=1, keepdims=True)])
        de, vers, part = self.subdivision
        return np.vstack([bouts, bouts[de] + part * (bouts[vers] - bouts[de])]), self.aretes

    def etat(self, mondes, sommets, dessous, balayage):
        """L'image du filet sous les matrices monde `mondes` et la peau posée `sommets` : ce qu'attend `Tente.poser`
        (racines, point de l'axe, repère d'aplomb, obstacles, sol), et la rotation de son porteur. `dessous` : par filet
        recouvert, son montage et ses articulations posées. `balayage` : les matrices monde et la peau du dehors
        d'instants voisins (`BALAYAGE`), ramenées au porteur de l'image là où elle a bougé de plus de `tente.JEU_M`."""
        porteur = mondes[self.filet['porteur']]
        points = self.locales @ porteur[:3, :3].T + porteur[:3, 3]
        rotation = orthonormer(porteur[:3, :3])
        D = rotation @ self.porteur_au_repos.T
        debout = unitaire(D @ tente.HAUT)
        aplomb = fondu((debout[2] - APLOMB[0]) / (APLOMB[1] - APLOMB[0]))
        Q = tour(debout, tente.HAUT, aplomb) @ D
        surfaces = [(cote, 0.0, sommets[g], self.peau.aretes[g]) for cote, cle in ((tente.DEDANS, 'dedans'), (tente.CEDE, 'cede')) for g in self.filet[cle]]
        for g, (garde, aretes) in self.dehors.items():
            surfaces.append((tente.DEHORS, 0.0, sommets[g][garde], aretes))
            for mondes_voisins, voisine in balayage:
                vers_l_image = porteur @ np.linalg.inv(mondes_voisins[self.filet['porteur']])
                P = voisine[g][garde] @ vers_l_image[:3, :3].T + vers_l_image[:3, 3]
                if np.abs(P - sommets[g][garde]).max() > tente.JEU_M:
                    surfaces.append((tente.DEHORS, 0.0, P, aretes))
        surfaces += [(tente.DEDANS, COUCHE_M, *monte.surface(x, points[-1], Q @ tente.HAUT)) for monte, x in dessous]
        rangs = np.cumsum([0] + [len(P) for _, _, P, _ in surfaces[:-1]])
        obstacles = (np.concatenate([P for _, _, P, _ in surfaces]), np.concatenate([np.full(len(P), rayon) for _, rayon, P, _ in surfaces]),
                     np.concatenate([np.full(len(P), cote) for cote, _, P, _ in surfaces]), np.concatenate([A + n for (_, _, _, A), n in zip(surfaces, rangs)]))
        return (points[:-1], points[-1], Q, obstacles, tente.SOL_M - (1 - aplomb) * COUCHE_SOUS_LE_SOL_M), rotation

    def rotations(self, x, Q, porteur):
        """Par os, son quaternion local quand les articulations du filet sont en `x` : chaque os porté sur sa direction
        par la rotation la plus courte depuis son repos tourné de `Q`."""
        rotations = {}
        for s, noms in enumerate(os_des_brins(self.filet)):
            parent = porteur
            for k, nom in enumerate(noms):
                monde = tour(Q @ self.directions[s, k], unitaire(x[s, k + 1] - x[s, k])) @ Q @ self.repos_des_os[nom]
                rotations[nom] = quaternion(parent.T @ monde)
                parent = monde
        return rotations


def draper(chemin, corps):
    """Pose sur le GLB `chemin` de la base les os des filets et, dans chaque clip, leurs pistes, une clé par image de
    `IMAGES_PAR_SECONDE`. `corps` : le nom de l'objet du corps. Rend le manifeste `chaines` des filets."""
    squelette = Squelette(chemin)
    peau = Peau(squelette, corps)
    montes = {}
    for filet in FILETS:
        montes[filet['nom']] = Monte(squelette, filet, peau, [montes[n] for n in filet['sur']])
    porteurs = sorted({filet['porteur'] for filet in FILETS})
    balayes = {g for filet in FILETS for g in filet['dehors']}
    for clip in squelette.clips:
        pistes = squelette.pistes(clip)
        duree = max(instants[-1] for instants, _ in pistes.values())
        temps = np.arange(round(duree * IMAGES_PAR_SECONDE) + 1) / IMAGES_PAR_SECONDE
        instants = squelette.ajouter_accesseur(temps.reshape(-1, 1), 'SCALAR')
        corps_poses = [peau.poser(squelette, pistes, t, porteurs) for t in temps]
        sous = [[peau.poser(squelette, pistes, t + k / (BALAYAGE * IMAGES_PAR_SECONDE), porteurs, balayes) for k in range(1, BALAYAGE)] for t in temps[:-1]]
        boucle = clip.endswith('_Loop')

        def voisines(i):
            """La peau des instants de l'intervalle d'avant l'image `i` et de celui d'après, images voisines comprises ;
            un clip en boucle se referme."""
            avant, apres = ((i - 1) % len(sous), i % len(sous)) if boucle and sous else (i - 1, i)
            return ([corps_poses[avant], *sous[avant]] if 0 <= avant < len(sous) else []) + ([*sous[apres], corps_poses[apres + 1]] if 0 <= apres < len(sous) else [])

        poses = {}
        for nom, monte in montes.items():
            etats = [monte.etat(mondes, sommets, [(montes[n], poses[n][i]) for n in monte.filet['sur']], voisines(i)) for i, (mondes, sommets) in enumerate(corps_poses)]
            poses[nom] = tente.cuire(monte.tente, [etat for etat, _ in etats], temps, boucle)
            cles = {}
            for x, (etat, porteur) in zip(poses[nom], etats):
                for os_, q in monte.rotations(x, etat[2], porteur).items():
                    cles.setdefault(os_, []).append(-q if cles.get(os_) and np.dot(cles[os_][-1], q) < 0 else q)
            for os_, quaternions in cles.items():
                squelette.ecrire_piste(clip, os_, instants, quaternions)
        print('FILETS', clip, len(temps), 'image(s)', flush=True)
    squelette.ecrire(chemin)
    return {filet['nom']: [os_ for brin in os_des_brins(filet) for os_ in brin] for filet in FILETS}


def filets_au_repos(chemin):
    """Par filet du GLB drapé `chemin` : `os`, par brin, ses os ; `ferme` ; `brins` (S, K+1, 3), ses articulations au
    repos dans le repère de l'armature ; `axe` (x, y), l'axe vertical où se coupent les plans de ses brins."""
    squelette = Squelette(chemin)
    filets = {}
    for filet in FILETS:
        noms = os_des_brins(filet)
        mondes = squelette.monde({}, 0.0, [os_ for brin in noms for os_ in brin])
        brins = []
        for brin in noms:
            tetes = [mondes[os_][:3, 3] for os_ in brin]
            brins.append(tetes + [tetes[-1] + np.linalg.norm(tetes[-1] - tetes[-2]) * mondes[brin[-1]][:3, 1]])
        brins = np.array(brins)
        hors = brins[:, -1, :2] - brins[:, 0, :2]
        normales = np.column_stack([-hors[:, 1], hors[:, 0]])
        axe = np.linalg.lstsq(normales, np.einsum('sc,sc->s', normales, brins[:, 0, :2]), rcond=None)[0]
        filets[filet['nom']] = {'os': noms, 'ferme': filet['ferme'], 'brins': brins, 'axe': axe}
    return filets
