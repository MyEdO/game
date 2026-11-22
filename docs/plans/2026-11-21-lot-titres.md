# Lot de nature : titres de cadre et de panneau

Ticket: #4585

(#4585 : vérification du contenu entre états et restes de la revue des maquettes.)

Premier lot de nature du plan `docs/plans/2026-11-21-maquettes-en-donnees.md` (règle 7, étape 3). Ce document porte la partie « choisir sur image » : l'inventaire des titres rendus, la forme cible proposée et les sites où elle ne tient pas. Aucune migration n'est faite ici. La planche est `hotes/godot/cibles/propositions/sources/kit/planche-titres.html`.

## Méthode

- **Source** : le DOM des 170 états rendus en 16:9 (1280 × 720), lu par une sonde Playwright : tout texte en Grenze Gotisch, les `h1` à `h6`, `.ruban`, `.rub`, `.bloc-t`, `.bande`. Pour chacun : styles calculés, rect, fond (plus proche ancêtre `.parchemin`, `.bois`, plaque, ruban ; « scène » sinon).
- **Relevé** : 2 004 textes, 146 signatures de rendu distinctes. Le rôle est attribué par le chemin dans le DOM (règle écrite, pas état par état) : quelques sites sont à la frontière de deux rôles, le cas net est « Round 1 » de la tête du combat (`.fond.bois > .n.gothique`, 30 / 30 sur bois, 55 états), rangé par la règle avec les noms alors qu'il est un titre de panneau : il s'ajoute aux 26 rendus de ce rôle et n'est pas simulé.
- **Une variante** = fond, police, taille, interligne, marge, couleur, inter-lettre, ombre ou trait distincts au rendu.
- **Limite** : seul le 16:9 est sondé ; 21:9, 16:10 et `bureau` ne le sont pas.

## Variantes réelles par rôle

| Rôle | Variantes | Sites | Dans le lot |
|---|---|---|---|
| titre d’écran (cartouche) | 6 | 70 sur 70 états | oui |
| titre de cadre (ruban) | 2 | 252 sur 157 états | oui |
| titre de panneau | 26 | 91 sur 70 états | oui |
| intertitre de bloc | 9 | 154 sur 27 états | oui |
| nom (personne, objet) | 25 | 586 sur 147 états | proposé, non simulé |
| nom d’entrée (ligne de liste) | 27 | 183 sur 46 états | proposé, non simulé |
| titre libre | 5 | 10 sur 4 états | inchangé |
| bande de caractéristiques | 1 | 11 sur 11 états | non |
| chiffre | 31 | 538 sur 104 états | non |
| issue | 4 | 22 sur 22 états | non |
| nom de plaque (lot plaques) | 9 | 69 sur 27 états | non |
| note ou étiquette en .rub | 3 | 18 sur 9 états | non |

Les cinq dernières lignes ne sont pas des titres : chiffres en gothique (sceaux, disques, seuils, sommes), bande de caractéristiques, bannière et mot d'issue, noms dans une plaque (lot plaques), et 18 `.rub` qui sont des notes ou des étiquettes (`.rub` en Spectral, `.rub.designer`, `.consequence.rub` : lot notes et étiquettes).

Ce que le DOM montre et que la carte (§ 9.2) n'avait pas : `.dom` à 36 et 28 px (compendium, options), `.dr` employé en titre de 24 à 34 px (critique, annonce, verdict), `.page-c > .nom` à 28 px, `.feuillet .lieu` rendu à 24 px (27 px déclarés à `sauvegardes.css:5`), les têtes du compendium (30, 24, 22 px), et le cartouche de titre rendu à 31, 30, 29, 27 et 21 px : 29 px est une surcharge de la famille voyage, 30, 27 et 21 px viennent de la réduction par script (`rendu.js:1820`).

### titre d’écran (cartouche) : 6 variantes, 70 sites, 70 états
| Fond | Police | Taille | Interligne | Marge | Couleur | Inter-lettre | Ombre, trait | Sites | Lignes max | Écrans (sélecteur) |
|---|---|---|---|---|---|---|---|---|---|---|
| bois | Grenze Gotisch | 31 | 44 | -6 0 -5 | (243,230,198) | 0.3 | ombre | 42 | 1 | bataille-de-masse, butin, carnet, carte-du-monde +14 (`div > div.n.gothique`) |
| bois | Grenze Gotisch | 31 | 50 | -9 0 -8 | (243,230,198) | 0.3 | ombre | 8 | 1 | coop, fin-de-seance, options, sauvegardes (`div > div.n.gothique`) |
| bois | Grenze Gotisch | 30 | 44 | -6 0 -5 | (243,230,198) | 0.3 | ombre | 2 | 1 | le-bord, nuit (`div > div.n.gothique`) |
| bois | Grenze Gotisch | 29 | 42 | -9 0 | (243,230,198) | 0.3 | ombre | 14 | 1 | course-poursuite-en-mer, evenement-de-route, voyage-en-mer, voyage-fluvial (`div > div.n.gothique`) |
| bois | Grenze Gotisch | 27 | 44 | -6 0 -5 | (243,230,198) | 0.3 | ombre | 3 | 1 | arrivee (`div > div.n.gothique`) |
| bois | Grenze Gotisch | 21 | 44 | -6 0 -5 | (243,230,198) | 0.3 | ombre | 1 | 1 | nuit (`div > div.n.gothique`) |

### titre de cadre (ruban) : 2 variantes, 252 sites, 157 états
| Fond | Police | Taille | Interligne | Marge | Couleur | Inter-lettre | Ombre, trait | Sites | Lignes max | Écrans (sélecteur) |
|---|---|---|---|---|---|---|---|---|---|---|
| ruban | Grenze Gotisch | 18 | normal | 0 | (243,230,198) | 0.6 |  | 206 | 2 | arrivee, bataille-de-masse, butin, carte-du-monde +44 (`div#jet.cadre.bois > div.ruban.gothique`) |
| ruban | Fell SC | 14.5 | normal | 0 | (243,230,198) | 1.1 |  | 46 | 1 | arrivee, carnet, chapitre, coop +12 (`div#trajet.cadre.bois > div.ruban.rubrique`) |

### titre de panneau : 26 variantes, 91 sites, 70 états
| Fond | Police | Taille | Interligne | Marge | Couleur | Inter-lettre | Ombre, trait | Sites | Lignes max | Écrans (sélecteur) |
|---|---|---|---|---|---|---|---|---|---|---|
| bois | Grenze Gotisch | 30 | 36 | 0 | (244,232,202) | 0.3 |  | 1 | 1 | compendium (`div.tete-d-index > span.gothique`) |
| bois | Grenze Gotisch | 28 | 42 | -6 0 -5 | (243,230,198) | normal | ombre | 2 | 1 | carte-du-monde (`div.place > h3`) |
| bois | Grenze Gotisch | 24 | 32 | -6 6 -4 0 | (244,232,202) | 0.3 |  | 4 | 1 | compendium (`div#barre-du-compendium.bois > span.nom.gothique`) |
| bois | Grenze Gotisch | 23 | 32 | -4 0 -3 | (244,232,202) | normal | ombre | 4 | 1 | interlude (`div.place > h3`) |
| bois | Grenze Gotisch | 22 | 30 | -5 0 -4 | (244,232,202) | 0.3 |  | 4 | 1 | editeur-carte-du-monde, editeur-de-scene (`div > div.nom.gothique`) |
| bois | Grenze Gotisch | 22 | 32 | 0 | (244,232,202) | 0.3 |  | 4 | 1 | compendium (`div.tete-de-liste > span.gothique`) |
| parchemin | Grenze Gotisch | 36 | 58 | -12 0 -10 | (58,26,16) | 0.3 |  | 4 | 1 | compendium (`div.tete > span.dom.gothique`) |
| parchemin | Grenze Gotisch | 34 | 40 | 0 | (58,26,16) | 0.5 |  | 2 | 2 | document (`div.tete > h2`) |
| parchemin | Grenze Gotisch | 34 | 50 | -9 0 -7 | (58,26,16) | 0.3 |  | 6 | 1 | evenement-de-route, voyage-en-mer, voyage-fluvial (`div.tete > h2`) |
| parchemin | Grenze Gotisch | 34 | normal | 0 | (58,26,16) | 0.3 |  | 3 | 1 | contre-sort, debut-du-round (`div.annonce > div.dr.gothique`) |
| parchemin | Grenze Gotisch | 31 | normal | 0 | (58,26,16) | 0.3 |  | 5 | 1 | coup-critique, incantation, maladresse (`div.tete-c > div.dr.gothique`) |
| parchemin | Grenze Gotisch | 30 | 42 | -8 0 | (58,26,16) | 0.3 |  | 1 | 1 | carnet (`div.tete > h3`) |
| parchemin | Grenze Gotisch | 30 | 44 | -8 0 | (58,26,16) | 0.3 |  | 4 | 1 | editeur-carte-du-monde, editeur-de-scene (`div.place > h3.gothique`) |
| parchemin | Grenze Gotisch | 30 | 44 | -8 0 -6 | (58,26,16) | 0.3 |  | 1 | 1 | nuit (`div.place > h3`) |
| parchemin | Grenze Gotisch | 28 | 32 | 0 | (58,26,16) | 0.3 |  | 3 | 1 | options (`div.tete > span.dom.gothique`) |
| parchemin | Grenze Gotisch | 28 | 40 | 0 | (58,26,16) | 0.3 |  | 9 | 1 | changement-de-carriere, creation (`div.page-c > div.nom`) |
| parchemin | Grenze Gotisch | 28 | 40 | 4 0 0 | (58,26,16) | 0.3 |  | 4 | 1 | creation (`div.page-c > div.nom`) |
| parchemin | Grenze Gotisch | 28 | 44 | -6 0 -8 | (58,26,16) | 0.3 |  | 3 | 1 | nouvelle-partie (`div.affiche.parchemin > div.n.gothique`) |
| parchemin | Grenze Gotisch | 27 | 42 | -10 0 -9 | (58,26,16) | 0.3 |  | 10 | 1 | halle, marchandage, port (`div.tete > h3`) |
| parchemin | Grenze Gotisch | 26 | 32 | 0 | (58,26,16) | 0.3 |  | 1 | 1 | incantation (`div.sort > div.dr.gothique`) |
| parchemin | Grenze Gotisch | 24 | 32 | 0 | (58,26,16) | normal |  | 2 | 1 | bataille-de-masse (`div.milieu > div.dr`) |
| parchemin | Grenze Gotisch | 24 | 32 | 0 | (58,26,16) | 0.3 |  | 1 | 1 | butin (`div.trouve > div.n.gothique`) |
| parchemin | Grenze Gotisch | 24 | 32 | -4 0 | (58,26,16) | 0.3 |  | 2 | 1 | soins (`div.l > h3`) |
| parchemin | Grenze Gotisch | 24 | 40 | 0 | (58,26,16) | 0.5 |  | 2 | 1 | document (`h2 > span`) |
| parchemin | Grenze Gotisch | 24 | 40 | 8 0 -8 | (58,26,16) | 0.3 |  | 6 | 1 | sauvegardes (`div.fond.parchemin > div.lieu.gothique`) |
| parchemin | Grenze Gotisch | 24 | normal | 0 | (58,26,16) | 0.3 |  | 3 | 1 | course-poursuite-en-mer, poursuite-terrestre (`div.tete > span.dr.gothique`) |

### intertitre de bloc : 9 variantes, 154 sites, 27 états
| Fond | Police | Taille | Interligne | Marge | Couleur | Inter-lettre | Ombre, trait | Sites | Lignes max | Écrans (sélecteur) |
|---|---|---|---|---|---|---|---|---|---|---|
| parchemin | Fell SC | 13 | 16 | 0 | (90,42,18) | 1.1 |  | 132 | 3 | changement-de-carriere, creation, depense-d-experience, dossier +1 (`div.fait > div.rub`) |
| parchemin | Fell SC | 13 | 16 | 10 0 5 | (90,42,18) | 1.1 |  | 4 | 2 | creation (`div.page-c > div.rub`) |
| parchemin | Fell SC | 13 | 16 | 8 0 3 | (90,42,18) | 1.1 |  | 2 | 1 | creation (`div.page-c > div.rub`) |
| parchemin | Fell SC | 13 | 16 | 8 0 0 | (90,42,18) | 1.1 |  | 1 | 2 | depense-d-experience (`div.fond.parchemin > div.rub`) |
| parchemin | Fell SC | 13 | 16 | 6 0 0 | (90,42,18) | 1.1 |  | 6 | 1 | fiche-du-heros (`div.liste > div.rub`) |
| parchemin | Fell SC | 13 | normal | 0 0 6 | (90,42,18) | 1.1 | trait | 1 | 1 | tour-de-combat (`div.defile.au-pied.avant > h4.rubrique`) |
| parchemin | Fell SC | 13 | normal | 13 0 6 | (90,42,18) | 1.1 | trait | 1 | 1 | tour-de-combat (`div.defile.au-pied.avant > h4.rubrique`) |
| parchemin | Fell SC | 12.5 | normal | 18 0 8 | (74,52,32) | 1.1 | 1px/0px | 5 | 1 | dossier (`div.defile > div.bloc-t`) |
| scène | Fell SC | 13.5 | normal | 11 0 6 | (226,192,106) | 1.6 | ombre 0px/1px | 2 | 1 | chapitre (`div > div.bande.rubrique.ombre`) |

### nom (personne, objet) : 25 variantes, 586 sites, 147 états
| Fond | Police | Taille | Interligne | Marge | Couleur | Inter-lettre | Ombre, trait | Sites | Lignes max | Écrans (sélecteur) |
|---|---|---|---|---|---|---|---|---|---|---|
| bois | Grenze Gotisch | 30 | 30 | 0 | (241,228,196) | 0.3 | ombre | 55 | 1 | combat-naval, contre-sort, corruption-mutation, coup-critique +13 (`div.fond.bois > div.n.gothique`) |
| bois | Grenze Gotisch | 24 | 32 | -4 0 4 | (243,230,198) | normal | ombre | 12 | 1 | creation (`div.acquis > div.qui`) |
| bois | Grenze Gotisch | 22 | 30 | -4 0 -5 | (243,230,198) | 0.3 | ombre | 34 | 3 | arrivee, halle, marchandage, nuit +2 (`div > div.n.gothique`) |
| bois | Grenze Gotisch | 19 | normal | 0 | (246,234,208) | 0.3 | ombre | 8 | 1 | interlude (`div.qui > div.nom.gothique.ombre`) |
| bois | Grenze Gotisch | 17.5 | 28 | -3 0 | (244,232,202) | 0.3 | ombre | 247 | 1 | arrivee, bataille-de-masse, carte-du-monde, changement-de-carriere +18 (`div.qui > div.nom.gothique`) |
| bois | Grenze Gotisch | 17.5 | 28 | -3 0 | (201,185,149) | 0.3 | ombre | 3 | 1 | nouvelle-partie (`div.qui > div.nom.gothique`) |
| bois | Grenze Gotisch | 17 | 26 | -4 0 | (244,232,202) | 0.3 |  | 5 | 1 | chapitre (`div.qui > div.n.gothique`) |
| parchemin | Grenze Gotisch | 28 | 30 | 0 | (58,26,16) | 0.3 |  | 1 | 1 | tour-de-combat (`div > div.n.gothique`) |
| parchemin | Grenze Gotisch | 26 | 36 | -3 0 1 | (58,26,16) | 0.3 |  | 13 | 2 | changement-de-carriere, creation, depense-d-experience, dossier +1 (`div.q > div.nom`) |
| parchemin | Grenze Gotisch | 23 | 26 | 0 | (58,26,16) | 0.3 |  | 6 | 1 | dossier, tour-de-combat (`div.texte > div.n.gothique`) |
| parchemin | Grenze Gotisch | 22 | 24 | 0 | (58,26,16) | 0.3 |  | 18 | 1 | bataille-de-masse, compendium, course-poursuite-en-mer, designation-d-un-heros +7 (`div.tete > span.n.gothique`) |
| parchemin | Grenze Gotisch | 22 | 24 | 0 0 0 2 | (58,26,16) | 0.3 |  | 2 | 1 | jet-avant-le-de (`div.regle.localisation > span.gothique`) |
| parchemin | Grenze Gotisch | 22 | 30 | -4 0 -5 | (58,26,16) | 0.3 |  | 1 | 1 | creation (`div > div.n.gothique`) |
| parchemin | Grenze Gotisch | 21 | 24 | 0 | (58,26,16) | normal |  | 4 | 1 | bataille-de-masse (`div > div.n`) |
| parchemin | Grenze Gotisch | 21 | 32 | -5 0 -4 | (58,26,16) | 0.3 |  | 4 | 1 | fin-de-seance (`div.qui > div.n.gothique`) |
| parchemin | Grenze Gotisch | 21 | normal | -4 0 0 | (58,26,16) | 0.3 |  | 82 | 3 | combat-naval, contre-sort, corruption-mutation, coup-critique +20 (`div.place > div.n.gothique`) |
| parchemin | Grenze Gotisch | 20 | 30 | -4 0 -5 | (58,26,16) | 0.3 |  | 4 | 1 | fiche-du-heros (`div > div.n.gothique`) |
| parchemin | Grenze Gotisch | 19 | normal | 0 | (58,26,16) | 0.3 |  | 4 | 2 | coop (`div.qui > div.nom.gothique.ombre`) |
| parchemin | Grenze Gotisch | 17 | 18 | -4 0 0 | (58,26,16) | 0.3 |  | 1 | 1 | dissipation (`div.place > div.n.gothique`) |
| parchemin | Grenze Gotisch | 16 | 20 | 0 | (58,26,16) | 0.3 |  | 2 | 1 | incantation (`div > div.n.gothique`) |
| parchemin | Grenze Gotisch | 16 | 22 | 0 | (58,26,16) | 0.3 |  | 17 | 1 | combat-naval, defense, dissipation, evenement-de-route +5 (`div.place > div.sorte-du-jet.gothique`) |
| scène | Grenze Gotisch | 20 | 27 | 0 | (243,230,198) | 0.3 | ombre | 9 | 1 | combat-naval, tour-de-combat (`div#actif-nom > div.n.gothique`) |
| scène | Grenze Gotisch | 20 | 27 | 0 | (246,185,166) | 0.3 | ombre | 1 | 1 | tour-de-combat (`div#actif-nom > div.n.gothique`) |
| scène | Grenze Gotisch | 16 | normal | 0 | (246,234,208) | 0.3 | ombre | 45 | 1 | combat-naval, corruption-mutation, coup-critique, desengagement +9 (`div.qui > div.nom.gothique.ombre`) |
| scène | Grenze Gotisch | 16 | normal | 0 | (246,185,166) | 0.3 | ombre | 8 | 1 | contre-sort, defense, sauvetage-par-le-destin, tour-de-combat (`div.qui > div.nom.gothique.ombre`) |

### nom d’entrée (ligne de liste) : 27 variantes, 183 sites, 46 états
| Fond | Police | Taille | Interligne | Marge | Couleur | Inter-lettre | Ombre, trait | Sites | Lignes max | Écrans (sélecteur) |
|---|---|---|---|---|---|---|---|---|---|---|
| bois | Grenze Gotisch | 22 | 32 | -5 0 -4 | (244,232,202) | 0.3 |  | 1 | 1 | halle (`div > b.gothique`) |
| bois | Grenze Gotisch | 22 | 34 | -7 0 -6 | (244,232,202) | 0.3 |  | 2 | 1 | coop (`div > b.gothique`) |
| bois | Grenze Gotisch | 22 | 34 | -7 0 -6 | (240,200,180) | 0.3 |  | 1 | 1 | coop (`div > b.gothique`) |
| bois | Grenze Gotisch | 20 | 23 | 0 | (244,232,202) | 0.3 |  | 5 | 1 | arrivee, port (`div.ou > b`) |
| bois | Grenze Gotisch | 18.5 | 24 | -3 0 -2 | (243,230,198) | 0.3 |  | 4 | 1 | carte-du-monde (`div.q > b`) |
| bois | Grenze Gotisch | 16.5 | 21 | -3 0 -2 | (244,232,202) | 0.3 |  | 2 | 1 | interlude (`div > b`) |
| bois | Grenze Gotisch | 16 | 17 | 0 | (244,232,202) | 0.3 |  | 41 | 1 | bataille-de-masse, le-bord, nouvelle-partie, nuit (`div.et.bois > b`) |
| bois | Grenze Gotisch | 16 | 18 | 0 | (243,230,198) | 0.3 |  | 6 | 1 | carte-du-monde (`div > b`) |
| bois | Grenze Gotisch | 15.5 | 17 | 0 | (244,232,202) | 0.3 |  | 15 | 1 | interlude (`div > b`) |
| bois | Grenze Gotisch | 15 | 17 | 0 | (226,213,182) | 0.3 |  | 23 | 1 | bataille-de-masse, exploration, le-bord, nuit (`div.et.bois > b`) |
| bois | Grenze Gotisch | 15 | 17 | 0 | (141,132,116) | 0.3 |  | 1 | 4 | le-bord (`div.et.bois > b`) |
| parchemin | Grenze Gotisch | 24 | 30 | 0 6 0 0 | (58,26,16) | 0.3 |  | 1 | 1 | carnet (`div.indice > b.gothique`) |
| parchemin | Grenze Gotisch | 22 | 30 | -5 0 | (58,26,16) | 0.3 |  | 1 | 1 | coop (`div.r > b.gothique`) |
| parchemin | Grenze Gotisch | 21 | 24 | 0 | (58,26,16) | 0.3 |  | 2 | 1 | carnet (`div.tete > b.gothique`) |
| parchemin | Grenze Gotisch | 18.5 | 20 | 0 | (42,29,18) | 0.3 |  | 4 | 1 | soins (`div.t > b`) |
| parchemin | Grenze Gotisch | 18 | 20 | 0 | (42,29,18) | 0.3 |  | 17 | 1 | halle, marchandage, port (`div.l > b`) |
| parchemin | Grenze Gotisch | 18 | 24 | 0 | (58,26,16) | 0.3 |  | 1 | 1 | incantation (`div.t > b.gothique`) |
| parchemin | Grenze Gotisch | 18 | 30 | -4 0 | (58,26,16) | 0.3 |  | 12 | 1 | nouvelle-partie (`div.avis.parchemin > b.gothique`) |
| parchemin | Grenze Gotisch | 17.5 | normal | 0 | (42,29,18) | 0.3 |  | 12 | 1 | port (`div.ligne > b`) |
| parchemin | Grenze Gotisch | 17 | 22 | 0 | (42,29,18) | 0.3 |  | 13 | 2 | changement-de-carriere, depense-d-experience (`div.et > b`) |
| parchemin | Grenze Gotisch | 17 | 22 | 0 | a(42,29,18,0.5) | 0.3 |  | 1 | 1 | changement-de-carriere (`div.et > b`) |
| parchemin | Grenze Gotisch | 17 | 22 | 0 | a(42,29,18,0.6) | 0.3 |  | 2 | 1 | depense-d-experience (`div.t > b`) |
| parchemin | Grenze Gotisch | 17 | 36 | 0 | (42,29,18) | 0.3 |  | 1 | 2 | dossier (`label.champ > b`) |
| parchemin | Grenze Gotisch | 16 | 17 | 0 | (58,26,16) | 0.3 |  | 4 | 1 | butin (`div.q > b`) |
| parchemin | Grenze Gotisch | 16 | 22 | 0 | (42,29,18) | 0.3 |  | 2 | 1 | butin (`div.t > b`) |
| parchemin | Grenze Gotisch | 16 | 22 | -2 0 -4 | (42,29,18) | normal |  | 4 | 1 | nuit (`div.siege > b`) |
| parchemin | Grenze Gotisch | 15 | 17 | 0 | (58,26,16) | 0.3 |  | 5 | 1 | combat-naval (`div.q > b.gothique`) |

### titre libre : 5 variantes, 10 sites, 4 états
| Fond | Police | Taille | Interligne | Marge | Couleur | Inter-lettre | Ombre, trait | Sites | Lignes max | Écrans (sélecteur) |
|---|---|---|---|---|---|---|---|---|---|---|
| scène | Grenze Gotisch | 80 | 124 | -11 0 -21 | (233,220,192) | 0.5 |  | 4 | 1 | accueil, chapitre, menu-de-la-partie (`div.place > div.nom.gothique`) |
| scène | Grenze Gotisch | 34 | 42 | 0 | (239,226,192) | 0.6 | ombre | 1 | 1 | accueil (`div.place > div.campagne.gothique.ombre`) |
| scène | Grenze Gotisch | 28 | 38 | 0 | (239,226,192) | 0.5 | ombre | 2 | 1 | chapitre (`div.place > div.tome.gothique.ombre`) |
| scène | Grenze Gotisch | 24 | 34 | 0 | (243,230,198) | 0.5 | ombre | 2 | 1 | chapitre (`div.toile > span.gothique`) |
| scène | Fell SC | 13.5 | normal | 11 0 6 | (226,192,106) | 1.6 | ombre 0px/1px | 1 | 1 | chapitre (`div.place > div.bande.rubrique.ombre`) |





## Forme cible proposée

Un rôle, une forme par fond. Les valeurs sont prises aux variantes existantes. La marge négative fait partie de la forme : elle compense l'interligne de la gothique, et la **boîte nette** (interligne + marges) est ce qui place les voisins.

| Rôle | Primitive | Police | Taille / interligne | Marge | Boîte nette | Bois | Parchemin | Pris à |
|---|---|---|---|---|---|---|---|---|
| Titre d'écran | `cartouche({ taille: 'titre' })` | Grenze Gotisch 600, inter-lettre 0,3 | 31 / 44, une ligne | −6 0 −5 | 33 | `--ivoire`, ombre `0 2px 3px --noir` | sans objet : le cartouche de titre est sur bois | `gestes.css:70`, 42 états sur 70 |
| Titre de cadre | `ruban` | Grenze Gotisch 600, inter-lettre 0,6 | 18, une ligne | — | — | `--ivoire` sur ruban lie-de-vin | le même ruban | `gestes.css:74`, 206 sites sur 252 |
| Titre de panneau | `titre({ texte })`, à créer | Grenze Gotisch 600, inter-lettre 0,3 | 28 / 40, une ligne | −7 0 −5 | 28 | `--ivoire`, ombre `0 1px 2px --noir` | `--sepia`, sans ombre | 28 px existe sur les deux fonds (`carte.css:16`, `heros.css:79`) ; médiane de 22 à 36 |
| Intertitre de bloc | `rubrique({ texte })`, à créer | Fell SC, inter-lettre 1,1 | 13 / 16, une ligne | 0 (l'écart est du placement) | 16 | `--creme-2` | `--rouille` | `heros.css:27-28`, 148 sites sur 154 |
| Nom | `nom({ texte, taille })`, à créer | Grenze Gotisch 600, inter-lettre 0,3 | `grand` 22 / 30 · `moyen` 18 / 24 · `petit` 16 / 19 | 0 | 30 · 24 · 19 | `--ivoire` | `--sepia` | cartouche `ligne` 22, carte 16/19 ; 18 remplace 17, 17,5, 18,5, 19, 20, 21 |
| Titre libre | `titreLibre` | inchangé | 80 / 124 | inchangé | — | sur la scène seulement | — | une seule forme |

Ce que la cible retire :

- **Titre d'écran** : l'interligne 50 de la famille accueil et système (même boîte nette, 33) et les 29 px de la famille voyage. La réduction par script d'un nom long (`rendu.js:1820`) reste, portée par la primitive : c'est la seule taille variable, de 31 à 20 px.
- **Titre de cadre** : le ruban `rubrique` 14,5 px (46 sites, 16 écrans) passe en gothique 18 px. Les onglets (`.onglets .ruban`) ne sont pas des titres et gardent leur forme.
- **Titre de panneau** : les 26 rendus (22 à 36 px) deviennent un seul par fond. La simulation en couvre 19 ; les 7 autres sont les `.dr` employés en titre (5 rendus) et les deux titres de barre (Compendium 24 px, éditeur 22 px). `#lieu h3` est déclaré deux fois (`rendu.css:177` 23 / 32, `interlude.css:17` 26 / 36) : au rendu, les 4 `h3` de l'interlude sortent à 23 / 32, la déclaration à 26 px ne s'applique nulle part. Le sous-titre en taille 24 du document (`h2 > span`) prend la taille du titre. Les `.dr` de 24 à 34 px (critique, annonce de round, verdict) appartiennent à la primitive `verdict` et ne sont pas simulés ici.
- **Intertitre** : `titreDeBloc` (12,5 px, trait haut), le `h4` du journal (trait à droite) et les cinq marges de `.rub` deviennent la rubrique nue ; un trait voulu se pose par `filet()`. `bande()` du carton de fin de chapitre (13,5 px, or, sur la scène) reste à trancher avec le titre libre.
- **Nom** : proposé sur la planche, **non simulé** dans les écrans. Il touche 769 sites sur 147 états, des places de jet à largeur fixe aux lignes de liste : il se mesure dans son propre passage, après validation de l'échelle.

## Tenue de la forme cible : mesure

La forme cible des quatre premiers rôles a été **simulée** par une feuille injectée dans `rendre.mjs` (préchargement Playwright sous `node_modules/.cache/sondes/`, rien au dépôt), sur les 170 états en 16:9, avec leurs relevés réels. Le nom n'est pas simulé.

- **Relevés bloquants** : 167 états sur 170 restent sans relevé. `coupe`, `rogne`, `deborde`, `masque`, `contenu` (A) : aucun. Le texte reste à 12 px au moins : la plus petite taille de la cible est 13 px.
- **Rect des contenus** (`contenu`, comparé état par état à la passe d'avant) : 132 états inchangés, 38 états où une boîte change de hauteur ou de position.

### Sites où la forme cible ne tient pas

Le critère : un relevé bloquant, ou un voisin du titre qui se déplace.

| Site | États | Constat | Avant → cible |
|---|---|---|---|
| `nouvelle-partie`, affiche de campagne (`.affiche > .n`) | `coop`, `pretires`, `roster` | **relevé `chevauche`** : « On recherche : aventuriers courageux » sur « L'Ennemi Intérieur » ; l'affiche perd 2 px, les avis cloués remontent de 2 px | 28 / 44 (net 30) → net 28 |
| `document`, tête du carton | 2 | tête −16 px ; le filet et le texte remontent de 16 px, le texte gagne 22 px | 34 / 40 avec sous-titre en 24 px → 28 px |
| `interlude`, têtes des deux colonnes | 2 | titre +8 px ; le sous-titre et les forces descendent de 3 px | 23 / 32 (net 25) → 28 |
| `carnet`, tête de l'affaire | 1 | tête +2 px ; le filet, l'indice et le texte descendent de 2 px | 30 / 42 (net 26) → 28 |
| `carte-du-monde`, tête de destination | 2 | titre −2 px ; le sous-titre remonte de 3 px | 28 / 42 (net 31) → 28 |
| `nuit` (`jeux-de-taverne`), tête de la partie | 1 | titre −4 px ; le sous-titre remonte de 2 px | 30 / 44 (net 30) → 28 |
| `butin`, « Le corps du voyageur » | 1 | le bloc remonte de 7 px et gagne 3 px | 24 / 32 → 28 |

### Sites où seule la hauteur de la tête change

| Site | États | Écart mesuré | Avant → cible |
|---|---|---|---|
| `compendium`, tête de la fiche ; tête de l'index | 4 ; 1 | tête −7 px ; index −2 px | 36 / 58 → 28 ; 30 / 36 → 28 |
| `evenement-de-route`, `voyage-en-mer`, `voyage-fluvial`, tête du carton | 2, 3, 1 | tête −6 px | 34 / 50 → 28 |
| `halle`, `marchandage`, `port`, tête de page | 3, 2, 5 | tête +5 px | 27 / 42 (net 23) → 28 |
| `soins`, tête du patient | 2 | +4 px | 24 / 32 → 28 |
| `editeur-carte-du-monde`, `editeur-de-scene`, inspecteur | 1, 3 | titre −4 px | 30 / 44 → 28 |

Dans les têtes à place fixe (`data-place`), l'écart reste dans la tête : le corps ne bouge pas. Là où la tête pousse un corps (`document`, `carnet`, `interlude`), l'application du lot doit fixer la hauteur de la tête dans la table du gabarit.

Sans écart mesuré au relevé `contenu`, qui ne suit que les enfants directs d'une place ou d'un fond : titre d'écran (70 états), ruban (46 sites passés de rubrique à gothique), intertitres (154 sites), `creation` et `changement-de-carriere` (`.page-c > .nom`, déjà à 28 / 40), `options` (`.dom` 28 px), `sauvegardes` (`.feuillet .lieu`).

Non couvert par la mesure : la largeur d'un titre agrandi sur une ligne ; un titre que `contenu` ne suit pas (`.tete-de-liste` du Compendium passe de 22 à 28 px sans écart relevé, donc sans mesure) ; les places que `gestes.js` mesure au montage, la feuille simulée étant posée à `DOMContentLoaded` ; les formats 21:9, 16:10 et `bureau` ; les titres de barre (`#barre-du-compendium .nom` 24 px, barre de l'éditeur 22 px) et les `.dr` employés en titre, laissés hors de la simulation ; le nom.

## Images

- Planche : `hotes/godot/cibles/propositions/sources/kit/planche-titres.html` (feuille `titres` de `kit/planche.js`), rendue en code 0, relevé vide. Elle montre une sélection par taille : 9 des 20 rendus de titre de panneau sur parchemin, 4 des 6 sur bois, 6 tailles de nom sur parchemin ; le nom le plus fréquent (17,5 px sur bois, 247 sites, `rang`) n'y est pas.
- Avant / après simulés (hors dépôt) : `document`, `interlude` (`interlude-en-ville`), `compendium` (`consultation`), `evenement-de-route`.

## Réponses de l'utilisateur (2026-11-22)

Choix d'interface, révisable (pas une règle de jeu). Questions posées sur la planche et les quatre avant/après ; réponses verbatim :

1. Un seul ruban : « Un seul, gothique 18 (Recommandé) ». Le ruban `rubrique` 14,5 px passe en gothique 18 px ; les onglets gardent leur forme.
2. Titre de panneau : « 28 px partout (Recommandé) ». Une taille sur les deux fonds ; les sites qui ne tiennent pas se corrigent par leur disposition, jamais par une taille propre.
3. Intertitre : « Nu + filet() (Recommandé) ». La rubrique ne porte plus de trait ; un séparateur voulu est un `filet()` posé par la disposition.

Le nom (769 sites) n'était pas dans les questions : il se mesure dans son propre passage, après ce lot.

## Application (2026-11-22)

Appliqué en une passe, commits `c77ebcb454` et `2a0e16a601` sur `chantier/4585-catalogue`.

- **Primitives** : `titre({ texte, cle, ecran })` et `rubrique({ texte, note, fin })` naissent au kit (`hotes/godot/cibles/propositions/sources/gestes.js`, `gestes.css`). `ruban(texte)` n'a plus qu'une forme. `ecran` donne à un titre de barre la forme du cartouche de titre (Compendium, éditeurs).
- **Surcharges retirées** : toutes celles du relevé qui changeaient la forme d'un titre de ces rôles, dans 18 feuilles de famille. Il reste du placement : largeur, alignement, marges des intertitres.
- **Rôles rangés au titre de panneau** : en plus des 26 rendus du relevé, les `.dr` qui nomment un sujet (critique, maladresse, sort, round annoncé, test de poursuite) et `#round` de la tête du combat.
- **Exclus, avec le lot qui les traite** :
  - `#epreuve .milieu .dr` et `#verdict .dr` : lot issue ;
  - noms : passage `nom` ;
  - titre libre et `bande` : titre libre ;
  - noms de plaque : lot plaques ;
  - rubriques `.t` des panneaux : lot sous-titres et rubriques ;
  - `.rub` employé en note ou en étiquette : lot notes et étiquettes.
- **Document** : le titre et le sous-titre de la donnée forment un seul `titre()` sur une ligne.
- **Placement repris** :
  - barre des éditeurs : 62 → 66 ;
  - affiche de la nouvelle partie : le relevé `chevauche` disparaît ;
  - format `bureau` : deux débordements présents avant le lot (carton des parts du voyage en mer, fiche d'identité du tour) disparaissent.

### Preuve

- **Passe** (16:9) : 57 écrans, 170 états, 6 planches, aucun rouge.
- **Pixels contre `4ffccee6e0`** : 520 PNG diffèrent, soit 130 états × 4 formats. Ce sont exactement les 130 états attendus, dérivés du relevé avant toute édition (états qui portent au moins un site du lot dont la signature diffère de la cible) : aucun attendu inchangé, aucun changé hors liste.
- **Sonde sur le rendu appliqué** :
  - titre d'écran : 31 / 44, plus les seules tailles de la réduction par script ;
  - ruban : une signature sur 252 sites ;
  - titre de panneau : 28 / 40, une forme par fond. Les 11 sites posés dans une `colonne` ont une marge 0, celle de la place (`.colonne>.place>*`) ;
  - intertitre : Fell SC 13 / 16. Ses marges sont du placement.
- **Relevés 21:9, 16:10, `bureau`** : 59 relevés non vides. 57 sont identiques à ceux de `4ffccee6e0` rendus avec leurs polices. Les 2 autres ont perdu le débordement corrigé.

### Hors lot, présent avant le lot

- `bureau` : `habille` (« fond hors de sa boîte ») sur tous les états ; `croise: carton x fenetre` (`voyage-en-mer`, `mer-fuite-de-vapeur`).
- 16:10 : `bataille-de-masse`, `le-bord`, `port` ; 21:9 : `port`.
- Carton des parts du voyage en mer (`carton/parts`) : la ligne « Total » dépasse son panneau intérieur d'environ 3 px.
