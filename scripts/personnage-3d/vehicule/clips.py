"""Les clips d'un engin (#2987) : chaque clip anime des nœuds de la scène, échantillonné à chaque image, et s'exporte en
une animation glTF (une piste NLA du nom du clip par nœud, que l'export `NLA_TRACKS` fusionne d'un nœud à l'autre). Le
manifeste nomme le clip de chaque rôle (`ROLES_D_ANIMATION`, `src/noyau/animation.ts`) : `repos`, `marche` (le
déplacement, joué en boucle) et le rôle de son attaque, `tir` ou `melee`.

Un clip est `(role, nom, duree, pistes)`, `pistes` `{nœud: f(t) -> ((dx, dy, dz), (rx, ry, rz))}` : le déplacement et la
rotation (radians) du nœud depuis son repos à l'instant `t` (secondes). Chaque clip clé tous les nœuds qu'anime l'un des
clips : un nœud qu'il ne nomme pas y reste au repos.
"""
import math

import bpy

IMAGES = 24
# Une case de 2 m (LDB 15 l.12) en `DUREE_DEPLACEMENT_S` (`hotes/godot/projet/scripts/combattant.gd`).
VITESSE = 2.0 / 0.45
REPOS = ("repos", "repos", 1.0, {})
SECOUSSE = 0.02


def montee(u):
    """0 à 1, vite au départ."""
    u = min(max(u, 0.0), 1.0)
    return 1 - (1 - u) ** 2


def lisse(u):
    """0 à 1, lent aux deux bouts."""
    u = min(max(u, 0.0), 1.0)
    return u * u * (3 - 2 * u)


def coup(t, temps):
    """L'amplitude 0 → 1 → 0 d'un coup aux `temps` (montée, tenue, retour) : la montée rapide, la tenue, le retour lissé."""
    m, h, r = temps
    return montee(t / m) if t < m else 1.0 if t < m + h else 1 - lisse((t - m - h) / r)


def rouler(rayon, roues):
    """Le clip de déplacement d'un engin aux `roues` de `rayon` : un tour de roue à `VITESSE`, en boucle."""
    duree = 2 * math.pi * rayon / VITESSE
    f = lambda t: ((0, 0, 0), (2 * math.pi * t / duree, 0, 0))
    return ("marche", "marche", duree, {n: f for n in roues})


def cahoter(noeuds):
    """Le clip de déplacement d'un engin sans roues, que ses servants portent ou traînent : une secousse par case."""
    duree = 2.0 / VITESSE
    f = lambda t: ((0, 0, SECOUSSE * abs(math.sin(math.pi * t / duree))), (0, 0, 0))
    return ("marche", "marche", duree, {n: f for n in noeuds})


def tirer(T, temps, glisse, pieces, roues=(), rayon=1.0):
    """Le clip `tir` d'une pièce à feu aux `temps` (`coup`) de la table `T` : `recul` (m, vers l'arrière) de `glisse`,
    des `pieces` et des `roues` de `rayon`, tournées à rebours ; `ressaut` (degrés, bouche levée) des `pieces` ; le nœud
    `tourne` des `pieces`, un barillet, fait `tours` tours sur son axe y."""
    duree = sum(temps)
    recul = lambda t: T["recul"] * coup(t, temps)
    pistes = {n: lambda t: ((0, recul(t), 0), (0, 0, 0)) for n in glisse}
    pistes |= {n: lambda t: ((0, recul(t), 0), (-recul(t) / rayon, 0, 0)) for n in roues}
    for n in pieces:
        tour = 2 * math.pi * T.get("tours", 0) if n == T.get("tourne") else 0.0
        pistes[n] = lambda t, tour=tour: ((0, recul(t), 0), (-math.radians(T["ressaut"]) * coup(t, temps), tour * lisse(t / duree), 0))
    return ("tir", "tir", duree, pistes)


def animer(clips):
    """Les `clips` clés sur les objets de la scène, rend la table rôle → clip du manifeste."""
    objets = {o.name: o for o in bpy.data.objects}
    animes = sorted({n for _, _, _, pistes in clips for n in pistes})
    repos = {n: (tuple(objets[n].location), tuple(objets[n].rotation_euler)) for n in animes}
    immobile = lambda t: ((0, 0, 0), (0, 0, 0))
    for _, nom, duree, pistes in clips:
        images = max(1, round(duree * IMAGES))
        for n in animes:
            o, (l0, r0), f = objets[n], repos[n], pistes.get(n, immobile)
            o.animation_data_create()
            action = bpy.data.actions.new(f"{nom}.{n}")
            o.animation_data.action = action
            for i in range(images + 1):
                dl, dr = f(i / IMAGES)
                o.location = tuple(a + b for a, b in zip(l0, dl))
                o.rotation_euler = tuple(a + b for a, b in zip(r0, dr))
                o.keyframe_insert("location", frame=i)
                o.keyframe_insert("rotation_euler", frame=i)
            o.animation_data.action = None
            piste = o.animation_data.nla_tracks.new()
            piste.name = nom
            piste.strips.new(nom, 0, action)
    for n in animes:
        objets[n].location, objets[n].rotation_euler = repos[n]
    return {"clips": {role: nom for role, nom, _, _ in clips}}
