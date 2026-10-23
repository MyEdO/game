/**
 * Monnaie impériale (pur). RAW LDB 57 « La monnaie » p.290 : 1 couronne d'or (CO) = 20 pistoles
 * d'argent = 240 sous de cuivre ; 1 pistole = 12 sous. Le champ `brass` du store = le sou de cuivre
 * (= `price.brass` des catalogues). SOURCE UNIQUE du type `Money` : le state (`pendings.ts`) le
 * ré-importe d'ici (sens autorisé state→engine), pas de copie. Affichage canon (LDB 57) : CO
 * (couronne d'or), notation `/` pour les
 * pistoles d'argent (« 6/8 », « 20/– »), sc (sou de cuivre). `formatMoney` = SOURCE UNIQUE d'affichage.
 */
import { t, pluriel } from '../i18n';
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
/**
 * « Tenir les comptes » (LDB 59 l.9-11, règle optionnelle de simplification) : « Si un objet coûte moins
 * que votre niveau de Statut — donc, si vous avez un Statut Argent 2, n'importe quel objet coûtant 2
 * pistoles d'argent ou moins — on considère que vous pouvez acheter autant de fois que nécessaire cet
 * objet. » Seuil (en sous de cuivre) en deçà duquel un objet est réputé toujours abordable : Bronze N =
 * N sous, Argent N = N pistoles, Or N = N couronnes.
 */
export type StatusTier = 'bronze' | 'argent' | 'or';
export function statusBudgetBrass(tier: StatusTier, standing: number): number {
  const unit = tier === 'or' ? PA_PER_CO : tier === 'argent' ? PA_PER_SC : 1;
  return Math.max(0, standing) * unit;
}

/** Un objet est-il « toujours abordable » sous « Tenir les comptes » : prix ≤ seuil de Statut (LDB 59) ? */
export function withinStatusBudget(priceBrass: number, tier: StatusTier, standing: number): boolean {
  return priceBrass <= statusBudgetBrass(tier, standing);
}

/** Décompose un libellé de Statut de carrière (« Argent 2 », « Bronze 1 », « Or 3 ») en Échelon + Standing.
 *  null si le libellé n'est pas reconnu (Statut absent / « — »). Sert à « Tenir les comptes ». */
export function parseStatus(status: string | undefined | null): { tier: StatusTier; standing: number } | null {
  if (!status) return null;
  const m = /^(bronze|argent|or)\s*(\d+)/i.exec(status.trim());
  if (!m) return null;
  return { tier: m[1].toLowerCase() as StatusTier, standing: Number(m[2]) };
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
  if (m.gold) parts.push(t('money.gold', { n: m.gold, s: pluriel(m.gold) }));
  if (m.silver) parts.push(t('money.silver', { n: m.silver, s: pluriel(m.silver) }));
  if (m.brass) parts.push(t('money.brass', { n: m.brass, s: pluriel(m.brass) }));
  return parts.length ? parts.join(', ') : t('money.none');
}
