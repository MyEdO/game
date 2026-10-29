/**
 * Monnaie impériale (pur). RAW LDB 57 « La monnaie » p.290 : 1 couronne d'or (CO) = 20 pistoles
 * d'argent = 240 sous de cuivre ; 1 pistole = 12 sous. Le champ `brass` du store = le sou de cuivre
 * (= `price.brass` des catalogues). SOURCE UNIQUE du type `Money` : le state (`pendings.ts`) le
 * ré-importe d'ici (sens autorisé state→engine), pas de copie. Affichage canon (LDB 57) : CO
 * (couronne d'or), notation `/` pour les
 * pistoles d'argent (« 6/8 », « 20/– »), sc (sou de cuivre). `formatMoney` = SOURCE UNIQUE d'affichage.
 */
import { t } from '../i18n';
import { formatDice, type DiceSpec } from './dice';
import { garanti } from '../lib/garanti';
export interface Money { gold: number; silver: number; brass: number; }
export const PA_PER_SC = 12;
export const PA_PER_CO = 240; // 20 × 12

export function toBrass(m: Money): number {
  return m.gold * PA_PER_CO + m.silver * PA_PER_SC + m.brass;
}
export function fromBrass(pa: number): Money {
  let r = Math.max(0, Math.round(pa));
  const gold = Math.floor(r / PA_PER_CO);
  r -= gold * PA_PER_CO;
  const silver = Math.floor(r / PA_PER_SC);
  r -= silver * PA_PER_SC;
  return { gold, silver, brass: r };
}
export function add(a: Money, b: Money): Money {
  return fromBrass(toBrass(a) + toBrass(b));
}
/** a − b, ou null si insuffisant. */
export function subtract(a: Money, b: Money): Money | null {
  const d = toBrass(a) - toBrass(b);
  return d < 0 ? null : fromBrass(d);
}
export function canAfford(purse: Money, cost: Money): boolean {
  return toBrass(purse) >= toBrass(cost);
}
/** Prix de donnée → `Money`. SOURCE UNIQUE de la conversion : elle admet les formes NON chiffrées de
 *  la colonne Prix (`TrappingData.price` : la marque `'ND'`, ou `null`) et les rend à zéro sou —
 *  aucun appelant n'a de garde à recopier, aucun ne devine un montant. Les objets concernés sont hors
 *  du commerce ordinaire (`isTradable`, engine/disponibilite), qui les refuse sur la Disponibilité. */
export function priceToMoney(p: Partial<Money> | 'ND' | null): Money {
  return p === 'ND' || p === null ? { gold: 0, silver: 0, brass: 0 } : toMoney(p);
}
/** Normalise un montant partiel `{gold?,silver?,brass?}` en `Money` plein (champs manquants = 0).
 *  `toBrass`/`canAfford` n'admettent pas les champs undefined → passer par ici pour un coût authored. */
export function toMoney(p: { gold?: number; silver?: number; brass?: number }): Money {
  return { gold: p.gold ?? 0, silver: p.silver ?? 0, brass: p.brass ?? 0 };
}
/** Échelon de Statut, et de prix (`CRAFT_BASE_DR`, `engine/activities`). LDB 08 l.9 */
export type StatusTier = 'bronze' | 'argent' | 'or';
/** Un Statut : son Échelon et son Standing. */
export interface Status { tier: StatusTier; standing: number }

/** Le libellé joueur d'un Échelon (« Argent »). */
export const libelleDEchelon = (tier: StatusTier): string => t(`statut.echelon.${tier}`);

/** Décompose un libellé de Statut (« Argent 2 », « Bronze 1 », « Or 3 ») ; `null` s'il n'est pas reconnu.
 *  SOURCE UNIQUE du parsing, et de la validation des Statuts de donnée (`statutSchema`). */
export function parseStatus(status: string | undefined | null): Status | null {
  const m = /^(bronze|argent|or)\s+(\d+)$/i.exec(status?.trim() ?? '');
  return m ? { tier: m[1].toLowerCase() as StatusTier, standing: Number(m[2]) } : null;
}

/** Le Statut d'une donnée CHARGÉE — dataset, projet, ou scène d'une save (`lireSave`) —, que son schéma a
 *  validé par `parseStatus` (`statutSchema`). */
export const statutDeDonnee = (status: string): Status => garanti(parseStatus(status), status, 'Statut validé au schéma');

/**
 * « Tenir les comptes » (LDB 59 l.9-11) : seuil, en sous de cuivre, en deçà duquel un objet est réputé
 * toujours abordable — `standing` pièces de la monnaie de l'Échelon.
 */
export function statusBudgetBrass(tier: StatusTier, standing: number): number {
  return toBrass(enPieces(GAIN_PAR_STANDING[tier].unite, Math.max(0, standing)));
}

/** Un objet est-il « toujours abordable » sous « Tenir les comptes » : prix ≤ seuil de Statut (LDB 59) ? */
export function withinStatusBudget(priceBrass: number, tier: StatusTier, standing: number): boolean {
  return priceBrass <= statusBudgetBrass(tier, standing);
}

/** Somme par Standing de chaque Échelon : ses dés (`n` à 0 = somme fixe `plus`) et sa pièce. LDB 08
 *  l.115-119, LDB 05 l.576-578 */
const GAIN_PAR_STANDING: Record<StatusTier, { de: DiceSpec; unite: keyof Money }> = {
  bronze: { de: { n: 2, sides: 10 }, unite: 'brass' },
  argent: { de: { n: 1, sides: 10 }, unite: 'silver' },
  or: { de: { n: 0, sides: 0, plus: 1 }, unite: 'gold' },
};

/** Le gain de Statut d'un `standing` (plancher 0) : les dés de TOUS ses Standings réunis et la pièce
 *  qu'ils comptent. SOURCE UNIQUE de la grille, que lisent Revenus, leur plafond et la richesse
 *  initiale. LDB 08 l.115-119, LDB 05 l.576-578 */
export function gainDeStatut(tier: StatusTier, standing: number): { de: DiceSpec; unite: keyof Money } {
  const { de, unite } = GAIN_PAR_STANDING[tier];
  const k = Math.max(0, standing);
  return { de: { n: de.n * k, sides: de.sides, plus: (de.plus ?? 0) * k }, unite };
}

/** `valeur` pièces de `unite`, sans conversion. */
export const enPieces = (unite: keyof Money, valeur: number): Money => ({ gold: 0, silver: 0, brass: 0, [unite]: valeur });

/** La formule joueur du gain de Statut (« 4d10 sous de cuivre », « 3 couronnes d'or ») ; sans
 *  `standing`, celle d'UN Standing. LDB 08 l.115-119, LDB 05 l.576-578 */
export function formuleDeRevenus(tier: StatusTier, standing = 1): string {
  const { de, unite } = gainDeStatut(tier, standing);
  const fixe = de.plus ?? 0;
  if (de.n === 0 && fixe === 0) return t('money.none');
  return t(`money.${unite}`, de.n > 0 ? { n: formatDice(de), s: 's' } : { n: fixe, s: fixe > 1 ? 's' : '' });
}

/** Affichage canon de la monnaie (LDB 57 « La monnaie », l.25/31/33). Abréviations canon : couronne
 *  d'or = `CO`, sou de cuivre = `sc`, pistole d'argent = la notation `/` (PAS « pa »). Les pistoles
 *  et les sous se combinent en `S/C` — « 6/8 » = 6 pistoles 8 sous, « 20/– » = 20 pistoles sans sou
 *  (le livre écrit « si la monnaie est un peu mélangée : 6/8 »). Sous seuls = `N sc` ; or = `N CO`.
 *  Zéros omis (sauf « 0 sc » si tout est nul). SOURCE UNIQUE d'affichage de la monnaie. */
export function formatMoney(m: Money): string {
  const parts: string[] = [];
  if (m.gold) parts.push(`${m.gold} CO`);
  if (m.silver) parts.push(`${m.silver}/${m.brass || '–'}`); // pistoles (+ sous) : notation canon « S/C »
  else if (m.brass) parts.push(`${m.brass} sc`); // sous seuls (LDB 57 « 240sc »)
  return parts.length ? parts.join(' ') : '0 sc';
}

/** Épellation française COMPLÈTE d'un montant (#354 : la notation canon « 10/– » n'est pas
 *  auto-explicative — « 10 pistoles d'argent » l'est). SOURCE UNIQUE pour le `title` de `<Coins>`,
 *  jamais dupliquée par écran. */
export function spellMoney(m: Money): string {
  const parts: string[] = [];
  if (m.gold) parts.push(t('money.gold', { n: m.gold, s: m.gold > 1 ? 's' : '' }));
  if (m.silver) parts.push(t('money.silver', { n: m.silver, s: m.silver > 1 ? 's' : '' }));
  if (m.brass) parts.push(t('money.brass', { n: m.brass, s: m.brass > 1 ? 's' : '' }));
  return parts.length ? parts.join(', ') : t('money.none');
}
