/**
 * Ciblage au SURVOL du stage (memoïsé — previewAttack/LdV/pathTo ne tournent pas à 60 Hz pendant les
 * glissements de token) : réticule + carte de jet du FAISABLE (`hoverAim` — une cible que le mode
 * courant refuse ne rend RIEN, arbitrage 2026-08-24 ; son refus se dit AU CLIC), combattant
 * SOUS le focus (`hoveredId`, miroir frise), aperçus de déplacement (combat `hoverMove` / exploration
 * `explorePath`), grisage hors-LdV (`ghostIds`) et jauges EN DIRECT (hoverDelta).
 * Le curseur clavier/manette (combatCursor) PRIME sur la souris locale (hover) ET sur le survol de
 * frise (hoverCombatantId) — un seul réticule/aperçu à la fois.
 */
import { useEffect, useMemo } from 'react';
import { useGame } from '../../state/store';
import { Scene } from '../../state/scene';
import type { Pt } from '../../state/path';
import { exploreMovePlan, optionsDeCheminDuGroupe } from '../../state/exploreNav';
import { isOutOfAction, canTakeAction, hasCondition } from '../../engine/conditions';
import { isFrenzied } from '../../engine/psychology';
import { combatantAtTile } from '../../state/combatGeometry';
import { controlsCombatant } from '../../state/netOwnership';
import { outOfSightTargetIds, castOutOfSightTargetIds, resolveMovement, previewResourceDelta, frenzyTarget, hasFreeWeaponAttack } from '../../state/combatFlow';
import { hoverTargeting, tilePreviewAt } from '../../state/targeting';
import type { DifficultyShown } from '../../engine/combat';
import { courseArmee } from '../../state/localIntent';
import { activeCombatant } from '../../state/store';
import { modalBlocksMapHover } from '../../state/mapHover';
import { mapTargetingActive } from '../../state/targetingHolder';
import type { RoomPortal } from '../../state/roomPortals';
import { CAST_MODE } from '../../state/targetingModes';

export interface HoverAim {
  fromId: string | null; // départ de la ligne (résolu en pixels au rendu — suit le glissement)
  toId: string;
  line: 'dashed' | 'solid' | null;
  /** Chemin RÉEL d'un déplacement combiné (Charge / rejoindre) — tracé à la place de la ligne droite. */
  path?: { x: number; y: number }[];
  /** Carte de jet : nom de la cible / arme-ou-sort / compétence + valeur / palier / dégâts. */
  tip: { title: string; targetName: string; skill: string; base: number; mod: number; dmg: number | null; difficulty?: DifficultyShown } | null;
  /** Aperçu synthétisé (forme battle.preview) pour le clignotant des jauges (previewResourceDelta). */
  preview?: { kind: 'attack' | 'charge' | 'moveAttack'; targetId: string; path?: { x: number; y: number }[]; dest?: { x: number; y: number }; cost?: number; adv?: 0 | 1 };
}

export function useHoverTargeting(
  scene: Scene | null,
  hover: Pt | null,
  myTurn: boolean,
  hoveredPortal: RoomPortal | null = null,
) {
  const mode = useGame((s) => s.mode);
  const battle = useGame((s) => s.battle);
  const dialogue = useGame((s) => s.dialogue);
  const partyPos = useGame((s) => s.partyPos);
  const party = useGame((s) => s.party);
  const combatCursor = useGame((s) => s.combatCursor);
  const hoverCombatantId = useGame((s) => s.hoverCombatantId);
  const setHovered = useGame((s) => s.setHovered);
  // Une modale bloque la scène ? Verdict UNIQUE de l'arbitre (registre `MODAL_DEFS`) : la carte est
  // inerte, sauf modale pilotée par la carte (ciblage de sort).
  const mapInert = useGame(modalBlocksMapHover);
  // Un ciblage CARTE est-il en cours ? Verdict UNIQUE du registre des pendings de ciblage.
  const mapTargeting = useGame(mapTargetingActive);
  const pendingCast = useGame((s) => s.pendingCast);
  const pendingCleave = useGame((s) => s.pendingCleave);
  const pendingDualStrike = useGame((s) => s.pendingDualStrike);
  const preemptAiming = useGame((s) => s.preemptAiming);

  // Signaux de survol EFFECTIFS : le curseur clavier/manette PRIME sur la souris locale (hover) ET sur
  // le survol de frise — la souris reprend la main dès qu'elle bouge (onPointerMove → clearCursor()).
  const effHover = combatCursor?.tile ?? hover;
  const effFocusId = combatCursor?.snappedId ?? hoverCombatantId;

  // Grisage hors-LdV : ennemis que le héros actif ne peut PAS viser au tir faute de Ligne de Vue
  // (LDB 13 l.114) → pion fantomatique. Distingue « hors LdV » de « hors de portée ». Actif pendant la
  // visée — mode neutre ou catégorie Tir ouverte — tant que l'Action n'est pas consommée.
  const ghostIds = useMemo<Set<string>>(() => {
    if (mode !== 'battle' || !battle || battle.over) return new Set();
    // Mode incantation : grisage hors-LdV du SORT (LDB 46 l.121), indépendant de l'arme portée. Le mode
    // armé se lit au REGISTRE DES MODES (`CAST_MODE.id`), jamais à un id d'action recopié : l'entrée qui
    // arme ce mode porte son propre id, distinct du mode qu'elle pose.
    if (battle.action === CAST_MODE.id && battle.selectedSpellId) return castOutOfSightTargetIds(useGame.getState);
    if (battle.acted || battle.action !== null) return new Set();
    return outOfSightTargetIds(useGame.getState);
  }, [scene, mode, battle]);

  // Ciblage du JOUEUR au survol — rejoue les MÊMES prédicats que le clic : réticule présent = clic valide.
  const hoverAim = useMemo<HoverAim | null>(() => {
    if (mode !== 'battle' || !battle || battle.over || (!effHover && !effFocusId)) return null;
    // Un jet à cible est déjà en cours (modale) : le réticule PERSISTANT prend le relais au rendu.
    if (mapInert) return null;
    // Source du survol EFFECTIF : la cible aimantée du curseur (effFocusId) ou un PORTRAIT de frise
    // priment sur la tuile sous la souris (effHover) → réticule + infobulle identiques.
    const occ = effFocusId
      ? battle.combatants.find((c) => c.id === effFocusId && c.pos && !isOutOfAction(c))
      : effHover ? combatantAtTile(battle.combatants, effHover.x, effHover.y, effHover.z ?? 0) : null;
    if (!occ) return null;
    const st = useGame.getState;
    // Tir rapide ARMÉ (interruption hors tour, LDB 10) : la visée suit le TIREUR (`preemptAiming`), pas l'actif —
    // MÊME `hoverTargeting` que le ciblage normal (réticule + ligne + carte de jet du faisable). Précède
    // le verrou « Mon Tour » (la pré-emption a lieu pendant la pause, où il n'y a AUCUN combattant actif).
    if (preemptAiming) {
      const shooter = battle.combatants.find((c) => c.id === preemptAiming);
      if (!shooter?.pos) return null;
      const ht = hoverTargeting(st, shooter, occ);
      if (ht.kind !== 'ok') return null;
      return { fromId: shooter.id, toId: occ.id, line: ht.line, path: ht.path, tip: { title: ht.title, targetName: ht.targetName, skill: ht.skill, base: ht.base, mod: ht.mod, dmg: ht.dmg, difficulty: ht.difficulty }, preview: ht.preview };
    }
    // Flux différés (bandeau TargetPrompt — Frappe Mortelle / 2ᵉ frappe / Surincantation +Cible) : le
    // réticule vient du MODE courant (targetingModes via hoverTargeting), AVANT les verrous acted/
    // Frénésie (ces ciblages surviennent APRÈS l'attaque-Action).
    if (pendingCleave || pendingDualStrike || pendingCast?.pickingTargets) {
      const actor = battle.combatants.find((c) => c.id === battle.order[battle.turn]);
      if (!actor) return null;
      const ht = hoverTargeting(st, actor, occ);
      // L'infobulle vaut ici comme au ciblage ordinaire : ces interludes ouvrent un JET (2ᵉ frappe,
      // enchaînement), et le survol en dit la valeur et la Difficulté. Les modes qui ne jettent rien
      // (cibles de Surincantation) laissent leurs zones à 0 — la carte s'adapte, elle n'invente pas.
      return ht.kind === 'ok'
        ? { fromId: actor.id, toId: occ.id, line: ht.line, tip: { title: ht.title, targetName: ht.targetName, skill: ht.skill, base: ht.base, mod: ht.mod, dmg: ht.dmg, difficulty: ht.difficulty } }
        : null;
    }
    if (!myTurn) return null; // le ciblage NORMAL (ci-dessous) exige Mon Tour ; la pré-emption (ci-dessus) non
    const activeH = battle.combatants.find((c) => c.id === battle.order[battle.turn]);
    if (!activeH || !controlsCombatant(st(), activeH) || !activeH.pos) return null;
    // Mêmes verrous que battleClickEntity : Action consommée (sauf attaque libre de Frénésie),
    // Sonné/Brisé, cible de Frénésie IMPOSÉE (le plus proche en LdV).
    const freeFrenzy = battle.action === null && hasFreeWeaponAttack(activeH);
    if (battle.acted && !freeFrenzy) return null;
    if (battle.action === null && (!canTakeAction(activeH) || hasCondition(activeH, 'brise'))) return null;
    if (battle.action === null && isFrenzied(activeH)) {
      const ft = frenzyTarget(st, activeH);
      if (ft && ft.id !== occ.id) return null;
    }
    // Piétinement / zone / mêlée : tout l'aperçu (réticule + chemin + tip) passe par hoverTargeting,
    // qui lit l'`AttackOption` armée (selectedAttack), jamais une branche par mode.
    const ht = hoverTargeting(st, activeH, occ);
    if (ht.kind !== 'ok') return null;
    return { fromId: activeH.id, toId: occ.id, line: ht.line, path: ht.path, tip: { title: ht.title, targetName: ht.targetName, skill: ht.skill, base: ht.base, mod: ht.mod, dmg: ht.dmg, difficulty: ht.difficulty }, preview: ht.preview };
  }, [combatCursor, hover, hoverCombatantId, mode, battle, scene, myTurn, preemptAiming, mapInert, pendingCast, pendingCleave, pendingDualStrike]);

  // Combattant SOUS le focus (tuile survolée OU portrait de frise/Tab) — INDÉPENDANT du ciblage
  // (hoverAim exige Mon Tour + cible valide). Pilote le halo de focus du token ET, synchronisé au
  // store (`hovered`), le miroir réciproque sur la frise. Source unique du « qui est mis en évidence ».
  const hoveredId = useMemo<string | null>(() => {
    if (mode !== 'battle' || !battle) return null;
    const occ = effFocusId
      ? battle.combatants.find((c) => c.id === effFocusId && c.pos && !isOutOfAction(c))
      : effHover ? combatantAtTile(battle.combatants, effHover.x, effHover.y, effHover.z ?? 0) : null;
    return occ?.id ?? null;
  }, [combatCursor, mode, battle, hover, hoverCombatantId]);
  useEffect(() => { setHovered(hoveredId); }, [hoveredId, setHovered]);

  // Aperçu de DÉPLACEMENT au SURVOL (desktop) ET au curseur clavier/manette (effHover) : le chemin + le
  // coût se matérialisent sous la souris, le clic UNIQUE commet — le tap-1 (battle.preview) reste le
  // flux tactile. Mêmes sources que le clic. Un mode-CASE du catalogue (Pousser/Téléportation/pose de
  // zone, `tilePreviewAt` #198) PRIME et rend son aperçu même Action consommée / case VIDE (le mode
  // décide, pas ce hook) ; sinon on retombe sur l'aperçu de déplacement NORMAL (mode neutre only).
  const hoverMovementResolution = useMemo(() => {
    if (mode !== 'battle' || !battle || battle.over || !effHover || battle.preview || !myTurn) return null;
    const tp = tilePreviewAt(useGame.getState, effHover);
    if (tp) return null;
    // Modale bloquante (arbitre) OU ciblage CARTE en cours : on désigne une cible, on ne trace pas de
    // déplacement. Le second verdict est celui du registre (`mapTargetingActive`) — un pending de
    // ciblage nouveau y entre par UNE ligne, jamais par une liste littérale rallongée ici.
    if (mapInert || mapTargeting) return null;
    const occ = combatantAtTile(battle.combatants, effHover.x, effHover.y, effHover.z ?? 0);
    return occ ? null : resolveMovement(useGame.getState, effHover);
  }, [combatCursor, hover, mode, battle, myTurn, mapInert, mapTargeting]);

  const hoverMove = useMemo<{ kind: 'move' | 'run' | 'tile'; path: Pt[]; cost?: number; label: string } | null>(() => {
    if (mode !== 'battle' || !battle || battle.over || !effHover || battle.preview || !myTurn) return null;
    const tp = tilePreviewAt(useGame.getState, effHover);
    if (tp) return { kind: 'tile', path: tp.path ?? [], cost: tp.cost, label: tp.label };
    if (hoverMovementResolution?.status !== 'ok') return null;
    // LE SURVOL N'AFFICHE QUE LE FAISABLE (arbitrage 2026-08-24) : au-delà de la Marche, le clic-sol est
    // REFUSÉ tant que la Course n'est pas armée (mêmes prédicats qu'au commit, `combatSlice` — exemption
    // Frénésie comprise), donc la case ne se peint PAS : c'est le clic qui dit le refus.
    if (hoverMovementResolution.kind === 'run') {
      const active = activeCombatant(battle);
      if (!courseArmee(useGame.getState) && !(active && isFrenzied(active))) return null;
    }
    return {
      kind: hoverMovementResolution.kind,
      path: hoverMovementResolution.path,
      cost: hoverMovementResolution.cost,
      label: hoverMovementResolution.kind === 'move' ? `Aller (${hoverMovementResolution.cost})` : 'Courir',
    };
  }, [effHover, mode, battle, myTurn, hoverMovementResolution]);

  // Aperçu de DÉPLACEMENT au SURVOL hors combat : même calcul que le clic (moveAlong) — pathTo avec la
  // portée de saut du GROUPE. Memoïsé sur (hover, partyPos, scene) → le BFS ne tourne PAS à la frame.
  const explorePlan = useMemo(() => {
    const tile = hoveredPortal?.to ?? hover;
    if (mode !== 'exploration' || dialogue || !scene || !tile) return null;
    if (tile.x === partyPos.x && tile.y === partyPos.y && (tile.z ?? 0) === (partyPos.z ?? 0)) return null;
    return exploreMovePlan(scene, partyPos, tile, optionsDeCheminDuGroupe(party));
  }, [hover, hoveredPortal, mode, dialogue, scene, partyPos, party]);
  const explorePath = explorePlan?.path ?? null;

  // Jauges EN DIRECT (clignotant des gouttières de l'arche) : le coût/gain (Action/Mouvement/Avantage) de
  // l'intention SOUS LA SOURIS — un aperçu de la forme tap-1 est synthétisé du survol et passe par la
  // MÊME source (`previewResourceDelta`). Écrit au store seulement quand le delta CHANGE.
  useEffect(() => {
    const pvLike = hoverAim?.preview ?? (hoverMove && effHover && hoverMove.kind !== 'tile' ? { kind: hoverMove.kind, tile: { ...effHover }, path: hoverMove.path, cost: hoverMove.cost } : null);
    const delta = pvLike && battle ? previewResourceDelta({ ...battle, preview: pvLike as never }) : null;
    const next = delta
      ? { ...delta, ...(hoverMovementResolution ? { movement: hoverMovementResolution } : {}) }
      : hoverMovementResolution
        ? { action: 0, move: 0, adv: 0, movement: hoverMovementResolution }
        : null;
    const cur = useGame.getState().hoverDelta;
    const same = (!next && !cur) || (!!next && !!cur
      && next.action === cur.action && next.move === cur.move && next.adv === cur.adv
      && next.movement === cur.movement);
    if (!same) useGame.setState({ hoverDelta: next });
  }, [hoverAim, hoverMove, hoverMovementResolution, battle, effHover]);

  return { hoverAim, hoveredId, hoverMove, explorePath, ghostIds, effHover };
}
