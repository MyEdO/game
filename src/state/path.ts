/** Déplacement sur grille : BFS pour cases atteignables et chemins. */
import { Scene, isWalkable, edgeOf, surfaceLink, climbEdgeBetween, wallIsOpen } from './scene';
import { hasTrait, hasAutoClimb, hasClimbFullSpeed } from '../engine/traits/dispatch';
import type { Combatant } from '../engine/types';
import { memoByRef } from './sceneMemo';
import { chebyshev } from '../engine/grid';

export interface Pt {
  x: number;
  y: number;
  /** Couche d'empilement (cf. `Scene.layers`). Absent = base (z=0). La traversée verticale s'auto-dérive
   *  du delta de hauteur entre cases voisines (`surfaceLink`) — plus aucun escalier explicite. */
  z?: number;
}

const pz = (p: Pt) => p.z ?? 0;
/** Construit une position en omettant `z` quand il vaut 0 → un résultat au sol est byte-identique à
 *  l'ancien `{x,y}` (non-régression ; même esprit que la clé z=0 sans suffixe). */
const pt = (x: number, y: number, z = 0): Pt => (z ? { x, y, z } : { x, y });
/** Clé de case. CONVENTION : z=0 omet le suffixe (« x,y ») → byte-identique aux ensembles `blocked`
 *  2D que bâtissent les appelants (occupied(), héros au sol) ; z>0 → « x,y,z » distinct. Une seule
 *  fonction de clé partout (pas de double schéma). */
const key = (x: number, y: number, z = 0) => (z ? `${x},${y},${z}` : `${x},${y}`);
/** SOURCE UNIQUE de la convention de clé de case (interne = `key`) — réexportée pour les bâtisseurs
 *  d'ensembles `blocked` côté combat (`occupied`/`cannotStopOn`), qui doivent suivre EXACTEMENT ce
 *  schéma (z=0 → « x,y », z>0 → « x,y,z ») pour rester comparables au `footFits` du BFS. */
export { key as tileKey };
/** 4-cardinaux — SAUTS en ligne droite (Saut LDB 15 : on franchit un gouffre tout droit). */
const CARDINALS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
/** 8-voisins — DÉPLACEMENT à pied. La diagonale est RAW-légale (LDB 15 « Déplacement » l.10-16 : la grille
 *  optionnelle « compte les cases », aucune règle de diagonale) et coûte 1 pas (Chebyshev), cohérent avec
 *  `chebyshev()` (portée de combat). Garde anti coupe-de-coin dans `neighborsOf`. SOURCE UNIQUE de
 *  connectivité : explo + clic + POV + combat + IA (aucune divergence). */
const NEIGHBORS = [
  ...CARDINALS,
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/** Arêtes BARRIÈRES prébâties pour le BFS : clé « x,y,side,z » (même canonique que `wallBetween`).
 *  Réutilise `wallIsOpen` (SOURCE UNIQUE porte OU structure, `scene.ts`) — une porte reste une porte
 *  quel que soit son matériau : `door: true` suit son état RUNTIME (`doorIsOpen`) même si elle porte
 *  une structure intacte (la structure n'AJOUTE que la destructibilité, elle ne retire jamais la
 *  nature de porte). Une arête SANS `door` portant une structure reste barrière tant qu'elle n'est
 *  pas ABATTUE (`structureIsDown` — mur/rempart destructible). */
function wallEdgesUncached(scene: Scene): Set<string> {
  const s = new Set<string>();
  for (const w of scene.walls ?? []) {
    const open = wallIsOpen(scene, w);
    if (!open) s.add(`${w.x},${w.y},${w.side},${w.z ?? 0}`);
  }
  return s;
}
/** Mémoïsé par IDENTITÉ de `scene` (`memoByRef`) — keyé sur `scene`, PAS `scene.walls` : dépend aussi
 *  de `scene.flags` (`wallIsOpen`/`structureIsDown`), donc ouvrir une porte (nouvelle réf `scene`,
 *  jamais de mutation en place) doit invalider le cache — une clé sur `scene.walls` seul le raterait. */
const wallEdges = memoByRef(wallEdgesUncached);
/** Un mur sépare-t-il (ax,ay) de (bx,by) au même étage ? (cardinal seulement.) */
function walled(edges: Set<string>, ax: number, ay: number, bx: number, by: number, z: number): boolean {
  if (!edges.size) return false;
  const e = edgeOf(ax, ay, bx, by);
  return e ? edges.has(`${e.x},${e.y},${e.side},${z}`) : false;
}

/** Capacités de TRAVERSÉE du mover consommées par le BFS, au-delà du pas normal (petit objet dérivé
 *  UNE fois par l'appelant — jamais le `Combatant` entier). Grimpant (LDB 85 l.160-162) aujourd'hui
 *  (`climb`/`climbFullSpeed`) ; conçu pour accueillir plus tard Fouissement (autre flag, un autre
 *  prédicat géométrique que `climbEdgeBetween`) — SANS l'implémenter ici. */
export interface TraverseCapability {
  /** Une arête `WallSeg.climb` devient traversable (mur ET falaise `surfaceLink` bypassés). */
  climb?: boolean;
  /** Coût de la traversée = pas NORMAL (1 case), pas la ½ vitesse du Talent Grimpeur joueur (LDB 15
   *  l.53). Sans ce flag, la traversée n'est PAS activée ici (coût variable non représentable dans ce
   *  BFS à pas uniforme — aucune capacité actuelle ne combine `climb` sans `climbFullSpeed`). */
  climbFullSpeed?: boolean;
}

/** Voisins MARCHABLES d'une case : pour chacune des 8 cases adjacentes, la/les couche(s) où elle forme
 *  une SURFACE réelle reliée à pied — `surfaceLink` flat/ramp (|Δhauteur| ≤ STEP_MAX), une arête murée
 *  à la couche la PLUS HAUTE du pas coupant le passage. C'est l'auto-connexion du relief : un même
 *  pas peut changer de couche là où une rampe rejoint un tablier (hauteurs coïncidentes) — plus aucun
 *  escalier explicite. Une falaise (Δhauteur > STEP_MAX) n'est PAS un voisin à pied (chute/Escalade),
 *  SAUF une arête `WallSeg.climb` que `traverse` (Grimpant) autorise à franchir au pas normal. */
function neighborsOf(scene: Scene, p: Pt, edges: Set<string>, swim?: ReadonlySet<string>, traverse?: TraverseCapability): Pt[] {
  const z = pz(p);
  const out: Pt[] = [];
  for (const [dx, dy] of NEIGHBORS) {
    const nx = p.x + dx, ny = p.y + dy;
    for (const layer of scene.layers) {
      const nz = layer.z;
      if (!isWalkable(scene, nx, ny, nz, swim)) continue; // pas de surface réelle sur cette couche ici
      // Les DEUX COUCHES qu'engage ce pas — départ `z` et arrivée `nz` — et elles seules : cet ensemble,
      // où `flankOn` cherche le flanc d'une diagonale, est le même quel que soit le SENS de parcours
      // (l'aller {z,nz} et le retour {nz,z} sont le même ensemble) ⇒ flanc symétrique par construction.
      const layersOfStep: number[] = nz === z ? [z] : [z, nz];
      /** Un mur n'arrête le pas qu'à la HAUTEUR où on le franchit : l'arête qui borne la couche la PLUS
       *  HAUTE du pas. Celle de la couche du dessous passe SOUS les pieds — une rampe qui atteint la cote
       *  de l'étage enjambe la cloison du rez qu'elle survole, comme une passerelle enjambe un mur de
       *  cour. Le `max` est symétrique : monter et descendre voient la même arête. */
      const barred = (ax: number, ay: number, bx: number, by: number) =>
        walled(edges, ax, ay, bx, by, Math.max(z, nz));
      // Pas DIAGONAL : garde anti coupe-de-coin — les DEUX chemins en L (p→A→D et p→B→D) doivent être
      // ouverts : case flanquante marchable, et les deux arêtes du L (départ→flanc, flanc→cible) non
      // barrées. Un flanc de diagonale INTER-COUCHES n'a pas d'étage propre (le sommet d'une rampe jouxte
      // des cases qui n'existent QUE sur la couche basse) : il est donc cherché sur l'UNION des deux
      // couches du pas — le flanc compte s'il forme une surface réelle sur l'une OU l'autre.
      if (dx !== 0 && dy !== 0) {
        const flankOn = (x: number, y: number) => layersOfStep.some((lz) => isWalkable(scene, x, y, lz, swim));
        const okA = flankOn(p.x + dx, p.y) && !barred(p.x, p.y, p.x + dx, p.y) && !barred(p.x + dx, p.y, nx, ny);
        const okB = flankOn(p.x, p.y + dy) && !barred(p.x, p.y, p.x, p.y + dy) && !barred(p.x, p.y + dy, nx, ny);
        if (!okA || !okB) continue; // saute cette couche seulement (pas toutes)
      }
      const wallBlocked = barred(p.x, p.y, nx, ny);
      const climbed = traverse?.climb && traverse?.climbFullSpeed
        ? climbEdgeBetween(scene, { x: p.x, y: p.y, z }, { x: nx, y: ny, z: nz })
        : undefined;
      if (climbed) { out.push(pt(nx, ny, nz)); continue; } // Grimpant : mur ET falaise bypassés, coût normal
      if (wallBlocked) continue;
      const link = surfaceLink(scene, p, { x: nx, y: ny, z: nz });
      if (link && link.grade !== 'cliff') out.push(pt(nx, ny, nz));
    }
  }
  return out;
}

/** Voisins 8-connexes MARCHABLES d'une case (toutes couches reliées à pied : surface `flat`/`ramp`,
 *  arête non murée) — wrapper PUBLIC de `neighborsOf` qui bâtit l'ensemble d'arêtes barrières. SOURCE
 *  UNIQUE de connectivité réutilisée par le pas clavier d'exploration (`exploreStepDest`) : strictement
 *  la même que celle du BFS (`pathTo`), zéro ambiguïté de z. */
export function walkNeighbors(scene: Scene, p: Pt): Pt[] {
  return neighborsOf(scene, p, wallEdges(scene));
}

/** Étiquetage des COMPOSANTES CONNEXES marchables d'une scène : chaque case marchable reçoit le numéro
 *  du bloc de cases qu'on peut parcourir à pied depuis elle (`walkNeighbors` — la SOURCE UNIQUE de
 *  connectivité ; l'arête marchable est symétrique par construction, cf. `neighborsOf`). Répond en O(1)
 *  à « existe-t-il un chemin de A à B ? » quand l'environnement de traversée est nu (aucune case
 *  bloquée, empreinte 1×1, ni saut ni nage ni escalade) : même étiquette = même composante. Ne dépend
 *  que de la SCÈNE — d'où la mémoïsation par identité (`memoByRef`, même patron que `wallEdges`) :
 *  ouvrir une porte rend une nouvelle réf de scène et refait donc l'étiquetage. */
function walkComponentsUncached(scene: Scene): Map<string, number> {
  const label = new Map<string, number>();
  const { w, h } = scene.dimensions;
  let nextId = 0;
  for (const layer of scene.layers) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = key(x, y, layer.z);
      if (label.has(k) || !isWalkable(scene, x, y, layer.z)) continue;
      const id = nextId++;
      label.set(k, id);
      const queue: Pt[] = [pt(x, y, layer.z)];
      for (let i = 0; i < queue.length; i++) {
        for (const n of walkNeighbors(scene, queue[i])) {
          const nk = key(n.x, n.y, pz(n));
          if (label.has(nk)) continue;
          label.set(nk, id);
          queue.push(n);
        }
      }
    }
  }
  return label;
}
const walkComponentsOf = memoByRef(walkComponentsUncached);

/** Numéro de composante marchable de la case (`walkComponentsUncached`), ou `null` si elle n'est pas
 *  marchable. Deux cases de même numéro sont reliées à pied, deux numéros distincts ne le sont pas. */
export function walkComponentAt(scene: Scene, x: number, y: number, z = 0): number | null {
  return walkComponentsOf(scene).get(key(x, y, z)) ?? null;
}

/** Composantes marchables ATTEINTES depuis `from` : la sienne s'il est marchable, sinon celles de ses
 *  voisins immédiats — exactement les cases d'où une exploration à pied serait partie (un départ non
 *  marchable, jeton posé sur un obstacle, n'annule pas ses voisins). SOURCE UNIQUE du verdict
 *  « joignable depuis `from` » : `walkComponentAt(p) ∈ walkComponentsFrom(from)`. */
export function walkComponentsFrom(scene: Scene, from: Pt): Set<number> {
  const z = pz(from);
  const own = walkComponentAt(scene, from.x, from.y, z);
  if (own !== null) return new Set([own]);
  const out = new Set<number>();
  for (const n of walkNeighbors(scene, pt(from.x, from.y, z))) {
    const id = walkComponentAt(scene, n.x, n.y, pz(n));
    if (id !== null) out.add(id);
  }
  return out;
}

/** Cases atteignables À PIED depuis `from`, sans borne de portée — l'ÉNUMÉRATION de `walkComponentsFrom`
 *  (là où le prédicat suffit, l'appeler lui, pas ceci : il répond en O(1) sans parcourir la carte).
 *  `from` en fait toujours partie, comme un chemin de longueur nulle, même s'il n'est pas marchable. */
export function walkReachableFrom(scene: Scene, from: Pt): Pt[] {
  const z = pz(from);
  const ids = walkComponentsFrom(scene, from);
  const out: Pt[] = [pt(from.x, from.y, z)];
  const startKey = key(from.x, from.y, z);
  for (const [k, id] of walkComponentsOf(scene)) {
    if (!ids.has(id) || k === startKey) continue;
    const [cx, cy, cz = 0] = k.split(',').map(Number);
    out.push(pt(cx, cy, cz));
  }
  return out;
}

/** Sauts (Saut, LDB 15 l.76) : atterrissages possibles en franchissant un GOUFFRE — des cases
 *  non-marchables au même étage, en ligne droite — jusqu'à `jump` cases de distance. Une case
 *  intermédiaire MARCHABLE interrompt (on s'y poserait au lieu de sauter par-dessus). Les sauts
 *  retournés sont DÉJÀ validés (atterrissage praticable et libre). `foot>1` ne saute pas ; `jump<2`
 *  = aucun saut (un pas d'1 case n'est jamais un saut). La portée libre (M/3 m) vs avec Test se
 *  décide à la couche déplacement — ici on ne fait que l'atteignabilité géométrique. */
function jumpNeighbors(scene: Scene, p: Pt, jump: number, blocked: Set<string>, foot: number, edges: Set<string>, swim?: ReadonlySet<string>): Pt[] {
  if (jump < 2 || foot > 1) return [];
  const z = pz(p);
  const out: Pt[] = [];
  for (const [dx, dy] of CARDINALS) {
    if (walled(edges, p.x, p.y, p.x + dx, p.y + dy, z)) continue; // un mur au décollage interdit le saut
    for (let d = 2; d <= jump; d++) {
      let overGap = true; // les cases 1..d-1 doivent toutes être un gouffre (non-marchables)
      for (let k = 1; k < d; k++) if (isWalkable(scene, p.x + dx * k, p.y + dy * k, z, swim)) { overGap = false; break; }
      if (!overGap) break; // une case marchable interrompt : pas de saut plus loin dans cette direction
      const lx = p.x + dx * d, ly = p.y + dy * d;
      if (footFits(scene, lx, ly, z, foot, blocked, swim)) out.push(z ? { x: lx, y: ly, z } : { x: lx, y: ly });
    }
  }
  return out;
}

/**
 * L'empreinte N×N ancrée en (x, y, z) (coin NO) tient-elle ? Toutes ses tuiles (au même étage)
 * doivent être walkable (terrain/bâtiment) ET non bloquées. Pour `foot=1`, vérifie juste la tuile.
 * Permet à une grande créature de NE PAS se faufiler dans un couloir d'1 tuile (LDB 15 l.12).
 */
function footFits(scene: Scene, x: number, y: number, z: number, foot: number, blocked: Set<string>, swim?: ReadonlySet<string>): boolean {
  if (foot <= 1) return isWalkable(scene, x, y, z, swim) && !blocked.has(key(x, y, z));
  for (let dy = 0; dy < foot; dy++)
    for (let dx = 0; dx < foot; dx++) {
      if (!isWalkable(scene, x + dx, y + dy, z, swim) || blocked.has(key(x + dx, y + dy, z))) return false;
    }
  return true;
}

/**
 * Contraintes de déplacement d'un mover sur la grille. Objet UNIQUE passé en dernier argument à
 * toutes les fonctions de portée/chemin — chacune lit le sous-ensemble pertinent, les champs inertes
 * sont ignorés. Côté combat, assemblé en UN point par `moveEnv(battle, mover)` (combatGeometry).
 *
 * - `blocked` : cases infranchissables (TRANSIT) — TOUTES les fonctions.
 * - `foot`    : côté d'empreinte N×N (défaut 1) — portée + `pathTo`.
 * - `noStop`  : « soft-block », cases TRAVERSABLES mais interdites à l'ARRÊT (on les franchit pendant
 *               le BFS, mais elles sont retirées des destinations) — portée seulement. Sert à passer à
 *               travers une créature plus petite sans finir sur sa case (LDB 85 l.373-374 vs « on ne
 *               finit jamais sur la case d'une autre créature »).
 * - `jump`    : portée de Saut LDB 15 (défaut 0) — `pathTo` seulement.
 * - `swim`    : terrains d'ÉLECTION du mover (op `offTerrainMod` — `eau` pour Aquatique/Amphibie/Créature
 *               marine) qu'il TRAVERSE bien que `walkable:false` (RAW « pleine vitesse dans l'eau ») —
 *               toutes les fonctions de mouvement PROPRE (reachable/fly/pathTo) ; absent = terrain nu.
 *               Assemblé par `moveEnv(battle, mover)` via `requiredTerrains(mover)`.
 * - `traverse`: capacités de TRAVERSÉE (`TraverseCapability` — Grimpant) — `reachable`/`pathTo` seulement.
 *               Assemblée par `moveEnv(battle, mover)` via `climbTraverseFor(mover.traits)`.
 */
export interface MoveEnv {
  blocked: Set<string>;
  foot?: number;
  noStop?: Set<string>;
  jump?: number;
  swim?: ReadonlySet<string>;
  traverse?: TraverseCapability;
}

/** `TraverseCapability` d'un mover, dérivée UNE fois de ses traits (Grimpant) — SOURCE UNIQUE consommée
 *  par `moveEnv` (combat) ET `buildAiInput` (`EnemyTurnInput.traverse`, ai.ts est pur). undefined = aucune
 *  capacité de traversée (le sol nu byte-identique à l'ancien `MoveEnv`). */
export function climbTraverseFor(traits: Combatant['traits']): TraverseCapability | undefined {
  return hasAutoClimb(traits) ? { climb: true, climbFullSpeed: hasClimbFullSpeed(traits) } : undefined;
}

/**
 * Cases atteignables depuis `start` en au plus `range` pas, en évitant les
 * cases occupées par `env.blocked`. Retourne une map clé→distance.
 */
export function reachable(scene: Scene, start: Pt, range: number, env: MoveEnv): Map<string, number> {
  const { blocked, foot = 1, noStop, swim, traverse } = env;
  const edges = wallEdges(scene);
  const dist = new Map<string, number>();
  const sz = pz(start);
  dist.set(key(start.x, start.y, sz), 0);
  let frontier: Pt[] = [{ x: start.x, y: start.y, z: sz }];
  for (let step = 0; step < range; step++) {
    const next: Pt[] = [];
    for (const p of frontier) {
      for (const n of neighborsOf(scene, p, edges, swim, traverse)) {
        const nz = pz(n);
        const k = key(n.x, n.y, nz);
        if (dist.has(k)) continue;
        if (!footFits(scene, n.x, n.y, nz, foot, blocked, swim)) continue; // l'empreinte entière doit tenir (LDB 15 l.12)
        dist.set(k, step + 1);
        next.push(n); // franchie pour l'expansion même si interdite à l'arrêt (`noStop`)
      }
    }
    frontier = next;
  }
  if (noStop?.size) for (const k of noStop) dist.delete(k); // traversées, jamais des destinations
  return dist;
}

/**
 * Vol (LDB 85 l.433) : destinations en LIGNE DIRECTE jusqu'à `range` cases — « elle ignore tous les
 * terrains, obstacles et personnages qui s'interposent » ; seul l'ATTERRISSAGE exige une empreinte
 * praticable et libre. Coût = distance de Tchebychev (déplacement libre dans les airs).
 */
export function flyReachable(scene: Scene, start: Pt, range: number, env: MoveEnv): Map<string, number> {
  const { blocked, foot = 1, noStop, swim } = env;
  const dist = new Map<string, number>();
  const sz = pz(start); // le vol reste à l'étage du voltigeur (l'atterrissage doit y tenir)
  dist.set(key(start.x, start.y, sz), 0);
  for (let dy = -range; dy <= range; dy++)
    for (let dx = -range; dx <= range; dx++) {
      if (!dx && !dy) continue;
      const nx = start.x + dx;
      const ny = start.y + dy;
      if (!footFits(scene, nx, ny, sz, foot, blocked, swim)) continue; // l'atterrissage doit tenir
      if (noStop?.has(key(nx, ny, sz))) continue; // ne peut pas atterrir sur une autre créature
      dist.set(key(nx, ny, sz), chebyshev({ x: nx, y: ny }, start));
    }
  return dist;
}

/**
 * Portée de déplacement d'un combattant : VOL (trait « Vol » — natif OU accordé par un sort,
 * Envol Jalon 2.6) → `flyReachable` (survole murs/obstacles, l'atterrissage doit tenir) ; sinon
 * BFS au sol. Utilisé aussi bien par l'IA (ai.ts) que par les HÉROS volants.
 */
export function moveReachFor(
  mover: Pick<Combatant, 'traits'>,
  scene: Scene, start: Pt, range: number, env: MoveEnv,
): Map<string, number> {
  return (hasTrait(mover.traits, 'vol') ? flyReachable : reachable)(scene, start, range, env);
}

/**
 * POUSSÉE en ligne (Jalon 2.6 — Poussée, LDB 47 : « repoussées de BFM mètres ») : la cible
 * recule de `tiles` cases dans la direction OPPOSÉE à `from` (pas de Tchebychev — signe de
 * dx/dy), en s'arrêtant devant la première case non franchissable/occupée. Renvoie la case
 * d'arrivée, le nombre de cases parcourues et s'il y a eu COLLISION (cases restantes > 0).
 */
export function pushAway(
  scene: Scene, from: Pt, target: Pt, tiles: number, env: MoveEnv,
): { dest: Pt; pushed: number; collided: boolean } {
  const { blocked } = env;
  const sx = Math.sign(target.x - from.x);
  const sy = Math.sign(target.y - from.y);
  const tz = pz(target); // la poussée glisse au même étage que la cible
  if ((!sx && !sy) || tiles <= 0) return { dest: { ...target }, pushed: 0, collided: false };
  let cur = { x: target.x, y: target.y };
  let pushed = 0;
  for (let i = 0; i < tiles; i++) {
    const next = { x: cur.x + sx, y: cur.y + sy };
    if (!isWalkable(scene, next.x, next.y, tz) || blocked.has(key(next.x, next.y, tz))) {
      return { dest: pt(cur.x, cur.y, tz), pushed, collided: true };
    }
    cur = next;
    pushed++;
  }
  return { dest: pt(cur.x, cur.y, tz), pushed, collided: false };
}

/** Symétrique de `pushAway` : tire `target` VERS `anchor` (Langue préhensile, LDB 85 l.213 — la proie de
 *  Taille inférieure est « entraînée vers la créature »). Avance pas à pas le long de la ligne target→anchor,
 *  jusqu'à `tiles` cases, en s'arrêtant AVANT la case de l'anchor (rester adjacent) et AVANT tout obstacle /
 *  case occupée (donc avant l'empreinte d'un grand anchor, dont les tuiles sont dans `env.blocked`). Pur. */
export function pullToward(
  scene: Scene, anchor: Pt, target: Pt, tiles: number, env: MoveEnv,
): { dest: Pt; pulled: number } {
  const { blocked } = env;
  const sx = Math.sign(anchor.x - target.x);
  const sy = Math.sign(anchor.y - target.y);
  const tz = pz(target); // la traction glisse au même étage que la proie
  if ((!sx && !sy) || tiles <= 0) return { dest: { ...target }, pulled: 0 };
  let cur = { x: target.x, y: target.y };
  let pulled = 0;
  for (let i = 0; i < tiles; i++) {
    const next = { x: cur.x + sx, y: cur.y + sy };
    if ((next.x === anchor.x && next.y === anchor.y) || !isWalkable(scene, next.x, next.y, tz) || blocked.has(key(next.x, next.y, tz))) break;
    cur = next;
    pulled++;
  }
  return { dest: pt(cur.x, cur.y, tz), pulled };
}

/** Cases atteignables pour une FUITE (LDB 15 l.68 : « dans la direction OPPOSÉE à celle de
 *  votre adversaire ») : la portée de Course (`range`) restreinte aux cases qui n'APPROCHENT PAS `foe` —
 *  leur distance de Tchebychev à l'adversaire doit être ≥ à celle de la case de départ. Pur. */
export function fleeReachable(scene: Scene, from: Pt, foe: Pt, range: number, env: MoveEnv): Map<string, number> {
  const here = chebyshev(from, foe);
  const out = new Map<string, number>();
  for (const [k, v] of reachable(scene, from, range, env)) {
    const [x, y] = k.split(',').map(Number);
    if (chebyshev({ x, y }, foe) >= here) out.set(k, v);
  }
  return out;
}

/** Plus court chemin (BFS) de `start` à `goal`, ou null. (`env.noStop` ignoré : le but est validé en amont.) */
export function pathTo(scene: Scene, start: Pt, goal: Pt, env: MoveEnv): Pt[] | null {
  const { blocked, foot = 1, jump = 0, swim, traverse } = env;
  const edges = wallEdges(scene);
  const gz = pz(goal);
  const came = new Map<string, string | null>();
  came.set(key(start.x, start.y, pz(start)), null);
  const queue: Pt[] = [{ x: start.x, y: start.y, z: pz(start) }];
  while (queue.length) {
    const p = queue.shift()!;
    if (p.x === goal.x && p.y === goal.y && pz(p) === gz) {
      const path: Pt[] = [];
      let cur: string | null = key(p.x, p.y, pz(p));
      while (cur) {
        const [x, y, z = 0] = cur.split(',').map(Number);
        path.unshift(pt(x, y, z));
        cur = came.get(cur) ?? null;
      }
      return path;
    }
    for (const n of neighborsOf(scene, p, edges, swim, traverse)) {
      const nz = pz(n);
      const k = key(n.x, n.y, nz);
      if (came.has(k)) continue;
      const isGoal = n.x === goal.x && n.y === goal.y && nz === gz;
      // Empreinte > 1 : chaque pas (arrivée incluse) doit tenir entièrement. 1×1 : la cible peut être
      // une case occupée (on s'arrête au contact d'un ennemi), comportement historique.
      if (foot > 1) { if (!footFits(scene, n.x, n.y, nz, foot, blocked, swim)) continue; }
      else if (!isGoal && (!isWalkable(scene, n.x, n.y, nz, swim) || blocked.has(k))) continue;
      came.set(k, key(p.x, p.y, pz(p)));
      queue.push(n);
    }
    // Sauts par-dessus un gouffre : atterrissages déjà validés (praticables/libres) — n'altèrent jamais
    // le déplacement à pied (jumpNeighbors=[] sans gouffre), donc gratis quand jump=0.
    for (const n of jumpNeighbors(scene, p, jump, blocked, foot, edges, swim)) {
      const k = key(n.x, n.y, pz(n));
      if (came.has(k)) continue;
      came.set(k, key(p.x, p.y, pz(p)));
      queue.push(n);
    }
  }
  return null;
}

export function manhattan(a: Pt, b: Pt): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** Distance de combat sur la grille — canon `engine/grid`, réexporté ici pour ses ~30 appelants
 *  du store (`Pt` est structurellement un `GridPt`). */
export { chebyshev };
