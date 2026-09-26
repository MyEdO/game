# Atlas RAW — Combat

> Base de connaissance des **règles WFRP4 (RAW)**, consolidées sur les livres autorisés, à usage d'agent
> (vérifier que le code respecte le RAW). Chaque règle cite sa source `LIVRE NN l.X-Y`
> (NN = préfixe du fichier de chapitre, l = lignes du `.md` source). **Voir aussi** tisse les renvois
> entre règles ; **Implémente** pointe le(s) module(s) `src/engine/` correspondant(s).
> Conventions d'abréviation : voir [`sources.md`](../sources.md).
>
> ⚠️ **Brouillon agent-généré** — fidélité contrôlée par une passe de vérification adversariale (voir
> § *Bilan de fidélité* en bas). Les entrées marquées y restent à corriger.
> ⚠️ Les champs **Implémente** sont GÉNÉRÉS (`npm run raw:implemente` — source éditoriale : `src/data/raw.manifest.json`) — ne pas les éditer à la main.

## Sommaire

- [Structure du Round et ordre d'Initiative](#structure-du-round-et-ordre-dinitiative)
- [Surprise](#surprise)
- [Action, Mouvement et options du Tour](#action-mouvement-et-options-du-tour)
- [Résolution d'une attaque : les 4 étapes](#résolution-dune-attaque--les-4-étapes)
- [Tableau de Localisation humanoïde](#tableau-de-localisation-humanoïde)
- [Critiques et Frappe Mortelle](#critiques-et-frappe-mortelle)
- [Maladresses, Oups ! et Incident de Tir](#maladresses-oups--et-incident-de-tir)
- [Combat à Distance : restrictions et règles de tir](#combat-à-distance--restrictions-et-règles-de-tir)
- [Difficultés de combat, Taille et Supériorité numérique](#difficultés-de-combat-taille-et-supériorité-numérique)
- [Deux armes, Dispersion et Mains nues](#deux-armes-dispersion-et-mains-nues)
- [Empoignade](#empoignade)
- [Combat Monté (règles de base)](#combat-monté-règles-de-base)
- [Avantage : gain, bénéfices et perte](#avantage--gain-bénéfices-et-perte)
- [Déplacement en combat : Marche, Course, Charge, grille](#déplacement-en-combat--marche-course-charge-grille)
- [Désengagement et Fuite](#désengagement-et-fuite)
- [Escalade, Saut et Chute](#escalade-saut-et-chute)
- [Poursuite (procédure de base)](#poursuite-procédure-de-base)
- [Encombrement et Surcharge](#encombrement-et-surcharge)
- [Armes de corps à corps (LDB) : groupes et tables](#armes-de-corps-à-corps-ldb--groupes-et-tables)
- [Armes à distance et munitions (LDB) : groupes et tables](#armes-à-distance-et-munitions-ldb--groupes-et-tables)
- [Portée, Allonge et dégradation des armes](#portée-allonge-et-dégradation-des-armes)
- [Atouts et Défauts d'arme](#atouts-et-défauts-darme)
- [Armures : table, PA, dégâts et réparation](#armures--table-pa-dégâts-et-réparation)
- [Localisation des créatures non humaines](#localisation-des-créatures-non-humaines)
- [Schéma de profil et Traits standard de créature](#schéma-de-profil-et-traits-standard-de-créature)
- [Traits d'attaque naturelle des créatures](#traits-dattaque-naturelle-des-créatures)
- [Souffle et attaques de zone des créatures](#souffle-et-attaques-de-zone-des-créatures)
- [Traits de défense et de résilience des créatures](#traits-de-défense-et-de-résilience-des-créatures)
- [Traits de comportement et de psychologie des créatures](#traits-de-comportement-et-de-psychologie-des-créatures)
- [Traits de mouvement et modificateurs d'attributs des créatures](#traits-de-mouvement-et-modificateurs-dattributs-des-créatures)
- [Taille : catégories et modificateurs de combat](#taille--catégories-et-modificateurs-de-combat)
- [Trait Nuée](#trait-nuée)
- [AA : système alternatif de Blessures et Critiques](#aa--système-alternatif-de-blessures-et-critiques)
- [AA : État Hémorragique et nouveaux Atouts/Défauts](#aa--état-hémorragique-et-nouveaux-atoutsdéfauts)
- [AA : armes de mêlée — tables et règles spéciales](#aa--armes-de-mêlée--tables-et-règles-spéciales)
- [AA : armes à poudre à canon et munitions — tables](#aa--armes-à-poudre-à-canon-et-munitions--tables)
- [AA : Combat Monté étendu et dressage](#aa--combat-monté-étendu-et-dressage)
- [AA : Structures et armes de Siège](#aa--structures-et-armes-de-siège)
- [AA : Rompre le combat et Poursuites détaillées](#aa--rompre-le-combat-et-poursuites-détaillées)
- [AA : système d'Avantage de Groupe](#aa--système-davantage-de-groupe)
- [AA : Talents de combat](#aa--talents-de-combat)
- [AA : Activités guerrières](#aa--activités-guerrières)
- [AA : Miracles martiaux (Myrmidia)](#aa--miracles-martiaux-myrmidia)
- [ADE II : combat de masse (Puissance de Bataille) et machines de guerre](#ade-ii--combat-de-masse-puissance-de-bataille-et-machines-de-guerre)
- [Armes et armures des ogres (ADE II)](#armes-et-armures-des-ogres-ade-ii)

- **La Mer des Griffes (MDG)** <!-- MDG-INTEGRATION -->
- MDG : combat naval — Endurance, Blessures et Localisation des Dégâts d'un navire
- MDG : Coups Critiques sur un navire (Voie d'eau, Éclats, incendies)
- MDG : Collisions, Indice de Collision et béliers
- MDG : Artillerie navale — pièces, portées, recharge et munitions
- MDG : nouveaux Atouts et Défauts d'arme (Arme d'équipe, Tir de zone)

---

## Structure du Round et ordre d'Initiative

En Combat, le temps est découpé pour gérer le timing des actions opposées. Trois unités structurent ce découpage (`LDB 13 l.11-15`) :

- **Round** : le temps nécessaire pour qu'un Personnage effectue un Test et se mette en place — en général « quelques secondes », mais c'est le MJ qui décide de la durée réelle si nécessaire.
- **Tour** : au cours d'un Round, **chaque combattant a un tour** pour effectuer **une Action et un Mouvement**.
- **Ordre d'Initiative** : chaque combattant joue son tour dans l'ordre de sa Caractéristique d'**Initiative**, de la plus élevée à la plus basse.

### Déroulement d'un Round (résumé d'un combat)

Un combat enchaîne les étapes suivantes, jusqu'à ce qu'un des deux groupes fuie ou soit vaincu (`LDB 13 l.19-29`) :

| Étape | Nom | Ce qui s'y passe |
|---|---|---|
| **1** | **Déterminer la Surprise** | Le MJ décide si certains Personnages sont _surpris_. Cela ne se produit normalement qu'**au premier Round** de combat. |
| **2** | **Début du Round** | Si une règle indique que quelque chose se produit _au début du Round_, c'est durant cette étape. |
| **3** | **Les Personnages effectuent leur tour** | Chaque combattant joue un tour en respectant l'ordre d'Initiative, **en commençant par la valeur la plus élevée**. Chaque Personnage peut en principe effectuer **un Mouvement et une Action** pendant son tour. |
| **4** | **Fin du Round** | Le Round s'achève lorsque **tous** les combattants ont joué leur tour. Si une règle indique que quelque chose se produit à la fin du Round, c'est durant cette étape. |
| **5** | **Répéter les Étapes 2 à 5** | Enchaîner les Rounds jusqu'à ce que le combat soit terminé. |

Le tableau ci-dessus est `LDB 13 l.21-29` transcrit pas à pas (la numérotation et les libellés sont ceux du livre ; l'étape 5 renvoie bien aux étapes 2 à 5).

### Ordre d'Initiative (méthode statique, par défaut)

Les combattants agissent dans un ordre d'Initiative bien précis : **celui qui a la valeur la plus forte agit en premier**, et ainsi de suite jusqu'à ce que tous les impliqués aient joué leur tour (`LDB 13 l.50`).

**Départage des égalités** (`LDB 13 l.31`), dans l'ordre :

1. **Initiative égale** → c'est le combattant avec l'**Agilité** la plus haute qui joue en premier.
2. **Agilité encore égale** → effectuer un **Test opposé d'Agilité** ; le vainqueur joue en premier.

Certains Talents ont un impact sur l'ordre de combat (renvoi au Chapitre 4 : Compétences et Talents).

**Exemple canon** (`LDB 13 l.33`) : Tollich (Initiative 38) agit toujours avant Perdita (Initiative 33). Face à des cultistes d'Initiative 35, l'ordre est : **Tollich (38) → cultistes (35) → Perdita (33)**.

> « Si plusieurs combattants ont la même Initiative, c'est celui qui a la valeur d'Agilité la plus haute qui joue en premier, et ainsi de suite. S'il y a encore égalité, demandez un Test opposé d'**Agilité**. » — `LDB 13 l.31`

### Variantes de tirage aléatoire de l'Initiative

Certains groupes préfèrent **déterminer l'Initiative au hasard**. On choisit **une seule** des méthodes suivantes (`LDB 13 l.37-42`) :

| Méthode | Calcul |
|---|---|
| Test d'Initiative | Chaque Personnage effectue un **Test d'Initiative** afin d'obtenir un **DR** (Degré de Réussite). |
| 1d10 + Initiative | Chaque Joueur lance **1d10 et l'ajoute à son Initiative**. |
| 1d10 + BAg + BInit | Chaque Joueur lance **1d10 et l'ajoute à son Bonus d'Agilité + Bonus d'Initiative**. |

Tableau transcrit verbatim de `LDB 13 l.39-42` (les trois puces du livre, sans réduction).

Le MJ note ces résultats **par ordre décroissant** et les utilise pour définir l'ordre d'Initiative. Deux usages possibles (`LDB 13 l.43`) :

- **Réutiliser le même ordre à chaque Round** — l'option la plus rapide.
- **Relancer à chaque Round** — apporte plus de diversité ; les Personnages les plus lents ne sont alors **pas toujours** les derniers.

### Rounds en dehors du combat

Hors Combat, la mesure du temps des actions est **bien plus flexible**. Mais il est parfois utile d'employer quand même les Rounds pour organiser la contribution de chacun. Exemple type : les **Tests étendus** se déroulent sur plusieurs Rounds, **avec un Test effectué à chaque Round** (`LDB 13 l.46-47`, renvoi aux Tests étendus, p.154).

**Sources RAW** :
- `LDB 13 l.11-15` — définitions des trois unités de temps : Round (durée à la discrétion du MJ), Tour (une Action + un Mouvement par combattant), Ordre d'Initiative (de la plus haute à la plus basse).
- `LDB 13 l.19-29` — les 5 étapes du Round (Surprise → Début du Round → Tours par Initiative → Fin du Round → Répéter), avec « jusqu'à ce que l'un des groupes fuie ou soit vaincu » et « la Surprise ne se produit normalement qu'au premier Round ».
- `LDB 13 l.25` — chaque Personnage peut « en principe effectuer un Mouvement et une Action pendant son tour ».
- `LDB 13 l.31` — départage des Initiatives égales : Agilité la plus haute, puis Test opposé d'Agilité ; les Talents peuvent modifier l'ordre.
- `LDB 13 l.33` — exemple Tollich/Perdita/cultistes (38 / 35 / 33).
- `LDB 13 l.50` — re-formulation de l'ordre statique (valeur la plus forte en premier) ; astuce de table (s'asseoir dans l'ordre d'Initiative).
- `LDB 13 l.37-42` — les trois méthodes de détermination aléatoire (Test d'Initiative → DR ; 1d10 + Initiative ; 1d10 + BAg + BInit).
- `LDB 13 l.43` — usage des résultats par ordre décroissant ; choix « même ordre chaque Round » (rapide) vs « relancer chaque Round » (diversité).
- `LDB 13 l.46-47` — Rounds hors combat : temps flexible, mais utiles pour les Tests étendus (un Test par Round).

> « Un Round correspond au temps nécessaire pour que les Personnages puissent effectuer un Test et se mettre en place. En général, un Round correspond à quelques secondes, mais c'est le MJ qui décide, si nécessaire, du temps qu'il représente. » — `LDB 13 l.13`

> « Vous pouvez alors utiliser cet ordre pour chaque Round (option la plus rapide), ou effectuer un lancer pour chaque Round (ce qui apporte plus de diversité ; les Personnages les plus lents ont alors la possibilité de ne pas être **toujours** les derniers). » — `LDB 13 l.43`

**Voir aussi** : Surprise et État Surpris ; Effectuer votre Tour (Action + Mouvement) ; Tests et Degrés de Réussite (DR) ; Tests opposés ; Tests étendus ; Talents affectant l'ordre de combat (Combat instinctif).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 13` (l.11-15, l.19-29, l.31, l.33, l.37-42, l.43, l.46-47, l.50) → `CombatStartSplash`, `initiativeTitle`, `rollInitiative`, `secondsPerRound`, `resolveSpell`, `pickDoctrine`, `ambush-surprise`, `combat-init-method`, `combat-init-reroll`, `applySurprise`, +6 — `src/data/combat-stakes.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs-scenes/scene.ts`, `src/engine/combat.ts`, `src/engine/suffocation.ts`, +8 fichiers

---

## Surprise

La **Surprise** représente le fait de prendre un adversaire au dépourvu au tout début d'un combat : elle confère « un énorme avantage » au camp embusqué. Le MJ décide, à l'**étape 1 du Résumé d'un Combat** (« Déterminer la Surprise »), si certains Personnages sont *surpris*. **Cela ne se produit normalement que lors du premier Round de combat** (`LDB 13 l.21`).

### Conditions qui peuvent accorder la Surprise (LDB 13 l.51-59)

Si l'un des deux camps prépare une attaque, il peut tenter d'exploiter les éléments de surprise par l'un des moyens suivants :

- **Se cacher** : réussir un Test de **Discrétion** afin de trouver un abri. Les Personnages visés peuvent faire un **Test opposé de Perception** s'ils sont sur leurs gardes, ou si le MJ est d'humeur généreuse.
- **Tactiques furtives** : attaquer par derrière, dans le noir, sous couvert d'un épais brouillard, ou d'en haut. Le MJ peut, le cas échéant, accorder un **Test de Perception** pour repérer les éventuels attaquants.
- **Distractions** : de fortes détonations, une rixe ou un sermon captivant — quelques exemples de distractions qui peuvent donner un avantage lors d'une attaque-surprise.
- **Défenseurs pris au dépourvu** : si l'ennemi n'est **pas du tout méfiant**, les attaquants le surprennent **automatiquement**.
- **Autres** : tout autre moyen ingénieux et sournois — **c'est le MJ qui a le dernier mot** quant à la possibilité de la surprise.

### Test pour repérer l'embuscade (LDB 13 l.67-69)

S'il y a une chance que ceux qui tendent l'embuscade soient repérés, le MJ demande un **Test opposé de Discrétion/Perception**, « le plus souvent entre le Personnage ayant la Discrétion la plus faible et tous les guetteurs potentiels ». Si c'est le **groupe en embuscade** qui remporte le Test, **chaque Personnage vaincu subit l'État *Surpris*** (renvoi p. 169). Si personne n'est surpris, le combat se déroule normalement.

### Talents qui évitent la Surprise (LDB 13 l.62-65)

Même quand le MJ déclare qu'il n'y a **aucune chance** de repérer les protagonistes en embuscade, **certains Talents permettent d'éviter la Surprise** (cf. Chapitre 4). L'exemple canon cite le Talent **Vigilance**, qui autorise un **Test de Perception Intermédiaire (+0)** pour éviter d'être surpris : un Personnage doté de Vigilance réussit ce Test = il agit normalement au premier Round tandis que ses compagnons non protégés subissent *Surpris*.

### Se débarrasser de la Surprise par la Détermination

Si un Personnage est surpris, il peut **dépenser 1 Point de Détermination pour se débarrasser de l'État *Surpris*** (`LDB 13 l.71`). C'est l'application de l'option générique « **Retirer un État** » de la dépense de Détermination (`LDB 17 l.61`) : *Vous pouvez dépenser un Point de Détermination pour … Retirez un État.*

### Effet mécanique de l'État *Surpris* (LDB 16 l.131-139)

L'État *Surpris* signifie : « Vous avez été pris au dépourvu et vous n'êtes absolument pas prêt à réagir. » Concrètement, tant que vous subissez l'État *Surpris* :

| Effet | Détail |
|---|---|
| Tour bloqué | Vous **ne pouvez effectuer ni votre Mouvement ni votre Action** pendant ce tour. |
| Pas de défense | Vous **ne pouvez pas vous défendre lors de Tests opposés** (l'attaquant résout son attaque seul, sans Parade ni Esquive). |
| Bonus à l'attaquant | Tout adversaire qui tente de vous frapper en **Combat au Corps à corps gagne +20 à la CC**. |
| Non-cumul | L'État *Surpris* **ne se cumule pas** — vous ne pouvez pas en subir plusieurs, même si techniquement vous pouvez être surpris plus d'une fois dans un même Round. |
| Disparition | Vous perdez l'État *Surpris* **à la fin de chaque Round, OU après la première tentative effectuée pour vous toucher** (le premier des deux). |

### Cas particuliers (suppléments)

- **Embuscade de gamins des rues** (NADJ, « Une journée au tribunal ») : trois attaques sont portées **pendant le même Round** avec les **bonus de supériorité numérique**, les orphelins frappant à **CC 20**. À moins que la cible n'ait un **Talent approprié pour éviter la surprise**, repérer que des couteaux de fortune sont dégainés dans la bousculade exige un **Test de Perception Très difficile (-30)** ; **si ce Test est raté, la cible reçoit l'État *Surpris***.
- **Personnage réveillé en sursaut** (NADJ, « Une nuit agitée aux Trois Plumes ») : un Personnage endormi peut tenter un **Test de Perception Très difficile (-30)** pour se réveiller en sursaut — **réussite = réveil avec l'État *Fatigué***. On lui donne en outre les États ***Inconscient*** et ***À terre*** **pour le Round 1**, et un État ***Surpris*** **pour le Round où il se réveille**.

**Sources RAW** :
- `LDB 13 l.21` — étape 1 du combat « Déterminer la Surprise » : le MJ décide qui est surpris, normalement au seul premier Round.
- `LDB 13 l.48-59` — sources de surprise : Se cacher (Discrétion vs Perception), Tactiques furtives (derrière/noir/brouillard/au-dessus), Distractions, Défenseurs pris au dépourvu (surprise automatique), Autres (MJ a le dernier mot).
- `LDB 13 l.62-65` — certains Talents (ex. Vigilance, Test de Perception +0) permettent d'éviter la Surprise même sans chance de repérage.
- `LDB 13 l.67-69` — Test opposé Discrétion/Perception (la Discrétion la plus faible vs tous les guetteurs) ; chaque vaincu côté défenseur subit *Surpris* ; sinon combat normal.
- `LDB 13 l.71` — un Personnage surpris peut dépenser 1 Point de Détermination pour retirer l'État *Surpris*.
- `LDB 16 l.131-139` — État *Surpris* : ni Mouvement ni Action, pas de défense en Test opposé, +20 CC à l'attaquant en mêlée, non-cumul, retiré en fin de Round ou après la première tentative pour vous toucher.
- `LDB 17 l.61` — option générique « Retirez un État » de la dépense de Détermination.
- `NADJ 06 l.148` — embuscade des gamins : 3 attaques le même Round + supériorité numérique, CC 20, Perception Très difficile (-30) sinon État *Surpris* (sauf Talent approprié).
- `NADJ 05 l.117` — réveil en sursaut : Perception Très difficile (-30) → réveil Fatigué ; États *Inconscient* + *À terre* au Round 1 et *Surpris* au Round du réveil.

> « Tout adversaire qui tente de vous frapper en Combat au Corps à corps gagne +20 à la CC. » — `LDB 16 l.135`

> « À la fin de chaque Round, ou après la première tentative effectuée pour vous toucher, vous perdez l'État *Surpris*. » — `LDB 16 l.139`

> « Si ce Test est raté, la cible reçoit un État *Surpris*. » — `NADJ 06 l.148`

**Voir aussi** : États (Surpris, À terre, Inconscient, Fatigué), Détermination et Résilience, Tests opposés, Initiative et déroulement d'un Round, Perception / Discrétion, Talent Vigilance.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 13` (l.21, l.48-59, l.62-65, l.67-69, l.71) → `CombatStartSplash`, `initiativeTitle`, `rollInitiative`, `secondsPerRound`, `ExecCtx`, `resolveSpell`, `triggeredTestStepId`, `opposedAttackerFreeze`, `pickDoctrine`, `ambush-surprise`, +14 — `src/data/combat-stakes.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs-scenes/scene.ts`, `src/engine/combat.ts`, `src/engine/suffocation.ts`, +12 fichiers
- `LDB 16` (l.131-139) → `STABLE_COND_KINDS`, `buildExposureBand`, `DOCTRINES`, `applyIncomingMeleeAdvantage`, `combat-helpless-mode`, `pickDoctrine`, `chooseEnemyAction`, `hemorragique`, `inconscient`, `sonne`, +11 — `src/data/etats.json`, `src/data/reglesOptionnelles.json`, `src/engine/conditions.ts`, `src/state/ai.ts`, `src/state/combat/flowEval.ts`, `src/state/combatFlow.ts`, +2 fichiers
- `LDB 17` (l.61) → `ResilienceButton`, `RenounceModal`, `DeterminationButton`, `CritLocationPicker`, `hasMeaningfulOption`, `sourceSuspended`, `CorruptionModal`, `ForcedRollPicker`, `suspendSource`, `forceCrewRole`, +96 — `src/data/characteristics.json`, `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/etats.ts`, `src/engine/combat.ts`, +50 fichiers
- sans code : `NADJ 5` (l.117), `NADJ 6` (l.148)

---

## Action, Mouvement et options du Tour

Lorsqu'un combat débute, le temps se découpe en **Rounds**, eux-mêmes subdivisés en **Tours** : « Au cours d'un Round, chaque combattant a un tour pour effectuer une Action et un Mouvement. » Chaque combattant joue son tour dans l'**ordre d'Initiative**, de la valeur la plus élevée à la plus basse (`LDB 13 l.14-15`). Ce topic décrit ce qu'un combattant peut faire pendant *son* tour : son Mouvement, son Action, les Actions Gratuites, l'option « Sur la Défensive », et la difficulté supposée par défaut.

### Une Action et un Mouvement, dans l'ordre voulu

À votre tour, vous effectuez **un Mouvement et une Action**. Vous **choisissez l'ordre** dans lequel vous les réalisez — « il est probable que vous effectuiez les deux à peu près en même temps et vous pouvez sans souci décrire l'ensemble comme une seule manœuvre combinée. » Vous pouvez aussi **renoncer** à votre Action ou à votre Mouvement, « tout en sachant que vous n'aurez pas de nouvelle opportunité avant le prochain Round ! » (`LDB 13 l.79-86`).

- **Action** : vous pouvez entreprendre n'importe quelle Action concevable, « limité seulement par la durée du Round de combat, les contraintes physiques du lieu du combat et les capacités de votre Personnage. » Certaines Actions se produisent dès leur description (crier un avertissement, monter un escalier) **sans Test** ; d'autres (attaquer, déplacement acrobatique) **nécessitent un Test** dont le MJ choisit la Compétence (`LDB 13 l.93-98`).
- **Mouvement** : la caractéristique de **Mouvement (M)** sert de référence à la distance couverte ; le MJ indique si un déplacement demande plus d'un tour. Les déplacements compliqués (saut, escalade) **utilisent aussi votre Action** dès qu'un Test est requis pour atteindre la destination (Test d'**Escalade** ou d'**Athlétisme**) (`LDB 13 l.86-88`).

### Mouvement en combat (Marche / Course)

Le Tableau du Mouvement « indique la distance, en mètres, que vous pouvez parcourir au cours d'un tour, **sans avoir à effectuer un Test d'Athlétisme**. Ainsi, vous utiliserez votre Mouvement du Tour. » L'échelle recommandée pour une grille est de **2 mètres par case** (3 cm = 2 m) ; un Mouvement 4 permet donc de parcourir 4 cases / 8 mètres en Marche (`LDB 15 l.12-16`).

| Mouvement (M) | Marche (mètres) | Course (mètres) |
|---|---|---|
| 0 | 0 | 0 |
| 1 | 2 | 4 |
| 2 | 4 | 8 |
| 3 | 6 | 12 |
| 4 | 8 | 16 |
| 5 | 10 | 20 |
| 6 | 12 | 24 |
| 7 | 14 | 28 |
| 8 | 16 | 32 |
| 9 | 18 | 36 |
| 10 | 20 | 40 |

— `LDB 15 l.18-31` (« Tableau des Mouvements »)

La **Marche** est gratuite (le Mouvement du tour, sans Test). La **Course** utilise l'**Action** : Test d'**Athlétisme Accessible (+20)**, la distance courue venant *en plus* du Mouvement déjà parcouru ce Round, soit **Mouvement de Course + DR mètres** (ex. M4, DR −2 → 14 m supplémentaires) (`LDB 15 l.39-41`).

#### Charge

Si vous n'êtes pas déjà en train de vous battre (non *Engagé*), vous pouvez utiliser votre Mouvement pour **Charger** en combat rapproché ; vous gagnez **+1 Avantage** et vous retrouvez *Engagé* (`LDB 13 l.90`). Une Charge consomme tout le Mouvement et **impose que l'Action soit un Test de Corps à corps** pour attaquer. Le **+1 Avantage** n'est acquis que si l'adversaire se trouve **à au moins une distance (en mètres) égale à votre Mouvement** avant la charge, tout en restant dans la portée de votre Course (`LDB 15 l.35-37`).

#### Désengagement

Si vous êtes *Engagé* et ne souhaitez plus échanger de coups, deux options pour partir « en toute sécurité » :
- **Utiliser l'Avantage** : si vous avez **plus d'Avantages que votre adversaire**, ramenez votre Avantage à 0 pour vous éloigner sans pénalité (puis Charger une autre cible, courir, ou tirer un coup de feu) (`LDB 15 l.47`).
- **Utiliser l'Esquive** : si votre Avantage est **inférieur ou égal** à celui de l'adversaire et que vous ne voulez pas le dépenser, vous êtes cloué sur place. Pour fuir, dépensez votre **Action** en Test opposé d'**Esquive / Corps à corps**. Sur un succès, +1 Avantage et vous bougez normalement ; sur un échec, l'adversaire gagne +1 Avantage et votre fuite échoue « à moins de vous prendre un coup dans le dos » (`LDB 15 l.49-53`).

### Actions Gratuites

Certains actes ne comptent **pas** comme votre Action du Round — « dégainer votre arme ou boire une potion, par exemple. » **C'est le MJ qui décide** de ce qui coûte une Action et de ce qui est gratuit. Règle générale : « si un acte nécessite un Test, c'est que c'est une Action plutôt qu'une Action gratuite. » Être *Engagé* peut **interdire** une Action gratuite « qui nécessite une certaine concentration ou qui pourrait octroyer un bonus à l'ennemi qui vous attaque » (`LDB 13 l.106-107`).

### Option : Sur la Défensive

Pour votre **Action**, vous pouvez vous mettre **Sur la Défensive** : choisissez une **Compétence défensive** (parer, esquiver, tenir une position, ou *Langue (Magick)* pour une salve de dissipations). Vous gagnez alors **+20 à tous les Tests de défense** que vous effectuez **jusqu'au début de votre prochain Tour** (`LDB 13 l.108-110`).

> « Pour votre Action, choisissez une Compétence que vous allez utiliser en défense et vous gagnerez un bonus de +20 à tous les Tests de défense que vous effectuerez jusqu'au début du prochain Tour. » — `LDB 13 l.110`

### Difficulté par défaut en combat

« Lors d'un Combat, les Difficultés sont supposées être au niveau **Intermédiaire (+0).** Donc, si rien n'est précisé, utilisez Intermédiaire » (`LDB 13 l.118-119`).

> « Lors d'un Combat, les Difficultés sont supposées être au niveau Intermédiaire (+0). » — `LDB 13 l.118`

### Notes liées (résolution dans d'autres topics)

- **Engagé** : on est *Engagé* dès qu'on attaque ou qu'on est attaqué au Corps à corps ; on cesse de l'être après un Round complet sans attaquer (`LDB 13 l.170-171`).
- **Avantage** : la Charge n'est qu'une des sources d'Avantage (Surprise, Évaluer, gagner un Test opposé, etc.) ; chaque pion d'Avantage donne **+10** à un Test de Combat/Psychologie approprié (`LDB 14 l.205+215`).

**Sources RAW** :
- `LDB 13 l.14` — un Tour par combattant et par Round = **une Action + un Mouvement** ; ordre par Initiative décroissante (`LDB 13 l.15`).
- `LDB 13 l.74-81` — Effectuer son Tour : Mouvement + Action dans **l'ordre voulu** (manœuvre combinée), droit de **renoncer** à l'un ou l'autre.
- `LDB 13 l.86-88` — **Mouvement** : la carac M comme référence ; déplacement compliqué (saut/escalade) consomme **aussi l'Action** si un Test est requis.
- `LDB 13 l.90` — Mouvement pour **Charger** (non encore Engagé) : **+1 Avantage** et devenir *Engagé* ; renvoi au détail page 164 (LDB 15).
- `LDB 13 l.93-98` — **Actions** : n'importe quelle action concevable ; certaines sans Test, d'autres avec Test (Compétence choisie par le MJ).
- `LDB 13 l.105-106` — **Actions Gratuites** : dégainer / boire une potion ; arbitrées par le MJ ; « si Test requis → Action » ; *Engagé* peut les interdire.
- `LDB 13 l.108-110` — **Option Sur la Défensive** : Action = choisir une Compétence défensive → **+20 à tous les Tests de défense jusqu'au début du prochain Tour**.
- `LDB 13 l.117-118` — **Difficulté par défaut** en combat = **Intermédiaire (+0)** si rien n'est précisé.
- `LDB 15 l.12-16` — échelle de grille (2 m / case) ; le Tableau du Mouvement = distance d'un tour **sans Test d'Athlétisme**.
- `LDB 15 l.18-31` — **Tableau des Mouvements** verbatim (M 0→10, Marche, Course).
- `LDB 15 l.35-41` — **Charge** (Action = Test de Corps à corps ; +1 Avantage si l'adversaire est à ≥ M mètres) et **Course** (Action, Athlétisme Accessible +20, Mouvement de Course + DR).
- `LDB 15 l.45-49` — **Désengagement** : par l'Avantage (ramené à 0) ou par Test opposé d'Esquive/Corps à corps (Action).

**Voir aussi** : Structure d'un Round et Initiative ; Surprise et État Surpris ; Attaquer (toucher, localisation, dégâts) ; Avantage en combat ; Déplacement détaillé (Saut, Escalade, Fuite, Poursuite) ; Engagé et Corps à corps.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 13` (l.14-15, l.74-88, l.90, l.93-98, l.105-107, l.108-110, l.117-119, l.170-171) → `localisation`, `CombatStartSplash`, `ClimbPlan`, `useDefenseJetProps`, `AuContactModal`, `GrappleModal`, `engage`, `secondsPerRound`, `useHoverTargeting`, `markAttacked`, +57 — `src/data/actions.json`, `src/data/combat-stakes.json`, `src/data/localisation.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs-scenes/scene.ts`, +32 fichiers
- `LDB 14` (l.205-215) → `advantageCap`, `advantageCapFor`, `gainAdvantage`, `ADVANTAGE_COLLARS`, `doc`, `TavernGame`, `combat-advantage-cap`, `combat-advantage-cap-bi`, `avantage`, `avantageSurLaCible`, +4 — `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/tavernGames.ts`, `src/engine/advantage.ts`, `src/engine/combat.ts`, `src/engine/conditions.ts`, +4 fichiers
- `LDB 15` (l.12-16, l.18-31, l.35-41, l.45-53) → `METRES_PER_LEVEL`, `ClimbPlan`, `RunModal`, `reachTiles`, `hasMeaningfulOption`, `resolveRun`, `DisengageModal`, `planClimb`, `charge`, `occupied`, +65 — `src/data/actions.json`, `src/data/combat-stakes.json`, `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/regles.json`, `src/data/schemas/defs-scenes/scene.ts`, +33 fichiers

---

## Résolution d'une attaque : les 4 étapes

Attaquer est l'une des Actions les plus fréquentes en combat. **Pour une attaque à distance**, l'arme doit être à la bonne portée et la cible dans la Ligne de Vue. **Pour une attaque de Corps à corps**, il faut pouvoir charger ou être déjà *Engagé* avec la cible, une arme prête en main (`LDB 13 l.113-114`). En l'absence d'indication contraire, toute Difficulté de Combat est supposée **Intermédiaire (+0)** (`LDB 13 l.117-118`).

La résolution se fait en **quatre étapes**.

### Étape 1 — Lancer pour Toucher

**Corps à corps** : effectuez un **Test opposé de Corps à corps** contre l'adversaire — les deux combattants utilisent leur Compétence Corps à corps. Celui qui obtient le **DR le plus élevé** l'emporte. Si vous remportez le Test, vous touchez et gagnez **+1 Avantage** ; si vous perdez le Test opposé, votre adversaire gagne **+1 Avantage** et votre Action est terminée (`LDB 13 l.122-123`).

**Distance** : effectuez un **Test de Projectiles** (simple, non opposé) pour l'arme employée. Sur un succès, vous touchez et gagnez **+1 Avantage** ; sur un échec, votre Action prend fin. **Le défenseur ne gagne aucun Avantage** lors d'un Combat à Distance (`LDB 13 l.125`).

Dans les deux cas, le Test peut produire un **Critique** (tout succès dont le jet est un double) ou une **Maladresse** (tout échec dont le jet est un double). Un Critique inflige immédiatement une Blessure critique (`LDB 13 l.127`, `l.183-184` ; `LDB 13 l.4` du segment p.162).

> « pour attaquer, effectuez un Test opposé de **Corps à corps** avec votre adversaire […] Celui qui obtient le DR le plus élevé l'emporte. Si vous remportez le Test, vous touchez votre adversaire et gagnez +1 Avantage. » — `LDB 13 l.123`

> « effectuez un Test de **Projectiles** pour l'arme que vous utilisez. Sur un succès, vous touchez votre adversaire et gagnez +1 Avantage. […] Le défenseur ne gagne aucun Avantage pendant un Combat à Distance. » — `LDB 13 l.125`

### Étape 2 — Déterminer la Localisation

Si l'attaque porte, **inversez le jet du toucher** et comparez le nombre obtenu au **Tableau de Localisation**. Exemple du livre : un jet de **23** au toucher devient **32**, soit le **Bras droit** (`LDB 13 l.132-133`). Les créatures à la forme de corps différente et les adversaires montés utilisent d'autres Tableaux de Localisation (Bestiaire, `LDB 13 l.135`).

| Lancer (inversé) | Zone touchée |
|---|---|
| 01-09 | Tête |
| 10-24 | Bras gauche (ou bras secondaire) |
| 25-44 | Bras droit (ou bras principal) |
| 45-79 | Corps |
| 80-89 | Jambe gauche |
| 90-00 | Jambe droite |

— `LDB 13 l.137-145` (Tableau de Localisation, humanoïde)

> « inversez le résultat de votre « Lancer pour Toucher » afin de déterminer la Localisation. » — `LDB 13 l.147`

### Étape 3 — Déterminer les Dégâts

Chaque arme dispose d'une caractéristique **Dégâts d'Arme**. Pour les armes de Corps à corps c'est en général le **Bonus de Force** ; pour les armes à distance, un **nombre fixe**. Prenez le **DR de votre Test** et additionnez-le aux Dégâts d'Arme (`LDB 13 l.150-151`).

**Dégâts = Dégâts d'Arme + DR** (`LDB 13 l.153`)

### Étape 4 — Appliquer les Dégâts

Soustrayez des Dégâts le **Bonus d'Endurance** de l'adversaire **et tout PA** protégeant la Localisation touchée. Le reste est converti en **Points de Blessure perdus**. **Si le résultat est de 0 ou moins, l'adversaire ne perd qu'un seul Point de Blessure** (il a évité le pire). Si le nombre de Points de Blessure perdus **dépasse le total de PB restants** de l'adversaire, celui-ci reçoit une **Blessure critique** (`LDB 18`) **et obtient l'État *À Terre*** (`LDB 16`) (`LDB 13 l.156-161`).

**Points de Blessure subis = Dégâts − (Bonus d'Endurance + PA) de l'adversaire** ; minimum 1 (`LDB 13 l.163`).

> « Si le résultat est de 0 ou moins, votre adversaire a évité le pire de l'attaque et ne perd qu'un seul Point de Blessure. » — `LDB 13 l.159`

> **Exception** — objets inanimés : « Lorsque vous attaquez des objets inanimés, vous ne causez pas au moins 1 Blessure (comme décrit dans 4 : Appliquer des dégâts dans WFJDR, page 159) : certains objets sont tout simplement trop résistants pour être endommagés. » — `EDO 11 l.95`

### Opposition à une attaque au Corps à corps

Pour s'opposer à une Attaque de Corps à corps, on ne se limite pas à la Compétence Corps à corps. Le choix le plus évident est l'**Esquive** ; le MJ peut aussi autoriser **Intimidation, Charme, Commandement**, etc. C'est une **option soumise à l'accord du MJ** : vous pouvez tenter votre chance avec l'une de ces Compétences **si vous acceptez de renoncer à porter des Coups Critiques** contre l'adversaire ce faisant (`LDB 13 l.161`).

### État *Engagé*

Quand vous attaquez ou êtes attaqué en Corps à corps, vous êtes ***Engagé*** : vous vous battez l'un contre l'autre et les autres règles « pour être Engagé » (Talents, Sorts…) s'appliquent. **Si vous n'attaquez pas l'autre pendant un Round complet, vous n'êtes plus Engagé** (`LDB 13 l.170-171`).

### Degrés de Réussite en combat (usage spécifique)

En combat, le **DR sert à déterminer les Dégâts** (étape 3) — il **n'est pas consulté sur le Tableau des Résultats** comme pour un Test ordinaire. De plus, les Tests de Combat génèrent **Critiques et Maladresses** (`LDB 13 l.174-175`).

### Détails du Combat à Distance

Trois précisions s'ajoutent à l'étape 1 quand on tire (`LDB 14 l.37-53`, suite p.162-163 du chapitre Combat) :

- On **ne peut pas opposer de Compétences de Corps à corps** à une attaque à distance, **sauf** talent particulier ou **bouclier assez large** (p.298). En revanche, on **peut opposer une Esquive** si l'attaque est tirée **à bout portant** (p.297) (`LDB 14 l.40`).
- Il est **impossible de tirer à distance en étant *Engagé***, **sauf** avec une arme à distance possédant le **trait d'arme Pistolet** (`LDB 14 l.43`).
- **Si vous tirez (Projectiles) en étant *Engagé* avec votre cible**, celle-ci peut s'opposer à votre Attaque avec **n'importe quelle Compétence Corps à corps** (`LDB 14 l.53`).

### Cas spécial — Cible sans défense

Les Tests de Capacité de Combat **contre une cible endormie, inconsciente ou sans défense sont automatiquement des succès** (`LDB 14 l.134-135`).

### Difficultés de Combat (modificateurs)

Les Tests de Combat se modifient comme les autres Tests. Tableau des modificateurs les plus courants :

| Difficulté | Mod. | Exemples |
|---|---|---|
| Très Facile | +60 | Tirer sur une cible monstrueuse (Taille géant) ; tirer dans une foule (13+ cibles) ; tirer sur une cible à Distance Bout Portant (p.297) ; tirer sur une cible énorme (Taille griffon) |
| Facile | +40 | Attaquer en surnombre, 3 contre 1 ; tirer sur un groupe important (7-12 cibles) ; tirer sur une cible grande (Taille ogre) ; tirer à Distance Courte (< la moitié de la portée) ; tirer sur un petit groupe (3-6 cibles) |
| Accessible | +20 | Tirer alors que vous avez passé votre dernière action à viser (pas de Test pour viser) ; attaquer un adversaire *Engagé* dans le dos ou sur les côtés ; attaquer en surnombre, 2 contre 1 ; attaquer une cible *À Terre* |
| Intermédiaire | +0 | Une attaque standard ; tirer sur une cible normale (Taille humain) |
| Complexe | -10 | Attaquer alors que vous êtes *À Terre* ou en-dessous de votre cible ; attaquer dans la boue, sous la pluie battante ou sur terrain difficile ; tirer à Distance Longue (jusqu'à 2× la portée) ; tirer pendant un Round où vous utilisez aussi votre Mouvement ; tirer sur une petite cible (Taille enfant) ; cible sous couverture imparfaite (haie) ; attaque visant une Localisation particulière (sur un succès, vous touchez l'endroit désiré) ; combat en espace clos avec une arme à l'Allonge supérieure à Moyenne ; cible dissimulée par brouillard/brume/obscurité |
| Difficile | -20 | Attaquer sous la mousson, ouragan, blizzard ou climat extrême ; esquiver alors que vous êtes *À Terre* ou sur une monture (p.163) ; attaquer avec votre main secondaire ; combat rapproché dans le noir ; tirer sur une cible très petite (Taille chat) ; cible sous couverture moyenne (barrière en bois) ; attaquer/esquiver dans la neige profonde, l'eau ou terrain difficile ; tirer sur une cible minuscule (Taille souris) |
| Très Difficile | -30 | Tirer à Distance Extrême (jusqu'à 3× la portée) ; tirer dans l'obscurité ; cible en couverture totale (mur de pierre) |

— `LDB 14 l.65-115` (Difficulté de Combat)

**Combiner les difficultés** : sommez les modificateurs **sans dépasser ±60** (et **Très Difficile -30** pour les pénalités cumulées) ; une pénalité et un bonus simultanés se somment algébriquement. Exemple : brouillard (-20) + Localisation précise (-20) = -40 → plafonné à **Très Difficile (-30)** ; neige profonde (-30) + cible *À Terre* (+20) = **Difficile (-10)** (`LDB 14 l.91-94`).

### Tableau des Tailles (modificateur au toucher à distance)

| Taille | Hauteur ou longueur | Exemples | Mod. |
|---|---|---|---|
| Minuscule | Moins de 30 cm | Papillon, souris, pigeon | -30 |
| Très Petite | Jusqu'à 60 cm | Chat, faucon, bébé humain | -20 |
| Petite | Jusqu'à 1,20 m | Rat géant, halfling, enfant humain | -10 |
| Moyenne | Jusqu'à 2,10 m | Nain, elfe, humain | 0 |
| Grande | Jusqu'à 3,65 m | Cheval, ogre, troll | +20 |
| Énorme | Jusqu'à 6 m | Griffon, vouivre, manticore | +40 |
| Monstrueuse | + de 6 m | Dragon, géant, Prince démon | +60 |

— `LDB 14 l.118-131` (Taille). Si le bonus de taille fait toucher alors que le Test aurait échoué, vous réussissez avec **0 DR** (`LDB 14 l.120`).

### Supériorité numérique

À **2 contre 1** : **+20** au toucher en Corps à corps. À **3 contre 1** : **+40**. De plus, à la fin de chaque Round, tout adversaire surpassé en nombre **perd 1 Avantage** (`LDB 14 l.110`).

### Application aux portes / objets résistants

Enfoncer une porte (ou fenêtre…) se résout par un **Test de Corps à corps (Bagarre)** ou de Corps à corps avec une **arme appropriée** (hache, marteau). **Le DR obtenu est ajouté au Bonus de Force ; le total est infligé à l'objet. Si une arme est utilisée, on n'ajoute que la moitié des dégâts de l'arme.** L'objet est défini par son **Bonus d'Endurance (BE)** et ses **Blessures (B)**. Contre les objets inanimés, la règle du **minimum 1 Blessure ne s'applique pas** (`EDO 11 l.89-95`). Notation abrégée d'une porte verrouillée : **(D −10, DR 2 ; FT 6, B 15)** = serrure Complexe (−10) demandant 2 DR à crocheter, porte de Bonus d'Endurance 6 et 15 Blessures (`EDO 11 l.86-101`).

**Sources RAW** :
- `LDB 13 l.113-118` — Conditions d'attaque (portée + LdV à distance ; charge/Engagé en mêlée) ; Difficulté de Combat par défaut Intermédiaire (+0).
- `LDB 13 l.122-129` — Étape 1 Lancer pour Toucher : Corps à corps = Test opposé CC, vainqueur touche + gagne +1 Avantage, perdant donne +1 Avantage à l'autre et finit son Action ; Distance = Test de Projectiles non opposé, défenseur ne gagne aucun Avantage ; Critique/Maladresse possibles.
- `LDB 13 l.132-147` — Étape 2 Localisation : inverser le jet du toucher → Tableau (table verbatim) ; autres formes/montures = autres tableaux (Bestiaire).
- `LDB 13 l.150-153` — Étape 3 Dégâts = Dégâts d'Arme (BF en mêlée / fixe à distance) + DR.
- `LDB 13 l.156-163` — Étape 4 : PB perdus = Dégâts − (Bonus d'Endurance + PA de la localisation) ; minimum 1 si ≤ 0 ; PB perdus > PB total → Blessure critique + État *À Terre*.
- `LDB 13 l.166-167` — Opposition à une attaque de Corps à corps : Esquive ou autre Compétence (Intimidation, Charme, Commandement…), mais renoncer aux Coups Critiques contre l'adversaire.
- `LDB 13 l.170-171` — État *Engagé* : entré en attaquant/étant attaqué en mêlée ; cesse si on n'attaque pas l'autre pendant un Round complet.
- `LDB 13 l.174-175` — DR en combat (usage spécifique) : DR → Dégâts (pas de Tableau des Résultats), Tests de Combat génèrent Critiques/Maladresses.
- `LDB 14 l.37-53` — Détails Combat à Distance : pas d'opposition CC sauf talent/bouclier large (p.298) ; Esquive possible si à bout portant (p.297) ; tir impossible en étant Engagé sauf trait Pistolet ; si on tire en étant Engagé avec la cible, elle s'oppose avec n'importe quelle Compétence Corps à corps.
- `LDB 14 l.65-115` — Tableau des Difficultés de Combat (verbatim) + combinaison (l.95-96, plafond ±60 / -30).
- `LDB 14 l.120, l.108-110` — Bonus de taille fait toucher → 0 DR ; supériorité numérique +20 / +40 et perte d'Avantage des surpassés.
- `LDB 14 l.100-102` — Cible sans défense (endormie/inconsciente/sans défense) = touche automatique.
- `LDB 14 l.118-131` — Tableau des Tailles (verbatim).
- `LDB 16 l.15-17` — État *À Terre* dans la liste des États (référence d'application de l'étape 4) ; États ne se cumulent pas (pénalité la plus forte).
- `EDO 11 l.86-101` — Portes/objets : Test CC (Bagarre) ou arme appropriée, DR + BF en dégâts (moitié des dégâts d'arme si arme), objet = (BE, B), pas de minimum 1 Blessure sur l'inanimé, notation abrégée (D, DR ; FT, B).

> « En combat, le DR est utilisé pour déterminer les Dégâts et non obtenir un résultat sur le Tableau des Résultats. » — `LDB 13 l.175`

> « Si vous n'attaquez pas l'autre pendant un Round complet, vous n'êtes plus *Engagé*. » — `LDB 13 l.171`

**Voir aussi** : Critiques et Maladresses (Tableau des Oups !) ; Avantage et Charge ; Tests opposés et Degrés de Réussite ; États (*À Terre*, *Surpris*, *Engagé*) ; Caractéristiques d'armes (Dégâts d'Arme, traits Pistolet/Inoffensive) ; Armures et Points d'Armure ; Tirer dans un combat au Corps à corps ; Combat monté ; Bestiaire (Tableaux de Localisation par forme).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 13` (l.4, l.113-118, l.122-129, l.132-147, l.150-153, l.156-163, l.166-167, l.170-171, l.174-175) → `localisation`, `useDefenseJetProps`, `AuContactModal`, `GrappleModal`, `engage`, `secondsPerRound`, `useHoverTargeting`, `hitLocation`, `markAttacked`, `FLOW_VERBS`, +44 — `src/data/actions.json`, `src/data/localisation.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/actions.ts`, `src/data/schemas/defs/localisation.ts`, +27 fichiers
- `LDB 14` (l.37-53, l.65-115, l.118-131, l.134-135) → `vous-vous-blessez-en-attaquant-perdez-1-blessure-ignore-be-pa`, `COVER_MOD`, `SceneCombatMods`, `OupsMisfireEntry`, `arme-abimee-1-degat-vous-agirez-en-dernier-au-prochain-round`, `decorCover`, `woundsFromHit`, `fr`, `SANS_LIVRE`, `scatter`, +96 — `src/data/actions.json`, `src/data/grapple.json`, `src/data/oups.json`, `src/data/oups.ts`, `src/data/props.json`, `src/data/regles.json`, +40 fichiers
- `LDB 16` (l.15-17) → `effectiveChar`, `addCondition`, `addClockCondition`, `defenseValueMods`, `etatTestMods`, `PoolCandidate`, `dropWorst`, `poolWinner`, `GameOp`, `FREE_ATTACK_LABEL`, +10 — `src/data/index.ts`, `src/engine/characteristics.ts`, `src/engine/combat.ts`, `src/engine/conditions.ts`, `src/engine/ops.ts`, `src/engine/trauma.ts`, +2 fichiers
- `EDO 11` (l.86-101) → `delire`, `fievre-cerebrale-pourpre` — `src/data/maladies.json`, `src/data/symptoms.json`

---

## Tableau de Localisation humanoïde

Lorsqu'une attaque porte (Test opposé de Corps à corps remporté par l'attaquant, ou Test de Capacité de Tir réussi à distance), on détermine **où** le coup frappe avant de calculer les Dégâts. La règle est purement déterministe à partir du **jet pour Toucher déjà lancé** : on n'effectue **aucun jet supplémentaire**. On **inverse** le résultat des dizaines et des unités du dé de toucher (le dé de pourcentage), puis on lit le nombre obtenu sur le Tableau de Localisation.

Exemple canonique : un résultat de **23** au toucher devient **32** une fois inversé, et le coup est porté au **Bras droit** (32 ∈ 25-44). De même, un toucher de **45** s'inverse en **54** (Corps), un **07** en **70** (Corps), un **80** en **08** (Tête), un **99** en **99** (Jambe droite).

> « Si votre attaque porte, définissez la Localisation – inversez le lancer obtenu et comparez ce nombre sur le Tableau de Localisation. Ainsi, un résultat de 23 au toucher devient un 32 sur le tableau, et le coup est porté au Bras Droit. » — `LDB 13 l.133`

> « **En résumé :** _inversez le résultat de votre « Lancer pour Toucher » afin de déterminer la Localisation._ » — `LDB 13 l.147`

Le Bras gauche et le Bras droit portent une mention de précision : il s'agit du **bras secondaire** (côté gauche) et du **bras principal** (côté droit). Ces parenthèses gèrent les créatures ou personnages gauchers et servent surtout aux effets qui visent « le bras qui tient l'arme ».

Ce tableau est celui des cibles à **forme humanoïde** (bipède). Les créatures dont la forme du corps est différente, ainsi que les adversaires montés, utilisent **d'autres** Tableaux de Localisation décrits au Bestiaire (cf. *Voir aussi*).

**Tableau de Localisation humanoïde**

| Lancer (jet de toucher inversé) | Zone touchée |
|---|---|
| 01-09 | Tête |
| 10-24 | Bras gauche (ou bras secondaire) |
| 25-44 | Bras droit (ou bras principal) |
| 45-79 | Corps |
| 80-89 | Jambe gauche |
| 90-00 | Jambe droite |

*(« 00 » = 100 ; voir mécanique d'inversion ci-dessous.)* — `LDB 13 l.137-145`

**Mécanique d'inversion (pas de jet supplémentaire)**

- On inverse les chiffres du dé de pourcentage du toucher : dizaines ↔ unités. Un résultat lu « D U » devient « U D ».
- Le « 00 » du d100 représente **100** ; après inversion il reste dans la dernière tranche (90-00 = Jambe droite). Inversement, un toucher de **80** donne **08** (Tête).

**Localisation visée (coup ciblé)** — Au lieu de prendre la localisation au jet inversé, l'attaquant peut choisir de **viser une zone précise** ; il s'agit alors d'une attaque **Complexe** subissant un malus de **−10** au Test pour Toucher. (Voir le Tableau de Localisation pour la zone choisie ; certaines situations, comme une cible deux fois plus petite/grande, modifient cette pénalité — détaillé hors de ce topic.)

> « **Localisation visée** (Complexe -10 au Test ; sinon localisation = jet inversé). » — code, `src/engine/combat.ts`

**Suite immédiate** — Une fois la Localisation connue, on calcule les Dégâts (`Dégâts = Dégâts d'Arme + DR`, `LDB 13 l.153`), puis on soustrait le Bonus d'Endurance de la cible **et tout Point d'Armure protégeant cette Localisation précise** (`LDB 13 l.159`). C'est pour cela que la Localisation doit être déterminée **avant** les Points de Blessure : l'armure n'est comptée que sur la zone effectivement touchée.

**Sources RAW** :
- `LDB 13 l.133` — Méthode d'inversion : « inversez le lancer obtenu et comparez ce nombre sur le Tableau de Localisation » ; exemple 23 → 32 = Bras droit (CONSOLIDE tous livres : seul le Livre de base définit le tableau humanoïde).
- `LDB 13 l.135` — Renvoi explicite : les créatures de forme différente et les cibles montées utilisent **d'autres** Tableaux de Localisation, décrits au Bestiaire.
- `LDB 13 l.137-145` — Le Tableau de Localisation humanoïde lui-même : 01-09 Tête / 10-24 Bras gauche (secondaire) / 25-44 Bras droit (principal) / 45-79 Corps / 80-89 Jambe gauche / 90-00 Jambe droite.
- `LDB 13 l.147` — Résumé : la Localisation s'obtient en inversant le « Lancer pour Toucher », sans jet additionnel.
- `LDB 13 l.159` — Conséquence : seuls les PA protégeant **la Localisation touchée** réduisent les Dégâts (justifie le rôle du tableau).

**Voir aussi** : Toucher et Test opposé de Corps à corps · Dégâts et Points de Blessure (BE + PA de la zone) · Localisation visée / attaque Complexe · Tableaux de Localisation alternatifs (Bestiaire : serpentin, arachnéen, monture)

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 13` (l.133, l.135, l.137-145, l.147, l.153, l.159) → `localisation`, `useDefenseJetProps`, `engage`, `hitLocation`, `markAttacked`, `agressifEnvers`, `useAttackJetProps`, `toucheSauvee`, `Condition`, `resolvePsychAI`, +12 — `src/data/localisation.json`, `src/data/schemas/defs/localisation.ts`, `src/engine/combat.ts`, `src/engine/engagement.ts`, `src/engine/flowCore.ts`, `src/engine/psychology.ts`, +9 fichiers

---

## Critiques et Frappe Mortelle

Un **Coup Critique** représente le coup extraordinaire dans le feu du combat. Cette entrée couvre uniquement **comment un Critique se déclenche, son effet immédiat, et l'option de balayage « Frappe Mortelle »**. Le détail des séquelles (Tableaux des Critiques ligne par ligne, fractures, déchirures, amputations) relève de l'entrée *Blessures critiques (Tableaux)* / *Traumatisme* ; seuls les éléments mécaniques nécessaires à comprendre le déclenchement et la résolution sont transcrits ici (avec les en-têtes des tables et l'intégralité des tables alternatives d'*Aux Armes*, qui sont la donnée additive autorisée).

### 1. Déclenchement d'un Critique (LDB 13)

Un Critique est généré sur **tout succès** à un Test de combat dont le **résultat du dé est un double** (11, 22, 33, … 99 — et 00 traité comme double).

> « Tout succès lors d'un Test de Corps à Corps ou de Projectiles dont le résultat est un double génère un Critique. Cela signifie que vous avez asséné un coup particulièrement efficace, et cela peut également se produire lorsque vous êtes le défenseur au cours d'un Test opposé. » — `LDB 13 l.183`

Points-clés :
- S'applique en **attaque** (Corps à corps ou Projectiles) **comme en défense** : un défenseur qui obtient un double réussi lors d'un Test opposé (p. ex. en parant) inflige lui aussi un Critique à son adversaire.
- Le Critique est **indépendant** de l'autre source de Blessure critique (perdre plus de PB qu'on en possède) — voir *Blessures critiques* (LDB 18). Un double permet d'infliger une Blessure critique **même si la cible a encore des Points de Blessure**.
- L'**Atout d'arme *Empaleuse*** ajoute une seconde voie de déclenchement (touche sur un multiple de la valeur d'arme) ; l'arme à État *En flammes* et la règle « Retenir vos coups » (déclarée **avant le jet**) annulent à l'inverse le Critique (LDB 18 l.30). Ces interactions sont détaillées dans leurs entrées respectives.

### 2. Effet immédiat (LDB 14)

> « Si vous obtenez un Critique, votre adversaire reçoit immédiatement une Blessure critique, votre arme faisant mouche. […] Au-delà de cela, le DR est calculé comme d'habitude, tout comme la détermination du vainqueur du Test opposé. » — `LDB 14 l.3`

- L'adversaire reçoit **immédiatement une Blessure critique** (en plus des Dégâts normaux du coup).
- Le **DR** du Test reste calculé normalement : il sert toujours à fixer les Dégâts et à départager le vainqueur du Test opposé. Le Critique ne remplace pas le calcul de DR.

### 3. Résolution d'un Coup Critique — localisation et PB (LDB 18)

Lorsqu'un **Coup Critique** est infligé (par un double), la localisation ne se détermine **pas** en inversant le jet d'attaque comme d'habitude :

> « Lorsque vous encaissez un Coup Critique […], vous ne déterminez pas la Localisation en inversant votre lancer comme d'habitude. À la place, lancez 1d100 et référez-vous à Déterminer la Localisation, puis lancez de nouveau 1d100 et référez-vous au Tableau des Critiques correspondant pour voir ce qu'il se produit. Vous perdez le nombre de Points de Blessure indiqué, en ignorant votre Bonus d'Endurance et vos PA […]. De plus, vous subissez les Effets supplémentaires indiqués. » — `LDB 18 l.53`

Procédure exacte :
1. **1ᵉʳ d100** → Tableau de Localisation (ci-dessous) pour la zone touchée.
2. **2ᵉ d100** → ligne du Tableau des Critiques de cette localisation.
3. PB perdus = valeur de la table, **en ignorant BE et PA** (les PA ne réduisent jamais une Blessure critique) ; on subit en plus les **Effets supplémentaires** (États, Traumatismes, Amputations).
4. Modificateur d'**overkill** : si l'on passe en PB négatifs au-delà de son BE (p. ex. sous −4 si BE = 4), on retranche **−20** au résultat sur le Tableau des Critiques, minimum **01** (`LDB 18 l.17`).
5. Un résultat de **00** sur un **Tableau des Critiques** = **coup mortel** (Décapitation / Éventré / Démembrement brutal / Bassin fracassé selon la zone).
6. Pour finir, les Dégâts non critiques de l'attaque utilisent **la nouvelle localisation** déterminée par la Blessure critique (`LDB 18 l.55`).

**Tableau de Localisation (1ᵉʳ d100, forme humanoïde)** — `LDB 13 l.137-145` :

| Lancer | Zone touchée |
|---|---|
| 01-09 | Tête |
| 10-24 | Bras gauche (ou bras secondaire) |
| 25-44 | Bras droit (ou bras principal) |
| 45-79 | Corps |
| 80-89 | Jambe gauche |
| 90-00 | Jambe droite |

**Les quatre Tableaux des Critiques du Livre de base** (en-tête commun `Lancer | Description | PB | Effets supplémentaires`, de `01-10` à `00`) — **ce sont CES tables que le moteur implémente** (`src/data/criticals.ts`), distinctes du système alternatif d'*Aux Armes* (§ 6 ci-dessous) :

#### Tableau des Critiques — À la Tête (`LDB 18 l.56-80`)

| Lancer | Description | PB | Effets supplémentaires |
|---|---|---|---|
| 01-10 | Blessure spectaculaire | 1 | 1 État *Hémorragique* ; une fois guérie, la cicatrice donne DR +1 à certains Tests sociaux. |
| 11-20 | Coupure mineure | 1 | 1 État *Hémorragique*. |
| 21-25 | Coup à l'œil | 1 | 1 État *Aveuglé*. |
| 26-30 | Frappe à l'oreille | 1 | 1 État *Assourdi*. |
| 31-35 | Coup percutant | 2 | 1 État *Sonné*. |
| 36-40 | Œil au beurre noir | 2 | 2 États *Aveuglé*. |
| 41-45 | Oreille tranchée | 2 | 2 États *Assourdi* + 1 État *Hémorragique*. |
| 46-50 | En plein front | 2 | 2 États *Hémorragique* + 1 État *Aveuglé* (non retirable tant que tous les *Hémorragique* ne sont pas éliminés). |
| 51-55 | Mâchoire fracturée | 3 | 2 États *Sonné* ; Traumatisme **Fracture (Mineure)**. |
| 56-60 | Blessure majeure à l'œil | 3 | 1 État *Hémorragique* + 1 État *Aveuglé* (soigné uniquement par Aide Médicale). |
| 61-65 | Blessure majeure à l'oreille | 3 | Perte auditive permanente : −20 aux Tests d'audition ; une 2ᵉ occurrence = surdité totale ; soigné uniquement par magie. |
| 66-70 | Nez cassé | 3 | 2 États *Hémorragique* ; Test *Résistance Intermédiaire (+0)* ou 1 État *Sonné* ; une fois guéri, DR +1/−1 aux Tests sociaux selon le contexte jusqu'à *Chirurgie* du nez. |
| 71-75 | Mâchoire cassée | 4 | 3 États *Sonné* ; Test *Résistance Intermédiaire (+0)* ou *Inconscient* ; Traumatisme **Fracture (Majeure)**. |
| 76-80 | Commotion cérébrale | 4 | 1 *Assourdi*, 2 *Hémorragique*, 1d10 *Sonné* ; + 1 *Exténué* pendant 1d10 jours ; autre Critique à la tête pendant *Exténué* : Test *Résistance Accessible (+20)* ou *Inconscient*. |
| 81-85 | Bouche explosée | 4 | 2 États *Hémorragique* ; perdez 1d10 dents — **Amputation (Facile)**. |
| 86-90 | Oreille mutilée | 4 | 3 États *Assourdi* + 2 États *Hémorragique* ; perdez l'oreille — **Amputation (Accessible)**. |
| 91-93 | Œil crevé | 5 | 3 *Aveuglé* + 2 *Hémorragique* + 1 *Sonné* ; perdez l'œil — **Amputation (Complexe)**. |
| 94-96 | Coup défigurant | 5 | 3 *Hémorragique* + 3 *Aveuglé* + 2 *Sonné* ; perdez l'œil et le nez — **Amputation (Difficile)**. |
| 97-99 | Mâchoire mutilée | 5 | 4 États *Hémorragique* + 3 États *Sonné* ; Test *Résistance Très Difficile (−30)* ou *Inconscient* ; Traumatisme **Fracture (Majeure)** ; perdez la langue + 1d10 dents — **Amputation (Difficile)**. |
| 00 | Décapitation | Mort | Tête tranchée (atterrit à 1d3 m, voir *Dispersion*) ; mort sur le coup. |

#### Tableau des Critiques — au Bras (`LDB 18 l.81-135`)

| Lancer | Description | PB | Effets supplémentaires |
|---|---|---|---|
| 01-10 | Choc au bras | 1 | Lâchez ce que vous teniez. |
| 11-20 | Coupure mineure | 1 | 1 État *Hémorragique*. |
| 21-25 | Torsion | 1 | Traumatisme **Déchirure musculaire (Mineur)**. |
| 26-30 | Choc violent au bras | 2 | Lâchez l'objet ; main inutilisable 1d10 − BE Rounds (min 1), considérée perdue (voir *Membres Amputés*). |
| 31-35 | Déchirure musculaire | 2 | 1 État *Hémorragique* + Traumatisme **Déchirure musculaire (Mineur)**. |
| 36-40 | Main ensanglantée | 2 | 1 État *Hémorragique* ; tant qu'il dure, Test *Dextérité Accessible (+20)* avant toute action tenant un objet de cette main, échec = l'objet glisse. |
| 41-45 | Clef de bras | 2 | Lâchez l'objet ; bras inutilisable 1d10 Rounds (voir *Membres Amputés*). |
| 46-50 | Blessure béante | 3 | 2 États *Hémorragique* ; jusqu'à *Chirurgie*, tout nouveau Dégât au Bras = 1 État *Hémorragique*. |
| 51-55 | Cassure nette | 3 | Lâchez l'objet ; Traumatisme **Fracture (Mineure)** ; Test *Résistance Complexe (−10)* ou 1 État *Sonné*. |
| 56-60 | Ligament rompu | 3 | Lâchez l'objet ; Traumatisme **Déchirure musculaire (Majeur)**. |
| 61-65 | Coupure profonde | 3 | 2 États *Hémorragique* + 1 État *Sonné* + Traumatisme **Déchirure musculaire (Mineur)** ; Test *Résistance Difficile (−20)* ou *Inconscient*. |
| 66-70 | Artère endommagée | 4 | 4 États *Hémorragique* ; tant que pas *Chirurgie*, chaque Dégât à cette Localisation = 2 États *Hémorragique*. |
| 71-75 | Coude fracassé | 4 | Lâchez l'objet ; Traumatisme **Fracture (Majeure)**. |
| 76-80 | Épaule luxée | 4 | Test *Résistance Difficile (−20)* ou États *Sonné* + *À Terre* ; lâchez l'objet, bras perdu (voir *Membre Amputé*) ; 1 État *Sonné* jusqu'à Aide Médicale, puis Test étendu *Guérison Accessible (+20)* DR 6 pour récupérer le bras ; Tests de ce bras −10 pendant 1d10 jours. |
| 81-85 | Doigt sectionné | 4 | 1 État *Hémorragique* ; perdez 1 doigt — **Amputation (Accessible)**. |
| 86-90 | Main ouverte | 5 | Perdez 1 doigt — **Amputation (Complexe)** ; 2 États *Hémorragique* + 1 État *Sonné* ; chaque Round sans Aide Médicale = 1 doigt de plus ; tous les doigts perdus = main perdue — **Amputation (Complexe)**. |
| 91-93 | Biceps déchiqueté | 5 | Lâchez l'objet ; Traumatisme **Déchirure musculaire (Majeur)** + 2 États *Hémorragique* + 1 État *Sonné*. |
| 94-96 | Main mutilée | 5 | Perdez la main — **Amputation (Difficile)** ; 2 États *Hémorragique* ; Test *Résistance Difficile (−20)* ou États *Sonné* + *À Terre*. |
| 97-99 | Tendons coupés | 5 | Bras inutilisable — **Amputation (Très Difficile)** ; 3 *Hémorragique* + 1 *À Terre* + 1 *Sonné* ; Test *Résistance Difficile (−20)* ou *Inconscient*. |
| 00 | Démembrement brutal | Mort | Bras coupé (le sang gicle à 1d3 m, voir *Dispersion*), le coup termine sa course dans la poitrine. |

#### Tableau des Critiques — au Corps / Torse (`LDB 18 l.136-150`)

| Lancer | Description | PB | Effets supplémentaires |
|---|---|---|---|
| 01-10 | Rien qu'une égratignure ! | 1 | 1 État *Hémorragique*. |
| 11-20 | Coup au ventre | 1 | 1 État *Sonné* ; Test *Résistance Facile (+40)* ou vous vomissez et gagnez *À Terre*. |
| 21-25 | Coup bas | 1 | Test *Résistance Difficile (−20)* ou 3 États *Sonné*. |
| 26-30 | Torsion du dos | 1 | Traumatisme **Déchirure musculaire (Mineur)**. |
| 31-35 | Souffle coupé | 2 | 1 État *Sonné* ; Test *Résistance Accessible (+20)* ou *À Terre* ; Mouvement réduit de moitié pendant 1d10 Rounds. |
| 36-40 | Bleus aux côtes | 2 | Tests d'Agilité −10 pendant 1d10 jours. |
| 41-45 | Clavicule tordue | 2 | Un bras au hasard : lâchez l'objet, bras inutilisable 1d10 Rounds (voir *Membres Amputés*). |
| 46-50 | Chairs déchirées | 2 | 2 États *Hémorragique*. |
| 51-55 | Côtes fracturées | 3 | 1 État *Sonné* ; Traumatisme **Fracture (Mineure)**. |
| 56-60 | Blessure béante | 3 | 3 États *Hémorragique* ; tant que pas *Chirurgie*, chaque Blessure à cette Localisation = 1 État *Hémorragique*. |
| 61-65 | Entaille douloureuse | 3 | 2 États *Hémorragique* + 1 État *Sonné* ; Test *Résistance Difficile (−20)* ou *Inconscient* ; si pas au moins DR 4, vous hurlez de douleur. |
| 66-70 | Dégâts artériels | 3 | 4 États *Hémorragique* ; tant que pas *Chirurgie*, chaque Blessure à cette Localisation = 2 États *Hémorragique*. |
| 71-75 | Dos froissé | 4 | Traumatisme **Déchirure musculaire (Majeur)**. |
| 76-80 | Hanche fracturée | 4 | 1 État *Sonné* ; Test *Résistance Intermédiaire (+0)* ou *À Terre* ; Traumatisme **Fracture (Mineure)**. |
| 81-85 | Blessure majeure au torse | 4 | 4 États *Hémorragique* ; tant que pas *Chirurgie*, toute nouvelle Blessure à cette Localisation = 2 États *Hémorragique*. |
| 86-90 | Blessure au ventre | 4 | Blessure **Purulente** (voir *Maladie et Infection*) + 2 États *Hémorragique*. |
| 91-93 | Cage thoracique perforée | 5 | 1 État *Sonné* (retiré uniquement par Aide Médicale) ; Traumatisme **Fracture (Majeure)**. |
| 94-96 | Clavicule cassée | 5 | 1 État *Inconscient* jusqu'à Aide Médicale ; Traumatisme **Fracture (Majeure)**. |
| 97-99 | Hémorragie interne | 5 | 1 État *Hémorragique* (retiré uniquement par *Chirurgie*) ; **Infection Sanguine** (voir *Maladie et Infection*). |
| 00 | Éventré | Mort | Coupé en deux ; tout Personnage à moins de 2 m est couvert de sang. |

#### Tableau des Critiques — à la Jambe (`LDB 18 l.151-187`)

| Lancer | Description | PB | Effets supplémentaires |
|---|---|---|---|
| 01-10 | Orteil contusionné | 1 | Test *Résistance Accessible (+20)* ou −10 aux Tests d'Agilité jusqu'à la fin du prochain tour. |
| 11-20 | Cheville tordue | 1 | Tests d'Agilité −10 pendant 1d10 Rounds. |
| 21-25 | Coupure mineure | 1 | 1 État *Hémorragique*. |
| 26-30 | Perte d'équilibre | 1 | Test *Résistance Intermédiaire (+0)* ou *À Terre*. |
| 31-35 | Coup à la cuisse | 2 | 1 État *Hémorragique* ; Test *Résistance Accessible (+20)* ou vous trébuchez et gagnez *À Terre*. |
| 36-40 | Cheville foulée | 2 | Traumatisme **Déchirure musculaire (Mineur)**. |
| 41-45 | Genou tordu | 2 | Tests d'Agilité −20 pendant 1d10 Rounds. |
| 46-50 | Coupure à l'orteil | 2 | 1 État *Hémorragique* ; après la rencontre, Test *Résistance Intermédiaire (+0)*, échec = perdez un orteil — **Amputation (Accessible)**. |
| 51-55 | Mauvaise coupure | 3 | 2 États *Hémorragique* (tibia) ; Test *Résistance Intermédiaire (+0)* ou *À Terre*. |
| 56-60 | Genou méchamment tordu | 3 | Traumatisme **Déchirure musculaire (Majeur)**. |
| 61-65 | Jambe charcutée | 3 | 2 États *Hémorragique* + 1 État *À Terre* ; Traumatisme **Fracture (Mineure)** ; Test *Résistance Difficile (−20)* ou *Sonné*. |
| 66-70 | Cuisse lacérée | 3 | 3 États *Hémorragique* ; Test *Résistance Intermédiaire (+0)* ou *À Terre* ; tant que pas *Chirurgie*, chaque Dégât à cette Jambe = 1 État *Hémorragique*. |
| 71-75 | Tendon rompu | 4 | États *À Terre* + *Sonné* ; Test *Résistance Difficile (−20)* ou *Inconscient* ; jambe inutilisable (voir *Membres Amputés*) ; Traumatisme **Déchirure musculaire (Majeur)**. |
| 76-80 | Entaille au tibia | 4 | États *Sonné* + *À Terre* ; Traumatismes **Déchirure musculaire (Majeur)** + **Fracture (Majeure)**. |
| 81-85 | Genou cassé | 4 | 1 État *Sonné* + 1 État *À Terre* ; Traumatisme **Fracture (Majeure)**. |
| 86-90 | Genou démis | 4 | *À Terre* ; Test *Résistance Difficile (−20)* ou *Sonné* (retiré uniquement par Aide Médicale) ; après l'Aide, Test étendu *Guérison Accessible (+20)* DR 6 pour récupérer la jambe ; Mouvement réduit de moitié + Tests de cette jambe −10 pendant 1d10 jours. |
| 91-93 | Pied écrasé | 5 | Test *Résistance Accessible (+20)*, échec = *À Terre* + perdez un orteil (+1 par DR sous 0) — **Amputation (Accessible)** ; 2 États *Hémorragique* ; sans *Chirurgie* sous 1d10 jours, vous perdez le pied. |
| 94-96 | Pied sectionné | 5 | Pied sectionné à la cheville (atterrit à 1d3 m, voir *Dispersion*) — **Amputation (Difficile)** ; 3 *Hémorragique* + 2 *Sonné* + 1 *À Terre*. |
| 97-99 | Tendon coupé | 5 | 2 États *Hémorragique* + 2 *Sonné* + 1 *À Terre* ; jambe inutilisable — **Amputation (Très Difficile)**. |
| 00 | Bassin fracassé | Mort | Le coup fracasse le bassin ; mort instantanée (choc traumatique). |

### 4. Option : Frappe Mortelle (LDB 13 / LDB 14)

Règle **optionnelle** de combat héroïque, pour balayer les rangs d'adversaires plus faibles :

> « Si vous tuez un adversaire au Corps à corps en un seul coup, vous pouvez vous déplacer sur l'emplacement occupé par ce Personnage et attaquer un éventuel autre adversaire. Vous pouvez faire cela un nombre de fois égal à votre Bonus de Capacité de Combat. Certaines créatures […] sont si grandes qu'elles peuvent activer cette règle sans avoir à tuer d'adversaires. » — `LDB 14 l.9`

Conditions et limites :
- **Mêlée uniquement** ; il faut **tuer la cible en un seul coup**.
- On se déplace **sur la case** de l'adversaire tué, puis on attaque **un autre** adversaire.
- Nombre maximum d'enchaînements = **Bonus de Capacité de Combat (BCC)** de l'attaquant.
- **Exception « grandes créatures »** : certaines créatures de grande Taille activent Frappe Mortelle **sans avoir à tuer** — il leur suffit de **toucher** un adversaire sans le tuer pour se déplacer dans sa zone et frapper une autre cible le même Round. Confirmé par un statbloc :

> « Frappe mortelle (WFJDR, page 160). En raison de sa taille, le basilic peut se déplacer dans la zone d'un adversaire qu'il a touché, mais n'a pas réussi à tuer, puis attaquer immédiatement une autre cible dans le même Round. » — `AU1 04 l.18`

### 5. Déviation Critique par l'armure (LDB 63)

Une Blessure critique frappant une localisation **protégée par une armure** peut être annulée au prix de l'armure :

> « Si vous subissez une Blessure Critique issue d'une attaque visant un emplacement protégé par une armure, vous pouvez choisir de laisser votre armure être endommagée de 1 PA dans le but d'ignorer la Blessure Critique. » — `LDB 63 l.30`

On subit toujours les **Dégâts normaux** (et probablement 1 PB de plus, les PA étant réduits de 1), mais on évite les effets de la Blessure critique.

### 6. Système alternatif d'*Aux Armes* (remplace les tables LDB)

*Aux Armes* propose un système complet alternatif de Blessures critiques. Le **déclenchement** y est explicité en deux voies (`AA 07 l.25-42`) :

- **Coup Critique avec Blessures restantes** : un double réussi en CC/Projectiles inflige une Blessure critique même si la cible a encore des PB. Localisation par 1ᵉʳ d100, effet par 2ᵉ d100, **comme en LDB** (`AA 07 l.29-32`). En prime : une fois tous les États *Hémorragique* retirés, on gagne un État *Exténué* (`AA 07 l.31`).
- **Critique en faisant tomber à 0 Blessure** : si l'attaque amène la cible à 0 PB, elle subit automatiquement une Blessure critique. On **ajoute +10 par Blessure infligée au-delà** de celles nécessaires pour atteindre 0 (ou +10 par Blessure si la cible était déjà à 0) au jet 1d100 sur la table de la localisation (`AA 07 l.36`). C'est ce **+10 escaladant** qui pousse le résultat vers les lignes hautes (mort), au lieu du −20 d'overkill du LDB.
- **Chaque coup ne peut infliger qu'une seule Blessure critique** : les Blessures supplémentaires d'une ligne de table ne redéclenchent jamais de second jet (`AA 07 l.40-42`).
- « Retenir vos coups » : on n'inflige une Blessure critique **que si l'adversaire tombe à 0 Blessure** ; impossible avec une arme *En flammes*, des projectiles ou des sorts ; on perd alors les Atouts *Empaleuse, Percutante, Perforante, Taille* (`AA 07 l.59-61`).
- Une valeur de Blessure **« T »** (Blessure **triviale**) n'inflige aucune Blessure supplémentaire et **ne compte pas** dans le total de Blessures critiques nécessaires pour mourir (`AA 07 l.79`).

Ces tables **remplacent** celles du LDB. Les **quatre tableaux complets** (Tête/Bras/Torse/Jambe, transcrits verbatim) sont regroupés dans le topic **[AA : système alternatif de Blessures et Critiques](#aa--système-alternatif-de-blessures-et-critiques)** — non répétés ici pour éviter la redite.

### 7. Interactions multi-livres (Critiques en pratique)

- **Trait *Dédoublement*** (Horreur Rose de Tzeentch) : « Si la créature subit une Blessure Critique, ou perd toutes ses Blessures, elle est remplacée par **deux horreurs bleues** […] et ne sont pas blessées. » — `EDO 11 l.239-240`. Donc subir un seul Critique scinde la créature.
- **Frappe mortelle des grandes créatures** : le **basilic** illustre l'exception « grandes créatures » du LDB 14 (se déplacer dans la zone d'une cible **touchée mais non tuée** puis frapper une autre) — `AU1 04 l.18`.
- **Critiques multiples par explosion** (bombe de l'Opéra, *Une nuit à l'Opéra*) : « Celles réduites à 0 Blessure souffrent d'une Blessure critique à une **localisation aléatoire par tranche de 2 Blessures en dessous de 0**, en arrondissant à la hausse. Ainsi, si un Personnage est réduit à −5 Blessures […], cela occasionne **3 Blessures critiques**. » — `NADJ 08 l.263`. (Bombe : Atout *Explosion 10*, 1d10+15 Dégâts, BonusAg −1d10 États *En Flammes* ; survivants : *Athlétisme Complexe (−10)* sinon chute de 7 m.)

**Sources RAW** :
- `LDB 13 l.183` — déclenchement : tout succès CC/Projectiles dont le **dé est un double** génère un Critique ; possible aussi en **défense** sur un Test opposé. (CONSOLIDE avec `AA 07 l.29`.)
- `LDB 13 l.137-145` — Tableau de Localisation humanoïde (1ᵉʳ d100) utilisé pour la localisation du Coup Critique.
- `LDB 14 l.4` — effet immédiat : Blessure critique immédiate ; le **DR reste calculé normalement** (Dégâts + vainqueur du Test opposé).
- `LDB 14 l.6-7` — Option **Frappe Mortelle** : tuer en un coup en mêlée → se déplacer sur la case + frapper un autre adversaire, **jusqu'à BCC fois** ; certaines **grandes créatures** l'activent sans tuer.
- `LDB 18 l.17` — overkill : si PB négatifs < −BE, **−20** au Tableau des Critiques (min 01).
- `LDB 18 l.53-55` — résolution du Coup Critique : localisation par **2ᵉ d100**, PB perdus **en ignorant BE et PA**, Effets supplémentaires, **00 = mort** ; Dégâts non critiques recalculés sur la nouvelle localisation.
- `LDB 18 l.56-187` — en-têtes et bornes des quatre Tableaux des Critiques LDB (Tête/Bras/Corps/Jambe), `01-10` → `00` (mort).
- `LDB 63 l.29-32` — **Déviation Critique** : sacrifier 1 PA pour ignorer une Blessure critique sur une localisation protégée.
- `AA 07 l.25-79` — système alternatif d'*Aux Armes* : 2 voies de déclenchement (double avec PB restants ; +10/Blessure au-delà de 0), un seul Critique par coup, valeurs « T » triviales, « Retenir vos coups ».
- `AA 07 l.82-104 / 2568-2622 / 2625-2682 / 2684-2729` — tables alternatives Tête / Bras / Torse / Jambe (transcrites verbatim ci-dessus ; **remplacent** les tables LDB).
- `EDO 11 l.237-239` — Trait *Dédoublement* : une Blessure critique (ou 0 Blessure) scinde la créature en deux Horreurs Bleues non blessées.
- `AU1 04 l.18` — exemple statbloc de Frappe mortelle pour une grande créature (touche sans tuer → balayage).
- `NADJ 08 l.263` — Critiques multiples : 1 Blessure critique à localisation aléatoire par tranche de 2 PB sous 0 (arrondi au supérieur).

> « Tout succès lors d'un Test de Corps à Corps ou de Projectiles dont le résultat est un double génère un Critique. » — `LDB 13 l.183`

> « Vous perdez le nombre de Points de Blessure indiqué, en ignorant votre Bonus d'Endurance et vos PA […]. De plus, vous subissez les Effets supplémentaires indiqués. » — `LDB 18 l.53`

> « Vous pouvez faire cela un nombre de fois égal à votre Bonus de Capacité de Combat. Certaines créatures […] sont si grandes qu'elles peuvent activer cette règle sans avoir à tuer d'adversaires. » — `LDB 14 l.9`

**Voir aussi** : Blessures critiques (Tableaux complets) ; Traumatisme (fractures, déchirures, amputations) ; Localisation et Tableau de Localisation ; Test opposé et Degrés de Réussite ; Atouts d'arme (Empaleuse, Percutante, Perforante) ; Armures et PA (Déviation Critique) ; Mort et Destin ; États (Hémorragique, Sonné, Aveuglé, À Terre, Inconscient).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 13` (l.137-145, l.183) → `localisation`, `hitLocation`, `FLOW_VERBS`, `useAttackJetProps`, `FLOWS`, `createCombatSlice`, `previewDefense`, `rangedDefenseModes`, `applyHit`, `applyAttackResult`, +1 — `src/data/localisation.json`, `src/data/schemas/defs/localisation.ts`, `src/engine/combat.ts`, `src/state/combatFlow.ts`, `src/state/combatSlice.ts`, `src/state/flowVerbs.ts`, +2 fichiers
- `LDB 14` (l.3, l.4, l.6-7, l.9) → `vous-vous-blessez-en-attaquant-perdez-1-blessure-ignore-be-pa`, `isFumble`, `arme-abimee-1-degat-vous-agirez-en-dernier-au-prochain-round`, `10-a-votre-action-au-prochain-round`, `vous-trebuchez-vous-perdez-votre-prochain-mouvement`, `vous-lachez-ou-ratez-vous-perdez-votre-prochaine-action`, `vous-vous-tordez-la-cheville-dechirure-musculaire-mineure-compte-comme-blessure-critique`, `vous-touchez-un-allie-au-hasard-ou-vous-meme-sonne`, `incident-de-tir-l-arme-explose-dans-votre-main-degats-au-bras-principal-arme-detruite`, `combat-frappe-mortelle`, +20 — `src/data/oups.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/engine/combat.ts`, `src/engine/oups.ts`, `src/state/combatFlow.ts`, +4 fichiers
- `LDB 18` (l.17, l.30, l.53-55, l.56-187) → `criticals-ldb-tete`, `CritEntry`, `dechirure-jambe-mineure`, `isHealable`, `blessure-spectaculaire`, `HealMode`, `actBlockReason`, `MedicState`, `availableHealModes`, `critEscalationSchema`, +169 — `src/data/combat-stakes.json`, `src/data/criticals.json`, `src/data/criticals.ts`, `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/night-stakes.json`, +32 fichiers
- `LDB 63` (l.29-32) → `cuir-souple`, `cuir-bouilli`, `mailles`, `plate`, `GameOp`, `PendingDeviation`, `ActiveEffect`, `RebondDeChaine`, `wornArmourPoints`, `deviatableArmourAt`, +25 — `src/data/qualities.json`, `src/data/reglesOptionnelles.json`, `src/data/trappings.json`, `src/data/weaponGroups.json`, `src/engine/items.ts`, `src/engine/ops.ts`, +3 fichiers
- `AA 7` (l.25-79, l.82-104) → `StructureCritEntry`, `CritEntry`, `pendantRounds`, `useAttackJetProps`, `retenir-ses-coups`, `CritEscalation`, `Formula`, `aaCriticalOffset`, `critiqueTriviale`, `aaDeathByCriticalCount`, +51 — `src/data/criticals.json`, `src/data/criticals.ts`, `src/data/index.ts`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/criticals.ts`, +9 fichiers
- `EDO 11` (l.237-240) → `chair-necrosee`, `cretin`, `pattes-chevre`, `tete-bestiale-chien`, `digere`, `tete-pointue`, `dedoublement`, `absorption`, `amorphe`, `contagieux`, +3 — `src/data/etats.json`, `src/data/mutations.json`, `src/data/traits.json`, `src/data/trappings.json`
- sans code : `AU1 4` (l.18), `NADJ 8` (l.263)

---

## Maladresses, Oups ! et Incident de Tir

### Définition d'une Maladresse

Une **Maladresse** est l'inverse exact d'un **Critique** : *tout Test de combat (Corps à corps ou Projectiles) qui est un **échec** et dont le résultat du d100 est un **double** est une Maladresse*. Les doubles sont `11, 22, 33, 44, 55, 66, 77, 88, 99` et `00` (= 100). Quand cela arrive, « quelque chose de très déplaisant vient de se produire » : dans la plupart des cas on consulte le **Tableau des Oups !**, sauf cas particuliers (armes à Poudre noire / mécaniques / explosives → **Incident de Tir**).

Symétrie à retenir : le **Critique** = succès + double ; la **Maladresse** = échec + double. Le double seul ne suffit pas — c'est le couple (échec, double) qui déclenche la Maladresse.

> « Les Maladresses sont l'inverse des Critiques ; tout Test de combat qui est un échec et dont le résultat du jet est un double est une Maladresse, ce qui signifie que quelque chose de très déplaisant vient de se produire. » — `LDB 14 l.19`

### Maladresses en Test Opposé

En combat de Corps à corps, le « Lancer pour Toucher » est un **Test opposé**. Une **Maladresse reste possible même quand on gagne le Test opposé** : un attaquant peut faire une Maladresse (échec + double sur son propre jet) tout en l'emportant si son DR est supérieur à celui de l'adversaire. On combat alors inefficacement contre un adversaire encore plus mauvais : on gagne le Test (et l'Avantage associé), mais on lance malgré tout sur le **Tableau des Oups !** pour subir le malheureux accident.

> « Pendant un Test opposé, il est possible de faire une Maladresse et de tout de même gagner si vous obtenez un DR supérieur à votre adversaire. » — `LDB 14 l.13`

**Exemple canon :** Molli frappe avec sa dague et obtient `66` → Maladresse à -3 DR ; son adversaire obtient `92` → -5 DR. Molli l'emporte donc avec +2 DR (gagne +1 Avantage), mais doit quand même lancer sur le Tableau des Oups ! (`LDB 14 l.15`).

### Tableau des Oups ! (d100)

On lance 1d100 et on applique le résultat suivant — table reproduite verbatim :

| Lancer | Résultat |
|---|---|
| 01-20 | Vous vous blessez tout seul en attaquant (interprétez l'incident pour son côté amusant) — **perdez une Blessure, sans tenir compte de votre Bonus d'Endurance ou de vos PA**. |
| 21-40 | Votre arme de Corps à corps s'ébrèche salement, ou votre arme à distance ne fonctionne pas, voire est sur le point de se briser — **votre arme subit 1 Dégât**. Le prochain Round, vous **agirez en dernier**, sans tenir compte de l'Ordre d'Initiative, de vos talents, ou de toute règle spéciale, pendant que vous la réparez (voir page 156). |
| 41-60 | Vous avez mal négocié votre manœuvre, ce qui vous met en mauvaise posture, ou vous perdez la prise de votre arme à distance. Au cours du prochain Round, votre **Action subira une pénalité de -10**. |
| 61-70 | Vous trébuchez franchement et peinez à vous redresser. Vous **perdez votre prochain Mouvement**. |
| 71-80 | Vous ne tenez pas votre arme correctement, ou vous laissez tomber vos munitions. Vous **perdez votre prochaine Action**. |
| 81-90 | Vous effectuez un mouvement trop ample, ou vous trébuchez et vous vous tordez la cheville. Subissez le traumatisme **Déchirure musculaire (Mineur)** (voir page 179). **Ce dernier compte comme une Blessure critique.** |
| 91-00 | Vous manquez complètement votre attaque et **touchez 1 allié au hasard à distance** en utilisant **le chiffre des unités de votre lancer de dés pour déterminer le DR**. Si personne n'est à distance, vous **vous frappez tout seul et obtenez l'État _Sonné_** (voir page 167). |

`LDB 14 l.8-13` (Tableau des Oups ! verbatim).

Détails mécaniques importants de la table :
- **01-20** : la Blessure ignore le Bonus d'Endurance ET les PA (touche garantie sur soi).
- **21-40** : double peine — 1 Dégât d'arme (usure) + agir en dernier au prochain Round, sans qu'aucun talent ni règle d'Initiative n'y change rien.
- **81-90** : la Déchirure musculaire (Mineur) est un véritable traumatisme/Blessure critique, pas un simple malus temporaire.
- **91-00** : le DR de la touche fratricide est dérivé du **chiffre des unités** du d100 raté ; à défaut d'allié à portée, c'est l'État _Sonné_ sur soi.

### Incident de Tir (armes à Poudre noire / mécaniques / explosives)

Si vous utilisez une arme à **Poudre noire, mécanique ou explosive** et que vous effectuez une **Maladresse qui est aussi un nombre pair** (par exemple `00, 88`, etc.), l'**Incident de Tir** se substitue au Tableau des Oups ! : l'arme a un raté d'allumage et **explose dans votre main**. Conséquences :
- Vous **subissez tous les Dégâts de l'arme à la Localisation de votre Bras principal** ;
- la touche utilise **le dé des unités comme DR** ;
- votre **arme est détruite**.

> « Si vous utilisez une arme à Poudre noire, mécanique ou explosive et que vous effectuez une Maladresse qui est aussi un nombre pair – 00, 88 etc. –, votre arme a un raté d'allumage, explosant dans votre main. Vous subissez tous les Dégâts à la Localisation de votre Bras principal en utilisant le dé des unités comme DR pour toucher, et votre arme est détruite. » — `LDB 14 l.34`

Note de portée : pour ces armes, *seules les Maladresses (échec + double) PAIRES* déclenchent l'explosion. Une Maladresse impaire (`11, 33, 55, 77, 99`) renvoie au Tableau des Oups ! normal. La règle générique de la Maladresse renvoie d'ailleurs explicitement au Chapitre Équipement pour les armes à Poudre noire (raté d'allumage / explosion) au lieu du Tableau des Oups ! (`LDB 14 l.19`).

### Défaut d'arme « Dangereuse » — élargit le déclenchement de la Maladresse

Le Défaut d'arme **Dangereuse** (porté entre autres par l'Arquebuse, le Tromblon, la Bombe, l'Arquebuse à répétition, le Pistolet à répétition, et conféré par défaut à tout maniement d'arme à distance sans la compétence) modifie la *condition de déclenchement* de la Maladresse :

> « Certaines armes sont presque aussi susceptibles de vous blesser que votre adversaire. **Tout Test raté incluant un 9 sur le dé des dizaines ou des unités entraîne une Maladresse** (voir Chapitre 5 : Règles pour plus d'informations sur les Maladresses). » — `LDB 62 l.315`

Donc avec une arme Dangereuse, il n'est plus nécessaire d'obtenir un double : tout **échec** dont le d100 contient un **9** (aux unités ou aux dizaines — `09, 19, 29, …, 90-99`) est déjà une Maladresse, qui se résout ensuite normalement (Tableau des Oups ! ou Incident de Tir si pair + arme à Poudre noire). C'est la raison pour laquelle les armes à feu, presque toutes Dangereuses, ratent et explosent bien plus souvent. (À noter : « toutes les Armes à Poudre noire et d'Ingénierie possèdent les Atouts Poudre noire et Dévastatrice », `LDB 62 l.99`.)

### Maladresse comme défenseur (Test opposé en Corps à corps)

Le *Lancer pour Toucher* de Corps à corps étant un Test opposé, le **défenseur** lance lui aussi un d100 : un Critique peut survenir « lorsque vous êtes le défenseur au cours d'un Test opposé » (`LDB 13 l.183`). Par symétrie, le défenseur peut tout autant faire une Maladresse (échec + double, ou un 9 raté avec une arme de parade Dangereuse), résolue sur le Tableau des Oups ! / Incident de Tir.

**Sources RAW** :
- `LDB 13 l.127` — Le « Lancer pour Toucher » peut produire un Critique ou une Maladresse ; renvoi à « Critiques et Maladresses ci-après ».
- `LDB 13 l.178-183` — Section « Critiques et Maladresses » : les Tests de combat génèrent Critiques (succès + double) et Maladresses ; un Critique peut survenir aussi côté défenseur d'un Test opposé.
- `LDB 14 l.18-19` — **Définition de la Maladresse** : Test de combat échoué dont le jet est un double ; cas Poudre noire renvoyé au Chapitre Équipement, sinon Tableau des Oups !.
- `LDB 14 l.13-15` — **Tests Opposés et Maladresses** : Maladresse possible même en gagnant le Test opposé (DR supérieur) ; exemple Molli `66` vs adversaire `92`.
- `LDB 14 l.8-13` — **Tableau des Oups !** (d100, 7 fourchettes) reproduit verbatim.
- `LDB 14 l.29-34` — **Incident de Tir** : arme à Poudre noire/mécanique/explosive + Maladresse PAIRE → explosion dans la main, tous les Dégâts au Bras principal (DR = dé des unités), arme détruite.
- `LDB 62 l.313-315` — Défaut d'arme **Dangereuse** : tout Test raté incluant un 9 (dizaines ou unités) entraîne une Maladresse (élargit le déclenchement).
- `LDB 62 l.98-104` — Armes à Poudre noire (Arquebuse, Long fusil d'Hochland, Pistolet, Tromblon) ; Atouts Poudre noire + Dévastatrice systématiques ; plusieurs portent aussi Dangereuse.

> « tout Test de combat qui est un échec et dont le résultat du jet est un double est une Maladresse » — `LDB 14 l.19`

> « Tout Test raté incluant un 9 sur le dé des dizaines ou des unités entraîne une Maladresse » — `LDB 62 l.315`

**Voir aussi** : Critiques et Blessures critiques (succès + double) ; Tests Opposés et Degrés de Réussite ; Atouts et Défauts d'arme (Dangereuse, Poudre noire, Dévastatrice, Recharge) ; Traumatisme (Déchirure musculaire) ; États (Sonné) ; Incantation Imparfaite et Colère des dieux (la « Maladresse » magique).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 13` (l.127, l.178-183) → `localisation`, `useDefenseJetProps`, `AuContactModal`, `GrappleModal`, `engage`, `hitLocation`, `markAttacked`, `FLOW_VERBS`, `agressifEnvers`, `useAttackJetProps`, +23 — `src/data/actions.json`, `src/data/localisation.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/localisation.ts`, `src/engine/combat.ts`, +15 fichiers
- `LDB 14` (l.8-15, l.18-19, l.29-34) → `vous-vous-blessez-en-attaquant-perdez-1-blessure-ignore-be-pa`, `OupsMisfireEntry`, `isFumble`, `arme-abimee-1-degat-vous-agirez-en-dernier-au-prochain-round`, `10-a-votre-action-au-prochain-round`, `vous-trebuchez-vous-perdez-votre-prochain-mouvement`, `vous-lachez-ou-ratez-vous-perdez-votre-prochaine-action`, `viser-une-localisation`, `viser`, `vous-vous-tordez-la-cheville-dechirure-musculaire-mineure-compte-comme-blessure-critique`, +36 — `src/data/actions.json`, `src/data/oups.json`, `src/data/oups.ts`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/oups.ts`, +9 fichiers
- `LDB 62` (l.98-104, l.313-315) → `armes-d-hast`, `bagarre`, `base`, `cavalerie`, `resolveQualities`, `deux-mains`, `escrime`, `resolveVolley`, `fleau`, `defensive`, +75 — `src/data/combat-stakes.json`, `src/data/etats.json`, `src/data/flow-stakes.json`, `src/data/qualities.json`, `src/data/reglesOptionnelles.json`, `src/data/trappings.json`, +7 fichiers

---

## Combat à Distance : restrictions et règles de tir

Le combat à distance utilise la Compétence **Projectiles** (pour l'arme employée). Il diffère du Corps à corps sur trois points structurants : ce n'est **pas** un Test opposé par défaut, le défenseur ne gagne **aucun Avantage**, et plusieurs **restrictions** encadrent quand et comment on peut tirer. Cette entrée consolide les règles du chapitre Combat du Livre de base (résumé de l'attaque à distance + section « Combat À Distance » + cas spéciaux), réparties entre deux fichiers source (`13 - Combat.md`, pages PDF 158-161, et `14 - _GoBack.md`, pages PDF 162-165) qui forment un seul et même chapitre Combat.

### Prérequis et résolution de base d'un tir

Pour effectuer une attaque à distance, l'arme doit être **à la bonne portée** (voir le Guide de l'équipement pour la portée des armes) **et** la cible doit être **dans la Ligne de Vue** du tireur.

> « Pour effectuer une attaque à distance, votre arme doit être à la bonne portée […] et votre cible doit être dans votre Ligne de Vue. » — `LDB 13 l.114`

La résolution se fait par un **Test de Projectiles** simple (non opposé) :

> « **Distance :** effectuez un Test de **Projectiles** pour l'arme que vous utilisez. Sur un succès, vous touchez votre adversaire et gagnez +1 Avantage. Sur un échec, votre Action prend fin. Le défenseur ne gagne aucun Avantage pendant un Combat à Distance. » — `LDB 13 l.125`

Comme en Corps à corps, un tir peut produire un **Critique** (succès dont le résultat est un double) ou une **Maladresse** (échec dont le résultat est un double → Tableau des Oups !, ou Incident de Tir pour les armes à Poudre noire / mécaniques / explosives). La **Localisation** se détermine en **inversant** le résultat du jet pour toucher, puis en lisant le Tableau de Localisation (commun au Corps à corps et au tir) :

| Lancer | Zone touchée |
|---|---|
| 01-09 | Tête |
| 10-24 | Bras gauche (ou bras secondaire) |
| 25-44 | Bras droit (ou bras principal) |
| 45-79 | Corps |
| 80-89 | Jambe gauche |
| 90-00 | Jambe droite |

— `LDB 13 l.137-145`

### Restrictions du Combat À Distance (qui peut s'opposer, et quand peut-on tirer)

Quatre règles encadrent un tir :

1. **On ne peut pas opposer de Compétence de Corps à corps à un tir**, *sauf* si l'on dispose d'un **talent particulier** ou d'un **bouclier assez large** (renvoi p.298 → Atout d'arme **Protectrice**). `LDB 14 l.40`
2. **L'Esquive reste possible** contre un tir **uniquement si l'attaque est à bout portant** (renvoi p.297 → bande de portée Bout portant). `LDB 14 l.40`
3. **Il est impossible de tirer alors qu'on est _Engagé_**, *sauf* avec une arme à distance possédant l'Atout d'arme **Pistolet**. `LDB 14 l.43`
4. **Si le tireur est _Engagé_ avec sa cible** et qu'il utilise quand même sa Compétence Projectiles, **la cible peut s'opposer avec n'importe quelle Compétence de Corps à corps**. `LDB 14 l.53`

> « On ne peut pas leur opposer de Compétences de Corps à corps à moins de disposer d'un talent particulier ou d'un bouclier assez large (voir p.298). Il est néanmoins possible de leur opposer une Esquive si ces attaques sont à bout portant (voir p.297). » — `LDB 14 l.40`

> « Il est impossible d'effectuer une attaque à distance alors qu'on est _Engagé_, à moins que vous ne disposiez d'une arme à distance qui possède le trait d'arme Pistolet […]. » — `LDB 14 l.41`

> « Si vous utilisez votre Compétence Projectiles quand vous êtes _Engagé_ avec votre cible, cette dernière peut s'opposer à votre Attaque avec n'importe quelle Compétence Corps à corps. » — `LDB 14 l.44`

**Précisions des Atouts d'arme référencés** (Guide de l'équipement) :
- **Pistolet** : « Vous pouvez utiliser cette arme pour attaquer en Combat rapproché. » `LDB 62 l.284-285` — c'est cet Atout qui autorise un tir en étant Engagé / au contact.
- **Protectrice (Indice)** : en opposant une attaque on est considéré comme ayant *Indice* PA partout ; **si l'Indice est de 2 ou plus** (Protectrice 2 ou 3, soit le « bouclier assez large »), on peut **aussi opposer les projectiles tirés dans sa Ligne de Vue**. `LDB 62 l.295-296`

### Cible Sans Défense (succès automatique)

> « Les Tests de Capacité de Combat effectués pour frapper une cible endormie, inconsciente ou sans défense sont automatiquement des succès. » — `LDB 14 l.102`

Une cible **endormie, inconsciente ou sans défense** est touchée automatiquement (s'en référer à l'État _Inconscient_). Cela vaut pour les Tests de Capacité de Combat en général (Corps à corps comme tir).

### Option : Tirer Dans Un Combat au Corps À Corps (règle optionnelle, −20)

Règle optionnelle pour qui veut un traitement précis du tir sur une cible **déjà _Engagée_** avec un ou plusieurs alliés du tireur :

- Le Test de Capacité de Tir contre cet adversaire est résolu **comme d'habitude**, mais avec une **pénalité de −20** (parce qu'on s'applique à ne toucher que la cible désirée).
- **Si cette pénalité de −20 fait échouer le Test** alors qu'il aurait réussi sans elle, **on touche à la place l'un des adversaires de la cible**, déterminé au hasard par le MJ.
- Si l'on ne se soucie pas de savoir qui l'on touche, on peut renoncer à viser et gagner à la place un bonus de **+20 à +60** (voir *Tirer dans le tas*).

`LDB 14 l.126-129`

### Tirer Dans le Tas (bonus pour viser un groupe serré)

Tirer sur un **groupe de cibles** (sans chercher à en toucher une précise) facilite le Test de Projectiles selon la taille du groupe :

| Taille du groupe | Difficulté | Modificateur |
|---|---|---|
| 3 à 6 personnes | Accessible | +20 |
| 7 à 12 personnes | Facile | +40 |
| 13 personnes ou plus | Très Facile | +60 |

— `LDB 14 l.137-138` (cohérent avec la table « Difficulté de Combat », `LDB 14 l.71/86/89`)

Tout succès est **appliqué au hasard** parmi les cibles éligibles, à la discrétion du MJ. Si ce modificateur permet de toucher **alors que le Test aurait sinon échoué, on réussit avec 0 DR**. `LDB 14 l.138`

### Bandes de portée (modificateurs au toucher selon la distance)

La Difficulté d'un tir dépend de la **distance** rapportée à la **Portée moyenne** de l'arme. Extraits de la table « Difficulté de Combat » :

| Bande de portée | Distance | Difficulté | Modificateur |
|---|---|---|---|
| Bout portant | Portée ÷ 10 (voir p.297) | Facile | +40 *(et Esquive autorisée)* |
| Courte | jusqu'à la moitié de la portée | Accessible | +20 |
| Moyenne | jusqu'à la portée de l'arme | Intermédiaire | +0 |
| Longue | jusqu'à deux fois la portée | Complexe | −10 |
| Extrême | jusqu'à trois fois la portée | Très Difficile | −30 |

— `LDB 14 l.73/88/99/118` (Difficulté de Combat) ; calcul des fourchettes `LDB 62 l.198-206`
**Calcul des fourchettes de portée** : `LDB 62 l.198-206`
> « Bout portant = Portée ÷ 10 — Courte = Portée ÷ 2 — Longue = Portée × 2 — Extrême = Portée × [3] »

**Exemples de portées d'arme** (en mètres) :

| Arme | Bout portant | Courte | Moyenne | Longue | Extrême |
|---|---|---|---|---|---|
| Arbalète lourde | 10 | 50 | 100 | 200 | 300 |
| Arc | 5 | 25 | 50 | 100 | 150 |
| Fronde | 6 | 30 | 60 | 120 | 180 |
| Pistolet | 2 | 10 | 20 | 40 | 60 |

— `LDB 62 l.204-215`

### Taille de la cible (modificateur au tir)

La Taille de la cible visée modifie le tir (il est plus facile d'atteindre une porte de grange qu'une pomme). Si le modificateur de Taille permet de toucher alors que le Test aurait dû échouer, on **obtient un succès avec 0 DR**. `LDB 14 l.131`

| Taille | Hauteur ou longueur | Exemples | Mod. |
|---|---|---|---|
| Minuscule | Moins de 30 cm | Papillon, souris, pigeon | −30 |
| Très Petite | Jusqu'à 60 cm | Chat, faucon, bébé humain | −20 |
| Petite | Jusqu'à 1,20 m | Rat géant, halfling, enfant humain | −10 |
| Moyenne | Jusqu'à 2,10 m | Nain, elfe, humain | 0 |
| Grande | Jusqu'à 3,65 m | Cheval, ogre, troll | +20 |
| Énorme | Jusqu'à 6 m | Griffon, vouivre, manticore | +40 |
| Monstrueuse | + de 6 m | Dragon, géant, Prince démon | +60 |

— `LDB 14 l.118-131`

### Table « Difficulté de Combat » — lignes liées au tir (verbatim)

La table générale des modificateurs de Combat rassemble plusieurs lignes propres au tir. Extrait des entrées **de tir** :

| Difficulté | Mod. | Exemples de tir |
|---|---|---|
| Très Facile | +60 | Tirer sur une cible monstrueuse (Taille géant) ; Tirer dans une foule (13+ cibles) |
| Facile | +40 | Tirer sur une cible énorme (Taille griffon) ; Tirer sur un groupe important (7-12 cibles) ; Tirer sur une cible grande (Taille ogre) ; Tirer à Distance Courte, à moins de la moitié de la portée de l'arme |
| Accessible | +20 | Tirer sur un petit groupe (3-6 cibles) ; Tirer alors que vous avez passé votre dernière action à viser (pas de Test exigé pour viser) |
| Intermédiaire | +0 | Tirer sur une cible normale (Taille humain) |
| Complexe | −10 | Tirer à Distance Longue, jusqu'à deux fois la portée de l'arme ; Tirer pendant un Round où vous utilisez aussi votre Mouvement ; Tirer sur une petite cible (Taille enfant) ; un tir qui cherche à atteindre une Localisation particulière (sur un succès, vous touchez à l'endroit désiré) ; la cible du tir est dissimulée par le brouillard, la brume ou l'obscurité |
| Difficile | −20 | Tirer sur une cible très petite (Taille chat) |
| Très Difficile | −30 | Tirer sur une cible minuscule (Taille souris) ; Tirer à Distance Extrême, jusqu'à trois fois la portée de l'arme ; Tirer dans l'obscurité |

— `LDB 14 l.68-113` *(la table mêle Taille et bandes de portée ; ces deux facteurs ont chacun leur propre table dédiée ci-dessus, qui prime en cas de besoin de la valeur exacte)*

**Combiner les Difficultés** : si plusieurs pénalités s'additionnent, on plafonne à **Très Difficile −30** ; si plusieurs bonus s'additionnent, on plafonne à **Très Facile +60** ; pénalité + bonus se somment algébriquement. `LDB 14 l.120-124`

### Dispersion (armes de jet, sur échec)

Sur un **échec à un Test de Projectiles (Lancer)**, l'arme dévie : lancer 1d10. Un **1 à 8** indique une direction (lancer 2d10 pour la distance en mètres, sans dépasser la moitié de la distance entre le lanceur et la cible) ; un **9** = l'arme atterrit aux pieds du lanceur ; un **10** = aux pieds de la cible. La Dispersion sert chaque fois qu'une direction aléatoire est requise. `LDB 14 l.142-151`

**Sources RAW** :
- `LDB 13 l.114` — Prérequis d'un tir : arme à portée **et** cible dans la Ligne de Vue.
- `LDB 13 l.125` — Le tir est un **Test de Projectiles non opposé** ; succès = touche + 1 Avantage ; **le défenseur ne gagne aucun Avantage** en combat à distance.
- `LDB 13 l.133` / `l.146-153` — Localisation inversée + Tableau de Localisation (commun mêlée/tir).
- `LDB 14 l.40` — Pas d'opposition Corps à corps à un tir sauf **talent** ou **bouclier large** (Protectrice 2+, p.298) ; **Esquive autorisée seulement à Bout portant** (p.297).
- `LDB 14 l.43` — **Tir impossible si _Engagé_**, sauf arme à Atout **Pistolet**.
- `LDB 14 l.53` — Tireur **Engagé** utilisant Projectiles → la cible peut **s'opposer avec n'importe quelle Compétence de Corps à corps**.
- `LDB 14 l.126-129` — Option **Tirer Dans Un Combat au Corps À Corps** : **−20** pour viser une cible Engagée avec un allié ; si le −20 fait rater un Test sinon réussi → touche un adversaire au hasard de la cible ; sinon renoncer pour +20 à +60 (Tirer dans le tas).
- `LDB 14 l.131` — Taille de la cible : si le mod permet de toucher alors que le Test aurait raté → succès à **0 DR**.
- `LDB 14 l.135` — **Cible Sans Défense** (endormie/inconsciente/sans défense) : Test de Capacité de Combat = **succès automatique**.
- `LDB 14 l.137-138` — **Tirer Dans le Tas** : 3-6 → +20, 7-12 → +40, 13+ → +60 ; touche au hasard ; touche permise par le mod = **0 DR**.
- `LDB 14 l.118-131` — Table de **Taille** (Minuscule −30 … Monstrueuse +60).
- `LDB 14 l.68-113` — Table « Difficulté de Combat » (bandes de portée + Taille + couverture/météo).
- `LDB 14 l.120-124` — Combinaison des Difficultés (plafonds −30 / +60).
- `LDB 14 l.142-151` — Dispersion (armes de jet sur échec).
- `LDB 62 l.198-206` / `l.208-215` — Calcul des fourchettes de portée + exemples (Arc, Arbalète lourde, Fronde, Pistolet).
- `LDB 62 l.283-284` — Atout **Pistolet** (tirer en Combat rapproché → autorise le tir en étant Engagé).
- `LDB 62 l.295-296` — Atout **Protectrice (Indice)** : Indice 2+ permet d'**opposer les projectiles** dans la Ligne de Vue (le « bouclier large »).
- `LDB 16 l.113` — État Sans Défense/Inconscient : Test de Capacité de Combat automatiquement réussi contre une cible ainsi affectée.

**Voir aussi** : Tests opposés et Degrés de Réussite ; Localisation et Dégâts (étapes 2-4 de l'attaque) ; États (_Engagé_, _Inconscient_, _Surpris_, _À Terre_) ; Atouts et Défauts d'arme (Pistolet, Protectrice, Recharge) ; Portées et statistiques des armes à distance ; Psychologie (Peur −10 au tir).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 13` (l.114, l.125, l.133, l.137-145) → `localisation`, `useDefenseJetProps`, `AuContactModal`, `GrappleModal`, `useHoverTargeting`, `hitLocation`, `entityBlockedAt`, `useAttackJetProps`, `toucheSauvee`, `DisengageModal`, +29 — `src/data/actions.json`, `src/data/localisation.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/actions.ts`, `src/data/schemas/defs/localisation.ts`, +19 fichiers
- `LDB 14` (l.40, l.41, l.43, l.44, l.53, l.68-131, l.135, l.137-138, l.142-151) → `vous-vous-blessez-en-attaquant-perdez-1-blessure-ignore-be-pa`, `COVER_MOD`, `GrappleModal`, `SceneCombatMods`, `OupsMisfireEntry`, `arme-abimee-1-degat-vous-agirez-en-dernier-au-prochain-round`, `areGrappling`, `decorCover`, `woundsFromHit`, `fr`, +122 — `src/data/actions.json`, `src/data/grapple.json`, `src/data/index.ts`, `src/data/oups.json`, `src/data/oups.ts`, `src/data/props.json`, +50 fichiers
- `LDB 16` (l.113) → `unstable`, `etatNonCumulable`, `doc`, `jsonOpSchema`, `stopBleedOutcome`, `empileSurPionExistant`, `mouvementIntact`, `opRow`, `useAttackJetProps`, `toucheSauvee`, +34 — `src/data/etats.json`, `src/data/index.ts`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/etats.ts`, `src/data/schemas/defs/miscast.ts`, `src/engine/combat.ts`, +20 fichiers
- `LDB 62` (l.198-215, l.283-285, l.295-296) → `a-enroulement`, `a-poudre-noire`, `TraceRow`, `isShieldItem`, `a-repetition`, `protectrice`, `InitiativeStripProps`, `canActFirst`, `freeActFirst`, `doc`, +93 — `src/data/combat-stakes.json`, `src/data/etats.json`, `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/qualities.json`, `src/data/regles.json`, +29 fichiers

---

## Difficultés de combat, Taille et Supériorité numérique

Comme tous les Tests, les **Tests de Combat** (Corps à corps et Projectiles) peuvent être modifiés pour refléter le terrain, la météo et une foule d'autres facteurs. La **Difficulté par défaut d'un Combat est Intermédiaire (+0)** : si rien n'est précisé, on utilise Intermédiaire. Le MJ décide en dernier ressort de la Difficulté d'un Test ; les exemples ci-dessous servent de guide quand une situation n'est pas listée.

### Tableau des Difficultés de Combat

Chaque bande de Difficulté du système de jeu (de **Très Facile +60** à **Très Difficile −30**) regroupe des exemples précis de situations de combat. La table ci-dessous est reproduite intégralement, exemple par exemple.

| Difficulté | Modificateur | Exemples |
|---|---|---|
| **Très Facile** | **+60** | Tirer sur une cible monstrueuse (Taille géant). · Tirer dans une foule (13+ cibles). |
| **Facile** | **+40** | Tirer sur une cible à Distance Bout Portant. · Tirer sur une cible énorme (Taille griffon). · Attaquer en surnombre un adversaire, à 3 contre 1. · Tirer sur un groupe important (7-12 cibles). |
| **Accessible** | **+20** | Tirer sur une cible grande (Taille ogre). · Tirer à Distance Courte, à moins de la moitié de la portée de l'arme. · Tirer sur un petit groupe (3-6 cibles). · Tirer alors que vous avez passé votre dernière action à viser (pas de Test exigé pour viser). · Attaquer un adversaire _Engagé_ dans le dos ou sur les côtés. · Attaquer en surnombre un adversaire, à 2 contre 1. · Attaquer une cible _À Terre_. |
| **Intermédiaire** | **+0** | Une attaque standard. · Tirer sur une cible normale (Taille humain). |
| **Complexe** | **−10** | Attaquer alors que vous êtes _À Terre_ ou en-dessous de votre cible. · Attaquer alors que vous êtes dans la boue, sous la pluie battante ou sur un terrain difficile. · Tirer à Distance Longue, jusqu'à deux fois la portée de l'arme. · Tirer pendant un Round où vous utilisez aussi votre Mouvement. · Tirer sur une petite cible (Taille enfant). · La cible est sous couverture imparfaite (derrière une haie, par exemple). · Une attaque ou un tir qui cherche à atteindre une Localisation particulière. Sur un succès, vous touchez à l'endroit désiré. · Combat dans un espace clos avec une arme à l'Allonge Supérieure à Moyenne. |
| **Difficile** | **−20** | La cible du tir est dissimulée par le brouillard, la brume ou l'obscurité. · Attaquer sous la mousson, dans un ouragan, le blizzard ou toute autre condition climatique extrême. · Esquiver alors que vous êtes _À Terre_ ou sur une monture. · Attaquer avec votre main secondaire. · Combat rapproché dans le noir. · Tirer sur une cible très petite (Taille chat). · Cible protégée par une couverture moyenne (une barrière en bois, par exemple). · Attaquer ou esquiver dans une haute épaisseur de neige, dans l'eau ou sur tout autre terrain difficile. |
| **Très Difficile** | **−30** | Tirer sur une cible minuscule (Taille souris). · Tirer à Distance Extrême, jusqu'à trois fois la portée de l'arme. · Tirer dans l'obscurité. · Cible en couverture totale (derrière un mur de pierre, par exemple). |

> « Lors d'un Combat, les Difficultés sont supposées être au niveau **Intermédiaire (+0).** Donc, si rien n'est précisé, utilisez Intermédiaire. » — `LDB 13 l.118`

### Combiner les Difficultés

Quand plusieurs facteurs s'appliquent, on combine les modificateurs selon trois règles :

- **Plusieurs pénalités** : on fait la somme des malus, **sans dépasser Très Difficile −30**. Exemple : brouillard (Difficile −20 sur la cible dissimulée) + Localisation précise (−10) donne un Test qui resterait −30 (et non −40).
- **Plusieurs bonus** : on fait la somme des bonus **jusqu'à un maximum de +60 (Très Facile)**.
- **Mélange pénalité + bonus** : on les additionne pour obtenir la Difficulté nette. Exemple : attaquer dans la neige jusqu'à la taille (Très Difficile −30) un adversaire _À Terre_ (Facile +20 *— RAW dit « Facile (+20) » dans l'exemple ; la table classe « cible À Terre » en Accessible +20*) donne un Test à **−10** (« parce que **−30** plus **+20** font **−10** »).

> « Si la situation nécessite l'ajout de deux pénalités ou plus, contentez-vous de faire la somme des différents modificateurs sans dépasser **Très Difficile −30**. […] De la même façon, si la situation implique l'addition de deux bonus, faites la somme des modificateurs jusqu'à un maximum de **+60** ou **Très Facile**. » — `LDB 14 l.95`

#### Extension *L'Ennemi dans l'Ombre* — Difficultés extrêmes (option « Mais c'est impossible ! »)

La campagne *L'Ennemi Intérieur* « propose des situations particulièrement complexes ». Pour les modéliser, *L'Ennemi dans l'Ombre* (Tome 1) ajoute **deux niveaux de Difficulté supplémentaires** au-delà de Très Difficile −30, qui se greffent au Tableau de Difficulté standard du Livre de base. **Ces deux paliers s'appliquent explicitement aux Tests de combat** — l'exemple-type cité par le supplément est un Test de **Calme contre Terreur 3-5** (psychologie en combat). Cette règle est **optionnelle** ; si on ne souhaite pas l'utiliser, on remplace simplement Presque Impossible (−40) et Impossible (−50) par Très Difficile (−30) partout où la campagne les invoque.

| Difficulté | Modificateur du Test |
|---|---|
| **Presque Impossible** | **−40** |
| **Impossible** | **−50** |

Deux conséquences directes lorsqu'on active cette option :

- **Le plafond de combinaison des malus passe de −30 à −50.** Avec ces paliers, « −50 est désormais la pénalité maximale lors de la combinaison de Difficultés » — il remplace le plafond −30 de la règle *Combiner les Difficultés* ci-dessus (le plafond des bonus reste +60).
- **Échec et Réussite automatiques recommandés.** Le supplément recommande d'utiliser conjointement la règle d'Échec / Réussite automatiques : un jet de **01-05 reste toujours un succès avec +0 DR**, même si le modificateur du Test devait réduire les chances de réussite en dessous de 01-05 (sans quoi un Test Impossible −50 face à une Compétence faible pourrait devenir mathématiquement inatteignable). Voir le topic général sur les Difficultés des Tests pour la règle d'Échec / Réussite automatiques.

> « Pour tenir compte de cela, il utilise deux niveaux supplémentaires de Difficulté allant au-delà de celles présentées dans **WFJDR** […]. Cela signifie également que -50 est désormais la pénalité maximale lors de la combinaison de Difficultés […]. Si vous utilisez ces règles facultatives, il est recommandé de se servir également des règles d'Échec et de Réussite automatiques […]. Cela garantit qu'un jet de 01-05 remportera toujours un succès avec +0 DR, même si le modificateur du jet devrait réduire les chances de réussite en dessous de 01-05. » — `EDO 11 l.158-166`

> « Si vous ne souhaitez pas utiliser ces Difficultés extrêmes, remplacez simplement Presque Impossible (−40) et Impossible (−50) dans ce livre par Très Difficile (−30). » — `EDO 11 l.165`

### Taille — modificateur au toucher

La **Taille** de la cible modifie le tir : « il est bien plus facile d'atteindre la porte d'une grange qu'une pomme. » Le modificateur de Taille s'applique au **toucher**, et possède une propriété particulière : **si ce modificateur vous permet de toucher alors que le Test aurait dû être un échec, vous obtenez un succès avec 0 DR** (même règle que « Tirer dans le tas » et que les autres bonus d'aide à la visée).

| Taille | Hauteur ou Longueur | Exemples | Mod. |
|---|---|---|---|
| **Minuscule** | Moins de 30 cm | Papillon, souris, pigeon | **−30** |
| **Très Petite** | Jusqu'à 60 cm | Chat, faucon, bébé humain | **−20** |
| **Petite** | Jusqu'à 1,20 m | Rat géant, halfling, enfant humain | **−10** |
| **Moyenne** | Jusqu'à 2,10 m | Nain, elfe, humain | **0** |
| **Grande** | Jusqu'à 3,65 m | Cheval, ogre, troll | **+20** |
| **Énorme** | Jusqu'à 6 m | Griffon, vouivre, manticore | **+40** |
| **Monstrueuse** | + de 6 m | Dragon, géant, Prince démon | **+60** |

Ces modificateurs sont identiques à ceux listés dans le Tableau des Difficultés de Combat (cible monstrueuse +60, énorme +40, grande/ogre +20, normale/humain +0, petite/enfant −10, très petite/chat −20, minuscule/souris −30). La Taille standard implicite des espèces jouables (Nain, elfe, humain) est **Moyenne**.

### Cas spéciaux

- **Cible sans défense** : les Tests de Capacité de Combat effectués pour frapper une cible **endormie, inconsciente ou sans défense** sont **automatiquement des succès** (cf. État _Inconscient_).
- **Tirer dans le tas** : les Tests de **Capacité de Tir** pour toucher un groupe serré de cibles sont **Accessibles (+20)** pour 3 à 6 cibles, **Faciles (+40)** pour 7 à 12, **Très Faciles (+60)** pour 13 ou plus. Tout succès est appliqué au hasard parmi les cibles éligibles, à la discrétion du MJ. Si ce modificateur permet de toucher alors que le Test aurait sinon échoué, on réussit avec **0 DR**.

### Supériorité Numérique

En **Combat au Corps à corps**, surpasser un adversaire en nombre donne un bonus au toucher :

- **2 contre 1** → **+20** pour le toucher.
- **3 contre 1** → **+40** pour le toucher.

De plus, **à la fin de chaque Round, tous les adversaires surpassés en nombre perdent 1 Avantage**. La supériorité numérique est généralement déterminée par le nombre de Personnages _Engagés_ avec d'autres ; en cas de doute, le MJ tranche.

> « Si vous êtes en supériorité numérique sur un adversaire à 2 contre 1, vous gagnez un bonus de +20 pour le toucher en combat au Corps à corps. Si vous êtes à 3 contre 1, vous obtenez un bonus encore plus grand de +40 pour toucher. De plus, à la fin de chaque Round, tous les adversaires surpassés en nombre perdent 1 Avantage. » — `LDB 14 l.110`

L'application pratique est illustrée dans *Nuits agitées & dures journées* : trois gamins des rues attaquant le même Personnage **pendant le même Round** bénéficient des bonus de supériorité numérique selon les règles de combat normales.

> « Utilisez les règles de combat normales, toutes les attaques ayant lieu pendant le même Round et bénéficiant des bonus de supériorité numérique. » — `NADJ 06 l.148`

### Option : Tirer dans un combat au Corps à corps

Règle optionnelle pour le tir sur une cible déjà _Engagée_ avec un (ou des) allié(s) du tireur : le Test de Capacité de Tir est résolu normalement, mais subit une **pénalité de −20** (le tireur fait de son mieux pour ne toucher que la cible désirée). Si cette pénalité fait **échouer** un Test qui aurait réussi sans elle, le tir touche **l'un des adversaires de la cible**, déterminé au hasard par le MJ. Si le tireur n'a cure de qui il touche, il prend à la place le bonus « Tirer dans le tas » (+20 à +60).

**Note de couverture (autosuffisance)** : il n'existe pas de seconde « Table des Difficultés de Combat », ni de seconde « Table de Taille », ni de seconde règle « Combinaison des Difficultés » ou « Supériorité Numérique » à un emplacement distinct du livre — la matière inventoriée comme « LDB 13 » et « LDB 14 » est la **même section Combat**, scindée en deux fichiers `.md` (chapitre 13 = début de la section Combat avec la Difficulté par défaut Intermédiaire ; chapitre 14 = continuation de la section, qui porte le Tableau des Difficultés, le Tableau de Taille, Combiner les Difficultés, Tirer dans le tas, Cible Sans Défense et Supériorité Numérique). Les deux ne sont pas redondants : un seul jeu de tables. Les deux paliers extrêmes Presque Impossible (−40) / Impossible (−50) sont apportés **uniquement** par *L'Ennemi dans l'Ombre* (`EDO 11`), en option de campagne ; ils ne figurent pas dans le Tableau de Difficulté du Livre de base.

**Sources RAW** :
- `LDB 13 l.117-118` — « Difficulté Par Défaut D'un Combat » : Difficulté Intermédiaire (+0) supposée ; utiliser Intermédiaire si rien n'est précisé.
- `LDB 14 l.57-115` — « Difficultés de Combat » + Tableau **Difficulté de Combat** verbatim (les 7 bandes Très Facile +60 → Très Difficile −30, avec tous les exemples : tir par taille de cible, par taille de groupe, par bande de portée, viser, flanc/dos, À Terre, main secondaire, couverture, météo, obscurité, allonge supérieure, localisation précise).
- `LDB 14 l.119-124` — « Combiner les Difficultés » : somme des malus plafonnée à −30, somme des bonus plafonnée à +60, mélange = somme nette (exemple −30 + +20 = −10).
- `LDB 14 l.126-129` — Option « Tirer Dans Un Combat au Corps À Corps » : −20 au tir sur une cible Engagée avec un allié ; échec induit → touche un adversaire de la cible au hasard ; sinon « Tirer dans le tas » +20 à +60.
- `LDB 14 l.130-131` — « Taille » : modificateur de Taille au toucher pour le tir ; s'il fait toucher un Test sinon raté → succès à 0 DR.
- `LDB 14 l.133-138` — Cas spéciaux : « Cible Sans Défense » (succès auto contre endormi/inconscient/sans défense) ; « Tirer Dans le Tas » (3-6 → +20, 7-12 → +40, 13+ → +60, succès à 0 DR si le modificateur fait toucher).
- `LDB 14 l.139-140` — « Supériorité Numérique » : 2 c.1 = +20, 3 c.1 = +40 au toucher en Corps à corps ; fin de chaque Round, les adversaires surpassés perdent 1 Avantage ; comptage par nombre d'Engagés, MJ arbitre.
- `LDB 14 l.118-131` — Tableau **Taille** verbatim : Minuscule −30, Très Petite −20, Petite −10, Moyenne 0, Grande +20, Énorme +40, Monstrueuse +60 (avec fourchettes de hauteur/longueur et exemples).
- `EDO 11 l.157-165` — Option « Mais c'est impossible ! » : deux Difficultés extrêmes ajoutées au Tableau de Difficulté pour les situations de campagne (dont les Tests de combat type Calme vs Terreur 3-5) — Presque Impossible −40, Impossible −50 ; le plafond de combinaison des malus passe alors à −50 ; règles d'Échec / Réussite automatiques recommandées (01-05 = succès à +0 DR).
- `EDO 11 l.165` — Repli si l'option n'est pas utilisée : remplacer Presque Impossible (−40) et Impossible (−50) par Très Difficile (−30).
- `NADJ 06 l.148` — Application explicite de la supériorité numérique : trois gamins attaquant la même cible dans le même Round bénéficient des bonus de supériorité numérique des règles de combat normales.

**Voir aussi** : Difficultés des Tests (général) — bandes Très Facile +60 → Très Difficile −30, paliers extrêmes EDO −40/−50, Échec / Réussite automatiques (01-05) ; Localisation et calcul des dégâts en combat ; Portées des armes et bandes de distance ; Avantage en combat ; États (À Terre, Surpris, Inconscient) ; Combat monté ; Combat à deux armes (main secondaire −20) ; Psychologie en combat (Calme vs Terreur — cas-type des Difficultés extrêmes EDO).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 13` (l.117-118) → `localisation`, `useDefenseJetProps`, `AuContactModal`, `GrappleModal`, `useHoverTargeting`, `entityBlockedAt`, `toucheSauvee`, `useAttackJetProps`, `DisengageModal`, `cleFeuilleRamassee`, +22 — `src/data/actions.json`, `src/data/localisation.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/engine/combat.ts`, `src/gameIso/stage/useHoverTargeting.ts`, +15 fichiers
- `LDB 14` (l.57-115, l.118-131, l.133-138, l.139-140) → `COVER_MOD`, `SceneCombatMods`, `decorCover`, `woundsFromHit`, `fr`, `SANS_LIVRE`, `scatter`, `sceneCombatModifiers`, `doc`, `combat-deux-armes`, +78 — `src/data/actions.json`, `src/data/grapple.json`, `src/data/props.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs-scenes/scene.ts`, +37 fichiers
- `EDO 11` (l.157-166) → `gonflement`, `chair-necrosee`, `cretin`, `pattes-chevre`, `tete-bestiale-chien`, `digere`, `tete-pointue`, `absorption`, `amorphe`, `contagieux` — `src/data/etats.json`, `src/data/mutations.json`, `src/data/symptoms.json`, `src/data/traits.json`
- sans code : `NADJ 6` (l.148)

---

## Deux armes, Dispersion et Mains nues

Trois sous-systèmes de combat du Livre de Base WFRP4 (tous traités aux pages 164-165, fichier `LDB 14`), plus la table des **Armes de Bagarre** d'*Aux Armes* qui étend le combat à mains nues.

### Combat à Deux Armes — `LDB 14 l.134-140`

Certains guerriers combattent avec une arme dans chaque main (par exemple une épée et un brise-épée, ou une épée et un bouclier). Trois règles s'appliquent :

- **Armes autorisées** : on peut utiliser **n'importe quelle arme de combat rapproché à une main** ou **n'importe quel pistolet** quand on se bat à deux armes.
- **Main secondaire = −20** : on peut utiliser n'importe quelle main pour attaquer ; les attaques effectuées **avec la main secondaire subissent une pénalité de −20 sur tous les Tests applicables** (cf. la table *Difficulté de Combat*, qui liste « Attaquer avec votre main secondaire » à **Difficile −20**).
- **Attaquer avec les deux** : sans talent particulier, porter deux armes ne donne **pas** d'attaque supplémentaire — c'est seulement la possibilité de choisir librement sa main attaquante. Pour **attaquer avec les deux armes** dans le même Round, il faut posséder le talent **Maniement de deux armes** (renvoi au Chapitre 4 Compétences et Talents).

> « Vous pouvez utiliser n'importe quelle main pour effectuer une attaque. Les attaques effectuées avec votre main secondaire subissent une pénalité de -20 sur tous les Tests applicables. » — `LDB 14 l.139`

> « Si vous possédez le talent Maniement de deux armes, vous pouvez attaquer avec les deux armes. » — `LDB 14 l.140`

À noter : la table *Difficulté de Combat* (`LDB 14 l.102-103`) range « Esquiver alors que vous êtes À Terre ou sur une monture » **et** « Attaquer avec votre main secondaire » dans la même bande **Difficile −20** — c'est la source du −20 de main secondaire.

### Dispersion (armes de Lancer ratées) — `LDB 14 l.142-151`

Sur un **échec à un Test de Projectiles (Lancer)**, on lance **1d10** et on consulte le diagramme de Dispersion pour déterminer où l'arme atterrit. « T » désigne la cible.

| Résultat 1d10 | Où l'arme atterrit |
|---|---|
| 1 à 8 | Une **direction** (les huit cases autour de la cible, le « T » au centre) : lancez **2d10** pour la distance en **mètres** à laquelle l'arme arrive dans cette direction — **sans dépasser la moitié de la distance** entre vous et la cible. |
| 9 | L'arme atterrit **à vos pieds**. |
| 10 | L'arme atterrit **aux pieds de votre cible**. |

Diagramme (orientation des huit directions autour de la cible T, `LDB 14 l.146-149`) :

```
1   2   3
4   T   5
6   7   8
```

> « Un résultat de 1 à 8 vous indique une direction : lancez 2d10 pour déterminer la distance en mètres à laquelle l'arme arrive – sans dépasser la moitié de la distance entre vous et la cible. Un résultat de 9 indique que l'arme atterrit à vos pieds. Un résultat de 10 indique que c'est aux pieds de votre cible. La Dispersion peut être utilisée à chaque fois qu'une direction aléatoire est requise. » — `LDB 14 l.151`

La Dispersion est une mécanique générique : elle sert **chaque fois qu'une direction aléatoire est requise** (pas seulement les armes de Lancer).

### Combat à Mains Nues — `LDB 14 l.153-169`

Un **Test de Corps à corps (Bagarre)** réussi à mains nues se gère **exactement comme n'importe quel autre Test de Combat**, avec **une option supplémentaire : l'Empoignade**.

#### Empoignade — `LDB 14 l.159-169`

- **Déclaration** : au lieu d'infliger des Dégâts, on peut tenter d'**Empoigner et immobiliser** l'adversaire. Il faut **déclarer cette intention avant** le lancer pour toucher.
- **Mise en place** : si l'on remporte le Test opposé, **les deux combattants sont Empoignés** et l'adversaire gagne l'État **_Empêtré_**.
- **Au début d'un tour Empoigné** : on peut **briser l'Empoignade si l'on a un Avantage supérieur** à celui de l'adversaire (et l'on n'est alors **pas considéré comme _Engagé_** pour son Mouvement). Sinon, l'Action est un **Test opposé de Force**. Sur un **succès**, on choisit **une** des deux options :
  1. **Infliger BF + DR Dégâts**, en utilisant le **lancer de Force** pour déterminer la **Localisation** affectée. On **ignore tous les PA** (clefs de bras et torsion musculaire).
  2. **Soit** : (1) conférer l'État _Empêtré_ à l'adversaire, **ou** (2) se défaire de ce même État et **retirer un État _Empêtré_ supplémentaire par DR obtenu**.
- **Sur un échec** au Test opposé : on ne peut que se débattre et l'adversaire **gagne +1 Avantage**.
- **Intervention extérieure** : ceux qui ne sont pas partie prenante de l'Empoignade gagnent **+20 pour toucher** le Personnage Empoigné ayant le **plus faible** Avantage, et **+10** pour celui qui a l'Avantage **le plus élevé**.

> « Au lieu d'infliger des Dégâts suite à une attaque à mains nues, vous pouvez tenter d'Empoigner et d'immobiliser votre adversaire. Vous devez déclarer cette intention avant d'effectuer le lancer pour toucher votre adversaire. » — `LDB 14 l.159`

**Option : Empoignade Grâce aux Compétences** (`LDB 14 l.171-173`) — le MJ peut autoriser, en lieu et place du Test opposé de Force, un autre Test selon les circonstances : Langue (Magick) pour lancer un Sort, Charme pour se libérer par la flatterie, Commandement pour forcer l'autre à lâcher prise, etc. En cas d'échec, le MJ peut octroyer un État _Empêtré_ supplémentaire (on ne s'est pas concentré sur l'Empoignade).

#### Arme « Mains nues »

Les Mains nues sont l'arme par défaut de tout combattant désarmé. Profil (LDB Chapitre 11 / *Aux Armes*) : **+BF +0**, Allonge **Personnelle**, **Inoffensive**.

### Les Armes de Bagarre (extension *Aux Armes*) — `AA 08 l.224-261`

*Aux Armes* fournit une table d'armes de bagarre, dont beaucoup peuvent être bricolées à partir d'objets adéquats.

| Arme | Prix | Enc | Disponibilité | Allonge | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| Coup-de-poing | 2/6 | 0 | Commune | Personnelle | +BF +2 | – |
| Gaffe | 6/– | 0 | Commune | Courte | +BF +4 | Déstabilisante, Inoffensive |
| Gantelet à pointes | 2 CO | 1 | Limitée | Personnelle | +BF +3 | Déséquilibrée, Empaleuse |
| Gantelet verrouillé | 1 CO | 1 | Limitée | Personnelle | +BF +2 | Inoffensive |
| Lacet étrangleur (2M) | 1/– | 0 | Rare | Personnelle | +BF +2 | Déséquilibrée, Enchevêtrement, Inoffensive, Lente |
| Mains nues | N/A | 0 | – | Personnelle | +BF +0 | Inoffensive |
| Matraque | 1/– | 0 | Rare | Personnelle | +BF +1 | Assommante, Déséquilibrée, Inoffensive |

— `AA 08 l.244-256`

Notes mécaniques par arme (`AA 08 l.228-260`) :

- **Coup-de-poing** : pièces de métal enfilées sur les doigts ; improvisable. Fabrication : Test étendu de **Métier (Charpentier, Forgeron, Ingénieur, Tailleur ou Tanneur) Intermédiaire (+0)**, total **10 DR**, en lieu urbain.
- **Gaffe** : outil de docker ; arme efficace si maniée pour blesser.
- **Gantelet à pointes** : s'achète comme partie d'une armure de plates pour un bras (ajouter le prix du gantelet à celui de l'armure, mais ne compter que l'Encombrement de l'armure).
- **Gantelet verrouillé** : plaques d'acier sur le poing, maintenues fermées par vis/loquet. S'achète comme une armure de plates pour un bras (même règle d'Enc). Effet spécial : **son porteur ne lâche pas l'objet tenu dans cette main même quand les circonstances l'y obligeraient normalement** ; à la place il subit **−20 sur tous les Tests faits avec cet objet (y compris Corps à Corps) tant que durent ces circonstances (au minimum 1 Round)**. Si **un nouvel évènement** survient pendant cette période qui aurait à son tour dû forcer le lâcher, **l'objet est alors lâché** malgré le gantelet.
- **Lacet étrangleur** : cordage passé autour du cou et serré ; arme à deux mains (2M). Fabrication : Test étendu de **Métier (Cirier, Ingénieur, Tailleur ou Tanneur) Intermédiaire (+0)**, total **5 DR**.
- **Mains nues** : l'option par défaut (cf. ci-dessus).
- **Matraque** : gaine de cuir/tissu remplie de matière lourde. Fabrication : Test étendu de **Métier (Charpentier, Forgeron, Ingénieur, Tailleur ou Tanneur) Intermédiaire (+0)**, total **15 DR**.

**Sources RAW** :
- `LDB 14 l.134-140` — Combat à Deux Armes : armes 1 main / pistolets autorisées ; main secondaire **−20** sur tous les Tests applicables ; talent **Maniement de deux armes** requis pour attaquer avec les deux armes.
- `LDB 14 l.101-115` — table *Difficulté de Combat* : « Attaquer avec votre main secondaire » classé **Difficile (−20)** (source du malus de main secondaire).
- `LDB 14 l.142-151` — Dispersion : sur un échec à un Test de **Projectiles (Lancer)**, 1d10 → 1-8 direction (+ 2d10 m, ≤ moitié de la distance) ; 9 = à vos pieds ; 10 = aux pieds de la cible ; mécanique réutilisable pour toute direction aléatoire.
- `LDB 14 l.153-169` — Combat à Mains Nues : Corps à corps (Bagarre) comme un Test de combat normal + option **Empoignade** (déclarée avant le jet ; Test opposé → Empêtré mutuel ; tour suivant : briser si Avantage supérieur, sinon Test opposé de Force → BF+DR PA-ignorés OU gestion d'Empêtré ; échec → +1 Avantage à l'adversaire ; tiers : +20/+10 pour toucher l'Empoigné).
- `LDB 14 l.171-173` — Option : Empoignade Grâce aux Compétences (substitut au Test de Force selon le MJ).
- `AA 08 l.224-261` — Table des Armes de Bagarre (Coup-de-poing, Gaffe, Gantelet à pointes, Gantelet verrouillé, Lacet étrangleur, Mains nues, Matraque) + règle spéciale du **Gantelet verrouillé** (conserve l'objet, −20 transitoire) + coûts de fabrication par Métier.
- `LDB 10 l.773` — Talent **Maniement de deux armes** (prérequis pour attaquer avec les deux armes).

> « Un Personnage équipé d'un gantelet verrouillé ne lâche pas l'objet tenu dans cette main, même lorsque les circonstances l'y obligeraient normalement. Au lieu de cela, il subit une pénalité de -20 sur tous les Tests qu'il effectue avec cet objet, y compris les Tests de Corps à Corps, tant que les circonstances qui auraient dû lui faire lâcher l'objet persistent (et pendant un Round minimum). » — `AA 08 l.236`

**Voir aussi** : Maniement de deux armes (talent, LDB 10) ; Armes (Atouts/Défauts : Inoffensive, Déstabilisante, Empaleuse, Déséquilibrée, Assommante, Enchevêtrement) ; États (Empêtré, Engagé) ; Combat à distance (Projectiles/Lancer, portées) ; Désarmer (talent).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 10` (l.773) → `useAttackJetProps`, `PendingAttack`, `PendingDualStrike`, `dualAffordance`, `resolveDualSecond`, `defenseModifiers`, `dualStrikeTargets`, `SuiteDeCoup`, `GameState`, `Combatant`, +12 — `src/data/talents.json`, `src/engine/combat.ts`, `src/engine/types.ts`, `src/state/combat/roundHooks.ts`, `src/state/combatFlow.ts`, `src/state/combatSlice.ts`, +4 fichiers
- `LDB 14` (l.101-115, l.134-140, l.142-151, l.153-169, l.171-173) → `GrappleModal`, `areGrappling`, `woundsFromHit`, `fr`, `setGrapple`, `RunModal`, `isControlledMount`, `scatter`, `combat-deux-armes`, `combatOrder`, +92 — `src/data/grapple.json`, `src/data/index.ts`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/grapple.ts`, `src/data/schemas/defs/sizes.ts`, +40 fichiers
- `AA 8` (l.224-261) → `immobilisante-fixe`, `filet-leste`, `gantelet-verrouille`, `cape-2` — `src/data/qualities.json`, `src/data/trappings.json`

---

## Empoignade

L'**Empoignade** est l'option de combat qui permet, lors d'un **Combat à mains nues**, de saisir et d'immobiliser un adversaire au lieu de lui infliger des Dégâts. Elle ne se déclenche que dans le cadre d'un **Test de Corps à corps (Bagarre)** : un combat à mains nues réussi se gère exactement comme n'importe quel autre Test de Combat, mais ouvre cette option supplémentaire.

> « Certains combats dans **Warhammer Fantasy** n'impliquent ni armes à feu ni épées. De nombreux conflits se règlent avec les bons vieux coups de poing. Un Test de Corps à corps (Bagarre) réussi pour un combat à mains nues se gère exactement comme n'importe quel autre Test de Combat, mais vous disposez d'une option supplémentaire : vous pouvez prendre part à une Empoignade ! » — `LDB 14 l.155`

### Déclencher l'Empoignade

- Au lieu d'infliger des Dégâts à la suite d'une attaque à mains nues, vous pouvez tenter d'**Empoigner et d'immobiliser** votre adversaire.
- Vous devez **déclarer cette intention AVANT d'effectuer le lancer pour toucher** votre adversaire. (C'est une déclaration de Test opposé de Bagarre, comme tout combat de mêlée.)
- Si vous **remportez le Test opposé** : **vous et votre adversaire êtes Empoignés**, et **votre adversaire gagne l'État _Empêtré_**. (À ce stade, l'attaquant déclencheur ne reçoit pas lui-même d'État _Empêtré_ : seul l'adversaire l'obtient ; les deux personnages sont simplement « Empoignés », statut de fait lié l'un à l'autre.)

### Si vous commencez votre tour Empoigné

Au début de votre tour, alors que vous êtes Empoigné, deux voies s'offrent à vous :

1. **Briser l'Empoignade** — possible **si vous disposez d'un Avantage supérieur à celui de votre adversaire**. Dans ce cas, vous **n'êtes pas considéré comme _Engagé_** pour votre Mouvement.
2. **Sinon** — vous devez effectuer un **Test opposé de Force** pour votre Action.

Résolution du Test opposé de Force :

- **Sur un succès**, vous choisissez **une** des deux options suivantes :
  - **Infliger BF + DR Dégâts**, en utilisant votre **lancer de Force pour déterminer la Localisation affectée** (dé inversé). **Vous ignorez tous les PA** car vous ne faites qu'effectuer des clefs de bras tout en tirant sur les muscles.
  - **Soit** : (1) **Conférer l'État _Empêtré_** à votre adversaire, **ou** (2) **vous défaire de ce même État** et vous débarrasser d'**un État _Empêtré_ supplémentaire pour chaque DR obtenu**.
- **Sur un échec**, vous ne pouvez **rien faire d'autre que de vous débattre**, et **votre adversaire gagne +1 Avantage**.

### Spectateurs (tiers non impliqués)

Ceux qui ne sont **pas partie prenante** dans cette Empoignade gagnent un bonus au toucher contre les personnages enlacés :

| Cible | Bonus pour toucher |
|---|---|
| Personnage Empoigné avec le **plus faible Avantage** | **+20** |
| Personnage Empoigné avec **l'Avantage le plus important** | **+10** |

*— `LDB 14 l.169`*

### Option : Empoignade Grâce aux Compétences (règle optionnelle)

Si vous êtes Empoigné, le **MJ peut vous permettre de tenter un autre Test** qu'un Test opposé de Force, selon les circonstances, par exemple :

- **Langue (Magick)** pour lancer un Sort ;
- **Charme** afin de vous libérer par la flatterie ;
- **Commandement** afin de forcer l'autre à lâcher prise.

Tant que cela convient au MJ, on lance les dés et on voit ce qu'il advient. **Risque en cas d'échec** : comme vous ne vous serez pas concentré sur l'Empoignade, le **MJ peut vous octroyer un État _Empêtré_ supplémentaire**, ce qui peut rendre la situation bien plus compliquée.

### État _Empêtré_ (effet central de l'Empoignade)

L'Empoignade fonctionne entièrement via l'État _Empêtré_ infligé. Sa définition canonique :

> « Vous êtes gêné par quelque chose qui restreint votre déplacement ; cela peut être des cordes, une toile d'araignée, ou les biceps protubérants d'un adversaire. » — `LDB 16 l.62`

- **Au cours de votre tour, vous ne pouvez pas utiliser votre Mouvement**, et toute action qui implique un déplacement quelconque subit une **pénalité de -10** (dont l'Empoignade elle-même).
- Vous pouvez utiliser votre **Action** pour retirer l'État _Empêtré_ en réussissant un **Test opposé de Force contre la source de cet empêtrement**, et **chaque DR obtenu permet de retirer un État _Empêtré_ supplémentaire**.

**Sources RAW** :
- `LDB 14 l.153-155` — Combat À Mains Nues : un Test de Corps à corps (Bagarre) réussi à mains nues se gère comme tout Test de Combat, mais ouvre l'option Empoignade. (Note d'édition : le combat couvre les chapitres « 13 » et « 14 » du découpage ; tout le bloc Empoignade vit dans le fichier `14 - _GoBack.md` — le chapitre « 13 - Combat.md » n'en contient rien.)
- `LDB 14 l.159` — Empoignade : déclarée avant le lancer pour toucher ; victoire au Test opposé → les deux sont Empoignés et l'adversaire gagne l'État _Empêtré_.
- `LDB 14 l.161` — Début de tour Empoigné : briser si Avantage supérieur (et non considéré _Engagé_ pour le Mouvement) ; sinon Test opposé de Force pour l'Action.
- `LDB 14 l.163` — Succès option A : BF + DR Dégâts, lancer de Force = Localisation, ignore tous les PA (clefs de bras).
- `LDB 14 l.165` — Succès option B : conférer un _Empêtré_, ou se défaire de son _Empêtré_ + 1 par DR obtenu.
- `LDB 14 l.167` — Échec : se débattre seulement, l'adversaire gagne +1 Avantage.
- `LDB 14 l.169` — Spectateurs : +20 pour toucher l'Empoigné au plus faible Avantage, +10 pour l'autre.
- `LDB 14 l.171-173` — Option : Empoignade Grâce aux Compétences (Langue (Magick)/Charme/Commandement à discrétion du MJ ; échec → possible _Empêtré_ supplémentaire).
- `LDB 16 l.60-66` — État _Empêtré_ : pas de Mouvement, -10 aux actions de déplacement (dont l'Empoignade), retrait par Test opposé de Force (+1 par DR).

> « Au lieu d'infliger des Dégâts suite à une attaque à mains nues, vous pouvez tenter d'Empoigner et d'immobiliser votre adversaire. Vous devez déclarer cette intention avant d'effectuer le lancer pour toucher votre adversaire. » — `LDB 14 l.159`

> « Si vous commencez votre tour Empoigné, vous pouvez briser l'Empoignade si vous disposez d'un Avantage supérieur à celui de votre adversaire, et vous n'êtes pas considéré comme _Engagé_ pour votre Mouvement ; autrement, vous devez effectuer un Test opposé de **Force** pour votre Action » — `LDB 14 l.161`

> « Vous ignorez tous les PA car vous ne faites qu'effectuer des clefs de bras tout en tirant sur les muscles. » — `LDB 14 l.163`

**Voir aussi** : Combat à mains nues (Bagarre), État Empêtré, Avantage, Tests opposés et Degrés de Réussite (DR), Localisation (dé inversé), Combat monté, Trait Constriction.
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 14` (l.153-155, l.159, l.161, l.163, l.165, l.167, l.169, l.171-173) → `GrappleModal`, `areGrappling`, `setGrapple`, `RunModal`, `isControlledMount`, `scatter`, `combat-deux-armes`, `combatOrder`, `grappleTierMod`, `grapple`, +55 — `src/data/grapple.json`, `src/data/index.ts`, `src/data/regles.json`, `src/data/schemas/defs/grapple.ts`, `src/engine/combat.ts`, `src/engine/combatFeatures/dispatch.ts`, +25 fichiers
- `LDB 16` (l.60-66) → `combat-fatigue`, `doc`, `StateRecoveryModal`, `EnemyAction`, `addCondition`, `brise`, `Condition`, `aaBleedUnconsciousDue`, `describeStateRecovery`, `tileSeenByFoe`, +24 — `src/data/combat-stakes.json`, `src/data/etats.json`, `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/etats.ts`, +17 fichiers

---

## Combat Monté (règles de base)

Le **Combat monté** est un sous-système qui s'ajoute aux règles normales de Combat sans les remplacer : *« Le Combat monté utilise les mêmes règles que tout autre Combat, avec ces ajouts »* (LDB 14 l.177). Un cavalier et sa monture forment un **couple de deux combattants distincts** ; la monture est *« un autre combattant à part entière »* (l.182). Six ajouts s'appliquent. Tous les renvois de Taille ci-dessous utilisent les sept catégories du jeu (Minuscule → Monstrueuse, cf. ci-dessous), et la notion de « plus petit/plus grand » se mesure par écart de catégorie.

### Les six ajouts du Combat monté

**1. Mouvement de la monture (l.179).** *« on considère que le cavalier possède l'Attribut de Mouvement de sa monture. »* En outre, le cavalier doit effectuer un **Test de Chevaucher** pour tous les Tests de course, de saut ou similaires, et utilise le Mouvement de sa monture pour ces Tests.

**2. Bonus +20 au toucher (l.180).** *« Toute attaque effectuée par un Cavalier sur une cible plus petite que sa Monture se voit accorder un bonus de +20 au toucher. »* La condition porte sur la Taille de la **monture** (pas du cavalier), et le bonus s'applique à **toute** attaque (mêlée comme tir).

**3. Cibler le cavalier ou la monture (l.181).** Quand on attaque un Personnage qui est sur une monture, l'attaquant **choisit** de toucher soit le cavalier, soit la monture. *« Si vous êtes en combat rapproché, vous subissez une pénalité de -10 à vos Tests de Compétence d'Armes si vous ciblez le cavalier et que vous êtes plus petit que la monture. »* Cette pénalité de -10 est explicitement limitée au **combat rapproché** (mêlée) ; elle ne s'applique pas au tir.

**4. La monture peut agir (l.182).** *« Une monture sans le Trait Nerveux est un autre combattant à part entière, et peut effectuer sa propre Action pour attaquer les cibles Engagées. »* Une monture **possédant** le Trait Nerveux ne peut donc pas mener sa propre Action d'attaque (sauf entraînement la rendant insensible, cf. *Guerre/Magie* en aptitude des animaux).

**5. Charge — Force et Taille de la monture pour les Dégâts (l.183).** *« Lorsque vous Chargez, vous pouvez utiliser la Force et la règle de Taille de votre monture pour calculer les Dégâts. »* On substitue la **Force (Bonus de Force)** et la **catégorie de Taille** de la monture à celles du cavalier pour le calcul des Dégâts (le toucher reste la CC du cavalier). La « règle de Taille » désignée est *Modificateurs de Taille en combat* (LDB 85, transcrite ci-dessous).

**6. Esquive à cheval -20 (l.184).** *« Lorsque vous chevauchez, vous subissez une pénalité de -20 pour toute tentative d'utiliser la Compétence Esquive, sauf si vous possédez le Talent Acrobaties équestres. »*

### Talents liés (LDB 10)

- **Acrobaties équestres** (Maxi : Bonus d'Agilité ; Tests : Esquive à cheval, Chevaucher (Cheval)) : *« Vous pouvez utiliser n'importe laquelle de vos Compétences Représentation, et Esquive non modifiée, quand vous êtes à cheval. De plus, quand vous êtes en selle, vous pouvez effectuer votre Mouvement au début du Round au lieu de votre Tour. »* → annule la pénalité de -20 de l'ajout 6.
- **Cavalier émérite** (Maxi : Bonus d'Agilité ; Tests : Chevaucher (Cheval) pendant les combats) : *« En supposant que vous possédez la Compétence Chevaucher, vous pouvez directement demander à votre monture d'effectuer une Action, pas seulement un Mouvement, sans Test de Chevaucher. »*

### Trait Nerveux (LDB 85 l.248-249)

> « La créature est facilement effrayée par la magie ou les bruits forts. Si cela se produit, elle gagne +3 États *Brisé*. » — `LDB 85 l.249-250`

Aptitudes d'entraînement des animaux (LDB 85 l.110) qui neutralisent ce Trait : **Guerre** (l'animal gagne +10 en CC et ignore son Trait Nerveux pour les bruits forts) ; **Magie** (il ignore son Trait Nerveux en présence de magie — nécessaire à la plupart des chevaux de Sorciers).

### Table de Taille (utilisée par les ajouts 2, 3 et la charge)

| Taille | Hauteur ou Longueur | Exemples | Mod. |
|---|---|---|---|
| Minuscule | Moins de 30 cm | Papillon, souris, pigeon | -30 |
| Très Petite | Jusqu'à 60 cm | Chat, faucon, bébé humain | -20 |
| Petite | Jusqu'à 1,20 m | Rat géant, halfling, enfant humain | -10 |
| Moyenne | Jusqu'à 2,10 m | Nain, elfe, humain | 0 |
| Grande | Jusqu'à 3,65 m | Cheval, ogre, troll | +20 |
| Énorme | Jusqu'à 6 m | Griffon, vouivre, manticore | +40 |
| Monstrueuse | + de 6 m | Dragon, géant, Prince démon | +60 |

*(LDB 14 l.118-131 — le Mod. de la colonne est le modificateur de toucher lié à la Taille de la cible.)*

### Règle de Taille pour la Charge montée — Modificateurs de Taille en combat (LDB 85 l.357-362)

**Si la créature (ou la monture) est plus grande :**
- Ses armes gagnent l'Atout **Dévastatrice** si elle est d'une catégorie de Taille supérieure, et **Percutante** si elle est plus grande d'au moins deux catégories de Taille (LDB 85 l.360).
- On **multiplie les Dégâts** infligés par le nombre de catégories de Taille supérieures (2 catégories = ×2, 3 = ×3, etc.) ; cette multiplication est calculée **après** l'application des modificateurs (LDB 85 l.361).
- Toutes les frappes réussies activent la règle optionnelle **Frappe Mortelle** (même si la cible survit) (LDB 85 l.362).

**Sources RAW** :
- `LDB 14 l.175-177` — définition : le Combat monté = règles de Combat normales + 6 ajouts ; chevaucher confère un bonus au cavalier.
- `LDB 14 l.179` — Mouvement = celui de la monture ; Tests de Chevaucher pour course/saut/similaires.
- `LDB 14 l.180` — +20 au toucher pour le cavalier contre une cible plus petite que sa monture (toute attaque).
- `LDB 14 l.181` — choix cible (cavalier ou monture) ; -10 en mêlée pour viser le cavalier si l'attaquant est plus petit que la monture.
- `LDB 14 l.182` — la monture sans le Trait Nerveux est un combattant à part qui peut attaquer les cibles Engagées.
- `LDB 14 l.183` — Charge : Force et règle de Taille de la monture pour les Dégâts.
- `LDB 14 l.184` — Esquive à cheval : -20 sauf Talent Acrobaties équestres.
- `LDB 14 l.118-131` — table des sept catégories de Taille (référence des ajouts 2/3 et de la charge).
- `LDB 10 l.24-30` — Talent Acrobaties équestres (Esquive non modifiée à cheval + Mouvement en début de Round).
- `LDB 10 l.152-154` — Talent Cavalier émérite (faire agir la monture sans Test de Chevaucher).
- `LDB 85 l.248-249` — Trait Nerveux (+3 États Brisé sur magie/bruits forts).
- `LDB 85 l.110` — aptitudes Guerre/Magie qui font ignorer le Trait Nerveux.
- `LDB 85 l.357-362` — Modificateurs de Taille en combat (Dévastatrice/Percutante, multiplicateur de Dégâts ×N, Frappe Mortelle) = la « règle de Taille » de la charge montée.
- `LDB 14 l.187` — note : la plupart des montures ont un Trait de Taille différent des PJ → peuvent susciter Peur/Terreur et donner d'autres avantages en combat.

> « Une monture sans le Trait Nerveux est un autre combattant à part entière, et peut effectuer sa propre Action pour attaquer les cibles _Engagées_. » — `LDB 14 l.182`

> « Lorsque vous Chargez, vous pouvez utiliser la Force et la règle de Taille de votre monture pour calculer les Dégâts. » — `LDB 14 l.183`

**Voir aussi** : Charge et Mouvement (LDB 15) ; Taille des créatures et Frappe Mortelle (LDB 85) ; Talents de Chevaucher ; Peur et Terreur (Psychologie) ; Compétence Chevaucher.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 10` (l.24-30, l.152-154) → `talent-aleatoire`, `restoreFortune`, `acrobaties-equestres`, `affable`, `affinite-avec-les-animaux`, `ambidextre`, `ame-pure`, `artilleur`, `CrewContributor`, `artiste`, +30 — `src/data/actions.json`, `src/data/flow-stakes.json`, `src/data/talents.json`, `src/engine/careerSlots.ts`, `src/engine/combat.ts`, `src/engine/crewMorale.ts`, +3 fichiers
- `LDB 14` (l.118-131, l.175-177, l.179, l.180, l.181, l.182, l.183, l.184, l.187) → `advantageCapFor`, `woundsFromHit`, `RunModal`, `isControlledMount`, `combat-deux-armes`, `combatOrder`, `grappleTierMod`, `grapple`, `main-secondaire`, `effectiveSize`, +54 — `src/data/grapple.json`, `src/data/index.ts`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/grapple.ts`, `src/data/schemas/defs/sizes.ts`, +26 fichiers
- `LDB 85` (l.110, l.248-250, l.357-362) → `TraitDef`, `morsure`, `SIZE_LABEL`, `cannotStopOn`, `sizeDamageMultiplier`, `applySwarmBuild`, `sizeGrantedQualities`, `spawnMutations`, `doc`, `Condition`, +93 — `src/data/index.ts`, `src/data/maneuvers.json`, `src/data/qualities.json`, `src/data/regles.json`, `src/data/schemas/defs/traits.ts`, `src/data/traits.json`, +17 fichiers

---

## Avantage : gain, bénéfices et perte

L'**Avantage** représente votre **vitesse en combat** : il se gagne lorsqu'on se montre plus malin que ses adversaires, qu'on les domine ou qu'on les bat. Il se matérialise par des **jetons / pions / compteurs** (ou une simple note sur la feuille). Chaque combattant suit ses propres pions Avantage. La gestion est explicitement laissée à l'appréciation du MJ : les sources listées ci-dessous sont des exemples « loin d'être exhaustifs », et le MJ peut attribuer des pions selon les circonstances.

### Bénéfices — ce que rapporte chaque pion

Chaque pion d'Avantage ajoute **+10 à un Test de Combat ou de Psychologie approprié**. C'est cumulatif : 5 pions = **+50** à tous les Tests pour toucher, pour se défendre, et pour résister à l'influence des autres (Psychologie).

> « Chaque Avantage ajoute +10 à un Test de Combat ou de Psychologie appropriés (voir Psychologie à la page 190). De ce fait, si vous disposez de 5 pions Avantage, vous obtenez un impressionnant +50 à tous les Tests pour toucher, vous défendre, et résister à l'influence des autres. » — `LDB 14 l.215`

### Obtenir un Avantage — sources (`LDB 14 l.200-211`)

On gagne un Avantage à chaque fois qu'on **remporte un Test opposé en combat**, qu'on **attaque depuis une position conférant un avantage tactique**, ou qu'on est **plein d'espoir**. Exemples chiffrés (non exhaustifs) :

| Source | Avantage gagné | Renvoi |
|---|---|---|
| **Surprise** : attaquer un ennemi *Surpris* | **+1** | voir p.169 |
| **Charge** : charger tête la première en combat | **+1** | voir p.165 |
| **Évaluer** : utiliser une Compétence pour obtenir un avantage tactique | **+1** | descriptions des Compétences, ch.4 |
| **Victoire** : battre un PNJ important | **au moins +1** (jusqu'à **+2** pour soumettre la némésis d'un groupe) | — |
| **Gagnant** : remporter un Test opposé au cours d'un combat | **+1** | — |
| **Prendre le dessus** : blesser un opposant sans Engager de Test opposé | **+1** | — |

De nombreux **Talents** (ch.4) permettent aussi d'obtenir un Avantage.

### Perdre un Avantage — conditions (`LDB 14 l.217-221`)

- **Échec à un Test opposé en combat** → perte automatique de **TOUS** vos Avantages.
- **Perdre une Blessure** (subir des dégâts qui retirent au moins 1 PB) → perte automatique de **TOUS** vos Avantages.
- **Fin du combat** → tous les Avantages sont perdus.
- **Aucun Avantage gagné ce Round-ci** → perte de **1** Avantage.
- **Finir le Round en infériorité numérique** → perte de **1** Avantage.
- Un Avantage peut aussi être **sacrifié** (dépensé) pour **se désengager** d'un combat et s'enfuir (voir *Se désengager*, p.165).
- Certaines **Compétences et Talents** peuvent faire perdre un Avantage, ou le **transférer** à un autre Personnage.

> « Si vous échouez à un Test opposé au cours d'un combat, ou perdez une Blessure, vous perdez automatiquement tous vos Avantages. Vous perdez également vos avantages lorsque le combat s'arrête. Enfin, si vous n'avez pas gagné d'Avantage ce Round-ci, ou si vous finissez le Round en infériorité numérique, vous perdez 1 Avantage. » — `LDB 14 l.219`

### Règle optionnelle — Limiter les Avantages (`LDB 14 l.193-198`)

Pour un combat plus contrôlé (un Avantage pouvant renverser brusquement une bataille), deux plafonds optionnels au choix :

| Option | Plafond | Note |
|---|---|---|
| Plafond = Bonus d'Initiative | un Avantage ne peut dépasser le **BI** de chaque Personnage | plafond *par combattant* |
| Plafond fixe préétabli | **2, 4 ou plus** | « **10** fonctionne plutôt bien » (comptabilisable avec 1d10) |

### Avantage permanent — Trait *Redoutable* (Grim) (ZI)

Le Trait de créature **Redoutable** rend une créature « particulièrement dangereuse, si bien qu'il est presque impossible de réellement prendre le dessus sur elle ». **Si, au début de son tour, la créature n'a pas autant d'Avantages que son *Indice* de Redoutable le voudrait (par défaut, 1), elle gagne immédiatement tous les Avantages qui lui manquent.** Exceptions : si elle est sous l'effet d'un État ***Empêtré***, ***Inconscient*** ou ***Surpris***, elle **ne gagne pas** d'Avantage. Conséquence : un bonus de **+10 à la plupart des actions par niveau** de Redoutable, de façon quasi-permanente. Conseil d'usage : dépenser cet Avantage pour activer des **capacités spéciales** (Vomissement d'un troll, Souffle d'un dragon) plutôt que pour frapper plus fort — un monstre isolé encerclé peine de toute façon à générer de l'Avantage par lui-même. Garde-fou : si un monstre a plus de niveaux de Redoutable qu'il n'y a de Personnages, en diminuer ou supprimer le Trait.

### Avantage dans les jeux de taverne — Bras de fer (NADJ)

Le **Bras de fer** est un Test opposé **étendu** de **Force Intermédiaire (+0)** (à chaque tour, on ajoute son Bonus de Force au nombre de DR ; premier à atteindre **≥ 10 DR** = vainqueur ; tous les *BE* tours sans vainqueur → +1 État *Exténué*, récupérable après 5 min de repos). Mécaniquement, **le gagnant de chaque tour gagne +1 Avantage**, utilisable dans cette partie « en suivant les règles normales » d'Avantage — c'est-à-dire le même Avantage que celui du combat standard, +10 par pion.

**Sources RAW** :
- `LDB 14 l.189-191` — définition : l'Avantage = votre vitesse en combat ; obtenu en se montrant plus malin / en dominant / en battant ; représenté par jetons/compteurs/pions ou une feuille.
- `LDB 14 l.193-198` — règle optionnelle « Limiter les Avantages » : (1) ne peut dépasser le **Bonus d'Initiative** du Personnage ; (2) plafond fixe préétabli (2, 4 ou plus ; 10 conseillé, comptable au 1d10).
- `LDB 14 l.200-211` — « Obtenir Un Avantage » : Test opposé gagné / position tactique / plein d'espoir ; Surprise +1, Charge +1, Évaluer +1, Victoire (PNJ important au moins +1, némésis jusqu'à +2), Gagnant (Test opposé en combat) +1, Prendre le dessus (blesser sans Test opposé) +1 ; Talents nombreux.
- `LDB 14 l.213-215` — « Les bénéfices de l'Avantage » : **+10 par pion** à un Test de Combat ou de Psychologie approprié ; exemple 5 pions = +50 (toucher / se défendre / résister à l'influence).
- `LDB 14 l.217-221` — « Perdre Un Avantage » : Test opposé échoué OU perte d'une Blessure → tous perdus ; fin de combat → tous perdus ; aucun gagné ce Round OU infériorité numérique en fin de Round → −1 ; sacrifice possible pour se désengager ; Compétences/Talents peuvent en retirer ou transférer.
- `ZI 14 l.1016-1017` — Trait *Redoutable* : minimum d'Avantage permanent par Indice → +10/niveau à la plupart des actions ; recommandation d'usage = activer les capacités spéciales (Vomissement, Souffle) plutôt que frapper plus fort.
- `ZI 14 l.1024-1026` — précisions Redoutable : si le monstre a plus de niveaux que de Personnages, diminuer/supprimer ; **regain au début de son tour** jusqu'à l'Indice (défaut 1) ; **pas de gain** si *Empêtré*, *Inconscient* ou *Surpris*.
- `NADJ 16 l.34` — Bras de fer : Test opposé étendu de Force ; le gagnant de chaque tour gagne **+1 Avantage** utilisable selon les règles normales d'Avantage.

> « L'Avantage représente votre vitesse en combat, et vous l'acquérez lorsque vous vous montrez plus malin que vos adversaires, que vous les dominez ou les battez. » — `LDB 14 l.191`

> « Le gagnant de chaque tour gagne +1 Avantage, pouvant être utilisé dans le cadre de cette partie de bras de fer, en suivant les règles normales. » — `NADJ 16 l.34`

**Voir aussi** : Charge et déplacement en combat ; Se désengager (Esquive / Fuir) ; Surprise et embuscade ; Tests opposés et Degrés de Réussite ; Psychologie (Peur, Terreur, Calme) ; Traits de créature (Redoutable, Rage, Instable).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 14` (l.189-191, l.193-198, l.200-211, l.213-215, l.217-221) → `advantageCap`, `advantageCapFor`, `gainAdvantage`, `RunModal`, `isControlledMount`, `combat-deux-armes`, `combatOrder`, `grapple`, `main-secondaire`, `ADVANTAGE_COLLARS`, +41 — `src/data/grapple.json`, `src/data/index.ts`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/tavernGames.ts`, `src/engine/advantage.ts`, +20 fichiers
- `ZI 14` (l.1016-1017, l.1024-1026) → `fouissement` — `src/data/traits.json`
- `NADJ 16` (l.34) → `SequenceRoundOps`, `SequenceParams`, `alvatafl`, `SequenceVolleyRow`, `tavern-game`, `bete-tailleurs`, `SequenceSide`, `registerSequenceThrow`, `boules`, `sequenceRoundOps`, +6 — `src/data/combat-stakes.json`, `src/data/reglesOptionnelles.json`, `src/data/tavernGames.json`, `src/engine/sequenceVocab.ts`, `src/state/sequenceContract.ts`, `src/state/sequenceCore.ts`, +1 fichiers

---

## Déplacement en combat : Marche, Course, Charge, grille

En combat, chacun dispose à son tour d'un **Mouvement** (déplacement) **et** d'une **Action**. Le déplacement gratuit du tour est régi par la caractéristique **Mouvement** (M, valeur 0 à 10), qui se lit dans le **Tableau des Mouvements** ci-dessous : il donne, en mètres, la distance parcourue **sans avoir à effectuer un Test d'Athlétisme**. C'est le « Mouvement du Tour ». La **Course** et la **Charge** sont des emplois particuliers de ce Mouvement, détaillés plus bas.

### Représentation : théâtre de l'esprit ou grille

Le déplacement peut se gérer au « théâtre de l'esprit » (positions et distances décrites narrativement) ou sur **plan / grille** avec figurines. Si l'on emploie une grille, le livre recommande des cases de **3 cm d'arête, chaque case représentant 2 mètres** dans le jeu. Avec **Mouvement 4**, on se déplace donc de **4 cases** sur la carte. Les **créatures plus grandes peuvent occuper 2, 4 cases ou davantage** selon leur Trait **Taille** (voir le chapitre des créatures). Même sans grille, on conserve l'échelle **3 cm = 2 mètres**.

> « nous vous recommandons d'utiliser une grille dont les cases font 3 cm d'arête, chaque case représentant une distance de 2 mètres dans le jeu. Si vous avez Mouvement 4, vous pouvez vous déplacer de 4 cases sur la carte. » — `LDB 15 l.12`

### Tableau des Mouvements (verbatim)

Le Tableau du Mouvement indique la distance, en mètres, parcourue en un tour sans Test d'Athlétisme. **Marche** = distance du Mouvement du Tour ; **Course** = distance maximale en courant (= 2 × Marche).

| Mouvement | Marche (mètres) | Course (mètres) |
|---|---|---|
| 0 | 0 | 0 |
| 1 | 2 | 4 |
| 2 | 4 | 8 |
| 3 | 6 | 12 |
| 4 | 8 | 16 |
| 5 | 10 | 20 |
| 6 | 12 | 24 |
| 7 | 14 | 28 |
| 8 | 16 | 32 |
| 9 | 18 | 36 |
| 10 | 20 | 40 |

— `LDB 15 l.18-31`

On observe que **Marche = 2 × M mètres** (soit M cases) et **Course = 4 × M mètres** (soit 2 × M cases). La colonne Course n'est pas une Action de Course « pleine » mais le **Mouvement de Course** servant de base à la Course et à la Charge (voir ci-dessous).

### Course (Action + Test d'Athlétisme)

À son tour, on peut **utiliser son Action pour courir**. Cela exige un **Test d'Athlétisme Accessible (+20)**, et la distance couverte par la Course **vient s'ajouter** à celle déjà parcourue par le Mouvement du Round. On court sur une distance égale à son **Mouvement de Course + DR**, en mètres (DR = Degrés de Réussite, pouvant être négatif).

**Exemple du livre** : un Personnage avec Mouvement 4 (Course = 16 m) qui obtient **DR −2** pourra courir sur **14 mètres supplémentaires** (16 − 2 = 14).

> « Vous avez besoin d'un Test **d'Athlétisme Accessible (+20)**, et la distance couverte vient en plus de celle parcourue par votre Mouvement de ce Round. Vous pouvez courir sur une distance équivalente à votre Mouvement de Course + DR en mètres » — `LDB 15 l.41`

### Charge (condition, Action imposée, bonus d'Avantage)

**Condition** : on ne peut Charger que si l'on **n'est pas encore *Engagé*** en combat. On utilise alors son **Mouvement pour Charger**.

**Contrainte d'Action** : si l'on Charge, **l'Action doit obligatoirement être un Test de Corps à corps** pour attaquer un adversaire (on ne peut donc pas Charger puis faire une autre Action).

**Portée de la Charge** : elle utilise le **Mouvement de Course** du Tableau (2 × M cases / 4 × M mètres) pour atteindre l'adversaire.

**Bonus d'Avantage (+1)** : si l'adversaire se trouve, **avant la Charge, à une distance d'au moins votre caractéristique de Mouvement (en mètres)** — tout en restant dans la portée de Course — vous obtenez **+1 Avantage** en fonçant. Autrement dit, foncer de loin (au moins M mètres) octroie l'Avantage ; charger un ennemi quasi adjacent ne le donne pas. (Ce +1 Avantage est aussi listé parmi les sources d'Avantage : « **Charge :** charger tête la première en combat confère +1 Avantage. », `LDB 14 l.205`.)

> « Si votre adversaire se trouve au moins à une distance, en mètres, égale à votre caractéristique de Mouvement de votre Course avant votre Charge, mais toujours dans la portée de cette dernière […], vous obtenez également +1 Avantage en fonçant sur votre adversaire. » — `LDB 15 l.37`

### Repères de conversion (grille)

- 1 case = **2 mètres** (`LDB 15 l.12`).
- **Marche** = M cases (= 2M mètres).
- **Course / Charge** = 2M cases (= 4M mètres).
- Seuil de **+1 Avantage** de Charge : cible à **≥ M mètres** avant la charge (soit ≈ ⌈M/2⌉ cases), dans la portée de Course.

**Sources RAW** :
- `LDB 15 l.12` — Grille recommandée : case 3 cm = **2 mètres** ; Mouvement 4 = 4 cases ; les grandes créatures occupent 2, 4 cases ou plus selon le Trait Taille ; sans grille, conserver l'échelle 3 cm = 2 m.
- `LDB 15 l.16` — Le Tableau du Mouvement donne la distance en mètres parcourue par tour **sans** Test d'Athlétisme (« Mouvement du Tour »).
- `LDB 15 l.18-31` — **Tableau des Mouvements** complet : Mouvement 0→10, Marche 0→20 m, Course 0→40 m (Marche = 2M m, Course = 4M m).
- `LDB 15 l.35-37` — **Charge** : possible seulement si non encore *Engagé* ; Action imposée = Test de Corps à corps ; **+1 Avantage** si la cible était à ≥ M mètres avant la charge, dans la portée de Course.
- `LDB 14 l.205` — La Charge (« tête la première ») est listée parmi les sources d'**+1 Avantage**.
- `LDB 15 l.39-41` — **Course** : Action + **Test d'Athlétisme Accessible (+20)**, distance = **Mouvement de Course + DR** mètres (en plus du Mouvement du Round) ; exemple M4 / DR −2 → 14 m supplémentaires.

> « Si vous n'êtes pas encore *Engagé* en combat, vous pouvez utiliser votre Mouvement pour Charger. Si vous Chargez, votre action doit être un Test de Corps à corps pour attaquer un adversaire. » — `LDB 15 l.35`

> « À votre tour, vous pouvez utiliser votre Action pour courir. » — `LDB 15 l.41`

**Voir aussi** : Avantage (gain/perte, +10/pion) ; Désengagement (Avantage / Esquip-CC) ; Fuite (attaque gratuite, +20 dans le dos, Calme→Brisé) ; Escalade / Saut / Chute ; États (À Terre, Engagé) ; Poursuites (Distance d10) ; Charge montée et Taille de la monture.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 14` (l.205) → `advantageCap`, `advantageCapFor`, `ADVANTAGE_COLLARS`, `doc`, `TavernGame`, `combat-advantage-cap`, `combat-advantage-cap-bi`, `avantage`, `avantageSurLaCible`, `conditionModLines`, +1 — `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/tavernGames.ts`, `src/engine/advantage.ts`, `src/engine/combat.ts`, `src/engine/tavernGame.ts`, +2 fichiers
- `LDB 15` (l.12, l.16, l.18-31, l.35-37, l.39-41) → `METRES_PER_LEVEL`, `RunModal`, `reachTiles`, `hasMeaningfulOption`, `resolveRun`, `DisengageModal`, `charge`, `occupied`, `sizeFootprintSide`, `RuleId`, +48 — `src/data/actions.json`, `src/data/combat-stakes.json`, `src/data/flow-stakes.json`, `src/data/regles.json`, `src/data/schemas/defs-scenes/scene.ts`, `src/data/schemas/defs/sizes.ts`, +28 fichiers

---

## Désengagement et Fuite

Quand un combattant est **Engagé** en combat (à portée de Corps à corps d'un adversaire) et qu'il ne veut plus échanger de coups, il peut quitter le contact de deux manières « propres » (**Désengagement**) ou d'une manière risquée et souvent involontaire (**Fuite**). Ces règles vivent dans le chapitre Déplacement du Livre de base, sous les titres *Désengagement* et *Fuite*.

### Désengagement (quitter le combat en toute sécurité)

Si vous êtes Engagé et ne souhaitez plus combattre, vous disposez de **deux options** pour vous retirer sans danger :

**Option 1 — Utiliser l'Avantage.** Si vous disposez de **plus d'Avantages que votre adversaire**, vous êtes en position de supériorité et pouvez vous placer hors de portée. Si vous **choisissez de ramener votre Avantage à 0**, vous pouvez vous éloigner de votre adversaire **sans subir de pénalité** — par exemple Charger une autre cible, courir aussi loin que possible, ou reculer de quelques pas et tirer un coup de feu au visage de l'adversaire.

**Option 2 — Utiliser l'Esquive.** Si votre Avantage est **inférieur ou égal** à celui de votre adversaire et que vous ne souhaitez pas le dépenser, vous êtes **cloué sur place**. Pour vous enfuir, vous devez **utiliser votre Action** pour effectuer un **Test opposé d'Esquive / Corps à corps** :
- **Succès** : vous obtenez **+1 Avantage** et pouvez utiliser votre Mouvement pour aller où vous voulez en suivant les règles normales.
- **Échec** : votre adversaire gagne **+1 Avantage** et votre fuite est impossible — à moins de vous prendre un coup dans le dos (c.-à-d. de basculer en Fuite, ci-dessous).

> « si vous disposez de plus d'Avantages que votre adversaire […]. Si vous choisissez de ramener votre Avantage à 0, vous pouvez vous éloigner de votre adversaire sans subir de pénalités » — `LDB 15 l.47`

> « vous devez utiliser votre action pour effectuer un Test opposé d'Esquive/ Corps à corps. Sur un succès, vous obtenez +1 Avantage […]. Sur un échec, votre adversaire gagne +1 Avantage et votre fuite est impossible, à moins de vous prendre un coup dans le dos. » — `LDB 15 l.49`

| Désengagement | Condition d'usage | Coût | Réussite | Échec |
|---|---|---|---|---|
| **Utiliser l'Avantage** | Avantage > adversaire | Ramener son Avantage à **0** | Se déplace **librement** (sans pénalité) | — (automatique) |
| **Utiliser l'Esquive** | Avantage ≤ adversaire | Son **Action** (Test opposé Esquive / CC) | **+1 Avantage** + Mouvement libre | Adversaire **+1 Avantage**, fuite impossible |

*Réf. table : `LDB 15 l.47-49`.*

### Fuite (involontaire ou désespérée)

> « S'il n'y a pas d'autre solution, vous pouvez faire demi-tour et utiliser votre Mouvement pour fuir. Bien souvent, la Fuite est involontaire, et est provoquée par la Terreur (voir page 191) ou la magie. » — `LDB 15 l.61`

La **Fuite** consiste à faire demi-tour et à utiliser son Mouvement pour fuir. Elle est souvent **involontaire**, provoquée par la **Terreur** (LDB 21 l.54) ou la magie. Sa résolution, dans l'ordre :

1. **L'adversaire gagne immédiatement +1 Avantage** et **une Attaque gratuite**.
2. Cette attaque est un **Test de Corps à corps non opposé** ; le **DR sert à infliger les Dégâts** comme d'habitude. Comme vous lui tournez le dos, **l'adversaire bénéficie de +20 au toucher**.
3. **Si vous êtes touché** : l'adversaire gagne **+1 Avantage supplémentaire**, et vous devez effectuer un **Test de Calme Intermédiaire (+0)**. Sur un **échec**, vous obtenez l'**État Brisé**, plus **+1 Brisé par DR inférieur à 0**.
4. **Une fois ce coup gratuit résolu**, vous pouvez vous déplacer **jusqu'à la limite de votre Mouvement de Course** (cf. Tableau des Mouvements), dans la **direction opposée** à celle de votre adversaire — en partant du principe que vous en êtes encore capable.

> « Si vous fuyez, votre adversaire gagne immédiatement +1 Avantage et une Attaque gratuite. Cette attaque est un Test de Corps à corps non opposé, et le DR est utilisé pour vous infliger des Dégâts, comme d'habitude. […] votre adversaire bénéficie de +20 au toucher. Si vous êtes touché, votre adversaire gagne +1 Avantage, et vous devez effectuer un Test de Calme Intermédiaire (+0) : sur un échec, vous obtenez l'État Brisé, ainsi que +1 Brisé par DR inférieur à 0. » — `LDB 15 l.63-68`

> « Une fois que ce coup gratuit est résolu, vous pouvez vous déplacer jusqu'à la limite de votre Mouvement de Course (voir le Tableau des Mouvements) dans la direction opposée à celle de votre adversaire, en partant du principe que vous en êtes encore capable. » — `LDB 15 l.68`

**Séquence de Fuite (verbatim mécanique)** :

| Étape | Effet |
|---|---|
| 1. Décision de fuir | Adversaire **+1 Avantage** immédiatement + **1 Attaque gratuite** |
| 2. Attaque gratuite | Test de **CC non opposé**, **+20 au toucher** (dos tourné) ; DR → Dégâts comme d'habitude |
| 3. Si touché | Adversaire **+1 Avantage** (encore) + **Test de Calme Intermédiaire (+0)** |
| 3b. Échec du Calme | État **Brisé**, plus **+1 Brisé par DR < 0** |
| 4. Déplacement | Jusqu'à la **Course** (Mouvement de Course), **direction opposée** à l'adversaire |

*Réf. table : `LDB 15 l.63-68`.*

**Tableau des Mouvements** (pour la distance de Course du repli — Marche = 2×M, Course = 4×M) :

| Mouvement | Marche (mètres) | Course (mètres) |
|---|---|---|
| 0 | 0 | 0 |
| 1 | 2 | 4 |
| 2 | 4 | 8 |
| 3 | 6 | 12 |
| 4 | 8 | 16 |
| 5 | 10 | 20 |
| 6 | 12 | 24 |
| 7 | 14 | 28 |
| 8 | 16 | 32 |
| 9 | 18 | 36 |
| 10 | 20 | 40 |

*Réf. table : `LDB 15 l.18-31`.*

### Notes de cohérence

- Le **Désengagement par l'Esquive consomme l'Action** dans les deux issues (succès comme échec) : c'est une Action, pas un Mouvement gratuit.
- La **Fuite** déclenche d'abord la riposte gratuite (avec son éventuel Brisé) **avant** que le déplacement de Course ne soit autorisé ; le repli se fait toujours **loin** de l'adversaire (direction opposée).
- L'**État Brisé** infligé sur Fuite n'est pas plafonné par cette règle : on cumule **1 + (nombre de DR négatifs)** ; au-delà de ce seuil le combattant peut fuir le combat (cf. la fiche de l'État Brisé).

**Sources RAW** :
- `LDB 15 l.45-49` — *Désengagement* : conditions d'Engagement (p.159) ; option 1 « Utiliser l'Avantage » (Avantage > adversaire → ramener à 0 → se déplacer sans pénalité) ; option 2 « Utiliser l'Esquive » (Avantage ≤ adversaire → Action → Test opposé Esquive / Corps à corps ; succès = +1 Avantage + Mouvement libre ; échec = adversaire +1 Avantage, fuite impossible sauf coup dans le dos).
- `LDB 15 l.61-68` — *Fuite* : déclenchement (souvent involontaire, Terreur p.191 ou magie) ; adversaire +1 Avantage + Attaque gratuite ; Attaque = Test de CC non opposé, DR → Dégâts, **+20 au toucher** (dos tourné) ; si touché : +1 Avantage adversaire + Test de Calme Intermédiaire (+0) → échec = État Brisé + 1 Brisé par DR < 0 ; puis déplacement jusqu'à la **Course** dans la direction opposée à l'adversaire.
- `LDB 15 l.18-31` — *Tableau des Mouvements* : Marche = 2×Mouvement, Course = 4×Mouvement (sert à chiffrer la distance de repli après le coup gratuit).

**Voir aussi** : Avantage (combat) ; Engagement et portée de mêlée ; Test opposé et DR ; Compétence Esquive ; Psychologie — Terreur ; État Brisé ; Charge ; Course.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 15` (l.18-31, l.45-49, l.61-68) → `METRES_PER_LEVEL`, `ClimbPlan`, `planJump`, `RunModal`, `fall-choice`, `reachTiles`, `hasMeaningfulOption`, `resolveRun`, `DisengageModal`, `planClimb`, +82 — `src/data/actions.json`, `src/data/combat-stakes.json`, `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/regles.json`, `src/data/schemas/defs-scenes/scene.ts`, +35 fichiers
- `LDB 21` (l.54) → `nightmare`, `terreur`, `calme-d-approche`, `resolvePsychRow`, `endEncounterPsych`, `resolvePsychAI`, `humanizePerSL`, `amour`, `camaraderie`, `phobie`, +7 — `src/data/index.ts`, `src/data/night-stakes.json`, `src/data/psychology.json`, `src/data/regles.json`, `src/data/traits.json`, `src/engine/psychology.ts`, +4 fichiers

---

## Escalade, Saut et Chute

Règles de **Déplacement** (LDB 15) régissant l'escalade verticale, le saut horizontal et la chute. Toutes les distances du livre sont exprimées en **mètres** ; le jeu utilise une grille à **2 m/case**, donc les implémentations convertissent en cases (÷2).

### Escalade

> « La plupart des escalades n'ont pas besoin de Tests. Les règles ne s'appliquent que lorsqu'elle est difficile ou si la durée pendant laquelle vous allez devoir grimper est importante. » — `LDB 15 l.53`

Trois cas, du plus simple au plus exigeant :

| Situation | Test requis | Coût / vitesse |
|---|---|---|
| **Surface facile** (échelle ou équivalent) | Aucun Test | Vitesse **½** : il faut dépenser **4 m de Mouvement** pour gravir une échelle de **2 m** |
| **Surface facile, plus vite** | **Escalade Accessible (+20)** (consomme l'**Action**) | Distance supplémentaire = **Mouvement + DR** mètres (ex. M 4, DR +2 → +6 m) |
| **Surface verticale à prises** (deux mains libres) | **Escalade** (difficulté fixée par le MJ ; consomme l'**Action**) | Vitesse de montée ou de descente = **(½ Mouvement + DR)** mètres |

Certaines escalades sont **trop difficiles** pour un Personnage ne possédant pas le Talent **Grimpeur** (LDB 15 l.57, renvoi p.138).

### Saut

> « Vous pouvez sauter de votre valeur de Mouvement/3 en mètres sans avoir à effectuer de Test. » — `LDB 15 l.76`

- **Saut libre** (sans Test) : distance = **Mouvement / 3** mètres.
- **Sauter plus loin** : Test d'**Athlétisme**.
  - **Accessible (+20)** si l'on a une **course d'élan ≥ Mouvement** (en mètres) ;
  - **Intermédiaire (+0)** sinon (sans élan suffisant).
  - Sur un **succès** : chaque DR ajoute **30 cm** à la longueur du saut. Avec **DR 0**, on ne gagne que **15 cm** de plus.

Note (LDB 15 l.72) : dans la plupart des cas un simple Test d'**Athlétisme** (ou **Représentation (Acrobatie)**) suffit ; le calcul précis n'est utile que pour mesurer la hauteur/distance ou les conséquences d'une chute.

### Chute

> « Au cours d'une chute, vous subissez 3 Dégâts pour chaque mètre de chute +1d10 Dégâts. Ces Dégâts sont réduits par votre Bonus d'Endurance mais pas par les PA dont vous pouvez disposer. » — `LDB 15 l.80`

| Élément | Valeur |
|---|---|
| **Dégâts de chute** | **3 Dégâts / mètre + 1d10 Dégâts** |
| **Réduction** | par le **Bonus d'Endurance** uniquement (**les PA ne protègent PAS**) |
| **Saut délibéré / chute à dessein** | Test d'**Athlétisme Accessible (+20)** : chaque **DR** = **1 m de chute en moins** ; si la distance tombe à **0 ou moins** → **aucun Dégât** |
| **État À Terre** | si les **Points de Blessure perdus** dépassent le **Bonus d'Endurance** → État **À Terre** |

> « Si vous chutez à dessein – ou, si vous préférez, si vous sautez vers le bas – vous pouvez tenter un Test d'Athlétisme Accessible (+20) afin de réduire les Dégâts reçus. Pour chaque DR, considérez que vous tombez de 1m de moins. » — `LDB 15 l.82`

> « Si vous subissez plus de Points de Blessure à cause de la chute que votre Bonus d'Endurance, vous obtenez l'État À Terre. » — `LDB 15 l.84`

**Sources RAW** :
- `LDB 15 l.53-57` — Escalade : pas de Test si facile/courte ; échelle = vitesse ½ (4 m de Mouvement pour 2 m d'échelle) ; option Escalade Accessible (+20) sur l'Action → +Mouvement+DR mètres ; surface à prises avec deux mains libres = Action + Test Escalade, vitesse ½Mouvement+DR mètres ; Talent Grimpeur requis pour les surfaces difficiles.
- `LDB 15 l.72-76` — Saut : libre = Mouvement/3 mètres sans Test ; au-delà = Athlétisme Accessible (+20) avec élan ≥ Mouvement, Intermédiaire sinon ; +30 cm/DR sur succès (DR 0 = +15 cm).
- `LDB 15 l.80-84` — Chute : 3 Dégâts/mètre + 1d10, réduits par le Bonus d'Endurance mais pas par les PA ; chute à dessein = Athlétisme Accessible (+20), −1 m de chute/DR (0 m ou moins = aucun Dégât) ; Blessures perdues > Bonus d'Endurance → État À Terre.

**Voir aussi** : Mouvement & Course · Désengagement & Fuite · États (À Terre) · Athlétisme / Escalade (compétences) · Talent Grimpeur

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 15` (l.53-57, l.72-76, l.80-84) → `FallPlan`, `scene`, `ClimbPlan`, `FallModal`, `planJump`, `fall-choice`, `hasMeaningfulOption`, `DisengageModal`, `planClimb`, `fall-roll`, +77 — `src/data/actions.json`, `src/data/combat-stakes.json`, `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/regles.json`, `src/data/schemas/defs-scenes/effets.ts`, +32 fichiers

---

## Poursuite (procédure de base)

Les **poursuites** (course effrénée dans un marché bondé, chariot lancé à grande vitesse, fuite à cheval) se résolvent par une procédure abstraite en **4 étapes**, répétée chaque Round, fondée sur un Avantage chiffré appelé **Distance**. La Distance représente l'écart entre poursuivants et poursuivis : plus elle est grande, plus la proie a de l'avance.

### Procédure en 4 étapes

**1 : Déterminer la Distance** — Le MJ fixe la Distance de départ qui sépare les poursuivants des poursuivis. Échelle indicative :

| Distance de départ | Situation |
|---|---|
| 1 | Presque à portée |
| 4 | Avance confortable |
| 8 | Quasiment hors de portée au lancement de la poursuite |

*(LDB 15 l.90 — la plage couvre de 1 à 8 ; voir l'étape 4 pour les bornes de sortie 0 et 10+.)*

**2 : Test** — Tout participant à la poursuite (chaque poursuivant **et** chaque poursuivi) effectue un Test pour son Mouvement. La Compétence dépend des circonstances :

- **Conduite d'Attelages** (en chariot / attelage) ;
- **Chevaucher** (à monture) ;
- **Athlétisme** (à pied).

**3 : Actualiser la Distance** — On compare **le DR le plus PETIT obtenu par les poursuivis** au **DR le plus HAUT obtenu par les poursuivants**, puis :

- si **les poursuivis** l'emportent (leur plus petit DR > meilleur DR poursuivant) → la différence est **ajoutée** à la Distance (la proie creuse l'écart) ;
- si **les poursuivants** l'emportent → la différence est **retranchée** de la Distance (ils se rapprochent).

> Le côté poursuivi est tiré vers le bas par son membre **le plus lent** (DR le plus faible), tandis que le côté poursuivant est tiré vers le haut par son membre **le plus rapide** (DR le plus haut) : la poursuite avance au rythme du traînard chez les fuyards, mais le plus véloce des chasseurs suffit à rattraper.

**4 : Déterminer l'issue** — Selon la Distance résultante :

| Distance après actualisation | Issue |
|---|---|
| **0 ou moins** | Les poursuivants ont **rejoint** leur cible (voir « Sacrifier le plus lent ») |
| **1 à 9** | La poursuite **continue** : retour à l'étape 2 |
| **10 ou plus** | Les poursuivants ont **perdu** leur proie → la poursuite s'achève (« …pour le moment ! ») |

À la fin de chaque Round, il est important de **décrire** la scène de façon prenante : un large DR = les passants s'écartent et l'on gagne du terrain ; un DR négatif = on trébuche sur des caisses, on percute des passants, le chariot tape contre un mur, etc.

### Distance ≤ 0 : sacrifier le plus lent, ou affronter

Lorsque la Distance tombe **à 0 ou moins**, les poursuivants rejoignent les fuyards. Pour ce Round, les **poursuivis** ont alors le choix entre :

- **Sacrifier le plus lent d'entre eux** afin de ralentir les poursuivants et de poursuivre leur fuite ; ou
- **S'arrêter et les affronter** (la poursuite bascule en combat).

Si le plus lent est abandonné, ce sont **les poursuivants** qui décident **qui s'arrête** pour l'affronter et **qui continue** la poursuite. Si ce retardataire n'est pas une cible prioritaire, il peut être **purement et simplement ignoré** (les poursuivants continuent tous). Au Round suivant, la nouvelle Distance se recalcule à partir du **prochain** fuyard le plus lent — l'écart repart donc d'une petite valeur, comme le montre l'exemple canon (Distance 1 après l'abandon).

### Modificateurs de Mouvement (DR bonus selon l'écart de M)

Un participant dont la **Caractéristique de Mouvement (M)** est supérieure gagne **autant de DR bonus que la différence de Mouvement**, ajouté à son Test de poursuite.

| Écart de Mouvement (M) | DR bonus au Test de poursuite |
|---|---|
| +1 M (ex. M 5 contre M 4) | DR +1 |
| +2 M (ex. M 9 contre M 7) | DR +2 |
| +n M | DR +n |

*(LDB 15 l.106 ; l'exemple de Perdita l.146 montre une monture M 8 contre des montures adverses M 7 → DR +1 pour elle, et M 9 → DR +2 pour le second Bandit, le Bandit M 7 servant de référence à M 0 d'écart.)*

### Exemples canon

- **À pied (l.137-141)** : Eichengard et Sigrid poursuivent trois cultistes (Distance de départ **2**), Test d'**Athlétisme**. Sigrid DR 3, Eichengard DR 2 ; cultistes DR 0, DR 2, DR 2. Comparaison : plus petit DR poursuivi (0) vs plus haut DR poursuivant (Sigrid, 3) → écart 3 en faveur des poursuivants → Distance 2 − 3 = **−1** → rattrapés. Les cultistes **sacrifient le plus lent** ; Sigrid s'arrête pour lui. Au Round suivant, Distance = **1** (différence entre le prochain cultiste le plus lent et Sigrid au Round précédent) ; Eichengard n'a plus qu'à les battre de 1 DR pour rattraper.
- **À cheval (l.146)** : Perdita (cheval M 8) poursuit deux Bandits (montures M 7 et M 9), Tests de **Chevaucher (Cheval)**. Le Bandit M 7 teste sans modificateur, Perdita gagne **DR +1**, le Bandit M 9 gagne **DR +2**.

**Sources RAW** :
- `LDB 15 l.88` — cadrage : poursuites effrénées (marché bondé, chariot à grande vitesse) ; introduit la procédure.
- `LDB 15 l.90` — Étape 1 « Déterminer la Distance » : Avantage de départ nommé **Distance**, échelle 1 (presque à portée) / 4 (avance confortable) / 8 (quasiment hors de portée).
- `LDB 15 l.92` — Étape 2 « Test » : chaque participant teste son Mouvement via **Conduite d'Attelages**, **Chevaucher** ou **Athlétisme** selon les circonstances.
- `LDB 15 l.93` — Étape 3 « Actualiser la Distance » : DR le plus PETIT des poursuivis vs DR le plus HAUT des poursuivants ; différence ajoutée (poursuivis gagnants) ou retranchée (poursuivants gagnants).
- `LDB 15 l.94` — Étape 4 « Déterminer l'issue » : Distance ≤ 0 = rattrapés (sacrifier le plus lent OU affronter ; les poursuivants choisissent qui s'arrête / continue ; traînard non prioritaire = ignoré) ; Distance 10+ = proie perdue, poursuite finie ; Distance 1–9 = continue (retour étape 2).
- `LDB 15 l.96` — description narrative de fin de Round (large DR = terrain gagné ; DR négatif = obstacles).
- `LDB 15 l.98-102` — exemple à pied (Eichengard / Sigrid / cultistes, Distance 2, Athlétisme).
- `LDB 15 l.106` — « Modificateurs de Mouvement » : différence de M = autant de DR bonus (M 5 vs M 4 → DR +1).
- `LDB 15 l.108` — exemple à cheval (Perdita M 8 vs Bandits M 7 / M 9 → DR +1 et DR +2).
- `NADJ 06 l.150` — application en scénario (« Une journée au tribunal ») : gamins des rues fuyards, **Athlétisme 40**, Distance de départ **4** ; très à l'aise en milieu urbain (allées, passages entre bâtiments, trous dans les murs et clôtures).

> « On compare le DR le plus petit obtenu par les poursuivis au plus haut DR obtenu par les poursuivants, et la différence est ajoutée à la Distance si les poursuivis l'ont emporté et retranchée de cette même Distance si ce sont les poursuivants qui l'ont emporté. » — `LDB 15 l.93`

> « Les poursuivis ont alors la possibilité, pour ce Round, de sacrifier le plus lent d'entre eux afin de ralentir les poursuivants et de poursuivre leur fuite, ou ils peuvent s'arrêter et les affronter. […] Si le pauvre retardataire n'est pas une cible prioritaire, il se peut qu'il soit purement et simplement ignoré ! » — `LDB 15 l.94`

> « Si certains des Personnages participant à la poursuite possèdent un Mouvement supérieur, ils gagnent autant de DR bonus que la différence de Mouvement. » — `LDB 15 l.106`

**Voir aussi** : Désengagement et fuite (Attaque gratuite, +1 Avantage, Calme / Brisé) ; Mouvement & Course (Tableau des Mouvements, M en mètres) ; Saut et Chute ; Tests opposés & Degrés de Réussite (DR).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 15` (l.88, l.90, l.92, l.93, l.94, l.96, l.98-102, l.106, l.108) → `FallPlan`, `scene`, `assourdi`, `FallModal`, `fall-choice`, `planJump`, `fall-roll`, `a-terre`, `pursuitFoeSchema`, `PursuitFoeRef`, +36 — `src/data/actions.json`, `src/data/combat-stakes.json`, `src/data/etats.json`, `src/data/flow-stakes.json`, `src/data/regles.json`, `src/data/schemas/defs-scenes/effets.ts`, +20 fichiers
- sans code : `NADJ 6` (l.150)

---

## Encombrement et Surcharge

Tout objet pèse un nombre de **Points d'Encombrement** (abrégé **Enc**), en général entre 0 et 3, où **0** désigne un objet insignifiant facilement transportable et **3** quelque chose de difficile à soulever. Le nombre de Points d'Encombrement qu'un Personnage peut gérer **sans pénalité** est sa **capacité = Bonus de Force (BF) + Bonus d'Endurance (BE)**. Un humain moyen commence donc à gérer environ **6 Points d'Encombrement**.

**Capacité = BF + BE.** Au-delà de cette limite, le Personnage est **Surchargé** : il peut être ralenti et sera fatigué par le voyage. Les pénalités sont exprimées en **multiples de la capacité** (jusqu'au double, jusqu'au triple, au-delà). Tant que l'Enc porté reste ≤ capacité : **pas de pénalité**.

### Exemples d'Encombrement

| Enc | Possessions |
|---|---|
| 0 | Couteaux, pièces, bijoux |
| 1 | Épée, mandoline, besace |
| 2 | Épée longue, tente, sac à dos |
| 3 | Hallebarde, tonneau, grand sac |

*— `LDB 61 l.7-14`*

### Cas particuliers du calcul

- **Bêtes de Somme.** Les animaux de trait **ignorent la formule BF + BE**. Les Points d'Encombrement des mules, chevaux, charrettes et chariots sont listés dans **leurs descriptions**. Chaque **passager de taille humaine** est considéré comme valant **environ 10 Points d'Encombrement**, modifiable par le MJ si nécessaire.
- **Objets Portés.** Les objets portés (armures, vêtements, bijoux) voient leur Encombrement **diminuer de 1** — ils comptent donc souvent comme un **Encombrement de 0** une fois portés.
- **Objets Surdimensionnés.** Certains grands objets valent **4 Points d'Encombrement ou plus** (barils, fontes de selle). On ne peut **en principe transporter qu'un seul** objet surdimensionné, et cela nécessite **probablement les deux mains**.
- **Petits Objets.** Le bon sens dicte le nombre de petits objets transportables avant d'être Encombré. Indication approximative : la **monnaie vaut 1 Point d'Encombrement pour 200 pièces**.

### Surchargé — pénalités d'Encombrement

| Enc | Pénalité |
|---|---|
| Jusqu'à la limite | Pas de pénalité |
| Jusqu'au double de la limite | −1 Mouvement (min : 3), −10 en Agilité, +1 Fatigue du voyage |
| Jusqu'au triple de la limite | −2 Mouvement (min : 2), −20 en Agilité, +2 Fatigue du voyage |
| Plus de × 3 | Vous ne pouvez pas vous déplacer. |

*— `LDB 61 l.35-41`*

La réduction de Mouvement et la Fatigue du voyage dues à l'Encombrement **se cumulent avec toutes les pénalités d'Armure**.

### Surcharge et État Exténué

Chaque fois qu'un Personnage gagne un État **Exténué** **en étant Surchargé**, **pour une raison autre que la Surcharge**, il gagne **+1 État supplémentaire**.

### Encombrement et Attributs (pénalités immédiates)

Les **pénalités de Mouvement** dues à l'Encombrement sont **appliquées immédiatement** et ne peuvent être retirées **qu'en se débarrassant de l'Équipement**.

### Encombrement et Fatigue du Voyage

Les États **Exténué** dus à l'Encombrement sont **accumulés à la fin d'une journée de voyage** et ne peuvent être annulés **que grâce à un long repos**.

**Sources RAW** :
- `LDB 61 l.5` — Échelle d'Enc 0–3 ; **capacité sans pénalité = Bonus de Force + Bonus d'Endurance** ; humain moyen ≈ 6 Points d'Encombrement.
- `LDB 61 l.7-14` — Table « Exemples d'Encombrement » (Enc 0/1/2/3 → possessions), verbatim ci-dessus.
- `LDB 61 l.16-17` — Bêtes de Somme : ignorent BF+BE, Enc listé dans leur description ; passager humain ≈ 10 Enc (MJ modulable).
- `LDB 61 l.20-21` — Objets Portés : Encombrement **−1** (armure/vêtements/bijoux portés ⇒ souvent 0).
- `LDB 61 l.24-25` — Objets Surdimensionnés : **≥ 4 Enc** ; un seul transportable en principe, probablement les deux mains.
- `LDB 61 l.28-29` — Petits Objets : bon sens du MJ ; **monnaie = 1 Enc / 200 pièces**.
- `LDB 61 l.32-41` — « Surchargé » : cumul avec l'Armure ; **+1 Exténué** si on en gagne un en étant Surchargé pour autre raison ; table des paliers (×1 / ×2 / ×3 / >×3).
- `LDB 61 l.43-44` — Encombrement et Attributs : pénalités de Mouvement **immédiates**, retirées seulement en se délestant.
- `LDB 61 l.47-48` — Encombrement et Fatigue du Voyage : États Exténué accumulés **en fin de journée de voyage**, annulables seulement par un **long repos**.

> « Le nombre de Points d'Encombrement que vous pouvez gérer sans pénalité est déterminé par votre Bonus de Force + votre Bonus d'Endurance. » — `LDB 61 l.5`

> « la monnaie vaut 1 Point d'Encombrement pour 200 pièces. » — `LDB 61 l.29`

> « chaque fois que vous gagnez un État _Exténué_ en étant Surchargé, pour une raison autre que la Surcharge, gagnez +1 État supplémentaire. » — `LDB 61 l.33`

> « Des pénalités de Mouvement pour l'Encombrement sont appliquées immédiatement et peuvent seulement être retirées en se débarrassant de l'Équipement. » — `LDB 61 l.44`

**Note de référencement** : ce chapitre est **LDB 61 — « Encombrement »** (le chapitre 62 du livre est « Les armes »). La table « Exemples d'Encombrement » et toutes les règles ci-dessus vivent dans `61 - Encombrement.md`.

**Voir aussi** : Fatigue du voyage et marche forcée ; États (Exténué) ; Armures (pénalités d'Armure cumulables) ; Fabrication (qualités Léger −1 / Volumineux +1) ; Bêtes de Somme et véhicules.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 61` (l.5, l.7-14, l.16-17, l.20-21, l.24-25, l.28-29, l.32-41, l.43-44, l.47-48) → `encombrement`, `tier-0`, `tier-1`, `ENCUMBRANCE_TIERS`, `tier-2`, `tier-3`, `CarrierHull`, `applyTravelFatigue`, `defenseValueMods`, `itemsEncumbrance`, +3 — `src/data/encumbranceTiers.json`, `src/data/regles.json`, `src/data/schemas/defs/encumbranceTiers.ts`, `src/engine/bourse.ts`, `src/engine/cargo.ts`, `src/engine/combat.ts`, +7 fichiers

---

## Armes de corps à corps (LDB) : groupes et tables

Cette entrée transcrit le bloc **Armes de Corps à Corps** du chapitre *Les armes* (LDB 62), avec son schéma de présentation, les **huit tables de groupe** (Armes d'hast, Bagarre, Base, Cavalerie, Deux-mains, Escrime, Fléau, Parade), et les **règles spéciales de groupe** (sous-système des Groupes d'armes, Cavalerie, Fléau, Parade) ainsi que les définitions afférentes (Arme simple, lance de cavalerie hors charge). Elle ajoute aussi deux apports de *Nuits agitées & dures journées* (NADJ) qui n'apparaissaient nulle part : les **Griffes de Tigre** (arme de Bagarre, profil de Dague) et le profil de combat du **Duel Judiciaire** (jugement par combat). Tout est *verbatim* depuis ses sources. L'abréviation **BF** = Bonus de Force. **(2M)** signale une arme à deux mains.

### Schéma de présentation d'une arme

Chaque arme est décrite par sept champs (LDB 62 l.7-15) :

- **Groupe d'armes** : chaque arme est classée par son Groupe d'armes. Si une arme est à deux mains, elle est indiquée **(2M)**.
- **Prix** : le prix pour un modèle standard de l'arme.
- **Enc** : l'Encombrement de l'arme.
- **Disponibilité** : la Disponibilité de l'arme.
- **Allonge/Portée** : la longueur de l'Arme (corps à corps) ou la portée en mètres (distance).
- **Dégâts** : les Dégâts de l'Arme, **ajoutés à votre DR pour toucher**.
- **Atouts et Défauts** : tous ses Atouts ou Défauts d'arme.

> « Le Bonus de Force est abrégé en BF dans les Tableaux des armes. » — `LDB 62 l.15`

> « **Dégâts :** les Dégâts de l'Arme, ajoutés à votre DR pour toucher. » — `LDB 62 l.12`

### Tables des Armes de Corps à Corps (par groupe)

> Note de lecture : la colonne **Allonge** désigne le palier d'Allonge d'arme (Personnelle / Très courte / Courte / Moyenne / Longue / Très longue / Considérable — voir l'entrée *Allonge d'arme et portée*). Les Dégâts en `+BF +N` ajoutent le Bonus de Force au modificateur indiqué.

#### Groupe — ARMES D'HAST

| Arme | Prix | Enc | Disponibilité | Allonge | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| (2M) Bâton de combat | 3/– | 2 | Commune | Longue | +BF +4 | Assommante, Défensive |
| (2M) Hallebarde | 2 CO | 3 | Commune | Longue | +BF +4 | Défensive, Taille, Empaleuse |
| (2M) Lance | 15/– | 2 | Commune | Très longue | +BF +4 | Empaleuse |
| (2M) Pique | 18/– | 4 | Rare | Considérable | +BF +4 | Empaleuse |

— `LDB 62 l.21-25`

#### Groupe — BAGARRE

| Arme | Prix | Enc | Disponibilité | Allonge | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| Mains nues | ND | 0 | – | Personnelle | +BF +0 | Inoffensive |
| Coup-de-poing | 2/6 | 0 | Commune | Personnelle | +BF +2 | – |
| Griffes de Tigre † | ND | 0 | – | Très courte | +BF +2 | – |

— `LDB 62 l.26-28` ; ligne Griffes de Tigre : `NADJ 11 l.20` (voir § dédié).

† **Griffes de Tigre** (NADJ) — gantelets renforcés à quatre lames saillantes. Même profil qu'une **Dague** (`LDB 62` : Enc 0, Très courte, +BF +2, sans Atout ni Défaut) **mais** elles s'utilisent avec la Compétence *Corps à corps (Bagarre)* et non *Corps à corps (Base)*. Sur un Test réussi de *Corps à corps (Bagarre)*, la blessure occasionnée peut sembler avoir été provoquée par un gros chat ou un autre animal similaire. Voir la sous-section *Griffes de Tigre* plus bas.

#### Groupe — BASE

| Arme | Prix | Enc | Disponibilité | Allonge | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| Arme improvisée | ND | Variable | ND | Variable | +BF +1 | Inoffensive |
| Arme simple | 1 CO | 1 | Commune | Moyenne | +BF +4 | – |
| Bouclier | 2 CO | 1 | Commune | Très courte | +BF +2 | Protectrice 2, Défensive, Inoffensive |
| Bouclier (Grand) | 3 CO | 3 | Commune | Très courte | +BF +3 | Protectrice 3, Défensive, Inoffensive |
| Bouclier (Targe) | 18/2 | 0 | Commune | Personnelle | +BF +1 | Protectrice 1, Défensive, Inoffensive |
| Couteau | 8/– | 0 | Commune | Très courte | +BF +1 | Inoffensive |
| Dague | 16/– | 0 | Commune | Très courte | +BF +2 | – |

— `LDB 62 l.29-37`

#### Groupe — CAVALERIE

| Arme | Prix | Enc | Disponibilité | Allonge | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| Lance de cavalerie | 1 CO | 3 | Rare | Très longue | +BF +6* | Empaleuse, Percutante |
| (2M) Marteau à bec-de-corbin | 3 CO | 3 | Limitée | Longue | +BF +5 | Assommante |

— `LDB 62 l.38-40`

\* Les Lances de cavalerie sont considérées comme des **Armes improvisées** si vous les utilisez lors d'un Round où vous n'avez pas Chargé (`LDB 62 l.58`).

#### Groupe — DEUX-MAINS

| Arme | Prix | Enc | Disponibilité | Allonge | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| (2M) Épée bâtarde | 8 CO | 3 | Limitée | Longue | +BF +5 | Dévastatrice, Défensive |
| (2M) Grande hache | 4 CO | 3 | Limitée | Longue | +BF +6 | Épuisante, Percutante, Taille |
| (2M) Marteau de guerre | 3 CO | 3 | Commune | Moyenne | +BF +6 | Assommante, Dévastatrice, Lente |
| (2M) Pioche | 9/– | 3 | Commune | Moyenne | +BF +5 | Dévastatrice, Empaleuse, Lente |
| (2M) Zweihänder | 10 CO | 3 | Limitée | Longue | +BF +5 | Dévastatrice, Taille |

— `LDB 62 l.41-46`

#### Groupe — ESCRIME

| Arme | Prix | Enc | Disponibilité | Allonge | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| Fleuret | 5 CO | 1 | Limitée | Moyenne | +BF +3 | Rapide, Empaleuse, Pointue, Inoffensive |
| Rapière | 5 CO | 1 | Limitée | Longue | +BF +4 | Rapide, Empaleuse |

— `LDB 62 l.47-49`

#### Groupe — FLÉAU

| Arme | Prix | Enc | Disponibilité | Allonge | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| Fléau | 2 CO | 1 | Limitée | Moyenne | +BF +5 | Perturbante, À Enroulement |
| Fléau à grain | 10/– | 1 | Commune | Moyenne | +BF +3 | Perturbante, Imprécise, À Enroulement |
| (2M) Fléau d'armes | 3 CO | 2 | Rare | Longue | +BF +6 | Perturbante, Percutante, Épuisante, À Enroulement |

— `LDB 62 l.50-54`

#### Groupe — PARADE

| Arme | Prix | Enc | Disponibilité | Allonge | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| Brise-épée | 1 CO 2/6 | 1 | Limitée | Courte | +BF +3 | Défensive, Piège-lame |
| Main gauche | 1 CO | 0 | Rare | Très courte | +BF +2 | Défensive |

— `LDB 62 l.55-57`

### Sous-section — Griffes de Tigre (NADJ)

Apparues dans l'aventure *Le Mariage de Nastassia* (NADJ) : des espions de l'Ind (« agents Marqués ») sont entraînés à combattre aux **Griffes de Tigre**, décrites comme « des gants renforcés munis de quatre lames saillantes ». Profil et règle additionnelle, *verbatim* :

> « Elles possèdent les mêmes caractéristiques qu'une Dague mais leur utilisation se base sur la Compétence Corps à corps (Bagarre) avec les règles additionnelles suivantes : sur un Test réussi de Corps à corps (Bagarre), la blessure occasionnée peut sembler avoir été provoquée par un gros chat ou un autre animal similaire. » — `NADJ 11 l.20`

Conséquences de jeu :
- **Profil hérité de la Dague** (`LDB 62 l.37`) : Enc 0, Allonge Très courte, Dégâts +BF +2, **aucun Atout ni Défaut**.
- **Groupe d'armes = Bagarre** (et non Base) : on les utilise avec *Corps à corps (Bagarre)*. Sans cette Augmentation, c'est le sous-système des Groupes qui s'applique (Test sur Caractéristique brute ; ici, l'arme n'ayant ni Atout ni Défaut, seule la valeur change).
- **Effet narratif** : sur une touche réussie, la plaie peut être attribuée à un gros félin — utile pour maquiller un assassinat. C'est un effet de fiction, sans mécanique chiffrée.
- Les *Marqués* portent par ailleurs le Trait *Arme (Griffes de Tigre) +5* dans leur statbloc (`NADJ 11 l.23-32`), distinct du profil d'arme transportable ci-dessus.

### Règle — Arme simple (définition générique)

> « Le terme « Arme simple » est utilisé pour décrire un certain nombre d'armes de base qui, bien que différentes, sont considérées comme étant effectivement les mêmes pour le jeu, y compris les épées, les haches, les marteaux, les masses, les lances courtes etc. » — `LDB 62 l.127`

L'**Arme simple** (groupe Base) sert donc d'archétype unique (1 CO, Enc 1, Commune, Allonge Moyenne, +BF +4, aucun Atout ni Défaut) pour toute épée/hache/marteau/masse/lance courte standard.

### Règle — Dégâts d'arme et passage en Arme improvisée

Certaines Maladresses (LDB 14 p.160) ou Sorts peuvent endommager une arme. **Pour chaque point de Dégâts reçu, réduisez ses Dégâts de 1.** Si les Dégâts sont réduits à **+0 (ou BF +0)**, l'arme est tellement abîmée qu'elle n'est plus identifiable et devient une **Arme improvisée**. Si une Arme improvisée est endommagée, elle est inutile au Corps à corps. Réparation par un artisan : **10 % du coût de l'arme par point de Dégâts** subi ; les armes réduites à l'état d'Armes improvisées ne peuvent pas être réparées. On peut rafistoler ses propres armes avec la Compétence Métier, des Outils de Profession et un Atelier (pour plus d'un seul point) (`LDB 62 l.133-136`).

### Sous-système — Groupes d'armes de Corps à corps (Compétences distinctes)

Toutes les armes de Corps à corps sont assignées à un Groupe d'armes, et **chaque Groupe nécessite une Compétence distincte** : *Corps à corps (Fléau)* permet d'utiliser des Fléaux et est distincte de *Corps à corps (Arme d'hast)*, etc. Si vous utilisez une arme d'un Groupe pour lequel vous **n'avez pas d'Augmentation**, vous effectuez un Test de *Corps à corps* (Caractéristique brute) pour toucher : vous subissez **tous les Défauts** de l'arme mais ne pouvez utiliser **aucun de ses Atouts**. Certains Groupes ont aussi des règles spéciales (`LDB 62 l.138-139`).

> « Si vous utilisez une arme issue d'un Groupe pour lequel vous n'avez pas d'Augmentation, vous effectuez un Test de Corps à Corps pour toucher avec cette arme. Bien que vous subissiez tous les Défauts de l'arme, vous ne pouvez utiliser aucun de ses Atouts. » — `LDB 62 l.139`

### Règle — Groupe Cavalerie (usage à pied)

On considère que les armes de Cavalerie doivent être utilisées lors d'un combat **monté**. Quand elles ne le sont pas, **toutes les armes à deux mains du Groupe Cavalerie sont aussi considérées comme des armes à Deux Mains**. Les armes de Cavalerie à une main ne sont, en principe, pas utilisées à pied (`LDB 62 l.142-143`).

### Règle — Groupe Fléau (sans compétence)

Les Personnages **sans compétence** ajoutent le **Défaut d'Arme Dangereuse** à leurs Fléaux, et **les autres Atouts ne sont pas utilisés** (`LDB 62 l.146-147`).

> « Les Personnages sans compétence ajoutent le Défaut d'Arme Dangereuse à leurs Fléaux, et les autres Atouts ne sont pas utilisés. » — `LDB 62 l.147`

### Règle — Groupe Parade (corps à corps sans pénalité de main gauche)

N'importe quelle **arme à une main avec l'Atout Défensive** peut être utilisée avec *Corps à corps (Parade)*. Quand vous utilisez *Corps à corps (Parade)*, une arme peut **opposer une attaque sans la pénalité de main gauche normale de −20** (voir LDB 14 p.161) (`LDB 62 l.150-151`).

> « Quand vous utilisez Corps à corps (Parade), une arme peut être utilisée pour opposer une attaque sans la pénalité de main gauche normale de -20. » — `LDB 62 l.151`

### Encart — Profil de combat du Duel Judiciaire (NADJ)

L'aventure *Une journée au tribunal* (NADJ) donne le **profil de combat canon du jugement par combat** (*judicial duel*), évoqué nulle part dans les règles de base. Sous la loi impériale, nobles et certaines autres personnes peuvent réclamer un duel judiciaire au lieu d'un jury ; nobles, grands prêtres et marchands influents entretiennent souvent des **champions de justice** pour cela. Conditions de victoire et contraintes d'armes, *verbatim* :

> « En fonction de la sévérité de la charge, un duel judiciaire peut être disputé jusqu'au premier sang ou jusqu'à ce qu'un des combattants ne puisse plus poursuivre. En termes de jeu, le premier sang est la première attaque qui cause une perte de plus de 3 Blessures (les coups moindres sont considérés comme des estafilades au mieux) ; un adversaire est incapable de continuer lorsqu'il est réduit à 0 Blessure. » — `NADJ 06 l.177`

> « Les parties concernées et leurs champions ont normalement le libre choix des armes bien que la plupart des lois locales interdisent de faire appel à des projectiles. » — `NADJ 06 l.181`

Synthèse des règles du combat d'honneur (`NADJ 06 l.176-191`) :

| Paramètre | Règle de jeu |
|---|---|
| Issue « premier sang » | Première attaque causant une perte de **plus de 3 Blessures** (≤ 3 Blessures = estafilade, ne compte pas). |
| Issue « incapable de continuer » | Combattant réduit à **0 Blessure**. |
| Choix de l'issue | Selon la **sévérité de la charge** (premier sang pour les charges légères, jusqu'à l'incapacité pour les graves). |
| Armes | **Libre choix** des parties et de leurs champions ; **projectiles interdits** par la plupart des lois locales. Des codes anciens peuvent imposer des armes précises (ex. couvercle de marmite + navet contre chaussette lestée, à Wendorf). |
| Avant le combat | Serment de véracité juré par les parties ; **inspection des participants et des armes** (poison, sorcellerie, tricherie) ; prêtresse de Verena prononce une prière autour de l'arène. |

**Sources RAW** :
- `LDB 62 l.5-15` — Schéma de présentation d'une arme : les 7 champs (Groupe/Prix/Enc/Disponibilité/Allonge-Portée/Dégâts/Atouts-Défauts), Dégâts ajoutés au DR, BF = Bonus de Force.
- `LDB 62 l.19-57` — Bloc complet « Armes de Corps à Corps » : les 8 tables de groupe transcrites *verbatim* ci-dessus (Armes d'hast, Bagarre, Base, Cavalerie, Deux-mains, Escrime, Fléau, Parade).
- `LDB 62 l.37` — Profil de la Dague (Enc 0, Très courte, +BF +2, aucun Atout/Défaut) — base du profil des Griffes de Tigre.
- `LDB 62 l.58` — Note : Lance de cavalerie = Arme improvisée hors Round de Charge (le `*` de +BF +6).
- `LDB 62 l.126-127` — Règle « Arme simple » (définition générique : épées, haches, marteaux, masses, lances courtes traités comme identiques).
- `LDB 62 l.133-136` — Dégâts d'arme : −1 Dégâts/point, +0 → Arme improvisée, réparation 10 %/point, irréparable une fois improvisée.
- `LDB 62 l.138-139` — Sous-système des Groupes d'armes de Corps à corps : Compétences *Corps à corps (X)* distinctes ; sans Augmentation → Test sur Caractéristique, Défauts subis, Atouts inutilisables.
- `LDB 62 l.142-143` — Groupe Cavalerie : armes à utiliser monté ; les (2M) du groupe deviennent Deux Mains à pied ; les 1M ne sont pas utilisées à pied.
- `LDB 62 l.146-147` — Groupe Fléau : sans compétence → Défaut Dangereuse ajouté, autres Atouts perdus.
- `LDB 62 l.150-151` — Groupe Parade : toute arme 1M Défensive utilisable avec *Corps à corps (Parade)* ; pas de pénalité de main gauche −20 en Parade.
- `NADJ 11 l.20` — Griffes de Tigre : mêmes caractéristiques qu'une Dague, mais utilisées avec *Corps à corps (Bagarre)* ; sur une réussite la blessure peut sembler faite par un gros félin (gantelets à quatre lames).
- `NADJ 11 l.23-32` — Statbloc des espions *Marqués* (Trait *Arme (Griffes de Tigre) +5*) — l'arme en usage par des PNJ.
- `NADJ 06 l.176-191` — Duel Judiciaire (jugement par combat) : « premier sang » = première attaque > 3 Blessures (≤ 3 = estafilade), « incapable de continuer » = 0 Blessure ; issue selon sévérité de la charge ; libre choix des armes mais projectiles interdits par la plupart des lois locales ; serment de véracité + inspection des armes (poison/sorcellerie) + prière de Verena avant le combat.

> NB : l'entrée *Les ogres* (ADE II 02 l.661-705) décrit des armes propres au bestiaire ogre (Massue ogre personnalisable, Poing de fer, Grande lance, Piège à chaînes, Lance-harpon, Pistolet ogre) qui **renvoient explicitement à ce schéma LDB 62** (« Voir WFJDR p. 297 pour ces Atouts ») mais ne font pas partie des tables de Groupe LDB — elles relèvent de l'équipement de créature, hors périmètre de cette entrée. De même, le Trait *Arme (Griffes de Tigre) +5* des PNJ Marqués est un Trait de créature, distinct du profil d'arme transportable ci-dessus.

**Voir aussi** : Atouts et Défauts d'arme (LDB) ; Allonge d'arme et fourchettes de portée (LDB) ; Armes à distance (LDB) : groupes et tables ; Le Combat (Test de Corps à corps, Parade, Esquive) ; Résolution d'une attaque (corps à corps / distance) ; Compétences groupées (Corps à corps / Projectiles).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 62` (l.5-15, l.19-57, l.58, l.126-127, l.133-136, l.138-139, l.142-143, l.146-147, l.150-151) → `armes-d-hast`, `a-enroulement`, `weaponImprovised`, `REACH_OPTIONS`, `bagarre`, `REACH_VARIABLE`, `doc`, `IMPROVISED_DAMAGE`, `a-poudre-noire`, `meleeReachRank`, +118 — `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/qualities.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/qualities.ts`, +23 fichiers
- `ADE II 2` (l.661-705) → `traitCapabilitiesSchema`, `traitConsumptionFactor`, `useAttackJetProps`, `WeaponSpec`, `doc`, `WeaponContext`, `effectiveWeapon`, `dailyFoodUpkeep`, `itemFromTrappingById`, `provisioningManifest`, +29 — `src/data/index.ts`, `src/data/regles.json`, `src/data/schemas/defs/traits.ts`, `src/data/schemas/defs/trappings.ts`, `src/data/traits.json`, `src/data/trappings.json`, +12 fichiers
- `NADJ 6` (l.176-191) → `EnemyTurnInput`, `banRangedActive`, `firedAttackBlock`, `victoryConditionSchema`, `chooseEnemyAction`, `EncountersTab`, `encounterDefSchema`, `resolveAttack`, `Combatant`, `victoryConditionMet`, +1 — `src/data/schemas/defs-scenes/scene.ts`, `src/engine/types.ts`, `src/state/ai.ts`, `src/state/combatFlow.ts`, `src/ui/editor/LogicDock.tsx`
- `NADJ 11` (l.20, l.23-32) → `griffe-de-tigre` — `src/data/trappings.json`

---

## Armes à distance et munitions (LDB) : groupes et tables

Le chapitre **« Les armes »** (LDB 62) présente les armes à distance selon le même schéma que les armes de corps à corps : **Groupe d'armes** (les armes à deux mains sont notées `(2M)`), **Prix**, **Enc** (Encombrement), **Disponibilité**, **Allonge/Portée** (la portée moyenne en mètres pour une arme à distance), **Dégâts** (« ajoutés à votre DR pour toucher ») et **Atouts et Défauts**. Le Bonus de Force est abrégé **BF** dans les tableaux (`LDB 62 l.5-15`).

Les armes à distance sont regroupées par **Groupe d'armes à distance** : Arbalète, Arc, Entraves, Explosifs, Fronde, Lancer, Ingénierie et Poudre Noire. Chaque groupe correspond à une spécialisation distincte de la Compétence **Projectiles** (voir le sous-système plus bas). Toutes les valeurs ci-dessous sont transcrites verbatim des tables (`LDB 62 l.65-124`).

### Table Armes à Distance — toutes les valeurs verbatim

Colonnes : **Arme · Prix · Enc · Disponibilité · Portée · Dégâts · Atouts et Défauts**. Le `(2M)` en tête signale une arme à deux mains. Le prix `5/–` se lit « 5 sous, 0 couronne » ; `5CO` se lit « 5 couronnes » (cf. monnaie LDB 57).

**Groupe ARBALÈTE**

| Arme | Prix | Enc | Disponibilité | Portée | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| (2M) Arbalète | 5CO | 2 | Commune | 60 | +9 | Recharge 1 |
| Arbalète de poing | 6CO | 0 | Limitée | 10 | +7 | Pistolet |
| (2M) Arbalète lourde | 7CO | 3 | Rare | 100 | +9 | Dévastatrice, Recharge 2 |

**Groupe ARC**

| Arme | Prix | Enc | Disponibilité | Portée | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| (2M) Arc | 4CO | 2 | Commune | 50 | +BF +3 | – |
| (2M) Arc court | 3CO | 1 | Commune | 20 | +BF +2 | – |
| (2M) Arc elfique | 10CO | 2 | Exotique | 150 | +BF +4 | Dévastatrice, Pointue |
| (2M) Arc long | 5CO | 3 | Limitée | 100 | +BF +4 | Dévastatrice |

**Groupe ENTRAVES** (** voir la note « armes immobilisantes »)

| Arme | Prix | Enc | Disponibilité | Portée | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| Fouet | 5/– | 0 | Commune | 6 | +BF +2 | Immobilisante |
| Lasso | 6/– | 0 | Commune | BF x2 | – | Immobilisante |

**Groupe EXPLOSIFS**

| Arme | Prix | Enc | Disponibilité | Portée | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| Bombe | 3CO | 0 | Rare | BF | +12 | Explosion 5, Dangereuse, Percutante |
| Bombe incendiaire | 1CO | 0 | Limitée | BF | Spécial*** | Explosion 4, Dangereuse |

**Groupe FRONDE**

| Arme | Prix | Enc | Disponibilité | Portée | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| Fronde | 1/– | 0 | Commune | 60 | +6 | – |
| (2M) Fustibale | 4/– | 2 | Limitée | 100 | +7 | – |

**Groupe LANCER**

| Arme | Prix | Enc | Disponibilité | Portée | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| Bolas | 10/– | 0 | Rare | BF x3 | +BF | Immobilisante |
| Couteau de lancer | 18/– | 0 | Commune | BF x2 | +BF +2 | – |
| Fléchette | 2/– | 0 | Limitée | BF x2 | +BF +1 | Empaleuse |
| Hache de lancer | 1CO | 1 | Commune | BF x2 | +BF +3 | Taille |
| Javelot | 10/6 | 1 | Limitée | BF x3 | +BF +3 | Empaleuse |
| Rocher | – | 0 | Commune | BF x3 | +BF | – |

**Groupe INGÉNIERIE*** (* voir la note Poudre noire/Ingénierie)

| Arme | Prix | Enc | Disponibilité | Portée | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| (2M) Arquebuse à répétition* | 10CO | 3 | Rare | 30 | +9 | Dangereuse, Recharge 5, Répétition 4 |
| Pistolet à répétition* | 15CO | 1 | Rare | 10 | +8 | Dangereuse, Pistolet, Recharge 4, Répétition 4 |

**Groupe POUDRE NOIRE*** (* voir la note Poudre noire/Ingénierie)

| Arme | Prix | Enc | Disponibilité | Portée | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| (2M) Arquebuse* | 4CO | 2 | Limitée | 50 | +9 | Dangereuse, Recharge 3 |
| (2M) Long fusil d'Hochland* | 100CO | 3 | Exotique | 100 | +9 | Précise, Pointue, Recharge 4 |
| Pistolet* | 8CO | 0 | Rare | 20 | +8 | Pistolet, Recharge 1 |
| (2M) Tromblon* | 2CO | 1 | Limitée | 20 | +8 | Explosion 3, Dangereuse, Recharge 2 |

*Réf. : `LDB 62 l.65-102`. Note d'OCR : pour les armes à Poudre noire la valeur de Recharge apparaît sous la forme `Recharge — p. N` dans le `.md` ; la valeur N (3, 4, 1, 2 respectivement pour Arquebuse / Long fusil / Pistolet / Tromblon) est le rang de Recharge. Les Atouts/Défauts « Poudre noire » et « Dévastatrice » ne sont pas listés case par case mais ajoutés par la note ci-dessous.*

### Trois notes du tableau (renvois * / ** / ***)

- **Poudre noire et Ingénierie — Atouts systématiques** : *« Toutes les Armes à Poudre noire et d'Ingénierie possèdent les Atouts Poudre noire et Dévastatrice. »* (`LDB 62 l.99`). Ces deux Atouts s'ajoutent donc à TOUTES les lignes des groupes Poudre Noire et Ingénierie en plus de ce qui est imprimé dans leur ligne de table.
- **Armes immobilisantes — portée sans fourchette** : *« Les armes immobilisantes ne possèdent pas de fourchette de portée, juste la portée listée. »* (`LDB 62 l.101`). Le Fouet, le Lasso et les armes de Lancer à l'Atout Immobilisante (Bolas) n'utilisent donc PAS les bandes Bout portant/Courte/Longue/Extrême : seule leur portée écrite s'applique.
- **Bombe incendiaire — État Enflammé +DR** : *« Une Bombe incendiaire donne +DR État Enflammé à chaque cible affectée. »* (`LDB 62 l.103`). C'est le contenu de la mention « Dégâts : Spécial*** » de sa ligne : pas de Dégâts physiques chiffrés, mais un nombre d'États _Enflammé_ égal aux Degrés de Réussite, infligés à chaque cible de la zone d'Explosion 4.

### Table Munitions — toutes les valeurs verbatim

Colonnes : **Arme · Prix · Enc · Disponibilité · Allonge/Portée · Dégâts · Atouts et Défauts**. Les munitions sont vendues par paquet — le nombre entre parenthèses (« (12) ») est la taille du paquet. « Comme l'arme » = la munition adopte la portée de l'arme qui la tire ; les modificateurs `-10` / `+50` / `Moitié de l'arme` ajustent cette portée. Les Dégâts de la munition s'AJOUTENT à ceux de l'arme.

**Munitions ARBALÈTE**

| Munition | Prix | Enc | Disponibilité | Allonge/Portée | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| Carreau (12) | 5/– | 0 | Commune | Comme l'arme | – | Empaleuse |

**Munitions ARC**

| Munition | Prix | Enc | Disponibilité | Allonge/Portée | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| Flèche (12) | 5/– | 0 | Commune | Comme l'arme | – | Empaleuse |
| Flèche elfe | 6/– | 0 | Exotique | +50 | +1 | Précise, Empaleuse, Perforante |

**Munitions FRONDE**

| Munition | Prix | Enc | Disponibilité | Allonge/Portée | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| Balle de plomb (12) | 4sc | 0 | Commune | -10 | +1 | Assommante |
| Projectile de pierre (12) | 2sc | 0 | Commune | Comme l'arme | – | Assommante |

**Munitions POUDRE NOIRE ET INGÉNIERIE**

| Munition | Prix | Enc | Disponibilité | Allonge/Portée | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| Balle et Poudre (12) | 3/3 | 0 | Commune | Comme l'arme | +1 | Empaleuse, Perforante |
| Munitions improvisées et Poudre | 3sc | 0 | Commune | Moitié de l'arme | – | – |
| Petites munitions et Poudre | 3/3 | 0 | Commune | Comme l'arme | – | Explosion 1 |

*Réf. : `LDB 62 l.111-124`.*

**Règle « Munitions pour Poudre noire »** : *« Les Tromblons sont les seules armes listées qui utilisent de Petites munitions ou des Munitions improvisées. Toutes les autres armes à Poudre noire et d'Ingénierie utilisent des balles. »* (`LDB 62 l.130-131`). Conséquence : la munition à Explosion 1 (« Petites munitions et Poudre ») et la munition « Moitié de l'arme » (« Munitions improvisées ») ne sont compatibles QUE du Tromblon ; Arquebuse, Long fusil d'Hochland, Pistolet et les armes d'Ingénierie tirent de la « Balle et Poudre ».

### Munitions traditionnelles (AA — variantes complémentaires)

Aux Armes (*Up in Arms*) étend la liste de munitions Arc/Arbalète/Fronde avec des variantes spécialisées (têtes de flèche, projectiles de fronde, munitions improvisées). Même schéma de colonnes ; consolidées ici car elles complètent strictement la table du LDB sans la contredire.

| Munition | Prix | Enc | Disponibilité | Portée | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| Carreau (12) [Arbalète] | 5/– | 0 | Commune | Comme l'arme | – | Empaleuse |
| Bâton pointu [Arc] | N/A | 0 | Commune | Moitié de l'arme | –2 | Dangereuse, Imprécise, Inoffensive |
| Flèche (12) [Arc] | 5/– | 0 | Commune | Comme l'arme | – | Empaleuse |
| Flèche barbelée (12) [Arc] | 8/– | 0 | Limitée | Comme l'arme | – | Empaleuse, Taillade (1A) |
| Flèche bodkin (12) [Arc] | 8/– | 0 | Limitée | Comme l'arme | – | Empaleuse, Perforante |
| Flèche elfique [Arc] | 6/– | 0 | Exotique | +50 | +1 | Empaleuse, Perforante, Pointue |
| Bille de plomb (12) [Fronde] | 4 sc | 0 | Commune | –10 | +1 | Assommante |
| Caillou [Fronde] | N/A | 0 | Commune | –10 | –2 | Imprécise, Inoffensive |
| Projectile de pierre (12) [Fronde] | 2 sc | 0 | Commune | Comme l'arme | – | Assommante |

*Réf. : `AA 08 l.366-381`.* Notes AA : la flèche barbelée *« inflige de vilaines blessures par entaille et cause des dommages supplémentaires si elle n'est pas retirée très précautionneusement »* ; la flèche bodkin *« est dotée d'une robuste pointe en pic pour perforer les armures »* (`AA 08 l.385`). Les bâtons pointus et cailloux servent de munitions de secours : un caillou s'obtient par un Test étendu de **Survie en extérieur Facile (+40)** ou **Perception Intermédiaire (+0)** totalisant 5 DR ; un bâton pointu par un Test étendu de **Survie en extérieur Intermédiaire (+0)** totalisant 10 DR, mais *« les flèches improvisées ont tendance à provoquer des Maladresses »* (`AA 08 l.386-389`).

### Sous-système : Groupes d'armes à Distance (spécialisations requises)

*« Les Armes à distance sont difficiles à maîtriser. Vous ne pouvez pas tenter de Test de Projectiles pour une arme pour laquelle vous ne possédez pas la spécialisation correcte. Donc, si vous avez Projectiles (Poudre noire), vous ne pouvez pas tenter un Test de Projectiles (Arc). Il y a cependant quelques exceptions. »* (`LDB 62 l.179-180`).

Contrairement aux armes de corps à corps (où l'absence de spécialisation permet quand même un Test de base, avec Défauts mais sans Atouts), une arme à distance hors spécialisation est **purement et simplement impossible à utiliser** — sauf les trois exceptions ci-dessous.

- **Arbalètes et Lancer — utilisables avec la Compétence Tir (Atouts perdus)** : *« Les Arbalètes et les armes de Lancer sont relativement simples à utiliser. Vous pouvez tenter un Test de Projectiles (Arbalète) ou Projectiles (Lancer) en utilisant votre Compétence de Tir, mais l'arme perd tous ses Atouts tout en gardant ses Défauts. »* (`LDB 62 l.183-184`).
- **Ingénierie utilisable avec Poudre Noire (Atouts perdus)** : *« Toutes les armes d'Ingénierie peuvent être utilisées par des Personnages possédant Projectiles (Poudre noire), mais les armes perdent tous leurs Atouts en gardant leurs Défauts. »* (`LDB 62 l.187-188`). Une arme d'Ingénierie tirée par un spécialiste Poudre noire garde donc Dangereuse/Recharge/Répétition mais perd Poudre noire/Dévastatrice et les autres Atouts.
- **Poudre Noire et Explosifs utilisables avec Ingénierie (sans pénalité)** : *« Ceux qui possèdent Projectiles (Ingénierie) peuvent utiliser des Armes à Poudre noire et des Explosifs sans pénalité. »* (`LDB 62 l.191-192`). C'est l'exception la plus large : un spécialiste Ingénierie tire armes à Poudre noire ET Explosifs SANS perte d'Atouts (à la différence des deux exceptions précédentes, qui font perdre les Atouts).

### Portée d'une arme et fourchettes (rappel utilisé par les tables ci-dessus)

La Portée listée est la portée moyenne en mètres ; les fourchettes se calculent ainsi (`LDB 62 l.195-206`) : **Bout portant = Portée ÷ 10**, **Courte = Portée ÷ 2**, **Moyenne = Portée** (la valeur listée), **Longue = Portée × 2**, **Extrême = Portée × 3**.

| Arme | Bout portant | Courte | Moyenne | Longue | Extrême |
|---|---|---|---|---|---|
| Arbalète lourde | 10 | 50 | 100 | 200 | 300 |
| Arc | 5 | 25 | 50 | 100 | 150 |
| Fronde | 6 | 30 | 60 | 120 | 180 |
| Pistolet | 2 | 10 | 20 | 40 | 60 |

*Réf. : exemple de portées `LDB 62 l.203-211`.* (Les armes immobilisantes échappent à ce calcul — cf. note ** plus haut.)

**Sources RAW** :
- `LDB 62 l.5-15` — schéma de description d'une arme (Groupe d'armes / Prix / Enc / Disponibilité / Allonge-Portée / Dégâts / Atouts et Défauts ; BF = Bonus de Force).
- `LDB 62 l.65-102` — Table « Armes à distance » verbatim : groupes Arbalète, Arc, Entraves (**), Explosifs, Fronde, Lancer, Ingénierie (*), Poudre Noire (*).
- `LDB 62 l.99` — Note : toutes les armes à Poudre noire ET d'Ingénierie possèdent les Atouts **Poudre noire** + **Dévastatrice**.
- `LDB 62 l.101/103` — Notes : armes immobilisantes = portée sans fourchette ; Bombe incendiaire = +DR État _Enflammé_ par cible.
- `LDB 62 l.111-124` — Table « Munitions » verbatim : Arbalète, Arc, Fronde, Poudre Noire et Ingénierie.
- `LDB 62 l.130-131` — Règle « Munitions pour Poudre noire » : Tromblons = seules armes à Petites munitions / Munitions improvisées ; toutes les autres = balles.
- `LDB 62 l.179-180` — Sous-système Groupes d'armes à Distance : spécialisation Projectiles requise, pas de Test hors spécialisation (sauf exceptions).
- `LDB 62 l.183-184` — Exception Arbalètes & Lancer : Test avec Compétence **Tir**, l'arme perd ses Atouts (garde ses Défauts).
- `LDB 62 l.187-188` — Exception Ingénierie : utilisable avec Projectiles (Poudre noire), Atouts perdus, Défauts gardés.
- `LDB 62 l.191-192` — Exception Poudre Noire & Explosifs : utilisables avec Projectiles (Ingénierie) **sans pénalité** (Atouts conservés).
- `LDB 62 l.195-211` — Portée d'une arme : calcul des fourchettes + table d'exemple Bout portant/Courte/Moyenne/Longue/Extrême.
- `AA 08 l.366-385` — Table « Munitions traditionnelles » (variantes Arc/Arbalète/Fronde : bâton pointu, flèche barbelée, flèche bodkin, flèche elfique, bille de plomb, caillou) + descriptions barbelée/bodkin.
- `AA 08 l.386-389` — Munitions de secours (caillou, bâton pointu) : Tests étendus d'acquisition + risque de Maladresse.

> « Toutes les Armes à Poudre noire et d'Ingénierie possèdent les Atouts Poudre noire et Dévastatrice. » — `LDB 62 l.99`

> « Vous ne pouvez pas tenter de Test de Projectiles pour une arme pour laquelle vous ne possédez pas la spécialisation correcte. […] Il y a cependant quelques exceptions. » — `LDB 62 l.180`

> « Une Bombe incendiaire donne +DR État Enflammé à chaque cible affectée. » — `LDB 62 l.103`

**Voir aussi** : qualites-defauts-armes-tables (Recharge, Dévastatrice, Explosion, Immobilisante, Empaleuse, Perforante, Pointue, Précise, Dangereuse) ; armes-corps-a-corps-tables (groupes de corps à corps, Allonge) ; bandes-portee-modificateurs (Bout portant/Courte/Longue/Extrême) ; etats-table (État Enflammé) ; monnaie-tables (lecture des prix `X/Y` et `XCO`).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 62` (l.5-15, l.65-124, l.130-131, l.179-180, l.183-184, l.187-188, l.191-192, l.195-211) → `armes-d-hast`, `a-enroulement`, `weaponImprovised`, `AuContactModal`, `reachTiles`, `bagarre`, `doc`, `a-poudre-noire`, `isRepairable`, `baton-de-combat`, +127 — `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/qualities.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/qualities.ts`, +24 fichiers
- sans code : `AA 8` (l.366-385, l.386-389)

---

## Portée, Allonge et dégradation des armes

Le profil d'arme du Livre de base présente, pour chaque arme, un champ **Allonge/Portée** : il vaut une **Allonge** (longueur de l'arme, pour les armes de Corps à corps) **ou** une **Portée** en mètres (pour les armes à distance). Ce topic couvre les trois sous-systèmes attachés à ce champ : les catégories d'**Allonge** d'arme de mêlée, le calcul des **fourchettes de portée** des armes à distance, et la **dégradation** (Dégâts d'arme) et sa réparation.

### Allonge d'arme — 7 catégories

Les longueurs des armes sont progressivement plus grandes, comme suit (LDB 62 l.156-164) :

| Allonge | Longueur | Effet d'engagement |
|---|---|---|
| **Personnelle** | vos bras et vos poings, peut-être votre tête et tout ce qui y est attaché | Engage à 2 m (défaut) |
| **Très courte** | moins de 30 centimètres de long | Engage à 2 m (défaut) |
| **Courte** | jusqu'à 60 centimètres de long | Engage à 2 m (défaut) |
| **Moyenne** | jusqu'à 90 centimètres de long | Engage à 2 m (défaut) |
| **Longue** | jusqu'à 1m80 de long | Engage à 2 m (défaut) |
| **Très longue** | jusqu'à 3 mètres de long | peut Engager des ennemis jusqu'à **4 mètres** de distance plutôt que 2 |
| **Considérable** | tout ce qui dépasse 3 mètres de long | peut Engager des ennemis jusqu'à **6 mètres** de distance plutôt que 2 |

> *Note : le passage source en énumère effectivement six après « Personnelle » (Très courte → Considérable). Seules **Très longue** et **Considérable** modifient la distance d'Engagement ; les autres engagent à la portée standard de 2 m.*

Allonges effectivement employées dans les tableaux d'armes du Livre de base (LDB 62 l.20-102) : **Personnelle** (Mains nues, Coup-de-poing, Targe) ; **Très courte** (Bouclier, Couteau, Dague, Main gauche) ; **Courte** (Brise-épée) ; **Moyenne** (Arme simple, Marteau de guerre, Fleuret, Fléau…) ; **Longue** (Bâton de combat, Hallebarde, Épée bâtarde, Zweihänder, Rapière, Fléau d'armes, Marteau à bec-de-corbin) ; **Très longue** (Lance, Lance de cavalerie) ; **Considérable** (Pique). L'Arme improvisée a une Allonge **Variable**.

### Option : Longueur d'arme et combat au contact

Règle **optionnelle** « pour ceux qui aiment utiliser la longueur de l'arme pour plus qu'une simple description de l'apparence, et un obstacle possible pour ajuster ses coups dans les tunnels sombres » (LDB 62 l.168-175). Deux effets :

- **Longueur d'arme** : « Si votre arme est plus longue que celle de vos adversaires, ils subissent une pénalité de **-10 pour vous toucher** car vous trouvez plus facile de les tenir à distance. » (LDB 62 l.172)
- **Au Contact** : « Pour votre Action, vous pouvez effectuer un **Test opposé de Corps à corps** pour tenter d'entrer dans la longueur d'arme de votre adversaire. Le vainqueur choisit si le combat continue normalement ou "au contact". Pendant un combat au contact, **n'importe quelle arme plus longue que Courte est considérée comme une Arme improvisée**. » (LDB 62 l.176-177)

### Portée d'une arme

La Portée listée d'une arme à distance est sa **portée moyenne en mètres** (LDB 62 l.196). À partir de cette valeur, les autres fourchettes (Bout portant, Courte, Longue, Extrême) se calculent ; les modificateurs de Test associés à chaque fourchette sont présentés au chapitre Règles/Combat (voir *Voir aussi*).

#### Calcul des fourchettes de portée (LDB 62 l.198-206)

| Fourchette | Calcul depuis la Portée moyenne |
|---|---|
| Bout portant | Portée **÷ 10** |
| Courte | Portée **÷ 2** |
| Longue | Portée **× 2** |
| Extrême | Portée **× 3** |

> *Le passage source affiche « Extrême = Portée x — p. 3 » (artefact OCR : le « 3 » est collé à la note de page). Les Exemples de portées ci-dessous confirment le facteur **× 3** : Pistolet portée moyenne 20 → Extrême 60 = 20 × 3.*

#### Exemple de portées d'arme (LDB 62 l.203-215)

| Arme | Bout portant | Courte | Moyenne | Longue | Extrême |
|---|---|---|---|---|---|
| Arbalète lourde | 10 | 50 | 100 | 200 | 300 |
| Arc | 5 | 25 | 50 | 100 | 150 |
| Fronde | 6 | 30 | 60 | 120 | 180 |
| Pistolet | 2 | 10 | 20 | 40 | 60 |

> *La table source répète ces quatre lignes deux fois (l.246-249 puis l.250-253) — duplication de l'OCR, valeurs identiques. La colonne **Moyenne** est la Portée listée de l'arme.*

**Cas particuliers de portée dans les tableaux d'armes** :
- Certaines armes sont **Immobilisantes** (Fouet, Lasso, Bolas) : « Les armes immobilisantes ne possèdent pas de fourchette de portée, juste la portée listée. » (LDB 62 l.101)
- Certaines portées sont exprimées en fonction du **Bonus de Force** (BF) plutôt qu'en mètres fixes : Lasso = `BF ×2`, Bolas / Javelot / Rocher = `BF ×3`, Couteau de lancer / Fléchette = `BF ×2`, etc. (LDB 62 l.78-92).

### Dégâts d'arme (détérioration et réparation)

Certaines Maladresses (voir LDB 14, p. 160) ou Sorts peuvent endommager une arme (LDB 62 l.133-136) :

- **Détérioration** : « Pour chaque point de Dégâts que votre arme reçoit, **réduisez ses Dégâts de 1**. »
- **Réduction à l'état improvisé** : « Si les Dégâts sont réduits à **+0 (ou BF +0)**, l'arme est tellement abîmée qu'elle n'est plus identifiable, et elle est à présent **considérée comme une Arme improvisée**. » (L'Arme improvisée a les Dégâts **+BF+1** et l'Atout **Inoffensive** — LDB 62 l.31 ; elle perd donc tout Atout préexistant.)
- **Arme improvisée endommagée** : « Si une Arme improvisée est endommagée, elle est considérée comme **inutile pour le Combat au Corps à corps**. »
- **Réparation** : « Les armes peuvent être réparées par des artisans appropriés pour **10 % du coût de l'arme par point de Dégâts subi**. Les armes réduites à l'état d'Armes improvisées **ne peuvent pas être réparées**. »
- **Auto-réparation** : « Vous pouvez aussi rafistoler vos propres armes si vous possédez la **Compétence Métier**, les **Outils de Profession** et un **Atelier approprié** (pour plus qu'un simple point de Dégât). »

> *L'Atout **Incassable** (LDB 62 l.260-262) exempte une arme de tout dégât/corrosion/destruction. L'Atout **Solide(N)** (LDB 60) absorbe les N premiers Points de Dégâts sans pénalité.*

### Annexe — règles connexes de groupes d'armes (au contexte d'Allonge/Portée)

Les groupes d'armes à distance et leurs spécialisations conditionnent l'usage des armes par portée (LDB 62 l.179-192) :
- **Arbalètes et Lancer** sont « relativement simples à utiliser » : on peut tenter un Test de Projectiles (Arbalète) ou Projectiles (Lancer) sans la spécialisation correcte, mais **l'arme perd tous ses Atouts** tout en gardant ses Défauts (l.227-228).
- **Ingénierie** : les armes d'Ingénierie peuvent être utilisées par un Personnage ayant **Projectiles (Poudre noire)**, mais perdent tous leurs Atouts en gardant leurs Défauts (l.230-231).
- **Poudre noire et Explosifs** : ceux qui ont **Projectiles (Ingénierie)** peuvent utiliser les armes à Poudre noire et les Explosifs **sans pénalité** (l.233-234).
- Pour un groupe d'armes de **Corps à corps** non maîtrisé : on teste Corps à corps pour toucher, on subit tous les Défauts mais on ne peut utiliser aucun Atout (LDB 62 l.139).

**Sources RAW** :
- `LDB 62 l.156-164` — Allonge d'arme : 7 catégories (Personnelle / Très courte <30 cm / Courte ≤60 cm / Moyenne ≤90 cm / Longue ≤1m80 / Très longue ≤3 m, Engage à 4 m / Considérable >3 m, Engage à 6 m).
- `LDB 62 l.167-176` — Option « Longueur d'arme et combat au contact » : -10 à l'adversaire pour vous toucher si arme plus longue ; Test opposé de Corps à corps pour entrer « au contact » ; au contact, toute arme > Courte = Arme improvisée.
- `LDB 62 l.196` — la Portée listée = portée moyenne en mètres ; les modificateurs par fourchette sont au chapitre Règles.
- `LDB 62 l.198-206` — Calcul des Fourchettes de Portée : Bout portant = Portée ÷ 10 ; Courte = Portée ÷ 2 ; Longue = Portée × 2 ; Extrême = Portée × 3.
- `LDB 62 l.203-215` — Table Exemple de portées d'arme (Arbalète lourde, Arc, Fronde, Pistolet ; colonnes Bout portant / Courte / Moyenne / Longue / Extrême).
- `LDB 62 l.101` — armes Immobilisantes : pas de fourchette de portée, juste la portée listée.
- `LDB 62 l.133-136` — Dégâts d'arme : -1 Dégât par point reçu ; à +0 (ou BF +0) → Arme improvisée (non identifiable) ; Arme improvisée endommagée = inutile au Corps à corps ; réparation = 10 % du prix par point de Dégât ; armes réduites à improvisées non réparables ; auto-réparation via Métier + Outils + Atelier.
- `LDB 62 l.31` — profil de l'Arme improvisée : Dégâts +BF+1, Atout Inoffensive.
- `LDB 62 l.179-192` — groupes d'armes à distance : Arbalète/Lancer utilisables sans spé (perd Atouts) ; Ingénierie via Projectiles (Poudre noire), perd Atouts ; Poudre noire/Explosifs via Projectiles (Ingénierie) sans pénalité.

> « Si les Dégâts sont réduits à +0 (ou BF +0), l'arme est tellement abîmée qu'elle n'est plus identifiable, et elle est à présent considérée comme une Arme improvisée. […] Les armes peuvent être réparées par des artisans appropriés pour 10 % du coût de l'arme par point de Dégâts subi. Les armes réduites à l'état d'Armes improvisées ne peuvent pas être réparées. » — `LDB 62 l.135`

> « Pour votre Action, vous pouvez effectuer un Test opposé de Corps à corps pour tenter d'entrer dans la longueur d'arme de votre adversaire. Le vainqueur choisit si le combat continue normalement ou "au contact". Pendant un combat au contact, n'importe quelle arme plus longue que Courte est considérée comme une Arme improvisée. » — `LDB 62 l.176`

**Voir aussi** : Bandes de portée et modificateurs de tir (Bout portant +60 / Courte +40 / Moyenne +0 / Longue -10 / Extrême -30) ; Engagement et déplacement (1 case = 2 m) ; Atouts et Défauts d'arme ; Groupes d'armes et spécialisations ; Maladresses au combat.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 62` (l.20-102, l.133-136, l.139, l.156-164, l.167-177, l.179-192, l.196, l.198-215, l.260-262) → `armes-d-hast`, `a-enroulement`, `weaponImprovised`, `reachTiles`, `REACH_OPTIONS`, `AuContactModal`, `woundsFromHit`, `bagarre`, `REACH_VARIABLE`, `doc`, +188 — `src/data/combat-stakes.json`, `src/data/etats.json`, `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/qualities.json`, `src/data/regles.json`, +48 fichiers

---

## Atouts et Défauts d'arme

Chaque arme peut porter un ou plusieurs **Atouts** (avantages) et **Défauts** (handicaps). Certains portent un **Indice** (un nombre, ex. *Recharge 2*, *Protectrice 1*, *Explosion 3*) qui paramètre l'effet. Cette entrée transcrit **verbatim** la description de règle de chaque Atout/Défaut du *Livre de base* (LDB, chapitres 62 « Les armes » et 63 « Armures »), puis consolide les ajouts/modifications des suppléments *Aux Armes* (AA), *Le Zoo Impérial* (ZI), *Archives de l'Empire II* (ADE II) et le scénario *Une nuit à l'opéra* (NADJ), y compris la **table d100 complète des Atouts d'armes magiques** et la **table des Munitions magiques** d'ADE II. Aucune valeur n'est inventée : tout est repris des passages lus.

> **Note sur les règles de préséance** transverses, citées dans plusieurs entrées : *Inoffensive prend le dessus* sur Dévastatrice et Percutante (une arme Inoffensive ne peut jamais être Dévastatrice ni Percutante) ; *Imprécise prend le dessus* sur Précise ; *Lente prend le dessus* sur Rapide.

### Atouts d'arme (LDB 62)

> « Certaines armes présentent des avantages spécifiques par rapport à d'autres, qui sont décrits avec les Atouts d'arme. » — `LDB 62 l.219`

| Atout | Effet mécanique (verbatim consolidé) |
|---|---|
| **À Enroulement** | « Les Tests de Corps à corps opposant une attaque provenant d'une arme À Enroulement subissent une pénalité de **-1 DR**, car les frappes parées s'enroulent sur le haut des boucliers ou autour des lames. » |
| **À Poudre Noire** | « Si vous êtes ciblé par une arme à Poudre noire, vous devez réussir un Test de **Calme Accessible (+20)** ou gagner un État *Brisé*, **même si le tir vous rate**. » |
| **À Répétition (Indice)** | « Votre arme contient *Indice* munitions, automatiquement rechargées après chaque coup que vous tirez. Lorsque vous avez utilisé toutes vos munitions, vous devez recharger entièrement l'arme en utilisant les règles normales. » |
| **Assommante** | « Si vous touchez la **Tête** avec une arme Assommante, tentez un **Test opposé Force/Résistance** contre la cible frappée. Si vous remportez le Test, votre adversaire gagne un État *Sonné*. » |
| **Défensive** | « Si vous utilisez une telle arme, vous gagnez un bonus de **+1 DR** à n'importe quel Test de Corps à corps quand vous opposez une attaque. » |
| **Perturbante** | « Au lieu de causer des Dégâts, une attaque réussie avec une arme Perturbante peut forcer un adversaire à reculer d'**un mètre par DR** obtenu au Test opposé. » |
| **Dévastatrice** | « Une arme Dévastatrice peut utiliser le résultat le plus haut entre le **dé des unités** ou le **DR** pour déterminer les Dégâts causés par une touche réussie. » (ex. jet 34 / cible 52 → DR = 2 ou dé des unités = 4, au choix). *Une arme Inoffensive ne peut jamais être Dévastatrice (Inoffensive prend le dessus).* |
| **Empaleuse** | « causent un **Coup Critique sur n'importe quel nombre divisible par 10** (10, 20, 30…), ainsi que sur un **double** (11, 22, 33) obtenu **inférieur ou égal** au Test approprié au combat. » Voir la règle de **retrait de projectile** ci-dessous. |
| **Explosion (Indice)** | « Tous les Personnages situés à *Indice* mètres du point cible frappé subissent **DR + Dégâts d'arme** et gagnent tous les États infligés par l'arme. » |
| **Immobilisante** | « N'importe quel adversaire touché avec succès gagne un État *Empêtré* avec une **Force égale à votre Caractéristique de Force**. Quand vous Entravez un adversaire, vous ne pouvez par ailleurs pas utiliser l'arme pour toucher. Vous pouvez y mettre un terme quand vous le souhaitez. » |
| **Piège-Lame** | « Si vous obtenez un **Critique quand vous vous défendez** contre une attaque provenant d'une arme possédant une lame, vous pouvez choisir de la piéger plutôt que de causer un Coup Critique. » → **Test opposé de Force** (+ votre DR du précédent Test de Corps à corps). Réussite = l'adversaire **lâche la lame** ; **Succès Stupéfiant** = la lame est **brisée** (sauf Atout *Incassable*) ; échec = l'adversaire libère sa lame et combat normalement. |
| **Pistolet** | « Vous pouvez utiliser cette arme pour attaquer en **Combat rapproché**. » |
| **Pointue** | « Gagnez un bonus de **+1 DR** à tout Test réussi quand vous attaquez avec cette arme. » (bonus de Dégâts) |
| **Précise** | « Gagnez un bonus de **+10** à n'importe quel Test quand vous utilisez cette arme. » (bonus au jet d'attaque) |
| **Protectrice (Indice)** | « Si vous utilisez cette arme pour opposer une attaque, vous êtes considéré comme ayant *Indice* **PA à tous les endroits de votre corps**. Si votre arme possède un Indice Protectrice de **2 ou plus**, vous pouvez aussi **opposer des projectiles** tirés dans votre Ligne de Vue. » (version modifiée par AA ci-dessous) |
| **Incassable** | « Dans presque toutes les circonstances, cette arme ne sera ni brisée, ni corrodée, ni émoussée. » |
| **Percutante** | « Sur une touche réussie, ajoutez le résultat du **dé des unités** du lancer d'attaque à tout Dégât causé par une arme Percutante. » *Une arme Inoffensive ne peut jamais être également Percutante (Inoffensive prend le dessus).* |
| **Perforante** | « Les **PA ne provenant pas de métal sont ignorés**, et le **premier point** de toutes les autres armures est ignoré. » |
| **Rapide** | « Le porteur d'une arme Rapide peut choisir d'attaquer **en dehors de l'ordre d'Initiative normale** (premier, dernier ou au moment qu'il souhaite). De plus, tous les Tests de Corps à corps pour se défendre contre des armes Rapides subissent une **pénalité de -10** si l'adversaire utilise une arme **sans** l'Atout Rapide ; les autres Compétences défendent normalement. Deux adversaires avec armes Rapides combattent dans l'ordre d'Initiative normalement. » *Lente prend le dessus.* |
| **Taille** | « Si vous touchez un adversaire, vous **Endommagez de 1 Point une pièce d'armure ou un Bouclier frappé** tout en blessant la cible. » (décrit en tête du ch. 63) |

#### Règle — Retrait d'un projectile Empaleuse (LDB 62 l.250)

> « Si l'empalement vient d'une **arme à distance**, la munition utilisée s'est fermement logée dans le corps de la cible. Les **flèches et les carreaux** nécessitent un **Test de Guérison Intermédiaire** pour être retirés – les **balles** nécessitent un **chirurgien** (Talent Chirurgie). Chaque flèche ou balle **non retirée vous empêche de guérir 1 de vos Blessures**. » — `LDB 62 l.250`

### Défauts d'arme (LDB 63)

> « Certaines armes sont juste plus difficiles à utiliser, ou simplement dangereuses, comme décrit dans les Défauts d'arme. » — `LDB 62 l.311`

| Défaut | Effet mécanique (verbatim) |
|---|---|
| **Dangereuse** | « Tout Test **raté** incluant un **9 sur le dé des dizaines ou des unités** entraîne une **Maladresse**. » |
| **Épuisante** | « Vous ne gagnez les bénéfices des Traits d'arme **Percutante et Dévastatrice** que lors d'un Tour où vous **Chargez**. » |
| **Imprécise** | « Subissez une pénalité de **-1 DR** quand vous utilisez l'arme pour attaquer. » *Une arme Imprécise ne peut jamais être également Précise (Imprécise prend le dessus).* |
| **Inoffensive** | « **Tous les PA sont doublés** contre les armes Inoffensives. De plus, vous **n'infligez pas automatiquement le minimum de 1 Blessure** sur une touche réussie en combat. » |
| **Lente** | « Les Personnages utilisant des armes Lentes **frappent toujours en dernier** lors d'un Round, sans tenir compte de l'ordre d'Initiative. De plus, les adversaires gagnent un bonus de **+1 DR** à tout Test pour se défendre contre vos attaques. » |
| **Recharge (Indice)** | « Une arme déchargée possédant ce défaut nécessite un **Test étendu de Projectiles** approprié au Groupe d'armes correspondant et nécessite également d'obtenir *Indice* **DR** pour être rechargée. Si vous êtes **interrompu** pendant que vous rechargez, vous devez **recommencer à zéro**. » |

### Ajouts et modifications des suppléments

**Aux Armes (AA) — Atouts Optionnels.** Certaines armes peuvent **choisir** entre plusieurs Atouts avant le jet d'attaque. Exemple canonique : le **marteau de guerre** est toujours *Déséquilibrée*, mais celui qui le manie choisit d'utiliser *Assommante* (face contondante) **ou** *Perforante* (face pointue) — jamais les deux à la fois.

> « Ce choix doit être effectué **avant** tout jet effectué pour déterminer le Succès de l'attaque. Si pour une raison quelconque, le Joueur ne choisit pas quel Atout employer, l'attaque applique le **premier** des Atouts optionnels (*Assommante* dans le cas du marteau de guerre). » — `AA 08 l.77`

**Aux Armes (AA) — Nouveaux Atouts/Défauts** (non dans la liste LDB) :
- **Déséquilibrée** (Défaut) : « Quand cette arme est utilisée pour s'opposer à une attaque, elle subit une pénalité de **-1 DR** sur cette attaque. »
- **Déstabilisante** (Atout) : après une touche, vous pouvez **dépenser 2 Avantages** et effectuer un **Test opposé Force/Athlétisme** ; réussi → l'adversaire subit l'État *À Terre* (s'il est monté, chute de 2 m puis *À Terre*) ; perdu → rien (hors effets standards de l'opposition).
- **Taillade (XA)** (Atout) : une Blessure Critique inflige **+1 État *Hémorragique*** ; on peut dépenser **X** Avantages pour 1 *Hémorragique* supplémentaire.
- **Tir de zone (Indice)** (Atout) : *Bout portant* = un seul individu, +Indice aux Dégâts ; *Courte→Longue* = la cible + les (Indice) créatures visibles les plus proches à ≤ (Indice) mètres ; *Extrême* = comme Courte→Longue mais Dégâts réduits de (Indice).
- **Salve (Indice)** (Atout) : tire une par une ou par volées ; chaque tir réduit l'Indice de Salve de 1, recharge nécessaire quand Salve 0 ; chaque tir après le premier dans un Round impose **-10 cumulatif** au Test de Projectiles.

**Aux Armes (AA) — Protectrice modifiée** (`AA 08 l.102`) :

> « **Protectrice (Indice) :** chaque fois que vous vous opposez à une attaque avec votre **Capacité de Combat** ou avec votre **Compétence Corps à Corps** (Parade), vous bénéficiez d'un nombre de **PA supplémentaires égal à l'Indice**. Si votre arme a un Indice Protectrice de **2 minimum**, vous pouvez aussi l'utiliser pour vous opposer aux tirs de projectiles dans votre ligne de vue. » — Permet d'utiliser une arme de mêlée en main principale tout en gagnant les PA du bouclier (Protectrice) en main secondaire, sans pénalité.

**Archives de l'Empire II (ADE II) — armes ogres** (exemples d'armes portant ces Atouts) : Massue ogre (Moyenne, **BF+4**, Spéciale) ; Poing de fer (Courte, **BF+3**, **Défensive, Protectrice 1**) ; Grande massue ogre 2M (Longue, **BF+6**, **Dévastatrice**, Spéciale) ; Lance-harpon (Entraves, 20 m, **+10**, *Entraves, Recharge 2*) ; Pistolet ogre (Poudre noire, 20 m, **+8**, *Pistolet, Recharge 1*) ; Canon crache-plomb 2M (50 m, **+10**, *Dangereuse, Recharge 5*) ; Boulet crache-plomb (**Empaleuse, Percutante, Perforante**) ; Balle crache-plomb (*Explosion 3*). L'arbalète de siège ogre porte *Immobilisante* tant que la corde n'est pas séparée de la flèche.

**Le Zoo Impérial (ZI) — armes/munitions issues de monstres :**
- **Dague funeste** : une victime subissant ≥ 1 Blessure reçoit l'État *Empoisonné* (résistible par **Résistance Complexe (-10)**) ; chaque usage, le MJ lance un d10 en secret → sur **1**, le poison s'épuise et la dague **se brisera à sa prochaine utilisation** ; illégale dans tout l'Empire.
- **Lame à poignée en bois de cerf** (arme simple) : **ne se brisera jamais pendant la bataille** tant que son utilisateur la manie ; si la ramure a été obtenue par la violence, inflige toujours un État *Hémorragique* **à la fois à l'utilisateur et à la victime** à chaque Blessure Critique.
- **Trempe au sang de dragon** (n'importe quelle arme de mêlée en métal) : gagne l'Atout **Solide** sans DR additionnel pendant la création (le tranchant ne se perd jamais).
- **Sève de trégara** (flèches/carreaux) : les munitions traitées gagnent l'Atout **Perforante** ; à tirer dans la journée (sinon inutilisables).
- **Empennage de griffon** (flèches/carreaux) : agit comme des flèches elfiques.
- **Pointes barbelées** (flèches/carreaux) : une attaque infligeant ≥ 1 Blessure applique aussi un État *Hémorragique*.

**Une nuit à l'opéra (NADJ) — Pétards en arme improvisée** : le lanceur teste **Projectiles (Explosifs) CC 50**, Dégâts **+0**, Atout **Explosion 1**, Défaut **Dangereuse** ; **5 %** de chance d'État *En flammes* pour toute personne à moins d'un mètre, même sans Blessure subie (probabilité augmentée selon l'inflammabilité des vêtements).

### Atouts d'arme magiques (ADE II 4)

ADE II fournit, en plus de la taxonomie d'Atouts ordinaires, un **tableau d100 d'effets magiques** que l'on tire pour générer une arme enchantée (et, pour les armes à distance, le pouvoir est octroyé à ses munitions). **Le tableau complet est transcrit ci-dessous, verbatim.** Deux règles-cadres l'encadrent et s'appliquent à *toute* arme magique :

> **Règle-cadre 1 (toute arme magique blesse l'immunisé).** « Toutes les armes magiques peuvent **blesser les créatures normalement immunisées aux attaques non magiques**, telles que celles dotées du Trait de créature **Éthéré**. » — `ADE II 04 l.214`. (Ceci complète le Trait *Éthéré* couvert dans *Traits — défense, résilience, créatures* : une arme magique annule l'immunité « ne peut être blessée que par les Attaques magiques ».)

> **Règle-cadre 2 (Atouts conférés non cumulables).** « Certaines capacités magiques accordent des Atouts supplémentaires à l'arme. **Ces Atouts ne sont pas cumulables.** Par exemple, si une arme avec l'Atout Rapide obtient à nouveau cet Atout de manière différente, elle n'inflige pas de pénalité de –20 pour se défendre contre l'attaque. » — `ADE II 04 l.216`

> « Notez que certains effets sont décrits comme s'appliquant à un « **utilisateur** » et d'autres à un « **porteur** ». L'utilisateur est une personne se servant activement de l'objet comme arme principale en combat, tandis qu'un porteur le transporte dans sa main ou au fourreau. » — `ADE II 04 l.212`

> ⚠️ Dans le PDF VF, la colonne « d100 » et la colonne « Capacité » sont **désalignées par l'OCR** : le **nom** de chaque capacité apparaît à la fin du bloc de texte de la *plage précédente*. Le tableau ci-dessous **réaligne** chaque plage avec sa capacité (nom + corps réassemblés à partir des deux fragments OCR), sans rien changer au texte de règle.

#### (a) Capacités qui confèrent un Atout standard (non cumulable)

| Capacité (plage d100) | Atout(s) conféré(s) — verbatim ADE II |
|---|---|
| **Embrasée** (24–27) | « Une fois dégainée, l'arme s'enflamme, mais ne blesse pas son utilisateur et n'abîme pas les objets qu'il transporte. Si le porteur touche une cible inflammable avec l'arme, la cible subit un État *En flammes*. » |
| **D'argent vif** (32–35) | « Une arme de corps à corps en argent vif possède l'Atout **Rapide**. Une arme à distance avec cet enchantement […] accorde **+10 en Initiative** à l'utilisateur en combat. » |
| **De sorcellerie inflexible** (52–54) | « L'attaque de cette arme frappe comme la justice de Verena […]. Elle possède l'Atout **Précise**. » |
| **De l'immense gueule du loup** (61–63) | « Elle possède l'Atout **Dévastatrice**. » |
| **D'habileté et de ruse** (64–66) | « L'utilisateur bénéficie de **+20 CC ou CT**, selon l'arme. » |
| **De plaies atroces** (70–72) | « Des enchantements mortels garantissent que les blessures causées par cette arme sont graves. Elle possède l'Atout **Dévastatrice**. » |
| **De matière excessive** (79–81) | « Elle possède les Atouts **Assommante et Taille**. » |
| **Du bord le plus tranchant** (85–87) | « La pointe et les bords de cette arme restent aiguisés par magie, ou les munitions qu'elle tire le deviennent. Elle possède les Atouts suivants : **Empaleuse, Perforante et Taille**. » |
| **D'or vif** (93–94) | « Elle possède les Atouts suivants : **Perforante, Précise et Rapide**. » |
| **D'apparence évolutive** (97–98) | « À chaque Round, le porteur peut choisir l'un des Atouts suivants : **Empaleuse, Perforante, Précise, Rapide et Taille**. » |

#### (b) Effets hors-taxonomie (aucun Atout standard équivalent)

| Capacité (plage d100) | Règle (verbatim ADE II) |
|---|---|
| **(sans particularité)** (01–19) | « […ne possède pas d'autre capacité magique] que de blesser les créatures immunisées aux attaques non magiques. S'il s'agit d'une arme à distance, la capacité est octroyée à ses munitions. » |
| **Dissimulée dans l'ombre** (20–23) | « La lame d'une arme de corps à corps paraît irréelle et fantomatique, et le même effet s'applique à la corde d'un arc ou d'une arbalète, et est transmis à ses munitions. **Les armures non magiques ne protègent pas** leurs porteurs des attaques d'une telle arme. » |
| **Funeste** (28–31) | « L'arme est imprégnée de magie de mort, emplissant les ennemis de terreur. L'utilisateur compte comme infligeant **Peur (1)**. » |
| **Taillée dans la rage** (36–39) | « Une fois l'arme dégainée [sous le coup de la colère], son utilisateur entre dans un état de **Frénésie**. » |
| **Robuste** (40–43) | « Le porteur **ignore les États *Exténué*** tant qu'il se bat avec l'arme. La lame possède également l'Atout **Incassable**. » |
| **Liée au destin** (44–47) | « Au début de chaque Round d'un combat, l'arme accorde **un Avantage** à son détenteur. » |
| **De colère implacable** (48–51) | « L'utilisateur d'une telle arme de corps à corps bénéficie des Talents suivants : **Coup puissant, Frappe assommante et Frappe blessante**. L'utilisateur d'une arme à distance bénéficie des Talents suivants : **Tireur d'élite, Tireur embusqué et Tir rapide**. » |
| **Déroutante** (55–57) | « Les individus qu'elle blesse subissent l'État ***Surpris***. » |
| **D'aplomb** (58–60) | « Le porteur de cette arme […] est **immunisé contre les effets de la *Peur*** et bénéficie d'un bonus de **+2 DR pour résister à la *Terreur***. » |
| **De sel et de saumure** (67–69) | « Le porteur de cette arme peut effectuer une **Action gratuite au premier Round de chaque combat**. Elle possède également l'Atout Rapide. » |
| **De crocs et de griffes** (73–75) | « Les créatures avec le Trait de créature **Bestial** reconnaissent une part d'elles-mêmes dans cette arme. Elles doivent réussir un Test de **Force Mentale Complexe (–10)** avant d'attaquer l'utilisateur. » |
| **Du bannissement le plus profond** (76–78) | « Cette arme dégage des énergies qui **repoussent les démons et les morts-vivants éthérés**. L'utilisateur compte toujours comme ayant **trois points d'Avantage supplémentaires** lors de la détermination des effets du **Trait Instable**. » |
| **De mort languissante** (82–84) | « Toutes les Blessures infligées par cette arme sont des ***Blessures Purulentes*** (WFJDR, page 186). » |
| **De féau** (88–90) | « Si elle inflige des Dégâts à un **type de créature précis**, le **nombre de Blessures est doublé**. Effectuez un lancer sur le *Tableau Créature aléatoire* (voir page 55) pour déterminer la créature affectée. » |
| **De coupure infinie** (91–92) | « Si un coup de cette arme inflige des Dégâts, la victime reçoit **deux Blessures supplémentaires**. » |
| **De blessure grave** (95–96) | « Lorsque l'utilisateur effectue un lancer sur le *Tableau des Blessures Critiques* (WFJDR, page 174), il peut **inverser les chiffres du résultat** et appliquer le plus dévastateur. » |
| **Lame du givre** (99) | « Si un coup inflige des Dégâts, le nombre de points de Blessures est **doublé et quatre points de Blessures supplémentaires** sont appliqués. Il n'existe aucune méthode pour fabriquer des armes à distance qui confèrent un tel effet à leurs munitions. Si vous obtenez ce résultat pour une arme à distance, il représente **1d10 munitions** imprégnées de la capacité ci-dessus. Si vous avez déjà obtenu *Arme légendaire* pour une arme à distance, ignorez ce résultat. » |
| **Arme légendaire** (00) | « Faites **deux jets** sur ce tableau. Si vous obtenez ce résultat plusieurs fois, une arme magique possède un **maximum de cinq capacités**. Les capacités en double ne peuvent pas être cumulées. » |

> Note de classement : *De plaies atroces* (70–72) et *De l'immense gueule du loup* (61–63) confèrent toutes deux l'Atout standard **Dévastatrice** ; *D'argent vif* et *De sel et de saumure* confèrent **Rapide** ; chaque Atout standard ainsi obtenu ne s'empile pas avec une autre source du même Atout (`ADE II 04 l.216`).

### Atouts des Munitions magiques (ADE II 4)

La fabrication de munitions magiques est encore plus rare que celle des armes magiques. **Récupération** : « Une flèche magique est **détruite si elle touche sa cible**. Les flèches qui manquent leurs cibles peuvent généralement être récupérées intactes. Il y a **90 %** de chances que cela se produise dans des conditions propices, mais cette probabilité est réduite à **50 %** ou moins si le terrain est rocheux ou marécageux. » — `ADE II 04 l.278`

| Capacité (plage d100) | Règle (verbatim ADE II) |
|---|---|
| **Flèche magique** (01–54) | « Cette flèche peut blesser des créatures qui sont immunisées aux attaques non magiques et inflige **+1 Dégât**, mais ne possède pas de capacité particulière. » |
| **Flèche de puissance** (55–74) | « Si un tir de Flèche de puissance inflige des Dégâts, la victime reçoit **1d10 Dégâts supplémentaires qui ignorent l'Armure et l'Endurance**. » |
| **Flèche de vol infaillible** (75–91) | « Ces flèches accordent **+30 en Capacité de Tir** lorsqu'elles sont décochées. » |
| **Flèches de grêle funeste** (92–00) | « Une fois décochée, une Flèche de grêle de mort se sépare en **1d10 flèches** en plein vol. Faites un jet d'attaque et de dégâts pour chaque flèche. Ces flèches peuvent toutes toucher la même cible, ou toucher des **cibles secondaires** qui se trouveraient à la fois **à moins d'1,50 mètre** de la cible principale et **dans la ligne de vue** du tireur. » |

**Sources RAW** :
- `LDB 62 l.217-307` — Atouts d'arme : À Enroulement, À Poudre noire, À Répétition (Indice), Assommante, Défensive, Perturbante, Dévastatrice, Empaleuse (+ retrait de projectile l.250), Explosion (Indice), Immobilisante, Piège-Lame, Pistolet, Pointue, Précise, Protectrice (Indice), Incassable, Percutante, Perforante, Rapide.
- `LDB 62 l.305-307` — Atout Taille (endommage de 1 PA une pièce d'armure/bouclier frappé tout en blessant).
- `LDB 62 l.309-335` — Défauts d'arme : Dangereuse, Épuisante, Imprécise, Inoffensive, Lente, Recharge (Indice).
- `AA 08 l.67-76` — Atouts Optionnels (choix avant le jet ; ex. marteau de guerre Assommante/Perforante ; défaut → premier Atout listé).
- `AA 08 l.79-95` — nouveaux Atouts/Défauts : Déséquilibrée, Déstabilisante, Taillade (XA), Tir de zone (Indice), Salve (Indice).
- `AA 08 l.98-108` — Atout Protectrice modifié (PA en opposition CC/Corps à Corps ; Protectrice 2+ pare les projectiles, exemple Uri).
- `ADE II 02 l.608-658` — armes ogres comme exemples d'Atouts (Défensive, Protectrice 1, Dévastatrice, Empaleuse, Percutante, Perforante, Pistolet, Recharge, Dangereuse, Explosion 3, Immobilisante de l'arbalète de siège).
- `ADE II 04 l.212` — distinction « utilisateur » (manie l'arme) vs « porteur » (la transporte).
- `ADE II 04 l.214` — **règle-cadre 1** : toute arme magique blesse les créatures immunisées aux attaques non magiques (Trait Éthéré).
- `ADE II 04 l.216` — **règle-cadre 2** : les Atouts conférés par la magie ne sont pas cumulables (un même Atout obtenu deux fois ne s'empile pas ; ex. Rapide).
- `ADE II 04 l.218-253` — **tableau d100 complet des Atouts d'armes magiques** (28 entrées) : 01-19 sans particularité, 20-23 Dissimulée dans l'ombre, 24-27 Embrasée, 28-31 Funeste, 32-35 D'argent vif, 36-39 Taillée dans la rage, 40-43 Robuste, 44-47 Liée au destin, 48-51 De colère implacable, 52-54 De sorcellerie inflexible, 55-57 Déroutante, 58-60 D'aplomb, 61-63 De l'immense gueule du loup, 64-66 D'habileté et de ruse, 67-69 De sel et de saumure, 70-72 De plaies atroces, 73-75 De crocs et de griffes, 76-78 Du bannissement le plus profond, 79-81 De matière excessive, 82-84 De mort languissante, 85-87 Du bord le plus tranchant, 88-90 De féau, 91-92 De coupure infinie, 93-94 D'or vif, 95-96 De blessure grave, 97-98 D'apparence évolutive, 99 Lame du givre, 00 Arme légendaire.
- `ADE II 04 l.278` — récupération des munitions magiques (90 % terrain propice, 50 % rocheux/marécageux ; détruite si elle touche).
- `ADE II 04 l.280-287` — **tableau d100 des Munitions magiques** : 01-54 Flèche magique (+1 Dégât, blesse l'immunisé), 55-74 Flèche de puissance (+1d10 ignorant Armure/Endurance), 75-91 Flèche de vol infaillible (+30 CT), 92-00 Flèches de grêle funeste (1d10 flèches, cibles secondaires à ≤1,50 m en LdV).
- `ZI 13 l.759-844` — Dague funeste, Lame à poignée bois de cerf, Trempe au sang de dragon (Atout Solide), Sève de trégara (Perforante), Empennage de griffon, Pointes barbelées (Hémorragique).
- `NADJ 08 l.170-171` — Pétard improvisé (Explosion 1, Dangereuse, 5 % En flammes).
- `ADE II 4 l.239` — effet magique « De plaies atroces » (70-72 du tableau d100) = Dévastatrice.

> « causent un Coup Critique sur n'importe quel nombre divisible par 10 (par exemple : 10, 20, 30, etc.), ainsi que sur un double (par exemple : 11, 22, 33) obtenu inférieur ou égal au Test approprié au combat. » — `LDB 62 l.248` (Empaleuse)

> « Les PA ne provenant pas de métal sont ignorés, et le premier point de toutes les autres armures est ignoré. » — `LDB 62 l.270` (Perforante)

> « Tout Test raté incluant un 9 sur le dé des dizaines ou des unités entraîne une Maladresse. » — `LDB 62 l.315` (Dangereuse)

> Funeste : « l'arme est imprégnée de magie de mort […]. L'utilisateur compte comme infligeant Peur (1) » — `ADE II 04 l.223`

> « De crocs et de griffes : les créatures avec le Trait de créature Bestial […] doivent réussir un Test de Force Mentale Complexe (–10) avant d'attaquer l'utilisateur. » — `ADE II 04 l.240`

> « De coupure infinie : des enchantements puissants guident sans peine l'arme à travers la chair et les os. Si un coup de cette arme inflige des Dégâts, la victime reçoit deux Blessures supplémentaires. » — `ADE II 04 l.246`

> « De blessure grave : les blessures infligées par cette arme sont douloureuses et graves. Lorsque l'utilisateur effectue un lancer sur le Tableau des Blessures Critiques (WFJDR, page 174), il peut inverser les chiffres du résultat et appliquer le plus dévastateur. » — `ADE II 04 l.248`

> « Flèche de puissance : si un tir de Flèche de puissance inflige des Dégâts, la victime reçoit 1d10 Dégâts supplémentaires qui ignorent l'Armure et l'Endurance. » — `ADE II 04 l.285`

**Voir aussi** : Tests et Degrés de Réussite (DR) ; Combat (localisation, dé inversé, Critiques) ; Maladresses ; États (Brisé, Sonné, Empêtré, À Terre, Hémorragique, En flammes, Empoisonné, Surpris, Exténué) ; Psychologie (Peur, Terreur, Frénésie) ; Traits — défense, résilience, créatures (Éthéré, Instable, Bestial) ; Talents (Coup puissant, Frappe assommante, Frappe blessante, Tireur d'élite, Tireur embusqué, Tir rapide) ; Armes (stats : Allonge, Dégâts, Groupes) ; Armures (PA, Dégâts d'armure) ; Qualités et Défauts d'objet (Solide, Incassable, Pratique, Peu Fiable) ; Objets magiques / Enchantements (génération ADE II 4).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 62` (l.217-307, l.309-335) → `a-enroulement`, `woundsFromHit`, `a-poudre-noire`, `TraceRow`, `CrewedReloadStep`, `isShieldItem`, `combatOrder`, `a-repetition`, `crewedReloadStep`, `protectrice`, +142 — `src/data/combat-stakes.json`, `src/data/etats.json`, `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/qualities.json`, `src/data/regles.json`, +51 fichiers
- `AA 8` (l.67-76, l.77, l.79-95, l.98-108) → `qualityRefSchema`, `doc`, `withArg`, `coutAvantageTexte`, `QualityInstance`, `cimeterre`, `dague-ballock`, `INDICE_TEMPLATE`, `destabilisante`, `taillade`, +10 — `src/data/index.ts`, `src/data/qualities.json`, `src/data/schemas/defs/qualities.ts`, `src/data/schemas/grammaire/reference.ts`, `src/data/trappings.json`, `src/engine/flowCore.ts`, +4 fichiers
- `ADE II 2` (l.608-658) → `attackModifiers`, `massue-ogre`, `poing-de-fer`, `grande-massue-ogre`, `lance-harpon`, `piege-a-chaines`, `grande-lance`, `canon-crache-plomb`, `pistolet-ogre`, `harpon`, +3 — `src/data/trappings.json`, `src/engine/combat.ts`
- `ADE II 4` (l.212, l.214, l.216, l.218-253) → `deroutante` — `src/data/qualities.json`
- `ZI 13` (l.759-844) → `dague-funeste`, `armure-de-plates-du-leviathan`, `lame-a-poignee-en-bois-de-cerf`, `trempe-au-sang-de-dragon`, `surin-de-l-aigle`, `seve-de-tregara`, `empennage-de-griffon`, `pointes-barbelees` — `src/data/trappings.json`
- sans code : `ADE II 4` (l.278, l.280-287), `NADJ 8` (l.170-171)

---

## Armures : table, PA, dégâts et réparation

Les **Armures** réduisent les dégâts subis en ajoutant des **Points d'Armure (PA)** à la Localisation touchée. Une armure couvre un ou plusieurs **emplacements** (Tête, Bras, Corps, Jambes), chacun protégé par les PA de la (ou des) pièce(s) qui le recouvrent. *« D'abord, évitez tout contact. C'est votre principe de base. Et si vous ne pouvez pas, portez toujours une protection… D'accord ? »* — Caporal « Nobbs » Nobbilar, Instructeur de combat de base.

### Schéma de description d'une armure (LDB 63 l.7-15)

Chaque armure est décrite selon les rubriques suivantes :

- **Type d'armure** : chaque armure est répertoriée par le matériau dans lequel elle est faite, en fonction de son efficacité de protection.
- **Prix** : le prix pour acheter une pièce moyenne de l'armure.
- **Enc** : l'Encombrement de l'armure.
- **Pénalité** : toute pénalité subie par le port de cette pièce d'Armure spécifique, **en plus de l'Encombrement**. *Remarque :* certaines armures entraînent une pénalité de port — p.ex. porter une cotte de mailles entraîne une pénalité de -10 en Discrétion.
- **Emplacement** : la Localisation que l'Armure protège.
- **PA** : le nombre de PA que l'armure confère à la Localisation.
- **Atouts et Défauts** : tous les Atouts (Flexible, Impénétrable) et Défauts (Partielle, Points faibles) que l'armure peut posséder.

### Table des Armures (LDB 63 l.38-61)

Verbatim, par matériau (Prix au format pièce/—, c.-à-d. en pièces — `CO` = Couronne d'or) :

| Armure | Prix | Enc | Disponibilité | Pénalité | Emplacements | PA | Atouts et Défauts |
|---|---|---|---|---|---|---|---|
| **CUIR SOUPLE** \* | | | | | | | |
| Calotte de cuir | 8/– | 0 | Commune | – | Tête | 1 | Partielle |
| Jambières de cuir | 14/– | 1 | Commune | – | Jambes | 1 | – |
| Justaucorps de cuir | 10/– | 1 | Commune | – | Corps | 1 | – |
| Veste de cuir | 12/– | 1 | Commune | – | Bras, Corps | 1 | – |
| **CUIR BOUILLI** | | | | | | | |
| Plastron de cuir | 18/– | 2 | Limitée | – | Corps | 2 | Points faibles |
| **MAILLES** \*\* | | | | | | | |
| Chausses de mailles | 2CO | 3 | Limitée | – | Jambes | 2 | Flexible |
| Chemise de mailles | 2CO | 2 | Limitée | – | Corps | 2 | Flexible |
| Coiffe de mailles | 1CO | 2 | Limitée | -10 % en Perception | Tête | 2 | Flexible, Partielle |
| Cotte de mailles | 3CO | 3 | Commune | – | Bras, Corps | 2 | Flexible |
| **PLATE** \*\* | | | | | | | |
| Brassards | 8CO | 3 | Rare | – | Bras | 2 | Impénétrable, Points faibles |
| Heaume | 3CO | 2 | Rare | -20 % en Perception | Tête | 2 | Impénétrable, Points faibles |
| Heaume ouvert | 2CO | 1 | Commune | -10 % en Perception | Tête | 2 | Partielle |
| Jambières d'acier | 10CO | 3 | Rare | -10 en Discrétion | Jambes | 2 | Impénétrable, Points faibles |
| Plastron | 10CO | 3 | Limitée | – | Corps | 2 | Impénétrable, Points faibles |

\* **Le cuir souple peut être porté sans pénalité sous n'importe quelle autre Armure.** (Règle de port — voir ci-dessous.)
\*\* **Porter n'importe quelle maille ou plate confère chaque fois une pénalité de -10 en Discrétion.** (Pénalité de Discrétion — voir ci-dessous.)

### Règle de port — Cuir souple sous une autre armure (LDB 63 l.60, note \*)

Le **cuir souple** est la seule armure que l'on peut superposer **sans pénalité** sous n'importe quelle autre Armure. Ses PA s'ajoutent donc à ceux de l'armure portée par-dessus (combinaison classique cuir souple + plate/maille). Le cuir bouilli, les mailles et la plate ne bénéficient pas de cette permission générale ; seul l'Atout **Flexible** (cf. plus bas) autorise une superposition cumulant les PA.

### Pénalité de Discrétion pour maille et plate (LDB 63 l.92, note \*\*)

**Porter n'importe quelle maille OU plate confère chaque fois une pénalité de -10 en Discrétion.** Cette pénalité est globale (s'applique au seul fait d'en porter), et **s'ajoute** aux pénalités de port spécifiques listées dans la colonne *Pénalité* (p.ex. les Jambières d'acier ont déjà « -10 en Discrétion » en propre, et les heaumes / coiffe ont des pénalités de Perception). Le cuir souple et le cuir bouilli n'imposent pas cette pénalité de Discrétion.

### Dégâts d'Armure (LDB 63 l.18-27)

Quand les coups pleuvent sur votre armure, elle peut être endommagée, éventuellement de façon permanente :

- **Chaque fois qu'une pièce d'armure est endommagée, les PA de l'emplacement endommagé sont réduits de 1.**
- **Si cela réduit les PA de l'emplacement en dessous de 0, l'Armure devient inutilisable.**

Les Armures sont généralement endommagées de **deux** façons :

1. **Une capacité spéciale se déclenche**, telle qu'un Sort ou un Talent, endommageant une pièce d'armure.
2. **Une Blessure Critique est déviée** (cf. Déviation Critique ci-dessous).

> Note de recoupement : l'Atout d'arme **Taille** (LDB 62/63 l.7-8) endommage aussi l'armure — *« Si vous touchez un adversaire, vous Endommagez de 1 Point une pièce d'armure ou un Bouclier frappé tout en blessant la cible. »*

### Déviation Critique (LDB 63 l.29-32)

**Cela ne se produit que si vous le choisissez.** Si vous subissez une **Blessure Critique** issue d'une attaque visant un emplacement protégé par une armure, vous pouvez choisir de laisser votre armure être **endommagée de 1 PA** dans le but d'**ignorer la Blessure Critique**.

- Vous subissez **toujours les Blessures normales** (les PB ordinaires sont infligés quoi qu'il arrive).
- Étant donné que vos PA sont à présent réduits de 1 Point, **vous subissez probablement une Blessure supplémentaire**, mais vous **évitez les effets de la Blessure Critique** (la table de Critique), car le coup est absorbé par votre armure à présent endommagée.

### Atout d'armure — Flexible (LDB 63 l.73-74)

Une armure **Flexible** peut être portée **sous une couche d'armure non Flexible** si vous le souhaitez. Si c'est le cas, **vous gagnez les bénéfices des deux** (les PA de la pièce Flexible et ceux de la pièce rigide se cumulent à l'emplacement commun). Dans la table, les mailles (Chausses, Chemise, Coiffe, Cotte) portent l'Atout Flexible.

### Atout d'armure — Impénétrable (LDB 63 l.77-78)

L'armure est particulièrement résistante : la plupart des attaques ne peuvent tout simplement pas la pénétrer. **Toutes les Blessures Critiques causées par un nombre impair pour vous toucher, tel que 11 ou 33, sont ignorées.** (On regarde le jet de toucher de l'attaquant : si le d100 obtenu est impair, le Critique est annulé.) Dans la table, la plate (Brassards, Heaume, Jambières d'acier, Plastron) porte cet Atout.

### Défaut d'armure — Partielle (LDB 63 l.85-86)

L'armure **ne couvre pas entièrement la Localisation**. Un adversaire qui obtient un **nombre pair** pour vous toucher, **ou** obtient un **Coup Critique**, **ignore les PA de l'armure Partielle**. Dans la table : Calotte de cuir, Coiffe de mailles, Heaume ouvert.

### Défaut d'armure — Points Faibles (LDB 63 l.89-90)

L'armure possède de petits Points faibles où une lame peut facilement se glisser si votre adversaire est suffisamment habile ou chanceux. **Si votre adversaire possède une arme avec l'Atout Empaleuse ET obtient un Critique, les PA de votre armure sont ignorés.** Dans la table : Plastron de cuir, et toute la plate (Brassards, Heaume, Jambières d'acier, Plastron).

### Réparer une Armure (LDB 63 l.63-66)

- Réparer une armure coûte **10 % de son prix de base PAR PA perdu**.
  *Exemple RAW :* une Chemise de mailles à manches avec 1 PA de Dégâts au Corps **et** 1 PA aux Bras → 2 PA perdus → **20 % du prix de base**, soit **12/–** ici.
- Si une partie de votre armure est **complètement brisée**, la réparer coûte **30 % du prix de base** de l'armure, et vous attendrez probablement un certain temps avant que la réparation soit terminée.
- Vous pouvez aussi **réparer votre propre armure** si vous possédez la **Compétence Métier appropriée**, les **Outils de profession** et **un atelier** (pour une Armure de Plate).

### PA naturels et Déviation (consolidation EDO — mutation Écailles Épineuses)

Certaines sources naturelles de PA **ne peuvent pas servir à la Déviation Critique**. La mutation **Écailles Épineuses** (EDO 11) en est l'exemple canon : *« Gagnez +1 PA sur tous les emplacements. Ce PA ne peut pas être utilisé pour la Déviation Critique. »* (En contrepartie : perdez 10 de Dextérité et de Sociabilité.) Autrement dit, ces PA protègent normalement, mais comme ce ne sont pas des pièces d'armure « endommageables », ils ne fournissent pas le « 1 PA à sacrifier » qu'exige la Déviation Critique.

**Sources RAW** :
- `LDB 63 l.7-15` — Schéma de description d'une armure (Type, Prix, Enc, Pénalité, Emplacement, PA, Atouts et Défauts).
- `LDB 63 l.38-61` — Table des Armures complète (cuir souple, cuir bouilli, mailles, plate : Prix/Enc/Disponibilité/Pénalité/Emplacements/PA/Atouts-Défauts) + les deux notes de port (\* cuir souple sous autre armure sans pénalité ; \*\* maille/plate = -10 Discrétion).
- `LDB 63 l.18-27` — Dégâts d'Armure : chaque coup endommageant retire 1 PA ; PA < 0 = armure inutilisable ; deux sources (capacité spéciale ; Blessure Critique déviée).
- `LDB 63 l.29-32` — Déviation Critique : choix de sacrifier 1 PA à la localisation pour ignorer la Blessure Critique ; PB normaux toujours subis (et probablement +1 Blessure car PA réduits).
- `LDB 63 l.63-66` — Réparer une Armure : 10 % du prix de base par PA perdu ; 30 % si pièce complètement brisée ; auto-réparation possible (Métier + Outils + atelier pour la plate).
- `LDB 63 l.73-74` — Atout Flexible : portable sous une couche non Flexible, bénéfices des deux (PA cumulés).
- `LDB 63 l.77-78` — Atout Impénétrable : Critiques causés par un jet de toucher impair (11, 33…) ignorés.
- `LDB 63 l.85-86` — Défaut Partielle : jet de toucher pair OU Coup Critique → PA de la pièce Partielle ignorés.
- `LDB 63 l.89-90` — Défaut Points Faibles : arme Empaleuse + Critique → PA ignorés.
- `LDB 62 l.307` — Atout d'arme Taille : une touche endommage de 1 Point une pièce d'armure ou un Bouclier frappé (autre source de Dégâts d'Armure).
- `EDO 11 l.192-196` — Mutation Écailles Épineuses : +1 PA sur tous les emplacements, mais ce PA n'est pas utilisable pour la Déviation Critique ; -10 Dextérité et -10 Sociabilité.

> « Chaque fois qu'une pièce d'armure est endommagée, les PA de l'emplacement endommagé sont réduits de 1. […] Si cela réduit les PA de l'emplacement en dessous de 0, l'Armure devient inutilisable. » — `LDB 63 l.19-21`

> « Réparer une armure coûte 10 % de son prix de base par PA perdu. […] Si une partie de votre armure est complètement brisée, la réparer vous coûtera 30 % du prix de base de l'armure » — `LDB 63 l.64`

**Voir aussi** : Armes — table, Atouts et Défauts d'arme (Empaleuse, Taille) ; Localisation et Point d'Impact des Créatures (PA des créatures) ; Blessures Critiques (Traumatisme, table par localisation) ; Encombrement et pénalités de port ; Corruption et mutations (PA naturels).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 62` (l.307) → `InitiativeStripProps`, `canActFirst`, `freeActFirst`, `resolveQualities`, `defensive`, `useAttackJetProps`, `devastatrice`, `CampaignView`, `empaleuse`, `rapideParryMod`, +34 — `src/data/combat-stakes.json`, `src/data/etats.json`, `src/data/flow-stakes.json`, `src/data/qualities.json`, `src/data/reglesOptionnelles.json`, `src/engine/combat.ts`, +8 fichiers
- `LDB 63` (l.7-15, l.18-27, l.29-32, l.38-61, l.63-66, l.73-74, l.77-78, l.85-86, l.89-90, l.92) → `itemRepairCostBrass`, `doc`, `repairCost`, `cuir-souple`, `cuir-bouilli`, `mailles`, `plate`, `sacs-et-contenants`, `GameOp`, `repairItem`, +45 — `src/data/index.ts`, `src/data/qualities.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/qualities.ts`, `src/data/trappings.json`, `src/data/weaponGroups.json`, +10 fichiers
- `EDO 11` (l.192-196) → `chair-necrosee`, `cretin`, `pattes-chevre`, `tete-bestiale-chien`, `digere`, `tete-pointue`, `absorption`, `amorphe`, `contagieux` — `src/data/etats.json`, `src/data/mutations.json`, `src/data/traits.json`

---

## Localisation des créatures non humaines

Quand une attaque porte, la **Localisation** (point d'impact) s'obtient toujours en **inversant le résultat du dé de touche**, puis en lisant ce nombre sur le Tableau de Localisation approprié. Le tableau de référence est le Tableau humanoïde (LDB 13) : un toucher de `23` devient `32` après inversion, soit un coup au **Bras droit**.

Les créatures « dont la forme du corps est différente », ou un adversaire monté, n'utilisent **pas** le tableau humanoïde : on se reporte au chapitre Bestiaire (LDB 76, « Point d'Impact des Créatures »). Le principe est volontairement simple :

- **Quadrupèdes** : remplacez les **bras** par les **membres antérieurs**, et les **jambes** par les **membres postérieurs**. (Même tableau, mêmes cases, mêmes Tableaux de Critiques ; seule l'étiquette de la zone change.)
- **Oiseaux** (et formes ailées équivalentes) : remplacez les **bras** par les **ailes**. (Idem : même tableau humanoïde, étiquette « aile ».)
- **Serpents** et **araignées** : ces formes demandent une attention particulière — on utilise les **Localisations Alternatives** ci-dessous (tableaux dédiés, plages d100 différentes).

Le dé inversé reste l'entrée commune à tous ces tableaux : ce sont seulement les plages et les noms de zones qui changent d'une forme à l'autre.

### Tableau de Localisation — Serpents (Localisations Alternatives)

| d100 (dé inversé) | Zone touchée |
|---|---|
| 01–19 | Tête |
| 20–00 | Corps |

*(LDB 76 l.22-25 — `00` = 100.)*

### Tableau de Localisation — Araignées (Localisations Alternatives)

| d100 (dé inversé) | Zone touchée |
|---|---|
| 01–09 | Tête |
| 10–79 | Pattes |
| 80–00 | Abdomen |

*(LDB 76 l.22-26 — `00` = 100. La Tête couvre une plage plus large que chez le serpent ; le gros du corps de l'araignée se résout en « Pattes ».)*

### Tableau de Localisation humanoïde (référence, pour comparaison)

| d100 (dé inversé) | Zone touchée |
|---|---|
| 01-09 | Tête |
| 10-24 | Bras gauche (ou bras secondaire) |
| 25-44 | Bras droit (ou bras principal) |
| 45-79 | Corps |
| 80-89 | Jambe gauche |
| 90-00 | Jambe droite |

*(LDB 13 l.137-153 — c'est le tableau que quadrupèdes et oiseaux relisent sous d'autres étiquettes.)*

### Règle : créature de 2 catégories de Taille supérieures

> « Pour toute créature de 2 catégories plus grande que vous (voir Taille page 342), choisissez une Localisation correspondant à ce qui est le plus proche de vous (ou en Ligne de Vue pour tirer). » — `LDB 76 l.19`

Concrètement : face à un adversaire **au moins 2 catégories de Taille au-dessus** de l'attaquant, on **choisit** la Localisation atteinte (la zone la plus proche au corps à corps, ou en Ligne de Vue au tir) **au lieu d'inverser le dé**. Ce choix est **gratuit** : il ne coûte pas le malus de Localisation visée (le −10 « Complexe » appliqué quand on vise une zone précise sur une cible de Taille normale). Pour une cible seulement +1 catégorie, viser coûte encore le malus habituel.

### Règle : critique sur une localisation sans Tableau de Critiques (tentacule, queue, aile)

> « Si un animal possède une Localisation sans Tableau de Critiques, comme un tentacule, une queue ou une aile, faites un jet sur le Tableau des Bras et décrivez le résultat de façon appropriée. » — `LDB 76 l.21`

Autrement dit, lorsqu'un Coup Critique frappe un membre exotique (tentacule, queue, aile) pour lequel il n'existe **pas** de table de Critiques dédiée, on **tire sur le Tableau des Critiques des Bras**, puis on **redécrit** narrativement le résultat de façon adaptée au membre touché.

### Notes complémentaires de cadrage (LDB 76)

- Les créatures du Bestiaire sont des exemples génériques à personnaliser (Compétences, Talents, Traits de créature). Toutes possèdent un ou plusieurs **Traits de créature** standard ; n'importe quel Trait peut être appliqué à n'importe quelle créature selon le besoin de jeu.
- La **Localisation** d'une créature reste donc une étape mécanique distincte de son profil : c'est la **forme corporelle** (humanoïde / quadrupède / oiseau / serpent / araignée), pas son profil de Traits, qui détermine quel tableau lire après inversion du dé.

**Sources RAW** :
- `LDB 76 l.16-19` — Principe général : pour une forme non humaine, c'est « assez simple » : quadrupède = bras→membres antérieurs, jambes→membres postérieurs ; oiseaux = bras→ailes ; serpents et araignées = Localisations Alternatives dédiées.
- `LDB 76 l.21-26` — Tableaux des Localisations Alternatives **verbatim** : Serpents (01–19 Tête, 20–00 Corps) et Araignées (01–09 Tête, 10–79 Pattes, 80–00 Abdomen).
- `LDB 76 l.40` — Créature de 2 catégories de Taille supérieures : on **choisit** la Localisation (la plus proche / en Ligne de Vue), au lieu d'inverser le dé.
- `LDB 76 l.41` — Localisation sans Tableau de Critiques (tentacule, queue, aile) : tirer sur le **Tableau des Bras** et redécrire le résultat.
- `LDB 13 l.132-144` — La Localisation s'obtient toujours en **inversant le lancer obtenu** ; les créatures à forme différente ou les adversaires montés utilisent d'**autres Tableaux de Localisation** (renvoi au Bestiaire).
- `LDB 13 l.137-153` — Tableau de Localisation humanoïde **verbatim** (la base que quadrupède/oiseau relisent sous d'autres étiquettes).

> « Pour les quadrupèdes, remplacez simplement les bras par les membres antérieurs, et les jambes par les membres postérieurs. Pour les oiseaux, remplacez les bras par les ailes. » — `LDB 76 l.17`

**Voir aussi** : Tableau de Localisation humanoïde ; Coups Critiques et Tableaux de Critiques ; Taille des créatures et catégories ; Localisation visée (coup ciblé / malus −10).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 13` (l.132-153) → `localisation`, `useDefenseJetProps`, `hitLocation`, `useAttackJetProps`, `toucheSauvee`, `Condition`, `hitModifiers`, `FLOWS`, `createCombatSlice`, `previewDefense`, +7 — `src/data/localisation.json`, `src/data/schemas/defs/localisation.ts`, `src/engine/combat.ts`, `src/engine/flowCore.ts`, `src/state/combat/hitModifiers.ts`, `src/state/combatFlow.ts`, +5 fichiers
- `LDB 76` (l.16-19, l.21-26, l.40, l.41) → `traitsStandard`, `SPECIES_BODY_SHAPE`, `bodyShapeForSpecies`, `bodyShapeOf`, `fr`, `BODY_SHAPE_LOC_LABELS`, `locationLabel`, `doc`, `critTableKeyFor`, `SceneEntity`, +9 — `src/data/criticals.ts`, `src/data/index.ts`, `src/data/schemas/defs-scenes/scene.ts`, `src/data/schemas/defs/criticals.ts`, `src/data/schemas/defs/localisation.ts`, `src/engine/bodyForm.ts`, +7 fichiers

---

## Schéma de profil et Traits standard de créature

Le Bestiaire de WFRP4 ne décrit pas chaque monstre par des règles ad hoc : chaque créature est un **profil de Caractéristiques** plus une liste de **Traits de créature** (capacités/comportements packagés). Une créature « générique » représente son espèce ; le MJ la **personnalise** en ajoutant Compétences, Talents, ou d'autres Traits. C'est le système universel d'adversaires : *« toutes les créatures possèdent un ou plusieurs Traits de créature standard, mais d'autres peuvent être ajoutés si besoin est, et peuvent être mêlés à des Compétences et des Talents »* (`LDB 76 l.9`).

### 1. Schéma des Profils du Bestiaire (`LDB 76`)

Chaque entrée de créature suit ce gabarit (`LDB 76 l.38-45`) :

- **Nom :** le nom de la créature.
- **Description :** texte de présentation.
- **Attributs :** les 12 Attributs (caractéristiques) de la créature, plus **B** (Blessures). Une caractéristique notée **–** (tiret) est **inexistante** chez cette créature (ex. l'Amibe n'a ni CT, ni I, ni Int, ni FM, ni Soc) ; un Test requis sur une caractéristique absente est traité selon le Trait qui régit la créature (cf. *Décérébré*, *Fabriqué*).
- **Traits :** les Traits de créature que la créature **possède presque toujours** (ses Traits fixes).
- **Facultatif :** Traits de créature courants que l'on **peut ajouter** si l'on crée sa propre version.

La ligne de profil emploie l'ordre canonique des 12 colonnes + Blessures :

| M | CC | CT | F | E | I | Ag | Dex | Int | FM | Soc | B |
|---|----|----|---|---|---|----|-----|-----|----|-----|---|

— `LDB 77 l.11-13` (en-tête de profil PNJ standard ; M = Mouvement, B = Blessures)

**Profils PNJ standard** (à utiliser tel quel pour un PNJ rapide, puis ajouter des Traits selon les besoins ; *« Les traits listés dans les Traits standard de créature sont les meilleurs choix de départ »* — `LDB 77 l.7`) :

| Profil | M | CC | CT | F | E | I | Ag | Dex | Int | FM | Soc | B | Traits | Facultatif |
|---|---|----|----|---|---|---|----|-----|-----|----|-----|---|---|---|
| Humain | 4 | 30 | 30 | 30 | 30 | 30 | 30 | 30 | 30 | 30 | 30 | 12 | Arme +7, Préjugé (un au choix) | À distance +8 (50), Lanceur de Sorts, Maladie |
| Nain | 3 | 40 | 30 | 30 | 40 | 30 | 20 | 40 | 30 | 50 | 20 | — | Animosité (une catégorie au choix), Arme +7, Haine (peaux-vertes), Préjugé (un au choix), Résistance à la Magie, Vision nocturne | À distance +8 (50), Rage |
| Halfling | 3 | 20 | 40 | 20 | 30 | 30 | 30 | 40 | 30 | 40 | 40 | — | Arme +5, Taille (Petite), Vision nocturne | À distance +7 (25), Furtif |
| Elfe (Haut et Sylvain) | 5 | 40 | 40 | 30 | 30 | 50 | 40 | 40 | 40 | 40 | 30 | — | Animosité (une catégorie au choix), Arme +7, Préjugé (un au choix), Vision nocturne | À distance +9 (150), Arboricole, Furtif, Lanceur de Sorts (un au choix), Magique, Pisteur, Résistance à la Magie |
| Ogre | 6 | 30 | 20 | 45 | 45 | 10 | 25 | 20 | 20 | 30 | 20 | 30 | Affamé, Arme +8, Armure (Peau 1), Préjugé (Maigrichons), Taille (Grande), Vision nocturne | Belliqueux, Infecté, Pisteur |

— `LDB 77 l.10-68` (les B vides — Nain/Halfling/Elfe — ne sont pas chiffrés dans le profil rapide : se calculent par la formule de Taille, cf. §6)

### 2. Localisations pour les créatures non humaines (`LDB 76`)

Quand il faut une Localisation pour un corps non humain, on **remappe les membres** : pour un quadrupède, bras → membres antérieurs et jambes → membres postérieurs ; pour un oiseau, bras → ailes (`LDB 76 l.18`). Serpents et araignées ont leur propre table d'**Localisations Alternatives** :

| Serpents (d100) | Localisation |  | Araignées (d100) | Localisation |
|---|---|---|---|---|
| 01–19 | Tête |  | 01–09 | Tête |
| 20–00 | Corps |  | 10–79 | Pattes |
|  |  |  | 80–00 | Abdomen |

— `LDB 76 l.22-26` (table verbatim ; « 00 » = 100)

Règles annexes du schéma de localisation :
- Pour une créature **2 catégories de Taille plus grande** que vous (cf. §6), choisissez une Localisation correspondant à ce qui est le plus proche de vous (ou en Ligne de Vue pour tirer) — `LDB 76 l.40`.
- Une Localisation **sans Tableau de Critiques** (tentacule, queue, aile) : faites le jet sur le **Tableau des Bras** et décrivez le résultat de façon appropriée — `LDB 76 l.41`.

### 3. Traits Standard de Créature — règle d'application universelle (`LDB 76`)

Les **Traits standard de créature** sont *« ajoutés à la liste Facultative de toutes les créatures »* (`LDB 76 l.33`) : autrement dit, pour personnaliser n'importe quelle créature, on peut toujours piocher dans cette liste en plus de ses Facultatifs propres. La liste (15 Traits) :

> *Animosité, Arme, Armure, Brutal, Coriace, Craintif, Élite, Endurant, Grand, Haine, Intelligent, Meneur, Préjugé, Rapide, Rusé* — `LDB 76 l.35`

**Remarque** (`LDB 76 l.37`) : la plupart des créatures ont une **Arme** suggérée, et parfois une **Armure** ; rien n'empêche de les modifier. (« Craintif » est le libellé de la liste standard pour le Trait détaillé *Effrayé (Cible)* dans `LDB 85`.)

### 4. Traits Facultatifs des créatures — règle de personnalisation (`LDB 76`)

Les Traits **Facultatifs** listés à côté d'une créature *« représentent certains des Traits les plus courants de l'espèce »* (`LDB 76 l.11`). La règle de personnalisation est **totalement libre** :

> *« Cependant, vous pouvez choisir d'appliquer n'importe quel Trait à n'importe quelle créature si cela correspond à ce que vous voulez utiliser dans votre partie. »* — `LDB 76 l.11`

Donc : Traits fixes (presque toujours présents) + Facultatifs propres + 15 Traits standard + n'importe quel autre Trait au gré du MJ. Le sous-système des Traits eux-mêmes est détaillé `LDB 85` (renvoi `LDB 76 l.13`).

### 5. Catalogue des Traits de créature (`LDB 85`) — effets mécaniques

Liste complète des Traits du Livre de base, avec leur effet exact. (Indice) = valeur chiffrée entre parenthèses dans le profil ; (Cible)/(Type)/(Difficulté)/(Divers) = paramètre.

| Trait | Effet mécanique (RAW) |
|---|---|
| **À distance (Indice) (Portée)** | Arme à distance : Indice Dégâts, portée = Portée mètres. |
| **À sang-froid** | Peut **inverser** tous ses Tests de **FM** échoués. |
| **Affamé** | Si elle tue/neutralise un adversaire (ou tombe sur un cadavre récent) : Test **FM Accessible (+20)** ou festoie → perd sa prochaine Action ET son prochain Mouvement. |
| **Amphibie** | Ajoute son bonus d'**Ag** au DR de tous les Tests de **Natation** ; se déplace à sa vitesse de Mouvement max dans l'eau. |
| **Animosité (Cible)** | N'aime pas la Cible (règles d'Animosité, Psychologie). |
| **Arboricole** | En région boisée : +bonus d'**Ag** au DR des Tests d'**Escalade** et **Discrétion**. |
| **Arme (Indice)** | Arme de corps à corps (dents/griffes/etc.) : Indice Dégâts (**bonus de F déjà inclus**). Par défaut **4 + bonus de F** (arme simple). |
| **Armure (Indice)** | Indice **PA** à toutes les Localisations. *(ZI affiche un 2ᵉ chiffre = Indice + BE, soustrait des Dégâts — cf. §7.)* |
| **Attaque Caudale (Indice)** | Attaque gratuite **(coût 1 Avantage)** : Indice Dégâts (bonus de F inclus). Cible de Taille inférieure qui perd des PB → État **À Terre**. |
| **Belliqueux** | Tant qu'elle a **plus d'Avantages** que son adversaire : gagne **Immunité Psychologique**. |
| **Béni (Divers)** | Peut accorder des **Bénédictions** (divinité entre parenthèses). |
| **Bestial** | Pas de pensée/langage. Peur du feu → État **Brisé** si touchée par le feu. Ne défend qu'en **Esquive**. Si perd > moitié de ses Blessures → fuit, sauf si protège son petit / acculée / Territorial → **Frénésie**. Pas de carac de **Soc**. |
| **Bond** | En Charge/Course : **double** son Mouvement ; ignore terrains et personnages interposés. |
| **Brutal** | **−1 M, −10 Ag, +10 F, +10 E**. |
| **Champion** | S'il gagne un Test opposé en **se défendant** au corps à corps : cause autant de Dégâts que s'il était l'attaquant. |
| **Constricteur** | Tout coup réussi → État **Empêtré** ; peut entamer une **Empoignade**. |
| **Coriace** | **+10 E, +10 FM**. |
| **Cornes (Aspect), (Indice)** | En gagnant un Avantage pour **Charger** : Attaque gratuite de Cornes, Indice Dégâts (bonus de F inclus). |
| **Corruption (Degré)** | Corrompue par le Chaos ; Degré entre parenthèses (règles de Corruption). |
| **Corruption Mentale** | Jet sur le **Tableau de la Corruption Mentale**. |
| **Démoniaque (Indice)** | Pas besoin d'eau/nourriture/air. Attaques **Magiques**. Après chaque coup reçu, lancez **1d10** : ≥ Indice → coup ignoré (même Critique). À 0 PB → l'âme retourne aux Royaumes du Chaos (retirée du jeu). |
| **Dressé (Compétences spécifiques)** | Animal entraîné (Dressage) ; disciplines : Divertir (+10), Dompté (ignore Bestial, +2d10 Soc), Garder (gagne Territorial), Guerre (+10 CC, ignore Nerveux/bruits), Magie (ignore Nerveux/magie), Monture, Rapporter, Revenir à la maison, Trait (tractage). |
| **Effrayé (Cible)** | A **Peur 0** de la Cible (Psychologie). *(= « Craintif » de la liste standard.)* |
| **Élite** | **+20 CC, +20 CT, +20 FM**. |
| **Endurant** | **+PB = bonus d'Endurance** (appliqué **avant** tout modificateur de Taille). |
| **Éthéré** | Immatérielle ; ne peut être blessée que par des Attaques **magiques**. |
| **Étreinte Glaciale** | **(coût 2 Avantages + Action)** : Test opposé **CC/Corps à corps** ou **Esquive**. Succès → adversaire perd **1d10 + DR** Blessures ignorant **BE et PA**. Attaque magique. |
| **Fabriqué** | Stupide ; pas d'**Int/FM/Soc** (Tests auto-réussis). Sans sorcier/Territorial → erre. Blessures calculées avec **bonus de F** au lieu du bonus de FM. Attaques Magiques. |
| **Fouissement (Indice)** *(ZI)* | Creuse sur Indice mètres ; ignore obstacles/terrain ; peut Charger. Cible enfouie : portée du tir **+2 niveaux** (Longue/Extrême → impossible). |
| **Foulée** | **×1,5** le Mouvement de **Course**. |
| **Frénésie** | Peut entrer en **Frénésie** (Psychologie). |
| **Furtif** | +bonus d'**Ag** au DR de tous les Tests de **Discrétion**. |
| **Grand** | **+10 F, +10 E, −5 Ag**. |
| **Grimpant** | Vitesse de Mouvement max sur surfaces verticales/plafonds ; réussit auto tous les Tests d'**Escalade**. |
| **Haine (Cible)** | Hait la Cible (règles de Haine). |
| **Hurlement Fantomatique** | **(coût tous les Avantages, min 2 ; n'utilise pas l'Action)** : toute créature vivante (non Mort-vivant) à I mètres subit **1d10** Blessures ignorant **BE et PA** ; Test **Résistance Accessible (+20)** ou État **Brisé** ; toutes les cibles gagnent **3 États Assourdi**. |
| **Immunité (Type)** | Ignore totalement les Dégâts du Type (poison/magie/électricité…), Critiques inclus. |
| **Immunité Psychologique** | Ignore les règles de **Psychologie**. |
| **Increvable** | Critiques non mortels soignables en recollant les parties. À la « mort » avec parties en place : Test **Résistance Intermédiaire (+0)** exigeant **DR 6**, retentable au début de chaque Round pendant **bonus d'Endurance** Rounds ; succès → revient avec **1 PB**. |
| **Infecté** | Si fait perdre des PB à un adversaire non Mort-vivant → Test **Résistance Facile (+40)** ou **Blessure Purulente**. |
| **Infravision** | Voit dans l'obscurité comme en plein jour. |
| **Insensible à la Douleur** | Ignore les pénalités de Critiques **non issus d'amputations** (les États sont subis normalement). |
| **Instable** | À la fin d'un Round Engagée avec un adversaire d'**Avantage supérieur** : perd PB = différence d'Avantage. À 0 PB → « meurt ». |
| **Intelligent** | **+20 Int, +10 I**. |
| **Lanceur de Sorts (Divers)** | Peut lancer des Sorts (type de magie entre parenthèses). |
| **Langue Préhensile (Indice) (Portée)** | Attaque gratuite **(coût 1 Avantage)** à distance, Indice Dégâts. Touche → État **Empêtré** ; cible de Taille inférieure tirée vers la créature ; puis relâcher / Attaque d'Arme gratuite / Empoignade. |
| **Limicole** | Pas de pénalité de Mouvement en terrain marécageux. |
| **Magique** | Toutes ses Attaques sont **Magiques**. |
| **Maladie (Type)** | Porteuse de la maladie Type ; les autres Testent pour éviter la Contraction. |
| **Meneur** | **+10 Soc, +10 FM**. **Ne peut pas** être pris avec **Bestial**. |
| **Miracles (Divers)** | Peut accomplir des **Miracles** (divinité entre parenthèses). |
| **Morsure (Indice)** | Attaque gratuite **(coût 1 Avantage)** : Indice Dégâts (bonus de F inclus). |
| **Mort-Vivant** | Ni vivant ni mort ; indépendant d'air/nourriture/eau (sert de cible aux effets « affecte les morts-vivants »). |
| **Mutation** | Jet sur le **Tableau des Corruptions physiques**. |
| **Nerveux** | Effrayée par magie/bruits forts → **+3 États Brisé**. |
| **Nuée** | Ignore Psychologie, **toutes les règles de Taille**, et l'Engagement pour le Mouvement. Attaque réussie → règle **Frappe mortelle**. Adversaires Engagés perdent **1 PB** à la fin de chaque Round. PB = **×5** celui d'une créature type ; **+10 CC** ; tirs contre elle **+40** au toucher. |
| **Parasité** | Adversaires : **−10** pour la toucher au corps à corps. |
| **Perturbant** | Tout le monde à **bonus d'Endurance** mètres : **−20** à tous les Tests (une seule fois par cible, quel que soit le nombre de créatures Perturbantes). |
| **Peur (Indice)** | Suscite **Peur** = Indice (Psychologie). |
| **Pisteur** | **+DR = bonus d'Initiative** à tous les Tests de **Pistage**. |
| **Préjugé (Cible)** | N'apprécie pas la Cible (règles de Préjugés). |
| **Protection (Indice)** | Après chaque coup reçu, **1d10** : ≥ Indice → coup ignoré (même Critique). |
| **Rage** | **(coût tous Avantages, min 1)** → Haine en mêlée ; **(coût tous Avantages, min 3)** → **Frénésie**. |
| **Rapide** | **+1 M, +10 Ag**. |
| **Redoutable (Indice)** *(ZI)* | Si au début de son Tour ses Avantages < Indice (défaut 1) et qu'elle n'est ni **Surprise** ni **Empêtrée** ni **Inconsciente** : ses Avantages remontent à l'Indice. |
| **Regard Pétrifiant** | **(coût ≥ 1 Avantage, Action)** : Test opposé **CT/Initiative** (+1 DR par Avantage). Adversaire : 1 État **Sonné** par **2 DR** ; à **6 DR ou +** → pétrifié définitivement. Contre un Lanceur de Sorts : opposable à **Langue (Magick)**. |
| **Régénération** | Début de Round, > 0 PB → régénère **1d10 PB** ; à 0 PB → **1d10**, sur **8+** régénère **1 PB** ; sur **10** régénère **aussi une Blessure Critique**. Blessures de **Feu** non régénérables. |
| **Résistance à la Magie (Indice)** | DR de tout Sort l'affectant **réduit de l'Indice**. |
| **Rusé** | **+10 Soc, +10 Int, +10 I**. |
| **Sang Corrosif** | Quand elle subit des Blessures, tous les Engagés avec elle reçoivent **1d10** PB modifiés par **BE et PA** (min 1). |
| **Se Cabrer** | Pour une Action de Mouvement : **Attaque de Piétinement** si plus grande que l'adversaire. |
| **Souffle (Indice) (Type)** | Attaque gratuite **(coût 2 Avantages)** : cible visible à **BE + 20** mètres ; tous à **bonus de F de la cible** mètres + tous entre les deux sont touchés. Test opposé **CT/Esquive** par cible ; échec → Indice Dégâts d'Arme. Types : **Froid** (Sonné par 5 Blessures), **Corrosif** (Armes/Armures −1), **Feu** (ignore PA + Enflammé), **Électricité** (ignore PA + Sonné), **Poison** (ignore PA + Empoisonné), **Fumée** (bloque la LdV pendant BE Rounds). Immunisée à son propre Souffle ; Attaque magique. |
| **Stupide** | (≠ Bestial.) Sans allié non-Stupide à ses côtés : Test **Intelligence Facile (+40)** au début de chaque Round ; échec → perd Mouvement **et** Action. |
| **Taille (Divers)** | 7 catégories (Minuscule → Monstrueuse) ; modifie profil, Dégâts, Peur/Terreur, Blessures (cf. §6). |
| **# Tentacules (Indice)** | **1 Attaque gratuite par tentacule** : Indice Dégâts (bonus de F inclus). Touche → État **Empêtré** + Empoignade par ce tentacule. |
| **Terreur (Indice)** | Suscite **Terreur** = Indice (Psychologie). |
| **Territorial** | Combat jusqu'à la mort pour défendre sa zone ; ne poursuit pas les fuyards hors zone. |
| **Toile (Indice)** | Tout coup réussi → État **Empêtré** de Force Indice. |
| **Vampirique** | Une Morsure réussie soigne **autant de PB que l'adversaire en perd** (seule façon de se soigner). |
| **Venin (Difficulté)** | Une Attaque venimeuse qui inflige des PB → État **Empoisonné** ; sans Difficulté indiquée, le Test est **Intermédiaire**. |
| **Vision Nocturne** | Possède le **Talent Vision nocturne**. |
| **Vol (Indice)** | Vole jusqu'à Indice mètres en se Déplaçant ; ignore terrains/obstacles/personnages ; peut Charger. Cible volante : distance **+1** (Extrême → intouchable). En vol : **−20** au combat à distance. |
| **Vomissement** | Attaque gratuite **(coût 3 Avantages)** : cible visible à **BE** mètres ; tout à ≤ 2 m touché aussi. Test opposé **CT/Esquive** (**Facile +40** pour elle, **Intermédiaire +0** pour l'adversaire). Échec → **BE + 4** Dégâts d'Arme + État **Sonné** ; Armes/Armures touchées **−1**. |

— `LDB 85 l.9-447` (catalogue complet) ; **Fouissement** et **Redoutable** ajoutés par `ZI 14 l.1016-1030`

> *« Vous pouvez choisir d'appliquer n'importe quel Trait à n'importe quelle créature si cela correspond à ce que vous voulez utiliser dans votre partie. »* — `LDB 76 l.11`

### 6. Taille — modificateurs et Blessures (`LDB 85`)

Sept catégories de Taille (`LDB 85 l.344-355`) :

| Taille | Exemples |
|---|---|
| Minuscule | Papillon, souris, pigeon |
| Très petite | Chat, faucon, bébé humain |
| Petite | Rat géant, halfling, enfant humain |
| Moyenne | Nain, elfe, humain |
| Grande | Cheval, ogre, troll |
| Énorme | Griffon, vouivre, manticore |
| Monstrueuse | Dragon, géant, Prince démon |

**Modifier la Taille d'une créature** (`LDB 85 l.340`) : par catégorie au-dessus du standard, **+10 F, +10 E, −5 Ag** ; inverser pour rapetisser.

**Modificateurs en combat — créature plus grande** (`LDB 85 l.358-362`) :
- Ses armes gagnent l'Atout **Dévastatrice** à +1 catégorie, **Percutante** à +2 catégories ou plus.
- Dégâts **×** le nombre de catégories d'écart (2 cat. = ×2, 3 cat. = ×3…), multiplication appliquée **après** les autres modificateurs.
- Toute frappe réussie active la règle optionnelle **Frappe Mortelle** (même si la cible survit).

**Créature plus petite** (`LDB 85 l.366`) : **+10 pour toucher**.

**Défense contre les grosses créatures** (`LDB 85 l.369-370`) : **−2 DR par catégorie de Taille supérieure** de l'adversaire quand vous vous défendez en **CC** lors d'un Test opposé (mieux vaut esquiver).

**Force opposée** (`LDB 85 l.377-378`) : ≥ 2 Tailles d'écart → la plus grande gagne automatiquement ; 1 Taille d'écart → la plus petite doit faire un **Critique** pour pouvoir s'opposer.

**Peur et Terreur de Taille** (`LDB 85 l.383`) : une créature agressive cause **Peur** à toute créature plus petite, **Terreur** à toute créature plus petite d'au moins 2 catégories ; le niveau = la **différence de catégories** (ex. Grande vs Petite = Terreur 2).

**Mouvement / Piétinement** (`LDB 85 l.374, 320-321`) : une créature plus grande ignore le Désengagement (elle écarte les petits combattants) ; **Piétinement** = Action gratuite **(coût 1 Avantage)** contre un plus petit, Dégâts = **bonus de F + 0**, Compétence **Corps à corps (Bagarre)**.

**Blessures par Taille** (`LDB 85 l.391-406`, table reconstituée du texte OCRisé) :

| Taille | Blessures |
|---|---|
| Minuscule | 1 |
| Très petite | Bonus d'Endurance |
| Petite | (2 × Bonus d'Endurance) + Bonus de Force Mentale |
| Moyenne | Bonus de Force + (2 × Bonus d'Endurance) + Bonus de Force Mentale |
| Grande | [Bonus de Force + (2 × Bonus d'Endurance) + Bonus de Force Mentale] × 2 |
| Énorme | [Bonus de Force + (2 × Bonus d'Endurance) + Bonus de Force Mentale] × 4 |
| Monstrueuse | [Bonus de Force + (2 × Bonus d'Endurance) + Bonus de Force Mentale] × 8 |

— `LDB 85 l.393-406` (la formule Moyenne = BF + 2×BE + BFM est l'identité de calcul des Blessures des joueurs ; le Trait **Endurant** ajoute le BE **avant** ce multiplicateur de Taille, `LDB 85 l.130`)

### 7. Présentation ZI : Armure (BE inclus), Traits d'attaque, Redoutable (`ZI`)

Le supplément **Le Zoo Impérial** ne change pas les Traits, mais leur **présentation** :
- **Armure** affiche un second chiffre entre parenthèses = **Indice du Trait Armure + Bonus d'Endurance**, c.-à-d. la valeur réellement soustraite de la plupart des Dégâts — *« Le Trait Armure inclut désormais un second chiffre entre parenthèses […] la somme de l'Indice du Trait Armure de la créature et de son Bonus d'Endurance »* (`ZI 14 l.1018-1019`).
- Nouvelle catégorie d'encadré **« Traits d'attaque »** : sous-ensemble des Traits permettant une attaque/action particulière, isolé pour lecture rapide (`ZI 14 l.1022-1023`).
- **Redoutable** : à utiliser avec parcimonie — *« si un monstre présente plus de niveaux de Redoutable qu'il n'y a de Personnages, vous pourriez diminuer ou supprimer ce Trait »* (`ZI 14 l.1024`).
- `ZI 14 l.1037-1087` donne un **tableau de référence rapide** reprenant le texte de **tous** les Traits du LDB (À distance → Vomissement) + Fouissement + Redoutable.

### 8. Nouveaux Traits et Mutations de l'Ennemi dans l'Ombre (`EDO`)

Traits de créature ajoutés par le Tome 1 (`EDO 11 l.220-243`) :

| Trait | Effet mécanique (RAW) |
|---|---|
| **Absorption** | Fin de Round, si Avantage > tous les adversaires engagés : absorbe un adversaire de Taille ≤. La victime gagne **États Empêtré = bonus de F** et compte comme Empoignée ; elle perd **bonus de F** en Blessures à la fin de chaque tour (ni PA ni BE ne réduisent), et la créature « guérit » d'autant. Victime tuée → la créature se retire pour digérer. **Tout coup qui touche la créature inflige autant de Dégâts à la victime absorbée.** |
| **Amorphe** | **Divise par 2** toutes les Blessures subies hors **feu/froid/magie**. Ignore les Critiques. Détruite seulement si réduite à 0 par froid extrême / feu / magie. Réduite à 0 par d'autres moyens → torpeur **1d10 Rounds** puis **+1 Blessure**. |
| **Contagieux (Type)** | Transmet la maladie indiquée **au toucher** : la victime Teste la Contraction à **−2 niveaux** de difficulté ; si contractée, l'incubation devient **« Instantanée »**. |
| **Décérébré** | Stupide, mû par l'instinct. Pas d'**I, Int, FM, Soc** (jamais Testées). Blessures : **bonus de F** à la place du bonus de FM. Sans Initiative → **joue toujours en dernier**. |
| **Dédoublement** | Si elle subit une **Blessure Critique** ou perd toutes ses Blessures : **remplacée par 2 horreurs bleues** indemnes. |
| **Voleur de Chair** | (nécessite **Démoniaque**.) Peut se glisser dans le corps de tout humain qu'elle tue et l'incarner (voix/manies). Préparation **1d10 Rounds** ; chair portée/retirée en **1 Round** ; pourrit seulement si la créature meurt. Sortie horrible = **Terreur 1** pour 1 Round mais détruit la chair. Détection : **Intuition Presque Impossible (−40)**. |

**Mutations** correspondantes (`EDO 11 l.178-216`), à effet de combat :

| Mutation | Effet |
|---|---|
| **Écailles Épineuses** | **+1 PA sur tous les emplacements** ; ce PA **ne compte pas** pour la Déviation Critique. −10 Dex, −10 Soc. |
| **Chair Nécrosée** | Trait **Peur 3** ; −20 Soc. |
| **Pattes (Chèvre)** | Trait **Morsure +5** ; Talent Sens aiguisé (Odorat) ; −20 Soc, −10 Int. |
| **Tête Pointue** | **+1 PA à la Tête** ; −5 Int, −10 Soc. |
| **Crétin** | Trait **Stupide** ; −40 Int (min 10). |

### 9. Traits de créature additionnels (Mort sur le Reik Compagnon — `MSRC 15`)

Le **Bestiaire fluvial** du Compagnon T2 ajoute 8 nouveaux Traits de créature, à effet de combat direct, qui n'apparaissent ni au LDB, ni dans ZI, ni dans EDO. Introduction : *« Les Traits suivants reflètent les capacités des créatures de ce chapitre, mais au choix du MJ, ils peuvent être appliqués à d'autres. »* (`MSRC 15 l.133-135`). Effet mécanique **verbatim** (`MSRC 15 l.138-163`) :

| Trait | Effet mécanique (RAW) |
|---|---|
| **Aquatique** | La créature peut **respirer sous l'eau** et s'y déplace à sa **pleine vitesse de Mouvement**. Elle **ne peut pas se déplacer sur la terre ferme**. |
| **S'accrocher Pour Se Nourrir** | Si la créature réussit une attaque de **Morsure**, elle s'accroche à sa victime et y reste attachée avec une force surprenante. Ensuite, elle extrait du sang, provoquant la **perte automatique d'1 Point de Blessure pour chaque Round** où elle reste accrochée. Les victimes dont les Blessures sont réduites à zéro gagnent l'État **Inconscient** lorsqu'elles perdent connaissance à cause de la perte de sang. |
| **Hallucinogène** | La créature dégage un musc hallucinogène. Les victimes situées à **moins de 2 mètres** (plus, à la discrétion du MJ, si la victime est dans le sens du vent) doivent réussir un Test de **Force Mentale Accessible (+20)** ou succomber, **gagnant un État *Sonné* pour chaque niveau d'échec**. |
| **Rampant** | Cette créature est impitoyable, mais lente. Elle **ne peut pas réaliser d'Action de Course**. |
| **Salive Analgésique** | Les morsures de la créature ne provoquent **aucune douleur**, ce qui lui permet de s'accrocher à ses victimes endormies sans être détectée. Cet effet s'estompe au bout de **10 − Bonus d'Endurance Rounds** après que la créature se soit détachée. |
| **Salive Anticoagulante** | La victime de la morsure de la créature gagne l'État **Hémorragique**. La créature ne se détache qu'une fois rassasiée, ce qui se produit après qu'elle ait extrait **son BE en Blessures** ; elle se retire alors pour digérer son repas. La créature peut être retirée avec un **Test opposé de Force** mais cela inflige **1 Blessure** à la victime. Si la créature possède le Trait **Effrayé** approprié, tout ce qu'elle craint lui fait relâcher son emprise immédiatement. |
| **Capricieux** | Le tempérament de la créature passe d'un extrême à l'autre. Lorsqu'un Personnage effectue un Test de **Sociabilité** en traitant avec la créature, lancez 1d10 selon le tableau ci-dessous. |
| **Engloutir** | Si la créature est de taille suffisante, **toute attaque réussie engloutit une victime, même si elle ne cause aucun Dégât**, infligeant l'État **Empêtré d'une Force égale à celle de la créature**. Au début de chaque Round, les victimes englouties **gagnent un État *Empêtré* supplémentaire** et **perdent automatiquement 1 Blessure** alors que de puissantes enzymes commencent la digestion. Si la créature n'est pas de taille suffisante pour engloutir entièrement une victime, elle peut néanmoins être assez grande pour immobiliser un endroit du corps touché. La créature **ne peut plus effectuer d'attaques contre les victimes entièrement englouties**, mais elle peut encore en attaquer d'autres si elles sont suffisamment proches. |

— `MSRC 15 l.138-163` (transcription verbatim ; le bloc « relâchement / retrait par Force / Effrayé » de `MSRC 15 l.145-147` s'applique à **Salive Anticoagulante**)

**Tableau de Capricieux** (`MSRC 15 l.153-160`, table verbatim) :

| 1d10 | Résultat |
|---|---|
| 1 | Soustraire 2 au DR |
| 2-3 | Soustraire 1 au DR |
| 4-7 | Utiliser le DR indiqué |
| 8-9 | Ajouter 1 au DR |
| 10 | Ajouter 2 au DR |

— `MSRC 15 l.153-160`

Exemple d'application dans le même chapitre — le **Troll des rivières** (`MSRC 15 l.119-128`) emploie plusieurs de ces Traits standard mêlés (Amphibie, Limicole, Vomissement, Perturbant (Odeur), Increvable, Régénération…) :

| M | CC | CT | F | E | I | Ag | Dex | Int | FM | Soc | B |
|---|----|----|---|---|---|----|-----|-----|----|-----|---|
| 6 | 30 | 15 | 55 | 45 | 10 | 15 | 15 | 10 | 20 | 5 | 30 |

**Traits :** Amphibie, Arme +9, Armure 2, Coriace, Increvable, Infecté, Limicole, Morsure +8, Perturbant (Odeur), Régénération, Taille (Grande), Stupide, Vision nocturne, Vomissement. **Facultatif :** Affamé, Belliqueux, Bestial, Brutal, Discrétion, Dur à Cuire, Frénésie, Grand, Insensible à la douleur, Mutation, Parasité, Résistance à la Magie, Taille (Énorme), Territorial — `MSRC 15 l.119-128`

### 10. Profils-exemples illustrant le schéma (Traits fixes / Facultatif)

Profils du Tome 1 qui montrent le gabarit §1 en pratique (caractéristiques absentes notées **–**, bloc Traits + bloc Facultatif) :

- **Amibe** (`EDO 07 l.320-327`) — M4 CC30 CT– F40 E40 I– Ag20 Dex10 Int– FM– Soc– B16. **Traits :** 2 Tentacules +6, Absorption, Amorphe, Amphibie, Arme +6, Décérébré, Insensible à la douleur, Limicole. **Facultatif :** Pisteur, Taille (Grande-Énorme), 3+ Tentacules, Venin (Accessible-Difficile).
- **Héraut de Tzeentch / Démon Gardien** (`EDO 07 l.328-348`) — M4 CC39 CT49 F49 E39 I39 Ag59 Dex39 Int49 FM99 Soc19 B19. **Traits :** Arme +9, Cornes +8, Corruption (Modérée), Démoniaque 8+, Insensible à la douleur, **Instable (Hors du temple secret)**, Peur 2, **Territorial (Temple secret)** — illustre Territorial à condition géographique et Instable conditionnel.
- **Sheru-Tar Gee'taru** (Gideon) (`EDO 09 l.513-529`) — M4 CC45 CT47 F42 E40 I58 Ag47 Dex39 Int59 FM60 Soc51 B22. **Traits :** Arme +9, Contagieux (Fièvre cérébrale pourpre), Corruption (Modérée), Démoniaque 8+, Dur à cuire, Instable, Lanceur de sorts, Peur 2, Vision nocturne, Voleur de chair.
- **Horreur Rose** (`EDO 09 l.556-570`) — M4 CC49 CT39 F49 E39 I69 Ag59 B17. **Traits :** Arme (Griffes) +8, Corruption (Modérée), **Dédoublement**, Démoniaque 8+, Peur 2. **Horreur Bleue** — M4 CC29 CT39 F39 E29 I29 B9 — Arme (Griffes) +6, Corruption (Modérée), Démoniaque 9+, Peur 1 (issue du Dédoublement de l'Horreur Rose).
- **Fhluger'Dagh** (Démon Mineur) (`EDO 01 l.271-290`) — M4 CC35 CT35 F35 E45 I45 Ag50 B13. **Traits :** Arme (Griffes) +7, Armure 1, Corruption (Modérée), Démoniaque 9+, Peur 2.

**Sources RAW** :
- `LDB 76 l.9-13` — sous-système : toute créature a ≥ 1 Trait standard ; personnalisation libre (Compétences/Talents/Traits) ; renvoi des règles de Traits à p.338.
- `LDB 76 l.16-28` — Localisations pour créatures non humaines (remap des membres) + table **Localisations Alternatives** (Serpents, Araignées) verbatim.
- `LDB 76 l.31-37` — **Traits Standard de Créature** : liste de 15 ajoutés à la liste Facultative de toutes les créatures + Remarque Arme/Armure.
- `LDB 76 l.38-45` — **Schéma des Profils du Bestiaire** : Nom / Description / Attributs / Traits / Facultatif ; règles de localisation (créature 2 cat. plus grande, Localisation sans table de Critiques).
- `LDB 77 l.7-68` — profils PNJ standard (Humain, Nain, Halfling, Elfe, Ogre) : ligne M…B + Traits + Facultatif ; « Traits standard = meilleurs choix de départ ».
- `LDB 85 l.9-447` — catalogue complet des Traits de créature (effet mécanique de chacun), Tableau Taille, modificateurs de Taille en combat, table Blessures-par-Taille.
- `LDB 85 l.340-406` — modifier la Taille (+10 F/E, −5 Ag par catégorie), modificateurs en combat (Dévastatrice/Percutante, Dégâts ×catégories, Frappe Mortelle), défense −2 DR/cat., Force opposée, Peur/Terreur par différence de catégories, Piétinement, table Blessures-par-Taille.
- `ZI 14 l.1013-1035` — présentation ZI : Armure affiche (Indice + BE), catégorie « Traits d'attaque », Trait **Redoutable**, Trait **Fouissement**, conseils d'emploi de Redoutable selon la taille du groupe.
- `ZI 14 l.1037-1087` — tableau de référence rapide reprenant **tous** les Traits du LDB (texte complet).
- `EDO 11 l.172-243` — nouveaux Traits (Absorption, Amorphe, Contagieux, Décérébré, Dédoublement, Voleur de Chair) + Mutations à effet de combat (Écailles Épineuses, Chair Nécrosée, Pattes Chèvre, Tête Pointue, Crétin).
- `MSRC 15 l.133-135` — introduction des Nouveaux Traits du Bestiaire fluvial (applicables à n'importe quelle créature au choix du MJ).
- `MSRC 15 l.138-163` — 8 nouveaux Traits du Compagnon T2 : Aquatique, S'accrocher Pour Se Nourrir, Hallucinogène, Rampant, Salive Analgésique, Salive Anticoagulante, Capricieux, Engloutir (effet mécanique verbatim).
- `MSRC 15 l.153-160` — tableau d10 du Trait **Capricieux** (DR ±0–2 selon le jet).
- `MSRC 15 l.119-128` — profil du **Troll des rivières** (exemple mêlant Traits standard + fluviaux).
- `EDO 07 l.320-348`, `EDO 09 l.513-570`, `EDO 01 l.271-290` — profils-exemples montrant le schéma Traits/Facultatif et l'usage des nouveaux Traits.

> *« Les Traits standard de créature sont ajoutés à la liste Facultative de toutes les créatures. »* — `LDB 76 l.33`
> *« L'arme inflige Indice Dégâts qui incluent déjà son bonus de Force. En général, le nombre de Dégâts est égal à 4 + son bonus de Force. »* — `LDB 85 l.35`
> *« Les Traits suivants reflètent les capacités des créatures de ce chapitre, mais au choix du MJ, ils peuvent être appliqués à d'autres. »* — `MSRC 15 l.133-135`

**Voir aussi** : Localisation et Tableaux de Critiques (localisation inversée, Tableau des Bras pour membres sans table) ; Taille et combat (Dévastatrice/Percutante, Frappe Mortelle, Piétinement) ; Psychologie (Peur, Terreur, Frénésie, Animosité, Haine, Préjugé) ; États (Empêtré, Sonné, Inconscient, Hémorragique — infligés par les Traits MSRC) ; Blessures et Bonus de caractéristique (BF+2×BE+BFM) ; Corruption et Mutations ; Attaques gratuites et Avantage.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 76` (l.9-13, l.16-28, l.31-37, l.38-45) → `traitsStandard`, `SPECIES_BODY_SHAPE`, `bodyShapeForSpecies`, `bodyShapeOf`, `fr`, `BODY_SHAPE_LOC_LABELS`, `locationLabel`, `doc`, `critTableKeyFor`, `SceneEntity`, +9 — `src/data/criticals.ts`, `src/data/index.ts`, `src/data/schemas/defs-scenes/scene.ts`, `src/data/schemas/defs/criticals.ts`, `src/data/schemas/defs/localisation.ts`, `src/engine/bodyForm.ts`, +7 fichiers
- `LDB 77` (l.7-68) → `ESPECE`, `PorteurDeFiche`, `ChoixDeProfil`, `doc`, `humain`, `pnjAuProfil`, `TavernGameModal`, `TavernOpponent`, `nain`, `Palette`, +7 — `src/data/creatures.json`, `src/data/index.ts`, `src/data/schemas/defs/species.ts`, `src/engine/statblock.ts`, `src/scenes/test-scenarios/taverne-profil-standard.ts`, `src/state/sceneNpc.ts`, +4 fichiers
- `LDB 85` (l.9-447) → `TraitDef`, `scene`, `a-distance`, `arme`, `planClimb`, `a-sang-froid`, `morsure`, `doc`, `affame`, `scenario`, +230 — `src/data/index.ts`, `src/data/maneuvers.json`, `src/data/qualities.json`, `src/data/regles.json`, `src/data/schemas/defs/structures.ts`, `src/data/schemas/defs/traits.ts`, +43 fichiers
- `ZI 14` (l.1013-1035, l.1037-1087) → `ethere`, `fouissement` — `src/data/traits.json`
- `MSRC 15` (l.119-128, l.133-135, l.138-163) → `placeCombatant`, `useTestJetProps`, `capriciousDR`, `effectiveMovement`, `OP_DEFS`, `PendingTest`, `PerSL`, `offTerrainOps`, `offTerrainMoveCap`, `hasNoRun`, +12 — `src/data/creatures.json`, `src/data/schemas/grammaire/mecanique.ts`, `src/data/traits.json`, `src/engine/encumbrance.ts`, `src/engine/ops.ts`, `src/engine/social.ts`, +6 fichiers
- `EDO 11` (l.172-243) → `Formula`, `Condition`, `engagedAdvantageLead`, `gonflement`, `EffectTargeting`, `chair-necrosee`, `cretin`, `pattes-chevre`, `tete-bestiale-chien`, `digere`, +10 — `src/data/etats.json`, `src/data/mutations.json`, `src/data/symptoms.json`, `src/data/traits.json`, `src/data/trappings.json`, `src/engine/flowCore.ts`, +3 fichiers
- sans code : `EDO 1` (l.271-290), `EDO 7` (l.320-348), `EDO 9` (l.513-570)

---

## Traits d'attaque naturelle des créatures

Les **Traits de créature** (LDB 85) servent à doter un PNJ ou un monstre d'armes naturelles. Une douzaine de Traits transforment une partie du corps (dents, queue, cornes, langue, tentacules, venin, toile…) en **attaque**. Ce qui les distingue d'une arme ordinaire, c'est qu'ils s'appuient sur le mécanisme des **Attaques gratuites** (la plupart) et qu'ils incluent **déjà le Bonus de Force** dans leur Indice de Dégâts. Cette entrée consolide ces Traits et les règles qu'ils invoquent (Empoignade, États Empêtré/Empoisonné/À Terre, coût en Avantage).

### Notion de base : Attaque gratuite

> « Une Attaque gratuite est un Test d'attaque de **Capacité de Tir** ou de **Capacité de Combat** supplémentaire qui n'utilise pas votre Action de tour – voir Actions gratuites à la page 158. » — `LDB 85 l.43`

Une Attaque gratuite **ne consomme pas l'Action** du tour ; elle est en plus de l'attaque ordinaire. Son prix est en **Avantage** (sauf exceptions, voir tableau), et la plupart de ces attaques ne sont disponibles que « pendant son tour » (l'attaquant doit donc agir). Le défenseur se défend normalement (jet opposé CC, ou Esquive pour les attaques à distance / de zone). Le Bonus de Force étant déjà compté dans l'Indice, **on n'ajoute pas BF aux Dégâts** d'une attaque naturelle.

### Indice de Dégâts d'une arme naturelle (Trait Arme)

> « L'arme inflige _Indice_ Dégâts qui incluent déjà son bonus de Force. En général, le nombre de Dégâts est égal à 4 + son bonus de Force (représentant une arme simple). » — `LDB 85 l.35`

Le **Trait Arme (Indice)** est l'attaque de mêlée par défaut (dents, griffes, gourdin) : **Action normale**, jet de CC, Indice ≈ 4 + BF. C'est la référence pour tous les autres : chaque Indice de Trait inclut déjà BF.

### Tableau de synthèse des Traits d'attaque (LDB 85, verbatim consolidé)

| Trait | Déclenchement | Coût | Jet / défense | Dégâts (Indice) | Effet additionnel |
|---|---|---|---|---|---|
| **Arme (Indice)** | Action | — | CC opposé | Indice (= 4 + BF) | aucun (arme simple) |
| **À Distance (Indice)(Portée)** | Action | — | CT (Projectiles) | Indice | arme à distance ; Portée en mètres |
| **Morsure (Indice)** | Attaque gratuite, pendant son tour | **1 Avantage** | CC opposé | Indice (BF inclus) | aucun (mais voir Vampirique / Venin) |
| **Cornes (Aspect)(Indice)** | Attaque gratuite **en Chargeant** | **0** (gagnée avec l'Avantage de Charge) | CC opposé | Indice (BF inclus) | aucun ; Aspect noté entre parenthèses |
| **Attaque Caudale (Indice)** | Attaque gratuite, pendant son tour | **1 Avantage** | CC opposé | Indice (BF inclus) | cible de **Taille inférieure** qui perd des PB → État **À Terre** |
| **Langue Préhensile (Indice)(Portée)** | Attaque gratuite, pendant son tour | **1 Avantage** | CT / **Esquive** (à distance) | Indice (BF inclus) | sur touche : 1 **Empêtré** ; Taille inférieure → entraînée vers la créature ; puis relâcher / Attaque gratuite d'Arme / **Empoignade** |
| **Tentacules # (Indice)** | **1 Attaque gratuite PAR tentacule** | **0** | CC opposé (par tentacule) | Indice (BF inclus) | sur Dégâts : peut infliger **Empêtré** → **Empoignade** avec ce tentacule |
| **Constricteur** | sur toute touche d'une attaque | — | (attache l'attaque) | — | toute touche réussie → **Empêtré** ; puis **Empoignade** |
| **Toile (Indice)** | sur toute touche | — | (attache l'attaque) | — | sur touche → 1 **Empêtré** de **Force = Indice** |
| **Venin (Difficulté)** | sur attaque venimeuse infligeant des PB | — | (Test de la cible) | — | cible qui perd des PB → Test pour résister, sinon État **Empoisonné** (Difficulté ; défaut Intermédiaire) |
| **Vampirique** | sur Morsure réussie | — | — | — | regagne autant de PB que la cible en perd (seul moyen de se soigner) |

*Sources :* `LDB 85 l.33-35` (Arme), `l.9` (À Distance), `l.235-237` (Morsure), `l.81-83` (Cornes), `l.45-47` (Attaque Caudale), `l.209-213` (Langue Préhensile), `l.403-405` (Tentacules), `l.73-75` (Constricteur), `l.415-417` (Toile), `l.423-425` (Venin), `l.419-421` (Vampirique).

### Texte intégral des Traits concernés (verbatim)

**À Distance (Indice)(Portée)** — `LDB 85 l.9`
> « La créature possède une arme à distance. L'arme cause _Indice_ Dégâts et la distance en mètres est ( _Portée)_ . »

C'est un **descripteur d'arme**, pas une Attaque gratuite : la créature tire à la Capacité de Tir comme avec une arme normale, l'Indice donnant les Dégâts et la Portée la distance utile.

**Morsure (Indice)** — `LDB 85 l.235-237`
> « Pendant son tour, la créature peut effectuer une Attaque gratuite en dépensant 1 Avantage. Les Dégâts de l'Attaque égalent _Indice_ et incluent déjà son bonus de Force. »

**Cornes (Aspect)(Indice)** — `LDB 85 l.81-83`
> « Quand la créature gagne un Avantage pour Charger, elle peut aussi gagner une Attaque gratuite de Cornes, calculée normalement, en utilisant _Indice_ pour les Dégâts (son bonus de Force est déjà inclus). »

Si les Cornes ont un Aspect différent (Impact, Tranchant…), il est noté entre parenthèses. L'attaque est **liée à la Charge** : on ne paie pas d'Avantage en plus, elle vient avec l'Avantage gagné en chargeant.

**Attaque Caudale (Indice)** — `LDB 85 l.45-47`
> « À son tour, elle peut effectuer une Attaque gratuite en dépensant 1 Avantage. La queue inflige _Indice_ Dégâts, _qui incluent déjà son bonus de Force_ . Les adversaires avec une plus petite Taille _que la créature,_ qui perdent des Points de Blessure par cette attaque, subissent également l'État _À Terre_ . »

**Langue Préhensile (Indice)(Portée)** — `LDB 85 l.209-213`
> « Pendant son tour, elle peut effectuer une Attaque gratuite en dépensant 1 Avantage. C'est une Attaque à distance qui inflige _Indice_ Dégâts (la _Portée_ est indiquée entre parenthèses, en mètres). Si l'Attaque touche, son adversaire reçoit 1 État _Empêtré_ et, s'il a une Taille inférieure, il est entraîné vers la créature. Elle peut laisser ensuite partir la cible, effectuer une Attaque gratuite en utilisant son Trait Arme, ou conserver la cible enroulée dans sa langue, avec le démarrage d'une Empoignade (voir page 163). »

**Tentacules # (Indice)** — `LDB 85 l.405` *(sous-système : une attaque par tentacule)*
> « La créature possède un nombre _#_ de tentacules. Gagnez une Action d'Attaque gratuite par tentacule. Les tentacules infligent _Indice_ Dégâts, qui incluent déjà son bonus de Force. Si elle cause des Dégâts, elle peut aussi infliger à son adversaire l'État _Empêtré_ , bien que cela entame une Empoignade avec ce tentacule. Si un tentacule est en Empoignade, vous pouvez utiliser une Action d'Attaque gratuite pour résoudre l'Empoignade au lieu de l'Action de la créature. Voir page 163. »

Le **#** en tête du Trait est le **nombre de tentacules** (ex. « 8 Tentacules +9 » = 8 attaques gratuites de +9, coût 0 chacune). Chaque tentacule peut entamer **sa propre** Empoignade, et une Action d'Attaque gratuite peut servir à résoudre une Empoignade d'un tentacule.

**Constricteur** — `LDB 85 l.73-75`
> « Tout lancer réussi pour toucher donne à son adversaire l'État _Empêtré_ . Elle peut ensuite entamer une Empoignade (voir page 163). »

**Toile (Indice)** — `LDB 85 l.417`
> « La créature peut créer une toile pour attraper les ennemis imprudents. Chaque fois qu'elle réussit à toucher, son adversaire gagne 1 État _Empêtré_ , avec une Force de _Indice_ . Voir page 168. »

La **Force de l'empêtrement = Indice** : c'est la valeur opposée lors du Test pour se libérer (voir État Empêtré ci-dessous).

**Vampirique** — `LDB 85 l.421`
> « Chaque fois qu'elle réussit une Attaque de Morsure contre un adversaire approprié, elle récupère autant de Points de Blessure que son adversaire en perd. Boire du sang de cette façon est la seule manière pour elle de se soigner. »

Le Vol de vie ne s'applique qu'à la **Morsure** (pas aux autres attaques), et c'est **l'unique** moyen de soin de la créature.

**Venin (Difficulté)** — `LDB 85 l.423-425`
> « Quand elle inflige des Points de Blessure avec ses Attaques venimeuses, son adversaire subit un État _Empoisonné_ . Si aucune Difficulté n'est indiquée pour résister au Venin, le Test est considéré comme Intermédiaire. Voir page 168. »

Le Venin ne déclenche que si l'attaque venimeuse **fait perdre des PB**. La cible tente un Test (Résistance / Endurance) de **Difficulté indiquée entre parenthèses** ; **défaut = Intermédiaire (+0)** ; en cas d'échec → État Empoisonné.

### Règles invoquées par ces Traits

**État Empêtré** (cible d'une Langue/Tentacule/Constricteur/Toile) — `LDB 16 l.60-66` + l'échappée :
> « Au cours de votre tour, vous ne pouvez pas utiliser votre Mouvement, et toute action qui implique un déplacement quelconque subit une pénalité de -10 (dont l'Empoignade ; voir page 163). »

Pour s'en défaire : **Action** = Test **opposé de Force** contre la source de l'empêtrement ; chaque DR retire un État Empêtré supplémentaire (la « Force » de la Toile = son Indice). `LDB 16` (état Empêtré, p.168).

**État Empoisonné** (cible du Venin / Souffle Poison) — `LDB 16 l.68-74` :
> « À la fin de chaque Round, perdez 1 Point de Blessure, en ignorant tous les modificateurs. De plus, vous subissez une pénalité de -10 à tous vos Tests. »

À 0 PB sous Empoisonné, aucune Blessure ne peut être soignée tant qu'il reste des États Empoisonné ; tomber Inconscient sous Empoisonné force un Test de Résistance après BE Rounds sous peine de mort. `LDB 16 l.68-74`.

**Empoignade** (suite possible de Langue / Tentacule / Constricteur) : Test renvoyé p.163 ; l'Empêtré pénalise l'Empoignade de -10. `LDB 16 l.64`, `LDB 13` (renvoi p.163).

### Exemple de mise en œuvre RAW (corroboration cross-livre)

L'aventure de départ **Aventures à Übersreik** rassemble les Traits d'un monstre en page-mémo et confirme le coût en Avantage : le basilic possède « Morsure +7, Attaque caudale +8 et Piétiner +4 comme attaque gratuite du Trait Taille (Énorme), ce qui signifie qu'il peut effectuer chacune de ces attaques en dépensant 1 Avantage » — `AU1 04 l.9`. (Confirme les renvois canon : Morsure p.340, Attaque caudale p.338 du Livre de base.)

**Sources RAW** :
- `LDB 85 l.43` — définition de l'**Attaque gratuite** (jet CC/CT supplémentaire, ne coûte pas l'Action ; renvoi Actions gratuites p.158).
- `LDB 85 l.33-35` — Trait **Arme (Indice)** : Indice = 4 + BF, BF déjà inclus.
- `LDB 85 l.9` — Trait **À Distance (Indice)(Portée)** : arme à distance, Dégâts = Indice, Portée en mètres.
- `LDB 85 l.235-237` — Trait **Morsure (Indice)** : Attaque gratuite, **1 Avantage**, Indice (BF inclus).
- `LDB 85 l.81-83` — Trait **Cornes (Aspect)(Indice)** : Attaque gratuite gagnée **à la Charge** (pas de coût supplémentaire).
- `LDB 85 l.45-47` — Trait **Attaque Caudale (Indice)** : Attaque gratuite, **1 Avantage** ; cible plus petite perdant des PB → **À Terre**.
- `LDB 85 l.209-213` — Trait **Langue Préhensile (Indice)(Portée)** : Attaque gratuite à distance, **1 Avantage** ; touche → **Empêtré**, traction si plus petite, puis relâcher / Attaque d'Arme / **Empoignade**.
- `LDB 85 l.405` — Trait **Tentacules # (Indice)** : **une Attaque gratuite par tentacule** (coût 0) ; Dégâts → **Empêtré** + Empoignade par tentacule.
- `LDB 85 l.73-75` — Trait **Constricteur** : toute touche → **Empêtré** puis **Empoignade**.
- `LDB 85 l.417` — Trait **Toile (Indice)** : touche → **Empêtré** de **Force = Indice**.
- `LDB 85 l.423-425` — Trait **Venin (Difficulté)** : attaque venimeuse faisant perdre des PB → Test (défaut **Intermédiaire**) ou **Empoisonné**.
- `LDB 85 l.421` — Trait **Vampirique** : Morsure réussie → regagne les PB perdus par la cible ; seul moyen de soin.
- `LDB 16 l.60-66` + état Empêtré p.168 — Empêtré : pas de Mouvement, -10 ; échappée = Test opposé de Force, 1 État retiré par DR.
- `LDB 16 l.68-74` — Empoisonné : 1 PB/fin de Round (ignore modificateurs), -10 à tous les Tests, blocage de soin / risque de mort.
- `AU1 04 l.12` — page-mémo (basilic) : Morsure/Attaque caudale/Piétiner = attaques gratuites à **1 Avantage** chacune (corroboration + renvois p.338/340/341).

> « Pendant son tour, la créature peut effectuer une Attaque gratuite en dépensant 1 Avantage. Les Dégâts de l'Attaque égalent _Indice_ et incluent déjà son bonus de Force. » — `LDB 85 l.237` (Morsure)

> « Gagnez une Action d'Attaque gratuite par tentacule. […] Si un tentacule est en Empoignade, vous pouvez utiliser une Action d'Attaque gratuite pour résoudre l'Empoignade au lieu de l'Action de la créature. » — `LDB 85 l.405` (Tentacules)

**Voir aussi** : Souffle (Indice)(Type) ; Regard pétrifiant ; Étreinte glaciale ; Hurlement fantomatique ; Vomissement ; Trait Taille (Piétinement, multiplicateur de Dégâts) ; États Empêtré / Empoisonné / À Terre ; Empoignade ; Charge et Avantage.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 16` (l.60-66, l.68-74) → `combat-fatigue`, `doc`, `StateRecoveryModal`, `EnemyAction`, `Formula`, `addCondition`, `brise`, `Condition`, `aaBleedUnconsciousDue`, `describeStateRecovery`, +29 — `src/data/combat-stakes.json`, `src/data/etats.json`, `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/etats.ts`, +17 fichiers
- `LDB 85` (l.9, l.33-35, l.43, l.45-47, l.73-75, l.81-83, l.209-213, l.235-237, l.405, l.417, l.421, l.423-425) → `TraitDef`, `a-distance`, `arme`, `a-sang-froid`, `morsure`, `affame`, `creatureWeapon`, `amphibie`, `ManeuverPostHitHook`, `caudale`, +99 — `src/data/index.ts`, `src/data/maneuvers.json`, `src/data/qualities.json`, `src/data/regles.json`, `src/data/traits.json`, `src/engine/creatureEquip.ts`, +16 fichiers
- sans code : `AU1 4` (l.9, l.12)

---

## Souffle et attaques de zone des créatures

Ce topic couvre les **Traits de créature** (LDB 85) qui produisent des attaques *spéciales* — souvent de zone, gratuites ou magiques — payées en **Avantages** : le Trait générique **Souffle (Indice)(Type)** et ses six Types, plus **Étreinte Glaciale**, **Hurlement Fantomatique**, **Regard Pétrifiant** et **Vomissement**. Toutes ces attaques sont des capacités de Trait (pas des manœuvres d'arme classiques) : elles ne se déclenchent qu'au tour de la créature, et leur usage est conditionné par un **coût en Avantages** spécifique à chaque Trait.

### Souffle (Indice) (Type) — règle générale

Le souffle est une arme de souffle de zone. **Pendant son tour, au prix de 2 Avantages**, la créature peut l'activer **en tant qu'Attaque gratuite** (elle conserve donc son Action). Procédure :

1. **Cible & portée.** Choisir **1 cible que la créature peut voir**, située à une distance en mètres **égale à son Bonus d'Endurance + 20**.
2. **Zone touchée.** Sont touchés : **tous les personnages situés à une distance en mètres égale au Bonus de Force *de cette cible*** (la zone se dimensionne sur le BF de la **cible**, pas de la créature), **ainsi que tous les personnages entre la créature et la cible** (le souffle balaie le trajet).
3. **Résolution.** Effectuer un **Test opposé de CT/Esquive** contre **chaque** cible affectée — *un lancer pour chaque cible*. Toute cible qui **échoue** subit un montant de **Dégâts d'Arme égal à l'*Indice*** du Trait.
4. **Type.** Si le Trait indique l'un des Types entre parenthèses, appliquer **aussi** les règles correspondantes (voir tableau ci-dessous).

La créature est **immunisée à son propre Souffle**. **Il s'agit d'une Attaque magique** (donc capable de blesser l'Éthéré, etc.).

> Le sort **Souffle** (LDB 47) délègue exactement à cette mécanique : « comme si vous aviez dépensé 2 Avantages pour activer le Trait de créature Souffle ». — `LDB 85 l.318-331`

#### Les six Types de Souffle (effets additionnels)

| Type | Effet additionnel (en plus des Dégâts d'Arme = Indice) |
|---|---|
| **Froid** | Les cibles gagnent l'État *Sonné* **pour chaque tranche de 5 Blessures subies (minimum 1)**. |
| **Corrosif** | **Toutes les Armures et Armes portées par les cibles subissent 1 Dégât.** |
| **Feu** | Toutes les Blessures infligées **ignorent les PA**. Les cibles gagnent l'État *Enflammé*. |
| **Électricité** | Toutes les Blessures infligées **ignorent les PA**. Les cibles gagnent l'État *Sonné*. |
| **Poison** | Toutes les Blessures infligées **ignorent les PA**. Les cibles gagnent l'État *Empoisonné*. |
| **Fumée** | La zone se **remplit de fumée, bloquant les Lignes de vue** pendant un nombre de Rounds **égal au Bonus d'Endurance de la créature**. |

— `LDB 85 l.323-330`

### Étreinte Glaciale

Le toucher de la créature glace l'âme de l'ennemi. **Au prix de 2 Avantages ET de son Action**, elle tente un **Test opposé de CC/Corps à corps ou Esquive**. Sur un **succès**, l'adversaire **perd automatiquement 1d10 + DR Blessures qui ignorent le Bonus d'Endurance ET les PA**. **Il s'agit d'une Attaque magique.**

— `LDB 85 l.137-138`

### Hurlement Fantomatique

Le cri abominable de la créature peut tuer ceux qui l'entendent. **Pendant son tour**, elle peut **dépenser tous ses Avantages (minimum 2)** pour pousser son cri ; **cela n'utilise pas son Action**. Effets :

- **Toutes les créatures vivantes** (ne possédant **pas** le Trait *Mort-vivant*) se trouvant à un nombre de mètres **égal à l'Initiative de la créature** subissent immédiatement **1d10 Blessures qui ignorent le Bonus d'Endurance et les PA**.
- Chaque victime doit réussir un **Test de Résistance Accessible (+20)** ou **gagner l'État *Brisé***.
- **Toutes** les cibles affectées **gagnent 3 États *Assourdi***.

— `LDB 85 l.168-169`

### Regard Pétrifiant

Le regard de la créature change la chair en pierre. **Pour son Action**, elle peut **dépenser autant d'Avantages qu'elle désire (minimum 1)** pour lancer son regard. Elle effectue un **Test opposé de CT/Initiative**, et **ajoute 1 DR par Avantage dépensé**. Résolution sur les DR de victoire :

- L'adversaire **gagne 1 État *Sonné* pour chaque tranche de 2 DR** avec lesquels la créature gagne.
- Si la victoire est de **6 DR ou plus**, l'adversaire est **définitivement changé en pierre**.
- **Si l'adversaire est un Lanceur de Sorts**, le Test peut être opposé à **Langue (Magick)** au lieu de l'Initiative **si des contre-sorts sont lancés**.

— `LDB 85 l.289-290`

### Vomissement

La créature vomit un flot de corruption corrosive. **Pendant son tour, au prix de 3 Avantages**, elle l'active comme une **Attaque gratuite**. Procédure :

1. **Cible & portée.** Choisir **1 cible que la créature peut voir**, à une distance en mètres **égale à son Bonus d'Endurance**, et lui vomir dessus.
2. **Zone touchée.** **Toutes les cibles à moins de deux mètres** sont également touchées.
3. **Résolution.** **Test opposé de CT/Esquive** contre chaque cible (*un jet opposé par cible*). Le Test est généralement **Facile (+40) pour la créature** à cause de la distance rapprochée, et **Intermédiaire (+0) pour ses adversaires**.
4. **Effet.** Toute cible qui **échoue** subit une somme de **Dégâts d'Arme égale à son Bonus d'Endurance + 4** et **reçoit l'État *Sonné***.
5. **Dégradation matériel.** **Toutes les Armures et Armes portées par les cibles affectées subissent 1 Dégât** (acidité corrosive).

— `LDB 85 l.442-447`

### Synthèse comparative (coût, action, défense, magie)

| Trait | Coût en Avantages | Coûte l'Action ? | Test (attaquant / défense) | Zone | Magique |
|---|---|---|---|---|---|
| **Souffle (Indice)(Type)** | 2 | Non (Attaque gratuite) | CT / Esquive | BF de la cible + trajet ; portée BE+20 m | Oui |
| **Vomissement** | 3 | Non (Attaque gratuite) | CT / Esquive ; Facile (+40) pour elle, Interm. (+0) pour la cible | ≤ 2 m autour de la cible ; portée BE m | — (non précisé RAW) |
| **Étreinte Glaciale** | 2 | **Oui** | CC/Corps à corps **ou** Esquive (opposé) | Contact (1 cible) | Oui |
| **Hurlement Fantomatique** | Tous (min. 2) | Non | Résistance Accessible (+20) par victime | Rayon = Initiative de la créature | — |
| **Regard Pétrifiant** | Autant que désiré (min. 1) | **Oui** | CT / Initiative (ou Langue (Magick)) opposé, +1 DR/Avantage | 1 cible | — |

**Sources RAW** :
- `LDB 85 l.317-331` — Trait **Souffle (Indice)(Type)** : activation (2 Avantages, Attaque gratuite), portée BE+20 m, zone = BF de la cible + trajet créature→cible, Test opposé CT/Esquive par cible, Dégâts = Indice ; les 6 Types (Froid/Corrosif/Feu/Électricité/Poison/Fumée) ; immunité au propre souffle ; Attaque magique.
- `LDB 85 l.323-330` — les six Types de Souffle, effets ligne par ligne (Sonné par 5 Blessures pour Froid ; -1 Dégât Armures/Armes pour Corrosif ; ignore PA + Enflammé pour Feu ; ignore PA + Sonné pour Électricité ; ignore PA + Empoisonné pour Poison ; blocage des Lignes de vue BE Rounds pour Fumée).
- `LDB 85 l.137-138` — Trait **Étreinte Glaciale** : 2 Avantages + Action, Test opposé CC/Corps à corps ou Esquive, 1d10 + DR Blessures ignorant BE et PA, Attaque magique.
- `LDB 85 l.168-169` — Trait **Hurlement Fantomatique** : tous Avantages (min. 2), n'utilise pas l'Action, 1d10 Blessures (ignore BE+PA) aux vivants à ≤ Initiative mètres, Test Résistance Accessible (+20) sinon Brisé, +3 États Assourdi.
- `LDB 85 l.289-290` — Trait **Regard Pétrifiant** : Action, Avantages au choix (min. 1), Test opposé CT/Initiative +1 DR/Avantage, 1 État Sonné par tranche de 2 DR de victoire, pétrification définitive à 6+ DR, option Langue (Magick) si contre-sorts.
- `LDB 85 l.442-447` — Trait **Vomissement** : 3 Avantages, Attaque gratuite, portée BE mètres + zone ≤ 2 m, Test opposé CT/Esquive (Facile +40 pour elle / Interm. +0 pour la cible), Dégâts = BE+4 + Sonné, -1 Dégât aux Armures/Armes des cibles.

> « La créature est immunisée à son propre Souffle. Il s'agit d'une Attaque magique. » — `LDB 85 l.331`

> « Choisissez 1 cible qu'elle peut voir, située à une distance en mètres égale à son bonus d'Endurance +20. Tous les personnages situés à une distance en mètres égale au Bonus de Force de cette cible sont touchés, ainsi que tous les personnages entre la créature et la cible. » — `LDB 85 l.318`

> « Son adversaire gagne 1 État *Sonné* pour chaque tranche de 2 DR avec lesquels elle gagne. Si c'est de 6 DR ou plus, son adversaire est définitivement changé en pierre. » — `LDB 85 l.290`

**Voir aussi** : Traits de créature (vue d'ensemble) · États (Sonné, Enflammé, Empoisonné, Brisé, Assourdi, Empêtré) · Tentacules et attaques naturelles · Zones d'effet et Lignes de vue · Avantage en combat · Le sort « Souffle » (Magie des Arcanes)

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 85` (l.137-138, l.168-169, l.289-290, l.317-331, l.442-447) → `TraitDef`, `scene`, `planClimb`, `morsure`, `doc`, `scenario`, `useTrampleJetProps`, `TraverseCapability`, `maxWounds`, `Formula`, +111 — `src/data/index.ts`, `src/data/maneuvers.json`, `src/data/qualities.json`, `src/data/regles.json`, `src/data/schemas/defs/structures.ts`, `src/data/structures.json`, +25 fichiers

---

## Traits de défense et de résilience des créatures

Ces Traits de créature (LDB chap. 85, *Traits de créature*) régissent **comment une créature encaisse, ignore ou récupère les Dégâts**. On les réunit ici parce qu'ils interviennent tous au moment de la **résolution d'une touche** (réduction/annulation des Dégâts, sauvegardes), à un **seuil de Points de Blessure** (0 PB, retour à la vie, délitement) ou en **réaction à une perte de PB** (sang, infection). Ils se posent dans le statbloc d'une créature et se cumulent. Chaque Trait est reproduit ci-dessous avec sa mécanique exacte, ses valeurs et ses exceptions, fidèlement au texte des livres.

### Réduction et annulation des Dégâts

**Armure (Indice).** « La créature est protégée par une armure ou une peau épaisse. Elle a *Indice* **PA** à toutes ses Localisations. » L'Indice est un nombre de **Points d'Armure appliqué à TOUTES les localisations** (Tête, Bras, Corps, Jambes), contrairement à une armure portée qui ne couvre que certaines parties. Il se cumule avec une armure éventuellement portée par la créature. — `LDB 85 l.38-39`

**Protection (Indice).** « Parce qu'elles sont magiques, bénéficient d'un talisman particulier ou sont simplement chanceuses, certaines créatures semblent éviter les coups. Lancer **1d10 après chaque coup reçu**. En cas de résultat **supérieur ou égal à *Indice***, le coup est ignoré **même s'il s'agit d'un Critique**. » C'est une **sauvegarde** (ward save) post-touche : un seul jet par coup ; sur réussite, l'intégralité du coup (Dégâts ET Critique) est annulée. Le seuil s'écrit « N+ » (ex. *Protection 7+* = réussit sur 7, 8, 9, 10). — `LDB 85 l.277-278`

**Démoniaque (Indice).** « L'essence de la créature est constituée de magie brute […]. Ces créatures n'ont besoin ni d'eau, ni de nourriture, ni d'air. Toutes ses attaques sont Magiques. Lancez **1d10 après chaque coup reçu**, si la créature obtient le nombre de l'*Indice* **ou plus**, le coup est ignoré, **même s'il s'agit d'un critique**. Si la créature **tombe à 0 Point de Blessure**, son âme **retourne immédiatement dans les Royaumes du Chaos**, ce qui la retire du jeu. » Démoniaque combine donc trois effets : (1) ses attaques sont des Attaques magiques ; (2) une **sauvegarde identique à Protection** (1d10 ≥ Indice ignore le coup, Critique inclus) ; (3) à 0 PB, la créature est **bannie** (retirée du jeu, pas de cadavre). — `LDB 85 l.95-98`

**Éthéré.** « La créature est immatérielle, ce qui lui permet de **passer à travers les objets solides**. Elle ne peut être blessée que par les **Attaques magiques**. » Toute attaque non magique inflige **0 Dégât** (annulée entièrement) ; seules les Attaques magiques (sorts, arme magique, créature *Magique*/*Démoniaque*) la blessent. — `LDB 85 l.133-134`

**Immunité (Type).** « La créature est totalement immunisée à un certain *Type* de Dégâts, comme ceux du poison, magiques ou électriques. **Tous les Dégâts de ce *Type*, y compris les Dégâts Critiques, sont ignorés.** » Annulation totale (Dégâts + Critiques) du type indiqué entre parenthèses (ex. *Immunité (Poison)*, *Immunité (Feu)*). — `LDB 85 l.172-173`

**Résistance à la Magie (Indice).** « La Magie n'affecte pas la créature autant que les autres. Le **DR de tous les Sorts** l'affectant est **réduit du nombre indiqué**. Ainsi, *Résistance à la Magie 2* réduit le DR de 2. » Ce n'est pas une annulation : on **soustrait l'Indice au nombre de Degrés de Réussite** du lanceur sur cette cible (réduisant la puissance/durée/dégâts par-DR du sort). — `LDB 85 l.302`

### Ignorer la douleur et les blessures

**Insensible à la Douleur.** « La créature ne ressent pas la douleur ou est capable de l'ignorer. Les **pénalités de Blessures Critiques** qui **ne découlent pas d'amputations** sont **ignorées**, bien que **les États soient subis normalement**. » La créature ignore les malus chiffrés des Critiques non-amputants ; les amputations (et donc leurs pénalités) et **tous les États** infligés par les Critiques restent en vigueur. — `LDB 85 l.195-195`

### Récupération et retour à la vie

**Régénération.** « La créature est capable de guérir à une vitesse extraordinaire, et même de faire repousser ses membres amputés.

> Au **début de chaque Round**, s'il reste **plus de 0 Point de Blessure** à la créature, elle **régénère 1d10 Points de Blessure**. Si elle est **à 0 Point de Blessure**, lancez 1d10. Sur un résultat de **8+**, elle régénère **1 seul Point de Blessure**. Sur un résultat de **10** à l'un ou l'autre de ces jets, elle régénère **également une Blessure Critique**, et ne souffre plus des pénalités et États associés.

> Les Blessures et Blessures Critiques infligées par le **Feu** ne peuvent pas être régénérées, et doivent être notées séparément. »

Table de résolution (1d10, début de Round) :

| État de la créature au début du Round | Jet 1d10 | Effet |
|---|---|---|
| PB actuels > 0 | tout résultat | régénère **1d10 PB** |
| PB actuels = 0 | 1 à 7 | rien |
| PB actuels = 0 | 8 ou 9 | régénère **1 PB** |
| n'importe lequel des deux jets ci-dessus | **10** | régénère **en plus 1 Blessure Critique** (pénalités/États associés levés) |

Les Dégâts dus au **Feu** sont notés à part et **jamais** régénérés. — `LDB 85 l.293-302`

**Increvable.** « Peu importe à quel point la créature est touchée, elle se relève. **Toutes les Blessures Critiques n'entraînant pas la mort peuvent être soignées** : attachez juste les parties du corps nécessaires aux endroits appropriés […]. **Même la « mort » peut être « soignée »** si les parties nécessaires, comme une tête décapitée, sont rattachées à son corps. Si la mort survient et que **toutes les parties sont en place**, un **Test de Résistance Intermédiaire (+0) nécessitant un DR de 6** peut être retenté **au début de chaque Round** pendant un **nombre de Rounds égal à son bonus d'Endurance** après la mort. Sur un succès, elle **revient à la vie avec 1 Point de Blessure**. » Le Test est donc un **Test de Résistance à modificateur +0 réussi avec un DR ≥ 6** (et pas seulement réussi), tenté chaque début de Round, dans la fenêtre de *bonus d'Endurance* Rounds, à condition que toutes les parties amputées aient été rattachées. — `LDB 85 l.182-183`

### Réactions à la perte de Points de Blessure

**Sang Corrosif.** « Le sang de la créature est corrosif. **Chaque fois qu'elle subit des Blessures** dont le sang éclabousse, **tous ceux qui sont *Engagés* avec elle** reçoivent **1d10 Points de Blessure modifiés par le Bonus d'Endurance et les PA, avec un minimum de 1**. » Déclenché à chaque perte de PB de la créature ; chaque adversaire au contact subit 1d10 Dégâts **réduits** par son propre Bonus d'Endurance et ses PA, mais **jamais en-dessous de 1**. — `LDB 85 l.268-268`

**Infecté.** « La créature, ou ses armes, est porteuse d'une dangereuse infection. **Si elle force un adversaire non Mort-vivant à perdre des Points de Blessure**, il doit effectuer un **Test de Résistance Facile (+40)** pour éviter la **Contamination d'une *Blessure Purulente*** (page 186). » Test déclenché par toute Blessure infligée par la créature à une cible vivante (non *Mort-vivant*) ; l'échec contamine une *Blessure Purulente* (chap. maladies, LDB 20). — `LDB 85 l.187-187`

**Parasité.** « La peau de la créature est couverte de puces ou autre vermine similaire. **Tous les adversaires subissent une pénalité de -10 pour la toucher en combat au Corps à corps** puisque les parasites les perturbent et les submergent. » Malus défensif passif : −10 au Test pour **toucher la créature** en mêlée. — `LDB 85 l.256-257`

### Délitement (créatures magiquement instables)

**Instable.** « Le corps de la créature est maintenu par d'ignobles magies, fondamentalement instables dans le plan matériel. **Chaque fois qu'elle met fin à un Round *Engagé* avec un adversaire ayant un Avantage supérieur**, la créature est repoussée et les magies la maintenant entière s'affaiblissent. Elle **perd un nombre de Points de Blessure égal à la différence entre son Avantage et celui supérieur de son adversaire**. Ainsi, si elle a 0 Avantage et son adversaire 2, elle perd 2 Points de Blessure. Si elle a **déjà atteint 0 Point de Blessure elle « meurt »**. » Vérifié en **fin de Round** : pour chaque adversaire engagé ayant plus d'Avantage, on compte le plus grand écart et on retire cet écart en PB ; à 0 PB, la créature est détruite. — `LDB 85 l.198-199`

---

### Traits de défense additionnels (autres livres — consolidation)

**Redoutable (Indice)** *(Le Zoo Impérial — Nouveau Trait de Créature)*. « Cette créature est particulièrement dangereuse, si bien qu'il est presque impossible de réellement prendre le dessus sur elle. Si, **au début de son tour**, la créature n'a pas autant d'Avantages que son *Indice* de Redoutable le voudrait (**par défaut, 1**), elle **gagne immédiatement tous les Avantages qui lui manquent**. Si la créature est sous l'effet d'un État ***Empêtré*, *Inconscient* ou *Surpris*, elle ne gagne pas d'Avantage**. » C'est une résilience d'Avantage : la créature regénère son pool d'Avantage jusqu'à l'Indice chaque tour (sauf si Empêtrée/Inconsciente/Surprise). Guidage MJ : « si un monstre présente **plus de niveaux de Redoutable qu'il n'y a de Personnages**, vous pourriez diminuer ou supprimer ce Trait. » Le texte de référence apparaît **deux fois à l'identique** dans le livre (au statbloc inaugural et dans l'appendice des nouveaux traits). — `ZI 01 l.79-80`, `ZI 14 l.1025-1026` (guidage : `ZI 14 l.1024`)

**Amorphe** *(L'Ennemi dans l'Ombre — Appendice 2, Nouvelles règles)*. « La créature est un blob amorphe. Il **divise par deux toutes les Blessures subies par des dégâts autres que le feu, le froid ou la magie**. Il **ignore toutes les Blessures critiques** et **ne peut être détruit qu'en étant réduit à 0 Blessure par le froid extrême, le feu ou la magie**. **S'il est réduit à 0 Blessure par d'autres moyens, il tombe en torpeur pendant 1d10 Rounds, puis régénère +1 Blessure.** Les créatures amorphes évitent les sources intense de chaleur ou de froid. » (Trait porté notamment par l'Amibe, EDO ch. 7.) — `EDO 11 l.224-226`

> ⚠️ Distinction-clé entre **Protection/Démoniaque** (sauvegarde 1d10 **≥** Indice **après** le coup) et **Résistance à la Magie** (réduction de **DR**, pas de jet). Les deux premières annulent le coup entier (Critique inclus) ; la dernière n'affaiblit que les Sorts.

**Sources RAW** :
- `LDB 85 l.38-39` — **Armure (Indice)** : Indice PA à TOUTES les localisations (peau épaisse/armure intégrale).
- `LDB 85 l.277-278` — **Protection (Indice)** : 1d10 après chaque coup, ≥ Indice → coup ignoré même Critique (ward save).
- `LDB 85 l.95-98` — **Démoniaque (Indice)** : attaques Magiques + sauvegarde 1d10 ≥ Indice (Critique inclus) + à 0 PB banni vers les Royaumes du Chaos ; sans besoin d'eau/nourriture/air.
- `LDB 85 l.133-134` — **Éthéré** : immatériel, traverse les solides, blessé uniquement par Attaques magiques.
- `LDB 85 l.172-173` — **Immunité (Type)** : Dégâts du Type (Critiques inclus) totalement ignorés.
- `LDB 85 l.302` — **Résistance à la Magie (Indice)** : DR de tous les Sorts l'affectant réduit de l'Indice (ex. 2 → −2 DR).
- `LDB 85 l.195-195` — **Insensible à la Douleur** : pénalités de Critiques non-amputants ignorées ; États subis normalement.
- `LDB 85 l.293-302` — **Régénération** : début de Round, >0 PB → +1d10 PB ; à 0 PB → 8+ régénère 1 PB ; 10 régénère aussi 1 Critique ; Feu jamais régénéré (noté à part).
- `LDB 85 l.182-183` — **Increvable** : Critiques non-mortels recousables, même la mort si parties rattachées ; Test de Résistance Intermédiaire (+0) DR 6 chaque début de Round, *bonus d'Endurance* Rounds → retour à 1 PB.
- `LDB 85 l.268-268` — **Sang Corrosif** : à chaque Blessure subie, tous les Engagés reçoivent 1d10 (modifié par BE+PA), minimum 1.
- `LDB 85 l.187-187` — **Infecté** : forcer une perte de PB sur cible non Mort-vivant → Test de Résistance Facile (+40) ou *Blessure Purulente*.
- `LDB 85 l.256-257` — **Parasité** : −10 à tous les adversaires pour la toucher au Corps à corps.
- `LDB 85 l.198-199` — **Instable** : fin de Round Engagé contre Avantage supérieur → perd (Avantage adverse − son Avantage) PB ; à 0 PB, « meurt ».
- `ZI 01 l.79-80` et `ZI 14 l.1025-1026` — **Redoutable (Indice)** (Le Zoo Impérial) : début de tour, regagne l'Avantage manquant jusqu'à l'Indice (défaut 1), sauf si Empêtré/Inconscient/Surpris ; guidage MJ `ZI 14 l.1024`.
- `EDO 11 l.224-226` — **Amorphe** (L'Ennemi dans l'Ombre) : Blessures non-feu/froid/magie ÷2, ignore tous les Critiques, détruit seulement à 0 PB par feu/froid extrême/magie ; sinon torpeur 1d10 Rounds puis +1 Blessure.

> « Lancer 1d10 après chaque coup reçu. En cas de résultat supérieur ou égal à *Indice*, le coup est ignoré même s'il s'agit d'un Critique. » — `LDB 85 l.278` (Protection)

> « Si elle est à 0 Point de Blessure, lancez 1d10. Sur un résultat de 8+, elle régénère 1 seul Point de Blessure. Sur un résultat de 10 à l'un ou l'autre de ces jets, elle régénère également une Blessure Critique […]. Les Blessures et Blessures Critiques infligées par le Feu ne peuvent pas être régénérées […]. » — `LDB 85 l.296` (Régénération)

> « Si, au début de son tour, la créature n'a pas autant d'Avantages que son *Indice* de Redoutable le voudrait (par défaut, 1), elle gagne immédiatement tous les Avantages qui lui manquent. » — `ZI 14 l.1045` (Redoutable)

**Voir aussi** : Traits d'attaque et d'allonge des créatures (Arme, Morsure, Cornes, Souffle, Étreinte glaciale) · Avantage en combat (Redoutable, Belliqueux) · Blessures critiques et Traumatisme (LDB 18) · Maladies et infections (LDB 20 — Blessure Purulente) · Localisation et Points d'Armure · Attaques magiques et Résistance des sorts (LDB 46) · Psychologie des créatures (Bestial, Immunité Psychologique).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 85` (l.38-39, l.95-98, l.133-134, l.172-173, l.182-183, l.187, l.195, l.198-199, l.256-257, l.268, l.277-278, l.293-302) → `TraitDef`, `scene`, `a-distance`, `arme`, `planClimb`, `a-sang-froid`, `morsure`, `affame`, `scenario`, `StatblockEditor`, +172 — `src/data/index.ts`, `src/data/maneuvers.json`, `src/data/qualities.json`, `src/data/schemas/defs/traits.ts`, `src/data/schemas/grammaire/mecanique.ts`, `src/data/traits.json`, +32 fichiers
- `ZI 1` (l.79-80) → `bon-baiser-d-la-fosse-noire`, `nuee-d-escampette`, `toile-surprise`, `grand-cerf`, `l-ombre-du-fleuve`, `arachnarok` — `src/data/creatures.json`, `src/data/spells.json`
- `ZI 14` (l.1024, l.1025-1026, l.1045) → `fouissement` — `src/data/traits.json`
- `EDO 11` (l.224-226) → `Formula`, `Condition`, `engagedAdvantageLead`, `EffectTargeting`, `chair-necrosee`, `cretin`, `pattes-chevre`, `tete-bestiale-chien`, `digere`, `tete-pointue`, +9 — `src/data/etats.json`, `src/data/mutations.json`, `src/data/traits.json`, `src/data/trappings.json`, `src/engine/flowCore.ts`, `src/engine/ops.ts`, +2 fichiers

---

## Traits de comportement et de psychologie des créatures

Cette entrée regroupe les **Traits de créature** (LDB 85) qui régissent le *comportement* et la *psychologie* d'un PNJ ou d'un monstre, ainsi que les mécaniques de **Psychologie** (LDB 21) auxquelles ces Traits renvoient. Les Traits de créature servent à fabriquer des PNJ personnalisés (« Voici les Traits de créature. Utilisez-les pour créer des PNJ personnalisés. »). Beaucoup de ces Traits ne sont que des *pointeurs* vers les règles de Psychologie du chapitre Règles (page 190-191 du livre) — leur mécanique réelle est donc transcrite ci-dessous depuis LDB 21.

### Mécanique commune : le Test de Psychologie (LDB 21)

Quand un personnage est exposé à un Trait Psychologique, il peut **tenter d'y résister par un Test de Calme au début du Round**, dont la **Difficulté est fixée par le MJ** (le moteur sans MJ prend **Intermédiaire (+0)** par défaut, comme les exemples du livre). Sur un succès, les effets sont annulés **jusqu'à la fin de la rencontre** — d'autres Tests pouvant être exigés si les circonstances changent. Le Test de Calme utilise la **Force Mentale** (compétence Calme), basée sur FM.

> « Si vous vous retrouvez exposé à l'un des Traits Psychologiques suivants, vous pouvez tenter de résister à leurs effets en réussissant un Test de Calme au début du Round, Test dont la Difficulté est déterminée par le MJ. Sur un succès, les effets sont annulés jusqu'à la fin de la rencontre, même si d'autres Tests peuvent être nécessaires si les circonstances changent. » — `LDB 21 l.9`

---

### Traits de comportement de combat (LDB 85)

#### Belliqueux
La créature adore combattre. **Tant qu'elle a plus d'Avantages que son adversaire, elle gagne Immunité Psychologique.** (Trait inerte si l'on ne connaît pas l'Avantage adverse.)

> « La créature adore combattre. Tant qu'elle a plus d'Avantages que son adversaire, elle gagne Immunité Psychologique. » — `LDB 85 l.51`

#### Bestial (comportement en combat)
La créature ne possède **ni pensée, ni langage rationnel**. Comportement codifié :
- Elle **a peur du feu** et **gagne l'État _Brisé_ si elle est touchée par le feu**.
- **En défense, elle ne peut utiliser que la Compétence Esquive** (pas de Parade).
- **Si elle perd plus de la moitié de ses Blessures, elle tente de fuir** — *sauf* si elle protège son petit, *ou* si elle est acculée, *ou* si elle possède le Trait **Territorial**. Dans ce cas, elle **entre en _Frénésie_** (voir Psychologie p.190).
- **Pas de caractéristique de Sociabilité.**

> « Elle a peur du feu et gagne l'État _Bris_é si elle est touchée par ce dernier. En défense, elle peut seulement utiliser la Compétence Esquive. Si elle perd plus de la moitié de ses Blessures, elle tente de fuir à moins qu'elle ne protège son petit ou qu'elle soit acculée ou encore qu'elle possède le trait Territorial. Dans ce cas, elle entre en _Frénésie_ […]. Pas de caractéristique de Social. » — `LDB 85 l.59`

#### Champion
La créature est un guerrier exceptionnel. **Si elle gagne un Test opposé en se défendant dans un Combat au Corps à corps, elle cause autant de Dégâts que si elle était l'attaquant.**

> « Si elle gagne un Test opposé en se défendant dans un Combat au Corps à corps, elle cause autant de Dégâts que si elle était l'attaquant. » — `LDB 85 l.71`

#### Frénésie (Trait)
La créature **peut entrer en _Frénésie_** (renvoi à LDB 21 p.190). Mécanique complète (LDB 21) :
- Entrée par un **Test de Force Mentale** ; sur un succès, on entre en Frénésie.
- Tant qu'on est en Frénésie : **immunisé à tous les autres Traits Psychologiques** ; **ne fuit jamais, ne bat jamais en retraite** ; on **doit se déplacer au maximum vers l'ennemi le plus proche dans sa Ligne de Vue pour l'attaquer**. Seule Action possible : un Test de **CC** ou d'**Athlétisme** pour atteindre l'ennemi.
- On effectue **un Test de CC gratuit chaque Round**, et on **gagne un Bonus de Force de +1**.
- On reste en Frénésie jusqu'à ce que **tous les ennemis en Ligne de Vue soient neutralisés** ou qu'on gagne l'État **_Sonné_** ou **_Inconscient_**. Quand la Frénésie s'achève, on **gagne l'État _Exténué_**.

> « De plus, vous pouvez effectuer un Test de **Capacité de Combat** gratuit chaque Round car vous vous lancez à corps perdu dans votre attaque. Enfin, vous gagnez un Bonus de Force de +1 grâce à votre férocité. […] Dès que votre _Frénésie_ s'achève, vous gagnez l'État _Exténué_. » — `LDB 21 l.33-35`

#### Rage
La créature peut entrer dans une rage dévorante :
- Elle peut **dépenser tous ses Avantages (minimum 1)** pour que cela devienne **_Haine_** envers ses adversaires en combat rapproché.
- Elle peut aussi **dépenser tous ses Avantages (minimum 3)** pour **entrer en _Frénésie_**.

> « Elle peut dépenser tous ses Avantages (minimum 1) pour que celui devienne _Haine_ envers ses adversaires en combat rapproché. Elle peut aussi dépenser tous ses Avantages (minimum 3) pour entrer en _Frénésie_. » — `LDB 85 l.282`

#### Stupide (perte d'Action en combat)
La créature **n'est pas entièrement dénuée de lucidité** (elle n'a donc pas le Trait Bestial), mais elle est Stupide :
- **Si elle est aux côtés d'un allié non-Stupide**, ce dernier la guide et **rien ne se passe**.
- **Sinon**, elle effectue un **Test d'Intelligence Facile (+40) au début de chaque Round**. **Sur un échec**, elle devient confuse (bave, s'assied, se cure le nez…) et **perd à la fois son Mouvement et son Action pour ce tour**.

> « Sinon, elle effectue un Test d'**Intelligence Facile (+40)** au début de chaque Round. Sur un échec, elle devient confuse […] perdant à la fois son Mouvement et son Action pour ce tour. » — `LDB 85 l.335`

#### Affamé (perte d'Action en combat)
La créature est toujours avide de chair fraîche. **Si elle tue ou neutralise un adversaire** (ou tombe sur un cadavre récent), elle doit **réussir un Test de Force Mentale Accessible (+20)** ou **festoyer, perdant sa prochaine Action et son prochain Mouvement**.

> « Si elle tue ou neutralise un adversaire (ou qu'elle tombe sur un cadavre récent), elle doit réussir un Test de **Force Mentale Accessible (+20)** ou festoyer, perdant sa prochaine Action et son prochain Mouvement. » — `LDB 85 l.17`

#### À Sang-Froid
La créature est à sang-froid et lente à réagir. **Elle peut inverser tous ses Tests de Force Mentale échoués** (un jet raté est relu chiffres inversés, ex. 91 → 19, s'il devient ainsi une réussite).

> « Elle peut inverser tous ses Tests de **Force Mentale** échoués. » — `LDB 85 l.13`

#### Nerveux (réaction aux stimuli en combat)
La créature est **facilement effrayée par la magie ou les bruits forts**. Si cela se produit, **elle gagne +3 États _Brisé_**. (Note : le Dressage « Guerre » fait ignorer Nerveux pour les bruits forts ; le Dressage « Magie » le fait ignorer en présence de magie — LDB 85 l.110.)

> « La créature est facilement effrayée par la magie ou les bruits forts. Si cela se produit, elle gagne +3 États _Brisé_. » — `LDB 85 l.249`

#### Perturbant
La créature perturbe/désoriente ses ennemis (musc soporifique, odeur nauséabonde, apparence horrifiante…). **Toute personne se trouvant à un nombre de mètres égal à son Bonus d'Endurance subit −20 à tous ses Tests.** Une créature touchée **ne subit cette pénalité qu'une seule fois**, peu importe le nombre d'ennemis Perturbants.

> « Toute personne se trouvant à un nombre de mètres égal à son Bonus d'Endurance obtient une pénalité de -20 à tous ses Tests. Les créatures touchées ne peuvent subir cette pénalité qu'une seule fois, peu importe le nombre d'ennemis Perturbants. » — `LDB 85 l.262`

#### Immunité Psychologique
La créature **n'a peur de rien** et **ignore les règles de la Psychologie** (renvoi p.190).

> « Peu importe que la créature soit téméraire, extrêmement stupide ou juste dans le feu de l'action, elle n'a peur de rien. Elle ignore les règles de la Psychologie. » — `LDB 85 l.179`

#### Magique
La créature est imprégnée de Magie. **Toutes ses Attaques sont des Attaques magiques** et **peuvent blesser les créatures qui ne sont vulnérables qu'aux Attaques magiques**.

> « Toutes ses Attaques sont des Attaques magiques et peuvent blesser les créatures qui sont uniquement vulnérables aux Attaques magiques. » — `LDB 85 l.221`

---

### Traits-pointeurs psychologiques (LDB 85 → LDB 21)

Ces Traits ne sont que des marqueurs : leur mécanique vit dans le chapitre Psychologie.

#### Peur (Indice)
La nature de la créature engendre une **Peur surnaturelle** d'un niveau égal à l'**Indice**. Mécanique (LDB 21) :
- La Peur se surmonte par un **Test étendu de Calme** : l'Indice est le **DR cumulé à atteindre**. On peut tester **à la fin de chaque Round** jusqu'à ce que le DR cumulé ≥ Indice. Tant que ce n'est pas atteint, on reste sujet à la Peur.
- Sous Peur : **−1 DR à tous les Tests en rapport avec la source** ; **incapable de se rapprocher de la source** sans réussir un **Test de Calme Intermédiaire (+0)** ; **si la source se rapproche de soi**, réussir un **Test de Calme Intermédiaire (+0)** ou **gagner un État _Brisé_**.

> « Lorsque vous êtes sous le coup de la _Peur_, vous subissez -1 DR à tous les Tests en rapport avec la source de votre peur. Vous êtes incapable de vous rapprocher de ce qui provoque cette _Peur_ à moins de réussir un Test de **Calme Intermédiaire (+0)**. Si la source de votre _Peur_ se rapproche de vous, vous devez réussir un Test de **Calme Intermédiaire (+0)** ou gagner un État _Brisé_. » — `LDB 21 l.27`

#### Terreur (Indice)
La créature suscite une **Terreur surnaturelle** d'un niveau égal à l'**Indice**. Mécanique (LDB 21) :
- À la **première rencontre**, **un seul Test de Psychologie (Calme)**. Sur un succès, aucun effet supplémentaire. **Sur un échec**, on gagne **autant d'États _Brisé_ que l'Indice de Terreur, plus les DR inférieurs à 0** (Brisé = Indice + |DR négatifs|).
- **Ensuite, la créature cause de la _Peur_ avec un Indice de Peur égal à son Indice de Terreur.**

> « Sur un échec, vous gagnez autant d'États _Brisé_ que l'_Indice_ de _Terreur_ de la créature, auquel vous rajoutez les DR inférieurs à 0. Une fois ce Test de Psychologie effectué, la créature cause la _Peur_, avec un _Indice_ de _Peur_ équivalent à son _Indice_ de _Terreur_. » — `LDB 21 l.54-56`

**Peur/Terreur par la Taille** (LDB 85) : une créature jugée agressive cause la **Peur** à toute créature plus petite qu'elle, et la **Terreur** à toute créature plus petite **d'au moins deux catégories** ; le niveau égale **la différence de catégories de Taille**.

> « Le niveau de _Peur_ ou de _Terreur_ égale la différence de catégories de Taille. Ainsi, si elle est de catégorie Grande et son adversaire de catégorie Petite, elle lui cause _Terreur_ 2. » — `LDB 85 l.383`

#### Haine (Cible)
La créature hait profondément la _Cible_ (un groupe). Mécanique (LDB 21) :
- À la rencontre du groupe haï : **Test de Psychologie**. **Sur un échec**, on ressent la _Haine_.
- Sous Haine : on **doit tout faire pour détruire le groupe haï, le plus vite et le plus violemment possible** ; **+1 DR à tous les Tests de Combat contre ce groupe** ; **immunisé à _Peur_ et _Intimidation_ causés par ce groupe (mais pas à _Terreur_)**.
- À la fin de chaque Round suivant, on **peut** retenter un Test pour y mettre fin ; sinon, la Haine se dissipe quand tous les membres du groupe en Ligne de Vue sont **morts/disparus** ou qu'on gagne l'État **_Inconscient_**.

> « Vous gagnez +1 DR à tous vos Tests de Combat effectués contre le groupe en question, et êtes immunisé à _Peur_ et _Intimidation_ (mais pas _Terreur_) causés par ceux de ce groupe. » — `LDB 21 l.41`

#### Animosité (Cible)
La créature n'aime pas la _Cible_ (un groupe). Mécanique (LDB 21) :
- **Test de Psychologie à chaque rencontre du groupe.** **Sur un succès** : on peut marmonner/cracher mais on ne subit que **−20 aux Tests de Sociabilité envers ce groupe**. **Sur un échec** : on subit _Animosité_.
- Sous Animosité : on **doit immédiatement s'en prendre aux créatures**, verbalement (insultes, sarcasmes) ou physiquement (souvent à coups de poing) ; on **gagne +1 DR dès qu'on s'en prend au groupe (socialement ou physiquement)**.
- À la fin de chaque Round suivant, on **peut** retenter un Test pour y mettre fin ; sinon l'Animosité cesse quand le groupe en Ligne de Vue s'est calmé/a disparu, qu'on gagne l'État **_Sonné_** ou **_Inconscient_**, ou qu'on tombe sous un autre effet psychologique.
- **_Animosité_ est annulé par _Peur_ et _Terreur_.**

> « Vous gagnez également +1 DR dès que vous vous en prenez au groupe, que cela soit socialement ou physiquement. _Animosité_ est annulé par _Peur_ et _Terreur_. » — `LDB 21 l.21`

> *(Pour mémoire, le Trait apparenté **Préjugé (Cible)** — LDB 85 l.274 / LDB 21 l.41 — n'impose qu'une pénalité **−10** aux Tests de Sociabilité sur un succès, et oblige à insulter copieusement la Cible sur un échec ; il est plus faible que l'Animosité.)*

---

### Traits liés à la Corruption et aux Maladies (LDB 85)

#### Corruption (Degré)
La créature est corrompue par le Chaos ou imprégnée de Magie noire. Le **Degré** de Corruption (Mineur / Modéré / Majeur) est indiqué entre parenthèses (renvoi p.182). Ce Degré détermine la sévérité de l'**Exposition** que la présence de la créature impose aux personnages (LDB 19) :

| Degré d'Exposition | Échec au Test | Succès Minime (0-1 DR) | Succès (2-3 DR) | Succès Impressionnant (4+ DR) |
|---|---|---|---|---|
| **Mineure** | +1 Point de Corruption | — | — | — |
| **Modérée** | +2 Points de Corruption | +1 Point de Corruption | 0 (Succès 2+ DR) | 0 |
| **Majeure** | +3 Points de Corruption | +2 Points de Corruption | +1 Point de Corruption | 0 |

— `LDB 19 l.34-58` (Exposition Mineure / Modérée / Majeure)

> « La créature est corrompue par le Chaos, ou peut-être imprégnée de Magie noire. Le _Degré_ de Corruption est indiqué entre parenthèses. » — `LDB 85 l.87`

#### Corruption Mentale
Le Chaos s'est insinué dans l'esprit de la créature. **On lance sur le Tableau de la Corruption Mentale** (p.185 du livre).

> « Le Chaos s'est insinué dans l'esprit de la créature… Faites un lancer sur le Tableau de la Corruption Mentale qui se trouve à la p. 185. » — `LDB 85 l.92`

#### Maladie (Type)
La créature est **porteuse de la maladie _Type_**. **Les autres doivent faire un Test approprié pour éviter la Contraction de la maladie** (renvoi p.186, règles de Maladies LDB 20).

> « La créature est porteuse de la maladie _Type_. Les autres doivent faire un Test approprié pour éviter la Contraction de la maladie. » — `LDB 85 l.225`

---

### Cas particuliers d'immunité psychologique connexes

- **Fabriqué** (LDB 85 l.142) : la créature est complètement stupide, **sans Caractéristiques d'Int, FM ou Soc** ; tout Test pour ces Caractéristiques est **automatiquement réussi** (donc les Tests psychologiques réussissent d'office).
- **Nuée** (LDB 85 l.253) : « Elles ignorent les règles de Psychologie ».
- **Frénésie active** et le Trait **Immunité Psychologique** : voir ci-dessus.

**Sources RAW** :
- `LDB 85 l.5` — « Voici les Traits de créature. Utilisez-les pour créer des PNJ personnalisés. »
- `LDB 85 l.51` — Belliqueux : Immunité Psychologique tant que ses Avantages > ceux de l'adversaire.
- `LDB 85 l.59` — Bestial : peur du feu (Brisé si touché par le feu), défense Esquive seule, fuite si perd >½ PB (sauf petit/acculé/Territorial → Frénésie), pas de Soc.
- `LDB 85 l.71` — Champion : en défense gagnée en Test opposé de mêlée, inflige des Dégâts comme l'attaquant.
- `LDB 85 l.150` — Frénésie (Trait, renvoi p.190).
- `LDB 85 l.179` — Immunité Psychologique : ignore les règles de Psychologie.
- `LDB 85 l.185` — Magique : toutes ses Attaques sont magiques (blessent le « uniquement vulnérable au magique »).
- `LDB 85 l.262` — Perturbant : aura −20 à tous les Tests dans un rayon = Bonus d'Endurance (mètres), non cumulable.
- `LDB 85 l.282` — Rage : dépenser tous Avantages (min 1) → Haine, ou (min 3) → Frénésie.
- `LDB 85 l.335` — Stupide : sans allié non-Stupide adjacent, Test d'Int Facile (+40) début de Round, échec = perd Mouvement + Action.
- `LDB 85 l.13` — À Sang-Froid : peut inverser tous ses Tests de FM échoués.
- `LDB 85 l.17` — Affamé : tue/neutralise (ou cadavre récent) → Test de FM Accessible (+20) ou festoie (perd prochaine Action + Mouvement).
- `LDB 85 l.249` — Nerveux : effrayé par magie / bruits forts → +3 États Brisé.
- `LDB 85 l.87` — Corruption (Degré) : Degré entre parenthèses (renvoi p.182).
- `LDB 85 l.92` — Corruption Mentale : lancer sur le Tableau de la Corruption Mentale (p.185).
- `LDB 85 l.185` — Maladie (Type) : porteuse ; les autres font un Test pour éviter la Contraction (p.186).
- `LDB 85 l.264` — Peur (Indice) : Peur surnaturelle de niveau Indice (renvoi p.190).
- `LDB 85 l.411` — Terreur (Indice) : Terreur surnaturelle de niveau Indice (renvoi p.191).
- `LDB 85 l.166` — Haine (Cible) : haine profonde de la Cible (renvoi p.190).
- `LDB 85 l.25` — Animosité (Cible) : n'aime pas la Cible (renvoi p.190).
- `LDB 85 l.274` — Préjugé (Cible) : n'apprécie pas la Cible (renvoi p.190).
- `LDB 85 l.383` — Peur/Terreur par la Taille : niveau = écart de catégories ; Terreur si écart ≥ 2.
- `LDB 21 l.9` — Test de Psychologie : Calme au début du Round, Difficulté au MJ ; succès = effets annulés pour la rencontre.
- `LDB 21 l.19-21` — Animosité : succès = −20 Soc, échec = doit s'en prendre au groupe (+1 DR) ; annulé par Peur/Terreur.
- `LDB 21 l.23-25` — Peur : Test étendu de Calme jusqu'à DR ≥ Indice ; sous Peur −1 DR, approche/source-qui-approche = Test Calme Intermédiaire (+0) sinon Brisé.
- `LDB 21 l.29-33` — Frénésie : Test de FM ; immunité psy, ne fuit pas, doit avancer/attaquer, CC gratuit/Round, +1 BF, fin → Exténué.
- `LDB 21 l.37-39` — Haine : doit détruire le groupe, +1 DR Combat vs groupe, immunité Peur/Intimidation (pas Terreur).
- `LDB 21 l.43-50` — Préjugé : succès = −10 Soc, échec = insulter copieusement la Cible.
- `LDB 21 l.54-56` — Terreur : un seul Test de Calme ; échec = Indice Brisé + |DR négatifs| ; puis Peur d'Indice égal.
- `LDB 19 l.34-58` — Exposition Mineure / Modérée / Majeure : conversion Degré → Points de Corruption gagnés selon le résultat du Test.

**Voir aussi** : États (Brisé, Sonné, Inconscient, Exténué) ; Frénésie et Avantage ; Peur, Terreur et Calme ; Corruption et mutations ; Maladies et Contraction ; Taille des créatures (Peur/Terreur par catégorie) ; Test étendu et Degrés de Réussite.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 19` (l.34-58) → `CorruptionModal`, `combat-end-corruption`, `sombre-pacte`, `EXPOSURE_LADDER`, `NATURE_INFLUENCE`, `testDeCorruption`, `MANUAL_COMBAT_INTENTS`, `physique`, `exposureLevelSchema`, `corruption-mineure`, +21 — `src/data/characteristics.json`, `src/data/combat-stakes.json`, `src/data/flow-stakes.json`, `src/data/mutationTables.json`, `src/data/regles.json`, `src/data/schemas/defs-scenes/effets.ts`, +14 fichiers
- `LDB 21` (l.9, l.19-21, l.23-25, l.27, l.29-35, l.37-39, l.41, l.43-50, l.54-56) → `ApproachModal`, `FrenzyModal`, `hasMeaningfulOption`, `nightmare`, `PsychAffliction`, `openEncounterPsych`, `opRow`, `fearSourceFor`, `psychImmuneToFrom`, `terreur`, +59 — `src/data/combat-stakes.json`, `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/night-stakes.json`, `src/data/psychology.json`, `src/data/regles.json`, +26 fichiers
- `LDB 85` (l.5, l.13, l.17, l.25, l.51, l.59, l.71, l.87, l.92, l.110, l.142, l.150, l.166, l.179, l.185, l.221, l.225, l.249, l.253, l.262, l.264, l.274, l.282, l.335, l.383, l.411) → `TraitDef`, `scene`, `a-distance`, `arme`, `planClimb`, `a-sang-froid`, `morsure`, `doc`, `affame`, `scenario`, +203 — `src/data/index.ts`, `src/data/maneuvers.json`, `src/data/qualities.json`, `src/data/regles.json`, `src/data/schemas/defs/structures.ts`, `src/data/schemas/defs/traits.ts`, +39 fichiers

---

## Traits de mouvement et modificateurs d'attributs des créatures

Les **Traits de créature** (LDB chap. 85) servent à bâtir des PNJ et monstres : on les attache à une créature, parfois avec un **Indice** (valeur numérique entre parenthèses) ou un **Aspect/Type/Cible**. Ce topic couvre deux familles : les traits qui **modifient le déplacement** (Bond, Foulée, Vol, Grimpant, Rapide, Se Cabrer, Dressé:Guerre) et les traits qui **modifient les caractéristiques / les Blessures** (Brutal, Coriace, Élite, Endurant, Grand) ainsi que **Fabriqué** (mécanique de combat particulière). Tous sont reproduits ci-dessous au mot près sur leur partie mécanique.

### Traits de mouvement

**Bond** — La créature peut bondir haut (jambes puissantes, magie, ailes courtes). **Quand elle Charge ou Court, elle double sa Caractéristique de Mouvement**, et elle peut **ignorer tous les terrains et les personnages qui s'interposent quand elle les dépasse**. (LDB 85 l.62-63)

**Foulée** — Grandes foulées (quadrupède ou jambes très longues). **Multipliez son Mouvement de charge par 1,5 quand elle Court.** (LDB 85 l.145-146)

> Note de cumul : Bond (×2) et Foulée (×1,5) jouent tous deux sur le Mouvement de Course/Charge. Le RAW ne précise pas leur empilement ; voir « Implémente » pour le choix retenu par notre code (Bond prime, pas de cumul).

**Vol (Indice)** — Trait à Indice (distance de vol en mètres). Sous-système de mouvement *et* de ciblage :
- Quand la créature se **Déplace**, elle peut voler **jusqu'à *Indice* mètres** ; elle **ignore alors tous les terrains, obstacles et personnages** qui s'interposent. À la fin de son Mouvement, elle décide **si elle atterrit ou si elle continue de voler**. Elle **peut utiliser ce Mouvement pour Charger**.
- Si elle **commence son tour en volant, elle doit choisir le Vol pour son Mouvement**. Si elle ne peut pas voler, le MJ décide à quelle distance elle tombe (chute, LDB 16 p.168).
- **Ciblage d'une créature en vol** : on mesure la distance horizontale normalement, puis **on augmente la distance de 1 niveau** (catégorie de Portée). Ainsi une **Longue Distance devient Extrême**, et **une créature volante à Distance Extrême ne peut pas être touchée**.
- **Quand elle vole, elle subit une pénalité de −20 à toutes les tentatives de combat à distance**, alors qu'elle virevolte dans le ciel. (LDB 85 l.428-439)

**Grimpant** — La créature escalade facilement les surfaces verticales et parcourt même les plafonds. Elle **avance à sa vitesse maximale de Mouvement sur toutes les surfaces appropriées** et **réussit automatiquement tous ses Tests d'Escalade**. (LDB 85 l.160-162)

**Rapide** — La créature se déplace de façon incroyablement rapide. Elle reçoit **+1 M et +10 en Ag**. (LDB 85 l.285-286)

**Se Cabrer** — Pour une **Action de Mouvement**, la créature peut effectuer une **Attaque de Piétinement** si elle est **plus grande que son adversaire** (voir Taille). (LDB 85 l.310-314) L'Attaque de Piétinement provient des **Modificateurs de Taille en Combat** : une créature plus grande applique les multiplicateurs de Dégâts et les Atouts liés à l'écart de catégories (voir table ci-dessous).

### Trait Dressé (Compétences Spécifiques) — sous-option Guerre

Le Trait **Dressé** liste entre parenthèses les disciplines acquises via la Compétence **Dressage**. La sous-option pertinente au combat/mouvement :

**Guerre** — L'animal est **entraîné pour la guerre, il gagne +10 en CC**. Il **ignore également son trait Nerveux pour les bruits forts**. (LDB 85 l.110)

(Les autres sous-options Dressé — Divertir, Dompté, Garder, Magie, Monture, Rapporter, Revenir à la maison, Trait — sont décrites au même endroit ; seul **Guerre** porte un effet de combat direct.)

### Traits modificateurs de caractéristiques / Blessures

**Brutal** — Créature lourde et brutale : **−1 en M, −10 en Ag, +10 en F et en E**. (LDB 85 l.65-67)

**Grand** — Grand spécimen de son espèce : **+10 en F et en E, −5 en Ag**. (LDB 85 l.157-158)

**Coriace** — Plus résistante aux Dégâts et peu susceptible de reculer : **+10 en E et FM**. (LDB 85 l.78-79)

**Élite** — Féroce vétéran : **+20 en CC, CT et FM**. (LDB 85 l.125-126)

**Endurant** — Encaisse plus de Dégâts : **augmentez ses Points de Blessure d'un nombre égal à son Bonus d'Endurance**, et ce **avant tout modificateur de Taille**. (LDB 85 l.129-130)

#### Table — modificateurs de caractéristiques par trait (LDB 85)

| Trait | M | Ag | F | E | CC | CT | FM | Autre |
|---|---|---|---|---|---|---|---|---|
| Bond | ×2 en Charge/Course | — | — | — | — | — | — | ignore terrains/personnages traversés |
| Foulée | ×1,5 en Course | — | — | — | — | — | — | — |
| Rapide | +1 | +10 | — | — | — | — | — | — |
| Brutal | −1 | −10 | +10 | +10 | — | — | — | — |
| Grand | — | −5 | +10 | +10 | — | — | — | — |
| Coriace | — | — | — | +10 | — | — | +10 | — |
| Élite | — | — | — | — | +20 | +20 | +20 | — |
| Endurant | — | — | — | — | — | — | — | +Bonus d'Endurance aux Points de Blessure (avant modif. de Taille) |
| Dressé (Guerre) | — | — | — | — | +10 | — | — | ignore Nerveux (bruits forts) |

— LDB 85 l.62-158, l.234-235, l.89

### Trait Fabriqué — règles de combat

**Fabriqué** — Créature née de la magie, complètement stupide, dont l'intégrité tient à des liens magiques. Effets de combat :
- Elle **ne possède pas de Caractéristiques d'Int, de FM ou de Soc**. Si un **Test pour ces Caractéristiques** est requis, il est **considéré comme automatiquement réussi**.
- Sans sorcier pour la contrôler et **sans le Trait Territorial**, elle erre sans raison, suivant les flux de magie.
- **Pour le calcul des Blessures** de la créature, **au lieu d'utiliser son bonus de Force Mentale, utilisez son bonus de Force**.
- **Toutes ses Attaques sont Magiques.** (LDB 85 l.141-142)

### Référence — Modificateurs de Taille en Combat (pour Se Cabrer / Piétinement)

**Si la créature est plus grande :**
- Ses armes gagnent l'Atout **Dévastatrice** si la créature est d'une catégorie de Taille supérieure, et **Percutante** si elle est plus grande d'au moins **deux** catégories.
- Les **Dégâts infligés sont multipliés** par le nombre de catégories de Taille supérieures (2 catégories = ×2, 3 = ×3, etc.), **après application des modificateurs**.
- Toutes les frappes réussies **activent la règle optionnelle Frappe Mortelle**, même si la cible survit.

**Si la créature est plus petite :** elle gagne un **bonus de +10 pour toucher**.

**Défense contre les grosses créatures :** **−2 DR par catégorie de Taille supérieure** de l'adversaire quand on se défend avec la **CC** lors d'un Test opposé (mieux vaut esquiver qu'opposer une parade). — LDB 85 l.357-370

### Note inter-livres — Trait Fouissement (Zoo Impérial)

Le **Zoo Impérial** ajoute un trait de mouvement parallèle à Vol, **Fouissement (Indice)** :
- Pour se déplacer, la créature peut **creuser dans le sol sur une distance en mètres égale à son *Indice***. En fouissant, elle **ignore tout obstacle, personnage ou terrain difficile**. À la fin, elle choisit **de sortir de terre ou de rester enfouie**. Elle **peut s'en servir pour Charger**. **Si elle commence son tour sous terre, elle doit se déplacer par fouissement.**
- **Pour attaquer une cible enfouie**, on calcule la distance au sol normalement mais on **augmente la Portée de 2 niveaux** : un tir à Portée Moyenne passe à Extrême, et **un tir à Portée Longue ou Extrême devient impossible**. (ZI 02 l.66-70, l.2952-2958)

> « Cette créature peut se déplacer en creusant un tunnel dans la terre ou la pierre à une vitesse inimaginable. […] Lorsqu'elle fouit, elle ignore tout obstacle, personnage ou terrain difficile sur son passage. » — `ZI 2 l.68`

**Sources RAW** :
- `LDB 85 l.62-63` — **Bond** : double le Mouvement en Charge/Course, ignore terrains et personnages traversés.
- `LDB 85 l.145-146` — **Foulée** : Mouvement de Course ×1,5.
- `LDB 85 l.428-439` — **Vol (Indice)** : vole jusqu'à *Indice* m en ignorant terrain/obstacles/personnages ; atterrir ou continuer au choix ; peut Charger ; doit voler si commence le tour en vol ; cible en vol = +1 niveau de Portée (Extrême→intouchable) ; **−20** au combat à distance tant qu'elle vole.
- `LDB 85 l.160-162` — **Grimpant** : vitesse max sur surfaces verticales/plafonds, Escalade auto-réussie.
- `LDB 85 l.285-286` — **Rapide** : +1 M, +10 Ag.
- `LDB 85 l.65-67` — **Brutal** : −1 M, −10 Ag, +10 F, +10 E.
- `LDB 85 l.157-158` — **Grand** : +10 F, +10 E, −5 Ag.
- `LDB 85 l.78-79` — **Coriace** : +10 E, +10 FM.
- `LDB 85 l.125-126` — **Élite** : +20 CC, CT, FM.
- `LDB 85 l.129-130` — **Endurant** : +Bonus d'Endurance aux Points de Blessure (avant modificateur de Taille).
- `LDB 85 l.310-314` — **Se Cabrer** : Attaque de Piétinement pour une Action de Mouvement si plus grande que la cible.
- `LDB 85 l.110` — **Dressé : Guerre** : +10 CC, ignore Nerveux (bruits forts).
- `LDB 85 l.141-142` — **Fabriqué** : pas d'Int/FM/Soc (Tests auto-réussis), Blessures calculées sur le bonus de **Force** (et non de FM), toutes Attaques Magiques, erre sans contrôle ni Territorial.
- `LDB 85 l.357-370` — **Modificateurs de Taille en Combat** (support de l'Attaque de Piétinement de Se Cabrer) : ×Dégâts par écart de catégories, Atouts Dévastatrice/Percutante, Frappe Mortelle, +10 toucher pour le plus petit, −2 DR/catégorie en défense CC.
- `ZI 02 l.66-70` / `ZI 14 l.1029-1035` — **Fouissement (Indice)** (hors LDB) : creuse *Indice* m en ignorant obstacles/terrain, peut Charger, peut rester enfouie ; ciblage d'une cible enfouie +2 niveaux de Portée (Longue/Extrême impossible).
- `AU1 04 l.17` — exemple d'application de Foulée (basilic Mouvement 6 → 22 m de Course en un Round sans Test d'Athlétisme) ; renvoie au trait LDB 85 p.339.

**Voir aussi** : Taille des créatures et modificateurs de combat · Charge, Course et Désengagement · Bandes de portée (À distance) · Initiative et Avantage · Traits d'attaque de créature (Arme, Morsure, Cornes, Attaque Caudale)

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 85` (l.62-158, l.160-162, l.285-286, l.310-314, l.357-370, l.428-439) → `TraitDef`, `scene`, `a-distance`, `arme`, `planClimb`, `a-sang-froid`, `affame`, `scenario`, `SIZE_LABEL`, `StatblockEditor`, +155 — `src/data/index.ts`, `src/data/maneuvers.json`, `src/data/qualities.json`, `src/data/regles.json`, `src/data/traits.json`, `src/engine/character.ts`, +30 fichiers
- `ZI 2` (l.66-70) → `fouissement`, `rhinox` — `src/data/creatures.json`, `src/data/traits.json`
- `ZI 14` (l.1029-1035) → `fouissement` — `src/data/traits.json`
- sans code : `AU1 4` (l.17)

---

## Taille : catégories et modificateurs de combat

Le **Trait de créature Taille (Divers)** représente toute créature dont la taille s'écarte du standard du jeu — environ la taille humaine, soit la catégorie **Moyenne** (implicite, sans Trait, pour les espèces jouables : nain, elfe, humain). Il existe **sept catégories**, de Minuscule à Monstrueuse. La Taille n'est pas une valeur testée mais une **comparaison d'écart** entre deux combattants : c'est la **différence de catégories** entre l'attaquant et sa cible qui dicte tous les modificateurs ci-dessous.

### Tableau des catégories de Taille

| Taille | Exemples |
|---|---|
| Minuscule | Papillon, souris, pigeon |
| Très petite | Chat, faucon, bébé humain |
| Petite | Rat géant, halfling, enfant humain |
| Moyenne | Nain, elfe, humain |
| Grande | Cheval, ogre, troll |
| Énorme | Griffon, vouivre, manticore |
| Monstrueuse | Dragon, géant, Prince démon |

*— `LDB 85 l.346-355`*

### Utiliser les Tailles — ajustements de profil

Pour **agrandir** une créature d'une catégorie (p. ex. transformer une Araignée Géante en Araignée Gigantesque), **augmentez F et E de +10, et réduisez Ag de −5 par catégorie de Taille supérieure**. Inversez le procédé (−10 F/E, +5 Ag par cran) pour la rendre plus petite. Les Points de Blessure changent eux aussi (voir la table en bas).

### Modificateurs de Taille en combat

**Si la créature est plus GRANDE que son adversaire :**

- **Atouts d'arme conférés** : ses armes gagnent l'Atout **Dévastatrice** si elle est d'**une catégorie de Taille supérieure**, et **Percutante** si elle est plus grande d'**au moins deux catégories** (cumul : à +2 cat. et plus, les deux Atouts s'appliquent).
- **Multiplicateur de Dégâts** : on **multiplie les Dégâts infligés par le nombre de catégories de Taille supérieures** (2 catégories = ×2, 3 catégories = ×3, etc.). *Cette multiplication est calculée **après** l'application des modificateurs* (donc avant l'absorption Endurance + Armure). À +1 catégorie seule, il n'y a pas de multiplication — le gain est l'Atout Dévastatrice.
- **Frappe Mortelle systématique** : **toutes les frappes réussies activent la règle optionnelle Frappe Mortelle (LDB p. 160), même si la cible survit.**

**Si la créature est plus PETITE que son adversaire :**

- Elle gagne un **bonus de +10 pour toucher**.

*— `LDB 85 l.357-367`*

### Défense contre les Grosses Créatures

> « Vous subissez une pénalité de DR -2 pour chaque catégorie de Taille supérieure de votre adversaire, quand vous utilisez la CC pour vous défendre lors d'un Test opposé. » — `LDB 85 l.370-371`

Cette pénalité **ne s'applique qu'à la défense par CC (Parade)**, pas aux autres Compétences. Le livre conseille explicitement **d'esquiver plutôt que de parer** un adversaire bien plus grand (« esquiver un Géant balançant un arbre plutôt que de le parer »). Ainsi, face à un adversaire de **+1 catégorie** la Parade subit −2 DR ; **+2 catégories** → −4 DR ; et ainsi de suite — tandis qu'**Esquive** ne subit aucune pénalité de Taille.

### Force opposée et Taille

Lors des **Tests opposés de Force** (et similaires) :

- si l'une des créatures est supérieure d'**au moins deux Tailles**, elle **gagne automatiquement** ;
- si l'une est supérieure d'**une seule catégorie**, **la plus petite doit obtenir un Critique** sur son jet pour pouvoir s'opposer. Si elle l'obtient, le DR est comparé normalement. **Tout autre résultat** = la plus grande l'emporte.

*— `LDB 85 l.377-378`*

### Mouvement en combat — ignorer le Désengagement

Une **créature plus grande ignore la nécessité de se Désengager** pour quitter un Corps à corps. À la place, elle **dégage les combattants de taille inférieure du chemin** et se déplace où elle veut (elle les repousse).

*— `LDB 85 l.373-374`*

### Peur et Terreur liées à la Taille

Si une créature est considérée comme **agressive**, elle provoque automatiquement, par sa seule Taille :

- la **Peur** chez toute créature plus petite qu'elle (écart ≥ 1 catégorie) ;
- la **Terreur** chez toute créature plus petite d'**au moins deux catégories**.

Le **niveau de Peur ou de Terreur égale la différence de catégories de Taille** (l'Indice = l'écart). Exemple du livre : une créature **Grande** face à un adversaire **Petit** (écart de 2) lui cause **Terreur 2**.

*— `LDB 85 l.382-383`*

### Piétinement (Taille)

Une créature **plus grande que son adversaire** peut effectuer une **Attaque de Piétinement** comme **Action gratuite au prix de 1 Avantage**, lorsqu'elle frappe vers le bas ou un adversaire plus petit. Cette attaque :

- inflige des Dégâts égaux à son **Bonus de Force +0** ;
- utilise la Compétence **Corps à corps (Bagarre)**.

*— `LDB 85 l.386-387`* (ZI nomme ce Trait **Se cabrer** — MÊME condition de Taille et MÊMES Dégâts (BF+0), mais économie d'action DISTINCTE : « Pour une action de Mouvement, la créature peut effectuer une attaque de Piétinement si elle est plus grande que son adversaire. Les Dégâts infligés sont égaux au BF+0. » — `ZI 14 l.1162` ; ZI paie le Piétinement d'une **Action de Mouvement** plutôt que d'1 Avantage, arbitrage tranché en faveur du texte ZI qui NOMME explicitement le Trait `se-cabrer`, `src/state/combatFlow.ts` `applyTrample`/`aiCreatureFreeAttacks`, `src/state/combatSlice.ts` `battleTrample`/`trampleConfirm`)

### Tableau des Blessures par Taille

Les créatures plus grandes encaissent plus de Blessures. (BF = Bonus de Force, BE = Bonus d'Endurance, BFM = Bonus de Force Mentale.)

| Taille | Points de Blessure |
|---|---|
| Minuscule | 1 |
| Très petite | Bonus d'Endurance |
| Petite | (2 × Bonus d'Endurance) + Bonus de Force Mentale |
| Moyenne | Bonus de Force + (2 × Bonus d'Endurance) + Bonus de Force Mentale |
| Grande | (Bonus de Force + (2 × Bonus d'Endurance) + Bonus de Force Mentale) × 2 |
| Énorme | (Bonus de Force + (2 × Bonus d'Endurance) + Bonus de Force Mentale) × 4 |
| Monstrueuse | (Bonus de Force + (2 × Bonus d'Endurance) + Bonus de Force Mentale) × 8 |

*— `LDB 85 l.391-406`* (la table source l.335-352 est désalignée par l'OCR : les valeurs sont reconstituées dans l'ordre des sept catégories.)

### Récapitulatif de l'écart (consolidé tous livres)

| Écart attaquant − cible | Effet sur l'attaquant (plus grand) |
|---|---|
| 0 (même Taille) | aucun modificateur de Taille |
| +1 catégorie | Atout **Dévastatrice** ; **Frappe Mortelle** systématique ; inspire **Peur (Indice 1)** ; cible en Parade subit **−2 DR** ; gagne les Tests opposés de Force **sauf Critique adverse** ; peut ignorer le Désengagement et **Piétiner** (1 Avantage, BF+0) |
| +2 catégories | tout ce qui précède **+ Atout Percutante** ; **Dégâts ×2** ; inspire **Terreur (Indice 2)** ; cible en Parade subit **−4 DR** ; **gagne automatiquement** les Tests opposés de Force |
| +3 catégories | Dévastatrice + Percutante ; **Dégâts ×3** ; **Terreur 3** ; **−6 DR** en Parade ; auto-victoire en Force |

Côté inverse, l'adversaire **plus petit** gagne toujours **+10 pour toucher** la grande créature. *— consolidé de `LDB 85 l.357-387`, `ADE II 02 l.563-589`, `ZI 14 l.1075`.*

**Sources RAW** :
- `LDB 85 l.339-340` — « Utiliser les Tailles » : agrandir = +10 F, +10 E, −5 Ag **par catégorie** de Taille supérieure ; procédé inversé pour rapetisser.
- `LDB 85 l.343-355` — définition du Trait Taille (Divers) ; sept catégories Minuscule → Monstrueuse ; tableau d'exemples.
- `LDB 85 l.357-367` — modificateurs en combat : plus grande (Dévastatrice +1 cat / Percutante +2 cat ; Dégâts × nombre de catégories supérieures, **après** modificateurs ; Frappe Mortelle systématique) ; plus petite (+10 pour toucher).
- `LDB 85 l.369-370` — Défense contre les Grosses Créatures : **−2 DR par catégorie** supérieure de l'adversaire, **CC/Parade uniquement** (pas Esquive).
- `LDB 85 l.373-374` — Mouvement en combat : la créature plus grande **ignore le Désengagement** et repousse les combattants plus petits.
- `LDB 85 l.377-378` — Force opposée : ≥ 2 catégories d'écart → la grande gagne **automatiquement** ; 1 catégorie → la petite doit un **Critique** pour s'opposer (sinon la grande l'emporte).
- `LDB 85 l.382-383` — Peur et Terreur (créature agressive) : Peur si plus grande (écart ≥ 1), Terreur si écart ≥ 2 ; **Indice = différence de catégories**.
- `LDB 85 l.386-387` — Piétinement : Action gratuite à **1 Avantage**, créature plus grande frappant vers le bas, **BF+0 Dégâts**, Compétence **Corps à corps (Bagarre)**.
- `LDB 85 l.391-406` — Blessures par Taille (table) : Minuscule 1 · Très petite BE · Petite 2×BE+BFM · Moyenne BF+2×BE+BFM · Grande ×2 · Énorme ×4 · Monstrueuse ×8.
- `ADE II 02 l.563-589` — application aux **ogres** (Taille Grande) : armes gagnent Dévastatrice vs Moyenne, Percutante + **Dégâts doublés** vs Petite ; défense **−2 DR** (Moyenne) / **−4 DR** (Petite) en Corps à corps (pas Esquive) ; pas de Désengagement vs taille inférieure ; Piétinement 1 Avantage BF+0 ; **+10 pour toucher** un ogre (CC et Projectiles). NB : ADE II nomme « Frappe Mortelle » l'enchaînement de l'ogre dans l'espace d'une cible plus petite (≤ Bonus de CC fois, jamais deux fois la même cible, pas besoin que la première meure) — c'est la même règle optionnelle LDB p. 160 déclenchée par la Taille.
- `ADE II 02 l.584-585` — ogres hostiles : **Peur** chez les créatures Moyennes, **Terreur** chez les Petites.
- `ZI 14 l.1070, l.2998` — tableau de référence rapide du Trait Taille : attaquant ≥ +1 cat. → Dévastatrice + Frappe Mortelle + inspire Peur + gagne les Tests opposés de Force (sauf Critique adverse) ; ≥ +2 cat. → + Percutante, **Dégâts × différence**, Terreur (Indice = différence), victoire automatique en Force ; plus petit → **+10 pour toucher** ; Piétinement (« Se cabrer ») **Action de Mouvement** (pas 1 Avantage — `ZI 14 l.1162`), BF+0 ; Blessures affectées (renvoi p. 342).

> « Vous multipliez les Dégâts infligés par le nombre de catégories de Taille supérieures (ainsi, 2 catégories = x2, 3 catégories = x3, et ainsi de suite) : cette multiplication est calculée après l'application des modificateurs. » — `LDB 85 l.361`

> « Pendant les Tests opposés de Force (et similaires), si l'une des créatures est supérieure d'au moins deux Tailles, elle gagne automatiquement. Si l'une des créatures est d'une Taille supérieure, la plus petite doit obtenir un Critique sur son jet pour pouvoir s'opposer. » — `LDB 85 l.378`

**Voir aussi** : Trait Taille — ajustement de profil et Points de Blessure ; Modificateur d'à-toucher au Tir selon la Taille de la cible ; Atouts d'arme Dévastatrice & Percutante ; règle optionnelle Frappe Mortelle ; Peur & Terreur (psychologie) ; Désengagement ; Tests opposés.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 85` (l.339-340, l.343-355, l.357-387, l.391-406) → `TraitDef`, `doc`, `SIZE_LABEL`, `cannotStopOn`, `markAttacked`, `agressifEnvers`, `structureTaille`, `sizeDamageMultiplier`, `weaponFromTrait`, `sizeGrantedQualities`, +67 — `src/data/index.ts`, `src/data/maneuvers.json`, `src/data/regles.json`, `src/data/schemas/defs/structures.ts`, `src/data/structures.json`, `src/data/traits.json`, +21 fichiers
- `ZI 14` (l.1075, l.1162) → `ethere`, `miracles` — `src/data/traits.json`
- sans code : `ADE II 2` (l.563-589), `ZI 14` (l.1070)

---

## Trait Nuée

Le **Trait de créature Nuée** (LDB 85) modélise un essaim — un grand nombre de créatures identiques (rats, chauves-souris, corbeaux, insectes, squigs miniatures…) agissant comme **une seule entité** sur la grille. Il s'agit d'un trait « package » : il agrège un statbloc unique, réécrit l'application des règles de Taille/Psychologie/Engagement, et ajoute une mécanique d'usure de zone. C'est un trait **sans Indice** (pas de parenthèse) — on l'a ou on ne l'a pas.

Effets, tels que définis verbatim au LDB :

1. **Une seule créature.** « Les nuées sont constituées d'un grand nombre de créatures identiques agissant comme une seule. » On ne gère donc qu'**un seul combattant** sur la carte, avec un seul statbloc, une seule initiative, un seul jet par action.
2. **Ignore la Psychologie.** La nuée ignore toutes les règles de Psychologie (LDB 21, « voir page 190 ») : ni *Peur*, ni *Terreur*, ni *Frénésie* subie, ni *Animosité*, etc.
3. **Ignore TOUTES les règles du Trait de créature Taille.** La phrase est répétée deux fois dans le paragraphe RAW (« toutes les règles du Trait de créature Taille », puis en clôture « La nuée ignore toutes les règles du Trait de créature Taille »). En pratique : pas d'Atout *Dévastatrice*/*Percutante* lié à la différence de Taille, pas de multiplicateur de Dégâts de Taille, pas de pénalité de Parade liée à la Taille de l'attaquant, pas de bonus « +10 au plus petit ». Les modificateurs normaux de Taille (en mêlée comme au tir) ne s'appliquent **ni dans un sens ni dans l'autre** vis-à-vis d'une nuée.
4. **Ignore l'Engagement en se déplaçant.** « celles d'Engagement en utilisant son Mouvement » : la nuée peut se déplacer librement **à travers / hors des** ennemis Engagés, comme si elle ignorait les règles d'Engagement pendant son Mouvement (pas besoin de Désengagement, pas d'attaque gratuite/coup dans le dos subi pour partir).
5. **Frappe Mortelle activée sur toute attaque réussie.** « Si une nuée attaque avec succès un opposant, elle active la règle de Frappe mortelle (même si l'opposant n'est pas tué, voir page 160). » Une simple **touche** (et non un meurtre) ouvre l'enchaînement de Frappe Mortelle : la nuée peut se déplacer sur l'emplacement occupé et attaquer un autre adversaire, un nombre de fois égal à son Bonus de Capacité de Combat (BCC) — c'est le comportement « grande créature » de la règle optionnelle Frappe Mortelle (cf. *Voir aussi*).
6. **Usure de zone : −1 PB en fin de Round.** « Tous les opposants *Engagés* avec une nuée perdent automatiquement 1 Point de Blessure à la fin de chaque Round, car la nuée submerge tout ce qui se trouve à proximité. » Perte **automatique** (pas de jet), une fois par Round, pour chaque opposant Engagé avec la nuée.
7. **×5 Points de Blessure.** « La nuée possède cinq fois plus de Points de Blessure que l'une des créatures types qui la composent. » On prend les PB (B) **d'une** créature-type et on les **multiplie par 5**.
8. **+10 en Capacité de Combat.** La nuée « gagne +10 en Capacité de Combat » par rapport à la créature-type.
9. **+40 au toucher pour TIRER sur la nuée.** « Toutes les tentatives de tirer sur la nuée obtiennent un Bonus de +40 au toucher. » Bonus offensif accordé au **tireur** qui vise la nuée (cible large et grouillante, impossible à manquer). C'est un bonus de **+40** au Test de Capacité de Tir de l'attaquant, indépendant des modificateurs de Taille normaux (qui, eux, sont ignorés contre une nuée).

### Texte RAW — Trait Nuée (LDB 85, chapitre « Traits de créature »)

> **Nuée**
>
> « Les nuées sont constituées d'un grand nombre de créatures identiques agissant comme une seule. Elles ignorent les règles de Psychologie (voir page 190), toutes les règles du Trait de créature Taille, et celles d'Engagement en utilisant son Mouvement. Si une nuée attaque avec succès un opposant, elle active la règle de Frappe mortelle (même si l'opposant n'est pas tué, voir page 160). Tous les opposants *Engagés* avec une nuée perdent automatiquement 1 Point de Blessure à la fin de chaque Round, car la nuée submerge tout ce qui se trouve à proximité. La nuée possède cinq fois plus de Points de Blessure que l'une des créatures types qui la composent et gagne +10 en Capacité de Combat. Toutes les tentatives de tirer sur la nuée obtiennent un Bonus de +40 au toucher. La nuée ignore toutes les règles du Trait de créature Taille. » — `LDB 85 l.253-255`

### Texte RAW — version condensée du tableau de référence des Traits (Zoo Impérial)

Le Zoo Impérial republie la définition dans son tableau récapitulatif des Traits (formulation légèrement resserrée, mécanique identique) :

> **Nuée** — « La Nuée est considérée comme une seule créature et ignore les règles de Psychologie. Elle peut ignorer les règles d'Engagement pendant son Mouvement. Les attaques réussies activent la règle Frappes Mortelles (WFJDR, p. 160). Tous les adversaires Engagés perdent 1 Point de Blessure à la fin de chaque Round. La Nuée possède cinq fois plus de Points de Blessures qu'une créature normale et gagne +10 en Capacité de Combat. Toutes les tentatives de tirer sur la Nuée obtiennent un bonus de +40 au toucher. La Nuée ignore toutes les règles du Trait de créature Taille. » — `ZI 14 l.1147`

### Règle référencée — Frappe Mortelle (la règle activée par toute touche de la nuée)

La Nuée renvoie à la règle optionnelle **Frappe Mortelle** (« page 160 »), qu'elle déclenche sans avoir à tuer :

> « **Option : Frappe Mortelle** — […] Si vous tuez un adversaire au Corps à corps en un seul coup, vous pouvez vous déplacer sur l'emplacement occupé par ce Personnage et attaquer un éventuel autre adversaire. Vous pouvez faire cela un nombre de fois égal à votre Bonus de Capacité de Combat. Certaines créatures (voir **Chapitre 12 : Bestiaire**) sont si grandes qu'elles peuvent activer cette règle sans avoir à tuer d'adversaires. » — `LDB 14 l.5-8`

La nuée fait partie de ces créatures qui activent l'enchaînement **sur une simple touche** (« même si l'opposant n'est pas tué »).

### Règle référencée — catégories de Taille (que la nuée ignore intégralement)

| Taille | Exemples |
|---|---|
| Minuscule | Papillon, souris, pigeon |
| Très petite | Chat, faucon, bébé humain |
| Petite | Rat géant, halfling, enfant humain |
| Moyenne | Nain, elfe, humain |
| Grande | Cheval, ogre, troll |
| Énorme | Griffon, vouivre, manticore |
| Monstrueuse | Dragon, géant, Prince démon |

— `LDB 85 l.346-355`. Une nuée **ignore toutes** ces règles de Taille (en attaque comme en défense, mêlée comme tir).

### Exemple sourcé — Nuée de Squigs des Cavernes des Gobelins de la Nuit (Zoo Impérial)

Le profil ci-dessous porte le Trait **Nuée\*** (l'astérisque sur la créature ET sur deux caractéristiques signale que la valeur intègre **déjà** la transformation Nuée : CC **55\*** = base + 10, B **60\*** = PB d'un squig ×5). Profil reproduit verbatim :

| M | CC | CT | F | E | I | Ag | Dex | Int | FM | Soc | B |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 4 | 55\* | – | 50 | 30 | 10 | 40 | – | 5 | 15 | – | 60\* |

**Traits :** Bestial, Bond, Infecté, Infravision, **Nuée\***
**Traits d'attaque :** Arme (Gueule pleine de crocs) +9

— `ZI 02 l.136-140`

**Sources RAW** :
- `LDB 85 l.252-253` — Définition complète et faisant foi du Trait Nuée : agit comme une seule créature ; ignore Psychologie (p.190), Engagement pendant le Mouvement, et **toutes** les règles de Taille ; toute attaque réussie active **Frappe Mortelle** (même sans tuer, p.160) ; chaque opposant Engagé perd **1 PB en fin de Round** (auto) ; **×5 PB** d'une créature-type ; **+10 CC** ; **+40 au toucher** pour tirer sur la nuée.
- `ZI 14 l.1147` — Reformulation condensée identique en mécanique dans le tableau de référence des Traits du Zoo Impérial (CONSOLIDÉE : confirme chaque clause, « considérée comme une seule créature », +40 au tir, ×5 PB, +10 CC, −1 PB/Round, Frappe Mortelle).
- `ZI 02 l.136-140` — Application concrète : **Nuée de Squigs des Cavernes**, Trait **Nuée\*** ; CC **55\*** (base +10 CC déjà appliqué), B **60\*** (PB d'un squig ×5 déjà appliqué) ; rappelle que les valeurs astérisquées du statbloc incorporent la transformation Nuée.
- `LDB 14 l.6-7` — Règle optionnelle **Frappe Mortelle** activée par la nuée : se déplacer sur l'emplacement de la cible touchée et frapper un autre adversaire, jusqu'à BCC fois ; certaines créatures (dont la nuée) l'activent sans tuer.
- `LDB 85 l.346-355` — Tableau des sept catégories de Taille (Minuscule → Monstrueuse) que la nuée ignore intégralement.

> « Si une nuée attaque avec succès un opposant, elle active la règle de Frappe mortelle (même si l'opposant n'est pas tué, voir page 160). » — `LDB 85 l.253`

> « La nuée possède cinq fois plus de Points de Blessure que l'une des créatures types qui la composent et gagne +10 en Capacité de Combat. Toutes les tentatives de tirer sur la nuée obtiennent un Bonus de +40 au toucher. » — `LDB 85 l.253`

**Voir aussi** : Frappe Mortelle (LDB 14) ; Trait de créature Taille ; Psychologie (Peur/Terreur/Frénésie) ; Engagement & Désengagement ; Trait Endurant (calcul de PB) ; Modificateurs de Taille en combat.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 14` (l.5-8) → `vous-vous-blessez-en-attaquant-perdez-1-blessure-ignore-be-pa`, `arme-abimee-1-degat-vous-agirez-en-dernier-au-prochain-round`, `10-a-votre-action-au-prochain-round`, `vous-trebuchez-vous-perdez-votre-prochain-mouvement`, `vous-lachez-ou-ratez-vous-perdez-votre-prochaine-action`, `vous-vous-tordez-la-cheville-dechirure-musculaire-mineure-compte-comme-blessure-critique`, `vous-touchez-un-allie-au-hasard-ou-vous-meme-sonne`, `incident-de-tir-l-arme-explose-dans-votre-main-degats-au-bras-principal-arme-detruite`, `combat-frappe-mortelle`, `maladresse-tableau-des-oups`, +17 — `src/data/oups.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/engine/combat.ts`, `src/state/combatFlow.ts`, `src/state/combatSlice.ts`, +3 fichiers
- `LDB 85` (l.252-255, l.346-355) → `TraitDef`, `morsure`, `doc`, `SIZE_LABEL`, `cannotStopOn`, `structureTaille`, `sizeDamageMultiplier`, `applySwarmBuild`, `sizeGrantedQualities`, `spawnMutations`, +74 — `src/data/index.ts`, `src/data/maneuvers.json`, `src/data/regles.json`, `src/data/schemas/defs/structures.ts`, `src/data/schemas/defs/traits.ts`, `src/data/traits.json`, +18 fichiers
- `ZI 2` (l.136-140) → `brise-krag`, `gobelin-de-la-nuit`, `experience-unique-du-clan-moulder` — `src/data/creatures.json`
- `ZI 14` (l.1147) → `miracles` — `src/data/traits.json`

---

## AA : système alternatif de Blessures et Critiques

Le supplément *Aux Armes !* propose un **système optionnel de Blessures, de Blessures Critiques et de Mort** qui **remplace intégralement** les règles correspondantes du Livre de base (« il remplace alors les informations données en pages 172-178 de **WFJDR** »). Son but est double : **réduire la complexité** de la gestion des blessures et de la mort, et **ajouter des choix tactiques** sur les Localisations à viser ou à mieux protéger. Si le MJ et les Joueurs adoptent ce système, on n'utilise plus du tout les Critiques du Livre de base — on utilise les quatre tables ci-dessous et les déclencheurs décrits ici.

### Blessures (perte ordinaire)
On perd des Blessures en subissant des Dégâts : **1 point de Dégâts = 1 Blessure perdue**. Le Bonus d'Endurance et les Points d'Armure réduisent les Dégâts subis avant de retrancher des Blessures. Exemple du livre : touché au bras pour 10 Dégâts, avec un Bonus d'Endurance de 3 et 1 Point d'Armure de cuir au bras → 10 − 3 − 1 = **6 Blessures perdues**.

### Deux déclencheurs de Blessure Critique
Il existe **deux** manières de générer une Blessure Critique :

1. **Double sur le jet d'attaque (sans avoir mis l'adversaire à 0).** Si pendant une attaque le Personnage **obtient un double** sur son Test de Corps à Corps ou de Projectiles (ou sur son Test de Capacité de Combat / Capacité de Tir s'il n'utilise pas la Compétence) **et réussit** ce Test, il inflige une Blessure Critique **même s'il reste des Blessures à l'adversaire**.
   - **On n'inverse PAS** le jet d'attaque pour la Localisation (contrairement à un coup normal). À la place : **on relance 1d100** pour la Localisation, **puis encore 1d100** que l'on reporte à la ligne correspondante de la table des Blessures Critiques de cette Localisation.

2. **Mise à zéro des Blessures (ou cible déjà à 0).** Si, après résolution de l'attaque, l'adversaire **est tombé à 0 Blessure**, il subit **automatiquement** une Blessure Critique. Pour la ligne de table, on lance **1d100 et on ajoute +10 par Blessure infligée au-delà de celles nécessaires pour atteindre 0** (ou, si la cible était déjà à 0, **+10 par Blessure infligée**).

### Perte de Blessures supplémentaires due au Critique
La **colonne « Blessures »** des tables donne le nombre de Blessures supplémentaires perdues à cause du Coup Critique. Ces Blessures se déterminent **après** tous les autres effets (Dégâts normaux + Critique). Règle de non-cascade : **les Blessures infligées par la table ne déclenchent jamais de nouveau jet de Critique** — une cible qui retombe à 0 (ou en dessous) à cause d'elles ne subit pas de conséquence supplémentaire. Autrement dit, **chaque coup ne peut infliger qu'une seule Blessure Critique**.

### Retenir ses Coups
Les règles supposent qu'on veut infliger toutes les Critiques possibles. Pour **maîtriser sans tuer**, on déclare **avant le jet pour toucher** que l'on **Retient ses coups** (plat de la lame / technique non létale) :
- On inflige **tout de même des Blessures**, mais **on n'inflige de Critique que si l'adversaire tombe à 0 Blessure** (le déclencheur « double » est neutralisé).
- **Impossible** de Retenir ses coups avec **une arme infligeant l'État _En flammes_, avec des projectiles, ou avec des sorts**.
- En Retenant ses coups, on **perd les Atouts d'arme suivants** : _Empaleuse_, _Percutante_, _Perforante_ et _Taille_.

### Option : Mort Subite
Pour éviter de noter en détail les traumatismes de tous les figurants, le MJ peut décider qu'**une cible qui atteint 0 Blessure est simplement déclarée morte ou inconsciente**. Utile pour les **PNJ très secondaires** (brigands, cultistes de bas étage) — **ne doit pas** servir à décider du sort des **Personnages Joueurs** ni des **PNJ possédant le Talent Chanceux**.

### La Mort (par accumulation de Critiques)
La mort vient soit **directement** d'une Critique (ligne « Mort » d'une table), soit de l'**accumulation de traumatismes** :
- Si un Personnage a l'État **_Inconscient_ ET est à 0 Blessure**, on compte **le nombre total de Blessures Critiques** subies (= le nombre de résultats obtenus dans les tables). **Si ce total dépasse son Bonus d'Endurance**, il **succombe et meurt à la fin du Round**, sauf s'il est **soigné d'une ou plusieurs Blessures Critiques** d'ici là.
- De plus, tout ennemi doté d'une **arme appropriée** peut **achever** un Personnage **_Inconscient_** en y dépensant **une Action**.

### Blessures Triviales (« T »)
Certaines lignes ont une valeur de Blessures notée **« T »** (Triviale). Elles sont invalidantes mais pas mortelles : **elles n'infligent aucune Blessure supplémentaire** et **ne comptent pas** dans le nombre de Critiques nécessaires pour tuer un Personnage.

### État _Hémorragique_ — mises à jour propres au système alternatif
Le système redéfinit l'État _Hémorragique_ :
- Perdez **1 Blessure à la fin de chaque Round, en ignorant tous les modificateurs**.
- **Pénalité de −10** aux Tests pour résister à une **Blessure purulente, Infection mineure ou Infection du sang**.
- À **0 Blessure**, vous ne perdez plus de Blessures supplémentaires, **mais** à la fin de chaque Tour vous devez réussir un Test de **Résistance Intermédiaire (+0)** sous peine de subir immédiatement l'État _Inconscient_.
- **_Inconscient_ + _Hémorragique_** : à la fin du Round, **10 % de chance de mourir par État _Hémorragique_ possédé** (3 _Hémorragique_ → mort sur 1-30). En évitant la mort **sur un double**, les blessures coagulent et on **perd 1 État _Hémorragique_**. On ne peut **pas reprendre ses esprits** tant que tous les _Hémorragique_ ne sont pas retirés.
- **Retrait** : Test de **Guérison Accessible (+20)** réussi (chaque DR retire 1 _Hémorragique_ de plus), ou tout Sort/Prière soignant des PB (1 État retiré par PB soigné). **Une fois tous les _Hémorragique_ retirés, on gagne un État _Exténué_** (et voir les règles de bandages, p. 308).

---

### Table des Blessures Critiques à la Tête

| Résultat | Description | Blessures | Effets supplémentaires |
|---|---|---|---|
| 01-03 | Blessure spectaculaire | T | Une entaille sur la joue. Vous recevez 1 État _Hémorragique_. Une fois la blessure guérie, la cicatrice fournit un bonus de +1 DR sur les Tests sociaux appropriés. Vous ne pouvez gagner ce bénéfice qu'une seule fois. |
| 04-06 | Coup percutant | 1 | Le coup vous fait voir trente-six chandelles. Vous recevez 1 État _Sonné_. |
| 07-09 | Coup à l'œil | 1 | Le coup vous érafle l'orbite de l'œil. Gagnez 1 État _Aveuglé_. |
| 10-15 | Frappe à l'oreille | 1 | Votre oreille siffle. Vous recevez 1 État _Assourdi_. |
| 16-20 | Coupure mineure | 1 | Le coup vous ouvre la joue. Vous recevez 1 État _Hémorragique_. |
| 21-25 | Œil au beurre noir | 2 | Un coup s'abat sur votre œil. Vous recevez 2 États _Aveuglé_. |
| 26-30 | Oreille tranchée | 2 | Un coup vous entaille l'oreille. Vous recevez 2 États _Assourdi_ et 1 État _Hémorragique_. |
| 31-35 | En plein front | 2 | Un coup percutant vous atteint en plein front. Gagnez 2 États _Hémorragique_ qui ne peuvent pas être retirés tant que tous les États _Hémorragique_ n'ont pas été éliminés, et 1 État _Aveuglé_. |
| 36-40 | Mâchoire fracturée | 2 | Le coup vous brise la mâchoire. Vous recevez 2 États _Sonné_ et vous subissez le Traumatisme _Fracture (Mineure)_. |
| 41-45 | Blessure majeure à l'œil | 3 | Un coup touche votre orbite. Vous recevez 1 État _Hémorragique_. Vous recevez également 1 État _Aveuglé_ qui ne pourra être soigné que lorsque vous recevrez de l'Aide Médicale. |
| 46-50 | Blessure majeure à l'oreille | 3 | Le coup endommage votre oreille. Vous subissez une pénalité permanente de −20 à tout Test ayant un rapport avec l'audition. Si vous subissez de nouveau ce résultat, vous perdez totalement l'audition. |
| 51-55 | Nez cassé | 3 | Un coup très violent sur le nez. Vous recevez 2 États _Hémorragique_ et vous devez réussir un Test de _Résistance Intermédiaire (+0)_ sous peine de recevoir aussi 1 État _Sonné_. |
| 56-60 | Mâchoire brisée | 3 | Le coup vous brise la mâchoire. Vous recevez 3 États _Sonné_. Vous devez faire un Test de _Résistance Intermédiaire (+0)_ ou subir un État _Inconscient_. Vous subissez le Traumatisme _Fracture (Majeure)_. |
| 61-65 | Oreille mutilée | 4 | Un coup vous déchire l'oreille. Vous recevez 3 États _Assourdi_ et 2 États _Hémorragique_. Vous perdez votre oreille – _Amputation (Accessible)_. |
| 66-75 | Bouche explosée | 4 | Le coup vous déchausse plusieurs dents. Vous recevez 2 États _Hémorragique_. Vous perdez 1d10 dents – _Amputation (Facile)_. |
| 76-80 | Commotion cérébrale | 4 | Un coup très puissant résonne contre votre crâne. Vous recevez 1 État _Assourdi_, 2 États _Hémorragique_ et 1d10 États _Sonné_. Vous recevez également 1 État _Exténué_ qui dure 1d10 jours. |
| 81-85 | Œil crevé | 5 | Un coup porté à votre œil le crève. Vous recevez 3 États _Aveuglé_, 2 États _Hémorragique_ et 1 État _Sonné_. Vous perdez votre œil – _Amputation (Complexe)_. |
| 86-94 | Coup défigurant | 5 | Le coup détruit votre œil et votre nez. Vous recevez 3 États _Hémorragique_, 3 États _Aveuglé_ et 2 États _Sonné_. Vous perdez votre œil et votre nez – _Amputation (Difficile)_. |
| 95-99 | Mâchoire mutilée | 5 | Le coup vous fracasse totalement la mâchoire : il vous détruit la langue et fait voler vos dents. Vous recevez 4 États _Hémorragique_ et 3 États _Sonné_. Vous subissez le Traumatisme _Fracture (Majeure)_ et vous perdez votre langue et 1d10 dents – _Amputation (Difficile)_. |
| 00 ou plus | Crâne fracassé | Mort | Votre tête est écrasée et vous vous écroulez, mort sur le coup. |

*— `AA 07 l.82-104`*

### Table des Blessures Critiques au Bras

| Résultat | Description | Blessures | Effets supplémentaires |
|---|---|---|---|
| 01-10 | Choc au poignet | T | Vous lâchez ce que vous teniez dans cette main. |
| 11-20 | Choc au bras | T | Vous lâchez ce que vous teniez dans cette main et cette dernière devient inutilisable pour 1d10 − (Bonus d'Endurance) Rounds (minimum de 1). Pendant ce temps, considérez votre main comme perdue (voir _Amputation_ en page 180 de _WFJDR_). |
| 21-25 | Coupure mineure | 1 | Vous prenez une coupure sur le haut du bras. Vous recevez 1 État _Hémorragique_. |
| 26-40 | Torsion | 1 | Vous subissez le Traumatisme _Déchirure musculaire (Mineure)_. |
| 41-45 | Déchirure musculaire | 1 | Le coup écrase votre avant-bras. Gagnez 1 État _Hémorragique_ et un Traumatisme _Déchirure musculaire (Mineure)_. |
| 46-50 | Main ensanglantée | 1 | Recevez 1 État _Hémorragique_. Tant que vous êtes sous l'effet de cet État, effectuez un Test de _Dextérité Accessible (+20)_ avant d'effectuer une Action impliquant quelque chose de tenu dans cette main ; sur un Échec, l'objet vous glisse de la main. |
| 51-55 | Clef de bras | 2 | Vous lâchez ce que vous teniez dans cette main. Le bras est inutilisable pendant 1d10 Rounds (voir _Amputation_ en page 180 de _WFJDR_). |
| 56-60 | Blessure béante | 2 | Vous recevez 2 États _Hémorragique_. Jusqu'à ce que vous soyez soigné par _Chirurgie_ afin de recoudre la blessure, toute Blessure que vous subissez à votre bras blessé vous inflige un État _Hémorragique_ supplémentaire. |
| 61-75 | Cassure nette | 2 | Vous lâchez ce que vous teniez dans cette main et vous subissez un Traumatisme _Fracture (Mineure)_. Vous devez réussir un Test de _Résistance Complexe (−10)_ sous peine de recevoir 1 État _Sonné_. |
| 76-80 | Ligament rompu | 2 | Vous lâchez ce que vous teniez dans cette main et vous subissez un Traumatisme _Déchirure musculaire (Majeure)_. |
| 81-85 | Coupure profonde | 3 | Gagnez 2 États _Hémorragique_. Gagnez 1 État _Sonné_ et subissez un Traumatisme _Déchirure musculaire (Mineure)_. Vous devez réussir un Test de _Résistance Difficile (−20)_ sous peine de subir l'État _Inconscient_. |
| 86-90 | Coude fracassé | 3 | Vous lâchez ce que vous teniez dans cette main et vous subissez un Traumatisme _Fracture (Majeure)_. |
| 91-95 | Artère endommagée | 3 | Vous subissez 4 États _Hémorragique_. |
| 96-109 | Épaule luxée | 4 | Le bras est considéré comme perdu (voir _Amputation_ en page 180 de _WFJDR_). Vous subissez 1 État _Sonné_ jusqu'à ce que vous receviez de l'Aide Médicale. Après ce traitement initial, il faut obtenir 6 DR sur un Test étendu de _Guérison Accessible (+20)_ pour que vous récupériez l'usage de ce bras, après quoi les Tests effectués avec ce bras subissent une pénalité de −10 pendant 1d10 jours. |
| 110-115 | Doigt sectionné | 4 | Vous perdez un doigt – _Amputation (Accessible)_. Vous subissez 1 État _Hémorragique_. |
| 116-120 | Main ouverte | 4 | Votre main s'ouvre. Perdez 1 doigt – _Amputation (Complexe)_. Gagnez 2 États _Hémorragique_ et 1 État _Sonné_. Pour chaque Round au cours duquel vous ne recevez pas d'Aide Médicale, vous perdez un autre doigt. Si vous perdez tous vos doigts, vous perdez votre main – _Amputation (Complexe)_. |
| 121-125 | Biceps déchiqueté | 5 | Le coup sépare le biceps de l'os. Vous lâchez ce que vous teniez dans cette main et vous subissez un Traumatisme _Déchirure musculaire (Majeure)_, 2 États _Hémorragique_ et 1 État _Sonné_. |
| 126-130 | Main mutilée | 5 | Vous perdez votre main – _Amputation (Difficile)_. Vous recevez 2 États _Hémorragique_ et vous devez réussir un Test de _Résistance Difficile (−20)_ sous peine de subir 1 État _Sonné_ et 1 État _À Terre_. |
| 131-135 | Tendons coupés | 5 | Le coup rend votre bras inutilisable de manière permanente – _Amputation (Très Difficile)_. Vous recevez 3 États _Hémorragique_ et 1 État _Sonné_. Vous devez réussir un Test de _Résistance Difficile (−20)_ sous peine de subir l'État _Inconscient_. |
| 136 ou plus | Démembrement brutal | Mort | Votre bras est tranché et vous mourez presque instantanément à cause du choc et de la perte de sang. |

*— `AA 07 l.105-131`*

### Table des Blessures Critiques au Torse

| Résultat | Description | Blessures | Effets supplémentaires |
|---|---|---|---|
| 01-10 | Souffle coupé | T | Vous recevez 1 État _Sonné_. Vous devez réussir un Test de _Résistance Accessible (+20)_ sous peine de subir l'État _À Terre_. Votre Mouvement est réduit de moitié pendant 1d10 Rounds le temps de reprendre votre souffle. |
| 11-20 | Rien qu'une égratignure ! | 1 | Vous subissez 1 État _Hémorragique_. |
| 21-25 | Coup au ventre | 1 | Vous recevez 1 État _Sonné_ et vous devez réussir un Test de _Résistance Facile (+40)_ sous peine de vomir et de subir l'État _À Terre_. |
| 26-30 | Coup bas | 1 | Vous devez réussir un Test de _Résistance Difficile (−20)_ sous peine de subir 3 États _Sonné_. |
| 31-35 | Torsion du dos | 1 | Vous subissez un Traumatisme _Déchirure musculaire (Mineure)_. |
| 36-40 | Bleus aux côtes | 2 | Vous subissez une pénalité de −10 sur tous vos Tests basés sur l'Agilité pendant 1d10 jours. |
| 41-45 | Clavicule tordue | 2 | Choisissez au hasard l'un de vos deux bras. Vous lâchez ce que vous teniez dans cette main et le bras est inutilisable pendant 1d10 Rounds (voir _Amputation_ en page 180 de _WFJDR_). |
| 46-50 | Chairs déchirées | 2 | Vous recevez 2 États _Hémorragique_. |
| 51-55 | Côtes fracturées | 2 | Le coup fracture une ou plusieurs côtes. Vous recevez 1 État _Sonné_ et vous subissez un Traumatisme _Fracture (Mineure)_. |
| 56-60 | Blessure béante | 3 | Vous recevez 3 États _Hémorragique_. Jusqu'à ce que vous soyez soigné par _Chirurgie_, toute Blessure que vous perdez au torse vous inflige un État _Hémorragique_ supplémentaire car la plaie se rouvre. |
| 61-65 | Entaille douloureuse | 3 | Vous recevez 2 États _Hémorragique_ et 1 État _Sonné_. Vous devez réussir un Test de _Résistance Difficile (−20)_ sous peine de subir l'État _Inconscient_ car vous perdez connaissance à cause de la douleur. Et si vous n'obtenez pas au moins 4 DR, vous hurlez de douleur. |
| 66-70 | Dégâts artériels | 3 | Vous recevez 4 États _Hémorragique_. Jusqu'à ce que vous soyez soigné par _Chirurgie_, chaque nouvelle Blessure à cette Localisation vous fait subir 2 États _Hémorragique_ supplémentaires. |
| 71-75 | Dos froissé | 3 | Une douleur irradiante vous assaille alors que vous faites usage de vos muscles. Subissez un Traumatisme _Déchirure musculaire (Majeure)_. |
| 76-80 | Hanche fracturée | 4 | Vous recevez 1 État _Sonné_. Vous devez réussir un Test de _Résistance Intermédiaire (+0)_ sous peine de subir également l'État _À Terre_. Vous subissez le Traumatisme _Fracture (Mineure)_. |
| 81-85 | Blessure majeure au torse | 4 | Vous recevez une blessure importante au torse qui arrache la peau de ses muscles et de ses tendons. Recevez 4 États _Hémorragique_. Tant que vous n'êtes pas soigné par _Chirurgie_ afin de recoudre la blessure, toute nouvelle Blessure que vous recevrez à cette Localisation vous fera gagner 2 États _Hémorragique_ supplémentaires à cause de la réouverture de la blessure. |
| 86-90 | Blessure au ventre | 4 | Vous contractez une Blessure Purulente (voir _Maladies et Infections_ en page 186 de _WFJDR_) et gagnez 2 États _Hémorragique_. |
| 91-95 | Cage thoracique perforée | 5 | Gagnez 1 État _Sonné_ qui ne peut être retiré que par Aide Médicale, et subissez un Traumatisme _Fracture (Majeure)_. |
| 96-110 | Clavicule cassée | 5 | Gagnez 1 État _Inconscient_ jusqu'à ce que vous soyez soigné par Aide Médicale et subissez un Traumatisme _Fracture (Majeure)_. |
| 111-115 | Hémorragie interne | 5 | Gagnez 1 État _Hémorragique_ qui ne peut être retiré que par _Chirurgie_. Vous contractez une Infection du sang (voir _Maladies et Infections_ en page 186 de _WFJDR_). |
| 116 ou plus | Éventré | Mort | Vous êtes littéralement coupé en deux. Les deux parties de votre corps atterrissent de façon parfaitement aléatoire au sol, et tout Personnage situé à moins de 2 mètres est recouvert de sang. |

*— `AA 07 l.132-159`*

### Table des Blessures Critiques à la Jambe

| Résultat | Description | Blessures | Effets supplémentaires |
|---|---|---|---|
| 01-10 | Orteil contusionné | T | Vous devez réussir un Test de _Résistance Accessible (+20)_ sous peine de subir une pénalité de −10 sur tous vos Tests d'Agilité jusqu'à la fin du prochain Round. |
| 11-20 | Perte d'équilibre | T | Vous devez réussir un Test d'_Athlétisme Intermédiaire (+0)_ sous peine de subir l'État _À Terre_. |
| 21-25 | Cheville tordue | 1 | Vous subissez une pénalité de −10 sur tous vos Tests d'Agilité pendant 1d10 Rounds. |
| 26-40 | Coupure mineure | 1 | Vous recevez 1 État _Hémorragique_. |
| 41-45 | Coup à la cuisse | 1 | Un coup violent sur le haut de la cuisse. Vous recevez 1 État _Hémorragique_ et vous devez réussir un Test de _Résistance Accessible (+20)_ sous peine de subir l'État _À Terre_. |
| 46-50 | Cheville foulée | 1 | Vous subissez un Traumatisme _Déchirure musculaire (Mineure)_. |
| 51-55 | Genou tordu | 2 | Votre genou pivote un peu trop. Vous subissez une pénalité de −20 sur tous vos Tests d'Agilité pendant 1d10 Rounds. |
| 56-60 | Coupure à l'orteil | 2 | Vous recevez 1 État _Hémorragique_. Une fois la rencontre terminée, effectuez un Test de _Résistance Intermédiaire (+0)_. Sur un Échec, vous perdez un orteil – _Amputation (Accessible)_. |
| 61-65 | Mauvaise coupure | 2 | Vous recevez 2 États _Hémorragique_. Vous devez réussir un Test de _Résistance Intermédiaire (+0)_ sous peine de subir l'État _À Terre_. |
| 66-70 | Genou méchamment tordu | 2 | Vous subissez un Traumatisme _Déchirure musculaire (Majeure)_. |
| 71-75 | Jambe charcutée | 3 | Vous recevez 1 État _À Terre_ et 2 États _Hémorragique_ et vous subissez un Traumatisme _Fracture (Mineure)_. |
| 76-80 | Cuisse lacérée | 3 | Vous recevez 3 États _Hémorragique_. Tant que vous n'aurez pas été soigné par Chirurgie afin de refermer la plaie, chaque fois que vous subirez des Blessures à cette Jambe, gagnez 1 État _Hémorragique_ supplémentaire. |
| 81-85 | Tendon rompu | 3 | Gagnez les États _À Terre_ et _Sonné_. Vous devez réussir un Test de _Résistance Difficile (−20)_ sous peine de subir 1 État _Inconscient_. Votre jambe devient inutilisable (voir _Amputation_ en page 180 de _WFJDR_). Vous subissez un Traumatisme _Déchirure musculaire (Majeure)_. |
| 86-90 | Tibia fêlé | 4 | Vous recevez 1 État _Sonné_ et 1 État _À Terre_. De plus, vous subissez un Traumatisme _Déchirure musculaire (Majeure)_ et un Traumatisme _Fracture (Mineure)_. |
| 91-95 | Genou cassé | 4 | Vous subissez 1 État _Hémorragique_, 1 État _À Terre_ et 1 État _Sonné_, et un Traumatisme _Fracture (Majeure)_. |
| 96-105 | Genou démis | 4 | Vous subissez 1 État _À Terre_. Vous devez réussir un Test de _Résistance Difficile (−20)_ sous peine de subir 1 État _Sonné_, qui n'est retiré qu'une fois que vous avez reçu de l'Aide Médicale. Après cette Aide Médicale, il faut obtenir 6 DR sur un Test étendu de _Guérison Accessible (+20)_ pour que vous récupériez l'usage de cette jambe, après quoi votre Mouvement est réduit de moitié et les Tests effectués avec cette jambe subissent une pénalité de −10 pendant 1d10 jours. |
| 106-115 | Pied écrasé | 4 | Effectuez un Test de _Résistance Accessible (+20)_ ; sur un Échec, vous gagnez l'État _À Terre_ et perdez un orteil, plus un orteil par DR en dessous de 0 – _Amputation (Accessible)_. Gagnez 2 États _Hémorragique_. Si vous n'êtes pas soigné par _Chirurgie_ au cours des 1d10 jours suivants, vous perdez votre pied. |
| 116-120 | Pied sectionné | 5 | Votre pied est sectionné – _Amputation (Difficile)_. Vous gagnez les États suivants : 3 États _Hémorragique_, 2 États _Sonné_ et 1 État _À Terre_. |
| 121-125 | Tendon coupé | 5 | Votre jambe cède sous le poids de votre corps. Vous gagnez 2 États _Hémorragique_, 2 États _Sonné_ et 1 État _À Terre_ et vous perdez l'usage de votre jambe – _Amputation (Très Difficile)_. |
| 126 ou plus | Bassin fracassé | Mort | Le coup fracasse votre bassin, coupant une jambe. Vous mourez instantanément à cause du choc traumatique. |

*— `AA 07 l.160-185`*

---

**Sources RAW** :
- `AA 06 l.554-558` — Présentation du sous-système : approche optionnelle qui **remplace WFJDR p.172-178** ; objectifs (réduire la complexité, ajouter des choix tactiques de Localisation/armure).
- `AA 07 l.4-10` — Mises à jour de l'État _Hémorragique_ propres au système alternatif (−1 PB/Round modificateurs ignorés ; −10 résistance infections ; Test Résistance Intermédiaire à 0 PB → _Inconscient_ ; 10 %/État si _Inconscient_, coagulation sur double ; retrait Guérison +20 / Sort-Prière ; gain _Exténué_ après retrait — voir `l.2476`).
- `AA 07 l.17-21` — Blessures ordinaires : 1 Dégât = 1 Blessure ; BE + PA réduisent les Dégâts (exemple 10 − 3 − 1 = 6).
- `AA 07 l.23-25` — Les **deux** déclencheurs de Critique (double au jet, ou cible mise/déjà à 0).
- `AA 07 l.28-32` — Déclencheur **double sur le jet d'attaque** (double + réussite = Critique même si PB restent) ; **on n'inverse pas** le jet : relancer 1d100 (Localisation) puis 1d100 (ligne de table).
- `AA 07 l.35-36` — Déclencheur **mise à zéro** : Critique automatique ; **+10 par Blessure** au-delà du seuil de 0 (ou +10/Blessure si déjà à 0).
- `AA 07 l.39-42` — Colonne « Blessures » des tables ; Blessures supplémentaires calculées en dernier ; **pas de second jet** déclenché — un coup = une seule Critique.
- `AA 07 l.48-57` — Exemples joués (Ibrit / Hugo) illustrant +10/PB, le second jet de table non-cascadant, et le calcul +80 (8 Blessures à un adversaire déjà à 0).
- `AA 07 l.58-61` — **Retenir ses Coups** : déclaration avant le jet ; Critique seulement si chute à 0 ; **interdit** avec _En flammes_/projectiles/sorts ; perte des Atouts _Empaleuse, Percutante, Perforante, Taille_.
- `AA 07 l.64-67` — Option **Mort Subite** (alternative AA) : à 0 PB, le MJ déclare mort/inconscient ; PNJ secondaires uniquement, **jamais** PJ ni PNJ Chanceux.
- `AA 07 l.69-75` — **Mort par accumulation** : _Inconscient_ + 0 PB → si le nombre de Critiques subies **dépasse le BE**, mort en fin de Round sauf soin d'une Critique ; achèvement d'un _Inconscient_ pour 1 Action.
- `AA 07 l.78-79` — **Blessures Triviales** (« T ») : invalidantes mais pas mortelles ; 0 Blessure supplémentaire ; non comptées pour la mort.
- `AA 07 l.82-104` — **Table Critiques à la Tête** (verbatim, 01-03 … 00 ou plus).
- `AA 07 l.105-131` — **Table Critiques au Bras** (verbatim, 01-10 … 136 ou plus).
- `AA 07 l.132-159` — **Table Critiques au Torse** (verbatim, 01-10 … 116 ou plus).
- `AA 07 l.160-185` — **Table Critiques à la Jambe** (verbatim, 01-10 … 126 ou plus).
- `ADE II 04 l.147` — Interaction avec un objet magique : la **Massue Brise-Tibias** ajoute **+20 au lancer sur la Table des Critiques** pour une Blessure Critique infligée aux jambes (« Sinon, la massue fonctionne comme une Arme simple normale »).

> « Si le MJ et les Joueurs préfèrent utiliser ce système, il remplace alors les informations données en pages 172-178 de **WFJDR**. » — `AA 06 l.556`

> « N'inversez pas votre jet d'attaque pour connaître la Localisation de votre coup comme vous le feriez pour un coup normal. Au lieu de cela, lancez de nouveau 1d100 pour savoir où votre coup touche. Puis lancez encore 1d100 et reportez-vous à la ligne concernée dans le tableau des Blessures Critiques pour cette Localisation. » — `AA 07 l.32`

> « En d'autres termes, chaque coup ne peut infliger qu'une seule Blessure Critique. » — `AA 07 l.42`

**Voir aussi** : Critiques & Traumatisme (système du Livre de base, LDB 18) ; Mort & Inconscience (LDB 17/18) ; État _Hémorragique_ et États ; Localisations & coups inversés (LDB 13) ; Amputation et Aide Médicale / Chirurgie ; Atouts & Défauts d'arme (_Empaleuse / Percutante / Perforante / Taille_, LDB 62) ; ADE II — objets magiques (Massue Brise-Tibias).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `AA 6` (l.554-558) → `combat-aa-bleed`, `combat-aa-blessures`, `commander-la-legion`, `terrifier-l-ennemi`, `en-bon-ordre`, `connais-ton-ennemi`, `en-terrain-dangereux`, `frappe-rapide`, `devotion-de-la-vierge-guerriere`, `prouesses-martiales`, +1 — `src/data/combat-stakes.json`, `src/data/reglesOptionnelles.json`, `src/data/spells.json`
- `AA 7` (l.4-10, l.17-21, l.23-25, l.28-32, l.35-36, l.39-42, l.48-57, l.58-61, l.64-67, l.69-75, l.78-79, l.82-104, l.105-131, l.132-159, l.160-185) → `StructureCritEntry`, `CritEntry`, `critEscalationSchema`, `healDifficulty`, `pendantRounds`, `CritEscalation`, `amputationSchema`, `attackHandGate`, `useAttackJetProps`, `retenir-ses-coups`, +117 — `src/data/combat-stakes.json`, `src/data/criticals.json`, `src/data/criticals.ts`, `src/data/index.ts`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, +21 fichiers
- sans code : `ADE II 4` (l.147)

---

## AA : État Hémorragique et nouveaux Atouts/Défauts

*Aux Armes* (supplément combat) introduit des **Options d'arme** : un système d'**Atouts Optionnels** (une arme propose plusieurs Atouts mutuellement exclusifs), cinq nouveaux Atouts/Défauts d'arme (*Déséquilibrée*, *Déstabilisante*, *Taillade (XA)*, *Tir de zone (Indice)*), une refonte de l'Atout *Protectrice*, ainsi qu'une **mise à jour de l'État _Hémorragique_** rattachée à l'« approche alternative des Blessures » du supplément. Tout ce qui suit est verbatim/consolidé depuis *Aux Armes* (AA), chapitre « Options d'arme » et « Une Approche Alternative des Blessures ».

---

### État Hémorragique (mis à jour)

Le supplément redéfinit l'État *Hémorragique* dans le cadre de son système alternatif de Blessures (qui, s'il est adopté, remplace les pages 172-178 du Livre de Base) :

- **Saignement périodique** : vous perdez **1 Blessure à la fin de chaque Round**, en **ignorant tous les modificateurs** (Bonus d'Endurance et Points d'Armure ne s'appliquent pas).
- **Malus aux infections** : pénalité de **−10** à tout Test pour résister à une **Blessure purulente**, une **Infection mineure** ou une **Infection du sang**.
- **Plancher à 0 Blessure** : si vous atteignez 0 Blessure, vous **ne perdez plus de Points de Blessure supplémentaires** (le saignement ne descend pas en négatif).
- **Risque d'inconscience** : à la fin de chaque **Tour**, vous devez réussir un **Test de Résistance Intermédiaire (+0)** sous peine de subir immédiatement l'État *Inconscient*.
- **Risque de mort (Inconscient + Hémorragique)** : si vous êtes à la fois *Inconscient* et *Hémorragique*, à la fin du Round vous avez **10 % de chance de mourir par État _Hémorragique_ possédé**. Exemple verbatim : 3 États *Hémorragique* → mort sur un résultat de **1 à 30** (au d100). Si vous évitez la mort en faisant un **double** sur ce jet, vos blessures coagulent et vous **perdez 1 État _Hémorragique_**. Vous ne pouvez pas reprendre vos esprits tant que **tous** les États *Hémorragique* ne sont pas retirés.
- **Réveil et épuisement** : « **Une fois tous les États _Hémorragique_ retirés, gagnez un État _Exténué_.** »
- **Retrait de l'État** : un **Test de Guérison Accessible (+20)** réussi retire 1 État *Hémorragique*, **+1 par DR**. Tout Sort ou Prière qui guérit des Points de Blessure retire **1 État par Point de Blessure guéri**. (Voir aussi les règles sur les bandages.)

> « Vous saignez abondamment. Perdez 1 Blessure à la fin de chaque Round, en ignorant tous les modificateurs. De plus, vous subissez une pénalité de –10 lorsqu'il s'agit de faire un Test pour résister à une Blessure purulente, Infection mineure ou Infection du sang. » — `AA 07 l.5`

---

### Atouts Optionnels — règle de choix

Certaines armes ont un effet très différent selon la face employée (ex. un **marteau de guerre** : face contondante → *Assommante*, face pointue → *Perforante*). Ces deux Atouts **ne peuvent pas être employés simultanément**. Convention de notation : les Atouts qui s'appliquent **systématiquement** sont indiqués en premier, puis viennent les **Atouts optionnels** entre lesquels le Personnage doit choisir.

- Les Atouts du marteau de guerre sont donc : *Déséquilibrée* (toujours active) **+** au choix *Assommante* **ou** *Perforante*.
- **Le choix doit être effectué AVANT tout jet pour déterminer le Succès de l'attaque.**
- Si le Joueur ne choisit pas, l'attaque applique **le premier des Atouts optionnels** listés (*Assommante* pour le marteau de guerre).

---

### Atout Déséquilibrée (Défaut)

Le poids de l'arme est concentré dans sa tête, ce qui la rend inefficace pour parer.

- **Quand cette arme est utilisée pour s'opposer à une attaque, elle subit une pénalité de −1 DR sur cette attaque** (Test opposé de défense).

> « Quand cette arme est utilisée pour s'opposer à une attaque, elle subit une pénalité de -1 DR sur cette attaque. » — `AA 08 l.81`

---

### Atout Déstabilisante

Arme conçue pour s'accrocher à la jambe de l'adversaire ou le faire tomber.

- **Déclencheur** : après avoir **touché** votre opposant.
- **Coût** : dépenser **2 Avantages**, puis effectuer un **Test opposé de Force/Athlétisme**.
- **Si vous l'emportez** : l'adversaire subit l'État *À Terre*. **S'il est monté**, il fait une **chute de 2 mètres** puis subit l'État *À Terre*.
- **Si vous perdez** : rien ne se passe en dehors des effets standards du résultat de l'opposition.

> « Après avoir touché votre opposant, vous pouvez dépenser 2 Avantages et effectuer un Test opposé de **Force/Athlétisme**. » — `AA 08 l.83`

---

### Atout Taillade (XA)

Armes tranchantes conçues pour ouvrir des blessures béantes. (« X » = l'Indice, exprimé en Avantages : ex. *Taillade (1A)* sur le cimeterre.)

- **Si vous infligez une Blessure Critique avec cette arme, la cible subit un État _Hémorragique_** en plus de tous les autres effets du Coup Critique.
- Vous pouvez dépenser **X Avantages** pour que votre opposant subisse **1 État _Hémorragique_ supplémentaire**.

> « Si vous infligez une Blessure Critique avec cette arme, la cible subit un État _Hémorragique_ en plus de tous les autres effets du Coup Critique. Vous pouvez dépenser X Avantages pour que votre opposant subisse 1 État _Hémorragique_ supplémentaire. » — `AA 08 l.87`

---

### Atout Tir de zone (Indice)

Armes qui tirent un nuage de projectiles se déployant pour frapper plusieurs cibles. L'effet dépend de la **portée** à laquelle se trouve la cible :

| Bande de portée | Effet |
|---|---|
| **Bout portant** | Le tir cible **un seul individu**. Ajoutez l'**Indice** aux **Dégâts** de l'arme. |
| **Portée Courte à Longue** | Le tir cible un individu, **mais aussi les (Indice) créatures visibles les plus proches** si elles ne se trouvent pas à plus de **(Indice) mètres** de distance. |
| **Portée Extrême** | Comme pour Portée Courte à Longue, **mais réduit les Dégâts de l'arme de (Indice)**. |

*— `AA 08 l.89-95`*

---

### Atout Protectrice (Indice) — mis à jour

L'Atout *Protectrice* a été **modifié** pour être plus facile à utiliser en combat au corps à corps.

- **Chaque fois que vous vous opposez à une attaque** avec votre **Capacité de Combat** ou avec votre **Compétence Corps à Corps**, vous bénéficiez d'un nombre de **PA supplémentaires égal à l'Indice de _Protectrice_**.
- Si votre arme a un **Indice _Protectrice_ de 2 minimum**, vous pouvez **aussi l'utiliser pour vous opposer aux tirs de projectiles dans votre ligne de vue**.
- Concrètement : vous pouvez parer une attaque de corps à corps avec votre **arme de main principale** (sans pénalité) **et** gagner le bénéfice des PA du **bouclier dans la main secondaire**, même si vous n'avez techniquement pas utilisé le bouclier pour vous opposer.

**Exemple (verbatim, AA)** : Uri, Surpris au premier Round, ne tire aucun bénéfice de son bouclier. Au Round suivant (plus Surpris), son **bouclier Protectrice 2** lui fournit **2 PA** en plus de son armure. Quand un gobelin lui tire dessus à **50 mètres**, il peut s'y opposer grâce à *Protectrice 2* ; comme le bouclier est en main secondaire, il subit **−20** (Combat à deux armes) **ou** pas de pénalité s'il utilise **Corps à Corps (Parade)** ; et comme le bouclier a *Défensive*, il bénéficie de **+1 DR**.

> « Chaque fois que vous vous opposez à une attaque avec votre Capacité de Combat ou avec votre Compétence Corps à Corps, vous bénéficiez d'un nombre de PA supplémentaires égal à l'Indice de _Protectrice_. Si votre arme a un Indice _Protectrice_ de 2 minimum, vous pouvez aussi l'utiliser pour vous opposer aux tirs de projectiles dans votre ligne de vue. » — `AA 08 l.102`

---

### Note — armes de base portant ces Atouts (référence)

Le **Tableau des Armes de Base** d'*Aux Armes* utilise ces nouveaux Atouts. Extraits pertinents (Allonge / Dégâts / Atouts) :

| Arme | Allonge | Dégâts | Atouts et Défauts |
|---|---|---|---|
| Cimeterre | Courte | +BF +4 | **Taillade (1A)** |
| Hache | Moyenne | +BF +4 | **Déséquilibrée**, Taille |
| Marteau de guerre | Moyenne | +BF +4 | Assommante **ou** Perforante, **Déséquilibrée** |
| Masse | Moyenne | +BF +4 | Assommante, **Déséquilibrée** |
| Massue | Moyenne | +BF +4 | **Déséquilibrée**, Inoffensive |
| Pique d'armes | Moyenne | +BF +4 | **Déséquilibrée**, Perforante |
| Arme improvisée | Variable | +BF +1 | **Déséquilibrée**, Inoffensive |

*— `AA 08 l.131-147`*

---

**Sources RAW** :
- `AA 07 l.4-10` — Mises à jour de l'État *Hémorragique* : 1 Blessure/Round modificateurs ignorés ; −10 contre Blessure purulente/Infection mineure/Infection du sang ; plancher à 0 Blessure ; Test de Résistance Intermédiaire (+0) en fin de Tour sous peine d'*Inconscient* ; mort 10 %/État si Inconscient+Hémorragique (3 États → mort sur 1-30, double = coagulation −1 État) ; retrait via Guérison Accessible (+20) (+1/DR) ou guérison de PB (1 État/PB guéri).
- `AA 07 l.31` — « Une fois tous les États *Hémorragique* retirés, gagnez un État *Exténué*. »
- `AA 08 l.67-76` — Atouts Optionnels : règle de choix avant le jet de touche, défaut = premier Atout listé (exemple du marteau de guerre).
- `AA 08 l.79-81` — *Déséquilibrée* : −1 DR quand l'arme oppose une attaque.
- `AA 08 l.83-85` — *Déstabilisante* : sur touche, 2 Avantages + Test opposé Force/Athlétisme → *À Terre* (chute de 2 m si monté).
- `AA 08 l.87` — *Taillade (XA)* : *Hémorragique* sur Critique, +1 *Hémorragique* par X Avantages dépensés.
- `AA 08 l.89-95` — *Tir de zone (Indice)* : bout portant = cible unique +Indice Dégâts ; courte-à-longue = +Indice cibles ≤ Indice mètres ; extrême = idem mais −Indice Dégâts.
- `AA 08 l.98-108` — *Protectrice (Indice)* mise à jour : Indice PA en opposant CC/Corps à Corps ; Protectrice ≥ 2 permet d'opposer les projectiles en ligne de vue ; exemple Uri.
- `AA 08 l.131-147` — Tableau des Armes de Base : armes portant ces Atouts (cimeterre Taillade (1A), hache/marteau/masse/massue/pique/arme improvisée Déséquilibrée).

**Voir aussi** : LDB — États (Hémorragique, Inconscient, Exténué, À Terre, Empoisonné) ; LDB 13 — Combat & Critiques ; LDB 62 — Atouts/Défauts d'arme (Protectrice/Défensive/Taille version Livre de Base) ; AA — Atouts à distance (Salve, etc.) ; LDB 18 — Traumatisme (Blessures Critiques).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `AA 7` (l.4-10, l.31) → `CritEntry`, `healDifficulty`, `aaCriticalOffset`, `aaBleedUnconsciousDue`, `aaBleedUnconsciousApply`, `OptionsCritique`, `resolveCritique`, `collectHeroRoundEndUpkeep`, `tickDeath`, `createCombatSlice` — `src/data/combat-stakes.json`, `src/data/criticals.ts`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/criticals.ts`, `src/engine/conditions.ts`, `src/engine/critical.ts`, +3 fichiers
- `AA 8` (l.67-76, l.79-81, l.83-85, l.87, l.89-95, l.98-108, l.131-147) → `splitIndice`, `qualityRefSchema`, `doc`, `withArg`, `coutAvantageTexte`, `QualityInstance`, `cimeterre`, `dague-ballock`, `INDICE_TEMPLATE`, `massue`, +15 — `src/data/index.ts`, `src/data/qualities.json`, `src/data/schemas/defs/qualities.ts`, `src/data/schemas/grammaire/reference.ts`, `src/data/trappings.json`, `src/engine/flowCore.ts`, +5 fichiers

---

## AA : armes de mêlée — tables et règles spéciales

*Aux Armes* (supplément *Up in Arms* VF) révise et enrichit les profils d'armes de mêlée du Livre de base. Cette entrée transcrit **verbatim** les huit tableaux d'armes de mêlée du chapitre 1 d'AA ainsi que les huit règles spéciales associées (Pavois, lance de cavalerie improvisée, gantelet verrouillé, lacet étrangleur, fléaux sans formation, armes de parade en main secondaire, Force d'entrave des armes d'entrave, etc.). Toutes les valeurs (Prix / Encombrement / Disponibilité / Allonge / Dégâts / Atouts et Défauts) viennent directement des tableaux d'AA, et non du Livre de base. Notation des dégâts : `+BF +N` signifie « Bonus de Force + N » (sauf armes improvisées et munitions à modificateur fixe). Prix en `X/Y` = X sous d'argent / Y sous de bronze ; « N CO » = N Couronnes d'or. Le préfixe **(2M)** marque les armes maniées à deux mains.

### [AA 01] Tableau des Armes de Base

Les armes de base sont maniées à une main et nécessitent relativement peu d'entraînement.

| Arme | Prix | Enc | Disponibilité | Allonge | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| Arme improvisée | N/A | Variable | N/A | Variable | +BF +1 | Déséquilibrée, Inoffensive |
| Cimeterre | 1 CO | 1 | Limitée | Courte | +BF +4 | Taillade (1A) |
| Couteau | 8/– | 0 | Commune | Très courte | +BF +1 | Inoffensive |
| Dague | 16/– | 0 | Commune | Très courte | +BF +2 | – |
| Dague ballock | 16/– | 0 | Limitée | Très courte | +BF +1 | Empaleuse\*, Perforante, Précise\* |
| Épée | 1 CO | 1 | Commune | Moyenne | +BF +4 | – |
| Hache | 10/– | 1 | Commune | Moyenne | +BF +4 | Déséquilibrée, Taille |
| Marteau de guerre | 1 CO | 1 | Limitée | Moyenne | +BF +4 | Assommante ou Perforante, Déséquilibrée |
| Masse | 15/– | 1 | Commune | Moyenne | +BF +4 | Assommante, Déséquilibrée |
| Massue | 4/– | 1 | Commune | Moyenne | +BF +4 | Déséquilibrée, Inoffensive |
| Pique d'armes | 15/– | 1 | Limitée | Moyenne | +BF +4 | Déséquilibrée, Perforante |

> **\*** Les Atouts d'arme *Empaleuse* et *Précise* (dague ballock) ne s'appliquent que si la cible subit l'État *Surpris* ou *À Terre*. — `AA 08 l.147`

Notes : le **marteau de guerre** porte un Atout au CHOIX (*Assommante* — tête plate — OU *Perforante* — pointes) en plus de *Déséquilibrée* (`AA 08 l.140-142+245`). Le **cimeterre** a une Allonge Courte malgré une longueur comparable à l'épée (forme courbe → estoc réduit). Une **épée brisée** sert de dague mais reçoit le Défaut *Dangereuse* si elle n'a plus de garde complète. La **massue** peut être ramassée gratuitement en milieu boisé via un Test étendu de Survie en extérieur Intermédiaire (+0), total 7 DR. (`AA 08 l.130-153`)

### [AA 01] Règles du Pavois et Tableau des Boucliers

Les boucliers s'utilisent avec la Compétence **Corps à Corps (Base)**. L'Atout *Protectrice (Indice)* a été révisé dans AA : chaque opposition avec Capacité de Combat / Corps à Corps ajoute un nombre de PA égal à l'Indice ; avec un Indice ≥ 2, le bouclier peut aussi s'opposer aux tirs de projectiles dans la ligne de vue. (`AA 08 l.100-104`)

| Arme | Prix | Enc | Disponibilité | Allonge | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| Bouclier | 2 CO | 1 | Commune | Très courte | +BF +2 | Défensive, Inoffensive, Protectrice 2 |
| Bouclier (grand) | 3 CO | 3 | Commune | Très courte | +BF +3 | Défensive, Inoffensive, Protectrice 3 |
| Bouclier (targe) | 18/2 | 0 | Commune | Personnelle | +BF +1 | Défensive, Inoffensive, Protectrice 1 |
| Pavois | 3 CO 15/– | 4 | Rare | N/A | +BF +2 | Défensive, Protectrice 5 |

**Règle du Pavois** — le pavois (grand bouclier d'arbalétrier, ~1,20 m) s'utilise de **deux** manières :
- **Comme un grand bouclier** : il confère *Protectrice 3, Défensive, Inoffensive* et ACQUIERT les Défauts *Épuisante* et *Lente* ; Encombrement 4, et n'inflige que **+BF +2** Dégâts.
- **Comme couvert portatif (usage prévu)** : l'**installer coûte 2 Actions**. L'utilisateur doit indiquer la **direction du couvert** (orientation nord/sud/est/ouest ; position du corps à gauche/droite/devant/derrière ; ou repère géographique « entre le château et moi »). Tant qu'il reste à **1 mètre maximum** derrière le pavois, celui-ci le protège contre **toute attaque de projectiles venant de la direction indiquée**, accordant *Protectrice 5* et *Défensive*. Contre une attaque de corps à corps, le pavois ne protège que si l'attaque vient de la direction indiquée, et **seulement au premier Round** de combat. Aucune protection sur les flancs ou par derrière. (`AA 08 l.156-170`)

### [AA 01] Tableau des Armes de Cavalerie + lance comme arme improvisée

| Arme | Prix | Enc | Disponibilité | Allonge | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| Demi-lance de cavalerie | 1 CO | 2 | Limitée | Longue | +BF +5\* | Empaleuse, Percutante |
| Lance de cavalerie | 1 CO | 3 | Limitée | Très longue | +BF +6\* | Empaleuse, Percutante |
| (2M) Marteau à bec-de-corbin | 3 CO | 3 | Limitée | Longue | +BF +5 | Assommante |
| Sabre | 2 CO | 1 | Limitée | Moyenne | +BF +4 | Taillade (1A) |

> **\*** Les lances de cavalerie et les demi-lances de cavalerie sont considérées comme des **armes improvisées** si vous les utilisez lors d'un Round où vous n'avez **pas Chargé**. — `AA 08 l.211`

**Règle lance de cavalerie improvisée** : sans Charge dans le Round, la lance/demi-lance bascule sur la ligne « Arme improvisée » du Tableau des Armes de Base (+BF +1, *Déséquilibrée, Inoffensive*) — elle perd donc ses dégâts élevés, *Empaleuse* et *Percutante* (`AA 08 l.205-211`).

**Sabre** : à pied avec **Corps à Corps (Base)**, son Atout *Taillade (1A)* devient *Taillade (2A)*. Utilisé avec **Corps à Corps (Escrime)**, le sabre **conserve** *Taillade (1A)*. Le **marteau à bec-de-corbin**, à pied, s'utilise avec **Corps à Corps (Deux mains)**. (`AA 08 l.182-190`)

### [AA 01] Tableau des Armes d'Escrime

Pour employer pleinement une arme d'escrime, l'utilisateur doit maîtriser la technique correspondante (Corps à Corps (Escrime)) ; sinon elle se manie comme une arme de base.

| Arme | Prix | Enc | Disponibilité | Allonge | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| Épée de cour | 4 CO | 1 | Limitée | Courte | +BF +2 | Empaleuse, Précise, Rapide |
| Fleuret | 5 CO | 1 | Limitée | Moyenne | +BF +3 | Empaleuse, Inoffensive, Précise, Rapide |
| Rapière | 5 CO | 1 | Limitée | Longue | +BF +4 | Empaleuse, Rapide |

Note : les épées de cour à pointe boutonnée / lame émoussée (usage sportif) ont le Défaut *Inoffensive*. (`AA 08 l.192-200+303-309`)

### [AA 01] Règle Gantelet verrouillé + Lacet étrangleur + Tableau des Armes de Bagarre

Beaucoup d'armes de bagarre peuvent être bricolées à partir d'objets adéquats.

| Arme | Prix | Enc | Disponibilité | Allonge | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| Coup-de-poing | 2/6 | 0 | Commune | Personnelle | +BF +2 | – |
| Gaffe | 6/– | 0 | Commune | Courte | +BF +4 | Déstabilisante, Inoffensive |
| Gantelet à pointes | 2 CO | 1 | Limitée | Personnelle | +BF +3 | Déséquilibrée, Empaleuse |
| Gantelet verrouillé | 1 CO | 1 | Limitée | Personnelle | +BF +2 | Inoffensive |
| (2M) Lacet étrangleur | 1/– | 0 | Rare | Personnelle | +BF +2 | Déséquilibrée, Enchevêtrement, Inoffensive, Lente |
| Mains nues | N/A | 0 | – | Personnelle | +BF +0 | Inoffensive |
| Matraque | 1/– | 0 | Rare | Personnelle | +BF +1 | Assommante, Déséquilibrée, Inoffensive |

**Règle Gantelet verrouillé** : gantelet d'acier maintenu fermé par une vis ou un loquet ; il s'achète en complément d'une armure de plates pour un bras (ajouter son prix à celui de l'armure, sans Encombrement supplémentaire). Un personnage équipé d'un gantelet verrouillé **ne lâche pas** l'objet tenu dans cette main même quand les circonstances l'y obligeraient normalement (Désarmer, Critique *Cassure nette*, etc.). À la place, il subit **−20 sur tous les Tests** effectués avec cet objet (y compris Corps à Corps) **tant que** la circonstance persiste, et **pendant un Round minimum**. Si pendant cette période un **nouvel** événement survient qui aurait à nouveau dû le faire lâcher l'objet, il le **lâche** malgré le gantelet. (`AA 08 l.233-240`)

**Lacet étrangleur — règles spéciales** : longueur de corde/fil passée autour du cou de l'adversaire et serrée à la main. Fabrication possible (relais de poste ou lieu urbain) via un Test étendu de **Métier (Cirier, Ingénieur, Tailleur ou Tanneur) Intermédiaire (+0)**, total **5 DR**. C'est une arme à deux mains (2M) ; ses Atouts/Défauts sont **Déséquilibrée, Enchevêtrement, Inoffensive, Lente** (l'Atout *Enchevêtrement* en fait une arme d'entrave). (`AA 08 l.242+341-347`)

### [AA 01] Fléaux sans formation + Tableau des Fléaux

| Arme | Prix | Enc | Disponibilité | Allonge | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| Fléau | 2 CO | 1 | Limitée | Moyenne | +BF +5 | À Enroulement, Perturbante |
| Fléau à grain | 10/– | 1 | Commune | Moyenne | +BF +3 | À Enroulement, Imprécise, Perturbante |
| (2M) Fléau d'armes | 3 CO | 2 | Rare | Longue | +BF +6 | À Enroulement, Épuisante, Percutante, Perturbante |

**Règle Fléaux sans formation** : un personnage **dépourvu de la Compétence Corps à Corps (Fléau)** qui manie un fléau **ajoute le Défaut d'arme *Dangereuse*** à son arme **ET perd tout autre Atout d'arme** que le fléau possède (donc *À Enroulement*, *Percutante*, etc. disparaissent ; seuls subsistent les Défauts + *Dangereuse*). (`AA 08 l.262-264+365-371`)

### [AA 01] Armes de Parade (pénalité main secondaire) + Cape/Filet (Force d'entrave) + Tableau

**Règle des Armes de Parade** : **toute arme à une main dotée de l'Atout *Défensive*** peut être utilisée avec **Corps à Corps (Parade)**. Quand vous utilisez Corps à Corps (Parade), vous pouvez vous opposer à une attaque **sans la pénalité habituelle de −20** liée à l'utilisation de la main secondaire (Combat à deux armes). (`AA 08 l.270-271`)

| Arme | Prix | Enc | Disponibilité | Allonge | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| Brise-épée | 1 CO 2/6 | 1 | Limitée | Courte | +BF +1 | Défensive, Piège-lame |
| Cape | 10/– | 1 | Commune | Courte | +BF +0 | Défensive, Immobilisante, Inoffensive |
| (2M) Filet lesté | 1 CO 10/– | 1 | Rare | Courte | +BF +0 | À Enroulement, Défensive, Immobilisante, Inoffensive, Lente, Protectrice 1 |
| Main gauche | 1 CO | 0 | Rare | Très courte | +BF +2 | Défensive |

**Force d'entrave (Cape et Filet lesté)** : pour les Tests visant à savoir si un adversaire s'empêtre dans une arme d'entrave, l'arme est traitée comme ayant une **Force** propre :
- **Cape** : Force **25** (peu adaptée aux attaques d'entrave). (`AA 08 l.308`)
- **Filet lesté** : Force **55**. (`AA 08 l.310`)

**Main gauche** : dague d'escrime ; un combattant **sans Corps à Corps (Parade)** peut quand même l'utiliser, mais elle **devient une dague et perd l'Atout *Défensive***. (`AA 08 l.312-314`)

### [AA 01] Tableau des Armes d'Hast

| Arme | Prix | Enc | Disponibilité | Allonge | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| (2M) Ahlspiess | 2 CO | 2 | Limitée | Très longue | +BF +3 | Empaleuse, Perforante |
| (2M) Attrape-coquin | 2 CO | 3 | Rare | Longue | +BF +2 | Défensive, Immobilisante |
| (2M) Bâton | 3/– | 2 | Commune | Longue | +BF +4 | Assommante, Défensive |
| (2M) Hache d'armes | 2 CO | 3 | Limitée | Longue | +BF +4 | Taille ou Empaleuse ou Assommante, Défensive |
| (2M) Hallebarde | 2 CO | 3 | Commune | Longue | +BF +4 | Défensive, Taille ou Empaleuse |
| (2M) Lance | 15/– | 2 | Commune | Très longue | +BF +4 | Empaleuse |
| (2M) Pertuisane/Fauchard | 2 CO | 3 | Limitée | Longue | +BF +4 | Défensive, Empaleuse ou Taillade (2A) |
| (2M) Pique | 18/– | 4 | Rare | Considérable | +BF +4 | Empaleuse |
| (2M) Serpe de guerre | 2 CO | 3 | Limitée | Longue | +BF +4 | Défensive, Taille ou Déstabilisante |

Notes : la **hache d'armes** choisit **Taille OU Empaleuse OU Assommante** (+ *Défensive*) ; **hallebarde**, **pertuisane/fauchard** et **serpe de guerre** offrent un choix d'Atout au moment de l'attaque ; le **bâton** peut être ramassé gratuitement en milieu boisé (Survie en extérieur Intermédiaire (+0), total 20 DR). **Attrape-coquin** : certains modèles à **mécanisme à ressort** coûtent **4 CO** et donnent **+20 sur tous les Tests de Force** pour empêtrer une cible. (`AA 08 l.294-306+406-433`)

### [AA 01] Tableau des Armes à Deux Mains

| Arme | Prix | Enc | Disponibilité | Allonge | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| (2M) Épée bâtarde | 8 CO | 3 | Limitée | Longue | +BF +5 | Défensive, Dévastatrice |
| (2M) Grande hache | 4 CO | 3 | Commune | Longue | +BF +6 | Épuisante, Percutante, Taille |
| (2M) Marteau de guerre | 3 CO | 3 | Commune | Moyenne | +BF +6 | Assommante, Dévastatrice, Lente |
| (2M) Pioche | 9/– | 3 | Commune | Moyenne | +BF +5 | Dévastatrice, Empaleuse, Lente |
| (2M) Zweihänder | 10 CO | 3 | Limitée | Longue | +BF +5 | Dévastatrice, Taille |
| (2M) Zweihänder flamberge | 30 CO | 3 | Exotique | Longue | +BF +5 | Dévastatrice, Taille, Taillade (2A) |

**Épée bâtarde** : un combattant possédant **Corps à Corps (Base)** peut l'utiliser **à une main**, mais elle acquiert alors les Défauts **Épuisante** et **Lente** (en plus de perdre l'avantage des deux mains). La **zweihänder flamberge** (lame ondulée/dentelée) ajoute *Taillade (2A)* à la zweihänder standard. (`AA 08 l.339-364`)

---

**Sources RAW** :
- `AA 08 l.130-153` — Tableau des Armes de Base révisé : cimeterre (Allonge Courte, Taillade 1A), dague ballock (Empaleuse\*+Perforante+Précise\*, \* = uniquement vs Surpris/À Terre), marteau de guerre (Assommante OU Perforante + Déséquilibrée), masse, massue, pique d'armes ; massue ramassable (Survie 7 DR).
- `AA 08 l.100-104` — Atout *Protectrice* révisé (PA = Indice à chaque opposition ; Indice ≥ 2 → contre projectiles dans la ligne de vue).
- `AA 08 l.156-170` — Tableau des Boucliers (bouclier, grand, targe, pavois) + règle du Pavois (déploiement en 2 Actions avec direction indiquée → Protectrice 5 + Défensive contre projectiles à 1 m, mêlée seulement 1er Round depuis la direction, rien sur flancs/dos ; ou employé comme grand bouclier : Protectrice 3 + Épuisante + Lente, +BF +2).
- `AA 08 l.182-211` — Tableau des Armes de Cavalerie (demi-lance/lance/marteau à bec-de-corbin/sabre) ; lance et demi-lance = arme improvisée si pas de Charge dans le Round ; sabre Taillade 1A→2A sans Escrime ; bec-de-corbin = Corps à Corps (Deux mains) à pied.
- `AA 08 l.192-220` — Tableau des Armes d'Escrime (épée de cour, fleuret Empaleuse+Inoffensive+Précise+Rapide, rapière).
- `AA 08 l.224-260` — Tableau des Armes de Bagarre (coup-de-poing, gaffe, gantelet à pointes, gantelet verrouillé, lacet étrangleur, mains nues, matraque) + règle Gantelet verrouillé (−20 ≥ 1 Round, lâche au 2e événement) + fabrication du lacet étrangleur (Métier, 5 DR).
- `AA 08 l.262-282` — Tableau des Fléaux (fléau, fléau à grain, fléau d'armes) + règle « sans Corps à Corps (Fléau) → +*Dangereuse* et perte de tous les autres Atouts ».
- `AA 08 l.270-314` — Tableau des Armes de Parade (brise-épée Défensive+Piège-lame, cape, filet lesté, main gauche) + règle « arme à une main *Défensive* utilisable en Corps à Corps (Parade) sans la pénalité −20 main secondaire » + Force d'entrave Cape 25 / Filet lesté 55 + main gauche → dague (perd Défensive) sans Parade.
- `AA 08 l.294-337` — Tableau des Armes d'Hast (ahlspiess, attrape-coquin +20 si mécanisme à ressort à 4 CO, bâton, hache d'armes choix Taille/Empaleuse/Assommante, hallebarde, lance, pertuisane/fauchard, pique, serpe de guerre).
- `AA 08 l.339-364` — Tableau des Armes à Deux Mains (épée bâtarde utilisable à une main → Épuisante+Lente, grande hache, marteau de guerre 2M, pioche, zweihänder, zweihänder flamberge Dévastatrice+Taille+Taillade 2A).

> « Les Personnages dépourvus de la Compétence Corps à Corps (Fléau) ajoutent le Défaut d'arme *Dangereuse* à leurs fléaux, et perdent tout autre Atout d'arme que le fléau peut posséder. » — `AA 08 l.264`

> « Un Personnage équipé d'un gantelet verrouillé ne lâche pas l'objet tenu dans cette main […]. Au lieu de cela, il subit une pénalité de -20 sur tous les Tests qu'il effectue avec cet objet […] tant que les circonstances qui auraient dû lui faire lâcher l'objet persistent (et pendant un Round minimum). » — `AA 08 l.236`

> « Quand vous effectuez un Test pour savoir si un adversaire s'empêtre dans un filet lesté, le filet a une Force de 55. » — `AA 08 l.310`

**Voir aussi** : Atouts et Défauts d'arme (Taillade, Empaleuse, Précise, Protectrice, Défensive, Piège-lame, À Enroulement, Enchevêtrement, Immobilisante) ; Armes à distance et munitions AA ; Combat à deux armes et main secondaire (LDB 13) ; Allonge et Charge (LDB 13/15) ; Armures et boucliers (LDB 63).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `AA 8` (l.100-104, l.130-433) → `splitIndice`, `immobilisante-fixe`, `cimeterre`, `dague-ballock`, `massue`, `pique-d-armes`, `destabilisante`, `taillade`, `tir-de-zone`, `desequilibree`, +32 — `src/data/index.ts`, `src/data/qualities.json`, `src/data/trappings.json`, `src/engine/qualities/normalize.ts`
- sans code : `AA 8` (l.205-211)
- dette : #1661
- bloqué : Indice de Taillade du sabre selon la Compétence employée (AA 08 l.190) : aucune Condition ne lit la Compétence de l'attaque

---

## AA : armes à poudre à canon et munitions — tables

Le supplément *Aux Armes* (chapitre VIII) détaille les **armes à poudre à canon** (aussi appelées poudre noire) et leurs **munitions**. Cette entrée reproduit verbatim les deux tableaux d'armes (Ingénierie + Poudre Noire), le tableau des munitions à poudre noire, la procédure de chargement et les règles particulières de munitions (gros calibre → Assourdi, cartouche en papier → +10 au rechargement, poudre imprégnée d'*Aqshy* → maladresse étendue). Toutes les armes listées portent au moins le Défaut **Recharge** (le rechargement complet prend un nombre d'Actions/Tests égal à l'Indice de Recharge), la plupart le Défaut **Dangereuse** (un jet raté incluant un 9 = Maladresse), et plusieurs portent **Tir de zone** ou **À répétition**.

> **Correction d'édition (Indices de Recharge rétablis).** La source affiche chaque valeur sous la forme `<Qualité> — p. N` (artefact OCR de la mise en page à trois colonnes). Le `— p. N` n'est **pas** une référence de page : c'est l'**Indice** de la qualité qui le précède immédiatement. La preuve est interne à la même table : *Tromblon* est imprimé « Dangereuse, **Recharge 2**, Tir de zone — p. 3 » — l'Indice de Recharge y est explicite (2), et le « — p. 3 » est l'Indice de **Tir de zone**, pas une page. Donc « Recharge — p. N » signifie partout **Recharge N**, « Tir de zone — p. N » signifie **Tir de zone N**. Les tableaux ci-dessous rétablissent ces Indices (identiques à ceux du topic LDB jumeau *armes-distance-munitions-tables*). — `AA 08 l.445-466`

### Charger une arme à poudre noire (règle)

Dans l'Empire, toutes les armes à poudre noire se chargent **par le canon** : on introduit la poudre, puis la balle et un tampon de tissu, le tout compacté avec une **baguette** (rangée dans un logement de l'arme). De la **poudre d'amorçage** (poudre noire à grains très fins) est ensuite placée dans le récipient à poudre pour être versée dans un petit canal de l'arme ; elle est allumée par l'allumette, la mèche ou le mécanisme de tir et met le feu à la charge principale qui propulse la balle. — `AA 08 l.428-429`

Des **matériaux de bourre** (coton, feutre, papier) garantissent que les gaz propulsent la balle avec un maximum de force. La bourre est généralement ajoutée **avant et après la balle** pour la précision ; certains vétérans portent un emporte-pièce à bourre pour tailler des tampons toujours identiques (meilleure précision). — `AA 08 l.431`

Mécaniquement, le rechargement complet d'une de ces armes est régi par son Défaut **Recharge** (Indice = nombre de Tests/Actions requis ; sans Indice = 1). Les **mèches** (arquebuse à mèche, tromblon à mèche) doivent en outre être **allumées** : avant d'utiliser une arquebuse à mèche, le tireur dépense une Action pour allumer la mèche, qui brûle ensuite très longtemps sauf si elle est éteinte par la pluie ou le vent. — `AA 08 l.440`, `l.3195`

### Tableau des Armes à Poudre à Canon — Ingénierie (table)

| Arme | Prix | Enc | Disponibilité | Portée | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| Arquebuse à répétition *(2M)* | 10 CO | 3 | Rare | 30 | +9 | À répétition 4, Dangereuse, Recharge 5 |
| Canne-pistolet | 15 CO | 1 | Exotique | 10 | +8 | Dangereuse, Imprécise, Recharge 6 |
| Mortier à main *(2M)* | 50 CO | 3 | Exotique | 30 | +7 | Dangereuse, Imprécise, Recharge 2 |
| Pistolet à répétition | 15 CO | 1 | Rare | 10 | +8 | À répétition 4, Dangereuse, Pistolet, Recharge 4 |
| Poivrière | 12 CO | 1 | Rare | 10 | +8 | À répétition 4\*, Dangereuse, Pistolet, Recharge 4 |

\* Uniquement si l'arme est maniée à deux mains. — `AA 08 l.446-454`, `l.3179`

### Tableau des Armes à Poudre à Canon — Poudre Noire (table)

| Arme | Prix | Enc | Disponibilité | Portée | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| Arquebuse *(2M)* | 4 CO | 2 | Limitée | 50 | +9 | Dangereuse, Recharge 3 |
| Arquebuse à double canon *(2M)* | 7 CO | 3 | Exotique | 50 | +9 | À répétition 2, Dangereuse, Recharge 4 |
| Arquebuse à mèche *(2M)* | 2 CO | 2 | Rare | 50 | +8 | Dangereuse, Recharge 4 |
| Hache-arquebuse *(2M)* | 8 CO | 1 | Exotique | 30 | +9 | Dangereuse, Imprécise, Recharge 4 |
| Hallebarde-arquebuse *(2M)* | 10 CO | 3 | Exotique | 30 | +9 | Dangereuse, Imprécise, Recharge 4 |
| Haquebute *(2M)* | 5 CO | 3 | Exotique | 40 | +9 | Dangereuse, Imprécise, Recharge 5 |
| Long fusil du Hochland *(2M)* | 50 CO | 3 | Exotique | 100 | +9 | Pointue, Précise, Recharge 4 |
| Pistolet | 8 CO | 0 | Rare | 20 | +8 | Pistolet, Recharge 1 |
| Pistolet patte de griffon | 20 CO | 1 | Exotique | 10 | +7 | Imprécise, Recharge 6, Tir de zone 5 |
| Tromblon *(2M)* | 2 CO | 1 | Limitée | 20 | +8 | Dangereuse, Recharge 2, Tir de zone 3 |
| Tromblon à mèche *(2M)* | 1 CO | 1 | Rare | 20 | +7 | Dangereuse, Recharge 3, Tir de zone 3 |

— `AA 08 l.456-466`

**Cas particuliers d'armes (texte) :**
- **Arquebuse à mèche / Tromblon à mèche** : avant usage, dépenser une Action pour **allumer la mèche** (brûle longtemps sauf pluie/vent) ; le tromblon à mèche partage les mêmes inconvénients que l'arquebuse à mèche. — `AA 08 l.440`, `l.3195`
- **Hache-arquebuse** : utilisable en arquebuse ou en hache ; si maniée **comme hache alors qu'elle est chargée**, une Maladresse décharge l'arme **dans le corps de l'utilisateur**. — `AA 08 l.442`
- **Hallebarde-arquebuse** : si maniée **comme hallebarde alors qu'elle est chargée**, une Maladresse décharge l'arme **sur quiconque se tient juste derrière l'utilisateur**. — `AA 08 l.472`
- **Pistolet patte de griffon** : une seule gâchette décharge **les six canons** ; recharger exige **six munitions et autant de poudre** (d'où Recharge 6). — `AA 08 l.480`
- **Mortier à main** : ressemble à un tromblon court et trapu, conçu pour lancer bombes et gros objets ; une **Maladresse en rechargeant** fait **exploser** l'arme. — `AA 08 l.509`
- **Poivrière** : quatre canons préchargés ; doit être tournée/réamorcée entre les tirs (très rapide vs un rechargement complet), mais **perd l'Atout *À répétition* si la deuxième main n'est pas libre**. — `AA 08 l.506`
- **Pistolet à répétition / Arquebuse à répétition** : mécanismes d'horlogerie / chambres rotatives plaçant une nouvelle munition après chaque tir ; entre des mains non entraînées, le pistolet à répétition « a tendance à exploser ». — `AA 08 l.505`, `l.3230`
- **Canne-pistolet** : pistolet à canon court dissimulé dans une canne ; la repérer comme arme exige un Test de **Perception Difficile (–20)**, ou **Très Difficile (–30)** si l'on connaît mal les armes à poudre noire. — `AA 08 l.507`

### Munitions improvisées non-poudre (arcs / frondes)

Le chapitre VIII traite aussi des munitions improvisées non-poudre : on peut se procurer un **caillou** pour fronde par un Test étendu de **Survie en extérieur Facile (+40)** ou de **Perception Intermédiaire (+0)** totalisant **5 DR** ; un **bâton pointu droit** (flèche improvisée) en lieu boisé par un Test étendu de **Survie en extérieur Intermédiaire (+0)** totalisant **10 DR**. Les flèches improvisées, non taillées par un professionnel, **ont tendance à provoquer des Maladresses**. — `AA 08 l.386-389`

*(Le supplément ne présente pas de tableau chiffré distinct de « munitions traditionnelles » : seules ces deux entrées de fabrication improvisée figurent. Le seul tableau chiffré de munitions est celui des munitions à poudre noire ci-dessous.)*

### Tableau des Munitions à Poudre Noire (table)

| Munition (× lot) | Prix | Enc | Disponibilité | Portée | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| Balle de gros calibre et poudre (12) | 1 CO | 0 | Limitée | Comme l'arme | +2 | Empaleuse, Percutante, Perforante |
| Balle et poudre (12) | 3/3 | 0 | Commune | Comme l'arme | +1 | Empaleuse, Perforante |
| Bombe explosive | 3 CO | 0 | Limitée | Comme l'arme | +5 | Dangereuse, Explosion 5, Percutante |
| Bombe incendiaire | 1 CO | 0 | Limitée | Comme l'arme | Spécial | Dangereuse, Explosion 4 |
| Cartouche en papier (12) | 5/– | 0 | Limitée | Comme l'arme | +1 | Empaleuse, Perforante |
| Cartouche et poudre de précision | 3/– | 0 | Commune | Comme l'arme | +1 | Empaleuse, Perforante, Précise |
| Ferraille et poudre | 2/– | 0 | Commune | Moitié de l'arme | –1 | Infecté, Tir de zone +3 |
| Grappin | 2 CO | 1 | Limitée | Moitié de l'arme | +2 | Perforante, Recharge +2 |
| Munitions improvisées et poudre | 3 sc | 0 | Commune | Moitié de l'arme | – | – |
| Petites munitions et poudre (12) | 3/3 | 0 | Commune | Comme l'arme | – | Tir de zone +3 |
| Poudre imprégnée d'*Aqshy* (12) | 1 CO | 0 | Exotique | +10 | +2 | Empaleuse, Perforante |

— `AA 08 l.485-500` (Prix « 3/3 » = 3 sous d'argent / 3 sous d'argent par lot selon variante ; « 5/– », « 3/– », « 2/– » suivent la même notation sous d'argent de la source. La munition à poudre noire/ingénierie ajoute son propre Indice à la qualité indiquée, p. ex. « Tir de zone **+3** » = +3 à l'Indice de Tir de zone, « Recharge **+2** » = +2 à l'Indice de Recharge de l'arme.)*

**Règles de munitions (texte) :**
- **Balle de gros calibre** (petits boulets de canon pour armes à grand canon, haquebute/mortier) : le tireur **et** quiconque se tient à **2 mètres ou moins** doit réussir un **Test de Résistance Intermédiaire (+0)** sous peine de subir l'État **Assourdi**. — `AA 08 l.488-488`, `l.3233`
- **Cartouche en papier** (paquet pré-rempli de munition + poudre + bourre) : les **Tests de rechargement** d'une arme appropriée bénéficient d'un **bonus de +10**. — `AA 08 l.492`, `l.3245`
- **Bombe explosive / incendiaire** : souvent lancées à la main, ou chargées dans un mortier à main ; mèche allumée avant chargement ; au chargement, on **fixe la durée de mèche** (1 Round → explose à la fin du Round actuel ; 2 Rounds → à la fin du Round suivant). La munition **explose à l'instant déterminé**, qu'on ait tiré ou non, et **le MJ n'est pas tenu de prévenir**. — `AA 08 l.490-491`, `l.3237-3243`
- **Cartouche et poudre de précision** : poudre experte + balles polies arrondies → tirs plus fiables et précis (Atout Précise). — `AA 08 l.493-494`, `l.3247`
- **Ferraille et poudre** : attaques avec le **Trait de créature Infecté** (réf. WFJDR p.340). — `AA 08 l.495`, `l.3249`
- **Grappin** (tiré par mortier à main uniquement, ~20 m de corde) : peut fixer une corde, ou **piéger un ennemi en fuite** (inflige l'État **Empêtré** si le coup touche) ; tir très bruyant. — `AA 08 l.496`, `l.3251-3255`
- **Munitions improvisées et poudre** : le coût ne fournit que la poudre ; le tireur doit **trouver son propre caillou**. — `AA 08 l.496`, `l.3257`
- **Petites munitions et poudre** : utilisées pour chasser oiseaux/petites créatures rapides ; il en faut ~une douzaine par tir. — `AA 08 l.498`, `l.3259`

### Poudre imprégnée d'*Aqshy* — règle de maladresse étendue (règle)

Cette poudre, fabriquée à partir de sable du désert de Néhékhara imprégné d'*Aqshy* par le Collège Flamboyant d'Altdorf, a **davantage de puissance explosive** que la poudre normale (Dégâts **+2**, Portée **+10**) mais **use les canons bien plus vite**. Sa contrepartie mécanique :

> « Tout Test raté incluant un 8 ou un 9 sur le dé des dizaines ou celui des unités est considéré comme une Maladresse quand vous utilisez cette poudre. » — `AA 08 l.544`

C'est une **extension de la règle de Maladresse** : la Maladresse standard d'une arme **Dangereuse** ne survient que sur un jet raté incluant un **9** (dizaines ou unités) ; avec la poudre d'*Aqshy*, le seuil s'élargit à **8 OU 9** (dizaines ou unités) sur **tout** Test raté de tir avec l'arme ainsi chargée. — `AA 08 l.499-500`, `l.3261`

**Sources RAW** :
- `AA 08 l.421-425` — Généralités : poudre versée par le canon (corne/récipient de dosage), balles de plomb en sac huilé, canon étroit (précision, ex. long fusil du Hochland) vs canon large (recharge/tir rapides) ; fusils de chasse à la guerre.
- `AA 08 l.428-431` — Procédure de chargement par le canon (poudre → balle → bourre → baguette ; poudre d'amorçage ; bourre avant/après pour la précision ; emporte-pièce à bourre).
- `AA 08 l.440`, `l.3195` — Mèche : Action pour l'allumer avant usage ; éteinte par pluie/vent ; le tromblon à mèche partage les inconvénients de l'arquebuse à mèche.
- `AA 08 l.442`, `l.3183`, `l.3189`, `l.3222`, `l.3224`, `l.3226`, `l.3228`, `l.3230` — Cas particuliers d'armes : hache-/hallebarde-arquebuse (Maladresse décharge dans/derrière), patte de griffon (6 canons), arquebuse/pistolet à répétition, poivrière (4 canons, perd À répétition si 2e main occupée), canne-pistolet (Perception −20/−30 pour la repérer), mortier à main (Maladresse au rechargement = explosion).
- `AA 08 l.445-468` — Tableaux des Armes à Poudre à Canon : section Ingénierie (l.3156-3164) + section Poudre Noire (l.3166-3177) + note « \* à deux mains » (l.3179) ; stats verbatim (Prix/Enc/Disponibilité/Portée/Dégâts/Atouts et Défauts). **Le format `Qualité — p. N` encode l'Indice N de la qualité (pas une page)** : Recharge — p. N = Recharge N ; Tir de zone — p. N = Tir de zone N.
- `AA 08 l.485-500` — Tableau des Munitions à Poudre Noire : 11 munitions, stats verbatim (gros calibre, balle, bombes, cartouches, ferraille, grappin, improvisées, petites, *Aqshy*).
- `AA 08 l.516`, `l.3245`, `l.3237-3243`, `l.3247`, `l.3249`, `l.3251-3255`, `l.3257`, `l.3259` — Règles de munitions : gros calibre → Assourdi (Résistance Intermédiaire, 2 m) ; cartouche en papier → +10 rechargement ; bombes (durée de mèche) ; précision → Précise ; ferraille → Infecté ; grappin → Empêtré ; improvisées → caillou à trouver ; petites → ~12 par tir.
- `AA 08 l.545` — Poudre d'*Aqshy* : tout Test raté incluant un 8 ou 9 (dizaines/unités) = Maladresse (extension du seuil Dangereuse de 9 à 8/9).
- `AA 08 l.386-389` — Munitions improvisées non-poudre (caillou de fronde 5 DR ; bâton pointu 10 DR ; flèches improvisées → Maladresses).

> « Une seule gâchette décharge les six canons et pour recharger, il faut six munitions et la même quantité de poudre. » — `AA 08 l.480` (Pistolet patte de griffon)

> « Les Tests effectués pour recharger une arme du type approprié avec ces munitions bénéficient d'un bonus de +10. » — `AA 08 l.528` (Cartouche en papier)

> « Dangereuse, Recharge 2, Tir de zone — p. 3 » — `AA 08 l.466` (Tromblon : preuve interne que « — p. N » est l'Indice de la qualité précédente, pas une page — la Recharge 2 y est déjà explicite.)

**Voir aussi** : Armes à distance et munitions (table LDB) — *armes-distance-munitions-tables* (résolution identique du `— p. N` = Indice) ; Qualités/Défauts d'armes (Recharge, Dangereuse, À répétition/Salve, Tir de zone, Empaleuse, Percutante, Perforante, Imprécise, Précise, Pointue, Explosion) ; États Assourdi / Empêtré / Enflammé ; bandes de portée (LDB 62) ; Maladresse au combat (LDB 13/14) ; Trait Infecté (LDB 85) ; Armes d'équipe maniées en sous-effectif (AA 10 p.125).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `AA 8` (l.421-425, l.428-431, l.440, l.442, l.445-468, l.472, l.480, l.485-500, l.505, l.506, l.507, l.509, l.516, l.528, l.544, l.545) → `dangerousNine`, `infecte`, `poudre-impregnee-d-aqshy`, `QualityCapabilities`, `arquebuse-a-double-canon`, `arquebuse-a-meche`, `hache-arquebuse`, `hallebarde-arquebuse`, `haquebute`, `pistolet-patte-de-griffon`, +10 — `src/data/index.ts`, `src/data/qualities.json`, `src/data/trappings.json`, `src/engine/qualities/dispatch.ts`
- sans code : `AA 8` (l.386-389, l.446-454)

---

## AA : Combat Monté étendu et dressage

*Aux Armes* (chapitre « Le Combat Monté ») **complète** les règles de Combat monté du Livre de base (LDB 14 p.163) sans les remplacer : entretien d'une monture en campagne, mouvement/initiative du couple cavalier↔monture, modificateurs d'attaque et de ciblage, restrictions de tir, comportement de la monture selon son dressage, Avantages partagés, Peur/Terreur, le Dressage proprement dit (identification + apprentissage), trois Traits Dressé (Guerre, Magie, et le **nouveau** Cavalerie de Choc), la chute de monture, les États d'un personnage monté, et le profil de la monture demigriffon. Toutes ces règles « s'ajoutent à ces règles de base et peuvent être utiles pour une aventure ou un groupe avec lequel le combat monté est fréquent ».

### Qu'est-ce qui compte comme une monture
Une monture est un animal possédant **au moins le Trait Dressé (Monture)**. Une créature intelligente sans ce Trait peut éventuellement se laisser chevaucher, mais aura du mal à comprendre où le cavalier veut la diriger.

### Soin aux Animaux (entretien en campagne)
Tout le monde, ou presque, sait monter un cheval : **Chevaucher est une Compétence de Base** (jouable sans Augmentation). En revanche, entretenir selle/harnais, nourrir, étriller et harnacher pour le labeur ou le combat exige la Compétence **Soin aux animaux** :

- **Une seule Augmentation** suffit aux besoins de base d'une monture.
- Si le MJ juge les circonstances laborieuses (longue campagne militaire, pas de pâturage de qualité), le Personnage peut devoir un Test de **Soin aux animaux Accessible (+20)** ou même **Intermédiaire (+0)** par jour.
- Capacité de prise en charge : une seule personne peut s'occuper de **six animaux** dans de mauvaises conditions, ou **douze** avec une écurie bien approvisionnée.
- **Soins négligés** : pour chaque jour où des soins nécessaires sont négligés, la monture effectue un Test de **Résistance Intermédiaire (+0)**. En cas d'Échec, premier Échec = État *Exténué* ; avec le temps, problèmes plus graves (maladie, perte d'un fer, parasites — le premier et le dernier cas potentiellement transmissibles au cavalier), voire fuite de la bête.

### Le Mouvement et l'Initiative monté
Une monture possède **à la fois un Mouvement et une Action** (c'est un combattant à part).

- N'importe quel cavalier peut **dépenser son Mouvement** pour diriger les déplacements de sa monture. Par simplicité, on considère que **le cavalier possède l'Attribut Mouvement de sa monture** quand il la chevauche.
- Un cavalier peut **dépenser une Action** pour diriger l'Action de sa monture (ex. éperonner pour qu'elle effectue l'Action Course). Si l'animal n'est pas dressé, cela peut nécessiter un Test (Trait Nerveux).
- **Talent Cavalier émérite** : permet de diriger l'Action d'une monture **sans Test et sans dépenser d'Action**.

### Attaquer et se défendre monté
- **Bonus d'attaque monté** : toute attaque au corps à corps portée par un cavalier sur une **cible plus petite que sa monture** gagne **+20 pour toucher**.
- **Pénalité de ciblage du cavalier** : quand on fait un jet pour toucher un personnage monté, on choisit de viser le **cavalier** ou la **monture**. Au corps à corps, viser le **cavalier** d'un animal d'une catégorie de **Taille supérieure** à la sienne donne **−10** au Test de Corps à corps. Cette pénalité est **ignorée** si l'on chevauche soi-même une monture de taille similaire, **ou** si l'arme possède au minimum une **Allonge Longue**.
- **Charge** : en Chargeant, on peut utiliser **la Force et la Taille de la monture** pour calculer les Dégâts des attaques de corps à corps.
- **Esquive montée** : en chevauchant, **−20 à la Compétence Esquive**, sauf Talent **Acrobaties équestres** (qui annule cette pénalité).

### Restrictions de tir depuis une monture
À cheval, avec une arme à distance :
- **Arme à deux mains** : on ne peut tirer que **vers l'avant**.
- **Arme à une main** : on peut tirer **vers l'avant**, ou **vers le côté duquel on la tient**.
- Le Talent **Acrobaties équestres** annule ces restrictions (tir dans **toutes les directions**).

### Les Actions de la monture (Nerveux / Dressé Guerre)
Une monture **dressée pour la guerre et sans le Trait Nerveux** est un combattant à part entière : elle peut utiliser **sa propre Action** pour attaquer les cibles Engagées. Un animal **sans Dressé (Guerre)** est trop occupé à suivre les ordres du cavalier pour agir sans guidage explicite. La cible des attaques de la monture dépend de ses Traits de créature ; le MJ est invité à être généreux, mais un accident reste possible.

| | **Avec Trait Nerveux** | **Sans Trait Nerveux** |
|---|---|---|
| **Avec Trait Dressé (Guerre)** | Attaque les ennemis selon les désirs du cavalier et ignore Nerveux en ce qui concerne les bruits forts. | Attaque les ennemis selon les désirs du cavalier. |
| **Sans Trait Dressé (Guerre)** | Attaque les ennemis selon les désirs du MJ et a tendance à ne pas attaquer les ennemis qui n'ont pas attaqué la monture les premiers. | Attaque les ennemis selon les désirs du MJ. |

*Réf : `AA 09 l.50-54`.*

### Montures et Avantages partagés
- Un animal chevauché **sans Dressé (Guerre)** ne peut **pas bénéficier d'un Avantage**.
- **Avec Dressé (Guerre)** *et* un cavalier ayant au moins **une Augmentation dans la Compétence Chevaucher appropriée** : on **combine leurs réserves d'Avantages**. Si le cavalier ou la monture subit un événement néfaste (ex. une blessure) qui ferait normalement **perdre** l'Avantage, la réserve combinée est **réduite de moitié** à la place.

### Peur / Terreur monté et État Brisé
Beaucoup de montures infligent Peur ou Terreur (par leur taille) mais peuvent aussi les subir. Si une monture reçoit un ou plusieurs États *Brisé*, elle fuit l'ennemi à toute vitesse.
- Pendant son **propre tour**, le cavalier peut faire un Test de **Chevaucher Intermédiaire (+0)** pour la calmer : un Succès retire **un État *Brisé***, **+1 par DR supplémentaire**.
- Comme toute créature, la monture qui subit un État *Brisé* effectue **un Test de Calme à son tour** pour tenter de retirer l'État.

### Le Dressage — identification et apprentissage
- **Identifier le dressage** : un Test de **Dressage Intermédiaire (+0)** indique quel type de dressage l'animal a reçu, et donc quels Traits Dressé il possède (ou non). La Difficulté augmente si la monture a été droguée ou influencée d'une autre manière.
- **Apprendre** : ceux qui possèdent la Compétence **Dressage** peuvent utiliser l'**Activité** correspondante pour apprendre de nouvelles compétences à une monture, ce qui lui confère de nouveaux **Traits Dressé**. La plupart des montures doivent au minimum posséder **Dressé (Monture)**.

### Trait Dressé (Guerre)
L'animal dressé pour la guerre gagne **+10 CC** et **ignore le Trait Nerveux pour les bruits forts** (fracas d'une bataille, explosion d'un coup de feu). Une monture Nerveuse dépourvue de ce Trait ne devient généralement pas *Brisée* parce qu'un unique bandit lui crie dessus. Si la monture doit être chevauchée au combat à proximité de plus de quatre ou cinq autres combattants montés, Dressé (Guerre) devient quasiment indispensable.

### Trait Dressé (Magie)
La monture est habituée au fonctionnement contre nature de la magie et **ignore le Trait Nerveux pour tout ce qui concerne la magie** (nécessaire à la plupart des chevaux utilisés par les Sorciers).

### Nouveau Trait : Dressé (Cavalerie de Choc)
Ce Trait **ne peut être pris que par un animal possédant déjà Dressé (Guerre)**. La monture a été dressée pour **ignorer le péril de charger en bon ordre au milieu d'une unité ennemie bien armée** et foncer droit sur une masse d'ennemis.

- **Riposte à la charge** : une créature de **Taille inférieure** à celle que la monture tente de renverser peut **renoncer à sa chance d'esquiver** et, à la place, **porter une seule attaque** avec une arme tenue en main contre la monture ou son cavalier — **si elle n'a pas déjà agi ce Round**. Sauf si cette attaque **tue ou incapacite** la monture, **la Charge se poursuit**.
- **Passer outre (Charge traversante)** : en effectuant une Charge, un cavalier monté sur une telle bête peut **passer outre les créatures plus petites** pendant son Mouvement pour atteindre sa cible. Chaque créature ainsi renversée doit **réussir un Test d'Esquive Intermédiaire (+0)** sous peine de subir **4 + Bonus de Force de la monture** Dégâts.
- **Coût de mouvement** : toute créature qui subit des Dégâts de cette manière **réduit le Mouvement restant de la monture de 2 mètres**. Une créature de Taille **supérieure ou égale** à celle de la monture **arrête sa progression**.
- **Résolution** : dans les deux cas, une fois la Charge terminée, toute créature ennemie à portée d'Allonge d'une attaque au corps à corps est considérée comme **Engagée** normalement, et la Charge est résolue comme si l'une de ces créatures en avait été la cible.

### Table de Localisation des Dégâts sur les Quadrupèdes
Pour déterminer la Localisation des Dégâts sur un animal à quatre pattes :

| Résultat | Localisation |
|---|---|
| 01-16 | Tête |
| 17-56 | Corps |
| 57-67 | Patte avant gauche |
| 68-78 | Patte avant droite |
| 79-89 | Patte arrière gauche |
| 90-00 | Patte arrière droite |

*Réf : `AA 09 l.97-103`.*

### Tomber d'une monture
Dans la plupart des cas, tomber d'une monture est traité comme une **chute de 2 mètres** (LDB 15 p.166) et inflige **1d10+6 Dégâts**, réduits par le **Bonus d'Endurance** du cavalier **mais pas par les Points d'Armure**. Si la monture est de **Taille Grande ou supérieure**, on **augmente la hauteur de la chute de 1 mètre par catégorie de Taille**.

Le MJ peut autoriser l'animal à un Test de **Perception Accessible (+20)** pour remarquer que son cavalier est tombé ; le MJ décide ensuite du comportement de la bête (généralement elle s'arrête quelques minutes plus tard, ou moins si elle repère un bon endroit où brouter).

### États d'un personnage monté — règles spéciales
Les États d'un personnage monté doivent prendre en compte la monture **et** le cavalier.

- **Mort / Inconscient / À Terre** : un cavalier **mort** ou subissant *Inconscient* ou *À Terre* **tombe automatiquement** de sa monture (sauf équipement spécial empêchant cela). De même, si la **monture** subit *Inconscient* ou *À Terre* ou meurt, son cavalier est **immédiatement désarçonné et tombe**.
- **Surpris** : le cavalier *Surpris* doit réussir un Test de **Chevaucher Facile (+40)** sous peine de tomber.
- **Sonné** : le cavalier *Sonné* doit réussir un Test de **Chevaucher Intermédiaire (+0)** sous peine de tomber.
- **Monture Surprise** : si la **monture** subit *Surprise*, le cavalier doit réussir un **Chevaucher Facile (+40)** pour rester en selle — **mais seulement si l'animal possède le Trait Nerveux**.
- **Empêtré (cavalier)** : devenir *Empêtré* en chevauchant n'a pas d'effet supplémentaire en soi. Mais si l'on est retenu par la cause de l'État (lasso, fouet), on peut faire un Test de **Chevaucher Intermédiaire (+0)** : un Succès permet de s'accrocher de toutes ses forces, et l'on résout alors le **Test opposé de Force comme si sa Taille était celle de la monture** (LDB 85 p.342 — pour les Tests opposés de Force, plus on est grand mieux c'est).
- **Empêtré (monture)** : si la **monture** est *Empêtrée* mais pas le cavalier, elle effectue un Test opposé normalement ; cependant, si elle est **Nerveuse**, le cavalier doit réussir un **Chevaucher Intermédiaire (+0)** sous peine d'être désarçonné parce qu'elle se débat.

### Profil — Monture Demigriffon (adulte dressé)
Le demigriffon décrit dans le Livre de base (p.318) est un **jeune** spécimen ; une créature qui a servi de monture et connu les réalités de la guerre possède le profil suivant :

| M | CC | CT | F | E | I | Ag | Dex | Int | FM | Soc | B |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 7 | 55 | – | 55 | 45 | 40 | 55 | – | 15 | 45 | 15 | 34 |

**Traits :** Armure (Pattes arrières 1, Tête, Corps et Pattes avant 3), Belliqueux, Bestial, Dressé (Cavalerie de choc, Dompté, Guerre, Monture), Foulée, Taille (Grande), Vision nocturne.
**Traits de combat :** Arme (Serres) +9, Morsure +9.
**Possessions :** barde.

*Réf : `AA 09 l.176-188`.*

> Note RAW (acquisition, contexte) : un demigriffon sauvage doit être affronté et dompté ; si le cavalier monte sur son dos et **y reste un jour et une nuit** malgré les efforts de la bête, l'animal cède et gagne le Trait **Dressé (Dompté)**, mais n'autorise que la personne qui l'a dompté à le monter. Entretien : **viande fraîche valant 2 Couronnes d'or par semaine** ; selle/harnais sur mesure au **double du prix** d'un cheval (`AA 09 l.157`, `AA 09 l.167`).

**Sources RAW** :
- `AA 09 l.9-15` — Soin aux Animaux en campagne : Chevaucher = Compétence de Base ; entretien = Soin aux animaux ; 1 Augmentation suffit ; Tests Accessible (+20)/Intermédiaire (+0) par jour ; 6 / 12 animaux par soignant ; soins négligés → Résistance Intermédiaire (+0), 1er Échec = *Exténué*.
- `AA 09 l.17-23` — Cadre : règles étendues s'ajoutent à WFJDR p.163 ; monture = animal possédant au moins Dressé (Monture).
- `AA 09 l.26-30` — Mouvement & Initiative monté : monture a Mouvement + Action ; cavalier dépense son Mouvement/Action pour diriger ; cavalier emprunte le M de la monture ; Cavalier émérite = diriger l'Action sans Test ni Action.
- `AA 09 l.33-40` — Attaquer/se défendre : +20 CC sur cible plus petite que la monture ; −10 pour viser le cavalier d'une monture de Taille supérieure (ignoré si même Taille de monture ou Allonge Longue+) ; Charge avec F+Taille de la monture ; −20 Esquive monté (sauf Acrobaties équestres) ; restrictions de tir (2 mains = avant ; 1 main = avant ou côté tenu ; Acrobaties équestres lève tout).
- `AA 09 l.42-54` — Actions de la monture + tableau Nerveux / Dressé (Guerre) (verbatim ci-dessus).
- `AA 09 l.56-59` — Avantages partagés : sans Dressé (Guerre), pas d'Avantage ; avec Dressé (Guerre) + 1 Augmentation Chevaucher, réserves combinées, événement néfaste = réserve réduite de moitié au lieu de perte.
- `AA 09 l.61-63` — Peur/Terreur monté & Brisé : Chevaucher Intermédiaire (+0) pour calmer (−1 *Brisé*, +1/DR) ; Test de Calme de la monture à son tour.
- `AA 09 l.65-72` — Dressage : identification par Dressage Intermédiaire (+0) (Difficulté ↑ si droguée/influencée) ; apprentissage via l'Activité Dressage → nouveaux Traits Dressé.
- `AA 09 l.75-76` — Trait Dressé (Guerre) : +10 CC + ignore Nerveux pour les bruits forts.
- `AA 09 l.79-80` — Trait Dressé (Magie) : ignore Nerveux pour tout ce qui concerne la magie.
- `AA 09 l.83-90` — Nouveau Trait Dressé (Cavalerie de Choc) : prérequis Dressé (Guerre) ; riposte à la charge (renoncer à l'esquive pour une attaque, Charge poursuivie sauf si monture tuée/incapacitée).
- `AA 09 l.92-106` — Localisation des Dégâts sur les Quadrupèdes (table verbatim) + Charge traversante : passer outre les plus petits, Esquive Intermédiaire (+0) ou 4 + BF de la monture Dégâts, −2 m de Mouvement par créature renversée, Taille ≥ arrête la progression, résolution finale Engagement normal.
- `AA 09 l.112-116` — Tomber d'une monture : chute de 2 m (1d10+6, réduit par BE mais pas PA), +1 m par catégorie de Taille au-delà de Grande ; Perception Accessible (+20) pour que la bête remarque la chute.
- `AA 09 l.119-136` — États d'une personne montée : Mort/Inconscient/À Terre (chute auto) ; Surpris (Chevaucher Facile +40) ; Sonné (Chevaucher Intermédiaire +0) ; Monture Surprise (Facile +40, seulement si Nerveuse) ; Empêtré cavalier/monture (Tests Chevaucher Intermédiaire +0, Force à la Taille de la monture).
- `AA 09 l.157+167` — Acquisition/entretien du demigriffon : dompté en restant 1 jour + 1 nuit → Dressé (Dompté), monté seulement par le dompteur ; 2 CO de viande/semaine ; selle au double du prix.
- `AA 09 l.176-188` — Profil Monture Demigriffon adulte dressé (statbloc verbatim ci-dessus).

> « Toute attaque au corps à corps portée par un cavalier sur une cible plus petite que sa monture gagne un bonus de +20 pour toucher. » — `AA 09 l.34`

> « tomber d'une monture est considéré comme une chute de 2 mètres […] et inflige 1d10+6 Dégâts, réduits par le Bonus d'Endurance du cavalier, mais pas par les Points d'Armure. » — `AA 09 l.114`

**Voir aussi** : LDB — Combat monté (règles de base WFJDR p.163) ; LDB 85 — Trait Piétinement / Foulée ; LDB 15 — Mouvement, Course, Chute ; LDB 16 — États (Brisé, Surpris, Sonné, À Terre, Empêtré, Exténué) ; LDB 21 — Peur, Terreur, Calme ; Trait Nerveux ; Talents Cavalier émérite / Acrobaties équestres ; Compétences Chevaucher, Soin aux animaux, Dressage.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `AA 9` (l.26-30, l.33-40, l.42-54, l.56-59, l.61-63, l.65-72, l.75-76, l.79-80, l.83-90, l.92-106, l.112-116, l.119-136, l.157-167, l.176-188) → `dresse-cavalerie-de-choc`, `GameState`, `demigriffon-adulte`, `checkBattleOver` — `src/data/creatures.json`, `src/data/traits.json`, `src/state/combatFlow.ts`, `src/state/store.ts`
- sans code : `AA 9` (l.9-15, l.17-23, l.50-54)

---

## AA : Structures et armes de Siège

Règles d'*Aux Armes* pour attaquer/défendre des **Structures** (véhicules, embarcations, fortifications) et pour employer l'**artillerie** (armes de siège). Le supplément précise que les grandes manœuvres militaires sortent du cadre de WFJDR — pour un affrontement militaire à grande échelle, il renvoie aux règles de combat de masse d'*Archives de l'Empire : volume 2*. Ces règles servent quand les PJ doivent attaquer un emplacement gardé par des fortifications/de l'artillerie, ou en défendre un. `AA 10 l.3-7`

### 1. Les Structures

Une « Structure » est tout élément **trop grand et trop résistant** pour être détruit par les Tests étendus de Force du Livre de Règles (les Tests de Force conviennent pour enfoncer une porte ou réduire une chaise en miettes, pas pour une herse en fer renforcée ou une muraille de château). `AA 10 l.9-11`

Profil d'une Structure (colonnes du tableau) :
- **ENC** — points d'Encombrement qui s'appliquent quand la Structure est transportée. `AA 10 l.16`
- **Limite d'Encombrement** — combien de points d'Encombrement la Structure peut elle-même *supporter* avant de manquer d'espace ou de plier sous le poids ; restreint la quantité d'artillerie qu'on peut y placer (le MJ juge le raisonnable : une barge transporte beaucoup d'artillerie en théorie, mais surtout stockée en cale et donc inutilisable en combat). `AA 10 l.16-19`
- **Endurance** — modifie les Dégâts subis (comme l'Endurance d'un Personnage). `AA 10 l.101-102`
- **Blessures** — quantité de Dégâts encaissable. Pour les murs, le profil ne représente qu'une **bande de 5 mètres** de la Structure : sa destruction laisse la majorité du reste intact. `AA 10 l.53` `AA 10 l.102`
- **Pénalité de Couvert** — Difficulté par défaut du tir d'un assaillant contre un Personnage à couvert dans/derrière la Structure (on présume qu'il s'en sert *activement* comme couvert : accroupi derrière les plats-bords, plongé derrière les créneaux). Ne s'applique pas si la cible subit l'État *Surpris* ou se comporte d'une manière ne lui fournissant pas de couvert ; d'autres modificateurs (portée, taille de cible) peuvent s'ajouter au gré du MJ. `AA 10 l.22-23`

> Note RAW : les règles de Dégâts aux Structures pourraient servir pour les véhicules, mais le supplément recommande d'employer plutôt celles de *L'Ennemi dans l'Ombre – Compagnon* (véhicules) et de *Mort sur le Reik – Compagnon* (navires) pour leurs Dégâts dédiés. `AA 10 l.25`

#### Tableau des Structures Courantes

| Structure | ENC | Endurance | Blessures | Limite d'Encombrement | Pénalité de Couvert |
|---|---|---|---|---|---|
| **VÉHICULES** | | | | | |
| Charrette | 10 | 30 | 25 | 10 | Intermédiaire (+0) |
| Chariot léger | 30 | 30 | 50 | 35 | Complexe (−10) |
| Chariot moyen | 50 | 60 | 50 | 60 | Difficile (−20) |
| Chariot lourd | 75 | 80 | 50 | 95 | Difficile (−20) |
| Diligence | 100 | 80 | 45 | 50 | Complexe (−10) |
| **NAVIRES FLUVIAUX** | | | | | |
| Barge moyenne | 100 | 300 | 45 | 60 | Complexe (−10) |
| Bateau de patrouille | 130 | 50 | 60 | 120 | Difficile (−20) |
| Chaloupe | 25 | 60 | 35 | 10 | Intermédiaire (+0) |
| **STRUCTURES** | | | | | |
| Clôture en clayonnage* | N/A | N/A | 25 | 10 | Intermédiaire (+0) |
| Herse* | N/A | N/A | 70 | 20 | N/A |
| Mantelet de bois | 5 | N/A | 50 | 15 | Complexe (−10) |
| Mur à ossature en bois | N/A | 30 | 40 | 20 | Complexe (−10) |
| Mur de château* | N/A | 150 | 65 | 100 | Très Difficile (−30) |
| Mur de forteresse naine* | N/A | 200 | 80 | 150 | Très Difficile (−30) |
| Mur de pierre* | N/A | 100 | 60 | 50 | Difficile (−20) |
| Mur en pierres sèches* | N/A | 30 | 60 | 20 | Complexe (−10) |
| Palissade de pieux* | N/A | 60 | 50 | 30 | Difficile (−20) |
| Solide porte en bois | 5 | N/A | 50 | 10 | N/A |
| Terrassement* | N/A | 60 | 50 | 30 | Complexe (−10) |

\* Le profil indiqué représente une **bande de 5 mètres** de la Structure concernée. `AA 10 l.28-53`

Notes narratives de quelques Structures : la **barge moyenne** mesure ~20 m (voile + rames, grosse cargaison) ; le **bateau de patrouille** ~25 m (rames pour les poursuites, voiles pour la patrouille, conçu pour encaisser) ; la **chaloupe** ≤10 m (bateau de pêche du Reikland, chaland de Marienburg) ; certains **chariots** de guerre peuvent, au gré du MJ, accorder une meilleure pénalité de Couvert ; la **clôture en clayonnage** est tressée de branches de saule (mieux pour les enclos que pour fortifier) ; la **diligence** est un véhicule fermé à 4 roues tiré par 2 à 6 chevaux ; la **herse** est une grille de fer abaissable ; le **mantelet** est une défense mobile sur supports/chariot ; le **mur de forteresse naine** est en pierre massive (plus résistant que le mur de château humain). `AA 10 l.55-92`

#### Attaquer une Structure

- Une Structure ne peut ni esquiver ni se déplacer : toute attaque **au corps à corps touche automatiquement**. `AA 10 l.94-95`
- Si la Structure est un **véhicule en mouvement**, ou si l'on vise un emplacement spécifique difficile à toucher, traiter l'attaque comme un **Tir ciblé à −20**. `AA 10 l.95`
- Attaquer au corps à corps le **conducteur d'un véhicule en mouvement** = Test opposé de **Corps à Corps** ; le conducteur peut opposer sa Compétence **Conduite d'attelage** s'il le désire. `AA 10 l.95`
- **Pénalité de Taille (armes inadaptées)** : épées/dagues ne sont pas conçues pour tailler une brèche dans un mur. Le MJ détermine la **Taille** de la Structure et compte son **Bonus d'Endurance une fois de plus par catégorie de Taille au-dessus de l'attaquant**. Exemple : un mur de pierre **Énorme** (BE 6) attaqué par un humain **Moyen** est traité avec un BE de **18** (6 × 3). **Les armes de siège ignorent cette restriction.** `AA 10 l.98`

#### Dégâts à une Structure (tir raté)

Les Structures n'ont **pas de Localisations de Dégâts**. Si l'on tire sur une cible à couvert dans/derrière la Structure et qu'on **rate**, le projectile peut toucher la Structure selon le nombre de Degrés d'échec :

| Degrés d'échec | Effet |
|---|---|
| 0 à −2 | Le tir rate la cible, mais **touche la Structure** et peut lui infliger des Dégâts. |
| −3 ou moins | Le tir rate la cible et **n'a aucun effet** sur la Structure. |

`AA 10 l.104-111`

#### Coups Critiques contre une Structure

Infliger un Critique à une Structure est bien plus difficile que contre un Personnage :
- Sur un **double**, la Structure risque un Critique, **uniquement si l'attaque retire aussi ≥ 25 % des Blessures restantes** de la Structure. `AA 10 l.113-114`
- Une fois les **Blessures à 0**, **tout** coup qui touche cause une Blessure Critique. `AA 10 l.114`
- Les Critiques affectent la Structure comme un Personnage ; toute circonstance qui **entraînerait la mort d'un Personnage** inflige une Blessure Critique d'**Effondrement** à la Structure. `AA 10 l.114`

#### Tableau des Blessures Critiques sur une Structure

| Résultat | Description | Blessures | Effets supplémentaires |
|---|---|---|---|
| 01-35 | *Ébréchée* | T | Choisir au hasard **un seul** Personnage sur la Structure ou l'utilisant comme couvert : il est frappé par des débris et subit des Dégâts = **Bonus d'Endurance de la Structure**. |
| 36-50 | *Secouée* | 1 | Tous ceux sur la Structure sont remués par l'impact : chaque Personnage sur/dans la Structure doit réussir un Test d'**Athlétisme Facile (+40)** sous peine de l'État *Surpris*. |
| 51-60 | *Percée* | 1 | Une petite brèche s'ouvre et amoindrit le couvert : une Structure à couvert **Complexe (−10)** ne fournit plus que **Intermédiaire (+0)**. |
| 61-70 | *Ébranlée* | 2 | Tous remués par l'impact : chaque Personnage sur/dans la Structure doit réussir un Test d'**Athlétisme Accessible (+20)** sous peine de l'État *À Terre*. |
| 71-80 | *Pluie d'échardes* | 2 | Tous les Personnages sur la Structure ou l'utilisant comme couvert sont frappés par des débris : Dégâts = **Bonus d'Endurance de la Structure**. |
| 81-90 | *Effondrement partiel* | 3 | Une partie importante s'écroule. Test d'**Athlétisme Intermédiaire (+0)** sous peine de chuter (Livre de Règles). La **Limite d'Encombrement est réduite de moitié** ; toute pièce d'artillerie/équipement lourd dont l'ENC dépasse désormais la Limite **tombe** et est inutilisable avant réparation. |
| 91-95 | *Enfoncée* | 3 | Un énorme trou s'ouvre : les Personnages sur/dans la Structure sont frappés par des débris (Dégâts = **Bonus d'Endurance de la Structure**). La Structure **ne fournit plus de couvert** à ceux dessus/dedans. |
| 96 ou plus | *Effondrement* | Détruite | La Structure entière s'écroule. Ceux qui s'en servaient de couvert subissent Dégâts = **Bonus d'Endurance de la Structure**. Les Personnages sur/dans la Structure font un Test d'**Athlétisme Intermédiaire (+0)** (chute), puis subissent des Dégâts **comme touchés par une arme avec une Force = Blessures restantes de la Structure**. Toute artillerie/équipement lourd tombe et est inutilisable avant réparation. |

`AA 10 l.116-128`

#### Réparer les Structures

- **Hors combat (permanent)** : Test de **Métier (Charpentier) Accessible (+20)** (bois) ou **Métier (Maçon) Accessible (+20)** (pierre). Chaque Test réussi prend **1d10 heures** et restaure **1d10 Blessures**. `AA 10 l.132`
- **En plein combat (réparation de fortune)** : Test **étendu** de **Métier (Charpentier) Très Difficile (−30)** (bois) ou **Métier (Maçon) Très Difficile (−30)** (pierre), requérant **20 DR** ; restaure **1d10 Blessures** à l'achèvement. `AA 10 l.133-134`
- La Compétence **Guérison n'a aucun effet** sur une Structure ; le MJ peut autoriser l'usage créatif de certains Sorts/Miracles à effet bénéfique. `AA 10 l.134`

### 2. Les Armes de Siège

Catégorie d'armes vaste et diverse, conçue contre des **formations de troupes ou de grosses cibles statiques**, pas des cibles individuelles. Toutes massives et puissantes, mais si lourdes et laborieuses à actionner qu'elles sont rarement utiles hors d'une action militaire sérieuse. `AA 10 l.136-138`

**Maniement / Compétences :** comme toute arme à distance, il faut être formé au **groupe d'armes** concerné. `AA 10 l.142`
- *Projectiles (Arbalète)* ne permet **pas** d'actionner un canon ni un canon feu d'enfer. `AA 10 l.142`
- Les **catapultes** exigent **Projectiles (Catapulte)** (fonctionnement distinct). `AA 10 l.144`
- **Projectiles (Ingénierie)** permet de faire équipe sur une arme à **poudre noire** sans pénalité. `AA 10 l.146`
- Une **baliste** peut se tirer via **Projectiles (Arbalète)** (Capacité de Tir) : dans ce cas l'arme **perd tous ses Atouts** mais **conserve ses Défauts**. `AA 10 l.148`

**Munitions :** les armes de siège doivent utiliser des **munitions spéciales** dédiées — un canon ne tire pas de balle d'arquebuse, une baliste ne tire pas de carreau d'arbalète. `AA 10 l.150`

**Canon à répétition (recul) :** chaque tir, le tireur fait un Test de **Résistance Accessible (+20)** et subit **1 Blessure par Degré d'échec** (l'arme s'enfonce dans son épaule) ; sur un **Échec Stupéfiant**, il subit un Coup Critique à l'épaule (table Blessures Critiques au bras, ajustée). Une balle + sa charge de poudre est consommée à chaque tir d'une salve. `AA 10 l.163` `AA 10 l.165`

#### Tableau des Armes de Siège

| Arme | Prix | ENC | Disponibilité | Portée | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| **ARBALÈTE** | | | | | | |
| Baliste | 30 CO | 20 | Limitée | 150 | +12 | Pointue, Recharge 3, Arme d'équipe 2 |
| **CATAPULTE** | | | | | | |
| Catapulte (petite) | 20 CO | 25 | Limitée | 75 | +10 | Imprécise, Recharge 3, Arme d'équipe 2 |
| Catapulte (moyenne) | 40 CO | 40 | Limitée | 100 | +15 | Imprécise, Recharge 3, Arme d'équipe 3 |
| Catapulte (grande) | 60 CO | 65 | Limitée | 175 | +18 | Imprécise, Recharge 4, Arme d'équipe 4 |
| **INGÉNIERIE** | | | | | | |
| Batterie tonnerre de feu | 500 CO | 75 | Exotique | 185 | +12 | Explosion 5, Dangereuse, Imprécise, Recharge 6\*, Salve 9, Arme d'équipe 3 |
| Canon à répétition | 10 CO | 5 | Exotique | 50 | +9 | Dangereuse, Recharge 4, Salve 7 |
| Canon à répétition feu d'enfer | 500 CO | 85 | Exotique | 100 | +10 | Dangereuse, Recharge 4\*, Salve 9, Arme d'équipe 3 |
| **POUDRE NOIRE** | | | | | | |
| Canon (petit) | 40 CO | 30 | Limitée | 50 | +10 | Dangereuse, Recharge 4, Arme d'équipe 2 |
| Canon (moyen) | 100 CO | 50 | Exotique | 75 | +14 | Dangereuse, Recharge 6, Arme d'équipe 3 |
| Canon (grand) | 250 CO | 75 | Exotique | 150 | +16 | Dangereuse, Recharge 8, Arme d'équipe 4 |
| Mortier | 50 CO | 50 | Exotique | 100 | – | Recharge 4, Arme d'équipe 3 |
| Pierrier | 20 CO | 5 | Rare | 30 | +14 | Dangereuse, Recharge 4 |

\* **Recharger une arme à Atout *Salve* est laborieux** : l'Indice de Recharge ne recharge pas l'arme entièrement, il augmente de **1** l'Indice de *Salve* à chaque fois qu'il est atteint. Ex. : une batterie tonnerre de feu vide est à *Salve* 0 et nécessite Recharge 6 pour atteindre *Salve* 1, soit **9 × Recharge 6** pour la recharger entièrement à *Salve* 9. `AA 10 l.175-196`

> Note d'édition : le tableau source affiche les dernières lignes (canons à poudre noire, mortier, pierrier) avec un artefact de mise en page « … — p. N ». Pour les **canons et le mortier**, ce « — p. N » accole le Défaut **Recharge** à sa valeur de la colonne précédente (Recharge 4/6/8/4) puis donne l'**Indice d'Arme d'équipe** N (2/3/4/3) : « Arme d'équipe — p. 2 » = Recharge 4 + Arme d'équipe 2. Pour le **Pierrier** (arme à une seule personne, **sans** Atout *Arme d'équipe*), c'est le « **Dangereuse, Recharge — p. 4** » : le « — p. 4 » qui suit Recharge en est l'**Indice**, soit **Recharge 4**. L'entrée précédente avait par erreur calqué le Pierrier sur les canons et laissé « Recharge — » sans valeur — corrigé ici en **Recharge 4**. `AA 10 l.191-194`

#### Tableau des Munitions de Siège

| Arme / Munition | Prix | ENC | Disponibilité | Portée | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| **BALISTE** — Carreau | 4/– | 0 | Limitée | Comme l'arme | – | Perforante, Empaleuse |
| **BATTERIE TONNERRE DE FEU** — Missile | 5 CO | 1 | Exotique | Comme l'arme | – | – |
| **CANON** — Boulet et poudre | 8/– | 1 | Limitée | Comme l'arme | – | Explosion 2, Percutante |
| **CANON** — Mitraille et poudre | 6/6 | 0 | Exotique | Quart de l'arme | −2 | Tir de zone 5 |
| **CANON À RÉPÉTITION** — Balle et poudre (12) | 3/3 | 0 | Commune | Comme l'arme | +1 | Empaleuse, Perforante |
| **CANON À RÉPÉTITION FEU D'ENFER** — Balle et poudre | 8/– | 1 | Limitée | Comme l'arme | – | Explosion 2, Percutante |
| **CATAPULTE** — Bombe incendiaire | 1 CO | 0 | Limitée | Moitié de l'arme | Spécial\*\* | Explosion 4, Dangereuse |
| **CATAPULTE** — Carcasse d'animal | N/A | 0 | Commune | Moitié de l'arme | Spécial\* | Explosion 3 ou Explosion 20 |
| **CATAPULTE** — Rocher | 8/– | 1 | Commune | Comme l'arme | – | Dévastatrice, Percutante |
| **MORTIER** — Bombe | 3 CO | 0 | Rare | Comme l'arme | +12 | Explosion 5, Dangereuse, Percutante |
| **MORTIER** — Bombe incendiaire | 1 CO | 0 | Limitée | Moitié de l'arme | Spécial\*\* | Explosion 4, Dangereuse |
| **PIERRIER** — Balles et poudre (pour 1 tir) | 2/2 | 0 | Commune | Comme l'arme | +1 | Empaleuse, Perforante, Tir de zone 3 |
| **PIERRIER** — Petites munitions et poudre (pour 1 tir) | 2/2 | 0 | Commune | Comme l'arme | – | Tir de zone 6 |

\* **Carcasse d'animal** : Dégâts +4 à tous ceux dans la zone d'*Explosion 3*. De plus, toutes les cibles dans la zone d'*Explosion 20* doivent réussir un Test de **Résistance Très Facile (+60)** sous peine de subir une **Blessure Purulente** (Livre de Règles p.186). `AA 10 l.222`
\*\* **Bombe incendiaire** : n'inflige pas de Dégâts ; confère à toutes les cibles affectées **DR +1 États *En flammes***. `AA 10 l.224`

`AA 10 l.198-221`

### 3. Défaut d'arme : *Arme d'équipe*

Une arme à *Arme d'équipe* est si imposante, lourde et complexe qu'elle ne fonctionne bien que **gérée par une équipe**, pas par une seule personne. Tous les membres doivent posséder la **Compétence Projectiles appropriée** pour participer ; ils peuvent **nommer l'un d'eux** pour effectuer le Test de Projectiles déterminant l'efficacité du tir (typiquement le plus compétent). Un membre ne possédant pas le bon groupe d'armes (ex. *Projectiles (Arc)* sur une baliste du groupe Arbalète) **ne compte pas** dans l'équipe → équipe incomplète. `AA 10 l.227-231`

La plupart des armes ont une équipe de **2, 3 ou 4**. Les membres au-delà de l'Indice n'améliorent pas l'arme mais peuvent la déplacer ou compenser les pertes en plein combat. `AA 10 l.232`

#### Table des pénalités d'équipe incomplète

| Équipe présente | Arme d'équipe 2 | Arme d'équipe 3 | Arme d'équipe 4 |
|---|---|---|---|
| 4 | N/A | N/A | N/A |
| 3 | N/A | N/A | Temps de recharge doublé |
| 2 | N/A | Temps de recharge doublé | Reçoit le Défaut *Imprécise* |
| 1 | Temps de recharge doublé | Reçoit le Défaut *Imprécise* | Reçoit le Défaut *Dangereuse* |

`AA 10 l.236-241`

**Cumul :** les pénalités de sous-effectif sont **cumulatives** — une Arme d'équipe 4 maniée par **une seule** personne voit son temps de recharge doublé **et** reçoit *Imprécise* **et** *Dangereuse*. `AA 10 l.243`

**Doublon de Défaut :** si l'arme reçoit un Défaut qu'elle possède **déjà**, appliquer à la place une **pénalité −10** sur tous les Tests de Projectiles pour tirer (ex. : von Meinkopt seul sur un grand canon — Arme d'équipe 4, déjà Dangereuse — recharge 8→16, reçoit *Imprécise*, et −10 au lieu d'un second *Dangereuse*). `AA 10 l.233` `AA 10 l.245`

**Autres précisions :**
- Recharger une Arme d'équipe : un membre peut apporter son **Soutien** sur les Tests déterminant le temps de recharge. `AA 10 l.247`
- Si une Arme d'équipe subit un **Incident de tir**, **tous** les membres de l'équipe sont affectés. `AA 10 l.249`

### 4. Atout d'arme : *Salve*

Une arme à *Salve* peut projeter ses munitions **une à une ou par volées**. L'**Indice de Salve** indique le nombre de tirs disponibles ; chaque tir réduit l'Indice de 1, et l'arme **ne nécessite un rechargement que lorsque l'Indice tombe à 0**. `AA 10 l.254-257`

**Tirs multiples dans le Round :** une arme à *Salve* peut tirer **plusieurs fois par Round**, mais **chaque tir après le premier** impose une pénalité **cumulative de −10** à la Compétence Projectiles. (Ex. batterie tonnerre de feu *Salve 9* : 1er tir au plein score, 2e à −10, 3e à −20, 4e à −30 ; au Round suivant on repart à 0 de pénalité, mais le décompte de l'Indice de Salve persiste — 5e tir global = −40, et l'arme tombée à *Salve 0* doit être rechargée.) `AA 10 l.262` `AA 10 l.266-268`

Si l'arme subit un **Incident de tir** à n'importe quel moment, en résoudre les effets puis lancer dans la table suivante. `AA 10 l.264`

#### Tableau des Incidents de Tir d'Artillerie par Salve

| Résultat du d10 | Effet |
|---|---|
| 1-4 | Tous les membres de l'équipe subissent les Dégâts à la **Localisation de leur bras principal**, en utilisant le **dé des unités comme DR pour toucher**. La pièce d'artillerie est **détruite**. |
| 5-7 | Tous les membres de l'équipe subissent les Dégâts à une **Localisation tirée au hasard** (dé des unités = DR pour toucher). La pièce d'artillerie est **détruite**. |
| 8-9 | **Pour chaque Indice de *Salve* restant**, tous les membres de l'équipe subissent les Dégâts à une Localisation tirée au hasard (dé des unités = DR pour toucher). La pièce d'artillerie est **détruite**. |
| 10 | **Pour chaque Indice de *Salve* restant**, un tir part dans une direction tirée au hasard sur une distance d'**1d100 mètres**. Tout Personnage entre la machine et les points d'impact doit réussir un Test d'**Esquive Très Difficile (−30)** pour éviter d'être touché par un projectile. |

`AA 10 l.270-276`

**Sources RAW** :
- `AA 10 l.3-25` — Cadre des règles (renvoi au combat de masse d'ADE II) ; définitions ENC / Limite d'Encombrement / Pénalité de Couvert ; renvoi aux Compagnons T1 (véhicules) et T2 (navires) pour leurs Dégâts dédiés.
- `AA 10 l.28-53` — Tableau des Structures Courantes (véhicules, navires fluviaux, fortifications) ; note « bande de 5 m » pour les Structures marquées \*.
- `AA 10 l.55-92` — Descriptions narratives de chaque Structure (barge, patrouilleur, chaloupe, chariots, charrettes, clayonnage, diligence, herse, mantelet, murs, palissade, porte renforcée, terrassement).
- `AA 10 l.94-98` — Attaques contre les Structures : auto-touche en mêlée, véhicule en mouvement = Tir ciblé −20, conducteur = Test opposé CC/Conduite d'attelage, pénalité de Taille (BE ×N), exception des armes de siège.
- `AA 10 l.101-111` — Dégâts aux Structures (Endurance/Blessures, bandes de mur de 5 m), absence de Localisations, table « tir raté » Degrés d'échec 0 à −2 / −3 ou moins.
- `AA 10 l.113-128` — Critiques sur Structure (double + ≥25 % Blessures retirées ; tout coup à 0 Blessure ; Effondrement = « mort ») + Tableau des Blessures Critiques sur une Structure (Ébréchée → Effondrement).
- `AA 10 l.131-134` — Réparation : Métier (Charpentier/Maçon) Accessible (+20) hors combat (1d10 h / 1d10 Blessures), Très Difficile (−30) en combat (20 DR) ; Guérison sans effet.
- `AA 10 l.136-150` — Règles générales des Armes de Siège : groupes d'armes requis, baliste via Projectiles (Arbalète) sans Atouts, munitions spéciales obligatoires.
- `AA 10 l.152-173` — Descriptions des armes de siège (baliste, batterie tonnerre de feu, canons, canon à répétition + recul Résistance Accessible/Critique épaule, catapulte, mortier, canon feu d'enfer, pierrier).
- `AA 10 l.175-196` — Tableau des Armes de Siège (stats complètes + note de rechargement des armes à Salve).
- `AA 10 l.191-194` — Artefact de mise en page « — p. N » des canons/mortier/pierrier : N = Indice d'Arme d'équipe (canons) ; pour le Pierrier (sans Arme d'équipe), le « — p. 4 » qualifie Recharge = **Recharge 4**.
- `AA 10 l.198-224` — Tableau des Munitions de Siège + notes carcasse d'animal (Blessure Purulente) et bombe incendiaire (DR +1 *En flammes*).
- `AA 10 l.227-249` — Défaut *Arme d'équipe* : équipe/nomination, table des pénalités d'équipe incomplète, cumul, doublon de Défaut (−10), Soutien au rechargement, Incident affecte toute l'équipe.
- `AA 10 l.254-276` — Atout *Salve* : Indice/rechargement, tirs multiples −10 cumulatif/Round, et Tableau des Incidents de Tir d'Artillerie par Salve (d10).

> « toute attaque au corps à corps portée contre une Structure touche automatiquement. Si la Structure est un véhicule qui se déplace ou si un Personnage veut attaquer un emplacement spécifique difficile à toucher, considérez l'attaque comme un Tir ciblé à -20. » — `AA 10 l.96`

> « la Structure risque de subir un Coup Critique, mais c'est uniquement le cas si l'attaque retire aussi au moins 25 % des Blessures restant à la Structure. En revanche, tous les coups qui touchent une fois que les Blessures de la Structure sont tombées à 0 causent des Blessures Critiques. » — `AA 10 l.114`

> « les pénalités infligées par un sous-nombre de l'équipe Arme sont cumulatives... une arme dotée d'd'équipe 4, mais qui n'est maniée que par une seule personne voit son temps de recharge doublé et reçoit les Défauts Imprécise et Dangereuse. » — `AA 10 l.243`

> « Pierrier | 20 CO | 5 | Rare | 30 | +14 | Dangereuse, Recharge 4 » — `AA 10 l.193` (Recharge 4, le Pierrier n'ayant pas d'Atout *Arme d'équipe*)

**Voir aussi** : AA : Qualités et Défauts d'armes (Imprécise, Dangereuse, Recharge, Salve, Tir de zone, Explosion, Empaleuse, Perforante, Percutante, Dévastatrice, Pointue, Pointe d'arme) ; LDB 13 : Combat (Tir ciblé, DR, doubles/Critiques) ; LDB 18 : Traumatisme (Localisations, Blessures Critiques au bras) ; LDB 16 : États (*Surpris*, *À Terre*, *En flammes*) ; LDB 14 : Taille (catégories, modificateurs de Taille de cible) ; ADE II : Combat de masse (grandes batailles).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `AA 10` (l.3-25, l.28-53, l.55-92, l.94-98, l.101-111, l.113-128, l.131-134, l.136-150, l.152-173, l.175-196, l.198-224, l.227-249, l.254-276) → `ArtilleryMisfireEntry`, `StructureCritEntry`, `artillery-misfire`, `structure-criticals`, `warMachineCrewPenalty`, `woundsFromHit`, `rollArtillerySalveMisfire`, `couvertDepuisDifficulte`, `CrewTooltip`, `hoverTargeting`, +94 — `src/data/artillery-misfire.json`, `src/data/artilleryMisfire.ts`, `src/data/combat-stakes.json`, `src/data/index.ts`, `src/data/props.json`, `src/data/qualities.json`, +43 fichiers

---

## AA : Rompre le combat et Poursuites détaillées

Le supplément *Aux Armes* (« La Poursuite de l'Excellence ») clarifie et étend les règles du **Livre de Base** (p. 165 pour Rompre le Combat, p. 166 pour les Poursuites) : il en redonne un résumé, puis ajoute un **système de Poursuite complexe** chiffré en mètres pour les cas où les participants ont des Mouvements inégaux ou quand la performance de chaque individu compte. Aucune valeur ci-dessous n'est inventée : tout est tiré des passages cités.

### Rompre le Combat — les trois méthodes

Un combattant peut **se désengager sans risque** de trois manières (AA résume ici les règles du LDB p. 165) :

- **Utiliser l'Avantage** : si vous disposez de **plus d'Avantages que votre adversaire**, vous pouvez faire **tomber vos Avantages à 0** et vous éloigner **sans pénalité**.
- **Utiliser Esquive** : réussissez un **Test opposé d'Esquive / Corps à corps**. En cas de **succès**, vous gagnez **+1 Avantage** et pouvez utiliser votre **Mouvement** pour vous déplacer n'importe où selon les règles normales. En cas d'**échec**, **chaque adversaire** gagne **+1 Avantage** et vous êtes **cloué sur place**.
- **Fuir** : avec votre Mouvement, vous tournez les talons et fuyez. Votre adversaire gagne **+1 Avantage** et peut tenter une **attaque gratuite**. Cette attaque gratuite est un **Test de Corps à corps non opposé** avec l'arme que l'ennemi tient actuellement, **avec +20 pour toucher**. **Si vous êtes touché**, l'opposant gagne **+1 Avantage** et vous devez réussir un **Test de Calme Intermédiaire (+0)** sous peine de recevoir **1 État _Brisé_, plus 1 État _Brisé_ supplémentaire par DR en dessous de 0**. Une fois l'attaque gratuite résolue, vous pouvez vous déplacer jusqu'à la **limite de votre Mouvement de Course** dans la direction opposée à votre adversaire.

### Poursuite simple (résumé du LDB p. 166)

La **Cible** est la personne (ou le groupe) poursuivie ; le **Poursuivant** est celui qui tente de l'atteindre. Quatre étapes :

1. **Déterminer la Distance** : le MJ choisit un nombre représentant l'avance de la Cible sur le Poursuivant. La **Distance va de 0 (Cible attrapée) à 10 (Cible échappée)**. Repères : **1** = presque à portée ; **4** = avance confortable ; **8** = il faudra beaucoup d'efforts pour se rapprocher.
2. **Effectuer un Test** : chaque participant effectue un Test pour son Mouvement — **Athlétisme** à pied, **Chevaucher** sur monture, **Conduite d'attelage** dans un véhicule (diligence, chariot…).
3. **Actualiser la Distance** : on compare le **DR le plus petit de la Cible** au **DR le plus haut du Poursuivant** ; la différence est **ajoutée** à la Distance si la Cible l'emporte, **retranchée** si le Poursuivant l'emporte. Égalité → Distance inchangée.
4. **Déterminer l'issue** : si la Distance tombe à **0 ou moins**, le Poursuivant rejoint la Cible (celle-ci peut, ce Round, sacrifier le plus lent de son groupe pour ralentir le Poursuivant, ou un membre peut se porter volontaire pour s'arrêter et l'affronter ; un Poursuivant en groupe décide qui s'arrête et qui continue). Si la Distance atteint **10 ou plus**, le Poursuivant a perdu sa Cible et la Poursuite s'achève.

**Modificateurs de Mouvement** : un participant avec un Mouvement supérieur gagne **autant de DR bonus que la différence de Mouvement** (Mouvement 5 poursuivant un Mouvement 4 → **+1 DR**).

### Poursuite complexe

Pour les Poursuites où les Mouvements diffèrent ou où la performance individuelle compte, le MJ suit chaque Personnage comme un individu et la **Distance est chiffrée en mètres** : **chaque point de Distance = 10 mètres**.

**1. Déterminer la Distance** entre le membre le plus proche de la Cible et le Poursuivant le plus proche. La Distance va de **0 (Cible attrapée)** au **seuil d'échappement** fixé par l'environnement (ci-dessous). Plus les lieux sont encombrés, plus le seuil à atteindre pour s'échapper est **faible**.

| Environnement dans lequel la poursuite a lieu | Distance nécessaire pour s'échapper |
|---|---|
| Rues d'une ville grouillant de monde, égouts labyrinthiques, dédale de haies | 3 |
| Montagnes escarpées, forêt dense, marécage brumeux | 5 |
| Petit village, forêt clairsemée, marais | 7 |
| Prairie à arbustes, collines peu élevées, plage rocheuse | 10 |
| Désert totalement lisse, steppe herbeuse, plateau calcaire | 13 |

*— `AA 10 l.314-320` (Table de Seuil de Fuite selon l'Environnement)*

Si la Cible est en **groupe très resserré**, tous ses membres sont à la même Distance ; mais dès qu'un membre prend une avance de **plus de 16 mètres** sur un Poursuivant ou sur un autre membre de son groupe, on calcule sa **Distance individuelle**. Les Poursuivants forment un seul grand groupe s'ils ont tous le même Mouvement, ou se divisent en petits groupes selon leur Mouvement ou leur capacité à réussir les Tests.

**2. Effectuer un Test et actualiser la Distance** : **par ordre d'Initiative**, chaque participant effectue un Test pour son Mouvement, **avec un bonus de +20** : **Athlétisme Accessible (+20)** à pied, **Chevaucher Accessible (+20)** sur monture, **Conduite d'attelage Accessible (+20)** en véhicule. Les Personnages à **faible Mouvement** subissent des **pénalités** sur leurs Tests d'Athlétisme de Poursuite complexe :

- **Mouvement 3** → Test d'**Athlétisme Intermédiaire (+0)**
- **Mouvement 2** → Test d'**Athlétisme Difficile (–20)**
- **Mouvement 1** → Test d'**Athlétisme Très Difficile (–30)**

Le résultat du Test (DR) détermine la progression du Personnage ce Round :

| DR | Effet |
|---|---|
| **4 ou plus** | Le Personnage **pique un sprint** du nombre de mètres qu'il peut normalement parcourir en **courant** (ou en chevauchant / conduisant). Divisez ce nombre par 10, **arrondi à l'inférieur, minimum 1**. **Ce nombre +1** est la Distance parcourue ce Round. |
| **+0 à 3** | Le Personnage **court** du nombre de mètres qu'il peut normalement parcourir en courant. Divisez par 10 pour la Distance parcourue, **arrondi à l'inférieur, minimum 1**. |
| **–0 à –2** | Le Personnage est **bloqué / doit contourner un objet / surveiller où il met les pieds**. Il franchit prudemment le nombre de mètres de course, divisé par 10, **arrondi à l'inférieur, minimum 1** ; **ce nombre –1** est la Distance parcourue ce Round. |
| **–3 à –4** | Le Personnage **s'arrête brutalement** pour éviter de tomber. **Il ne progresse pas** ce Round. |
| **–5 ou moins** | Le Personnage **trébuche / tombe de cheval** (calamité similaire). Déterminez si la chute cause des Dégâts (LDB p. 166) ; le Personnage subit ensuite l'**État _À Terre_**. |

*— `AA 10 l.333-344` (Table de Progression d'un Personnage en Poursuite Complexe)*

À ce stade, si un Poursuivant réduit la Distance avec un membre de la Cible à **0**, il décide de le **charger** (déclenche le combat) ou de le **dépasser** pour attraper un membre situé plus loin.

**3. Déterminer l'issue** : recalculez les Distances selon les performances, puis revenez à l'étape 2.

### Mouvement gêné

Pendant une Poursuite, un Personnage qui subit l'État **_À Terre_** ou **_Empêtré_** (ou qui perd la capacité de se déplacer librement pour toute autre raison) **perd sa prochaine occasion d'effectuer un Test** pour augmenter sa Distance : il passe ce temps à se libérer, et peut devoir effectuer un Test pour cela.

### Obstacles

Le MJ peut placer des **obstacles** sur le chemin (caisses de laine, flaques de boue, grilles fermées, troupeau de bétail…) qui compliquent la course de la Cible **comme** des Poursuivants. Procédure :

- Le MJ décide à **quelle Distance** se trouve l'obstacle par rapport au membre en tête de la Cible, et s'il est **facile à percevoir** ou non. Les Personnages qui le repèrent peuvent **changer de trajectoire** (si l'environnement le permet) ou le **négocier** dans l'espoir qu'il retarde ensuite les Poursuivants.
- L'obstacle est traité comme un **participant à la Poursuite qui ne se déplace pas**. Chaque fois que la Distance entre l'obstacle et un participant atteint **0**, ce participant doit **s'arrêter** ou **négocier l'obstacle**.
- Le MJ décide quels **Tests** négocient l'obstacle et quelle **pénalité** sanctionne l'échec. Le tableau suppose des participants **à pied** ; le MJ invente d'autres Tests/conséquences pour les montés ou en véhicule.

**Créer des Obstacles** : pendant son tour, un membre du groupe de la Cible peut tenter de créer un obstacle, soit par un **Test de Perception** (repérer quelque chose d'utile dans l'environnement ; la Difficulté dépend du lieu — impossible dans un désert, l'embarras du choix sur un marché bondé), soit en **lâchant une Possession appropriée** (quelque chose de pointu ou de glissant). S'il trouve un obstacle, il effectue un **Test d'Athlétisme Intermédiaire (+0)** pour le déployer : **succès** → il dépose l'obstacle sur la trajectoire des Poursuivants **sans perdre de vitesse** ; **échec** → il peut perdre du Mouvement ou même **s'empêtrer dans son propre obstacle**.

| Obstacle | Perçu | Test pour négocier | Conséquences d'un échec sur le Test |
|---|---|---|---|
| Gros rondin | Automatiquement | Test d'**Athlétisme Accessible (+20)** | Le participant ou sa monture subit l'État **_À Terre_**. |
| Tas de foin | Automatiquement | Test d'**Escalade Difficile (–20)** | Le participant s'enfonce dans le foin et est considéré comme **_Empêtré_** contre un adversaire doté d'une Force de **2d10+20**. |
| Flaque d'eau sale | Test de **Perception** | Test d'**Athlétisme Accessible (+20)** si l'obstacle est perçu, Test d'**Athlétisme Difficile (–20)** sinon | Le participant est copieusement arrosé d'eau sale : **–2 DR sur tous ses Tests basés sur la Sociabilité** jusqu'à ce qu'il puisse se nettoyer. |
| Caisses de marchandises | Automatiquement | Test d'**Athlétisme Intermédiaire (+0)** | Le participant ou sa monture subit l'État **_À Terre_**. **2d10** unités de marchandises sont cassées. |
| Grille fermée | Automatiquement | Test d'**Escalade Difficile (–20)** | Le participant ne peut pas se déplacer ce Round, mais peut réessayer au Round suivant. Cependant, en cas d'**Échec Impressionnant**, il subit une **chute de 2 mètres**. |
| Nid-de-poule | Test de **Perception** | Test d'**Athlétisme Facile (+40)** si l'obstacle est perçu, Test d'**Athlétisme Difficile (–20)** sinon | Le participant subit la **Blessure Critique _Cheville tordue_**. |
| Sables mouvants | Test de **Perception** | Test d'**Athlétisme Facile (+40)** si l'obstacle est perçu, Test d'**Athlétisme Difficile (–20)** sinon | Le participant s'enlise : **_Empêtré_** contre un adversaire de Force **1d10+20**. S'il ne se libère pas en 1 Round, l'adversaire passe à Force **2d10+20** ; ce processus se poursuit **6 Rounds**, la Force de l'adversaire augmentant d'**1d10 à chaque Round**. Toujours _Empêtré_ après 6 Rounds → **Test de Calme Intermédiaire (+0)** pour ne pas empirer ; échec → Test pour savoir s'il commence à se noyer. |
| Passage d'un troupeau de chèvres | Automatiquement | Test d'**Athlétisme Difficile (–20)** | Le participant prend un coup porté par **Arme (Cornes) +6** (des chèvres enragées lui rentrent dedans). |
| Seau rempli d'entrailles de poisson | Automatiquement | Test d'**Athlétisme Facile (+40)** | Si le participant trébuche sur le seau, il subit l'État **_À Terre_** et laisse derrière lui une grosse flaque d'entrailles de poisson en fermentation. |
| Flaque d'entrailles de poisson | Automatiquement | Test d'**Athlétisme Difficile (–20)** | Le participant perd l'équilibre : État **_À Terre_** et **–2 DR sur tous ses Tests basés sur la Sociabilité** jusqu'au nettoyage. S'il a des **blessures non traitées** peu avant/après le contact, il doit effectuer un Test pour savoir si elles deviennent des **Blessures Purulentes**. |
| Lattes de plancher pourries | Test de **Perception Difficile (–20)** | Test d'**Athlétisme Accessible (+20)** si l'obstacle est perçu, Test d'**Athlétisme Très Difficile (–30)** sinon | Le participant passe au travers des lattes pourries : **chute de 3 mètres**. |
| Ouvrier sur une échelle | Automatiquement | Test d'**Athlétisme Facile (+40)** | Si le participant trébuche sur l'échelle, il subit l'État **_À Terre_**. Le MJ doit effectuer un Test d'**Athlétisme Difficile (–20)** pour le travailleur ; en cas d'échec, ce dernier fait une **chute d'1d10 mètres**. |
| Charrette laissée sans surveillance | Automatiquement | Test d'**Escalade Accessible (+20)** | Le participant glisse vers l'arrière en tentant d'escalader la charrette : coincé ce Round, peut retenter au Round suivant. |
| Charrette laissée sans surveillance remplie de choux | Automatiquement | Test d'**Escalade Intermédiaire (+0)** | Le participant glisse vers l'arrière en escaladant, faisant tomber un torrent de choux. **Test d'Initiative Accessible (+20)** sous peine de subir l'État **_Surpris_**. L'obstacle devient **deux obstacles** : une charrette laissée sans surveillance et une pile de choux éparpillés. |
| Pile de choux éparpillés | Automatiquement | Test d'**Athlétisme Difficile (–20)** | Le participant trébuche sur les choux : **chute d'1 mètre** et État **_À Terre_**. |

*— `AA 10 l.386-406` (Table des Obstacles de Poursuite)*

### Épuisement

Les participants repoussent leurs limites d'endurance ; la fatigue peut s'installer. Le MJ **note combien de Rounds** dure la Poursuite. Chaque fois qu'un participant court pendant un certain nombre de **Rounds consécutifs**, il doit réussir un **Test de Résistance** pour éviter l'épuisement. Ce nombre de Rounds est fixé par le MJ **individuellement** (en tenant compte d'une forte charge, d'un véhicule lourd, d'une maladie ou blessure…) ; le tableau ci-dessous donne la **fréquence et la Difficulté conseillées**.

Un participant (ou sa monture / animal de trait) qui **rate** son Test de Résistance subit un État **_Exténué_**. Un **animal** veut alors **passer au pas** dès qu'il reçoit _Exténué_, mais on peut le persuader de continuer à galoper en réussissant un **Test d'Emprise sur les animaux Intermédiaire (+0)**, un **Test de Chevaucher Complexe (–10)** ou un **Test de Conduite d'attelage Difficile (–20)**.

| Rounds | À pied | Monté (monture) | Véhicule (animaux de trait) |
|---|---|---|---|
| 10 | Test de **Résistance Très Facile (+60)** | – | – |
| 15 | Test de **Résistance Facile (+40)** | Test de **Résistance Très Facile (+60)** pour la monture | – |
| 18 | Test de **Résistance Accessible (+20)** | – | Test de **Résistance Très Facile (+60)** pour les animaux de trait |
| 20 | Test de **Résistance Intermédiaire (+0)** | Test de **Résistance Facile (+40)** pour la monture | – |
| 21 | Test de **Résistance Complexe (–10)** | – | – |
| 22 | Test de **Résistance Difficile (–20)** | Test de **Résistance Accessible (+20)** pour la monture | Test de **Résistance Facile (+40)** pour les animaux de trait |
| 23 | Test de **Résistance Très Difficile (–30)** | – | – |
| 24 | Test de **Résistance Presque Impossible (–40)** | Test de **Résistance Intermédiaire (+0)** pour la monture | – |
| 25 | Test de **Résistance Impossible (–50)** | – | Test de **Résistance Accessible (+20)** pour les animaux de trait |
| 26 | Test de **Résistance Plus qu'Impossible (–60)** | Test de **Résistance Complexe (–10)** pour la monture | – |

*— `AA 10 l.408-421` (Table d'Épuisement en Poursuite)*

### Conversion Combat → Poursuite

Si un guerrier rompt le combat mais que son opposant veut **toujours l'engager**, le Personnage qui a rompu le combat peut choisir de devenir la **Cible d'une Poursuite**. Son **avance initiale dépend de la méthode de rupture** :

| Méthode | Poursuite simple | Poursuite complexe |
|---|---|---|
| **Utiliser l'Avantage** | La Cible commence avec une avance de **1 Distance par Avantage dépensé** en se Désengageant (3 Avantages dépensés → avance de **3**). | La Cible commence avec une avance de **1 Distance** ; si elle a dépensé **au moins 3 Avantages** en se Désengageant, cette avance passe à **2**. |
| **Utiliser Esquive** | La Cible commence avec une avance de **1 Distance**. | La Cible commence avec une avance de **1 Distance**. |
| **Fuir** | Si l'adversaire **porte** l'attaque gratuite, la Cible commence avec une avance de **3**. S'il **renonce** à son attaque gratuite pour poursuivre tout de suite, la Cible commence avec une avance de **1**. | La Cible effectue un **Test d'Athlétisme** (comme à l'étape « Effectuer un Test et actualiser la Distance » de la Poursuite complexe) ; son **résultat détermine la Distance initiale**. Si l'adversaire **a saisi** l'attaque gratuite, la Cible ajoute **+2 DR** à ce Test d'Athlétisme. |

*— `AA 10 l.427-434` (Table de Distance Initiale selon mode de désengagement)*

**Sources RAW** :
- `AA 10 l.284-292` — **Rompre le Combat** : résumé AA des 3 méthodes du LDB p. 165 (Avantage → 0 sans pénalité ; Esquive opposée → +1 Avantage + Mouvement libre / échec → adversaires +1 Avantage + cloué ; Fuir → adversaire +1 Avantage + attaque gratuite Corps à corps non opposée **+20**, si touché +1 Avantage + Calme Intermédiaire (+0) sinon **Brisé +1 par DR négatif**, puis Mouvement de Course à l'opposé).
- `AA 10 l.294-304` — **Poursuite simple** (résumé LDB p. 166) : Distance 0–10, Test Athlétisme/Chevaucher/Conduite, comparaison DR (min Cible vs max Poursuivant), issue à 0 / 10+, +1 DR par point de Mouvement supérieur.
- `AA 10 l.306-348` — **Poursuite complexe** : Distance en mètres (1 point = 10 m), seuils d'échappement par environnement, Test +20 par ordre d'Initiative, pénalités Mouvement ≤ 3, table de Progression (sprint / course / gêné / arrêt / À Terre), seuil de 16 m pour la Distance individuelle.
- `AA 10 l.314-320` — **Table de Seuil de Fuite selon l'Environnement** (3 / 5 / 7 / 10 / 13).
- `AA 10 l.333-344` — **Table de Progression d'un Personnage en Poursuite Complexe** (par bande de DR).
- `AA 10 l.350-352` — **Mouvement gêné** : _À Terre_ / _Empêtré_ → perte de la prochaine occasion de Test, temps passé à se libérer.
- `AA 10 l.355-372` — **Obstacles** : obstacle = participant fixe, Test de négociation à Distance 0, perception facile ou non, changement de trajectoire ; **Créer des Obstacles** (Test de Perception + Athlétisme Intermédiaire (+0)).
- `AA 10 l.386-406` — **Table des Obstacles de Poursuite** (rondin, tas de foin, flaque d'eau sale, caisses, grille, nid-de-poule, sables mouvants, troupeau de chèvres, seau/flaque d'entrailles, lattes pourries, ouvrier sur échelle, charrettes, pile de choux).
- `AA 10 l.375-383` — **Épuisement** : Test de Résistance tous les N Rounds (fréquence/difficulté MJ), État _Exténué_ à l'échec, animaux veulent passer au pas (relançables par Emprise +0 / Chevaucher –10 / Conduite –20).
- `AA 10 l.408-421` — **Table d'Épuisement en Poursuite** (Rounds × à pied / monté / véhicule).
- `AA 10 l.422-424` — **Conversion Combat → Poursuite** : l'opposant veut toujours engager → la cible devient Cible d'une Poursuite, avance selon la méthode de rupture.
- `AA 10 l.427-434` — **Table de Distance Initiale selon mode de désengagement** (Avantage / Esquive / Fuir × Poursuite simple / complexe).

> « Si vous êtes touché, votre opposant gagne +1 Avantage et vous devez réussir un Test de **Calme Intermédiaire (+0)** sous peine de recevoir un État _Brisé_ +1 État _Brisé_ supplémentaire par DR en dessous de 0. » — `AA 10 l.292`

> « Chaque point de Distance représente 10 mètres. » — `AA 10 l.312`

> « si n'importe lequel d'entre eux a une avance de plus de 16 mètres sur un Poursuivant ou sur un autre Personnage du groupe de la Cible, calculez sa Distance individuelle par rapport aux Poursuivants de manière appropriée. » — `AA 10 l.324`

**Voir aussi** : États (_Brisé_, _À Terre_, _Empêtré_, _Exténué_, _Surpris_) ; Avantage ; Engagement et désengagement (LDB) ; Déplacement et Course ; Tests de Calme / Résistance / Athlétisme ; Combat monté et véhicules.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `AA 10` (l.284-292, l.422-424, l.427-434) → `ArtilleryMisfireEntry`, `artillery-misfire`, `rollArtillerySalveMisfire`, `combat-aa-avantage-groupe`, `salve`, `applyOups` — `src/data/artillery-misfire.json`, `src/data/artilleryMisfire.ts`, `src/data/qualities.json`, `src/data/reglesOptionnelles.json`, `src/engine/artilleryMisfire.ts`, `src/state/combatFlow.ts`
- sans code : `AA 10` (l.292, l.294-304, l.306-348, l.350-352, l.355-372, l.375-383, l.386-406, l.408-421)
- dette : #511

---

## AA : système d'Avantage de Groupe

> **Règle optionnelle** (Annexe I d'*Aux Armes*). Remplace le système d'Avantage **individuel** du Livre de Base (où chaque combattant accumule ses propres Avantages et les convertit en bonus de +10 sur ses jets) par un système où l'Avantage devient **une ressource d'équipe** : il ne donne plus automatiquement de bonus, mais s'accumule dans deux réserves mutualisées et se **dépense** à un moment décisif pour décrocher la victoire.

### Principe : deux réserves mutualisées

Les Avantages ne sont plus accumulés par chaque Joueur ou PNJ individuellement. Ils sont acquis et stockés dans l'une de **deux réserves** :

- **Réserve des alliés** : tout Avantage généré par un Personnage (Joueur) **ou** par un PNJ allié y est placé.
- **Réserve des adversaires** : tout Avantage généré par un PNJ **hostile ou neutre** y est placé.

L'Avantage représente l'élan gagné pendant le combat en l'emportant sur ses adversaires et en les contrant. Il ne s'applique plus comme bonus automatique : c'est une ressource générée par le travail d'équipe et dépensée volontairement.

### Obtenir un Avantage de Groupe

Ces méthodes **modifient** les règles d'obtention d'Avantage de la page 164 du Livre de Règles. Un combattant obtient un Avantage chaque fois qu'il remporte un Test opposé en combat, qu'il attaque depuis une position lui conférant un avantage tactique, ou lorsqu'il est plein d'espoir. La liste suivante n'est pas exhaustive — le MJ gère les pions Avantage selon les circonstances :

- **Surprise** : attaquer un ennemi Surpris confère **+1 Avantage**.
- **Évaluer** : utiliser une de vos Compétences pour obtenir un avantage tactique → **+2 Avantages** ; si le Test est un Succès avec **6 DR ou plus** → **+3 Avantages**.
- **Victoire** : venir à bout d'un PNJ important → **au moins +1 Avantage** ; maîtriser la **némésis** d'un groupe peut accorder **jusqu'à +2 Avantages** (décision du MJ).
- **Gagnant** : remporter un Test opposé **que vous avez déclenché** en combat → **+1 Avantage**.
- **Prendre le dessus** : blesser un opposant **sans engager de Test opposé** → **+1 Avantage**. On ne peut gagner qu'**un seul** Avantage de cette manière par action, quel que soit le nombre d'opposants blessés.

L'Avantage généré va dans la réserve du camp qui bénéficie de la circonstance.

### Table des Dépenses d'Avantages de Groupe

Les Avantages des **deux** réserves peuvent être dépensés pour ces effets, au tour d'un Joueur ou d'une créature. On n'est pas obligé de consulter qui que ce soit avant de dépenser, « mais la courtoisie est toujours préférable ».

| Coût | Dépense d'Avantage | Effet |
|---|---|---|
| **1 Avantage** | **Battre** — *Action spéciale.* Quand vous affrontez un opposant plus doué que vous, la force brute peut réussir là où les autres approches ont échoué. | Pour battre votre adversaire, effectuez un **Test opposé de Force** contre lui (vous utilisez tous les deux votre **Attribut** de Force). Si vous **remportez** le Test, votre adversaire subit l'État **À Terre** et perd **-1 Avantage**. Si vous **perdez** le Test, votre adversaire gagne **+1 Avantage** et votre Action se termine. Si vous remportez, vous **ne gagnez pas** l'Avantage habituel pour avoir remporté un Test opposé. |
| **1 Avantage** | **Coup tordu** — *Action spéciale.* Vous prenez un instant pour lancer de la terre dans les yeux d'un adversaire ou l'enflammer en lui jetant de l'huile en feu. Manœuvre risquée — peu d'ennemis tombent deux fois dans le même panneau. | Pour duper votre adversaire, effectuez un **Test opposé d'Agilité** (Attribut des deux). Si vous **remportez**, vous gagnez **+1 Avantage** ; si le MJ le juge justifié, vous pouvez aussi forcer l'ennemi à recevoir l'État **Aveuglé**, **Empêtré** ou **En flammes** à votre choix. Si vous **perdez**, votre adversaire gagne **+1 Avantage** et votre Action se termine. Le MJ peut refuser un État si vous n'avez pas d'objet adapté sous la main, ou si vous l'avez **déjà** infligé à cet adversaire. Si vous remportez, vous **ne gagnez pas** l'Avantage habituel pour avoir remporté un Test opposé. |
| **2 Avantages** (et +) | **Effort supplémentaire** — *Bonus à l'Action.* Dans une situation désespérée, utilisez l'élan acquis pour augmenter vos chances. | Vous gagnez un bonus de **+10** sur n'importe quel Test, **avant** de l'effectuer. Vous pouvez dépenser des Avantages **supplémentaires** pour ajouter **+10 par Avantage dépensé** (ex. : 3 Avantages → +20 ; 4 Avantages → +30). Ce Test **ne génère jamais** d'Avantage pour le Personnage qui l'effectue. |
| **2 Avantages** | **Retraite stratégique** — *Mouvement.* Vous profitez d'un temps mort ou d'une diversion pour rompre le combat. | Vous pouvez vous déplacer pour vous éloigner de vos adversaires **sans pénalité**. Cet effet **remplace** les règles de Désengagement (page 165 du Livre de Règles). |
| **4 Avantages** | **Action gratuite** — *Action supplémentaire.* Vous profitez d'une ouverture pour accomplir quelque chose de remarquable. | Vous effectuez une **Action supplémentaire**. Cette Action **ne génère jamais** d'Avantage pour le Personnage qui l'accomplit. Vous ne pouvez dépenser d'Avantages pour une Action supplémentaire **qu'une fois par Tour**. |

Les Avantages des deux réserves peuvent aussi être dépensés pour **activer des Traits de créature** (Traits décrits pages 338-343 du Livre de Règles).

### Perdre un Avantage de Groupe

À la **fin du Round**, le MJ évalue le conflit :

- Le camp comptant **le plus grand nombre de combattants** est **dominant** ; l'autre est **défavorisé**.
- À **nombre égal**, le camp dominant est celui qui détient l'avantage tactique (position surélevée, encerclement…).

Une fois la décision prise, **transférez 1 Avantage** de la réserve du camp **défavorisé** vers celle du camp **dominant**. Si la réserve du camp défavorisé est **vide**, la réserve du camp dominant **gagne quand même 1 Avantage** (création nette d'un Avantage côté dominant).

### Avantage Initial de Groupe (table)

Règle facultative : au lieu de démarrer les deux réserves à zéro, on peut représenter le positionnement tactique initial en accordant des Avantages au début du combat. Accorder des Avantages à un camp bénéficiant de la surprise est souvent plus simple que d'infliger l'État *Surpris* à plusieurs adversaires.

> **Seul le modificateur le plus élevé** applicable à une circonstance donnée est accordé pour cette circonstance. (Les trois lignes « Menace » entre elles, et les trois lignes « Surnombre » entre elles, ne se cumulent donc pas — on prend la plus forte applicable.) Les Avantages sont générés dans la réserve du camp qui bénéficie de la circonstance.

| Circonstances | Avantages accordés |
|---|---|
| **Manœuvrabilité** : un camp possède un avantage de mouvement (ex. : il est monté, ou ce sont des araignées géantes qui se battent dans les arbres). | **2** |
| **Menace** : un camp possède une menace **dangereuse** (ex. : un Lance-feu à maleflamme, un ogre ou un troll). | **1** |
| **Menace** : un camp possède une menace **très dangereuse** équivalant à plusieurs adversaires (ex. : un canon orgue, une manticore ou un griffon). | **3** |
| **Menace** : un camp possède une menace **extrêmement dangereuse** équivalant à une douzaine d'ennemis plus faibles (ex. : un dragon ou un démon majeur). | **5** |
| **Surnombre** : un plus grand nombre d'adversaires, mais **moins** que deux fois le nombre de combattants de l'autre camp. | **1** |
| **Surnombre** : **deux fois** le nombre de combattants de l'autre camp. | **2** |
| **Surnombre** : **trois fois** le nombre de combattants de l'autre camp. | **3** |
| **Surprise** : un camp a déclenché un assaut inattendu. | **2** |
| **Terrain** : fortifications, couvert léger ou position tenue avantageuse (ex. : sur une colline). | **1** |
| **Terrain** : couvert lourd ou position tenue décisive (ex. : un pont). | **2** |

> **Exemple :** un groupe de cinq aventuriers s'approche discrètement de dix gobelins et de leur chamane monté sur une manticore. La réserve des **alliés** gagne **2 Avantages** (surprise). La réserve des **adversaires** gagne **2 Avantages** (surnombre — deux fois plus nombreux) **+ 3 Avantages** (la manticore), soit **5 Avantages**. — `AA 11 l.67`

### Talents modifiés (Avantage de Groupe)

Plusieurs Talents sont modifiés pour correspondre à ces règles alternatives (détails à la section *Nouveaux Talents et Talents mis à jour*, page 140 d'*Aux Armes*) : **Artilleur, Battement, Coude-à-coude, Distraire, Impitoyable, Portebouclier, Rechargement rapide** et **Renversement**.

### Trait Instable modifié (Avantage de Groupe)

Le Trait de créature **Instable** est réécrit pour ce système :

> Le corps de la créature est maintenu par d'ignobles magies, fondamentalement instables dans le plan matériel. À la **fin de chaque Round**, le MJ sélectionne **au hasard** une créature possédant le Trait **Instable**. Si la réserve d'Avantages du **camp opposé** est plus élevée que celle de la créature, la créature **perd un nombre de Blessures égal à la différence** entre les deux. Si elle tombe à **0 Blessure** de cette manière, les magies la maintenant entière cèdent et elle « meurt ». — `AA 11 l.79`

(« Celle de la créature » désigne la réserve du camp de la créature : on compare réserve opposée vs réserve de son propre camp.)

### Actions modifiées en combat (Avantage de Groupe)

Ce système modifie aussi la liste des Actions de combat :

- **Attaquer** : attaque au corps à corps ou à distance, résolue selon les règles page 158 du Livre de Règles (inchangée).
- **Courir** : à votre tour, votre Action peut être Courir. Nécessite un **Test d'Athlétisme Accessible (+20)** ; la distance parcourue **s'ajoute** à votre Mouvement pour ce Round. Vous courez sur votre **Mouvement de Course + DR en mètres** (Mouvement de Course = Tableau des Mouvements, page 165 du Livre de Règles). *Exemple :* un Personnage de Mouvement 4 qui obtient -2 DR sprinte sur **14 mètres supplémentaires** (16 - 2 = 14).
- **Charger** : confère désormais un bonus de **+10 sur le premier Test de Corps à Corps** déclenché après avoir terminé votre Mouvement.
- **Évaluer** : vous utilisez une Compétence pour gagner un avantage en combat ; décrivez l'application et effectuez un **Test spectaculaire** (le MJ peut appliquer un malus/bonus selon la pertinence). **Succès → 2 Avantages** ; **Succès avec 6 DR ou plus → 3 Avantages**.
- **Se Défendre** : choisissez une Compétence ou une Caractéristique défensive appropriée (ex. : Esquive ou Agilité). Vous gagnez **+20 sur tous vos Tests défensifs** employant cette Compétence/Caractéristique **jusqu'au début de votre prochain Tour**.
- **Spéciale** : Actions venant de Compétences ou Talents (Empoigner, intimider, lancer un Sort, Maniement de deux armes, arrêter un saignement avec des bandages…).

**Sources RAW** :
- `AA 11 l.4-14` — Annexe I, présentation du système optionnel : deux réserves mutualisées (alliés/adversaires), routage des gains selon Joueur/PNJ allié vs PNJ hostile ou neutre.
- `AA 11 l.15-27` — « Obtenir Un Avantage » : modifie l'obtention p.164 LDB ; +1 Surprise, +2/+3 Évaluer (6 DR), +1/+2 Victoire (némésis), +1 Gagnant, +1 Prendre le dessus (un seul par action).
- `AA 11 l.28-43` — « Les Bénéfices des Avantages » + table des dépenses (Battre 1, Coup tordu 1, Effort supplémentaire 2+, Retraite stratégique 2, Action gratuite 4) ; dépense possible pour activer des Traits de créature (p.338-343 LDB).
- `AA 11 l.44-44` — « Perdre Un Avantage » : transfert de 1 Avantage du camp défavorisé vers le dominant en fin de Round (création nette si réserve défavorisée vide).
- `AA 11 l.48-67` — « Remplir les Réserves Dès le Départ » + table « Avantage Initial » (Manœuvrabilité 2, Menace 1/3/5, Surnombre 1/2/3, Surprise 2, Terrain 1/2 ; seul le plus haut modificateur par circonstance) + exemple gobelins/manticore.
- `AA 11 l.69-71` — « Les Talents Modifiés » : Artilleur, Battement, Coude-à-coude, Distraire, Impitoyable, Portebouclier, Rechargement rapide, Renversement (détails p.140 AA).
- `AA 11 l.73-79` — « Les Traits de Créature Modifiés » / **Instable** réécrit (fin de Round, créature aléatoire, perte de Blessures = différence des réserves, « meurt » à 0).
- `AA 11 l.83-98` — « Actions Modifiées En Combat » : Attaquer, Courir (Athlétisme +20, Course+DR m), Charger (+10 1er CàC), Évaluer (2/3 Avantages), Se Défendre (+20 défense), Spéciale.

> « Les Avantages ne sont plus accumulés par chaque Joueur ou PNJ individuellement. Au lieu de cela, ils sont acquis et stockés dans la réserve d'Avantages des alliés ou dans celle des adversaires. » — `AA 11 l.11`

> « transférez 1 Avantage de la réserve d'Avantages du camp défavorisé vers celle du camp dominant. Si la réserve d'Avantages du camp défavorisé ne contient pas d'Avantage, la réserve du camp dominant gagne 1 Avantage. » — `AA 11 l.44`

**Voir aussi** : Avantage (système standard LDB, individuel) ; États À Terre / Aveuglé / Empêtré / En flammes ; Tests opposés et Degrés de Réussite (DR) ; Désengagement (remplacé par Retraite stratégique) ; Trait Instable (version LDB) ; Surprise et État Surpris ; Évaluer (Compétence en combat) ; Charge.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `AA 11` (l.4-14, l.15-27, l.28-43, l.44, l.48-67, l.69-71, l.73-79, l.83-98) → `AdvantagePools`, `groupAdvantage`, `advantageCampOf`, `campGain`, `ThreatTier`, `campSpend`, `DisengageModal`, `InitialAdvantageCircumstances`, `AuthoredEncounter`, `outnumberAdvantage`, +24 — `src/data/reglesOptionnelles.json`, `src/data/schemas/defs-scenes/scene.ts`, `src/engine/advantagePool.ts`, `src/engine/combatFeatures/dispatch.ts`, `src/engine/combatFeatures/types.ts`, `src/scenes/test-scenarios/embuscade.ts`, +12 fichiers

---

## AA : Talents de combat

L'Annexe III d'*Aux Armes* (AA p. 140) introduit douze nouveaux Talents (ou versions **mises à jour** de Talents existants) tournés vers le combat de masse, les armes à distance et le maniement de l'Avantage. La règle générale des Talents s'applique : chaque Talent a un **Maxi** (nombre de fois où on peut le prendre, souvent un Bonus de caractéristique) et le **niveau** = nombre de fois pris. Sauf mention contraire, le Maxi cité ci-dessous est verbatim de la source.

> ⚠️ Ces versions AA divergent par endroits du texte du **Livre de base** (LDB) pour les mêmes Talents (Battement, Distraire, Frappe Blessante, Impitoyable, Porte-Bouclier, Renversement, Coude-à-Coude). Cette entrée transcrit le texte **AA** ; quand le LDB diffère, c'est signalé.

### Artilleur
**Maxi :** Bonus de Dextérité.
Vous rechargez avec facilité les armes à **Poudre noire**. Effets :
- **+1 DR par niveau d'Artilleur** à tout **Test étendu** de rechargement d'une arme à Poudre noire.
- En combat, recharger une arme à Poudre noire compte **aussi comme une Action Évaluer** pour vous.
- Vous gagnez **+1 Avantage supplémentaire** quand vous effectuez ce Test d'Évaluer.

### Battement
**Maxi :** Bonus de Capacité de Combat. **Tests :** Corps à Corps pour effectuer une manœuvre de Battement.
Frappes précises contrôlées sur l'arme adverse, créant une ouverture ou empêchant une attaque d'aboutir. Pour votre **Action**, vous pouvez choisir Battement **avant de lancer les dés**. Effectuez un Test de **Corps à Corps** (Test **NON opposé**). Sur un **Succès** :
- la réserve d'Avantages du **camp adverse perd −1 Avantage** ;
- **−1 de plus** si vous obtenez **6 DR**.

Talent **inutile** si l'adversaire **ne porte pas d'arme**, ou est **d'une Taille supérieure** à la vôtre.

> Divergence LDB : la version du Livre de base retire « −1 Avantage et **−1 de plus par DR** obtenu » (et non « −1 de plus à 6 DR »).

### Cavalier Émérite
**Maxi :** Bonus d'Agilité. **Tests :** Chevaucher pendant les combats.
À l'aise en selle même dans les pires situations. En supposant que vous possédez la Compétence **Chevaucher** :
- vous pouvez demander à votre monture d'effectuer **une Action** (pas seulement un Mouvement) **sans Test de Chevaucher** ;
- vous considérez votre **Taille comme égale à celle de votre monture** pour résister à la *Peur* et à la *Terreur* causées **uniquement par la Taille** de l'adversaire (vous êtes confiant une fois monté).

> Exemple (verbatim) : « une autre personne sur un cheval ne causerait pas de Peur, mais un démon ou un mort-vivant en causerait. »

### Commandant d'Équipe
**Maxi :** Bonus d'Initiative. **Tests :** Projectiles pour les tirs avec une arme dotée du Défaut *Arme d'équipe*.
Habitude de gérer des équipes maniant armes de siège et pièces d'artillerie. Le Personnage peut effectuer un **Test de Commandement Intermédiaire (+0)** pour aider une **équipe** qui utilise une arme dotée du Défaut *Arme d'équipe*, **à portée de voix**. Sur **Succès**, les membres de l'équipe peuvent ensuite utiliser le **score de Projectiles du Personnage** quand ils tirent avec l'arme.

### Coude-à-Coude
**Maxi :** Bonus de Capacité de Combat. **Tests :** Corps à Corps quand vous vous trouvez à côté d'un allié avec Coude-à-coude.
Formé à combattre côte à côte. Chaque Personnage possédant le Talent Coude-à-coude **compte comme deux combattants** pour ce qui est de **perdre un Avantage** (règle d'Avantage de groupe, voir AA / LDB règle de perte d'Avantage).

> Divergence LDB : la version du Livre de base accorde plutôt de **conserver 1 Avantage perdu par niveau** de Coude-à-coude lorsqu'un ennemi vous fait perdre des Avantages alors qu'un allié actif Coude-à-coude est adjacent.

### Distraire
**Maxi :** Bonus d'Agilité. **Tests :** Athlétisme pour Distraire.
Mouvements simples pour distraire/surprendre l'adversaire. Vous pouvez utiliser votre **Mouvement** pour Distraire. Résolution : **Test opposé d'Athlétisme / Calme** contre votre cible. Sur **Succès**, l'adversaire **ne gagne pas d'Avantage** pour sa réserve **jusqu'à la fin du prochain Round**.

### Frappe Blessante
**Maxi :** 1.
Expert pour frapper les endroits les plus vulnérables. Quand vous effectuez un lancer dans un **tableau de Blessures Critiques**, **lancez les dés deux fois et choisissez le résultat** que vous préférez.

> Divergence LDB : la version du Livre de base inflige plutôt **+niveau de Frappe Blessante en Blessures supplémentaires** quand on cause une Blessure Critique (et son Maxi est le Bonus d'Initiative, pas 1).

### Fuite !
**Maxi :** Bonus d'Agilité. **Tests :** Athlétisme quand vous Fuyez ou quand vous êtes la Cible d'une Poursuite.
Quand votre vie est en jeu, vous courez à une vitesse impressionnante. Votre **Attribut de Mouvement compte comme augmenté de 1** quand vous **Fuyez** ou quand vous êtes la **Cible d'une Poursuite**.

### Impitoyable
**Maxi :** 1.
Quand votre esprit est rivé sur une cible, personne ne peut vous empêcher de l'atteindre. La **dépense d'Avantages pour une Retraite stratégique tombe à 1** pour vous (au lieu de 2).

> Divergence LDB : la version du Livre de base permet de **conserver un nombre d'Avantages égal au niveau** lors d'un **Désengagement**, et de pouvoir se Désengager même avec **moins d'Avantages** que ses adversaires.

### Porte-Bouclier
**Maxi :** Bonus de Force. **Tests :** n'importe quel Test pour vous défendre avec un bouclier.
Habile au maniement du bouclier pour tirer parti d'une situation désespérée. Quand vous utilisez un **bouclier pour vous défendre**, **une fois par Round**, vous pouvez **dépenser 2 Avantages** pour, **au choix** :
- **causer des Dégâts** quand vous êtes attaqué, comme s'il s'agissait de votre Action ; **ou**
- **pousser** votre adversaire de **2 mètres** dans la direction directement opposée à vous, **et** ne plus être considéré comme **Engagé**.

> Divergence LDB : la version du Livre de base accorde simplement **+niveau Avantage** quand vous **perdez** le Test opposé en vous défendant avec un bouclier.

### Rechargement Rapide
**Maxi :** Bonus de Dextérité.
Vous rechargez avec facilité **toutes les armes à distance**. Effets (identiques à Artilleur, mais pour toute arme à distance) :
- **+1 DR par niveau de Rechargement rapide** à tout **Test étendu** de rechargement d'une arme à distance.
- En combat, recharger une arme à distance compte **aussi comme une Action Évaluer** pour vous.
- Vous gagnez **+1 Avantage supplémentaire** quand vous effectuez ce Test d'Évaluer.

### Renversement
**Maxi :** Bonus de Capacité de Combat. **Tests :** Corps à Corps quand vous vous défendez.
Capable de retourner les situations les plus désastreuses à votre avantage. Si vous **gagnez le Test opposé de Corps à Corps** (en défense), **au lieu de gagner +1 Avantage**, vous pouvez **prendre 1 Avantage dans la réserve du camp opposé** et l'ajouter à la vôtre. Dans ce cas, vous **ne pouvez infliger aucun Dégât**, même si c'était votre Tour dans le Round.

> Divergence LDB : la version du Livre de base fait **prendre TOUS les Avantages** actuels de l'adversaire (et non 1 seul).

### Tableau récapitulatif (AA Annexe III)

| Talent | Maxi | Tests associés | Effet (résumé RAW) |
|---|---|---|---|
| Artilleur | Bonus de Dextérité | — | +DR=niveau au rechargement Poudre noire (Test étendu) ; rechargement = Action Évaluer ; +1 Avantage |
| Battement | Bonus de Capacité de Combat | Corps à Corps (manœuvre) | Action ; Test CàC non opposé ; Succès → camp adverse −1 Avantage (−1 de plus à 6 DR) ; nul si adversaire désarmé ou Taille > vous |
| Cavalier Émérite | Bonus d'Agilité | Chevaucher en combat | Monture fait une Action sans Test ; Taille = celle de la monture vs Peur/Terreur par Taille |
| Commandant d'Équipe | Bonus d'Initiative | Projectiles (arme d'équipe) | Test Commandement Intermédiaire (+0), équipe à portée de voix → l'équipe tire avec votre score de Projectiles |
| Coude-à-Coude | Bonus de Capacité de Combat | Corps à Corps (allié adjacent Coude-à-coude) | Compte comme 2 combattants pour la perte d'Avantage |
| Distraire | Bonus d'Agilité | Athlétisme | Utilise le Mouvement ; Test opposé Athlétisme/Calme ; Succès → adversaire ne gagne pas d'Avantage jusqu'à fin du prochain Round |
| Frappe Blessante | 1 | — | Lancer 2× sur la table de Blessures Critiques, choisir le résultat |
| Fuite ! | Bonus d'Agilité | Athlétisme (Fuite / Cible de Poursuite) | Mouvement +1 quand on Fuit ou qu'on est Cible d'une Poursuite |
| Impitoyable | 1 | — | Retraite stratégique coûte 1 Avantage (au lieu de 2) |
| Porte-Bouclier | Bonus de Force | tout Test de défense au bouclier | 1×/Round, dépenser 2 Avantages : infliger Dégâts comme une Action OU pousser l'adversaire de 2 m (et fin de l'Engagement) |
| Rechargement Rapide | Bonus de Dextérité | — | Comme Artilleur, mais pour toute arme à distance (+DR=niveau, Action Évaluer, +1 Avantage) |
| Renversement | Bonus de Capacité de Combat | Corps à Corps en défense | Test opposé CàC gagné → prendre 1 Avantage adverse au lieu de +1 Avantage ; aucun Dégât infligé ce Tour |

*Réf. table : `AA 13 l.7-97`.*

**Sources RAW** :
- `AA 13 l.7-9` — Annexe III, en-tête « Nouveaux Talents et Talents Mis À Jour » + **Artilleur** (Maxi Bonus de Dextérité ; +DR=niveau au Test étendu de rechargement Poudre noire ; rechargement = Action Évaluer ; +1 Avantage).
- `AA 13 l.11-17` — **Battement** (Maxi Bonus de CC ; Test CàC non opposé ; Succès → camp adverse −1 Avantage, −1 de plus à 6 DR ; nul si adversaire désarmé / Taille supérieure).
- `AA 13 l.20-25` — **Cavalier Émérite** (Maxi Bonus d'Agilité ; monture fait une Action sans Test de Chevaucher ; Taille = celle de la monture vs Peur/Terreur par Taille).
- `AA 13 l.29-35` — **Commandant d'Équipe** (Maxi Bonus d'Initiative ; Test Commandement Intermédiaire (+0) ; équipe à portée de voix tire avec le score de Projectiles du Personnage ; arme à Défaut *Arme d'équipe*).
- `AA 13 l.37-43` — **Coude-à-Coude** (Maxi Bonus de CC ; compte comme deux combattants pour perdre un Avantage).
- `AA 13 l.46-51` — **Distraire** (Maxi Bonus d'Agilité ; utilise le Mouvement ; Test opposé Athlétisme/Calme ; Succès → adversaire sans gain d'Avantage jusqu'à fin du prochain Round).
- `AA 13 l.54-59` — **Frappe Blessante** (Maxi 1 ; lancer 2× sur la table de Blessures Critiques, choisir) + exemple de Peur par Taille.
- `AA 13 l.64-68` — **Fuite !** (Maxi Bonus d'Agilité ; Mouvement +1 quand on Fuit ou Cible d'une Poursuite).
- `AA 13 l.70-74` — **Impitoyable** (Maxi 1 ; dépense d'Avantages pour une Retraite stratégique tombe à 1).
- `AA 13 l.78-84` — **Porte-Bouclier** (Maxi Bonus de Force ; 1×/Round, 2 Avantages : Dégâts comme une Action OU poussée 2 m + fin d'Engagement).
- `AA 13 l.86-90` — **Rechargement Rapide** (Maxi Bonus de Dextérité ; identique à Artilleur mais toute arme à distance).
- `AA 13 l.94-97` — **Renversement** (Maxi Bonus de CC ; Test opposé CàC gagné → prendre 1 Avantage adverse au lieu de +1 ; aucun Dégât ce Tour).

> « Recharger une arme à Poudre noire pendant un combat est également considéré comme une Action Évaluer pour vous. Vous gagnez +1 Avantage supplémentaire quand vous effectuez ce Test d'Évaluer. » — `AA 13 l.9`

> « sur un Succès, la réserve d'Avantages du camp adverse perd -1 Avantage et -1 de plus si vous avez obtenu 6 DR. Ce Test n'est pas opposé. Ce Talent est inutile si votre adversaire ne porte pas d'arme, ou est d'une Taille supérieure à la vôtre. » — `AA 13 l.17`

> « vous pouvez dépenser 2 Avantages soit pour causer des Dégâts quand vous êtes attaqué comme s'il s'agissait de votre Action, soit pour pousser votre adversaire sur 2 mètres dans la direction directement opposée à vous et ne plus être considéré comme Engagé. » — `AA 13 l.84`

> « au lieu de gagner +1 Avantage, vous pouvez prendre 1 Avantage dans la réserve d'Avantages du camp opposé et l'ajouter à la vôtre. Dans ce cas, vous ne pouvez infliger aucun Dégât, même si c'était votre Tour dans le Round. » — `AA 13 l.98`

**Voir aussi** : Avantage (réserve, gain/perte, surnombre) ; Manœuvres de combat (Battement, Désengagement, Retraite stratégique) ; Peur / Terreur (Taille) ; Rechargement & Tests étendus ; Armes d'équipe & artillerie (Défaut *Arme d'équipe*) ; Boucliers (défense).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `AA 13` (l.7-97, l.98) → `DistraireModal`, `BattementModal`, `campGain`, `CombatFeature`, `reversalStealOne`, `teamCommandMod`, `useDefenseJetProps`, `dominationTransfer`, `fearSourceFor`, `roundEndAdvantageTransfer`, +42 — `src/data/combat-stakes.json`, `src/data/reglesOptionnelles.json`, `src/data/talents.json`, `src/engine/advantagePool.ts`, `src/engine/careerSlots.ts`, `src/engine/combatFeatures/dispatch.ts`, +20 fichiers

---

## AA : Activités guerrières

Les **Activités de guerrier** (*Aux Armes*, Annexe II) sont des Activités d'interlude qui visent à affûter ses capacités dans les arts du combat. Elles s'entreprennent comme toute Activité d'interlude (une Activité par semaine, voir l'interlude RAW), et leur bénéfice se déclenche **une fois au cours de la prochaine aventure** (sauf mention contraire).

**Règle d'accès universelle.** N'importe quel Personnage peut tenter ces Activités, mais **s'il n'a jamais appartenu à la Classe des Guerriers, la Difficulté de tous les Tests qu'il effectue monte d'un Niveau** (p. ex. un Test Complexe –10 devient Difficile –20).

> « N'importe quel Personnage peut tenter ces Activités, mais s'il n'a jamais appartenu à la Classe des Guerriers, la Difficulté de tous les Tests qu'il effectue monte d'un Niveau. Par exemple, un Test Complexe (–10) devient Difficile (–20). » — `AA 12 l.5`

---

### Tir Parfait de Fanmaris (Guerriers)

Le Personnage consulte le manuel d'entraînement d'**Allavandrel Fanmaris** et s'entraîne à tirer dans des conditions distrayantes et sur des cibles compliquées.

- **Test d'entreprise :** **Projectiles (Arc) Complexe (–10)**.
- En cas de **Succès**, une fois au cours de la prochaine aventure : après avoir passé **un Round de combat à viser** votre adversaire, vous pouvez déclarer un **Tir parfait**. Effectuez alors un Test de **Projectiles** avec les pénalités et bonus normaux, **y compris le +20 de la visée**.
- Votre attaque gagne les effets supplémentaires ci-dessous selon le **DR total** obtenu sur ce Test de Projectiles. **Tous les effets sont cumulatifs.**

**Table des effets du Tir Parfait** (verbatim) :

| DR | Effet (cumulatif) |
|---|---|
| +1 | Vous pouvez choisir la Localisation des Dégâts. |
| +2 à +3 | Votre arme gagne l'Atout *Perforante* (page 298 de WFJDR) pour cette attaque. Si elle est déjà *Perforante*, augmentez ses Dégâts de 2. |
| +4 à +5 | Vous infligez automatiquement un Coup Critique. |
| +6 | Votre arme gagne l'Atout *Dévastatrice* (page 298 de WFJDR) pour cette attaque. Si elle est déjà *Dévastatrice*, elle gagne l'Atout *Percutante* (page 298 de WFJDR). |

*— `AA 12 l.12-18`*

---

### Défense de Leitdorf (Guerriers)

Le Personnage consulte le fascicule de la **Défense de Leitdorf**, censé rédigé par le comte **Marius Leitdorf** d'Averland : une série de manœuvres offensives inhabituelles (frapper de la garde de l'épée, coup de tête, attraper la lame à mains nues) pour contrer les défenses orthodoxes. Ces tactiques sont risquées par nature mais déstabilisent un opposant qui s'attendait à une attaque plus organisée.

- **Test d'entreprise :** **Corps à Corps Complexe (–10)**.
- En cas de **Succès**, une fois au cours de la prochaine aventure : après un ou plusieurs Rounds **Engagé** contre un adversaire, vous pouvez déclarer employer la Défense de Leitdorf. Portez une attaque en effectuant un **Test opposé de Corps à Corps avec une pénalité de –10**.
- **L'adversaire ne peut ni utiliser ses Talents ni ajouter ses Augmentations de Compétence** quand il se défend contre cette attaque.
- **Si vous remportez le Test :** après avoir résolu l'attaque, **vous subissez 1d10 Dégâts qui ignorent l'Armure** (le contrecoup de la manœuvre risquée).
- **Si l'adversaire remporte le Test :** **il vous inflige un Coup Critique** (la manœuvre risquée vous expose et vous rend vulnérable).
- **Vous pouvez entreprendre cette Activité plusieurs fois** si vous le désirez.

> « Votre adversaire ne peut ni utiliser ses Talents ni ajouter ses Augmentations de Compétence quand il se défend contre cette attaque. Après avoir résolu l'attaque, si vous remportez le Test, vous subissez 1d10 Dégâts qui ignorent l'Armure. Si votre adversaire remporte le Test, il vous inflige un Coup Critique […]. » — `AA 12 l.30`

---

### Méthode Alcatani (Guerriers — devant posséder au moins 2 rangs dans le Talent Coude-à-coude)

Mélange de cris, menaces, discours, alcool et subornation pour transformer rapidement un groupe de mécréants en unité militaire fonctionnelle. Sans pratique régulière, ces leçons sont vite oubliées.

- **Pré-requis :** posséder **au moins deux rangs dans le Talent Coude-à-coude**.
- **Test d'entreprise :** **Commandement Complexe (–10)**.
- **Pour chaque DR** obtenu sur ce Test, vous pouvez donner à **un Personnage** un seul rang dans le Talent **Coude-à-coude** (page 135 de WFJDR) **pour toute la durée de la prochaine aventure**.
- Les Personnages possédant déjà Coude-à-coude peuvent **augmenter de 1 leur rang**, sans dépasser le rang de Coude-à-coude du Personnage qui entreprend l'Activité.
- Les Personnages dotés du Talent **Exaltant** multiplient le nombre de Personnages qui reçoivent Coude-à-coude, comme indiqué dans le Livre de Règles (page 137 de WFJDR). *Exemple RAW :* DR +3 au Test de Commandement + 2 rangs d'Exaltant → accorder +1 rang de Coude-à-coude à **jusqu'à 30 personnes**.

*— `AA 12 l.36-44`*

---

### Remaniement du Contremaître (Guerriers)

Quelques pièces et un mot glissé à un vieux compagnon dans les parties louches du Vieux Monde révèlent une occasion d'acquérir un objet désiré. La mission est toujours dangereuse, souvent fatale.

**Préparation :**
- Choisissez une **Possession**, appliquez-lui les Atouts souhaités et calculez son **coût final** (arrondi à la **couronne d'or** la plus proche).
- Le coût est **normalement limité à 20 CO**, mais le MJ peut lever cette limite.

**Localiser le contact :**
- Effectuez un Test de **Ragot Intermédiaire (+0)** pour trouver un ancien associé. En cas de **Succès**, il vous détaille un travail permettant de mettre la main sur l'objet (en paiement ou en vous en emparant pendant la mission).

**La mission (dangereuse) :**
- Effectuez un Test de **Corps à Corps** *ou* de **Projectiles Complexe (–10)**.
- **En cas de Succès :** vous recevez **l'objet désiré** ET **une Blessure Critique** sur une Localisation tirée au hasard, **en enlevant 20 au jet** du Tableau des Critiques (minimum 01).
- **En cas d'Échec :** vous recevez **l'objet** ET **une Blessure Critique** sur une Localisation tirée au hasard, **en ajoutant** au jet du Tableau des Critiques **autant que le coût de l'objet en Couronnes d'or**.
- Vous **ne pouvez pas dévier ce Critique avec votre armure**, mais **un point de Destin** pourrait permettre d'éviter certaines conséquences.

*— `AA 12 l.52-61`*

#### Table : Générateur de Mission (Remaniement du Contremaître)

Pour obtenir l'objet, faites un jet dans le **Tableau de Lieu** (où aller), le **Tableau d'Objectif** (que rapporter) et le **Tableau de Personnalité** (qui vous emploie). *— `AA 12 l.64-66`*

> **Fidélité :** les trois tableaux ci-dessous sont recopiés verbatim de l'extraction courante (`AA 12 l.68-145`) — bornes d100 et libellés inchangés, seuls les retours de mise en page PDF (`<br>`) sont repliés.

**Tableau de Lieu** :

| 1d100 | Lieu |
|---|---|
| 01-05 | Une cabane sinistre à l'orée des bois. |
| 06-10 | Un abattoir dans les quartiers pauvres. |
| 11-15 | Un rucher rempli d'abeilles très territoriales. |
| 16-20 | Un entrepôt qui sent la poudre noire. |
| 21-25 | Une tour de signalisation impériale. |
| 26-30 | Une auberge-relais ayant un excédent de produits porcins. |
| 31-35 | Une grande maison de ville dans le style du Stirland, aux rideaux inhabituellement épais. |
| 36-40 | Un camp militaire. |
| 41-45 | Une étable luxueuse abritant deux étalons agressifs. |
| 46-50 | Un parc à bestiaux abritant une meute de chiens affamés. |
| 51-55 | Un égout à l'odeur épouvantable. |
| 56-60 | Un bureau rempli de papiers et de lampes à huile. |
| 61-65 | Une clairière sur une colline avec une grande pierre levée. |
| 66-70 | Une fosse de combat où des combats ont actuellement lieu. |
| 71-75 | Une caverne jonchée d'os brisés. |
| 76-80 | Un cimetière dont certaines tombes ont été récemment remuées. |
| 81-85 | Une tour de sorcier dont le rez-de-chaussée est couvert d'une substance inhabituelle. |
| 86-90 | Un temple de Verena abandonné. |
| 91-95 | Une cave utilisée comme lieu de rendez-vous secret. |
| 96-100 | Un quai pourri à plusieurs endroits. |

*— `AA 12 l.72-92`*

**Tableau d'Objectif** :

| 1d100 | Objectif |
|---|---|
| 01-05 | Un coffre verrouillé et incroyablement lourd. |
| 06-10 | Plusieurs sacs d'épices rares d'Ind. |
| 11-15 | Un bocal scellé d'Arabie. |
| 16-20 | Une plaque en or prise dans les Terres du Sud. |
| 21-25 | Une épée brisée en trois morceaux. |
| 26-30 | Un magnifique collier d'obsidienne. |
| 31-35 | Un noble enlevé. |
| 36-40 | Une sacoche de poudre de malepierre. |
| 41-45 | Un titre de propriété. |
| 46-50 | Un colis de décoctions d'apothicaire. |
| 51-55 | Un hors-la-loi emprisonné. |
| 56-60 | Le marteau de guerre ornementé d'un prêtre de Sigmar. |
| 61-65 | Un tome interdit. |
| 66-70 | Une arme à feu naine. |
| 71-75 | Un enfant disparu en pleurs. |
| 76-80 | Un crâne apparemment constitué de cristal. |
| 81-85 | Un talisman de jade long comme le doigt sur lequel sont inscrites des runes étranges. |
| 86-90 | Une pièce d'armure, autrefois portée par un général célèbre. |
| 91-95 | Une carte détaillant certains secrets. |
| 96-100 | Un appareil d'ingénierie naine. |

*— `AA 12 l.98-120` (la source scinde le tableau en deux blocs : entrées 01-45 `l.98-106`, entrées 46-100 `l.110-120`)*

**Tableau de Personnalité** (qui vous emploie) :

| 1d100 | Personnalité |
|---|---|
| 01-05 | Un incorrigible romantique. |
| 06-10 | Un ingénieur nain courroucé. |
| 11-15 | Un noble à la vie dissolue. |
| 16-20 | Un chef cuisinier halfling désespéré. |
| 21-25 | Un chef de culte. |
| 26-30 | Une sentinelle expérimentée. |
| 31-35 | Un diplomate elfe. |
| 36-40 | Un ratier paranoïaque. |
| 41-45 | Un orphelin plaintif. |
| 46-50 | Un noble en exil. |
| 51-55 | Un Tueur de Trolls furieux. |
| 56-60 | Un prêtre important. |
| 61-65 | Un enquêteur halfling. |
| 66-70 | Un elfe encapuchonné et masqué. |
| 71-75 | Un marchand nerveux. |
| 76-80 | Un répurgateur agressif. |
| 81-85 | Un criminel intimidant. |
| 86-90 | Un humble enquêteur. |
| 91-95 | Un général commandant une armée. |
| 96-100 | Un émissaire impérial. |

*— `AA 12 l.126-145`*

---

### Hors couverture du topic — Fabuleuse Vente du Comte de Punchausen (Guerriers)

Listée dans la même annexe (le Personnage raconte ses aventures à un imprimeur de pamphlets). **Test : Charme Complexe (–10)** *ou* **Divertissement (Narration) Intermédiaire (+0)**. En cas de **Succès :** vous recevez **2d10 pistoles** et, une fois au cours de la prochaine aventure, vous pouvez **inverser les dés** sur un Test de **Charme** ou de **Divertissement (Narration)**. *— `AA 12 l.46-49`*

---

**Sources RAW** :
- `AA 12 l.3-5` — Annexe II « Activités de guerrier » : cadre général + règle d'accès (non-Guerrier = Difficulté +1 Niveau, p. ex. Complexe –10 → Difficile –20).
- `AA 12 l.8-18` — Tir Parfait de Fanmaris : Test Projectiles (Arc) Complexe (–10) à l'entreprise ; bénéfice après 1 Round de visée (Test Projectiles incluant +20 visée) ; table d'effets cumulatifs par DR.
- `AA 12 l.21-32` — Défense de Leitdorf : Test Corps à Corps Complexe (–10) à l'entreprise ; attaque en Test opposé Corps à Corps –10, adversaire privé de Talents et d'Augmentations ; succès = 1d10 Dégâts ignorant l'Armure pour soi ; échec = Coup Critique reçu ; renouvelable.
- `AA 12 l.36-44` — Méthode Alcatani : pré-requis 2 rangs de Coude-à-coude ; Test Commandement Complexe (–10) ; 1 rang temporaire de Coude-à-coude par DR (durée d'aventure), plafonné au rang de l'instructeur ; interaction avec Exaltant (exemple : 30 personnes).
- `AA 12 l.46-49` — Fabuleuse Vente du Comte de Punchausen : Test Charme Complexe (–10) ou Divertissement (Narration) Intermédiaire (+0) ; gain 2d10 pistoles + inversion des dés sur 1 Test de Charme/Divertissement.
- `AA 12 l.52-61` — Remaniement du Contremaître : objet (Atouts) à coût ≤20 CO (MJ peut lever) ; Test Ragot Intermédiaire (+0) pour le contact ; mission = Test Corps à Corps ou Projectiles Complexe (–10) ; Succès = objet + Critique avec –20 au jet ; Échec = objet + Critique avec +coût-en-CO au jet ; Critique non déviable par armure mais Destin possible.
- `AA 12 l.61-145` — Générateur de Mission : règle d'usage des 3 tableaux (`l.66`) + Tableau de Lieu (`l.68-92`), Tableau d'Objectif (`l.94-120`) et Tableau de Personnalité (`l.122-145`), tous en 1d100.

> « Pour entreprendre cette Activité, choisissez une Possession, appliquez-lui les Atouts souhaités et calculez son coût final, en arrondissant à la couronne d'or la plus proche. Le coût devrait normalement être limité à 20 CO, mais le MJ peut lever cette limite s'il le veut. » — `AA 12 l.55`

**Voir aussi** : Talent Coude-à-coude · Talent Exaltant · Atouts d'armes (*Perforante* / *Dévastatrice* / *Percutante*) · Tableau des Critiques & Localisations · Degrés de Réussite (DR) · Interlude & Activités (Engagements LDB).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `AA 12` (l.3-5, l.8-18, l.21-32, l.36-44, l.46-49, l.52-145) → `skillRefSchema`, `ActivitySkill`, `artilleur`, `changeCareer`, `PendingActivityFields`, `battement`, `ActivityDef`, `team-command`, `everBelongedClasses`, `bestActivitySkill`, +16 — `src/data/activities.json`, `src/data/combat-stakes.json`, `src/data/index.ts`, `src/data/schemas/defs/activities.ts`, `src/data/tables.json`, `src/data/talents.json`, +4 fichiers

---

## AA : Miracles martiaux (Myrmidia)

*Aux Armes* (chapitre Prêtre de Myrmidia) ajoute **9 Miracles** au culte de Myrmidia, déesse stratège de la guerre. Ils s'utilisent **en plus** de ceux du chapitre 7 du livre de base (« Voici plusieurs Miracles myrmidéens qui peuvent être utilisés en plus de ceux présentés dans le chapitre 7 de WFJDR »). Comme tout Miracle, ils sont invoqués par un **Test de Prière** (mécanique générale du livre de base, non répétée dans *Aux Armes*) ; *Aux Armes* ne donne pour chacun que **Portée / Cible / Durée** + l'effet. Toutes les Zones d'Effet de groupe sont mesurées en **mètres = Force Mentale** (la caractéristique, pas son Bonus) ; les durées en Rounds sont fixes (1/3/4/6) ou égales au **Bonus de Force Mentale (BFM)** selon le Miracle.

Ces 9 Miracles forment trois familles : **buffs de groupe** (Dévotion de la Vierge Guerrière, Prouesses Martiales), **anti-déroute de groupe** (En Bon Ordre, En Terrain Dangereux), **buffs/compulsions personnels** (Frappe Rapide, Fureur Vengeresse, Terrifier l'Ennemi), et **utilitaires tactiques** (Commander la Légion, Connais Ton Ennemi).

### Tableau récapitulatif des 9 Miracles

| Miracle | Portée | Cible | Durée | Effet (résumé) |
|---|---|---|---|---|
| Commander la Légion | Voir texte | N'importe quel allié | Instantanée | Ordre à 1 allié à vue ; **+10** au Test de Commandement lié |
| Connais Ton Ennemi | (Force Mentale) mètres | 1 ennemi | Instantanée | Le MJ révèle **profil, Traits, Compétences et Talents** de la cible |
| Dévotion de la Vierge Guerrière | Vous | Alliés dans la ZdE ([FM] m) | 4 Rounds | **+1 rang de Sans peur (Ennemi)** à tous les myrmidéens à portée |
| En Bon Ordre | Vous | Alliés dans la ZdE ([FM] m) | (BFM) Rounds | Vos alliés rompent le combat **sans donner 1 Avantage ni attaque gratuite** à l'ennemi |
| En Terrain Dangereux | Vous | Alliés dans la ZdE ([FM] m) | (BFM) Rounds | Vos alliés **ne reçoivent pas l'État *Brisé*** |
| Frappe Rapide | Vous | Vous | 3 Rounds | Au début de chaque Round, **Test d'Initiative Intermédiaire (+0)** → **attaque gratuite immédiate** hors ordre (main principale) |
| Fureur Vengeresse | Vous | Vous | 6 Rounds | **Charge obligatoire** sur l'ennemi impénitent le plus proche ; **relance de tous les jets de Corps à Corps** |
| Prouesses Martiales | Vous | Alliés dans la ZdE ([FM] m) | 4 Rounds | **+10 CC et +10 CT** à tous les alliés à portée |
| Terrifier l'Ennemi | Vous | Vous | 1 Round | Vous gagnez le **Trait de créature Terreur 1** |

*— `AA 06 l.469-551`*

### Détail mécanique de chaque Miracle

**Commander la Légion** — *Portée : Voir texte ; Cible : n'importe quel allié ; Durée : Instantanée.* « Myrmidia transmet vos ordres sur tout le champ de bataille. » Vous donnez un ordre à n'importe quel allié **dans votre ligne de vue**. L'ordre doit être **pertinent pour mener une lutte armée ou une stratégie en cours**. Tout **Test de Commandement** que vous effectuez en conséquence bénéficie d'un **bonus de +10**. *(Le bonus porte sur le Test que fait le prêtre lui-même, pas sur la cible.)* — `AA 06 l.469-477`

**Connais Ton Ennemi** — *Portée : (Force Mentale) mètres ; Cible : 1 ennemi ; Durée : Instantanée.* Vous implorez Myrmidia de vous indiquer les forces et faiblesses d'un ennemi proche. **Le MJ doit vous permettre de consulter le profil, les Traits, les Compétences et les Talents de la cible.** — `AA 06 l.479-485`

**Dévotion de la Vierge Guerrière** — *Portée : Vous ; Cible : les alliés dans la ZdE ([Force Mentale] mètres) ; Durée : 4 Rounds.* Tous les **myrmidéens à portée** gagnent **+1 rang du Talent Sans peur (Ennemi)**. Cet ennemi peut être soit **un individu en particulier**, soit **une espèce en particulier**. — `AA 06 l.487-495`

**En Bon Ordre** — *Portée : Vous ; Cible : les alliés dans la ZdE ([Force Mentale] mètres) ; Durée : (Bonus de Force Mentale) Rounds.* Tant que le Miracle est actif, n'importe lequel de vos alliés peut **rompre le combat sans permettre à l'ennemi de gagner 1 Avantage et de porter une attaque gratuite** (voir *Fuite*, p. 165 du livre de base). — `AA 06 l.497-506`

**En Terrain Dangereux** — *Portée : Vous ; Cible : les alliés dans la ZdE ([Force Mentale] mètres) ; Durée : (Bonus de Force Mentale) Rounds.* Vous invoquez Myrmidia pour qu'elle ôte toute idée de retraite de l'esprit de vos alliés. Tant que le Miracle est actif, **vos alliés ne reçoivent pas d'État *Brisé***. — `AA 06 l.509-517`

**Frappe Rapide** — *Portée : Vous ; Cible : Vous ; Durée : 3 Rounds.* Tant que le Miracle est actif, **au début de chaque Round**, vous pouvez tenter un **Test d'Initiative Intermédiaire (+0)** pour gagner une **attaque gratuite immédiate en dehors de l'ordre normal du Tour**. Cette attaque est résolue **avec l'arme tenue dans votre main principale**. — `AA 06 l.521-525`

**Fureur Vengeresse** — *Portée : Vous ; Cible : Vous ; Durée : 6 Rounds.* Tant que le Miracle est actif, **vous devez Charger et attaquer l'ennemi impénitent le plus proche** (compulsion). Vous pouvez **relancer tous les jets de Compétence Corps à Corps** que vous effectuez tant que le Miracle est actif. — `AA 06 l.527-531`

**Prouesses Martiales** — *Portée : Vous ; Cible : les alliés dans la ZdE ([Force Mentale] mètres) ; Durée : 4 Rounds.* Tant que le Miracle est actif, **tous les alliés à portée bénéficient d'un bonus de +10 à leur CC et à leur CT** (Capacité de Combat et Capacité de Tir). — `AA 06 l.533-540`

**Terrifier l'Ennemi** — *Portée : Vous ; Cible : Vous ; Durée : 1 Round.* « Vous incarnez Myrmidia sous son aspect le plus furieux. » Vous gagnez le **Trait de créature Terreur 1**. — `AA 06 l.542-551`

**Sources RAW** :
- `AA 06 l.465-468` — En-tête « Miracles de Myrmidia » : ces Miracles s'ajoutent à ceux du chapitre 7 du livre de base (Test de Prière standard, non re-décrit dans *Aux Armes*).
- `AA 06 l.469-477` — **Commander la Légion** : Portée « Voir texte », Cible « n'importe quel allié », Durée Instantanée ; ordre à un allié à vue, pertinent au combat/stratégie, **+10** au Test de Commandement du prêtre.
- `AA 06 l.479-485` — **Connais Ton Ennemi** : Portée (FM) mètres, 1 ennemi, Instantanée ; le MJ révèle profil + Traits + Compétences + Talents.
- `AA 06 l.487-495` — **Dévotion de la Vierge Guerrière** : Portée Vous, alliés ZdE ([FM] m), 4 Rounds ; **+1 rang Sans peur (Ennemi)** aux myrmidéens, ennemi = individu OU espèce.
- `AA 06 l.497-506` — **En Bon Ordre** : Portée Vous, alliés ZdE ([FM] m), **(BFM) Rounds** ; rompre le combat sans donner Avantage ni attaque gratuite (renvoi Fuite p.165 LDB).
- `AA 06 l.509-517` — **En Terrain Dangereux** : Portée Vous, alliés ZdE ([FM] m), **(BFM) Rounds** ; pas d'État *Brisé*.
- `AA 06 l.521-525` — **Frappe Rapide** : Portée/Cible Vous, 3 Rounds ; Test d'Initiative Intermédiaire (+0) chaque début de Round → attaque gratuite immédiate hors-tour (arme de main principale).
- `AA 06 l.527-531` — **Fureur Vengeresse** : Portée/Cible Vous, 6 Rounds ; Charge obligatoire de l'ennemi impénitent le plus proche + relance de tous les jets de Corps à Corps.
- `AA 06 l.533-540` — **Prouesses Martiales** : Portée Vous, alliés ZdE ([FM] m), 4 Rounds ; **+10 CC et +10 CT** aux alliés.
- `AA 06 l.542-551` — **Terrifier l'Ennemi** : Portée/Cible Vous, 1 Round ; gagne le Trait de créature **Terreur 1**.

> « Au début de chaque Round, vous pouvez tenter un Test d'**Initiative Intermédiaire (+0)** pour gagner une attaque gratuite immédiate en dehors de l'ordre normal du Tour. Cette attaque est résolue avec l'arme que vous tenez dans votre main principale. » — `AA 06 l.525`

> « Tant que le Miracle est actif, vous devez Charger et attaquer l'ennemi impénitent le plus proche. Vous pouvez relancer tous les jets de Compétence Corps à Corps que vous effectuez tant que le Miracle est actif. » — `AA 06 l.531`

**Voir aussi** : LDB 42 — Miracles de Myrmidia (les 6 Miracles de base : Appel à la Fureur, Bouclier de Myrmidia, Inspirant, Lance de Myrmidia, Œil de l'aigle, Soleil flamboyant) ; LDB 21 — Psychologie (Terreur, États Brisé) ; LDB 13 — Combat (Charge, attaque gratuite, Désengagement/Fuite) ; Sans peur (Talent) ; AA — Carrière Prêtre de Myrmidia.
**Implémente :** _(généré — `npm run raw:implemente`)_
- `AA 6` (l.465-468, l.469-551) → `combat-aa-bleed`, `combat-aa-blessures`, `progression-schemas-derived`, `pretre-de-myrmidia`, `commander-la-legion`, `terrifier-l-ennemi`, `en-bon-ordre`, `connais-ton-ennemi`, `en-terrain-dangereux`, `frappe-rapide`, +7 — `src/data/careerLevels.json`, `src/data/careers.json`, `src/data/combat-stakes.json`, `src/data/progression-schemas.derived.json` ⚠hors-app, `src/data/reglesOptionnelles.json`, `src/data/spells.json`
- dette : #375

---

## ADE II : combat de masse (Puissance de Bataille) et machines de guerre

Sous-système **facultatif** d'*Archives de l'Empire : volume 2* (chapitre « Le théâtre de la guerre ») pour mener des batailles à grande échelle tout en gardant les Personnages au centre de l'action. C'est le système RAW vers lequel *Aux Armes* (AA) renvoie explicitement pour les affrontements de grande ampleur. Ces règles ne simulent pas l'intégralité d'une bataille (« si c'est ce que vous cherchez, essayez le *Warhammer Fantasy Battle, le jeu de figurines* ») : elles offrent des **scènes de jeu de rôle** dont l'issue modifie le score abstrait de **Puissance** de chaque camp [ADE II 08 l.13-15].

> ⚠️ Les valeurs des machines de guerre ci-dessous sont celles d'**ADE II** (système de combat de masse, abstrait), distinctes des armes de siège **maniables** d'*Aux Armes* (`trappings.json`, source AA 10 p.122 — ex. Baliste **+12** Recharge 3 en AA contre Baliste **+14** Recharge 2 ici). Ne pas confondre les deux jeux de stats.

### Puissance — le score d'armée

Le combat de masse oppose deux camps, chacun doté d'un **Attribut de Puissance** (taille de l'armée + maîtrise relative des soldats). La Puissance sert à chaque Round à infliger des dégâts à l'armée adverse, et est **recalculée à la fin de chaque Round** pour tenir compte des péripéties [ADE II 08 l.19].

**Puissance de Bataille** : avant la bataille, le MJ fixe la Puissance de chaque armée, valeur **comprise entre 0 et 100** reflétant taille et force. Table d'estimation (force du camp des Personnages relative à l'adversaire) [ADE II 08 l.24-33] :

| Armée des Personnages | Puissance alliée | Puissance ennemie | Exemple |
|---|---|---|---|
| Insignifiante | 30 | 70 | Une défense de ville provinciale face à un Comte vampire et sa légion de morts-vivants. |
| Désavantagée | 40 | 60 | Une compagnie de mercenaires contre un Waaagh ! de peaux-vertes. |
| De force égale | 50 | 50 | Des armées provinciales qui s'affrontent sur le champ de bataille. |
| Avantagée | 60 | 40 | Un château bien approvisionné se défendant contre une horde de guerriers de clans skavens mal organisés. |
| Écrasante | 70 | 30 | Une alliance d'humains et de nains prenant d'assaut un bivouac d'hommes-bêtes. |

**Méthode de construction par modificateurs** : faire commencer chaque armée à **Puissance 30**, lui accorder un modificateur pour chaque aspect qui s'applique, puis **retirer 10 aux deux armées** jusqu'à ce que la Puissance soit comprise entre 0 et 100. Si la différence de Puissance entre les deux armées dépasse 100, l'issue du combat est déjà décidée [ADE II 08 l.34].

**Modificateurs de Puissance de Bataille** [ADE II 08 l.35-47] :

| Modificateur | Mod. de Puissance | Exemples |
|---|---|---|
| Mal équipée | −10 | Armure Légère (Armure 1) ou moins, Armes improvisées, Arme +4 ou moins |
| Bien équipée | +10 | Armure Lourde (Armure 3), Armes à Poudre noire, Arme +10 ou plus |
| Comprend des lanceurs de sorts | +10 | Sorciers, prêtres, vampires |
| Comprend des Unités Vétérans | +10 | Compétence Corps à corps ou Projectiles de 45 ou plus |
| Comprend des Unités Élites | +20 | Compétence Corps à corps ou Projectiles de 60 ou plus |
| Comprend des Unités de Taille Petite | −10 | Halflings, snotlings |
| Comprend des Unités de Taille Grande | +10 | Ogres, trolls, cavalerie à cheval |
| Comprend des Unités de Taille Énorme | +20 | Griffons, vouivres |
| Comprend des Unités de Taille Monstrueuse | +30 | Dragons, géants |

*Exemple RAW : une unité de Chevaliers Panthères + une milice de paysans face à une armée orcs/gobelins de taille similaire. Les Chevaliers sont Bien équipés (+10) et Vétérans (+10), d'où une Puissance de 50 (30 +10 +10). Les orcs sont Vétérans (+10), Puissance 40 (30 +10). Léger avantage humain* [ADE II 08 l.48].

**Option : le Coût de la Guerre** — l'entretien quotidien d'une armée = la somme des Statuts de chaque soldat (100 chevaliers à Statut Argent 5 → 500 pistoles d'argent/jour). Payer la moitié = **−10 à tous les Tests de Puissance**. Ne rien payer → l'armée se disperse en 2 jours ; un Test de **Commandement Intermédiaire (+0)** réussi la fait tenir DR jours de plus, mais avec **−20 à tous les Tests de Puissance** [ADE II 08 l.55-56].

### Activités de bataille (Entre deux aventures)

Préparatifs avant la bataille, résolus par un Test de Compétence (max **3 Activités** par Personnage). Une Activité ratée n'est pas réessayable sans une approche différente [ADE II 08 l.65-67].

| Activité | Test | Effet en cas de Succès |
|---|---|---|
| **Discours Inspirant** | Commandement (Difficulté = différence de Puissance entre armées, arrondie à la dizaine) | +10 au Test de Puissance pendant le **premier Round** de bataille [ADE II 08 l.69-71] |
| **Planification** | Savoir (Guerre) (Difficulté selon différence de Puissance, terrain, plan) ; un aidant avec ≥1 Augmentation en Savoir (Guerre) | +10 à **tous** les Tests de Puissance toute la bataille ; **+20** sur Succès Stupéfiant (+6) [ADE II 08 l.79-80] |
| **Repérage** | Chevaucher + Perception Intermédiaire (+0), combiné | Effectifs/distance/troupes + Puissance adverse révélés, **+10 à Planification** ; Échec Stupéfiant (−6) → poursuite/capture [ADE II 08 l.100-101] |
| **Infiltration** (après Planification réussie) | Discrétion + Perception (combiné), ou Divertissement (Interprétation) + Perception | **+20 à Planification** ; Échec → fuite forcée. Bien plus difficile si Race différente [ADE II 08 l.73-77] |
| **Sabotage** (après Repérage réussi) | Discrétion ou Divertissement (Interprétation) | ennemi **−5 Puissance** ; **−10** sur Succès Stupéfiant (+6) ; Échec → fuite/combat [ADE II 08 l.104-105] |
| **Rassembler des Forces** | Test selon la méthode (mercenaires, mobilisation, charme/pot-de-vin/intimidation) | armée **+5 Puissance** ; **+10** sur Succès Stupéfiant (+6) ; **−10** sur Échec Stupéfiant (−6, mutinerie/désertion) [ADE II 08 l.94-96] |
| **Autres Préparations** | au choix du MJ (Test + Difficulté + récompense + pénalité sur −6) | bonus de Puissance/Activité, ou ±Puissance [ADE II 08 l.108-110] |

### Le déroulé d'une bataille

Une bataille = un ou plusieurs **Rounds de bataille**, chacun enchaînant : **configuration du terrain** (description, scènes disponibles) → **scènes cinématiques** (les Personnages y jouent des Rounds de Combat / Tests) → **Test spectaculaire de Puissance** → **rassemblement** (récupération) → répétition si nécessaire. Une escarmouche peut tenir en 1 Round ; un siège dure au moins 5 Rounds. À la fin des Rounds prévus, **l'armée à la Puissance la plus élevée gagne** ; le camp adverse fuit sous peine d'être détruit [ADE II 08 l.112-124].

- **Test spectaculaire de Puissance** : les deux armées s'affrontent par un Test spectaculaire **non opposé**, résolu simultanément sur la Puissance actuelle. Chaque camp réduit la Puissance de l'adversaire de **10 + DR (5 minimum)** [ADE II 08 l.120].
- **Rassemblement** : Test de **Résistance Intermédiaire (+0)** → guérit **DR + Bonus d'Endurance** Blessures ; un Personnage avec Guérison peut faire un Test de **Guérison Intermédiaire (+0)** pour soigner d'autres Personnages ; potions utilisables [ADE II 08 l.122].

> Les Scènes cinématiques ne peuvent **jamais** augmenter la Puissance au-delà de sa valeur de départ [ADE II 08 l.135].

### Scènes de bataille (génériques) — effets chiffrés sur la Puissance

[ADE II 08 l.138-178]

- **Charge** — un/plusieurs Personnages chargent dans la mêlée, max **2 Rounds**. Le camp qui charge commence avec **1 Avantage**, puis ordre d'Initiative. Chaque ennemi touché → Puissance ennemie **−1** ; chaque ennemi neutralisé/tué → **−2** de plus [ADE II 08 l.138-139].
- **Pluie de Flèches** — Personnages avec Armes à distance, **2 Rounds** pour tirer sur l'ennemi en approche (jusqu'à être attaqués ou en sécurité). Chaque touche → Puissance adverse **−1** ; cible neutralisée/tuée → **−2** de plus. Les attaques à distance contre une foule ne touchent jamais deux fois la même cible. Armes de siège utilisables ici [ADE II 08 l.144-145].
- **Motivation** — résout un problème interne (blessés, moral, désertion) par un Test de Compétence. Succès → armée **+DR Puissance**. Peut être une tentative unique, un Test étendu sur plusieurs Rounds, ou plusieurs Tests cumulant un gros bonus [ADE II 08 l.150-151].
- **Protection** — protéger une arme/un allié important pendant **3 Rounds de Combat** (l'ennemi vise une cible précise). Succès → adverse **−5 Puissance** OU votre armée **+5**. Un Personnage qui réussit un Test de Compétence en soutien à la cible **réduit la durée de 1 Round** [ADE II 08 l.156-157].
- **Tenez Votre Position** — l'ennemi submerge une position avantageuse. Chaque Round, Test opposé ennemi vs Personnages (Compétences adaptées). Le cumul des DR ennemis = **Point de rupture** : s'il atteint **10 ou plus**, ou si **5 Rounds** passent, déroute. Pour chaque Round tenu avant que le Point de rupture n'atteigne 10, l'armée adverse perd **−2 Puissance**, mais gagne un **bonus cumulatif de +10** pour les Rounds successifs [ADE II 08 l.162-163].
- **Compte À Rebours** — **3 Rounds** pour empêcher l'ennemi de porter un coup dévastateur et réduire sa Puissance de **−10**. Échec → déclenche une Scène de Motivation [ADE II 08 l.168-169].
- **Percée** — prendre le contrôle d'une position ennemie (éliminer tous les soldats ou remplir un objectif) en **3 Rounds** → armée **+10 Puissance**. Échec → retraite, ou Scène de Charge si l'ennemi appelle des renforts [ADE II 08 l.174-175].

### Scènes uniques (exemples MJ)

[ADE II 08 l.207-225]

- **Ligne de Mire** — charger/attaquer (jusqu'à **12 m**) un capitaine ennemi isolé. Succès → ennemi **−5 Puissance** ; si c'est le **général** tué/neutralisé → **−5** de plus. Puis le Personnage doit battre en retraite ; s'il insiste pour attaquer, il subit au Round suivant une Scène de Charge où seul l'ennemi charge, en **supériorité numérique 3 contre 1** [ADE II 08 l.207-208].
- **Tuez la Bête !** — vaincre une créature gigantesque en **3 Rounds** → ennemi **−10 Puissance**. **Diviser par deux** les Blessures de départ de la créature (autres troupes l'attaquant). Pour une créature Monstrueuse : grimper dessus ou arme de siège proche. La créature peut se débarrasser des grimpeurs par un Test opposé **Corps à corps (Bagarre) / Escalade** ; si elle échoue, on l'attaque comme **Sans défense** [ADE II 08 l.211-213].
- **Survol** — monture volante, **une seule tentative** pour surprendre le général à l'arrière. Test de **Chevaucher Intermédiaire (+0)** → attaque à distance (ou autre Action) à **15 − DR mètres** ; Succès Stupéfiant (+6) → Corps à corps / Bout portant. Attaque réussie → ennemi **−5 Puissance** ; général neutralisé/tué → **−15** de plus. Échec Stupéfiant (−6) → chute de 5 m au milieu de la bataille, puis Scène de Charge où seul l'ennemi charge [ADE II 08 l.216-217].
- **Intrus** — sanguinaires de Khorne infiltrés dans le camp. Tant qu'ils ne sont pas vaincus, **tous les Tests des autres Scènes subissent −20** (désordre) [ADE II 08 l.220-221].
- **Duel** — les généraux (idéalement un Personnage) se font face. Le camp vaincu au duel → **−20 Puissance**. Si un autre Personnage intervient et tue le général adverse → seulement **−10** + Scène de Charge contre l'ennemi [ADE II 08 l.224-225].

### Machines de Guerre

Stats des machines utilisables en combat pendant les scènes cinématiques. Une **Équipe** = le groupe entraîné requis. Arme sans Équipe complète : **−20** ; inutilisable sous la **moitié** de l'Équipe nécessaire. Toutes les machines ont les Atouts **Dévastatrice** et **Percutante**. Toutes utilisent **Projectiles (Machine de guerre)**, **sauf le bélier** qui utilise **Force**. Béliers : dégâts aux **portes seulement** (sinon Arme improvisée). Trébuchets et mortiers inutilisables si la cible est plus proche que leur Portée Courte. Armes de siège à distance : pas de tir à Bout Portant [ADE II 08 l.233-256].

| Arme | Prix | Équipe | Disponibilité | Portée / Allonge | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| Baliste | 75 CO | 4 | Rare | 150 | +14 | Empaleuse, Perforante, Recharge 2 |
| Bélier* | 10 CO | 6 | Limitée | Moyenne | +BF +10 | Siège |
| Batterie tonnerre de feu | 200 CO | 4 | Exotique | 200 | +12 | Dangereuse, Explosion 15, Imprécise, Recharge 5 |
| Canon à répétition feu d'enfer | 300 CO | 4 | Exotique | 100 | +14 | À Poudre noire, À répétition 3, Dangereuse, Explosion 5, Recharge 5 |
| Canon | 120 CO | 4 | Exotique | 120 | +20 | À Poudre noire, Dangereuse, Explosion 3, Recharge 3, Siège |
| Canon à flammes nain | 200 CO | 4 | Exotique | 60 | Spéciaux | Dangereuse, Explosion 5, Imprécise, Recharge 3 |
| Mangonneau | 60 CO | 6 | Rare | 60 | +10 | Explosion 5, Recharge 4, Siège |
| Onagre | 80 CO | 6 | Rare | 100 | +12 | Explosion 5, Recharge 4, Siège |
| Trébuchet** | 40 CO | 8 | Limitée | 150 | +14 | Explosion 5, Recharge 5, Siège |
| Mortier** | 100 CO | 6 | Exotique | 200 | +20 | À Poudre noire, Dangereuse, Explosion 5, Imprécise, Recharge 2, Siège |

\* Béliers : dégâts aux portes uniquement, sinon Arme improvisée [ADE II 08 l.252].
\*\* Trébuchets/mortiers : inutilisables sous leur Portée Courte ; armes de siège à distance jamais à Bout Portant [ADE II 08 l.254].

Note spéciale : le **Canon à flammes nain** inflige **2 + DR États *En flammes*** à chaque cible affectée [ADE II 08 l.270].

**Machines de Guerre et Puissance** — au calcul de la Puissance totale (avant réduction), chaque machine de guerre apporte **+5 Puissance**. En **siège**, toute machine avec l'Atout **Siège** du côté offensif apporte **+10** à la place. Sans Équipe complète : **diviser leur Puissance par deux** [ADE II 08 l.302-304].

### Structures de siège (Barricades et Protections Typiques)

[ADE II 08 l.281-301]

| Structure | BE | Blessures (BL) | Atouts et Défauts |
|---|---|---|---|
| Porte | 2 | 8 | Résistant |
| Porte blindée | 5 | 15 | Résistant |
| Porte de ville | 10 | 30 | Impénétrable |
| Mur en bois | 6 | 15 | Résistant |
| Mur en pierre | 12 | 40 | Impénétrable |

- **Atout Siège** : une arme avec cet Atout inflige le **double des dégâts** aux structures physiques (murs, tours, portes) [ADE II 08 l.291-292].
- **Atout Résistant** : structure non-abîmable par une **Arme à distance** sans l'Atout Siège [ADE II 08 l.295-296].
- **Atout Impénétrable** : structure non-abîmable par **toute Arme** sans l'Atout Siège [ADE II 08 l.299-300].

### Autres options

- **Horreurs de la Guerre** : l'horreur peut imposer de nouveaux Traits Psychologiques (Peur/Terreur d'une créature, via l'Annexe I) ; une charge de cavalerie à grandes montures provoque Peur ou Terreur (WFJDR p.343). Perdre une bataille importante peut donner *Animosité (Cible)* → potentiellement *Haine* — toujours facultatif [ADE II 08 l.181-186].
- **Facteurs Environnementaux** (table 1d10, facultative) : pièges, armes de siège (Esquive Facile (+40) ou Critique), influence corruptrice (Résistance Intermédiaire ou +1 Corruption), nuage toxique, broussailles gênantes, rivière, brasier, retour à la vie (nécromancien), peur (structure terrifiante : −10 à tous les Tests de Puissance tant qu'intacte) [ADE II 08 l.307-321].

**Sources RAW** :
- `ADE II 08 l.13-19` — nature facultative du système ; la Puissance comme score d'armée recalculé chaque Round (CONSOLIDE tous livres ; renvoi explicite d'AA pour les grandes batailles).
- `ADE II 08 l.24-33` — table d'estimation de la Puissance de départ (Insignifiante→Écrasante, 30/70 … 70/30).
- `ADE II 08 l.34-47` — méthode de construction (base 30, −10 itératif) + table des modificateurs de Puissance de Bataille (équipement, lanceurs, Vétérans/Élites, Tailles).
- `ADE II 08 l.55-56` — Option Coût de la Guerre (entretien, demi-solde −10, Commandement +0 / −20).
- `ADE II 08 l.65-110` — Activités de bataille (Discours Inspirant, Planification, Repérage, Infiltration, Sabotage, Rassembler des Forces, Autres).
- `ADE II 08 l.112-135` — déroulé d'une bataille (Rounds, Test spectaculaire de Puissance 10+DR min 5, rassemblement) + plafond « pas au-delà de la valeur de départ ».
- `ADE II 08 l.138-178` — 7 Scènes de bataille (Charge, Pluie de Flèches, Motivation, Protection, Tenez Votre Position, Compte À Rebours, Percée) avec effets chiffrés sur la Puissance.
- `ADE II 08 l.207-225` — Scènes uniques (Ligne de Mire, Tuez la Bête !, Survol, Intrus, Duel).
- `ADE II 08 l.227-270` — table des Machines de Guerre (Prix/Équipe/Disponibilité/Portée/Dégâts/Atouts) + règles d'Équipe + Canon à flammes nain (2+DR En flammes).
- `ADE II 08 l.281-304` — table des Structures de siège (BE/BL + Atouts) + Atouts Siège/Résistant/Impénétrable + Machines de Guerre et Puissance (+5 / +10 siège / ÷2 sans équipe).
- `ADE II 08 l.307-321` — Option Facteurs Environnementaux (table 1d10).

> « pour un affrontement à grande échelle, il renvoie aux règles de combat de masse d'Archives de l'Empire : volume 2 » — renvoi RAW d'AA vers ce chapitre.

> « Toutes les machines de guerre ont les Atouts Dévastatrice et Percutante. Elles utilisent toutes la Compétence Projectiles (Machine de guerre), à l'exception du bélier, qui utilise Force. » — `ADE II 08 l.233`

> « Une arme avec l'Atout Siège inflige le double des dégâts aux structures physiques telles que les murs, les tours et les portes. » — `ADE II 08 l.292`

**Voir aussi** : aa-structures-sieges (armes de siège *maniables* d'AA, stats distinctes — Baliste +12 / Recharge 3 vs ici +14 / Recharge 2) ; les entrées Combat (Tests spectaculaires, DR, États En flammes/Empoisonné/Empêtré/Surpris/À Terre/Sans défense) ; Corruption (Facteurs Environnementaux, influence corruptrice) ; Psychologie (Peur/Terreur/Animosité/Haine, Horreurs de la Guerre).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `ADE II 8` (l.13-19, l.24-33, l.34-47, l.48, l.55-56, l.65-110, l.112-135, l.138-178, l.207-225, l.227-270, l.281-304, l.307-321) → `scene`, `insignifiante`, `porte`, `warMachineCrewPenalty`, `RAM_POS`, `MassBattleView`, `desavantagee`, `RAM_CREW`, `egale`, `isMeleeWarMachine`, +120 — `src/data/activities.json`, `src/data/index.ts`, `src/data/mass-battle.json`, `src/data/qualities.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, +39 fichiers
- sans code : `ADE II 8` (l.174-175, l.181-186)

---

## Armes et armures des ogres (ADE II)

Les ogres forgent et utilisent leurs **propres armes et armures**, distinctes des versions « taille ogre » des possessions ordinaires. Ces créations — immenses massues, lance-harpons, canons crache-plomb, pansières — sont **réservées aux ogres** ([ADE II 02 l.605]). Trois conséquences mécaniques majeures les distinguent de l'équipement standard de cette entrée du domaine Combat :

- **L'Encombrement n'est PAS doublé.** Contrairement aux versions « taille ogre » des possessions humaines (qui valent deux fois l'Enc. classique et coûtent deux fois plus cher), ces armes propres aux ogres portent l'Enc. tel qu'indiqué dans les tables ci-dessous — pas de doublement ([ADE II 02 l.605], cf. l.634-635).
- **Inutilisables par les races Moyennes et Petites.** « Ces armes sont pratiquement inutilisables entre les mains des créatures de Taille Moyenne et […] la plupart des Petites créatures auront même du mal à les soulever. » ([ADE II 02 l.605]).
- **La disponibilité indiquée vaut pour l'Empire**, où certaines de ces armes sont plus rares que dans les Montagnes des Larmes ([ADE II 02 l.616], l.580).

Le topic [armes-melee-tables] écarte explicitement ces armes (« relèvent de l'équipement de créature, hors périmètre de cette entrée ») ; cette entrée les transcrit verbatim, à l'instar des tables d'armes d'Aux Armes / Zoo Impérial déjà rattachées au domaine Combat.

> « Attention : il s'agit d'armes réservées aux ogres, les points d'Encombrement n'ont donc pas besoin d'être doublés comme pour les autres Possessions (voir p. 31). Inutile de préciser que ces armes sont pratiquement inutilisables entre les mains des créatures de Taille Moyenne et que la plupart des Petites créatures auront même du mal à les soulever. » — `ADE II 02 l.604`

À noter sur les versions « taille ogre » des armes ordinaires (≠ armes propres ci-dessous) : elles n'ont pas d'effets supplémentaires hormis leur poids, « si ce n'est qu'elles peuvent potentiellement acquérir les Atouts Dévastatrice et Percutante en plus d'augmenter les dégâts contre les Petites créatures » ([ADE II 02 l.602]).

### Armes de Corps à corps des ogres

| Arme | Prix | Enc. | Disponibilité* | Allonge | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| **BASE** | | | | | | |
| Massue ogre | 1 CO | 2 | Courante | Moyenne | BF+4 | Spéciale** |
| Poing de fer | 4 CO | 2 | Limitée | Courte | BF+3 | Défensive, Protectrice 1 |
| **DEUX MAINS** | | | | | | |
| (2M) Grande massue ogre | 5 CO | 6 | Courante | Longue | BF+6 | Dévastatrice, Spéciale** |

*La disponibilité est indiquée pour l'Empire, où certaines armes sont plus rares que dans les Montagnes des Larmes.
**Les massues des ogres sont toujours personnalisées en fonction des préférences de leur utilisateur (voir Personnalisations de massue, ci-dessous).
— `ADE II 02 l.607-618`

### Armes à distance des ogres

| Arme | Prix | Enc. | Disponibilité* | Portée | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| **ENTRAVES** | | | | | | |
| Lance-harpon | 8 CO | 5 | Exotique | 20 | +10 | Entraves, Recharge 2 |
| Piège à chaînes | 1 CO | 2 | Limitée | BFx2 | +7 | Entraves |
| **LANCER** | | | | | | |
| Grande lance | 6/– | 2 | Limitée | BFx3 | BF+4 | Empaleuse |
| **POUDRE NOIRE*** | | | | | | |
| (2M) Canon crache-plomb | 14 CO | 8 | Exotique | 50 | +10 | Dangereuse, Recharge 5 |
| Pistolet ogre | 9 CO | 3 | Exotique | 20 | +8 | Pistolet, Recharge 1 |

*La disponibilité est indiquée pour l'Empire, où certaines armes sont plus rares que dans les Montagnes des Larmes.
— `ADE II 02 l.620-634`

### Munitions des ogres

| Arme | Prix | Enc. | Disponibilité | Portée | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| **ENTRAVES** | | | | | | |
| Harpon (6) | 5/– | 0 | Exotique | Comme l'arme | — | Empaleuse |
| **POUDRE NOIRE** | | | | | | |
| Balle crache-plomb (12) | 4/– | 0 | Limitée | Moitié de l'arme | — | Explosion 3 |
| Boulet crache-plomb (1) | 1 CO* | 0 | Limitée | Comme l'arme | +4 | Empaleuse, Percutante, Perforante |

*« Fondamentalement, il s'agit d'un boulet de canon. Le prix indiqué pour un boulet crache-plomb comprend 2/- pour la quantité de poudre suffisante pour tirer un seul coup. Le boulet peut souvent être récupéré. En le tirant à nouveau, vous dépensez uniquement le prix de la poudre. »
— `ADE II 02 l.637-646`

### Armures des ogres

| Armure | Prix | Enc. | Disponibilité | Pénalité | Emplacements | PA | Atouts et Défauts |
|---|---|---|---|---|---|---|---|
| **PLATE** | | | | | | | |
| Pansière ogre* | 20 CO | 4 | Rare | – | Corps | 3 | Impénétrable |

*« Les pansières des ogres sont particulièrement adaptées à leur anatomie. Même si elles étaient réduites, elles n'offriraient qu'une protection partielle aux races dont les organes vitaux ne se trouvent pas dans leur ventre. »
— `ADE II 02 l.649-656`

### Personnalisations de massue

Une **massue ogre** ou une **grande massue ogre** peut être personnalisée d'une des caractéristiques suivantes (ce qui justifie le Défaut « Spéciale** » des deux entrées ; voir **WFJDR** p. 297 pour ces Atouts) :

- **Plaques de métal** : l'arme gagne l'Atout **Assommante**.
- **Pointes rouillées** : l'arme gagne l'Atout **Perforante**.
- **Lames récupérées** : l'arme gagne l'Atout **Taille**.

— `ADE II 02 l.663-668`

### Règles spéciales par arme

- **Poing de fer** — « énorme gantelet » d'art du combat de fosse. **Solidement fixé** au poing de l'ogre : il **ne pourra pas en être désarmé**. La main équipée du poing de fer peut tout de même tenir une arme ou effectuer des actions simples ([ADE II 02 l.692-696]).
- **Pistolet ogre** — version améliorée de l'équivalent Impérial, utilise les mêmes munitions et la même poudre qu'une arme typique à poudre noire (**WFJDR** p. 297). Suffisamment solide pour **servir d'arme simple** ; il **ne se brise qu'en cas de Maladresse** ([ADE II 02 l.681-685]).
- **Lance-harpon** — tire une énorme flèche de la taille d'une lance attachée à une longue corde, sans mécanisme de rappel (l'ogre saisit la corde et tire sa proie à la main). Il peut être utilisé avec les Compétences **Projectiles (Arbalète)** ou **Projectiles (Entraves)** sans pénalité. **Si la corde est séparée de la flèche, la portée passe à 60 et l'arme ne possède plus l'Atout Immobilisante** ([ADE II 02 l.673-674], l.600).
- **Piège à chaînes** — mâchoires métalliques à ressort au bout d'une longue chaîne robuste ; outil de chasse lancé sur la cible puis ramené ([ADE II 02 l.671-672]).
- **Grande lance** — javelots massifs et rudimentaires des chasseurs ogres pourchassant les grandes bêtes des Montagnes des Larmes ([ADE II 02 l.669-670]).
- **Canon crache-plomb** — summum de l'ingénierie ogre, chargé par la culasse, déclenché par une mèche ; bombarde tout ce que le porteur a sous la main (chaînes, briques, grenailles de plomb, pierres, clous rouillés) ou de véritables boulets de canon récupérés sur le champ de bataille ([ADE II 02 l.664-666]).
- **Massues ogres** — les armes les plus simples ; les ogres parcourent champs de bataille, forêts et cimetières pour trouver une bonne massue solide et les matériaux pour l'adapter (cf. Personnalisations ci-dessus) ([ADE II 02 l.663-665]).
- **Pansière** — faite de métal, bois dur, os ou cuir ; protège le ventre, siège de la plupart des organes vitaux de l'ogre, et sert de support aux symboles militaires/religieux (souvent la Gueule, un anneau de dents déchiquetées) ([ADE II 02 l.703-704]).

### Versions « taille ogre » des possessions ordinaires (Un Lourd Fardeau)

À distinguer des armes propres ci-dessus : la version ogre de la plupart des possessions humaines **vaut deux fois l'Encombrement classique et coûte deux fois plus cher**. De plus, un ogre mange et boit au moins deux fois plus qu'un humain par jour, et ne ressent aucun effet des drogues/poisons « à moins qu'on lui administre deux fois la dose standard ». En contrepartie, **un ogre peut porter deux fois l'Encombrement normal d'un humain : (Bonus de Force + Bonus d'Endurance) × 2** ([ADE II 02 l.707-708]).

Un ogre subit **-20 à tous les Tests** lorsqu'il tente d'utiliser des possessions non prévues pour sa taille, « en plus de trouver certaines choses impossibles à faire » (ex. un doigt d'ogre ne peut presser la détente d'un pistolet à répétition humain) ([ADE II 02 l.710-711]).

**Sources RAW** :
- `ADE II 02 l.601-605` — Équipement des ogres : armes/armures propres aux ogres, réservées aux ogres, Enc. non doublé, inutilisables par Moyens/Petits (CONSOLIDE).
- `ADE II 02 l.607-618` — Table « Armes de Corps à corps des ogres » verbatim (Massue ogre, Poing de fer, Grande massue ogre 2M) + notes de disponibilité et de personnalisation.
- `ADE II 02 l.620-634` — Table « Armes à distance des ogres » verbatim (Lance-harpon, Piège à chaînes, Grande lance, Canon crache-plomb 2M, Pistolet ogre).
- `ADE II 02 l.637-646` — Table « Munitions des ogres » verbatim (Harpon, Balle crache-plomb, Boulet crache-plomb) + note de récupération du boulet.
- `ADE II 02 l.649-656` — Table « Armures des ogres » verbatim (Pansière ogre, PA 3, Impénétrable).
- `ADE II 02 l.658` — Lance-harpon : Projectiles (Arbalète/Entraves) sans pénalité ; corde séparée → portée 60 et perte de l'Atout Immobilisante.
- `ADE II 02 l.663-668` — Description des massues + 3 personnalisations (Plaques de métal → Assommante ; Pointes rouillées → Perforante ; Lames récupérées → Taille).
- `ADE II 02 l.669-696` — Règles spéciales par arme (Grande lance, Piège à chaînes, Lance-harpon, Pistolet ogre incassable sauf Maladresse, Poing de fer non désarmable).
- `ADE II 02 l.698-704` — Description des armures (seule la pansière vise la protection ; anatomie ogre).
- `ADE II 02 l.707-711` — Un Lourd Fardeau : versions « taille ogre » (Enc. ×2, prix ×2, port ×2, dose poison ×2, -20 hors-taille).

> « Toutefois, il est suffisamment solide pour servir d'arme simple et ne se brise qu'en cas de Maladresse. » — `ADE II 02 l.691` (Pistolet ogre)

> « Le poing de fer est solidement fixé à celui de l'ogre, de sorte qu'il ne pourra pas en être désarmé. » — `ADE II 02 l.695`

**Voir aussi** : armes-melee-tables ; armes-distance-munitions-tables ; armures-tables ; atouts-defauts-armes ; ogres-regles-de-taille (Frappe Mortelle / Peur / Désengagement)

**Implémente :** _(généré — `npm run raw:implemente`)_
- `ADE II 2` (l.601-605, l.607-618, l.620-634, l.637-646, l.649-656, l.658, l.663-668, l.669-696, l.698-704, l.707-711) → `traitCapabilitiesSchema`, `traitConsumptionFactor`, `useAttackJetProps`, `WeaponSpec`, `doc`, `WeaponContext`, `effectiveWeapon`, `dailyFoodUpkeep`, `itemFromTrappingById`, `provisioningManifest`, +29 — `src/data/index.ts`, `src/data/regles.json`, `src/data/schemas/defs/traits.ts`, `src/data/schemas/defs/trappings.ts`, `src/data/traits.json`, `src/data/trappings.json`, +12 fichiers

---


---

<!-- MDG-INTEGRATION -->

## MDG : combat naval — Endurance, Blessures et Localisation des Dégâts d'un navire

Le supplément *La Mer des Griffes* (chapitres 12-13) ajoute un sous-système de **combat naval** : un navire est traité comme une grosse cible à Caractéristiques propres (Endurance, Blessures), avec sa propre table de Localisation des Dégâts, ses Coups Critiques dédiés (topic suivant) et des règles spécifiques pour les attaques de petites armes, de corps à corps et l'artillerie. Ce topic couvre **comment un navire encaisse les Dégâts** : son profil défensif, où les coups se logent, et les cas particuliers selon la nature de l'attaque.

### Profil défensif d'un navire (E / BE / B / BB)

Chaque bateau a un score d'**Endurance (E)** et un score de **Blessures (B)** (`MDG 12 l.56-64`, `MDG 13 l.569`) :

- **Endurance (E)** : sert à savoir s'il peut résister à des Dégâts. **Le premier chiffre de l'Endurance est le Bonus d'Endurance (BE)** du bateau, qui est **déduit de tous les Dégâts qui lui sont infligés** avant de les appliquer aux Blessures (`MDG 12 l.58`).
- **Blessures (B)** : comme pour un Personnage, indique quelle quantité de Dégâts le bateau peut subir. **Le nombre des dizaines des Blessures restantes est le Bonus de Blessures (BB)** ; ce Bonus est basé sur les Blessures **actuelles**, donc il peut **changer au cours d'une rencontre** (`MDG 12 l.60-64`).

> « Le BE d'un bateau est déduit de tous les Dégâts qui lui sont infligés avant de les appliquer aux Blessures. » — `MDG 12 l.58`

Le **Blindage** (Amélioration de coque) fonctionne comme une armure : les Dégâts des coups touchant la Coque sont réduits des PA **puis** du BE. Contrairement à une armure personnelle, **le Blindage d'un navire ne peut pas être sacrifié pour éviter les Blessures Critiques** (`MDG 12 l.232`). Bronze = 1 PA à la Coque ; Fer = 2 PA, mais si le vaisseau devient *Sali* les plaques de fer rouillent et les PA sont retirés (`MDG 12 l.234-236`). Un **Bélier** fixé à la proue fournit **5 PA** protégeant contre les Dégâts d'une collision ou d'une attaque venant de l'avant (`MDG 12 l.221`).

### Localisation des Dégâts sur un bateau

Pour déterminer la Localisation, **inversez le résultat du jet d'attaque** comme dans un combat livré entre Personnages, **ou lancez 1d100**, puis consultez la colonne adaptée au type de propulsion (`MDG 13 l.571`) :

| d100 | Bateau à avirons | Bateau à voile | Bateau à avirons et à voile |
|---|---|---|---|
| 01-09 | Équipage | Équipage | Équipage |
| 10-20 | Avirons | Gréement | Gréement |
| 21-40 | Coque | Coque | Avirons |
| 41-65 | Coque | Coque | Coque |
| 66-84 | Équipements | Équipements | Équipements |
| 85-00 | Cargaison | Cargaison | Cargaison |

— `MDG 13 l.575-582`

Un coup sur l'**Équipage** signifie qu'un membre d'équipage **exposé** au coup est touché (résolu comme un combat normal). **Si aucun membre d'équipage n'était exposé, le coup touche la Coque.** Sur un bateau non ponté (ex. chaloupe), un coup à l'Équipage peut toucher la Cargaison au lieu d'un matelot (`MDG 13 l.584`). Sauf précision contraire, les coups d'une **collision** touchent toujours la **Coque** (`MDG 13 l.464`).

### Tirs de petites armes contre un navire

Les tirs de **petites armes** (armes à projectiles autres que l'artillerie) n'infligent généralement **pas assez de Dégâts pour affecter le vaisseau**, mais ils ont une chance de blesser un membre d'équipage exposé — il peut donc valoir la peine de lancer les dés au cas où un matelot serait touché (`MDG 13 l.605`). Le MJ (ou le Joueur) décide si l'on vise **un membre d'équipage précis** (souvent difficile, des parties du bateau lui servant de couvert) ou **le navire** (cible plus grande, mais la plupart des projectiles frappent des structures qui les ignorent, seuls quelques coups de chance touchant l'équipage) (`MDG 13 l.607`).

### Attaques de corps à corps contre un navire

Si des ennemis attaquent **directement l'équipage**, c'est géré comme un combat entre Personnages. Toute attaque de corps à corps portée contre **une autre partie du bateau touche automatiquement**, et l'attaquant peut **choisir la Localisation visée**, à condition de pouvoir l'atteindre (`MDG 13 l.612`).

Les armes de corps à corps ne sont pas conçues pour endommager un bateau, mais on peut en dégrader un sur une longue période. Le **BE du navire est ajusté selon le Tableau de comparaison des Tailles** (taille du navire vs taille de l'attaquant) ; une **case vide = aucun Dégât possible**. Ce tableau **remplace** les modificateurs de Taille normaux pour les Dégâts (`MDG 13 l.614-616`) :

| Taille du navire \ Attaquant | Minuscule | Très Petite | Petite | Moyenne | Grande | Énorme | Monstrueuse |
|---|---|---|---|---|---|---|---|
| Minuscule | – | 4 × BE | 3 × BE | 2 × BE | BE | BE−1 | BE−2 |
| Très Petite | – | – | 4 × BE | 3 × BE | 2 × BE | BE | BE−1 |
| Petite | – | – | – | 4 × BE | 3 × BE | 2 × BE | BE |
| Moyenne | – | – | – | – | 4 × BE | 3 × BE | 2 × BE |
| Grande | – | – | – | – | – | 4 × BE | 3 × BE |
| Énorme | – | – | – | – | – | – | 4 × BE |
| Monstrueuse | – | – | – | – | – | – | – |

— `MDG 13 l.618-637` (ex. : un halfling de Petite Taille attaquant une chaloupe Minuscule → le bateau **triple** son BE ; le même halfling contre un Grand bateau → **aucun Dégât**.)

### Réparer un navire

Les Dégâts se réparent **définitivement** sur un Test de **Métier (Constructeur de navires)** (ou **Métier (Charpentier)** à −10). Un constructeur naval PNJ répare pour 1 CO par Blessure ; chaque Test réussi prend **1d10 heures** et restaure **1d10 Blessures**. Les Dégâts à la **Coque** ne se réparent définitivement qu'**en cale sèche / quai sec** (`MDG 13 l.641-643`). Des **réparations temporaires** (sans cale sèche) sont possibles via un Test de **Métier (Constructeur de navires/Charpentier)** de **Complexe (−10)** à **Très Difficile (−30)** : chaque réparation prend 1 h et restaure 1d10 Blessures, mais le navire doit ensuite réussir un **Test d'Endurance** par jour de voyage et avant chaque Test de Manœuvre, chaque échec infligeant **1d10−4 Dégâts** (la réparation cède) (`MDG 13 l.649-651`).

**Sources RAW** :
- `MDG 12 l.56-64` — Caractéristiques défensives d'un navire : Endurance (1er chiffre = BE déduit de tous les Dégâts), Blessures (dizaines des Blessures restantes = BB, variable en cours de rencontre).
- `MDG 12 l.221` — Bélier : 5 PA protégeant des Dégâts d'une collision/attaque venant de l'avant (+ bonus à l'Indice de Collision, cf. topic Collisions).
- `MDG 12 l.232-236` — Blindage de coque : réduit les Dégâts Coque des PA puis du BE ; ne peut pas être sacrifié contre un Critique ; Bronze 1 PA, Fer 2 PA (perdus si Sali).
- `MDG 13 l.569-571` — Endurance modifie les Dégâts, Blessures = encaisse ; Localisation = jet d'attaque inversé ou 1d100.
- `MDG 13 l.575-584` — Tableau de Localisation des Dégâts pour un bateau (3 colonnes selon propulsion) ; coup à l'Équipage = matelot exposé sinon Coque ; bateau non ponté → peut toucher la Cargaison.
- `MDG 13 l.605-607` — Tirs de petites armes : Dégâts insuffisants contre la coque mais peuvent blesser un matelot exposé ; viser un matelot précis vs viser le navire.
- `MDG 13 l.612-616` — Attaques de corps à corps : auto-touche d'une partie du bateau, choix de la Localisation ; BE ajusté par le Tableau de comparaison des Tailles (remplace les modificateurs de Taille normaux).
- `MDG 13 l.618-637` — Tableau de comparaison des Tailles (navire vs attaquant → multiplicateur du BE ou aucun Dégât).
- `MDG 13 l.641-651` — Réparer les navires : Métier (Constructeur de navires / Charpentier −10), 1d10 h / 1d10 Blessures, Coque en cale sèche ; réparations temporaires (Test d'Endurance par jour/Manœuvre, 1d10−4 Dégâts si échec).
- `MDG 13 l.464` — Sauf précision contraire, les coups d'une collision touchent toujours la Coque.

> « Les armes de corps à corps ne sont pas conçues pour infliger des Dégâts aux bateaux, mais il est tout de même possible d'en dégrader un de cette manière sur une longue période. » — `MDG 13 l.614`

**Voir aussi** : Coups Critiques sur un navire (MDG) ; Collisions, Indice de Collision et béliers (MDG) ; Artillerie navale (MDG) ; Taille : catégories et modificateurs de combat ; Tableau de Localisation humanoïde ; Armures : table, PA, dégâts et réparation ; Résolution d'une attaque : les 4 étapes (jet inversé → Localisation).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 12` (l.56-64, l.221, l.232-236) → `CollisionShip`, `cargoTone`, `peu-maniable`, `doc`, `renforce`, `resolveCollision`, `scene`, `OverloadPalier`, `robuste`, `hullArmourBonus`, +29 — `src/data/index.ts`, `src/data/naval-traits.json`, `src/data/schemas/defs/naval-traits.ts`, `src/data/sea-cargo.json`, `src/data/ship-construction.json`, `src/engine/collision.ts`, +13 fichiers
- `MDG 13` (l.464, l.569-571, l.575-584, l.605-607, l.612-616, l.618-637, l.641-651) → `sea-perils`, `woundsFromHit`, `iceberg`, `meleeVsHullBE`, `VolleyShot`, `isArtilleryWeapon`, `debris-marins`, `resolveCollision`, `rocher`, `bas-fonds`, +21 — `src/data/etats.json`, `src/data/river-criticals.json`, `src/data/schemas/defs/sea-perils.ts`, `src/data/schemas/grammaire/valeurs.ts`, `src/data/sea-navigation.json`, `src/data/sea-perils.json`, +17 fichiers

## MDG : Coups Critiques sur un navire (Voie d'eau, Éclats, incendies)

Un navire subit ses propres **Blessures Critiques**, distinctes de celles d'un Personnage. Ce topic couvre leur déclenchement, les effets génériques transverses (Éclats, Voie d'eau, États *En flammes* et propagation du feu, chute du gréement) et les cinq tables de Critiques par Localisation.

### Déclenchement d'un Critique

Un navire subit un Critique dans **deux cas** (`MDG 13 l.656`) :
- un **jet d'attaque réussi donne un double** ;
- **tout coup porté une fois les Blessures du vaisseau tombées à 0** est un Critique.

On détermine la Localisation endommagée, on lance le **d10** dans la table de Critiques **de cette Localisation**, et on applique les effets (`MDG 13 l.664`). Les modèles de bateau variant, si la description d'un Critique ne colle pas au vaisseau, **utiliser le Critique le plus proche en gravité** (`MDG 13 l.656`). Les Critiques sur l'**Équipage** suivent les règles de Critiques des Personnages (WFJDR p.172 ou *Aux Armes !* p.80) (`MDG 13 l.660`). La **propulsion à vapeur** : un Critique à la Coque déclenche aussi un jet sur la table *Panne de Vapeur* (`MDG 12 l.313`).

### Effet générique : Éclats (Indice)

Pendant un combat naval, l'équipage souffre des volées d'éclats de bois. Si un Critique donne **Éclats (Indice)**, un **nombre de membres d'équipage égal à l'Indice** sont touchés et subissent chacun **9 Dégâts** (`MDG 13 l.668`).

### Effet générique : Voie d'eau (Indice)

Un vaisseau percé d'une **Voie d'eau** prend l'eau. Le MJ ajoute l'Indice à un **total cumulé qui augmente à chaque Round** (`MDG 13 l.672`) :
- quand ce total atteint **la moitié de l'Endurance** du bateau : −1 M et −1 DR à tous les Tests de Navigation (alourdi par l'eau) ; tous les **Sabords doivent être fermés**, sinon le total augmente de 1 ;
- quand le total **égale l'Endurance** du navire : **il coule** (`MDG 13 l.674`).

L'équipage écope pour faire baisser le total : chaque membre qui écope **dix Rounds** effectue un **Test de Force Intermédiaire (+0)** et réduit le total cumulé **de 1 par DR positif** (`MDG 13 l.676`). Sauf cargaison étanche, elle perd 1d10 % de sa valeur par Tour jusqu'à colmatage (`MDG 13 l.672`).

> « Quand l'Indice devient égal au score d'Endurance du navire, il coule. » — `MDG 13 l.674`

### Effet générique : États *En flammes* et propagation du feu

Un État *En flammes* affecte un navire « à peu près de la même manière qu'un personnage » : le bateau subit **1 Blessure par tour et par État *En flammes***, et **un même État *En flammes* ne peut affecter qu'une seule Localisation à la fois** (`MDG 13 l.588`). Comme les navires sont en bois et chargés de substances inflammables, le feu peut s'emballer : on note l'**intensité initiale** (nombre d'États *En flammes* sur une Localisation autre que l'Équipage) et, à la fin de chaque Tour, on lance le d10 dans la table *Intensité du feu* (`MDG 13 l.590`). Un incendie dans la cale **gâte 1d10 points d'Encombrement de cargaison par Tour et par État** (sauf cargaison résistante au feu) (`MDG 13 l.592`).

| d10 | Effet |
|---|---|
| 1 — Mourant | Lancez 1d10 et **soustrayez** le résultat de l'intensité ; la nouvelle intensité = nombre d'États *En flammes* à partir du prochain Tour. |
| 2-4 — Stable | L'intensité ne change pas. |
| 5-8 — Intense | Lancez 1d10 et **ajoutez** le résultat à l'intensité. |
| 9-10 — Grandissant | L'intensité ne change pas mais le feu **se répand sur une 2e Localisation** (jet sur la table de Localisation des Dégâts) avec **1d10 États *En flammes***. Si la Localisation est déjà en feu ou tombe sur l'Équipage, appliquer *Intense* à la place. |

— `MDG 13 l.596-601`

### Effet générique : Tomber du gréement

Plusieurs Critiques peuvent faire **tomber un Personnage du gréement** ; ceux dans le nid-de-pie testent aussi et tombent de plus haut (`MDG 13 l.680`) :

| Taille du bateau | Chute du gréement | Chute du nid-de-pie |
|---|---|---|
| Minuscule à Petite | 1d10 m | 12 m |
| Moyenne à Grande | 2d10 m | 25 m |
| Énorme à Monstrueuse | 3d10 m | 40 m |

— `MDG 13 l.684-688`

### Tables de Critiques par Localisation (d10)

Chaque table donne des **Blessures (T = effet temporaire), un effet et une Réparation** (Tests étendus, à n'effectuer que si la réparation est limitée dans le temps — sinon elle prend un nombre d'heures = score du d10) (`MDG 13 l.692`) :

- **Cargaison** : 1-2 *Ballots à la mer* (1d100 pts Enc perdus, Éclats 2) · 3-4 *Au feu dans la cale !* (1 État *En flammes* sur la Cargaison) · 5-6 *Cargaison endommagée* (1d100 pts détruits, Éclats 4) · 7-8 *Cargaison détruite* (2d100 pts, Éclats 6) · 9-10 *Explosion du dépôt de munitions* (3 États *En flammes* sur la Cargaison **+ 1d10 Critiques sur la Coque** si poudre noire stockée ; sinon énorme incendie = 3 États *En flammes*) (`MDG 13 l.698-702`).
- **Gréement** : 1 *Cordages rompus* · 2 *Voiles trouées* (−1 M Voile, −1 DR Voile) · 3 *Vergue détachée* (M Voile **divisé par 2**, −1 DR) · 4 *Voiles déchirées* (−2 M Voile, −1 DR) · 5 *Beaupré brisé* (plus de Clinfoc, Éclats 2) · 6 *Gréement dégradé* (−2 DR Escalade/Voile) · 7 *Voiles détruites* (**plus de déplacement à la voile**) · 8 *Mât fissuré* (Éclats 6 ; Test de Résistance Facile par Tour, échec → *Mât brisé*) · 9 *Vergue brisée* (plus de voile, Éclats 8) · 10 *Mât brisé* (plus de voile, Éclats 10 ; voile improvisée à 25 % via Test d'équipage étendu d'Entretien Difficile (−20), 80 DR) (`MDG 13 l.709-718`).
- **Coque** : 1 *Coque abîmée* (retire le bonus de Lissage) · 2 *Barre abîmée* (prochain Test de Manœuvre raté à −3 DR ou pire → barre brisée) · 3 *Coque dégradée* (Éclats 4) · 4 *Dommages sous la ligne de flottaison* (−1 DR Man) · 5 *Gouvernail endommagé* (−1 Man, Éclats 1) · 6 *Quille déchiquetée* (−1 DR à **tous** les Tests de Navigation) · 7 *Gouvernail brisé* (−3 Man, Éclats 3) · 8 *Voie d'eau au-dessus de la ligne de flottaison* (**Voie d'eau 1**, Éclats 6) · 9 *Voie d'eau au niveau de la ligne de flottaison* (**Voie d'eau 2**, Éclats 4) · 10 *Voie d'eau en dessous de la ligne de flottaison* (**Voie d'eau 4**, Éclats 2) (`MDG 13 l.725-744`).
- **Avirons** : 1-2 *Bancs dispersés* (plus de rame jusqu'à remise en place) · 3-4 *Avirons dégradés* (−1 M Avirons, −1 DR Ramer, Éclats 2) · 5-6 *Tolets abîmés* (−1 M Avirons, −1 DR Ramer, −2 DR Man, Éclats 4) · 7-8 *Avirons brisés* (−2 M Avirons, −2 DR Ramer, Éclats 5) · 9-10 *Bancs fracassés* (plus de rame, Éclats 6) (`MDG 13 l.749-756`).
- **Équipements** : 1-2 *Cabestan bloqué* (ancre coincée) · 3-4 *Canon détaché* (équipage du canon : Athlétisme Intermédiaire sinon 12 Dégâts) · 5-6 *Ancre perdue* · 7-8 *Canon perdu* (un gros canon, ou un pierrier à défaut, passe par-dessus bord) · 9-10 *Embarcation de bord perdue* (`MDG 13 l.760-766`).

**Sources RAW** :
- `MDG 13 l.656` — Déclenchement d'un Critique (double sur jet réussi ; tout coup à 0 Blessure) ; utiliser le Critique le plus proche en gravité si la description ne colle pas.
- `MDG 13 l.660` — Critiques sur l'Équipage = règles de Critiques de Personnage (WFJDR p.172 / *Aux Armes !* p.80).
- `MDG 13 l.664` — Procédure : déterminer la Localisation, lancer le d10 dans la table de cette Localisation.
- `MDG 13 l.668` — Éclats (Indice) : Indice membres d'équipage touchés, 9 Dégâts chacun.
- `MDG 13 l.672-676` — Voie d'eau (Indice) : total cumulé +Indice/Round ; ½ Endurance → −1 M / −1 DR Navigation / fermer les Sabords ; = Endurance → coule ; écoper (Force Intermédiaire, −1 par DR sur 10 Rounds) ; cargaison non étanche −1d10 %/Tour.
- `MDG 13 l.588-592` — États *En flammes* : 1 Blessure/Tour/État, un État = une Localisation ; intensité initiale ; cargaison gâtée 1d10 Enc/Tour/État.
- `MDG 13 l.596-601` — Table *Intensité du feu* (Mourant / Stable / Intense / Grandissant, propagation sur 2e Localisation).
- `MDG 13 l.680-688` — Tomber du gréement : table des hauteurs de chute (gréement / nid-de-pie) selon la Taille du bateau.
- `MDG 13 l.690-692` — Réparation des Critiques : Tests étendus si temps limité, sinon heures = score du d10.
- `MDG 13 l.696-702` — Blessures Critiques sur la Cargaison (d10).
- `MDG 13 l.705-718` — Blessures Critiques sur le Gréement (d10).
- `MDG 13 l.721-744` — Blessures Critiques sur la Coque (d10), dont les trois paliers de Voie d'eau.
- `MDG 13 l.747-756` — Blessures Critiques sur les Avirons (d10).
- `MDG 13 l.758-766` — Blessures Critiques sur les Équipements (d10).
- `MDG 12 l.313` — Propulsion à vapeur : un Coup Critique à la Coque déclenche un jet sur la table *Panne de Vapeur*.

> « Quand un jet d'attaque réussi contre un bateau donne un double, il subit un Critique. De plus, tous les coups qui touchent une fois que le score de Blessures d'un vaisseau est tombé à 0 sont des Critiques. » — `MDG 13 l.656`

**Voir aussi** : Combat naval — Endurance, Blessures et Localisation (MDG) ; Artillerie navale (MDG) ; Critiques et Frappe Mortelle ; AA : système alternatif de Blessures et Critiques ; États (En flammes, À terre) ; Escalade, Saut et Chute (chute du gréement).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 12` (l.313) → `moteur-broute`, `fuite-de-vapeur`, `nid-de-pie`, `perte-de-pression`, `feu-eteint`, `rupture-du-reservoir`, `explosion`, `bandValue`, `steam-save-roll`, `SteamBreakdownEntry`, +6 — `src/data/flow-stakes.json`, `src/data/naval-traits.json`, `src/data/schemas/defs/ship-stations.ts`, `src/data/schemas/defs/steam-breakdown.ts`, `src/data/ship-stations.json`, `src/data/steam-breakdown.json`, +3 fichiers
- `MDG 13` (l.588-592, l.596-601, l.656, l.660, l.664, l.668, l.672-676, l.680-688, l.690-692, l.696-702, l.705-718, l.721-744, l.747-756, l.758-766) → `pont`, `CrewTarget`, `ShipStationsPanel`, `bandeDeChuteSchema`, `greement`, `woundsFromHit`, `stationAsPoste`, `VolleyShot`, `avirons`, `ShipCritEntry`, +36 — `src/data/etats.json`, `src/data/reglesOptionnelles.json`, `src/data/river-criticals.json`, `src/data/schemas/defs/ship-criticals.ts`, `src/data/schemas/defs/ship-stations.ts`, `src/data/schemas/grammaire/mecanique.ts`, +26 fichiers

## MDG : Collisions, Indice de Collision et béliers

Les **collisions** sont la manœuvre de combat naval offensive de référence (éperonnage volontaire ou accident). Ce topic couvre l'évitement, le calcul des Dégâts d'un choc (Indice de Collision), les facteurs atténuants/aggravants pilotés par des Tests de Manœuvre, et les béliers. Les Indices de Collision de l'environnement (icebergs, rochers, tourbillons) sont listés pour la résolution de Dégâts.

### Repérer et éviter une collision

Le ou les Personnages les mieux placés comme vigie ont **trois chances** de repérer un objet en route de collision. Une fois le péril aperçu, le **Personnage à la barre fait un Test de Manœuvre pour l'éviter** ; la Difficulté dépend de la distance (les périls sous la flottaison sont plus durs à voir, les périls volumineux plus durs à éviter) (`MDG 13 l.427`) :

| Distance au péril | Test de Perception (repérer) | Test de Manœuvre (éviter) |
|---|---|---|
| 100 m | Difficile (−20) | Facile (+40) |
| 50 m | Intermédiaire (+0) | Accessible (+20) |
| 10 m | Accessible (+20) | Complexe (−10) |

— `MDG 13 l.431-435`. Qu'il évite ou percute, le bateau dévie de sa trajectoire — un Test d'Orientation est toujours nécessaire après avoir croisé un péril (`MDG 13 l.438`).

### Indice de Collision et Dégâts d'un choc

Navires et périls ont un **Indice de Collision (IC)** variant selon masse et solidité. **IC = Bonus d'Endurance + nombre de Blessures restantes** (ex. E 20, 15 Blessures → BE 2 + BB 1 = IC 3) (`MDG 13 l.444`).

> « Quand un vaisseau rentre dans un autre, chacun des deux reçoit un nombre de Dégâts égal à l'Indice de Collision de l'autre navire plus le M du navire qui a causé la collision. » — `MDG 13 l.446`

Sauf précision contraire, les coups d'une collision touchent toujours la **Coque** (`MDG 13 l.464`).

### Facteurs atténuants ou aggravants

Plusieurs facteurs modifient les Dégâts d'un choc (`MDG 13 l.448`) :

| Facteur | Effet |
|---|---|
| Le bateau frappé se déplace **en s'éloignant directement** de celui qui frappe | Réduit tous les Dégâts d'un nombre = M du navire frappé (min 0). |
| Vaisseau(x) frappé(s) **à la poupe** | Bénéficie de **2 PA**. |
| Vaisseau(x) frappé(s) **au milieu de la coque** | Les Dégâts infligés sont **doublés**. |
| Le navire qui frappe **manœuvre pour limiter** les Dégâts | Test de Manœuvre du barreur ; les **DR sont soustraits de l'IC des deux navires**. |
| Le navire qui frappe **manœuvre pour aggraver** | Test de Manœuvre ; les **DR sont ajoutés à l'IC des deux navires**. |
| Le navire frappé **manœuvre pour limiter** | Test de Manœuvre du barreur frappé ; **DR soustraits de l'IC des deux**. |
| Le navire frappé **manœuvre pour aggraver** | Test de Manœuvre ; **DR ajoutés à l'IC des deux**. |
| **Collision frontale** | Chaque bateau est touché pour Dégâts = IC de l'autre **+ le M total des deux navires**. |

— `MDG 13 l.452-462`

### Bélier

Un **Bélier** en métal fixé à l'avant fournit **5 PA** au navire contre tout Dégât d'une collision ou attaque venant de l'avant, **et ajoute 5 au Bonus d'Endurance pour calculer son Indice de Collision** si le bateau au Bélier cause la collision en frappant de sa proue (`MDG 12 l.221`).

### Indices de Collision de l'environnement

Pour résoudre les Dégâts d'un choc contre un péril, le RAW donne des IC types : **Iceberg** IC 25 (M1) (`MDG 13 l.479`) ; **Débris marins** IC 3 (M1, 20 % de s'empêtrer) (`MDG 13 l.485`) ; **Rocher** moyen IC 47 (20 % de s'*Échouer*) (`MDG 13 l.497`) ; **Bas-fonds** IC 10 (40 % de s'*Échouer*) (`MDG 13 l.499`). Au centre d'un **Tourbillon**, le bateau subit des Dégâts de collision **à chaque Round** selon l'IC du tourbillon (Rotation lente IC 4 → Maelstrom primordial IC 50) jusqu'à s'échapper (`MDG 13 l.526`, `MDG 13 l.533-537`, `MDG 13 l.560`).

**Sources RAW** :
- `MDG 13 l.427-438` — Repérer/éviter une collision : 3 chances de vigie, Test de Manœuvre du barreur, table Gestion des périls (Perception/Manœuvre par distance), Test d'Orientation après.
- `MDG 13 l.442-446` — Indice de Collision : BE + Blessures restantes ; Dégâts d'un choc = IC de l'autre + M du navire qui cause la collision.
- `MDG 13 l.448-462` — Facteurs atténuants/aggravants (éloignement, poupe 2 PA, milieu de coque ×2, manœuvres ± DR sur l'IC des deux, collision frontale + M total).
- `MDG 13 l.464` — Les coups d'une collision touchent toujours la Coque sauf précision contraire.
- `MDG 12 l.221` — Bélier : 5 PA à l'avant + 5 au BE pour l'IC quand il cause la collision de sa proue.
- `MDG 13 l.479` — Iceberg : M1, IC moyen 25.
- `MDG 13 l.485` — Débris marins : M1, IC 3, 20 % de s'empêtrer.
- `MDG 13 l.497-499` — Rocher moyen IC 47 (20 % Échouer) ; Bas-fonds IC 10 (40 % Échouer).
- `MDG 13 l.526` `MDG 13 l.533-537` `MDG 13 l.560` — Tourbillons : Dégâts de collision par Round selon l'IC (Rotation lente 4 → Maelstrom primordial 50).

> « L'Indice de Collision se calcule en additionnant le Bonus d'Endurance du bateau et son nombre de Blessures restantes. » — `MDG 13 l.444`

**Voir aussi** : Combat naval — Endurance, Blessures et Localisation (MDG) ; Coups Critiques sur un navire (MDG) ; Charge (le pendant terrestre de l'éperonnage) ; Taille : catégories et modificateurs de combat.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 12` (l.221) → `CollisionShip`, `peu-maniable`, `doc`, `renforce`, `resolveCollision`, `robuste`, `solide`, `ancre`, `belierRam`, `belier`, +13 — `src/data/index.ts`, `src/data/naval-traits.json`, `src/data/schemas/defs/naval-traits.ts`, `src/data/ship-construction.json`, `src/engine/collision.ts`, `src/engine/navalTraits.ts`, +2 fichiers
- `MDG 13` (l.427-438, l.442-446, l.448-462, l.464, l.479, l.485, l.497-499, l.526, l.533-537, l.560) → `sea-perils`, `collisionIndex`, `iceberg`, `SeaHazardDef`, `debris-marins`, `resolveCollision`, `rocher`, `pickSeaHazard`, `bas-fonds`, `perilManagement` ⚠sans-appelant, +39 — `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/sea-perils.ts`, `src/data/sea-perils.json`, `src/data/vehicles.json`, `src/data/voyage-stakes.json`, `src/engine/collision.ts`, +7 fichiers

## MDG : Artillerie navale — pièces, portées, recharge et munitions

L'artillerie de bord (balistes, canons, mortiers, pierriers) est l'arme principale du combat naval à distance. *La Mer des Griffes* renvoie à *Aux Armes !* pour le détail, mais reproduit la liste des armes les plus courantes sur les navires de l'Empire, leurs munitions spéciales et leur placement sur le pont. Ce topic couvre la **mécanique de tir** : compétences requises, portées, Dégâts, Recharge et munitions.

### Maniement et compétences

Les pièces d'artillerie suivent **les mêmes principes que les armes plus petites** : un tireur formé à l'arbalète peut charger et tirer une baliste, manier un canon n'est pas plus complexe qu'une arquebuse (`MDG 12 l.373`). **Il est impossible de manier une arme de siège sans la compétence du Groupe d'armes approprié** ; les armes du Groupe **Poudre noire** requièrent un équipage doté de **Projectiles (Ingénierie ou Poudre noire)** (`MDG 12 l.375`). Cas particulier des balistes : n'importe quel Personnage peut tenter un **Test de Projectiles (Arbalète)** avec sa CT, mais **l'arme perd alors tous ses Atouts tout en conservant ses Défauts** (`MDG 12 l.377`). Les pièces tirent obligatoirement des **munitions spéciales dédiées** : un canon ne tire pas de balle d'arquebuse, une baliste pas de carreau d'arbalète (`MDG 12 l.379`).

> « Il est impossible de manier une arme de siège sans posséder la compétence du Groupe d'armes approprié. » — `MDG 12 l.375`

### Tableau des Pièces d'Artillerie (navales)

| Arme | Prix | Enc | Disponibilité | Portée | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| **ARBALÈTE** — Baliste | 30 CO | 20 | Limitée | 100 | +12 | Arme d'équipe 2, Pointue, Recharge 3 |
| **POUDRE NOIRE** — Canon (petit) | 40 CO | 30 | Limitée | 50 | +10 | Arme d'équipe 2, Dangereuse, Recharge 4 |
| **POUDRE NOIRE** — Canon (moyen) | 100 CO | 50 | Exotique | 75 | +14 | Arme d'équipe 3, Dangereuse, Recharge 6 |
| **POUDRE NOIRE** — Canon (grand) | 250 CO | 75 | Exotique | 150 | +16 | Arme d'équipe 4, Dangereuse, Recharge 8 |
| **POUDRE NOIRE** — Mortier | 50 CO | 50 | Exotique | 100 | – | Arme d'équipe 3, Recharge 4 |
| **POUDRE NOIRE** — Pierrier | 20 CO | 5 | Rare | 30 | +14 | Dangereuse, Recharge 4 |

— `MDG 12 l.401-407`. Note : ces stats sont identiques à celles du tableau d'artillerie d'*Aux Armes !* (cf. topic *AA : Structures et armes de Siège*) — MDG ne reprend que le sous-ensemble naval (sans catapultes ni armes d'Ingénierie). Le **mortier** tire sur trajectoire courbée : moins efficace pour percer une coque qu'un canon, mais mortel pour l'équipage sur le pont et utile pour incendier (`MDG 12 l.391`). Le **pierrier** est un gros tromblon, normalement monté sur pivot ou trépied (`MDG 12 l.395`).

### Tableau des Munitions pour Pièces d'Artillerie (navales)

| Arme / Munition | Prix | Enc | Disponibilité | Portée | Dégâts | Atouts et Défauts |
|---|---|---|---|---|---|---|
| **BALISTE** — Carreau | 4/– | 0 | Limitée | Comme l'arme | – | Empaleuse, Perforante |
| **BALISTE** — Carreau nain norse | 8/– | 0 | Limitée | Comme l'arme | – | Brise-coque, Empaleuse, Perforante |
| **CANON** — Boulet et poudre | 8/– | 1 | Limitée | Comme l'arme | – | Explosion 2, Percutante |
| **CANON** — Mitraille et poudre | 6/6 | 0 | Exotique | Quart de l'arme | −5 | Tir de zone 5 |
| **MORTIER** — Bombe | 3 CO | 0 | Rare | Comme l'arme | +12 | Dangereuse, Explosion 5, Percutante |
| **MORTIER** — Bombe incendiaire | 1 CO | 0 | Limitée | Moitié de l'arme | Spécial\* | Dangereuse, Explosion 4 |
| **PIERRIER** — Balles et poudre (pour 1 tir) | 2/2 | 0 | Commune | Comme l'arme | +1 | Empaleuse, Perforante, Tir de zone 3 |
| **PIERRIER** — Petites munitions et poudre (pour 1 tir) | 2/2 | 0 | Commune | Comme l'arme | – | Tir de zone 6 |

— `MDG 12 l.413-424`. \* **Bombe incendiaire** : n'inflige pas de Dégâts ; fait subir à toutes les cibles affectées **1 + DR États *En flammes*** (`MDG 12 l.426`).

### Recharge

Toutes ces armes portent le Défaut **Recharge (Indice)** : le rechargement complet prend un nombre d'Actions/Tests égal à l'Indice (baliste 3, canon petit/moyen/grand 4/6/8, mortier 4, pierrier 4) (`MDG 12 l.401-407`). Pour recharger une arme à **Arme d'équipe**, un membre peut apporter son **Soutien** sur les Tests déterminant la durée du rechargement (`MDG 12 l.462`) ; un équipage en sous-effectif **double le temps de recharge** (cf. topic Atouts/Défauts d'arme).

### Placement des canons sur le pont

Concentrer l'artillerie d'un côté (bordée) ou à la proue donne un avantage tactique mais compromet le déplacement et la manœuvre (`MDG 12 l.430`) :
- poids des pièces sur **un côté > 25 % de la Contenance** : **−1 supplémentaire au M et à la Man**, et **−1 DR** aux Tests de Navigation ;
- poids sur un côté **> 50 % de la Contenance** : **−2 au M et à la Man**, **−2 DR** aux Tests de Navigation (`MDG 12 l.432-433`).

Un placement équilibré (ou compensé par du lest) n'impose aucune pénalité de pilotage (`MDG 12 l.435`). Les **Sabords** (trappes refermables) permettent de tirer à couvert : sans Sabord, les tirs partent du pont, qui ne fournit aucun couvert, alors qu'un Sabord donne une **couverture totale** ; ouvrir/fermer un Sabord est **une seule action** (`MDG 12 l.364`).

**Sources RAW** :
- `MDG 12 l.369-379` — Généralités d'artillerie navale : suit les principes des armes à main ; Groupe d'armes obligatoire ; Poudre noire = Projectiles (Ingénierie/Poudre noire) ; baliste via Projectiles (Arbalète) perd ses Atouts ; munitions spéciales obligatoires.
- `MDG 12 l.381-395` — Descriptions : balistes (grandes arbalètes à torsion), canons (Nuln), mortiers (trajectoire courbe, anti-équipage/incendie), pierriers (gros tromblon sur pivot).
- `MDG 12 l.401-407` — Tableau des Pièces d'Artillerie : Baliste, Canon (petit/moyen/grand), Mortier, Pierrier (Prix/Enc/Disponibilité/Portée/Dégâts/Atouts et Défauts, dont les Indices de Recharge).
- `MDG 12 l.413-426` — Tableau des Munitions pour Pièces d'Artillerie (Carreau, Carreau nain norse, Boulet, Mitraille, Bombe, Bombe incendiaire, Balles/Petites munitions de pierrier) + note Bombe incendiaire = 1 + DR États *En flammes*.
- `MDG 12 l.462` — Recharge d'une Arme d'équipe : un membre apporte son Soutien.
- `MDG 12 l.430-435` — Placement des canons : >25 % Contenance d'un côté → −1 M/Man et −1 DR Navigation ; >50 % → −2 M/Man et −2 DR ; lest de compensation.
- `MDG 12 l.356-364` — Sabords : tir à couvert (couverture totale) vs tir depuis le pont (aucun couvert) ; ouvrir/fermer = une action.

> « Une bombe incendiaire fait subir à toutes les cibles affectées 1 +DR États En flammes. » — `MDG 12 l.426`

**Voir aussi** : Atouts et Défauts d'arme (MDG : Arme d'équipe, Tir de zone) ; AA : Structures et armes de Siège (stats d'artillerie jumelles) ; Combat naval — Endurance, Blessures et Localisation (MDG) ; Coups Critiques sur un navire (MDG) ; Armes à distance et munitions (LDB) : groupes et tables ; Portée, Allonge et dégradation des armes ; Atouts et Défauts d'arme (Recharge, Dangereuse, Explosion, Percutante, Empaleuse, Perforante, Pointue).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 12` (l.356-364, l.369-379, l.381-395, l.401-407, l.413-426, l.430-435, l.462) → `ammoSeq`, `moteur-broute`, `crewedPenalty`, `canon`, `warMachineCrewPenalty`, `fuite-de-vapeur`, `nid-de-pie`, `ReloadModalView`, `placementPenalty`, `VolleyShot`, +31 — `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/naval-traits.json`, `src/data/qualities.json`, `src/data/schemas/defs/steam-breakdown.ts`, `src/data/ship-stations.json`, +21 fichiers
- sans code : `MDG 12` (l.377, l.379)

## MDG : nouveaux Atouts et Défauts d'arme (Arme d'équipe, Tir de zone)

Le chapitre 12 introduit deux qualités d'arme employées par l'artillerie navale et reprises ailleurs : le **Défaut *Arme d'équipe*** (l'arme requiert plusieurs servants) et l'**Atout *Tir de zone*** (gerbe de projectiles touchant plusieurs cibles). Ces deux définitions sont identiques à celles d'*Aux Armes !* (cf. topic *AA : Structures et armes de Siège*) ; ce topic les ancre sur la source MDG.

### Défaut : *Arme d'équipe (Indice)*

Une arme à *Arme d'équipe* est si imposante, lourde et complexe qu'elle **ne fonctionne bien que gérée par une équipe**. Tous les membres de l'équipe doivent posséder la **Compétence Projectiles appropriée** ; ils peuvent **nommer l'un d'eux** pour effectuer le Test de Projectiles déterminant l'efficacité du tir (`MDG 12 l.442`). La plupart des armes ont un équipage de **2, 3 ou 4** ; les membres au-delà de l'Indice n'améliorent pas l'arme mais peuvent la déplacer ou compenser les pertes (`MDG 12 l.444`).

Si l'arme est maniée **en sous-effectif**, elle subit des **pénalités cumulatives** (`MDG 12 l.446`, `MDG 12 l.458`) :

| Équipage présent | Arme d'équipe 2 | Arme d'équipe 3 | Arme d'équipe 4 |
|---|---|---|---|
| 4 | N/A | N/A | N/A |
| 3 | N/A | N/A | Temps de Recharge doublé |
| 2 | N/A | Temps de recharge doublé | Reçoit le Défaut *Imprécise* |
| 1 | Temps de recharge doublé | Reçoit le Défaut *Imprécise* | Reçoit le Défaut *Dangereuse* |

— `MDG 12 l.448-456`. Les pénalités se **cumulent** : une Arme d'équipe 4 maniée par une seule personne voit son temps de recharge doublé **et** reçoit *Imprécise* **et** *Dangereuse* (`MDG 12 l.458`). Si l'arme **reçoit un Défaut qu'elle possède déjà**, imposer à la place une **pénalité de −10** sur tous les Tests de Projectiles pour tirer (`MDG 12 l.460`). Pour recharger, un membre peut apporter son **Soutien** sur les Tests de durée de rechargement (`MDG 12 l.462`). Si l'arme subit un **Incident de tir**, **tous les membres de l'équipage sont affectés** (`MDG 12 l.464`).

> « Les pénalités infligées par un équipage réduit sont cumulatives, ce qui signifie qu'une arme dotée d'Arme d'équipe 4, mais qui n'est maniée que par une seule personne voit son temps de recharge doublé et reçoit les Défauts *Imprécise* et *Dangereuse*. » — `MDG 12 l.458`

### Atout : *Tir de zone (Indice)*

Une arme à *Tir de zone* projette **un nuage de projectiles** qui se déploie et peut frapper plusieurs cibles. Son comportement dépend de la **portée à laquelle se trouve la cible** (`MDG 12 l.468`) :

- **Bout portant** : le tir cible un seul individu — **ajoutez l'Indice aux Dégâts** de l'arme.
- **Portée Courte à Longue** : le tir cible un individu **et les (Indice) créatures visibles les plus proches** ; deux cibles ne peuvent pas être à plus de **(Indice) mètres** l'une de l'autre.
- **Portée Extrême** : comme Courte à Longue, mais **réduit les Dégâts de l'arme de (Indice)**.

— `MDG 12 l.470-472`

**Sources RAW** :
- `MDG 12 l.442` — *Arme d'équipe* : tous les servants doivent avoir la Compétence Projectiles appropriée ; un seul désigné effectue le Test d'efficacité.
- `MDG 12 l.444` — Équipage de 2/3/4 ; les membres supplémentaires ne renforcent pas l'arme mais aident à la déplacer/compenser les pertes.
- `MDG 12 l.446-456` — Table des pénalités d'équipage réduit (recharge doublée → *Imprécise* → *Dangereuse* selon l'Indice et l'effectif présent).
- `MDG 12 l.458` — Pénalités cumulatives (Arme d'équipe 4 maniée seul = recharge doublée + *Imprécise* + *Dangereuse*).
- `MDG 12 l.460` — Doublon de Défaut : −10 aux Tests de Projectiles au lieu d'un second exemplaire du Défaut.
- `MDG 12 l.462` — Recharge : un membre apporte son Soutien sur les Tests de durée.
- `MDG 12 l.464` — Incident de tir d'une Arme d'équipe : tous les membres affectés.
- `MDG 12 l.466-472` — *Tir de zone* : bout portant (+Indice aux Dégâts), Courte à Longue (Indice cibles proches, ≤ Indice mètres), Extrême (−Indice aux Dégâts).

> « Les armes possédant l'Atout *Tir de zone* tirent un nuage de projectiles qui se déploie et peut frapper plusieurs cibles. » — `MDG 12 l.468`

**Voir aussi** : Artillerie navale (MDG) ; AA : Structures et armes de Siège (définitions jumelles d'*Arme d'équipe* et de *Salve*) ; Atouts et Défauts d'arme (Recharge, Dangereuse, Imprécise, Tir de zone, Explosion) ; AA : armes à poudre à canon et munitions — tables ; Combat à Distance : restrictions et règles de tir (bandes de portée).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 12` (l.442, l.444, l.446-456, l.458, l.460, l.462, l.464, l.466-472) → `crewedPenalty`, `warMachineCrewPenalty`, `ReloadModalView`, `placementPenalty`, `crewedFireWeapon`, `shipManeuverParams`, `firedWeapon`, `Weapon`, `tir-de-zone`, `attackModifiers`, +3 — `src/data/qualities.json`, `src/engine/combat.ts`, `src/engine/crewedWeapon.ts`, `src/engine/types.ts`, `src/engine/warMachineCrew.ts`, `src/state/combatArea.ts`, +6 fichiers

## Bilan de fidélité — passe de vérification adversariale

### Structure du Round et ordre d'Initiative ⚠
- Étape 5 : le document nomme l'étape « Répéter les Étapes 2 à 5 » sans le « si nécessaire » présent dans la source (LDB 13 l.29 : « Répéter les Étapes 2 à 5 si nécessaire »). Très mineur — le corps du tableau le mentionne.
- Dans le corps introductif du Résumé, le document paraphrase LDB 13 l.19 comme « jusqu'à ce qu'un des deux groupes fuie ou soit vaincu » alors que la source dit « jusqu'à ce que l'un des groupes fuit ou soit vaincu » : ajout de « deux » (absent du source) et conjugaison « fuie » au lieu de « fuit ». Paraphrase, non une citation — acceptable mais signalé.
- Toutes les refs de lignes (l.13-19, l.22-32, l.34, l.36, l.39-45, l.47, l.49-50, l.54) vérifiées et conformes. Toutes les valeurs et tables transcrites sont exactes (Tollich 38 / cultistes 35 / Perdita 33 ; trois méthodes aléatoires verbatim). Les deux citations directes (l.15 et l.47) sont identiques au source mot pour mot.

### Surprise ❌
- LDB 13 l.52 — « Se cacher » : la source dit que les Personnages (visés) peuvent faire un Test opposé de Perception « s'ils sont sur leurs gardes, ou si le MJ est d'humeur généreuse ». Le markdown ajoute le mot « visés » entre parenthèses qui n'est pas dans la source, et transforme « Les Personnages » en « Les Personnages visés » — ajout interprétatif, non une erreur grave mais une modification de formulation.
- LDB 13 l.62-65 — L'exemple canon sur Vigilance (lignes 75-76 en réalité) cite un Test de Perception Intermédiaire (+0) pour le talent Vigilance. La description dans le markdown dit que l'exemple cite « le Talent Vigilance, qui autorise un Test de Perception Intermédiaire (+0) pour éviter d'être surpris » — cela est correct. En revanche le markdown affirme que « certains Talents permettent d'éviter la Surprise » et l'exemple est dans le corps du texte (lignes 72-76), non aux lignes 72-75 strictement. La ref l.72-75 est correcte pour le paragraphe introductif + début exemple.
- LDB 13 l.67-69 — Le markdown dit « chaque Personnage vaincu subit l'État Surpris ». La source dit « chaque Personnage vaincu subit alors l'État Surpris ». Fidèle.
- LDB 13 l.71 — Le markdown parle de « dépenser 1 Point de Détermination ». La source dit « il peut utiliser un Point de Détermination pour se débarrasser de l'État Surpris ». Fidèle.
- LDB 16 l.131-139 — La phrase dans la source (l.130) dit « vous n'êtes absolument pas prêt à réagir à ce qu'il arrive » ; le markdown transcrit « vous n'êtes absolument pas prêt à réagir » (sans « à ce qu'il arrive »). Légère troncature de citation mais sans impact sémantique sur la règle.
- NADJ 05 l.117 — ERREUR FACTUELLE : le markdown dit que le Test est « Très difficile (-30) » pour se réveiller en sursaut. La source dit « Test de Perception Très Difficile (-30) ». C'est correct. MAIS le markdown dit « réussite = réveil avec l'État Fatigué ». La source dit « se réveiller en sursaut avec un État Fatigué ». C'est fidèle. CEPENDANT le markdown dit : « On lui donne en outre les États Inconscient et À terre pour le Round 1, et un État Surpris pour le Round où il se réveille ». La source dit : « Donnez-leur également les États Inconscient et À terre pour le Round 1 et un État Surpris pour le Round où ils se réveillent. » — Le markdown est fidèle.
- NADJ 06 l.148 — ERREUR : le markdown dit que les orphelins frappent « à CC 20 ». La source dit qu'ils portent les coups « avec leur modeste CC de 20 ». C'est fidèle. MAIS le markdown dit « trois attaques sont portées pendant le même Round avec les bonus de supériorité numérique ». La source dit « trois attaques vont être faites sur les jambes de ce Personnage » et « toutes les attaques ayant lieu pendant le même Round et bénéficiant des bonus de supériorité numérique ». Le markdown est fidèle mais omet que les attaques ciblent spécifiquement les jambes (genoux et arrière des cuisses) — omission non critique.
- LDB 17 l.61 — La source (ligne 66) dit : « Retirez un État : si vous retirez l'État à Terre, regagnez 1 Point de Blessure lorsque vous vous mettez debout. » Le markdown cite cette option comme « Retirer un État » et l'appelle « option générique ». Le label exact dans la source est juste « Retirez un État » sans titre en gras distinct — c'est une des trois options sous « Dépenser de la Détermination ». La ref l.66 est correcte.
- ERREUR de structure LDB 13 : le markdown présente « Surprise » et « Ordre d'Initiative » comme deux sections séparées à partir de l.52. Dans la source, la ligne 52 est un titre « ## Surprise » et la ligne 53 est « ## Ordre D'initiative » — ce sont deux titres consécutifs, sans contenu entre eux (artefact de la conversion PDF). Le texte de la Surprise commence à la ligne 56. Cette particularité ne crée pas d'erreur factuelle dans le markdown.
- NADJ 05 l.117 — La source parle des « Personnages endormis » (pluriel). Le markdown dit « un Personnage endormi ». Le changement au singulier est une paraphrase acceptable mais la source concerne potentiellement plusieurs personnages.
- Implémentation mentionnée dans le markdown — non vérifiée dans cette passe (hors scope de la vérification source RAW). Les refs aux fichiers src/ sont des déclarations d'implémentation, pas des claims RAW.

### Action, Mouvement et options du Tour ⚠
- MINEUR — Charge : le topic écrit « consomme tout le Mouvement » (section Charge, corps), formulation absente du RAW. LDB 15 l.35 dit seulement « vous pouvez utiliser votre Mouvement pour Charger » sans préciser « tout ». La portée est bien celle de la Course (tableau), mais l'adjectif « tout » est une inférence rédactionnelle, pas une citation directe.

### Résolution d'une attaque : les 4 étapes ❌
- CRITIQUE: l.137 and l.183-184 — Le document affirme qu'un Critique « inflige immédiatement une Blessure critique » en citant ces lignes. Or l.137 (LDB 13) dit seulement de se référer à la section Critiques/Maladresses, et l.184 dit qu'un double sur un succès génère un Critique. Aucun des deux passages ne dit qu'une Blessure critique est infligée immédiatement — c'est un effet aval non cité aux lignes référencées. La source précise que le Critique peut se produire aussi pour le défenseur (l.184 : « cela peut également se produire lorsque vous êtes le défenseur »), information absente du doc.
- REF INVALIDE: « LDB 13 l.4 du segment p.162 » — ce format de référence est incohérent. La ligne 7 du fichier markdown LDB 13 est simplement « ## **Combat** » (titre de chapitre). La mention « p.162 » est une page PDF, pas un numéro de ligne markdown. Cette référence ne pointe rien d'utile et ne doit pas être utilisée.
- INEXACTITUDE (opposition CC, l.171-172): Le document dit que tenter une autre Compétence « impose de renoncer à porter des Coups Critiques ». La source (l.172) est plus conditionnelle : « Si votre MJ pense que c'est approprié et que vous êtes disposé à ne pas porter de Coups Critiques, pourquoi ne pas tenter votre chance ? » — l'accord du MJ est une condition explicite que le document omet.
- ERREUR EXEMPLE (combinaison des difficultés, LDB 14 l.119-124): Le document écrit « brouillard (-10) + Localisation précise (-10) = Très Difficile (-30), pas -40 ». La source (l.129) donne un exemple où brouillard + Localisation précise donne « Difficile (-20) » et précise que combiné cela « devient simplement Très Difficile (-30) au lieu de -40 » — ce qui désigne le plafond général des pénalités cumulées, pas ce doublet spécifique. En effet -10 + -10 = -20 = Difficile, conformément à la source. Le document présente à tort ce doublet comme aboutissant directement à -30 (Très Difficile) alors que la source montre Difficile (-20) pour ces deux facteurs. L'exemple est mal retranscrit.
- MINEURE (LDB 16 l.15-17): Ces lignes couvrent la règle générale « États différents ne se cumulent pas » (pénalité la plus forte). La citation est utilisée comme note parenthétique dans l'Étape 4. Pertinent, mais le lecteur pourrait chercher la règle spécifique d'À Terre (non-cumul de À Terre lui-même) qui se trouve à LDB 16 l.37 : « À l'inverse de la plupart des États, À Terre ne se cumule pas ». La référence en elle-même n'est pas fausse mais incomplète.

### Critiques et Frappe Mortelle ❌
- §3 point 5 (erreur factuelle grave) : le markdown dit « Un résultat de 00 sur une table de localisation = coup mortel ». C'est faux. Le tableau de Localisation (LDB 13 l.137-145, premier d100) mappe 90-00 → Jambe droite ; le 00 mortel (décapitation/éventrement/démembrement/bassin) figure sur le Tableau des Critiques (second d100), pas sur le tableau de localisation. La phrase doit remplacer « une table de localisation » par « un Tableau des Critiques ».
- §1 parenthèse non sourcée : la précision « 11, 22, 33, … 99 — et 00 traité comme double » ne figure pas à LDB 13 l.183 ni ailleurs dans les sources citées. Le texte source dit simplement « dont le résultat est un double » sans spécifier explicitement le cas 00. Il s'agit d'une interprétation ajoutée, pas d'une citation RAW.
- Tables AA Tête — « Blessure spectaculaire » (01-03) : le bonus de cicatrice n'est obtenu « qu'une seule fois » selon AA 7 l.86 (« Vous ne pouvez gagner ce bénéfice qu'une seule fois »). La transcription du markdown omet cette restriction (« Une fois la blessure guérie, la cicatrice donne +1 DR aux Tests sociaux appropriés (une seule fois) » — la parenthèse y figure, donc c'est correct en réalité ; pas un vrai bug, mais la restriction doit rester).
- AA Bras table : le markdown indique « Choc au bras » (11-20) avec des effets corrects mais omet la formulation précise : AA 7 l.113 dit « considérez votre main comme perdue (voir Amputation en page 180 de WFJDR) ». La transcription dit « considérée perdue » sans la référence interne, ce qui est acceptable mais légèrement incomplet.
- AA Bras « Blessure béante » (56-60) : le markdown donne 2 Blessures, AA donne aussi 2 Blessures (AA 7 l.119). En revanche la formulation exacte AA dit « toute Blessure que vous subissez à votre bras blessé vous inflige un État Hémorragique supplémentaire » alors que le markdown simplifie en « toute Blessure au bras = 1 Hémorragique de plus » — simplification juste, pas d'erreur factuelle.
- AA §6 système alternatif — l'article dit que les tables AA « remplacent » celles du LDB, ce qui est exact (AA 7 l.29 présente le système comme alternatif complet). Pas d'erreur.
- AA « Retenir vos coups » : l'article dit « impossible avec une arme En flammes, des projectiles ou des sorts ». AA 7 l.61 : « Vous ne pouvez pas Retenir vos coups avec une arme infligeant des États En flammes, avec des projectiles ou avec des sorts. » ✓ Correct.
- AA Torse « Dos froissé » (71-75) : le markdown donne 3 Blessures. AA 7 l.150 confirme 3. ✓ Mais la LDB donne 4 Blessures pour le même nom d'entrée dans une table différente ; aucun mélange détecté dans l'article.

### Maladresses, Oups ! et Incident de Tir ⚠
- LDB 13 l.178-183 cite explicitement les Critiques côté défenseur ('un Critique peut survenir lorsque vous êtes le défenseur au cours d'un Test opposé') mais ne mentionne PAS les Maladresses côté défenseur. La section 'Maladresse comme défenseur' du document est une inférence par symétrie (légitime mécaniquement, et correctement implémentée dans defenderFumbled), mais la sourcer via LDB 13 l.178-183 est imprécis : ce passage ne valide que le Critique défenseur. Aucune ligne RAW n'énonce explicitement 'le défenseur peut faire une Maladresse'. Signal d'incertitude, pas un bug RAW.

### Combat à Distance : restrictions et règles de tir ❌
- ERREUR TABLE — Bandes de portée : « Bout portant » est indiqué Facile +40 dans la table récapitulative, mais la table « Difficulté de Combat » source (LDB 14 l.73) le place sous Très Facile +60. La même page markdown corrige elle-même cette erreur dans le tableau verbatim en bas (où Bout portant apparaît bien à +60), créant une contradiction interne. La valeur correcte est +60 (Très Facile), pas +40 (Facile). La colonne « Difficulté » de la table Bandes de portée dit aussi « Facile » pour Bout portant — les deux champs (Difficulté et Modificateur) sont faux pour cette ligne.

### Difficultés de combat, Taille et Supériorité numérique ❌
- EDO 11 l.157-165 — Le markdown affirme que « l'exemple-type cité par le supplément est un Test de Calme contre Terreur 3-5 (psychologie en combat) ». Aucun tel exemple ne figure dans le texte source EDO (Appendice 2, lignes 157-165). Le texte dit seulement que la campagne « propose des situations particulièrement complexes » sans citer le moindre exemple concret. Claim inventé, sans base RAW.
- EDO 11 l.157-165 — Le markdown dit que ces deux paliers « s'appliquent explicitement aux Tests de combat ». Le texte source ne dit rien de tel : il dit qu'ils s'appliquent aux situations complexes de la campagne L'Ennemi Intérieur en général, sans restriction explicite aux seuls Tests de combat. Overstatement non sourcé.
- LDB 14 l.119-124 — Le texte RAW illustre la combinaison pénalité+bonus avec « neige jusqu'à la taille (Très Difficile −30) + cible À Terre » et appelle ce dernier modificateur « Facile (+20) » dans l'exemple, alors que la table (LDB 14 l.91) le classe sous Accessible (+20). Le markdown signale correctement cette incohérence RAW avec une note entre astérisques — la note est fidèle. Aucune erreur du markdown ici, mais le résumé de l'exemple (-30 + +20 = -10) est exact RAW.

### Deux armes, Dispersion et Mains nues ⚠
- Dispersion — diagramme 3×3 CONFIRMÉ au fichier source : `LDB 14 l.146-149` porte la grille markdown `| 1 | 2 | 3 |` / `| 4 | T | 5 |` / `| 6 | 7 | 8 |`. La disposition transcrite par le topic est celle du fichier source, et le topic n'ajoute aucune correspondance chiffre↔direction que la grille ne porte pas.

### Empoignade ⚠
- LDB 16 l.60-66 — section *Empêtré* complète : en-tête (l.60), description (l.62), pénalité de déplacement et Empoignade −10 (l.64), retrait par Test opposé de Force +1 par DR (l.66). La règle est correctement transcrite et la ref couvre le retrait.
- Section 'Option Compétences' : l'article dit « un autre Test qu'un Test opposé de Force » alors que la source (l.173) dit simplement « un autre Test qu'un Test opposé » — le « de Force » est un ajout éditorial mineur, non présent dans le RAW à cet endroit précis. Pas d'erreur factuelle, mais légère surspécification.

### Déplacement en combat : Marche, Course, Charge, grille ⚠
- MINEUR — Clampage à 0 de bonusCases (movement.ts l.23) non sourcé : le RAW dit « Mouvement de Course + DR mètres » et donne un exemple DR=−2 → 14m (non nul). Le livre ne prévoit pas de plancher à 0 pour la distance de Course. Le clampage est raisonnable mais c'est une invention. (LDB 15 l.41)
- MINEUR — Math.round(t.sl / 2) pour la conversion DR mètres → cases (movement.ts l.23) : le DR RAW est toujours un entier, donc DR/2 peut être un demi-entier sur grille à 2 m/case. L'arrondi au plus proche est une décision de grille non sourcée (le livre ne mentionne pas d'arrondi).
- INFO — Le texte dit « la colonne Course n'est pas une Action de Course 'pleine' mais le Mouvement de Course servant de base à la Course et à la Charge ». Cette distinction éditoriale n'est pas dans le RAW : le tableau nomme simplement « Course (mètres) ». La formulation peut prêter à confusion mais ne contredit pas le RAW.
- INFO — Le markdown parle d'« Avantage +10/pion » dans le renvoi final. LDB 14 l.215 confirme : « Chaque Avantage ajoute +10 à un Test de Combat ou de Psychologie appropriés ». Correct mais c'est hors-scope du chapitre 15.

### Escalade, Saut et Chute ⚠
- Code implementation (non-doc issue): combatEffects.ts l.693 — `if (lost > be) addCondition(c, 'a-terre')` où `lost = max(0, 3*m + d10 - be)`. Le RAW (l.84) dit À Terre si les Blessures subies > BE ; 'lost' étant déjà réduit par BE, la condition effective est `raw > 2×BE`, plus restrictive que le RAW. Ce bug est dans le code, pas dans la doc (la doc cite le RAW correctement). Signal pour un agent de correction ultérieure.

### Poursuite (procédure de base) ⚠
- LDB 15 l.88 — intro : le markdown ajoute « fuite à cheval » comme troisième exemple de poursuite ; la source ne mentionne que « marché bondé » et « chariot lancé à grande vitesse » dans ces lignes. La poursuite à cheval n'apparaît qu'à l'exemple l.146. Ajout éditorial mineur, non faux (la procédure couvre les montures), mais non sourcé dans ces lignes précises.
- LDB 15 l.108 — exemple Perdita : le markdown ajoute une glose parenthétique « le Bandit M 7 servant de référence à M 0 d'écart » absente de la source. La source dit simplement « le premier Bandit effectue un Test sans modificateurs ». Glose factuelle correcte mais non sourcée.
- Note structurelle (non-bug) : les renvois entre parenthèses « voir l'étape 4 pour les bornes de sortie 0 et 10+ » (après la table Distance étape 1) et les notes éditoriales en italique sous les tables sont des ajouts du rédacteur, non présents dans le texte RAW. Aucun n'introduit d'erreur de règle.

### Armes de corps à corps (LDB) : groupes et tables ⚠
- Duel Judiciaire — table row « Choix de l'issue » : la parenthèse « (premier sang pour les charges légères, jusqu'à l'incapacité pour les graves) » est une inférence éditoriale absente du texte source. NADJ 06 l.177 dit seulement « En fonction de la sévérité de la charge, un duel judiciaire peut être disputé jusqu'au premier sang ou jusqu'à ce qu'un des combattants ne puisse plus poursuivre » sans préciser quelle sévérité correspond à quelle issue.
- Duel Judiciaire — Wendorf : le document résume « chaussette lestée » alors que la source (NADJ 06 l.181) dit précisément « une chaussette contenant une pierre de la taille d'un poing ». Paraphrase mineure mais inexacte.

### Armes à distance et munitions (LDB) : groupes et tables ⚠
- INTERPRÉTATION NON VÉRIFIÉE — l.230-231 (Ingénierie via Poudre noire) : le document ajoute «garde donc Dangereuse/Recharge/Répétition mais perd Poudre noire/Dévastatrice et les autres Atouts». La source dit simplement «les armes perdent tous leurs Atouts en gardant leurs Défauts». La distinction Atout/Défaut de Dangereuse, Recharge et Répétition n'est pas établie dans les refs citées : si ces propriétés sont des Atouts (et non des Défauts), elles seraient perdues aussi — l'élaboration du document pourrait être inexacte.
- CONFLIT NON SIGNALÉ entre LDB et AA pour la Flèche elfique : LDB 62 l.116 donne «Précise, Empaleuse, Perforante» (nom : «Flèche elfe»), AA 8 l.377 donne «Empaleuse, Perforante, Pointue» (nom : «Flèche elfique») sans «Précise». Le document reproduit correctement les deux tables séparément mais ne mentionne pas ce désaccord entre sources ; un lecteur comparant les deux tables sans lire les en-têtes de source pourrait penser qu'il s'agit de doublons identiques.
- OCR Poudre noire — «Recharge — p. N» dans la source : le document explique correctement que N est le rang de Recharge, mais il s'agit d'une interprétation (cohérente avec les exemples de portée). Signaler comme OCR artifact avec valeur déduite, pas verbatim.
- Ligne Extrême (formule portée, l.241) : la source OCR-garbled dit «Extrême = Portée x — p. 3». Le document corrige en «× 3» (vérifié par les exemples de table l.249). Correct, mais la correction est implicite — aucune note dans le document ne signale que la formule source est corrompue.

### Portée, Allonge et dégradation des armes ⚠
- MINEURE — Groupes d'armes à distance : le topic dit « on peut tenter un Test de Projectiles (Arbalète) ou Projectiles (Lancer) sans la spécialisation correcte » mais la source (l.227-228) précise qu'on utilise « votre Compétence de Tir » (pas la spécialisation correcte, donc). La nuance est subtile : le test s'effectue via la compétence générique CT, pas via la spécialisation — la paraphrase du topic est fonctionnellement correcte mais légèrement imprécise.
- NON-DÉCLARÉE (impl) — effectiveWeapon() dans weaponDamage.ts bascule une arme usée vers reach: 'Moyenne' au lieu de reach: 'Variable' (LDB 62 l.31). Ce point ne constitue pas une erreur dans le topic lui-même (qui cite correctement 'Variable' depuis la source), mais l'implémentation diverge silencieusement de la RAW sur ce champ. À noter pour une éventuelle correction de code.
- OCR confirmé — la table Calcul des Fourchettes de Portée (l.241) affiche 'Extrême = Portée x — p. 3' dans le source .md (artefact de pagination OCR). Le topic l'interprète correctement comme ×3 via la table d'exemple (l.243-253). Pas d'erreur, juste à garder en mémoire si la source brute est relue par un autre agent.

### Atouts et Défauts d'arme ❌
- ERREUR NOM ZI — « Pointes barbelées » est un nom erroné. L'objet du Zoo Impérial (The Imperial Zoo, Appendices l.495-500) qui inflige un État Hémorragique sur les flèches/carreaux s'appelle « Shard Tips » (Pointes de Shard Dragon — de la peau du Shard Dragon). Le terme « barbelées » (barbed) renvoie dans ZI aux « Barbed Forelimbs » du Tregara (tentacules qui entrelacent, pas des munitions). La description du document (« Pointes barbelées (flèches/carreaux) : une attaque infligeant ≥ 1 Blessure applique aussi un État Hémorragique ») est mécaniquement correcte mais attribuée à un mauvais nom d'objet.
- ERREUR TRADUCTION — Dragonblood Quench (ZI Appendices l.483) confère la « Durable Quality » (anglais) selon la source, traduite en « Atout Solide » dans le document. « Durable » et « Solide » (Sturdy dans le LDB) sont deux Atouts distincts en anglais. Si le Zoo Impérial VF n'existe pas dans le dépôt et que seule la version anglaise est disponible, cette traduction est invérifiable mais potentiellement inexacte.
- DESCRIPTION IMPRÉCISE — Tir de zone / Spread (Portée Courte→Longue) : le document dit « la cible + les (Indice) créatures visibles les plus proches à ≤ (Indice) mètres ». La source (Up in Arms l.65) dit « No two targets may be more than (Rating) yards apart » — la contrainte est une distance maximale ENTRE cibles, non une distance maximale depuis la cible principale. La formulation du document est ambiguë/inexacte.
- MÉTA — Les sources AA (« Aux Armes ») et ZI (« Le zoo impérial ») n'existent PAS en version française dans le dépôt : les dossiers réels sont Source/Up in Arms (anglais) et Source/The Imperial Zoo (anglais). Les citations verbatim françaises attribuées à « AA 01 l.XXXX » et « ZI 01 l.XXXX » sont des traductions, pas des citations de source française existante. Les numéros de ligne citées correspondent aux fichiers anglais. Cela ne rend pas les règles fausses mais le « verbatim » est inexact par construction.
- MINEURE — Le nom propre de la 64e capacité magique est « D'habilité et de ruse » dans la source ADE II (l.223) mais « D'habileté et de ruse » dans le document (un 'e' de différence). Probable écart OCR/orthographe.
- MINEURE — Piège-Lame : le document résume « votre adversaire lâche la lame » alors que la source LDB (l.295) dit « votre adversaire laisse tomber la lame qui lui est arrachée ». Paraphrase acceptable mais pas verbatim.
- CONFIRMÉ FIDÈLE — Ensemble du tableau d100 ADE II (28 entrées, 01-19 → 00) : les noms, plages et effets vérifiés correspondent à la source ADE II 4 lue. Pas d'erreur de plage ni d'effet détectée.
- CONFIRMÉ FIDÈLE — Tableau munitions magiques (01-54 / 55-74 / 75-91 / 92-00) : les 4 entrées correspondent exactement à la source ADE II 4 l.266-272.
- CONFIRMÉ FIDÈLE — Toutes les descriptions LDB (À Enroulement, À Poudre Noire, À Répétition, Assommante, Défensive, Perturbante, Dévastatrice, Empaleuse, Explosion, Immobilisante, Piège-Lame, Pistolet, Pointue, Précise, Protectrice, Incassable, Percutante, Perforante, Rapide ch.62 ; Taille, Dangereuse, Épuisante, Imprécise, Inoffensive, Lente, Recharge ch.63) vérifiées contre la source — mécaniques correctes.
- CONFIRMÉ FIDÈLE — Atouts AA (Déséquilibrée, Trip/Déstabilisante, Slash/Taillade, Spread/Tir de zone, Salvo/Salve, Shield/Protectrice modifiée) et règle Atouts Optionnels (choix avant le jet, défaut = premier Atout listé) : mécaniques correctement rapportées depuis Up in Arms, à la nuance « Spread » signalée ci-dessus.
- CONFIRMÉ FIDÈLE — Dague funeste (ZI) : « Difficult (-10) Endurance Test » = « Résistance Complexe (-10) » en VF ; d10 secret sur 1 = poison épuisé + prochaine utilisation brise l'arme ; illégale dans l'Empire. Tout vérifié.
- CONFIRMÉ FIDÈLE — Lame à poignée bois de cerf (ZI) : ne se brise jamais en combat ; si ramure obtenue par violence → 1 Hémorragique sur utilisateur ET victime à chaque Blessure Critique. Vérifié.
- CONFIRMÉ FIDÈLE — Griffon Fletching (ZI) : agit comme des flèches elfes (Elf Arrows). Vérifié.
- CONFIRMÉ FIDÈLE — Sève de trégara (ZI, Tregara Sap) : jusqu'à 6 carreaux d'arbalète, utilisables dans la journée, gagnent l'Atout Perforante. Vérifié.
- CONFIRMÉ FIDÈLE — Règles-cadres ADE II : toute arme magique blesse les Éthérés (l.206) ; Atouts conférés non cumulables, exemple -20 Rapide (l.208). Vérifié (la valeur -20 est bien dans ADE II, pas une erreur du document — c'est ADE II qui diverge de LDB).
- NON VÉRIFIABLE — Pétards NADJ (ch.08 l.159-160) : le contenu de la ligne 160 est « Omitted long matching line » dans tous les outils disponibles. Les stats revendiquées (Projectiles (Explosifs), CC 50, Explosion 1, Dangereuse, 5 % En flammes) ne peuvent pas être confirmées ou infirmées.

### Armures : table, PA, dégâts et réparation ⚠
- Déviation Critique (LDB 63 l.32) : la source dit « Vous subissez toujours les Blessures normales (et étant donné que vos PA sont à présent réduits de 1 Point, vous subissez probablement une Blessure supplémentaire) », en un seul membre de phrase. Le markdown sépare en deux bullets distincts (« les PB ordinaires sont infligés quoi qu'il arrive » + « vous subissez probablement une Blessure supplémentaire ») et reformule l'intérieur de la parenthèse. La substance est préservée mais la structure source n'est pas respectée verbatim.
- Atout Flexible (LDB 63 l.73-74) : la source dit uniquement « vous gagnez les bénéfices des deux ». Le markdown ajoute une précision éditoriale non présente dans la source : « les PA de la pièce Flexible et ceux de la pièce rigide se cumulent à l'emplacement commun ». L'interprétation est correcte mais ce n'est pas du verbatim sourcé.
- Règle de port — section éditoriale (note * LDB 63 l.60) : la phrase « seul l'Atout Flexible autorise une superposition cumulant les PA » est une inférence non présente dans le texte source. La source ne dit pas explicitement que c'est le seul cas ; c'est une extrapolation logique du texte Flexible.

### Localisation des créatures non humaines ❌
- ERREUR DE TABLE — commentaire Araignées inversé : le document dit « La Tête couvre une plage plus large que chez le serpent » mais c'est l'inverse. Tête Araignée = 01-09 (9 cases) < Tête Serpent = 01-19 (19 cases). Source LDB 76 l.25-28.
- INFÉRENCE NON SOURCÉE — « Ce choix est gratuit : il ne coûte pas le malus de Localisation visée (le −10 Complexe) ». LDB 76 l.40 dit seulement 'choisissez une Localisation correspondant à ce qui est le plus proche de vous'. La règle ne précise pas que ce choix est exempt du malus de coup ciblé.
- INFÉRENCE NON SOURCÉE — « Pour une cible seulement +1 catégorie, viser coûte encore le malus habituel. » LDB 76 ne dit rien sur le cas +1 catégorie : la règle n'est formulée qu'au seuil ≥2 catégories, sans mention du cas +1.

### Schéma de profil et Traits standard de créature ⚠
- Elfe Facultatif (LDB 77 l.46) : la source écrit « Résistance magique » mais le document normalise en « Résistance à la Magie » (nom canonique du trait dans LDB 85). Harmonisation défendable mais la LDB 77 dit bien « Résistance magique ».
- Section 10 — lignes de profil abrégées : Horreur Rose, Horreur Bleue et Fhluger'Dagh ne montrent qu'une partie des 12 caractéristiques (ex. Horreur Rose : « M4 CC49 CT39 F49 E39 I69 Ag59 B17 » — Dex39 Int49 FM69 Soc19 omis). Les valeurs affichées sont exactes, mais les profils sont incomplets.
- Note éditoriale sur le tiret (–) de caractéristique absente : l'affirmation « un Test requis sur une caractéristique absente est traité selon le Trait qui régit la créature (cf. Décérébré, Fabriqué) » est une inférence éditoriale — LDB 76 n'énonce pas cette règle sur la notation tiret ; elle découle de la lecture de Fabriqué (réussite auto) et Décérébré (jamais testé) pris séparément. Plausible, non inventé, mais non directement cité en LDB 76.

### Traits d'attaque naturelle des créatures ❌
- VENIN — mécanique inventée : le document décrit Venin comme «cible qui perd des PB → Test pour résister, sinon État Empoisonné» (tableau) et «La cible tente un Test (Résistance / Endurance) de Difficulté indiquée ; défaut = Intermédiaire (+0) ; en cas d'échec → État Empoisonné» (texte intégral). Le RAW (LDB 85 l.389-389) dit : «Quand elle inflige des Points de Blessure avec ses Attaques venimeuses, son adversaire subit un État Empoisonné. Si aucune Difficulté n'est indiquée pour résister au Venin, le Test est considéré comme Intermédiaire.» — l'État Empoisonné est infligé DIRECTEMENT ; la Difficulté gouverne le Test de Résistance de FIN DE ROUND pour retirer l'état (confirmé par AU1 04 l.38 : «qui nécessitent un Test de Résistance Intermédiaire (+0) pour les éliminer à la fin de chaque Round»). Aucun test de résistance initial n'existe dans le RAW.
- EMPÊTRÉ — règle d'échappée : `LDB 16 l.66` porte « Vous pouvez utiliser votre Action pour retirer l'État *Empêtré* en réussissant un Test opposé **de Force** contre la source de cet empêtrement, et chaque DR obtenu permet de retirer un État *Empêtré* supplémentaire. » — dans la section *Empêtré* (l.60-66), pas dans *Brisé*.
- TENTACULES — ordre du nom inversé : le document écrit «Tentacules # (Indice)» alors que le titre LDB est «# Tentacules (Indice)» (l.354). Mineur mais inexact si des vérifications de libellé sont faites par correspondance exacte.
- LANGUE PRÉHENSILE — défense non précisée dans le Trait : le tableau indique «CT / Esquive (à distance)» comme défense. Le texte LDB du trait (l.185-188) précise seulement «C'est une Attaque à distance» sans spécifier explicitement le jet de défense dans la description du trait lui-même. L'inférence «Esquive» est raisonnable (règle générale des attaques à distance) mais n'est pas un verbatim du trait ; à signaler comme inférence.
- OCR Toile/Vol (signalé dans le doc) : la ref «l.380» pour la Toile est correcte malgré l'inversion des titres aux l.363-364 ; le document le note honnêtement — ce n'est pas une erreur du doc, juste une confirmation que la ref est fiable.

### Traits de défense et de résilience des créatures ⚠
- Instable — interprétation non sourcée 'le plus grand écart' : La source (LDB 85 l.199) dit 'Chaque fois qu'elle met fin à un Round Engagé avec un adversaire ayant un Avantage supérieur' — le texte RAW décrit un déclenchement par adversaire, sans préciser qu'on ne retient que l'écart maximal. L'interprétation du document ('on compte le plus grand écart et on retire cet écart en PB') est une inférence d'implémentation absente du texte. Incertitude : l'effet pourrait s'appliquer une fois par adversaire en supériorité (plusieurs pertes de PB au même Round). À confirmer et arbitrer MJ.

### Traits de comportement et de psychologie des créatures ❌
- CORRUPTION TABLE — Exposition Modérée : la source (LDB 19 l.48) dit 'Sur un Succès (2+ DR), vous ne gagnez aucun Point de Corruption' (un seul seuil). Le tableau du markdown scinde ce seuil en 'Succès (2-3 DR) = 0' et 'Succès Impressionnant (4+ DR) = 0', introduisant une colonne à 4 tiers qui n'existe pas dans la source pour Modérée (contrairement à Majeure qui a bien 4 tiers explicites). La valeur est correcte (0 dans les deux cas) mais le label 'Succès (2-3 DR)' déforme la source en remplaçant '2+ DR' par '2-3 DR'.
- CORRUPTION TABLE — Exposition Mineure : la source (LDB 19 l.35) ne mentionne qu'un seul cas ('Sur un échec, gagnez 1 Point de Corruption'). Le tableau affiche des '—' pour les colonnes 'Succès Minime', 'Succès (2-3 DR)' et 'Succès Impressionnant', ce qui est correct en valeur mais invente une structure à 4 colonnes non présente dans la source pour Mineure.
- RAGE — wording mineur : la source (LDB 85 l.282) dit 'pour que celui devienne _Haine_' (pronom 'celui' = l'Avantage accumulé). Le markdown dit 'pour que cela devienne _Haine_'. Changement de pronom non conforme à la source, mais sans impact mécanique.
- BESTIAL — parenthèse d'inférence : le markdown ajoute '(pas de Parade)' après 'ne peut utiliser que la Compétence Esquive'. Cette parenthèse est une inférence correcte mais n'est pas dans le texte source (LDB 85 l.59) ; à signaler comme ajout non littéral.
- FRÉNÉSIE (Trait) — ref : le markdown cite 'LDB 85 l.150' pour le Trait Frénésie et renvoie à 'page 190'. La source (ligne 120-121) dit bien 'La créature peut entrer en _Frénésie_. Voir page 190.' La citation est fidèle. Pas d'issue.
- TEST DE PSYCHOLOGIE — la mécanique du Test de Calme 'au début du Round' s'applique au Test de résistance général (LDB 21 l.9). Cependant pour Peur, la source précise qu'on peut tenter 'à la fin de chaque Round' (LDB 21 l.25 : 'Vous pouvez effectuer ce Test à la fin de chaque Round'). Le markdown présente correctement ces deux moments distincts (début de Round pour la résistance générale, fin de Round pour vaincre la Peur par Test étendu). Pas d'issue.
- HAINE — condition de fin : le markdown dit 'quand tous les membres du groupe en Ligne de Vue sont morts/disparus ou qu'on gagne l'État Inconscient'. La source (LDB 21 l.39) dit 'lorsque tous les membres du groupe concerné dans votre Ligne de Vue seront morts ou auront disparu, ou que vous gagniez l'État Inconscient'. Le markdown fusionne 'morts' et 'disparus' en 'morts/disparus', ce qui est fidèle au sens. Pas d'issue.

### Traits de mouvement et modificateurs d'attributs des créatures ⚠
- Foulée (LDB 85 l.145-146) : la source dit « Multipliez son Mouvement de charge de 1,5 quand elle Court » (préposition « de »), le topic écrit « par 1,5 » (préposition « par »). Pas d'erreur mécanique, mais transcription légèrement infidèle.
- Vol (LDB 85 l.437) : la source dit « augmenter la distance de 1 » sans le mot « niveau » ; le topic ajoute « 1 niveau (catégorie de Portée) » entre parenthèses — interpolation non verbatim, acceptable en résumé mais à noter pour une citation exacte.
- Vol (LDB 85 l.437) : la source dit « une Longue Distance devient une Distance Extrême » ; le topic dit « une Longue Distance devient Extrême » (suppression du deuxième « Distance ») — différence mineure de formulation.

### Taille : catégories et modificateurs de combat ⚠
- ZI 'Se cabrer' vs Piétinement dans Taille — RÉSOLU (#474a) : les deux entrées ZI coexistent bien côte à côte avec des économies d'action DISTINCTES (Se cabrer = Action de Mouvement, ZI 14 l.1070/l.1162 ; Piétinement générique = 1 Avantage, ZI 14 l.1075, LDB 85 l.386-387) — ce ne sont PAS deux formulations d'un même coût. Le markdown (corps l.3752 + Récapitulatif l.3793) a été corrigé pour ne plus dire 'même effet' et citer l'Action de Mouvement. Le Trait `se-cabrer` (`src/data/traits.json`) encode désormais ce coût : `applyTrample`/`aiCreatureFreeAttacks` (`src/state/combatFlow.ts`) et `battleTrample`/`trampleConfirm` (`src/state/combatSlice.ts`) consomment `movementUsed` (plein Mouvement) au lieu de l'Avantage quand le Trait est présent.
- Parenthèse éditoriale non sourcée — 'donc avant l'absorption Endurance + Armure' : le LDB (l.297) dit uniquement 'cette multiplication est calculée après l'application des modificateurs' sans préciser la relation avec l'absorption BE/PA. L'ajout '(donc avant l'absorption Endurance + Armure)' est une inférence de l'auteur absente du texte RAW. Correcte sur le plan des règles mais non attestée à cette ligne.
- Inversion des modificateurs non verbatim : la section 'Utiliser les Tailles' du LDB (l.277) dit seulement 'Inversez le procédé si vous voulez rendre une créature plus petite', sans énoncer explicitement '−10 F/E, +5 Ag'. Le Récapitulatif 'Sources RAW' donne ces valeurs chiffrées comme si elles étaient dans la source — il s'agit d'une inférence correcte mais pas d'une citation verbatim.
- ADE II 2 l.570 — règle supplémentaire omise : ADE II dit qu'un ogre (Taille Grande) peut 'utiliser soit le nombre indiqué sur le dé, soit le DR pour déterminer les Dégâts'. Cette option spécifique aux ogres n'est pas mentionnée dans le markdown. Omission bénigne (le contexte traite la Taille en général, pas les ogres spécifiquement) mais signalable pour exhaustivité.

### Trait Nuée ❌
- TABLEAU TAILLE — La table présentée sous 'LDB 85 l.346-355' inclut deux colonnes absentes de cette source : 'Hauteur ou Longueur' (ex. 'Moins de 30cm', 'Jusqu'à 60cm'…) et 'Mod.' (−30/−20/−10/0/+20/+40/+60). La table LDB 85 l.346-355 n'a que deux colonnes : Taille et Exemples (pas de dimensions ni de modificateurs). Ces colonnes proviennent d'une table distincte dans LDB 14 (pages 162-165, lines 151-170), qui est le tableau de Difficulté de Combat par taille. La ref LDB 85 l.346-355 est correcte pour les exemples, mais les colonnes hauteurs et modificateurs sont ajoutées depuis une autre source sans le signaler.

### AA : système alternatif de Blessures et Critiques ❌
- HEAD table row 31-35 « En plein front » — ERREUR DE TRANSCRIPTION SIGNIFICATIVE. Source (Up in Arms ch.08): 'Gain 2 _Bleeding_ Conditions and a _Blinded_ Condition that cannot be removed until all _Bleeding_ Conditions are removed.' C'est le BLINDED (_Aveuglé_) qui ne peut pas être retiré avant que tous les états Hémorragique soient éliminés. Le markdown FR inverse la restriction : il dit que ce sont les 2 états _Hémorragique_ 'qui ne peuvent pas être retirés' — ce qui est mécaniquement faux (et absurde : les Hémorragiques se retirent naturellement). Correction : les 2 États _Hémorragique_ sont accordés normalement, et c'est l'État _Aveuglé_ qui ne peut pas être retiré tant que tous les _Hémorragique_ ne sont pas éliminés.
- Bandage page reference — mineure / incertaine. Le markdown FR indique 'voir les règles de bandages, p. 308' tandis que la source anglaise (Up in Arms line 18) cite 'WFRP, page 309'. Impossible de vérifier la pagination du VF Aux Armes sans accès au PDF FR, à signaler à un relecteur humain.
- Placement de l'État _Exténué_ (Fatigued) après retrait de tous les _Hémorragique_ — incertitude éditoriale. Dans la source EN (line 31), la phrase 'Once all Bleeding Conditions are removed, gain one Fatigued Condition' apparaît à l'intérieur de la section 'Inflicting a Critical Hit on an Opponent with Wounds', pas dans la section Bleeding update. Le markdown FR la place dans la section Hémorragique. Ce classement peut correspondre à l'organisation du VF mais ne peut être vérifié sans le PDF FR — à confirmer par un relecteur.

### AA : État Hémorragique et nouveaux Atouts/Défauts ⚠
- MINEUR — bleedIgnoreLevel/Endurci (impl. note) : le document mentionne 'bleedIgnoreLevel pour Endurci' dans la section Implémente pour l'état Hémorragique. La source AA 7 l.5 dit simplement 'en ignorant tous les modificateurs' (BE et PA). Aucune règle AA ou LDB ne lie explicitement le talent Endurci à une atténuation du saignement Hémorragique. Si ce 'bleedIgnoreLevel' est une extrapolation code non sourcée, il y a invention de règle ; si c'est un mécanisme LDB préexistant dans le code, il faudrait citer la ref LDB. À vérifier dans conditions.ts et LDB.
- MINEUR — l.2476 hors-contexte structurel : la phrase 'Une fois tous les États Hémorragique retirés, gagnez un État Exténué' est placée dans la source au milieu de la section 'Infliger Un Coup Critique À Un Opposant Auquel Il Reste des Blessures' (entre l.2473 et l.2478), vraisemblablement un artefact de mise en page PDF. Le document l'attribue correctement à l'État Hémorragique et la citation/ref est exacte — aucune erreur factuelle, mais la position dans la source est atypique (prévoir confusion lors d'une relecture).
- MINEUR — impl. note Tir de zone : 'bout portant ≤ 1 case' est une interprétation code de la bande de portée RAW. La source AA ne définit pas 'bout portant' en cases — c'est une approximation d'implémentation, non un fait RAW. Acceptable en section Implémente mais à distinguer du RAW.
- AUCUNE erreur factuelle sur les valeurs/tables : toutes les stats du Tableau des Armes de Base (l.2852-2868), les textes verbatim des Atouts (Déséquilibrée l.2801, Déstabilisante l.2803-2805, Taillade l.2807, Tir de zone l.2809-2815, Protectrice l.2824), et la définition de l'État Hémorragique (l.2456-2460) sont conformes à la source AA.

### AA : armes de mêlée — tables et règles spéciales ⚠
- Épée bâtarde (tableau Deux Mains) : la note "en plus de perdre l'avantage des deux mains" est un ajout éditorial absent du RAW (AA 08 l.343). La source dit uniquement qu'elle acquiert Épuisante et Lente ; l'énoncé n'est pas faux mais n'est pas dans le texte source.
- La ref l.2878 pour la règle du Pavois pointe sur le titre de section ("## Les Boucliers") ; le texte du Pavois commence réellement à l.2881. Décalage mineur sans impact sur le contenu.
- La ref l.2902 pour les armes de cavalerie pointe sur le titre de section ("## Les Armes de Cavalerie") ; le texte commence à l.2903. Décalage mineur identique.

### AA : armes à poudre à canon et munitions — tables ⚠
- MINEUR — Balle de gros calibre / règle Assourdi : le topic écrit « le tireur **et** quiconque se tient à 2 mètres ou moins » mais la source (l.3233) dit « Ceux qui tirent avec ces munitions **ou** se tiennent à 2 mètres ou moins de l'utilisateur » — la conjonction est OU (deux groupes distincts), pas ET. Effet pratique similaire, mais la formulation est inexacte.
- MINEUR — Description de la poudre imprégnée d'Aqshy (section règle, pas la citation verbatim) : le topic simplifie « par des moyens connus uniquement du Collège Flamboyant » en « par le Collège Flamboyant » et omet « quantité supplémentaire » (source l.3261 : « imprégné d'une quantité supplémentaire d'Aqshy par des moyens connus uniquement du Collège Flamboyant d'Altdorf »). La citation verbatim en bas de la section est exacte. Acceptable comme paraphrase mais l'imprecision mérite d'être signalée.

### AA : Combat Monté étendu et dressage ⚠
- [STRUCTURAL] La règle 'passer outre' (Charge traversante, l.3347-3349) apparaît dans la source sous le titre 'Les Attaques Contre les Quadrupèdes' (l.3334), séparée du trait 'Dressé (Cavalerie de Choc)' par la table de localisation. Le markdown la déplace à l'intérieur de la section Cavalerie de Choc. L'attribution est correcte (l.3347 dit bien 'ce Trait'), mais la structure éditoriale est réorganisée par rapport à la source.
- [MINEUR] Section 'Le Mouvement et l'Initiative' : le markdown ajoute '(Trait Nerveux)' entre parenthèses dans 'cela peut nécessiter un Test (Trait Nerveux)' pour indiquer que le test est lié au Trait Nerveux. La source (l.3284) a un H2 distinct 'Le Trait Nerveux' pour ce passage mais ne spécifie pas explicitement que le Test est conditionné au Trait Nerveux à cet endroit — ajout interprétatif non présent mot pour mot dans la source.
- [MINEUR OCR] Table localisation quadrupèdes : la source (l.3342, l.3344) a 'Patte avantgauche' et 'Patte arrièregauche' (artefact OCR, pas d'espace). Le markdown normalise correctement en 'Patte avant gauche' / 'Patte arrière gauche' — non problématique.
- [INFO] Profil Demigriffon : la prose (l.3390) liste 'Dressé (Monture, Guerre, Magie et Cavalerie de choc)' pour les demigriffons adultes dressés, mais le statbloc (l.3415) omet 'Magie'. Le markdown suit le statbloc (sans Magie), ce qui est cohérent avec la fiche de profil. L'incohérence est dans la source elle-même, non dans le markdown.

### AA : Structures et armes de Siège ❌
- ERREUR dans l'explication de l'exemple Salve (§4) : le markdown dit « 5e tir global = −40 » en laissant entendre que la pénalité −10 cumulatif s'accumule GLOBALEMENT sur les rounds. La source (AA 10 l.266-268) indique que la pénalité repart bien à 0 au début de chaque Round, et que le 5e tir du Round 2 est à −40 parce que c'est le 5e tir de CE round, pas le 5e tir au total depuis le début du combat. L'expression « 5e tir global » est trompeuse et techniquement inexacte.
- OMISSION mineure (§4, Salve) : la source (l.3955) précise que la pénalité cumulative de −10 s'applique « chaque fois que quelqu'un tire avec l'arme après la première » dans le Round. Le markdown reformule de façon exacte sur ce point, mais n'indique pas explicitement que le compteur repart à zéro à chaque nouveau Round (c'est seulement implicitement dit par « on repart à 0 de pénalité »). À clarifier pour éviter toute ambiguïté.
- NOTE ÉDITORIALE § armes de siège (Pierrier) : le markdown interprète correctement l'artefact typographique « Recharge — p. 4 » comme Recharge 4 (sans Arme d'équipe), mais cette interprétation est présentée comme certaine alors que la source est ambiguë ; signaler l'incertitude résiduelle.
- Tous les tableaux (Structures courantes, Blessures Critiques, Armes de Siège, Munitions, Pénalités d'équipe incomplète, Incidents de Tir) sont fidèles à la source : valeurs, ordres de lignes et libellés vérifiés ligne à ligne sans écart.

### AA : Rompre le combat et Poursuites détaillées ❌
- ERREUR TABLE OBSTACLES — Caisses de marchandises : le document indique « Test d'Athlétisme Accessible (+20) » mais la source (AA 10 l.390) dit clairement « Test d'Athlétisme Intermédiaire (+0) ». Valeur incorrecte à corriger.
- OMISSION MINEURE — Nid-de-poule (colonne Perçu) : la source (l.4101-4103) donne « Test de Perception Intermédiaire (+0) » (difficulté du test de détection), le document note juste « Test de Perception » sans mentionner la difficulté. Même omission pour Sables mouvants (l.4109) : « Test de Perception Intermédiaire (+0) » → doc dit « Test de Perception » seulement. À compléter pour être exhaustif, pas une invention.
- Toutes les autres valeurs et tables vérifiées sont conformes à la source : méthodes de désengagement (l.3979-3983), poursuite simple (l.3988-3998), table de seuil d'échappement (l.4007-4013), pénalités Mouvement ≤3 (l.4023), table de Progression (l.4028-4043), seuil 16 m (l.4017), table des obstacles restants (l.4082-4151 sauf caisses), table d'Épuisement (l.4155-4176), table de conversion Combat→Poursuite (l.4182-4197) — tous exacts.

### AA : Talents de combat ⚠
- MINEUR — Exemple 'Cavalier Émérite' mal localisé dans le fichier source (artefact de conversion PDF) : le texte 'une autre personne sur un cheval ne causerait pas de Peur…' (l.4496) est physiquement placé après Frappe Blessante dans le .md source, pas après Cavalier Émérite. La section de refs du document le note correctement (l.4492-4496 / Frappe Blessante + exemple), mais le corps du document l'intègre sous Cavalier Émérite, ce qui est logiquement juste. Pas d'erreur factuelle, simple artefact de conversion signalé.
- MINEUR — Commandant d'Équipe : le document dit 'score de Projectiles du Personnage' ; la source dit 'score de Compétence Projectiles du Personnage' (l.4478). Omission du mot 'Compétence', sans impact sur le sens.
- NON VÉRIFIÉ — Les notes de divergence LDB (Battement '−1 par DR' vs '−1 à 6 DR', Frappe Blessante '+Blessures', Impitoyable 'Désengagement', Porte-Bouclier '+Avantage', Renversement 'TOUS les Avantages', Coude-à-Coude) n'ont pas pu être vérifiées faute de lecture du LDB dans cette session. Elles sont signalées comme divergences, pas vérifiées. L'agent relecteur devrait confirmer ces points contre Source/Warhammer v4 - Livre de base version corrigee.

### AA : Activités guerrières ⚠
- Titre de la 4e activité tronqué : le topic écrit « Fabuleuse Vente du Comte de Punchausen » alors que la source (AA 12 l.46) donne « Fabuleuse Vente des Aventures du Comte de Punchausen » (« des Aventures » manquant).

### AA : Miracles martiaux (Myrmidia) ⚠
- Tableau récapitulatif, colonne Fureur Vengeresse : 'relance de tous les jets de Corps à Corps' — la source (l.2432) dit 'jets de Compétence Corps à Corps'. Abréviation sans incidence sur le sens, et la section détail reproduit le texte exact. Signalé pour cohérence de terminologie.

### Armes et armures des ogres (ADE II) ❌
- INTRO l.554 — La phrase d'accroche du markdown liste « immenses massues, lance-harpons, canons crache-plomb, pansières » mais l.554 ne cite que « leurs immenses massues et leurs impressionnantes pansières ». Lance-harpons et canons crache-plomb sont des ajouts absents de la source à cet endroit.
- QUALIFICATION « Spéciale** » appelée « Défaut » — le markdown dit « ce qui justifie le Défaut « Spéciale** » » mais la colonne source est « Atouts et Défauts » et rien dans le texte ne précise si « Spéciale » est un Atout ou un Défaut. C'est une interprétation non étayée.
- INCOHÉRENCE SOURCE non signalée — La table (l.572) liste « Entraves » pour le lance-harpon, mais l.600 dit « l'Atout Immobilisante » (corde séparée → perte de l'Atout Immobilisante). Le markdown transcrit fidèlement les deux mais ne signale pas que les deux noms désignent peut-être la même qualité ou qu'il y a une incohérence dans le livre source.
- STRUCTURE SOURCE (PDF artifact) — Dans le source (l.605-611), le header « ## **Canon Crache-Plomb** » (l.606) apparaît ENTRE le header « ## **Massues Ogres** » (l.605) et sa description (l.607), vraisemblablement un artefact de conversion PDF. Le markdown assigne correctement le contenu, mais la ref « ADE II 02 l.663-668 » pour les massues inclut la ligne du canon crache-plomb (l.606) — légère imprécision de ref.
- l.600 POSITION — La ligne l.600 est un fragment de phrase qui complète la description du lance-harpon de l.619-620 (coupée par la conversion PDF). Le markdown la cite correctement dans les règles spéciales du lance-harpon, mais la présente comme source distincte « [ADE II 02 l.673-674], l.600 » alors que c'est une seule description fragmentée.

---

## Hors-taxonomie (bucket « autre »)

Passages de combat repérés au survey mais hors des topics ci-dessus (à reclasser) :

- `ADE II 02 l.576-577` (ADE II) — Si un ogre touche créature de Taille inférieure, peut charger dans son espace et attaquer créature adjacente supplémentaire (max = Bonus Capacité Combat). Pas nécessaire que cible initiale meure.
- `ADE II 02 l.711` (ADE II) — Ogre subit -20 à tous Tests utilisant possessions non adaptées sa taille. Exemple : doigt ogre ne peut pas presser détente pistolet à répétition.
- `ADE II 08 l.52-64` (ADE II) — Puissance de Bataille : Attribut 0-100 représentant taille + force armée. Modificateurs : Mal équipée -10, Bien équipée +10, Lanceurs sorts +10, Vétérans +10, Élites +20, Taille Petite -10, Taille Grande +10, Taille Énorme +20, Taille Monstrueuse +30.
- `ADE II 08 l.69-71` (ADE II) — Discours Inspirant : Test Commandement difficulté = différence Puissance arrondie dizaine. Succès = armée gagne +10 Test Puissance Round 1 bataille.
- `ADE II 08 l.138-141` (ADE II) — Charge au combat : 1+ Personnages chargent max 2 Rounds. Côté chargeant débute avec 1 Avantage. Chaque ennemi touché = Puissance ennemie -1, chaque ennemi neutralisé/tué = -2.
- `ADE II 08 l.144-147` (ADE II) — Pluie de Flèches : Armes distance 2 Rounds tirer ennemi approche. Portée max vitesse ennemi. Chaque attaque réussie -1 Puissance/ennemi touché, neutralisé/tué -2. Pas même cible deux fois.
- `ADE II 08 l.150-153` (ADE II) — Motivation : Test Compétence résoudre problèmes armée (blessés, moral). Succès = +DR Puissance armée. Peut être Test simple ou étendu.
- `ADE II 08 l.156-159` (ADE II) — Protection : 3 Rounds Combat protéger cible précise ennemi. Succès = Puissance ennemie -5 OU armée +5. Test Compétence soutien cible réduit Rounds -1.
- `ADE II 08 l.162-165` (ADE II) — Tenez Votre Position : Ennemi Test opposé chaque Round vs Personnages compétences adaptées. Point rupture cumule DR. Atteint 10+ ou 5 Rounds = déroute. Chaque Round avant rupture = Puissance ennemie -2, bonus cumulatif +10 suivants.
- `ADE II 08 l.168-171` (ADE II) — Compte à Rebours : 3 Rounds empêcher coup dévastateur = Puissance ennemie -10. Échec = Scène Motivation suivante. Ennemi tir machine malepierre.
- `ADE II 08 l.174-178` (ADE II) — Percée : 3 Rounds éliminer tous soldats adverses OU remplir objectif = Puissance armée +10. Échec = retraite possible ou Charge si renforts.
- `ADE II 08 l.207-218` (ADE II) — Scènes uniques bataille : Ligne de mire (capitaine isolé, Puissance -5), Tuez la Bête (3 Rounds tuer créature géante, -10 Puissance), Survol (monture volante, Test Chevaucher +0), Intrus (infiltrés, autres Scènes -20), Duel (généraux, -20 Puissance perdant).
- `ADE II 08 l.227-306` (ADE II) — Machines de Guerre : Baliste (+14 dégâts, Rare), Bélier (+BF+10, 6 équipage), Batterie tonnerre feu (+12, 4 équipage), Canon répétition feu d'enfer (+14, 4 équipage), Canon (+20, 4 équipage), Canon flammes nain (2+DR États En flammes), Mangonneau (+10), Onagre (+12), Trébuchet (+14), Mortier (+20). Atout Siège dégâts doublés structures. Machines = +5 Puissance (siège +10). Équipe incomplète = Puissance ÷2.
- `ADE II 08 l.281-301` (ADE II) — Structures : Porte BE2/BL8 Résistant, Porte blindée BE5/BL15 Résistant, Porte ville BE10/BL30 Impénétrable, Mur bois BE6/BL15 Résistant, Mur pierre BE12/BL40 Impénétrable. Atout Résistant = pas dégâts Armes distance sans Siège. Atout Impénétrable = pas dégâts sans Siège.
- `ADE II 04 l.214` (ADE II) — Armes magiques : blessent créatures normalement immunisées attaques non-magiques (ex. Trait Éthéré).
- `ADE II 04 l.240` (ADE II) — Atout arme magique Crocs et griffes : créatures Bestial Test Force Mentale Complexe (-10) avant attaquer utilisateur.
- `ADE II 04 l.241` (ADE II) — Atout arme magique Bannissement profond : repousse démons/morts-vivants éthérés. +3 Avantage supplémentaire Trait Instable.
- `ADE II 04 l.247` (ADE II) — Atout arme magique Coupure infinie : Dégâts infligent +2 Blessures supplémentaires.
- `ADE II 04 l.285` (ADE II) — Munition magique Flèche puissance : Dégâts infligés = +1d10 supplémentaires ignorant Armure/Endurance.
- `EDO 11 l.157-165` (EDO) — Suggestion : deux niveaux de Difficulté supplémentaires — Presque Impossible (-40) et Impossible (-50) — à ajouter au tableau LDB standard. Plafond combiné reste -50. Recommandé d'utiliser avec les règles d'Échec/Réussite automatique (01-05 = succès minimum même sous 0). Ces difficultés s'appliquent aussi aux tests de combat (Calme vs Terreur 3-5, crochetage de serrures ultra-complexes). topicId suggéré : 'difficultes-combat-taille-surnombre' ou 'autre'.
- `MSRC 15 l.138-163` (MSRC) — Traits de créatures nouveaux : Aquatique (respire sous eau, pleine vitesse en immersion), S'accrocher Pour Se Nourrir (perte 1 BF/Round jusqu'au KO), Hallucinogène (test FM Accessible +20 ou États Sonné), Rampant (pas d'Action Course), Salive Analgésique/Anticoagulante, Capricieux (1d10 ±0-2 DR modifier), Engloutir (État Empêtré+1/Round, perte 1 BF).
- `MSRC 12 l.16-48` (MSRC) — Tactiques des naufrageurs : Balisage Trompeur (nuit), Faux Pilote (test Intuition opposé), Dangers Artificiels (récifs, barrières à chaînes) ; dégâts de naufrage décrits p.30 du livre (ref externe).
- `MSRC 12 l.163-171` (MSRC) — Scénario Attaque Pirate : 2 pirates/personnage combatif + 1/autre, grappins à couper (BE 3, BF 8, 4 Rounds), tirs aux Projectiles pendant rapprochement ; chef Test Commandement Accessible +20 après mort/magie (abandon si raté).
- `NADJ 06 l.176-186` (NADJ) — Règles du Duel Judiciaire (jugement par combat) : 'premier sang' = première attaque causant >3 Blessures (coups moindres = estafilades) ; 'incapable de continuer' = réduit à 0 Blessure. Serment de véracité obligatoire, inspection des armes, arbitrage par prêtresse de Verena. Pas de projectiles (règle générale des lois locales). Armes au libre choix des champions. Suggestion topicId : 'duel-judiciaire-combat-honneur'.
- `NADJ 11 l.21-29` (NADJ) — Griffes de Tigre (nouvelle arme) : même profil que la Dague mais utilisent Corps à corps (Bagarre) ; sur un Test réussi, les blessures semblent causées par un gros félin. Suggestion topicId : 'armes-melee-tables' (ou 'aa-armes-melee-tables' si le topic vise les nouvelles armes des suppléments).
- `NADJ 15 l.53-55` (NADJ) — Nouveau Talent 'Empreint d'Ulgu' (max 1) : permet d'utiliser Focalisation (Ulgu) à la place de Discrétion pour tous les Tests qui y font appel. Toute incantation réussie de sort du Domaine des Ombres à moins de 8 mètres gagne +1 DR (bonus non cumulable). Suggestion topicId : 'aa-talents-combat' (talent non-combat mais affecte les jets de compétence).
- `NADJ 16 l.34` (NADJ) — Bras de fer : Test opposé étendu de Force Intermédiaire (+0) ; ajouter Bonus de Force au nombre de DR à chaque tour ; le gagnant de chaque tour gagne +1 Avantage utilisable selon les règles normales d'Avantage ; premier à 10 DR remporte. Par tranche de BE tours sans vainqueur, les deux gagnent +1 État Exténué (récupérable après 5 minutes de repos). Suggestion topicId : 'avantage'.
- `NADJ 05 l.58` (NADJ) — Si une bagarre dure plus de 2 Rounds, le propriétaire et le personnel interviennent, aidés de clients. Si des armes sont dégainées ou que le combat dure plus de 3 Rounds à l'étage, les gardes de la Gravin viennent calmer la nuisance. Règle de gestion du combat en lieu public (intervention d'innocents). Suggestion topicId : 'resolution-attaque-melee-distance'.

---

*Couverture du survey (passages repérés par livre)* : LDB 36 · ADE I 0 · ADE II 24 · AA 28 · ZI 11 · MCLB 0 · EDO 18 · EDOC 1 · MSR 0 · MSRC 7 · PDT 0 · ACE 0 · AU1 8 · NADJ 13.
