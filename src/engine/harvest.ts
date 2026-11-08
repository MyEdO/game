// Précieuses Entrailles (ZI « Le Zoo Impérial », appendice) : récolte de « pièces de
// monstre » sur un cadavre de créature. Moteur PUR — la valeur d'une pièce dépend de la
// rareté et de la dangerosité de la bête (coût de base par Enc), de sa Taille (quantité
// exploitable), du Test de Savoir (chaque DR d'échec retire un cran de quantité) et du
// Degré de Conservation depuis la mort. Le profil de récolte (rareté/dangerosité/usages)
// est porté par la créature (`CreatureData.harvest`) — pas de table parallèle.
import type { CreatureData, HarvestRarity, HarvestDanger } from '../data';
import { findCreatureById, tailleDuProfil } from '../data';
import { fromBrass, type Money, PA_PER_SC, PA_PER_CO } from './money';
import type { TraitsDesignes } from './statEntry';
import { type SizeCategory } from './size';
import type { TestDesigne } from './skills';
import { hasTraitKey } from './traits/dispatch';

export type Rarity = HarvestRarity;
export type Danger = HarvestDanger;
export type Conservation = 'frais' | 'conserve' | 'faisande' | 'pourri';
export type HarvestSize = 'inf-moyenne' | 'moyenne' | 'grande' | 'enorme' | 'monstrueuse';
export type HarvestProfile = NonNullable<CreatureData['harvest']>;

// Coût de base pour 1 Enc de pièces brutes (ZI), en sous de cuivre — via la monnaie canon.
const RARITY_BASE: Record<Rarity, number> = {
  commune: 80,
  limitee: 10 * PA_PER_SC, // 10/-
  rare: 1 * PA_PER_CO, // 1 CO
  exotique: 3 * PA_PER_CO, // 3 CO
  unique: 5 * PA_PER_CO, // 5 CO
};
// Multiplicateur de dangerosité (le coût « par Enc » du tableau du livre = base × ce facteur).
const DANGER_MULT: Record<Danger, number> = { inoffensive: 0.5, inquietante: 1, menacante: 2, mortelle: 3 };
// Quantité exploitable (Enc) selon la Taille du cadavre.
const SIZE_QTY: Record<HarvestSize, number> = { 'inf-moyenne': 1, moyenne: 2, grande: 4, enorme: 8, monstrueuse: 16 };
const SIZE_LADDER: HarvestSize[] = ['inf-moyenne', 'moyenne', 'grande', 'enorme', 'monstrueuse'];
// Modificateur de prix selon le Degré de Conservation (Conservé = standard du tableau).
const CONSERV_MULT: Record<Conservation, number> = { frais: 2, conserve: 1, faisande: 0.5, pourri: 0.125 };

/** Profil de récolte d'une créature par son `id` (ou undefined si non répertoriée). */
export function harvestProfileFor(creatureId: string | undefined): HarvestProfile | undefined {
  return findCreatureById(creatureId)?.harvest ?? undefined;
}

/** Bracket de quantité exploitable d'une catégorie de Taille (`ZI 13 l.304-310`) — « Inférieure à
 *  Moyenne » couvre les trois catégories sous Moyenne. */
const HARVEST_SIZE_BY_CATEGORY: Record<SizeCategory, HarvestSize> = {
  minuscule: 'inf-moyenne',
  tresPetite: 'inf-moyenne',
  petite: 'inf-moyenne',
  moyenne: 'moyenne',
  grande: 'grande',
  enorme: 'enorme',
  monstrueuse: 'monstrueuse',
};

/** Taille de récolte d'un cadavre : la Taille de son profil (`tailleDuProfil`, `src/data/index.ts`).
 *  Sans Taille, la catégorie retombe sur Moyenne — ARBITRAGE de ce projet (standard
 *  implicite des espèces sans Trait, cf. `src/engine/size.ts`), la table ZI ne dit rien du cas. */
export function harvestSizeOf(creature: { traits?: TraitsDesignes; talents?: readonly { id: string }[] }): HarvestSize {
  return HARVEST_SIZE_BY_CATEGORY[tailleDuProfil(creature)];
}

/** Savoir (Bêtes) : la spécialité des bêtes de `skills.json`. */
const SAVOIR_BETES: TestDesigne = { skill: { id: 'savoir', spec: 'betes-sauvages' } };
const SAVOIR_REMEDES: TestDesigne = { skill: { id: 'savoir', spec: 'remedes' } };
const METIER_EMPOISONNEUR: TestDesigne = { skill: { id: 'metier', spec: 'empoisonneur' } };
const SAVOIR_MAGIE: TestDesigne = { skill: { id: 'savoir', spec: 'magie' } };

/** Le Test qu'ouvre un Trait de la créature, par id : vénéneuse ou venimeuse se lit au Trait `venin`, « mystique » au
 *  Trait `magique` (lecture d'ingénierie de l'orchestrateur). ZI 13 l.316 */
const TEST_PAR_TRAIT: Readonly<Record<string, TestDesigne>> = { venin: METIER_EMPOISONNEUR, magique: SAVOIR_MAGIE };

/** Les Tests qui reconnaissent les pièces de `creature`. ZI 13 l.316 */
export function testsDeRecolte(creature: { traits?: TraitsDesignes }): TestDesigne[] {
  return [SAVOIR_BETES, SAVOIR_REMEDES, ...Object.entries(TEST_PAR_TRAIT).flatMap(([trait, test]) => (hasTraitKey(creature.traits, trait) ? [test] : []))];
}

/** Coût de base d'1 Enc de pièces de cette créature = rareté × dangerosité. */
export function costPerEnc(p: HarvestProfile): Money {
  return fromBrass(RARITY_BASE[p.rarity] * DANGER_MULT[p.danger]);
}

export interface HarvestResult {
  /** Encombrement de pièces récoltées (après réduction au Savoir). */
  enc: number;
  /** Coût de base d'1 Enc, avant Conservation. */
  perEnc: Money;
  /** Valeur totale, Conservation incluse. */
  total: Money;
}

/**
 * Récolte des pièces d'un cadavre. ZI 13 l.306-310, l.316
 * @param savoirDR  DR du Test de reconnaissance des pièces (`testsDeRecolte`), réussi ou non.
 */
export function harvestYield(
  p: HarvestProfile,
  size: HarvestSize,
  savoirDR: number,
  conservation: Conservation = 'frais',
): HarvestResult {
  const idx = SIZE_LADDER.indexOf(size) + Math.min(0, savoirDR);
  const enc = idx < 0 ? 0 : SIZE_QTY[SIZE_LADDER[idx]];
  const perEncBrass = RARITY_BASE[p.rarity] * DANGER_MULT[p.danger];
  // Pourri : seules les pièces Exotiques/Uniques conservent de la valeur.
  const noValue = conservation === 'pourri' && p.rarity !== 'exotique' && p.rarity !== 'unique';
  const mult = noValue ? 0 : CONSERV_MULT[conservation];
  return { enc, perEnc: fromBrass(perEncBrass), total: fromBrass(enc * perEncBrass * mult) };
}
