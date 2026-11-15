/**
 * Ligne de Vue & Couvert (LDB 14 l.72/81/86 — les trois étalons de couvert ; l.75 — le tir dissimulé).
 * Lit la Scène (terrain, bâtiments, décors, occupants) — vit au noyau car l'engine pur ne dépend
 * jamais de `Scene`. Le barème et la fusion des classes vivent au moteur (`engine/cover.ts`) ; leur
 * `coverModifier` numérique est injecté dans `attackModifiers` via `env: ModLine[]` (cf. combatFlow).
 * La table de couvert n'est pas exhaustive (LDB 14 l.48 : « servez-vous de ces exemples comme guide »)
 * — la classification des décors/créatures est une extrapolation des étalons ; celle des STRUCTURES
 * d'arête est authored et sourcée (`couvertPenalty`, `AA 10 l.23`).
 */
import { Scene, tileAt, wallOnSight, heightAt, sceneMetresPerTile, edgeOf, structureIsDown, croiseeOuverte } from './scene';
import { aretesA } from './wallIndex';
import { terrainOpaque } from './terrain';
import { findPropById, findStructureById } from '../../data';
import { decorsEnCase } from './decorIndex';
import { pairesEnRegard, type Corps } from './footprint';
import { pointDeCase, type Pt } from './path';
import type { Combatant, CoverClass } from '../../engine/types';
import { couvertDepuisDifficulte, couvertLePlusProtecteur, cranDeCouvertEnMoins } from '../../engine/cover';
import { chebyshev } from '../../engine/grid';

const worst = couvertLePlusProtecteur;

/** Couvert d'un terrain partiel. */
const TERRAIN_COVER: Record<string, CoverClass> = { bois: 'imparfaite' };
/** Couvert/opacité d'un décor : lus sur le dataset `props.json` (`cover`/`opaque`), exemplaires canon
 *  LDB 14 l.72/81/86 + extrapolation l.75. Édité au Codex. */
const decorCover = (ref: string | undefined): CoverClass | undefined => (ref ? findPropById(ref)?.cover : undefined);

/** Cases STRICTEMENT entre `a` et `b` (supercover simple sur grille carrée). */
export function tilesBetween(a: Pt, b: Pt): Pt[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const steps = chebyshev(a, b);
  const out: Pt[] = [];
  for (let i = 1; i < steps; i++) {
    out.push({ x: Math.round(a.x + (dx * i) / steps), y: Math.round(a.y + (dy * i) / steps) });
  }
  return out;
}

const adjacent = (p: Pt, q: Pt): boolean => chebyshev(p, q) <= 1;

/**
 * Cases d'un nuage de fumée (Souffle (Fumée)) : disque de Chebyshev `radius` autour de `center`
 * (la zone soufflée) ∪ le trajet `from`→`center` (le souffle traverse). PUR. La case source (`from`)
 * n'est PAS enfumée (la créature souffle DEPUIS sa case vers la cible).
 */
export function smokeZone(from: Pt, center: Pt, radius: number): Pt[] {
  // #805 : les cases de zone portent l'étage (`z` du souffleur/centre), que `lineOfSightCover` filtre
  // (`smoky`/`shotZ` ci-dessous). `pointDeCase` omet `z` au sol.
  const z = center.z ?? from.z ?? 0;
  const seen = new Map<string, Pt>();
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++) {
      const t = pointDeCase(center.x + dx, center.y + dy, z);
      seen.set(`${t.x},${t.y}`, t);
    }
  for (const t of tilesBetween(from, center)) seen.set(`${t.x},${t.y}`, pointDeCase(t.x, t.y, z));
  seen.delete(`${from.x},${from.y}`); // immunisée à son propre Souffle : la créature ne s'aveugle pas (même si elle est dans le disque)
  return [...seen.values()];
}

/** Une CASE bloque-t-elle la vue ? (terrain opaque `mur/porte`, décor opaque `statue`). Prédicat UNIQUE
 *  d'opacité de tuile — utilisé par le couvert (`lineOfSightCover`) ET la vision (échantillonnage
 *  anti-fuite). N'inclut PAS les murs d'arête (cf. `wallBetween`) : une cloison fine de bâtiment est un
 *  `WallSeg`, pas une tuile opaque. */
export function tileBlocksSight(scene: Scene, x: number, y: number): boolean {
  if (terrainOpaque(tileAt(scene, x, y))) return true;
  return decorsEnCase(scene, x, y).some((dc) => !!findPropById(dc.decor?.id)?.opaque);
}

/**
 * Arêtes de la case CIBLE dont le côté REGARDE l'attaquant, au tir comme au corps à corps — une en
 * approche cardinale, deux en diagonale. GRANDEUR MAISON (`AA 10 l.23`), au même titre que le seuil
 * d'angle mort plus bas et `STEP_MAX_M` (`relief.ts`) : l'arête de SA PROPRE case du côté d'où vient
 * le coup, locale à la cible, indépendante du trajet du rayon. Les arêtes DIAGONALES (`\`,`/`) n'en
 * sont jamais : `edgeOf` ne connaît que le cardinal, comme `wallBetween`.
 */
function aretesAbritantes(from: Pt, to: Pt): { x: number; y: number; side: 'N' | 'E' }[] {
  const out: { x: number; y: number; side: 'N' | 'E' }[] = [];
  if (from.x !== to.x) {
    const e = edgeOf(to.x, to.y, from.x < to.x ? to.x - 1 : to.x + 1, to.y);
    if (e) out.push(e);
  }
  if (from.y !== to.y) {
    const e = edgeOf(to.x, to.y, to.x, from.y < to.y ? to.y - 1 : to.y + 1);
    if (e) out.push(e);
  }
  return out;
}

/**
 * Couvert que les STRUCTURES d'arête abritant la cible offrent à celle-ci : leur `couvertPenalty`
 * (`AA 10 l.28-51`, barème `couvertDepuisDifficulte`). Une arête sans `structure`, ou dont la Structure
 * n'a pas de `couvertPenalty` (`AA 10 l.42`, `AA 10 l.50`, `ADE II 8 l.282-288`), n'en donne aucun ;
 * une arête ABATTUE non plus (`AA 10 l.127`).
 *
 * MÊME ÉTAGE SEULEMENT (`AA 10 l.23`) : `structures.json` ne porte aucun champ du défenseur perché, et la
 * LdV inter-étages ignore les arêtes (`lineOfSightCover`).
 *
 * FENÊTRE : `croisee` dit ce que vaut une croisée ouverte (`croiseeOuverte`), du couvert de son mur
 * (`none` sans Structure). Au tir, un cran de moins (`cranDeCouvertEnMoins`, `AA 10 l.122`, arbitrage
 * #1712 du 2026-09-08) ; en mêlée, la règle `combat-croisee-melee-difficulte` (`LDB 14 l.86`, arbitrage
 * #4105 du 2026-11-13).
 *
 * CORPS : les arêtes abritantes de chaque paire de cases en regard (`pairesEnRegard`), le plus protecteur
 * l'emporte, comme entre les deux arêtes d'une diagonale ; arbitrage #4105 du 2026-11-13.
 */
export function couvertDArete(scene: Scene, de: Corps, vers: Corps, croisee: (mur: CoverClass) => CoverClass): CoverClass {
  const z = vers.pos.z ?? 0;
  if ((de.pos.z ?? 0) !== z) return 'none';
  let cover: CoverClass = 'none';
  for (const [a, b] of pairesEnRegard(de, vers)) for (const e of aretesAbritantes(a, b)) for (const seg of aretesA(scene, e.x, e.y, e.side, z)) {
    if (seg.structure && structureIsDown(scene, seg)) continue;
    const pen = seg.structure ? findStructureById(seg.structure)?.couvertPenalty : undefined;
    const mur = pen ? couvertDepuisDifficulte(pen) : 'none';
    cover = worst(cover, croiseeOuverte(seg) ? croisee(mur) : mur);
  }
  return cover;
}

/** Couvert de la cible d'un tir : celui du `trajet` (`lineOfSightCover` vers la case visée) et celui des
 *  arêtes qui l'abritent entre les deux corps (`couvertDArete`, croisée à un cran de moins). `AA 10 l.23`. */
export function couvertDuTir(scene: Scene, trajet: CoverClass, tireur: Corps, cible: Corps): CoverClass {
  return worst(trajet, couvertDArete(scene, tireur, cible, cranDeCouvertEnMoins));
}

/**
 * Couvert + Ligne de Vue du tireur `from` vers la cible `to`. `occupants` = cases occupées par
 * d'autres combattants (couvert imparfait, extrapolation `14` l.75). `smoke` = cases enfumées
 * (Souffle (Fumée)) qui BLOQUENT entièrement la vue (RAW « bloquant les Lignes de vue ») —
 * y compris si le tireur ou la cible est DANS la fumée. `blocked:true` = pas de tir (la Ligne de Vue
 * est requise pour tirer, `13` l.114) ; un bloqueur de vue ADJACENT à la cible = couverture totale
 * −30 (« derrière un mur de pierre », `14` l.86) sans empêcher le tir. Le couvert des arêtes qui
 * abritent la cible se mesure entre CORPS (`couvertDuTir`), jamais ici.
 */
export function lineOfSightCover(
  scene: Scene,
  from: Pt,
  to: Pt,
  occupants: Pt[],
  smoke: Pt[] = [],
): { blocked: boolean; cover: CoverClass } {
  // Fumée : bloque la vue sur tout le segment, extrémités INCLUSES (être DANS la fumée aveugle aussi).
  // Z-AWARE (#805) : les murs/dead-ground sont déjà filtrés par étage (sameFloor/heightAt) — la fumée
  // suit le même patron. Les tiles de zone portent leur étage depuis `smokeZone` (`s.z`) ; une tile
  // héritée sans `z` (appelant tiers) retombe sur le SOL (`0`) — une fumée au sol n'aveugle QUE le sol.
  if (smoke.length) {
    const shotZ = from.z ?? 0;
    const smoky = (p: Pt) => smoke.some((s) => s.x === p.x && s.y === p.y && (s.z ?? 0) === shotZ);
    if (smoky(from) || smoky(to) || tilesBetween(from, to).some(smoky)) return { blocked: true, cover: 'totale' };
  }
  // Murs d'arête (Scene.walls) : barrière pleine entre deux cases → vue entièrement bloquée.
  // MÊME étage seulement. Cross-niveau (`from.z` ≠ `to.z`) : un défenseur sur le rempart (z=1) voit/tire
  // l'assaillant au sol (z=0) PAR-DESSUS les arêtes fines (créneaux/parapet) → on ignore les murs
  // d'arête ; seules les TUILES opaques (bâtiment/terrain, boucle ci-dessous) coupent la LdV.
  const sameFloor = (from.z ?? 0) === (to.z ?? 0);
  if (sameFloor && wallOnSight(scene, from, to, from.z ?? 0)) return { blocked: true, cover: 'totale' };
  // Angle mort VERTICAL (dead ground) : le parapet masque la vue trop plongeante sur ce qui est COLLÉ
  // au pied du perchoir — symétrique (la cible en contrebas ne voit pas non plus le tireur en hauteur).
  // Seuil de géométrie de la grille, comme `STEP_MAX_M` (`relief.ts`, #151) : bloqué
  // quand l'écart de hauteur (m, `heightAt`) dépasse la distance horizontale parcourue (m) — angle de
  // dépression > 45°. Au-delà de ce seuil, la vue par-dessus le parapet redevient dégagée (tests cross-z).
  if (!sameFloor) {
    const dzM = Math.abs(heightAt(scene, from.x, from.y, from.z ?? 0) - heightAt(scene, to.x, to.y, to.z ?? 0));
    const horizM = chebyshev(from, to) * sceneMetresPerTile(scene);
    if (dzM > horizM) return { blocked: true, cover: 'totale' };
  }
  let cover: CoverClass = 'none';
  for (const t of tilesBetween(from, to)) {
    const terr = tileAt(scene, t.x, t.y);
    if (tileBlocksSight(scene, t.x, t.y)) {
      if (adjacent(t, to)) {
        cover = worst(cover, 'totale'); // cible collée au couvert → −30, tir possible
        continue;
      }
      return { blocked: true, cover: 'totale' }; // bloqueur à distance → pas de Ligne de Vue
    }
    if (TERRAIN_COVER[terr]) cover = worst(cover, TERRAIN_COVER[terr]);
    for (const decor of decorsEnCase(scene, t.x, t.y)) {
      const dcov = decorCover(decor.decor?.id);
      if (dcov) cover = worst(cover, dcov);
    }
    if (occupants.some((o) => o.x === t.x && o.y === t.y)) cover = worst(cover, 'imparfaite');
  }
  return { blocked: false, cover };
}

/** Ligne de Vue DÉGAGÉE de `from` vers `to` (fumées comprises) ? Wrapper bas-niveau UNIQUE du
 *  `!lineOfSightCover(...).blocked` — la directionnalité EST le couple `from→to` (le couvert d'adjacence
 *  rend `blocked` non symétrique). Toutes les itérations de LdV (visibilité, `tileSeenByFoe`, `hasFoeInLoS`)
 *  s'y branchent au lieu de recopier le `!...blocked`. */
export const losClear = (scene: Scene, from: Pt, to: Pt, smoke: Pt[] = []): boolean =>
  !lineOfSightCover(scene, from, to, [], smoke).blocked;

/** La case `pos` est-elle DANS la Ligne de Vue d'au moins un `foe` (direction adversaire→case) ?
 *  Primitive géométrique du Brisé (LDB 16 l.52, « hors de vue de l'ennemi » = aucun adversaire ne te voit).
 *  `foes` = la liste d'adversaires PERTINENTS (l'appelant filtre camp/vivacité) ; on ignore les sans-position. */
export function tileSeenByFoe(scene: Scene, foes: Combatant[], pos: Pt, smoke: Pt[] = []): boolean {
  return foes.some((e) => e.pos && losClear(scene, e.pos, pos, smoke));
}

/**
 * MÉMO de Ligne de Vue d'UNE décision (patron `sceneMemo` mais à durée de vie EXPLICITE, pas par
 * identité de donnée). Un tour d'IA pose la MÊME question `from → to` des dizaines de milliers de
 * fois : `positionValue` interroge chaque héros depuis chaque case atteignable, et `aiApproachPlan`
 * REJOUE l'énumération entière à deux budgets de mouvement supérieurs (Charge puis Course). Le mémo
 * rend la case déjà évaluée sans re-tracer le rayon.
 *
 * La SCÈNE et les FUMÉES sont capturées à la CRÉATION, et `occupants` est toujours vide : le mémo ne
 * peut donc pas répondre pour une autre scène, d'autres fumées ou d'autres occupants — c'est ce qui
 * borne sa validité, pas une convention d'appel. Sa DURÉE de vie est la décision : les positions, les
 * `scene.flags` (porte ouverte, structure abattue) et le relief n'y bougent pas. Il ne vit JAMAIS au
 * niveau du module : aucune fuite entre deux tours, aucune dépendance à l'ordre des tests.
 */
export interface LosMemo {
  /** `lineOfSightCover(scène, from, to, [], fumées)` mémoïsé. */
  cover(from: Pt, to: Pt): { blocked: boolean; cover: CoverClass };
  /** `losClear(scène, from, to, fumées)` mémoïsé (même entrée de mémo que `cover`). */
  clear(from: Pt, to: Pt): boolean;
}

export function makeLosMemo(scene: Scene, smoke: Pt[] = []): LosMemo {
  const cache = new Map<string, { blocked: boolean; cover: CoverClass }>();
  const cover = (from: Pt, to: Pt): { blocked: boolean; cover: CoverClass } => {
    const k = `${from.x},${from.y},${from.z ?? 0}|${to.x},${to.y},${to.z ?? 0}`;
    let v = cache.get(k);
    if (v === undefined) { v = lineOfSightCover(scene, from, to, [], smoke); cache.set(k, v); }
    return v;
  };
  return { cover, clear: (from, to) => !cover(from, to).blocked };
}
