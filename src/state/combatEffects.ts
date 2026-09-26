import type { GameState, RevealEntry } from './store';
import type { Get, Set as SetFn } from './flowTypes';
import { armChapterRecapIfDue } from './chapitreRecap';
import type { LootGear, CascadeStep, CascadeStepMeta, CascadeTableDone, Cloture, PendingCascade, PendingTest, ScheduledEffect } from './pendings';
import { revealToStep } from './revealStep';
import { Combatant, CHAR_LABELS, type ModLine } from '../engine/types';
import { RULE_REF } from '../engine/ruleRefs';
import { battleRng } from './battleRng';
import { d10, d100, defaultRNG, roll as rollDice } from '../engine/dice';
import { petitePriereAnswered } from '../engine/prayer';
import { applyOps, resolveFormula, demandesDeDes, gelerOpsCtx, D10_CHUTE, OPS_CTX_HORS_CANAL,
  type OpsCtx, type OpsCtxGele, type DemandeDe, type GameOp } from '../engine/ops';
import { rule } from '../engine/policy';
import { gainCorruption, corruptionTarget, poseCorruptionPending, testDeCorruption } from './corruptionFlow';
import { spellCost } from '../engine/grimoire';
import { applyFall } from '../engine/movement';
import { bonus, effectiveChar } from '../engine/characteristics';
import { sceneNpc } from './sceneNpc';
import { buildActorView } from './combat/flowEval';
import { partyBest, partyAssisted, soutienDetail, isSocialTest, socialPsychMod, socialPsychLabel, socialPsychLines, testValue, actorHasSkill } from '../engine/skills';
import { statusCharmMod, statusCharmLabel, actorStatus, capriciousDR } from '../engine/social';
import { parseStatus } from '../engine/creation';
import { easeDifficulty } from '../engine/tests';
import { restoreFortune } from '../engine/fortune';
import { hasTalent } from '../engine/magic';
import { traumaOnImpossibleAmbition } from '../engine/psychology';
import { recomputeLoadout, itemFromGive, giveTrappingLabel, withGiveQualities, autoStowNewItem } from '../engine/items';
import { trappingById, indiceById } from './campaignData';
import { revealClue, discreditClue } from './clues';
import { creatureSemee, navireSeme, findCreatureById, findVehicleById, refLabel, WATER_EXPOSURE, diseaseLabel, nightStakeRef, combatStakeRef, flowStakeRef } from '../data';
import { MORALE_BASE } from '../engine/crewMorale';
import { clampSaboteurDR } from './shipCrew';
import { harvestSizeOf, harvestYield } from '../engine/harvest';
import { applySummon } from './summonFlow';
import { contractDisease, applyContraction, diseaseDefs } from '../engine/disease';
import { memoParVersion } from '../data/versionDataset';
import { hasHealSkill, HEAL_SKILL, type HealMode } from '../engine/healing';
import { openMedic } from './medicFlow';
import { seaWeatherTestMod, openPortAt, vesselManann, setVesselHull } from './seaVoyageFlow';
import { applyManannFactor, addManann, findManannFactor } from '../engine/seaVoyage';
import { placeById } from './worldMap';
import { openScriptedPsych } from './encounterPsychFlow';
import { tavernNpcOffers } from './tavernFlow';
import { openRest, placesOfKind } from './restFlow';
import { traumaById, dechirureFractureFicheId, permanentAmputations } from '../engine/trauma';
import { DAY_PHASES, minutesUntilNext, scheduleAt } from '../engine/clock';
import { TIME_COST } from '../engine/timeCost';
import { feedFromMeal, applyFaimTest, applySoifTest } from '../engine/provisions';
import { isWeatherWarded, exposureTarget, exposureCoatMods, type ExposureKind } from '../engine/exposure';
import { findSpellById } from '../data/index';
import { toBrass, fromBrass, toMoney } from '../engine/money';
import { distributeCredit, drainGroup, condCtx } from './bourseFlow';
import { Effect, setDoorOpen, type Trigger } from './scene';
import { placeCombatant } from './spawn';
import { type Flow, type FlowTest, type EffectOp, type Condition, flowFromEffects, flowHasOpADe, flowEffects, testFlow, evalCondition, leafOpsCtx, EMPTY_FLOW, spellOps } from './flow';
import { inRect, combatantsWithinRadius } from './combatGeometry';
import { removeEntity } from './combatGeometry';
import { playSfx } from '../audio/engine';
import { combatDistance } from './footprint';
import { registerCascadeApplier, setSuiteApresCommit, pushStep, idDeLaDernierePoussee,
  etapesDeLaFenetre, annoterEtapeDeLaFenetre } from './cascade';
import { exposureWaveBand } from './nightBands';
import { freeCons, rollStep, hostStep, idDansLaSequence, monoStep, openSequence, pousseSi, pushDie, type BuiltCascadeStep } from './rollSeam';
import { startGroundPursuit } from './pursuitFlow';
import { sourceExposureMod, autoExposureMods, drawWaterDisease, isWounded } from '../engine/waterExposure';
import { loseWounds, hasCondition } from '../engine/conditions';
import { touchActors } from './combatOrParty';
import { actorIn, coqueParId } from './combatants';
import { addPossession, type PossessionInput } from './possessionsFlow';
import { possessionLabel, type Possession, type LivingRef } from '../engine/possession';
import { ev } from './combatLog';
import { t } from '../i18n';
import { stepPrecision, stepDetail } from './rollSeam';
import { dataLabel } from '../data';
import { actionsAuthorees, type Drapeaux } from './usable';
import type { SceneEntity } from './scene';

/**
 * Effets de scène/campagne (`Effect[]`) appliqués par le store : le grand `applyEffects`
 * (setFlag/journal/dons/transitions/tests/soins…) + la brique de butin ATTRIBUABLE
 * (`gearFromEffects`/`applyEffectsLoot`/`assignGearAt`), les déclencheurs de zone
 * (`checkTriggers`) et l'empilement des révélations en étapes d'affichage (`pushReveal`). Extrait de combatFlow
 * (baril : ré-exporté par `./combatFlow`). Module FEUILLE — n'importe RIEN de combatFlow.
 */
/**
 * SÉQUENCE D'ACCUEIL d'une révélation (#942 L8) — évaluée sur l'état qui reçoit l'étape :
 *  - `own` : la révélation ouvre SA séquence, quoi qu'il y ait en vol. La séquence en vol d'un AUTRE
 *    `purpose` est alors PARQUÉE par la doctrine du slot (`pushStep`/`startCascade`, state/cascade.ts)
 *    et reprend à la clôture — c'est ce que réclame la carte d'ENTRÉE DE ZONE, qui doit passer AVANT
 *    les Tests de Psychologie de rencontre déclenchés au même instant ;
 *  - une séquence EN VOL : la SIENNE — la révélation REJOINT l'hôte au lieu de le suspendre. C'est le
 *    cas dominant (en combat la séquence en vol EST celle de l'arène) et le seul correct quand la
 *    révélation est émise DEPUIS un applier de cette séquence : les trois tirages chaînés d'une
 *    mutation (`corruptionFlow`) sont suivis de « Mutation — X », qui doit s'appender et non parquer
 *    la séquence en cours de commit ; de même, un abordage qui s'ouvre PENDANT une séquence de voyage
 *    ne doit pas la faire parquer une seconde fois par sa propre révélation ;
 *  - slot libre EN COMBAT : `'combat'`, la séquence de l'arène (inchangé) ;
 *  - sinon : le `site` déclaré par l'appelant (l'entretien quotidien a le sien), à défaut `'affichage'`.
 */
export const revealPurpose = (site: PendingCascade['purpose'], own: boolean) => (s: GameState): PendingCascade['purpose'] =>
  own ? site : (s.pendingCascade?.purpose ?? (s.battle ? 'combat' : site));

/** Empile une révélation en étape d'AFFICHAGE de cascade (`pushStep` : append à la séquence d'accueil,
 *  sinon elle l'ouvre). `purpose` = la séquence du SITE d'émission quand il en a une naturelle ;
 *  `own` = la révélation ne rejoint AUCUNE séquence en vol, elle ouvre la sienne (celle en vol est
 *  parquée puis reprise). ÉMETTEUR UNIQUE de toute révélation.
 *
 *  `autoClose` : DÉCLARE que cette révélation-là se referme seule, à la cadence de la gravité donnée
 *  (arbitrage #1270 — la fermeture explicite est le défaut ; un timer se justifie site par site). */
export function pushReveal(
  set: SetFn,
  entry: RevealEntry,
  opts?: { table?: CascadeTableDone; purpose?: PendingCascade['purpose']; own?: boolean; autoClose?: NonNullable<RevealEntry['severity']> },
): void {
  pushStep(set, (index) => revealToStep(entry, index, { table: opts?.table, ...(opts?.autoClose ? { autoClose: opts.autoClose } : {}) }), revealPurpose(opts?.purpose ?? 'affichage', !!opts?.own));
}

/** Vide la file de lignes de journal différées (`pendingLogQueue`) → événements de combat. SOURCE
 *  UNIQUE : appelée JUSTE AVANT chaque couture qui réécrit `battle.log` (le `set` y replace `log` →
 *  les lignes poussées par un hook profond — `onGainCondition` ennemi/auto — seraient sinon clobberées).
 *  Clôt la file (set) et RENVOIE les événements pour que l'appelant les FOLDE dans le MÊME `log` réécrit
 *  (bon ordre, zéro double `set` sur `battle`). File vide → no-op (tableau vide, pas de `set`). */
export function drainPendingLog(get: Get, set: SetFn): import('./combatLog').CombatEvent[] {
  const q = get().pendingLogQueue;
  if (!q.length) return [];
  set({ pendingLogQueue: [] });
  return q.map((e) => ev('condition', e.line, e.cid));
}

/** Pousse une ÉTAPE de séquence de combat déjà MINTÉE (`BuiltCascadeStep` — un constructeur de la
 *  porte `rollSeam`, ou `revealToStep`) : le cas `purpose:'combat'` de la primitive générique
 *  `pushStep` (state/cascade.ts). La variante FABRIQUE (`index` = position d'append) est celle de
 *  `pushStep` : un `kind` poussé PLUSIEURS fois dans la même séquence (relance d'Imparfaite, #942 L6)
 *  y prend un id unique. La fabrique peut rendre `undefined` — comme celle de `pushStep` : un
 *  constructeur de la porte qui REFUSE sa déclaration n'a aucune étape à donner, et l'index d'append
 *  n'est connu que dans le `set` atomique.
 *
 *  MURAGE (#1262 B4) : la marque est REQUISE ici — un littéral d'étape monté à la main ne compile
 *  plus. Les étapes de combat se déclarent aux portes (`pushBand`/`pushChoice`/`pushMono`/`pushTable`/
 *  `pushTableDone`/`pushDisplay`/`pushHost`), qui montent, surfacent et possèdent ; ce point d'entrée
 *  sert aux SEULES étapes déjà mintées par une fabrique tierce (bandes de `combat/triggeredTest`,
 *  révélations). */
export function pushCombatStep(set: SetFn, step: BuiltCascadeStep | ((index: number) => BuiltCascadeStep | undefined)): void {
  pushStep(set, step, 'combat');
}

// occupied / pushBackTiles / findFreeTile / displaceSmaller / removeEntity → combatGeometry.ts

/** Items ramassables d'un décor : un par feuille `do` « donneuse » de CHAQUE action authorée encore
 *  jouable (`actionsAuthorees`). `key` = `<actionId>:eff:<index dans flowEffects(action.flow)>` — elle
 *  porte l'action, parce que le ramassage épuise UNE action, pas un décor. Effets non-objet &
 *  branches (test) ignorés. */
export function entityPickables(ent: SceneEntity, flags: Drapeaux = {}): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  for (const a of actionsAuthorees(ent, flags))
    flowEffects(a.flow).forEach((e, i) => {
      if (flags[cleFeuilleRamassee(ent.id, a.id, i)]) return; // déjà pris, un objet à la fois
      if (e.type === 'giveTrapping') out.push({ key: `${a.id}:eff:${i}`, label: giveTrappingLabel(e, trappingById) });
      else if (e.type === 'giveMoney') out.push({ key: `${a.id}:eff:${i}`, label: 'Argent' });
    });
  return out;
}

/**
 * Clé du drapeau qui ferme UNE feuille donneuse d'une action authorée : en combat, on ramasse un objet
 * à la fois (`LDB 13 l.115-116`), et ce qui est pris ne se redonne pas — ni au ramassage suivant, ni
 * à la fouille en exploration. `index` = rang de la feuille dans `flowEffects(action.flow)`, STABLE
 * parce que le document de scène n'est jamais réécrit : l'état de jeu vit dans les drapeaux.
 */
export const cleFeuilleRamassee = (entId: string, actionId: string, index: number): string =>
  `__ramasse_${entId}_${actionId}_${index}`;

/**
 * Le Flow d'une action authorée PRIVÉ des feuilles déjà ramassées — SOURCE UNIQUE de « ce qu'il reste
 * à donner », lue par l'exécuteur d'exploration (`jouerAction`) comme par le pool de combat.
 * L'original n'est pas touché : un `seq` rend une copie sans ces pas, une feuille unique ramassée rend
 * le Flow VIDE.
 */
export function flowRestant(entId: string, action: { id: string; flow: Flow }, flags: Drapeaux): Flow {
  const pris = (i: number) => !!flags[cleFeuilleRamassee(entId, action.id, i)];
  if (action.flow.kind === 'seq') {
    let rang = -1;
    return { ...action.flow, steps: action.flow.steps.filter((s) => (s.kind === 'do' ? !pris(++rang) : true)) };
  }
  return action.flow.kind === 'do' && pris(0) ? EMPTY_FLOW : action.flow;
}

export function checkTriggers(get: Get, set: SetFn) {
  const { scene, partyPos, flags } = get();
  if (!scene) return;
  const dansLaZone = scene.triggers.filter((trig) => !flags[`__trigger_${trig.id}`]
    && inRect(partyPos, trig.rect) && (trig.rect.z ?? 0) === (partyPos.z ?? 0));
  for (let i = 0; i < dansLaZone.length; i++) {
    const trig = dansLaZone[i];
    if (trig.when && !evalCondition(trig.when, condCtx(get))) continue;
    if (trig.once) flags[`__trigger_${trig.id}`] = true;
    set({ flags: { ...flags } });
    const issue = runFlow(get, set, trig.flow, t('eff.flowTitleDiscovery'));
    // Le déclencheur a ouvert un dé (#1508) : les déclencheurs SUIVANTS de la même case sont AUTHORÉS
    // APRÈS lui, donc ils sont sa suite. Chacun garde sa garde `when` et son marquage `once` en
    // repartant en Flow (`if` de la grammaire + Effet `setFlag`) : la condition se relit sur l'état
    // VIVANT au moment où il jouera, exactement comme le tour de boucle qu'il remplace.
    if (issue === OPS_DIFFEREES) {
      const restants = dansLaZone.slice(i + 1).map(enFlowDeDeclencheur);
      if (restants.length) differerLaSuite(set, { kind: 'seq', steps: restants }, 'scene', t('eff.flowTitleDiscovery'));
      return;
    }
  }
}

/** UN déclencheur de zone en FLOW pur (#1508) : sa garde `when` devient le `if` de la grammaire, son
 *  marquage `once` l'Effet `setFlag` — le tour de boucle, en donnée différable. */
function enFlowDeDeclencheur(trig: Trigger): Flow {
  const corps: Flow = trig.once
    ? { kind: 'seq', steps: [{ kind: 'do', effect: { type: 'setFlag', flag: `__trigger_${trig.id}`, value: true } as Effect }, trig.flow] }
    : trig.flow;
  const pasDejaJoue: Condition = { kind: 'flag', expr: `!__trigger_${trig.id}` };
  const cond: Condition = trig.when ? { kind: 'all', of: [pasDejaJoue, trig.when] } : pasDejaJoue;
  return { kind: 'if', cond, then: corps };
}

// inRect → combatGeometry.ts

/** Sépare d'un lot d'Effets les giveTrapping ATTRIBUABLES (sans heroId) → lignes de butin
 *  « qui l'emporte ? ». Brique partagée écran de victoire / fenêtre de loot. Un giveTrapping
 *  AVEC heroId est un don d'auteur ciblé : il reste dans `rest` et s'applique directement. */
export function gearFromEffects(effects: Effect[]): { gear: LootGear[]; rest: Effect[] } {
  const gear: LootGear[] = [];
  const rest: Effect[] = [];
  for (const e of effects) {
    if (e.type === 'giveTrapping' && !e.heroId) gear.push({ label: giveTrappingLabel(e, trappingById), magic: !!e.qualities?.length || e.identified === false, effect: e });
    else rest.push(e);
  }
  return { gear, rest };
}

/** applyEffects + fenêtre de loot : hors combat, l'équipement trouvé (giveTrapping sans heroId)
 *  devient ATTRIBUABLE dans `pendingLoot` au lieu d'aller en silence au 1er héros ; l'argent
 *  s'applique à la bourse ET s'affiche ; les textes `journal` du lot deviennent le texte
 *  d'ambiance de la fenêtre. Sans butin (ou en combat : Ramasser/victoire ont leurs flux),
 *  strictement équivalent à applyEffects. Fenêtre déjà ouverte → le butin s'y AJOUTE. */
export function applyEffectsLoot(get: Get, set: SetFn, effects: Effect[], title: string, sl?: number): Applique {
  if (get().battle) return applyEffects(get, set, effects, sl);
  const { gear, rest } = gearFromEffects(effects);
  // Un lot DIFFÉRÉ n'ouvre pas sa fenêtre de butin ICI : le butin fait partie de la suite qu'il a
  // confiée au dé (le `rest` non appliqué y est déjà), et l'ouvrir maintenant la montrerait AVANT la
  // conséquence qui l'a produite.
  const differe = applyEffects(get, set, rest, sl);
  if (differe) return differe;
  const found = effects
    .filter((e): e is Extract<Effect, { type: 'giveMoney' }> => e.type === 'giveMoney')
    .reduce((m, e) => m + toBrass(toMoney(e.montant)), 0);
  if (!gear.length && found <= 0) return undefined; // dépense (giveMoney négatif) ou simple récit : pas de fenêtre
  const messages = effects.filter((e): e is Extract<Effect, { type: 'journal' }> => e.type === 'journal').map((e) => e.desc);
  set((s: GameState) => {
    const prev = s.pendingLoot;
    if (!prev) return { pendingLoot: { title, messages: messages.length ? messages : undefined, gold: found > 0 ? fromBrass(found) : undefined, gear } };
    return {
      pendingLoot: {
        ...prev,
        gear: [...prev.gear, ...gear],
        gold: found > 0 ? fromBrass(toBrass(prev.gold ?? { gold: 0, silver: 0, brass: 0 }) + found) : prev.gold,
        messages: [...(prev.messages ?? []), ...messages.filter((m) => !(prev.messages ?? []).includes(m))],
      },
    };
  });
  return undefined;
}

/** Attribue la ligne `index` du butin (`pendingLoot` ou `pendingVictory`) au héros choisi :
 *  l'Effet d'origine s'applique avec ce heroId (qualités/skin/identification conservés), la
 *  ligne quitte la fenêtre. Source unique de l'attribution (victoire ET fenêtre de loot). */
export function assignGearAt(get: Get, set: SetFn, key: 'pendingLoot' | 'pendingVictory', index: number, heroId: string) {
  const bucket = get()[key];
  if (!bucket?.gear || index < 0 || index >= bucket.gear.length) return;
  // Une ligne de butin est un `giveTrapping` par construction (`gearFromEffects`) : elle ne porte aucun
  // canal de dés, donc le retrait qui suit ne peut pas passer devant un dé (#1508).
  nePeutPasDifferer(applyEffects(get, set, [{ ...bucket.gear[index].effect, heroId }]), 'assignGearAt');
  set({ [key]: { ...bucket, gear: bucket.gear.filter((_, i) => i !== index) } });
}

/** Récolte « Précieuses Entrailles » (ZI) d'une créature vaincue (écran de victoire) : un nœud Flow
 *  `test` de Savoir (Bêtes) → `giveTrapping` — la réussite donne les pièces fraîches à pleine quantité,
 *  l'échec une quantité réduite (un cran de Taille en moins). Les pièces portent leur valeur de marché
 *  (`giveTrapping.price`), revendable au marchand / composant ZI. */
export function harvestVictoryCreature(get: Get, set: SetFn, creatureId: string) {
  const c = findCreatureById(creatureId);
  const p = c?.harvest;
  if (!c || !p) return;
  const name = c.label; // affichage depuis le record (résolu par id)
  const pv = get().pendingVictory;
  if (pv?.harvested?.includes(creatureId)) return; // déjà récolté
  const size = harvestSizeOf(c);
  const full = harvestYield(p, size, 0, 'Frais');
  const lo = harvestYield(p, size, -1, 'Frais');
  const part = (enc: number) => t('eff.harvestPart', { creature: name, enc }); // objet CUSTOM (hors catalogue)
  const titre = stepDetail(t('eff.harvest'), dataLabel(name));
  if (pv) set({ pendingVictory: { ...pv, harvested: [...(pv.harvested ?? []), creatureId] } }); // grise le bouton
  jouerFlowEntier(runFlow(get, set, testFlow(
    { skill: { id: 'savoir', spec: 'betes-sauvages' }, difficulty: 'intermediaire', label: titre, stake: combatStakeRef('harvestCreature', { values: { encPlein: full.enc, encEchec: lo.enc } }) },
    flowFromEffects([{ type: 'giveTrapping', custom: part(full.enc), price: full.total }]),
    flowFromEffects([{ type: 'giveTrapping', custom: part(lo.enc), price: lo.total }]),
  ), titre));
}

/** Lot 0 — déclenche les effets PROGRAMMÉS (file `scheduledEffects`) dont l'échéance est atteinte.
 *  Appelé par `advanceTime` à chaque avance d'horloge (le temps progresse par actions discrètes →
 *  un événement programmé entre deux pas se déclenche dès le pas qui le dépasse). Un effet dont le
 *  `cancelFlag` a été posé est CONSOMMÉ sans s'appliquer (désamorçage). Les entrées dues sont
 *  retirées AVANT application (pas de re-déclenchement). */
export function fireScheduledEffects(get: Get, set: SetFn) {
  const now = get().gameTime;
  const all = get().scheduledEffects;
  const due = all.filter((s) => s.executeAt <= now);
  if (!due.length) return;
  set({ scheduledEffects: all.filter((s) => s.executeAt > now) });
  jouerEffetsProgrammes(get, set, due);
}

/**
 * JOUE des entrées programmées DUES, dans leur ordre. REPRENABLE par construction : si l'une d'elles
 * ouvre un dé (#1508), celles qui restent partent en CLÔTURE avec ce dé (`effetsProgrammes`) au lieu de
 * se jouer devant lui. Elles voyagent telles quelles, `respawn` compris — la file `scheduledEffects`
 * porte deux charges, et une seule est un `Flow` : d'où une clôture qui les transporte, et non un Flow.
 */
function jouerEffetsProgrammes(get: Get, set: SetFn, entrees: ScheduledEffect[]): void {
  const flags = get().flags;
  for (let i = 0; i < entrees.length; i++) {
    const s = entrees[i];
    if (s.cancelFlag && flags[s.cancelFlag]) continue;
    // Reconstitution DIFFÉRÉE (Gardien éternel) : ré-invoque la créature programmée à la mort, près de sa
    // position de chute et dans son camp (`applySummon`, MÊME résolveur que les invocations de sort). Le
    // `caster` est un instantané minimal du défunt — applySummon n'en lit que id/name/kind/pos.
    if (s.respawn) { for (const line of applySummon(get, set, s.respawn.caster as unknown as Combatant, s.respawn.summon, { rng: battleRng() })) get().log(line); continue; }
    if (!s.flow) continue;
    const issue = runFlow(get, set, s.flow, t('eff.flowTitleEvent'));
    if (issue === OPS_DIFFEREES) {
      const restants = entrees.slice(i + 1);
      if (restants.length) differerLaSuite(set, undefined, 'scene', t('eff.flowTitleEvent'), [{ verbe: 'effetsProgrammes', restants }]);
      return;
    }
  }
}

/** Programme les ops d'une op IMPURE `delayed` (ext. #50-D) dans la file `scheduledEffects` — même
 *  mécanique que l'Effet de scène `delayedEffect` (Lot 0). Échéance : `afterMinutes/Hours/Days` résolus
 *  MAINTENANT contre la cible, OU `afterDuration:true` = l'échéance du contexte (fin de la durée du
 *  consommable — Bonnet de fou « Quand l'effet se dissipe… », LDB 71 l.20). `forMinutes/Hours/Days` :
 *  durée d'horloge PROPRE des ops différées (bakée sur la feuille programmée — Délice de Ranald :
 *  pénalité après les 3 h, LDB 71 l.24). Le Flow programmé cible le porteur par id (`on:'hero'`). */
export function scheduleDelayedOps(
  get: Get, set: SetFn, target: Combatant,
  op: Extract<import('../engine/ops').GameOp, { op: 'delayed' }>,
  base: { now: number; untilTime?: number; label?: string },
): void {
  const rng = battleRng();
  const delayMin = op.afterDuration
    ? Math.max(0, (base.untilTime ?? base.now) - base.now)
    : resolveFormula(op.afterMinutes ?? 0, target, rng)
      + resolveFormula(op.afterHours ?? 0, target, rng) * 60
      + resolveFormula(op.afterDays ?? 0, target, rng) * 24 * 60;
  const executeAt = base.now + Math.max(0, delayMin);
  const forMin = resolveFormula(op.forMinutes ?? 0, target, rng)
    + resolveFormula(op.forHours ?? 0, target, rng) * 60
    + resolveFormula(op.forDays ?? 0, target, rng) * 24 * 60;
  const flow: Flow = {
    kind: 'do',
    effect: {
      type: 'ops', on: 'hero', heroId: target.id, ops: op.ops,
      ...(base.label ? { label: base.label } : {}),
      ...(forMin > 0 ? { untilTime: executeAt + forMin } : {}),
    },
  };
  set({ scheduledEffects: [...get().scheduledEffects, { executeAt, flow }] });
}

/**
 * ISSUE d'`applyLeafOps` quand la feuille est DIFFÉRÉE (#1508) : ses dés sont ouverts à la porte, rien
 * n'est encore appliqué, et l'appelant DOIT rendre la main au lieu de poursuivre par-dessus un dé en
 * vol. Une valeur DISTINCTE d'un journal vide : « aucune ligne » et « pas encore joué » sont deux
 * états différents, et seul le second oblige l'appelant à confier sa suite.
 */
export const OPS_DIFFEREES = Symbol('#1508 feuille différée : ses dés sont à la porte');

/**
 * CE QUE REND TOUT POINT D'APPLICATION d'Effets/d'ops (#1508) : `OPS_DIFFEREES` si l'application a
 * ouvert un dé à la porte (rien n'est encore joué, l'appelant DOIT rendre la main et confier sa suite),
 * `undefined` sinon.
 *
 * Le type est la LEUR à tous — `applyLeafOps`, `applyEffects`, `applyEffectsLoot`, `runFlow`, le `flush`
 * des walkers : un maillon qui rendrait `void` couperait le signal, et l'appelant appliquerait sa suite
 * PAR-DESSUS un dé en vol.
 *
 * Un appelant a DEUX formes, et pas de troisième : il confie sa suite (`differerLaSuite`), ou il passe
 * par `jouerFlowEntier` ci-dessous — qui NOMME le fait qu'il n'a pas de suite. Un appel dont le retour
 * tombe par terre n'est ni l'un ni l'autre, et le scan de forme le refuse
 * (`roll-seam-exclusivity-guard.test.ts`).
 */
export type Applique = typeof OPS_DIFFEREES | undefined;

/**
 * CONSOMME le signal là où RIEN NE SUIT (#1508) : l'instruction suivante du site est son `return` ou
 * la fin de sa fonction. Une déférance laisse simplement la cascade OUVERTE — le dé se joue, sa
 * conséquence se dit, et il n'y a aucune suite à confier.
 *
 * Ce qui suit AILLEURS (horloge, dialogue, retrait de décor, seam de Test raté) n'est PAS exempté :
 * c'est une `Cloture`, différée avec la continuation.
 *
 * Ce nom existe parce que ni le type ni le lint ne savent le dire. Mesuré le 2026-09-05, sonde à deux
 * fichiers : `tsc --noEmit --strict` accepte une valeur rendue jetée en position d'instruction (sortie
 * 0), et `@typescript-eslint/no-unused-expressions` de même (sortie 0 — la règle laisse passer tout
 * appel de fonction, par construction).
 */
export function jouerFlowEntier(_applique: Applique): void {
  // Rien : la valeur est CONSOMMÉE par le seul fait d'être nommée ici (cf. contrat ci-dessus).
}

/**
 * CONSOMME le signal d'un lot qui NE PEUT PAS ouvrir de dé (#1508) — le site applique une donnée
 * LITTÉRALE dont le type d'Effet n'a pas de canal de dés (`giveMoney`, `giveTrapping`,
 * `waterExposure`), et ce qui le suit ne pourrait donc jamais passer devant un dé.
 *
 * Ce n'est pas une exemption, c'est un FAIL-FAST : si un jour ce lot atteint la porte, il lève ICI,
 * nommément, au lieu d'inverser l'ordre en silence. Un site qui « ne devrait pas » différer et le
 * ferait est un fait à connaître, pas une perte à découvrir au journal.
 */
export function nePeutPasDifferer(applique: Applique, site: string): void {
  if (applique === OPS_DIFFEREES) {
    throw new Error(`#1508 — « ${site} » a ouvert un dé à la porte alors que sa donnée n'en porte pas : `
      + 'ce qui suit ce site jouerait devant le dé. Lui confier une continuation (`differerLaSuite`).');
  }
}

/** Applique les ops d'UNE feuille EffectOp à `c` — SOURCE UNIQUE des exécuteurs d'EffectOp (handler de
 *  scène `ops`, `runCombatFlow`, runner de consommable) : les `delayed` sont PROGRAMMÉES
 *  (`scheduleDelayedOps`), le reste passe par `applyOps` avec le contexte de la FEUILLE (`leafOpsCtx` —
 *  untilTime/label bakés priment, sinon le contexte appelant). Renvoie le journal, ou `OPS_DIFFEREES`
 *  si les dés de la feuille sont partis à la porte (l'appelant confie alors SA SUITE à l'étape ouverte,
 *  cf. `differerLaSuite`).
 *
 *  FAIL-FAST assumé : l'énumération des dés (`demandesDeDes`) LÈVE sur donnée malformée (table de chute
 *  inconnue, coque absente au contexte) AVANT qu'aucune op de la feuille ne s'applique — une feuille
 *  qu'on ne sait pas annoncer entièrement ne s'applique pas à moitié. Même politique que le `case`
 *  correspondant du moteur, qui levait déjà au même endroit. */
export function applyLeafOps(get: Get, set: SetFn, c: Combatant, e: EffectOp, base: OpsCtx): string[] | typeof OPS_DIFFEREES {
  const now = base.now ?? get().gameTime;
  const ctx = leafOpsCtx({ ...base, now }, e);
  for (const o of e.ops) if (o.op === 'delayed') scheduleDelayedOps(get, set, c, o, { now, untilTime: ctx.defaultUntilTime, label: ctx.label });
  const rest = e.ops.filter((o) => o.op !== 'delayed');
  if (!rest.length) return [];
  // CANAL op → applier (#1508) : les dés que ces ops DEMANDENT (`demandesDeDes`) passent par la porte
  // avant que quoi que ce soit ne s'applique — une étape à dé nu par dé, appendue à la séquence en vol,
  // affichable/lançable/posable comme un Critique. La feuille s'applique à la RÉSOLUTION du dernier dé
  // (`opsDe`), avec les valeurs tombées. Aucune demande ⇒ chemin inchangé, au même point du rng.
  const demandes = demandesDeDes(rest, c, ctx);
  if (!demandes.length) return applyOps(c, rest, ctx);
  ouvrirDesDOps(set, c, rest, ctx, demandes[0]);
  return OPS_DIFFEREES;
}

/**
 * REFUS NOMMÉ d'un contexte que la reprise ne saurait pas rebâtir (#1508) — les hooks classés
 * `OPS_CTX_HORS_CANAL` (`onCondition`, `onCorruptionExposure`, `onOpposingAdvantage`) ne survivent ni à
 * une sauvegarde ni au réseau, et aucun chemin nommé ne les redonne. Une feuille qui en porte un ne se
 * DIFFÈRE donc pas : elle lève ICI plutôt que de s'appliquer plus tard AMPUTÉE.
 *
 * Mesuré : aucune donnée du dépôt n'atteint la porte avec l'un d'eux (ils naissent d'`endOfRound`, de
 * l'interlude et du bus de triggers, qui n'appellent pas `applyLeafOps`). Le jour où l'un y arrive,
 * c'est un fait à instruire, pas une perte à découvrir au journal.
 */
function refuserSiHorsCanal(ctx: OpsCtx): void {
  const portes = OPS_CTX_HORS_CANAL.filter((k) => ctx[k] !== undefined);
  if (portes.length) {
    throw new Error(`#1508 — feuille à dé DIFFÉRÉE portant un contexte non rebâtissable : ${portes.join(', ')}. `
      + "La reprise l'appliquerait sans ces hooks (cf. OPS_CTX_HORS_CANAL) — instruire le chemin avant de différer ici.");
  }
}

/**
 * OUVRE à la porte UN dé demandé par des ops (#1508) — étape à DÉ NU appendue à la séquence en vol,
 * possédée par la CIBLE (une magnitude SUBIE se joue au siège de qui la subit), posable sous
 * « Dés fixés » comme n'importe quelle table. L'applier `opsDe` enchaîne le dé suivant, ou applique.
 *
 * UN dé à la fois, et c'est la doctrine du slot : une conséquence à dé s'APPEND à la cascade qui la
 * produit (`pushDie`), jamais une fenêtre neuve ni une grappe mintée d'avance — le dé suivant peut
 * dépendre de ce que le précédent a posé.
 *
 * IDENTITÉ de la grappe : l'ID de sa PREMIÈRE étape, que `pushDie` rend unique par l'index d'append.
 * Le premier dé n'écrit donc AUCUN `opsDeGroupe` (il est son propre groupe, `groupeDe` ci-dessous) ; les
 * suivants portent celui-là. Deux grappes ouvertes sur le même acteur au même instant de jeu restent
 * ainsi distinctes, et chaque dé montré est celui que sa propre feuille applique.
 *
 * CONTEXTE : la part gelable voyage telle quelle (`gelerOpsCtx`), les Combattants par ID, le reste se
 * rebâtit (`ctxRepris`). La partition est TOTALE au type (`engine/ops`), donc rien ne se perd en silence.
 */
function ouvrirDesDOps(set: SetFn, cible: Combatant, ops: GameOp[], ctx: OpsCtx, demande: DemandeDe, groupe?: string): void {
  refuserSiHorsCanal(ctx);
  pushDie(set, {
    id: `opsDe-${cible.id}-${demande.cle}`,
    kind: 'opsDe',
    label: demande.libelle,
    icon: 'journal/fall',
    spec: demande.spec,
    actorId: cible.id,
    ...(demande.unite ? { unite: demande.unite } : {}),
    meta: {
      differeLaSuite: true,
      opsDe: ops,
      opsDeCle: demande.cle,
      ...(groupe ? { opsDeGroupe: groupe } : {}),
      opsDeCtx: gelerOpsCtx(ctx),
      ...(ctx.hull ? { hullId: ctx.hull.id } : {}),
      ...(ctx.caster ? { casterId: ctx.caster.id } : {}),
      ...(ctx.crew ? { opsDeCrewIds: ctx.crew.map((m) => m.id) } : {}),
    },
  }, revealPurpose('sequence', false));
}

/** Les ops DIFFÉRÉES que porte une étape — le `meta` est une union (il porte aussi des ids), donc la
 *  lecture NOMME ce qu'elle attend : un tableau d'objets à `op`. Rien d'autre n'est appliqué. */
function opsDeLEtape(step: CascadeStep): GameOp[] | null {
  const v = step.meta?.opsDe;
  if (!Array.isArray(v) || !v.every((o) => typeof o === 'object' && o !== null && 'op' in o)) return null;
  return v as GameOp[];
}

/** IDENTITÉ de la grappe de dés d'une étape : celle qu'elle DÉCLARE, sinon la SIENNE (elle l'ouvre). */
const groupeDe = (s: CascadeStep): string => (typeof s.meta?.opsDeGroupe === 'string' ? s.meta.opsDeGroupe : s.id);

/**
 * RECONSTRUIT l'`OpsCtx` d'une feuille différée à sa reprise — lecture UNIQUE de la partition totale
 * d'`OpsCtx` (`engine/ops`) : la part GELÉE revient verbatim du `meta`, les Combattants sont retrouvés
 * par ID, et ce qui ne se sérialise pas se REBÂTIT par un chemin nommé (le rng de la partie, le hook de
 * Corruption branché sur la cible — le seul que le dépôt pose sur une feuille, cf. `OPS_CTX_REBATIS`).
 * `des` est monté par l'applier depuis les étapes sœurs, jamais recopié.
 *
 * Rend `null` quand la COQUE déclarée a disparu entre le mint et la résolution (voyage clos, cascade
 * suspendue puis reprise) : l'appelant le DIT au lieu de jouer la conséquence à moitié.
 */
function ctxRepris(get: Get, set: SetFn, step: CascadeStep, cible: Combatant): OpsCtx | null {
  const gele = (step.meta?.opsDeCtx ?? {}) as OpsCtxGele;
  const hullId = typeof step.meta?.hullId === 'string' ? step.meta.hullId : undefined;
  const hull = hullId ? coqueParId(get(), hullId) : undefined;
  if (hullId && !hull) return null;
  const casterId = typeof step.meta?.casterId === 'string' ? step.meta.casterId : undefined;
  const caster = casterId ? actorIn(get(), casterId) : undefined;
  const crewIds = Array.isArray(step.meta?.opsDeCrewIds) ? step.meta.opsDeCrewIds : undefined;
  const crew = crewIds?.map((id) => actorIn(get(), id)).filter((m): m is Combatant => !!m);
  return {
    ...gele,
    rng: battleRng(),
    onCorruption: (n, align) => gainCorruption(get, set, cible, n, align),
    ...(hull ? { hull } : {}),
    ...(caster ? { caster } : {}),
    ...(crew?.length ? { crew } : {}),
  };
}

/**
 * APPLIER du canal op → applier (#1508) : le dé de cette étape est tombé (lancé ou POSÉ). S'il reste
 * une demande non servie pour la MÊME grappe, elle s'ouvre à son tour ; sinon les ops s'appliquent AVEC
 * tous les dés de la grappe (`OpsCtx.des`), donc sans qu'aucun d'eux ne soit retiré, et la CONTINUATION
 * confiée par le walker qui a différé est rejouée APRÈS.
 *
 * Les dés déjà tombés se relisent sur les ÉTAPES SŒURS de la séquence (même grappe) : rien n'est
 * recopié dans le `meta`, donc rien ne peut diverger de ce que la fenêtre a montré.
 */
registerCascadeApplier('opsDe', (get, set, step, hero, sctx) => {
  const ops = opsDeLEtape(step);
  if (!ops || !step.de?.result) return;
  // Cible introuvable = conséquence PERDUE : elle se DIT, comme la coque disparue (`ctxRepris`).
  if (!hero) return { consequences: freeCons([t('cascade.cibleDisparue', { label: step.label ?? '' })]) };
  const ctx = ctxRepris(get, set, step, hero);
  if (!ctx) return { consequences: freeCons([t('cascade.coqueDisparue', { label: step.label ?? '' })]) };
  const groupe = groupeDe(step);
  const des = new Map<string, number>();
  for (const s of sctx.steps.slice(0, sctx.index + 1)) {
    const cle = s.meta?.opsDeCle;
    if (groupeDe(s) !== groupe || typeof cle !== 'string' || !s.de?.result) continue;
    des.set(cle, s.de.result.total);
  }
  const reste = demandesDeDes(ops, hero, ctx).filter((d) => !des.has(d.cle));
  if (reste.length) { ouvrirDesDOps(set, hero, ops, ctx, reste[0], groupe); return; }
  const journal = applyOps(hero, ops, { ...ctx, des });
  set(touchActors(get()));
  // La suite confiée à cette étape est rejouée par le GOULOT (`cascade.commitStep`), une fois cette
  // conséquence journalisée — cf. `setSuiteApresCommit`.
  return { consequences: freeCons(journal) };
});

/**
 * OUVRE à la porte le 1d10 de DÉGÂTS d'une chute de hauteur CONNUE (LDB 15 l.80) — effondrement d'une
 * passerelle, chute de selle, Effet d'auteur : la hauteur est déjà dite par la situation, seul le dé
 * reste à jeter, et il se jette à la porte comme celui d'un Critique. `applyFall` reste le foyer
 * unique de la formule : il reçoit le dé tombé.
 *
 * Le site qui appelle n'a AUCUNE question à se poser (« le jeu est-il paramétré pour ? ») : c'est la
 * porte qui sait si le dé s'affiche, se lance ou se pose.
 */
export function ouvrirChute(set: SetFn, cible: Combatant, metres: number): void {
  pushDie(set, {
    id: `chute-${cible.id}`,
    kind: 'chuteDe',
    label: t('op.fall.deDegats'),
    icon: 'journal/fall',
    spec: D10_CHUTE,
    actorId: cible.id,
    meta: { differeLaSuite: true, chuteMetres: metres },
  }, revealPurpose('sequence', false));
}

/** APPLIER de la chute à hauteur connue (#1508) : le dé tombé part dans `applyFall`, qui décide seul
 *  des Blessures et de l'État À Terre (LDB 15 l.80/l.84). La ligne dit la perte et l'État POSÉ, lu par
 *  DIFFÉRENCE — elle ne nomme aucun État d'avance. La continuation confiée par le walker suit. */
registerCascadeApplier('chuteDe', (get, set, step, hero) => {
  const metres = step.meta?.chuteMetres;
  // Le dé n'a pas encore de résultat : l'étape est ouverte, rien à appliquer — le goulot repassera.
  if (typeof metres !== 'number' || !step.de?.result) return;
  // Cible introuvable = conséquence PERDUE : elle se DIT, comme la coque disparue (`ctxRepris`).
  if (!hero) return { consequences: freeCons([t('cascade.cibleDisparue', { label: step.label ?? '' })]) };
  const avant = hero.wounds.current;
  const dejaATerre = hasCondition(hero, 'a-terre');
  applyFall(hero, metres, step.de.result.total);
  // Ce que LA CHUTE a coûté, lu IMMÉDIATEMENT après elle : la ligne dit sa propre conséquence, pas le
  // solde de tout ce qui suivra (la suite confiée à l'étape est rejouée par le goulot, plus tard).
  const perte = avant - hero.wounds.current;
  const aTerre = !dejaATerre && hasCondition(hero, 'a-terre');
  set(touchActors(get()));
  return { consequences: freeCons([t('eff.fallTarget', {
    name: hero.label,
    m: metres,
    lost: perte,
    aterre: aTerre ? t('eff.fragATerre') : '',
  })]) };
});

// ---------------------------------------------------------------------------
// CONTINUATION d'un lot/d'une pile DIFFÉRÉE par un dé (#1508)
// ---------------------------------------------------------------------------

/**
 * Le walker de COMBAT (`combat/triggeredTest.runCombatFlow`), INJECTÉ — inversion de dépendance
 * (patron `registerCascadeApplier`/`freeAttackHook`) : `triggeredTest` importe ce module, l'inverse
 * ferait un cycle. Absent (moteur pur, tests unitaires du module) ⇒ une continuation de combat est
 * REFUSÉE nommément plutôt que rejouée par le mauvais walker.
 */
let suiteCombat: ((get: Get, set: SetFn, cible: Combatant, caster: Combatant | undefined, flow: Flow, label: string) => void) | null = null;
export function registerSuiteCombat(fn: NonNullable<typeof suiteCombat>): void { suiteCombat = fn; }

/**
 * NOMBRE d'étapes de la séquence en vol qui font ATTENDRE leur conséquence à un dé (`meta.differeLaSuite`).
 * Les deux walkers s'en servent de la MÊME façon : si ce nombre a AUGMENTÉ pendant qu'ils appliquaient
 * une feuille, cette feuille a ouvert un dé — le reste de leur lot/pile est SA suite, pas la suite
 * immédiate. Un compte, et non une liste de `kind` : un troisième kind à dé déclare le champ et il est
 * servi sans toucher ici.
 */
export function comptePasDifferes(s: GameState): number {
  const attend = (p: { meta?: CascadeStepMeta }): boolean => p.meta?.differeLaSuite === true;
  // La séquence en cours de validation n'est pas toujours dans le slot : un dé ouvert PENDANT une
  // application est COLLECTÉ par la fenêtre d'insertion (`cascade`) et n'entrera dans le tableau qu'au
  // commit. Ne compter que le store ferait croire à l'appelant que rien n'attend, et sa suite passerait
  // devant le dé — exactement le défaut que ce compte existe pour empêcher.
  return (s.pendingCascade?.participants ?? []).filter(attend).length + etapesDeLaFenetre().filter(attend).length;
}

/**
 * CONFIE la suite du walker à la DERNIÈRE étape à dé ouverte (#1508) — c'est le geste du `case 'test'`
 * des deux walkers (`stack.splice(0)` empaqueté en continuation), transposé au dé : un lot d'Effets ou
 * une pile de Flow qui poursuivrait par-dessus un dé en vol appliquerait ses conséquences AVANT celle
 * qui attend : l'ordre AUTHORÉ s'inverse (« il tombe PUIS on le soigne » se joue à l'envers).
 *
 * La DERNIÈRE étape, parce qu'une feuille peut en ouvrir plusieurs (une par cible d'un Effet de groupe) :
 * la suite reprend quand le dernier dé du lot est tombé.
 */
export function differerLaSuite(set: SetFn, flow: Flow | undefined, mode: 'scene' | 'combat', label?: string, clotures?: Cloture[]): void {
  const compose = (actuel: CascadeStepMeta | undefined): CascadeStepMeta => {
    const dejaFlow = actuel?.apresFlow as Flow | undefined;
    return { ...actuel,
      // COMPOSE, jamais n'écrase : deux confidences sur la même étape (le reste d'un lot PUIS la
      // continuation d'un second) sont DEUX suites à jouer dans leur ordre, pas un remplacement.
      // Même règle que les clôtures juste dessous — le `seq` est l'opérateur de suite du Flow.
      ...(flow ? { apresFlow: dejaFlow ? { kind: 'seq' as const, steps: [dejaFlow, flow] } : flow } : {}),
      ...(clotures?.length ? { apresClotures: [...((actuel?.apresClotures as Cloture[] | undefined) ?? []), ...clotures] } : {}),
      apresMode: mode, ...(label ? { apresLabel: label } : {}) };
  };
  // Un dé ouvert PENDANT une application attend dans la fenêtre d'insertion, hors du store : c'est LÀ
  // qu'on lui confie la suite. La chercher dans le slot la donnerait à une autre étape, ou à personne.
  const pousse = idDeLaDernierePoussee();
  const enFenetre = pousse ? etapesDeLaFenetre().find((x) => x.id === pousse) : undefined;
  if (enFenetre && annoterEtapeDeLaFenetre(enFenetre.id, compose(enFenetre.meta))) return;
  set((s: GameState) => {
    const p = s.pendingCascade;
    if (!p) return {};
    const i = indexDeLEtapeQuiAttend(p);
    if (i < 0) return {};
    return { pendingCascade: { ...p, participants: p.participants.map((x, k) => (k === i
      ? { ...x, meta: compose(x.meta) } : x)) } };
  });
}

/**
 * L'ÉTAPE à qui confier une suite (#1508) : celle que l'application EN COURS vient de pousser
 * (`cascade.idDeLaDernierePoussee`), sinon la dernière du tableau qui fait attendre sa conséquence.
 *
 * Les deux divergent depuis que les étapes s'INSÈRENT derrière l'étape courante : le tableau peut se
 * terminer par le dé d'un AUTRE porteur, poussé avant. La poussée est le fait juste ; la position n'est
 * qu'un repli, pour les sites qui ouvrent hors de toute application (un walker de scène).
 */
function indexDeLEtapeQuiAttend(p: PendingCascade): number {
  const pousse = idDeLaDernierePoussee();
  if (pousse) {
    const porteurs = p.participants.map((x, k) => (x.id === pousse ? k : -1)).filter((k) => k >= 0);
    // Un id porté par PLUSIEURS étapes ne désigne personne : prendre le premier accrocherait la suite à
    // un porteur au hasard — souvent l'étape DÉJÀ validée, qui ne la rejouera jamais. C'est le symptôme
    // d'une identité non monotone (`PendingCascade.seq`) : il se dit, il ne se contourne pas.
    if (porteurs.length > 1) {
      throw new Error(`#1508 — identité d'étape AMBIGUË : ${porteurs.length} étapes portent l'id « ${pousse} » `
        + '(indices ' + porteurs.join(', ') + '). Le compteur `PendingCascade.seq` doit donner un id NEUF à chaque poussée.');
    }
    if (porteurs.length === 1 && p.participants[porteurs[0]].meta?.differeLaSuite === true) return porteurs[0];
  }
  return p.participants.map((x) => x.meta?.differeLaSuite === true).lastIndexOf(true);
}

/**
 * REGISTRE des CLÔTURES (#1508) — patron `cascadeAppliers` : chaque verbe de l'union `Cloture` est
 * résolu par UNE fonction, enregistrée par le module qui la POSSÈDE (le store pose les siennes, ce
 * module pose la sienne). La donnée voyage (sauvegarde, réseau), le code reste ici.
 *
 * TOTALITÉ tenue au type (`_ClotureRegistreTotal` ci-dessous) : un verbe ajouté à l'union sans applier
 * ne compile pas — la clôture ne peut pas se perdre en silence, qui est exactement le défaut qu'elle
 * répare.
 */
type ClotureApplier<K extends Cloture['verbe']> = (get: Get, set: SetFn, c: Extract<Cloture, { verbe: K }>) => void;
const clotureAppliers = new Map<Cloture['verbe'], ClotureApplier<Cloture['verbe']>>();
export function registerCloture<K extends Cloture['verbe']>(verbe: K, fn: ClotureApplier<K>): void {
  clotureAppliers.set(verbe, fn as unknown as ClotureApplier<Cloture['verbe']>);
}
/** Les verbes de l'union, en VALEURS — lus par la garde de totalité du registre. */
export const CLOTURE_VERBES = ['dialogueSuivant', 'avancerHorloge', 'retirerEntite', 'marquerActionJouee',
  'testRateDeLActeur', 'effetsProgrammes', 'ouvrirEcranDeVictoire', 'teardownDeVictoire'] as const;
/** TOTALITÉ AU TYPE : un verbe ajouté à `Cloture` sans entrée dans `CLOTURE_VERBES` fait échouer `tsc`. */
export type _ClotureVerbesTotaux = [Exclude<Cloture['verbe'], (typeof CLOTURE_VERBES)[number]>] extends [never] ? true
  : ['VERBE DE Cloture ABSENT DE CLOTURE_VERBES', Exclude<Cloture['verbe'], (typeof CLOTURE_VERBES)[number]>];
const _verbesTotaux: _ClotureVerbesTotaux = true;
void _verbesTotaux;

/** Les clôtures qu'une étape porte — `meta` est une union, la lecture NOMME ce qu'elle attend. */
function cloturesDe(step: CascadeStep): Cloture[] {
  const v = step.meta?.apresClotures;
  if (!Array.isArray(v)) return [];
  return v.filter((c): c is Cloture => typeof c === 'object' && c !== null && 'verbe' in c);
}

/**
 * REJOUE la continuation d'une étape, APRÈS que sa conséquence a été DITE — branchée sur le GOULOT de
 * validation (`cascade.setSuiteApresCommit`), donc valable pour TOUTE étape qui en porte une, sans
 * qu'aucun applier ait à y penser.
 *
 * Le walker est celui qui l'a produite (`meta.apresMode`), seul à savoir quoi en faire : celui de
 * SCÈNE applique un lot d'Effets d'auteur (`runFlow`), celui de COMBAT reprend une pile qui porte
 * cible et lanceur (`runCombatFlow`, injecté par `combatFlow`).
 *
 * La suite peut elle-même DIFFÉRER (une seconde chute) : les CLÔTURES repartent alors avec le nouveau
 * dé, au lieu de se jouer devant lui. C'est ce qui rend l'invariant STABLE en profondeur — la « suite
 * du verbe appelant » ne peut pas resurgir d'un anneau plus haut.
 */
function rejouerLaSuite(get: Get, set: SetFn, step: CascadeStep): void {
  const flow = step.meta?.apresFlow as Flow | undefined;
  const mode = step.meta?.apresMode;
  const clotures = cloturesDe(step);
  if (!flow && !clotures.length) return;
  if (mode !== 'scene' && mode !== 'combat') return;
  const label = typeof step.meta?.apresLabel === 'string' ? step.meta.apresLabel : (step.label ?? t('eff.flowTitle'));
  const avant = comptePasDifferes(get());
  if (flow) {
    if (mode === 'scene') jouerFlowEntier(runFlow(get, set, flow, label));
    else {
      const cible = step.actorId ? actorIn(get(), step.actorId) : undefined;
      if (!cible) return; // le porteur a quitté l'état (mort retirée, voyage clos) : rien à qui appliquer la suite
      const casterId = typeof step.meta?.casterId === 'string' ? step.meta.casterId : undefined;
      if (!suiteCombat) throw new Error('#1508 — continuation de COMBAT sans walker injecté (registerSuiteCombat) : la suite du Flow serait perdue.');
      suiteCombat(get, set, cible, casterId ? actorIn(get(), casterId) : undefined, flow, label);
    }
  }
  if (!clotures.length) return;
  // Le Flow rejoué a ouvert un dé de plus : les clôtures sont SA suite à leur tour.
  if (comptePasDifferes(get()) > avant) { differerLaSuite(set, undefined, mode, label, clotures); return; }
  jouerLesClotures(get, set, clotures, mode, label);
}

/**
 * JOUE les clôtures d'une étape, dans l'ordre du site — et si l'UNE d'elles ouvre un dé à son tour
 * (l'horloge d'une fouille peut tirer un effet programmé qui fait tomber), celles qui RESTENT partent
 * avec ce dé. Rien ne double-passe : l'étape SOURCE rend sa suite en se validant (`cascade.commitStep`,
 * au même endroit que son mémo de pli), et seules les clôtures NON ENCORE jouées sont reportées.
 */
export function jouerLesClotures(get: Get, set: SetFn, clotures: Cloture[], mode: 'scene' | 'combat' = 'scene', label: string = t('eff.flowTitle')): void {
  for (let i = 0; i < clotures.length; i++) {
    const c = clotures[i];
    const applier = clotureAppliers.get(c.verbe);
    if (!applier) throw new Error(`#1508 — clôture « ${c.verbe} » sans applier (registerCloture) : la suite du verbe serait perdue.`);
    const avant = comptePasDifferes(get());
    applier(get, set, c);
    if (comptePasDifferes(get()) > avant && i + 1 < clotures.length) {
      differerLaSuite(set, undefined, mode, label, clotures.slice(i + 1));
      return;
    }
  }
}
/**
 * CLÔT un verbe (#1508) — LE geste des sites dont quelque chose SUIT le Flow : il consomme le signal
 * d'application et place ses clôtures du bon côté du dé. Déféré ⇒ elles partent AVEC le dé (elles se
 * joueront après la conséquence) ; sinon ⇒ elles se jouent MAINTENANT, dans l'ordre du site.
 *
 * Le site n'a donc aucune question à se poser (« y a-t-il un dé en vol ? ») : il DIT ce qu'il allait
 * faire ensuite, et la porte décide quand.
 */
export function cloturer(get: Get, set: SetFn, applique: Applique, clotures: Cloture[], mode: 'scene' | 'combat' = 'scene', label?: string): void {
  if (applique === OPS_DIFFEREES) { differerLaSuite(set, undefined, mode, label, clotures); return; }
  jouerLesClotures(get, set, clotures, mode, label ?? t('eff.flowTitle'));
}

setSuiteApresCommit(rejouerLaSuite);
// Les effets programmés RESTANTS d'un même pas d'horloge : la seule clôture que CE module possède
// (les autres verbes appartiennent au store, qui les enregistre à son chargement).
registerCloture('effetsProgrammes', (get, set, c) => jouerEffetsProgrammes(get, set, c.restants));

/** Cibles d'un EffectOp de scène (`ops` on=party/hero) : les héros vivants concernés,
 *  dans le bon ensemble (file de combat si en combat, sinon le groupe). `hero` = celui désigné par
 *  `heroId` (défaut : 1er vivant) ; `party` = tous les héros vivants. SOURCE UNIQUE (pas de dup). */
function effectTargets(get: Get, target: 'party' | 'hero', heroId?: string): Combatant[] {
  const pool = get().battle?.combatants ?? get().party;
  if (target === 'hero') {
    const id = heroId || pool.find((c) => c.kind === 'hero' && !c.dead)?.id;
    return pool.filter((c) => c.id === id);
  }
  return pool.filter((c) => c.kind === 'hero' && !c.dead);
}

/**
 * VOCABULAIRE DE CIBLAGE d'un Effet de SCÈNE : une scène vise le GROUPE, ou UN héros désigné par son
 * `heroId` (`on` absent = `party`). `target`/`caster` sont ceux du DÉCLENCHÉ — cible et lanceur résolus
 * par sa porte (`routeTriggeredTest`, `combat/triggeredTest.ts`) —, que le marcheur de scène ne connaît
 * pas. SOURCE UNIQUE de la LEVÉE du handler `ops`, de sa VALIDATION (`refs`, lue par `validateScene`)
 * et de l'entrée `scene` de `CIBLES_PAR_RACINE`.
 */
export const CIBLES_D_EFFET_DE_SCENE = [
  { on: 'party', label: 'Tout le groupe' },
  { on: 'hero', label: 'Un héros' },
] as const;
export type CibleDEffetDeScene = (typeof CIBLES_D_EFFET_DE_SCENE)[number]['on'];

/**
 * REGISTRE des tables de cibles d'un Effet `ops`, une entrée par RACINE : chaque table offre EXACTEMENT
 * les `on` que le marcheur de sa racine honore, sous le libellé du RÔLE réel. Sa PREMIÈRE entrée est le
 * `on` d'une feuille qui n'en porte pas.
 *  - `scene` : handler `ops` (`EFFECT_HANDLERS.ops`, `effectTargets`) ;
 *  - `sort` : `runCastFlow` sur `spellFlowFor(…, 'target' | 'caster')` (`combatFlow.ts`) ;
 *  - `declenche` : `runPureFlowLines(cible, porteur, …)` (`triggeredEffects.ts`) ; un Flow à `test` passe
 *    par la porte `routeTriggeredTest` (voie routée) ou par `resolveInlineFlowTest` (entretien hors combat) ;
 *  - `critique` : `routeTriggeredTest(victime, victime, …)`, depuis `applyCriticalToTarget`,
 *    `applyHullCriticalToTarget` et `openCombatEndCascade` (`combatFlow.ts`) ;
 *  - `maladie` : `spellOps(node.fail, 'target')` (`engine/disease.ts`, `opsDeLEchec`) ;
 *  - `consommable` : `bakeConsumableFlow` réécrit toute feuille sur le buveur (`engine/consumables.ts`) ;
 *  - `critiqueDeCoque` : `bandeTriggeredTest` sur les marins touchés (`engine/shipCritical.ts`, `applyCrewHit`).
 */
export const CIBLES_PAR_RACINE = {
  scene: CIBLES_D_EFFET_DE_SCENE,
  sort: [{ on: 'target', label: 'La cible' }, { on: 'caster', label: 'Le lanceur' }],
  declenche: [{ on: 'target', label: 'La cible du déclencheur' }, { on: 'caster', label: 'Le porteur' }],
  critique: [{ on: 'target', label: 'La victime' }],
  maladie: [{ on: 'target', label: 'Le malade' }],
  consommable: [{ on: 'target', label: 'Le buveur' }],
  critiqueDeCoque: [{ on: 'target', label: 'Le marin touché' }],
} as const;
export type RacineDEffet = keyof typeof CIBLES_PAR_RACINE;
export type RacineDeCatalogue = Exclude<RacineDEffet, 'scene'>;

/** La table de cibles qu'une RACINE offre à ses Effets `ops` — jamais supposée. */
export type TableDeCibles = (typeof CIBLES_PAR_RACINE)[RacineDEffet];

/** `on` (défaut `party`) appartient-il au vocabulaire de scène ? Garde de type : le handler narrowe
 *  dessus avant d'appeler `env.targets`. */
export function estCibleDeScene(on: string | undefined): on is CibleDEffetDeScene {
  return CIBLES_D_EFFET_DE_SCENE.some((c) => c.on === (on ?? 'party'));
}

/** Le refus, dit UNE fois — même phrase à la validation d'une scène et à la levée du marcheur. */
export function messageCibleHorsScene(e: { label?: string; on?: string }, on: string): string {
  return `Effet ${e.label ? `« ${e.label} » ` : ''}à « on: ${on} » : ce vocabulaire est celui d'un effet DÉCLENCHÉ `
    + '(cible et lanceur résolus par sa porte, `routeTriggeredTest`), que le marcheur de scène ne connaît pas. '
    + 'Une scène vise `party` ou `hero` (+ `heroId`).';
}

/** Ouvre la modale d'un Test de compétence — SOURCE UNIQUE (le nœud Flow `test` ET `Effect.test` y
 *  passent). `onSuccess`/`onFailure` = branches (Flows) ; `after` = continuation reprise APRÈS la
 *  branche (suite d'un `seq`). Choix du meilleur PJ effectif (malus social compris), candidats,
 *  `easierIf`, outil. Retourne false si aucun héros vivant ne peut tenter (le flux continue sans Test). */
export function openSkillTest(
  get: Get, set: SetFn, spec: FlowTest, onSuccess: Flow, onFailure: Flow, after: Flow,
  opts?: {
    actorId?: string;
    noOwnTestFailed?: boolean;
    /** Action de combat « Cumuler l'Avantage » (LDB 09 l.305-308) : l'octroi porté par le pending et
     *  appliqué par `resolveTest` — la couture reste la même, seule la conséquence est déclarée ici. */
    combatAdvantage?: { combatantId: string; cap: number };
    /** Test initié en COMBAT : annulable pré-jet (l'Action n'est pas encore dépensée). */
    cancellable?: boolean;
    /** Test SUBI : le vocabulaire de sa branche (`PendingTest.subi`) — posé par `routeTriggeredTest`. */
    subi?: PendingTest['subi'];
  },
): boolean {
  // Modulateurs sociaux PAR ACTEUR (un Test social vs un interlocuteur) : malus psy Animosité/Préjugé
  // (LDB 21) + mod de Statut Échelon/Standing (LDB 08). Le Statut compare l'acteur à la cible `vsStatus`.
  const isSocial = isSocialTest(spec.skill?.id, spec.characteristic);
  const tgtStatus = isSocial && spec.vsStatus ? parseStatus(spec.vsStatus) : undefined;
  const psychMod = spec.vsGroups?.length && isSocial ? (c: Combatant) => socialPsychMod(c, spec.vsGroups!) : undefined;
  // 1d10 « réaction au Statut » (option, LDB 08 l.40/59) tiré UNE fois par Test (RNG seedé) — appliqué à
  // tous les candidats de façon cohérente (la réaction de l'interlocuteur ne dépend pas du héros choisi).
  const reactionRoll = tgtStatus && rule('social-status-reaction-roll') ? battleRng().int(1, 10) : undefined;
  const statusMod = tgtStatus ? (c: Combatant) => statusCharmMod(actorStatus(c), tgtStatus, { begging: spec.begging, reactionRoll }) : undefined;
  // Capricieux (MSRC 15 l.149-159) : la créature-interlocuteur tire un d10 (UNE fois, seedé,
  // INDÉPENDANT du héros choisi — c'est SA réaction) ; la table rend un delta de DR appliqué au Test
  // RÉSOLU (`FLOWS.test.resolve`), donc hors de `skillValue`/`target`. Constant pour tous les candidats.
  const capriciousRoll = isSocial && spec.vsCapricieux ? battleRng().int(1, 10) : undefined;
  const capDR = capriciousRoll != null ? capriciousDR(capriciousRoll) : 0;
  const socialMod = psychMod || statusMod
    ? (c: Combatant) => (psychMod ? psychMod(c) : 0) + (statusMod ? statusMod(c) : 0)
    : undefined;
  const socialDetail = (c: Combatant): string | undefined => {
    const parts: string[] = [];
    const pl = psychMod ? socialPsychLabel(c, spec.vsGroups!) : undefined;
    if (pl) parts.push(`${pl} envers ${spec.vsGroups!.join('/')}`);
    const sl = tgtStatus ? statusCharmLabel(actorStatus(c), tgtStatus, { begging: spec.begging }) : undefined;
    if (sl) parts.push(sl);
    return parts.length ? parts.join(' · ') : undefined;
  };
  // Le mod social FONDU dans la valeur, DÉPLIÉ par source pour le monteur (`dansLaValeur`) : une ligne
  // par Trait psy « contenu » (LDB 21), chacune liée à SA fiche par le producteur (`socialPsychLines`),
  // puis la ligne de Statut (LDB 08). Σ de ces lignes === `socialMod(c)` — la garde d'exactitude du
  // monteur le vérifie à chaque passage.
  // Sous la règle optionnelle `social-status-reaction-roll`, la VALEUR de la ligne de Statut porte le
  // d10 de réaction (annulé 1-2, inversé 9-10) alors que son LIBELLÉ décrit la base RAW : les deux
  // divergent alors — le libellé est celui que la modale affiche déjà en sous-titre (`psychDetail`).
  const socialLines = (c: Combatant): ModLine[] => {
    const lines: ModLine[] = psychMod ? socialPsychLines(c, spec.vsGroups!) : [];
    const st = statusMod ? statusMod(c) : 0;
    if (st) {
      lines.push({
        label: statusCharmLabel(actorStatus(c), tgtStatus!, { begging: spec.begging }) ?? 'Statut',
        value: st,
        famille: 'jet',
        ref: RULE_REF.statut,
      });
    }
    return lines;
  };
  // `opts.actorId` RESTREINT le Test à UN acteur précis (ex. le Personnage qui prend l'Action « Diriger
  //  l'équipe » — le porteur du Talent, pas le meilleur du groupe) ; sinon le meilleur PJ (partyBest).
  const restrictId = opts?.actorId;
  const best = restrictId
    ? (() => { const a = get().party.find((c) => c.id === restrictId && !c.dead); return a ? { actor: a } : null; })()
    : partyBest(get().party, spec.skill?.id, spec.characteristic, socialMod, spec.skill?.spec);
  if (!best) return false;
  const baseDifficulty = spec.difficulty ?? 'intermediaire';
  const eased = !!spec.easierIf && get().party.some((c) => !c.dead && (
    (!!spec.easierIf!.hasSkill && actorHasSkill(c, spec.easierIf!.hasSkill.id, spec.easierIf!.hasSkill.spec)) ||
    (!!spec.easierIf!.hasTalent && hasTalent(c, spec.easierIf!.hasTalent))
  ));
  const difficulty = eased ? easeDifficulty(baseDifficulty, spec.easierIf!.steps ?? 1) : baseDifficulty;
  // L'allègement se NOMME : la difficulté affichée porte ce qui l'a permise (compétence ou talent
  // présent dans le groupe), au lieu d'une difficulté plus douce sans origine lisible.
  const easedBy = eased
    ? (spec.easierIf!.hasSkill
      ? refLabel('skills', { id: spec.easierIf!.hasSkill.id, spec: spec.easierIf!.hasSkill.spec })
      : refLabel('talents', { id: spec.easierIf!.hasTalent! }))
    : undefined;
  // Météo maritime ACTIVE (Précipitations, MDG 13 l.187-201) — POINT UNIQUE d'injection des mods
  // d'environnement dans un Test : même malus pour tout le monde (indépendant du candidat), au même
  // titre que le mod social ou le Soutien. `undefined` hors voyage en mer / Test de Caractéristique.
  const env = seaWeatherTestMod(get().travelPlan?.sea, spec.skill?.id, spec.skill?.spec);
  // Canal `surLaCible` du monteur : le malus pèse sur la CIBLE, pas sur la valeur (le pending le porte
  // toujours à part, `envMod`/`envLabel`). Même mod pour tous les candidats — monté une fois. La ligne
  // porte sa fiche : la table de météo maritime (MDG 13) d'où sort la Précipitation.
  const envLines: ModLine[] = env
    ? [{ label: env.label, value: env.mod, famille: 'jet', ref: RULE_REF['meteo-maritime'] }]
    : [];
  // Pool des héros AVEC leur position à jour si un combat est en cours (`battle.combatants` — `party` seule
  // ne porte pas `pos`, LDB 12 l.196 « adjacent »). Même patron que `effectTargets` ci-dessus.
  const battle = get().battle;
  const pool = battle?.combatants ?? get().party;
  // Deux populations DISTINCTES (elles l'étaient sous un seul filtre, ce qui annulait le Soutien dès
  // qu'un acteur était imposé) : `living` = qui peut SOUTENIR (LDB 12 l.187-200 — le meneur imposé ou
  // non, les autres membres capables l'assistent) ; `runners` = qui peut LANCER (restreint par
  // `opts.actorId`). Un Test qu'on ne peut pas soutenir se déclare `noSupport` (l.197), il ne se
  // dérive pas de la restriction du lanceur.
  const living = pool.filter((c) => c.kind === 'hero' && !c.dead);
  const runners = restrictId ? living.filter((c) => c.id === restrictId) : living;
  const candidates = runners.map((actor) => {
    // Soutien (LDB 12 l.187-200) : si CET acteur mène, les AUTRES membres capables l'assistent (+10, plafond
    // Bonus de Carac). Calculé par candidat car le sélecteur laisse le joueur choisir qui lance. `noSupport`
    // (l.197 : maladie/poison/peur/danger) coupe le Soutien à la source ; adjacence (l.196), gate GÉOMÉTRIQUE
    // via `combatDistance`, active quand `actor.pos` est posé (combat en cours).
    const soutD = spec.noSupport ? null : soutienDetail(living, actor, spec.skill?.id, spec.characteristic, spec.skill?.spec,
      battle && actor.pos ? (c) => !!c.pos && combatDistance(actor, c) <= 1 : undefined);
    const sout = soutD?.bonus ?? 0;
    // `spec.sense` (vue/ouïe, LDB 18) restreint le malus de Surdité au seul Test de Perception auditif — le
    // Soutien (`sout`, plafonné au Bonus de Carac du meneur) et le mod social ne dépendent pas du sens.
    const social = socialMod ? socialMod(actor) : 0;
    const value = testValue(actor, spec.skill?.id, spec.characteristic, spec.skill?.spec, spec.sense) + social + sout;
    // Objet catalogué → match par `trappingId` STABLE (id, jamais le libellé).
    const tool = spec.tool ? actor.items?.find((i) => i.trappingId === spec.tool && !i.destroyed) : undefined;
    // Ligne montée par le MONTEUR CANONIQUE (`rollSeam.rollStep`) : la valeur FONDUE se déclare avec ses
    // poches — Soutien (LDB 12), mod social FONDU (`dansLaValeur`, LDB 21 / LDB 08) — et la météo pèse
    // sur la cible. Sa garde d'exactitude juge que cette valeur se reconstruit depuis le Niveau de
    // Compétence nu ; la cible et l'écrêtage en dérivent par la MÊME primitive que `rollTest`.
    const line = rollStep({
      actor,
      test: { skill: spec.skill?.id, char: spec.characteristic, spec: spec.skill?.spec, sense: spec.sense },
      difficulty,
      valeur: value,
      ...(soutD ? { soutien: soutD } : {}),
      ...(social ? { dansLaValeur: socialLines(actor) } : {}),
      ...(envLines.length ? { surLaCible: envLines } : {}),
    });
    return {
      id: actor.id, label: actor.label, value,
      // La LIGNE MONTÉE voyage avec le candidat : base NUE + lignes nommées telles que le monteur les
      // a émises (famille et fiche comprises). L'affichage n'a plus rien à recomposer.
      base: line.base, ...(line.mods ? { mods: line.mods } : {}),
      target: line.target, ...(line.clamped != null ? { clamped: line.clamped } : {}),
      psychMod: social || undefined,
      psychDetail: socialDetail(actor),
      itemUid: tool?.uid,
      // Détail du Soutien de CE candidat (il change avec le meneur : le plafond est celui de SA
      // Caractéristique) — porté pour l'affichage, la valeur reste soutenue.
      support: soutD && soutD.bonus > 0 ? soutD : undefined,
    };
  });
  const def = candidates.find((c) => c.id === best.actor.id) ?? candidates[0];
  if (!def) return false;
  // Compétence/Caractéristique RÉELLE (cadre de jet) ≠ intitulé de situation (titre). Char → libellé long.
  const skill = spec.skill ? refLabel('skills', spec.skill) : (spec.characteristic ? CHAR_LABELS[spec.characteristic] : undefined);
  const label = spec.label || skill || 'Test';
  set({
    pendingTest: {
      actorId: def.id, actorName: def.label, label, skill, skillValue: def.value, difficulty,
      skillId: spec.skill?.id, spec: spec.skill?.spec, char: spec.characteristic, // réf structurée pour talentTestSLBonus (LDB 10)
      requireSL: spec.requireSL ?? 0, target: def.target, clamped: def.clamped, base: def.base, mods: def.mods, psychMod: def.psychMod, psychDetail: def.psychDetail,
      itemUid: def.itemUid, isDouble: false, roll: null, success: false, sl: 0,
      support: def.support, easedBy,
      envMod: env?.mod, envLabel: env?.label,
      capriciousRoll, capriciousDR: capDR || undefined,
      onSuccess, onFailure, after,
      candidates: candidates.length > 1 ? candidates : undefined,
      ...(opts?.noOwnTestFailed ? { noOwnTestFailed: true } : {}),
      ...(opts?.combatAdvantage ? { combatAdvantage: opts.combatAdvantage } : {}),
      ...(opts?.cancellable ? { cancellable: true } : {}),
      ...(opts?.subi ? { subi: opts.subi } : {}),
    },
  });
  // « Une situation = une modale » : le Test EST une cascade à une étape `jet:'test'`, rendue par
  // `CascadeModal` (via `useTestJetProps`). `pendingTest` coexiste comme porteur de données (comme
  // `pendingAttack` pour l'attaque) ; `resolveTest` ferme les deux. Pas d'applier : la conséquence
  // (branche onSuccess/onFailure + continuation) est lancée par `resolveTest`.
  // ENJEU (#1117) : `FlowTest.stake` DESCEND sur l'étape qui lance — c'est elle que `CascadeModal` lit.
  // Second transporteur du champ, à parité avec les deux fabriques de `combat/triggeredTest.ts` : sans
  // lui, tout Flow joué par `runFlow` (Escalade, Saut, Récolte…) porterait un enjeu que rien n'affiche.
  const jet = hostStep(get, { id: idDansLaSequence(get, 'test-jet', 'test'), kind: 'sceneTestJet', jet: 'test', actorId: def.id, ...(spec.stake ? { stake: spec.stake } : {}) });
  if (!jet) return false; // le mint ne refuse QUE si `pendingTest` manque — rien à défaire, il vient d'être posé
  openSequence(get, set, { title: label, icon: 'nav/dice', purpose: 'test', steps: [jet] });
  return true;
}

/**
 * Exécute un Flow (logique authorée : séquence/branches/Test) — SOURCE UNIQUE. `do` accumule les
 * Effets et les applique en lot (butin attribuable via `applyEffectsLoot`) ; `if` vide d'abord le lot
 * (la condition lit l'état VIVANT — flags/horloge — donc après les Effets émis) puis branche ; `test`
 * vide le lot, ouvre la modale et SUSPEND — la branche choisie + la continuation (reste de la pile)
 * sont reprises par `resolveTest`. Pas de boucle → terminaison garantie.
 *
 * Rend `OPS_DIFFEREES` (#1508) quand un lot a ouvert un dé à la porte : la pile RESTANTE lui a été
 * confiée, et l'appelant n'a plus rien à jouer. CHAQUE vidange du lot est un point d'application, donc
 * chacune consulte le signal — le `if` et le `test` compris, dont le NŒUD COURANT n'est pas encore
 * consommé et repart en tête de la continuation (il branchera quand le dé sera tombé, sur l'état que
 * la conséquence aura produit).
 */
export function runFlow(get: Get, set: SetFn, flow: Flow, label: string = t('eff.flowTitle'), sl?: number): Applique {
  const stack: Flow[] = [flow];
  const batch: Effect[] = [];
  const flush = (): Applique => (batch.length ? applyEffectsLoot(get, set, batch.splice(0), label, sl) : undefined);
  /** Le lot vient d'ouvrir un dé : `node` (non consommé) et le reste de la pile deviennent SA suite. */
  const confier = (node?: Flow): Applique => {
    differerLaSuite(set, { kind: 'seq', steps: [...(node ? [node] : []), ...stack.splice(0)] }, 'scene', label);
    return OPS_DIFFEREES;
  };
  while (stack.length) {
    const node = stack.shift()!;
    switch (node.kind) {
      case 'do':
        batch.push(node.effect);
        break;
      case 'seq': stack.unshift(...node.steps); break;
      case 'if': {
        if (flush()) return confier(node);
        const branch = evalCondition(node.cond, condCtx(get)) ? node.then : node.else;
        if (branch) stack.unshift(branch);
        break;
      }
      case 'test': {
        if (flush()) return confier(node);
        const after: Flow = { kind: 'seq', steps: stack.splice(0) };
        // Personne ne peut tenter → on saute le Test et on reprend directement la continuation.
        if (!openSkillTest(get, set, node.test, node.success, node.fail, after)) return runFlow(get, set, after, label, sl);
        return undefined;
      }
    }
  }
  // Vidange FINALE : la pile est vide, il n'y a plus de suite à confier — le signal est rendu tel quel
  // à l'appelant, à qui de décider (c'est lui qui sait s'il enchaîne quelque chose).
  return flush();
}

/**
 * Walker PUR d'un Flow d'EFFET DÉCLENCHÉ (traits/talents/atouts/États/psychologie/manœuvres/Attributs de
 * Domaine — JAMAIS les sorts, qui passent par `runCastFlow`→`runCombatFlow`) : exécute `seq`/`do`/`if`
 * contre une CIBLE (et le lanceur/porteur pour les feuilles `on:'caster'`), accumulant son journal dans
 * un `string[]` RENDU, sans `get`/`set`. Couvre la Condition `compare` lue sur `target`/`caster` +
 * `sl`/`location`/`woundsDealt`/`attackKind` du contexte d'incantation.
 *
 * GARDE-FOU anti-jet-silencieux (calque `flattenFlow:280`) : un nœud `test` LÈVE — un Test EN COMBAT est
 * interactif/cadence-aware (étape de cascade ou jet inline avec branche honorée), résolu par
 * `resolveFlowTest`/`runCombatFlow`, JAMAIS en avalant la branche succès. Les sites de ce module sont
 * PROUVÉS sans nœud `test` au 1ᵉʳ niveau (un trigger `test` top-level est routé en amont par `testRouter`,
 * une branche de Test n'en contient pas) ; si un `test` enfoui apparaît un jour (Lot 4), l'erreur le rend
 * détectable au lieu de redevenir un jet silencieux. MÊME doctrine pour une op qui DEMANDE UN DÉ
 * (#1508) : sa magnitude s'ouvre à la porte (`applyLeafOps`/`ouvrirChute`), et `applyOps` la tirerait
 * ici en silence — un `fall` authoré sur un passif/trait y perdait ses deux dés. */
export function runPureFlowLines(target: Combatant, caster: Combatant | undefined, flow: Flow, ctx: OpsCtx): string[] {
  if (flowHasOpADe(flow)) throw new Error('runPureFlowLines: une op à DÉ ouvre sa magnitude à la porte — utiliser applyLeafOps/runCombatFlow.');
  const lines: string[] = [];
  const walk = (f: Flow): void => {
    switch (f.kind) {
      case 'seq': f.steps.forEach(walk); break;
      case 'do':
        if (f.effect.type === 'ops') {
          const unit = f.effect.on === 'caster' ? caster : target;
          // Contexte de FEUILLE (`leafOpsCtx`) : untilTime/label bakés (consommable) priment sur le ctx
          // appelant. Les ops IMPURES (`delayed`…) sont routées en amont vers runCombatFlow (flowHasImpureOp).
          if (unit) lines.push(...applyOps(unit, f.effect.ops, leafOpsCtx(ctx, f.effect)));
        }
        break;
      case 'if':
        // Condition `compare` : `target` = la cible du sous-Flow, `caster` = le lanceur/porteur.
        // `location`/`woundsDealt` : contexte de la touche courante (Assommante Tête, Venin sur PB).
        if (evalCondition(f.cond, { flags: {}, gameTime: ctx.now ?? 0, party: [target], sl: ctx.sl,
          location: ctx.location, woundsDealt: ctx.woundsDealt, engagedAdvantageGap: ctx.engagedAdvantageGap, engagedAdvantageLead: ctx.engagedAdvantageLead, foeInLoS: ctx.foeInLoS,
          hiddenFromFoes: ctx.hiddenFromFoes, engaged: ctx.engaged, nearestFoeDist: ctx.nearestFoeDist,
          attackKind: ctx.attackKind, startleCause: ctx.startleCause, target: buildActorView(target), caster: buildActorView(caster) })) walk(f.then);
        else if (f.else) walk(f.else);
        break;
      case 'test':
        throw new Error('runPureFlowLines: un nœud `test` est cadence-aware — utiliser runCombatFlow/resolveFlowTest.');
    }
  };
  walk(flow);
  return lines;
}

/**
 * Environnement d'exécution d'un Effet : l'état (get/set) + les helpers FACTORISÉS du switch d'origine.
 * `mutateHero` capture le motif RÉPÉTÉ « héros désigné par heroId, sinon une cible par défaut → clone →
 * muter le party » (7 cas) ; `targets` = `effectTargets` (cibles party/hero, file de combat ou groupe) ;
 * `log`/`pushReveal` = raccourcis. Aucune logique de domaine ici (chaque conséquence vit dans son handler).
 */
export interface EffectEnv {
  get: Get;
  set: SetFn;
  log(line: string): void;
  pushReveal(entry: RevealEntry): void;
  /** DR (SL) du Test résolu qui a produit ce lot d'Effets (`resolveTest`/`pt.sl`, symétrique de
   *  `opsCtx.sl` en combat, `triggeredTest.ts:159`) — absent hors Test (déclencheur de scène, etc.). */
  sl?: number;
  /** Cibles d'un effet `party`/`hero` (héros vivants concernés, bon ensemble) — `effectTargets`. */
  targets(on: 'party' | 'hero', heroId?: string): Combatant[];
  /**
   * Applique `mutate` au héros choisi (heroId, sinon `pick`/le premier vivant) et renvoie l'ORIGINAL
   * muté (pour le journal). `mutate(hero)` renvoie le NOUVEAU héros (immuable) ; renvoyer `hero`
   * inchangé = pas de mutation (le héros reste, ex. maladie déjà présente). `pick(party)` choisit
   * l'index défaut quand `heroId` est absent (−1 = abandon) ; absent → le premier (index 0).
   */
  mutateHero(
    heroId: string | undefined,
    mutate: (hero: Combatant) => Combatant,
    pick?: (party: Combatant[]) => number,
  ): Combatant | null;
}

function makeEffectEnv(get: Get, set: SetFn, sl?: number): EffectEnv {
  return {
    get,
    set,
    sl,
    log: (line) => get().log(line),
    pushReveal: (entry) => pushReveal(set, entry),
    targets: (on, heroId) => effectTargets(get, on, heroId),
    mutateHero: (heroId, mutate, pick) => {
      let chosen: Combatant | null = null;
      set((s: GameState) => {
        if (!s.party.length) return {};
        const idx = heroId
          ? s.party.findIndex((h) => h.id === heroId)
          : pick
            ? pick(s.party)
            : 0;
        if (idx < 0) return {};
        chosen = s.party[idx];
        return { party: s.party.map((h, i) => (i === idx ? mutate(h) : h)) };
      });
      return chosen;
    },
  };
}

/** Issue de l'`apply` d'un handler : `'suspend'` STOPPE la boucle `applyEffects` (l'effet a ouvert une
 *  modale/pending qui reprend la suite — extendedTest, forceDoor) ; sinon (void) la boucle continue. */
type EffectApplyResult = void | 'suspend';

/** Contexte de validation des réfs d'un effet (id-sets de la scène/projet + bornes de la carte). Fourni
 *  par `validateScene` ; `refs` produit des avertissements génériques (sans scope/refId — re-décorés par
 *  l'appelant), ce qui co-localise la validation d'un effet AVEC son application (fin du switch parallèle). */
export interface EffectRefCtx {
  sceneIds: ReadonlySet<string>;
  dialogueIds: ReadonlySet<string>;
  encounterIds: ReadonlySet<string>;
  /** Entités `personnage` de la scène — les PNJ qu'un effet peut désigner (soigneur…). */
  entityIds: ReadonlySet<string>;
  /** LA FICHE derrière une entité `personnage`, par la MÊME projection que le runtime (`sceneNpc`) —
   *  un handler peut ainsi exiger une COMPÉTENCE du PNJ désigné, pas seulement son existence. Fourni
   *  comme `within` : une fonction du contexte, jamais un canal parallèle vers la scène. */
  npcSheet(id: string): Combatant | undefined;
  within(x: number, y: number): boolean;
}
export interface EffectRefIssue {
  level: 'error' | 'warn';
  message: string;
}

/**
 * Un effet = UN handler portant TOUTES ses facettes (fin des Records parallèles `EFFECT_LABEL`/
 * `EFFECT_ICON`/`EFFECT_GROUPS`/`newEffect` + du switch `checkEffect`) : son APPLICATION (`apply`), ses
 * métadonnées d'auteur (`label`/`icon`/`group` pour le picker de l'éditeur), sa FABRIQUE par défaut
 * (`make`) et sa VALIDATION de réfs (`refs`). Le RENDU des champs (`EffectFields`) et le `summary`
 * restent dans l'UI (`EffectList`) car ils dépendent de React / `opSummary` (sib. éditeur) : l'inverser
 * tirerait l'UI dans le moteur (cycle). `T` = la variante d'Effet narrowée (apply/make typés sur elle).
 */
export interface EffectHandler<T extends Effect = Effect> {
  /** Groupe d'INTENTION d'auteur (libellé affiché dans le picker « + Effet », cf. `EFFECT_GROUP_ORDER`). */
  group: string;
  /** Libellé long (picker) et icône (rangée repliée). */
  label: string;
  icon: string;
  /** Effet par défaut posé quand l'auteur ajoute ce type. */
  make(): T;
  /** Conséquence appliquée par `applyEffects`. `'suspend'` = stoppe la boucle (modale/pending ouvert). */
  apply(e: T, env: EffectEnv): EffectApplyResult;
  /** Réfs cassées / valeurs invalides. Absent = rien à valider. */
  refs?(e: T, ctx: EffectRefCtx): EffectRefIssue[];
}

/** Noms des maladies câblées (LDB 20) — défaut de la fabrique `inflictDisease.make`. */
const diseaseNames = memoParVersion('maladies', () => Object.keys(diseaseDefs()));

/** Ordre des groupes d'intention dans le picker « + Effet » (l'ordre des handlers ci-dessous donne
 *  l'ordre INTRA-groupe — la déclaration suit l'ancien `EFFECT_GROUPS` aplati). */
export const EFFECT_GROUP_ORDER = [
  'Narration',
  'Récompenses',
  'Afflictions',
  'Temps & repos',
  'Navigation',
  'Combat & social',
  'Tests',
] as const;

/** Mappe chaque `type` d'Effet à son handler narrowé — garantit l'EXHAUSTIVITÉ (tsc échoue si un type
 *  manque) ET le typage par variante de `apply`/`make`/`refs`. */
type EffectHandlerMap = {
  [K in Effect['type']]: EffectHandler<Extract<Effect, { type: K }>>;
};

/** Exécuteur EN COMBAT du flux d'incantation standard (`castSpell`, `state/combatFlow`) pour l'Effet
 *  `castSpell` (#98) — enregistré par `combatFlow` à son chargement : ce module FEUILLE n'importe RIEN
 *  de `combatFlow` (qui, lui, importe CE module). `null` tant qu'aucun appelant ne s'est enregistré. */
let castSpellRunner: ((get: Get, set: SetFn, caster: Combatant, target: Combatant, spellId: string) => void) | null = null;
/** Enregistre l'exécuteur d'incantation EN COMBAT de l'Effet `castSpell` (appelé par `combatFlow`). */
export function registerCastSpellEffect(fn: NonNullable<typeof castSpellRunner>): void {
  castSpellRunner = fn;
}

/**
 * REGISTRE des effets — source unique data-driven (fin du god-switch `applyEffects`). Déclaré dans
 * l'ordre du picker (groupes de `EFFECT_GROUP_ORDER`, ordre intra-groupe = ordre de déclaration).
 */
export const EFFECT_HANDLERS: EffectHandlerMap = {
  // ── Narration ──────────────────────────────────────────────────────────
  journal: {
    group: 'Narration', label: 'Journal', icon: 'journal/detail',
    make: () => ({ type: 'journal', desc: '' }),
    apply: (e, env) => { env.log(e.desc); },
  },
  document: {
    group: 'Narration', label: 'Document (handout)', icon: 'file/document',
    make: () => ({ type: 'document', title: '', desc: '' }),
    apply: (e, env) => { env.set({ document: { title: e.title, text: e.desc } }); },
  },
  revealClue: {
    group: 'Narration', label: 'Révéler un indice (carnet)', icon: 'ui/search',
    make: () => ({ type: 'revealClue', indiceId: '' }),
    apply: (e, env) => {
      const ind = indiceById(e.indiceId);
      if (!ind) { console.warn(`revealClue : indice inconnu « ${e.indiceId} ».`); return; }
      const before = env.get().clues[e.indiceId];
      const clues = revealClue(env.get().clues, ind, env.get().gameTime, e.stade);
      if (clues === env.get().clues) return;
      env.set({ clues });
      const key = before?.statut === 'réfuté' ? 'eff.clueReactivate' : before ? 'eff.clueAdvance' : 'eff.clueReveal';
      env.log(t(key, { titre: ind.titre }));
    },
  },
  discreditClue: {
    group: 'Narration', label: 'Écarter un indice (fausse piste)', icon: 'ui/forbidden',
    make: () => ({ type: 'discreditClue', indiceId: '' }),
    apply: (e, env) => {
      const ind = indiceById(e.indiceId);
      if (!ind) { console.warn(`discreditClue : indice inconnu « ${e.indiceId} ».`); return; }
      const clues = discreditClue(env.get().clues, ind, env.get().gameTime);
      if (clues === env.get().clues) return;
      env.set({ clues });
      env.log(t('eff.clueDiscredit', { titre: ind.titre }));
    },
  },
  startDialogue: {
    group: 'Narration', label: 'Ouvrir un dialogue', icon: 'journal/dialogue',
    make: () => ({ type: 'startDialogue', dialogue: '' }),
    apply: (e, env) => {
      const dlg = env.get().scene?.dialogues.find((d) => d.id === e.dialogue);
      if (dlg) env.set({ dialogue: { dialogue: dlg, nodeId: dlg.start, speakerId: e.speakerId } });
    },
    refs: (e, ctx) => ctx.dialogueIds.has(e.dialogue) ? [] : [{ level: 'error', message: `Effet → dialogue inexistant « ${e.dialogue} »` }],
  },
  endDialogue: {
    group: 'Narration', label: 'Fermer le dialogue', icon: 'ui/close',
    make: () => ({ type: 'endDialogue' }),
    apply: (_e, env) => {
      if (env.get().dialogue) env.get().advanceTime(TIME_COST.dialogue); // clôture d'une conversation ≈ dialogue min
      env.set({ dialogue: null });
    },
  },
  setFlag: {
    group: 'Narration', label: 'Définir un flag', icon: 'map-tool/start-flag',
    make: () => ({ type: 'setFlag', flag: '', value: true }),
    apply: (e, env) => { env.set((s: GameState) => ({ flags: { ...s.flags, [e.flag]: e.value ?? true } })); },
  },
  setObjective: {
    group: 'Narration', label: 'Objectif courant (« je fais quoi maintenant ? »)', icon: 'map-tool/start-flag',
    make: () => ({ type: 'setObjective', id: '', desc: '' }),
    apply: (e, env) => {
      // Pile keyée par id STABLE : re-poser le même id MET À JOUR le texte (et le remonte en tête), sinon
      // AJOUTE en fin (le plus récent = surface HUD). #238 « personne ne lit le journal » → archivé aussi.
      const hasSched = e.afterMinutes != null || e.afterDays != null || e.atDate != null || e.atHour != null || e.atMinute != null;
      const deadline = hasSched ? scheduleAt(env.get().gameTime, e) : undefined;
      env.set((s: GameState) => {
        const rest = s.objectives.filter((o) => o.id !== e.id);
        return { objectives: [...rest, { id: e.id, text: e.desc, deadline }] };
      });
      env.log(t('eff.objectiveSet', { text: e.desc }));
    },
  },
  clearObjective: {
    group: 'Narration', label: 'Retirer un objectif', icon: 'ui/close',
    make: () => ({ type: 'clearObjective' }),
    apply: (e, env) => {
      const before = env.get().objectives;
      const done = e.id ? before.find((o) => o.id === e.id) : undefined;
      // Solder un objectif l'ARCHIVE (`objectifsSoldes`, #717) : même objet, keyage par id STABLE
      // (re-solder le même id ne le compte pas deux fois). Cette archive est la SEULE dont le récap
      // de fin de chapitre dérive sa chronique — le journal, lui, est une fenêtre glissante de 40.
      env.set((s: GameState) => {
        const soldes = e.id ? (done ? [done] : []) : before;
        const dejaLa = new Set(s.objectifsSoldes.map((o) => o.id));
        return {
          objectives: e.id ? s.objectives.filter((o) => o.id !== e.id) : [],
          objectifsSoldes: [...s.objectifsSoldes, ...soldes.filter((o) => !dejaLa.has(o.id))],
        };
      });
      env.log(done ? t('eff.objectiveDone', { text: done.text }) : t('eff.objectiveClearAll'));
    },
  },
  setLight: {
    group: 'Narration', label: 'Lumière de scène (les lumières baissent / se rallument)', icon: 'scene/light',
    make: () => ({ type: 'setLight', level: 0.3 }),
    apply: (e, env) => { env.set({ lightLevel: Math.max(0, Math.min(1, e.level)) }); }, // mise en scène (Lot L) : niveau borné [0,1]
  },
  setDoor: {
    group: 'Narration', label: 'Porte (ouvrir / fermer — bloque vue et passage)', icon: 'map-tool/door',
    make: () => ({ type: 'setDoor', x: 0, y: 0, side: 'N', open: true }),
    apply: (e, env) => { env.set((s: GameState) => (s.scene ? { scene: setDoorOpen(s.scene, e.x, e.y, e.side, e.z ?? 0, e.open) } : {})); },
  },
  moveEntity: {
    group: 'Narration', label: 'Déplacer / retirer une entité (mise en scène : fuite, entrée, disparition)', icon: 'travel/foot',
    make: () => ({ type: 'moveEntity', id: '' }),
    apply: (e, env) => {
      const sc = env.get().scene;
      if (!sc) return;
      const ent = sc.entities.find((x) => x.id === e.id);
      if (!ent) return; // entité introuvable → no-op
      if (e.to) env.set({ scene: { ...sc, entities: sc.entities.map((x) => (x.id === e.id ? { ...x, pos: { x: e.to!.x, y: e.to!.y }, z: e.to!.z ?? x.z } : x)) } });
      if (e.remove) removeEntity(env.get, env.set, e.id); // APRÈS le repositionnement (fuite-puis-disparition)
    },
  },
  playSfx: {
    group: 'Narration', label: 'Son ponctuel (cloche, cri hors-champ…)', icon: 'audio/volume',
    make: () => ({ type: 'playSfx', id: '' }),
    // Coop : `applyEffects` tourne côté HÔTE (hôte-autoritaire) — ce son ponctuel scripté ne
    // joue que chez l'hôte, pas de réplication audio à l'invité dans ce lot. `moveEntity`
    // (changement d'état) se réplique gratis par le snapshot hôte.
    apply: (e) => { playSfx(e.id); },
  },

  // ── Récompenses ────────────────────────────────────────────────────────
  giveTrapping: {
    group: 'Récompenses', label: 'Donner un objet (équipement/potion/babiole — réel ou custom)', icon: 'item/misc',
    make: () => ({ type: 'giveTrapping', custom: '' }),
    apply: (e, env) => {
      // Objet de CATALOGUE (`trappingId`) sinon objet CUSTOM (`custom`, misc) — source unique itemFromGive.
      // Résolveur campagne-D'ABORD (`campaignData.trappingById`) : un objet de `narratif.objets` gagne (#767).
      const it = itemFromGive(e, undefined, trappingById);
      // Butin MAGIQUE (optionnel) : qualités ajoutées, objet non identifié (qualités masquées jusqu'à
      // Évaluation, #2), skin légendaire. Les qualités restent ACTIVES mécaniquement (registre).
      it.qualities = withGiveQualities(it.qualities, e); // def du catalogue + magiques (ids de scène)
      if (e.identified === false) it.identified = false;
      if (e.skin) it.skin = e.skin;
      if (e.magicKnown) it.magicKnown = true; // aura détectée en fenêtre de loot → suit l'objet
      if (e.detectTried) it.detectTried = true;
      if (e.appraiseTriedDay != null) it.appraiseTriedDay = e.appraiseTriedDay;
      if (e.price) it.price = { gold: e.price.gold ?? 0, silver: e.price.silver ?? 0, brass: e.price.brass ?? 0 };
      const who = env.mutateHero(e.heroId, (h) => {
        const clone: Combatant = structuredClone(h);
        clone.items = [...(clone.items ?? []), it]; // arrive NON équipé
        autoStowNewItem(clone, it); // #204 : rangement par défaut (contenant avec le plus de place libre)
        recomputeLoadout(clone); // met à jour l'encombrement
        return clone;
      });
      env.log(who ? t('eff.recover', { name: who.label, item: it.label }) : t('eff.recoverSansHeros', { item: it.label }));
    },
  },
  givePossession: {
    group: 'Récompenses', label: 'Donner une possession (bête/serviteur/véhicule)', icon: 'item/misc',
    make: () => ({ type: 'givePossession', nature: 'bete', ref: { creatureId: creatureSemee() } }),
    apply: (e, env) => {
      const owner = env.mutateHero(e.heroId, (h) => h); // pas de mutation : choisit seulement le propriétaire
      if (!owner) return;
      // `nature`/`ref` corrélés par construction de l'Effet (vehicule ⟺ {vehicleId}, sinon LivingRef) —
      // l'union discriminée de `Possession` ne se reconstruit pas depuis 2 champs plats sans assertion.
      const input = (
        e.nature === 'vehicule'
          ? { nature: 'vehicule', vehicleId: (e.ref as { vehicleId: string }).vehicleId, ownerId: owner.id, location: { kind: 'avec-le-groupe' }, items: [] }
          : { nature: e.nature, ref: e.ref as LivingRef, ownerId: owner.id, location: { kind: 'avec-le-groupe' }, items: [] }
      ) as unknown as PossessionInput;
      const uid = addPossession(env.get, env.set, input);
      env.log(t('eff.recover', { name: owner.label, item: possessionLabel({ ...input, uid } as Possession) }));
    },
    // La bête ou le serviteur donné est une RÉFÉRENCE : sa fiche (monture de combat, `spawnEnemy`) s'y lit (#1882).
    refs: (e) => {
      const r = e.ref;
      if ('creatureId' in r && !findCreatureById(r.creatureId)) return [{ level: 'error', message: `Possession → créature inexistante « ${r.creatureId || '(aucune)'} »` }];
      if ('vehicleId' in r && !findVehicleById(r.vehicleId)) return [{ level: 'error', message: `Possession → véhicule inexistant « ${r.vehicleId || '(aucun)'} »` }];
      return [];
    },
  },
  giveMoney: {
    group: 'Récompenses', label: 'Donner/retirer de l’argent', icon: 'resource/gold-purse',
    make: () => ({ type: 'giveMoney', montant: { gold: 0, silver: 0, brass: 0 } }),
    apply: (e, env) => {
      // Argent de GROUPE sans bénéficiaire unique : positif = butin/récompense réparti PAR TÊTE
      // (`distributeCredit`) ; négatif = perte SCRIPTÉE — `drainGroup` (glouton PLAFONNÉ, jamais
      // esquivée par le tout-ou-rien de `payFromGroup` : une perte > total du groupe vide tout à 0).
      const m = e.montant;
      const net = toBrass(toMoney(m));
      if (net > 0) distributeCredit(env.get, env.set, fromBrass(net));
      else if (net < 0) drainGroup(env.get, env.set, fromBrass(-net));
      const parts = [m.gold && t('eff.coin.gold', { n: m.gold }), m.silver && t('eff.coin.silver', { n: m.silver }), m.brass && t('eff.coin.brass', { n: m.brass })].filter(Boolean); // noms canon FR (couronne/pistole/sou)
      if (parts.length) env.log(t('eff.purse', { sign: (m.gold ?? 0) < 0 || (m.silver ?? 0) < 0 ? '' : '+', parts: parts.join(' ') }));
    },
  },
  giveXp: {
    group: 'Récompenses', label: 'Donner des PX (groupe)', icon: 'resource/xp',
    make: () => ({ type: 'giveXp', amount: 50 }),
    apply: (e, env) => {
      env.set((s: GameState) => ({
        party: s.party.map((h) => {
          const clone: Combatant = structuredClone(h);
          clone.xp = (clone.xp ?? 0) + e.amount;
          return clone;
        }),
      }));
      env.log(t('eff.xp', { amount: e.amount }));
    },
  },
  learnSpell: {
    group: 'Récompenses', label: 'Apprendre un sort (trouvaille, sans PX)', icon: 'magic/power',
    make: () => ({ type: 'learnSpell', spell: '', heroId: '' }),
    apply: (e, env) => {
      // Trouvaille de campagne : le sort est appris SANS PX (l'auteur l'octroie — le coût
      // en PX ne vaut que pour la mémorisation volontaire, LDB 46 l.16-20).
      const sp = findSpellById(e.spell);
      if (!sp) return;
      // `c.spells` = IDS de sort (résolus par findSpellById dans la console/IA/grimoire) ; le libellé
      // ne sert qu'à l'affichage (log ci-dessous). Même convention que pregens/buySpell/Béni.
      // LDB 46 l.14 — #1702 : MÊME garde que `buySpell` (`spellCost` null = déjà connu ou Talent
      // manquant), héros NOMMÉ ou repli ; `mutateHero` rend l'ORIGINAL, d'où la relecture du prédicat.
      const learnable = (h: Combatant) => spellCost(h, sp) != null;
      const who = env.mutateHero(
        e.heroId,
        (h) => (learnable(h) ? { ...h, spells: [...(h.spells ?? []), sp.id] } : h),
        (party) => party.findIndex(learnable),
      );
      // `heroId` authoré hors du groupe : le motif est l'ID, jamais l'éligibilité du groupe.
      if (!who) env.log(e.heroId ? t('eff.heroUnknown', { id: e.heroId }) : t('eff.learnSpellNoOne', { spell: sp.label }));
      else if (!learnable(who)) env.log(t('pf.spellCannotLearn', { name: who.label, spell: sp.label }));
      else env.log(t('eff.learnSpell', { name: who.label, spell: sp.label }));
    },
  },
  petitePriere: {
    group: 'Récompenses', label: 'Petites Prières (site sacré — non-Béni, LDB 25)', icon: 'faith/prayer',
    make: () => ({ type: 'petitePriere', reward: EMPTY_FLOW }),
    apply: (e, env) => {
      // « Petites Prières » (LDB 25 l.22-24, option `prayer-petites`) : un NON-Béni prie dans un site
      // sacré → 1d100 secret, exaucé sur 01 (pourcentage relevé s'il a la Compétence Prière).
      if (!rule('prayer-petites')) return; // option désactivée → ignorée
      const pool = env.get().party;
      const isBeni = (h: Combatant) => h.talents.some((t) => t.talentId === 'beni' && (t.times ?? 1) >= 1);
      const target = e.heroId
        ? pool.find((h) => h.id === e.heroId && !h.dead)
        : pool.find((h) => !h.dead && !isBeni(h));
      if (!target) return;
      // Un Bienheureux prie NORMALEMENT (Miracle/Bénédiction) — les Petites Prières sont la voie des
      // non-Bénis (LDB 25 l.24).
      if (isBeni(target)) {
        env.log(t('eff.petitePriereBeni', { name: target.label }));
        return;
      }
      // Seuil : « exaucé sur 01 » ; LDB 25 l.22-24 — silence, valeur maison (règle
      // `prayer-petites-bonus-per-advance`) pour le « le MJ peut augmenter ce pourcentage ».
      const priereAdv = target.skills.find((sk) => sk.id === 'priere')?.advances ?? 0;
      const threshold = 1 + Math.max(0, priereAdv) * Number(rule('prayer-petites-bonus-per-advance'));
      const roll = d100(battleRng());
      if (petitePriereAnswered(roll, threshold)) {
        env.log(t('eff.petitePriereOk', { name: target.label, roll, threshold }));
        jouerFlowEntier(runFlow(env.get, env.set, e.reward, t('eff.petitePriereReward'))); // récompense authorée (bonus/don/flag)
      } else {
        env.log(t('eff.petitePriereKo', { name: target.label, roll }));
      }
    },
  },
  sessionEnd: {
    group: 'Récompenses', label: 'Fin de séance (Ambitions/Motivation — LDB 05/17)', icon: 'journal/detail',
    make: () => ({ type: 'sessionEnd' }),
    apply: (_e, env) => { env.get().openSessionEnd(); }, // ouvre l'écran de fin de séance existant (SessionEndModal → endSession)
  },
  openCharacterCreator: {
    group: 'Récompenses', label: 'Créer un personnage (assistant)', icon: 'ui/add',
    make: () => ({ type: 'openCharacterCreator' }),
    apply: (_e, env) => { env.get().setEditingHero(null); env.get().setScreen('creator'); }, // assistant existant (src/ui/creator), nouveau héros
  },
  restoreFortune: {
    group: 'Récompenses', label: 'Regagner la Chance (début de session, max = Destin)', icon: 'resource/fortune',
    make: () => ({ type: 'restoreFortune' }),
    apply: (_e, env) => {
      // Début de session (LDB 17 l.41) : Chance regagnée jusqu'au maximum = Destin actuel.
      env.set((s: GameState) => ({ party: restoreFortune(s.party) }));
      env.log(t('eff.restoreFortune'));
    },
  },
  grantFavor: {
    group: 'Récompenses', label: 'Accorder une Faveur due (LDB 23 l.139-153)', icon: 'ui/balance',
    make: () => ({ type: 'grantFavor', level: 'mineure', owedTo: '', desc: '' }),
    apply: (e, env) => {
      // Faveur de départ de campagne ou octroi narratif (#509) — cible : héros désigné, sinon le
      // premier héros vivant (`env.targets` : même défaut que les autres Effets `hero`).
      const hero = env.targets('hero', e.heroId)[0];
      if (hero) env.get().favorGrant(hero.id, e.level, e.owedTo, e.desc);
    },
  },

  // ── Afflictions ────────────────────────────────────────────────────────
  ops: {
    group: 'Afflictions', label: 'Effets mécaniques (Blessures / État / buffs… — vocabulaire des sorts)', icon: 'mechanic/stat-mod',
    make: () => ({ type: 'ops', on: 'party', ops: [{ op: 'wounds', amount: 5 }] }),
    apply: (e, env) => {
      // EffectOp : applique les GameOps (vocabulaire mécanique des sorts) à la cible de SCÈNE
      // (`party`/`hero`, défaut `party`). `applyLeafOps` = SOURCE UNIQUE : contexte de FEUILLE
      // (untilTime/label bakés par un consommable — la branche d'un `test` suspendu garde sa durée)
      // + programmation des ops `delayed`.
      const on = e.on ?? 'party';
      if (!estCibleDeScene(on)) throw new Error(messageCibleHorsScene(e, on));
      const targets = env.targets(on, e.heroId);
      if (!targets.length) return;
      // Une cible dont la feuille part à la PORTE (#1508) n'a pas de ligne ICI : sa conséquence se dit
      // à la résolution de son dé. Les autres s'appliquent normalement, dans l'ordre des cibles.
      const lines: string[] = [];
      for (const c of targets) {
        const issue = applyLeafOps(env.get, env.set, c, e, { rng: defaultRNG, sl: env.sl, onCorruption: (n, align) => gainCorruption(env.get, env.set, c, n, align) });
        if (issue !== OPS_DIFFEREES) lines.push(...issue);
      }
      env.set(touchActors(env.get()));
      lines.forEach((l) => env.log(l));
    },
    // Un contenu de scène fautif se refuse dans l'ÉDITEUR (`validateScene`), avec le MÊME message
    // que la levée du marcheur.
    refs: (e) => {
      const on = e.on ?? 'party';
      return estCibleDeScene(on) ? [] : [{ level: 'error', message: messageCibleHorsScene(e, on) }];
    },
  },
  zoneBlast: {
    group: 'Afflictions', label: 'Souffle de zone (effets mécaniques, rayon)', icon: 'magic/area',
    make: () => ({ type: 'zoneBlast', center: { x: 0, y: 0 }, radius: 2, ops: [{ op: 'wounds', amount: { dice: { n: 1, sides: 10, plus: 15 } } }] }),
    apply: (e, env) => {
      // Cibles dans le disque (Chebyshev, `combatantsWithinRadius`) : en combat par position de chaque
      // combattant ; hors combat, le groupe entier est à partyPos. Chaque cible encaisse les `ops`
      // (vocabulaire unique, jet PAR cible pour les Dégâts à dés) via `applyOps`.
      const inBattle = !!env.get().battle;
      const pp = env.get().partyPos;
      // Hors combat : on positionne virtuellement les héros à partyPos pour la géométrie d'aire partagée.
      const pool: Combatant[] = inBattle
        ? env.get().battle!.combatants
        : env.get().party.filter((c) => c.kind === 'hero').map((c) => ({ ...c, pos: pp }));
      // `Effect.zoneBlast.center` n'authore que `{x,y}` (pas d'étage éditable) — hors combat, le pool
      // entier est virtuellement à `pp` (ligne ci-dessus) : le centre du souffle DOIT porter le même
      // étage que `pp`, sinon le défaut z-aware de `combatantsWithinRadius` (`center.z ?? 0`) exclut
      // le groupe dès que `pp.z` n'est pas 0 (bombe posée à l'étage, #opera). En combat, le centre
      // reste tel qu'authoré (les combattants réels portent chacun leur propre étage).
      const center = inBattle ? e.center : { ...e.center, z: pp.z };
      const targets = combatantsWithinRadius(center, e.radius, pool, (c) => !c.dead);
      if (!targets.length) return;
      // Hors combat, `applyOps` a muté les CLONES → on ré-applique aux héros réels par id.
      const lines = targets.flatMap((c) => {
        const real = inBattle ? c : env.get().party.find((h) => h.id === c.id) ?? c;
        return applyOps(real, e.ops, { rng: battleRng() });
      });
      env.set(touchActors(env.get()));
      env.log(t('eff.blast', { lines: lines.join(' · ') }));
    },
    refs: (e, ctx) => {
      const out: EffectRefIssue[] = [];
      if (!ctx.within(e.center.x, e.center.y)) out.push({ level: 'warn', message: `Souffle de zone : centre (${e.center.x},${e.center.y}) hors de la carte` });
      if (!e.ops?.length) out.push({ level: 'error', message: `Souffle de zone : aucun effet mécanique` });
      if (e.radius < 0) out.push({ level: 'error', message: `Souffle de zone : rayon négatif` });
      return out;
    },
  },
  fall: {
    group: 'Afflictions', label: 'Chute (dégâts/m + 1d10, À Terre, repositionne le groupe)', icon: 'journal/fall',
    make: () => ({ type: 'fall', target: 'party', metres: 4 }),
    apply: (e, env) => {
      // Chute (LDB 15 l.80-84) : 3 Dégâts/mètre + 1d10, réduits par le Bonus d'Endurance mais
      // PAS par les PA ; si les Blessures subies > BE → État À Terre. `to` repose le groupe (hors
      // combat). Le 1d10 de chaque tombant passe par la PORTE (#1508, `ouvrirChute`) : une étape à dé
      // nu par cible, affichable et posable ; la perte se dit à la résolution de son dé, pas ici.
      const targets = env.targets(e.target, e.heroId);
      const m = Math.max(0, e.metres);
      // `to` ramène le faller au PIED (chute → il retombe en bas, LDB 15) : le GROUPE hors combat, ou
      // les combattants nommés en combat (escalade ratée → hisse annulée par `placeCombatant`).
      const sc = env.get().scene;
      if (e.to && env.get().battle && sc) for (const c of targets) placeCombatant(c, sc, e.to);
      if (targets.length) {
        env.set({ ...touchActors(env.get()), ...(e.to && !env.get().battle ? { partyPos: e.to } : {}) });
        env.log(t('eff.fallOuverte', { m, noms: targets.map((c) => c.label).join(', ') }));
        for (const c of targets) ouvrirChute(env.set, c, m);
      } else if (e.to && !env.get().battle) env.set({ partyPos: e.to });
    },
  },
  inflictDisease: {
    group: 'Afflictions', label: 'Infliger une maladie (LDB 20)', icon: 'medical/infection',
    make: () => ({ type: 'inflictDisease', disease: diseaseNames()[0] ?? '', heroId: '' }),
    apply: (e, env) => {
      // Maladie (LDB 20) infligée par l'auteur (nourriture avariée, contact infecté…). Incubation/durée
      // tirées à la contraction ; les symptômes se déclareront au repos. Dédoublonnée par nom.
      let whoId = '';
      const who = env.mutateHero(e.heroId, (h) => {
        if ((h.diseases ?? []).some((d) => d.id === e.disease)) return h; // déjà présente → no-op
        const dz = contractDisease(e.disease, battleRng());
        if (!dz) return h;
        whoId = h.id;
        return { ...h, diseases: [...(h.diseases ?? []), dz] };
      });
      if (who && whoId) {
        const line = t('eff.diseaseContracted', { name: who.label, disease: e.disease });
        env.log(line);
        // VISIBLE (le journal seul ne suffit pas) : effet d'AUTEUR → révélation témoin.
        env.pushReveal({ kind: 'effet', title: t('eff.diseaseTitle', { disease: e.disease }), lines: [line], subjectId: whoId, severity: 'grave' });
      }
    },
  },
  inflictHunger: {
    group: 'Afflictions', label: 'Imposer la Faim (LDB 18 — groupe affamé)', icon: 'flag/hungry',
    make: () => ({ type: 'inflictHunger', days: 1, target: 'party' }),
    apply: (e, env) => {
      // Faim (LDB 18 l.337-343) posée par l'auteur (siège, cachot, traversée sans vivres) : `days`
      // échecs de Test de Faim encaissés d'affilée, via la fonction PURE `applyFaimTest` (1ᵉʳ → −10 F/E ;
      // 2ᵉ+ → −10 autres + 1d10 Dégâts ignorant les PA, min 1). Réutilise le moteur des provisions.
      const heroes = env.targets(e.target ?? 'party', e.heroId);
      const n = Math.max(1, e.days ?? 1);
      const lines: string[] = [];
      for (const c of heroes) {
        c.hunger = c.hunger ?? { days: 0, tests: 0, failures: 0 };
        c.hunger.days += n;
        const be = Math.floor(effectiveChar(c, 'endurance') / 10);
        let damage = 0;
        for (let i = 0; i < n; i++) {
          const r = applyFaimTest(c, false, be, battleRng());
          lines.push(...r.log);
          damage += r.damage;
        }
        if (damage > 0) loseWounds(c, damage);
      }
      if (heroes.length) { env.set(touchActors(env.get())); lines.forEach((l) => env.log(l)); }
    },
  },
  inflictThirst: {
    group: 'Afflictions', label: 'Imposer la Soif (LDB 18 — groupe assoiffé)', icon: 'flag/hungry',
    make: () => ({ type: 'inflictThirst', days: 1, target: 'party' }),
    apply: (e, env) => {
      // Soif (LDB 18 l.340, miroir de la Faim) posée par l'auteur — via la fonction PURE partagée
      // `applySoifTest` (1ᵉʳ → −10 Int/FM/Soc ; 2ᵉ+ → −10 autres + 1d10 Dégâts ignorant les PA, min 1).
      const heroes = env.targets(e.target ?? 'party', e.heroId);
      const n = Math.max(1, e.days ?? 1);
      const lines: string[] = [];
      for (const c of heroes) {
        const be = Math.floor(effectiveChar(c, 'endurance') / 10);
        let damage = 0;
        for (let i = 0; i < n; i++) {
          const r = applySoifTest(c, false, be, battleRng());
          lines.push(...r.log);
          damage += r.damage;
        }
        if (damage > 0) loseWounds(c, damage);
      }
      if (heroes.length) { env.set(touchActors(env.get())); lines.forEach((l) => env.log(l)); }
    },
  },
  exposureNight: {
    group: 'Afflictions', label: 'Exposition froid / chaleur (LDB 18)', icon: 'rest/cold',
    make: () => ({ type: 'exposureNight', kind: 'froid', count: 2, target: 'party' }),
    apply: (e, env) => {
      // Exposition (LDB 18 l.326-334) posée par l'auteur (nuit glaciale, désert, tempête) : `count` Tests
      // de Résistance PAR HÉROS, chacun une ÉTAPE de cascade INFLUENÇABLE (Chance/Résilience) — jamais de
      // jet silencieux (calque `waterExposure` / la nuit de repos). L'escalade froid/chaleur (`meta.kind`)
      // + la peau de phoque vivent dans l'applier partagé `exposure`. La protection magique (`weatherWard`)
      // court-circuite comme dans le moteur eager `exposureNight`.
      const heroes = env.targets(e.target ?? 'party', e.heroId);
      const count = Math.max(1, e.count ?? 2);
      const kind: ExposureKind = e.kind ?? 'froid';
      const steps: BuiltCascadeStep[] = [];
      const lines: string[] = [];
      for (const c of heroes) {
        if (isWeatherWarded(c)) { lines.push(t('eff.weatherWarded', { name: c.label, what: t(kind === 'froid' ? 'eff.wardFroid' : 'eff.wardChaleur') })); continue; }
        const resVal = testValue(c, 'resistance', 'endurance');
        const target = kind === 'froid' ? exposureTarget(c, resVal) : Math.max(0, resVal);
        // Ligne montée ICI : au FROID la cible vient d'`exposureTarget` (le manteau manquant y est fondu,
        // et ressort en chip nommée) — une autre arithmétique que celle du monteur, à ne pas refaire.
        const st = monoStep({
          id: `expo-${c.id}`, kind: 'exposure', actor: c, icon: 'rest/cold',
          rollLabel: 'Résistance', label: stepPrecision(t('step.exposition'), t(kind === 'froid' ? 'step.froid' : 'step.chaleur')),
          difficulty: 'intermediaire',
          montee: { base: resVal, ...(kind === 'froid' ? exposureCoatMods(c) : {}), target },
          meta: { kind }, stake: nightStakeRef('exposure'),
        });
        pousseSi(steps, st);
      }
      if (lines.length) { env.set(touchActors(env.get())); lines.forEach((l) => env.log(l)); }
      // BANDE d'Exposition (#1117 L3) : une fenêtre par VAGUE, les héros exposés en rangées — les
      // vagues suivantes se déroulent APRÈS les délestages de la précédente (`nextExposureWave`).
      const band = exposureWaveBand(steps, kind, count);
      if (band.length) openSequence(env.get, env.set, { title: t(kind === 'froid' ? 'eff.expoFroidTitre' : 'eff.expoChaleurTitre'), icon: 'rest/cold', purpose: 'test', steps: band });
    },
  },
  inflictTrauma: {
    group: 'Afflictions', label: 'Infliger une Blessure Critique (LDB 18)', icon: 'journal/critical',
    make: () => ({ type: 'inflictTrauma', kind: 'fracture', severity: 'mineur', location: 'brasD', heroId: '' }),
    apply: (e, env) => {
      // Blessure Critique posée rétroactivement par l'éditeur (LDB 18) : déchirure/fracture via `traumaById`
      // (fiche `traumas.json` résolue par `dechirureFractureFicheId`, effets en-combat + convalescence),
      // amputation via les séquelles permanentes (`permanentAmputations`). criticalWounds suit (compteur LDB 18).
      let labels: string[] = [];
      let whoId = '';
      const who = env.mutateHero(e.heroId, (h) => {
        whoId = h.id;
        const be = Math.floor(effectiveChar(h, 'endurance') / 10);
        // Amputation : séquelle PERMANENTE choisie par localisation (bras → main/bras ; jambe → membre
        // inférieur ; tête → œil, choix d'éditeur) — ids de fiche `traumas.json`, plus de texte parsé.
        const ampSequel = e.location === 'tete' ? 'oeil-perdu' : e.location === 'brasG' || e.location === 'brasD' ? 'main-bras-ampute' : 'membre-inferieur-ampute';
        const traumas = e.kind === 'amputation'
          ? permanentAmputations([ampSequel], e.location)
          : [traumaById(dechirureFractureFicheId(e.kind, e.severity ?? 'mineur', e.location), { be, d10: d10(battleRng()) }, e.location)];
        labels = traumas.map((tr) => tr.label);
        return { ...h, traumas: [...(h.traumas ?? []), ...traumas], criticalWounds: (h.criticalWounds ?? 0) + 1 };
      });
      if (who) {
        const line = t('eff.criticalSuffered', { name: who.label, kind: e.kind, location: e.location });
        env.log(line);
        // VISIBLE (le journal seul ne suffit pas) : effet d'AUTEUR → révélation témoin.
        env.pushReveal({ kind: 'effet', title: t('eff.criticalTitle', { kind: e.kind }), lines: [line, ...labels], subjectId: whoId, severity: 'grave' });
      }
    },
  },
  inflictNightmares: {
    group: 'Afflictions', label: 'Infliger des cauchemars (trauma nocturne)', icon: 'flag/fear',
    make: () => ({ type: 'inflictNightmares', heroId: '' }),
    apply: (e, env) => {
      // Trauma « Cauchemars » (LDB 21 l.95) posé sur un héros (défaut : le premier).
      const who = env.mutateHero(e.heroId, (h) => ({ ...h, nightmares: true }));
      if (who) env.log(t('eff.nightmares', { name: who.label }));
    },
  },
  ambitionLost: {
    group: 'Afflictions', label: 'Ambition anéantie → Trauma (ADE II Annexe I)', icon: 'journal/heartbreak',
    make: () => ({ type: 'ambitionLost', heroId: '' }),
    apply: (e, env) => {
      // Trauma (ADE II Annexe I) : « témoin d'un événement qui rend une Ambition complètement irréalisable
      // → Test de Calme Accessible (+20) ; échec → Trauma Psychologique ». La fonction pure porte la garde de
      // la règle facultative `psych-acquisition-optional` (null si éteinte → effet inerte, aucun RNG consommé).
      let shown: { roll: number; target: number } | null = null;
      let acquired = false;
      const who = env.mutateHero(e.heroId, (h) => {
        const res = traumaOnImpossibleAmbition(h, battleRng());
        if (!res) return h; // règle facultative éteinte
        shown = { roll: res.test.roll, target: res.test.target };
        if (!res.trait) return h; // Calme réussi → l'Ambition brisée n'a pas laissé de trauma
        acquired = true;
        return { ...h, psychTraits: [...(h.psychTraits ?? []), res.trait] };
      });
      if (!who || !shown) return;
      const s = shown as { roll: number; target: number };
      const line = t(acquired ? 'eff.ambitionTrauma' : 'eff.ambitionResisted', { name: who.label, roll: s.roll, target: s.target });
      env.log(line);
      if (acquired) env.pushReveal({ kind: 'effet', title: t('eff.ambitionTitle'), lines: [line], subjectId: who.id, severity: 'grave' });
    },
  },
  inflictPsychology: {
    group: 'Afflictions', label: 'Peur / Terreur scénique (LDB 21)', icon: 'flag/fear',
    make: () => ({ type: 'inflictPsychology', kind: 'peur', indice: 1, label: 'Une vision terrifiante', target: 'party' }),
    apply: (e, env) => {
      // Source de Peur/Terreur SCÉNIQUE (apparition, présage) : MÊME cascade de Tests de Calme que la
      // Psychologie de rencontre (`openScriptedPsych`, applier 'encounterPsych' partagé) — jamais un jet
      // silencieux. Frénésie s'octroie déjà via `ops`/`grantPsychTrait` (capacité, pas une affliction testée).
      const heroes = env.targets(e.target ?? 'party', e.heroId);
      openScriptedPsych(env.get, env.set, e.kind, Math.max(1, e.indice ?? 1), e.label || t('eff.psychScene'), heroes);
    },
  },
  corruptionExposure: {
    group: 'Afflictions', label: 'Influence corruptrice (Test, LDB 19)', icon: 'nav/mutation',
    make: () => ({ type: 'corruptionExposure', level: 'mineure', skill: { id: 'resistance' }, heroId: '' }),
    apply: (e, env) => {
      // Influence corruptrice (LDB 19 l.23-75) : ouvre le Test différé par modale
      // (Lancer → Chance → Appliquer) ; le gain dépendra du niveau et du DR.
      const hero = corruptionTarget(env.get(), e.heroId);
      // `e.skill` présent = déterminé en amont (verrouillé) ; absent = nature indéterminée → le
      // joueur choisira Résistance/Calme dans la modale (défaut affiché : Résistance).
      // Test d'Exposition = « résister à la Corruption » → Résistance (Menace : Corruption) offerte (LDB 10).
      // La pose passe par LA PORTE du slot (#1282) : une fenêtre de Corruption déjà ouverte n'est pas
      // écrasée — l'Exposition prend rang (`corruptionQueue`).
      if (hero) poseCorruptionPending(env.get, env.set, { heroId: hero.id, level: e.level, skill: testDeCorruption(e.skill), skillLocked: e.skill != null, align: e.align, menace: 'corruption' });
    },
  },
  giveSin: {
    group: 'Afflictions', label: 'Points de Péché (prêtre fautif, LDB 40)', icon: 'ui/balance',
    make: () => ({ type: 'giveSin', amount: 1, heroId: '' }),
    apply: (e, env) => {
      // Points de Péché (LDB 40 l.36) : sanction d'auteur, 1 à 3 selon la gravité — appliquée par
      // l'op `sinMod` (COUTURE UNIQUE du Péché, partagée avec les issues d'Activité ACE).
      // Cible : héros désigné, sinon le premier sachant Prier (le Péché vise un Bienheureux).
      const amount = Math.max(1, e.amount ?? 1);
      const lines: string[] = [];
      const who = env.mutateHero(
        e.heroId,
        (h) => {
          const clone = { ...h };
          lines.push(...applyOps(clone, [{ op: 'sinMod', amount }], {}));
          return clone;
        },
        (party) => {
          const i = party.findIndex((h) => h.skills.some((sk) => sk.id === 'priere' && sk.advances >= 1));
          return i >= 0 ? i : 0;
        },
      );
      if (who) for (const l of lines) env.log(l);
    },
  },
  waterExposure: {
    group: 'Afflictions', label: 'Exposition hydrique (eau souillée — MSRC 16)', icon: 'travel/wave',
    make: () => ({ type: 'waterExposure', mode: 'ingestion', target: 'hero' }),
    apply: (e, env) => {
      // « Maladies transmises par l'eau » (MSRC 16 l.13) : UN Test de Résistance Intermédiaire (+0) modifié
      // PAR HÉROS exposé — étape de cascade influençable (jamais de jet silencieux). Modificateurs
      // cumulés : tableau 1 « Source d'eau » (choix d'auteur `e.source`, ingestion ET immersion) +
      // tableau 2 « Blessures et États » (DÉRIVÉ du héros, immersion seule). La conséquence (d100
      // « +10/DR négatif » → contraction DIRECTE) vit dans l'applier `waterExposure`.
      const heroes = env.targets(e.target ?? 'hero', e.heroId);
      if (!heroes.length) return;
      const src = sourceExposureMod(e.source);
      const steps = heroes.flatMap((h) => {
        const auto = autoExposureMods(h, e.mode); // tableau 2 (gate `appliesTo` interne : immersion seule)
        const parts = [...(src ? [src] : []), ...auto]; // tableau 1 : « à l'ingestion et à l'immersion »
        const detail = parts.map((m) => `${m.label} ${m.mod > 0 ? '+' : ''}${m.mod}`).join(' · ');
        // Ligne montée par le MONTEUR CANONIQUE (dans le mint) : la base est le Niveau de Résistance NU,
        // et les deux tableaux d'exposition sont des lignes NOMMÉES sur la cible, chacune liée à la
        // fiche qui les octroie (MSRC 16).
        const step = monoStep({
          id: `waterExposure-${h.id}`, kind: 'waterExposure', actor: h, icon: 'travel/wave',
          rollLabel: refLabel('skills', WATER_EXPOSURE.test.skill),
          label: t('eff.waterExposure', { mode: e.mode === 'immersion' ? 'immersion' : 'ingestion', detail: detail ? ` (${detail})` : '' }),
          difficulty: WATER_EXPOSURE.test.difficulty,
          ligne: {
            test: { skill: WATER_EXPOSURE.test.skill.id, spec: WATER_EXPOSURE.test.skill.spec },
            surLaCible: parts.map((m): ModLine => ({
              label: m.label, value: m.mod, famille: 'jet', ref: RULE_REF['exposition-hydrique'],
            })),
          },
          stake: combatStakeRef('waterExposure'),
        });
        return step ? [step] : [];
      });
      if (steps.length) openSequence(env.get, env.set, { title: t('eff.waterTitle'), icon: 'travel/wave', purpose: 'test', steps });
    },
  },

  // ── Temps & repos ──────────────────────────────────────────────────────
  rest: {
    group: 'Temps & repos', label: 'Repos (Dormir / Se reposer N jours)', icon: 'rest/bed',
    make: () => ({ type: 'rest', days: 1 }),
    apply: (e, env) => {
      // Repos déclenché par l'éditeur (trigger/dialogue) : ouvre la MODALE DE NUIT (couchage +
      // pitance par héros, prix RAW, bilan globalisé). `lodging` non renseigné dans l'effet ⇒
      // défaut maison (arbitrage de contexte, cf. `placesOfKind`).
      openRest(env.get, env.set, { places: placesOfKind(e.lodging ?? 'maison'), quality: e.quality, days: e.days ?? 1 });
    },
  },
  mealParty: {
    group: 'Temps & repos', label: 'Repas (nourrit le groupe sans ration — faim à zéro)', icon: 'rest/stew',
    make: () => ({ type: 'mealParty' }),
    apply: (_e, env) => {
      // Repas (#T2) : tout le groupe est nourri pour la journée sans consommer de ration —
      // compteurs/malus de Faim remis à zéro (LDB 18 l.337-343 ; prix éventuel porté par le choix).
      const diners = env.get().party;
      for (const h of diners) if (!h.dead) feedFromMeal(h);
      env.set({ party: [...diners] });
      env.log(t('eff.meal'));
    },
  },
  interlude: {
    group: 'Temps & repos', label: 'Entre deux aventures (Événements + Activités, N semaines)', icon: 'time/calendar',
    make: () => ({ type: 'interlude', weeks: 1 }),
    apply: (e, env) => {
      // « Entre deux aventures » (LDB 22-23) — via l'action store (pas d'import direct : cycle).
      // Règle optionnelle (LDB 21 l.108-110) : tout le chapitre est facultatif → désactivable.
      if (rule('interlude-enabled')) env.get().startInterlude(e.weeks ?? 1);
    },
  },
  setTime: {
    group: 'Temps & repos', label: 'Régler l’heure (jour/nuit)', icon: 'time/clock',
    make: () => ({ type: 'setTime', phase: 'nuit' }),
    apply: (e, env) => {
      // Saut EN AVANT jusqu'à la prochaine occurrence de la phase/heure visée (le temps ne recule jamais).
      // `phase` ⊕ `hour` (XOR porté par `setTimeSchema`, defs-scenes/effets.ts).
      const target = e.phase !== undefined
        ? (DAY_PHASES.find((p) => p.id === e.phase)?.start ?? 0)
        : (e.hour ?? 0) * 60 + (e.minute ?? 0);
      env.get().advanceTime(minutesUntilNext(env.get().gameTime, target));
    },
  },
  delayedEffect: {
    group: 'Temps & repos', label: 'Effet différé (minuterie / heure)', icon: 'ui/wait',
    make: () => ({ type: 'delayedEffect', afterMinutes: 60, flow: EMPTY_FLOW, cancelFlag: '' }),
    apply: (e, env) => {
      // Échéance absolue (minute `gameTime`), résolue par `scheduleAt` (engine/clock — source unique).
      const now = env.get().gameTime;
      const executeAt = scheduleAt(now, e);
      env.set((s: GameState) => ({ scheduledEffects: [...s.scheduledEffects, { executeAt, flow: e.flow, cancelFlag: e.cancelFlag }] }));
    },
  },

  // ── Navigation ─────────────────────────────────────────────────────────
  transition: {
    group: 'Navigation', label: 'Transition de scène', icon: 'nav/entry-point',
    make: () => ({ type: 'transition', scene: '', entry: '' }),
    apply: (e, env) => {
      const cur = env.get();
      if (cur.scene) env.set({ previousScene: { id: cur.scene.id, pos: { ...cur.partyPos } } });
      env.get().transitionTo(e.scene, e.entry);
    },
    refs: (e, ctx) => ctx.sceneIds.has(e.scene) ? [] : [{ level: 'error', message: `Effet → scène inexistante « ${e.scene} »` }],
  },
  transitionBack: {
    group: 'Navigation', label: 'Retour scène précédente', icon: 'ui/undo',
    make: () => ({ type: 'transitionBack' }),
    apply: (_e, env) => {
      const prev = env.get().previousScene;
      if (prev) {
        env.set({ previousScene: null });
        env.get().transitionTo(prev.id, undefined, prev.pos);
      }
    },
  },
  openWorldMap: {
    group: 'Navigation', label: 'Ouvrir la carte du monde (partir en voyage)', icon: 'travel/world',
    make: () => ({ type: 'openWorldMap' }),
    apply: (_e, env) => {
      // « Partir en voyage » depuis une porte/route de la scène (#T2) — l'action est déjà gardée
      // (no-op sans carte ou en combat).
      env.get().openWorldMap();
    },
  },
  setVessel: {
    group: 'Navigation', label: 'Doter le groupe d\'un navire (MDG 13-15)', icon: 'travel/anchor',
    make: () => ({ type: 'setVessel', vehicleId: navireSeme(), morale: MORALE_BASE }),
    apply: (e, env) => {
      // Pose le NAVIRE DE CAMPAGNE (`state.vessel`) — comme le champ de scénario `TestScenario.vessel`,
      // mais authorable. Moral neuf par défaut (MORALE_BASE) ; coque intacte sauf `hull*` authoré.
      const v = findVehicleById(e.vehicleId);
      if (!v?.ship) return; // ref invalide (validée par `refs`) : no-op
      env.set({
        vessel: {
          vehicleId: e.vehicleId,
          ...(e.label?.trim() ? { label: e.label.trim() } : {}), // #230 — nom d'instance (affichage)
          morale: { score: e.morale ?? MORALE_BASE, lastMoraleWeek: 0, factors: [] },
          ...(e.hullMax != null ? { wounds: { current: e.hullCurrent ?? e.hullMax, max: e.hullMax } } : {}),
          ...(e.saboteurDR != null ? { saboteurDR: e.saboteurDR } : {}),
          ...(e.waterLitres != null ? { waterLitres: Math.max(0, e.waterLitres) } : {}),
          ...(e.provisions != null ? { provisions: Math.max(0, e.provisions) } : {}),
          ...(e.crew && e.crew.length ? { crew: e.crew.filter((h) => h.roleId && h.count > 0) } : {}),
        },
      });
      env.log(t('eff.setVessel', { name: e.label?.trim() || v.label }));
    },
    refs: (e) => {
      const v = e.vehicleId ? findVehicleById(e.vehicleId) : undefined;
      if (!v) return [{ level: 'error', message: `Effet → navire inexistant « ${e.vehicleId || '(vide)'} »` }];
      if (!v.ship) return [{ level: 'error', message: `Effet → « ${v.label} » n'est pas un navire (pas de facette ship)` }];
      return [];
    },
  },
  adjustManann: {
    group: 'Navigation', label: 'Humeur de Manann (MDG 15 l.83-125)', icon: 'travel/anchor',
    make: () => ({ type: 'adjustManann', delta: { flat: 5, d10: 0, sign: 1 } }),
    apply: (e, env) => {
      const vessel = env.get().vessel;
      if (!vessel) { env.log(t('eff.manannNoVessel')); return; }
      const mood = vesselManann(vessel);
      if (e.factorId) {
        const already = mood.applied.includes(e.factorId);
        const { mood: next, delta, label } = applyManannFactor(mood, e.factorId, battleRng());
        if (already) { env.log(t('eff.manannAlready', { factor: label ?? e.factorId })); return; }
        env.set({ vessel: { ...vessel, manann: next } });
        env.log(t('eff.manannFactor', { delta: `${delta >= 0 ? '+' : ''}${delta}`, factor: label ?? e.factorId }));
        return;
      }
      if (e.delta) {
        const rolled = e.delta.sign * (e.delta.flat + (e.delta.d10 > 0 ? rollDice(e.delta.d10, 10, battleRng()) : 0));
        env.set({ vessel: { ...vessel, manann: addManann(mood, rolled) } });
        env.log(t('eff.manannRolled', { delta: `${rolled >= 0 ? '+' : ''}${rolled}` }));
      }
    },
    refs: (e) => (e.factorId && !findManannFactor(e.factorId)) ? [{ level: 'error', message: `Effet → facteur Manann inexistant « ${e.factorId} »` }] : [],
  },
  adjustVessel: {
    group: 'Navigation', label: 'Ajuster le navire de campagne (#233)', icon: 'travel/anchor',
    make: () => ({ type: 'adjustVessel' }),
    apply: (e, env) => {
      const vessel = env.get().vessel;
      if (!vessel) { env.log(t('eff.vesselNoVessel')); return; }
      const parts: string[] = [];
      const next: typeof vessel = { ...vessel };
      if (e.label?.trim()) { next.label = e.label.trim(); parts.push(t('eff.vesselName', { label: e.label.trim() })); }
      if (e.morale != null) { next.morale = { ...vessel.morale, score: e.morale }; parts.push(t('eff.vesselMorale', { n: e.morale })); }
      if (e.saboteurDR != null) { next.saboteurDR = clampSaboteurDR(e.saboteurDR); parts.push(t('eff.vesselSabotage', { n: next.saboteurDR })); }
      if (e.waterLitres != null) { next.waterLitres = Math.max(0, e.waterLitres); parts.push(t('eff.vesselWater', { n: next.waterLitres })); }
      if (e.provisions != null) { next.provisions = Math.max(0, e.provisions); parts.push(t('eff.vesselProvisions', { n: next.provisions })); }
      if (e.crew && e.crew.length) { next.crew = e.crew.filter((h) => h.roleId && h.count > 0); parts.push(t('eff.vesselCrew', { n: next.crew.reduce((s, h) => s + h.count, 0) })); }
      // Blessures de coque : valeur ABSOLUE d'auteur → seam `setVesselHull` (#308, pas d'écriture directe
      // de `vessel.wounds` — resynchronise aussi la copie de travail `travelPlan.vehicle` si active).
      const hullMax = e.hullMax ?? vessel.wounds?.max ?? env.get().travelPlan?.vehicle?.wounds.max;
      const hasHullWrite = hullMax != null && (e.hullMax != null || e.hullCurrent != null);
      const hullCurrent = hasHullWrite ? (e.hullCurrent ?? hullMax) : undefined;
      if (hasHullWrite) parts.push(t('eff.vesselHull', { cur: Math.max(0, Math.min(hullCurrent!, hullMax!)), max: hullMax! }));
      if (!parts.length) { env.log(t('eff.vesselNoField')); return; }
      env.set({ vessel: next });
      if (hasHullWrite) setVesselHull(env.get, env.set, hullCurrent!, hullMax!);
      env.log(t('eff.vesselDone', { parts: parts.join(', ') }));
    },
    refs: () => [],
  },

  // ── Combat & social ────────────────────────────────────────────────────
  startCombat: {
    group: 'Combat & social', label: 'Démarrer un combat', icon: 'action/attack',
    make: () => ({ type: 'startCombat', encounter: '' }),
    apply: (e, env) => { env.get().startCombat(e.encounter); },
    refs: (e, ctx) => ctx.encounterIds.has(e.encounter) ? [] : [{ level: 'error', message: `Effet → rencontre inexistante « ${e.encounter} »` }],
  },
  startPursuit: {
    group: 'Combat & social', label: 'Poursuite terrestre (LDB 15)', icon: 'travel/foot',
    make: () => ({ type: 'startPursuit', partyRole: 'fleeing', distance: 4, skill: { id: 'athletisme' }, foes: [{ ref: { creatureId: creatureSemee() } }], encounter: '' }),
    apply: (e, env) => { startGroundPursuit(env.get, env.set, { partyRole: e.partyRole, distance: e.distance, escapeAt: e.escapeAt, skill: e.skill.id, foes: e.foes, encounter: e.encounter || undefined, policy: e.policy }); },
    refs: (e, ctx) => {
      const issues: EffectRefIssue[] = [];
      if (!e.foes?.length) issues.push({ level: 'error', message: 'Poursuite : aucun adversaire' });
      // Chaque adversaire est une RÉFÉRENCE : c'est sur la fiche que se lisent son Mouvement et sa
      // valeur de Test — une référence cassée n'a aucune stat à offrir.
      for (const f of e.foes ?? []) {
        if ('creatureId' in f.ref && !findCreatureById(f.ref.creatureId)) {
          issues.push({ level: 'error', message: `Poursuite → créature inexistante « ${f.ref.creatureId || '(aucune)'} »` });
        }
      }
      if (e.encounter && !ctx.encounterIds.has(e.encounter)) issues.push({ level: 'error', message: `Poursuite → rencontre inexistante « ${e.encounter} »` });
      return issues;
    },
  },
  startMassBattle: {
    group: 'Combat & social', label: 'Combat de masse (Puissance de Bataille)', icon: 'map-tool/start-flag',
    make: () => ({ type: 'startMassBattle', battle: { allyMight: 50, enemyMight: 50, plannedRounds: 3 } }),
    apply: (e, env) => { env.get().startMassBattle(e.battle); }, // ouvre l'écran de bataille sur le spec authoré (ADE II 08)
    // Les rencontres mappées aux Scènes de combat/menace doivent exister dans la scène courante.
    refs: (e, ctx) => Object.entries(e.battle.sceneEncounters ?? {}).flatMap(([sceneId, encId]) =>
      ctx.encounterIds.has(encId) ? [] : [{ level: 'error' as const, message: `Combat de masse → rencontre inexistante « ${encId} » (Scène ${sceneId})` }]),
  },
  openMerchant: {
    group: 'Combat & social', label: 'Ouvrir une boutique (marchand)', icon: 'merchant/cart',
    make: () => ({ type: 'openMerchant', entityId: '' }),
    apply: (e, env) => { env.get().openMerchant(e.entityId); }, // ouvre la boutique de l'entité (Marchand inclus dans un dialogue, #2)
  },
  openPort: {
    group: 'Navigation', label: 'Ouvrir un port (MDG 15 — relâche à terre)', icon: 'travel/anchor',
    make: () => ({ type: 'openPort', placeId: '' }),
    apply: (e, env) => {
      // SOURCE UNIQUE avec l'accostage en mer (`finishSeaDay`) : `openPortAt` (state/seaVoyageFlow).
      const wm = env.get().worldMap;
      const place = wm ? placeById(wm, e.placeId) : undefined;
      if (!place) return;
      openPortAt(env.get, env.set, place);
    },
    refs: (e) => (e.placeId ? [] : [{ level: 'error', message: 'Effet → Ouvrir un port : lieu manquant' }]),
  },
  openTavernGames: {
    group: 'Combat & social', label: 'Jeux de taverne (NADJ 16)', icon: 'nav/dice',
    make: () => ({ type: 'openTavernGames' }),
    // Option facultative : sans effet si éteinte (comme interlude). Le PROPOSEUR est celui qui PARLE
    // (`state.dialogue.speakerId`, posé par l'interaction ou `startDialogue`) quand son entité offre
    // une partie (`SceneEntity.tavernGame`) : la table s'ouvre alors sur SON offre. Aucun PNJ n'est
    // nommé ici — tout proposeur en hérite, et une ouverture hors dialogue reste générique.
    apply: (_e, env) => {
      if (!rule('tavern-games')) return;
      const parle = env.get().dialogue?.speakerId;
      const propose = parle && tavernNpcOffers(env.get().scene).some((o) => o.id === parle);
      env.get().openTavernGames(propose ? parle : undefined);
    },
  },
  medicalAid: {
    group: 'Combat & social', label: 'Acte de soin payant (PNJ médecin/guérisseur)', icon: 'medical/aid',
    // tarif par défaut : « aide médicale 4-6 pistoles » (LDB 75) → 5 pa
    make: () => ({ type: 'medicalAid', acts: [{ act: 'wounds', cost: { silver: 5 } }], entityId: '' }),
    apply: (e, env) => { openMedicalAidEffect(env.get, env.set, e); }, // soins payants d'un PNJ : ouvre son infirmerie (actes tarifés)
    // Le soigneur PORTE ses stats : sans entité résolvable, l'infirmerie n'a ni nom ni fiche à lire —
    // et sans la Compétence Guérison sur cette fiche, l'acte n'a aucune valeur à jouer (LDB 09 l.30).
    refs: (e, ctx) => {
      if (!ctx.entityIds.has(e.entityId)) return [{ level: 'error', message: `Soins payants → PNJ soigneur inexistant « ${e.entityId || '(aucun)'} »` }];
      const npc = ctx.npcSheet(e.entityId);
      if (!npc) return [{ level: 'error', message: `Soins payants → le PNJ « ${e.entityId} » n'a aucune fiche (ni réf de bestiaire, ni profil, ni preset)` }];
      return hasHealSkill(npc) ? [] : [{ level: 'error', message: `Soins payants → le PNJ « ${e.entityId} » ne possède pas la Compétence Guérison` }];
    },
  },
  castSpell: {
    group: 'Combat & social', label: 'Incanter un sort/prière (scripté, #98)', icon: 'magic/power',
    make: () => ({ type: 'castSpell', casterId: '', spellId: '', mode: 'jet' }),
    apply: (e, env) => {
      const { get, set } = env;
      const caster = actorIn(get(), e.casterId);
      if (!caster) { env.log(t('eff.castCasterMissing', { id: e.casterId })); return; }
      const spell = findSpellById(e.spellId);
      if (!spell) { env.log(t('eff.castSpellMissing', { id: e.spellId })); return; }
      const target = (e.targetId ? actorIn(get(), e.targetId) : undefined) ?? caster;
      if (e.mode === 'forceSuccess') {
        // Arbitrage D'AUTEUR explicite (rituel garanti) : le RAW ne prévoit aucun lancer scripté SANS jet —
        // applique directement les effets du sort (Critique/Imparfaite n'ont pas de sens hors d'un vrai jet).
        const ctx: OpsCtx = { rng: battleRng(), caster, label: spell.label, sl: spell.cn ?? 0, source: { kind: 'spell', id: spell.id } };
        for (const line of applyOps(target, spellOps(spell.effects, 'target'), ctx)) env.log(line);
        for (const line of applyOps(caster, spellOps(spell.effects, 'caster'), ctx)) env.log(line);
        env.log(`${caster.label} incante ${spell.label} (rituel garanti).`);
        return;
      }
      if (get().battle) {
        // EN COMBAT : flux d'incantation STANDARD (jet influençable si piloté par un humain, cadence-aware,
        // même chemin que l'IA) — exécuteur enregistré par `combatFlow` (module FEUILLE, anti-cycle).
        castSpellRunner?.(get, set, caster, target, spell.id);
        return;
      }
      // HORS COMBAT (couture D) : seul un héros du GROUPE a un flux d'incantation jouable (`oocCastSpell`,
      // jet réel par modale) — un PNJ hors combat n'a pas de Combatant à faire incanter (`actorIn` ne
      // l'a alors résolu que depuis `party`), pas de pseudo-combat inventé pour ce cas.
      get().oocCastSpell(caster.id, spell.id, target.id);
    },
    refs: (e) => {
      const issues: EffectRefIssue[] = [];
      if (!e.casterId) issues.push({ level: 'error', message: 'Effet Incanter : lanceur manquant' });
      if (!e.spellId || !findSpellById(e.spellId)) issues.push({ level: 'error', message: `Effet Incanter : sort inexistant « ${e.spellId} »` });
      return issues;
    },
  },

  // ── Tests ──────────────────────────────────────────────────────────────
  extendedTest: {
    group: 'Tests', label: 'Test Étendu (DR cumulé : crocheter/forcer un mécanisme)', icon: 'ui/key',
    make: () => ({ type: 'extendedTest', skill: { id: 'crochetage' }, difficulty: 'intermediaire', label: 'Crocheter la serrure', targetDR: 5, flag: '', stake: flowStakeRef('extendedTest', 'roll') }),
    apply: (e, env) => {
      // Test ÉTENDU (LDB 12 l.187-200) : le meilleur du groupe enchaîne les Rounds, SOUTENU par les autres
      // membres capables (+10 chacun, plafond Bonus de Carac — `partyAssisted`). Adjacence (l.196) : même
      // pool `battle.combatants` (héros positionnés) que `openSkillTest` quand un combat est en cours.
      const battle = env.get().battle;
      const pool = battle?.combatants.filter((c) => c.kind === 'hero') ?? env.get().party;
      const leader = partyBest(pool, e.skill?.id, e.characteristic, undefined, e.skill?.spec)?.actor;
      const eligible = battle && leader?.pos ? (c: Combatant) => !!c.pos && combatDistance(leader, c) <= 1 : undefined;
      const best = leader ? partyAssisted(pool, e.skill?.id, e.characteristic, undefined, e.skill?.spec, eligible) : null;
      if (!best) return;
      const difficulty = e.difficulty ?? 'intermediaire';
      // Cible montée par le MONTEUR CANONIQUE : la valeur SOUTENUE de `partyAssisted` se déclare avec
      // son Soutien, l'écrêtage est celui de `rollTest` (`clampTarget`), plus une borne recopiée ici.
      const { target } = rollStep({
        actor: best.actor, test: { skill: e.skill?.id, char: e.characteristic, spec: e.skill?.spec },
        difficulty, valeur: best.value, soutien: best.support,
      });
      env.get().startExtendedTest({ actorId: best.actor.id, label: e.label, skillLabel: e.skill ? refLabel('skills', e.skill) : (e.characteristic ?? 'Test'), target, targetDR: e.targetDR, flag: e.flag, stake: e.stake ?? flowStakeRef('extendedTest', 'roll'), ...(best.support.count > 0 ? { support: best.support } : {}) });
      return 'suspend';
    },
  },
  forceDoor: {
    group: 'Tests', label: 'Enfoncer une porte à plusieurs (objet BE/B)', icon: 'action/force',
    make: () => ({ type: 'forceDoor', label: 'Porte', doorBE: 3, doorB: 10, flag: '' }),
    apply: (e, env) => {
      // Enfoncer une PORTE/objet à plusieurs (EDO Append. 2) : tout le groupe vivant frappe.
      const heroes = env.get().party.filter((h) => !h.dead).map((h) => h.id);
      if (!heroes.length) return;
      env.get().startForceDoor({ label: e.label, doorBE: e.doorBE, doorB: e.doorB, heroIds: heroes, flag: e.flag });
      return 'suspend';
    },
  },
};

/** Étape de cascade `waterExposure` (MSRC 16 l.49) : Test raté → d100 « avec un modificateur de +10
 *  pour chaque DR négatif » → maladie CONTRACTÉE directement (`applyContraction`, incubation normale —
 *  le Test d'exposition EST le test, jamais un second Test de Contraction). « Relancez si le Personnage
 *  n'est pas blessé » honoré par `drawWaterDisease`. Déjà porteur → rien de neuf (dédoublonnée). */
registerCascadeApplier('waterExposure', (_get, _set, step, hero) => {
  if (!hero || !step.result) return;
  if (step.result.success) return { consequences: freeCons([t('eff.waterSafe', { name: hero.label })]) };
  const draw = drawWaterDisease(Math.max(0, -step.result.sl), isWounded(hero), battleRng());
  const lines = applyContraction(hero, draw.disease, false, battleRng());
  const rollTxt = draw.modified !== draw.roll ? `${draw.roll} (+${draw.modified - draw.roll} → ${draw.modified})` : String(draw.roll);
  return {
    consequences: freeCons([
      t('eff.waterDraw', { roll: rollTxt, disease: diseaseLabel(draw.disease) }),
      ...(lines.length ? lines : [t('eff.waterAlready', { name: hero.label })]),
    ]),
  };
});

/**
 * Applique une liste d'Effets via le REGISTRE `EFFECT_HANDLERS` (1 effet = 1 handler). Un handler qui
 * renvoie `'suspend'` (extendedTest/forceDoor → modale/pending) STOPPE la boucle, comme l'ancien
 * `return` au milieu du switch — l'ORDRE, les journaux et les révélations restent identiques.
 */
export function applyEffects(get: Get, set: SetFn, effects: Effect[], sl?: number): Applique {
  const env = makeEffectEnv(get, set, sl);
  const file = [...effects];
  let differe: Applique;
  while (file.length) {
    const e = file.shift()!;
    const handler = EFFECT_HANDLERS[e.type] as EffectHandler;
    // CONTINUATION (#1508) : si l'effet OUVRE un dé (la conséquence attend la porte), le reste du lot
    // est SA suite — même geste que le `case 'test'` du walker de Flow, qui empaquette sa pile. Le
    // signal REMONTE ensuite : ce qui suit CET appel est lui aussi la suite du dé, pas la suite immédiate.
    const differesAvant = comptePasDifferes(get());
    const issue = handler.apply(e, env);
    if (comptePasDifferes(get()) > differesAvant) { differerLaSuite(set, flowFromEffects(file.splice(0)), 'scene'); differe = OPS_DIFFEREES; break; }
    if (issue === 'suspend') break;
  }
  // Couture UNIQUE du cadre de campagne (#717) : la CLÔTURE authorée est une `Condition` — elle se
  // relit après CHAQUE lot d'effets, jamais par un branchement dans `setFlag` (un `when` peut porter
  // sur l'horloge, la bourse, le groupe autant que sur un drapeau).
  armChapterRecapIfDue(get, set);
  return differe;
}

/**
 * Soins PAYANTS d'un PNJ (Effet `medicalAid`, LDB 75) : ouvre l'INFIRMERIE (state/medicFlow) avec
 * la compétence du PNJ et ses actes tarifés — le débit a lieu à l'acte, dans la modale. Le joueur
 * choisit les patients ; le PNJ effectue les jets (la Chance interroge `actorIn(healerId)` →
 * introuvable pour un PNJ → boutons inertes).
 */
function openMedicalAidEffect(get: Get, set: SetFn, e: { acts?: { act: HealMode; cost?: { gold?: number; silver?: number; brass?: number } }[]; entityId: string }): void {
  const acts = e.acts ?? [];
  if (!acts.length) return;
  // LE soigneur est une entité de la scène, et sa FICHE est la source unique de ce qu'il vaut : sa
  // valeur de Guérison et son Bonus d'Intelligence s'y LISENT. Sans fiche, ou sans la Compétence
  // Avancée Guérison sur cette fiche (LDB 09 l.30), aucune infirmerie ne s'ouvre — et le refus se DIT.
  const npc = sceneNpc(get().scene, e.entityId);
  if (!npc) { get().log(t('eff.medicNoNpc', { id: e.entityId || '(aucun)' })); return; }
  if (!hasHealSkill(npc)) { get().log(t('eff.medicNoHealSkill', { name: npc.label })); return; }
  openMedic(get, set, {
    npc: {
      id: e.entityId,
      label: npc.label,
      skill: { id: HEAL_SKILL, value: testValue(npc, HEAL_SKILL) },
      intBonus: bonus(effectiveChar(npc, 'intelligence')),
      acts,
    },
  });
}
