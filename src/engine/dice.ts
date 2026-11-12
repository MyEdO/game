/**
 * Générateur aléatoire injectable (seedable) — indispensable pour des tests
 * déterministes et, plus tard, pour une coop réseau reproductible.
 */
export interface RNG {
  /** Entier dans [min, max] inclus. */
  int(min: number, max: number): number;
}

/** Hash FNV-1a 32 bits → graine entière stable pour un id (variation déterministe rejouable :
 *  mutations/caractéristiques aléatoires au spawn LDB 77/85). PUR. */
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

export const d10 = (rng: RNG) => rng.int(1, 10);
export const d100 = (rng: RNG) => rng.int(1, 100);
export const roll = (n: number, sides: number, rng: RNG) => {
  let total = 0;
  for (let i = 0; i < n; i++) total += rng.int(1, sides);
  return total;
};

/** Flux RNG DÉRIVÉ d'une graine racine : un flux par chemin de segments (`${graine}:${segment}…`), si
 *  bien que deux étapes ne se partagent jamais un tirage et qu'un tirage ne dépend pas de ceux d'avant. */
export function fluxDerive(graine: number, ...segments: readonly (string | number)[]): RNG {
  return makeRNG(hashSeed([graine, ...segments].join(':')));
}

/**
 * LE d100 DE L'ENVIRONNEMENT — le dé que le MONDE lance (chance d'occurrence d'un péril, contenu
 * narratif d'une conséquence, descente de sous-table). PRIMITIVE de moteur, pas une porte : elle
 * roule, elle ne décide de rien (règle 3 du dépôt — le moteur reçoit un rng, il ne surface pas).
 *
 * ELLE NE CLASSE PAS SON DÉ. Aucune catégorie de dé n'échappe à la porte — doctrine utilisateur du
 * 2026-09-04 : « L'outil peut etre utilisé comme Foundry […] Donc tous les jets de dés sont exposables
 * si on configure le jeu pour » et « Vu que tous les jets passé par le même point d'entrée, il est
 * inutile de se demander si le jeu est configuré pour ». Un site n'a donc AUCUNE question à se poser :
 * il envoie son dé à la porte (`noyau/rollSeam` — `openWorldTest`, `worldStep`, `tableStep`,
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
export const deMonde = (rng: RNG): number => d100(rng);

/** Descripteur de jet de dés en DONNÉE (forme canonique partagée : « NdM(×F)(+P) » — `n`d`sides`,
 *  multiplié par `fois`, plus `plus`). Source UNIQUE réutilisée par la Formula `{dice}` (ops), les
 *  maladies (incubation/durée), les Imparfaites (miscast) et les détails de création (Âge, Taille). */
export interface DiceSpec {
  n: number;
  sides: number;
  /** Multiplicateur du total des dés, avant `plus` (NADJ 15 l.112). */
  fois?: number;
  plus?: number;
}
/** Le résultat d'un `DiceSpec` pour un total NATUREL de ses dés : `naturel × fois + plus`. PUR. */
export const totalDuDe = (dc: DiceSpec, naturel: number): number => naturel * (dc.fois ?? 1) + (dc.plus ?? 0);
/** Roule un `DiceSpec` (n dés à `sides` faces, × `fois`, + `plus`). PUR (RNG injecté). */
export const rollDice = (dc: DiceSpec, rng: RNG): number => totalDuDe(dc, roll(dc.n, dc.sides, rng));

/** Écriture canonique d'un `DiceSpec` (« 1d10 », « 3d10+5 », « 1d10×2,5+100 ») — formateur
 *  d'affichage/édition. */
export const formatDice = (dc: DiceSpec): string =>
  `${dc.n}d${dc.sides}${dc.fois !== undefined ? `×${String(dc.fois).replace('.', ',')}` : ''}${dc.plus ? (dc.plus > 0 ? `+${dc.plus}` : `${dc.plus}`) : ''}`;
/** Inverse de `formatDice` : « NdM(×F)(+P) » → `DiceSpec` (N implicite = 1, F décimal à virgule ou
 *  à point). null si non reconnu (authoring). */
export function parseDice(s: string): DiceSpec | null {
  const m = s.trim().match(/^(\d*)\s*d\s*(\d+)\s*(?:×\s*(\d+(?:[.,]\d+)?)\s*)?([+-]\s*\d+)?$/i);
  if (!m) return null;
  const dc: DiceSpec = { n: m[1] ? parseInt(m[1], 10) : 1, sides: parseInt(m[2], 10) };
  if (m[3]) dc.fois = parseFloat(m[3].replace(',', '.'));
  if (m[4]) dc.plus = parseInt(m[4].replace(/\s+/g, ''), 10);
  return dc;
}

/** Valeur authorée TIRÉE au dé (`tirageSchema`, `src/data/schemas/grammaire/valeurs.ts`). #1652 */
export interface Tirage { dice: DiceSpec }
/** Un nombre OU un tirage. */
export type QuantiteTiree = number | Tirage;
/** La valeur d'une `QuantiteTiree` : le nombre tel quel, le tirage roulé (`rollDice`). PUR (RNG injecté). */
export const tirer = (v: QuantiteTiree, rng: RNG): number => (typeof v === 'number' ? v : rollDice(v.dice, rng));

/** Modificateur de dés SIGNÉ (`effetSigneSchema`) : `n` vaut 0 quand seul `plus` compte. */
export interface EffetSigne { sign: 1 | -1; dice: DiceSpec }
/** Le total signé d'un `EffetSigne` : `sign × rollDice(dice)`. PUR (RNG injecté). */
export const tirerSigne = (e: EffetSigne, rng: RNG): number => e.sign * rollDice(e.dice, rng);
/** Écriture d'un `EffetSigne` (« +2d10 », « −1d10 », « +2d10+5 », « +5 ») — affichage. */
export const formatEffetSigne = (e: EffetSigne): string =>
  `${e.sign > 0 ? '+' : '−'}${e.dice.n > 0 ? formatDice(e.dice) : String(e.dice.plus ?? 0)}`;
