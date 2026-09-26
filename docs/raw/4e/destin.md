# Atlas RAW — Destin, Résilience & Détermination

> Référentiel autosuffisant des règles WFRP4 (RAW). Chaque règle cite `LDB NN l.X-Y` (source = dernier recours). Voir [`sources.md`](../sources.md), [`00-index.md`](00-index.md).
> ⚠️ Les champs **Implémente** sont GÉNÉRÉS (`npm run raw:implemente` — source éditoriale : `src/data/raw.manifest.json`) — ne pas les éditer à la main.

## Sommaire

- [Vue d'ensemble : Destin vs Résilience](#vue-densemble--destin-vs-résilience)
- [Valeurs de départ à la création](#valeurs-de-départ-à-la-création)
- [Destin & Chance — définitions](#destin--chance--définitions)
- [Dépenser de la Chance](#dépenser-de-la-chance)
- [Dépenser du Destin](#dépenser-du-destin)
- [Regagner du Destin et de la Chance](#regagner-du-destin-et-de-la-chance)
- [Résilience & Détermination — définitions](#résilience--détermination--définitions)
- [Dépenser de la Détermination](#dépenser-de-la-détermination)
- [Dépenser de la Résilience — « Je ne faillirai pas ! » et « Je te renie ! »](#dépenser-de-la-résilience---je-ne-faillirai-pas---et--je-te-renie--)
- [Regagner de la Résilience et de la Détermination](#regagner-de-la-résilience-et-de-la-détermination)
- [Motivation](#motivation)
- [Personnages Sacrifiés (Destin au moment de la mort)](#personnages-sacrifiés-destin-au-moment-de-la-mort)
- [PNJ et Points de Destin / Résilience](#pnj-et-points-de-destin--résilience)

---

## Vue d'ensemble : Destin vs Résilience

> « Que ce soit à cause de votre cran, de la chance ou d'une faveur divine, vous avez quelque chose de spécial. Le Destin et la Résilience représentent la façon dont vous sortez du lot. »
> — LDB 17 l.5

Les deux systèmes fonctionnent sur le même patron mais servent des rôles différents :

| Attribut permanent | Réserve courante | Rôle |
|---|---|---|
| **Destin** | **Chance** | Chance, survie, évitement de la mort |
| **Résilience** | **Détermination** | Volonté, endurance psychologique, corruption |

Les deux attributs ont une **valeur permanente** (« Indice ») et une **réserve de Points** qui fluctue. Réduire l'Indice est définitif et réduit aussi la taille maximale de la réserve correspondante.

**Sources RAW** : `LDB 17 l.4-9`

---

## Valeurs de départ à la création

Le Tableau des Attributs (LDB 05) fixe les valeurs de départ selon la race, **avant** répartition des Points supplémentaires :

| Race | Destin de base | Résilience de base | Points supplémentaires |
|---|---|---|---|
| Humain (Reiklander) | 2 | 1 | 3 |
| Nain | 0 | 2 | 2 |
| Halfling | 0 | 2 | 3 |
| Elfe (Haut Elfe / Elfe Sylvain) | 0 | 0 | 2 |

Le **Tableau des Attributs** (`LDB 05`) n'a qu'**une seule colonne « Elfe »** (Haut Elfe et Elfe Sylvain partagent le même profil) : Destin **0**, Résilience **0**, Points supplémentaires **2**.

Les **Points supplémentaires** se répartissent librement entre Destin et Résilience au choix du joueur. Chaque point ajouté à Destin augmente Destin et Chance d'autant ; chaque point ajouté à Résilience augmente Résilience et Détermination.

**Chance de départ = valeur de Destin initiale. Détermination de départ = valeur de Résilience initiale.**

> « Votre Chance de départ est équivalente à votre Destin. Votre Détermination de départ est équivalente à votre Résilience. »
> — LDB 05 l.430

Le talent **Destinée** (liste des talents Humains Reiklanders) est attribué lors de la création ; il peut accorder un Point de Destin supplémentaire — voir la description du talent dans le Chapitre 4.

**Sources RAW** : `LDB 05 l.366-369` (tableau), `LDB 05 l.425-430` (règle de répartition et de définition des réserves initiales)

---

## Destin & Chance — définitions

> « Le Destin est directement lié à vos Points de Chance. Les Points de Chance sont dépensés pour recevoir un bonus mineur [...] et leur nombre ne va pas cesser de fluctuer au cours du jeu. Le Destin détermine le nombre de Points de Chance dont vous pouvez disposer et qui peuvent être sacrifiés lors des circonstances les plus difficiles afin d'éviter une mort certaine. »
> — LDB 17 l.17

- **Destin** : valeur permanente. Plafond de Chance. Peut être *sacrifié* définitivement pour éviter la mort (deux options, voir ci-dessous).
- **Chance** : réserve courante (0 ≤ Chance ≤ Destin). Se dépense pour des avantages mineurs. Se reconstitue au début de chaque session.

**Sources RAW** : `LDB 17 l.12-17`

---

## Dépenser de la Chance

Dépenser 1 Point de Chance offre l'une de ces trois options (au choix du joueur) :

1. **Relancer** un Test qui s'est conclu par un **échec**. (La relance ne peut se faire qu'une fois par Test — règle générale de relance, LDB 12.)
2. **Ajouter +1 DR** à un Test après qu'il a été effectué.
3. **Au début du Round**, choisir le moment où l'on agit, **sans tenir compte de l'Ordre d'Initiative**.

> « Vous pouvez dépenser des Points de Chance de votre réserve afin de faire pencher la balance de votre côté [...] Voici les trois options dont vous disposez : Relancer un Test qui s'est conclu par un échec. / Ajouter +1 DR à un Test après qu'il a été effectué. / Au début du Round, choisissez le moment où vous allez agir, sans tenir compte de l'Ordre d'Initiative. »
> — LDB 17 l.21-25

**Sources RAW** : `LDB 17 l.21-25`

**Voir aussi** : [Influencer un test — Chance, Résilience, Talents](tests.md#influencer-un-test--chance-résilience-talents) (dans `tests.md`) pour le contexte d'intégration avec les Tests et les Degrés de Réussite.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 17` (l.21-25) → `canReroll`, `RunModal`, `canActFirst`, `fateSaveOrDie`, `carryOverState`, `freeActFirst`, `rerollAvailable`, `ReservesSeuilsBand`, `fortune-mid-session`, `CampaignView`, +24 — `src/data/characteristics.json`, `src/data/flow-stakes.json`, `src/data/reglesOptionnelles.json`, `src/engine/fortune.ts`, `src/engine/ops.ts`, `src/engine/persistence.ts`, +14 fichiers

---

## Dépenser du Destin

Sacrifier **1 Point de Destin permanent** (réduction définitive de l'Indice) pour éviter la mort. Deux options au choix :

### Option A — « Meurs un autre jour »
> « au lieu de mourir, votre Personnage est mis KO, laissé pour mort, emporté par une rivière, ou, dans tous les cas, éjecté de l'action ; votre Personnage va survivre, peu importent les circonstances normalement fatales, mais il ne prendra plus part à la rencontre actuelle. »
> — LDB 17 l.31-32

Le personnage est hors-jeu pour la rencontre en cours, mais survit. Il peut se faire rouer de coups, couvrir de bleus, ou être capturé durant le processus.

### Option B — « Comment ça a pu rater ? »
> « votre Personnage parvient à éviter complètement les Dégâts grâce à un coup de chance extraordinaire, comme glisser juste au moment où le coup allait porter, ou que l'arme s'enraye mystérieusement, ou qu'une source de lumière, venue de nulle part, aveugle un adversaire ; votre Personnage peut donc poursuivre ce qu'il faisait sans subir aucune pénalité, mais il n'a aucune certitude quant à sa survie au cours des prochains Rounds. »
> — LDB 17 l.32-33

Le personnage reste dans la rencontre mais demeure en danger — il peut avoir à dépenser d'autres Points de Destin dans les Rounds suivants.

> « La première option vous place hors-jeu, mais vous permet de vous battre à nouveau à un moment ultérieur [...] La deuxième option permet de poursuivre le combat aux côtés de vos compagnons, mais vous laisse en plein danger [...] C'est à vous de décider du choix à prendre. »
> — LDB 17 l.35-36

Le MJ décrit la façon dont le personnage survit après la dépense.

**Sources RAW** : `LDB 17 l.29-37`

**Voir aussi** : [Personnages Sacrifiés](#personnages-sacrifiés-destin-au-moment-de-la-mort) ci-dessous (usage du Destin face à la mort au Tableau des Critiques).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 17` (l.29-37) → `canReroll`, `restoreFortune`, `RunModal`, `canActFirst`, `fateSaveOrDie`, `carryOverState`, `freeActFirst`, `rerollAvailable`, `ReservesSeuilsBand`, `fortune-mid-session`, +30 — `src/data/characteristics.json`, `src/data/flow-stakes.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs-scenes/effets.ts`, `src/engine/fortune.ts`, `src/engine/ops.ts`, +18 fichiers

---

## Regagner du Destin et de la Chance

### Chance

> « Vous regagnez tous vos Points de Chance au début de chaque session de jeu, jusqu'à un maximum équivalent à votre Destin actuel. De plus, certaines rencontres dans le jeu peuvent vous permettre de récupérer (ou de perdre !) des Points de Chance. »
> — LDB 17 l.41

La restauration se fait jusqu'à la valeur courante de Destin (pas la valeur de départ — si Destin a été sacrifié, le plafond est réduit).

**Sources RAW** : `LDB 17 l.41`

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 17` (l.41) → `restoreFortune`, `fateSaveOrDie`, `carryOverState`, `fortune-mid-session`, `RollFlowLens`, `je-ne-faillirai-pas`, `je-te-renie`, `determination`, `restoreFortuneSchema`, `recover-empetre`, +12 — `src/data/characteristics.json`, `src/data/flow-stakes.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs-scenes/effets.ts`, `src/engine/fortune.ts`, `src/engine/ops.ts`, +8 fichiers

### Option : Longues Séances de Jeu

> « Si vos Joueurs sont plutôt du second type [marathons d'une journée entière], permettez la récupération de Points de Chance à des moments choisis de votre narration, à peu près une fois par heure. »
> — LDB 17 l.47

Règle optionnelle du MJ : restauration intermédiaire au cours d'une longue session, sans attendre le début de la prochaine.

**Sources RAW** : `LDB 17 l.46-47`

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 17` (l.46-47) → `restoreFortune`, `fateSaveOrDie`, `EnemyAction`, `fortune-mid-session`, `RollFlowLens`, `je-ne-faillirai-pas`, `je-te-renie`, `determination`, `restoreFortuneSchema`, `recover-empetre`, +9 — `src/data/characteristics.json`, `src/data/flow-stakes.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs-scenes/effets.ts`, `src/engine/fortune.ts`, `src/engine/ops.ts`, +7 fichiers

### Destin

> « Votre MJ peut vous accorder un Point de Destin pour un acte de bravoure ou héroïque particulièrement impressionnant. En général, cela ne se produit qu'à la toute fin d'une aventure importante, alors assurez-vous de les dépenser judicieusement car ils se renouvellent rarement. »
> — LDB 17 l.43

Les Points de Destin se renouvellent très rarement — uniquement sur décision du MJ à la fin d'une aventure marquante. Ils ne se régénèrent **pas** automatiquement entre sessions (contrairement aux Points de Chance).

**Sources RAW** : `LDB 17 l.43`

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 17` (l.43) → `restoreFortune`, `fateSaveOrDie`, `fortune-mid-session`, `RollFlowLens`, `je-ne-faillirai-pas`, `je-te-renie`, `determination`, `restoreFortuneSchema`, `recover-empetre`, `recover-en-flammes`, +11 — `src/data/characteristics.json`, `src/data/flow-stakes.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs-scenes/effets.ts`, `src/engine/fortune.ts`, `src/engine/ops.ts`, +7 fichiers

---

## Résilience & Détermination — définitions

> « Alors que les Points de Destin représentent votre destinée, peut-être tracée par une divinité mystérieuse, la Résilience représente votre volonté et votre détermination à endurer les événements et à vous dépasser quels que soient les obstacles auxquels vous faites face. »
> — LDB 17 l.51

- **Résilience** : valeur permanente. Plafond de Détermination. Peut être *sacrifiée* pour ignorer la Corruption ou forcer un succès.
- **Détermination** : réserve courante (0 ≤ Détermination ≤ Résilience). Se dépense pour des avantages psychologiques et physiques immédiats. Se reconstitue en agissant selon la Motivation.

**Sources RAW** : `LDB 17 l.50-53`

---

## Dépenser de la Détermination

Dépenser 1 Point de Détermination offre l'une de ces trois options :

1. Demeurer **immunisé à Psychologie** jusqu'à la fin du **prochain Round**.
2. **Ignorer tous les modificateurs** dus à une **Blessure critique** jusqu'au **début du prochain Round**.
3. **Retirer un État**. Si l'État retiré est *À Terre*, regagner **1 Point de Blessure** au moment de se relever.

> « Vous pouvez dépenser un Point de Détermination pour puiser dans vos réserves : affronter un Ogre terrifiant sans trembler ou ignorer les effets d'un coup extrêmement puissant. Voici les choix dont vous disposez : / Demeurer immunisé à Psychologie jusqu'à la fin du prochain Round. / Ignorer tous les modificateurs dus à une Blessure critique jusqu'au début du prochain Round. / Retirez un État : si vous retirez l'État À Terre, regagnez 1 Point de Blessure lorsque vous vous mettez debout. »
> — LDB 17 l.57-61

**Sources RAW** : `LDB 17 l.56-61`

**Voir aussi** : [`etats.md`](etats.md) pour la liste des États retirables.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 17` (l.56-61) → `ResilienceButton`, `RenounceModal`, `DeterminationButton`, `CritLocationPicker`, `hasMeaningfulOption`, `restoreFortune`, `sourceSuspended`, `CorruptionModal`, `ForcedRollPicker`, `suspendSource`, +97 — `src/data/characteristics.json`, `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/etats.ts`, `src/engine/combat.ts`, +51 fichiers

---

## Dépenser de la Résilience — « Je ne faillirai pas ! » et « Je te renie ! »

Sacrifier **1 Point de Résilience permanent** (réduction définitive de l'Indice) offre l'une de ces deux options :

### Option A — « Je te renie ! » (anti-Corruption)

> « Vous pouvez choisir de ne pas développer la mutation obtenue. Et comme vous ne mutez pas, vous ne perdez aucun Point de Corruption. »
> — LDB 17 l.67

Refuse l'acquisition d'une mutation (et annule la perte de Points de Corruption associée). Voir Corruption (LDB 19) pour le contexte complet.

### Option B — « Je ne faillirai pas ! » (forcer le succès)

> « au lieu de lancer les dés pour un Test, vous choisissez le résultat, ce qui vous permet de réussir, même dans les pires conditions. Si vous infligez un Coup Critique, vous pouvez choisir la Localisation atteinte, plutôt que de la laisser au hasard. S'il s'agit d'un Test opposé, vous l'emportez avec au moins DR +1. Vous pouvez même faire ce choix après un Test qui a échoué. »
> — LDB 17 l.68

Règles précises :
- On **choisit le résultat** du dé (pas de lancer, ou on ignore un lancer déjà effectué).
- Si le Test produit un Coup Critique : **choix libre de la Localisation** (dérogation à la règle du dé inversé).
- Si Test opposé : victoire garantie avec **au moins DR +1** sur l'adversaire.
- Peut être activé **après un Test raté** (rétroactivement).

**Exemple officiel (LDB 17 l.70)** : Salundra échoue à un Test opposé de 7 DR face à un chef bandit avec 10 Avantages. Elle dépense 1 Point de Résilience → le Test devient un succès avec DR +1, résultat 11 (Coup Critique). Elle choisit la Localisation. Le chef perd ses 10 Avantages.

> « Garder de la Résilience afin de contrer l'influence du Chaos est une bonne chose, mais cela ne retire en aucun cas vos Points de Corruption [...] »
> — LDB 17 l.72 (note complémentaire sur l'option « Je ne faillirai pas ! »)

**Sources RAW** : `LDB 17 l.64-72`

**Voir aussi** : [Influencer un test — Chance, Résilience, Talents](tests.md#influencer-un-test--chance-résilience-talents) (dans `tests.md`) — c'est là que le mécanisme est décrit dans son contexte d'intégration au Test ; la présente section n'en donne que la définition.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 17` (l.64-72) → `ResilienceButton`, `RenounceModal`, `DeterminationButton`, `CritLocationPicker`, `hasMeaningfulOption`, `sourceSuspended`, `CorruptionModal`, `ForcedRollPicker`, `regainDetermination`, `suspendSource`, +98 — `src/data/characteristics.json`, `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs-scenes/effets.ts`, `src/data/schemas/defs/etats.ts`, +52 fichiers

---

## Regagner de la Résilience et de la Détermination

### Détermination

> « La Détermination est récupérée chaque fois que vous agissez en fonction de votre Motivation [...] Au cours de la partie, chaque fois que vous pensez avoir agi en conséquence, vous pouvez demander à votre MJ si vous pouvez regagner un ou plusieurs Points de Détermination. »
> — LDB 17 l.81

La fréquence et la quantité sont à la discrétion du MJ selon le comportement en jeu.

**Exemple officiel** : Griselda (Motivation « Sigmar ») se rend dans le temple local, prie et fait une offrande → le MJ lui accorde 1 Point de Détermination, mais précise qu'il faudra se rendre dans un temple *différent* pour en regagner un autre de la même façon.

**Sources RAW** : `LDB 17 l.81-83`

### Résilience

> « Le MJ peut accorder un Point de Résilience permanent pour une action d'une grande importance effectuée en accord avec votre Motivation qui régénérera votre âme, mais de tels événements doivent rester rares. »
> — LDB 17 l.85

Encore plus rare que l'octroi de Points de Destin. Uniquement pour des actions de grande portée narrative liées à la Motivation.

**Exemple officiel** : Griselda finance la construction d'un nouveau temple en l'honneur de Sigmar dans son village natal → le MJ lui accorde 1 Point de Résilience permanent.

**Sources RAW** : `LDB 17 l.85-87`

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 17` (l.81-83, l.85-87) → `regainDetermination`, `fortune-mid-session`, `je-ne-faillirai-pas`, `je-te-renie`, `determination`, `recover-empetre`, `recover-en-flammes`, `sessionEndSchema`, `FLOWS` — `src/data/characteristics.json`, `src/data/flow-stakes.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs-scenes/effets.ts`, `src/engine/session.ts`, `src/state/rollFlowSpecs.ts`

---

## Motivation

> « Votre Résilience s'accompagne aussi d'une Motivation. Votre Motivation peut être définie par un simple mot ou une phrase décrivant ce qui fait avancer votre Personnage. »
> — LDB 05 l.422

La Motivation est choisie à la création (étape 3, « Choisir la Motivation »). Elle peut être affinée jusqu'à l'étape 8 (« Donner vie à votre Personnage »). Elle a deux rôles mécaniques :

1. **Conditions de récupération de Détermination** : agir en accord avec la Motivation permet de regagner des Points de Détermination.
2. **Conditions de récupération de Résilience** : des actes majeurs conformes à la Motivation peuvent valoir un Point de Résilience permanent (décision du MJ).

**Exemples officiels** (LDB 05 l.436-442) :
- Gustavus, Érudit : « Amateur de sensations fortes » — regagne de la Détermination en cherchant le danger.
- Clotilda, Chevalier : « Protéger les faibles » — regagne de la Détermination en sauvant autrui.
- Ebba, Sorcière : « Rebelle » — regagne de la Détermination en enfreignant les règles de ses supérieurs.

Autres exemples listés : Perfectionniste, Protectrice, Homme de paix, Martyr pénitent, Esprit brillant.

**Sources RAW** : `LDB 05 l.421-445`

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 5` (l.421-445) → `force`, `endurance`, `initiative`, `agilite`, `dexterite`, `intelligence`, `force-mentale`, `sociabilite`, `blessure`, `destin`, +5 — `src/data/characteristics.json`, `src/ui/creator/CharacterCreator.tsx`

---

## Personnages Sacrifiés (Destin au moment de la mort)

Le Chapitre 18 (Traumatisme) précise l'usage du Destin face à la mort lors des Critiques :

> « Enfin, certains résultats du Tableau des Critiques peuvent mener à la mort. Si c'est ce qui est sur le point de se produire, il est temps de dépenser un Point de Destin s'il vous en reste (voir Destin à la page 170). »
> — LDB 18 l.38

Cette mention renvoie directement aux deux options « Meurs un autre jour » et « Comment ça a pu rater ? » décrites dans le Chapitre 17. Il n'y a pas d'option supplémentaire au Chapitre 18 : c'est le même mécanisme, déclenché par un résultat mortel sur le Tableau des Critiques.

La mort survient sans dépense de Destin dans ces cas :
- État *Inconscient* + 0 Point de Blessure + total de Blessures critiques > Bonus d'Endurance → mort à la fin du Round (sauf soin d'une Blessure critique).
- Résultat 00 sur les Tableaux de Critiques (Décapitation, Démembrement brutal, Éventré, Bassin fracassé) → mort immédiate.

**Sources RAW** : `LDB 18 l.40`, `LDB 18 l.42-43`

**Voir aussi** : [`traumatisme.md`](traumatisme.md) pour le fonctionnement complet des Blessures critiques et de la mort.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 18` (l.38, l.40, l.42-43) → `criticals-ldb-tete`, `blessure-spectaculaire`, `coupure-mineure`, `coup-a-l-il`, `frappe-a-l-oreille`, `coup-percutant`, `il-au-beurre-noir`, `crit-severity`, `critWoundLocation`, `crit-row-test`, +26 — `src/data/combat-stakes.json`, `src/data/criticals.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/criticals.ts`, `src/data/traumas.json`, +7 fichiers

---

## PNJ et Points de Destin / Résilience

> « Seules certaines rares personnes possèdent des Points de Destin et de Résilience. Dans la pratique, ce sont les Personnages Joueurs. Vous pouvez décider d'attribuer des Points de Destin et de Résilience à certains PNJ importants, comme ce nécromant qui est une némésis des PJ, ou une sommité locale, ou un chef de culte récurrent. »
> — LDB 17 l.9

Les PNJ ordinaires n'ont pas de Points de Destin ni de Résilience. C'est une prérogative des PJ (et, sur décision du MJ, des PNJ narrativement importants).

**Sources RAW** : `LDB 17 l.9`

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 17` (l.9) → `ReservesSeuilsBand`, `fate-save-choice`, `Combatant` — `src/data/flow-stakes.json`, `src/engine/types.ts`, `src/ui/EtatPanel.tsx`
