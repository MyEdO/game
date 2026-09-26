/**
 * Hooks de DÉBUT DE TOUR ENNEMI (`turnStart`) enregistrés sur la couture `combatHooks`. Module FEUILLE
 * chargé par effet de bord depuis combatFlow (comme roundHooks/restFlow peuplent leurs registres) : la
 * séquence de début de tour de l'IA vit ICI, chaque étape étant un hook ordonné par `order`. N'importe RIEN de combatFlow → pas de cycle (les
 * fonctions déplacées ne dépendent que des modules feuilles `engine/*`, `combatLog`, `combatGeometry`,
 * `lineOfSight`, `battleRng`, `cascade`, `rollSeam` — ce dernier porte la PORTE d'ouverture de jet
 * (`surfaceOf`, `pushMono`, `choiceStep`, #1262). combatFlow ré-exporte ces fonctions (baril) pour les tests existants.
 *
 * DÉPENDANCE D'ORDRE RAW (commentée à l'origine dans `runEnemyAI`, encodée ici par `order`) : fin de
 * Frénésie (10) → Rage (20) → tentative de Frénésie IA (30) AVANT la psychologie (40) — la Frénésie
 * rend immunisé au test psy, donc elle doit être résolue d'abord. Le golden `turnStart.golden.test.ts`
 * fige l'ordre + les tirages RNG byte-pour-byte.
 *
 * Ces hooks ne tournent que pour l'ENNEMI actif (`runEnemyAI` est enemy-only) ; les fonctions ont en
 * plus leurs propres gardes `kind`/capacité internes (no-op pour un héros), comportement conservé.
 */
import { registerCombatHook } from '../combatHooks';
import { registerCascadeApplier } from '../cascade';
import { freeCons, rollSansPilote, surfaceOf, choiceStep, pushMono } from '../rollSeam';
import { battleRng } from '../battleRng';
import { ev, evLines } from '../combatLog';
import { effectiveChar } from '../../engine/characteristics';
import { isOutOfAction, addCondition, combatTestPenalty } from '../../engine/conditions';
import { rawCombatTestBase } from '../../engine/skills';
import { traceLineOf, testTraceLabel } from '../../engine/traceLine';
import { CHAR_LABELS, CATEGORY_BY_SOURCE_KIND } from '../../engine/types';
import { inBattleId, garanti } from '../combatants';
import { reconcileAdvantageToPool, creditOpposingAdvantage, campSpend } from './advantagePool';
import { mountMovement, riderFearSize } from '../mount';
import { losClear } from '../lineOfSight';
import { smokeOf } from '../combatGeometry';
import { groupMatch } from '../../engine/groups';
import {
  fearSourceFor, sansPeurVs, resolvePeurTest, resolveTerreurTest, calmeValue, isFrenzyCapable, isFrenzied, isPsychImmune,
  resolveFrenzyEntry, targetedTrigger, resolveCalmeSimple, suppressSupersededPsych, estCibleType, psychResolution,
} from '../../engine/psychology';
import { psychologyLabel, combatStakeRef } from '../../data';
import { isColdBlooded, hasRage } from '../../engine/traits/dispatch';
import { fireTriggers, hasFoeInLoS } from '../triggeredEffects';
import { aiDriven } from '../combatGate';
import { t } from '../../i18n';
import type { Combatant } from '../../engine/types';
import type { Get, Set as SetFn } from '../flowTypes';

/** Effets « début de tour » authorés du combattant qui DEVIENT actif (`onTurnStart`) — point unique
 *  appelé par `advanceTurn` (tour suivant du Round) ET `confirmRoundStart` (1ᵉʳ combattant du Round),
 *  pour ne pas dupliquer le déclenchement. Inerte tant qu'aucune donnée ne porte un effet `onTurnStart`.
 *  Journalisé en `detail` (kind agnostique — l'IA comme le héros). No-op si hors d'action. */
export function fireTurnStartTriggers(get: Get, set: SetFn, c: Combatant | undefined): void {
  fireTurnEdgeTriggers(get, set, c, 'onTurnStart');
  // Mode « Avantage de groupe » : un octroi d'Avantage par OP au début du tour (Redoutable, ZI : complète
  // jusqu'à l'Indice — op `gainAdvantage`) écrit sur la projection ; on relève la réserve du camp (adverse
  // pour une créature) en conséquence. No-op hors mode groupe.
  if (c) reconcileAdvantageToPool(get, c);
}

/** Effets « fin de tour » authorés du combattant qui CESSE d'être actif (`onTurnEnd`) — appelé par
 *  `advanceTurn` au passage au combattant suivant. Même canal/garde que `onTurnStart`. */
export function fireTurnEndTriggers(get: Get, set: SetFn, c: Combatant | undefined): void {
  fireTurnEdgeTriggers(get, set, c, 'onTurnEnd');
}

/** Point UNIQUE de déclenchement des effets de bord de tour (début/fin) — kind agnostique, journalisé
 *  en `detail`, no-op hors d'action. Inerte tant qu'aucune donnée ne porte l'effet correspondant.
 *  `onTurnStart` seul fournit `onOpposingAdvantage` (Redoutable AA, `MDG 16 l.13`) : l'op `gainAdvantage`
 *  du porteur y appelle `creditOpposingAdvantage`, self-gardée `groupAdvantage()`. */
function fireTurnEdgeTriggers(get: Get, set: SetFn, c: Combatant | undefined, trigger: 'onTurnStart' | 'onTurnEnd'): void {
  if (!c || isOutOfAction(c)) return;
  const battle = get().battle;
  if (!battle) return;
  const onOpposingAdvantage = trigger === 'onTurnStart' ? (n: number) => creditOpposingAdvantage(get, c, n) : undefined;
  for (const line of fireTriggers(get, c, trigger, { rng: battleRng(), set, onOpposingAdvantage })) battle.log.push(ev('detail', line, c.id));
}

// ============================================================================================
// GATE D'ACTION PAR ROUND (op `actGate` — Racine de mandragore, LDB 71 l.35 : « Les utilisateurs
// doivent réussir un Test de Force Mentale à chaque Round pour effectuer une Action ou un Mouvement
// (un au choix) »). Résolu au DÉBUT du tour du porteur, cadence-aware :
//  - porteur SURFACÉ (`surfaceOf` : un siège humain QUELCONQUE le tient, cadence manuelle) → étape de
//    cascade `actGate` INFLUENÇABLE ; sur un échec, l'applier INSÈRE une étape
//    de CHOIX `actGateChoice` (garder l'Action ou le Mouvement) dont l'issue est appliquée directement
//    sur la battle COURANTE (le tour vient de commencer) ;
//  - IA / cadence auto → jet inline ; échec = l'Action est GARDÉE (défaut rationnel), le Mouvement est
//    perdu — FOLDÉ par l'appelant (advanceTurn/confirmRoundStart) dans le budget du tour.
// ============================================================================================

export interface ActGateOutcome { loseMovement: boolean; lines: string[] }

/** Résout les gates d'action du combattant qui DEVIENT actif. UN Test par Caractéristique gatée et par
 *  Round (LDB 71). */
export function resolveActGates(get: Get, set: SetFn, c: Combatant): ActGateOutcome {
  const out: ActGateOutcome = { loseMovement: false, lines: [] };
  if (isOutOfAction(c) || !get().battle) return out;
  const gates = (c.activeEffects ?? []).filter((e) => e.actGate);
  const chars = [...new Set(gates.map((e) => e.actGate!.char))];
  for (const char of chars) {
    const gate = garanti(gates.find((e) => e.actGate!.char === char), char, 'gate d’action');
    const label = gate.label;
    if (surfaceOf(get, c.id)) {
      // ENJEU (#1117) : le gabarit dit la mécanique du gate ; le RENVOI descend à l'ENTITÉ qui l'exige
      // (`ActiveEffect.source`, estampillée génériquement par `applyOps`) — la Racine de mandragore
      // ouvre SA fiche d'objet, jamais une fiche de règle générique. La catégorie vient de la table
      // TOTALE `CATEGORY_BY_SOURCE_KIND` : aucun `if` par nature de source ici.
      const src = gate?.source;
      pushMono(set, {
        id: `actGate-${c.id}-${char}`, kind: 'actGate', icon: 'item/consumable', rollLabel: CHAR_LABELS[char],
        actor: c,
        ligne: { test: { char }, combat: { kind: 'test' } },
        difficulty: 'intermediaire',
        label: t('turn.actGate', { label }),
        stake: combatStakeRef('actGate', src ? { entryId: src.id, entryCategory: CATEGORY_BY_SOURCE_KIND[src.kind] } : {}),
      });
      continue;
    }
    const res = rollSansPilote(get, c, rawCombatTestBase(c, undefined, char), 'intermediaire', battleRng(), combatTestPenalty(c));
    out.lines.push(traceLineOf({ who: c.label, label: testTraceLabel(`${CHAR_LABELS[char]} (${label})`, 'intermediaire'), ...res }));
    if (!res.success) { out.loseMovement = true; out.lines.push(t('turn.actGateKeepAction', { name: c.label })); }
  }
  return out;
}

// Étape `actGate` (héros manuel) : succès → rien à restreindre ; échec → étape de CHOIX insérée.
registerCascadeApplier('actGate', (_get, _set, step, hero) => {
  if (!hero || !step.result) return;
  if (step.result.success) return { consequences: freeCons([t('turn.actGateOk', { name: hero.label })]) };
  const choix = choiceStep({
    id: `actGateChoice-${hero.id}`, kind: 'actGateChoice', actorId: hero.id, icon: 'item/consumable',
    label: t('turn.actGateChoice'),
    options: [
      { key: 'action', label: t('turn.actGateOptAction') },
      { key: 'move', label: t('turn.actGateOptMove') },
    ],
    defaultChoice: 'action',
  });
  return {
    consequences: freeCons([t('turn.actGateFail', { name: hero.label })]),
    ...(choix ? { insert: [choix] } : {}),
  };
});
// Étape `actGateChoice` : applique l'issue sur la battle COURANTE (le tour du héros vient de démarrer).
registerCascadeApplier('actGateChoice', (get, set, step, hero) => {
  if (!hero) return;
  const battle = get().battle;
  if (!battle || battle.order[battle.turn] !== hero.id) return; // plus son tour → sans objet
  if (step.chosen === 'move') {
    set({ battle: { ...battle, acted: true } });
    return { consequences: freeCons([t('op.loseAction', { name: hero.label })]) };
  }
  set({ battle: { ...battle, movementUsed: mountMovement(battle, hero) } });
  return { consequences: freeCons([t('op.loseMovement', { name: hero.label })]) };
});

// ============================================================================================
// Fonctions de cycle de tour ennemi, déplacées ISO-COMPORTEMENT depuis combatFlow (corps copiés tel
// quel). combatFlow les ré-exporte via le baril pour ses importeurs/tests (frenzy.test, frenzy-ia.test,
// psych-ia.test, psych-cible.test). Elles journalisent ELLES-MÊMES (kinds `frenzy`/`fear` via `ev`) —
// le `sink` du ctx n'est pas requis ici (contrairement à roundHooks).
// ============================================================================================

/** L'IA tente d'entrer en Frénésie au début de son tour (LDB 21 l.31) : combattant capable, pas déjà
 *  frénétique ni immunisé à la Psychologie, avec un adversaire vivant en Ligne de Vue → Test de Force
 *  Mentale ; sur un succès, il entre en Frénésie (état psy `frenesie` posé en `psychState`). La SORTIE est
 *  un effet déclenché `onTurnStart` en DONNÉES (`psychology.json`), jamais un hook `end-frenzy` par-nom. */
export function aiMaybeFrenzy(get: Get, set: SetFn, enemy: Combatant): void {
  if (!aiDriven(get(), enemy) || isFrenzied(enemy) || enemy.psychImmune || isOutOfAction(enemy) || !isFrenzyCapable(enemy)) return;
  if (!hasFoeInLoS(get, enemy)) return; // adversaire vivant en Ligne de Vue (primitive partagée, sens acteur→foe)
  // RAW : l'entrée en Frénésie est un CHOIX (psychologie.md l.170) → l'IA la DIFFÈRE tant que sa meilleure
  // action est de PRÉPARER un sort (buff/invocation/dégâts). L'Unicité les retire un à un ; quand il ne reste
  // que charger, la Frénésie passe au tour suivant. Peek déterministe, sans RNG (avant le test FM) → aucune
  // perturbation du flux `battleRng` quand on diffère, golden RNG préservé sinon.
  if (get().aiWouldCast(enemy.id)) return;
  if (resolveFrenzyEntry(effectiveChar(enemy, 'force-mentale'), battleRng()).success) {
    (enemy.psychState ??= []).push({ type: 'frenesie' });
    set({ battle: { ...get().battle!, log: [...get().battle!.log, ev('frenzy', t('turn.frenzyEnter', { name: enemy.label }), enemy.id)] } });
  }
}

/** Psychologie d'un ENNEMI (IA) au début de son tour (LDB 21) : teste Peur/Terreur des sources
 *  en Ligne de Vue. Terreur ratée → Brisé ; Peur → Test étendu de Calme (cumul). Instantané
 *  et JOURNALISÉ (pas de modale/révélation pour l'IA — le joueur voit l'État Brisé). */
export function resolvePsychAI(get: Get, set: SetFn, enemy: Combatant): void {
  if (!aiDriven(get(), enemy) || isOutOfAction(enemy)) return;
  const battle = get().battle;
  const scene = get().scene;
  if (!battle || !scene || !enemy.pos) return;
  // Belliqueux (LDB 85 l.51) : « Tant qu'elle a plus d'Avantages que son adversaire, elle gagne Immunité
  // Psychologique ». « Son adversaire » se lit à l'Engagement, jamais au camp : le lien Engagé est posé par
  // la résolution d'une attaque de mêlée et SYMÉTRIQUE (LDB 13 l.169-171) — un Engagé de son propre camp
  // est donc son adversaire de fait, comme pour la Peur de Taille (`agressifEnvers`).
  const engagedFoesAdv = (enemy.engagedWith ?? [])
    .map((id) => inBattleId(battle, id))
    .filter((e): e is Combatant => !!e && !isOutOfAction(e))
    .map((e) => e.advantage ?? 0);
  if (isPsychImmune(enemy, engagedFoesAdv.length ? Math.max(...engagedFoesAdv) : undefined)) return; // Immunité (Psychologie) / Frénésie / Détermination temp / Belliqueux
  enemy.psychState ??= [];
  const log: string[] = [];
  // Nouvelles sources de peur/terreur en Ligne de Vue (non encore rencontrées).
  for (const foe of battle.combatants) {
    if (foe.id === enemy.id || isOutOfAction(foe) || !foe.pos) continue; // « chez les autres créatures » (LDB 85 l.264-266) : seule exclusion, soi-même
    if (!losClear(scene, enemy.pos, foe.pos, smokeOf(battle))) continue;
    const src = fearSourceFor(enemy, foe, riderFearSize(battle, enemy)); // Cavalier émérite (AA 13 l.25) : Taille = monture face à la Peur de Taille
    if (!src || enemy.psychState.some((p) => p.sourceId === foe.id)) continue;
    const sansPeur = sansPeurVs(enemy, foe); // Sans Peur (Ennemi, LDB 10 l.1051) : Test de Calme +20 à la rencontre
    const res = psychResolution(src.kind);
    if (res.mode === 'terreur') {
      const r = resolveTerreurTest(calmeValue(enemy), src.indice, battleRng(), isColdBlooded(enemy.traits), sansPeur); // À sang-froid : inverse un raté (LDB 85)
      if (r.brise > 0 && res.failCondition) {
        addCondition(enemy, res.failCondition, r.brise);
        log.push(t('turn.terrified', { name: enemy.label, foe: foe.label, brise: r.brise }));
      }
      // Terreur → Peur : `devientPeur` porte DÉJÀ la seule exemption ÉCRITE (Sans Peur réussi → 0, le
      // Talent ignore « Intimidation, Peur ou Terreur » de l'ennemi désigné). Le résultat du Test de
      // Terreur, lui, ne change RIEN à l'Indice hérité (LDB 21 l.56, inconditionnel — #1190).
      if (res.becomes) enemy.psychState.push({ type: res.becomes, sourceId: foe.id, indice: r.devientPeur, calmeDR: 0, lastTestRound: battle.round });
    } else if (sansPeur) {
      // Sans Peur : UN seul Test de Calme Accessible (+20) à la rencontre ; réussi → Peur ignorée d'emblée.
      const r = resolvePeurTest(calmeValue(enemy), src.indice, 0, battleRng(), isColdBlooded(enemy.traits), true);
      enemy.psychState.push({ type: 'peur', sourceId: foe.id, indice: src.indice, calmeDR: r.calmeDR, lastTestRound: battle.round });
      log.push(r.vaincue ? t('turn.fearVanquished', { name: enemy.label, foe: foe.label }) : t('turn.fear', { name: enemy.label, foe: foe.label }));
    } else {
      enemy.psychState.push({ type: 'peur', sourceId: foe.id, indice: src.indice, calmeDR: 0, lastTestRound: battle.round });
      log.push(t('turn.fear', { name: enemy.label, foe: foe.label }));
    }
  }
  // Test ÉTENDU de Calme des Peur actives (calmeDR < indice) — UNE fois par Round.
  for (const p of enemy.psychState) {
    if (p.type !== 'peur' || (p.calmeDR ?? 0) >= (p.indice ?? 0) || p.lastTestRound === battle.round) continue;
    const r = resolvePeurTest(calmeValue(enemy), p.indice ?? 1, p.calmeDR ?? 0, battleRng(), isColdBlooded(enemy.traits)); // À sang-froid (LDB 85)
    p.calmeDR = r.calmeDR;
    p.lastTestRound = battle.round;
    if (r.vaincue) log.push(t('turn.fearOvercome', { name: enemy.label }));
  }
  // ── Traits psy CIBLÉS (Animosité/Haine/… — LDB 21), instantané pour l'IA ──
  const visible = battle.combatants.filter((v) => v.id !== enemy.id && v.pos && !isOutOfAction(v) && losClear(scene, enemy.pos!, v.pos, smokeOf(battle)));
  for (const p of enemy.psychState) {
    // Re-test (fin de Round) des afflictions ciblées actives, tant qu'un membre du groupe est visible.
    if (!p.active || !estCibleType(p.type) || !p.cible || p.lastTestRound === battle.round) continue;
    if (!visible.some((v) => groupMatch(p.cible!, v.groups ?? []))) continue;
    p.lastTestRound = battle.round;
    if (resolveCalmeSimple(calmeValue(enemy), battleRng()).success) { p.active = false; log.push(t('turn.recompose', { name: enemy.label, type: p.type })); }
  }
  const tt = targetedTrigger(enemy, visible); // nouveau Trait ciblé déclenché par un membre du groupe visible
  if (tt) {
    const r = resolveCalmeSimple(calmeValue(enemy), battleRng());
    enemy.psychState.push({ type: tt.type, cible: tt.cible, sourceId: tt.sourceId, active: !r.success, lastTestRound: battle.round });
    if (!r.success) log.push(t('turn.afflictionGrip', { name: enemy.label, type: tt.type, cible: tt.cible }));
  }
  // Immunités croisées (LDB 21) : Animosité/Préjugé cèdent dès qu'on tombe sous un effet psy dominant (Peur/…).
  for (const tp of suppressSupersededPsych(enemy)) log.push(t('turn.psychSuperseded', { name: enemy.label, psych: psychologyLabel(tp) }));
  if (log.length) set({ battle: { ...get().battle!, log: [...get().battle!.log, ...evLines(log, 'fear', enemy.id)] } });
}

// ============================================================================================
// Hooks `turnStart` : la séquence RAW de début de tour ennemi, migrée ISO-COMPORTEMENT depuis la tête
// de `runEnemyAI`. Les `order` encodent la dépendance d'ordre (Frénésie/Rage AVANT la psychologie).
// Chaque `run()` appelle au RUNTIME la fonction/le bloc correspondant (pas de souci de cycle à l'import).
// ============================================================================================

// Sortie de Frénésie (LDB 21 l.35) : aucun hook `end-frenzy` par-nom — c'est un effet déclenché
// `onTurnStart` en DONNÉES (`psychology.json` : Sonné/Inconscient ∨ plus d'ennemi en LdV → Exténué),
// diffusé UNIFORMÉMENT (héros + IA) par `fireTurnStartTriggers` AVANT les hooks d'entrée ci-dessous.
registerCombatHook({
  // Rage (LDB 85 l.281-283) : « Elle peut dépenser tous ses Avantages (minimum 1) pour que celui
  // devienne Haine envers ses adversaires en combat rapproché. Elle peut aussi dépenser tous ses
  // Avantages (minimum 3) pour entrer en Frénésie. » Décision IA (RNG-free) : ≥ 3 → Frénésie
  // (politique historique conservée) ; sinon ≥ 1 ET des adversaires au contact non encore haïs →
  // tout dépenser pour la Haine (état psy ciblé LDB 21 : +1 DR aux Tests de Combat contre le groupe
  // + immunité à sa Peur, via psychology.json/psychDRAdjust). Cible = le 1ᵉʳ Groupe de chaque
  // adversaire Engagé (racial des héros) ; re-testable en fin de Round comme toute Haine (LDB 21).
  id: 'rage',
  phase: 'onTurnStart',
  order: 20,
  run: ({ get, set, battle, self }) => {
    const enemy = self;
    if (!enemy || !hasRage(enemy.traits) || isFrenzied(enemy)) return;
    const adv = enemy.advantage ?? 0;
    if (adv >= 3) {
      campSpend(get, enemy, adv); // dépense TOUS ses Avantages (LDB 85 l.282) — réserve du camp en mode groupe (AA 11 l.30-38)
      (enemy.psychState ??= []).push({ type: 'frenesie' });
      battle.log.push(ev('frenzy', t('turn.rageEnter', { name: enemy.label }), enemy.id));
      set({ battle: { ...battle } });
      return;
    }
    if (adv < 1) return;
    // Adversaires en COMBAT RAPPROCHÉ (Engagés, vivants) non déjà couverts par une Haine ACTIVE.
    const foes = (enemy.engagedWith ?? [])
      .map((id) => inBattleId(battle, id))
      .filter((f): f is Combatant => !!f && f.kind !== enemy.kind && !isOutOfAction(f));
    const hated = (enemy.psychState ?? []).filter((p) => p.type === 'haine' && p.active === true && p.cible);
    const uncovered = foes.filter((f) => !hated.some((p) => groupMatch(p.cible!, f.groups ?? [])));
    // Cibles de Haine : 1ᵉʳ Groupe de chaque adversaire non couvert (dédupliqué) — un foe sans Groupe
    // n'est pas modélisable en Trait ciblé (groupMatch), on ne dépense pas pour lui.
    const cibles = [...new Set(uncovered.map((f) => f.groups?.[0]).filter((g): g is string => !!g))];
    if (!cibles.length) return;
    campSpend(get, enemy, adv); // dépense TOUS ses Avantages (LDB 85 l.282) — réserve du camp en mode groupe (AA 11 l.30-38)
    enemy.psychState ??= [];
    for (const cible of cibles) {
      const src = uncovered.find((f) => f.groups?.[0] === cible)!;
      enemy.psychState.push({ type: 'haine', cible, sourceId: src.id, active: true, lastTestRound: battle.round });
      battle.log.push(ev('fear', t('turn.rageHate', { name: enemy.label, cible }), enemy.id));
    }
    set({ battle: { ...battle } });
  },
});
registerCombatHook({
  id: 'ai-maybe-frenzy', // l'IA tente d'entrer en Frénésie (LDB 21 l.31) AVANT le test psy (la Frénésie en rend immunisé)
  phase: 'onTurnStart',
  order: 30,
  run: ({ get, set, self }) => { if (self) aiMaybeFrenzy(get, set, self); },
});
registerCombatHook({
  id: 'resolve-psych-ai', // Peur/Terreur de l'IA au début de son tour (instantané, journalisé)
  phase: 'onTurnStart',
  order: 40,
  run: ({ get, set, self }) => { if (self) resolvePsychAI(get, set, self); },
});
