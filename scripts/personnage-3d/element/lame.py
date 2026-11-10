"""Kit des armes à lame (#3743) : la fusée, la garde, le pommeau et la lame d'une arme tenue à une main, et son fourreau,
dans le repère de la prise `main` de la base : +Y de l'auriculaire vers l'index, la lame vers +Y ; +Z du poignet vers
les jointures, le tranchant sur Z ; +X l'axe de la paume, le plat sur X. L'arme et son fourreau sont deux objets ; le
fourreau porte la propriété `fourreau` (exportée en `extras.fourreau`, `element/construire.py`), que le montage ne montre
que l'arme rangée (`hotes/godot/pont/CONTRAT.md`, section « Atelier 3D »). Chaque donnée vient du `donnees.py` de
l'arme ; mètres."""
from maille import Maille, cylindre, objet, poutre, tour


def construire(D, materiaux):
    nom = f"humanoide--rigide--{D['MANIFESTE']['cle']['apparence']}"
    x, z = D['AXE_DANS_LA_PRISE']
    F, G, L, P, S = D['FUSEE'], D['GARDE'], D['LAME'], D['POMMEAU'], D['FOURREAU']
    axe = (x, 0.0, z)
    arme = Maille(list(materiaux.values()))
    haut = F['longueur'] / 2
    cylindre(arme, -haut, haut, F['rayon'], 'y', axe, F['segments'], 'cuir')
    garde = haut + G['epaisseur'] / 2
    poutre(arme, (x, garde, z - G['longueur'] / 2), (x, garde, z + G['longueur'] / 2), G['largeur'], G['epaisseur'],
           (0, 1, 0), 'metal')
    talon = haut + G['epaisseur']
    pointe = talon + L['longueur']
    epaisseur, largeur = L['epaisseur'] / 2, L['largeur'] / 2
    tour(arme, [(talon, 0), (talon, epaisseur, largeur), (pointe - L['pointe'], epaisseur, L['largeur_a_la_pointe'] / 2),
                (pointe, 0)], 'y', axe, 4, 'metal')
    r, h = P['rayon'], P['hauteur']
    tour(arme, [(-haut, 0), (-haut, P['col']), (-haut - h / 2, r), (-haut - h, P['col']), (-haut - h, 0)], 'y', axe,
         P['segments'], 'metal')

    gaine = Maille(list(materiaux.values()))
    paroi, bout = S['paroi'], pointe + S['bout']
    bord = (epaisseur + paroi + S['saillie'], largeur + paroi + S['saillie'])
    corps = (epaisseur + paroi, largeur + paroi)
    fin = (epaisseur + paroi, L['largeur_a_la_pointe'] / 2 + paroi)
    profil = [(talon, 0), (talon, *bord), (talon + S['chape'], *bord), (talon + S['chape'], *corps),
              (bout - S['bouterolle'], *fin), (bout - S['bouterolle'], *(c + S['saillie'] for c in fin)), (bout, 0)]
    tour(gaine, profil, 'y', axe, S['segments'], ['metal', 'metal', 'metal', 'cuir', 'cuir', 'metal'])
    fourreau = objet(f'{nom}--fourreau', gaine, (0.0, 0.0, 0.0), D['ANGLE_LISSE'])
    fourreau['fourreau'] = True
    return [objet(nom, arme, (0.0, 0.0, 0.0), D['ANGLE_LISSE']), fourreau]
