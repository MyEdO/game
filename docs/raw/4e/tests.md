# Atlas RAW — Tests & Degrés de Réussite

> Référentiel autosuffisant des règles WFRP4 (RAW). Chaque règle cite `LDB NN l.X-Y` (source = dernier recours). Voir [`sources.md`](../sources.md), [`00-index.md`](00-index.md).
> ⚠️ Les champs **Implémente** sont GÉNÉRÉS (`npm run raw:implemente` — source éditoriale : `src/data/raw.manifest.json`) — ne pas les éditer à la main.

## Sommaire

- [Types de tests — simple vs spectaculaire](#types-de-tests--simple-vs-spectaculaire)
- [Lancer le dé — mécanique de base](#lancer-le-dé--mécanique-de-base)
- [Succès et échec automatiques](#succès-et-échec-automatiques)
- [Doubles — Critique et Maladresse](#doubles--critique-et-maladresse)
- [Relance et inversion du dé](#relance-et-inversion-du-dé)
- [Modificateurs de test](#modificateurs-de-test)
- [Difficulté — table complète](#difficulté--table-complète)
- [Combiner les Difficultés — cumul et plafonds](#combiner-les-difficultés--cumul-et-plafonds)
- [Extensions de Difficulté : Presque Impossible et Impossible (EDO)](#extensions-de-difficulté--presque-impossible-et-impossible-edo)
- [Degrés de Réussite (DR)](#degrés-de-réussite-dr)
- [Table des Résultats](#table-des-résultats)
- [Tests opposés](#tests-opposés)
- [Tests étendus](#tests-étendus)
- [Soutien (Assistance)](#soutien-assistance)
- [Tests Combinés](#tests-combinés)
- [Tests de Caractéristique vs Tests de Compétence](#tests-de-caractéristique-vs-tests-de-compétence)
- [Option : Tests supérieurs à 100 %](#option--tests-supérieurs-à-100-)
- [Influencer un test — Chance, Résilience, Talents](#influencer-un-test--chance-résilience-talents)
- [Talents liés à un Test : bonus de DR](#talents-liés-à-un-test--bonus-de-dr)
- [Inversion de dé par Talent (variante du raté→réussi)](#inversion-de-dé-par-talent-variante-du-ratéréussi)
- [Jeux de Taverne — mécaniques NADJ (doubles, relance, DR, résolution rapide)](#jeux-de-taverne--mécaniques-nadj-doubles-relance-dr-résolution-rapide)

---

## Types de tests — simple vs spectaculaire

Il existe deux grandes catégories de tests, correspondant à deux niveaux de précision dans la résolution d'une action.

**Test simple** : utilisé pour déterminer rapidement si un personnage réussit ou échoue une tâche simple. Le résultat est binaire : succès ou échec. Convient aux situations où une réponse rapide permet de faire avancer l'aventure et où la mesure exacte du succès n'est pas nécessaire.

**Test spectaculaire** : utilisé quand il est important de savoir non seulement si le personnage réussit, mais aussi *dans quelle mesure*. C'est le type de test privilégié lorsque l'avancée de l'aventure en dépend vraiment, lors de confrontations (tests opposés) ou en combat et en magie. Les tests spectaculaires fournissent des réponses plus précises grâce aux Degrés de Réussite.

Le chapitre ne pose pas d'arbre de décision : il énonce un critère de bascule. Le Test simple tient tant qu'une réponse binaire fait avancer l'aventure ; on passe au Test spectaculaire quand il faut savoir *à quel point* le Test est réussi ou raté, quand l'échec pèserait sur la progression, ou quand l'avancée de l'aventure en dépend.

> « Souvent, le fait de répondre rapidement oui ou non permet une progression rapide de l'aventure. L'exception la plus notable est lorsqu'un échec risque d'avoir un impact significatif sur la progression de l'aventure. Vous devriez alors utiliser plutôt un Test spectaculaire (voir ci-dessous). » — `LDB 12 l.5`

> « Donc, lorsque vous souhaitez savoir à quel point vous avez réussi ou raté un Test, utilisez un Test spectaculaire. » — `LDB 12 l.84`

> « Il est également pertinent de choisir un Test spectaculaire lorsque l'avancée de l'aventure en dépend vraiment. » — `LDB 12 l.86`

**Sources RAW** :
- `LDB 12 l.5-7` — définition du Test simple et critère de bascule
- `LDB 12 l.83-88` — définition du Test spectaculaire (l.84 et l.86 : quand le choisir)

**Voir aussi** : [Tests opposés](#tests-opposés), [Tests étendus](#tests-étendus)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 12` (l.5-7, l.83-88) → `canReroll`, `getTestPolicy`, `test-fast-sl`, `test-over-100`, `RollInfluenceView`, `RollRowCore`, `RollRow`, `rollTest`, `useTestJetProps`, `opposedForcedFloor`, +8 — `src/data/reglesOptionnelles.json`, `src/engine/fortune.ts`, `src/engine/testPolicy.ts`, `src/engine/tests.ts`, `src/engine/types.ts`, `src/state/merchantFlow.ts`, +6 fichiers

---

## Lancer le dé — mécanique de base

Pour effectuer tout test (simple ou spectaculaire), on lance **1d100** et on compare le résultat à la Compétence ou à la Caractéristique utilisée, **après** application de la Difficulté (modificateurs).

- Si le résultat est **inférieur ou égal** à la valeur modifiée → **succès**.
- Si le résultat est **supérieur** à la valeur modifiée → **échec**.

La valeur cible est la Compétence ou la Caractéristique du personnage telle qu'indiquée sur la feuille, augmentée ou diminuée des modificateurs de Difficulté. Le MJ indique la Compétence ou la Caractéristique à utiliser, et annonce la Difficulté avant le lancer.

> « Pour effectuer un Test simple, vous lancez 1d100 et vous comparez le résultat obtenu à la Compétence ou à la Caractéristique qui correspond le plus à l'action que vous entreprenez. » — `LDB 12 l.7`

**Exemple** (extrait des règles) : la Compétence d'Athlétisme de Molli est de 42. Elle obtient 17. Comme 17 ≤ 42, le test est un succès.

**Sources RAW** :
- `LDB 12 l.7-13` — mécanique fondamentale du 1d100 sous la valeur cible

**Voir aussi** : [Difficulté](#difficulté--table-complète), [Degrés de Réussite (DR)](#degrés-de-réussite-dr)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 12` (l.7-13) → `canReroll`, `RollInfluenceView`, `RollRowCore`, `RollRow`, `rollTest`, `useTestJetProps`, `RollFlowLens`, `bumpResultSL`, `makeRollFlow`, `FLOWS` — `src/engine/fortune.ts`, `src/engine/tests.ts`, `src/state/rollFlowFactory.ts`, `src/state/rollFlowSpecs.ts`, `src/ui/RollRow.tsx`, `src/ui/jetProps/useTestJetProps.tsx`, +1 fichiers

---

## Succès et échec automatiques

Quel que soit le niveau de Compétence ou de Caractéristique, il existe toujours une possibilité d'échec et une possibilité de succès.

- Un résultat de **01 à 05** est toujours un **succès automatique**, même si la valeur modifiée est inférieure à 01-05.
- Un résultat de **96 à 00** est toujours un **échec automatique**, même si la valeur modifiée est de 96 ou plus.

Ces bandes automatiques s'appliquent à *tous* les tests, simples ou spectaculaires.

**DR des bandes automatiques** (dans un test spectaculaire) :
- Réussite automatique sur 01-05 : le DR est au minimum +1 (ou le DR calculé normalement, si celui-ci est plus élevé).
- Échec automatique sur 96-00 : le DR est au maximum −1 (ou le DR calculé normalement, si celui-ci est plus défavorable).

**Option — « Pas à ma table ! »** : le groupe peut modifier les bandes à sa convenance. L'alternative la plus courante est un échec automatique sur 96-00 uniquement et un succès automatique sur 01 uniquement.

**Sources RAW** :
- `LDB 12 l.25-28` — réussite et échec automatiques (bandes 01-05 / 96-00)
- `LDB 12 l.31-32` — option pour modifier les bandes
- `LDB 12 l.119-121` — DR minimum/maximum des bandes automatiques dans un test spectaculaire

**Voir aussi** : [Degrés de Réussite (DR)](#degrés-de-réussite-dr)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 12` (l.25-28, l.31-32, l.119-121) → `canReroll`, `test-auto-bands`, `TestPolicy`, `test-critiques-doubles`, `getTestPolicy`, `test-fast-sl`, `ChanceButtons`, `amazingTestLabel`, `useTestJetProps`, `RollRowCore`, +26 — `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/engine/crewMorale.ts`, `src/engine/fortune.ts`, `src/engine/reverseToken.ts`, `src/engine/testPolicy.ts`, +10 fichiers

---

## Doubles — Critique et Maladresse

Un **double** est un résultat de dé d100 dont le chiffre des dizaines et le chiffre des unités sont identiques : 11, 22, 33, 44, 55, 66, 77, 88, 99, ou 00.

Dans le cadre des règles de base, les doubles sont un outil disponible que le MJ peut utiliser pour ajouter des conséquences spécifiques. Il existe une règle optionnelle (hors combat) :

**Option — Critiques et Maladresses** :
- Un test dont le résultat est à la fois un **succès et un double** est un **Critique** : il est traité comme un Succès Stupéfiant (DR 6+) sur le Tableau des Résultats.
- Un test dont le résultat est à la fois un **échec et un double** est une **Maladresse** : elle est traitée comme un Échec Stupéfiant (DR −6 ou moins) sur le Tableau des Résultats.

Cette règle optionnelle fonctionne particulièrement bien avec les Tests simples, ajoutant un côté amusant aux résultats binaires habituels. Des règles spécifiques pour les Critiques et Maladresses en **Combat** sont décrites dans le chapitre Combat.

> « Obtenir un Double signifie que le chiffre des dizaines et celui des unités, obtenus sur un jet de pourcentage, sont identiques. Par exemple : 11, 22, 33, 44, etc. » — `LDB 12 l.38`

**Sources RAW** :
- `LDB 12 l.38` — définition d'un double
- `LDB 12 l.124-127` — règle optionnelle Critiques et Maladresses sur tous les tests

**Voir aussi** : chapitre Combat (Critiques et Maladresses en combat)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 12` (l.38, l.124-127) → `canReroll`, `test-auto-bands`, `TestPolicy`, `test-critiques-doubles`, `getTestPolicy`, `test-fast-sl`, `ChanceButtons`, `amazingTestLabel`, `useTestJetProps`, `RollRowCore`, +24 — `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/engine/fortune.ts`, `src/engine/reverseToken.ts`, `src/engine/testPolicy.ts`, `src/engine/tests.ts`, +9 fichiers

---

## Relance et inversion du dé

Deux mécanismes permettent de modifier un résultat de dé :

**Relance** : on ignore le résultat initial du dé et on le relance. Une fois qu'une relance a été effectuée sur un test, il n'est plus possible de relancer de nouveau, sauf circonstances exceptionnelles.

**Inverser** : on intervertit le chiffre des dizaines et le chiffre des unités d'un jet de pourcentage. Ainsi, un 58 devient un 85 et un 51 devient un 15. Si le résultat est un double (11, 22, etc.), l'inversion ne change rien.

Ces deux mécanismes constituent, avec les modificateurs et les doubles, les briques de base de la mécanique de dés de WFRP4.

> « Pour inverser un jet de pourcentage, vous intervertissez le chiffre des unités avec celui des dizaines. De cette façon, un 58 devient un 85 et un 51 devient 15. » — `LDB 12 l.42`

**Sources RAW** :
- `LDB 12 l.40` — définition de la Relance (une seule par test sauf exception)
- `LDB 12 l.42` — définition de l'Inversion

**Voir aussi** : Chance (Points de Chance permettant la relance), Résilience (dé forcé)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 12` (l.40, l.42) → `canReroll`, `test-auto-bands`, `getTestPolicy`, `ChanceButtons`, `test-over-100`, `RollRowCore`, `test-auto-band-width`, `rerollAvailable`, `NightEntry`, `PendingTest`, +12 — `src/data/reglesOptionnelles.json`, `src/engine/fortune.ts`, `src/engine/reverseToken.ts`, `src/engine/testPolicy.ts`, `src/state/pendings.ts`, `src/state/restFlow.ts`, +4 fichiers

---

## Modificateurs de test

Les modificateurs sont des nombres ajoutés ou soustraits à la **valeur cible** d'un test (Compétence ou Caractéristique) pour rendre ce dernier plus facile ou plus difficile. On parle le plus souvent de Difficulté.

Ils s'appliquent *à la valeur cible*, non au résultat du dé. Un modificateur de +20 signifie que le personnage dispose de 20 % de chances supplémentaires de réussir son test.

Le MJ peut décider d'appliquer des pénalités ou des bonus supérieurs à ceux indiqués dans le Tableau de Difficulté, mais de tels modificateurs ne doivent être utilisés que dans des situations exceptionnelles.

**Deux sources alimentent la valeur cible** (au-delà de la Base = Compétence ou Caractéristique) :
1. La **Difficulté** proprement dite — une entrée de la [table de Difficulté](#difficulté--table-complète) choisie par le MJ.
2. Les **modificateurs circonstanciels** — facteurs situationnels additionnés à la Difficulté. Hors combat, le MJ les traduit en une Difficulté ; **en combat, ils sont codifiés** (Avantage ×10, viser, portée, taille, supériorité numérique, couverture, États…) dans [`combat.md` § Difficultés de Combat](combat.md).

Ainsi : **valeur cible = Base + Difficulté + Σ modificateurs circonstanciels**. Quand plusieurs modificateurs s'appliquent, ils se **cumulent avec des plafonds** — voir [Combiner les Difficultés](#combiner-les-difficultés--cumul-et-plafonds).

**Sources RAW** :
- `LDB 12 l.44` — définition des modificateurs
- `LDB 12 l.133-137` — application des modificateurs par le MJ

**Voir aussi** : [Difficulté](#difficulté--table-complète), [Combiner les Difficultés](#combiner-les-difficultés--cumul-et-plafonds)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 12` (l.44, l.133-137) → `canReroll`, `test-auto-bands`, `test-critiques-doubles`, `ChanceButtons`, `amazingTestLabel`, `test-over-100`, `useTestJetProps`, `RollRowCore`, `test-auto-band-width`, `rerollAvailable`, +15 — `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/engine/fortune.ts`, `src/engine/reverseToken.ts`, `src/state/flowOutcomes.ts`, `src/state/pendings.ts`, +6 fichiers

---

## Difficulté — table complète

Avant chaque test, le MJ consulte le Tableau de Difficulté pour déterminer le modificateur approprié. Ce modificateur est ajouté (ou soustrait) à la valeur de Compétence ou de Caractéristique du personnage.

| Difficulté      | Modificateur au Test |
|-----------------|---------------------|
| Très Facile     | +60                 |
| Facile          | +40                 |
| Accessible      | +20                 |
| Intermédiaire   | +0                  |
| Complexe        | −10                 |
| Difficile       | −20                 |
| Très Difficile  | −30                 |

Si aucune Difficulté n'est indiquée pour un test (notamment pour un test opposé), on considère qu'il est **Intermédiaire** (+0).

**Exemple** (extrait des règles) : Valentyn a une Compétence de Pistage de 41. Le MJ impose Très Difficile (−30) à cause de la pluie. La valeur cible devient 11 (41 − 30 = 11). Un résultat de 35 est un échec.

**Sources RAW** :
- `LDB 12 l.141-150` — Tableau de Difficulté (table verbatim)
- `LDB 12 l.133-139` — règle d'application de la Difficulté
- `LDB 12 l.166` — « Si aucune Difficulté n'est indiquée pour un Test opposé, on considère qu'il est Intermédiaire »

**Voir aussi** : [Modificateurs de test](#modificateurs-de-test), [Tests opposés](#tests-opposés)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 12` (l.133-139, l.141-150, l.166) → `useExtendedTestJetProps`, `RecoverOpposition`, `test-critiques-doubles`, `RecoverResolution`, `AuContactModal`, `GrappleModal`, `BargainModalView`, `TraceOpposed`, `amazingTestLabel`, `MedicState`, +85 — `src/data/flow-stakes.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/grammaire/mecanique.ts`, `src/engine/combat.ts`, `src/engine/flowCore.ts`, +44 fichiers

---

## Combiner les Difficultés — cumul et plafonds

Quand **plusieurs facteurs** affectent un même test, on **somme** leurs modificateurs, mais chaque sens est **plafonné** :

- La somme des **pénalités** ne peut dépasser **Très Difficile (−30)**.
- La somme des **bonus** ne peut dépasser **Très Facile (+60)**.
- Une pénalité et un bonus simultanés se somment **algébriquement** (chaque sens est plafonné, puis on additionne les deux totaux).

**Exemples** (extraits des règles) :
- Brouillard (−20) + Localisation précise (−20) = −40 → plafonné à **Très Difficile (−30)**.
- Neige jusqu'à la taille (−30) + adversaire *À Terre* (+20) = **Difficile (−10)** (−30 + 20).

> « Si la situation nécessite l'ajout de deux pénalités ou plus, contentez-vous de faire la somme des différents modificateurs sans dépasser **Très Difficile -30**. […] si la situation implique l'addition de deux bonus, faites la somme des modificateurs jusqu'à un maximum de **+60** ou **Très Facile**. » — `LDB 14 l.95`

**Extension EDO** : dans *L'Ennemi Intérieur*, le plafond des pénalités cumulées passe à **−50** (Impossible) — voir [Extensions de Difficulté](#extensions-de-difficulté--presque-impossible-et-impossible-edo).

**Portée de la règle** : le plafond borne la **combinaison des circonstances** — celles que le chapeau de la table énumère (« les effets dus au terrain, aux conditions météorologiques et à tout un tas d'autres facteurs », `LDB 14 l.48`) et dont les deux exemples chiffrés (l.95-96) sont exclusivement composés. Il ne borne PAS les modificateurs portés par le **jeteur** : les États (« si vous avez 3 États *Exténué*, vous subissez une pénalité de -30 à tous vos Tests », `LDB 16 l.11` — une accumulation qui s'annulerait au 4ᵉ pion si le plafond mordait), le Soutien (`LDB 12 l.189`), l'Avantage. La **liste codifiée des modificateurs circonstanciels de combat** (viser, portée, taille, supériorité numérique, couverture, État *de la cible* — À Terre `l.64`, `l.93`…) est dans [`combat.md` § Difficultés de Combat](combat.md). Note d'implémentation : la frontière vit sur la ligne de modificateur (`ModLine.famille`, `circonstance` vs `jet`), et `combineMods` (`src/engine/combat.ts`) ne combine que les circonstances.

**Sources RAW** :
- `LDB 14 l.91-96` — Combiner les Difficultés (somme, plafonds par sens, mélange algébrique)
- `EDO App.2 l.157-165` (rappel) — plafond des pénalités cumulées porté à −50

**Voir aussi** : [Difficulté — table complète](#difficulté--table-complète), [Modificateurs de test](#modificateurs-de-test), [Extensions de Difficulté (EDO)](#extensions-de-difficulté--presque-impossible-et-impossible-edo)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 12` (l.189) → `useExtendedTestJetProps`, `soutien`, `BargainModalView`, `SequenceParams`, `runSceneConsumableFlow`, `test-extended-min-sl`, `RollRequest`, `buildStageSteps`, `PendingTest`, `hasSkillAdvance`, +35 — `src/data/flow-stakes.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/grammaire/mecanique.ts`, `src/engine/activities.ts`, `src/engine/combat.ts`, +22 fichiers
- `LDB 14` (l.48, l.91-96) → `vous-vous-blessez-en-attaquant-perdez-1-blessure-ignore-be-pa`, `COVER_MOD`, `SceneCombatMods`, `arme-abimee-1-degat-vous-agirez-en-dernier-au-prochain-round`, `decorCover`, `fr`, `SANS_LIVRE`, `10-a-votre-action-au-prochain-round`, `doc`, `sceneCombatModifiers`, +69 — `src/data/actions.json`, `src/data/oups.json`, `src/data/props.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs-scenes/scene.ts`, +26 fichiers
- `LDB 16` (l.11) → `effectiveChar`, `addCondition`, `addClockCondition`, `defenseValueMods`, `etatTestMods`, `PoolCandidate`, `dropWorst`, `poolWinner`, `GameOp`, `FREE_ATTACK_LABEL`, +10 — `src/data/index.ts`, `src/engine/characteristics.ts`, `src/engine/combat.ts`, `src/engine/conditions.ts`, `src/engine/ops.ts`, `src/engine/trauma.ts`, +2 fichiers

---

## Degrés de Réussite (DR)

Les Degrés de Réussite (DR) sont utilisés pour définir l'efficacité d'un Test spectaculaire. Ils indiquent dans quelle mesure un test a été réussi ou raté.

**Formule de base** :

> DR = dizaine(valeur cible) − dizaine(résultat du dé)

Autrement dit, on soustrait le **chiffre des dizaines du résultat obtenu** au **chiffre des dizaines de la Compétence ou Caractéristique modifiée**.

- DR positif → succès (plus le DR est élevé, meilleur est le résultat)
- DR négatif → échec (plus il est bas, plus l'échec est grave)
- DR 0 → succès ou échec d'un cheveu ; peut être interprété comme réussi ou raté de peu, avec des conséquences minimes, ou comme un résultat peu concluant permettant un nouvel essai

**Exemple** (extrait des règles) :
- Eichengard obtient 21 sur un test de Chevaucher (Cheval) 49. Dizaine de la compétence = 4, dizaine du jet = 2. DR = 4 − 2 = +2 → succès.
- Sur un test de Perception 39, il obtient 82. Dizaine de la compétence = 3, dizaine du jet = 8. DR = 3 − 8 = −5 → échec impressionnant.

**Option — Calculer rapidement un DR** : sur une réussite, le DR est simplement le chiffre des dizaines du résultat du dé. Cette méthode rend le calcul plus fluide. En cas d'échec, on calcule le DR normalement. Avec cette règle optionnelle, plus le résultat est proche de la Compétence utilisée, mieux c'est.

**Sources RAW** :
- `LDB 12 l.90-94` — définition et formule des DR
- `LDB 12 l.96-99` — exemples de calcul de DR
- `LDB 12 l.100-102` — règle optionnelle « Calculer Rapidement un DR »
- `LDB 12 l.119-121` — DR des bandes automatiques (01-05 → min +1 ; 96-00 → max −1)

**Voir aussi** : [Table des Résultats](#table-des-résultats), [Tests opposés](#tests-opposés), [Succès et échec automatiques](#succès-et-échec-automatiques)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 12` (l.90-94, l.96-99, l.100-102, l.119-121) → `bargainBuyFactor`, `test-critiques-doubles`, `test-fast-sl`, `amazingTestLabel`, `test-over-100`, `forceCrewRole`, `useTestJetProps`, `double-critique-maladresse`, `evaluateTest`, `opposedForcedFloor`, +12 — `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/engine/bargain.ts`, `src/engine/crewMorale.ts`, `src/engine/testPolicy.ts`, `src/engine/tests.ts`, +7 fichiers

---

## Table des Résultats

Le niveau de succès ou d'échec est qualifié par la Table des Résultats, qui aide le MJ à décrire les conséquences du test.

| DR       | Résultat             | Conséquence |
|----------|----------------------|-------------|
| 6+       | Succès Stupéfant     | Parfait ! — Le résultat n'aurait pas pu être meilleur, la chance et les circonstances ont mené à la perfection ! |
| 4 ou 5   | Succès Impressionnant | Oui, et… — vous atteignez votre objectif avec style, tout en faisant mieux que ce que vous espériez |
| 2 ou 3   | Succès               | Oui — parfaitement réussi |
| 0 ou 1   | Succès Minime        | Oui, mais… — vous avez plus ou moins réussi ce que vous vouliez effectuer, mais ce n'est pas parfait, et des effets inattendus sont possibles |
| −1 ou 0  | Échec Minime         | Non, mais… — vous avez échoué, même si vous avez peut-être réussi une partie de ce que vous avez tenté |
| −2 ou −3 | Échec                | Non — tout s'est déroulé de travers |
| −4 ou −5 | Échec Impressionnant | Non, et… — non seulement vous avez échoué, mais votre échec a des conséquences sur d'autres choses |
| −6 ou moins | Échec Stupéfant   | Rien à faire ! — tout est allé de travers, de la pire des manières possible. Le MJ devrait ajouter à votre infortune certaines nouvelles conséquences à vos actions. |

*Note* : DR 0 apparaît dans deux lignes (Succès Minime et Échec Minime). La distinction est faite par le résultat numérique brut : si le jet est ≤ valeur cible → Succès Minime ; si le jet est > valeur cible → Échec Minime.

**Sources RAW** :
- `LDB 12 l.105-114` — Tableau des Résultats (table verbatim)
- `LDB 12 l.116-117` — explication de l'utilisation de la table

**Voir aussi** : [Degrés de Réussite (DR)](#degrés-de-réussite-dr), [Doubles — Critique et Maladresse](#doubles--critique-et-maladresse)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 12` (l.105-114, l.116-117) → `bargainBuyFactor`, `test-critiques-doubles`, `test-fast-sl`, `amazingTestLabel`, `forceCrewRole`, `useTestJetProps`, `double-critique-maladresse`, `evaluateTest`, `bestForcedRoll`, `SUCCES_MINIME_CAP`, +6 — `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/engine/bargain.ts`, `src/engine/crewMorale.ts`, `src/engine/testPolicy.ts`, `src/engine/tests.ts`, +3 fichiers

---

## Tests opposés

Un test opposé est utilisé lorsqu'un personnage doit confronter ses capacités à celles d'un adversaire ou d'un autre personnage. C'est un test spectaculaire, mais les deux parties effectuent leur propre jet.

**Résolution** :
1. Chaque participant effectue un test spectaculaire avec sa Compétence ou Caractéristique appropriée.
2. Le participant avec le **DR le plus élevé** remporte le test opposé.
3. En cas d'**égalité de DR**, c'est le participant avec la **Compétence ou la Caractéristique la plus élevée** qui l'emporte — le Niveau de Compétence (`LDB 09 l.17`), non la valeur cible modifiée.
4. En cas d'**égalité parfaite** (même DR et même Compétence ou Caractéristique), le MJ choisit entre : statu quo (rien ne se passe) ou rejouer le test jusqu'à désignation d'un vainqueur.

**DR net** : si l'on souhaite connaître la mesure de la victoire, on calcule la différence entre les deux DR. Ce DR net est utilisé notamment pour les dégâts en combat.

**Modificateurs** : les tests opposés peuvent aussi recevoir une Difficulté. Généralement, elle s'applique aux deux participants. Si aucune Difficulté n'est indiquée, le test est Intermédiaire.

**Exemple** (extrait des règles) : Salundra (Intimidation 47) obtient 04 → DR 4. L'officier (Commandement 46) obtient 16 → DR 3. Salundra l'emporte (4 > 3).

> « C'est le groupe avec le DR le plus élevé qui remporte le Test. Si les deux participants obtiennent le même DR, c'est le groupe avec la Compétence ou la Caractéristique la plus élevée qui l'emporte. » — `LDB 12 l.160`

**Sources RAW** :
- `LDB 12 l.152-169` — règles complètes des tests opposés
- `LDB 12 l.160` — critère de victoire (DR le plus haut, puis Compétence ou Caractéristique la plus élevée)
- `LDB 12 l.164` — DR net du vainqueur
- `LDB 12 l.166` — Difficulté par défaut = Intermédiaire si non indiquée

**Voir aussi** : [Tests spectaculaires](#types-de-tests--simple-vs-spectaculaire), [Degrés de Réussite (DR)](#degrés-de-réussite-dr)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 9` (l.17) → `doc`, `possesses`, `RecoverResolution`, `DispelModal`, `useTestJetProps`, `AppraiseModalView`, `BargainModalView`, `HealRollFlow`, `TestResult`, `SurgeryRollFlow`, +29 — `src/data/index.ts`, `src/data/schemas/defs/skills.ts`, `src/engine/axes.ts`, `src/engine/combat.ts`, `src/engine/magic.ts`, `src/engine/skillCombatApps.ts`, +20 fichiers
- `LDB 12` (l.152-169) → `useExtendedTestJetProps`, `RecoverOpposition`, `soutien`, `test-critiques-doubles`, `RecoverResolution`, `AuContactModal`, `GrappleModal`, `BargainModalView`, `TraceOpposed`, `MedicState`, +85 — `src/data/flow-stakes.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/grammaire/mecanique.ts`, `src/engine/combat.ts`, `src/engine/flowCore.ts`, +42 fichiers

---

## Tests étendus

Les tests étendus servent à résoudre des tâches particulièrement longues ou ardues qui nécessitent d'atteindre un certain DR total cumulé.

**Mécanique** :
- Le MJ fixe une **valeur cible** exprimée en DR total (`LDB 12 l.174`) à atteindre (par exemple, 5 DR).
- À chaque Round, le personnage effectue un test spectaculaire.
- Les DR obtenus sont **additionnés d'un round à l'autre** jusqu'à atteindre la valeur cible.
- Si le DR total **passe en dessous de 0**, le personnage recommence depuis le début au début du round suivant (perte de tous les DR accumulés).

**Exemple** (extrait des règles) : Molli (Crochetage 58) doit cumuler 5 DR en 3 rounds.
- Round 1 : jet 63 → DR −1. Total = −1. Elle recommence depuis 0.
- Round 2 : jet 11 → DR +4. Total = 4.
- Round 3 : jet 42 → DR +1. Total = 5. Succès !

**Option — DR 0 dans un test étendu** : un DR de 0 n'a aucune incidence sur le total, ce qui peut sembler étrange. La règle optionnelle suivante peut être appliquée : un test réussi ajoute au minimum +1 au total, et un test raté retire au minimum −1 au total.

**Sources RAW** :
- `LDB 12 l.171-180` — règles des tests étendus
- `LDB 12 l.174` — DR total < 0 = recommencer depuis le début au prochain round
- `LDB 12 l.182-185` — règle optionnelle DR 0 = ±1 minimum

**Voir aussi** : [Tests spectaculaires](#types-de-tests--simple-vs-spectaculaire), [Degrés de Réussite (DR)](#degrés-de-réussite-dr)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 12` (l.171-180, l.182-185) → `useExtendedTestJetProps`, `soutien`, `AuContactModal`, `GrappleModal`, `BargainModalView`, `MedicState`, `StateRecoveryModalView`, `SequenceParams`, `opposedLines`, `test-extended-min-sl`, +48 — `src/data/flow-stakes.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/grammaire/mecanique.ts`, `src/engine/activities.ts`, `src/engine/combat.ts`, +32 fichiers

---

## Soutien (Assistance)

Lorsque plusieurs personnages travaillent ensemble à la même tâche, ceux qui n'effectuent pas le test principal peuvent apporter leur **soutien** à celui qui lance les dés.

**Règle** :
- Le personnage qui possède la plus forte chance de réussite lance les dés.
- Chaque personnage qui apporte son soutien octroie un **bonus de +10** au test.
- Le test est effectué normalement par ailleurs.

**Limites du soutien** :
- Pour apporter leur soutien, tous les personnages doivent posséder au moins **une Augmentation** dans la Compétence utilisée pour le test.
- Le personnage qui soutient doit normalement être **adjacent** à celui qui effectue le test.
- Il n'est pas possible de soutenir des personnages qui font des tests pour **résister à la maladie, au poison, à la peur, au danger**, ou dans toute autre situation jugée inappropriée par le MJ.
- Le personnage qui effectue le test ne peut pas être soutenu par plus de personnages que son propre **Bonus dans la Caractéristique appropriée**.

**Exemple** (extrait des règles) : Adhémar (Perception 59) est soutenu par Perdita et Valentyn (tous deux avec des Augmentations en Perception). Le test est Complexe (−10). Valeur cible = 59 − 10 + 20 = 69. Jet obtenu : 74 → échec.

**Sources RAW** :
- `LDB 12 l.187-200` — règles du Soutien et de ses limites

**Voir aussi** : [Modificateurs de test](#modificateurs-de-test)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 12` (l.187-200) → `useExtendedTestJetProps`, `soutien`, `fr`, `testBreakdown`, `BargainModalView`, `ActivityModal`, `SequenceParams`, `RollRowCore`, `runSceneConsumableFlow`, `test-extended-min-sl`, +56 — `src/data/flow-stakes.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/grammaire/mecanique.ts`, `src/engine/activities.ts`, `src/engine/combat.ts`, +31 fichiers

---

## Tests Combinés

Parfois, une situation requiert qu'un personnage réussisse deux Compétences distinctes pour accomplir une tâche unique. Plutôt que d'effectuer deux tests successifs (ce qui réduit drastiquement les chances de succès), il est possible d'effectuer un seul test.

**Règle optionnelle** :
- On lance **un seul d100**, comparé successivement aux deux valeurs cibles.
- Si le résultat est positif pour les **deux** Compétences → **succès complet**.
- Si le résultat est positif pour **une seule** Compétence → **réussite partielle**.
- Si le résultat est négatif pour les **deux** Compétences → **échec**.

**Exemple** (extrait des règles) : Salundra effectue un test combiné de Représentation (Danse) 53 et Divertissement (Chant) (pas de compétence → Sociabilité 43). Elle obtient 46 : réussite sur la Danse (DR +1) mais échec sur le Chant (DR 0) → réussite partielle.

**Sources RAW** :
- `LDB 12 l.202-208` — règle optionnelle des Tests Combinés

**Voir aussi** : [Tests spectaculaires](#types-de-tests--simple-vs-spectaculaire)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 12` (l.202-208) → `soutien`, `fr`, `testBreakdown`, `BargainModalView`, `ActivityModal`, `RollRowCore`, `runSceneConsumableFlow`, `test-extended-min-sl`, `RollRequest`, `PendingTest`, +35 — `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/grammaire/mecanique.ts`, `src/engine/activities.ts`, `src/engine/combat.ts`, `src/engine/flowCore.ts`, +22 fichiers

---

## Tests de Caractéristique vs Tests de Compétence

WFRP4 distingue deux types de valeurs cibles pour un test :

**Tests de Compétence** : le personnage utilise la valeur de l'une de ses Compétences (listées sur la feuille). C'est le cas le plus courant.

**Tests de Caractéristique** : quand aucune Compétence ne couvre l'action que le personnage veut entreprendre, le MJ détermine la Caractéristique la plus appropriée (CC, CT, F, E, Ag, I, Dex, Int, FM, Soc) et le personnage effectue le test normalement contre cette valeur brute.

La mécanique du lancer est strictement identique dans les deux cas.

**Sources RAW** :
- `LDB 12 l.130-131` — définition du Test de Caractéristique

**Voir aussi** : [Lancer le dé — mécanique de base](#lancer-le-dé--mécanique-de-base)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 12` (l.130-131) → `test-critiques-doubles`, `amazingTestLabel`, `useTestJetProps`, `double-critique-maladresse` — `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/state/flowOutcomes.ts`, `src/ui/jetProps/useTestJetProps.tsx`

---

## Option : Tests supérieurs à 100 %

Lorsque la valeur modifiée d'une Compétence ou d'une Caractéristique atteint **100 % ou plus**, la règle optionnelle suivante s'applique :

- Un test réussi gagne un bonus de **+1 DR pour chaque tranche de 10 % au-delà de 100 %**.

**Exemple** : la comtesse Emmanuelle von Liebwitz possède une Compétence de Charme de 115 %. Si elle réussit le test, elle gagne un bonus de +1 DR (car 115 % − 100 % = 15 %, soit 1 tranche de 10 %).

Sans cette règle optionnelle, la valeur cible est plafonnée à 99 pour les calculs de DR (le dé ne pouvant de toute façon aller au-delà).

**Sources RAW** :
- `LDB 12 l.74-80` — règle optionnelle « Tests supérieurs à 100 % »

**Voir aussi** : [Degrés de Réussite (DR)](#degrés-de-réussite-dr)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 12` (l.74-80) → `getTestPolicy`, `test-fast-sl`, `test-over-100` — `src/data/reglesOptionnelles.json`, `src/engine/testPolicy.ts`

---

## Extensions de Difficulté : Presque Impossible et Impossible (EDO)

La campagne **L'Ennemi dans l'Ombre** introduit deux niveaux de Difficulté supplémentaires, à ajouter au Tableau de Difficulté standard du LDB. Ils sont utilisés dans toute la série **L'Ennemi Intérieur**.

| Difficulté          | Modificateur au Test |
|---------------------|---------------------|
| Presque Impossible  | −40                 |
| Impossible          | −50                 |

**Plafond cumulé** : −50 est désormais la pénalité maximale quand on cumule plusieurs Difficultés (référence explicite à LDB p. 162 sur la combinaison de Difficultés). Même si plusieurs modificateurs cumulés dépassent −50, la valeur cible ne peut descendre en dessous de ce plancher.

**Interaction avec les bandes automatiques** : il est fortement recommandé d'utiliser ces niveaux conjointement avec les règles de Réussite et d'Échec automatiques (LDB p. 150). Cela garantit qu'un jet de 01-05 reste toujours un succès (+0 DR minimum), même si le modificateur devrait théoriquement rendre la réussite impossible.

**Si ces niveaux ne sont pas utilisés** : remplacer simplement Presque Impossible (−40) et Impossible (−50) par Très Difficile (−30) dans tous les modules de la campagne.

> « Cela signifie également que -50 est désormais la pénalité maximale lors de la combinaison de Difficultés, comme expliqué sur page 162 du Livre de Règles. » — `EDO App.2 l.158`

**Sources RAW** :
- `EDO App.2 l.157-165` — table des deux niveaux supplémentaires, plafond à −50, recommandation sur les bandes automatiques
- `LDB 12 l.133-137` (rappel) — règle de base sur la combinaison de Difficultés

**Voir aussi** : [Difficulté — table complète](#difficulté--table-complète), [Succès et échec automatiques](#succès-et-échec-automatiques)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 12` (l.133-137) → `test-critiques-doubles`, `amazingTestLabel`, `useTestJetProps`, `double-critique-maladresse` — `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/state/flowOutcomes.ts`, `src/ui/jetProps/useTestJetProps.tsx`

---

## Influencer un test — Chance, Résilience, Talents

Trois mécanismes permettent à un joueur de modifier le résultat d'un test *après* ou *à la place* du lancer. Ce sont des couches au-dessus de la mécanique de base, décrites dans le chapitre Destin et Résilience (LDB 17).

### Points de Chance (dépense d'un Point de Chance)

On peut dépenser un Point de Chance pour l'un des effets suivants :

1. **Relancer un test qui s'est soldé par un échec.** On ignore le résultat initial et on relance. Une fois la relance effectuée, on ne peut plus en effectuer une autre (sauf circonstance exceptionnelle).
2. **Ajouter +1 DR à un test après qu'il a été effectué.** Cela peut transformer un Succès Minime (DR 0) en Succès (DR 1), par exemple.
3. **Choisir son moment d'action au début d'un Round** (effet tactique de combat — hors domaine Tests, mais cité pour exhaustivité).

Les Points de Chance se reconstituent au début de chaque session, jusqu'à un maximum égal à l'Indice de Destin actuel. Certains Talents (Chanceux, Obstiné) modifient ce maximum.

**Option — Longues séances de jeu** : lors de marathons (sessions de toute une journée), le MJ peut permettre la récupération de Points de Chance à des moments choisis de la narration, environ une fois par heure. Le maximum reste l'Indice de Destin actuel.

> « Relancer un Test qui s'est conclu par un échec. / Ajouter +1 DR à un Test après qu'il a été effectué. » — `LDB 17 l.23-25`

### « Je ne faillirai pas ! » (dépense d'un Point de Résilience)

En dépensant un Point de Résilience, un personnage peut choisir *lui-même* le résultat d'un test, au lieu de lancer les dés. Effets :

- Réussite garantie, même dans les pires conditions.
- Si l'action inflige un Coup Critique, le personnage choisit lui-même la Localisation atteinte.
- S'il s'agit d'un test opposé, le personnage l'emporte avec **au moins DR +1**.
- Peut être déclenché *après* un test raté (rétroactif).

> « **Je ne faillirai pas ! :** au lieu de lancer les dés pour un Test, vous choisissez le résultat, ce qui vous permet de réussir, même dans les pires conditions. […] S'il s'agit d'un Test opposé, vous l'emportez avec au moins DR +1. Vous pouvez même faire ce choix après un Test qui a échoué. » — `LDB 17 l.68`

**Sources RAW** :
- `LDB 17 l.17-25` — dépense de Chance : relance ou +1 DR
- `LDB 17 l.57-61` — Détermination (retirer un État, ignorer Psychologie, ignorer malus de Critique 1 Round — non lié aux Tests)
- `LDB 17 l.46-48` — règle optionnelle longues séances : récupération de Points de Chance environ 1×/heure
- `LDB 17 l.67-68` — dépense de Résilience : « Je te renie ! » (Corruption) et « Je ne faillirai pas ! » (forcer un succès)

**Voir aussi** : [Relance et inversion du dé](#relance-et-inversion-du-dé), [Tests opposés](#tests-opposés), Destin et Résilience (domaine propre)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 17` (l.17-25, l.46-48, l.57-61, l.67-68) → `ResilienceButton`, `canReroll`, `RenounceModal`, `DeterminationButton`, `CritLocationPicker`, `restoreFortune`, `RunModal`, `hasMeaningfulOption`, `sourceSuspended`, `canActFirst`, +124 — `src/data/characteristics.json`, `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs-scenes/effets.ts`, `src/data/schemas/defs/etats.ts`, +60 fichiers

---

## Talents liés à un Test : bonus de DR

Un grand nombre de Talents (LDB 10) portent un champ **Tests** qui liste une ou plusieurs Compétences associées. La règle générale s'applique à tous sans exception :

> « Pour chaque acquisition de ce Talent, vous gagnez +1 DR pour toute utilisation réussie de la Compétence liée au Talent. » — `LDB 10 l.19`

Autrement dit : chaque fois qu'un personnage *réussit* un test utilisant une Compétence listée sous **Tests** d'un Talent qu'il possède, il ajoute +1 DR par niveau du Talent au DR calculé normalement.

**Exemples de Talents et leurs effets sur le DR** (liste non exhaustive, LDB 10) :

| Talent | Compétence liée | Effet supplémentaire notable |
|--------|----------------|------------------------------|
| Attirant | Charme (envers ceux qui vous trouvent attirant) | Sur réussite, choisir entre DR du jet ou chiffre des unités (`LDB 10 l.89`) |
| Ergoteur | Charme (débattre) | Sur réussite, choisir entre DR ou chiffre des unités (`LDB 10 l.411`) |
| Coopératif | Compétences sociales (envers un supérieur) | Sur réussite, choisir entre DR ou chiffre des unités (`LDB 10 l.263`) |
| Maîtrise des Dés | Pari / Escamotage (jeux de dés) | Sur réussite, choisir entre DR ou chiffre des unités (`LDB 10 l.759`) |
| Grand Orateur | Charme (parler en public) | Bonus de DR = niveaux du Talent à tout Test de Charme en public (`LDB 10 l.520`) |
| Menaçant | Intimidation | Bonus de DR = niveaux du Talent (`LDB 10 l.787`) |
| Artilleur | Test étendu de rechargement Poudre noire | Ajoute un DR = niveau du Talent à chaque test du test étendu (`LDB 10 l.62`) |
| Feinte | Corps à corps (Escrime) pour la Feinte | Si réussi, ajoute le DR de la Feinte à l'attaque suivante contre la même cible (`LDB 10 l.453`) |
| Bonnes Jambes | Athlétisme (Saut) | Ajoute niveau du Talent au DR (`LDB 10 l.123`) |
| Infatigable | Tests opposés de Force | Ajoute niveaux au DR dans les tests opposés de Force (`LDB 10 l.605`) |

**Remarque** : le mécanisme « choisir entre DR du jet ou chiffre des unités » (Attirant, Ergoteur, Coopératif, Maîtrise des Dés) est une forme d'amplification de DR conditionnelle — il ne remplace pas la relance ou l'inversion, mais permet de lire le dé différemment sur une réussite.

**Sources RAW** :
- `LDB 10 l.11-20` — règle générale : Talent lié à un Test = +1 DR par niveau sur réussite
- `LDB 10 l.62` — Artilleur : Test étendu rechargement
- `LDB 10 l.89` — Attirant : DR ou chiffre des unités
- `LDB 10 l.123` — Bonnes Jambes : +DR Saut
- `LDB 10 l.263` — Coopératif : DR ou chiffre des unités (social/supérieur)
- `LDB 10 l.411` — Ergoteur : DR ou chiffre des unités (débattre)
- `LDB 10 l.453` — Feinte : DR de la feinte ajouté à l'attaque
- `LDB 10 l.520` — Grand Orateur : +DR en public
- `LDB 10 l.605` — Infatigable : +DR Force opposée
- `LDB 10 l.759` — Maîtrise des Dés : DR ou chiffre des unités
- `LDB 10 l.787` — Menaçant : +DR Intimidation

**Voir aussi** : [Degrés de Réussite (DR)](#degrés-de-réussite-dr), [Tests étendus](#tests-étendus)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 10` (l.11-20, l.62, l.89, l.123, l.263, l.411, l.453, l.520, l.605, l.759, l.787) → `talent-aleatoire`, `acrobaties-equestres`, `affable`, `useAttackJetProps`, `affinite-avec-les-animaux`, `ambidextre`, `ame-pure`, `artilleur`, `CrewContributor`, `artiste`, +104 — `src/data/actions.json`, `src/data/flow-stakes.json`, `src/data/talents.json`, `src/engine/careerSlots.ts`, `src/engine/combat.ts`, `src/engine/crewMorale.ts`, +11 fichiers

---

## Inversion de dé par Talent (variante du raté→réussi)

Plusieurs Talents accordent la faculté d'**inverser** le résultat d'un test *raté*, si l'inversion produit un succès. Cette mécanique est distincte de la relance (on ne relance pas, on retourne le dé) et de l'opération d'inversion elle-même, définie parmi les mécaniques de modification des jets (`LDB 12 l.42`).

**Contrainte commune** : le DR après inversion est plafonné à **+1 DR** (on réussit tout juste, sans brio), sauf mention contraire.

Talents concernés (LDB 10) :

| Talent | Compétence(s) | Condition | Plafond DR |
|--------|--------------|-----------|-----------|
| Chat de Gouttière | Discrétion (Urbaine) | Test raté → inverser si succès | Aucun plafond mentionné (`LDB 10 l.176`) |
| Pansement de Fortune | Guérison (avec Bandages, pendant le combat) | Test raté → inverser si succès | +1 DR max (`LDB 10 l.899`) |
| Pilote | Ramer / Voile (eaux dangereuses) | Test raté → inverser si succès | +1 DR max (`LDB 10 l.966`) |
| Pharmacologie | Métier (Apothicaire) | Test raté → inverser si succès | Aucun plafond mentionné (`LDB 10 l.950`) |
| Noctambule | Résistance à l'alcool | Test raté → inverser si succès | Aucun plafond mentionné (`LDB 10 l.834`) |
| Lecture Rapide | Recherche | Test raté → inverser si succès | Aucun plafond mentionné (`LDB 10 l.634`) |

> « Quand vous utilisez Discrétion (Urbaine), vous pouvez inverser le lancer de n'importe quel Test raté si cela entraîne un Succès. » — `LDB 10 l.176` (Chat de Gouttière)

> « Si vous ratez un Test de Guérison quand vous utilisez des Bandages, vous pouvez inverser le résultat si cela entraîne un succès ; cependant, si vous le faites, vous ne pouvez pas obtenir plus de +1 DR. » — `LDB 10 l.899` (Pansement de Fortune)

**Note de cohérence** : le plafond à +1 DR ne s'applique qu'à Pansement de Fortune et Pilote, qui précisent explicitement « car vous vous concentrez sur la vitesse plutôt que sur la précision ». Pour les autres Talents (Chat de Gouttière, Pharmacologie, Noctambule, Lecture Rapide), le DR calculé normalement après inversion s'applique.

**Sources RAW** :
- `LDB 10 l.176` — Chat de Gouttière
- `LDB 10 l.634` — Lecture Rapide
- `LDB 10 l.834` — Noctambule
- `LDB 10 l.899` — Pansement de Fortune
- `LDB 10 l.950` — Pharmacologie
- `LDB 10 l.966` — Pilote

**Voir aussi** : [Relance et inversion du dé](#relance-et-inversion-du-dé)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 10` (l.176, l.634, l.834, l.899, l.950, l.966) → `MedicState`, `CombatFeature`, `MODAL_DEFS`, `surgeryNext`, `MedicModal`, `surgery-roll`, `caid`, `cavalier-emerite`, `chanceux`, `charge-berserk`, +64 — `src/data/flow-stakes.json`, `src/data/talents.json`, `src/engine/combat.ts`, `src/engine/combatFeatures/types.ts`, `src/i18n/messages/fr.ts`, `src/state/combatFlow.ts`, +5 fichiers
- `LDB 12` (l.42) → `canReroll`, `test-auto-bands`, `getTestPolicy`, `ChanceButtons`, `test-over-100`, `RollRowCore`, `test-auto-band-width`, `rerollAvailable`, `NightEntry`, `PendingTest`, +12 — `src/data/reglesOptionnelles.json`, `src/engine/fortune.ts`, `src/engine/reverseToken.ts`, `src/engine/testPolicy.ts`, `src/state/pendings.ts`, `src/state/restFlow.ts`, +4 fichiers

---

## Jeux de Taverne — mécaniques NADJ (doubles, relance, DR, résolution rapide)

Le supplément **Nuits Agitées & Dures Journées** précise l'interprétation des doubles dans les jeux de taverne et, par extension, dans tout contexte hors combat où une règle renvoie à un « Critique » :

> « Remarque : si l'une de ces règles se réfère à un Critique, cela signifie le fait d'avoir obtenu un double sur un Test réussi, comme décrit dans le Livre de Règles à la page 159, même s'il ne s'agit pas d'une situation de combat. » — `NADJ 16 l.7`

Cela confirme que la définition du Critique par double (LDB 12 l.124-127 — règle optionnelle) s'applique *textuellement identique* hors combat, notamment dans les jeux de taverne. Un **double sur un test réussi = Critique** (traité comme Succès Stupéfiant, DR 6+). Un double sur un test raté = Maladresse (Échec Stupéfiant, DR −6 ou moins) selon la même règle optionnelle.

NADJ utilise également les **Points de Chance pour relancer** dans les jeux de taverne (`NADJ 16 l.19`) — confirmation que la relance (LDB 17 l.23) s'applique dans tout contexte.

**Option — Jeux de Taverne Rapides** : pour les groupes qui ne souhaitent pas dérouler les règles complètes de chaque jeu, NADJ propose une résolution par un unique **test opposé Intermédiaire (+0)** utilisant la Compétence indiquée pour ce jeu. Si aucune Compétence n'est précisée (par exemple Al-zahr), on effectue un **Test opposé de Pari (+0)**. Celui qui obtient le DR le plus élevé remporte la partie.

> « Effectuez un Test opposé de Compétence Intermédiaire (+0) en utilisant la Compétence indiquée dans la section "Jeu" du jeu en question. Si aucune Compétence n'est indiquée, faites plutôt un Test opposé de Pari Intermédiaire (+0). Celui qui obtient le nombre le plus élevé de DR remporte la partie. » — `NADJ 16 l.11`

**Extensions de la mécanique DR dans les jeux de taverne** (NADJ 16) : plusieurs jeux montrent des variantes non présentes dans le LDB 12 :

- **Ajouter le Bonus de Caractéristique au DR** : au Bras de Fer (Force) et à l'Alvatafl (Intelligence), le score obtenu est le DR du test *plus* le Bonus de la Caractéristique concernée. Exemple : DR +2 au Test de Force + Bonus de Force 4 = 6 points ce tour (`NADJ 16 l.34` Bras de Fer ; `NADJ 16 l.25` Alvatafl).
- **Lire le dé des unités ou des dizaines au choix** : aux Fléchettes, sur un test *réussi*, le joueur choisit de marquer des points égaux au chiffre des unités, au chiffre des dizaines, à 10× le chiffre des unités, ou à 10× le chiffre des dizaines (`NADJ 16 l.97`). C'est une lecture alternative du dé (distincte de l'inversion), uniquement disponible sur réussite.
- **DR plafonné à 6 (ou objectif) dans un test étendu** : aux Boules, le DR maximal par lancer est 6 (contact avec la cible). Un échec signifie que la boule est hors-jeu (`NADJ 16 l.57`).

Ces trois mécaniques constituent des extensions légitimes du système de DR dans des contextes hors combat, autorisées par les livres de la liste VF.

**Sources RAW** :
- `NADJ 16 l.7` — Critique hors combat = double sur réussite (même règle que LDB)
- `NADJ 16 l.11` — Option Jeux Rapides : test opposé Compétence (ou Pari)
- `NADJ 16 l.19` — Points de Chance = relance dans les jeux de taverne
- `NADJ 16 l.25` — Alvatafl : ajouter Bonus d'Intelligence au DR
- `NADJ 16 l.34` — Bras de Fer : test étendu Force + Bonus de Force au DR par tour
- `NADJ 16 l.57` — Boules : DR plafonné à 6 par lancer (test étendu)
- `NADJ 16 l.97` — Fléchettes : choisir unités/dizaines/×10 sur réussite
- `LDB 12 l.124-127` (rappel) — règle optionnelle Critiques/Maladresses sur tous tests

**Voir aussi** : [Doubles — Critique et Maladresse](#doubles--critique-et-maladresse), [Influencer un test — Chance, Résilience, Talents](#influencer-un-test--chance-résilience-talents), [Tests étendus](#tests-étendus)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 12` (l.124-127) → `test-critiques-doubles`, `test-fast-sl`, `amazingTestLabel`, `useTestJetProps`, `double-critique-maladresse`, `evaluateTest`, `SL_IMPRESSIVE`, `isImpressiveFailure`, `isAstoundingFailure` — `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/engine/tests.ts`, `src/state/flowOutcomes.ts`, `src/ui/jetProps/useTestJetProps.tsx`
- `LDB 17` (l.23) → `canReroll`, `RunModal`, `canActFirst`, `fateSaveOrDie`, `carryOverState`, `freeActFirst`, `rerollAvailable`, `ReservesSeuilsBand`, `CampaignView`, `RollFlowLens`, +18 — `src/data/flow-stakes.json`, `src/engine/fortune.ts`, `src/engine/ops.ts`, `src/engine/persistence.ts`, `src/engine/tests.ts`, `src/state/actionRegistry.ts`, +12 fichiers
- `NADJ 16` (l.7, l.11, l.19, l.25, l.34, l.57, l.97) → `SequenceRoundOps`, `doc`, `SequenceDice`, `TavernGame`, `al-zahr`, `SequenceParams`, `alvatafl`, `SequenceTieSide`, `TavernGameModal`, `SequenceVolleyRow`, +38 — `src/data/combat-stakes.json`, `src/data/index.ts`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/tavernGames.ts`, `src/data/tavernGames.json`, `src/engine/sequenceVocab.ts`, +8 fichiers
