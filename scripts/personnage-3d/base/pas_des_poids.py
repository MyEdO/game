"""#3104 issuecomment-6565228921 : le pas des poids, moindre déplacement sous plans coupants, et le noyau de mesure par lot
que `poids.extremes` réduit en extremes et `Region.balayer` en violations. Sans `bpy` : numpy et les seuils. Le QP
propose, `poids.extremes` décide (`poids.avancer_correction`)."""
import os
from concurrent.futures import ThreadPoolExecutor
from typing import NamedTuple

import numpy

from seuils import ETIREMENT_DES_CLES, ETIREMENT_EN_CLIP, INFLUENCES_MAX, MAJORITE_DU_POIDS, POIDS_NEGLIGEABLE

LOT = 64
"""Échantillons déformés ensemble."""
GROUPES_PARALLELES_MAX = 4
"""#3104 : plafond fixe pour partager la machine entre sessions. Sur la capture de 13 groupes, quatre fils mesurent
3,22 Go et 5,50 s par lot, huit fils 5,50 Go et 4,63 s, treize fils 8,37 Go. Le gain mural de huit fils (16 %) demande
2,22 Go de plus ; le plafond garde cette marge et ne suit pas la mémoire disponible."""
ANNEAUX_MAX = 9
"""Budget de solveur : anneaux essayés autour de l'arête, au-delà le pas refuse."""
MARGE_PLAN_BAS, MARGE_PLAN_HAUT = 1.02, 0.995
"""Réglage de solveur : facteur des bornes dans les plans."""
MARGE_BALAYAGE_BAS, MARGE_BALAYAGE_HAUT = 1.01, 0.9975
"""Réglage de solveur : facteur des bornes de clip au balayage, moins exigeant que les plans. La clause repos se balaie à
ses bornes exactes : #3104 issuecomment-6568295594."""
MARGE_DU_PIED = 1e-4
"""Réglage de solveur : écart tenu sous `MAJORITE_DU_POIDS` par le plan de pied."""
INSTANTS_PAR_ARETE, ECART_ENTRE_INSTANTS = 8, 3
"""Réglage de solveur : pires instants retenus par source, côté, arête et clause (`retenir`), et leur espacement."""
TOURS_MAX = 60
"""Réglage de solveur : balayages d'une résolution."""
ITERATIONS_MAX = 20000
"""Réglage de solveur : itérations cumulées d'un appel à `plus_proche`."""
TOLERANCE_PLAN = 1e-10
"""Réglage de solveur : violation d'un plan normé tenue pour nulle."""


def par_groupes(fonction, groupes):
    """`fonction` sur chaque groupe, dans l'ordre, sur `GROUPES_PARALLELES_MAX` fils au plus."""
    groupes = list(groupes)
    if len(groupes) < 2:
        return list(map(fonction, groupes))
    with ThreadPoolExecutor(max_workers=min(len(groupes), GROUPES_PARALLELES_MAX, os.cpu_count() or 1)) as executeur:
        return list(executeur.map(fonction, groupes))


def melanges_par_lots(w, matrices):
    """Par lot de `LOT` échantillons de `matrices` de peau, la matrice de chaque sommet mélangée par ses poids `w`,
    réduite à ses trois premières lignes : (sommets, lot, 3, 4)."""
    for k in range(0, len(matrices), LOT):
        lot = matrices[k:k + LOT]
        n = len(lot)
        yield (w @ lot.transpose(1, 0, 2, 3).reshape(lot.shape[1], n * 16)).reshape(len(w), n, 4, 4)[:, :, :3, :]


def piles_distinctes(piles):
    """Les piles distinctes de `piles`, une par état d'un groupe, par identité d'objet dans l'ordre de première
    apparition, chacune avec les indices des états qui la portent : `[(pile, états)]`."""
    distinctes = {}
    for e, pile in enumerate(piles):
        distinctes.setdefault(id(pile), (pile, []))[1].append(e)
    return list(distinctes.values())


def appliquer(melange, x):
    """Les sommets `x` (homogènes) sous leurs matrices mélangées `melange` (`melanges_par_lots`) : (lot, sommets, 3)."""
    return numpy.einsum('snij,sj->nsi', melange, x)


def limiter(w):
    """Les lignes de `w` réduites à leurs `INFLUENCES_MAX` plus lourds, normalisées."""
    w = w.copy()
    rang = numpy.argsort(-w, axis=1)[:, INFLUENCES_MAX:]
    numpy.put_along_axis(w, rang, 0.0, axis=1)
    return w / w.sum(axis=1, keepdims=True)


def cellules_du_domaine(domaine):
    try:
        return domaine['cellulesSilhouettes'] if isinstance(domaine, dict) else domaine.cellules
    except (KeyError, AttributeError):
        raise RuntimeError('topologie-silhouettes-absente') from None


def minimum_du_carre(p, a, b):
    """hotes/godot/pont/CONTRAT.md, « Gabarit d'une base »."""
    aa, ab, bb = (numpy.einsum('...i,...i->...', q, r) for q, r in ((a, a), (a, b), (b, b)))
    pa, pb = (numpy.einsum('...i,...i->...', p, q) for q in (a, b))
    candidats = []
    for u in (0., 1.):
        v = numpy.clip(numpy.divide(-(pb + u * ab), bb, out=numpy.zeros_like(bb), where=bb > 0), 0, 1)
        candidats.append((numpy.full_like(v, u), v))
    for v in (0., 1.):
        u = numpy.clip(numpy.divide(-(pa + v * ab), aa, out=numpy.zeros_like(aa), where=aa > 0), 0, 1)
        candidats.append((u, numpy.full_like(u, v)))
    determinant = aa * bb - ab * ab
    u = numpy.divide(ab * pb - bb * pa, determinant, out=numpy.full_like(aa, numpy.nan), where=determinant > 0)
    v = numpy.divide(ab * pa - aa * pb, determinant, out=numpy.full_like(bb, numpy.nan), where=determinant > 0)
    candidats.append((u, v))
    valeurs = numpy.stack([numpy.where((u >= 0) & (u <= 1) & (v >= 0) & (v <= 1),
        numpy.linalg.norm(p + u[..., None] * a + v[..., None] * b, axis=-1), numpy.inf)
        for u, v in candidats])
    choix = valeurs.argmin(axis=0)
    indices = numpy.indices(choix.shape)
    return valeurs[(choix, *indices)], numpy.stack([numpy.take_along_axis(
        numpy.stack([c[k] for c in candidats]), choix[None], axis=0)[0] for k in (0, 1)], axis=-1)


def longueurs_de_reference(w, groupe, touches, locales):
    """Par état de `groupe` et arête (`locales`, indices dans `touches`), sa longueur de référence `l_b(w)` : la
    référence de l'état posée par le premier échantillon de sa pile mélangé par `w`. (états, arêtes)."""
    _, references, piles = groupe
    posees = [None] * len(references)
    for pile, etats in piles_distinctes(piles):
        repos = next(melanges_par_lots(w[touches], pile[:1]))
        for e in etats:
            posees[e] = appliquer(repos, references[e][touches])[0]
    posees = numpy.array(posees)
    return numpy.linalg.norm(posees[:, locales[:, 0]] - posees[:, locales[:, 1]], axis=2)


class Lot(NamedTuple):
    """Les échantillons `debut` à `debut + n` des piles d'un groupe, par état, échantillon et arête : le vecteur de
    l'arête (type des positions), sa norme (float64) et son rapport à la longueur de référence (type des vecteurs ; 1 où
    la référence est nulle)."""
    debut: int
    vecteurs: numpy.ndarray
    normes: numpy.ndarray
    rapports: numpy.ndarray


def mesurer_par_lots(w, groupe, touches, locales, longueurs):
    """Les `Lot` de `groupe` sous les poids `w`, arêtes `locales` dans `touches`, longueurs de référence `longueurs`
    (`longueurs_de_reference`) : le noyau commun de `poids.extremes` et de `Region.balayer`. Chaque état est déformé
    par sa pile, un mélange par pile distincte et par lot."""
    positions, _, piles = groupe
    distinctes = piles_distinctes(piles)
    valides = longueurs > 0
    xs = positions[:, touches]
    echantillons = len(piles[0])
    forme = (len(positions), min(LOT, echantillons), len(locales))
    type_ = numpy.result_type(xs.dtype, *(pile.dtype for pile, _ in distinctes), w.dtype)
    vecteurs = numpy.empty((*forme, 3), dtype=type_)
    normes = numpy.empty(forme)
    rapports = numpy.ones(forme, dtype=type_)
    extremites = numpy.empty((2, *forme[1:], 3), dtype=type_)
    for debut in range(0, echantillons, LOT):
        for pile, etats in distinctes:
            melange = next(melanges_par_lots(w[touches], pile[debut:debut + LOT]))
            n = melange.shape[1]
            for e in etats:
                p = appliquer(melange, xs[e])
                for k in (0, 1):
                    numpy.take(p, locales[:, k], axis=1, out=extremites[k, :n])
                numpy.subtract(extremites[0, :n], extremites[1, :n], out=vecteurs[e, :n])
                numpy.einsum('...i,...i->...', vecteurs[e, :n], vecteurs[e, :n], dtype=numpy.float64, out=normes[e, :n])
                numpy.sqrt(normes[e, :n], out=normes[e, :n])
                numpy.divide(normes[e, :n], longueurs[e], out=rapports[e, :n], where=valides[e])
        yield Lot(debut, vecteurs[:, :n], normes[:, :n], rapports[:, :n])


class MinimumDeCellule(NamedTuple):
    """Sur une cellule, par échantillon et arête : `exactes`, où le minimum est résolu (`minimum_du_carre`) ; `rapports`,
    le minimum exact, ailleurs la borne triangulaire, rapporté à la longueur de référence du premier coin, infini où elle
    est nulle ; `uv`, l'argmin exact, NaN ailleurs."""
    exactes: numpy.ndarray
    rapports: numpy.ndarray
    uv: numpy.ndarray


def minima_des_cellules(vecteurs, normes, longueurs, cellules, seuil, forcer=False):
    """Par cellule de `cellules`, son `MinimumDeCellule` sur les échantillons de `vecteurs` et `normes` (états,
    échantillons, arêtes), longueurs de référence `longueurs` : hotes/godot/pont/CONTRAT.md, « Gabarit d'une base ».
    Le minimum est résolu là où la borne ne certifie pas `seuil`, et partout où `forcer` est vrai."""
    colonnes_mesurees = {}
    for cellule in cellules:
        coins = cellule['coins']
        p = vecteurs[coins[0]]
        colonnes = []
        for k, poids in enumerate(cellule['colonnes']):
            cle = tuple(poids.items())
            if cle not in colonnes_mesurees:
                colonne = vecteurs[coins[k + 1]].astype(numpy.float64) - p
                colonnes_mesurees[cle] = (colonne, numpy.linalg.norm(colonne, axis=-1))
            colonnes.append(colonnes_mesurees[cle])
        (a, na), (b, nb) = colonnes
        reference = longueurs[coins[0]]
        valide = reference > 0
        borne = numpy.maximum(0, normes[coins].min(axis=0) - (na + nb) / 2)
        exactes = ((borne < seuil * reference[None]) | forcer) & valide[None]
        valeurs, uv = borne.copy(), numpy.full((*borne.shape, 2), numpy.nan)
        if exactes.any():
            valeurs[exactes], uv[exactes] = minimum_du_carre(p[exactes].astype(numpy.float64), a[exactes], b[exactes])
        yield MinimumDeCellule(exactes, numpy.divide(valeurs, reference[None], out=numpy.full_like(valeurs, numpy.inf),
                                                     where=valide[None]), uv)


class Projection(NamedTuple):
    """Le rendu de `plus_proche` : `x`, `None` si `statut` n'est pas `ok`."""
    x: numpy.ndarray
    statut: str


def remonter(r, b):
    """La solution de `r @ x == b`, `r` triangulaire supérieure."""
    x = numpy.empty(len(b))
    for i in range(len(b) - 1, -1, -1):
        x[i] = (b[i] - r[i, i + 1:] @ x[i + 1:]) / r[i, i]
    return x


class Actifs:
    """Les normales actives `N`, en colonnes, factorisées `N = J[:, :m] @ R[:m, :m]`, `J` orthogonale : Goldfarb et Idnani
    (1983), « A numerically stable dual method for solving strictly convex quadratic programs », Hessienne identité. Une
    normale entre par une réflexion de Householder, sort par des rotations de Givens."""

    def __init__(self, n):
        self.j, self.r, self.m = numpy.eye(n), numpy.zeros((n, n)), 0

    def projeter(self, a):
        """`(direction, multiplicateurs, d)` : la part de `a` orthogonale aux actives, ses coefficients sur elles, et
        `d = J.T @ a` que `ajouter` reprend."""
        d = self.j.T @ a
        return self.j[:, self.m:] @ d[self.m:], remonter(self.r[:self.m, :self.m], d[:self.m]), d

    def ajouter(self, d):
        m, queue = self.m, d[self.m:]
        alpha = -numpy.copysign(numpy.linalg.norm(queue), queue[0])
        v = queue.copy()
        v[0] -= alpha
        vv = v @ v
        if vv > 0:
            self.j[:, m:] -= numpy.outer(self.j[:, m:] @ v, 2 * v / vv)
        self.r[:m, m], self.r[m, m] = d[:m], alpha
        self.m += 1

    def retirer(self, k):
        m, r, j = self.m, self.r, self.j
        r[:m, k:m - 1] = r[:m, k + 1:m]
        r[:m, m - 1] = 0.0
        for i in range(k, m - 1):
            h = numpy.hypot(r[i, i], r[i + 1, i])
            if h == 0:
                continue
            c, s = r[i, i] / h, r[i + 1, i] / h
            r[i, i:m - 1], r[i + 1, i:m - 1] = c * r[i, i:m - 1] + s * r[i + 1, i:m - 1], c * r[i + 1, i:m - 1] - s * r[i, i:m - 1]
            j[:, i], j[:, i + 1] = c * j[:, i] + s * j[:, i + 1], c * j[:, i + 1] - s * j[:, i]
        self.m -= 1


def plus_proche(x0, egalites, cibles, plans, bornes, rayon):
    """Goldfarb-Idnani, Hessienne identité : la `Projection` sur le `x` le plus proche de `x0` tel que
    `egalites @ x == cibles` et `plans @ x >= bornes`. Sans `x`, le statut nomme la cause : `infaisable`, aucun pas fini
    ne tient le plan violé ; `hors-rayon`, l'itérée s'éloigne de `x0` de plus de `rayon`, distance de `x0` au point
    admissible le plus lointain ; `iterations`, au-delà de `ITERATIONS_MAX` ; `pas-non-fini`, un pas NaN. La distance de
    l'itérée à `x0` ne décroît jamais et minore celle de la solution. Les actives se tiennent factorisées (`Actifs`) : une
    itération coûte O(n²), sans refactoriser."""
    normes = numpy.linalg.norm(plans, axis=1)
    normes[normes == 0] = 1
    plans, bornes = plans / normes[:, None], bornes / normes
    x = x0 - egalites.T @ numpy.linalg.solve(egalites @ egalites.T, egalites @ x0 - cibles)
    tenues = Actifs(len(x0))
    for egalite in egalites:
        tenues.ajouter(tenues.projeter(egalite)[2])
    actifs, duals = [], []
    iterations = 0
    while True:
        marges = plans @ x - bornes
        viole = int(numpy.argmin(marges))
        if marges[viole] >= -TOLERANCE_PLAN:
            return Projection(x, 'ok')
        dual = 0.0
        while True:
            iterations += 1
            if iterations > ITERATIONS_MAX:
                return Projection(None, 'iterations')
            direction, multiplicateurs, d = tenues.projeter(plans[viole])
            des_actifs = multiplicateurs[len(egalites):]
            pas_dual, sortant = numpy.inf, -1
            for i, r in enumerate(des_actifs):
                if r > 1e-12 and duals[i] / r < pas_dual:
                    pas_dual, sortant = duals[i] / r, i
            carre = direction @ direction
            pas_primal = numpy.inf if carre < 1e-16 else (bornes[viole] - plans[viole] @ x) / carre
            if numpy.isnan(pas_primal):
                return Projection(None, 'pas-non-fini')
            pas = min(pas_dual, pas_primal)
            if numpy.isinf(pas):
                return Projection(None, 'infaisable')
            if numpy.isfinite(pas_primal):
                x = x + pas * direction
                if numpy.linalg.norm(x - x0) > rayon:
                    return Projection(None, 'hors-rayon')
            for i, r in enumerate(des_actifs):
                duals[i] -= pas * r
            dual += pas
            if pas == pas_primal:
                actifs.append(viole)
                duals.append(dual)
                tenues.ajouter(d)
                break
            del actifs[sortant]
            del duals[sortant]
            tenues.retirer(len(egalites) + sortant)


class Violation(NamedTuple):
    """Une sortie du balayage : au groupe `groupe`, l'arête locale `arete` à l'échantillon `instant`, `haut` ou par le
    bas, à l'état `coins[0]` ou, à quatre coins, au point (`u`, `v`) d'une cellule."""
    groupe: int
    arete: int
    instant: int
    haut: bool
    coins: tuple
    u: float
    v: float
    rapport: float


class Plan(NamedTuple):
    """`signe` × (`os_a` · poids de `a` − `os_b` · poids de `b`) ≥ 0."""
    signe: float
    a: int
    b: int
    os_a: numpy.ndarray
    os_b: numpy.ndarray


class Resolution(NamedTuple):
    """La proposition de `corriger_region`, `None` si le statut n'est pas `ok` : `sans-plan-neuf`, `tours`, ou le statut
    de `plus_proche`."""
    w: numpy.ndarray
    statut: str


def bornes_de_l_instant(instant):
    """Les bornes de la clause de `instant` : le repos (instant 0), puis les clips."""
    return ETIREMENT_DES_CLES if instant == 0 else ETIREMENT_EN_CLIP


def seuils_de_balayage(instant):
    """Les seuils bas et haut du balayage à `instant` : #3104 issuecomment-6568295594."""
    bas, haut = bornes_de_l_instant(instant)
    return (bas, haut) if instant == 0 else (bas * MARGE_BALAYAGE_BAS, haut * MARGE_BALAYAGE_HAUT)


def retenir(releves, clauses):
    """Les lignes de `releves` (source, haut, arête, instant, mesure, u, v, rapport ; mesure croissante = pire), pour
    chaque source, côté, arête et clause (`clauses`, par instant : le repos, puis chaque clip), les `INSTANTS_PAR_ARETE`
    pires espacées de `ECART_ENTRE_INSTANTS` dans la clause. #3104 issuecomment-6565228921 retient les pires instants par
    arête ; source, côté et clause en séparent les clés : la pire sortie d'un clip ne masque ni la clause repos, ni un
    autre clip, ni l'autre côté, ni un autre état."""
    if not releves:
        return []
    tableau = numpy.concatenate(releves)
    clause = clauses[tableau[:, 3].astype(int)]
    ordre = numpy.lexsort((tableau[:, 3], tableau[:, 4], clause, tableau[:, 2], tableau[:, 1], tableau[:, 0]))
    pris, cle, courants = [], None, []
    for ligne, c in zip(tableau[ordre], clause[ordre]):
        if (ligne[0], ligne[1], ligne[2], c) != cle:
            cle, courants = (ligne[0], ligne[1], ligne[2], c), []
        if len(courants) < INSTANTS_PAR_ARETE and all(abs(ligne[3] - t) >= ECART_ENTRE_INSTANTS for t in courants):
            courants.append(ligne[3])
            pris.append(ligne)
    return pris


class Region:
    """Les sommets `sommets` et leurs arêtes incidentes `aretes` sur les `groupes`, depuis les
    poids `w`. `pieds` : les indices d'os de chaque pied, descendants compris. `os` : par sommet, ses variables, au départ
    l'union sur `sommets` des os de `sommets` et de leurs voisins directs."""

    def __init__(self, w, sommets, aretes, groupes, pieds=()):
        self.origine = w.astype(numpy.float64)
        self.sommets = [int(s) for s in sommets]
        self.aretes, self.groupes, self.pieds = aretes, groupes, pieds
        self.touches, locales = numpy.unique(aretes, return_inverse=True)
        self.locales = locales.reshape(aretes.shape)
        self.libres = set(self.sommets)
        voisinage = numpy.union1d(self.sommets, aretes[numpy.isin(aretes, self.sommets).any(axis=1)])
        os_de_la_region = numpy.flatnonzero(w[voisinage].any(axis=0)).tolist()
        self.os = {s: set(os_de_la_region) for s in self.sommets}

    def balayer(self, w):
        """Les sorties de chaque groupe sous `w`, par `par_groupes`, retenues par `retenir`, sans garder les vecteurs. Le
        noyau `mesurer_par_lots` et `minima_des_cellules` est celui de `poids.extremes` : sous les mêmes octets de `w`,
        rapports et décisions sont les siens, marges de clip mises à part."""
        violations = par_groupes(lambda g: self.balayer_groupe(w, g), range(len(self.groupes)))
        return [violation for du_groupe in violations for violation in du_groupe]

    def balayer_groupe(self, w, g):
        groupe = self.groupes[g]
        positions = groupe[0]
        cellules = cellules_du_domaine(groupe)
        longueurs = longueurs_de_reference(w, groupe, self.touches, self.locales)
        releves = []
        for lot in mesurer_par_lots(w, groupe, self.touches, self.locales, longueurs):
            n = lot.rapports.shape[1]
            coupe = min(n, max(0, 1 - lot.debut))
            for de, a in ((0, coupe), (coupe, n)):
                if de < a:
                    seuils = seuils_de_balayage(lot.debut + de)
                    self.relever_etats(releves, lot.rapports[:, de:a].astype(numpy.float64), lot.debut + de, seuils,
                                       not cellules)
                    for c, minimum in enumerate(minima_des_cellules(lot.vecteurs[:, de:a], lot.normes[:, de:a], longueurs,
                                                                    cellules, seuils[0])):
                        self.relever_cellule(releves, minimum, lot.debut + de, seuils[0], len(positions) + c)
        violations = []
        for source, haut, arete, instant, _, u, v, rapport in retenir(releves, groupe.clauses):
            source = int(source)
            coins = (source,) if source < len(positions) else tuple(cellules[source - len(positions)]['coins'])
            violations.append(Violation(g, int(arete), int(instant), bool(haut), coins, float(u), float(v), float(rapport)))
        return violations

    @staticmethod
    def relever_etats(releves, rapports, instant_initial, seuils, bas_aussi):
        cotes = [(True, rapports > seuils[1], -rapports)]
        if bas_aussi:
            cotes.append((False, rapports < seuils[0], rapports))
        for haut, sortis, mesures in cotes:
            etat, instant, arete = numpy.nonzero(sortis)
            if len(etat):
                releves.append(numpy.column_stack([etat, numpy.full(len(etat), float(haut)), arete, instant_initial + instant,
                                                   mesures[etat, instant, arete], numpy.zeros((len(etat), 2)),
                                                   rapports[etat, instant, arete]]))

    @staticmethod
    def relever_cellule(releves, minimum, instant_initial, seuil, source):
        instant, arete = numpy.nonzero(minimum.exactes & (minimum.rapports < seuil))
        if len(instant):
            rapports = minimum.rapports[instant, arete]
            releves.append(numpy.column_stack([numpy.full(len(instant), float(source)), numpy.zeros(len(instant)), arete,
                                               instant_initial + instant, rapports, minimum.uv[instant, arete], rapports]))

    def par_pile(self, g, coins, combiner, sommet):
        """Le sommet `sommet` des états `coins` combiné par `combiner` (linéaire, de leurs positions homogènes), réparti
        par pile : `[(pile, p)]`, sa position déformée étant la somme de chaque `pile` appliquée à son `p`. Des coins de
        même pile se combinent avant la déformation ; sinon chaque coin porte sa part sous sa pile."""
        positions, _, piles = self.groupes[g]
        xs = [positions[c, sommet] for c in coins]
        if len({id(piles[c]) for c in coins}) == 1:
            return [(piles[coins[0]], combiner(xs))]
        return [(piles[c], combiner([x if j == i else numpy.zeros_like(x) for j, x in enumerate(xs)]))
                for i, c in enumerate(coins)]

    def plans_de(self, w, violation):
        """Les plans d'une violation. Plan bas : `n` fixe, le vecteur de l'arête au point critique sans les poids,
        transporté par la matrice moyenne de l'arête ; sur une cellule, aux quatre coins. Plan haut : `n` = e/|e|. Chaque
        état est posé par sa pile, la référence par celle de `coins[0]`."""
        g, arete, instant, haut, coins, u, v, _ = violation
        _, references, piles = self.groupes[g]
        a, b = (int(s) for s in self.aretes[arete])
        poses = {}

        def pose_de(pile):
            if id(pile) not in poses:
                poses[id(pile)] = pile[instant].astype(numpy.float64)[:, :3, :]
            return poses[id(pile)]

        def point(xs):
            p = xs[0].astype(numpy.float64)
            return p + u * (xs[1] - p) + v * (xs[2] - p) if len(xs) > 1 else p

        termes = []
        for (pile, pa), (_, pb) in zip(*(self.par_pile(g, coins[:3], point, s) for s in (a, b))):
            ma, mb = (numpy.einsum('o,oij->ij', w[s], pose_de(pile)) for s in (a, b))
            termes.append(ma @ pa - mb @ pb if haut else 0.5 * (ma + mb)[:3, :3] @ (pa - pb)[:3])
        n = numpy.sum(termes, axis=0)
        n = n / max(numpy.linalg.norm(n), 1e-30)
        bornes = bornes_de_l_instant(instant)
        facteur = bornes[1] * MARGE_PLAN_HAUT if haut else bornes[0] * MARGE_PLAN_BAS
        signe = -1.0 if haut else 1.0
        repos = piles[coins[0]][0].astype(numpy.float64)[:, :3, :]
        ra, rb = references[coins[0], a].astype(numpy.float64), references[coins[0], b].astype(numpy.float64)
        eb = numpy.einsum('o,oij->ij', w[a], repos) @ ra - numpy.einsum('o,oij->ij', w[b], repos) @ rb
        m = eb / max(numpy.linalg.norm(eb), 1e-30)
        os_ra = facteur * numpy.einsum('i,oij,j->o', m, repos, ra)
        os_rb = facteur * numpy.einsum('i,oij,j->o', m, repos, rb)
        coins_du_plan = [coins] if len(coins) == 1 else [(c,) for c in coins[:3]] + [(coins[1], coins[2], coins[0])]

        def coin(xs):
            return xs[0].astype(numpy.float64) + (xs[1] - xs[2] if len(xs) > 1 else 0.0)

        plans = []
        for co in coins_du_plan:
            os_a, os_b = (numpy.sum([numpy.einsum('i,oij,j->o', n, pose_de(pile), c) for pile, c in self.par_pile(g, co, coin, s)],
                                    axis=0) for s in (a, b))
            plans.append(Plan(signe, a, b, os_a - os_ra, os_b - os_rb))
        return plans

    def resoudre(self, plans):
        """La `Projection` sur le `w` le plus proche de `self.origine` sous `plans`, sans dépasser `INFLUENCES_MAX` os par
        sommet : chaque sommet en excès perd son os actif le plus léger, puis nouvelle résolution. Sans `w`, le statut
        de `plus_proche`."""
        while True:
            colonnes = {(s, o): j for j, (s, o) in enumerate((s, o) for s in self.sommets for o in sorted(self.os[s]))}
            x, statut = self.resoudre_colonnes(plans, colonnes)
            if x is None:
                return Projection(None, statut)
            exces = []
            for s in self.sommets:
                actifs = [(x[colonnes[s, o]], o) for o in sorted(self.os[s]) if x[colonnes[s, o]] > 1e-9]
                if len(actifs) > INFLUENCES_MAX:
                    exces.append((s, min(actifs)[1]))
            if not exces:
                w = self.origine.copy()
                w[self.sommets] = 0.0
                for (s, o), j in colonnes.items():
                    w[s, o] = max(x[j], 0.0)
                w[self.sommets] = w[self.sommets] / w[self.sommets].sum(axis=1, keepdims=True)
                return Projection(w, 'ok')
            for s, os in exces:
                self.os[s].discard(os)

    def resoudre_colonnes(self, plans, colonnes):
        n = len(colonnes)
        x0 = numpy.array([self.origine[s, o] for s, o in colonnes])
        egalites = numpy.zeros((len(self.sommets), n))
        rang = {s: i for i, s in enumerate(self.sommets)}
        par_sommet = {s: (numpy.array(sorted(self.os[s]), dtype=int), []) for s in self.sommets}
        for (s, o), j in colonnes.items():
            egalites[rang[s], j] = 1.0
            par_sommet[s][1].append(j)
        par_sommet = {s: (os, numpy.array(cs, dtype=int)) for s, (os, cs) in par_sommet.items()}
        lignes_de_pied = [par_sommet[s][1][numpy.isin(par_sommet[s][0], pied)] for s in self.sommets for pied in self.pieds]
        lignes_de_pied = [cs for cs in lignes_de_pied if len(cs)]
        q = len(plans)
        contraintes = numpy.zeros((q + len(lignes_de_pied) + n, n))
        bornes = numpy.zeros(q + len(lignes_de_pied) + n)
        for i, plan in enumerate(plans):
            constante = 0.0
            for s, coefficients, cote in ((plan.a, plan.os_a, 1.0), (plan.b, plan.os_b, -1.0)):
                if s in self.libres:
                    os, cs = par_sommet[s]
                    contraintes[i, cs] += plan.signe * cote * coefficients[os]
                else:
                    constante += cote * (self.origine[s] @ coefficients)
            bornes[i] = -plan.signe * constante
        for i, cs in enumerate(lignes_de_pied):
            contraintes[q + i, cs] = -1.0
            bornes[q + i] = -(MAJORITE_DU_POIDS - MARGE_DU_PIED)
        contraintes[q + len(lignes_de_pied):] = numpy.eye(n)
        return plus_proche(x0, egalites, numpy.ones(len(self.sommets)), contraintes, bornes, numpy.sqrt(2 * len(self.sommets)))

    def proposition(self, w, dtype):
        """`w` aux poids de `self.origine`, de type `dtype` : un sommet que le pas n'a pas déplacé de plus de
        `POIDS_NEGLIGEABLE` garde ses octets ; ailleurs les poids sous `POIDS_NEGLIGEABLE` tombent à 0 avant `limiter`."""
        resultat = self.origine.astype(dtype)
        deplaces = [s for s in self.sommets if numpy.abs(w[s] - self.origine[s]).max() > POIDS_NEGLIGEABLE]
        if deplaces:
            lignes = w[deplaces].copy()
            lignes[lignes < POIDS_NEGLIGEABLE] = 0.0
            resultat[deplaces] = limiter(lignes).astype(dtype)
        return resultat


def corriger_region(w, sommets, aretes, groupes, pieds=()):
    """#3104 issuecomment-6565228921 : balayage, plans des violations, moindre déplacement, jusqu'à ne plus rien balayer. La clé de
    déduplication d'un plan bas porte groupe, arête, instant et coins. Le balayage lit les octets de la proposition. Rend
    une `Resolution`."""
    region = Region(w, sommets, aretes, groupes, pieds)
    courant = region.origine
    plans, vus = [], set()
    for _ in range(TOURS_MAX):
        proposition = region.proposition(courant, w.dtype)
        violations = region.balayer(proposition)
        if not violations:
            return Resolution(proposition, 'ok')
        neufs = 0
        for violation in violations:
            if not violation.haut:
                cle = (violation.groupe, violation.arete, violation.instant, violation.coins)
                if cle in vus:
                    continue
                vus.add(cle)
            neufs += 1
            plans.extend(region.plans_de(courant, violation))
        if not neufs:
            return Resolution(None, 'sans-plan-neuf')
        courant, statut = region.resoudre(plans)
        if courant is None:
            return Resolution(None, statut)
    return Resolution(None, 'tours')
