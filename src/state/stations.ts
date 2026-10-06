/**
 * STATIONS — index PUR des « postes » d'une scène pour une future vue top-down réutilisable : pièces d'artillerie
 * d'équipage (postes navals / emplacements de siège), et plus tard activités et scènes de bataille imbriquées.
 * Une Station est un point d'ancrage + une identité (label/icône/faction/équipage) ; AUCUN effet de règle — la
 * vérité mécanique reste la coque et ses `postes` (cf. `shipPostes.ts`). Module PUR (moteur + state pur, pas de store).
 */
import { isPosteManned } from './shipPostes';
import { battleSceneById } from './massBattleFlow';
import type { FireArc } from './fireArc';
import type { Combatant, ShipPoste } from '../engine/types';
import type { Scene } from './scene';
import { itemLabel } from '../engine/items';

export type StationKind = 'poste' | 'activity' | 'battleScene';

/** Référence STABLE d'une Station vers son entité-source (l'union est figée dès maintenant ; seul `poste`
 *  est peuplé en phase 1, `activity`/`battleScene` viendront). */
export type StationRef =
  | { kind: 'poste'; hullId: string; posteUid: string }
  | { kind: 'activity'; activityId: string }
  | { kind: 'battleScene'; sceneId: string };

export interface Station {
  id: string;
  kind: StationKind;
  pos: { x: number; y: number; z?: number };
  label: string;
  /** id `ICON_DEFS` (registre `src/ui/icons`) — pièce d'artillerie servie = `action/serve-engine`. */
  icon: string;
  /** Faction dérivée du `kind` de la coque : héros → allié, ennemi → ennemi, PNJ → neutre. */
  faction: 'ally' | 'enemy' | 'neutral';
  assignedIds: string[];
  manned: boolean;
  side?: FireArc;
  ref: StationRef;
}

const FACTION: Record<Combatant['kind'], Station['faction']> = { hero: 'ally', enemy: 'enemy', npc: 'neutral' };

/**
 * Indexe en Stations chaque poste des Combattants-coque (coque navale OU emplacement de siège — indifférent).
 * `anchorOf` résout la position spatiale de la pièce ; par défaut = la position de la coque (trivial pour un
 * emplacement au sol ; le consommateur naval injectera `posteAnchor` avec le cap). Un poste dont l'ancre est
 * indéfinie est ignoré. Le label et l'état d'équipage réutilisent les sources uniques existantes
 * (`poste.item.name`, `isPosteManned`). PUR.
 */
export function postesToStations(
  combatants: Combatant[],
  anchorOf: (hull: Combatant, poste: ShipPoste) => { x: number; y: number; z?: number } | undefined = (hull) => hull.pos,
): Station[] {
  const out: Station[] = [];
  for (const hull of combatants) {
    if (!hull.postes?.length) continue;
    for (const poste of hull.postes) {
      const pos = anchorOf(hull, poste);
      if (!pos) continue;
      out.push({
        id: `poste:${hull.id}:${poste.item.uid}`,
        kind: 'poste',
        pos,
        label: itemLabel(poste.item),
        icon: 'action/serve-engine',
        faction: FACTION[hull.kind],
        assignedIds: poste.crewIds ?? [],
        manned: isPosteManned(poste, combatants),
        side: poste.side,
        ref: { kind: 'poste', hullId: hull.id, posteUid: poste.item.uid },
      });
    }
  }
  return out;
}

/**
 * Indexe en Stations les Scènes cinématiques de la SITUATION d'un Round de Puissance de Bataille (S2) :
 * chaque `sceneId` présent devient une Station spatiale posée sur le plan du champ de bataille. La position
 * vient de l'ancre AUTHORÉE (`scene.stations`) ; à défaut, un repli DÉTERMINISTE l'étale (la démo reste
 * jouable sans authoring d'ancres). L'AFFECTATION explicite (`assignment[sceneId]` = ids des PJ postés,
 * Scène MULTI-PJ ADE II 8) alimente `assignedIds`/`manned` — une Scène postée s'affiche « servie ». Une Scène inconnue du catalogue
 * (`battleSceneById` undefined) est ignorée. Faction : `enemy` pour une Scène MENACE (`threat`, elle
 * s'impose au camp allié), `neutral` sinon (l'action se joue au contact, pas un camp fixe). PUR.
 */
export function battleScenesToStations(
  situation: string[],
  assignment: Record<string, string[]>,
  scene: Scene | null | undefined,
): Station[] {
  const anchors = new Map((scene?.stations ?? []).map((a) => [a.sceneId, a.pos] as const));
  const w = scene?.dimensions.w ?? 20;
  const h = scene?.dimensions.h ?? 12;
  const out: Station[] = [];
  situation.forEach((sceneId, i) => {
    const def = battleSceneById(sceneId);
    if (!def) return;
    // Ancre authorée prioritaire ; sinon étalement déterministe en grille sur le tiers droit du champ
    // (côté ennemi) pour que la démo sans ancres reste lisible, borné dans les dimensions de la scène.
    const anchor = anchors.get(sceneId);
    const pos = anchor ?? {
      x: Math.min(w - 1, Math.round(w * 0.5) + (i % 3) * 2),
      y: Math.min(h - 1, 2 + Math.floor(i / 3) * 3),
    };
    const heroIds = assignment[sceneId] ?? [];
    out.push({
      id: `battleScene:${sceneId}`,
      kind: 'battleScene',
      pos,
      label: def.label,
      icon: 'action/attack',
      faction: def.sceneKind === 'threat' ? 'enemy' : 'neutral',
      assignedIds: heroIds,
      manned: heroIds.length > 0,
      ref: { kind: 'battleScene', sceneId },
    });
  });
  return out;
}
