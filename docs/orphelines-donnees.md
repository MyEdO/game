# Orphelines de données — GÉNÉRÉ

> ⚠️ Fichier GÉNÉRÉ par `node scripts/docs/build-entity-orphans.mjs` (`npm run docs:orphelines`) — NE PAS ÉDITER À LA MAIN.
> Pour chaque catalogue `src/data/*.json` retenu, les entités qu'AUCUN autre `src/data/*.json`,
> AUCUN code de prod TypeScript (`.ts`/`.tsx`, hors tests) et AUCUN document de projet de scène
> (`*-projet.json` de `src/scenes` — le contenu JOUÉ) ne cite l'id en toutes lettres NI ne
> sélectionne par prédicat de champ (`catalogue.filter(...)`). Périmètre
> mesuré, angles morts déclarés, définition d'un consommateur : voir l'en-tête de
> `scripts/docs/build-entity-orphans.mjs`. Cliquet décroissant : `src/data/entity-orphans.test.ts`
> + `scripts/guards/lib/entityOrphanStock.mjs`.

## Catalogues ÉCARTÉS (angle mort structurel mesuré, pas couverts)

| Catalogue | Entités | Orphelines BRUTES (id seul) | Taux |
|---|---|---|---|
| `spells` | 576 | 276 | 48 % |
| `trappings` | 441 | 207 | 47 % |

Chacun échappe à la détection par id pour une raison PROPRE : un Sort ne se cite pas par id en
prod (il s'obtient par Domaine / Talent de lanceur / `learnSpell` de scène — l'instrument juste
est `src/data/obtainability-guard.test.ts`) ; le stock marchand des `trappings` est bâti par
PRÉDICAT sur des catégories déclarées en donnée (`state/merchantFlow.ts`, hors grammaire MODE 2
— #1631). `creatures` a quitté cette table pour les catalogues MESURÉS (#1553 L3). Détail et
mesure du canal label (qui n'est PAS la cause) : en-tête de `scripts/docs/build-entity-orphans.mjs`.

## Catalogues MESURÉS

> Le stock cliqueté (`ENTITY_ORPHAN_RATCHET`) porte les MÊMES entrées, sous la forme
> `{ fichier, ref, occurrence }` ; ce rapport en est la LECTURE, jamais la garde — un `.md`
> généré ne rougit pas.

| Catalogue | Entités | Orphelines | Taux |
|---|---|---|---|
| `traits` | 132 | 7 | 5 % |
| `talents` | 187 | 5 | 3 % |
| `qualities` | 59 | 2 | 3 % |
| `maneuvers` | 20 | 0 | 0 % |
| `skills` | 48 | 1 | 2 % |
| `props` | 123 | 0 | 0 % |
| `vehicles` | 31 | 0 | 0 % |
| `creatures` | 493 | 350 | 71 % |
| **Total** | **1093** | **365** | — |

### `traits`

- `marque-de-tzeentch` — Marque de Tzeentch
- `absorption` — Absorption
- `amorphe` — Amorphe
- `contagieux` — Contagieux
- `decerebre` — Décérébré
- `voleur-de-chair` — Voleur de chair
- `aura-de-mort` — Aura de Mort

### `talents`

- `benediction-de-tzeentch` — Bénédiction de Tzeentch
- `disciple-du-changement` — Disciple du changement
- `double-vie` — Double vie
- `empreint-de-la-magie` — Empreint de la Magie
- `sang-neuf` — Sang Neuf

### `qualities`

- `filet-barbele` — Filet barbelé
- `deroutante` — Déroutante

### `skills`

- `hypnotisme` — Hypnotisme

### `creatures`

- `elfe-haut-et-sylvain` — Elfe (haut et sylvain)
- `pol-dankels` — Pol Dankels
- `hyppogriffe` — Hyppogriffe
- `chauve-souris-vampire-varghulf` — Chauve-souris vampire (Varghulf)
- `demigriffon-adulte` — Demigriffon adulte
- `jeune-recrue-du-guet` — Jeune Recrue du Guet
- `homme-du-guet` — Homme du Guet
- `sergent-du-guet` — Sergent du Guet
- `capitaine-du-guet` — Capitaine du Guet
- `jeune-recrue-de-la-garde-du-village` — Jeune Recrue de la Garde du Village
- `chef-de-la-garde-du-village` — Chef de la Garde du Village
- `chef-veteran-de-la-garde-du-village` — Chef Vétéran de la Garde du Village
- `jeune-recrue-patrouilleurs-ruraux` — Jeune Recrue (Patrouilleurs Ruraux)
- `patrouilleur-rural` — Patrouilleur Rural
- `sergent-patrouilleurs-ruraux` — Sergent (Patrouilleurs Ruraux)
- `capitaine-patrouilleurs-ruraux` — Capitaine (Patrouilleurs Ruraux)
- `jeune-recrue-patrouilleurs-fluviaux` — Jeune Recrue (Patrouilleurs Fluviaux)
- `sergent-patrouilleurs-fluviaux` — Sergent (Patrouilleurs Fluviaux)
- `capitaine-patrouilleurs-fluviaux` — Capitaine (Patrouilleurs Fluviaux)
- `jeune-interrogateur` — Jeune Interrogateur
- `inquisiteur` — Inquisiteur
- `grand-inquisiteur` — Grand Inquisiteur
- `juge` — Juge
- `haut-juge` — Haut Juge
- `avocat` — Avocat
- `batonnier` — Bâtonnier
- `jeune-recrue-soldats-mercenaires` — Jeune Recrue (Soldats & Mercenaires)
- `soldat-mercenaire-aguerri` — Soldat & Mercenaire Aguerri
- `sous-officier` — Sous-Officier
- `jeune-citadin-i-b-habitants-des-villes` — Jeune Citadin (I.B - Habitants des Villes)
- `jeune-citadin-citadins` — Jeune Citadin (Citadins)
- `citadin` — Citadin
- `notable` — Notable
- `bourgmestre` — Bourgmestre
- `maistre-apothicaire` — Maistre Apothicaire
- `doktor` — Doktor
- `religieuse-de-shallya` — Religieuse de Shallya
- `pretresse-de-shallya` — Prêtresse de Shallya
- `artisan-services-urbains-frequents-usuels` — Artisan (Services Urbains Fréquents & Usuels)
- `maistre-artisan-services-urbains-frequents-usuels` — Maistre Artisan (Services Urbains Fréquents & Usuels)
- `marchand-services-urbains-frequents-usuels` — Marchand (Services Urbains Fréquents & Usuels)
- `maistre-marchand-services-urbains-frequents-usuels` — Maistre Marchand (Services Urbains Fréquents & Usuels)
- `erudit-de-renom` — Érudit de Renom
- `detective` — Détective
- `enqueteur-chevronne` — Enquêteur Chevronné
- `moine-de-sigmar` — Moine de Sigmar
- `moine-d-ulric` — Moine D’ulric
- `pretre-d-ulric` — Prêtre D’ulric
- `religieuse-de-verena` — Religieuse de Verena
- `pretresse-de-verena` — Prêtresse de Verena
- `jeune-delinquant` — Jeune Délinquant
- `fourgue` — Fourgue
- `racoleur` — Racoleur
- `guide-racoleur` — Guide-Racoleur
- `protagoniste` — Protagoniste
- `tueur-a-gages` — Tueur À Gages
- `voyou` — Voyou
- `racketteur` — Racketteur
- `escroc` — Escroc
- `faussaire` — Faussaire
- `maistre-faussaire` — Maistre Faussaire
- `voleur-aguerri` — Voleur Aguerri
- `pilleur-de-cryptes` — Pilleur de Cryptes
- `pretre-voleur-de-ranald-i-c-criminalite-urbaine` — Prêtre-Voleur de Ranald (I.C - Criminalité Urbaine)
- `jeune-villageois` — Jeune Villageois
- `ancien` — Ancien
- `venerable` — Vénérable
- `artisan-services-ruraux-frequents-usuels` — Artisan (Services Ruraux Fréquents & Usuels)
- `maistre-artisan-services-ruraux-frequents-usuels` — Maistre Artisan (Services Ruraux Fréquents & Usuels)
- `marchand-services-ruraux-frequents-usuels` — Marchand (Services Ruraux Fréquents & Usuels)
- `maistre-marchand-services-ruraux-frequents-usuels` — Maistre Marchand (Services Ruraux Fréquents & Usuels)
- `riverain` — Riverain
- `riverain-respecte` — Riverain Respecté
- `maistre-herboriste` — Maistre Herboriste
- `maitre-des-taillis` — Maître des Taillis
- `druide-de-la-foi-antique` — Druide de la Foi Antique
- `haut-druide-de-la-foi-antique` — Haut Druide de la Foi Antique
- `religieuse-novice-de-rhya` — Religieuse Novice de Rhya
- `religieuse-de-rhya` — Religieuse de Rhya
- `pretresse-de-rhya` — Prêtresse de Rhya
- `grande-pretresse-de-rhya` — Grande Prêtresse de Rhya
- `moine-novice-de-taal` — Moine Novice de Taal
- `moine-de-taal` — Moine de Taal
- `pretre-rodeur-de-taal` — Prêtre-Rôdeur de Taal
- `haut-pretre-rodeur-de-taal` — Haut Prêtre-Rôdeur de Taal
- `jeune-brigand` — Jeune Brigand
- `chef-de-bande` — Chef de Bande
- `jeune-contrebandier` — Jeune Contrebandier
- `chef-contrebandier` — Chef Contrebandier
- `roi-du-trafic` — Roi du Trafic
- `jeune-naufrageur` — Jeune Naufrageur
- `seigneur-pirate` — Seigneur Pirate
- `chien-de-compagnie-ii-a-animaux-domestiques` — Chien de Compagnie (II.A — Animaux Domestiques)
- `chien-de-compagnie-chiens` — Chien de Compagnie (Chiens)
- `chien-de-garde` — Chien de Garde
- `chien-de-chasse` — Chien de Chasse
- `chien-de-ratier` — Chien de Ratier
- `poulain` — Poulain
- `coursier` — Coursier
- `sommier` — Sommier
- `jeune-loup` — Jeune Loup
- `loup-adulte` — Loup Adulte
- `chef-de-meute` — Chef de Meute
- `traqueur-impitoyable` — Traqueur Impitoyable
- `jeune-ours` — Jeune Ours
- `ours-adulte` — Ours Adulte
- `vieil-ours-mal-leche` — Vieil Ours Mal Léché
- `ours-2` — Terreur des Cavernes
- `nuee-de-marcassins` — Nuée de Marcassins
- `jeune-sanglier` — Jeune Sanglier
- `sanglier-adulte` — Sanglier Adulte
- `sanglier-feroce` — Sanglier Féroce
- `grand-sanglier-ombrageux` — Grand Sanglier Ombrageux
- `nuee-de-rats` — Nuée de Rats
- `jeune-rat-geant` — Jeune Rat Géant
- `rat-geant-2` — Rat Géant
- `maitre-des-egouts` — Maître des Égouts
- `horreur-des-profondeurs` — Horreur des Profondeurs
- `nuee-d-araignees-infantiles` — Nuée D’araignées Infantiles
- `jeune-araignee-geante` — Jeune Araignée Géante
- `araignee-geante-adulte` — Araignée Géante Adulte
- `araignee-geante-impitoyable` — Araignée Géante Impitoyable
- `chasseresse-des-ombres` — Chasseresse des Ombres
- `jeune-ungor` — Jeune Ungor
- `ungor-adulte` — Ungor Adulte
- `jeune-gor` — Jeune Gor
- `gor-eclaireur` — Gor Éclaireur
- `gor-chasseur` — Gor Chasseur
- `gor-combattant` — Gor Combattant
- `bestigor-combattant` — Bestigor Combattant
- `gor-chef-de-harde` — Gor Chef de Harde
- `bestigor-chef-de-harde` — Bestigor Chef de Harde
- `gor-chef-de-guerre` — Gor Chef de Guerre
- `bestigor-chef-de-guerre` — Bestigor Chef de Guerre
- `shaman-gor` — Shaman Gor
- `patre-de-la-nuit` — Pâtre de la Nuit
- `bouc-maudit` — Bouc Maudit
- `maraudeur-du-chaos-chef-de-bande` — Maraudeur du Chaos Chef de Bande
- `maraudeur-du-chaos-chef-de-guerre` — Maraudeur du Chaos Chef de Guerre
- `guerrier-du-chaos-chef-de-bande` — Guerrier du Chaos Chef de Bande
- `guerrier-du-chaos-chef-de-guerre` — Guerrier du Chaos Chef de Guerre
- `sorcier-du-chaos` — Sorcier du Chaos
- `sorcier-du-chaos-terrifiant` — Sorcier du Chaos Terrifiant
- `sorcier-du-chaos-effroyable` — Sorcier du Chaos Effroyable
- `furie-exaltee-du-chaos` — Furie Exaltée du Chaos
- `heraut-de-khorne` — Héraut de Khorne
- `heraut-exalte-de-khorne` — Héraut Exalté de Khorne
- `buveur-de-sang-de-khorne` — Buveur de Sang de Khorne
- `buveur-de-sang-exalte-de-khorne` — Buveur de Sang Exalté de Khorne
- `daemonette-de-slaanesh` — Daemonette de Slaanesh
- `heraut-de-slaanesh` — Héraut de Slaanesh
- `heraut-exalte-de-slaanesh` — Héraut Exalté de Slaanesh
- `gardien-des-secrets-de-slaanesh` — Gardien des Secrets de Slaanesh
- `gardien-des-secrets-exalte-de-slaanesh` — Gardien des Secrets Exalté de Slaanesh
- `nuee-de-nurglings` — Nuée de Nurglings
- `porte-peste-de-nurgle` — Porte-Peste de Nurgle
- `heraut-de-nurgle` — Héraut de Nurgle
- `heraut-exalte-de-nurgle` — Héraut Exalté de Nurgle
- `grand-immonde-de-nurgle` — Grand Immonde de Nurgle
- `grand-immonde-exalte-de-nurgle` — Grand Immonde Exalté de Nurgle
- `incendiaire-de-tzeentch` — Incendiaire de Tzeentch
- `grand-incendiaire-de-tzeentch` — Grand Incendiaire de Tzeentch
- `horreur-rose-de-tzeentch` — Horreur Rose de Tzeentch
- `heraut-de-tzeentch` — Héraut de Tzeentch
- `heraut-exalte-de-tzeentch` — Héraut Exalté de Tzeentch
- `seigneur-du-changement-de-tzeentch` — Seigneur du Changement de Tzeentch
- `seigneur-du-changement-exalte-de-tzeentch` — Seigneur du Changement Exalté de Tzeentch
- `esclave-faible` — Esclave Faible
- `esclave` — Esclave
- `kapo` — Kapo
- `garde-chiourme` — Garde-Chiourme
- `jeune-skaven` — Jeune Skaven
- `chef-de-portee` — Chef de Portée
- `chef-de-clan` — Chef de Clan
- `jeune-recrue-vermines-de-choc` — Jeune Recrue (Vermines de Choc)
- `vermine-de-choc-2` — Vermine de Choc
- `chef-de-section` — Chef de Section
- `chef-d-escadron` — Chef d’Escadron
- `apprenti-technomage` — Apprenti Technomage
- `technomage` — Technomage
- `technomage-experimente` — Technomage Expérimenté
- `architechnomage` — Architechnomage
- `coureur-nocturne` — Coureur Nocturne
- `coureur-d-egouts` — Coureur d’Égouts
- `assassin` — Assassin
- `maitre-assassin` — Maître Assassin
- `jeune-moine-de-la-peste` — Jeune Moine de la Peste
- `moine-de-la-peste` — Moine de la Peste
- `grand-moine-de-la-peste` — Grand Moine de la Peste
- `predicateur-de-la-peste` — Prédicateur de la Peste
- `jeune-contremaitre` — Jeune Contremaître
- `maitre-des-hybridation` — Maître des Hybridation
- `grand-maitre-des-hybridations` — Grand Maître des Hybridations
- `cobaye-mutile` — Cobaye Mutilé
- `rat-ogre-fonctionnel` — Rat Ogre Fonctionnel
- `rat-ogre-augmente` — Rat Ogre Augmenté
- `horreur-du-clan-moulder` — Horreur du Clan Moulder
- `prophete-gris-ancien` — Prophète Gris Ancien
- `jeune-gobelin` — Jeune Gobelin
- `eclaireur-gobelin` — Éclaireur Gobelin
- `guerrier-gobelin` — Guerrier Gobelin
- `quadrilleur-gobelin` — Quadrilleur Gobelin
- `plongeur-de-la-mort` — Plongeur de la Mort
- `fanatique-gobelin` — Fanatique Gobelin
- `chef-de-clan-gobelin` — Chef de Clan Gobelin
- `chef-de-guerre-gobelin` — Chef de Guerre Gobelin
- `shaman-gobelin` — Shaman Gobelin
- `grand-shaman-gobelin` — Grand Shaman Gobelin
- `fongus-de-mork` — Fongus de Mork
- `nuee-de-snotlings` — Nuée de Snotlings
- `jeune-orc` — Jeune Orc
- `eclaireur-orc` — Éclaireur Orc
- `archer-orc` — Archer Orc
- `guerrier-orc` — Guerrier Orc
- `chef-de-clan-orc` — Chef de Clan Orc
- `chef-de-guerre-orc` — Chef de Guerre Orc
- `shaman-orc` — Shaman Orc
- `grand-shaman-orc` — Grand Shaman Orc
- `fongus-de-gork` — Fongus de Gork
- `jeune-troll` — Jeune Troll
- `troll-veteran` — Troll Vétéran
- `grand-troll-sanguinaire` — Grand Troll Sanguinaire
- `sorciere-troll-des-marais` — Sorcière Troll des Marais
- `vieille-sorciere-troll-des-marais` — Vieille Sorcière Troll des Marais
- `affreuse-vieille-sorciere-troll-des-marais` — Affreuse Vieille Sorcière Troll des Marais
- `jeune-squig` — Jeune Squig
- `nuee-de-jeunes-squigs` — Nuée de Jeunes Squigs
- `grand-squig` — Grand Squig
- `squig-monstrueux` — Squig Monstrueux
- `necromancien` — Nécromancien
- `necromancien-puissant` — Nécromancien Puissant
- `magister-mortis` — Magister Mortis
- `jeune-goule` — Jeune Goule
- `necrophage` — Nécrophage
- `reine-des-cryptes` — Reine des Cryptes
- `zombie-faible` — Zombie Faible
- `horde-de-zombies` — Horde de Zombies
- `zombie-gardien` — Zombie Gardien
- `squelette-vigoureux` — Squelette Vigoureux
- `chevalier-des-tombes` — Chevalier des Tombes
- `esprit-faible` — Esprit Faible
- `ombre-vengeresse` — Ombre Vengeresse
- `monture-decharne` — Monture Décharné
- `destrier-squelettique` — Destrier Squelettique
- `charognard` — Charognard
- `vhargulf` — Vhargulf
- `comte-vampire` — Comte Vampire
- `seigneur-vampire` — Seigneur Vampire
- `l-ombre-du-fleuve` — L'Ombre du Fleuve
- `arachnarok` — Arachnarok
- `mangeuse-d-hommes-de-la-drakwald-araignee-geante` — Mangeuse d'hommes de la Drakwald (Araignée Géante)
- `gobelin-des-forets` — Gobelin des Forêts
- `chamane-gobelin-des-forets` — Chamane Gobelin des Forêts
- `raukos` — Raukos
- `razorgor` — Razorgor
- `le-vieux-dos-de-pus` — Le Vieux Dos-de-Pus
- `gueule-d-effroi` — Gueule d'Effroi
- `brise-krag` — Brise-Krag
- `nuee-de-squigs-des-cavernes` — Nuée de squigs des cavernes
- `gobelin-de-la-nuit` — Gobelin de la Nuit
- `dragon-de-la-foret` — Dragon de la Forêt
- `caledair-la-faux-de-feu` — Caledair - la Faux de Feu
- `l-abominable-halagrundsor` — « L'abominable » Halagrundsor
- `brochet-du-stir-fluvial` — Brochet du Stir
- `chef-de-meute-du-clan-moulder` — Chef de Meute du Clan Moulder
- `rat-ogre-briseur-d-os` — Rat Ogre Briseur d'os
- `experience-unique-du-clan-moulder` — Expérience Unique du Clan Moulder
- `jetsam-la-gelee-intelligente` — Jetsam - la Gelée Intelligente
- `amphisbaena` — Amphisbaena
- `troll-des-rivieres` — Troll des Rivières
- `sorciere-troll-des-rivieres` — Sorcière Troll des Rivières
- `sangsue-cameleon` — Sangsue Caméléon
- `pegase-noir` — Pégase Noir
- `volee-de-noctecorbes` — Volée de Noctecorbes
- `la-bete-de-l-oblast` — La Bête de l'Oblast
- `cultiste-de-la-lune-imprevisible` — Cultiste de la Lune Imprévisible
- `grand-taurus` — Grand Taurus
- `ver-des-marais` — Ver des Marais
- `griffon-zoo-imperial` — Griffon (Zoo Impérial)
- `vouivre-zoo-imperial` — Vouivre (Zoo Impérial)
- `wyrm-des-mers` — Wyrm des Mers
- `dragon-barbele` — Dragon Barbelé
- `le-fantasma` — Le Fantasma
- `chevalier-mort-vivant-revenant` — Chevalier Mort-Vivant (Revenant)
- `technomage-du-clan-skryre` — Technomage du Clan Skryre
- `prototype-du-clan-skryre` — « Prototype » du Clan Skryre
- `spectre-middenheim` — Spectre
- `loup-blanc` — Loup Blanc
- `isrogdal-lempresse` — Isrogdal l'Empressé
- `ugrik-legaree` — Ugrik l'Égarée
- `nazzaalta-affabule` — Nazzaalta Affabule
- `artur-piedmarteau` — Artur Piedmarteau
- `babrakkos` — Babrakkos
- `grain-d-achillee` — Grain d'achillée le lutin
- `gnawretch-skrray` — Gnawretch Skrray
- `kanker-flett` — Kanker Flett
- `maitre-moulder-skree` — Skree
- `wolfgard-hohmann` — Wolfgard Hohmann
- `wereburga-krotpreffer` — Wereburga Krotpreffer
- `moritz-valgeir` — Moritz Valgeir
- `stefan-hochen` — Stefan Hochen
- `marta-gerbenshreiber` — Marta Gerbenshreiber
- `wulfric-tore` — Wulfric Tore
- `waldtraud-blass` — Waldtraud Blass
- `ritta` — Ritta
- `wulfrum-viert` — Wulfrum Viert
- `emmille-munzstatter` — Emmille Münzstätter
- `yanni-weber` — Yanni Weber
- `johen` — Johen
- `frere-bengt` — Frère Bengt
- `grand-vizir-bhar` — Grand vizir Bhar
- `hugo-vallonvert` — Hugo Vallonvert
- `alfric-demi-nez-brisenclume` — Alfric « Demi-nez » Brisenclume
- `agna-lottrisdottir` — Agna Lottrisdottir
- `helmut-beckenbauer` — Helmut Beckenbauer
- `walpurga-wurklich` — Walpurga Wurklich
- `andrea-bruhn` — Andrea Bruhn
- `jacopo-schmidt` — Jacopo Schmidt
- `traudl-bauer` — Traudl Bauer
- `beate-moser` — Beate Moser
- `le-vieil-otto` — Le vieil Otto
- `brigitte-schleigel` — Brigitte Schleigel
- `athlete` — Athlète
- `gerdon-salzwed` — Gerdon Salzwed
- `hasso-schroeter` — Hasso Schroeter
- `kat-sperber` — Kat Sperber
- `theresia-kleist` — Theresia Kleist
- `baudroye` — Baudroye
- `crabe-boxeur` — Crabe boxeur
- `stylet` — Stylet
- `elementaire-de-mer` — Élémentaire de mer
- `gargantuan` — Gargantuan
- `kharibde` — Kharibde
- `syrene-bleue` — Syrène bleue
- `hydre-d-os` — Hydre d'os
- `sangsue-des-abysses` — Sangsue des abysses
- `leviathan-phare` — Léviathan-phare
- `leviathan-noir` — Léviathan noir
- `jaego-roth` — Jaego Roth
- `long-drong-silver` — Long Drong Silver
- `wulfrik` — Wulfrik
- `vrisk-gratte-le-fer` — Vrisk Gratte-le-Fer
- `sangsue-geante` — Sangsue géante
- `sangsue-des-arbres` — Sangsue des arbres
- `naiade` — Naïade
- `familier-de-combat` — Familier de combat
- `familier-de-pouvoir` — Familier de pouvoir
- `familier-de-sorts` — Familier de sorts
- `p-tarix-celui-qui-ecrit` — P'tarix, Celui qui écrit
- `xirat-p-celui-qui-lit` — Xirat'p, Celui qui lit

<!-- sources-empreinte: a73aef065e74b15c3d655f8ab3df0fe60c8fbcea (2079 fichiers, 134 dossiers) corps: b40f37203a41cb4a0c801225da39879943323e87 -->
