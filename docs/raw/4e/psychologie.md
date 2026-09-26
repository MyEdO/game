# Atlas RAW — Psychologie

> Référentiel autosuffisant des règles WFRP4 (RAW). Chaque règle cite `LDB NN l.X-Y` (source = dernier recours). Voir [`sources.md`](../sources.md), [`00-index.md`](00-index.md).
> ⚠️ Les champs **Implémente** sont GÉNÉRÉS (`npm run raw:implemente` — source éditoriale : `src/data/raw.manifest.json`) — ne pas les éditer à la main.

## Sommaire

- [Vue d'ensemble](#vue-densemble)
- [Test de Psychologie — principe général](#test-de-psychologie--principe-général)
- [Traits Psychologiques courants](#traits-psychologiques-courants)
  - [Animosité (Cible)](#animosité-cible)
  - [Peur (Indice)](#peur-indice)
  - [Terreur (Indice)](#terreur-indice)
  - [Frénésie](#frénésie)
  - [Haine (Cible)](#haine-cible)
  - [Préjugé (Cible)](#préjugé-cible)
- [Traits Psychologiques personnalisés](#traits-psychologiques-personnalisés)
  - [Amour](#amour)
  - [Camaraderie](#camaraderie)
  - [Phobie](#phobie)
  - [Trauma](#trauma)
- [Traits de créature psychologiques](#traits-de-créature-psychologiques)
  - [Animosité (Cible) — créature](#animosité-cible--créature)
  - [Belliqueux](#belliqueux)
  - [Effrayé (Cible)](#effrayé-cible)
  - [Frénésie — créature](#frénésie--créature)
  - [Haine (Cible) — créature](#haine-cible--créature)
  - [Immunité Psychologique](#immunité-psychologique)
  - [Nuée — immunité psy](#nuée--immunité-psy)
  - [Peur (Indice) — créature](#peur-indice--créature)
  - [Préjugé (Cible) — créature](#préjugé-cible--créature)
  - [Rage](#rage)
  - [Terreur par Taille](#terreur-par-taille)
  - [À Sang-Froid](#à-sang-froid)
- [Talents liés à la Psychologie](#talents-liés-à-la-psychologie)
  - [Contrôle de la Frénésie](#contrôle-de-la-frénésie)
  - [Effrayant](#effrayant)
  - [Frénésie (talent)](#frénésie-talent)
  - [Haine (Groupe) (talent)](#haine-groupe-talent)
  - [Sans Peur (Ennemi)](#sans-peur-ennemi)
- [État Brisé — lien avec la Psychologie](#état-brisé--lien-avec-la-psychologie)
- [Détermination contre la Psychologie](#détermination-contre-la-psychologie)
- [Table récapitulative](#table-récapitulative)

---

## Vue d'ensemble

Les instincts et émotions influencent fortement la façon dont les personnages réagissent en situation. Les règles de Psychologie constituent un système de Traits qui se déclenchent à la rencontre de certains groupes ou créatures, et dont les effets sont résistés ou surmontés par un Test de **Calme** (compétence = FM + avances Calme).

> « Nos instincts et nos émotions ont une très forte influence sur la façon dont nous réagissons en fonction des circonstances. » — `LDB 21 l.5`

**Sources RAW** :
- `LDB 21 l.5-11` — introduction générale

**Voir aussi** : État *Brisé* (`etats.md`), Détermination (`destin.md`)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 21` (l.5-11) → `PsychAffliction`, `openEncounterPsych`, `opRow`, `endEncounterPsych`, `supersededLines`, `targetedTrigger`, `chooseEnemyAction`, `PsychologyData`, `createCombatSlice`, `collectHeroRoundStartPsych`, +1 — `src/data/combat-stakes.json`, `src/data/index.ts`, `src/engine/psychology.ts`, `src/state/ai.ts`, `src/state/combatFlow.ts`, `src/state/combatSlice.ts`, +2 fichiers

---

## Test de Psychologie — principe général

Lorsqu'un personnage est exposé à un Trait Psychologique, il peut tenter de résister en réussissant un **Test de Calme** au début du Round. La Difficulté est déterminée par le MJ.

> « Sur un succès, les effets sont annulés jusqu'à la fin de la rencontre, même si d'autres Tests peuvent être nécessaires si les circonstances changent. » — `LDB 21 l.9`

La mécanique exacte (Test simple ou étendu, Indice à surmonter) varie selon le Trait (détaillée ci-après pour chacun).

**Sources RAW** :
- `LDB 21 l.7-11` — principe général + exemple Animosité d'un nain face à des elfes

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 21` (l.7-11) → `PsychAffliction`, `openEncounterPsych`, `opRow`, `endEncounterPsych`, `supersededLines`, `targetedTrigger`, `chooseEnemyAction`, `PsychologyData`, `createCombatSlice`, `collectHeroRoundStartPsych`, +1 — `src/data/combat-stakes.json`, `src/data/index.ts`, `src/engine/psychology.ts`, `src/state/ai.ts`, `src/state/combatFlow.ts`, `src/state/combatSlice.ts`, +2 fichiers

---

## Traits Psychologiques courants

### Animosité (Cible)

**Déclencheur** : rencontrer un membre du groupe-Cible (« nordlanders », « hommes-bêtes »…).

**Test de Psychologie** : Test de **Calme** (Difficulté MJ) au début du Round.

**Sur un succès** : marmonnements possibles, mais seulement **-20** aux Tests de Sociabilité envers ce groupe.

**Sur un échec** : *Animosité* (l'État actif).

**Effets de l'*Animosité* active** :
- Doit immédiatement s'en prendre au groupe (verbalement ou physiquement selon les circonstances).
- **+1 DR** à tous les Tests impliquant ce groupe (social ou physique).
- *Animosité* est annulé par *Peur* et *Terreur*.

**Fin de l'*Animosité*** : à la fin de chaque Round suivant, *peut* tenter un nouveau Test de Psychologie. Sans nouveau test, les effets cessent naturellement lorsque :
- tous les membres du groupe en Ligne de Vue se sont calmés ou ont disparu, OU
- le personnage gagne l'État *Sonné* ou *Inconscient*, OU
- il tombe sous le coup d'un autre effet psychologique.

> « Vous gagnez également +1 DR dès que vous vous en prenez au groupe, que cela soit socialement ou physiquement. *Animosité* est annulé par *Peur* et *Terreur*. » — `LDB 21 l.21`

**Sources RAW** :
- `LDB 21 l.17-21` — définition complète d'Animosité, effets actifs, conditions de fin

**Voir aussi** : Haine (Cible), Préjugé (Cible)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 21` (l.17-21) → `ApproachModal`, `FrenzyModal`, `PsychAffliction`, `openEncounterPsych`, `opRow`, `aiMaybeFrenzy`, `endEncounterPsych`, `describeApproach`, `describeFrenzy`, `supersededLines`, +32 — `src/data/combat-stakes.json`, `src/data/flow-stakes.json`, `src/data/index.ts`, `src/engine/psychology.ts`, `src/engine/tests.ts`, `src/engine/types.ts`, +15 fichiers

---

### Peur (Indice)

**Déclencheur** : présence d'une créature ou situation possédant un *Indice* de Peur.

**Test** : Test **étendu** de **Calme** (Intermédiaire +0 par défaut), une fois par Round.

**Mécanique** : le DR cumulé (de Round en Round) doit atteindre ou dépasser l'*Indice* de Peur pour vaincre la Peur.

> « La *Peur* représente une aversion extrême pour quelque chose. Les créatures qui causent la *Peur* possèdent un *Indice* de *Peur* ; cette valeur représente le DR que vous devez atteindre lorsque vous effectuez votre Test étendu de Calme pour vaincre cette *Peur*. » — `LDB 21 l.25`

**Effets tant que sous Peur** :
- **-1 DR** à tous les Tests en rapport avec la source de la Peur.
- Impossible de se rapprocher de la source sans réussir un **Test de Calme Intermédiaire (+0)**.
- Si la source s'approche : Test de **Calme Intermédiaire (+0)** ou gain d'un **État Brisé**.

> « Lorsque vous êtes sous le coup de la *Peur*, vous subissez -1 DR à tous les Tests en rapport avec la source de votre peur. Vous êtes incapable de vous rapprocher de ce qui provoque cette *Peur* à moins de réussir un Test de **Calme Intermédiaire (+0)**. Si la source de votre *Peur* se rapproche de vous, vous devez réussir un Test de **Calme Intermédiaire (+0)** ou gagner un État *Brisé*. » — `LDB 21 l.27`

**Sources RAW** :
- `LDB 21 l.23-27` — définition, Test étendu, effets sous Peur, approche de la source

**Voir aussi** : Terreur (Indice), État Brisé (`etats.md`)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 21` (l.23-27) → `ApproachModal`, `FrenzyModal`, `hasMeaningfulOption`, `opRow`, `aiMaybeFrenzy`, `availableFreeAttackOps`, `Condition`, `describeApproach`, `describeFrenzy`, `resolvePsychAI`, +40 — `src/data/flow-stakes.json`, `src/data/index.ts`, `src/engine/combat.ts`, `src/engine/flowCore.ts`, `src/engine/ops.ts`, `src/engine/psychology.ts`, +19 fichiers

---

### Terreur (Indice)

**Déclencheur** : première rencontre avec une créature qui inspire la Terreur.

**Test** : Test de **Calme** (Intermédiaire +0) — **une seule fois** à la première rencontre.

**Sur un succès** : aucun effet supplémentaire dû à la Terreur. La créature cause ensuite la *Peur* d'Indice équivalent.

**Sur un échec** : gain d'un nombre d'États **Brisé** égal à l'*Indice* de Terreur **+ les DR négatifs** (DR < 0).

> « Sur un succès, vous ne subissez aucun effet supplémentaire à cause de la *Terreur*. Sur un échec, vous gagnez autant d'États *Brisé* que l'*Indice* de *Terreur* de la créature, auquel vous rajoutez les DR inférieurs à 0. » — `LDB 21 l.54`

**Après le test** (succès ou échec) : la créature cause la *Peur* avec un *Indice* de Peur équivalent à son *Indice* de Terreur.

> « Une fois ce Test de Psychologie effectué, la créature cause la *Peur*, avec un *Indice* de *Peur* équivalent à son *Indice* de *Terreur*. » — `LDB 21 l.56`

**Sources RAW** :
- `LDB 21 l.54-56` — déclencheur, test unique, calcul des États Brisé, transition vers Peur

**Voir aussi** : Peur (Indice), État Brisé (`etats.md`)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 21` (l.54-56) → `nightmare`, `terreur`, `calme-d-approche`, `resolvePsychRow`, `endEncounterPsych`, `resolvePsychAI`, `humanizePerSL`, `amour`, `camaraderie`, `phobie`, +7 — `src/data/index.ts`, `src/data/night-stakes.json`, `src/data/psychology.json`, `src/data/regles.json`, `src/data/traits.json`, `src/engine/psychology.ts`, +4 fichiers

---

### Frénésie

**Déclencheur** : le personnage choisit d'entrer en Frénésie ; un **Test de Force Mentale** (non précisé comme Intermédiaire dans le texte, mais implémenté comme tel — cf. ci-dessous) est requis.

> « Vous pouvez, par le biais d'un Test de Force Mentale, vous mettre dans un état psychologique dans lequel vous allez vous surmotiver, mordre votre bouclier, etc. Sur un succès, vous entrez en *Frénésie*. » — `LDB 21 l.31`

**Effets en Frénésie** :
- Immunité à **tous les autres Traits Psychologiques**.
- Impossible de fuir ou de battre en retraite.
- Obligation de se déplacer au maximum vers l'ennemi le plus proche en Ligne de Vue pour l'attaquer.
- La seule Action possible est un Test de **Capacité de Combat** ou un Test d'**Athlétisme** (pour atteindre l'ennemi).
- **Attaque gratuite de Corps à corps** supplémentaire par Round.
- **+1 Bonus de Force** (grâce à la férocité).

> « Tant que vous êtes en *Frénésie*, vous êtes immunisé à tous les autres Traits Psychologiques, et sous aucun prétexte vous ne fuirez, ni ne battrez en retraite. À l'inverse, vous devez vous déplacer à votre maximum en direction de l'ennemi le plus proche dans votre Ligne de Vue pour l'attaquer. La seule Action possible est un Test de **Capacité de Combat** ou un Test d'**Athlétisme** pour atteindre votre ennemi le plus rapidement possible. De plus, vous pouvez effectuer un Test de **Capacité de Combat** gratuit chaque Round car vous vous lancez à corps perdu dans votre attaque. Enfin, vous gagnez un Bonus de Force de +1 grâce à votre férocité. » — `LDB 21 l.33`

**Fin de la Frénésie** : quand tous les ennemis en Ligne de Vue sont neutralisés, OU gain d'un État *Sonné* ou *Inconscient*.

**Conséquence** : à la fin de la Frénésie, gain immédiat de l'État **Exténué**.

> « Vous restez en *Frénésie* jusqu'à ce que tous les ennemis dans votre Ligne de Vue soient neutralisés ou que vous gagniez l'État *Sonné* ou *Inconscient*. Dès que votre *Frénésie* s'achève, vous gagnez l'État *Exténué*. » — `LDB 21 l.35`

**Sources RAW** :
- `LDB 21 l.29-33` — déclencheur, Test de FM, effets complets, conditions de fin, gain Exténué

**Voir aussi** : Talent Frénésie, Talent Contrôle de la Frénésie, État Exténué (`etats.md`)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 21` (l.29-33, l.35) → `ApproachModal`, `FrenzyModal`, `hasMeaningfulOption`, `opRow`, `fearSourceFor`, `psychImmuneToFrom`, `aiMaybeFrenzy`, `availableFreeAttackOps`, `Condition`, `describeApproach`, +42 — `src/data/flow-stakes.json`, `src/data/index.ts`, `src/engine/combat.ts`, `src/engine/flowCore.ts`, `src/engine/ops.ts`, `src/engine/psychology.ts`, +19 fichiers

---

### Haine (Cible)

**Déclencheur** : rencontrer un membre du groupe haï.

**Test** : Test de **Calme** (Difficulté MJ). Sur un succès, le personnage peut interagir normalement malgré ses sentiments (il n'interagira « jamais » volontiers, mais le Test le retient).

**Sur un échec** : *Haine* active.

**Effets de la *Haine* active** :
- Doit faire tout son possible pour **détruire le groupe haï**, le plus rapidement et violemment possible.
- **+1 DR** à tous les Tests de Combat contre ce groupe.
- **Immunité à *Peur* et *Intimidation*** causées par ce groupe (mais **pas** à *Terreur*).

**Fin de la Haine** : à la fin de chaque Round suivant, *peut* tenter un autre Test de Psychologie. Sans test, les effets cessent lorsque tous les membres en Ligne de Vue sont morts ou ont disparu, ou que le personnage gagne l'État *Inconscient*.

> « Tant que vous ressentez de la *Haine*, vous devez faire tout ce qui est en votre pouvoir pour détruire le groupe haï, et ce, le plus rapidement et de manière la plus violente possible. Vous gagnez +1 DR à tous vos Tests de Combat effectués contre le groupe en question, et êtes immunisé à *Peur* et *Intimidation* (mais pas *Terreur*) causés par ceux de ce groupe. » — `LDB 21 l.41`

**Sources RAW** :
- `LDB 21 l.37-39` — définition, déclencheur, Test, effets, immunités partielles, conditions de fin

**Voir aussi** : Talent Haine (Groupe)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 21` (l.37-39, l.41) → `ApproachModal`, `FrenzyModal`, `hasMeaningfulOption`, `nightmare`, `fearSourceFor`, `psychImmuneToFrom`, `terreur`, `aiMaybeFrenzy`, `availableFreeAttackOps`, `calme-d-approche`, +39 — `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/night-stakes.json`, `src/data/psychology.json`, `src/data/regles.json`, `src/data/traits.json`, +22 fichiers

---

### Préjugé (Cible)

**Déclencheur** : rencontrer un membre du groupe ciblé.

**Test** : Test de **Calme** (Difficulté MJ).

**Sur un succès** : froncements de sourcils possibles, mais comportement normal ; seulement **-10** aux Tests de Sociabilité envers ce groupe.

**Sur un échec** : *Préjugés* actifs → doit copieusement insulter la Cible à haute et intelligible voix.

**Fin des Préjugés** : à partir du Round suivant, peut tenter un nouveau Test. Sinon, cessent d'eux-mêmes lorsque tous les membres du groupe en Ligne de Vue ont disparu, que le personnage gagne l'État *Sonné* ou *Inconscient*, ou tombe sous un autre Trait Psychologique.

**Sources RAW** :
- `LDB 21 l.43-50` — définition, succès/échec, comportement obligatoire, conditions de fin

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 21` (l.43-50) → `hasMeaningfulOption`, `nightmare`, `fearSourceFor`, `psychImmuneToFrom`, `terreur`, `availableFreeAttackOps`, `calme-d-approche`, `Condition`, `resolvePsychRow`, `endEncounterPsych`, +27 — `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/night-stakes.json`, `src/data/psychology.json`, `src/data/regles.json`, `src/data/traits.json`, +15 fichiers

---

## Traits Psychologiques personnalisés

Le LDB propose des exemples de Traits personnalisés que le MJ peut créer pour ses scénarios. Les Traits ci-dessous en font partie.

### Amour

Reflète une très forte relation émotionnelle (romantique, familiale, amitié profonde).

**Obligation** : venir en aide à la personne aimée si elle est menacée physiquement ou verbalement.

**Bénéfices** :
- Immunité à *Peur* et *Intimidation* tant que le personnage défend les êtres aimés.
- **+1 DR** à tous les Tests en rapport avec cette défense.

**Sources RAW** :
- `LDB 21 l.73-77` — définition et effets

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 21` (l.73-77) → `encounterPsych`, `nightmare`, `fearSourceFor`, `terreur`, `refreshDefendedPsych`, `calme-d-approche`, `targetCausesEntries`, `targetCausedSourcesFor`, `targetCausedTrigger`, `aaBleedUnconsciousApply`, +9 — `src/data/index.ts`, `src/data/night-stakes.json`, `src/data/psychology.json`, `src/data/regles.json`, `src/data/traits.json`, `src/engine/encounterPsych.ts`, +4 fichiers

---

### Camaraderie

Sentiments positifs envers un groupe d'individus.

**Obligation** : leur venir en aide si le groupe est menacé.

**Bénéfice** : **+1 DR** lors des Tests effectués pour défendre ce groupe.

**Sources RAW** :
- `LDB 21 l.79-83` — définition et effets

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 21` (l.79-83) → `encounterPsych`, `nightmare`, `fearSourceFor`, `terreur`, `refreshDefendedPsych`, `calme-d-approche`, `targetCausesEntries`, `targetCausedSourcesFor`, `targetCausedTrigger`, `aaBleedUnconsciousApply`, +9 — `src/data/index.ts`, `src/data/night-stakes.json`, `src/data/psychology.json`, `src/data/regles.json`, `src/data/traits.json`, `src/engine/encounterPsych.ts`, +4 fichiers

---

### Phobie

Peur spécifique envers un Type de créature, un objet ou une situation.

**Règle** : traiter l'objet de la Phobie comme causant **Peur 1** (Indice augmentable si la Phobie est particulièrement forte).

**Sources RAW** :
- `LDB 21 l.85-89` — définition ; traitement comme Peur 1

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 21` (l.85-89) → `encounterPsych`, `nightmare`, `combat-psych`, `fearSourceFor`, `encounter-psych`, `needsRecoveryRoll`, `terreur`, `refreshDefendedPsych`, `calme-d-approche`, `targetCausesEntries`, +21 — `src/data/combat-stakes.json`, `src/data/index.ts`, `src/data/night-stakes.json`, `src/data/psychology.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, +12 fichiers

---

### Trauma

Conséquence d'une expérience traumatisante. Peut se manifester de diverses façons (cauchemars, Haine, Phobie, flash-backs, Hostilité).

**Exemple RAW** :
- Un personnage traumatisé par un incendie doit réussir un **Test de Calme Intermédiaire (+0)** à la vue d'un personnage *En flammes* ; sur un échec, gagne un État *Sonné* + un État *Sonné* par DR négatif.
- Chaque nuit : Test de **Calme Facile (+40)** ; sur un échec, gain de l'État *Exténué* (cauchemars).

**Sources RAW** :
- `LDB 21 l.91-95` — description + exemple de Trauma (incendie, cauchemars)

**Voir aussi** : `src/data/traumatisme.md` (`traumatisme.md` pour les Blessures Critiques)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 21` (l.91-95) → `encounterPsych`, `nightmare`, `combat-psych`, `fearSourceFor`, `encounter-psych`, `needsRecoveryRoll`, `terreur`, `calme-d-approche`, `targetCausesEntries`, `restRecovery`, +17 — `src/data/combat-stakes.json`, `src/data/index.ts`, `src/data/night-stakes.json`, `src/data/psychology.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, +10 fichiers

---

## Traits de créature psychologiques

### Animosité (Cible) — créature

> « La créature n'aime pas la *Cible*. Voir page 190 pour les règles concernant l'*Animosité*. » — `LDB 85`

Applique les mêmes règles que le Trait Psychologique Animosité (section ci-dessus).

**Sources RAW** : `LDB 85 l.23` — renvoi LDB 21

---

### Belliqueux

> « La créature adore combattre. Tant qu'elle a plus d'Avantages que son adversaire, elle gagne Immunité Psychologique. » — `LDB 85 l.51`

L'immunité est conditionnelle : elle ne s'applique que si la créature a **plus d'Avantages** que l'adversaire ciblé.

**Sources RAW** : `LDB 85 l.51` — condition d'immunité

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 85` (l.23, l.51) → `TraitDef`, `a-distance`, `arme`, `a-sang-froid`, `affame`, `amphibie`, `caudale`, `weaponFromTrait`, `cornes`, `FreeAttackHook`, +32 — `src/data/index.ts`, `src/data/maneuvers.json`, `src/data/traits.json`, `src/engine/creatureEquip.ts`, `src/engine/psychology.ts`, `src/engine/traits/dispatch.ts`, +8 fichiers

---

### Effrayé (Cible)

> « La créature a *Peur* 0 de la *Cible*. Voir **Psychologie** dans le **Chapitre 5 : Règles** à la page 190 pour les règles concernant la *Peur*. » — `LDB 85 l.122`

La créature est sujette à la Peur envers la Cible désignée, avec un Indice de 0 (seuil minimal).

**Sources RAW** : `LDB 85 l.122` — Peur 0 de la Cible

---

### Frénésie — créature

> « La créature peut entrer en *Frénésie*. Voir page 190. » — `LDB 85 l.150`

Applique exactement les mêmes règles que la Frénésie des personnages (section ci-dessus).

**Sources RAW** : `LDB 85 l.150` — renvoi LDB 21

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 85` (l.122, l.150) → `TraitDef`, `scene`, `planClimb`, `scenario`, `TraverseCapability`, `maxWounds`, `moveEnv`, `spawnMutations`, `EnemyTurnInput`, `effectiveMaxWounds`, +40 — `src/data/index.ts`, `src/data/maneuvers.json`, `src/data/qualities.json`, `src/data/traits.json`, `src/engine/characteristics.ts`, `src/engine/ops.ts`, +11 fichiers

---

### Haine (Cible) — créature

> « La créature hait profondément la *Cible*. Voir *Haine* à la page 190. » — `LDB 85 l.166`

Applique les mêmes règles que la Haine des personnages (section ci-dessus).

**Sources RAW** : `LDB 85 l.166` — renvoi LDB 21

---

### Immunité Psychologique

> « Peu importe que la créature soit téméraire, extrêmement stupide ou juste dans le feu de l'action, elle n'a peur de rien. Elle ignore les règles de la Psychologie. Voir page 190. » — `LDB 85 l.179-180`

La créature ignore **toutes** les règles de Psychologie sans Test.

**Sources RAW** :
- `LDB 85 l.178-179` — définition

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 85` (l.166, l.178-180) → `TraitDef`, `scene`, `planClimb`, `morsure`, `scenario`, `TraverseCapability`, `Formula`, `moveEnv`, `spawnMutations`, `EnemyTurnInput`, +59 — `src/data/index.ts`, `src/data/maneuvers.json`, `src/data/qualities.json`, `src/data/traits.json`, `src/engine/flowCore.ts`, `src/engine/magic.ts`, +15 fichiers

---

### Nuée — immunité psy

> « Elles ignorent les règles de Psychologie (voir page 190)… » — `LDB 85 l.253`

Les nuées ignorent automatiquement la Psychologie, au même titre que les créatures avec Immunité Psychologique.

**Sources RAW** : `LDB 85 l.253`

---

### Peur (Indice) — créature

> « La nature de la créature engendre de la *Peur* surnaturelle chez les autres créatures, égale à *Indice*. Voir page 190. » — `LDB 85 l.266`

La créature cause la Peur (Indice) aux adversaires. Applique les règles de Peur (Indice) décrites ci-dessus.

**Sources RAW** : `LDB 85 l.266` — renvoi LDB 21 + Indice défini dans le statbloc

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 85` (l.253, l.266) → `TraitDef`, `morsure`, `StatblockEditor`, `applySwarmBuild`, `spawnMutations`, `doc`, `resolvePsychAI`, `langue-prehensile`, `creatureToCombatant`, `traitAuras`, +54 — `src/data/index.ts`, `src/data/maneuvers.json`, `src/data/schemas/defs/traits.ts`, `src/data/traits.json`, `src/engine/combat.ts`, `src/engine/conditions.ts`, +10 fichiers

---

### Préjugé (Cible) — créature

> « La créature n'apprécie pas la *Cible*. Voir page 190 pour les règles concernant les *Préjugés*. » — `LDB 85 l.274`

Applique les mêmes règles que le Préjugé des personnages.

**Sources RAW** : `LDB 85 l.274` — renvoi LDB 21

---

### Rage

> « La créature peut entrer dans une rage dévorante. Elle peut dépenser tous ses Avantages (minimum 1) pour que celui devienne *Haine* envers ses adversaires en combat rapproché. Elle peut aussi dépenser tous ses Avantages (minimum 3) pour entrer en *Frénésie*. Voir page 190. » — `LDB 85 l.282`

Deux options de dépense d'Avantages :
- **Minimum 1 Avantage** : Avantages remplacés par *Haine* vs adversaires en mêlée.
- **Minimum 3 Avantages** : entrée directe en *Frénésie*.

**Sources RAW** : `LDB 85 l.282`

---

### Terreur par Taille

Les créatures agressives de grande Taille inspirent automatiquement Peur ou Terreur aux créatures plus petites, **même sans trait Peur/Terreur explicite** dans leur statbloc.

> « Si la créature est considérée comme agressive, elle provoquera la *Peur* chez toute créature plus petite qu'elle, et de la *Terreur* à toute créature plus petite qu'elle d'au moins deux catégories. Le niveau de *Peur* ou de *Terreur* égale la différence de catégories de Taille. Ainsi, si elle est de catégorie Grande et son adversaire de catégorie Petite, elle lui cause *Terreur* 2. » — `LDB 85 l.383-384`

**Table des catégories de Taille** (pour référence) :

| Catégorie | Exemples |
|-----------|----------|
| Minuscule | Papillon, souris, pigeon |
| Très petite | Chat, faucon, bébé humain |
| Petite | Rat géant, halfling, enfant humain |
| Moyenne | Nain, elfe, humain |
| Grande | Cheval, ogre, troll |
| Énorme | Griffon, vouivre, manticore |
| Monstrueuse | Dragon, géant, Prince démon |

**Règle d'effet** :
- Écart ≥ 1 catégorie → **Peur** (Indice = écart de catégories)
- Écart ≥ 2 catégories → **Terreur** (Indice = écart de catégories)

**Sources RAW** :
- `LDB 85 l.382-383` — règle Peur/Terreur par Taille

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 85` (l.274, l.282, l.382-384) → `TraitDef`, `StatblockEditor`, `cannotStopOn`, `markAttacked`, `agressifEnvers`, `seuilsDeSauvegarde`, `EnemyTurnInput`, `forceOpposedOutcome` ⚠sans-appelant, `woundsForSize`, `toucheSauvee`, +54 — `src/data/index.ts`, `src/data/maneuvers.json`, `src/data/regles.json`, `src/data/traits.json`, `src/engine/combat.ts`, `src/engine/engagement.ts`, +19 fichiers

---

### À Sang-Froid

> « La créature est à sang-froid et lente à réagir. Elle peut inverser tous ses Tests de **Force Mentale** échoués. » — `LDB 85 l.13`

Un Test de FM raté est relu avec ses chiffres inversés (ex. 91 → 19) ; si le résultat inversé est un succès, le Test est considéré réussi.

**Sources RAW** : `LDB 85 l.13`

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 85` (l.13) → `TraitDef`, `a-distance`, `arme`, `a-sang-froid`, `affame`, `creatureWeapon`, `amphibie`, `caudale`, `cornes`, `animosite`, +16 — `src/data/maneuvers.json`, `src/data/traits.json`, `src/engine/creatureEquip.ts`, `src/engine/psychology.ts`, `src/engine/traits/dispatch.ts`, `src/engine/traits/types.ts`

---

## Talents liés à la Psychologie

### Contrôle de la Frénésie

**Maxi** : Bonus de Force Mentale

**Tests** : Corps à corps quand en Frénésie

> « Vous êtes davantage en mesure de contrôler votre *Frénésie* en combat. Vous pouvez y mettre fin avec un Test de Calme réussi à la fin du Round. » — `LDB 10 l.255`

Par défaut (sans ce Talent), la Frénésie ne peut pas être terminée volontairement.

**Sources RAW** : `LDB 10 l.255`

---

### Effrayant

**Maxi** : Bonus de Force

> « Toute personne saine d'esprit réfléchit à deux fois avant de vous approcher. Si vous le souhaitez, vous avez un *Indice* de Peur de 1 (voir page 190). Ajoutez +1 à cet *Indice* par nombre de fois supplémentaires que vous avez pris ce Talent. » — `LDB 10 l.398`

Un personnage avec ce Talent peut activer un Indice de Peur de 1+ (selon les niveaux du Talent).

**Sources RAW** : `LDB 10 l.398`

---

### Frénésie (talent)

**Maxi** : 1

> « Vous pouvez entrer en *Frénésie* comme décrit à la page 190. » — `LDB 10 l.506`

Confère la capacité d'entrer en Frénésie (idem trait de créature Frénésie, mêmes règles).

**Sources RAW** : `LDB 10 l.506`

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 10` (l.255, l.398, l.506) → `distraire-roll`, `distraire`, `TriggeredEffect`, `combattant-en-espace-clos`, `concocter`, `contorsionniste`, `controle-de-la-frenesie`, `cooperatif`, `costaud`, `coude-a-coude`, +39 — `src/data/actions.json`, `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/talents.json`, `src/engine/flowCore.ts`, `src/state/combatFlow.ts`

---

### Haine (Groupe) (talent)

**Maxi** : Bonus de Force Mentale

**Tests** : Force Mentale (Groupe à combattre)

> « Vous êtes consumé par la haine pour quelque chose dans le Vieux Monde, comme décrit à la page 190. Chaque fois que vous prenez ce Talent, vous développez une certaine haine envers un nouveau groupe. » — `LDB 10 l.548`

Exemples de groupes : hommes-bêtes, peaux-vertes, monstres, hors-la-loi, sigmarites, morts-vivants, Sorciers dissidents.

**Sources RAW** : `LDB 10 l.548` ; effets à la page 190 = `LDB 21 l.37-39`

---

### Sans Peur (Ennemi)

**Maxi** : Bonus de Force Mentale

**Tests** : Calme pour s'opposer à l'Intimidation, la *Peur* et la *Terreur* de l'Ennemi

> « Vous êtes suffisamment courageux ou fou pour que la peur de certains ennemis ne soit qu'un lointain souvenir. Avec un seul Test de **Calme Accessible (+20)**, vous pouvez ignorer les effets d'Intimidation, de *Peur* ou de *Terreur* de l'ennemi spécifié quand vous le rencontrez. » — `LDB 10 l.1051`

**Ennemis courants** : hommes-bêtes, peaux-vertes, hors-la-loi, vampires, gardes, Sorciers dissidents.

**Mécanique** : ce Talent ne confère **pas** l'immunité automatique — il accorde **un seul Test de Calme Accessible (+20)** pour ignorer les effets. En cas d'échec, le personnage est sujet aux règles normales de Peur (avec Tests à Intermédiaire +0 les Rounds suivants).

**Sources RAW** :
- `LDB 10 l.1051` — définition, Test Accessible (+20), liste d'ennemis courants

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 10` (l.548, l.1051) → `fearImmuneVs`, `fearSourceFor`, `CombatFeature`, `resolvePsychAI`, `sansPeurVs`, `resolvePeurTest`, `resolveTerreurTest`, `CascadeStepMeta`, `frappe-assommante`, `frappe-blessante`, +22 — `src/data/talents.json`, `src/engine/combatFeatures/dispatch.ts`, `src/engine/combatFeatures/types.ts`, `src/engine/psychology.ts`, `src/state/combat/turnHooks.ts`, `src/state/combatFlow.ts`, +1 fichiers
- `LDB 21` (l.37-39) → `ApproachModal`, `FrenzyModal`, `hasMeaningfulOption`, `nightmare`, `fearSourceFor`, `psychImmuneToFrom`, `terreur`, `aiMaybeFrenzy`, `availableFreeAttackOps`, `calme-d-approche`, +39 — `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/night-stakes.json`, `src/data/psychology.json`, `src/data/regles.json`, `src/data/traits.json`, +22 fichiers

---

## État Brisé — lien avec la Psychologie

L'État *Brisé* est l'état principal produit par les mécanismes de Psychologie :
- Un Test de Peur raté quand la **source s'approche** → 1 État Brisé (`LDB 21 l.27`).
- Un Test de Terreur raté → nombre d'États Brisé = **Indice + |DR négatifs|** (`LDB 21 l.54-56`).

La **récupération** de l'État Brisé se fait par Test de Calme (Difficulté selon les circonstances), ou en se cachant hors de vue un Round entier. Voir description complète dans `etats.md` → section Brisé.

**Sources RAW** :
- `LDB 21 l.27` — Peur (approche source) → Brisé
- `LDB 21 l.54-56` — Terreur → Brisé (formule)
- `LDB 16 l.50-58` — récupération de l'État Brisé (cf. `etats.md`)

**Voir aussi** : `etats.md` → Brisé

---

## Détermination contre la Psychologie

Un Point de **Détermination** permet d'être immunisé à la Psychologie jusqu'à la fin du prochain Round.

> « Détermination (LDB 17 l.59) : immunité à la Psychologie jusqu'à la fin du prochain Round. » — commentaire `psychology.ts l.158`

Cette immunité ne supprime pas les afflictions déjà actives de façon permanente — elle **retarde** les déclencheurs : à expiration, les effets psy reprennent si la source est toujours présente.

**Sources RAW** :
- `LDB 17 l.59` — Détermination vs Psychologie

**Voir aussi** : `destin.md` (Détermination)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 17` (l.59) → `ResilienceButton`, `RenounceModal`, `DeterminationButton`, `CritLocationPicker`, `hasMeaningfulOption`, `sourceSuspended`, `CorruptionModal`, `ForcedRollPicker`, `suspendSource`, `forceCrewRole`, +96 — `src/data/characteristics.json`, `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/etats.ts`, `src/engine/combat.ts`, +50 fichiers

---

## Table récapitulative

| Trait | Test requis | Difficulté | Sur succès | Sur échec | Fin de l'effet |
|-------|-------------|-----------|------------|-----------|----------------|
| **Animosité** | Calme | MJ | -20 Sociabilité seul. | Doit s'en prendre au groupe (+1 DR offensif) | Re-test fin de Round ou groupe absent/Sonné/Inconscient |
| **Peur (Indice)** | Calme (étendu) | Intermédiaire (+0) | DR cumulé ≥ Indice → vaincue | -1 DR vs source ; ne peut approcher (Test +0) ; source approche → Brisé (Test +0) | Vaincue quand DR cumulé ≥ Indice |
| **Terreur (Indice)** | Calme (unique) | Intermédiaire (+0) | Aucun effet supp. ; puis Peur d'Indice équiv. | Brisé × (Indice + |DR négatifs|) ; puis Peur d'Indice équiv. | Test unique à la 1ʳᵉ rencontre |
| **Frénésie** | Force Mentale | Intermédiaire (+0) | Entre en Frénésie (+1BF, attaque gratuite, immunité psy) | Pas de Frénésie | Ennemis LoV neutralisés ou Sonné/Inconscient → Exténué |
| **Haine** | Calme | MJ | Interaction limitée ; -0 (comportement libre) | Doit détruire (+1 DR Combat, immunité Peur/Intimidation sauf Terreur) | Re-test fin de Round ou groupe mort/disparu/Inconscient |
| **Préjugé** | Calme | MJ | -10 Sociabilité seul. | Doit insulter la cible à voix haute | Re-test fin de Round ou groupe disparu/Sonné/Inconscient |
| **Phobie** | Calme (étendu) | Intermédiaire (+0) | — | Comme Peur 1 (ou Indice supérieur) | Même que Peur |
| **Amour/Camaraderie** | — | — | — | Obligation d'aide, +1 DR, immunité Peur/Intimidation (Amour) | Selon circonstances |

**Immunités croisées** :

| Trait actif | Immunisé contre |
|-------------|-----------------|
| Frénésie | Tous autres Traits Psychologiques |
| Haine | Peur et Intimidation du groupe haï (pas Terreur) |
| Amour (défense) | Peur et Intimidation |
| Immunité Psychologique (trait) | Tout |
| Belliqueux (si + Avantages) | Tout |
| Animosité active | Annulée par Peur et Terreur |

**Sources RAW récapitulatives** :
- `LDB 21 l.5-95` — toutes les règles de Psychologie (Traits courants + personnalisés)
- `LDB 85 l.178-179` — Immunité Psychologique
- `LDB 85 l.382-383` — Peur/Terreur par Taille
- `LDB 10 l.1051` — Talent Sans Peur (Ennemi)
- `LDB 17 l.59` — Détermination vs Psychologie

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 10` (l.1051) → `fearImmuneVs`, `fearSourceFor`, `CombatFeature`, `resolvePsychAI`, `sansPeurVs`, `resolvePeurTest`, `resolveTerreurTest`, `CascadeStepMeta`, `robuste`, `sans-peur`, +8 — `src/data/talents.json`, `src/engine/combatFeatures/dispatch.ts`, `src/engine/combatFeatures/types.ts`, `src/engine/psychology.ts`, `src/state/combat/turnHooks.ts`, `src/state/combatFlow.ts`, +1 fichiers
- `LDB 17` (l.59) → `ResilienceButton`, `RenounceModal`, `DeterminationButton`, `CritLocationPicker`, `hasMeaningfulOption`, `sourceSuspended`, `CorruptionModal`, `ForcedRollPicker`, `suspendSource`, `forceCrewRole`, +96 — `src/data/characteristics.json`, `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/etats.ts`, `src/engine/combat.ts`, +50 fichiers
- `LDB 21` (l.5-95) → `ApproachModal`, `FrenzyModal`, `hasMeaningfulOption`, `encounterPsych`, `nightmare`, `PsychAffliction`, `combat-psych`, `fearSourceFor`, `openEncounterPsych`, `opRow`, +78 — `src/data/combat-stakes.json`, `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/night-stakes.json`, `src/data/psychology.json`, `src/data/regles.json`, +34 fichiers
- `LDB 85` (l.178-179, l.382-383) → `TraitDef`, `morsure`, `cannotStopOn`, `markAttacked`, `agressifEnvers`, `Formula`, `spawnMutations`, `EnemyTurnInput`, `forceOpposedOutcome` ⚠sans-appelant, `woundsForSize`, +70 — `src/data/index.ts`, `src/data/maneuvers.json`, `src/data/qualities.json`, `src/data/regles.json`, `src/data/traits.json`, `src/engine/combat.ts`, +19 fichiers

---

## Créatures — instances à consulter

Les créatures qui portent les traits Peur, Terreur, Immunité Psychologique, Frénésie, Haine ou Animosité dans leur statbloc sont listées dans le bestiaire du jeu. Ce document couvre la **règle** ; les **instances** (quelle créature porte quel Indice) appartiennent au futur `bestiaire.md`.

**Voir aussi** : futur `bestiaire.md`
