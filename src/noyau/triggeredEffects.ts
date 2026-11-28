/**
 * Effets DÉCLENCHÉS authorés (`TriggeredEffect`) — le pendant « sur événement » des sorts (« au
 * lancement »). GÉNÉRIQUE : un même dispatcher applique les effets portés par les TRAITS de la créature
 * (`TraitData.effects` — Toile, Sang corrosif…) ET par les ATOUTS de son arme (`QualityData.effects` —
 * un Atout « à la touche : 1d10 + Empêtré »). Il REMPLACE les handlers en dur dispersés.
 *
 * Réutilise `runPureFlowLines` (le MÊME vocabulaire d'ops que les sorts, variante pure de
 * `runCombatFlow` → zéro duplication). Pur côté effets (ops via applyOps) ; mute les combattants en
 * place et renvoie le journal. Le référent des formules « (X) » est le PORTEUR (`caster` = la créature
 * qui frappe) — donc « Force de la source » = sa Force.
 */
import { nomDe } from '../engine/nom';
import { type Combatant, type Weapon, type HitLocation, type EffectSource } from '../engine/types';
import type { Get, Set as SetFn } from './flowTypes';
import type { Flow } from '../data/schemas/defs-scenes/effets';
import { type OpsCtx, type GameOp } from '../engine/ops';
import { nomDeSource } from '../engine/faits';
import { traceLineOf, testTraceLabel } from '../engine/traceLine';
import { ligneDeTexte, type EntreeDuJournal } from '../engine/journal';
import { resolveQualities } from '../engine/qualities/dispatch';
import {
  ARG_TEMPLATE,
  INDICE_TEMPLATE,
  type EffectTrigger,
  flowHasTest,
  flowHasFreeAttack,
  flowHasImpureOp,
  spellEffectOps,
  EMPTY_FLOW,
  reecrireFlow,
  reecrireLesOps,
  type TriggeredEffect,
  type ActorView,
} from '../engine/flowCore';
import { resoudreFlowTest } from '../engine/decisionDuTest';
import { armureUtilisable, ficheDObjetPorte, weaponIdentity, type TrappingResolver } from '../engine/items';
import { estUnCoupCritique, type OrigineCritique } from '../engine/critical';
import { featureLevel } from '../engine/combatFeatures/dispatch';
import { degatsDeLEtatIgnores } from '../engine/traits/dispatch';
import type { CombatFeature } from '../engine/combatFeatures/types';
import { isOutOfAction, combatTestPenalty, pionsRetirables } from '../engine/conditions';
import { stepPrecision, surfaceOf } from './rollSeam';
import { porteurParId } from './monde/combatants';
import { objetDuNarratif } from './monde/resolveursDuNarratif';
import { engagesDe, isEngagedWith, isEngaged, resteEngageAuRoundSuivant } from '../engine/engagement';
import { SIZE_ORDER, effectiveSize } from '../engine/size';
import { distanceDeCombat } from './monde/footprint';
import { chebyshev } from '../engine/grid';
import { tileSeenByFoe } from './monde/lineOfSight';
import { smokeOf, combatantsWithinRadius, porteeEnCases } from './monde/combatGeometry';
import { sceneMetresPerTile } from './monde/scene';
import {
  findTraitById,
  findQualityById,
  findTalentById,
  findConditionById,
  findPsychologyById,
  findSymptomById,
  findMutationById,
  testSkillLabel,
} from '../data';
import { isHeld } from '../engine/capabilities';
import { attaqueNaturelle } from '../engine/creatureAttacks';
import { activeSymptoms } from '../engine/disease';
import { difficulteDeLArg, rollTest } from '../engine/tests';
import { rawCombatTestBase } from '../engine/skills';
import { designeGaranti } from './ligneDeJet';
import { combatConditionCtx, runPureFlowLines } from './combat/flowEval';
import { cibleEnVue, isAfflictionActive, type CibleEnVue, type PsychAffliction } from '../engine/psychology';
import { estCibleType } from '../engine/psych/ciblage';
import { sourcesEnVue, sourcesPsyEnVue } from './monde/porteurs';
import { RNG } from '../engine/dice';
import { effectiveTalents } from '../engine/talentEffects';
import { campAdvantageHooks } from './combat/advantagePool';
import { alliesAuContactParmi } from './combat/surnombre';
import { buildActorView } from '../engine/actorView';
import { crochetsDeCorruption } from './corruptionFlow';
import { routeTriggeredTest, runCombatFlow, sujetDeTrace } from './combat/triggeredTest';

/** TAGUE des effets authorés de l'ENTITÉ dont ils sont tirés — « les GameOps sont rattachés à quelque
 *  chose » (arbitrage user 2026-07-18). Cette identité voyage jusqu'à l'`OpsCtx` du dispatch, où
 *  `applyOps` la stampe sur les `ActiveEffect` posés : une pastille d'effet ouvre alors la fiche de son
 *  trait/talent/qualité/symptôme/État. Rend une COPIE, jamais authorée en JSON. */
function withSource(effects: TriggeredEffect[], source: EffectSource): TriggeredEffect[] {
  return structuredClone(effects.map((e) => (e.source ? e : { ...e, source }))); // #2097
}

/** PARAMÈTRE un effet de trait par l'ARGUMENT d'instance du porteur : substitue la difficulté d'un Test ou
 *  d'un État `argDifficulty` par celle que désigne l'arg (`difficulteDeLArg`). Rend les effets
 *  authorés réutilisables et éditables tout en restant tunés par leur instance. Immuable (clone partiel). */
function withArg(effects: TriggeredEffect[], arg?: string, value?: number): TriggeredEffect[] {
  const diff = arg ? difficulteDeLArg(arg) : undefined;
  // Un gabarit de champ requis reçoit le paramètre d'instance avant l'exécution. Sans ce paramètre, le Flow omet l'op.
  const substOp = (op: GameOp): GameOp | null => {
    if (op.op === 'condition' && op.argDifficulty) {
      // L'État prend la Difficulté de l'arg (Venin, `LDB 85 l.423`) ; sans arg, il n'en porte aucune (`LDB 85 l.425`).
      const pose = { ...op };
      delete pose.argDifficulty;
      return diff ? { ...pose, difficulte: diff } : pose;
    }
    if (op.op === 'exposeDisease' && op.disease.id === ARG_TEMPLATE) {
      return arg === undefined ? null : { ...op, disease: { id: arg } };
    }
    if (op.op === 'topUpAdvantage' && Object.is(op.amount, INDICE_TEMPLATE)) {
      return value === undefined ? null : { ...op, amount: value };
    }
    return op;
  };
  const visit = (f: TriggeredEffect['flow']): TriggeredEffect['flow'] => {
    if (f.kind === 'test') {
      // Nœud Flow `test` dont la difficulté vient de l'arg d'instance (Venin, `LDB 85 l.423`) : on
      // substitue `test.difficulty` (mêmes sémantique/gate que l'ancienne op `test.argDifficulty`).
      return f.test.argDifficulty && diff ? { ...f, test: { ...f.test, difficulty: diff } } : f;
    }
    if (f.kind === 'choix') {
      // Le COÛT d'Avantage d'un `choix` accepte le MÊME template `$indice` que les ops (Taillade : X = son
      // Indice, `AA 08 l.87`). Sans Indice sur l'instance, il reste tel quel : `resolveFlowChoice` n'offre
      // alors PAS le nœud (jamais un coût 0).
      return f.coutEnAvantage === INDICE_TEMPLATE && value !== undefined ? { ...f, coutEnAvantage: value } : f;
    }
    return f;
  };
  return effects.map((eff) => ({ ...eff, flow: reecrireLesOps(reecrireFlow(eff.flow, visit), substOp) }));
}

/**
 * SOURCE UNIQUE d'énumération des sources d'effet DÉCLENCHÉ d'un combattant — TOUS les KINDS en UN endroit :
 * Atouts d'arme (`weapon.onHitEffects`), objets portés ou tenus (`TrappingData.effects`), Traits, Qualités d'arme, Talents, symptômes, MUTATIONS, ÉTATS,
 * états PSY. Chaque source
 * est taguée `key`/`cap`/`label` (+ `stacks` pour les statuts, pions réduits d'une capacité de la cible).
 * TOUT le reste en DÉRIVE (zéro énumérateur parallèle) : `fireTriggers` (via `effectsOf` non-statut +
 * `fireConditionEffects`/`firePsychEffects`), `resolveFreeAttacks` (via `freeAttackSourcesOf`), et le
 * COLLECTEUR jumeau de fin de Round (`collectRoundEndTestSteps`, combat/triggeredTest — les Tests d'un
 * héros MANUEL deviennent des étapes de cascade au lieu d'être joués inline). AJOUTER UN
 * KIND = ICI seulement. Ordre FIGÉ (enchant → objets portés → traits → atouts → talents → symptômes → mutations →
 * États → psy) = déroulé RNG déterministe. */
export function effectSourcesOf(actor: Combatant, resolveTrapping: TrappingResolver, weapon?: Weapon): TriggerSource[] {
  const out: TriggerSource[] = [];
  if (weapon?.onHitEffects?.length) { const wid = weaponIdentity(weapon); out.push({ effects: withSource(weapon.onHitEffects, { kind: 'objet', id: wid }), cap: 1, key: `weapon:${wid}`, label: weapon.label }); }
  // #4202 ; #2967
  const qualitesDArmure = new Set<string>();
  for (const it of actor.items ?? []) {
    if (!isHeld(actor, it)) continue;
    const d = ficheDObjetPorte(it, resolveTrapping);
    if (d?.effects?.length) out.push({ effects: withSource(d.effects, { kind: 'objet', id: d.id }), cap: 1, key: `item:${it.uid}`, label: d.label });
    if (it.kind !== 'armor' || !it.equipped || !armureUtilisable(it)) continue;
    for (const { id, data, indice } of resolveQualities(it)) {
      if (data?.subType !== 'armure' || !data.effects?.length || qualitesDArmure.has(id)) continue;
      qualitesDArmure.add(id);
      out.push({ effects: withSource(withArg(data.effects, undefined, indice), { kind: 'qualite', id }), cap: 1, key: `qual-armor:${id}`, label: data.label });
    }
  }
  // Traits du porteur, puis ceux que confère l'attaque de la touche (`Weapon.traitsConferes`, ZI 03 l.75, l.77) :
  // un Trait conféré ne tire qu'aux touches de l'attaque qui le confère.
  for (const tr of [...(actor.traits ?? []), ...(weapon?.traitsConferes ?? [])]) { const d = findTraitById(tr.id); if (d?.effects?.length) out.push({ effects: withSource(withArg(d.effects, tr.arg, tr.value), { kind: 'trait', id: tr.id }), cap: 1, key: `trait:${tr.id}`, label: d.label ?? tr.id }); }
  // L'Indice de l'instance (`Taillade (1A)` → 1) PARAMÈTRE les effets de la qualité comme l'arg/l'Indice
  // d'un Trait paramètre les siens — MÊME `withArg`, même convention `$indice`, aucune voie parallèle.
  if (weapon) for (const { id, indice } of resolveQualities(weapon)) { const d = findQualityById(id); if (d?.effects?.length) out.push({ effects: withSource(withArg(d.effects, undefined, indice), { kind: 'qualite', id }), cap: 1, key: `qual:${id}`, label: d.label ?? id }); }
  for (const t of effectiveTalents(actor)) { const d = findTalentById(t.talentId); if (d?.effects?.length) out.push({ effects: withSource(d.effects, { kind: 'talent', id: t.talentId }), cap: t.times ?? 1, key: t.talentId, label: d.label ?? t.talentId }); }
  // Symptômes ACTIFS des maladies (Crampes abdominales `onOwnTestFailed`, MSRC 16) — insérés APRÈS les
  // Talents et AVANT les États : ils composent comme un Trait/passif du CORPS (source NON-statut, sans
  // `stacks`), donc dispatchés par la voie `effectsOf`/`applyTriggeredEffects` (≠ pool à pions des États).
  // Ordre STABLE (accesseur canonique `activeSymptoms`, ordre des maladies) → déroulé RNG déterministe.
  for (const inst of activeSymptoms(actor)) { const d = findSymptomById(inst.symptomId); if (d?.effects?.length) out.push({ effects: withSource(d.effects, { kind: 'symptome', id: inst.symptomId }), cap: 1, key: `symptom:${inst.symptomId}`, label: d.label ?? inst.symptomId }); }
  // Mutations de Corruption — leurs `effects` sont lus AU REGISTRE (`findMutationById`), jamais sur
  // l'instance portée : `c.mutations` est une copie GELÉE au tirage, une mutation maison (hors
  // `mutations.json`) n'a donc pas d'effets déclenchés. Insérées entre symptômes et États — source
  // NON-statut (sans `stacks`), comme un Trait du corps. Ordre STABLE (ordre de `c.mutations`).
  for (const m of actor.mutations ?? []) { const d = findMutationById(m.id); if (d?.effects?.length) out.push({ effects: withSource(d.effects, { kind: 'mutation', id: m.id }), cap: 1, key: `mutation:${m.id}`, label: d.label ?? m.id }); }
  for (const cond of actor.conditions ?? []) {
    const d = findConditionById(cond.id);
    if (!d?.effects?.length || degatsDeLEtatIgnores(actor.traits, cond.id)) continue;
    const reduce = d.stacksReducedBy ? featureLevel(actor, d.stacksReducedBy as keyof CombatFeature) : 0; // Hémorragique − Endurci…
    // Part DÉRIVÉE du pion (`derivedFrom.stacks`, socle #1599) : un fait passif vivant la porte, donc
    // elle n'est ni récupérable ni dissipable (`retireEtat` y est déjà inerte). Un pion ENTIÈREMENT
    // dérivé n'est donc PAS une source d'effets déclenchés : AUCUN de ses `effects` ne tire, quel que
    // soit leur `trigger` — on ne roule pas un Test qui ne peut rien lever (#1695, LDB 48 l.495).
    // MESURÉ (`etats.json`) : les 11 États porteurs d'`effects` ne déclarent que `onRoundEnd`.
    // Un pion NATIF posé par-dessus reste, lui, pleinement joué, sur sa part native seule.
    const derive = cond.derivedFrom?.stacks ?? 0;
    if (derive >= (cond.value ?? 1)) continue;
    // LDB 18 l.120, l.150, l.179
    const effects = pionsRetirables(actor, cond.id) > 0 ? d.effects : d.effects.filter(({ trigger, flow }) =>
      trigger !== 'onRoundEnd' || flow.kind !== 'test' || !spellEffectOps(flow.reussite).some((op) => op.op === 'removeCondition' && op.id?.id === cond.id));
    if (!effects.length) continue;
    out.push({ effects: withSource(withArg(effects, cond.difficulte), { kind: 'etat', id: cond.id }), cap: 1, key: `cond:${cond.id}`, label: d.label ?? cond.id, stacks: Math.max(0, (cond.value ?? 1) - derive - reduce) });
  }
  // Une affliction CIBLÉE émet par INSTANCE, et seulement ACTIVE : sa fin la désactive (LDB 21 l.9). L'instance
  // voyage avec la source (`affliction`).
  for (const p of actor.psychState ?? []) {
    const d = findPsychologyById(p.type);
    if (!d?.effects?.length || (estCibleType(p.type) && !isAfflictionActive(p))) continue;
    out.push({ effects: withSource(d.effects, { kind: 'psychologie', id: p.type }), cap: 1, key: `psy:${p.type}`, label: d.label, stacks: 1, affliction: p });
  }
  return out;
}

/** Un tag de STATUT (État ou état psy) — il porte `stacks` et son dispatch (`fireConditionEffects`/
 *  `firePsychEffects`) injecte ses pions ; les KINDS « durs » (arme/trait/qualité/talent) n'en ont pas. */
const isStatusSource = (s: TriggerSource): boolean => s.key.startsWith('cond:') || s.key.startsWith('psy:');

/** Effets déclenchés NON-statut à plat (Atouts d'arme → Traits → Qualités → Talents) — sous-vue de
 *  `effectSourcesOf`. Les États/psy ont leur propre dispatch (avec pions), d'où le filtre. Ordre RNG figé. */
function effectsOf(actor: Combatant, resolveTrapping: TrappingResolver, weapon?: Weapon): TriggeredEffect[] {
  return effectSourcesOf(actor, resolveTrapping, weapon).filter((s) => !isStatusSource(s)).flatMap((s) => s.effects);
}

/** Ops d'un déclencheur `trigger` portées par le combattant (Traits/Talents/Atouts), à plat, CHACUNE
 *  AVEC L'ENTITÉ qui la porte (`source`, taguée par `withSource`). Sert à RÉSOUDRE les ops IMPURES
 *  (summon, scheduleRespawn : grille/initiative/horloge) au SITE du trigger — elles sont inertes dans `applyOps`
 *  (moteur pur). GÉNÉRIQUE (pas limité à summon) : l'appelant (state) filtre par `op.op` et dispatche vers le
 *  résolveur idoine (applySummon, scheduleRespawnFromOp).
 *  Sur CE chemin, le `on` de la feuille n'est pas lu : l'op impure se résout au site du porteur, chez
 *  l'appelant (`combatFlow.ts`). Le dispatcher général (`applyTriggeredEffects`) distingue, lui, la
 *  cible `t` du porteur `actor`.
 *
 *  La `source` voyage AVEC l'op parce que ce qu'elle produit (une zone à `crossTest`, une créature)
 *  peut à son tour exiger un jet : c'est d'elle que l'enjeu se dérive (#1262 V2 L6d). L'aplatir en
 *  `GameOp[]` nu perdait le porteur, et le jet se serait ouvert muet. */
export function triggerEffectOps(actor: Combatant, trigger: EffectTrigger, resolveTrapping: TrappingResolver): { op: GameOp; source?: EffectSource }[] {
  return effectsOf(actor, resolveTrapping)
    .filter((e) => e.trigger === trigger)
    .flatMap((e) => spellEffectOps(e.flow).map((op) => ({ op, ...(e.source ? { source: e.source } : {}) })));
}

/** Une SOURCE d'effets déclenchés du combattant, AVEC son identité (`key`) et son plafond (`cap`) —
 *  nécessaires aux ATTAQUES GRATUITES (imputation /Round par source ; plafond par source). `stacks` = pions
 *  de la source quand c'est un STATUT (État/psy), injectés dans le `ctx` du dispatch ; absent sinon. */
export interface TriggerSource { effects: TriggeredEffect[]; cap: number; key: string; label: string; stacks?: number;
  /** L'instance d'affliction psychologique que la source représente (statut `psy:`). */
  affliction?: PsychAffliction; }

/** Sources d'attaque gratuite DÉCLENCHÉE = LES MÊMES sources que le dispatcher (`effectSourcesOf`, source
 *  unique, arme de la touche comprise) — `resolveFreeAttacks` joue celles qui portent un `grantFreeAttack`
 *  (`flowHasFreeAttack`), que le bus saute, quel que soit le KIND (Atout d'arme/Trait/Qualité/Talent/État/psy). NB : l'attaque libre « disponible » de la
 *  Frénésie vit dans son `passive` (`when:'available'`) → `hasFreeWeaponAttack`/`aiAvailableFreeAttack`, pas ici. */
export function freeAttackSourcesOf(actor: Combatant, resolveTrapping: TrappingResolver, weapon?: Weapon): TriggerSource[] {
  return effectSourcesOf(actor, resolveTrapping, weapon);
}

/** Combattants visés par un effet selon `on` (le porteur, la victime touchée, ou TOUS ceux Engagés
 *  avec lui — Sang corrosif : « tous ceux qui sont Engagés avec elle », alliés compris). */
function targetsFor(get: Get, actor: Combatant, on: TriggeredEffect['on'], victim?: Combatant): Combatant[] {
  if (on === 'soi') return [actor];
  if (on === 'victime') return victim ? [victim] : [];
  const battle = get().battle;
  if (!battle) return [];
  if (on === 'empoigne') { // les adversaires EMPOIGNÉS par le porteur (`grapplingWith`) — la victime absorbée
    const held = new Set(actor.grapplingWith ?? []);
    return battle.combatants.filter((c) => held.has(c.id));
  }
  if (typeof on === 'object') {
    if ('pick' in on) {
      // SÉLECTION d'un nombre LIMITÉ d'adversaires Engagés à engloutir (Absorption : « UN adversaire de taille
      // égale ou inférieure », un à la fois). Capacité restante = `max` − empoignés déjà tenus (un seul à la
      // fois pour max:1) ; candidats = Engagés vivants non encore tenus, de Taille ≤ la sienne, les + proches.
      const held = actor.grapplingWith ?? [];
      const capacity = Math.max(0, on.max - held.length);
      if (capacity === 0) return [];
      const selfSize = SIZE_ORDER[effectiveSize(actor.size)];
      const eligible = battle.combatants.filter((c) =>
        c.id !== actor.id && c.kind !== actor.kind
        && isEngagedWith(actor, c) && !held.includes(c.id)
        && (on.sizeAtMost !== 'soi' || SIZE_ORDER[effectiveSize(c.size)] <= selfSize));
      eligible.sort((a, b) => distanceDeCombat(get().scene, actor, a) - distanceDeCombat(get().scene, actor, b)); // les plus proches d'abord
      return eligible.slice(0, capacity);
    }
    // GÉOMÉTRIE : tous les combattants à portée d'un centre (arc d'Azyr, Trait/Talent d'aire)
    const center = on.near === 'soi' ? actor : victim;
    if (!center?.pos) return [];
    const mpt = sceneMetresPerTile(get().scene);
    const radius = porteeEnCases(on.radiusMeters, mpt);
    const inner = on.radiusInnerMeters === undefined ? undefined : porteeEnCases(on.radiusInnerMeters, mpt);
    const dist = (c: Combatant) => distanceDeCombat(get().scene, center, c);
    const inclus = on.centreCompris ? center.id : undefined; // #4202
    // ORCHESTRATEUR d'aire PARTAGÉ (combatantsWithinRadius), distance d'EMPREINTE (la Taille compte) : un effet
    // déclenché SOURCE-AGNOSTIQUE (Trait/Talent/Atout/État portant `on:{near,radiusMeters}`) applique son Flow
    // de GameOps à TOUTES les cibles du rayon — MÊME collecte que munitions/zoneBlast/manœuvres.
    return combatantsWithinRadius(center.pos, radius, battle.combatants,
      (c) => (c.id === inclus || (c.id !== center.id && c.id !== actor.id)) && !isOutOfAction(c)
        && (inner === undefined || dist(c) > inner),
      (_ctr, c) => dist(c));
  }
  return engagesDe(actor, battle.combatants); // 'engages'
}

/** Contexte d'application d'effets déclenchés. `margin` (marge d'un Test opposé) alimente les échelles
 *  `valuePerSL` via `ctx.sl` ; `woundsDealt` alimente le Vol de vie (op `lifeSteal`). */
export interface TriggerCtx { victim?: Combatant; weapon?: Weapon; rng: RNG; margin?: number; woundsDealt?: number;
  /** Indice de l'attaque naturelle d'une MANŒUVRE — alimente les Formula `{indiceOf}` (Dégâts en GameOp). */
  indice?: number;
  /** Nombre de PIONS de l'État qui déclenche un `effects: onRoundEnd` — alimente les Formula `{stacks:'self'}`
   *  (Empoisonné « 1 PB/pion »). Posé par `fireConditionEffects`. */
  stacks?: number;
  /** Écart d'Avantage avec les adversaires Engagés — alimente la Formula `{engagedAdvantageGap}` ET la
   *  Condition `engagedAdvantageGap` (Instable). Calculé par `applyTriggeredEffects` sur la `battle`. */
  engagedAdvantageGap?: number;
  /** Avance d'Avantage SIGNÉE sur tous les adversaires Engagés — alimente la Condition `engagedAdvantageLead`
   *  (Absorption). Calculée par `applyTriggeredEffects` sur la `battle`. */
  engagedAdvantageLead?: number;
  /** Localisation de la touche courante (dé inversé) — alimente la Condition Flow `location` (Assommante). */
  location?: HitLocation;
  /** KIND de l'attaque courante (`creatureAttackKind` : 'morsure'/'cornes'/…) — alimente la Condition Flow
   *  `attackKind` (Vampirique : Vol de vie sur Morsure seulement). */
  attackKind?: string;
  /** CAUSE de l'effarouchement courant ('noise'/'magic', LDB 85 l.197) — alimente la Condition Flow
   *  `startleCause` (exemption Dressé : Guerre ignore les bruits, Magie ignore la magie). Posé par les
   *  émetteurs `onStartled` (arme à feu/Explosion → 'noise' ; incantation → 'magic'). */
  startleCause?: 'noise' | 'magic';
  /** Un adversaire vivant est-il dans la Ligne de Vue du porteur — alimente la Condition Flow `foeInLoS`
   *  (sortie de Frénésie, fuite/récupération du Brisé). Si absent, calculé sur la `battle` au déclenchement. */
  foeInLoS?: boolean;
  /** L'instance d'affliction psychologique dont les effets sont joués — posée par `firePsychEffects`. */
  affliction?: PsychAffliction;
  /** ID de l'État qui vient d'être GAGNÉ (déclencheur `onGainCondition`) — filtre les effets dont
   *  `condition` ne le matche pas (Mâchoires d'acier : `condition:'sonne'`). */
  conditionName?: string;
  /** TYPE de l'attaque courante (`weapon.type` : 'melee'/'distance') — filtre les effets `onHit`/`onWoundLoss`
   *  dont `attackType` ne le matche pas. Posé par les émetteurs onHit/onWoundLoss. */
  attackType?: 'melee' | 'distance';
  /** D'où naît la Blessure critique (`onCrit`) — filtre les effets `coupCritique` par `estUnCoupCritique`. */
  origine?: OrigineCritique;
  /** Le Critique ne pose aucune Blessure critique (`onCrit`) — seuls les effets `coupCritique` s'exercent.
   *  EDOC 07 l.334 ; #4202. */
  sansBlessureCritique?: boolean;
  /** `set` du store — fourni quand un Test de trigger peut être routé en cascade influençable (héros
   *  manuel) ou résolu inline (ennemi/auto). Câblé sur tous les `fireTriggers` de combat (onHit/
   *  onWoundLoss/onKill/onStartled/onRoundStart/Domaine + manœuvres) ; INERTE tant qu'aucune donnée de
   *  trigger ne porte un nœud Flow `test` au 1ᵉʳ niveau (seul Mâchoires d'acier en a un, `onGainCondition`,
   *  câblé via le hook du store). Absent → pas de routage (les flows non-`test` passent par
   *  `runPureFlowLines`, qui rend les entrées tissées inline par l'appelant). */
  set?: SetFn;
  /** Compte des effets EXERCÉS (passés par l'enveloppe `ciblesDeLEffet`), tenu par l'émetteur qui le fournit
   *  (`emitCombatEvent`). */
  exercices?: { n: number };
  /** Pose le drapeau `deferInteractiveTest` sur la résolution d'un Test routé : un porteur SURFACÉ
   *  (`surfaceOf` — un siège humain QUELCONQUE le tient, cadence manuelle) ne pousse PAS son étape ICI
   *  (la cascade n'est pas ouverte au moment où le hook `end-of-round` diffuse) — elle est COLLECTÉE par
   *  `collectHeroRoundEndUpkeep`, qui porte le prédicat MIROIR. Ce que personne ne tient (IA, cadence
   *  auto) reste résolu inline. */
  deferInteractiveTest?: boolean;
  /** `OpsCtx.onOpposingAdvantage` (Redoutable AA, `MDG 16 l.13`) — fourni par `turnHooks.fireTurnEdgeTriggers`
   *  pour `onTurnStart` ; threadé tel quel dans le `flowCtx` de CHAQUE effet (l'op `topUpAdvantage` porteuse
   *  du flag `feedOpposingPool` l'appelle). Absent ailleurs → clause inerte (cf. `engine/ops.ts`). */
  onOpposingAdvantage?: (n: number) => string[] }

/** Flow INTERACTIF (`flowHasTest`) atteint SANS `set` (la voie cadence-aware `routeTriggeredTest` en exige un) : un `test` TOP-LEVEL se joue
 *  inline ; toute autre forme n'a pas de voie d'interaction ici — ses parties PURES jouent (l'État
 *  automatique d'un Critique de Taillade), le nœud `choix` n'est PAS offert. Un `test` ENFOUI lève
 *  toujours (`resolveInlineFlowTest`) : une branche de jet muette n'est jamais acceptable. */
function resoudreSansRouteur(t: Combatant, actor: Combatant, flow: Flow, ctx: OpsCtx, get?: Get): EntreeDuJournal[] {
  if (flow.kind === 'test' || !flowHasChoiceSeulement(flow)) return resolveInlineFlowTest(t, actor, flow, ctx, get);
  return runPureFlowLines(t, actor, flow, ctx);
}

/** Le Flow ne doit son caractère interactif qu'à des nœuds `choix` (aucun `test` à jouer). */
function flowHasChoiceSeulement(flow: Flow): boolean {
  switch (flow.kind) {
    case 'effet': return true;
    case 'test': return false;
    // Un `choix` n'est PAS une feuille : ses branches portent souvent LE Test (« Vous pouvez… » →
    // jet, Déstabilisante). Sans descendre, un `test` enfoui sous un `choix` serait rendu MUET par
    // `runPureFlowLines`, qui n'a aucun `case 'choix'`.
    case 'choix': return flowHasChoiceSeulement(flow.oui) && (flow.non ? flowHasChoiceSeulement(flow.non) : true);
    case 'sequence': return flow.etapes.every(flowHasChoiceSeulement);
    case 'si': return flowHasChoiceSeulement(flow.alors) && (flow.sinon ? flowHasChoiceSeulement(flow.sinon) : true);
  }
}

/** Résolution INLINE d'un nœud `test` TOP-LEVEL sans routeur cadence-aware (entretien HORS COMBAT) —
 *  jumeau store-free de la branche NON-interactive de `resolveFlowTest` : jet du Test (`combatTestPenalty`
 *  comme un Test simple), puis branche `reussite`/`echec` jouée par `runPureFlowLines` (mêmes ops). Un `test`
 *  ENFOUI (hors top-level) LÈVE — un tel cas exige la voie cadence-aware (jamais de branche succès muette).
 *  `c` SUBIT le Test (son jet) ; `porteur` est le `caster` de la branche — même paire que la voie routée
 *  (`routeTriggeredTest(get, set, t, actor, …)`). */
function resolveInlineFlowTest(c: Combatant, porteur: Combatant, flow: Flow, ctx: OpsCtx, get?: Get): EntreeDuJournal[] {
  if (flow.kind !== 'test') throw new Error('resolveInlineFlowTest: nœud non-`test` (un test enfoui exige un routeur cadence-aware).');
  const ft = flow.test;
  // GATE (op-level groupes + Condition générique `gate`) + difficulté DYNAMIQUE (`difficultyBy`) :
  // SOURCE UNIQUE partagée avec la voie cascade (`resolveFlowTest`). Le `ConditionCtx` est construit de la
  // géométrie d'arène déjà injectée dans `ctx` par le dispatcher (Brisé : caché/Engagé/proximité). Gate
  // fermée ⇒ no-op (ni jet ni branche, comme `onlyGroups` — un Test top-level n'a pas d'`after`).
  const decision = resoudreFlowTest(ft, { cc: combatConditionCtx(c, ctx), sujet: c });
  if (!decision.joue) return [];
  // `base` BRUT (sans pénalité d'État) + `combatTestPenalty` une SEULE fois (RAW : −10 d'Empoisonné/Sonné/
  // Brisé compté une fois, LDB 16) — MÊME convention que `simpleTriggeredTestStep` (héros) → récupération identique.
  const base = rawCombatTestBase(c, ft);
  const { difficulty } = decision;
  const skillLabel = testSkillLabel(ft) ?? 'Test';
  const rng = ctx.rng;
  const res = rollTest({ porteur: c.id, teste: designeGaranti(ft, skillLabel) }, base, difficulty, rng, combatTestPenalty(c, { skill: ft.skill?.id }));
  const branch = res.success ? flow.reussite : flow.echec;
  const lines = [ligneDeTexte(traceLineOf({ who: nomDe(c), label: testTraceLabel(sujetDeTrace(ft, skillLabel, stepPrecision), difficulty), ...res })), ...runPureFlowLines(c, porteur, branch, { ...ctx, rng, caster: porteur, sl: res.sl })];
  // SEAM `onOwnTestFailed` (voie inline) : un Test déclenché RATÉ par le porteur émet le trigger (Crampes
  // abdominales, MSRC 16 l.152). La garde de RÉ-ENTRANCE de `fireOwnTestFailed` empêche un sous-Test résolu
  // ICI pendant le traitement (FM de palier 2) de ré-émettre. `get` absent (appelant sans store) ⇒ inerte.
  if (!res.success && get) lines.push(...fireOwnTestFailed(get, c, { sl: res.sl, rng }));
  return lines;
}

/** Écart d'Avantage de `actor` avec ses adversaires ENGAGÉS : `max(0, meilleur Avantage ennemi engagé −
 *  le sien)` (Instable, LDB 85 l.177 : « la différence entre son Avantage et celui supérieur de son
 *  adversaire »). Hors combat / sans foe engagé = 0. Calculé sur la `battle` (valeur relationnelle). */
function engagedAdvantageGap(get: Get, actor: Combatant): number {
  const battle = get().battle;
  if (!battle) return 0;
  const foes = engagesDe(actor, battle.combatants).filter((e) => e.kind !== actor.kind);
  if (!foes.length) return 0;
  return Math.max(0, Math.max(...foes.map((e) => e.advantage ?? 0)) - (actor.advantage ?? 0));
}

/** AVANCE d'Avantage de `actor` sur TOUS ses adversaires ENGAGÉS : `son Avantage − le meilleur Avantage
 *  ennemi engagé`, SIGNÉE et non bornée (≠ `engagedAdvantageGap` qui clampe à ≥ 0 l'excès ENNEMI). `> 0` =
 *  Avantage STRICTEMENT supérieur à tous (Absorption « si la créature a un Avantage plus élevé que tous les
 *  adversaires engagés », EDO 11 l.222). Hors combat / sans foe engagé = 0. Valeur RELATIONNELLE de l'arène. */
function engagedAdvantageLead(get: Get, actor: Combatant): number {
  const battle = get().battle;
  if (!battle) return 0;
  const foes = engagesDe(actor, battle.combatants).filter((e) => e.kind !== actor.kind);
  if (!foes.length) return 0;
  return (actor.advantage ?? 0) - Math.max(...foes.map((e) => e.advantage ?? 0));
}

/** Un adversaire VIVANT est-il dans la Ligne de Vue de `actor` ? Géométrie d'arène (au-dessus de
 *  `lineOfSightCover`, fumées/zones bloquantes incluses) alimentant la Condition `foeInLoS` : sortie de
 *  Frénésie (LDB 21 l.35), fuite/récupération du Brisé (LDB 16 l.52). Hors combat / sans position = false. */
export function hasFoeInLoS(get: Get, actor: Combatant): boolean {
  const { battle, scene } = get();
  if (!battle || !scene || !actor.pos) return false;
  return !sourcesEnVue(battle, scene, actor, (f) => f.kind !== actor.kind && !isOutOfAction(f)).next().done;
}

/** Les déclencheurs où le dispatcher pose le relevé d'arène du Round (`releveDeRound`) : `onRoundStart` (Condition
 *  `allieAuContact`, LDB 85 l.335) et `onRoundEnd` (géométrie du Brisé, LDB 16 l.54-56). */
const DECLENCHEURS_DU_RELEVE_DE_ROUND: readonly EffectTrigger[] = ['onRoundStart', 'onRoundEnd'];

/** GÉOMÉTRIE DE RÉCUPÉRATION du Brisé pour `actor`, lue par les Conditions `hiddenFromFoes`, `engaged` et `nearestFoe`
 *  (auto-retrait caché, gate du Test, difficulté par proximité ; LDB 16 l.54-56), partagée par le dispatcher et le
 *  collecteur des Tests de fin de Round (`collectRoundEndTestSteps`) :
 *  - `hiddenFromFoes` : aucun adversaire vivant ne voit l'acteur (sens foe→acteur, `tileSeenByFoe`), faux sans
 *    adversaire. LDB 16 l.56
 *  - `engaged` : l'acteur est Engagé. LDB 16 l.54
 *  - `nearestFoeDist` : distance (cases) à l'adversaire vivant le plus proche. LDB 16 l.54
 *  RNG-free → identique côté inline (ennemi/auto) et côté cascade (héros). Hors combat / sans position = neutre. */
export function geometrieDuBrise(get: Get, actor: Combatant): { hiddenFromFoes: boolean; engaged: boolean; nearestFoeDist: number } {
  const { battle, scene } = get();
  if (!battle || !actor.pos) return { hiddenFromFoes: false, engaged: false, nearestFoeDist: Infinity };
  const foes = battle.combatants.filter((e) => e.kind !== actor.kind && !isOutOfAction(e) && e.pos);
  const hiddenFromFoes = !!scene && foes.length > 0 && !tileSeenByFoe(scene, foes, actor.pos, smokeOf(battle));
  const nearestFoeDist = foes.length ? Math.min(...foes.map((e) => chebyshev(actor.pos!, e.pos!))) : Infinity;
  return { hiddenFromFoes, engaged: isEngaged(actor, battle.combatants), nearestFoeDist };
}

/** RELEVÉ D'ARÈNE DU ROUND pour `actor`, que le dispatcher pose aux `DECLENCHEURS_DU_RELEVE_DE_ROUND` : la géométrie du
 *  Brisé (`geometrieDuBrise`) et les alliés au contact (`alliesAuContactParmi`) de la Condition `allieAuContact`, en vues
 *  d'acteur À PLAT (sans accesseur), portables par le `meta` d'une étape différée. LDB 85 l.335 */
export function releveDeRound(get: Get, actor: Combatant): ReturnType<typeof geometrieDuBrise> & { alliesAuContact: ActorView[] } {
  const { battle, scene } = get();
  const alliesAuContact = battle && actor.pos
    ? alliesAuContactParmi(scene, battle.combatants, actor).flatMap((a) => { const vue = buildActorView(a); return vue ? [{ ...vue }] : []; })
    : [];
  return { ...geometrieDuBrise(get, actor), alliesAuContact };
}

/** Verdict `cibleEnVue` de l'instance `affliction` de `actor` parmi les sources en vue (combattants en Ligne
 *  de Vue, étiquette de la scène) ; `undefined` hors combat, sans instance ou sans Cible. */
function mesurerCibleEnVue(get: Get, actor: Combatant, affliction: PsychAffliction | undefined): CibleEnVue | undefined {
  const { battle, scene, campaignNarratif } = get();
  if (!battle || !scene || affliction?.cible === undefined) return undefined;
  return cibleEnVue(actor, affliction, sourcesPsyEnVue(battle, scene, actor, (s) => !s.dead, objetDuNarratif(campaignNarratif)));
}

/** ENVELOPPE d'un effet déclenché : les combattants où `eff` s'exerce pour `trigger` dans `ctx` — vide
 *  quand l'effet ne réagit pas à cet événement. SOURCE UNIQUE lue par le bus (`applyTriggeredEffects`) et par le
 *  résolveur des attaques gratuites (`resolveFreeAttacks`, combatFlow) : un effet s'exerce aux MÊMES conditions
 *  quel que soit son émetteur. */
export function ciblesDeLEffet(
  get: Get, actor: Combatant, eff: TriggeredEffect, trigger: EffectTrigger,
  ctx: Pick<TriggerCtx, 'victim' | 'conditionName' | 'attackType' | 'origine' | 'sansBlessureCritique'>,
): Combatant[] {
  if (eff.trigger !== trigger) return [];
  // Filtre `onGainCondition` : ne réagit qu'à l'État effectivement gagné (Mâchoires → 'sonne').
  if (eff.condition && eff.condition !== ctx.conditionName) return [];
  // Filtre par TYPE d'attaque (onHit/onWoundLoss) : un effet `attackType` ne réagit qu'à ce type.
  if (eff.attackType && eff.attackType !== ctx.attackType) return [];
  if (eff.coupCritique && !estUnCoupCritique(ctx.origine)) return [];
  if (ctx.sansBlessureCritique && !eff.coupCritique) return [];
  return targetsFor(get, actor, eff.on, ctx.victim).filter((t) =>
    // LDB 13 l.171 ; #4372
    (eff.on !== 'engages' || trigger !== 'onRoundStart' || resteEngageAuRoundSuivant(actor, t))
    // On n'applique pas un effet à une cible DÉJÀ hors de combat (pas d'éclaboussure sur un cadavre) —
    // SAUF le PORTEUR réagissant à SON PROPRE événement (`on:'self'`) : une unité doit pouvoir réagir à
    // sa propre chute (Démoniaque banni à 0 PB, futur « éclate/se dédouble à la mort »). Les déclencheurs
    // de FRONTIÈRE de round (`onRoundEnd`/`onRoundStart`) filtrent eux-mêmes les hors-combat côté appelant.
    && !(isOutOfAction(t) && t.id !== actor.id)
    // Effet OPT-IN (`optional`, RAW « Vous pouvez… » — Contrôle de la Frénésie LDB 10) : seul un porteur
    // SURFACÉ décide (`surfaceOf` — le siège qui le tient, quel qu'il soit, en cadence manuelle ; fin de
    // Round : sauté par le bus, COLLECTÉ en étape de CHOIX par
    // `collectRoundEndTestSteps`). IA / cadence auto ne l'exercent JAMAIS — ni décision silencieuse ni
    // jet caché (la sortie rationnelle de l'IA — plus d'ennemi en vue — est déjà l'effet AUTO de
    // psychology.json). MÊME prédicat que la porte du choix (`resolveFlowChoice`) et que celle du Test
    // (`resolveFlowTest`) : décider, dépenser et rouler appartiennent au MÊME siège.
    && !(eff.optional && !surfaceOf(get, t.id)));
}

/** Le Flow qu'un porteur SURFACÉ joue pour `eff` : un effet OPT-IN est emballé dans un nœud `choix`
 *  (Oui/Renoncer) — le « Vous pouvez » RAW devient une étape de choix. */
export function flowOffert(eff: TriggeredEffect): Flow {
  return eff.optional
    ? { kind: 'choix', invite: eff.flow.kind === 'test' ? (eff.flow.test.label ?? 'Réaction') : 'Réaction', oui: eff.flow, non: EMPTY_FLOW }
    : eff.flow;
}

/** CŒUR d'application : applique une LISTE d'effets `TriggeredEffect` de `actor` correspondant à
 *  `trigger`, chacun via `runPureFlowLines` aux cibles résolues (`on`) — via `runCombatFlow` s'il porte une op
 *  IMPURE (`flowHasImpureOp`) et que le contexte porte `set`. Source UNIQUE : utilisé par
 *  `fireTriggers` (effets de traits/atouts) ET par les manœuvres (effets du profil de manœuvre).
 *  Un effet dont le Flow est un nœud `test` ET pour lequel `ctx.set` est fourni (hook
 *  `onGainCondition`) est ROUTÉ vers la voie cadence-aware (jamais la branche succès silencieuse).
 *  Un Flow qui accorde une attaque gratuite (`flowHasFreeAttack`) n'est PAS joué ici : son seul émetteur
 *  est `resolveFreeAttacks` (combatFlow), qui tient le tiers visé (LDB 10 l.500). */
export function applyTriggeredEffects(
  get: Get, actor: Combatant, effects: TriggeredEffect[], trigger: EffectTrigger, ctx: TriggerCtx,
): EntreeDuJournal[] {
  const lines: EntreeDuJournal[] = [];
  const rng = ctx.rng;
  const resolveTrapping = objetDuNarratif(get().campaignNarratif);
  // Valeur RELATIONNELLE de combat calculée UNE fois pour le porteur (battle-aware) : écart d'Avantage
  // avec ses adversaires Engagés (Instable, LDB 85 l.177). Voyage dans l'opsCtx → Formula/Condition.
  const gap = ctx.engagedAdvantageGap ?? engagedAdvantageGap(get, actor);
  const lead = ctx.engagedAdvantageLead ?? engagedAdvantageLead(get, actor);
  const foeInLoS = ctx.foeInLoS ?? hasFoeInLoS(get, actor);
  // Relevé d'arène du Round (Brisé caché/Engagé/proximité, alliés au contact) — battle-aware, calculé UNE fois pour le
  // porteur, et SEULEMENT aux déclencheurs de Round, les seuls qui le consomment (LDB 16 l.54-56 ; LDB 85 l.335 : la
  // grammaire y borne `allieAuContact`), pour ne pas peser sur les déclencheurs d'attaque.
  const geom = DECLENCHEURS_DU_RELEVE_DE_ROUND.includes(trigger) ? releveDeRound(get, actor) : undefined;
  // Verdict de l'instance sur sa Cible en vue (Condition `cibleEnVue`), mesuré au premier effet qui joue.
  let verdict: { v: CibleEnVue | undefined } | undefined;
  const cibleEnVueDeLInstance = (): CibleEnVue | undefined => (verdict ??= { v: mesurerCibleEnVue(get, actor, ctx.affliction) }).v;
  for (const eff of effects) {
    if (flowHasFreeAttack(eff.flow)) continue;
    for (const t of ciblesDeLEffet(get, actor, eff, trigger, ctx)) {
      if (ctx.exercices) ctx.exercices.n++;
      // Flow PORTANT un nœud `test` (à n'importe quelle profondeur — top-level Mâchoires, ou enfoui sous
      // `si`/`sequence` : Venin/Hurlement/2 enchants) routé vers la voie cadence-aware (héros manuel → cascade
      // influençable ; ennemi/auto → inline) plutôt qu'avalé silencieusement — seulement si l'appelant
      // fournit `set`. Un Flow `test` non routé (pas de `set`) atteindrait
      // `runPureFlowLines`, qui LÈVE (jamais de branche succès muette). Le contexte de la touche
      // (`woundsDealt`/`margin→sl`/`location`/`attackKind`) voyage dans l'opsCtx pour les Conditions `si`.
      const flowCtx: OpsCtx = { rng, idNeuf: get().forgerUnId, resolveTrapping, caster: actor, sl: ctx.margin, source: eff.source, woundsDealt: ctx.woundsDealt, indice: ctx.indice, stacks: ctx.stacks, engagedAdvantageGap: gap, engagedAdvantageLead: lead, foeInLoS, affliction: ctx.affliction, cibleEnVue: cibleEnVueDeLInstance(), location: ctx.location, attackKind: ctx.attackKind, startleCause: ctx.startleCause, hiddenFromFoes: geom?.hiddenFromFoes, engaged: geom?.engaged, nearestFoeDist: geom?.nearestFoeDist, alliesAuContact: geom?.alliesAuContact, onOpposingAdvantage: ctx.onOpposingAdvantage, ...campAdvantageHooks(get),
        ...(ctx.set ? crochetsDeCorruption(get, ctx.set) : {}),
        // Tampon de ré-entrance : un sous-Test (FM de palier 2 des Crampes) routé en cascade ne ré-émettra
        // pas `onOwnTestFailed` (son étape porte `meta.noOwnTestFailed`, cf. resolveFlowTest/commitStep).
        ...(trigger === 'onOwnTestFailed' ? { noReentryOwnTestFailed: true } : {}) };
      if (flowHasTest(eff.flow)) {
        // Test de FIN DE ROUND (`deferInteractiveTest`, posé par le hook `end-of-round` : la cascade n'est
        // pas encore ouverte) : un porteur SURFACÉ (`surfaceOf` — un siège humain QUELCONQUE le tient,
        // cadence manuelle) est COLLECTÉ par `collectHeroRoundEndUpkeep` (on saute ici) ; personne au
        // pilotage / cadence auto → résolu INLINE (lignes RENDUES → sinkées dans le journal comme les dégâts).
        // Prédicat MIROIR de celui du collecteur : le décaler d'un côté PERD le Test (ni différé ni collecté)
        // ou le DOUBLE (inline + étape).
        if (ctx.deferInteractiveTest) {
          if (surfaceOf(get, t.id)) continue;
          lines.push(...resoudreSansRouteur(t, actor, eff.flow, flowCtx, get));
          continue;
        }
        // Le gain et l'entretien des États confient leur suite à la cascade pendant le Test.
        // Les effets opt-in passent par le même Flow de choix.
        if (ctx.set) {
          routeTriggeredTest(get, ctx.set, t, actor, flowOffert(eff), flowCtx, trigger === 'onGainCondition' || trigger === 'onRoundEnd');
          continue;
        }
        if (eff.optional) continue;
        lines.push(...resoudreSansRouteur(t, actor, eff.flow, flowCtx, get));
        continue;
      }
      // Op IMPURE (`zone`…) : le walker de COMBAT la résout par son crochet, le chemin pur l'avalerait. Son journal
      // part dans la file différée (`enfilerAuJournal`), drainée par l'émetteur.
      if (ctx.set && flowHasImpureOp(eff.flow)) {
        runCombatFlow({ get, set: ctx.set, target: t, caster: actor, label: nomDeSource(flowCtx), opsCtx: flowCtx }, eff.flow);
        continue;
      }
      lines.push(...runPureFlowLines(t, actor, eff.flow, flowCtx));
    }
  }
  return lines;
}

/**
 * DISPATCHER UNIQUE des effets déclenchés de `actor` pour un `trigger` — SOURCE UNIQUE, sans code
 * spécifique par KIND d'entité ni par trigger. Réunit TOUTES les sources d'effets portées par le
 * combattant : Traits, Talents, Atouts d'arme (`effectsOf`) ET États (`fireConditionEffects`, qui
 * apporte le `stacks` de chaque État). Maladies et Mutations portent AUSSI leurs propres `effects`
 * (symptômes actifs ; `mutations.json` résolu au registre) — énumérés par `effectSourcesOf` comme
 * les autres, sans chemin dédié. Ajouter une source =
 * l'AJOUTER ICI, jamais un nouveau chemin de dispatch. (Effets propres à une MANŒUVRE = scoped à son
 * profil via `maneuverEffectsOf`.)
 */
export function fireTriggers(get: Get, actor: Combatant, trigger: EffectTrigger, ctx: TriggerCtx): EntreeDuJournal[] {
  const lines = applyTriggeredEffects(get, actor, effectsOf(actor, objetDuNarratif(get().campaignNarratif), ctx.weapon), trigger, ctx);
  lines.push(...fireConditionEffects(get, actor, trigger, ctx)); // États dispatchés EXACTEMENT comme Traits
  lines.push(...firePsychEffects(get, actor, trigger, ctx)); // états PSY (Frénésie…) — MÊME folding générique
  return lines;
}

/** Garde de RÉ-ENTRANCE du trigger `onOwnTestFailed` : un Test résolu PENDANT le traitement (le FM de
 *  palier 2 des Crampes, MSRC 16 l.156) ne DOIT jamais ré-émettre le trigger (sinon boucle). Drapeau MODULE
 *  (le traitement est synchrone : pose→fireTriggers→dépose). */
let firingOwnTestFailed = false;

/** Reset du drapeau de re-entrance `onOwnTestFailed` pour le point de reset CANONIQUE des singletons de test
 *  (`src/test-setup.ts`, `isolate:false`). Le drapeau s'auto-reinitialise (try/finally) ; ce reset est un FILET
 *  explicite conforme a la doctrine « tout nouveau singleton module-level se remet a zero entre tests ». */
export function resetOwnTestFailedGuard(): void { firingOwnTestFailed = false; }

/**
 * ÉMETTEUR UNIQUE du trigger `onOwnTestFailed` (le porteur vient d'ÉCHOUER un Test — `sl` = DR négatif de
 * l'échec, alimente `ctx.margin`→`ctx.sl` des paliers `slThreshold`). Câblé à TOUS les points de
 * convergence de résolution d'un Test d'un combattant (chemin modal joueur, jets inline déclenchés, tests
 * différés d'entretien). Garde-fous : (a) EARLY-OUT si l'acteur ne porte aucune source `onOwnTestFailed`
 * (zéro coût pour la quasi-totalité des combattants) ; (b) RÉ-ENTRANCE : inerte si déjà en cours d'émission.
 * `actor` : le Combatant ou son id (résolu combat-ou-groupe). CADENCE-AWARE : `set` fourni (seam combat à
 * cascade — chemin modal joueur) ⇒ un sous-Test (FM de palier 2) est routé (héros → modale influençable ;
 * PNJ → inline) ; `set` absent (hors combat, inline) ⇒ sous-Test inline. La ré-entrance tient dans les deux
 * cadences (drapeau module pour l'inline synchrone + tampon `noOwnTestFailed` sur l'étape de cascade).
 */
export function fireOwnTestFailed(get: Get, actor: Combatant | string, opts: { sl: number; rng: RNG; set?: SetFn }): EntreeDuJournal[] {
  if (firingOwnTestFailed) return []; // ré-entrance SYNCHRONE (sous-Test inline du palier 2) → jamais de ré-émission
  const a = typeof actor === 'string' ? porteurParId(get(), actor) : actor;
  if (!a) return [];
  // EARLY-OUT : aucune source (symptôme/trait/état…) ne porte ce trigger → rien à faire (coût quasi nul).
  if (!effectSourcesOf(a, objetDuNarratif(get().campaignNarratif)).some((s) => s.effects.some((e) => e.trigger === 'onOwnTestFailed'))) return [];
  firingOwnTestFailed = true;
  try {
    return fireTriggers(get, a, 'onOwnTestFailed', { margin: opts.sl, rng: opts.rng, set: opts.set });
  } finally {
    firingOwnTestFailed = false;
  }
}

/** CŒUR GÉNÉRIQUE du folding des STATUTS portés (États OU psy) : applique les `effects` de
 *  chaque statut pour `trigger`, avec son nombre de pions (`stacks`). SOURCE UNIQUE — `fireConditionEffects`
 *  et `firePsychEffects` y délèguent (zéro copie du cœur `applyTriggeredEffects`). Le `[...snapshot]` côté
 *  appelant protège l'itération d'une auto-dissipation (`removeCondition`/`endPsych`) qui mute la collection. */
function fireStatusEffects(
  get: Get, c: Combatant, trigger: EffectTrigger, ctx: TriggerCtx,
  statuses: { effects?: TriggeredEffect[]; stacks: number; affliction?: PsychAffliction }[],
): EntreeDuJournal[] {
  const lines: EntreeDuJournal[] = [];
  for (const s of statuses) {
    if (!s.effects?.length) continue;
    lines.push(...applyTriggeredEffects(get, c, s.effects, trigger, { ...ctx, stacks: s.stacks, ...(s.affliction ? { affliction: s.affliction } : {}) }));
  }
  return lines;
}

/**
 * Déclenche les `effects` data-driven des ÉTATS portés par `c` (Empoisonné « 1 PB/pion » via `onRoundEnd`…).
 * Chaque État est joué avec `ctx.stacks = ses pions`, RÉDUITS d'une capacité de la cible s'il le déclare
 * (Hémorragique − Endurci `bleedIgnore`, LDB 10 — générique, jamais par-nom). Inerte sans `effects`.
 */
export function sourcesDEtats(c: Combatant, resolveTrapping: TrappingResolver): TriggerSource[] {
  return effectSourcesOf(c, resolveTrapping).filter((s) => s.key.startsWith('cond:'));
}

export function fireConditionEffects(get: Get, c: Combatant, trigger: EffectTrigger, ctx: TriggerCtx): EntreeDuJournal[] {
  return fireStatusEffects(get, c, trigger, ctx, sourcesDEtats(c, objetDuNarratif(get().campaignNarratif)).map((s) => ({ effects: s.effects, stacks: s.stacks ?? 1 })));
}

/**
 * Déclenche les `effects` data-driven des états PSYCHOLOGIQUES portés par `c` (leurs fins, LDB 21 l.19, l.35,
 * l.39, l.48), une instance ciblée avec son `affliction`. MÊME cœur que les États (`fireStatusEffects`) ; la donnée
 * vit dans `psychology.json`. Inerte tant que `psychState` ne porte aucun type doté d'`effects`.
 */
export function firePsychEffects(get: Get, c: Combatant, trigger: EffectTrigger, ctx: TriggerCtx): EntreeDuJournal[] {
  return fireStatusEffects(get, c, trigger, ctx, effectSourcesOf(c, objetDuNarratif(get().campaignNarratif)).filter((s) => s.key.startsWith('psy:')).map((s) => ({ effects: s.effects, stacks: s.stacks ?? 1, affliction: s.affliction })));
}

/** Effets AUTHORÉS d'une MANŒUVRE, tagués de leur manœuvre source (`withSource`) — SOURCE UNIQUE des
 *  deux entrées : le chemin de mêlée FREE (`maneuverEffectsOf`, par `kind`) et la résolution de manœuvre
 *  (`applyManeuverEffects`, qui tient déjà la `def`). L'identité de l'entité voyage donc dans l'`OpsCtx`
 *  jusqu'aux `ActiveEffect` posés ET jusqu'à l'enjeu d'un Test qu'elle exige (#1262 V2 L6d). */
export function maneuverEffects(def: { id: string; effects?: TriggeredEffect[] }): TriggeredEffect[] {
  return withSource(def.effects ?? [], { kind: 'manoeuvre', id: def.id });
}

/** Effets onHit AUTHORÉS de la manœuvre `kind` de `actor` (Caudale → À Terre, Tentacules → Empêtré…) —
 *  lus de la DÉFINITION que porte la liste unique `attaquesNaturelles` (manœuvres de ses traits, et
 *  d'écart de Taille, ouvertes sans trait). Vide si `actor` n'a pas cette manœuvre. Sert le chemin de mêlée FREE
 *  (`freeKind` → arme + onHit) : la touche est résolue comme un coup d'arme, mais les États propres à
 *  la manœuvre (À Terre/Empêtré) viennent de SA donnée éditable. TAGUÉS de leur manœuvre source
 *  (`withSource`, comme toute autre source du dispatcher) : la pastille d'effet ouvre sa fiche, et un
 *  Test qu'elle exige en dérive son enjeu (#1262 V2 L6d). */
export function maneuverEffectsOf(actor: Combatant, kind: string): TriggeredEffect[] {
  const def = attaqueNaturelle(actor.traits ?? [], kind)?.def;
  return def ? maneuverEffects(def) : [];
}
