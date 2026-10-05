// Précieuses Entrailles (ZI « Le Zoo Impérial », appendice) : récolte de « pièces de
// monstre » sur un cadavre de créature. Moteur PUR — la valeur d'une pièce dépend de la
// rareté et de la dangerosité de la bête (coût de base par Enc), de sa Taille (quantité
// exploitable), du Test de Savoir (chaque DR d'échec retire un cran de quantité) et du
// Degré de Conservation depuis la mort. Le profil de récolte (rareté/dangerosité/usages)
// est porté par la créature (`CreatureData.harvest`) — pas de table parallèle.
import type { CreatureData, HarvestRarity, HarvestDanger } from '../data';
import { findCreatureById, tailleDuProfil } from '../data';
import { fromBrass, type Money, PA_PER_SC, PA_PER_CO } from './money';
import type { TraitList } from './statEntry';
import { type SizeCategory } from './size';

export type Rarity = HarvestRarity;
export type Danger = HarvestDanger;
export type Conservation = 'Frais' | 'Conservé' | 'Faisandé' | 'Pourri';
export type HarvestSize = 'InfMoyenne' | 'Moyenne' | 'Grande' | 'Énorme' | 'Monstrueuse';
export type HarvestProfile = NonNullable<CreatureData['harvest']>;

// Coût de base pour 1 Enc de pièces brutes (ZI), en sous de cuivre — via la monnaie canon.
const RARITY_BASE: Record<Rarity, number> = {
  Commune: 80,
  Limitée: 10 * PA_PER_SC, // 10/-
  Rare: 1 * PA_PER_CO, // 1 CO
  Exotique: 3 * PA_PER_CO, // 3 CO
  Unique: 5 * PA_PER_CO, // 5 CO
};
// Multiplicateur de dangerosité (le coût « par Enc » du tableau du livre = base × ce facteur).
const DANGER_MULT: Record<Danger, number> = { Inoffensive: 0.5, Inquiétante: 1, Menaçante: 2, Mortelle: 3 };
// Quantité exploitable (Enc) selon la Taille du cadavre.
const SIZE_QTY: Record<HarvestSize, number> = { InfMoyenne: 1, Moyenne: 2, Grande: 4, Énorme: 8, Monstrueuse: 16 };
const SIZE_LADDER: HarvestSize[] = ['InfMoyenne', 'Moyenne', 'Grande', 'Énorme', 'Monstrueuse'];
// Modificateur de prix selon le Degré de Conservation (Conservé = standard du tableau).
const CONSERV_MULT: Record<Conservation, number> = { Frais: 2, Conservé: 1, Faisandé: 0.5, Pourri: 0.125 };

/** Profil de récolte d'une créature par son `id` (ou undefined si non répertoriée). */
export function harvestProfileFor(creatureId: string | undefined): HarvestProfile | undefined {
  return findCreatureById(creatureId)?.harvest ?? undefined;
}

/** Bracket de quantité exploitable d'une catégorie de Taille (`ZI 13 l.304-310`) — « Inférieure à
 *  Moyenne » couvre les trois catégories sous Moyenne. */
const HARVEST_SIZE_BY_CATEGORY: Record<SizeCategory, HarvestSize> = {
  minuscule: 'InfMoyenne',
  tresPetite: 'InfMoyenne',
  petite: 'InfMoyenne',
  moyenne: 'Moyenne',
  grande: 'Grande',
  enorme: 'Énorme',
  monstrueuse: 'Monstrueuse',
};

/** Taille de récolte d'un cadavre : la Taille de son profil (`tailleDuProfil`, `src/data/index.ts`).
 *  Sans Taille, la catégorie retombe sur Moyenne — ARBITRAGE de ce projet (standard
 *  implicite des espèces sans Trait, cf. `src/engine/size.ts`), la table ZI ne dit rien du cas. */
export function harvestSizeOf(creature: { traits?: TraitList; talents?: readonly { id: string }[] }): HarvestSize {
  return HARVEST_SIZE_BY_CATEGORY[tailleDuProfil(creature)];
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
 * Récolte des pièces d'un cadavre.
 * @param savoirDR  DR du Test de Savoir (Bêtes/Remèdes/Magie). ≥0 = réussite (quantité pleine) ;
 *                  chaque DR négatif retire 1 cran sur l'échelle de Taille.
 */
export function harvestYield(
  p: HarvestProfile,
  size: HarvestSize,
  savoirDR: number,
  conservation: Conservation = 'Frais',
): HarvestResult {
  let idx = SIZE_LADDER.indexOf(size);
  if (idx < 0) idx = SIZE_LADDER.indexOf('Moyenne');
  if (savoirDR < 0) idx = Math.max(0, idx + savoirDR); // un cran de moins par DR d'échec
  const enc = SIZE_QTY[SIZE_LADDER[idx]];
  const perEncBrass = RARITY_BASE[p.rarity] * DANGER_MULT[p.danger];
  // Pourri : seules les pièces Exotiques/Uniques conservent de la valeur.
  const noValue = conservation === 'Pourri' && p.rarity !== 'Exotique' && p.rarity !== 'Unique';
  const mult = noValue ? 0 : CONSERV_MULT[conservation];
  return { enc, perEnc: fromBrass(perEncBrass), total: fromBrass(enc * perEncBrass * mult) };
}
