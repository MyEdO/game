/**
 * VOCABULAIRE D'ANIMATION D'UN ACTEUR (#1176) — sélection PURE du geste + échantillonnage de sa pose,
 * pour les DEUX voies de rendu : le stage AFFINE (hooks React `useRigAnim`/`usePlanAnim`, horloge rAF)
 * et le FLIPBOOK volumique (cuisson d'un atlas de frames, hors ligne).
 *
 * Deux voies de corps y sont couvertes par un MÊME type `ClipDef` :
 *  - `rig`  : un bipède rigué → un `Clip` (`clips.ts`, échantillonné par `sampleClip`) ;
 *  - `plan` : un gabarit non-bipède → un MODE de gabarit (fonction de pose paramétrique du
 *    `BodyPlan` + durée), échantillonné par `planPoseAt`.
 *
 * Aucun accès au store : tout le contexte (armes équipées, kinds lanceur/cible, traits) est INJECTÉ
 * par l'appelant. Aucun `three`, aucun hook — Node-safe.
 */
import type { Weapon } from '../../../engine/types';
import { CLIPS, clipDuration, sampleClip, type Clip } from './clips';
import { ambientClip } from './ambientClips';
import { handlingClass } from './handling';
import { mountedAttackClip, mountedParryClip, seatedClip, weaponAttackClip, weaponParryClip } from './weaponClips';
import { isSupportiveCast, spellCastClip, spellCastStyle } from './spellClips';
import { armeDeDessin, isShield, type FormeDArme } from '../parts/equipment';
import type { BodyPlan, WingState } from '../bodyPlan';
import { planGroundPose, rigGroundPose, type GroundState, type Pose } from '../../groundPose';
import { lerpPose, scalePose } from '../poses';
import { STEP_MS } from '../../../geometry/walk';

// ————————————————————————————————————————————————————————————————
// 1. DURÉES — les nombres jadis en dur dans `usePlanAnim`, nommés ici
// ————————————————————————————————————————————————————————————————

/** Période de l'anim de repos d'un gabarit (battement/ondulation/dodelinement). */
export const PLAN_IDLE_MS = 1600;
/** Recul (touché) / dérobade (attaque esquivée) d'un gabarit. */
export const PLAN_FLINCH_MS = 240;
/** Enveloppe de l'attaque d'un gabarit : RAMPE de `attackPose(0)` à `attackPose(1)`. */
export const PLAN_ATTACK_MS = 280;
/** Maintien à l'extension maximale avant retour au repos (le mode d'attaque vit
 *  `PLAN_ATTACK_MS + PLAN_ATTACK_TAIL_MS`). */
export const PLAN_ATTACK_TAIL_MS = 80;
/**
 * Instant du CONTACT d'une attaque de gabarit. L'enveloppe est une rampe linéaire vers l'extension
 * maximale (`attackPose(1)`) : le contact est à la FIN de la rampe — même lecture que les clips
 * bipèdes, dont `onImpact` tombe à la fin du pas de frappe (`CLIPS.melee` : 220 = 130 + 90).
 */
export const PLAN_ATTACK_IMPACT_MS = PLAN_ATTACK_MS;
/** Effondrement au sol (mort / mis À Terre) — PARTAGÉ par les deux voies de corps. */
export const COLLAPSE_MS = 420;

/** Cubique sortante — distincte de l'`easeOut` QUADRATIQUE de `tween.ts` (courbe plus tenue en fin
 *  de course : l'effondrement s'écrase vite puis se pose). */
export const easeOutCubic = (t: number): number => 1 - (1 - Math.max(0, Math.min(1, t))) ** 3;

// ————————————————————————————————————————————————————————————————
// 2. `ClipDef` — la description d'un geste, commune aux deux voies
// ————————————————————————————————————————————————————————————————

/**
 * Identité STABLE d'un geste : deux acteurs qui rendent la même `ClipKey` jouent la même suite de
 * poses. C'est la clé de cache du flipbook (à composer avec l'identité du corps par l'appelant :
 * une même `plan:walk` ne donne pas les mêmes frames pour un loup et pour une araignée).
 */
export type ClipKey = string;

/** Geste d'un bipède rigué : un `Clip` de `clips.ts`. */
export interface RigClipDef {
  voie: 'rig';
  key: ClipKey;
  clip: Clip;
  durationMs: number;
  /** Instant du contact (ms depuis le début) — `Clip.onImpact`. */
  impactMs?: number;
}

export type PlanClipKind = 'rest' | 'walk' | 'attack' | 'flinch' | 'dying';

/** Geste d'un gabarit non-bipède : un MODE, échantillonné sur les fonctions de pose du `BodyPlan`. */
export interface PlanClipDef {
  voie: 'plan';
  key: ClipKey;
  kind: PlanClipKind;
  durationMs: number;
  /** Maintien après l'enveloppe (attaque). */
  tailMs?: number;
  impactMs?: number;
  loop?: boolean;
  /** Marche : BOND (trait LDB 85) plutôt que pas de marche. */
  leap?: boolean;
  /** Attaque : `attackKind` de l'arme naturelle (morsure, griffes…). */
  attackKind?: string;
  /** Effondrement : état au sol visé, INDICATIF — capté à l'évènement, relu au RENDU par
   *  `planRenderPose`. Une planche de flipbook ne se sert donc jamais par la clé du def seule :
   *  l'effondrement énumère `corpse` ET `prone` (`collapseAtlasKeys`, `backends/webgl/atlasBake.ts`). */
  ground?: Exclude<GroundState, null>;
  /** Gabarit AILÉ : ailes déployées pendant ce geste (`ResolveOpts.wings` — un réglage de DESSIN,
   *  pas une pose). */
  wings?: 'spread';
}

export type ClipDef = RigClipDef | PlanClipDef;

/** Durée TOTALE d'un geste (enveloppe + maintien) — la longueur d'un flipbook non bouclé. */
export function clipTotalMs(def: ClipDef): number {
  return def.durationMs + (def.voie === 'plan' ? (def.tailMs ?? 0) : 0);
}

const rigDef = (key: ClipKey, clip: Clip): RigClipDef => ({
  voie: 'rig',
  key,
  clip,
  durationMs: clipDuration(clip),
  impactMs: clip.onImpact,
});

/** Suffixe de clé d'un acteur en selle / à pied. */
const seat = (seated?: boolean) => (seated ? 'selle' : 'pied');

/**
 * Discriminants d'une arme pour la clé : sa classe de maniement, sa main et son `attackKind` — le
 * triplet dont dépendent `weaponAttackClip`/`weaponParryClip` (classe + miroir main gauche/tentacule).
 * SUR-ensemble volontaire : deux armes de gestes identiques peuvent porter deux clés (une entrée
 * d'atlas de plus), jamais l'inverse (une collision rendrait le mauvais geste).
 */
const weaponKey = (w?: FormeDArme) => (w ? `${handlingClass(w)}:${w.hand ?? 'main'}:${w.attackKind ?? '-'}` : 'nu');

// ————————————————————————————————————————————————————————————————
// 3. SÉLECTION — voie BIPÈDE
// ————————————————————————————————————————————————————————————————

/** Contexte d'un acteur bipède : ce qu'il porte, et s'il est EN SELLE (la variante assise fait
 *  partie de la sélection — un cavalier ne joue jamais le geste du fantassin). */
export interface RigSelectCtx {
  seated?: boolean;
  /** Arme principale équipée — repli quand l'événement ne porte pas l'arme employée. */
  mainWeapon?: FormeDArme;
  /** Bouclier présent dans l'équipement (`hasShieldEquipped`). */
  shield?: boolean;
}

/** Relation lanceur↔cible d'une incantation (le style de geste s'en déduit, sans store). */
export interface CastRelation {
  casterKind?: string;
  targetKind?: string;
  isSelf?: boolean;
}

/** Attaque émise par l'acteur : `kind` de l'événement, arme EMPLOYÉE (telle que l'événement la porte,
 *  projetée par `armeDeDessin`), relation d'incantation. */
export interface AttackSelect extends CastRelation {
  kind?: string;
  weapon?: Weapon;
}

/** Réaction de l'acteur VISÉ par une attaque qui n'a pas touché. */
export interface DefenseSelect extends CastRelation {
  kind?: string;
  /** `'parade'` = l'attaque a été parée ; toute autre valeur (ou aucune) = esquive. */
  defense?: string;
  /** Arme QUI A PARÉ (main-gauche → geste miroité, bouclier → pavois levé). */
  parryWeapon?: Weapon;
}

/** Geste d'attaque : incantation (style dérivé de la relation) ou arme employée, assis ou à pied. */
export function rigAttackDef(ev: AttackSelect, ctx: RigSelectCtx): RigClipDef {
  if (ev.kind === 'spell') {
    const style = spellCastStyle(ev.casterKind, ev.targetKind, ev.isSelf);
    const cast = spellCastClip(style);
    return rigDef(`rig:cast:${style}:${seat(ctx.seated)}`, ctx.seated ? seatedClip(cast) : cast);
  }
  const w = ev.weapon ? armeDeDessin(ev.weapon) : ctx.mainWeapon;
  return rigDef(
    `rig:attack:${seat(ctx.seated)}:${weaponKey(w)}`,
    ctx.seated ? mountedAttackClip(w) : weaponAttackClip(w),
  );
}

/** Réaction défensive, ou `null` quand il n'y en a pas : une incantation de SOUTIEN reçue
 *  (soin/bénédiction) ne fait pas se dérober la cible. */
export function rigDefenseDef(ev: DefenseSelect, ctx: RigSelectCtx): RigClipDef | null {
  if (ev.kind === 'spell' && isSupportiveCast(ev.casterKind, ev.targetKind, ev.isSelf)) return null;
  if (ev.defense === 'parade') {
    const w = ev.parryWeapon ? armeDeDessin(ev.parryWeapon) : ctx.mainWeapon;
    const shield = ev.parryWeapon ? isShield(ev.parryWeapon) : !!ctx.shield;
    return rigDef(
      `rig:parry:${seat(ctx.seated)}:${weaponKey(w)}:${shield ? 'bouclier' : 'nu'}`,
      ctx.seated ? mountedParryClip(w, shield) : weaponParryClip(w, shield),
    );
  }
  return rigDef(`rig:dodge:${seat(ctx.seated)}`, ctx.seated ? seatedClip(CLIPS.dodge) : CLIPS.dodge);
}

/** Recul d'impact (touché). */
export function rigHitDef(ctx: RigSelectCtx): RigClipDef {
  return rigDef(`rig:hit:${seat(ctx.seated)}`, ctx.seated ? seatedClip(CLIPS.hit) : CLIPS.hit);
}

/** Marche — `null` EN SELLE : c'est la monture qui marche, le cavalier ne pédale pas. */
export function rigWalkDef(ctx: RigSelectCtx): RigClipDef | null {
  return ctx.seated ? null : rigDef('rig:walk', CLIPS.walk);
}

/** Repos par défaut (respiration) — un clip d'ambiance authoré le remplace côté appelant. */
export function rigIdleDef(): RigClipDef {
  return rigDef('rig:idle', CLIPS.idle);
}

/**
 * EFFONDREMENT d'un bipède : interpolation du repos vers sa pose au sol (`rigGroundPose` — la MÊME
 * que le monde volumique fige), sur `COLLAPSE_MS`. `null` = debout.
 */
export function rigCollapsePoseAt(ground: GroundState, elapsedMs: number): { pose: Pose; done: boolean } | null {
  const down = rigGroundPose(ground);
  if (!down) return null;
  return {
    pose: lerpPose({}, down, easeOutCubic(Math.min(1, elapsedMs / COLLAPSE_MS))),
    done: elapsedMs > COLLAPSE_MS,
  };
}

// ————————————————————————————————————————————————————————————————
// 4. SÉLECTION — voie GABARIT
// ————————————————————————————————————————————————————————————————

/** Repos d'un gabarit (idle en boucle, ou pose de repos si le plan n'a pas d'idle). */
export function planRestDef(): PlanClipDef {
  return { voie: 'plan', key: 'plan:rest', kind: 'rest', durationMs: PLAN_IDLE_MS, loop: true };
}

/** Déplacement — BOND (trait LDB 85) si le plan le porte, sinon pas de marche. */
export function planWalkDef(leap?: boolean): PlanClipDef {
  return {
    voie: 'plan',
    key: leap ? 'plan:walk:bond' : 'plan:walk',
    kind: 'walk',
    durationMs: STEP_MS * 2,
    loop: true,
    leap,
    wings: 'spread',
  };
}

/** Attaque — `attackKind` route la pose dédiée du plan (`attackKindPose`) quand elle existe. */
export function planAttackDef(attackKind?: string): PlanClipDef {
  return {
    voie: 'plan',
    key: `plan:attack:${attackKind ?? '-'}`,
    kind: 'attack',
    durationMs: PLAN_ATTACK_MS,
    tailMs: PLAN_ATTACK_TAIL_MS,
    impactMs: PLAN_ATTACK_IMPACT_MS,
    attackKind,
    wings: 'spread',
  };
}

/** Recul (touché) / dérobade (attaque esquivée). */
export function planFlinchDef(): PlanClipDef {
  return { voie: 'plan', key: 'plan:flinch', kind: 'flinch', durationMs: PLAN_FLINCH_MS };
}

/** Effondrement vers la pose au sol (mort étalé / À Terre affaissé). */
export function planDyingDef(ground: Exclude<GroundState, null>): PlanClipDef {
  return { voie: 'plan', key: `plan:dying:${ground}`, kind: 'dying', durationMs: COLLAPSE_MS, ground, wings: 'spread' };
}

/**
 * Pose d'un gabarit à `elapsedMs` du début de son geste. PUR.
 *
 * Les gestes en BOUCLE (`loop`) n'ont pas d'origine : leur phase est `elapsedMs` modulo la période —
 * le stage affine y passe donc son horloge globale (tous les gabarits battent en phase commune),
 * le cuiseur de flipbook y passe l'instant de la frame.
 */
export function planPoseAt(
  plan: BodyPlan,
  def: PlanClipDef,
  elapsedMs: number,
): { pose: Pose; done: boolean; wings: WingState } {
  const wings: WingState = def.wings ?? 'folded';
  const done = !def.loop && elapsedMs > clipTotalMs(def);
  const ramp = Math.min(1, elapsedMs / def.durationMs);
  switch (def.kind) {
    case 'walk':
      return { pose: (def.leap && plan.leapPose ? plan.leapPose : plan.walkPose)(((elapsedMs / STEP_MS) % 2) / 2), done, wings };
    case 'attack':
      return {
        pose: (def.attackKind ? plan.attackKindPose?.(def.attackKind, ramp) : null) ?? plan.attackPose(ramp),
        done,
        wings,
      };
    case 'flinch': {
      // Amplitude en cloche : un gabarit qui DÉCLARE son `flinchPose` joue le sien ; à défaut, on
      // joue L'INVERSE atténué de son propre geste d'attaque — retrait anatomiquement juste sans
      // connaître ses os.
      const k = Math.sin(ramp * Math.PI);
      return { pose: plan.flinchPose ? plan.flinchPose(k) : scalePose(plan.attackPose(1), -0.35 * k), done, wings };
    }
    case 'dying':
      return {
        pose: lerpPose(plan.restPose(), planGroundPose(plan, def.ground ?? 'corpse')!, easeOutCubic(ramp)),
        done,
        wings,
      };
    default:
      return {
        pose: plan.idlePose ? plan.idlePose((elapsedMs % def.durationMs) / def.durationMs) : plan.restPose(),
        done,
        wings,
      };
  }
}

/**
 * Pose d'un gabarit À L'INSTANT DU RENDU : `ground` est l'état au sol lu MAINTENANT (jamais celui
 * capté à l'évènement) — un acteur À Terre qui meurt pendant l'effondrement finit sur la pose de
 * cadavre, et un acteur DEBOUT pendant la fenêtre d'effondrement (relevé en vol) rend le repos.
 */
export function planRenderPose(
  plan: BodyPlan,
  def: PlanClipDef,
  ground: GroundState,
  nowMs: number,
  startMs: number,
): Pose {
  if (ground) {
    return def.kind === 'dying'
      ? planPoseAt(plan, { ...def, ground }, nowMs - startMs).pose
      : planGroundPose(plan, ground)!;
  }
  const debout = def.kind === 'dying' ? planRestDef() : def;
  return planPoseAt(plan, debout, debout.loop ? nowMs : nowMs - startMs).pose;
}

// ————————————————————————————————————————————————————————————————
// 5. ÉCHANTILLONNAGE PAR FRAME — ce qu'une planche de flipbook demande (#1176, L4)
// ————————————————————————————————————————————————————————————————

/**
 * Instant à échantillonner pour la frame `k` d'une planche de `n` frames couvrant `totalMs`. Vit ICI,
 * avec le vocabulaire de geste : le cuiseur (`stage/boardPose`) et la couture de dessin des sujets
 * (`backends/webgl/sceneMeshes`) doivent lire le MÊME instant pour une même frame, sinon la planche
 * cuite et l'index joué décrivent deux gestes.
 */
export function frameSampleMs(k: number, n: number, totalMs: number): number {
  return (k / Math.max(1, n)) * totalMs;
}

/**
 * Pose d'un RIG à la frame `k` d'une planche de `n` frames : le clip échantillonné, ou — quand un état
 * au sol est visé — l'EFFONDREMENT vers cette pose (`rigCollapsePoseAt`, la même interpolation que le
 * stage affine). La PRISE D'ARME n'y entre pas : elle appartient au corps qui dessine, pas au geste.
 */
export function rigPoseAtFrame(def: RigClipDef, k: number, n: number, ground?: Exclude<GroundState, null>): Pose {
  if (ground) return rigCollapsePoseAt(ground, frameSampleMs(k, n, COLLAPSE_MS))?.pose ?? {};
  return sampleClip(def.clip, frameSampleMs(k, n, clipTotalMs(def))).pose;
}

/**
 * Geste d'AMBIANCE authoré d'une entité de scène (`SceneEntity.anim`, catalogue `gameIso/sceneAnims`)
 * pour un corps BIPÈDE — le MÊME clip que le jeton affine joue en repos (`RigToken`, prop
 * `ambientAnim`). `null` = clé sans clip rig (l'entité reste alors statique).
 *
 * La clé porte l'ambiance : deux figurants d'ambiances différentes ne peuvent pas partager de planche.
 */
export function rigAmbientDef(anim: string): RigClipDef | null {
  const clip = ambientClip(anim);
  return clip ? { voie: 'rig', key: `rig:ambient:${anim}`, clip, durationMs: clipDuration(clip), impactMs: clip.onImpact } : null;
}

/** Geste d'ambiance d'un GABARIT : son idle en boucle, sous une clé qui porte l'ambiance authorée. */
export function planAmbientDef(anim: string): PlanClipDef {
  return { ...planRestDef(), key: `plan:ambient:${anim}` };
}
