# Atlas RAW — Avancement (Points d'Expérience)

> Référentiel autosuffisant des règles WFRP4 (RAW). Chaque règle cite `LDB NN l.X` (source = dernier recours). Voir [`sources.md`](../sources.md), [`00-index.md`](00-index.md).
> ⚠️ Les champs **Implémente** sont GÉNÉRÉS (`npm run raw:implemente` — source éditoriale : `src/data/raw.manifest.json`) — ne pas les éditer à la main.

Ce fichier couvre tout ce qui concerne **l'acquisition et la dépense de Points d'Expérience (PX)** : gain par le MJ, coûts d'Augmentation (Caractéristique / Compétence / Talent), complétion de Niveau, changement de Carrière, règles hors carrière. Il renvoie à [`carrieres.md`](carrieres.md) pour la structure des Carrières (niveaux, schéma de progression, liste des compétences/talents disponibles) et à [`competences.md`](competences.md) / [`talents.md`](talents.md) pour les définitions.

## Sommaire

- [Vue d'ensemble](#vue-densemble)
- [Gain de PX — attribution par le MJ](#gain-de-px--attribution-par-le-mj)
- [Coût des Augmentations — table verbatim](#coût-des-augmentations--table-verbatim)
- [Augmentation de Caractéristique](#augmentation-de-caractéristique)
- [Augmentation de Compétence](#augmentation-de-compétence)
- [Augmentations hors carrière (coût doublé)](#augmentations-hors-carrière-coût-doublé)
- [Augmentation de Talent](#augmentation-de-talent)
- [Compléter un Niveau de Carrière](#compléter-un-niveau-de-carrière)
- [Changer de Niveau au sein de la même Carrière](#changer-de-niveau-au-sein-de-la-même-carrière)
- [Changer pour une Nouvelle Carrière](#changer-pour-une-nouvelle-carrière)
- [Table de synthèse des coûts de Carrière](#table-de-synthèse-des-coûts-de-carrière)
- [Règles optionnelles de scénario (T3 — attribution événementielle)](#règles-optionnelles-de-scénario-t3--attribution-événementielle)

---

## Vue d'ensemble

> « La Carrière de votre Personnage va influer sur son gain en expérience. Chaque Carrière propose trois formes d'Augmentation : *Augmentation de Caractéristique, Augmentation de Compétence* et *Augmentation de Talent* – chacune d'entre elles étant acquise avec des Points d'Expérience (PX). Vous pouvez également utiliser des PX pour Changer de Carrière. Votre Niveau de Carrière détermine quels sont les Caractéristiques, Compétences et Talents disponibles pour vous. »
> — LDB 07 l.37

Les trois formes d'Augmentation partagent le même principe : chaque Augmentation ajoute +1 et coûte un nombre de PX qui dépend du nombre d'Augmentations déjà achetées pour cet élément précis. Les coûts de Caractéristique et de Compétence sont dans le même tableau (à des colonnes différentes) ; les Talents suivent une formule linéaire séparée.

**Sources RAW** : `LDB 07 l.37`

---

## Gain de PX — attribution par le MJ

Le LDB ne fixe pas de montant absolu de PX par session : c'est une prérogative du MJ. Les scénarios officiels donnent des barèmes indicatifs (cf. section T3 ci-dessous). En pratique, les fourchettes typiques citées dans le LDB pour les tests de Carrière (Gagner de l'argent, etc.) suggèrent des sessions qui rapportent quelques dizaines à quelques centaines de PX.

Les tomes de la campagne **L'Ennemi dans l'Ombre** et **Mort sur le Reik** donnent des listes d'objectifs narratifs en fin de chapitre sans barème générique — chaque chapitre propose ses propres récompenses. Le **Pouvoir derrière le Trône** donne le barème le plus détaillé (voir section T3 ci-dessous).

**Sources RAW** : barème T3 = `PDT 13 l.3-59` (seul barème chiffré complet disponible dans les sources autorisées).

---

## Coût des Augmentations — table verbatim

Table copiée verbatim depuis `LDB 07 l.51-70` (colonne « Augmentations » = nombre d'Augmentations **déjà achetées** pour cet élément avant d'acheter la prochaine) :

| Augmentations déjà achetées | Coût Caractéristiques (PX) | Coût Compétences (PX) |
|---|---|---|
| 0 à 5 | 25 | 10 |
| 6 à 10 | 30 | 15 |
| 11 à 15 | 40 | 20 |
| 16 à 20 | 50 | 30 |
| 21 à 25 | 70 | 40 |
| 26 à 30 | 90 | 60 |
| 31 à 35 | 120 | 80 |
| 36 à 40 | 150 | 110 |
| 41 à 45 | 190 | 140 |
| 46 à 50 | 230 | 180 |
| 51 à 55 | 280 | 220 |
| 56 à 60 | 330 | 270 |
| 61 à 65 | 390 | 320 |
| 66 à 70 | 450 | 380 |
| 71 et + | 520 | 440 |

> « Les Augmentations coûtent 25 PX chacune, et ce sera le cas pour chaque Point acquis, tant que votre nombre précédent d'Augmentation est compris entre 0 et 5. »
> — LDB 07 l.47

**Sources RAW** : `LDB 07 l.51-70`

**Aucun plafond maximum** : le LDB précise explicitement qu'aucune limite au nombre d'Augmentations n'est imposée, « même si les niveaux les plus élevés se révèlent extrêmement onéreux » (`LDB 07 l.49`).

---

## Augmentation de Caractéristique

> « Le coût en PX d'une Augmentation de Caractéristique est indiqué dans le tableau de Coût des Augmentations de Caractéristique et Compétence, et dépend du nombre d'Augmentations de Caractéristique déjà achetées pour cette dernière. »
> — LDB 07 l.45

> « Chaque Augmentation de Caractéristique ajoute +1 à la Caractéristique associée. »
> — LDB 07 l.47

**Disponibilité** par Niveau de Carrière (schéma de progression, `LDB 07 l.41-43`) :

- **Niveau 1** : les 3 Caractéristiques marquées `h` (icône de base).
- **Niveau 2** : + la Caractéristique marquée d'un symbole cuivré.
- **Niveau 3** : + la Caractéristique marquée d'un symbole argenté.
- **Niveau 4** : + la Caractéristique marquée d'un symbole doré.

Les Caractéristiques des niveaux inférieurs restent disponibles aux niveaux supérieurs (cumul ascendant). Les Caractéristiques non disponibles peuvent être achetées hors carrière au double du coût.

> **Note** : le Tir (CT) et le Combat (CC) sont historiquement appelés « Capacités » mais sont bien des Caractéristiques et s'augmentent au même coût. (`LDB 07 l.72`)

**Sources RAW** : `LDB 07 l.41-72`

**Voir aussi** : [`carrieres.md`](carrieres.md) pour la structure du Schéma de Progression par Carrière.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 7` (l.41-72) → `adv-0-5`, `BandeOuverte`, `inCareerChar`, `adv-6-10`, `AdvanceCostBand`, `adv-11-15`, `adv-16-20`, `adv-21-25`, `buyCharAdvance`, `doc`, +17 — `src/data/advancementCosts.json`, `src/data/schemas/defs/advancementCosts.ts`, `src/data/schemas/grammaire/valeurs.ts`, `src/engine/advancement.ts`, `src/engine/careerSlots.ts`, `src/engine/tables.ts`, +1 fichiers

---

## Augmentation de Compétence

> « Le coût en PX d'une Augmentation de Compétence est indiqué dans le tableau de Coût des Augmentations de Caractéristiques et Compétences, et dépend du nombre d'Augmentations de Compétence que vous avez déjà achetées pour lui attribuer. »
> — LDB 07 l.78

> « Chaque Augmentation de Compétence ajoute +1 à votre niveau de Compétences. Ainsi, si vous avez acheté 9 Augmentations en Discrétion et que votre Discrétion était de 31, votre Discrétion atteint donc 40. Les 5 premières Augmentations vous coûtent 10 PX chacune, et les 4 suivantes 15 PX. »
> — LDB 07 l.80

**Disponibilité** : les Compétences de tous les Niveaux de Carrière **jusqu'au courant inclus** sont accessibles. Un personnage au Niveau 3 peut augmenter les Compétences des Niveaux 1, 2 et 3 (`LDB 07 l.76`). Chaque Spécialisation est une Compétence distincte (LDB 09 l.44).

> **Note** : une des Compétences du 1er Niveau de Carrière est écrite en italique — c'est la Compétence de Carrière « que vous utiliserez pour Gagner de l'argent » (`LDB 07 l.82`).

**Sources RAW** : `LDB 07 l.75-84`

**Voir aussi** : [`competences.md`](competences.md) pour la définition des Compétences et la règle des Spécialisations.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 7` (l.75-84) → `adv-0-5`, `feu`, `inCareerChar`, `adv-6-10`, `AdvanceCostBand`, `adv-11-15`, `advanceCost`, `adv-16-20`, `adv-21-25`, `doc`, +28 — `src/data/advancementCosts.json`, `src/data/domains.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/advancementCosts.ts`, `src/data/schemas/grammaire/valeurs.ts`, `src/engine/activities.ts`, +5 fichiers
- `LDB 9` (l.44) → `specIdOf`, `CibleDeType`, `art`, `athletisme`, `buySkillAdvance`, `wildcardSpecs`, `estSpecialisable`, `buildAdvancementView`, `designateSpec`, `combatBaseValue`, +15 — `src/data/index.ts`, `src/data/schemas/grammaire/ref.ts`, `src/data/schemas/grammaire/valeurs.ts`, `src/data/skills.json`, `src/engine/activities.ts`, `src/engine/advancement.ts`, +13 fichiers

---

## Augmentations hors carrière (coût doublé)

> « Si le MJ est d'accord, cela ne pose aucun problème, mais, dans ce cas, le coût en est doublé. De plus, le MJ peut exiger que vous trouviez un mentor qui puisse vous enseigner cette formation inhabituelle. »
> — LDB 07 l.89

> « Les Augmentations de Caractéristique et de Compétence hors Carrière coûtent le double de PX indiqués dans le Tableau de Coût des Augmentations de Caractéristique et Compétence. »
> — LDB 07 l.91

> « Normalement, il n'est pas possible d'acheter des Talents hors Carrière avec des PX, même si les Activités Entraînement et Apprentissage particulier du Chapitre 6 offrent la possibilité d'en acheter comme s'il s'agissait d'Augmentations de Carrière et permettent également d'apprendre des Talents hors Carrière. »
> — LDB 07 l.93

Résumé :
- **Caractéristiques hors carrière** : coût × 2 (avec accord du MJ, éventuellement mentor requis).
- **Compétences hors carrière** : coût × 2 (avec accord du MJ, éventuellement mentor requis).
- **Talents hors carrière** : **impossibles** avec des PX en jeu normal. Les Activités **Entraînement** et **Apprentissage particulier** (ch. 6) constituent l'exception.

**Sources RAW** : `LDB 07 l.88-93`

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 7` (l.88-93) → `adv-0-5`, `feu`, `inCareerChar`, `adv-6-10`, `adv-11-15`, `advanceCost`, `adv-16-20`, `adv-21-25`, `adv-26-30`, `buySkillAdvance`, +25 — `src/data/advancementCosts.json`, `src/data/domains.json`, `src/data/reglesOptionnelles.json`, `src/engine/activities.ts`, `src/engine/advancement.ts`, `src/engine/careerSlots.ts`, +4 fichiers

---

## Augmentation de Talent

> « Les Augmentations de Talent coûtent 100 PX + 100 PX par Augmentation déjà achetée pour ce Talent. »
> — LDB 07 l.105

> « La première fois que vous achetez un nouveau Talent (pour 100 PX), cela vous donne accès aux règles spéciales de ce Talent. Si vous achetez un Talent à plusieurs reprises (il vous en coûtera 200 PX la deuxième fois et 300 PX la troisième fois), vous aurez accès aux capacités supplémentaires indiquées dans la description du Talent. »
> — LDB 07 l.107

Formule : **coût de la N+1ᵉ acquisition = 100 × (N + 1)** où N = nombre d'acquisitions déjà faites.

| Acquisition | Coût |
|---|---|
| 1ʳᵉ (nouveau Talent) | 100 PX |
| 2ᵉ | 200 PX |
| 3ᵉ | 300 PX |
| Nᵉ | N × 100 PX |

**Disponibilité** : les Talents ne sont disponibles **qu'au Niveau de Carrière où ils sont listés** (`LDB 07 l.103`). Un personnage Niveau 3 ne peut acheter que les Talents du Niveau 3 (pas des niveaux inférieurs déjà franchis).

> « Les Talents ne sont disponibles que lorsque vous avez atteint le niveau de Carrière où ils sont indiqués. Ainsi, si vous êtes un Apothicaire de Renom, vous ne pouvez acheter que les Talents indiqués sous Apothicaire de Renom et pas ceux indiqués sous Apprenti Apothicaire, Apothicaire ou Maître Apothicaire. »
> — LDB 07 l.103

> **Note** : certains Talents ne peuvent pas être achetés plusieurs fois — voir la description de chaque Talent. (`LDB 07 l.109`)

**Sources RAW** : `LDB 07 l.100-109`

**Voir aussi** : [`talents.md`](talents.md) pour la liste des Talents et les restrictions de multi-achat.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 7` (l.100-109) → `feu`, `inCareerChar`, `advanceCost`, `talentCost`, `buyTalent`, `careerCompletionAdvances`, `lumiere`, `careerChangeCost`, `buildAdvancementView`, `talentSlots`, +9 — `src/data/domains.json`, `src/data/reglesOptionnelles.json`, `src/engine/activities.ts`, `src/engine/advancement.ts`, `src/engine/careerSlots.ts`, `src/state/advancement.ts`, +2 fichiers

---

## Compléter un Niveau de Carrière

> « Compléter une Carrière signifie que vous maîtrisez votre vocation actuelle et que vous êtes prêt à en embrasser une nouvelle. »
> — LDB 07 l.122

Pour compléter un Niveau de Carrière, il faut (`LDB 07 l.124`) :

1. Avoir le nombre d'Augmentations requis **dans toutes les Caractéristiques de Carrière** disponibles à ce Niveau.
2. Avoir le même nombre d'Augmentations dans **au moins 8 des Compétences** disponibles (cumulées jusqu'au Niveau courant).
3. Posséder **au moins 1 Talent** du Niveau courant.

**Table des Augmentations requises** (verbatim `LDB 07 l.126-131`) :

| Niveau | Augmentations requises (par Caractéristique et Compétence) |
|---|---|
| 1 | 5 |
| 2 | 10 |
| 3 | 15 |
| 4 | 20 |

> **Note** : achever un Niveau n'oblige pas à changer de Carrière. On peut rester au Niveau 1 indéfiniment si on le souhaite. (`LDB 07 l.133`)

**Sources RAW** : `LDB 07 l.121-133`

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 7` (l.121-133) → `feu`, `careerCompletionAdvances`, `lumiere`, `isCareerLevelComplete`, `careerChangeCost`, `CareerChangeContext`, `validateCareerChange`, `buildAdvancementView`, `mort`, `vie`, +9 — `src/data/domains.json`, `src/data/reglesOptionnelles.json`, `src/engine/advancement.ts`, `src/state/advancement.ts`, `src/state/partyFlow.ts`, `src/state/store.ts`

---

## Changer de Niveau au sein de la même Carrière

> « Si vous avez achevé votre Niveau de Carrière actuel, vous pouvez passer au Niveau de Carrière suivant, ou à n'importe quel Niveau de Carrière inférieur pour 100 PX. Donc, si vous avez achevé Chasseur (Chasseur Niveau 2), vous pouvez passer à Pisteur (Chasseur Niveau 3) ou à Traqueur (Chasseur Niveau 1) pour 100 PX, mais pas à Maître de la Chasse (Chasseur Niveau 4). »
> — LDB 07 l.137

Règles précises :

- **Niveau suivant** : possible uniquement si le Niveau actuel est **complété** ; coût 100 PX.
- **Niveau inférieur** : toujours possible pour 100 PX (sans condition de complétion).
- **Saut de Niveau** (sauter un Niveau) : normalement **interdit** sauf avec l'accord du MJ, justifié par des événements narratifs (`LDB 07 l.140`).

> « Avec l'accord du MJ, vous pouvez également sauter des Niveaux de Carrière, fait normalement expliqué par des événements dans le jeu. »
> — LDB 07 l.140

Coût d'un saut accordé par le MJ : 100 PX si le Niveau courant est achevé, 200 PX sinon (`LDB 07 l.140`).

**Sources RAW** : `LDB 07 l.136-139`, `LDB 07 l.140`

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 7` (l.136-139, l.140) → `feu`, `careerCompletionAdvances`, `AdvancementView`, `lumiere`, `CareerChangeContext`, `validateCareerChange`, `buildAdvancementView`, `mort`, `vie`, `cieux`, +8 — `src/data/domains.json`, `src/data/reglesOptionnelles.json`, `src/engine/advancement.ts`, `src/state/advancement.ts`, `src/state/partyFlow.ts`, `src/state/store.ts`

---

## Changer pour une Nouvelle Carrière

> « Si vous avez achevé votre Niveau de Carrière actuel, vous pouvez faire vos débuts au premier Niveau d'une autre Carrière de votre Classe pour 100 PX, ou pour 200 PX si vous n'avez pas achevé votre Niveau de Carrière actuel. Si vous voulez commencer le premier Niveau d'une Carrière d'une Classe différente, il vous en coûtera 100 PX supplémentaires. »
> — LDB 07 l.144

> « votre MJ pourra vous demander de justifier tout changement de Carrière par des événements qui se produiront en cours de jeu »
> — LDB 07 l.146

**Cas particulier — même Niveau dans une autre Carrière** : si le Niveau actuel est achevé et avec l'accord du MJ, il est possible de rejoindre le même Niveau de Carrière d'une autre Carrière de la même Classe pour 100 PX (`LDB 07 l.148`). Restrictions : certaines Carrières exigent les bases préalables (ex. Sorcier) ; les Talents des Niveaux non parcourus ne sont pas disponibles.

**Activité « Changement de Carrière »** : entre deux aventures, le changement peut aussi s'effectuer via l'Activité Changement de Carrière (`LDB 23 l.104`).

**Récapitulatif des règles de cible** :

- Nouvelle Carrière → **1er Niveau uniquement** (sauf cas particulier ci-dessus).
- Même Classe : coût de base (100 ou 200 PX selon complétion).
- Classe différente : +100 PX.

**Sources RAW** : `LDB 07 l.144-148`

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 7` (l.144-148) → `feu`, `careerCompletionAdvances`, `AdvancementView`, `lumiere`, `CareerChangeContext`, `validateCareerChange`, `buildAdvancementView`, `mort`, `vie`, `cieux`, +8 — `src/data/domains.json`, `src/data/reglesOptionnelles.json`, `src/engine/advancement.ts`, `src/state/advancement.ts`, `src/state/partyFlow.ts`, `src/state/store.ts`
- `LDB 23` (l.104) → `craft`, `learn`, `entrainement`, `interlude-elf-duty`, `dressage`, `Combatant` — `src/data/activities.json`, `src/data/reglesOptionnelles.json`, `src/engine/types.ts`

---

## Table de synthèse des coûts de Carrière

Verbatim depuis `LDB 07 l.152-159` (tableau « Coût des Changements de Carrière et de Talent ») :

| Progression | Coût en PX |
|---|---|
| +1 Augmentation de Talent | 100 PX + 100 PX par fois où le Talent a déjà été pris |
| Quitter une Carrière achevée | 100 PX |
| Quitter une Carrière inachevée | 200 PX |
| Embrasser une nouvelle Classe | +100 PX |

**Sources RAW** : `LDB 07 l.152-159`

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 7` (l.152-159) → `AdvancementView`, `CareerChangeContext`, `validateCareerChange`, `buildAdvancementView`, `changeCareer`, `advancement-career-jump`, `sorcellerie` — `src/data/domains.json`, `src/data/reglesOptionnelles.json`, `src/engine/advancement.ts`, `src/state/advancement.ts`, `src/state/partyFlow.ts`

---

## Règles optionnelles de scénario (T3 — attribution événementielle)

Le **Pouvoir derrière le Trône** (Tome 3) propose en Annexe IV le barème de PX le plus structuré des tomes autorisés. Il s'agit d'une liste d'objectifs narratifs et de fourchettes d'attribution, non d'une règle générique — chaque scénario peut établir le sien.

> « Les Points d'Expérience suivants peuvent être octroyés pendant l'aventure, en général à la fin de chaque session de jeu. Ces récompenses permettent aussi aux Joueurs d'avoir une idée de la progression du scénario. N'hésitez pas à attribuer des Points d'Expérience supplémentaires aux Personnages qui font preuve d'un grand sens de l'observation, proposent de bonnes idées, ou de façon générale, rendent le jeu plus agréable pour tout le monde. »
> — PDT 13 l.5

**Barème T3 — Jeu de rôle** (`PDT 13 l.7-10`) :

| Type de session | PX attribués |
|---|---|
| Session à fort jeu de rôle | 70 à 100 PX |
| Session mixte (RP + action) | 30 à 50 PX |
| Excellente interprétation individuelle | jusqu'à 70 PX supplémentaires par Personnage |

**Barème T3 — Objectifs narratifs** (sélection représentative, `PDT 13 l.12-59`) :

| Objectif | PX |
|---|---|
| Rencontres mineures (par rencontre) | 10 à 30 PX |
| Obtenir le soutien d'un PNJ majeur | 15 à 60 PX (selon importance) |
| Victoire sur un adversaire important | 30 à 50 PX |
| Défaite d'un boss principal (Wasmeier) | 50 PX |
| Empêcher un assassinat capital | 40 PX |
| Récompense finale (complot déjoué) | 200 PX + 1 Point de Destin |
| Bonus documents secrets trouvés | +100 PX + 1 Point de Destin |

> « Les Personnages reçoivent chacun 200 Points d'Expérience et 1 Point de Destin pour avoir déjoué un complot visant la chute de la ville. S'ils ont trouvé tous les documents secrets de Wasmeier, ils obtiennent 100 Points d'Expérience et 1 Point de Destin supplémentaires. »
> — PDT 13 l.78

**Sources RAW** : `PDT 13 l.1-73`

**Implémente :** _(généré — `npm run raw:implemente`)_
- `PDT 13` (l.1-73) → `giveXpSchema` — `src/data/schemas/defs-scenes/effets.ts`
- sans code : `PDT 13` (l.78)

---

## Voir aussi

- [`carrieres.md`](carrieres.md) — structure des Carrières, Schéma de Progression, Classes, Statut.
- [`competences.md`](competences.md) — liste des Compétences, Spécialisations (identité par spec).
- [`talents.md`](talents.md) — liste des Talents, plafonds de multi-achat, effets des niveaux supplémentaires.
- [`activites.md`](activites.md) — Activités entre aventures : Changement de Carrière, Entraînement, Apprentissage particulier (voies d'achat de Talents hors carrière).

---

## Implémente

Module principal : `src/engine/advancement.ts`

| Fonction | Règle couverte | Ref code |
|---|---|---|
| `ADVANCE_COST_TABLE` | Table des coûts verbatim | `LDB 07 l.51-70` |
| `advanceCost(n, kind, inCareer, discount)` | Coût de la N+1ᵉ Augmentation ; ×2 hors carrière | `LDB 07 l.45/80/95` |
| `buyCharAdvance(hero, char, inCareer)` | Achat d'une Augmentation de Caractéristique | `LDB 07 l.45-72` |
| `buySkillAdvance(hero, skillName, spec, inCareer, discount)` | Achat d'une Augmentation de Compétence (par spec distincte) | `LDB 07 l.78-84`, `LDB 09 l.44` |
| `talentCost(timesAlready)` | Coût d'une Augmentation de Talent | `LDB 07 l.105` |
| `buyTalent(hero, talentName)` | Achat d'une Augmentation de Talent | `LDB 07 l.100-109` |
| `careerCompletionAdvances(level)` | Augmentations requises pour compléter (5 × niveau) | `LDB 07 l.126-131` |
| `isCareerLevelComplete(hero, level, opts)` | Conditions de complétion d'un Niveau | `LDB 07 l.124` |
| `careerChangeCost(completed)` | Coût de base d'un changement de Carrière | `LDB 07 l.118` |
| `validateCareerChange(hero, newCareer, newLevel, ctx)` | Règles de cible + surcoût Classe différente | `LDB 07 l.137`, `LDB 07 l.152-159` |
| `changeCareer(hero, newCareer, newLevel, ctx)` | Application du changement (mute le héros) | `LDB 07 l.137`, `LDB 07 l.140` |

**Refs code dans le fichier** (lignes exactes du source) :
- `LDB 09 l.42` (Spécialisation = Compétence distincte) — commentaire l.70
- `LDB 07 l.118` (coût de base : 100 PX si complété, 200 sinon) — commentaire l.159, l.184
- `LDB 07 l.137` (Niveau suivant ou inférieur au sein de la même Carrière) — commentaire l.178, l.180
- `LDB 07 l.140` (saut de Niveau accordé par le MJ) — commentaire l.171, l.181, l.202
- `LDB 07 l.144` (1er Niveau d'une autre Carrière ; +100 PX si la Classe diffère) — commentaire l.167, l.182
- `LDB 07 l.148` (même Niveau d'une autre Carrière de la Classe, accord du MJ) — commentaire l.171, l.183, l.207
