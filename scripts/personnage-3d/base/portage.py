"""Portage des os par les silhouettes à os (#4002 issuecomment-6817454030).

- Axe de chair d'un os (`axes_de_chair`) : la droite par le centroïde de sa chair pondéré par ses poids ; verticale
  monde pour le tronc (`TRONC`), direction de l'os ailleurs ; un os latéralisé du tronc prend l'axe de son premier
  ancêtre non latéralisé.
- Tête portée (`tetes_portees`) : D_b − D_p = P_b(j) − P_p(j), j la tête de b, P la projection sur un axe de chair ;
  P(j) = j pour un os sans axe ou rigide ; D_b = D_p sous un parent sans axe ou rigide ; 0 à la racine.
- Table locale (`table_locale`, `deplacements_du_manifeste`) : champ `osDesSilhouettes` du manifeste, hotes/godot/pont/CONTRAT.md,
  « Gabarit d'une base ».
- Stockage sur l'armature (`ecrire_os_des_silhouettes`, `lire_os_des_silhouettes`) : la table qui a fait les clés.
"""
import json

import numpy

from anatomie import zone_de_l_os
from poids import peau_lineaire

OS_DES_SILHOUETTES = 'osDesSilhouettes'
"""Le champ du manifeste et la propriété personnalisée de l'armature qui portent la table locale par silhouette."""
TRONC = ('torse', 'hanches', 'cou')
"""Les zones (`zone_de_l_os`) dont l'axe de chair est la verticale monde."""
VERTICALE = numpy.array([0.0, 0.0, 1.0])


def lateralise(nom):
    """Vrai si l'os `nom` porte un côté, suffixe `_l`/`_r` (`anatomie.zone_de_l_os`)."""
    return '_' in nom and nom.rsplit('_', 1)[-1] in ('l', 'r')


def projete(axe, p):
    """Le point le plus proche de chaque point `p` (…, 3) sur l'axe `axe` (point, direction unitaire)."""
    point, direction = axe
    return point + ((p - point) @ direction)[..., None] * direction


def axes_de_chair(squelette, corps):
    """Par nom d'os de `squelette` porteur de chair de `corps` (masse de poids > 0), `(point, direction)` de son axe
    de chair, repère monde."""
    noms = [b.name for b in squelette.data.bones]
    x, w = peau_lineaire(corps, noms)
    x, w = x[:, :3].astype(numpy.float64), w.astype(numpy.float64)
    masse = w.sum(axis=0)
    monde = numpy.array(squelette.matrix_world.to_3x3())
    propres = {}
    for i, b in enumerate(squelette.data.bones):
        if masse[i] > 0:
            direction = (VERTICALE if zone_de_l_os(b.name) in TRONC
                         else monde @ numpy.array(b.tail_local - b.head_local))
            propres[b.name] = ((w[:, i] @ x) / masse[i], direction / numpy.linalg.norm(direction))
    axes = {}
    for nom in propres:
        porteur = squelette.data.bones[nom]
        if zone_de_l_os(nom) in TRONC:
            while lateralise(porteur.name):
                porteur = porteur.parent
        if porteur.name not in propres:
            raise RuntimeError(f'os « {nom} » : ancêtre « {porteur.name} » sans chair, aucun axe de tronc')
        axes[nom] = propres[porteur.name]
    return axes


def tetes_portees(squelette, axes, rigides):
    """Par nom d'os de `squelette`, le déplacement monde de sa tête par unité de (rapport − 1), sous les axes de chair
    `axes` (`axes_de_chair`) et les os `rigides` (`silhouettes.extremites`)."""
    monde = numpy.array(squelette.matrix_world)
    portees = {}

    def porter(b):
        if b.name not in portees:
            d = numpy.zeros(3)
            if b.parent is not None:
                d = porter(b.parent).copy()
                p = b.parent.name
                if p in axes and p not in rigides:
                    j = (monde @ numpy.array([*b.head_local, 1.0]))[:3]
                    d += (projete(axes[b.name], j) if b.name in axes and b.name not in rigides else j) - projete(axes[p], j)
            portees[b.name] = d
        return portees[b.name]

    for b in squelette.data.bones:
        porter(b)
    return portees


def reperes_des_parents(squelette):
    """Par nom d'os à parent de `squelette`, la 3×3 monde du repère de repos de son parent."""
    monde = squelette.matrix_world
    return {b.name: numpy.array((monde @ b.parent.matrix_local).to_3x3()) for b in squelette.data.bones if b.parent}


def table_locale(squelette, deplacements_monde):
    """La table locale du manifeste des déplacements monde `deplacements_monde` (nom d'os -> tête déplacée) : par os à
    déplacement non nul relativement à son parent, (D_b − D_p) au repère de repos du parent, triplet de floats."""
    reperes = reperes_des_parents(squelette)
    table = {}
    for b in squelette.data.bones:
        if b.parent is not None:
            pas = deplacements_monde[b.name] - deplacements_monde[b.parent.name]
            if pas.any():
                table[b.name] = [float(v) for v in numpy.linalg.solve(reperes[b.name], pas)]
    return table


def deplacements_du_manifeste(squelette, table):
    """Réciproque de `table_locale` : par nom d'os de `squelette`, le déplacement monde de sa tête, cumul de la table
    locale `table` le long de la hiérarchie."""
    reperes = reperes_des_parents(squelette)
    deplacements = {}

    def cumuler(b):
        if b.name not in deplacements:
            d = numpy.zeros(3)
            if b.parent is not None:
                d = cumuler(b.parent) + (reperes[b.name] @ numpy.array(table[b.name]) if b.name in table else 0.0)
            deplacements[b.name] = d
        return deplacements[b.name]

    for b in squelette.data.bones:
        cumuler(b)
    return deplacements


def portage(w, noms, deplacements_monde):
    """C = w @ D : par sommet de poids `w` (sommets, os) sur les os `noms`, la moyenne pondérée des déplacements monde
    `deplacements_monde` (nom d'os -> tête déplacée) de ses os : (sommets, 3)."""
    return numpy.asarray(w, dtype=numpy.float64) @ numpy.array([deplacements_monde[n] for n in noms])


def ecrire_os_des_silhouettes(squelette, tables):
    """Pose sur l'armature `squelette` la table locale par silhouette `tables` (nom -> `table_locale`)."""
    squelette[OS_DES_SILHOUETTES] = json.dumps(tables)


def lire_os_des_silhouettes(squelette):
    """La table locale par silhouette posée sur l'armature `squelette` (`ecrire_os_des_silhouettes`), `{}` sans elle."""
    return json.loads(squelette.get(OS_DES_SILHOUETTES, '{}'))
