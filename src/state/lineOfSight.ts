/**
 * Ligne de Vue & Couvert (LDB 14 l.72/81/86 — les trois étalons de couvert ; l.75 — le tir dissimulé).
 * Lit la Scène (terrain, bâtiments, décors, occupants) — vit en `state` car l'engine pur ne dépend
 * jamais de `Scene`. Le barème et la fusion des classes vivent au moteur (`engine/cover.ts`) ; leur
 * `coverModifier` numérique est injecté dans `attackModifiers` via `env: ModLine[]` (cf. combatFlow).
 * La table de couvert n'est pas exhaustive (LDB 14 l.48 : « servez-vous de ces exemples comme guide »)
 * — la classification des décors/créatures est une extrapolation des étalons ; celle des STRUCTURES
 * d'arête est authored et sourcée (`couvertPenalty`, `AA 10 l.23`).
 */
import { Scene, tileAt, areteOcculteEntre, heightAt, sceneMetresPerTile, edgeOf, structureAt, structureIsDown } from './scene';
import { terrainOpaque } from './terrain';
import { findPropById, findStructureById } from '../data';
import { decorEnCase } from './decorIndex';
import { Pt } from './path';
import type { Combatant, CoverClass } from '../engine/types';
import { couvertDepuisDifficulte, couvertLePlusProtecteur, cranDeCouvertEnMoins } from '../engine/cover';
import { chebyshev } from '../engine/grid';

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

/** Un mur d'arête (`Scene.walls`) est-il franchi par la ligne `from`→`to` ? Bloque la vue
 *  (« pas à travers les murs »). Le test PAR ARÊTE est injectable (`edgeBlocks`) : le défaut interroge
 *  l'OPACITÉ de l'arête (`areteOcculte` sur l'index d'arêtes `state/wallIndex`, O(1) par pas) — jamais
 *  sa franchissabilité : une Ligne de Vue n'a pas à savoir si l'on PASSE, et une herse à barreaux se
 *  regarde à travers sans s'ouvrir. La vision injecte un prédicat dont le verdict est déjà CUIT (Set
 *  d'arêtes de l'`Occ`, même verdict). Les diagonales ne croisent pas d'arête cardinale. */
export function wallOnSight(scene: Scene, from: Pt, to: Pt, z = 0, edgeBlocks?: (ax: number, ay: number, bx: number, by: number) => boolean): boolean {
  if (!scene.walls?.length) return false;
  const blk = edgeBlocks ?? ((ax, ay, bx, by) => areteOcculteEntre(scene, ax, ay, bx, by, z));
  // Supercover de `from` à `to`, extrémités incluses (ce que `tilesBetween`, strictement entre, ne
  // donne pas), parcouru EN PLACE : ce chemin est le plus chaud du brouillard — un rayon par case
  // vue, une case par pas — et n'a besoin d'aucun tableau ni point intermédiaire matérialisé.
  const steps = chebyshev(to, from);
  let ax = from.x, ay = from.y;
  for (let i = 1; i <= steps; i++) {
    const bx = Math.round(from.x + ((to.x - from.x) * i) / steps);
    const by = Math.round(from.y + ((to.y - from.y) * i) / steps);
    const px = ax, py = ay;
    ax = bx; ay = by;
    if (px !== bx && py !== by) {
      // Pas DIAGONAL : le rayon franchit le coin partagé. Bloqué si les DEUX contournements
      // orthogonaux du coin (via (bx,py) et via (px,by)) sont murés — un mur droit bloque, mais
      // on peut « jeter un œil » au-delà de l'EXTRÉMITÉ d'un mur (un seul côté muré).
      const blocked1 = blk(px, py, bx, py) || blk(bx, py, bx, by);
      const blocked2 = blk(px, py, px, by) || blk(px, by, bx, by);
      if (blocked1 && blocked2) return true;
    } else if (blk(px, py, bx, by)) {
      return true;
    }
  }
  return false;
}

/**
 * Cases d'un nuage de fumée (Souffle (Fumée)) : disque de Chebyshev `radius` autour de `center`
 * (la zone soufflée) ∪ le trajet `from`→`center` (le souffle traverse). PUR. La case source (`from`)
 * n'est PAS enfumée (la créature souffle DEPUIS sa case vers la cible).
 */
export function smokeZone(from: Pt, center: Pt, radius: number): Pt[] {
  // #805 : les cases de zone portent désormais l'étage (`z` du souffleur/centre) — la fumée d'un étage
  // ne masque plus un tir sur un autre (filtrée par `lineOfSightCover`, cf. `smoky`/`shotZ` ci-dessous).
  // Convention `z=0` omis (même esprit que `path.ts` `pt`) : un souffle au sol reste byte-identique à
  // l'ancien `{x,y}`.
  const z = center.z ?? from.z ?? 0;
  const pt = (x: number, y: number): Pt => (z ? { x, y, z } : { x, y });
  const seen = new Map<string, Pt>();
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++) {
      const t = pt(center.x + dx, center.y + dy);
      seen.set(`${t.x},${t.y}`, t);
    }
  for (const t of tilesBetween(from, center)) seen.set(`${t.x},${t.y}`, pt(t.x, t.y));
  seen.delete(`${from.x},${from.y}`); // immunisée à son propre Souffle : la créature ne s'aveugle pas (même si elle est dans le disque)
  return [...seen.values()];
}

/** Une CASE bloque-t-elle la vue ? (terrain opaque `mur/porte`, décor opaque `statue`). Prédicat UNIQUE
 *  d'opacité de tuile — utilisé par le couvert (`lineOfSightCover`) ET la vision (échantillonnage
 *  anti-fuite). N'inclut PAS les murs d'arête (cf. `wallBetween`) : une cloison fine de bâtiment est un
 *  `WallSeg`, pas une tuile opaque. */
export function tileBlocksSight(scene: Scene, x: number, y: number): boolean {
  if (terrainOpaque(tileAt(scene, x, y))) return true;
  const dc = decorEnCase(scene, x, y);
  return !!dc && !!findPropById(dc.ref)?.opaque;
}

/**
 * Arêtes de la case CIBLE dont le côté REGARDE le tireur — une en approche cardinale, deux en
 * diagonale. GRANDEUR MAISON, au même titre que le seuil d'angle mort plus bas et `STEP_MAX_M`
 * (`relief.ts`) : le canon décrit la POSTURE (`AA 10 l.23`, on « s'en sert activement comme d'un
 * couvert ») et jamais la géométrie de grille qui dit QUELLE arête abrite. Formulation retenue — la
 * plus simple qui rende cette posture : on se plaque contre l'arête de SA PROPRE case du côté d'où
 * vient le tir. Elle n'exige aucune notion de hauteur (le dépôt n'en a aucune côté règles), ne dépend
 * pas du trajet du rayon (donc ni de son arrondi, ni de l'ordre des pas) et reste locale à la cible —
 * ce que le canon décrit : un couvert dont la cible SE SERT, pas un obstacle rencontré. Les arêtes
 * DIAGONALES (`\`,`/`) n'en sont jamais : `edgeOf` ne connaît que le cardinal, comme `wallBetween`.
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
 * Couvert que les STRUCTURES d'arête abritant la cible offrent à celle-ci (`AA 10 l.23` : la Pénalité
 * de Couvert d'une Structure EST la Difficulté par défaut d'un assaillant qui tire sur qui s'y abrite ;
 * barème `couvertDepuisDifficulte`). Le couvert est une propriété de la STRUCTURE, pas du trait de mur :
 * une arête sans `structure` n'en donne aucun, et les Structures dont la colonne est N/A (`Herse`
 * `AA 10 l.42`, `Solide porte en bois` l.50) comme celles dont le profil n'a pas cette colonne (les 5
 * entrées ADE II, `ADE II 8 l.282-288`) n'en donnent pas davantage — aucune valeur n'est supposée.
 * Une arête ABATTUE n'abrite plus rien (`AA 10 l.127`, Effondrement).
 *
 * MÊME ÉTAGE SEULEMENT. `AA 10 l.23` décrit un défenseur posté SUR une Structure (« les créneaux du
 * rempart d'un château »), et aucune donnée du dépôt ne dit qu'une Structure se défend depuis le haut :
 * `structures.json` n'a pas de champ pour ça et `fortified` est documenté RENDU
 * (`schemas/defs/structures.ts`). Étendre le couvert d'arête au tir inter-étages sans ce fait revient à
 * accorder la protection d'un rempart aux planchers d'une auberge — d'autant que la LdV inter-étages
 * ignore déjà les arêtes (plus bas) : la cible serait couverte à travers des murs qu'on ne voit pas.
 * Le couvert du défenseur perché attend donc la donnée qui le porte, il ne s'extrapole pas ici.
 *
 * FENÊTRE : un cran de moins (`cranDeCouvertEnMoins`). Référence `AA 10 l.122`, application à une
 * croisée MAISON ; arbitrage #1712 (2026-09-08) : la croisée laisse passer la vue et le tir
 * (`areteOcculte`), le couvert se dégrade ici.
 */
export function couvertDArete(scene: Scene, from: Pt, to: Pt): CoverClass {
  const z = to.z ?? 0;
  if ((from.z ?? 0) !== z) return 'none';
  let cover: CoverClass = 'none';
  for (const e of aretesAbritantes(from, to)) {
    const seg = structureAt(scene, e.x, e.y, e.side, z);
    if (!seg?.structure || structureIsDown(scene, seg)) continue;
    const pen = findStructureById(seg.structure)?.couvertPenalty;
    if (!pen) continue;
    const brut = couvertDepuisDifficulte(pen);
    cover = worst(cover, seg.window ? cranDeCouvertEnMoins(brut) : brut);
  }
  return cover;
}

/**
 * Couvert + Ligne de Vue du tireur `from` vers la cible `to`. `occupants` = cases occupées par
 * d'autres combattants (couvert imparfait, extrapolation `14` l.75). `smoke` = cases enfumées
 * (Souffle (Fumée)) qui BLOQUENT entièrement la vue (RAW « bloquant les Lignes de vue ») —
 * y compris si le tireur ou la cible est DANS la fumée. `blocked:true` = pas de tir (la Ligne de Vue
 * est requise pour tirer, `13` l.114) ; un bloqueur de vue ADJACENT à la cible = couverture totale
 * −30 (« derrière un mur de pierre », `14` l.86) sans empêcher le tir.
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
  // Seuil DESIGN (comme `STEP_MAX_M`, relief.ts — aucune règle RAW ne chiffre cette géométrie) : bloqué
  // quand l'écart de hauteur (m, `heightAt`) dépasse la distance horizontale parcourue (m) — angle de
  // dépression > 45°. Au-delà de ce seuil, la vue par-dessus le parapet redevient dégagée (tests cross-z).
  if (!sameFloor) {
    const dzM = Math.abs(heightAt(scene, from.x, from.y, from.z ?? 0) - heightAt(scene, to.x, to.y, to.z ?? 0));
    const horizM = chebyshev(from, to) * sceneMetresPerTile(scene);
    if (dzM > horizM) return { blocked: true, cover: 'totale' };
  }
  // Structures d'arête qui ABRITENT la cible (`AA 10 l.23`) : le contournement d'EXTRÉMITÉ, seule
  // situation où le tir atteint une cible qu'une arête intacte abrite — `wallOnSight` vient de laisser
  // passer le rayon par le côté ouvert du coin. `couvertDArete` se borne au MÊME étage (son JSDoc dit
  // pourquoi) : le tir inter-étages n'en reçoit aucun.
  let cover: CoverClass = couvertDArete(scene, from, to);
  for (const t of tilesBetween(from, to)) {
    const terr = tileAt(scene, t.x, t.y);
    const decor = decorEnCase(scene, t.x, t.y);
    if (tileBlocksSight(scene, t.x, t.y)) {
      if (adjacent(t, to)) {
        cover = worst(cover, 'totale'); // cible collée au couvert → −30, tir possible
        continue;
      }
      return { blocked: true, cover: 'totale' }; // bloqueur à distance → pas de Ligne de Vue
    }
    if (TERRAIN_COVER[terr]) cover = worst(cover, TERRAIN_COVER[terr]);
    const dcov = decor && decorCover(decor.ref);
    if (dcov) cover = worst(cover, dcov);
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
