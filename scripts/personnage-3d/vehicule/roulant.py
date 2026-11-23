"""Les trains des véhicules à roues (#4471), engin de siège ou coque terrestre : chaque train de la table `TRAINS` des
données d'un modèle, en mètres, bâti de la roue à rais et du train que partagent les décors (`decor/geometrie.py`, que
ce module met au chemin des modèles), ses roues chacune à son nœud, à son essieu, et la table de leur roulement
(`clips.rouler`).

Un train `{nom: T}` : `y` de son essieu ; `voie` : x du plan de chaque roue ; `rayon` de la roue, hauteur de l'essieu ;
`largeur` de son bandage ; `pans` de sa jante ; `bandage` : son épaisseur ; `moyeu` : son rayon, sa demi-longueur ;
`essieu` : demi-côté du corps d'essieu de bois, chanfrein de ses arêtes ; `fusee` : rayon de l'essieu de fer, saillie
au-delà du plan de chaque roue, côtés ; `cales`, s'il en porte : x de leur axe de chaque côté, hauteur de leur tête,
demi-longueur le long de la route, demi-largeur ; `tours` : tours de roue par boucle du clip de déplacement, le chemin
d'une boucle, tours × circonférence, étant le même à tous les trains. Ses nœuds : `roue_<nom>g` à gauche (+x),
`roue_<nom>d` à droite."""
import sys
from pathlib import Path

from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "decor"))

import geometrie  # noqa: E402
from maille import Maille  # noqa: E402

COTES = (("g", 1), ("d", -1))


def roulement(table):
    """La table du roulement des trains de `table` (`clips.rouler`) : {nœud: (rayon, tours par boucle)}."""
    return {f"roue_{nom}{cote}": (T["rayon"], T["tours"]) for nom, T in table.items() for cote, _ in COTES}


def trains(table, chassis, bois, fer):
    """Les trains de `table` : l'essieu, la fusée et les cales de chacun dans la maille `chassis` (matériaux `bois` et
    `fer`), ses deux roues cerclées chacune dans sa maille. Rend les roues, {nœud: (maille, centre)}."""
    roues = {}
    for nom, T in table.items():
        gauche, droite = (Vector((signe * T["voie"], T["y"], T["rayon"])) for _, signe in COTES)
        demi, arete = T["essieu"]
        cales = []
        if "cales" in T:
            x, tete, long, large = T["cales"]
            cales = [(Vector((signe * x, T["y"], T["rayon"])), tete, long, large) for _, signe in COTES]
        geometrie.train(chassis, gauche, droite, demi, arete, cales, (chassis, fer.name, *T["fusee"]))
        for (cote, _), centre in zip(COTES, (gauche, droite)):
            roue = Maille([bois, fer])
            geometrie.roue(roue, "x", centre, T["rayon"] - T["bandage"] / 2, T["largeur"], T["pans"],
                           (roue, bois.name, *T["moyeu"]), bandage=(roue, fer.name, T["bandage"]))
            roues[f"roue_{nom}{cote}"] = (roue, tuple(centre))
    return roues
