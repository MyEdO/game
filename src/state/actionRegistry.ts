/**
 * REGISTRE DES ACTIONS — le CODE derrière `src/data/actions.json` (spec HUD « Zone 12 »).
 *
 * Trois tables, trois responsabilités, aucune logique en JSON :
 *  - `ACTION_GATES`    — les PRÉDICATS d'offre, par id. Source UNIQUE : `CombatConsole` et `turnEconomy`
 *                        les consomment (ils en tenaient chacun une dérivation manuscrite, et la
 *                        divergence a déjà coûté un bug — Détermination, commit `0e14119b`).
 *  - `ACTION_CANDIDATES` — les SÉLECTEURS impurs (listes de cibles/objets), enveloppes NOMMÉES des
 *                        fonctions existantes : aucune n'est réécrite ici.
 *  - `ACTION_RUN`      — les DISPATCHERS : une entrée par méthode `battle*` du store.
 *
 * `runAction(id, get, ctx)` est la porte unique : le clavier, la console et les pastilles y passent,
 * plus jamais par des closures anonymes publiées positionnellement.
 */
import type { Combatant } from '../engine/types';
import type { BattleState, GameState } from './store';
import { canMove, trampleTarget, entityPickables, activeCombatant } from './store';
import { currentTargetingMode } from './targetingModes';
import { canTakeAction, hasCondition, isOutOfAction } from '../engine/conditions';
import { findConditionById } from '../data';
import { isEngaged } from '../engine/engagement';
import { isFrenzied } from '../engine/psychology';
import { isVehicle } from '../engine/vehicle';
import { compatibleAmmo } from '../engine/items';
import { isConsumable } from '../engine/consumables';
import { hasFreeWeaponAttack, selfManeuversOf, selfManeuverApplicable, battementFoes, distraireFoes } from './combatManeuvers';
import { inBattleId } from './combatants';
import { wastesAction, endTurnArmed } from './endTurnGuard';
import { healableTargets } from '../engine/healing';
import { waterSprayCandidates } from '../engine/suffocation';
import { dispellableSpellsOn } from '../engine/dispel';
import { combatAdvantageSkills } from '../engine/skillCombatApps';
import { availableAttacks, placingZoneOf, STANCE_BLOCK } from './combatFlow';
import { mountablesNear, mountMovement } from './mount';
import { servablePostes, crewPosteOf, type ShipPoste } from './shipPostes';
import { pushSlot } from './siegePush';
import { ACTIONS, findSpellById, type ActionDef } from '../data/index';
import { isArcaneSpell, castBlockedBy, focusSkillFor, focusWindLabel } from '../engine/magic';
import { t } from '../i18n';
import { chebyshev } from '../engine/grid';

/** Verdict d'un gate : l'indisponibilité PORTE SA RAISON (patron `GatedAction`, charte UI). */
export interface ActionGate {
  ok: boolean;
  reason?: string;
}

/** Contexte d'évaluation — PUR : l'acteur et son combat suffisent aux prédicats de règle. Les rares
 *  gates de TABLE (coop) lisent `netMode`, jamais le store entier. */
export interface ActionCtx {
  active: Combatant;
  battle: BattleState;
  netMode?: string;
  /** L'ENTRÉE elle-même, posée par `actionGate` : un gate peut lire ce que SON action DÉCLARE (l'État
   *  qu'elle traite, `rule` + `ruleCategory: 'etats'`) au lieu de nommer un id. Jamais fourni par un
   *  appelant — c'est la porte de lecture qui l'attache. */
  def?: ActionDef;
  /** PARAMÈTRES DE LA CASE (`ActionRunCtx` — la Compétence visée, l'arme, l'objet) : une entrée du
   *  registre peut être rendue N fois, une par candidat, et le verdict d'offre porte alors sur CE
   *  candidat (« au plafond de CETTE méthode d'Avantage »). Les gates de règle pure les ignorent ; le
   *  dispatcher reçoit exactement les mêmes (`runAction`), d'où une seule et même mesure. */
  args?: ActionRunCtx;
}

/** Nom du gate « ÉTAT PORTÉ » — NOMMÉ, parce que deux lecteurs le désignent : la donnée
 *  (`actions.json`) et le producteur de pools, qui mesure PAR LUI la pertinence d'une case de remède. */
export const GATE_ETAT_PORTE = 'etat-porte';
/** Nom du gate « REMÈDE ATTEIGNABLE » — le second étage : l'État est bien là, mais le geste qui l'ôte
 *  est-il possible MAINTENANT ? Séparé de la PERTINENCE (`etat-porte`) parce que les deux verdicts ont
 *  deux effets différents à l'écran : le premier décide qu'une case EXISTE, le second qu'elle est
 *  OFFERTE — une case refusée reste DESSINÉE et dit pourquoi (patron de la console). */
export const GATE_REMEDE_ATTEIGNABLE = 'remede-atteignable';

const ok: ActionGate = { ok: true };
const no = (reason: string): ActionGate => ({ ok: false, reason });

/** L'Action du Tour est-elle encore disponible ET utilisable ? (Sonné/Inconscient → `canTakeAction`).
 *  Périmètre STRICT de l'économie du tour : les restrictions d'ÉTAT propres à une famille d'actes
 *  (Brisé interdit l'offensive, Frénésie ferme tout sauf CC/Athlétisme) sont des gates à part. */
function actionLibre({ active, battle }: ActionCtx): ActionGate {
  if (battle.acted) return no(t('agate.actionSpent'));
  if (!canTakeAction(active)) return no(t('agate.unableToAct'));
  return ok;
}

/** Désengagement (LDB 15 l.45-49) : l'option d'Esquive coûte l'Action, l'option d'Avantage non —
 *  d'où un gate qui reste ouvert Action dépensée quand l'Avantage est strictement supérieur. */
function desengagementGate(ctx: ActionCtx): ActionGate {
  const { active, battle } = ctx;
  if (!isEngaged(active)) return no(t('agate.notEngaged'));
  if (!battle.acted) return ok;
  return freeDisengage(ctx) ? ok : no(t('agate.actionSpentNoFreeDisengage'));
}

/** Le désengagement est-il GRATUIT ? Avantage strictement supérieur à TOUS les foes Engagés encore
 *  en jeu (LDB 15 l.45-49, « Utiliser l'Avantage »). Prédicat PARTAGÉ (barre + économie du tour). */
export function freeDisengage({ active, battle }: ActionCtx): boolean {
  if (!isEngaged(active)) return false;
  const foes = (active.engagedWith ?? [])
    .map((id) => inBattleId(battle, id))
    .filter((c): c is Combatant => !!c && !isOutOfAction(c));
  return foes.length > 0 && active.advantage > Math.max(0, ...foes.map((f) => f.advantage));
}

/** Le Mouvement du Tour est-il ENCORE INTACT ? Prédicat PARTAGÉ (gestes qui exigent l'élan complet). */
function mouvementIntact({ active, battle }: ActionCtx): ActionGate {
  // Un porteur qu'un État CLOUE (`gating.movement: 'none'` — Inconscient, Surpris ; LDB 16 l.113/l.132)
  // n'a aucun Mouvement à dépenser : le geste qui en coûte se REFUSE en le disant, au lieu de laisser
  // le dispatcher rendre en silence. Le budget est celui de la monture s'il en a une (`mountMovement`).
  if (mountMovement(battle, active) <= 0) return no(t('agate.cannotMove'));
  return battle.movementUsed > 0 ? no(t('agate.movementStarted')) : ok;
}

/** L'acteur a-t-il un CORPS de fantassin ? Une coque n'en a pas (`engine/vehicle.ts` : « ni arme
 *  tenue, ni sort, ni marche de fantassin ») : les gestes du corps — marcher, courir, se mettre sur
 *  la défensive — ne lui sont pas offerts, et le refus le DIT au lieu de dépenser son Action. Un
 *  navire agit par ses Tests d'équipage et sa barre. */
function fantassin({ active }: ActionCtx): ActionGate {
  return isVehicle(active) ? no(t('agate.hullHasNoBody')) : ok;
}

/** ET séquentiel de gates : le PREMIER refus l'emporte, avec SA raison (aucune raison fabriquée). */
const et =
  (...gates: ((ctx: ActionCtx) => ActionGate)[]) =>
  (ctx: ActionCtx): ActionGate => {
    for (const g of gates) {
      const v = g(ctx);
      if (!v.ok) return v;
    }
    return ok;
  };

/** Les PRÉDICATS d'offre du registre, par id (`gate` de `actions.json`). */
export const ACTION_GATES: Record<string, (ctx: ActionCtx) => ActionGate> = {
  toujours: () => ok,
  'action-libre': actionLibre,
  'action-libre-hors-frenesie': (ctx) =>
    isFrenzied(ctx.active) ? no(t('agate.frenzyOnly')) : actionLibre(ctx),
  'action-libre-hors-frenesie-fantassin': (ctx) =>
    et(fantassin, ACTION_GATES['action-libre-hors-frenesie'])(ctx),
  'mouvement-intact': mouvementIntact,
  'mouvement-restant-fantassin': (ctx) => et(fantassin, ACTION_GATES['mouvement-restant'])(ctx),
  /** MIROIR de la garde de `cancelMove` (`combatSlice.ts:975-979`) : le segment restaurable est le
   *  SNAPSHOT, pas le compteur — `battleStandUp` écrit `movementUsed` sans en poser un, et le
   *  dispatcher n'aurait rien à défaire. Le contrôle du siège n'entre pas ici (il est au dispatcher
   *  et aux contextes de surface : `live` pour la console, `cur` pour la touche). */
  'deplacement-annulable': ({ battle }) => {
    if (!battle.moveSnapshot || (battle.movementUsed ?? 0) === 0) return no(t('agate.noMoveToUndo'));
    return battle.acted ? no(t('agate.actionSpent')) : ok;
  },
  /** Charge — fiche `regles/charger` (`LDB 15 l.35-37`), foyer du verbatim au Codex. */
  'charge-possible': (ctx) => (isEngaged(ctx.active) ? no(t('agate.alreadyEngaged')) : mouvementIntact(ctx)),
  'mouvement-restant': ({ active, battle }) => (canMove(battle, active) ? ok : no(t('agate.noMovementLeft'))),
  desengagement: desengagementGate,
  'determination-en-reserve': ({ active }) =>
    (active.resolve ?? 0) > 0 ? ok : no(t('agate.noResolve')),
  'attaque-libre-frenesie': ({ active }) =>
    hasFreeWeaponAttack(active) ? ok : no(t('agate.noFreeWeaponAttack')),
  'pietinement-gratuit': ({ active, battle }) =>
    active.advantage >= 1 && !!trampleTarget(battle, active) ? ok : no(t('agate.noTrampleTarget')),
  'set-commutable': ({ active, battle }) =>
    (active.loadouts?.length ?? 0) < 2
      ? no(t('agate.singleLoadout'))
      : battle.loadoutSwapped
        ? no(t('agate.loadoutSwapped'))
        : ok,
  /** REMÈDE D'ÉTAT (Se relever, Se rouler, Se libérer) : l'entrée DÉCLARE l'État qu'elle traite
   *  (`rule` + `ruleCategory: 'etats'`, `actions.json`) — le geste n'est offert qu'au porteur DE cet
   *  État, encore en état d'agir, ET dont l'État déclare un remède ATTEIGNABLE. Aucun id d'État ici :
   *  un remède de plus est une ligne de JSON. C'est aussi la mesure de PERTINENCE que lit le
   *  producteur de pools (une case de remède ne se dessine que pour l'État porté).
   *
   *  MIROIR DU DISPATCHER, à la ligne près : ce qui ferme le geste ici est ce qui le refuserait
   *  là-bas, LU DE LA MÊME DONNÉE — l'exigence de Blessures d'À Terre (`recoverRequires.minWounds`,
   *  `LDB 16 l.35`) qui garde `battleStandUp`, et l'existence d'un remède déclaré (Test `recover`
   *  des États qui s'en libèrent, sans quoi `battleRecoverState` rendrait en silence). Une case
   *  ouverte sur un clic muet est le défaut que cette symétrie ferme. */
  [GATE_ETAT_PORTE]: ({ active, def }) => {
    const etatId = def?.ruleCategory === 'etats' ? def.rule : undefined;
    if (!etatId) return no(t('agate.stateUndeclared'));
    return hasCondition(active, etatId) ? ok : no(t('agate.stateNotCarried'));
  },
  /** REMÈDE ATTEIGNABLE — le second étage du remède d'État : MIROIR DU DISPATCHER, à la ligne près.
   *  Ce qui ferme le geste ici est ce qui le refuserait là-bas, LU DE LA MÊME DONNÉE — l'exigence de
   *  Blessures d'À Terre (`recoverRequires.minWounds`, `LDB 16 l.35`) qui garde `battleStandUp`, et
   *  l'existence d'un remède DÉCLARÉ (Test `recover`, sans quoi `battleRecoverState` rendrait en
   *  silence). Une case ouverte sur un clic muet est le défaut que cette symétrie ferme ; la case,
   *  elle, reste DESSINÉE avec sa raison. */
  [GATE_REMEDE_ATTEIGNABLE]: ({ active, def }) => {
    const etatId = def?.ruleCategory === 'etats' ? def.rule : undefined;
    const etat = etatId ? findConditionById(etatId) : undefined;
    if (!etat) return no(t('agate.stateUndeclared'));
    if (isOutOfAction(active)) return no(t('agate.unableToAct'));
    // Un État qui ne déclare NI Test de récupération (`recover`) NI exigence de remède n'a aucun
    // remède atteignable : la case ne promet pas un clic muet (classe fermée, pas un cas nommé).
    if (!etat.recover && !etat.recoverRequires) return no(t('agate.stateNoRemedy'));
    const min = etat.recoverRequires?.minWounds;
    if (min != null && active.wounds.current < min) return no(t('agate.remedyNeedsWounds'));
    return ok;
  },
  /** Cumuler l'Avantage (LDB 09 l.305-308) : chaque méthode a SON plafond (`skillAdvantageCap`), et
   *  au plafond le Test ne peut plus rien rendre. Le refus est DIT (« Avantage au plafond (N) ») et la
   *  case reste dessinée : la faire disparaître privait le joueur de la raison. La méthode visée vient
   *  des ARGS de la case — les mêmes que le dispatcher `battleGainAdvantage` reçoit. */
  'avantage-sous-plafond': (ctx) =>
    et(ACTION_GATES['action-libre-hors-frenesie'], ({ active, args }) => {
      const methode = combatAdvantageSkills(active).find((s) => s.skillId === args?.skillId);
      return methode && active.advantage >= methode.cap
        ? no(t('agate.advantageCapped', { n: methode.cap }))
        : ok;
    })(ctx),
  /** Postures de tir (spec §1a G5) — PRÉDICATS UNIQUES de `combatFlow`, partagés avec le store
   *  (`battleToggleStance`), le versement dans le pending et la fenêtre de jet. Le refus est celui
   *  du prédicat : la raison appartient à `STANCE_BLOCK`, jamais au gate. */
  'tir-immobile-armable': ({ active, battle }) => {
    const refus = STANCE_BLOCK.heldGround(battle, active);
    return refus ? no(refus) : ok;
  },
  'tir-dans-le-tas-armable': ({ active, battle }) => {
    const refus = STANCE_BLOCK.intoCrowd(battle, active);
    return refus ? no(refus) : ok;
  },
  /** Battement (`LDB 10 l.103` · `AA 13 l.11-17` · `LDB 13 l.114`) : la case porte le prédicat du
   *  dispatcher (`battementFoes`, `combatManeuvers.ts`) — offerte si et seulement si `battleBattement`
   *  a un adversaire à traiter, sinon refusée AVEC sa raison. */
  'battement-cible-eligible': ({ active, battle }) =>
    battementFoes(active, battle).length > 0 ? ok : no(t('agate.noBattementTarget')),
  /** Distraire (`LDB 10 l.364` · `AA 13 l.46-51`) : même prédicat que le dispatcher (`distraireFoes`) —
   *  offerte si et seulement si `battleDistraire` a un adversaire à traiter. */
  'distraire-cible-eligible': ({ active, battle }) =>
    distraireFoes(active, battle).length > 0 ? ok : no(t('agate.noDistraireTarget')),
  /** Focalisation (`LDB 46` — fiche `regles/focalisation-etendue`) : le SORT visé vient des ARGS de
   *  l'alvéole (le geste secondaire de la case d'un sort), et le verdict porte donc sur CE sort.
   *  MÊMES prédicats que le dispatcher `battleFocusSpell` (`isArcaneSpell`, `castBlockedBy`) et que
   *  `resolveFocus` (`focusSkillFor`) : le refus se DIT au point du geste au lieu de partir au
   *  journal. */
  'sort-focalisable': ({ active, args }) => {
    const spell = args?.spellId ? findSpellById(args.spellId) : undefined;
    if (!spell || !isArcaneSpell(spell)) return no(t('agate.spellNotFocusable'));
    // Focalisation est une Compétence AVANCÉE (`LDB 09 l.30`), spécialisée par Vent (`LDB 46`) : le
    // MÊME prédicat que l'offre de l'IA (`combatFlow.ts`) et que `resolveFocus`.
    if (!focusSkillFor(active, spell)) {
      const wind = focusWindLabel(spell);
      return no(wind
        ? t('agate.noFocusSkillWind', { name: active.label, wind })
        : t('agate.noFocusSkill', { name: active.label }));
    }
    const bloque = castBlockedBy(active, 'focalisation');
    return bloque ? no(t('agate.focusBlocked', { reason: bloque })) : ok;
  },
  coop: ({ netMode }) => (netMode && netMode !== 'local' ? ok : no(t('agate.localGame'))),
  /** ÉQUIPAGE de poussée SUFFISANT — verdict de la source unique (`pushSlot.undercrew`, seuil ADE II
   *  8 l.233). Le geste reste OFFERT et porte sa raison : un engin sous-servi se voit, il ne disparaît
   *  pas (loi du refus visible au point du geste, arbitrage 2026-08-19). */
  'equipage-suffisant': ({ active, battle }) =>
    (pushSlot(active, battle.combatants).undercrew ? no(t('agate.pushUndercrew')) : ok),
  'navire-action': ({ active, battle }) =>
    !isVehicle(active) ? no(t('agate.notAVessel')) : battle.acted ? no(t('agate.vesselActionSpent')) : ok,
};

/** LE GESTE QUI REMÈDE À CET ÉTAT — l'entrée du registre qui le DÉCLARE (`rule` + `ruleCategory:
 *  'etats'`, gate `etat-porte`). Source unique de son LIBELLÉ pour toute surface qui doit nommer le
 *  geste (fenêtre du Test de récupération), à la place d'une branche par id d'État. */
export function remedeDeLEtat(stateId: string): ActionDef | undefined {
  return ACTIONS.find(
    (a) => a.ruleCategory === 'etats' && a.rule === stateId && [a.gate].flat().includes(GATE_ETAT_PORTE),
  );
}

/** Verdict d'offre d'une action, par son id — porte de lecture UNIQUE pour les surfaces.
 *  Le champ `gate` de l'entrée peut nommer PLUSIEURS prédicats : ils se composent par l'ET séquentiel
 *  déjà écrit (`et`) — toutes passent, sinon la PREMIÈRE raison refusée est rendue (aucune raison
 *  fabriquée). Une condition de plus sur une action = une ligne de JSON, jamais un gate composé à la main. */
export function actionGate(actionId: string, ctx: ActionCtx): ActionGate {
  const def = ACTIONS.find((a) => a.id === actionId);
  if (!def) return no(`action inconnue : ${actionId}`);
  const noms = Array.isArray(def.gate) ? def.gate : [def.gate];
  const inconnu = noms.find((g) => !ACTION_GATES[g]);
  if (inconnu) return no(`gate inconnu : ${inconnu}`);
  return et(...noms.map((g) => ACTION_GATES[g]))({ ...ctx, def });
}

/** Contexte des sélecteurs : impurs par nature (ils lisent le combat, parfois la scène). */
export interface ActionSelectorCtx extends ActionCtx {
  state?: GameState;
  /** Arme visée quand le sélecteur dépend d'une arme précise (munitions compatibles). */
  weaponUid?: string;
}

/** Les SÉLECTEURS de candidats, par id (`candidates` de `actions.json`) — enveloppes nommées des
 *  fonctions déjà écrites (la liste manuscrite de l'IA n'a plus lieu d'être). */
export const ACTION_CANDIDATES: Record<string, (ctx: ActionSelectorCtx) => unknown[]> = {
  'montures-adjacentes': ({ active, battle }) => mountablesNear(battle, active),
  'pieces-servables': ({ active, battle }) => servablePostes(active, battle.combatants),
  /** La pièce POUSSABLE que l'actif sert — l'entité qui porte le geste de Pousser (spec zone 4 : le
   *  geste vit sur ce qui l'offre). Le verdict d'AFFORDANCE est celui de la source unique déjà écrite
   *  (`pushSlot.show` : chef d'un engin à roues résolu, arme + affût présents, ADE II 8 l.258) — une
   *  pièce non poussable (pierrier naval) n'est donc pas un candidat, et n'ouvre aucune pastille muette.
   *  La coque, elle, se lit à la source unique de l'appartenance à un équipage (`crewPosteOf`). */
  'piece-poussable': ({ active, battle }) => {
    if (!pushSlot(active, battle.combatants).show) return [];
    const sp = crewPosteOf(active.id, battle.combatants);
    return sp ? [sp] : [];
  },
  'cibles-soin': ({ active, battle }) =>
    healableTargets(active, battle.combatants.filter((c) => c.kind === active.kind), { adjacency: true }),
  'cibles-aspersion': ({ active, battle }) =>
    waterSprayCandidates(active, battle.combatants.filter((c) => c.kind === active.kind)),
  'sorts-dissipables': ({ battle }) => dispellableSpellsOn(battle.combatants),
  /** Méthodes d'Avantage POSSÉDÉES (dédupliquées par Compétence : un Savoir groupé = une case). Le
   *  PLAFOND ne filtre plus ici : il est le verdict d'offre `avantage-sous-plafond`, qui laisse la case
   *  dessinée fermée avec sa raison — une seule source, jamais un filtre muet doublé d'un gate. */
  'competences-avantage': ({ active }) =>
    [...new Map(combatAdvantageSkills(active).map((s) => [s.skillId, s])).values()],
  'attaques-disponibles': ({ active, battle }) => availableAttacks(active, battle),
  'sorts-du-heros': ({ active }) => active.spells ?? [],
  'etats-retirables': ({ active }) => ((active.resolve ?? 0) > 0 ? active.conditions : []),
  consommables: ({ active }) => (active.items ?? []).filter(isConsumable),
  'armes-a-distance': ({ active }) => active.weapons.filter((w) => w.type === 'ranged'),
  'munitions-compatibles': ({ active, weaponUid }) => {
    const w = active.weapons.find((x) => x.uid === weaponUid) ?? active.weapons.find((x) => x.type === 'ranged');
    return w ? compatibleAmmo(active, w) : [];
  },
  'manoeuvres-sur-soi': ({ active }) => selfManeuversOf(active).filter((m) => selfManeuverApplicable(active, m)),
  'sets-d-armes': ({ active }) => active.loadouts ?? [],
  'objets-au-sol': ({ active, state }) => {
    if (!state || !active.pos) return [];
    const flags = state.flags ?? {};
    return (state.scene?.entities ?? [])
      .filter(
        (e) =>
          e.kind === 'prop' && !!e.interact &&
          chebyshev(e.pos, active.pos!) <= 1 &&
          (e.z ?? 0) === (active.pos!.z ?? 0) &&
          !flags[`__fouille_${e.id}`],
      )
      .flatMap((e) => entityPickables(e).map((p) => ({ entityId: e.id, ...p })));
  },
};

/** L'IDENTITÉ DÉCLARÉE d'un candidat : QUI le PORTE (`porteurId` — une entité du champ pour une
 *  pastille, l'objet paramètre d'une alvéole pour un geste secondaire), les PARAMÈTRES que son
 *  dispatcher attend, et le nom du candidat quand un même porteur en offre plusieurs (deux pièces
 *  d'une coque, deux objets d'un tas). */
export interface ActionPorteur {
  porteurId: string;
  args: ActionRunCtx;
  /** Nom du CANDIDAT (pas de l'action) — porté par le panneau-paramètre quand le porteur en offre N. */
  label?: string;
}

/** Les PORTEURS, par id de SÉLECTEUR (`candidates`) : une enveloppe NOMMÉE par sélecteur, qui traduit
 *  SON candidat en identité + arguments de dispatch. Même patron qu'`ACTION_RUN` (une entrée = une
 *  forme, jamais un aiguillage par type de candidat écrit dans une surface). C'est ce qui remplace la
 *  DEVINETTE d'identité (`o?.id ?? o?.uid`) : le registre la DÉCLARE, les deux surfaces qui offrent
 *  des candidats (pastilles du champ, gestes secondaires de la console) la LISENT. Toute action dont
 *  la surface offre par candidat doit avoir la sienne — garde `action-atteignabilite`. */
export const ACTION_PORTEURS: Record<string, (candidat: unknown) => ActionPorteur | null> = {
  'montures-adjacentes': (c) => {
    const m = c as Combatant;
    return { porteurId: m.id, args: { targetId: m.id } };
  },
  'pieces-servables': (c) => {
    const sp = c as { hull: Combatant; poste: ShipPoste };
    return { porteurId: sp.hull.id, args: { shipId: sp.hull.id, posteUid: sp.poste.item.uid }, label: sp.poste.item.label };
  },
  'piece-poussable': (c) => {
    const sp = c as { hull: Combatant; poste: ShipPoste };
    return { porteurId: sp.hull.id, args: {}, label: sp.poste.item.label };
  },
  'objets-au-sol': (c) => {
    const o = c as { entityId: string; key: string; label: string };
    return { porteurId: o.entityId, args: { entityId: o.entityId, pickKey: o.key }, label: o.label };
  },
  /** Un SORT du héros — le candidat EST son id (`Combatant.spells: string[]`) : c'est lui que porte
   *  l'alvéole du sort, et lui que le geste secondaire de Focalisation paramètre. */
  'sorts-du-heros': (c) => {
    const id = c as string;
    return { porteurId: id, args: { spellId: id } };
  },
  /** Une ARME à distance : son `uid` porte le candidat (l'alvéole de recharge en est paramétrée). */
  'armes-a-distance': (c) => {
    const w = c as { uid: string; label?: string };
    return { porteurId: w.uid, args: { weaponUid: w.uid }, label: w.label };
  },
};

/** Ce que l'acte prend dans l'économie du tour, en toutes lettres — la donnée `cost` du registre, dite
 *  à l'endroit du geste (spec HUD zone 4 : « coût de l'Action affiché »). `null` = rien à annoncer. */
export function actionCostLabel(def: ActionDef): string | null {
  return def.cost === 'aucun' ? null : t(`acost.${def.cost}`);
}

/** Paramètres d'exécution — l'action nomme SA cible ; jamais une closure qui la capture. */
export interface ActionRunCtx {
  targetId?: string;
  weaponUid?: string;
  ammoUid?: string;
  spellId?: string;
  casterId?: string;
  skillId?: string;
  itemUid?: string;
  loadoutId?: string;
  conditionId?: string;
  maneuverId?: string;
  attackId?: string;
  attackKind?: string;
  entityId?: string;
  pickKey?: string;
  /** COQUE visée (`hullId`) — bordée, chant, rechargement de pièce, service d'un poste. */
  shipId?: string;
  /** MEMBRE D'ÉQUIPAGE qui agit sur la coque (`battleShipManeuver(crewId)`, `store.ts`) : c'est le
   *  barreur, pas le navire. Deux champs parce que ce sont deux entités — un seul mentait. */
  crewId?: string;
  posteUid?: string;
  crewTestId?: string;
  /** ÉTAT visé par le geste (remède d'État) : un id de `etats.json` — c'est la DONNÉE de l'État
   *  (`recover`) qui dit s'il se récupère, jamais une union gravée ici. */
  stateId?: string;
  /** Bascule d'un mode ARMÉ : `true` = désarmer (re-clic sur la même case). */
  toggleOff?: boolean;
}

type Dispatcher = (get: () => GameState, ctx: ActionRunCtx, def: ActionDef) => void;

/** Les DISPATCHERS, par id (`run` de `actions.json`) : une entrée = une méthode du store. */
export const ACTION_RUN: Record<string, Dispatcher> = {
  battleSelectAction: (get, ctx, def) =>
    get().battleSelectAction(
      (ctx.toggleOff ? null : (def.armed ?? null)) as Parameters<GameState['battleSelectAction']>[0],
    ),
  battleSelectAttack: (get, ctx) => get().battleSelectAttack(ctx.attackId ?? 'arme'),
  battleManeuverArea: (get, ctx) =>
    get().battleManeuverArea(ctx.attackKind as Parameters<GameState['battleManeuverArea']>[0]),
  battleAim: (get) => get().battleAim(),
  battleReload: (get, ctx) => get().battleReload(ctx.weaponUid),
  battleSelectAmmo: (get, ctx) => { if (ctx.ammoUid) get().battleSelectAmmo(ctx.ammoUid, ctx.weaponUid); },
  battleTogglePushback: (get) => get().battleTogglePushback(),
  battleToggleStance: (get, _ctx, def) => { if (def.stance) get().battleToggleStance(def.stance); },
  battleWater: (get, ctx) => get().battleWater(ctx.targetId),
  battleUseItem: (get, ctx) => { if (ctx.itemUid) get().battleUseItem(ctx.itemUid); },
  battleDefendTotal: (get) => get().battleDefendTotal(),
  battleDisengage: (get) => get().battleDisengage(),
  /** L'alvéole d'un sort ARME le mode d'incantation sur CE sort (`armed`) : le re-clic le désarme,
   *  comme toute case à mode armé — annulation gratuite, rien n'est engagé avant le clic-cible. */
  battleSelectSpell: (get, ctx) => {
    if (ctx.toggleOff) { get().battleSelectAction(null); return; }
    if (ctx.spellId) get().battleSelectSpell(ctx.spellId);
  },
  battleFocusSpell: (get, ctx) => { if (ctx.spellId) get().battleFocusSpell(ctx.spellId); },
  battleDispelSpell: (get, ctx) => { if (ctx.spellId && ctx.casterId) get().battleDispelSpell(ctx.spellId, ctx.casterId); },
  battleGainAdvantage: (get, ctx) => { if (ctx.skillId) get().battleGainAdvantage(ctx.skillId); },
  battleRecoverState: (get, ctx) => { if (ctx.stateId) get().battleRecoverState(ctx.stateId); },
  battleStandUp: (get) => get().battleStandUp(),
  battleBattement: (get, ctx) => get().battleBattement(ctx.targetId),
  battleDistraire: (get, ctx) => get().battleDistraire(ctx.targetId),
  battleFrenzy: (get) => get().battleFrenzy(),
  battleSelfManeuver: (get, ctx) => { if (ctx.maneuverId) get().battleSelfManeuver(ctx.maneuverId); },
  battleResolvePsychImmune: (get) => get().battleResolvePsychImmune(),
  battleResolveIgnoreCrit: (get) => get().battleResolveIgnoreCrit(),
  battleSpendResolve: (get, ctx) => { if (ctx.conditionId) get().battleSpendResolve(ctx.conditionId); },
  battleMount: (get, ctx) => get().battleMount(ctx.targetId),
  battleDismount: (get) => get().battleDismount(),
  battleManPoste: (get, ctx) =>
    get().battleManPoste(ctx.shipId && ctx.posteUid ? { hullId: ctx.shipId, posteUid: ctx.posteUid } : undefined),
  battleLeavePoste: (get) => get().battleLeavePoste(),
  battlePushEngine: (get) => get().battlePushEngine(),
  battleAidTeam: (get) => get().battleAidTeam(),
  battlePickup: (get, ctx) => { if (ctx.entityId && ctx.pickKey) get().battlePickup(ctx.entityId, ctx.pickKey); },
  battleShipManeuver: (get, ctx) => { if (ctx.crewId) get().battleShipManeuver(ctx.crewId); },
  battleCrewTest: (get, ctx) => { if (ctx.shipId && ctx.crewTestId) get().battleCrewTest(ctx.shipId, ctx.crewTestId); },
  battleSingShanty: (get, ctx) => { if (ctx.shipId) get().battleSingShanty(ctx.shipId); },
  battleShipReload: (get, ctx) => { if (ctx.shipId && ctx.posteUid) get().battleShipReload(ctx.shipId, ctx.posteUid); },
  battleSwitchLoadout: (get, ctx) => { if (ctx.loadoutId) get().battleSwitchLoadout(ctx.loadoutId); },
  /** FIN DU TOUR — porte unique de la plaque de sortie de la console ET de la touche. Le garde-fou
   *  « tour gâché » (spec §1c-bis COIN) est la POLITIQUE DE CETTE ENTRÉE : finir avec l'Action intacte
   *  ARME (empreinte de l'économie du tour, répliquée), le geste suivant passe la main. `battleEndTurn`
   *  reste le verbe BRUT (l'IA et les flux internes passent, eux, par `advanceTurn`). */
  battleEndTurn: (get) => {
    const s = get();
    const b = s.battle;
    const active = b ? activeCombatant(b) : undefined;
    if (b && active && wastesAction(active, b) && !endTurnArmed(b)) { s.armEndTurn(); return; }
    s.battleEndTurn();
  },
  cancelMove: (get) => get().cancelMove(),
  /** PORTE UNIQUE de la pause d'initiative (LDB 17 l.25) : le bandeau de phase de la console ET la
   *  touche du registre (`keybindings.round-start`) passent ICI. Solo, le geste OUVRE le Round ; en
   *  réseau, il ne fait que marquer le siège PRÊT — c'est le quorum (`roundStartReady`, sièges requis)
   *  qui lance, jamais un client. Deux branchements séparés laissaient le bouton court-circuiter le
   *  ready-check que la touche, elle, respectait. */
  roundStart: (get) => {
    const s = get();
    if (s.net.mode === 'local') { s.confirmRoundStart(); return; }
    if (!s.pendingRoundStart?.readyBySeat?.[s.net.mySeat]) s.roundStartReady(s.net.mySeat);
  },
  /** Demande de pause au prochain Round — INTERRUPTEUR : `toggleOff` retire la demande (annulation
   *  gratuite, `lowerHand`), même porte et même routage réseau que la pose. */
  raiseHand: (get, ctx) => (ctx.toggleOff ? get().lowerHand() : get().raiseHand()),
  // ── SORTIES D'INTERLUDE (`surface: 'interlude'`) : une enveloppe NOMMÉE par entrée, jamais un
  //    dispatcher mutualisé — deux interludes ne partagent ni leur verbe ni ses gardes (`cleaveEnd`
  //    clôt l'étape-jet de la cascade, `battleSelectAction` est avalé sous `combatBusy`).
  cleaveEnd: (get) => get().cleaveEnd(),
  dualStrikeSkip: (get) => get().dualStrikeSkip(),
  castPickTargetsOff: (get) => get().castPickTargets(false),
  /** Sortie du placeur de zone, ROUTÉE PAR LA SOURCE que mesure `placingZoneOf` — symétrique de
   *  `commitPlacedZone` (même aiguilleur pour poser et pour renoncer) : un sort revient à sa modale,
   *  un pilonnage referme son placeur. Une seule entrée d'interlude pour le mode `placing-zone`. */
  placingZoneOff: (get) => {
    const s = get();
    if (placingZoneOf(s)?.source === 'siege') get().siegeAimCancel();
    else get().castPlaceZone(false);
  },
  batterySelectNone: (get) => get().battleSelectAction(null),
  /** Téléportation (`combatFlow.ts:5384` : `action: 'teleport'` + `reachable` = `flyReachable` depuis
   *  la case du lanceur, qui contient donc SA case au coût 0, `path.ts:318`) : la sortie de l'interlude
   *  est un ARRIVAGE sur place — le même commit que le clic-sol, par la même porte. */
  teleportStay: (get) => {
    const battle = get().battle;
    const active = battle && activeCombatant(battle);
    if (active?.pos) get().battleClickTile({ ...active.pos });
  },
};

/** Exécute une action par son ID. Porte UNIQUE — le clavier, les cases et les pastilles y passent.
 *  Une action déclarée `blocked` (aucun dispatcher) ne fait rien : le registre le DIT, il ne feint pas.
 *  Une action qui déclare une INTENTION (`intent`) arme d'abord le mode local qui peint sa portée
 *  (`localIntent.ts`, spec zone 4) : c'est le clic du champ, ensuite, qui commet le geste. Les deux
 *  ne s'excluent pas — l'attaque arme son option ET affiche sa portée. */
export function runAction(actionId: string, get: () => GameState, ctx: ActionRunCtx = {}): void {
  const def = ACTIONS.find((a) => a.id === actionId);
  if (!def) return;
  if (def.intent) get().battleArmIntent(ctx.toggleOff ? null : def.id);
  if (def.run) ACTION_RUN[def.run]?.(get, ctx, def);
}

/** L'action d'INTERLUDE du ciblage COURANT : l'entrée `surface: 'interlude'` dont le `mode` est celui
 *  que rend l'aiguilleur (`currentTargetingMode`). C'est la SORTIE d'un ciblage par la carte — le
 *  bandeau de phase de la console la rend, la touche d'annulation ne prend que celles qui portent
 *  `exitSafe`. `undefined` = aucun interlude en cours (mode ordinaire : attaque, cast, soin…). */
export function currentInterludeAction(get: () => GameState): ActionDef | undefined {
  const modeId = currentTargetingMode(get).id;
  return ACTIONS.find((a) => a.surface === 'interlude' && a.mode === modeId);
}

/** Modes ARMABLES de `battle.action`, DÉRIVÉS du registre (`armed`) + les modes qui n'appartiennent
 *  à aucune action de barre, déclarés ici avec leur porteur (garde de parité :
 *  `src/state/action-atteignabilite.test.ts`). */
export const MODES_HORS_REGISTRE = {
  /** Armé par la RÉSOLUTION d'un sort de Téléportation (case d'arrivée), jamais par une case. */
  teleport: 'sort de Téléportation (combatFlow)',
} as const;

/** Union des valeurs légales de `BattleState.action` — le type raconte le registre. */
export type BattleActionMode =
  | 'cast'
  | 'heal'
  | 'dispel'
  | 'battery'
  | 'push'
  | keyof typeof MODES_HORS_REGISTRE;

/** Les MÊMES valeurs, énumérables à l'exécution — la garde `action-atteignabilite` vérifie qu'elles
 *  couvrent EXACTEMENT les `armed` du registre + `MODES_HORS_REGISTRE` (union validée, pas dérivée :
 *  un JSON importé n'a pas de type littéral). */
export const BATTLE_ACTION_MODES: readonly BattleActionMode[] = [
  'cast', 'heal', 'dispel', 'battery', 'push', 'teleport',
];
