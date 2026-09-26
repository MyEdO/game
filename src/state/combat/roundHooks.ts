/**
 * Hooks de FRANCHISSEMENT DE ROUND (`roundBoundary`) enregistrés sur la couture `combatHooks`. Module
 * FEUILLE chargé par effet de bord depuis combatFlow (comme restFlow/travelFlow peuplent cascadeAppliers) :
 * la séquence de fin de Round vit ICI, chaque effet
 * étant un hook ordonné par `order` (l'ordre RAW est encodé par les valeurs). Les helpers sont appelés
 * dans les closures `run()` (au RUNTIME, quand `runCombatHooks` se déclenche) → pas de souci de cycle à
 * l'import. Le golden `roundBoundary.golden.test.ts` fige l'ordre + les tirages RNG byte-pour-byte.
 */
import { registerCombatHook } from '../combatHooks';
import { registerCascadeApplier } from '../cascade';
import { freeCons, rollSansPilote, surfaceOf, monoStep, choiceStep, pushMono, pousseSi, type BuiltCascadeStep } from '../rollSeam';
import { battleRng } from '../battleRng';
import { rollTest } from '../../engine/tests';
import { testValue } from '../../engine/skills';
import { bonus, effectiveChar, refreshWounds } from '../../engine/characteristics';
import { addCondition, isOutOfAction, COND, tickDeath, bleedDeathRoll, stacks, endOfRound, hasCondition, pendingPlusExtensions, resolvePlusExtension } from '../../engine/conditions';
import { suffocationTick } from '../../engine/suffocation';
import { tickTraumaEscalation } from '../../engine/trauma';
import { clearPsychOf, refreshAllDefendedPsych } from '../../engine/psychology';
import { zonesRoundTick } from '../zones';
import { purgeExpiredSummons } from '../summonFlow';
import { fireTriggers } from '../triggeredEffects';
import { collectRoundEndTestSteps } from './triggeredTest';
import { inBattleId } from '../combatants';
import { traitAuras } from '../../engine/traits/dispatch';
import { groupMatch } from '../../engine/groups';
import { outnumberCountBonus } from '../../engine/combatFeatures/dispatch';
import { combatDistance } from '../footprint';
import { sceneMetresPerTile } from '../scene';
import { rule } from '../../engine/policy';
import { rollWindsOfMagic, hasSecondeVue } from '../../engine/windsOfMagic';
import { groupAdvantage } from '../../engine/advantagePool';
import { combatStakeRef } from '../../data';
import { t } from '../../i18n';
import type { Combatant, ActiveEffect } from '../../engine/types';
import type { CascadeStep } from '../pendings';
import type { Get, Set as SetFn } from '../flowTypes';
import { dataLabel } from '../../data';
import { stepProlonger } from '../rollSeam';

// ============================================================================================
// Séquence RAW de franchissement de Round, migrée ISO-COMPORTEMENT depuis advanceTurn (corps copiés
// tel quel, `ctx.sink` remplaçant la `tickLine` locale, `ctx.get` le `get`). Les `order` reflètent la
// position d'origine → ordre + RNG préservés (golden byte-pour-byte).
// ============================================================================================

registerCombatHook({
  id: 'end-of-round', // frontière de Round — RNG. endOfRound : rejeu des ops RÉCURRENTES portées par les
  // effets actifs, puis décrément des durées (effets, États de sort, contrecoups). Ce que les ÉTATS font
  // en fin de Round (dégâts d'Empoisonné/En Flammes/Hémorragique, Test du Sonné, auto-dissipation
  // d'Aveuglé/Assourdi/Surpris) vit en DONNÉE (`etats.json`, effects: onRoundEnd) et passe par le
  // DISPATCHER UNIQUE ci-dessous, pas par `endOfRound`.
  phase: 'onRoundEnd',
  order: 10,
  run: ({ get, set, battle, sink }) => {
    for (const c of battle.combatants) {
      endOfRound(c, battleRng()).forEach((l) => sink(l, c)); // machinerie : ops récurrentes + décrément des durées
      // Dispatch UNIQUE des effets `onRoundEnd` (États : dégâts/dissipation ; Traits/Talents : réactions) —
      // fireTriggers réunit toutes les sources, aucun chemin par-kind. Inerte sans donnée. Pas de réaction
      // de fin de Round pour un combattant HORS COMBAT (un cadavre ne brûle/saigne plus — le dispatcher
      // autorise désormais les effets `on:'self'` sur une cible hors-combat, on filtre donc ici).
      // Le porteur hors d'action est SAUTÉ ici comme dans `openRoundEndCascade` (prédicat MIROIR) —
      // ÉCART AU RAW suivi par #1265 (Test d'entretien de fin de Round : LDB 16 l.68-78).
      // `deferInteractiveTest` : un Test de RÉCUPÉRATION d'État en DONNÉES (Empoisonné Résistance…) routé
      // pour un porteur SURFACÉ (`surfaceOf` : un siège humain QUELCONQUE le tient, cadence manuelle) n'est
      // PAS poussé ici (la cascade de fin de Round n'est pas encore ouverte) — il est COLLECTÉ par
      // `collectHeroRoundEndUpkeep`. Ce que personne ne tient (IA, cadence auto) : résolu inline par le dispatcher.
      if (!isOutOfAction(c)) fireTriggers(get, c, 'onRoundEnd', { rng: battleRng(), set, deferInteractiveTest: true }).forEach((l) => sink(l, c));
      // Durée « + » (LDB 47 l.311) : effets GELÉS par `tickDurations` (spell source marqué). PNJ/auto —
      // arbitrage d'implémentation : l'IA prolonge SYSTÉMATIQUEMENT ses propres buffs (elle tente le Test
      // de Force Mentale à chaque offre) — résolu INLINE ici. Porteur SURFACÉ (`surfaceOf` : un siège humain
      // QUELCONQUE le tient, cadence manuelle) : différé en étape de cascade influençable (Chance/
      // Résilience), collectée par `collectHeroRoundEndUpkeep` — MIROIR strict de son prédicat.
      if (!surfaceOf(get, c.id)) {
        for (const e of pendingPlusExtensions(c)) {
          const res = rollSansPilote(get, c, testValue(c, undefined, 'force-mentale'), 'intermediaire', battleRng());
          resolvePlusExtension(c, e, res.success).forEach((l) => sink(l, c));
        }
      }
    }
  },
});
// Résistance à l'Empoisonné (`LDB 16 l.70-72`) : effet `onRoundEnd` à nœud `test` en DONNÉES
// (`etats.json` — retire 1+DR pions sur succès, puis Exténué quand vidé), résolu par le DISPATCHER
// UNIQUE : ennemi/auto inline, héros manuel → étape de cascade collectée ci-dessous ; hors combat,
// inline générique (`outOfCombatUpkeep`).
registerCombatHook({
  id: 'refresh-wounds', // dissipation d'un buff F/E/FM → recale les Blessures (LDB 85)
  phase: 'onRoundEnd',
  order: 20,
  run: ({ battle }) => { for (const c of battle.combatants) refreshWounds(c); },
});
registerCombatHook({
  // Vents Tourbillonnants (LDB 46 l.179-190, #491) : « à chaque Round dans des zones de turbulences
  // magiques » — re-tirage 1d10 + re-détection Seconde vue, grain `round` UNIQUEMENT (grain `scene`,
  // défaut, ne retire qu'à l'ouverture du combat, `windsOfMagicAtCombatStart`). Inerte sinon (aucun
  // RNG consommé → golden préservé).
  id: 'winds-of-magic-round',
  phase: 'onRoundEnd',
  order: 21,
  run: ({ battle, sink }) => {
    if (rule('vents-tourbillonnants') !== 'round') return;
    const { roll, mod } = rollWindsOfMagic(battleRng());
    let revealed = false;
    for (const c of battle.combatants) {
      if (c.kind !== 'hero' || isOutOfAction(c) || !hasSecondeVue(c)) continue;
      const res = rollTest(testValue(c, 'perception'), 'facile', battleRng());
      if (res.success) { revealed = true; sink(t('cs.windsOfMagicSeen', { name: c.label }), c); }
    }
    battle.windsOfMagic = { roll, mod, revealed };
  },
});
registerCombatHook({
  id: 'fire-round-start-triggers', // effets « début de Round » authorés (Régénération…) — dispatcher générique (RNG)
  phase: 'onRoundEnd',
  order: 25,
  run: ({ get, set, battle, sink }) => {
    for (const c of battle.combatants) {
      if (isOutOfAction(c)) continue; // pas de réaction « début de Round » pour un hors-combat (le dispatcher
      for (const line of fireTriggers(get, c, 'onRoundStart', { rng: battleRng(), set })) sink(line, c); // autorise on:'self' sur un hors-combat → filtré ici)
    }
  },
});
// Instable (LDB 85 l.199) MIGRÉ en DONNÉES : trait `instable` effects onRoundEnd — `if engagedAdvantageGap
// > 0` → wounds {engagedAdvantageGap} (perd la différence d'Avantage) puis `if woundsCurrent<=0` → banish
// {narration:'unravel'} (« se délite »). La valeur relationnelle est calculée par le dispatcher, sans hook dédié.
// Bestial (LDB 85 l.59) « peur du feu → gagne Brisé » MIGRÉ en données : trait `bestial` effects
// onRoundEnd (if En Flammes ∧ pas déjà Brisé → condition Brisé), dispatché par le dispatcher unique.
registerCombatHook({
  // Auras de combat — machinerie GÉOMÉTRIQUE GÉNÉRIQUE : projette les `passive` de toute `TraitData.aura`
  // (Perturbant : −20 aux Tests à BE mètres, LDB 85 l.260-262) sur les combattants à portée, accumulés dans
  // `auraMods` (lus par `combatTestPenaltyParts` — pool non-cumul, LDB 16 l.13 — et par `skillDRBonus`/
  // `charDRBonusOf`, qui les SOMMENT). Aucun trait nommé en dur ; recalcul/Round.
  id: 'recompute-auras',
  phase: 'onRoundEnd',
  order: 50,
  run: ({ get, battle }) => {
    // Portée HEIGHT/Z-AWARE (#805) : `combatDistance` (footprint.ts) mesure en cases le max(horizontal,
    // vertical converti via `verticalTiles`/`pos.h`) — même patron que le mono-cible (combatFlow). Une
    // aura d'un étage n'atteint plus l'ennemi directement au-dessus/dessous (case vide entre les niveaux).
    const mpt = sceneMetresPerTile(get().scene);
    for (const c of battle.combatants) c.auraMods = undefined; // recalcul intégral chaque Round
    for (const src of battle.combatants) {
      if (isOutOfAction(src) || !src.pos) continue;
      for (const { traitId, aura } of traitAuras(src.traits)) {
        const rangeM = aura.rangeChar ? bonus(effectiveChar(src, aura.rangeChar)) : (aura.rangeMeters ?? 0);
        // Le TRAIT émetteur voyage avec chaque op projetée (`PassiveMod.src`) : la pénalité arrive
        // chez la cible avec son nom et son renvoi Codex, jamais en modificateur anonyme.
        const projected = aura.passive.map((op) => ({ op, src: { category: 'traits', id: traitId } }));
        for (const c of battle.combatants) {
          if (isOutOfAction(c) || !c.pos) continue;
          // L'émetteur ne se touche que si sa DONNÉE le dit (`includesSelf`) — défaut : jamais.
          if (c.id === src.id && !aura.includesSelf) continue;
          const sameCamp = c.kind === src.kind;
          // `affects` absent ou `all` = aucun filtre de camp (Perturbant, LDB 85 l.262 : « Toute personne »).
          if (aura.affects === 'enemies' && sameCamp) continue;
          if (aura.affects === 'allies' && !sameCamp) continue;
          // Filtre d'APPARTENANCE (`affectsGroups`, ids de `groups.json`) : union — la cible doit être
          // d'au moins un des Groupes listés. Absent = aucun filtre de Groupe.
          if (aura.affectsGroups && !aura.affectsGroups.some((g) => groupMatch(g, c.groups ?? []))) continue;
          if (combatDistance(src, c, mpt) * mpt <= rangeM) c.auraMods = [...(c.auraMods ?? []), ...projected];
        }
      }
    }
  },
});
registerCombatHook({
  id: 'outnumbered', // LDB 14 l.110
  phase: 'onRoundEnd',
  order: 55,
  run: ({ battle, sink }) => {
    if (groupAdvantage()) return; // AA 11 l.44
    for (const c of battle.combatants) {
      if (isOutOfAction(c) || (c.advantage ?? 0) <= 0) continue;
      const foes = (c.engagedWith ?? []).filter((id) => {
        const e = inBattleId(battle, id);
        return !!e && e.kind !== c.kind && !isOutOfAction(e);
      }).length;
      // LDB 10 l.765
      if (foes >= 2 + outnumberCountBonus(c)) { c.advantage = Math.max(0, c.advantage - 1); sink(t('turn.outnumbered', { name: c.label, foes }), c); }
    }
  },
});
// Mâchoires d'acier (LDB 10) : un effet
// DÉCLENCHÉ `onGainCondition` data-driven (talents.json) — « chaque fois que vous gagnez un État Sonné »,
// résolu cadence-aware par la brique `combat/triggeredTest` (héros manuel → cascade influençable ;
// ennemi/auto → jet inline).

// Détermination (LDB 17 l.59/60) MIGRÉE sur le système de Durée UNIFIÉ : l'immunité psychologique (2
// Rounds) et l'ignorance des modifs de Critique (1 Round) sont portées par des `ActiveEffect`
// (`psychImmune`/`ignoreCritMods`) à `duration` Rounds, décrémentés/expirés par `tickDurations` (hook
// `end-of-round`) — plus de compteur/flag round-scopé ni de hook de décompte dédié.

// Récupération du Brisé (LDB 16 l.54-58 ; Cœur vaillant LDB 10) MIGRÉE en DONNÉES (etats.json `brise.effects`,
// 2 effets `onRoundEnd`) : (A) « caché hors de vue de tout ennemi » → retire 1 Brisé SANS Test (Condition
// `hiddenFromFoes`) ; (B) Test de Calme gaté « pas Engagé OU Cœur vaillant, ET pions restants », difficulté par
// circonstances (`difficultyBy` : caché → Accessible, ennemi à ≤3 → Très difficile), succès retire 1 + DR, vidé
// → Exténué (l.80). Dispatché par le DISPATCHER UNIQUE (hook `end-of-round`) : ennemi/auto inline, héros manuel
// → étape de cascade collectée par `collectRoundEndTestSteps`. La géométrie d'arène est calculée par
// `recoveryGeometry` (triggeredEffects).

/** Aux Armes (AA 07 l.5) : un combattant à 0 PB porteur de l'État Hémorragique (et pas déjà Inconscient / hors
 *  d'action) doit tester sa Résistance chaque Round sous peine de tomber Inconscient. Prédicat PARTAGÉ par le
 *  hook (ENNEMIS/auto) et le collecteur de cascade (HÉROS). `isOutOfAction` exclut déjà mort/Inconscient/
 *  figurant en Mort Subite. PUR. */
function aaBleedUnconsciousDue(c: Combatant): boolean {
  return !isOutOfAction(c) && c.wounds.current <= 0 && stacks(c, COND.hemorragique) > 0;
}
/** Conséquence du Test de Résistance AA « perte de sang » (AA 07 l.5) : échec → Inconscient ; succès → tient bon.
 *  Partagée par le hook (ENNEMIS/auto) et l'applier de cascade (HÉROS). Renvoie la ligne d'échec, ou `null`. */
function aaBleedUnconsciousApply(c: Combatant, success: boolean): string | null {
  if (success) return null; // reste conscient (À Terre)
  addCondition(c, COND.inconscient);
  return t('cond.aaBleedUnconscious', { name: c.label });
}

// --- Migration ISO-COMPORTEMENT des derniers blocs du franchissement de Round (corps copiés tel quel,
//     `ctx.sink` remplace `tickLine`). Pas de hook suspensif (aucun pending). ---
registerCombatHook({
  id: 'tick-death', // 0 PB → Inconscient après BE Rounds (LDB 18 l.15) — désactivé en mode AA (cf. tickDeath)
  phase: 'onRoundEnd',
  order: 76,
  run: ({ battle, sink }) => { for (const c of battle.combatants) tickDeath(c).forEach((l) => sink(l, c)); },
});
registerCombatHook({
  // Aux Armes (AA 07 l.5) : dans le système ALTERNATIF de Blessures, on ne tombe PAS Inconscient d'office à
  // 0 PB (le décompte LDB de `tick-death` est neutralisé) — c'est l'État Hémorragique qui l'impose : « à
  // la fin de chaque Tour [modélisé au franchissement de Round, comme tout l'entretien de mort], vous devez
  // réussir un Test de Résistance Intermédiaire (+0) sous peine de subir immédiatement l'État Inconscient ».
  // RÈGLE DE MORT/machinerie (comme `tick-death`/`bleed-death`) gatée par le mode ; NOMME Hémorragique tout
  // comme `bleed-death`. Résolu AVANT `bleed-death` (77) : un combattant qui tombe Inconscient ICI devient
  // éligible au jet de mort par hémorragie le même Round. Porteur SURFACÉ → différé à la cascade d'entretien
  // (collectHeroRoundEndUpkeep) pour rester influençable (Chance/Résilience) ; personne au pilotage / auto → jet inline.
  id: 'aa-bleed-unconscious',
  phase: 'onRoundEnd',
  order: 76.5,
  run: ({ get, battle, sink }) => {
    if (rule('combat-aa-blessures') !== 'aa') return; // inerte en LDB (aucun RNG consommé → golden préservé)
    for (const c of battle.combatants) {
      if (!aaBleedUnconsciousDue(c) || surfaceOf(get, c.id)) continue; // porteur surfacé → étape de cascade (MIROIR du collecteur)
      const res = rollSansPilote(get, c, testValue(c, 'resistance'), 'intermediaire', battleRng());
      const line = aaBleedUnconsciousApply(c, res.success);
      if (line) sink(line, c);
    }
  },
});
registerCombatHook({
  // Mort par Hémorragique (LDB 16 l.105) : à la fin du Round, 10 %/pion de mourir (jet d100 ≤ 10×pions) ;
  // un double = coagulation (retire 1 pion + Exténué si vidé). RÈGLE DE MORT (comme `tick-death`) : RNG,
  // jouée UNE fois. La coagulation s'applique + se journalise ICI ; la MORT est DIFFÉRÉE (marquée dans
  // `battle.bleedDoomed`) car `resolveRoundBoundary` doit pouvoir SUSPENDRE pour le Destin d'un héros
  // (LDB 17) — on n'annonce donc pas la mort avant la décision de Destin.
  id: 'bleed-death',
  phase: 'onRoundEnd',
  order: 77,
  run: ({ battle, sink }) => {
    // Aux Armes (l.2451) : le jet de mort par hémorragie (10 %/pion) exige d'être à la fois Inconscient ET
    // Hémorragique. LDB (l.105, hook d'origine) : jet pour tout bleeder encore actif (isOutOfAction exclut
    // déjà l'Inconscient). La coagulation sur un double (retire 1 pion, +Exténué si vidé) est identique aux
    // deux systèmes → même `bleedDeathRoll`, seul le prédicat d'éligibilité diffère selon le mode.
    const aa = rule('combat-aa-blessures') === 'aa';
    const doomed: { id: string; deathLine: string }[] = [];
    for (const c of battle.combatants) {
      if (c.dead || c.outOfRencontre || !stacks(c, COND.hemorragique)) continue;
      if (aa ? !hasCondition(c, COND.inconscient) : isOutOfAction(c)) continue;
      const bd = bleedDeathRoll(c, battleRng());
      if (bd.died) doomed.push({ id: c.id, deathLine: bd.log[0] }); // annonce différée (après le jet de Destin)
      else bd.log.forEach((l) => sink(l, c)); // coagulation (double) : retrait + éventuel Exténué, visible de suite
    }
    battle.bleedDoomed = doomed.length ? doomed : undefined;
  },
});
registerCombatHook({
  // « Main ouverte » (AA 07 l.127 / LDB « Main ouverte ») : MACHINERIE UNIVERSELLE — toute séquelle portant
  // une escalade périodique DÉCLARÉE (`perRound`) encore `awaitingMedicalAid` s'aggrave d'une unité à chaque
  // fin de Round. Ne nomme aucune entité éditable ; comme `tick-death`, c'est une règle de l'arène. Inerte
  // (aucune ligne ni RNG) tant qu'aucun combattant ne porte le marqueur → franchissement de Round iso-comportement.
  id: 'finger-loss-escalation',
  phase: 'onRoundEnd',
  order: 76.7,
  run: ({ battle, sink }) => { for (const c of battle.combatants) tickTraumaEscalation(c, battleRng()).forEach((l) => sink(l, c)); },
});
registerCombatHook({
  // Noyade et Suffocation (LDB 18 l.345-346) : MACHINERIE environnementale UNIVERSELLE — la règle de mort
  // par manque d'air s'applique à TOUT combattant portant le drapeau d'effet `suffocates` (posé par les
  // sorts d'étouffement / l'environnement — la DONNÉE éditable), `noBreath` immunise. Ne NOMME aucune
  // entité éditable (trait/talent/État) ; comme `tick-death`/`tick-durations`, c'est une règle de l'arène.
  id: 'suffocation-tick',
  phase: 'onRoundEnd',
  order: 78,
  run: ({ battle, sink }) => { for (const c of battle.combatants) suffocationTick(c).forEach((l) => sink(l, c)); },
});
registerCombatHook({
  id: 'zones-round-tick', // zones perRound (Grands feux d'U'Zhul, LDB 47 : « au début d'un Round »)
  phase: 'onRoundEnd',
  order: 79,
  run: ({ battle, sink }) => { zonesRoundTick(battle.zones, battle.combatants, battleRng()).forEach((t) => sink(t.line, t.combatant)); },
});
registerCombatHook({
  id: 'clear-psych-of-dead', // effets psy d'une créature morte → fin (catch-all toutes causes de mort)
  phase: 'onRoundEnd',
  order: 79.3,
  run: ({ battle }) => {
    for (const c of battle.combatants) if (isOutOfAction(c)) clearPsychOf(battle.combatants, c.id);
    refreshAllDefendedPsych(battle.combatants); // l’Amour suit le GROUPE aimé, pas un individu (LDB 21 l.75)
  },
});
registerCombatHook({
  id: 'purge-expired-summons', // invocations à durée écoulée OU lanceur tombé ; round = battle.round+1 (set après le dispatch)
  phase: 'onRoundEnd',
  order: 79.5,
  run: ({ battle, sink }) => { purgeExpiredSummons(battle, battle.round + 1).forEach((l) => sink(l)); },
});
/** Règle optionnelle « Se fatiguer » (LDB 16 l.97). Inerte tant que `combat-se-fatiguer` est inactive
 *  (aucun tirage RNG consommé → franchissement de Round iso-comportement). */
/** Seuil de « se-fatiguer » : Bonus d'Endurance Rounds d'effort cumulés (min 1) avant un Test (LDB 16 l.97). */
function fatigueThreshold(c: Combatant): number {
  return Math.max(1, bonus(effectiveChar(c, 'endurance')));
}
/** Conséquence d'un Test de Résistance « se-fatiguer » (LDB 16 l.97) — partagée par le hook (ENNEMIS)
 *  et l'applier (HÉROS). */
function fatigueApply(c: Combatant, success: boolean, sl: number): string | null {
  if (success) {
    c.effortRounds = Math.max(0, (c.effortRounds ?? 0) - Math.max(0, sl));
    return null;
  }
  addCondition(c, COND.extenue);
  c.effortRounds = 0;
  return t('turn.exhausted', { name: c.label });
}
registerCombatHook({
  id: 'se-fatiguer',
  phase: 'onRoundEnd',
  order: 80, // après tous les effets de Round RAW, avant la révélation héros
  enabledIf: 'combat-se-fatiguer',
  run: ({ get, battle, sink }) => {
    for (const c of battle.combatants) {
      if (isOutOfAction(c)) continue;
      // L'incrément du compteur d'effort est DÉTERMINISTE (RNG-free) : il a lieu pour TOUT le monde,
      // héros compris (le collecteur de cascade lit `effortRounds` ≥ seuil pour émettre l'étape).
      c.effortRounds = (c.effortRounds ?? 0) + 1;
      if (c.effortRounds < fatigueThreshold(c)) continue;
      // Porteur SURFACÉ au seuil : différé à la cascade influençable (MIROIR du collecteur). Sinon (monstre/rapide/auto) : silence ici.
      if (surfaceOf(get, c.id)) continue;
      const t = rollSansPilote(get, c, testValue(c, 'resistance'), 'intermediaire', battleRng());
      const line = fatigueApply(c, t.success, t.sl);
      if (line) sink(line, c);
    }
  },
});

// ============================================================================================
// JETS D'UPKEEP de fin de Round concernant un HÉROS → étapes de CASCADE influençable (Chance/
// Résilience), fusionnées dans la cascade de fin de Round (cf. combatFlow `openRoundEndCascade`).
// Les ENNEMIS restent résolus en silence dans les hooks ci-dessus (IA, en masse). Le JET d'une étape
// est kind-agnostique (`FLOWS.cascade` → Test +0 sur `step.target`) ; l'APPLIER ci-dessous interprète
// `step.result` par `kind`. Modules feuilles : RIEN n'importe combatFlow (pas de cycle).
// ============================================================================================

/**
 * Tests d'upkeep de fin de Round DUS pour le héros `c` ce Round, en ÉTAPES de cascade (jumeau des
 * collecteurs de Psychologie). Ordre : Empoisonné → récupération du Brisé → se-fatiguer (du plus
 * mécanique au plus optionnel). Side-effect ASSUMÉ (comme `endFrenzyIfDone` côté psy) : le
 * retrait « caché » du Brisé et l'Exténué SANS-Test sont appliqués ICI (RNG-free, déterministes via
 * `sink`) ; seuls les Tests réellement dus deviennent des étapes influençables.
 *
 * Étapes MINTÉES par la porte (#1262) : `monoStep`/`choiceStep` posent la possession (`actorId`), la
 * surface (`interactive`) et la ligne (`rollStep`). Les deux Tests montés ici passent par le canal
 * HORS combat (`testValue`), comme leurs jumeaux inline (hooks `aa-bleed-unconscious` et
 * `se-fatiguer`) : les pénalités que le canal `combat` ajouterait visent les Tests de combat qui
 * engagent la perception (`LDB 16 l.45`), ce qu'un Test de Résistance d'entretien n'est pas.
 */
export function collectHeroRoundEndUpkeep(get: Get, c: Combatant, _sink: (line: string, c: Combatant) => void): BuiltCascadeStep[] {
  // Étapes de cascade SEULEMENT pour un porteur SURFACÉ (`surfaceOf` : un siège humain QUELCONQUE le tient,
  // cadence manuelle) ; en rapide/auto, ou sans siège pour le tenir, il est auto-résolu COMME un monstre →
  // ses Tests se résolvent silencieusement dans les hooks ci-dessus, qui portent le prédicat MIROIR.
  if (!surfaceOf(get, c.id) || isOutOfAction(c)) return [];
  const steps: BuiltCascadeStep[] = [];
  // 0) Récupération d'États en DONNÉES (Empoisonné Résistance LDB 16 l.70-72 ; plus tard En Flammes/Sonné) —
  //    chaque État porté dont la donnée déclare un `effects: onRoundEnd` à nœud `test` devient une étape
  //    `triggeredTest` INFLUENÇABLE, bâtie depuis la MÊME donnée que la voie inline (ennemi/auto) et hors-combat
  //    (`simpleTriggeredTestStep`). Les DÉGÂTS périodiques ont DÉJÀ été appliqués par le dispatcher (hook
  //    `end-of-round`) ; seul le TEST passe en cascade. En TÊTE (physiologique).
  steps.push(...collectRoundEndTestSteps(get, c));
  // 0bis) Perte de sang AA (AA 07 l.5) : en mode Aux Armes, à 0 PB avec l'État Hémorragique, Test de Résistance
  //    Intermédiaire chaque Round ou Inconscience — étape INFLUENÇABLE (le hook `aa-bleed-unconscious` saute
  //    le héros manuel). Le résolveur générique de cascade tire le Test sur `target` ; l'applier applique.
  if (rule('combat-aa-blessures') === 'aa' && aaBleedUnconsciousDue(c)) {
    const step = monoStep({
      id: `aaBleed-${c.id}`, kind: 'aaBleedUnconscious', icon: 'condition/bleeding', label: t('step.perteDeSang'),
      actor: c, ligne: { test: { skill: 'resistance' } }, difficulty: 'intermediaire',
      stake: combatStakeRef('aaBleedUnconscious'),
    });
    pousseSi(steps, step);
  }
  // (Mâchoires d'acier n'est PLUS un Test de fin de Round : c'est un effet `onGainCondition` data-driven,
  //  déclenché à l'acquisition du Sonné — cf. talents.json + brique `combat/triggeredTest`.)
  // (Récupération du Brisé : MIGRÉE en DONNÉES — son retrait « caché » + Exténué SANS-Test sont appliqués
  //  par le hook `end-of-round` (effet A), et son Test de Calme arrive ci-dessus via collectConditionRecoverySteps.)
  // 3) Se-fatiguer (règle optionnelle) — l'incrément du compteur a déjà eu lieu dans le hook ; ici on
  //    n'émet l'étape que si le seuil est atteint (Test de Résistance différé).
  if (rule('combat-se-fatiguer') && (c.effortRounds ?? 0) >= fatigueThreshold(c)) {
    const step = monoStep({
      id: `fatigue-${c.id}`, kind: 'fatigue', icon: 'condition/fatigued', label: t('step.effortSoutenu'),
      actor: c, ligne: { test: { skill: 'resistance' } }, difficulty: 'intermediaire',
      stake: combatStakeRef('fatigue'),
    });
    pousseSi(steps, step);
  }
  // 4) Durée « + » (LDB 47 l.311) : effets GELÉS (spell source marqué) — « vous POUVEZ effectuer un Test
  //    de Force Mentale pour prolonger » = décision OPT-IN, étape de CHOIX (Oui/Renoncer) ; sur Oui,
  //    l'applier `spellPlusChoice` pousse le Test dans la MÊME cascade (`spellPlusTest`). En QUEUE (le
  //    plus optionnel), comme le reste des effets `optional` ci-dessus.
  for (const e of pendingPlusExtensions(c)) {
    const spellId = e.spell?.spellId ?? e.sourceSpellId;
    if (!spellId) continue; // pas de sort source identifiable — jamais atteint (spellDurationPlusSource l'exige déjà)
    const choix = choiceStep({
      id: `spellPlusChoice-${c.id}-${spellId}`, kind: 'spellPlusChoice', actorId: c.id,
      icon: 'ui/think', label: stepProlonger(dataLabel(e.label), true),
      options: [{ key: 'yes', label: t('opt.tenterProlonger', { quoi: e.label }) }, { key: 'no', label: t('opt.renoncer') }],
      defaultChoice: 'no',
      meta: { sourceSpellId: spellId },
    });
    pousseSi(steps, choix);
  }
  return steps;
}

/** Applique la conséquence d'une étape d'upkeep (mute le héros, renvoie les lignes de journal). Mirroir
 *  du refresh d'état de `combatPsych` (le collecteur ne possède pas `set`, l'applier oui). */
function syncCombatant(get: Get, set: SetFn): void {
  set({ party: [...get().party] });
  if (get().battle) set({ battle: { ...get().battle!, combatants: [...get().battle!.combatants] } });
}

// (La Résistance à l'Empoisonné passe par l'applier GÉNÉRIQUE : son étape est de kind `triggeredTest`,
//  résolue par l'applier `triggeredTest` de la brique cadence-aware — la branche `success`/`fail` de la donnée
//  (retire 1+DR, puis Exténué si vidé) y est rejouée.)

// (La récupération du Brisé passe par l'applier GÉNÉRIQUE : son étape est de kind `triggeredTest`,
//  résolue par l'applier `triggeredTest` de la brique cadence-aware — la branche `success`/`fail` de la donnée
//  (retire 1+DR, puis Exténué si vidé) y est rejouée.)

registerCascadeApplier('fatigue', (get, set, step, hero) => {
  if (!hero || !step.result) return;
  const line = fatigueApply(hero, step.result.success, step.result.sl);
  syncCombatant(get, set);
  return { consequences: freeCons([line ?? t('turn.effortHeld', { name: hero.label })]) };
});
registerCascadeApplier('aaBleedUnconscious', (get, set, step, hero) => {
  if (!hero || !step.result) return;
  const line = aaBleedUnconsciousApply(hero, step.result.success);
  syncCombatant(get, set);
  return { consequences: freeCons([line ?? t('cond.aaBleedHold', { name: hero.label })]) };
});

/** Retrouve l'effet GELÉ (`awaitingExtension`) visé par une étape « Durée + », par son id STABLE
 *  (`sourceSpellId`/`spell.spellId`, #142 — jamais le `label`, affichage). */
function findAwaitingExtension(hero: Combatant, step: CascadeStep): ActiveEffect | undefined {
  const spellId = typeof step.meta?.sourceSpellId === 'string' ? step.meta.sourceSpellId : undefined;
  if (!spellId) return undefined;
  return pendingPlusExtensions(hero).find((e) => (e.spell?.spellId ?? e.sourceSpellId) === spellId);
}

/** Étape de CHOIX « Durée + » (LDB 47 l.311, #543) — « vous POUVEZ effectuer un Test de Force Mentale » :
 *  sur Oui, pousse le Test dans la MÊME cascade (`spellPlusTest`, réappendu = `liveMerge`) ; sur Renoncer
 *  (défaut), l'effet expire NORMALEMENT (`resolvePlusExtension(…, false)` — mêmes réversions que
 *  `removeActiveEffects`). L'effet est retrouvé par son id STABLE (`sourceSpellId`, #142) parmi les
 *  effets GELÉS (`awaitingExtension`) du héros — jamais de closure sur l'`ActiveEffect` (coop). */
registerCascadeApplier('spellPlusChoice', (get, set, step, hero) => {
  if (!hero) return;
  const effect = findAwaitingExtension(hero, step);
  if (!effect) return;
  const spellId = effect.spell?.spellId ?? effect.sourceSpellId;
  if (step.chosen === 'yes') {
    // Ligne montée par le MONTEUR CANONIQUE, canal HORS combat (`testValue`) comme son jumeau inline
    // (hook `end-of-round`) : les pénalités que le canal `combat` ajouterait visent les Tests de combat
    // qui engagent la perception (`LDB 16 l.45`), ce qu'un Test de Force Mentale de prolongation n'est
    // pas. Difficulté : aucune n'est indiquée (LDB 47 l.311) → Intermédiaire.
    pushMono(set, {
      id: `spellPlusTest-${hero.id}-${spellId}`, kind: 'spellPlusTest',
      actor: hero, ligne: { test: { char: 'force-mentale' } }, difficulty: 'intermediaire',
      icon: 'nav/dice', label: stepProlonger(dataLabel(effect.label)),
      meta: { sourceSpellId: spellId }, stake: combatStakeRef('spellPlusTest', { entryId: spellId }),
    });
    return;
  }
  const lines = resolvePlusExtension(hero, effect, false);
  syncCombatant(get, set);
  return { consequences: freeCons(lines) };
});

/** Étape-JET « Durée + » (LDB 47 l.311, #543) — Test de Force Mentale poussé par `spellPlusChoice` sur
 *  « Oui » : succès → +1 Round (dégelé) ; échec → expiration NORMALE. Fonction PARTAGÉE avec la
 *  résolution PNJ inline (hook `end-of-round`) — `resolvePlusExtension`. */
registerCascadeApplier('spellPlusTest', (get, set, step, hero) => {
  if (!hero || !step.result) return;
  const effect = findAwaitingExtension(hero, step);
  if (!effect) return;
  const lines = resolvePlusExtension(hero, effect, step.result.success);
  syncCombatant(get, set);
  return { consequences: freeCons(lines) };
});
