/** Bus d'évènements minimal (style mitt) : le noyau émet, chaque hôte écoute. Chaque évènement a sa charge
 *  typée (`ChargesDuBus`), à l'émission comme à l'écoute. */
import type { AttackResult } from '../engine/combat';
import type { AttackKind } from '../engine/creatureAttacks';
import type { CastResult, MissileResult } from '../engine/magic';
import type { Weapon } from '../engine/types';

type Handler<E extends NomDuBus> = (payload: ChargesDuBus[E]) => void;

class EventBus {
  private handlers = new Map<NomDuBus, Set<Handler<never>>>();
  on<E extends NomDuBus>(event: E, fn: Handler<E>) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(fn as Handler<never>);
    return () => this.off(event, fn);
  }
  off<E extends NomDuBus>(event: E, fn: Handler<E>) {
    this.handlers.get(event)?.delete(fn as Handler<never>);
  }
  emit<E extends NomDuBus>(event: E, ...payload: ChargesDuBus[E] extends undefined ? [] : [ChargesDuBus[E]]) {
    this.handlers.get(event)?.forEach((fn) => (fn as Handler<E>)(payload[0] as ChargesDuBus[E]));
  }
}

export const bus = new EventBus();

/** Évènements connus. */
export const EVT = {
  /** store → rendu : l'état a changé, rafraîchir le rendu. */
  SCENE_DIRTY: 'scene_dirty',
  /** store → rendu : une attaque, une incantation ou une attaque spéciale de créature (`ChargeDAttaque`). */
  ANIM_ATTACK: 'anim_attack',
  /** rendu → rendu : l'attaque atteint sa cible (timing du recul + dégât flottant) {to, result}. */
  ANIM_IMPACT: 'anim_impact',
  /** store → rendu : flottant TYPÉ au-dessus d'un combattant pour les retours
   *  hors-touche (soin, État appliqué…) — la touche/raté/parade/mort passent déjà par ANIM_IMPACT. */
  ANIM_FLOAT: 'anim_float',
  /** store → rendu : déplacement animé d'un token {id,path}. */
  ANIM_MOVE: 'anim_move',
  /** store → rendu/audio : pas clavier d'exploration REFUSÉ (aucune surface suffisamment alignée sur la
   *  direction poussée, #792) — retour non-directionnel {} : micro-shake du jeton + heurt sourd. */
  MOVE_BLOCKED: 'move_blocked',
  /** store → rendu : zone d'effet déclenchée (souffle/vomi/cri/sort de zone) — flash des cases touchées
   *  AU MOMENT de la résolution → on voit QUI est pris et pourquoi. */
  ANIM_AOE: 'anim_aoe',
  /** UI → audio : le joueur lance les dés (clic « Lancer » d'une modale de jet). */
  DICE_ROLL: 'dice_roll',
  /** store → audio : un Effet de scène `playSfx` demande un son ponctuel du registre. */
  SFX: 'sfx',
  /** store → * : fin de combat — gong de victoire. */
  BATTLE_OVER: 'battle_over',
  /** store → * : un Test s'est résolu (`jetValider('test')`) — SEAM
   *  unique consommé par `devtools.ts` (`__wfrp.lastRoll()`, recette navigateur, #514), jamais lu par
   *  du code de règles (observation pure, aucun état persisté). */
  TEST_RESOLVED: 'test_resolved',
  /** noyau → hôte : l'Effet `openCharacterCreator` demande la création d'un nouveau héros (sans charge),
   *  que l'hôte ouvre. */
  HEROS_A_CREER: 'heros_a_creer',
  /** noyau → hôte : le groupe entre dans la scène — `neuve` pour une partie qui commence
   *  (`lancerLaScene`), faux pour un changement de scène (`quitterLaScene`) (#2817 D5). */
  ARRIVEE_EN_SCENE: 'arrivee_en_scene',
  /** noyau → hôte : une ligne écrite au journal, par ses seuls écrivains (`ecrireAuJournal`, l'entrée en scène). */
  LIGNE_AU_JOURNAL: 'ligne_au_journal',
} as const;

/** Un nom d'évènement du bus. */
export type NomDuBus = (typeof EVT)[keyof typeof EVT];

type Case = { x: number; y: number; z?: number };

/** La charge d'`ANIM_ATTACK` : un coup d'arme (l'arme EMPLOYÉE, et celle qui a paré), la touche d'un Projectile ou
 *  l'incantation d'un sort sans projectile (le sort par son id), ou l'attaque spéciale d'une créature, sur elle-même. */
export type ChargeDAttaque =
  | { kind: 'melee' | 'distance'; from: string; to: string; result: AttackResult; defense: 'parade' | 'esquive' | 'aucune'; weapon: Weapon; parryWeapon?: Weapon; creatureAttack?: string }
  | { kind: 'spell'; projectile: true; from: string; to: string; result: CastResult & Partial<MissileResult>; spell: string; defense: 'aucune' }
  | { kind: 'spell'; projectile: false; from: string; to: string; result: CastResult; spell: string; defense: 'aucune' }
  | { kind: 'creature'; from: string; to: string; result: { hit: true }; creatureAttack: AttackKind; defense: 'aucune' };

/** La charge d'`ANIM_AOE` (#3783) : la zone d'effet que `de` pose sur `tiles` autour de `centre`, celle du sort d'id
 *  `sort`, ou celle de la manœuvre de rendu `rendu` ; ni l'un ni l'autre pour une zone qu'un déclencheur pose hors d'un
 *  sort. */
export interface ChargeDeZone { de: string; centre: Case; tiles: Case[]; sort?: string; rendu?: string }

/** La charge de `TEST_RESOLVED`. */
export interface TestResolu { actorId: string; success: boolean; sl: number; roll: number | null; target: number }

/** La charge de chaque évènement du bus, `undefined` pour un évènement sans charge. */
export interface ChargesDuBus {
  scene_dirty: undefined;
  anim_attack: ChargeDAttaque;
  anim_impact: { to: string; result: ChargeDAttaque['result'] };
  anim_float: { to?: string; pos?: Case; text: string; kind: 'blessures' | 'rate' | 'etat' | 'soin' };
  anim_move: { id: string; path: Case[] };
  move_blocked: Record<string, never>;
  anim_aoe: ChargeDeZone;
  dice_roll: undefined;
  sfx: { id: string };
  battle_over: { victory: boolean };
  test_resolved: TestResolu;
  heros_a_creer: undefined;
  arrivee_en_scene: { sceneId: string; neuve: boolean };
  ligne_au_journal: { texte: string };
}
