/**
 * BUILDER de SURBRILLANCES de combat (jeu seul) — les grilles LOURDES memoïsées du stage en éléments
 * SÉMANTIQUES camera-free : portées de Marche/Course, teintes d'équipe des cases occupées, zones
 * persistantes (fumée/feu), anneaux de cibles (attaque/soin/flux différés/« tirer dans le tas »).
 * Le monde volumique (`backends/webgl/highlightMeshes`) les pose et leur donne leurs couleurs.
 * Les APERÇUS par-frame (tap-1, survol, tether d'engagement, halo de l'actif) restent au stage.
 * PUR : les portées/cibles (dérivées du store) arrivent EN DONNÉES (`HighlightsView`), le builder ne
 * fait que les mapper en cases + hauteur MÉTRIQUE (le lift d'étage est projeté par le backend).
 */
import { hauteurDe, sceneMetresPerTile, type Scene } from '../../state/scene';
import { isOutOfAction } from '../../engine/conditions';
import { isRider } from '../../state/mount';
import { footprintN } from '../../state/footprint';
import { rangeBandModifier } from '../../engine/combat';
import type { BattleState } from '../../state/store';
import type { Pt } from '../../state/path';
import { chebyshev } from '../../engine/grid';

/** Élément sémantique de surbrillance : case + hauteur métrique + nature. Les clés reprennent les clés
 *  React historiques (stables entre frames). */
export type HighlightEl = { key: string; cell: { x: number; y: number; z: number }; h: number } & (
  | { kind: 'walk' | 'run' }
  | { kind: 'intent' }
  | { kind: 'team'; hero: boolean; active: boolean }
  | { kind: 'zone'; smoke: boolean }
  | { kind: 'ring'; tone: 'target' | 'ally' | 'crowd' }
  | { kind: 'rangeBand'; tone: 'bonus' | 'neutre' | 'malus' }
);

/** Teinte d'une bande de portée (LDB « Les armes », modificateur `rangeBandModifier`) : dérivée de son
 *  SIGNE — > 0 (Bout Portant/Courte) → `bonus`, = 0 (Moyenne) → `neutre`, < 0 (Longue/Extrême) → `malus` ;
 *  hors de portée (au-delà de Portée×3) → `null`. Répond directement à « dois-je bouger pour améliorer
 *  mon jet ? », affiché au survol d'un tireur (`combatHighlightObjs`). */
export function rangeBandTone(distanceTiles: number, rangeMeters: number, metresPerTile = 2): 'bonus' | 'neutre' | 'malus' | null {
  const mod = rangeBandModifier(distanceTiles, rangeMeters, metresPerTile);
  if (mod == null) return null;
  return mod > 0 ? 'bonus' : mod < 0 ? 'malus' : 'neutre';
}

/** Vérités dérivées du STORE, préparées par le stage (le builder reste pur et testable) :
 *  portée de Marche affichée, zone de Course, anneaux d'attaque du mode neutre, cibles éligibles de
 *  « tirer dans le tas », candidats du mode de ciblage courant (soin/flux différés). */
export interface HighlightsView {
  myTurn: boolean;
  walkReach: ReadonlyMap<string, number>;
  runReach: ReadonlyMap<string, number>;
  /** Id de l'unité active (une monture est « active » si SON cavalier l'est). */
  activeId: string | null;
  /** Cibles à anneau d'attaque (mode neutre) — null si le contexte ne les affiche pas. */
  eligibleIds: ReadonlySet<string> | null;
  /** Cibles éligibles « tirer dans le tas » — null hors pendingAttack.intoCrowd. */
  crowdIds: ReadonlySet<string> | null;
  /** Candidats du mode de ciblage courant + teinte amie (soin) + déjà cochés (surincantation). */
  candidates: { ids: readonly string[]; friendly: boolean; checkedIds: ReadonlySet<string> | null } | null;
  /** Portée de l'INTENTION ARMÉE depuis l'interface (Charge, Course, Mouvement — `state/localIntent`) :
   *  la bande de cases que le joueur a demandé à VOIR avant de cliquer (spec HUD zone 4). Vide quand
   *  aucune intention n'est armée. */
  intentReach: ReadonlyMap<string, number>;
  /** Tireur SURVOLÉ armé d'une arme à distance : bandes de portée à colorer autour de sa position
   *  (`pos`) jusqu'à sa Portée max (Portée×3, LDB « Les armes ») — null hors survol d'un tireur. */
  rangeBandSource: { pos: Pt; rangeM: number } | null;
}

export function buildHighlights(scene: Scene, battle: BattleState, view: HighlightsView): HighlightEl[] {
  const out: HighlightEl[] = [];
  const { w: sw, h: sh } = scene.dimensions;
  const inScene = (x: number, y: number) => x >= 0 && y >= 0 && x < sw && y < sh;
  // Hauteur MÉTRIQUE de la surface d'une case, relief de la couche 0 compris : la même que celle où
  // le sol est bâti (`builders/floors.ts`), sans quoi le quad se pose sous la dalle.
  const hAt = (x: number, y: number, z: number) => hauteurDe(scene, { x, y, z });
  const parse = (k: string): [number, number, number] => {
    const [x, y, z = 0] = k.split(',').map(Number); // clé z-aware : « x,y » (sol) ou « x,y,z » (étage)
    return [x, y, z];
  };
  // Portée de Marche AFFICHÉE EN PERMANENCE au tour d'un héros (modèle de clic implicite).
  if (view.myTurn)
    for (const k of view.walkReach.keys()) {
      const [x, y, z] = parse(k);
      out.push({ key: `h${k}`, cell: { x, y, z }, h: hAt(x, y, z), kind: 'walk' });
    }
  // Zone de COURSE (LDB 15 l.79-82) au-delà de la Marche : y cliquer demandera le Test `course`.
  if (view.myTurn)
    for (const k of view.runReach.keys()) {
      if (view.walkReach.has(k)) continue;
      const [x, y, z] = parse(k);
      out.push({ key: `r${k}`, cell: { x, y, z }, h: hAt(x, y, z), kind: 'run' });
    }
  // Teinte d'équipe des CASES occupées : allié vert / ennemi rouge / actif jaune, sur toute l'empreinte.
  for (const c of battle.combatants) {
    if (!c.pos || isOutOfAction(c)) continue;
    if (isRider(c)) continue; // le cavalier est REPRÉSENTÉ par l'empreinte de sa MONTURE
    const active = c.id === view.activeId || c.riderId === view.activeId;
    const fp = footprintN(c);
    const cz = c.pos.z ?? 0;
    for (let dx = 0; dx < fp; dx++)
      for (let dy = 0; dy < fp; dy++) {
        const x = c.pos.x + dx, y = c.pos.y + dy;
        if (!inScene(x, y)) continue; // une empreinte N×N débordant le bord ne peint que ses cases de carte
        out.push({ key: `tt${c.id}-${dx}-${dy}`, cell: { x, y, z: cz }, h: hAt(x, y, cz), kind: 'team', hero: c.kind === 'hero', active });
      }
  }
  // Zones persistantes (L11) : fumée opaque / feu translucide — l'occupant voit le danger, à la
  // hauteur RÉELLE de la tuile de zone (t.z) — une zone de fumée/feu d'un combat en hauteur se peint
  // sur SON étage. La borne de carte des zones vit à l'ÉCRITURE (`clampZoneTiles`, zones.ts, appliqué
  // aux sites de pose) — le builder propage sa source telle quelle.
  (battle.zones ?? []).forEach((zone, zi) => {
    for (const t of zone.tiles) {
      const tz = t.z ?? 0;
      out.push({ key: `zone-${zone.id ?? zi}-${t.x}-${t.y}-${tz}`, cell: { x: t.x, y: t.y, z: tz }, h: hAt(t.x, t.y, tz), kind: 'zone', smoke: !!zone.blocksLoS });
    }
  });
  // Cibles VALIDES de l'attaque (R4) : anneau « cliquable pour attaquer » (mode neutre).
  if (view.eligibleIds)
    for (const c of battle.combatants) {
      if (!c.pos || !view.eligibleIds.has(c.id)) continue;
      const cz = c.pos.z ?? 0;
      out.push({ key: `tgt-${c.id}`, cell: { x: c.pos.x, y: c.pos.y, z: cz }, h: hAt(c.pos.x, c.pos.y, cz), kind: 'ring', tone: 'target' });
    }
  // « Tirer dans le tas » : cibles ÉLIGIBLES touchables au hasard.
  if (view.crowdIds)
    for (const c of battle.combatants) {
      if (!c.pos || !view.crowdIds.has(c.id)) continue;
      const cz = c.pos.z ?? 0;
      out.push({ key: `crowd-${c.id}`, cell: { x: c.pos.x, y: c.pos.y, z: cz }, h: hAt(c.pos.x, c.pos.y, cz), kind: 'ring', tone: 'crowd' });
    }
  // Cibles cliquables du MODE de ciblage courant : soin (anneau ami) / flux différés (anneau hostile,
  // déjà cochés en vert).
  if (view.candidates)
    for (const id of view.candidates.ids) {
      const t = battle.combatants.find((c) => c.id === id);
      if (!t?.pos) continue;
      const tz = t.pos.z ?? 0;
      const tone = view.candidates.friendly || view.candidates.checkedIds?.has(id) ? 'ally' : 'target';
      out.push({ key: `cand-${id}`, cell: { x: t.pos.x, y: t.pos.y, z: tz }, h: hAt(t.pos.x, t.pos.y, tz), kind: 'ring', tone });
    }
  // Bandes de portée (Bout Portant→Extrême) du tireur SURVOLÉ, au sol autour de sa position — distance
  // de Chebyshev en cases (même métrique que `combatDistance`, 1x1). Rayon = Portée×3 (hors de portée),
  // BORNÉ à la carte : le semis ne peint jamais hors des `scene.dimensions` (plafond = w×h cases).
  if (view.rangeBandSource) {
    const { pos, rangeM } = view.rangeBandSource;
    const mpt = sceneMetresPerTile(scene);
    const maxTiles = Math.ceil((rangeM * 3) / mpt); // 1 case = mpt m (défaut 2, LDB 15 l.12)
    const x0 = Math.max(0, pos.x - maxTiles), x1 = Math.min(sw - 1, pos.x + maxTiles);
    const y0 = Math.max(0, pos.y - maxTiles), y1 = Math.min(sh - 1, pos.y + maxTiles);
    const z = pos.z ?? 0;
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++) {
        const distanceTiles = chebyshev({ x, y }, pos);
        const tone = rangeBandTone(distanceTiles, rangeM, mpt);
        if (!tone) continue;
        out.push({ key: `rb-${x}-${y}`, cell: { x, y, z }, h: hAt(x, y, z), kind: 'rangeBand', tone });
      }
  }
  // INTENTION ARMÉE (spec HUD zone 4) : la portée du geste CHOISI depuis l'interface, peinte PAR-DESSUS
  // Marche et Course — c'est la réponse à « il est difficile de connaître la distance » (verbatim user
  // 2026-08-16). Émise en DERNIER : à case égale, elle passe au-dessus (rang du backend).
  for (const k of view.intentReach.keys()) {
    const [x, y, z] = parse(k);
    out.push({ key: `i${k}`, cell: { x, y, z }, h: hAt(x, y, z), kind: 'intent' });
  }
  return out;
}
