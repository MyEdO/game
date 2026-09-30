/**
 * REGISTRE DE PISTES D'ANIMATION (#1176, L2) — l'état d'animation des acteurs vit ICI, en SINGLETON
 * de module, jamais dans un hôte de rendu : deux hôtes peuvent être montés en même temps (fiche de
 * station, éditeur), et un registre par hôte doublerait les émissions et les abonnements.
 *
 * Ce que le registre tient :
 *  - une PISTE par acteur — le geste choisi (`ClipDef` des sélecteurs PURS de `actorAnimSelect`) et
 *    son instant de départ, que le rendu (L3) échantillonne ;
 *  - l'émission d'`ANIM_IMPACT` au franchissement de l'`impactMs` de la piste d'ATTAQUE, sur une
 *    horloge PROPRE : ni la visibilité d'un acteur ni l'existence d'un board ne la conditionnent
 *    (même contrat que `useRigClip` : la logique de combat ne dépend jamais de la visibilité).
 *
 * Les lectures de store restent à ce BORD (`combatantAnimCtx`, injectable) : la sélection du geste,
 * elle, est pure et reçoit son contexte.
 */
import { bus, EVT } from '../../state/bus';
import { useGame } from '../../state/store';
import { inBattleId } from '../../state/combatants';
import { combatantRender } from '../sizeScale';
import { enemyRigProfile, rendersFromOwnInventory } from '../rig/enemyProfile';
import { armePrincipale, equipPorte, type EquipCtx, type FormeDArme } from '../rig/parts/equipment';
import { hasShieldEquipped } from '../rig/anim/weaponClips';
import {
  clipTotalMs,
  planAttackDef,
  planFlinchDef,
  rigAttackDef,
  rigDefenseDef,
  rigHitDef,
  type ClipDef,
  type RigSelectCtx,
} from '../rig/anim/actorAnimSelect';
import type { Weapon } from '../../engine/types';

/**
 * Horloge du registre — SOURCE UNIQUE de temps pour `AnimTrack.start` et pour l'échantillonnage au
 * rendu : les deux doivent lire la même base, sinon la phase d'un geste est fausse.
 */
export const animNow = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();

/** Rôle d'un geste dans l'échange — ce que le rendu arbitre quand deux pistes se disputent un acteur. */
export type TrackRole = 'attack' | 'defense' | 'hit';

/** Marge de purge après la fin d'un geste : la piste survit à la dernière frame qui la lit. */
export const TRACK_PURGE_MARGIN_MS = 200;

/** Période de l'horloge du registre quand `requestAnimationFrame` n'existe pas (hors navigateur). */
const TICK_MS = 16;

/** Une piste : le geste d'un acteur, son départ, et l'impact qu'elle doit émettre. */
export interface AnimTrack {
  def: ClipDef;
  /** Départ sur l'horloge du registre (`animNow`). */
  start: number;
  role: TrackRole;
  /** Payload d'`ANIM_IMPACT` à émettre au franchissement de `def.impactMs` — piste d'attaque seule. */
  impact?: { to: string; result: unknown };
  /** Garde d'émission PORTÉE PAR LA PISTE : elle survit à tout rebuild du rendu. */
  impactFired: boolean;
  /** Fin de vie sur l'horloge du registre. */
  expiresAt: number;
}

/** Contexte de sélection d'un acteur : sa voie de corps et ce que les sélecteurs purs en attendent. */
export interface AnimActorCtx {
  voie: 'rig' | 'plan';
  /** Branche BIPÈDE : armes/bouclier/selle (`RigSelectCtx`). */
  rig?: RigSelectCtx;
  /** `kind` du combattant — relation lanceur↔cible d'une incantation. */
  kind?: string;
}

/** Résolveur de contexte : l'unique point qui LIT l'état du jeu, injecté à l'installation. */
export type AnimCtxResolver = (id: string) => AnimActorCtx | undefined;

/** Évènement `ANIM_ATTACK` tel que les émetteurs le postent (`combatFlow`, `combatManeuvers`). */
interface AttackEvent {
  from: string;
  to?: string;
  kind?: string;
  defense?: string;
  weapon?: FormeDArme;
  parryWeapon?: Weapon;
  creatureAttack?: string;
  result?: { hit?: boolean };
}

const TRACKS = new Map<string, AnimTrack>();

/** Une installation : la boîte qui PORTE son résolveur. L'identité de la boîte (jamais celle de la
 *  fonction, deux hôtes pouvant installer le MÊME résolveur) est ce que la libération retire. */
interface ResolverSlot {
  resolve: AnimCtxResolver;
}

/** PILE des installations vivantes — le résolveur ACTIF est celui du dernier hôte encore monté.
 *  Une pile, et non une variable : un hôte démonté rendrait sinon son résolveur à un hôte survivant. */
const RESOLVERS: ResolverSlot[] = [];

/** Résolveur en service : le sommet de la pile, ou le défaut de store quand rien n'est installé. */
function resolveCtx(id: string): AnimActorCtx | undefined {
  return (RESOLVERS[RESOLVERS.length - 1]?.resolve ?? combatantAnimCtx)(id);
}

let offs: (() => void)[] = [];
let timer = 0;
let timerIsRaf = false;

/**
 * Contexte d'un acteur lu dans le store — MÊME résolution que le stage affine (`tokenBodyKind` :
 * classification par la donnée, profil d'ennemi sauf inventaire propre). Défaut du registre.
 */
export function combatantAnimCtx(id: string): AnimActorCtx | undefined {
  const c = inBattleId(useGame.getState().battle, id);
  if (!c) return undefined;
  if (combatantRender(c).kind !== 'rig') return { voie: 'plan', kind: c.kind };
  const equip = (rendersFromOwnInventory(c) ? null : enemyRigProfile(c))?.equip ?? equipPorte(c);
  return { voie: 'rig', kind: c.kind, rig: contexteDeGeste(equip) };
}

/** Contexte de GESTE d'un bipède, lu de son équipement dessiné : l'arme que l'os `arme` porte, et la
 *  présence d'un bouclier. */
export function contexteDeGeste(equip: EquipCtx): RigSelectCtx {
  return { mainWeapon: armePrincipale(equip), shield: hasShieldEquipped(equip.weapons, equip.shield) };
}

/** Acteur inconnu du résolveur : bipède à mains nues — une attaque garde ainsi son impact. */
const FALLBACK_CTX: AnimActorCtx = { voie: 'rig', rig: {} };

function setTrack(id: string, def: ClipDef, role: TrackRole, impact?: { to: string; result: unknown }): void {
  const start = animNow();
  TRACKS.set(id, {
    def,
    start,
    role,
    impact,
    impactFired: !(impact && def.impactMs != null),
    expiresAt: start + clipTotalMs(def) + TRACK_PURGE_MARGIN_MS,
  });
  schedule();
}

function onAttack(d: AttackEvent): void {
  if (!d?.from) return;
  const from = resolveCtx(d.from) ?? FALLBACK_CTX;
  const to = d.to ? resolveCtx(d.to) : undefined;
  const atk: ClipDef =
    from.voie === 'plan'
      ? planAttackDef(d.creatureAttack)
      : rigAttackDef(
          { kind: d.kind, weapon: d.weapon, casterKind: from.kind, targetKind: to?.kind, isSelf: d.from === d.to },
          from.rig ?? {},
        );
  // CIBLE de l'échange : `to === from` n'en est PAS une (le souffle d'une créature,
  // `state/combatManeuvers.emitCreatureAttackAnim`, se poste sous cette forme). La piste d'attaque se joue,
  // mais sans impact armé : émis, il reviendrait à l'attaquant, qui se déroberait au milieu de son propre
  // geste (`onImpact` pose une piste `hit` sur `to`) sous un bruit de touche. Une seule garde pour les
  // deux conséquences — l'impact et le geste de défense.
  const cible = d.to && d.to !== d.from ? d.to : null;
  setTrack(d.from, atk, 'attack', cible ? { to: cible, result: d.result } : undefined);

  if (!cible || d.result?.hit) return;
  const def: ClipDef | null =
    (to ?? FALLBACK_CTX).voie === 'plan'
      ? planFlinchDef()
      : rigDefenseDef(
          {
            kind: d.kind,
            defense: d.defense,
            parryWeapon: d.parryWeapon,
            casterKind: from.kind,
            targetKind: to?.kind,
            isSelf: false,
          },
          (to ?? FALLBACK_CTX).rig ?? {},
        );
  if (def) setTrack(cible, def, 'defense');
}

function onImpact(d: { to?: string; result?: { hit?: boolean } }): void {
  if (!d?.to || !d.result?.hit) return;
  const ctx = resolveCtx(d.to) ?? FALLBACK_CTX;
  setTrack(d.to, ctx.voie === 'plan' ? planFlinchDef() : rigHitDef(ctx.rig ?? {}), 'hit');
}

function tick(): void {
  timer = 0;
  const now = animNow();
  for (const [id, tr] of TRACKS) {
    if (!tr.impactFired && tr.impact && now - tr.start >= (tr.def.impactMs ?? 0)) {
      tr.impactFired = true;
      bus.emit(EVT.ANIM_IMPACT, tr.impact);
    }
    if (now >= tr.expiresAt && TRACKS.get(id) === tr) TRACKS.delete(id);
  }
  if (TRACKS.size) schedule();
}

function schedule(): void {
  if (timer || !RESOLVERS.length) return;
  timerIsRaf = typeof requestAnimationFrame === 'function';
  timer = timerIsRaf ? requestAnimationFrame(() => tick()) : (setTimeout(tick, TICK_MS) as unknown as number);
}

function stopClock(): void {
  if (!timer) return;
  if (timerIsRaf) cancelAnimationFrame(timer);
  else clearTimeout(timer);
  timer = 0;
}

/**
 * Installe le registre : abonnements bus UNIQUES, quel que soit le nombre d'hôtes. Le premier appel
 * abonne, les suivants EMPILENT leur résolveur seulement ; la dernière libération désabonne, arrête
 * l'horloge et vide les pistes. Renvoie la libération de CET appel (idempotente), qui retire SON
 * entrée de la pile — le service revient alors à l'installation vivante la plus récente, jamais à
 * celle d'un hôte démonté.
 *
 * CONTRAT D'ÉMISSION : le registre installé est le SEUL émetteur d'`ANIM_IMPACT`. Le stage affine en
 * émet un pour le rig qu'il monte (`useRigAnim`) : l'hôte qui installe le registre retire cette
 * émission-là. Garde
 * structurelle : `animTracks.test.ts`, « CONTRAT D'ÉMISSION UNIQUE ».
 */
export function installAnimTracks(resolve: AnimCtxResolver = combatantAnimCtx): () => void {
  const slot: ResolverSlot = { resolve };
  RESOLVERS.push(slot);
  if (RESOLVERS.length === 1) {
    offs = [bus.on(EVT.ANIM_ATTACK, (d) => onAttack(d as AttackEvent)), bus.on(EVT.ANIM_IMPACT, (d) => onImpact(d ?? {}))];
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const i = RESOLVERS.indexOf(slot);
    if (i >= 0) RESOLVERS.splice(i, 1);
    if (RESOLVERS.length) return;
    for (const off of offs) off();
    offs = [];
    stopClock();
    TRACKS.clear();
  };
}

/** Pistes VIVANTES, en lecture — la carte elle-même (le rendu la relit à chaque frame). */
export function tracksRef(): ReadonlyMap<string, AnimTrack> {
  return TRACKS;
}

/**
 * Contexte d'un acteur SELON LE RÉSOLVEUR EN SERVICE — le même que celui dont les pistes se servent.
 * C'est par là que le rendu (L3) apprend la voie de corps et l'arme tenue d'un acteur sans ouvrir sa
 * propre porte sur l'état du jeu : `GameStage3D` est un consommateur pur du stage.
 *
 * `undefined` = acteur inconnu du résolveur (hors combat, sous le résolveur de défaut).
 */
export function animCtxOf(id: string): AnimActorCtx | undefined {
  return resolveCtx(id);
}

/** Nombre d'installations actives — instrument de garde (double installation = un seul abonnement). */
export function animTracksInstalls(): number {
  return RESOLVERS.length;
}
