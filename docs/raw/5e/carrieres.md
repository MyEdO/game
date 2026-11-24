# Atlas RAW — Classes, Carrières & Statut

> Référentiel **autosuffisant** des règles du cœur **5e** (RAW), consolidé sur les livres autorisés, à usage
> d'agent (répondre + auditer le code sans rouvrir les livres). Chaque règle cite `LIVRE NN l.X-Y`
> (last-recours = la source). Abréviations : [`sources.md`](../sources.md). Index : [`00-index.md`](00-index.md).
>
> Rédigé pour #4898 ; chaque réf est relevée par script dans `Source/`.

Cette fiche couvre l'**anatomie d'une carrière** en 5e (niveaux, *Advance Scheme*, Compétences, Talents, dotations) et l'**index des 64 carrières du livre de base**, chacune avec ses quatre niveaux, son Statut et l'étendue de son texte. La dépense de PX, les cases de carrière et le changement de carrière vivent dans [`avancement.md`](avancement.md) ; le tirage de la carrière à la création dans [`creation.md`](creation.md). Le **Statut** (revenus, *Standing*) n'est pas couvert ici.

## Sommaire

- [Anatomie d'une carrière](#anatomie-dune-carrière)
- [Index des carrières du livre de base](#index-des-carrières-du-livre-de-base)
- [Dotations des carrières absentes de la v4](#dotations-des-carrières-absentes-de-la-v4)

---

## Anatomie d'une carrière

Chaque carrière appartient à une Classe (`CRB 018 l.13`) et a **quatre niveaux** ; à la création, on entre toujours au premier (`CRB 018 l.37`). Son *Advance Scheme* ouvre trois Caractéristiques au premier niveau, puis une de plus à chaque niveau ; toute Caractéristique d'un niveau inférieur ou égal au niveau courant reste achetable (`CRB 018 l.41-43`).

Les Compétences et les Talents du niveau courant **et des niveaux inférieurs** sont achetables (`CRB 018 l.63`, `l.73`). Une Compétence du premier niveau, en gras italique, est celle du Test de revenu (`CRB 018 l.65`). À la création, le personnage reçoit les dotations du premier niveau en plus de celles de sa Classe (`CRB 018 l.77`). Le Statut d'un niveau s'applique tant que le personnage garde au moins une dotation de ce niveau (`CRB 018 l.79-81`).

## Index des carrières du livre de base

Les 64 carrières, par Classe. Chaque ligne donne le nom de jeu, l'id de la donnée (`careers.json`, ses niveaux `<id>-1` à `<id>-4` dans `careerLevels.json`), les quatre niveaux avec leur Statut, et l'étendue du texte de la carrière dans le chapitre.

### Courtisans — *Courtier*

| Carrière | id | Niveaux (VO) | Source |
|---|---|---|---|
| **Conseiller** — *Adviser* | `conseiller-5e` | Aide — Silver 1 · Adviser — Silver 3 · Counsellor — Silver 5 · Chancellor — Gold 3 | `CRB 018 l.83-133` |
| **Artiste** — *Artist* | `artiste-5e` | Apprentice Artist — Brass 2 · Artist — Silver 1 · Master Artist — Silver 4 · Maestro — Gold 2 | `CRB 018 l.323-377` |
| **Duelliste** — *Duellist* | `duelliste-5e` | Fencer — Silver 3 · Duellist — Silver 4 · Duelmaster — Gold 1 · Judicial Champion — Gold 2 | `CRB 018 l.809-869` |
| **Émissaire** — *Envoy* | `emissaire-5e` | Herald — Silver 2 · Envoy — Silver 4 · Diplomat — Gold 2 · Ambassador — Gold 5 | `CRB 018 l.985-1045` |
| **Noble** — *Noble* | `noble-5e` | Scion — Gold 1 · Noble — Gold 2 · Grandee — Gold 5 · Noble Lord — Gold 7 | `CRB 018 l.1945-2003` |
| **Serviteur** — *Servant* | `serviteur-5e` | Menial — Brass 3 · Servant — Brass 4 · Attendant — Silver 3 · Steward — Gold 1 | `CRB 018 l.2991-3053` |
| **Espion** — *Spy* | `espion-5e` | Informer — Brass 4 · Spy — Silver 3 · Agent — Gold 1 · Spymaster — Gold 3 | `CRB 018 l.3241-3295` |
| **Intendant** — *Warden* | `intendant-5e` | Custodian — Brass 4 · Warden — Silver 3 · Seneschal — Gold 1 · Governor — Gold 4 | `CRB 018 l.3553-3613` |

### Citadins — *Burgher*

| Carrière | id | Niveaux (VO) | Source |
|---|---|---|---|
| **Agitateur** — *Agitator* | `agitateur-5e` | Pamphleteer — Brass 1 · Agitator — Brass 2 · Rabble Rouser — Brass 3 · Demagogue — Brass 5 | `CRB 018 l.141-203` |
| **Artisan** — *Artisan* | `artisan-5e` | Apprentice Artisan — Brass 2 · Artisan — Silver 1 · Master Artisan — Silver 3 · Guildmaster — Gold 1 | `CRB 018 l.265-321` |
| **Mendiant** — *Beggar* | `mendiant-5e` | Pauper — Brass 0 · Beggar — Brass 1 · Master Beggar — Brass 4 · Beggar King — Silver 2 | `CRB 018 l.441-495` |
| **Enquêteur** — *Investigator* | `enqueteur-5e` | Enquirer — Silver 1 · Investigator — Silver 2 · Sleuth — Silver 3 · Detective — Silver 5 | `CRB 018 l.1463-1523` |
| **Marchand** — *Merchant* | `marchand-5e` | Trader — Silver 2 · Merchant — Silver 5 · Master Merchant — Gold 1 · Merchant Prince — Gold 3 | `CRB 018 l.1705-1763` |
| **Ratier** — *Rat Catcher* | `ratier-5e` | Rat Hunter — Brass 3 · Rat Catcher — Brass 5 · Sewer Jack — Silver 2 · Exterminator — Silver 3 | `CRB 018 l.2555-2615` |
| **Bourgeois** — *Townsman* | `bourgeois-5e` | Clerk — Brass 5 · Townsman — Silver 1 · Proprietor — Silver 3 · Burgomeister — Gold 3 | `CRB 018 l.3431-3489` |
| **Milicien** — *Watchman* | `milicien-5e` | Watch Recruit — Brass 3 · Watchman — Silver 1 · Watch Sergeant — Silver 3 · Watch Captain — Gold 1 | `CRB 018 l.3675-3735` |

### Lettrés — *Academic*

| Carrière | id | Niveaux (VO) | Source |
|---|---|---|---|
| **Apothicaire** — *Apothecary* | `apothicaire-5e` | Apothecary's Apprentice — Brass 3 · Apothecary — Silver 1 · Master Apothecary — Silver 3 · Apothecary General — Gold 1 | `CRB 018 l.205-263` |
| **Ingénieur** — *Engineer* | `ingenieur-5e` | Student Engineer — Brass 4 · Engineer — Silver 3 · Master Engineer — Silver 5 · Chartered Engineer — Gold 2 | `CRB 018 l.871-927` |
| **Juriste** — *Lawyer* | `juriste-5e` | Student Lawyer — Brass 4 · Lawyer — Silver 3 · Barrister — Gold 1 · Judge — Gold 2 | `CRB 018 l.1641-1697` |
| **Nonne** — *Nun* | `nonne-5e` | Novice — Brass 1 · Nun — Silver 1 · Abbess — Gold 1 · Prioress General — Gold 4 | `CRB 018 l.2005-2063` |
| **Médecin** — *Physician* | `medecin-5e` | Physician's Apprentice — Brass 4 · Physician — Silver 3 · Doktor — Silver 5 · Court Physician — Gold 1 | `CRB 018 l.2189-2243` |
| **Prêtre** — *Priest* | `pretre-5e` | Initiate — Brass 2 · Priest — Silver 2 · High Priest — Gold 1 · Lector — Gold 4 | `CRB 018 l.2367-2425` |
| **Érudit** — *Scholar* | `erudit-5e` | Student — Brass 3 · Scholar — Silver 1 · Fellow — Silver 5 · Professor — Gold 1 | `CRB 018 l.2865-2925` |
| **Sorcier** — *Wizard* | `sorcier-5e` | Wizard's Apprentice — Brass 3 · Wizard — Silver 3 · Master Wizard — Gold 1 · Wizard Lord — Gold 2 | `CRB 018 l.3857-3915` |

### Ruraux — *Peasant*

| Carrière | id | Niveaux (VO) | Source |
|---|---|---|---|
| **Bailli** — *Bailiff* | `bailli-5e` | Tax Collector — Silver 1 · Bailiff — Silver 5 · Reeve — Gold 1 · Magistrate — Gold 2 | `CRB 018 l.379-439` |
| **Sorcier de village** — *Hedge Witch* | `sorcier-de-village-5e` | Hedge Apprentice — Brass 1 · Hedge Witch — Brass 4 · Hedge Master — Brass 5 · Hedgewise — Silver 2 | `CRB 018 l.1289-1341` |
| **Herboriste** — *Herbalist* | `herboriste-5e` | Herb Gatherer — Brass 1 · Herbalist — Brass 4 · Herb Master — Brass 5 · Herbwise — Silver 2 | `CRB 018 l.1349-1403` |
| **Chasseur** — *Hunter* | `chasseur-5e` | Trapper — Brass 2 · Hunter — Brass 4 · Tracker — Silver 1 · Huntsmaster — Silver 4 | `CRB 018 l.1405-1461` |
| **Mineur** — *Miner* | `mineur-5e` | Prospector — Brass 2 · Miner — Brass 3 · Master Miner — Brass 5 · Mine Foreman — Silver 3 | `CRB 018 l.1823-1881` |
| **Mystique** — *Mystic* | `mystique-5e` | Fortune Teller — Brass 1 · Mystic — Brass 3 · Auger — Silver 1 · Seer — Silver 2 | `CRB 018 l.1883-1943` |
| **Éclaireur** — *Scout* | `eclaireur-5e` | Guide — Brass 3 · Scout — Brass 5 · Pathfinder — Silver 1 · Explorer — Silver 5 | `CRB 018 l.2927-2989` |
| **Villageois** — *Villager* | `villageois-5e` | Peasant — Brass 2 · Villager — Brass 3 · Councillor — Brass 5 · Village Elder — Silver 2 | `CRB 018 l.3491-3547` |

### Riverains — *Riverfolk*

| Carrière | id | Niveaux (VO) | Source |
|---|---|---|---|
| **Batelier** — *Boatman* | `batelier-5e` | Boathand — Brass 3 · Boatman — Silver 1 · Bargeswain — Silver 2 · Barge Master — Silver 5 | `CRB 018 l.503-565` |
| **Nautonier** — *Pilot* | `nautonier-5e` | Riverguide — Brass 4 · Pilot — Silver 1 · Navigator — Silver 3 · Master Pilot — Silver 5 | `CRB 018 l.2245-2303` |
| **Patrouilleur fluvial** — *Riverwarden* | `patrouilleur-fluvial-5e` | River Recruit — Brass 4 · Riverwarden — Silver 2 · Shipsword — Silver 3 · Shipsword Master — Gold 1 | `CRB 018 l.2617-2675` |
| **Femme du fleuve** — *Riverwoman* | `femme-du-fleuve-5e` | Greenfish — Brass 2 · Riverwoman — Brass 3 · Riverwise — Brass 5 · River Elder — Silver 2 | `CRB 018 l.2677-2737` |
| **Marin** — *Sailor* | `marin-5e` | Landsman — Brass 4 · Sailor — Silver 2 · Boatswain — Silver 3 · Ship's Master — Gold 2 | `CRB 018 l.2801-2863` |
| **Contrebandier** — *Smuggler* | `contrebandier-5e` | River Runner — Brass 4 · Smuggler — Silver 1 · Master Smuggler — Silver 5 · Smuggler King — Gold 3 | `CRB 018 l.3119-3181` |
| **Débardeur** — *Stevedore* | `debardeur-5e` | Dockhand — Brass 3 · Stevedore — Brass 5 · Foreman — Silver 3 · Dock Master — Silver 5 | `CRB 018 l.3303-3365` |
| **Naufrageur** — *Wrecker* | `naufrageur-5e` | Cargo Scavenger — Brass 2 · Wrecker — Brass 3 · River Pirate — Brass 5 · Wrecker Captain — Silver 5 | `CRB 018 l.3917-3973` |

### Itinérants — *Ranger*

| Carrière | id | Niveaux (VO) | Source |
|---|---|---|---|
| **Chasseur de primes** — *Bounty Hunter* | `chasseur-de-primes-5e` | Thief-taker — Silver 1 · Bounty Hunter — Silver 3 · Master Bounty Hunter — Silver 5 · Bounty Hunter General — Gold 1 | `CRB 018 l.567-629` |
| **Cocher** — *Coachman* | `cocher-5e` | Postilion — Silver 1 · Coachman — Silver 2 · Coach Master — Silver 3 · Route Master — Gold 2 | `CRB 018 l.749-807` |
| **Saltimbanque** — *Entertainer* | `saltimbanque-5e` | Busker — Brass 3 · Entertainer — Brass 5 · Troubadour — Silver 3 · Troupe Leader — Gold 1 | `CRB 018 l.929-983` |
| **Flagellant** — *Flagellant* | `flagellant-5e` | Penitent — Brass 0 · Flagellant — Brass 0 · Zealot — Brass 0 · Prophet of Doom — Brass 0 | `CRB 018 l.1109-1165` |
| **Messager** — *Messenger* | `messager-5e` | Runner — Brass 3 · Messenger — Silver 2 · Courier — Silver 3 · Courier-captain — Silver 5 | `CRB 018 l.1765-1821` |
| **Colporteur** — *Pedlar* | `colporteur-5e` | Vagabond — Brass 1 · Pedlar — Brass 4 · Carter — Silver 2 · Wandering Trader — Silver 3 | `CRB 018 l.2127-2187` |
| **Patrouilleur routier** — *Roadwarden* | `patrouilleur-routier-5e` | Toll Keeper — Brass 5 · Roadwarden — Silver 3 · Road Sergeant — Silver 5 · Road Captain — Gold 1 | `CRB 018 l.2739-2799` |
| **Répurgateur** — *Witch Hunter* | `repurgateur-5e` | Interrogator — Silver 1 · Witch Hunter — Silver 3 · Witch Hunter Captain — Gold 1 · Witchfinder General — Gold 2 | `CRB 018 l.3797-3855` |

### Guerriers — *Warrior*

| Carrière | id | Niveaux (VO) | Source |
|---|---|---|---|
| **Cavalier** — *Cavalryman* | `cavalier-5e` | Horseman — Silver 3 · Cavalryman — Silver 4 · Cavalry Sergeant — Gold 1 · Cavalry Officer — Gold 2 | `CRB 018 l.631-689` |
| **Garde** — *Guard* | `garde-5e` | Sentry — Brass 5 · Guard — Silver 2 · Honour Guard — Silver 4 · Guard Officer — Gold 1 | `CRB 018 l.1229-1287` |
| **Chevalier** — *Knight* | `chevalier-5e` | Squire — Silver 3 · Knight — Silver 5 · First Knight — Gold 2 · Knight of the Inner Circle — Gold 4 | `CRB 018 l.1585-1639` |
| **Gladiateur** — *Pit Fighter* | `gladiateur-5e` | Pugilist — Brass 4 · Pit Fighter — Silver 2 · Pit Champion — Silver 5 · Pit Legend — Gold 2 | `CRB 018 l.2305-2365` |
| **Spadassin** — *Protagonist* | `spadassin-5e` | Braggart — Brass 3 · Protagonist — Brass 5 · Hitman — Silver 4 · Assassin — Gold 1 | `CRB 018 l.2433-2495` |
| **Tueur** — *Slayer* | `tueur-5e` | Troll Slayer — Brass 2 · Giant Slayer — Brass 2 · Dragon Slayer — Brass 2 · Daemon Slayer — Brass 2 | `CRB 018 l.3055-3117` |
| **Soldat** — *Soldier* | `soldat-5e` | Recruit — Brass 5 · Soldier — Silver 2 · Sergeant — Silver 3 · Officer — Gold 1 | `CRB 018 l.3183-3239` |
| **Prêtre guerrier** — *Warrior Priest* | `pretre-guerrier-5e` | Neophyte — Brass 2 · Warrior Priest — Silver 3 · Priest Sergeant — Silver 5 · Priest Captain — Gold 1 | `CRB 018 l.3615-3673` |

### Roublards — *Rogue*

| Carrière | id | Niveaux (VO) | Source |
|---|---|---|---|
| **Charlatan** — *Charlatan* | `charlatan-5e` | Swindler — Brass 3 · Charlatan — Brass 5 · Con Artist — Silver 2 · Scoundrel — Silver 4 | `CRB 018 l.691-741` |
| **Receleur** — *Fence* | `receleur-5e` | Broker — Brass 5 · Fence — Silver 1 · Trafficker — Silver 3 · Black Marketeer — Gold 1 | `CRB 018 l.1047-1107` |
| **Pilleur de tombes** — *Grave Robber* | `pilleur-de-tombes-5e` | Penny Thief — Brass 2 · Grave Robber — Brass 4 · Tomb Robber — Silver 3 · Treasure Hunter — Silver 5 | `CRB 018 l.1167-1227` |
| **Entremetteur** — *Knave* | `entremetteur-5e` | Hustler — Brass 2 · Knave — Brass 3 · Procurer — Silver 1 · Ringleader — Silver 3 | `CRB 018 l.1525-1583` |
| **Hors-la-loi** — *Outlaw* | `hors-la-loi-5e` | Brigand — Brass 3 · Outlaw — Brass 5 · Outlaw Chief — Silver 3 · Bandit King — Gold 1 | `CRB 018 l.2065-2125` |
| **Rançonneur** — *Racketeer* | `ranconneur-5e` | Thug — Brass 3 · Racketeer — Brass 5 · Gang Boss — Silver 3 · Crime Lord — Gold 1 | `CRB 018 l.2497-2553` |
| **Voleur** — *Thief* | `voleur-5e` | Prowler — Brass 3 · Thief — Brass 4 · Master Thief — Brass 5 · Cat Burglar — Silver 3 | `CRB 018 l.3367-3429` |
| **Sorcier dissident** — *Witch* | `sorcier-dissident-5e` | Dabbler — Brass 3 · Witch — Silver 2 · Enchanter — Silver 5 · Warlock — Gold 2 | `CRB 018 l.3737-3795` |
## Dotations des carrières absentes de la v4

Cinq dotations des listes du CRB n'ont pas de jumelle dans la donnée v4 :

| Dotation | id | Source |
|---|---|---|
| *Rat Poison* | `poison-a-rats` | `CRB 096 l.17` |
| *Remedy* | `remede` | `CRB 097 l.37` |
| *Basket* | `panier` | `CRB 018 l.2163` |
| *Rune Axe* | `hache-runique` | `CRB 018 l.3117` |
| *Calling Card* | `carte-de-visite` | `CRB 018 l.3429` |
