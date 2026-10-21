/**
 * MÉTÉO VOLUMIQUE (#1176, P2-6) — la pluie et la neige TOMBENT dans le monde, elles ne sont pas un
 * voile collé à l'écran : des particules posées en mètres dans le repère three, donc testées en
 * profondeur par le z-buffer (un mur les cache, un toit les arrête) et ancrées à la carte quand la
 * caméra tourne.
 *
 * DEUX MOITIÉS, séparées exprès — le même partage que les accents de sol (`groundAccents.ts`) :
 *  - PHYSIQUE PURE (`makeWeatherField`, `stepWeatherField`, `writePrecipMatrices`) : ni three, ni DOM,
 *    testable en node nu. Le semis vit dans DEUX `Float32Array` (positions, jitter de vitesse) alloués
 *    UNE fois : une particule qui touche le sol, qui entre sous un toit ou qui sort de l'emprise
 *    REMONTE au plafond DANS SA COLONNE (une sortie latérale rentre par l'arête opposée) — jamais
 *    d'allocation, jamais de collecte, par frame. La colonne conservée est ce qui rend la densité vue
 *    au sol INDÉPENDANTE du bâti : une goutte arrêtée par un toit ne grossit pas la pluie de la rue
 *    voisine (mesuré : rue à densité égale à 1,5 % près avec et sans un toit de 8×8 cases ; +17 %
 *    quand le recyclage retirait la goutte au hasard de l'emprise, +32 % s'il évitait les abris).
 *  - MONTAGE (`buildPrecipMesh`) : UN `THREE.InstancedMesh` (un seul appel de dessin) dont chaque
 *    instance est un quad. Son ORIENTATION est la MÊME pour toutes : la vitesse est commune au semis
 *    (chute + vent, en donnée), donc la base de la matrice se calcule une fois par frame et seule la
 *    translation change par particule — trois écritures dans le tampon, pas une composition de matrice.
 *
 * SOUS COUVERT : la question « cette case est-elle abritée ? » n'est PAS reposée ici. Elle a une seule
 * réponse dans le dépôt (`shelterField`/`isSheltered`, `builders/roofs.ts`), celle-là même dont dépend
 * le dégagement d'architecture — sinon deux vérités de « suis-je sous un toit ? », et il pleut dans la
 * taverne. Le semis lit le verdict par le prédicat `sheltered` que lui passe l'écran ; un toit LEVÉ par
 * le cutaway reste un toit (le champ ne connaît pas la vue), et le couvert suit le PLAN — une scène
 * dont le bâti change est une autre scène, dont le champ d'abri se recalcule.
 *
 * AUCUN TYPE DE MÉTÉO N'EST NOMMÉ ICI : densité, vitesse de chute, vent, taille, teinte et plafond
 * viennent tous de la donnée (`WeatherPrecipDef`, `src/data/ambiance.json`). PÉRIMÈTRE MESURÉ de ce
 * N+1 : le MOTEUR est N+1-par-donnée — un `WeatherPrecipDef` forgé, qui n'existe nulle part dans le
 * dépôt, tombe ici sans une ligne de code (`weatherParticles.test.ts`). Le VOCABULAIRE des types, lui,
 * est une énumération à TROIS sites — `Scene['weather']` (`noyau/monde/scene.ts`), `WeatherFxId`
 * (`catalog/ambiance.ts`) et l'objet strict du schéma (`data/schemas/defs/ambiance.ts`) : nommer un
 * type de plus édite ces trois-là, design antérieur à ce module.
 */
import * as THREE from 'three';
import type { WeatherPrecipDef } from '../../catalog/ambiance';
import { hash32, seedStream } from '../../../data/hash';
import { heightAt, sceneMetresPerTile, type Scene } from '../../../noyau/monde/scene';
import { withRenderRank } from './renderRanks';
import { materiauPlanTransparent } from './worldMaterials';

/** BUDGET DUR d'instances du semis : au-delà, la densité de donnée est écrêtée. Une carte de ville
 *  entière sous la tempête demanderait des dizaines de milliers de quads pour un gain nul — au-delà
 *  de quelques milliers, la pluie est déjà un rideau plein. */
export const MAX_PRECIP = 4000;

/** Le VOLUME où le semis vit : l'emprise métrique de la carte, son sol le plus bas, et le plafond
 *  (donnée) au-dessus de ce sol. Repère three : `x` = est, `y` = haut, `z` = sud. */
export interface PrecipArea {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** Cote du sol le plus BAS de la carte : sous elle, une particule est passée sous le monde. */
  groundM: number;
  /** Cote du plafond de semis. */
  topM: number;
}

/** Le volume de semis d'une scène : la carte entière, du sol le plus bas au plafond de la donnée. La
 *  cote de recyclage est le sol le plus BAS — une particule qui passe sous une butte est déjà cachée
 *  par la géométrie du terrain, alors qu'un recyclage au sol le plus HAUT la ferait disparaître en
 *  plein ciel au-dessus des creux. */
export function precipArea(scene: Scene, def: WeatherPrecipDef): PrecipArea {
  const mpt = sceneMetresPerTile(scene);
  const { w, h } = scene.dimensions;
  const { groundM, topGroundM } = sceneGroundSpan(scene);
  return {
    x0: -0.5 * mpt,
    x1: (w - 0.5) * mpt,
    z0: -0.5 * mpt,
    z1: (h - 0.5) * mpt,
    groundM,
    topM: topGroundM + def.ceilingM,
  };
}

/** Cotes EXTRÊMES du sol de la carte, tous niveaux confondus — la référence verticale des deux
 *  expressions volumiques de la météo : le recyclage du semis part du sol le plus BAS (ci-dessus), et
 *  les nappes de brume s'y empilent (`weatherSheets.ts`). Une seule mesure, donc un seul repère. PURE. */
export function sceneGroundSpan(scene: Scene): { groundM: number; topGroundM: number } {
  const { w, h } = scene.dimensions;
  let groundM = Infinity;
  let topGroundM = -Infinity;
  for (const layer of scene.layers)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const cote = heightAt(scene, x, y, layer.z);
        if (cote < groundM) groundM = cote;
        if (cote > topGroundM) topGroundM = cote;
      }
  return {
    groundM: Number.isFinite(groundM) ? groundM : 0,
    topGroundM: Number.isFinite(topGroundM) ? topGroundM : 0,
  };
}

/** Combien de particules pour ce volume : la densité de donnée sur la surface au sol, écrêtée au
 *  budget. Fonction PURE — c'est elle que mesure le test de budget. */
export function precipCount(def: WeatherPrecipDef, area: PrecipArea): number {
  const surfaceM2 = Math.max(0, area.x1 - area.x0) * Math.max(0, area.z1 - area.z0);
  return Math.min(MAX_PRECIP, Math.round(def.density * surfaceM2));
}

/** Le semis VIVANT : les positions (3 flottants par particule) et le jitter de vitesse de chacune. */
export interface WeatherField {
  def: WeatherPrecipDef;
  area: PrecipArea;
  /** Nombre de particules — CONSTANT sur toute la vie du champ. */
  n: number;
  /** `[x0,y0,z0, x1,y1,z1, …]` en mètres, repère three. */
  pos: Float32Array;
  /** Facteur de vitesse propre à chaque particule (une pluie n'est pas un peigne). */
  jitter: Float32Array;
  /** État d'ÉCRÊTAGE retenu de chaque particule (0 = rendue, 1 = effondrée) — l'écriture des
   *  matrices ne refait la base que de celles qui viennent d'en changer (`writePrecipMatrices`). */
  ecrete: Uint8Array;
  /** Flux pseudo-aléatoire SEEDÉ du champ : le recyclage y puise, donc un même seed rejoue la même
   *  averse — aucune entropie sur le chemin de rendu. */
  rng: () => number;
}

/** Un verdict d'ABRI, en coordonnées MONDE (mètres) : `true` = rien ne tombe ici. */
export type ShelteredAt = (xM: number, zM: number, yM: number) => boolean;

/** Rien n'abrite (ciel ouvert partout) — le champ tombe alors sur toute la carte. */
export const CIEL_OUVERT: ShelteredAt = () => false;

/** Sème le champ : positions uniformes dans le volume, jitter de vitesse dans ±20 %. Les particules
 *  qui tombent d'emblée dans un abri sont posées quand même — la première passe de `stepWeatherField`
 *  les recycle, et le semis reste d'un coût constant. */
export function makeWeatherField(def: WeatherPrecipDef, area: PrecipArea, seed: string): WeatherField {
  const n = precipCount(def, area);
  const rng = seedStream(hash32('precip', seed));
  const pos = new Float32Array(n * 3);
  const jitter = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = area.x0 + rng() * (area.x1 - area.x0);
    pos[i * 3 + 1] = area.groundM + rng() * (area.topM - area.groundM);
    pos[i * 3 + 2] = area.z0 + rng() * (area.z1 - area.z0);
    jitter[i] = 0.8 + rng() * 0.4;
  }
  return { def, area, n, pos, jitter, ecrete: new Uint8Array(n), rng };
}

/** Un semis RETENU et la clé qui le détermine — ce que l'écran garde d'un rendu à l'autre. */
export interface PrecipSlot {
  cle: string;
  champ: WeatherField;
}

/** IDENTITÉ du semis d'une scène : la scène, le type de météo authoré, l'emprise du volume — rien
 *  d'autre ne le détermine. Deux références de scène qui ne diffèrent par AUCUN des trois rendent la
 *  MÊME clé (un combattant qui avance produit une référence de scène par pas). */
export function precipFieldKey(scene: Pick<Scene, 'id' | 'weather'>, area: PrecipArea): string {
  return `${scene.id}|${scene.weather ?? ''}|${area.x0},${area.x1},${area.z0},${area.z1},${area.groundM},${area.topM}`;
}

/** Le semis PERSISTÉ de la scène : tant que la clé ne change pas, le champ rendu est le MÊME objet,
 *  positions comprises — l'averse continue de tomber là où elle en était. Sans cette rétention, chaque
 *  nouvelle référence de scène re-sème le champ et téléporte toutes ses gouttes (mesuré sur La
 *  Diligence : 1459/1459 particules déplacées, saut max 85 m, 13 ms — à chaque pas d'un combattant). */
export function retainWeatherField(slot: PrecipSlot | null, scene: Scene, def: WeatherPrecipDef, seed: string): PrecipSlot {
  const area = precipArea(scene, def);
  const cle = precipFieldKey(scene, area);
  return slot && slot.cle === cle ? slot : { cle, champ: makeWeatherField(def, area, seed) };
}

/** Réinjecte une coordonnée SORTIE de l'emprise par l'arête OPPOSÉE — l'emprise est TORIQUE pour le
 *  vent, qui sinon creuserait le bord d'où il souffle. */
function reboucler(v: number, a: number, b: number): number {
  const longueur = b - a;
  if (!(longueur > 0)) return a;
  if (v < a) return b - ((a - v) % longueur);
  if (v > b) return a + ((v - b) % longueur);
  return v;
}

/** Repose une particule au PLAFOND de SA colonne — `x`/`z` sont ceux de son arrivée, rebouclés dans
 *  l'emprise. Le recyclage est la seule façon dont une particule quitte ou rejoint le volume : ni le
 *  compte du champ, ni la colonne d'une goutte ne bougent. Cette colonne CONSERVÉE est ce qui garde la
 *  densité au sol indépendante du bâti (cf. l'en-tête) : la pluie tombe partout à la même cadence, un
 *  toit ne fait qu'arrêter ce qui lui arrive dessus. */
function recycler(field: WeatherField, i: number, x: number, z: number): void {
  const { area, pos, jitter, rng } = field;
  pos[i * 3] = reboucler(x, area.x0, area.x1);
  pos[i * 3 + 1] = area.topM;
  pos[i * 3 + 2] = reboucler(z, area.z0, area.z1);
  jitter[i] = 0.8 + rng() * 0.4;
}

/** UN PAS de la chute (`dtS` secondes). Chaque particule descend de sa vitesse propre et dérive au
 *  vent ; celle qui touche le sol, qui sort de l'emprise ou qui passe SOUS UN COUVERT remonte au
 *  plafond de sa colonne. Rend le nombre de recyclages du pas (instrument de mesure, pas de décor).
 *  `dtS` est borné par l'appelant : un onglet revenu au premier plan ne doit pas téléporter l'averse. */
export function stepWeatherField(field: WeatherField, dtS: number, sheltered: ShelteredAt = CIEL_OUVERT): number {
  const { def, area, pos, jitter, n } = field;
  const dx = def.windMs.x * dtS;
  const dz = def.windMs.z * dtS;
  const dy = def.fallMs * dtS;
  let recycles = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 3;
    const x = pos[o] + dx;
    const y = pos[o + 1] - dy * jitter[i];
    const z = pos[o + 2] + dz;
    if (y <= area.groundM || x < area.x0 || x > area.x1 || z < area.z0 || z > area.z1 || sheltered(x, z, y)) {
      recycler(field, i, x, z);
      recycles++;
      continue;
    }
    pos[o] = x;
    pos[o + 1] = y;
    pos[o + 2] = z;
  }
  return recycles;
}

/** Base d'ORIENTATION du semis, commune à toutes ses particules : la longueur du quad court dans le
 *  sens de la VITESSE (chute + vent), sa largeur est perpendiculaire à la fois à cette vitesse et à
 *  l'axe de la caméra — le quad fait donc face à l'œil tout en filant dans le sens de la chute.
 *  Colonnes de la matrice d'instance, échelle comprise ; `camDir` = axe de visée (unitaire).
 *  Le repli (`camDir` parallèle à la vitesse — une caméra plein zénith) prend l'axe est. */
export function precipBasis(def: WeatherPrecipDef, camDir: { x: number; y: number; z: number }): Float32Array {
  const vx = def.windMs.x;
  const vy = -def.fallMs;
  const vz = def.windMs.z;
  const vlen = Math.hypot(vx, vy, vz) || 1;
  const uy = [vx / vlen, vy / vlen, vz / vlen];
  // Droite = vitesse × axe caméra.
  let rx = uy[1] * camDir.z - uy[2] * camDir.y;
  let ry = uy[2] * camDir.x - uy[0] * camDir.z;
  let rz = uy[0] * camDir.y - uy[1] * camDir.x;
  let rlen = Math.hypot(rx, ry, rz);
  if (rlen < 1e-6) {
    rx = 1; ry = 0; rz = 0;
    rlen = 1;
  }
  const ux = [rx / rlen, ry / rlen, rz / rlen];
  // Normale du quad = droite × vitesse : elle regarde la caméra par construction.
  const uz = [
    ux[1] * uy[2] - ux[2] * uy[1],
    ux[2] * uy[0] - ux[0] * uy[2],
    ux[0] * uy[1] - ux[1] * uy[0],
  ];
  const out = new Float32Array(9);
  for (let k = 0; k < 3; k++) {
    out[k] = ux[k] * def.widthM;
    out[3 + k] = uy[k] * def.lengthM;
    out[6 + k] = uz[k];
  }
  return out;
}

/** Une colonne ÉCRÊTÉE, en coordonnées MONDE (mètres) : `true` = ce qui tombe ici ne se REND pas. */
export type ClippedAt = (xM: number, zM: number) => boolean;

/** Rien n'est écrêté — le semis se rend en entier. */
export const RIEN_ECRETE: ClippedAt = () => false;

/**
 * Écrit les matrices d'instance (colonne-majeur, la convention de three) du semis dans `out`.
 * `basis` change quand la caméra tourne ; les POSITIONS changent à chaque frame — d'où deux écritures
 * séparées, et `full=false` ne touche que la translation (3 flottants par particule).
 *
 * ÉCRÊTAGE (#1247) : une particule dont la colonne est écrêtée reçoit une base NULLE — son quad se
 * réduit à un point, donc il ne peint rien, sans jamais toucher au champ (ni au compte, ni aux
 * positions, ni à la clé de rétention : aucun re-semis). L'état d'écrêtage de chaque particule est
 * RETENU (`field.ecrete`) : seule celle qui vient d'entrer ou de sortir d'une colonne écrêtée coûte
 * ses douze flottants de base, les autres gardent l'écriture à trois flottants du lot P2-6.
 */
export function writePrecipMatrices(
  out: Float32Array,
  field: WeatherField,
  basis: Float32Array,
  full = true,
  clipped: ClippedAt = RIEN_ECRETE,
): void {
  const { pos, n, ecrete } = field;
  for (let i = 0; i < n; i++) {
    const m = i * 16;
    const coupee = clipped(pos[i * 3], pos[i * 3 + 2]) ? 1 : 0;
    if (full || coupee !== ecrete[i]) {
      const b = coupee ? ZERO_BASIS : basis;
      out[m] = b[0]; out[m + 1] = b[1]; out[m + 2] = b[2]; out[m + 3] = 0;
      out[m + 4] = b[3]; out[m + 5] = b[4]; out[m + 6] = b[5]; out[m + 7] = 0;
      out[m + 8] = b[6]; out[m + 9] = b[7]; out[m + 10] = b[8]; out[m + 11] = 0;
      out[m + 15] = 1;
      ecrete[i] = coupee;
    }
    out[m + 12] = pos[i * 3];
    out[m + 13] = pos[i * 3 + 1];
    out[m + 14] = pos[i * 3 + 2];
  }
}

/** Base d'une particule écrêtée : le quad s'effondre sur son centre. */
const ZERO_BASIS = new Float32Array(9);

/** Le MESH du semis : un quad unité (plan XY, centré) instancié `n` fois, matériau non éclairé et
 *  translucide (une goutte n'a pas de normale à éclairer), qui n'écrit PAS la profondeur — deux gouttes
 *  qui se croisent ne se découpent pas — mais la TESTE : le monde, lui, les cache. */
export function buildPrecipMesh(field: WeatherField): THREE.InstancedMesh {
  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = materiauPlanTransparent({
    color: new THREE.Color(field.def.color),
    opacity: field.def.opacity,
    depthWrite: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, field.n));
  mesh.name = 'precip';
  mesh.count = field.n;
  mesh.frustumCulled = false; // le semis couvre la carte entière : sa sphère englobante ne cull rien
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return withRenderRank(mesh, 'pluie');
}
