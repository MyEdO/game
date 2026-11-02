# Atlas RAW — Caractéristiques & statistiques dérivées

> Base de connaissance des **règles WFRP4 (RAW)**, consolidées sur les livres autorisés, à usage d'agent
> (vérifier que le code respecte le RAW). Chaque règle cite sa source `LIVRE NN l.X-Y`
> (NN = préfixe du fichier de chapitre, l = lignes du `.md` source). **Voir aussi** tisse les renvois
> entre règles ; **Implémente** référence l’état calculé du topic dans le rapport pur.
> Conventions d'abréviation : voir [`sources.md`](../sources.md).
>
> **Périmètre de ce fichier** : les 10 Caractéristiques (CC/CT/F/E/I/Ag/Dex/Int/FM/Soc), le
> Bonus de Caractéristique, et les statistiques dérivées Blessures et Mouvement.
> Génération des valeurs à la création → voir [`avancement.md`](avancement.md).
> Taille et variations créature → voir § Blessures par Taille ci-dessous + [`deplacement.md`](deplacement.md).
> Les champs **Implémente** référencent le [rapport calculé](../implemente.generated.md) (`npm run raw:implemente`).

## Sommaire

- [Les 10 Caractéristiques](#les-10-caractéristiques)
- [Tableau des Attributs (bases de génération par race)](#tableau-des-attributs)
- [Bonus de Caractéristique](#bonus-de-caractéristique)
- [Statistiques dérivées — Blessures](#statistiques-dérivées--blessures)
  - [Formule de base](#formule-de-base)
  - [Cas particulier : talent Petit (Halflings)](#cas-particulier--talent-petit-halflings)
  - [Variantes par Taille (créatures)](#variantes-par-taille-créatures)
  - [Blessures dynamiques (le maximum suit le profil)](#blessures-dynamiques-le-maximum-suit-le-profil)
- [Statistiques dérivées — Mouvement](#statistiques-dérivées--mouvement)
- [Voir aussi](#voir-aussi)
- [Implémente](#implémente)

---

## Les 10 Caractéristiques

**Source :** LDB 05 l.342-402 (descriptions individuelles) ; LDB 05 l.331 (moyenne humaine = 30).

> « La moyenne humaine pour ces Attributs est de 30. Ceux qui sont doués, ou bien entraînés, peuvent
> obtenir des scores supérieurs à 40 ; seuls les plus dévoués et expérimentés obtiendront des scores
> supérieurs à 60. » — LDB 05 l.331

| Abrév. | Nom complet | Ce qu'elle mesure (résumé RAW) |
|:------:|-------------|-------------------------------|
| **CC** | Capacité de Combat | Combat au Corps à corps ; mains nues ; efficacité dans la mêlée. |
| **CT** | Capacité de Tir | Armes à distance (arcs, couteaux de lancer) ; lancer d'objets ; attaques à distance spéciales (ex. Vomissement de troll). |
| **F** | Force | Dégâts en Corps à corps ; port de charges ; Natation ; Escalade. |
| **E** | Endurance | Résistance physique ; survie aux Dégâts ; résistance aux conditions difficiles et au poison. |
| **I** | Initiative | Vitesse de pensée et de réaction en action ; ordre de combat ; intuition et perception ; être le premier à réagir. |
| **Ag** | Agilité | Coordination physique et capacités athlétiques ; course, équitation, dissimulation ; esquiver les coups en combat. |
| **Dex** | Dextérité | Tâches manuelles délicates (instrument, artisanat) ; tours de passe-passe ; faire les poches. |
| **Int** | Intelligence | Pensée, analyse, compréhension ; soins, évaluation, connaissances ; comprendre et lancer des Sorts. |
| **FM** | Force Mentale | Volonté ; ignorer les difficultés ; résister aux influences et à la coercition ; résister à la peur et à la terreur. |
| **Soc** | Sociabilité | S'entendre avec les gens ; paraître plaisant ; discussion, commandement en combat, séduction des gardes ; communication avec la divinité (Personnages pieux). |

**Sources verbatim :**
- CC : LDB 05 l.345 — « votre capacité à vous battre au Corps à corps, à exécuter une frappe mesurée, et de votre efficacité dans le tumulte d'une mêlée générale. Cet Attribut est aussi utilisé pour le combat à mains nues, quand l'arme est votre propre corps. »
- CT : LDB 05 l.349 — « représente votre capacité à atteindre vos cibles avec des armes à distance telles que des arcs et des couteaux de lancer, et, en général, à lancer des objets. Cet Attribut est aussi utilisé comme base pour d'autres attaques à distance comme le Vomissement des trolls. »
- F : LDB 05 l.374 — « Ceci indique combien de Dégâts vous infligez au Corps à corps, combien vous pouvez soulever et à quel point vous êtes bon en Natation et en Escalade. »
- E : LDB 05 l.378 — « votre résistance physique. Elle vous aide à survivre aux Dégâts durant un combat, mais aussi à des conditions difficiles et à résister au poison. »
- I : LDB 05 l.382 — « représente votre vitesse de pensée et de réaction, en particulier dans le feu de l'action et quand vous êtes sous pression. Elle détermine l'ordre de combat, votre intuition et votre perception, et vous aide à être le premier à réagir. »
- Ag : LDB 05 l.386 — « expression de votre coordination physique et de vos capacités athlétiques naturelles, la base dans des domaines comme la course, l'équitation et la dissimulation. Elle est aussi utilisée pour esquiver les coups en combat. »
- Dex : LDB 05 l.390 — « indique votre capacité à accomplir des tâches manuelles délicates telles que jouer d'un instrument de musique ou confectionner habilement des objets. Elle vous aide aussi pour les tours de passe-passe ou pour faire les poches. »
- Int : LDB 05 l.394 — « symbolise le potentiel de pensée, d'analyse et de compréhension. Utile pour soigner, évaluer et pour les connaissances en général, elle est indispensable pour comprendre et lancer des Sorts. »
- FM : LDB 05 l.398 — « représente votre volonté en général et votre capacité à ignorer les difficultés et à vous concentrer sur le travail en cours. Elle aide à résister à toutes sortes d'influences et de coercitions, et protège contre la peur et la terreur. »
- Soc : LDB 05 l.402 — « vous pousse à vous entendre avec les gens et à paraître assez plaisant et convenable. Elle vous aide lorsque vous discutez avec les gens du coin ou que vous commandez les gens en situation de combat, enjôlez les gardes ou tentez de les corrompre, et, pour les Personnages pieux, lorsque vous communiquez avec votre divinité. »

---

## Tableau des Attributs

**Source :** LDB 05 l.351-369 (Tableau des Attributs complet).

Bases de génération : 2d10 + modificateur de race. La Taille du tableau est : Humain / Nain / Halfling / Elfe (Haut elfe ou Elfe Sylvain).

| Caractéristique | Humain | Nain | Halfling | Elfe |
|-----------------|:------:|:----:|:--------:|:----:|
| CC | 2d10+20 | 2d10+30 | 2d10+10 | 2d10+30 |
| CT | 2d10+20 | 2d10+20 | 2d10+30 | 2d10+30 |
| F | 2d10+20 | 2d10+20 | 2d10+10 | 2d10+20 |
| E | 2d10+20 | 2d10+30 | 2d10+20 | 2d10+20 |
| I | 2d10+20 | 2d10+20 | 2d10+20 | 2d10+40 |
| Ag | 2d10+20 | 2d10+10 | 2d10+20 | 2d10+30 |
| Dex | 2d10+20 | 2d10+30 | 2d10+30 | 2d10+30 |
| Int | 2d10+20 | 2d10+20 | 2d10+20 | 2d10+30 |
| FM | 2d10+20 | 2d10+40 | 2d10+30 | 2d10+30 |
| Soc | 2d10+20 | 2d10+10 | 2d10+30 | 2d10+20 |
| **Mouvement** | 4 | 3 | 3 | 5 |

**Note :** la colonne Halfling indique « (2×BE)+BFM » pour les Blessures (voir § Blessures ci-dessous).
La génération des valeurs (étapes 1–3, échanges, 100 Points) est décrite dans [`avancement.md`](avancement.md).

---

## Bonus de Caractéristique

**Source :** LDB 05 l.405-408.

> « Le premier chiffre de la "dizaine" de chaque Caractéristique correspond à sa valeur de "bonus".
> Les Bonus de Caractéristique sont utilisés de différentes façons dans l'ensemble des règles, en
> particulier pour limiter les Talents et définir les Sorts. »
> — LDB 05 l.406-407

**Formule :** `Bonus = floor(Caractéristique / 10)` (chiffre des dizaines).

**Exemples (verbatim LDB 05 l.408) :**
- Force (F) 39 → Bonus de Force (BF) = **3**
- Force Mentale (FM) 51 → Bonus de Force Mentale (BFM) = **5**

**Abréviations utilisées dans les règles :** BF (Bonus de Force), BE (Bonus d'Endurance), BFM (Bonus de Force Mentale), BCC (Bonus de Capacité de Combat), BI (Bonus d'Initiative), BAg (Bonus d'Agilité), etc.

> **Usage combat :** le Bonus d'Endurance sert aussi directement en combat — chaque adversaire soustrait
> son BE (+ PA) des Dégâts reçus : « Soustrayez de vos Dégâts le Bonus d'Endurance de votre adversaire
> ainsi que tout PA protégeant la Localisation. » — LDB 13 l.159

---

## Statistiques dérivées — Blessures

### Formule de base

**Source :** LDB 05 l.365 (Tableau des Attributs) ; LDB 05 l.417-418 (§ Déterminer les Blessures).

> « Contrairement aux autres Attributs, les Points de Blessure sont calculés à partir de vos
> Caractéristiques, plus précisément vos Bonus de Force, d'Endurance et Force Mentale
> (abréviations BF, BE et BFM dans le Tableau des Attributs). Repérez simplement les Bonus
> appropriés sur votre Feuille de Personnage et additionnez-les pour déterminer vos Points de
> Blessures. » — LDB 05 l.416

**Formule (race standard) :**

```
Blessures = BF + (2 × BE) + BFM
```

Cette formule est valable pour : Humain, Nain, Elfe (Haut elfe, Elfe Sylvain).

### Cas particulier : talent Petit (Halflings)

**Source :** LDB 05 l.365 (Tableau des Attributs, colonne Halfling) ; LDB 05 l.418.

> « Note : les halflings ont automatiquement le Talent Petit et débutent avec moins de Points de
> Blessure (voir page 343). » — LDB 05 l.418

**Formule Halfling (Taille Petite, talent Petit) :**

```
Blessures = (2 × BE) + BFM
```

Le BF n'entre pas dans le calcul — conséquence directe du Trait de Taille **Petite** (voir tableau ci-dessous).

### Variantes par Taille (créatures)

**Source :** LDB 85 l.391-406 (§ Blessures dans le chapitre Traits de créature).

> « Les créatures plus grandes encaissent plus de Blessures. » — LDB 85 l.391

| Taille | Formule des Blessures |
|--------|----------------------|
| Minuscule | **1** (fixe) |
| Très Petite | **BE** |
| Petite | **(2 × BE) + BFM** |
| Moyenne | **BF + (2 × BE) + BFM** |
| Grande | **(BF + (2 × BE) + BFM) × 2** |
| Énorme | **(BF + (2 × BE) + BFM) × 4** |
| Monstrueuse | **(BF + (2 × BE) + BFM) × 8** |

Les sept catégories de Taille et leurs exemples (LDB 85 l.343-355) :

| Taille | Exemples |
|--------|----------|
| Minuscule | Papillon, souris, pigeon |
| Très Petite | Chat, faucon, bébé humain |
| Petite | Rat géant, halfling, enfant humain |
| Moyenne | Nain, elfe, humain |
| Grande | Cheval, ogre, troll |
| Énorme | Griffon, vouivre, manticore |
| Monstrueuse | Dragon, géant, Prince démon |

**Agrandir/réduire une créature (LDB 85 l.339-340) :** +1 catégorie de Taille → +10 F, +10 E, −5 Ag ; réduire inverse.

**Trait Endurant (LDB 85 l.129-130) :** augmente les Blessures d'un nombre égal au BE, appliqué *avant* tout modificateur de Taille.

### Blessures dynamiques (le maximum suit le profil)

**Source :** LDB 05 l.1001 ; LDB 10 l.384 ; LDB 48 l.23, l.27.

> « Votre score maximum résulte de vos Caractéristiques et Talents. […] Quand vous gagnez des
> Augmentations dans vos Caractéristiques et Talents, vos Points de Blessure peuvent, à leur tour,
> augmenter. » — LDB 05 l.1001

> « Lorsque le Sort s'achève et que vous reprenez votre vraie forme, les Points de Blessure éventuellement
> perdus le demeurent, avec un minimum de 0. » — LDB 48 l.27

Le maximum se calcule sur le profil COURANT — Augmentation, Talent (Très résistant, Dur à cuire), Trait
appliqué (Coriace), Dégâts de Caractéristique, mutation, sort —, plus l'écart du livre posé à la naissance
(B imprimé d'une créature type moins la formule, × 5 avec elle sous Nuée). La Taille et la Nuée sont celles du moment : un Trait Taille ou
Nuée accordé (Forme bestiale) entre dans la formule. Les Points perdus se conservent quand le maximum bouge.
Les effets magiques actifs qui modifient F, E ou FM font varier le maximum de Blessures en temps réel :
entre **Sorts**, seuls le **MEILLEUR bonus** et la **PIRE pénalité** s'appliquent (LDB 46 l.119) ; une même Prière
ne se cumule pas avec elle-même (LDB 40 l.19) ; les autres sources se somment (LDB 14 l.95).

---

## Statistiques dérivées — Mouvement

**Source :** LDB 05 l.448-456 (§ Mouvement, Tableau des Mouvements abrégé) ; LDB 15 l.19-31 (Tableau des Mouvements complet).

> « Le Mouvement est utilisé pour déterminer vos vitesses de marche et de course. Le Mouvement humain
> standard est de 4. Si vous utilisez une grille pour le déplacement, cela indique le nombre de cases
> que vous pouvez parcourir en un Round, ou de centimètres sur une table. À plus long terme, il indique
> combien de kilomètres par heure vous pouvez aisément parcourir à pied. » — LDB 05 l.449-450

**Valeurs de Mouvement par race (LDB 05 l.369) :**

| Race | Mouvement (M) |
|------|:-------------:|
| Humain | 4 |
| Nain | 3 |
| Halfling | 3 |
| Elfe (Haut elfe, Elfe Sylvain) | 5 |

**Tableau des Mouvements (extrait LDB 05 l.451-456 / LDB 15 l.19-31) :**

| M | Marche (m/tour) | Course (m/tour) |
|:-:|:---------------:|:---------------:|
| 3 | 6 | 12 |
| 4 | 8 | 16 |
| 5 | 10 | 20 |

Formule généralisée : **Marche = M × 2**, **Course (Charge) = M × 4**.

> **Note :** le Tableau au chapitre 05 utilise la colonne « Charge » pour ce que le chapitre 15 appelle
> « Course » (même valeurs : M×4). Le terme « Course » désigne aussi l'Action de Sprint (Athlétisme
> Accessible +20, distance supplémentaire = Course + DR). Voir [`deplacement.md`](deplacement.md).

**M n'est PAS une Caractéristique au sens des 10 CharKey** : il ne possède pas de Bonus de Caractéristique et n'entre pas dans les formules de Blessures. C'est un attribut fixe de race, modifiable uniquement par le talent Véloce (+1 M) ou des effets explicites (`moveMod`).

---

## Voir aussi

- [`avancement.md`](avancement.md) — génération à la création (2d10 + bonus, échanges, 100 Points), coûts PX des Augmentations.
- [`deplacement.md`](deplacement.md) — Tableau des Mouvements complet, voyage, Course hors combat, Charge.
- [`combat.md`](combat.md) — utilisation du Bonus d'Endurance pour absorber les Dégâts (LDB 13 l.159) ; Initiative et ordre de combat.
- [`talents.md`](talents.md) — Petit (Halfling, Taille Petite → formule Blessures réduite) ; Très Fort (+F) ; Dur à cuire (+Blessures) ; Véloce (+M).
- Taille créature : `src/engine/size.ts` — 7 catégories, `woundsForSize`, `resizeBySteps`.

---

## Implémente

Module principal : **`src/engine/characteristics.ts`**

| Fonction | RAW couvert |
|----------|-------------|
| `bonus(value)` | Bonus de Caractéristique = `floor(value / 10)` — LDB 05 l.406 |
| `baseWithTraits(c, key)` | Carac. de base + charMods des `liveTraits` (Élite/Coriace…), sans effets volatils |
| `effectiveChar(c, key)` | Valeur effective : base + passifs permanents + meilleur bonus − pire pénalité des effets magiques actifs — LDB 46 l.119 |
| `maxWounds(chars, size, traits)` | Blessures d'un profil : `BF + 2×BE + BFM` par Taille, Fabriqué (BF pour BFM), Endurant (+BE avant la Taille) — LDB 05 l.365, LDB 85 l.130/142/393-401 |
| `effectiveMaxWounds(c)` | Maximum : (`maxWounds` du profil courant à la Taille courante `tailleCourante` + `wounds.ecart`) × 5 sous le Trait Nuée (`isSwarm`, LDB 85 l.253), + `attrMod` de Blessures de tout porteur et des effets — LDB 05 l.1001, LDB 10 l.384 |
| `blessuresReconciliees(c)` | Réconciliation : `wounds.max` recalé, Points perdus conservés (plancher 0, part sous 0 dans `perduesSousZero` tant que le courant est 0, éteinte dès qu'il remonte, LDB 48 l.27) — LDB 05 l.1001, LDB 48 l.23 ; coutures : fin d'`applyOps`, `applyActiveEffect`, `removeActiveEffects`, spawn d'un porteur né mutant, et toute écriture de l'état (`transitionDuJeu`, chemins `CHEMINS_DES_COMBATTANTS`) |
| `blessuresPosees(c, maximum?, restantes?)` | Fabrique d'un porteur né : au maximum dérivé (écart 0), ou au B imprimé (écart dans l'unité d'une créature type : (B − attrMod) / 5 sous Nuée − formule, posé à la naissance) |
| `effectiveArmourAt(c, loc)` | PA effectifs à une localisation : armure portée + PA temporaires des effets magiques actifs |

Module secondaire : **`src/engine/size.ts`**

| Fonction | RAW couvert |
|----------|-------------|
| `woundsForSize(bf, be, bfm, size)` | Tableau Blessures × Taille — LDB 85 l.391-406 |
| `tailleCourante(c)` | Taille du moment : dernier Trait Taille accordé par un effet actif, sinon la Taille de naissance — LDB 85 l.342-344, LDB 48 l.23 |
| `resizeBySteps(chars, steps)` | +1 cat. Taille → +10 F, +10 E, −5 Ag — LDB 85 l.339-340 |
| `sizeDamageMultiplier` | ×N Dégâts si attaquant > N catégories — LDB 85 l.361 |
| `sizeGrantedQualities` | Dévastatrice (+1 cat), Percutante (+2 cat) — LDB 85 l.360 |
| `forceOpposedOutcome` | Force opposée : auto-victoire ≥ +2 cat, Critique requis si plus petit — LDB 85 l.377-378 |
| `SIZE_RANGED_MOD` | Modificateurs au Tir selon la Taille cible — LDB 14 l.142-165 |

Type de données : **`src/engine/types.ts`**

- `CharKey` : union littérale `'CC' | 'CT' | 'F' | 'E' | 'I' | 'Ag' | 'Dex' | 'Int' | 'FM' | 'Soc'` — 10 clés stables.
- `Characteristics` : `Record<CharKey, number>`.
- `CHAR_KEYS` : tableau ordonné des 10 clés (ordre LdB).

**Écarts code ↔ RAW :**

1. **Halfling — formule exacte :** le RAW (LDB 05 l.365) donne `(2×BE)+BFM` pour les Halflings grâce au talent Petit. Le code implémente cela via `woundsForSize(..., 'petite')` (Taille Petite) : la Taille est passée au spawn, le talent Petit s'applique implicitement. Cohérent RAW — à documenter si un Halfling devait avoir une Taille différente de Petite.

2. **Mouvement non modélisé comme Caractéristique :** M est un attribut de `Combatant` (`c.movement`), séparé du record `Characteristics`. Les effets le modifiant utilisent `moveMod` (pas `charMod`) — cohérent RAW car M ∉ CharKey et ne possède pas de Bonus de Caractéristique.

3. **Blessures dynamiques :** `effectiveMaxWounds` lit le profil effectif courant ; seul l'écart du livre (B imprimé − formule) est posé à la naissance. Lectures recommandées, révisables : le facteur × 5 d'une Nuée s'applique à la formule et à l'écart du livre (les Blessures d'une créature type), pas aux `attrMod` de Blessures posés sur la nuée ; une Nuée facultative ou de statbloc multiplie le B de la créature type, une Nuée imprimée (ZI 02 l.138-140 : B et CC marqués *) a déjà ses B et CC de nuée ; un porteur dont le courant remonte au-dessus de 0 sous une forme réduite a soldé la part de ses Points perdus sous 0, et une nouvelle chute à 0 ne la ramène pas (LDB 48 l.27 ne dit rien d'un soin sous la forme) ; un Trait Nuée accordé multiplie par 5 la formule du porteur ; Endurant sur une créature Minuscule ajoute son BE à 1.
