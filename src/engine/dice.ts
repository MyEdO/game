/**
 * Générateur aléatoire injectable (seedable) — indispensable pour des tests
 * déterministes et, plus tard, pour une coop réseau reproductible.
 */
export interface RNG {
  /** Entier dans [min, max] inclus. */
  int(min: number, max: number): number;
}

/** Hash FNV-1a 32 bits → graine entière stable pour un id (variation déterministe rejouable :
 *  mutations/caractéristiques aléatoires au spawn LDB 77/85, rig cosmétique). PUR (#161 : ex-
 *  `gameIso/appearance.ts` — utilitaire générique de seed, pas du rendu). */
export function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** RNG déterministe (mulberry32) à partir d'une graine. */
export function makeRNG(seed: number): RNG {
  let a = seed >>> 0;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    int(min: number, max: number) {
      return min + Math.floor(next() * (max - min + 1));
    },
  };
}

/** RNG par défaut basé sur Math.random (parties solo non rejouables). */
export const defaultRNG: RNG = {
  int: (min, max) => min + Math.floor(Math.random() * (max - min + 1)),
};

export const d10 = (rng: RNG = defaultRNG) => rng.int(1, 10);
export const d100 = (rng: RNG = defaultRNG) => rng.int(1, 100);
export const roll = (n: number, sides: number, rng: RNG = defaultRNG) => {
  let total = 0;
  for (let i = 0; i < n; i++) total += rng.int(1, sides);
  return total;
};

/** Graine d'un flux de tirages dérivé. */
export const tirerGraine = (rng: RNG = defaultRNG): number => rng.int(0, 0x7fffffff);

/**
 * LE d100 DE L'ENVIRONNEMENT — le dé que le MONDE lance (chance d'occurrence d'un péril, contenu
 * narratif d'une conséquence, descente de sous-table). PRIMITIVE de moteur, pas une porte : elle
 * roule, elle ne décide de rien (règle 3 du dépôt — le moteur reçoit un rng, il ne surface pas).
 *
 * ELLE NE CLASSE PAS SON DÉ. Aucune catégorie de dé n'échappe à la porte — doctrine utilisateur du
 * 2026-09-04 : « L'outil peut etre utilisé comme Foundry […] Donc tous les jets de dés sont exposables
 * si on configure le jeu pour » et « Vu que tous les jets passé par le même point d'entrée, il est
 * inutile de se demander si le jeu est configuré pour ». Un site n'a donc AUCUNE question à se poser :
 * il envoie son dé à la porte (`state/rollSeam` — `openWorldTest`, `worldStep`, `tableStep`,
 * `dieStep`), et c'est elle SEULE qui sait si ce dé s'affiche, se lance ou se fixe (siège qui tient le
 * monde, option « Dés fixés »).
 *
 * Un `deMonde(` appelé depuis un flux est donc une DETTE vers zéro (#1508), jamais une classe
 * exemptée : les sites restants sont comptés nominativement par `DES_HORS_PORTE_STOCK` et
 * `ENGINE_DELEGATED_ROLL_STOCK` (`scripts/guards/lib/rollSeamWhitelist.mjs`).
 *
 * Elle vit ICI, dans le moteur PUR (rng injecté), et pas dans le seam : `src/data` en dépend, et une
 * donnée ne peut pas importer le store.
 */
export const deMonde = (rng: RNG = defaultRNG): number => d100(rng);

/** Descripteur de jet de dés en DONNÉE (forme canonique partagée : « NdM(+P ») — `n`d`sides`+`plus`).
 *  Source UNIQUE réutilisée par la Formula `{dice}` (ops), les maladies (incubation/durée) et les
 *  Imparfaites (miscast). */
export interface DiceSpec {
  n: number;
  sides: number;
  plus?: number;
}
/** Roule un `DiceSpec` (n dés à `sides` faces + `plus`). PUR (RNG injecté). */
export const rollDice = (dc: DiceSpec, rng: RNG = defaultRNG): number => roll(dc.n, dc.sides, rng) + (dc.plus ?? 0);

/** Écriture canonique d'un `DiceSpec` (« 1d10 », « 3d10+5 ») — formateur d'affichage/édition. */
export const formatDice = (dc: DiceSpec): string => `${dc.n}d${dc.sides}${dc.plus ? (dc.plus > 0 ? `+${dc.plus}` : `${dc.plus}`) : ''}`;
/** Inverse de `formatDice` : « NdM(+P) » → `DiceSpec` (N implicite = 1). null si non reconnu (authoring). */
export function parseDice(s: string): DiceSpec | null {
  const m = s.trim().match(/^(\d*)\s*d\s*(\d+)\s*([+-]\s*\d+)?$/i);
  if (!m) return null;
  const dc: DiceSpec = { n: m[1] ? parseInt(m[1], 10) : 1, sides: parseInt(m[2], 10) };
  if (m[3]) dc.plus = parseInt(m[3].replace(/\s+/g, ''), 10);
  return dc;
}

/** Évalue une expression de dés signée (« 1d10+15 », « 2d10 », « d10 », « 15 », « 1d6-1 ») → total
 *  tiré. Termes additionnés ; « NdM » roule N dés à M faces (N implicite = 1). PUR (RNG injecté). */
export function rollExpr(expr: string, rng: RNG = defaultRNG): number {
  let total = 0;
  const re = /([+-]?)\s*(?:(\d*)d(\d+)|(\d+))/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(expr)) !== null) {
    const sign = m[1] === '-' ? -1 : 1;
    if (m[3] != null) total += sign * roll(m[2] ? parseInt(m[2], 10) : 1, parseInt(m[3], 10), rng);
    else if (m[4] != null) total += sign * parseInt(m[4], 10);
  }
  return total;
}
