# Lot de nature : lignes libellé-valeur, rubriques, sous-titres, notes

Ticket: #4585

(#4585 : vérification du contenu entre états et restes de la revue des maquettes.)

Partie « textes » de l'arrêt unique des natures restantes (choix de l'utilisateur du 2026-11-22 : « Un seul arrêt (Recommandé) »), au modèle de `docs/plans/2026-11-21-lot-titres.md`. Rien n'est migré ici. Planche : `hotes/godot/cibles/propositions/sources/kit/planche-textes.html` (feuille `kit/proposition-textes.js`).

## Méthode

- **Source** : le DOM des 170 états rendus en 16:9 (1280 × 720), lu par une sonde Playwright (hors dépôt, `node_modules/.cache/sondes/textes/textes.mjs`) : tout élément à texte propre (8 722), et les conteneurs de ligne (`.regle`, `.ligne`, `.porteur-ligne`, `.prop`, `.pref`, `.fait`, `div.a`, `.mesure`, `.bl`, `tr`, `.enjeu`, `.points`, `.total`, `.consequence` : 959). Pour chacun : styles calculés, rect, fond (plus proche ancêtre `.parchemin`, `.bois`, plaque, ruban ; « scène » sinon).
- **Rôle** : attribué par le chemin DOM (règle écrite `classer.mjs`) :
  - hors du groupe, quel que soit le rôle : tout ce qui est sous une plaque, un `.pill`, `.tag`, `.modif`, `.chip`, `.jeton`, `.puce`, `.etat-porte`, `.marque`, `.segments`, `.issue`, un signet, des onglets, une bulle de refus, un retour, un outil, un compteur, un ruban ; toute gothique ;
  - **note** : `span.rub`, `.rub.designer`, `.consequence.rub`, `.rub > .note` (`noteDeRub`), `.consigne`, `.phrase-du-jet`, `.note`, `.aide` et `.pref > p`, `.pied`, `.prose.note`, la place `note` ;
  - **rubrique** : `.rub` (intertitre), `.bande`, `.bloc-t`, `h4` ; `.t` et `.r.rubrique` (panneau ; `#recit .r` : récit), `.tete.rubrique.ombre` (tête du journal), `.intertitre`, `.groupe.rubrique` ;
  - **sous-titre** : `.sous`, `.s.rubrique` (cartouche, rang), `.c.rubrique` et `.qui > .c` (sous un nom de place), `.car.rubrique` (carrière sous un nom de rang) ;
  - **ligne** : le conteneur, son premier enfant (libellé) et le deuxième (valeur). `.ligne` n'est retenue que si son libellé est une `.rubrique` (les `.ligne` à `span.n` sont des lignes de liste, autre groupe).
- **Une variante** = fond, police, taille, interligne, couleur, inter-lettre, style ou ombre distincts au rendu. Les marges sont du placement (doctrine du lot titres). Pour une ligne : police, taille et couleur du libellé, police, taille et graisse de la valeur, pose de la valeur (à droite, dessous, à la suite), hauteur et bordures.
- **Limite** : seul le 16:9 est sondé.

## Variantes réelles par rôle

| Nature | Rôle | Variantes | Sites | États |
|---|---|---|---|---|
| ligne | ligne libellé-valeur (14 constructions) | 60 | 375 | voir table |
| rubrique | intertitre de bloc | 2 | 146 | 27 |
| rubrique | rubrique de panneau | 18 | 173 | 83 |
| rubrique | récit | 1 | 16 | 16 |
| sous-titre | `.car` (sous un nom de rang) | 2 | 250 | 70 |
| sous-titre | `.s` (cartouche, rang) | 6 | 132 | 79 |
| sous-titre | `.c` (sous un nom de place) | 12 | 118 | 81 |
| sous-titre | `.sous` | 12 | 88 | 78 |
| note | 9 rôles | 20 | 142 | voir table |

Libellés en Fell SC des lignes (colonne « Libellé » de la table des lignes) : 11 px (61 sites, `acquis`), 12 px (35 : `regle` de la fenêtre du bas, `tr` sur bois, `total`), 12,5 px (67 : `ligneDu`, `mesure`, `enjeu`, `points`), 13 px (40 : `fait`, `bl`, déjà `rubrique()`), 14 px (5 : `consequence`). Libellés en Spectral : 13 à 15,5 px (`tr` du commerce et des jets, `prop`, `regleMaison`, `pref`, `porteur-ligne`).

### ligne libellé-valeur
| Ligne | Fond | Libellé | Valeur | Valeur posée | Hauteur | Bordure h/b | Sites | Écrans | Exemple |
|---|---|---|---|---|---|---|---|---|---|
| tr | parchemin | Spectral 14 (42,29,18) | Fell SC 14 | à droite | 22 | 0px/0px | 26 | bataille-de-masse, course-poursuite-en-mer, evenement-de-route +3 | « Greta HartmannCorps à corps » |
| tr | parchemin | Spectral 13.5 (42,29,18) | Chiffres 13.5 gras | à droite | 24 | 0px/0px | 23 | halle, marchandage, nuit +1 | « Prix de base25 Enc à 2/–2 CO » |
| tr | bois | Fell SC 12 (201,185,149) | Spectral 13 gras | à droite | 20 | 0px/0px | 19 | halle, marchandage, port | « Disponible350 Enc » |
| tr | parchemin | Spectral 13 (42,29,18) | Fell SC 12 | à droite | 20 | 0px/0px | 16 | focalisation, test-de-corruption | « 7 DR cumulésNI 0 au prochain » |
| tr | parchemin | Grenze Gotisch 21 (58,26,16) | Chiffres 17 gras | à droite | 28 | 0px/0px | 8 | halle, marchandage, port +1 | « Estimation2 CO 15/– » |
| tr | parchemin | Spectral 14 (42,29,18) | Fell SC 14.5 | à droite | 22 | 0px/0px | 7 | tour-de-combat | « Cible1 » |
| tr | parchemin | Spectral 13 (124,31,20) | Fell SC 12 gras | à droite | 20 | 0px/0px | 4 | focalisation, test-de-corruption | « 7 DR cumulésNI 0 au prochain » |
| tr | parchemin | Spectral 13 (42,29,18) | Fell SC 12 | à droite | 37 | 0px/0px | 3 | focalisation | « Critiquelançable au prochain » |
| tr | parchemin | Spectral 14 (42,29,18) | Fell SC 14 | à droite | 23 | 0px/0px | 2 | course-poursuite-en-mer, voyage-en-mer | « Aldric, Navigateur+1 DR » |
| tr | parchemin | Spectral 14 (42,29,18) | Fell SC 14 gras | à droite | 23 | 0px/0px | 2 | course-poursuite-en-mer, voyage-en-mer | « Somme+5 DR » |
| tr | parchemin | Spectral 12.5 (42,29,18) | Fell SC 12.5 gras | à droite | 19 | 0px/0px | 2 | course-poursuite-en-mer | « Somme+1 DR » |
| tr | parchemin | Spectral 14 (42,29,18) | Fell SC 14.5 | à droite | 40 | 0px/0px | 2 | tour-de-combat | « Niveau d’incantation0 » |
| tr | parchemin | Spectral 14 (42,29,18) | Fell SC 14.5 | à droite | 41 | 0px/0px | 2 | tour-de-combat | « Portée70 mètres (Force Menta » |
| tr | parchemin | Spectral 14 (42,29,18) | Fell SC 14 | à droite | 41 | 0px/0px | 1 | bataille-de-masse | « Dérouteà 10, ou au bout de 5 » |
| tr | parchemin | Spectral 13 (124,31,20) | Fell SC 12 gras | à droite | 37 | 0px/0px | 1 | focalisation | « Critiquelançable au prochain » |
| tr | parchemin | Spectral 12.5 (42,29,18) | Fell SC 12.5 | à droite | 19 | 0px/0px | 1 | poursuite-terrestre | « Le DR le plus bas du groupe  » |
| tr | parchemin | Spectral 14 (42,29,18) | Grenze Gotisch 22 gras | à droite | 25 | 0px/0px | 1 | tour-de-combat | « Corps à corps (Armes d’hast) » |
| a | bois | Fell SC 11 (201,185,149) | Fell 15 | dessous | 35 | 0px/0px | 44 | creation | « Race+20 PX Humains (Reikland » |
| a | bois | Fell SC 11 (201,185,149) | Fell 15 | dessous | 34 | 0px/0px | 16 | creation | « Caractéristiques Cent points » |
| a | bois | Fell SC 11 (201,185,149) | Chiffres 19 gras | dessous | 36 | 0px/0px | 1 | creation | « PX de création 145 PX » |
| regle | parchemin | Fell SC 12 (74,52,32) | Spectral 16 | à droite | 30 | 0px/0px | 10 | combat-naval, defense, jet-avant-le-de | « VirageBâbord 45°Cap tenuTrib » |
| regle | parchemin | Spectral 15.5 (42,29,18) | Spectral 16 | dessous | 61 | 0px/1px | 10 | options | « Déviation Critique NonOui » |
| regle | parchemin | Spectral 15.5 (42,29,18) | Spectral 16 | dessous | 57 | 0px/1px | 6 | options | « Plafond d’Avantage 10 » |
| regle | parchemin | Spectral 15.5 (42,29,18) | Spectral 16 | dessous | 81 | 0px/1px | 2 | options | « Plafond d’Avantage = Bonus d » |
| regle | parchemin | Spectral 15.5 (124,31,20) | Fell SC 12.5 | dessous | 61 | 0px/1px | 2 | options | « Frappe Mortelle DéfautNonOui » |
| regle | parchemin | Spectral 15.5 (42,29,18) | Spectral 16 | dessous | 97 | 0px/1px | 2 | options | « Coup de corps à corps par un » |
| regle | parchemin | Fell SC 12 (74,52,32) | Fell SC 12.5 | à droite | 30 | 0px/0px | 1 | defense | « À la place de Corps à corpsO » |
| regle | parchemin | Fell SC 12 (74,52,32) | Grenze Gotisch 22 gras | à la suite | 30 | 0px/0px | 1 | jet-avant-le-de | « LocalisationTête−20 au TestA » |
| regle | parchemin | Fell SC 12 (74,52,32) | Grenze Gotisch 22 gras | à droite | 30 | 0px/0px | 1 | jet-avant-le-de | « Localisation du CritiqueTête » |
| regle | parchemin | Spectral 15.5 (42,29,18) | Spectral 16 | dessous | 119 | 0px/1px | 1 | options | « Sur la Défensive NonOui Acti » |
| regle | parchemin | Spectral 15.5 (124,31,20) | Fell SC 12.5 | dessous | 255 | 0px/1px | 1 | options | « Chance regagnée en cours de  » |
| regle | parchemin | Spectral 15.5 (42,29,18) | Spectral 16 | dessous | 155 | 0px/1px | 1 | options | « Sur la Défensive NonOui Règl » |
| ligne | bois | Fell SC 12.5 (201,185,149) | Chiffres 14 gras | à droite | 26 | 0px/0px | 17 | bataille-de-masse, course-poursuite-en-mer, le-bord +1 | « Armée des Personnages50 · dé » |
| ligne | bois | Fell SC 12.5 (201,185,149) | Spectral 14 | à droite | 25 | 0px/0px | 15 | course-poursuite-en-mer, poursuite-terrestre | « PoursuivantCogue pirate » |
| ligne | bois | Fell SC 12.5 (201,185,149) | Spectral 14 it. | à la suite | 23 | 0px/0px | 4 | course-poursuite-en-mer, poursuite-terrestre | « Distance50 / 100 » |
| fait | parchemin | Fell SC 13 (90,42,18) | Fell 15 | dessous | 35 | 0px/0px | 24 | creation, fiche-du-heros | « BlessuresBF + (2 × BE) + BFM » |
| fait | parchemin | Fell SC 13 (90,42,18) | Fell 15 | dessous | 54 | 0px/0px | 3 | creation | « Nom classiqueVerros » |
| fait | parchemin | Fell SC 13 (90,42,18) | Chiffres 11.5 gras | dessous | 54 | 0px/0px | 1 | creation | « Attributs de départCT +2Ag + » |
| mesure | bois | Fell SC 12.5 (201,185,149) | Spectral 16 it. | dessous | 38 | 0px/0px | 16 | tour-de-combat | « Blessures17 / 17 » |
| mesure | parchemin | Fell 17 (42,29,18) | Fell SC 13 | à droite | 38 | 0px/0px | 4 | creation | « 8Âge 15 + d1023 ans » |
| mesure | bois | Fell SC 12.5 (201,185,149) | Spectral 16 it. | dessous | 30 | 0px/0px | 3 | combat-naval, tour-de-combat | « Blessures16 / 16 » |
| mesure | parchemin | Fell SC 12.5 (74,52,32) | Spectral 16 it. | dessous | 34 | 0px/0px | 2 | dossier, tour-de-combat | « Cale130 / 300 » |
| prop | parchemin | Spectral 14.5 (42,29,18) | Fell SC 11.5 | à droite | 38 | 0px/1px | 4 | editeur-de-scene | « TypeCloisonPorte » |
| prop | parchemin | Spectral 14.5 (42,29,18) | Spectral 14.5 | à droite | 38 | 0px/1px | 3 | editeur-carte-du-monde, editeur-de-scene | « ScèneLa Diligence » |
| prop | parchemin | Spectral 14.5 (42,29,18) | Spectral 13.5 it. | à droite | 38 | 0px/1px | 3 | editeur-de-scene | « MatériauMur à ossature en bo » |
| prop | parchemin | Spectral 14.5 (122,101,72) | Spectral 13.5 it. | à droite | 38 | 0px/1px | 2 | editeur-de-scene | « Difficulté de Perception— » |
| prop | parchemin | Spectral 14.5 (42,29,18) | Chiffres 13.5 gras it. | à droite | 38 | 0px/1px | 1 | editeur-carte-du-monde | « La route principale40 km » |
| prop | parchemin | Spectral 14.5 (42,29,18) | Fell SC 11.5 | dessous | 63 | 0px/1px | 1 | editeur-carte-du-monde | « SensLes deux sensDepuis Aube » |
| bl | parchemin | Fell SC 13 (90,42,18) | Chiffres 14 gras | à droite | 20 | 0px/0px | 12 | creation, dossier, fiche-du-heros | « Blessures10 / 10 » |
| consequence | parchemin | Fell SC 14 (124,31,20) | Fell SC 15 | à droite | 22 | 0px/0px | 5 | evenement-de-route, fuite, test-de-corruption | « Exténué+1 » |
| consequence | parchemin | Spectral 15 (124,31,20) | Fell SC 15 | à droite | 22 | 0px/0px | 3 | defense, evenement-de-route, jet-d-attaque | « Bras droit » |
| consequence | parchemin | Spectral 15 (61,90,38) | Fell SC 15 | à droite | 22 | 0px/0px | 2 | jet-d-attaque | « Corps » |
| consequence | parchemin | Spectral 15 (61,90,38) | Fell SC 15 | à la suite | 22 | 0px/0px | 1 | marchandage | « −10 % 2 CO 15/– 2 CO 9/– 6 s » |
| porteur-ligne | bois | Spectral 12 (230,218,189) | Chiffres 12 gras | à droite | 19 | 0px/0px | 11 | halle, port | « Pleine0 / 25 Enc libres » |
| enjeu | parchemin | Fell SC 12.5 (74,52,32) | Spectral 13 | dessous | 124 | 0px/0px | 8 | focalisation, test-de-corruption | « Ce que la Focalisation ouvre » |
| pref | bois | Spectral 15.5 (240,226,194) | Spectral 13 it. | dessous | 78 | 0px/0px | 3 | options | « Cadence de combatManuelRapid » |
| pref | bois | Spectral 15.5 (240,226,194) | Spectral 13 it. | dessous | 66 | 0px/0px | 3 | options | « Dés fixésNonOuiUn champ pour » |
| total | bois | Fell SC 12 (201,185,149) | Chiffres 13.5 gras | à droite | 23 | 1px/0px | 3 | nuit | « Total3/– 8 sc » |
| total | bois | Fell SC 12.5 (234,223,196) | Chiffres 13.5 gras | à droite | 22 | 1px/0px | 1 | voyage-en-mer | « Total46 CO 16/– » |
| points | parchemin | Fell SC 12.5 (74,52,32) | Spectral 16 it. | dessous | 38 | 0px/0px | 1 | test-de-corruption | « Points de Corruption2 / 6 » |

Retirés du relevé parce qu'ils appartiennent à un autre groupe : `.jeton` (barre de l'actif, 18 sites, étiquettes), `.case-bourse` (bourse), `.carac` (case de caractéristique, 12 sites).

### rubrique
#### rubrique:recit : 1 variantes, 16 sites, 16 états
| Fond | Police | Taille | Interligne | Couleur | Inter-lettre | Style | Ombre | Sites | Lignes max | Écrans (sélecteur) |
|---|---|---|---|---|---|---|---|---|---|---|
| scène | Fell SC | 12.5 | normal | (226,192,106) | 1.1px |  | ombre | 16 | 1 | arrivee, bataille-de-masse, course-poursuite-en-mer, evenement-de-route +4 (`div > div.r.rubrique.ombre`) |

#### rubrique:panneau : 18 variantes, 173 sites, 83 états
| Fond | Police | Taille | Interligne | Couleur | Inter-lettre | Style | Ombre | Sites | Lignes max | Écrans (sélecteur) |
|---|---|---|---|---|---|---|---|---|---|---|
| bois | Fell SC | 13.5 | 16px | (201,185,149) | 1.1px |  |  | 55 | 2 | combat-naval, contre-sort, corruption-mutation, coup-critique +13 (`div.fond.bois > div.t.rubrique`) |
| scène | Fell SC | 13.5 | normal | (240,226,194) | 1.1px |  | ombre | 53 | 2 | combat-naval, contre-sort, corruption-mutation, coup-critique +13 (`div > div.tete.rubrique.ombre`) |
| parchemin | Fell SC | 13 | normal | (107,28,16) | 1.1px |  |  | 11 | 1 | compendium, editeur-carte-du-monde, editeur-de-scene (`div.defile.corps > div.r.rubrique`) |
| scène | Fell SC | 13.5 | normal | (243,230,198) | 1.1px |  | ombre | 8 | 1 | butin, designation-d-un-heros, dialogue, exploration +1 (`div > div.tete.rubrique.ombre`) |
| bois | Fell SC | 12 | 14px | (226,192,106) | 1.1px |  |  | 7 | 1 | compendium (`div.categories > div.intertitre.rubrique`) |
| bois | Fell SC | 12.5 | normal | (226,192,106) | 1.1px |  |  | 7 | 1 | le-bord, nuit (`div.defile.corps > div.t.rubrique`) |
| bois | Fell SC | 12 | 23px | (226,192,106) | 1.1px |  |  | 5 | 1 | compendium (`div.groupe.rubrique > span`) |
| bois | Chiffres | 11 | 23px | (201,185,149) | 0.2px |  |  | 5 | 1 | compendium (`div.groupe.rubrique > em.chiffres`) |
| parchemin | Fell SC | 12.5 | normal | (90,42,18) | 1.1px |  |  | 4 | 1 | carnet, fin-du-combat (`div > div.r.rubrique`) |
| parchemin | Fell SC | 11.5 | normal | (107,28,16) | 1.1px |  |  | 4 | 1 | compendium (`div.renvois > div.r.rubrique`) |
| parchemin | Fell SC | 12.5 | 16px | (74,52,32) | 1.1px |  |  | 3 | 1 | debut-du-round (`div.place > div.t.rubrique`) |
| bois | Fell SC | 12 | normal | (201,185,149) | 1.1px |  |  | 2 | 1 | bataille-de-masse (`div.defile.corps > div.t.rubrique`) |
| parchemin | Fell SC | 11.5 | normal | (74,52,32) | 0.5px |  |  | 2 | 1 | combat-naval (`div.rangees > div.t.rubrique`) |
| bois | Fell SC | 13 | normal | (201,185,149) | 1px |  |  | 2 | 1 | combat-naval, tour-de-combat (`div.fond > div.t.rubrique`) |
| parchemin | Fell SC | 13 | normal | (74,52,32) | 1.1px |  |  | 2 | 1 | tour-de-combat (`div.mesures > span.rubrique.t`) |
| bois | Fell SC | 13 | normal | (226,192,106) | 1.1px |  |  | 1 | 1 | carnet (`div.documents > div.t.rubrique`) |
| bois | Fell SC | 14 | normal | (226,192,106) | 1.1px |  |  | 1 | 1 | coop (`div.fond.bois > div.r.rubrique`) |
| parchemin | Fell SC | 12.5 | normal | (107,28,16) | 1.1px |  |  | 1 | 1 | nuit (`div.defile.corps > div.t.rubrique`) |

#### rubrique:intertitre : 2 variantes, 146 sites, 27 états
| Fond | Police | Taille | Interligne | Couleur | Inter-lettre | Style | Ombre | Sites | Lignes max | Écrans (sélecteur) |
|---|---|---|---|---|---|---|---|---|---|---|
| parchemin | Fell SC | 13 | 16px | (90,42,18) | 1.1px |  |  | 142 | 3 | changement-de-carriere, creation, depense-d-experience, dossier +2 (`div.fait > div.rub`) |
| scène | Fell SC | 13.5 | normal | (226,192,106) | 1.6px |  | ombre | 4 | 2 | chapitre (`div.bande.rubrique.ombre > span`) |

### sous-titre
#### sousTitre:.s : 6 variantes, 132 sites, 79 états
| Fond | Police | Taille | Interligne | Couleur | Inter-lettre | Style | Ombre | Sites | Lignes max | Écrans (sélecteur) |
|---|---|---|---|---|---|---|---|---|---|---|
| bois | Fell SC | 12.5 | normal | (201,185,149) | 1.1px |  |  | 76 | 2 | arrivee, bataille-de-masse, butin, carnet +23 (`div > div.s.rubrique`) |
| bois | Fell SC | 11.5 | normal | (201,185,149) | 1.1px |  |  | 31 | 1 | halle, marchandage, nuit, port +1 (`div > div.s.rubrique`) |
| bois | Fell SC | 12 | normal | (201,185,149) | 1.1px |  |  | 10 | 1 | interlude (`div.qui > div.s.rubrique`) |
| parchemin | Fell SC | 11.5 | normal | (90,42,18) | 1.1px |  |  | 9 | 1 | coop, creation, fiche-du-heros (`div > div.s.rubrique`) |
| bois | Fell SC | 10.5 | normal | (201,185,149) | 1.1px |  |  | 4 | 1 | editeur-carte-du-monde, editeur-de-scene (`div > div.s.rubrique`) |
| bois | Fell SC | 12 | normal | (226,192,106) | 1.1px |  |  | 2 | 1 | carte-du-monde (`div.place > div.s.rubrique`) |

#### sousTitre:.car : 2 variantes, 250 sites, 70 états
| Fond | Police | Taille | Interligne | Couleur | Inter-lettre | Style | Ombre | Sites | Lignes max | Écrans (sélecteur) |
|---|---|---|---|---|---|---|---|---|---|---|
| bois | Fell SC | 12 | normal | (201,185,149) | 1.1px |  |  | 247 | 1 | arrivee, bataille-de-masse, carte-du-monde, changement-de-carriere +18 (`div.l2 > span.car.rubrique`) |
| bois | Fell SC | 12 | 15px | (201,185,149) | 1.1px |  |  | 3 | 2 | nouvelle-partie (`div.l2 > span.car.rubrique`) |

#### sousTitre:.c : 12 variantes, 118 sites, 81 états
| Fond | Police | Taille | Interligne | Couleur | Inter-lettre | Style | Ombre | Sites | Lignes max | Écrans (sélecteur) |
|---|---|---|---|---|---|---|---|---|---|---|
| parchemin | Fell SC | 12.5 | 14px | (74,52,32) | 1.1px |  |  | 76 | 2 | combat-naval, contre-sort, coup-critique, course-poursuite-en-mer +17 (`div.place > div.c.rubrique`) |
| parchemin | Fell SC | 12 | 19px | (90,42,18) | 1.1px |  |  | 12 | 1 | bataille-de-masse, compendium, course-poursuite-en-mer, evenement-de-route +4 (`div.tete > span.c.rubrique`) |
| parchemin | Fell SC | 12.5 | 14px | (124,31,20) | 1.1px |  |  | 7 | 1 | corruption-mutation, coup-critique, incantation, maladresse +1 (`div > div.c.rubrique`) |
| bois | Fell SC | 10.5 | normal | (201,185,149) | 1.1px |  |  | 5 | 2 | chapitre (`div.qui > div.c.rubrique`) |
| bois | Fell SC | 11.5 | normal | (226,192,106) | 1.1px |  |  | 4 | 1 | carte-du-monde (`div.q > span.c.rubrique`) |
| parchemin | Fell SC | 12 | normal | (74,52,32) | 1.1px |  |  | 4 | 1 | fin-de-seance (`div.qui > div.c.rubrique`) |
| parchemin | Fell SC | 12 | normal | (90,69,48) | 1.1px |  |  | 2 | 1 | bataille-de-masse (`div > div.c.rubrique`) |
| parchemin | Fell SC | 11.5 | normal | (74,52,32) | 1.1px |  |  | 2 | 1 | incantation (`div > div.c.rubrique`) |
| bois | Fell SC | 10.5 | 13px | (226,192,106) | 1.1px |  |  | 2 | 1 | interlude (`div > span.c.rubrique`) |
| parchemin | Fell SC | 12.5 | 16px | (74,52,32) | 1.1px |  |  | 2 | 2 | tour-de-combat (`div > div.c.rubrique`) |
| parchemin | Fell SC | 12.5 | normal | (90,42,18) | 1.1px |  |  | 1 | 1 | butin (`div.trouve > div.c.rubrique`) |
| parchemin | Fell SC | 12.5 | normal | (74,52,32) | 1.1px |  |  | 1 | 1 | dossier (`div.qui > div.c.rubrique`) |

#### sousTitre:.sous : 12 variantes, 88 sites, 78 états
| Fond | Police | Taille | Interligne | Couleur | Inter-lettre | Style | Ombre | Sites | Lignes max | Écrans (sélecteur) |
|---|---|---|---|---|---|---|---|---|---|---|
| parchemin | Fell SC | 12.5 | 14px | (74,52,32) | 1.1px |  |  | 35 | 1 | combat-naval, contre-sort, defense, dissipation +10 (`div.place > div.sous.rubrique`) |
| parchemin | Fell SC | 12 | normal | (90,42,18) | 1.1px |  |  | 14 | 2 | carnet, halle, marchandage, nuit +2 (`div.tete > span.sous.rubrique`) |
| parchemin | Fell SC | 12 | normal | (90,42,18) | 1px |  |  | 12 | 1 | changement-de-carriere, creation (`div.page-c > div.sous`) |
| parchemin | Fell SC | 14 | normal | (107,28,16) | 1.1px |  |  | 4 | 1 | compendium (`div.tete > span.sous.rubrique`) |
| parchemin | Fell SC | 12.5 | normal | (74,52,32) | 1.1px |  |  | 4 | 2 | course-poursuite-en-mer, incantation, poursuite-terrestre (`div.tete > span.sous.rubrique`) |
| parchemin | Fell SC | 12.5 | normal | (90,42,18) | 1.1px |  |  | 4 | 1 | editeur-carte-du-monde, editeur-de-scene (`div.place > div.sous.rubrique`) |
| parchemin | Fell SC | 13 | normal | (90,42,18) | 1.1px |  |  | 4 | 1 | options (`div.tete > span.sous.rubrique`) |
| parchemin | Fell SC | 13.5 | normal | (74,52,32) | 1.1px |  |  | 3 | 1 | contre-sort, debut-du-round (`div.annonce > div.sous.rubrique`) |
| parchemin | Fell SC | 13 | 14px | (90,42,18) | 1.1px |  |  | 3 | 1 | options (`div.tete > span.sous.rubrique`) |
| parchemin | Fell SC | 12.5 | 14px | (90,42,18) | 1.1px |  |  | 2 | 1 | jet-d-attaque (`div.sous.rubrique > span.relance`) |
| parchemin | Chiffres | 12 | normal | (90,42,18) | 0.2px |  |  | 2 | 1 | soins (`span.sous.rubrique > span.chiffres`) |
| parchemin | Fell SC | 12 | normal | (90,69,48) | 1.1px |  |  | 1 | 1 | bataille-de-masse (`div.milieu > div.sous.rubrique`) |

### note
#### note:pied : 5 variantes, 24 sites, 23 états
| Fond | Police | Taille | Interligne | Couleur | Inter-lettre | Style | Ombre | Sites | Lignes max | Écrans (sélecteur) |
|---|---|---|---|---|---|---|---|---|---|---|
| bois | Fell SC | 11.5 | normal | (201,185,149) | 1.1px |  |  | 14 | 1 | carnet, halle, marchandage, nuit +2 (`div.place > div.pied.rubrique`) |
| bois | Fell SC | 12 | normal | (201,185,149) | 1.1px |  |  | 3 | 1 | nouvelle-partie (`div.fond.bois > div.pied.rubrique`) |
| parchemin | Fell SC | 12.5 | normal | (90,69,48) | 1.1px |  |  | 3 | 1 | options (`div.pied > span.folio.rubrique`) |
| parchemin | Spectral | 13 | 17px | (74,52,32) | normal | italique |  | 3 | 1 | tour-de-combat (`div.apercu.parchemin.vers-bas > div.pied`) |
| parchemin | Spectral | 13 | 18px | (42,29,18) | normal |  |  | 1 | 3 | creation (`div.page-c > p.prose.pied`) |

#### note:consigne : 2 variantes, 4 sites, 4 états
| Fond | Police | Taille | Interligne | Couleur | Inter-lettre | Style | Ombre | Sites | Lignes max | Écrans (sélecteur) |
|---|---|---|---|---|---|---|---|---|---|---|
| parchemin | Spectral | 17 | 23px | (42,29,18) | normal | italique |  | 3 | 2 | jet-d-attaque, tour-de-combat (`div.place > p.consigne`) |
| parchemin | Spectral | 16 | normal | (42,29,18) | normal |  |  | 1 | 3 | carte-du-monde (`div.place > p.consigne`) |

#### note:noteDeRub : 2 variantes, 50 sites, 21 états
| Fond | Police | Taille | Interligne | Couleur | Inter-lettre | Style | Ombre | Sites | Lignes max | Écrans (sélecteur) |
|---|---|---|---|---|---|---|---|---|---|---|
| parchemin | Spectral | 12.5 | 16px | (90,69,48) | normal | italique |  | 46 | 2 | changement-de-carriere, creation, depense-d-experience, dossier +1 (`div.rub > span.note`) |
| parchemin | Spectral | 11.5 | 16px | (90,69,48) | normal | italique |  | 4 | 1 | creation (`div.rub > span.note`) |

#### note:p.note : 1 variantes, 2 sites, 2 états
| Fond | Police | Taille | Interligne | Couleur | Inter-lettre | Style | Ombre | Sites | Lignes max | Écrans (sélecteur) |
|---|---|---|---|---|---|---|---|---|---|---|
| parchemin | Spectral | 13 | 18px | (42,29,18) | normal | italique |  | 2 | 1 | changement-de-carriere (`div.page-c > p.prose.note`) |

#### note:phrase-du-jet : 1 variantes, 23 sites, 23 états
| Fond | Police | Taille | Interligne | Couleur | Inter-lettre | Style | Ombre | Sites | Lignes max | Écrans (sélecteur) |
|---|---|---|---|---|---|---|---|---|---|---|
| parchemin | Spectral | 12.5 | 17px | (42,29,18) | normal | italique |  | 23 | 2 | combat-naval, contre-sort, defense, dissipation +9 (`div.place > p.phrase-du-jet`) |

#### note:aide : 3 variantes, 11 sites, 4 états
| Fond | Police | Taille | Interligne | Couleur | Inter-lettre | Style | Ombre | Sites | Lignes max | Écrans (sélecteur) |
|---|---|---|---|---|---|---|---|---|---|---|
| bois | Spectral | 13 | 17px | (201,185,149) | normal | italique |  | 6 | 2 | options (`div.pref > p`) |
| parchemin | Spectral | 13.5 | 18px | (58,42,24) | normal | italique |  | 3 | 7 | options (`div.regle.pointee > p.aide`) |
| parchemin | Spectral | 12.5 | 16px | (74,52,32) | normal | italique |  | 2 | 1 | compendium (`div > div.aide`) |

#### note:span.rub : 2 variantes, 17 sites, 8 états
| Fond | Police | Taille | Interligne | Couleur | Inter-lettre | Style | Ombre | Sites | Lignes max | Écrans (sélecteur) |
|---|---|---|---|---|---|---|---|---|---|---|
| parchemin | Fell SC | 13 | 16px | (90,42,18) | 1.1px |  |  | 13 | 2 | dossier, fiche-du-heros (`div.reserve > span.rub`) |
| parchemin | Fell SC | 13 | 16px | (124,31,20) | 1.1px |  |  | 4 | 1 | depense-d-experience (`div.achat.hors > span.rub.designer`) |

#### note:.note : 3 variantes, 10 sites, 10 états
| Fond | Police | Taille | Interligne | Couleur | Inter-lettre | Style | Ombre | Sites | Lignes max | Écrans (sélecteur) |
|---|---|---|---|---|---|---|---|---|---|---|
| parchemin | Spectral | 12.5 | 16px | (74,52,32) | normal | italique |  | 7 | 1 | halle, port, soins (`div.note > i`) |
| parchemin | Spectral | 13.5 | 17px | (90,69,48) | normal | italique |  | 2 | 1 | document (`div.note > span`) |
| parchemin | Spectral | 12.5 | 16px | (107,28,16) | normal | italique |  | 1 | 1 | halle (`div.note.refus > i`) |

#### note:.consequence.rub : 1 variantes, 1 sites, 1 états
| Fond | Police | Taille | Interligne | Couleur | Inter-lettre | Style | Ombre | Sites | Lignes max | Écrans (sélecteur) |
|---|---|---|---|---|---|---|---|---|---|---|
| parchemin | Fell SC | 13 | 16px | (124,31,20) | 1.1px |  |  | 1 | 1 | fiche-du-heros (`div.ouvert > div.consequence.rub`) |

Retirés : `p.ecrit` (fin de séance) et `.ligne-ecrite .ecrit` (création) sont des textes écrits par le joueur (nature `saisie`) ; `.page-c > p.prose` (création, 7 sites) est de la prose descriptive ; `.avis > span.rubrique` (nuit) est une étiquette ; `.sur.rubrique` (accueil, chapitre, affiche) va avec le titre libre.

## Forme cible proposée

Une forme par rôle et par fond ; chaque valeur est une valeur déjà rendue, citée.

| Nature | Primitive | Police | Taille / interligne | Bois | Parchemin | Scène | Pris à |
|---|---|---|---|---|---|---|---|
| rubrique (intertitre, panneau, récit, libellé de ligne) | `rubrique({ texte, note, fin })` (existe) | Fell SC, inter-lettre 1,1 | 13 / 16 | `--creme-2` | `--rouille` | `--ivoire`, ombre `0 1px 2px --noir` | `S/gestes.css:114-115` ; 142 intertitres ; scène : tête du journal (61 sites, 13,5 px, ivoire à 3 près) |
| sous-titre | `sousTitre({ texte })`, à créer | Fell SC, inter-lettre 1,1 | 12,5 / 14 | `--creme-2` | `--encre-2` | — | 12,5 px : `.s` 76, `.c` 76, `.sous` 35 sites ; interligne 14 : `.place > .c` et `.place > .sous` |
| note `courante` | `note({ texte })`, à créer | Spectral italique | 12,5 / 16 | `--creme-2` | `--encre-2` | — | `noteDeRub` 46 sites (`S/gestes.css:116`) |
| note `consigne` | `note({ texte, variante: 'consigne' })` | Spectral italique, filet à gauche | 17 / 23 | — | `--encre` | — | `p.consigne` (`S/combat/combat.css:201`) |
| ligne `courante` | `ligne({ libelle, valeur, format })`, à créer | libellé `rubrique()` ; valeur texte Fell 15, nombre Chiffres 600 14 | ligne de la valeur | `--ivoire` | `--encre` | — | Fell 15 : `fait`, `acquis` (87 sites) ; Chiffres 14 : `ligneDu` (17), `bl` (12) |
| ligne `empilee` | idem, `variante: 'empilee'` | libellé dessus, valeur dessous | idem | idem | idem | — | `fait`, `acquis` |
| ligne `mesure` | idem, `variante: 'mesure'` | rubrique, « x / y » en Chiffres 14, jauge | idem | idem | idem | — | `bl` ; police de chiffres unique (`kit.md` § 1) |
| ligne `tabulaire` | `ligne` dans un tableau | libellé Spectral 13,5 `--encre`, valeur Chiffres 600 13,5 à droite | 24 | — | — | — | `table.compte tr` (23 sites) ; voir question 3 |

Ce que la cible retire :

- **Rubrique** : les 18 rendus de rubrique de panneau (11,5 à 14 px, 6 couleurs dont `#4a3420`, `#6b1c10`, `--or` sur bois, inter-lettre 0,5 et 1) deviennent `rubrique()` ; le récit et la tête du journal prennent la forme scène. Les libellés de ligne en Fell SC (11 à 14 px) deviennent `rubrique()`. `bande()` reste avec le titre libre (lot titres).
- **Sous-titre** : 32 rendus (10,5 à 14 px ; `#4a3420`, `--rouille`, `#6b1c10`, `--sang`, `--or`) deviennent une forme par fond. La couleur la plus fréquente sur parchemin, `#4a3420` (127 sites), est une littérale (41 occurrences dans les feuilles), pas un jeton : la cible prend le jeton le plus proche, `--encre-2` (question 1).
- **Note** : `.pied.rubrique` (Fell SC 11,5, 14 sites) et les aides (13 et 13,5 px) deviennent la note courante ; le pied est une place, pas une forme (le catalogue proposait une variante `pied`). `span.rub` (13 sites, `.reserve` du dossier) est un libellé de réserve : il prend la forme `rubrique` qu'il a déjà. `.rub.designer` et `.consequence.rub` (rouge `--sang`, 5 sites) sont des refus ou des coûts : question 4.
- **Ligne** : 60 rendus de 14 constructions deviennent 4 variantes. `regleMaison` (options) et `pref` (préférences) ne sont pas des lignes libellé-valeur : un nom de règle en Spectral 15,5, une aide, un réglage ; ils restent hors de `ligne` et leur aide devient une note (signalé, nature à ranger par l'orchestrateur).

## Tenue de la forme cible : mesure

Feuille simulée (`node_modules/.cache/sondes/textes/cible-textes.css`) injectée par préchargement dans `rendre.mjs`, 170 états en 16:9, relevés réels. Passe d'avant : `natures/pieces-et-jauges/base` (même tête, même format, sans feuille), réutilisée pour ne pas rejouer une passe identique.

- **Relevés bloquants** : 161 états sur 170 sans relevé ; 9 états (7 écrans) avec un relevé, tous absents de la passe d'avant.
- **Contenus** (`contenu`, classes de `contenus.mjs`) : 110 états inchangés, 60 changés ; 56 écarts B (longueur de texte, coin fixe), 21 écarts A (boîte déplacée), sur 7 contenus.

### Sites où la forme cible ne tient pas

| Site | États | Relevé | Cause mesurée |
|---|---|---|---|
| barre des éditeurs | `editeur-carte-du-monde`, `editeur-de-scene` (`porte`, `outil-terrain`, `supprimer`) | `rogne` « Narratif (segments) » ; A : bloc de titre 297 → 343 px, séparateur et segments décalés de 46 px, segments 248 → 202 px | sous-titre du cartouche de barre (`.s`) 10,5 → 12,5 px |
| inspecteur des éditeurs | mêmes 4 | A : filet de tête remonte de 2 px | `.sous` 12,5 / normal → 12,5 / 14 |
| fiche du Compendium | `atelier` | `deborde` « fiche-du-compendium » | sous-titre 14 → 12,5 px et libellés de tableau ; la fiche défile au plus juste |
| présentation de la création | `creation-presentation` | `deborde` « heros-neuf » | libellés `acquis` 11 → 13 px (« Race tirée au d100 » + jeton de PX), valeur Fell 15 |
| fenêtre du jet naval | `combat-naval-bordee` | `chevauche` « Test d’équipage » × « Munition des pièces qui portent » | sous-titre `.c` / `.sous` 12,5 / 14 sur deux lignes |
| fenêtre de l'incantation | `surincantation` | `chevauche` « Sort · Niveau d’incantation 0 » × « Fléchette » ; A : `.surinc` −2 px | idem |
| jet avant le dé | `jet-avant-le-de` | `chevauche` et `recouvert` : sceau vide × « Au hasard » | libellé `regle` 12 → 13 px (« Localisation ») |
| options, colonne de gestion | `options`, `chance`, `verrou` | A : `.pref` n° 7 remonte de 1 px, −2 px | aide 13 → 12,5 / 16 |
| butin | 1 | A : `.trouve` −2 px | sous-titre `.c` |

Les écarts B touchent surtout la fenêtre du bas des jets (`dissipation`, `focalisation`, `incantation`, `test-de-corruption`, `maladresse`, `contre-sort`…), le commerce (`port`, `halle`, `marchandage`) et le combat (`tour-de-combat`) : textes de rubrique, sous-titre et note qui changent de largeur, coin fixe.

Non couvert par la mesure : la largeur d'un libellé agrandi dans une ligne sans relevé (`ligneDu` du voyage) ; les places mesurées par `gestes.js` au montage (feuille posée à `DOMContentLoaded`) ; les formats 21:9, 16:10, `bureau` ; la ligne `tabulaire` (non simulée : question 3) ; la consigne (inchangée).

## Questions

1. **Couleur du sous-titre sur parchemin.** `--encre-2` (recommandé : un jeton existant, le plus proche de la littérale `#4a3420` qui fait 127 sites, et distinct de la rubrique en `--rouille`) ou `--rouille` (57 sites, jeton, mais le sous-titre se confond alors avec une rubrique de 0,5 px plus petite).
2. **Libellé de ligne.** `rubrique()` 13 / 16 partout (recommandé : une seule forme de libellé, celle que le kit a déjà ; coût mesuré : quatre sites ci-dessus à reprendre par leur disposition) ou un libellé à part à 12,5 px (67 sites, la taille la plus fréquente des libellés, sans relevé `acquis` ni `regle`) : deux formes Fell SC presque égales.
3. **Ligne tabulaire.** Libellé en Spectral 13,5 (recommandé : une rangée de tableau est une entrée, pas une rubrique ; 23 + 16 sites à 13 / 13,5 px) ou en `rubrique()` comme les autres lignes (une forme de libellé de moins, mais des colonnes entières en petites capitales).
4. **Note en rouge.** `.rub.designer` et `.consequence.rub` (« Coût doublé », « Rompre : niveau de carrière réduit de 1 ») : note courante en `--sang` (recommandé : c'est un avertissement attaché à une ligne, la teinte dit le refus) ou étiquette `teinte: 'cire'` (lot étiquettes).

## Images

- Planche : `hotes/godot/cibles/propositions/sources/kit/planche-textes.html`.
- Avant / après simulés (hors dépôt) : `creation-presentation`, `editeur-de-scene` (`porte`), `combat-naval-bordee`, `tour-de-combat` (`cible-montee`).
