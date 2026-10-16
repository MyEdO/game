# Cohérence du système d'événements de combat — doctrine & état

> Référence vivante : doctrine de frontière donnée/machinerie (§3/§3bis, socle du dispatcher unique
> `fireTriggers`) + état actuel du bus d'événements de combat (`emitCombatEvent`). Boussole :
> data-driven (GameOp/Trigger) · zéro doublon/legacy/dette · respect du RAW.

## 3. Doctrine de frontière (anti-dette) — donnée vs machinerie

Le test qui tranche, **insensible à la paresse** :

> « Un designer pourrait-il vouloir une version DIFFÉRENTE de ça, attachée à un monstre/objet/sort/État
> précis, éditable au Codex ? » — **OUI → donnée** (obligatoire ; si pénible, on **étend le
> vocabulaire**, jamais on ne recule vers le code). **NON, même règle universelle pour tous →
> machinerie.**

**Engagement** : « difficile à exprimer » n'est JAMAIS une raison de mettre en machinerie.

L'axe correct n'est **pas** « est-ce dans la table LDB ? » mais « est-ce un état/effet POSSÉDÉ par une
entité, qui suit ses propres règles ? ». `etats.json` = foyer de **tout** état de combattant (LDB **ou**
interne moteur). Presque tout se **dédouble** : `(donnée = le flag/effet possédé)` + `(machinerie =
l'algorithme générique qui le lit)`.

**Restent machinerie légitime** (ne nomment aucune entité, itèrent génériquement) : décrément des
durées, `refresh-wounds`, `tick-death` (règle de mort), `clear-psych-of-dead`, `purge-summons`,
ré-ordonnancement d'initiative, surnombre (la règle ; les exemptions sont des traits = donnée),
`suffocation-tick` (règle environnementale universelle, gatée par le drapeau d'effet éditable
`suffocates`/`noBreath`).

**Garde-fou (cliquet)** : `src/state/combat-hardcode-guard.test.ts` scanne `src/engine`+`src/state` et
échoue si une branche réactive nomme un État/trait/talent/atout précis (`hasCondition('sonne')`,
`traitId==='infecte'`…) au-delà d'une baseline gelée PAR FICHIER ; toute baisse de baseline doit être
resserrée (patron cliquet de `no-emoji-affordance.test.ts`). La dette devient un test qui rougit, pas un
jugement.

## 3bis. FAIT — Le **dispatcher unique** (orchestrateur · machinerie · data-driven)

> C'est **le socle** réclamé : « peu importe le KIND (maladie, talent, trait, sort, état, mutation…), un
> Trigger doit fonctionner sans code spécifique à chacun. »

Trois rôles, séparés nettement :

| Rôle | Qui | Responsabilité |
|---|---|---|
| **Orchestrateur** | les points d'émission (`emitCombatEvent` + sites `fireTriggers` de cycle) | *QUAND* un événement canonique se produit |
| **Dispatcher unique** | **`fireTriggers(get, actor, trigger, ctx)`** | *À QUI* : réunit TOUTES les sources d'effets du combattant et joue celles qui matchent — **sans brancher par kind** |
| **Machinerie** | les hooks (`registerCombatHook`, `order`) | Règles universelles de l'arène qui ne nomment AUCUNE entité |

**Le dispatcher (`fireTriggers`) réunit toutes les sources** : `effectsOf` (Traits + Talents +
Atouts d'arme) **ET** `fireConditionEffects` (États, avec leurs pions). Conséquence : un **État**
authoré avec `effects:[{trigger:'onHit'|'onKill'|'onTurnStart'|'onWoundLoss'|'onRoundStart'|…}]` réagit
**partout** où le trigger est émis, **exactement comme un Trait** — plus aucun câblage par-trigger à se
rappeler. **Maladies/Mutations** réagissent par **composition** (elles octroient un Trait/État, déjà
couvert). Ajouter une source = l'ajouter **dans `fireTriggers`**, jamais un nouveau chemin de dispatch.

**Le bus** : `emitCombatEvent(event, ctx)` (`src/state/combatEvents.ts`) — à chaque moment canonique,
(a) joue les abonnés MACHINERIE (registre `combatHooks`, ordonnés par `order`) PUIS (b) diffuse
l'événement aux TRIGGERS DE DONNÉES de `ctx.audience` via `fireTriggers`. Les deux journalisent via le
même `sink`.

**Attaques gratuites — kind-agnostique.** `resolveFreeAttacks` itère `freeAttackSourcesOf` (Talents +
Traits + Atouts + États, chacun tagué `key`/`cap`) et ne joue que les Flows à `grantFreeAttack`
(`flowHasFreeAttack`) — les autres effets de ces triggers passent par le dispatcher générique. Un
**Trait/État** de créature qui riposte `onCharged`/`onHit` fonctionne comme un talent, sans chemin
spécifique.

**FAIT (#316) — le bus est l'UNIQUE porte.** Tous les sites de dispatch DIRECT de production ont migré
vers `emitCombatEvent` (`onHit`/`onCrit`/`onWoundLoss`/`onSlain`/`onKill`/`onStartled`/`onGainCondition` ;
`onRoundEnd`/`onTurnStart` au site MÉTIER). Les boucles internes `fireTriggers` par combattant des
événements de CYCLE (`combat/roundHooks.ts`, `combat/turnHooks.ts`) sont la MACHINERIE DU BUS : elles
restent des hooks ordonnés (interleave par `order`, y compris le cross-phase `onRoundStart`-depuis-un-hook-
`onRoundEnd`) et sont whitelistées « bus-owned ». Verrous :
- **Quarantaine d'import** (`combat-event-port-guard.test.ts`) : `fireTriggers`/`runCombatHooks`
  importables UNIQUEMENT par `combatEvents.ts`, les deux définisseurs et les modules bus-owned — le
  dispatch direct est INEXPRIMABLE (fail-closed, preuve par fichier fictif).
- **Complétude d'émission** (`combat-event-emission-coverage.test.ts`) : chaque `EffectTrigger` du schéma
  d'authoring (dérivé d'`effectTriggerSchema`, dont le `satisfies Record<EffectTrigger, string>` tient l'exhaustivité au compilateur) a ≥1 point d'émission — zéro
  affordance morte.

Triggers CÂBLÉS par #316 (jadis orphelins) : `onAttackResolved` (fin de résolution d'attaque),
`onCastResolved` (post-`runCastFlow`/`applyCast`), `onMiscast` (`applyMiscast`), `onCharged` (site de
charge — les effets NON-attaque-gratuite ; les Flows `grantFreeAttack` restent inertes via la voie pure →
pas de double frappe, la Frappe réactive part de `resolveFreeAttacks`). **7bis** : un Coup Critique OPPOSÉ
(LDB 14 l.7) / dévié (`applyOpposedCritical`, `resolveDeviation` mode `self`) émet désormais `onCrit` via le
bus, avec l'arme RÉELLE de l'attaquant (`DeviationCtx.weaponObj`) → les Atouts « sur Critique » (Taillade →
Hémorragique) s'appliquent aussi sur ces Critiques. `applyOpposedCritical` reste MACHINERIE (ne nomme
aucune entité, §3) — elle ÉMET l'événement, elle n'est pas convertie en hook (un hook de phase ne porte pas
le contexte d'attaque riche — roll/arme/attaquant — qu'exige la résolution du Critique opposé).

**Reste à faire pour « un seul bus » complet** : #315 (exécuteur unique — `runPureFlowLines` à
supprimer + garde de double-exécution).

## 4. BUG concret relevé (exemple) — « punching-ball à 0 PB » + intégrité hors-combat

> **À CORRIGER PLUS TARD.** Sert d'illustration de l'incohérence : l'état « à terre / mourant /
> hors-combat » est éclaté, et l'IA lit un demi-état.

### 4a. Confirmé : acharnement sur un héros à 0 PB pendant plusieurs rounds
Modèle de mort (RAW LDB 18, `engine/conditions.ts`) :
- 0 PB → À Terre, **conscient**, `isOutOfAction` FAUX.
- Passage Inconscient seulement quand `roundsAtZero > BE`, compteur avancé **1×/round** dans `tickDeath`,
  dans les deux modes de `combat-aa-blessures` (#1595 c.6219559935) ; jamais pour un objet inanimé (`isInanimate`).
- Mort finalisée seulement si **Inconscient + 0 PB + `criticalWounds > BE`** (`inDeathCondition`),
  vérifiée au franchissement de round (`resolveRoundBoundary`, `state/combatFlow.ts`).

Côté IA (`state/ai.ts`, `state/combatFlow.ts`) :
- Le filtre `heroes` (plusieurs sites de `combatFlow.ts`) n'exclut que `!isOutOfAction` → un héros à
  0 PB **conscient y reste** une cible valide.
- L'IA cible par **menace composite** (`targetThreat`, `state/ai.ts` : atteignabilité × fragilité ×
  danger — PAS un tri simple par PB). La fragilité (`1 + (PBmax−PBcourant)/PBmax`) double le score
  d'un héros déjà entamé, ce qui le remet en tête de cible **sans mécanisme de répartition explicite**
  entre ennemis.

⇒ Un héros tombé à 0 reste conscient ~**BE rounds** (3-4), focalisé par **tous** les ennemis, chacun
incrémentant `target.criticalWounds` (`state/combatFlow.ts`), **sans mourir** tant que la porte
(Inconscient ET `crit > BE`) n'est pas franchie. = « 3 IA, 3 rounds, enchaînement de critiques, on se
demande s'il va mourir un jour ».

**Correctifs visés** : politique de ciblage IA (ne pas focaliser une cible à 0 PB / À Terre ; répartir) ;
prédicat unique « neutralisé » lu par l'IA.

### 4b. Suspecté (non clos par lecture statique) : « X est hors combat » puis ils continuent
- La ligne de journal `cf.outOfAction` n'est émise que si `isOutOfAction(target)` est vrai (plusieurs
  sites de `state/combatFlow.ts`).
- Un héros à Destin : `finalizeHeroDeath` pose `pendingFateSave` et **suspend** sans tuer.
- Or Inconscient ⇒ `isOutOfAction` ⇒ devrait être filtré du ciblage. **S'ils continuent**, un invariant
  casse (gate IA vs `pendingFateSave` vs désync d'objet combattant).
- **À pin par repro déterministe** (`__wfrp.scenario`/`fight` seedé + `__wfrp.battle()`/`log()` round par
  round) avant tout correctif — ne pas deviner la ligne.

## 5. Liens
- Voir aussi : `docs/systeme-passifs.md`, `docs/ajouter-une-mecanique.md`.
