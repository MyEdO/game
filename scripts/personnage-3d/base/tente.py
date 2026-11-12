"""Le drapé en tente d'un filet de tissu (#3842) : chaque brin, dans son plan radial, pend au plus bas par-dessus la peau
du dedans et sous celle du dehors. Fonction de l'image, plus une chute et une montée bornées : aucune dynamique, aucun
rebond.

Un filet est fait de brins de `K` os rigides, pendus à leurs racines autour d'un axe. Chaque os se pose par son angle
dans le plan de son brin, de la verticale descendante (0) vers le dehors (π/2). Une peau est une surface : ses sommets
et les arêtes qui les relient. Trois côtés :
- `DEDANS` : le brin passe par-dessus ;
- `CEDE` : le brin passe par-dessus, sauf où le dehors l'y enfonce (ce que le vêtement cache) ;
- `DEHORS` : le brin passe dessous, tant que le `DEDANS` le permet.
Le tissu ne s'étire pas : le bout d'un os ne passe pas au large de l'axe, et deux bouts voisins ne s'écartent pas de plus
d'`ETIREMENT_MAX` fois leur écart au repos. Il cède plutôt : au dehors, à ce qui cède, au sol, enfin au `DEDANS`
(`Tente.poser`, `Tente.retendre`).
Repère de l'armature : +Z le haut.
"""
import numpy as np

HAUT = np.array([0.0, 0.0, 1.0])
DEHORS, DEDANS, CEDE = 1, -1, -2
JEU_M = 0.015
"""Écart gardé entre un os et la peau qu'il longe, en mètres."""
SOL_M = 0.01
"""Hauteur sous laquelle le bout d'un os d'un filet debout ne descend pas, en mètres."""
VITESSE_M_S = 2.0
"""Vitesse à laquelle le bout d'un os retombe d'une image à la suivante, en mètres par seconde."""
MONTEE_M_S = 6.0
"""Vitesse à laquelle le bout d'un os se relève d'une image à la suivante, en mètres par seconde."""
ANGLE_MIN, ANGLE_MAX = np.radians(-30.0), np.radians(180.0)
"""Bornes de l'angle d'un os."""
DEPART_M = 0.045
"""Distance à son départ sous laquelle un os ne voit pas une peau, et sur laquelle, au-delà, le jeu qu'il lui doit croît
de 0 à `JEU_M`."""
ETIREMENT_MAX = 2.5
"""Rapport le plus grand de l'écart de deux bouts voisins à leur écart au repos, et de la distance d'un bout à l'axe à
celle du dessin (`Tente.retendre`, `Tente.poser`)."""
MARGE_DE_COIN_RAD = np.radians(3.0)
"""Débord angulaire du coin d'une face, où ses deux brins voient encore une peau."""
SORTIE_RAD_M = np.radians(300.0)
"""Coût, en radians par mètre, d'un départ aveugle plus long que `DEPART_M` (`sortie`)."""
PAS_DE_SORTIE_M = 0.02
"""Pas des départs aveugles essayés, en mètres."""
REPLI_MAX_RAD = np.radians(135.0)
"""Angle dont un os se replie au plus sur le précédent : ce qu'il voit au-delà est derrière lui."""
AVANCE_RAD = np.radians(40.0)
"""Angle dont un os se relève au plus pour que le suivant pende plus bas (`Tente.au_plus_bas`)."""
OR = (np.sqrt(5.0) - 1.0) / 2.0
PAS_D_OR = 10
"""Pas de la recherche par section dorée de `Tente.au_plus_bas`."""


class Tente:
    def __init__(self, brins, centre, ferme):
        """`brins` (S, K+1, 3) : le filet dessiné, chaque brin dans un plan vertical par l'axe `centre` (x, y) ;
        `ferme` : le dernier brin est voisin du premier."""
        self.dessin = np.asarray(brins, float)
        self.S, n, _ = self.dessin.shape
        self.K = n - 1
        self.axe = np.array([centre[0], centre[1], float(self.dessin[:, 0, 2].mean())])
        d = self.dessin[:, 0] - self.axe
        d[:, 2] = 0.0
        self.dehors = d / np.linalg.norm(d, axis=1, keepdims=True)
        seg = self.dessin[:, 1:] - self.dessin[:, :-1]
        self.longueurs = np.linalg.norm(seg, axis=2)
        self.angles = np.arctan2(np.einsum('skc,sc->sk', seg, self.dehors), -seg[:, :, 2])
        self.faces = np.array([(s, (s + 1) % self.S) for s in range(self.S if ferme else self.S - 1)])
        a, b = self.dehors[self.faces[:, 0]], self.dehors[self.faces[:, 1]]
        self.bissectrices = (a + b) / np.linalg.norm(a + b, axis=1, keepdims=True)
        self.tangentes = (b - a) / np.linalg.norm(b - a, axis=1, keepdims=True)
        self.demi = np.arccos(np.clip(np.einsum('fc,fc->f', a, self.bissectrices), -1, 1))
        self.ecarts = np.linalg.norm(self.dessin[self.faces[:, 0], 1:] - self.dessin[self.faces[:, 1], 1:], axis=2)
        self.au_large = ETIREMENT_MAX * np.einsum('skc,sc->sk', self.dessin[:, 1:] - self.axe, self.dehors)
        largeurs = np.zeros(self.S)
        np.maximum.at(largeurs, self.faces[:, 0], 2 * self.demi)
        np.maximum.at(largeurs, self.faces[:, 1], 2 * self.demi)
        self.coins = np.cos(largeurs + MARGE_DE_COIN_RAD)

    def sous_le_dessin(self, points):
        """Ceux des `points` (n, 3), dans le repère du dessin et à la hauteur du filet, dont le plan tangent ne laisse pas
        `JEU_M` au brin dessiné qui les voit : ils ne viennent pas du dehors."""
        rel = np.asarray(points, float) - self.axe
        rad = rel * [1.0, 1.0, 0.0]
        rho = np.maximum(np.linalg.norm(rad, axis=1), 1e-6)
        cosd = rad @ self.dehors.T / rho[:, None]
        chute = self.axe[2] - self.dessin[:, :, 2]
        rayons = np.linalg.norm((self.dessin - self.axe)[:, :, :2], axis=2)
        au_brin = np.column_stack([np.interp(-rel[:, 2], chute[s], rayons[s], left=-np.inf, right=-np.inf) for s in range(self.S)])
        return ((cosd > self.coins) & (rho[:, None] <= (au_brin + JEU_M) * cosd)).any(axis=1)

    def disques(self, O, Q, obstacles):
        """`obstacles` : les sommets (n, 3), leurs rayons (n,), leurs côtés (n,) et les arêtes (m, 2) qui les relient.
        Par brin, pour le dedans, le dehors puis le `DEDANS` seul, les disques `(a, b, r)` de son plan (a : distance à
        l'axe par `O`, b : descente depuis `O`, dans le repère d'aplomb `Q`) et leurs arêtes.
        Un brin ne voit que les sommets du coin de ses deux faces. Un disque du dedans se place où la face, tendue à
        rayon égal entre ses deux brins, laisse le sommet de son côté ; un disque du dehors, où le brin reste du côté de
        l'axe du plan tangent au sommet ; un disque du `DEDANS` seul, à la part du sommet qui revient au brin dans sa
        face, en deçà de laquelle aucun voisin ne garde le sommet dessous."""
        pts, r, cotes, aretes = obstacles
        bas = -(Q @ HAUT)
        rel = pts - O
        b = rel @ bas
        rad = rel - b[:, None] * bas
        rho = np.maximum(np.linalg.norm(rad, axis=1), 1e-6)
        vers = rad @ (self.bissectrices @ Q.T).T
        vu = vers >= rho[:, None] * np.cos(self.demi + MARGE_DE_COIN_RAD)[None]
        appui = np.where(vu, (vers + r[:, None]) / np.cos(self.demi)[None], -np.inf)
        mi = vers / (2 * np.cos(self.demi))[None]
        lat = rad @ (self.tangentes @ Q.T).T / (2 * np.sin(self.demi))[None]
        egal, propre = np.full((len(pts), self.S), -np.inf), np.full((len(pts), self.S), -np.inf)
        for cote, part in ((0, mi - lat), (1, mi + lat)):
            np.maximum.at(egal, (slice(None), self.faces[:, cote]), appui)
            np.maximum.at(propre, (slice(None), self.faces[:, cote]), np.where(vu, np.maximum(part, 0.0), -np.inf))
        cosd = rad @ (self.dehors @ Q.T).T / rho[:, None]
        sortie = []
        for s in range(self.S):
            dedans = (cotes < 0) & np.isfinite(egal[:, s])
            ferme = dedans & (cotes == DEDANS)
            dehors = (cotes > 0) & (cosd[:, s] > self.coins[s])
            sortie.append(((np.column_stack([egal[dedans, s] - r[dedans], b[dedans], r[dedans]]), gardees(aretes, dedans)),
                           (np.column_stack([(rho[dehors] - r[dehors]) / cosd[dehors, s] + r[dehors], b[dehors], r[dehors]]), gardees(aretes, dehors)),
                           (np.column_stack([propre[ferme, s], b[ferme], r[ferme]]), gardees(aretes, ferme))))
        return sortie

    def poser(self, racines, O, Q, obstacles, sol, avant, dt):
        """Le filet de l'image : articulations (S, K+1, 3) et angles (S, K). `racines` (S, 3), `O` un point de l'axe,
        `Q` le repère d'aplomb (posé = Q @ dessiné), `sol` la hauteur sous laquelle le bout d'un os ne descend pas.
        `avant` : les angles de l'image d'avant, `dt` secondes plus tôt, dont un os ne retombe que de `VITESSE_M_S` et ne
        se relève que de `MONTEE_M_S` ;
        None : le tissu est posé. Le bout d'un os ne passe pas au large de l'axe, à plus d'`ETIREMENT_MAX` fois sa distance
        dessinée : il descend plutôt sous `sol` et dans la peau du dedans. Un os parti de sous `sol` y reste."""
        bas = -(Q @ HAUT)
        hors = self.dehors @ Q.T
        disques = self.disques(O, Q, obstacles)
        x = np.zeros((self.S, self.K + 1, 3))
        phi = np.zeros((self.S, self.K))
        x[:, 0] = racines
        p = np.column_stack([np.einsum('sc,sc->s', racines - O, hors), (racines - O) @ bas])
        enfonce = np.zeros(self.S, bool)
        for k in range(self.K):
            tenus, fermes, planchers = [], {}, np.zeros(self.S)
            plafond, sols = np.full(self.S, np.inf), np.zeros((self.S, 2))
            au_large = (self.au_large[:, k] - p[:, 0]) / self.longueurs[:, k]
            toit = np.where(au_large < 1.0, np.arcsin(np.clip(au_large, -1.0, 1.0)), ANGLE_MAX)
            if avant is not None:
                toit = np.minimum(toit, avant[:, k] + MONTEE_M_S * dt / self.longueurs[:, k])

            def du_ferme(s):
                if s not in fermes:
                    fermes[s] = sortie(p[s], self.longueurs[s, k], disques[s][2], coupe(phi[s, k - 1]) if k else np.pi)
                return fermes[s]

            for s in range(self.S):
                dedans, dehors, ferme = disques[s]
                if enfonce[s]:
                    dedans = ferme
                L = self.longueurs[s, k]
                vus = sortie(p[s], L, dedans, coupe(phi[s, k - 1]) if k else np.pi)
                tenus.append(vus[:2])
                planchers[s] = plancher_de(*vus)
                angle = soulever(max(planchers[s], self.angles[s, k]), *tenus[s])
                if k + 1 < self.K:
                    angle = self.au_plus_bas(s, k, p[s], angle, tenus[s], dedans)
                if avant is not None:
                    angle = soulever(max(angle, avant[s, k] - VITESSE_M_S * dt / L), *tenus[s])
                de, a, _ = secteurs(p[s], L, *dehors, np.pi, DEPART_M)
                if (de < angle).any():
                    fond = plancher_de(*du_ferme(s))
                    pris = (de < angle) & (a > fond)
                    if pris.any():
                        angle = plafond[s] = abaisser(max(fond, float(de[pris].min())), *du_ferme(s)[:2])
                sous, sur = sols[s] = sous_le_sol(x[s, k, 2] - sol, L, hors[s, 2], bas[2])
                if sous < angle < sur:
                    angle = sous if sur > ANGLE_MAX or (angle < (sous + sur) / 2 and sous >= ANGLE_MIN) else sur
                phi[s, k] = min(angle, toit[s])
            self.retendre(k, x[:, k], phi[:, k], hors, bas, tenus, du_ferme, plafond, sols, toit)
            enfonce |= phi[:, k] < planchers - 1e-9
            for s in range(self.S):
                L = self.longueurs[s, k]
                p[s] += L * np.array([np.sin(phi[s, k]), np.cos(phi[s, k])])
                x[s, k + 1] = x[s, k] + L * (np.sin(phi[s, k]) * hors[s] + np.cos(phi[s, k]) * bas)
        return x, phi

    def retendre(self, k, departs, phi, hors, bas, tenus, du_ferme, plafond, sols, toit):
        """Rapproche dans `phi` (S,), l'angle des os `k` partis de `departs`, deux voisins dont les bouts s'écartent de
        plus d'`ETIREMENT_MAX` fois leur écart au repos. Le plus bas se relève jusqu'au `plafond` que lui pose le dehors ;
        puis le plus haut s'abaisse, jusque dans ce qui cède (`du_ferme` : par brin, ses secteurs du `DEDANS` seul), et
        garde ce plafond ; puis le plus bas passe par-dessus le dehors et par-dessus son secteur de `sols` (`sous_le_sol`),
        où aucun n'est encore entré ; enfin le plus haut s'abaisse jusque dans le `DEDANS` et sous le sol. Aucun ne se
        relève au-delà de son `toit`, où son bout passerait au large."""
        L = self.longueurs[:, k]

        def bout(s):
            return departs[s] + L[s] * (np.sin(phi[s]) * hors[s] + np.cos(phi[s]) * bas)

        def portee(s, cible, limite):
            """Les angles, de `de` à `a`, où le bout de l'os du brin `s` est à `limite` au plus de `cible`."""
            v = cible - departs[s]
            dans, vers = np.hypot(v @ hors[s], v @ bas), np.arctan2(v @ hors[s], v @ bas)
            vers += 2 * np.pi * (vers < (ANGLE_MIN + ANGLE_MAX) / 2 - np.pi)
            demi = np.arccos(np.clip((L[s] * L[s] + v @ v - limite * limite) / (2 * L[s] * max(dans, 1e-9)), -1.0, 1.0))
            return vers - demi, vers + demi

        def ecarte(i, j, limite):
            return np.linalg.norm(bout(i) - bout(j)) > limite + 1e-9

        abaisses = set()

        def abaisse(s, angle):
            """Abaisse le brin `s` à `angle` : il ne se relève plus au-delà."""
            if angle >= phi[s] - 1e-6:
                return False
            phi[s] = plafond[s] = angle
            abaisses.add(s)
            return True

        for _ in range(self.S):
            tendu = False
            for f, (i, j) in enumerate(self.faces):
                limite = ETIREMENT_MAX * self.ecarts[f, k]
                if not ecarte(i, j, limite):
                    continue
                s, haut = (i, j) if phi[i] < phi[j] else (j, i)
                angle = soulever(portee(s, bout(haut), limite)[0], *tenus[s])
                angle = min(angle, plafond[s], sols[s, 0] if phi[s] <= sols[s, 0] else np.inf, toit[s])
                if angle > phi[s] + 1e-6:
                    phi[s], tendu = angle, True
                if not ecarte(i, j, limite):
                    continue
                angle = abaisser(max(portee(haut, bout(s), limite)[1], plancher_de(*du_ferme(haut))), *du_ferme(haut)[:2])
                tendu |= abaisse(haut, max(angle, sols[haut, 1]) if phi[haut] >= sols[haut, 1] else angle)
                if not ecarte(i, j, limite):
                    continue
                de, a = tenus[s]
                angle = soulever(portee(s, bout(haut), limite)[0], np.append(de, sols[s, 0]), np.append(a, sols[s, 1]))
                if s not in abaisses and phi[s] + 1e-6 < angle <= toit[s]:
                    phi[s], tendu = angle, True
                if ecarte(i, j, limite):
                    tendu |= abaisse(haut, portee(haut, bout(s), limite)[1])
            if not tendu:
                return

    def au_plus_bas(self, s, k, p, angle, tenus, dedans):
        """L'angle de l'os `k` du brin `s`, de `angle` à `angle + AVANCE_RAD`, où lui et son suivant pendent au plus bas."""
        L, suivant = self.longueurs[s, k], self.longueurs[s, k + 1]
        poids = self.K - k - 0.5

        def chute(phi):
            phi = soulever(phi, *tenus)
            bout = p + L * np.array([np.sin(phi), np.cos(phi)])
            apres = max(self.angles[s, k + 1], plancher_de(*secteurs(bout, suivant, *dedans, coupe(phi), DEPART_M)))
            return poids * L * np.cos(phi) + (poids - 1) * suivant * np.cos(apres), phi, apres

        meilleur = chute(angle)
        if meilleur[2] <= self.angles[s, k + 1]:
            return meilleur[1]
        a, b = angle, angle + AVANCE_RAD
        c, d = chute(b - OR * (b - a)), chute(a + OR * (b - a))
        for _ in range(PAS_D_OR):
            meilleur = max(meilleur, c, d)
            if c[0] > d[0]:
                b, d = a + OR * (b - a), c
                c = chute(b - OR * (b - a))
            else:
                a, c = b - OR * (b - a), d
                d = chute(a + OR * (b - a))
        return max(meilleur, c, d)[1]


def gardees(aretes, garde):
    """Les `aretes` dont les deux bouts sont gardés, renumérotées dans les seuls gardés."""
    rang = np.cumsum(garde) - 1
    return rang[aretes[garde[aretes].all(axis=1)]]


def soulever(angle, de, a):
    """`angle` relevé jusqu'à ce qu'aucun secteur `]de, a[` ne le tienne."""
    while True:
        tient = (de < angle) & (a > angle)
        if not tient.any():
            return angle
        angle = float(a[tient].max())


def abaisser(angle, de, a):
    """`angle` abaissé jusqu'à ce qu'aucun secteur `]de, a[` ne le tienne."""
    while True:
        tient = (de < angle) & (a > angle)
        if not tient.any():
            return angle
        angle = float(de[tient].min())


def coupe(avant):
    """L'angle où un os se replierait sur le précédent, d'angle `avant`."""
    return min(np.pi, avant + REPLI_MAX_RAD)


def plancher_de(de, a, corps):
    """L'angle le plus bas d'un os : par-dessus tout ce que son corps toucherait, et hors de ce que toucherait son bout."""
    return soulever(max(ANGLE_MIN, float(a[corps].max(initial=ANGLE_MIN))), de[~corps], a[~corps])


def sortie(p, L, dedans, coupe):
    """Les secteurs de l'os parti d'un point que la peau a pu enfouir : ceux du départ aveugle, de `DEPART_M` à `L / 2`,
    d'où il sort au plus bas, un départ plus long coûtant `SORTIE_RAD_M`."""
    def cout(depart):
        tenus = secteurs(p, L, *dedans, coupe, depart)
        return plancher_de(*tenus) + SORTIE_RAD_M * (depart - DEPART_M), tenus

    departs = np.arange(DEPART_M, L / 2, PAS_DE_SORTIE_M)
    court, long = cout(departs[0]), cout(departs[-1])
    if court[0] <= long[0] - SORTIE_RAD_M * (departs[-1] - departs[1]):
        return court[1]
    return min([court, long] + [cout(d) for d in departs[1:-1]], key=lambda c: c[0])[1]


def secteurs(p, L, disques, aretes, coupe, depart):
    """Les secteurs `]de, a[` des angles, de `coupe` moins un tour à `coupe`, où l'os de longueur `L` parti de `p` passe
    à moins du jeu d'un disque à sa portée, ou de la bande que tend une arête entre ses deux disques, et, par secteur,
    s'il la touche par son corps (sinon par son seul bout). L'os ne voit pas un disque à moins de `depart` de `p`."""
    w = disques[:, :2] - p
    D = np.maximum(np.linalg.norm(w, axis=1), 1e-9)
    pres = D - disques[:, 2] - depart
    R = disques[:, 2] + JEU_M * np.clip(pres / DEPART_M, 0.0, 1.0)
    portee = np.minimum(L + R - D, pres)
    tangent = np.sqrt(np.maximum(D * D - R * R, 0.0)) <= L
    demi = np.where(tangent, np.arcsin(np.minimum(1.0, R / D)), np.arccos(np.clip((D * D + L * L - R * R) / (2 * D * L), -1, 1)))
    centre = coupe - np.mod(coupe - np.arctan2(w[:, 0], w[:, 1]), 2 * np.pi)
    A, B = np.concatenate([aretes[:, 0], aretes[:, 1]]), np.concatenate([aretes[:, 1], aretes[:, 0]])
    tour = centre[B] - centre[A]
    garde = (portee[A] > 0) & (np.abs(tour) < np.pi)
    A, B, tour = A[garde], B[garde], tour[garde]
    part = np.where(portee[B] > 0, 1.0, portee[A] / (portee[A] - np.minimum(portee[B], 0.0)))
    centre_b, demi_b = centre[A] + part * tour, np.where(portee[B] > 0, demi[B], 0.0)
    seul = portee > 0
    return (np.concatenate([(centre - demi)[seul], np.minimum(centre[A] - demi[A], centre_b - demi_b)]),
            np.minimum(np.concatenate([(centre + demi)[seul], np.maximum(centre[A] + demi[A], centre_b + demi_b)]), coupe),
            np.concatenate([tangent[seul], tangent[A] | (tangent[B] & (portee[B] > 0))]))


def sous_le_sol(z, L, hors_z, bas_z):
    """Le secteur `(de, a)` des angles où le bout de l'os de longueur `L`, parti de la hauteur `z` au-dessus du sol,
    passerait dessous, à l'infini s'il est vide ou si l'os part de dessous ; `hors_z`, `bas_z` : les hauteurs des deux
    axes du plan du brin."""
    M = np.hypot(hors_z, bas_z)
    c = -z / L
    if M < 1e-9 or c <= -M or z < -1e-9:
        return np.inf, np.inf
    creux, demi = np.arctan2(-hors_z, -bas_z), np.pi - np.arccos(min(1.0, c / M))
    return creux - demi, creux + demi


def cuire(tente, images, temps, boucle):
    """Le drapé d'un clip : par image de `images`, `(racines, O, Q, obstacles, sol)`, ses articulations. Un clip en `boucle`
    se joue deux fois, pour que sa première image hérite de la dernière."""
    phi = None
    for _ in range(2 if boucle else 1):
        xs = []
        for i, image in enumerate(images):
            x, phi = tente.poser(*image, phi, temps[i] - temps[i - 1] if i else 0.0)
            xs.append(x)
    return xs
