/** Bus d'évènements minimal (style mitt) reliant React ⇄ le rendu (SVG iso). */
type Handler = (payload?: any) => void;

class EventBus {
  private handlers = new Map<string, Set<Handler>>();
  on(event: string, fn: Handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(fn);
    return () => this.off(event, fn);
  }
  off(event: string, fn: Handler) {
    this.handlers.get(event)?.delete(fn);
  }
  emit(event: string, payload?: any) {
    this.handlers.get(event)?.forEach((fn) => fn(payload));
  }
}

export const bus = new EventBus();

/** Évènements connus. */
export const EVT = {
  /** rendu → store : clic sur une case (exploration ou combat). */
  TILE_CLICK: 'tile_click',
  /** rendu → store : clic sur une entité/combattant. */
  ENTITY_CLICK: 'entity_click',
  /** store → rendu : l'état a changé, rafraîchir le rendu. */
  SCENE_DIRTY: 'scene_dirty',
  /** store → rendu : jouer une animation d'attaque
   *  {from, to, result, kind:'melee'|'ranged'|'spell', defense:'parade'|'esquive'|'none',
   *   spell?:libellé du sort (kind 'spell') → école pour le tintage arcane/divin}. */
  ANIM_ATTACK: 'anim_attack',
  /** rendu → rendu : l'attaque atteint sa cible (timing du recul + dégât flottant) {to, result}. */
  ANIM_IMPACT: 'anim_impact',
  /** store → rendu : flottant TYPÉ au-dessus d'un combattant {to?|pos?, text, kind} pour les retours
   *  hors-touche (soin, État appliqué…) — la touche/raté/parade/mort passent déjà par ANIM_IMPACT. */
  ANIM_FLOAT: 'anim_float',
  /** store → rendu : déplacement animé d'un token {id,path}. */
  ANIM_MOVE: 'anim_move',
  /** store → rendu/audio : pas clavier d'exploration REFUSÉ (aucune surface suffisamment alignée sur la
   *  direction poussée, #792) — retour non-directionnel {} : micro-shake du jeton + heurt sourd. */
  MOVE_BLOCKED: 'move_blocked',
  /** store → rendu : zone d'effet déclenchée (souffle/vomi/cri/sort de zone) — flash des cases touchées
   *  AU MOMENT de la résolution {tiles:[{x,y}], kind, type} → on voit QUI est pris et pourquoi. */
  ANIM_AOE: 'anim_aoe',
  /** store → * : le temps de jeu a avancé {minutes}. #T3 (cascade) branchera guérison/Fatigue/re-stock sur les franchissements. */
  TIME_ADVANCED: 'time:advanced',
  /** UI → audio : le joueur lance les dés (clic « Lancer » d'une modale de jet). */
  DICE_ROLL: 'dice_roll',
  /** store → audio : un Effet de scène `playSfx` demande un son ponctuel du registre {id}. */
  SFX: 'sfx',
  /** store → * : fin de combat {victory:boolean} — gong de victoire, hooks futurs. */
  BATTLE_OVER: 'battle_over',
  /** store → * : un Test s'est résolu (`resolveTest`) {actorId, success, sl, roll, target} — SEAM
   *  unique consommé par `devtools.ts` (`__wfrp.lastRoll()`, recette navigateur, #514), jamais lu par
   *  du code de règles (observation pure, aucun état persisté). */
  TEST_RESOLVED: 'test_resolved',
  /** noyau → hôte : l'Effet `openCharacterCreator` demande la création d'un nouveau héros (sans charge) ;
   *  l'hôte web ouvre son assistant (`src/ui/creator`). */
  HEROS_A_CREER: 'heros_a_creer',
} as const;
