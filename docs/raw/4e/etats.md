# Atlas RAW — États

> Référentiel autosuffisant des règles WFRP4 (RAW). Chaque règle cite `LDB NN l.X-Y` (source = dernier recours). Voir [`sources.md`](../sources.md), [`00-index.md`](00-index.md).
> ⚠️ Les champs **Implémente** sont GÉNÉRÉS (`npm run raw:implemente` — source éditoriale : `src/data/raw.manifest.json`) — ne pas les éditer à la main.

## Sommaire

- [Principes généraux](#principes-généraux)
- [États multiples et cumul](#états-multiples-et-cumul)
- [États et Détermination](#états-et-détermination)
- [Assourdi](#assourdi)
- [À Terre](#à-terre)
- [Aveuglé](#aveuglé)
- [Brisé](#brisé)
- [Empêtré](#empêtré)
- [Empoisonné](#empoisonné)
- [En Flammes](#en-flammes)
- [Exténué](#exténué)
- [Hémorragique](#hémorragique)
- [Inconscient](#inconscient)
- [Sonné](#sonné)
- [Surpris](#surpris)
- [Table récapitulative](#table-récapitulative)

---

## Principes généraux

Les États représentent les effets des événements survenant au cours des aventures. Ils peuvent être notés sur la feuille de personnage ou symbolisés par des pions.

La durée de chaque État est précisée dans sa description ; cependant, certaines causes (sort, Blessure critique) peuvent modifier cette durée.

> « Si vous subissez un État quel qu'il soit, vous perdez immédiatement tout Avantage. » — `LDB 16 l.7`

**Sources RAW** :
- `LDB 16 l.5-7` — définition des États + perte d'Avantage immédiate

**Voir aussi** : Avantage (`combat.md`), Détermination (`destin.md`)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 16` (l.5-7) → `effectiveChar`, `addCondition`, `addClockCondition`, `defenseValueMods`, `etatTestMods`, `PoolCandidate`, `dropWorst`, `poolWinner`, `GameOp`, `FREE_ATTACK_LABEL`, +10 — `src/data/index.ts`, `src/engine/characteristics.ts`, `src/engine/combat.ts`, `src/engine/conditions.ts`, `src/engine/ops.ts`, `src/engine/trauma.ts`, +2 fichiers

---

## États multiples et cumul

Deux règles de cumul s'appliquent selon que l'on parle du **même** État ou d'États **différents** :

### Même État : cumul additif des pénalités

Un personnage peut subir plusieurs fois le même État. Les pénalités s'accumulent.

> « Si vous avez 3 États _Hémorragique_, vous perdez 3 Points de Blessure par Round ; de même, si vous avez 3 États _Exténué_, vous subissez une pénalité de -30 à tous vos Tests. » — `LDB 16 l.11`

### États différents : on n'applique que la pénalité la plus forte

> « Vous pouvez également être sous l'emprise d'États différents simultanément. Lorsque cela se produit, les effets _ne se cumulent pas_ ; vous choisissez la pénalité la plus importante et vous l'appliquez. Donc, si vous êtes sous l'emprise des États _Exténué_ et _À Terre_, vous ne subirez qu'une pénalité de -20 à vos Tests, et non de -30. » — `LDB 16 l.13-15`

**Note RAW importante** : cette règle de non-cumul s'applique aux **pénalités aux Tests**. Les autres effets distincts (dégâts périodiques d'Hémorragique, contraintes de mouvement d'À Terre, etc.) s'appliquent bien simultanément.

**Exceptions au cumul** : plusieurs États **ne se cumulent pas du tout** (un seul pion possible) :
- **À Terre** (l.39 : « soit vous êtes _À Terre_, soit vous ne l'êtes pas »)
- **Inconscient** (l.114 : même principe)
- **Surpris** (l.134 : même principe)

**Sources RAW** :
- `LDB 16 l.11-13` — règle de cumul (même État = additif ; États différents = pénalité la plus forte seule)
- `LDB 16 l.37` — À Terre ne se cumule pas
- `LDB 16 l.115` — Inconscient ne se cumule pas
- `LDB 16 l.137` — Surpris ne se cumule pas

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 16` (l.11-15, l.37, l.115, l.137) → `PRONE_POSE`, `unstable`, `STABLE_COND_KINDS`, `etatNonCumulable`, `effectiveChar`, `doc`, `jsonOpSchema`, `stopBleedOutcome`, `empileSurPionExistant`, `mouvementIntact`, +74 — `src/data/etats.json`, `src/data/index.ts`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/etats.ts`, `src/data/schemas/defs/miscast.ts`, `src/engine/characteristics.ts`, +26 fichiers

---

## États et Détermination

Un État peut être annulé en dépensant un Point de Détermination.

**Sources RAW** :
- `LDB 16 l.19-21` — mention générale ; renvoi p. 171

**Voir aussi** : Détermination (`destin.md`)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 16` (l.19-21) → `effectiveChar`, `defenseValueMods`, `etatTestMods`, `PoolCandidate`, `dropWorst`, `poolWinner`, `GameOp`, `FREE_ATTACK_LABEL`, `combatTestPenaltyParts`, `isMovementSkill`, +12 — `src/data/index.ts`, `src/engine/characteristics.ts`, `src/engine/combat.ts`, `src/engine/conditions.ts`, `src/engine/ops.ts`, `src/engine/trauma.ts`, +3 fichiers

---

## Assourdi

**Comment l'obtenir** : bruit tonitruant, coup à la tête.

**Effets** :
- Pénalité de **-10** à tous les Tests impliquant l'audition.
- Tout adversaire attaquant en combat rapproché **par le flanc ou par derrière** gagne un bonus supplémentaire de **+10** pour toucher.

> « ce bonus n'est pas augmenté avec de multiples États _Assourdi_ » — `LDB 16 l.29`

**Retrait** : 1 pion retiré **à la fin de chaque Round après le premier**.

**Cumul** : oui (plusieurs pions possibles, mais le bonus de flanc/derrière ne s'augmente pas).

**Sources RAW** :
- `LDB 16 l.29` — effets + retrait

**Voir aussi** : Aveuglé (état analogue pour la vue)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 16` (l.29) → `PRONE_POSE`, `competenceParId`, `isMovementSkill`, `meleeAttackerBonusLines`, `AttackOptions`, `GameOp`, `SkillData`, `GameState`, `createCombatSlice`, `useGame`, +1 — `src/data/index.ts`, `src/engine/combat.ts`, `src/engine/conditions.ts`, `src/engine/ops.ts`, `src/gameIso/groundPose.ts`, `src/state/combatFlow.ts`, +2 fichiers

---

## À Terre

**Comment l'obtenir** : plus aucun Point de Blessure disponible, chute, coup d'une chose très grande.

**Effets** :
- Pendant le tour : le Mouvement ne peut servir qu'à **se relever** ou à **ramper** (½ Mouvement en mètres).
  - Si aucune Blessure restante : on ne peut **que ramper**.
- Pénalité de **-20** à tout Test impliquant un déplacement quelconque.
- Tout adversaire en Combat au Corps à corps gagne **+20** pour toucher.

**Retrait** : en se **relevant** (action de mouvement).
- **VERROU à 0 Point de Blessure** (`LDB 18 l.15`) : « Jusqu'à ce que vous puissiez au moins guérir 1 Point de Blessure, vous ne pourrez pas vous débarrasser de cet État ».
- **Par un Point de Détermination** (`LDB 17 l.61`) : « Retirez un État : si vous retirez l'État à Terre, regagnez 1 Point de Blessure lorsque vous vous mettez debout. » — la Blessure rendue lève le verrou ci-dessus.

**Cumul** : **non** — soit on est À Terre, soit on ne l'est pas.

**Sources RAW** :
- `LDB 16 l.33-39` — effets, contraintes de mouvement, retrait, non-cumul
- `LDB 17 l.61` — retrait par Détermination, et le Point de Blessure regagné en se mettant debout
- `LDB 18 l.15` — gagner l'État À Terre à 0 PB, et le verrou tant qu'aucune Blessure n'est guérie

**Voir aussi** : Traumatisme (`traumatisme.md`), Inconscient
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 16` (l.33-39) → `PRONE_POSE`, `collectHeroRoundEndUpkeep`, `findAwaitingExtension`, `competenceParId`, `isMovementSkill`, `meleeAttackerBonusLines`, `AttackOptions`, `GameOp`, `SkillData`, `GameState`, +3 — `src/data/index.ts`, `src/engine/combat.ts`, `src/engine/conditions.ts`, `src/engine/ops.ts`, `src/gameIso/groundPose.ts`, `src/state/combat/roundHooks.ts`, +3 fichiers
- `LDB 17` (l.61) → `ResilienceButton`, `RenounceModal`, `DeterminationButton`, `CritLocationPicker`, `hasMeaningfulOption`, `sourceSuspended`, `CorruptionModal`, `ForcedRollPicker`, `suspendSource`, `forceCrewRole`, +96 — `src/data/characteristics.json`, `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/etats.ts`, `src/engine/combat.ts`, +50 fichiers
- `LDB 18` (l.15) → `followsCharacterRules`, `isHealable`, `doc`, `estDebout`, `outOfCombatUpkeep`, `niMortNiATerre`, `HealWoundsOptions`, `needsRecoveryRoll`, `applyHealWounds`, `ACTION_GATES`, +24 — `src/data/index.ts`, `src/data/schemas/defs/etats.ts`, `src/engine/combat.ts`, `src/engine/conditions.ts`, `src/engine/critical.ts`, `src/engine/healing.ts`, +14 fichiers

---

## Aveuglé

**Comment l'obtenir** : éclair lumineux, liquide dans les yeux.

**Effets** :
- Pénalité de **-10** à tous les Tests impliquant la vue.
- Tout adversaire attaquant en combat rapproché gagne **+10** pour toucher.

**Retrait** : 1 pion retiré **à la fin de chaque Round, à partir du prochain Round**.

**Sources RAW** :
- `LDB 16 l.43-47` — effets + retrait

**Voir aussi** : Assourdi
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 16` (l.43-47) → `PRONE_POSE`, `combat-fatigue`, `doc`, `brise`, `Condition`, `aaBleedUnconsciousDue`, `tileSeenByFoe`, `empetre`, `empoisonne`, `hasFoeInLoS`, +17 — `src/data/combat-stakes.json`, `src/data/etats.json`, `src/data/index.ts`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/etats.ts`, `src/engine/conditions.ts`, +10 fichiers

---

## Brisé

**Comment l'obtenir** : terreur, défaite psychologique, panique — principalement via les règles de Psychologie (Peur, Terreur).

**Effets** :
- Mouvement et Action **doivent être utilisés pour fuir** aussi loin et aussi vite que possible, hors de vue de l'ennemi ; une fois à l'abri, l'Action peut servir à se dissimuler.
- Pénalité de **-10** à tous les Tests **autres** que ceux impliquant la **course** ou la **dissimulation**.

**Retrait** :
- **Engagé** avec un ennemi : aucun Test de récupération possible.
- **Non Engagé** : à la fin de chaque Round, Test de **Calme** (Difficulté selon les circonstances) ; chaque DR retire 1 État Brisé supplémentaire.
- Passer un Round entier **caché hors de vue** de tout ennemi : retire **1 État Brisé**.

> « il est plus facile de vous reprendre pour recouvrer vos esprits si vous vous cachez derrière un tonneau au fond d'une impasse située loin du danger (Accessible +20) plutôt que lorsque vous vous trouvez à trois enjambées d'un démon salivant qui réclame votre sang (Très difficile -30). » — `LDB 16 l.54`

**Cumul** : oui (plusieurs pions, chacun retiré séparément).

**Sources RAW** :
- `LDB 16 l.50-58` — effets, contraintes de comportement, retrait

**Voir aussi** : Psychologie (`psychologie.md`), Exténué
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 16` (l.50-58) → `combat-fatigue`, `doc`, `StateRecoveryModal`, `EnemyAction`, `addCondition`, `brise`, `Condition`, `aaBleedUnconsciousDue`, `describeStateRecovery`, `tileSeenByFoe`, +25 — `src/data/combat-stakes.json`, `src/data/etats.json`, `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/etats.ts`, +17 fichiers

---

## Empêtré

**Comment l'obtenir** : cordes, toile d'araignée, empoignade, tout ce qui restreint le déplacement.

**Effets** :
- Pendant le tour : **Mouvement nul** (impossible de se déplacer).
- Toute action impliquant un déplacement subit une pénalité de **-10** (dont l'Empoignade).

**Retrait** : Test opposé de **Force** contre la source de l'empêtrement (Action) ; chaque DR retire 1 État Empêtré supplémentaire.

**Cumul** : oui.

**Sources RAW** :
- `LDB 16 l.60-66` — définition et effets de déplacement
- `LDB 16 l.72` — retrait par Test de Force opposé (chaque DR retire un État _Empêtré_ supplémentaire)

> « Vous pouvez utiliser votre Action pour retirer l'État _Empêtré_ en réussissant un Test opposé **de Force** contre la source de cet empêtrement, et chaque DR obtenu permet de retirer un État _Empêtré_ supplémentaire. » — `LDB 16 l.66`

**Voir aussi** : Empoignade (`combat.md`)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 16` (l.60-66, l.72) → `combat-fatigue`, `doc`, `StateRecoveryModal`, `EnemyAction`, `addCondition`, `brise`, `Condition`, `aaBleedUnconsciousDue`, `describeStateRecovery`, `tileSeenByFoe`, +24 — `src/data/combat-stakes.json`, `src/data/etats.json`, `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/etats.ts`, +17 fichiers

---

## Empoisonné

**Comment l'obtenir** : ingestion ou injection de poison ou venin.

**Effets** :
- **À la fin de chaque Round** : perte de **1 Point de Blessure**, en ignorant tous les modificateurs.
- Pénalité de **-10** à tous les Tests.
- À **0 PB** en étant Empoisonné : impossible de soigner des Blessures tant que des États Empoisonné subsistent.
- **Inconscient** en étant Empoisonné : Test de Résistance après un nombre de Rounds égal au Bonus d'Endurance — en cas d'échec, mort dans d'horribles souffrances.

**Retrait** :
- À la fin de chaque Round : Test de **Résistance** ; succès = retire 1 État Empoisonné (+ 1 par DR).
- Test de **Guérison** réussi : même résultat.
- La difficulté dépend du poison ou venin en question.
- Une fois tous les États Empoisonné retirés : **gain de 1 État Exténué**.

**Cumul** : oui (1 dégât par pion par Round).

**Sources RAW** :
- `LDB 16 l.68-78` — définition, effets, retrait, conséquences à 0 PB et Inconscient

**Voir aussi** : Traumatisme (`traumatisme.md`), Exténué, Drogues et poisons (`LDB 71`)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 16` (l.68-78) → `combat-fatigue`, `doc`, `StateRecoveryModal`, `EnemyAction`, `Formula`, `addCondition`, `brise`, `aaBleedUnconsciousDue`, `Condition`, `describeStateRecovery`, +24 — `src/data/combat-stakes.json`, `src/data/etats.json`, `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/etats.ts`, +15 fichiers

---

## En Flammes

**Comment l'obtenir** : contact avec le feu (si le personnage est inflammable — vêtements, etc.) ; certains effets magiques ou divins peuvent enflammer même les non-combustibles.

**Effets (fin de chaque Round)** :
- Subir **1d10 Points de Blessure**, modifié par le **Bonus d'Endurance** (BE) et les **PA de la localisation la moins protégée** (minimum 1 Blessure).
- Pour chaque État En flammes **supplémentaire** : **+1 aux Dégâts** subis.

> « si vous avez 3 États _En flammes_, vous subissez 1d10+2 Points de Blessure. » — `LDB 16 l.84`

Formule : `max(1, 1d10 + (pions - 1) - BE - PA_min)`

**Retrait** : Test d'**Athlétisme** (Difficulté selon les circonstances : rouler dans du sable = plus facile, cuisine pleine d'huile = plus difficile) ; succès = retire 1 État En flammes (+ 1 par DR).

**Sources RAW** :
- `LDB 16 l.80-84` — condition d'inflammabilité, dégâts, formule, retrait

**Voir aussi** : Traumatisme (`traumatisme.md`)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 16` (l.80-84) → `combat-fatigue`, `doc`, `EnemyAction`, `Formula`, `needsRecoveryRoll`, `brise`, `describeStateRecovery`, `formulaForShape`, `empetre`, `empoisonne`, +12 — `src/data/combat-stakes.json`, `src/data/etats.json`, `src/data/flow-stakes.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/etats.ts`, `src/engine/conditions.ts`, +10 fichiers

---

## Exténué

**Comment l'obtenir** (plusieurs sources) :
- Une fois tous les États Brisé dissipés : **gain de 1 État Exténué**.
- Une fois tous les États Sonné dissipés : **gain de 1 État Exténué** (si pas déjà Exténué).
- Une fois tous les États Hémorragique retirés : **gain de 1 État Exténué**.
- Une fois tous les États Empoisonné retirés : **gain de 1 État Exténué**.
- Une fois l'État Inconscient levé : **gain de 1 État Exténué** (avec À Terre).
- **Option MJ** : échouer un Test de Résistance après (BE) Rounds d'actions exténuantes.
- **Encombrement** excessif (voir LDB 61).
- **Cauchemars** (LDB 21) : Test de Calme Facile (+40) raté → 1 État Exténué.
- **Frénésie** (LDB 21) : quand la Frénésie prend fin (plus d'ennemi en ligne de vue, ou gain d'État Sonné/Inconscient) → **gain de 1 État Exténué** immédiat. `LDB 21 l.33`

**Effets** :
- Pénalité de **-10** à tous les Tests (par pion ; 3 États Exténué = -30).

**Retrait** : **repos** (durée laissée au MJ selon le style de partie), sort ou effet divin ; dans certains cas (Encombrement), modifier la charge peut suffire.

> « C'est le MJ qui va décider du temps nécessaire pour retirer un État _Exténué_. » — `LDB 16 l.101`

**Cumul** : oui (chaque pion ajoute -10 ; pas de plafond RAW précisé).

**Sources RAW** :
- `LDB 16 l.86-101` — définition, effets, retrait, option MJ Se fatiguer, durée de repos
- `LDB 21 l.33` — Frénésie : gain Exténué à la fin de la Frénésie

**Voir aussi** : Brisé, Sonné, Hémorragique, Empoisonné, Inconscient, Traumatisme (`traumatisme.md`), Psychologie (`psychologie.md`)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 16` (l.86-101) → `combat-fatigue`, `unstable`, `doc`, `EnemyAction`, `stopBleedOutcome`, `Formula`, `needsRecoveryRoll`, `brise`, `sleepParty`, `restRecovery`, +28 — `src/data/combat-stakes.json`, `src/data/etats.json`, `src/data/flow-stakes.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/etats.ts`, `src/engine/conditions.ts`, +15 fichiers
- `LDB 21` (l.33) → `ApproachModal`, `FrenzyModal`, `hasMeaningfulOption`, `fearSourceFor`, `psychImmuneToFrom`, `aiMaybeFrenzy`, `availableFreeAttackOps`, `Condition`, `describeApproach`, `describeFrenzy`, +39 — `src/data/flow-stakes.json`, `src/data/index.ts`, `src/engine/combat.ts`, `src/engine/flowCore.ts`, `src/engine/ops.ts`, `src/engine/psychology.ts`, +18 fichiers

---

## Hémorragique

**Comment l'obtenir** : Blessures critiques (saignement), certains sorts ou poisons, effets de créature.

**Effets (fin de chaque Round)** :
- Perte de **1 Blessure par pion** (en ignorant tous les modificateurs).
- Pénalité de **-10** aux Tests pour résister à une *Blessure Purulente*, *Infection Mineure* ou *Infection du Sang* (LDB 16 ; cf. maladies.md).
- À **0 PB** : plus de perte de PB supplémentaires, mais **chute Inconsciente** immédiate (gain État Inconscient).
- **Jet de mort** : à la fin du Round, **10 % de chance de mourir par pion** Hémorragique (3 pions → mort sur 1-30 au d100).
- **Double sur le jet de mort** : coagulation — perd 1 État Hémorragique (le double prime sur la mort).

**Retrait** :
- Test de **Guérison** réussi : retire 1 État Hémorragique (+ 1 par DR).
- Sort ou Prière qui guérit des Points de Blessure : 1 État retiré par Point de Blessure guéri.
- Une fois tous les États Hémorragique retirés : **gain de 1 État Exténué**.

**Cumul** : oui.

**Note** : impossible de reprendre conscience tant que tous les États Hémorragique ne sont pas retirés.

**Sources RAW** :
- `LDB 16 l.103-109` — effets, jet de mort, coagulation (double), retrait, transition vers Exténué

**Voir aussi** : Inconscient, Traumatisme (`traumatisme.md`), Maladies (`maladies.md`)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 16` (l.103-109) → `combat-fatigue`, `unstable`, `etatNonCumulable`, `doc`, `jsonOpSchema`, `stopBleedOutcome`, `empileSurPionExistant`, `mouvementIntact`, `opRow`, `useAttackJetProps`, +46 — `src/data/combat-stakes.json`, `src/data/etats.json`, `src/data/index.ts`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/etats.ts`, `src/data/schemas/defs/miscast.ts`, +23 fichiers

---

## Inconscient

**Comment l'obtenir** : 0 PB depuis plus de (Bonus d'Endurance) Rounds (héros/importants), Mort Subite à 0 PB (figurants), certains sorts ou effets.

**Effets** :
- **Aucune action** possible ; pas de conscience de l'environnement.
- Un attaquant qui cible le personnage bénéficie de la règle **Je ne faillirai pas !** sans dépenser de Point de Résilience ; **ou** (si le MJ préfère) : attaque en combat rapproché = **mort automatique**.
- Toute attaque à distance est un **succès automatique** avec les mêmes dégâts qu'à bout portant.

**Retrait** : selon les circonstances ayant causé l'inconscience (renvoi aux Traumatismes, LDB p. 172).
- Si un Point de Détermination est dépensé pour lever l'État Inconscient mais que la cause persiste : nouvel État Inconscient à la fin du Round.
- En levant l'État Inconscient : gain des États **À Terre** et **Exténué**.
- **Inconscience à 0 Point de Blessure** (`LDB 18 l.15`) : « si vous n'êtes pas guéri avant un nombre de Rounds égal à votre Bonus d'Endurance, vous perdrez connaissance, et gagnerez l'État *Inconscient*. Et vous ne reviendrez pas à vous avant de guérir d'au moins 1 Point de Blessure ».

**Cumul** : **non** — soit on est Inconscient, soit on ne l'est pas.

**Sources RAW** :
- `LDB 16 l.111-119` — effets, attaque facilité, retrait, transition vers À Terre + Exténué
- `LDB 18 l.15` — perte de connaissance à 0 PB après BE Rounds, et retour à soi seulement une Blessure guérie

**Voir aussi** : Traumatisme (`traumatisme.md`), Hémorragique, Empoisonné, À Terre, Exténué
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 16` (l.111-119) → `combat-fatigue`, `unstable`, `STABLE_COND_KINDS`, `etatNonCumulable`, `doc`, `jsonOpSchema`, `stopBleedOutcome`, `empileSurPionExistant`, `mouvementIntact`, `opRow`, +51 — `src/data/combat-stakes.json`, `src/data/etats.json`, `src/data/index.ts`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/etats.ts`, `src/data/schemas/defs/miscast.ts`, +22 fichiers
- `LDB 18` (l.15) → `followsCharacterRules`, `isHealable`, `doc`, `estDebout`, `outOfCombatUpkeep`, `niMortNiATerre`, `HealWoundsOptions`, `needsRecoveryRoll`, `applyHealWounds`, `ACTION_GATES`, +24 — `src/data/index.ts`, `src/data/schemas/defs/etats.ts`, `src/engine/combat.ts`, `src/engine/conditions.ts`, `src/engine/critical.ts`, `src/engine/healing.ts`, +14 fichiers

---

## Sonné

**Comment l'obtenir** : coup sur la tête, désorientation, confusion.

**Effets** :
- **Action impossible** pendant le tour.
- Mouvement réduit à **½ Mouvement**.
- Peut se défendre lors de Tests opposés **sauf** ceux utilisant **Langue (Magick)**.
- Pénalité de **-10** à tous les Tests.
- Tout adversaire tentant de frapper en Combat au Corps à corps gagne **+1 Avantage** avant son attaque.

**Retrait** : à la fin de chaque Round, Test de **Résistance Intermédiaire (+0)** ; succès = retire 1 État Sonné (+ 1 par DR). Une fois tous les États Sonné retirés : **gain de 1 État Exténué** (si pas déjà Exténué).

**Cumul** : oui.

**Sources RAW** :
- `LDB 16 l.123-129` — effets, langue magick, -10 tests, +1 avantage attaquant, retrait, transition Exténué

**Voir aussi** : Exténué, Magie (`magie.md`)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 16` (l.123-129) → `STABLE_COND_KINDS`, `etatNonCumulable`, `doc`, `jsonOpSchema`, `empileSurPionExistant`, `mouvementIntact`, `opRow`, `useAttackJetProps`, `toucheSauvee`, `ResolveWindow`, +40 — `src/data/etats.json`, `src/data/index.ts`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/etats.ts`, `src/data/schemas/defs/miscast.ts`, `src/engine/combat.ts`, +18 fichiers

---

## Surpris

**Comment l'obtenir** : pris au dépourvu, embuscade, début de combat après surprise.

**Effets** :
- **Ni Mouvement ni Action** possibles pendant ce tour.
- **Impossible de se défendre** lors de Tests opposés.
- Tout adversaire attaquant en Combat au Corps à corps gagne **+20 à la CC**.

**Retrait** :
- **À la fin de chaque Round**, ou
- **Après la première tentative de toucher** (même si elle échoue).

**Cumul** : **non** — un seul pion possible (techniquement, on peut être surpris plusieurs fois dans un Round, mais l'État ne s'empile pas).

**Sources RAW** :
- `LDB 16 l.131-139` — effets, retrait, non-cumul

**Voir aussi** : Initiative et Surprise (`combat.md`)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 16` (l.131-139) → `STABLE_COND_KINDS`, `buildExposureBand`, `DOCTRINES`, `applyIncomingMeleeAdvantage`, `combat-helpless-mode`, `pickDoctrine`, `chooseEnemyAction`, `hemorragique`, `inconscient`, `sonne`, +11 — `src/data/etats.json`, `src/data/reglesOptionnelles.json`, `src/engine/conditions.ts`, `src/state/ai.ts`, `src/state/combat/flowEval.ts`, `src/state/combatFlow.ts`, +2 fichiers

---

## Table récapitulative

| État | Pénalité Tests | Bonus attaquant mêlée | Mouvement | Action | Défense | Durée/Retrait | Cumul | Conséquence retrait |
|---|---|---|---|---|---|---|---|---|
| **Assourdi** | -10 (audition) | +10 flanc/derrière* | — | — | — | Fin de Round (auto -1) | Oui | — |
| **À Terre** | -20 (déplacement) | +20 | Se relever ou ramper ½M | — | — | En se relevant (≥ 1 PB, `LDB 18 l.15`) ou Détermination (+1 PB, `LDB 17 l.61`) | Non | — |
| **Aveuglé** | -10 (vue) | +10 | — | — | — | Fin de Round (auto -1) | Oui | — |
| **Brisé** | -10 (sauf course/discrétion) | — | Fuir obligatoire | Fuir/se cacher obligatoire | — | Test Calme (fin Round, si non Engagé) ou 1 Round caché | Oui | 1 Exténué |
| **Empêtré** | -10 (déplacement) | — | Nul | — | — | Test Force opposé (Action) | Oui | — |
| **Empoisonné** | -10 | — | — | — | — | Test Résistance (fin Round) ou Guérison | Oui | 1 Exténué |
| **En Flammes** | — | — | — | — | — | Test Athlétisme (1+DR) | Oui | — |
| **Exténué** | -10/pion | — | — | — | — | Repos / sort / divin | Oui | — |
| **Hémorragique** | -10 (résist. infection) | — | — | — | — | Guérison ou sort/prière | Oui | 1 Exténué |
| **Inconscient** | — | Résilience gratuite† | Néant | Néant | Aucune | Selon circonstances/Traumatisme | Non | À Terre + Exténué |
| **Sonné** | -10 | +1 Avantage‡ | ½ Mouvement | Impossible | Oui (sauf Langue Magick) | Test Résistance (+0, fin Round) | Oui | 1 Exténué |
| **Surpris** | — | +20 CC | Néant | Néant | Aucune | Fin Round ou 1ʳᵉ tentative de toucher | Non | — |

\* Le bonus Assourdi par flanc/derrière ne se cumule pas avec plusieurs pions Assourdi.
† L'attaquant bénéficie de « Je ne faillirai pas ! » gratuitement ; ou mort automatique en corps à corps (au choix du MJ).
‡ +1 Avantage pour l'attaquant avant son jet (non cumulable).

**Dégâts périodiques (fin de Round)** :
| État | Dégâts | Formule |
|---|---|---|
| Hémorragique | 1 PB / pion | Fixe (ignore modificateurs) |
| Empoisonné | 1 PB / pion | Fixe (ignore modificateurs) |
| En Flammes | variable | `max(1, 1d10 + (pions-1) - BE - PA_min)` |

**Sources RAW** :
- `LDB 16 l.15-17` — liste complète des 12 États
- `LDB 16 l.27-139` — descriptions individuelles

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 16` (l.15-17, l.27-139) → `PRONE_POSE`, `combat-fatigue`, `unstable`, `STABLE_COND_KINDS`, `etatNonCumulable`, `effectiveChar`, `doc`, `jsonOpSchema`, `StateRecoveryModal`, `EnemyAction`, +107 — `src/data/combat-stakes.json`, `src/data/etats.json`, `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/etats.ts`, +37 fichiers
- `LDB 17` (l.61) → `ResilienceButton`, `RenounceModal`, `DeterminationButton`, `CritLocationPicker`, `hasMeaningfulOption`, `sourceSuspended`, `CorruptionModal`, `ForcedRollPicker`, `suspendSource`, `forceCrewRole`, +96 — `src/data/characteristics.json`, `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/etats.ts`, `src/engine/combat.ts`, +50 fichiers
- `LDB 18` (l.15) → `followsCharacterRules`, `isHealable`, `doc`, `estDebout`, `outOfCombatUpkeep`, `niMortNiATerre`, `HealWoundsOptions`, `needsRecoveryRoll`, `applyHealWounds`, `ACTION_GATES`, +24 — `src/data/index.ts`, `src/data/schemas/defs/etats.ts`, `src/engine/combat.ts`, `src/engine/conditions.ts`, `src/engine/critical.ts`, `src/engine/healing.ts`, +14 fichiers

---

## États avec durée modifiée ou retrait conditionnel

### Durées en heures (hors Rounds)

Le LDB 16 exprime toutes les durées en Rounds. Plusieurs sources introduisent des durées en **heures** ou des retraits conditionnels atypiques :

**EDO (L'ennemi dans l'Ombre), Appendice 2 — Symptôme « Délire »** :
- Sur 3-5 au d10 : gain d'**1 État Inconscient** pendant l'heure suivante + **1 État Exténué** pendant 1d10 heures.
- Sur 6-9 : gain d'**1 État Sonné** pendant l'heure qui suit.
- Sur 10 : gain de **+1 État Sonné** pendant 1d10 heures.

> « 3-5 endormi mais pas reposé. Vous gagnez 1 État _Inconscient_ pendant l'heure suivante et 1 État _Exténué_ pendant les 1d10 heures suivantes. » — `EDO App.2 l.129`

> « 6-9 déformées, vous gagnez un État _Sonné_ pendant l'heure qui suit. » — `EDO App.2 l.133`

**LDB 46 (Règles magiques) — Imparfaites (contrecoups mineurs d100)** :
- **16-20 Cérumen** : **État Assourdi** qui ne peut être retiré que lorsque quelqu'un nettoie les oreilles via un Test de Guérison réussi. Retrait conditionnel (compétence tierce, non par Test propre). `LDB 46 l.36`
- **26-30 Rupture** : gain de **1d10 États Hémorragique** instantanément (cumul massif inhabituel). `LDB 46 l.39`
- **36-40 Secousse spirituelle** : gain de l'**État À Terre**. `LDB 46 l.40`
- **46-50 Tenue indisciplinée** : État **Enchevêtré** (= Empêtré) avec une **Force de 1d10 × 5** pour résister. La valeur de Force est aléatoire et variable à chaque occurrence (non standard : LDB 16 ne fixe pas la Force de la source pour un sort). `LDB 46 l.43-44`
- **56-60 Drain de l'âme** : **État Exténué** qui dure **1d10 heures** (durée en heures, pas en Rounds). `LDB 46 l.45`
- **61-65 Distraction** : si Engagé en combat, gain de l'**État Surpris** ; sinon simple déconcentration sans État. (L'État Surpris peut donc être infligé en cours de combat, pas seulement à l'initiative.) `LDB 46 l.46`
- **66-70 Visions impies** : **État Aveuglé** ; Test de **Calme Intermédiaire (+0)** ou gain d'un deuxième État Aveuglé. `LDB 46 l.47-48`
- **76-80 L'horreur !** : Test de **Calme Difficile (-20)** ou gain de **1 État Brisé**. `LDB 46 l.49`

> 16-20 — « Cérumen : vos oreilles se bouchent instantanément à cause d'une cire épaisse. Gagnez 1 État Assourdi, qui ne peut être retiré jusqu'à ce que quelqu'un les nettoie pour vous (en utilisant avec succès la Compétence Guérison). » — `LDB 46 l.39`

> 56-60 — « Drain de l'âme : gagnez 1 État Exténué, qui dure 1d10 heures. » — `LDB 46 l.47`

**LDB 46 (Règles magiques) — Contrecoups Majeurs (d100 séparé)** :
- **06-10 Regard maudit** : **État Aveuglé** ne peut être retiré **d'aucune façon** pendant 1d10 heures. `LDB 46 l.59`
- **11-15 Choc aethyrique** : 1d10 Blessures ignorant BE et PA ; Test de **Résistance Accessible (+20)** ou gain de **1 État Sonné**. `LDB 46 l.60`
- **21-25 Rébellion intestinale** : **État Exténué** qui ne peut être retiré **tant que le personnage ne peut pas changer de vêtements et se nettoyer** (retrait conditionnel narratif — aucun Test possible). `LDB 46 l.63`
- **26-30 Feu de l'âme** : gain de l'**État Enflammé** (= En flammes, terme du LDB 46 pour En flammes). `LDB 46 l.64`
- **41-45 Poupée de chiffon** : projeté à 1d10 m, 1d10 Blessures ignorant PA, **État À Terre**. `LDB 46 l.68`
- **66-70 Régurgitation** : **État Sonné** qui dure **1d10 Rounds** (durée fixe, pas de Test de Résistance pour retrait anticipé). `LDB 46 l.74`
- **71-75 Secousse du Chaos** : toutes créatures dans un rayon de 1d100 m : Test d'**Athlétisme Accessible (+20)** ou **État À Terre** (effet de zone). `LDB 46 l.75`
- **81-85 Terrible affaiblissement** : 1 Point de Corruption + **État À Terre** + **État Exténué** simultanément. `LDB 46 l.78`
- **96-00 Contre-réaction aethyrique** : toutes créatures dans un rayon (Bonus FM) mètres : 1d10 Blessures ignorant BE et PA + **État À Terre** (zone entière). `LDB 46 l.80`

> 06-10 — « Regard maudit : vos yeux prennent une couleur anormale associée à votre Domaine pendant 1d10 heures. Tant que vos yeux gardent cette couleur, vous possédez 1 État Aveuglé qui ne peut être retiré d'aucune façon. » — `LDB 46 l.62`

> 66-70 — « Régurgitation : vous vomissez de façon incontrôlable bien plus de rejets nauséabonds que votre corps ne peut en contenir. Gagnez l'État Sonné, qui dure 1d10 Rounds. » — `LDB 46 l.74`

**LDB 40 (Colère des dieux) — cas complémentaires** :
- **01-05** : Test de **Résistance Accessible (+20)** sinon gain de **1 État Sonné**. `LDB 40 l.56`
- **16-20** : **État À Terre** qui ne peut être retiré qu'en réussissant un Test de **Prière Accessible (+20)** (retrait conditionnel liturgique). `LDB 40 l.59`
- **36-40** : Test de **Résistance Accessible (+20)** sinon gain de **1 État Sonné**. `LDB 40 l.63`
- **41-45** : les **cibles** (pas le lanceur) gagnent l'**État À Terre** et ne peuvent plus être soignées par la divinité pendant 1d10 + Péchés jours. `LDB 40 l.64`
- **51-55** : Test de **Résistance Intermédiaire (+0)** sinon **1 État Sonné**. `LDB 40 l.68`
- **61-65** : gain de **1 + (Points de Péché) États Hémorragique** (cumul variable selon la piété). `LDB 40 l.71`
- **66-70** : **État À Terre** + **1 + (Points de Péché) États Aveuglé**, ces États Aveuglé **ne peuvent être retirés que par un Test de Prière Intermédiaire (+0)** (1 + DR États retirés). `LDB 40 l.72`
- **71-75** : Test de **Résistance Complexe (-10)** sinon **1 État Sonné**. `LDB 40 l.73`
- **81-87** : « Effectuez aussi un Test de Résistance Difficile (-20). Sur un échec, vous gagnez 1 État Sonné. Si vous échouez avec -4 DR ou moins, gagnez 1 État Inconscient qui dure un minimum de 1d10 Rounds. » `LDB 40 l.75` — retrait par Détermination : « Si vous dépensez un Point de Détermination pour vous débarrasser d'un État *Inconscient*, mais que vous êtes toujours sujet aux causes de cette inconscience, vous gagnez un nouvel État *Inconscient* à la fin du Round. » `LDB 16 l.117`
- **89-95** : gain de **1 + (Points de Péché) États Brisé** (cumul variable selon la piété). `LDB 40 l.77`
- **101-105** : PB réduits à 0 + **État Inconscient** qui ne peut être retiré **qu'après récupération d'au moins 1 PB** (déjà documenté). `LDB 40 l.79`
- **126-130** : PB réduits à 0 + gain de l'**État Enflammé** (= En flammes). `LDB 40 l.84`
- **131-135** : gain de **1 + (Points de Péché) États Hémorragique chaque matin** jusqu'à accomplissement d'une Pénitence (durée indéfinie/permanente jusqu'à condition remplie). `LDB 40 l.85`

**Sources RAW** :
- `EDO App.2 l.129-137` — délire : durées en heures pour Inconscient, Exténué, Sonné
- `LDB 46 l.36` — Imparfaites Cérumen : Assourdi non retirable sans Guérison tierce
- `LDB 46 l.39-40` — Imparfaites Rupture (1d10 Hémorragique) + Secousse spirituelle (À Terre)
- `LDB 46 l.43-44` — Imparfaites Tenue indisciplinée : Enchevêtré/Empêtré Force 1d10×5
- `LDB 46 l.45` — Imparfaites Drain de l'âme : Exténué 1d10 heures
- `LDB 46 l.46` — Imparfaites Distraction : Surpris si Engagé
- `LDB 46 l.47-48` — Imparfaites Visions impies : Aveuglé + Test Calme
- `LDB 46 l.49` — Imparfaites L'horreur ! : Test Calme (-20) sinon Brisé
- `LDB 46 l.59` — Contrecoup Majeur Regard maudit : Aveuglé inamovible 1d10h
- `LDB 46 l.60` — Contrecoup Majeur Choc aethyrique : Sonné
- `LDB 46 l.63` — Contrecoup Majeur Rébellion intestinale : Exténué non retirable sans changement de vêtements
- `LDB 46 l.64` — Contrecoup Majeur Feu de l'âme : En flammes
- `LDB 46 l.68` — Contrecoup Majeur Poupée de chiffon : À Terre
- `LDB 46 l.74` — Contrecoup Majeur Régurgitation : Sonné 1d10 Rounds fixe
- `LDB 46 l.75` — Contrecoup Majeur Secousse du Chaos : À Terre zone
- `LDB 46 l.78` — Contrecoup Majeur Terrible affaiblissement : À Terre + Exténué
- `LDB 46 l.80` — Contrecoup Majeur Contre-réaction : À Terre zone (rayon BFM)
- `LDB 40 l.56, l.63, l.68, l.73` — Colère des dieux : États Sonné (tests Résistance variés)
- `LDB 40 l.59` — Colère des dieux 16-20 : À Terre non retirable sans Test Prière
- `LDB 40 l.64` — Colère des dieux 41-45 : cibles gains À Terre
- `LDB 40 l.71` — Colère des dieux 61-65 : 1+Péchés Hémorragique
- `LDB 40 l.72` — Colère des dieux 66-70 : À Terre + Aveuglé non retirables sans Prière
- `LDB 40 l.75` — Colère des dieux 81-87 : Sonné + « 1 État Inconscient qui dure un minimum de 1d10 Rounds »
- `LDB 40 l.77` — Colère des dieux 89-95 : 1+Péchés Brisé
- `LDB 40 l.84` — Colère des dieux 126-130 : En flammes
- `LDB 40 l.85` — Colère des dieux 131-135 : Hémorragique quotidien jusqu'à Pénitence

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 16` (l.117) → `etatNonCumulable`, `doc`, `jsonOpSchema`, `stopBleedOutcome`, `empileSurPionExistant`, `mouvementIntact`, `opRow`, `useAttackJetProps`, `toucheSauvee`, `ResolveWindow`, +35 — `src/data/etats.json`, `src/data/index.ts`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/etats.ts`, `src/data/schemas/defs/miscast.ts`, `src/engine/combat.ts`, +18 fichiers
- `LDB 40` (l.56, l.59, l.63, l.64, l.68, l.71, l.72, l.73, l.75, l.77, l.79, l.84, l.85) → `jsonOpSchema`, `NestedTest`, `SinPoints`, `applyTriggeredTestBranch`, `peche`, `wrath-table`, `liveTableDecl`, `GameOp`, `ALL_MAGIC`, `sinPointsSchema`, +39 — `src/data/characteristics.json`, `src/data/combat-stakes.json`, `src/data/miscast.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/miscast.ts`, `src/data/schemas/grammaire/valeurs.ts`, +9 fichiers
- `LDB 46` (l.36, l.39-40, l.43-44, l.45, l.46, l.47-48, l.49, l.59, l.60, l.62, l.63, l.64, l.68, l.74, l.75, l.78, l.80) → `miscast-mineure`, `mineure-signe-de-sorciere`, `mineure-lait-caille`, `mineure-mildiou`, `MiscastResult`, `mineure-cerumen`, `combat-spell-plus`, `mineure-lueur-occulte`, `mineure-murmures-mortels`, `mineure-rupture`, +63 — `src/data/combat-stakes.json`, `src/data/miscast.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs-scenes/effets.ts`, `src/engine/magic.ts`, +7 fichiers

---

### États verrouillés par Blessures Critiques

Les tableaux de Blessures Critiques (LDB 18) génèrent des États dont le **retrait est conditionnel** à un soin spécifique — comportement atypique par rapport aux règles générales du ch. 16 :

- **En plein front** (46-50 Tête) : État Aveuglé qui ne peut pas être retiré tant que tous les États Hémorragique n'ont pas été éliminés.
- **Blessure majeure à l'œil** (56-60 Tête) : **État Aveuglé** qui ne peut être soigné **que lorsqu'on applique Aide Médicale** (retrait conditionnel médical, pas par Test propre). `LDB 18 l.70`
- **Commotion cérébrale** (76-80 Tête) : **État Exténué** qui dure **1d10 jours** (durée calendaire — non pas en Rounds ni en heures). Si une autre Blessure critique à la tête est reçue pendant cet État Exténué : Test de Résistance Accessible (+20) ou État Inconscient. `LDB 18 l.74-75`
- **Épaule luxée** (76-80 Bras) : **État Sonné** qui persiste **jusqu'à Aide Médicale** (non retirable par Test de Résistance standard) ; après Aide Médicale : bras utilisable mais nécessite Test étendu de Guérison Accessible (+20) DR 6 pour récupérer l'usage complet. `LDB 18 l.120`
- **Cage thoracique perforée** (91-93 Torse) : État Sonné qui ne peut être retiré que par Aide Médicale.
- **Clavicule cassée** (94-96 Torse) : État Inconscient jusqu'à Aide Médicale.
- **Hémorragie interne** (97-99 Torse) : État Hémorragique qui ne peut être retiré que par Chirurgie.

> « Gagnez 1 État Sonné qui ne peut être retiré que par Aide Médicale » (91–93 Cage thoracique perforée, Torse) — `LDB 18 l.150`

> « Gagnez 1 État Hémorragique qui ne peut être retiré que par Chirurgie » (97–99 Hémorragie interne, Torse) — `LDB 18 l.152`

> « Gagnez également 1'État Exténué qui va durer 1d10 jours » (76-80 Commotion cérébrale, Tête) — `LDB 18 l.74`

**Note** : la liste ci-dessus est illustrative (cas à retrait le plus inhabituels), pas exhaustive — les tableaux complets LDB 18 génèrent de nombreux États standards.

**Sources RAW** :
- `LDB 18 l.68` — En plein front : Aveuglé verrouillé sur Hémorragique
- `LDB 18 l.70` — Blessure majeure à l'œil : Aveuglé non retirable sans Aide Médicale
- `LDB 18 l.74` — Commotion cérébrale : Exténué 1d10 jours (calendaire)
- `LDB 18 l.120` — Épaule luxée : Sonné jusqu'à Aide Médicale
- `LDB 18 l.150` — Cage thoracique perforée : Sonné non retirable sans Aide Médicale
- `LDB 18 l.151` — Clavicule cassée : Inconscient jusqu'à Aide Médicale
- `LDB 18 l.152` — Hémorragie interne : Hémorragique non retirable sans Chirurgie

**Voir aussi** : Traumatisme (`traumatisme.md`), section Blessures Critiques
**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 18` (l.68, l.70, l.74-75, l.120, l.150, l.151, l.152) → `criticals-ldb-tete`, `CritEntry`, `blessure-spectaculaire`, `HealMode`, `actBlockReason`, `MedicState`, `availableHealModes`, `critEscalationSchema`, `coupure-mineure`, `bestHealerFor`, +92 — `src/data/combat-stakes.json`, `src/data/criticals.json`, `src/data/criticals.ts`, `src/data/flow-stakes.json`, `src/data/regles.json`, `src/data/schemas/defs/criticals.ts`, +13 fichiers

---

## Hémorragique — variante Aux Armes

*Section optionnelle (système alternatif de blessures, AA p. 80). Remplace LDB 18 si le MJ l'adopte.*

Le chapitre « Une Approche Alternative des Blessures » d'**Aux Armes** (AA) propose une **mise à jour de l'État Hémorragique** visant à réduire la complexité du système de base :

**Différence clé par rapport au LDB 16** : dans la version LDB, tomber à 0 PB avec Hémorragique entraîne une **chute Inconsciente immédiate**. Dans la variante AA, à la place, à la fin de chaque Round à 0 PB :
> « Vous devez réussir un Test de **Résistance Intermédiaire (+0)** sous peine de subir immédiatement l'État _Inconscient_. » — `AA 7 l.5`

Cette version ajoute donc un Test de Résistance comme étape intermédiaire avant l'inconscience, laissant une chance de survie Round par Round.

Les autres règles Hémorragique (dégâts périodiques 1 PB/pion, jet de mort 10%/pion si Inconscient + Hémorragique, coagulation sur double, impossibilité de reprendre conscience, transition Exténué après dernier pion) restent **identiques** à LDB 16.

**Différence dans le retrait** : la difficulté du Test de Guérison passe de Intermédiaire (+0) dans le LDB à **Accessible (+20)** dans la variante AA.

> « On peut retirer un État _Hémorragique_ avec un Test de **Guérison Accessible (+20)** réussi, où chaque DR retire un État _Hémorragique_ supplémentaire. » — `AA 7 l.9`

**Sources RAW** :
- `AA 7 l.5-11` — variante complète Hémorragique : test Résistance avant inconscience, Test Guérison (+20)

**Voir aussi** : Hémorragique (section principale ci-dessus), Traumatisme
**Implémente :** _(généré — `npm run raw:implemente`)_
- `AA 7` (l.5-11) → `healDifficulty`, `aaBleedUnconsciousDue`, `aaBleedUnconsciousApply`, `collectHeroRoundEndUpkeep`, `tickDeath`, `createCombatSlice` — `src/data/combat-stakes.json`, `src/data/reglesOptionnelles.json`, `src/engine/conditions.ts`, `src/engine/healing.ts`, `src/state/combat/roundHooks.ts`, `src/state/combatSlice.ts`

---

## Coups Critiques alternatifs et États (AA)

*Système optionnel complet (AA p. 80-82). Si utilisé, remplace LDB 18.*

La variante AA introduit un mécanisme de Coups Critiques déclenché **sur double** (sans nécessiter 0 PB) :
- Double sur le jet d'attaque **ET** succès → Blessure Critique possible même avec des PB restants.
- Localisation : relance 1d100 au lieu d'inverser les chiffres du jet d'attaque.
- Les tableaux de BC d'AA sont distincts de ceux du LDB 18 (ex. résultats 01-03 « blessure spectaculaire » = T blessures + État Hémorragique + cicatrice future, jusqu'à 00+ = mort).

Ces tableaux utilisent tous les États standards (Hémorragique, Sonné, Aveuglé, Assourdi, À Terre, Inconscient, Exténué, Empêtré) selon des combinaisons différentes.

**Sources RAW** :
- `AA 7 l.27-29` — mécanisme de BC sur double
- `AA 7 l.82-182` — tableaux BC par localisation (Tête, Bras, Torse, Jambe) avec États associés

**Voir aussi** : Traumatisme (`traumatisme.md`)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `AA 7` (l.27-29, l.82-182) → `StructureCritEntry`, `critEscalationSchema`, `pendantRounds`, `CritEscalation`, `amputationSchema`, `attackHandGate`, `retenir-ses-coups`, `Formula`, `MODAL_DEFS`, `aaCriticalOffset`, +108 — `src/data/criticals.json`, `src/data/criticals.ts`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/criticals.ts`, `src/data/schemas/grammaire/valeurs.ts`, +16 fichiers

---

## Sorts et miracles infligeant des États (hors LDB 16)

Les listes de sorts et miracles (LDB 47-51, 40-43) infligent des États en cours de partie. Ce n'est pas une modification des règles d'États, mais une source de déclenchement. Points notables :

- **Atout Assommante** (LDB 62 l.233-235) : sur touche à la Tête, Test opposé Force/Résistance — succès de l'attaquant → gain d'un État Sonné par la cible. Armes concernées : bâton de combat, marteau de guerre, marteau à bec-de-corbin, masse, matraque, bille de plomb (fronde).
- **Sort Enchevêtrement** (LDB 47) : inflige État Empêtré à la cible. La variante Force Mentale au lieu de Force pour s'en dépêtrer est introduite dans un sort de ZI (Forêt d'épines, voir ci-dessous).
- **Forêt d'épines** (ZI 14 l.1008, sort chamanique Gobelin) : traverser la zone nécessite un Test d'**Agilité Difficile (-20)** ; en cas d'échec, la victime gagne **1 État Empêtré** (Force Mentale à la place de Force pour résister) **et 1 État Hémorragique** simultanément.
- **Filets** (ZI 2 l.165, 176, groupe d'armes à Entraves) : sur touche réussie, cible gagne 1 État Empêtré. Pour se libérer : Test de **Force Intermédiaire (+0)** avec un nombre de DR **égal à l'Indice du filet** (les DR ne sont pas cumulatifs) ; en cas d'échec, gagne 1 État Empêtré supplémentaire. Filets barbelés (ZI 2 l.178) : infligent automatiquement des Dégâts ignorant l'armure à chaque tentative d'évasion (réussie ou non).
- **Chant de la Sirène** (ZI 13 l.25) : Test de **Force Mentale Complexe (-10)** ou la cible est séduite et compte comme ayant l'État Inconscient sans l'être mécaniquement (elle se rapproche de la source du chant). Si préparé (oreilles bouchées) : test devient Facile (+40). Si victime attaquée : nouveau Test immédiat.
- **Trait Instable** (LDB 85) : les créatures Instables perdent des PB si elles ne parviennent pas à atteindre des points Avantage minimum — indirectement source d'États (via 0 PB → À Terre/Inconscient).
- **Objets magiques** (ADE II 4 l.222, l.230, l.367) : arme Embrasée inflige État En flammes sur touche à une cible inflammable ; arme « Déroutante » inflige État Surpris à toute cible blessée ; armure argentée scintillante force un Test d'Agilité Accessible (+20) en début de Round ou État Aveuglé pour les adversaires en corps à corps.

**Sources RAW** :
- `LDB 62 l.233-235` — Atout Assommante → État Sonné
- `ZI 14 l.1008` — Forêt d'épines : Empêtré FM + Hémorragique simultané
- `ZI 13 l.25` — Chant de la Sirène : pseudo-Inconscient narratif
- `ZI 2 l.165, 176, 178` — Filets : Empêtré avec DR non cumulatifs (≠ LDB Test de Force opposé)
- `ADE II 4 l.222, l.230, l.367` — objets magiques : sources d'État En flammes / Surpris / Aveuglé

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 62` (l.233-235) → `a-enroulement`, `a-poudre-noire`, `a-repetition`, `assommante`, `au-contact-roll`, `defensive`, `au-contact-choice`, `arbalete`, `devastatrice`, `arc`, +38 — `src/data/combat-stakes.json`, `src/data/etats.json`, `src/data/flow-stakes.json`, `src/data/qualities.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, +8 fichiers
- `ADE II 4` (l.222) → `deroutante` — `src/data/qualities.json`
- `ZI 2` (l.165, l.178) → `filet`, `filet-barbele`, `GameOp`, `ConditionInstance`, `OpFields`, `brise-krag`, `nuee-de-squigs-des-cavernes`, `gobelin-de-la-nuit`, `dragon-de-la-foret` — `src/data/creatures.json`, `src/data/qualities.json`, `src/data/trappings.json`, `src/engine/ops.ts`, `src/engine/types.ts`, `src/ui/editor/GameOpEditor.tsx`
- `ZI 13` (l.25) → `wyrm-des-mers` — `src/data/creatures.json`
- `ZI 14` (l.1008) → `fouissement` — `src/data/traits.json`

---

## Termes non officiels : « État Assommé » et « État Fatigué »

### « État Assommé »

Le Zoo Impérial (ZI) utilise à plusieurs reprises le terme « **État Assommé** » dans la description de traits/attaques de créatures (`ZI 4 l.122`, `ZI 5 l.142`, `ZI 13 l.199`, `ZI 14 l.1157, 1182`). Ce terme **n'existe pas** dans la liste officielle des 12 États du LDB 16.

Interprétation probable : traduction alternative de l'anglais *Stunned* = **Sonné** (État officiel). À traiter comme Sonné si ce trait est importé dans le jeu. Ne pas créer d'état « Assommé » distinct.

Le même terme apparaît dans ADE II (sort ogre du Domaine de la Gueule, `ADE II 2 l.770`) dans le même sens.

### « État Fatigué »

Nuits agitées & dures journées utilise une fois le terme **État Fatigué**, pour les personnages endormis qui tentent de « se réveiller en sursaut avec un État *Fatigué* » (`NADJ 05 l.117`). Ce terme **n'existe pas** dans la liste officielle des 12 États.

Interprétation probable : traduction alternative de **Exténué** (État officiel). À traiter comme Exténué. Le contexte textuel (personnage pas reposé, réveil brutal) est cohérent avec Exténué.

> « Les Personnages endormis peuvent tenter un Test de _Perception Très Difficile (-30)_ pour se réveiller en sursaut avec un État _Fatigué_. » — `NADJ 05 l.117`

---

## Bilan de fidélité

Points vérifiés contre le source `.md` :
- Règle de cumul des pénalités (même État additif, États différents = max) : conforme `LDB 16 l.11-13`.
- Les 3 non-cumulables (À Terre, Inconscient, Surpris) : conformes.
- Formule En Flammes (+1/État supplémentaire, min 1) : conforme `l.77` et `endOfRound l.241-244`.
- Hémorragique : jet de mort 10%/pion + coagulation sur double : conforme `l.105` et `bleedDeathRoll`.
- Sonné : Test Résistance Intermédiaire (+0), puis Exténué si plus aucun : conforme `l.125-127`.
- Poison : dégâts **puis** Test de Résistance (maintenant via hook hors `endOfRound` pour les héros) : conforme architecture cadence-aware.

Points identifiés :
1. **Assourdi** : bonus +10 par le flanc/derrière — l'orientation des combattants n'est pas suivie (`conditions.ts l.163`).
2. **Sonné** : +1 Avantage pour l'attaquant — non trouvé dans `conditions.ts`/`meleeAttackerBonus` ; à vérifier dans `combatFlow.ts`.
3. **Brisé** : contrainte comportementale (fuir, se cacher) — gérée par l'IA ennemie/décision joueur, non bloquée mécaniquement par le moteur.
4. **Durées en heures** (EDO App.2, LDB 46 Imparfaites, LDB 18 Commotion) : États à durée horaire/calendaire et retraits conditionnels atypiques (Aveuglé inamovible, Exténué 1d10h, Exténué 1d10 jours) — à auditer dans `magic.ts`/`miscast.ts`/`upkeep.ts`.
5. **États verrouillés sur Blessures Critiques** (LDB 18) : verrouillage conditionnel (Aveuglé sur Hémorragique, Aveuglé/Sonné/Inconscient sur Aide Médicale, Hémorragique sur Chirurgie) — non génériques dans `conditions.ts`.
6. **Atout Assommante** → Sonné : à vérifier dans `combat.ts` (chercher `assommante` ou `stunningQuality`).
7. **Empêtré Force variable** (LDB 46 Imparfaites Tenue indisciplinée, 1d10×5) : Force de source aléatoire — non modélisée.
8. **Retraits conditionnels narratifs** (Colère des dieux 66-70 Aveuglé/Prière, 131-135 Hémorragique quotidien/Pénitence ; LDB 46 Rébellion intestinale) : conditions de retrait non mécanique — à gérer via effets scène/campagne ou `lockedUntil`.

**Couverture complète des livres autorisés :**
- ADE I VF : armes naines avec États En flammes / Empoisonné (Annexe II, `ADE I 8 l.60, l.78, l.80`) — sources d'infliction, pas de règle générale nouvelle.
- ADE II VF : objets magiques infligeant États (arme Déroutante = Surpris, arme enflammée = En flammes, armure éblouissante = Aveuglé, Canon à flammes nain = 2+DR En flammes) — documentés ci-dessus ; terme non officiel « Assommé » dans sort ogre.
- EDO : États avec durées en heures dans le Délire (App.2) — documentés ci-dessus.
- EDOC : aucune règle d'État (véhicules, sans extension aux États).
- Middenheim : Spectre → Sonné par DR (trait créature) — pas de règle d'État générale.
- Nuits agitées & dures journées : terme non officiel « Fatigué » (= Exténué) — documenté ci-dessus.
- Aldorf la Couronne de l'Empire : aucune règle d'État.
- Aventures à Ubersreik : aucune règle d'État.
- Mort sur le Reik Compagnon : traits créatures infligeant États — pas de règle générale nouvelle.
- Le Pouvoir Derrière le Trône : hypnotisme → Sonné sur sortie de transe (cas isolé).
- AA : variante Hémorragique + tableau BC alternatif — documentés ci-dessus.
- ZI : terme non officiel « Assommé » (= Sonné), Empêtré FM + Hémorragique (Forêt d'épines), Toile traître (Empêtré + Empoisonné), filets (Empêtré DR non cumulatifs) — documentés ci-dessus.
