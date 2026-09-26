# Atlas RAW — Tests & Success Levels (SL)

> Référentiel **autosuffisant** des règles du cœur **5e** (RAW), consolidé sur les livres autorisés, à usage
> d'agent (répondre + auditer le code sans rouvrir les livres). Chaque règle cite `LIVRE NN l.X-Y`
> (last-recours = la source). Abréviations : [`sources.md`](../sources.md). Index : [`00-index.md`](00-index.md).
>
> ⚠️ Agent-généré + vérifié (passe adversariale). Le champ **Implémente** est DÉRIVÉ du code
> (`npm run raw:implemente`), jamais écrit à la main.

## Sommaire

- [MAKING A TEST — déclenchement et procédure du Test](#making-a-test--déclenchement-et-procédure-du-test)
- [ROLL DICE — le d100 et le calcul du Success Level (SL)](#roll-dice--le-d100-et-le-calcul-du-success-level-sl)
- [AUTOMATIC SUCCESS AND FAILURE — 01-05 et 96-100](#automatic-success-and-failure--01-05-et-96-100)
- [CRITICALS AND FUMBLES — le double](#criticals-and-fumbles--le-double)
- [ADVANTAGE AND DISADVANTAGE — inversion des chiffres et cumul](#advantage-and-disadvantage--inversion-des-chiffres-et-cumul)
- [DARKNESS AND TESTS — l'obscurité et les Tests fondés sur la vue](#darkness-and-tests--lobscurité-et-les-tests-fondés-sur-la-vue)
- [SL Modifiers — origine, moment d'application et marge du GM](#sl-modifiers--origine-moment-dapplication-et-marge-du-gm)
- [DIFFICULTY AND CHARACTER MODIFIERS — DIFFICULTY TABLE](#difficulty-and-character-modifiers--difficulty-table)
- [OUTCOMES TABLE — lecture du SL final](#outcomes-table--lecture-du-sl-final)
- [OPPOSED TESTS — les Tests opposés](#opposed-tests--les-tests-opposés)
- [Getting Help — se faire aider sur un Test](#getting-help--se-faire-aider-sur-un-test)
- [EXTENDED TESTS — les Tests étendus](#extended-tests--les-tests-étendus)
- [Fortune — Spend a Fortune Point to: et Replenishing Fortune](#fortune--spend-a-fortune-point-to-et-replenishing-fortune)
- [Fate — nature, rareté et Replenishing Fate](#fate--nature-rareté-et-replenishing-fate)
- [Cheating Death — How Did That Miss? et Not Today!](#cheating-death--how-did-that-miss-et-not-today)
- [Achieving the Impossible — I Will Not Fail!](#achieving-the-impossible--i-will-not-fail)

---

## MAKING A TEST — déclenchement et procédure du Test

Le **Test** est le cœur des règles de WFRP 5e : c'est lui qu'on appelle pour trancher « est-ce que ça marche ? ». Mais le livre pose d'abord la règle inverse — **tout ne se teste pas**. Cette fiche porte le **déclenchement** (quand un Test est appelé, quand il ne l'est pas) et la première étape de la planche, **DESCRIBE ACTION**, qui fixe la valeur testée ; les étapes 2 à 4 de la planche — **ROLL DICE**, **DIFFICULTY AND CHARACTER MODIFIERS**, **SUMMARY & OUTCOME** — ont leurs porteurs propres, listés au **Voir aussi**.

### Quand un Test est requis (déclenchement)

Un Test n'est appelé que dans deux cas, exclusivement :

- l'**issue de l'action est incertaine** (*uncertain*) ;
- ou l'action est **opposée par un autre personnage** (*opposed by another character*).

Hors de ces deux cas, il n'y a **aucun Test** : les actions de routine (*routine actions*) et tout ce dont l'issue est évidente (*anything with an obvious outcome*) **réussissent simplement** (`CRB 023 l.5`). L'absence de Test n'est donc pas un raccourci de table, c'est la règle par défaut.

Le chapitre **RULES** cadre la finalité des règles — fournir « a fair way to decide what happens when the outcome is uncertain » (`CRB 022 l.9`) — puis énonce que les jeux de rôle fonctionnent au mieux avec un **minimum d'interruption du flux narratif**, et liste à ce titre trois principes à garder en tête (`CRB 022 l.11`) :

- **To roll or not to roll** — il n'est **pas nécessaire de lancer les dés pour chaque action** ; lorsque le succès ou l'échec **aurait peu d'impact sur la progression de l'histoire**, la GM peut simplement décider de la suite, sans Test (`CRB 022 l.13`). C'est un second filtre, de portée narrative, qui s'ajoute au filtre mécanique de `CRB 023 l.5`.
- **Know what you're rolling** — **on sait ce pour quoi on lance avant de lancer**. Comprendre les règles permet aux joueurs de **juger les risques avant d'agir** ; avant de jeter les dés, tous les participants doivent savoir ce qui est joué et quelles sont les chances de succès ou d'échec (`CRB 022 l.14`). C'est ce principe qui donne sa raison d'être à la deuxième puce de **DESCRIBE ACTION** ci-dessous.
- **Don't get bogged down** — les règles fournissent un cadre mais ne peuvent anticiper toute situation ; pour une situation que les règles ne couvrent pas, la GM est explicitement autorisée à les **modifier** comme bon lui semble pour aboutir à une solution acceptée de tous, l'important étant de garder le jeu fluide (`CRB 022 l.16`).

Le chapitre **The Gamemaster** reprend le déclenchement côté arbitre et en fait une compétence de la GM à part entière, sous l'intitulé **You Decide When the Rules Are Needed** (`CRB 075 l.24`) :

- la plupart du temps, ce que les joueurs décident de faire **arrive simplement, sans aucun jet** ; c'est particulièrement vrai des conversations. Un témoin interrogé dira ce qu'il sait dès lors que le joueur s'est adressé à la bonne personne et a posé les bonnes questions : un Test de *Charm* (ou d'*Intimidate*, selon le style de l'interrogatoire) n'est requis **que si le témoin a une raison de résister** (`CRB 075 l.26`) — application directe de la clause *uncertain or opposed*.
- « A large part of being the GM is deciding when to bring in the rules to decide the outcome of an action, and when to just let the story continue and keep the game flowing. » (`CRB 075 l.28`)

S'y ajoute une contrainte de conception du jet, sous **FAILING FORWARD** (`CRB 075 l.30`) : l'erreur classique est d'appeler un Test dont l'échec **arrêterait net l'aventure**. Si le groupe doit franchir une porte pour trouver le repaire du culte, on ne fait **pas** lancer pour la crocheter sans avoir un plan pour l'échec ; si l'indice vital est caché dans une bibliothèque poussiéreuse, on n'appelle un Test que pour déterminer **à quelle vitesse** il est trouvé, **pas s'il l'est** (`CRB 075 l.32`). Et à chaque Test appelé, la GM doit avoir un plan pour le succès **comme** pour l'échec, l'échec devant faire avancer l'histoire au prix de conséquences négatives (`CRB 075 l.34`).

### La planche MAKING A TEST — quatre étapes, dans l'ordre de la page

La planche **MAKING A TEST** (`CRB 024 l.3`) porte **quatre étapes, dans l'ordre de la page** : **DESCRIBE ACTION** (`CRB 024 l.5`), **ROLL DICE** (`CRB 024 l.11`), **DIFFICULTY AND CHARACTER MODIFIERS** (`CRB 024 l.52`) et **SUMMARY & OUTCOME** (`CRB 024 l.85`). La source `.md` ne porte pas les numéros imprimés sur la page (médaillons illustrés, non transcrits — question de format ouverte sur #1739) : cette fiche suit l'ordre de la page et n'invente aucune numérotation.

La première étape, **DESCRIBE ACTION**, tient en **trois puces** — ce sont les trois puces de CETTE étape, pas des étapes distinctes (`CRB 024 l.7-9`) :

1. **Le joueur décrit** ce que son personnage tente de faire.
2. **La GM détermine si un Test est requis.** S'il l'est, elle **explique tout facteur affectant l'action qui serait évident pour le personnage** — c'est le moment où l'information connue du personnage est rendue au joueur, avant l'engagement.
3. **Si le joueur souhaite toujours poursuivre**, la GM **décide quelle Skill ou quelle Characteristic est testée**.

Texte verbatim des trois puces :

> « - Player describes what their Character is trying to do.
> - GM determines if a Test is required. If it is, GM explains any factors affecting the action that would be obvious to the Character.
> - If the player still wishes to proceed, the GM decides what Skill or Characteristic to Test. » — `CRB 024 l.7-9`

Deux conséquences structurelles de cet ordre :

- le joueur **peut renoncer** après la deuxième puce : la formule *If the player still wishes to proceed* fait de la poursuite une décision prise **en connaissance des facteurs évidents**, pas un enchaînement automatique (`CRB 024 l.9`) ;
- la **valeur testée n'est pas choisie par le joueur** : elle est déterminée par la GM à la troisième puce, et seulement une fois l'action décrite (`CRB 024 l.9`).

Cette même procédure est **rappelée à l'identique** partout où le livre décrit un engagement du joueur :

- en combat, l'**Action** d'un tour — décrire, la GM décide si un Test est requis, narration du résultat (`CRB 034 l.23-25`, aire `combat`, fiche à extraire) ;
- en interaction sociale, le joueur qui ne joue pas la scène explique tout de même ce qu'il cherche avant que la GM décide du Test (`CRB 029 l.137`, aire `enquete`, fiche à extraire).

**Ce qui suit immédiatement DESCRIBE ACTION, à la source, c'est ROLL DICE** (`CRB 024 l.11`) : le d100 comparé à la valeur testée, puis le Success Level si l'ampleur du résultat importe. Ce jet et ce calcul ne sont pas retranscrits ici (porteur : topic ROLL DICE).

La ligne **CHECK YOUR SKILL OR CHARACTERISTIC** (`CRB 024 l.16`) vient **après** les puces de ROLL DICE et n'est **pas une étape** : c'est la légende d'une **figure d'appui** au calcul du Success Level, placée immédiatement à la suite du renvoi *as shown below* de la puce de SL. **Constat de TRANSCRIPTION** : `024 - Making a Test.md` n'en porte que l'intitulé — le texte de la figure n'est pas transcrit dans la source (défaut de transcription ouvert sur #1820). La figure n'est donc pas reprise ici.

L'exemple canonique du livre déroule exactement cet ordre : la joueuse décrit son personnage qui rase les rues calmes, capuche rabattue, en essayant de ne pas être vu ; **c'est ensuite** que la GM tranche qu'il s'agit d'un **Average (+2 SL) Stealth (Urban)** Test, et seulement alors qu'on lance (`CRB 024 l.116`). L'exemple de combat suit le même ordre : la joueuse déclare que Molli monte à la galerie et bascule une table par-dessus la rambarde, **puis** la GM fixe un **Average (+2 SL) Athletics** Test (`CRB 034 l.29`).

La Difficulty que la GM fixe à la troisième puce, et les **modificateurs du personnage** (Talents, équipement, Spells et autres effets), se combinent en un modificateur de SL final appliqué au résultat — c'est la troisième étape de la planche, **DIFFICULTY AND CHARACTER MODIFIERS** (`CRB 024 l.52-59`), porteur dédié.

### CHARACTERISTIC TESTS — tester une Characteristic plutôt qu'une Skill

Si l'action **n'est couverte par aucune Skill**, on fait un **Characteristic Test** au lieu d'un **Skill Test**. La GM détermine la **Characteristic la plus appropriée** à ce qui est tenté, et on la teste **comme un Test normal** — aucune mécanique distincte, aucun malus ni bonus propre au fait de tester une Characteristic (`CRB 024 l.81-83`).

> « If an action isn't covered by a Skill, you can make a Characteristic Test instead of a Skill Test. The GM determines the most appropriate Characteristic for what you are attempting, and you Test it as normal. » — `CRB 024 l.83`

### Qui peut tester quoi : la borne d'Advance

Le choix de la valeur testée à la troisième puce est borné par la **nature de la Skill** visée : une Advanced Skill ne se teste qu'avec au moins un Advance — typologie Basic / Advanced / Grouped Skills portée par l'aire `competences` (fiche à extraire), `CRB 020 l.5-33`.

Cette même borne d'Advance vaut pour l'**assistance** — un personnage ne peut pas aider à un Test d'Advanced Skill s'il n'a pas au moins un Advance dans la Skill testée (`CRB 024 l.142`) : cette clause propre à l'aidant est portée par le topic Getting Help.

### REPEATING TESTS — refaire un Test échoué

Un échec ne se relance pas à volonté. Pour qu'un personnage **répète un Test échoué**, il faut **d'abord** que l'une des deux conditions suivantes soit remplie (`CRB 024 l.29-31`) :

- il a **traité les conséquences de son échec** (*dealt with the consequences of their failure*) ;
- **ou** les **circonstances entourant le Test ont substantiellement changé** (*must have substantially changed*).

> « For a Character to repeat a failed Test, they must first have dealt with the consequences of their failure, or the circumstances surrounding the Test must have substantially changed. » — `CRB 024 l.31`

À distinguer de deux mécaniques de **Fortune/Fate**, qui ne sont pas des répétitions au sens de **REPEATING TESTS** : dépenser un **Fortune Point** permet de **relancer un Test en gardant le nouveau résultat**, et d'en dépenser un autre pour relancer encore (`CRB 025 l.10`) ; dépenser un **Fate Point** (*I Will Not Fail!*) permet, **au lieu de lancer**, de **choisir le résultat** (`CRB 025 l.32`) — détail aux topics [Fortune — Spend a Fortune Point to: et Replenishing Fortune](#fortune--spend-a-fortune-point-to-et-replenishing-fortune) et [Achieving the Impossible — I Will Not Fail!](#achieving-the-impossible--i-will-not-fail).

**Sources RAW** :
- `CRB 023 l.5` — définition du Test et **condition de déclenchement** : les actions de routine et à issue évidente réussissent sans Test ; on teste quand l'issue est *uncertain* ou *opposed by another character*
- `CRB 022 l.9` — finalité des règles : trancher équitablement ce qui arrive **quand l'issue est incertaine**
- `CRB 022 l.11` — cadre général : le jeu fonctionne au mieux avec **un minimum d'interruption du flux narratif** ; introduit les trois principes suivants
- `CRB 022 l.13` — *To roll or not to roll* : pas de dé pour chaque action ; si succès/échec pèse peu sur la progression de l'histoire, la GM décide sans Test
- `CRB 022 l.14` — *Know what you're rolling* : comprendre les règles permet de juger les risques avant d'agir ; avant le lancer, chacun sait ce qui est joué et quelles sont les chances de réussite/d'échec
- `CRB 022 l.16` — *Don't get bogged down* : les règles ne peuvent anticiper toute situation ; non couverte → la GM les modifie pour une solution acceptée de tous
- `CRB 075 l.24`, `l.26` — **You Decide When the Rules Are Needed** : l'essentiel du temps l'action aboutit sans dé ; un Test de *Charm*/*Intimidate* n'est requis que si le témoin **a une raison de résister**
- `CRB 075 l.28` — décider quand faire intervenir les règles et quand laisser courir l'histoire est une part majeure du rôle de GM
- `CRB 075 l.30`, `l.32` — **FAILING FORWARD** : ne pas appeler un Test dont l'échec arrête l'aventure ; on teste **à quelle vitesse** l'indice vital est trouvé, jamais **s'il** l'est
- `CRB 075 l.34` — tout Test appelé exige un plan pour le succès ET pour l'échec ; l'échec fait avancer l'histoire, avec des conséquences négatives
- `CRB 024 l.3` — titre de la planche **MAKING A TEST** ; ses quatre étapes, dans l'ordre de la page : `l.5` **DESCRIBE ACTION**, `l.11` **ROLL DICE**, `l.52` **DIFFICULTY AND CHARACTER MODIFIERS**, `l.85` **SUMMARY & OUTCOME**
- `CRB 024 l.7-9` — les **trois puces de DESCRIBE ACTION** : description du joueur ; la GM détermine si un Test est requis et expose les facteurs évidents pour le personnage ; si le joueur poursuit, la GM décide de la Skill ou de la Characteristic à tester
- `CRB 034 l.23-25`, `CRB 034 l.29`, `CRB 029 l.137` — la même procédure en combat et en interaction sociale — aires `combat`, `enquete`
- `CRB 024 l.11` — **ROLL DICE** : deuxième étape de la planche, qui suit IMMÉDIATEMENT les puces de DESCRIBE ACTION (jet et calcul du SL au topic ROLL DICE)
- `CRB 024 l.16` — **CHECK YOUR SKILL OR CHARACTERISTIC** : légende d'une figure d'appui au calcul de SL, placée APRÈS les puces de ROLL DICE — le texte de la figure n'est PAS transcrit dans la source (défaut de transcription, #1820)
- `CRB 024 l.52-59` — **DIFFICULTY AND CHARACTER MODIFIERS** : troisième étape de la planche ; la Difficulty fixée par la GM et les modificateurs du personnage se combinent en un modificateur de SL final
- `CRB 024 l.29-31` — **REPEATING TESTS** : conséquences de l'échec traitées, ou circonstances substantiellement changées
- `CRB 025 l.10` — *Spend a Fortune Point to* : relancer un Test en gardant le nouveau résultat (relance ≠ répétition d'un Test échoué)
- `CRB 025 l.32` — *I Will Not Fail!* : au lieu de lancer, choisir le résultat (Fate Point)
- `CRB 024 l.81-83` — **CHARACTERISTIC TESTS** : action non couverte par une Skill → la GM détermine la Characteristic la plus appropriée, testée *as normal*
- `CRB 024 l.116` — *Typical Test* : exemple déroulant l'ordre description → arbitrage de la GM (Skill + Difficulty) → lancer
- `CRB 024 l.142` — *Getting Help* : on ne peut assister un Test d'Advanced Skill sans au moins un Advance dans la Skill testée (topic porteur : Getting Help)
- `CRB 020 l.5-33` — les **trois types de Skill** (Basic, Advanced, Grouped) et la borne d'Advance par Specialisation — aire `competences` (fiche à extraire)

> « Routine actions and anything with an obvious outcome simply succeed, without the need for a Test. When the outcome of an action is uncertain or opposed by another character, you make a Test. » — `CRB 023 l.5`

> « **To roll or not to roll.** You don't need to roll dice to determine the outcome of every action. If success or failure would have little impact on the progression of the story, the GM can simply decide what happens next. » — `CRB 022 l.13`

> « Before rolling dice, make sure that everyone involved knows what is being rolled for and the chances of success or failure. » — `CRB 022 l.14`

> « A large part of being the GM is deciding when to bring in the rules to decide the outcome of an action, and when to just let the story continue and keep the game flowing. » — `CRB 075 l.28`

> « Every time you call for a Test, have a plan for both success and failure. Failure should move the story on, but with some negative consequences. » — `CRB 075 l.34`

> « Describe what you want to do. The GM decides whether a Test is required. The results are then narrated by you and the GM, ending your Action. » — `CRB 034 l.25`

**Voir aussi** :

- [ROLL DICE — le d100 et le calcul du Success Level (SL)](#roll-dice--le-d100-et-le-calcul-du-success-level-sl) — **ROLL DICE**, **MODIFIERS AND 0 SL**, **SUMMARY & OUTCOME**
- [DIFFICULTY AND CHARACTER MODIFIERS — DIFFICULTY TABLE](#difficulty-and-character-modifiers--difficulty-table)
- [SL Modifiers — origine, moment d'application et marge du GM](#sl-modifiers--origine-moment-dapplication-et-marge-du-gm)
- [OUTCOMES TABLE — lecture du SL final](#outcomes-table--lecture-du-sl-final)
- [AUTOMATIC SUCCESS AND FAILURE — 01-05 et 96-100](#automatic-success-and-failure--01-05-et-96-100)
- [CRITICALS AND FUMBLES — le double](#criticals-and-fumbles--le-double)
- [ADVANTAGE AND DISADVANTAGE — inversion des chiffres et cumul](#advantage-and-disadvantage--inversion-des-chiffres-et-cumul)
- [DARKNESS AND TESTS — l'obscurité et les Tests fondés sur la vue](#darkness-and-tests--lobscurité-et-les-tests-fondés-sur-la-vue)
- [OPPOSED TESTS — les Tests opposés](#opposed-tests--les-tests-opposés)
- [Getting Help — se faire aider sur un Test](#getting-help--se-faire-aider-sur-un-test)
- [EXTENDED TESTS — les Tests étendus](#extended-tests--les-tests-étendus)
- [Fortune — Spend a Fortune Point to: et Replenishing Fortune](#fortune--spend-a-fortune-point-to-et-replenishing-fortune)
- aire `competences` (fiche à extraire) — Basic / Advanced / Grouped Skills, Specialisations
- aire `combat` (fiche à extraire) — **Action** d'un tour de combat, `CRB 034`

**Implémente :** (non implémenté)
- dette : #1873

---

## ROLL DICE — le d100 et le calcul du Success Level (SL)

> Le **déclenchement** d'un Test (quand on lance, quand on ne lance pas) et la première étape de la planche, **DESCRIBE ACTION** et ses trois puces (`CRB 022 l.13`, `CRB 023 l.5`, `CRB 024 l.7-9`), vivent au topic [MAKING A TEST — déclenchement et procédure du Test](#making-a-test--déclenchement-et-procédure-du-test) : ce topic commence à la deuxième étape, **ROLL DICE** (`CRB 024 l.13`).

### **THROWING BONES** — les dés du jeu (`CRB 004 l.25-35`)

Le chapitre d'introduction pose la lecture des dés avant toute règle de Test :

> « Games of **Warhammer Fantasy Roleplay** use ten-sided dice marked from 0–9, where a roll of 0 counts as a result of 10. These are called d10s, and the number of dice to roll is shown as 1d10, 2d10, 3d10, and so on. » — `CRB 004 l.27`

> « When rolling multiple dice, add the results together. For example, a roll of 0 and 3 on 2d10 gives a result of 13 (10 + 3). » — `CRB 004 l.29`

> « Sometimes, a die roll will be modified by adding or subtracting a number. For example, 1d10+4 means roll one d10 and add 4, while 2d10-3 means roll two d10s, total the results, then subtract 3. » — `CRB 004 l.31`

> « The rules also use 1d100, a roll from 1–100 made with two d10s. Designate one die as the tens die and the other as the units die, then read the results as a two-digit number. A 1 on the tens die and 4 on the units die gives 14; a 4 and 2 gives 42. If both dice roll 0, the result is 100. » — `CRB 004 l.33`

> « In general, low rolls give successful results. So, whether you're rolling a d10 or a d100, you want to get as close to 01 as possible. » — `CRB 004 l.35`

### `ROLL DICE` : un d100 sous la valeur testée

Le joueur lance les dés — **un d100** — en cherchant à obtenir un résultat **égal ou inférieur** à son `Skill` ; s'il y parvient, il a réussi (`CRB 024 l.13`).

Le seuil du jet est la valeur du `Skill` testé. Ce seuil peut aussi être une `Characteristic` : le calcul du `SL` est formulé pour les deux indifféremment — « the Skill or Characteristic being tested » (`CRB 024 l.14`) — et l'entrée `CHARACTERISTIC TESTS` (`CRB 024 l.83`), qui dit dans quel cas et comment on teste une `Characteristic` plutôt qu'une `Skill`, se joue à la troisième puce de **DESCRIBE ACTION** : elle est transcrite verbatim au topic [MAKING A TEST — déclenchement et procédure du Test](#making-a-test--déclenchement-et-procédure-du-test), seul porteur canonique, et n'est pas répétée ici.

### Le `Success Level` (`SL`) : différence des premiers chiffres

Lorsqu'il importe de savoir **à quel point** on a bien ou mal fait, on utilise le `Success Level` (`SL`) du Test. La règle de calcul est littérale (`CRB 024 l.14`) :

> **`SL` = premier chiffre du `Skill`/`Characteristic` testé(e) − premier chiffre du jet**

c'est-à-dire : *soustraire le premier chiffre de votre jet du premier chiffre du `Skill` ou de la `Characteristic` testé(e)* pour voir combien de `SL` vous avez générés — le « premier chiffre » étant celui des dizaines d'un résultat de d100. Le livre renvoie à ce point à une figure d'appui, **`CHECK YOUR SKILL OR CHARACTERISTIC`** (`CRB 024 l.16`), dont la source ne transcrit que la légende (défaut de transcription, #1820) ; la règle chiffrée reste celle de `CRB 024 l.14`.

Le signe du `SL` suit mécaniquement la comparaison jet/valeur testée (`CRB 024 l.87`) : obtenir un résultat **égal ou inférieur** à son `Skill` donne un `SL` **positif**, obtenir un résultat **supérieur** donne un `SL` **négatif**.

Les exemples du livre montrent le calcul brut, avant tout modificateur :

- `Stealth (Urban) 39`, jet de **41** → `3 - 4 = -1` `SL`, « as the result on the dice is higher » (`CRB 024 l.116`).
- `Melee (Basic)` de `Skill` **55**, jet de **23** → **+3 `SL`** (`CRB 024 l.134`).

### Ce qui peut modifier le jet ou son verdict avant le calcul du `SL`

Trois règles du même chapitre s'interposent entre le jet nu et le `SL` brut ; chacune a son topic, aucune n'est reprise ici :

- **Réussite et échec automatiques** : un jet de `96-100` est toujours un échec, au minimum un `Marginal Failure` ; un jet de `01-05` est toujours une réussite, au minimum un `Marginal Success` — quelles que soient les probabilités (`CRB 024 l.35`).
- **`Advantage` / `Disadvantage`** : le jet lui-même peut voir ses chiffres inversés (un `71` devenu `17`, un `19` devenu `91`) avant toute comparaison, et les sources multiples donnent `+1 SL` ou `-1 SL` (`CRB 024 l.48-50`).
- **`Criticals` et `Fumbles`** : sur un double, on calcule d'abord le `SL` final normalement, puis on requalifie le résultat (`CRB 024 l.39`).

### `MODIFIERS AND 0 SL` : `Marginal Success` / `Marginal Failure`

Le `SL` brut n'est pas le `SL` final. Tous les Tests ne sont pas aussi simples que le jet ci-dessus : le `Success Level` d'un Test peut être modifié par sa Difficulty et par les capacités et l'équipement du `Character` (`CRB 024 l.54`) — la `Difficulty` fixée par le `GM` d'une part, les tâches plus faciles donnant un bonus de `SL` et les plus dures un malus (`CRB 024 l.56`), les modificateurs du `Character` issus des `Talents`, de l'équipement, des `Spells` et d'autres effets d'autre part (`CRB 024 l.57`). On combine bonus et malus de `SL` de la `Difficulty` avec ceux du `Character` pour arriver au **modificateur de `SL` final du jet**, ce qui peut changer une réussite en échec, ou arracher la victoire aux mâchoires de la défaite (`CRB 024 l.59`). Le détail de ces modificateurs et la `DIFFICULTY TABLE` relèvent du topic [DIFFICULTY AND CHARACTER MODIFIERS — DIFFICULTY TABLE](#difficulty-and-character-modifiers--difficulty-table).

Il arrive que des modificateurs de `SL` ajustent le résultat d'un Test à **0 `SL`** (`CRB 024 l.20`). Le livre tranche alors le signe du zéro par le **jet brut**, et non par le calcul (`CRB 024 l.22-23`) :

- Si le jet de dés était **inférieur ou égal** au `Skill` testé, le résultat est un `Marginal Success` (**+0 `SL`**).
- S'il était **supérieur**, le résultat est un `Marginal Failure` (**-0 `SL`**).

Un `+0` et un `-0` ne sont donc pas le même résultat : l'un est une réussite, l'autre un échec. Le chapitre le confirme ailleurs en classant les deux bornes de part et d'autre du verdict : une réussite est un `+0 SL or more`, un échec un `-0 SL or worse` (`CRB 024 l.41-42`).

### `SUMMARY & OUTCOME` : le signe du `SL` décide

Le résumé du chapitre tient en trois lignes (`CRB 024 l.87-89`) :

- Obtenir un résultat égal ou inférieur à son `Skill` donne un `SL` positif ; au-dessus, un `SL` négatif.
- La `Difficulty` ou les modificateurs du `Character` ajustent le `SL`.
- **Un résultat de `SL` positif signifie que vous réussissez, un résultat de `SL` négatif signifie que vous échouez.**

Souvent, il suffit de savoir si le Test est une réussite ou un échec. S'il importe de savoir à quel point on a bien réussi ou mal échoué, on consulte l'`OUTCOMES TABLE` ; le `GM` utilise les descriptions de la table pour décider de ce qui arrive du fait de l'action, et le chapitre annonce qu'il contient plus loin quantité de tables d'`outcome` d'exemple pour des actions variées, avec des conseils spécifiques d'usage des règles (`CRB 024 l.91`). **La table elle-même est transcrite au topic [OUTCOMES TABLE — lecture du SL final](#outcomes-table--lecture-du-sl-final), seul porteur canonique — elle n'est pas répétée ici.**

### Exemple complet de bout en bout

Markus a `Stealth (Urban) 39` et le `GM` juge le Test `Average (+2 SL)`. Le joueur obtient **41**. Le jet est supérieur au `Skill` : `3 - 4 = -1` `SL`, normalement un échec ; mais l'ajout de `+2 SL` pour la `Difficulty` `Average` en fait une réussite à **+1 `SL`** (`CRB 024 l.116`). Le `SL` final, et lui seul, décide du verdict.

**Sources RAW** :
- `CRB 004 l.25-35` — **THROWING BONES** : d10 (0 = 10), somme des dés, dés modifiés (1d10+4), lecture du d100 (`00` = 100), les jets bas réussissent
- `CRB 024 l.13` — **`ROLL DICE`** : on lance un d100 en visant égal ou inférieur au `Skill` ; réussi si c'est le cas.
- `CRB 024 l.14` — calcul du `Success Level` : soustraire le premier chiffre du jet au premier chiffre du `Skill` ou de la `Characteristic` testé(e).
- `CRB 024 l.16` — légende de la figure d'appui **`CHECK YOUR SKILL OR CHARACTERISTIC`** : le texte de la figure n'est pas transcrit dans la source (#1820).
- `CRB 024 l.20` — **`MODIFIERS AND 0 SL`** : des modificateurs de `SL` peuvent ajuster le résultat d'un Test à 0 `SL`.
- `CRB 024 l.22-23` — à 0 `SL`, jet ≤ `Skill` ⇒ `Marginal Success` (+0 `SL`) ; jet supérieur ⇒ `Marginal Failure` (-0 `SL`).
- `CRB 024 l.35` — réussite et échec automatiques : `96-100` toujours un échec (au moins `Marginal Failure`), `01-05` toujours une réussite (au moins `Marginal Success`).
- `CRB 024 l.39` — sur un double, le `SL` final du Test se calcule d'abord normalement, avant requalification en `Critical`/`Fumble`.
- `CRB 024 l.41-42` — une réussite est un `+0 SL or more`, un échec un `-0 SL or worse` : le `±0` est classé de part et d'autre du verdict.
- `CRB 024 l.48-50` — `Advantage`/`Disadvantage` : inversion des chiffres du jet avant comparaison, et `±1 SL` par source supplémentaire.
- `CRB 024 l.54` — tous les Tests ne sont pas aussi simples : le `SL` peut être modifié par la Difficulty et par les capacités/équipement du `Character`.
- `CRB 024 l.56-57` — les deux origines des modificateurs : `Difficulty` fixée par le `GM` (bonus pour les tâches faciles, malus pour les dures), modificateurs du `Character` (`Talents`, équipement, `Spells`, autres effets).
- `CRB 024 l.59` — on combine les deux en un modificateur de `SL` final, qui peut renverser le verdict.
- `CRB 024 l.83` — `CHARACTERISTIC TESTS` : le seuil testé peut être une `Characteristic` ; règle transcrite verbatim au topic MAKING A TEST (troisième puce de DESCRIBE ACTION), pas ici.
- `CRB 024 l.87-89` — **`SUMMARY & OUTCOME`** : signe du `SL` selon jet vs `Skill`, ajustement par les modificateurs, `SL` positif = réussite / `SL` négatif = échec.
- `CRB 024 l.91` — quand consulter l'`OUTCOMES TABLE` et qui l'interprète.
- `CRB 024 l.116` — exemple chiffré : `Stealth (Urban) 39`, jet 41, `3 - 4 = -1 SL`, `+2 SL` de `Difficulty` ⇒ `+1 SL`.
- `CRB 024 l.134` — exemple chiffré : `Skill` 55, jet 23 ⇒ `+3 SL`.

> « Player rolls the dice, a d100, trying to get equal or lower than their Skill. If they do, they have succeeded. » — `CRB 024 l.13`

> « If it's important to know how well or badly they did, we use the Test's **Success Level** (SL). Subtract the first digit of your roll from the first digit of the Skill or Characteristic being tested to see how many SL you've generated, as shown below. » — `CRB 024 l.14`

> « Sometimes, SL modifiers will adjust the result of a Test to 0 SL. » — `CRB 024 l.20`

> « If your dice roll was less than or equal to the skill being tested, the outcome is a Marginal Success (+0 SL). » / « If it was higher, the outcome is a Marginal Failure (-0 SL). » — `CRB 024 l.22-23`

> « A roll of 96-100 is always a failure, resulting in at least a Marginal Failure. A roll of 01-05 is always a success, achieving at least a Marginal Success. » — `CRB 024 l.35`

> « Combine any SL bonuses or penalties from the Difficulty with the Character's modifiers to arrive at the final SL modifier for the roll. This could turn a success into a failure, or prise victory from the jaws of defeat! » — `CRB 024 l.59`

> « Rolling equal to or under your Skill gives you positive SL, rolling above it gives you negative SL. » — `CRB 024 l.87`

> « A positive SL result means you succeed, and a negative SL result means you fail. » — `CRB 024 l.89`

> « That's -1 SL, as the result on the dice is higher, and 3 - 4 = -1. That's normally a failure, but adding +2 SL because the Test is of Average Difficulty makes it a success (+1 SL). » — `CRB 024 l.116`

**Voir aussi** :

- [MAKING A TEST — déclenchement et procédure du Test](#making-a-test--déclenchement-et-procédure-du-test) — porteur canonique de **CHARACTERISTIC TESTS** et de **REPEATING TESTS** (`CRB 024 l.7-9`, `l.29-31`, `l.81-83`)
- [OUTCOMES TABLE — lecture du SL final](#outcomes-table--lecture-du-sl-final) (`CRB 024 l.91-104`)
- [DIFFICULTY AND CHARACTER MODIFIERS — DIFFICULTY TABLE](#difficulty-and-character-modifiers--difficulty-table) (`CRB 024 l.52-73`)
- [ADVANTAGE AND DISADVANTAGE — inversion des chiffres et cumul](#advantage-and-disadvantage--inversion-des-chiffres-et-cumul) (`CRB 024 l.46-50`, exemples `l.128-130`)
- [AUTOMATIC SUCCESS AND FAILURE — 01-05 et 96-100](#automatic-success-and-failure--01-05-et-96-100) (`CRB 024 l.33-35`)
- [CRITICALS AND FUMBLES — le double](#criticals-and-fumbles--le-double) (`CRB 024 l.37-44`, exemples `l.118-124`)
- [OPPOSED TESTS — les Tests opposés](#opposed-tests--les-tests-opposés) (`CRB 024 l.75-79`, exemples `l.132-136`)
- [EXTENDED TESTS — les Tests étendus](#extended-tests--les-tests-étendus) (`CRB 024 l.106-108`)
- [DARKNESS AND TESTS — l'obscurité et les Tests fondés sur la vue](#darkness-and-tests--lobscurité-et-les-tests-fondés-sur-la-vue) (`CRB 024 l.25-27`)
- [Getting Help — se faire aider sur un Test](#getting-help--se-faire-aider-sur-un-test) (`CRB 024 l.138-144`)
- [Fortune — Spend a Fortune Point to: et Replenishing Fortune](#fortune--spend-a-fortune-point-to-et-replenishing-fortune) (`CRB 025`)

**Implémente :** (non implémenté)
- dette : #1873

---

## AUTOMATIC SUCCESS AND FAILURE — 01-05 et 96-100

Le CRB borne les deux extrémités du d100 : **quelles que soient les probabilités**, un jet ne peut
jamais être une réussite garantie ni un échec garanti. Deux bandes de cinq résultats renversent le
verdict normal du Test, et le livre les regroupe sous une seule section, **AUTOMATIC SUCCESS AND
FAILURE** (`CRB 024 l.33-35`).

**La règle, dans le détail.**

- **Un jet de `96-100` est TOUJOURS un échec** (`always a failure`), et il produit **au minimum** un
  *Marginal Failure* (`resulting in at least a Marginal Failure`). Autrement dit : même si le résultat
  du d100 est inférieur ou égal à la valeur de Skill / Characteristic testée, même si la Difficulty et
  les modificateurs du personnage poussent le total vers le positif, le Test échoue.
- **Un jet de `01-05` est TOUJOURS une réussite** (`always a success`), et il atteint **au minimum**
  un *Marginal Success* (`achieving at least a Marginal Success`). Même si le résultat dépasse
  largement la valeur testée, et même si les modificateurs de SL sont défavorables, le Test réussit.
- La formule employée par le livre est *au minimum* (`at least`) : la bande fixe un **plancher** de
  résultat du bon côté du succès/échec, elle ne fige pas le **degré** — le SL final se calcule par
  ailleurs et peut être meilleur qu'un *Marginal Success*, ou pire qu'un *Marginal Failure*.
- La justification narrative donnée par le livre encadre le tout : `No matter the odds, hope is always
  present, and success is never guaranteed.`

**Ce que « un jet de 96-100 / 01-05 » désigne aux dés.** Le d100 se lit à deux d10 : `Designate one
die as the tens die and the other as the units die, then read the results as a two-digit number` — et
`If both dice roll 0, the result is 100` (`CRB 004 l.33`). La bande haute couvre donc les cinq
résultats `96`, `97`, `98`, `99` et `100`, ce dernier étant lu `00` sur les dés ; la bande basse couvre
`01`, `02`, `03`, `04`, `05`. Le livre rappelle au même endroit le sens de lecture de tout le système :
`In general, low rolls give successful results` (`CRB 004 l.35`).

**Ce à quoi la bande s'applique.** La règle porte sur le **jet de dés lui-même** (`A roll of 96-100`,
`A roll of 01-05`), c'est-à-dire sur le d100 lancé et comparé à la Skill, et non sur le SL final ;
la procédure de ce jet et le calcul du SL ne sont pas redits ici — voir le **renvoi** ci-dessous. La
bande vaut aussi pour un **Characteristic Test**, que le livre fait passer « as normal » quand aucune
Skill ne couvre l'action (`you Test it as normal`, `CRB 024 l.81-83`). Elle ne s'applique en revanche
qu'aux situations où l'on lance réellement les dés : le cadre du chapitre réserve le Test aux issues
incertaines ou opposées, les actions routinières réussissant sans Test (`CRB 023 l.5`).

**Renvois nommés — la règle empruntée se lit à son topic porteur, jamais recopiée ici.**

- **Lecture du d100** (dé des dizaines / dé des unités ; `00` aux deux dés = `100`) — `CRB 004 l.33`,
  section **THROWING BONES** du chapitre `004 - Introduction`, portée par [ROLL DICE — le d100 et le calcul du Success Level (SL)](#roll-dice--le-d100-et-le-calcul-du-success-level-sl).
- **ROLL DICE et calcul du SL** (d100 comparé à la Skill, puis premier chiffre du jet retranché au
  premier chiffre de la valeur testée) — `CRB 024 l.13-14`,
  [ROLL DICE — le d100 et le calcul du Success Level (SL)](#roll-dice--le-d100-et-le-calcul-du-success-level-sl).
- **MODIFIERS AND 0 SL** (départage *Marginal Success* `+0` / *Marginal Failure* `–0` selon que le dé
  est ≤ ou > à la valeur testée) — `CRB 024 l.18-23`,
  [ROLL DICE — le d100 et le calcul du Success Level (SL)](#roll-dice--le-d100-et-le-calcul-du-success-level-sl).
- **OUTCOMES TABLE** (échelle complète des degrés, d'*Astounding Success* à *Astounding Failure*) —
  `CRB 024 l.93-104`, [OUTCOMES TABLE — lecture du SL final](#outcomes-table--lecture-du-sl-final).
- **CRITICALS AND FUMBLES** (sur un double, SL calculé normalement, puis *Critical Success* ou
  *Fumble* traité en *Astounding* ±5 SL ; cas particulier des `Combat Melee Tests`) —
  `CRB 024 l.37-44`, [CRITICALS AND FUMBLES — le double](#criticals-and-fumbles--le-double) —
  **porteur unique** de la question de savoir quels jets comptent comme `a double`, `00`/`100` compris.
- **ADVANTAGE AND DISADVANTAGE** (inversion des chiffres du jet, au choix en Advantage, imposée en
  Disadvantage) — `CRB 024 l.46-50`,
  [ADVANTAGE AND DISADVANTAGE — inversion des chiffres et cumul](#advantage-and-disadvantage--inversion-des-chiffres-et-cumul),
  porteur de la lecture du `100` à l'inversion.
- **OPPOSED TESTS** (le SL le plus haut l'emporte, sans obligation de réussir son propre Test ;
  égalité à l'initiateur) — `CRB 024 l.75-79`,
  [OPPOSED TESTS — les Tests opposés](#opposed-tests--les-tests-opposés).
- **I Will Not Fail!** (dépense de Fate : on choisit le résultat *au lieu de lancer*) —
  `CRB 025 l.28-32`,
  [Achieving the Impossible — I Will Not Fail!](#achieving-the-impossible--i-will-not-fail).
- **Cadre du Test** (on ne Teste que l'issue incertaine ou opposée) — `CRB 023 l.5`,
  [MAKING A TEST — déclenchement et procédure du Test](#making-a-test--déclenchement-et-procédure-du-test).

**Les deux planchers ne sont pas redéfinis ici.** *Marginal Success* (`+0`) et *Marginal Failure*
(`–0`) sont les deux degrés que départage la section **MODIFIERS AND 0 SL**, et leur place dans
l'échelle complète des degrés vient de l'**OUTCOMES TABLE** (renvois ci-dessus). La bande automatique
**ne crée aucun degré nouveau** : elle impose l'un de ces deux degrés déjà existants comme issue
minimale.

**Plancher, pas plafond — l'articulation avec CRITICALS AND FUMBLES.** Le livre traite les doubles
dans une section distincte : un double fait calculer le SL final comme d'habitude, puis un échec
(`-0 SL` ou pire) devient un *Fumble* traité en *Astounding Failure* (`-5 SL`), sauf pire encore
(`CRB 024 l.37-44`). C'est exactement la portée du mot `at least` : un jet de la bande haute qui est
aussi un double reste un échec, mais un échec bien pire qu'un *Marginal Failure*. Aux dés, la bande
haute contient un double manifeste, `99`, et le `100` qui se lit `00`, soit deux dés identiques
(`CRB 004 l.33`) ; **quels jets déclenchent CRITICALS AND FUMBLES se lit au topic
[CRITICALS AND FUMBLES — le double](#criticals-and-fumbles--le-double)**, seul porteur de ce point, et ne se tranche pas ici. La bande basse (`01`,
`02`, `03`, `04`, `05`) ne contient, elle, aucun jet à deux chiffres identiques : elle ne peut pas, à
elle seule, produire un *Critical Success*. En Combat, la section précise en outre que `Combat Melee
Tests work differently. The Critical/Fumble doesn't modify your SL` (`CRB 024 l.44`).

**Ce que le livre ne tranche pas.** Le texte du CRB ne précise pas dans quel ordre la bande s'évalue
par rapport à une **inversion de chiffres** due à Advantage / Disadvantage — alors même que
l'inversion peut faire entrer dans une bande ou en Spellir (un `17` inversé en `71`, un `19` en `91` ;
`CRB 024 l.48`). Ce point n'est traité nulle part dans **MAKING A TEST** ; il est porté, avec la
lecture du `100` à l'inversion, par le topic
[ADVANTAGE AND DISADVANTAGE — inversion des chiffres et cumul](#advantage-and-disadvantage--inversion-des-chiffres-et-cumul). Le livre ne prévoit par
ailleurs **aucune table** pour la bande automatique.

**La seule règle du livre qui nomme une bande.** Aucune règle ne suspend la bande automatique, mais le
Spell **Curse of Ill Fortune** la nomme pour en priver sa cible : `If they have no Fortune, they reroll
all Test rolls of 01–05` (`CRB 072 l.130`). Le jet favorable n'est pas requalifié — il est **relancé**,
et le nouveau jet est à son tour soumis aux deux bandes.

**Bande automatique et Opposed Test.** Un *Opposed Test* se gagne au SL le plus haut, sans avoir à
réussir son propre Test (`CRB 024 l.77`). La bande automatique fixe donc l'issue de **son propre**
Test (réussite ou échec, avec son plancher de degré), jamais le vainqueur de l'opposition : un `01-05`
planché à *Marginal Success* peut perdre face à un adversaire au SL supérieur, et un `96-100` planché
à *Marginal Failure* peut encore l'emporter sur un adversaire au SL plus bas (l'exemple du livre
montre un `-1 SL` qui bat un `-4 SL`).

**Ne pas confondre avec les effets « sans jet ».** Plusieurs règles du CRB donnent une issue
automatique en **supprimant le jet** : la bande `96-100` / `01-05` ne peut alors pas s'appliquer,
faute de dé. Principaux cas :

- **I Will Not Fail!** (dépense de Fate) — `Instead of rolling a Test, choose the result instead`
  (`CRB 025 l.32`) ; règle entière au topic [Achieving the Impossible — I Will Not Fail!](#achieving-the-impossible--i-will-not-fail).
- **Helpless Targets** — `you choose the result of your attack roll instead of rolling`
  (`CRB 036 l.183`).
- Talent **Resistant (Threat)** — `before rolling a Test to resist a specific Threat […] you may choose
  to automatically pass that Test` (`CRB 021 l.514`), une fois par session.
- Talent **Combat Aware** — quand le GM accorderait normalement un Test pour ignorer *Surprised*,
  `you automatically succeed` (`CRB 021 l.133`).
- Amputated Part **Tongue** — `You automatically fail all Language Tests involving speaking`
  (`CRB 038 l.302`) : la symétrie en échec, également sans jet.

Inversement, les dépenses de Fortune `Gain Advantage on a Test before rolling` et `Reroll a Test,
keeping the new result` (`CRB 025 l.9-10`) ne contredisent pas la bande : celle-ci qualifie **un jet
donné**, et un relancer produit un nouveau jet, lui-même soumis à la bande.

**Sources RAW** :
- `CRB 024 l.33-35` — section **AUTOMATIC SUCCESS AND FAILURE** : le texte intégral de la règle —
  `96-100` toujours un échec, au minimum *Marginal Failure* ; `01-05` toujours une réussite, au
  minimum *Marginal Success* ; principe « `No matter the odds` ».
- `CRB 004 l.33` — **THROWING BONES** : lecture du d100 à deux d10 (dé des dizaines, dé des unités) et
  `If both dice roll 0, the result is 100` — ce que les dés produisent dans chaque bande.
- `CRB 004 l.35` — même section : `In general, low rolls give successful results`, le sens de lecture
  qui donne sa logique aux deux bandes.
- `CRB 024 l.13-14` — **renvoi** : le jet auquel la bande s'applique (d100 comparé à la Skill) et le
  calcul du **Success Level** ; règle portée par le topic **ROLL DICE**.
- `CRB 024 l.18-23` — **renvoi** : section **MODIFIERS AND 0 SL**, qui départage *Marginal Success* et
  *Marginal Failure* ; même topic porteur.
- `CRB 024 l.93-104` — **renvoi** : **OUTCOMES TABLE**, l'échelle complète des degrés qui donne aux deux
  planchers leur sens ; table transcrite au topic **OUTCOMES TABLE**.
- `CRB 024 l.37-44` — **renvoi** : **CRITICALS AND FUMBLES** — les doubles, qui peuvent aggraver un
  échec de la bande haute jusqu'à *Astounding Failure* (`-5 SL`) ; cas particulier des
  `Combat Melee Tests` (`CRB 024 l.44`). Porteur unique de la qualification d'un jet en `a double`.
- `CRB 024 l.46-50` — **renvoi** : **ADVANTAGE AND DISADVANTAGE** — l'inversion des chiffres, dont
  l'ordre d'évaluation face à la bande n'est pas traité par le livre.
- `CRB 024 l.75-79` — **renvoi** : **OPPOSED TESTS** — le vainqueur est le SL le plus haut, et l'on n'a
  pas besoin de réussir son propre Test pour l'emporter (`CRB 024 l.77`), l'exemple opposant `-1 SL` à `-4 SL`.
- `CRB 024 l.81-83` — **CHARACTERISTIC TESTS** : un Characteristic Test se passe « as normal », donc
  sous la même bande.
- `CRB 023 l.5` — **renvoi** : cadre du Test (issue incertaine ou opposée, actions routinières sans
  Test) ; règle portée par le topic **MAKING A TEST**.
- `CRB 025 l.28-32` — **renvoi** : **Achieving the Impossible** / **I Will Not Fail!** — on choisit le
  résultat **au lieu de lancer**, donc hors bande ; règle portée par le topic **Achieving the Impossible**.
- `CRB 025 l.9-10` — dépenses de Fortune : Advantage avant le jet, ou relancer le Test en gardant le
  nouveau résultat — le nouveau jet est à son tour soumis à la bande.
- `CRB 072 l.130` — Spell **Curse of Ill Fortune** : la seule règle du livre qui nomme une bande —
  `they reroll all Test rolls of 01–05` quand la cible n'a plus de Fortune.
- `CRB 036 l.183` — **Helpless Targets** : on choisit le résultat du jet d'attaque au lieu de le lancer.
- `CRB 021 l.514` — Talent **Resistant (Threat)** : réussite choisie avant le jet, une fois par session.
- `CRB 021 l.133` — Talent **Combat Aware** : `you automatically succeed` sans jet quand un Test serait
  normalement accordé pour ignorer *Surprised*.
- `CRB 038 l.302` — Amputated Part **Tongue** : `You automatically fail all Language Tests
  involving speaking`, échec sans jet.

> « No matter the odds, hope is always present, and success is never guaranteed. A roll of 96-100 is
> always a failure, resulting in at least a Marginal Failure. A roll of 01-05 is always a success,
> achieving at least a Marginal Success. » — `CRB 024 l.35`

> « Designate one die as the tens die and the other as the units die, then read the results as a
> two-digit number. A 1 on the tens die and 4 on the units die gives 14; a 4 and 2 gives 42. If both
> dice roll 0, the result is 100. » — `CRB 004 l.33`

**Voir aussi** :

- [ROLL DICE — le d100 et le calcul du Success Level (SL)](#roll-dice--le-d100-et-le-calcul-du-success-level-sl) — **ROLL DICE** et **MODIFIERS AND 0 SL** (`CRB 024 l.13-23`)
- [OUTCOMES TABLE — lecture du SL final](#outcomes-table--lecture-du-sl-final) — l'**OUTCOMES TABLE** verbatim (`CRB 024 l.85-104`)
- [CRITICALS AND FUMBLES — le double](#criticals-and-fumbles--le-double) (`CRB 024 l.37-44`)
- [ADVANTAGE AND DISADVANTAGE — inversion des chiffres et cumul](#advantage-and-disadvantage--inversion-des-chiffres-et-cumul) (`CRB 024 l.46-50`)
- [DIFFICULTY AND CHARACTER MODIFIERS — DIFFICULTY TABLE](#difficulty-and-character-modifiers--difficulty-table) (`CRB 024 l.52-73`)
- [OPPOSED TESTS — les Tests opposés](#opposed-tests--les-tests-opposés) (`CRB 024 l.75-79`)
- [EXTENDED TESTS — les Tests étendus](#extended-tests--les-tests-étendus) (`CRB 024 l.106-108`)
- [DARKNESS AND TESTS — l'obscurité et les Tests fondés sur la vue](#darkness-and-tests--lobscurité-et-les-tests-fondés-sur-la-vue) (`CRB 024 l.25-27`)
- [MAKING A TEST — déclenchement et procédure du Test](#making-a-test--déclenchement-et-procédure-du-test) — **CHARACTERISTIC TESTS**, **REPEATING TESTS** (`CRB 023 l.5`, `CRB 024 l.29-31`, `l.81-83`)
- [Achieving the Impossible — I Will Not Fail!](#achieving-the-impossible--i-will-not-fail) (`CRB 025 l.28-32`)
- [ROLL DICE — le d100 et le calcul du Success Level (SL)](#roll-dice--le-d100-et-le-calcul-du-success-level-sl) — **THROWING BONES**, lecture du d10 et du d100 (`CRB 004 l.27-35`)

**Implémente :** (non implémenté)
- dette : #1873

---

## CRITICALS AND FUMBLES — le double

**Définition RAW du double.** Le livre définit le double au chapitre du GM, dans l'inventaire des composants d'un Test : « **Rolling a Double:** Rolling a double means both the tens and the units die roll the same number (11, 22, 33, 44 and so on). This is most often relevant for triggering a Critical or Fumble in combat. It gives the GM the opportunity to introduce dramatic or amusing events for good or ill — feel free to get creative in describing what happens! » — `CRB 076 l.99`. Le déclencheur est donc l'**égalité du dé des dizaines et du dé des unités**, et non une table de résultats : le RAW énumère « 11, 22, 33, 44 and so on », d'où 55, 66, 77, 88, 99 par la même règle. Cette définition attache aussi au double une **latitude narrative explicite du GM** (« dramatic or amusing events for good or ill »), qui accompagne la bascule mécanique décrite ci-dessous.

### Silence RAW — le cas du 00 (résultat de 100)

Le livre n'énumère, pour les doubles, que `11, 22, 33, 44 and so on` (`CRB 076 l.99`) et ne tranche jamais si un **00** (les deux dés à 0, c'est-à-dire 100) est un double. Il est par ailleurs toujours un échec — « A roll of 96-100 is always a failure » (`CRB 024 l.35`) —, et le chapitre de combat le nomme aux côtés du 99 pour les Misfires, `roll 99 or 00` (`CRB 036 l.102`), sans dire qu'il s'agit de doubles. **Silence RAW** : la question n'est pas tranchée ici.

**Ordre de résolution.** Le double ne court-circuite rien : on calcule d'abord le SL final du Test **normalement**, modificateurs de Difficulty et modificateurs du personnage compris (« work out the final SL of the Test as normal »). C'est ce SL **final** — et non le brut du dé — qui décide du sens de la bascule :

- **Réussite** (**+0 SL** ou mieux, c'est-à-dire Marginal Success inclus) → **Critical Success**, traité comme **Astounding (+5 SL)**, *sauf s'il existe un résultat encore meilleur* (« unless there's an even better outcome! ») : le double ne rabaisse donc jamais un SL déjà supérieur à +5.
- **Échec** (**–0 SL** ou pire, c'est-à-dire Marginal Failure inclus) → **Fumble**, traité comme **Astounding Failure (–5 SL)**, *sauf si le résultat serait par ailleurs pire* (« unless it would otherwise be worse… ») : le double ne remonte donc jamais un SL déjà inférieur à –5.

Autrement dit, sur un double le SL est **porté au moins** à +5 (réussite) ou **au plus** à –5 (échec), sans jamais dégrader un résultat déjà plus extrême. Un double qui produit une Marginal Success (+0 SL) après modificateurs est donc bien un **Critical Success** ; un double qui produit une Marginal Failure (–0 SL) est bien un **Fumble**.

Les deux degrés visés sont les lignes **Astounding Success** (« +5 or more ») et **Astounding Failure** (« –5 or less ») de l'**OUTCOMES TABLE** du même chapitre — `CRB 024 l.97` et `CRB 024 l.104`. Leur transcription verbatim, cellule *Have You Succeeded?* comprise, appartient au topic porteur de la table : voir [OUTCOMES TABLE — lecture du SL final](#outcomes-table--lecture-du-sl-final), qui transcrit l'**OUTCOMES TABLE** complète (`CRB 024 l.93-104`). Ce topic ne re-transcrit pas ces cellules.

**Ce qui peut faire basculer le SENS de la bascule — et ce qui ne le peut pas.** Puisque le sens (Critical ou Fumble) se lit sur le **SL final**, tout ce qui modifie ce SL peut le renverser : Difficulty (`CRB 024 l.61-73`), modificateurs du personnage, +1 SL par source d'Advantage surnuméraire / –1 SL par source de Disadvantage surnuméraire (`CRB 024 l.50`), et jusqu'à +1 SL que le GM peut accorder pour une approche astucieuse (`CRB 076 l.91`). En revanche, l'**inversion des chiffres** d'Advantage/Disadvantage ne peut **ni créer ni détruire** un double : l'inversé de XY est YX, qui est un double exactement quand XY en est un. Un **reroll**, lui, fait jouer un nouveau dé, donc un nouveau test de double (« You must use the second result » — `CRB 076 l.97`).

**Exception : les Tests de mêlée en combat.** Le texte du chapitre *Making a Test* isole les **Combat Melee Tests** : le Critical/Fumble **ne modifie pas le SL**. À la place, un **Critical** inflige immédiatement une **Critical Wound** (page 171) à l'adversaire, et un **Fumble** fait lancer sur l'**Oops Table**. On poursuit ensuite la résolution du Test normalement (calcul du SL, désignation du vainqueur d'un Test opposé) — `CRB 024 l.44`.

### Écart RAW — le périmètre de l'exception de combat

Le corps de règle nomme les seuls `Combat Melee Tests` (`CRB 024 l.44`), tandis que l'exemple de fin de chapitre renvoie plus largement — « Criticals and Fumbles work a little differently when making Melee or Ranged Tests in combat — see page 165. » (`CRB 024 l.124`). Le chapitre de combat, lui, écrit **Melee or Ranged** dans les deux sens (`CRB 036 l.72`, `CRB 036 l.78`). Écart RAW, non tranché ici. Le détail de cette voie (Critical Hit, Oops! Table, Misfires, Fumble gagnant un Test opposé) relève de l'aire `combat`.

### Écart RAW — l'effet par défaut d'un Fumble au combat

`CRB 024 l.44` fait de l'**Oops Table** l'effet du Fumble en mêlée ; le chapitre de combat en fait au contraire une **option du GM**, l'effet par défaut étant de lâcher son arme (`CRB 036 l.80`). Écart RAW, non tranché ici ; la résolution d'un Fumble au combat relève de l'aire `combat`.

**Exemples donnés par le livre** (`CRB 024 l.118-124`, sous *Test Examples* › *Criticals and Fumbles*) :

- *Fumble hors combat* — Markus teste **Stealth (Urban) 39** et obtient **66** : échec (3 – 6 = –3 SL) **et** double, donc un Fumble. Le GM narre qu'il ne s'est pas seulement fait repérer : il tombe sur Kalk Grumdraagen, ivre et furieux, à qui il doit plus de cent couronnes d'or.
- *Critical hors combat* — Markus tente ensuite un Test d'**Athletics 30** jugé **Difficult (–1 SL)** et obtient **11** : 3 – 1 = +2 SL, moins 1 de Difficulty = **+1 SL**, donc une réussite — **et** un double, donc un **Critical**. Le GM accorde non seulement le saut, mais le démarrage de la barge avant que Kalk ne le rattrape.

Dans ces deux exemples, le GM **narre** la conséquence sans recalculer explicitement le SL à ±5 : le texte de règle reste la référence pour la valeur, l'exemple pour la latitude narrative de `CRB 076 l.99`.

**Interaction avec les Extended Tests.** Dans un Test étendu, la contribution d'un Critical ou d'un Fumble au total courant a son propre plancher : « A success always adds at least +1 SL, a failure always subtracts at least -1 SL, a Critical adds at least +6 SL, and a Fumble subtracts at least -6 SL. » — `CRB 076 l.111`. Le détail appartient au topic *Extended Tests*.

**Sources RAW** :
- `CRB 076 l.99` — **définition du double** : dé des dizaines et dé des unités identiques (11, 22, 33, 44 « and so on »), pertinence première pour déclencher un Critical ou un Fumble en combat, latitude narrative explicite du GM
- `CRB 024 l.37-42` — section **CRITICALS AND FUMBLES** : calcul du SL final d'abord, réussite → Critical Success traité comme Astounding (+5 SL) sauf meilleur résultat, échec → Fumble traité comme Astounding Failure (–5 SL) sauf pire résultat
- `CRB 024 l.44` — exception des **Combat Melee Tests** : pas de modification du SL, Critical → Critical Wound (page 171), Fumble → **Oops Table**, puis résolution normale du Test
- `CRB 024 l.97`, `CRB 024 l.104` — lignes **Astounding Success** / **Astounding Failure** de l'**OUTCOMES TABLE**, degrés visés par la bascule ; cellules transcrites au topic **OUTCOMES TABLE**, non recopiées ici
- `CRB 024 l.35` — **Automatic Success and Failure** : 96-100 toujours un échec (au moins Marginal Failure), 01-05 toujours une réussite (au moins Marginal Success)
- `CRB 024 l.46-50` — **Advantage and Disadvantage** : inversion des chiffres (sans effet sur la présence d'un double), +1/–1 SL par source surnuméraire (peut renverser le sens de la bascule)
- `CRB 024 l.118-124` — **Test Examples** › *Criticals and Fumbles* : Fumble sur 66 avec Stealth (Urban) 39 ; Critical sur 11 avec Athletics 30 en Difficult (–1 SL) ; renvoi page 165 pour « Melee or Ranged Tests in combat »
- `CRB 036 l.72`, `CRB 036 l.78` — chapitre de combat : Melee **et** Ranged, y compris en défense d'un Test opposé (aire `combat`, cité ici pour poser l'écart avec `CRB 024 l.44`)
- `CRB 036 l.80` — effet par défaut d'un Fumble au combat : lâcher son arme, **Oops! Table** en option du GM (écart avec `CRB 024 l.44`)
- `CRB 036 l.102` — **Misfires!** : sur 99 ou 00 avec une arme Blackpowder/Engineering/Explosive, on lance sur la **Misfire Table** au lieu de l'**Oops! Table**
- `CRB 076 l.91` — **SL Modifiers** : le GM peut accorder jusqu'à +1 SL pour une approche astucieuse, tous les modificateurs de SL s'appliquant après le jet
- `CRB 076 l.97` — **Reroll** : le second résultat s'impose, donc un nouveau dé, donc un nouveau double possible
- `CRB 076 l.111` — **Extended Tests** : un Critical ajoute au moins +6 SL, un Fumble retranche au moins –6 SL au total courant

> « **Rolling a Double:** Rolling a double means both the tens and the units die roll the same number (11, 22, 33, 44 and so on). This is most often relevant for triggering a Critical or Fumble in combat. It gives the GM the opportunity to introduce dramatic or amusing events for good or ill — feel free to get creative in describing what happens! » — `CRB 076 l.99`

> « Sometimes talent, luck, or an unfortunate lack of either means you do far better, or worse, than expected. When you roll a double, work out the final SL of the Test as normal: » — `CRB 024 l.39`

> « Success (+0 SL or more) becomes a Critical Success — treat it as Astounding (+5 SL) unless there's an even better outcome! » — `CRB 024 l.41`

> « Failure (-0 SL or worse) means a Fumble. Treat the result as an Astounding Failure (-5 SL) instead, unless it would otherwise be worse… » — `CRB 024 l.42`

> « Combat Melee Tests work differently. The Critical/Fumble doesn't modify your SL, instead a Critical inflicts a Critical Wound (page 171) on your opponent, and you roll on the **Oops Table** for a Fumble. Then proceed with the results of the Test as normal. » — `CRB 024 l.44`

> « Criticals and Fumbles work a little differently when making Melee or Ranged Tests in combat — see page 165. » — `CRB 024 l.124`

> « Any successful Melee or Ranged Test that rolls a double is a Critical Hit, even if you are defending in an Opposed Test. » — `CRB 036 l.72`

> « Any failed Melee or Ranged Test that rolls a double is a Fumble. » — `CRB 036 l.78`

> « By default, you drop your weapon and must spend your next Action retrieving it. Alternatively, the GM may roll on the Oops! Table. » — `CRB 036 l.80`

> « A success always adds at least +1 SL, a failure always subtracts at least -1 SL, a Critical adds at least +6 SL, and a Fumble subtracts at least -6 SL. » — `CRB 076 l.111`

**Voir aussi** :

- [OUTCOMES TABLE — lecture du SL final](#outcomes-table--lecture-du-sl-final) — porteur de l'**OUTCOMES TABLE** verbatim (`CRB 024 l.85-104`)
- [AUTOMATIC SUCCESS AND FAILURE — 01-05 et 96-100](#automatic-success-and-failure--01-05-et-96-100) (`CRB 024 l.33-35`)
- [DIFFICULTY AND CHARACTER MODIFIERS — DIFFICULTY TABLE](#difficulty-and-character-modifiers--difficulty-table) (`CRB 024 l.52-73`)
- [ADVANTAGE AND DISADVANTAGE — inversion des chiffres et cumul](#advantage-and-disadvantage--inversion-des-chiffres-et-cumul) (`CRB 024 l.46-50`, `CRB 076 l.93-95`)
- [Fortune — Spend a Fortune Point to: et Replenishing Fortune](#fortune--spend-a-fortune-point-to-et-replenishing-fortune) — porteur de la définition du **Reroll** (`CRB 076 l.97`)
- [OPPOSED TESTS — les Tests opposés](#opposed-tests--les-tests-opposés) (`CRB 024 l.75-79`)
- [EXTENDED TESTS — les Tests étendus](#extended-tests--les-tests-étendus) — planchers +6 / –6 SL (`CRB 024 l.106-108`, `CRB 076 l.101-111`)
- [Cheating Death — How Did That Miss? et Not Today!](#cheating-death--how-did-that-miss-et-not-today) (`CRB 025 l.25`) et [Achieving the Impossible — I Will Not Fail!](#achieving-the-impossible--i-will-not-fail) — Critical choisi, avec choix de la Hit Location (`CRB 025 l.32`)
- aire `combat` (fiche à extraire) — Critical Hits, Fumbles, **Oops! Table**, Misfires, Fumble gagnant un Test opposé (`CRB 036 l.66-102`)
- aire `traumatisme` (fiche à extraire) — Critical Wounds (page 171)

**Implémente :** (non implémenté)
- dette : #1873

---

## ADVANTAGE AND DISADVANTAGE — inversion des chiffres et cumul

En 5e, **Advantage** et **Disadvantage** ne sont pas des modificateurs de SL par défaut : ce sont des permissions (ou des obligations) d'**inverser les deux chiffres du d100** après le jet. Ils s'obtiennent par une règle, une capacité ou une circonstance qui les accorde explicitement — « Sometimes a rule, ability, or circumstance will grant you Advantage or Disadvantage on a Test » (`CRB 024 l.48`).

> **Piège de bascule 4e → 5e.** L'Advantage cumulable de la 4e (gagné, perdu, dépensé) s'appelle désormais **Momentum** ; l'**Advantage** de la 5e, objet de ce topic, n'a ni compteur, ni plafond, ni dépense — c'est l'inversion des chiffres d'un jet. Conversion portée par l'aire `conversion` (fiche à extraire), `CRB 116 l.15`.

**Mécanique de base — l'inversion des chiffres.**
- Avec **Advantage**, le joueur **peut** (« may ») inverser les chiffres du jet **si cela améliore son résultat** : un `71` peut devenir `17`. C'est un choix optionnel, jamais subi (`CRB 024 l.48`).
- Avec **Disadvantage**, le joueur **doit** (« must ») inverser les chiffres **si le résultat en devient pire** : un `19` devient `91`. C'est une obligation, jamais un choix (`CRB 024 l.48`).

Dans les deux cas la manipulation est la même — on lit le d100 dans l'autre sens — et seule la direction du bénéfice change : Advantage ne s'applique que dans le sens favorable, Disadvantage que dans le sens défavorable. Le livre le redit dans l'exemple : « Disadvantage works the same way, but you must reverse the results if they would be worse » (`CRB 024 l.130`). L'Appendix I en donne la même définition d'une ligne : « Advantage refers to swapping the results of a die role when doing so would benefit you » (`CRB 116 l.15` ; « die role » est la graphie du livre).

**Le jet retenu est le jet.** Dans l'exemple du livre, un `72` qui serait un échec devient un `27` qui est **un succès** : c'est donc le jet APRÈS inversion qui décide de la réussite (`CRB 024 l.128`). La résolution reprend ensuite son cours normal sur ce jet retenu : son chiffre des dizaines sert au calcul des SL — « Subtract the first digit of your roll from the first digit of the Skill or Characteristic being tested » (`CRB 024 l.14`) — puis on applique les modificateurs de SL de Difficulty et de personnage, tous appliqués **après** le lancer : « All SL Modifiers are applied after the dice are rolled » (`CRB 076 l.91`).

**Lecture des dés et cas limites.** Le d100 se lit en désignant un dé des dizaines et un dé des unités, « If both dice roll 0, the result is 100 » (`CRB 004 l.33`). Un double est défini par ces deux mêmes dés : « Rolling a double means both the tens and the units die roll the same number (11, 22, 33, 44 and so on) » (`CRB 076 l.99`). Deux conséquences purement arithmétiques de cette lecture, que le livre ne prend pas la peine d'énoncer : inverser un **double** (`11`, `22`, … `99`) échange deux chiffres identiques et redonne donc le même nombre — l'inversion ne peut ni créer ni supprimer le double qui déclenche Critical/Fumble (`CRB 024 l.39`).

**Cumul et annulation.**
- **Advantage et Disadvantage s'annulent mutuellement** (« cancel each other out »). Une source d'Advantage et une source de Disadvantage sur le même Test se neutralisent (`CRB 024 l.50`).
- **Les sources supplémentaires ne s'empilent pas en inversions multiples** — l'inversion des chiffres n'est possible qu'une fois. À la place, **chaque source d'Advantage après la première donne +1 SL**, et **des sources multiples de Disadvantage infligent −1 SL** (`CRB 024 l.50`).

Autrement dit : la première source détermine s'il y a inversion (et son sens), les suivantes se convertissent en modificateurs de SL, appliqués comme tous les modificateurs de SL une fois les dés lancés (`CRB 076 l.91`). Le RAW n'énonce pas d'ordre de résolution explicite entre l'annulation et la conversion en SL, ni de plafond au nombre de sources cumulables.

**L'Advantage d'un camp n'est pas le Disadvantage de l'autre** (`CRB 036 l.151`) : une source d'Advantage s'attache au Test qu'elle nomme. Ce passage traite l'outnumbering en Advantage, la table **MELEE ATTACK MODIFIERS** en modificateur de SL (`CRB 036 l.167`) — écart RAW non tranché ici, porté par l'aire `combat` (fiche à extraire).

**Ce qui accorde Advantage ou Disadvantage.** Le chapitre du GM nomme les familles légitimes et ferme la porte à l'improvisation : « This ability to reverse the numbers in your roll comes from Momentum (page 167), certain Talents, Spells, and Miracles, and from spending Fortune. The GM should almost never grant Advantage or inflict Disadvantage when the rules do not specifically call for it » (`CRB 076 l.95`).

Dans le périmètre des Tests :
- dépenser un **Fortune Point** — « Gain Advantage on a Test before rolling » : l'octroi se décide **avant** le lancer (`CRB 025 l.9`) ;
- l'**aide** d'un autre personnage (*Getting Help*) : le personnage à la plus haute Skill (ou Characteristic) fait le Test avec Advantage — détail, conditions et exemple chiffré : voir [Getting Help — se faire aider sur un Test](#getting-help--se-faire-aider-sur-un-test) (`CRB 024 l.138-142`) ;
- l'**obscurité** : contre une cible dans le noir, les Melee Tests, Ranged Tests et Perception Tests fondés sur la vue subissent Disadvantage (`CRB 024 l.27`).

**À ne pas confondre — le Reroll.** L'autre outil que le Fortune Point achète n'est PAS une inversion : « A reroll is when you disregard the result of a dice roll, and roll it again. You must use the second result » (`CRB 076 l.97`), et la liste des dépenses de Fortune le dit de même — « Reroll a Test, keeping the new result. You may spend another Fortune to reroll again » (`CRB 025 l.10`). Le reroll jette un nouveau jet et impose le second ; l'Advantage ne lance rien et relit le même jet à l'envers.

Hors du chapitre des Tests, d'autres règles en accordent ; chacune vit à son aire porteuse, et aucune n'est retranscrite ici :

- aire `combat` (fiche à extraire) — **Momentum** (`CRB 037 l.13`), circonstances de tir et de monte (`CRB 036 l.199`, `l.203`, `l.240-244`) ;
- aire `talents` (fiche à extraire) — Talents accordant Advantage, ainsi *Alley Cat* (`CRB 021 l.21`) ;
- aire `etats` (fiche à extraire) — Conditions *Besmirched*, *Blinded*, *Prone* (`CRB 042 l.45`, `l.59`, `l.107`) ;
- aire `psychologie` (fiche à extraire) — *Fear* (`CRB 041 l.25`) ;
- aire `magie` (fiche à extraire) — *Second Sight* en zone saturée et Channelling dans un Vent accumulé (`CRB 070 l.69`, `l.71`) ;
- aire `bestiaire` (fiche à extraire) — Creature Traits *Afraid (Target)*, *Cold-blooded*, *Fear (Rating)* (`CRB 115 l.7`, `l.62`, `l.104`) ;
- aires `intrigue`, `social`, `deplacement` (fiches à extraire) — usages de Skills (`CRB 027 l.33`, `CRB 028 l.80`, `CRB 032 l.114`).

**Exemples du livre** (chaque ligne est reprise du texte, pas recalculée) :

| Situation | Skill | Jet | Chiffres inversés ? | Résultat annoncé par le livre | Réf |
|---|---|---|---|---|---|
| Molli, Advantage par le Talent *Alley Cat* | Stealth (Urban) 46 | 72 (« Normally this would be a failure ») | oui, 72 → 27 | « a success! » | `CRB 024 l.128` |
| Molli, en Disadvantage (contrepartie du même exemple) | — | 18 | oui, obligatoire, 18 → 81 | pire résultat | `CRB 024 l.130` |
| Règle générale, illustration | — | 71 | possible (« may »), 71 → 17 | résultat amélioré | `CRB 024 l.48` |
| Règle générale, illustration | — | 19 | obligatoire (« must »), 19 → 91 | résultat aggravé | `CRB 024 l.48` |

L'exemple d'inversion sous *Getting Help* (Brokk aidé par Salundra, Strength 53, jet 61 inversé en 16) vit au topic [Getting Help — se faire aider sur un Test](#getting-help--se-faire-aider-sur-un-test) (`CRB 024 l.144`) — c'est là aussi que se constate l'écart entre le « +3 SL » annoncé par ce passage et le calcul de SL de la règle générale (`CRB 024 l.14`).

### Les trois `lose Advantage` résiduels du livre, et la clause d'Appendix I qui les réécrit

Le CRB porte **trois** occurrences de `lose Advantage` — recensement exhaustif :

| Occurrence verbatim | Où | Réf |
|---|---|---|
| `all within the Area of Effect except you lose Advantage at the start of each Round` | Miracle **Heart of Winter** (Ulric) | `CRB 067 l.410` |
| `if you have the *Disarm* Talent, you can lose Advantage to catch it in a free hand` | Weapon Quality **Trap Blade** | `CRB 086 l.272` |
| `if creature hits opponent in melee, they may lose Advantage to make an extra attack` | Creature Trait **Furious Assault** (Ungrakk's Brayherd) | `CRB 114 l.87` |

L'**Appendix I** les réécrit toutes trois en Momentum, dans la même phrase qui établit la conversion :

> « In this edition, Advantage refers to swapping the results of a die role when doing so would benefit you. When older materials refer to Advantage, it means Momentum. If an ability or effect would cause a creature to gain any amount of Advantage, they gain Momentum instead. If it would cause them to lose any amount of Advantage, they lose Momentum instead. If an expenditure of Advantage is required, that creature loses Momentum instead. » — `CRB 116 l.15`

Constat, non arbitrage : la clause de `CRB 116 l.15` vise « older materials », et ces trois occurrences sont dans le CRB 5e lui-même. Le **Momentum** relève de l'aire `combat` (fiche à extraire), la conversion 4e→5e de l'aire `conversion` (fiche à extraire).

**Silences du RAW** (aucune règle lue ne les couvre — ce sont des lacunes, pas des règles) :
- l'**ordre de résolution** quand se mêlent annulation mutuelle et conversion en ±1 SL n'est jamais posé, et aucun **plafond** de sources cumulables n'est donné (`CRB 024 l.50`) ;
- l'interaction de l'inversion avec les **seuils de réussite/échec automatiques** (`01-05` / `96-100`, `CRB 024 l.35`) n'est jamais explicitée : seul l'exemple de Molli établit que le jet retenu après inversion est celui qu'on résout (`CRB 024 l.128`) ;
- rien n'indique **qui** décide, ni quand, d'exercer l'option d'Advantage (le « may ») quand plusieurs personnes lisent le jet.

**Sources RAW** :
- `CRB 024 l.46-50` — section **ADVANTAGE AND DISADVANTAGE** : octroi par une règle, capacité ou circonstance ; inversion optionnelle (« may ») et seulement si elle améliore, pour Advantage ; inversion obligatoire (« must ») et seulement si elle aggrave, pour Disadvantage ; exemples `71 → 17` et `19 → 91` ; annulation mutuelle ; sources supplémentaires converties en +1 SL / −1 SL au-delà de la première.
- `CRB 024 l.126-130` — **Test Example: Rolling with Advantage** : Molli, Stealth (Urban) 46, jet 72 inversé en 27 grâce à l'Advantage du Talent *Alley Cat*, donnant un succès ; puis la contrepartie en Disadvantage, 18 inversé de force en 81. Établit que le jet retenu est celui qui décide de la réussite.
- `CRB 024 l.14` — calcul des SL à partir du premier chiffre du jet retenu (donc du jet **après** inversion éventuelle).
- `CRB 024 l.25-27` — **DARKNESS AND TESTS** : une cible dans l'obscurité inflige Disadvantage aux Melee Tests, Ranged Tests et Perception Tests fondés sur la vue.
- `CRB 024 l.33-35` — **AUTOMATIC SUCCESS AND FAILURE** : `96-100` toujours un échec, `01-05` toujours une réussite (aucune mention de l'inversion).
- `CRB 024 l.37-44` — **CRITICALS AND FUMBLES** : le double déclenche Critical/Fumble (un double reste un double après inversion).
- `CRB 024 l.138-144` — **Getting Help** : l'aide se traduit en Advantage pour le personnage à la plus haute Skill/Characteristic, sous conditions d'aide plausible et d'Advance en Advanced Skill ; exemple Brokk/Salundra, jet 61 inversé en 16 — topic **Getting Help**.
- `CRB 004 l.33` — lecture du d100 : dé des dizaines + dé des unités, deux `0` = 100.
- `CRB 025 l.9-10` — dépenses de Fortune : gagner Advantage sur un Test **avant** de lancer (l.9) ; relancer un Test en gardant le nouveau résultat (l.10).
- `CRB 076 l.91-99` — **THE GM'S TEST TOOLKIT** : tous les modificateurs de SL s'appliquent après le lancer (l.91) ; l'inversion vient de Momentum, de certains Talents, Spells et Miracles, et de la dépense de Fortune, et le GM ne devrait presque jamais l'accorder hors des cas prévus (l.95) ; **Reroll** = on garde obligatoirement le second résultat (l.97) ; **Rolling a Double** = même chiffre sur le dé des dizaines et celui des unités (l.99).
- `CRB 116 l.13-15` — **Appendix I, Advantage and Momentum** : l'Advantage des matériels 4e se lit Momentum, y compris à la perte et à la dépense ; l'Advantage 5e est l'échange des chiffres du dé quand il profite.
- `CRB 067 l.410`, `CRB 086 l.272`, `CRB 114 l.87` — les **trois** occurrences résiduelles de `lose Advantage` dans le CRB 5e (Miracle *Heart of Winter*, Weapon Quality *Trap Blade*, Creature Trait *Furious Assault*).

> « Sometimes a rule, ability, or circumstance will grant you Advantage or Disadvantage on a Test. When making a Test with Advantage, you may reverse the digits of a roll if that would improve your result, so a 71 could become a 17. When making a Test with Disadvantage, you must reverse the digits if the result would be worse, so a 19 becomes a 91. » — `CRB 024 l.48`

> « Advantage and Disadvantage cancel each other out. If you have multiple sources of Advantage, each one after the first grants +1 SL, while multiple sources of Disadvantage inflict -1 SL. » — `CRB 024 l.50`

> « Molli's Stealth (Urban) Skill is 46 and she rolls a 72. Normally this would be a failure, but Advantage allows her to reverse the numbers for a result of 27 — a success! » — `CRB 024 l.128`

> « Disadvantage works the same way, but you must reverse the results if they would be worse. So if Molli suffered from Disadvantage on a Test, then a roll of 18 would be reversed to result in an 81 instead. » — `CRB 024 l.130`

> « This ability to reverse the numbers in your roll comes from Momentum (page 167), certain Talents, Spells, and Miracles, and from spending Fortune. The GM should almost never grant Advantage or inflict Disadvantage when the rules do not specifically call for it. » — `CRB 076 l.95`

> « A reroll is when you disregard the result of a dice roll, and roll it again. You must use the second result. Some Talents allow you to reroll, as does spending a point of Fortune. » — `CRB 076 l.97`

> « Rolling a double means both the tens and the units die roll the same number (11, 22, 33, 44 and so on). » — `CRB 076 l.99`

> « The rules also use 1d100, a roll from 1–100 made with two d10s. Designate one die as the tens die and the other as the units die, then read the results as a two-digit number. » — `CRB 004 l.33`

**Voir aussi** :

- [ROLL DICE — le d100 et le calcul du Success Level (SL)](#roll-dice--le-d100-et-le-calcul-du-success-level-sl) — calcul des SL, *Marginal Success* / *Marginal Failure*
- [DIFFICULTY AND CHARACTER MODIFIERS — DIFFICULTY TABLE](#difficulty-and-character-modifiers--difficulty-table) — combinaison des modificateurs de SL
- [SL Modifiers — origine, moment d'application et marge du GM](#sl-modifiers--origine-moment-dapplication-et-marge-du-gm)
- [CRITICALS AND FUMBLES — le double](#criticals-and-fumbles--le-double)
- [AUTOMATIC SUCCESS AND FAILURE — 01-05 et 96-100](#automatic-success-and-failure--01-05-et-96-100)
- [OPPOSED TESTS — les Tests opposés](#opposed-tests--les-tests-opposés)
- [Getting Help — se faire aider sur un Test](#getting-help--se-faire-aider-sur-un-test) — exemple Brokk/Salundra
- [DARKNESS AND TESTS — l'obscurité et les Tests fondés sur la vue](#darkness-and-tests--lobscurité-et-les-tests-fondés-sur-la-vue)
- [Fortune — Spend a Fortune Point to: et Replenishing Fortune](#fortune--spend-a-fortune-point-to-et-replenishing-fortune) — Fortune dépensée pour gagner Advantage, et définition du **Reroll**
- aire `combat` (fiche à extraire) — **Momentum**, source d'Advantage en Melee (`CRB 037`)
- aire `conversion` (fiche à extraire) — **Appendix I**, conversion 4e → 5e (`CRB 116`)

**Implémente :** (non implémenté)
- dette : #1873

---

## DARKNESS AND TESTS — l'obscurité et les Tests fondés sur la vue

L'obscurité n'est pas un modificateur de SL dans le chapitre des Tests : c'est un **Disadvantage**. Le
déclencheur porte sur la **cible**, pas sur l'acteur — « If your target is in darkness ». Trois
familles de Tests, et elles seules, sont visées : **Melee Tests**, **Ranged Tests**, et les
**Perception Tests based on sight** (`CRB 024 l.27`).

> « If your target is in darkness, Melee Tests, Ranged Tests, and Perception Tests based on sight
> incur Disadvantage. Sources of illumination (see **Chapter 11: Consumer Guide**), as well as
> Talents and Traits such as Darkvision (page 357) may mitigate this. » — `CRB 024 l.27`

La restriction « based on sight » est nécessaire parce que la Skill **Perception (I)** couvre
l'ensemble des sens — « sight, smell, hearing, touch, taste, and any other senses you may possess,
such as magical or inhuman senses » (`CRB 020 l.183`). Un Perception Test d'écoute ou d'odorat dans
le noir n'est donc **pas** affecté par cette règle : seul l'usage fondé sur la vue l'est.

Deux catégories de facteurs **atténuent** (« may mitigate this ») l'obscurité (`CRB 024 l.27`) :
1. les **sources of illumination**, renvoyées au **Chapter 11: Consumer Guide** ;
2. les **Talents and Traits such as Darkvision (page 357)**.

### Ce que l'obscurité produit, et ce qui relève de la mécanique générale

L'obscurité compte comme **une** source de Disadvantage. Conséquence propre : seule, elle n'inflige
**aucun** malus de SL — elle force uniquement l'inversion des chiffres du jet quand le résultat en
devient pire (un 19 devient un 91), et une seule source d'Advantage suffit à l'annuler.

Le reste — définition de l'inversion des chiffres, annulation mutuelle, ±1 SL par source
surnuméraire — est la mécanique générale **ADVANTAGE AND DISADVANTAGE** (`CRB 024 l.46-50`) et vit
chez son porteur :
[ADVANTAGE AND DISADVANTAGE — inversion des chiffres et cumul](#advantage-and-disadvantage--inversion-des-chiffres-et-cumul).
Rien n'en est redit ici.

### Ce qui atténue l'obscurité — renvois, valeurs chiffrées seules

Aucune de ces règles n'est transcrite ici : seule la **valeur chiffrée** qui permet de dire si une
cible est ou non `in darkness` est retenue.

- Creature Trait **Dark Vision** (page 357 ; le chapitre des Tests écrit `Darkvision`) — `CRB 115 l.80-82`, aire `bestiaire`.
- **Night Vision**, Talent et Creature Trait : 20 yards en obscurité naturelle, +20 yards à toute source de lumière — `CRB 021 l.430-432`, `CRB 115 l.188-190`, aires `talents` et `bestiaire`.
- Spells **Dark Vision** et **Light** — `CRB 070 l.477-483`, `CRB 070 l.281-287`, aire `magie`.
- Rayons des sources d'illumination : Candle 2 yards, Lantern 10, Storm Lantern 10 (20 en faisceau), Torch 10 — `CRB 100 l.48-64`, aire `equipement`.

Fiches à extraire.

### Silences et bornes du RAW (à ne pas combler par invention)

- Le livre **ne définit aucune échelle de pénombre** dans le chapitre des Tests : il n'existe que
  l'état binaire « in darkness » ou non. L'échelle fine (« Fog or poor lighting », « pitch
  blackness ») n'apparaît que dans la table des modificateurs de tir, à l'aire `combat` (fiche à extraire).
- Le déclencheur est la **cible**, jamais la source de lumière portée par l'acteur. Le cas d'un
  personnage torche en main qui vise une cible restée hors du rayon éclairé n'est pas réglé : le
  texte dit seulement que les sources d'illumination `may mitigate this` (`CRB 024 l.27`).
  **Silence RAW.**
- La règle **ne prévoit pas** de Disadvantage pour les Tests non listés (Stealth, Climb, Ride,
  Lore…), même exécutés dans le noir ; l'extension de la gêne visuelle à ces Tests n'existe que via
  la Condition *Blinded*, qui est une autre règle (aire `etats` (fiche à extraire), `CRB 042 l.59-63`).
- **Aucune interaction cumulative** n'est écrite entre le Disadvantage d'obscurité et les pénalités
  de SL de lumière du combat : ce sont deux effets de nature différente, et le RAW ne les fusionne
  pas.
- Le RAW ne dit **pas** si une source d'illumination éclaire la cible, l'acteur, ou les deux : il ne
  pose qu'un rayon en yards autour de la source. Aucune règle de ligne de vue ni d'ombre portée
  n'existe dans le livre.

**Sources RAW** :
- `CRB 024 l.25-27` — section **DARKNESS AND TESTS** : cible dans l'obscurité → Disadvantage aux
  Melee Tests, Ranged Tests et Perception Tests based on sight ; atténuation par les sources
  d'illumination (renvoi Chapter 11: Consumer Guide) et par les Talents/Traits tels que Darkvision
  (page 357)
- `CRB 024 l.46-50` — **ADVANTAGE AND DISADVANTAGE** : mécanique générale, **portée par le topic
  ADVANTAGE AND DISADVANTAGE** ; ici, seule compte la conséquence propre à l'obscurité (une source
  unique ⇒ inversion forcée, aucun malus de SL)
- `CRB 020 l.181-183`, `CRB 021 l.430-432`, `CRB 036 l.160`, `CRB 042 l.59-63`, `CRB 070 l.281-287`, `CRB 070 l.477-483`, `CRB 100 l.48-64`, `CRB 115 l.80-82`, `CRB 115 l.188-190` — renvois hors foyer, détaillés ci-dessus et au Voir aussi

**Voir aussi** :

- [ADVANTAGE AND DISADVANTAGE — inversion des chiffres et cumul](#advantage-and-disadvantage--inversion-des-chiffres-et-cumul) — PORTEUR de la mécanique (inversion des chiffres, annulation mutuelle, ±1 SL par source surnuméraire, `CRB 024 l.46-50`)
- [MAKING A TEST — déclenchement et procédure du Test](#making-a-test--déclenchement-et-procédure-du-test) — la borne d'Advance et le choix de la valeur testée
- aire `combat` (fiche à extraire) — table **RANGED ATTACK MODIFIERS**, lumière et temps (`CRB 036 l.153-161`)
- aire `etats` (fiche à extraire) — Condition **Blinded** (`CRB 042 l.59-63`)
- aire `talents` (fiche à extraire) — **Night Vision**, **Acute Sense (Sense)** (`CRB 021 l.430-432`, `l.11-13`)
- aire `bestiaire` (fiche à extraire) — Creature Traits **Dark Vision** / **Night Vision**
- aire `magie` (fiche à extraire) — Spells **Dark Vision** et **Light**
- aire `equipement` (fiche à extraire) — **Miscellaneous Trappings**, prix et encombrement des sources d'illumination
- aire `competences` (fiche à extraire) — Skill **Perception (I)**

**Implémente :** (non implémenté)
- dette : #1873

---

## SL Modifiers — origine, moment d'application et marge du GM

> **Frontière — ce que ce topic NE porte PAS.** Le bloc **DIFFICULTY AND CHARACTER MODIFIERS**
> (`CRB 024 l.52-59`), la **DIFFICULTY TABLE** et la Difficulty par défaut Challenging
> (`CRB 024 l.61-73`) ont un porteur unique :
> [DIFFICULTY AND CHARACTER MODIFIERS — DIFFICULTY TABLE](#difficulty-and-character-modifiers--difficulty-table)
> — ni la règle de composition ni ses citations ne sont recopiées ici. De même :
> **MODIFIERS AND 0 SL** (`CRB 024 l.18-23`) →
> [ROLL DICE — le d100 et le calcul du Success Level (SL)](#roll-dice--le-d100-et-le-calcul-du-success-level-sl) ·
> **AUTOMATIC SUCCESS AND FAILURE** (`CRB 024 l.33-35`) →
> [AUTOMATIC SUCCESS AND FAILURE — 01-05 et 96-100](#automatic-success-and-failure--01-05-et-96-100) ·
> **CRITICALS AND FUMBLES** (`CRB 024 l.37-44`) →
> [CRITICALS AND FUMBLES — le double](#criticals-and-fumbles--le-double) ·
> **ADVANTAGE AND DISADVANTAGE** (`CRB 024 l.46-50`, `CRB 076 l.93-95`) →
> [ADVANTAGE AND DISADVANTAGE — inversion des chiffres et cumul](#advantage-and-disadvantage--inversion-des-chiffres-et-cumul) ·
> **EXTENDED TESTS** (`CRB 076 l.101-115`) →
> [EXTENDED TESTS — les Tests étendus](#extended-tests--les-tests-étendus) ·
> **DIFFICULTY TABLE** de conversion (`CRB 116 l.21-31`) → aire `conversion` (fiche à extraire).
> Ce topic ne porte que ce qu'aucun autre ne porte : **le régime des SL Modifiers** — leur
> **origine complète**, le **moment** où ils s'appliquent, la **marge du GM**, et la **lecture**
> des notations héritées de la 4e restées dans le livre.

**La boîte à outils du GM cadre le sujet.** La section **THE GM'S TEST TOOLKIT** (`CRB 076 l.85`)
présente les composantes d'un Test comme autant d'outils de réglage fin du défi proposé aux joueurs :
« *There are several components of a Test, all of which are tools for the GM to use in fine-tuning the
challenge presented to the Players.* » (`CRB 076 l.87`). La première de ces composantes est intitulée
**SL Modifiers** (`CRB 076 l.89`) ; la seconde, **Advantage and Disadvantage** (`CRB 076 l.93`), en est
**distincte** — ce n'est pas un modificateur de SL (voir plus bas).

**Origine des SL Modifiers — la liste complète.** Le chapitre des règles en nomme deux familles
(Difficulty fixée par le GM ; modificateurs du personnage issus des Talents, de l'équipement, des
Spells et d'autres effets — `CRB 024 l.56-57`, transcrits au topic **DIFFICULTY AND CHARACTER
MODIFIERS**). Le chapitre du
GM énonce la même origine **plus largement** : « *These come from the Test's Difficulty **and
circumstances**, or from a Character's Talents, equipment, and abilities.* » (`CRB 076 l.91`). Un
écart à retenir, et il est le cœur de ce topic :

- la première famille **absorbe aussi les *circumstances*** — un modificateur peut venir de la
  situation sans passer par un degré nommé de la **DIFFICULTY TABLE** ;

**Ce que recouvre concrètement *Character's modifiers*.** Le livre en fournit des occurrences dans les trois catégories qu'il nomme, toujours exprimées en SL — Talents *Hatred (Group)* et *Strong Back* (`CRB 021 l.310`, `l.648`), Spell *Beast Tongue* (`CRB 071 l.43`), consommable *Digestive Tonic* (`CRB 097 l.31`) —, et un modificateur peut être **négatif** et venir d'un tiers : Talent *Argumentative* (`CRB 021 l.47`). Aires `talents`, `magie`, `equipement` (fiches à extraire). Le RAW précise que ces modificateurs figurent sur la Character Sheet
(`CRB 024 l.57`, porteur : topic **DIFFICULTY AND CHARACTER MODIFIERS**).

**Moment d'application — APRÈS le jet.** C'est la règle propre de ce topic, et elle est explicite :
« *All SL Modifiers are applied after the dice are rolled.* » (`CRB 076 l.91`). Conséquences directes,
toutes lisibles au RAW :

1. **Le seuil ne bouge jamais.** Le d100 se compare toujours à la valeur **nue** du Skill ou de la
   Characteristic (`CRB 024 l.13`, porteur : topic **ROLL DICE**) : aucune Difficulty, aucun
   modificateur du personnage ne se reporte sur la valeur testée avant le lancer.
2. **Le SL brut se calcule d'abord**, puis les modificateurs s'y ajoutent ; c'est le SL **après**
   modificateurs qui décide de la réussite, jamais le seul rapport dé/Skill. L'exemple **Typical Test**
   déroule exactement cet ordre et montre en outre la GM **fixer elle-même** la Difficulty de l'action
   que la joueuse vient de décrire (`CRB 024 l.116` ; déroulé chiffré au topic **ROLL DICE**).
3. **Le rapport dé/Skill survit néanmoins** à la composition pour deux arbitrages, tous deux hors de
   ce topic : le **signe d'un total nul** (renvoi nommé — topic **ROLL DICE**, **MODIFIERS AND 0
   SL**) et les **bornes extrêmes** 96-100 / 01-05, que le final SL modifier peut aggraver ou
   améliorer mais jamais retourner (renvoi nommé — topic **AUTOMATIC SUCCESS AND FAILURE**).

**Ce que le total composé décide en plus.** Sur un double, c'est le SL **final** — donc composé — qui
est lu, si bien que les modificateurs de Difficulty et du personnage peuvent faire basculer un même
double de Fumble en Critical Success, ou l'inverse. La règle et sa citation appartiennent au porteur
topic **CRITICALS AND FUMBLES** (`CRB 024 l.37-44`), exception des Melee Tests en combat
comprise ; ce topic n'en retient que la conséquence propre à son sujet : **la composition décide du
sens de la bascule.**

**Marge discrétionnaire du GM — plafonnée à +1 SL.** Au-delà des degrés de la table, le RAW ouvre une
récompense d'à-propos et la borne : « *The GM determines the Difficulty, and may award up to +1 SL for
a particularly clever approach.* » (`CRB 076 l.91`). Le plafond est donc de **+1 SL**, et il porte sur
l'approche, pas sur le résultat. Cette latitude contraste avec celle, quasi nulle, qui encadre
Advantage et Disadvantage (`CRB 076 l.95`, porteur : topic **ADVANTAGE AND DISADVANTAGE**).

**Ce qui n'est PAS un modificateur de SL : Advantage et Disadvantage.** La boîte à outils les traite en
composante distincte (`CRB 076 l.89` contre `CRB 076 l.93`) : ils agissent en renversant les chiffres
du jet, donc **avant** la comparaison au Skill, et non sur le SL. Renvoi nommé —
topic **ADVANTAGE AND DISADVANTAGE** (`CRB 024 l.46-50`). Seule conséquence locale à retenir ici : les sources
**surnuméraires**, après annulation mutuelle, se convertissent en **±1 SL** par source au-delà de la
première (`CRB 024 l.50`) — c'est par ce seul canal qu'Advantage alimente la composition des SL
Modifiers.

**Dans un Extended Test, le réglage se refait par tentative.** Le GM y fixe le Skill et la Difficulty
ou les autres modificateurs de SL **pour chaque tentative**, en général identiques mais révisables au
fil de la tâche. Renvoi nommé — topic **EXTENDED TESTS** (`CRB 076 l.109`).

**Lecture des notations héritées de la 4e.** Le matériel WFRP 4e exprime la Difficulty comme un
modificateur **à la valeur du Skill** (+60, −30…) et non comme un modificateur de SL. La règle de
lecture est une conversion mécanique :

> « *The Difficulty of a Test is now expressed differently, applying an SL modifier rather than changed
> the value of the Skill being Tested. The following table makes this clear, but simply removing the
> '0' gives the correct SL modifier.* » — `CRB 116 l.19`

Cette conversion ne sert pas qu'aux anciens suppléments : **le CRB 5e lui-même conserve quatre
occurrences résiduelles de l'ancienne notation**, qui se lisent toutes par cette règle —

| Occurrence verbatim | Où | À lire |
|---|---|---|
| **Average (+20) Psychology** | *Blackpowder* Weapon Quality — `CRB 086 l.208` | Average (+2 SL) |
| **Very Hard (–30) Strength** | *Trap Blade* Weapon Quality — `CRB 086 l.272` | Very Hard (−3 SL) |
| **Very Hard (-30) Consume Alcohol** | *Dwarf Ale* — `CRB 090 l.26` | Very Hard (−3 SL) |
| **Average (+20) Cool** | *Quack Cure*, QUACK REMEDIES table — `CRB 097 l.28` | Average (+2 SL) |

La **table de correspondance complète** ancienne expression → modificateur de SL (`CRB 116 l.21-31`)
appartient à l'aire `conversion` (fiche à extraire) ; elle n'est pas recopiée ici.

**Sources RAW** :
- `CRB 076 l.85-87` — **THE GM'S TEST TOOLKIT** : les composantes d'un Test sont autant d'outils de réglage fin du défi proposé aux joueurs.
- `CRB 076 l.89` — intitulé **SL Modifiers** : première composante du Test, distincte de la suivante.
- `CRB 076 l.91` — **régime complet des SL Modifiers** : origine (Difficulty du Test **et circumstances**, ou Talents / équipement / capacités du personnage), le GM fixe la Difficulty, peut accorder **jusqu'à +1 SL** pour une approche particulièrement astucieuse, et **tous** les modificateurs de SL s'appliquent **après** le jet de dés.
- `CRB 076 l.93` — intitulé **Advantage and Disadvantage** : composante **distincte** des SL Modifiers (règle au topic **ADVANTAGE AND DISADVANTAGE**).
- `CRB 024 l.52-59` — bloc **DIFFICULTY AND CHARACTER MODIFIERS** : deux familles et règle de composition en un **final SL modifier** — transcrit au topic **DIFFICULTY AND CHARACTER MODIFIERS** ; ici, seulement l'écart avec l'énumération plus large de `CRB 076 l.91`.
- `CRB 024 l.13` — le d100 se compare à la valeur nue du Skill (topic **ROLL DICE**) : c'est ce que confirme l'application des modificateurs après le jet.
- `CRB 024 l.116` — exemple **Typical Test** : la GM fixe elle-même la Difficulty de l'action décrite, et l'ordre SL brut → ajout de la Difficulty y est explicite (déroulé chiffré au topic **ROLL DICE**).
- `CRB 024 l.50` — cumul d'Advantage / Disadvantage : seules les sources au-delà de la première valent ±1 SL, et c'est par là seulement qu'elles alimentent la composition (règle et citation au topic **ADVANTAGE AND DISADVANTAGE**).
- `CRB 021 l.47`, `CRB 021 l.310`, `CRB 021 l.648`, `CRB 071 l.43`, `CRB 097 l.31` — exemples de modificateurs du personnage cités ci-dessus (Talent, Spell, équipement) — aires `talents`, `magie`, `equipement`
- `CRB 076 l.109` — **Extended Tests**, *Choose the Test* : Skill et Difficulty ou autres modificateurs de SL fixés **pour chaque tentative** (topic **EXTENDED TESTS**).
- `CRB 116 l.19` — **Test Difficulty** (Appendix I) : retirer le « 0 » — aire `conversion`
- `CRB 086 l.208` · `CRB 086 l.272` · `CRB 090 l.26` · `CRB 097 l.28` — les quatre occurrences résiduelles de l'ancienne notation (table ci-dessus).

> « *There are several components of a Test, all of which are tools for the GM to use in fine-tuning the challenge presented to the Players.* » — `CRB 076 l.87`

> « *These come from the Test's Difficulty and circumstances, or from a Character's Talents, equipment, and abilities. The GM determines the Difficulty, and may award up to +1 SL for a particularly clever approach. All SL Modifiers are applied after the dice are rolled.* » — `CRB 076 l.91`

**Voir aussi** :

- [DIFFICULTY AND CHARACTER MODIFIERS — DIFFICULTY TABLE](#difficulty-and-character-modifiers--difficulty-table) — porteur unique du bloc, de la table et du défaut Challenging (`CRB 024 l.52-73`)
- [ROLL DICE — le d100 et le calcul du Success Level (SL)](#roll-dice--le-d100-et-le-calcul-du-success-level-sl) — jet, SL brut, **MODIFIERS AND 0 SL**, déroulé chiffré du **Typical Test** (`CRB 024 l.11-23`, `l.116`)
- [AUTOMATIC SUCCESS AND FAILURE — 01-05 et 96-100](#automatic-success-and-failure--01-05-et-96-100) (`CRB 024 l.33-35`)
- [CRITICALS AND FUMBLES — le double](#criticals-and-fumbles--le-double) — le SL **final** décide Critical / Fumble (`CRB 024 l.37-44`)
- [ADVANTAGE AND DISADVANTAGE — inversion des chiffres et cumul](#advantage-and-disadvantage--inversion-des-chiffres-et-cumul) (`CRB 024 l.46-50`, `CRB 076 l.93-95`)
- [EXTENDED TESTS — les Tests étendus](#extended-tests--les-tests-étendus) — Set the Goal / Choose the Test / Track Progress (`CRB 024 l.106-108`, `CRB 076 l.101-115`)
- [MAKING A TEST — déclenchement et procédure du Test](#making-a-test--déclenchement-et-procédure-du-test) — qui déclenche le Test et choisit le Skill (`CRB 024 l.3-9`)
- [OUTCOMES TABLE — lecture du SL final](#outcomes-table--lecture-du-sl-final) (`CRB 024 l.85-104`)
- [OPPOSED TESTS — les Tests opposés](#opposed-tests--les-tests-opposés) (`CRB 024 l.75-79`, `CRB 076 l.75-77`)
- [DARKNESS AND TESTS — l'obscurité et les Tests fondés sur la vue](#darkness-and-tests--lobscurité-et-les-tests-fondés-sur-la-vue) (`CRB 024 l.25-27`)
- [Getting Help — se faire aider sur un Test](#getting-help--se-faire-aider-sur-un-test) (`CRB 024 l.138-144`)
- aire `conversion` (fiche à extraire) — **DIFFICULTY TABLE** de correspondance ancienne expression → modificateur de SL (`CRB 116 l.17-31`)

**Implémente :** (non implémenté)
- dette : #1873

---

## DIFFICULTY AND CHARACTER MODIFIERS — DIFFICULTY TABLE

**Porteur unique.** Ce topic porte l'intégralité du bloc **DIFFICULTY AND CHARACTER MODIFIERS** (`CRB 024 l.52-73`) : la règle de composition et la **DIFFICULTY TABLE** ne se séparent pas — la table n'est lisible qu'avec l'addition qui lui donne son sens. Aucun autre topic de la fiche ne rejoue ces lignes : **MAKING A TEST** et **ROLL DICE** décrivent la séquence du jet et le calcul du **SL brut**, et pointent ici pour tout ce qui modifie ce SL.

En 5e, la Difficulty d'un Test **ne modifie plus la valeur de Skill ou de Characteristic** : elle applique un **modificateur de Success Level (SL)** au résultat du jet. Le livre l'énonce sous le titre **DIFFICULTY AND CHARACTER MODIFIERS** : « The Success Level of a Test can be modified by how difficult it is to succeed, or by the Character's abilities and equipment » (`CRB 024 l.54-56`). Le d100 se compare donc toujours à la valeur **nue** de la Skill ou de la Characteristic — « Player rolls the dice, a d100, trying to get equal or lower than their Skill » (`CRB 024 l.13`) —, et la Difficulty n'intervient qu'**après**, sur le SL.

Deux sources de modificateurs, et une seule addition :

- la **Difficulty**, fixée par le GM — une tâche plus facile donne un **bonus de SL**, une tâche plus dure une **pénalité de SL** (renvoi explicite à la **Difficulty Table**) (`CRB 024 l.56`) ;
- les **Character's modifiers**, qui viennent des **Talents, de l'équipement, des Spells et d'autres effets**, et qui « will be clear on the player's Character Sheet » (`CRB 024 l.57`).

On **combine** les bonus/pénalités de SL de la Difficulty avec ceux du personnage pour obtenir **le modificateur de SL final du jet** ; le livre souligne que ce total peut « turn a success into a failure, or prise victory from the jaws of defeat! » (`CRB 024 l.59`). Le résumé du chapitre le redit en une ligne : « Difficulty or Character modifiers adjust the SL » (`CRB 024 l.88`).

L'échelle compte **sept degrés**, de **Very Easy (+6 SL)** à **Very Hard (–3 SL)**. Elle est **asymétrique** : le versant facile monte par pas de 2 SL (+6 / +4 / +2), le versant difficile descend par pas de 1 SL (–1 / –2 / –3), le pivot **Challenging** valant **+0**. Chaque degré est illustré par un exemple d'action dans la table elle-même.

**Difficulty par défaut.** « If a difficulty is not specified, you should assume it is Challenging (+0 SL). Most Tests made during Combat are Challenging (+0 SL). » (`CRB 024 l.73`). C'est la règle qui rend la table utilisable sans arbitrage : tout Test dont la source ne dit rien est **Challenging**, et le combat est **par défaut** Challenging — cohérent avec la ligne *Challenging* de la table, dont l'exemple est précisément « Typical Ranged and Melee attack Tests ».

#### DIFFICULTY TABLE

| Difficulty  | Test Modifier | Example                                                         |
|-------------|------------------|-----------------------------------------------------------------|
| Very Easy   | +6 SL            | Noticing the obvious, jumping a small gap                    |
| Easy        | +4 SL            | Sharpening the edge of a trusty blade                           |
| Average     | +2 SL            | Quickly finding pertinent information in a book you can read |
| Challenging | +0               | Typical Ranged and Melee attack Tests, climbing a stone wall |
| Difficult   | –1 SL            | Recalling an obscure fact about a long-dead noble            |
| Hard        | –2 SL            | Swimming upstream in a flooding sewer                        |
| Very Hard   | –3 SL            | Convincing a witch hunter they've made a terrible mistake    |

— `CRB 024 l.61-71`

**Lecture de la cellule *Challenging*.** La table imprime **`+0`** sans l'unité. Le corps de règle
immédiatement en dessous écrit deux fois `Challenging (+0 SL)` (`CRB 024 l.73`), et les exemples de
jeu du même chapitre font de même (`CRB 024 l.134`, `CRB 024 l.144`).

**Notation canonique en jeu.** Partout dans le livre, une Difficulty se cite sous la forme
**`<Difficulty> (<modifier> SL) <Skill or Characteristic>`** — p. ex. « an **Average (+2 SL)
Stealth (Urban)** Test » (`CRB 024 l.116`) ou « a **Difficult (-1 SL) Athletics** Test »
(`CRB 024 l.122`). Le degré et sa valeur voyagent ensemble.

**Bornes de l'échelle.** L'échelle est traitée ailleurs comme **bornée**, ses extrémités servant de
plafond ou de plancher imposé : Talent *Scale Sheer Surface* (`CRB 021 l.554`, aire `talents`),
résultats *Excommunication* et *I Cast You Out* de la table des courroux divins (`CRB 065 l.70`,
`CRB 065 l.72`, aire `religion`) — fiches à extraire. Ce que ces emplois établissent ici :
**Very Hard (–3 SL)** est bien le dernier degré.

### Expression héritée de la 4e

Le CRB est déclaré compatible avec le matériel de la 4e (`CRB 116 l.7`), et l'**Appendix I** donne la
règle de lecture : « The Difficulty of a Test is now expressed differently, applying an SL modifier
rather than changed the value of the Skill being Tested. The following table makes this clear, but
simply removing the '0' gives the correct SL modifier. » (`CRB 116 l.19`). La **DIFFICULTY TABLE** de
conversion (`CRB 116 l.21-31`) appartient à l'aire `conversion` (fiche à extraire) ; elle n'est pas
recopiée ici, et le recensement des **quatre** occurrences résiduelles de la notation 4e dans le
corps du CRB vit au topic
[SL Modifiers — origine, moment d'application et marge du GM](#sl-modifiers--origine-moment-dapplication-et-marge-du-gm).

**Défaut de transcription de la source** (constat, pas règle) : la table de `116 - Appendix I.md`
porte une **troisième colonne vide** et une **ligne vide finale** (`CRB 116 l.23-32`). Sa cellule
*Meaning* du pivot imprime `Challenging (+ SL)`, unité amputée de son zéro, là où le corps de règle
écrit `Challenging (+0 SL)` (`CRB 024 l.73`).

**Où vivent les exemples de Difficulty.** Le chapitre des Tests ne donne qu'**une** ligne d'exemple par
degré (table ci-dessus). Les tables d'exemples détaillées, degré par degré et par type d'action,
vivent dans les chapitres d'application : aires `intrigue`, `social`, `enquete`, `deplacement`
(fiches à extraire) — `CRB 027 l.50-58`, `CRB 028 l.44-52`, `CRB 029 l.45-55`, `CRB 030 l.15-21`,
`CRB 032 l.29-35`.

**Sources RAW** :
- `CRB 024 l.13` — le d100 se compare à la valeur **nue** : « trying to get equal or lower than their Skill ».
- `CRB 024 l.52-54` — **DIFFICULTY AND CHARACTER MODIFIERS** : la Difficulty et les capacités du personnage modifient le **Success Level** du Test, pas la valeur testée.
- `CRB 024 l.56` — la Difficulty est fixée par le GM ; tâche plus facile = bonus de SL, plus dure = pénalité de SL ; renvoi à la **Difficulty Table**.
- `CRB 024 l.57` — les modificateurs du personnage viennent des **Talents, equipment, Spells, and other effects**, portés par la Character Sheet.
- `CRB 024 l.59` — on **combine** Difficulty et modificateurs du personnage en un **modificateur de SL final** unique.
- `CRB 024 l.61-71` — **DIFFICULTY TABLE** : les sept degrés, leur **Test Modifier** et leur exemple d'action (table transcrite ci-dessus).
- `CRB 024 l.73` — Difficulty non spécifiée ⇒ **Challenging (+0 SL)** ; la plupart des Tests en combat sont **Challenging (+0 SL)**.
- `CRB 024 l.88` — **SUMMARY & OUTCOME** : « Difficulty or Character modifiers adjust the SL ».
- `CRB 024 l.116`, `CRB 024 l.122`, `CRB 024 l.134`, `CRB 024 l.144` — exemples joués qui fixent la notation `<Difficulty> (<mod> SL)` et confirment `Challenging (+0 SL)`.
- `CRB 021 l.554` — Talent *Scale Sheer Surface* : borne haute utilisée comme plafond imposé (aire `talents`).
- `CRB 065 l.70`, `CRB 065 l.72` — *Excommunication* et *I Cast You Out* : Difficulty imposée **et verrouillée** (aire `religion`).
- `CRB 116 l.7` — compatibilité déclarée avec le matériel de la 4e édition.
- `CRB 116 l.19-32` — Appendix I : règle du « 0 » retiré et **DIFFICULTY TABLE** de conversion (défauts de transcription ci-dessus) — aire `conversion`

> « Not all Tests are as simple as the one above. The Success Level of a Test can be modified by how difficult it is to succeed, or by the Character's abilities and equipment » — `CRB 024 l.54`

> « Combine any SL bonuses or penalties from the Difficulty with the Character's modifiers to arrive at the final SL modifier for the roll. This could turn a success into a failure, or prise victory from the jaws of defeat! » — `CRB 024 l.59`

> « If a difficulty is not specified, you should assume it is Challenging (+0 SL). Most Tests made during Combat are Challenging (+0 SL). » — `CRB 024 l.73`

**Voir aussi** :

- [MAKING A TEST — déclenchement et procédure du Test](#making-a-test--déclenchement-et-procédure-du-test) — séquence du Test
- [ROLL DICE — le d100 et le calcul du Success Level (SL)](#roll-dice--le-d100-et-le-calcul-du-success-level-sl) — calcul du SL **brut**, avant tout modificateur
- [SL Modifiers — origine, moment d'application et marge du GM](#sl-modifiers--origine-moment-dapplication-et-marge-du-gm) — origine complète, moment d'application, notations 4e résiduelles
- [OUTCOMES TABLE — lecture du SL final](#outcomes-table--lecture-du-sl-final)
- [OPPOSED TESTS — les Tests opposés](#opposed-tests--les-tests-opposés)
- [ADVANTAGE AND DISADVANTAGE — inversion des chiffres et cumul](#advantage-and-disadvantage--inversion-des-chiffres-et-cumul)
- [CRITICALS AND FUMBLES — le double](#criticals-and-fumbles--le-double)
- [AUTOMATIC SUCCESS AND FAILURE — 01-05 et 96-100](#automatic-success-and-failure--01-05-et-96-100)
- [EXTENDED TESTS — les Tests étendus](#extended-tests--les-tests-étendus)
- aire `conversion` (fiche à extraire) — **Appendix I** : Creature Traits, Advantage/Momentum, Resilience/Resolve, **DIFFICULTY TABLE** de conversion
- aires `intrigue`, `social`, `enquete`, `deplacement`, `artisanat` (fiches à extraire) — tables d'exemples de Difficulty par action (`CRB 027 l.50-58`, `CRB 028 l.44-52`, `CRB 029 l.45-55`, `CRB 030 l.15-21`, `CRB 032 l.29-35`, `CRB 031 l.9`, `CRB 031 l.58-64`)
- aires `talents` et `religion` (fiches à extraire) — effets qui imposent ou verrouillent un degré

**Implémente :** (non implémenté)
- dette : #1873

---

## OUTCOMES TABLE — lecture du SL final

L'**Outcomes Table** est la grille de lecture du SL final d'un Test : elle convertit le nombre de Success Levels obtenu, **après application de tous les modificateurs**, en un degré nommé (de `Astounding Success` à `Astounding Failure`) et en une description narrative du résultat. Elle ne dit pas *si* le Test est réussi — cela se lit au signe du SL, règle portée par le topic [ROLL DICE — le d100 et le calcul du Success Level (SL)](#roll-dice--le-d100-et-le-calcul-du-success-level-sl) — mais **à quel point** il l'est.

**Quand la consulter, et qui s'en sert.** Le plus souvent, il suffit de savoir si un Test est un succès ou un échec ; la table n'est consultée que lorsqu'il importe de savoir à quel point on a bien réussi ou mal échoué. C'est alors le GM qui se sert des descriptions de la table pour décider de ce qui se produit effectivement du fait de l'action (`CRB 024 l.91`).

**Ce qu'il faut avoir calculé AVANT d'entrer dans la table** — quatre règles qui vivent chacune à son topic, jamais re-transcrites ici :
- le signe du SL selon que le jet est inférieur/égal ou supérieur à la Skill, l'ajustement par la Difficulty et les modificateurs du personnage, et l'équivalence SL positif = succès / SL négatif = échec (section **SUMMARY & OUTCOME**, `CRB 024 l.87-89`) → [ROLL DICE — le d100 et le calcul du Success Level (SL)](#roll-dice--le-d100-et-le-calcul-du-success-level-sl) ;
- le départage des deux lignes à zéro, `+0` (`Marginal Success`) contre `–0` (`Marginal Failure`), quand des modificateurs de SL ramènent le résultat à 0 SL (section **MODIFIERS AND 0 SL**, `CRB 024 l.18-23`) → [ROLL DICE — le d100 et le calcul du Success Level (SL)](#roll-dice--le-d100-et-le-calcul-du-success-level-sl) ;
- les planchers d'entrée sur jets extrêmes — 96-100 et 01-05 (section **AUTOMATIC SUCCESS AND FAILURE**, `CRB 024 l.35`) → [AUTOMATIC SUCCESS AND FAILURE — 01-05 et 96-100](#automatic-success-and-failure--01-05-et-96-100) ;
- la bascule d'un double en Critical Success ou en Fumble, et la ligne de la table qu'elle impose, avec l'exception des Melee Tests en Combat (section **CRITICALS AND FUMBLES**, `CRB 024 l.39-44`) → [CRITICALS AND FUMBLES — le double](#criticals-and-fumbles--le-double).

**Test opposé : c'est la DIFFÉRENCE qui se lit dans la table.** Dans un Opposed Test, la différence entre les SL des deux camps est le SL du Test opposé, et c'est ce SL net qui désigne la ligne : l'exemple du livre donne `-1 SL` battant `-4 SL`, l'emportant de 3 SL, soit un `Impressive Success` (`CRB 024 l.77`). La résolution de l'opposition elle-même (qui gagne, l'égalité) est portée par le topic [OPPOSED TESTS — les Tests opposés](#opposed-tests--les-tests-opposés).

**Granularité des tranches.** Elles ne sont pas régulières : `+0` et `–0` sont chacune une ligne à elles seules, les degrés intermédiaires vont par paires (`+1 to +2`, `+3 to +4`, et leurs symétriques négatifs), et les lignes extrêmes sont ouvertes (`+5 or more`, `–5 or less`) — tout ce qui dépasse ±5 y est absorbé, un `+9 SL` se lisant exactement comme un `+5 SL`, `Astounding Success`.

**Déclinaisons par action.** Le noyau de règles annonce de nombreuses tables d'outcomes spécifiques à une variété d'actions, accompagnées de conseils d'emploi, plus loin dans le chapitre (`CRB 024 l.91`) ; ces applications spécifiques sont listées par `CRB 026 l.5-18` (Theft and Skullduggery, Flattery Bribery and Status, Nosing Around, Life Beyond the Walls, Cunning Crafts, Getting Around, Combat, Injury Healing and Death, Disease and Infection, Psychology, Conditions, Corruption and Mutation). L'Outcomes Table ci-dessous reste la table **générique**, applicable à défaut.

#### **OUTCOMES TABLE**

| SL            | Result                | Have You Succeeded?                                                                                                                                                                                                                          |
|---------------|-----------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| +5 or more | Astounding Success | Yes, perfectly!: The result is as good as it can be, perhaps with extra luck and fortunate coincidences thrown in!                                                                                                                     |
| +3 to +4   | Impressive Success | Yes, and…: You achieve your goal with style, exceeding your expectations.                                                                                                                                                                 |
| +1 to +2   | Success               | Yes: You achieve a solid success.                                                                                                                                                                                                            |
| +0            | Marginal Success   | Yes, but…: You more or less achieve what you intend, but imperfectly, and perhaps with an unpredictable side effect.                                                                                                                   |
| –0            | Marginal Failure   | No, but…: You marginally fail, perhaps accomplishing a portion of what you intended.                                                                                                                                                   |
| –1 to –2   | Failure               | No: You just plain do it wrong.                                                                                                                                                                                                              |
| –3 to –4   | Impressive Failure | No, and…: Not only do you mess up, but you also cause additional things to go wrong.                                                                                                                                                   |
| –5 or less | Astounding Failure | No, not in any way!: Everything goes wrong in the worst possible way. The GM will likely add to your woes with unanticipated consequences of your actions. Surely no one is this unlucky; you have clearly offended the gods. |

— `CRB 024 l.93-104`

**Sources RAW** :
- `CRB 024 l.93-104` — l'**OUTCOMES TABLE** intégrale : trois colonnes (`SL`, `Result`, `Have You Succeeded?`), huit lignes de `+5 or more` à `–5 or less`.
- `CRB 024 l.91` — quand consulter la table (seulement s'il importe de savoir à quel point on a réussi ou échoué), qui s'en sert (le GM, pour décider de ce qui arrive), et l'existence de tables d'outcomes spécifiques plus loin dans le chapitre.
- `CRB 024 l.77` — **OPPOSED TESTS** : la différence entre les SL est le SL du Test opposé, lu dans la table (exemple : l'emporter de 3 SL = `Impressive Success`).
- `CRB 026 l.5-18` — **USING THE RULES** : liste des douze sections d'application spécifique des règles, où vivent les tables d'outcomes dédiées.

> « Often, you will only need to know whether a Test results in a success or failure. If it's important to know just how well you have passed, or how badly you have failed, consult the **Outcomes Table** below. The GM uses the descriptions in the table to decide what happens as a result of your action. There are lots of example outcome tables for a variety of actions, along with specific advice on how to use the rules, later in this chapter. » — `CRB 024 l.91`

**Voir aussi** :

- [ROLL DICE — le d100 et le calcul du Success Level (SL)](#roll-dice--le-d100-et-le-calcul-du-success-level-sl) — signe du SL, soustraction des dizaines, départage `+0` / `–0`
- [AUTOMATIC SUCCESS AND FAILURE — 01-05 et 96-100](#automatic-success-and-failure--01-05-et-96-100) — planchers sur jets extrêmes
- [CRITICALS AND FUMBLES — le double](#criticals-and-fumbles--le-double) — Critical traité comme `Astounding`, Fumble comme `Astounding Failure`
- [OPPOSED TESTS — les Tests opposés](#opposed-tests--les-tests-opposés) — résolution, égalité au profit de l'initiateur
- [DIFFICULTY AND CHARACTER MODIFIERS — DIFFICULTY TABLE](#difficulty-and-character-modifiers--difficulty-table)
- [ADVANTAGE AND DISADVANTAGE — inversion des chiffres et cumul](#advantage-and-disadvantage--inversion-des-chiffres-et-cumul)
- [EXTENDED TESTS — les Tests étendus](#extended-tests--les-tests-étendus) — total courant de SL
- aires `intrigue`, `social`, `enquete`, `deplacement`, `artisanat`, `combat`, `traumatisme`, `maladies`, `psychologie`, `etats`, `corruption` (fiches à extraire) — tables d'outcomes spécifiques annoncées par `CRB 026 l.5-18`

**Implémente :** (non implémenté)
- dette : #1873

---

## OPPOSED TESTS — les Tests opposés

Une action **résistée** — chercher à passer furtivement devant quelqu'un, frapper un adversaire au corps à corps — se résout par un **Opposed Test** : chaque camp effectue son propre Test, et on compare les SL (`CRB 024 l.77`). C'est l'un des deux déclencheurs de jet posés à l'ouverture du chapitre : on ne teste que lorsque l'issue est incertaine **ou** contestée par un autre personnage (`CRB 023 l.5`).

**Résolution** :
1. Chaque participant effectue son Test (Skill ou Characteristic désignée par le GM), avec sa Difficulty et ses modificateurs propres, et calcule son SL final comme pour n'importe quel Test.
2. **C'est le plus haut SL qui l'emporte** — « Whichever of you achieved the higher SL wins » (`CRB 024 l.77`).
3. **Réussir son propre Test n'est pas nécessaire** : il suffit de battre l'adversaire. Le livre donne l'exemple nu : `-1 SL` bat `-4 SL` (`CRB 024 l.77`).
4. **Le SL du Test opposé est la différence entre les deux SL** : `-1 SL` contre `-4 SL` donne une victoire de `3 SL`, que le livre qualifie d'**Impressive Success** (`CRB 024 l.77`). C'est ce SL net, et lui seul, qui sert de mesure de la victoire — et qui se lit sur l'**Outcomes Table** du même chapitre.
5. **Égalité : l'initiateur du jet l'emporte** — « In the case of a tie, whoever initiated the roll wins — in combat, the attacker. » (`CRB 024 l.79`). Il n'y a donc jamais de départage par la valeur de Skill ou de Characteristic, ni de relance.

**Difficulty** : le Test opposé n'a pas de Difficulty propre. Chaque camp applique la sienne, et à défaut d'indication elle vaut **Challenging (+0 SL)** ; la plupart des Tests faits en combat sont Challenging (+0 SL) (`CRB 024 l.73`).

**Aucune table n'est propre à cette règle** : la graduation du SL net (Astounding / Impressive / Success / Marginal…) se lit sur l'**OUTCOMES TABLE** (`CRB 024 l.93-104`), portée par le topic [OUTCOMES TABLE — lecture du SL final](#outcomes-table--lecture-du-sl-final).

**Conduite du Test opposé par le GM** : quelque chose doit toujours découler d'un Test opposé, y compris quand les deux SL sont identiques — « Something should always happen as a result of an Opposed Test. Even when both Characters achieve the same SL and the Test ends in a stalemate, use the result to point towards a way forward. » (`CRB 076 l.77`). Cette consigne est **narrative** : mécaniquement, l'égalité de SL reste tranchée en faveur de l'initiateur (`CRB 024 l.79`), et la consigne du chapitre du GM porte sur ce que l'on en fait à la table (remarquer une faiblesse, découvrir un indice, comprendre comment rompre l'impasse), pas sur la désignation du vainqueur.

### Test Example — Opposed Tests

Les deux exemples du livre, verbatim (`CRB 024 l.134-136`) :

> « Salundra attempts to strike down a rampaging orc in the midst of battle. As the orc is directly trying to stop her by parrying the blow, the roll is opposed. Salundra makes a **Challenging (+0 SL) Melee (Basic)** Test. Her Skill is 55, and she rolls a 23, scoring +3 SL. The orc is no pushover however, and manages to score +2 SL. Salundra wins the Test, but only scores +1 SL (3 - 2 = 1). She hits the orc, adding +1 to her usual Damage (see page 164 for how to calculate Damage). » — `CRB 024 l.134`

> « Incensed, the orc swings at Salundra on its turn. He rolls -2 SL, but Salundra scores a far worse -4 SL! Despite rolling more than his skill, the orc still wins the opposed Test with +2 SL (2-4 = 2). The blow is awkwardly made, but it connects, leaving Salundra injured and looking for a way out… » — `CRB 024 l.136`

Ce que chaque exemple démontre :
- **Premier exemple** — les deux camps réussissent (`+3 SL` contre `+2 SL`) ; le vainqueur ne conserve que le **SL net** (`+1 SL`), pas son SL brut, et c'est ce SL net qui alimente la suite (ici les dégâts).
- **Second exemple** — les deux camps **échouent** (`-2 SL` contre `-4 SL`) ; l'orc l'emporte malgré son échec (*Despite rolling more than his skill*), avec un SL net de `+2 SL`, et le coup porte. C'est l'illustration littérale de « You do not need to succeed on your own Test to win, just beat your opponent. » (`CRB 024 l.77`). La page imprime la parenthèse `(2-4 = 2)` telle quelle (`CRB 024 l.136`).

**Sources RAW** :
- `CRB 024 l.75-80` — sous-système **Opposed Tests** complet : définition (action résistée), victoire au plus haut SL, victoire possible sans réussite, SL du Test opposé = différence des SL, égalité au profit de l'initiateur (l'attaquant en combat).
- `CRB 024 l.77` — « Whichever of you achieved the higher SL wins… The difference between your SL is the SL of the Opposed Test » + exemple nu `-1 SL` bat `-4 SL` = victoire de `3 SL`, Impressive Success.
- `CRB 024 l.79` — départage d'égalité : l'initiateur du jet, en combat l'attaquant.
- `CRB 024 l.73` — Difficulty par défaut **Challenging (+0 SL)** si non spécifiée ; la plupart des Tests en combat sont Challenging (+0 SL).
- `CRB 024 l.93-104` — **OUTCOMES TABLE**, sur laquelle se lit le SL net d'un Test opposé (topic **OUTCOMES TABLE**).
- `CRB 024 l.132-136` — **Test Example — Opposed Tests** : Salundra contre l'orc, les deux sens (deux réussites, puis deux échecs).
- `CRB 023 l.5` — un Test se fait quand l'issue est incertaine **ou** opposée par un autre personnage.
- `CRB 076 l.75-77` — chapitre du GM, section **Opposed Tests** : un Test opposé doit toujours produire quelque chose, y compris à SL égaux (« stalemate ») ; consigne narrative, pas règle de départage.

> « Resisted actions, such as trying to sneak past someone or hit a foe in combat (page 164), are Opposed Tests. Whichever of you achieved the higher SL wins. You do not need to succeed on your own Test to win, just beat your opponent. The difference between your SL is the SL of the Opposed Test. For example, -1 SL beats -4 SL, winning by 3 SL — an Impressive Success. » — `CRB 024 l.77`

> « In the case of a tie, whoever initiated the roll wins — in combat, the attacker. » — `CRB 024 l.79`

> « Something should always happen as a result of an Opposed Test. Even when both Characters achieve the same SL and the Test ends in a stalemate, use the result to point towards a way forward. » — `CRB 076 l.77`

**Voir aussi** :

- [MAKING A TEST — déclenchement et procédure du Test](#making-a-test--déclenchement-et-procédure-du-test)
- [ROLL DICE — le d100 et le calcul du Success Level (SL)](#roll-dice--le-d100-et-le-calcul-du-success-level-sl)
- [DIFFICULTY AND CHARACTER MODIFIERS — DIFFICULTY TABLE](#difficulty-and-character-modifiers--difficulty-table)
- [OUTCOMES TABLE — lecture du SL final](#outcomes-table--lecture-du-sl-final)
- [CRITICALS AND FUMBLES — le double](#criticals-and-fumbles--le-double)
- [ADVANTAGE AND DISADVANTAGE — inversion des chiffres et cumul](#advantage-and-disadvantage--inversion-des-chiffres-et-cumul)
- [EXTENDED TESTS — les Tests étendus](#extended-tests--les-tests-étendus)
- [Getting Help — se faire aider sur un Test](#getting-help--se-faire-aider-sur-un-test) (`CRB 024 l.138-144`)
- [Cheating Death — How Did That Miss? et Not Today!](#cheating-death--how-did-that-miss-et-not-today) — dépense avant résolution des issues d'un Test opposé (`CRB 025 l.25`)
- [Achieving the Impossible — I Will Not Fail!](#achieving-the-impossible--i-will-not-fail) — victoire d'au moins `+1 SL` (`CRB 025 l.32`)
- aire `combat` (fiche à extraire) — Opposed Melee Test et dégâts (`CRB 036 l.9`, `l.15`, `l.40`), Fumble gagnant (`CRB 036 l.94-98`), Critical Hit en défense (`CRB 036 l.72-74`), Momentum (`CRB 037 l.11`, `l.17`), Initiative (`CRB 033 l.29`), embuscade (`CRB 033 l.39`), Grapple (`CRB 036 l.225`)
- aire `etats` (fiche à extraire) — *Surprised* (`CRB 042 l.123`), *Entangled* (`CRB 042 l.75`)
- aire `deplacement` (fiche à extraire) — poursuites (`CRB 032 l.81-87`)
- aire `magie` (fiche à extraire) — dissipation (`CRB 070 l.149`), Touch Tests opposés (`CRB 070 l.35`, `CRB 067 l.13`)

**Implémente :** (non implémenté)
- dette : #1873

---

## Getting Help — se faire aider sur un Test

**Getting Help** est le sous-système du chapitre `MAKING A TEST` qui permet à plusieurs personnages de conjuguer leurs efforts sur **un seul et même Test**. Il ne crée aucun jet supplémentaire : l'aide se convertit intégralement en **Advantage** sur l'unique jet effectué. `CRB 024 l.138-144`

**Déclenchement.** Il faut l'accord du GM (« With the GM's permission ») : deux personnages ou plus peuvent alors travailler ensemble sur un Test. `CRB 024 l.140`

**Qui lance.** Le personnage ayant la **valeur la plus haute** dans le Skill — ou dans la Characteristic si le Test est un Characteristic Test `CRB 024 l.83` — est celui qui fait le Test ; les autres sont des aidants et ne lancent pas. `CRB 024 l.140`

**Bénéfice mécanique.** Le lanceur fait son Test **with Advantage**. `CRB 024 l.140` La mécanique d'Advantage est portée par le topic [ADVANTAGE AND DISADVANTAGE — inversion des chiffres et cumul](#advantage-and-disadvantage--inversion-des-chiffres-et-cumul) : on peut inverser les chiffres du d100 si cela améliore le résultat `CRB 024 l.48`, Advantage et Disadvantage s'annulent, et **chaque source d'Advantage après la première donne +1 SL** `CRB 024 l.50`. Ce topic n'en re-transcrit pas la règle.

Ce qui est propre à l'aide : le texte de Getting Help n'accorde, en toutes lettres, que « the Test with Advantage » — **sans aucune graduation selon le nombre d'aidants**. Le RAW ne dit **pas** que chaque aidant compte pour une source d'Advantage distincte ; appliquer le cumul en +1 SL par aidant supplémentaire n'est donc pas dérivable du texte : **silence RAW**. En revanche, le cumul de `CRB 024 l.50` se déclenche bel et bien si le lanceur tire une **autre** source d'Advantage nommée par le livre sur le même Test :

| Autre source d'Advantage nommée au RAW | Passage | Réf |
|---|---|---|
| Fortune Point dépensé avant le jet | `Gain Advantage on a Test before rolling.` | `CRB 025 l.9` |
| Momentum, sur un Melee Test seulement | `When you have Momentum, you gain Advantage (page 130) on any Melee Test you make.` | `CRB 037 l.13` |
| Talent (exemple imprimé : *Alley Cat*) | `Her Alley Cat Talent lets her make Stealth (Urban) Test with Advantage.` | `CRB 024 l.128` |

Symétriquement, l'Advantage conféré par l'aide **s'annule** contre une source de Disadvantage présente sur le même Test `CRB 024 l.50` — par exemple l'obscurité sur un Melee, Ranged ou Perception Test fondé sur la vue `CRB 024 l.27`.

**Conditions pour pouvoir aider.** Un personnage doit pouvoir **logiquement et significativement** assister (« must logically be able to meaningfully assist »). `CRB 024 l.142`

**Exclusions explicites.** Décomposition de la phrase d'exclusion de `CRB 024 l.142` (le livre l'imprime en prose, ce n'est pas une table du CRB) — chaque cas reste verbatim :

| Cas exclu (verbatim CRB) | Portée | Terme de jeu défini ailleurs ? |
|---|---|---|
| `resist disease` | on n'aide normalement pas à résister à une maladie | oui — chapitre `DISEASE AND INFECTION` `CRB 039 l.3` |
| `poison` | on n'aide normalement pas à résister à un poison | oui — chapitre `POISONS`, résistance par Endurance Test `CRB 040 l.7` |
| `fear` | on n'aide normalement pas à résister à la peur | oui — `Fear (Rating)`, résistance par **Extended** Psychology Test `CRB 041 l.21-23` |
| `hazards` | on n'aide normalement pas à résister aux hazards | **non** — aucune section ni entrée d'Index du CRB ne définit `hazards` : portée laissée ouverte |
| `physically assist if they aren't close enough` | pas d'aide physique sans proximité suffisante | non chiffré : aucune distance imprimée |

La formule employée est « **cannot normally help** » : c'est une interdiction par défaut, pas un absolu, cohérente avec le fait que le sous-système entier est soumis à l'accord du GM `CRB 024 l.140`.

**Restriction des Advanced Skills.** Un personnage **ne peut pas assister sur un Test d'Advanced Skill** s'il n'a pas **au moins un Advance** dans le Skill testé. `CRB 024 l.142` Cette clause ÉTEND à l'aidant la barrière générale des Advanced Skills — « Advanced Skills can only be used if you have at least one Advance in the Skill » `CRB 020 l.8`, « You may only Test an Advanced Skill if you have taken at least one Advance in it » `CRB 020 l.17` — alors même que l'aidant ne lance rien. Un aidant sans aucun Advance dans un Advanced Skill est donc disqualifié comme aidant, quelle que soit la fiction. Aucune restriction de ce type n'est posée pour un **Basic Skill** (« can be used by anyone, even without any Advances » `CRB 020 l.7`, testable sans Advance via la Characteristic associée `CRB 020 l.13`) ni pour un **Characteristic Test** `CRB 024 l.83`.

**Silences du RAW** (constats — aucune valeur n'est proposée ici) :

| Silence | Ce que le RAW dit / ne dit pas | Réf |
|---|---|---|
| Égalité entre deux valeurs les plus hautes | le texte désigne « the character with the highest Skill (or Characteristic) », sans règle de départage | `CRB 024 l.140` |
| Plafond du nombre d'aidants | « two or more characters », aucun maximum | `CRB 024 l.140` |
| Coût en Action ou en Turn pour l'aidant | aucun coût n'est imprimé | `CRB 024 l.138-144` |
| Graduation de l'effet par le nombre d'aidants | un seul « with Advantage » accordé, aucune échelle | `CRB 024 l.140` |
| Grouped Skill : quelle Specialisation doit porter l'Advance de l'aidant | la clause dit « the Skill being tested » ; or un Advance de Grouped Skill s'alloue à une Specialisation précise | `CRB 024 l.142`, `CRB 020 l.23-27` |
| Aide sur le Test de résistance à *Fear*, qui est lui-même un Extended Test | `CRB 024 l.142` interdit d'aider à résister à la peur, alors que le régime des Extended Tests autorise souvent de travailler ensemble ; le livre n'articule pas les deux | `CRB 024 l.142`, `CRB 041 l.23`, `CRB 076 l.115` |

**Exemple RAW, transcrit.** Brokk et Salundra forcent la porte barrée de la cave d'un noble ; le GM demande un **Challenging (+0 SL) Strength** Test. Brokk a la Strength la plus élevée (53), c'est donc lui qui teste ; il obtient 61, mais l'aide de Salundra lui donne Advantage, il inverse le jet en 16. Le livre imprime **+3 SL**. `CRB 024 l.144`

### Écart RAW — l'exemple Brokk & Salundra

La valeur imprimée par l'exemple **ne se dérive pas** de la règle générale de SL du même chapitre :

| Élément | Valeur | Réf |
|---|---|---|
| Règle de SL | « Subtract the first digit of your roll from the first digit of the Skill or Characteristic being tested » | `CRB 024 l.14` |
| Characteristic testée | Strength `53` → premier chiffre `5` | `CRB 024 l.144` |
| Jet retenu après inversion | `16` → premier chiffre `1` | `CRB 024 l.144` |
| Difficulty | `Challenging (+0 SL)` → aucun modificateur | `CRB 024 l.144`, `CRB 024 l.68` |
| SL calculé par `CRB 024 l.14` | 5 − 1 = **+4 SL** | `CRB 024 l.14` |
| SL imprimé par l'exemple | **+3 SL** | `CRB 024 l.144` |

Advantage, à source unique, n'apporte aucun modificateur de SL : il n'autorise que l'inversion des chiffres `CRB 024 l.48` (topic **ADVANTAGE AND DISADVANTAGE**). Rien dans le passage ne justifie le −1 d'écart. Le reste du chapitre applique `CRB 024 l.14` sans écart : Stealth (Urban) 39 contre un jet de 41 donne 3 − 4 = −1 SL (`CRB 024 l.116`), et Melee (Basic) 55 contre un jet de 23 donne +3 SL (`CRB 024 l.134`).

**Écart RAW, non tranché ici** : le livre imprime « This allows him to reverse the roll to a 16, resulting in a +3 SL. » (`CRB 024 l.144`) ; la règle générale `CRB 024 l.14` donne 5 − 1 = +4 SL.

### Application nommée hors du chapitre Tests — l'`Assistance` au dispel

Le chapitre de magie mobilise l'aide sur un cas précis : plusieurs spellcasters qui tentent de dissiper le **même** Spell persistant lancent **séparément**, sauf s'ils connaissent la **même Lore of Magic** — auquel cas ils peuvent fournir de l'`Assistance` à la place. `CRB 070 l.155` C'est une condition d'éligibilité SUPPLÉMENTAIRE, propre à ce cas (partager la Lore), posée par-dessus les conditions générales de `CRB 024 l.142` ; le dispel d'un Spell persistant étant lui-même un **Extended Challenging (+0 SL) Language (Magick)** Test `CRB 070 l.153`, c'est le seul endroit du livre où les deux modes de coopération se croisent. Détail de la procédure de dissipation : aire `magie` (fiche à extraire).

### Ce qui n'est PAS Getting Help

- **Coopération sur un Extended Test** : « Characters can often work together on an Extended Test. Each makes a Test and adds their SL to the shared total. » `CRB 076 l.115` — régime distinct, à plusieurs jets, sans permission préalable formulée, sans que seul le plus haut Skill lance, et sans les exclusions de `CRB 024 l.142`. Porteur unique : topic [EXTENDED TESTS — les Tests étendus](#extended-tests--les-tests-étendus) (`CRB 024 l.106-108`, `CRB 076 l.105-115`), non re-transcrit ici.
- **Outnumbering et Surrounded en combat** : être plus nombreux ne passe pas par Getting Help mais par un modificateur de SL sur l'Attack Test (`CRB 036 l.167`, `l.191`, `l.195`) — relève de l'aire `combat` (fiche à extraire ; écart RAW, voir [ADVANTAGE AND DISADVANTAGE — inversion des chiffres et cumul](#advantage-and-disadvantage--inversion-des-chiffres-et-cumul)).
- **Momentum** : Advantage gagné seul, en frappant, sur les seuls Melee Tests `CRB 037 l.11-13` — ce n'est pas une coopération. Porteur : aire `combat` (fiche à extraire).

**Sources RAW** :
- `CRB 024 l.138-144` — section `Getting Help` de `MAKING A TEST` : intégralité du sous-système (permission du GM, qui lance, Advantage, conditions d'aide, exclusions, restriction Advanced Skill, exemple chiffré). Aucun autre livre du périmètre n'amende ce sous-système (le CRB 5e est le seul livre du cœur 5e).
- `CRB 024 l.140` — accord du GM ; deux personnages ou plus sur un même Test ; le plus haut Skill (ou Characteristic) fait le Test **with Advantage**, sans graduation selon le nombre d'aidants.
- `CRB 024 l.142` — l'aidant doit pouvoir logiquement assister de façon significative ; liste des exclusions (disease, poison, fear, hazards, proximité) ; nul ne peut assister sur un **Advanced Skill** Test sans au moins un Advance dedans.
- `CRB 024 l.144` — exemple Brokk & Salundra : Strength 53, jet 61 inversé en 16 grâce à l'Advantage conféré par l'aide ; SL imprimé « +3 SL ».
- `CRB 024 l.14` — règle générale de calcul du SL (premier chiffre du jet soustrait du premier chiffre de la valeur testée) : appliquée au cas Brokk, elle donne +4 SL et non +3.
- `CRB 024 l.116`, `CRB 024 l.134` — exemples de contrôle du même chapitre où `CRB 024 l.14` est appliquée sans écart (3 − 4 = −1 ; 5 − 2 = +3).
- `CRB 024 l.98` — ligne `+3 to +4 | Impressive Success` de l'`OUTCOMES TABLE`. **Porteur de la table : topic OUTCOMES TABLE.**
- `CRB 024 l.68` — ligne `Challenging | +0` de la `DIFFICULTY TABLE`, Difficulty de l'exemple Brokk. **Porteur de la table : topic DIFFICULTY AND CHARACTER MODIFIERS.**
- `CRB 024 l.48`, `CRB 024 l.50` — définition d'Advantage (inversion des chiffres) et règles de cumul/annulation (+1 SL par source après la première ; Advantage et Disadvantage s'annulent). **Porteur : topic ADVANTAGE AND DISADVANTAGE** ; non re-transcrites ici.
- `CRB 024 l.27` — l'obscurité inflige Disadvantage sur Melee, Ranged et Perception (vue) : source d'annulation de l'Advantage de l'aide.
- `CRB 024 l.83` — Characteristic Test : cas où le « plus haut » se mesure sur la Characteristic, sans barrière d'Advance.
- `CRB 024 l.128` — exemple imprimé d'Advantage conféré par un Talent (*Alley Cat*) : seconde source possible sur un Test déjà aidé.
- `CRB 025 l.9` — `Spend a Fortune Point to: Gain Advantage on a Test before rolling.` : seconde source d'Advantage explicitement nommée.
- `CRB 020 l.7-8`, `CRB 020 l.13`, `CRB 020 l.17`, `CRB 020 l.23-27` (aire `competences`) · `CRB 036 l.167`, `CRB 036 l.191`, `CRB 036 l.195`, `CRB 037 l.11-13` (aire `combat`) · `CRB 039 l.3`, `CRB 040 l.7`, `CRB 041 l.21-23` (aires `maladies`, `psychologie`) · `CRB 070 l.153-155` (aire `magie`) — renvois hors foyer du topic
- `CRB 024 l.106-108`, `CRB 076 l.105-115` — Extended Tests et coopération additive à plusieurs jets. **Porteur : topic EXTENDED TESTS** ; non re-transcrites ici.

> « With the GM's permission, two or more characters can work together on a Test. The character with the highest Skill (or Characteristic) makes the Test with Advantage. » — `CRB 024 l.140`

> « To help, a character must logically be able to meaningfully assist. Characters cannot normally help resist disease, poison, fear, hazards, or physically assist if they aren't close enough. A Character cannot assist with an Advanced Skill Test unless they have at least one Advance in the Skill being tested. » — `CRB 024 l.142`

> « *Example*: *Brokk and Salundra are trying to force open the barred door to a noble's cellar. The GM calls for a Challenging (+0 SL) Strength Test. Brokk has the higher Strength rating, at 53, so he makes the Test. He rolls a 61, but with Salundra helping he has Advantage. This allows him to reverse the roll to a 16, resulting in a +3 SL. Together they force the door open, and descend the darkened stairs with care.* » — `CRB 024 l.144`

> « Subtract the first digit of your roll from the first digit of the Skill or Characteristic being tested to see how many SL you've generated, as shown below. » — `CRB 024 l.14`

> « Sometimes a rule, ability, or circumstance will grant you Advantage or Disadvantage on a Test. When making a Test with Advantage, you may reverse the digits of a roll if that would improve your result, so a 71 could become a 17. » — `CRB 024 l.48`

> « Advantage and Disadvantage cancel each other out. If you have multiple sources of Advantage, each one after the first grants +1 SL, while multiple sources of Disadvantage inflict -1 SL. » — `CRB 024 l.50`

> « Gain Advantage on a Test before rolling. » — `CRB 025 l.9`

> « Characters can often work together on an Extended Test. Each makes a Test and adds their SL to the shared total. » — `CRB 076 l.115`

**Voir aussi** :

- [ADVANTAGE AND DISADVANTAGE — inversion des chiffres et cumul](#advantage-and-disadvantage--inversion-des-chiffres-et-cumul) — PORTEUR de la mécanique d'Advantage
- [MAKING A TEST — déclenchement et procédure du Test](#making-a-test--déclenchement-et-procédure-du-test) — séquence du Test, **CHARACTERISTIC TESTS**
- [ROLL DICE — le d100 et le calcul du Success Level (SL)](#roll-dice--le-d100-et-le-calcul-du-success-level-sl)
- [DIFFICULTY AND CHARACTER MODIFIERS — DIFFICULTY TABLE](#difficulty-and-character-modifiers--difficulty-table)
- [OUTCOMES TABLE — lecture du SL final](#outcomes-table--lecture-du-sl-final)
- [OPPOSED TESTS — les Tests opposés](#opposed-tests--les-tests-opposés)
- [EXTENDED TESTS — les Tests étendus](#extended-tests--les-tests-étendus) — PORTEUR de la coopération additive à plusieurs jets
- [Fortune — Spend a Fortune Point to: et Replenishing Fortune](#fortune--spend-a-fortune-point-to-et-replenishing-fortune) — seconde source d'Advantage sur un Test déjà aidé
- aire `competences` (fiche à extraire) — Advance sur un Advanced Skill, Grouped Skills et Specialisations
- aire `magie` (fiche à extraire) — `Assistance` au dispel, même Lore requise
- aire `combat` (fiche à extraire) — outnumbering, surrounded et Momentum
- aire `psychologie` (fiche à extraire) — résistance à `Fear`, elle-même un Extended Test
- aire `maladies` (fiche à extraire) — résistance à `disease` et `poison`

**Implémente :** (non implémenté)
- dette : #1873

---

## EXTENDED TESTS — les Tests étendus

Un **Extended Test** (Test étendu) est le sous-système que le CRB emploie quand une tâche est longue ou exigeante et que **le temps, les ressources ou le nombre de tentatives comptent** : au lieu d'un jet unique, le personnage effectue **plusieurs Tests successifs dans le temps** — par exemple un par Round, ou un par jour — en tenant le **total cumulé de SL** obtenu. Exemples donnés par le livre : réparer une cuirasse cabossée (« repairing a battered breastplate »), crocheter une serrure avant l'arrivée d'un garde, réparer une armure, ou écumer la bibliothèque de l'Université d'Altdorf à la recherche de mentions d'artefacts exotiques. Si le temps exact ou le coût exact n'ont pas d'importance, la GM n'ouvre pas de Test étendu : elle décide simplement combien de temps la tâche prend à quelqu'un qui possède la Skill pertinente.

Le CRB expose la règle en **deux endroits** : un encadré de rappel dans le chapitre des règles (`CRB 024`, p.131, qui renvoie lui-même « page 266 ») et la **procédure complète** dans le chapitre de conduite de partie (`CRB 076`, p.266). Les autres chapitres qui invoquent un Test étendu renvoient, eux, à « page 131 ». Le livre assume ce placement : l'encadré **EXTEND CAUTION** explique que le sous-système est décrit côté GM parce que c'est un **outil de GM** à réserver à certaines circonstances.

**La procédure, en trois temps** (`CRB 076 l.107-113`) :

- **Set the Goal** — la GM fixe le **total de SL requis** pour réussir, **la fréquence des Tests** (« how often Tests can be made »), l'éventuelle **échéance** (deadline) et **ce qui arrive si elle est manquée**.
- **Choose the Test** — la GM détermine la **Skill** et la **Difficulty** (ou d'autres modificateurs de SL) de chaque tentative. C'est en général la même à chaque jet, mais cela **peut changer au fil de la progression** de la tâche.
- **Track Progress** — après chaque Test, on **ajoute ou retranche** le SL obtenu au total courant.

**Planchers de progression** (`CRB 076 l.111`) — chaque issue pèse au minimum :

- une **réussite** ajoute **au moins +1 SL** ;
- un **échec** retranche **au moins −1 SL** ;
- un **Critical** ajoute **au moins +6 SL** ;
- un **Fumble** retranche **au moins −6 SL**.

Le mot « at least » est un **plancher, pas une valeur fixe** : un jet qui rapporte davantage de SL apporte son SS réel. Ces planchers jouent donc notamment pour les issues à zéro de l'**OUTCOMES TABLE** (`CRB 024 l.100-101`) : un `+0` *Marginal Success* est une réussite et compte donc **+1** au total, un `–0` *Marginal Failure* est un échec et compte donc **−1**.

**Conditions de fin** (`CRB 076 l.113`) : on **réussit** dès que le total atteint le SL requis ; on **échoue** si le total **descend un jour sous 0 SL**, ou si l'on est **à court de tentatives ou de temps**. C'est la GM qui décide des **conséquences de l'échec** et de ce qui, le cas échéant, a tout de même été accompli. L'encadré du chapitre des règles dit la même chose en plus court : réussite au total cible de SL, échec si l'on manque de **temps ou de ressources** (`CRB 024 l.108`).

**Travail collectif** (`CRB 076 l.115`) : plusieurs personnages peuvent souvent travailler ensemble sur un Test étendu — **chacun fait son propre Test et ajoute son SL au total partagé**. C'est un régime **distinct** de l'aide ordinaire (« Getting Help », `CRB 024 l.138-144`), où un seul personnage — celui qui a la meilleure Skill ou Characteristic — teste avec **Advantage** ; ici, les jets se multiplient et leurs SL s'additionnent.

**Cadrage d'emploi** — encadré **EXTEND CAUTION** (`CRB 076 l.117-121`) : trop employés, les Tests étendus enlisent la partie et rendent l'issue anticlimatique. Ils fonctionnent le mieux sur des **situations courtes et tendues** (« you have three Turns to pick this complicated lock before the guard arrives — go! ») et pour montrer **quelle part d'une tâche plus vaste** les personnages parviennent à accomplir avant que le temps ne manque (réparer une forteresse avant l'arrivée de la horde orque). Le livre déconseille de s'en servir pour les **climax d'aventure**, ou quand **un seul Test** résoudrait aussi bien la situation.

**Emplois nommés par le RAW** — la mécanique de chacun vit à son aire porteuse, aucune n'est transcrite ici :

- **Picking Locks** — aire `intrigue` (fiche à extraire), `CRB 027 l.41`, `l.148` ;
- Skill **Art** — aire `competences` (fiche à extraire), `CRB 020 l.71` ;
- **Crafting Endeavour** — aire `activites` (fiche à extraire), `CRB 048 l.125-127` ;
- **Rounds outside combat** — aire `combat` (fiche à extraire), `CRB 033 l.43`.

**Sources RAW** :
- `CRB 024 l.106-108` — encadré **EXTENDED TESTS** (p.131) : jets multiples dans le temps (once per round, once each day), total courant de SL, emploi quand le temps et les ressources comptent, réussite au total cible de SL, échec à court de temps ou de ressources, renvoi « See page 266 ».
- `CRB 076 l.101-103` — définition et périmètre d'emploi (tâches longues ou exigeantes où le temps, les ressources ou les tentatives répétées comptent) ; si le temps/coût exact importe peu, la GM décide simplement de la durée.
- `CRB 076 l.105-109` — procédure : **Set the Goal** (SL total requis, fréquence des Tests, deadline, conséquence si manquée) et **Choose the Test** (Skill, Difficulty ou autres modificateurs de SL, éventuellement variables au fil de la tâche).
- `CRB 076 l.111` — **Track Progress** : cumul du SL après chaque Test et planchers +1 / −1 / +6 (Critical) / −6 (Fumble).
- `CRB 076 l.113` — conditions de réussite et d'échec (total atteint / total sous 0 SL / plus de tentatives ou de temps) ; la GM décide des conséquences.
- `CRB 076 l.115` — travail collectif : chacun teste et ajoute son SL au total partagé.
- `CRB 076 l.117-121` — encadré **EXTEND CAUTION** : pourquoi la règle vit côté GM, situations courtes et tendues, fraction d'une tâche accomplie avant échéance, à éviter aux climax ou quand un Test unique suffit.
- `CRB 024 l.100-101` — lignes `+0` *Marginal Success* et `–0` *Marginal Failure* de l'**OUTCOMES TABLE** (réussite / échec à zéro SL, sur lesquelles jouent les planchers ±1).
- `CRB 024 l.138-144` — **Getting Help** : régime d'aide distinct (meilleure Skill, Test avec Advantage) à ne pas confondre avec l'addition des SL d'un Test étendu.
- `CRB 027 l.41`, `CRB 027 l.148`, `CRB 020 l.71`, `CRB 048 l.125-127`, `CRB 033 l.43` — les quatre emplois hors foyer listés ci-dessus

> « Sometimes the GM may ask you to make multiple rolls over time, such as once per round, or once each day, while keeping a running total of the SL you have achieved. This is known as an Extended Test, and it is used when time and resources matter, such as repairing a battered breastplate or picking a lock before a guard arrives. An Extended Test succeeds once you have achieved a set target number of SL, and fails should you run out of time or resources. » — `CRB 024 l.108`

> « **Set the Goal:** The GM sets the total SL required to succeed, how often Tests can be made, any deadline, and what happens if it is missed. » — `CRB 076 l.107`

> « **Choose the Test:** The GM determines the Skill and Difficulty or other SL modifiers for each attempt. This is usually the same each time, but may change as the task progresses. » — `CRB 076 l.109`

> « **Track Progress:** After each Test, add or subtract your SL from the running total. A success always adds at least +1 SL, a failure always subtracts at least -1 SL, a Critical adds at least +6 SL, and a Fumble subtracts at least -6 SL. » — `CRB 076 l.111`

> « You succeed when your total reaches the required SL. You fail if your total ever drops below 0 SL, or if you run out of attempts or time. The GM decides the consequences of failure and what, if anything, was accomplished. » — `CRB 076 l.113`

> « Characters can often work together on an Extended Test. Each makes a Test and adds their SL to the shared total. » — `CRB 076 l.115`

> « Extended Tests work best for short, tense situations: you have three Turns to pick this complicated lock before the guard arrives — go! » — `CRB 076 l.121`

**Voir aussi** :

- [OUTCOMES TABLE — lecture du SL final](#outcomes-table--lecture-du-sl-final)
- [ROLL DICE — le d100 et le calcul du Success Level (SL)](#roll-dice--le-d100-et-le-calcul-du-success-level-sl)
- [DIFFICULTY AND CHARACTER MODIFIERS — DIFFICULTY TABLE](#difficulty-and-character-modifiers--difficulty-table)
- [SL Modifiers — origine, moment d'application et marge du GM](#sl-modifiers--origine-moment-dapplication-et-marge-du-gm)
- [CRITICALS AND FUMBLES — le double](#criticals-and-fumbles--le-double)
- [Getting Help — se faire aider sur un Test](#getting-help--se-faire-aider-sur-un-test)
- [OPPOSED TESTS — les Tests opposés](#opposed-tests--les-tests-opposés)
- aire `intrigue` (fiche à extraire) — crochetage : Difficulty et SL de la serrure
- aire `activites` (fiche à extraire) — Crafting Endeavour, Qualities et Flaws
- aire `competences` (fiche à extraire) — Skill **Art**
- aire `combat` (fiche à extraire) — Rounds hors combat

**Implémente :** (non implémenté)
- dette : #1873

---

## Fortune — Spend a Fortune Point to: et Replenishing Fortune

Les **Fortune Points** sont la réserve *courante* du personnage : « Whether it is guts, luck, or the favour of the gods, Fate and Fortune smile upon you. You can spend them to gain an edge or cheat unpleasant consequences. » (`CRB 025 l.5`). Ils sont beaucoup moins précieux que les **Fate Points**, qui relèvent d'un autre régime : « Fate points are far more precious than Fortune. They mark you as a Character of destiny, allowing you to Cheat Death or Achieve the Impossible. » (`CRB 025 l.19`). La feuille de personnage porte les deux réserves côte à côte : « **Fate and Fortune:** Help you succeed and survive (see page 133). » (`CRB 007 l.14`).

### Les trois usages RAW d'un point de Fortune

Le livre donne une liste fermée de trois dépenses, sous l'intitulé **Spend a Fortune Point to:** (`CRB 025 l.7-11`), transcrite ici ligne par ligne :

> - Gain Advantage on a Test before rolling.
> - Reroll a Test, keeping the new result. You may spend another Fortune to reroll again.
> - Remove one Condition (page 184).
>
> — `CRB 025 l.9-11`

**1. Gain Advantage on a Test — avant le jet.** La dépense doit être déclarée **before rolling** (`CRB 025 l.9`) : c'est une décision prise dés en main, jamais après lecture du résultat. Ce que fait Advantage — l'inversion des chiffres du jet — n'est **pas recopié ici** : **ADVANTAGE AND DISADVANTAGE** (`CRB 024 l.46-48`) a pour porteur unique le topic [ADVANTAGE AND DISADVANTAGE — inversion des chiffres et cumul](#advantage-and-disadvantage--inversion-des-chiffres-et-cumul). Le livre range explicitement la Fortune parmi les sources d'Advantage : « This ability to reverse the numbers in your roll comes from Momentum (page 167), certain Talents, Spells, and Miracles, and from spending Fortune. » (`CRB 076 l.95`). Un seul point de la règle générale compte pour la dépense, et il est rappelé ici à ce titre : le **cumul** (`CRB 024 l.50`). Conséquence : une Fortune dépensée sur un Test qui bénéficie déjà d'Advantage ne redonne pas l'inversion, elle vaut **+1 SL** ; et sur un Test en Disadvantage, elle se fait d'abord annuler par la source adverse.

**2. Reroll a Test, keeping the new result.** Ce topic est le **porteur unique** de la définition du Reroll, que le chapitre GM pose en toutes lettres : « A reroll is when you disregard the result of a dice roll, and roll it again. You must use the second result. Some Talents allow you to reroll, as does spending a point of Fortune. » (`CRB 076 l.97`). Aucun choix entre les deux résultats : le second s'impose, fût-il pire. La relance est **empilable** : « You may spend another Fortune to reroll again. » (`CRB 025 l.10`) — chaque relance supplémentaire coûte un point de plus, et c'est toujours le dernier résultat qui vaut. Le RAW ne conditionne la relance ni à un échec, ni à une unicité.

**3. Remove one Condition.** Un point retire **une** Condition (`CRB 025 l.11`, renvoi à la page 184). L'empilement des Conditions identiques, leur non-cumul entre elles et la rechute d'*Unconscious* quand la cause demeure sont portés par l'aire `etats` (fiche à extraire) — `CRB 042 l.7-13`, `CRB 042 l.33`, `CRB 042 l.133-137`.

**Autres consommateurs et homonymes.** D'autres capacités consomment de la Fortune — Talent *Well-prepared* (`CRB 021 l.742-744`, aire `talents`), Spell *Starcrossed* (`CRB 071 l.261`, aire `magie`) ; deux homonymes ne touchent pas la réserve — **Blessing of Fortune** (`CRB 066 l.95-101`, aire `religion`), Character Event *A Good Day's Work* (`CRB 047 l.25`, aire `activites`). Fiches à extraire.

### Reconstituer la Fortune

L'intitulé **Replenishing Fortune** (`CRB 025 l.13`) pose la règle complète :

> You regain all Fortune Points at the start of each gaming session. Certain encounters, Spells, and abilities may also replenish (or remove!) Fortune Points.
>
> — `CRB 025 l.15`

La reconstitution est donc **totale** (retour au maximum) et **automatique**, par session de jeu — contrairement au Fate, qui « is not automatically replenished » (`CRB 025 l.36`). Le chapitre GM calibre la cadence sur la durée réelle de table : « Fortune, by contrast, is replenished at the start of every session. This assumes a session of around four hours. For longer sessions, replenish Fortune at narratively appropriate moments, roughly every four hours. For shorter sessions, replenish it every other session to maintain a similar level of challenge. » (`CRB 076 l.73`).

**Le maximum que remplit ce rafraîchissement** est une valeur d'espèce fixée à la création, non indexée sur le Fate, +1 si le premier tirage d'espèce est accepté — aire `creation` (fiche à extraire), `CRB 006 l.7`, `CRB 006 l.27`. Il bouge ensuite par le Talent *Luck* (aire `talents`), deux Character Events (aire `activites`) et la conversion de Resilience (`CRB 116 l.36`, aire `conversion`).

**Effets extérieurs** — les « certain encounters, Spells, and abilities » annoncés en `CRB 025 l.15`. Deux familles, à ne pas confondre : les points **datés** (gagnés pour une durée propre à l'effet — Lore Attributes, *Portents of Amul*, *Fate's Fickle Fingers*, *Cheat the Odds*, *Chaotic Foresight*) et les modificateurs du **maximum** (ci-dessus) ; certains effets **interdisent** la dépense (*Curse of Ill Fortune*, *Scandalous Rumours*) ou **réduisent** le prochain rafraîchissement (*Behold Your Wickedness*) ou le **suppriment** (*Traitor's Heart*). Chacun est porté par son aire (fiche à extraire) : `magie`, `religion`, `activites`, `talents` (*Doomed*).

### Posture de table

Le chapitre GM n'ajoute aucune restriction mécanique, seulement un cadrage de dramaturgie : « Fortune can turn a disastrous situation in your Characters' favour, so make spending it feel like a meaningful choice. […] making the choice to spend Fortune feel like a moment of consequence rather than simply another resource. » (`CRB 076 l.69`).

**Sources RAW** :
- `CRB 025 l.5` — nature de Fate et Fortune : « spend them to gain an edge or cheat unpleasant consequences »
- `CRB 025 l.7-11` — intitulé **Spend a Fortune Point to:** et ses trois entrées (Advantage avant le jet ; reroll conservant le nouveau résultat, empilable ; retrait d'une Condition, page 184)
- `CRB 025 l.13-15` — intitulé **Replenishing Fortune** : récupération intégrale au début de chaque session ; rencontres, Spells et capacités peuvent aussi rendre ou retirer des points
- `CRB 025 l.19`, `CRB 025 l.36` — le Fate est un autre régime (bien plus précieux, non reconstitué automatiquement)
- `CRB 007 l.14` — la feuille de personnage porte Fate et Fortune, renvoi page 133
- `CRB 024 l.46-48` — **ADVANTAGE AND DISADVANTAGE** : règle d'Advantage portée par le topic ADVANTAGE AND DISADVANTAGE, non recopiée ici
- `CRB 024 l.50` — cumul d'Advantage : +1 SL par source après la première (ce que vaut une Fortune sur un Test déjà avantagé)
- `CRB 076 l.95` — la Fortune est une des sources d'Advantage ; le GM n'en accorde quasi jamais hors règle explicite
- `CRB 076 l.97` — définition de **Reroll** : le second résultat s'impose, pas de choix entre les deux (porteur unique)
- `CRB 076 l.69`, `CRB 076 l.73` — cadrage GM de la dépense ; cadence de reconstitution calée sur ~4 h de jeu
- `CRB 042 l.7-13`, `CRB 042 l.33`, `CRB 042 l.133-137` — aire `etats`
- `CRB 006 l.7`, `CRB 006 l.27` — aire `creation`
- `CRB 021 l.388-390`, `CRB 021 l.742-744` — aire `talents`
- `CRB 066 l.95-101`, `CRB 067 l.169-175`, `CRB 065 l.67` — aire `religion`
- `CRB 047 l.25`, `CRB 047 l.37-39`, `CRB 047 l.71-77` — aire `activites`
- `CRB 070 l.203-206`, `CRB 071 l.219`, `CRB 071 l.247-277`, `CRB 072 l.120-130`, `CRB 074 l.69` — aire `magie`
- `CRB 116 l.36` — aire `conversion`

> « Gain Advantage on a Test before rolling. » — `CRB 025 l.9`

> « Reroll a Test, keeping the new result. You may spend another Fortune to reroll again. » — `CRB 025 l.10`

> « Remove one Condition (page 184). » — `CRB 025 l.11`

> « You regain all Fortune Points at the start of each gaming session. Certain encounters, Spells, and abilities may also replenish (or remove!) Fortune Points. » — `CRB 025 l.15`

> « A reroll is when you disregard the result of a dice roll, and roll it again. You must use the second result. Some Talents allow you to reroll, as does spending a point of Fortune. » — `CRB 076 l.97`

> « This ability to reverse the numbers in your roll comes from Momentum (page 167), certain Talents, Spells, and Miracles, and from spending Fortune. » — `CRB 076 l.95`

> « Fortune, by contrast, is replenished at the start of every session. This assumes a session of around four hours. » — `CRB 076 l.73`

**Voir aussi** :

- [ADVANTAGE AND DISADVANTAGE — inversion des chiffres et cumul](#advantage-and-disadvantage--inversion-des-chiffres-et-cumul) — **porteur unique** de la règle d'Advantage (`CRB 024 l.46-48`)
- [CRITICALS AND FUMBLES — le double](#criticals-and-fumbles--le-double) — le Reroll y est renvoyé, sa définition (`CRB 076 l.97`) vit ici
- [ROLL DICE — le d100 et le calcul du Success Level (SL)](#roll-dice--le-d100-et-le-calcul-du-success-level-sl)
- [DIFFICULTY AND CHARACTER MODIFIERS — DIFFICULTY TABLE](#difficulty-and-character-modifiers--difficulty-table)
- [Fate — nature, rareté et Replenishing Fate](#fate--nature-rareté-et-replenishing-fate)
- [Cheating Death — How Did That Miss? et Not Today!](#cheating-death--how-did-that-miss-et-not-today)
- [Achieving the Impossible — I Will Not Fail!](#achieving-the-impossible--i-will-not-fail)
- aire `etats` (fiche à extraire) — Conditions : liste complète, empilement, *Unconscious*, Momentum perdu à l'acquisition
- aire `combat` (fiche à extraire) — **Momentum**, autre source d'Advantage en Melee
- aire `creation` (fiche à extraire) — Fortune de départ par espèce, **Species Table**
- aire `talents` (fiche à extraire) — *Luck*, *Doomed*, *Well-prepared*
- aire `activites` (fiche à extraire) — Character Events modifiant le maximum de Fortune
- aire `magie` (fiche à extraire) — Miscasts, Lore Attributes, *Fate's Fickle Fingers*, *Starcrossed*, Portents of Amul, *Curse of Ill Fortune*
- aire `religion` (fiche à extraire) — **Blessing of Fortune**, *Cheat the Odds*, Wrath of the Gods
- aire `conversion` (fiche à extraire) — **Resilience and Resolve**

**Implémente :** (non implémenté)
- dette : #1873

---

## Fate — nature, rareté et Replenishing Fate

Le CRB 5e pose deux ressources de survie jumelles sur la feuille de personnage — **Fate** et **Fortune** — regroupées sous le chapitre *Fate and Fortune* : « Whether it is guts, luck, or the favour of the gods, Fate and Fortune smile upon you. You can spend them to gain an edge or cheat unpleasant consequences. » (`CRB 025 l.5`). La feuille de personnage les présente d'un seul bloc — « **Fate and Fortune:** Help you succeed and survive (see page 133). » (`CRB 007 l.14`). Ce topic porte la ressource **Fate** : ce qu'elle est, à quel point elle est rare, et comment elle se regagne. La ressource **Fortune** (usages, reconstitution à chaque séance) a son porteur propre : [Fortune — Spend a Fortune Point to: et Replenishing Fortune](#fortune--spend-a-fortune-point-to-et-replenishing-fortune).

**Nature et statut.** Les **Fate points** sont explicitement déclarés « far more precious than Fortune » (`CRB 025 l.19`). Ils ne sont pas un simple jeton de relance : ils **marquent** le personnage. La règle est littérale — « They mark you as a Character of destiny » — et le chapitre *Fate and Fortune* ne leur ouvre que deux familles d'usages, nommées dans la même phrase : **Cheat Death** et **Achieve the Impossible** (`CRB 025 l.19`). Ces deux familles se développent en trois usages nommés — **How Did That Miss?** et **Not Today!** sous *Cheating Death* (`CRB 025 l.21-26`), **I Will Not Fail!** sous *Achieving the Impossible* (`CRB 025 l.28-32`) —, détaillés dans [Cheating Death — How Did That Miss? et Not Today!](#cheating-death--how-did-that-miss-et-not-today) et [Achieving the Impossible — I Will Not Fail!](#achieving-the-impossible--i-will-not-fail) ; ce topic ne les re-traite pas. Le conseil au GM confirme le statut : « Spending Fate is a Big Deal: it is powerful enough to cheat death. […] Spending Fate should always feel like a dramatic moment in the adventure. » (`CRB 076 l.71`).

Hors de ces deux familles, *Called to Account* (*Wrath of the Gods*, `151+`) fait aussi du Fate Point la condition et le coût d'un retour — `CRB 065 l.73`, aire `religion` (fiche à extraire).

**Rareté, mesurée par l'asymétrie avec Fortune.** Le CRB fonde la rareté du Fate sur un contraste mécanique explicite, et non sur une simple couleur narrative :

- **Fortune** se reconstitue **intégralement et automatiquement** au début de chaque séance de jeu, et certaines rencontres, Spells et capacités peuvent aussi la rendre (ou la retirer) — « You regain all Fortune Points at the start of each gaming session. Certain encounters, Spells, and abilities may also replenish (or remove!) Fortune Points. » (`CRB 025 l.15`), règle portée par [Fortune — Spend a Fortune Point to: et Replenishing Fortune](#fortune--spend-a-fortune-point-to-et-replenishing-fortune).
- **Fate**, lui, **ne se reconstitue jamais automatiquement** : « Fate is not automatically replenished. » (`CRB 025 l.36`). Aucun début de séance, aucun repos, aucune convalescence ne rend un Fate Point.

Il n'existe donc, dans le socle 5e, aucune horloge de régénération du Fate : le stock n'augmente que par un **octroi ponctuel**, et chaque dépense est, par défaut, définitive pour la campagne en cours.

**Reconstitution (Replenishing Fate).** La seule voie générale de regain est une **décision du GM**, bornée par deux conditions cumulatives dans le texte : la cause (« an act of exceptional heroism, bravery, or significance ») et le moment (« This usually happens only at the end of an important adventure ») — `CRB 025 l.36`. La règle se clôt par une consigne de jeu adressée au joueur : « so spend Fate carefully — it is rarely replenished. » (`CRB 025 l.36`). L'octroi porte sur **un** Fate Point (« may grant a Fate Point »), pas sur une remise à niveau du stock initial.

Le chapitre du GM resserre encore la fréquence attendue et donne le barème d'appréciation : « Regaining Fate should be rare enough to feel momentous, perhaps marking the culmination of a long campaign or the achievement of an objective at considerable personal cost. » — là où, dans la même phrase, Fortune est rappelée comme « replenished at the start of every session » (`CRB 076 l.73`).

**Stock de départ.** Le Fate se recopie sur la feuille à la création (`CRB 006 l.27`) ; le barème par espèce va de **1 à 4 points pour toute une campagne** — aire `creation` (fiche à extraire), `CRB 008 l.67`, `CRB 009 l.75`, `CRB 010 l.67`, `CRB 011 l.69`, `CRB 012 l.75`.

**Autres entrées de Fate prévues par le RAW.** Hors octroi discrétionnaire du GM et hors stock d'espèce, le CRB nomme quatre sources chiffrées de Fate Points supplémentaires ; chacune est portée par une autre aire et n'est listée ici que parce qu'elle alimente le stock de Fate :

- *Oh Fickle Fate* : +1 Fate si les **trois** premiers tirages (Species, Career, Characteristics) ont été acceptés — `CRB 016 l.67-69`, aire `creation` (fiche à extraire).
- *Party Ambition* accomplie : +1 Fate Point pour **chaque** personnage, la progression ne donnant aucun XP — `CRB 017 l.66-70`, aire `avancement` (fiche à extraire).
- Talent *Doomed* : mort conforme au Dooming → Fortune rafraîchie chez les alliés, +1 Fate Point pour le personnage **suivant** — `CRB 021 l.201-203`, aire `talents` (fiche à extraire).
- Spell *The Third Portent of Amul* : +1 Fate Point **temporaire**, pour la durée du Spell — `CRB 071 l.285`, aire `magie` (fiche à extraire).

**Héritage des éditions antérieures.** « If an effect refers to Resilience, use Fate instead. » (`CRB 116 l.36`) — conversion portée par l'aire `conversion` (fiche à extraire).

**Sources RAW** :
- `CRB 025 l.5` — chapeau du chapitre *Fate and Fortune* : les deux ressources se dépensent pour « gain an edge or cheat unpleasant consequences »
- `CRB 025 l.17-19` — **PORTEUR** : *Fate* — « far more precious than Fortune », marque un *Character of destiny*, ouvre *Cheat Death* et *Achieve the Impossible*
- `CRB 025 l.34-36` — **PORTEUR** : *Replenishing Fate* — aucune reconstitution automatique ; octroi possible par le GM pour un acte d'héroïsme, de bravoure ou d'importance exceptionnels, en principe seulement à la fin d'une aventure importante
- `CRB 025 l.13-15` — *Replenishing Fortune* : terme de comparaison de la rareté du Fate — règle **portée par** [Fortune — Spend a Fortune Point to: et Replenishing Fortune](#fortune--spend-a-fortune-point-to-et-replenishing-fortune)
- `CRB 025 l.21-32` — les trois usages nommés (*How Did That Miss?*, *Not Today!*, *I Will Not Fail!*) — portés par [Cheating Death — How Did That Miss? et Not Today!](#cheating-death--how-did-that-miss-et-not-today) et [Achieving the Impossible — I Will Not Fail!](#achieving-the-impossible--i-will-not-fail)
- `CRB 007 l.14` — feuille de personnage : « Fate and Fortune: Help you succeed and survive (see page 133). »
- `CRB 076 l.71` — conseil au GM : dépenser du Fate est « a Big Deal », moment dramatique à mettre en scène
- `CRB 076 l.73` — conseil au GM : le regain de Fate doit rester assez rare pour être marquant (aboutissement d'une longue campagne, objectif atteint à grand prix personnel), par opposition à Fortune rendue à chaque séance
- `CRB 006 l.27` — Fate fait partie des valeurs recopiées depuis l'espèce sur la feuille
- `CRB 008 l.67`, `CRB 009 l.75`, `CRB 010 l.67`, `CRB 011 l.69`, `CRB 012 l.75`, `CRB 016 l.67-69`, `CRB 017 l.66-70`, `CRB 021 l.201-203`, `CRB 071 l.285`, `CRB 065 l.73` — entrées et dépenses de Fate hors foyer, par aire ci-dessus
- `CRB 116 l.36` — *Resilience and Resolve* — aire `conversion`

> « Fate points are far more precious than Fortune. They mark you as a Character of destiny, allowing you to Cheat Death or Achieve the Impossible. » — `CRB 025 l.19`

> « Fate is not automatically replenished. The GM may grant a Fate Point for an act of exceptional heroism, bravery, or significance. This usually happens only at the end of an important adventure, so spend Fate carefully — it is rarely replenished. » — `CRB 025 l.36`

> « Regaining Fate should be rare enough to feel momentous, perhaps marking the culmination of a long campaign or the achievement of an objective at considerable personal cost. Fortune, by contrast, is replenished at the start of every session. » — `CRB 076 l.73`

> « If an effect refers to Resilience, use Fate instead. » — `CRB 116 l.36`

**Voir aussi** :
- [Cheating Death — How Did That Miss? et Not Today!](#cheating-death--how-did-that-miss-et-not-today) — la dépense de Fate pour survivre
- [Achieving the Impossible — I Will Not Fail!](#achieving-the-impossible--i-will-not-fail) — la dépense de Fate pour réussir
- [Fortune — Spend a Fortune Point to: et Replenishing Fortune](#fortune--spend-a-fortune-point-to-et-replenishing-fortune) — la ressource jumelle
- aire `creation` (fiche à extraire) — stock de Fate par espèce, *Oh Fickle Fate*
- aire `avancement` (fiche à extraire) — *Party Ambition*
- aire `talents` (fiche à extraire) — *Doomed*
- aire `magie` (fiche à extraire) — *The Third Portent of Amul*
- aire `religion` (fiche à extraire) — *Called to Account*
- aire `conversion` (fiche à extraire) — **Resilience and Resolve**

**Implémente :** (non implémenté)
- dette : #1873

---

## Cheating Death — How Did That Miss? et Not Today!

Le Fate ouvre **deux** usages au personnage : **Cheating Death** et **Achieving the Impossible**. Le présent topic couvre le premier, *Cheating Death* — le second (**I Will Not Fail!**) vit dans [Achieving the Impossible — I Will Not Fail!](#achieving-the-impossible--i-will-not-fail).

> **Nature, statut et reconstitution du Fate** (Fate vs Fortune, *Replenishing Fate*, Fate de départ par espèce, octrois à la création et en jeu) : voir [Fate — nature, rareté et Replenishing Fate](#fate--nature-rareté-et-replenishing-fate) — non repris ici.

**Coût et déclenchement.** L'usage est volontaire (« *You may spend a Fate Point* ») et coûte **1 point de Fate** par emploi, pour retarder son rendez-vous avec Morr (« *delay your appointment with Morr* »). Aucun Test n'est exigé pour déclencher l'un ou l'autre usage, et le passage **n'énonce aucune limite** d'emplois par tour, par attaque ou par rencontre au-delà du nombre de points de Fate disponibles. Deux formes existent, distinguées par leur **fenêtre** dans la résolution — `CRB 025 l.21-26`.

### **How Did That Miss?** — négation d'une attaque

- **Fenêtre exacte** : *après* que des dés aient été jetés pour une attaque dirigée contre vous, mais **avant** que les Damage ne soient calculés, **avant** que les résultats d'un Opposed Test ne soient résolus, et **avant** que les Critical Hits ne soient déterminés. Les trois bornes sont cumulatives : dès qu'une de ces trois opérations est entamée, la fenêtre est close.
- **Repère dans la séquence d'attaque** (`CRB 036 l.7-46`, aire `combat`) : la fenêtre s'ouvre une fois les dés du **Roll to Hit** tombés et se referme à l'entrée du **Determine Damage**.
- **Cible** : une attaque dirigée contre VOUS (« *an attack against you* ») — le texte ne prévoit pas de dépenser son Fate pour protéger un tiers.
- **Déclencheur** : « *any dice are rolled for an attack* » — la fenêtre s'ouvre sur des dés jetés, quelle que soit la nature de l'attaque ; la prose d'illustration cite aussi bien le coup porté que le Spell (« *the blow misses, the spell fizzles* »).
- **Effet** : dépenser 1 Fate **annule les effets de cette attaque** (« *negate the effects of that attack* »). Narrativement : le coup rate, le Spell avorte, ou l'on s'en tire de justesse (« *escape by the skin of your teeth* »).
- **Suite** : le jeu **reprend normalement** (« *Play then continues as normal* ») — la dépense ne consomme pas l'action, ne met pas fin au tour, ne retire pas le personnage de la scène.

### **Not Today!** — survivre à la mort

- **Fenêtre** : **au lieu de mourir** (*Instead of dying*, `CRB 025 l.26`) — donc une fois le résultat létal connu, contrairement à *How Did That Miss?*. Le guide du GM confirme cette lecture : « *If they use Fate after seeing the result, in order to avoid death (**Not Today!**)* » — `CRB 076 l.71`.
- **Ce que *dying* recouvre** : mort par Critical Wound ou par accumulation de Critical Wounds (`CRB 038 l.92`, aire `traumatisme`), et mort par Condition *Bleeding* (`CRB 042 l.55`, aire `etats`), que le chapitre *Death* ne range pas dans ses deux voies ; la formulation du Fate ne vise que le fait de mourir (*Instead of dying*).
- **Effet** : le personnage n'est pas tué. Il est *knocked unconscious*, *left for dead*, *swept away by a river*, ou **retiré de la rencontre** d'une autre manière. Ces issues sont des exemples ouverts (« *or otherwise removed from the encounter* ») ; l'invariant est : « *your Character survives, but takes no further part in the current encounter* ».
- **Contrepartie mécanique** : la survie se paie par la **Spellie de la rencontre en cours** — le personnage n'y prend plus aucune part. Le RAW ne fixe ni Wounds restants, ni Conditions, ni Critical Wounds conservés : la seule conséquence chiffrée est le point de Fate dépensé.
- **Hors du champ des PJ** : la procédure *Sudden Death* ne vaut ni pour les PJ ni pour les PNJ dotés du Talent *Luck* (`CRB 038 l.98`, aire `traumatisme`).

### Arbitrage narratif (guide du GM)

Le chapitre du GM demande que la **différence de timing** se traduise dans la fiction. Une dépense faite **avant** le jet de Damage (*How Did That Miss?*) se décrit comme une chance quasi miraculeuse : le personnage glisse et le coup décapitant siffle au-dessus de sa tête, ou une flèche ricoche sur un médaillon sigmarite. Une dépense faite **après avoir vu le résultat**, pour éviter la mort (*Not Today!*), se décrit comme une survie désespérée : assommé et réveillé seulement après la bataille, ou emporté par un courant rapide sur un mille avant de regagner la berge. Dépenser du Fate « *is a Big Deal: it is powerful enough to cheat death* » et « *should always feel like a dramatic moment in the adventure* » — `CRB 076 l.71`. (Le même paragraphe couleur aussi *I Will Not Fail!* : ce volet-là vit dans [Achieving the Impossible — I Will Not Fail!](#achieving-the-impossible--i-will-not-fail).)

### Emploi du Fate voisin, hors *Cheating Death*

**Called to Account** (*Wrath of the Gods*, `151+`) : tromper la mort par une entrée de table de Prayers, hors des deux emplois de *Cheating Death* — `CRB 065 l.73`, aire `religion` (fiche à extraire).

**Sources RAW** :
- `CRB 025 l.19` — *Fate* : le Fate est bien plus précieux que la Fortune ; il marque un Character of destiny et autorise *Cheat Death* ou *Achieve the Impossible*.
- `CRB 025 l.21-23` — section *Cheating Death* : on peut dépenser un point de Fate pour retarder son rendez-vous avec Morr, de deux manières.
- `CRB 025 l.25` — *How Did That Miss?* : fenêtre (après les dés de l'attaque, avant Damage / résolution de l'Opposed Test / détermination des Critical Hits), effet (annuler les effets de l'attaque), reprise normale du jeu.
- `CRB 025 l.26` — *Not Today!* : au lieu de mourir, le personnage est retiré de la rencontre (inconscient, laissé pour mort, emporté par une rivière…) ; il survit, mais ne prend plus part à la rencontre en cours.
- `CRB 036 l.7-46` — *Attacking* : la séquence en quatre temps qui borne la fenêtre de *How Did That Miss?* — aire `combat`
- `CRB 038 l.41` · `CRB 038 l.92` · `CRB 038 l.96-98` · `CRB 038 l.123` · `CRB 038 l.148` · `CRB 038 l.173` · `CRB 038 l.198` — Critical Wounds, les deux voies de mort, *Sudden Death* et les entrées `Death` : ce que *Not Today!* annule — aire `traumatisme`
- `CRB 042 l.53-55` — Condition *Bleeding* : la mort par d10 en fin de Round — aire `etats`
- `CRB 021 l.388-390` — talent *Luck* : +1 maximum Fortune, le talent que l'exclusion de *Sudden Death* désigne — aire `talents`
- `CRB 065 l.73` — *Called to Account* : emploi du Fate hors *Cheating Death* — aire `religion`
- `CRB 076 l.71` — guide du GM : dépenser du Fate est un acte majeur ; coloration narrative distincte selon que la dépense précède le jet de Damage (*How Did That Miss?*) ou suit le résultat létal (*Not Today!*).

> « **How Did That Miss?** After any dice are rolled for an attack against you, but before Damage is calculated, Opposed Test outcomes resolved or Critical Hits are determined, spend a Fate Point to negate the effects of that attack. The blow misses, the spell fizzles, or you otherwise escape by the skin of your teeth. Play then continues as normal. » — `CRB 025 l.25`

> « **Not Today!** Instead of dying, your Character is knocked unconscious, left for dead, swept away by a river, or otherwise removed from the encounter. Whatever the circumstances, your Character survives, but takes no further part in the current encounter. » — `CRB 025 l.26`

> « You may spend a Fate Point to delay your appointment with Morr in the following ways: » — `CRB 025 l.23`

> « Spending Fate is a Big Deal: it is powerful enough to cheat death. » — `CRB 076 l.71`

> « If they use Fate after seeing the result, in order to avoid death (**Not Today!**), make their survival more desperate. » — `CRB 076 l.71`

**Voir aussi** :
- [Fate — nature, rareté et Replenishing Fate](#fate--nature-rareté-et-replenishing-fate) — porteur UNIQUE de la nature du Fate, du *Replenishing Fate*, du Fate de départ et de tous les octrois
- [Achieving the Impossible — I Will Not Fail!](#achieving-the-impossible--i-will-not-fail) — l'autre branche de dépense (`CRB 025 l.28-32`)
- [Fortune — Spend a Fortune Point to: et Replenishing Fortune](#fortune--spend-a-fortune-point-to-et-replenishing-fortune) — la réserve distincte (`CRB 025 l.7-15`)
- aire `combat` (fiche à extraire) — *Attacking*, Hit Location, Critical Hits (`CRB 036`)
- aire `traumatisme` (fiche à extraire) — Injury, Healing, and Death, Critical Wounds, *Sudden Death* (`CRB 038`)
- aire `etats` (fiche à extraire) — Conditions *Bleeding* et *Unconscious* (`CRB 042`)
- aire `talents` (fiche à extraire) — talent *Luck* (`CRB 021 l.388-390`)
- aire `religion` (fiche à extraire) — *Called to Account* (`CRB 065 l.73`)
- aire `magie` (fiche à extraire) — Lore of Heavens : *Fate's Fickle Fingers* (`CRB 071 l.247-253`), *Starcrossed* (`CRB 071 l.255-261`), les trois *Portents of Amul* (`CRB 071 l.263-285`)
- aire `conversion` (fiche à extraire) — « If an effect refers to Resilience, use Fate instead. » (`CRB 116 l.36`)

**Implémente :** (non implémenté)
- dette : #1873

---

## Achieving the Impossible — I Will Not Fail!

**Achieving the Impossible** est l'une des deux branches de dépense du **Fate Point** — l'autre étant **Cheating Death** (voir [Cheating Death — How Did That Miss? et Not Today!](#cheating-death--how-did-that-miss-et-not-today)) — et la **seule** qui porte sur la résolution d'un Test. La ressource engagée est le **Fate Point**, jamais le **Fortune Point** : les dépenses de Fortune (Advantage avant le jet, Reroll, retrait d'un Condition) sont une réserve distincte, décrite en [Fortune — Spend a Fortune Point to: et Replenishing Fortune](#fortune--spend-a-fortune-point-to-et-replenishing-fortune). *Nature, statut et reconstitution du Fate : voir [Fate — nature, rareté et Replenishing Fate](#fate--nature-rareté-et-replenishing-fate).*

La porte d'entrée de la branche est posée en une phrase : elle autorise la dépense « où l'échec semble certain », sans autre condition d'accès.

> « You may spend a Fate Point to succeed where failure seems certain. » — `CRB 025 l.30`

**La dépense — *I Will Not Fail!*** (`CRB 025 l.32`). C'est l'**unique** option de la section. Pour **1 Fate Point**, on ne lance **pas** le Test : on en **choisit le résultat** (« *Instead of rolling a Test, choose the result instead* »). Le RAW en tire quatre conséquences mécaniques, et aucune autre :

1. **Réussite automatique, sans condition de circonstance.** « *You automatically succeed, even in the direst circumstances.* » Aucune Difficulty, aucun SL Modifier, aucun contexte n'est posé comme pouvant l'empêcher — le texte dit explicitement « even in the direst circumstances ». La table des Difficulty (voir [DIFFICULTY AND CHARACTER MODIFIERS — DIFFICULTY TABLE](#difficulty-and-character-modifiers--difficulty-table)), qui module normalement le SL, ne peut donc pas s'y opposer.
2. **Le résultat est CHOISI, pas tiré.** La dépense se substitue au jet lui-même (« *Instead of rolling a Test* »), donc aux dés : il n'y a ni d100, ni double, ni Critical ni Fumble *subis*, puisque c'est le joueur qui fixe l'issue. Le mécanisme ordinaire — Critical/Fumble déterminés sur un double (voir [CRITICALS AND FUMBLES — le double](#criticals-and-fumbles--le-double)) — n'a pas de support, faute de jet ; de même, Advantage et Disadvantage, qui opèrent par inversion des chiffres du jet (voir [ADVANTAGE AND DISADVANTAGE — inversion des chiffres et cumul](#advantage-and-disadvantage--inversion-des-chiffres-et-cumul)), n'ont rien sur quoi s'appliquer.
3. **Opposed Test : victoire d'au moins +1 SL.** « *In an Opposed Test, you win by at least +1 SL.* » Le plancher est une victoire de **+1 SL** dans l'opposition, indépendamment du SL de l'adversaire ; le RAW ne plafonne pas ce que le joueur peut choisir au-delà, mais ne **garantit** que ce minimum. Le SL d'un Opposed Test étant la différence des SL des deux camps (voir [OPPOSED TESTS — les Tests opposés](#opposed-tests--les-tests-opposés)), ce plancher se lit sur l'échelle d'issues ordinaire (voir [OUTCOMES TABLE — lecture du SL final](#outcomes-table--lecture-du-sl-final)) : +1 SL y est une **Success**.
4. **Critical choisi → Hit Location choisie.** « *If you choose to score a Critical, you may pick the Hit Location instead of rolling randomly.* » Marquer un **Critical** est donc un **choix** ouvert au joueur dans le résultat qu'il fixe ; et s'il le fait, la **Hit Location** est **désignée** au lieu d'être tirée au hasard. Les règles de Hit Location sont portées par l'aire `combat` (fiche à extraire).

**Moment de la dépense.** Le texte est prescriptif : la dépense **remplace** le jet (« *Instead of rolling a Test* »), elle se décide donc **avant** que les dés soient lancés — c'est ce qui la distingue structurellement des dépenses de Fortune, dont le Reroll intervient **après** le jet (voir [Fortune — Spend a Fortune Point to: et Replenishing Fortune](#fortune--spend-a-fortune-point-to-et-replenishing-fortune)), et de *How Did That Miss?*, qui intervient **après** que les dés sont lancés mais avant résolution (voir [Cheating Death — How Did That Miss? et Not Today!](#cheating-death--how-did-that-miss-et-not-today)).

**Fréquence.** Aucune limite de fréquence n'est posée par la section : la seule borne est la réserve de Fate Points disponible — réserve dont la rareté et le régime d'octroi sont traités en [Fate — nature, rareté et Replenishing Fate](#fate--nature-rareté-et-replenishing-fate).

**Cadrage du GM.** Le chapitre du Gamemaster range la dépense de Fate parmi les moments forts de la partie et attend une **description** de l'exploit improbable :

> « Spending Fate is a Big Deal: it is powerful enough to cheat death. […] If they spend Fate to achieve the impossible (**I Will Not Fail!**), describe how they tap into previously unknown reserves of strength to hold the portcullis up long enough for their companions to roll under, or how the grappling hook wedges improbably in a crack of the wall, allowing them to climb up just as the beastmen round the corner. Spending Fate should always feel like a dramatic moment in the adventure. » — `CRB 076 l.71`

**Sources RAW** :
- `CRB 025 l.28-32` — section **Achieving the Impossible** : la dépense d'un Fate Point pour réussir là où l'échec semble certain, et son unique option **I Will Not Fail!** (résultat choisi au lieu du jet, réussite automatique, +1 SL minimum en Opposed Test, Hit Location choisie si l'on opte pour un Critical).
- `CRB 076 l.71` — **Using the Rules / Fate and Fortune** (chapitre du GM) : « Spending Fate is a Big Deal » ; cadrage narratif attendu pour *I Will Not Fail!* et statut de moment dramatique.
- `CRB 024 l.75-79` — **Opposed Tests** : définition du SL d'un Opposed Test (différence des SL, égalité à l'initiateur) dont le +1 SL garanti ici est le plancher — détail en [OPPOSED TESTS — les Tests opposés](#opposed-tests--les-tests-opposés).
- `CRB 024 l.37-44` — **Criticals and Fumbles** : le Critical s'obtient normalement sur un **double** au jet, ce que cette dépense court-circuite en supprimant le jet — détail en [CRITICALS AND FUMBLES — le double](#criticals-and-fumbles--le-double).
- `CRB 024 l.93-104` — **Outcomes Table** : échelle des issues sur laquelle se lit le résultat choisi — détail en [OUTCOMES TABLE — lecture du SL final](#outcomes-table--lecture-du-sl-final).

> « **I Will Not Fail!** Instead of rolling a Test, choose the result instead. You automatically succeed, even in the direst circumstances. In an Opposed Test, you win by at least +1 SL. If you choose to score a Critical, you may pick the Hit Location instead of rolling randomly. » — `CRB 025 l.32`

**Voir aussi** :
- [ROLL DICE — le d100 et le calcul du Success Level (SL)](#roll-dice--le-d100-et-le-calcul-du-success-level-sl) — mécanique du jet et calcul du SL
- [OUTCOMES TABLE — lecture du SL final](#outcomes-table--lecture-du-sl-final) — échelle de SL et intitulés d'issue
- [OPPOSED TESTS — les Tests opposés](#opposed-tests--les-tests-opposés) — calcul du SL d'un Opposed Test
- [CRITICALS AND FUMBLES — le double](#criticals-and-fumbles--le-double) — Critical/Fumble sur double
- [ADVANTAGE AND DISADVANTAGE — inversion des chiffres et cumul](#advantage-and-disadvantage--inversion-des-chiffres-et-cumul) — sans objet sans jet
- [DIFFICULTY AND CHARACTER MODIFIERS — DIFFICULTY TABLE](#difficulty-and-character-modifiers--difficulty-table) — Difficulty et SL Modifiers
- [Fortune — Spend a Fortune Point to: et Replenishing Fortune](#fortune--spend-a-fortune-point-to-et-replenishing-fortune) — ressource distincte
- [Cheating Death — How Did That Miss? et Not Today!](#cheating-death--how-did-that-miss-et-not-today) — l'autre branche des dépenses de Fate
- [Fate — nature, rareté et Replenishing Fate](#fate--nature-rareté-et-replenishing-fate) — nature, statut et reconstitution du Fate
- aire `combat` (fiche à extraire) — Hit Location

**Implémente :** (non implémenté)
- dette : #1873
