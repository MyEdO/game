/**
 * Vision — moteur PUR de visibilité & champ de lumière (brouillard de guerre). Vit en `state`
 * (couplé à `Scene`, comme `lineOfSight.ts`) ; aucune dépendance au store/RNG → testable.
 *
 * Un viewer voit une case si la Ligne de Vue n'est pas bloquée (murs/décor/fumée via
 * `lineOfSightCover`) ET (elle est dans sa portée de vision nocturne, OU elle est dans son rayon
 * de vue ET éclairée au-dessus du seuil). L'ensemble visible = UNION de tous les viewers.
 *
 * RÈGLE 1 : la portée de vue de base et le seuil d'éclairement n'ont pas de valeur canon (le LDB ne
 * stat pas la vue) → réglages MAISON injectés en paramètres ; les rayons de lumière (Bougie 10 m,
 * Lanterne 20 m — `LDB 74 l.43`, `LDB 74 l.58`) et la Vision nocturne (20 m/niv — `LDB 11 l.176`)
 * sont canon ; la DONNÉE les porte en mètres et `rayonEnCases` les convertit à l'échelle de la scène
 * (`Scene.metresPerTile`, défaut `LDB 15 l.12`).
 */
import { Scene, tileAt, heightAt, sceneMetresPerTile, areteOcculte } from './scene';
import { wallOnSight } from './lineOfSight';
import { terrainOpaque, terrainSolidHeightM } from './terrain';
import { METRES_PER_LEVEL } from './relief';
import { sceneIsDark } from './sceneRules';
import { propFootTiles, decorAncre } from './footprint';
import { Pt, chebyshev } from './path';
import { findLightLevelById, findTraitById, findPropById, findTrappingById } from '../data';
import { empreinteDuProp, rotatePropLocal, CAP_IDENTITE_PROP, type PropData } from '../data/props.types';
import type { Dir8 } from './dir8';
import { memoByRef } from './sceneMemo';
import { cleArete, areteEntre } from '../geometry/arete';

/** Un observateur : sa case, son rayon de vue (cases éclairées qu'il distingue) et sa portée de
 *  vision nocturne (cases qu'il distingue même dans le noir). */
export interface Viewer {
  pos: Pt;
  z?: number;
  radiusTiles: number;
  darkTiles: number;
}

/** Une source de lumière ponctuelle (torche portée, brasero posé…). */
export interface LightSource {
  pos: Pt;
  z?: number;
  radiusTiles: number;
  /** Id de CE QUI PORTE la source — `SceneEntity.id` pour une source posée, `Combatant.id` pour une
   *  source portée. C'est la couture par laquelle un consommateur (le rendu) retrouve le sujet qui la
   *  déplace. L'agrégat du groupe en exploration réunit les émetteurs de tous les héros en UNE source,
   *  et nomme le MENEUR (`state/visionState.ts` : le seul héros qui marche à l'écran). */
  srcId?: string;
  /** La source est-elle PORTÉE par un sujet qui se déplace (lanterne, sort de Lumière) plutôt que POSÉE
   *  sur la carte (brasero, torche murale) ? Le rendu s'en sert pour arbitrer un budget de lampes
   *  saturé : le décor de la scène garde ses flaques, les porteurs remplissent le reste
   *  (`gameIso/stage/stagePointLights.ts`). Absent = posée. */
  carried?: boolean;
  /** TON de la source (#1245, L4) : id d'un `lightTones` — APPARENCE seule (couleur, part d'intensité,
   *  vacillement). Le champ de lumière mécanique l'IGNORE : il ne connaît que le rayon (LDB 74) ; seul
   *  le rendu le résout (`gameIso/stage/stagePointLights.ts`). Absent = `flamme`. */
  tone?: string;
  /** FOYER de la source, RELATIF à `pos` : le centre de la primitive que la recette du décor déclare
   *  émettrice (`PropPrimitive.emet`, `data/props.types.ts`). `x`/`y` en CASES, `h` en MÈTRES au-dessus
   *  du sol de la case — les mêmes unités que le MONDE, et il subit ICI la MÊME transformation rigide
   *  que la géométrie (division du plan par le `metresPerTile` de la scène, puis `rotatePropLocal` au cap
   *  de l'instance) : la lampe et le volume qu'elle éclaire tournent donc ensemble, et un déplacement de
   *  l'ancre les déplace tous deux.
   *
   *  Comme le `tone`, le champ de lumière MÉCANIQUE l'ignore : le couvert et la portée se comptent en
   *  cases depuis `pos`, et un décalage sous-métrique dans la case n'y change rien. Seul le RENDU le
   *  lit. Absent = la source n'a pas de primitive déclarée (billboard, lampe portée) : le rendu applique
   *  alors sa hauteur par défaut (`FLAME_LIFT_M`). */
  foyer?: { x: number; y: number; h: number };
}

/** Champ de lumière : niveau d'éclairement 0..1 d'une case. `sourceLit` = cases éclairées par une
 *  SOURCE ponctuelle (hors plancher ambiant) — visibles si on y a la Ligne de Vue, même au-delà du
 *  rayon ambiant (on voit un feu dans le noir). */
export interface LightField {
  at(x: number, y: number, z?: number): number;
  sourceLit?: Set<string>;
}

/** Seuil d'éclairement (MAISON) au-dessus duquel une case est « éclairée » pour la vue. */
export const LIT_THRESHOLD = 0.18;

/** Grille d'opacité de la scène (1 = bloque la vue), précalculée UNE FOIS par recompute → lookups O(1)
 *  dans le rayon, au lieu d'un `.find` O(entités) par échantillon (la cause des 64 ms/recompute).
 *  Terrain opaque + décor opaque (`props.json`). Les cloisons de bâtiment sont des `WallSeg` (arêtes),
 *  prises en compte séparément ci-dessous. PUR. */
export interface Occ { g: Uint8Array; topH: Float32Array; w: number; h: number; walls: Set<string> }
/** Mémoïsé par IDENTITÉ de `scene` (`memoByRef`, patron unique) : sûr car `buildOpaqueUncached` ne
 *  lit QUE des champs de `scene` (`dimensions`, `entities`, `walls` — et `tileAt`/`heightAt` qui lisent
 *  `layers`/`relief`), et TOUTE mutation de l'un de ces champs (porte/structure/tuile effondrée via
 *  `setDoorOpen`/`toggleDoorIn`/`setStructureDown`/`setTileCollapsed` `scene.ts`, mais aussi tout
 *  changement d'`entities`/`walls`/`layers`) renvoie une NOUVELLE réf `{ ...scene, … }` — jamais une
 *  mutation en place. La clé du cache est `scene` (pas un sous-champ) : un re-keying futur sur un
 *  sous-champ (ex. `scene.flags` seul) devrait réétablir cette même garantie pour CHAQUE champ lu
 *  ci-dessus, pas seulement les flags de porte/structure/tuile — garde AST `scene-mutation-guard.test.ts`. */
export const buildOpaque = memoByRef(buildOpaqueUncached);
function buildOpaqueUncached(scene: Scene): Occ {
  const { w, h } = scene.dimensions;
  const g = new Uint8Array(w * h);
  // Hauteur (m) du SOMMET de la masse opaque d'une colonne : un viewer PLUS HAUT voit PAR-DESSUS (un
  // défenseur sur le chemin de ronde à 4 m voit au-delà du mur de 4 m ; l'ancien 2D coupait à ~3 cases).
  // Masse pleine → `solidHeightM` ; opaque « pleine hauteur » sans bloc (porte) → 1 niveau par défaut.
  const topH = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (terrainOpaque(tileAt(scene, x, y))) {
        g[y * w + x] = 1;
        topH[y * w + x] = heightAt(scene, x, y, 0) + (terrainSolidHeightM(tileAt(scene, x, y)) || METRES_PER_LEVEL);
      }
  for (const e of scene.entities) {
    if (e.kind !== 'prop' || !e.ref || !findPropById(e.ref)?.opaque) continue;
    for (const { x, y } of propFootTiles(e.ref, e.pos, e.facing, sceneMetresPerTile(scene)))
      if (x >= 0 && y >= 0 && x < w && y < h) { g[y * w + x] = 1; topH[y * w + x] = heightAt(scene, x, y, 0) + METRES_PER_LEVEL; }
  }
  // Arêtes OCCULTANTES (z0) en SET : le VERDICT `areteOcculte` y est cuit une fois par `Occ`, donc le
  // rayon n'a ni index à interroger ni prédicat à jouer. C'est le même verdict que le défaut de
  // `wallOnSight` — vision et combat ne divergent jamais sur une arête ; N/E seulement (les diagonales
  // n'occultent pas une LdV cardinale, cf. wallOnSight).
  const walls = new Set<string>();
  for (const seg of scene.walls ?? []) {
    if ((seg.z ?? 0) !== 0 || (seg.side !== 'N' && seg.side !== 'E')) continue;
    if (!areteOcculte(scene, seg)) continue;
    walls.add(cleArete(seg.x, seg.y, seg.side, 0));
  }
  return { g, topH, w, h, walls };
}

/** Échantillons par case du segment (anti-fuite au COIN d'un mur : un supercover entier rate une tuile
 *  que le rayon ne fait qu'EFFLEURER). */
const SAMPLES_PER_TILE = 4;

/** Prédicat d'arête O(1) de la grille d'opacité, bâti UNE fois par `Occ` (`memoByRef`) et non par
 *  rayon : c'est le même pour tous les rayons d'une scène, et il en part un par case regardée. */
const edgeBlockerOf = memoByRef((occ: Occ) => (ax: number, ay: number, bx: number, by: number): boolean => {
  const e = areteEntre(ax, ay, bx, by);
  return e ? occ.walls.has(cleArete(e.x, e.y, e.side, 0)) : false;
});

/** La vue `from`→`to` est-elle OCCULTÉE (vision) ? RAPIDE : grille d'opacité O(1) + murs d'arête + fumée.
 *  Plus strict que le combat : TOUTE case opaque sur la ligne (même collée à la cible) cache — on ne
 *  voit pas à travers un mur. Les couverts PARTIELS (haie, tonneau…) ne sont pas opaques → laissent voir.
 *  `ignoreEdges` : vue VERS LE BAS (viewer au-dessus, cf. `computeVisible`) — on regarde par-dessus les
 *  arêtes fines (parapet/créneaux, comme la LdV de combat cross-z), donc seules les TUILES opaques coupent. */
function rayBlocked(scene: Scene, occ: Occ, smoke: Set<string>, from: Pt, to: Pt, ignoreEdges = false, viewerH = 0): boolean {
  if (smoke.size && (smoke.has(`${from.x},${from.y}`) || smoke.has(`${to.x},${to.y}`))) return true;
  if (!ignoreEdges && occ.walls.size) {
    if (wallOnSight(scene, from, to, 0, edgeBlockerOf(occ))) return true;
  }
  const dx = to.x - from.x, dy = to.y - from.y;
  const n = Math.ceil(Math.hypot(dx, dy) * SAMPLES_PER_TILE);
  // Boucle d'ÉCHANTILLONS : le poste le plus chaud de tout le brouillard (une centaine de milliers de
  // passages par recalcul sur une grande carte). Les champs de `occ` sont tenus en locales, et la
  // FUMÉE n'est interrogée que s'il y en a — sinon sa clé de case se fabriquerait à chaque échantillon.
  const { g, topH, w, h } = occ;
  const fumee = smoke.size > 0;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const cx = Math.round(from.x + dx * t), cy = Math.round(from.y + dy * t);
    if ((cx === from.x && cy === from.y) || (cx === to.x && cy === to.y)) continue;
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
    const oi = cy * w + cx;
    // TUILE OPAQUE : ne coupe QUE si le viewer est PLUS BAS que le sommet de la masse (sinon il voit
    // par-dessus — défenseur sur le chemin de ronde). Fumée : coupe toujours.
    if ((g[oi] && viewerH < topH[oi]) || (fumee && smoke.has(`${cx},${cy}`))) return true;
  }
  return false;
}

/** Niveau de lumière effectif d'une scène : `Scene.ambientLight` explicite, sinon `auto`/absent →
 *  dérivé de l'horloge (`sceneIsDark` : extérieur de nuit = sombre). */
function levelOf(scene: Scene, gameTime: number) {
  const id = scene.ambientLight && scene.ambientLight !== 'auto' ? scene.ambientLight : sceneIsDark(scene, gameTime) ? 'nuit' : 'jour';
  return findLightLevelById(id) ?? findLightLevelById('jour')!;
}

/** Scalaire d'éclairement 0..1 de la scène (assombrissement du rendu + plancher du champ de lumière).
 *  `override` = `setLight` runtime (prime sur le niveau authored). */
export function ambientScalar(scene: Scene, gameTime: number, override: number | null = null): number {
  if (override != null) return Math.max(0, Math.min(1, override));
  return levelOf(scene, gameTime).scalar;
}

/** Rayon de vue de base (cases) du niveau de lumière — réglage MAISON (data, éditable au Codex). */
export function baseSightTiles(scene: Scene, gameTime: number): number {
  return levelOf(scene, gameTime).baseSightTiles;
}

/**
 * Rayon d'une source de lumière : des MÈTRES que porte la donnée (la valeur RAW telle qu'elle est
 * écrite — Bougie 10 m `LDB 74 l.43`, Lanterne 20 m `LDB 74 l.58`) aux CASES du champ mécanique.
 * UNIQUE définition de cette conversion : les DEUX fabriques de `LightSource` (posée `mapLights`,
 * portée `combatantLights`) la partagent — un second calcul divergerait dès qu'une scène change
 * d'échelle, et c'est exactement le défaut que #1507 supprime. PURE.
 */
export const rayonEnCases = (radiusM: number, mpt: number): number => radiusM / mpt;

/** Sources de lumière POSÉES sur la carte : props dont le TYPE (`props.json` `light`) émet, ou
 *  override d'instance `SceneEntity.light`. PUR. */
export function mapLights(scene: Scene): LightSource[] {
  const out: LightSource[] = [];
  const mpt = sceneMetresPerTile(scene);
  for (const e of scene.entities) {
    if (e.kind !== 'prop') continue;
    // Rayon et TON se surchargent CHAMP PAR CHAMP : une instance qui ne pose qu'un rayon garde le ton
    // de son type de prop, et réciproquement — un override d'instance ne déshabille pas le reste.
    const inst = e.light;
    const prop = e.ref ? findPropById(e.ref) : undefined;
    const type = prop?.light;
    const rM = inst?.radiusM ?? type?.radiusM;
    if (rM && rM > 0) out.push({ pos: e.pos, z: e.z, radiusTiles: rayonEnCases(rM, mpt), srcId: e.id, tone: inst?.tone ?? type?.tone, ...foyerDe(prop, e.pos, e.facing, mpt) });
  }
  return out;
}

/**
 * FOYER d'un décor dont la recette DÉCLARE sa primitive émettrice (`emet`) : le centre de cette
 * primitive, exprimé RELATIVEMENT à `pos` comme le veut `LightSource.foyer`.
 *
 * Il se compose EXACTEMENT comme la géométrie, et depuis les MÊMES deux sources qu'elle :
 *  - l'ANCRE du décor (`decorAncre`, `state/footprint.ts`) — le centre de son empreinte EFFECTIVE
 *    (`empreinteDuProp`, corps tourné depuis #1509), que
 *    `gameIso/builders/props.ts` lit pour poser la recette ; une empreinte 2×2 la décale d'une
 *    demi-case sur chaque axe, et une lampe calée sur `pos` seul s'en détacherait de 1,414 m ;
 *  - la ROTATION au cap de l'instance (`rotatePropLocal`, `data/props.types.ts`), l'unique définition
 *    de ce que `SceneEntity.facing` fait subir à une géométrie de décor.
 * Aucun des deux n'est recalculé ici : un second calcul d'offset divergerait au premier changement
 * d'ancrage, et c'est précisément ce que ce foyer ne doit pas pouvoir faire.
 *
 * Rien à rendre sans recette ou sans `emet` : la source garde alors le défaut du rendu. PUR.
 */
function foyerDe(prop: PropData | undefined, pos: Pt, facing: Dir8 | undefined, mpt: number): { foyer?: LightSource['foyer'] } {
  const emettrice = prop?.volume?.primitives.find((p) => p.emet);
  if (!emettrice) return {};
  const ancre = decorAncre(pos, empreinteDuProp(prop, facing, mpt));
  const [x, y] = rotatePropLocal(emettrice.center.xM / mpt, emettrice.center.yM / mpt, facing ?? CAP_IDENTITE_PROP);
  return { foyer: { x: ancre.x - pos.x + x, y: ancre.y - pos.y + y, h: emettrice.center.hM } };
}

/** Source de lumière PORTÉE par un combattant/groupe : le plus grand rayon parmi ses émetteurs, émis depuis
 *  `pos`. PUR. Deux canaux UNIFIÉS (op `light`) : (1) un OBJET portant un `passive` `op:'light'`, GATÉ sur
 *  le port — équipé (`it.equipped`) ou tenu dans le loadout actif (`c.weapons`) ; un objet RANGÉ dans le sac
 *  n'éclaire pas (RAW : on s'éclaire avec une lanterne en main, pas au fond du sac). (2) un SORT actif
 *  (`ActiveEffect.light`, ex. Lumière) pendant sa durée. */
export function combatantLights(c: {
  id?: string;
  pos?: Pt;
  items?: { uid?: string; trappingId?: string; equipped?: boolean }[];
  weapons?: { uid?: string }[];
  activeEffects?: { light?: { radiusM: number; tone?: string } }[];
}, mpt: number): LightSource[] {
  if (!c.pos) return [];
  // Le TON suit l'émetteur RETENU, jamais le dernier vu : c'est le plus grand rayon qui fait la source,
   // donc c'est SON apparence qu'elle porte — une bougie au sac ne déteindrait pas sur la lanterne en main.
  let rM = 0;
  let tone: string | undefined;
  for (const it of c.items ?? []) {
    const held = !!it.equipped || (c.weapons ?? []).some((w) => w.uid === it.uid);
    if (!held || !it.trappingId) continue;
    for (const op of findTrappingById(it.trappingId)?.passive ?? []) {
      if (op.op === 'light' && op.radiusM > rM) { rM = op.radiusM; tone = op.tone; }
    }
  }
  for (const e of c.activeEffects ?? []) {
    const lr = e.light?.radiusM;
    if (lr && lr > rM) { rM = lr; tone = e.light?.tone; }
  }
  // `z` = l'ÉTAGE du porteur : le champ de lumière indexe ses cases par `"x,y,z"` (`computeLightField`
  // lit `s.z ?? 0`), donc une source sans `z` inscrit son halo au SOL — une lanterne portée sur le
  // chemin de ronde éclairait la cour en contrebas et laissait le rempart noir.
  return rM > 0 ? [{ pos: c.pos, z: c.pos.z, radiusTiles: rayonEnCases(rM, mpt), srcId: c.id, carried: true, tone }] : [];
}

/** Portée de vision dans le noir (cases) d'un combattant : max des `darkSightTiles` de ses traits
 *  (Infravision illimité, Vision nocturne 10) ; le talent Vision nocturne réutilise la valeur du trait
 *  homonyme (donnée, pas de littéral). 0 = aveugle dans le noir. */
export function darkSightTiles(c: { traits?: { id: string }[]; talents?: { talentId: string }[] }): number {
  let m = 0;
  for (const t of c.traits ?? []) m = Math.max(m, findTraitById(t.id)?.capabilities?.darkSightTiles ?? 0);
  if ((c.talents ?? []).some((t) => t.talentId === 'vision-nocturne')) {
    m = Math.max(m, findTraitById('vision-nocturne')?.capabilities?.darkSightTiles ?? 0);
  }
  return m;
}

/**
 * BORNES ENTIÈRES d'un balayage de grille autour d'un point, pour un rayon RÉEL. Le rayon d'une
 * source ou d'un viewer n'est plus entier depuis #1507 (`rayonEnCases` rend des mètres divisés par
 * l'échelle : une bougie de 10 m vaut 1 case en mer, un brasero de 8 m en vaut 0,8) ; une borne
 * fractionnaire ferait démarrer la boucle sur un x fractionnaire et n'écrirait que des clés de grille
 * impossibles (`"5.2,5.2,0"`), c'est-à-dire AUCUNE case éclairée. Les bornes s'arrondissent donc vers
 * l'extérieur, et c'est la DISTANCE (réelle) qui décide ensuite — la case de la source, à distance 0,
 * reste éclairée quel que soit le rayon. PURE.
 */
const bornes = (centre: number, rayon: number, max: number): [number, number] =>
  [Math.max(0, Math.ceil(centre - rayon)), Math.min(max, Math.floor(centre + rayon))];

/** Contribution d'une source à une case à distance `d` (dégradé linéaire, 1 au centre → 0 au bord). */
function falloff(d: number, radius: number): number {
  // Un rayon INFÉRIEUR à la case (bougie de 10 m sur une scène MER, 1 case = 10 m) éclaire sa propre
  // case et rien d'autre : la source y est à distance 0, donc à pleine intensité (`1 − 0/radius` = 1
  // quel que soit le rayon), et la case suivante tombe déjà sous le dégradé.
  if (radius <= 0) return d === 0 ? 1 : 0;
  return Math.max(0, 1 - d / radius);
}

/**
 * Champ de lumière de la scène : plancher `ambient` (0..1) partout, rehaussé par chaque source
 * (dégradé `falloff`, combinaison par max) — une source n'éclaire une case que si la Ligne de Vue
 * source→case est dégagée (la lumière ne traverse pas les murs). PUR.
 */
export function computeLightField(scene: Scene, ambient: number, sources: LightSource[], smoke: Pt[] = [], occ: Occ = buildOpaque(scene)): LightField {
  const { w, h } = scene.dimensions;
  const smokeSet = new Set(smoke.map((s) => `${s.x},${s.y}`));
  const grid = new Map<string, number>(); // "x,y,z" → contribution des sources (> ambient seulement)
  for (const s of sources) {
    const z = s.z ?? 0;
    const R = s.radiusTiles;
    const [x0, x1] = bornes(s.pos.x, R, w - 1);
    const [y0, y1] = bornes(s.pos.y, R, h - 1);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const d = chebyshev(s.pos, { x, y });
        const c = falloff(d, R);
        if (c <= 0) continue;
        if (d > 0 && rayBlocked(scene, occ, smokeSet, s.pos, { x, y })) continue;
        const k = `${x},${y},${z}`;
        const prev = grid.get(k) ?? 0;
        if (c > prev) grid.set(k, c);
      }
  }
  const sourceLit = new Set<string>();
  for (const [k, v] of grid) if (v >= LIT_THRESHOLD) sourceLit.add(k);
  return { at: (x, y, z = 0) => Math.max(ambient, grid.get(`${x},${y},${z}`) ?? 0), sourceLit };
}

/**
 * Ensemble des cases (`"x,y,z"`) visibles par AU MOINS UN viewer. Une case est visible si la Ligne
 * de Vue est dégagée ET (dans la portée de vision nocturne du viewer, OU dans son rayon de vue ET
 * éclairée ≥ `LIT_THRESHOLD`). PUR.
 */
export function computeVisible(scene: Scene, viewers: Viewer[], light: LightField, smoke: Pt[] = [], occ: Occ = buildOpaque(scene)): Set<string> {
  const { w, h } = scene.dimensions;
  const smokeSet = new Set(smoke.map((s) => `${s.x},${s.y}`));
  const maxZ = scene.layers.reduce((m, l) => Math.max(m, l.z), 0);
  const vis = new Set<string>();
  for (const v of viewers) {
    const z = v.z ?? 0;
    const viewerH = heightAt(scene, v.pos.x, v.pos.y, z); // hauteur du viewer → voit par-dessus les masses plus basses
    // Étage le plus HAUT révélé = celui que la HAUTEUR du viewer atteint (pas seulement son index d'étage) :
    // au SOMMET d'une rampe (case z0 élevée à 4 m), on voit le chemin de ronde z1 d'à côté, à la même
    // hauteur — sinon on reste aveugle à l'étage du dessus alors qu'on est physiquement à son niveau.
    const zTop = Math.max(z, Math.min(maxZ, Math.floor(viewerH / METRES_PER_LEVEL + 0.01)));
    const R = Math.max(v.radiusTiles, v.darkTiles);
    const [x0, x1] = bornes(v.pos.x, R, w - 1);
    const [y0, y1] = bornes(v.pos.y, R, h - 1);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const d = chebyshev(v.pos, { x, y });
        if (d > R) continue;
        const inDark = d <= v.darkTiles;
        // Visibilité VERS LE BAS : le viewer révèle SON étage `z` ET tous les étages INFÉRIEURS (on voit
        // en contrebas depuis une hauteur, jamais à travers un plancher vers le haut). Mono-étage (z=0)
        // → boucle réduite à zr=0 : byte-identique à l'ancien marquage du seul étage du viewer.
        for (let zr = zTop; zr >= 0; zr--) {
          const k = `${x},${y},${zr}`;
          if (vis.has(k)) continue;
          const lit = d <= v.radiusTiles && light.at(x, y, zr) >= LIT_THRESHOLD;
          if (!inDark && !lit) continue;
          // Même étage : LdV 2D pleine (murs d'arête compris). Étage inférieur (cross-z) : on regarde
          // par-dessus les arêtes fines (cf. LdV de combat) → seules les tuiles opaques coupent (`ignoreEdges`).
          if (d > 0 && rayBlocked(scene, occ, smokeSet, v.pos, { x, y }, zr !== z, viewerH)) continue;
          vis.add(k);
        }
      }
  }
  // Cases éclairées par une SOURCE (torche/brasero) : visibles dès qu'un viewer y a la Ligne de Vue,
  // même hors du rayon ambiant (on voit un feu dans le noir, ou la bulle de sa propre lanterne).
  if (light.sourceLit)
    for (const k of light.sourceLit) {
      if (vis.has(k)) continue;
      const c = k.split(',');
      const x = +c[0], y = +c[1], z = +c[2];
      for (const v of viewers) {
        const vz = v.z ?? 0;
        if (vz < z) continue; // pas de vision vers le haut : le viewer doit être au niveau de la source OU au-dessus
        const viewerH = heightAt(scene, v.pos.x, v.pos.y, vz);
        if (chebyshev(v.pos, { x, y }) === 0 || !rayBlocked(scene, occ, smokeSet, v.pos, { x, y }, vz !== z, viewerH)) {
          vis.add(k);
          break;
        }
      }
    }
  return vis;
}
