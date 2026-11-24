# Atlas RAW — Création de Personnage

> Référentiel **autosuffisant** des règles du cœur **5e** (RAW), consolidé sur les livres autorisés, à usage
> d'agent (répondre + auditer le code sans rouvrir les livres). Chaque règle cite `LIVRE NN l.X-Y`
> (last-recours = la source). Abréviations : [`sources.md`](../sources.md). Index : [`00-index.md`](00-index.md).
>
> Rédigé pour #4898 ; chaque citation est recopiée de `Source/` et vérifiée par script contre le texte.

Cette fiche couvre la **création de personnage** en 5e, dans l'ordre des six étapes du livre : Espèce (tirage, +1 Fortune, Talents aléatoires, fiches des cinq Espèces), Classe et Carrière (tirage, dotations du niveau 2, cases cochées, Compétences de carrière), Caractéristiques (méthodes A/B/C, table par Espèce), Compétences (Augmentations d'Espèce et de carrière, plafond, types), Talent de carrière, dotations, richesse de départ, Blessures, Mouvement, Encombrement, *Oh Fickle Fate*, et prérequis du magicien et du prêtre ; l'étape 6, Personnalité, n'est pas couverte ici. La dépense de PX en jeu relève de l'aire `avancement` ; la structure d'une carrière (niveaux, *Advance Scheme*, listes) vit dans [`carrieres.md`](carrieres.md).

## Sommaire

- [Les six étapes](#les-six-étapes)
- [1. Espèce — choix ou tirage](#1-espèce--choix-ou-tirage)
- [Report de l'Espèce sur la feuille](#report-de-lespèce-sur-la-feuille)
- [RANDOM TALENTS — table verbatim](#random-talents--table-verbatim)
- [Humains (Reiklanders)](#humains-reiklanders)
- [Nains](#nains)
- [Halflings](#halflings)
- [Hauts Elfes](#hauts-elfes)
- [Elfes Sylvains](#elfes-sylvains)
- [2. Classe et Carrière](#2-classe-et-carrière)
- [RANDOM CLASS AND CAREER TABLE — table verbatim](#random-class-and-career-table--table-verbatim)
- [3. Caractéristiques — méthodes A, B, C](#3-caractéristiques--méthodes-a-b-c)
- [CHARACTERISTIC TABLE — table verbatim](#characteristic-table--table-verbatim)
- [4. Compétences — Augmentations de départ](#4-compétences--augmentations-de-départ)
- [Types de Compétences](#types-de-compétences)
- [5. Talent de carrière et dotations](#5-talent-de-carrière-et-dotations)
- [CLASS TRAPPINGS — table verbatim](#class-trappings--table-verbatim)
- [STARTING WEALTH — table verbatim](#starting-wealth--table-verbatim)
- [Blessures (Wounds)](#blessures-wounds)
- [Mouvement (Movement)](#mouvement-movement)
- [Encombrement maximal](#encombrement-maximal)
- [Oh Fickle Fate — +1 Fate](#oh-fickle-fate--1-fate)
- [Créer un magicien ou un prêtre](#créer-un-magicien-ou-un-prêtre)

---

## Les six étapes

La création combine décisions et jets de dés ; l'histoire du personnage est laissée au joueur (`CRB 005 l.5-7`). Tout s'inscrit sur la feuille de personnage (`CRB 005 l.9`). Le résumé du livre fixe l'ordre (`CRB 005 l.11-18`) :

1. *Determine Species* (`CRB 005 l.13`)
2. *Determine Class and Career* (`CRB 005 l.14`)
3. *Determine Characteristics* (`CRB 005 l.15`)
4. *Assign Career Skills* (`CRB 005 l.16`)
5. *Assign Talents, Trappings, and Final Game Details* (`CRB 005 l.17`)
6. *Choose Personality and Background* (`CRB 005 l.18`)

L'encadré *Fitting In* demande d'accorder le personnage aux autres PJ et au jeu prévu par la GM ; il ne pose aucune valeur (`CRB 005 l.20-22`).

> « Your Character needs to work well with the other PCs and fit into the game the GM has planned, so talk as a group about your Character plans. » — `CRB 005 l.22`

## 1. Espèce — choix ou tirage

Deux voies : choisir parmi les cinq Espèces, **ou** tirer sur la *Species Table* ; accepter le **premier** résultat du tirage donne **un point de Fortune** supplémentaire (`CRB 006 l.5-7`).

> « **A)** Choose from **Human**, **Dwarf**, **Halfling**, **High Elf**, or **Wood Elf** *or* » — `CRB 006 l.5`

> « Roll on the **Species Table**, and gain an extra point of Fortune if you accept the first result. » — `CRB 006 l.7`

Table (`CRB 006 l.9-17`) :

| D100  | Species            |
|-------|--------------------|
| 01–90 | Human (page 26)    |
| 91–94 | Halfling (page 28) |
| 95–98 | Dwarf (page 30)    |
| 99    | High Elf (page 32) |
| 00    | Wood Elf (page 34) |

Les renvois de page de cette table sont croisés par rapport aux folios des chapitres : les Nains sont au folio 28 (`CRB 009 l.3`), les Halflings au folio 30 (`CRB 010 l.3`).

## Report de l'Espèce sur la feuille

L'étape B recopie sur la feuille les informations de la section de l'Espèce (`CRB 006 l.19`) :

- **Age and Appearance** : à décider, les options du livre sont une inspiration (`CRB 006 l.21`).
- **Languages** : les Compétences de langue vont dans *Known Languages* ; une langue est une Compétence fondée sur l'Intelligence (`CRB 006 l.23`).
- **Skills** : les Compétences d'Espèce se choisissent maintenant, ou après avoir vu les options de carrière et les Caractéristiques (`CRB 006 l.25`).
- **Movement, Fate and Fortune** : valeurs recopiées telles quelles (`CRB 006 l.27`).
- **Talents** : Talents d'Espèce à choisir ; un *Random Talent* se tire au D100 sur la table ci-dessous, et un Talent déjà possédé se relance (`CRB 006 l.29`).

> « Languages are a Skill that uses the Intelligence Characteristic » — `CRB 006 l.23`

> « **Skills:** choose your Species Skills now and mark them on your Character Sheet, or make a note of them and decide after determining your Career Skill options and Characteristics. » — `CRB 006 l.25`

> « If you are awarded a Random Talent, determine it by rolling D100 on the table below. If you roll a Talent you already have, re-roll. » — `CRB 006 l.29`

## RANDOM TALENTS — table verbatim

Table (`CRB 006 l.31-54`) :

| Roll  | Description         | Roll  | Description         |
|-------|---------------------|-------|---------------------|
| 01-02 | Acute Sense (Sight) | 51-52 | Orientation         |
| 03-05 | Ambidextrous        | 53-55 | Perfect Pitch       |
| 06-07 | Artistic            | 56-57 | Pure Soul           |
| 08-10 | Attractive          | 58-60 | Read/Write          |
| 11-12 | Briber              | 61-62 | Resistance (Poison) |
| 13-15 | Cardsharp           | 63-65 | Rover               |
| 16-17 | Catfall             | 66-67 | Savvy               |
| 18-20 | Coolheaded          | 68-70 | Sea Legs            |
| 21-22 | Contortionist       | 71-72 | Sharp               |
| 23-25 | Flee!               | 73-75 | Stone Soup          |
| 26-27 | Gregarious          | 76-77 | Strong Back         |
| 28-30 | Iron Jaw            | 78-80 | Sturdy              |
| 31-32 | Lightning Reflexes  | 81-82 | Suave               |
| 33-35 | Linguistics         | 83-85 | Super Numerate      |
| 36-37 | Marksman            | 86-87 | Supportive          |
| 38-40 | Mimic               | 88-90 | Tinker              |
| 41-42 | Night Vision        | 91-92 | Tunnel Fighter      |
| 43-45 | Nimble Fingered     | 93-95 | Very Resilient      |
| 46-47 | Noble Blood         | 96-97 | Very Strong         |
| 48-50 | Nose for Trouble    | 98-00 | Warrior Born        |

Deux Espèces reçoivent des *Random Talents* : les Humains (4) et les Halflings (2) (`CRB 008 l.63`, `CRB 010 l.63`).

## Humains (Reiklanders)

- **Age** : 14+2d10 (`CRB 008 l.45`)
- **Height** : 4'9"+2d10" (`CRB 008 l.47`)
- **Eye colour** : « Ice Blue, Green, Pale Blue, Blue, Pale Grey, Grey, Brown, Hazel, Dark Brown, Black » — `CRB 008 l.49`
- **Hair colour** : « White Blond, Golden Blond, Red Blond, Golden Brown, Light Brown, Dark Brown, Black, Auburn, Red, Grey » — `CRB 008 l.51`

Le livre ne donne pas de table de dés pour les couleurs d'yeux et de cheveux ; ce sont des listes d'inspiration (`CRB 006 l.21`).

> « Take six Advances (+30) in the Language (Reikspiel) Skill » — `CRB 008 l.55`

> « Add one Advance (+5) to any five of the following Skills: Animal Care, Charm, Cool, Evaluate, Gossip, Haggle, Language (Bretonnian), Language (Wastelander), Leadership, Lore (Reikland), Melee (Basic), Ranged (Bow) » — `CRB 008 l.59`

> « *Doomed* and 4 Random Talents » — `CRB 008 l.63`

> « Humans are destined to play a role in shaping events, and start with 4 Fate. » — `CRB 008 l.67`

> « Humans are smiled upon by Ranald. They start with 3 Fortune. » — `CRB 008 l.71`

> « Humans are neither fast nor slow, and have a Movement rating of 4. » — `CRB 008 l.75`

## Nains

- **Age** : 15+10d10 (`CRB 009 l.53`)
- **Height** : 4'3"+1d10" (`CRB 009 l.55`)
- **Eye colour** : « Coal, Lead, Steel, Blue, Earth Brown, Bronze, Hazel, Green, Copper, Gold » — `CRB 009 l.57`
- **Hair colour** : « White, Grey, Pale Blond, Golden, Copper, Bronze, Brown, Dark Brown, Reddish Brown, Black » — `CRB 009 l.59`

> « Take six Advances (+30) in both the Language (Khazalid) and Language (Reikspiel) Skills » — `CRB 009 l.63`

> « Add one Advance (+5) to any five of the following Skills: Consume Alcohol, Cool, Endurance, Entertain (Storytelling), Evaluate, Intimidate, Lore (Dwarfs), Lore (Geology), Lore (Metallurgy), Melee (Basic), Trade (any one) » — `CRB 009 l.67`

> « *Magic Resistance*, *Night Vision*, *Read/Write* or *Relentless*, *Resolute* or *Strong-minded*, *Sturdy* » — `CRB 009 l.71`

> « Dwarfs have had their heyday, and are in decline. Dwarf Characters start with 2 Fate. » — `CRB 009 l.75`

> « Nobody would call a dwarf lucky, least of all a dwarf. They start with 2 Fortune. » — `CRB 009 l.79`

> « Dwarfs move with a relentless stride, not a rapid one. Dwarfs have a Movement rating of 3. » — `CRB 009 l.83`

**Option *Animosity (Elves)*** : beaucoup de nains ont le trait de Psychologie *Animosity (Elves)* ; le livre permet de l'ignorer entre membres du groupe, et l'appelle « Talent » dans la même phrase (`CRB 009 l.37-39`). Le livre ne dit pas si un Nain de PJ l'a par défaut.

> « As such, many dwarfs have the Animosity (Elves) Psychology trait (see page 183 and 356). » — `CRB 009 l.39`

> « So, you may prefer to ignore this Talent between party members. » — `CRB 009 l.39`

Les Nains doublent leur Encombrement maximal (`CRB 016 l.63`, voir [Encombrement maximal](#encombrement-maximal)).

## Halflings

- **Age** : 15 + 5d10 (`CRB 010 l.45`)
- **Height** : 3'1" + 1d10" (`CRB 010 l.47`)
- **Eye colour** : « Light Grey, Grey, Pale Blue, Blue, Green, Hazel, Brown, Copper, Dark Brown » — `CRB 010 l.49`
- **Hair colour** : « Grey, Flaxen, Russet, Honey, Chestnut, Ginger, Mustard, Almond, Chocolate, Liquorice » — `CRB 010 l.51`

> « Take six Advances (+30) in both the Language (Haffennaff ) and Language (Reikspiel) Skills » — `CRB 010 l.55`

> « Add one Advance (+5) to any five of the following Skills: Charm, Consume Alcohol, Dodge, Gamble, Haggle, Intuition, Lore (Reikland), Perception, Sleight of Hand, Stealth (Any), Trade (Cook) » — `CRB 010 l.59`

> « *Acute Sense (Taste)*, *Night Vision*, *Resistance (Chaos)*, 2 Random Talents (page 23) » — `CRB 010 l.63`

> « Halflings care little for destiny. They start with 2 Fate. » — `CRB 010 l.67`

> « Halflings enjoy a fair share of luck, starting with 3 Fortune. » — `CRB 010 l.71`

> « Halflings have short legs and broad frames. They have a Movement rating of 3. » — `CRB 010 l.75`

## Hauts Elfes

- **Age** : 30 + 10d10 (`CRB 011 l.47`)
- **Height** : 5'11" + 1d10" (`CRB 011 l.49`)
- **Eye colour** : « Jet, Amethyst, Aquamarine, Sapphire, Turquoise, Emerald, Amber, Copper, Citrine, Gold » — `CRB 011 l.51`
- **Hair colour** : « Silver, White, Pale Blond, Blond, Yellow Blond, Copper Blond, Red Blond, Auburn, Red, Black » — `CRB 011 l.53`

> « Take six Advances (+30) in both the Language (Elthárin) and Language (Reikspiel) Skills » — `CRB 011 l.57`

> « Add one Advance (+5) to any five of the following Skills: Cool, Entertain (Sing), Evaluate, Leadership, Melee (Basic), Navigation, Perception, Play (any one), Ranged (Bow), Sail, Swim » — `CRB 011 l.61`

> « *Acute Sense (Sight)*, *Coolheaded* or *Savvy*, *Night Vision*, *Second Sight* or *Sixth Sense*, *Read/Write* » — `CRB 011 l.65`

> « High elf Characters rarely draw the eye of destiny, starting with 1 Fate. » — `CRB 011 l.69`

> « High elves rely on their own faculties more than luck, starting with 2 Fortune. » — `CRB 011 l.73`

> « High elf Characters are especially fast, with a Movement rating of 5. » — `CRB 011 l.77`

## Elfes Sylvains

- **Age** : 30+10d10 (`CRB 012 l.51`)
- **Height** : 5'11" + 1d10" (`CRB 012 l.53`)
- **Eye colour** : « Ivory, Charcoal, Ivy Green, Mossy Green, Chestnut, Dark Brown, Tan, Sandy Brown, Violet » — `CRB 012 l.55`
- **Hair colour** : « Birch Silver, Ash Blond, Rose Gold, Honey Blond, Brown, Mahogany Brown, Dark Brown, Sienna, Ebony, Blue-Black » — `CRB 012 l.57`

> « Take six Advances (+30) in both the Language (Elthárin) and Language (Reikspiel) Skills » — `CRB 012 l.61`

> « Add one Advance (+5) to any five of the following Skills: » — `CRB 012 l.65`

> « Athletics, Climb, Endurance, Entertain (Sing), Intimidate, Melee (Basic), Outdoor Survival, Perception, Ranged (Bow), Stealth (Rural), Track » — `CRB 012 l.67`

> « *Acute Sense (Sight)*, *Hardy* or *Second Sight*, *Night Vision*, *Read/Write* or *Very Resilient*, *Rover* » — `CRB 012 l.71`

> « Wood elf Characters rarely draw the eye of destiny, starting with 1 Fate. » — `CRB 012 l.75`

> « Wood elves rely on their own faculties more than luck, starting with 2 Fortune. » — `CRB 012 l.79`

> « Wood elf Characters are especially fast, with a Movement rating of 5. » — `CRB 012 l.83`

L'encadré *Sylvan Cousins* distingue les Elfes Sylvains d'Athel Loren et de la Laurelorn par le caractère seulement : les seconds gardent les Compétences et Talents des Elfes Sylvains (`CRB 012 l.87-93`).

> « Thus, in character, they are more like the high elves, whilst still having the Skills and Talents of the wood elves. » — `CRB 012 l.91`

Une fois l'Espèce remplie, on passe à *Class and Career* (`CRB 009 l.85`, `CRB 010 l.77`, `CRB 011 l.79`, `CRB 012 l.85`).

## 2. Classe et Carrière

Chaque Carrière appartient à une Classe ; la Classe de départ fournit une partie des possessions (`CRB 013 l.5`). Le joueur **choisit** une Classe et une Carrière ouvertes à son Espèce, **ou** tire sur la table de son Espèce (`CRB 013 l.7-9`).

> « **A)** Choose a Class and Career available to your Species *or* » — `CRB 013 l.7`

> « **B)** Roll on your Species' **Class and Career Table**. » — `CRB 013 l.9`

**Dotations du niveau 2.** Garder le **premier** résultat donne **deux** *Trappings* du **deuxième** niveau de cette carrière (option C). Sinon, deux tirages de plus et un choix parmi les trois donnent **un** *Trapping* du deuxième niveau ; rejeter aussi ceux-là, puis tirer jusqu'à accepter ou choisir, ne donne **aucun** *Trapping* supplémentaire (option D) (`CRB 013 l.11-13`).

> « **C)** If you keep the first result, you may start the game with two Trappings (page 39) from that Career's second Career Level. » — `CRB 013 l.11`

> « **D)** If not, roll twice more and choose any of the three options to acquire one Trapping from the second Career Level instead. If you reject those as well, keep rolling until you accept a result, or simply choose one, but you gain no additional Trappings. » — `CRB 013 l.13`

**Cases cochées.** Un *Trapping* acquis ainsi coche une case (ou deux) du *Career Advancement Tracker* ; c'est la seule fois où la création en coche (`CRB 013 l.15`).

> « If you acquired a Trapping in this way, tick a box (or two!) on the Career Advancement Tracker. This is the only time you may do so during Character Creation. » — `CRB 013 l.15`

**Niveau de carrière.** Chaque Carrière a quatre niveaux ; on commence au premier (`CRB 013 l.17-19`).

> « Every Career contains four levels — you begin at the first, and can advance through the other levels by spending XP (page 191) and acquiring Trappings. » — `CRB 013 l.19`

**Report sur la feuille** (`CRB 013 l.58-63`) : Classe et Carrière, les **3** Caractéristiques du premier niveau, les **10** Compétences du premier niveau cochées comme *Career Skills* (Compétences avancées ou groupées écrites à la main), *Status* et *Standing*.

> « Note which 3 Characteristics you can advance in the first level of your Career — these are the most important to your starting Career Skills » — `CRB 013 l.61`

> « Tick the boxes on your Character Sheet next to the 10 Skills listed in the first level of your Career — these are your Career Skills. » — `CRB 013 l.62`

> « Your Career's Status (Brass/Silver/Gold) and Standing (the number after Status) » — `CRB 013 l.63`

## RANDOM CLASS AND CAREER TABLE — table verbatim

Le livre ne nomme pas le dé de cette table ; ses plages vont de 01 à 100 (`CRB 013 l.25`, `CRB 013 l.101`). Un tiret « – » marque une Carrière que l'Espèce ne tire pas. Première partie (`CRB 013 l.21-56`) :

| Class     | Career       | Human | Dwarf | Halfling | High Elf | Wood Elf |
|-----------|--------------|-------|-------|----------|----------|----------|
|           | Apothecary   | 01    | 01    | 01       | 01–02    | –        |
|           | Engineer     | 02    | 02–04 | 02       | –        | –        |
|           | Lawyer       | 03    | 05–06 | 03–04    | 03–06    | –        |
|           | Nun          | 04-05 | –     | –        | –        | –        |
| ACADEMICS | Physician    | 06    | 07    | 05–06    | 07–08    | –        |
|           | Priest       | 07–11 | –     | –        | –        | –        |
|           | Scholar      | 12–13 | 08–09 | 07–08    | 09–12    | 01       |
|           | Wizard       | 14    | –     | –        | 13–16    | 02–05    |
|           | Agitator     | 15    | 10–11 | 09–10    | –        | –        |
|           | Artisan      | 16–17 | 12–17 | 11–15    | 17–19    | 06–10    |
|           | Beggar       | 18–19 | 18    | 16–19    | –        | –        |
|           | Investigator | 20    | 19–20 | 20–21    | 20–21    | –        |
| BURGHERS  | Merchant     | 21    | 21–24 | 22–25    | 22–26    | –        |
|           | Rat Catcher  | 22–23 | 25    | 26–28    | –        | –        |
|           | Townsman     | 24–26 | 26–31 | 29–31    | 27–28    | –        |
|           | Watchman     | 27    | 32–34 | 32–33    | 29       | –        |
|           | Adviser      | 28    | 35–36 | 34       | 30–31    | 11–14    |
|           | Artist       | 29    | 37    | 35–36    | 32       | 15–18    |
|           | Duellist     | 30    | 38    | –        | 33–34    | –        |
|           | Envoy        | 31    | 39–40 | 37       | 35–37    | 19–25    |
| COURTIERS | Noble        | 32    | 41    | –        | 38–40    | 26–31    |
|           | Servant      | 33–35 | 42    | 38–43    | –        | –        |
|           | Spy          | 36    | 43    | 44       | 41–43    | 32–35    |
|           | Warden       | 37    | 44–45 | 45–46    | 44–45    | –        |
|           | Bailiff      | 38    | 46–47 | 47       | –        | –        |
|           | Hedge Witch  | 39    | –     | –        | –        | –        |
|           | Herbalist    | 40    | –     | 48–50    | 46–47    | 36–42    |
|           | Hunter       | 41–42 | 48–49 | 51–52    | 48–50    | 43–52    |
| PEASANTS  | Miner        | 43    | 50–54 | 53       | –        | –        |
|           | Mystic       | 44    | –     | –        | –        | 53–57    |
|           | Scout        | 45    | 55    | 54       | 51–56    | 58–68    |
|           | Villager     | 46–50 | 56    | 55–57    | –        | –        |

Seconde partie (`CRB 013 l.65-103`) ; la rangée *Bounty Hunter* figure deux fois dans l'extraction, à `CRB 013 l.69` et `CRB 013 l.71`, et n'est reproduite qu'une fois :

| Class     | Career         | Human | Dwarf  | Halfling | High Elf | Wood Elf |
|-----------|----------------|-------|--------|----------|----------|----------|
|           | Bounty Hunter  | 51    | 57–60  | 58     | 57–59  | 69–70  |
| RANGERS   | Coachman       | 52    | 61     | 59-60  | –      | –      |
|           | Entertainer    | 53–54 | 62–63  | 61–63  | 60–62  | 71–75  |
|           | Flagellant     | 55–56 | –      | –      | –      | –      |
|           | Messenger      | 57    | 64–65  | 64–65  | 63     | 76–78  |
|           | Pedlar         | 58    | 66–67  | 66–67  | –      | –      |
|           | Roadwarden     | 59    | –      | 68     | –      | –      |
|           | Witch Hunter   | 60    | –      | –      | –      | –      |
|           | Boatman        | 61–62 | 68–69  | 69     | 64     | –      |
|           | Pilot          | 63    | 70     | 70     | –      | –      |
|           | Riverwarden    | 64–65 | –      | 71     | –      | –      |
|           | Riverwoman     | 66–68 | 71–72  | 72–74  | –      | –      |
| RIVERFOLK | Sailor         | 69–70 | 73     | 75     | 65–79  | –      |
|           | Smuggler       | 71    | 74–75  | 76–79  | 80     | –      |
|           | Stevedore      | 72–73 | 76–77  | 80–82  | –      | –      |
|           | Wrecker        | 74    | 78     | –      | –      | 79     |
|           | Charlatan      | 75    | –      | 83     | 81–83  | –      |
|           | Fence          | 76    | 79     | 84     | –      | –      |
|           | Grave Robber   | 77    | –      | 85     | –      | –      |
|           | Knave          | 78–79 | –      | 86–88  | 84–85  | –      |
| ROGUES    | Outlaw         | 80–83 | 80–82  | 89     | 86–88  | 80–85  |
|           | Racketeer      | 84    | 83     | 90     | –      | –      |
|           | Thief          | 85–87 | 84     | 91–94  | –      | –      |
|           | Witch          | 88    | –      | –      | –      | –      |
|           | Cavalryman     | 89–90 | –      | –      | 89–92  | 86–90  |
|           | Guard          | 91–92 | 85–87  | 95–96  | 93–94  | 91–92  |
|           | Knight         | 93    | –      | –      | 95     | 93–94  |
|           | Pit Fighter    | 94    | 88–90  | 97     | 96–97  | 95–96  |
| WARRIORS  | Protagonist    | 95    | 91–93  | –      | 98     | –      |
|           | Soldier        | 96–99 | 94–96  | 98–100 | 99–100 | 97–100 |
|           | Slayer         | –     | 97–100 | –      | –      | –      |
|           | Warrior Priest | 100   | –      | –      | –      | –      |

## 3. Caractéristiques — méthodes A, B, C

**A) Tirage dans l'ordre.** **2d10** pour chacune des dix Caractéristiques, dans l'ordre, ajoutés au modificateur d'Espèce de la *Characteristic Table* (`CRB 014 l.5`). En s'arrêtant là, les trois Caractéristiques marquées du premier niveau de carrière gagnent **jusqu'à six** points au total, répartis librement (`CRB 014 l.11`).

> « **A)** Roll **2d10** for each of the ten Characteristics in order and make a note of the results. If you are happy with these results, add each value to the appropriate Species modifier from the Characteristic Table, and record the totals on your Character Sheet. » — `CRB 014 l.5`

> « Increase the starting level of these Characteristics by up to six in total — so increasing one by six, all three by two each, or any combination you wish. » — `CRB 014 l.11`

Pour réarranger, aller en B ; pour retirer, aller en C (`CRB 014 l.13`).

**B) Réarrangement.** Les résultats de A s'assignent librement, modificateurs d'Espèce ajoutés ; les trois Caractéristiques du premier niveau gagnent **jusqu'à trois** points au total (`CRB 014 l.15`).

> « You may then increase the three Characteristics from your first Career Level by up to three in total, as above. » — `CRB 014 l.15`

**C) Nouveau tirage ou 100 points.** Dix nouveaux scores assignés comme en B, **ou** **100 points** répartis entre les dix Caractéristiques, **minimum 4, maximum 16** chacune, modificateurs d'Espèce ajoutés ; **aucune autre** augmentation de Caractéristique pendant la création (`CRB 014 l.17`).

> « **C)** Roll ten new Characteristic scores and assign them as in step B, or ignore the dice and distribute **100 points** between the ten Characteristics (minimum 4, maximum 16 in each). Add the appropriate Species modifiers and record the totals on your Character Sheet. You gain no other increases to your Characteristics during character creation. » — `CRB 014 l.17`

Repères du livre : 30 est la moyenne humaine, 40 un individu doué, 60 ou plus exceptionnel (`CRB 014 l.9`). Conseil de choix rapide : les plus hautes valeurs sur les trois Caractéristiques de carrière (`CRB 014 l.19`). En jeu, chaque Augmentation de Caractéristique ajoute +5 (`CRB 014 l.21`).

> « **Each Advance increases the associated Characteristic by +5**. » — `CRB 014 l.21`

**Bonus de Caractéristique** : le chiffre des dizaines (`CRB 014 l.23-27`).

> « The first or 'tens' digit of each Characteristic is its bonus value. » — `CRB 014 l.25`

> « *Strength (S) 39 equates to a Strength Bonus of 3. Willpower (WP) of 51 equals a Willpower Bonus of 5.* » — `CRB 014 l.27`

## CHARACTERISTIC TABLE — table verbatim

La table vit au chapitre des Compétences, pas à celui des Caractéristiques qui y renvoie (`CRB 014 l.5`). Table (`CRB 015 l.14-27`) ; l'ordre des colonnes est celui du livre (*Wood Elf* avant *High Elf*) :

|                      | Human   | Dwarf   | Halfling | Wood Elf | High Elf |
|----------------------|---------|---------|----------|----------|----------|
| Weapon Skill         | 2d10+20 | 2d10+30 | 2d10+10  | 2d10+30  | 2d10+30  |
| Ballistic Skill      | 2d10+20 | 2d10+20 | 2d10+30  | 2d10+30  | 2d10+30  |
| Strength             | 2d10+20 | 2d10+20 | 2d10+10  | 2d10+20  | 2d10+20  |
| Toughness            | 2d10+20 | 2d10+30 | 2d10+10  | 2d10+20  | 2d10+20  |
| Initiative           | 2d10+20 | 2d10+10 | 2d10+40  | 2d10+40  | 2d10+40  |
| Agility              | 2d10+20 | 2d10+10 | 2d10+20  | 2d10+30  | 2d10+30  |
| Dexterity            | 2d10+20 | 2d10+30 | 2d10+30  | 2d10+30  | 2d10+30  |
| Intelligence         | 2d10+20 | 2d10+20 | 2d10+20  | 2d10+30  | 2d10+30  |
| Willpower            | 2d10+20 | 2d10+40 | 2d10+30  | 2d10+30  | 2d10+30  |
| Fellowship           | 2d10+20 | 2d10+10 | 2d10+30  | 2d10+20  | 2d10+20  |

## 4. Compétences — Augmentations de départ

Une Compétence part de la valeur de sa Caractéristique ; chaque Augmentation ajoute +5 (`CRB 015 l.7`). Les Augmentations de départ viennent de l'Espèce et de la Carrière (`CRB 015 l.9-12`) : celles de l'Espèce, puis **8 Augmentations** réparties entre les *Career Skills* choisies à l'étape 2.

> « A Skill's starting value is equal to its associated Characteristic. Each Advance increases a Skill by +5. » — `CRB 015 l.7`

> « Assign **8 Advances** among the Career Skills you selected in step 2 (page 36). » — `CRB 015 l.12`

**Plafond.** Plusieurs Augmentations peuvent aller à la même Compétence, mais **aucune** n'en reçoit plus de **3 (+15)** pendant la création (`CRB 015 l.29`). Le livre ne dit pas si les six Augmentations de langue d'Espèce (« Take six Advances (+30) », `CRB 008 l.55`) sont soumises à ce plafond.

> « You may assign more than one Advance to the same Skill, but no Skill can receive more than **3 Advances (+15)** during Character Creation. » — `CRB 015 l.29`

La valeur finale = Caractéristique (avec ses Augmentations) + Augmentations de Compétence (`CRB 015 l.31-33`).

> « *Athletics is based on Agility (Ag). If your Ag is 37 after any Characteristic Advances, and you assign 2 Advances (+10) to Athletics, your final Athletics Skill is 47.* » — `CRB 015 l.33`

## Types de Compétences

Trois types (`CRB 015 l.35-41`) ; une Compétence absente de la feuille imprimée est avancée ou groupée et s'écrit à la main (`CRB 015 l.37`).

> « ***Basic Skills*** can be used by any Character, even without Advances in the Skill » — `CRB 015 l.39`

> « ***Advanced Skills*** can only be used by Characters with an Advance in the Skill » — `CRB 015 l.40`

> « ***Group Skills*** cover broad areas, and you choose a specialization when you gain Advances, for example Lore (Empire) or Lore (Tilea) » — `CRB 015 l.41`

## 5. Talent de carrière et dotations

**Talent.** Un Talent du **premier** niveau de la Carrière, au choix (`CRB 016 l.5`).

> « **Choose a Talent from the first level of your Career and add it to your Character Sheet.** » — `CRB 016 l.5`

**Trappings** (`CRB 016 l.7-11`) : tout personnage commence avec *Clothing*, *Dagger* et *Pouch* ; plus tous les *Trappings* du premier niveau de sa Carrière ; plus les *Trappings* de sa Classe (table ci-dessous). Un doublon se garde (`CRB 016 l.23`).

> « All Characters begin with Clothing, a Dagger, and a Pouch. » — `CRB 016 l.9`

> « You also begin play with all of the Trappings from your Career's first level. » — `CRB 016 l.10`

> « Finally, you start with some Trappings common to your Class, as shown in the Class Trappings table. » — `CRB 016 l.11`

> « If you end up with two of something, keep the spare! » — `CRB 016 l.23`

## CLASS TRAPPINGS — table verbatim

Table (`CRB 015 l.43-54`) ; les quatre colonnes vides de l'extraction sont omises :

| Class     | Trappings                                                         |
|-----------|-------------------------------------------------------------------|
| Academics | Sling Bag containing Writing Kit and 1d10 sheets of Parchment  |
| Burghers  | Cloak, Hat, Sling Bag containing Lunch                            |
| Courtiers | Fine Clothing, Tweezers, Ear Pick, and a Comb                     |
| Peasants  | Cloak, Sling Bag containing Rations (1 day)                       |
| Rangers   | Cloak, Backpack containing Tinderbox, Blanket, Rations (1 day) |
| Riverfolk | Cloak, Sling Bag containing a Flask of Spirits                    |
| Rogues    | Sling Bag containing 2 Candles, 1d10 Matches, a Hood or Mask   |
| Warriors  | Hand Weapon                                                       |

## STARTING WEALTH — table verbatim

La somme de départ dépend du *Status* (`CRB 016 l.13`). Table (`CRB 016 l.15-21`) :

| Status Tier | Wealth                                           |
|----------------|--------------------------------------------------|
| Brass          | 20 brass pennies plus 2d10 per Standing Level    |
| Silver         | 10 silver shillings plus 1d10 per Standing Level |
| Gold           | 2 gold crowns plus 1 per Standing Level          |

> « So, if you were Brass 3, you would start with 6d10+20 Brass pennies; if Silver 3, you would begin with 3d10+10 silver shillings, and if you were Gold 3, you would have 5 gold crowns. » — `CRB 016 l.25`

L'argent achète d'autres *Trappings* ou s'épargne ; prix et valeur des pièces sont au chapitre 11 (`CRB 016 l.27`).

## Blessures (Wounds)

> « Wounds = Strength Bonus (SB) + Willpower Bonus (WPB) + 2 × Toughness Bonus (TB) » — `CRB 016 l.33`

Le Talent *Hardy* ajoute de nouveau le Bonus d'Endurance (`CRB 016 l.35`).

> « So, if you have **3**4 Strength, **2**7 Willpower and **3**8 Toughness, your Wounds would be 3+2+3+3=11. If you have the Hardy Talent, add your Toughness Bonus again. » — `CRB 016 l.35`

Les Blessures sont la marge avant blessure grave (`CRB 016 l.31`).

## Mouvement (Movement)

La valeur de Mouvement vient de l'Espèce (`CRB 006 l.27`, voir ses sections). Elle donne la Marche et la Course : sur grille, en cases par Round ; sans grille, en pouces ; la Course double (`CRB 016 l.41`). Sur la durée, elle donne des miles par heure à pied (`CRB 016 l.45`).

> « When you Run, you double these distances. » — `CRB 016 l.41`

> « *A human with a Movement of 4 can walk 4 squares or run 8 squares per Round on a grid. If not using a grid, they can walk 4 inches or run 8 inches per Round.* » — `CRB 016 l.43`

> « Over the longer term it indicates how many miles per hour you can comfortably travel on foot. » — `CRB 016 l.45`

Table (`CRB 016 l.47-53`) :

| Movement | Walk (Yards) | Run (Yards) |
|----------|--------------|-------------|
| 3        | 6            | 12          |
| 4        | 8            | 16          |
| 5        | 10           | 20          |

> « Write your Movement total on your Character Sheet. » — `CRB 016 l.55`

## Encombrement maximal

> « Maximum Encumbrance = Strength Bonus (SB) + Toughness Bonus (TB) » — `CRB 016 l.61`

> « Dwarfs, and Characters with the Sturdy Talent, double this figure. » — `CRB 016 l.63`

Un objet porté (*worn*) compte 1 de moins ; règles détaillées et surcharge page 299 (`CRB 016 l.65`).

> « You must account for the Encumbrance of any items you routinely carry around with you, reducing the Encumbrance value of any worn items by 1. » — `CRB 016 l.65`

Le livre ne dit pas si un Nain ayant aussi *Sturdy* double deux fois.

## Oh Fickle Fate — +1 Fate

Accepter le premier résultat aléatoire pour l'Espèce, la Carrière **et** les Caractéristiques donne **+1 Fate** (`CRB 016 l.67-69`). Distinct du **+1 Fortune** du seul tirage d'Espèce (`CRB 006 l.7`).

> « If you chose to accept the first random result for each of your Species, Career, and Characteristics, increase your Fate by 1. » — `CRB 016 l.69`

Le livre ne dit pas quelle méthode de Caractéristiques (A, B ou C, `CRB 014 l.5-17`) vaut *first random result* (`CRB 016 l.69`).

## Créer un magicien ou un prêtre

Le livre parle d'une courte liste d'exigences minimales pour exercer sa magie dès le début de la carrière d'aventurier, puis d'un ensemble de départ *sensible* (`CRB 016 l.73-75`). Il note que c'est beaucoup à acquérir pour un personnage débutant (`CRB 016 l.82`).

> « If you are creating a Character who is a spellcaster or miracle worker of some sort, bear in mind that you will need to meet a short list of minimum requirements in order to work your magic from the start of your adventuring career. » — `CRB 016 l.73`

**Lanceur de sorts** (`CRB 016 l.75-80`) :

> « The *Second Sight* Talent, without which you may not perceive the Winds of Magic. » — `CRB 016 l.77`

> « At least one advance in the Language (Magick) Skill. » — `CRB 016 l.78`

> « At least one advance in the Channelling Skill, with a specialisation appropriate to the type of magic you wish to work with. » — `CRB 016 l.79`

> « The *Petty Magic* Talent, in order to begin learning spells to cast. » — `CRB 016 l.80`

> « This may be quite a lot to acquire as a starting character » — `CRB 016 l.82`

**Prêtre** capable de Bénédictions (`CRB 016 l.84-89`) :

> « The *Bless (Deity)* Talent, appropriate to the god you have chosen to worship. » — `CRB 016 l.86`

> « At least one advance in the Pray Skill. » — `CRB 016 l.87`

Les Miracles renvoient au chapitre 7 ; le livre ne liste ici aucun prérequis de Miracle (`CRB 016 l.89`).
