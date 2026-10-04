// ZI 13 l.251-406 (« Précieuses entrailles ») — profil porté par `CreatureData.harvest`.
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

/** Id de trapping des pièces de créature brutes (`trappings.json`) — la seule graphie de cette référence. */
export const PIECES_DE_CREATURE_TRAPPING_ID = 'pieces-de-creature';

// ZI 13 l.284-287 ; Unique « 5+ CO » : #2137.
const RARITY_BASE: Record<Rarity, number> = {
  Commune: 80,
  Limitée: 10 * PA_PER_SC,
  Rare: 1 * PA_PER_CO,
  Exotique: 3 * PA_PER_CO,
  Unique: 5 * PA_PER_CO,
};
// ZI 13 l.294-299.
const DANGER_MULT: Record<Danger, number> = { Inoffensive: 0.5, Inquiétante: 1, Menaçante: 2, Mortelle: 3 };
// ZI 13 l.304-310.
const SIZE_QTY: Record<HarvestSize, number> = { InfMoyenne: 1, Moyenne: 2, Grande: 4, Énorme: 8, Monstrueuse: 16 };
const SIZE_LADDER: HarvestSize[] = ['InfMoyenne', 'Moyenne', 'Grande', 'Énorme', 'Monstrueuse'];
// ZI 13 l.402-405.
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

/** ZI 13 l.304-310 — Taille de récolte d'un cadavre : la Taille de son profil (`tailleDuProfil`,
 *  `src/data/index.ts`) ; sans Taille : `effectiveSize` (`src/engine/size.ts`). */
export function harvestSizeOf(creature: { traits?: TraitList; talents?: readonly { id: string }[] }): HarvestSize {
  return HARVEST_SIZE_BY_CATEGORY[tailleDuProfil(creature)];
}

/** ZI 13 l.280-300, l.400-405 — valeur d'UNE pièce (1 Enc) de cette créature à ce Degré de conservation.
 *  SOURCE UNIQUE : la vente (`state/merchantFlow.ts › valeurPropre`), le Codex. */
export function valeurDUnePiece(p: HarvestProfile, conservation: Conservation): Money {
  // Pourri : ZI 13 l.400, l.405 ; #2137.
  if (conservation === 'Pourri' && p.rarity !== 'Exotique' && p.rarity !== 'Unique') return fromBrass(0);
  return fromBrass(RARITY_BASE[p.rarity] * DANGER_MULT[p.danger] * CONSERV_MULT[conservation]);
}

/**
 * ZI 13 l.302-316 — quantité exploitable (Enc) d'un cadavre de cette Taille de récolte.
 * @param savoirDR  DR du Test de Savoir ; le cran par DR d'échec : #1136.
 */
export function harvestYield(size: HarvestSize, savoirDR: number): number {
  let idx = SIZE_LADDER.indexOf(size);
  if (idx < 0) idx = SIZE_LADDER.indexOf('Moyenne');
  if (savoirDR < 0) idx = Math.max(0, idx + savoirDR);
  return SIZE_QTY[SIZE_LADDER[idx]];
}
