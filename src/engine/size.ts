/**
 * Trait de créature **Taille** (LDB `85 - Traits de creature.md` l.279-280 : 7 catégories,
 * Minuscule → Monstrueuse). Modélisé en INDEX ordinal (0..6) car la mécanique est une
 * COMPARAISON d'écart entre combattants, pas une valeur testée. Mod d'à-toucher au TIR selon
 * la Taille de la CIBLE : `14 - _GoBack.md` l.118-131 (folio 162). « Moyenne » = standard implicite
 * des espèces jouables (l.128), sans Trait. Cf. analyse :
 * docs/superpowers/specs/2026-06-07-taille-analyse-reference.md
 *
 * Données règles (rangedMod, shipboardEnc, footprintSide) dans `src/data/sizes.json`.
 */
import sizesJson from '../data/sizes.json';
import type { QualityId } from './qualities/ids';

export type SizeCategory =
  | 'minuscule'
  | 'tresPetite'
  | 'petite'
  | 'moyenne'
  | 'grande'
  | 'enorme'
  | 'monstrueuse';

export const SIZE_ORDER: Record<SizeCategory, number> = {
  minuscule: 0,
  tresPetite: 1,
  petite: 2,
  moyenne: 3,
  grande: 4,
  enorme: 5,
  monstrueuse: 6,
};

export const SIZE_RANGED_MOD: Record<SizeCategory, number> =
  sizesJson.rangedMod as Record<SizeCategory, number>;

/** Enc qu'un être occupe à bord (place d'Équipage/Contenance selon sa Taille), MDG 12 l.25-33. */
export const SIZE_SHIPBOARD_ENC: Record<SizeCategory, number> =
  sizesJson.shipboardEnc as Record<SizeCategory, number>;

/**
 * Côté N de l'empreinte carrée N×N qu'une créature de cette Taille occupe PAR DÉFAUT sur la grille.
 * LDB 15 l.12 : « Les créatures plus grandes peuvent occuper 2, 4 ou même plus de cases sur la carte,
 * en fonction de leur trait Taille » — le canon n'imprime AUCUNE barre par catégorie : les 7 valeurs
 * sont MAISON, en donnée éditable (`sizes.json::footprintSide`, catégorie Codex « Tailles »). Lu à
 * CHAQUE appel (pas de réf capturée) — une édition au Codex prend effet en direct.
 */
export function sizeFootprintSide(size: SizeCategory): number {
  return (sizesJson.footprintSide as Record<SizeCategory, number>)[size];
}

/** Libellés des 7 catégories — graphies de la table du LDB 85 l.348-354. */
export const SIZE_LABEL: Record<SizeCategory, string> = {
  minuscule: 'Minuscule',
  tresPetite: 'Très petite',
  petite: 'Petite',
  moyenne: 'Moyenne',
  grande: 'Grande',
  enorme: 'Énorme',
  monstrueuse: 'Monstrueuse',
};

/** Taille effective (défaut Moyenne : standard implicite des espèces jouables, LDB 14 l.128). */
export const effectiveSize = (size?: SizeCategory): SizeCategory => size ?? 'moyenne';

/** Écart de catégories attaquant − défenseur (> 0 si l'attaquant est plus grand). */
export const sizeGap = (a?: SizeCategory, b?: SizeCategory): number =>
  SIZE_ORDER[effectiveSize(a)] - SIZE_ORDER[effectiveSize(b)];

const SIZE_BY_NORM: Record<string, SizeCategory> = {
  minuscule: 'minuscule',
  trespetite: 'tresPetite',
  petite: 'petite',
  moyenne: 'moyenne',
  grande: 'grande',
  enorme: 'enorme',
  monstrueuse: 'monstrueuse',
};

const stripAccents = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Catégorie depuis un libellé libre (« Énorme », « de Petite à Énorme »…). Une plage narrative
 * est résolue vers sa **borne HAUTE** : un statbloc attribue UNE catégorie de Taille, une fourchette
 * de libellé est un artefact d'authoring que ce parseur rabat sur sa borne haute. Renvoie
 * null si aucune catégorie n'est reconnue.
 */
export function parseSizeLabel(raw: string): SizeCategory | null {
  const tokens = stripAccents(raw.toLowerCase()).match(
    /minuscule|tres\s*petite|petite|moyenne|grande|enorme|monstrueuse/g,
  );
  if (!tokens) return null;
  let best: SizeCategory | null = null;
  for (const tok of tokens) {
    const cat = SIZE_BY_NORM[tok.replace(/\s+/g, '')];
    if (cat && (best === null || SIZE_ORDER[cat] > SIZE_ORDER[best])) best = cat;
  }
  return best;
}

/** Multiplicateur de Dégâts si l'attaquant est plus grand (LDB 85 l.361) : ×2 à +2 cat, ×3 à +3…
 *  (+1 cat = ×1, no-op — le bonus à +1 est l'Atout Dévastatrice). Jamais < 1. */
export function sizeDamageMultiplier(attacker?: SizeCategory, target?: SizeCategory): number {
  const gap = sizeGap(attacker, target);
  return gap >= 2 ? gap : 1;
}

/** Atouts conférés par l'écart de Taille (LDB 85 l.360) : Dévastatrice à +1 cat, Percutante à +2 — CUMUL.
 *  Renvoie des **ids stables** (consommés tels quels par `qualityDamageStep`, plus de parse de libellé). */
export function sizeGrantedQualities(attacker?: SizeCategory, target?: SizeCategory): QualityId[] {
  const gap = sizeGap(attacker, target);
  if (gap >= 2) return ['devastatrice', 'percutante'];
  if (gap >= 1) return ['devastatrice'];
  return [];
}

/** Issue d'un Test de Force opposé selon la Taille (LDB 85 l.378), du point de vue de `a` :
 *  a ≥ +2 cat → `autoWin` ; a plus petit (gap ≤ −1) → `needCrit` (doit un Critique pour s'opposer) ; sinon `normal`. */
export function forceOpposedOutcome(a?: SizeCategory, b?: SizeCategory): 'autoWin' | 'needCrit' | 'normal' {
  const gap = sizeGap(a, b);
  if (gap >= 2) return 'autoWin';
  if (gap <= -1) return 'needCrit';
  return 'normal';
}

/** Points de Blessure de base par catégorie de Taille (LDB 85 l.393-401). bf/be/bfm = Bonus de F/E/FM. */
export function woundsForSize(bf: number, be: number, bfm: number, size: SizeCategory = 'moyenne'): number {
  const moyenne = bf + 2 * be + bfm;
  switch (size) {
    case 'minuscule':
      return 1;
    case 'tresPetite':
      return be;
    case 'petite':
      return 2 * be + bfm;
    case 'moyenne':
      return moyenne;
    case 'grande':
      return moyenne * 2;
    case 'enorme':
      return moyenne * 4;
    case 'monstrueuse':
      return moyenne * 8;
  }
}

/**
 * Taille conférée par une liste de talents résolus (LDB 85 l.344, #572) : la plus GRANDE catégorie
 * portée par `TalentData.size` parmi les talents possédés, sinon `moyenne`. Générique — aucun id de
 * talent nommé ici, la classe entière (Massif, Petit, tout futur talent de Taille) est couverte.
 */
export function sizeFromTalents(talentIds: readonly string[], sizeOf: (talentId: string) => SizeCategory | undefined): SizeCategory {
  for (const id of talentIds) {
    const size = sizeOf(id);
    if (size) return size;
  }
  return 'moyenne';
}

/** Décale une catégorie de Taille de `steps` crans (positif = agrandir), bornée Minuscule..Monstrueuse. */
export function stepSize(size: SizeCategory | undefined, steps: number): SizeCategory {
  const next = Math.max(0, Math.min(6, SIZE_ORDER[effectiveSize(size)] + steps));
  return (Object.keys(SIZE_ORDER) as SizeCategory[]).find((k) => SIZE_ORDER[k] === next)!;
}

/**
 * « Utiliser les Tailles » (LDB 85 l.340) : agrandir une créature de `steps` catégories augmente
 * **F** et **E** de +10 et réduit **Ag** de −5 PAR catégorie ; réduire (`steps` < 0) inverse le procédé.
 * Générique (carac. complètes OU statbloc partiel : une carac. absente part de `def`, défaut 30).
 * Retourne un NOUVEL objet (les autres carac. inchangées). Outil de construction d'une variante.
 */
export function resizeBySteps<T extends { force?: number; endurance?: number; agilite?: number }>(chars: T, steps: number, def = 30): T {
  if (!steps) return { ...chars };
  return { ...chars, force: (chars.force ?? def) + 10 * steps, endurance: (chars.endurance ?? def) + 10 * steps, agilite: (chars.agilite ?? def) - 5 * steps };
}
