/**
 * Caméra du stage iso : transition « dim-and-turn » des 8 crans (rotation/edge-on), zoom molette,
 * caméra libre (camPan, remise à zéro au changement d'unité active), calcul du POINT FOCAL
 * (leader/centroïde/actif/paire de visée/peek de frise) et du cadre VISIBLE (culling d'animation).
 */
import { useEffect, useRef, useState } from 'react';
import { useGame, type BattleState } from '../../state/store';
import { Combatant } from '../../engine/types';
import { isOutOfAction } from '../../engine/conditions';
import { Dims, screenToTile } from '../../geometry/iso';
import { accorderPan } from '../../state/stagePan';
import type { WalkPos } from '../fx/walkPose';

// Viewport virtuel : le SVG remplit tout l'espace dispo (preserveAspectRatio slice) et la caméra
// recadre autour du point focal (groupe / combattant actif).
export const VW = 1100;
export const VH = 720;

/** État caméra réactif : rotation AFFICHÉE (retardée pour masquer le ré-agencement sous le creux
 *  d'opacité de la transition) et zoom (molette non-passive). Le décalage manuel, lui, ne remonte
 *  PAS en état de rendu : le commis du store descend au panoramique vivant (`state/stagePan`). */
export function useStageCamera(): {
  shownRot: 0 | 1 | 2 | 3;
  shownEdge: boolean;
  turning: boolean;
  zoom: number;
  /** À poser en `ref` sur le SVG de la surcouche de plateau : c'est lui qui porte la molette. */
  attacherMolette: (svg: SVGSVGElement | null) => void;
} {
  const zoom = useGame((s) => s.zoom);
  // Rotation caméra (cran de 90°). `camRot` = cible (store, lu en live par le rig) ; `shownRot` =
  // orientation AFFICHÉE, retardée. `camEdge` : cran impair, vue « de face » (edge-on) axis-alignée 3D.
  const camRot = useGame((s) => s.camRot);
  const camEdge = useGame((s) => s.camEdge);
  const camPan = useGame((s) => s.camPan);
  const resetCamPan = useGame((s) => s.resetCamPan);
  const [shownRot, setShownRot] = useState<0 | 1 | 2 | 3>(camRot);
  const [shownEdge, setShownEdge] = useState(camEdge);
  const [turning, setTurning] = useState(false);
  // Dépend de camRot SEUL (pas de shownRot) : sinon le swap de shownRot à mi-course re-déclenche
  // l'effet et son cleanup annule le timer qui rétablit `turning=false` → la scène resterait sombre.
  // `prevCam` filtre les re-rendus non liés.
  const prevCam = useRef({ rot: camRot, edge: camEdge });
  useEffect(() => {
    if (prevCam.current.rot === camRot && prevCam.current.edge === camEdge) return;
    prevCam.current = { rot: camRot, edge: camEdge };
    setTurning(true);
    const t1 = window.setTimeout(() => { setShownRot(camRot); setShownEdge(camEdge); }, 130); // swap au creux
    const t2 = window.setTimeout(() => setTurning(false), 260); // remontée
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [camRot, camEdge]);

  // Zoom molette (listener non-passif pour pouvoir preventDefault le scroll de page). L'écoute suit
  // l'ÉLÉMENT par une ref-callback, jamais un effet de montage : la surcouche de plateau se démonte au
  // passage en première personne et un aller-retour en remonte une NEUVE — une écoute posée une fois
  // pour toutes serait morte sur l'élément d'avant (#1385).
  const molette = useRef<{ el: SVGSVGElement | null; onWheel: (e: WheelEvent) => void }>({
    el: null,
    onWheel: (e: WheelEvent) => {
      e.preventDefault();
      useGame.getState().setZoom(useGame.getState().zoom - e.deltaY * 0.0015); // le store borne
    },
  }).current;
  const attacherMolette = useRef((svg: SVGSVGElement | null) => {
    if (molette.el === svg) return;
    molette.el?.removeEventListener('wheel', molette.onWheel);
    molette.el = svg;
    svg?.addEventListener('wheel', molette.onWheel, { passive: false });
  }).current;

  // Refocus « sur celui qui joue après » : tout décalage manuel de caméra est annulé quand l'unité
  // active change (nouveau tour) — sinon le pion actif pourrait rester hors champ après un panoramique.
  const activeTurnKey = useGame((s) => (s.mode === 'battle' && s.battle ? s.battle.order[s.battle.turn] : 'explore'));
  useEffect(() => {
    resetCamPan();
  }, [activeTurnKey, resetCamPan]);

  // Le décalage manuel COMMIS descend au panoramique VIVANT que `camAt` lit à la frame : c'est ici
  // qu'une remise à zéro (nouveau tour, touche de recentrage) et le commit du relâchement d'un glisser
  // atteignent la vue. Écriture dans un module = pas de re-rendu (même patron que `setVisibleTileBounds`).
  accorderPan(camPan);
  return { shownRot, shownEdge, turning, zoom, attacherMolette };
}

/** Attaque/sort ENNEMI télégraphié (actorAim) : la paire à cadrer + le style de ligne (pleine en
 *  mêlée, pointillée tir/sort). Le ciblage du JOUEUR a son propre réticule. */
export function cameraTargeting(
  battle: BattleState | null,
  actorAim: { fromId: string; toId: string; kind: string } | null,
): { from: Combatant; to: Combatant; melee?: boolean } | null {
  if (!battle || !actorAim) return null;
  const a = battle.combatants.find((c) => c.id === actorAim.fromId);
  const b = battle.combatants.find((c) => c.id === actorAim.toId);
  return a?.pos && b?.pos ? { from: a, to: b, melee: actorAim.kind === 'melee' || actorAim.kind === 'charge' } : null;
}

/** POINT FOCAL de la caméra (PUR, appelé à la frame — suit le token qui GLISSE via `walkPosOf`) :
 *  hors combat le leader visuel ; une paire attaquant↔cible (télégraphe OU attaque/incantation en
 *  cours de résolution — sinon on voit mieux ce que fait l'IA que soi-même) se cadre à son MILIEU ;
 *  en combat l'unité active (ou le centroïde à l'ouverture du Round 1 / sans actif) ; le survol d'un
 *  portrait de FRISE (peek) prime temporairement.
 *
 *  `sujet` IDENTIFIE ce que la caméra suit — c'est lui, et non les coordonnées, qui dit qu'une CIBLE
 *  a sauté : un marcheur qui glisse garde le sien, un peek de frise ou un changement d'unité active
 *  en change. L'hôte s'en sert pour adoucir le saut à la SOURCE (`adoucirFocal`). */
export function stageFocus(args: {
  mode: string;
  battle: BattleState | null;
  partyPos: { x: number; y: number };
  partyLeader: Combatant | undefined;
  walkPosOf: WalkPos;
  planView: boolean;
  hoverCombatantId: string | null;
  targeting: { from: Combatant; to: Combatant } | null;
  pendingAttack: { attackerId: string; targetId: string } | null;
  pendingCast: { casterId: string; targetId?: string; zone?: { center?: { x: number; y: number } | null } } | null;
}): { x: number; y: number; sujet: string } {
  const { mode, battle, partyPos, partyLeader, walkPosOf, planView, hoverCombatantId, targeting, pendingAttack, pendingCast } = args;
  let sujet = 'groupe';
  let camPair: { from: { x: number; y: number }; to: { x: number; y: number } } | null = null;
  if (targeting) {
    camPair = { from: targeting.from.pos!, to: targeting.to.pos! };
    sujet = `paire:${targeting.from.id}>${targeting.to.id}`;
  }
  if (!camPair && mode === 'battle' && battle && pendingAttack) {
    const a = battle.combatants.find((c) => c.id === pendingAttack.attackerId);
    const b = battle.combatants.find((c) => c.id === pendingAttack.targetId);
    if (a?.pos && b?.pos) {
      camPair = { from: a.pos, to: b.pos };
      sujet = `paire:${a.id}>${b.id}`;
    }
  }
  if (!camPair && mode === 'battle' && battle && pendingCast) {
    const a = battle.combatants.find((c) => c.id === pendingCast.casterId);
    const to = pendingCast.zone?.center ?? battle.combatants.find((c) => c.id === pendingCast.targetId)?.pos;
    if (a?.pos && to) {
      camPair = { from: a.pos, to };
      // IDS SEULS (jamais de coordonnées) : la cible d'une ZONE n'a pas d'id — elle se nomme par son
      // rôle. Un centre de zone qui se déplace bouge la caméra, il ne change pas de SUJET (sans quoi
      // chaque pixel de déplacement du gabarit relancerait un adoucissement).
      sujet = `paire:${a.id}>${pendingCast.targetId ?? 'zone'}`;
    }
  }
  // Hors combat, la caméra suit la position VISUELLE du leader (qui glisse via ANIM_MOVE), pas la
  // tuile logique partyPos qui avance d'une case toutes les 150 ms.
  let focus: { x: number; y: number } = partyPos;
  if (mode !== 'battle' && partyLeader) {
    // Le FOCUS suit le corps qui marche (le meneur, dont le glissement est keyé par son id) ; le SUJET,
    // lui, est le GROUPE et ne dépend d'aucun héros — même raison qu'au centre de zone ci-dessus : un
    // meneur qui change (le premier du roster tombe) relancerait sinon un adoucissement de focale alors
    // que la caméra ne va nulle part.
    focus = walkPosOf(partyLeader.id, partyPos.x, partyPos.y);
    sujet = 'groupe';
  }
  if (camPair) {
    // Cadrer les DEUX : on centre sur le milieu attaquant ↔ cible.
    focus = { x: Math.round((camPair.from.x + camPair.to.x) / 2), y: Math.round((camPair.from.y + camPair.to.y) / 2) };
  } else if (mode === 'battle' && battle) {
    const alive = battle.combatants.filter((c) => c.pos && !isOutOfAction(c));
    const centroid = alive.length
      ? {
          x: Math.round(alive.reduce((s, c) => s + c.pos!.x, 0) / alive.length),
          y: Math.round(alive.reduce((s, c) => s + c.pos!.y, 0) / alive.length),
        }
      : focus;
    const active = battle.combatants.find((c) => c.id === battle.order[battle.turn] && c.pos);
    // Ouverture du combat (pause du Round 1) : on cadre le CENTRE du champ (vue des forces) ;
    // sinon la caméra SUIT le token actif qui glisse (n'arrive plus avant lui).
    if (planView) {
      focus = centroid;
      sujet = 'centroide';
    } else if (active?.pos) {
      focus = walkPosOf(active.id, active.pos.x, active.pos.y);
      sujet = `actif:${active.id}`;
    } else {
      focus = centroid;
      sujet = 'centroide';
    }
  }
  // Peek caméra (survol d'un portrait dans la FRISE d'initiative) — local/read-only, actif même hors
  // de son tour (coop) ; le survol d'un TOKEN sur la carte, lui, ne bouge pas la caméra.
  if (mode === 'battle' && battle && hoverCombatantId) {
    const peeked = battle.combatants.find((c) => c.id === hoverCombatantId && c.pos);
    if (peeked?.pos) {
      focus = walkPosOf(peeked.id, peeked.pos.x, peeked.pos.y);
      sujet = `peek:${peeked.id}`;
    }
  }
  return { x: focus.x, y: focus.y, sujet };
}

/** DURÉE de l'adoucissement d'un SAUT de focale (ms) — le temps que la vue met à rejoindre sa nouvelle
 *  cible (unité active, peek de frise, paire de visée). */
export const DUREE_FOCALE_MS = 300;

/** État d'un adoucissement en cours : le point focal QUITTÉ, figé, et l'instant du saut. */
export interface LissageFocal {
  depart: { x: number; y: number };
  t0: number;
}

/** Point focal ADOUCI à l'instant `now` — PUR en `now` (départ figé + cible vivante + horodatage,
 *  aucune accumulation par appel) : les deux clients de la caméra (groupe d'overlays SVG, caméra
 *  three) en lisent la MÊME valeur à la MÊME image, quel que soit l'ordre où ils la demandent.
 *  Ease-out cubique ; hors lissage, la cible telle quelle (un panoramique manuel reste 1:1). */
export function adoucirFocal(l: LissageFocal | null, cible: { x: number; y: number }, now: number): { x: number; y: number } {
  if (!l) return cible;
  const u = Math.min(1, Math.max(0, (now - l.t0) / DUREE_FOCALE_MS));
  if (u >= 1) return cible;
  const e = 1 - (1 - u) ** 3;
  return { x: l.depart.x + (cible.x - l.depart.x) * e, y: l.depart.y + (cible.y - l.depart.y) * e };
}

/** Cadre VISIBLE en tuiles (AABB des 4 coins de la fenêtre projetés) : culling d'animation
 *  (setVisibleTileBounds), borné par la fenêtre et non par la scène. */
export function computeViewBounds(cam: { x: number; y: number }, zoom: number, dims: Dims): { minX: number; maxX: number; minY: number; maxY: number } {
  const toTile = (sx: number, sy: number) => screenToTile((sx - VW / 2) / zoom + VW / 2 - cam.x, (sy - VH / 2) / zoom + VH / 2 - cam.y, dims);
  const cs = [toTile(0, 0), toTile(VW, 0), toTile(0, VH), toTile(VW, VH)];
  const xs = cs.map((c) => c.x), ys = cs.map((c) => c.y);
  return { minX: Math.floor(Math.min(...xs)), maxX: Math.ceil(Math.max(...xs)), minY: Math.floor(Math.min(...ys)), maxY: Math.ceil(Math.max(...ys)) };
}
