/**
 * VUE d'acteur (`ActorView`) et CONTEXTE d'évaluation d'une `Condition` — SOURCE UNIQUE, côté moteur.
 *
 * Une seule projection d'un Combattant vers l'algèbre `Condition` : Flows de combat, gates d'effet
 * déclenché et VERROUS d'État (`ConditionInstance.lockedUntil`, LDB 18) évaluent leurs prédicats
 * contre la MÊME vue. Un sujet que la vue ne porte pas ne s'évalue jamais à une valeur par défaut
 * muette : il est refusé AU PARSE (`data/schemas/grammaire/mecanique.ts`).
 *
 * `state/combat/flowEval.ts` compose ce constructeur et l'enrichit du contexte de RÉSOLUTION (DR,
 * localisation, géométrie d'arène) que seul le combat connaît.
 */
import { type Combatant, type CharKey, type TalentInstance, CHAR_KEYS } from './types';
import { effectiveChar } from './characteristics';
import { SIZE_ORDER, effectiveSize } from './size';
import { campOf } from './relations';
import { aggregateCapabilities, chaosDomainOf } from './combatFeatures/dispatch';
import { aPassifVisible } from './trauma';
import type { ActorView, ConditionCtx } from './flowCore';

/** Talents d'un porteur tels que la Condition `has` `what: 'talent'` les lit. */
const talentsDeLaVue = (talents: TalentInstance[] | undefined): ActorView['talents'] => (talents ?? []).map((t) => ({ id: t.talentId, spec: t.spec }));

/** Vue d'un combattant pour les Conditions d'acteur (`compare`/`relation`/`has`/`capability`) : PB +
 *  Taille/Avantage + camp + appartenances (Groupes/Talents/Traits) + valeur d'États par nom + niveau des
 *  Capacités de combat agrégées. */
export function buildActorView(c: Combatant | undefined): ActorView | undefined {
  if (!c) return undefined;
  const vue: ActorView = {
    id: c.id, woundsCurrent: c.wounds.current, woundsMax: c.wounds.max, size: SIZE_ORDER[effectiveSize(c.size)],
    advantage: c.advantage ?? 0, camp: campOf(c),
    groups: c.groups ?? [], talents: talentsDeLaVue(c.talents), traits: (c.traits ?? []).map((t) => t.id),
    conditions: Object.fromEntries((c.conditions ?? []).map((x) => [x.id, x.value ?? 1])), capabilities: aggregateCapabilities(c),
    ...(chaosDomainOf(c) ? { chaosDomain: chaosDomainOf(c) } : {}),
    // États psy ACTIFS (un trait ciblé RÉSISTÉ — `active:false` — ne compte pas comme « possédé »).
    psych: (c.psychState ?? []).filter((p) => p.active !== false).map((p) => p.type),
    chars: Object.fromEntries(CHAR_KEYS.map((k) => [k, effectiveChar(c, k)])) as Record<CharKey, number>,
  };
  // `visiblePassive` est PARESSEUX : `aPassifVisible` rebalaie tout le collecteur `passiveMods`
  // (séquelles, maladies, faim/soif, ivresse…), et une seule famille de `Condition` le lit. La vue se
  // rebâtit à CHAQUE évaluation de Condition — l'accesseur ne balaie qu'au premier accès, et mémoïse
  // pour les suivants. `enumerable` : la vue reste copiable à plat (`{...vue}`) sans perdre le champ.
  let visible: boolean | undefined;
  Object.defineProperty(vue, 'visiblePassive', {
    get: () => (visible ??= aPassifVisible(c)),
    enumerable: true,
    configurable: true,
  });
  return vue;
}

/**
 * Contexte d'évaluation d'un VERROU d'État (`lockedUntil`, LDB 18) : le porteur est à la fois la CIBLE
 * et le référent du prédicat — un verrou est une propriété de CELUI qui porte l'État. Ce que ce
 * contexte garantit est exactement ce que le parse admet ; le reste (drapeaux de scène, horloge,
 * bourse, groupe) est REFUSÉ à l'authoring plutôt qu'évalué faux en silence.
 */
export function conditionLockCtx(c: Combatant): ConditionCtx {
  const vue = buildActorView(c);
  return { flags: {}, gameTime: 0, target: vue, caster: vue };
}

/**
 * Contexte d'évaluation d'une EXCLUSION d'apprentissage (`TalentData.exclusion`) : le porteur vu par ses
 * seuls Talents — un personnage en création n'a encore ni Blessures, ni camp, ni États. Le parse
 * (`estSujetDApprentissage`, data/schemas/grammaire/mecanique.ts) refuse toute autre Condition : les
 * autres champs de cette vue ne sont jamais lus.
 */
export function conditionApprentissageCtx(porteur: { talents?: TalentInstance[] }): ConditionCtx {
  const vue: ActorView = {
    id: '', woundsCurrent: 0, woundsMax: 0, size: 0, advantage: 0, camp: 'party', groups: [], traits: [], conditions: {},
    chars: Object.fromEntries(CHAR_KEYS.map((k) => [k, 0])) as Record<CharKey, number>,
    talents: talentsDeLaVue(porteur.talents),
  };
  return { flags: {}, gameTime: 0, target: vue, caster: vue };
}
